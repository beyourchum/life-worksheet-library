const assert = require('node:assert/strict');

async function testEp10Interactions(page, base) {
  await page.goto(`${base}/worksheets/EP10/`);
  const prompt = page.locator('[data-prompt-text]');
  assert.equal(await page.locator('input:checked').count(), 0);
  assert.equal((await prompt.innerText()).match(/【[^】]+】/g).length, 18);
  const feelings = page.locator('[name=ep10-feelings]');
  await feelings.nth(0).check();
  await feelings.nth(1).check();
  await feelings.nth(6).check();
  await page.locator('#ep10-feeling-other').fill('茫然');
  for (const index of [7, 8]) {
    await feelings.nth(index).check();
    assert.equal(await feelings.evaluateAll(nodes => nodes.filter(n => n.checked).length), 1);
    await page.reload();
    assert.equal(await feelings.nth(index).isChecked(), true);
  }
  await feelings.nth(6).check();
  assert.equal(await feelings.nth(8).isChecked(), false);
  assert.equal(await page.locator('#ep10-feeling-other').inputValue(), '茫然');
  await feelings.nth(6).uncheck();
  assert.equal(await feelings.evaluateAll(nodes => nodes.filter(n => n.checked).length), 0);
  await page.locator('#ep10-judgment-1').check();
  await page.locator('#ep10-judgment-3').check();
  assert.equal(await page.locator('[name=ep10-judgment]:checked').count(), 1);
  assert.equal(await page.locator('#ep10-judgment-1').isChecked(), false);
  const values = {
    impact: '錯過午餐', action: '回宿舍滑手機', benefit: '暫時安心', cost: '上課分心',
    reason: '沒有安排吃飯', 'next-response': '先買午餐再回宿舍',
    need: '維持用餐安排', person: '同班朋友', request: '一起吃午餐', 'request-time': '明天中午十二點',
    backup: '先自行買午餐', area: '午餐安排', step: '下課後到學餐買午餐',
    'start-time': '週三中午', place: '學校學餐', done: '買好並坐下吃飯',
    fallback: '排隊太久就去商店', 'review-time': '明天晚餐後'
  };
  await page.locator('#ep10-need').fill(values.need);
  assert((await prompt.innerText()).includes('詢問對象：【W3 詢問對象】'));
  assert((await prompt.innerText()).includes(`需要的支持：${values.need}`));
  for (const [key,value] of Object.entries(values)) await page.locator(`#ep10-${key}`).fill(value);
  let text = await prompt.innerText();
  for (const value of Object.values(values)) assert(text.includes(value), `EP10 提示詞缺少作答：${value}`);
  assert(!text.includes('【'));
  await page.reload();
  assert.equal(await prompt.innerText(), text);
  await page.locator('#ep10-person').fill('室友');
  text = await prompt.innerText();
  assert(text.includes('詢問對象：室友') && !text.includes('同班朋友'));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
    configurable: true, value: {writeText: async text => {window.__ep10Copied = text;}}
  }));
  await page.locator('[data-prompt-copy]').click();
  assert.equal(await page.evaluate(() => window.__ep10Copied), text);
  await page.emulateMedia({media: 'print'});
  assert.equal(await page.locator('[name=ep10-feelings]').count(), 9);
  assert.equal(await page.locator('[name=ep10-judgment]').count(), 5);
  for (const field of await page.locator('.answer-field').all()) assert(await field.isVisible());
  await page.emulateMedia({media: 'screen'});
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-clear]').click();
  await page.reload();
  assert.equal(await page.locator('input:checked').count(), 0);
  assert(await page.locator('input[type=text],textarea').evaluateAll(nodes => nodes.every(n => n.value === '')));
  assert.equal((await prompt.innerText()).match(/【[^】]+】/g).length, 18);
}

module.exports = {testEp10Interactions};
