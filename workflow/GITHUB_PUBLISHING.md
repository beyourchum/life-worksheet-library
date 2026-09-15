# GitHub 網站發布流程

本文件只說明已完成校正、建置與驗證的學習單如何發布到 GitHub Pages。內容處理與驗收依 [`WORKFLOW.md`](WORKFLOW.md)；未收到明確發布要求時，不執行本流程。

## 發布入口

使用者以「發布 EPxx」明確指定本次發布範圍。每次以一個或一組列明的 EP 為單位，不把工作目錄中的其他變更一併發布。

公開網站來源位於 `site/`。發布時將這個目錄獨立轉成 GitHub 遠端 `main` 分支的根目錄；開發專案的其他目錄不會出現在公開網站分支。

## 1. 發布前檢查

每個指定 EP 必須符合以下條件：

- 校正報告與驗證報告皆為目前檔案版本。
- lint、build 與機械驗證通過。
- 瀏覽器、互動及 A4 列印 QA 已完成。
- 沒有待使用者確認的內容變更。

若任一條件未完成，停止發布並回報缺少的項目；不要以發布操作取代校正或驗證。

## 2. 準備公開網站檔案

將指定 EP 已驗證的建置結果更新至：

```text
site/worksheets/EPxx/index.html
site/worksheets/EPxx/fonts/
```

新增學習單或首頁資訊需要變更時，同步更新 `site/worksheets.json`。既有 EP 只更新對應項目，不重排或改寫其他項目。只有本次明確包含網站介面調整時，才修改 `site/index.html` 或 `site/assets/`。

準備完成後，再對 `site/worksheets/EPxx/index.html` 執行機械驗證與最小瀏覽器 QA，確認首頁連結可以開啟該學習單，且本機字型等相對資產可正常載入。

## 3. 限定 Git 變更

發布前檢視 Git 差異，只納入：

- 本次指定的 `site/worksheets/EPxx/`。
- 本次需要的 `site/worksheets.json` 項目。
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
3. 首頁可找到本次 EP，搜尋與分類仍可使用。
4. 學習單頁面、字型、填答暫存、清除與列印功能正常。

完成以上檢查後才能回報「已發布」。若 Actions 或線上檢查失敗，回報失敗位置與下一步，不把成功推送描述為成功發布。

## 完成回報

回報以下項目：

- 發布的 EP 與納入的網站檔案。
- 推送到 `origin/main` 的提交識別碼。
- GitHub Pages Actions 結果。
- 線上首頁與學習單頁面的檢查結果。
- 未納入發布的其他工作目錄變更。
