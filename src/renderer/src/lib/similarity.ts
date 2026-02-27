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

export function hashImageData(data: ArrayBuffer): number {
  const bytes = new Uint8Array(data)
  let hash = 5381
  const len = Math.min(bytes.length, 20000)
  for (let i = 0; i < len; i++) {
    hash = ((hash << 5) + hash + bytes[i]) | 0
  }
  return hash
}
