const assert = require('node:assert/strict');

async function selectToLimit(page, selector, maximum) {
  const choices = page.locator(selector);
  assert(await choices.count() > maximum, `${selector}: 選項不足以驗證上限`);
  for (let index = 0; index < maximum; index++) await choices.nth(index).check();
  assert.equal(await page.locator(selector + ':checked').count(), maximum);
  assert.equal(await choices.nth(maximum).isDisabled(), true);
  await choices.nth(maximum).click({ force: true });
  assert.equal(await page.locator(selector + ':checked').count(), maximum);
}

async function testSharedChoiceLimits(page, base) {
  await page.goto(base + '/worksheets/EP103/');
  await selectToLimit(page, '[data-limited-choice="ep103-signals"]', 4);
  await page.reload();
  assert.equal(await page.locator('[data-limited-choice="ep103-signals"]:checked').count(), 4);
  assert.equal(await page.locator('[data-limited-choice="ep103-signals"]').nth(4).isDisabled(), true);

  await page.goto(base + '/worksheets/EP106/');
  for (let group = 1; group <= 5; group++) {
    await selectToLimit(page, `[data-limited-choice="ep106-group-${group}"]`, 3);
  }
  const unlimited = page.locator('input[name="group-6"]');
  for (let index = 0; index < await unlimited.count(); index++) await unlimited.nth(index).check();
  assert.equal(await page.locator('input[name="group-6"]:checked').count(), await unlimited.count());
  await page.reload();
  for (let group = 1; group <= 5; group++) {
    const choices = page.locator(`[data-limited-choice="ep106-group-${group}"]`);
    assert.equal(await page.locator(`[data-limited-choice="ep106-group-${group}"]:checked`).count(), 3);
    assert.equal(await choices.nth(3).isDisabled(), true);
  }
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-clear]').click();
  assert.equal(await page.locator('[data-limited-choice]:checked').count(), 0);
  assert.equal(await page.locator('[data-limited-choice]:disabled').count(), 0);

  await page.goto(base + '/worksheets/EP14/');
  assert.equal(await page.getByRole('heading', { name: '請選出你的回答：', exact: true }).count(), 0,
    '說明段落與選項之間已有題型標題時，不得再插入通用標題');
  for (let row = 1; row <= 9; row++) {
    const name = 'ep14-w2-signal-' + String(row).padStart(2, '0');
    for (const state of ['yes', 'unknown', 'no']) {
      await page.locator('#' + name + '-' + state).check();
      assert.equal(await page.locator('input[name="' + name + '"]:checked').count(), 1);
    }
  }
  assert.equal(await page.locator('input[name^="ep14-w2-signal-"]:checked').count(), 9);
  await selectToLimit(page, '[data-limited-choice="ep14-w3-pause"]', 3);
  await page.reload();
  assert.equal(await page.locator('[data-limited-choice="ep14-w3-pause"]:checked').count(), 3);
  await page.locator('#ep14-w3-pause-screen').uncheck();
  assert.equal(await page.locator('#ep14-w3-pause-unknown').isDisabled(), false);
  await page.locator('#ep14-w3-pause-unknown').check();
  assert.equal(await page.locator('[data-limited-choice="ep14-w3-pause"]:checked').count(), 1);
  await page.locator('#ep14-w3-pause-body').check();
  assert.equal(await page.locator('#ep14-w3-pause-unknown').isChecked(), false);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-clear]').click();
  assert.equal(await page.locator('[data-limited-choice]:disabled').count(), 0);
  assert.equal(await page.locator('input:checked').count(), 0);
}

module.exports = { testSharedChoiceLimits };
