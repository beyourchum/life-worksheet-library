(() => {
  const worksheet = document.querySelector('[data-worksheet-id="EP99"]');
  if (!worksheet) return;
  const choices = [...worksheet.querySelectorAll('[data-need-choice]')];
  const field = id => document.getElementById(id);
  const list = worksheet.querySelector('.ep99-ranking');
  const rows = [...list.children];
  const keys = rows.map(row => row.dataset.rankKey);
  const ranking = field('ep99-ranking');
  const matches = field('ep99-matches');
  let order = [...keys];
  let confirmed = false;
  let comparisons = {};
  const jobs = ['current', 'a', 'b', 'c'];
  const restoreRanking = () => {
    order = [...keys];
    confirmed = false;
    comparisons = {};
    try {
      const saved = JSON.parse(ranking.value);
      if (saved.order?.length === keys.length && new Set(saved.order).size === keys.length && saved.order.every(key => keys.includes(key))) {
        order = saved.order;
        confirmed = saved.confirmed === true;
      }
    } catch (_) {}
    try {
      const saved = JSON.parse(matches.value);
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) comparisons = saved;
    } catch (_) {}
  };
  const renderRanking = () => {
    field('ep99-legacy-order').hidden = !field('ep99-order').value;
    list.dataset.confirmed = String(confirmed);
    order.forEach((key, index) => {
      const row = rows.find(row => row.dataset.rankKey === key);
      list.append(row);
      row.querySelector('.ep99-rank-number').textContent = index + 1;
      row.querySelector('[data-move="-1"]').disabled = index === 0;
      row.querySelector('[data-move="1"]').disabled = index === keys.length - 1;
    });
    worksheet.querySelector('[data-ranking-status]').textContent = confirmed ? '已確認排序' : '尚未確認排序';
    worksheet.querySelector('[data-confirm-ranking]').disabled = confirmed;
    worksheet.querySelectorAll('[data-top-need]').forEach((node, index) => {
      const key = order[index];
      const name = rows.find(row => row.dataset.rankKey === key).querySelector('[data-rank-name]').textContent;
      node.textContent = confirmed ? name : '＿＿＿＿';
      jobs.forEach(job => {
        const input = field(`ep99-match-${job}-${index + 1}`);
        input.disabled = !confirmed;
        input.checked = confirmed && comparisons[key]?.[job] === true;
      });
    });
  };
  const persistRanking = () => {
    ranking.value = JSON.stringify({ order, confirmed });
    matches.value = JSON.stringify(comparisons);
    ranking.dispatchEvent(new Event('input', { bubbles: true }));
  };
  list.addEventListener('click', event => {
    const button = event.target.closest('[data-move]');
    if (!button) return;
    const key = button.closest('[data-rank-key]').dataset.rankKey;
    const index = order.indexOf(key);
    const target = index + Number(button.dataset.move);
    if (target < 0 || target >= keys.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    confirmed = false;
    renderRanking();
    persistRanking();
    const row = rows.find(row => row.dataset.rankKey === key);
    (button.disabled ? row.querySelector('[data-move]:not(:disabled)') : button).focus();
  });
  worksheet.querySelector('[data-confirm-ranking]').addEventListener('click', () => {
    confirmed = true;
    renderRanking();
    persistRanking();
  });
  worksheet.addEventListener('input', event => {
    const match = event.target.id.match(/^ep99-match-(current|a|b|c)-([123])$/);
    if (!match || !confirmed) return;
    const key = order[Number(match[2]) - 1];
    comparisons[key] = { ...comparisons[key], [match[1]]: event.target.checked };
    matches.value = JSON.stringify(comparisons);
  }, true);
  const updateLimit = () => {
    document.getElementById('ep99-legacy-compare').hidden = !document.getElementById('ep99-compare').value;
    const count = choices.filter(input => input.checked).length;
    worksheet.querySelectorAll('[data-choice-count]').forEach(node => { node.textContent = count; });
    worksheet.querySelectorAll('[data-choice-limit]').forEach(node => { node.hidden = count < 10; });
    choices.forEach(input => { input.disabled = !input.checked && count >= 10; });
  };
  // Reject extra selections before the shared draft handler saves them.
  worksheet.addEventListener('input', event => {
    if (event.target.matches('[data-need-choice]') && event.target.checked && choices.filter(input => input.checked).length > 10) {
      event.target.checked = false;
    }
    updateLimit();
  }, true);
  worksheet.addEventListener('change', updateLimit, true);
  document.querySelector('[data-clear]').addEventListener('click', () => {
    restoreRanking();
    renderRanking();
    updateLimit();
  });
  restoreRanking();
  renderRanking();
  updateLimit();
})();
