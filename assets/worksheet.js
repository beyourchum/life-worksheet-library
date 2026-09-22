(() => {
  const worksheet = document.querySelector(".worksheet");
  if (worksheet.dataset.worksheetId === "EP82") {
    const checks = worksheet.querySelector("#ep82-check-label")?.closest(".choices");
    if (checks && !checks.previousElementSibling?.classList.contains("question-heading")) {
      const heading = document.createElement("div");
      heading.className = "question-heading";
      heading.innerHTML = '<h3>我可以放心送出嗎？</h3><span class="answer-mode">可複選</span>';
      checks.before(heading);
    }
    worksheet.querySelectorAll("label.choice").forEach((label) => {
      if (label.textContent.includes("其他：")) {
        label.classList.add("other-choice");
        const toggle = label.querySelector(".choice-toggle");
        const checkbox = label.querySelector('input[type="checkbox"], input[type="radio"]');
        if (!toggle && checkbox) {
          const wrapper = document.createElement("span");
          wrapper.className = "choice-toggle";
          checkbox.replaceWith(wrapper);
          wrapper.append(checkbox);
        }
      }
    });
    worksheet.querySelectorAll(".example-note").forEach((note) => {
      if (!note.textContent.trim().startsWith("例如：")) note.prepend("例如：");
    });
  }
  const storageKey = `worksheet:${worksheet.dataset.worksheetId}:draft-v1`;
  worksheet.querySelectorAll(".choice > span").forEach((copy) => {
    if (copy.querySelector("input")) return;
    const original = copy.textContent.trim();
    const separator = original.indexOf("：");
    if (separator <= 0 || separator === original.length - 1) return;
    const title = original.slice(0, separator).trim();
    const detail = original.slice(separator + 1).trim();
    const looksLikeHeading = title.length <= 10
      && !/[（(「『，,。！？!?]/.test(title)
      && !/(?:例如|如)$/.test(title)
      && !/^[「『]/.test(detail);
    if (!title || !detail || !looksLikeHeading) return;
    copy.classList.add("choice-copy");
    const exampleMatch = detail.match(/^(.*?)（((?:例如|如)：[^()（）]+)）(.*)$/);
    const exampleSuffix = exampleMatch?.[3].trim() || "";
    const examplePunctuation = /^[。！？!?]+$/.test(exampleSuffix) ? exampleSuffix : "";
    const detailMain = exampleMatch
      ? `${exampleMatch[1]}${examplePunctuation ? "" : exampleSuffix}`.trim()
      : detail;
    const children = [
      Object.assign(document.createElement("strong"), { className: "choice-title", textContent: title }),
      document.createElement("br"),
      document.createTextNode(detailMain)
    ];
    if (exampleMatch) {
      copy.classList.add("choice-copy-with-example");
      children.push(Object.assign(document.createElement("small"), {
        className: "choice-inline-example",
        textContent: `${exampleMatch[2].trim()}${examplePunctuation}`
      }));
    }
    copy.replaceChildren(...children);
    const input = copy.closest("label")?.querySelector("input");
    input?.setAttribute("data-choice-label", original);
  });
  worksheet.querySelectorAll('.choice > span:not(.choice-copy)').forEach((copy) => {
    const original = copy.textContent.trim();
    const match = original.match(/^(.*?)（((?:例如|如)：[^()（）]+)）(.*)$/);
    if (!match) return;
    const main = `${match[1]}${match[3]}`.trim();
    const example = match[2].trim();
    if (!main || !example) return;
    copy.classList.add("choice-copy", "choice-copy-with-example");
    copy.replaceChildren(
      document.createTextNode(main),
      Object.assign(document.createElement("small"), { className: "choice-inline-example", textContent: example })
    );
    const input = copy.closest("label")?.querySelector("input");
    input?.setAttribute("data-choice-label", original);
    input?.setAttribute("data-content-label", original);
  });
  worksheet.querySelectorAll('.choice > span').forEach((copy) => {
    if (!copy.textContent.includes('例如：') || copy.querySelector('.choice-inline-example')) return;
    const marker = '例如：';
    const html = copy.innerHTML;
    const markerIndex = html.indexOf(marker);
    if (markerIndex < 0) return;
    const example = copy.textContent.slice(copy.textContent.indexOf(marker) + marker.length).trim();
    copy.innerHTML = html.slice(0, markerIndex).replace(/<br>\s*$/, '').trim();
    copy.append(Object.assign(document.createElement('small'), {
      className: 'choice-inline-example',
      textContent: `例如：${example}`
    }));
  });
  const controls = [...worksheet.querySelectorAll("input, textarea")];
  const promptBindings = {
    EP62: [["#choice-46", "#choice-47", "#choice-48", "#choice-49", "#choice-50", "#choice-51", "#other-52"], ["#short-53"]],
    EP83: [["[id^=ep83-feel-]"], ["#ep83-expectation"], ["[id^=ep83-understand-]"], ["[id^=ep83-prepare-]", "#ep83-question"]],
    EP82: [
      ["[name=ep82-recipient]", "[name=ep82-limit]", "#ep82-recipient-other-text", "#ep82-limit-budget-text", "#ep82-limit-other-text"],
      ["#ep82-gift"],
      ["[name=ep82-useful-1]", "[name=ep82-useful-2]", "[name=ep82-useful-3]"],
      ["[name=ep82-fun-1]", "[name=ep82-fun-2]", "[name=ep82-fun-3]"],
      ["[name=ep82-private-1]", "[name=ep82-private-2]", "[name=ep82-private-3]"],
      ["[name=ep82-result]", "#ep82-result-adjust-text", "#ep82-result-stop-text"],
      ["#ep82-fit"],
      ["#ep82-watch"]
    ],
    EP84: [["#ep84-point"], ["#ep84-action"]],
    EP75: [["#ep75-person", "[name=ep75-relationship]"], ["#ep75-event"], ["#ep75-actions"], ["[name=ep75-focus]"], ["[name=ep75-goal]"], ["[name=ep75-willing]"], ["[name=ep75-stop]", "#ep75-stop-action"]],
    EP72: [["[name=ep72-report-stuck]"], ["[name=ep72-report-step]"], ["#ep72-report-task", "#ep72-report-deliverable", "#ep72-report-time"], ["[name=ep72-conflict-state]"], ["[name=ep72-conflict-step]"], ["#ep72-conflict-message", "#ep72-conflict-deadline"], ["[name=ep72-help-kind]"], ["#ep72-help-fact"], ["#ep72-help-tried"], ["#ep72-help-request"], ["#ep72-next"]],
    EP73: [["[name=ep73-situation]", "#ep73-situation-other-text"], ["#ep73-protect"], ["#ep73-first-step"], ["#ep73-boundary-sentence"], ["#ep73-help"], ["#ep73-not-do"]],
    EP71: [["[id^=ep71-change-]", "#ep71-known"], ["[id^=ep71-feeling-]", "#ep71-feeling-sentence"], ["#ep71-unknown", "#ep71-remind"], ["[name=ep71-action]", "#ep71-action-person", "#ep71-action-pause-time", "#ep71-action-resource", "#ep71-action-other-text", "#ep71-next"]],
    EP80: [["[id^=ep80-tired-]", "#ep80-tired-other-text"], ["[id^=ep80-regret-]", "#ep80-regret-other-text"], ["[id^=ep80-shopping-]", "#ep80-shopping-other-text"], ["[id^=ep80-invite-]", "#ep80-invite-other-text"], ["[id^=ep80-late-]", "#ep80-late-other-text"], ["[id^=ep80-eat-]", "#ep80-eat-other-text"], ["[id^=ep80-queue-]", "#ep80-queue-other-text"], ["#ep80-reminder-time", "#ep80-reminder-decision", "#ep80-reminder-action"]],
    EP76: [
      ["#ep76-topic"],
      ["[name=ep76-person]", "#ep76-person-other-text"],
      ["#ep76-relationship"],
      ["#ep76-fact-people", "#ep76-fact-event", "#ep76-fact-time", "#ep76-fact-place", "#ep76-fact-evidence"],
      ["#ep76-subjective-emotion"],
      ["#ep76-subjective-guess"],
      ["#ep76-subjective-evaluation"],
      ["#ep76-subjective-expectation"],
      ["#ep76-quote"],
      ["#ep76-argument"],
      ["[name=ep76-disagree]"],
      ["[name=ep76-decision]"],
      ["#ep76-next"]
    ],
    EP85: [["#ep85-need"], ["#ep85-budget"], ["#ep85-basic"]],
    EP86: [["#ep86-focus", "#ep86-area"], ["[name=ep86-impact]"], ["#ep86-minutes"], ["[name=ep86-keep]", "#ep86-keep-note", "#ep86-prep"]],
    EP87: [["[name=ep87-a]", "[name=ep87-b]", "[name=ep87-c]"], ["[name=ep87-focus]", "#ep87-focus-other"], ["[name=ep87-action]", "#ep87-action-custom", "#ep87-reminder"]],
    EP88: [["[id^=ep88-situation-]"], ["#ep88-one-action"], ["#ep88-when"]],
    EP89: [["#ep89-start-point"]],
    EP90: [
      ["[id^=ep90-fear-]"],
      ["[id^=ep90-fact-]"],
      ["#ep90-breaths", "#ep90-object", "[id^=ep90-phrase-]", "[id^=ep90-after-]"]
    ],
    EP91: [["#ep91-major", "[name=ep91-field]", "#ep91-field-other-text"], ["#ep91-hours", "[id^=ep91-skill-]"], ["#ep91-unique"], ["[id^=ep91-goal-]"], ["[id^=ep91-difficulty-]"]],
    EP92: [["#ep92-situation"], ["[id^=ep92-emotion-]", "[id^=ep92-result-]"], ["[id^=ep92-maintain]", "[id^=ep92-adjust]", "[id^=ep92-response-]", "#ep92-old-goal", "#ep92-new-goal", "[name=ep92-goal-relation]", "#ep92-goal-relation-other-text"], ["[id^=ep92-knowledge-]", "[id^=ep92-skill-]", "[name=ep92-frequency]", "[id^=ep92-resource-]", "#ep92-now-other"], ["[id^=ep92-short-]", "[id^=ep92-long-]"]],
    EP93: [["#ep93-reading-topic"], ["#ep93-discovery"], ["#ep93-ask-name"], ["#ep93-ask-person"], ["#ep93-ask-skill"], ["#ep93-help-skill", "#ep93-help-person"]],
    EP94: [["[id^=ep94-work-]", "[id^=ep94-money-]", "[id^=ep94-time-]"], ["[id^=ep94-work-]", "[id^=ep94-money-]", "[id^=ep94-time-]"], ["[id$=-backup]"], ["[id$=-finish]", "[id$=-start]", "[id$=-reserve]", "[id$=-limit]", "[id$=-total]", "[id$=-depart]"]],
    EP95: [["#ep95-age"], ["[name=ep95-habit]", "[name=ep95-willing]"], ["#ep95-next-sport"], ["[id^=ep95-hard-]"]],
    EP96: [["#ep96-example", "[id^=ep96-place-]"], ["#ep96-friend-words"], ["[id^=ep96-response-feel-]"], ["[id^=ep96-care-]"], ["#ep96-frequency-time", "#ep96-frequency-count", "#ep96-topic-limit"], ["#ep96-worry"], ["#ep96-next-action"]],
    EP99: [["#ep99-ranking"], ["#ep99-job-current", "#ep99-job-a", "#ep99-job-b", "#ep99-job-c"]],
    EP81: [["[id^=ep81-emotion-]", "#ep81-intensity"], ["#ep81-time", "#ep81-place", "#ep81-doing", "#ep81-people", "#ep81-before", "#ep81-trigger", "#ep81-process"], ["#ep81-action", "#ep81-result"], ["[id^=ep81-others-]", "[id^=ep81-self-]", "[id^=ep81-body-]", "[name=ep81-result]"], ["[name=ep81-source]"], ["#ep81-reminder-event", "#ep81-reminder-feeling", "#ep81-reminder-meaning", "#ep81-next"]],
    EP78: [["[id^=ep78-stuck-]", "#ep78-stuck-other-text"], ["#ep78-thought", "#ep78-observation"], ["[id^=ep78-indulgent-]", "#ep78-indulgent-benefit", "[id^=ep78-indulgent-impact-]", "#ep78-indulgent-other-text"], ["[id^=ep78-critical-]", "#ep78-critical-feeling", "[id^=ep78-critical-impact-]", "#ep78-critical-other-text"], ["[id^=ep78-compassion-]", "#ep78-compassion-next"], ["[id^=ep78-grounding-]", "#ep78-grounding-need"], ["#ep78-friend-situation", "#ep78-friend-words", "#ep78-self-words", "#ep78-next-step"]],
    EP79: [["[id^=ep79-situation-]", "#ep79-situation-other-text"], ["[id^=ep79-feeling-]", "#ep79-feeling-other-text"], ["[name^=ep79-fair-]", "[id^=ep79-reason-]", "#ep79-other-reason"], ["#ep79-goal", "[name=ep79-real-want]", "#ep79-real-want-reason", "[name=ep79-happy]", "#ep79-happy-reason"], ["#ep79-action"]],
    EP101: [["#task-name"], ["#task-result"], ["#task-deadline", "#task-unknown"], ["#task-role"], ["#stuck"], ["#tried"]],
    EP74: [["#ep74-person"], ["#ep74-request"], ["#ep74-burden"], ["#ep74-sentence"]],
    EP102: [["#statement"], ["#context"], ["#problem"], ["#action"], ["#result"]],
    EP103: [["#choice-item"], ["#choice-needs", "#scenario-needs"], ["[name=signals]", "#signal-other-text", "#signal-reason", "#fact-check", "#personal-feeling"]],
    EP104: [["#spending-item", "#spending-amount"], ["[name=spending-needs]", "#need-other-text"], ["#life-style-summary"], ["#spend-style-summary"], ["#people-style-summary"], ["[name=strengths]"], ["[name=pressures]"]],
    EP105: [["#experience-context"], ["#experience-problem"], ["#experience-action"], ["#experience-result"], ["#trait-word"]],
    EP106: [["#short-21", "#long-17"], ["#short-22", "#short-25", "#short-28", "#long-18"], ["#short-23", "#short-26", "#short-29", "#long-19"], ["#short-24", "#short-27", "#long-20"]],
    EP107: [["#short-16"], ["#short-13", "#short-15", "#long-37"]],
    EP109: [["[name=group-1]", "#other-6"], ["#short-38"], ["#short-39"]],
    EP110: [["#short-13"], ["[name=group-4]", "#other-26", "#short-27", "#short-29", "#short-31", "#short-33", "#short-35", "#short-37"]],
    EP111: [["#short-1"]],
    EP112: [["#short-8"]],
    EP113: [
      { manual: "前文沒有要求讀者填寫煩惱" },
      { manual: "前文沒有要求讀者填寫選項 A" },
      { manual: "前文沒有要求讀者填寫選項 B" }
    ],
    EP114: [["#short-23"]],
    EP115: [["#short-16"], ["[name=group-3]", "#other-12", "#short-17"]],
    EP117: [["#long-1"]]
  };
  const scoreTotal = worksheet.querySelector("[data-score-total]");
  const saveStatus = document.querySelector("[data-save-status]");
  const clearButton = document.querySelector('[data-clear]');
  const updateClearButton = () => {
    clearButton.disabled = !controls.some((control) =>
      control.type === "checkbox" || control.type === "radio" ? control.checked : control.value !== ""
    );
  };
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  const answerFor = (control) => {
    if (!control || control.disabled) return "";
    if (control.type === "checkbox" || control.type === "radio") {
      if (!control.checked) return "";
      if (control.value && control.value !== "on") return normalize(control.value);
      return normalize(control.dataset.choiceLabel || control.closest("label")?.innerText || "");
    }
    return normalize(control.value || "");
  };
  const bindingValue = (binding) => {
    const selectors = Array.isArray(binding) ? binding : [];
    const matched = selectors.flatMap((selector) => [...worksheet.querySelectorAll(selector)]);
    return [...new Set(matched.map(answerFor).filter(Boolean))].join("、");
  };
  const bindingIsConfigured = (binding) => {
    if (binding?.manual) return true;
    return Array.isArray(binding)
      && binding.length > 0
      && binding.some((selector) => worksheet.querySelector(selector));
  };
  const updateAutoSummaries = () => {
    worksheet.querySelectorAll("[data-auto-summary]").forEach((summary) => {
      const entries = (summary.dataset.sources || "").split(",").map((source) => {
        const separator = source.indexOf("|");
        if (separator < 1) return "";
        const selector = source.slice(0, separator);
        const label = source.slice(separator + 1);
        const control = worksheet.querySelector(selector);
        const value = answerFor(control);
        return value ? `${label}：${value}` : "";
      }).filter(Boolean);
      summary.textContent = entries.length ? entries.join("；") : "請先填寫上方的客觀資料。";
    });
  };
  const promptTemplates = new WeakMap();
  const templateFor = (root) => {
    if (!promptTemplates.has(root)) promptTemplates.set(root, { html: root.innerHTML, text: root.innerText.trim() });
    return promptTemplates.get(root);
  };
  const promptState = (root) => {
    const template = templateFor(root).text;
    const bindings = promptBindings[worksheet.dataset.worksheetId] || [];
    let index = 0;
    let filled = 0;
    const text = template.replace(/【[^】]+】/g, (placeholder) => {
      const value = bindingValue(bindings[index++]);
      if (!value) return worksheet.dataset.worksheetId === "EP82" ? "不提供" : placeholder;
      filled += 1;
      return value;
    });
    return { text, filled, total: index };
  };
  const replaceTextRange = (root, start, length, value) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let offset = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      nodes.push({ node, start: offset, end: offset + node.data.length });
      offset += node.data.length;
    }
    const end = start + length;
    const touched = nodes.filter((item) => item.end > start && item.start < end);
    if (!touched.length) return;
    const first = touched[0];
    const last = touched[touched.length - 1];
    const prefix = first.node.data.slice(0, start - first.start);
    const suffix = last.node.data.slice(end - last.start);
    first.node.data = prefix + value + (first === last ? suffix : "");
    for (const item of touched.slice(1, -1)) item.node.data = "";
    if (last !== first) last.node.data = suffix;
  };
  const updatePrompt = () => {
    document.querySelectorAll("[data-prompt-text]").forEach((root) => {
      const template = templateFor(root);
      root.innerHTML = template.html;
      const state = promptState(root);
      const bindings = promptBindings[worksheet.dataset.worksheetId] || [];
      const hasWorksheetConfig = Object.prototype.hasOwnProperty.call(promptBindings, worksheet.dataset.worksheetId);
      root.parentElement.dataset.promptConfigured = String(
        hasWorksheetConfig
        && bindings.length === state.total
        && bindings.every(bindingIsConfigured)
      );
      const matches = [...root.textContent.matchAll(/【[^】]+】/g)];
      matches.reverse().forEach((match, reverseIndex) => {
        const value = bindingValue(bindings[matches.length - reverseIndex - 1]);
        if (value) replaceTextRange(root, match.index, match[0].length, value);
      });
      root.parentElement.dataset.promptStatus = state.total === 0
        ? "這段提示詞不需要代入作答。"
        : state.filled === state.total
          ? `已自動代入 ${state.total} 項作答。`
          : `已自動代入 ${state.filled}／${state.total} 項；未作答處保留括號提示。`;
    });
  };
  const copyPrompt = async (button) => {
    const root = button.closest(".prompt-quote")?.querySelector("[data-prompt-text]");
    const prompt = root ? promptState(root).text : "";
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch (_) {
      const helper = document.createElement("textarea");
      helper.value = prompt;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.append(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    const original = button.textContent;
    button.textContent = "已複製";
    window.setTimeout(() => { button.textContent = original; }, 1800);
  };
  const updateScore = () => {
    if (!scoreTotal) return;
    const total = [...worksheet.querySelectorAll("input[data-score]:checked")]
      .reduce((sum, control) => sum + Number(control.dataset.score), 0);
    scoreTotal.value = total ? String(total) : "";
  };
  const save = () => {
    updateClearButton();
    const state = Object.fromEntries(controls.map((control) => [
      control.id,
      control.type === "checkbox" || control.type === "radio"
        ? { checked: control.checked }
        : { value: control.value }
    ]));
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
      saveStatus.textContent = "已暫存";
    } catch (_) {
      saveStatus.textContent = "無法使用暫存";
    }
  };
  const restore = () => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (!state || typeof state !== "object" || !controls.some((control) => state[control.id])) return;
      controls.forEach((control) => {
        const saved = state[control.id];
        if (!saved) return;
        if (control.type === "checkbox" || control.type === "radio") control.checked = Boolean(saved.checked);
        else control.value = saved.value || "";
      });
      saveStatus.textContent = "已還原本次暫存";
    } catch (_) { saveStatus.textContent = "無法還原暫存"; }
  };
  const clearDraft = () => {
    try { sessionStorage.removeItem(storageKey); } catch (_) {}
    controls.forEach((control) => {
      if (control.type === "checkbox" || control.type === "radio") control.checked = false;
      else control.value = "";
    });
    updateScore();
  };
  controls.forEach((control) => {
    control.addEventListener("change", () => { updateScore(); save(); updatePrompt(); updateAutoSummaries(); });
    control.addEventListener("input", () => { save(); updatePrompt(); updateAutoSummaries(); });
  });
  document.querySelector("[data-print]").addEventListener("click", () => window.print());
  document.querySelectorAll("[data-prompt-copy]").forEach((button) => {
    button.addEventListener("click", () => { copyPrompt(button); });
  });
  document.getElementById("clear-draft").addEventListener("click", () => {
    if (!window.confirm("確定要清除這個分頁中的所有作答嗎？清除後無法復原。")) return;
    clearDraft();
    updateClearButton();
    updatePrompt();
    updateAutoSummaries();
    saveStatus.textContent = "作答已清除";
  });
  const videoLink = document.querySelector('[data-video-link]');
  fetch('metadata.json')
    .then((response) => { if (!response.ok) throw new Error('索引載入失敗'); return response.json(); })
    .then((item) => {
      if (item.ep !== worksheet.dataset.worksheetId) throw new Error('影片資料與集數不一致');
      if (!item?.videoUrl) return;
      const url = new URL(item.videoUrl);
      if (url.protocol !== 'https:') return;
      videoLink.href = url.href;
      videoLink.hidden = false;
    })
    .catch(() => { document.querySelector('[data-video-status]').hidden = false; });
  restore();
  updateClearButton();
  updateScore();
  updatePrompt();
  updateAutoSummaries();
})();
