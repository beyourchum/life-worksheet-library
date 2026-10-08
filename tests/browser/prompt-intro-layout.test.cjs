const assert = require('node:assert/strict');
const { promptIntroLayoutIssues } = require('../../scripts/check/rules/prompt-intro-layout-check.cjs');

async function testPromptIntroLayout(page, base) {
  for (const [media, width] of [['screen', 1280], ['screen', 390], ['print', 794]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ media });
    // Cover direct heading/paragraph siblings, a shared content wrapper, and an external heading.
    for (const ep of ['EP46', 'EP54', 'EP55']) {
      await page.goto(`${base}/worksheets/${ep}/`);
      await page.evaluate(() => document.fonts.ready);
      assert.deepEqual(await promptIntroLayoutIssues(page), [], `${ep}: ${media} ${width}px`);
    }
    await page.goto(`${base}/worksheets/EP46/`);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '.closing.prompt-intro > h2 ~ p { grid-column: auto; }' });
    assert((await promptIntroLayoutIssues(page)).includes('AI 幫幫忙標題被擠壓換行'),
      `${media} ${width}px: 檢查器須能攔住 EP46 原有的四行標題`);
  }
}

module.exports = { testPromptIntroLayout };
