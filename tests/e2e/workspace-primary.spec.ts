import { test, expect, navigateTo } from './electron-test'

test.describe('Workspace主要フロー', () => {
  test.beforeEach(async ({ appPage }) => {
    await navigateTo(appPage, '#/workspace', 'workspace')
  })

  test('#4 workspace-idle: 初期状態でidle表示', async ({ appPage }) => {
    await expect(appPage.locator('[data-testid="phase-idle"]')).toBeVisible()
    await expect(appPage.locator('[data-testid="image-drop-zone"]')).toBeVisible()
    await expect(appPage.locator('[data-testid="form-brand"]')).toHaveValue('')
    await expect(appPage.locator('[data-testid="form-category"]')).toHaveValue('')
    await expect(appPage.locator('[data-testid="save-btn"]')).toBeDisabled()
  })

  test('#5 workspace-upload: 画像アップで検索→候補表示', async ({ appPage, testImagePath }) => {
    await appPage.locator('[data-testid="file-input"]').setInputFiles(testImagePath)

    // 候補リストが表示される（mockは即座に返すのでskeletonは一瞬）
    await expect(appPage.locator('[data-testid="candidate-list"]')).toBeVisible({ timeout: 15_000 })

    const rows = appPage.locator('[data-testid="candidate-row"]')
    await expect(rows.first()).toBeVisible()
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)

    await expect(appPage.locator('[data-testid="image-previews"]')).toBeVisible()
    await expect(appPage.locator('[data-testid="image-preview"]').first()).toBeVisible()
  })

  test('#6 workspace-select-candidate: 候補クリックでフォーム自動入力', async ({ appPage, testImagePath }) => {
    await appPage.locator('[data-testid="file-input"]').setInputFiles(testImagePath)
    await expect(appPage.locator('[data-testid="candidate-list"]')).toBeVisible({ timeout: 15_000 })

    const firstCandidate = appPage.locator('[data-testid="candidate-row"]').first()
    const brandText = await firstCandidate.locator('[data-testid="candidate-brand"]').textContent()

    await firstCandidate.click()

    await expect(firstCandidate).toHaveAttribute('data-selected', 'true')
    await expect(appPage.locator('[data-testid="form-brand"]')).toHaveValue(brandText!)
    await expect(appPage.locator('[data-testid="applied-count"]')).toBeVisible()
  })

  test('#7 workspace-edit-form: フォーム手動編集が反映される', async ({ appPage }) => {
    await appPage.locator('[data-testid="form-brand"]').fill('TEST BRAND')
    await expect(appPage.locator('[data-testid="form-brand"]')).toHaveValue('TEST BRAND')

    await appPage.locator('[data-testid="form-category"]').selectOption('バッグ')
    await expect(appPage.locator('[data-testid="form-category"]')).toHaveValue('バッグ')
    await expect(appPage.locator('[data-testid="save-btn"]')).toBeEnabled()
  })

  test('#8 workspace-save: 保存が成功し「保存しました」表示→リセット', async ({ appPage }) => {
    await appPage.locator('[data-testid="form-brand"]').fill('SAVE TEST')
    await appPage.locator('[data-testid="form-category"]').selectOption('バッグ')

    await appPage.locator('[data-testid="save-btn"]').click()
    await expect(appPage.locator('[data-testid="phase-saved"]')).toBeVisible({ timeout: 10_000 })
    await expect(appPage.locator('[data-testid="phase-idle"]')).toBeVisible({ timeout: 5_000 })
    await expect(appPage.locator('[data-testid="form-brand"]')).toHaveValue('')
  })

  test('#9 workspace-full-flow: 画像→候補選択→編集→保存の通しフロー', async ({ appPage, testImagePath }) => {
    await appPage.locator('[data-testid="file-input"]').setInputFiles(testImagePath)
    await expect(appPage.locator('[data-testid="candidate-list"]')).toBeVisible({ timeout: 15_000 })

    await appPage.locator('[data-testid="candidate-row"]').first().click()
    const brand = await appPage.locator('[data-testid="form-brand"]').inputValue()
    expect(brand.length).toBeGreaterThan(0)

    await appPage.locator('[data-testid="form-notes"]').fill('E2Eテスト通しフロー')
    await expect(appPage.locator('[data-testid="form-notes"]')).toHaveValue('E2Eテスト通しフロー')

    await appPage.locator('[data-testid="save-btn"]').click()
    await expect(appPage.locator('[data-testid="phase-saved"]')).toBeVisible({ timeout: 10_000 })
    await expect(appPage.locator('[data-testid="phase-idle"]')).toBeVisible({ timeout: 5_000 })
  })
})
