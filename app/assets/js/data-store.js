/**
 * 頁面資料的唯一存取入口。掛在 localStorage 的 `admin-pages` key，值為頁面物件陣列；
 * 圖文區塊與內容編輯器內嵌圖片改存 base64 dataURL，直接內嵌在頁面物件裡（見下方
 * `readImageAsDataUrl` 一節）。此前曾改用 IndexedDB 存 Blob 以避免撐爆 localStorage
 * 容量（見 docs/project-plan.md 風險 R-8），但這會讓圖片離開 `admin-pages` 這把 key
 * 單獨存放，只要瀏覽器與網站來源不同（例如換一台電腦開同一個網址），圖片就會遺失
 * ——2026-09-01 決定改回 base64 內嵌，換取「頁面資料本身可攜、可複製」，容量風險
 * 見本檔 `readImageAsDataUrl` 的說明與 docs/project-plan.md 風險 R-8 的更新記錄。
 *
 * `admin-pages` 這把 key 與頁面物件的欄位名稱是測試契約的一部分（見 tests/contract/seed.md），
 * PM 端的測試直接寫入這把 key 來填種資料，改名或改欄位形狀等同改 API。
 * `blocks[].image` 存的是圖片本身（base64 dataURL 字串），不是參照 key。
 *
 * ES module（而非 session-store.js 那種傳統 script）：這支檔案不需要在首次繪製前執行，
 * 只服務 page-list.js 這類功能邏輯，沿用 login.js 已經立下的慣例。
 */

const STORAGE_KEY = 'admin-pages';

function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readAll() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        // 內容被外部改壞時視同無資料，並清掉殘值，避免每次載入都重複解析失敗
        localStorage.removeItem(STORAGE_KEY);
        return [];
    }
}

/**
 * [NFR-004] 資料寫入失敗時要中止作業、提示「系統忙碌中，請稍後再試」、保留已輸入內容、
 * 不留半筆資料。但純前端的模擬資料層裡，localStorage 寫入本來就不會自己失敗，這條 AC
 * 沒有天然的觸發路徑（見 docs/project-plan.md 風險 R-9）。做法比照 session-store.js 的
 * `?sessionTimeout=` 注入慣例：網址帶 `?forceWriteFailure=1` 時，寫入前搶先丟出一個
 * 跟瀏覽器原生 `QuotaExceededError` 同名的 DOMException，讓呼叫端（page-create.js／
 * page-edit.js）的錯誤處理路徑可以在測試中被真的觸發，而不用真的塞爆 localStorage。
 */
function resolveForceWriteFailure() {
    return new URLSearchParams(window.location.search).get('forceWriteFailure') === '1';
}

function writeAll(pages) {
    if (resolveForceWriteFailure()) {
        throw new DOMException('已注入的寫入失敗（測試用，見 ?forceWriteFailure=1）', 'QuotaExceededError');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

/**
 * 依關鍵字（模糊比對）與建立日期區間篩選，並依建立日期新至舊排序。
 * Array.prototype.sort 是穩定排序（ES2019+ 規範保證），同日期的資料維持原陣列順序，
 * 不額外發明「同日以新增順序」這類規格沒寫的次要排序規則。
 */
export function listPages(filters = {}) {
    const name = (filters.name || '').trim();
    const dateFrom = filters.dateFrom || '';
    const dateTo = filters.dateTo || '';

    let pages = readAll();

    if (name) {
        pages = pages.filter((page) => page.name.includes(name));
    }
    if (dateFrom) {
        pages = pages.filter((page) => page.createdDate >= dateFrom);
    }
    if (dateTo) {
        pages = pages.filter((page) => page.createdDate <= dateTo);
    }

    return pages.slice().sort((a, b) => {
        if (a.createdDate < b.createdDate) return 1;
        if (a.createdDate > b.createdDate) return -1;
        return 0;
    });
}

/**
 * 前台列表與內容頁共用的排序：建立日期由新至舊，同一建立日期時以主鍵（id）由大至小為次要排序
 * （見 docs/pm-feedback.md A-1，2026-08-31 採方案 A 定案；SRS 對應調整見
 * `[PAG-ADM-FN-002]` 欄位定義表新增之主鍵定義、`[PUB-WEB-FN-001]` 排序定義）。
 * 已硬刪除之頁面本來就不在 `readAll()` 回傳的陣列裡，AC-B1 類的「已刪除頁面不得出現」
 * 因此不需要另外過濾。
 */
export function listPublicPages() {
    return readAll()
        .slice()
        .sort((a, b) => {
            if (a.createdDate !== b.createdDate) return a.createdDate < b.createdDate ? 1 : -1;
            return a.id < b.id ? 1 : -1;
        });
}

/** 硬刪除：直接從陣列移除，不保留任何軌跡。回傳是否有實際刪到資料。 */
export function deletePage(id) {
    const pages = readAll();
    const next = pages.filter((page) => page.id !== id);
    writeAll(next);
    return next.length !== pages.length;
}

/** 頁面名稱是否已存在，`excludeId` 供編輯頁排除本筆使用（PAG-002/003 共用的唯一值檢核）。 */
export function pageNameExists(name, excludeId = null) {
    return readAll().some((page) => page.name === name && page.id !== excludeId);
}

/** 新增一筆頁面資料。呼叫前應已完成欄位驗證與唯一值檢核，本函式不重複檢查。 */
export function createPage({ name, createdDate, blocks, content, note }) {
    const pages = readAll();
    const page = {
        id: generateId('p'),
        name,
        createdDate,
        blocks,
        content: content || '',
        note: note || '',
    };
    pages.push(page);
    writeAll(pages);
    return page;
}

/** 依 id 取回單筆頁面資料，找不到回傳 null（編輯頁載入既有值、EX-1 存在性檢查共用）。 */
export function getPageById(id) {
    return readAll().find((page) => page.id === id) || null;
}

/**
 * 更新既有頁面資料。呼叫前應已完成欄位驗證與唯一值檢核（排除本筆），本函式不重複檢查。
 * 若該筆資料已不存在（PAG-ADM-FN-003 EX-1：編輯期間被其他分頁刪除）回傳 null，不會重新建立。
 */
export function updatePage(id, { name, createdDate, blocks, content, note }) {
    const pages = readAll();
    const index = pages.findIndex((page) => page.id === id);
    if (index === -1) return null;

    const updated = { ...pages[index], name, createdDate, blocks, content: content || '', note: note || '' };
    pages[index] = updated;
    writeAll(pages);
    return updated;
}

// --- 圖片轉 base64 dataURL ---
// 區塊圖片與內容編輯器內嵌圖片都走這裡：轉成 dataURL 字串後直接存進 `admin-pages`
// 的頁面物件裡，不再另外開資料庫存放，圖片會跟著頁面資料一起留在同一把 localStorage key。
// 轉檔前先用 canvas 等比縮圖＋壓縮，從源頭壓低 base64 體積，緩解容量風險
// （單張上限 2 MB、未壓縮時 base64 後再漲約 1.33 倍，見 docs/project-plan.md 風險 R-8）。

const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 0.8;

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('圖片載入失敗，檔案可能已損毀'));
        img.src = URL.createObjectURL(file);
    });
}

/**
 * 將圖片檔案等比縮圖（長邊上限 `IMAGE_MAX_DIMENSION`，不足則不放大）並壓縮後讀成 base64 dataURL，
 * 供 `blocks[].image` 或內容編輯器內嵌圖片直接當作 `<img src>` 使用。PNG 保留原格式（避免透明背景
 * 被壓成黑底或白底），僅縮圖不額外做失真壓縮；JPEG 額外套用 `IMAGE_JPEG_QUALITY` 壓縮率。
 */
export async function readImageAsDataUrl(file) {
    const img = await loadImage(file);
    URL.revokeObjectURL(img.src);

    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

    const isPng = file.type === 'image/png';
    return canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', isPng ? undefined : IMAGE_JPEG_QUALITY);
}
