/**
 * 頁面資料的唯一存取入口。掛在 localStorage 的 `admin-pages` key，值為頁面物件陣列。
 *
 * 本階段只實作頁面列表（查詢／排序）與硬刪除，因為目前只有 page-list.html 這一個消費者。
 * 新增／編輯頁面所需的寫入、唯一值檢核、圖片存取（IndexedDB）待 Phase 2 後續 session
 * 實作對應頁面時再加進來，避免在還沒有呼叫端的情況下先寫一批用不到的函式。
 *
 * `admin-pages` 這把 key 與頁面物件的欄位名稱是測試契約的一部分（見 tests/contract/seed.md），
 * PM 端的測試直接寫入這把 key 來填種資料，改名或改欄位形狀等同改 API。
 *
 * ES module（而非 session-store.js 那種傳統 script）：這支檔案不需要在首次繪製前執行，
 * 只服務 page-list.js 這類功能邏輯，沿用 login.js 已經立下的慣例。
 */

const STORAGE_KEY = 'admin-pages';

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
