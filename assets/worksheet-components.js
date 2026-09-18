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
  worksheet.querySelectorAll('.choices').forEach(group => {
    const previous = group.previousElementSibling;
    if (previous?.matches('.question-heading')) return;
    const heading = document.createElement('div');
    heading.className = 'question-heading';
    const mode = group.querySelector('input[type="radio"]') ? '單選' : '可複選';
    heading.innerHTML = `<h3>請勾選你的回答：</h3><span class="answer-mode">${mode}</span>`;
    group.before(heading);
  });
  if (worksheet.dataset.worksheetId === 'EP85') {
    const content = {
      '耳機': ['耳機好貴？', '你買這麼貴，是不是很愛現？', '我可能真正需要：減少噪音、維持專心', '我可以重新理解：我不只是買耳機，也是在買一段比較安靜、能讓大腦省力的時間。'],
      '計程車': ['想搭計程車？', '你只是懶惰，不肯練習搭公車。', '我可能真正需要：減少交通變動、保留考試或工作的精神', '我可以重新理解：我可能是在省下擔心的力氣，把精神留給接下來的事。'],
      '固定食物': ['只吃同一種？', '你不換口味、不比價，很笨。', '我可能真正需要：避免踩雷、維持熟悉感', '我可以重新理解：買熟悉的食物，可能是在讓大腦不用處理太多不確定。'],
      '機器幫忙': ['用機器幫忙？', '你連掃地都不肯，只想花錢買掃地機器人。', '我可能真正需要：減少小事、保留注意力', '我可以重新理解：讓機器幫忙，可能是在幫大腦空出位置記住真正重要的事。'],
      '不聚餐': ['不想參加聚餐？', '你不合群、捨不得花錢一起玩。', '我可能真正需要：減少社交負擔、保留休息時間', '我可以重新理解：我的錢可以花在真正讓我恢復能量的事上，不必用來讓自己更累。'],
      '心情蛋糕': ['心情蛋糕？', '心情不好就買吃的，真浪費錢。', '我可能真正需要：安慰自己、撐過難過或害怕', '我可以重新理解：這可能是給心情的暫時支撐，但仍可以留意預算。'],
      '小公仔': ['買小東西？', '買一堆小公仔、小玩具，都是沒用的東西。', '我可能真正需要：安全感、熟悉與安心', '我可以重新理解：這些物品可能是我的心情避風港，但仍可定期檢查數量與花費。'],
      '分錢焦慮': ['算錢會怕？', '分錢多給一點，就是沒有金錢觀。', '我可能真正需要：趕快結束緊張、避免當場爭執', '我可以重新理解：焦慮可能讓我暫時算不清楚；我可以改用計算機、記帳或請對方一起核對。'],
      '遊戲點數': ['遊戲點數？', '你意志力不夠堅定，只會玩遊戲儲值。', '我可能真正需要：找回成就感、獲得快樂', '我可以重新理解：我可能想在受打擊時找回一點自信，也需要先設定自己負擔得起的上限。'],
      '整理房間': ['整理房間？', '還不趕快去念書，還在摸東摸西。', '我可能真正需要：減少環境刺激、找回舒服與穩定', '我可以重新理解：整理可能是讓環境成為充電站；我也可以設定整理時間，避免它取代真正要完成的事。']
    };
    worksheet.querySelectorAll('input[type="checkbox"]').forEach(input => {
      const row = content[input.value];
      if (!row) return;
      const label = input.closest('label');
      const field = label.querySelector('input[type="text"]');
      label.classList.add('ep85-situation-card');
      label.innerHTML = `<span class="choice-toggle"></span><span class="ep85-card-content"><strong class="ep85-card-title">${row[0]}</strong><span class="ep85-card-label">別人怎麼說</span><span class="ep85-card-negative">${row[1]}</span><span class="ep85-card-label">我可能真正需要</span><span class="ep85-card-need">${row[2].replace('我可能真正需要：', '')}</span><span class="ep85-card-label">換個角度看</span><span class="ep85-card-positive">${row[3].replace('我可以重新理解：', '')}</span></span>`;
      label.querySelector('.choice-toggle').append(input);
      if (field) label.querySelector('span:last-child').append(field);
    });
    const uncertain = worksheet.querySelector('input[name="ep85-judgment"][value="不確定"]');
    if (uncertain) {
      const label = uncertain.closest('label');
      const field = label.querySelector('input[type="text"]');
      const text = label.querySelector('span');
      if (text) text.textContent = '我還不能判斷';
      if (field) {
        field.remove();
        const group = label.closest('.choices');
        const answer = document.createElement('div');
        answer.className = 'answer-field ep85-uncertain-answer';
        answer.innerHTML = '<label for="ep85-judgment-note">我還不能判斷，因為我還需要知道：</label><textarea id="ep85-judgment-note" rows="3" placeholder="例如：我需要知道這筆花費是否在預算內，以及有沒有替代方案。"></textarea>';
        group.after(answer);
      }
    }
    const replacements = new Map([['瑣事', '小事'], ['懶惰', '不勤快'], ['挫折', '受打擊'], ['廢物', '沒用的東西'], ['薄弱', '不夠堅定']]);
    const walker = document.createTreeWalker(worksheet, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { replacements.forEach((value, key) => { node.nodeValue = node.nodeValue.replaceAll(key, value); }); });
  }
})();
