const assert = require('node:assert/strict');
const { validateEndingPolicy, finalReminderIssues } = require('../../scripts/check/rules/final-reminder-check.cjs');
const policy = require('../../config/quality-policy.json').ending;

async function testFinalReminder(page, base) {
  validateEndingPolicy(policy);
  for (const invalid of [undefined, {...policy, heading:'h2'}, {...policy, geometryTolerancePx:-1}, {...policy, scaleTolerance:NaN}])
    assert.throws(() => validateEndingPolicy(invalid), /quality-policy.json/);
  const ending = '<aside class="closing final-reminder no-arrow"><p>先選一個做得到的行動，再依結果調整。</p></aside>';
  const ai = '<aside class="closing prompt-intro"><span class="closing-mark">→</span><p>整理前面的作答。</p></aside>';
  const prompt = '<aside class="prompt-quote"><p>請依我的作答整理一個行動。</p></aside>';
  const setFixture = async (content = ending, extraCss = '') => {
    await page.goto(base);
    await page.setContent(`<link rel="stylesheet" href="${base}/assets/worksheet.css"><style>${extraCss}</style><main class="worksheet"><article class="page"><textarea id="answer"></textarea>${content}${ai}${prompt}</article></main>`);
    await page.evaluate(() => document.fonts.ready);
  };
  const cases = [
    ['框內標題', ending.replace('<p>', '<h2>帶走一個提醒</h2><p>'), '', '框內不得有標題'],
    ['框外 h2', '<h2>結尾</h2>'+ending, '', '框外不得有結尾標題'],
    ['框外 h3', '<h3>結尾：我的提醒</h3>'+ending, '', '框外不得有結尾標題'],
    ['框外標題間隔正文', '<h2>帶走一個提醒</h2><p>先做一小步。</p>'+ending, '', '框外不得有結尾標題'],
    ['框外標題包在區塊', '<div class="section-heading"><h2>結尾</h2></div>'+ending, '', '框外不得有結尾標題'],
    ['箭頭', ending.replace('<p>', '<span class="closing-mark">→</span><p>'), '', '不得有箭頭'],
    ['多個結尾', ending+ending, '', '須唯一'],
    ['結尾後作答', ending+'<input type="text">', '', '所有作答欄位之後'],
    ['結尾後 AI', ending.replace('</aside>', ai+'</aside>'), '', 'AI 引導之前'],
    ['空白段落', ending.replace('先選一個做得到的行動，再依結果調整。',' '), '', '非空白'],
    ['包裝區塊', ending.replace('<p>', '<div><p>').replace('</p>', '</p></div>'), '', '只能直接放'],
    ['字級覆寫', ending, '.final-reminder p {font-size:32px}', 'fontSize'],
    ['框線覆寫', ending, '.closing.final-reminder {border-top:1px solid black}', 'borderTopWidth'],
    ['雙欄', ending, '.closing.final-reminder {grid-template-columns:1fr 1fr}', '單欄'],
    ['整頁 zoom', ending, '.page {zoom:.9}', '受縮放影響'],
    ['整頁 transform', ending, '.page {transform:scale(.9)}', '受縮放影響'],
    ['列印段落間距', ending, '@media print {.page p {margin:.35rem 0}}', 'marginTop'],
  ];
  for (const [media,width] of [['screen',1280], ['screen',390], ['print',794]]) {
    await page.setViewportSize({width,height:900}); await page.emulateMedia({media});
    await setFixture();
    assert.deepEqual(await finalReminderIssues(page,policy), [], `${media}: 正常結尾`);
    for (const selector of ['.prompt-intro', '.prompt-quote']) {
      await setFixture();
      await page.evaluate((selector) => {
        const nextPage = document.createElement('article');
        nextPage.className = 'page';
        document.querySelector('main').append(nextPage);
        if (selector === '.prompt-intro') nextPage.append(document.querySelector(selector));
        nextPage.append(document.querySelector('.prompt-quote'));
      }, selector);
      assert((await finalReminderIssues(page, policy)).some(issue => issue.includes('須在同一頁')),
        `${media}: 未攔住 ${selector} 跨頁（EP45／EP46 回歸）`);
    }
    for (const [name,html,css,message] of cases) {
      if (name==='列印段落間距' && media!=='print') continue;
      await setFixture(html,css);
      assert((await finalReminderIssues(page,policy)).some(issue=>issue.includes(message)), `${media}: 未攔住${name}`);
    }
  }
}

module.exports = { testFinalReminder };
