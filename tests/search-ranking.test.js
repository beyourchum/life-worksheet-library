const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SearchCore = require('../site/assets/search-core.js');

const root = path.resolve(__dirname, '..');
const worksheets = JSON.parse(fs.readFileSync(path.join(root, 'site', 'worksheets.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'site', 'search-config.json'), 'utf8'));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'site_search_cases.json'), 'utf8'));

for (const testCase of cases) {
  const { matches } = SearchCore.searchWorksheets(worksheets, testCase.query, '', config);
  assert.ok(matches.length, `「${testCase.query}」沒有搜尋結果`);
  assert.equal(matches[0].item.ep, testCase.expectedFirst, `「${testCase.query}」第一名應為 ${testCase.expectedFirst}，實際為 ${matches[0].item.ep}`);
}

assert.deepEqual(
  SearchCore.tokenizeQuery('被老師罵', config.ignoredQueryWords),
  ['老師', '罵'],
  '語法詞不應成為有效搜尋詞',
);

const noisyFallback = SearchCore.searchWorksheets(worksheets, '被老師罵', '', config);
assert.equal(noisyFallback.matches.length, 0, '單一低覆蓋詞不得產生相關結果');

const ignoredOnly = SearchCore.searchWorksheets(worksheets, '被', '', config);
assert.equal(ignoredOnly.matches.length, 0, '只有停用詞的查詢不得顯示全部內容');

console.log(`Verified ${cases.length} search ranking cases.`);
