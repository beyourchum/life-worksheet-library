# 生活解題設計｜碩說說

靜態內容索引與學習單網站，提供文章、影片及可填寫、列印的學習單。首頁分頁顯示精簡目錄，只有搜尋時才載入完整搜尋索引；文章全文與學習單資料在開啟個別頁面後載入。

## 專案入口

依任務選擇文件，不需要每次重讀所有規則：

| 工作 | 入口 |
| --- | --- |
| 製作內容、轉換 HTML、驗收或發布 | [工作流程](docs/workflow.md#依任務進入流程) |
| 找到應修改的來源與目錄 | [儲存庫結構](docs/repository.md) |
| 執行產生、建置、檢查或預覽 | [維護命令](docs/commands.md) |
| 判斷內容與技術品質 | [品質規則](docs/quality.md) |
| 保存報告、備份與清理工作檔 | [產物與清理](docs/artifacts.md) |
| 確認授權停止點與回報要求 | [維護規則](AGENTS.md) |

## 安裝與預覽

需要 Node.js 22、Python 3.12，以及 `package.json` 指定版本的 pnpm。

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
python -m pip install -r scripts/generate/font-requirements.txt
python -m http.server 8000
```

開啟 `http://localhost:8000`。不要直接雙擊 HTML，否則瀏覽器無法可靠讀取 JSON。Linux 如需安裝瀏覽器系統依賴，使用 `pnpm exec playwright install --with-deps chromium`，並準備繁體中文系統字型供字型載入失敗測試使用。Windows 已安裝 Edge 時，可設定 `BROWSER_CHANNEL=msedge`；未設定則使用 Playwright Chromium。

## 檢查與發布

全站交付依序執行：

```sh
pnpm run generate
pnpm run build
pnpm run verify
```

單集入口、命令副作用及發布產物預覽見 [維護命令](docs/commands.md)。提交、推送、部署與線上抽查依 [發布驗證](docs/workflow.md#關卡-6發布驗證) 執行。

## 作答保存

作答依集數保存在瀏覽器 `sessionStorage`，不會上傳。重新整理可還原目前分頁的暫存；關閉分頁前應列印或另存 PDF。網站不會自動改寫讀者答案。

## 產物與清理

報告、工作檔、備份、額外依賴與稿件版本依 [產物管理規則](docs/artifacts.md) 保存及清理。
