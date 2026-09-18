const search = document.querySelector('#search');
const searchForm = document.querySelector('#search-form');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const empty = document.querySelector('#empty');
const categories = document.querySelector('#categories');
const resetButton = document.querySelector('#reset-button');
const emptyMessage = document.querySelector('#empty-message');
const sort = document.querySelector('#sort');
const pager = document.querySelector('#pagination');
const pageSelect = document.querySelector('#page-select');
const previous = document.querySelector('#previous-page');
const next = document.querySelector('#next-page');
const retry = document.querySelector('#retry-load');
let worksheets = [], categoryLabels = [], matches = [];
let searchConfig, searchPromise, catalogPromise;
let selectedCategory = '', matchMode = 'all', pageNumber = 1, pageSize = 12, debounceMs = 180;
let ready = false, composing = false, revision = 0, timer;

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
  titleLink.href = item.articleUrl || item.worksheetUrl;
  titleLink.setAttribute('aria-label', item.title + (item.articleUrl ? "：閱讀文章" : "：開啟互動式學習單"));
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
  if (item.worksheetUrl) links.append(worksheetLink);
  if (item.articleUrl) {
    const articleLink = document.createElement("a");
    articleLink.href = item.articleUrl; articleLink.textContent = "閱讀文章"; links.prepend(articleLink);
  }
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

function updateCategoryState() {
  for (const button of categories.children) {
    const active = button.dataset.category === selectedCategory;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function renderCategories() {
  const counts = new Map(categoryLabels.map((label) => [label, 0]));
  worksheets.forEach((item) => counts.set(item.category, (counts.get(item.category) || 0) + 1));
  categories.replaceChildren(...['', ...categoryLabels].map((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-button';
    button.dataset.category = label;
    button.textContent = (label || '全部') + ' · ' + (label ? counts.get(label) : worksheets.length);
    button.addEventListener('click', () => { selectedCategory = label; updateCategoryState(); refresh(); });
    return button;
  }));
  updateCategoryState();
}

function renderPage() {
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  pageNumber = Math.max(1, Math.min(pageNumber, pageCount));
  const start = (pageNumber - 1) * pageSize;
  results.replaceChildren(...matches.slice(start, start + pageSize).map(createResult));
  status.textContent = matches.length
    ? (matchMode === 'related' ? '相關內容 ' : '') + '第 ' + (start + 1) + '–' + Math.min(start + pageSize, matches.length) + ' 筆，共 ' + matches.length + ' 筆'
    : '找到 0 筆內容';
  emptyMessage.textContent = selectedCategory && search.value.trim()
    ? '找不到同時符合搜尋文字與主題的內容，請換個說法或改選主題。'
    : '找不到符合的內容，請換個說法或重設篩選。';
  empty.hidden = matches.length !== 0;
  pager.hidden = pageCount <= 1;
  pageSelect.replaceChildren(...Array.from({ length: pageCount }, (_, index) => {
    const option = document.createElement('option');
    option.value = String(index + 1);
    option.textContent = '第 ' + (index + 1) + ' 頁 / 共 ' + pageCount + ' 頁';
    return option;
  }));
  pageSelect.value = String(pageNumber);
  previous.disabled = pageNumber === 1;
  next.disabled = pageNumber === pageCount;
  results.setAttribute('aria-busy', 'false');
}

function fetchJSON(url) {
  return fetch(url, { cache: 'no-store' }).then((response) => {
    if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
    return response.json();
  });
}

function loadSearch() {
  if (!searchPromise) searchPromise = fetchJSON('data/search-index.json').then((data) => {
    searchConfig = data.config;
    worksheets = worksheets.map((item) => ({ ...item, searchTerms: data.terms[item.ep] || {} }));
  }).catch((error) => { searchPromise = undefined; throw error; });
  return searchPromise;
}

async function refresh() {
  clearTimeout(timer);
  const request = ++revision;
  if (!ready) return;
  const query = search.value.trim();
  pageNumber = 1;
  retry.hidden = true;
  pager.hidden = true;
  empty.hidden = true;
  results.setAttribute('aria-busy', 'true');
  try {
    if (query) {
      status.textContent = '正在搜尋…';
      await loadSearch();
      if (request !== revision) return;
      ({ matches, matchMode } = SearchCore.searchWorksheets(worksheets, query, selectedCategory, searchConfig));
    } else {
      matchMode = 'all';
      matches = worksheets.filter((item) => !selectedCategory || item.category === selectedCategory)
        .map((item) => ({ item, reasons: [], highlightTerms: [] }));
    }
    const direction = sort.value === 'oldest' ? 1 : -1;
    if (!query || sort.value !== 'recommended') matches.sort((a, b) => direction * (Number(a.item.ep.slice(2)) - Number(b.item.ep.slice(2))));
    renderPage();
  } catch (error) {
    if (request !== revision) return;
    results.replaceChildren();
    results.setAttribute('aria-busy', 'false');
    status.textContent = '搜尋資料載入失敗。請重試，或重設搜尋以瀏覽內容。';
    retry.hidden = false;
    empty.hidden = false;
    emptyMessage.textContent = '目前無法完成搜尋。';
  }
}

function changePage(number) {
  pageNumber = number;
  renderPage();
  document.querySelector('#results-title').focus({ preventScroll: true });
  document.querySelector('.result-section').scrollIntoView({ block: 'start' });
}

function loadCatalog() {
  if (catalogPromise) return catalogPromise;
  status.textContent = '正在載入內容…';
  retry.hidden = true;
  catalogPromise = fetchJSON('data/catalog.json').then((catalog) => {
    worksheets = catalog.items;
    categoryLabels = catalog.categories;
    pageSize = catalog.pageSize;
    debounceMs = catalog.searchDebounceMs;
    ready = true;
    renderCategories();
    return refresh();
  }).catch(() => {
    catalogPromise = undefined;
    status.textContent = '內容索引載入失敗，請重試。';
    retry.hidden = false;
  });
  return catalogPromise;
}
function scheduleSearch() {
  clearTimeout(timer);
  ++revision;
  if (!composing) timer = setTimeout(refresh, debounceMs);
}
search.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); ++revision; });
search.addEventListener('compositionend', () => { composing = false; scheduleSearch(); });
search.addEventListener('input', scheduleSearch);
searchForm.addEventListener('submit', (event) => { event.preventDefault(); if (!composing) refresh(); });
sort.addEventListener('change', refresh);
previous.addEventListener('click', () => changePage(pageNumber - 1));
next.addEventListener('click', () => changePage(pageNumber + 1));
pageSelect.addEventListener('change', () => changePage(Number(pageSelect.value)));
resetButton.addEventListener('click', () => { search.value = ''; selectedCategory = ''; sort.value = 'recommended'; updateCategoryState(); refresh(); search.focus(); });
retry.addEventListener('click', () => { if (ready) refresh(); else loadCatalog(); });
loadCatalog();
