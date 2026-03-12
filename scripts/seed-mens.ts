/**
 * Standalone seed script: populates the database with mens product data.
 * Run with: npx tsx scripts/seed-mens.ts
 */
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import os from 'os'
import sharp from 'sharp'
import { extractFeaturesV2FromPixels, GRID_V2, FEATURE_DIM_V2 } from '../src/shared/featureExtraction'

// ── Types ────────────────────────────────────────────────────────────────────

interface RawSeedItem {
  商品名: string
  ブランド: string
  カテゴリ_メイン: string
  カテゴリ_サブ: string
  カテゴリ_詳細: string
  型番モデル: string
  サイズ: string
  色: string
  素材: string
  状態: string
  販売価格: number | null
  買収価格: number | null
  そのほかコメント: string
  url: string
  category: string
  index: number
  images: string[]
}

// ── Parsing helpers ──────────────────────────────────────────────────────────

const COLOR_CODE_MAP: Record<string, string> = {
  BLK: 'ブラック', WHT: 'ホワイト', NVY: 'ネイビー', BRW: 'ブラウン',
  BEG: 'ベージュ', BLU: 'ブルー', YLW: 'イエロー', GRY: 'グレー',
  IVO: 'アイボリー', CML: 'キャメル', KHK: 'カーキ', BRD: 'ボルドー',
  IDG: 'インディゴ'
}

const KNOWN_MATERIALS = [
  'コットン', 'ウール', 'ポリエステル', 'リネン', 'デニム',
  'ベロア', 'スウェード', 'ファー', 'ナイロン', 'レザー'
]

const SIZE_PATTERN = /^[0-9]+(\.[0-9]+)?$|^(FREE|ONE|F)$/i
const DASH_CODE_PATTERN = /^[A-Za-z0-9]{1,}[-][A-Za-z0-9][-A-Za-z0-9]*$/
const PURE_DIGITS = /^\d{4,}$/
const NO_SPACE_ALNUM = /^[A-Za-z0-9]{6,}$/
const JP_CHARS = /[\u3001-\u9FFF]/

function looksLikeSerialCode(part: string): boolean {
  const normalized = part.replace(/[\s\u3000]+/g, ' ').trim()
  const noSpace = normalized.replace(/\s+/g, '')
  if (PURE_DIGITS.test(noSpace)) return true
  if (JP_CHARS.test(normalized)) return false
  if (normalized.includes(' ') && normalized.split(' ').length > 3) return false
  if (DASH_CODE_PATTERN.test(normalized)) return true
  if (NO_SPACE_ALNUM.test(noSpace) && noSpace.length >= 6) return true
  return false
}

function parseProductName(name: string): { color: string; material: string; model: string } {
  const parts = name.split('/').map((p) => p.trim()).filter(Boolean)
  let color = ''
  let material = ''
  const descParts: string[] = []

  for (const part of parts) {
    if (!color && COLOR_CODE_MAP[part]) { color = COLOR_CODE_MAP[part]; continue }
    if (!color && ['マルチカラー', 'グレー', 'アイボリー'].includes(part)) { color = part; continue }
    const matMatch = KNOWN_MATERIALS.find((m) => part === m)
    if (matMatch) { if (!material) material = matMatch; continue }
    if (SIZE_PATTERN.test(part)) continue
    if (looksLikeSerialCode(part)) continue
    if (part === '' || part === '/') continue
    descParts.push(part)
  }

  return { color, material, model: descParts.join(' ') || name }
}

function normalizeCategory(sub: string): string {
  return sub.replace(/^メンズ\s*/, '').replace(/^レディース\s*/, '')
}

function buildModel(brand: string, detail: string, parsed: string): string {
  let m = parsed
  if (m.startsWith(brand + ' ')) m = m.slice(brand.length).trim()
  if (detail && detail !== 'その他' && !m.includes(detail)) m = `${m} (${detail})`
  return m || parsed
}

function parseCondition(raw: string): string {
  const match = raw.match(/[SABCD]/)
  return match ? match[0] : 'B'
}

function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  return hash
}

function generateDemoPrice(brand: string, category: string, seed: number): number {
  const rng = (s: number): number => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 0xffffffff }
  const base = rng(seed + hashString(brand))
  const rangeMap: Record<string, [number, number]> = {
    'シャツ': [3000, 25000], 'トップス': [4000, 35000], 'ジャケット': [8000, 50000],
    'コート': [10000, 60000], 'ワンピース': [5000, 30000], 'スカート': [3000, 20000],
    'シューズ': [5000, 40000]
  }
  const [min, max] = rangeMap[category] || [3000, 30000]
  return Math.round((min + base * (max - min)) / 10) * 10
}

// ── Vector extraction (same as imageVectors.ts but without Electron deps) ────

function normalizeVec(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  if (norm === 0) return vec
  return vec.map((x) => x / norm)
}

async function extractFeaturesV2FromFile(filePath: string): Promise<number[]> {
  const { data } = await sharp(filePath)
    .resize(GRID_V2, GRID_V2, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const raw = extractFeaturesV2FromPixels(data, GRID_V2)
  return normalizeVec(raw)
}

function vectorToBuffer(vec: number[]): Buffer {
  const float32 = new Float32Array(vec)
  return Buffer.from(float32.buffer)
}

// ── Image file helpers ───────────────────────────────────────────────────────

function findLocalImages(seedImagesDir: string, productIndex: number): string[] {
  const prefix = `メンズウェア_${String(productIndex).padStart(3, '0')}_`
  if (!fs.existsSync(seedImagesDir)) return []
  return fs.readdirSync(seedImagesDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.jpg'))
    .sort()
}

// ── Main ─────────────────────────────────────────────────────────────────────

const SEED_MODEL = 'features-v2-mens'

async function main(): Promise<void> {
  const appDataDir = path.join(os.homedir(), 'Library', 'Application Support', 'ss-image-search')
  fs.mkdirSync(appDataDir, { recursive: true })

  const dbPath = path.join(appDataDir, 'ssimagesearch.db')
  console.log(`Database: ${dbPath}`)

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      category TEXT NOT NULL,
      model TEXT DEFAULT '',
      size TEXT DEFAULT '',
      color TEXT DEFAULT '',
      material TEXT DEFAULT '',
      condition TEXT NOT NULL DEFAULT 'B',
      price INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_path TEXT NOT NULL,
      image_type TEXT NOT NULL DEFAULT 'other',
      order_index INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS image_vectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_id INTEGER NOT NULL REFERENCES product_images(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      vector BLOB NOT NULL,
      model_name TEXT NOT NULL DEFAULT 'mock-v1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
    CREATE INDEX IF NOT EXISTS idx_image_vectors_product_id ON image_vectors(product_id);
    CREATE INDEX IF NOT EXISTS idx_image_vectors_image_id ON image_vectors(image_id);
  `)

  // Clear existing data
  console.log('Clearing existing data...')
  db.prepare('DELETE FROM image_vectors').run()
  db.prepare('DELETE FROM product_images').run()
  db.prepare('DELETE FROM products').run()

  const seedDir = path.join(process.cwd(), 'seed-data', 'mens')
  const seedDataPath = path.join(seedDir, 'products.json')
  if (!fs.existsSync(seedDataPath)) {
    console.error(`Seed data not found: ${seedDataPath}`)
    process.exit(1)
  }

  const rawItems: RawSeedItem[] = JSON.parse(fs.readFileSync(seedDataPath, 'utf-8'))
  const seedImagesDir = path.join(seedDir, 'images')
  const imagesDir = path.join(appDataDir, 'images')
  fs.mkdirSync(imagesDir, { recursive: true })

  console.log(`Processing ${rawItems.length} products...`)

  const imageTypeOrder: Array<'full' | 'detail' | 'tag' | 'logo' | 'other'> = [
    'full', 'detail', 'tag', 'logo', 'other'
  ]

  const insertProduct = db.prepare(`
    INSERT INTO products (brand, category, model, size, color, material, condition, price, notes)
    VALUES (@brand, @category, @model, @size, @color, @material, @condition, @price, @notes)
  `)
  const insertImage = db.prepare(`
    INSERT INTO product_images (product_id, image_path, image_type, order_index)
    VALUES (@product_id, @image_path, @image_type, @order_index)
  `)
  const insertVector = db.prepare(`
    INSERT INTO image_vectors (image_id, product_id, vector, model_name)
    VALUES (@image_id, @product_id, @vector, @model_name)
  `)

  let totalImages = 0

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i]
    const parsed = parseProductName(raw.商品名)
    const condition = parseCondition(raw.状態)
    const category = normalizeCategory(raw.カテゴリ_サブ)
    const price = raw.販売価格 ?? generateDemoPrice(raw.ブランド, category, i)

    const product = {
      brand: raw.ブランド,
      category,
      model: buildModel(raw.ブランド, raw.カテゴリ_詳細, parsed.model),
      size: raw.サイズ,
      color: raw.色 || parsed.color,
      material: raw.素材 || parsed.material,
      condition,
      price,
      notes: raw.そのほかコメント
    }

    const result = insertProduct.run(product)
    const productId = result.lastInsertRowid as number

    const localFiles = findLocalImages(seedImagesDir, raw.index)
    const productImagesDir = path.join(imagesDir, String(productId))
    fs.mkdirSync(productImagesDir, { recursive: true })

    for (let j = 0; j < localFiles.length; j++) {
      const srcFile = path.join(seedImagesDir, localFiles[j])
      const destPath = path.join(productImagesDir, `${j + 1}.jpg`)
      fs.copyFileSync(srcFile, destPath)

      let vector: number[]
      try {
        vector = await extractFeaturesV2FromFile(destPath)
      } catch {
        vector = new Array(FEATURE_DIM_V2).fill(0)
      }

      const imageType = imageTypeOrder[j] || 'other'
      const imgResult = insertImage.run({
        product_id: productId,
        image_path: destPath,
        image_type: imageType,
        order_index: j + 1
      })
      const imageId = imgResult.lastInsertRowid as number

      insertVector.run({
        image_id: imageId,
        product_id: productId,
        vector: vectorToBuffer(vector),
        model_name: SEED_MODEL
      })

      totalImages++
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  ${i + 1}/${rawItems.length} products (${totalImages} images)`)
    }
  }

  console.log(`\nDone! Seeded ${rawItems.length} products with ${totalImages} images.`)

  const stats = db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number }
  const imgStats = db.prepare('SELECT COUNT(*) as cnt FROM product_images').get() as { cnt: number }
  const vecStats = db.prepare('SELECT COUNT(*) as cnt FROM image_vectors').get() as { cnt: number }
  console.log(`  Products: ${stats.cnt}`)
  console.log(`  Images: ${imgStats.cnt}`)
  console.log(`  Vectors: ${vecStats.cnt}`)

  db.close()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
