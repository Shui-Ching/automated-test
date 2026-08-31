import { defineConfig, devices } from '@playwright/test';

/**
 * 測試一律打本機 dev server，不打線上站。
 * 理由：免費託管會冷啟動，會把「連線慢」誤判成「功能有 bug」，
 * 污染我們要量的訊號（測試準不準）。
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,                      // 刻意不重試：重試會掩蓋不穩定的測試，而不穩定本身就是要量的東西
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./tests/reporters/dispatch-reporter.ts'],               // 產出派工單 Markdown（test-results/dispatch.md）
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
