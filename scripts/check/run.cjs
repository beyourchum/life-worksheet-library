const { spawnSync } = require('node:child_process');
const path = require('node:path');

process.chdir(path.resolve(__dirname, '../..'));
const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (args.length > 1 || (args.length === 1 && !/^EP\d+$/i.test(args[0]))) {
  throw new Error('用法：pnpm run verify [-- EP編號]，例如 pnpm run verify -- EP71');
}
const ep = args[0]?.toUpperCase();
const commands = ep
  ? [['scripts/check/verify-worksheet.cjs', ep]]
  : [['scripts/check/static.cjs'], ['scripts/check/browser.cjs', '--built']];

for (const commandArgs of commands) {
  const result = spawnSync(process.execPath, commandArgs, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
