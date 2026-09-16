const search = document.querySelector('#search');
const searchForm = document.querySelector('#search-form');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const empty = document.querySelector('#empty');
const categories = document.querySelector('#categories');
const resetButton = document.querySelector('#reset-button');
const emptyMessage = document.querySelector('#empty-message');
let worksheets = [];
let selectedCategory = '';
const categoryLabels = ['學會和別人相處、不互相傷害', '處理情緒低落、焦慮和壓力', '看懂社會為什麼這樣運作', '避開職場常見問題與陷阱', '找到自己的特質與使用方式', '改善生活習慣、提升效率'];
const synonymGroups = [
  ['工作', '職場', '上班'],
  ['焦慮', '壓力', '緊張'],
  ['拖延', '沒動力', '無法開始', '難以開始'],
  ['溝通', '表達', '說不出口'],
  ['adhd', '注意力', '執行功能'],
  ['失敗', '挫折'],
  ['規則', '規範'],
  ['運動', '健身'],
];
const ignoredQueryWords = new Set(['我', '你', '他', '她', '它', '的', '了', '在', '是', '很', '和', '與', '或', '也', '都', '想', '要', '該', '怎麼', '如何', '為什麼', '可以', '最近', '一個']);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-Hant')
    .replace(/ep\s*0*(\d+)/giu, 'ep$1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenizeQuery(query) {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  const tokens = [];
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
    for (const segment of segmenter.segment(normalized)) {
      const token = normalizeText(segment.segment);
      if (segment.isWordLike && token && !ignoredQueryWords.has(token)) tokens.push(token);
    }
  } else {
    tokens.push(...normalized.split(' ').filter(Boolean));
  }
  return [...new Set(tokens.length ? tokens : [normalized])];
}

function expandToken(token) {
  const group = synonymGroups.find((aliases) => aliases.some((alias) => normalizeText(alias) === token));
  return [...new Set((group || [token]).map(normalizeText))];
}

function getQueryGroups(query) {
  return tokenizeQuery(query).map((token) => ({ token, terms: expandToken(token) }));
}

function includesAny(value, terms) {
  const normalized = normalizeText(value).replaceAll(' ', '');
  return terms.some((term) => normalized.includes(term.replaceAll(' ', '')));
}

function evaluateItem(item, query, queryGroups, originalIndex) {
  const fields = {
    title: item.title,
    keywords: item.keywords || [],
    summary: item.summary || '',
    category: item.category,
    ep: item.ep,
  };
  let score = normalizeText(item.title) === normalizeText(query) ? 100 : 0;
  const matchedGroups = [];
  const reasons = new Set();
  const highlightTerms = new Set();

  for (const group of queryGroups) {
    let groupMatched = false;
    if (includesAny(fields.title, group.terms)) { score += 50; reasons.add('標題'); groupMatched = true; }
    const matchingKeywords = fields.keywords.filter((keyword) => includesAny(keyword, group.terms));
    if (matchingKeywords.length) {
      score += 30;
      matchingKeywords.forEach((keyword) => reasons.add(`關鍵字「${keyword}」`));
      groupMatched = true;
    }
    if (includesAny(fields.summary, group.terms)) { score += 15; reasons.add('摘要'); groupMatched = true; }
    if (includesAny(fields.category, group.terms)) { score += 10; groupMatched = true; }
    if (includesAny(fields.ep, group.terms)) { score += 5; reasons.add('EP 編號'); groupMatched = true; }
    if (groupMatched) {
      matchedGroups.push(group.token);
      group.terms.forEach((term) => highlightTerms.add(term));
    }
  }

  return { item, score, originalIndex, matchedGroups, reasons: [...reasons], highlightTerms: [...highlightTerms] };
}

function appendHighlightedText(element, text, terms) {
  if (!terms.length) { element.textContent = text; return; }
  const source = text.toLocaleLowerCase('zh-Hant');
  let cursor = 0;
  while (cursor < text.length) {
    const nextMatch = terms
      .map((term) => ({ term, index: source.indexOf(term.toLocaleLowerCase('zh-Hant'), cursor) }))
      .filter((match) => match.index !== -1)
      .sort((a, b) => a.index - b.index || b.term.length - a.term.length)[0];
    if (!nextMatch) break;
    const { index: matchIndex, term } = nextMatch;
    element.append(document.createTextNode(text.slice(cursor, matchIndex)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(matchIndex, matchIndex + term.length);
    element.append(mark);
    cursor = matchIndex + term.length;
  }
  element.append(document.createTextNode(text.slice(cursor)));
}

function createResult(match) {
  const { item, reasons, highlightTerms } = match;
  const article = document.createElement('article');
  article.className = 'result-row';
  const epCell = document.createElement('div');
  epCell.className = 'result-cell result-ep';
  epCell.textContent = item.ep.replace('EP', '');
  const mainCell = document.createElement('div');
  mainCell.className = 'result-cell result-main';
  const title = document.createElement('h3');
  title.className = 'result-title';
  const titleLink = document.createElement('a');
  titleLink.href = item.worksheetUrl;
  titleLink.setAttribute('aria-label', `${item.title}：開啟互動式學習單`);
  appendHighlightedText(titleLink, item.title, highlightTerms);
  title.append(titleLink);
  const summary = document.createElement('p');
  summary.className = 'result-summary';
  appendHighlightedText(summary, item.summary || '', highlightTerms);
  mainCell.append(title, summary);
  if (reasons.length) {
    const matchDetail = document.createElement('p');
    matchDetail.className = 'result-match';
    matchDetail.textContent = `MATCH / 符合：${reasons.slice(0, 3).join('、')}`;
    mainCell.append(matchDetail);
  }
  const links = document.createElement('div');
  links.className = 'result-cell result-links';
  const worksheetLink = document.createElement('a');
  worksheetLink.href = item.worksheetUrl;
  worksheetLink.textContent = '學習單';
  const worksheetArrow = document.createElement('span');
  worksheetArrow.className = 'action-arrow';
  worksheetArrow.setAttribute('aria-hidden', 'true');
  worksheetArrow.textContent = '↗︎';
  worksheetLink.append(worksheetArrow);
  links.append(worksheetLink);
  if (item.videoUrl) {
    const videoLink = document.createElement('a');
    videoLink.href = item.videoUrl;
    videoLink.textContent = '影片';
    const videoArrow = document.createElement('span');
    videoArrow.className = 'action-arrow';
    videoArrow.setAttribute('aria-hidden', 'true');
    videoArrow.textContent = '↗︎';
    videoLink.append(videoArrow);
    videoLink.target = '_blank';
    videoLink.rel = 'noopener noreferrer';
    links.append(videoLink);
  }
  article.append(epCell, mainCell, links);
  return article;
}

function render() {
  const query = search.value.trim();
  const queryGroups = getQueryGroups(query);
  const candidates = worksheets
    .filter((item) => !selectedCategory || item.category === selectedCategory)
    .map((item) => evaluateItem(item, query, queryGroups, worksheets.indexOf(item)));
  let matchMode = 'all';
  let matches = queryGroups.length
    ? candidates.filter((match) => match.matchedGroups.length === queryGroups.length)
    : candidates;
  if (!matches.length && queryGroups.length > 1) {
    const relatedMatches = candidates.filter((match) => match.matchedGroups.length > 0);
    if (relatedMatches.length) {
      matchMode = 'related';
      matches = relatedMatches;
    }
  }
  if (queryGroups.length) matches.sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);
  results.replaceChildren(...matches.map(createResult));
  const statusLabel = matchMode === 'related' ? 'RELATED' : 'RESULTS';
  status.textContent = `${String(matches.length).padStart(2, '0')} ${statusLabel} / ${worksheets.length} TOTAL`;
  emptyMessage.textContent = selectedCategory && query
    ? '找不到同時符合搜尋文字與主題的內容，請換個說法或改選主題。'
    : '找不到符合的內容，請換個說法或清除篩選。';
  empty.hidden = matches.length !== 0;
}

function updateCategoryState() {
  for (const button of categories.children) {
    const active = button.dataset.category === selectedCategory;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function renderCategories() {
  categories.replaceChildren(...['', ...categoryLabels].map((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-button';
    button.dataset.category = label;
    button.textContent = label || '全部';
    button.setAttribute('aria-pressed', String(selectedCategory === label));
    if (selectedCategory === label) button.classList.add('active');
    button.addEventListener('click', () => { selectedCategory = label; updateCategoryState(); render(); });
    return button;
  }));
}

function resetSearch() {
  search.value = '';
  selectedCategory = '';
  updateCategoryState();
  render();
  search.focus();
}

fetch('worksheets.json')
  .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
  .then((data) => { worksheets = data; renderCategories(); render(); })
  .catch(() => { status.textContent = '索引載入失敗，請稍後再試。'; });
search.addEventListener('input', render);
searchForm.addEventListener('submit', (event) => { event.preventDefault(); render(); });
resetButton.addEventListener('click', resetSearch);
