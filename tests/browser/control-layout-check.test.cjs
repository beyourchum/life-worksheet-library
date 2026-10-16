const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { controlLayoutIssues } = require('../../scripts/check/rules/control-layout-check.cjs');

async function testControlLayouts(page, base) {
  const css = fs.readFileSync(path.join(__dirname, '../../assets/worksheet.css'), 'utf8');
  const oldEp19 = fs.readFileSync(path.join(__dirname, '../fixtures/ep19-inline-answer.html'), 'utf8');
  const ids = ['minutes', 'scope', 'practice', 'feedback', 'stuck'].map(name => `ep19-w4-cycle-${name}`);
  const modes = [
    { name: 'desktop', width: 1280, media: 'screen' },
    { name: 'mobile', width: 390, media: 'screen' },
    { name: 'print', width: 1280, media: 'print' },
    { name: 'fallback-print', width: 1280, media: 'print' },
  ];
  for (const mode of modes) {
    await page.setViewportSize({ width: mode.width, height: 900 });
    await page.emulateMedia({ media: mode.media });
    await page.setContent(`<style>${css}</style><main>${oldEp19}</main>`);
    const oldIssues = await controlLayoutIssues(page);
    for (const id of ids) {
      assert(oldIssues.some(issue => issue.includes(id) && issue.includes('容器樣式')), `${mode.name}: 未攔截 ${id} 的錯誤 class`);
      assert(oldIssues.some(issue => issue.includes(id) && issue.includes('切斷前後文字')), `${mode.name}: 未攔截 ${id} 的實際斷句`);
    }
    await page.setContent('<style>.renamed{display:block}</style><main><p>先用<span><input class="renamed" id="renamed"></span>分鐘練習。</p></main>');
    assert((await controlLayoutIssues(page)).some(issue => issue.includes('renamed') && issue.includes('切斷前後文字')), `${mode.name}: 換 class 名稱仍須攔截斷句`);
    await page.setContent(`<style>${css}</style><main><p class="inline-answer">先用<input class="inline-input" id="flex-item">分鐘練習。</p><div class="answer-field"><label for="standalone">練習時間</label><input class="short-answer" id="standalone"></div><p>先用<input class="inline-input" id="normal-wrap">分鐘練習。</p></main>`);
    assert.deepEqual(await controlLayoutIssues(page), [], `${mode.name}: 合法容器、獨立欄位及自然換行不得誤報`);
  }
  await page.setContent('<style>@media screen and (max-width:500px){#responsive{display:flex}} @media print{#responsive{display:grid}}</style><main><p>先用<input id="responsive">分鐘練習。</p></main>');
  await page.emulateMedia({ media: 'screen' });
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.deepEqual(await controlLayoutIssues(page), []);
  await page.setViewportSize({ width: 390, height: 844 });
  assert((await controlLayoutIssues(page)).some(issue => issue.includes('responsive') && issue.includes('flex')));
  await page.emulateMedia({ media: 'print' });
  assert((await controlLayoutIssues(page)).some(issue => issue.includes('responsive') && issue.includes('grid')));

  for (const mode of modes) {
    await page.setViewportSize({ width: mode.width, height: 900 });
    await page.emulateMedia({ media: mode.media });
    if (mode.name === 'fallback-print') await page.route('**/*.woff2', route => route.abort());
    try {
      await page.goto(base + '/worksheets/EP19/');
      await page.evaluate(() => document.fonts.ready);
      for (const [index, id] of ids.entries()) {
        const field = page.locator('#' + id);
        assert.equal(await field.getAttribute('class'), 'short-answer');
        assert.equal(await page.locator(`.answer-field > label[for="${id}"]`).count(), 1);
        assert.match(await field.locator('..').locator('+ .example-note').innerText(), /^例如：/);
        await field.fill(index === 0 ? '15' : `EP19 欄位 ${index} 代表答案`);
      }
      assert.deepEqual(await controlLayoutIssues(page), [], `${mode.name}: EP19 新版五個獨立欄位應通過`);
    } finally {
      if (mode.name === 'fallback-print') await page.unroute('**/*.woff2');
    }
  }
}

module.exports = { testControlLayouts };
