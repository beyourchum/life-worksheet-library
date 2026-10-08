const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { runReported } = require('./report.cjs');

process.chdir(path.resolve(__dirname, '../..'));
const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (args.length > 1 || (args.length === 1 && !/^EP\d+$/i.test(args[0]))) {
  throw new Error('用法：pnpm run verify [-- EP編號]，例如 pnpm run verify -- EP71');
}
const ep = args[0]?.toUpperCase();
const commands = ep
  ? [['scripts/check/worksheet.cjs', ep], ['scripts/check/worksheet-browser.cjs', ep]]
  : [['scripts/check/static.cjs'], ['scripts/check/browser.cjs', '--built']];

runReported(path.join('.qa/reports', ep ? `${ep}-verify-report.json` : 'verify-report.json'),
  { scope: ep || 'all', target: ep ? 'source' : 'built' }, async (record) => {
    for (const commandArgs of commands) {
      const passed = await record(commandArgs[0], async () => {
        const result = spawnSync(process.execPath, commandArgs, { stdio: ['ignore', 'inherit', 'pipe'], encoding: 'utf8', shell: false });
        if (result.stderr) process.stderr.write(result.stderr);
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(`命令失敗（退出碼 ${result.status ?? 1}）：${commandArgs.join(' ')}\n${result.stderr || ''}`.trim());
        return { command: commandArgs, exitCode: result.status };
      });
      if (!passed) break;
    }
  }).then((report) => { if (report.status !== 'passed') process.exitCode = 1; })
  .catch((error) => { console.error(error); process.exitCode = 1; });
