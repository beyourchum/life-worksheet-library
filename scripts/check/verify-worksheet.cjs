const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (args.length !== 1 || !/^EP\d+$/i.test(args[0]))
  throw new Error('用法：pnpm run verify -- EP編號，例如 EP71');
require('./run.cjs');
