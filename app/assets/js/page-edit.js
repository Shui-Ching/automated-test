import { getPageById, updatePage, pageNameExists, saveImageBlob, getImageBlob } from './data-store.js';
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
};

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

/** 畫面狀態的唯一來源，結構與 page-create.js 相同，多一個 `existingImageId`
 * 記錄「未重新上傳時沿用的原圖片」（特殊規則 3）。移除整組只影響這份陣列，
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

        const id = await saveImageBlob(file);
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, 'image', URL.createObjectURL(file));
        const [leaf] = quill.getLeaf(range.index);
        if (leaf && leaf.domNode) leaf.domNode.dataset.idbId = id;
    });
    input.click();
});

/** 儲存前把編輯器內嵌圖片換成 `idb:<id>` 參照，寫法與 page-create.js 相同（見該檔註解）。 */
function serializeContent() {
    const container = document.createElement('div');
    container.innerHTML = quill.root.innerHTML;
    container.querySelectorAll('img[data-idb-id]').forEach((img) => {
        img.setAttribute('src', `idb:${img.dataset.idbId}`);
        img.removeAttribute('data-idb-id');
    });
    return container.innerHTML;
}

/**
 * 載入既有內容時的反向操作：把儲存格式的 `idb:<id>` 參照換回可顯示的 blob URL，
 * 並把 id 存回 dataset，讓使用者不動這張圖片直接再次儲存時，serializeContent() 仍能正確
 * 換回 `idb:<id>`（而不是把暫時的 blob: URL 誤存成永久參照，reload 後就會失效）。
 * 直接操作 `quill.root`（而非離線容器）是因為 img.src 賦值本身就是即時生效的 DOM 操作，
 * 不需要透過 Quill 的 Delta API；serializeContent() 讀的也是同一份即時 DOM。
 */
async function resolveContentImages() {
    const embeddedImages = Array.from(quill.root.querySelectorAll('img[src^="idb:"]'));
    for (const img of embeddedImages) {
        const id = img.getAttribute('src').slice('idb:'.length);
        const blob = await getImageBlob(id);
        if (blob) {
            img.src = URL.createObjectURL(blob);
            img.dataset.idbId = id;
        }
    }
}

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

        // 縮圖與垃圾桶按鈕分開判斷：垃圾桶只要「資料上有圖片」（existingImageId 或新選檔）就該可清除，
        // 不能綁在 previewUrl 有沒有成功解出縮圖——找不到對應 Blob（例如資料損毀）時縮圖雖然是空的，
        // 使用者仍應該能清除後重新上傳，這正是特殊規則 3 要處理的情況。
        if (block.previewUrl) {
            imagePreview.src = block.previewUrl;
            imagePreview.hidden = false;
        }
        imageRemoveButton.hidden = !(block.file || block.existingImageId);

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
            block.existingImageId = null;
            block.previewUrl = URL.createObjectURL(file);
            imagePreview.src = block.previewUrl;
            imagePreview.hidden = false;
            imageRemoveButton.hidden = false;
        });

        // 特殊規則 3：清除後該組須重新上傳才可儲存 —— 連同 existingImageId 一起清掉，
        // 不能只清畫面預覽，否則驗證仍會誤判為「已有圖片」。
        imageRemoveButton.addEventListener('click', () => {
            if (block.previewUrl) URL.revokeObjectURL(block.previewUrl);
            block.file = null;
            block.existingImageId = null;
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
    blocks.push({ layout: 'image-left', file: null, existingImageId: null, previewUrl: '', caption: '' });
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

        const imageCheck = validateBlockImageOnSubmit(Boolean(block.file) || Boolean(block.existingImageId));
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
            const imageId = block.file ? await saveImageBlob(block.file) : block.existingImageId;
            savedBlocks.push({ layout: block.layout, image: imageId, caption: block.caption });
        }

        updatePage(pageId, {
            name: nameInput.value,
            createdDate: dateInput.value,
            blocks: savedBlocks,
            content: serializeContent(),
            note: noteInput.value,
        });

        showToast(toastEl, MESSAGES.saveSuccess);
        setTimeout(() => {
            window.location.href = 'page-list.html';
        }, 600);
    } catch (error) {
        saveButton.disabled = false;
        throw error;
    }
});

const logoutButton = document.querySelector('.js-logout');
logoutButton.addEventListener('click', () => {
    window.AdminSession.clear();
    window.location.href = 'login.html';
});

// --- 初始載入：帶入既有值（AC-P1）---

async function init() {
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
    await resolveContentImages();

    blocks = await Promise.all(
        page.blocks.map(async (block) => {
            let previewUrl = '';
            if (block.image) {
                const blob = await getImageBlob(block.image);
                if (blob) previewUrl = URL.createObjectURL(blob);
            }
            return {
                layout: block.layout,
                file: null,
                existingImageId: block.image || null,
                previewUrl,
                caption: block.caption || '',
            };
        })
    );

    renderBlocks();
}

init();
