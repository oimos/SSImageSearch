import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getDatabase } from './connection'
import { generateProductVector, vectorToBuffer } from '@shared/vectors'

interface SeedProduct {
  brand: string
  category: string
  model: string
  size: string
  color: string
  material: string
  condition: string
  price: number
  notes: string
}

const BRAND_COLORS: Record<string, string> = {
  GUCCI: '#1B5E20',
  'LOUIS VUITTON': '#4E342E',
  CHANEL: '#212121',
  PRADA: '#1A237E',
  HERMES: '#E65100',
  BURBERRY: '#BF360C'
}

const SEED_PRODUCTS: SeedProduct[] = [
  { brand: 'GUCCI', category: 'バッグ', model: 'GG Marmont ショルダーバッグ', size: 'M', color: 'ブラック', material: 'レザー', condition: 'A', price: 85000, notes: '金具に微小な擦れあり' },
  { brand: 'GUCCI', category: 'ジャケット', model: 'ウールブレザー', size: 'L', color: 'ネイビー', material: 'ウール', condition: 'B', price: 42000, notes: '袖口にやや毛羽立ち' },
  { brand: 'GUCCI', category: 'シューズ', model: 'ホースビットローファー', size: '26.0', color: 'ブラウン', material: 'レザー', condition: 'A', price: 38000, notes: 'ソールの減りわずか' },
  { brand: 'GUCCI', category: 'アクセサリー', model: 'GGベルト', size: '85', color: 'ブラック', material: 'レザー', condition: 'S', price: 32000, notes: '未使用に近い' },
  { brand: 'GUCCI', category: '財布', model: 'GGマーモント長財布', size: 'FREE', color: 'レッド', material: 'レザー', condition: 'B', price: 28000, notes: '角にスレあり' },
  { brand: 'LOUIS VUITTON', category: 'バッグ', model: 'スピーディ25', size: 'ONE', color: 'モノグラム', material: 'キャンバス', condition: 'A', price: 95000, notes: 'ハンドルにアメ色変化' },
  { brand: 'LOUIS VUITTON', category: 'ジャケット', model: 'デニムジャケット', size: 'M', color: 'インディゴ', material: 'デニム', condition: 'B', price: 55000, notes: '色落ちあり（味として良好）' },
  { brand: 'LOUIS VUITTON', category: 'シューズ', model: 'ランアウェイスニーカー', size: '27.0', color: 'ホワイト', material: 'レザー', condition: 'B', price: 35000, notes: 'ソール汚れあり' },
  { brand: 'LOUIS VUITTON', category: 'アクセサリー', model: 'モノグラムスカーフ', size: 'FREE', color: 'マルチ', material: 'シルク', condition: 'A', price: 25000, notes: '目立つ汚れなし' },
  { brand: 'LOUIS VUITTON', category: '財布', model: 'ジッピーウォレット', size: 'FREE', color: 'ダミエ', material: 'キャンバス', condition: 'A', price: 45000, notes: 'ファスナー動作良好' },
  { brand: 'CHANEL', category: 'バッグ', model: 'マトラッセチェーンバッグ', size: 'M', color: 'ブラック', material: 'ラムスキン', condition: 'A', price: 320000, notes: 'チェーンに小傷' },
  { brand: 'CHANEL', category: 'ジャケット', model: 'ツイードジャケット', size: '38', color: 'ピンク', material: 'ツイード', condition: 'S', price: 180000, notes: 'タグ付き未使用' },
  { brand: 'CHANEL', category: 'シューズ', model: 'バレリーナフラット', size: '37', color: 'ベージュ', material: 'レザー', condition: 'B', price: 42000, notes: 'つま先に擦れ' },
  { brand: 'CHANEL', category: 'アクセサリー', model: 'ココマークネックレス', size: 'FREE', color: 'ゴールド', material: 'メタル', condition: 'A', price: 55000, notes: '輝き良好' },
  { brand: 'CHANEL', category: '財布', model: 'キャビアスキン二つ折り', size: 'FREE', color: 'ブラック', material: 'キャビアスキン', condition: 'B', price: 48000, notes: '内側にやや汚れ' },
  { brand: 'PRADA', category: 'バッグ', model: 'リナイロンバックパック', size: 'L', color: 'ブラック', material: 'ナイロン', condition: 'A', price: 68000, notes: '底面に微小な擦れ' },
  { brand: 'PRADA', category: 'ジャケット', model: 'ナイロンブルゾン', size: 'M', color: 'ネイビー', material: 'ナイロン', condition: 'B', price: 45000, notes: '袖口に使用感' },
  { brand: 'PRADA', category: 'シューズ', model: 'クラウドバストサンダー', size: '27.0', color: 'ホワイト', material: 'レザー/ラバー', condition: 'A', price: 52000, notes: 'ソール良好' },
  { brand: 'PRADA', category: 'アクセサリー', model: 'サフィアーノベルト', size: '90', color: 'ブラック', material: 'サフィアーノレザー', condition: 'A', price: 28000, notes: '状態良好' },
  { brand: 'PRADA', category: '財布', model: 'サフィアーノ長財布', size: 'FREE', color: 'ブルー', material: 'サフィアーノレザー', condition: 'B', price: 32000, notes: 'カード入れにスレ' },
  { brand: 'HERMES', category: 'バッグ', model: 'バーキン25', size: 'ONE', color: 'エトゥープ', material: 'トゴ', condition: 'A', price: 1200000, notes: '刻印Y' },
  { brand: 'HERMES', category: 'ジャケット', model: 'カシミアコート', size: '38', color: 'キャメル', material: 'カシミア', condition: 'A', price: 280000, notes: '着用数回' },
  { brand: 'HERMES', category: 'シューズ', model: 'オランサンダル', size: '37', color: 'ゴールド', material: 'レザー', condition: 'B', price: 45000, notes: 'フットベッドに足跡' },
  { brand: 'HERMES', category: 'アクセサリー', model: 'カレ90スカーフ', size: 'FREE', color: 'マルチ', material: 'シルク', condition: 'S', price: 38000, notes: '箱付き' },
  { brand: 'HERMES', category: '財布', model: 'ベアン二つ折り', size: 'FREE', color: 'エトゥープ', material: 'エプソン', condition: 'A', price: 85000, notes: '金具に微小傷' },
  { brand: 'BURBERRY', category: 'バッグ', model: 'TBモノグラムトート', size: 'L', color: 'ベージュ', material: 'キャンバス', condition: 'B', price: 48000, notes: '持ち手に使用感' },
  { brand: 'BURBERRY', category: 'ジャケット', model: 'トレンチコート', size: 'M', color: 'ベージュ', material: 'コットン', condition: 'A', price: 65000, notes: 'ベルト付き' },
  { brand: 'BURBERRY', category: 'シューズ', model: 'チェックスニーカー', size: '26.0', color: 'マルチ', material: 'キャンバス/レザー', condition: 'B', price: 22000, notes: 'ソールに汚れ' },
  { brand: 'BURBERRY', category: 'アクセサリー', model: 'チェックマフラー', size: 'FREE', color: 'ベージュ', material: 'カシミア', condition: 'A', price: 28000, notes: '毛玉なし' },
  { brand: 'BURBERRY', category: '財布', model: 'TBコンパクト財布', size: 'FREE', color: 'ブラック', material: 'レザー', condition: 'B', price: 18000, notes: '角にスレ' }
]

function generatePlaceholderSVG(brand: string, category: string, index: number): string {
  const bgColor = BRAND_COLORS[brand] || '#555555'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
  <rect width="400" height="400" fill="${bgColor}" rx="8"/>
  <text x="200" y="170" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="white">${brand}</text>
  <text x="200" y="215" text-anchor="middle" font-family="sans-serif" font-size="20" fill="rgba(255,255,255,0.8)">${category}</text>
  <text x="200" y="260" text-anchor="middle" font-family="sans-serif" font-size="14" fill="rgba(255,255,255,0.5)">Sample Image ${index}</text>
</svg>`
}

const SEED_MODEL = 'mock-v2'

export function seedDatabase(): void {
  const db = getDatabase()

  const hasCurrentVersion = db
    .prepare(`SELECT COUNT(*) as cnt FROM image_vectors WHERE model_name = ?`)
    .get(SEED_MODEL) as { cnt: number }

  if (hasCurrentVersion.cnt > 0) return

  // Clear stale data from older vector algorithm
  db.prepare('DELETE FROM image_vectors').run()
  db.prepare('DELETE FROM product_images').run()
  db.prepare('DELETE FROM products').run()

  const imagesDir = path.join(app.getPath('userData'), 'images')
  fs.mkdirSync(imagesDir, { recursive: true })

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

  const seedAll = db.transaction(() => {
    for (let i = 0; i < SEED_PRODUCTS.length; i++) {
      const p = SEED_PRODUCTS[i]
      const result = insertProduct.run(p)
      const productId = result.lastInsertRowid as number

      const productImagesDir = path.join(imagesDir, String(productId))
      fs.mkdirSync(productImagesDir, { recursive: true })

      const imageTypes: Array<'tag' | 'full'> = ['tag', 'full']
      for (let j = 0; j < imageTypes.length; j++) {
        const svgContent = generatePlaceholderSVG(p.brand, p.category, j + 1)
        const imagePath = path.join(productImagesDir, `${j + 1}.svg`)
        fs.writeFileSync(imagePath, svgContent, 'utf-8')

        const imgResult = insertImage.run({
          product_id: productId,
          image_path: imagePath,
          image_type: imageTypes[j],
          order_index: j + 1
        })
        const imageId = imgResult.lastInsertRowid as number

        const vector = generateProductVector(p.category, p.brand, i * 100 + j)
        insertVector.run({
          image_id: imageId,
          product_id: productId,
          vector: vectorToBuffer(vector),
          model_name: SEED_MODEL
        })
      }
    }
  })

  seedAll()
  console.log(`Seeded ${SEED_PRODUCTS.length} products with images and vectors`)
}
