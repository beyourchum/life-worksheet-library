const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const {start} = require('./server.cjs');
const {runReported} = require('./report.cjs');
const {validateEndingPolicy, worksheetEndingResults} = require('./rules/final-reminder-check.cjs');
const root = path.resolve(__dirname, '../..');
process.chdir(root);
const args = process.argv.slice(2).filter(arg => arg !== '--');
if (args.includes('--help')) {
  console.log('用法：node scripts/check/endings.cjs (--source | --built) [--ep EP編號]\n'+
    '檢查結尾結構、桌面、手機、正常字型與備援字型列印；不產生或修改頁面。\n'+
    '--source 檢查現有來源；--built 檢查已建置的 _site，需先執行 pnpm run build。\n'+
    '不符合規則時退出碼為 1；JSON 報告存於 .qa/reports/。');
  process.exit(0);
}
const epIndex = args.indexOf('--ep');
const ep = epIndex >= 0 ? args[epIndex + 1]?.toUpperCase() : undefined;
if (epIndex >= 0 && (!/^EP\d+$/.test(ep || '') || args.filter(arg => arg === '--ep').length !== 1))
  throw new Error('--ep 須指定且只能指定一個 EP編號');
const targetArgs = epIndex >= 0 ? args.filter((_, index) => index !== epIndex && index !== epIndex + 1) : args;
if (targetArgs.length !== 1 || !['--source', '--built'].includes(targetArgs[0]))
  throw new Error('請指定 --source 或 --built；使用 --help 查看用法');
const built = targetArgs[0] === '--built';
const reportFile = `.qa/reports/${ep ? ep+'-' : ''}ending-${built ? 'built' : 'source'}-report.json`;
runReported(reportFile, {scope:ep || 'all', target:built ? 'built' : 'source', rule:'final-reminder'}, async record => {
  const target = built ? path.join(root,'_site') : root;
  if (!fs.existsSync(target)) throw new Error('_site 不存在；請先執行 pnpm run build');
  const policy = JSON.parse(fs.readFileSync('config/quality-policy.json','utf8')).ending;
  validateEndingPolicy(policy);
  const items = JSON.parse(fs.readFileSync('catalog/worksheets.json','utf8')).filter(item => item.worksheetUrl && (!ep || item.ep === ep));
  if (!items.length) throw new Error(`${ep || '目錄'}: 沒有可檢查的學習單`);
  let browser, server;
  try {
    const started = await start(target); server = started.server;
    browser = await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
    for (const item of items) await record(item.ep, async () => {
      const results = await worksheetEndingResults(browser, started.base, item.worksheetUrl, policy);
      const issues = results.flatMap(({view,issues}) => issues.map(issue => `${view}: ${issue}`));
      if (issues.length) throw new Error(`${issues.join('\n')}\n修正 ${item.worksheetUrl} 的有效來源或覆寫樣式後重新驗收。`);
      return results;
    });
  } finally {
    try { await browser?.close(); }
    finally { if (server) await new Promise(resolve => server.close(resolve)); }
  }
}).then(report => { if (report.status !== 'passed') process.exitCode = 1; })
  .catch(error => { console.error(error); process.exitCode = 1; });
