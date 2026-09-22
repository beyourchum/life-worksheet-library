const assert = require('node:assert/strict');
const { missingMarkdownText, markdownTextUnits } = require('../rules/worksheet-content-check.cjs');

const md = `---
ep: 1
---
<!-- maintenance note -->
# EP1｜測試標題
## 學習目標
辨認一件已發生的事。
- [ ] 第一個選項
| 已知 | 未知 |
| --- | --- |
| ＿＿＿＿ | ＿＿＿＿ |
## 結尾
完成後，選一個下一步。
## AI 幫幫忙
請整理我的答案。`;

assert.deepEqual(markdownTextUnits(md), ['測試標題', '學習目標', '辨認一件已發生的事。', '第一個選項', '已知', '未知', '完成後，選一個下一步。', '請整理我的答案。']);
assert.deepEqual(missingMarkdownText(md, '測試標題 學習目標 辨認一件已發生的事 第一個選項 已知 未知 完成後，選一個下一步。 請整理我的答案。'), []);
assert.deepEqual(missingMarkdownText(md, '測試標題 學習目標 第一個選項 已知 未知 完成後，選一個下一步。 請整理我的答案。'), ['辨認一件已發生的事。']);
assert.deepEqual(missingMarkdownText('例如：已知的事／不知道的事', '已知的事 其他欄位 不知道的事'), []);
