const fs = require('node:fs');

function normalize(text) {
  return text.replace(/<!--\s*(?:end-)?example\s*-->/g, '')
    .replace(/例如[：:]?/g, '').replace(/[^\p{L}\p{N}]/gu, '');
}

function markdownTextUnits(md) {
  const withoutMetadata = md
    .replace(/^---\s*[\s\S]*?\r?\n---\s*/m, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/```[\s\S]*?```/g, '');
  const units = [];
  for (const rawLine of withoutMetadata.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(line)) continue;
    line = line.replace(/^#{1,6}\s+/, '').replace(/^>\s*/, '').replace(/^[-*+]\s+(?:\[[ xX]\]\s*)?/, '');
    if (/^(?:結尾|AI 幫幫忙)$/.test(line)) continue;
    const cells = (line.startsWith('|') && line.endsWith('|') ? line.slice(1, -1).split('|') : [line])
      .flatMap((cell) => cell.split('／'));
    for (let cell of cells) {
      cell = cell.replace(/^EP\d+｜/, '')
        .replace(/^(?:例如[：:]?)?(?:可確認的事|還不知道的事)[：:]?/, '例如：')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*_`~]/g, '')
        .trim();
      if (normalize(cell)) units.push(cell);
    }
  }
  return units;
}

function missingMarkdownText(md, pageText) {
  const normalizedPage = normalize(pageText);
  return markdownTextUnits(md).filter((text) => !normalizedPage.includes(normalize(text)));
}

async function worksheetContentIssues(page, ep) {
  const file = `content/${ep}/${ep}_corrected.md`;
  if (!fs.existsSync(file)) return process.env.GITHUB_ACTIONS === 'true' ? [] : [`${file}: 缺少修訂稿，請查來源後完成同步`];
  const md = fs.readFileSync(file, 'utf8');
  const blocks = await page.locator('main h1,main h2,main h3,main h4,main p,main li,main label').evaluateAll((elements) =>
    elements.map((element) => element.matches('label')
      ? element.querySelector('input[data-content-label]')?.dataset.contentLabel || element.textContent
      : element.textContent));
  const pageText = await page.locator('main').innerText();
  return [
    ...missingText(md, blocks).map(text => `${file}: HTML 文字未出現在修訂稿，請逐段核對：${text.trim()}`),
    ...missingMarkdownText(md, pageText).map(text => `${file}: 修訂稿文字未出現在 HTML，請逐段核對：${text.trim()}`),
  ];
}
function missingText(md, blocks) {
  const normalized = normalize(md);
  return blocks.filter(text => normalize(text) && !normalized.includes(normalize(text)));
}
async function worksheetStructureIssues(page, title, ep) {
  return page.evaluate(({ title, ep }) => {
    const issues = [];
    const clean = text => text.replace(/\s+/g, '').trim();
    const headings = document.querySelectorAll('main h1');
    if (headings.length !== 1 || clean(headings[0].textContent) !== clean(title)) issues.push('學習單主標題與索引不一致或不是唯一 h1');
    if (clean(document.title) !== clean(`${ep}｜${title}`)) issues.push('瀏覽器標題須為 EP｜學習單主標題');
    const heroQuestions = document.querySelectorAll('main .worksheet-hero .hero-question');
    if (heroQuestions.length !== 1) issues.push('主標下方須有且只有一則 hero-question 小標題');
    else if (!/[？?]$/.test(heroQuestions[0].textContent.trim())) issues.push('主標下方小標題須以問句指出學習單可以解決的問題');
    const endings = document.querySelectorAll('main .final-reminder');
    const ai = document.querySelectorAll('main .prompt-intro');
    const prompts = document.querySelectorAll('main [data-prompt-text]');
    const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) && !a.contains(b);
    if (endings.length !== 1) issues.push('結尾語須唯一');
    if (ai.length !== 1 || prompts.length !== 1) issues.push('AI 引導與提示詞須各有一處');
    if (endings.length === 1) {
      const ending = endings[0];
      const answers = [...document.querySelectorAll('main input:not([type="hidden"]):not([type="button"]):not([type="submit"]), main textarea, main select')];
      if (answers.some(answer => !before(answer, ending))) issues.push('結尾語須放在所有作答欄位之後');
      if (ai.length === 1 && !before(ending, ai[0])) issues.push('結尾語須放在 AI 引導之前');
      if (ai.length === 1 && prompts.length === 1 && !before(ai[0], prompts[0])) issues.push('AI 提示詞須放在 AI 引導之後');
    }
    return issues;
  }, { title, ep });
}
module.exports = { worksheetContentIssues, missingText, missingMarkdownText, markdownTextUnits, worksheetStructureIssues };
