# 專案協作指引

## 專案邊界

本專案處理已完成初稿的學生版學習單。工作範圍是格式校正、簡易內容校正、HTML 建置與驗證；不重新設計教材，不核對 Google Sheets 的情境問題或引導目標。

輔導員觀察、假設、追問與支持策略必須另存，不得混入學生版 Markdown 或 HTML。

## 開始前必須確認

每次工作先取得：

1. EP 編號或學習單識別碼。
2. 本輪 operation：`normalize`、`correct`、`build`、`validate` 或 `publish`；未指定時，既有 EP 預設依序完成 `correct`、`build` 與 `validate`。
3. 特殊輸出限制；未提供時採用格式契約的預設值。

原稿已預先提取為 `content/EPxx/EPxx_source.md`，依 EP 編號直接讀取，不逐份要求 Google Docs 或匯出檔。只有來源檔不存在或使用者要求重新匯入時，才詢問新的原稿來源並執行 `normalize`。

目標客群預設為「台灣大專生與初入職場者」，不逐份詢問；只有使用者明確指定例外時才調整。不要要求資料庫列號，也不要以資料庫目標評估內容。

GitHub Pages 發布是完整工作流的 `publish` 階段，但不包含在未指定 operation 的預設執行範圍。只有使用者明確指定 `publish` 或要求發布時，才能依 `workflow/GITHUB_PUBLISHING.md` 執行；發布學習單時，必須主動依該文件的「影片連結配對規則」從權威資料表查找、確認並更新該 EP 的影片連結，不要求使用者重複提供表內已有的網址。

## 來源與產物

- Google Docs 只作原始內容來源，預設不修改或回寫。
- `content/EPxx/EPxx_source.md` 是不改寫語意的標準化快照。
- `content/EPxx/EPxx_corrected.md` 是內容修改位置與 HTML 建置輸入。
- `output/EPxx/EPxx.html` 由 Script 產生，不直接人工修改。
- `reports/EPxx/` 保存校正與驗證結果；`correction.json` 只記錄實際差異與待確認事項，`validation.json` 依格式契約記錄機械檢查、視覺 QA 與檔案指紋。
- `golden/` 保存歷史視覺參考；目前用途依各參考的 README，不作為新學習單的建置來源。
- PDF 不是母稿。需要紙本時由 HTML 使用瀏覽器列印。

詳細格式以 [`rules/FORMAT_CONTRACT.md`](rules/FORMAT_CONTRACT.md) 為唯一依據；內容校正以 [`rules/CONTENT_CORRECTION_RULES.md`](rules/CONTENT_CORRECTION_RULES.md) 為唯一依據。

## Operation 邊界

- `normalize`：統一換行、移除行尾空白、收斂過多空白行並補上結尾換行，不改寫內容或 Markdown 標記。
- `correct`：先由 Script 檢查格式、模型依結果修正，再由模型檢查明確性、可執行性與客群適切性。
- `build`：Script 從通過 lint 的 corrected Markdown 直接產生 HTML；模型不撰寫 HTML。
- `validate`：每次由 Script 檢查結構、必要互動程式標記、本機資產與列印設定；QA 依 `workflow/WORKFLOW.md` 採風險分級，不影響畫面的變更可沿用既有視覺 QA 基準，只有可能改變版面或互動時才執行適用的瀏覽器檢查。A4 列印預設依固定版型與 Script 檢查判定通過，不另詢問。
- `publish`：只處理已完成校正、建置與驗證的指定 EP；依 `workflow/GITHUB_PUBLISHING.md` 更新 `site/`、影片連結、推送 GitHub Pages 並完成線上驗證。

可以直接修正錯字、標點、編號、固定標記與不改變意思的語序。新增或刪除題目、改變題型、增刪選項或改變原意時，先向使用者確認。

## 修改原則

- 每份教材只保留 `source.md` 與 `corrected.md` 兩份內容檔。
- 不要求模型產生或人工維護視覺 JSON。
- 詳細共通規格只寫在 `rules/`；其他文件僅保留自身操作所需的摘要，並連結至權威規則，不另行維護完整規則副本。
- 更改格式契約時，同步更新 parser、lint、HTML 範本與測試案例。
- 保留使用者既有內容與無關變更。

## 完成回報

回報 operation、變更檔案、Script 檢查結果、待人工確認項目、風險分級 QA 結果，以及是否執行 `publish`。若執行發布，另外回報影片連結是否同步更新與驗證結果。Google Docs 預設不修改；只有使用者明確要求例外且已執行時，才另外回報 Google Docs 變更。應做的局部或完整 QA 未完成時，不得描述為可正式發布。

每完成一個 operation 階段，必須主動提醒使用者目前有未提交的 Git 修改，並詢問是否要 commit。至少在 `correct`、`build`、`validate` 與 `publish` 完成後提醒；未經使用者明確要求，不得自行 commit。
