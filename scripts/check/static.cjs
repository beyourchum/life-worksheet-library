const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { numberedHtmlHeadings, numberedMarkdownHeadings } = require('./rules/worksheet-heading-check.cjs');
process.chdir(path.join(__dirname, '../..'));
const read = (file) => fs.readFileSync(file, 'utf8');
const items = JSON.parse(read('catalog/worksheets.json'));
const categories = JSON.parse(read('catalog/categories.json'));
const config = JSON.parse(read('config/search.json'));
const policy = JSON.parse(read('config/quality-policy.json'));
const qualityExceptions = JSON.parse(read('config/quality-exceptions.json'));
const categoryAliases = JSON.parse(read('config/category-aliases.json'));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
for (const [file, expected] of Object.entries(require('../generate/catalog.cjs').outputs())) {
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
check(createHash('sha256').update(read('scripts/generate/fonts.py').replace(/\r\n/g, '\n')).digest('hex') === fontManifest.generatorHash,
  '字型產生程式已改變，請重新執行 pnpm run fonts');
for (const [file, hash] of Object.entries(fontManifest.inputs)) {
  check(fs.existsSync(file) && createHash('sha256').update(read(file).replace(/\r\n/g, '\n')).digest('hex') === hash,
    `${file}: 內容已改變，請執行 pnpm run fonts 更新精簡字型`);
}
for (const ep of fs.readdirSync('worksheets')) {
  check(`worksheets/${ep}/index.html` in fontManifest.inputs, `${ep}: 新頁面尚未收錄精簡字型，請執行 pnpm run fonts`);
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
  check((fontCss.match(/font-display: block;/g) || []).length === Object.keys(data.fonts).length, `${scope}: 必須在字型載入完成後自動套用`);
  const html = read(home ? 'index.html' : `worksheets/${scope}/index.html`);
  check(html.includes(`compact/${scope}/fonts.css`), `${scope}: 必須引用自己頁面的精簡字型`);
  check(!html.includes('ep62-fonts.css') && !html.includes('site-fonts.css') && !html.includes('genki/swap'), `${scope}: 不可重新載入舊的大型字型`);
}
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});
const files = ['index.html', ...walk('assets'), ...walk('worksheets'), ...(fs.existsSync('articles') ? walk('articles') : [])];
for (const file of walk('worksheets')) {
  check(!/\.(?:css|js)$/.test(file), `${file}: 單元互動與樣式須改用 assets/worksheet-components 共用元件`);
}
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
check(Array.isArray(items) && items.length > 0, 'catalog/worksheets.json 必須有內容');
check(new Set(categories).size === categories.length && categories.every((x) => typeof x === 'string' && x.trim()), 'catalog/categories.json 必須是無重複的分類名稱');
require('./tests/category-alias-policy.test.cjs');
const { categoryAliasIssues } = require('./rules/category-alias-policy.cjs');
for (const issue of categoryAliasIssues(categories, items, categoryAliases)) errors.push(issue);
check(new Set(items.map((x) => x.ep)).size === items.length, 'EP 編號重複');
const videos = new Map();
require('./tests/video-policy.test.cjs');
const { videoRequirement } = require('./rules/video-policy.cjs');
check(Array.isArray(qualityExceptions.videoExceptions), 'videoExceptions 必須是陣列');
const videoExceptions = Array.isArray(qualityExceptions.videoExceptions) ? qualityExceptions.videoExceptions : [];
check(new Set(videoExceptions.map((entry) => entry.ep)).size === videoExceptions.length, '無影片例外集數重複');
for (const entry of videoExceptions) check(items.some((item) => item.ep === entry.ep && item.worksheetUrl), '無影片例外必須對應既有學習單');
for (const item of items) {
  const videoError = videoRequirement(item, videoExceptions);
  check(!videoError, `${item.ep}: ${videoError}`);
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
  const requiredParts = [
    /<strong>學習目標：<\/strong>\s*[^<\s]/,
    /<strong>使用說明：<\/strong>\s*[^<\s]/,
    /class="[^"]*\bfinal-reminder\b[^"]*"/,
    /class="[^"]*\bprompt-intro\b[^"]*"[^>]*>[\s\S]*?AI 幫幫忙/,
    /class="[^"]*\bprompt-copy-text\b[^"]*"[^>]*data-prompt-text[^>]*>\s*<p>\s*[^<\s]/,
    /<button\b[^>]*data-prompt-copy/
  ];
  const partNames = ['學習目標', '使用說明', '結尾', 'AI 幫幫忙', 'AI 提示詞', '複製提示詞按鈕'];
  const positions = requiredParts.map((pattern, i) => {
    const match = pattern.exec(html);
    check(Boolean(match), `${item.ep}: 缺少或未填寫${partNames[i]}，請依 docs/quality.md 補齊`);
    return match?.index ?? -1;
  });
  check(positions.every((p, i) => p >= 0 && (!i || p > positions[i - 1])), `${item.ep}: 共通開頭與結尾順序錯誤`);
  const promptIntro = /<aside class="[^"]*\bprompt-intro\b[^"]*"[^>]*>([\s\S]*?)<\/aside>/.exec(html)?.[1] || '';
  check(/class="closing-mark"[^>]*>→<\//.test(promptIntro), `${item.ep}: AI 幫幫忙缺少共通綠色箭頭`);
  const promptIntroText = promptIntro.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  check(promptIntroText.length > '→AI 幫幫忙'.length, `${item.ep}: AI 幫幫忙須說明用途及代入或填寫方式`);
  const promptTextHtml = /<div[^>]*\bdata-prompt-text\b[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] || '';
  const promptText = promptTextHtml.replace(/<[^>]+>/g, '').trim();
  check(!(promptText.startsWith('「') && promptText.endsWith('」')), `${item.ep}: AI 提示詞全文不使用成對引號包住`);
  const firstActivityPosition = html.indexOf('<div class="section-heading"', positions[1]);
  check(firstActivityPosition > positions[1], `${item.ep}: 使用說明後缺少第一個活動`);
  if (firstActivityPosition > positions[1]) {
    const worksheetIntro = html.slice(positions[0], firstActivityPosition);
    const introLabels = [...worksheetIntro.matchAll(/<strong>([^<]+)：<\/strong>/g)].map((match) => match[1].trim());
    check(
      introLabels.length === 2 && introLabels[0] === '學習目標' && introLabels[1] === '使用說明',
      `${item.ep}: 第一個活動前只能依序出現學習目標、使用說明，不得另列適用對象等前置欄位`
    );
    check(!/(?:適用對象|目標對象|建議年級|預備知識|建議時間)[：:]/.test(worksheetIntro), `${item.ep}: 第一個活動前不得另列適用對象等前置資訊`);
  }
  const correctedFile = `content/${item.ep}/${item.ep}_corrected.md`;
  const numberedHtml = numberedHtmlHeadings(html);
  check(numberedHtml.length === 0, `${item.ep}: 題目或活動小標題不應加數字或字母編號：${numberedHtml.join('、')}`);
  if (process.env.GITHUB_ACTIONS !== 'true') {
    for (const role of ['source', 'corrected']) {
      const sourceFile = `content/${item.ep}/${item.ep}_${role}.md`;
      check(fs.existsSync(sourceFile), `${sourceFile}: 缺少本機稿件，請先查 Git 歷史及原始來源，完成核對後再驗收`);
    }
  }
  if (fs.existsSync(correctedFile)) {
    const md = read(correctedFile);
    const numberedMarkdown = numberedMarkdownHeadings(md);
    check(numberedMarkdown.length === 0, `${correctedFile}: 題目或活動小標題不應加數字或字母編號：${numberedMarkdown.join('、')}`);
    check(!/^publication_status:\s*pending-reassignment\s*$/m.test(md), `${item.ep}: 學習單待重新分配，不得恢復至公開索引；先完成影片教學對應核對`);
    check(md.split(/\r?\n/).includes(`# ${item.ep}｜${item.title}`), `${correctedFile}: 定稿標題與索引不一致，請核對標題並保留原稿標題於來源資料`);
    for (const label of ['學習目標', '使用說明', 'AI 幫幫忙'])
      check(md.includes(label), `${item.ep}: 修訂稿缺少${label}`);
    const mdIntroStart = md.search(/學習目標[：:]/);
    const mdFirstActivity = md.indexOf('\n## ', md.search(/使用說明[：:]/));
    const mdIntro = mdIntroStart >= 0 && mdFirstActivity > mdIntroStart ? md.slice(mdIntroStart, mdFirstActivity) : '';
    check(!/(?:適用對象|目標對象|建議年級|預備知識|建議時間)[：:]/.test(mdIntro), `${item.ep}: 修訂稿開頭只能保留學習目標與使用說明，不得另列適用對象等前置欄位`);
    check(/(?:<!--\s*final-reminder\s*-->\s*>\s*\S|^## 結尾\s+\S)/m.test(md), `${item.ep}: 修訂稿缺少結尾`);
  }
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
const { searchWorksheets } = require('../../assets/search-core.js');
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
else console.log(`靜態檢查通過：${items.length} 份學習單、索引、分類、資源、HTML 標籤與搜尋案例。仍須完成瀏覽器測試及逐篇人工驗收。${process.env.GITHUB_ACTIONS === 'true' ? ' CI 不含本機 MD，未驗證稿件同步。' : ''}`);
