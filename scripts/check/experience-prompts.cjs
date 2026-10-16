const fs = require('node:fs');
const path = require('node:path');
const { experiencePromptIssues, sourceExperiencePromptIssues } = require('./rules/experience-prompt-check.cjs');

function checkExperienceFiles(files) {
  const issues = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const found = file.endsWith('.json') ? sourceExperiencePromptIssues(JSON.parse(text))
      : experiencePromptIssues(text, file.endsWith('.md') ? 'markdown' : 'html');
    for (const issue of found) issues.push(`${file}: ${issue}`);
  }
  return issues;
}

if (require.main === module) {
  process.chdir(path.resolve(__dirname, '../..'));
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  if (args.length > 1 || (args.length && !/^EP\d+$/i.test(args[0])))
    throw new Error('用法：pnpm run check:experience [-- EP編號]');
  const ep = args[0]?.toUpperCase();
  const folders = ep ? [ep] : [...new Set([
    ...fs.readdirSync('content'),
    ...fs.readdirSync('worksheet-sources').map(file => path.basename(file, '.json')),
    ...fs.readdirSync('worksheets'),
  ])].filter(name => /^EP\d+$/.test(name));
  const files = folders.flatMap(name => [
    `content/${name}/${name}_corrected.md`, `worksheet-sources/${name}.json`, `worksheets/${name}/index.html`,
  ]).filter(file => fs.existsSync(file));
  if (!files.length) throw new Error(`${ep || '全站'}: 找不到可檢查的修訂稿、結構化來源或 HTML`);
  const issues = checkExperienceFiles(files);
  if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
  else console.log(`經驗提示檢查通過：${folders.length} 集、${files.length} 份現有檔案；語意與必要案例用途仍須人工核對。`);
}

module.exports = { checkExperienceFiles };
