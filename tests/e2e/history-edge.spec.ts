import { test, expect, navigateTo } from './electron-test'

test.describe('Historyエッジケース', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '#/history', 'history-page')
    await appPage.locator('[data-testid="history-table"]').waitFor({ state: 'visible', timeout: 10_000 })
  })

  test('#26 history-filter-brand: ブランドフィルタリング', async ({ appPage }) => {
    const brandFilter = appPage.locator('[data-testid="brand-filter"]')
    await brandFilter.fill('GUCCI')
    await brandFilter.press('Enter')

    await appPage.locator('[data-testid="history-table"]').waitFor({ state: 'visible', timeout: 10_000 })

    const rows = appPage.locator('[data-testid="history-row"]')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)

    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent()
      expect(text).toContain('GUCCI')
    }
  })

  test('#27 history-filter-category: カテゴリフィルタリング', async ({ appPage }) => {
    await appPage.locator('[data-testid="category-filter"]').selectOption('バッグ')
    await appPage.locator('[data-testid="history-table"]').waitFor({ state: 'visible', timeout: 10_000 })

    const rows = appPage.locator('[data-testid="history-row"]')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)

    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent()
      expect(text).toContain('バッグ')
    }
  })

  test('#28 history-filter-clear: フィルタクリア', async ({ appPage }) => {
    await appPage.locator('[data-testid="category-filter"]').selectOption('バッグ')
    await appPage.locator('[data-testid="history-table"]').waitFor({ state: 'visible', timeout: 10_000 })

    const filteredCount = await appPage.locator('[data-testid="history-row"]').count()

    await appPage.locator('[data-testid="filter-clear"]').click()
    await appPage.locator('[data-testid="history-table"]').waitFor({ state: 'visible', timeout: 10_000 })

    const allCount = await appPage.locator('[data-testid="history-row"]').count()
    expect(allCount).toBeGreaterThanOrEqual(filteredCount)
  })

  test('#29 history-filter-empty: 存在しないブランドで空状態表示', async ({ appPage }) => {
    const brandFilter = appPage.locator('[data-testid="brand-filter"]')
    await brandFilter.fill('NONEXISTENTBRAND12345')
    await brandFilter.press('Enter')

    await expect(appPage.locator('[data-testid="empty-state"]')).toBeVisible({ timeout: 10_000 })
  })

  test('#30 history-pagination: データ件数とテーブルの表示確認', async ({ appPage }) => {
    // Mock data は8件、limit=20 なので1ページに収まる
    const rows = appPage.locator('[data-testid="history-row"]')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)

    const totalText = await appPage.locator('[data-testid="history-total"]').textContent()
    expect(totalText).toMatch(/\d+件/)
  })

  test('#11b history-detail-fields: 詳細パネルに全フィールド表示', async ({ appPage }) => {
    await appPage.locator('[data-testid="history-row"]').first().click()
    await expect(appPage.locator('[data-testid="detail-content"]')).toBeVisible({ timeout: 10_000 })

    await expect(appPage.locator('[data-testid="detail-field-brand"]')).toBeVisible()
    await expect(appPage.locator('[data-testid="detail-field-category"]')).toBeVisible()
    await expect(appPage.locator('[data-testid="detail-field-model"]')).toBeVisible()
    await expect(appPage.locator('[data-testid="detail-field-price"]')).toBeVisible()
  })

  test('#11c history-detail-toggle: 同じ行をクリックでパネル閉じる', async ({ appPage }) => {
    const firstRow = appPage.locator('[data-testid="history-row"]').first()

    await firstRow.click()
    await expect(appPage.locator('[data-testid="detail-panel"]')).toBeVisible({ timeout: 10_000 })

    await firstRow.click()
    await expect(appPage.locator('[data-testid="detail-panel"]')).toBeHidden()
  })
})
