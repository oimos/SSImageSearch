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

/**
 * All centroids share a common base vector.
 * Cross-category cosine similarity ≈ 0.40–0.50.
 */
function getSharedBase(): number[] {
  const rng = seededRandom(42)
  return Array.from({ length: VECTOR_DIM }, () => rng() * 2 - 1)
}

export function getCategoryCentroid(categoryIndex: number): number[] {
  const base = getSharedBase()
  const catRng = seededRandom(10007 + categoryIndex * 7919)
  const vec = base.map((b) => b + (catRng() * 2 - 1))
  return normalize(vec)
}

/**
 * Generate a product vector for seed data.
 *
 * Noise coefficients are kept small relative to the centroid
 * (which has per-component magnitude ~1/sqrt(512) ≈ 0.044)
 * to ensure meaningful cosine similarity:
 *   Same brand + category:    ~92–97%
 *   Different brand, same cat: ~74–80%
 *   Different category:        ~38–48%
 */
export function generateProductVector(
  category: string,
  brand: string,
  productSeed: number
): number[] {
  const catIndex = CATEGORY_LIST.indexOf(category)
  const centroid = getCategoryCentroid(catIndex >= 0 ? catIndex : 0)

  const brandRng = seededRandom(hashString(brand))
  const brandOffset = Array.from({ length: VECTOR_DIM }, () => (brandRng() * 2 - 1) * 0.04)

  const prodRng = seededRandom(productSeed)
  const noise = Array.from({ length: VECTOR_DIM }, () => (prodRng() * 2 - 1) * 0.015)

  const vec = centroid.map((c, i) => c + brandOffset[i] + noise[i])
  return normalize(vec)
}

/**
 * Generate a query vector from an image hash.
 * Uses the same centroid structure as generateProductVector.
 *   Query → same cluster product:     ~78–85%
 *   Query → different cluster product: ~38–48%
 */
export function generateQueryVector(imageHash: number): number[] {
  const clusterIndex = Math.abs(imageHash) % CATEGORY_LIST.length
  const centroid = getCategoryCentroid(clusterIndex)

  const rng = seededRandom(imageHash)
  const vec = centroid.map((c) => c + (rng() * 2 - 1) * 0.03)
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
