const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, '_site');
// Only this generated directory may be replaced; reject redirected targets.
if (fs.existsSync(output)) {
  if (fs.lstatSync(output).isSymbolicLink() || fs.realpathSync(output) !== path.join(fs.realpathSync(root), '_site')) throw new Error('_site 路徑不安全，建置中止。');
  fs.rmSync(output, { recursive: true });
}
fs.mkdirSync(output);
const copy = (name) => { fs.mkdirSync(path.dirname(path.join(output, name)), { recursive: true }); fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true }); };
for (const name of ['index.html', '.nojekyll', 'data', 'worksheets']) copy(name);
if (fs.existsSync(path.join(root, 'articles'))) copy('articles');
for (const name of fs.readdirSync(path.join(root, 'assets'))) if (/\.(css|js)$/.test(name)) copy('assets/' + name);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/fonts/worksheet/compact/manifest.json'), 'utf8'));
for (const [scope, { fonts }] of Object.entries(manifest.scopes)) {
  const dir = 'assets/fonts/worksheet/compact/' + scope + '/';
  copy(dir + 'fonts.css');
  for (const name of Object.keys(fonts)) copy(dir + name + '.woff2');
}
console.log('網站已建置至 _site；此命令不執行靜態或瀏覽器檢查。');
