import fs from 'fs'
import path from 'path'
import https from 'https'

interface SeedItem {
  商品名: string
  ブランド: string
  images: string[]
}

const DATA_PATH = path.join(__dirname, '2ndstreet_products.json')
const IMAGES_DIR = path.join(__dirname, 'images')

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      resolve()
      return
    }
    const file = fs.createWriteStream(dest)
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close()
          fs.unlinkSync(dest)
          downloadFile(res.headers.location!, dest).then(resolve, reject)
          return
        }
        if (res.statusCode !== 200) {
          file.close()
          fs.unlinkSync(dest)
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      })
      .on('error', (err) => {
        file.close()
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        reject(err)
      })
  })
}

async function main(): Promise<void> {
  const items: SeedItem[] = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))

  let total = 0
  let downloaded = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const productDir = path.join(IMAGES_DIR, String(i + 1))
    fs.mkdirSync(productDir, { recursive: true })

    for (let j = 0; j < item.images.length; j++) {
      total++
      const url = item.images[j]
      const ext = path.extname(new URL(url).pathname) || '.jpg'
      const dest = path.join(productDir, `${j + 1}${ext}`)

      if (fs.existsSync(dest)) {
        skipped++
        continue
      }

      try {
        await downloadFile(url, dest)
        downloaded++
        process.stdout.write(`\r  [${i + 1}/${items.length}] ${item.ブランド} - image ${j + 1}/${item.images.length}`)
      } catch (err) {
        failed++
        console.error(`\n  FAIL: ${url} → ${(err as Error).message}`)
      }

      await new Promise((r) => setTimeout(r, 200))
    }
  }

  console.log(`\n\nDone: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed (${total} total)`)
}

main().catch(console.error)
