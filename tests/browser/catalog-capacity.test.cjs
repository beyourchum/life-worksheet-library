const assert = require('node:assert/strict');

async function testCatalogCapacity(page, base, { items, policy, catalog: sourceCatalog, index: sourceIndex }) {
  for (const key of ['capacityTestEntries', 'pageSize'])
    assert(Number.isInteger(policy[key]) && policy[key] > 0, `${key} 必須是正整數`);
  assert(items.length, '容量測試需要索引樣本');
  const synthetic = Array.from({ length: policy.capacityTestEntries }, (_, i) => {
    const item = items[i % items.length];
    return { ...item, ep: `EP${i + 1}`, title: `${item.title}（${i + 1}）`, summary: item.summary + i,
      searchTerms: Object.fromEntries(Object.entries(item.searchTerms).map(([key, terms]) => [key, terms.map((term) => term + i)])) };
  });
  synthetic[0] = { ...synthetic[0], articleUrl: 'articles/example/', worksheetUrl: undefined };
  const last = synthetic.at(-1);
  last.searchTerms = { ...last.searchTerms, phrases: ['容量測試唯一詞'] };
  const catalog = { ...sourceCatalog, pageSize: policy.pageSize, searchDebounceMs: policy.searchDebounceMs,
    items: synthetic.map(({ searchTerms, ...item }) => item) };
  const index = { ...sourceIndex, terms: Object.fromEntries(synthetic.map((item) => [item.ep, item.searchTerms])) };
  assert(Buffer.byteLength(JSON.stringify(catalog)) <= policy.budgets.catalogBytes);
  assert(Buffer.byteLength(JSON.stringify(index)) <= policy.budgets.searchIndexBytes);
  await page.route('**/data/catalog.json', (route) => route.fulfill({ json: catalog }));
  await page.route('**/data/search-index.json', (route) => route.fulfill({ json: index }));
  try {
    await page.goto(base);
    const firstPageCount = Math.min(synthetic.length, policy.pageSize);
    const lastPage = Math.ceil(synthetic.length / policy.pageSize);
    await page.waitForFunction((count) => document.querySelectorAll('.result-row').length === count, firstPageCount);
    assert.equal(await page.locator('.result-ep').first().innerText(), String(synthetic.length));
    assert.equal(await page.locator('#page-select option').count(), lastPage);
    if (lastPage > 1) {
      await page.locator('#next-page').click();
      assert.equal(await page.locator('.result-ep').first().innerText(), String(synthetic.length - policy.pageSize));
      await page.locator('#page-select').selectOption(String(lastPage));
    }
    assert.equal(await page.locator('.result-row').count(), synthetic.length - (lastPage - 1) * policy.pageSize);
    assert.equal(await page.locator('#next-page').isDisabled(), true);
    await page.locator('#sort').selectOption('oldest');
    assert.equal(await page.locator('.result-ep').first().innerText(), '1');
    assert.equal(await page.locator('.result-row').first().locator('.result-title a').getAttribute('href'), 'articles/example/');
    assert.equal(await page.locator('.result-row').first().getByText('學習單', { exact: true }).count(), 0);
    await page.locator('#search-folder > summary').click();
    await page.locator('#search').dispatchEvent('compositionstart');
    await page.locator('#search').fill('容量測試唯一詞');
    await page.waitForTimeout(policy.searchDebounceMs + 80);
    assert.equal(await page.locator('.result-row').count(), firstPageCount, '組字中不應搜尋');
    await page.locator('#search').dispatchEvent('compositionend');
    await page.waitForFunction(() => document.querySelectorAll('.result-row').length === 1 && document.querySelector('.result-ep')?.textContent);
    await page.waitForFunction((number) => document.querySelector('.result-ep')?.textContent === number, String(synthetic.length));
    assert.equal(await page.locator('.result-ep').innerText(), String(synthetic.length));
    await page.locator('#search').fill('zzzznone');
    await page.locator('#reset-button').waitFor({ state: 'visible' });
    await page.locator('#reset-button').click();
    await page.locator('#categories .category-button').first().click();
    assert.equal(await page.locator('#page-select').inputValue(), '1');
    const shown = await page.locator('.result-ep').allTextContents();
    assert(shown.every((ep) => synthetic.find((item) => item.ep === `EP${ep}`).category === catalog.categories[0]), `分類結果不一致：${shown.join(', ')}`);
    return { entries: synthetic.length, pageSize: policy.pageSize, pages: lastPage };
  } finally {
    await page.unroute('**/data/catalog.json');
    await page.unroute('**/data/search-index.json');
  }
}

module.exports = { testCatalogCapacity };
