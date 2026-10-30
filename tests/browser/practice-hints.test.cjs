const assert = require('node:assert/strict');

async function testPracticeHints(page, base) {
  await page.goto(base + '/worksheets/EP127/');
  const hints = page.locator('details[data-practice-hint]');
  const prompt = page.locator('[data-prompt-text]');
  assert.equal(await hints.count(), 4);
  assert.equal(await hints.locator('[open]').count(), 0);
  assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-configured'), 'true');
  assert.equal((await prompt.innerText()).match(/【[^】]+】/g).length, 4);
  const { worksheetContentIssues, worksheetContentIssuesFromMarkdown } = require('../../scripts/check/rules/worksheet-content-check.cjs');
  assert.deepEqual(await worksheetContentIssues(page, 'EP127'), [], '收合內容仍須與有效稿雙向一致');
  const contentFixture = await page.context().browser().newPage();
  try {
    const markdown = '可見題目\n\n接話提示\n\n原始隱藏提示內容';
    await contentFixture.setContent('<main><p>可見題目</p><details data-practice-hint><summary>接話提示</summary><p>原始隱藏提示內容</p></details></main>');
    const contentIssues = () => worksheetContentIssuesFromMarkdown(contentFixture, markdown, 'practice-hint-fixture.md');
    assert.deepEqual(await contentIssues(), [], '獨立測試資料的收合內容須與有效稿一致');
    await contentFixture.locator('details p').evaluate(node => { node.textContent = '錯誤的隱藏提示內容'; });
    const corrupted = await contentIssues();
    assert(corrupted.some(issue => issue.includes('HTML 文字未出現在修訂稿')), '不得忽略提示中無據新增的文字');
    assert(corrupted.some(issue => issue.includes('修訂稿文字未出現在 HTML')), '不得忽略收合提示中的漏文');
  } finally { await contentFixture.close(); }
  for (let i=0; i<4; i++) {
    await page.locator(`#ep127-reply-${i+1}`).fill(`接話練習${i+1}：想了解課堂的不同部分。`);
    await hints.nth(i).locator('summary').click();
    assert.equal(await hints.nth(i).getAttribute('open'), '');
    assert.equal(await hints.nth(i).locator('.example-note').isVisible(), true);
  }
  await page.locator('#ep127-occasion').fill('迎新場合一');
  await page.locator('#ep127-shared-context').fill('共同事物二');
  for (const [group,key] of [['school','school-other'],['activity','activity-other'],['weather','weather-other'],['transport','transport-other'],['task','task-other']]) {
    await page.locator(`#ep127-${group}-1`).check();
    await page.locator(`#ep127-${key}`).fill(`${group}其他內容`);
    assert(!(await prompt.innerText()).includes(`${group}其他內容`), '未勾其他不得帶入');
    await page.locator(`#ep127-${key}-toggle`).check();
    assert((await prompt.innerText()).includes(`${group}其他內容`));
  }
  await page.locator('#ep127-topic-other').fill('自訂類別三');
  await page.locator('#ep127-topic-other-opening').fill('自訂開口四');
  await page.locator('#ep127-private-1').check();
  await page.locator('#ep127-private-other').fill('私人界線五');
  assert(!(await prompt.innerText()).includes('私人界線五'));
  await page.locator('#ep127-private-other-toggle').check();
  const complete = await prompt.innerText();
  for (const text of ['迎新場合一','共同事物二','自訂類別三','自訂開口四','私人界線五']) assert(complete.includes(text));
  assert(!complete.includes('【'));
  await page.reload();
  assert.equal(await page.locator('#ep127-reply-4').inputValue(), '接話練習4：想了解課堂的不同部分。');
  assert.equal(await page.locator('details[data-practice-hint][open]').count(), 0);
  assert.equal(await prompt.innerText(), complete);
  await page.locator('#ep127-occasion').fill('更改後場合');
  assert((await prompt.innerText()).includes('更改後場合'));
  assert(!(await prompt.innerText()).includes('迎新場合一'));
  await page.locator('#ep127-private-other-toggle').uncheck();
  assert(!(await prompt.innerText()).includes('私人界線五'));
  await page.locator('#ep127-private-other-toggle').check();
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__practiceCopied=text;}}}));
  await page.locator('[data-prompt-copy]').click();
  assert.equal(await page.evaluate(()=>window.__practiceCopied),await prompt.innerText());
  await hints.nth(0).locator('summary').click();
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.locator('details[data-practice-hint][open]').count(),4);
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.locator('details[data-practice-hint][open]').count(),1);
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('[data-clear]').click();
  assert.equal(await page.locator('details[data-practice-hint][open]').count(),1);
  assert.equal(await page.locator('#ep127-occasion').inputValue(),'更改後場合');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-clear]').click();
  assert.equal(await page.locator('input:checked').count(),0);
  assert.equal(await page.locator('details[data-practice-hint][open]').count(),0);
  assert.equal(await page.locator('input[type=text]').evaluateAll(inputs=>inputs.every(input=>!input.value)),true);
  assert.equal((await prompt.innerText()).match(/【[^】]+】/g).length,4);
  await page.locator('[data-prompt-copy]').click();
  assert.equal(await page.evaluate(()=>window.__practiceCopied),await prompt.innerText());
  await page.reload();
  assert.equal(await page.locator('#ep127-occasion').inputValue(),'');
  await page.emulateMedia({media:'print'});
  assert.equal(await hints.nth(0).locator('.example-note').isVisible(),true,'收合提示仍須可列印');
  await page.emulateMedia({media:'screen'});
}

module.exports = { testPracticeHints };
