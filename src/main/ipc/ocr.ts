import { ipcMain } from 'electron'
import type { OcrNormalizeOptions } from '@shared/types'
import { normalizeOcrText } from '../services/ocrNormalizer'

export function registerOcrHandlers(): void {
  ipcMain.handle(
    'ocr:normalize',
    (_, rawOcrText: string, options?: OcrNormalizeOptions) =>
      normalizeOcrText(rawOcrText, options)
  )
}
