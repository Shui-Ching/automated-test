/**
 * 頁面資料的唯一存取入口。掛在 localStorage 的 `admin-pages` key，值為頁面物件陣列；
 * 圖文區塊與內容編輯器內嵌圖片另走 IndexedDB（見下方 `saveImageBlob` 一節），
 * 原因是 base64 塞進 localStorage 會撐爆容量（見 docs/project-plan.md 風險 R-8）。
 *
 * `admin-pages` 這把 key 與頁面物件的欄位名稱是測試契約的一部分（見 tests/contract/seed.md），
 * PM 端的測試直接寫入這把 key 來填種資料，改名或改欄位形狀等同改 API。
 * `blocks[].image` 存的是 IndexedDB 的 key（字串），不是圖片本身。
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

function writeAll(pages) {
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

// --- 圖片 Blob 儲存（IndexedDB）---
// 區塊圖片與內容編輯器內嵌圖片都走這裡：存 Blob 本身而非 base64，避免撐爆 localStorage（風險 R-8）。

const IMAGE_DB_NAME = 'admin-page-images';
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE_NAME = 'images';

function openImageDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(IMAGE_STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/** 儲存圖片 Blob，回傳供 `blocks[].image` 或內容編輯器內嵌圖片參照的 id。 */
export async function saveImageBlob(blob) {
    const db = await openImageDb();
    const id = generateId('img');
    await new Promise((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
        tx.objectStore(IMAGE_STORE_NAME).put(blob, id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
    db.close();
    return id;
}

/** 依 id 取回圖片 Blob，找不到回傳 null。 */
export async function getImageBlob(id) {
    const db = await openImageDb();
    const blob = await new Promise((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, 'readonly');
        const request = tx.objectStore(IMAGE_STORE_NAME).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return blob;
}

/** 移除圖片 Blob，用於使用者在畫面上清除已選圖片或移除整組圖文區塊時釋放儲存空間。 */
export async function deleteImageBlob(id) {
    const db = await openImageDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
        tx.objectStore(IMAGE_STORE_NAME).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}
