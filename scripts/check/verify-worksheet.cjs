const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const ep = String(process.argv.slice(2).find((arg) => arg !== '--') || '').toUpperCase();
if (!/^EP\d+$/.test(ep)) throw new Error('用法：pnpm run verify -- EP編號，例如 EP71');

for (const [command, args] of [
  ...(fs.existsSync(`worksheet-sources/${ep}.json`) ? [[process.execPath, ['scripts/generate/worksheet-html.cjs', ep, '--check']]] : []),
  [process.execPath, ['scripts/check/worksheet.cjs', ep]],
  [process.execPath, ['scripts/check/worksheet-browser.cjs', ep]],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
