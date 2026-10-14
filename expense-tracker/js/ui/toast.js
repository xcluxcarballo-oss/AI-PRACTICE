// Snackbar at the bottom of the screen, with an optional action like Undo.

import { esc, html } from './dom.js';

let current = null;

function dismiss(entry) {
  if (!entry || entry.gone) return;
  entry.gone = true;
  clearTimeout(entry.timer);
  entry.el.classList.remove('is-visible');
  setTimeout(() => entry.el.remove(), 300);
  if (current === entry) current = null;
}

export function toast(message, { actionLabel, onAction, duration = 4000 } = {}) {
  const root = document.getElementById('toast-root');
  dismiss(current);

  const el = html(`
    <div class="toast">
      <span>${esc(message)}</span>
      ${actionLabel ? `<button type="button" class="toast-action">${esc(actionLabel)}</button>` : ''}
    </div>`);
  const entry = { el, gone: false, timer: 0 };
  current = entry;
  root.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-visible')));

  el.querySelector('.toast-action')?.addEventListener('click', () => {
    dismiss(entry);
    onAction?.();
  });
  // Pause while touched, so there's time to hit Undo.
  el.addEventListener('pointerenter', () => clearTimeout(entry.timer));
  el.addEventListener('pointerleave', () => {
    entry.timer = setTimeout(() => dismiss(entry), 1500);
  });
  entry.timer = setTimeout(() => dismiss(entry), duration);
}
