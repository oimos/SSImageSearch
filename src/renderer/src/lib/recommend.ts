import type { SearchResult, ProductFormData, RecommendedField } from '@shared/types'

type FieldKey = keyof ProductFormData

const STRING_FIELDS: FieldKey[] = ['brand', 'category', 'model', 'size', 'color', 'material', 'condition', 'notes']
const NUMERIC_FIELDS: FieldKey[] = ['price']

function weightedMajority(
  candidates: SearchResult[],
  field: FieldKey
): { value: string | number; confidence: number; sources: number } | null {
  if (candidates.length === 0) return null

  const counts = new Map<string | number, { weight: number; count: number }>()

  for (const c of candidates) {
    const val = c.product[field]
    if (val === undefined || val === null || val === '') continue
    const existing = counts.get(val) || { weight: 0, count: 0 }
    existing.weight += c.similarity
    existing.count += 1
    counts.set(val, existing)
  }

  if (counts.size === 0) return null

  let best: { value: string | number; weight: number; count: number } | null = null
  let totalWeight = 0

  for (const [value, { weight, count }] of counts) {
    totalWeight += weight
    if (!best || weight > best.weight) {
      best = { value, weight, count }
    }
  }

  if (!best) return null

  const confidence = totalWeight > 0 ? best.weight / totalWeight : 0
  return { value: best.value, confidence, sources: best.count }
}

export function generateRecommendations(candidates: SearchResult[]): RecommendedField[] {
  const fields: FieldKey[] = [...STRING_FIELDS, ...NUMERIC_FIELDS]
  const recommendations: RecommendedField[] = []

  for (const field of fields) {
    const result = weightedMajority(candidates, field)
    if (result) {
      recommendations.push({
        field,
        value: result.value,
        confidence: result.confidence,
        sources: result.sources
      })
    }
  }

  return recommendations
}

export function applyRecommendations(
  recommendations: RecommendedField[],
  selectedFields: Set<string>
): { formData: Partial<ProductFormData>; confidences: Record<string, number> } {
  const formData: Partial<ProductFormData> = {}
  const confidences: Record<string, number> = {}

  for (const rec of recommendations) {
    if (selectedFields.has(rec.field)) {
      ;(formData as Record<string, string | number>)[rec.field] = rec.value
      confidences[rec.field] = rec.confidence
    }
  }

  return { formData, confidences }
}
