const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
process.chdir(path.join(__dirname, '..'));
const read = (file) => fs.readFileSync(file, 'utf8');
const items = JSON.parse(read('worksheets.json'));
const categories = JSON.parse(read('categories.json'));
const config = JSON.parse(read('search-config.json'));
const policy = JSON.parse(read('quality-policy.json'));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
for (const [file, expected] of Object.entries(require('./content-data.cjs').outputs())) {
  check(fs.existsSync(file) && read(file).replace(/\r\n/g, '\n') === expected, `${file}: 衍生資料過期，請執行 pnpm run data`);
}
for (const [file, budget] of [['data/catalog.json', policy.budgets.catalogBytes], ['data/search-index.json', policy.budgets.searchIndexBytes]]) {
  check(fs.existsSync(file) && fs.statSync(file).size <= budget, `${file}: 超出 ${budget} bytes 的資料預算`);
}
const fontManifest = JSON.parse(read('assets/fonts/worksheet/compact/manifest.json'));
const fontSources = [
  ['assets/fonts/worksheet/glow', () => true],
  ['assets/fonts/worksheet/genki/files', () => true],
  ['assets/fonts/worksheet/genyo', (name) => name.includes('.400.')],
  ['assets/fonts/worksheet/genyo', (name) => name.includes('.700.')],
];
const sourceHash = createHash('sha256');
for (const [dir, filter] of fontSources) for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.woff2') && filter(name)).sort()) sourceHash.update(fs.readFileSync(path.join(dir, file)));
check(sourceHash.digest('hex') === fontManifest.sourceHash, '原始字型已改變，請重新執行 pnpm run fonts');
check(createHash('sha256').update(read('scripts/build-fonts.py').replace(/\r\n/g, '\n')).digest('hex') === fontManifest.generatorHash,
  '字型產生程式已改變，請重新執行 pnpm run fonts');
for (const [file, hash] of Object.entries(fontManifest.inputs)) {
  check(fs.existsSync(file) && createHash('sha256').update(read(file).replace(/\r\n/g, '\n')).digest('hex') === hash,
    `${file}: 內容已改變，請執行 python scripts/build-fonts.py 更新精簡字型`);
}
for (const ep of fs.readdirSync('worksheets')) {
  check(`worksheets/${ep}/index.html` in fontManifest.inputs, `${ep}: 新頁面尚未收錄精簡字型，請執行 python scripts/build-fonts.py`);
}
for (const [scope, data] of Object.entries(fontManifest.scopes)) {
  const home = scope === 'home';
  const prefix = `assets/fonts/worksheet/compact/${scope}/`;
  const fontCss = read(prefix + 'fonts.css');
  check(createHash('sha256').update(fontCss.replace(/\r\n/g, '\n')).digest('hex') === data.cssHash, `${scope}: 字型 CSS 與紀錄不一致，請重建`);
  let totalBytes = 0;
  for (const [name, font] of Object.entries(data.fonts)) {
    const file = prefix + name + '.woff2';
    const size = fs.statSync(file).size;
    totalBytes += size;
    check(size === font.bytes, `${file}: 字型大小與紀錄不一致，請重建字型`);
    check(createHash('sha256').update(fs.readFileSync(file)).digest('hex') === font.sha256, `${file}: 字型內容與紀錄不一致，請重建字型`);
  }
  check(totalBytes <= policy.budgets[home ? 'homeFontBytes' : 'worksheetFontBytes'], `${scope}: 字型總量 ${totalBytes} bytes 超出預算`);
  check(Object.keys(data.fonts).length <= policy.budgets[home ? 'homeFontRequests' : 'worksheetFontRequests'], `${scope}: 字型檔案數超出預算`);
  check((fontCss.match(/font-display: optional;/g) || []).length === Object.keys(data.fonts).length, `${scope}: 必須避免慢速字型載入後跳動`);
  const html = read(home ? 'index.html' : `worksheets/${scope}/index.html`);
  check(html.includes(`compact/${scope}/fonts.css`), `${scope}: 必須引用自己頁面的精簡字型`);
  check(!html.includes('ep62-fonts.css') && !html.includes('site-fonts.css') && !html.includes('genki/swap'), `${scope}: 不可重新載入舊的大型字型`);
}
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});
const files = ['index.html', ...walk('assets'), ...walk('worksheets'), ...(fs.existsSync('articles') ? walk('articles') : [])];
const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
for (const file of files) {
  if (file.endsWith('.js')) { try { new vm.Script(read(file), { filename: file }); } catch (e) { errors.push(e.message); } }
  if (!/\.(html|css)$/.test(file)) continue;
  const source = read(file);
  for (const match of source.matchAll(/(?:href|src)=["']([^"']+)["']|url\(['"]?([^)'"\s]+)['"]?\)/g)) {
    const ref = match[1] || match[2];
    if (/^(https?:|data:|#)/.test(ref)) continue;
    const target = path.resolve(path.dirname(file), ref.split(/[?#]/)[0]);
    check(fs.existsSync(target), `${file}: 資源不存在 ${ref}`);
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) check(fs.existsSync(path.join(target, 'index.html')), `${file}: 目錄缺少 index.html ${ref}`);
  }
  if (!file.endsWith('.html')) continue;
  // Explicit nesting check for the site's HTML subset, not a full HTML conformance validator.
  const stack = [];
  const markup = source.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  for (const match of markup.matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
    const tag = match[2].toLowerCase();
    if (voidTags.has(tag)) continue;
    if (match[1]) check(stack.pop() === tag, `${file}: 標籤未正確配對 ${match[0]}`);
    else stack.push(tag);
  }
  check(stack.length === 0, `${file}: 未關閉標籤 ${stack.join(', ')}`);
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  check(new Set(ids).size === ids.length, `${file}: id 重複`);
  for (const m of source.matchAll(/(?:\bfor|href)="#?([^"]+)"/g)) {
    if (m[0].startsWith('for=') || m[0].startsWith('href="#')) check(ids.includes(m[1]), `${file}: 找不到目標 ${m[1]}`);
  }
}
check(Array.isArray(items) && items.length > 0, 'worksheets.json 必須有內容');
check(new Set(categories).size === categories.length && categories.every((x) => typeof x === 'string' && x.trim()), 'categories.json 必須是無重複的分類名稱');
check(new Set(items.map((x) => x.ep)).size === items.length, 'EP 編號重複');
const videos = new Map();
for (const item of items) {
  for (const key of ['ep', 'title', 'summary', 'category']) check(typeof item[key] === 'string' && item[key].trim(), `${item.ep}: 缺少 ${key}`);
  check(/^EP\d+$/.test(item.ep), `${item.ep}: EP 格式錯誤`);
  check(categories.includes(item.category), `${item.ep}: 未定義分類 ${item.category}`);
  check(Boolean(item.worksheetUrl || item.articleUrl), `${item.ep}: 至少提供文章或學習單入口`);
  if (item.worksheetUrl) check(item.worksheetUrl === `worksheets/${item.ep}/`, `${item.ep}: 學習單路徑與集數不一致`);
  if (item.articleUrl) {
    check(!/^[a-z]+:/i.test(item.articleUrl) && !item.articleUrl.includes('..'), `${item.ep}: 文章使用站內相對路徑`);
    const articleFile = item.articleUrl.endsWith('/') ? item.articleUrl + 'index.html' : item.articleUrl;
    check(fs.existsSync(articleFile), `${item.ep}: 文章入口不存在`);
  }
  for (const key of Object.keys(config.weights.searchTerms)) check(Array.isArray(item.searchTerms?.[key]) && item.searchTerms[key].every((x) => typeof x === 'string' && x.trim()), `${item.ep}: 搜尋詞 ${key} 格式錯誤`);
  for (const key of Object.keys(item.searchTerms || {})) check(key in config.weights.searchTerms, `${item.ep}: 搜尋詞種類 ${key} 沒有對應權重`);
  const file = `worksheets/${item.ep}/index.html`;
  if (item.worksheetUrl && !fs.existsSync(file)) { errors.push(`${item.ep}: 缺少頁面`); continue; }
  if (item.worksheetUrl) {
  const html = read(file);
  check(html.includes(`<title>${item.ep}｜${item.title}</title>`), `${item.ep}: 頁面標題與索引不一致`);
  check(html.includes(`data-worksheet-id="${item.ep}"`), `${item.ep}: 暫存識別碼不一致`);
  const pageCategories = [...html.matchAll(/<header class="page-meta"><strong>[^<]+<\/strong><span>([^<]+)<\/span>/g)].map((m) => m[1]);
  check(pageCategories.length > 0 && pageCategories.every((x) => x === item.category), `${item.ep}: 頁面分類與索引不一致`);
  check(html.includes('../../assets/worksheet.css') && html.includes('../../assets/worksheet.js'), `${item.ep}: 未引用共用檔案`);
  const pageCount = (html.match(/<article class="page worksheet-page"/g) || []).length;
  const pageLabels = [...html.matchAll(/class="page-count">(\d+) \/ (\d+)</g)];
  check(pageLabels.length === pageCount && pageLabels.every((m, i) => +m[1] === i + 1 && +m[2] === pageCount), `${item.ep}: 頁碼與實際頁數不一致`);
  }
  if (item.videoUrl) {
    try {
      const url = new URL(item.videoUrl);
      check(url.protocol === 'https:' && ['youtu.be', 'www.youtube.com', 'youtube.com'].includes(url.hostname), `${item.ep}: 非 YouTube HTTPS 網址`);
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
      check(/^[\w-]{11}$/.test(id || ''), `${item.ep}: 影片 ID 格式錯誤`);
      if (videos.has(id)) console.warn(`待核對：${videos.get(id)} 與 ${item.ep} 使用相同影片 ${id}`);
      videos.set(id, item.ep);
    } catch { errors.push(`${item.ep}: 影片網址格式錯誤`); }
  }
}
for (const dir of fs.readdirSync('worksheets')) check(items.some((x) => x.ep === dir), `${dir}: 未登錄索引`);
const { searchWorksheets } = require('../assets/search-core.js');
try {
  assert.equal(searchWorksheets(items, '', '', config).matches.length, items.length);
  for (const [query, ep] of [['規則', 'EP117'], ['換工作', 'EP62'], ['拖延', 'EP111'], ['EP117', 'EP117']]) assert(searchWorksheets(items, query, '', config).matches.some((m) => m.item.ep === ep), `${query}: 找不到 ${ep}`);
  assert.equal(searchWorksheets(items, 'zzzznomatch999', '', config).matches.length, 0);
  for (const category of categories) assert(searchWorksheets(items, '', category, config).matches.every((m) => m.item.category === category));
} catch (e) { errors.push(`搜尋檢查：${e.message}`); }
const synthetic = Array.from({ length: policy.capacityTestEntries }, (_, index) => {
  const item = items[index % items.length];
  return { ...item, ep: `EP${index + 1}`, title: item.title + index, summary: item.summary + index,
    searchTerms: Object.fromEntries(Object.entries(item.searchTerms).map(([key, terms]) => [key, terms.map((term) => term + index)])) };
});
const started = performance.now();
searchWorksheets(synthetic, '工作 焦慮', '', config);
const searchMs = performance.now() - started;
check(searchMs < policy.budgets.search150Ms, `${synthetic.length} 筆搜尋耗時 ${searchMs.toFixed(1)} ms，超出預算`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`檢查通過：${items.length} 份學習單、索引、分類、資源、HTML 標籤與搜尋案例。`);
