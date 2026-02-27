import { getDatabase } from './connection'

export function initializeSchema(): void {
  const db = getDatabase()

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      category TEXT NOT NULL,
      model TEXT DEFAULT '',
      size TEXT DEFAULT '',
      color TEXT DEFAULT '',
      material TEXT DEFAULT '',
      condition TEXT NOT NULL DEFAULT 'B',
      price INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_path TEXT NOT NULL,
      image_type TEXT NOT NULL DEFAULT 'other',
      order_index INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS image_vectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_id INTEGER NOT NULL REFERENCES product_images(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      vector BLOB NOT NULL,
      model_name TEXT NOT NULL DEFAULT 'mock-v1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
    CREATE INDEX IF NOT EXISTS idx_image_vectors_product_id ON image_vectors(product_id);
    CREATE INDEX IF NOT EXISTS idx_image_vectors_image_id ON image_vectors(image_id);
  `)
}
