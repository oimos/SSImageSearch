import { ipcMain } from 'electron'
import { saveUploadedImage, readImageAsBase64 } from '../services/imageService'
import { getDatabase } from '../db/connection'
import {
  extractCLIPFromBuffer,
  isCLIPReady,
  CLIP_DIM,
  CLIP_MODEL_NAME
} from '../services/clipService'
import { extractFeaturesV2FromBuffer, FEATURE_DIM_V2 } from '../services/imageVectors'

export interface GenerateVectorResult {
  vector: number[]
  modelName: string
  dim: number
}

export interface GenerateVectorsResult {
  clipVector: number[] | null
  v2Vector: number[]
}

export function registerImageHandlers(): void {
  ipcMain.handle(
    'image:save',
    (_, productId: number, images: Array<{ data: string; type: string; index: number }>) => {
      const db = getDatabase()
      const insertImage = db.prepare(
        `INSERT INTO product_images (product_id, image_path, image_type, order_index)
         VALUES (@product_id, @image_path, @image_type, @order_index)`
      )

      const saved: Array<{ path: string; type: string; index: number; imageId: number }> = []
      for (const img of images) {
        const filePath = saveUploadedImage(productId, img.data, img.index)
        const result = insertImage.run({
          product_id: productId,
          image_path: filePath,
          image_type: img.type,
          order_index: img.index
        })
        saved.push({
          path: filePath,
          type: img.type,
          index: img.index,
          imageId: result.lastInsertRowid as number
        })
      }
      return saved
    }
  )

  ipcMain.handle('image:read', (_, imagePath: string) => {
    return readImageAsBase64(imagePath)
  })

  ipcMain.handle(
    'image:generate-vector',
    async (_, imageBase64: string): Promise<GenerateVectorResult> => {
      const matches = imageBase64.match(/^data:image\/\w+;base64,(.+)$/)
      const base64Data = matches ? matches[1] : imageBase64
      const buffer = Buffer.from(base64Data, 'base64')

      if (isCLIPReady()) {
        const clipVec = await extractCLIPFromBuffer(buffer)
        if (clipVec) {
          return { vector: clipVec, modelName: CLIP_MODEL_NAME, dim: CLIP_DIM }
        }
      }

      const v2Vec = await extractFeaturesV2FromBuffer(buffer)
      return { vector: v2Vec, modelName: 'features-v2', dim: FEATURE_DIM_V2 }
    }
  )

  ipcMain.handle(
    'image:generate-vectors',
    async (_, imageBase64: string): Promise<GenerateVectorsResult> => {
      const matches = imageBase64.match(/^data:image\/\w+;base64,(.+)$/)
      const base64Data = matches ? matches[1] : imageBase64
      const buffer = Buffer.from(base64Data, 'base64')

      const [clipVec, v2Vec] = await Promise.all([
        isCLIPReady()
          ? extractCLIPFromBuffer(buffer).catch(() => null)
          : Promise.resolve(null),
        extractFeaturesV2FromBuffer(buffer)
      ])

      return { clipVector: clipVec, v2Vector: v2Vec }
    }
  )
}
