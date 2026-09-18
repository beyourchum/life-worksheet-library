(() => {
  const choices = [...document.querySelectorAll('[data-facts] input[type="checkbox"]')];
  const update = () => {
    const count = choices.filter(input => input.checked).length;
    choices.forEach(input => { input.disabled = count >= 2 && !input.checked; });
  };
  choices.forEach(input => input.addEventListener('change', update));
  document.querySelector('[data-clear]').addEventListener('click', update);
  update();
})();
