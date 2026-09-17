async function worksheetStyleIssues(page) {
  return page.evaluate(() => {
    const issues = [];
    for (const input of document.querySelectorAll('.other-input')) {
      if (!input.closest('.other-choice')?.querySelector('.choice-toggle'))
        issues.push('其他填寫欄未與選項放在同一格：' + input.id);
    }
    for (const heading of document.querySelectorAll('.question-heading')) {
      const mode = heading.querySelector('.answer-mode')?.textContent || '';
      let next = heading.nextElementSibling;
      const inputs = [];
      while (next && next.matches('.choices,.answer-field')) {
        inputs.push(...next.querySelectorAll('input[type=radio],input[type=checkbox]'));
        next = next.nextElementSibling;
      }
      if (/單選/.test(mode) && inputs.length && (inputs.some(i => i.type !== 'radio' || !i.name) || new Set(inputs.map(i => i.name)).size !== 1))
        issues.push('單選未使用同組 radio：' + heading.textContent.trim());
      if (/複選|最多選/.test(mode) && inputs.some(i => i.type !== 'checkbox'))
        issues.push('複選未使用 checkbox：' + heading.textContent.trim());
    }
    for (const el of document.querySelectorAll('main p')) {
      if (/（(?:單選|可複選|最多選[^）]+)）/.test(el.textContent) && !el.closest('.matrix'))
        issues.push('題型標示混入正文：' + el.textContent.trim());
      if (/^(例如|舉例|示範答案)[：:]/.test(el.textContent.trim()) && !el.closest('.example-note,.choice-example'))
        issues.push('範例未套用灰字樣式：' + el.textContent.trim());
    }
    return issues;
  });
}
module.exports = { worksheetStyleIssues };
