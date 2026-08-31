import type { Page } from '@playwright/test';

/**
 * 每條測試前重置資料狀態。寫法與理由見 tests/contract/seed.md ——
 * 用 page.addInitScript 而非呼叫 data-store.js 的函式，是因為 addInitScript
 * 在頁面自身任何 script（含 data-store.js）執行前就跑，那時候 window.PageStore
 * 還不存在，只能直接寫入它們讀寫的同一把 localStorage／sessionStorage key。
 */

export interface SeedPage {
    id: string;
    name: string;
    createdDate: string;
    /** 本階段（頁面列表）只讀取 blocks.length，區塊內部欄位形狀待新增／編輯頁面實作時才有意義 */
    blocks: unknown[];
    content?: string;
    note?: string;
}

const PAGES_STORAGE_KEY = 'admin-pages';
const SESSION_STORAGE_KEY = 'admin-session';
const SEEDED_SENTINEL_KEY = 'admin-pages-seeded';

/**
 * 同時建立頁面資料與登入狀態，因為後台頁面一律被 auth-guard.js 擋，沒有登入狀態進不去。
 *
 * `admin-pages` 的寫入包一層 sentinel 判斷（`SEEDED_SENTINEL_KEY`）：`page.addInitScript`
 * 在同一個分頁的每一次導覽都會重跑，Phase 2.4 起的流程會真的跨頁導（新增／編輯 → 儲存 →
 * 回列表），若每次導覽都不加判斷重寫 `admin-pages`，UI 操作寫入的資料會在下一次導覽時被
 * 種子資料整個蓋掉——這條在只有單頁操作的頁面列表測試（Phase 2.1～2.3）不會出現，是
 * 2.4 實作新增頁面、寫第一條跨頁測試時才發現的。sentinel 存在 sessionStorage，
 * 同分頁的導覽之間不會被清掉，只在下一個全新分頁（新的 test）才會是空的。
 */
export async function seedAdmin(page: Page, pages: SeedPage[]): Promise<void> {
    await page.addInitScript(
        ([pagesKey, sessionKey, sentinelKey, seedData]) => {
            if (!sessionStorage.getItem(sentinelKey as string)) {
                localStorage.setItem(pagesKey as string, JSON.stringify(seedData));
                sessionStorage.setItem(sentinelKey as string, '1');
            }
            sessionStorage.setItem(
                sessionKey as string,
                JSON.stringify({ account: 'Admin', lastActiveAt: Date.now(), timeoutSeconds: 1800 })
            );
        },
        [PAGES_STORAGE_KEY, SESSION_STORAGE_KEY, SEEDED_SENTINEL_KEY, pages]
    );
}
