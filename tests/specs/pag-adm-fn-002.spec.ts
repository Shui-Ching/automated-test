import { test, expect, Page } from '@playwright/test';
import { seedAdmin } from '../support/seed';

/**
 * [PAG-ADM-FN-002] 後台 新增頁面 — AC 驗收測試。
 *
 * 對應規格：srs/04_功能規劃/4.1_內容管理/4.1.2_PAG_頁面管理/[PAG-ADM-FN-002] 後台 新增頁面.md
 * 依契約 tests/contract/testid-map.json 的 page-create 頁面選擇器撰寫，資料透過
 * tests/support/seed.ts 的 seedAdmin() 填種，寫法見 tests/contract/seed.md。
 *
 * AC-P4「再次進入編輯頁時應完整還原」已補完後半段：2.6 實作 page-edit.html 後，
 * 這條測試會接續導向編輯頁，驗證粗體與項目清單格式正確從 storage 還原回編輯器。
 *
 * AC-B1「區塊版型每一組皆不可為空」（ac-coverage.json id 20）在 UI 上不可達成
 * ——區塊版型單選有預設值「左圖右文」，一般操作路徑無法讓它變成空值，此規則屬於
 * 防禦性檢核，data-store／field-validation.js 已實作但無法透過真實使用者互動觸發，
 * 因此未寫對應測試，見交接文件與本次對話紀錄。
 */

const contentEditor = (page: Page) => page.getByTestId('page-form-content-editor').locator('.ql-editor');

async function fillValidBaseForm(page: Page, overrides: { name?: string; date?: string } = {}) {
    await page.getByTestId('page-form-name').fill(overrides.name ?? '測試頁面');
    await page.getByTestId('page-form-date').fill(overrides.date ?? '2026-03-01');
    await page.getByTestId('page-form-block-image-input').setInputFiles('tests/fixtures/small.jpg');
}

test('[PAG-ADM-FN-002] AC-P1 以單組圖文區塊成功新增頁面', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');

    await page.getByTestId('page-form-name').fill('品牌故事');
    await page.getByTestId('page-form-date').fill('2026-03-01');
    const group = page.getByTestId('page-form-block-group').first();
    await group.locator('input[value="image-left"]').check();
    await page.getByTestId('page-form-block-image-input').setInputFiles('tests/fixtures/small.jpg');
    await page.getByTestId('page-form-block-caption').fill('主視覺圖說');

    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-toast')).toHaveText('新增成功');
    await page.waitForURL('**/page-list.html');

    const rows = page.getByTestId('page-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('data-page-name', '品牌故事');
    await expect(rows.first().locator('td').nth(3)).toHaveText('1 組');
});

test('[PAG-ADM-FN-002] AC-P2 以三組圖文區塊成功新增頁面', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');

    await page.getByTestId('page-form-name').fill('三組頁面');
    await page.getByTestId('page-form-date').fill('2026-03-01');

    await page.getByTestId('page-form-blocks-add').click();
    await page.getByTestId('page-form-blocks-add').click();
    await expect(page.getByTestId('page-form-block-group')).toHaveCount(3);

    const groups = page.getByTestId('page-form-block-group');
    await groups.nth(0).locator('input[value="image-left"]').check();
    await groups.nth(1).locator('input[value="image-right"]').check();
    await groups.nth(2).locator('input[value="image-left"]').check();

    const imageInputs = page.getByTestId('page-form-block-image-input');
    await imageInputs.nth(0).setInputFiles('tests/fixtures/small.jpg');
    await imageInputs.nth(1).setInputFiles('tests/fixtures/small.png');
    await imageInputs.nth(2).setInputFiles('tests/fixtures/small.jpg');

    await page.getByTestId('page-form-save').click();
    await expect(page.getByTestId('page-form-toast')).toHaveText('新增成功');
    await page.waitForURL('**/page-list.html');

    const rows = page.getByTestId('page-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('td').nth(3)).toHaveText('3 組');
});

test('[PAG-ADM-FN-002] AC-P3 移除圖文區塊後其後各組上移', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');

    await page.getByTestId('page-form-blocks-add').click();
    await page.getByTestId('page-form-blocks-add').click();
    const groups = page.getByTestId('page-form-block-group');
    await expect(groups).toHaveCount(3);

    await groups.nth(0).getByTestId('page-form-block-caption').fill('甲');
    await groups.nth(1).getByTestId('page-form-block-caption').fill('乙');
    await groups.nth(2).getByTestId('page-form-block-caption').fill('丙');

    // 正向基準：達 3 組時新增鈕停用，才能證明移除後「恢復可點擊」是移除造成的
    await expect(page.getByTestId('page-form-blocks-add')).toBeDisabled();

    await groups.nth(1).getByTestId('page-form-block-remove').click();

    await expect(page.getByTestId('page-form-block-group')).toHaveCount(2);
    const remaining = page.getByTestId('page-form-block-group');
    await expect(remaining.nth(0).getByTestId('page-form-block-caption')).toHaveValue('甲');
    await expect(remaining.nth(1).getByTestId('page-form-block-caption')).toHaveValue('丙');
    await expect(page.getByTestId('page-form-blocks-add')).toBeEnabled();
});

test('[PAG-ADM-FN-002] AC-P4 頁面內容以 HTML 格式保存', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');

    const editor = contentEditor(page);
    await editor.click();
    await page.keyboard.type('粗體文字');
    await editor.click({ clickCount: 3 });
    await page.getByTestId('page-form-content-bold').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.getByTestId('page-form-content-list').click();
    await page.keyboard.type('項目一');

    await fillValidBaseForm(page, { name: 'HTML內容頁' });
    await page.getByTestId('page-form-save').click();
    await expect(page.getByTestId('page-form-toast')).toHaveText('新增成功');
    await page.waitForURL('**/page-list.html');

    const pages = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-pages') || '[]'));
    const saved = pages.find((p: { name: string }) => p.name === 'HTML內容頁');
    expect(saved.content).toContain('<strong>');
    expect(saved.content).toContain('<ul>');
    expect(saved.content).toContain('<li>');

    // 後半段：再次進入編輯頁時，粗體與項目清單格式應完整還原（PAG-ADM-FN-003 AC-P1 的內容部分）
    await page.goto(`/admin/page-edit.html?id=${saved.id}`);
    // 項目一是在「粗體文字」被設成粗體之後、緊接著按 Enter 換行輸入的，Quill 會延續前一行的
    // 粗體格式，所以項目清單本身也是 <strong>，用 .first() 只鎖定第一段的粗體文字。
    const editorAfterReload = contentEditor(page);
    await expect(editorAfterReload.locator('strong').first()).toHaveText('粗體文字');
    await expect(editorAfterReload.locator('li')).toHaveText('項目一');
});

test('[PAG-ADM-FN-002] AC-B1 頁面名稱不可為空', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');
    await expect(page.getByTestId('page-form-name-error')).toBeHidden();

    await page.getByTestId('page-form-date').fill('2026-03-01');
    await page.getByTestId('page-form-block-image-input').setInputFiles('tests/fixtures/small.jpg');
    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-name-error')).toHaveText('請輸入頁面名稱');
    await expect(page.getByTestId('page-row')).toHaveCount(0);
});

test('[PAG-ADM-FN-002] AC-B1 頁面名稱不可僅輸入空白字元', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');
    await expect(page.getByTestId('page-form-name-error')).toBeHidden();

    await page.getByTestId('page-form-name').fill('   ');
    await page.getByTestId('page-form-name').blur();

    await expect(page.getByTestId('page-form-name-error')).toHaveText('頁面名稱不可為空白');
});

test('[PAG-ADM-FN-002] AC-B1 頁面名稱長度不可超過 50 字', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');
    await expect(page.getByTestId('page-form-name-error')).toBeHidden();

    await page.getByTestId('page-form-name').fill('a'.repeat(51));
    await page.getByTestId('page-form-name').blur();

    await expect(page.getByTestId('page-form-name-error')).toHaveText('頁面名稱長度不可超過 50 字');
});

test('[PAG-ADM-FN-002] AC-B1 頁面名稱不可與現存資料重疊', async ({ page }) => {
    await seedAdmin(page, [{ id: 'p1', name: '既有頁面', createdDate: '2026-01-01', blocks: [{}] }]);
    await page.goto('/admin/page-create.html');

    await fillValidBaseForm(page, { name: '既有頁面' });
    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-name-error')).toHaveText('此頁面名稱已存在');
    // 阻擋儲存代表沒有導頁：仍停留在新增頁，不是「儲存成功但列表恰好也顯示這筆」
    expect(page.url()).toContain('page-create.html');
});

test('[PAG-ADM-FN-002] AC-B1 建立日期不可為空', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');
    await expect(page.getByTestId('page-form-date-error')).toBeHidden();

    await page.getByTestId('page-form-name').fill('缺日期頁面');
    await page.getByTestId('page-form-block-image-input').setInputFiles('tests/fixtures/small.jpg');
    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-date-error')).toHaveText('請選擇建立日期');
});

test('[PAG-ADM-FN-002] AC-B1 區塊圖片每一組皆不可為空', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');
    await expect(page.getByTestId('page-form-block-image-error')).toBeHidden();

    await page.getByTestId('page-form-name').fill('缺圖片頁面');
    await page.getByTestId('page-form-date').fill('2026-03-01');
    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-block-image-error')).toHaveText('請上傳圖片');
});

test('[PAG-ADM-FN-002] AC-B1 區塊圖片檔案格式不符', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');
    await expect(page.getByTestId('page-form-block-image-error')).toBeHidden();

    await page.getByTestId('page-form-block-image-input').setInputFiles({
        name: 'photo.gif',
        mimeType: 'image/gif',
        buffer: Buffer.from('GIF89a'),
    });

    await expect(page.getByTestId('page-form-block-image-error')).toHaveText('檔案格式不符，僅支援 JPG、PNG');
});

test('[PAG-ADM-FN-002] AC-B1 區塊圖片檔案大小超過 2 MB', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');
    await expect(page.getByTestId('page-form-block-image-error')).toBeHidden();

    await page.getByTestId('page-form-block-image-input').setInputFiles({
        name: 'big.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    });

    await expect(page.getByTestId('page-form-block-image-error')).toHaveText('檔案大小不可超過 2 MB');
});

test('[PAG-ADM-FN-002] AC-B1 圖說文字長度不可超過 100 字', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');
    await expect(page.getByTestId('page-form-block-caption-error')).toBeHidden();

    await page.getByTestId('page-form-block-caption').fill('字'.repeat(101));
    await page.getByTestId('page-form-block-caption').blur();

    await expect(page.getByTestId('page-form-block-caption-error')).toHaveText('圖說文字長度不可超過 100 字');
});

test('[PAG-ADM-FN-002] AC-B1 補充說明長度不可超過 500 字', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');
    await expect(page.getByTestId('page-form-note-error')).toBeHidden();

    await page.getByTestId('page-form-note').fill('字'.repeat(501));
    await page.getByTestId('page-form-note').blur();

    await expect(page.getByTestId('page-form-note-error')).toHaveText('補充說明長度不可超過 500 字');
});

test('[PAG-ADM-FN-002] AC-B2 圖文區塊已達上限', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');

    // 正向基準：未達上限時是可點擊的
    await expect(page.getByTestId('page-form-blocks-add')).toBeEnabled();
    await page.getByTestId('page-form-blocks-add').click();
    await expect(page.getByTestId('page-form-blocks-add')).toBeEnabled();
    await page.getByTestId('page-form-blocks-add').click();

    await expect(page.getByTestId('page-form-block-group')).toHaveCount(3);
    await expect(page.getByTestId('page-form-blocks-add')).toBeDisabled();
});

test('[PAG-ADM-FN-002] AC-B3 圖文區塊不可移除至零組', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');

    // 正向基準：2 組時移除按鈕應可見，才能證明 1 組時的「不可見」是規則生效而非畫面壞了
    await page.getByTestId('page-form-blocks-add').click();
    await expect(page.getByTestId('page-form-block-remove').first()).toBeVisible();

    await page.getByTestId('page-form-block-remove').first().click();
    await expect(page.getByTestId('page-form-block-group')).toHaveCount(1);
    await expect(page.getByTestId('page-form-block-remove')).toBeHidden();
});

test('[PAG-ADM-FN-002] NFR-004 資料寫入失敗時中止作業並提示、保留已輸入內容、不留半筆資料', async ({ page }) => {
    // 寫入本來不會自己失敗，用 ?forceWriteFailure=1 注入（見 data-store.js writeAll() 的說明）。
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html?forceWriteFailure=1');

    await page.getByTestId('page-form-name').fill('寫入失敗測試頁');
    await page.getByTestId('page-form-date').fill('2026-03-01');
    await page.getByTestId('page-form-block-image-input').setInputFiles('tests/fixtures/small.jpg');
    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-toast')).toHaveText('系統忙碌中，請稍後再試');
    // 停留原頁：不會被導去 page-list.html，且已輸入內容原封不動。
    expect(page.url()).toContain('page-create.html');
    await expect(page.getByTestId('page-form-name')).toHaveValue('寫入失敗測試頁');

    const pages = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-pages') || '[]'));
    expect(pages).toHaveLength(0);
});
