// App state. Screens read from getState() and re-render when notified.
// Every change updates memory first (so the UI responds instantly), then
// writes to IndexedDB. A failed write is reported through onError.

import * as db from './db.js';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, SCHEMA_VERSION } from './defaults.js';
import { periodStart, todayISO, clampStartDay } from './dates.js';

const state = {
  transactions: [],
  categories: [],
  budgets: [],
  settings: { ...DEFAULT_SETTINGS },
  ui: {
    periodStart: periodStart(todayISO(), 1), // budget period shown on Home and Budgets
    activity: { type: 'all', query: '', categoryIds: [], from: '', to: '' },
  },
};

const listeners = new Set();
let errorHandler = (err) => console.error(err);
let emitQueued = false;

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onError(fn) {
  errorHandler = fn;
}

// Several changes in one tick cause a single re-render.
function emit() {
  if (emitQueued) return;
  emitQueued = true;
  queueMicrotask(() => {
    emitQueued = false;
    listeners.forEach((fn) => fn(state));
  });
}

function persist(promise) {
  return promise.catch((err) => {
    errorHandler(err);
    throw err;
  });
}

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---------- Derived data (memoized on the source array) ----------

let catMapSource = null;
let catMap = new Map();

export function categoriesById() {
  if (catMapSource !== state.categories) {
    catMapSource = state.categories;
    catMap = new Map(state.categories.map((c) => [c.id, c]));
  }
  return catMap;
}

/** Categories of one type in display order. Archived ones are left out unless asked for. */
export function categoriesOf(type, { includeArchived = false } = {}) {
  return state.categories
    .filter((c) => c.type === type && (includeArchived || !c.archived))
    .sort((a, b) => a.order - b.order);
}

export function budgetFor(categoryId) {
  return state.budgets.find((b) => b.categoryId === categoryId) || null;
}

// ---------- Startup ----------

export async function init() {
  const data = await db.loadAll();
  state.transactions = data.transactions;
  state.categories = data.categories;
  state.budgets = data.budgets;
  state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}), schemaVersion: SCHEMA_VERSION };

  // First launch: seed the starter categories.
  if (!state.categories.length) {
    state.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    await persist(
      db.write([
        ...state.categories.map((c) => ({ store: 'categories', put: c })),
        { store: 'meta', put: { key: 'settings', value: state.settings } },
      ]),
    ).catch(() => {});
  }
  state.ui.periodStart = periodStart(todayISO(), state.settings.monthStartDay);
  emit();
}

// ---------- Transactions ----------

/** Creates or updates a transaction. Returns the saved record. */
export function saveTransaction({ id, type, amount, categoryId, date, note }) {
  const now = Date.now();
  const existing = id ? state.transactions.find((t) => t.id === id) : null;
  const record = {
    id: existing ? existing.id : uid(),
    type,
    amount,
    categoryId,
    date,
    note: (note || '').trim().slice(0, 200),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  state.transactions = existing
    ? state.transactions.map((t) => (t.id === record.id ? record : t))
    : [...state.transactions, record];

  const lastKey = type === 'income' ? 'lastIncomeCategoryId' : 'lastExpenseCategoryId';
  state.settings = { ...state.settings, [lastKey]: categoryId };
  emit();
  persist(
    db.write([
      { store: 'transactions', put: record },
      { store: 'meta', put: { key: 'settings', value: state.settings } },
    ]),
  ).catch(() => {});
  return record;
}

/** Deletes and returns the transaction, so it can be restored for Undo. */
export function deleteTransaction(id) {
  const removed = state.transactions.find((t) => t.id === id);
  if (!removed) return null;
  state.transactions = state.transactions.filter((t) => t.id !== id);
  emit();
  persist(db.remove('transactions', id)).catch(() => {});
  return removed;
}

export function restoreTransaction(record) {
  if (state.transactions.some((t) => t.id === record.id)) return;
  state.transactions = [...state.transactions, record];
  emit();
  persist(db.put('transactions', record)).catch(() => {});
}

// ---------- Categories ----------

export function saveCategory({ id, type, name, emoji, color, archived = false }) {
  const existing = id ? state.categories.find((c) => c.id === id) : null;
  const sameType = state.categories.filter((c) => c.type === type);
  const record = {
    id: existing ? existing.id : uid(),
    type: existing ? existing.type : type,
    name: name.trim().slice(0, 40),
    emoji: emoji || '📦',
    color,
    order: existing ? existing.order : Math.max(-1, ...sameType.map((c) => c.order)) + 1,
    archived,
  };
  state.categories = existing
    ? state.categories.map((c) => (c.id === record.id ? record : c))
    : [...state.categories, record];
  emit();
  persist(db.put('categories', record)).catch(() => {});
  return record;
}

/** Moves a category one place up (-1) or down (+1) within its type. */
export function moveCategory(id, direction) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;
  const list = categoriesOf(cat.type, { includeArchived: true });
  const index = list.findIndex((c) => c.id === id);
  const target = index + direction;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  const reordered = list.map((c, i) => ({ ...c, order: i }));
  const byId = new Map(reordered.map((c) => [c.id, c]));
  state.categories = state.categories.map((c) => byId.get(c.id) || c);
  emit();
  persist(db.write(reordered.map((c) => ({ store: 'categories', put: c })))).catch(() => {});
}

// ---------- Budgets ----------

/** Sets the overall budget (categoryId null) or a category budget. */
export function setBudget(categoryId, amount) {
  const id = categoryId ? `cat:${categoryId}` : 'overall';
  const record = { id, categoryId: categoryId || null, amount };
  state.budgets = [...state.budgets.filter((b) => b.id !== id), record];
  emit();
  persist(db.put('budgets', record)).catch(() => {});
}

export function removeBudget(categoryId) {
  const id = categoryId ? `cat:${categoryId}` : 'overall';
  state.budgets = state.budgets.filter((b) => b.id !== id);
  emit();
  persist(db.remove('budgets', id)).catch(() => {});
}

// ---------- Settings ----------

export function updateSettings(patch) {
  const next = { ...state.settings, ...patch };
  if ('monthStartDay' in patch) {
    next.monthStartDay = clampStartDay(patch.monthStartDay);
    state.ui.periodStart = periodStart(todayISO(), next.monthStartDay);
  }
  state.settings = next;
  emit();
  persist(db.saveSettings(next)).catch(() => {});
}

// ---------- UI state (not saved) ----------

export function setPeriod(start) {
  state.ui.periodStart = start;
  emit();
}

export function setActivityFilter(patch) {
  state.ui.activity = { ...state.ui.activity, ...patch };
  emit();
}

// ---------- Whole data set ----------

export async function replaceAllData(data) {
  await persist(db.replaceAll(data));
  state.transactions = data.transactions;
  state.categories = data.categories;
  state.budgets = data.budgets;
  state.settings = data.settings;
  state.ui.periodStart = periodStart(todayISO(), data.settings.monthStartDay);
  state.ui.activity = { type: 'all', query: '', categoryIds: [], from: '', to: '' };
  emit();
}

export function deleteAllData() {
  return replaceAllData({
    transactions: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    budgets: [],
    settings: { ...DEFAULT_SETTINGS, theme: state.settings.theme },
  });
}
