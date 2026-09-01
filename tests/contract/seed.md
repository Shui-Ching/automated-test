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
document 執行任何頁面自身腳本前都會先跑一次，資料重置這件事本身因此不受導頁影響。

**但這也表示 `seedAdmin` 內部的 `localStorage.setItem` 不能無條件每次導覽都執行**：
Phase 2.4 起的流程會真的跨頁導（新增頁面 → 儲存 → 回列表），若每次導覽都重寫
`admin-pages`，UI 操作寫入的資料會在下一次導覽時被種子資料整個蓋掉，測試會斷言
「儲存後列表看得到這筆」卻永遠看不到。`seedAdmin` 用 `sessionStorage` 的 sentinel
旗標把 `admin-pages` 的寫入包成只在同一分頁的第一次導覽執行一次，之後的導覽只
不寫入 `admin-pages`（但仍會更新 `admin-session`，讓 session 維持有效）。這條在
只有單頁操作的頁面列表測試（Phase 2.1～2.3）不會出現，是 2.4 實作新增頁面、
寫第一條跨頁測試時才發現的。

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
    "blocks": [
      { "layout": "image-left", "image": "img-fixture-1", "caption": "示意圖說" }
    ],
    "content": "<p><strong>粗體內容</strong></p>",
    "note": "補充說明文字"
  }
]
```

| 欄位 | 型態 | 目前誰在讀 |
| :--- | :--- | :--- |
| `id` | string，測試裡隨便給穩定字串即可（`p1`、`p2`），不必是真的 UUID | 刪除、編輯連結的 `?id=` |
| `name` | string | 列表顯示、名稱模糊搜尋、`data-page-name` |
| `createdDate` | `YYYY-MM-DD` 字串 | 排序、日期區間篩選、列表顯示 |
| `blocks` | 陣列，本階段（頁面列表）只讀 `.length`（列表的「# 組」欄） | 見下方 `blocks[]` 欄位表 |
| `content` | string，HTML | 尚無頁面讀取（前台渲染待 Phase 3） |
| `note` | string，選填 | 尚無頁面讀取 |

**`blocks[]` 各筆欄位**（新增／編輯頁面 PAG-002／003 讀取）：

| 欄位 | 型態 | 說明 |
| :--- | :--- | :--- |
| `layout` | `'image-left'` \| `'image-right'` | 對應規格「左圖右文」／「右圖左文」 |
| `image` | string | IndexedDB 圖片 Blob 的 key，不是圖片本身。**`seedAdmin` 不會連帶寫 IndexedDB**——`page.addInitScript` 只寫 localStorage／sessionStorage，所以填一個假字串可以讓「有沒有值」這類存在性斷言通過（編輯頁的必填檢核只看這個 key 是否為真值，不要求 Blob 真的存在），但無法驗證縮圖真的渲染出來 |
| `caption` | string，選填 | 圖說文字 |

`admin-pages` 這把 key 名稱與上面的欄位名稱是契約的一部分：`app/assets/js/data-store.js`
改了任何一個欄位名稱，就要同時回來改這份文件與所有用到 `seedAdmin` 的測試。

## `image` key 的 IndexedDB 填種缺口，2.6 決定不擴充 `seedAdmin`

上一節提到 `seedAdmin` 只寫 localStorage／sessionStorage，`blocks[].image` 填的假字串
在 IndexedDB 裡找不到對應的 Blob。2.6 實作編輯頁面時評估過用 `page.addInitScript`
連帶寫入 IndexedDB（`admin-page-images` 資料庫），但 `indexedDB.open()` 到寫入完成
是非同步的一連串 callback，`addInitScript` 不保證這串非同步操作會在頁面自身的
module script（`page-edit.js` 讀 Blob 的那段）執行前完成——兩者的完成時機沒有
明確的先後保證，硬做會做出一個「大部分時候可行、但沒有時序保證」的填種方式，
問題只會在 CI 環境比較慢或比較快時才浮現，難以重現。

**決定**：需要驗證「縮圖真的渲染出來」的測試（PAG-ADM-FN-003 AC-P1），改成不用
`seedAdmin` 填圖片資料，而是先跑一遍 `page-create.html` 的真實 UI 流程上傳圖片，
讓 `saveImageBlob()` 透過應用程式自己的程式碼把 Blob 寫進同一個瀏覽器 context 的
IndexedDB（跟使用者操作走的是同一條路徑，沒有時序問題），儲存後從頁面列表點
「編輯」進入編輯頁，這時候讀到的 `image` key 保證對應到真的存在的 Blob。其餘
不需要驗證縮圖是否真的渲染（只需要版型、圖說、筆數這類跟 Blob 內容無關的行為）
的測試，繼續用 `seedAdmin` 的假 `image` key，因為編輯頁的必填檢核只看這個 key
是否為真值，不要求 Blob 真的存在。

## 前台頁面（Phase 3）沿用同一套 seedAdmin

`app/index.html`（前台列表）與 `app/pub-detail.html`（前台內頁）都是免登入頁面（NFR-003），
讀的仍是 `admin-pages` 這把同一把 key，所以測試照樣呼叫 `seedAdmin(page, [...])` 寫入資料即可，
不需要另外做一套「seedPublic」。`seedAdmin` 同時寫入的 `admin-session` 前台完全不讀，
多寫這筆對前台測試無副作用。

## 登入狀態一併帶入

後台頁面一律被 `auth-guard.js` 擋，`seedAdmin` 會同時寫入 `admin-session`
（sessionStorage），格式對齊 `session-store.js` 內部的 shape：

```json
{ "account": "Admin", "lastActiveAt": <Date.now() 當下>, "timeoutSeconds": 1800 }
```

這樣測試可以直接從 `page-list.html` 開始，不必每條測試都重跑一次登入頁的
UI 流程——登入本身的驗收已經在 `tests/specs/aut-adm-fn-001.spec.ts` 覆蓋過，
頁面列表的測試不需要重複驗證登入。
