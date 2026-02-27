const VECTOR_DIM = 512
const GRID = 13 // 13×13 pixels → 169 cells × 3 channels + 5 stats = 512

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  if (norm === 0) return vec
  return vec.map((x) => x / norm)
}

/**
 * Extract a 512-dim feature vector from actual pixel content.
 * Resizes image to 13×13 via Canvas, then encodes per-cell RGB
 * plus global color statistics.
 *
 * Result: similar-looking images produce similar vectors regardless
 * of file format, compression, or minor perspective changes.
 */
async function extractPixelFeatures(imageData: ArrayBuffer): Promise<number[]> {
  const blob = new Blob([imageData])
  const bitmap = await createImageBitmap(blob)

  const canvas = new OffscreenCanvas(GRID, GRID)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, GRID, GRID)
  bitmap.close()

  const { data } = ctx.getImageData(0, 0, GRID, GRID)
  const features: number[] = []
  let sumR = 0, sumG = 0, sumB = 0
  const n = GRID * GRID

  for (let i = 0; i < n; i++) {
    const r = data[i * 4] / 128 - 1
    const g = data[i * 4 + 1] / 128 - 1
    const b = data[i * 4 + 2] / 128 - 1
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

/**
 * Hash-based fallback for environments without Canvas (e.g. Node.js tests).
 * Deterministic but NOT content-aware — only used as last resort.
 */
function hashFallback(imageData: ArrayBuffer): number[] {
  const bytes = new Uint8Array(imageData)
  let hash = 5381
  for (let i = 0; i < Math.min(bytes.length, 20000); i++) {
    hash = ((hash << 5) + hash + bytes[i]) | 0
  }

  let s = hash | 0
  const rng = (): number => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 0xffffffff }
  const vec = Array.from({ length: VECTOR_DIM }, () => rng() * 2 - 1)
  return normalize(vec)
}

export async function generateMockEmbedding(imageData: ArrayBuffer): Promise<number[]> {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return await extractPixelFeatures(imageData)
    } catch { /* fallback below */ }
  }
  return hashFallback(imageData)
}

export async function generateEmbedding(imageData: ArrayBuffer): Promise<number[]> {
  return generateMockEmbedding(imageData)
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
