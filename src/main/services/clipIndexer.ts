/**
 * Background indexer: generates CLIP vectors for images that don't have them yet.
 * Runs after the CLIP model has loaded.
 */

import { getDatabase } from '../db/connection'
import { vectorToBuffer } from '@shared/vectors'
import { extractCLIPFromFile, CLIP_MODEL_NAME, isCLIPReady, initCLIP } from './clipService'

export async function indexMissingCLIPVectors(): Promise<void> {
  if (!isCLIPReady()) {
    const ready = await initCLIP()
    if (!ready) {
      console.log('[CLIP Indexer] CLIP model not available, skipping.')
      return
    }
  }

  const db = getDatabase()

  const imagesWithoutCLIP = db
    .prepare(
      `SELECT pi.id as image_id, pi.product_id, pi.image_path
       FROM product_images pi
       WHERE pi.id NOT IN (
         SELECT image_id FROM image_vectors WHERE model_name = ?
       )`
    )
    .all(CLIP_MODEL_NAME) as Array<{
    image_id: number
    product_id: number
    image_path: string
  }>

  if (imagesWithoutCLIP.length === 0) {
    console.log('[CLIP Indexer] All images already indexed.')
    return
  }

  console.log(`[CLIP Indexer] Generating CLIP vectors for ${imagesWithoutCLIP.length} images...`)

  const insertVector = db.prepare(
    `INSERT INTO image_vectors (image_id, product_id, vector, model_name)
     VALUES (@image_id, @product_id, @vector, @model_name)`
  )

  let indexed = 0
  let failed = 0

  for (const img of imagesWithoutCLIP) {
    try {
      const vector = await extractCLIPFromFile(img.image_path)
      if (vector) {
        insertVector.run({
          image_id: img.image_id,
          product_id: img.product_id,
          vector: vectorToBuffer(vector),
          model_name: CLIP_MODEL_NAME
        })
        indexed++
      } else {
        failed++
      }
    } catch {
      failed++
    }

    if ((indexed + failed) % 20 === 0) {
      console.log(`[CLIP Indexer] Progress: ${indexed + failed}/${imagesWithoutCLIP.length}`)
    }
  }

  console.log(
    `[CLIP Indexer] Done. Indexed: ${indexed}, Failed: ${failed}, Total: ${imagesWithoutCLIP.length}`
  )
}
