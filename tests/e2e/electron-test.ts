import { test as base, expect } from '@playwright/test'
import type { Page } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

/**
 * Playwright fixture for testing the Electron renderer via local HTTP server.
 *
 * The built renderer is served via test-server.ts on localhost:9223.
 * window.api is mocked with controlled fixture data via addInitScript,
 * giving full control over test data and eliminating flakiness.
 */

const MOCK_PRODUCTS = [
  { id: 1, brand: 'GUCCI', category: 'バッグ', model: 'GG Marmont ショルダーバッグ', size: 'ミディアム', color: 'ブラック', material: 'レザー', condition: 'A', price: 120000, notes: '良好な状態', created_at: '2025-01-15T10:00:00Z', updated_at: '2025-01-15T10:00:00Z' },
  { id: 2, brand: 'LOUIS VUITTON', category: 'バッグ', model: 'ネヴァーフル MM', size: 'MM', color: 'ブラウン', material: 'モノグラムキャンバス', condition: 'B', price: 95000, notes: '', created_at: '2025-01-14T09:00:00Z', updated_at: '2025-01-14T09:00:00Z' },
  { id: 3, brand: 'CHANEL', category: 'バッグ', model: 'クラシック フラップ', size: 'スモール', color: 'ブラック', material: 'ラムスキン', condition: 'S', price: 450000, notes: '未使用に近い', created_at: '2025-01-13T08:00:00Z', updated_at: '2025-01-13T08:00:00Z' },
  { id: 4, brand: 'PRADA', category: 'シューズ', model: 'モノリス ローファー', size: '38', color: 'ブラック', material: 'レザー', condition: 'B', price: 55000, notes: '', created_at: '2025-01-12T07:00:00Z', updated_at: '2025-01-12T07:00:00Z' },
  { id: 5, brand: 'HERMES', category: 'アクセサリー', model: 'Hバックル ベルト', size: '85', color: 'ゴールド', material: 'レザー', condition: 'A', price: 78000, notes: '', created_at: '2025-01-11T06:00:00Z', updated_at: '2025-01-11T06:00:00Z' },
  { id: 6, brand: 'GUCCI', category: 'ジャケット', model: 'GGジャカード デニムジャケット', size: 'M', color: 'ブルー', material: 'デニム', condition: 'B', price: 85000, notes: '', created_at: '2025-01-10T05:00:00Z', updated_at: '2025-01-10T05:00:00Z' },
  { id: 7, brand: 'LOUIS VUITTON', category: '財布', model: 'ポルトフォイユ・サラ', size: '-', color: 'ブラウン', material: 'モノグラムキャンバス', condition: 'C', price: 25000, notes: 'スレあり', created_at: '2025-01-09T04:00:00Z', updated_at: '2025-01-09T04:00:00Z' },
  { id: 8, brand: 'CHANEL', category: 'アクセサリー', model: 'ココマーク ピアス', size: '-', color: 'ゴールド', material: 'メタル', condition: 'A', price: 42000, notes: '', created_at: '2025-01-08T03:00:00Z', updated_at: '2025-01-08T03:00:00Z' },
]

function buildSearchResults(opts?: { weak?: boolean }) {
  const sim = opts?.weak ? 0.35 : 0.82
  return MOCK_PRODUCTS.slice(0, 5).map((p, i) => ({
    product: p,
    images: i === 0 ? [
      { id: 1, product_id: p.id, image_path: '/mock/tag.svg', image_type: 'tag', order_index: 0, created_at: p.created_at },
      { id: 2, product_id: p.id, image_path: '/mock/full.svg', image_type: 'full', order_index: 1, created_at: p.created_at }
    ] : [],
    similarity: Math.max(0.15, sim - i * 0.12),
    matchReasons: [`ブランド一致: ${p.brand}`, `カテゴリ一致: ${p.category}`]
  }))
}

const SVG_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzY2NiIvPjwvc3ZnPg=='

function buildMockApiScript(): string {
  return `
    window.__mockProducts = ${JSON.stringify(MOCK_PRODUCTS)};
    window.__mockSearchResults = ${JSON.stringify(buildSearchResults())};

    window.api = {
      getProducts: async (filter) => {
        let items = [...window.__mockProducts];
        if (filter && filter.brand) items = items.filter(p => p.brand.includes(filter.brand));
        if (filter && filter.category) items = items.filter(p => p.category === filter.category);
        const page = (filter && filter.page) || 1;
        const limit = (filter && filter.limit) || 20;
        const start = (page - 1) * limit;
        return { products: items.slice(start, start + limit), total: items.length };
      },
      getRecentProducts: async (limit) => window.__mockProducts.slice(0, limit || 5),
      getProduct: async (id) => {
        const product = window.__mockProducts.find(p => p.id === id);
        if (!product) return null;
        return {
          product,
          images: [
            { id: id*10, product_id: id, image_path: '/mock/tag.svg', image_type: 'tag', order_index: 0, created_at: product.created_at },
            { id: id*10+1, product_id: id, image_path: '/mock/full.svg', image_type: 'full', order_index: 1, created_at: product.created_at },
          ]
        };
      },
      saveProduct: async (data, imgs) => {
        const newId = window.__mockProducts.length + 1;
        window.__mockProducts.unshift({ ...data, id: newId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        return newId;
      },
      getProductCount: async () => window.__mockProducts.length,
      searchSimilar: async (vector, limit) => {
        return window.__mockSearchResults;
      },
      saveImages: async (productId, images) => images.map((img, i) => ({
        ...img, path: '/mock/' + productId + '/' + i, imageId: productId * 100 + i
      })),
      readImage: async (imagePath) => '${SVG_BASE64}',
      saveVector: async () => {},
      getAllVectors: async () => [],
    };
  `
}

type TestFixtures = {
  appPage: Page
  testImagePath: string
}

export const test = base.extend<TestFixtures>({
  appPage: async ({ page, baseURL }, use) => {
    await page.addInitScript(buildMockApiScript())
    await page.goto(baseURL || 'http://localhost:9223')
    await page.locator('[data-testid="app-root"]').waitFor({ state: 'attached', timeout: 15_000 })
    await use(page)
  },

  testImagePath: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ss-test-img-'))
    const imgPath = path.join(dir, 'test-image.png')
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVQYV2P8z8BQz0AEYBxVOHIUAgBGWAgE/dLkFAAAAABJRU5ErkJggg==',
      'base64'
    )
    fs.writeFileSync(imgPath, png)
    await use(imgPath)
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

export { expect, MOCK_PRODUCTS, buildSearchResults, buildMockApiScript }

export async function navigateTo(page: Page, hash: string, waitForTestId: string): Promise<void> {
  await page.evaluate((h) => { window.location.hash = h }, hash)
  await page.locator(`[data-testid="${waitForTestId}"]`).waitFor({ state: 'visible', timeout: 10_000 })
}
