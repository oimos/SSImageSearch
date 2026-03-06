export interface VectorResult {
  vector: number[]
  modelName: string
  dim: number
}

export interface VectorsResult {
  clipVector: number[] | null
  v2Vector: number[]
}

/**
 * Generate an embedding vector via the main process (CLIP preferred, V2 fallback).
 */
export async function generateVector(imageBase64: string): Promise<VectorResult> {
  return window.api.generateVector(imageBase64)
}

/**
 * Generate both CLIP and V2 embedding vectors for hybrid search.
 */
export async function generateVectors(imageBase64: string): Promise<VectorsResult> {
  return window.api.generateVectors(imageBase64)
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
