/**
 * [PUB-WEB-FN-001] 前台 前台頁面列表。
 *
 * 不需要登入狀態（NFR-003），不提供搜尋／篩選（特殊規則 1）。
 * 排序與分頁邏輯沿用 page-list.js 的寫法，差異只在資料來源改用 listPublicPages()
 * （建立日期新到舊，同日以主鍵由大至小為次要排序，見 data-store.js 該函式註解）。
 */

import { listPublicPages } from './data-store.js';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const tableBody = document.querySelector('.js-table-body');
const totalEl = document.querySelector('.js-total');
const pageTotalEl = document.querySelector('.js-page-total');
const pageInput = document.querySelector('.js-page-input');
const pageSizeSelect = document.querySelector('.js-page-size');
const pagePrevButton = document.querySelector('.js-page-prev');
const pageNextButton = document.querySelector('.js-page-next');

const state = {
    pageSize: PAGE_SIZE_OPTIONS[0],
    currentPage: 1,
    totalCount: 0,
    totalPages: 1,
};

function buildRow(page, sequence) {
    const tr = document.createElement('tr');
    tr.dataset.testid = 'pub-row';
    tr.dataset.pageName = page.name;

    const seqTd = document.createElement('td');
    seqTd.textContent = String(sequence);

    const nameTd = document.createElement('td');
    const link = document.createElement('a');
    link.className = 'pub-list-link';
    link.href = `pub-detail.html?id=${encodeURIComponent(page.id)}`;
    link.dataset.testid = 'pub-list-row-link';
    link.textContent = page.name;
    nameTd.appendChild(link);

    const dateTd = document.createElement('td');
    dateTd.textContent = page.createdDate;

    tr.append(seqTd, nameTd, dateTd);
    return tr;
}

function buildEmptyRow() {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'pub-list-empty';
    td.dataset.testid = 'pub-list-empty';
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

function refreshList() {
    const all = listPublicPages();

    state.totalCount = all.length;
    state.totalPages = Math.max(1, Math.ceil(state.totalCount / state.pageSize));
    if (state.currentPage > state.totalPages) state.currentPage = state.totalPages;

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const pageRows = all.slice(startIndex, startIndex + state.pageSize);

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

refreshList();
