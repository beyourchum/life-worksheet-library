const assert = require('node:assert/strict');
const { paginationWarnings } = require('../../scripts/check/rules/pagination-check.cjs');
const policy = require('../../config/quality-policy.json').print;
function testPaginationWarnings() {
  const threshold = policy.lowUsageWarningRatio;
  const warnings = paginationWarnings([
    { page: 1, contentUsageRatio: threshold / 2 },
    { page: 2, contentUsageRatio: threshold },
    { page: 3, contentUsageRatio: 0.95 }
  ], policy);
  assert.deepEqual(warnings.map((warning) => warning.page), [1]);
  assert.equal(warnings[0].code, 'PRINT_LOW_USAGE');
  assert.match(warnings[0].message, /保留必要作答空間/);
  assert.throws(() => paginationWarnings([], { lowUsageWarningRatio: 0 }), /必須/);
}
if (require.main === module) { testPaginationWarnings(); console.log('分頁使用率提醒測試通過'); }
module.exports = { testPaginationWarnings };
