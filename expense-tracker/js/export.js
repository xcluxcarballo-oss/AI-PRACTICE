// CSV export, and JSON backup creation and validation. Pure functions.

import { isISODate, clampStartDay } from './dates.js';
import { CURRENCIES, DEFAULT_SETTINGS, SCHEMA_VERSION, THEMES } from './defaults.js';

export const BACKUP_APP = 'saveit';
export const BACKUP_FORMAT = 1;

/** Quotes a CSV cell when needed. Text that a spreadsheet would run as a formula gets a leading quote. */
function csvText(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One row per transaction, oldest first. Expenses are negative so a SUM of the
 * Amount column gives the net balance. Starts with a BOM so Excel reads emoji
 * and accents correctly.
 */
export function toCSV(transactions, categoriesById, currency = 'EUR') {
  const header = ['Date', 'Type', 'Category', 'Amount', 'Currency', 'Note'];
  const rows = [...transactions]
    .sort((a, b) => (a.date === b.date ? (a.createdAt || 0) - (b.createdAt || 0) : a.date < b.date ? -1 : 1))
    .map((t) => {
      const fixed = `${Math.floor(t.amount / 100)}.${String(t.amount % 100).padStart(2, '0')}`;
      return [
        t.date,
        t.type === 'income' ? 'Income' : 'Expense',
        csvText(categoriesById.get(t.categoryId)?.name ?? ''),
        t.type === 'income' ? fixed : `-${fixed}`,
        currency,
        csvText(t.note),
      ].join(',');
    });
  return `﻿${[header.join(','), ...rows].join('\r\n')}\r\n`;
}

export function makeBackup({ transactions, categories, budgets, settings }, now = Date.now()) {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: new Date(now).toISOString(),
    data: { transactions, categories, budgets, settings },
  };
}

export class BackupError extends Error {}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64;
const isCents = (v) => Number.isSafeInteger(v) && v > 0 && v <= 1e13;
const isType = (v) => v === 'expense' || v === 'income';
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function fail(message) {
  throw new BackupError(message);
}

function checkUnique(items, what) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) fail(`The backup has two ${what} with the same id.`);
    ids.add(item.id);
  }
}

/**
 * Parses and checks a backup file. Returns clean data containing only known
 * fields, or throws a BackupError with a message that can be shown to the user.
 */
export function parseBackup(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    fail("This file isn't a Saveit backup. It couldn't be read as JSON.");
  }
  if (!isObj(json) || json.app !== BACKUP_APP || !isObj(json.data)) {
    fail("This file isn't a Saveit backup.");
  }
  if (typeof json.format !== 'number' || json.format > BACKUP_FORMAT) {
    fail('This backup was made by a newer version of Saveit. Update the app and try again.');
  }

  const { data } = json;
  if (!Array.isArray(data.categories) || !Array.isArray(data.transactions)) {
    fail('The backup is missing its categories or transactions.');
  }

  const categories = data.categories.map((c, i) => {
    if (!isObj(c) || !isId(c.id) || !isType(c.type) || typeof c.name !== 'string' || !c.name.trim()) {
      fail(`Category ${i + 1} in the backup is damaged.`);
    }
    return {
      id: c.id,
      type: c.type,
      name: c.name.trim().slice(0, 40),
      emoji: typeof c.emoji === 'string' && c.emoji ? c.emoji.slice(0, 16) : '📦',
      color: isColor(c.color) ? c.color : '#64748b',
      order: Number.isFinite(c.order) ? c.order : i,
      archived: Boolean(c.archived),
    };
  });
  checkUnique(categories, 'categories');
  const categoryIds = new Set(categories.map((c) => c.id));

  const transactions = data.transactions.map((t, i) => {
    if (
      !isObj(t) ||
      !isId(t.id) ||
      !isCents(t.amount) ||
      !isType(t.type) ||
      !isISODate(t.date) ||
      !categoryIds.has(t.categoryId)
    ) {
      fail(`Transaction ${i + 1} in the backup is damaged.`);
    }
    const createdAt = Number.isFinite(t.createdAt) ? t.createdAt : 0;
    return {
      id: t.id,
      type: t.type,
      amount: t.amount,
      categoryId: t.categoryId,
      date: t.date,
      note: typeof t.note === 'string' ? t.note.slice(0, 200) : '',
      createdAt,
      updatedAt: Number.isFinite(t.updatedAt) ? t.updatedAt : createdAt,
    };
  });
  checkUnique(transactions, 'transactions');

  const budgets = (Array.isArray(data.budgets) ? data.budgets : []).map((b, i) => {
    const categoryOk = b?.categoryId === null || categoryIds.has(b?.categoryId);
    if (!isObj(b) || !isId(b.id) || !isCents(b.amount) || !categoryOk) {
      fail(`Budget ${i + 1} in the backup is damaged.`);
    }
    return { id: b.id, categoryId: b.categoryId, amount: b.amount };
  });
  checkUnique(budgets, 'budgets');

  const s = isObj(data.settings) ? data.settings : {};
  const currencies = new Set(CURRENCIES.map(([code]) => code));
  const themes = new Set(THEMES.map(([value]) => value));
  const settings = {
    ...DEFAULT_SETTINGS,
    currency: currencies.has(s.currency) ? s.currency : DEFAULT_SETTINGS.currency,
    monthStartDay: clampStartDay(s.monthStartDay),
    theme: themes.has(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
    lastExpenseCategoryId: categoryIds.has(s.lastExpenseCategoryId) ? s.lastExpenseCategoryId : null,
    lastIncomeCategoryId: categoryIds.has(s.lastIncomeCategoryId) ? s.lastIncomeCategoryId : null,
    lastBackupAt: Number.isFinite(s.lastBackupAt) ? s.lastBackupAt : null,
    backupReminderDismissedAt: null,
    schemaVersion: SCHEMA_VERSION,
  };

  return { transactions, categories, budgets, settings };
}
