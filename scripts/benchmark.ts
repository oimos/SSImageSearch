/**
 * Offline benchmark for retrieval pipeline evaluation.
 *
 * Compares V1 (legacy 512-dim), V2 (768-dim handcrafted), and optionally
 * CLIP (512-dim) + Hybrid (0.7*CLIP + 0.3*V2) pipelines.
 *
 * Usage:
 *   npx tsx scripts/benchmark.ts
 *   npx tsx scripts/benchmark.ts --with-clip   (requires model download, ~85 MB)
 */

import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { extractFeaturesV2FromPixels, GRID_V2 } from '../src/shared/featureExtraction'

// -----------------------------------------------------------------------
// Feature extraction
// -----------------------------------------------------------------------

async function extractV2(filePath: string): Promise<number[]> {
  const { data } = await sharp(filePath)
    .resize(GRID_V2, GRID_V2, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return extractFeaturesV2FromPixels(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  )
}

async function extractV1(filePath: string): Promise<number[]> {
  const GRID = 13
  const { data } = await sharp(filePath)
    .resize(GRID, GRID, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const features: number[] = []
  let sr = 0, sg = 0, sb = 0
  const n = GRID * GRID
  for (let i = 0; i < n; i++) {
    const r = data[i * 3] / 128 - 1
    const g = data[i * 3 + 1] / 128 - 1
    const b = data[i * 3 + 2] / 128 - 1
    features.push(r, g, b)
    sr += r; sg += g; sb += b
  }
  const mr = sr / n, mg = sg / n, mb = sb / n
  features.push(mr, mg, mb)
  let vr = 0, vg = 0
  for (let i = 0; i < n; i++) {
    vr += (features[i * 3] - mr) ** 2
    vg += (features[i * 3 + 1] - mg) ** 2
  }
  features.push(Math.sqrt(vr / n), Math.sqrt(vg / n))
  const norm = Math.sqrt(features.reduce((s, x) => s + x * x, 0))
  return norm > 0 ? features.map((x) => x / norm) : features
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// -----------------------------------------------------------------------
// Catalog
// -----------------------------------------------------------------------

interface CatalogEntry {
  productIndex: number
  imageIndex: number
  filePath: string
  v1?: number[]
  v2?: number[]
  clip?: number[]
}

async function buildCatalog(seedImagesDir: string, withClip: boolean): Promise<CatalogEntry[]> {
  const catalog: CatalogEntry[] = []
  const dirs = fs
    .readdirSync(seedImagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => parseInt(a) - parseInt(b))

  let clipExtract: ((fp: string) => Promise<number[] | null>) | null = null
  if (withClip) {
    try {
      const { pipeline, env, RawImage } = await import('@huggingface/transformers')
      const cacheDir = path.join(process.cwd(), '.cache', 'models')
      fs.mkdirSync(cacheDir, { recursive: true })
      env.cacheDir = cacheDir
      console.log('  Loading CLIP model...')
      const extractor = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', {
        dtype: 'fp32'
      })
      console.log('  CLIP model loaded.')

      clipExtract = async (fp: string): Promise<number[] | null> => {
        try {
          const img = await RawImage.fromSharp(
            sharp(fp).resize(224, 224, { fit: 'cover' }).removeAlpha()
          )
          const result = await (extractor as any)(img, { pooling: 'mean', normalize: true })
          const vecs = result.tolist()
          if (!vecs.length || !vecs[0].length) return null
          const vec = vecs[0] as number[]
          const norm = Math.sqrt(vec.reduce((s: number, x: number) => s + x * x, 0))
          return norm > 0 ? vec.map((x: number) => x / norm) : vec
        } catch {
          return null
        }
      }
    } catch (err) {
      console.warn('  CLIP model failed to load:', err instanceof Error ? err.message : err)
      withClip = false
    }
  }

  for (const dir of dirs) {
    const prodIdx = parseInt(dir)
    const prodDir = path.join(seedImagesDir, dir)
    const files = fs
      .readdirSync(prodDir)
      .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort()

    for (let imgIdx = 0; imgIdx < files.length; imgIdx++) {
      const filePath = path.join(prodDir, files[imgIdx])
      try {
        const entry: CatalogEntry = { productIndex: prodIdx, imageIndex: imgIdx, filePath }
        entry.v1 = await extractV1(filePath)
        entry.v2 = await extractV2(filePath)
        if (clipExtract) {
          entry.clip = (await clipExtract(filePath)) ?? undefined
        }
        catalog.push(entry)
      } catch {
        console.warn(`  skip: ${filePath}`)
      }
    }
  }
  return catalog
}

// -----------------------------------------------------------------------
// Retrieval evaluation
// -----------------------------------------------------------------------

type VectorKey = 'v1' | 'v2' | 'clip' | 'hybrid'

interface QueryResult {
  rank: number | null
}

function evaluate(
  catalog: CatalogEntry[],
  mode: VectorKey,
  topK: number
): QueryResult[] {
  const results: QueryResult[] = []

  for (const entry of catalog) {
    const scores = new Map<number, number>()

    for (const c of catalog) {
      if (c.filePath === entry.filePath) continue

      let sim: number
      if (mode === 'hybrid') {
        const clipSim =
          entry.clip && c.clip ? cosineSim(entry.clip, c.clip) : 0
        const v2Sim =
          entry.v2 && c.v2 ? cosineSim(entry.v2, c.v2) : 0
        const hasClip = !!entry.clip && !!c.clip
        sim = hasClip ? 0.7 * clipSim + 0.3 * v2Sim : v2Sim
      } else {
        const a = entry[mode]
        const b = c[mode]
        if (!a || !b) continue
        sim = cosineSim(a, b)
      }

      const existing = scores.get(c.productIndex)
      if (existing === undefined || sim > existing) {
        scores.set(c.productIndex, sim)
      }
    }

    const ranked = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)

    const rankIdx = ranked.findIndex((r) => r[0] === entry.productIndex)
    results.push({ rank: rankIdx >= 0 ? rankIdx + 1 : null })
  }

  return results
}

// -----------------------------------------------------------------------
// Metrics
// -----------------------------------------------------------------------

function metrics(results: QueryResult[], K: number[]) {
  const out: Record<string, string> = {}
  const total = results.length
  let mrr = 0

  for (const k of K) {
    let count = 0
    for (const r of results) {
      if (r.rank !== null && r.rank <= k) count++
    }
    out[`Recall@${k}`] = `${((count / total) * 100).toFixed(1)}%`
  }

  for (const r of results) {
    if (r.rank !== null) mrr += 1 / r.rank
  }
  out['MRR'] = (mrr / total).toFixed(4)
  out['Total'] = String(total)
  return out
}

function simDistribution(
  catalog: CatalogEntry[],
  key: VectorKey,
  limit = 100
): { sameAvg: number; diffAvg: number; gap: number } {
  const same: number[] = []
  const diff: number[] = []
  const n = Math.min(catalog.length, limit)

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let sim: number
      if (key === 'hybrid') {
        const cs = catalog[i].clip && catalog[j].clip
          ? cosineSim(catalog[i].clip!, catalog[j].clip!) : 0
        const vs = catalog[i].v2 && catalog[j].v2
          ? cosineSim(catalog[i].v2!, catalog[j].v2!) : 0
        sim = cs > 0 ? 0.7 * cs + 0.3 * vs : vs
      } else {
        const a = catalog[i][key]
        const b = catalog[j][key]
        if (!a || !b) continue
        sim = cosineSim(a, b)
      }
      if (catalog[i].productIndex === catalog[j].productIndex) {
        same.push(sim)
      } else {
        diff.push(sim)
      }
    }
  }

  const sameAvg = same.length > 0 ? same.reduce((a, b) => a + b, 0) / same.length : 0
  const diffAvg = diff.length > 0 ? diff.reduce((a, b) => a + b, 0) / diff.length : 0
  return { sameAvg, diffAvg, gap: sameAvg - diffAvg }
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------

async function main() {
  const withClip = process.argv.includes('--with-clip')

  console.log('=== Retrieval Pipeline Benchmark ===')
  console.log(`  Modes: V1, V2${withClip ? ', CLIP, Hybrid' : ''}\n`)

  const candidateDirs = [
    path.join(process.cwd(), 'seed-data', 'images'),
    path.join(process.env.HOME ?? '', 'Library/Application Support/ss-image-search/images')
  ]
  const seedImagesDir = candidateDirs.find((d) => fs.existsSync(d))

  if (!seedImagesDir) {
    console.error('No seed images found.')
    process.exit(1)
  }

  console.log(`Seed: ${seedImagesDir}`)
  console.log('Building catalog...')
  const catalog = await buildCatalog(seedImagesDir, withClip)
  const products = new Set(catalog.map((c) => c.productIndex)).size
  console.log(`Catalog: ${catalog.length} images, ${products} products\n`)

  const TOP_K = 10
  const ks = [1, 3, 5, 10]

  const modes: VectorKey[] = ['v1', 'v2']
  if (withClip) modes.push('clip', 'hybrid')

  for (const mode of modes) {
    console.log(`--- ${mode.toUpperCase()} ---`)
    const results = evaluate(catalog, mode, TOP_K)
    const m = metrics(results, ks)
    for (const [k, v] of Object.entries(m)) console.log(`  ${k}: ${v}`)

    const dist = simDistribution(catalog, mode)
    console.log(`  Same-product avg sim: ${dist.sameAvg.toFixed(3)}`)
    console.log(`  Diff-product avg sim: ${dist.diffAvg.toFixed(3)}`)
    console.log(`  Gap: ${dist.gap.toFixed(3)}`)
    console.log()
  }

  console.log('Done.')
}

main().catch(console.error)
