(function initializeSearchCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SearchCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function normalizeText(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('zh-Hant')
      .replace(/ep\s*0*(\d+)/giu, 'ep$1')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function tokenizeQuery(query, ignoredQueryWords = []) {
    const normalized = normalizeText(query);
    if (!normalized) return [];
    const ignored = new Set(ignoredQueryWords.map(normalizeText));
    const tokens = [];
    if (typeof Intl.Segmenter === 'function') {
      const segmenter = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
      for (const segment of segmenter.segment(normalized)) {
        const token = normalizeText(segment.segment);
        if (segment.isWordLike && token && !ignored.has(token)) tokens.push(token);
      }
    } else {
      tokens.push(...normalized.split(' ').filter((token) => token && !ignored.has(token)));
    }
    return [...new Set(tokens)];
  }

  function expandToken(token, synonymGroups = []) {
    const group = synonymGroups.find((aliases) => aliases.some((alias) => normalizeText(alias) === token));
    return [...new Set((group || [token]).map(normalizeText))];
  }

  function getQueryGroups(query, config) {
    return tokenizeQuery(query, config.ignoredQueryWords)
      .map((token) => ({ token, terms: expandToken(token, config.synonymGroups) }));
  }

  function includesAny(value, terms) {
    const normalized = normalizeText(value).replaceAll(' ', '');
    return terms.some((term) => normalized.includes(term.replaceAll(' ', '')));
  }

  function evaluateItem(item, query, queryGroups, originalIndex, config) {
    const weights = config.weights;
    let score = normalizeText(item.title) === normalizeText(query) ? weights.exactTitle : 0;
    const matchedGroups = [];
    const reasons = new Set();
    const highlightTerms = new Set();
    const searchEntries = Object.entries(item.searchTerms || {});

    for (const group of queryGroups) {
      let groupMatched = false;
      if (includesAny(item.title, group.terms)) { score += weights.title; reasons.add('標題'); groupMatched = true; }
      if (includesAny(item.summary, group.terms)) { score += weights.summary; reasons.add('摘要'); groupMatched = true; }
      if (includesAny(item.category, group.terms)) { score += weights.category; groupMatched = true; }
      if (includesAny(item.ep, group.terms)) { score += weights.ep; reasons.add('EP 編號'); groupMatched = true; }

      for (const [kind, terms] of searchEntries) {
        const matchingTerms = terms.filter((term) => includesAny(term, group.terms));
        if (!matchingTerms.length) continue;
        score += weights.searchTerms[kind];
        reasons.add(`搜尋詞「${matchingTerms[0]}」`);
        groupMatched = true;
      }

      if (groupMatched) {
        matchedGroups.push(group.token);
        group.terms.forEach((term) => highlightTerms.add(term));
      }
    }

    const normalizedQuery = normalizeText(query).replaceAll(' ', '');
    if (normalizedQuery && searchEntries.some(([, terms]) => terms.some((term) => normalizeText(term).replaceAll(' ', '').includes(normalizedQuery)))) {
      score += weights.exactSearchTerm;
    }

    return { item, score, originalIndex, matchedGroups, reasons: [...reasons], highlightTerms: [...highlightTerms] };
  }

  function searchWorksheets(worksheets, query, selectedCategory, config) {
    const queryGroups = getQueryGroups(query, config);
    const hasQuery = Boolean(normalizeText(query));
    const candidates = worksheets
      .filter((item) => !selectedCategory || item.category === selectedCategory)
      .map((item, originalIndex) => evaluateItem(item, query, queryGroups, originalIndex, config));
    let matchMode = 'all';
    let matches = !hasQuery
      ? candidates
      : queryGroups.length
      ? candidates.filter((match) => match.matchedGroups.length === queryGroups.length)
      : [];
    if (!matches.length && queryGroups.length > 1) {
      const relatedMatch = config.relatedMatch || {};
      const minimumGroups = relatedMatch.minimumGroups ?? 2;
      const minimumCoverage = relatedMatch.minimumCoverage ?? 0.6;
      const minimumScore = relatedMatch.minimumScore ?? 0;
      const strongSingleMinimumLength = relatedMatch.strongSingleMinimumLength ?? 2;
      const strongSingleMinimumScore = relatedMatch.strongSingleMinimumScore ?? Number.POSITIVE_INFINITY;
      const relatedMatches = candidates.filter((match) => {
        const coverage = match.matchedGroups.length / queryGroups.length;
        const meetsCoverageThreshold = match.matchedGroups.length >= minimumGroups
          && coverage >= minimumCoverage
          && match.score >= minimumScore;
        const matchedToken = match.matchedGroups[0] || '';
        const isStrongSingleMatch = match.matchedGroups.length === 1
          && normalizeText(matchedToken).replaceAll(' ', '').length >= strongSingleMinimumLength
          && match.score >= strongSingleMinimumScore;
        return meetsCoverageThreshold || isStrongSingleMatch;
      });
      if (relatedMatches.length) {
        matchMode = 'related';
        matches = relatedMatches;
      }
    }
    if (queryGroups.length) matches.sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);
    return { matches, matchMode };
  }

  return { normalizeText, tokenizeQuery, getQueryGroups, evaluateItem, searchWorksheets };
}));
