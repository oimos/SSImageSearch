import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { normalizeOcrText, buildUserPrompt } from '../ocrNormalizer'
import type { OcrNormalizedResult, OcrDebugPayload } from '@shared/types'
import { ocrFixtures } from './fixtures/ocrSamples'

beforeAll(() => {
  process.env.LLM_MODE = 'mock'
})

afterAll(() => {
  delete process.env.LLM_MODE
})

function isDebugPayload(v: unknown): v is OcrDebugPayload {
  return typeof v === 'object' && v !== null && 'rawOcrText' in v && 'parsed' in v
}

describe('normalizeOcrText (mock mode)', () => {
  for (const fixture of ocrFixtures) {
    it(fixture.name, async () => {
      const result = await normalizeOcrText(fixture.input)
      const r = result as OcrNormalizedResult

      expect(r.brand).toBe(fixture.expected.brand)

      if (fixture.expected.size !== null) {
        expect(r.size).toBe(fixture.expected.size)
      }

      if (fixture.expected.material !== null) {
        expect(r.material).not.toBeNull()
        for (const mat of fixture.expected.material) {
          expect(r.material).toContain(mat)
        }
      } else {
        expect(r.material).toBeNull()
      }

      expect(r.model).toBe(fixture.expected.model)

      if (fixture.expected.hasOtherText) {
        expect(r.other_text.length).toBeGreaterThan(0)
      }

      expect(r.confidence).toBeGreaterThanOrEqual(fixture.expected.minConfidence)
      expect(r.confidence).toBeGreaterThanOrEqual(0)
      expect(r.confidence).toBeLessThanOrEqual(1)
    })
  }
})

describe('debug mode', () => {
  it('returns OcrDebugPayload when debug=true', async () => {
    const result = await normalizeOcrText('SUPREME\nM\nCOTTON', { debug: true })

    expect(isDebugPayload(result)).toBe(true)
    if (!isDebugPayload(result)) return

    expect(result.rawOcrText).toBe('SUPREME\nM\nCOTTON')
    expect(result.prompt).toContain('SUPREME')
    expect(result.rawResponse).toBeTruthy()
    expect(result.parsed.brand).toBe('SUPREME')
  })

  it('returns OcrNormalizedResult when debug=false', async () => {
    const result = await normalizeOcrText('GUCCI\nS', { debug: false })

    expect(isDebugPayload(result)).toBe(false)
    const r = result as OcrNormalizedResult
    expect(r.brand).toBe('GUCCI')
  })
})

describe('buildUserPrompt', () => {
  it('wraps raw text with triple quotes', () => {
    const prompt = buildUserPrompt('HELLO\nWORLD')
    expect(prompt).toContain('"""')
    expect(prompt).toContain('HELLO\nWORLD')
  })
})

describe('JSON guard', () => {
  it('returns valid schema even for garbage input', async () => {
    const result = (await normalizeOcrText('!!!@@@###$$$')) as OcrNormalizedResult

    expect(result).toHaveProperty('brand')
    expect(result).toHaveProperty('size')
    expect(result).toHaveProperty('material')
    expect(result).toHaveProperty('model')
    expect(result).toHaveProperty('other_text')
    expect(result).toHaveProperty('confidence')
    expect(Array.isArray(result.other_text)).toBe(true)
    expect(typeof result.confidence).toBe('number')
  })
})

describe('llmClient mock', () => {
  it('corrects COTON to COTTON', async () => {
    const result = (await normalizeOcrText('COTON')) as OcrNormalizedResult
    expect(result.material).toContain('COTTON')
  })

  it('normalizes spaced size "X L" to "XL"', async () => {
    const result = (await normalizeOcrText('X L')) as OcrNormalizedResult
    expect(result.size).toBe('XL')
  })
})
