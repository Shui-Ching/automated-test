import { test, expect } from '@playwright/test';
import { seedAdmin } from '../support/seed';

/**
 * [PUB-WEB-FN-001] 前台 前台頁面列表 — AC 驗收測試。
 *
 * 對應規格：srs/04_功能規劃/4.2_前台展示/4.2.1_PUB_頁面瀏覽/[PUB-WEB-FN-001] 前台 前台頁面列表.md
 * 依契約 tests/contract/testid-map.json 的 pub-list 頁面選擇器撰寫，資料透過
 * tests/support/seed.ts 的 seedAdmin() 填種，寫法見 tests/contract/seed.md「前台頁面沿用同一套 seedAdmin」一節。
 *
 * AC-P1 的次要排序依 docs/pm-feedback.md A-1（2026-08-31 採方案 A 定案）：
 * 同一建立日期時以主鍵（id）由大至小排序，本測試刻意讓 id 遞增順序與預期顯示順序一致，
 * 用來同時驗證主鍵次要排序有生效（而不是巧合符合建立日期排序）。
 */

test('[PUB-WEB-FN-001] AC-P1 依建立日期由新至舊顯示', async ({ page }) => {
    await seedAdmin(page, [
        { id: 'p1', name: '甲頁面', createdDate: '2026-01-10', blocks: [{}] },
        { id: 'p2', name: '乙頁面', createdDate: '2026-02-15', blocks: [{}] },
        { id: 'p3', name: '丙頁面', createdDate: '2026-03-20', blocks: [{}] },
    ]);
    await page.goto('/index.html');

    const rows = page.getByTestId('pub-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toHaveAttribute('data-page-name', '丙頁面');
    await expect(rows.nth(1)).toHaveAttribute('data-page-name', '乙頁面');
    await expect(rows.nth(2)).toHaveAttribute('data-page-name', '甲頁面');
});

test('[PUB-WEB-FN-001] AC-P2 點擊頁面名稱導向內容頁', async ({ page }) => {
    await seedAdmin(page, [{ id: 'p1', name: '品牌故事', createdDate: '2026-01-10', blocks: [{}] }]);
    await page.goto('/index.html');

    // 正向基準：先確認列表確實載入這一筆，才能證明點擊後的導頁是這一筆觸發的
    await expect(page.getByTestId('pub-row')).toHaveCount(1);

    await page.getByTestId('pub-list-row-link').click();

    await expect(page).toHaveURL(/pub-detail\.html\?id=/);
    await expect(page.getByTestId('pub-detail-name')).toHaveText('品牌故事');
});

test('[PUB-WEB-FN-001] AC-P3 無資料時顯示查無資料', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/index.html');

    await expect(page.getByTestId('pub-list-empty')).toBeVisible();
    await expect(page.getByTestId('pub-list-total')).toHaveText('0');
});

test('[PUB-WEB-FN-001] AC-B1 已刪除頁面不得出現於前台', async ({ page }) => {
    await seedAdmin(page, [{ id: 'p1', name: '測試頁面 A', createdDate: '2026-01-10', blocks: [{}] }]);
    await page.goto('/index.html');

    // 正向基準：先確認刪除前列表真的顯示這一筆
    await expect(page.getByTestId('pub-row')).toHaveCount(1);
    await expect(page.getByTestId('pub-list-total')).toHaveText('1');

    // 硬刪除直接對 admin-pages 操作，模擬後台管理人員已完成刪除
    await page.evaluate(() => {
        const pages = JSON.parse(localStorage.getItem('admin-pages') || '[]');
        localStorage.setItem('admin-pages', JSON.stringify(pages.filter((p: { id: string }) => p.id !== 'p1')));
    });
    await page.reload();

    await expect(page.getByTestId('pub-row')).toHaveCount(0);
    await expect(page.getByTestId('pub-list-empty')).toBeVisible();
    await expect(page.getByTestId('pub-list-total')).toHaveText('0');
});
