function videoRequirement(item, exceptions = []) {
  const exception = exceptions.find((entry) => entry.ep === item.ep);
  if (exception && (!exception.reason?.trim() || !exception.approvalReference?.trim()))
    return '無影片例外須有原因及使用者核准依據';
  if (exception && item.videoUrl) return '已有影片，不應保留無影片例外';
  if (item.worksheetUrl && !(typeof item.videoUrl === 'string' && item.videoUrl.trim()) && !exception)
    return '缺少影片連結：請核對來源並填入 videoUrl；僅使用者確認無影片才可記錄例外';
  return null;
}

function youtubeId(videoUrl) {
  try {
    const url = new URL(videoUrl);
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}

function attribute(markup, name) {
  return new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(markup)?.[1] ?? null;
}

function videoEmbedIssues(html, item) {
  if (!item?.worksheetUrl || !item.videoUrl) return [];
  const issues = [];
  const embeds = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bvideo-embed\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)];
  if (embeds.length !== 1) return [`${item.ep}: 頁面須有且只有一個 video-embed 影片播放器`];
  const iframe = /<iframe\b[^>]*>/i.exec(embeds[0][1])?.[0];
  if (!iframe) return [`${item.ep}: video-embed 缺少 iframe`];
  const id = youtubeId(item.videoUrl);
  if (id && attribute(iframe, 'src') !== `https://www.youtube.com/embed/${id}`) issues.push(`${item.ep}: iframe 影片 ID 與 videoUrl 不一致`);
  if (!attribute(iframe, 'title')?.trim()) issues.push(`${item.ep}: iframe 缺少可辨識的 title`);
  if (attribute(iframe, 'loading') !== 'lazy') issues.push(`${item.ep}: iframe 必須使用 loading="lazy"`);
  const permissions = new Set((attribute(iframe, 'allow') || '').split(';').map((value) => value.trim()).filter(Boolean));
  for (const permission of ['accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media', 'gyroscope', 'picture-in-picture', 'web-share'])
    if (!permissions.has(permission)) issues.push(`${item.ep}: iframe allow 缺少 ${permission}`);
  if (!/\sallowfullscreen(?:\s|>|=)/i.test(iframe)) issues.push(`${item.ep}: iframe 必須允許全螢幕`);
  const hero = html.search(/class=["'][^"']*\bhero-question\b/);
  const learningGoal = html.indexOf('<strong>學習目標：</strong>');
  if (!(hero >= 0 && embeds[0].index > hero && learningGoal > embeds[0].index))
    issues.push(`${item.ep}: video-embed 必須位於 hero-question 之後、學習目標之前`);
  return issues;
}

module.exports = { videoRequirement, videoEmbedIssues, youtubeId };
