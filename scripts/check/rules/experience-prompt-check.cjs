const { headingText } = require('./worksheet-heading-check.cjs');

// Match instructions that substitute for the reader's experience, not the word 假設 itself.
const substitutionPatterns = [
  /(?:沒有(?:相關|相似|合適|適合|特定)?[^。！？]{0,20}(?:經驗|情境|案例|任務|對象|收入)|(?:若|如果)?(?:目前|暫時)?想不到|不想(?:使用|分享|談|寫|回答|判斷)|不願(?:使用|分享))[^。！？]{0,100}(?:假設|想像|虛構|編一個|編造|捏造|沿用[^。！？]{0,30}(?:情境|案例|範例)|把主角改成)/,
  /(?:改用|換成|改寫成|可(?:以)?(?:使用|用)|也可(?:以)?(?:使用|用))[^。！？]{0,20}(?:假設(?:情境|案例|任務|金額)|虛構(?:情境|案例)|想像一個)/,
  /(?:真實或假設|真實或想像|記得[／/]想像中|對象[／/]假設角色|沒有適合分享的真實情境)/,
  /(?:如果|若)[^。！？]{0,15}資訊不足[^。！？]{0,40}提供[^。！？]{0,15}假設版本/,
  /(?:不想|不願)(?:分享|寫自己的事|談自己的事)[^。！？]{0,30}(?:可(?:以)?(?:跳過|略過|不填)|改(?:寫|用)[^。！？]{0,20}(?:他人|別人|某位大學生))/,
  /(?:不必寫姓名或細節|只寫到自己覺得安全的程度)/,
];

function experiencePromptIssues(input, format = 'html') {
  let body = String(input || '').replace(/^\uFEFF/, '');
  if (format === 'markdown') body = body.replace(/<!--\s*example:\s*([\s\S]*?)-->/g, '$1');
  body = body.replace(/<!--[\s\S]*?-->/g, '');
  if (format === 'markdown') {
    body = body.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
      .replace(/!?(\[[^\]]*\])\([^)]*\)/g, '$1').replace(/[*_`]/g, '')
      .split(/\r?\n\s*\r?\n/).map(paragraph => paragraph.replace(/\r?\n/g, '')).join('\n');
  } else {
    body = body.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/\r?\n/g, '')
      .replace(/<\/(?:p|h[1-6]|li|label|td|th|div|section|aside|article|footer)\s*>|<br\s*\/?>/gi, '\n');
  }
  const issues = [];
  for (const line of body.split(/\r?\n/)) {
    for (const sentence of headingText(line).split(/[。！？]/)) {
      // A prohibition on fabrication is not an invitation to fabricate.
      const candidate = sentence.replace(/(?:不要|不得|不能|不可)[^，；、]{0,30}(?:假設(?:情境|案例)|編造|捏造|虛構)[^，；]*/g, '');
      if (substitutionPatterns.some((pattern) => pattern.test(candidate))) {
        issues.push(`替代自身經驗提示「${sentence}」：請依 docs/quality.md「作答與討論說明」修正有效稿與網頁來源，讓讀者從實際問題作答`);
      }
    }
  }
  return [...new Set(issues)];
}

function sourceExperiencePromptIssues(source) {
  const issues = [];
  const inspect = (location, html) => {
    for (const issue of experiencePromptIssues(html)) issues.push(`${location}: ${issue}`);
  };
  for (const [key, value] of Object.entries(source.hero || {})) inspect(`hero.${key}`, value);
  for (const [index, page] of (source.pages || []).entries()) {
    inspect(`pages[${index}].bodyHtml`, page.bodyHtml);
    inspect(`pages[${index}].footer`, page.footer);
  }
  for (const [index, html] of (source.contentSyncHtml || []).entries()) inspect(`contentSyncHtml[${index}]`, html);
  for (const [index, replacement] of (source.textReplacements || []).entries()) inspect(`textReplacements[${index}].to`, replacement.to);
  return issues;
}

module.exports = { experiencePromptIssues, sourceExperiencePromptIssues };
