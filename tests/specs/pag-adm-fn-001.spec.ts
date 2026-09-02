import { test, expect } from '@playwright/test';
import { seedAdmin } from '../support/seed';

/**
 * [PAG-ADM-FN-001] 後台 頁面列表 — AC 驗收測試。
 *
 * 對應規格：srs/04_功能規劃/4.1_內容管理/4.1.2_PAG_頁面管理/[PAG-ADM-FN-001] 後台 頁面列表.md
 * 依契約 tests/contract/testid-map.json 的 page-list 頁面選擇器撰寫，資料透過
 * tests/support/seed.ts 的 seedAdmin() 填種，寫法見 tests/contract/seed.md。
 */

test('[PAG-ADM-FN-001] AC-P1 依頁面名稱關鍵字篩選', async ({ page }) => {
    await seedAdmin(page, [
        { id: 'p1', name: '關於我們', createdDate: '2026-01-10', blocks: [{}] },
        { id: 'p2', name: '聯絡我們', createdDate: '2026-01-11', blocks: [{}] },
    ]);
    await page.goto('/admin/page-list.html');

    // 正向基準：先確認篩選前兩筆都在，才能證明篩選後只剩一筆是篩選造成的
    await expect(page.getByTestId('page-list-total')).toHaveText('2');

    await page.getByTestId('page-list-search-name').fill('關於');
    await page.getByTestId('page-list-search-submit').click();

    await expect(page.getByTestId('page-list-total')).toHaveText('1');
    const rows = page.getByTestId('page-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-page-name', '關於我們');
});

test('[PAG-ADM-FN-001] AC-P2 依建立日期區間篩選', async ({ page }) => {
    await seedAdmin(page, [
        { id: 'p1', name: '甲頁面', createdDate: '2026-01-10', blocks: [{}] },
        { id: 'p2', name: '乙頁面', createdDate: '2026-03-20', blocks: [{}] },
    ]);
    await page.goto('/admin/page-list.html');
    await expect(page.getByTestId('page-list-total')).toHaveText('2');

    await page.getByTestId('page-list-search-date-from').fill('2026-01-01');
    await page.getByTestId('page-list-search-date-to').fill('2026-01-31');
    await page.getByTestId('page-list-search-submit').click();

    await expect(page.getByTestId('page-list-total')).toHaveText('1');
    await expect(page.getByTestId('page-row')).toHaveAttribute('data-page-name', '甲頁面');
});

test('[PAG-ADM-FN-001] AC-P3 成功刪除頁面（硬刪除）', async ({ page }) => {
    await seedAdmin(page, [{ id: 'p1', name: '測試頁面 A', createdDate: '2026-01-10', blocks: [{}] }]);
    await page.goto('/admin/page-list.html');
    await expect(page.getByTestId('page-list-total')).toHaveText('1');

    await page.getByTestId('page-list-row-delete').click();
    await expect(page.getByTestId('page-list-delete-dialog')).toBeVisible();
    await page.getByTestId('page-list-delete-confirm').click();

    await expect(page.getByTestId('page-list-toast')).toHaveText('刪除成功');
    await expect(page.getByTestId('page-list-total')).toHaveText('0');
    await expect(page.getByTestId('page-row')).toHaveCount(0);
});

test('[PAG-ADM-FN-001] AC-P4 取消刪除', async ({ page }) => {
    await seedAdmin(page, [{ id: 'p1', name: '測試頁面 A', createdDate: '2026-01-10', blocks: [{}] }]);
    await page.goto('/admin/page-list.html');

    await page.getByTestId('page-list-row-delete').click();
    await expect(page.getByTestId('page-list-delete-dialog')).toBeVisible();
    await page.getByTestId('page-list-delete-cancel').click();

    await expect(page.getByTestId('page-list-delete-dialog')).toBeHidden();
    await expect(page.getByTestId('page-list-total')).toHaveText('1');
    await expect(page.getByTestId('page-row')).toHaveCount(1);
});

test('[PAG-ADM-FN-001] AC-P5 篩選結果查無資料', async ({ page }) => {
    await seedAdmin(page, [{ id: 'p1', name: '關於我們', createdDate: '2026-01-10', blocks: [{}] }]);
    await page.goto('/admin/page-list.html');
    await expect(page.getByTestId('page-row')).toHaveCount(1);

    await page.getByTestId('page-list-search-name').fill('XYZ');
    await page.getByTestId('page-list-search-submit').click();

    await expect(page.getByTestId('page-list-empty')).toBeVisible();
    await expect(page.getByTestId('page-list-total')).toHaveText('0');
});

test('[PAG-ADM-FN-001] AC-B1 建立日期起始晚於結束', async ({ page }) => {
    await seedAdmin(page, [{ id: 'p1', name: '關於我們', createdDate: '2026-01-10', blocks: [{}] }]);
    await page.goto('/admin/page-list.html');
    await expect(page.getByTestId('page-list-search-date-error')).toBeHidden();
    await expect(page.getByTestId('page-list-total')).toHaveText('1');

    await page.getByTestId('page-list-search-date-from').fill('2026-03-31');
    await page.getByTestId('page-list-search-date-to').fill('2026-03-01');
    await page.getByTestId('page-list-search-submit').click();

    await expect(page.getByTestId('page-list-search-date-error')).toHaveText('結束時間不可早於開始時間');
    // 列表內容維持查詢前狀態：不是「畫面根本沒重新渲染」，而是真的還是查詢前那 1 筆
    await expect(page.getByTestId('page-list-total')).toHaveText('1');
    await expect(page.getByTestId('page-row')).toHaveCount(1);
});

test('[PAG-ADM-FN-001] AC-P6 同一建立日期依建檔時序排序（與前台一致）', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-list.html');

    // buildSeq（建檔時序）由 createPage() 寫入時才產生，seedAdmin 填不出這個欄位，
    // 改用動態 import 呼叫真正的 data-store.js（見 tests/contract/seed.md「buildSeq」一節）。
    // 排序基準須與 [PUB-WEB-FN-001] 完全一致：後建立的「乙頁面」應排在較前面。
    await page.evaluate(async () => {
        const { createPage } = await import('/assets/js/data-store.js');
        createPage({ name: '甲頁面', createdDate: '2026-04-01', blocks: [{}] });
        createPage({ name: '乙頁面', createdDate: '2026-04-01', blocks: [{}] });
    });
    await page.reload();

    const rows = page.getByTestId('page-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-page-name', '乙頁面');
    await expect(rows.nth(1)).toHaveAttribute('data-page-name', '甲頁面');
});

test('[PAG-ADM-FN-001] EX-1 刪除目標於作業期間已不存在', async ({ page }) => {
    await seedAdmin(page, [{ id: 'p1', name: '測試頁面 A', createdDate: '2026-01-10', blocks: [{}] }]);
    await page.goto('/admin/page-list.html');

    await page.getByTestId('page-list-row-delete').click();
    await expect(page.getByTestId('page-list-delete-dialog')).toBeVisible();

    // 模擬另一個瀏覽器分頁已搶先完成刪除：彈窗開著的當下，資料已經不在了。
    await page.evaluate(() => {
        localStorage.setItem('admin-pages', '[]');
    });

    await page.getByTestId('page-list-delete-confirm').click();

    await expect(page.getByTestId('page-list-toast')).toHaveText('資料不存在或已被刪除');
    await expect(page.getByTestId('page-list-delete-dialog')).toBeHidden();
    await expect(page.getByTestId('page-list-total')).toHaveText('0');
});

test('[PAG-ADM-FN-001] NFR-004 資料寫入失敗時中止刪除並提示、列表維持原狀', async ({ page }) => {
    // 寫入本來不會自己失敗，用 ?forceWriteFailure=1 注入（見 data-store.js writeAll() 的說明）。
    await seedAdmin(page, [{ id: 'p1', name: '測試頁面 A', createdDate: '2026-01-10', blocks: [{}] }]);
    await page.goto('/admin/page-list.html?forceWriteFailure=1');

    await page.getByTestId('page-list-row-delete').click();
    await page.getByTestId('page-list-delete-confirm').click();

    await expect(page.getByTestId('page-list-toast')).toHaveText('系統忙碌中，請稍後再試');
    await expect(page.getByTestId('page-list-delete-dialog')).toBeHidden();
    // 該筆資料仍存在且總筆數不變。
    await expect(page.getByTestId('page-list-total')).toHaveText('1');
    await expect(page.getByTestId('page-row')).toHaveCount(1);

    const pages = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-pages') || '[]'));
    expect(pages).toHaveLength(1);
});
