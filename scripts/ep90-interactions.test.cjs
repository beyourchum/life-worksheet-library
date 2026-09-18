const assert = require('node:assert/strict');
async function testEp90Interactions(page, base) {
  await page.goto(base + '/worksheets/EP90/');
  const facts = page.locator('[data-facts] input[type="checkbox"]');
  assert.equal(await facts.count(), 5);
  await facts.nth(0).check();
  await facts.nth(4).check();
  assert.equal(await facts.nth(1).isDisabled(), true);
  await facts.nth(1).click({ force: true });
  assert.equal(await page.locator('[data-facts] :checked').count(), 2);
  await page.locator('#ep90-fact-other-text').fill('組員有備份檔');
  await page.reload();
  assert.equal(await facts.nth(1).isDisabled(), true);
  assert.equal(await page.locator('#ep90-fact-other-text').inputValue(), '組員有備份檔');
  await facts.nth(0).uncheck();
  await facts.nth(1).check();
  assert.equal(await page.locator('[data-facts] :checked').count(), 2);
  for (const group of ['fear', 'phrase', 'after']) {
    await page.locator(`#ep90-${group}-1`).check();
    await page.locator(`#ep90-${group}-2`).check();
    await page.locator(`#ep90-${group}-other`).check();
    assert.equal(await page.locator(`#ep90-${group}-1`).isChecked(), true);
  }
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('[data-clear]').click();
  assert.equal(await page.locator('[data-facts] :checked').count(), 2);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-clear]').click();
  assert.equal(await page.locator('main :checked').count(), 0);
  assert.equal(await page.locator('[data-facts] input:disabled').count(), 0);
  assert.equal(await facts.nth(0).isEnabled(), true);
  assert.equal(await page.locator('#ep90-fact-other-text').inputValue(), '');
  await facts.nth(2).check();
  await facts.nth(3).check();
  assert.equal(await facts.nth(4).isDisabled(), true);
}
module.exports = { testEp90Interactions };
