const assert = require('node:assert/strict');
const { videoRequirement, videoEmbedIssues } = require('../rules/video-policy.cjs');
const item = { ep: 'EP106', worksheetUrl: 'worksheets/EP106/' };
assert(videoRequirement(item));
assert(videoRequirement({ ...item, videoUrl: ' ' }));
assert.equal(videoRequirement({ ...item, videoUrl: 'https://youtu.be/abcdefghijk' }), null);
assert(videoRequirement(item, [{ ep: item.ep, reason: '未找到' }]));
const approved = [{ ep: item.ep, reason: '本篇無影片', approvalReference: '測試用使用者核准紀錄' }];
assert.equal(videoRequirement(item, approved), null);
assert(videoRequirement({ ...item, videoUrl: 'https://youtu.be/abcdefghijk' }, approved));
assert(videoRequirement(item, [{ ...approved[0], ep: 'EP999' }]));
const completeEmbed = '<div class="worksheet-hero"><p class="hero-question">問題？</p></div>'
  + '<div class="video-embed"><iframe src="https://www.youtube.com/embed/abcdefghijk" title="已核對影片" loading="lazy" '
  + 'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>'
  + '<p><strong>學習目標：</strong>目標</p>';
assert.deepEqual(videoEmbedIssues(completeEmbed, { ...item, ep: 'EP1', worksheetUrl: 'worksheets/EP1/', videoUrl: 'https://youtu.be/abcdefghijk' }), []);
assert(videoEmbedIssues(completeEmbed.replace('abcdefghijk', 'zzzzzzzzzzz'), { ...item, ep: 'EP1', worksheetUrl: 'worksheets/EP1/', videoUrl: 'https://youtu.be/abcdefghijk' }).some((issue) => issue.includes('影片 ID')));
assert(videoEmbedIssues(completeEmbed.replace(' loading="lazy"', ''), { ...item, ep: 'EP1', worksheetUrl: 'worksheets/EP1/', videoUrl: 'https://youtu.be/abcdefghijk' }).some((issue) => issue.includes('loading')));
assert(videoEmbedIssues('<p>沒有播放器</p>', { ...item, ep: 'EP1', worksheetUrl: 'worksheets/EP1/', videoUrl: 'https://youtu.be/abcdefghijk' }).some((issue) => issue.includes('video-embed')));
console.log('影片門檻測試通過：缺漏、空白、未核准及錯集例外均被攔截。');
