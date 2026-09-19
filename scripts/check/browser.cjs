const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./server.cjs');
const root = path.resolve(__dirname, '../..');
process.chdir(root);

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('用法：node scripts/check/browser.cjs (--built | --source)');
  console.log('  --built   檢查既有 _site 發布產物');
  console.log('  --source  直接檢查專案來源；不代表發布產物已通過');
  process.exit(0);
}
const unknownArgs = args.filter((arg) => !['--built', '--source'].includes(arg));
if (unknownArgs.length || Number(args.includes('--built')) + Number(args.includes('--source')) !== 1) {
  const detail = unknownArgs.length ? `未知參數：${unknownArgs.join(', ')}。` : '必須且只能指定一個檢查目標。';
  throw new Error(`${detail} 使用 --built 檢查 _site，或使用 --source 檢查專案來源。`);
}
const browserTarget = args.includes('--built') ? path.join(root, '_site') : root;
if (args.includes('--built') && !fs.existsSync(browserTarget)) {
  throw new Error('_site 不存在；請先執行 pnpm run build，再執行 pnpm run check:browser。');
}
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const policy = read('config/quality-policy.json');
const qualityExceptions = read('config/quality-exceptions.json');
const manifest = read('assets/fonts/worksheet/compact/manifest.json');
const items = read('catalog/worksheets.json');
const report = { checks: [], failures: [] };
const output = path.join(root, '.qa/reports');
fs.mkdirSync(output, { recursive: true });

async function fontIssues(page, scope) {
  const exceptions = qualityExceptions.fontFallbackExceptions;
  const issues = await page.evaluate(({ fonts, exceptions, scope }) => {
    const names = { 'Glow Sans TC': 'glow-800', 'Genki Gothic TC': 'genki-700' };
    const coverage = Object.fromEntries(Object.entries(fonts).map(([key, value]) => [key, new Set(value.characters)]));
    const issues = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!el.getClientRects().length || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
      const style = getComputedStyle(el);
      const family = style.fontFamily.split(',')[0].replaceAll('"', '').trim();
      const font = family === 'GenYo Gothic TC' ? `genyo-${Number(style.fontWeight) >= 600 ? 700 : 400}` : names[family];
      if (!font) continue;
      for (const character of new Set(node.textContent)) {
        if (!/\p{Script=Han}/u.test(character) || coverage[font]?.has(character.codePointAt(0))) continue;
        const text = node.textContent.trim();
        if (exceptions.some((e) => e.scope === scope && e.font === font && e.character === character && e.text === text && e.reason)) continue;
        issues.push({ scope, font, character, text });
      }
    }
    return issues;
  }, { fonts: manifest.scopes[scope].fonts, exceptions, scope });
  return issues;
}

async function printMetrics(page) {
  return page.locator('.worksheet .page').evaluateAll((pages) => pages.map((page, index) => {
    const rect = page.getBoundingClientRect();
    const footer = page.querySelector('.page-footer').getBoundingClientRect();
    const bottom = Math.max(...[...page.children].filter((el) => !el.matches('.page-footer')).map((el) => el.getBoundingClientRect().bottom));
    return { page: index + 1, width: rect.width, height: rect.height, scrollHeight: page.scrollHeight, clientHeight: page.clientHeight, footerGap: footer.top - bottom };
  }));
}
function checkPrint(metrics, name) {
  assert(metrics.length, `${name}: 缺少頁面`);
  for (const metric of metrics) {
    assert(Math.abs(metric.width - policy.print.pageWidthPx) < 2 && Math.abs(metric.height - policy.print.pageHeightPx) < 2, `${name} 第 ${metric.page} 頁不是 A4`);
    assert(metric.scrollHeight <= metric.clientHeight + 2, `${name} 第 ${metric.page} 頁內容溢出`);
    assert(metric.footerGap >= policy.print.footerGapPx, `${name} 第 ${metric.page} 頁壓到頁尾（間距 ${metric.footerGap.toFixed(1)} px）`);
  }
}
async function withinFontBudget(page, home) {
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.endsWith('.woff2')).map((r) => ({ name: r.name, bytes: r.encodedBodySize })));
  assert(resources.length <= policy.budgets[home ? 'homeFontRequests' : 'worksheetFontRequests'], '字型請求數超標');
  assert(resources.reduce((sum, r) => sum + r.bytes, 0) <= policy.budgets[home ? 'homeFontBytes' : 'worksheetFontBytes'], '字型流量超標');
  assert(resources.every((r) => r.name.includes('/compact/')), '載入了原始大型字型');
  return resources;
}

(async () => {
  const { server, base } = await start(browserTarget);
  let browser;
  try { browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) }); }
  catch (error) { server.close(); throw error; }
  const errors = [];
  const record = async (name, fn) => {
    try { const detail = await fn(); report.checks.push({ name, detail }); console.log(`PASS ${name}`); }
    catch (error) { report.failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
  };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await record('題型、填寫欄與句中範例負向測試', async () => {
      const fixture = await browser.newPage();
      try { await require('./tests/worksheet-style-check.test.cjs').testWorksheetStyles(fixture); }
      finally { await fixture.close(); }
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await record('EP90 兩項上限、其他、暫存與清除', async () => {
      const fixture = await browser.newPage();
      try { await require('./tests/ep90-interactions.test.cjs').testEp90Interactions(fixture, base); }
      finally { await fixture.close(); }
    });
    await record('冒號選項分層排版與句尾冒號保留', async () => {
      const fixture = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        await fixture.goto(`${base}/worksheets/EP90/`);
        const firstChoice = fixture.locator('label[for="ep90-fear-1"]');
        assert.equal(await firstChoice.locator('.choice-title').innerText(), '全場焦點恐懼');
        assert.match(await firstChoice.locator('.choice-copy').innerText(), /^全場焦點恐懼\n覺得台下所有人/);
        assert.equal(await firstChoice.locator('.choice-copy br').count(), 1);
        assert(
          await firstChoice.evaluate((element) => {
            const title = Number.parseFloat(getComputedStyle(element.querySelector('.choice-title')).fontSize);
            const detail = Number.parseFloat(getComputedStyle(element.querySelector('.choice-copy')).fontSize);
            return title > detail;
          }),
          '冒號前標題字級應大於說明文字'
        );
        await fixture.goto(`${base}/worksheets/EP107/`);
        assert.equal(await fixture.locator('label[for="choice-12"] .choice-title').count(), 0, '句尾冒號不應拆成兩層');
      } finally { await fixture.close(); }
    });
    await record('選項括號舉例的共用換行灰字規則', async () => {
      const fixture = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        await fixture.goto(`${base}/worksheets/EP89/`);
        const examples = fixture.locator('.choice-inline-example');
        assert.equal(await examples.count(), 4);
        assert.equal(await fixture.locator('label[for="ep89-skill-a"] .choice-copy').innerText(), '練習一個工作會用到的軟體功能\n例如：Excel／Canva');
        assert.equal(await fixture.locator('label[for="ep89-skill-b"] .choice-copy').innerText(), '找一個線上免費的小課程看 10 分鐘\n例如：YouTube 教學');
        assert(
          await examples.first().evaluate((element) => {
            const style = getComputedStyle(element);
            const parentStyle = getComputedStyle(element.parentElement);
            return style.display === 'block'
              && style.color !== parentStyle.color
              && Number.parseFloat(style.fontSize) < Number.parseFloat(parentStyle.fontSize);
          }),
          '選項舉例應另起一行，並使用較小的灰字'
        );
      } finally { await fixture.close(); }
    });
    await record('EP86 其他選項的勾選與填寫欄保留', async () => {
      const fixture = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        await fixture.goto(`${base}/worksheets/EP86/`);
        const otherChoices = fixture.locator('.choice:has(input[value="其他"]), .choice:has(input[value="未完成"])');
        assert.equal(await otherChoices.count(), 4, '應保留四個其他或自訂回答選項');
        assert.equal(await otherChoices.locator('input[type="checkbox"], input[type="radio"]').count(), 4, '每個其他或自訂回答選項都應保留勾選控制');
        assert.equal(await otherChoices.locator('input[type="text"]').count(), 3, '三個自訂回答選項應保留行內填寫欄');
        const firstOther = fixture.locator('.choice:has(input[name="ep86-situation"][value="其他"])');
        await firstOther.locator('.choice-toggle input').check();
        await firstOther.locator('input[type="text"]').fill('書桌旁的紙袋');
        assert.equal(await firstOther.locator('.choice-toggle input').isChecked(), true, '其他選項應能勾選');
        assert.equal(await firstOther.locator('input[type="text"]').inputValue(), '書桌旁的紙袋', '其他填寫欄應能輸入');
      } finally { await fixture.close(); }
    });
    await record('EP86 困擾選項沿用一般選項樣式', async () => {
      const fixture = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        await fixture.goto(`${base}/worksheets/EP86/`);
        const nestedChoice = fixture.locator('.choice:has(input[name="ep86-impact"])').first();
        const regularChoice = fixture.locator('.choice:has(input[name="ep86-situation"])').first();
        const nestedStyle = await nestedChoice.evaluate((element) => ({
          display: getComputedStyle(element).display,
          fontWeight: getComputedStyle(element).fontWeight
        }));
        const regularStyle = await regularChoice.evaluate((element) => ({
          display: getComputedStyle(element).display,
          fontWeight: getComputedStyle(element).fontWeight
        }));
        assert.deepEqual(nestedStyle, regularStyle, 'answer-field 內的選項應與其他一般選項使用相同排版與字重');
      } finally { await fixture.close(); }
    });
    await record('EP86 五分鐘整理法維持一般選項樣式', async () => {
      const fixture = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        await fixture.goto(`${base}/worksheets/EP86/`);
        const method = fixture.locator('.choice:has(input[name="ep86-method"][value="五分鐘"])');
        await method.locator('input').check();
        assert.equal(await method.evaluate((element) => element.classList.contains('choice-example')), false, '含「例如」的正常選項不應整張套用範例灰字');
        assert.equal(await method.evaluate((element) => getComputedStyle(element).color), 'rgb(18, 20, 18)', '五分鐘整理法文字顏色應與其他方法一致');
        assert.equal(await method.locator('.choice-inline-example').innerText(), '例如：一個收納格、一格書架或桌面的一角。', '句中範例應單獨換行並使用灰字');
      } finally { await fixture.close(); }
    });
    await record('EP103 與 EP106 共用複選上限、暫存與清除', async () => {
      const fixture = await browser.newPage();
      try { await require('./tests/shared-choice-limits.test.cjs').testSharedChoiceLimits(fixture, base); }
      finally { await fixture.close(); }
    });
    await record('EP99 跨頁十項上限、工作比較與暫存', async () => {
      const fixture = await browser.newPage();
      try { await require('./tests/ep99-interactions.test.cjs').testEp99Interactions(fixture, base); }
      finally { await fixture.close(); }
    });
    await record('首頁延遲搜尋、字型預算與手機版', async () => {
      const requests = [];
      page.on('request', (request) => requests.push(request.url()));
      await page.goto(base);
      await page.waitForFunction(() => document.querySelectorAll('.result-row').length > 0);
      assert.equal(await page.locator('#book-answer').getAttribute('aria-hidden'), 'true');
      await page.locator('#open-inspiration').click();
      await page.waitForFunction(() => document.querySelector('#inspiration-book').classList.contains('is-open'));
      assert.notEqual(await page.locator('#book-cover').evaluate((cover) => getComputedStyle(cover).transform), 'none', '封面應以書脊為軸翻開');
      assert.equal(await page.locator('#book-answer').getAttribute('aria-hidden'), 'false');
      assert.match(await page.locator('#inspiration-meta').innerText(), /^EP\d+ · /);
      assert(await page.locator('#inspiration-link').innerText());
      await page.evaluate(() => {
        document.querySelector('#inspiration-link').textContent = '當一個問題需要更多文字才能說清楚時，怎麼保留完整內容又不失去下一步？';
        document.querySelector('#inspiration-summary').textContent = '這是一段刻意加長的摘要，用來確認靈感之書會隨內容長高，不會把下方操作裁掉。即使標題與摘要同時換行，讀者仍然要能看見並操作從這個問題開始與再翻一次。';
      });
      const answerBox = await page.locator('#book-answer').boundingBox();
      const actionsBox = await page.locator('.book-answer-actions').boundingBox();
      assert(answerBox && actionsBox && actionsBox.y + actionsBox.height <= answerBox.y + answerBox.height + 1, '較長靈感內容不應裁掉操作按鈕');
      assert.equal(await page.locator('#inspiration-action').isVisible(), true, '較長靈感內容仍應顯示開始按鈕');
      assert.equal(await page.locator('#another-inspiration').isVisible(), true, '較長靈感內容仍應顯示再翻一次按鈕');
      const firstInspiration = await page.locator('#inspiration-meta').innerText();
      await page.locator('#another-inspiration').click();
      await page.waitForFunction((previous) => document.querySelector('#inspiration-meta').textContent !== previous, firstInspiration);
      assert.notEqual(await page.locator('#inspiration-meta').innerText(), firstInspiration, '再次翻閱應提供不同靈感');
      assert.match(await page.locator('#inspiration-status').innerText(), /^今天的靈感：/);
      assert.equal(await page.locator('.result-row').count(), Math.min(items.length, policy.pageSize));
      assert(!requests.some((url) => url.endsWith('search-index.json')), '未搜尋就載入搜尋索引');
      assert(!requests.some((url) => /\/worksheets\/.*\.html/.test(url)), '首頁預先下載文章全文');
      assert(await page.locator('#categories').evaluate((element) => element.scrollWidth > element.clientWidth), '生活章節應形成可橫向滑動的連續目錄');
      assert.equal(await page.locator('#category-scroll-previous').isDisabled(), true);
      await page.locator('#category-scroll-next').click();
      await page.waitForFunction(() => document.querySelector('#categories').scrollLeft > 0);
      await page.waitForFunction(() => !document.querySelector('#category-scroll-previous').disabled);
      await page.locator('#categories').focus();
      const categoryScrollBeforeKeyboard = await page.locator('#categories').evaluate((element) => element.scrollLeft);
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction((before) => document.querySelector('#categories').scrollLeft > before, categoryScrollBeforeKeyboard);
      const resources = await withinFontBudget(page, true);
      assert.deepEqual(await fontIssues(page, 'home'), []);
      await page.locator('#search-folder > summary').click();
      await page.locator('#search').fill('巔峰');
      await page.waitForFunction(() => document.querySelector('.result-ep')?.textContent === '109');
      assert.equal(requests.filter((url) => url.endsWith('search-index.json')).length, 1);
      await page.locator('#search').fill('挫折');
      await page.waitForTimeout(policy.searchDebounceMs + 100);
      assert(await page.locator('.result-row').count());
      assert.equal(requests.filter((url) => url.endsWith('search-index.json')).length, 1);
      await page.locator('#search').fill('');
      await page.waitForTimeout(policy.searchDebounceMs + 100);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, 'home-desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert(await page.locator('#categories').evaluate((element) => element.scrollWidth > element.clientWidth), '手機版生活章節應可觸控橫向滑動');
      await page.screenshot({ path: path.join(output, 'home-mobile.png'), fullPage: true });
      return resources;
    });

    await record('150 筆分頁、跨頁搜尋、分類、排序與輸入法', async () => {
      const synthetic = Array.from({ length: policy.capacityTestEntries }, (_, i) => {
        const item = items[i % items.length];
        return { ...item, ep: `EP${i + 1}`, title: `${item.title}（${i + 1}）`, summary: item.summary + i,
          searchTerms: Object.fromEntries(Object.entries(item.searchTerms).map(([key, terms]) => [key, terms.map((term) => term + i)])) };
      });
      synthetic[0] = { ...synthetic[0], articleUrl: 'articles/example/', worksheetUrl: undefined };
      synthetic[149].searchTerms = { ...synthetic[149].searchTerms, phrases: ['容量測試唯一詞'] };
      const catalog = { ...read('data/catalog.json'), items: synthetic.map(({ searchTerms, ...item }) => item) };
      const index = { ...read('data/search-index.json'), terms: Object.fromEntries(synthetic.map((item) => [item.ep, item.searchTerms])) };
      assert(Buffer.byteLength(JSON.stringify(catalog)) <= policy.budgets.catalogBytes);
      assert(Buffer.byteLength(JSON.stringify(index)) <= policy.budgets.searchIndexBytes);
      await page.route('**/data/catalog.json', (route) => route.fulfill({ json: catalog }));
      await page.route('**/data/search-index.json', (route) => route.fulfill({ json: index }));
      await page.goto(base);
      await page.waitForFunction(() => document.querySelectorAll('.result-row').length === 12);
      assert.equal(await page.locator('.result-ep').first().innerText(), '150');
      assert.equal(await page.locator('#page-select option').count(), Math.ceil(synthetic.length / policy.pageSize));
      await page.locator('#next-page').click();
      assert.equal(await page.locator('.result-ep').first().innerText(), '138');
      await page.locator('#page-select').selectOption('13');
      assert.equal(await page.locator('.result-row').count(), 6);
      assert.equal(await page.locator('#next-page').isDisabled(), true);
      await page.locator('#sort').selectOption('oldest');
      assert.equal(await page.locator('.result-ep').first().innerText(), '1');
      assert.equal(await page.locator('.result-row').first().locator('.result-title a').getAttribute('href'), 'articles/example/');
      assert.equal(await page.locator('.result-row').first().getByText('學習單', { exact: true }).count(), 0);
      await page.locator('#search-folder > summary').click();
      await page.locator('#search').dispatchEvent('compositionstart');
      await page.locator('#search').fill('容量測試唯一詞');
      await page.waitForTimeout(policy.searchDebounceMs + 80);
      assert.equal(await page.locator('.result-row').count(), 12, '組字中不應搜尋');
      await page.locator('#search').dispatchEvent('compositionend');
      await page.waitForFunction(() => document.querySelectorAll('.result-row').length === 1);
      assert.equal(await page.locator('.result-ep').innerText(), '150');
      await page.locator('#search').fill('zzzznone');
      await page.locator('#reset-button').waitFor({ state: 'visible' });
      await page.locator('#reset-button').click();
      await page.locator('#categories .category-button').first().click();
      assert.equal(await page.locator('#page-select').inputValue(), '1');
      const shown = await page.locator('.result-ep').allTextContents();
      assert(shown.every((ep) => synthetic.find((x) => x.ep === `EP${ep}`).category === catalog.categories[0]), `分類結果不一致：${shown.join(', ')}`);
      await page.unroute('**/data/catalog.json');
      await page.unroute('**/data/search-index.json');
    });

    await record('搜尋下載失敗可重試，清空搜尋不被舊結果覆寫', async () => {
      let first = true;
      await page.route('**/data/search-index.json', (route) => {
        if (first) { first = false; return route.fulfill({ status: 503, body: 'unavailable' }); }
        return route.continue();
      });
      await page.goto(base);
      await page.waitForFunction(() => document.querySelectorAll('.result-row').length > 0);
      await page.locator('#search-folder > summary').click();
      await page.locator('#search').fill('規則');
      await page.locator('#retry-load').waitFor({ state: 'visible' });
      await page.locator('#retry-load').click();
      await page.waitForFunction(() => document.querySelector('.result-ep')?.textContent === '117');
      await page.unroute('**/data/search-index.json');
      await page.route('**/data/search-index.json', async (route) => { await new Promise((r) => setTimeout(r, 800)); await route.continue(); });
      await page.goto(base);
      await page.waitForFunction(() => document.querySelectorAll('.result-row').length > 0);
      await page.locator('#search-folder > summary').click();
      await page.locator('#search').fill('規則');
      await page.waitForTimeout(policy.searchDebounceMs + 40);
      await page.locator('#search').fill('');
      await page.waitForTimeout(1000);
      assert.equal(await page.locator('.result-row').count(), Math.min(items.length, policy.pageSize));
      await page.unroute('**/data/search-index.json');
    });

    for (const item of items.filter((item) => item.worksheetUrl)) {
      await record(`${item.ep} 缺字、字型預算、暫存與列印`, async () => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.emulateMedia({ media: 'screen' });
        await page.goto(base + '/' + item.worksheetUrl);
        await page.locator('[data-video-link]').waitFor({ state: item.videoUrl ? 'visible' : 'hidden' });
        if (item.videoUrl) assert.equal(await page.locator('[data-video-link]').getAttribute('href'), item.videoUrl);
        await page.evaluate(() => document.fonts.ready);
        const worksheetStyleRules = require('./rules/worksheet-style-check.cjs');
        assert.deepEqual(await worksheetStyleRules.worksheetStyleIssues(page), []);
        assert.deepEqual(await worksheetStyleRules.inlineInputLayoutIssues(page), []);
        assert.deepEqual(await worksheetStyleRules.choiceLayoutIssues(page), []);
        assert.deepEqual(await require('./rules/worksheet-content-check.cjs').worksheetStructureIssues(page, item.title, item.ep), []);
        assert.deepEqual(await require('./rules/worksheet-content-check.cjs').worksheetContentIssues(page, item.ep), []);
        const prefixedChoices = await page.locator('.choice > span').evaluateAll((copies) => copies
          .map((copy) => copy.innerText.trim())
          .filter((text) => /^[A-ZＡ-Ｚ][.．、]\s*/.test(text)));
        assert.deepEqual(prefixedChoices, [], `${item.ep}: 選項文字不得使用 A／B／C 等人工標號`);
        const promptConfiguration = page.locator('.prompt-quote[data-prompt-status]');
        if (await promptConfiguration.count()) {
          assert.equal(
            await promptConfiguration.getAttribute('data-prompt-configured'),
            'true',
            `${item.ep}: AI 提示詞缺少完整的作答欄位對應；請更新 assets/worksheet.js 的 promptBindings`
          );
        }
        assert.deepEqual(await fontIssues(page, item.ep), []);
        const fonts = await withinFontBudget(page, false);
        const field = page.locator('textarea:not([readonly]),input[type=text]:not([readonly])').first();
        assert.equal(await page.locator('#clear-draft').isDisabled(), true);
        await field.fill('保留我的原文：龘');
        assert.equal(await page.locator('#clear-draft').isEnabled(), true);
        page.once('dialog', (dialog) => dialog.dismiss());
        await page.locator('#clear-draft').click();
        assert.equal(await field.inputValue(), '保留我的原文：龘');
        await page.reload();
        assert.equal(await field.inputValue(), '保留我的原文：龘');
        page.once('dialog', (dialog) => dialog.accept());
        await page.locator('#clear-draft').click();
        assert.equal(await field.inputValue(), '');
        assert.equal(await page.locator('#clear-draft').isDisabled(), true);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, item.ep + '-desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: path.join(output, item.ep + '-mobile.png'), fullPage: true });
        await page.emulateMedia({ media: 'print' });
        const metrics = await printMetrics(page);
        checkPrint(metrics, item.ep);
        assert.equal(await page.locator('.toolbar').isVisible(), false);
        const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
        assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, metrics.length, `${item.ep}: PDF 實際頁數錯誤`);
        fs.writeFileSync(path.join(output, item.ep + '.pdf'), pdf);
        return { fonts, print: metrics };
      });
      await record(`${item.ep} 字型失敗仍可列印`, async () => {
        const fallback = await browser.newPage();
        try {
          await fallback.route('**/*.woff2', (route) => route.abort());
          await fallback.goto(base + '/' + item.worksheetUrl);
          await fallback.emulateMedia({ media: 'print' });
          const metrics = await printMetrics(fallback);
          checkPrint(metrics, `${item.ep} 系統字型`);
          return metrics;
        } finally { await fallback.close(); }
      });
    }

    await record('EP94 備案計算、跨日、選項、搜尋與舊作答保存', async () => {
      const backup = await browser.newPage();
      try { await require('./tests/ep94-backup.test.cjs').testEp94Backup(backup, base); }
      finally { await backup.close(); }
    });
    await record('EP95 心率自動計算、輸入驗證與舊作答保存', async () => {
      const calculator = await browser.newPage();
      try {
        await calculator.goto(base + '/worksheets/EP95/');
        await require('./tests/ep95-calculator.test.cjs').testEp95Calculator(calculator);
      } finally { await calculator.close(); }
    });
    await record('AI 提示詞自動代入文字、選項並保留未作答提示', async () => {
      const prompt = await browser.newPage();
      try { await require('./tests/prompt-autofill.test.cjs').testPromptAutofill(prompt, base); }
      finally { await prompt.close(); }
    });

    await record('首次慢速載入自動套用字型並維持版面穩定', async () => {
      const slow = await browser.newPage();
      try {
        await slow.addInitScript(() => {
          window.shifts = [];
          new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.shifts.push(entry.value); }).observe({ type: 'layout-shift', buffered: true });
        });
        await slow.route('**/*.woff2', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1800)); await route.continue(); });
        await slow.goto(base + '/worksheets/EP109/', { waitUntil: 'domcontentloaded' });
        await slow.waitForTimeout(400);
        await slow.evaluate(() => document.fonts.ready);
        assert(await slow.evaluate(() => document.fonts.check('800 32px "Glow Sans TC"', '面對失敗')));
        const cls = await slow.evaluate(() => window.shifts.reduce((a, b) => a + b, 0));
        assert(cls <= policy.budgets.layoutShift, `字型 CLS ${cls} 超出預算`);
        return { cls };
      } finally { await slow.close(); }
    });

    await record('首次載入超過等待期限仍自動顯示指定字型', async () => {
      for (const url of ['/', '/worksheets/EP109/']) {
        const cold = await browser.newPage();
        try {
          await cold.route('**/*.woff2', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 3600));
            await route.continue();
          });
          await cold.goto(base + url, { waitUntil: 'domcontentloaded' });
          await cold.evaluate(() => document.fonts.ready);
          const session = await cold.context().newCDPSession(cold);
          await session.send('DOM.enable');
          await session.send('CSS.enable');
          const { root } = await session.send('DOM.getDocument');
          const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: url === '/' ? 'h1 span' : 'h1' });
          const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
          assert(fonts.some((font) => font.isCustomFont && font.glyphCount > 0), `${url}: 首次載入未實際使用自訂字型`);
        } finally { await cold.close(); }
      }
    });

    await record('檢查器確實能抓到缺字與列印溢出', async () => {
      await page.emulateMedia({ media: 'screen' });
      await page.goto(base + '/worksheets/EP109/');
      await page.locator('h1').evaluate((el) => { el.textContent = '龘'; });
      assert((await fontIssues(page, 'EP109')).some((issue) => issue.character === '龘'));
      await page.emulateMedia({ media: 'print' });
      await page.locator('.page').first().evaluate((el) => { const block = document.createElement('div'); block.style.height = '2000px'; el.append(block); });
      const metrics = await printMetrics(page);
      assert.throws(() => checkPrint(metrics, 'self-test'), /溢出|頁尾/);
    });
    assert.deepEqual(errors, [], 'JavaScript 執行錯誤');
  } finally {
    await browser.close();
    server.close();
    fs.writeFileSync(path.join(output, 'quality-report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  if (report.failures.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
