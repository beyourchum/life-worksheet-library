(() => {
  const worksheet = document.querySelector('.worksheet');
  if (!worksheet) return;

  const field = id => document.getElementById(id);
  const numericValue = input => input && input.value !== '' && input.validity.valid
    && Number.isFinite(input.valueAsNumber) && Math.abs(input.valueAsNumber) <= Number.MAX_SAFE_INTEGER
    ? input.valueAsNumber : null;
  const dateValue = input => {
    if (!input?.value || !input.validity.valid) return null;
    const value = Date.parse(input.value + 'Z');
    return Number.isFinite(value) ? value : null;
  };
  const formatDate = value => Number.isFinite(value) && value >= 0 && value <= 253402300799999
    ? new Date(value).toISOString().slice(0, 16).replace('T', ' ').replaceAll('-', '/') : '';
  const put = (id, value) => { field(id).value = value ?? ''; };
  const ceilMinutes = value => Math.ceil(value - 1e-9);

  function initLegacyReveals() {
    const update = () => worksheet.querySelectorAll('[data-reveal-when]').forEach(node => {
      const source = worksheet.querySelector(node.dataset.revealWhen);
      node.hidden = !source?.value;
    });
    worksheet.addEventListener('input', update, true);
    worksheet.addEventListener('change', update, true);
    document.querySelector('[data-clear]')?.addEventListener('click', update);
    update();
  }

  function initChoiceLimits() {
    const names = new Set([...worksheet.querySelectorAll('[data-choice-limit-group]')].map(node => node.dataset.choiceLimitGroup));
    names.forEach(name => {
      const statuses = [...worksheet.querySelectorAll(`[data-choice-limit-group="${CSS.escape(name)}"]`)];
      const maximum = Number(statuses[0].dataset.choiceLimit);
      const choices = [...worksheet.querySelectorAll(`[data-limited-choice="${CSS.escape(name)}"]`)];
      const update = () => {
        const count = choices.filter(input => input.checked).length;
        statuses.forEach(status => {
          status.querySelectorAll('[data-choice-count]').forEach(node => { node.textContent = count; });
          status.querySelectorAll('[data-choice-limit-message]').forEach(node => { node.hidden = count < maximum; });
        });
        choices.forEach(input => { input.disabled = !input.checked && count >= maximum; });
      };
      worksheet.addEventListener('input', event => {
        if (!choices.includes(event.target)) return;
        if (event.target.checked && choices.filter(input => input.checked).length > maximum) event.target.checked = false;
        update();
      }, true);
      worksheet.addEventListener('change', update, true);
      document.querySelector('[data-clear]')?.addEventListener('click', update);
      update();
    });
  }

  function initRanking(root) {
    const rows = [...root.querySelectorAll('[data-rank-key]')];
    const keys = rows.map(row => row.dataset.rankKey);
    const ranking = field(root.dataset.rankingState);
    const matches = field(root.dataset.rankingMatches);
    const targets = [...worksheet.querySelectorAll(`[data-ranking-target="${CSS.escape(root.dataset.ranking)}"]`)];
    let order = [...keys];
    let confirmed = false;
    let comparisons = {};
    const restore = () => {
      order = [...keys]; confirmed = false; comparisons = {};
      try {
        const saved = JSON.parse(ranking.value);
        if (saved.order?.length === keys.length && new Set(saved.order).size === keys.length && saved.order.every(key => keys.includes(key))) {
          order = saved.order; confirmed = saved.confirmed === true;
        }
      } catch (_) {}
      try {
        const saved = JSON.parse(matches.value);
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) comparisons = saved;
      } catch (_) {}
    };
    const render = () => {
      root.dataset.confirmed = String(confirmed);
      order.forEach((key, index) => {
        const row = rows.find(item => item.dataset.rankKey === key);
        root.append(row);
        row.querySelector('[data-rank-number]').textContent = index + 1;
        row.querySelector('[data-move="-1"]').disabled = index === 0;
        row.querySelector('[data-move="1"]').disabled = index === keys.length - 1;
      });
      worksheet.querySelector(`[data-ranking-status="${CSS.escape(root.dataset.ranking)}"]`).textContent = confirmed ? '已確認排序' : '尚未確認排序';
      worksheet.querySelector(`[data-ranking-confirm="${CSS.escape(root.dataset.ranking)}"]`).disabled = confirmed;
      targets.forEach((target, index) => {
        const key = order[index];
        const name = rows.find(row => row.dataset.rankKey === key).querySelector('[data-rank-name]').textContent;
        target.textContent = confirmed ? name : '＿＿＿＿';
        worksheet.querySelectorAll(`[data-ranking-match="${CSS.escape(root.dataset.ranking)}"][data-rank-position="${index + 1}"]`).forEach(input => {
          input.disabled = !confirmed;
          input.checked = confirmed && comparisons[key]?.[input.dataset.matchColumn] === true;
        });
      });
    };
    const persist = () => {
      ranking.value = JSON.stringify({ order, confirmed });
      matches.value = JSON.stringify(comparisons);
      ranking.dispatchEvent(new Event('input', { bubbles: true }));
    };
    root.addEventListener('click', event => {
      const button = event.target.closest('[data-move]');
      if (!button) return;
      const key = button.closest('[data-rank-key]').dataset.rankKey;
      const index = order.indexOf(key);
      const target = index + Number(button.dataset.move);
      if (target < 0 || target >= keys.length) return;
      [order[index], order[target]] = [order[target], order[index]];
      confirmed = false; render(); persist();
      const row = rows.find(item => item.dataset.rankKey === key);
      (button.disabled ? row.querySelector('[data-move]:not(:disabled)') : button).focus();
    });
    worksheet.querySelector(`[data-ranking-confirm="${CSS.escape(root.dataset.ranking)}"]`).addEventListener('click', () => {
      confirmed = true; render(); persist();
    });
    worksheet.addEventListener('input', event => {
      if (event.target.dataset.rankingMatch !== root.dataset.ranking || !confirmed) return;
      const key = order[Number(event.target.dataset.rankPosition) - 1];
      comparisons[key] = { ...comparisons[key], [event.target.dataset.matchColumn]: event.target.checked };
      matches.value = JSON.stringify(comparisons);
    }, true);
    document.querySelector('[data-clear]')?.addEventListener('click', () => { restore(); render(); });
    restore(); render();
  }

  const calculators = {
    'planning-buffer': () => {
      const number = name => numericValue(field(`ep94-${name}`));
      const date = name => dateValue(field(`ep94-${name}`));
      for (const input of worksheet.querySelectorAll('[data-calculator="planning-buffer"] input[type="number"]')) {
        input.setAttribute('aria-invalid', String(!input.validity.valid || (input.value !== '' && numericValue(input) === null)));
      }
      const hours = number('work-hours'), due = date('work-due');
      const mode = worksheet.querySelector('[name="ep94-work-mode"]:checked')?.value;
      const ratio = number('work-percent'), bufferHours = number('work-buffer-hours');
      const buffer = mode === 'percent' && hours !== null && ratio !== null ? ceilMinutes(hours * 60 * ratio / 100)
        : mode === 'hours' && bufferHours !== null ? ceilMinutes(bufferHours * 60) : null;
      const finish = due !== null && hours !== null && buffer !== null ? due - buffer * 60000 : null;
      put('ep94-work-finish', finish === null ? '' : formatDate(finish));
      put('ep94-work-start', finish === null ? '' : formatDate(finish - ceilMinutes(hours * 60) * 60000));
      const income = number('money-income'), percent = number('money-percent');
      const reserve = income !== null && percent !== null ? Math.round((income / 100 * percent) * 100) / 100 : null;
      put('ep94-money-reserve', reserve === null ? '' : String(reserve));
      put('ep94-money-limit', reserve === null ? '' : String(Math.floor(income - reserve + 1e-9)));
      const arrival = date('time-arrival'), minutes = number('time-minutes'), extra = number('time-percent');
      const total = minutes !== null && extra !== null ? ceilMinutes(minutes * (1 + extra / 100)) : null;
      put('ep94-time-total', total === null || !Number.isFinite(total) ? '' : String(total));
      put('ep94-time-depart', arrival === null || total === null ? '' : formatDate(arrival - total * 60000));
    },
    'heart-rate': () => {
      const age = field('ep95-age'), percent = field('ep95-next-percent');
      const years = numericValue(age), value = numericValue(percent);
      const ratio = value !== null && value > 0 ? value : null;
      const maximum = years === null ? null : 220 - years;
      const choice = worksheet.querySelector('[data-range-low]:checked');
      field('ep95-age-error').hidden = !age.validity.badInput && (age.value === '' || years !== null);
      field('ep95-percent-error').hidden = !percent.validity.badInput && (percent.value === '' || ratio !== null);
      age.setAttribute('aria-invalid', String(!field('ep95-age-error').hidden));
      percent.setAttribute('aria-invalid', String(!field('ep95-percent-error').hidden));
      put('ep95-rate', maximum === null ? '' : String(maximum));
      put('ep95-range', maximum === null || !choice ? '' : `${Math.round(maximum * Number(choice.dataset.rangeLow) / 100)}～${Math.round(maximum * Number(choice.dataset.rangeHigh) / 100)}`);
      put('ep95-target-rate', maximum === null || ratio === null ? '' : String(Math.round(maximum * ratio / 100)));
    }
  };

  function initCalculators() {
    const nodes = [worksheet, ...worksheet.querySelectorAll('[data-calculator]')].filter(node => node.matches('[data-calculator]'));
    const active = new Set(nodes.map(node => node.dataset.calculator));
    const update = () => active.forEach(name => calculators[name]?.());
    worksheet.addEventListener('input', update, true);
    worksheet.addEventListener('change', update, true);
    document.querySelector('[data-clear]')?.addEventListener('click', update);
    update();
  }

  initLegacyReveals();
  initChoiceLimits();
  worksheet.querySelectorAll('[data-ranking]').forEach(initRanking);
  initCalculators();
})();
