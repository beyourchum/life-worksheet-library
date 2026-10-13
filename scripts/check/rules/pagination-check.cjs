function paginationWarnings(metrics, policy) {
  const threshold = policy.lowUsageWarningRatio;
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1)
    throw new Error('print.lowUsageWarningRatio 必須介於 0 與 1 之間');
  return metrics.filter((metric) => Number.isFinite(metric.contentUsageRatio) && metric.contentUsageRatio < threshold)
    .map((metric) => ({
      page: metric.page,
      code: 'PRINT_LOW_USAGE',
      usageRatio: metric.contentUsageRatio,
      message: '第 ' + metric.page + ' 頁內容使用率 ' + (metric.contentUsageRatio * 100).toFixed(1) + '%，請檢視相鄰頁能否移入完整題組，並記錄保留分頁的理由；保留必要作答空間。'
    }));
}
module.exports = { paginationWarnings };
