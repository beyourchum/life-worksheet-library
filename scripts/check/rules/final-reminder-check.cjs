function validateEndingPolicy(policy) {
  if (policy?.heading !== 'none')
    throw new Error('quality-policy.json: ending.heading 須為 none（結尾不使用標題）');
  for (const key of ['geometryTolerancePx', 'scaleTolerance','fontWeight','paragraphMarginPx','borderTopRem','borderBottomPx'])
    if (!Number.isFinite(policy[key]) || policy[key] < 0)
      throw new Error(`quality-policy.json: ending.${key} 須為非負有限數字`);
  for (const [mode, size, gap, padding] of [['screen','fontSizeRem','gapRem','paddingRem'], ['print','fontSizePt','gapMm','paddingMm']]) {
    for (const key of [size, gap, 'lineHeightRatio'])
      if (!Number.isFinite(policy[mode]?.[key]) || policy[mode][key] <= 0)
        throw new Error(`quality-policy.json: ending.${mode}.${key} 須為正有限數字`);
    if (!Array.isArray(policy[mode]?.[padding]) || policy[mode][padding].length !== 4 ||
        policy[mode][padding].some(value => !Number.isFinite(value) || value < 0))
      throw new Error(`quality-policy.json: ending.${mode}.${padding} 須有四個非負有限數字`);
  }
}

async function finalReminderIssues(page, policy) {
  validateEndingPolicy(policy);
  return page.evaluate((policy) => {
    const endings = [...document.querySelectorAll('main .final-reminder')];
    if (endings.length !== 1) return [`結尾語須唯一，實際為 ${endings.length} 處`];
    const ending = endings[0];
    const issues = [];
    const fail = (message) => issues.push(message);
    if (!ending.matches('aside.closing.final-reminder.no-arrow'))
      fail('結尾須使用 aside.closing.final-reminder.no-arrow');
    if (ending.querySelector('h1,h2,h3,h4,h5,h6')) fail('結尾框內不得有標題；保留結尾文字並使用段落');
    let previous = ending.previousElementSibling;
    while (previous?.matches('p:not(.example-note)')) previous = previous.previousElementSibling;
    if (ending.querySelector('.closing-mark')) fail('結尾不得有箭頭；closing-mark 僅用於 AI 引導');
    const paragraphs = [...ending.children].filter((child) => child.tagName === 'P');
    if (!paragraphs.length || paragraphs.some((p) => !p.textContent.trim())) fail('結尾須有非空白的正文段落');
    if ([...ending.children].some((child) => child.tagName !== 'P') ||
        [...ending.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
      fail('結尾框內只能直接放正文 p 段落；不得混用標題、包裝區塊或裸文字');
    const before = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) && !a.contains(b);
    const answers = [...document.querySelectorAll('main input:not([type="hidden"]):not([type="button"]):not([type="submit"]),main textarea,main select')];
    const lastAnswer = answers.filter(answer => before(answer, ending)).at(-1);
    const outsideHeadings = new Set(previous?.matches('h1,h2,h3,h4,h5,h6') ? [previous] : []);
    if (lastAnswer) for (const heading of document.querySelectorAll('main h1,main h2,main h3,main h4,main h5,main h6'))
      if (before(lastAnswer, heading) && before(heading, ending)) outsideHeadings.add(heading);
    for (const heading of outsideHeadings) fail(`結尾框外不得有結尾標題：${heading.textContent.trim()}`);
    if (answers.some((answer) => !before(answer, ending))) fail('結尾須放在所有作答欄位之後');
    const ai = document.querySelector('main .prompt-intro');
    if (!ai || !before(ending, ai)) fail('結尾須放在 AI 引導之前');
    const prompt = document.querySelector('main .prompt-quote');
    if (!prompt || !ai || !before(ai, prompt)) fail('AI 引導之後須有提示詞');
    const endingPage = ending.closest('.page');
    if (endingPage && ai && prompt &&
        (ai.closest('.page') !== endingPage || prompt.closest('.page') !== endingPage))
      fail('結尾、AI 引導與提示詞須在同一頁，不得將標題或說明獨立分頁');

    const worksheet = ending.closest('.worksheet');
    if (!worksheet) return [...issues, '結尾缺少 worksheet 容器'];
    {
      const isPrint = matchMedia('print').matches;
      const mode = policy[isPrint ? 'print' : 'screen'];
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const fontSize = isPrint ? mode.fontSizePt * 96 / 72 : mode.fontSizeRem * rem;
      const padding = isPrint ? mode.paddingMm.map(value => value * 96 / 25.4) : mode.paddingRem.map(value => value * rem);
      const gap = isPrint ? mode.gapMm * 96 / 25.4 : mode.gapRem * rem;
      const bodyStyle = getComputedStyle(worksheet);
      const expectedBox = {rowGap:`${gap}px`,columnGap:`${gap}px`,paddingTop:`${padding[0]}px`,paddingRight:`${padding[1]}px`,
        paddingBottom:`${padding[2]}px`,paddingLeft:`${padding[3]}px`,borderTopWidth:`${Math.floor(policy.borderTopRem * rem)}px`,
        borderBottomWidth:`${policy.borderBottomPx}px`,borderTopStyle:'solid',borderBottomStyle:'solid',
        borderTopColor:bodyStyle.color,borderBottomColor:bodyStyle.color};
      const expectedParagraph = {fontSize:`${fontSize}px`,fontWeight:String(policy.fontWeight),fontFamily:bodyStyle.fontFamily,
        lineHeight:`${fontSize * mode.lineHeightRatio}px`,color:bodyStyle.color,
        marginTop:`${policy.paragraphMarginPx}px`,marginBottom:`${policy.paragraphMarginPx}px`};
      const actualBox = getComputedStyle(ending);
      if (actualBox.display !== 'grid' || actualBox.gridTemplateColumns.split(/\s+/).length !== 1)
        fail('結尾須依共用樣式採單欄排版');
      const compare = (actual, expected, properties, name) => {
        for (const property of properties) {
          const a = actual[property], b = expected[property];
          const same = a.endsWith('px') && b.endsWith('px')
            ? Math.abs(parseFloat(a) - parseFloat(b)) <= policy.geometryTolerancePx : a === b;
          if (!same) fail(`${name} ${property} 與共用樣式不一致（實際 ${a}，應為 ${b}）；移除覆寫樣式`);
        }
      };
      compare(actualBox, expectedBox, ['rowGap','columnGap','paddingTop','paddingRight','paddingBottom','paddingLeft',
        'borderTopWidth','borderBottomWidth','borderTopStyle','borderBottomStyle','borderTopColor','borderBottomColor'], '結尾框');
      for (const paragraph of paragraphs) compare(getComputedStyle(paragraph), expectedParagraph,
        ['fontSize','fontWeight','fontFamily','lineHeight','color','marginTop','marginBottom'], '結尾正文');
      let scaleX = 1, scaleY = 1;
      for (let node = ending; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        const zoom = parseFloat(style.zoom) || 1;
        scaleX *= zoom; scaleY *= zoom;
        if (style.transform !== 'none') {
          const matrix = new DOMMatrixReadOnly(style.transform);
          scaleX *= Math.hypot(matrix.a, matrix.b); scaleY *= Math.hypot(matrix.c, matrix.d);
        }
      }
      if (Math.abs(scaleX - 1) > policy.scaleTolerance || Math.abs(scaleY - 1) > policy.scaleTolerance)
        fail(`結尾受縮放影響（水平 ${scaleX.toFixed(3)}、垂直 ${scaleY.toFixed(3)}）；以分頁與間距處理列印版面，維持共用正文尺寸`);
    }
    return issues;
  }, policy);
}

async function worksheetEndingResults(browser, base, worksheetUrl, policy) {
  validateEndingPolicy(policy);
  const page = await browser.newPage();
  const results = [];
  try {
    await page.route('**/*', (route) => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
    await page.goto(`${base}/${worksheetUrl}`);
    await page.evaluate(() => document.fonts.ready);
    for (const [view, width, media] of [['desktop',1280,'screen'], ['mobile',390,'screen'], ['print',794,'print']]) {
      await page.setViewportSize({width, height:900});
      await page.emulateMedia({media});
      results.push({view, issues:await finalReminderIssues(page, policy)});
    }
    const fallback = await browser.newPage();
    try {
      await fallback.route('**/*', (route) => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await fallback.route('**/*.woff2', (route) => route.abort());
      await fallback.setViewportSize({width:794, height:900});
      await fallback.emulateMedia({media:'print'});
      await fallback.goto(`${base}/${worksheetUrl}`);
      results.push({view:'print-fallback', issues:await finalReminderIssues(fallback, policy)});
    } finally { await fallback.close(); }
    return results;
  } finally { await page.close(); }
}

module.exports = { validateEndingPolicy, finalReminderIssues, worksheetEndingResults };
