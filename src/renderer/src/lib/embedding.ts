const VECTOR_DIM = 512

function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 0xffffffff
  }
}

/**
 * Must match src/shared/vectors.ts getSharedBase / getCategoryCentroid exactly.
 */
function getSharedBase(): number[] {
  const rng = seededRandom(42)
  return Array.from({ length: VECTOR_DIM }, () => rng() * 2 - 1)
}

function getCategoryCentroid(categoryIndex: number): number[] {
  const base = getSharedBase()
  const catRng = seededRandom(10007 + categoryIndex * 7919)
  const vec = base.map((b) => b + 1.5 * (catRng() * 2 - 1))
  return normalize(vec)
}

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  if (norm === 0) return vec
  return vec.map((x) => x / norm)
}

function hashBuffer(data: ArrayBuffer): number {
  const bytes = new Uint8Array(data)
  let hash = 5381
  const len = Math.min(bytes.length, 20000)
  for (let i = 0; i < len; i++) {
    hash = ((hash << 5) + hash + bytes[i]) | 0
  }
  return hash
}

function analyzeImageColors(data: ArrayBuffer): { r: number; g: number; b: number } {
  const bytes = new Uint8Array(data)
  let r = 0, g = 0, b = 0, count = 0

  const step = Math.max(1, Math.floor(bytes.length / 3000))
  for (let i = 0; i + 2 < bytes.length; i += step * 3) {
    r += bytes[i]
    g += bytes[i + 1]
    b += bytes[i + 2]
    count++
  }

  if (count === 0) return { r: 128, g: 128, b: 128 }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count)
  }
}

export async function generateMockEmbedding(imageData: ArrayBuffer): Promise<number[]> {
  const hash = hashBuffer(imageData)
  const colors = analyzeImageColors(imageData)

  const colorBias = (colors.r + colors.g * 2 + colors.b * 3) % 5
  const clusterIndex = (Math.abs(hash) + colorBias) % 5
  const centroid = getCategoryCentroid(clusterIndex)

  const rng = seededRandom(hash)
  const vec = centroid.map((c) => c + (rng() * 2 - 1) * 0.04)
  return normalize(vec)
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
