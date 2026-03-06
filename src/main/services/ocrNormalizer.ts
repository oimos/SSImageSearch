import type { OcrNormalizedResult, OcrNormalizeOptions, OcrDebugPayload } from '@shared/types'
import { callLlm, callVision, isDebugLlm } from './llmClient'

const VISION_SYSTEM_PROMPT = `You are an AI assistant that analyzes images of second-hand apparel products.
Look at the image and extract the following information into JSON.

Rules:
- Identify the brand from logos, tags, or text visible in the image.
- Determine the product category (e.g. シャツ, トップス, ジャケット, コート, ワンピース, スカート, シューズ).
- Extract size, color, and material if visible.
- If a field cannot be determined, set it to null.
- "material" is always an array of strings, or null if absent.
- "confidence" is 0.0–1.0: high when information is clear, low when guessing.

Output ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "brand": string | null,
  "size": string | null,
  "material": string[] | null,
  "model": string | null,
  "category": string | null,
  "other_text": string[],
  "confidence": number
}`

const SYSTEM_PROMPT = `You are a structured data extractor for second-hand apparel product tags.
Given raw OCR text from a clothing/accessory tag, extract and normalize the following fields into JSON.

Rules:
- Fix obvious OCR typos (e.g. "COTON" → "COTTON", "CUCCI" → "GUCCI").
- Do NOT invent or guess information that is not present in the text.
- If a field cannot be determined, set it to null.
- "material" is always an array of strings, or null if absent.
- "other_text" collects any remaining text lines that don't fit other fields.
- "confidence" is 0.0–1.0: high when OCR text is clear, low when ambiguous, below 0.5 if guessing.

Output ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "brand": string | null,
  "size": string | null,
  "material": string[] | null,
  "model": string | null,
  "other_text": string[],
  "confidence": number
}`

export function buildUserPrompt(rawOcrText: string): string {
  return `OCR text:\n"""\n${rawOcrText}\n"""`
}

const EMPTY_RESULT: OcrNormalizedResult = {
  brand: null,
  size: null,
  material: null,
  model: null,
  other_text: [],
  confidence: 0
}

function validateAndCoerce(raw: unknown): OcrNormalizedResult {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('LLM output is not a JSON object')
  }

  const obj = raw as Record<string, unknown>

  const brand = typeof obj.brand === 'string' ? obj.brand : null
  const size = typeof obj.size === 'string' ? obj.size : null
  const model = typeof obj.model === 'string' ? obj.model : null

  let material: string[] | null = null
  if (Array.isArray(obj.material)) {
    material = obj.material.filter((m): m is string => typeof m === 'string')
    if (material.length === 0) material = null
  }

  let otherText: string[] = []
  if (Array.isArray(obj.other_text)) {
    otherText = obj.other_text.filter((t): t is string => typeof t === 'string')
  }

  let confidence = typeof obj.confidence === 'number' ? obj.confidence : 0
  confidence = Math.max(0, Math.min(1, confidence))

  return { brand, size, material, model, other_text: otherText, confidence }
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim()

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : trimmed

  return JSON.parse(jsonStr)
}

export async function normalizeOcrText(
  rawOcrText: string,
  options?: OcrNormalizeOptions
): Promise<OcrNormalizedResult | OcrDebugPayload> {
  const debug = options?.debug ?? isDebugLlm()

  if (!rawOcrText.trim()) {
    if (debug) {
      return { rawOcrText, prompt: '', rawResponse: '', parsed: { ...EMPTY_RESULT } }
    }
    return { ...EMPTY_RESULT }
  }

  const userPrompt = buildUserPrompt(rawOcrText)

  let rawResponse = ''
  let parsed: OcrNormalizedResult

  try {
    const llmRes = await callLlm({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0,
      maxTokens: 512
    })

    rawResponse = llmRes.content

    const jsonObj = extractJson(rawResponse)
    parsed = validateAndCoerce(jsonObj)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ocrNormalizer] Failed to normalize OCR text:', message)

    parsed = { ...EMPTY_RESULT, other_text: [rawOcrText], confidence: 0 }

    if (debug) {
      return { rawOcrText, prompt: userPrompt, rawResponse, parsed }
    }
    return parsed
  }

  if (debug) {
    const payload: OcrDebugPayload = {
      rawOcrText,
      prompt: userPrompt,
      rawResponse,
      parsed
    }
    console.log('[ocrNormalizer:debug]', JSON.stringify(payload, null, 2))
    return payload
  }

  return parsed
}

export interface ImageAnalysisResult {
  brand: string | null
  category: string | null
  size: string | null
  material: string[] | null
  model: string | null
  other_text: string[]
  confidence: number
}

const EMPTY_ANALYSIS: ImageAnalysisResult = {
  brand: null,
  category: null,
  size: null,
  material: null,
  model: null,
  other_text: [],
  confidence: 0
}

export async function extractInfoFromImage(imageBase64: string): Promise<ImageAnalysisResult> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[extractInfoFromImage] OPENAI_API_KEY not set, skipping vision analysis')
    return { ...EMPTY_ANALYSIS }
  }

  try {
    const res = await callVision({
      systemPrompt: VISION_SYSTEM_PROMPT,
      imageBase64,
      userPrompt: 'この画像に写っているアパレル商品の情報を抽出してください。',
      temperature: 0,
      maxTokens: 512
    })

    const jsonObj = extractJson(res.content)
    const validated = validateAndCoerce(jsonObj)

    const obj = jsonObj as Record<string, unknown>
    const category = typeof obj.category === 'string' ? obj.category : null

    return {
      brand: validated.brand,
      category,
      size: validated.size,
      material: validated.material,
      model: validated.model,
      other_text: validated.other_text,
      confidence: validated.confidence
    }
  } catch (err) {
    console.error(
      '[extractInfoFromImage] Vision analysis failed:',
      err instanceof Error ? err.message : err
    )
    return { ...EMPTY_ANALYSIS }
  }
}
