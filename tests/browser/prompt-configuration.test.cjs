const fs = require('node:fs');
const assert = require('node:assert/strict');

async function testPromptConfiguration(page, base) {
  const original = fs.readFileSync('assets/worksheet.js', 'utf8');
  const cases = [
    { ep: 'EP101', from: '["#task-deadline", "#task-unknown"]', to: '["#task-deadline", "#missing-audit-field"]' },
    { ep: 'EP101', from: '["#task-deadline", "#task-unknown"]', to: '["#task-deadline", "#["]' },
    { ep: 'EP113', from: '{ manual: "前文沒有要求讀者填寫煩惱" }', to: '{ manual: "   " }' },
  ];
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on('pageerror', onError);
  try {
    for (const test of cases) {
      const script = original.replace(test.from, test.to);
      assert.notEqual(script, original, '負向案例必須確實改變設定');
      await page.route('**/assets/worksheet.js', (route) => route.fulfill({ contentType: 'text/javascript', body: script }));
      try {
        await page.goto(`${base}/worksheets/${test.ep}/`);
        assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-configured'), 'false');
        assert.match(await page.locator('[data-prompt-text]').innerText(), /【[^】]+】/);
      } finally { await page.unroute('**/assets/worksheet.js'); }
    }
    assert.deepEqual(errors, [], '設定錯誤須被標記，不能讓作答程式崩潰');
  } finally { page.off('pageerror', onError); }
}

module.exports = { testPromptConfiguration };
