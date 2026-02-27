import { test, expect, navigateTo } from './electron-test'

test.describe('キーボードショートカット', () => {
  test('#13 shortcut-cmd-n: ⌘NでWorkspaceに遷移', async ({ appPage }) => {
    await navigateTo(appPage, '#/', 'home-title')
    await appPage.keyboard.press('Meta+n')
    await expect(appPage.locator('[data-testid="workspace"]')).toBeVisible({ timeout: 5_000 })
  })

  test('#14 shortcut-cmd-h: ⌘HでHistoryに遷移', async ({ appPage }) => {
    await navigateTo(appPage, '#/', 'home-title')
    await appPage.keyboard.press('Meta+h')
    await expect(appPage.locator('[data-testid="history-page"]')).toBeVisible({ timeout: 5_000 })
  })

  test('#15 shortcut-cmd-k: ⌘Kでコマンドパレット表示', async ({ appPage }) => {
    await navigateTo(appPage, '#/', 'home-title')
    await appPage.keyboard.press('Meta+k')
    await expect(appPage.locator('[data-testid="command-palette"]')).toBeVisible({ timeout: 3_000 })
    await expect(appPage.locator('[data-testid="command-input"]')).toBeFocused()
  })

  test('#16 palette-navigate: コマンド選択で画面遷移', async ({ appPage }) => {
    await navigateTo(appPage, '#/', 'home-title')
    await appPage.keyboard.press('Meta+k')
    await expect(appPage.locator('[data-testid="command-palette"]')).toBeVisible()

    // コマンドアイテムをクリックして実行
    await appPage.locator('[data-testid="command-item-history"]').click()

    await expect(appPage.locator('[data-testid="command-palette"]')).toBeHidden()
    await expect(appPage.locator('[data-testid="history-page"]')).toBeVisible({ timeout: 5_000 })
  })

  test('#17 palette-close-esc: Escapeでパレット閉じる', async ({ appPage }) => {
    await navigateTo(appPage, '#/', 'home-title')
    await appPage.keyboard.press('Meta+k')
    await expect(appPage.locator('[data-testid="command-palette"]')).toBeVisible()

    await appPage.keyboard.press('Escape')
    await expect(appPage.locator('[data-testid="command-palette"]')).toBeHidden()
  })

  test('#18 workspace-num-select: 数字キーで候補選択', async ({ appPage, testImagePath }) => {
    await navigateTo(appPage, '#/workspace', 'workspace')
    await appPage.locator('[data-testid="file-input"]').setInputFiles(testImagePath)
    await expect(appPage.locator('[data-testid="candidate-list"]')).toBeVisible({ timeout: 15_000 })

    // 候補領域をクリックして入力フォームからフォーカスを外す
    await appPage.locator('[data-testid="candidate-list"]').click()

    await appPage.keyboard.press('1')

    const first = appPage.locator('[data-testid="candidate-row"]').first()
    await expect(first).toHaveAttribute('data-selected', 'true')

    const brand = await appPage.locator('[data-testid="form-brand"]').inputValue()
    expect(brand.length).toBeGreaterThan(0)
  })

  test('#19 workspace-num-in-input: 入力フォーカス中は数字キーで候補選択されない', async ({ appPage, testImagePath }) => {
    await navigateTo(appPage, '#/workspace', 'workspace')
    await appPage.locator('[data-testid="file-input"]').setInputFiles(testImagePath)
    await expect(appPage.locator('[data-testid="candidate-list"]')).toBeVisible({ timeout: 15_000 })

    const priceInput = appPage.locator('[data-testid="form-price"]')
    await priceInput.click()
    await priceInput.fill('12345')

    const selectedRows = appPage.locator('[data-testid="candidate-row"][data-selected="true"]')
    await expect(selectedRows).toHaveCount(0)
    await expect(priceInput).toHaveValue('12345')
  })

  test('#20 history-esc-detail: Escapeで詳細パネルを閉じる', async ({ appPage }) => {
    await navigateTo(appPage, '#/history', 'history-page')
    await appPage.locator('[data-testid="history-table"]').waitFor({ state: 'visible', timeout: 10_000 })

    await appPage.locator('[data-testid="history-row"]').first().click()
    await expect(appPage.locator('[data-testid="detail-panel"]')).toBeVisible({ timeout: 10_000 })

    await appPage.keyboard.press('Escape')
    await expect(appPage.locator('[data-testid="detail-panel"]')).toBeHidden()
  })
})
