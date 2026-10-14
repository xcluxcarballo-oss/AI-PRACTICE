// Bottom sheets. They slide up, close by dragging the handle down, tapping
// the backdrop, pressing Escape, or with the phone's Back button/gesture
// (each open sheet adds a history entry). Everything behind a sheet is
// made inert, which keeps keyboard focus and screen readers inside it.

import { esc, html } from './dom.js';

const stack = [];
let listening = false;
const CLOSE_MS = 320;

function onPopState() {
  const top = stack[stack.length - 1];
  if (top && top.pushed && history.state?.saveitSheet !== top.id) {
    top.pushed = false;
    finish(top);
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape' && stack.length) {
    e.preventDefault();
    stack[stack.length - 1].api.close();
  }
}

function finish(entry) {
  if (entry.closed) return;
  entry.closed = true;
  stack.splice(stack.indexOf(entry), 1);
  entry.sheet.style.transform = '';
  entry.sheet.classList.remove('is-open', 'is-dragging');
  entry.backdrop.classList.remove('is-open');
  entry.underlying.inert = false;
  setTimeout(() => {
    entry.sheet.remove();
    entry.backdrop.remove();
  }, CLOSE_MS);
  if (entry.opener?.isConnected) entry.opener.focus({ preventScroll: true });
  entry.onClose?.();
}

function button(spec, fallbackClick) {
  if (!spec) return null;
  const b = html(`<button type="button" class="btn-text${spec.strong ? ' strong' : ''}">${esc(spec.label)}</button>`);
  if (spec.disabled) b.disabled = true;
  b.addEventListener('click', () => (spec.onClick || fallbackClick)());
  return b;
}

function enableDrag(entry) {
  const { sheet } = entry;
  let startY = 0;
  let startT = 0;
  let dy = 0;
  let dragging = false;

  const onDown = (e) => {
    if (e.button !== 0 || e.target.closest('button, input, select, textarea, a')) return;
    dragging = true;
    startY = e.clientY;
    startT = performance.now();
    dy = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    sheet.classList.add('is-dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    const velocity = dy / Math.max(1, performance.now() - startT);
    sheet.classList.remove('is-dragging');
    if (dy > Math.min(140, sheet.offsetHeight * 0.3) || (velocity > 0.6 && dy > 24)) {
      entry.api.close();
    } else {
      sheet.style.transform = '';
    }
  };

  for (const handle of sheet.querySelectorAll('.sheet-grab, .sheet-header')) {
    handle.addEventListener('pointerdown', onDown);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }
}

/**
 * Opens a sheet.
 * - title: header text
 * - body: element to show
 * - left/right: { label, onClick, strong, disabled } header buttons. Left defaults to Cancel.
 * - grouped: tinted background for iOS-style grouped lists
 * - initialFocus: element to focus after opening (defaults to the sheet)
 * Returns { el, body, leftButton, rightButton, close }.
 */
export function openSheet({ title, body, left, right, grouped = false, initialFocus, onClose }) {
  if (!listening) {
    window.addEventListener('popstate', onPopState);
    document.addEventListener('keydown', onKeyDown);
    listening = true;
  }

  const id = `sheet-${Date.now().toString(36)}-${stack.length}`;
  const backdrop = html('<div class="sheet-backdrop"></div>');
  const sheet = html(`
    <div class="sheet${grouped ? ' sheet--grouped' : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" tabindex="-1">
      <div class="sheet-grab" aria-hidden="true"><div class="sheet-handle"></div></div>
      <header class="sheet-header">
        <span class="sheet-left"></span>
        <h2 class="sheet-title" id="${id}-title">${esc(title)}</h2>
        <span class="sheet-right"></span>
      </header>
      <div class="sheet-body"></div>
    </div>`);

  const entry = {
    id,
    sheet,
    backdrop,
    onClose,
    opener: document.activeElement,
    underlying: stack.length ? stack[stack.length - 1].sheet : document.querySelector('.app'),
    pushed: false,
    closed: false,
  };

  const close = () => {
    if (entry.closed) return;
    if (entry.pushed && history.state?.saveitSheet === id) {
      history.back(); // onPopState finishes the close
    } else {
      entry.pushed = false;
      finish(entry);
    }
  };

  const leftButton = button(left === undefined ? { label: 'Cancel' } : left, close);
  const rightButton = button(right, close);
  if (leftButton) sheet.querySelector('.sheet-left').append(leftButton);
  if (rightButton) sheet.querySelector('.sheet-right').append(rightButton);
  const bodyEl = sheet.querySelector('.sheet-body');
  if (body) bodyEl.append(body);

  entry.api = { el: sheet, body: bodyEl, leftButton, rightButton, close };
  stack.push(entry);

  entry.underlying.inert = true;
  document.body.append(backdrop, sheet);
  backdrop.addEventListener('click', close);
  enableDrag(entry);

  history.pushState({ saveitSheet: id }, '');
  entry.pushed = true;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
      (initialFocus || sheet).focus({ preventScroll: true });
    });
  });

  return entry.api;
}

/** An iOS-style confirmation sheet. Resolves true if confirmed. */
export function confirmSheet({ title, message, confirmLabel, destructive = true }) {
  return new Promise((resolve) => {
    let confirmed = false;
    const body = html(`
      <div>
        <p class="confirm-title">${esc(title)}</p>
        <p class="confirm-text tight">${esc(message)}</p>
        <div style="margin-top: var(--s5); display: grid; gap: var(--s2)">
          <button type="button" class="btn ${destructive ? 'btn--danger' : ''}" data-confirm>${esc(confirmLabel)}</button>
          <button type="button" class="btn btn--secondary" data-cancel>Cancel</button>
        </div>
      </div>`);
    const sheet = openSheet({
      title: '',
      body,
      left: null,
      onClose: () => resolve(confirmed),
    });
    sheet.el.setAttribute('aria-label', title);
    sheet.el.removeAttribute('aria-labelledby');
    sheet.el.querySelector('.sheet-header').hidden = true;
    body.querySelector('[data-confirm]').addEventListener('click', () => {
      confirmed = true;
      sheet.close();
    });
    body.querySelector('[data-cancel]').addEventListener('click', () => sheet.close());
  });
}
