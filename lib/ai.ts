/**
 * Centralized AI Configuration
 * 
 * This module provides direct API access to Gemini 3 Pro/Flash and Claude Opus 4.6
 * without using the Vercel AI SDK.
 * 
 * Model Usage Guidelines:
 * - Gemini 3 Pro: For complex reasoning, long context, and outline generation
 * - Gemini 3 Flash: For fast elaboration, content generation, and confidence rating
 * - Claude Opus 4.6: For creative writing and alternative perspectives
 */

// Model configurations
export const AI_MODELS = {
  // Gemini 3 models - Pro for complex/long context, Flash for speed
  GEMINI_3_PRO: 'gemini-3-pro-preview',       // Best for outline extraction, complex reasoning, long context
  GEMINI_3_FLASH: 'gemini-3-flash-preview',   // Best for elaboration, content generation, fast responses
  GEMINI_3_PRO_VISION: 'gemini-3-pro-preview',

  // Claude models
  CLAUDE_OPUS_4_6: 'claude-opus-4-6',
} as const

export type AIModel = typeof AI_MODELS[keyof typeof AI_MODELS]


// API endpoints
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

// Types
export interface GenerateTextOptions {
  model: AIModel
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}

export interface GenerateObjectOptions<T> {
  model: AIModel
  prompt: string
  systemPrompt?: string
  schema: any // Zod schema
  maxTokens?: number
  temperature?: number
}

export interface GenerateTextResult {
  text: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export interface GenerateObjectResult<T> {
  object: T
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

/**
 * Generate text using Gemini 3 Pro directly
 */
export async function generateTextGemini(options: {
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  enableThinking?: boolean
}): Promise<GenerateTextResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const model = AI_MODELS.GEMINI_3_PRO
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`

  const contents = []

  if (options.systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: `System: ${options.systemPrompt}\n\nUser: ${options.prompt}` }]
    })
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: options.prompt }]
    })
  }

  const requestBody: any = {
    contents,
    generationConfig: {
      maxOutputTokens: options.maxTokens || 8000,
      temperature: options.temperature ?? 0.7,
    },
  }

  // Enable thinking mode if requested
  if (options.enableThinking) {
    requestBody.generationConfig.thinkingConfig = {
      thinkingBudget: 5000,
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Gemini API Error]', response.status, errorText)
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return {
    text,
    usage: data.usageMetadata ? {
      inputTokens: data.usageMetadata.promptTokenCount || 0,
      outputTokens: data.usageMetadata.candidatesTokenCount || 0,
    } : undefined,
  }
}

/**
 * Generate text using Gemini 3 Flash (faster, for elaboration)
 */
export async function generateTextGeminiFlash(options: {
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}): Promise<GenerateTextResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const model = AI_MODELS.GEMINI_3_FLASH
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`

  const contents = []

  if (options.systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: `System: ${options.systemPrompt}\n\nUser: ${options.prompt}` }]
    })
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: options.prompt }]
    })
  }

  const requestBody = {
    contents,
    generationConfig: {
      maxOutputTokens: options.maxTokens || 4000,
      temperature: options.temperature ?? 0.7,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Gemini Flash API Error]', response.status, errorText)
    throw new Error(`Gemini Flash API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return {
    text,
    usage: data.usageMetadata ? {
      inputTokens: data.usageMetadata.promptTokenCount || 0,
      outputTokens: data.usageMetadata.candidatesTokenCount || 0,
    } : undefined,
  }
}

/**
 * Generate structured object using Gemini 3 Flash with JSON mode
 * Best for: Fast elaboration, content generation, confidence scoring
 */
export async function generateObjectGeminiFlash<T>(options: {
  prompt: string
  systemPrompt?: string
  schema: any
  maxTokens?: number
  temperature?: number
}): Promise<GenerateObjectResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const model = AI_MODELS.GEMINI_3_FLASH
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`

  // Build schema description from Zod if available
  let schemaDescription = ''
  if (options.schema && typeof options.schema.describe === 'function') {
    schemaDescription = JSON.stringify(options.schema.shape || options.schema, null, 2)
  } else if (options.schema) {
    schemaDescription = JSON.stringify(options.schema, null, 2)
  }

  const jsonInstructions = `
You must respond with ONLY valid JSON that matches this schema:
${schemaDescription}

CRITICAL: Return ONLY the JSON object, no markdown code blocks, no explanations.
Ensure all strings are properly escaped and no trailing commas are present.
`

  const fullPrompt = options.systemPrompt
    ? `${options.systemPrompt}\n\n${jsonInstructions}\n\n${options.prompt}`
    : `${jsonInstructions}\n\n${options.prompt}`

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: fullPrompt }]
    }],
    generationConfig: {
      maxOutputTokens: options.maxTokens || 4000,
      temperature: options.temperature ?? 0.3,
      responseMimeType: 'application/json',
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Gemini Flash API Error]', response.status, errorText)
    throw new Error(`Gemini Flash API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  // Parse the JSON response
  let parsed: T
  try {
    let cleanText = text.trim()
    cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1')

    // Try to repair truncated JSON
    // Count braces/brackets
    const openBraces = (cleanText.match(/{/g) || []).length
    const closeBraces = (cleanText.match(/}/g) || []).length
    const openBrackets = (cleanText.match(/\[/g) || []).length
    const closeBrackets = (cleanText.match(/\]/g) || []).length

    // If incomplete, try to close it
    if (openBraces > closeBraces || openBrackets > closeBrackets) {
      console.warn('[Gemini Flash] Truncated response detected, attempting repair')

      // Find the last complete key-value pair by looking for the last closing quote followed by comma or brace
      const lastCompleteMatch = cleanText.match(/.*"[^"]*"\s*:\s*("[^"]*"|[\d.]+|true|false|null|\[[^\]]*\])/)
      if (lastCompleteMatch) {
        // Find this position and truncate there
        const lastGoodIndex = cleanText.lastIndexOf(lastCompleteMatch[0]) + lastCompleteMatch[0].length
        if (lastGoodIndex > cleanText.length / 2) { // Only truncate if we have more than half
          cleanText = cleanText.substring(0, lastGoodIndex)
        }
      }

      // Remove any dangling partial key or value
      cleanText = cleanText.replace(/,?\s*"[^"]*"?\s*:?\s*"?[^"}]*$/g, '')
      // Remove trailing comma
      cleanText = cleanText.replace(/,\s*$/g, '')

      // Add missing closing brackets/braces
      for (let i = 0; i < openBrackets - closeBrackets; i++) cleanText += ']'
      for (let i = 0; i < openBraces - closeBraces; i++) cleanText += '}'
    }

    parsed = JSON.parse(cleanText)
  } catch (parseError) {
    console.error('[Gemini Flash JSON Parse Error]', parseError)
    console.error('[Raw Response]', text.substring(0, 500))

    // For elaboration schema specifically, return a safe fallback
    // This allows the remaining tactics to still be processed
    console.warn('[Gemini Flash] Returning fallback response due to parse error')
    parsed = {
      description: "Unable to generate detailed description",
      deliverable: "To be defined",
      what: "To be defined",
      why: "Requested by client",
      how: "To be defined",
      estimatedHours: 8,
      confidence: 50,
      confidenceReason: "Generated with fallback due to parsing error",
      canBeDivided: false,
      suggestedSubTactics: [],
    } as T
  }

  return {
    object: parsed,
    usage: data.usageMetadata ? {
      inputTokens: data.usageMetadata.promptTokenCount || 0,
      outputTokens: data.usageMetadata.candidatesTokenCount || 0,
    } : undefined,
  }
}

/**
 * Generate structured object using Gemini 3 Pro with JSON mode
 */
export async function generateObjectGemini<T>(options: {
  prompt: string
  systemPrompt?: string
  schema: any
  maxTokens?: number
  temperature?: number
}): Promise<GenerateObjectResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const model = AI_MODELS.GEMINI_3_PRO
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`

  // Build schema description from Zod if available
  let schemaDescription = ''
  if (options.schema && typeof options.schema.describe === 'function') {
    schemaDescription = JSON.stringify(options.schema.shape || options.schema, null, 2)
  } else if (options.schema) {
    schemaDescription = JSON.stringify(options.schema, null, 2)
  }

  const jsonInstructions = `
You must respond with ONLY valid JSON that matches this schema:
${schemaDescription}

CRITICAL: Return ONLY the JSON object, no markdown code blocks, no explanations.
Ensure all strings are properly escaped and no trailing commas are present.
`

  const fullPrompt = options.systemPrompt
    ? `${options.systemPrompt}\n\n${jsonInstructions}\n\n${options.prompt}`
    : `${jsonInstructions}\n\n${options.prompt}`

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: fullPrompt }]
    }],
    generationConfig: {
      maxOutputTokens: options.maxTokens || 8000,
      temperature: options.temperature ?? 0.3,
      responseMimeType: 'application/json',
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Gemini API Error]', response.status, errorText)
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

  // Parse the JSON response
  let parsed: T
  try {
    // Clean up the response if it has markdown code blocks
    let cleanText = text.trim()
    cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    parsed = JSON.parse(cleanText)
  } catch (parseError) {
    console.error('[Gemini JSON Parse Error]', parseError)
    console.error('[Raw Response]', text)
    throw new Error('Failed to parse Gemini response as JSON')
  }

  return {
    object: parsed,
    usage: data.usageMetadata ? {
      inputTokens: data.usageMetadata.promptTokenCount || 0,
      outputTokens: data.usageMetadata.candidatesTokenCount || 0,
    } : undefined,
  }
}

/**
 * Generate text using Claude Opus 4.6 directly
 */
export async function generateTextClaude(options: {
  prompt: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}): Promise<GenerateTextResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const requestBody = {
    model: AI_MODELS.CLAUDE_OPUS_4_6,
    max_tokens: options.maxTokens || 8000,
    temperature: options.temperature ?? 0.7,
    messages: [{
      role: 'user',
      content: options.prompt,
    }],
    ...(options.systemPrompt && { system: options.systemPrompt }),
  }

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Claude API Error]', response.status, errorText)
    throw new Error(`Claude API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()

  const text = data.content?.[0]?.text || ''

  return {
    text,
    usage: data.usage ? {
      inputTokens: data.usage.input_tokens || 0,
      outputTokens: data.usage.output_tokens || 0,
    } : undefined,
  }
}

/**
 * Generate structured object using Claude Opus 4.6
 */
export async function generateObjectClaude<T>(options: {
  prompt: string
  systemPrompt?: string
  schema: any
  maxTokens?: number
  temperature?: number
}): Promise<GenerateObjectResult<T>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  // Build schema description from Zod if available
  let schemaDescription = ''
  if (options.schema && typeof options.schema.describe === 'function') {
    schemaDescription = JSON.stringify(options.schema.shape || options.schema, null, 2)
  } else if (options.schema) {
    schemaDescription = JSON.stringify(options.schema, null, 2)
  }

  const jsonInstructions = `
You must respond with ONLY valid JSON that matches this schema:
${schemaDescription}

CRITICAL: Return ONLY the JSON object, no markdown code blocks, no explanations.
Ensure all strings are properly escaped and no trailing commas are present.
`

  const systemPrompt = options.systemPrompt
    ? `${options.systemPrompt}\n\n${jsonInstructions}`
    : jsonInstructions

  const requestBody = {
    model: AI_MODELS.CLAUDE_OPUS_4_6,
    max_tokens: options.maxTokens || 8000,
    temperature: options.temperature ?? 0.3,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: options.prompt,
    }],
  }

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Claude API Error]', response.status, errorText)
    throw new Error(`Claude API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'

  // Parse the JSON response
  let parsed: T
  try {
    // Clean up the response if it has markdown code blocks
    let cleanText = text.trim()
    cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    parsed = JSON.parse(cleanText)
  } catch (parseError) {
    console.error('[Claude JSON Parse Error]', parseError)
    console.error('[Raw Response]', text)
    throw new Error('Failed to parse Claude response as JSON')
  }

  return {
    object: parsed,
    usage: data.usage ? {
      inputTokens: data.usage.input_tokens || 0,
      outputTokens: data.usage.output_tokens || 0,
    } : undefined,
  }
}

/**
 * Generate image using Gemini Vision model
 */
export async function generateWithImage(options: {
  prompt: string
  imageUrl?: string
  imageBase64?: string
  imageMimeType?: string
  maxTokens?: number
  temperature?: number
}): Promise<GenerateTextResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const model = AI_MODELS.GEMINI_3_PRO_VISION
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`

  const parts: any[] = [{ text: options.prompt }]

  // Add image if provided
  if (options.imageBase64 && options.imageMimeType) {
    parts.push({
      inline_data: {
        mime_type: options.imageMimeType,
        data: options.imageBase64,
      }
    })
  } else if (options.imageUrl) {
    // Fetch the image and convert to base64
    const imageResponse = await fetch(options.imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64 = Buffer.from(imageBuffer).toString('base64')
    const mimeType = imageResponse.headers.get('content-type') || 'image/png'

    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64,
      }
    })
  }

  const requestBody = {
    contents: [{
      role: 'user',
      parts,
    }],
    generationConfig: {
      maxOutputTokens: options.maxTokens || 8000,
      temperature: options.temperature ?? 0.7,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Gemini Vision API Error]', response.status, errorText)
    throw new Error(`Gemini Vision API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return {
    text,
    usage: data.usageMetadata ? {
      inputTokens: data.usageMetadata.promptTokenCount || 0,
      outputTokens: data.usageMetadata.candidatesTokenCount || 0,
    } : undefined,
  }
}

// Re-export for convenience with AI SDK compatibility
export { generateTextGemini as generateText }
export { generateObjectGemini as generateObject }
