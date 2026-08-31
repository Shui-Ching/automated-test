# 斷言型態範例（前端維護）

四種斷言型態，寫測試時對照下表選，不要每次都用文字比對硬套所有情境。目前只有
文字比對／存在性／數量三種在專案裡有實際用例；幾何量測待 Phase 3（前台版型
左圖右文／右圖左文）落地時，用當時的真實案例補這份文件，不要現在憑空舉例。

## 1. 文字比對

斷言元素的文字內容，用於錯誤訊息、Toast 文案、顯示值。**定位用 `data-testid`，
比對用規格寫的原文**——文案打錯字時要讓測試失敗在「文字不對」，不是「找不到
元素」。

```ts
await expect(page.getByTestId('page-list-search-date-error')).toHaveText('結束時間不可早於開始時間');
await expect(page.getByTestId('page-list-toast')).toHaveText('刪除成功');
```

## 2. 存在性 / 顯隱

斷言元素該不該出現，或該不該被隱藏。**每一條負向斷言都要配正向基準**（見
`docs/project-plan.md` 風險 R-7）：先確認頁面真的載入、同層對照元件確實可見，
再斷言目標元素不存在或被隱藏，避免「功能正確」跟「頁面根本沒載入」印出一樣
的綠燈。

```ts
// 反例基準：先確認送出前是隱藏的，才能證明後面出現的是驗證觸發的結果
await expect(page.getByTestId('page-list-search-date-error')).toBeHidden();
// ...觸發驗證...
await expect(page.getByTestId('page-list-search-date-error')).toBeVisible();
```

`<dialog>` 元素的顯隱走 `toBeVisible()` / `toBeHidden()`，不要用 `toHaveCount()`——
`page-list-delete-dialog` 不管開關都存在於 DOM（`toHaveCount(1)` 恆真，測不出開關
狀態），真正代表「有沒有跳出來」的是 `showModal()` / `close()` 切換的可見性。

## 3. 數量

斷言列表筆數、重複群組數量。**列表的列不用索引**，用 `data-page-name` 這類
穩定鍵鎖定特定一列，索引會隨資料異動錯位：

```ts
const rows = page.getByTestId('page-row');
await expect(rows).toHaveCount(1);
await expect(rows.first()).toHaveAttribute('data-page-name', '關於我們');
```

## 4. 幾何量測（待補）

前台圖文區塊的「左圖右文」／「右圖左文」要測的是圖片與文字的實際 bounding box
相對位置，不是 class 名稱存不存在——CSS 沒載入時 class 照樣在，測試照樣綠燈。
等 Phase 3 實作前台版型時，把當時真實用到的 `boundingBox()` 寫法補在這裡。
