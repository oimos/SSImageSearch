import { getDatabase } from '../db/connection'
import type { Product, ProductImage, ProductFilter, ProductFormData } from '@shared/types'

export function getProducts(
  filter?: ProductFilter
): { products: (Product & { thumbnail_path?: string })[]; total: number } {
  const db = getDatabase()
  const conditions: string[] = []
  const params: Record<string, string | number> = {}

  if (filter?.brand) {
    conditions.push('brand LIKE @brand')
    params.brand = `%${filter.brand}%`
  }
  if (filter?.category) {
    conditions.push('category = @category')
    params.category = filter.category
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filter?.limit || 20
  const offset = ((filter?.page || 1) - 1) * limit

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM products ${where}`).get(params) as {
    cnt: number
  }
  const products = db
    .prepare(
      `SELECT p.*, (
        SELECT pi.image_path FROM product_images pi
        WHERE pi.product_id = p.id ORDER BY pi.order_index LIMIT 1
      ) AS thumbnail_path
      FROM products p ${where}
      ORDER BY p.created_at DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset }) as (Product & { thumbnail_path?: string })[]

  return { products, total: total.cnt }
}

export function getRecentProducts(limit = 5): Product[] {
  const db = getDatabase()
  return db
    .prepare('SELECT * FROM products ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Product[]
}

export function getProduct(id: number): { product: Product; images: ProductImage[] } | null {
  const db = getDatabase()
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined
  if (!product) return null

  const images = db
    .prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY order_index')
    .all(id) as ProductImage[]

  return { product, images }
}

export function saveProduct(
  data: ProductFormData,
  imageRecords: Array<{ path: string; type: string; index: number }>
): number {
  const db = getDatabase()
  const result = db
    .prepare(
      `INSERT INTO products (brand, category, model, size, color, material, condition, price, notes)
     VALUES (@brand, @category, @model, @size, @color, @material, @condition, @price, @notes)`
    )
    .run(data)

  const productId = result.lastInsertRowid as number

  const insertImage = db.prepare(
    `INSERT INTO product_images (product_id, image_path, image_type, order_index)
     VALUES (@product_id, @image_path, @image_type, @order_index)`
  )

  for (const img of imageRecords) {
    insertImage.run({
      product_id: productId,
      image_path: img.path,
      image_type: img.type,
      order_index: img.index
    })
  }

  return productId
}

export function getProductCount(): number {
  const db = getDatabase()
  const row = db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number }
  return row.cnt
}
