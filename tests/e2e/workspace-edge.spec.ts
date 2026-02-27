import { test, expect, navigateTo } from './electron-test'

test.describe('Workspaceエッジケース', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '#/workspace', 'workspace')
  })

  test('#21 workspace-save-disabled: 必須項目未入力で保存ボタンdisabled', async ({ appPage }) => {
    await expect(appPage.locator('[data-testid="save-btn"]')).toBeDisabled()

    await appPage.locator('[data-testid="form-brand"]').fill('GUCCI')
    await expect(appPage.locator('[data-testid="save-btn"]')).toBeDisabled()

    await appPage.locator('[data-testid="form-category"]').selectOption('バッグ')
    await expect(appPage.locator('[data-testid="save-btn"]')).toBeEnabled()

    await appPage.locator('[data-testid="form-brand"]').fill('')
    await expect(appPage.locator('[data-testid="save-btn"]')).toBeDisabled()
  })

  test('#22 workspace-reset: リセットで全てクリア', async ({ appPage }) => {
    await appPage.locator('[data-testid="form-brand"]').fill('RESET TEST')
    await appPage.locator('[data-testid="form-category"]').selectOption('バッグ')
    await appPage.locator('[data-testid="form-model"]').fill('テストモデル')

    await expect(appPage.locator('[data-testid="reset-btn"]')).toBeVisible()
    await appPage.locator('[data-testid="reset-btn"]').click()

    await expect(appPage.locator('[data-testid="form-brand"]')).toHaveValue('')
    await expect(appPage.locator('[data-testid="form-category"]')).toHaveValue('')
    await expect(appPage.locator('[data-testid="form-model"]')).toHaveValue('')
    await expect(appPage.locator('[data-testid="phase-idle"]')).toBeVisible()
  })

  test('#24 workspace-multi-images: 複数画像アップでプレビュー表示', async ({ appPage, testImagePath }) => {
    await appPage.locator('[data-testid="file-input"]').setInputFiles([
      testImagePath, testImagePath, testImagePath
    ])

    await expect(
      appPage.locator('[data-testid="candidate-list"], [data-testid="no-results"]').first()
    ).toBeVisible({ timeout: 15_000 })

    await expect(appPage.locator('[data-testid="image-previews"]')).toBeVisible()
  })

  test('#25 workspace-clear-images: 画像クリアでドロップゾーンに戻る', async ({ appPage, testImagePath }) => {
    await appPage.locator('[data-testid="file-input"]').setInputFiles(testImagePath)
    await expect(appPage.locator('[data-testid="image-previews"]')).toBeVisible({ timeout: 15_000 })

    await appPage.locator('[data-testid="clear-images-btn"]').click()

    await expect(appPage.locator('[data-testid="image-drop-zone"]')).toBeVisible()
    await expect(appPage.locator('[data-testid="phase-idle"]')).toBeVisible()
  })

  test('#31 loading-skeletons: 検索が開始されUI状態が遷移する', async ({ appPage, testImagePath }) => {
    await appPage.locator('[data-testid="file-input"]').setInputFiles(testImagePath)

    // searching or results が表示される（mockは即時なのでどちらか）
    const indicator = appPage.locator(
      '[data-testid="phase-searching"], [data-testid="candidate-list"], [data-testid="no-results"]'
    )
    await expect(indicator.first()).toBeVisible({ timeout: 10_000 })
  })

  test('#32 save-success-auto-reset: 保存完了後にidle状態に自動リセット', async ({ appPage }) => {
    await appPage.locator('[data-testid="form-brand"]').fill('AUTO RESET')
    await appPage.locator('[data-testid="form-category"]').selectOption('シューズ')

    await appPage.locator('[data-testid="save-btn"]').click()
    await expect(appPage.locator('[data-testid="phase-saved"]')).toBeVisible({ timeout: 10_000 })

    await expect(appPage.locator('[data-testid="phase-idle"]')).toBeVisible({ timeout: 5_000 })
    await expect(appPage.locator('[data-testid="form-brand"]')).toHaveValue('')
    await expect(appPage.locator('[data-testid="image-drop-zone"]')).toBeVisible()
  })
})
