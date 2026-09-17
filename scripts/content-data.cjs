const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
function outputs() {
  const items = read('worksheets.json');
  const policy = read('quality-policy.json');
  const catalog = {
    pageSize: policy.pageSize,
    searchDebounceMs: policy.searchDebounceMs,
    categories: read('categories.json'),
    items: items.map(({ ep, title, summary, category, videoUrl, worksheetUrl, articleUrl }) => ({ ep, title, summary, category, videoUrl, worksheetUrl, articleUrl })),
  };
  const files = {
    'data/catalog.json': catalog,
    'data/search-index.json': {
      config: read('search-config.json'),
      terms: Object.fromEntries(items.map((item) => [item.ep, item.searchTerms])),
    },
  };
  for (const item of items.filter((item) => item.worksheetUrl)) {
    files[`${item.worksheetUrl}metadata.json`] = { ep: item.ep, videoUrl: item.videoUrl || null };
  }
  return Object.fromEntries(Object.entries(files).map(([name, value]) => [name, JSON.stringify(value) + '\n']));
}
if (require.main === module) {
  for (const [name, content] of Object.entries(outputs())) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
  console.log('已產生瀏覽索引、搜尋索引與各學習單的影片資料。');
}
module.exports = { outputs };
