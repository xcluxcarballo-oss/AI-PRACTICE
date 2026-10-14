// Category list and editor (opened from Settings).

import { getState, categoriesOf, saveCategory, moveCategory, subscribe } from '../store.js';
import { CATEGORY_COLORS } from '../defaults.js';
import { esc, html, haptic } from '../ui/dom.js';
import { icons } from '../ui/icons.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { catIconHTML } from './common.js';

function graphemes(text) {
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((g) => g.segment);
  }
  return Array.from(text);
}

/** Last visible character, keeping multi-part emoji (👩‍💻, 🏳️‍🌈) whole. */
function lastGrapheme(text) {
  const parts = graphemes(text.trim());
  return parts[parts.length - 1] ?? '';
}

export function openCategoryList(type) {
  const body = html('<div class="stack"><div class="list list--icons" data-list></div><button type="button" class="btn btn--secondary" data-add>Add category</button><p class="caption">Archived categories are hidden when adding transactions, but stay in your history.</p></div>');
  const list = body.querySelector('[data-list]');

  function render() {
    const cats = categoriesOf(type, { includeArchived: true });
    list.innerHTML = cats
      .map(
        (c, i) => `
        <div class="list-row${c.archived ? ' archived' : ''}">
          <button type="button" data-edit="${esc(c.id)}" style="display:flex;align-items:center;gap:var(--s3);flex:1;min-width:0;min-height:var(--tap);text-align:left" aria-label="Edit ${esc(c.name)}">
            ${catIconHTML(c)}
            <span class="row-main"><span class="row-title">${esc(c.name)}</span>${c.archived ? '<span class="row-sub">Archived</span>' : ''}</span>
          </button>
          <span class="row-actions">
            <button type="button" class="icon-btn" data-move="-1" data-id="${esc(c.id)}" aria-label="Move ${esc(c.name)} up" ${i === 0 ? 'disabled' : ''}>${icons.arrowUp}</button>
            <button type="button" class="icon-btn" data-move="1" data-id="${esc(c.id)}" aria-label="Move ${esc(c.name)} down" ${i === cats.length - 1 ? 'disabled' : ''}>${icons.arrowDown}</button>
          </span>
        </div>`,
      )
      .join('');
  }

  body.addEventListener('click', (e) => {
    const move = e.target.closest('[data-move]');
    if (move) {
      moveCategory(move.dataset.id, Number(move.dataset.move));
      return;
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) openCategoryEditor(type, getState().categories.find((c) => c.id === edit.dataset.edit));
    if (e.target.closest('[data-add]')) openCategoryEditor(type);
  });

  render();
  const unsubscribe = subscribe(render);
  openSheet({
    title: type === 'income' ? 'Income categories' : 'Expense categories',
    body,
    grouped: true,
    left: null,
    right: { label: 'Done', strong: true },
    onClose: unsubscribe,
  });
}

export function openCategoryEditor(type, existing = null) {
  let color = existing?.color ?? CATEGORY_COLORS[getState().categories.length % CATEGORY_COLORS.length];
  let archived = existing?.archived ?? false;

  const body = html(`
    <div class="stack">
      <div style="display:flex;justify-content:center"><span data-preview></span></div>
      <div>
        <label class="field-label" for="cat-name">Name</label>
        <input id="cat-name" class="text-input" type="text" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="e.g. Coffee">
      </div>
      <div>
        <label class="field-label" for="cat-emoji">Emoji</label>
        <input id="cat-emoji" class="text-input emoji-input" type="text" autocomplete="off" aria-describedby="cat-emoji-hint">
        <p class="caption" id="cat-emoji-hint" style="margin-left:var(--s1)">Tap and choose one from your emoji keyboard.</p>
      </div>
      <div>
        <p class="field-label" id="cat-color-label">Color</p>
        <div class="swatches" role="radiogroup" aria-labelledby="cat-color-label">
          ${CATEGORY_COLORS.map((c) => `<button type="button" class="swatch" role="radio" aria-checked="${c === color}" aria-label="Color ${c}" data-color="${c}" style="--c:${c}"></button>`).join('')}
        </div>
      </div>
      ${existing ? `<button type="button" class="btn btn--secondary" data-archive>${archived ? 'Unarchive' : 'Archive'} category</button>` : ''}
    </div>`);

  const nameInput = body.querySelector('#cat-name');
  const emojiInput = body.querySelector('#cat-emoji');
  const preview = body.querySelector('[data-preview]');
  nameInput.value = existing?.name ?? '';
  emojiInput.value = existing?.emoji ?? '📦';

  const renderPreview = () => {
    preview.innerHTML = catIconHTML({ color, emoji: emojiInput.value || '📦' }, 'cat-icon--lg');
  };

  // Typing a new emoji replaces the old one.
  emojiInput.addEventListener('focus', () => emojiInput.select());
  emojiInput.addEventListener('input', () => {
    emojiInput.value = lastGrapheme(emojiInput.value);
    renderPreview();
  });

  body.querySelector('.swatches').addEventListener('click', (e) => {
    const sw = e.target.closest('.swatch');
    if (!sw) return;
    color = sw.dataset.color;
    body.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-checked', String(s === sw)));
    renderPreview();
  });

  let sheet = null;
  const save = () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      toast('Give the category a name.');
      return;
    }
    saveCategory({ id: existing?.id, type, name, emoji: emojiInput.value || '📦', color, archived });
    haptic(15);
    sheet.close();
  };

  body.querySelector('[data-archive]')?.addEventListener('click', () => {
    archived = !archived;
    saveCategory({ id: existing.id, type, name: nameInput.value.trim() || existing.name, emoji: emojiInput.value || existing.emoji, color, archived });
    sheet.close();
    toast(archived ? 'Category archived' : 'Category restored');
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    }
  });

  renderPreview();
  sheet = openSheet({
    title: existing ? 'Edit category' : 'New category',
    body,
    grouped: true,
    right: { label: 'Save', strong: true, onClick: save },
  });
}
