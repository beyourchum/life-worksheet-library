# 生活解題設計｜碩說說

靜態內容索引，提供文章、影片與可填寫、列印的學習單。首頁以分頁瀏覽與全庫搜尋支援約 150 篇內容；文章全文在讀者開啟個別頁面時才載入。

## 檔案分工

| 位置 | 責任 |
| --- | --- |
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

## 新增內容

1. 建立 `worksheets/EP編號/index.html` 或 `articles/` 下的文章頁面。複製學習單時保留工具列與共用程式，更新集數、標題、分類、題目、頁尾及分頁。
2. 在 `worksheets.json` 登錄內容。`ep`、`title`、`summary`、`category`、`searchTerms` 為必要欄位；分類來自 `categories.json`，搜尋詞種類以 `search-config.json` 為準。
3. 提供 `worksheetUrl` 或 `articleUrl`，也可同時提供。學習單路徑固定為 `worksheets/EP編號/`；文章使用站內相對路徑。`videoUrl` 可省略。文章全文不要放入索引資料。
4. 學習單每個作答欄位應有唯一且穩定的 `id`，標籤 `for` 指向該欄位。除非題意改變，否則不要更換既有欄位 ID。
5. 依下節執行產生、驗證及建置，再查看 PDF 與首頁截圖。字型重建會略過來源未變動的頁面，新增一篇不必重做全站字型。

文字與版面品質規則詳見 [docs/quality.md](docs/quality.md)。不要用刪減題目、隱藏溢出、任意提高預算或新增無理由例外來通過檢查。

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
