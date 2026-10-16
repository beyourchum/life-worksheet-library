const { containerClasses } = require('./control-markup-check.cjs');

async function controlLayoutIssues(page) {
  return page.evaluate((containerClasses) => {
    const issues = [];
    for (const input of document.querySelectorAll('main input,main textarea,main select')) {
      const id = input.id || input.getAttribute('aria-label') || '未命名';
      const misused = containerClasses.filter(name => input.classList.contains(name));
      if (misused.length) issues.push(`欄位 ${id} 誤用容器樣式 ${misused.join('、')}；請將容器樣式移到外層`);
      if (input.matches('[type=radio],[type=checkbox],[type=hidden]') || !input.getClientRects().length || input.closest('.answer-field')) continue;
      const sentence = input.closest('p,li,label');
      if (!sentence || sentence.closest('pre,code')) continue;
      // Flex/grid items are blockified by the browser even with valid inline styles.
      if (['flex', 'inline-flex', 'grid', 'inline-grid'].includes(getComputedStyle(input.parentElement).display)) continue;
      const before = document.createRange(), after = document.createRange();
      before.selectNodeContents(sentence);
      before.setEndBefore(input);
      after.selectNodeContents(sentence);
      after.setStartAfter(input);
      const prose = range => {
        const copy = range.cloneContents();
        copy.querySelectorAll('input,textarea,select,button,script,style').forEach(el => el.remove());
        return copy.textContent.trim();
      };
      const display = getComputedStyle(input).display;
      if (prose(before) && prose(after) && ['block', 'flex', 'grid', 'list-item', 'table'].includes(display))
        issues.push(`句中欄位 ${id} 使用 ${display} 排版，會切斷前後文字；請改用行內輸入框，或拆成 answer-field 獨立欄位`);
    }
    return issues;
  }, containerClasses);
}

module.exports = { controlLayoutIssues };
