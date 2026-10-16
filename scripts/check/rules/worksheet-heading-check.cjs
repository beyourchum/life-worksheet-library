const numberedHeadingPattern = /^(?:(?:\d+|[A-Za-z]|[一二三四五六七八九十百零〇兩]+)[.．、]|[（(](?:\d+|[A-Za-z]|[一二三四五六七八九十百零〇兩]+)[）)])\s*/;

function headingText(html) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
      if (!code.startsWith('#')) return entities[code.toLowerCase()];
      const point = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
    }).replace(/\s+/g, '');
}

function markdownTitleIssues(markdown, title, ep) {
  const body = String(markdown).replace(/^\uFEFF/, '')
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
  const headings = [...body.matchAll(/^#\s+(.+?)\s*#*\s*$/gm)].map((match) => match[1].trim());
  if (headings.length !== 1) return ['修訂稿須有且只有一個一級標題'];
  if (![title, `${ep}｜${title}`].includes(headings[0])) return ['修訂稿一級標題與索引不一致'];
  return [];
}

function numberedHtmlHeadings(html) {
  return [...html.matchAll(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)]
    .map((match) => match[2]
      .replace(/<!--[^]*?-->/g, '')
      .replace(/<span\b[^>]*\bclass\s*=\s*["'][^"']*\bsection-number\b[^"']*["'][^>]*>[^]*?<\/span\s*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
        const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
        return point <= 0x10ffff ? String.fromCodePoint(point) : _;
      })
      .replace(/&nbsp;/gi, ' ').trim())
    .filter((text) => numberedHeadingPattern.test(text));
}

function numberedMarkdownHeadings(markdown) {
  return [...markdown.matchAll(/^#{2,6}\s+(.+)$/gm)]
    .map((match) => match[1].replace(/[*_`]/g, '').trim())
    .filter((text) => numberedHeadingPattern.test(text));
}

module.exports = { headingText, markdownTitleIssues, numberedHeadingPattern, numberedHtmlHeadings, numberedMarkdownHeadings };
