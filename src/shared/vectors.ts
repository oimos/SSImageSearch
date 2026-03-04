export const VECTOR_DIM = 512
export { FEATURE_DIM_V2 } from './featureExtraction'

/**
 * V1 feature layout (legacy — 13×13 pixel grid):
 *   [0..506]  13×13 pixel grid, 3 channels each (R, G, B normalized to [-1,1])
 *   [507]     mean R
 *   [508]     mean G
 *   [509]     mean B
 *   [510]     std R  (contrast)
 *   [511]     std G  (contrast)
 *
 * V2 feature layout (768-dim) — see src/shared/featureExtraction.ts
 */

const GRID = 13

export function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 0xffffffff
  }
}

export function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return hash
}

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  if (norm === 0) return vec
  return vec.map((x) => x / norm)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16)
  }
}

/**
 * Category hue biases — shifts the synthetic pixel features so that
 * products in the same category cluster closer together.
 */
const CATEGORY_HUE: Record<string, { r: number; g: number; b: number }> = {
  'シャツ': { r: -10, g: -5, b: 10 },
  'トップス': { r: 5, g: -10, b: -5 },
  'ジャケット': { r: -5, g: 10, b: -10 },
  'コート': { r: 10, g: 5, b: -5 },
  'ワンピース': { r: -5, g: -5, b: 5 },
  'スカート': { r: 8, g: -8, b: 3 },
  'シューズ': { r: -8, g: 3, b: -8 }
}

/**
 * Generate a seed-data vector that lives in the same 512-dim pixel-feature
 * space as the renderer's Canvas-extracted embeddings.
 *
 * Simulates what a 13×13 resized placeholder SVG would look like:
 * mostly a solid brand colour with slight per-cell variation and
 * a few lighter cells to simulate the text overlay.
 */
export function generateProductVector(
  category: string,
  brand: string,
  brandColorHex: string,
  productSeed: number
): number[] {
  const base = hexToRgb(brandColorHex)
  const hue = CATEGORY_HUE[category] || { r: 0, g: 0, b: 0 }

  const rng = seededRandom(productSeed)
  const brandRng = seededRandom(hashString(brand))

  const features: number[] = []
  let sumR = 0, sumG = 0, sumB = 0
  const n = GRID * GRID

  for (let i = 0; i < n; i++) {
    const isText = rng() < 0.15
    const tr = isText ? 200 : 0
    const tg = isText ? 200 : 0
    const tb = isText ? 200 : 0

    const pr = Math.max(0, Math.min(255,
      base.r + hue.r + tr + (brandRng() * 2 - 1) * 20 + (rng() * 2 - 1) * 8))
    const pg = Math.max(0, Math.min(255,
      base.g + hue.g + tg + (brandRng() * 2 - 1) * 20 + (rng() * 2 - 1) * 8))
    const pb = Math.max(0, Math.min(255,
      base.b + hue.b + tb + (brandRng() * 2 - 1) * 20 + (rng() * 2 - 1) * 8))

    const r = pr / 128 - 1
    const g = pg / 128 - 1
    const b = pb / 128 - 1

    features.push(r, g, b)
    sumR += r; sumG += g; sumB += b
  }

  const meanR = sumR / n, meanG = sumG / n, meanB = sumB / n
  features.push(meanR, meanG, meanB)

  let varR = 0, varG = 0
  for (let i = 0; i < n; i++) {
    varR += (features[i * 3] - meanR) ** 2
    varG += (features[i * 3 + 1] - meanG) ** 2
  }
  features.push(Math.sqrt(varR / n), Math.sqrt(varG / n))

  return normalize(features)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function vectorToBuffer(vec: number[]): Buffer {
  const float32 = new Float32Array(vec)
  return Buffer.from(float32.buffer)
}

export function bufferToVector(buf: Buffer): number[] {
  const float32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
  return Array.from(float32)
}
