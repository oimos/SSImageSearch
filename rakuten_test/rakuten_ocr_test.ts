/**
 * Rakuten 商品データから生成した疑似 OCR テキストを normalizeOcrText() に通し、
 * mock モードと real LLM (cheap) モードの両方でテストする。
 *
 * 使い方:
 *   npx tsx rakuten_test/rakuten_ocr_test.ts           # mock + LLM 両方
 *   npx tsx rakuten_test/rakuten_ocr_test.ts --mock     # mock のみ
 *   npx tsx rakuten_test/rakuten_ocr_test.ts --llm      # LLM のみ
 */
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'

const DATA_DIR = path.resolve(__dirname, 'data')
const FIXTURES_PATH = path.join(DATA_DIR, 'ocr_fixtures.json')
const RESULTS_PATH = path.join(DATA_DIR, 'ocr_test_results.json')

interface OcrTestFixture {
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

interface TestResult {
  id: number
  mode: string
  input: string
  brand: string | null
  size: string | null
  material: string[] | null
  model: string | null
  other_text: string[]
  confidence: number
  expectedBrand: string
  brandMatch: boolean
  expectedSize: string
  sizeMatch: boolean
  durationMs: number
}

async function runTest(
  fixture: OcrTestFixture,
  mode: 'mock' | 'cheap'
): Promise<TestResult> {
  process.env.LLM_MODE = mode

  // Dynamic import to pick up the env change
  const { normalizeOcrText } = await import('../src/main/services/ocrNormalizer')
  const start = Date.now()
  const result = await normalizeOcrText(fixture.simulatedOcrText)
  const durationMs = Date.now() - start

  const r = result as {
    brand: string | null
    size: string | null
    material: string[] | null
    model: string | null
    other_text: string[]
    confidence: number
  }

  const normBrand = (s: string): string => s.replace(/\s+/g, ' ').trim().toUpperCase()
  const brandMatch =
    !fixture.brandClean ||
    normBrand(r.brand ?? '') === normBrand(fixture.brandClean)
  const sizeMatch =
    !fixture.sizeClean ||
    (r.size?.replace(/\s/g, '').toUpperCase() ?? '') ===
      fixture.sizeClean.replace(/\s/g, '').toUpperCase()

  return {
    id: fixture.id,
    mode,
    input: fixture.simulatedOcrText,
    brand: r.brand,
    size: r.size,
    material: r.material,
    model: r.model,
    other_text: r.other_text,
    confidence: r.confidence,
    expectedBrand: fixture.brandClean,
    brandMatch,
    expectedSize: fixture.sizeClean,
    sizeMatch,
    durationMs
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const mockOnly = args.includes('--mock')
  const llmOnly = args.includes('--llm')
  const runMock = !llmOnly
  const runLlm = !mockOnly

  const fixtures: OcrTestFixture[] = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8'))
  const allResults: TestResult[] = []

  if (runMock) {
    console.log('\n========== MOCK MODE ==========\n')
    for (const f of fixtures) {
      const r = await runTest(f, 'mock')
      allResults.push(r)
      const status = r.brandMatch && r.sizeMatch ? '✓' : '✗'
      console.log(
        `  ${status} #${String(r.id).padStart(2)} | brand: ${String(r.brand).padEnd(20)} (exp: ${r.expectedBrand.padEnd(20)}) | size: ${String(r.size).padEnd(4)} | conf: ${r.confidence.toFixed(2)} | ${r.durationMs}ms`
      )
    }
    const mockResults = allResults.filter((r) => r.mode === 'mock')
    const brandOk = mockResults.filter((r) => r.brandMatch).length
    const sizeOk = mockResults.filter((r) => r.sizeMatch).length
    console.log(
      `\n  Mock summary: brand ${brandOk}/${mockResults.length}, size ${sizeOk}/${mockResults.length}`
    )
  }

  if (runLlm) {
    console.log('\n========== LLM (cheap) MODE ==========\n')
    const llmSubset = fixtures.slice(0, 10)
    console.log(`  Running ${llmSubset.length} fixtures through gpt-4.1-nano...\n`)

    for (const f of llmSubset) {
      try {
        const r = await runTest(f, 'cheap')
        allResults.push(r)
        const status = r.brandMatch && r.sizeMatch ? '✓' : '✗'
        console.log(
          `  ${status} #${String(r.id).padStart(2)} | brand: ${String(r.brand).padEnd(20)} (exp: ${r.expectedBrand.padEnd(20)}) | size: ${String(r.size).padEnd(4)} | conf: ${r.confidence.toFixed(2)} | ${r.durationMs}ms`
        )
      } catch (err) {
        console.error(`  ✗ #${f.id} ERROR:`, (err as Error).message)
      }
    }
    const llmResults = allResults.filter((r) => r.mode === 'cheap')
    const brandOk = llmResults.filter((r) => r.brandMatch).length
    const sizeOk = llmResults.filter((r) => r.sizeMatch).length
    console.log(
      `\n  LLM summary: brand ${brandOk}/${llmResults.length}, size ${sizeOk}/${llmResults.length}`
    )
  }

  fs.writeFileSync(RESULTS_PATH, JSON.stringify(allResults, null, 2))
  console.log(`\nAll results saved to ${RESULTS_PATH}`)
}

main().catch((err) => {
  console.error('Test runner failed:', err)
  process.exit(1)
})
