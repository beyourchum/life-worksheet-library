(() => {
  const worksheet = document.querySelector(".worksheet");
  const storageKey = `worksheet:${worksheet.dataset.worksheetId}:draft-v1`;
  const controls = [...worksheet.querySelectorAll("input, textarea")];
  const scoreTotal = worksheet.querySelector("[data-score-total]");
  const saveStatus = document.querySelector("[data-save-status]");
  const copyPrompt = async (button) => {
    const prompt = button.closest(".prompt-quote")?.querySelector("[data-prompt-text]")?.innerText.trim();
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
    control.addEventListener("change", () => { updateScore(); save(); });
    control.addEventListener("input", save);
  });
  document.querySelector("[data-print]").addEventListener("click", () => window.print());
  document.querySelectorAll("[data-prompt-copy]").forEach((button) => {
    button.addEventListener("click", () => { copyPrompt(button); });
  });
  document.getElementById("clear-draft").addEventListener("click", () => {
    if (!window.confirm("確定要重設這個分頁中的所有作答嗎？")) return;
    clearDraft();
    saveStatus.textContent = "本次暫存已重設";
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
  updateScore();
})();
