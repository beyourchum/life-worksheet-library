# EP62 Golden Example

`EP62_complete.html` 是 EP62 修改前的歷史視覺參考，包含兩頁 A4、手機適配、互動填寫與分頁期間暫存。它不是目前核准版型，不得用來建立新的學習單。

## 使用方式

在專案內直接開啟 `EP62_complete.html`；檔案使用 `assets/fonts/worksheet/` 的共用本機字型。若單獨移出此歷史參考，裝置可能退回系統字體。

## 產物角色

- 這份檔案只用於追溯修改前的版面。
- 新檔案只由共用 `worksheet.py` 套用 `templates/worksheet.html` 與 `templates/worksheet.css` 建置。
- 內容修訂仍回到 Google Docs 與核准的學生版 Markdown，不直接把此 HTML 當母稿。

`tools/localize_ep62_fonts.py` 是當時建立本機字體子集的輔助工具，會使用網路下載缺少的字體資產；只有在明確需要重新產生字體子集時才執行。正式建置使用的既有資產位於 `assets/fonts/worksheet/`。

對外發布前，須確認 `assets/fonts/worksheet/` 內實際使用字體的授權文件與發布條件完整；現有資產未被視為已完成授權審查。
