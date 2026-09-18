const assert = require('node:assert/strict');
const { categoryAliasIssues } = require('../rules/category-alias-policy.cjs');

const aliases = {
  '社會規則解碼': '看懂社會為什麼這樣運作',
  '高效生活提案': '改善生活習慣、提升效率',
};
const canonical = ['看懂社會為什麼這樣運作', '改善生活習慣、提升效率'];

assert.deepEqual(categoryAliasIssues(canonical, [
  { ep: 'EP1', category: '看懂社會為什麼這樣運作' },
], aliases), []);

const splitIssues = categoryAliasIssues([...canonical, '社會規則解碼'], [
  { ep: 'EP85', category: '社會規則解碼' },
], aliases);
assert(splitIssues.some((issue) => issue.includes('不可把同義名稱另列為分類')));
assert(splitIssues.some((issue) => issue.includes('EP85: 不可使用同義分類')));

assert(categoryAliasIssues(['改善生活習慣、提升效率'], [], {
  '社會規則解碼': '看懂社會為什麼這樣運作',
}).some((issue) => issue.includes('正式分類不存在')));
