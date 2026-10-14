// Markup shared by several screens: transaction rows, period switcher, empty states.

import { getState, categoriesById } from '../store.js';
import { formatMoney, formatMoneyCompact } from '../money.js';
import { periodLabel, shortDate, todayISO } from '../dates.js';
import { esc } from '../ui/dom.js';
import { icons } from '../ui/icons.js';

// Numbers and currency follow the phone's region. The interface is in English,
// so dates use English words ("Today", "Mon 12 Oct") whatever the region.
function validLocale(tag) {
  try {
    return Intl.getCanonicalLocales(tag)[0];
  } catch {
    return undefined;
  }
}

// Some systems report tags like "en-US@posix" that Intl rejects; strip the extras.
const reported = typeof navigator !== 'undefined' ? navigator.language || '' : '';
export const MONEY_LOCALE = validLocale(reported) || validLocale(reported.split(/[@.]/)[0]) || 'en-IE';
export const DATE_LOCALE = /^en\b/i.test(MONEY_LOCALE) ? MONEY_LOCALE : 'en-GB';

export const money = (cents, opts = {}) =>
  formatMoney(cents, { currency: getState().settings.currency, locale: MONEY_LOCALE, ...opts });

export const moneyCompact = (cents) =>
  formatMoneyCompact(cents, { currency: getState().settings.currency, locale: MONEY_LOCALE });

const UNKNOWN = { name: 'Unknown', emoji: '❔', color: '#64748b' };
export const categoryOf = (id) => categoriesById().get(id) || UNKNOWN;

export function catIconHTML(cat, extraClass = '') {
  return `<span class="cat-icon ${extraClass}" style="--c:${esc(cat.color)}" aria-hidden="true">${esc(cat.emoji)}</span>`;
}

export function amountHTML(tx) {
  return tx.type === 'income'
    ? `<span class="amount amount--income">${esc(money(tx.amount, { sign: true }))}</span>`
    : `<span class="amount">${esc(money(-tx.amount))}</span>`;
}

/** A swipeable transaction row. `showDate` adds the day under the title (for lists not grouped by day). */
export function txRowHTML(tx, { showDate = false, today = todayISO() } = {}) {
  const cat = categoryOf(tx.categoryId);
  const title = tx.note || cat.name;
  const subParts = [];
  if (tx.note) subParts.push(cat.name);
  if (showDate) subParts.push(shortDate(tx.date, today, DATE_LOCALE));
  const sub = subParts.join(' · ');
  const label = `${title}, ${tx.type === 'income' ? 'income' : 'expense'} ${money(tx.amount)}${sub ? `, ${sub}` : ''}`;
  return `
    <div class="swipe" data-id="${esc(tx.id)}">
      <div class="swipe-actions" aria-hidden="true">
        <button type="button" class="swipe-delete" tabindex="-1">${icons.trash}Delete</button>
      </div>
      <button type="button" class="list-row" data-action="edit" data-id="${esc(tx.id)}" aria-label="${esc(label)}">
        ${catIconHTML(cat)}
        <span class="row-main">
          <span class="row-title">${esc(title)}</span>
          ${sub ? `<span class="row-sub">${esc(sub)}</span>` : ''}
        </span>
        ${amountHTML(tx)}
      </button>
    </div>`;
}

export function periodNavHTML(start) {
  return `
    <div class="period-nav">
      <button type="button" class="icon-btn" data-action="prev-period" aria-label="Previous month">${icons.chevronLeft}</button>
      <span class="period-label" aria-live="polite">${esc(periodLabel(start, DATE_LOCALE))}</span>
      <button type="button" class="icon-btn" data-action="next-period" aria-label="Next month">${icons.chevronRight}</button>
    </div>`;
}

export function emptyHTML({ emoji, title, text, actionLabel, action }) {
  return `
    <div class="empty">
      <div class="empty-emoji" aria-hidden="true">${emoji}</div>
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      ${actionLabel ? `<button type="button" class="btn" data-action="${esc(action)}">${esc(actionLabel)}</button>` : ''}
    </div>`;
}
