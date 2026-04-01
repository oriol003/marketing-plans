import { NextRequest, NextResponse } from 'next/server'
import { uploadToS3 } from '@/lib/s3'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'marketing-plans/uploads'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const { url, key } = await uploadToS3(file, file.name, {
      folder,
      addRandomSuffix: true,
    })

    return NextResponse.json({ imageUrl: url, key })
  } catch (error) {
    console.error('[upload-image] Error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
