const assert = require('node:assert/strict');

async function testEp95Calculator(page) {
  const fill = (id, value) => page.locator('#' + id).fill(value);
  const value = id => page.locator('#' + id).inputValue();
  assert.equal(await value('ep95-rate'), '');
  await page.locator('#ep95-intensity-60').check();
  assert.equal(await value('ep95-range'), '');
  await fill('ep95-age', '20');
  assert.equal(await value('ep95-rate'), '200');
  assert.equal(await value('ep95-range'), '120～140');
  for (const [choice, expected] of [[70, '140～160'], [50, '100～120'], [60, '120～140']]) {
    await page.locator('#ep95-intensity-' + choice).check();
    assert.equal(await value('ep95-range'), expected);
  }
  await fill('ep95-next-percent', '60');
  assert.equal(await value('ep95-target-rate'), '120');
  await fill('ep95-age', '21');
  assert.equal(await value('ep95-range'), '119～139');
  assert.equal(await value('ep95-target-rate'), '119');
  await fill('ep95-next-percent', '65.5');
  assert.equal(await value('ep95-target-rate'), '130');
  await fill('ep95-next-minutes', '30');
  await fill('ep95-next-sport', '散步');
  await page.reload();
  assert.equal(await value('ep95-age'), '21');
  assert.equal(await value('ep95-target-rate'), '130');
  assert.equal(await value('ep95-next-sport'), '散步');
  for (const invalid of ['0', '-1', '121', '20.5', '']) {
    await fill('ep95-age', invalid);
    for (const id of ['ep95-rate', 'ep95-range', 'ep95-target-rate']) assert.equal(await value(id), '');
  }
  await fill('ep95-age', '20');
  for (const invalid of ['0', '-1', '101', '']) {
    await fill('ep95-next-percent', invalid);
    assert.equal(await value('ep95-target-rate'), '');
  }
  await fill('ep95-next-percent', '0.5');
  assert.equal(await value('ep95-target-rate'), '1');
  await fill('ep95-next-percent', '60');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('[data-clear]').click();
  assert.equal(await value('ep95-target-rate'), '120');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-clear]').click();
  for (const id of ['ep95-age', 'ep95-rate', 'ep95-range', 'ep95-next-percent', 'ep95-target-rate']) assert.equal(await value(id), '');
  await page.reload();
  assert.equal(await value('ep95-rate'), '');
  // Previous combined answers stay available after splitting the fields.
  await page.evaluate(() => sessionStorage.setItem('worksheet:EP95:draft-v1', JSON.stringify({'ep95-next': {value:'下週散步 30 分鐘，60%'}})));
  await page.reload();
  assert.equal(await value('ep95-next'), '下週散步 30 分鐘，60%');
  assert(await page.locator('#ep95-legacy').isVisible());
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-clear]').click();
  assert(await page.locator('#ep95-legacy').isHidden());
}

module.exports = { testEp95Calculator };
