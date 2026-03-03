import 'dotenv/config'
import { app, BrowserWindow } from 'electron'
import path from 'path'
import { initializeSchema } from './db/schema'
import { seedDatabase } from './db/seed'
import { closeDatabase } from './db/connection'
import { registerProductHandlers } from './ipc/product'
import { registerImageHandlers } from './ipc/image'
import { registerSearchHandlers } from './ipc/search'
import { registerOcrHandlers } from './ipc/ocr'

if (process.env.E2E_USER_DATA) {
  app.setPath('userData', process.env.E2E_USER_DATA)
}

function createWindow(): void {
  const isMac = process.platform === 'darwin'

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: isMac ? { x: 16, y: 12 } : undefined,
    backgroundColor: '#09090B',
    title: 'SS Image Search'
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  initializeSchema()
  await seedDatabase()

  registerProductHandlers()
  registerImageHandlers()
  registerSearchHandlers()
  registerOcrHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})
