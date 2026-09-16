# 學習單校正與 HTML 建置

本專案把已完成初稿的 Google Docs 學習單轉成 Markdown，完成格式與簡易內容校正，再由 Script 產生可數位填寫及列印的 HTML；使用者明確指定發布時，完整流程會接續更新並驗證 GitHub Pages。

## 使用入口

- 執行流程：[`workflow/WORKFLOW.md`](workflow/WORKFLOW.md)
- GitHub 網站發布：[`workflow/GITHUB_PUBLISHING.md`](workflow/GITHUB_PUBLISHING.md)
- 內容校正：[`rules/CONTENT_CORRECTION_RULES.md`](rules/CONTENT_CORRECTION_RULES.md)
- Markdown 與 HTML 格式：[`rules/FORMAT_CONTRACT.md`](rules/FORMAT_CONTRACT.md)
- Codex 操作邊界：[`AGENTS.md`](AGENTS.md)
- 唯一核准版型：[`templates/worksheet.html`](templates/worksheet.html) 與 [`templates/worksheet.css`](templates/worksheet.css)

## 主要資料夾

```text
content/EPxx/       原稿快照與校正版 Markdown
output/EPxx/        Script 產生的 HTML 與本機資產
reports/EPxx/       校正與驗證結果
rules/              內容規則與格式契約
templates/          共用 HTML/CSS 範本
assets/             建置使用的共用本機資產
tools/              學習單處理與報告版本檢查工具
golden/             歷史視覺參考
workflow/           執行順序與完成條件
docs/decisions/     穩定的設計決策
site/               GitHub Pages 公開網站來源
tests/              建置工具與網站自動測試
tmp/                本機試建置時使用；不作為正式交付來源
```

Google Sheets「煩惱影片查找系統－資料庫」仍可作搜尋索引，但不是內容校正的輸入。

## 指令

需要可執行的 Python 3；Script 只使用 Python 標準函式庫。Windows 若使用 Python Launcher，可將下列 `python` 改為 `py -3`。

執行前以 `python --version` 或 `py -3 --version` 確認可用。若兩者都無法執行，先取得可用的 Python 3 執行檔路徑；PowerShell 使用 `& '完整的 Python 執行檔路徑'` 取代指令中的 `python`。不要把特定電腦的執行檔路徑寫入共用 Script。

```powershell
python tools/worksheet.py lint content/EP62/EP62_corrected.md
python tools/worksheet.py build content/EP62/EP62_corrected.md --output tmp/EP62.html
python tools/worksheet.py validate tmp/EP62.html
```

上述指令用於本機試建置。完整處理與報告版本檢查依 [工作流](workflow/WORKFLOW.md)，交付檔案依 [輸出說明](output/README.md)。可用子指令以 `python tools/worksheet.py --help` 查閱。

所有學習單一律使用共用的核准版型與 `assets/fonts/worksheet/` 內的本機字型；`golden/EP62/` 只保存歷史參考，不作為新檔案的建置來源。輸出由 Script 建置到 `output/EPxx/`。
