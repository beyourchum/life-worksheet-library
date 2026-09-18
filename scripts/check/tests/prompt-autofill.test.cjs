const assert = require('node:assert/strict');

async function testPromptAutofill(page, base) {
  await page.goto(base + '/worksheets/EP101/');
  await page.locator('#task-name').fill('整理分組報告');
  await page.locator('#task-result').fill('交出三頁摘要');
  await page.locator('#task-deadline').fill('星期五下午五點');
  await page.locator('#task-role').fill('我負責統整，和兩位組員合作');
  await page.locator('#stuck').fill('不知道怎麼合併格式');
  await page.locator('#tried').fill('已經建立共同文件');
  const complete = await page.locator('[data-prompt-text]').innerText();
  for (const answer of ['整理分組報告', '交出三頁摘要', '星期五下午五點', '我負責統整，和兩位組員合作', '不知道怎麼合併格式', '已經建立共同文件']) {
    assert(complete.includes(answer), `提示詞沒有代入：${answer}`);
  }
  assert(!complete.includes('【填入'), '全部作答後仍留下待填提示');
  assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-status'), '已自動代入 6 項作答。');

  await page.goto(base + '/worksheets/EP87/');
  await page.locator('#ep87-a3').check();
  await page.locator('#ep87-focus-b').check();
  await page.locator('#ep87-action-3').check();
  const choices = await page.locator('[data-prompt-text]').innerText();
  assert(choices.includes('拿不定未來方向'), '單選描述沒有代入提示詞');
  assert(choices.includes('拖延與自律'), '焦點選項沒有代入提示詞');
  assert(choices.includes('做10分鐘任務'), '行動選項沒有代入提示詞');
  assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-status'), '已自動代入 3 項作答。');

  await page.goto(base + '/worksheets/EP113/');
  assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-status'), '已自動代入 0／3 項；未作答處保留括號提示。');
  assert((await page.locator('[data-prompt-text]').innerText()).includes('【填入你的煩惱】'), '沒有對應作答時應保留提示');
}

module.exports = { testPromptAutofill };
