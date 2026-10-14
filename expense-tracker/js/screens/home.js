// Home: balance for the month, budget progress, spending by category, recent activity.

import {
  getState, budgetFor, setPeriod, setActivityFilter, updateSettings, deleteTransaction, restoreTransaction,
} from '../store.js';
import { periodRange, shiftPeriod, todayISO, addDays } from '../dates.js';
import { inRange, totals, byCategory, sortTransactions, budgetStatus, daysLeftInPeriod } from '../stats.js';
import { donut } from '../ui/charts.js';
import { esc } from '../ui/dom.js';
import { icons } from '../ui/icons.js';
import { enableSwipe } from '../ui/swipe.js';
import { toast } from '../ui/toast.js';
import { openTransactionEditor } from './edit.js';
import { money, categoryOf, txRowHTML, periodNavHTML, emptyHTML } from './common.js';

const BACKUP_EVERY_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SLICES = 5;

export function needsBackupReminder(state, now = Date.now()) {
  const { lastBackupAt, backupReminderDismissedAt } = state.settings;
  if (state.transactions.length < 10) return false;
  const last = Math.max(lastBackupAt || 0, backupReminderDismissedAt || 0);
  return now - last > BACKUP_EVERY_MS;
}

function heroHTML(t, range, today) {
  const overall = budgetFor(null);
  let budget = `<a class="hero-cta" href="#/budgets">Set a monthly budget ${icons.chevronRight}</a>`;
  if (overall) {
    const daysLeft = daysLeftInPeriod(range, today);
    const s = budgetStatus({ limit: overall.amount, spent: t.expense, daysLeft });
    const pct = Math.min(100, s.ratio * 100);
    const left = s.remaining >= 0 ? `${money(s.remaining)} left` : `${money(-s.remaining)} over budget`;
    const right = daysLeft > 0 && s.perDay > 0 ? `${money(s.perDay)}/day · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}` : `of ${money(overall.amount)}`;
    budget = `
      <a class="hero-budget" href="#/budgets" aria-label="Budget: ${esc(left)}, ${esc(right)}">
        <div class="progress is-${s.level}"><span style="width:${pct}%"></span></div>
        <div class="hero-budget-text"><span>${esc(left)}</span><span>${esc(right)}</span></div>
      </a>`;
  }
  return `
    <section class="hero" aria-label="Summary">
      <p class="hero-label">Balance</p>
      <p class="hero-amount">${esc(money(t.net, { sign: true }))}</p>
      <div class="hero-stats">
        <div class="hero-stat"><span class="label">${icons.arrowDown}Income</span><span class="value">${esc(money(t.income))}</span></div>
        <div class="hero-stat"><span class="label">${icons.arrowUp}Spent</span><span class="value">${esc(money(t.expense))}</span></div>
      </div>
      ${budget}
    </section>`;
}

function breakdownHTML(txs, totalSpent) {
  const rows = byCategory(txs, 'expense');
  if (!rows.length) {
    return `<div class="card"><p class="muted">No spending in this period yet.</p></div>`;
  }
  // Top categories get their own slice; the rest share one "Others" slice.
  const top = rows.length > MAX_SLICES + 1 ? rows.slice(0, MAX_SLICES) : rows;
  const rest = rows.slice(top.length);
  const slices = top.map((r) => ({ ...r, cat: categoryOf(r.categoryId) }));
  if (rest.length) {
    const total = rest.reduce((s, r) => s + r.total, 0);
    slices.push({ categoryId: '', total, share: total / totalSpent, cat: { name: 'Others', color: '#94a3b8' } });
  }
  const label = `Spending by category: ${slices.map((s) => `${s.cat.name} ${Math.round(s.share * 100)}%`).join(', ')}`;
  return `
    <div class="card breakdown">
      ${donut(slices.map((s) => ({ value: s.total, color: s.cat.color })), {
        centerTop: money(totalSpent),
        centerBottom: 'spent',
        label,
      })}
      <ul class="legend">
        ${slices
          .map(
            (s) => `
          <li><button type="button" data-action="category" data-id="${esc(s.categoryId)}" aria-label="${esc(`${s.cat.name}: ${money(s.total)}, ${Math.round(s.share * 100)}%. Show transactions`)}">
            <span class="dot" style="--c:${esc(s.cat.color)}"></span>
            <span class="name">${esc(s.cat.name)}</span>
            <span class="pct">${Math.round(s.share * 100)}%</span>
          </button></li>`,
          )
          .join('')}
      </ul>
    </div>`;
}

export function render(section) {
  const state = getState();
  const content = section.querySelector('.screen-content');
  const today = todayISO();
  const range = periodRange(state.ui.periodStart);
  const txs = inRange(state.transactions, range.start, range.end);
  const t = totals(txs);

  let markup = periodNavHTML(range.start);

  if (needsBackupReminder(state)) {
    markup += `
      <div class="banner" role="note">
        <p><strong>Back up your data.</strong> It's only stored on this phone. <a class="link" href="#/settings" style="min-height:0">Go to Settings</a></p>
        <button type="button" class="icon-btn" data-action="dismiss-backup" aria-label="Remind me later">${icons.close}</button>
      </div>`;
  }

  markup += heroHTML(t, range, today);

  if (!state.transactions.length) {
    markup += emptyHTML({
      emoji: '🌱',
      title: 'Welcome to Saveit',
      text: 'Tap + to log your first expense. It takes about five seconds.',
      actionLabel: 'Add expense',
      action: 'add',
    });
  } else {
    markup += `<h2 class="section-title">Spending</h2>${breakdownHTML(txs, t.expense)}`;
    const recent = sortTransactions(txs).slice(0, 5);
    markup += `<h2 class="section-title">Recent <a class="link" href="#/activity" data-action="see-all">See all</a></h2>`;
    markup += recent.length
      ? `<div class="list list--icons">${recent.map((tx) => txRowHTML(tx, { showDate: true, today })).join('')}</div>`
      : `<div class="card"><p class="muted">Nothing logged in this period.</p></div>`;
  }

  content.innerHTML = markup;
  content.querySelector('[data-action="next-period"]').disabled = range.end > today;
}

export function mount(section) {
  const content = section.querySelector('.screen-content');

  enableSwipe(content, {
    onDelete: (id) => {
      const removed = deleteTransaction(id);
      if (removed) toast('Transaction deleted', { actionLabel: 'Undo', onAction: () => restoreTransaction(removed) });
    },
  });

  content.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const state = getState();
    const range = periodRange(state.ui.periodStart);
    switch (el.dataset.action) {
      case 'prev-period':
        setPeriod(shiftPeriod(state.ui.periodStart, -1));
        break;
      case 'next-period':
        setPeriod(shiftPeriod(state.ui.periodStart, 1));
        break;
      case 'edit':
        openTransactionEditor(state.transactions.find((t) => t.id === el.dataset.id));
        break;
      case 'add':
        openTransactionEditor();
        break;
      case 'dismiss-backup':
        updateSettings({ backupReminderDismissedAt: Date.now() });
        break;
      case 'category':
        setActivityFilter({
          type: 'expense',
          query: '',
          categoryIds: el.dataset.id ? [el.dataset.id] : [],
          from: range.start,
          to: addDays(range.end, -1),
        });
        location.hash = '#/activity';
        break;
      case 'see-all':
        e.preventDefault();
        setActivityFilter({ type: 'all', query: '', categoryIds: [], from: range.start, to: addDays(range.end, -1) });
        location.hash = '#/activity';
        break;
      default:
    }
  });
}
