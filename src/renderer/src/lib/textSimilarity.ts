import type { Product, SearchResult, MatchSource } from '@shared/types'

export interface OcrFields {
  brand: string | null
  category: string | null
  model: string | null
  size: string | null
  material: string[] | null
}

export interface ConflictInfo {
  hasConflict: boolean
  visualTopProduct: Product | null
  tagTopProduct: Product | null
  message: string | null
}

const FIELD_WEIGHTS_DEFAULT = {
  brand: 0.4,
  category: 0.3,
  model: 0.2,
  size: 0.05,
  material: 0.05
} as const

const FIELD_WEIGHTS_TAG_MODE = {
  model: 0.45,
  brand: 0.30,
  category: 0.15,
  size: 0.05,
  material: 0.05
} as const

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_./]+/g, '').trim()
}

function fuzzyContains(a: string, b: string): boolean {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return false
  return na.includes(nb) || nb.includes(na)
}

function brandMatch(ocrBrand: string, productBrand: string): number {
  if (!ocrBrand || !productBrand) return 0
  const a = normalize(ocrBrand)
  const b = normalize(productBrand)
  if (a === b) return 1.0
  if (fuzzyContains(ocrBrand, productBrand)) return 0.8
  return 0
}

function categoryMatch(ocrCategory: string, productCategory: string): number {
  if (!ocrCategory || !productCategory) return 0
  if (normalize(ocrCategory) === normalize(productCategory)) return 1.0
  if (fuzzyContains(ocrCategory, productCategory)) return 0.6
  return 0
}

function modelMatch(ocrModel: string, productModel: string): number {
  if (!ocrModel || !productModel) return 0
  if (normalize(ocrModel) === normalize(productModel)) return 1.0
  if (fuzzyContains(ocrModel, productModel)) return 0.7
  return 0
}

function materialMatch(ocrMaterials: string[], productMaterial: string): number {
  if (!ocrMaterials.length || !productMaterial) return 0
  const pm = normalize(productMaterial)
  for (const m of ocrMaterials) {
    if (fuzzyContains(m, productMaterial)) return 1.0
    if (pm.includes(normalize(m))) return 0.7
  }
  return 0
}

export function computeTextSimilarity(
  ocr: OcrFields,
  product: Product,
  tagMode: boolean = false
): number {
  const weights = tagMode ? FIELD_WEIGHTS_TAG_MODE : FIELD_WEIGHTS_DEFAULT
  let weightedScore = 0
  let activeWeight = 0

  if (ocr.brand) {
    activeWeight += weights.brand
    weightedScore += weights.brand * brandMatch(ocr.brand, product.brand)
  }

  if (ocr.category) {
    activeWeight += weights.category
    weightedScore += weights.category * categoryMatch(ocr.category, product.category)
  }

  if (ocr.model) {
    activeWeight += weights.model
    weightedScore += weights.model * modelMatch(ocr.model, product.model)
  }

  if (ocr.size) {
    activeWeight += weights.size
    weightedScore +=
      weights.size * (normalize(ocr.size) === normalize(product.size) ? 1.0 : 0)
  }

  if (ocr.material && ocr.material.length > 0) {
    activeWeight += weights.material
    weightedScore += weights.material * materialMatch(ocr.material, product.material)
  }

  if (activeWeight === 0) return 0
  return weightedScore / activeWeight
}

const VISUAL_WEIGHT_DEFAULT = 0.6
const TEXT_WEIGHT_DEFAULT = 0.4

const VISUAL_WEIGHT_TAG = 0.2
const TEXT_WEIGHT_TAG = 0.8

export interface BoostOptions {
  hasTag: boolean
}

/**
 * 3-layer scoring: re-rank search results depending on tag availability.
 *
 * Layer 2 (tag mode):  visual * 0.2 + text * 0.8 with tag-optimized field weights.
 * Layer 3 (fallback):  visual * 0.6 + text * 0.4 with default field weights.
 *
 * Layer 1 (model shortcut) is handled externally via db:search-by-model before
 * this function is called.
 */
export function boostResultsWithText(
  results: SearchResult[],
  ocr: OcrFields | null,
  options: BoostOptions = { hasTag: false }
): SearchResult[] {
  if (!ocr || (!ocr.brand && !ocr.category && !ocr.model && !ocr.size && !ocr.material?.length)) {
    return results
  }

  const tagMode = options.hasTag
  const visualWeight = tagMode ? VISUAL_WEIGHT_TAG : VISUAL_WEIGHT_DEFAULT
  const textWeight = tagMode ? TEXT_WEIGHT_TAG : TEXT_WEIGHT_DEFAULT
  const matchSource: MatchSource = tagMode ? 'tag_text' : 'visual'

  const boosted = results.map((result) => {
    if (result.matchSource === 'model_exact' || result.matchSource === 'model_prefix') {
      return result
    }

    const textScore = computeTextSimilarity(ocr, result.product, tagMode)
    const boostedSimilarity = result.similarity * visualWeight + textScore * textWeight

    const matchReasons = [...result.matchReasons]
    if (tagMode && textScore > 0.3) {
      matchReasons.push('タグ情報一致')
    } else if (textScore > 0.5) {
      matchReasons.push('テキスト情報一致')
    }

    return {
      ...result,
      similarity: boostedSimilarity,
      matchReasons,
      matchSource,
      confidence:
        boostedSimilarity >= 0.85
          ? ('high' as const)
          : boostedSimilarity >= 0.7
            ? ('medium' as const)
            : boostedSimilarity >= 0.5
              ? ('low' as const)
              : ('weak' as const)
    }
  })

  return boosted.sort((a, b) => b.similarity - a.similarity)
}

/**
 * Merge Layer 1 model-match results with visual search results.
 * Model matches are placed at the top; duplicates from visual are removed.
 */
export function mergeModelResults(
  modelResults: SearchResult[],
  visualResults: SearchResult[]
): SearchResult[] {
  const modelProductIds = new Set(modelResults.map((r) => r.product.id))
  const filtered = visualResults.filter((r) => !modelProductIds.has(r.product.id))
  return [...modelResults, ...filtered]
}

/**
 * Detect conflict between visual top-1 and tag-driven top-1.
 */
export function detectConflict(
  visualResults: SearchResult[],
  finalResults: SearchResult[]
): ConflictInfo {
  const empty: ConflictInfo = {
    hasConflict: false,
    visualTopProduct: null,
    tagTopProduct: null,
    message: null
  }

  const visualTop = visualResults[0]
  const finalTop = finalResults[0]

  if (!visualTop || !finalTop) return empty

  if (
    visualTop.product.id !== finalTop.product.id &&
    visualTop.similarity >= 0.7 &&
    finalTop.matchSource !== 'visual'
  ) {
    const tagLabel = [finalTop.product.brand, finalTop.product.model].filter(Boolean).join(' ')
    const visualLabel = [visualTop.product.brand, visualTop.product.model].filter(Boolean).join(' ')

    return {
      hasConflict: true,
      visualTopProduct: visualTop.product,
      tagTopProduct: finalTop.product,
      message: `タグ情報は「${tagLabel}」を示していますが、画像は「${visualLabel}」に最も類似しています。確認してください。`
    }
  }

  return empty
}
