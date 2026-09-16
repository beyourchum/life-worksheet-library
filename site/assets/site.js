const search = document.querySelector('#search');
const searchForm = document.querySelector('#search-form');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const empty = document.querySelector('#empty');
const categories = document.querySelector('#categories');
const resetButton = document.querySelector('#reset-button');
let worksheets = [];
let selectedCategory = '';
const categoryLabels = ['學會和別人相處、不互相傷害', '處理情緒低落、焦慮和壓力', '看懂社會為什麼這樣運作', '避開職場常見問題與陷阱', '找到自己的特質與使用方式', '改善生活習慣、提升效率'];

function appendHighlightedText(element, text, query) {
  if (!query) { element.textContent = text; return; }
  const source = text.toLocaleLowerCase('zh-Hant');
  const needle = query.toLocaleLowerCase('zh-Hant');
  let cursor = 0;
  let matchIndex = source.indexOf(needle);
  while (matchIndex !== -1) {
    element.append(document.createTextNode(text.slice(cursor, matchIndex)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(matchIndex, matchIndex + query.length);
    element.append(mark);
    cursor = matchIndex + query.length;
    matchIndex = source.indexOf(needle, cursor);
  }
  element.append(document.createTextNode(text.slice(cursor)));
}

function createResult(item, query) {
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
  appendHighlightedText(titleLink, item.title, query);
  title.append(titleLink);
  const summary = document.createElement('p');
  summary.className = 'result-summary';
  appendHighlightedText(summary, item.summary || '', query);
  mainCell.append(title, summary);
  const detailCell = document.createElement('div');
  detailCell.className = 'result-cell result-detail';
  detailCell.hidden = true;
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
  article.append(epCell, mainCell, detailCell, links);
  return article;
}

function render() {
  const query = search.value.trim();
  const needle = query.toLocaleLowerCase('zh-Hant');
  const matches = worksheets.filter((item) => {
    const searchableText = [item.ep, item.title, item.summary, item.category, ...(item.keywords || [])].join(' ');
    return searchableText.toLocaleLowerCase('zh-Hant').includes(needle) && (!selectedCategory || item.category === selectedCategory);
  });
  results.replaceChildren(...matches.map((item) => createResult(item, query)));
  status.textContent = `${String(matches.length).padStart(2, '0')} RESULTS / ${worksheets.length} TOTAL`;
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
