const assert = require('node:assert/strict');

async function testPromptAutofill(page, base, ep) {
  await page.emulateMedia({media:'screen'});
  await page.setViewportSize({width:1280,height:900});
  if (!ep || ep === 'EP48') {
    await page.goto(base + '/worksheets/EP48/');
    const quotes = page.locator('.prompt-quote');
    assert.equal(await quotes.count(), 2, 'EP48 的兩份提示詞須分開');
    assert.equal(await page.locator('[data-prompt-copy]').count(), 2);
    for (const quote of await quotes.all()) assert.equal(await quote.getAttribute('data-prompt-configured'), 'true');
    const first = quotes.nth(0).locator('[data-prompt-text]');
    const second = quotes.nth(1).locator('[data-prompt-text]');
    const originalSecond = await second.innerText();
    assert(originalSecond.includes('【請自行填寫：抽象任務】'));
    assert((await first.innerText()).includes('【卡住的任務】'));
    await page.locator('#ep48-w2-task').fill('準備期末報告');
    assert((await first.innerText()).includes('準備期末報告'));
    assert.equal(await second.innerText(), originalSecond, '第二份人工欄位不得誤用第一份的答案');
    await page.reload();
    assert((await first.innerText()).includes('準備期末報告'));
    await page.locator('#ep48-w2-task').fill('整理社團活動流程');
    const changed = await first.innerText();
    assert(changed.includes('整理社團活動流程') && !changed.includes('準備期末報告'));
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: {writeText: async text => {window.__copiedPrompt=text;}}
    }));
    for (const [index, expected] of [[0,changed],[1,originalSecond]]) {
      await quotes.nth(index).locator('[data-prompt-copy]').click();
      assert.equal(await page.evaluate(()=>window.__copiedPrompt), expected, `第 ${index+1} 個按鈕只能複製自己的內容`);
    }
    page.once('dialog', dialog=>dialog.accept());
    await page.locator('[data-clear]').click();
    assert((await first.innerText()).includes('【卡住的任務】'));
    assert.equal(await second.innerText(), originalSecond);
    await quotes.nth(0).locator('[data-prompt-copy]').click();
    assert.equal(await page.evaluate(()=>window.__copiedPrompt), await first.innerText());
    // A later prompt with an automatic source must use its own binding slice.
    const script = require('node:fs').readFileSync('assets/worksheet.js','utf8');
    const manual = '{ manual: "原稿只有固定練習案例，未要求另填一個抽象任務；請在提示詞中自行補上。" }';
    assert(script.includes(manual));
    await page.route('**/assets/worksheet.js',route=>route.fulfill({contentType:'text/javascript',body:script.replace(manual,'["#ep48-end-task"]')}));
    try {
      await page.reload();
      await page.locator('#ep48-w2-task').fill('第一份任務');
      await page.locator('#ep48-end-task').fill('第二份任務');
      assert((await first.innerText()).includes('第一份任務'));
      assert(!(await first.innerText()).includes('第二份任務'));
      assert((await second.innerText()).includes('第二份任務'));
      assert(!(await second.innerText()).includes('第一份任務'));
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable:true,value:{writeText:async text=>{window.__copiedPrompt=text;}}}));
      await quotes.nth(1).locator('[data-prompt-copy]').click();
      assert.equal(await page.evaluate(()=>window.__copiedPrompt), await second.innerText());
    } finally { await page.unroute('**/assets/worksheet.js'); }
  }
  if (!ep || ep === 'EP101') {
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

  await page.reload();
  assert((await page.locator('[data-prompt-text]').innerText()).includes('整理分組報告'), '重新整理後沒有從暫存作答還原提示詞');
  await page.locator('#task-name').fill('完成期末簡報');
  const updated = await page.locator('[data-prompt-text]').innerText();
  assert(updated.includes('完成期末簡報'), '修改作答後提示詞沒有立即更新');
  assert(!updated.includes('整理分組報告'), '修改作答後提示詞仍保留舊答案');

  await page.evaluate(() => {
    window.__copiedPrompt = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.__copiedPrompt = text; } }
    });
  });
  await page.locator('[data-prompt-copy]').click();
  assert.equal(await page.evaluate(() => window.__copiedPrompt), updated, '複製結果與畫面提示詞不一致');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-clear]').click();
  const cleared = await page.locator('[data-prompt-text]').innerText();
  assert(cleared.includes('【任務名稱】'), '清除作答後沒有恢復原括號提示');
  assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-status'), '已自動代入 0／6 項；未作答處保留括號提示。');
  }

  if (!ep || ep === 'EP87') {
  await page.goto(base + '/worksheets/EP87/');
  await page.locator('#ep87-a3').check();
  await page.locator('#ep87-focus-b').check();
  await page.locator('#ep87-action-3').check();
  const choices = await page.locator('[data-prompt-text]').innerText();
  assert(choices.includes('拿不定未來方向'), '單選描述沒有代入提示詞');
  assert(choices.includes('拖延與自律'), '焦點選項沒有代入提示詞');
  assert(choices.includes('做10分鐘任務'), '行動選項沒有代入提示詞');
  assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-status'), '已自動代入 3 項作答。');
  }

  if (!ep || ep === 'EP113') {
  await page.goto(base + '/worksheets/EP113/');
  assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-status'), '已自動代入 0／3 項；未作答處保留括號提示。');
  assert((await page.locator('[data-prompt-text]').innerText()).includes('【請自行填寫：我的選擇困難】'), '沒有對應作答時應保留提示');
  }

  if (!ep || ep === 'EP82') {
  await page.goto(base + '/worksheets/EP82/');
  assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-configured'), 'true');
  await page.locator('#ep82-recipient-friend').check();
  await page.locator('#ep82-gift').fill('保溫杯');
  await page.locator('input[name="ep82-useful-1"]').first().check();
  await page.locator('input[name="ep82-fun-1"]').first().check();
  await page.locator('input[name="ep82-private-1"]').first().check();
  await page.locator('#ep82-result-send').check();
  await page.locator('#ep82-fit').fill('對方最近剛好需要');
  await page.locator('#ep82-watch').fill('還要確認容量');
  const giftPrompt = await page.locator('[data-prompt-text]').innerText();
  for (const answer of ['朋友', '保溫杯', '實用：對方目前會用到', '娛樂：有明確喜好線索', '私密：親密程度合適', '可以送', '對方最近剛好需要', '還要確認容量'])
    assert(giftPrompt.includes(answer), `EP82 提示詞沒有代入：${answer}`);
  assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-status'), '已自動代入 8 項作答。');
  }
}

module.exports = { testPromptAutofill };
