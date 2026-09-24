# 儲存庫結構

本文件定義檔案責任、版本控制與發布邊界。操作順序見 [workflow](workflow.md)，可執行入口見 [commands](commands.md)，驗收標準見 [quality](quality.md)。

## 依工作選擇入口

| 要修改的項目 | 唯一編輯入口 | 後續產物 |
| --- | --- | --- |
| 題目、說明、範例與作答規則 | `content/EP編號/EP編號_corrected.md` | 人工核對後同步網頁結構來源 |
| 集數、摘要、分類歸屬、搜尋詞與影片網址 | `catalog/worksheets.json` | `data/`、各集 `metadata.json`；影片改動也影響 HTML |
| 分類名稱與順序 | `catalog/categories.json` | 公開目錄與搜尋索引 |
| 頁面結構與欄位 | `worksheet-sources/EP編號.json` | `worksheets/EP編號/index.html` |
| 首頁、搜尋與共用呈現／互動 | `index.html`、`assets/site.*`、`assets/search-core.js`、`assets/worksheet.*`、`assets/worksheet-components.*` | 建置時複製至發布目錄 |
| 品質數值 | `config/quality-policy.json` | 由檢查器讀取，不另存副本 |
| 具名版式變體 | `config/worksheet-layouts.json` 與 `assets/worksheet.css` | 頁面以 `layoutVariants` 選用 |

原稿保存、缺檔查找與同步責任見 [內容來源與同步](workflow.md#內容來源與同步)。既有未建立結構化來源的頁面保留原路徑，實際修改時逐篇遷移；不得把整批搬遷當成內容驗收。

## 目錄與邊界

```text
content/                 本機原稿、修訂稿與內容驗收註記
catalog/                 維護用索引來源
worksheet-sources/       已遷移頁面的網頁結構來源
config/                  品質政策、例外、搜尋設定、版式與來源範本
assets/                  網站共用程式、樣式、字型來源及精簡字型
worksheets/EP編號/       穩定的公開頁面路徑與 metadata
data/                    產生後的公開目錄與搜尋索引
scripts/
  generate/              HTML、公開資料與字型產生工具
  build/                 發布目錄組裝
  check/                 靜態、單集、瀏覽器驗收入口及 rules/
tests/
  unit/                  產生器與規則的純程式測試
  browser/               需要瀏覽器的版面與互動測試
docs/                    流程、品質、目錄、命令與產物管理
.github/workflows/       CI 驗收與部署
.qa/                     本機報告、工作檔、備份與額外依賴
_site/                   可重建的發布目錄
```

`worksheet-sources/` 在第一份正式結構來源建立時出現；格式起點為 [worksheet-web-source.example.json](../config/worksheet-web-source.example.json)，解析與產生行為由 [worksheet-html.cjs](../scripts/generate/worksheet-html.cjs) 定義。

| 類別 | 納入 Git | 發布 |
| --- | --- | --- |
| `content/`、`.qa/` | 否 | 否 |
| `catalog/`、`worksheet-sources/`、`config/` | 是 | 否 |
| `scripts/`、`tests/`、`docs/`、維護規則 | 是 | 否 |
| 公開 HTML、`data/`、metadata、共用 CSS／JS、精簡字型 | 是 | 是 |
| 原始字型與授權 | 是 | 否；保留供重建使用 |
| `_site/`、`node_modules/` | 否 | `_site/` 是部署輸入；依賴不發布 |

實際發布檔案由 [site.cjs](../scripts/build/site.cjs) 的複製清單決定。網站 URL 與維護目錄分開管理；整理工具或文件不改變 `worksheets/EP編號/` 的網址。

## 工具與測試依賴

`package.json` 是命令入口；產生工具寫入衍生資料，建置工具組裝 `_site/`，驗收工具檢查現有結果並寫入報告。檢查器可以共用 `scripts/check/rules/`，不能靠重建待驗收資料消除過期問題。

純程式測試放在 `tests/unit/`，由 `check:static` 載入；瀏覽器測試放在 `tests/browser/`，由 `check:browser` 傳入瀏覽器頁面與測試伺服器。新增測試須接入對應驗收入口，不能只新增檔案而未執行。測試案例與驗收工具分開存放，品質數值仍只讀取政策檔。

## 文件責任

| 文件 | 負責回答 |
| --- | --- |
| [README](../README.md) | 專案用途、安裝與從哪裡開始 |
| [AGENTS](../AGENTS.md) | 硬性限制、授權停止點與回報格式 |
| [workflow](workflow.md) | 依任務從哪個關卡開始、交付什麼、何時重驗 |
| [quality](quality.md) | 內容與技術成果如何判定通過 |
| [repository](repository.md) | 檔案放哪裡、誰可修改、是否發布 |
| [commands](commands.md) | 各命令的輸入、寫入範圍與執行順序 |
| [artifacts](artifacts.md) | 報告、過程檔、備份與清理方式 |

規則只在負責文件維護，其他文件連到對應章節。搬動檔案時同步檢查程式引用、命令入口、CI 與文件連結。
