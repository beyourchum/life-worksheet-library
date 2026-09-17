(() => {
  const worksheet = document.querySelector('[data-worksheet-id="EP95"]');
  if (!worksheet) return;
  const field = (id) => document.getElementById(id);
  const age = field('ep95-age');
  const percent = field('ep95-next-percent');
  const number = (input) => input.value.trim() !== '' && input.validity.valid && Number.isFinite(input.valueAsNumber)
    ? input.valueAsNumber : null;
  const update = () => {
    field('ep95-legacy').hidden = field('ep95-next').value === '';
    const years = number(age);
    const value = number(percent);
    const ratio = value !== null && value > 0 ? value : null;
    const maximum = years === null ? null : 220 - years;
    const choice = worksheet.querySelector('[data-heart-rate-low]:checked');
    field('ep95-age-error').hidden = !age.validity.badInput && (age.value === '' || years !== null);
    field('ep95-percent-error').hidden = !percent.validity.badInput && (percent.value === '' || ratio !== null);
    age.setAttribute('aria-invalid', String(!field('ep95-age-error').hidden));
    percent.setAttribute('aria-invalid', String(!field('ep95-percent-error').hidden));
    field('ep95-rate').value = maximum === null ? '' : String(maximum);
    field('ep95-range').value = maximum === null || !choice ? ''
      : `${Math.round(maximum * Number(choice.dataset.heartRateLow) / 100)}～${Math.round(maximum * Number(choice.dataset.heartRateHigh) / 100)}`;
    field('ep95-target-rate').value = maximum === null || ratio === null ? '' : String(Math.round(maximum * ratio / 100));
  };
  // Calculate before the shared draft listener saves the edited controls.
  worksheet.addEventListener('input', update, true);
  worksheet.addEventListener('change', update, true);
  document.querySelector('[data-clear]').addEventListener('click', update);
  update();
})();
