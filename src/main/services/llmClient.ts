import OpenAI from 'openai'
import type { LlmMode } from '@shared/types'

const MODEL_MAP: Record<LlmMode, string> = {
  cheap: 'gpt-4.1-nano',
  premium: 'gpt-4.1-mini'
}

export interface LlmRequest {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
}

export interface LlmResponse {
  content: string
  model: string
  usage?: { promptTokens: number; completionTokens: number }
}

let clientInstance: OpenAI | null = null

function getClient(): OpenAI {
  if (!clientInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not set. Set the environment variable or use LLM_MODE=mock for offline testing.'
      )
    }
    clientInstance = new OpenAI({ apiKey })
  }
  return clientInstance
}

export function resolveLlmMode(): LlmMode | 'mock' {
  const env = (process.env.LLM_MODE ?? 'cheap').toLowerCase()
  if (env === 'mock' || env === 'cheap' || env === 'premium') return env as LlmMode | 'mock'
  return 'cheap'
}

export function isDebugLlm(): boolean {
  return process.env.DEBUG_LLM === 'true'
}

export async function callLlm(request: LlmRequest): Promise<LlmResponse> {
  const mode = resolveLlmMode()

  if (mode === 'mock') {
    return callMockLlm(request)
  }

  const model = MODEL_MAP[mode]
  const client = getClient()

  const completion = await client.chat.completions.create({
    model,
    temperature: request.temperature ?? 0,
    max_tokens: request.maxTokens ?? 512,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt }
    ]
  })

  const choice = completion.choices[0]
  return {
    content: choice?.message?.content ?? '',
    model: completion.model,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens
        }
      : undefined
  }
}

export interface VisionRequest {
  systemPrompt: string
  imageBase64: string
  userPrompt?: string
  temperature?: number
  maxTokens?: number
}

export async function callVision(request: VisionRequest): Promise<LlmResponse> {
  const mode = resolveLlmMode()

  if (mode === 'mock') {
    return callMockLlm({ systemPrompt: request.systemPrompt, userPrompt: request.userPrompt ?? '' })
  }

  const client = getClient()

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: 'image_url',
      image_url: { url: request.imageBase64 }
    }
  ]
  if (request.userPrompt) {
    userContent.push({ type: 'text', text: request.userPrompt })
  }

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: request.temperature ?? 0,
    max_tokens: request.maxTokens ?? 512,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: userContent as never }
    ]
  })

  const choice = completion.choices[0]
  return {
    content: choice?.message?.content ?? '',
    model: completion.model,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens
        }
      : undefined
  }
}

/**
 * Deterministic mock for offline / testing.
 * Parses the OCR text with simple heuristics so tests can run without an API key.
 */
export function callMockLlm(request: LlmRequest): LlmResponse {
  const text = request.userPrompt

  const knownBrands = [
    'SUPREME',
    'GUCCI',
    'LOUIS VUITTON',
    'CHANEL',
    'PRADA',
    'HERMES',
    'BURBERRY',
    'NIKE',
    'ADIDAS',
    'BALENCIAGA'
  ]
  const sizePatterns =
    /\b(XXS|XS|S|M|L|XL|XXL|XXXL|X\s*S|X\s*L|XX\s*L|FREE|ONE SIZE|\d{1,3})\b/i
  const materialPatterns =
    /\b(COTTON|COTON|POLYESTER|NYLON|SILK|WOOL|LEATHER|LINEN|CASHMERE|RAYON|ACRYLIC)\b/gi

  let brand: string | null = null
  const upper = text.toUpperCase()
  for (const b of knownBrands) {
    if (upper.includes(b)) {
      brand = b
      break
    }
  }

  const sizeMatch = text.match(sizePatterns)
  let size: string | null = sizeMatch ? sizeMatch[1].replace(/\s+/g, '') : null
  if (size === 'XL' || (sizeMatch && sizeMatch[1].replace(/\s+/g, '') === 'XL')) size = 'XL'

  const materialMatches = text.match(materialPatterns)
  const materials = materialMatches
    ? [...new Set(materialMatches.map((m) => correctMaterial(m.toUpperCase())))]
    : null

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const otherText = lines.filter((line) => {
    const up = line.toUpperCase()
    if (brand && up.includes(brand)) return false
    if (sizeMatch && up.includes(sizeMatch[0])) return false
    if (materialMatches?.some((m) => up.includes(m.toUpperCase()))) return false
    return true
  })

  const confidence = brand ? (materials ? 0.85 : 0.7) : 0.4

  const result = {
    brand,
    size,
    material: materials,
    model: null as string | null,
    other_text: otherText,
    confidence
  }

  return {
    content: JSON.stringify(result),
    model: 'mock',
    usage: { promptTokens: 0, completionTokens: 0 }
  }
}

function correctMaterial(raw: string): string {
  const corrections: Record<string, string> = {
    COTON: 'COTTON'
  }
  return corrections[raw] ?? raw
}
