// Small DOM helpers.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes user text (notes, category names) before it goes into an HTML string. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Builds a DOM fragment (or a single element) from an HTML string. */
export function html(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
}

/** A short vibration on Android. iOS Safari doesn't support it, so it's a no-op there. */
export function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

export const prefersFinePointer = () => window.matchMedia?.('(pointer: fine)').matches;

/** Saves a file: share sheet on phones (Save to Files / Drive), download elsewhere. Returns false if cancelled. */
export async function saveFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const file = typeof File === 'function' ? new File([blob], filename, { type }) : null;
  if (file && !prefersFinePointer() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
      // Fall through to a normal download if sharing failed for another reason.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

/** Wires a segmented control (buttons with role="radio") to a callback. */
export function bindSegmented(root, onChange) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[role="radio"]');
    if (!btn || btn.getAttribute('aria-checked') === 'true') return;
    setSegmented(root, btn.dataset.value);
    onChange(btn.dataset.value);
  });
  // Arrow keys move between options, as in a native radio group.
  root.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const options = [...root.querySelectorAll('[role="radio"]')];
    const i = options.findIndex((o) => o.getAttribute('aria-checked') === 'true');
    const next = options[(i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length];
    next.focus();
    next.click();
  });
}

export function setSegmented(root, value) {
  root.querySelectorAll('[role="radio"]').forEach((o) => {
    const on = o.dataset.value === value;
    o.setAttribute('aria-checked', String(on));
    o.tabIndex = on ? 0 : -1;
  });
}

export function segmentedHTML(label, options, value) {
  return `<div class="segmented" role="radiogroup" aria-label="${esc(label)}">${options
    .map(
      ([v, text]) =>
        `<button type="button" role="radio" data-value="${esc(v)}" aria-checked="${v === value}" tabindex="${v === value ? 0 : -1}">${esc(text)}</button>`,
    )
    .join('')}</div>`;
}
