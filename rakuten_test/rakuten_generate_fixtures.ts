/**
 * enriched_products.json から OCR テスト用 fixture を生成する。
 * 実際のタグを OCR で読み取ったような生テキストをシミュレートし、
 * normalizeOcrText() に通してテストする。
 *
 * 使い方:
 *   npx tsx rakuten_test/rakuten_generate_fixtures.ts
 */
import * as fs from 'fs'
import * as path from 'path'

const DATA_DIR = path.resolve(__dirname, 'data')
const INPUT = path.join(DATA_DIR, 'enriched_products.json')
const OUTPUT = path.join(DATA_DIR, 'ocr_fixtures.json')

interface EnrichedProduct {
  index: number
  brand: string
  price: string
  imageUrl: string
  localImage: string
  detailUrl: string
  productName: string
  material: string
  size: string[]
  color: string
  category: string
  rawTexts: string[]
}

export interface OcrTestFixture {
  id: number
  source: string
  brandClean: string
  categoryClean: string
  productNameClean: string
  materialClean: string
  colorClean: string
  sizeClean: string
  simulatedOcrText: string
  localImage: string
}

function extractBrand(rawTexts: string[]): string {
  const brandLine = rawTexts.find(
    (t) => /\(.+\)/.test(t) && !t.includes('楽天') && !t.includes('ポイント')
  )
  if (!brandLine) return ''
  const m = brandLine.match(/^([^(]+)/)
  return m ? m[1].trim() : brandLine
}

function extractProductName(rawTexts: string[]): string {
  const skip = [
    '楽天',
    'Rakuten',
    'Fashion',
    'アプリ',
    'ポイント',
    'エントリー',
    'keyboard',
    'から探す',
    'すべて',
    'ショップ',
    'ブランド',
    'カテゴリ',
    'セール',
    'もれなく',
    '送料無料'
  ]
  return (
    rawTexts.find(
      (t) =>
        (t.startsWith('【') || t.startsWith('『') || t.startsWith('＜')) &&
        t.length > 5 &&
        !skip.some((s) => t.includes(s))
    ) ??
    rawTexts.find(
      (t) => t.length >= 10 && t.length <= 60 && !skip.some((s) => t.includes(s))
    ) ??
    ''
  )
}

function extractCategory(rawTexts: string[]): string {
  const cats = [
    'バッグ',
    'シューズ',
    'ジャケット',
    'トップス',
    'パンツ',
    'ワンピース',
    'スカート',
    'アクセサリー',
    '財布',
    '帽子',
    'インナー',
    '靴下',
    'トレンチコート',
    'ハンドバッグ',
    'スニーカー',
    'ネックレス',
    'リング'
  ]
  return rawTexts.find((t) => cats.some((c) => t.includes(c))) ?? ''
}

const OCR_TYPOS: Record<string, string> = {
  COTTON: 'COTON',
  POLYESTER: 'POLIESTER',
  LEATHER: 'LEATER',
  NYLON: 'NAILON'
}

const SIZES = ['FREE', 'S', 'M', 'L', 'XL', '36', '38', '40', '42']

function simulateOcrText(fixture: {
  brandClean: string
  productNameClean: string
  materialClean: string
  colorClean: string
  sizeClean: string
  index: number
}): string {
  const lines: string[] = []

  if (fixture.brandClean) {
    const brand = fixture.brandClean.toUpperCase()
    lines.push(fixture.index % 5 === 0 ? brand.replace(/\s/g, '  ') : brand)
  }

  if (fixture.sizeClean) {
    if (fixture.index % 3 === 0) {
      lines.push(fixture.sizeClean.replace('L', 'L ').replace('S', 'S ').trim())
    } else {
      lines.push(fixture.sizeClean)
    }
  }

  if (fixture.materialClean) {
    let mat = fixture.materialClean.toUpperCase()
    if (fixture.index % 4 === 0) {
      for (const [correct, typo] of Object.entries(OCR_TYPOS)) {
        mat = mat.replace(correct, typo)
      }
    }
    lines.push(mat)
  }

  if (fixture.colorClean) {
    lines.push(fixture.colorClean)
  }

  if (fixture.index % 6 === 0) {
    lines.push('---', '%%%', '##')
  }

  lines.push('MADE IN JAPAN')

  return lines.join('\n')
}

function main(): void {
  const products: EnrichedProduct[] = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))

  const fixtures: OcrTestFixture[] = products.map((p) => {
    const brandClean = extractBrand(p.rawTexts)
    const categoryClean = extractCategory(p.rawTexts)
    const productNameClean = extractProductName(p.rawTexts)

    let materialClean = ''
    if (p.material && p.material.length < 30 && !p.material.includes('、')) {
      materialClean = p.material
    }

    const colorClean = p.color && p.color.length < 20 ? p.color : ''
    const sizeClean = SIZES[p.index % SIZES.length]

    const base = {
      brandClean,
      categoryClean,
      productNameClean,
      materialClean,
      colorClean,
      sizeClean,
      index: p.index
    }

    return {
      id: p.index,
      source: p.detailUrl,
      ...base,
      simulatedOcrText: simulateOcrText(base),
      localImage: p.localImage
    }
  })

  fs.writeFileSync(OUTPUT, JSON.stringify(fixtures, null, 2))

  console.log(`Generated ${fixtures.length} OCR fixtures → ${OUTPUT}`)
  console.log('\nSample fixtures:')
  fixtures.slice(0, 3).forEach((f) => {
    console.log(`\n--- #${f.id} ---`)
    console.log(`Brand: ${f.brandClean}`)
    console.log(`Category: ${f.categoryClean}`)
    console.log(`OCR text:\n${f.simulatedOcrText}`)
  })
}

main()
