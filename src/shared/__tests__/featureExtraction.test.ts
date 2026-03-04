import { describe, it, expect } from 'vitest'
import { extractFeaturesV2FromPixels, FEATURE_DIM_V2, GRID_V2 } from '../featureExtraction'

function makeGradientImage(): Uint8Array {
  const rgb = new Uint8Array(GRID_V2 * GRID_V2 * 3)
  for (let y = 0; y < GRID_V2; y++) {
    for (let x = 0; x < GRID_V2; x++) {
      const i = (y * GRID_V2 + x) * 3
      rgb[i] = Math.floor((x / GRID_V2) * 255)
      rgb[i + 1] = Math.floor((y / GRID_V2) * 255)
      rgb[i + 2] = 128
    }
  }
  return rgb
}

function makeSolidImage(r: number, g: number, b: number): Uint8Array {
  const rgb = new Uint8Array(GRID_V2 * GRID_V2 * 3)
  for (let i = 0; i < GRID_V2 * GRID_V2; i++) {
    rgb[i * 3] = r
    rgb[i * 3 + 1] = g
    rgb[i * 3 + 2] = b
  }
  return rgb
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

describe('featureExtraction V2', () => {
  it('produces exactly 768 dimensions', () => {
    const vec = extractFeaturesV2FromPixels(makeGradientImage())
    expect(vec.length).toBe(FEATURE_DIM_V2)
    expect(vec.length).toBe(768)
  })

  it('produces L2-normalized vectors', () => {
    const vec = extractFeaturesV2FromPixels(makeGradientImage())
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
    expect(norm).toBeCloseTo(1.0, 4)
  })

  it('is deterministic (same input → same output)', () => {
    const img = makeGradientImage()
    const v1 = extractFeaturesV2FromPixels(img)
    const v2 = extractFeaturesV2FromPixels(img)
    expect(v1).toEqual(v2)
  })

  it('same image has similarity 1.0', () => {
    const v = extractFeaturesV2FromPixels(makeGradientImage())
    expect(cosineSim(v, v)).toBeCloseTo(1.0, 6)
  })

  it('different solid colors have < 0.95 similarity', () => {
    const red = extractFeaturesV2FromPixels(makeSolidImage(200, 50, 50))
    const blue = extractFeaturesV2FromPixels(makeSolidImage(50, 50, 200))
    const sim = cosineSim(red, blue)
    expect(sim).toBeLessThan(0.95)
  })

  it('similar colors have higher similarity than different colors', () => {
    const red1 = extractFeaturesV2FromPixels(makeSolidImage(200, 50, 50))
    const red2 = extractFeaturesV2FromPixels(makeSolidImage(180, 60, 40))
    const blue = extractFeaturesV2FromPixels(makeSolidImage(50, 50, 200))
    const simSame = cosineSim(red1, red2)
    const simDiff = cosineSim(red1, blue)
    expect(simSame).toBeGreaterThan(simDiff)
  })

  it('rejects wrong-size input', () => {
    expect(() => extractFeaturesV2FromPixels(new Uint8Array(100))).toThrow('Expected')
  })
})
