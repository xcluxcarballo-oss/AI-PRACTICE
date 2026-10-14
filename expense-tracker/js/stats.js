// Pure calculations over transactions: totals, breakdowns, budgets and filters.
// Nothing here touches the DOM or storage, so it's all unit-tested.

import { addMonths, daysBetween } from './dates.js';

/** Newest first: by date, then by when it was entered. */
export function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

/** Transactions with start <= date < end. */
export function inRange(transactions, start, end) {
  return transactions.filter((t) => t.date >= start && t.date < end);
}

export function totals(transactions) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

/** Spending (or income) per category, largest first, with each one's share of the total. */
export function byCategory(transactions, type = 'expense') {
  const sums = new Map();
  let total = 0;
  for (const t of transactions) {
    if (t.type !== type) continue;
    const entry = sums.get(t.categoryId) || { categoryId: t.categoryId, total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    sums.set(t.categoryId, entry);
    total += t.amount;
  }
  return [...sums.values()]
    .map((e) => ({ ...e, share: total ? e.total / total : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Groups into days, newest first, each with its own income, expense and net. */
export function groupByDay(transactions) {
  const days = new Map();
  for (const t of sortTransactions(transactions)) {
    let day = days.get(t.date);
    if (!day) {
      day = { date: t.date, items: [], income: 0, expense: 0 };
      days.set(t.date, day);
    }
    day.items.push(t);
    if (t.type === 'income') day.income += t.amount;
    else day.expense += t.amount;
  }
  return [...days.values()].map((d) => ({ ...d, net: d.income - d.expense }));
}

export const WARN_RATIO = 0.8;

/**
 * Budget progress. `daysLeft` counts today, so on the last day of the period
 * it's 1 and the whole remainder is available "per day".
 */
export function budgetStatus({ limit, spent, daysLeft = 0 }) {
  const remaining = limit - spent;
  const ratio = limit > 0 ? spent / limit : spent > 0 ? Infinity : 0;
  const level = ratio >= 1 && spent > 0 ? 'over' : ratio >= WARN_RATIO ? 'warn' : 'ok';
  const perDay = remaining > 0 && daysLeft > 0 ? Math.floor(remaining / daysLeft) : 0;
  return { limit, spent, remaining, ratio, level, perDay };
}

/** Days left in a period including today, or 0 if the period isn't current. */
export function daysLeftInPeriod(range, today) {
  if (today < range.start || today >= range.end) return 0;
  return daysBetween(today, range.end);
}

/** Income and spending for `count` periods ending with the one starting at `lastStart`, oldest first. */
export function periodSeries(transactions, lastStart, count) {
  const series = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = addMonths(lastStart, -i);
    const end = addMonths(start, 1);
    series.push({ start, end, ...totals(inRange(transactions, start, end)) });
  }
  return series;
}

/** Lowercases and strips accents, so "cafe" finds "Café". */
export function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Activity filters. `filter` = { type: 'all'|'expense'|'income', query,
 * categoryIds: [], from, to } where from/to are inclusive ISO dates.
 * The query matches the note or category name, or an exact amount ("12.40").
 */
export function filterTransactions(transactions, filter, categoriesById) {
  const { type = 'all', query = '', categoryIds = [], from = '', to = '' } = filter;
  const q = normalizeText(query);
  const amountQuery = /^\d+([.,]\d{1,2})?$/.test(q)
    ? Math.round(Number(q.replace(',', '.')) * 100)
    : null;
  const cats = new Set(categoryIds);

  return transactions.filter((t) => {
    if (type !== 'all' && t.type !== type) return false;
    if (cats.size && !cats.has(t.categoryId)) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (!q) return true;
    if (amountQuery !== null && t.amount === amountQuery) return true;
    const name = categoriesById.get(t.categoryId)?.name;
    return normalizeText(t.note).includes(q) || normalizeText(name).includes(q);
  });
}
