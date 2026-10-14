// Add / edit transaction sheet. The fastest path: tap +, type the amount, tap Save.

import {
  getState, categoriesOf, saveTransaction, deleteTransaction, restoreTransaction, categoriesById,
} from '../store.js';
import { todayISO, shortDate, isISODate } from '../dates.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { createAmountInput } from '../ui/amount.js';
import { esc, html, haptic, prefersFinePointer, bindSegmented, segmentedHTML } from '../ui/dom.js';
import { icons } from '../ui/icons.js';
import { MONEY_LOCALE, DATE_LOCALE } from './common.js';

function defaultCategory(type) {
  const { settings } = getState();
  const last = type === 'income' ? settings.lastIncomeCategoryId : settings.lastExpenseCategoryId;
  const cat = categoriesById().get(last);
  if (cat && cat.type === type && !cat.archived) return cat.id;
  return categoriesOf(type)[0]?.id ?? null;
}

const titleFor = (existing, type) =>
  existing ? 'Edit transaction' : type === 'income' ? 'New income' : 'New expense';

export function openTransactionEditor(existing = null, { type: presetType } = {}) {
  const { settings } = getState();
  let type = existing?.type ?? presetType ?? 'expense';
  let categoryId = existing?.categoryId ?? defaultCategory(type);
  let date = existing?.date ?? todayISO();
  let sheet = null;

  const amount = createAmountInput({
    cents: existing?.amount ?? 0,
    currency: settings.currency,
    locale: MONEY_LOCALE,
    type,
    onChange: (cents) => {
      if (sheet) sheet.rightButton.disabled = !cents;
    },
  });

  const body = html(`
    <div class="stack">
      ${segmentedHTML('Transaction type', [['expense', 'Expense'], ['income', 'Income']], type)}
      <div data-slot="display"></div>
      <div class="chip-scroll" role="radiogroup" aria-label="Category" data-chips></div>
      <div class="meta-row">
        <label class="chip date-chip">
          ${icons.calendar}<span data-date-label></span>
          <input type="date" aria-label="Date" required>
        </label>
        <input class="note-input" type="text" placeholder="Add note" maxlength="200" enterkeyhint="done" aria-label="Note" autocomplete="off">
      </div>
      <div data-slot="keypad"></div>
      ${existing ? `<button type="button" class="btn btn--danger-text" data-delete>${icons.trash}Delete transaction</button>` : ''}
    </div>`);

  body.querySelector('[data-slot="display"]').replaceWith(amount.display);
  body.querySelector('[data-slot="keypad"]').replaceWith(amount.keypad);
  const chips = body.querySelector('[data-chips]');
  const dateInput = body.querySelector('input[type="date"]');
  const dateLabel = body.querySelector('[data-date-label]');
  const noteInput = body.querySelector('.note-input');
  noteInput.value = existing?.note ?? '';

  function renderChips() {
    const list = categoriesOf(type);
    const current = categoriesById().get(existing?.categoryId);
    // Keep an archived category visible when editing a transaction that uses it.
    if (current?.archived && current.type === type) list.push(current);
    if (!list.some((c) => c.id === categoryId)) categoryId = list[0]?.id ?? null;
    chips.innerHTML = list
      .map(
        (c) => `<button type="button" class="chip" role="radio" data-id="${esc(c.id)}" aria-checked="${c.id === categoryId}" style="--c:${esc(c.color)}"><span aria-hidden="true">${esc(c.emoji)}</span>${esc(c.name)}</button>`,
      )
      .join('');
  }

  function scrollChipIntoView() {
    const selected = chips.querySelector('[aria-checked="true"]');
    if (selected) chips.scrollLeft = selected.offsetLeft - chips.clientWidth / 2 + selected.offsetWidth / 2;
  }

  function renderDate() {
    dateInput.value = date;
    dateLabel.textContent = shortDate(date, todayISO(), DATE_LOCALE);
  }

  function save() {
    const cents = amount.cents;
    if (!cents) {
      amount.shake();
      return;
    }
    if (!categoryId) {
      toast('Add a category in Settings first.');
      return;
    }
    const record = saveTransaction({ id: existing?.id, type, amount: cents, categoryId, date, note: noteInput.value });
    haptic(15);
    sheet.close();
    if (existing) {
      toast('Changes saved');
    } else {
      toast(type === 'income' ? 'Income added' : 'Expense added', {
        actionLabel: 'Undo',
        onAction: () => deleteTransaction(record.id),
      });
    }
  }

  bindSegmented(body.querySelector('.segmented'), (value) => {
    type = value;
    amount.setType(type);
    categoryId = existing && existing.type === type ? existing.categoryId : defaultCategory(type);
    renderChips();
    chips.scrollLeft = 0;
    scrollChipIntoView();
    sheet.el.querySelector('.sheet-title').textContent = titleFor(existing, type);
  });

  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    categoryId = chip.dataset.id;
    chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
    haptic(6);
  });

  dateInput.addEventListener('change', () => {
    if (isISODate(dateInput.value)) date = dateInput.value;
    renderDate();
  });
  // On desktop, clicking a date field doesn't open its calendar unless asked.
  dateInput.addEventListener('click', () => {
    if (prefersFinePointer()) {
      try {
        dateInput.showPicker();
      } catch {
        /* older browser: the field still works by typing */
      }
    }
  });

  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      noteInput.blur();
    }
  });

  body.querySelector('[data-delete]')?.addEventListener('click', () => {
    const removed = deleteTransaction(existing.id);
    haptic(15);
    sheet.close();
    toast('Transaction deleted', { actionLabel: 'Undo', onAction: () => restoreTransaction(removed) });
  });

  renderChips();
  renderDate();

  sheet = openSheet({
    title: titleFor(existing, type),
    body,
    right: { label: 'Save', strong: true, onClick: save, disabled: !amount.cents },
  });

  // Typing on a physical keyboard goes to the amount; Enter saves.
  sheet.el.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'Enter' && !e.target.closest('button')) {
      e.preventDefault();
      save();
    } else if (amount.handleKey(e)) {
      e.preventDefault();
    }
  });

  requestAnimationFrame(scrollChipIntoView);
}
