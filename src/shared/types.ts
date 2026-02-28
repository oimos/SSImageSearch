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

export interface SearchResult {
  product: Product
  images: ProductImage[]
  similarity: number
  matchReasons: string[]
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

export const BRANDS = ['GUCCI', 'LOUIS VUITTON', 'CHANEL', 'PRADA', 'HERMES', 'BURBERRY'] as const
export const CATEGORIES = ['バッグ', 'ジャケット', 'シューズ', 'アクセサリー', '財布'] as const
export const CONDITIONS = ['S', 'A', 'B', 'C', 'D'] as const
export const COLORS = [
  'ブラック', 'ホワイト', 'ネイビー', 'ブラウン', 'ベージュ',
  'レッド', 'ピンク', 'ブルー', 'ゴールド', 'キャメル',
  'インディゴ', 'エトゥープ', 'マルチ', 'モノグラム', 'ダミエ'
] as const
export const MATERIALS = [
  'レザー', 'キャンバス', 'ナイロン', 'ウール', 'シルク',
  'デニム', 'ツイード', 'カシミア', 'コットン', 'ラムスキン',
  'キャビアスキン', 'サフィアーノレザー', 'トゴ', 'エプソン', 'メタル'
] as const
export const IMAGE_TYPES: ImageType[] = ['tag', 'full', 'logo', 'detail', 'other']
export const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  tag: 'タグ',
  full: '全体',
  logo: 'ロゴ',
  detail: 'ディテール',
  other: 'その他'
}
