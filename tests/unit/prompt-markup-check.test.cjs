const assert = require('node:assert/strict');
const {promptMarkupIssues} = require('../../scripts/check/rules/prompt-markup-check.cjs');
const intro = '<aside class="closing prompt-intro"><span class="closing-mark">→</span><h2>AI 幫幫忙</h2><p>下方會帶入作答，請複製後檢查。</p></aside>';
const quote = title => `<aside class="prompt-quote">${title ? `<h3>${title}</h3>` : ''}<div class="prompt-copy-text" data-prompt-text><p>請協助整理【任務】。</p></div><button type="button" data-prompt-copy>複製提示詞</button></aside>`;
const valid = intro + quote();
assert.deepEqual(promptMarkupIssues(valid), []);
assert.deepEqual(promptMarkupIssues(intro + quote('任務切片') + quote('抽象任務')), []);
const cases = [
  [valid.replace('<h2>AI 幫幫忙</h2>', ''), /標題須唯一|須依序/],
  [valid.replace('<h2>AI 幫幫忙</h2>', '') + '<h2>AI 幫幫忙</h2>', /標題須唯一/],
  [valid.replace('<p>下方', '<p>AI 幫幫忙：下方'), /名稱只能出現一次/],
  [valid.replace('<h2>', '<div><h2>').replace('</h2>', '</h2></div>'), /須依序/],
  [valid.replace('→', '⇒'), /綠色箭頭/],
  [valid.replace('下方會帶入作答，請複製後檢查。', ' '), /非空白說明/],
  [valid.replace('請協助整理【任務】。', ' '), /內容不可空白/],
  [valid.replace('prompt-quote">', 'prompt-quote"><h3>任務切片</h3><h3>抽象任務</h3>'), /最多一個 h3/],
  [valid.replace('<button type="button" data-prompt-copy>複製提示詞</button>', ''), /獨立內容/],
  [valid + '<button data-prompt-copy>複製</button>', /自己的 prompt-quote/],
  [quote() + intro, /引導框之後/],
  [intro + quote('同名') + quote('同名'), /標題重複/],
  [intro + quote() + quote('第二份'), /非空白 h3/],
  [valid.replace('<p>請協助', '<h3>夾在內容裡</h3><p>請協助'), /獨立內容/],
];
for (const [html, pattern] of cases) assert(promptMarkupIssues(html).some(issue=>pattern.test(issue)), `未攔截 ${pattern}`);
