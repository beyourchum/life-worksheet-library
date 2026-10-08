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
function checkFixture(change = ({ html }) => html) {
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
  [({ html }) => html.replace('<main ', '<main data-layout-variant="unknown-audit" '), /未登錄的版式變體/],
  [({ html }) => html.replace(/class="page-count">\d+ \/ \d+</, 'class="page-count">99 \/ 99<'), /頁碼與實際頁數/],
]) {
  const result = checkFixture(change);
  assert.equal(result.exitCode, 1);
  assert.match(result.errors, expected);
}
