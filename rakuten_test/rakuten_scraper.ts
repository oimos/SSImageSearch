/**
 * Rakuten Fashion ランキングページから商品データ+画像をスクレイピングする一時テストスクリプト。
 *
 * 使い方:
 *   npx tsx rakuten_test/rakuten_scraper.ts
 *
 * 出力:
 *   rakuten_test/data/products.json   — 商品メタデータ
 *   rakuten_test/images/<index>.jpg   — 商品画像
 */
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'

const RANKING_URL = 'https://brandavenue.rakuten.co.jp/ranking/'
const MAX_PRODUCTS = 30
const OUT_DIR = path.resolve(__dirname, 'images')
const DATA_DIR = path.resolve(__dirname, 'data')

interface ScrapedProduct {
  index: number
  brand: string
  price: string
  imageUrl: string
  localImage: string
  detailUrl: string
}

function downloadImage(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const get = url.startsWith('https') ? https.get : http.get
    get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImage(res.headers.location, dest).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(DATA_DIR, { recursive: true })

  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  console.log(`Navigating to ${RANKING_URL}`)
  await page.goto(RANKING_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  console.log('Waiting for page content to render...')
  await page.waitForTimeout(8000)

  console.log('Extracting product data...')
  const products = await page.evaluate((max: number) => {
    const items: Array<{
      brand: string
      price: string
      imageUrl: string
      detailUrl: string
    }> = []

    const cards = document.querySelectorAll(
      '[class*="ranking"] [class*="item"], ' +
      '[class*="ranking"] li, ' +
      '[class*="RankingList"] li, ' +
      '[data-testid*="ranking"] li'
    )

    if (cards.length > 0) {
      cards.forEach((card) => {
        if (items.length >= max) return
        const img = card.querySelector('img')
        const link = card.querySelector('a')
        const brandEl =
          card.querySelector('[class*="brand"]') ||
          card.querySelector('[class*="Brand"]')
        const priceEl =
          card.querySelector('[class*="price"]') ||
          card.querySelector('[class*="Price"]')

        if (img) {
          items.push({
            brand: brandEl?.textContent?.trim() ?? '',
            price: priceEl?.textContent?.trim() ?? '',
            imageUrl: img.src || img.getAttribute('data-src') || '',
            detailUrl: link?.href ?? ''
          })
        }
      })
    }

    if (items.length === 0) {
      const allImages = document.querySelectorAll('img[src*="image.rakuten"]')
      allImages.forEach((img) => {
        if (items.length >= max) return
        const parent = img.closest('a') || img.parentElement
        const text = parent?.textContent?.trim() ?? ''
        items.push({
          brand: text.split('\n')[0]?.trim() ?? '',
          price: '',
          imageUrl: (img as HTMLImageElement).src,
          detailUrl: (parent as HTMLAnchorElement)?.href ?? ''
        })
      })
    }

    return items
  }, MAX_PRODUCTS)

  console.log(`Found ${products.length} products`)

  if (products.length === 0) {
    console.log('Trying alternative selectors...')
    const altProducts = await page.evaluate((max: number) => {
      const items: Array<{
        brand: string
        price: string
        imageUrl: string
        detailUrl: string
      }> = []

      const allAnchors = document.querySelectorAll('a[href*="/item/"]')
      allAnchors.forEach((a) => {
        if (items.length >= max) return
        const img = a.querySelector('img')
        if (!img) return
        const src = img.src || img.getAttribute('data-src') || ''
        if (!src || src.includes('data:')) return
        items.push({
          brand: '',
          price: '',
          imageUrl: src,
          detailUrl: (a as HTMLAnchorElement).href
        })
      })
      return items
    }, MAX_PRODUCTS)

    products.push(...altProducts.slice(0, MAX_PRODUCTS - products.length))
    console.log(`After alt: ${products.length} products`)
  }

  if (products.length === 0) {
    console.log('Taking screenshot for debugging...')
    await page.screenshot({ path: path.join(DATA_DIR, 'debug_screenshot.png'), fullPage: true })

    const html = await page.content()
    fs.writeFileSync(path.join(DATA_DIR, 'debug_page.html'), html.slice(0, 100_000))
    console.log('Saved debug files. Please inspect rakuten_test/data/')
    await browser.close()
    return
  }

  const results: ScrapedProduct[] = []

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    const ext = p.imageUrl.match(/\.(jpe?g|png|webp|gif)/i)?.[1] ?? 'jpg'
    const filename = `${String(i + 1).padStart(2, '0')}.${ext}`
    const dest = path.join(OUT_DIR, filename)

    try {
      console.log(`  [${i + 1}/${products.length}] Downloading ${p.brand || 'unknown'}...`)
      await downloadImage(p.imageUrl, dest)
      results.push({
        index: i + 1,
        brand: p.brand,
        price: p.price,
        imageUrl: p.imageUrl,
        localImage: `images/${filename}`,
        detailUrl: p.detailUrl
      })
    } catch (err) {
      console.warn(`  ⚠ Failed to download image ${i + 1}:`, (err as Error).message)
    }
  }

  const outPath = path.join(DATA_DIR, 'products.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`\nDone! ${results.length} products saved to ${outPath}`)

  await browser.close()
}

main().catch((err) => {
  console.error('Scraper failed:', err)
  process.exit(1)
})
