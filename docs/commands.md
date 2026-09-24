# 維護命令

本文件是命令用法與副作用的參考。執行環境安裝見 [README](../README.md#安裝與預覽)，任務順序與授權停止點見 [workflow](workflow.md)。命令定義位於 [package.json](../package.json) 的 `scripts`。

## 單集製作

完成內容驗收、影片核對與網頁結構後執行：

```sh
pnpm run generate -- EP71
pnpm run verify -- EP71
```

`generate` 更新該集 HTML（有結構化來源時）、全站公開目錄與 metadata，以及該集精簡字型。`verify` 只檢查現有檔案與該集瀏覽器結果，不重建來源。單集結果不等於全站驗收，也不代替代表答案試填。

共用 `worksheet.js`、字型產生器或原始字型變更時，單集產生會要求先完成全站字型重建。

## 全站交付

```sh
pnpm run generate
pnpm run build
pnpm run verify
```

依序產生衍生資料、組裝 `_site/`，再驗收現有來源與發布產物。`verify` 不代替前兩步；CI 使用相同順序。自動檢查後依 [人工驗收](quality.md#人工驗收) 與 [A4 列印](quality.md#a4-列印) 完成人工核對。提交與發布仍受 [發布驗證](workflow.md#關卡-6發布驗證) 的授權限制。

## 個別入口

| 命令 | 輸入或前置條件 | 寫入與檢查範圍 |
| --- | --- | --- |
| `pnpm run html:worksheet -- EP71` | 該集結構化來源、索引與版式設定 | 產生該集 HTML |
| `pnpm run html:check` | 已有結構化來源及 HTML | 檢查所有已遷移頁面是否過期，不寫入 |
| `pnpm run data` | 維護索引、分類與搜尋設定 | 更新公開目錄、搜尋索引與 metadata |
| `pnpm run fonts` | HTML、共用字型輸入與原始字型 | 重建全站精簡字型及 manifest |
| `pnpm run fonts:worksheet -- EP71` | 共用字型輸入未變 | 只重建該集精簡字型 |
| `pnpm run check:static` | 已產生衍生資料 | 執行規則測試、來源與衍生資料檢查，不建置 |
| `pnpm run check:worksheet -- EP71` | 該集既有檔案 | 單集靜態檢查，不產生資料 |
| `pnpm run check:worksheet:browser -- EP71` | 該集既有檔案與瀏覽器 | 單集瀏覽器檢查與報告 |
| `pnpm run build` | 完成產生的網站檔案 | 重建 `_site/`，不執行驗收 |
| `pnpm run check:browser` | 已完成 `build` | 驗收 `_site/`，輸出報告、截圖與 PDF |

`pnpm test` 是全站 `verify` 的相容別名；`pnpm check` 是 `check:static` 的相容別名。

只診斷來源頁面時可執行 `node scripts/check/browser.cjs --source`，其結果不能代替發布產物驗收。檢查報告位置與保存方式見 [artifacts](artifacts.md)。

## 預覽發布產物

完成 `build` 後，在專案根目錄執行：

```sh
python -m http.server 8000 --directory _site
```

開啟 `http://localhost:8000`。預覽伺服器只提供瀏覽，不會自動產生或重建；修改來源後須重跑受影響的產生與建置步驟。
