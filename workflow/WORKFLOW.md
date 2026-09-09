# 學習單處理工作流

本文件只說明執行順序與完成條件。內容判斷依 [`../rules/CONTENT_CORRECTION_RULES.md`](../rules/CONTENT_CORRECTION_RULES.md)，輸入及輸出格式依 [`../rules/FORMAT_CONTRACT.md`](../rules/FORMAT_CONTRACT.md)。

## 流程

```text
Google Docs 初稿
  ↓
normalize
  ↓
correct：Script 格式檢查 + 模型內容校正
  ↓
只確認可能改變原意的項目
  ↓
build：Script 產生 HTML
  ↓
validate：Script 驗證 + 最小視覺 QA
```

## 1. 準備資料

開始前取得 EP 編號、原稿、目標客群與特殊輸出限制。不需要資料庫中的情境問題或引導目標。

每份學習單使用：

```text
content/EPxx/EPxx_source.md
content/EPxx/EPxx_corrected.md
output/EPxx/EPxx.html
reports/EPxx/correction.json
reports/EPxx/validation.json
```

沒有實際產物時不要建立空白檔案。

## 2. Normalize

輸入是從 Google Docs 取得的 Markdown 或純文字原稿。執行：

```powershell
python tools/worksheet.py normalize INPUT --output content/EPxx/EPxx_source.md
```

Script 只統一換行、移除行尾空白、收斂過多空白行及補上結尾換行，不改寫文字。若來源不是可解析的 Markdown，先由 Codex 依格式契約整理標記，再執行 lint。

完成條件：`source.md` 可逐段對回原稿，沒有內容增刪。

## 3. Correct

先複製 `source.md` 為 `corrected.md`，再依下列順序處理。

### 3.1 格式校正

執行：

```powershell
python tools/worksheet.py lint content/EPxx/EPxx_corrected.md
```

Script 回報格式契約的 `fail` 與 `warning`。可確定不影響意思的格式問題直接修正，包括標題層級、題型標記、選項標記、編號、分頁標記與自由填答標記。

### 3.2 內容校正

模型只檢查明確性、可執行性與客群適切性，不核對教材目標。依規則可直接修改的項目直接修正；可能改變題意、題型或選項內容的項目列為待確認。

校正結果寫入 `reports/EPxx/correction.json`，只記錄實際變更與待確認事項。

完成條件：lint 沒有 `fail`，且待確認項目已由使用者決定。

## 4. Build

輸入必須是通過 lint 的 `corrected.md`。執行：

```powershell
python tools/worksheet.py build content/EPxx/EPxx_corrected.md --output output/EPxx/EPxx.html
```

Script 讀取固定 Markdown 題型、套用唯一的 `templates/worksheet.html` 與 `templates/worksheet.css` 核准版型，直接產生 HTML。HTML 與任何內部結構資料都不由模型撰寫；frontmatter 不完整或仍含舊樣式欄位時，lint 必須停止建置，不得改套其他樣式。

若 lint 有 `fail`，build 必須停止並指出檔案、問題與修正方式。

完成條件：HTML 已產生，且輸出沒有外部網路資產或未解析的模板標記。

## 5. Validate

執行：

```powershell
python tools/worksheet.py validate output/EPxx/EPxx.html --report reports/EPxx/validation.json
```

Script 檢查：

- 文件語言、viewport、標題與頁面容器。
- checkbox、radio、短答與長答控制項。
- `sessionStorage` 與清除暫存所需的程式標記。
- A4 列印設定、列印時隱藏工具列及頁面分隔。
- 外部網路資產、本機資產是否缺漏及未解析模板標記。

最小瀏覽器 QA 檢查：

- 320 px、390 px 與桌面寬度沒有水平溢出。
- A4 列印預覽沒有內容被截斷，頁數符合需求。
- 黑白列印仍能辨認層級。
- 填答空間、標題斷行與字體顯示合理。
- 填答後重新載入仍可還原本次暫存，且清除功能可移除所有作答。

Script 無法證明實際互動與版面品質，因此瀏覽器與列印 QA 尚未全部完成時，validation 報告必須保留 `visual_qa: pending`。

## 6. 同步與交付

內容校正完成後，依使用者要求同步回原生 Google Docs。同步後重新讀取受影響段落，確認文字與題型標記沒有改變。

交付時回報：

- 使用的目標客群。
- 直接修正與經確認後修正的項目。
- lint、build、validate 結果。
- 視覺 QA 是否完成。
- 是否已同步 Google Docs。
