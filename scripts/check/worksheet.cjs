const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

process.chdir(path.join(__dirname, '../..'));
const ep = String(process.argv.slice(2).find((arg) => arg !== '--') || '').toUpperCase();
if (!/^EP\d+$/.test(ep)) throw new Error('用法：node scripts/check/worksheet.cjs EP編號，例如 EP71');

const read = (file) => fs.readFileSync(file, 'utf8');
const items = JSON.parse(read('catalog/worksheets.json'));
const item = items.find((entry) => entry.ep === ep);
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(`${ep}: ${message}`); };

check(Boolean(item), '未登錄於 catalog/worksheets.json');
if (item) {
  check(item.worksheetUrl === `worksheets/${ep}/`, '學習單路徑與集數不一致');
  for (const key of ['title', 'summary', 'category']) check(typeof item[key] === 'string' && item[key].trim(), `缺少 ${key}`);
}

const htmlFile = `worksheets/${ep}/index.html`;
const sourceFile = `content/${ep}/${ep}_source.md`;
const correctedFile = `content/${ep}/${ep}_corrected.md`;
check(fs.existsSync(htmlFile), `缺少 ${htmlFile}`);
check(fs.existsSync(sourceFile), `缺少 ${sourceFile}`);
check(fs.existsSync(correctedFile), `缺少 ${correctedFile}`);

if (item && fs.existsSync(htmlFile)) {
  const html = read(htmlFile);
  for (const issue of require('./rules/video-policy.cjs').videoEmbedIssues(html, item)) errors.push(issue);
  check(html.includes(`<title>${ep}｜${item.title}</title>`), '頁面標題與索引不一致');
  check(html.includes(`data-worksheet-id="${ep}"`), '暫存識別碼不一致');
  check(html.includes('../../assets/worksheet.css') && html.includes('../../assets/worksheet.js'), '未引用共用檔案');
  check(/class="[^"]*\bfinal-reminder\b/.test(html), '缺少結尾');
  check(/data-prompt-text/.test(html) && /data-prompt-copy/.test(html), '缺少 AI 提示詞或複製按鈕');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  check(new Set(ids).size === ids.length, 'HTML id 重複');
  for (const match of html.matchAll(/\bfor="([^"]+)"/g)) check(ids.includes(match[1]), `找不到標籤目標 ${match[1]}`);

  const manifestFile = 'assets/fonts/worksheet/compact/manifest.json';
  check(fs.existsSync(manifestFile), '缺少精簡字型 manifest');
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(read(manifestFile));
    const input = htmlFile.replaceAll('\\', '/');
    const hash = createHash('sha256').update(html.replace(/\r\n/g, '\n')).digest('hex');
    check(manifest.inputs?.[input] === hash, 'HTML 已改變，請先執行 pnpm run fonts:worksheet -- ' + ep);
    check(Boolean(manifest.scopes?.[ep]), '精簡字型尚未收錄此頁');
    check(fs.existsSync(`assets/fonts/worksheet/compact/${ep}/fonts.css`), '缺少本頁精簡字型 CSS');
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${ep} 單集靜態檢查通過；這不代表全站 verify 或發布驗收通過。`);
}
