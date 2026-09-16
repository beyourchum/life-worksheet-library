const search = document.querySelector('#search');
const searchForm = document.querySelector('#search-form');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const empty = document.querySelector('#empty');
const categories = document.querySelector('#categories');
const resetButton = document.querySelector('#reset-button');
const emptyMessage = document.querySelector('#empty-message');
let worksheets = [];
let searchConfig = {};
let selectedCategory = '';
const categoryLabels = ['學會和別人相處、不互相傷害', '處理情緒低落、焦慮和壓力', '看懂社會為什麼這樣運作', '避開職場常見問題與陷阱', '找到自己的特質與使用方式', '改善生活習慣、提升效率'];

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
  const { matches, matchMode } = SearchCore.searchWorksheets(worksheets, query, selectedCategory, searchConfig);
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

Promise.all([fetch('worksheets.json'), fetch('search-config.json')])
  .then((responses) => Promise.all(responses.map((response) => {
    if (!response.ok) throw new Error(`${response.url}: HTTP ${response.status}`);
    return response.json();
  })))
  .then(([data, config]) => { worksheets = data; searchConfig = config; renderCategories(); render(); })
  .catch(() => { status.textContent = '索引載入失敗，請稍後再試。'; });
search.addEventListener('input', render);
searchForm.addEventListener('submit', (event) => { event.preventDefault(); render(); });
resetButton.addEventListener('click', resetSearch);
