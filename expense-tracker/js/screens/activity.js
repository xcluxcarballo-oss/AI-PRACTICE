// Activity: every transaction grouped by day, with search, filters and swipe-to-delete.

import {
  getState, setActivityFilter, categoriesById, categoriesOf, deleteTransaction, restoreTransaction,
} from '../store.js';
import { dayHeading, todayISO, shortDate, periodRange, shiftPeriod, addDays } from '../dates.js';
import { filterTransactions, groupByDay, totals } from '../stats.js';
import { esc, html, bindSegmented, setSegmented, segmentedHTML } from '../ui/dom.js';
import { icons } from '../ui/icons.js';
import { enableSwipe } from '../ui/swipe.js';
import { toast } from '../ui/toast.js';
import { openSheet } from '../ui/sheet.js';
import { openTransactionEditor } from './edit.js';
import { money, categoryOf, txRowHTML, emptyHTML, DATE_LOCALE } from './common.js';

const PAGE = 100;
let limit = PAGE;
let observer = null;

const hasFilters = (f) => f.categoryIds.length > 0 || f.from || f.to;

function filterChipsHTML(f) {
  const chips = f.categoryIds.map((id) => {
    const cat = categoryOf(id);
    return `<button type="button" class="chip chip--accent" data-action="remove-category" data-id="${esc(id)}" aria-label="Remove filter ${esc(cat.name)}">${esc(cat.emoji)} ${esc(cat.name)} ${icons.close}</button>`;
  });
  if (f.from || f.to) {
    const today = todayISO();
    const from = f.from ? shortDate(f.from, today, DATE_LOCALE) : '…';
    const to = f.to ? shortDate(f.to, today, DATE_LOCALE) : '…';
    chips.push(`<button type="button" class="chip chip--accent" data-action="remove-dates" aria-label="Remove date filter">${icons.calendar} ${esc(from)} – ${esc(to)} ${icons.close}</button>`);
  }
  return chips.length ? `<div class="chip-scroll" style="margin-top:var(--s3)">${chips.join('')}</div>` : '';
}

function renderResults(section) {
  const { transactions, ui } = getState();
  const f = ui.activity;
  const results = section.querySelector('[data-results]');
  observer?.disconnect();

  if (!transactions.length) {
    results.innerHTML = emptyHTML({
      emoji: '🧾',
      title: 'No transactions yet',
      text: 'Everything you add shows up here, grouped by day.',
      actionLabel: 'Add expense',
      action: 'add',
    });
    return;
  }

  const filtered = filterTransactions(transactions, f, categoriesById());
  let markup = filterChipsHTML(f);

  if (!filtered.length) {
    markup += emptyHTML({
      emoji: '🔍',
      title: 'No matches',
      text: 'Try a different search or remove some filters.',
      actionLabel: 'Clear filters',
      action: 'clear-all',
    });
    results.innerHTML = markup;
    return;
  }

  const t = totals(filtered);
  const count = `${filtered.length} ${filtered.length === 1 ? 'transaction' : 'transactions'}`;
  const sum =
    f.type === 'income' ? money(t.income) : f.type === 'expense' ? money(t.expense) : `Net ${money(t.net, { sign: true })}`;
  markup += `<p class="summary-line"><span>${esc(count)}</span><span class="num">${esc(sum)}</span></p>`;

  const today = todayISO();
  let shown = 0;
  for (const day of groupByDay(filtered)) {
    if (shown >= limit) break;
    shown += day.items.length;
    const dayTotal = f.type === 'income' ? money(day.income) : f.type === 'expense' ? money(-day.expense) : money(day.net, { sign: true });
    markup += `
      <section class="day" aria-label="${esc(dayHeading(day.date, today, DATE_LOCALE))}">
        <h2 class="day-header"><span>${esc(dayHeading(day.date, today, DATE_LOCALE))}</span><span class="num">${esc(dayTotal)}</span></h2>
        <div class="list list--icons">${day.items.map((tx) => txRowHTML(tx)).join('')}</div>
      </section>`;
  }
  if (shown < filtered.length) markup += '<div class="load-more" aria-hidden="true"></div>';
  results.innerHTML = markup;

  // Loads the next page when the end of the list scrolls into view.
  const sentinel = results.querySelector('.load-more');
  if (sentinel) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          limit += PAGE;
          renderResults(section);
        }
      },
      { root: section, rootMargin: '600px' },
    );
    observer.observe(sentinel);
  }
}

export function render(section) {
  const f = getState().ui.activity;
  const input = section.querySelector('input[type="search"]');
  if (document.activeElement !== input) input.value = f.query;
  section.querySelector('[data-action="clear-search"]').hidden = !f.query;
  setSegmented(section.querySelector('.segmented'), f.type);
  const filterBtn = section.querySelector('[data-action="filters"]');
  filterBtn.classList.toggle('chip--accent', hasFilters(f));
  filterBtn.setAttribute('aria-label', hasFilters(f) ? 'Filters (on)' : 'Filters');
  renderResults(section);
}

function openFilters() {
  const f = getState().ui.activity;
  let selected = new Set(f.categoryIds);
  const range = periodRange(getState().ui.periodStart);

  const groupHTML = (type, title) => {
    const cats = categoriesOf(type, { includeArchived: true });
    return `
      <div>
        <p class="field-label">${title}</p>
        <div class="chip-wrap">
          ${cats
            .map(
              (c) => `<button type="button" class="chip" data-id="${esc(c.id)}" aria-pressed="${selected.has(c.id)}" style="--c:${esc(c.color)}"><span aria-hidden="true">${esc(c.emoji)}</span>${esc(c.name)}</button>`,
            )
            .join('')}
        </div>
      </div>`;
  };

  const body = html(`
    <div class="stack">
      ${groupHTML('expense', 'Expense categories')}
      ${groupHTML('income', 'Income categories')}
      <div>
        <p class="field-label">Dates</p>
        <div class="list">
          <label class="list-row"><span class="row-main">From</span><input type="date" class="text-input" data-from style="width:auto;min-height:40px"></label>
          <label class="list-row"><span class="row-main">To</span><input type="date" class="text-input" data-to style="width:auto;min-height:40px"></label>
        </div>
        <div class="chip-wrap" style="margin-top:var(--s3)">
          <button type="button" class="chip" data-range="period">This month</button>
          <button type="button" class="chip" data-range="last">Last month</button>
          <button type="button" class="chip" data-range="year">This year</button>
        </div>
      </div>
    </div>`);

  const fromInput = body.querySelector('[data-from]');
  const toInput = body.querySelector('[data-to]');
  fromInput.value = f.from;
  toInput.value = f.to;

  body.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (chip.dataset.id) {
      const on = !selected.has(chip.dataset.id);
      if (on) selected.add(chip.dataset.id);
      else selected.delete(chip.dataset.id);
      chip.setAttribute('aria-pressed', String(on));
    } else if (chip.dataset.range) {
      const year = todayISO().slice(0, 4);
      if (chip.dataset.range === 'period') {
        fromInput.value = range.start;
        toInput.value = addDays(range.end, -1);
      } else if (chip.dataset.range === 'last') {
        const prev = periodRange(shiftPeriod(range.start, -1));
        fromInput.value = prev.start;
        toInput.value = addDays(prev.end, -1);
      } else {
        fromInput.value = `${year}-01-01`;
        toInput.value = `${year}-12-31`;
      }
    }
  });

  const sheet = openSheet({
    title: 'Filters',
    body,
    grouped: true,
    left: {
      label: 'Reset',
      onClick: () => {
        selected = new Set();
        body.querySelectorAll('[aria-pressed]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
        fromInput.value = '';
        toInput.value = '';
      },
    },
    right: {
      label: 'Done',
      strong: true,
      onClick: () => {
        let from = fromInput.value;
        let to = toInput.value;
        if (from && to && from > to) [from, to] = [to, from];
        setActivityFilter({ categoryIds: [...selected], from, to });
        limit = PAGE;
        sheet.close();
      },
    },
  });
}

export function mount(section) {
  const content = section.querySelector('.screen-content');
  content.append(
    html(`
      <div>
        <div class="toolbar">
          <label class="search">
            ${icons.search}
            <input type="search" placeholder="Search notes, categories, amounts" aria-label="Search transactions" enterkeyhint="search" autocomplete="off">
            <button type="button" class="icon-btn" data-action="clear-search" aria-label="Clear search" hidden>${icons.closeCircle}</button>
          </label>
          <button type="button" class="icon-btn" data-action="filters" aria-label="Filters">${icons.filter}</button>
        </div>
        <div style="margin-top:var(--s3)">
          ${segmentedHTML('Show', [['all', 'All'], ['expense', 'Expenses'], ['income', 'Income']], 'all')}
        </div>
        <div data-results></div>
      </div>`),
  );

  const input = content.querySelector('input[type="search"]');
  input.addEventListener('input', () => {
    limit = PAGE;
    setActivityFilter({ query: input.value });
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });

  bindSegmented(content.querySelector('.segmented'), (type) => {
    limit = PAGE;
    setActivityFilter({ type });
  });

  enableSwipe(content, {
    onDelete: (id) => {
      const removed = deleteTransaction(id);
      if (removed) toast('Transaction deleted', { actionLabel: 'Undo', onAction: () => restoreTransaction(removed) });
    },
  });

  content.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const f = getState().ui.activity;
    switch (el.dataset.action) {
      case 'edit':
        openTransactionEditor(getState().transactions.find((t) => t.id === el.dataset.id));
        break;
      case 'add':
        openTransactionEditor();
        break;
      case 'filters':
        openFilters();
        break;
      case 'clear-search':
        input.value = '';
        setActivityFilter({ query: '' });
        input.focus();
        break;
      case 'remove-category':
        setActivityFilter({ categoryIds: f.categoryIds.filter((id) => id !== el.dataset.id) });
        break;
      case 'remove-dates':
        setActivityFilter({ from: '', to: '' });
        break;
      case 'clear-all':
        input.value = '';
        setActivityFilter({ type: 'all', query: '', categoryIds: [], from: '', to: '' });
        break;
      default:
    }
  });
}
