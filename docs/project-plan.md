# 頁面管理功能 — 自動化驗收試作 任務清單

本檔是執行用的分階段任務清單，每完成一階段就回來勾選狀態。
本次專案的真正目標不是「把七個畫面做出來」，而是驗證「規格 AC → 自動化測試 → 失敗自動派工」這條流程可不可行。因此階段順序刻意把**最小垂直切片**排在最前面。

---

## 0. 前置結論（先看這段就好）

| 問題 | 結論 |
| :--- | :--- |
| Repo | `https://github.com/Shui-Ching/automated-test.git`——**public**（已透過 GitHub API 確認 `visibility: public`）。決策依據：此階段為模擬資料版本，`Admin`/`Admin1234` 保護的是一個沒有任何真實資料的系統，公開無實質損失。附帶好處是 public repo 的 GitHub Actions 分鐘數無上限。 |
| 需要哪些主機？ | **只需要 GitHub**：程式碼 + Actions 跑測試 + Pages 當預覽站，全部免費且無需第三方服務。自動化測試本身不需要線上網址，CI 在 runner 內起本機 server 跑。**Render 現在不需要**，等到有真後端、真資料庫、真檔案儲存時才需要。詳見〈第 6 節 部署與存取〉。 |
| 資料夾要改英文嗎？ | **程式碼與測試資料夾一律英文 kebab-case**（我的 CLAUDE.md 命名慣例）。**`srs/` 底下的規格文件維持中文不動**——編號結構是給人讀的，改掉反而失去意義。但規格檔名裡的 `[ ]` 與空白建議處理，理由見〈風險 R-6〉。 |
| 誰寫測試腳本？ | **PM 端（規格開立者）撰寫**。前端負責提供 `data-testid` 與測試契約，不寫測試斷言。這樣測試的權威來源是規格本身，避免「實作者自己改考卷」。可行的前提是加上〈第 5 節〉的契約檢查關卡。 |
| 做 skill 還是任務清單？ | **先做任務清單（就是本檔）**。等 Phase 1 的流程真的跑通一次，再把「AC → 測試 → 派工」抽成可重用的 skill，那時候才知道 skill 該寫什麼。現在寫等於憑想像寫。 |
| 總共要測幾條？ | 規格中的 AC 共 **39 條**（另有 2 條 EX 例外情境不列入客戶驗收）。其中 3 條是「欄位驗證（概括）」，展開成〈欄位驗證〉表的個別規則後，**實際測試案例約 60 條**。 |

### AC 數量分佈

| 功能 | 正常 | 阻擋 | 小計 | 概括展開後 |
| :--- | ---: | ---: | ---: | ---: |
| [AUT-ADM-FN-001] 後台登入 | 1 | 2 | 3 | 4 |
| [PAG-ADM-FN-001] 後台 頁面列表 | 5 | 1 | 6 | 6 |
| [PAG-ADM-FN-002] 後台 新增頁面 | 4 | 3 | 7 | 17 |
| [PAG-ADM-FN-003] 後台 編輯頁面 | 6 | 2 | 8 | 18 |
| [PUB-WEB-FN-001] 前台 頁面列表 | 3 | 1 | 4 | 4 |
| [PUB-WEB-FN-002] 前台 頁面內容顯示 | 10 | 1 | 11 | 11 |
| **合計** | **29** | **10** | **39** | **60** |

---

## 1. 技術選型（假設，若不同請在 Phase 0 推翻）

我採用的假設是：**本階段是純前端模擬資料版本，沒有真後端**。依據是專案資料夾名稱「模擬資料」、規格把帳密寫死成 `Admin` / `Admin1234`、以及整份 SRS 沒有任何 API 規格或資料表定義。

| 項目 | 選用 | 理由 |
| :--- | :--- | :--- |
| 前端 | 原生 HTML / SCSS / JS | 我的預設技術棧，本專案規模不需要框架 |
| 資料層 | IndexedDB（圖片）+ localStorage（頁面資料） | 見〈風險 R-8〉：base64 圖片會撐爆 localStorage |
| 測試 | Playwright（TypeScript） | 跨瀏覽器、內建 trace/截圖、JSON reporter 好解析 |
| CI | GitHub Actions | 對 public/private repo 皆免費額度足夠 |
| 預覽站 | GitHub Pages | repo 為 public，Pages 免費且開箱可用，不必再接第三方服務。網址公開，PM 直接開就能看 |

**CI 測試不要打線上站**：免費方案的伺服器會休眠冷啟動，會把「測試不穩」誤判成「功能有 bug」，剛好污染我們要量的訊號。

---

## 2. 目錄結構（Phase 0 建立）

```
srs/                     ← 規格文件，維持中文，不動
app/                     ← 前端實作
  index.html             ← 前台列表
  page-detail.html       ← 前台內頁
  admin/
    login.html
    page-list.html
    page-create.html
    page-edit.html
  assets/
    scss/
    js/
      data-store.js      ← 模擬資料層（唯一資料存取入口）
      auth-guard.js
tests/                   ← Playwright
  specs/
    aut-admin-login.spec.ts
    pag-admin-page-list.spec.ts
    ...
  contract/              ← 前端 ↔ PM 的交接介面（見第 5 節）
    testid-map.json      ← 頁面 → data-testid 清單（前端維護）
    seed.md              ← 資料重置方式（前端維護）
    assertion-types.md   ← 斷言型態範例（前端維護）
    ac-coverage.json     ← AC → 測試 → 負責單位 → 人工測試結果（PM 端維護）
    contract-check.spec.ts ← 契約檢查關卡，跑在所有功能測試之前
  fixtures/              ← 測試用小圖、種子資料
  support/
    seed.ts              ← 每個測試前重置資料狀態
  reporters/
    dispatch-reporter.ts ← 失敗 → 派工單
.github/workflows/
  e2e.yml
project-plan.md          ← 本檔
```

---

## 3. 分階段任務

### Phase 0 — 基礎建設與決策（狀態：全部完成）

| # | 任務 | 產出／驗收 |
| :-- | :--- | :--- |
| 0.1 | ~~`git init` 並接上 remote~~ **已完成**：已確認本層與下一層無既有 `.git`，`core.quotepath false` 已設，`.gitignore` 已建。**已 push 至 `main`** | — |
| 0.2 | ~~建立目錄結構與空殼檔案~~ **已完成** | `npm run dev` 可啟動於 `http://localhost:5173` |
| 0.3 | ~~安裝 Playwright，跑通一條 hello-world 測試~~ **已完成** | `npx playwright test` 1 passed；並已刻意改壞標題確認測試會紅、再還原，證明斷言有辨識力 |
| 0.4 | ~~逾時的可注入設計~~ **已完成**：`app/assets/js/session-store.js` 支援 `?sessionTimeout=<秒>`，正式值 1800 秒。**NFR-004 的寫入失敗開關留待 Phase 2 做 `data-store.js` 時一併處理** | — |
| 0.5 | ~~定義 `ac-coverage.json` 的派工規則（前端／後端／設計＋前端三類）~~ **已完成**：`tests/contract/ac-coverage.json` 60 條 AC／展開案例全部有歸屬，分類規則依第 179～186 行落地；`dispatch-reporter.ts` 的 `resolveUnit()` 已改成依 test title 查此表，不再硬編「其餘也是前端」；已用刻意植入的登入錯誤文案 bug 驗證查表結果為「前端」，還原後 `git diff app/assets/js/login.js` 乾淨 | 60 條 AC 全部有歸屬 |
| 0.6 | ~~PM 修正 SRS 的 NFR 編號錯誤~~ **已完成**（見風險 R-5）：`3.2_非功能需求.md` 的 NFR-001 適用功能移除 `[AUT-ADM-FN-001]`（登入頁本身不受「須登入才能存取」規則約束，避免自我矛盾）；6 份功能規格檔（`AUT-ADM-FN-001`、`PAG-ADM-FN-001/002/003`、`PUB-WEB-FN-001/002`）的 NFR 引用改為 NFR-004→001、005→002、006→003、007→004，全部對得上 3.2 章實際編號 | 功能檔引用的 NFR 編號對得上 3.2 章 |
| 0.7 | ~~開啟 GitHub Pages 並確認部署~~ **已完成**：repo Settings → Pages 設為 Source: GitHub Actions；新增 `.github/workflows/pages.yml` 把 `app/` 目錄部署為 Pages 根目錄（與 `npm run dev` 的服務根目錄一致）。**部署與 E2E 兩條 workflow push 後皆執行成功**（run id 33375590144、33375590119）。用 `curl -I` 逐一驗證 `https://shui-ching.github.io/automated-test/`、`/admin/login.html`、`/assets/css/main.css`、`/assets/js/{session-store,login,auth-guard}.js` 皆回 200，證明相對路徑在 `/automated-test/` 子路徑下正確解析，沒有踩到風險 R-6 的絕對路徑問題 | 用實際的 Pages 網址開一次，確認 CSS 與 JS 都載入成功（子路徑的相對路徑問題只有在線上才驗得出來） |

- **時間**：1～2 小時（0.6 由 PM 端做，約 10 分鐘）
- **Token**：約佔一個全新對話視窗的 15%
- **可否單 session 完成**：可以

---

### Phase 1 — 垂直切片：用「後台登入」驗證整條流程（狀態：已完成，1.1～1.9）

**這一階段就是在回答「自動化驗收可不可行」。做完這階段就能下判斷，不必等七個畫面全做完。**

| # | 任務 | 產出／驗收 |
| :-- | :--- | :--- |
| 1.1 | 呼叫 `frontend-design` 與 `frontend-standards` skill，定下視覺方向與命名規範 | 規範確認，後續階段沿用 |
| 1.2 | 實作 `admin/login.html` + 登入驗證 + 登入狀態建立 | 手動可登入成功並導向頁面列表 |
| 1.3 | 實作 `auth-guard.js`（未登入阻斷，且**不得先渲染再導頁**，見風險 R-2） | 未登入直接輸入後台網址 → 立刻導回登入頁 |
| 1.4 | 產出登入頁的**測試契約**（見第 5 節）：testid 清單、種子資料重置方式、斷言型態 | PM 端的 AI 拿這份就能寫出 4 條測試，不需要看實作程式碼 |
| 1.5 | 寫**契約檢查測試**：載入每個頁面，斷言契約宣告的每個 testid 都存在 | 這是 PM 端測試能不能成立的前提，見第 5 節 |
| 1.6 | PM 端依契約寫 4 條 Playwright 測試，測試標題內嵌 AC 編號 | `test('[AUT-ADM-FN-001] AC-P1 成功登入後台', ...)` |
| 1.7 | 寫 `dispatch-reporter.ts`：**實作為 Playwright 自訂 Reporter**（掛 `onTestEnd`／`onEnd`），不另外解析 JSON reporter 的輸出檔——省一次重複解析，且不受 JSON 檔案落盤時機影響 → 產出派工單 Markdown | 失敗時 `test-results/dispatch.md` 產出含「AC 編號 / 情境 / 預期 / 實得 / 負責單位 / 截圖」的條列，全綠時輸出「沒有需要派工的失敗項目」 |
| 1.8 | **刻意植入一個 bug**（例如把錯誤文案改錯字），確認測試會紅、派工單會產出 | 這是本階段最重要的一步：證明測試有辨識力，不是永遠綠燈。**注意本階段只驗證「偵測到 + 產得出報告」，不驗證派工分類**——登入功能的 4 條 AC 全部落在「前端」一類，判對是必然的，證明不了三分類機制（三分類的驗證排在 2.9） |
| 1.9 | 接上 GitHub Actions，push 後自動跑並上傳報告 | Actions 頁面看得到綠／紅與派工單 artifact |

- **時間**：3～4 小時
- **Token**：約佔一個全新視窗的 40%
- **可否單 session 完成**：可以，但建議做完後用 `handoff` 產交接文件再換 session
- **階段決策點**：1.8 若順利，代表「測試抓得到問題、報告產得出來」這半條路可行，繼續 Phase 2；若測試植入 bug 後仍是綠燈，先修測試寫法，不要往下疊功能。派工分類是否可行要到 2.9 才有答案

---

### Phase 2 — 後台頁面管理 CRUD（狀態：已完成）

| # | 任務 | 對應 AC |
| :-- | :--- | :--- |
| 2.1 | ~~資料層 `data-store.js`~~ **已完成**：列表查詢、硬刪除、唯一值檢核（`pageNameExists`）、新增寫入（`createPage`）、更新寫入（`updatePage`）、依 id 取單筆（`getPageById`）、IndexedDB 圖片 Blob 存取（`saveImageBlob`／`getImageBlob`／`deleteImageBlob`）全部到位 | 全功能共用 |
| 2.2 | ~~頁面列表：預設排序、名稱模糊搜尋、日期區間篩選、分頁（10/20/50）、登出~~ **已完成** | PAG-001 AC-P1、P2、P5、B1 |
| 2.3 | ~~刪除確認彈窗 + 硬刪除 + Toast~~ **已完成**：原生 `<dialog>`，內建 focus trap 與 Esc 關閉 | PAG-001 AC-P3、P4 |
| 2.4 | ~~新增頁面：欄位、圖文區塊可重複群組（1～3 組）、圖片上傳與預覽、富文本編輯器~~ **已完成**：`app/admin/page-create.html`／`page-create.js`。富文本編輯器改用 Quill 1.3.7（CDN，SRI 已固定版本），使用者已確認可加此依賴；工具列自訂容器承載 `data-testid`，內嵌圖片與區塊圖片都走 IndexedDB（風險 R-8） | PAG-002 AC-P1～P4、B2、B3 |
| 2.5 | ~~欄位驗證共用模組（11 條規則、送出時／離開欄位時兩種時機）~~ **已完成**：`app/assets/js/field-validation.js`，純函式、不碰 DOM，2.4／2.6 共用 | PAG-002/003 AC-B1 展開 |
| 2.6 | ~~編輯頁面：帶入既有值、還原區塊、唯一值檢核排除本筆、返回不寫入~~ **已完成**：`app/admin/page-edit.html`／`page-edit.js`。畫面結構與驗證邏輯高度沿用 page-create.js，差異點是每組區塊多一個 `existingImageId`（沿用原圖片，特殊規則 3）、儲存前重新確認資料仍存在（EX-1）、頁面內容載入時把儲存格式的 `idb:<id>` 參照換回可顯示的 blob URL。過程中發現並修正一個 renderBlocks 的邏輯缺口：垃圾桶按鈕原本綁在「縮圖是否成功解出」而非「資料上是否有圖片」，會讓找不到對應 Blob 的既有圖片永遠無法被清除重傳，已改成看 `existingImageId`／`file` 是否為真值 | PAG-003 AC-P1～P6、B1、B2 |
| 2.7 | ~~產出後台三頁的測試契約~~ **已完成**：`testid-map.json` 新增 `page-edit` 條目，與 page-create 共用同一批 `page-form-*` testid；因編輯頁需要 `?id=` 帶入既有資料才不會被 EX-1 導回列表，額外帶了 `seed` 欄位供契約檢查使用 | — |
| 2.8 | ~~契約檢查測試擴充到後台三頁~~ **已完成**：`contract-check.spec.ts` 改用 `page.seed ?? []`（原本寫死空陣列），其餘頁面不受影響，page-edit 用契約檔自帶的種子資料通過契約檢查 | — |
| 2.8b | ~~PAG-ADM-FN-001 全部 6 條 AC 測試~~ **已完成**：`tests/specs/pag-adm-fn-001.spec.ts`（AC-P1～P5、AC-B1），並已回填 `ac-coverage.json` 對應列。以刻意植入 bug（硬刪除不寫回 storage）驗證 AC-P3 會轉紅、派工單正確歸類為「後端」，還原後 16 條測試（含 Phase 1）全綠 | PAG-001 全部 6 條 |
| 2.8c | ~~PAG-ADM-FN-002 共 15／17 條 AC 測試~~ **已完成**：`tests/specs/pag-adm-fn-002.spec.ts`，並已回填 `ac-coverage.json` 對應列。以刻意植入 bug（區塊移除邏輯改成永遠刪第一組）驗證 AC-P3 會轉紅，還原後全綠。**AC-P4「再次進入編輯頁時應完整還原」的後半段已在 2.6 補上**（導向編輯頁驗證粗體與項目清單格式還原）。**AC-B1「區塊版型每一組皆不可為空」（id 20）維持不寫測試**，原因見下方第 9 節 | PAG-002 15／17 條 |
| 2.8d | ~~PAG-ADM-FN-003 共 16／17 條 AC 測試~~ **已完成**：`tests/specs/pag-adm-fn-003.spec.ts`（AC-P1～P6、AC-B1 展開 10 條、AC-B2），並已回填 `ac-coverage.json` 對應列。AC-P1（縮圖正確渲染）刻意不用 `seedAdmin` 填假的 IndexedDB key，改成先跑一遍新增頁的真實 UI 流程上傳圖片再進編輯頁，理由見 `tests/contract/seed.md`。以刻意植入 bug（唯一值檢核排除本筆的 `excludeId` 被拿掉）驗證 AC-P5 會轉紅（且因為多條測試共用同一筆「品牌故事」種子資料、都沒有改名稱，AC-P2～P4 跟著一起轉紅，這是預期中的連鎖，不是測試寫錯），還原後 51 條測試（全專案）全綠。**AC-B1「區塊版型每一組皆不可為空」（id 39）沿用 PAG-ADM-FN-002 同一條理由不寫測試** | PAG-003 16／17 條 |
| 2.9 | ~~派工分類驗證~~ **已完成**：分別植入三個 bug，各自單獨跑對應測試確認轉紅、`test-results/dispatch.md` 派工單正確掛對單位，還原後 51 條測試全綠。①`page-create.js` 的 `removeButton.hidden` 判斷式反轉（`<=` 改 `>`）→ AC-B3「圖文區塊不可移除至零組」轉紅，掛「需人工設計審查」；連鎖轉紅的 AC-P3 掛「前端」，與其登記相符。②`field-validation.js` 的 `VALIDATION_MESSAGES.nameRequired` 改錯字（"頁面"→"頁而"）→ PAG-002／003 兩條 AC-B1「頁面名稱不可為空」同時轉紅，皆掛「前端」。③`data-store.js` 的 `pageNameExists` 改成永遠回傳 `false`→ PAG-002／003 兩條 AC-B1「頁面名稱不可與現存資料重疊」同時轉紅，皆掛「後端」。**驗證方法本身也先做過確認**：跑一次全綠基準（確認 `dispatch.md` 印出「沒有需要派工的失敗項目」）、每次注入前先刪除舊的 `dispatch.md` 再重新產生，避免看到上一輪殘留檔案誤判；三個 bug 逐一注入、單獨跑對應測試檔驗證、立即還原，全部還原後才跑一次全專案 51 條做最終確認，過程中沒有交叉污染。**過程中發現並修正一個 `ac-coverage.json` 的既有分類錯誤**：id 27（PAG-002 AC-B3）原本登記為「前端」，但其 Then 敘述「移除按鈕不得顯示」屬於規則表（本文件第 186 行）定義的「顯示／隱藏樣式」類，應為「需人工設計審查」，已改判——這正是 `pm-feedback.md` D-3 所述「沒有 UI 截圖無法斷定是設計或前端出錯」的實例，2.4 也曾在此踩過真實的 `.button[hidden]` CSS 被覆蓋的 bug，性質相符。**確認的限制（與原計畫一致）**：`dispatch-reporter.ts` 是依 `ac-coverage.json` 的登記做精確比對，不是從程式碼內容推論問題性質——所以 2.9 驗證的是「轉紅的測試 → 對應到登記正確的單位」這條路徑本身可靠，而不是「系統能自動判斷某段程式碼是設計問題還是前端問題」；沒有 UI 截圖時，版型類 AC 仍只能停在「需人工設計審查」這個粗類，見 `pm-feedback.md` D-3 |

**2.4 過程中發現並修正的兩個既有 bug（超出 2.4 本身範圍，但直接卡住這次要做的功能，已修正）：**
- `app/assets/scss/components/_button.scss` 的 `.button` 設了 `display: inline-flex`，蓋掉瀏覽器 `[hidden] { display: none }` 的內建規則（author style 蓋過 UA style），導致任何帶 `hidden` 屬性的 `.button` 元素實際上還是會顯示。專案先前沒有任何頁面對 `.button` 用過 `hidden`，這次 AC-B3（移除按鈕僅剩 1 組時「不得顯示」）第一次踩到。修法：補上 `.button[hidden] { display: none; }`。
- `tests/support/seed.ts` 的 `seedAdmin`：`page.addInitScript` 會在同一分頁的每一次導覽都重跑，2.4 起才有的「新增頁面 → 儲存 → 導回列表」這種跨頁流程，會讓第二次導覽時把 UI 剛寫入的資料被種子資料整批覆蓋掉。Phase 2.1～2.3 因為測試都只在單一頁面操作，沒有觸發過這條路徑。修法：`admin-pages` 的寫入包一層 `sessionStorage` sentinel，只在同一分頁的第一次導覽執行，`seed.md` 已同步更正原本「不管導去哪一頁都還在」這句過於樂觀的描述。

- **時間**：8～12 小時（富文本編輯器與圖片上傳是主要變數；若改用現成編輯器套件約省 2 小時，但需先問過我再加依賴）
- **Token**：約 2～3 個完整視窗
- **可否單 session 完成**：不行，預計 3 個 session，每個 session 收尾寫 handoff

---

### Phase 3 — 前台展示（狀態：**已完成**，2026-08-31）

本階段由 PM 端 AI 一併代寫前端（原分工是「PM 開規格 → 使用者做前端畫面 → PM 寫測試」，
Phase 3 啟動時前台頁面尚未有任何前端程式碼，經詢問後改為本次由 AI 代寫，見對話紀錄）。

啟動前先處理兩個卡點：
1. **`docs/pm-feedback.md` A-1（同建立日期次要排序沒有可用欄位）**：詢問後採方案 A 定案——
   在 `[PAG-ADM-FN-002]` 欄位定義表補列「主鍵」欄位定義，`[PUB-WEB-FN-001]`〈預設排序定義〉
   改為「同一建立日期時，以主鍵由大至小為次要排序」。對應實作：`data-store.js` 新增
   `listPublicPages()`，排序邏輯獨立於 `listPages()`（後台列表）之外，不影響既有 51 條測試。
2. **風險 R-3（HTML 原樣渲染的 XSS 缺口）**：實作白名單消毒 `app/assets/js/html-sanitize.js`，
   允許標籤對齊編輯器工具列（`p`、`br`、`b`、`strong`、`i`、`em`、`ul`、`ol`、`li`、`a`、`img`），
   移除其餘標籤外層（保留文字）、危險標籤（`script`／`style`／`iframe`／`object`／`embed`）連內容
   一併移除，並清掉 `on*` 事件屬性與 `javascript:` 開頭的連結／圖片來源。

| # | 任務 | 對應 AC | 完成狀態 |
| :-- | :--- | :--- | :--- |
| 3.1 | 前台列表：全量顯示、排序（建立日期新→舊，同日以主鍵大→小）、分頁、查無資料 | PUB-001 全部 4 條 | **已完成**：`app/index.html`／`app/assets/js/pub-list.js`，沿用 `page-list.js` 分頁邏輯，無搜尋（規格特殊規則 1），免登入（NFR-003） |
| 3.2 | 前台內頁：多組區塊依序渲染、左右版型各組獨立 | PUB-002 AC-P1～P3 | **已完成**：`app/pub-detail.html`／`app/assets/js/pub-detail.js`，版型用 flex `row`／`row-reverse` 反映幾何位置，測試用 `boundingBox()` 量測而非只驗 class（見 R-7） |
| 3.3 | HTML 內容渲染（**必須做消毒，見風險 R-3**）、選填欄位空值整區隱藏 | PUB-002 AC-P4、P10 | **已完成**：見上方 R-3 處理方式；內容與補充說明皆為空時整區塊 `hidden` |
| 3.4 | 上一則／下一則導覽（含首末筆隱藏、單筆全隱藏） | PUB-002 AC-P5～P9 | **已完成**：`listPublicPages()` 找出相鄰筆，用 `<a href>` 導頁（語意為導航而非動作），首末筆與單筆資料時對應元件 `hidden` |
| 3.5 | 已刪除頁面的存取處理 | PUB-002 AC-B1、PUB-001 AC-B1 | **已完成**：硬刪除後的頁面本來就不在 `readAll()` 回傳陣列裡，前台列表與內頁的「不得出現／導回列表並提示」不需要另外過濾邏輯 |
| 3.6 | 對應的 Playwright 測試（15 條），**負向斷言一律配對正向基準**（見風險 R-7） | — | **已完成**：`tests/specs/pub-web-fn-001.spec.ts`（4 條）、`tests/specs/pub-web-fn-002.spec.ts`（11 條），版型類 AC 以刻意植入 bug（`pub-block--${block.layout}` 改成寫死 `image-left`）驗證會轉紅並掛「需人工設計審查」，還原後全專案 68 條測試（含 Phase 0～2）全綠 |

**契約新增**：`tests/contract/testid-map.json` 補上 `pub-list`、`pub-detail` 兩個頁面條目；
`tests/contract/ac-coverage.json` id 46～60 補齊 `test_file`／`test_title`（單位分類沿用先前
session 已預先登記的版本，未變動）；`tests/contract/seed.md` 補一節說明前台頁面沿用同一套
`seedAdmin()`，不需另建 `seedPublic`。

---

### Phase 4 — 自動派工機制完整化（狀態：全部完成）

| # | 任務 | 產出 |
| :-- | :--- | :--- |
| 4.1 | 派工單格式定案：問題條列、重現步驟（直接取 AC 的 Given/When/Then）、失敗截圖、trace 連結 | **已完成**：`tests/reporters/dispatch-reporter.ts`（Phase 2.9 已建置，本次補上 trace 欄位與相對路徑，見下方說明）產出 `test-results/dispatch.md`，CI（`e2e.yml`）跑完自動上傳為 artifact |
| 4.2 | 三類負責單位判定規則落地 | **已完成**：規則見下表，落地於 `tests/contract/ac-coverage.json` 與 `dispatch-reporter.ts` 的 `resolveUnit()`（Phase 2.9 已建置） |
| 4.3 | 失敗自動開 GitHub Issue 並掛 label（`owner:frontend` 等） | **已完成並在真實 GitHub Actions 實跑驗證過**：`.github/scripts/parse-dispatch.js` 解析 `dispatch.md`、`.github/workflows/e2e.yml` 新增手動觸發（`workflow_dispatch`）才執行的建立 Issue 步驟，依 `dispatch-id` HTML 註解搭配 `gh issue list --search` 去重、`gh label create --force` 自動補標籤。**驗證方式**：在臨時分支 `tmp/verify-4.3-issue-creation` 植入與 4.4 相同的後端唯一值檢核 bug、push、手動觸發 `workflow_dispatch`，確認正確建立 2 筆真實 Issue（[#1](https://github.com/Shui-Ching/automated-test/issues/1)、[#2](https://github.com/Shui-Ching/automated-test/issues/2)，標題、`owner:backend` label、執行紀錄連結皆正確），再觸發第二次確認去重機制正確略過、不重複建立，驗證後已關閉兩筆 Issue、還原程式碼、刪除臨時分支。**僅手動觸發時才會真的建立 Issue**，push／PR 觸發不會自動開單，避免洗版 public repo |
| 4.4 | 全量測試跑一輪，**與 PM 的人工結果做四格交叉比對**，算出假綠燈與假紅燈各幾條 | **已完成**：以刻意植入已知 bug 取代 PM 人工結果基準，涵蓋三類負責單位規則各 1 個真實 bug + 1 種契約漂移情境，過程中發現並修正 `contract-check.spec.ts` 未涵蓋 `block_testids` 的缺口。完整報告見 `docs/dispatch-feasibility-report.md`：已植入驗證的 8 條路徑假綠燈 0 條，假紅燈情境已修正並重新驗證通過；**方法上無法偵測完全沒有自動化測試覆蓋的 AC（例如 id 20、39），這兩筆是已知的永久假綠燈名額**，結論是抽樣結果，非窮舉 60 條 AC 的保證 |
| 4.5 | 把跑通的流程抽成可重用 skill（此時才做） | **已完成**：`~/.claude/skills/auto-test-dispatch/`（個人全域 skill，跨專案共用，依規則不進本專案 repo）。內含 `dispatch-reporter.ts`／`parse-dispatch.js`（可直接複製沿用）、`contract-check.spec.ts.template`、`e2e-workflow.yml` 範本，以及 `references/methodology.md`（三類負責單位判定規則、契約檢查關卡設計、四格交叉比對驗證法、三個實測踩過的坑） |

**負責單位判定規則（依 AC 的 Then 敘述形態）：**

| AC 描述特徵 | 判給 |
| :--- | :--- |
| 版型、排列方向、置左置右、並列、顯示／隱藏樣式 | 需人工設計審查（PM 補上 UI 截圖後才能改判為「設計＋前端」） |
| 欄位驗證、錯誤文案、按鈕停用、導頁、Toast、分頁行為 | 前端 |
| 資料寫入、唯一值、硬刪除、逾時、資料不存在 | 後端（本階段等同模擬資料層） |

- **時間**：4～6 小時
- **Token**：約 1.5 個視窗

---

### Phase 5 — 真後端與部署（延後，非本次範圍）

只有在決定要脫離模擬資料時才做。屆時才需要 Render 或同級主機。

- 後端 API + 資料庫（頁面資料、圖片檔案儲存）
- 真正的帳號驗證與 session 管理（取代寫死帳密）
- Render：Web Service（後端）+ PostgreSQL + 物件儲存（圖片不能存在 Render 的檔案系統，重啟會消失）
- 時間：3～5 天

---

## 4. 整體時間與資源估算

| 階段 | 時間 | Token（等同幾個完整對話視窗） |
| :--- | :--- | :--- |
| Phase 0 基礎建設 | 1～2 小時 | 0.15 |
| Phase 1 垂直切片 | 3～4 小時 | 0.4 |
| Phase 2 後台 CRUD | 8～12 小時 | 2～3 |
| Phase 3 前台 | 4～6 小時 | 1.5 |
| Phase 4 派工機制 | 4～6 小時 | 1.5 |
| **合計（不含 Phase 5）** | **20～30 小時** | **約 6～7 個視窗** |

「Token 幾 %」這個問法要修正一下：Claude 的進度條顯示的是**當前對話視窗**的使用量，每開新 session 就歸零，所以沒有「整個專案佔幾 %」這種數字。上表給的是「這階段大約會吃掉幾個完整視窗」，實務意義是**要換幾次 session**。換 session 前用 `handoff` skill 產交接文件。

---

## 5. 測試契約（前端 ↔ PM 的交接介面）

分工定案：**PM 端寫測試腳本，前端提供契約**。前端不寫測試斷言，PM 端不自己發明選擇器。中間靠一份雙方共用的契約檔銜接。

### 契約檔內容（`tests/contract/` 底下）

| 檔案 | 內容 | 誰維護 |
| :--- | :--- | :--- |
| `testid-map.json` | 每個頁面有哪些 `data-testid`、各自對應什麼元素與功能 | 前端 |
| `seed.md` | 每條測試開始前如何把資料重置到指定狀態 | 前端 |
| `assertion-types.md` | 四種斷言型態的寫法範例（文字比對／幾何量測／存在性／數量） | 前端 |
| `ac-coverage.json` | AC 編號 → 測試檔與 test title → 負責單位 | PM 端 |

### `data-testid` 命名文法（跨專案沿用的部分）

```
<功能區>-<物件>-<角色>
```

- 功能區：`login`、`page-list`、`page-form`、`pub-list`、`pub-detail`
- 全小寫 kebab-case，前綴用功能區不用版面位置（`header-button` 在版面調整後就對不上）
- 列表的列不用索引：`data-testid="page-row"` + `data-page-name="關於我們"`
- 一旦被測試引用就是對外契約，改名等同改 API

範例：`login-username`、`login-submit`、`login-error`、`page-list-search-name`、`page-form-block-1-layout`

**跨專案能沿用的是「文法 + 斷言型態分類 + 派工規則」，不是 testid 清單本身**——清單必然隨功能而不同。把這三樣抽成規範，換專案時重寫的只有清單。

### 契約檢查關卡（讓這套分工成立的關鍵）

PM 端依命名文法寫出 `page-form-name`，前端實際寫成 `page-form-page-name`——測試就會紅，但報告上顯示的是「找不到元素」，看起來像功能壞了。這種假紅燈如果混在真 bug 裡，triage 成本會比人工測試還高，整套流程的價值就沒了。

解法是在所有功能測試之前先跑一道 **契約檢查測試**：載入每個頁面，逐一斷言 `testid-map.json` 宣告的每個 testid 都存在於 DOM。幾秒鐘跑完，而且它把失敗分成兩種完全不同的類別：

| 契約檢查 | 功能測試 | 判讀 |
| :--- | :--- | :--- |
| 紅 | — | 前端沒有照契約實作，或契約過期。**派給前端，不是 bug** |
| 綠 | 紅 | testid 都在，行為不對。**這才是真 bug**，依 AC 型態派工 |

沒有這道關卡，PM 端寫測試這個分工不成立；有了它就成立。

### 人工測試是對照組，不是重複勞動

PM 除了跑 AI 測試，也會人工手動測一輪比對是否一致。**這一輪不是多餘的保險，它是唯一能回答「這套自動化到底準不準」的東西**——沒有人工基準，自動化測試全綠只能證明「測試沒抓到問題」，不能證明「沒有問題」。

兩邊都依 AC 編號記錄結果，交叉比對會落在四個格子裡：

| | 人工判定 通過 | 人工判定 失敗 |
| :--- | :--- | :--- |
| **自動 通過** | 一致 ✅ | **假綠燈**——測試漏掉了真 bug |
| **自動 失敗** | **假紅燈**——測試自己有問題 | 一致 ✅ |

對角線一致代表這條 AC 的自動化可信。真正要看的是另外兩格：

- **假綠燈是最貴的一種錯誤。** 它讓人以為驗過了，實際沒驗——而且不會有任何訊號提醒你。風險 R-7 的負向斷言問題，症狀就是整片假綠燈。這一格出現幾次，直接決定「可行／不可行」的結論。
- **假紅燈**多數會被契約檢查關卡攔下並正確歸類（testid 對不上，不是 bug）。若契約檢查是綠的卻仍出現假紅燈，代表測試把 AC 讀錯了，要回頭修測試或補規格的模糊處。

### 人工測試的做法（兩件事會影響結論品質）

1. **先人工、後看報告，或至少不要先看報告。** 如果 PM 先看到自動化結果說「AC-P6 通過」，再去手動點，很難不變成確認那個結論而不是獨立判斷——這樣兩邊就不是獨立的兩次量測，交叉比對也就失去意義。做法是人工先跑完並記錄，再拉出自動化結果對照。
2. **人工只在每個階段末跑一輪，不必每次都跑。** 人工測試是校準用的，自動化才是拿來反覆跑的。Phase 1、Phase 2、Phase 3 各做一次完整人工對照就夠；之後只有在自動化改動較大時再校準一次。

人工結果記在 `tests/contract/ac-coverage.json` 的同一份表裡（多一個 `manual_result` 欄位），這樣統計誤判率就是讀同一份檔案，不需要人工彙整。

---

## 6. 部署與存取（PM 怎麼拿到可測的網址）

### PM 需要網址的兩種情境，需求不一樣

| 情境 | 需要線上網址嗎 | 做法 |
| :--- | :--- | :--- |
| **跑自動化測試** | **不需要** | GitHub Actions 在 runner 內起本機 dev server，Playwright 打 `localhost`。跑完把 HTML 報告與派工單當作 artifact 上傳，PM 從 Actions 頁面下載。public repo 的 Actions 分鐘數無上限 |
| **用眼睛看畫面** | 需要 | GitHub Pages，見下 |

**這點值得記住**：這次試作的主線（測試 → 報告 → 派工）完全不依賴任何對外網址。預覽站只是給人看的輔助——派工單本來就會附上失敗當下的截圖與 Playwright trace，PM 多數時候不需要自己開網站點。

### 預覽站：GitHub Pages

repo 已設為 public，Pages 直接可用：

1. repo Settings → Pages，Source 選 GitHub Actions（或指定分支）
2. 部署後網址為 `https://shui-ching.github.io/automated-test/`
3. 前台入口 `/app/index.html`、後台登入 `/app/admin/login.html`

**注意靜態站的路徑問題**：Pages 的專案站台掛在 `/automated-test/` 子路徑下，不是網域根目錄。頁面之間的連結與資源引用一律用相對路徑，不要寫 `/assets/...` 這種以斜線開頭的絕對路徑——本機開發時看起來正常，部署到 Pages 之後會全部 404。這個差異在本機測不出來，要用實際的 Pages 網址驗一次。

### 帳密的處理（沿用，與 repo 是否公開無關）

帳密集中放在 `app/assets/js/mock-credentials.js`，檔頭註明「模擬用，Phase 5 接真後端時必須整支刪除」。這組密碼不要在任何真實服務上使用。

理由不是這次會出事——這個系統裡沒有任何真實資料，公開沒有實質損失，這是已經確認過的判斷。理由是**避免這個寫法被當成範本沿用**：等 Phase 5 接了真後端、有了真實使用者，同樣的結構若原封不動留著就變成真的漏洞，而那時候沒有任何錯誤訊息會提醒任何人。集中在一支檔案並標註清楚，是讓它在該被刪掉的時候顯眼到不會被漏掉。

**另外一條同樣重要**：repo 公開之後，之後任何提交進去的東西也是公開的。測試用的種子資料、失敗截圖、trace 檔案裡若出現真實客戶名稱、真實內容或內部資訊，就會一併公開。fixture 一律用虛構資料（規格裡的「品牌故事」「測試頁面 A」這類就很好）。

---

## 7. 風險清單（開工前要處理，不要撞到才想）

### R-1 — NFR-002 的 30 分鐘逾時無法用 E2E 測（Phase 0 決策）
沒有任何測試套件會等 30 分鐘。程式必須把逾時秒數做成可注入的設定值（例如讀 URL query 或測試專用 hook），測試時設成 2 秒。**不做這件事，這條 NFR 就永遠只能人工測**——而人工測正是這次要消滅的東西。

### R-2 — NFR-001 要求「不得於任何時點顯示版面骨架」
純前端的登入守衛若是「頁面渲染完再檢查 localStorage 然後導頁」，畫面會閃一下後台版型，這條 AC 會真的失敗。做法是在 `<head>` 內以同步 script 先判斷，未登入就直接 `location.replace()`，在第一次繪製前擋掉。

### R-3 — 頁面內容以 HTML 原樣渲染是設計上的 XSS 漏洞（資安）
規格 PAG-002 特殊規則 4 說「頁面內容以 HTML 格式儲存，不套用一般字元集限制」，PUB-002 AC-P4 說「以 HTML 原樣渲染」。照字面實作就是把使用者輸入直接塞進 `innerHTML`，等於開一個 XSS 注入點。
**建議修法**：渲染時做白名單消毒，允許清單對齊編輯器工具列即可（`b`、`i`、`ul`、`li`、`a`、`img`），移除所有 `on*` 事件屬性與 `javascript:` 開頭的 href。這樣 AC-P4 仍會通過（粗體與清單都保留），但擋掉 `<script>` 與事件注入。
這是規格層的調整，**超出「照規格實作」的範圍，要不要改請你決定**。

### R-4 — 帳密寫死在前端是模擬，不是權限控管（資安；repo 已確認為 public，此為已知並接受的決定）
`Admin` / `Admin1234` 寫在前端 JS，開 devtools 就看得到，也可以直接改 localStorage 的登入旗標繞過。作為模擬資料版本可以接受，但**必須記錄下來，不可以帶進 Phase 5 的真後端**。repo 已設為 public，這是已確認的決定——此階段沒有任何真實資料，公開無實質損失。要守住的是後續：這組密碼不得用於任何真實服務，且 Phase 5 接真後端時必須整支刪除（見第 6 節）。

### R-5 — SRS 的 NFR 編號對不上（PM 端修正，**已解決，2026-09-01**）
`3.2_非功能需求.md` 只定義了 NFR-001～004，但功能檔引用的是 NFR-004／005／006／007，整組差三號：

| 功能檔引用 | 實際應為 | 內容 |
| :--- | :--- | :--- |
| NFR-004 | NFR-001 | 後台存取權限阻斷 |
| NFR-005 | NFR-002 | 登入逾時 |
| NFR-006 | NFR-003 | 前台免登入與後台入口隔離 |
| NFR-007 | NFR-004 | 資料寫入失敗處理 |

另外同一張表的「適用功能」欄，把 `[AUT-ADM-FN-001]` 列進 NFR-001（後台所有頁面須具備登入狀態方可存取）。照字面套用會變成「登入頁本身也要先登入才能開」，自動產生的 AC→NFR 對照會生出一條矛盾的測試。登入頁應從 NFR-001 的適用範圍排除。

不修的話，測試報告要回溯「這條 AC 對應哪條 NFR」時會全部斷鏈。**已修正**：`3.2_非功能需求.md` 與 6 份功能規格檔（`AUT-ADM-FN-001`、`PAG-ADM-FN-001/002/003`、`PUB-WEB-FN-001/002`）皆已改為正確編號，NFR-001 適用功能已移除 `[AUT-ADM-FN-001]`。

### R-6 — 規格檔名含中括號與空白
`[PAG-ADM-FN-001] 後台 頁面列表.md` 這種檔名，在 glob pattern 裡 `[...]` 是字元集語法，在 shell 裡空白要跳脫，寫任何自動化腳本（例如把 AC 從規格抽出來對照測試結果）都會踩到。
**建議**：檔名改成 `PAG-ADM-FN-001_後台_頁面列表.md`，資料夾維持現狀。中文保留，只拿掉中括號與空白。這是可逆的改名，但仍請你確認後我再動。
另外 git 對非 ASCII 路徑預設會做八進位跳脫，`git config core.quotepath false` 之後 diff 才讀得懂。

### R-7 — 負向斷言必須配正向基準（測試設計，最關鍵的一條）
PUB-002 的 AC-P6（不得出現「上一則」）、AC-P8（兩者皆不顯示）、AC-P10（整區塊不顯示）、PAG-002 的 AC-B3（「移除」按鈕不得顯示），這幾條如果只寫 `await expect(prevLink).not.toBeVisible()`，那麼「功能正確」和「整個頁面根本沒載入」會印出一模一樣的綠燈。
每一條負向斷言都要先確認頁面確實載入了、且同層的對照元件確實可見（例如 AC-P6 要先確認「下一則」看得到、主標題是「甲頁面」），再斷言「上一則」不存在。
**這條直接決定了這次試作的答案是「可行」還是「表面可行」**，Phase 1 的測試就要用這個寫法立標準。

### R-9 — NFR-004（資料寫入失敗）在純前端沒有天然的觸發路徑（Phase 0 決策）
NFR-004 要求寫入失敗時中止作業、提示「系統忙碌中，請稍後再試」、保留已輸入內容、不留半筆資料。但在純前端的模擬資料層裡，寫入不會自己失敗，這條 AC 沒辦法自動測。解法跟 R-1 同一類：在 `data-store.js` 留一個可注入的失敗開關，測試時打開它。這兩件事在 Phase 0 的 0.4 一起決定。

### R-8 — 圖片存 localStorage 會爆容量
單張限 2 MB、每筆最多 3 組區塊，base64 編碼後體積再漲約 1.33 倍，而 localStorage 每個網域通常只有約 5 MB。存兩筆資料就滿了。改用 IndexedDB 直接存 Blob，不需 base64，容量上限也高得多。測試用的 fixture 圖片則一律用小圖（幾 KB），避免拖慢測試。

**同一個問題還有第二條路徑容易漏掉**：PAG-002 的「頁面內容」編輯器工具列有「插入圖片」，同樣限 2 MB，而這段內容是以 HTML 字串儲存的。一張 2 MB 的內嵌圖轉成 base64 約 2.7 MB，塞進單一個 localStorage key 就直接爆掉，走的不是區塊圖片那條路。做法是編輯器插入圖片時同樣先存進 Blob store、HTML 裡只放參照 id，或乾脆整筆頁面資料都改放 IndexedDB。

---

## 8. PM 端待處理事項

已整理成獨立文件 `pm-feedback.md`（A～E 共 11 項）。其中 **A-1（前台次要排序沒有可用欄位）不修就無法實作**，會連鎖卡住 5 條 AC。

## 9. 下一步

Phase 0 的 0.1（git init 已完成、repo 已設 private）與風險 R-3、R-6 需要你先決定，`pm-feedback.md` 的 A-1 需要 PM 先回覆，其餘我可以直接開始做。

**2.4 完成後新增的待決定事項：**

1. **AC-B1「區塊版型每一組皆不可為空」（`ac-coverage.json` id 20，PAG-003 對應 id 39）在目前 UI 上無法用真實使用者操作觸發**：區塊版型單選有規格要求的預設值「左圖右文」，一般人不可能把它清成空值，這條規則因此變成寫了也測不到的防禦性檢核。三個選項：(a) 維持現況，接受這條規則只在程式碼層防禦、不寫自動化測試；(b) 拿掉單選的預設值，讓使用者必須主動選才算數，但這樣會跟規格〈介面欄位定義〉表明寫的「預設值：左圖右文」衝突，要先確認是否要改規格；(c) 用 `page.evaluate` 直接竄改內部狀態硬測，但這脫離真實使用者行為，測試意義存疑。目前採 (a)，PAG-002／PAG-003 皆未寫測試，2.6 沿用同一個決定，未再重新徵詢。
2. ~~AC-P4「再次進入編輯頁時，編輯器內之粗體與項目清單格式應完整還原」只驗證了前半段~~ **已在 2.6 補完**：`tests/specs/pag-adm-fn-002.spec.ts` 的這條測試現在會在新增頁儲存後接著導向 `page-edit.html`，驗證粗體與項目清單格式正確還原。
3. **2.6 新增的待決定事項——編輯頁面「圖文區塊已達上限」不顯示錯誤提示的驗收方式**：沒有新的待決定事項，AC-B2 沿用與 PAG-ADM-FN-002 相同的「按鈕停用即可，不驗顯示錯誤提示」寫法，UI 邏輯與新增頁一致，無需另外請示。
4. **2.6 新增的技術決定——IndexedDB 圖片填種缺口不擴充 `seedAdmin`**：詳細理由見 `tests/contract/seed.md`〈`image` key 的 IndexedDB 填種缺口，2.6 決定不擴充 `seedAdmin`〉一節，摘要：`page.addInitScript` 寫入 IndexedDB 的完成時機沒有保證早於頁面自身 script 讀取，會做出時序不穩定的測試；改成需要驗證縮圖的測試（AC-P1）直接走新增頁的真實 UI 流程建立資料，圖片走應用程式自己的 `saveImageBlob()`，沒有時序問題。
