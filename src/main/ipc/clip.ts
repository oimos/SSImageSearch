import { ipcMain } from 'electron'
import {
  initCLIP,
  extractCLIPFromBuffer,
  isCLIPReady,
  getCLIPError,
  CLIP_DIM
} from '../services/clipService'

export function registerCLIPHandlers(): void {
  ipcMain.handle('clip:extract', async (_, imageBase64: string) => {
    const matches = imageBase64.match(/^data:image\/\w+;base64,(.+)$/)
    const base64Data = matches ? matches[1] : imageBase64
    const buffer = Buffer.from(base64Data, 'base64')
    return extractCLIPFromBuffer(buffer)
  })

  ipcMain.handle('clip:status', async () => {
    return {
      ready: isCLIPReady(),
      error: getCLIPError(),
      dim: CLIP_DIM
    }
  })
}

export async function startCLIPLoading(): Promise<void> {
  initCLIP().catch(() => {
    /* logged inside initCLIP */
  })
}
