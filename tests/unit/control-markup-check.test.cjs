const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { containerClasses, controlMarkupIssues } = require('../../scripts/check/rules/control-markup-check.cjs');
const oldEp19 = fs.readFileSync(path.join(__dirname, '../fixtures/ep19-inline-answer.html'), 'utf8');
assert.equal(controlMarkupIssues(oldEp19).length, 5);
assert(controlMarkupIssues(oldEp19).every(issue => /ep19-w4-cycle-/.test(issue) && issue.includes('容器樣式 inline-answer')));
for (const tag of ['input', 'textarea', 'select']) {
  for (const cls of containerClasses) {
    assert.equal(controlMarkupIssues(`<${tag} id="bad" class="${cls}"></${tag}>`).length, 1);
  }
}
for (const html of [
  '<INPUT\nCLASS=inline-answer\nID=upper>',
  "<input title='a > b' id='quoted' class='x inline-answer y'>",
  '<input id="entity" class="inline&#45;answer">',
  '<input id="space" class="x&Tab;inline-answer">',
  '<textarea class="answer-field">literal <input></textarea>',
  '<!-- ignored --><input class="inline-answer">',
]) assert.equal(controlMarkupIssues(html).length, 1, html);
for (const html of [
  '<div class="inline-answer"><input class="inline-input"></div>',
  '<div class="answer-field"><label for="time">時間</label><input id="time" class="short-answer"></div>',
  '<input data-class="inline-answer" class="short-answer">',
  '<input title="class=inline-answer" class="short-answer">',
  '<!-- <input class="inline-answer"> -->',
  '<script>const example = \'<input class="inline-answer">\';</script>',
  '<textarea>literal <input class="inline-answer"></textarea><input class="short-answer">',
  '<p>&lt;input class="inline-answer"&gt;</p>',
]) assert.deepEqual(controlMarkupIssues(html), [], html);
assert.equal(controlMarkupIssues('<textarea>literal</textarea><input class="inline-answer" id="after-raw">').length, 1);
console.log('欄位樣式契約測試通過：EP19 原始五欄、屬性格式、容器與文字範例。');
