/* Font selection is kept on this device, with a safe default if storage is unavailable. */
(() => {
  'use strict';
  const options = {small: 1.5, medium: 1.7, large: 1.9};
  let size = 'small';
  try {
    const saved = localStorage.getItem('motion-font-size');
    if (Object.hasOwn(options, saved)) size = saved;
  } catch (_) {}
  window.motionFontScale = () => options[size];
  function apply(next, save) {
    size = Object.hasOwn(options, next) ? next : 'small';
    document.documentElement.dataset.fontSize = size;
    const choice = document.querySelector(`input[name="font-size"][value="${size}"]`);
    if (choice) choice.checked = true;
    if (save) {
      try { localStorage.setItem('motion-font-size', size); } catch (_) {}
      window.dispatchEvent(new Event('resize'));
    }
  }
  apply(size, false);
  document.addEventListener('change', event => {
    if (event.target.matches('input[name="font-size"]')) apply(event.target.value, true);
  });
})();
