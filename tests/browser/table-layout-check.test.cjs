const assert = require('node:assert/strict');
const { tableLayoutIssues } = require('../../scripts/check/rules/table-layout-check.cjs');
async function testTableLayout(page, base) {
  await page.setContent('<main class="worksheet" style="width:200px;overflow:hidden"><table style="width:200px;table-layout:fixed"><tr><td style="white-space:nowrap">A very long explanation that must wrap inside its own table cell instead of being clipped</td></tr></table></main>');
  assert((await tableLayoutIssues(page)).some(s => s.includes('內容溢出')));
  await page.setContent('<main class="worksheet"><table><tr><td style="width:200px"><input id="outside" style="position:relative;left:300px"></td></tr></table></main>');
  assert((await tableLayoutIssues(page)).some(s => s.includes('控制超出儲存格')));
  await page.setContent('<main class="worksheet"><table><tr><td style="position:relative;width:200px;height:50px"><label class="choice" style="position:absolute;left:5px;top:5px">First</label><label class="choice" style="position:absolute;left:5px;top:5px">Second</label></td></tr></table></main>');
  assert((await tableLayoutIssues(page)).some(s => s.includes('選項重疊')));
  await page.goto(base + '/worksheets/EP49/');
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#ep49-w3-cultural-other').check();
  await page.locator('#ep49-w3-cultural-other-text').fill('被忽略，也有一點不知所措');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.deepEqual(await tableLayoutIssues(page), [], 'EP49 表格 ' + width);
  }
  await page.emulateMedia({ media: 'print' });
  assert.deepEqual(await tableLayoutIssues(page), [], 'EP49 填答後列印');
}
module.exports = { testTableLayout };
