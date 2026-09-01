import { test, expect } from '@playwright/test';
import contract from './testid-map.json';
import { seedAdmin } from '../support/seed';

/**
 * 契約檢查關卡：跑在所有功能測試之前。
 *
 * 目的是把兩種完全不同的失敗分開：
 *   契約紅 → 前端沒照契約實作，或契約過期。派給前端，但這不是 bug。
 *   契約綠 + 功能紅 → testid 都在、行為不對。這才是真 bug。
 *
 * 沒有這道關卡，PM 端寫測試這個分工不成立——因為 PM 端是對著看不到的 DOM 寫選擇器，
 * 選擇器打錯時的報告會顯示「找不到元素」，看起來跟功能壞掉一模一樣。
 */
for (const page of contract.pages) {
    test(`契約檢查：${page.spec} 的 data-testid 全部存在`, async ({ page: browserPage }) => {
        // 無資料 + 已登入是多數後台頁面的最小共同起始狀態：沒有登入狀態會被 auth-guard 導回登入頁，
        // 登入頁本身多做這步不影響結果（login.js 進頁就會清掉殘留的登入狀態）。
        // page-edit 是例外：它需要 `?id=` 對應到一筆存在的資料才不會被 EX-1（資料不存在）導回列表，
        // 因此該條目在契約檔自帶 `seed`，這裡優先使用；其餘頁面沒有這個欄位，維持空陣列。
        await seedAdmin(browserPage, page.seed ?? []);
        await browserPage.goto(page.url);

        // 先確認頁面本身真的載入了。少了這一步，頁面 404 時下面每一條 expect 都會失敗，
        // 但報告會列出七條「找不到元素」，掩蓋掉「其實是頁面根本打不開」這個真正的原因。
        await expect(browserPage.locator('body')).toBeVisible();

        for (const [testid, description] of Object.entries(page.testids)) {
            await expect(
                browserPage.getByTestId(testid),
                `${testid}（${description}）未出現在 ${page.url}`
            ).toHaveCount(1);
        }

        // block_testids 是重複型 testid（每組圖文區塊各一份），數量隨種子資料而定，
        // 契約檢查只確認「至少出現一次」，不比對確切數量。`note` 鍵是說明文字，不是 testid，跳過。
        for (const [testid, description] of Object.entries(page.block_testids ?? {})) {
            if (testid === 'note') continue;
            const count = await browserPage.getByTestId(testid).count();
            expect(count, `${testid}（${description}）未出現在 ${page.url}`).toBeGreaterThan(0);
        }
    });
}
