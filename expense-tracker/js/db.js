// IndexedDB wrapper. Four stores: transactions, categories, budgets, and
// meta (settings). If IndexedDB isn't available (some private modes), it
// falls back to memory and `isPersistent()` returns false so the UI can warn.

const DB_NAME = 'saveit';
const DB_VERSION = 1;
const STORES = ['transactions', 'categories', 'budgets', 'meta'];

let dbPromise = null;
let memory = null;

const promisify = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        // Version 1 schema. Later versions add migration steps here, keyed on event.oldVersion.
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'id' }).createIndex('date', 'date');
        }
        if (!db.objectStoreNames.contains('categories')) db.createObjectStore('categories', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('budgets')) db.createObjectStore('budgets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Database blocked by another tab'));
    });
  }
  return dbPromise;
}

function useMemory() {
  if (!memory) memory = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  return memory;
}

export function isPersistent() {
  return memory === null;
}

/** Loads everything at startup. Personal data sets are small enough to keep in memory. */
export async function loadAll() {
  let db;
  try {
    db = await open();
  } catch (err) {
    console.warn('Saveit: falling back to in-memory storage', err);
    useMemory();
    return { transactions: [], categories: [], budgets: [], settings: null };
  }
  const tx = db.transaction(STORES, 'readonly');
  const [transactions, categories, budgets, settingsRow] = await Promise.all([
    promisify(tx.objectStore('transactions').getAll()),
    promisify(tx.objectStore('categories').getAll()),
    promisify(tx.objectStore('budgets').getAll()),
    promisify(tx.objectStore('meta').get('settings')),
  ]);
  return { transactions, categories, budgets, settings: settingsRow?.value ?? null };
}

/** Applies a list of writes atomically: [{ store, put: value } | { store, delete: id } | { store, clear: true }]. */
export async function write(ops) {
  if (memory) {
    for (const op of ops) {
      const map = memory[op.store];
      if (op.clear) map.clear();
      else if (op.delete !== undefined) map.delete(op.delete);
      else map.set(op.put.id ?? op.put.key, op.put);
    }
    return;
  }
  const db = await open();
  const stores = [...new Set(ops.map((op) => op.store))];
  const tx = db.transaction(stores, 'readwrite');
  for (const op of ops) {
    const store = tx.objectStore(op.store);
    if (op.clear) store.clear();
    else if (op.delete !== undefined) store.delete(op.delete);
    else store.put(op.put);
  }
  await done(tx);
}

export const put = (store, value) => write([{ store, put: value }]);
export const remove = (store, id) => write([{ store, delete: id }]);
export const saveSettings = (settings) => put('meta', { key: 'settings', value: settings });

/** Replaces all data in one transaction (used by restore and "delete all"). */
export function replaceAll({ transactions, categories, budgets, settings }) {
  return write([
    ...STORES.map((store) => ({ store, clear: true })),
    ...transactions.map((t) => ({ store: 'transactions', put: t })),
    ...categories.map((c) => ({ store: 'categories', put: c })),
    ...budgets.map((b) => ({ store: 'budgets', put: b })),
    { store: 'meta', put: { key: 'settings', value: settings } },
  ]);
}
