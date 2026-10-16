const containerClasses = Object.freeze([
  'inline-answer', 'answer-field', 'choices', 'choice', 'question-heading',
  'section-heading', 'subheading', 'matrix-options', 'matrix',
]);

function attributeText(value) {
  const entities = { amp: '&', quot: '"', apos: "'", Tab: '\t', NewLine: '\n' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|Tab|NewLine);/g, (entity, code) => {
    if (!code.startsWith('#')) return entities[code];
    const point = code.startsWith('#x') ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

function controlMarkupIssues(html) {
  const text = String(html || '');
  const tags = /<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
  const issues = [];
  for (let match; (match = tags.exec(text));) {
    if (!match[1] || match[0].startsWith('</')) continue;
    const tag = match[1].toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) {
      const attrs = {};
      const attributes = match[0].slice(match[1].length + 1, -1);
      for (const attr of attributes.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>`]+)))?/g)) {
        const name = attr[1].toLowerCase();
        if (!(name in attrs)) attrs[name] = attributeText(attr[2] ?? attr[3] ?? attr[4] ?? '');
      }
      const classes = (attrs.class || '').split(/\s+/).filter(name => containerClasses.includes(name));
      if (classes.length) issues.push(`欄位 ${attrs.id || attrs['aria-label'] || '未命名'} 的 <${tag}> 誤用容器樣式 ${classes.join('、')}；請將容器樣式移到外層，並依用途選用輸入框樣式`);
    }
    // Raw text may contain example markup that is not an actual form control.
    if (['script', 'style', 'textarea', 'title'].includes(tag)) {
      const closing = new RegExp(`</${tag}\s*>`, 'gi');
      closing.lastIndex = tags.lastIndex;
      tags.lastIndex = closing.exec(text) ? closing.lastIndex : text.length;
    }
  }
  return issues;
}

module.exports = { containerClasses, controlMarkupIssues };
