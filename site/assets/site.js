const search = document.querySelector('#search');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const empty = document.querySelector('#empty');
const categories = document.querySelector('#categories');
const searchButton = document.querySelector('#search-button');

let worksheets = [];
let selectedCategory = '';

const categoryLabels = [
  '學會和別人相處、不互相傷害',
  '處理情緒低落、焦慮和壓力',
  '看懂社會為什麼這樣運作',
  '避開職場常見問題與陷阱',
  '找到自己的特質與使用方式',
  '改善生活習慣、提升效率'
];

function render(query = '') {
  const needle = query.trim().toLocaleLowerCase('zh-Hant');
  const matches = worksheets.filter((item) => {
    const text = [item.ep, item.title, item.summary, ...(item.keywords || [])].join(' ');
    const matchesQuery = text.toLocaleLowerCase('zh-Hant').includes(needle);
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesQuery && matchesCategory;
  });

  results.replaceChildren(...matches.map((item) => {
    const card = document.createElement('article');
    card.className = 'card';

    const ep = document.createElement('span');
    ep.className = 'ep';
    ep.textContent = item.ep;

    const title = document.createElement('h2');
    title.textContent = item.title;

    const summary = document.createElement('p');
    summary.textContent = item.summary || '';

    const actions = document.createElement('div');
    actions.className = 'actions';

    const worksheetLink = document.createElement('a');
    worksheetLink.href = item.worksheetUrl;
    worksheetLink.textContent = '開啟學習單';
    actions.append(worksheetLink);

    if (item.videoUrl) {
      const videoLink = document.createElement('a');
      videoLink.href = item.videoUrl;
      videoLink.className = 'secondary';
      videoLink.textContent = '觀看影片';
      videoLink.target = '_blank';
      videoLink.rel = 'noopener';
      actions.append(videoLink);
    }

    card.append(ep, title, summary, actions);
    return card;
  }));

  status.textContent = `目前顯示 ${matches.length} 份內容；文字只在你的瀏覽器中搜尋，不會被儲存。`;
  empty.hidden = matches.length !== 0;
}

function renderCategories() {
  categories.replaceChildren(...categoryLabels.map((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-button';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(selectedCategory === label));
    if (selectedCategory === label) button.classList.add('active');
    button.addEventListener('click', () => {
      selectedCategory = selectedCategory === label ? '' : label;
      renderCategories();
      render(search.value);
    });
    return button;
  }));
}

fetch('worksheets.json')
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    worksheets = data;
    renderCategories();
    render(search.value);
  })
  .catch(() => {
    status.textContent = '索引載入失敗，請稍後再試。';
  });

search.addEventListener('input', () => render(search.value));
searchButton.addEventListener('click', () => render(search.value));
