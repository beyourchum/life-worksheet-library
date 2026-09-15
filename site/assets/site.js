const search = document.querySelector('#search');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const empty = document.querySelector('#empty');

let worksheets = [];

function render(query = '') {
  const needle = query.trim().toLocaleLowerCase('zh-Hant');
  const matches = worksheets.filter((item) => {
    const text = [item.ep, item.title, item.summary, ...(item.keywords || [])].join(' ');
    return text.toLocaleLowerCase('zh-Hant').includes(needle);
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

  status.textContent = `找到 ${matches.length} 份學習單`;
  empty.hidden = matches.length !== 0;
}

fetch('worksheets.json')
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((data) => {
    worksheets = data;
    render(search.value);
  })
  .catch(() => {
    status.textContent = '索引載入失敗，請稍後再試。';
  });

search.addEventListener('input', () => render(search.value));
