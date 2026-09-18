function categoryAliasIssues(categories, items, aliases) {
  const issues = [];
  if (!aliases || Array.isArray(aliases) || typeof aliases !== 'object') {
    return ['config/category-aliases.json 必須是「同義名稱: 正式分類」物件'];
  }
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (!alias.trim() || typeof canonical !== 'string' || !canonical.trim() || alias === canonical) {
      issues.push(`分類同義規則無效：${alias || '(空白)'}`);
      continue;
    }
    if (!categories.includes(canonical)) issues.push(`分類同義規則的正式分類不存在：${canonical}`);
    if (categories.includes(alias)) issues.push(`catalog/categories.json 不可把同義名稱另列為分類：${alias}；請使用 ${canonical}`);
    for (const item of items.filter((entry) => entry.category === alias)) {
      issues.push(`${item.ep}: 不可使用同義分類 ${alias}；請使用 ${canonical}`);
    }
  }
  return issues;
}

module.exports = { categoryAliasIssues };
