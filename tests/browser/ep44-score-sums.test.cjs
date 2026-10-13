const assert = require('node:assert/strict');

async function testEp44ScoreSums(page, base) {
  await page.goto(base + '/worksheets/EP44/');
  const value = (id) => page.locator('#' + id).inputValue();
  const fill = (id, text) => page.locator('#' + id).fill(text);
  const oneScores = ['ep44-w2-one-score-1', 'ep44-w2-one-score-2', 'ep44-w2-one-score-3'];
  const twoScores = ['ep44-w2-two-score-1', 'ep44-w2-two-score-2', 'ep44-w2-two-score-3'];

  assert.equal(await page.locator('#ep44-w2-one-total').getAttribute('readonly'), '');
  assert.equal(await page.locator('#ep44-w2-two-total').getAttribute('readonly'), '');
  for (const id of [...oneScores, ...twoScores]) await fill(id, '');
  assert.equal(await value('ep44-w2-one-total'), '');

  await fill(oneScores[0], '4');
  await fill(oneScores[1], '3');
  assert.equal(await value('ep44-w2-one-total'), '');
  await fill(oneScores[2], '5');
  assert.equal(await value('ep44-w2-one-total'), '12');

  for (const [id, score] of twoScores.map((id, index) => [id, String(index + 1)])) await fill(id, score);
  assert.equal(await value('ep44-w2-two-total'), '6');
  await fill(twoScores[1], '6');
  assert.equal(await value('ep44-w2-two-total'), '');
  await fill(twoScores[1], '5');
  assert.equal(await value('ep44-w2-two-total'), '9');

  await page.reload();
  assert.equal(await value('ep44-w2-one-total'), '12');
  assert.equal(await value('ep44-w2-two-total'), '9');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-clear]').click();
  assert.equal(await value('ep44-w2-one-total'), '');
  assert.equal(await value('ep44-w2-two-total'), '');
}

module.exports = { testEp44ScoreSums };
