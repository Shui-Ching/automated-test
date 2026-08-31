/**
 * PAG-ADM-FN-002／003（新增／編輯頁面）共用的欄位驗證規則，純函式、不碰 DOM。
 * 兩份規格的〈欄位驗證〉表 11 條規則文字完全相同，抽成共用模組避免兩支頁面各寫一份
 * 逐漸失去同步；呼叫端（page-create.js／page-edit.js）自行決定何時呼叫（送出時或離開欄位時）
 * 並把回傳的錯誤訊息渲染到畫面。
 */

export const VALIDATION_MESSAGES = {
    nameRequired: '請輸入頁面名稱',
    nameBlank: '頁面名稱不可為空白',
    nameTooLong: '頁面名稱長度不可超過 50 字',
    nameDuplicate: '此頁面名稱已存在',
    dateRequired: '請選擇建立日期',
    layoutRequired: '請選擇區塊版型',
    imageRequired: '請上傳圖片',
    imageFormatInvalid: '檔案格式不符，僅支援 JPG、PNG',
    imageTooLarge: '檔案大小不可超過 2 MB',
    captionTooLong: '圖說文字長度不可超過 100 字',
    noteTooLong: '補充說明長度不可超過 500 字',
};

const MAX_NAME_LENGTH = 50;
const MAX_CAPTION_LENGTH = 100;
const MAX_NOTE_LENGTH = 500;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

/** 離開欄位後：只檢核「僅輸入空白字元」與「長度上限」，真正的必填檢核留給送出時。 */
export function validatePageNameOnBlur(name) {
    if (name === '') return null;
    if (name.trim() === '') return VALIDATION_MESSAGES.nameBlank;
    if (name.length > MAX_NAME_LENGTH) return VALIDATION_MESSAGES.nameTooLong;
    return null;
}

/** 點擊送出時：依優先序完整跑過必填／空白／長度三條規則，唯一值檢核由呼叫端另外查完再帶結果進來。 */
export function validatePageNameOnSubmit(name, { isDuplicate = false } = {}) {
    if (name === '') return VALIDATION_MESSAGES.nameRequired;
    if (name.trim() === '') return VALIDATION_MESSAGES.nameBlank;
    if (name.length > MAX_NAME_LENGTH) return VALIDATION_MESSAGES.nameTooLong;
    if (isDuplicate) return VALIDATION_MESSAGES.nameDuplicate;
    return null;
}

export function validateCreatedDateOnSubmit(date) {
    return date ? null : VALIDATION_MESSAGES.dateRequired;
}

export function validateBlockLayoutOnSubmit(layout) {
    return layout ? null : VALIDATION_MESSAGES.layoutRequired;
}

/** `hasImage` 涵蓋「已上傳新檔」或「編輯頁沿用既有圖片」兩種情況，由呼叫端判斷後傳入布林值。 */
export function validateBlockImageOnSubmit(hasImage) {
    return hasImage ? null : VALIDATION_MESSAGES.imageRequired;
}

/** 上傳當下即檢核格式與大小，與送出時的必填檢核是兩條獨立規則。 */
export function validateImageFile(file) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return VALIDATION_MESSAGES.imageFormatInvalid;
    if (file.size > MAX_IMAGE_SIZE) return VALIDATION_MESSAGES.imageTooLarge;
    return null;
}

export function validateCaptionOnBlur(caption) {
    return caption.length > MAX_CAPTION_LENGTH ? VALIDATION_MESSAGES.captionTooLong : null;
}

export function validateNoteOnBlur(note) {
    return note.length > MAX_NOTE_LENGTH ? VALIDATION_MESSAGES.noteTooLong : null;
}
