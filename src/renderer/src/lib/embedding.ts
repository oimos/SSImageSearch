import {
  extractFeaturesV2FromPixels,
  GRID_V2,
  FEATURE_DIM_V2
} from '@shared/featureExtraction'

// ---------------------------------------------------------------------------
// V1 — legacy 512-dim (kept during migration; remove once all vectors are v2)
// ---------------------------------------------------------------------------

const VECTOR_DIM_V1 = 512
const GRID_V1 = 13

function normalizeVec(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  if (norm === 0) return vec
  return vec.map((x) => x / norm)
}

async function extractPixelFeaturesV1(imageData: ArrayBuffer): Promise<number[]> {
  const blob = new Blob([imageData])
  const bitmap = await createImageBitmap(blob)

  const canvas = new OffscreenCanvas(GRID_V1, GRID_V1)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, GRID_V1, GRID_V1)
  bitmap.close()

  const { data } = ctx.getImageData(0, 0, GRID_V1, GRID_V1)
  const features: number[] = []
  let sumR = 0,
    sumG = 0,
    sumB = 0
  const n = GRID_V1 * GRID_V1

  for (let i = 0; i < n; i++) {
    const r = data[i * 4] / 128 - 1
    const g = data[i * 4 + 1] / 128 - 1
    const b = data[i * 4 + 2] / 128 - 1
    features.push(r, g, b)
    sumR += r
    sumG += g
    sumB += b
  }

  const meanR = sumR / n,
    meanG = sumG / n,
    meanB = sumB / n
  features.push(meanR, meanG, meanB)

  let varR = 0,
    varG = 0
  for (let i = 0; i < n; i++) {
    varR += (features[i * 3] - meanR) ** 2
    varG += (features[i * 3 + 1] - meanG) ** 2
  }
  features.push(Math.sqrt(varR / n), Math.sqrt(varG / n))

  return normalizeVec(features)
}

// ---------------------------------------------------------------------------
// V2 — 768-dim multi-feature embedding via OffscreenCanvas
// ---------------------------------------------------------------------------

export { FEATURE_DIM_V2 }

async function extractPixelFeaturesV2(imageData: ArrayBuffer): Promise<number[]> {
  const blob = new Blob([imageData])
  const bitmap = await createImageBitmap(blob)

  const canvas = new OffscreenCanvas(GRID_V2, GRID_V2)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, GRID_V2, GRID_V2)
  bitmap.close()

  const imgData = ctx.getImageData(0, 0, GRID_V2, GRID_V2)

  // Convert RGBA → RGB (strip alpha channel)
  const rgb = new Uint8Array(GRID_V2 * GRID_V2 * 3)
  for (let i = 0; i < GRID_V2 * GRID_V2; i++) {
    rgb[i * 3] = imgData.data[i * 4]
    rgb[i * 3 + 1] = imgData.data[i * 4 + 1]
    rgb[i * 3 + 2] = imgData.data[i * 4 + 2]
  }

  return extractFeaturesV2FromPixels(rgb)
}

// ---------------------------------------------------------------------------
// Hash-based fallback (environments without Canvas)
// ---------------------------------------------------------------------------

function hashFallback(imageData: ArrayBuffer, dim: number): number[] {
  const bytes = new Uint8Array(imageData)
  let hash = 5381
  for (let i = 0; i < Math.min(bytes.length, 20000); i++) {
    hash = ((hash << 5) + hash + bytes[i]) | 0
  }
  let s = hash | 0
  const rng = (): number => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 0xffffffff
  }
  const vec = Array.from({ length: dim }, () => rng() * 2 - 1)
  return normalizeVec(vec)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateMockEmbedding(imageData: ArrayBuffer): Promise<number[]> {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return await extractPixelFeaturesV2(imageData)
    } catch {
      /* fallback below */
    }
  }
  return hashFallback(imageData, FEATURE_DIM_V2)
}

export async function generateEmbedding(imageData: ArrayBuffer): Promise<number[]> {
  return generateMockEmbedding(imageData)
}

/** @deprecated Use generateEmbedding (V2) for new vectors */
export async function generateEmbeddingV1(imageData: ArrayBuffer): Promise<number[]> {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return await extractPixelFeaturesV1(imageData)
    } catch {
      /* fallback below */
    }
  }
  return hashFallback(imageData, VECTOR_DIM_V1)
}

export function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
