import { test, expect } from '@playwright/test';
import { seedAdmin } from '../support/seed';

/**
 * [PUB-WEB-FN-001] 前台 前台頁面列表 — AC 驗收測試。
 *
 * 對應規格：srs/04_功能規劃/4.2_前台展示/4.2.1_PUB_頁面瀏覽/[PUB-WEB-FN-001] 前台 前台頁面列表.md
 * 依契約 tests/contract/testid-map.json 的 pub-list 頁面選擇器撰寫，資料透過
 * tests/support/seed.ts 的 seedAdmin() 填種，寫法見 tests/contract/seed.md「前台頁面沿用同一套 seedAdmin」一節。
 *
 * AC-P1 三筆種子資料的 createdDate 互不相同，只驗證主要排序（建立日期新至舊），
 * 不涉及次要排序。同一 createdDate 時的次要排序（依「建檔時序」由新至舊，見
 * `[PAG-ADM-FN-002]` 特殊規則 4／`data-store.js` 的 `compareBuildOrder`）由 AC-P4 驗證：
 * `buildSeq` 是 `createPage()` 寫入時才產生的值，`seedAdmin` 填種的資料沒有這個欄位，
 * 所以 AC-P4 改用動態 import 呼叫真正的 `createPage()`，而不是直接塞種子資料。
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

test('[PUB-WEB-FN-001] AC-P4 同一建立日期依建檔時序排序', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/index.html');

    // buildSeq（建檔時序）由 createPage() 寫入時才產生，seedAdmin 填不出這個欄位，
    // 改用動態 import 呼叫真正的 data-store.js，跟應用程式本身走同一條寫入路徑
    // （見 tests/contract/seed.md「buildSeq」一節）。先建立的「甲頁面」buildSeq 較小，
    // 後建立的「乙頁面」buildSeq 較大，同一 createdDate 時應排在較新（乙頁面）在前。
    await page.evaluate(async () => {
        const { createPage } = await import('/assets/js/data-store.js');
        createPage({ name: '甲頁面', createdDate: '2026-04-01', blocks: [{}] });
        createPage({ name: '乙頁面', createdDate: '2026-04-01', blocks: [{}] });
    });
    await page.reload();

    const rows = page.getByTestId('pub-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-page-name', '乙頁面');
    await expect(rows.nth(1)).toHaveAttribute('data-page-name', '甲頁面');
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
