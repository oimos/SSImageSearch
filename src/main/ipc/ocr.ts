import { ipcMain } from 'electron'
import type { OcrNormalizeOptions } from '@shared/types'
import {
  normalizeOcrText,
  extractInfoFromImage,
  classifyImageType
} from '../services/ocrNormalizer'

export function registerOcrHandlers(): void {
  ipcMain.handle(
    'ocr:normalize',
    (_, rawOcrText: string, options?: OcrNormalizeOptions) =>
      normalizeOcrText(rawOcrText, options)
  )

  ipcMain.handle('ocr:extract-from-image', async (_, imageBase64: string) =>
    extractInfoFromImage(imageBase64)
  )

  ipcMain.handle('image:classify-type', async (_, imageBase64: string) =>
    classifyImageType(imageBase64)
  )
}
