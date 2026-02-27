import { ipcMain } from 'electron'
import { saveUploadedImage, readImageAsBase64 } from '../services/imageService'
import { getDatabase } from '../db/connection'

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
}
