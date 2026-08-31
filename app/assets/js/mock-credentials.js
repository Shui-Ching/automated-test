/**
 * 模擬用的後台帳號密碼。
 *
 * ⚠️ 這不是權限控管，是畫面模擬。
 * 驗證邏輯跑在瀏覽器裡，任何人都能從 devtools 讀到這組值，
 * 也能直接改 sessionStorage 的登入旗標繞過登入。
 * 本階段可接受的理由是：這個系統裡沒有任何真實資料。
 *
 * Phase 5 接上真後端時，這支檔案必須整支刪除，驗證改由後端處理。
 * 這組密碼不得用於任何真實服務。
 *
 * 值的來源：[AUT-ADM-FN-001] 後台 後台登入 — 特殊規則 1
 */
export const MOCK_ACCOUNT = 'Admin';
export const MOCK_PASSWORD = 'Admin1234';
