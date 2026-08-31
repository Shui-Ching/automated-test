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
