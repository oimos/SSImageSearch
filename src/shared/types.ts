export interface Product {
  id: number
  brand: string
  category: string
  model: string
  size: string
  color: string
  material: string
  condition: string
  price: number
  notes: string
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: number
  product_id: number
  image_path: string
  image_type: ImageType
  order_index: number
  created_at: string
}

export interface ImageVector {
  id: number
  image_id: number
  product_id: number
  vector: number[]
  model_name: string
  created_at: string
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'weak'

export interface SearchResult {
  product: Product
  images: ProductImage[]
  similarity: number
  matchReasons: string[]
  confidence: ConfidenceLevel
}

export function getConfidenceLevel(similarity: number): ConfidenceLevel {
  if (similarity >= 0.85) return 'high'
  if (similarity >= 0.70) return 'medium'
  if (similarity >= 0.50) return 'low'
  return 'weak'
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'ほぼ確実な一致',
  medium: '類似商品',
  low: '参考候補',
  weak: '低確度'
}

export interface ProductFormData {
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

export interface RecommendedField {
  field: keyof ProductFormData
  value: string | number
  confidence: number
  sources: number
}

export type ImageType = 'tag' | 'full' | 'logo' | 'detail' | 'other'

export interface UploadedImage {
  data: string
  name: string
  type: ImageType
  index: number
}

export interface ProductFilter {
  brand?: string
  category?: string
  page?: number
  limit?: number
}

export interface SearchFilter {
  brand?: string
  category?: string
  color?: string
  material?: string
}

export const BRANDS = [
  'VICTIM', 'sacai', 'ISSEY MIYAKE MEN', 'KANEMASA', 'YOHJI YAMAMOTO',
  'BALENCIAGA', 'ANREALAGE', 'CULLNI', 'YASHIKI', 'FOUNDOUR',
  'CLANE', 'suzuki takayuki', 'COCO DEAL', 'OBLI', 'FLORENT',
  'MOUSSY', 'LOULOU WILLOUGHBY', 'SLY', 'moto', 'suprema',
  'SHAREEF', 'MM6', 'mythography', 'cecchi de rossi', 'STUDIOUS',
  'UNITED TOKYO', 'BURBERRY BLACK LABEL'
] as const
export const CATEGORIES = [
  'シャツ', 'トップス', 'ジャケット', 'コート', 'ワンピース',
  'スカート', 'シューズ'
] as const
export const CONDITIONS = ['S', 'A', 'B', 'C', 'D'] as const
export const COLORS = [
  'ブラック', 'ホワイト', 'ネイビー', 'ブラウン', 'ベージュ',
  'ブルー', 'イエロー', 'グレー', 'アイボリー', 'キャメル',
  'カーキ', 'ボルドー', 'インディゴ', 'マルチカラー'
] as const
export const MATERIALS = [
  'レザー', 'コットン', 'ウール', 'ポリエステル', 'リネン',
  'デニム', 'ベロア', 'スウェード', 'ファー', 'ナイロン'
] as const
// --- OCR Normalization ---

export interface OcrNormalizedResult {
  brand: string | null
  size: string | null
  material: string[] | null
  model: string | null
  other_text: string[]
  confidence: number
}

export interface OcrNormalizeOptions {
  debug?: boolean
}

export interface OcrDebugPayload {
  rawOcrText: string
  prompt: string
  rawResponse: string
  parsed: OcrNormalizedResult
}

export type LlmMode = 'cheap' | 'premium'

export const IMAGE_TYPES: ImageType[] = ['tag', 'full', 'logo', 'detail', 'other']
export const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  tag: 'タグ',
  full: '全体',
  logo: 'ロゴ',
  detail: 'ディテール',
  other: 'その他'
}
