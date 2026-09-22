const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { start } = require('./server.cjs');

const root = path.resolve(__dirname, '../..');
process.chdir(root);
const ep = String(process.argv.slice(2).find((arg) => arg !== '--') || '').toUpperCase();
if (!/^EP\d+$/.test(ep)) throw new Error('用法：node scripts/check/worksheet-browser.cjs EP編號，例如 EP71');

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const item = read('catalog/worksheets.json').find((entry) => entry.ep === ep && entry.worksheetUrl);
if (!item) throw new Error(`${ep}: 索引中沒有可檢查的學習單`);
const policy = read('config/quality-policy.json');
const output = path.join(root, '.qa/reports');
fs.mkdirSync(output, { recursive: true });

function printMetrics(page) {
  return page.locator('.worksheet .page').evaluateAll((pages) => pages.map((page, index) => {
    const rect = page.getBoundingClientRect();
    const footer = page.querySelector('.page-footer').getBoundingClientRect();
    const content = [...page.children].filter((element) => !element.matches('.page-footer'));
    const bottom = Math.max(...content.map((element) => element.getBoundingClientRect().bottom));
    return { page: index + 1, width: rect.width, height: rect.height, scrollHeight: page.scrollHeight,
      clientHeight: page.clientHeight, footerGap: footer.top - bottom };
  }));
}

(async () => {
  const { server, base } = await start(root);
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/' + item.worksheetUrl);
    await page.evaluate(() => document.fonts.ready);
    assert.deepEqual(await require('./rules/worksheet-style-check.cjs').worksheetStyleIssues(page), []);
    assert.deepEqual(await require('./rules/worksheet-style-check.cjs').inlineInputLayoutIssues(page), []);
    assert.deepEqual(await require('./rules/worksheet-style-check.cjs').choiceLayoutIssues(page, policy.choices.maxCompactCharacters), []);
    assert.deepEqual(await require('./rules/worksheet-content-check.cjs').worksheetStructureIssues(page, item.title, ep), []);
    assert.deepEqual(await require('./rules/worksheet-content-check.cjs').worksheetContentIssues(page, ep), []);
    if (item.videoUrl) {
      assert.equal(await page.locator('[data-video-link]').getAttribute('href'), item.videoUrl);
      assert.equal(await page.locator('.video-embed iframe').isVisible(), true, `${ep}: 頁面內影片播放器在桌面版不可見`);
    }
    await page.screenshot({ path: path.join(output, ep + '-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${ep}: 手機版產生水平溢出`);
    if (item.videoUrl) assert.equal(await page.locator('.video-embed iframe').isVisible(), true, `${ep}: 頁面內影片播放器在手機版不可見`);
    await page.screenshot({ path: path.join(output, ep + '-mobile.png'), fullPage: true });

    await page.emulateMedia({ media: 'print' });
    const metrics = await printMetrics(page);
    assert(metrics.length, `${ep}: 缺少列印頁面`);
    for (const metric of metrics) {
      assert(Math.abs(metric.width - policy.print.pageWidthPx) < 2 && Math.abs(metric.height - policy.print.pageHeightPx) < 2,
        `${ep} 第 ${metric.page} 頁不是 A4`);
      assert(metric.scrollHeight <= metric.clientHeight + 2, `${ep} 第 ${metric.page} 頁內容溢出`);
      assert(metric.footerGap >= policy.print.footerGapPx, `${ep} 第 ${metric.page} 頁壓到頁尾`);
    }
    assert.equal(await page.locator('.toolbar').isVisible(), false);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    fs.writeFileSync(path.join(output, ep + '.pdf'), pdf);
    assert.deepEqual(errors, [], `${ep}: JavaScript 執行錯誤`);
    fs.writeFileSync(path.join(output, ep + '-quality-report.json'), JSON.stringify({ ep, metrics, status: 'passed' }, null, 2) + '\n');
    console.log(`${ep} 單集瀏覽器、手機與空白列印檢查通過；這不代表全站 verify 或代表答案人工驗收通過。`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
