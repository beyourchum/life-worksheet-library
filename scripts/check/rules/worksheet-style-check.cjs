async function worksheetStyleIssues(page) {
  return page.evaluate(() => {
    const issues = [];
    const controls = 'input[type=radio],input[type=checkbox]';
    for (const input of document.querySelectorAll(`main ${controls.split(',').join(',main ')}`)) {
      if (!input.closest('.choices,.matrix-options')) issues.push('選項缺少群組容器：' + input.id);
    }
    for (const group of document.querySelectorAll('.choices')) {
      let heading = group.previousElementSibling;
      while (heading && heading.matches('p,.example-note,.answer-field,.choices')) heading = heading.previousElementSibling;
      if (!heading?.matches('.question-heading') || !heading.querySelector('h3') ||
          !/^(單選|可複選|最多選.+)$/.test(heading.querySelector('.answer-mode')?.textContent.trim() || ''))
        issues.push('選項群組缺少題目或題型標示：' + (group.querySelector('input')?.id || group.textContent.trim()));
      else {
        const inputs = [...group.querySelectorAll(controls)];
        const single = heading.querySelector('.answer-mode').textContent.trim() === '單選';
        if (!inputs.length || inputs.some(i => i.type !== (single ? 'radio' : 'checkbox')) ||
            (single && (inputs.some(i => !i.name) || new Set(inputs.map(i => i.name)).size !== 1)))
          issues.push('題型與選項控制不一致：' + heading.textContent.trim());
      }
    }
    for (const choice of document.querySelectorAll('.choice')) {
      if (/其他/.test(choice.textContent) && choice.querySelector('input[type=text]') &&
          (!choice.matches('.other-choice') || !choice.querySelector('.choice-toggle input[type=radio],.choice-toggle input[type=checkbox]')))
        issues.push('其他選項與填寫欄未正確配對：' + choice.textContent.trim());
    }
    for (const example of document.querySelectorAll('.example-note,.choice-example,.choice-inline-example')) {
      const text = example.textContent.trim();
      if (!/^例如：/.test(text))
        issues.push('示範文字須以「例如：」開頭：' + text);
      if (example.matches('.choice-inline-example') && !example.closest('.choice'))
        issues.push('一般選項的示範須放在同一個綠色選項格內：' + text);
      if (example.closest('.other-choice'))
        issues.push('「其他」的示範須放在綠色選項格外：' + text);
      if (example.matches('.example-note') && example.closest('.answer-field'))
        issues.push('填答欄的示範須放在橫線下方，不得放進填答欄內：' + text);
    }
    for (const copy of document.querySelectorAll('.choice > span')) {
      if (/（(?:例如|如|像是|比如|舉例|範例|例)：[^）]+）/.test(copy.textContent) && !copy.querySelector('.choice-inline-example'))
        issues.push('選項內的舉例須另起一行並使用灰色小字：' + copy.textContent.trim());
    }
    for (const heading of document.querySelectorAll('main h3')) {
      const text = heading.textContent.trim();
      if (/^(?:\d+|[A-Za-z])[.、]\s*/.test(text))
        issues.push('題目標題不應加數字或字母編號：' + text);
      if (/^(?:情境|例如[：:])/.test(text) && !heading.closest('.question-heading') && !heading.matches('h3.subheading'))
        issues.push('情境或示範標題須使用 h3.subheading：' + text);
      if (heading.matches('h3.subheading') && /^情境[：:]/.test(text))
        issues.push('情境小標題只保留辨識標籤，完整敘述須放在下方內文：' + text);
    }
    for (const heading of document.querySelectorAll('main .subheading')) {
      if (!heading.matches('h3')) issues.push('灰綠底活動標題須使用 h3.subheading：' + heading.textContent.trim());
    }
    const walker = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('script,style,h1,h2,h3,h4,.example-note,.choice-example,.choice-inline-example')) continue;
      if (/(?:例如|如|像是|比如|舉例|範例|例|示範答案|起手句)[：:]/.test(node.textContent))
        issues.push('句中範例或示範需套用灰字樣式：' + node.textContent.trim());
    }
    for (const input of document.querySelectorAll('.other-input')) {
      if (!input.closest('.other-choice')?.querySelector('.choice-toggle'))
        issues.push('其他填寫欄未與選項放在同一格：' + input.id);
    }
    for (const input of document.querySelectorAll('.choice input[type=text]')) {
      if (!input.matches('.other-input,.inline-input'))
        issues.push('選項內的一般文字欄須使用與「其他」相同長度的 inline-input：' + (input.id || input.getAttribute('aria-label') || '未命名欄位'));
      if (input.matches('.compact-input') &&
          !input.matches('.inline-input[inputmode=numeric],.inline-input[inputmode=decimal]'))
        issues.push('短欄位例外須以 inline-input compact-input 搭配 numeric 或 decimal inputmode：' + (input.id || input.getAttribute('aria-label') || '未命名欄位'));
    }
    for (const heading of document.querySelectorAll('.question-heading')) {
      const mode = heading.querySelector('.answer-mode')?.textContent || '';
      let next = heading.nextElementSibling;
      const inputs = [];
      while (next && next.matches('.choices,.answer-field,p')) {
        inputs.push(...next.querySelectorAll('input[type=radio],input[type=checkbox]'));
        next = next.nextElementSibling;
      }
      if (/單選/.test(mode) && inputs.length && (inputs.some(i => i.type !== 'radio' || !i.name) || new Set(inputs.map(i => i.name)).size !== 1))
        issues.push('單選未使用同組 radio：' + heading.textContent.trim());
      if (/複選|最多選/.test(mode) && inputs.some(i => i.type !== 'checkbox'))
        issues.push('複選未使用 checkbox：' + heading.textContent.trim());
    }
    for (const el of document.querySelectorAll('main p')) {
      if (/（(?:單選|可複選|最多選[^）]+)）/.test(el.textContent) && !el.closest('.matrix'))
        issues.push('題型標示混入正文：' + el.textContent.trim());
    }
    return issues;
  });
}
async function inlineInputLayoutIssues(page) {
  return page.evaluate(() => [...document.querySelectorAll('.choice input[type=text].inline-input:not(.compact-input)')]
    .flatMap((input) => {
      const id = input.id || input.getAttribute('aria-label') || '未命名欄位';
      const wrapper = input.parentElement;
      const style = getComputedStyle(input);
      const wrapperStyle = getComputedStyle(wrapper);
      const issues = [];
      if (Number.parseFloat(style.flexGrow) < 1 || Number.parseFloat(style.minWidth) < 112)
        issues.push(`選項內的一般文字欄未套用與「其他」相同的伸展長度：${id}`);
      if (style.borderBottomStyle === 'none' || style.borderBottomWidth === '0px')
        issues.push(`選項內的一般文字欄缺少共通填寫線：${id}`);
      if (wrapperStyle.display !== 'flex' || Number.parseFloat(wrapperStyle.flexGrow) < 1)
        issues.push(`選項內的一般文字欄外層未填滿剩餘寬度：${id}`);
      return issues;
    }));
}
module.exports = { worksheetStyleIssues, inlineInputLayoutIssues };
