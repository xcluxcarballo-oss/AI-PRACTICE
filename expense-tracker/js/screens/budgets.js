// Budgets: an overall monthly limit, optional per-category limits, and a 6-month trend.

import {
  getState, budgetFor, setBudget, removeBudget, setPeriod, categoriesOf,
} from '../store.js';
import { periodRange, shiftPeriod, todayISO, periodShortLabel } from '../dates.js';
import { inRange, byCategory, totals, budgetStatus, daysLeftInPeriod, periodSeries } from '../stats.js';
import { bars } from '../ui/charts.js';
import { esc, html, haptic } from '../ui/dom.js';
import { icons } from '../ui/icons.js';
import { openSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { createAmountInput } from '../ui/amount.js';
import { money, moneyCompact, categoryOf, catIconHTML, periodNavHTML, MONEY_LOCALE, DATE_LOCALE } from './common.js';

const statusText = (s) =>
  s.remaining >= 0 ? `${money(s.remaining)} left` : `${money(-s.remaining)} over`;

function overallHTML(spent, range, today) {
  const overall = budgetFor(null);
  if (!overall) {
    return `
      <div class="card">
        <p style="font-weight:600">Set a monthly budget</p>
        <p class="muted" style="margin:var(--s1) 0 var(--s4)">Pick a spending limit for the month and Saveit tracks how much is left, and how much you can spend per day.</p>
        <button type="button" class="btn" data-action="edit-budget" data-id="">Set budget</button>
      </div>`;
  }
  const daysLeft = daysLeftInPeriod(range, today);
  const s = budgetStatus({ limit: overall.amount, spent, daysLeft });
  let guidance;
  if (range.start > today) guidance = 'This period hasn’t started yet.';
  else if (daysLeft === 0) guidance = s.remaining >= 0 ? 'Finished under budget. Nice work!' : 'This period went over budget.';
  else if (s.remaining <= 0) guidance = `Over budget with ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to go.`;
  else guidance = `About ${money(s.perDay)} a day for the next ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.`;

  return `
    <button type="button" class="card" data-action="edit-budget" data-id="" style="display:block;width:100%;text-align:left" aria-label="Monthly budget ${esc(money(overall.amount))}. ${esc(statusText(s))}. Edit">
      <div class="budget-big">
        <span class="amount status-${s.level}">${esc(statusText(s))}</span>
        <span class="muted">${icons.edit}</span>
      </div>
      <div class="progress is-${s.level}"><span style="width:${Math.min(100, s.ratio * 100)}%"></span></div>
      <div class="budget-meta">
        <span class="num">${esc(money(spent))} of ${esc(money(overall.amount))}</span>
        <span>${Math.round(s.ratio * 100)}%</span>
      </div>
      <p class="muted" style="margin-top:var(--s3);font-size:var(--text-sm)">${esc(guidance)}</p>
    </button>`;
}

function categoriesHTML(txs) {
  const spentBy = new Map(byCategory(txs).map((r) => [r.categoryId, r.total]));
  const budgets = getState()
    .budgets.filter((b) => b.categoryId)
    .map((b) => ({ ...b, cat: categoryOf(b.categoryId), spent: spentBy.get(b.categoryId) || 0 }))
    .sort((a, b) => a.cat.order - b.cat.order);

  if (!budgets.length) {
    return `<div class="card"><p class="muted">Add a limit for categories you want to watch, like Food or Fun.</p></div>`;
  }
  return `
    <div class="list">
      ${budgets
        .map((b) => {
          const s = budgetStatus({ limit: b.amount, spent: b.spent });
          return `
          <button type="button" class="list-row budget-row" data-action="edit-budget" data-id="${esc(b.categoryId)}" aria-label="${esc(`${b.cat.name}: ${money(b.spent)} of ${money(b.amount)}, ${statusText(s)}. Edit`)}">
            <span class="budget-row-top">
              ${catIconHTML(b.cat, 'cat-icon--sm')}
              <span class="row-main"><span class="row-title">${esc(b.cat.name)}</span></span>
              <span class="row-value num">${esc(money(b.spent))} / ${esc(money(b.amount))}</span>
            </span>
            <span class="progress is-${s.level}"><span style="width:${Math.min(100, s.ratio * 100)}%"></span></span>
            <span class="row-sub status-${s.level}">${esc(statusText(s))}</span>
          </button>`;
        })
        .join('')}
    </div>`;
}

function trendHTML(transactions, start) {
  const series = periodSeries(transactions, start, 6);
  const overall = budgetFor(null);
  const label = `Spending over the last 6 months: ${series.map((p) => `${periodShortLabel(p.start, DATE_LOCALE)} ${money(p.expense)}`).join(', ')}`;
  return `
    <div class="card">
      ${bars(
        series.map((p, i) => ({
          label: periodShortLabel(p.start, DATE_LOCALE),
          value: p.expense,
          valueLabel: moneyCompact(p.expense),
          current: i === series.length - 1,
        })),
        { budget: overall?.amount || 0, label },
      )}
      <div class="chart-legend"><span><b></b>Spent</span>${overall ? '<span><i></i>Monthly budget</span>' : ''}</div>
    </div>`;
}

export function render(section) {
  const state = getState();
  const content = section.querySelector('.screen-content');
  const today = todayISO();
  const range = periodRange(state.ui.periodStart);
  const txs = inRange(state.transactions, range.start, range.end);
  const spent = totals(txs).expense;
  const canAdd = categoriesOf('expense').some((c) => !budgetFor(c.id));

  content.innerHTML = `
    ${periodNavHTML(range.start)}
    ${overallHTML(spent, range, today)}
    <h2 class="section-title">By category ${canAdd ? '<button type="button" class="link" data-action="add-budget">Add</button>' : ''}</h2>
    ${categoriesHTML(txs)}
    <h2 class="section-title">Last 6 months</h2>
    ${trendHTML(state.transactions, range.start)}`;
  content.querySelector('[data-action="next-period"]').disabled = range.end > today;
}

/** categoryId: null for the overall budget, an id for a category, or undefined to pick one. */
function openBudgetEditor(categoryId) {
  const { settings } = getState();
  const picking = categoryId === undefined;
  let chosen = picking ? null : categoryId;
  const existing = picking ? null : budgetFor(categoryId);
  let sheet = null;

  const amount = createAmountInput({
    cents: existing?.amount ?? 0,
    currency: settings.currency,
    locale: MONEY_LOCALE,
    onChange: () => updateSave(),
  });

  const free = categoriesOf('expense').filter((c) => !budgetFor(c.id));
  const title = picking ? 'Category budget' : categoryId ? categoryOf(categoryId).name : 'Monthly budget';

  const body = html(`
    <div class="stack">
      ${
        picking
          ? `<div class="chip-scroll" role="radiogroup" aria-label="Category">${free
              .map((c) => `<button type="button" class="chip" role="radio" aria-checked="false" data-id="${esc(c.id)}" style="--c:${esc(c.color)}"><span aria-hidden="true">${esc(c.emoji)}</span>${esc(c.name)}</button>`)
              .join('')}</div>`
          : ''
      }
      <p class="muted" style="text-align:center;font-size:var(--text-sm)">${picking ? 'Pick a category, then set its monthly limit.' : 'Monthly limit'}</p>
      <div data-slot="display"></div>
      <div data-slot="keypad"></div>
      ${existing ? `<button type="button" class="btn btn--danger-text" data-remove>${icons.trash}Remove budget</button>` : ''}
    </div>`);
  body.querySelector('[data-slot="display"]').replaceWith(amount.display);
  body.querySelector('[data-slot="keypad"]').replaceWith(amount.keypad);

  function updateSave() {
    if (sheet) sheet.rightButton.disabled = !amount.cents || chosen === undefined || (picking && !chosen);
  }

  function save() {
    if (!amount.cents || (picking && !chosen)) {
      amount.shake();
      return;
    }
    setBudget(chosen, amount.cents);
    haptic(15);
    sheet.close();
    toast('Budget saved');
  }

  body.querySelector('.chip-scroll')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    chosen = chip.dataset.id;
    body.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
    updateSave();
  });

  body.querySelector('[data-remove]')?.addEventListener('click', () => {
    removeBudget(categoryId);
    sheet.close();
    toast('Budget removed', { actionLabel: 'Undo', onAction: () => setBudget(categoryId, existing.amount) });
  });

  sheet = openSheet({ title, body, right: { label: 'Save', strong: true, onClick: save } });
  updateSave();
  sheet.el.addEventListener('keydown', (e) => {
    if (e.target.matches('input')) return;
    if (e.key === 'Enter' && !e.target.closest('button')) save();
    else if (amount.handleKey(e)) e.preventDefault();
  });
}

export function mount(section) {
  const content = section.querySelector('.screen-content');
  content.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { ui } = getState();
    switch (el.dataset.action) {
      case 'prev-period':
        setPeriod(shiftPeriod(ui.periodStart, -1));
        break;
      case 'next-period':
        setPeriod(shiftPeriod(ui.periodStart, 1));
        break;
      case 'edit-budget':
        openBudgetEditor(el.dataset.id || null);
        break;
      case 'add-budget':
        openBudgetEditor(undefined);
        break;
      default:
    }
  });
}
