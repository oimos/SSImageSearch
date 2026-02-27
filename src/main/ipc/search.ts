import { ipcMain } from 'electron'
import { getDatabase } from '../db/connection'
import { bufferToVector, cosineSimilarity, vectorToBuffer } from '@shared/vectors'
import type { Product, ProductImage, SearchResult } from '@shared/types'

export function registerSearchHandlers(): void {
  ipcMain.handle('db:search-similar', (_, queryVector: number[], limit = 5) => {
    const db = getDatabase()

    const rows = db
      .prepare('SELECT product_id, vector FROM image_vectors')
      .all() as Array<{ product_id: number; vector: Buffer }>

    const similarities = new Map<number, number>()

    for (const row of rows) {
      const storedVector = bufferToVector(row.vector)
      const sim = cosineSimilarity(queryVector, storedVector)

      const existing = similarities.get(row.product_id)
      if (existing === undefined || sim > existing) {
        similarities.set(row.product_id, sim)
      }
    }

    const sorted = [...similarities.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    const results: SearchResult[] = sorted.map(([productId, similarity]) => {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Product
      const images = db
        .prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY order_index')
        .all(productId) as ProductImage[]

      const matchReasons: string[] = []
      if (similarity > 0.85) matchReasons.push('画像が非常に類似')
      else if (similarity > 0.7) matchReasons.push('画像が類似')
      if (product.category) matchReasons.push(`カテゴリ: ${product.category}`)
      if (product.brand) matchReasons.push(`ブランド: ${product.brand}`)

      return { product, images, similarity, matchReasons }
    })

    return results
  })

  ipcMain.handle('db:save-vector', (_, imageId: number, productId: number, vector: number[]) => {
    const db = getDatabase()
    db.prepare(
      `INSERT INTO image_vectors (image_id, product_id, vector, model_name)
       VALUES (@image_id, @product_id, @vector, @model_name)`
    ).run({
      image_id: imageId,
      product_id: productId,
      vector: vectorToBuffer(vector),
      model_name: 'mock-v1'
    })
  })

  ipcMain.handle('db:get-all-vectors', () => {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT id, image_id, product_id, vector, model_name FROM image_vectors')
      .all() as Array<{ id: number; image_id: number; product_id: number; vector: Buffer; model_name: string }>

    return rows.map((r) => ({
      ...r,
      vector: bufferToVector(r.vector)
    }))
  })
}
