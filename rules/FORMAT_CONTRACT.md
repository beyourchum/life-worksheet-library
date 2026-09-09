# Markdown 與 HTML 格式契約

本文件是 Script 輸入、HTML 輸出與格式 lint 的唯一規格。

## Markdown frontmatter

每份 `corrected.md` 必須包含：

```yaml
---
id: EP62
document_role: student_worksheet
audience: 台灣大專生與初入職場者
source_document: https://docs.google.com/document/d/...
series_title: 職場生存攻略
hero_kicker: 這點薪水憑什麼要我拚？
hero_title: 努力，有回報嗎？
hero_accent: 有回報嗎？
hero_question: 工作薪水和付出不成比例，該繼續努力、溝通，還是換工作？
---
```

- `id`：檔案識別碼，英文字母使用大寫。
- `document_role`：學生版固定為 `student_worksheet`。
- `audience`：實際目標客群，不得留白。
- `source_document`：原生 Google Docs 連結或可定位來源的字串。
- `series_title`：顯示在每頁頁首的系列名稱。
- `hero_kicker`：主視覺上方的小標。
- `hero_title`：主視覺的大標題。
- `hero_accent`：`hero_title` 中使用深綠色強調的完整文字，必須是大標題的一部分。
- `hero_question`：大標題下方的一句核心提問。

只使用這一組欄位與共用版型。舊欄位 `font_profile` 與舊註解 `section-note` 已移除；lint 會直接拒絕，避免退回不同樣式。

## 最小可建置範例

複製下列結構，替換文字後即可執行 lint 與 build：

```markdown
---
id: EP63
document_role: student_worksheet
audience: 台灣大專生與初入職場者
source_document: https://docs.google.com/document/d/...
series_title: 職場生存攻略
hero_kicker: 影片主題小標
hero_title: 一句大標題
hero_accent: 大標題
hero_question: 一句核心提問？
---

# Ep.63 完整影片標題

**使用說明：** 一段簡短說明。

## 01 第一個區塊

### 第一題（單選）

- [ ] 選項一
- [ ] 選項二

<!-- page-break -->

## 02 第二個區塊

### 第二題（可複選）

- [ ] 選項一
- [ ] 選項二
```

`hero_accent` 必須逐字出現在 `hero_title` 中；題型、分頁與填答欄位依下節標記。

## 文件結構

- 只有一個 H1，作為學習單主標題。
- H1 保存完整影片標題；頁尾會自動移除開頭的集數並顯示其餘文字。
- 主要區塊使用 H2，格式為 `## 01 區塊名稱`，從 `01` 連續編號。
- 題目或作答指令使用 H3。
- 第二頁前使用獨立一行 `<!-- page-break -->`。
- 一份學習單最多兩頁，因此最多一個 page-break。
- 不使用空格、全形空白或大量底線控制視覺位置。

## 題型標記

### 單選

```markdown
### 我目前比較想怎麼做？（單選）

- [ ] 先繼續觀察
- [ ] 和相關的人溝通
```

### 複選

```markdown
### 哪些項目需要改善？（可複選）

- [ ] 薪水
- [ ] 工作內容
- [ ] 其他（請填寫）
```

### 單選矩陣

```markdown
<!-- matrix-single: 滿意 | 普通 | 不滿意 -->
- 目前的薪水
- 目前的工作內容
<!-- end-matrix -->
```

### 短答與長答

```markdown
<!-- short-answer: 目前最需要改善的一項是 -->
<!-- long-answer: 我想補充的是 -->
```

- `其他（請填寫）` 由 Script 自動附加短文字欄。
- 不在選項後加入底線。
- 日期若不需要瀏覽器日期控制項，使用短答並在標籤中寫明格式。

## 支援的 Markdown

Script 支援 frontmatter、H1～H3、一般段落、粗體、無序清單、選項清單、引用文字、page-break 與本文件定義的題型註解。其他 Markdown 語法在使用前必須先擴充 parser 與 lint。

## HTML 映射

| Markdown | HTML |
|---|---|
| `（單選）` + `- [ ]` | 同名 `radio` 群組 |
| `（可複選）` + `- [ ]` | `checkbox` 群組 |
| `matrix-single` | 每列一組 `radio` |
| `short-answer` | 單行文字欄 |
| `long-answer` | `textarea` |
| `其他（請填寫）` | 選項加單行文字欄 |
| `page-break` | 新的 A4 `.page` 容器 |

## HTML 輸出要求

- 一律套用 `templates/worksheet.html` 與 `templates/worksheet.css` 的核准樣式，不提供簡化版或樣式切換欄位。
- 頁首顯示 EP 編號、系列名稱與頁數；頁尾顯示 EP 編號及影片標題，不顯示頁碼。
- 主標題保留核准字體與深綠色強調，區塊編號使用深綠色。
- 每道單選、複選與矩陣題都在題目右側顯示灰色作答模式。
- 選項使用淺綠色塊，不以底線取代色塊；A4 列印亦同。
- 使用說明使用淺灰字，不加上下橫線。
- `lang="zh-Hant"` 且包含 viewport。
- A4 直式列印；每個 `.page` 固定為一張 A4，工具列在列印時隱藏。
- 支援至少 320 px 寬度，不產生水平捲動。
- 不只靠顏色傳達必要資訊，黑白列印仍可辨識層級。
- 所有輸入控制項都有可見標籤或 `aria-label`。
- checkbox、radio、input 與 textarea 使用 `sessionStorage` 暫存。
- 提供「清除本次暫存」；不發出答案上傳請求。
- 輸出不得依賴外部 HTTP／HTTPS 資產。
- HTML 不得留下 `{{...}}` 模板標記。

## Lint 狀態

- `fail`：Script 無法可靠建置，必須先修正。
- `warning`：可以建置，但需要人工或模型確認。
- `pass`：所有機械規則通過；不代表視覺 QA 已完成。
