import sharp from 'sharp'
import { extractFeaturesV2FromPixels, GRID_V2, FEATURE_DIM_V2 } from '@shared/featureExtraction'

// ---------------------------------------------------------------------------
// V1 — legacy 512-dim pixel grid (kept for backward compat during migration)
// ---------------------------------------------------------------------------

const GRID_V1 = 13
const VECTOR_DIM_V1 = 512

function normalizeVec(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  if (norm === 0) return vec
  return vec.map((x) => x / norm)
}

export async function extractPixelFeaturesFromFile(filePath: string): Promise<number[]> {
  const { data } = await sharp(filePath)
    .resize(GRID_V1, GRID_V1, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const features: number[] = []
  let sumR = 0,
    sumG = 0,
    sumB = 0
  const n = GRID_V1 * GRID_V1

  for (let i = 0; i < n; i++) {
    const r = data[i * 3] / 128 - 1
    const g = data[i * 3 + 1] / 128 - 1
    const b = data[i * 3 + 2] / 128 - 1
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

  if (features.length !== VECTOR_DIM_V1) {
    throw new Error(`Vector dim mismatch: expected ${VECTOR_DIM_V1}, got ${features.length}`)
  }

  return normalizeVec(features)
}

// ---------------------------------------------------------------------------
// V2 — 768-dim multi-feature embedding (color + HSV + HOG + edge + LBP)
// ---------------------------------------------------------------------------

export { FEATURE_DIM_V2 }

export async function extractFeaturesV2FromFile(filePath: string): Promise<number[]> {
  const { data } = await sharp(filePath)
    .resize(GRID_V2, GRID_V2, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return extractFeaturesV2FromPixels(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
}

export async function extractFeaturesV2FromBuffer(buffer: Buffer): Promise<number[]> {
  const { data } = await sharp(buffer)
    .resize(GRID_V2, GRID_V2, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return extractFeaturesV2FromPixels(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
}
