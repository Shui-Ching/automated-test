import { listPages, deletePage } from './data-store.js';
import { showToast } from './toast.js';

const MESSAGES = {
    dateRangeInvalid: '結束時間不可早於開始時間',
    deleteSuccess: '刪除成功',
    // [PAG-ADM-FN-001] 異常流程 2：刪除目標於作業期間已不存在（EX-1，同一筆被其他分頁搶先刪除）
    deleteNotFound: '資料不存在或已被刪除',
    // 文案取自 NFR-004（見 docs/project-plan.md 風險 R-8／R-9）
    writeFailure: '系統忙碌中，請稍後再試',
    logoutSuccess: '已登出',
};

function isQuotaExceededError(error) {
    return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22);
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const nameInput = document.querySelector('.js-search-name');
const dateFromInput = document.querySelector('.js-search-date-from');
const dateToInput = document.querySelector('.js-search-date-to');
const dateError = document.querySelector('.js-search-date-error');
const searchSubmit = document.querySelector('.js-search-submit');
const searchClear = document.querySelector('.js-search-clear');

const tableBody = document.querySelector('.js-table-body');
const totalEl = document.querySelector('.js-total');
const pageTotalEl = document.querySelector('.js-page-total');
const pageInput = document.querySelector('.js-page-input');
const pageSizeSelect = document.querySelector('.js-page-size');
const pagePrevButton = document.querySelector('.js-page-prev');
const pageNextButton = document.querySelector('.js-page-next');

const toastEl = document.querySelector('.js-toast');
const logoutButton = document.querySelector('.js-logout');

const deleteDialog = document.querySelector('.js-delete-dialog');
const deleteCancelButton = document.querySelector('.js-delete-cancel');
const deleteConfirmButton = document.querySelector('.js-delete-confirm');

const state = {
    name: '',
    dateFrom: '',
    dateTo: '',
    pageSize: PAGE_SIZE_OPTIONS[0],
    currentPage: 1,
    totalCount: 0,
    totalPages: 1,
};

let pendingDeleteId = null;

function clearDateError() {
    dateError.textContent = '';
    dateError.hidden = true;
    dateFromInput.classList.remove('is-invalid');
    dateToInput.classList.remove('is-invalid');
}

function showDateError(message) {
    dateError.textContent = message;
    dateError.hidden = false;
    dateFromInput.classList.add('is-invalid');
    dateToInput.classList.add('is-invalid');
}

/** 字串比較即可判斷早晚，因為兩個輸入都是 `<input type="date">` 固定輸出 YYYY-MM-DD。 */
function validateDateRange() {
    if (dateFromInput.value && dateToInput.value && dateFromInput.value > dateToInput.value) {
        return MESSAGES.dateRangeInvalid;
    }
    return null;
}

function buildRow(page, sequence) {
    const tr = document.createElement('tr');
    tr.dataset.testid = 'page-row';
    tr.dataset.pageName = page.name;

    const seqTd = document.createElement('td');
    seqTd.textContent = String(sequence);

    const nameTd = document.createElement('td');
    nameTd.textContent = page.name;

    const dateTd = document.createElement('td');
    dateTd.textContent = page.createdDate;

    const blocksTd = document.createElement('td');
    blocksTd.textContent = `${page.blocks.length} 組`;

    const actionsTd = document.createElement('td');
    actionsTd.className = 'page-list-row-actions';

    const editLink = document.createElement('a');
    editLink.className = 'button button--secondary button--sm';
    editLink.href = `page-edit.html?id=${encodeURIComponent(page.id)}`;
    editLink.dataset.testid = 'page-list-row-edit';
    editLink.textContent = '編輯';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'button button--danger button--sm js-row-delete';
    deleteButton.dataset.testid = 'page-list-row-delete';
    deleteButton.dataset.id = page.id;
    deleteButton.textContent = '刪除';

    actionsTd.append(editLink, deleteButton);
    tr.append(seqTd, nameTd, dateTd, blocksTd, actionsTd);
    return tr;
}

function buildEmptyRow() {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'page-list-empty';
    td.dataset.testid = 'page-list-empty';
    td.textContent = '查無資料';
    tr.appendChild(td);
    return tr;
}

function renderPaginationInfo() {
    totalEl.textContent = String(state.totalCount);
    pageTotalEl.textContent = `/ ${state.totalPages}`;
    pageInput.value = String(state.currentPage);
    pagePrevButton.disabled = state.currentPage <= 1;
    pageNextButton.disabled = state.currentPage >= state.totalPages;
}

/** 篩選後的完整結果依目前分頁狀態切片並重繪表格。不觸碰篩選條件本身，交由呼叫端決定何時篩選。 */
function refreshList() {
    const filtered = listPages({ name: state.name, dateFrom: state.dateFrom, dateTo: state.dateTo });

    state.totalCount = filtered.length;
    state.totalPages = Math.max(1, Math.ceil(state.totalCount / state.pageSize));
    if (state.currentPage > state.totalPages) state.currentPage = state.totalPages;

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const pageRows = filtered.slice(startIndex, startIndex + state.pageSize);

    tableBody.innerHTML = '';
    if (pageRows.length === 0) {
        tableBody.appendChild(buildEmptyRow());
    } else {
        pageRows.forEach((page, index) => {
            tableBody.appendChild(buildRow(page, startIndex + index + 1));
        });
    }

    renderPaginationInfo();
}

function handleSearchSubmit() {
    clearDateError();
    const error = validateDateRange();
    if (error) {
        // 阻擋查詢：不更新 state、不呼叫 refreshList，列表維持查詢前狀態
        showDateError(error);
        return;
    }

    state.name = nameInput.value;
    state.dateFrom = dateFromInput.value;
    state.dateTo = dateToInput.value;
    state.currentPage = 1;
    refreshList();
}

function handleSearchClear() {
    nameInput.value = '';
    dateFromInput.value = '';
    dateToInput.value = '';
    clearDateError();

    state.name = '';
    state.dateFrom = '';
    state.dateTo = '';
    state.currentPage = 1;
    refreshList();
}

searchSubmit.addEventListener('click', handleSearchSubmit);
searchClear.addEventListener('click', handleSearchClear);

pageSizeSelect.addEventListener('change', () => {
    state.pageSize = Number(pageSizeSelect.value);
    state.currentPage = 1;
    refreshList();
});

pagePrevButton.addEventListener('click', () => {
    if (state.currentPage <= 1) return;
    state.currentPage -= 1;
    refreshList();
});

pageNextButton.addEventListener('click', () => {
    if (state.currentPage >= state.totalPages) return;
    state.currentPage += 1;
    refreshList();
});

pageInput.addEventListener('change', () => {
    const requested = Math.trunc(Number(pageInput.value));
    state.currentPage = Number.isFinite(requested)
        ? Math.min(Math.max(requested, 1), state.totalPages)
        : state.currentPage;
    refreshList();
});

tableBody.addEventListener('click', (event) => {
    const button = event.target.closest('.js-row-delete');
    if (!button) return;
    pendingDeleteId = button.dataset.id;
    deleteDialog.showModal();
});

// 涵蓋 Esc 鍵與點擊 backdrop 關閉：<dialog> 的 close 事件在任何關閉方式都會觸發，
// 不只有點擊「取消」按鈕那條路徑，統一在這裡清掉待刪除 id 才不會漏掉其他關閉方式。
deleteDialog.addEventListener('close', () => {
    pendingDeleteId = null;
});

deleteCancelButton.addEventListener('click', () => {
    deleteDialog.close();
});

deleteConfirmButton.addEventListener('click', () => {
    if (!pendingDeleteId) return;

    deleteConfirmButton.disabled = true;

    try {
        // deletePage() 回傳布林值：true 表示真的刪到資料，false 表示該筆已不存在
        // （EX-1：同一筆於另一分頁已被搶先刪除，異常流程 2）。
        const deleted = deletePage(pendingDeleteId);
        deleteDialog.close();
        refreshList();
        showToast(toastEl, deleted ? MESSAGES.deleteSuccess : MESSAGES.deleteNotFound);
    } catch (error) {
        // NFR-004：寫入失敗時中止本次刪除，關閉彈窗後列表維持原狀，該筆資料仍存在
        // 且總筆數不變——因此不呼叫 refreshList()。
        deleteDialog.close();
        if (isQuotaExceededError(error)) {
            showToast(toastEl, MESSAGES.writeFailure);
        } else {
            throw error;
        }
    } finally {
        deleteConfirmButton.disabled = false;
    }
});

logoutButton.addEventListener('click', () => {
    showToast(toastEl, MESSAGES.logoutSuccess);
    window.AdminSession.clear();
    // 延遲導頁讓使用者看得到 Toast，時間短到不影響操作流暢度
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 600);
});

refreshList();
