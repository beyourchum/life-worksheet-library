# 學習單處理工作流

本文件只說明執行順序與完成條件。內容判斷依 [`../rules/CONTENT_CORRECTION_RULES.md`](../rules/CONTENT_CORRECTION_RULES.md)，輸入及輸出格式依 [`../rules/FORMAT_CONTRACT.md`](../rules/FORMAT_CONTRACT.md)。

## 流程

```text
既有 source.md
  ↓
correct：Script 格式檢查 + 模型內容校正
  ↓
只確認可能改變原意的項目
  ↓
build：Script 產生 HTML
  ↓
validate：Script 驗證 + 風險分級 QA
  ↓
使用者指定 publish？──否──→ 交付
  │是
  ↓
publish：準備網站檔案 + 推送 GitHub Pages + 線上驗證
  ↓
交付
```

## 1. 準備資料

開始前依 [`../AGENTS.md`](../AGENTS.md#開始前必須確認) 取得 EP 編號。原稿、目標客群與未指定的 operation 採用該文件所列預設值，不另行詢問。

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

只有來源檔不存在或使用者要求重新匯入時才執行本階段；既有 EP 直接進入 Correct。

輸入是從 Google Docs 取得的 Markdown 或純文字原稿。執行：

```powershell
python tools/worksheet.py normalize INPUT --output content/EPxx/EPxx_source.md
```

Script 只統一換行、移除行尾空白、收斂過多空白行及補上結尾換行，不改寫文字或 Markdown 標記。需要整理 Markdown 標記時，在 Correct 階段處理 `corrected.md`。

完成條件：`source.md` 可逐段對回原稿，沒有內容增刪，並已依 [來源快照與更新規則](../rules/CONTENT_CORRECTION_RULES.md#來源快照與更新) 保存 Git 版本。

### 重新匯入既有來源

先依 [來源快照與更新規則](../rules/CONTENT_CORRECTION_RULES.md#來源快照與更新) 檢查重新匯入授權與舊版保存狀態。符合條件後，執行：

```powershell
python tools/worksheet.py normalize INPUT --output content/EPxx/EPxx_source.md --force
```

完成後進入 Correct，比對新來源與既有校正及報告。`--force` 只允許 Script 覆寫檔案，不會檢查 Git 保存狀態，也不代表重新校正或驗證已完成。

## 3. Correct

首次處理且尚無 `corrected.md` 時，先複製 `source.md` 為 `corrected.md`。已有 `corrected.md` 時，依 [逐份驗收規則](../rules/CONTENT_CORRECTION_RULES.md#ep62-參考標準與逐份驗收) 比對來源與既有校正，不重新複製覆蓋。

`correct` 是工作階段，沒有獨立的 CLI 指令。Script 使用 `lint` 回報格式問題，Codex 在 `corrected.md` 修正後重新執行 lint，再完成內容校正。

### 3.1 格式校正

執行：

```powershell
python tools/worksheet.py lint content/EPxx/EPxx_corrected.md
```

Script 回報格式契約的 `fail` 與 `warning`。可確定不影響意思的格式問題直接修正，包括標題層級、題型標記、選項標記、編號、分頁標記與自由填答標記。

`category` 須通過格式契約檢查。已發布或列入網站清單的 EP，另須與 `site/worksheets.json` 中該 EP 的 `category` 逐字一致。

### 3.2 內容校正

模型只檢查明確性、可執行性與客群適切性，不核對教材目標。依規則可直接修改的項目直接修正；可能改變題意、題型或選項內容的項目列為待確認。

校正結果寫入 `reports/EPxx/correction.json`，只記錄實際變更與待確認事項。

完成本輪來源、校正版與報告比對後，依 [校正輸出規則](../rules/CONTENT_CORRECTION_RULES.md#校正輸出) 綁定檔案版本：

```powershell
python tools/worksheet.py bind-correction reports/EPxx/correction.json --source content/EPxx/EPxx_source.md --corrected content/EPxx/EPxx_corrected.md
```

完成條件：lint 沒有 `fail`，且待確認項目已由使用者決定。

## 4. Build

輸入必須是通過 lint 的 `corrected.md`。

先檢查校正報告版本；非 `current` 時回到 Correct，不能直接補指紋沿用舊結論：

```powershell
python tools/worksheet.py check-report reports/EPxx/correction.json
```

版本一致且 Correct 完成後建置：

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

每次建置都執行 Script 驗證。瀏覽器 QA 採風險分級，不因 corrected 文字或題目內容更新而自動重做完整檢查。A4 列印由固定版型與 Script 的列印設定檢查作為驗收依據，預設視為通過，不再要求人工開啟列印預覽或另外確認。

### 視覺 QA 通知分流

低風險變更若符合沿用視覺 QA 基準的條件，直接沿用基準，不另外請使用者查看或確認；交付時僅回報已沿用基準。高風險變更才通知使用者，並請使用者查看或確認適用的瀏覽器 QA。機械驗證失敗仍須直接回報，不視為視覺 QA 通知分流的例外。

符合以下全部條件時，可沿用已確認的視覺 QA 基準：

- `templates/worksheet.html`、`templates/worksheet.css`、字型、共用視覺資產、HTML renderer、瀏覽器互動程式及列印設定未變更。
- 本份 HTML 使用既有支援的題型與最多兩頁的固定結構。
- Script 驗證通過，且沒有未解析標記、缺漏資產或其他新的 warning。
- 內容沒有異常長標題、長選項、密集題目或其他明顯可能造成溢出的版面風險。

沿用基準時，只需檢查本份內容可能受影響的區塊；沒有版面風險時，不另開瀏覽器重驗固定的互動、RWD、黑白列印與共用樣式。只修改 normalize、lint、validate、報告、指紋、診斷文字、測試或文件，不會直接改變輸出畫面；自動測試及既有輸出回歸驗證通過後，可沿用既有視覺 QA 基準。

單篇內容出現異常長標題、長選項、密集題目、分頁位置改變或新的版面 warning 時，只檢查該篇受影響的區塊；不因此重驗其他未受影響的 EP。

出現以下任一情況時，才執行完整瀏覽器 QA：

- 修改 HTML 範本、CSS、字型、共用視覺資產、HTML renderer、瀏覽器互動程式或列印設定。
- 新增或修改題型、控制項、頁面結構或共用網站介面。
- 首次建立 QA 基準，或既有基準已知失效。

共用變更觸發完整瀏覽器 QA 時，選擇能涵蓋受影響題型、兩頁結構、長內容與互動功能的代表頁面，不逐頁重驗未受影響的 EP。

完整瀏覽器 QA 檢查：

- 320 px、390 px 與桌面寬度沒有水平溢出。
- 黑白列印仍能辨認層級。
- 填答空間、標題斷行與字體顯示合理。
- 填答後重新載入仍可還原本次暫存，且清除功能可移除所有作答。

`visual_qa: passed` 表示依本節完成適用的風險分級 QA，包含本輪實際完成瀏覽器檢查，或確認本次變更不影響畫面而沿用既有視覺 QA 基準；不表示每次都重新逐頁開啟瀏覽器。A4 列印不另設人工待確認狀態。無法確認基準適用性、應做的局部檢查尚未完成，或觸發完整瀏覽器 QA 而尚未完成時，validation 報告保留 `visual_qa: pending`。

## 6. Publish

`publish` 是完整工作流中位於 Validate 之後的發布階段，但只有使用者明確指定 `publish` 或要求發布時才執行。未指定時，Validate 完成後直接進入交付，不推送遠端。

發布前，校正與驗證報告必須是目前版本，內容確認、機械檢查及適用的風險分級視覺 QA 均已完成。發布時主動從權威資料表以 EP 編號唯一配對影片連結，不要求使用者重複提供表內已有的網址；資料來源、失敗條件、Git 變更範圍、GitHub Pages 推送及線上驗證依 [`GITHUB_PUBLISHING.md`](GITHUB_PUBLISHING.md#影片連結配對規則) 執行。

完成條件：指定 EP 已更新至公開網站，GitHub Pages 部署成功，首頁、學習單及影片連結均已完成線上驗證。若部署或線上驗證失敗，保留失敗狀態並回報，不得描述為已發布。

## 7. 交付

交付前檢查校正與驗證報告版本，依 [報告版本辨識](../rules/FORMAT_CONTRACT.md#報告版本辨識) 判讀。版本過期或未確認時回到對應階段：

```powershell
python tools/worksheet.py check-report reports/EPxx/correction.json
python tools/worksheet.py check-report reports/EPxx/validation.json
```

內容變更只保存在 `corrected.md`，不回寫原生 Google Docs。若使用者明確要求例外，Google Docs 同步須視為獨立操作；完成後重新讀取受影響段落，確認文字與題型標記沒有改變。

交付時回報：

- 使用的目標客群。
- 直接修正與經確認後修正的項目。
- lint、build、validate 結果。
- 視覺 QA 是否完成。
- 是否執行 `publish`；若有，列出 GitHub Pages 部署、線上頁面及影片連結的驗證結果。
- Google Docs 是否維持未修改；若有明確要求的例外，列出同步結果。
