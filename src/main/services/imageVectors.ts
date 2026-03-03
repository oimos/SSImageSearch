import sharp from 'sharp'

const GRID = 13
const VECTOR_DIM = 512

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  if (norm === 0) return vec
  return vec.map((x) => x / norm)
}

/**
 * Extract a 512-dim pixel feature vector from an image file using sharp.
 * Exactly mirrors the renderer's extractPixelFeatures (OffscreenCanvas)
 * so that cosine similarity between seed vectors and uploaded-image vectors
 * is meaningful.
 *
 * Layout: [0..506] 13x13 grid x 3 RGB channels, [507..509] mean RGB,
 *         [510] std R, [511] std G
 */
export async function extractPixelFeaturesFromFile(filePath: string): Promise<number[]> {
  const { data } = await sharp(filePath)
    .resize(GRID, GRID, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const features: number[] = []
  let sumR = 0,
    sumG = 0,
    sumB = 0
  const n = GRID * GRID

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

  if (features.length !== VECTOR_DIM) {
    throw new Error(`Vector dim mismatch: expected ${VECTOR_DIM}, got ${features.length}`)
  }

  return normalize(features)
}
