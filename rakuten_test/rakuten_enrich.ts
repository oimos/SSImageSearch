/**
 * 各商品の詳細ページからブランド名・素材・サイズなどのメタデータを取得し、
 * products.json を enriched_products.json に拡充する。
 *
 * 使い方:
 *   npx tsx rakuten_test/rakuten_enrich.ts
 */
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const DATA_DIR = path.resolve(__dirname, 'data')
const INPUT = path.join(DATA_DIR, 'products.json')
const OUTPUT = path.join(DATA_DIR, 'enriched_products.json')

interface Product {
  index: number
  brand: string
  price: string
  imageUrl: string
  localImage: string
  detailUrl: string
}

interface EnrichedProduct extends Product {
  productName: string
  material: string
  size: string[]
  color: string
  category: string
  rawTexts: string[]
}

function extractField(text: string, patterns: RegExp[]): string {
  for (const pat of patterns) {
    const m = text.match(pat)
    if (m && m[1]?.trim()) return m[1].trim()
  }
  return ''
}

function parsePageText(text: string): Omit<EnrichedProduct, keyof Product> {
  const brandPatterns = [
    /ブランド[：:\s]*([^\n]{2,40})/,
    /Brand[：:\s]*([^\n]{2,40})/i
  ]
  const brand = extractField(text, brandPatterns)

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const productName = lines[0]?.slice(0, 80) ?? ''

  const material = extractField(text, [
    /(?:素材|材質|組成|本体)[：:\s]*([^\n]{3,100})/,
    /(?:MATERIAL)[：:\s]*([^\n]{3,80})/i
  ])

  const sizeText = extractField(text, [
    /(?:サイズ展開|サイズ|SIZE)[：:\s]*([^\n]{2,80})/i
  ])
  const sizes = sizeText
    ? sizeText.split(/[,/、\s]+/).filter((s) => s.length > 0 && s.length < 10)
    : []

  const color = extractField(text, [
    /(?:カラー|色|COLOR)[：:\s]*([^\n]{2,40})/i
  ])

  const category = extractField(text, [
    /(?:カテゴリ|CATEGORY)[：:\s]*([^\n]{2,40})/i
  ])

  const rawTexts = lines.filter((l) => l.length > 2 && l.length < 120).slice(0, 20)

  return { productName, material, size: sizes, color, category, rawTexts }
}

async function main(): Promise<void> {
  const products: Product[] = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))

  console.log(`Enriching ${products.length} products...`)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()

  const enriched: EnrichedProduct[] = []

  for (const product of products) {
    const page = await context.newPage()
    try {
      console.log(`  [${product.index}/${products.length}] ${product.detailUrl}`)
      await page.goto(product.detailUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForTimeout(3000)

      const pageText = await page.innerText('body').catch(() => '')
      const parsed = parsePageText(pageText)

      enriched.push({
        ...product,
        brand: parsed.rawTexts.find((t) => /^[A-Z][A-Z\s&'.]+$/.test(t))
          || extractField(pageText, [/ブランド[：:\s]*([^\n]{2,40})/])
          || product.brand,
        ...parsed
      })
    } catch (err) {
      console.warn(`  ⚠ Failed ${product.index}:`, (err as Error).message)
      enriched.push({
        ...product,
        productName: '',
        material: '',
        size: [],
        color: '',
        category: '',
        rawTexts: []
      })
    } finally {
      await page.close()
    }
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(enriched, null, 2))
  console.log(`\nDone! Enriched data saved to ${OUTPUT}`)

  const withBrand = enriched.filter((p) => p.brand)
  const withMaterial = enriched.filter((p) => p.material)
  console.log(`  Brands found: ${withBrand.length}/${enriched.length}`)
  console.log(`  Materials found: ${withMaterial.length}/${enriched.length}`)

  await browser.close()
}

main().catch((err) => {
  console.error('Enrich failed:', err)
  process.exit(1)
})
