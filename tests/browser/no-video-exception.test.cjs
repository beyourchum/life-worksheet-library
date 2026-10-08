const fs = require('node:fs');
const assert = require('node:assert/strict');
const { renderWorksheet } = require('../../scripts/generate/worksheet-html.cjs');

async function testNoVideoException(page, base) {
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const item = read('catalog/worksheets.json').find((item) => item.ep === 'EP64');
  const source = read('worksheet-sources/EP64.json');
  const variants = read('config/worksheet-layouts.json').variants;
  await page.goto(`${base}/${item.worksheetUrl}`);
  const introStyle = () => page.locator('.worksheet-hero').locator('..').locator(':scope > p').first()
    .evaluate((element) => { const style = getComputedStyle(element); return { color: style.color, padding: style.padding, marginTop: style.marginTop }; });
  const expected = await introStyle();
  const noVideo = { ...item, videoUrl: null };
  const html = renderWorksheet({ ...source, videoTitle: '' }, noVideo, variants,
    [{ ep: item.ep, reason: '本篇無影片', approvalReference: '測試用核准紀錄' }]);
  const metadataRoute = `**/${item.worksheetUrl}metadata.json`;
  const pageRoute = `**/${item.worksheetUrl}`;
  await page.route(pageRoute, (route) => route.fulfill({ contentType: 'text/html', body: html }));
  await page.route(metadataRoute, (route) => route.fulfill({ json: { ep: item.ep, videoUrl: null } }));
  try {
    await page.goto(`${base}/${item.worksheetUrl}`);
    assert.equal(await page.locator('.video-embed, iframe').count(), 0);
    assert.equal(await page.locator('[data-video-link]').isVisible(), false);
    assert.deepEqual(await introStyle(), expected, '無影片例外仍須保留學習目標與使用說明的共用呈現');
    assert.equal(await page.locator('.prompt-quote').getAttribute('data-prompt-configured'), 'true');
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  } finally {
    await page.unroute(pageRoute);
    await page.unroute(metadataRoute);
  }
}

module.exports = { testNoVideoException };
