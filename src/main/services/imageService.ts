import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export function getImagesDir(): string {
  return path.join(app.getPath('userData'), 'images')
}

export function saveUploadedImage(
  productId: number,
  imageData: string,
  orderIndex: number
): string {
  const dir = path.join(getImagesDir(), String(productId))
  fs.mkdirSync(dir, { recursive: true })

  const isBase64 = imageData.startsWith('data:')
  const ext = isBase64 && imageData.includes('png') ? 'png' : 'jpg'
  const filePath = path.join(dir, `${orderIndex}.${ext}`)

  if (isBase64) {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'))
  } else {
    fs.copyFileSync(imageData, filePath)
  }

  return filePath
}

export function readImageAsBase64(imagePath: string): string | null {
  try {
    if (!fs.existsSync(imagePath)) return null

    if (imagePath.endsWith('.svg')) {
      const content = fs.readFileSync(imagePath, 'utf-8')
      return `data:image/svg+xml;base64,${Buffer.from(content).toString('base64')}`
    }

    const ext = path.extname(imagePath).slice(1).toLowerCase()
    const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg'
    const data = fs.readFileSync(imagePath)
    return `data:${mime};base64,${data.toString('base64')}`
  } catch {
    return null
  }
}
