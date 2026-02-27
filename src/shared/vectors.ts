export const VECTOR_DIM = 512

const CATEGORY_LIST = ['バッグ', 'ジャケット', 'シューズ', 'アクセサリー', '財布']

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

function getSharedBase(): number[] {
  const rng = seededRandom(42)
  return Array.from({ length: VECTOR_DIM }, () => rng() * 2 - 1)
}

/**
 * Centroids share a weak base so cross-category similarity ≈ 25–35%.
 * Category variation is 1.5× the base to create clear separation.
 */
export function getCategoryCentroid(categoryIndex: number): number[] {
  const base = getSharedBase()
  const catRng = seededRandom(10007 + categoryIndex * 7919)
  const vec = base.map((b) => b + 1.5 * (catRng() * 2 - 1))
  return normalize(vec)
}

/**
 * Similarity ranges:
 *   Same brand + category:     ~88–95%
 *   Different brand, same cat: ~72–82%
 *   Different category:        ~22–38%
 */
export function generateProductVector(
  category: string,
  brand: string,
  productSeed: number
): number[] {
  const catIndex = CATEGORY_LIST.indexOf(category)
  const centroid = getCategoryCentroid(catIndex >= 0 ? catIndex : 0)

  const brandRng = seededRandom(hashString(brand))
  const brandOffset = Array.from({ length: VECTOR_DIM }, () => (brandRng() * 2 - 1) * 0.06)

  const prodRng = seededRandom(productSeed)
  const noise = Array.from({ length: VECTOR_DIM }, () => (prodRng() * 2 - 1) * 0.02)

  const vec = centroid.map((c, i) => c + brandOffset[i] + noise[i])
  return normalize(vec)
}

export function generateQueryVector(imageHash: number): number[] {
  const clusterIndex = Math.abs(imageHash) % CATEGORY_LIST.length
  const centroid = getCategoryCentroid(clusterIndex)

  const rng = seededRandom(imageHash)
  const vec = centroid.map((c) => c + (rng() * 2 - 1) * 0.04)
  return normalize(vec)
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
