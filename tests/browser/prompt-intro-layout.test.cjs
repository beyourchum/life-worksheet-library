const assert = require('node:assert/strict');
const { promptIntroLayoutIssues } = require('../../scripts/check/rules/prompt-intro-layout-check.cjs');

async function testPromptIntroLayout(page, base) {
  for (const [media, width] of [['screen', 1280], ['screen', 390], ['print', 794]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ media });
    for (const ep of ['EP46', 'EP54', 'EP55', 'EP44', 'EP48']) {
      await page.goto(`${base}/worksheets/${ep}/`);
      await page.evaluate(() => document.fonts.ready);
      assert.deepEqual(await promptIntroLayoutIssues(page), [], `${ep}: ${media} ${width}px`);
    }
    await page.goto(`${base}/worksheets/EP46/`);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '.closing.prompt-intro > h2 ~ p { grid-column: auto; }' });
    assert((await promptIntroLayoutIssues(page)).includes('AI 幫幫忙標題被擠壓換行'),
      `${media} ${width}px: 檢查器須能攔住 EP46 原有的四行標題`);
    for (const [mutation, expected] of [
      ['outside', '標題須唯一'],
      ['missing', '須依序'],
      ['duplicate', '名稱只能出現一次'],
      ['wrapper', '須依序'],
      ['stacked', '最多一個 h3'],
      ['button', '獨立內容'],
      ['border', '無框線樣式'],
    ]) {
      await page.goto(`${base}/worksheets/EP46/`);
      await page.evaluate(mutation => {
        const intro = document.querySelector('.prompt-intro');
        const quote = document.querySelector('.prompt-quote');
        if (mutation === 'outside') intro.before(intro.querySelector('h2'));
        if (mutation === 'missing') intro.querySelector('h2').remove();
        if (mutation === 'duplicate') intro.querySelector('p').prepend('AI 幫幫忙：');
        if (mutation === 'wrapper') { const wrapper=document.createElement('div');intro.querySelector('h2').replaceWith(wrapper);wrapper.innerHTML='<h2>AI 幫幫忙</h2>'; }
        if (mutation === 'stacked') quote.insertAdjacentHTML('afterbegin','<h3>第一份</h3><h3>第二份</h3>');
        if (mutation === 'button') quote.querySelector('button').remove();
        if (mutation === 'border') intro.style.borderTop='1px solid black';
      },mutation);
      assert((await promptIntroLayoutIssues(page)).some(issue=>issue.includes(expected)), `${mutation}: 檢查器必須攔截 ${expected}`);
    }
  }
}

module.exports = { testPromptIntroLayout };
