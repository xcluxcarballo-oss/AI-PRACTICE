// Amount entry: a big display plus a custom keypad, so the system keyboard
// never covers the form. Also accepts a physical keyboard.

import { keypadInput, inputToCents, centsToInput, formatInput, currencyParts, formatMoney } from '../money.js';
import { esc, html, haptic } from './dom.js';
import { icons } from './icons.js';

export function createAmountInput({ cents = 0, currency = 'EUR', locale, type = 'expense', onChange } = {}) {
  let value = centsToInput(cents);
  const { symbol, before } = currencyParts(currency, locale);
  const decimalMark = new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.';

  const display = html('<div class="amount-display" aria-live="polite"></div>');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];
  const keypad = html(`
    <div class="keypad" role="group" aria-label="Amount keypad">
      ${keys
        .map((k) => {
          if (k === 'back') return `<button type="button" class="key" data-key="back" aria-label="Delete digit">${icons.backspace}</button>`;
          if (k === '.') return `<button type="button" class="key" data-key="." aria-label="Decimal point">${esc(decimalMark)}</button>`;
          return `<button type="button" class="key" data-key="${k}">${k}</button>`;
        })
        .join('')}
    </div>`);

  function render() {
    const num = `<span class="value">${esc(formatInput(value, locale))}</span>`;
    const cur = `<span class="currency">${esc(symbol)}</span>`;
    display.innerHTML = before ? cur + num : num + cur;
    display.classList.toggle('is-empty', !value);
    display.setAttribute('aria-label', `Amount ${formatMoney(inputToCents(value), { currency, locale })}`);
  }

  function shake() {
    display.classList.remove('is-shake');
    void display.offsetWidth; // restart the animation
    display.classList.add('is-shake');
  }

  function press(key) {
    const next = keypadInput(value, key);
    if (next === value) {
      if (key !== 'back') shake();
      return;
    }
    value = next;
    haptic(6);
    render();
    onChange?.(inputToCents(value));
  }

  // Respond on touch-down like a native keypad; keyboard activation comes through click.
  keypad.addEventListener('pointerdown', (e) => {
    const key = e.target.closest('.key');
    if (!key || e.button !== 0) return;
    e.preventDefault();
    press(key.dataset.key);
  });
  keypad.addEventListener('click', (e) => {
    const key = e.target.closest('.key');
    if (key && e.detail === 0) press(key.dataset.key);
  });

  /** Handles a physical keyboard event. Returns true if it was used. */
  function handleKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    if (/^\d$/.test(e.key) || e.key === '.' || e.key === ',') press(e.key);
    else if (e.key === 'Backspace') press('back');
    else return false;
    return true;
  }

  function setType(t) {
    display.classList.toggle('is-income', t === 'income');
  }

  render();
  setType(type);

  return {
    display,
    keypad,
    handleKey,
    setType,
    shake,
    get cents() {
      return inputToCents(value);
    },
  };
}
