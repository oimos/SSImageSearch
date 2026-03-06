import type { Product, SearchResult } from '@shared/types'

export interface OcrFields {
  brand: string | null
  category: string | null
  model: string | null
  size: string | null
  material: string[] | null
}

const FIELD_WEIGHTS = {
  brand: 0.4,
  category: 0.3,
  model: 0.2,
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

/**
 * Compute a 0-1 text similarity score between OCR-extracted fields and product metadata.
 * Returns 0 when no OCR fields are available (no penalty).
 */
export function computeTextSimilarity(ocr: OcrFields, product: Product): number {
  let weightedScore = 0
  let activeWeight = 0

  if (ocr.brand) {
    activeWeight += FIELD_WEIGHTS.brand
    weightedScore += FIELD_WEIGHTS.brand * brandMatch(ocr.brand, product.brand)
  }

  if (ocr.category) {
    activeWeight += FIELD_WEIGHTS.category
    weightedScore += FIELD_WEIGHTS.category * categoryMatch(ocr.category, product.category)
  }

  if (ocr.model) {
    activeWeight += FIELD_WEIGHTS.model
    weightedScore += FIELD_WEIGHTS.model * modelMatch(ocr.model, product.model)
  }

  if (ocr.size) {
    activeWeight += FIELD_WEIGHTS.size
    weightedScore +=
      FIELD_WEIGHTS.size * (normalize(ocr.size) === normalize(product.size) ? 1.0 : 0)
  }

  if (ocr.material && ocr.material.length > 0) {
    activeWeight += FIELD_WEIGHTS.material
    weightedScore += FIELD_WEIGHTS.material * materialMatch(ocr.material, product.material)
  }

  if (activeWeight === 0) return 0
  return weightedScore / activeWeight
}

const VISUAL_WEIGHT = 0.6
const TEXT_WEIGHT = 0.4

/**
 * Re-rank search results by combining visual similarity with text similarity.
 * When no OCR fields are present, visual score is used as-is.
 */
export function boostResultsWithText(
  results: SearchResult[],
  ocr: OcrFields | null
): SearchResult[] {
  if (!ocr || (!ocr.brand && !ocr.category && !ocr.model && !ocr.size && !ocr.material?.length)) {
    return results
  }

  const boosted = results.map((result) => {
    const textScore = computeTextSimilarity(ocr, result.product)
    const boostedSimilarity = result.similarity * VISUAL_WEIGHT + textScore * TEXT_WEIGHT

    const matchReasons = [...result.matchReasons]
    if (textScore > 0.5) {
      matchReasons.push('テキスト情報一致')
    }

    return {
      ...result,
      similarity: boostedSimilarity,
      matchReasons,
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
