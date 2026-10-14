import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sortTransactions, inRange, totals, byCategory, groupByDay, budgetStatus,
  daysLeftInPeriod, periodSeries, filterTransactions,
} from '../js/stats.js';

let n = 0;
const tx = (date, amount, categoryId = 'food', type = 'expense', note = '') => ({
  id: `t${++n}`, date, amount, categoryId, type, note, createdAt: n,
});

const data = [
  tx('2026-10-01', 1240, 'food', 'expense', 'Lunch'),
  tx('2026-10-01', 890, 'transport', 'expense', 'Uber'),
  tx('2026-10-05', 5420, 'groceries', 'expense', 'Mercadona'),
  tx('2026-10-05', 200000, 'salary', 'income'),
  tx('2026-09-30', 3000, 'food', 'expense', 'Café con amigos'),
  tx('2026-11-01', 1000, 'food'),
];
const cats = new Map([
  ['food', { name: 'Food' }],
  ['transport', { name: 'Transport' }],
  ['groceries', { name: 'Groceries' }],
  ['salary', { name: 'Salary' }],
]);

test('sorts newest first, then by entry time', () => {
  const ids = sortTransactions(data).map((t) => t.id);
  assert.deepEqual(ids, ['t6', 't4', 't3', 't2', 't1', 't5']);
});

test('range is start-inclusive, end-exclusive', () => {
  const oct = inRange(data, '2026-10-01', '2026-11-01');
  assert.equal(oct.length, 4);
});

test('totals', () => {
  const oct = inRange(data, '2026-10-01', '2026-11-01');
  assert.deepEqual(totals(oct), { income: 200000, expense: 7550, net: 192450 });
  assert.deepEqual(totals([]), { income: 0, expense: 0, net: 0 });
});

test('breakdown by category ignores income', () => {
  const oct = inRange(data, '2026-10-01', '2026-11-01');
  const rows = byCategory(oct);
  assert.deepEqual(rows.map((r) => r.categoryId), ['groceries', 'food', 'transport']);
  assert.equal(rows[0].total, 5420);
  assert.ok(Math.abs(rows.reduce((s, r) => s + r.share, 0) - 1) < 1e-9);
  assert.deepEqual(byCategory(oct, 'income').map((r) => r.categoryId), ['salary']);
});

test('groups by day with daily net', () => {
  const days = groupByDay(inRange(data, '2026-10-01', '2026-11-01'));
  assert.deepEqual(days.map((d) => d.date), ['2026-10-05', '2026-10-01']);
  assert.equal(days[0].net, 200000 - 5420);
  assert.equal(days[1].expense, 2130);
});

test('budget status levels and per-day guidance', () => {
  assert.equal(budgetStatus({ limit: 10000, spent: 5000 }).level, 'ok');
  assert.equal(budgetStatus({ limit: 10000, spent: 8000 }).level, 'warn');
  assert.equal(budgetStatus({ limit: 10000, spent: 10000 }).level, 'over');
  const s = budgetStatus({ limit: 170000, spent: 128450, daysLeft: 18 });
  assert.equal(s.remaining, 41550);
  assert.equal(s.perDay, 2308);
  assert.equal(budgetStatus({ limit: 100, spent: 300, daysLeft: 5 }).perDay, 0);
});

test('days left counts today and is 0 outside the period', () => {
  const range = { start: '2026-10-01', end: '2026-11-01' };
  assert.equal(daysLeftInPeriod(range, '2026-10-14'), 18);
  assert.equal(daysLeftInPeriod(range, '2026-10-31'), 1);
  assert.equal(daysLeftInPeriod(range, '2026-11-01'), 0);
});

test('period series, oldest first', () => {
  const s = periodSeries(data, '2026-10-01', 3);
  assert.deepEqual(s.map((p) => p.start), ['2026-08-01', '2026-09-01', '2026-10-01']);
  assert.deepEqual(s.map((p) => p.expense), [0, 3000, 7550]);
});

test('filters by type, category, dates and text', () => {
  const f = (filter) => filterTransactions(data, { type: 'all', ...filter }, cats).map((t) => t.id);
  assert.deepEqual(f({ type: 'income' }), ['t4']);
  assert.deepEqual(f({ categoryIds: ['food'] }), ['t1', 't5', 't6']);
  assert.deepEqual(f({ from: '2026-10-01', to: '2026-10-01' }), ['t1', 't2']);
  assert.deepEqual(f({ query: 'cafe' }), ['t5']);
  assert.deepEqual(f({ query: 'TRANS' }), ['t2']);
  assert.deepEqual(f({ query: '12.40' }), ['t1']);
  assert.deepEqual(f({ query: '12,4' }), ['t1']);
});
