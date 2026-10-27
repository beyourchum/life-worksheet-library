const assert = require('node:assert/strict');

async function testExclusiveChoices(page, base) {
  for (const ep of ['EP70', 'EP100']) {
    await page.goto(`${base}/worksheets/${ep}/`);
    for (const group of await page.locator('.choices:has([data-exclusive-choice])').all()) {
      const ordinary = group.locator('input[type=checkbox]:not([data-exclusive-choice])');
      const exclusive = group.locator('[data-exclusive-choice]');
      await ordinary.nth(0).check();
      await ordinary.nth(1).check();
      assert.equal(await ordinary.evaluateAll(inputs => inputs.filter(input => input.checked).length), 2);
      await exclusive.check();
      assert.equal(await ordinary.evaluateAll(inputs => inputs.filter(input => input.checked).length), 0);
      await page.reload();
      assert.equal(await exclusive.isChecked(), true);
      await ordinary.nth(0).check();
      assert.equal(await exclusive.isChecked(), false);
      await ordinary.nth(1).check();
      await page.reload();
      assert.equal(await ordinary.evaluateAll(inputs => inputs.filter(input => input.checked).length), 2);
      await ordinary.nth(0).uncheck();
      await ordinary.nth(1).uncheck();
      assert.equal(await group.locator(':checked').count(), 0);
    }
    await page.locator('[data-exclusive-choice]').first().check();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-clear]').click();
    assert.equal(await page.locator('input:checked').count(), 0);
    await page.reload();
    assert.equal(await page.locator('input:checked').count(), 0);
  }
}

module.exports = { testExclusiveChoices };
