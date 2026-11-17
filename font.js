/* The display preset scales text, drawings and spacing together. */
(() => {
  'use strict';
  const options = {small: 1.1, medium: 1.3, large: 1.5};
  const storageKey = 'motion-display-size';
  let size = 'medium';
  try {
    const saved = localStorage.getItem(storageKey);
    if (Object.hasOwn(options, saved)) size = saved;
  } catch (_) {}
  window.motionFontScale = () => options[size];
  window.motionUIScale = () => options[size] / 1.5;
  function apply(next, save) {
    size = Object.hasOwn(options, next) ? next : 'medium';
    document.documentElement.dataset.fontSize = size;
    const choice = document.querySelector(`input[name="font-size"][value="${size}"]`);
    if (choice) choice.checked = true;
    if (save) {
      try { localStorage.setItem(storageKey, size); } catch (_) {}
      window.dispatchEvent(new Event('resize'));
    }
  }
  apply(size, false);
  document.addEventListener('change', event => {
    if (event.target.matches('input[name="font-size"]')) apply(event.target.value, true);
  });
})();
