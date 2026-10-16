const assert = require('node:assert/strict');
const { tableLayoutIssues } = require('../../scripts/check/rules/table-layout-check.cjs');
async function testTableLayout(page, base) {
  await page.setContent('<main class="worksheet"><article class="page" style="width:500px;padding:20px"><table style="width:200px"><tr><td>比較項目</td></tr></table></article></main>');
  assert((await tableLayoutIssues(page)).some(s => s.includes('頁面可用寬度')));
  await page.locator('table').evaluate(el => el.style.width = '100%');
  assert.deepEqual(await tableLayoutIssues(page), []);
  await page.setContent('<main class="worksheet"><table><tbody style="display:block;width:300px"><tr style="display:block;width:300px"><td style="display:block;width:100px">直排作答位置</td></tr></tbody></table></main>');
  assert((await tableLayoutIssues(page)).some(s => s.includes('整列寬度')));
  await page.setContent('<main class="worksheet"><table><tr><td style="width:500px"><textarea id="narrow"></textarea><input id="tiny-text" type="text" style="width:20px"></td></tr></table></main>');
  assert.equal((await tableLayoutIssues(page)).filter(s => s.includes('未使用可用寬度')).length, 2);
  await page.setContent('<main class="worksheet"><table><tr><td style="width:500px"><input type="text" inputmode="numeric" style="width:40px"><input type="checkbox"><input type="radio"></td></tr></table></main>');
  assert.deepEqual(await tableLayoutIssues(page), []);
  await page.setContent('<main class="worksheet" style="width:200px;overflow:hidden"><table style="width:200px;table-layout:fixed"><tr><td style="white-space:nowrap">A very long explanation that must wrap inside its own table cell instead of being clipped</td></tr></table></main>');
  assert((await tableLayoutIssues(page)).some(s => s.includes('內容溢出')));
  await page.setContent('<main class="worksheet"><table><tr><td style="width:200px"><input id="outside" style="position:relative;left:300px"></td></tr></table></main>');
  assert((await tableLayoutIssues(page)).some(s => s.includes('控制超出儲存格')));
  await page.setContent('<main class="worksheet"><table><tr><td style="position:relative;width:200px;height:50px"><label class="choice" style="position:absolute;left:5px;top:5px">First</label><label class="choice" style="position:absolute;left:5px;top:5px">Second</label></td></tr></table></main>');
  assert((await tableLayoutIssues(page)).some(s => s.includes('選項重疊')));
  await page.setContent(`<link rel="stylesheet" href="${base}/assets/worksheet.css"><link rel="stylesheet" href="${base}/assets/worksheet-components.css"><main class="worksheet"><table class="comparison-table"><tr><td><textarea rows="2"></textarea><input type="text"><input type="text" inputmode="numeric"><input type="checkbox"><input type="radio"></td></tr></table><div class="comparison-table"><table><tr><td><textarea rows="2"></textarea><input type="text"></td></tr></table></div><table><tr><td><textarea rows="2"></textarea></td></tr></table></main>`);
  await page.locator('textarea').first().fill('週四下課後，先整理兩個問題，再詢問助教可用的練習資源。');
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.deepEqual(await tableLayoutIssues(page), [], '各種表格結構的敘述欄應使用完整寬度');
    const sizes = await page.locator('input').evaluateAll(inputs => inputs.map(el => ({ type: el.type, mode: el.inputMode, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
    assert(sizes[0].width > sizes[1].width * 2, '分數欄應與敘述欄區分');
    for (const control of sizes.filter(s => ['checkbox', 'radio'].includes(s.type))) assert(control.width < 25 && control.height < 25);
    assert(sizes[0].height > 19.2, '文字欄不得繼承勾選框的高度');
  }
  for (const [ep, ids] of [
    ['EP25', ['ep25-w1-deadline', 'ep25-w1-stuck', 'ep25-w1-done', 'ep25-w1-impact', 'ep25-w3-adjust-fail', 'ep25-w3-adjust-success', 'ep25-w3-adjust-authority', 'ep25-w3-adjust-separation', 'ep25-w3-adjust-intimacy']],
    ['EP26', ['ep26-w1-heard', 'ep26-w1-tone', 'ep26-w1-inference', 'ep26-w2-original', 'ep26-w2-question']],
    ['EP55', ['ep55-w1-repeat-message', 'ep55-w1-repeat-other-text', 'ep55-w1-will-stop', 'ep55-w1-sex-pursuit', 'ep55-w1-fear-detour']]
  ]) {
    await page.goto(base + '/worksheets/' + ep + '/');
    await page.evaluate(() => document.fonts.ready);
    for (const id of ids) assert.equal(await page.locator('table #' + id).count(), 1, ep + ': 保留原稿表格的作答位置 ' + id);
    if (ep === 'EP55') {
      await page.locator('#ep55-w1-repeat-other').check();
      await page.locator('#ep55-w1-repeat-other-text').fill('每天放學後守候');
    }
    for (const width of [1280, 390, 320]) {
      await page.emulateMedia({ media: 'screen' });
      await page.setViewportSize({ width, height: 900 });
      assert.deepEqual(await tableLayoutIssues(page), [], ep + ': 原稿表格 ' + width);
    }
    await page.emulateMedia({ media: 'print' });
    assert.deepEqual(await tableLayoutIssues(page), [], ep + ': 原稿表格列印');
  }
  await page.emulateMedia({ media: 'screen' });
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
