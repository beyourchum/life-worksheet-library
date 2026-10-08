async function promptIntroLayoutIssues(page) {
  return page.locator('h2').evaluateAll((headings) => headings
    .filter((heading) => heading.textContent.replace(/\s/g, '') === 'AI幫幫忙')
    .flatMap((heading) => {
      const issues = [];
      const range = document.createRange();
      range.selectNodeContents(heading);
      const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
      if (lines.size !== 1) issues.push('AI 幫幫忙標題被擠壓換行');
      if (heading.parentElement.matches('.closing.prompt-intro')) {
        const box = heading.getBoundingClientRect();
        for (const paragraph of [...heading.parentElement.children].filter((el) => el.tagName === 'P')) {
          const rect = paragraph.getBoundingClientRect();
          if (Math.abs(rect.left - box.left) > 1 || rect.top < box.bottom - 1)
            issues.push('AI 說明須位於標題下方並對齊標題');
        }
      }
      return issues;
    }));
}

module.exports = { promptIntroLayoutIssues };
