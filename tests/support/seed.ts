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

/** 同時建立頁面資料與登入狀態，因為後台頁面一律被 auth-guard.js 擋，沒有登入狀態進不去。 */
export async function seedAdmin(page: Page, pages: SeedPage[]): Promise<void> {
    await page.addInitScript(
        ([pagesKey, sessionKey, seedData]) => {
            localStorage.setItem(pagesKey as string, JSON.stringify(seedData));
            sessionStorage.setItem(
                sessionKey as string,
                JSON.stringify({ account: 'Admin', lastActiveAt: Date.now(), timeoutSeconds: 1800 })
            );
        },
        [PAGES_STORAGE_KEY, SESSION_STORAGE_KEY, pages]
    );
}
