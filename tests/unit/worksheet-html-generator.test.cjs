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
assert.throws(() => renderWorksheet({ ...source, hero: { ...source.hero, titleHtml: '舊主標' } }, item, ['wide-other-input']), /hero.titleHtml 文字與 catalog/);
const escapedTitle = renderWorksheet({ ...source, hero: { ...source.hero, titleHtml: '測試<em> &amp; &#x63d0;醒</em>' } }, { ...item, title: '測試 & 提醒' }, ['wide-other-input']);
assert(escapedTitle.includes('<title>EP1｜測試 &amp; 提醒</title>'));
assert(html.includes('data-layout-variant="wide-other-input"'));
assert(renderWorksheet({ ...source, calculator: { name: 'planning-buffer', layout: true } }, item, ['wide-other-input']).includes('data-calculator="planning-buffer" data-calculator-layout'));
assert(renderWorksheet({ ...source, calculator: { name: 'heart-rate' } }, item, ['wide-other-input']).includes('data-calculator="heart-rate"'));
assert.throws(() => renderWorksheet({ ...source, calculator: { name: 'unknown' } }, item, ['wide-other-input']), /calculator.name/);
assert.throws(() => renderWorksheet({ ...source, calculator: { name: 'heart-rate', layout: 'yes' } }, item, ['wide-other-input']), /calculator.layout/);
assert.throws(() => renderWorksheet({ ...source, useComponents: false, calculator: { name: 'heart-rate' } }, item, ['wide-other-input']), /useComponents/);
assert(html.includes('01 / 02') && html.includes('02 / 02'));
assert(html.includes('https://www.youtube.com/embed/abcdefghijk'));
assert.equal((html.match(/class="worksheet-hero"/g) || []).length, 1);
assert.throws(() => renderWorksheet({ ...source, layoutVariants: ['unknown'] }, item, ['wide-other-input']), /未登錄/);
assert.throws(() => renderWorksheet({ ...source, pages: [{ bodyHtml: '<style>p{}</style>', footer: 'x' }] }, item, ['wide-other-input']), /不得包含/);
assert.throws(() => renderWorksheet({ ...source, hero: { ...source.hero, titleHtml: '<script>錯誤</script>' } }, item, ['wide-other-input']), /只允許/);
const noVideo = { ...item, videoUrl: '' };
const approved = [{ ep: item.ep, reason: '本篇無影片', approvalReference: '測試用核准紀錄' }];
assert.throws(() => renderWorksheet(source, noVideo, ['wide-other-input']), /缺少影片連結/);
assert.throws(() => renderWorksheet(source, noVideo, ['wide-other-input'], [{ ...approved[0], approvalReference: '' }]), /核准依據/);
assert.throws(() => renderWorksheet(source, noVideo, ['wide-other-input'], [{ ...approved[0], ep: 'EP999' }]), /缺少影片連結/);
assert.throws(() => renderWorksheet(source, item, ['wide-other-input'], approved), /已有影片/);
const withoutVideo = renderWorksheet({ ...source, videoTitle: '' }, noVideo, ['wide-other-input'], approved);
assert(!withoutVideo.includes('class="video-embed"') && !withoutVideo.includes('<iframe'));
assert(withoutVideo.includes('<h1>測試<em>學習單</em></h1>') && withoutVideo.includes('學習目標'));
assert.throws(() => renderWorksheet(source, { ...item, videoUrl: 'https://example.invalid/watch?v=abcdefghijk' }, ['wide-other-input']), /YouTube HTTPS/);
const section = '<div class="section-heading"><span class="section-number">01</span><h2>整理情境</h2></div><p>每週一、兩次</p>';
const sectionSource = { ...source, pages: [{ bodyHtml: section, footer: '第一頁' }] };
assert(renderWorksheet(sectionSource, item, ['wide-other-input']).includes(section));
for (const title of ['一、整理情境', '二、整理情境', '（一）整理情境']) {
  assert.throws(() => renderWorksheet({ ...sectionSource, pages: [{ bodyHtml: section.replace('整理情境', title), footer: '第一頁' }] }, item, ['wide-other-input']), /EP1[\s\S]*pages\[0\]\.bodyHtml 標題含序數/);
}
assert.throws(() => renderWorksheet({ ...sectionSource, contentSyncHtml: ['<h2>一、補充</h2>'] }, item, ['wide-other-input']), /套用 textReplacements／contentSyncHtml 後標題含序數/);
assert.throws(() => renderWorksheet({ ...sectionSource, textReplacements: [{ page: 0, from: '整理情境', to: '一、整理情境' }] }, item, ['wide-other-input']), /套用 textReplacements／contentSyncHtml 後標題含序數/);
const ai = '<aside class="closing prompt-intro"><span class="closing-mark">→</span><h2>AI 幫幫忙</h2><p>將前文作答整理成下一步。</p></aside><aside class="prompt-quote"><div class="prompt-copy-text" data-prompt-text><p>請依我的作答提出一個行動。</p></div><button type="button" data-prompt-copy>複製提示詞</button></aside>';
const aiSource = {...source, pages:[{bodyHtml:ai,footer:'第一頁'}]};
assert(renderWorksheet(aiSource,item,['wide-other-input']).includes(ai));
for (const invalid of [
  ai.replace('<h2>AI 幫幫忙</h2>',''),
  ai.replace('<p>將前文','<p>AI 幫幫忙：將前文'),
  ai.replace('prompt-quote">','prompt-quote"><h3>切片</h3><h3>抽象任務</h3>'),
]) assert.throws(()=>renderWorksheet({...aiSource,pages:[{bodyHtml:invalid,footer:'第一頁'}]},item,['wide-other-input']),/AI 區結構錯誤/);
