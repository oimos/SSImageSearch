import { ipcMain } from 'electron'
import { getDatabase } from '../db/connection'
import { bufferToVector, cosineSimilarity, vectorToBuffer } from '@shared/vectors'
import { FEATURE_DIM_V2 } from '@shared/featureExtraction'
import { CLIP_DIM, CLIP_MODEL_NAME } from '../services/clipService'
import type { Product, ProductImage, SearchResult, SearchFilter } from '@shared/types'
import { getConfidenceLevel } from '@shared/types'

const CLIP_WEIGHT = 0.7
const V2_WEIGHT = 0.3

function currentModelName(dim: number): string {
  if (dim === CLIP_DIM) return CLIP_MODEL_NAME
  if (dim === FEATURE_DIM_V2) return 'features-v2'
  return 'pixel-v1'
}

function resolveAllowedProducts(
  db: ReturnType<typeof getDatabase>,
  filters?: SearchFilter
): Set<number> | null {
  const hasFilters =
    filters && (filters.brand || filters.category || filters.color || filters.material)
  if (!hasFilters) return null

  const conds: string[] = []
  const params: Record<string, string> = {}
  if (filters!.brand) {
    conds.push('brand LIKE @brand')
    params.brand = `%${filters!.brand}%`
  }
  if (filters!.category) {
    conds.push('category = @category')
    params.category = filters!.category
  }
  if (filters!.color) {
    conds.push('color LIKE @color')
    params.color = `%${filters!.color}%`
  }
  if (filters!.material) {
    conds.push('material LIKE @material')
    params.material = `%${filters!.material}%`
  }
  const rows = db
    .prepare(`SELECT id FROM products WHERE ${conds.join(' AND ')}`)
    .all(params) as Array<{ id: number }>
  return new Set(rows.map((r) => r.id))
}

function searchByVector(
  db: ReturnType<typeof getDatabase>,
  queryVector: number[],
  modelName: string,
  allowedProductIds: Set<number> | null
): Map<number, number> {
  let rows = db
    .prepare('SELECT product_id, vector FROM image_vectors WHERE model_name = ?')
    .all(modelName) as Array<{ product_id: number; vector: Buffer }>

  if (rows.length === 0) {
    rows = db
      .prepare('SELECT product_id, vector FROM image_vectors')
      .all() as Array<{ product_id: number; vector: Buffer }>
  }

  const similarities = new Map<number, number>()
  for (const row of rows) {
    if (allowedProductIds && !allowedProductIds.has(row.product_id)) continue
    const stored = bufferToVector(row.vector)
    if (stored.length !== queryVector.length) continue
    const sim = cosineSimilarity(queryVector, stored)
    const existing = similarities.get(row.product_id)
    if (existing === undefined || sim > existing) {
      similarities.set(row.product_id, sim)
    }
  }
  return similarities
}

function mergeHybridScores(
  v2Scores: Map<number, number>,
  clipScores: Map<number, number>
): Map<number, number> {
  const allProductIds = new Set([...v2Scores.keys(), ...clipScores.keys()])
  const result = new Map<number, number>()

  const hasClip = clipScores.size > 0
  const hasV2 = v2Scores.size > 0

  for (const pid of allProductIds) {
    let score: number
    if (hasClip && hasV2) {
      score = CLIP_WEIGHT * (clipScores.get(pid) ?? 0) + V2_WEIGHT * (v2Scores.get(pid) ?? 0)
    } else if (hasClip) {
      score = clipScores.get(pid) ?? 0
    } else {
      score = v2Scores.get(pid) ?? 0
    }
    result.set(pid, score)
  }
  return result
}

export function registerSearchHandlers(): void {
  // Original single-vector search (backward compatible)
  ipcMain.handle(
    'db:search-similar',
    (_, queryVector: number[] | null, limit = 5, filters?: SearchFilter) => {
      const db = getDatabase()
      const allowedProductIds = resolveAllowedProducts(db, filters)

      if (queryVector) {
        const modelName = currentModelName(queryVector.length)
        const similarities = searchByVector(db, queryVector, modelName, allowedProductIds)
        const sorted = [...similarities.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
        return buildResults(db, sorted)
      }

      if (allowedProductIds && allowedProductIds.size > 0) {
        const ids = [...allowedProductIds].slice(0, limit)
        return buildResults(
          db,
          ids.map((id) => [id, 0] as [number, number])
        )
      }

      return [] as SearchResult[]
    }
  )

  // Hybrid search: combines CLIP (0.7) + V2 handcrafted (0.3)
  ipcMain.handle(
    'db:search-hybrid',
    (
      _,
      v2Vector: number[] | null,
      clipVector: number[] | null,
      limit = 10,
      filters?: SearchFilter
    ) => {
      const db = getDatabase()
      const allowedProductIds = resolveAllowedProducts(db, filters)

      const v2Scores =
        v2Vector ? searchByVector(db, v2Vector, 'features-v2', allowedProductIds) : new Map()
      const clipScores =
        clipVector ? searchByVector(db, clipVector, CLIP_MODEL_NAME, allowedProductIds) : new Map()

      const hybridScores = mergeHybridScores(v2Scores, clipScores)

      const sorted = [...hybridScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)

      return buildResults(db, sorted)
    }
  )

  // Batch hybrid search: multiple query images → per-product aggregation with consistency
  ipcMain.handle(
    'db:search-hybrid-batch',
    (
      _,
      v2Vectors: number[][],
      clipVectors: (number[] | null)[],
      limit = 10,
      filters?: SearchFilter
    ) => {
      const db = getDatabase()
      const allowedProductIds = resolveAllowedProducts(db, filters)

      // For each query image, compute hybrid scores per product
      const perQueryScores: Map<number, number>[] = []

      for (let qi = 0; qi < v2Vectors.length; qi++) {
        const v2 = v2Vectors[qi]
        const clip = clipVectors[qi] ?? null

        const v2S = v2 ? searchByVector(db, v2, 'features-v2', allowedProductIds) : new Map()
        const clipS = clip
          ? searchByVector(db, clip, CLIP_MODEL_NAME, allowedProductIds)
          : new Map()

        perQueryScores.push(mergeHybridScores(v2S, clipS))
      }

      // Aggregate: for each product, use weighted top-2 scores + consistency penalty
      const allProductIds = new Set(perQueryScores.flatMap((m) => [...m.keys()]))
      const finalScores = new Map<number, number>()

      for (const pid of allProductIds) {
        const scores = perQueryScores
          .map((m) => m.get(pid) ?? 0)
          .sort((a, b) => b - a)

        if (scores.length === 0) continue

        if (scores.length === 1) {
          finalScores.set(pid, scores[0])
          continue
        }

        // Weighted average of top-2 scores
        const top1 = scores[0]
        const top2 = scores[1]
        const baseScore = 0.7 * top1 + 0.3 * top2

        // Consistency penalty: if only one photo matches well, penalize
        const consistency = top1 > 0 ? top2 / top1 : 0
        const adjustedScore = baseScore * (0.8 + 0.2 * consistency)

        finalScores.set(pid, adjustedScore)
      }

      const sorted = [...finalScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)

      return buildResults(db, sorted)
    }
  )

  ipcMain.handle(
    'db:save-vector',
    (_, imageId: number, productId: number, vector: number[]) => {
      const db = getDatabase()
      const modelName = currentModelName(vector.length)
      db.prepare(
        `INSERT INTO image_vectors (image_id, product_id, vector, model_name)
       VALUES (@image_id, @product_id, @vector, @model_name)`
      ).run({
        image_id: imageId,
        product_id: productId,
        vector: vectorToBuffer(vector),
        model_name: modelName
      })
    }
  )

  ipcMain.handle('db:get-all-vectors', () => {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT id, image_id, product_id, vector, model_name FROM image_vectors')
      .all() as Array<{
      id: number
      image_id: number
      product_id: number
      vector: Buffer
      model_name: string
    }>
    return rows.map((r) => ({ ...r, vector: bufferToVector(r.vector) }))
  })
}

function buildResults(
  db: ReturnType<typeof getDatabase>,
  entries: Array<[number, number]>
): SearchResult[] {
  return entries.map(([productId, similarity]) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Product
    const images = db
      .prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY order_index')
      .all(productId) as ProductImage[]

    const confidence = getConfidenceLevel(similarity)
    const matchReasons: string[] = []
    if (similarity > 0.85) matchReasons.push('画像が非常に類似')
    else if (similarity > 0.7) matchReasons.push('画像が類似')
    else if (similarity === 0) matchReasons.push('属性一致')
    if (product.category) matchReasons.push(`カテゴリ: ${product.category}`)
    if (product.brand) matchReasons.push(`ブランド: ${product.brand}`)

    return { product, images, similarity, matchReasons, confidence }
  })
}
