// Starter data and option lists.

export const APP_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;

// Each category has a fixed id so backups and future updates can refer to it.
export const DEFAULT_CATEGORIES = [
  { id: 'food', type: 'expense', name: 'Food', emoji: '🍔', color: '#f97316' },
  { id: 'groceries', type: 'expense', name: 'Groceries', emoji: '🛒', color: '#22c55e' },
  { id: 'transport', type: 'expense', name: 'Transport', emoji: '🚗', color: '#3b82f6' },
  { id: 'housing', type: 'expense', name: 'Housing', emoji: '🏠', color: '#8b5cf6' },
  { id: 'bills', type: 'expense', name: 'Bills', emoji: '💡', color: '#eab308' },
  { id: 'fun', type: 'expense', name: 'Fun', emoji: '🎉', color: '#ec4899' },
  { id: 'shopping', type: 'expense', name: 'Shopping', emoji: '🛍️', color: '#06b6d4' },
  { id: 'health', type: 'expense', name: 'Health', emoji: '💊', color: '#ef4444' },
  { id: 'travel', type: 'expense', name: 'Travel', emoji: '✈️', color: '#0ea5e9' },
  { id: 'education', type: 'expense', name: 'Education', emoji: '🎓', color: '#6366f1' },
  { id: 'other', type: 'expense', name: 'Other', emoji: '📦', color: '#64748b' },
  { id: 'salary', type: 'income', name: 'Salary', emoji: '💼', color: '#10b981' },
  { id: 'freelance', type: 'income', name: 'Freelance', emoji: '💻', color: '#14b8a6' },
  { id: 'gifts', type: 'income', name: 'Gifts', emoji: '🎁', color: '#f43f5e' },
  { id: 'investments', type: 'income', name: 'Investments', emoji: '📈', color: '#84cc16' },
  { id: 'refunds', type: 'income', name: 'Refunds', emoji: '↩️', color: '#a855f7' },
  { id: 'other-income', type: 'income', name: 'Other income', emoji: '💰', color: '#78716c' },
].map((c, i) => ({ ...c, order: i, archived: false }));

export const CATEGORY_COLORS = [
  '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#ef4444', '#78716c', '#64748b', '#0f766e',
];

export const DEFAULT_SETTINGS = {
  currency: 'EUR',
  monthStartDay: 1,
  theme: 'system',
  lastExpenseCategoryId: 'food',
  lastIncomeCategoryId: 'salary',
  lastBackupAt: null,
  backupReminderDismissedAt: null,
  schemaVersion: SCHEMA_VERSION,
};

// Currencies with two decimal places, which is what the cents model assumes.
export const CURRENCIES = [
  ['EUR', 'Euro'],
  ['USD', 'US dollar'],
  ['GBP', 'British pound'],
  ['CHF', 'Swiss franc'],
  ['CNY', 'Chinese yuan'],
  ['HKD', 'Hong Kong dollar'],
  ['SGD', 'Singapore dollar'],
  ['AUD', 'Australian dollar'],
  ['CAD', 'Canadian dollar'],
  ['MXN', 'Mexican peso'],
  ['BRL', 'Brazilian real'],
  ['ARS', 'Argentine peso'],
  ['INR', 'Indian rupee'],
  ['SEK', 'Swedish krona'],
  ['NOK', 'Norwegian krone'],
  ['DKK', 'Danish krone'],
  ['PLN', 'Polish złoty'],
];

export const THEMES = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];
