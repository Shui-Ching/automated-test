import { getPageById, updatePage, pageNameExists, readImageAsDataUrl } from './data-store.js';
import { showToast } from './toast.js';
import {
    validatePageNameOnBlur,
    validatePageNameOnSubmit,
    validateCreatedDateOnSubmit,
    validateBlockLayoutOnSubmit,
    validateBlockImageOnSubmit,
    validateImageFile,
    validateCaptionOnBlur,
    validateNoteOnBlur,
} from './field-validation.js';

const MESSAGES = {
    saveSuccess: '儲存成功',
    notFound: '資料不存在或已被刪除',
    // 文案取自 NFR-004（見 docs/project-plan.md 風險 R-8／R-9）
    writeFailure: '系統忙碌中，請稍後再試',
};

function isQuotaExceededError(error) {
    return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22);
}

const MAX_BLOCKS = 3;
const MIN_BLOCKS = 1;

const pageId = new URLSearchParams(window.location.search).get('id');

const form = document.querySelector('.js-form');
const nameInput = document.querySelector('.js-name');
const nameError = document.querySelector('.js-name-error');
const dateInput = document.querySelector('.js-date');
const dateError = document.querySelector('.js-date-error');
const noteInput = document.querySelector('.js-note');
const noteError = document.querySelector('.js-note-error');
const noteCount = document.querySelector('.js-note-count');
const blocksList = document.querySelector('.js-blocks-list');
const blocksAddButton = document.querySelector('.js-blocks-add');
const blockTemplate = document.querySelector('.js-block-template');
const saveButton = document.querySelector('.js-save');
const toastEl = document.querySelector('.js-toast');

/** 畫面狀態的唯一來源，結構與 page-create.js 相同，多一個 `existingImage`
 * 記錄「未重新上傳時沿用的原圖片」（特殊規則 3，值是 base64 dataURL 字串）。移除整組只影響這份陣列，
 * 真正寫回 storage 要等點擊「儲存」（特殊規則 4，AC-P6）。*/
let blocks = [];

function showFieldError(errorEl, inputEl, message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    if (inputEl) inputEl.classList.add('is-invalid');
}

function clearFieldError(errorEl, inputEl) {
    errorEl.textContent = '';
    errorEl.hidden = true;
    if (inputEl) inputEl.classList.remove('is-invalid');
}

function updateNoteCount() {
    noteCount.textContent = `${noteInput.value.length} / 500`;
}

function redirectToList(message) {
    showToast(toastEl, message);
    setTimeout(() => {
        window.location.href = 'page-list.html';
    }, 600);
}

nameInput.addEventListener('blur', () => {
    const error = validatePageNameOnBlur(nameInput.value);
    if (error) {
        showFieldError(nameError, nameInput, error);
    } else {
        clearFieldError(nameError, nameInput);
    }
});

noteInput.addEventListener('input', updateNoteCount);
noteInput.addEventListener('blur', () => {
    const error = validateNoteOnBlur(noteInput.value);
    if (error) {
        showFieldError(noteError, noteInput, error);
    } else {
        clearFieldError(noteError, noteInput);
    }
});

// --- 頁面內容編輯器（Quill）---
const quill = new Quill('#page-form-content-editor', {
    theme: 'snow',
    modules: {
        toolbar: '#page-form-content-toolbar',
    },
});

quill.getModule('toolbar').addHandler('image', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
    input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;

        const error = validateImageFile(file);
        if (error) {
            showToast(toastEl, error);
            return;
        }

        const dataUrl = await readImageAsDataUrl(file);
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', dataUrl);
    });
    input.click();
});

// --- 圖文區塊（可重複群組，1～3 組）---

function renderBlocks() {
    blocksList.innerHTML = '';

    blocks.forEach((block, index) => {
        const node = blockTemplate.content.cloneNode(true);
        const root = node.querySelector('.page-form-block');

        root.querySelector('.page-form-block-title').textContent = `第 ${index + 1} 組圖文區塊`;

        const removeButton = root.querySelector('.js-block-remove');
        removeButton.hidden = blocks.length <= MIN_BLOCKS;
        removeButton.addEventListener('click', () => {
            if (block.previewUrl) URL.revokeObjectURL(block.previewUrl);
            blocks.splice(index, 1);
            renderBlocks();
        });

        const layoutRadios = root.querySelectorAll('.js-block-layout');
        const layoutError = root.querySelector('.js-block-layout-error');
        layoutRadios.forEach((radio) => {
            radio.name = `block-layout-${index}`;
            radio.checked = radio.value === block.layout;
            radio.addEventListener('change', () => {
                block.layout = radio.value;
                clearFieldError(layoutError, null);
            });
        });

        const imageInput = root.querySelector('.js-block-image-input');
        const imagePreview = root.querySelector('.js-block-image-preview');
        const imageRemoveButton = root.querySelector('.js-block-image-remove');
        const imageError = root.querySelector('.js-block-image-error');

        // 垃圾桶按鈕只要「資料上有圖片」（existingImage 或新選檔）就該可清除。
        if (block.previewUrl) {
            imagePreview.src = block.previewUrl;
            imagePreview.hidden = false;
        }
        imageRemoveButton.hidden = !(block.file || block.existingImage);

        imageInput.addEventListener('change', () => {
            const file = imageInput.files[0];
            if (!file) return;

            const error = validateImageFile(file);
            if (error) {
                showFieldError(imageError, null, error);
                imageInput.value = '';
                return;
            }

            clearFieldError(imageError, null);
            if (block.previewUrl) URL.revokeObjectURL(block.previewUrl);
            block.file = file;
            block.existingImage = null;
            block.previewUrl = URL.createObjectURL(file);
            imagePreview.src = block.previewUrl;
            imagePreview.hidden = false;
            imageRemoveButton.hidden = false;
        });

        // 特殊規則 3：清除後該組須重新上傳才可儲存 —— 連同 existingImage 一起清掉，
        // 不能只清畫面預覽，否則驗證仍會誤判為「已有圖片」。
        imageRemoveButton.addEventListener('click', () => {
            if (block.previewUrl) URL.revokeObjectURL(block.previewUrl);
            block.file = null;
            block.existingImage = null;
            block.previewUrl = '';
            imageInput.value = '';
            imagePreview.hidden = true;
            imageRemoveButton.hidden = true;
        });

        const captionInput = root.querySelector('.js-block-caption');
        const captionError = root.querySelector('.js-block-caption-error');
        captionInput.value = block.caption;
        captionInput.addEventListener('input', () => {
            block.caption = captionInput.value;
        });
        captionInput.addEventListener('blur', () => {
            const error = validateCaptionOnBlur(captionInput.value);
            if (error) {
                showFieldError(captionError, captionInput, error);
            } else {
                clearFieldError(captionError, captionInput);
            }
        });

        blocksList.appendChild(node);
    });

    blocksAddButton.disabled = blocks.length >= MAX_BLOCKS;
}

blocksAddButton.addEventListener('click', () => {
    if (blocks.length >= MAX_BLOCKS) return;
    blocks.push({ layout: 'image-left', file: null, existingImage: null, previewUrl: '', caption: '' });
    renderBlocks();
});

// --- 送出 ---

function validateAll() {
    let valid = true;

    const nameCheck = validatePageNameOnSubmit(nameInput.value, {
        isDuplicate: nameInput.value !== '' && pageNameExists(nameInput.value, pageId),
    });
    if (nameCheck) {
        showFieldError(nameError, nameInput, nameCheck);
        valid = false;
    } else {
        clearFieldError(nameError, nameInput);
    }

    const dateCheck = validateCreatedDateOnSubmit(dateInput.value);
    if (dateCheck) {
        showFieldError(dateError, dateInput, dateCheck);
        valid = false;
    } else {
        clearFieldError(dateError, dateInput);
    }

    const noteCheck = validateNoteOnBlur(noteInput.value);
    if (noteCheck) {
        showFieldError(noteError, noteInput, noteCheck);
        valid = false;
    } else {
        clearFieldError(noteError, noteInput);
    }

    const blockGroups = blocksList.querySelectorAll('.page-form-block');
    blocks.forEach((block, index) => {
        const groupEl = blockGroups[index];
        const layoutError = groupEl.querySelector('.js-block-layout-error');
        const imageError = groupEl.querySelector('.js-block-image-error');
        const captionInput = groupEl.querySelector('.js-block-caption');
        const captionError = groupEl.querySelector('.js-block-caption-error');

        const layoutCheck = validateBlockLayoutOnSubmit(block.layout);
        if (layoutCheck) {
            showFieldError(layoutError, null, layoutCheck);
            valid = false;
        } else {
            clearFieldError(layoutError, null);
        }

        const imageCheck = validateBlockImageOnSubmit(Boolean(block.file) || Boolean(block.existingImage));
        if (imageCheck) {
            showFieldError(imageError, null, imageCheck);
            valid = false;
        } else {
            clearFieldError(imageError, null);
        }

        const captionCheck = validateCaptionOnBlur(block.caption);
        if (captionCheck) {
            showFieldError(captionError, captionInput, captionCheck);
            valid = false;
        } else {
            clearFieldError(captionError, captionInput);
        }
    });

    return valid;
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // EX-1：儲存當下重新確認資料還在，涵蓋「編輯期間被另一分頁刪除」這種併發情況。
    if (!getPageById(pageId)) {
        redirectToList(MESSAGES.notFound);
        return;
    }

    if (!validateAll()) return;

    saveButton.disabled = true;

    try {
        const savedBlocks = [];
        for (const block of blocks) {
            const image = block.file ? await readImageAsDataUrl(block.file) : block.existingImage;
            savedBlocks.push({ layout: block.layout, image, caption: block.caption });
        }

        updatePage(pageId, {
            name: nameInput.value,
            createdDate: dateInput.value,
            blocks: savedBlocks,
            content: quill.root.innerHTML,
            note: noteInput.value,
        });

        showToast(toastEl, MESSAGES.saveSuccess);
        setTimeout(() => {
            window.location.href = 'page-list.html';
        }, 600);
    } catch (error) {
        saveButton.disabled = false;
        // NFR-004：localStorage 寫入額度爆滿時中止作業、停留原頁並保留已輸入內容（風險 R-8/R-9）。
        // localStorage.setItem 本身是全有全無操作，拋錯代表本次寫入完全沒有落地，不會留半筆資料。
        if (isQuotaExceededError(error)) {
            showToast(toastEl, MESSAGES.writeFailure);
            return;
        }
        throw error;
    }
});

const logoutButton = document.querySelector('.js-logout');
logoutButton.addEventListener('click', () => {
    window.AdminSession.clear();
    window.location.href = 'login.html';
});

// --- 初始載入：帶入既有值（AC-P1）---

function init() {
    const page = pageId ? getPageById(pageId) : null;
    if (!page) {
        redirectToList(MESSAGES.notFound);
        return;
    }

    nameInput.value = page.name;
    dateInput.value = page.createdDate;
    noteInput.value = page.note || '';
    updateNoteCount();

    quill.root.innerHTML = page.content || '';

    blocks = page.blocks.map((block) => ({
        layout: block.layout,
        file: null,
        existingImage: block.image || null,
        previewUrl: block.image || '',
        caption: block.caption || '',
    }));

    renderBlocks();
}

init();
