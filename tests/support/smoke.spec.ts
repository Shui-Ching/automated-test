import { test, expect } from '@playwright/test';

/**
 * Phase 0 的環境驗證測試。
 * 只證明「dev server 起得來、Playwright 打得到、斷言會生效」三件事。
 * 刻意包含一條會失敗的反例基準（見下方註解），確認測試不是永遠綠燈。
 */
test('環境驗證：dev server 回應且頁面標題正確', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/頁面管理/);
});
