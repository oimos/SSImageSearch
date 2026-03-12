import { test, expect, navigateTo } from './electron-test'

test.describe('Home画面', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '#/', 'home-title')
  })

  test('#1 home-loads: 起動時にホーム画面が正しく表示される', async ({ appPage }) => {
    await expect(appPage.locator('[data-testid="home-title"]')).toHaveText('買取ダッシュボード')
    await expect(appPage.locator('[data-testid="new-purchase-btn"]')).toBeVisible()
    await expect(appPage.locator('[data-testid="history-btn"]')).toBeVisible()

    await expect(appPage.locator('[data-testid="recent-products"]')).toBeVisible()
    const items = appPage.locator('[data-testid="recent-product-item"]')
    await expect(items.first()).toBeVisible()
    const count = await items.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('#2 home-to-workspace: 「新規買取」クリックでWorkspaceに遷移', async ({ appPage }) => {
    await appPage.locator('[data-testid="new-purchase-btn"]').click()
    await expect(appPage.locator('[data-testid="workspace"]')).toBeVisible()
    await expect(appPage.locator('[data-testid="image-drop-zone"]')).toBeVisible()
  })

  test('#3 home-to-history: 「買取履歴」クリックでHistoryに遷移', async ({ appPage }) => {
    await appPage.locator('[data-testid="history-btn"]').click()
    await expect(appPage.locator('[data-testid="history-page"]')).toBeVisible()
    await expect(appPage.locator('[data-testid="history-table"]')).toBeVisible({ timeout: 10_000 })
  })
})
