function videoRequirement(item, exceptions = []) {
  const exception = exceptions.find((entry) => entry.ep === item.ep);
  if (exception && (!exception.reason?.trim() || !exception.approvalReference?.trim()))
    return '無影片例外須有原因及使用者核准依據';
  if (exception && item.videoUrl) return '已有影片，不應保留無影片例外';
  if (item.worksheetUrl && !(typeof item.videoUrl === 'string' && item.videoUrl.trim()) && !exception)
    return '缺少影片連結：請核對來源並填入 videoUrl；僅使用者確認無影片才可記錄例外';
  return null;
}
module.exports = { videoRequirement };
