/**
 * 後台頁面的存取阻斷。只放在需要保護的頁面，不放登入頁。
 *
 * 必須以傳統 script 放在 <head>、排在 session-store.js 之後，且不加 defer 或 async。
 * [NFR-001] 要求「不得於任何時點顯示該頁之資料內容或版面骨架」——
 * 等頁面渲染完再檢查登入狀態的寫法，畫面會先閃一下後台版型，這條需求會真的失敗。
 *
 * 用 location.replace 而不是 location.href：未登入的中間頁不留在瀏覽器的上一頁歷史裡，
 * 使用者按上一頁不會又回到一個立刻把他踢走的頁面。
 */
(function () {
    'use strict';

    var state = window.AdminSession.check();

    if (state !== 'active') {
        window.location.replace('login.html' + (state === 'expired' ? '?reason=expired' : ''));
    }
})();
