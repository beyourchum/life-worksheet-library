function promptMarkupIssues(html) {
  const issues = [];
  const clean = text => text.replace(/<[^>]*>/g, '').replace(/\s+/g, '').trim();
  const asides = [...html.matchAll(/<aside\b[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/aside>/g)];
  const intros = asides.filter(match => match[1].split(/\s+/).includes('prompt-intro'));
  if (intros.length !== 1) issues.push('AI 引導須唯一，請保留一個 aside.closing.prompt-intro');
  const intro = intros[0];
  if (intro) {
    const shape = /^\s*<span class="closing-mark">→<\/span>\s*<h2>AI 幫幫忙<\/h2>\s*(?:<p\b[^>]*>[\s\S]*?<\/p>\s*)+$/;
    if (!intro[1].split(/\s+/).includes('closing') || !shape.test(intro[2]))
      issues.push('AI 引導須依序直接放綠色箭頭、唯一 h2「AI 幫幫忙」及說明 p；請移入框外標題並移除包裝區塊');
    const ps = [...intro[2].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)];
    if (!ps.length || ps.some(match => !clean(match[1]))) issues.push('AI 引導須有非空白說明，請補上用途與代入或填寫方式');
    if (ps.some(match => /AI幫幫忙/.test(clean(match[1])))) issues.push('AI 引導名稱只能出現一次，請移除說明中的「AI 幫幫忙：」');
  }
  const headings = [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g)].filter(match => clean(match[1]) === 'AI幫幫忙');
  if (headings.length !== 1 || !intro || headings[0].index < intro.index || headings[0].index >= intro.index + intro[0].length)
    issues.push('「AI 幫幫忙」標題須唯一且位於引導框內，請移除框外或重複標題');
  const quotes = asides.filter(match => match[1].split(/\s+/).includes('prompt-quote'));
  if (!quotes.length) issues.push('AI 引導後至少需要一個 aside.prompt-quote');
  const labels = new Set();
  for (const [index, quote] of quotes.entries()) {
    const body = quote[2];
    const titles = [...body.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g)];
    const texts = [...body.matchAll(/\bdata-prompt-text(?:\s|=|>)/g)];
    const promptText = body.match(/<div\b[^>]*\bdata-prompt-text[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
    const buttons = [...body.matchAll(/<button\b[^>]*\bdata-prompt-copy(?:\s|=|>)/g)];
    const shape = /^\s*(?:<h3>[^<]+<\/h3>\s*)?<div class="prompt-copy-text"\s+data-prompt-text(?:="")?>\s*<p\b[^>]*>[\s\S]+<\/div>\s*<button\b[^>]*\bdata-prompt-copy[^>]*>[\s\S]*?<\/button>\s*$/;
    if (texts.length !== 1 || buttons.length !== 1 || titles.length > 1 || !shape.test(body))
      issues.push(`第 ${index + 1} 份 AI 提示詞須有獨立內容與一個複製按鈕；每框最多一個 h3，並依標題、內容、按鈕排列`);
    if (!clean(promptText)) issues.push(`第 ${index + 1} 份 AI 提示詞內容不可空白，請恢復有效稿內容`);
    if (quotes.length > 1 && (titles.length !== 1 || !clean(titles[0][1])))
      issues.push(`多份 AI 提示詞須各有一個非空白 h3 標題，請補齊第 ${index + 1} 份`);
    if (titles.length === 1) {
      const title = clean(titles[0][1]);
      if (labels.has(title)) issues.push(`AI 提示詞標題重複：${title}；請讓每份用途可辨識`);
      labels.add(title);
    }
    if (!intro || quote.index < intro.index + intro[0].length) issues.push('每份 AI 提示詞都須放在引導框之後');
  }
  if ((html.match(/\bdata-prompt-text(?:\s|=|>)/g) || []).length !== quotes.length ||
      (html.match(/<button\b[^>]*\bdata-prompt-copy(?:\s|=|>)/g) || []).length !== quotes.length)
    issues.push('每份 AI 提示詞須使用自己的 prompt-quote，請移入框外內容或複製按鈕');
  return issues;
}

module.exports = { promptMarkupIssues };
