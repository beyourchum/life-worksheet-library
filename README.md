# 生活解題設計｜碩說說

靜態內容索引，提供文章、影片與可填寫、列印的學習單。首頁以分頁瀏覽與全庫搜尋支援約 150 篇內容；文章全文在讀者開啟個別頁面時才載入。

## 檔案分工

| 位置 | 責任 |
| --- | --- |
| `content/EP編號.md` | 各集內容定稿來源，檔首保留 Google Docs 來源連結 |
| `worksheets.json` | 集數、標題、摘要、分類、搜尋詞與內容連結的唯一來源 |
| `categories.json` | 分類名稱與排列順序 |
| `quality-policy.json` | 分頁大小、流量預算、列印門檻與字型例外 |
| `index.html`、`assets/site.css`、`assets/site.js` | 首頁呈現與互動 |
| `assets/search-core.js`、`search-config.json` | 搜尋比對與權重 |
| `worksheets/EP編號/index.html` | 各集題目與作答欄位 |
| `articles/` | 文章完整內容，可依需要新增 |
| `assets/worksheet.css`、`assets/worksheet.js` | 學習單共用版型與功能 |
| `assets/fonts/worksheet/compact/` | 依頁面產生的字型與驗證紀錄 |
| `data/`、各集 `metadata.json` | 產生程式輸出的公開資料，不手動編輯 |
| `scripts/` | 資料／字型產生、驗證與建置程式 |
| [docs/quality.md](docs/quality.md) | 品質規則、檢查內容與失敗修正方式 |

## 安裝與預覽

需要 Node.js 22、Python 3.12 及 `package.json` 指定版本的 pnpm。

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
python -m pip install -r scripts/font-requirements.txt
python -m http.server 8000
```

開啟 `http://localhost:8000`。直接雙擊 HTML 無法可靠地讀取 JSON。Linux 可使用 `pnpm exec playwright install --with-deps chromium` 安裝瀏覽器依賴，並安裝繁體中文系統字型供載入失敗情境使用。

## 內容製作流程

1. **轉換與核對**：將 Google Docs 轉成 `content/EP編號.md`，在檔首保留來源連結，對照原稿核對標題、題目、表格、連結及必要說明，確認沒有遺漏或改變原意。
2. **編輯 MD**：依序檢查原意與結構、理解與可行性、文字整理。每題以一個主要動作為原則，交代要做什麼、寫多少、完成條件；必要時提供範例或起手句。確認讀者有足夠資訊，且能在預定時間完成。
3. **定稿與索引**：在 `worksheets.json` 登錄 `ep`、`title`、`summary`、`category`、`searchTerms`；分類來自 `categories.json`，搜尋詞種類以 `search-config.json` 為準，涵蓋讀者的生活用語。提供 `worksheetUrl` 或 `articleUrl`，也可同時提供；`videoUrl` 可省略。文章全文不要放入索引。
4. **製作 HTML**：建立 `worksheets/EP編號/index.html` 或 `articles/` 下的文章頁面，與 MD 定稿逐段核對。學習單保留共用工具列與程式，更新集數、標題、分類、題目、頁尾及分頁，處理手機呈現與 A4 作答空間。每個作答欄位有唯一且穩定的 `id`，標籤 `for` 指向該欄位；除非欄位意義改變，不更換既有 ID。學習單網址固定為 `worksheets/EP編號/`，文章使用站內相對路徑。
5. **驗證與修正**：依「檢查與發布」執行產生、完整測試及人工驗收，試填並以生活問句試搜，確認能找到預期內容。文字與版面驗收依 [品質規則](docs/quality.md) 執行。
6. **發布**：在使用者授權範圍內提交與推送，確認部署成功；本機測試通過不代表已發布。
7. **線上抽查**：確認正式網站已更新，檢查新頁面、搜尋、連結、作答暫存與列印，分別回報本機驗證及線上抽查結果。

### 內容來源與同步

MD 是內容定稿來源，HTML 負責網頁版型與互動。文字修改先改 MD，再同步 HTML；HTML 製作期間發現題意需要調整，也要回寫 MD。目前轉換與同步由編輯者執行，沒有自動 MD → HTML 產生程序。

既有內容若尚無 MD，在下次編輯該集時從原始 Google Docs 建立並核對；來源未取得前不以 HTML 反推冒充原稿，也不將該集標示為已完成 MD 同步。新增 MD 的檔首格式如下，後面接定稿正文：

```md
# 內容標題

來源：[Google Docs 原稿](實際來源網址)
```

標題須與索引及 HTML 同步；摘要、分類與搜尋詞只在 `worksheets.json` 維護，不在 MD 建立第二份索引。版本交由 Git 保存，不另建「最終版」等副本。若同集含文章與學習單，在同一份 MD 使用清楚的段落標題區分。

### 固定回報格式

每完成一個主要階段使用以下格式回報；執行較久時提供簡短進度。只列本次變更，不為每次回報新增檔案。

- **目前進度**：內容名稱｜第幾步／7｜進行中、待確認或完成。
- **這次完成**：主要變更、原因及成品連結。
- **檢查結果**：分別列出內容完整性、理解與可行性、索引與搜尋、網頁與列印的結果；使用「通過／有問題／尚未檢查／不適用」。有問題時說明位置、影響與處理方式。發布後另列線上抽查結果。
- **需要你確認**：只列需要使用者判斷的具體事項及建議，沒有就寫「無」。
- **下一步**：下一項工作，以及是否需要等待確認。

只有需要使用者判斷或尚未授權的動作才等待確認；已授權的轉換、同步、測試與修正持續執行。完成發布時附正式網站及可用的 MD、HTML 連結。

## 檢查與發布

```sh
pnpm generate
pnpm test
```

- `generate` 更新精簡目錄、搜尋索引、各集影片資料及字型。產出檔應與來源一併提交。
- `test` 先做靜態檢查並建置 `_site/`，再以這份發布產出實際開啟瀏覽器，驗證缺字、列印、流量、容量與互動。只有 `pnpm check` 通過，仍不代表列印正常。
- `pnpm build` 可單獨驗證並重建 `_site/`，但不執行瀏覽器測試。該資料夾是產生結果，不要存放人工文件。

檢查報告、首頁截圖及每集 PDF 位於 `.qa/reports/`。版型或分頁調整後必須查看 PDF；自動檢查無法代替所有視覺判斷。

Pull request 與 `main` 推送都會執行相同測試；只有主分支通過後才部署 GitHub Pages。原始大型字型、完整維護索引、腳本與文件不會發布。GitHub Actions 保留檢查報告供追查失敗原因。

已安裝 Edge 的 Windows 環境可設定 `BROWSER_CHANNEL=msedge` 執行測試；預設使用 Playwright 的 Chromium。

## 作答保存

作答使用 `sessionStorage`，按集數隔離，沒有上傳功能。重新整理可還原本次分頁暫存；關閉前應列印或另存 PDF。網站不會自動修改讀者的作答用詞。

## 產物與清理

`_site/` 是可重建的發布產物；`.qa/reports/` 保留最近一次完整驗收報告、PDF 與截圖。臨時除錯資料放在 `.qa/`，完成排查後清理，不另用 `output/` 保存重複預覽。備份只有在確認內容已由 Git 或其他保留來源保存後才能移除。

`data/`、各集 `metadata.json` 與精簡字型由產生程式更新並隨來源提交。原始字型、授權檔與執行所需的相依套件應保留。
