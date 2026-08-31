import { test, expect } from '@playwright/test';

/**
 * 前端自己的煙霧測試，不是 AC 驗收測試。
 *
 * 兩者刻意分開放：AC 測試由 PM 端依規格撰寫、放在 tests/specs/，那是獨立的驗收權威；
 * 這一份只保證前端改動之後基本流程沒斷，避免在 PM 端測試就位之前完全沒有回歸保護。
 * 它不能拿來當「AC 已通過」的證據——那會變成實作者自己改考卷。
 */
test('登入成功', async ({ page }) => {
    await page.goto('/admin/login.html');
    // 反例基準：一開始不該有任何錯誤提示，否則「提示有出現」這件事證明不了什麼
    await expect(page.getByTestId('login-alert')).toBeHidden();

    await page.getByTestId('login-account').fill('Admin');
    await page.getByTestId('login-password').fill('Admin1234');
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/page-list\.html/);
});

test('帳密錯誤：顯示文案、密碼清空、帳號保留', async ({ page }) => {
    await page.goto('/admin/login.html');
    await page.getByTestId('login-account').fill('Admin');
    await page.getByTestId('login-password').fill('Admin0000');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-alert')).toHaveText('帳號或密碼錯誤');
    await expect(page.getByTestId('login-password')).toHaveValue('');
    await expect(page.getByTestId('login-account')).toHaveValue('Admin');
    await expect(page).toHaveURL(/login\.html/);
});

test('空欄位：兩個錯誤同時出現', async ({ page }) => {
    await page.goto('/admin/login.html');
    await expect(page.getByTestId('login-account-error')).toBeHidden();

    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-account-error')).toHaveText('請輸入帳號');
    await expect(page.getByTestId('login-password-error')).toHaveText('請輸入密碼');
});

test('未登入直接開後台頁面會被導回登入頁', async ({ page }) => {
    await page.goto('/admin/page-list.html');
    await expect(page).toHaveURL(/login\.html/);
});
