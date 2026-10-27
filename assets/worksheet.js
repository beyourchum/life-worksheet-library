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
    if (copy.querySelector(".glyph-system-fallback, .glyph-fallback")) return;
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
    if (copy.querySelector(".glyph-system-fallback")) return;
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
    EP70: [["#ep70-action"], ["#ep70-offline"]],
    EP100: [["#ep100-goal"], ["[name=ep100-cost]", "#ep100-cost-other-text", "[name=ep100-risk]", "#ep100-risk-other-text", "[name=ep100-barrier]", "#ep100-barrier-other-text"], ["#ep100-cost-answer", "#ep100-risk-answer", "#ep100-barrier-answer"], ["[name=ep100-stuck]", "#ep100-stuck-detail"], ["#ep100-condition-1", "#ep100-condition-2", "#ep100-condition-3"], ["[name=ep100-priority]"]],
    EP98: [["#ep98-major", "[name=ep98-typical]", "#ep98-typical-info"], ["[name=ep98-test]", "#ep98-test-status"], ["[name=ep98-self]", "#ep98-self-evidence"], ["#ep98-job", "[name=ep98-tasks]", "#ep98-tasks-other-text", "#ep98-task-evidence"], ["[name=ep98-environment]", "#ep98-environment-other-text"], ["#ep98-fit", "#ep98-related", "#ep98-related-fit"]],
    EP23: [
      ["[name=ep23-w1-situation]", "#ep23-w1-situation-other-text", "#ep23-w1-situation-text"],
      ["#ep23-w1-fact"],
      ["#ep23-w2-original"],
      ["#ep23-w2-known"],
      ["#ep23-w2-unknown", "#ep23-w2-unrecoverable"],
      ["#ep23-w2-available"],
      ["#ep23-w1-feeling", "#ep23-w1-intensity"],
      ["[name=ep23-w3-value]", "#ep23-w3-value-other-text", "#ep23-w3-reminder", "#ep23-w3-value-clue", "#ep23-w3-next-clue"],
      ["#ep23-w4-accept"],
      ["#ep23-w4-if", "#ep23-w4-at-least", "#ep23-w4-remember"],
      ["#ep23-w5-goal", "#ep23-w5-when", "#ep23-w5-step", "#ep23-w5-support", "#ep23-w5-backup", "#ep23-w5-proof", "[name=ep23-w5-way]", "#ep23-w5-way-other-text"]
    ],
    EP19: [
      ["[name=ep19-w1-situation]", "#ep19-w1-situation-other-text", "#ep19-w1-context"],
      ["#ep19-w1-fact"],
      ["#ep19-w1-expectation", "#ep19-w1-gap"],
      ["#ep19-w1-feeling", "#ep19-w1-impact"],
      ["[name=ep19-w2-clue]", "#ep19-w2-clue-other-text", "#ep19-w2-selected", "#ep19-w2-judgment", "#ep19-w2-evidence"],
      ["#ep19-w2-pending", "#ep19-w2-rewrite"],
      ["#ep19-w3-difficulty", "#ep19-w3-action", "#ep19-w3-ability", "[name=ep19-w3-belief]", "#ep19-w3-belief-other-text", "#ep19-w3-selected", "#ep19-w3-proof"],
      ["#ep19-w3-support-info", "#ep19-w3-support-ask"],
      ["#ep19-w4-cycle-minutes", "#ep19-w4-cycle-scope", "#ep19-w4-cycle-practice", "#ep19-w4-cycle-feedback", "#ep19-w4-cycle-stuck", "#ep19-w4-small"],
      ["#ep19-w5-target", "#ep19-w5-when", "#ep19-w5-first", "#ep19-w5-stop", "#ep19-w5-resource", "#ep19-w5-evidence", "#ep19-w5-backup", "#ep19-w5-review", "#ep19-w5-action", "#ep19-w5-check", "#ep19-w5-adjust"]
    ],
    EP21: [
      ["[name=ep21-w1-scene]", "#ep21-w1-scene-other-text", "#ep21-w1-scene-detail"],
      ["#ep21-w1-event", "#ep21-w1-frequency"],
      ["#ep21-w1-resources", "#ep21-w1-signals"],
      ["[name=ep21-w1-stress]", "#ep21-w1-reason"],
      ["[name=ep21-w2-type]", "#ep21-w2-evidence"],
      ["#ep21-w2-chain-ability", "#ep21-w2-chain-emotion", "#ep21-w2-chain-identity"],
      ["#ep21-w3-capacity", "#ep21-w3-offer", "#ep21-w3-stop", "#ep21-w3-cannot", "#ep21-w3-alternative", "#ep21-w3-if-then"],
      ["#ep21-w4-ack", "#ep21-w4-limit", "#ep21-w4-question", "#ep21-w4-sentence"],
      ["#ep21-w5-worry", "[name=ep21-w5-evidence]"],
      ["[name=ep21-w5-value]", "#ep21-w5-value-other-text", "#ep21-w5-support", "#ep21-w5-card-resource", "#ep21-w5-card-boundary", "#ep21-w5-card-alternative", "#ep21-w5-card-when", "#ep21-w5-card-safety", "#ep21-w5-card-proof", "[name=ep21-w5-action]", "#ep21-w5-action-other-text"]
    ],
    EP22: [
      ["#ep22-w2-challenge"],
      ["[name=ep22-w1-mindset]", "#ep22-w1-mindset-other-text"],
      ["#ep22-w1-evidence", "#ep22-w1-clue"],
      ["[name=ep22-w2-own]", "#ep22-w2-own-other-text", "#ep22-w2-responsible"],
      ["#ep22-w2-deadline", "#ep22-w2-output", "#ep22-w2-frequency", "#ep22-w2-proof"],
      ["#ep22-w3-path-a", "#ep22-w3-support-a", "#ep22-w3-path-b", "#ep22-w3-support-b"],
      ["#ep22-w3-obstacle", "#ep22-w3-ifthen"],
      ["#ep22-w3-confidence", "#ep22-w3-confidence-reason", "#ep22-w3-plus-one"],
      ["#ep22-w4-path", "#ep22-w4-when", "#ep22-w4-action", "#ep22-w4-prepare", "#ep22-w4-proof", "#ep22-w4-backup", "#ep22-w4-experiment"]
    ],
    EP24: [
      ["#ep24-w1-context"],
      ["#ep24-w1-trigger"],
      ["#ep24-w1-state"],
      ["#ep24-w1-appraisal"],
      ["[name=ep24-w2-type]", "#ep24-w2-original"],
      ["#ep24-w3-need"],
      ["#ep24-w3-impact"],
      ["[name=ep24-w4-strategy]", "#ep24-w4-action"],
      ["#ep24-w5-message"],
      ["#ep24-w5-proof"]
    ],
    EP28: [["#ep28-task"], ["#ep28-standard"], ["[name=ep28-benefit]"], ["[name=ep28-cost]"], ["[name=ep28-evaluation-axis]"], ["[name=ep28-type-reflection]"], ["[data-limited-choice='ep28-good-enough-criteria']"], ["#ep28-time-boundary"], ["#ep28-next-action"], ["#ep28-restart-condition"]],
    EP42: [["#ep42-w1-context"], ["#ep42-w2-trait"], ["#ep42-w2-experience"], ["#ep42-w2-action"], ["#ep42-w2-skill"], ["#ep42-w2-target"], ["#ep42-w2-use"]],
    EP40: [["#ep40-practice-question"], ["[name=ep40-reaction]", "#ep40-intuitive-answer"], ["[name=ep40-interpretation]"], ["#ep40-interpretation-note"], ["#ep40-response"], ["#ep40-boundary"]],
    EP39: [["#ep39-target"], ["#ep39-situation"], ["#ep39-my-action"], ["#ep39-my-intention"], ["[name=ep39-possible-need]"], ["#ep39-action-plan"], ["#ep39-check-in"]],
    EP38: [["#ep38-habit"], ["#ep38-outcome"], ["[name=ep38-barrier]"], ["#ep38-cue-when"], ["#ep38-cue-where"], ["#ep38-cue-action"], ["#ep38-temptation"], ["#ep38-attraction-plan"], ["#ep38-easy-version"], ["#ep38-environment-change"], ["#ep38-reward"], ["#ep38-recovery"]],
    EP37: [["#ep37-current-stressor"], ["[name=ep37-state]"], ["#ep37-self-care-action"], ["#ep37-micro-area"], ["#ep37-yesterday-progress"], ["#ep37-small-good"], ["#ep37-support-person"], ["#ep37-action"], ["#ep37-action-when"], ["#ep37-backup"]],
    EP35: [["#ep35-task"], ["[name=ep35-trigger]", "[name=ep35-state]"], ["#ep35-task-value"], ["#ep35-small-step-1", "#ep35-small-step-2", "#ep35-small-step-3"], ["#ep35-ritual-action"], ["#ep35-stuck-self-talk"], ["#ep35-implementation-plan"], ["#ep35-break-rule", "#ep35-restart-plan", "#ep35-restart-if-fail"]],
    EP29: [
      ["#ep29-w1-task"],
      ["#ep29-w1-goal"],
      ["#ep29-w1-method"],
      ["#ep29-w2-fact"],
      ["#ep29-w2-adjust"],
      ["#ep29-w3-self-action", "#ep29-w3-self-info", "#ep29-w3-self-pressure", "#ep29-w3-self-include", "#ep29-w3-others-action", "#ep29-w3-others-info", "#ep29-w3-others-pressure", "#ep29-w3-others-include", "#ep29-w3-social-action", "#ep29-w3-social-info", "#ep29-w3-social-pressure", "#ep29-w3-social-include"],
      ["[name=ep29-w4-signal]", "#ep29-w4-signal-1", "#ep29-w4-fact-1", "#ep29-w4-cost-1", "#ep29-w4-control-1", "#ep29-w4-signal-2", "#ep29-w4-fact-2", "#ep29-w4-cost-2", "#ep29-w4-control-2"],
      ["[name=ep29-w4-decision]", "#ep29-w4-reason"],
      ["#ep29-w5-release", "#ep29-w5-core", "#ep29-w5-test", "#ep29-w5-duration", "#ep29-w5-review"],
      ["#ep29-w5-duration"]
    ],
    EP34: [["#ep34-topic"], ["#ep34-material-scope"], ["#ep34-keyword-1"], ["#ep34-keyword-2"], ["#ep34-keyword-3"], ["#ep34-framework-summary"], ["#ep34-unresolved"], ["#ep34-point-1-topic", "#ep34-point-1-note"], ["#ep34-point-2-topic", "#ep34-point-2-note"], ["#ep34-point-3-topic", "#ep34-point-3-note"], ["#ep34-point-4-topic", "#ep34-point-4-note"], ["#ep34-point-5-topic", "#ep34-point-5-note"], ["#ep34-one-line-diary"]],
    EP33: [["[data-limited-choice='ep33-w1-time']"], ["#ep33-w1-keep", "#ep33-w1-rearrange"], ["#ep33-w2-content", "#ep33-w2-trigger"], ["#ep33-w2-purpose", "#ep33-w2-end", "#ep33-w2-first"], ["#ep33-w3-goal", "[data-limited-choice='ep33-w3-strategy']"], ["#ep33-w3-boundary"], ["[name=ep33-w4-style]", "#ep33-w4-setting", "#ep33-w4-opening"], ["[name=ep33-w5-focus]", "#ep33-w5-action", "#ep33-w5-time", "#ep33-w5-place", "#ep33-w5-signal"]],
    EP32: [["#ep32-skill"], ["#ep32-context"], ["[name=ep32-stuck-point]", "#ep32-stuck-point-other-text"], ["#ep32-current-evidence"], ["#ep32-goal"], ["#ep32-focus"], ["[name=ep32-feedback-source]", "#ep32-feedback-source-other-text", "#ep32-feedback-source-note"], ["#ep32-feedback-question"], ["[name=ep32-stretch]", "#ep32-stretch-other-text"], ["#ep32-stretch-limit"]],
    EP43: [["[name=ep43-w1-situation]", "#ep43-w1-situation-other-text", "#ep43-w1-context"], ["[name=ep43-w2-pull]", "#ep43-w2-pull-other-text"], ["#ep43-w2-need"], ["[name=ep43-w3-guardrail]", "#ep43-w3-guardrail-other-text", "#ep43-w3-guardrail-note"], ["#ep43-w3-obstacle"], ["[name=ep43-w4-experiment]", "#ep43-w4-experiment-other-text", "#ep43-w4-time-place", "#ep43-w4-action", "#ep43-w4-fallback"]],
    EP41: [["#ep41-w1-task"], ["#ep41-w1-context"], ["[name=ep41-w1-blocker]", "#ep41-w1-blocker-other-text"], ["#ep41-w2-reason"], ["#ep41-w5-action"], ["#ep41-w5-context"]],
    EP36: [["#ep36-w5-direction"], ["#ep36-w5-resources"], ["#ep36-w3-short"], ["#ep36-w5-action"], ["#ep36-w4-step1-support"], ["#ep36-w5-pressure"]],
    EP44: [["#ep44-w2-context"], ["#ep44-w2-option-one"], ["#ep44-w2-option-two"], ["[name=ep44-w3-method]", "#ep44-w3-method-other-text"], ["#ep44-w3-when"]],
    EP45: [["[name=ep45-w2-target]"], ["#ep45-w2-reason"], ["#ep45-w2-when"], ["#ep45-w2-action"], ["#ep45-w2-measure"]],
    EP46: [["[name=ep46-w1-type]"], ["#ep46-w3-context"], ["#ep46-w3-ritual"], ["#ep46-w3-task"]],
    EP30: [["#ep30-w1-task"], ["[name=ep30-w1-target]"], ["#ep30-w1-known"], ["#ep30-w1-unit-1", "#ep30-w1-unit-2", "#ep30-w1-unit-3"], ["#ep30-w2-time"], ["#ep30-w3-overview"], ["#ep30-w4-uncertain"]],
    EP31: [["#ep31-w1-content"], ["[name=ep31-w1-encoding]", "#ep31-w1-encoding-reason", "#ep31-w1-item-1", "#ep31-w1-place-1", "#ep31-w1-item-2", "#ep31-w1-place-2", "#ep31-w1-item-3", "#ep31-w1-place-3"], ["#ep31-w2-detail"], ["#ep31-w2-keywords", "#ep31-w2-question"], ["#ep31-w3-practice"], ["#ep31-w3-when"], ["[name=ep31-w3-recovery]", "#ep31-w3-recovery-note"], ["#ep31-w4-start", "#ep31-w4-start-note"], ["#ep31-w5-change"]],
    EP26: [["#ep26-w5-context"], ["#ep26-w5-sharing"], ["#ep26-w5-understand"], ["#ep26-w5-avoid"], ["#ep26-w5-question"], ["#ep26-w5-return"]],
    EP27: [
      ["[name=ep27-w1-type]", "#ep27-w1-context"],
      ["#ep27-w1-fact", "#ep27-w1-feeling", "#ep27-w1-reason"],
      ["[name=ep27-w2-body]", "#ep27-w2-intensity", "#ep27-w2-sentence", "#ep27-w2-after"],
      ["#ep27-w3-name", "[name=ep27-w3-need]"],
      ["#ep27-w3-phrase"],
      ["#ep27-w4-event-1", "#ep27-w4-feeling-1", "#ep27-w4-action-1", "#ep27-w4-need-1", "#ep27-w4-event-2", "#ep27-w4-feeling-2", "#ep27-w4-action-2", "#ep27-w4-need-2", "#ep27-w4-insight", "#ep27-w4-uncertain"],
      ["[name=ep27-w5-channel]", "#ep27-w5-fact", "#ep27-w5-invite", "#ep27-w5-script", "#ep27-w5-script-invite", "#ep27-w5-reminder"],
      ["#ep27-w6-moment", "#ep27-w6-event", "#ep27-w6-evidence", "[name=ep27-w6-step]", "#ep27-w6-time", "#ep27-w6-proof"]
    ],
    EP20: [
      ["[name=ep20-w1-situation]", "#ep20-w1-context"],
      ["#ep20-w1-fact"],
      ["#ep20-w1-interpretation"],
      ["#ep20-w1-feeling"],
      ["#ep20-w1-need"],
      ["#ep20-w2-invest", "#ep20-w2-person", "#ep20-w2-place", "#ep20-w2-opportunity", "#ep20-w2-existing"],
      ["#ep20-w2-explore"],
      ["#ep20-w3-value"],
      ["#ep20-w3-expectation"],
      ["#ep20-w3-conditions"],
      ["#ep20-w3-known", "#ep20-w3-unknown"],
      ["[data-limited-choice='ep20-w3-criteria']", "#ep20-w3-priority"],
      ["#ep20-w4-stay-support", "#ep20-w4-stay-cost", "#ep20-w4-stay-test", "#ep20-w4-cross-support", "#ep20-w4-cross-cost", "#ep20-w4-cross-test", "#ep20-w4-change-support", "#ep20-w4-change-cost", "#ep20-w4-change-test"],
      ["#ep20-w5-question", "#ep20-w5-time", "#ep20-w5-action", "#ep20-w5-person", "#ep20-w5-limit", "#ep20-w5-backup", "#ep20-w5-evidence"]
    ],
    EP25: [["#ep25-w1-task"], ["#ep25-w1-deadline"], ["#ep25-w1-stuck"], ["[name=ep25-w2-type]"], ["#ep25-w2-worry"], ["[name=ep25-w3-direction]"], ["#ep25-w4-hours"], ["#ep25-w4-goal"], ["#ep25-w5-step", "#ep25-w5-when"], ["#ep25-w5-proof", "#ep25-w5-check"]],
    EP47: [["#ep47-w1-event"], ["#ep47-w1-goal"], ["#ep47-w2-other-point", "#ep47-w2-unclear"], ["[name=ep47-w1-worry]", "#ep47-w1-worry-other-text"], ["[name=ep47-w2-method]", "#ep47-w2-method-other-text"]],
    EP48: [["#ep48-w2-task"], { manual: "原稿只有固定練習案例，未要求另填一個抽象任務；請在提示詞中自行補上。" }],
    EP49: [
      ["#ep49-w2-event"],
      ["#ep49-w2-other-action", "#ep49-w2-my-reaction", "#ep49-w2-my-action", "#ep49-w2-their-response"],
      ["#ep49-w3-emotion-note"],
      ["#ep49-w3-cause-note", "[name=ep49-w3-cause]"],
      ["#ep49-w4-next"]
    ],
    EP62: [["#choice-46", "#choice-47", "#choice-48", "#choice-49", "#choice-50", "#choice-51", "#other-52"], ["#short-53"]],
    EP63: [["[name=ep63-w1-living]"], ["[name=ep63-w1-savings]"], ["[name=ep63-w1-investment]"], ["[name=ep63-w2-risk]", "#ep63-w2-risk-other-text", "[name=ep63-w2-consequence]", "#ep63-w2-consequence-other-text"], ["[name=ep63-w2-tolerate]", "[name=ep63-w2-worth]"], ["[name=ep63-w3-tangible]", "#ep63-w3-tangible-other-text", "#ep63-w3-tangible-action"], ["[name=ep63-w3-intangible]", "#ep63-w3-intangible-other-text", "#ep63-w3-intangible-action"], ["#ep63-w4-reminder"]],
    EP54: [["#ep54-w1-background"], ["#ep54-w1-question"], ["#ep54-w1-emotion"]],
    // EP55 prompt fields follow the worksheet's four action checkpoints.
    EP55: [["[name=ep55-w4-signal]"], ["[name=ep55-w2-green-action]", "[name=ep55-w2-yellow-next]", "[name=ep55-w2-red-action]"], ["#ep55-w3-message", "#ep55-w3-message-custom", "#ep55-w3-stop-sentence"], ["#ep55-w4-green", "#ep55-w4-yellow", "#ep55-w4-red", "#ep55-w4-reminder"]],
    EP56: [["[name=ep56-w1-barrier]", "#ep56-w1-priority"], ["[name=ep56-w4-experiment]", "#ep56-w4-plan"], ["#ep56-w4-signal"]],
    EP58: [
      ["[name=ep58-w1-trigger]", "[name=ep58-w1-thought]", "#ep58-w1-focus", "#ep58-w1-observation"],
      ["[name=ep58-w2-assets]", "#ep58-w2-asset-main", "#ep58-w2-asset-evidence"],
      ["#ep58-w3-target", "[name=ep58-w3-feelings]", "[name=ep58-w3-body]", "#ep58-w3-fair", "#ep58-w3-whisper", "[name=ep58-w3-care]"],
      ["[name=ep58-w4-actions]", "#ep58-w4-action-social-count", "#ep58-w4-action-view-count", "#ep58-w4-action-record-activity", "#ep58-w4-action-value-days", "#ep58-w4-action-photo-minutes", "#ep58-w4-action-support-person", "#ep58-w4-action-support-resource", "#ep58-w4-action-other-text", "#ep58-w4-selected", "#ep58-w4-when", "#ep58-w4-signal"]
    ],
    EP59: [
      ["[name=ep59-w1-body]", "[name=ep59-w1-mind]", "[name=ep59-w1-space]", "[name=ep59-w1-support]", "[name=ep59-w1-result]"],
      ["[name=ep59-w2-scenario]", "[name=ep59-w2-signals]", "#ep59-w2-signal-other-text", "#ep59-w2-check-sentence"],
      ["[name=ep59-w3-dialogue]", "#ep59-w3-dialogue-reason", "[name=ep59-w3-image]", "#ep59-w3-image-other-text"],
      ["[name=ep59-w4-brake]", "#ep59-w4-brake-other-text"],
      ["[name=ep59-w4-exit]", "#ep59-w4-exit-contact-text", "#ep59-w4-exit-transport-text", "#ep59-w4-exit-other-text", "#ep59-w4-boundary"]
    ],
    EP57: [
      ["[name=ep57-w1-body-questions]", "#ep57-w1-body-other-text", "#ep57-w1-question", "#ep57-w1-resource"],
      ["[name=ep57-w2-principles]", "#ep57-w2-reminder", "[name=ep57-w2-actions]", "#ep57-w2-action-other-text", "[name=ep57-w3-scenario]"],
      ["#ep57-w3-boundary", "[name=ep57-w4-brake]", "#ep57-w4-brake-other-text", "#ep57-w4-own-sentence", "[name=ep57-w4-safety]", "#ep57-w4-safety-other-text", "#ep57-w5-neutral"],
      ["[name=ep57-w5-action]", "#ep57-w5-action-other-text", "#ep57-w5-time", "#ep57-w5-signal"]
    ],
    EP60: [["#ep60-body-summary", "#ep60-body-change-note", "[name^=ep60-body-]", "#ep60-body-sleep-other-text", "#ep60-body-appetite-other-text", "#ep60-body-tension-other-text", "#ep60-body-heart-other-text"], ["#ep60-fact-time", "#ep60-fact-place", "#ep60-fact-people", "#ep60-fact-event", "#ep60-fact-why", "#ep60-fact-how"], ["#ep60-highlight-senses", "#ep60-highlight-incident"], ["#ep60-emotion-now"], ["#ep60-emotion-after"], ["#ep60-concern-unseen", "#ep60-concern-scolded", "#ep60-concern-negative", "#ep60-concern-none", "#ep60-concern-other-text"]],
    EP61: [["#ep61-w1-total"], ["#ep61-w2-context"], ["#ep61-w2-joke"], ["#ep61-w2-response"], ["#ep61-w3-care"]],
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
    EP68: [["#ep68-w1-need"], ["#ep68-w2-fact"], ["#ep68-w2-guess"], ["#ep68-w2-reason"], ["#ep68-w3-script"]],
    EP69: [["#ep69-w1-place"], ["#ep69-w1-action"], ["#ep69-w2-fact"], ["#ep69-w2-guess"], ["#ep69-w2-other-reason"], ["#ep69-w3-person"], ["#ep69-w3-difficulty"]],
    EP67: [["[name=ep67-w1-emotional]"], ["[name=ep67-w1-interest]"], ["[name=ep67-w1-relax]"], ["#ep67-w2-interest-person"], ["#ep67-w2-helper"], ["#ep67-w2-emotional-person"], ["[name=ep67-w2-boundary]", "#ep67-w2-boundary-other-text"], ["#ep67-w2-place"], ["[name=ep67-w3-reminder]", "#ep67-w3-reminder-other-text"], ["#ep67-w3-step"]],
    EP66: [["[name=ep66-w1-digital]", "#ep66-w1-digital-other-text"], ["#ep66-w1-purpose"], ["[name=ep66-w1-checks]", "#ep66-w1-check-other-text"], ["[name=ep66-w2-support]", "#ep66-w2-support-other-text"], ["#ep66-w2-purpose"], ["#ep66-w2-check"], ["[name=ep66-w3-resource]", "#ep66-w3-resource-other-text"], ["[name=ep66-w3-benefit]", "#ep66-w3-benefit-other-text"], ["#ep66-w3-check"], ["#ep66-w4-first-step"], ["#ep66-w4-time"], ["#ep66-w4-place"], ["#ep66-w4-ask"], ["#ep66-w4-alternative"]],
    EP64: [["[name=ep64-w1-value]", "[name=ep64-w1-meaning]"], ["#ep64-w1-identity-1", "#ep64-w1-identity-2"], ["[name=ep64-w2-translation]", "#ep64-w3-keywords"], ["[name^=ep64-w3-check-]", "#ep64-w3-observe"], ["[name=ep64-w3-response]", "[name=ep64-w4-next]", "#ep64-w4-first"], ["#ep64-w4-reminder"]],
    EP65: [["[name=ep65-w1-trigger]", "#ep65-w1-trigger-other-text"], ["[name=ep65-w2-boundary]", "#ep65-w2-boundary-other-text", "#ep65-w2-red-line"], ["[name=ep65-w3-protect]", "#ep65-w3-protect-other-text", "#ep65-w3-first"], ["[name=ep65-w4-action]", "#ep65-w4-action-other-text", "#ep65-w4-first"], ["#ep65-w4-reminder"]],
    EP73: [["[name=ep73-situation]", "#ep73-situation-other-text"], ["#ep73-protect"], ["#ep73-first-step"], ["#ep73-boundary-sentence"], ["#ep73-help"], ["#ep73-not-do"]],
    EP71: [["[id^=ep71-change-]", "#ep71-known"], ["[id^=ep71-feeling-]"], ["#ep71-unknown", "#ep71-remind"], ["[name=ep71-action]", "#ep71-action-person", "#ep71-action-pause-time", "#ep71-action-resource", "#ep71-action-other-text", "#ep71-next-when", "#ep71-next-action"]],
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
    EP77: [
      ["[name=ep77-s1]", "#ep77-s1-reason"],
      ["[name=ep77-s2]", "#ep77-s2-reason"],
      ["[name=ep77-s3]", "#ep77-s3-reason"],
      ["#ep77-action", "#ep77-goal", "#ep77-alternative", "#ep77-time", "[id^=ep77-change-]"],
      ["[id^=ep77-fear-]", "#ep77-fear-other-text", "#ep77-first", "#ep77-small-step"]
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
    EP53: [
      ["[name=ep53-w1-situation]", "#ep53-w1-situation-other-text"],
      ["[name=ep53-w2-fixed]", "#ep53-w2-fixed-other-text"],
      ["[name=ep53-w3-reminder]", "#ep53-w3-reminder-other-text"],
      ["[name=ep53-w4-action]", "#ep53-w4-action-other-text"]
    ],
    EP52: [
      ["#ep52-w1-current"],
      ["#ep52-w2-focus"],
      ["[name=ep52-w3-method]", "#ep52-w3-method-other-text", "#ep52-w3-keep"],
      ["[name=ep52-w4-action]", "#ep52-w4-action-other-text"],
      ["#ep52-w4-start"]
    ],
    EP50: [
      ["#ep50-w1-context"],
      ["#ep50-w2-reaction-note"],
      ["#ep50-w3-name"],
      ["#ep50-w4-first"],
      ["#ep50-w4-support"]
    ],
    EP51: [
      ["#ep51-w1-question", "[name=ep51-w1-question-category]", "#ep51-w1-question-other-text"],
      ["#ep51-w2-focus"],
      ["#ep51-w3-context"],
      ["#ep51-w3-method"],
      ["#ep51-w3-adjust"],
      ["[name=ep51-w4-result]", "#ep51-w4-takeaway"],
      ["#ep51-w4-next"]
    ],
    EP91: [["#ep91-major", "[name=ep91-field]", "#ep91-field-other-text"], ["#ep91-hours", "[id^=ep91-skill-]"], ["#ep91-unique"], ["[id^=ep91-goal-]"], ["[id^=ep91-difficulty-]"]],
    EP92: [["#ep92-situation"], ["[id^=ep92-emotion-]", "[id^=ep92-result-]"], ["[id^=ep92-maintain]", "[id^=ep92-adjust]", "[id^=ep92-response-]", "#ep92-old-goal", "#ep92-new-goal", "[name=ep92-goal-relation]", "#ep92-goal-relation-other-text"], ["[id^=ep92-knowledge-]", "[id^=ep92-skill-]", "[name=ep92-frequency]", "[id^=ep92-resource-]", "#ep92-now-other"], ["[id^=ep92-short-]", "[id^=ep92-long-]"]],
    EP93: [["#ep93-reading-topic"], ["#ep93-discovery"], ["#ep93-ask-name"], ["#ep93-ask-person"], ["#ep93-ask-skill"], ["#ep93-help-skill", "#ep93-help-person"]],
    EP94: [["[id^=ep94-work-]", "[id^=ep94-money-]", "[id^=ep94-time-]"], ["[id^=ep94-work-]", "[id^=ep94-money-]", "[id^=ep94-time-]"], ["[id$=-backup]"], ["[id$=-finish]", "[id$=-start]", "[id$=-reserve]", "[id$=-limit]", "[id$=-total]", "[id$=-depart]"]],
    EP95: [["#ep95-age"], ["[name=ep95-habit]", "[name=ep95-willing]"], ["#ep95-next-sport"], ["[id^=ep95-hard-]"]],
    EP96: [["#ep96-example", "[id^=ep96-place-]"], ["#ep96-friend-words"], ["[id^=ep96-response-feel-]"], ["[id^=ep96-care-]"], ["#ep96-frequency-time", "#ep96-frequency-count", "#ep96-topic-limit"], ["#ep96-worry"], ["#ep96-next-action"]],
    EP99: [["#ep99-ranking"], ["#ep99-job-current", "#ep99-job-a", "#ep99-job-b", "#ep99-job-c"]],
    EP81: [["[id^=ep81-emotion-]", "#ep81-intensity"], ["#ep81-time", "#ep81-place", "#ep81-doing", "#ep81-people", "#ep81-before", "#ep81-trigger", "#ep81-process"], ["#ep81-action", "#ep81-result"], ["[id^=ep81-others-]", "[id^=ep81-self-]", "[id^=ep81-body-]", "[name=ep81-result]"], ["[name=ep81-source]"], ["#ep81-reminder-event", "#ep81-reminder-feeling", "#ep81-reminder-meaning", "#ep81-next"]],
    EP78: [["[id^=ep78-stuck-]", "#ep78-stuck-other-text"], ["#ep78-thought"], ["#ep78-critical-feeling", "[id^=ep78-critical-impact-]"], ["#ep78-self-words"], ["#ep78-next-step"]],
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
    EP117: [["#long-1"]],
    EP118: [
      ["#ep118-original-plan"],
      ["#ep118-unexpected-change"],
      ["#ep118-adjust"],
      ["#ep118-restart-time"],
      ["#ep118-first-action"],
      ["#ep118-reflect-start"],
      ["#ep118-reflect-end"],
      ["#ep118-next-adjustment"],
      ["#ep118-joint-task"],
      ["#ep118-waiting-person"],
      ["#ep118-waiting-action"],
      ["#ep118-check-time"],
      ["#ep118-delivery-standard"],
      ["#ep118-if-done"],
      ["#ep118-if-not-done"],
      ["#ep118-affected-person"],
      ["#ep118-possible-impact"],
      ["#ep118-own-boundary"],
      ["#ep118-unknown-premise"],
      ["#ep118-affected-plans"],
      ["#ep118-outcome-one"],
      ["#ep118-plan-one"],
      ["#ep118-outcome-two"],
      ["#ep118-plan-two"],
      ["#ep118-common"],
      ["#ep118-review-time"],
      ["#ep118-update-basis"],
      ["#ep118-alternative"]
    ],
    EP120: [
      ["#ep120-relationship-type"],
      ["#ep120-situation"],
      ["#ep120-feeling"],
      ["#ep120-score-total"],
      ["#ep120-most-concerning"],
      ["#ep120-basic-need"],
      ["#ep120-review-deadline"],
      ["#ep120-criterion"],
      ["#ep120-protective-action"]
    ],
    EP119: [
      ["#ep119-context"],
      ["[name=ep119-focus]", "#ep119-focus-other-text", "#ep119-focus-note", "#ep119-focus-return"],
      ["#ep119-impact"],
      ["[name=ep119-need]", "#ep119-need-other-text", "#ep119-priority"],
      ["#ep119-boundary-limit"]
    ]
  };
  const scoreTotal = worksheet.querySelector("[data-score-total]");
  const scoreSumGroups = {
    EP44: [
      { total: "#ep44-w2-one-total", sources: ["#ep44-w2-one-score-1", "#ep44-w2-one-score-2", "#ep44-w2-one-score-3"] },
      { total: "#ep44-w2-two-total", sources: ["#ep44-w2-two-score-1", "#ep44-w2-two-score-2", "#ep44-w2-two-score-3"] }
    ]
  }[worksheet.dataset.worksheetId] || [];
  const saveStatus = document.querySelector("[data-save-status]");
  const clearButton = document.querySelector('[data-clear]');
  const updateClearButton = () => {
    clearButton.disabled = !controls.some((control) =>
      control.type === "checkbox" || control.type === "radio" ? control.checked : control.value !== ""
    );
  };
  const initExclusiveChoices = () => {
    worksheet.querySelectorAll("[data-exclusive-choice-group]").forEach((group) => {
      const name = group.dataset.exclusiveChoiceGroup;
      const exclusive = group.querySelector(`[data-exclusive-choice="${CSS.escape(name)}"]`);
      const choices = [...group.querySelectorAll('input[type="checkbox"]')];
      if (!exclusive || !choices.includes(exclusive)) return;
      const update = () => {
        if (!exclusive.checked) return;
        choices.filter((choice) => choice !== exclusive).forEach((choice) => { choice.checked = false; });
      };
      worksheet.addEventListener("change", (event) => {
        if (!choices.includes(event.target)) return;
        if (event.target === exclusive && exclusive.checked) {
          choices.filter((choice) => choice !== exclusive).forEach((choice) => { choice.checked = false; });
        } else if (event.target !== exclusive && event.target.checked) {
          exclusive.checked = false;
        }
      }, true);
      document.querySelector('[data-clear]')?.addEventListener('click', () => window.setTimeout(update, 0));
      update();
    });
  };
  initExclusiveChoices();
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
    const matched = selectors.flatMap((selector) => {
      if (typeof selector !== "string" || !selector.trim()) return [];
      try { return [...worksheet.querySelectorAll(selector)]; }
      catch (_) { return []; }
    });
    return [...new Set(matched.map(answerFor).filter(Boolean))].join("、");
  };
  const bindingIsConfigured = (binding) => {
    if (!Array.isArray(binding)) return typeof binding?.manual === "string" && Boolean(binding.manual.trim());
    return Array.isArray(binding)
      && binding.length > 0
      && binding.every((selector) => {
        if (typeof selector !== "string" || !selector.trim()) return false;
        try { return Boolean(worksheet.querySelector(selector)); }
        catch (_) { return false; }
      });
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
  const promptRoots = [...worksheet.querySelectorAll('[data-prompt-text]')];
  const placeholderCount = (root) => (templateFor(root).text.match(/【[^】]+】/g) || []).length;
  const bindingsForPrompt = (root) => {
    const offset = promptRoots.slice(0, promptRoots.indexOf(root)).reduce((total, prompt) => total + placeholderCount(prompt), 0);
    return (promptBindings[worksheet.dataset.worksheetId] || []).slice(offset, offset + placeholderCount(root));
  };
  const promptState = (root) => {
    const template = templateFor(root).text;
    const bindings = bindingsForPrompt(root);
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
    promptRoots.forEach((root) => {
      const template = templateFor(root);
      root.innerHTML = template.html;
      const state = promptState(root);
      const bindings = promptBindings[worksheet.dataset.worksheetId] || [];
      const localBindings = bindingsForPrompt(root);
      const hasWorksheetConfig = Object.prototype.hasOwnProperty.call(promptBindings, worksheet.dataset.worksheetId);
      root.parentElement.dataset.promptConfigured = String(
        hasWorksheetConfig
        && bindings.length === promptRoots.reduce((total, prompt) => total + placeholderCount(prompt), 0)
        && bindings.every(bindingIsConfigured)
      );
      const matches = [...root.textContent.matchAll(/【[^】]+】/g)];
      matches.reverse().forEach((match, reverseIndex) => {
        const value = bindingValue(localBindings[matches.length - reverseIndex - 1]);
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
    const scoredControls = [...worksheet.querySelectorAll("input[data-score]")];
    const dimensions = [...new Set(scoredControls.map((control) => control.dataset.scoreDimension).filter(Boolean))];
    const selectedDimensions = new Set(scoredControls.filter((control) => control.checked)
      .map((control) => control.dataset.scoreDimension).filter(Boolean));
    const complete = dimensions.length === 0 || dimensions.every((dimension) => selectedDimensions.has(dimension));
    const total = scoredControls.filter((control) => control.checked)
      .reduce((sum, control) => sum + Number(control.dataset.score), 0);
    scoreTotal.value = complete && total ? String(total) : "";
    const scoreStatus = worksheet.querySelector("[data-score-status]");
    if (scoreStatus && dimensions.length > 0) {
      scoreStatus.textContent = complete
        ? `五個面向已完成，總分為 ${total} 分。`
        : `目前已完成 ${selectedDimensions.size}／${dimensions.length} 個面向；完成五題後會顯示總分。`;
    }
  };
  const initScoreSums = () => {
    scoreSumGroups.forEach(({ total: totalSelector, sources }) => {
      const total = worksheet.querySelector(totalSelector);
      if (!total) return;
      total.readOnly = true;
      total.setAttribute("aria-readonly", "true");
      total.placeholder = "完成三格後自動加總";
      total.dataset.scoreSum = sources.join(",");
    });
  };
  const updateScoreSums = () => {
    worksheet.querySelectorAll("[data-score-sum]").forEach((total) => {
      const sources = (total.dataset.scoreSum || "").split(",").filter(Boolean);
      const values = sources.map((selector) => {
        const control = worksheet.querySelector(selector);
        const value = answerFor(control);
        return /^\d$/.test(value) && Number(value) >= 1 && Number(value) <= 5 ? Number(value) : null;
      });
      total.value = values.length > 0 && values.every((value) => value !== null)
        ? String(values.reduce((sum, value) => sum + value, 0))
        : "";
    });
  };
  initScoreSums();
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
    control.addEventListener("change", () => { updateScore(); updateScoreSums(); save(); updatePrompt(); updateAutoSummaries(); });
    control.addEventListener("input", () => { updateScoreSums(); save(); updatePrompt(); updateAutoSummaries(); });
  });
  document.querySelector("[data-print]").addEventListener("click", () => window.print());
  document.querySelectorAll("[data-prompt-copy]").forEach((button) => {
    button.addEventListener("click", () => { copyPrompt(button); });
  });
  document.getElementById("clear-draft").addEventListener("click", () => {
    if (!window.confirm("確定要清除這個分頁中的所有作答嗎？清除後無法復原。")) return;
    clearDraft();
    updateScoreSums();
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
  updateScoreSums();
  updatePrompt();
  updateAutoSummaries();
})();
