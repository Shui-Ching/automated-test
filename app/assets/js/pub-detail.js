/**
 * [PUB-WEB-FN-002] 前台 頁面內容顯示。
 *
 * 不需要登入狀態（NFR-003）。頁面內容以 sanitizeHtml() 消毒後才塞進 innerHTML
 * （見 html-sanitize.js 與 docs/project-plan.md 風險 R-3）。圖文區塊與內容編輯器
 * 內嵌圖片都是 base64 dataURL，直接存在 `blocks[].image` 或內容 HTML 的 `<img src>`
 * 裡，不需要另外解析參照。
 */

import { getPageById, listPublicPages } from './data-store.js';
import { sanitizeHtml } from './html-sanitize.js';
import { showToast } from './toast.js';

const MESSAGES = {
    notFound: '資料不存在或已被刪除',
};

const pageId = new URLSearchParams(window.location.search).get('id');

const toastEl = document.querySelector('.js-toast');
const nameEl = document.querySelector('.js-name');
const dateEl = document.querySelector('.js-date');
const blocksEl = document.querySelector('.js-blocks');
const contentSection = document.querySelector('.js-content-section');
const contentEl = document.querySelector('.js-content');
const noteSection = document.querySelector('.js-note-section');
const noteEl = document.querySelector('.js-note');
const prevLink = document.querySelector('.js-prev');
const nextLink = document.querySelector('.js-next');

/** EX-1：目標頁面不存在或已被刪除，異常流程 1 —— 提示後導回列表，不渲染任何殘留內容。 */
function redirectToList() {
    showToast(toastEl, MESSAGES.notFound);
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 600);
}

function renderBlocks(blocks) {
    blocksEl.innerHTML = '';

    for (const block of blocks) {
        const root = document.createElement('div');
        root.className = `pub-block pub-block--${block.layout}`;
        root.dataset.testid = 'pub-detail-block';

        const img = document.createElement('img');
        img.className = 'pub-block-image';
        img.dataset.testid = 'pub-detail-block-image';
        img.alt = block.caption || '';
        img.hidden = true;
        if (block.image) {
            img.src = block.image;
            img.hidden = false;
        }

        // 圖說文字無資料時該側留空，不顯示替代文字（特殊規則，介面欄位定義 B）
        const caption = document.createElement('p');
        caption.className = 'pub-block-caption';
        caption.dataset.testid = 'pub-detail-block-caption';
        caption.textContent = block.caption || '';

        root.append(img, caption);
        blocksEl.appendChild(root);
    }
}

/** 頁面內容以 HTML 原樣渲染，無資料時整區塊不顯示（AC-P10）。 */
function renderContent(rawHtml) {
    const trimmed = (rawHtml || '').trim();
    if (!trimmed) {
        contentSection.hidden = true;
        return;
    }

    contentSection.hidden = false;
    contentEl.innerHTML = sanitizeHtml(trimmed);
}

/** 補充說明無資料時整區塊不顯示（AC-P10），有資料時保留原輸入之換行。 */
function renderNote(note) {
    const trimmed = (note || '').trim();
    if (!trimmed) {
        noteSection.hidden = true;
        return;
    }

    noteSection.hidden = false;
    noteEl.textContent = note;
}

/**
 * 上下則導覽：排序基準與前台列表〈預設排序定義〉完全一致（特殊規則 3），
 * 於該排序中位於本筆之前者為「上一則」，位於本筆之後者為「下一則」（AC-P5～P8）。
 * 用 <a href> 而非 JS 導頁，符合「導航用 a」的語意，點擊即整頁重新載入本畫面。
 */
function renderNav(currentId) {
    const list = listPublicPages();
    const index = list.findIndex((page) => page.id === currentId);

    const prev = index > 0 ? list[index - 1] : null;
    const next = index !== -1 && index < list.length - 1 ? list[index + 1] : null;

    if (prev) {
        prevLink.hidden = false;
        prevLink.textContent = prev.name;
        prevLink.href = `pub-detail.html?id=${encodeURIComponent(prev.id)}`;
    } else {
        prevLink.hidden = true;
    }

    if (next) {
        nextLink.hidden = false;
        nextLink.textContent = next.name;
        nextLink.href = `pub-detail.html?id=${encodeURIComponent(next.id)}`;
    } else {
        nextLink.hidden = true;
    }
}

function init() {
    const page = pageId ? getPageById(pageId) : null;
    if (!page) {
        redirectToList();
        return;
    }

    document.title = `${page.name} — 頁面內容`;
    nameEl.textContent = page.name;
    dateEl.textContent = page.createdDate;

    renderBlocks(page.blocks || []);
    renderContent(page.content || '');
    renderNote(page.note || '');
    renderNav(page.id);
}

init();
