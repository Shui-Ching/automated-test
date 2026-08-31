# 資料重置方式（前端維護）

PM 端每條測試開始前，要能把資料狀態重置到 Given 子句描述的樣子。做法統一走
`tests/support/seed.ts` 的 `seedAdmin(page, pages)`，不要自己另外拼 localStorage 寫法。

```ts
import { seedAdmin } from '../support/seed';

test('[PAG-ADM-FN-001] AC-P1 依頁面名稱關鍵字篩選', async ({ page }) => {
    await seedAdmin(page, [
        { id: 'p1', name: '關於我們', createdDate: '2026-01-10', blocks: [{}] },
        { id: 'p2', name: '聯絡我們', createdDate: '2026-01-11', blocks: [{}] },
    ]);
    await page.goto('/admin/page-list.html');
    // ...
});
```

## 為什麼是 `page.addInitScript`，不是網址帶參數

`sessionTimeout` 可以用網址參數注入（見 Phase 0.4），資料重置不行——`auth-guard.js`
未登入時用 `location.replace('login.html')` 導頁，會把原本網址上的 query string
整串丟掉；而 Phase 2 的操作流程本來就會一路導頁（列表 → 新增／編輯 → 儲存 →
回列表），網址參數撐不過一次導頁。`page.addInitScript` 在每次導覽、每個新
document 執行任何頁面自身腳本前都會先跑一次，資料寫進 storage 之後不管導去哪
一頁都還在。

## 為什麼直接寫 storage key，不呼叫 `data-store.js` 的函式

`page.addInitScript` 執行的時間點在頁面自身的 `<script>` 之前，這時候
`data-store.js` 還沒被載入、`window.PageStore` 或任何 import 都還不存在。
所以測試端只能直接寫入 `data-store.js` 讀寫的同一把 key，`data-store.js`
本身完全不需要另外開一個「測試專用」的 reset API——production 邏輯與測試
seeding 用的是同一份讀寫路徑，不會出現「測試過的邏輯」跟「production 實際
跑的邏輯」不一致的風險。

## 每個測試給明確的資料集，不要共用一份全域 fixture

`seedAdmin` 的第二個參數就是這條測試要的資料，寫在測試檔案裡，不要抽成一個
所有測試共用的預設陣列。AC-P1／P3／P5 都斷言總筆數（2 筆篩成 1 筆、砍到
1 筆、砍到 0 筆），如果全部測試共用同一份資料，之後任何一個功能（例如
Phase 3 加前台頁面用的種子資料）多塞一筆進去，就會讓這幾條斷言全部悄悄
壞掉，而且錯誤訊息只會說「預期 1，得到 2」，看不出來是別的測試污染的。

## 資料形狀（`admin-pages` storage key）

```json
[
  {
    "id": "p1",
    "name": "關於我們",
    "createdDate": "2026-01-10",
    "blocks": [{}],
    "content": "",
    "note": ""
  }
]
```

| 欄位 | 型態 | 目前誰在讀 |
| :--- | :--- | :--- |
| `id` | string，測試裡隨便給穩定字串即可（`p1`、`p2`），不必是真的 UUID | 刪除、編輯連結的 `?id=` |
| `name` | string | 列表顯示、名稱模糊搜尋、`data-page-name` |
| `createdDate` | `YYYY-MM-DD` 字串 | 排序、日期區間篩選、列表顯示 |
| `blocks` | 陣列 | **本階段只讀 `.length`**（列表的「# 組」欄），陣列內的物件形狀不重要，`[{}]` 就代表 1 組。新增／編輯頁面實作後，`layout`／`image`／`caption` 才會被讀取，屆時本檔會補上完整範例 |
| `content` / `note` | string，選填 | 尚無頁面讀取，新增／編輯頁面實作後才會用到 |

`admin-pages` 這把 key 名稱與上面的欄位名稱是契約的一部分：`app/assets/js/data-store.js`
改了任何一個欄位名稱，就要同時回來改這份文件與所有用到 `seedAdmin` 的測試。

## 登入狀態一併帶入

後台頁面一律被 `auth-guard.js` 擋，`seedAdmin` 會同時寫入 `admin-session`
（sessionStorage），格式對齊 `session-store.js` 內部的 shape：

```json
{ "account": "Admin", "lastActiveAt": <Date.now() 當下>, "timeoutSeconds": 1800 }
```

這樣測試可以直接從 `page-list.html` 開始，不必每條測試都重跑一次登入頁的
UI 流程——登入本身的驗收已經在 `tests/specs/aut-adm-fn-001.spec.ts` 覆蓋過，
頁面列表的測試不需要重複驗證登入。
