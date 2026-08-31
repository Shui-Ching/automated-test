/**
 * 共用 Toast 提示。頁面需先備妥一個帶 `hidden` 屬性的元素，呼叫 showToast 顯示文字並自動消失。
 * 抽成獨立模組是因為新增／編輯頁面（下個 session）同樣需要「儲存成功」「新增成功」的 Toast，
 * 不想每個頁面各寫一份計時器邏輯。
 */

let hideTimer = null;

export function showToast(element, message, duration = 2400) {
    element.textContent = message;
    element.hidden = false;
    element.classList.add('is-visible');

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        element.hidden = true;
        element.classList.remove('is-visible');
    }, duration);
}
