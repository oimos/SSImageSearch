import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getDatabase } from './connection'
import { vectorToBuffer, hashString } from '@shared/vectors'
import { FEATURE_DIM_V2 } from '@shared/featureExtraction'
import { extractFeaturesV2FromFile } from '../services/imageVectors'

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

const COLOR_CODE_MAP: Record<string, string> = {
  BLK: 'ブラック',
  WHT: 'ホワイト',
  NVY: 'ネイビー',
  BRW: 'ブラウン',
  BEG: 'ベージュ',
  BLU: 'ブルー',
  YLW: 'イエロー',
  GRY: 'グレー',
  IVO: 'アイボリー',
  CML: 'キャメル',
  KHK: 'カーキ',
  BRD: 'ボルドー',
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
    if (!color && COLOR_CODE_MAP[part]) {
      color = COLOR_CODE_MAP[part]
      continue
    }
    if (!color && ['マルチカラー', 'グレー', 'アイボリー'].includes(part)) {
      color = part
      continue
    }

    const matMatch = KNOWN_MATERIALS.find((m) => part === m)
    if (matMatch) {
      if (!material) material = matMatch
      continue
    }

    if (SIZE_PATTERN.test(part)) continue
    if (looksLikeSerialCode(part)) continue
    if (part === '' || part === '/') continue

    descParts.push(part)
  }

  const model = descParts.join(' ') || name
  return { color, material, model }
}

function normalizeCategory(sub: string): string {
  return sub.replace(/^メンズ\s*/, '').replace(/^レディース\s*/, '')
}

function buildModel(brand: string, detail: string, parsed: string): string {
  let m = parsed
  if (m.startsWith(brand + ' ')) {
    m = m.slice(brand.length).trim()
  }
  if (detail && detail !== 'その他' && !m.includes(detail)) {
    m = `${m} (${detail})`
  }
  return m || parsed
}

function parseCondition(raw: string): string {
  const match = raw.match(/[SABCD]/)
  return match ? match[0] : 'B'
}

function generateDemoPrice(brand: string, category: string, seed: number): number {
  const rng = (s: number): number => {
    s = (s * 1664525 + 1013904223) | 0
    return (s >>> 0) / 0xffffffff
  }
  const base = rng(seed + hashString(brand))

  const rangeMap: Record<string, [number, number]> = {
    'シャツ': [3000, 25000],
    'トップス': [4000, 35000],
    'ジャケット': [8000, 50000],
    'コート': [10000, 60000],
    'ワンピース': [5000, 30000],
    'スカート': [3000, 20000],
    'シューズ': [5000, 40000]
  }
  const [min, max] = rangeMap[category] || [3000, 30000]
  return Math.round((min + base * (max - min)) / 10) * 10
}

const SEED_MODEL = 'features-v2-mens'

interface PreparedImage {
  productIdx: number
  imageIdx: number
  destPath: string
  vector: number[]
}

function findSeedDataDir(): string | null {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'seed-data', 'mens'),
    path.join(app.getAppPath(), 'seed-data', 'mens'),
    path.join(process.cwd(), 'seed-data', 'mens')
  ]
  return candidates.find((p) => fs.existsSync(path.join(p, 'products.json'))) ?? null
}

function findLocalImages(seedImagesDir: string, productIndex: number): string[] {
  const prefix = `メンズウェア_${String(productIndex).padStart(3, '0')}_`
  if (!fs.existsSync(seedImagesDir)) return []
  return fs
    .readdirSync(seedImagesDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.jpg'))
    .sort()
}

export async function seedDatabase(): Promise<void> {
  const db = getDatabase()

  const hasCurrentVersion = db
    .prepare(`SELECT COUNT(*) as cnt FROM image_vectors WHERE model_name = ?`)
    .get(SEED_MODEL) as { cnt: number }

  if (hasCurrentVersion.cnt > 0) return

  db.prepare('DELETE FROM image_vectors').run()
  db.prepare('DELETE FROM product_images').run()
  db.prepare('DELETE FROM products').run()

  const seedDir = findSeedDataDir()
  if (!seedDir) {
    console.warn('Seed data (mens) not found, skipping seed.')
    return
  }

  const seedDataPath = path.join(seedDir, 'products.json')
  const rawItems: RawSeedItem[] = JSON.parse(fs.readFileSync(seedDataPath, 'utf-8'))
  const seedImagesDir = path.join(seedDir, 'images')

  const imagesDir = path.join(app.getPath('userData'), 'images')
  fs.mkdirSync(imagesDir, { recursive: true })

  console.log(`Seeding ${rawItems.length} products from ${seedDir}...`)
  const prepared: PreparedImage[][] = []

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i]
    const productIndex = raw.index
    const localFiles = findLocalImages(seedImagesDir, productIndex)

    const productImagesDir = path.join(imagesDir, String(i + 1))
    fs.mkdirSync(productImagesDir, { recursive: true })

    const images: PreparedImage[] = []

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

      images.push({ productIdx: i, imageIdx: j, destPath, vector })
    }

    prepared.push(images)

    if ((i + 1) % 10 === 0) {
      console.log(`  Processed ${i + 1}/${rawItems.length} products...`)
    }
  }

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

  const imageTypeOrder: Array<'full' | 'detail' | 'tag' | 'logo' | 'other'> = [
    'full', 'detail', 'tag', 'logo', 'other'
  ]

  const seedAll = db.transaction(() => {
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

      for (const img of prepared[i]) {
        const imageType = imageTypeOrder[img.imageIdx] || 'other'
        const imgResult = insertImage.run({
          product_id: productId,
          image_path: img.destPath,
          image_type: imageType,
          order_index: img.imageIdx + 1
        })
        const imageId = imgResult.lastInsertRowid as number

        insertVector.run({
          image_id: imageId,
          product_id: productId,
          vector: vectorToBuffer(img.vector),
          model_name: SEED_MODEL
        })
      }
    }
  })

  seedAll()
  console.log(`Seeded ${rawItems.length} products (${prepared.reduce((s, p) => s + p.length, 0)} images) with V2 vectors`)
}
