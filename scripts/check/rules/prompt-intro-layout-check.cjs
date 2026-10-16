const { promptMarkupIssues } = require('./prompt-markup-check.cjs');

async function promptIntroLayoutIssues(page) {
  const issues = promptMarkupIssues(await page.locator('main').innerHTML());
  return issues.concat(await page.evaluate(() => {
    const issues = [];
    const intro = document.querySelector('main .closing.prompt-intro');
    const heading = intro?.querySelector(':scope > h2');
    if (!intro || !heading) return issues;
    const range = document.createRange();
    range.selectNodeContents(heading);
    const lines = new Set([...range.getClientRects()].map(rect => Math.round(rect.top)));
    if (lines.size !== 1) issues.push('AI 幫幫忙標題被擠壓換行');
    const box = heading.getBoundingClientRect();
    for (const paragraph of intro.querySelectorAll(':scope > p')) {
      const rect = paragraph.getBoundingClientRect();
      if (Math.abs(rect.left - box.left) > 1 || rect.top < box.bottom - 1)
        issues.push('AI 說明須位於標題下方並對齊標題');
    }
    if (getComputedStyle(intro).borderTopWidth !== '0px' || getComputedStyle(intro).borderBottomWidth !== '0px')
      issues.push('AI 引導須使用共用無框線樣式，請移除額外分隔線');
    for (const quote of document.querySelectorAll('main .prompt-quote')) {
      const title = quote.querySelector(':scope > h3');
      const text = quote.querySelector(':scope > [data-prompt-text]');
      const button = quote.querySelector(':scope > [data-prompt-copy]');
      if (title && text && text.getBoundingClientRect().top < title.getBoundingClientRect().bottom - 1)
        issues.push('每份 AI 提示詞的標題與內容不得重疊');
      if (text && button && getComputedStyle(button).display !== 'none' &&
          button.getBoundingClientRect().top < text.getBoundingClientRect().bottom - 1)
        issues.push('複製按鈕須位於所屬提示詞下方');
    }
    return issues;
  }));
}

module.exports = { promptIntroLayoutIssues };
