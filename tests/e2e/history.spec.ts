import { test, expect, navigateTo } from './electron-test'

test.describe('History画面', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '#/history', 'history-page')
    await appPage.locator('[data-testid="history-table"]').waitFor({ state: 'visible', timeout: 10_000 })
  })

  test('#10 history-loads: テーブルに商品一覧が表示される', async ({ appPage }) => {
    const totalText = await appPage.locator('[data-testid="history-total"]').textContent()
    expect(totalText).toMatch(/\d+件/)

    const rows = appPage.locator('[data-testid="history-row"]')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('#11 history-detail: 行クリックで詳細パネル表示', async ({ appPage }) => {
    await appPage.locator('[data-testid="history-row"]').first().click()
    await expect(appPage.locator('[data-testid="detail-panel"]')).toBeVisible({ timeout: 10_000 })
    await expect(appPage.locator('[data-testid="detail-content"]')).toBeVisible({ timeout: 10_000 })
    await expect(appPage.locator('[data-testid="detail-field-brand"]')).toBeVisible()
  })

  test('#12 history-close-detail: ×ボタンで詳細パネルを閉じる', async ({ appPage }) => {
    await appPage.locator('[data-testid="history-row"]').first().click()
    await expect(appPage.locator('[data-testid="detail-panel"]')).toBeVisible({ timeout: 10_000 })

    await appPage.locator('[data-testid="detail-close"]').click()
    await expect(appPage.locator('[data-testid="detail-panel"]')).toBeHidden()
  })
})
