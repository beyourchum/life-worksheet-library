const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { publicPath } = require('../../scripts/build/publish-files.cjs');

for (const file of ['index.html', '.nojekyll', 'data/catalog.json', 'data/search-index.json',
  'worksheets/EP48/index.html', 'worksheets/EP48/metadata.json', 'assets/worksheet.js',
  'assets/fonts/worksheet/compact/EP48/fonts.css', 'assets/fonts/worksheet/compact/home/glow-800.woff2'])
  assert(publicPath(file), file);
for (const file of ['AGENTS.md', 'docs/quality.md', 'debug.log', 'worksheet-sources/EP48.json',
  'worksheets/EP48/debug.log', 'worksheets/EP48/EP48_corrected.md', 'worksheets/EP48/private.json',
  'data/local-report.json', 'assets/fonts/worksheet/compact/manifest.json'])
  assert(!publicPath(file), file);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'worksheet-build-boundary-'));
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true });
  fs.writeFileSync(path.join(temporary, file), text);
};
try {
  for (const name of ['site.cjs', 'publish-files.cjs']) {
    fs.mkdirSync(path.join(temporary, 'scripts/build'), { recursive: true });
    fs.copyFileSync(path.join(__dirname, '../../scripts/build', name), path.join(temporary, 'scripts/build', name));
  }
  for (const file of ['index.html', '.nojekyll', 'data/catalog.json', 'data/search-index.json',
    'worksheets/EP48/index.html', 'worksheets/EP48/metadata.json', 'assets/worksheet.js',
    'assets/fonts/worksheet/compact/EP48/fonts.css', 'assets/fonts/worksheet/compact/EP48/genyo-400.woff2'])
    write(file, 'public fixture');
  write('assets/fonts/worksheet/compact/manifest.json', JSON.stringify({ scopes: { EP48: { fonts: { 'genyo-400': {} } } } }));
  const privateFiles = ['docs/quality.md', 'AGENTS.md', 'debug.log', 'data/local-report.json',
    'worksheets/EP48/debug.log', 'worksheets/EP48/EP48_corrected.md', 'worksheets/EP48/private.json'];
  for (const file of privateFiles) write(file, 'private fixture');
  execFileSync(process.execPath, [path.join(temporary, 'scripts/build/site.cjs')], { cwd: temporary, stdio: 'pipe' });
  assert(fs.existsSync(path.join(temporary, '_site/worksheets/EP48/index.html')));
  assert(fs.existsSync(path.join(temporary, '_site/assets/fonts/worksheet/compact/EP48/genyo-400.woff2')));
  for (const file of privateFiles) {
    assert(!fs.existsSync(path.join(temporary, '_site', file)), `${file} 不得進入發布產物`);
    assert.equal(fs.readFileSync(path.join(temporary, file), 'utf8'), 'private fixture');
  }
} finally {
  if (!path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
      !path.basename(temporary).startsWith('worksheet-build-boundary-')) throw new Error('拒絕清理非測試暫存目錄');
  fs.rmSync(temporary, { recursive: true, force: true });
}
