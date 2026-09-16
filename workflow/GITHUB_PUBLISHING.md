# GitHub 網站發布流程

本文件說明完整工作流中 `publish` 階段的執行方式。內容處理與驗收依 [`WORKFLOW.md`](WORKFLOW.md)；只有使用者明確指定 `publish` 或要求發布時才執行本階段。

## 發布入口

使用者以「發布 EPxx」明確指定本次發布範圍。每次以一個或一組列明的 EP 為單位，不把工作目錄中的其他變更一併發布。

公開網站來源位於 `site/`。發布時將這個目錄獨立轉成 GitHub 遠端 `main` 分支的根目錄；開發專案的其他目錄不會出現在公開網站分支。

影片連結的權威來源是 Google Sheets「[煩惱影片查找系統－資料庫](https://docs.google.com/spreadsheets/d/1H8BpNhd5LytJfUue3AnFXwe2fujVZWEPdFFlr8oXP34/edit?gid=0#gid=0)」的 `工作表1`。發布指定 EP 時，主動查詢此表，不要求使用者另外提供已存在於表內的影片網址，也不修改試算表。

### 影片連結配對規則

1. 讀取 `工作表1` 的 A 欄 `EP` 與 D 欄 `影片標題(影片連結)`；網址取自 D 欄儲存格的超連結目標，不以匯出 CSV 後只剩下的顯示文字代替。
2. 將指定的 `EPxx` 與 A 欄值都正規化為去除 `EP` 前綴及前導零的整數後配對，例如 `EP01` 對應 `01`、`EP117` 對應 `117`。EP 編號是唯一配對鍵，不以標題或關鍵字猜測。
3. 必須只得到一列，且 D 欄含有效的公開 `https://` 影片網址。找不到、找到多列、超連結缺漏或網址不是公開影片時，停止發布並回報資料表中的實際狀態；不得沿用未經本輪確認的舊 `videoUrl`，也不得改用標題近似配對。
4. 以資料表取得的網址比對 `site/worksheets.json` 同一 EP 的 `videoUrl`。不同時只更新該欄；相同時不製造無效差異。D 欄顯示的影片標題可用來交叉檢查 EP，但不取代 EP 唯一配對。
5. 更新後確認 `videoUrl` 可開啟，且目的頁是資料表該列所指的影片，再繼續發布前測試。

## 1. 發布前檢查

每個指定 EP 必須符合以下條件：

- 校正報告與驗證報告皆為目前檔案版本。
- lint、build 與機械驗證通過。
- 已依 [`WORKFLOW.md`](WORKFLOW.md#5-validate) 完成適用的風險分級瀏覽器 QA；沒有待處理的 `visual_qa: pending` 或 `failed`。A4 列印沿用固定版型與 Script 檢查結果，預設通過。
- 沒有待使用者確認的內容變更。
- 已依「影片連結配對規則」從權威資料表取得並確認該 EP 的公開影片網址。
- corrected Markdown 的 `category` 與 `site/worksheets.json` 該 EP 的 `category` 完全一致，且建置後每頁頁首均顯示此固定分類名稱。
- 首頁 Index 符合 [`FORMAT_CONTRACT.md` 的分類顯示規則](../rules/FORMAT_CONTRACT.md#公開網站-index-的分類顯示)，且網站自動測試通過。

若任一條件未完成，停止發布並回報缺少的項目；不要以發布操作取代校正或驗證。

## 2. 準備公開網站檔案

將指定 EP 已驗證的建置結果更新至：

```text
site/worksheets/EPxx/index.html
site/assets/fonts/worksheet/
```

新增學習單或首頁資訊需要變更時，同步更新 `site/worksheets.json`。發布學習單時，依本文件的「影片連結配對規則」主動查詢並比對該 EP 的 `videoUrl`：若影片連結新增或變更，更新同一個 EP 項目的 `videoUrl`；若資料表尚未提供可確認的影片，停止發布並回報，不以空白或未確認的網址代替。既有 EP 只更新對應項目，不重排或改寫其他項目。只有本次明確包含網站介面調整時，才修改 `site/index.html` 或 `site/assets/`。

新增 EP 或修改既有 EP 的標題、摘要、核心問題或 Index 搜尋資料時，發布前依 [`FORMAT_CONTRACT.md` 的搜尋資料規則](../rules/FORMAT_CONTRACT.md#公開網站-index-的搜尋資料) 更新該 EP 的 `searchTerms`。搜尋詞從最終 `corrected.md`、標題、摘要與學習單內容整理，不讀取或核對資料庫的情境問題與引導目標。一般搜尋詞可直接更新並在完成回報列出；若同一使用者問題可能明確指向多篇內容、需要決定第一名，或搜尋詞超出影片實際處理範圍，先列為待確認。

每個受影響 EP 至少新增或更新兩個排名案例，涵蓋簡短查詢及自然語句。所有案例必須使用正式搜尋演算法通過後才能推送。只修改影片網址、學習單 HTML 或不影響 Index 內容的資產時，不必重寫既有搜尋詞或案例。

準備完成後，對 `site/worksheets/EPxx/index.html` 執行機械驗證，並比對每頁頁首分類與 `site/worksheets.json`。所有 EP 共用 `site/assets/fonts/worksheet/`，學習單頁面引用 `../../assets/fonts/worksheet/`，不得在各 EP 目錄重複複製字型。若只是把已驗證的 HTML 與未變更的資產複製到既有路徑，不重做完整瀏覽器 QA，也不重驗其他未受影響的 EP；只確認首頁資料指向正確 EP、檔案存在且相對資產可解析。只有網站介面、路徑、共用視覺資產、版型、renderer 或瀏覽器互動有變更時，才依工作流的觸發條件執行完整瀏覽器 QA。

發布前執行全套自動測試；Index 分類及搜尋資料契約與正式演算法排名案例由 `tests/test_site.py` 檢查，不以人工逐筆確認取代。測試環境必須提供 Node.js，供 Python 測試呼叫瀏覽器共用的搜尋模組。

```powershell
python -m unittest discover -s tests -p "test*.py"
```

## 3. 限定 Git 變更

發布前檢視 Git 差異，只納入：

- 本次指定的 `site/worksheets/EPxx/`。
- 本次需要的 `site/worksheets.json` 項目，包含該 EP 的影片連結更新。
- 使用者明確要求的共用網站檔案。

不得使用涵蓋整個工作目錄的加入方式。內容 Markdown、報告、工具與模板可依其開發需要另行提交，但不因網站發布而自動納入。

提交訊息須指出實際發布內容，例如：

```text
Publish EP117 worksheet
```

## 4. 建立並推送公開分支

推送前先取得遠端最新狀態，確認本次 `site/` 歷史可接續 `origin/main`。接著以 Git subtree 將 `site/` 獨立成暫時發布分支，再將該分支推送到 `origin/main`。

```powershell
git fetch origin main
git subtree split --prefix site -b publish-EPxx-YYYYMMDD-HHMM
git push origin publish-EPxx-YYYYMMDD-HHMM:main
```

若遠端已有新提交或推送不是 fast-forward，停止並先比對遠端差異。不得 force push，也不得用覆寫遠端的方式略過衝突。

## 5. 發布後驗證

推送成功只代表 GitHub 已收到提交，不代表網站已完成部署。接續檢查：

1. GitHub Pages 的 Actions 執行成功。
2. 由該次部署結果提供的網站網址開啟首頁。
3. 首頁可找到本次 EP，且學習單網址可開啟。
4. 本次 EP 的「影片」連結存在且可開啟，並指向本次確認的影片。
5. 本次若修改首頁、搜尋、分類、共用資產、互動或列印功能，再檢查受影響功能；未修改的固定功能沿用既有 QA 基準。

完成以上檢查後才能回報「已發布」。若 Actions 或線上檢查失敗，回報失敗位置與下一步，不把成功推送描述為成功發布。

## 完成回報

回報以下項目：

- 發布的 EP 與納入的網站檔案。
- 推送到 `origin/main` 的提交識別碼。
- GitHub Pages Actions 結果。
- 線上首頁與學習單頁面的檢查結果。
- 本次 EP 影片連結的檢查結果。
- 未納入發布的其他工作目錄變更。
