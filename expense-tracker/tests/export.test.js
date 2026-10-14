import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCSV, makeBackup, parseBackup, BackupError } from '../js/export.js';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '../js/defaults.js';

const categories = DEFAULT_CATEGORIES;
const byId = new Map(categories.map((c) => [c.id, c]));
const transactions = [
  { id: 'a', type: 'expense', amount: 1240, categoryId: 'food', date: '2026-10-02', note: 'Lunch, "menu del día"', createdAt: 2, updatedAt: 2 },
  { id: 'b', type: 'income', amount: 200000, categoryId: 'salary', date: '2026-10-01', note: '', createdAt: 1, updatedAt: 1 },
  { id: 'c', type: 'expense', amount: 5, categoryId: 'other', date: '2026-10-02', note: '=HYPERLINK("x")', createdAt: 3, updatedAt: 3 },
];

test('CSV: oldest first, signed amounts, escaping, formula protection', () => {
  const csv = toCSV(transactions, byId, 'EUR');
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).trim().split('\r\n');
  assert.equal(lines[0], 'Date,Type,Category,Amount,Currency,Note');
  assert.equal(lines[1], '2026-10-01,Income,Salary,2000.00,EUR,');
  assert.equal(lines[2], '2026-10-02,Expense,Food,-12.40,EUR,"Lunch, ""menu del día"""');
  assert.equal(lines[3], `2026-10-02,Expense,Other,-0.05,EUR,"'=HYPERLINK(""x"")"`);
});

const state = {
  transactions,
  categories,
  budgets: [{ id: 'overall', categoryId: null, amount: 170000 }, { id: 'cat:food', categoryId: 'food', amount: 30000 }],
  settings: { ...DEFAULT_SETTINGS, monthStartDay: 25, lastBackupAt: 123 },
};

test('backup round trip', () => {
  const text = JSON.stringify(makeBackup(state, Date.UTC(2026, 9, 14)));
  const back = parseBackup(text);
  assert.deepEqual(back.transactions, transactions);
  assert.deepEqual(back.categories, categories);
  assert.deepEqual(back.budgets, state.budgets);
  assert.equal(back.settings.monthStartDay, 25);
  assert.equal(back.settings.currency, 'EUR');
});

test('rejects files that are not backups', () => {
  assert.throws(() => parseBackup('not json'), BackupError);
  assert.throws(() => parseBackup('{"hello":1}'), /isn't a Saveit backup/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'saveit', format: 99, data: {} })), /newer version/);
});

test('rejects damaged records', () => {
  const bad = (patch) => {
    const b = makeBackup(state);
    b.data.transactions = [{ ...transactions[0], ...patch }];
    return () => parseBackup(JSON.stringify(b));
  };
  assert.throws(bad({ amount: 12.5 }), /Transaction 1/);
  assert.throws(bad({ amount: -100 }), /Transaction 1/);
  assert.throws(bad({ date: '2026-13-01' }), /Transaction 1/);
  assert.throws(bad({ categoryId: 'nope' }), /Transaction 1/);
  assert.throws(bad({ type: 'transfer' }), /Transaction 1/);

  const dup = makeBackup(state);
  dup.data.transactions = [transactions[0], transactions[0]];
  assert.throws(() => parseBackup(JSON.stringify(dup)), /same id/);
});

test('drops unknown fields and fixes bad settings', () => {
  const b = makeBackup(state);
  b.data.transactions = [{ ...transactions[0], evil: '<script>' }];
  b.data.settings = { currency: 'XXX', theme: 'neon', monthStartDay: 40 };
  const back = parseBackup(JSON.stringify(b));
  assert.equal('evil' in back.transactions[0], false);
  assert.equal(back.settings.currency, 'EUR');
  assert.equal(back.settings.theme, 'system');
  assert.equal(back.settings.monthStartDay, 28);
});
