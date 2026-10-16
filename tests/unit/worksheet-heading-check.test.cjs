const assert = require('node:assert/strict');
const { headingText, markdownTitleIssues, numberedHtmlHeadings, numberedMarkdownHeadings } = require('../../scripts/check/rules/worksheet-heading-check.cjs');

assert.equal(headingText('測試<em>學習單</em> &amp; &#x63d0;&#37266;'), '測試學習單&提醒');
assert.equal(headingText('&lt;提醒&gt; &quot;例子&quot; &#39;內容&#39;'), '<提醒>"例子"\'內容\'');
assert.equal(headingText('&#999999999;'), '&#999999999;');
assert.deepEqual(markdownTitleIssues('# 測試學習單\n正文', '測試學習單', 'EP1'), []);
assert.deepEqual(markdownTitleIssues('# EP1｜測試學習單\r\n正文', '測試學習單', 'EP1'), []);
for (const markdown of ['# 舊標題\n\n正文提及測試學習單', '測試學習單\n正文', '# 測試學習單\n# 另一標題', '<!--\n# 測試學習單\n-->\n# 舊標題', '---\nsource_title: 測試學習單\n---\n# 舊標題', '```md\n# 測試學習單\n```\n正文'])
  assert(markdownTitleIssues(markdown, '測試學習單', 'EP1').length, markdown);

for (const prefix of ['一、', '二、', '三、', '十、', '十一、', '（一）', '(二)', '1.', '2、', 'A.', 'B、']) {
  for (let level = 2; level <= 6; level++) {
    const title = `${prefix}整理情境`;
    assert.deepEqual(numberedHtmlHeadings(`<h${level}>${title}</h${level}>`), [title]);
    assert.deepEqual(numberedMarkdownHeadings(`${'#'.repeat(level)} ${title}\r\n`), [title]);
  }
}
assert.deepEqual(numberedHtmlHeadings('<h2><em>一、</em>整理情境</h2>'), ['一、整理情境']);
assert.deepEqual(numberedHtmlHeadings('<h2>&#x4e00;&#12289;整理情境</h2>'), ['一、整理情境']);
assert.deepEqual(numberedHtmlHeadings('<h2><span class="section-number">01</span>一、整理情境</h2>'), ['一、整理情境']);
assert.deepEqual(numberedMarkdownHeadings('## **一、整理情境**'), ['一、整理情境']);
assert.deepEqual(numberedHtmlHeadings('<div class="section-heading"><span class="section-number">01</span><h2>整理情境</h2></div><p>每週一、兩次</p><h3>一個可以嘗試的方法</h3>'), []);
assert.deepEqual(numberedHtmlHeadings("<h2><span class='section-number'>01</span>整理情境</h2><h3>選一個</h3>"), []);
assert.deepEqual(numberedMarkdownHeadings('## 01 整理情境\n\n### 一個可以嘗試的方法\n\n每週一、兩次'), []);
