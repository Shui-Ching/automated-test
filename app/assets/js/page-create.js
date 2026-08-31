import { createPage, pageNameExists, saveImageBlob } from './data-store.js';
import { showToast } from './toast.js';
import {
    VALIDATION_MESSAGES,
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
    createSuccess: '新增成功',
};

const MAX_BLOCKS = 3;
const MIN_BLOCKS = 1;
const DEFAULT_LAYOUT = 'image-left';

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
const contentEditorEl = document.querySelector('.js-content-editor');

/**
 * 畫面狀態的唯一來源。每次新增／移除區塊都從這份陣列重繪整個區塊清單，
 * 移除後其餘各組自然依陣列順序上移（PAG-002 AC-P3），不用另外搬 DOM 節點。
 */
let blocks = [createBlock()];

function createBlock() {
    return {
        layout: DEFAULT_LAYOUT,
        file: null,
        previewUrl: '',
        caption: '',
    };
}

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
// 自訂工具列容器：沿用契約的 data-testid 命名，不依賴 Quill 產生的內部 class 當測試定位點。
const quill = new Quill('#page-form-content-editor', {
    theme: 'snow',
    modules: {
        toolbar: '#page-form-content-toolbar',
    },
});

// 內嵌圖片走 IndexedDB Blob Store（風險 R-8），不用預設的 base64 行為。
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

/**
 * 儲存前把編輯器內嵌圖片的暫時 blob: URL 換成 `idb:<id>` 參照，
 * 因為 blob: URL 只在本次頁面存活期間有效，重新整理或導頁後就失效。
 * 換回真正的圖片顯示（渲染 idb: 參照）是編輯頁與前台的工作，本頁只負責存成這個格式。
 */
function serializeContent() {
    const container = document.createElement('div');
    container.innerHTML = quill.root.innerHTML;
    container.querySelectorAll('img[data-idb-id]').forEach((img) => {
        img.setAttribute('src', `idb:${img.dataset.idbId}`);
        img.removeAttribute('data-idb-id');
    });
    return container.innerHTML;
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

        if (block.previewUrl) {
            imagePreview.src = block.previewUrl;
            imagePreview.hidden = false;
            imageRemoveButton.hidden = false;
        }

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
            block.previewUrl = URL.createObjectURL(file);
            imagePreview.src = block.previewUrl;
            imagePreview.hidden = false;
            imageRemoveButton.hidden = false;
        });

        imageRemoveButton.addEventListener('click', () => {
            if (block.previewUrl) URL.revokeObjectURL(block.previewUrl);
            block.file = null;
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
    blocks.push(createBlock());
    renderBlocks();
});

// --- 送出 ---

function validateAll() {
    let valid = true;

    const nameCheck = validatePageNameOnSubmit(nameInput.value, {
        isDuplicate: nameInput.value !== '' && pageNameExists(nameInput.value),
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

        const imageCheck = validateBlockImageOnSubmit(Boolean(block.file));
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

    if (!validateAll()) return;

    saveButton.disabled = true;

    try {
        const savedBlocks = [];
        for (const block of blocks) {
            const imageId = await saveImageBlob(block.file);
            savedBlocks.push({ layout: block.layout, image: imageId, caption: block.caption });
        }

        createPage({
            name: nameInput.value,
            createdDate: dateInput.value,
            blocks: savedBlocks,
            content: serializeContent(),
            note: noteInput.value,
        });

        showToast(toastEl, MESSAGES.createSuccess);
        // 延遲導頁讓使用者看得到 Toast，沿用 page-list.js 登出流程的同一套做法
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

renderBlocks();
updateNoteCount();
