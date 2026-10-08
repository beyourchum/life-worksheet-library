const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (args.length !== 1 || !/^EP\d+$/i.test(args[0]))
  throw new Error('用法：node scripts/check/worksheet.cjs EP編號，例如 EP71');
require('./static.cjs');
