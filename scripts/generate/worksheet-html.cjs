const fs = require('node:fs');
const path = require('node:path');
const { videoRequirement, youtubeId } = require('../check/rules/video-policy.cjs');
const { headingText, numberedHtmlHeadings } = require('../check/rules/worksheet-heading-check.cjs');
const { promptMarkupIssues } = require('../check/rules/prompt-markup-check.cjs');
const { controlMarkupIssues } = require('../check/rules/control-markup-check.cjs');
const { experiencePromptIssues, sourceExperiencePromptIssues } = require('../check/rules/experience-prompt-check.cjs');

const root = path.resolve(__dirname, '../..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const normalize = (text) => text.replace(/\r\n/g, '\n');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const normalizeBodyHtml = (html) => String(html).replace(/\bclass='([^']*)'/g, 'class="$1"');
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const applyFallbackGlyphs = (html, glyphs = []) => {
  const characters = [...new Set(glyphs.map(String).filter(Boolean))];
  if (!characters.length) return String(html);
  const pattern = new RegExp(`(${characters.map(escapeRegExp).join('|')})`, 'g');
  return String(html).split(/(<[^>]*>)/g).map((part, index) => (
    index % 2 ? part : part.replace(pattern, '<span class="glyph-system-fallback">$1</span>')
  )).join('');
};

function validateSource(source, catalogItem, variants, videoExceptions = []) {
  const errors = [];
  errors.push(...sourceExperiencePromptIssues(source));
  if (source.version !== 1) errors.push('version 必須是 1');
  if (source.ep !== catalogItem.ep) errors.push('ep 與 catalog/worksheets.json 不一致');
  for (const key of ['kicker', 'titleHtml', 'question']) if (!String(source.hero?.[key] || '').trim()) errors.push(`hero.${key} 不可空白`);
  if (headingText(source.hero?.titleHtml) !== String(catalogItem.title || '').replace(/\s+/g, ''))
    errors.push('hero.titleHtml 文字與 catalog/worksheets.json 的 title 不一致；請同步學習單主標，影片原名保留在 videoTitle 與頁尾');
  if (/<(?!\/?em\b)[^>]+>/i.test(source.hero?.titleHtml || '') || /<em\b[^>]*\s(?:style|on\w+)\s*=/i.test(source.hero?.titleHtml || ''))
    errors.push('hero.titleHtml 只允許使用無屬性的 <em> 強調標記');
  if (!Array.isArray(source.pages) || !source.pages.length) errors.push('pages 至少需要一頁');
  if (source.calculator !== undefined) {
    if (!['planning-buffer', 'heart-rate'].includes(source.calculator?.name)) errors.push('calculator.name 必須對應共用元件 planning-buffer 或 heart-rate');
    if (source.calculator?.layout !== undefined && typeof source.calculator.layout !== 'boolean') errors.push('calculator.layout 必須是布林值');
    if (!source.useComponents) errors.push('calculator 必須搭配 useComponents 載入共用互動');
  }
  if (source.fallbackGlyphs !== undefined && (!Array.isArray(source.fallbackGlyphs) || source.fallbackGlyphs.some((glyph) => String(glyph).length !== 1)))
    errors.push('fallbackGlyphs 必須是單一字元陣列');
  for (const [index, page] of (source.pages || []).entries()) {
    for (const issue of controlMarkupIssues(page.bodyHtml)) errors.push(`pages[${index}].bodyHtml：${issue}`);
    const numbered = numberedHtmlHeadings(String(page.bodyHtml || ''));
    if (numbered.length) errors.push(`pages[${index}].bodyHtml 標題含序數：${numbered.join('、')}；請移除標題前綴，保留獨立 section-number 區塊編號`);
    if (!String(page.bodyHtml || '').trim()) errors.push(`pages[${index}].bodyHtml 不可空白`);
    if (!String(page.footer || '').trim()) errors.push(`pages[${index}].footer 不可空白`);
    if (/<(?:style|script)\b/i.test(page.bodyHtml || '') || /\sstyle\s*=/i.test(page.bodyHtml || ''))
      errors.push(`pages[${index}].bodyHtml 不得包含 style、script 或行內樣式；請使用共用元件或版式變體`);
  }
  for (const variant of source.layoutVariants || []) if (!variants.includes(variant)) errors.push(`未登錄的版式變體：${variant}`);
  const videoError = videoRequirement(catalogItem, videoExceptions);
  if (videoError) errors.push(videoError);
  if (catalogItem.videoUrl) {
    if (!youtubeId(catalogItem.videoUrl)) errors.push('videoUrl 必須是有效的 YouTube HTTPS 網址');
    if (!String(source.videoTitle || '').trim()) errors.push('videoTitle 不可空白');
  }
  if (errors.length) throw new Error(`${source.ep || '未知集數'} 網頁來源格式錯誤：\n- ${errors.join('\n- ')}`);
}

function renderWorksheet(source, catalogItem, variants, videoExceptions = []) {
  validateSource(source, catalogItem, variants, videoExceptions);
  const renderedPages = [];
  for (const page of source.pages) {
    let bodyHtml = String(page.bodyHtml || '');
    for (const replacement of source.textReplacements || []) {
      if (replacement.page !== source.pages.indexOf(page)) continue;
      bodyHtml = bodyHtml.replaceAll(String(replacement.from), String(replacement.to));
    }
    const chunks = bodyHtml.split("<div data-page-split='before'></div>");
    for (const chunk of chunks) renderedPages.push({ ...page, bodyHtml: chunk });
  }
  const total = renderedPages.length;
  const variantAttribute = source.layoutVariants?.length
    ? ` data-layout-variant="${source.layoutVariants.map(escapeHtml).join(' ')}"`
    : '';
  const calculatorAttribute = source.calculator
    ? ` data-calculator="${escapeHtml(source.calculator.name)}"${source.calculator.layout ? ' data-calculator-layout' : ''}` : '';
  const componentCss = source.useComponents ? '<link rel="stylesheet" href="../../assets/worksheet-components.css">' : '';
  const componentJs = source.useComponents ? '\n<script src="../../assets/worksheet-components.js" defer></script>' : '';
  const pages = renderedPages.map((page, index) => {
    const number = String(index + 1).padStart(2, '0');
    const video = catalogItem.videoUrl ? `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${youtubeId(catalogItem.videoUrl)}" title="${escapeHtml(source.videoTitle)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : '';
    const hero = index === 0 ? `<div class="worksheet-hero"><p class="hero-kicker">${applyFallbackGlyphs(escapeHtml(source.hero.kicker), source.fallbackGlyphs)}</p><h1>${applyFallbackGlyphs(source.hero.titleHtml, source.fallbackGlyphs)}</h1><div class="hero-copy"><p class="hero-question">${applyFallbackGlyphs(escapeHtml(source.hero.question), source.fallbackGlyphs)}</p></div></div>${video}` : '';
    let bodyHtml = String(page.bodyHtml || '');
    bodyHtml += source.contentSyncHtml?.[index] || '';
    const controlIssues = controlMarkupIssues(bodyHtml);
    if (controlIssues.length) throw new Error(`${source.ep}: pages[${index}] 套用 textReplacements／contentSyncHtml 後欄位樣式錯誤：\n- ${controlIssues.join('\n- ')}`);
    const numbered = numberedHtmlHeadings(bodyHtml);
    if (numbered.length) throw new Error(`${source.ep}: pages[${index}] 套用 textReplacements／contentSyncHtml 後標題含序數：${numbered.join('、')}；請移除標題前綴，保留獨立 section-number 區塊編號`);
    return `<article class="page worksheet-page" aria-label="第 ${index + 1} 頁"><header class="page-meta"><strong>${escapeHtml(source.ep)}</strong><span>${escapeHtml(catalogItem.category)}</span><span class="page-count">${number} / ${String(total).padStart(2, '0')}</span></header>${hero}${applyFallbackGlyphs(normalizeBodyHtml(bodyHtml), source.fallbackGlyphs)}<footer class="page-footer"><strong>${escapeHtml(source.ep)}</strong><span>${applyFallbackGlyphs(escapeHtml(page.footer), source.fallbackGlyphs)}</span></footer></article>`;
  }).join('\n');
  const rendered = normalize(`<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<link rel="stylesheet" href="../../assets/fonts/worksheet/compact/${escapeHtml(source.ep)}/fonts.css">
<title>${escapeHtml(source.ep)}｜${escapeHtml(catalogItem.title)}</title>
<link rel="stylesheet" href="../../assets/worksheet.css">
${componentCss}
</head>
<body>
<div class="toolbar" aria-label="學習單工具"><nav class="worksheet-nav" aria-label="學習單導覽"><a href="../../index.html">返回內容索引</a><a data-video-link hidden target="_blank" rel="noopener noreferrer">觀看影片</a><span data-video-status hidden>影片連結無法載入，請返回內容索引。</span></nav><button class="toolbar-button primary" data-print type="button">列印／另存 PDF</button><div class="toolbar-details"><div class="draft-info"><span class="save-status" aria-live="polite" data-save-status>尚未填寫</span><p class="draft-hint">作答僅保留於目前分頁，關閉前請先列印或另存 PDF。</p></div><button class="toolbar-button clear-button" id="clear-draft" data-clear type="button" disabled>清除作答</button></div></div>
<aside class="worksheet-use-notice" aria-label="作答與保存說明"><p>本網站不會將作答上傳或儲存至後台，可以安心從自己的問題開始填寫，另存 PDF 後和信任的人討論。</p><p>作答只暫存於目前分頁；按「清除作答」即可刪除本分頁暫存。已下載的檔案請自行保管；複製至外部 AI 的內容由該服務處理。</p></aside>
<main class="worksheet" data-worksheet-id="${escapeHtml(source.ep)}"${variantAttribute}${calculatorAttribute}>
${pages}
</main>
<script src="../../assets/worksheet.js" defer></script>${componentJs}
</body>
</html>
`);
  if (rendered.includes('prompt-intro')) {
    const issues = promptMarkupIssues(rendered);
    if (issues.length) throw new Error(`${source.ep}: AI 區結構錯誤：\n- ${issues.join('\n- ')}`);
  }
  const experienceIssues = experiencePromptIssues(rendered);
  if (experienceIssues.length) throw new Error(`${source.ep}: 產生後經驗提示不通過：\n- ${experienceIssues.join('\n- ')}`);
  return rendered;
}

function sourceFiles(ep) {
  if (ep) {
    const file = `worksheet-sources/${ep}.json`;
    return fs.existsSync(path.join(root, file)) ? [file] : [];
  }
  if (!fs.existsSync(path.join(root, 'worksheet-sources'))) return [];
  return fs.readdirSync(path.join(root, 'worksheet-sources'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^EP\d+\.json$/.test(entry.name))
    .map((entry) => `worksheet-sources/${entry.name}`);
}

function generate({ ep, check = false } = {}) {
  const catalog = readJson('catalog/worksheets.json');
  const variants = readJson('config/worksheet-layouts.json').variants;
  const { videoExceptions } = readJson('config/quality-exceptions.json');
  const files = sourceFiles(ep);
  if (ep && !files.length) throw new Error(`${ep}: 缺少 worksheet-sources/${ep}.json`);
  for (const file of files) {
    const source = readJson(file);
    const item = catalog.find((entry) => entry.ep === source.ep && entry.worksheetUrl);
    if (!item) throw new Error(`${source.ep}: catalog/worksheets.json 沒有學習單入口`);
    const output = `worksheets/${source.ep}/index.html`;
    const rendered = renderWorksheet(source, item, variants, videoExceptions);
    if (check) {
      if (!fs.existsSync(path.join(root, output)) || normalize(fs.readFileSync(path.join(root, output), 'utf8')) !== rendered)
        throw new Error(`${source.ep}: 產生後 HTML 已過期，請執行 pnpm run html:worksheet -- ${source.ep}`);
    } else {
      fs.mkdirSync(path.dirname(path.join(root, output)), { recursive: true });
      fs.writeFileSync(path.join(root, output), rendered);
      console.log(`${source.ep}: 已依共用骨架產生 ${output}`);
    }
  }
  if (!files.length) console.log('目前沒有採用結構化網頁來源的頁面；既有頁面維持原樣。');
}

if (require.main === module) {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const ep = args.find((arg) => /^EP\d+$/i.test(arg))?.toUpperCase();
  const check = args.includes('--check');
  try { generate({ ep, check }); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { escapeHtml, renderWorksheet, validateSource, youtubeId, generate };
