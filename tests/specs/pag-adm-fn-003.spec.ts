import { test, expect, Page } from '@playwright/test';
import { seedAdmin } from '../support/seed';

/**
 * [PAG-ADM-FN-003] 後台 編輯頁面 — AC 驗收測試。
 *
 * 對應規格：srs/04_功能規劃/4.1_內容管理/4.1.2_PAG_頁面管理/[PAG-ADM-FN-003] 後台 編輯頁面.md
 * 依契約 tests/contract/testid-map.json 的 page-edit 頁面選擇器撰寫（與 page-create 共用同一批
 * page-form-* testid），資料透過 tests/support/seed.ts 的 seedAdmin() 填種，寫法見
 * tests/contract/seed.md。
 *
 * AC-P1（帶入既有圖片縮圖）刻意不用 seedAdmin 填假的 blocks[].image key——那個 key 不會對應到
 * IndexedDB 裡真的存在的 Blob（seedAdmin 只寫 localStorage／sessionStorage，見 seed.md 的已知落差），
 * 縮圖會因為 getImageBlob() 找不到資料而永遠是空的，測不出「縮圖正確渲染」這件事。改成先用
 * page-create.html 的真實 UI 流程建立一筆帶真圖片的頁面，圖片會經由 saveImageBlob() 寫進同一個
 * 瀏覽器 context 的 IndexedDB，再從頁面列表點「編輯」進入本頁，這樣讀到的縮圖就是真的。
 * 其餘 AC 只需要驗證版型／圖說／筆數這類不依賴縮圖是否解出來的行為，用 seedAdmin 的假 image key
 * 已經足夠（區塊圖片是否存在只看 existingImageId 是否為真值，不要求 Blob 真的存在）。
 *
 * AC-B1「區塊版型每一組皆不可為空」（ac-coverage.json id 39）沿用 PAG-ADM-FN-002 的既有結論
 * （見該檔第 15～18 行註解）：單選有預設值，一般操作路徑無法讓它變空值，未寫對應測試。
 */

const contentEditor = (page: Page) => page.getByTestId('page-form-content-editor').locator('.ql-editor');

const baseSeed = [
    {
        id: 'p-story',
        name: '品牌故事',
        createdDate: '2026-03-01',
        blocks: [
            { layout: 'image-left', image: 'img-fixture-1', caption: '甲' },
            { layout: 'image-right', image: 'img-fixture-2', caption: '乙' },
        ],
        content: '<p>原始內容</p>',
        note: '原始補充說明',
    },
];

async function readSavedPage(page: Page, id: string) {
    const pages = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-pages') || '[]'));
    return pages.find((p: { id: string }) => p.id === id);
}

test('[PAG-ADM-FN-003] AC-P1 正確帶入既有資料與全部圖文區塊', async ({ page }) => {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');

    await page.getByTestId('page-form-name').fill('品牌故事');
    await page.getByTestId('page-form-date').fill('2026-03-01');
    await contentEditor(page).click();
    await page.keyboard.type('品牌故事內容');
    await page.getByTestId('page-form-note').fill('補充說明內容');

    const createGroups = page.getByTestId('page-form-block-group');
    await createGroups.nth(0).locator('input[value="image-left"]').check();
    await createGroups.nth(0).getByTestId('page-form-block-image-input').setInputFiles('tests/fixtures/small.jpg');
    await createGroups.nth(0).getByTestId('page-form-block-caption').fill('圖說一');

    await page.getByTestId('page-form-blocks-add').click();
    await createGroups.nth(1).locator('input[value="image-right"]').check();
    await createGroups.nth(1).getByTestId('page-form-block-image-input').setInputFiles('tests/fixtures/small.png');
    await createGroups.nth(1).getByTestId('page-form-block-caption').fill('圖說二');

    await page.getByTestId('page-form-save').click();
    await page.waitForURL('**/page-list.html');

    await page.getByTestId('page-list-row-edit').click();
    await page.waitForURL(/page-edit\.html\?id=/);

    await expect(page.getByTestId('page-form-name')).toHaveValue('品牌故事');
    await expect(page.getByTestId('page-form-date')).toHaveValue('2026-03-01');
    await expect(page.getByTestId('page-form-note')).toHaveValue('補充說明內容');
    await expect(contentEditor(page)).toContainText('品牌故事內容');

    const groups = page.getByTestId('page-form-block-group');
    await expect(groups).toHaveCount(2);

    await expect(groups.nth(0).locator('input[value="image-left"]')).toBeChecked();
    await expect(groups.nth(0).getByTestId('page-form-block-image-preview')).toBeVisible();
    await expect(groups.nth(0).getByTestId('page-form-block-caption')).toHaveValue('圖說一');

    await expect(groups.nth(1).locator('input[value="image-right"]')).toBeChecked();
    await expect(groups.nth(1).getByTestId('page-form-block-image-preview')).toBeVisible();
    await expect(groups.nth(1).getByTestId('page-form-block-caption')).toHaveValue('圖說二');
});

test('[PAG-ADM-FN-003] AC-P2 修改指定組別之版型', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');

    const groups = page.getByTestId('page-form-block-group');
    await groups.nth(1).locator('input[value="image-left"]').check();
    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-toast')).toHaveText('儲存成功');
    await page.waitForURL('**/page-list.html');

    const saved = await readSavedPage(page, 'p-story');
    expect(saved.blocks[0].layout).toBe('image-left');
    expect(saved.blocks[1].layout).toBe('image-left');

    // 第 1 組原本就是 image-left：光看數值相同不足以證明「沒被連動改到」，
    // 額外核對第 1 組的圖說與圖片 key 仍是種子資料的原值，才能證明整組沒被覆寫。
    expect(saved.blocks[0].caption).toBe('甲');
    expect(saved.blocks[0].image).toBe('img-fixture-1');
});

test('[PAG-ADM-FN-003] AC-P3 新增圖文區塊至三組', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');

    await page.getByTestId('page-form-blocks-add').click();
    const groups = page.getByTestId('page-form-block-group');
    await expect(groups).toHaveCount(3);

    await groups.nth(2).locator('input[value="image-left"]').check();
    await groups.nth(2).getByTestId('page-form-block-image-input').setInputFiles('tests/fixtures/small.jpg');
    await groups.nth(2).getByTestId('page-form-block-caption').fill('丙');

    await page.getByTestId('page-form-save').click();
    await page.waitForURL('**/page-list.html');

    const rows = page.getByTestId('page-row');
    await expect(rows.first().locator('td').nth(3)).toHaveText('3 組');
});

test('[PAG-ADM-FN-003] AC-P4 移除圖文區塊後儲存', async ({ page }) => {
    await seedAdmin(page, [
        {
            ...baseSeed[0],
            blocks: [
                { layout: 'image-left', image: 'img-fixture-1', caption: '甲' },
                { layout: 'image-right', image: 'img-fixture-2', caption: '乙' },
                { layout: 'image-left', image: 'img-fixture-3', caption: '丙' },
            ],
        },
    ]);
    await page.goto('/admin/page-edit.html?id=p-story');

    const groups = page.getByTestId('page-form-block-group');
    await expect(groups).toHaveCount(3);
    await groups.nth(1).getByTestId('page-form-block-remove').click();
    await expect(page.getByTestId('page-form-block-group')).toHaveCount(2);

    await page.getByTestId('page-form-save').click();
    await page.waitForURL('**/page-list.html');

    const saved = await readSavedPage(page, 'p-story');
    expect(saved.blocks.map((b: { caption: string }) => b.caption)).toEqual(['甲', '丙']);

    const rows = page.getByTestId('page-row');
    await expect(rows.first().locator('td').nth(3)).toHaveText('2 組');
});

test('[PAG-ADM-FN-003] AC-P5 維持原頁面名稱儲存', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');

    await page.getByTestId('page-form-note').fill('更新後的補充說明');
    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-name-error')).toBeHidden();
    await expect(page.getByTestId('page-form-toast')).toHaveText('儲存成功');
    await page.waitForURL('**/page-list.html');

    const saved = await readSavedPage(page, 'p-story');
    expect(saved.note).toBe('更新後的補充說明');
});

test('[PAG-ADM-FN-003] AC-P6 返回不套用區塊移除', async ({ page }) => {
    await seedAdmin(page, [
        {
            ...baseSeed[0],
            blocks: [
                { layout: 'image-left', image: 'img-fixture-1', caption: '甲' },
                { layout: 'image-right', image: 'img-fixture-2', caption: '乙' },
                { layout: 'image-left', image: 'img-fixture-3', caption: '丙' },
            ],
        },
    ]);
    await page.goto('/admin/page-edit.html?id=p-story');

    const groups = page.getByTestId('page-form-block-group');
    await expect(groups).toHaveCount(3);
    await groups.nth(1).getByTestId('page-form-block-remove').click();
    await expect(page.getByTestId('page-form-block-group')).toHaveCount(2);

    await page.getByTestId('page-form-cancel').click();
    await page.waitForURL('**/page-list.html');

    await page.goto('/admin/page-edit.html?id=p-story');
    const restoredGroups = page.getByTestId('page-form-block-group');
    await expect(restoredGroups).toHaveCount(3);
    await expect(restoredGroups.nth(0).getByTestId('page-form-block-caption')).toHaveValue('甲');
    await expect(restoredGroups.nth(1).getByTestId('page-form-block-caption')).toHaveValue('乙');
    await expect(restoredGroups.nth(2).getByTestId('page-form-block-caption')).toHaveValue('丙');
});

test('[PAG-ADM-FN-003] AC-B1 頁面名稱不可為空', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');
    await expect(page.getByTestId('page-form-name-error')).toBeHidden();

    await page.getByTestId('page-form-name').fill('');
    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-name-error')).toHaveText('請輸入頁面名稱');
    expect(page.url()).toContain('page-edit.html');
});

test('[PAG-ADM-FN-003] AC-B1 頁面名稱不可僅輸入空白字元', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');
    await expect(page.getByTestId('page-form-name-error')).toBeHidden();

    await page.getByTestId('page-form-name').fill('   ');
    await page.getByTestId('page-form-name').blur();

    await expect(page.getByTestId('page-form-name-error')).toHaveText('頁面名稱不可為空白');
});

test('[PAG-ADM-FN-003] AC-B1 頁面名稱長度不可超過 50 字', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');
    await expect(page.getByTestId('page-form-name-error')).toBeHidden();

    await page.getByTestId('page-form-name').fill('a'.repeat(51));
    await page.getByTestId('page-form-name').blur();

    await expect(page.getByTestId('page-form-name-error')).toHaveText('頁面名稱長度不可超過 50 字');
});

test('[PAG-ADM-FN-003] AC-B1 頁面名稱不可與現存資料重疊（排除本筆）', async ({ page }) => {
    await seedAdmin(page, [
        ...baseSeed,
        { id: 'p-other', name: '其他頁面', createdDate: '2026-02-01', blocks: [{ layout: 'image-left', image: 'img-x', caption: '' }] },
    ]);
    await page.goto('/admin/page-edit.html?id=p-story');

    await page.getByTestId('page-form-name').fill('其他頁面');
    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-name-error')).toHaveText('此頁面名稱已存在');
    expect(page.url()).toContain('page-edit.html');
});

test('[PAG-ADM-FN-003] AC-B1 建立日期不可為空', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');
    await expect(page.getByTestId('page-form-date-error')).toBeHidden();

    await page.getByTestId('page-form-date').fill('');
    await page.getByTestId('page-form-save').click();

    await expect(page.getByTestId('page-form-date-error')).toHaveText('請選擇建立日期');
});

test('[PAG-ADM-FN-003] AC-B1 區塊圖片每一組皆不可為空', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');

    const firstGroup = page.getByTestId('page-form-block-group').first();
    // 正向基準：既有圖片的清除鈕預設可見，才能證明清除後「必須重新上傳」是規則生效，
    // 不是這顆按鈕本來就沒作用。
    await expect(firstGroup.getByTestId('page-form-block-image-remove')).toBeVisible();
    await firstGroup.getByTestId('page-form-block-image-remove').click();
    await expect(firstGroup.getByTestId('page-form-block-image-preview')).toBeHidden();

    await page.getByTestId('page-form-save').click();

    await expect(firstGroup.getByTestId('page-form-block-image-error')).toHaveText('請上傳圖片');
});

test('[PAG-ADM-FN-003] AC-B1 區塊圖片檔案格式不符', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');

    const firstGroup = page.getByTestId('page-form-block-group').first();
    await expect(firstGroup.getByTestId('page-form-block-image-error')).toBeHidden();

    await firstGroup.getByTestId('page-form-block-image-input').setInputFiles({
        name: 'photo.gif',
        mimeType: 'image/gif',
        buffer: Buffer.from('GIF89a'),
    });

    await expect(firstGroup.getByTestId('page-form-block-image-error')).toHaveText('檔案格式不符，僅支援 JPG、PNG');
});

test('[PAG-ADM-FN-003] AC-B1 區塊圖片檔案大小超過 2 MB', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');

    const firstGroup = page.getByTestId('page-form-block-group').first();
    await expect(firstGroup.getByTestId('page-form-block-image-error')).toBeHidden();

    await firstGroup.getByTestId('page-form-block-image-input').setInputFiles({
        name: 'big.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    });

    await expect(firstGroup.getByTestId('page-form-block-image-error')).toHaveText('檔案大小不可超過 2 MB');
});

test('[PAG-ADM-FN-003] AC-B1 圖說文字長度不可超過 100 字', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');

    const firstGroup = page.getByTestId('page-form-block-group').first();
    await expect(firstGroup.getByTestId('page-form-block-caption-error')).toBeHidden();

    await firstGroup.getByTestId('page-form-block-caption').fill('字'.repeat(101));
    await firstGroup.getByTestId('page-form-block-caption').blur();

    await expect(firstGroup.getByTestId('page-form-block-caption-error')).toHaveText('圖說文字長度不可超過 100 字');
});

test('[PAG-ADM-FN-003] AC-B1 補充說明長度不可超過 500 字', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');
    await expect(page.getByTestId('page-form-note-error')).toBeHidden();

    await page.getByTestId('page-form-note').fill('字'.repeat(501));
    await page.getByTestId('page-form-note').blur();

    await expect(page.getByTestId('page-form-note-error')).toHaveText('補充說明長度不可超過 500 字');
});

test('[PAG-ADM-FN-003] AC-B2 圖文區塊已達上限', async ({ page }) => {
    await seedAdmin(page, baseSeed);
    await page.goto('/admin/page-edit.html?id=p-story');

    // 正向基準：2 組時是可點擊的
    await expect(page.getByTestId('page-form-blocks-add')).toBeEnabled();
    await page.getByTestId('page-form-blocks-add').click();
    await expect(page.getByTestId('page-form-block-group')).toHaveCount(3);

    await expect(page.getByTestId('page-form-blocks-add')).toBeDisabled();
});
