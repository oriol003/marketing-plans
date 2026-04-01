import { NextRequest, NextResponse } from 'next/server'
import { generateImage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { uploadToS3 } from '@/lib/s3'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

export async function POST(request: NextRequest) {
  const { title, description, color, isPortrait } = await request.json()

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  let prompt: string
  let aspectRatio: '16:9' | '1:1' = '16:9'

  if (isPortrait) {
    // ─── Portrait / Avatar mode ───
    aspectRatio = '1:1'
    prompt = `Professional corporate headshot photograph of a realistic person.
${description || ''}

ABSOLUTE RULES:
1. ZERO text, ZERO words, ZERO letters anywhere
2. ZERO logos, ZERO watermarks
3. One person, facing slightly to the side, natural expression
4. Clean, blurred background — office or neutral studio

Style: Corporate headshot photography. Soft studio lighting. Shallow depth of field.
The person should look professional, approachable, and realistic.
High-end LinkedIn headshot quality. Square 1:1 composition.`
  } else {
    // ─── Banner mode ───
    const topicHints = title.toLowerCase()
    let sceneDescription = 'a moody, atmospheric, professional scene'
    if (topicHints.includes('social media') || topicHints.includes('reputation')) {
      sceneDescription = 'a content creator filming with a ring light, colorful studio setup, creative lighting'
    } else if (topicHints.includes('video') || topicHints.includes('production')) {
      sceneDescription = 'a videographer behind a cinema camera on set, film equipment, dramatic studio lighting'
    } else if (topicHints.includes('website') || topicHints.includes('digital') || topicHints.includes('seo') || topicHints.includes('development')) {
      sceneDescription = 'glowing fiber optic cables, abstract light trails, colorful bokeh from technology equipment'
    } else if (topicHints.includes('brand') || topicHints.includes('design') || topicHints.includes('visual')) {
      sceneDescription = 'a designer workspace with color swatches, paint samples, printed materials, creative tools on a desk'
    } else if (topicHints.includes('event') || topicHints.includes('community')) {
      sceneDescription = 'an elegant event venue with ambient stage lighting, warm atmosphere, bokeh lights'
    } else if (topicHints.includes('heritage') || topicHints.includes('legacy') || topicHints.includes('history')) {
      sceneDescription = 'vintage leather-bound books, aged wood textures, warm amber tones, antique patina close-ups'
    } else if (topicHints.includes('content') || topicHints.includes('photo')) {
      sceneDescription = 'a photographer at work, camera equipment, film rolls, dramatic lighting setup'
    } else if (topicHints.includes('strategy') || topicHints.includes('research') || topicHints.includes('analysis')) {
      sceneDescription = 'a sophisticated workspace with notebooks, strategy documents, warm desk lamp lighting, coffee'
    } else if (topicHints.includes('email') || topicHints.includes('newsletter')) {
      sceneDescription = 'close-up of hands typing on a sleek keyboard, warm ambient desk lighting, shallow depth of field'
    } else if (topicHints.includes('advertis') || topicHints.includes('paid') || topicHints.includes('campaign')) {
      sceneDescription = 'a creative studio with mood boards, campaign materials pinned to a wall, dramatic directional lighting'
    }

    prompt = `Create a wide cinematic photograph: ${sceneDescription}.

ABSOLUTE RULES — violating any of these makes the image unusable:
1. ZERO text, ZERO words, ZERO letters, ZERO numbers rendered in the image
2. ZERO logos, ZERO watermarks, ZERO labels
3. ZERO screens showing readable content
4. This is a background image — text will be overlaid on top separately

Style: Editorial photography. Shallow depth of field. Cinematic color grading.
Mood: Rich, moody, slightly dark. The image must be dark enough that white text placed on top would be clearly readable.
Color accent: ${color || '#1DB5C4'} — reflected subtly in the lighting or color grade.
Composition: 16:9 wide, cinematic. High-end agency quality. No text anywhere.`
  }

  try {
    console.log(`[generate-phase-image] Generating ${isPortrait ? 'avatar' : 'banner'} via Gemini`)

    const { image } = await generateImage({
      model: google.image('gemini-3.1-flash-image-preview'),
      prompt,
      aspectRatio,
      abortSignal: AbortSignal.timeout(45_000),
    })

    const mimeType = image.mediaType ?? 'image/png'
    const buffer = Buffer.from(image.uint8Array)

    // Upload to S3
    try {
      const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? '.jpg' : '.png'
      const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
      const prefix = isPortrait ? 'avatar' : 'phase'
      const filename = `${prefix}-${sanitizedTitle}${ext}`

      const { url: s3Url } = await uploadToS3(buffer, filename, {
        folder: isPortrait ? 'marketing-plans/avatars' : 'marketing-plans/phase-images',
        contentType: mimeType,
        addRandomSuffix: true,
      })

      console.log(`[generate-phase-image] Uploaded to S3: ${s3Url}`)
      return NextResponse.json({ imageUrl: s3Url })
    } catch (s3Error) {
      console.error(`[generate-phase-image] S3 upload failed, returning base64 fallback:`, s3Error)
      return NextResponse.json({ imageUrl: `data:${mimeType};base64,${image.base64}` })
    }
  } catch (error) {
    console.error(`[generate-phase-image] Error:`, error)
    return NextResponse.json({
      imageUrl: '',
      fallback: true,
      error: 'Image generation unavailable. Using gradient fallback.',
    })
  }
}
