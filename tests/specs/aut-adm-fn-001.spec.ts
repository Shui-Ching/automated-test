import { test, expect } from '@playwright/test';

/**
 * [AUT-ADM-FN-001] 後台 後台登入 — AC 驗收測試。
 *
 * 對應規格：srs/04_功能規劃/4.1_內容管理/4.1.1_AUT_後台登入/[AUT-ADM-FN-001] 後台 後台登入.md
 * 依契約 tests/contract/testid-map.json 的 login 頁面選擇器撰寫，不自行發明選擇器。
 *
 * v1.2 SRS 已將 AC-P1 的斷言由「畫面上可見『頁面管理』功能入口」改寫為「畫面呈現該頁之
 * 搜尋區、資料列表與後台共用框架」，本測試依新文案驗證：登入狀態建立
 * （window.AdminSession.check() === 'active'）、導頁成功，並且頁面列表的搜尋區、
 * 資料列表容器與共用框架（選單、登出）確實存在於畫面上。
 */

test('[AUT-ADM-FN-001] AC-P1 成功登入後台', async ({ page }) => {
    await page.goto('/admin/login.html');
    await expect(page.getByTestId('login-alert')).toBeHidden();

    await page.getByTestId('login-account').fill('Admin');
    await page.getByTestId('login-password').fill('Admin1234');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/page-list\.html/);
    // 用 waitForFunction 而非 evaluate + expect.poll：導頁瞬間 execution context 會被銷毀重建，
    // evaluate 撞上這個瞬間會直接丟錯而不會重試，waitForFunction 才是為這種情境設計的等待方式。
    await page.waitForFunction(() => window.AdminSession && window.AdminSession.check() === 'active');

    // 搜尋區、資料列表與後台共用框架（選單、登出）均已呈現。
    await expect(page.getByTestId('page-list-search-name')).toBeVisible();
    await expect(page.getByTestId('page-list-body')).toBeVisible();
    await expect(page.getByTestId('admin-nav-page-list')).toBeVisible();
    await expect(page.getByTestId('page-list-logout')).toBeVisible();
});

test('[AUT-ADM-FN-001] AC-B1 欄位驗證：帳號未填', async ({ page }) => {
    await page.goto('/admin/login.html');
    // 反例基準：先確認送出前兩個錯誤訊息都是隱藏的，才能證明後面出現的是驗證觸發的結果
    await expect(page.getByTestId('login-account-error')).toBeHidden();
    await expect(page.getByTestId('login-password-error')).toBeHidden();

    await page.getByTestId('login-password').fill('Admin1234');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-account-error')).toHaveText('請輸入帳號');
    // 正向基準：只有帳號欄未填，密碼欄不應被誤觸發錯誤訊息
    await expect(page.getByTestId('login-password-error')).toBeHidden();
    await expect(page).toHaveURL(/login\.html/);
});

test('[AUT-ADM-FN-001] AC-B1 欄位驗證：密碼未填', async ({ page }) => {
    await page.goto('/admin/login.html');
    await expect(page.getByTestId('login-account-error')).toBeHidden();
    await expect(page.getByTestId('login-password-error')).toBeHidden();

    await page.getByTestId('login-account').fill('Admin');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-password-error')).toHaveText('請輸入密碼');
    await expect(page.getByTestId('login-account-error')).toBeHidden();
    await expect(page).toHaveURL(/login\.html/);
});

test('[AUT-ADM-FN-001] AC-B2 帳號或密碼錯誤', async ({ page }) => {
    await page.goto('/admin/login.html');
    await expect(page.getByTestId('login-alert')).toBeHidden();

    await page.getByTestId('login-account').fill('Admin');
    await page.getByTestId('login-password').fill('Admin0000');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-alert')).toHaveText('帳號或密碼錯誤');
    await expect(page.getByTestId('login-password')).toHaveValue('');
    await expect(page.getByTestId('login-account')).toHaveValue('Admin');
    await expect(page).toHaveURL(/login\.html/);
});
