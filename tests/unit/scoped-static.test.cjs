const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');

const file = path.resolve(__dirname, '../../scripts/check/static.cjs');
const code = fs.readFileSync(file, 'utf8');
const localRequire = createRequire(file);
const ep = 'EP71';
const htmlFile = `worksheets/${ep}/index.html`;
function checkFixture(change = ({ html }) => html, changeMarkdown = (text) => text) {
  const catalog = JSON.parse(fs.readFileSync('catalog/worksheets.json', 'utf8'));
  const original = fs.readFileSync(htmlFile, 'utf8');
  const html = change({ html: original, item: catalog.find((item) => item.ep === ep) }) || original;
  const manifest = JSON.parse(fs.readFileSync('assets/fonts/worksheet/compact/manifest.json', 'utf8'));
  const hash = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
  manifest.inputs[htmlFile] = hash(html);
  manifest.inputs['assets/worksheet.js'] = hash(fs.readFileSync('assets/worksheet.js', 'utf8'));
  const overlay = new Map([
    [path.resolve(htmlFile), html],
    [path.resolve('catalog/worksheets.json'), JSON.stringify(catalog)],
    [path.resolve('assets/fonts/worksheet/compact/manifest.json'), JSON.stringify(manifest)],
    [path.resolve(`content/${ep}/${ep}_source.md`), '測試用原稿快照'],
    [path.resolve(`content/${ep}/${ep}_corrected.md`), `# ${ep}｜${catalog.find((item) => item.ep === ep).title}\n\n學習目標：測試。\n使用說明：測試。\n\n## 活動\n測試。\n\n## 結尾\n保留結尾。\n\n## AI 幫幫忙\n測試提示詞。\n`],
  ]);
  const correctedPath = path.resolve(`content/${ep}/${ep}_corrected.md`);
  overlay.set(correctedPath, changeMarkdown(overlay.get(correctedPath)));
  const fakeFs = { ...fs,
    readFileSync: (name, ...args) => overlay.has(path.resolve(name)) ? overlay.get(path.resolve(name)) : fs.readFileSync(name, ...args),
    existsSync: (name) => overlay.has(path.resolve(name)) ? true : String(name).startsWith('content/') ? false : fs.existsSync(name),
  };
  const errors = [], processState = { argv: ['node', file, ep], env: process.env, chdir: () => {}, exitCode: 0 };
  vm.runInNewContext(code, { __dirname: path.dirname(file), process: processState,
    require: (name) => name === 'node:fs' ? fakeFs : name === 'node:child_process' ? { spawnSync: () => ({ status: 0 }) }
      : name.startsWith('../../tests/') ? {} : localRequire(name),
    console: { log: () => {}, warn: () => {}, error: (text) => errors.push(text) }, performance, URL,
  });
  return { errors: errors.join('\n'), exitCode: processState.exitCode };
}
const baseline = checkFixture();
assert.equal(baseline.exitCode, 0, `單集不得因其他集數缺稿而失敗：${baseline.errors}`);
for (const [change, expected] of [
  [({ item }) => { item.videoUrl = ''; }, /缺少影片連結/],
  [({ html }) => html.replace('<main ', '<main style="color:red" '), /不得使用頁面內嵌樣式/],
  [({ html }) => html.replace('</main>', '<p>沒有相關經驗時，可以使用假設案例。</p></main>'), /worksheets\/EP71\/index.html: 替代自身經驗提示/],
  [({ html }) => html.replace('</main>', '<input class="inline-answer" id="ep71-bad-container"></main>'), /worksheets\/EP71\/index.html: 欄位 ep71-bad-container[\s\S]*容器樣式/],
  [({ html }) => html.replace('<main ', '<main data-layout-variant="unknown-audit" '), /未登錄的版式變體/],
  [({ html }) => html.replace(/class="page-count">\d+ \/ \d+</, 'class="page-count">99 \/ 99<'), /頁碼與實際頁數/],
  [({ html }) => html.replace('<h2>', '<h2>一、'), /EP71: 標題不應加數字或字母編號（含中文序數）/],
  [({ html }) => html.replace(/<h1>[\s\S]*?<\/h1>/, '<h1>舊主標</h1>'), /學習單須有唯一 h1 且主標與索引一致/],
]) {
  const result = checkFixture(change);
  assert.equal(result.exitCode, 1);
  assert.match(result.errors, expected);
}
const experienceDraft = checkFixture(undefined, text => `${text}\n若不想使用自己的經驗，可以沿用 W1 的假設情境。`);
assert.equal(experienceDraft.exitCode, 1);
assert.match(experienceDraft.errors, /content\/EP71\/EP71_corrected.md: 替代自身經驗提示/);
const numberedDraft = checkFixture(undefined, (text) => text.replace('## 活動', '## 一、活動'));
assert.equal(numberedDraft.exitCode, 1);
assert.match(numberedDraft.errors, /content\/EP71\/EP71_corrected.md: 標題不應加數字或字母編號（含中文序數）/);
const staleDraft = checkFixture(undefined, (text) => text.replace(/^# (.+)/, '# 舊標題\n\n正文引用：$1'));
assert.equal(staleDraft.exitCode, 1);
assert.match(staleDraft.errors, /修訂稿一級標題與索引不一致/);
