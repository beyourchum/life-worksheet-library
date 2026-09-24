const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const normalize = (text) => text.replace(/\r\n/g, '\n');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function youtubeId(url) {
  const parsed = new URL(url);
  const id = parsed.hostname === 'youtu.be' ? parsed.pathname.slice(1) : parsed.searchParams.get('v');
  if (!/^[\w-]{11}$/.test(id || '')) throw new Error(`無法取得 YouTube 影片 ID：${url}`);
  return id;
}

function validateSource(source, catalogItem, variants) {
  const errors = [];
  if (source.version !== 1) errors.push('version 必須是 1');
  if (source.ep !== catalogItem.ep) errors.push('ep 與 catalog/worksheets.json 不一致');
  for (const key of ['kicker', 'titleHtml', 'question']) if (!String(source.hero?.[key] || '').trim()) errors.push(`hero.${key} 不可空白`);
  if (/<(?!\/?em\b)[^>]+>/i.test(source.hero?.titleHtml || '') || /<em\b[^>]*\s(?:style|on\w+)\s*=/i.test(source.hero?.titleHtml || ''))
    errors.push('hero.titleHtml 只允許使用無屬性的 <em> 強調標記');
  if (!Array.isArray(source.pages) || !source.pages.length) errors.push('pages 至少需要一頁');
  for (const [index, page] of (source.pages || []).entries()) {
    if (!String(page.bodyHtml || '').trim()) errors.push(`pages[${index}].bodyHtml 不可空白`);
    if (!String(page.footer || '').trim()) errors.push(`pages[${index}].footer 不可空白`);
    if (/<(?:style|script)\b/i.test(page.bodyHtml || '') || /\sstyle\s*=/i.test(page.bodyHtml || ''))
      errors.push(`pages[${index}].bodyHtml 不得包含 style、script 或行內樣式；請使用共用元件或版式變體`);
  }
  for (const variant of source.layoutVariants || []) if (!variants.includes(variant)) errors.push(`未登錄的版式變體：${variant}`);
  if (!catalogItem.videoUrl) errors.push('catalog 缺少 videoUrl');
  if (!String(source.videoTitle || '').trim()) errors.push('videoTitle 不可空白');
  if (errors.length) throw new Error(`${source.ep || '未知集數'} 網頁來源格式錯誤：\n- ${errors.join('\n- ')}`);
}

function renderWorksheet(source, catalogItem, variants) {
  validateSource(source, catalogItem, variants);
  const total = source.pages.length;
  const variantAttribute = source.layoutVariants?.length
    ? ` data-layout-variant="${source.layoutVariants.map(escapeHtml).join(' ')}"`
    : '';
  const componentCss = source.useComponents ? '<link rel="stylesheet" href="../../assets/worksheet-components.css">' : '';
  const componentJs = source.useComponents ? '\n<script src="../../assets/worksheet-components.js" defer></script>' : '';
  const pages = source.pages.map((page, index) => {
    const number = String(index + 1).padStart(2, '0');
    const hero = index === 0 ? `<div class="worksheet-hero"><p class="hero-kicker">${escapeHtml(source.hero.kicker)}</p><h1>${source.hero.titleHtml}</h1><div class="hero-copy"><p class="hero-question">${escapeHtml(source.hero.question)}</p></div></div><div class="video-embed"><iframe src="https://www.youtube.com/embed/${youtubeId(catalogItem.videoUrl)}" title="${escapeHtml(source.videoTitle)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : '';
    return `<article class="page worksheet-page" aria-label="第 ${index + 1} 頁"><header class="page-meta"><strong>${escapeHtml(source.ep)}</strong><span>${escapeHtml(catalogItem.category)}</span><span class="page-count">${number} / ${String(total).padStart(2, '0')}</span></header>${hero}${page.bodyHtml}<footer class="page-footer"><strong>${escapeHtml(source.ep)}</strong><span>${escapeHtml(page.footer)}</span></footer></article>`;
  }).join('\n');
  return normalize(`<!doctype html>
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
<main class="worksheet" data-worksheet-id="${escapeHtml(source.ep)}"${variantAttribute}>
${pages}
</main>
<script src="../../assets/worksheet.js" defer></script>${componentJs}
</body>
</html>
`);
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
  const files = sourceFiles(ep);
  if (ep && !files.length) throw new Error(`${ep}: 缺少 worksheet-sources/${ep}.json`);
  for (const file of files) {
    const source = readJson(file);
    const item = catalog.find((entry) => entry.ep === source.ep && entry.worksheetUrl);
    if (!item) throw new Error(`${source.ep}: catalog/worksheets.json 沒有學習單入口`);
    const output = `worksheets/${source.ep}/index.html`;
    const rendered = renderWorksheet(source, item, variants);
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
