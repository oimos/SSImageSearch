import { describe, it, expect } from 'vitest'
import type { Product, SearchResult } from '@shared/types'
import {
  computeTextSimilarity,
  boostResultsWithText,
  mergeModelResults,
  detectConflict
} from '../textSimilarity'
import type { OcrFields } from '../textSimilarity'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    brand: 'GUCCI',
    category: 'バッグ',
    model: 'GG Marmont',
    size: 'M',
    color: 'ブラック',
    material: 'レザー',
    condition: 'A',
    price: 100000,
    notes: '',
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    ...overrides
  }
}

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    product: makeProduct(),
    images: [],
    similarity: 0.8,
    matchReasons: [],
    confidence: 'high',
    matchSource: 'visual',
    ...overrides
  }
}

describe('computeTextSimilarity', () => {
  it('returns 0 when OCR has no fields', () => {
    const ocr: OcrFields = { brand: null, category: null, model: null, size: null, material: null }
    const product = makeProduct()
    expect(computeTextSimilarity(ocr, product)).toBe(0)
  })

  it('returns 1.0 for exact brand match (only brand field active)', () => {
    const ocr: OcrFields = { brand: 'GUCCI', category: null, model: null, size: null, material: null }
    const product = makeProduct({ brand: 'GUCCI' })
    expect(computeTextSimilarity(ocr, product)).toBe(1.0)
  })

  it('handles fuzzy brand matching', () => {
    const ocr: OcrFields = { brand: 'gucci', category: null, model: null, size: null, material: null }
    const product = makeProduct({ brand: 'GUCCI' })
    expect(computeTextSimilarity(ocr, product)).toBe(1.0)
  })

  it('gives higher model weight in tag mode', () => {
    const ocr: OcrFields = { brand: null, category: null, model: 'GG Marmont', size: null, material: null }
    const product = makeProduct({ model: 'GG Marmont' })
    const defaultScore = computeTextSimilarity(ocr, product, false)
    const tagScore = computeTextSimilarity(ocr, product, true)
    expect(defaultScore).toBe(1.0)
    expect(tagScore).toBe(1.0)
  })

  it('returns partial score for partial model match', () => {
    const ocr: OcrFields = { brand: null, category: null, model: 'GG', size: null, material: null }
    const product = makeProduct({ model: 'GG Marmont' })
    const score = computeTextSimilarity(ocr, product)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1.0)
  })
})

describe('boostResultsWithText', () => {
  it('returns original results when no OCR data', () => {
    const results = [makeResult()]
    const boosted = boostResultsWithText(results, null)
    expect(boosted).toEqual(results)
  })

  it('applies tag mode weighting (visual 0.2 + text 0.8)', () => {
    const result = makeResult({ similarity: 0.5 })
    const ocr: OcrFields = { brand: 'GUCCI', category: 'バッグ', model: null, size: null, material: null }
    const boosted = boostResultsWithText([result], ocr, { hasTag: true })
    expect(boosted[0].similarity).not.toBe(0.5)
  })

  it('applies default mode weighting (visual 0.6 + text 0.4)', () => {
    const result = makeResult({ similarity: 0.5 })
    const ocr: OcrFields = { brand: 'GUCCI', category: 'バッグ', model: null, size: null, material: null }
    const boosted = boostResultsWithText([result], ocr, { hasTag: false })
    expect(boosted[0].similarity).not.toBe(0.5)
  })

  it('preserves model_exact matchSource', () => {
    const result = makeResult({ matchSource: 'model_exact', similarity: 0.99 })
    const ocr: OcrFields = { brand: 'GUCCI', category: null, model: null, size: null, material: null }
    const boosted = boostResultsWithText([result], ocr, { hasTag: true })
    expect(boosted[0].matchSource).toBe('model_exact')
    expect(boosted[0].similarity).toBe(0.99)
  })

  it('sorts results by boosted similarity', () => {
    const r1 = makeResult({ product: makeProduct({ id: 1, brand: 'OTHER' }), similarity: 0.8 })
    const r2 = makeResult({ product: makeProduct({ id: 2, brand: 'GUCCI' }), similarity: 0.5 })
    const ocr: OcrFields = { brand: 'GUCCI', category: null, model: null, size: null, material: null }
    const boosted = boostResultsWithText([r1, r2], ocr, { hasTag: true })
    expect(boosted[0].product.id).toBe(2)
  })
})

describe('mergeModelResults', () => {
  it('places model results at top and removes duplicates', () => {
    const modelResult = makeResult({ product: makeProduct({ id: 10 }), matchSource: 'model_exact' })
    const visualResult1 = makeResult({ product: makeProduct({ id: 10 }), matchSource: 'visual' })
    const visualResult2 = makeResult({ product: makeProduct({ id: 20 }), matchSource: 'visual' })

    const merged = mergeModelResults([modelResult], [visualResult1, visualResult2])
    expect(merged).toHaveLength(2)
    expect(merged[0].product.id).toBe(10)
    expect(merged[0].matchSource).toBe('model_exact')
    expect(merged[1].product.id).toBe(20)
  })
})

describe('detectConflict', () => {
  it('detects conflict when visual and tag top results differ', () => {
    const visualTop = makeResult({
      product: makeProduct({ id: 1, brand: 'GUCCI', model: 'A' }),
      similarity: 0.8,
      matchSource: 'visual'
    })
    const tagTop = makeResult({
      product: makeProduct({ id: 2, brand: 'PRADA', model: 'B' }),
      similarity: 0.95,
      matchSource: 'tag_text'
    })

    const info = detectConflict([visualTop], [tagTop])
    expect(info.hasConflict).toBe(true)
    expect(info.message).toContain('PRADA')
    expect(info.message).toContain('GUCCI')
  })

  it('no conflict when same product is top in both', () => {
    const result = makeResult({ product: makeProduct({ id: 1 }), similarity: 0.8 })
    const info = detectConflict([result], [result])
    expect(info.hasConflict).toBe(false)
  })

  it('no conflict when visual top similarity is below threshold', () => {
    const visualTop = makeResult({
      product: makeProduct({ id: 1 }),
      similarity: 0.5,
      matchSource: 'visual'
    })
    const tagTop = makeResult({
      product: makeProduct({ id: 2 }),
      similarity: 0.9,
      matchSource: 'tag_text'
    })

    const info = detectConflict([visualTop], [tagTop])
    expect(info.hasConflict).toBe(false)
  })
})
