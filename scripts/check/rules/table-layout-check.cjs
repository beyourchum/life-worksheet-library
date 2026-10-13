const { tableLayout } = require('../../../config/quality-policy.json');
async function tableLayoutIssues(page) {
  const tolerance = tableLayout?.geometryTolerancePx;
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('quality-policy.json 的 tableLayout.geometryTolerancePx 必須為非負數');
  return page.evaluate((tolerance) => {
    const issues = [];
    const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    for (const table of document.querySelectorAll('.worksheet table')) {
      for (const cell of table.querySelectorAll('th,td')) {
        if (!visible(cell)) continue;
        const head = cell.closest('thead');
        if (head && head.getBoundingClientRect().width <= 1 && head.getBoundingClientRect().height <= 1 && getComputedStyle(head).clipPath !== 'none') continue;
        const box = cell.getBoundingClientRect();
        const identify = cell.textContent.trim().slice(0, 50);
        if (cell.scrollWidth > cell.clientWidth + tolerance) issues.push('儲存格內容溢出：' + identify);
        for (const el of cell.querySelectorAll('label,input,textarea,select')) {
          if (!visible(el)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.left < box.left - tolerance || rect.right > box.right + tolerance || rect.top < box.top - tolerance || rect.bottom > box.bottom + tolerance)
            issues.push('表格控制超出儲存格：' + (el.id || identify));
        }
        const choices = [...cell.querySelectorAll('.choice')].filter(visible);
        for (let i = 0; i < choices.length; i++) for (let j = i + 1; j < choices.length; j++) {
          const a = choices[i].getBoundingClientRect(), b = choices[j].getBoundingClientRect();
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > tolerance && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > tolerance)
            issues.push('表格選項重疊：' + identify);
        }
      }
    }
    return issues;
  }, tolerance);
}
module.exports = { tableLayoutIssues };
