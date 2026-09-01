import { test, expect, Page } from '@playwright/test';
import { seedAdmin } from '../support/seed';

/**
 * [PUB-WEB-FN-002] 前台 頁面內容顯示 — AC 驗收測試。
 *
 * 對應規格：srs/04_功能規劃/4.2_前台展示/4.2.1_PUB_頁面瀏覽/[PUB-WEB-FN-002] 前台 頁面內容顯示.md
 * 依契約 tests/contract/testid-map.json 的 pub-detail 頁面選擇器撰寫。
 *
 * AC-P1～P3 需要驗證圖片與圖說文字的實際排列方向，這類版型類驗收不能只驗 class
 * 名稱存不存在（CSS 沒載入時 class 照樣在，測試照樣綠燈），要量測 boundingBox 的
 * 實際幾何位置，見 tests/contract/assertion-types.md 第 4 節與 docs/project-plan.md
 * 風險 R-7。要驗證縮圖真的渲染出來，改用 tests/contract/seed.md「image key 的
 * IndexedDB 填種缺口」一節的做法：先跑一遍 page-create.html 的真實 UI 流程上傳圖片，
 * 讓 Blob 透過應用程式自己的程式碼寫進同一個瀏覽器 context 的 IndexedDB，
 * 而不是用 seedAdmin 填一個找不到對應 Blob 的假 image key。
 */

async function createPageViaAdmin(
    page: Page,
    options: {
        name: string;
        date?: string;
        blocks: { layout: 'image-left' | 'image-right'; caption: string; file?: string }[];
        contentHtml?: (page: Page) => Promise<void>;
        note?: string;
    }
) {
    await seedAdmin(page, []);
    await page.goto('/admin/page-create.html');

    await page.getByTestId('page-form-name').fill(options.name);
    await page.getByTestId('page-form-date').fill(options.date ?? '2026-03-01');

    if (options.contentHtml) {
        await options.contentHtml(page);
    }

    for (let i = 1; i < options.blocks.length; i += 1) {
        await page.getByTestId('page-form-blocks-add').click();
    }

    const groups = page.getByTestId('page-form-block-group');
    const imageInputs = page.getByTestId('page-form-block-image-input');
    for (let i = 0; i < options.blocks.length; i += 1) {
        const block = options.blocks[i];
        await groups.nth(i).locator(`input[value="${block.layout}"]`).check();
        await imageInputs.nth(i).setInputFiles(block.file ?? 'tests/fixtures/small.jpg');
        await groups.nth(i).getByTestId('page-form-block-caption').fill(block.caption);
    }

    if (options.note) {
        await page.getByTestId('page-form-note').fill(options.note);
    }

    await page.getByTestId('page-form-save').click();
    await page.waitForURL('**/page-list.html');

    await page.goto('/index.html');
    // data-page-name 掛在 pub-row 自己身上，不是子孫元素，用屬性選擇器直接鎖定該列，
    // 不用 .filter({ has }) —— has 找的是描述元素，鎖不到掛在自己身上的屬性。
    await page
        .locator(`[data-testid="pub-row"][data-page-name="${options.name}"]`)
        .getByTestId('pub-list-row-link')
        .click();
    await page.waitForURL('**/pub-detail.html?**');
}

test('[PUB-WEB-FN-002] AC-P1 左圖右文版型正確呈現', async ({ page }) => {
    await createPageViaAdmin(page, {
        name: '品牌故事',
        blocks: [{ layout: 'image-left', caption: '主視覺圖說' }],
    });

    // 正向基準：先確認頁面確實載入且主標題正確，再量測幾何位置
    await expect(page.getByTestId('pub-detail-name')).toHaveText('品牌故事');

    const imageBox = await page.getByTestId('pub-detail-block-image').boundingBox();
    const captionBox = await page.getByTestId('pub-detail-block-caption').boundingBox();
    expect(imageBox).not.toBeNull();
    expect(captionBox).not.toBeNull();
    expect(imageBox!.x).toBeLessThan(captionBox!.x);
});

test('[PUB-WEB-FN-002] AC-P2 右圖左文版型正確呈現', async ({ page }) => {
    await createPageViaAdmin(page, {
        name: '服務據點',
        blocks: [{ layout: 'image-right', caption: '據點圖說' }],
    });

    await expect(page.getByTestId('pub-detail-name')).toHaveText('服務據點');

    const imageBox = await page.getByTestId('pub-detail-block-image').boundingBox();
    const captionBox = await page.getByTestId('pub-detail-block-caption').boundingBox();
    expect(imageBox).not.toBeNull();
    expect(captionBox).not.toBeNull();
    expect(imageBox!.x).toBeGreaterThan(captionBox!.x);
});

test('[PUB-WEB-FN-002] AC-P3 多組圖文區塊依序呈現且版型各自獨立', async ({ page }) => {
    await createPageViaAdmin(page, {
        name: '產品介紹',
        blocks: [
            { layout: 'image-left', caption: '甲' },
            { layout: 'image-right', caption: '乙' },
            { layout: 'image-left', caption: '丙' },
        ],
    });

    await expect(page.getByTestId('pub-detail-name')).toHaveText('產品介紹');

    const blocks = page.getByTestId('pub-detail-block');
    await expect(blocks).toHaveCount(3);
    await expect(blocks.nth(0).getByTestId('pub-detail-block-caption')).toHaveText('甲');
    await expect(blocks.nth(1).getByTestId('pub-detail-block-caption')).toHaveText('乙');
    await expect(blocks.nth(2).getByTestId('pub-detail-block-caption')).toHaveText('丙');

    // 由上而下順序：用 y 座標確認畫面實際呈現順序，不是只信任 DOM 順序
    const boxes = await Promise.all([blocks.nth(0).boundingBox(), blocks.nth(1).boundingBox(), blocks.nth(2).boundingBox()]);
    expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
    expect(boxes[1]!.y).toBeLessThan(boxes[2]!.y);

    // 第 1、3 組圖片置左，第 2 組圖片置右
    const image0 = await blocks.nth(0).getByTestId('pub-detail-block-image').boundingBox();
    const caption0 = await blocks.nth(0).getByTestId('pub-detail-block-caption').boundingBox();
    expect(image0!.x).toBeLessThan(caption0!.x);

    const image1 = await blocks.nth(1).getByTestId('pub-detail-block-image').boundingBox();
    const caption1 = await blocks.nth(1).getByTestId('pub-detail-block-caption').boundingBox();
    expect(image1!.x).toBeGreaterThan(caption1!.x);

    const image2 = await blocks.nth(2).getByTestId('pub-detail-block-image').boundingBox();
    const caption2 = await blocks.nth(2).getByTestId('pub-detail-block-caption').boundingBox();
    expect(image2!.x).toBeLessThan(caption2!.x);
});

test('[PUB-WEB-FN-002] AC-P4 頁面內容以 HTML 原樣渲染', async ({ page }) => {
    await createPageViaAdmin(page, {
        name: '品牌故事',
        blocks: [{ layout: 'image-left', caption: '主視覺圖說' }],
        contentHtml: async (p) => {
            const editor = p.getByTestId('page-form-content-editor').locator('.ql-editor');
            await editor.click();
            await p.keyboard.type('粗體文字');
            await editor.click({ clickCount: 3 });
            await p.getByTestId('page-form-content-bold').click();
            await p.keyboard.press('End');
            await p.keyboard.press('Enter');
            await p.getByTestId('page-form-content-list').click();
            await p.keyboard.type('項目一');
        },
    });

    await expect(page.getByTestId('pub-detail-content-section')).toBeVisible();
    const content = page.getByTestId('pub-detail-content');
    // 項目一是在「粗體文字」被設成粗體之後、緊接著按 Enter 換行輸入的，Quill 會延續
    // 前一行的粗體格式，所以項目清單本身也是 <strong>，用 .first() 只鎖定第一段的粗體文字
    // （同 pag-adm-fn-002.spec.ts AC-P4 後半段的既有寫法）。
    await expect(content.locator('strong').first()).toHaveText('粗體文字');
    await expect(content.locator('li')).toHaveText('項目一');
    // 不得顯示 HTML 標籤原始碼：innerText 應該讀到渲染後的文字，不是帶尖括號的原始標籤
    await expect(content).not.toContainText('<strong>');
    await expect(content).not.toContainText('<li>');
});

test('[PUB-WEB-FN-002] AC-P5 中間篇同時顯示上一則與下一則', async ({ page }) => {
    // 排序基準是前台列表的預設排序（建立日期新到舊），「由前至後」對應列表由上到下：
    // 甲頁面（最新）在最上面，丙頁面（最舊）在最下面
    await seedAdmin(page, [
        { id: 'p1', name: '甲頁面', createdDate: '2026-01-30', blocks: [{}] },
        { id: 'p2', name: '乙頁面', createdDate: '2026-01-20', blocks: [{}] },
        { id: 'p3', name: '丙頁面', createdDate: '2026-01-10', blocks: [{}] },
    ]);
    await page.goto('/pub-detail.html?id=p2');

    await expect(page.getByTestId('pub-detail-name')).toHaveText('乙頁面');
    await expect(page.getByTestId('pub-detail-prev')).toBeVisible();
    await expect(page.getByTestId('pub-detail-prev')).toHaveText('甲頁面');
    await expect(page.getByTestId('pub-detail-next')).toBeVisible();
    await expect(page.getByTestId('pub-detail-next')).toHaveText('丙頁面');
});

test('[PUB-WEB-FN-002] AC-P6 第一篇不顯示上一則', async ({ page }) => {
    await seedAdmin(page, [
        { id: 'p1', name: '甲頁面', createdDate: '2026-01-30', blocks: [{}] },
        { id: 'p2', name: '乙頁面', createdDate: '2026-01-20', blocks: [{}] },
        { id: 'p3', name: '丙頁面', createdDate: '2026-01-10', blocks: [{}] },
    ]);
    await page.goto('/pub-detail.html?id=p1');

    // 正向基準：先確認頁面確實載入到「甲頁面」、且下一則看得到，才斷言上一則不存在
    await expect(page.getByTestId('pub-detail-name')).toHaveText('甲頁面');
    await expect(page.getByTestId('pub-detail-next')).toBeVisible();
    await expect(page.getByTestId('pub-detail-next')).toHaveText('乙頁面');
    await expect(page.getByTestId('pub-detail-prev')).toBeHidden();
});

test('[PUB-WEB-FN-002] AC-P7 最後一篇不顯示下一則', async ({ page }) => {
    await seedAdmin(page, [
        { id: 'p1', name: '甲頁面', createdDate: '2026-01-30', blocks: [{}] },
        { id: 'p2', name: '乙頁面', createdDate: '2026-01-20', blocks: [{}] },
        { id: 'p3', name: '丙頁面', createdDate: '2026-01-10', blocks: [{}] },
    ]);
    await page.goto('/pub-detail.html?id=p3');

    await expect(page.getByTestId('pub-detail-name')).toHaveText('丙頁面');
    await expect(page.getByTestId('pub-detail-prev')).toBeVisible();
    await expect(page.getByTestId('pub-detail-prev')).toHaveText('乙頁面');
    await expect(page.getByTestId('pub-detail-next')).toBeHidden();
});

test('[PUB-WEB-FN-002] AC-P8 僅一筆資料時上下則皆不顯示', async ({ page }) => {
    await seedAdmin(page, [{ id: 'p1', name: '甲頁面', createdDate: '2026-01-10', blocks: [{}] }]);
    await page.goto('/pub-detail.html?id=p1');

    await expect(page.getByTestId('pub-detail-name')).toHaveText('甲頁面');
    await expect(page.getByTestId('pub-detail-return')).toBeVisible();
    await expect(page.getByTestId('pub-detail-prev')).toBeHidden();
    await expect(page.getByTestId('pub-detail-next')).toBeHidden();
});

test('[PUB-WEB-FN-002] AC-P9 點擊下一則正確切換內容', async ({ page }) => {
    // 甲頁面較新（排在列表較前面），乙頁面較舊，「下一則」才會是乙頁面
    await seedAdmin(page, [
        { id: 'p1', name: '甲頁面', createdDate: '2026-01-20', blocks: [{}] },
        { id: 'p2', name: '乙頁面', createdDate: '2026-01-10', blocks: [{}] },
    ]);
    await page.goto('/pub-detail.html?id=p1');

    await expect(page.getByTestId('pub-detail-name')).toHaveText('甲頁面');
    await expect(page.getByTestId('pub-detail-next')).toHaveText('乙頁面');

    await page.getByTestId('pub-detail-next').click();

    await expect(page).toHaveURL(/id=p2/);
    await expect(page.getByTestId('pub-detail-name')).toHaveText('乙頁面');
    await expect(page.getByTestId('pub-detail-prev')).toHaveText('甲頁面');
});

test('[PUB-WEB-FN-002] AC-P10 選填欄位無資料時整區塊不顯示', async ({ page }) => {
    await seedAdmin(page, [
        { id: 'p1', name: '最新消息', createdDate: '2026-01-10', blocks: [{ layout: 'image-left', caption: '' }], content: '', note: '' },
    ]);
    await page.goto('/pub-detail.html?id=p1');

    // 正向基準：先確認頁面確實載入、圖文區塊確實渲染了 1 組，才斷言內容區塊不顯示
    await expect(page.getByTestId('pub-detail-name')).toHaveText('最新消息');
    await expect(page.getByTestId('pub-detail-block')).toHaveCount(1);
    await expect(page.getByTestId('pub-detail-content-section')).toBeHidden();
    await expect(page.getByTestId('pub-detail-note-section')).toBeHidden();
});

test('[PUB-WEB-FN-002] AC-B1 存取已刪除之頁面', async ({ page }) => {
    await seedAdmin(page, [{ id: 'p1', name: '測試頁面 A', createdDate: '2026-01-10', blocks: [{}] }]);
    await page.goto('/pub-detail.html?id=p1');

    // 正向基準：先確認頁面確實成功開啟這一筆
    await expect(page.getByTestId('pub-detail-name')).toHaveText('測試頁面 A');

    await page.evaluate(() => {
        localStorage.setItem('admin-pages', JSON.stringify([]));
    });
    await page.reload();

    await expect(page.getByTestId('pub-detail-toast')).toHaveText('資料不存在或已被刪除');
    await page.waitForURL('**/index.html');
    // 不得顯示任何殘留內容：導回列表後畫面應是列表本體，不是內頁的殘留 DOM
    await expect(page.getByTestId('pub-list-body')).toBeVisible();
});
