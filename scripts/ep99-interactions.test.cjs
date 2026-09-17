const assert = require('node:assert/strict');

async function testEp99Interactions(page, base) {
  await page.goto(base + '/worksheets/EP99/');
  const choices = page.locator('[data-need-choice]');
  assert.equal(await choices.count(), 36);
  assert.equal(await page.locator('#ep99-match-a-1').isDisabled(), true);
  await page.locator('[data-rank-key="growth"] [data-move="-1"]').click();
  await page.locator('[data-rank-key="growth"] [data-move="-1"]').click();
  await page.locator('[data-confirm-ranking]').click();
  assert.deepEqual(await page.locator('[data-top-need]').allTextContents(), ['成長感', '生活作息', '意義感']);
  // The limit spans both pages and includes the custom "other" choices.
  for (const index of [0, 1, 2, 3, 4, 5, 25, 26, 27, 35]) await choices.nth(index).check();
  assert.equal(await page.locator('[data-need-choice]:checked').count(), 10);
  assert.equal(await choices.nth(6).isDisabled(), true);
  assert.equal(await choices.nth(35).isEnabled(), true);
  await page.reload();
  assert.equal(await choices.nth(6).isDisabled(), true);
  await choices.nth(0).uncheck();
  await choices.nth(6).check();
  assert.equal(await page.locator('[data-need-choice]:checked').count(), 10);
  // Comparison answers have no ten-choice limit.
  await page.locator('#ep99-match-a-1').check();
  assert.equal(await page.locator('[data-need-choice]:checked').count(), 10);
  await page.locator('#ep99-job-a').fill('行政助理');
  await page.reload();
  assert.equal(await page.locator('#ep99-job-a').inputValue(), '行政助理');
  assert.equal(await page.locator('#ep99-match-a-1').isChecked(), true);
  // Reordering must move the comparison with its category, including off-screen ranks.
  await page.locator('[data-rank-key="growth"] [data-move="1"]').click();
  assert.equal(await page.locator('#ep99-match-a-1').isDisabled(), true);
  await page.locator('[data-confirm-ranking]').click();
  assert.equal(await page.locator('#ep99-match-a-1').isChecked(), false);
  assert.equal(await page.locator('#ep99-match-a-2').isChecked(), true);
  for (let i = 0; i < 2; i++) await page.locator('[data-rank-key="growth"] [data-move="1"]').click();
  await page.locator('[data-confirm-ranking]').click();
  await page.reload();
  await page.locator('[data-rank-key="growth"] [data-move="-1"]').click();
  await page.locator('[data-confirm-ranking]').click();
  assert.equal(await page.locator('#ep99-match-a-3').isChecked(), true);
  // Native buttons also support keyboard sorting on the narrow layout.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-rank-key="growth"] [data-move="-1"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-confirm-ranking]').click();
  assert.equal(await page.locator('#ep99-match-a-2').isChecked(), true);
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('[data-rank-key="growth"] [data-move="-1"]').isVisible(), false);
  assert.equal(await page.locator('[data-top-need="2"]').textContent(), '成長感');
  await page.emulateMedia({ media: 'screen' });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-clear]').click();
  assert.equal(await page.locator('[data-need-choice]:disabled').count(), 0);
  assert.equal(await page.locator('[data-need-choice]:checked').count(), 0);
  assert.equal(await page.locator('#ep99-ranking').inputValue(), '');
  assert.equal(await page.locator('#ep99-matches').inputValue(), '');
  assert.equal(await page.locator('#ep99-match-a-1').isDisabled(), true);
  assert.deepEqual(await page.locator('[data-rank-key]').evaluateAll(rows => rows.map(row => row.dataset.rankKey)), ['life','meaning','growth','resource','relation','space']);
  await page.evaluate(() => sessionStorage.setItem('worksheet:EP99:draft-v1', JSON.stringify({ 'ep99-order': { value: '舊排序原文' } })));
  await page.reload();
  assert.equal(await page.locator('#ep99-legacy-order').isVisible(), true);
  assert.equal(await page.locator('#ep99-order').inputValue(), '舊排序原文');
}
module.exports = { testEp99Interactions };
