# 頁面管理功能 — 自動化驗收試作

驗證「規格 AC → 自動化測試 → 失敗自動派工」這條流程是否可行。
不是為了做出七個畫面，而是為了回答「未來能不能不用每次人工測試各種情境」。

## 目錄職責

每個資料夾只有一個負責角色，跨角色的修改先在對應的回饋文件提出，不直接改對方的檔案。

| 資料夾 | 負責角色 | 內容 | 可否修改 |
| :--- | :--- | :--- | :--- |
| `srs/` | PM | 功能規格與非功能需求，驗收的唯一真相來源 | **唯讀**。實作端發現問題寫進 `docs/pm-feedback.md`，不直接改 |
| `app/` | 前端 | 前台與後台的實作 | 前端 |
| `tests/` | PM 端 + 前端 | 測試腳本由 PM 端撰寫；`tests/contract/` 是雙方的交接介面，由前端維護 | 見下 |
| `docs/` | 共用 | 任務計畫與規格回饋 | 共用 |
| `.github/workflows/` | 前端 | CI 設定 | 前端 |

`tests/contract/` 的分工再細一層：`testid-map.json`、`seed.md`、`assertion-types.md`、`contract-check.spec.ts` 由前端維護（它們描述的是 DOM 事實）；`ac-coverage.json` 由 PM 端維護（AC 覆蓋率與人工測試結果）。

## 為什麼沒有 skill 資料夾

個人 skill 放在 `~/.claude/skills/`，不進這個 repo。這個 repo 是 public，而 skill 屬於個人資產，只上 private repo。

## 開始

```bash
npm install
npx playwright install chromium
npm run dev      # http://localhost:5173
npm test         # 跑全部測試
npm run sass     # 監看 SCSS 編譯
```

`app/assets/css/main.css` 是編譯產物，不要手改，改樣式一律回 `app/assets/scss/`。

## 文件

- [任務計畫](docs/project-plan.md) — Phase 0～5 拆解、測試契約設計、風險清單
- [規格回饋](docs/pm-feedback.md) — 給 PM 的 11 項規格問題，依急迫性排序
