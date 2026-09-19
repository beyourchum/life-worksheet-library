const assert = require('node:assert/strict');
const { worksheetStyleIssues, inlineInputLayoutIssues } = require('../rules/worksheet-style-check.cjs');
const { numberedHtmlHeadings, numberedMarkdownHeadings } = require('../rules/worksheet-heading-check.cjs');

async function testWorksheetStyles(page) {
  const { worksheetStructureIssues } = require('../rules/worksheet-content-check.cjs');
  const answer = '<textarea id="answer"></textarea>';
  const ending = '<aside class="final-reminder">結尾</aside>';
  const ai = '<aside class="prompt-intro">AI 幫幫忙</aside><div data-prompt-text>提示詞</div>';
  const hero = '<div class="worksheet-hero"><p class="hero-question">我可以怎麼練習表達？</p></div>';
  const structure = async (body, title = '練習表達') => {
    await page.setContent(`<title>EP1｜${title}</title><main><h1>練習<em>表達</em></h1>${hero}${body}</main>`);
    return worksheetStructureIssues(page, '練習表達', 'EP1');
  };
  assert.deepEqual(await structure('<aside class="closing">作答引導</aside>' + answer + ending + ai), []);
  assert((await structure(answer + ending + ai + '<div class="worksheet-hero"><p class="hero-question">另一個問題？</p></div>')).some(x => x.includes('有且只有一則')));
  await page.setContent(`<title>EP1｜練習表達</title><main><h1>練習表達</h1>${answer}${ending}${ai}</main>`);
  assert((await worksheetStructureIssues(page, '練習表達', 'EP1')).some(x => x.includes('有且只有一則')));
  await page.setContent(`<title>EP1｜練習表達</title><main><h1>練習表達</h1><div class="worksheet-hero"><p class="hero-question">練習表達的方法</p></div>${answer}${ending}${ai}</main>`);
  assert((await worksheetStructureIssues(page, '練習表達', 'EP1')).some(x => x.includes('須以問句')));
  assert((await structure(answer + ending + ai, '原文章長標題')).some(x => x.includes('瀏覽器標題')));
  await structure(answer + ending + ai);
  await page.locator('h1').evaluate(node => { node.textContent = '另一個標題'; });
  assert((await worksheetStructureIssues(page, '練習表達', 'EP1')).some(x => x.includes('主標題')));
  assert((await structure(ending + answer + ai)).some(x => x.includes('所有作答')));
  assert((await structure(answer + ending + ending + ai)).some(x => x.includes('結尾語須唯一')));
  assert((await structure(answer + ai + ending)).some(x => x.includes('AI 引導之前')));
  assert((await structure(answer + ai)).some(x => x.includes('結尾語須唯一')));
  const { missingText } = require('../rules/worksheet-content-check.cjs');
  assert.deepEqual(missingText('請寫一項。<!-- example -->整理房間<!-- end-example -->', ['請寫一項。', '例如：整理房間']), []);
  assert.deepEqual(missingText('請寫一項。', ['請寫三項。']), ['請寫三項。']);
  assert.deepEqual(missingText('我承認自己……', ['我希望之後能……']), ['我希望之後能……']);
  const heading = '<div class="question-heading"><h3>選一個</h3><span class="answer-mode">單選</span></div>';
  const group = '<div class="choices"><label class="choice"><input id="a" type="radio" name="q">甲</label></div>';
  const check = async (html) => { await page.setContent(`<main>${html}</main>`); return worksheetStyleIssues(page); };
  // EP93: sentence blanks must have their own controls, not one shared answer box.
  const unmatchedBlanks = () => page.locator('.answer-field > label').evaluateAll(labels =>
    labels.filter(label => /[＿_]{2,}/.test(label.textContent)).map(label => label.htmlFor));
  await page.setContent('<div class="answer-field"><label for="mixed">我想請教＿＿，能力是＿＿，問題是＿＿：</label><textarea id="mixed"></textarea></div>');
  assert.deepEqual(await unmatchedBlanks(), ['mixed']);
  await page.setContent(require('node:fs').readFileSync('worksheets/EP93/index.html', 'utf8'));
  assert.deepEqual(await unmatchedBlanks(), []);
  for (const id of ['ep93-ask-name', 'ep93-ask-skill', 'ep93-help-skill'])
    assert.equal(await page.locator(`#${id}`).getAttribute('type'), 'text');
  for (const id of ['ep93-ask-person', 'ep93-help-person'])
    assert.equal(await page.locator(`textarea#${id}`).count(), 1);
  assert.equal(await page.locator('.answer-field').evaluateAll(fields => fields.every(field =>
    field.nextElementSibling?.matches('.example-note') && field.nextElementSibling.textContent.startsWith('例如：'))), true);
  await page.setContent(require('node:fs').readFileSync('worksheets/EP91/index.html', 'utf8'));
  assert.deepEqual(await unmatchedBlanks(), []);
  for (const id of ["ep91-major","ep91-semester","ep91-hours","ep91-unique","ep91-point1","ep91-point2","ep91-point3"]) {
    assert.equal(await page.locator('#' + id).getAttribute('type'), 'text');
    assert.equal(await page.locator('#' + id).evaluate(node =>
      node.parentElement.nextElementSibling?.matches('.example-note')), true);
  }
  assert.deepEqual(await check(heading + group), []);
  assert.deepEqual(await check(heading + group + '<div class="answer-field"><input type="text"></div>' + group.replace('id="a"', 'id="b"')), []);
  assert((await check(heading + group + '<p>補充說明</p>' + group.replace('name="q"', 'name="other"'))).some(x => x.includes('同組 radio')));
  assert.deepEqual(await check('<p><span class="example-note">例如：整理房間</span></p>'), []);
  assert((await check('<p class="example-note">範例：整理房間</p>')).some(x => x.includes('以「例如：」開頭')));
  assert((await check('<p class="example-note">起手句：我先整理桌面。</p>')).some(x => x.includes('以「例如：」開頭')));
  for (const prefix of ['如：', '像是：', '比如：', '舉例：'])
    assert((await check(`<p class="example-note">${prefix}整理房間</p>`)).some(x => x.includes('以「例如：」開頭')));
  assert((await check('<h3 class="subheading">情境：朋友臨時約吃飯</h3><p>選出較像你的描述。</p>')).some(x => x.includes('完整敘述須放在下方內文')));
  assert.deepEqual(await check('<h3 class="subheading">情境</h3><p>朋友臨時約吃飯；選出較像你的描述。</p>'), []);
  assert((await check('<h3>情境：朋友臨時約吃飯</h3><p>選出較像你的描述。</p>')).some(x => x.includes('h3.subheading')));
  assert((await check('<div class="question-heading"><h3>1. 選一個</h3><span class="answer-mode">單選</span></div>')).some(x => x.includes('不應加數字或字母編號')));
  assert((await check('<h3 class="subheading">2、整理下一步</h3>')).some(x => x.includes('不應加數字或字母編號')));
  assert((await check('<h3 class="subheading">A. 實用</h3>')).some(x => x.includes('不應加數字或字母編號')));
  assert.deepEqual(numberedHtmlHeadings('<h3>1. 選一個</h3><h3 class="subheading">2、整理下一步</h3><h3 class="subheading">A. 實用</h3>'), ['1. 選一個', '2、整理下一步', 'A. 實用']);
  assert.deepEqual(numberedHtmlHeadings('<h2><span>01</span>整理情境</h2><h3>選一個</h3>'), []);
  assert.deepEqual(numberedMarkdownHeadings('## 01 整理情境\n\n### 1. 選一個\n\n### 2、整理下一步\n\n### B、娛樂'), ['1. 選一個', '2、整理下一步', 'B、娛樂']);
  assert.deepEqual(numberedMarkdownHeadings('## 01 整理情境\n\n### 選一個'), []);
  assert((await check('<div class="subheading">情境：朋友臨時約吃飯</div>')).some(x => x.includes('灰綠底活動標題')));
  assert((await check(group)).some(x => x.includes('缺少題目')));
  assert((await check(heading.replace('<span class="answer-mode">單選</span>', '') + group)).some(x => x.includes('題型標示')));
  assert((await check(heading + '<p>先讀說明。</p>' + group.replace('type="radio"', 'type="checkbox"'))).some(x => x.includes('不一致')));
  for (const text of ['填入任務，例如：整理房間', '選項（例：期末報告）', '像是：期末報告', '比如：整理房間']) {
    assert((await check(`<p>${text}</p>`)).some(x => x.includes('灰字')));
    assert((await check(`<p><span class="example-note">${text}</span></p>`)).some(x => x.includes('以「例如：」開頭')));
  }
  assert.deepEqual(await check('<p>填入你的任務：<span class="example-note">例如：整理房間</span>，再提出問題。</p>'), []);
  const choiceExample = heading + '<div class="choices"><label class="choice"><input type="radio" name="q"><span class="choice-copy choice-copy-with-example">先找一個小課程<small class="choice-inline-example">例如：YouTube 教學</small></span></label></div>';
  assert.deepEqual(await check(choiceExample), []);
  assert((await check(heading + '<div class="choices"><label class="choice"><input type="radio" name="q"><span>先找一個小課程（如：YouTube 教學）</span></label></div>')).some(x => x.includes('另起一行')));
  assert((await check(choiceExample.replace('例如：YouTube 教學', '如：YouTube 教學'))).some(x => x.includes('以「例如：」開頭')));
  assert((await check('<small class="choice-inline-example">例如：YouTube 教學</small>')).some(x => x.includes('綠色選項格內')));
  const otherWithInsideExample = heading + '<div class="choices"><label class="choice other-choice"><span class="choice-toggle"><input type="radio" name="q">其他</span><input class="other-input" type="text"><small class="choice-inline-example">例如：社團教室</small></label></div>';
  assert((await check(otherWithInsideExample)).some(x => x.includes('綠色選項格外')));
  assert.deepEqual(await check('<div class="answer-field"><input type="text"><small class="example-note">例如：整理房間</small></div>'), ['填答欄的示範須放在橫線下方，不得放進填答欄內：例如：整理房間']);
  assert.deepEqual(await check('<div class="answer-field"><input type="text"></div><p class="example-note">例如：整理房間</p>'), []);
  assert((await check(heading + '<div class="choices"><label class="choice"><input id="other" type="radio" name="q">其他<input type="text"></label></div>')).some(x => x.includes('配對')));
  const inlineChoice = '<div class="choices"><label class="choice"><input type="radio" name="q"><span>我還不確定，因為：<input id="reason" class="inline-input" type="text"></span></label></div>';
  assert.deepEqual(await check(heading + inlineChoice), []);
  assert((await check(heading + inlineChoice.replace(' class="inline-input"', ''))).some(x => x.includes('相同長度')));
  assert((await check(heading + inlineChoice.replace('class="inline-input"', 'class="inline-input compact-input"'))).some(x => x.includes('numeric 或 decimal')));
  assert.deepEqual(await check(heading + inlineChoice.replace('class="inline-input"', 'class="inline-input compact-input" inputmode="numeric"')), []);
  await page.setContent(`<style>
    .choice{display:flex}.choice>span:has(.inline-input){display:flex;flex:1;min-width:0}
    .inline-input{min-width:7rem;flex:1;border:0;border-bottom:1px solid #000}
  </style><main>${heading}${inlineChoice}</main>`);
  assert.deepEqual(await inlineInputLayoutIssues(page), []);
  await page.locator('#reason').evaluate((input) => { input.style.flex = '0 0 auto'; input.style.minWidth = '0'; });
  assert((await inlineInputLayoutIssues(page)).some(x => x.includes('伸展長度')));
}
module.exports = { testWorksheetStyles };
