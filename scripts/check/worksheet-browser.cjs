const { spawnSync } = require('node:child_process');
const path = require('node:path');

const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (args.length !== 1 || !/^EP\d+$/i.test(args[0]))
  throw new Error('用法：node scripts/check/worksheet-browser.cjs EP編號，例如 EP71');
const result = spawnSync(process.execPath, [path.join(__dirname, 'browser.cjs'), '--source', '--ep', args[0].toUpperCase()],
  { stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
