import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'test-results/html-report' }]
  ],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: 'http://localhost:9223',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome']
  },
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: {
    command: 'npx tsx tests/e2e/test-server.ts',
    port: 9223,
    reuseExistingServer: !process.env.CI
  }
})
