const assert = require('node:assert/strict');
const { renderWorksheet } = require('../../scripts/generate/worksheet-html.cjs');

const item = {
  ep: 'EP1', title: '測試學習單', category: '測試分類',
  worksheetUrl: 'worksheets/EP1/', videoUrl: 'https://youtu.be/abcdefghijk'
};
const source = {
  version: 1,
  ep: 'EP1',
  videoTitle: '測試影片',
  hero: { kicker: '測試引言', titleHtml: '測試<em>學習單</em>', question: '我可以怎麼測試？' },
  layoutVariants: ['wide-other-input'],
  useComponents: true,
  pages: [
    { bodyHtml: '<p><strong>學習目標：</strong>完成測試。</p>', footer: '第一頁' },
    { bodyHtml: '<p>特殊題型元件</p>', footer: '第二頁' }
  ]
};
const html = renderWorksheet(source, item, ['wide-other-input']);
assert(html.includes('<title>EP1｜測試學習單</title>'));
assert(html.includes('data-layout-variant="wide-other-input"'));
assert(html.includes('01 / 02') && html.includes('02 / 02'));
assert(html.includes('https://www.youtube.com/embed/abcdefghijk'));
assert.equal((html.match(/class="worksheet-hero"/g) || []).length, 1);
assert.throws(() => renderWorksheet({ ...source, layoutVariants: ['unknown'] }, item, ['wide-other-input']), /未登錄/);
assert.throws(() => renderWorksheet({ ...source, pages: [{ bodyHtml: '<style>p{}</style>', footer: 'x' }] }, item, ['wide-other-input']), /不得包含/);
assert.throws(() => renderWorksheet({ ...source, hero: { ...source.hero, titleHtml: '<script>錯誤</script>' } }, item, ['wide-other-input']), /只允許/);
