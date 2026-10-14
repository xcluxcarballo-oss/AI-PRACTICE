// Settings: preferences, categories, data export/backup/restore, install help.

import {
  getState, updateSettings, categoriesOf, replaceAllData, deleteAllData, categoriesById,
} from '../store.js';
import { isPersistent } from '../db.js';
import { CURRENCIES, THEMES, APP_VERSION } from '../defaults.js';
import { todayISO, shortDate, toISO } from '../dates.js';
import { toCSV, makeBackup, parseBackup } from '../export.js';
import { esc, html, saveFile } from '../ui/dom.js';
import { icons } from '../ui/icons.js';
import { openSheet, confirmSheet } from '../ui/sheet.js';
import { toast } from '../ui/toast.js';
import { canPromptInstall, promptInstall, isStandalone, platform, isStoragePersisted } from '../pwa.js';
import { openCategoryList } from './categories.js';
import { DATE_LOCALE } from './common.js';

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const rowIcon = (icon, color) => `<span class="row-icon-plain" style="--c:${color}" aria-hidden="true">${icon}</span>`;

function selectRow({ id, icon, color, label, options, value }) {
  return `
    <div class="list-row">
      ${rowIcon(icon, color)}
      <label class="row-main" for="${id}">${esc(label)}</label>
      <span class="select-wrap">
        <select id="${id}" data-setting="${id}">
          ${options.map(([v, text]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(text)}</option>`).join('')}
        </select>
        ${icons.chevronUpDown}
      </span>
    </div>`;
}

function navRow({ action, icon, color, label, sub = '', value = '', danger = false, chevron = true }) {
  return `
    <button type="button" class="list-row" data-action="${action}">
      ${rowIcon(icon, color)}
      <span class="row-main">
        <span class="row-title${danger ? ' row-danger' : ''}">${esc(label)}</span>
        ${sub ? `<span class="row-sub">${esc(sub)}</span>` : ''}
      </span>
      ${value ? `<span class="row-value">${esc(value)}</span>` : ''}
      ${chevron ? `<span class="row-chevron">${icons.chevronRight}</span>` : ''}
    </button>`;
}

function storageText() {
  if (!isPersistent()) return 'Temporary';
  const p = isStoragePersisted();
  return p === null ? '' : p ? 'Protected' : 'Standard';
}

export function render(section) {
  const { settings, transactions } = getState();
  const content = section.querySelector('.screen-content');
  const lastBackup = settings.lastBackupAt
    ? `Last backup: ${shortDate(toISO(new Date(settings.lastBackupAt)), todayISO(), DATE_LOCALE)}`
    : 'Never backed up';

  content.innerHTML = `
    ${!isPersistent() ? `<div class="banner" role="alert" style="margin-top:0;background:var(--danger-soft)"><p><strong>Saving is off.</strong> This browser isn't letting Saveit store data (private browsing?), so anything you add disappears when you close it.</p></div>` : ''}

    <h2 class="section-title">Preferences</h2>
    <div class="list list--settings">
      ${selectRow({ id: 'currency', icon: icons.coins, color: '#10b981', label: 'Currency', options: CURRENCIES.map(([code, name]) => [code, `${name} (${code})`]), value: settings.currency })}
      ${selectRow({ id: 'monthStartDay', icon: icons.calendar, color: '#3b82f6', label: 'Month starts on', options: Array.from({ length: 28 }, (_, i) => [i + 1, `the ${ordinal(i + 1)}`]), value: settings.monthStartDay })}
      ${selectRow({ id: 'theme', icon: icons.sun, color: '#6366f1', label: 'Appearance', options: THEMES, value: settings.theme })}
    </div>
    <p class="caption">Start the month on payday to match budgets to your salary.</p>

    <h2 class="section-title">Categories</h2>
    <div class="list list--settings">
      ${navRow({ action: 'categories-expense', icon: icons.tag, color: '#f97316', label: 'Expense categories', value: String(categoriesOf('expense').length) })}
      ${navRow({ action: 'categories-income', icon: icons.tag, color: '#14b8a6', label: 'Income categories', value: String(categoriesOf('income').length) })}
    </div>

    <h2 class="section-title">Your data</h2>
    <div class="list list--settings">
      ${navRow({ action: 'export-csv', icon: icons.table, color: '#22c55e', label: 'Export to spreadsheet', sub: 'CSV file for Excel, Numbers or Google Sheets', chevron: false })}
      ${navRow({ action: 'backup', icon: icons.download, color: '#0ea5e9', label: 'Back up', sub: lastBackup, chevron: false })}
      ${navRow({ action: 'restore', icon: icons.upload, color: '#8b5cf6', label: 'Restore from backup', chevron: false })}
      ${navRow({ action: 'delete-all', icon: icons.trash, color: '#ef4444', label: 'Delete all data', danger: true, chevron: false })}
    </div>
    <p class="caption">${transactions.length} ${transactions.length === 1 ? 'transaction' : 'transactions'}, stored only on this device. Nothing is sent anywhere.</p>
    <input type="file" accept=".json,application/json" data-restore-input hidden>

    <h2 class="section-title">App</h2>
    <div class="list list--settings">
      ${navRow({ action: 'install', icon: icons.phone, color: '#64748b', label: isStandalone() ? 'Installed on this device' : 'Install on your phone', chevron: !isStandalone() })}
      ${navRow({ action: 'storage', icon: icons.shield, color: '#0f766e', label: 'Storage', value: storageText(), chevron: false })}
    </div>
    <p class="caption" style="text-align:center;margin-top:var(--s6)">Saveit ${APP_VERSION}</p>`;
}

function openInstallHelp() {
  const os = platform();
  const ios = `
    <div class="card prose">
      <p><strong>iPhone and iPad (Safari)</strong></p>
      <ol class="steps" style="margin-top:var(--s2)">
        <li>Open this page in <strong>Safari</strong>.</li>
        <li>Tap the <strong>Share</strong> button <span class="inline-icon">${icons.share}</span>.</li>
        <li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
      </ol>
    </div>`;
  const android = `
    <div class="card prose">
      <p><strong>Android (Chrome)</strong></p>
      <ol class="steps" style="margin-top:var(--s2)">
        <li>Tap the <strong>⋮</strong> menu in the top corner.</li>
        <li>Choose <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</li>
      </ol>
    </div>`;
  const body = html(`
    <div class="stack">
      <p class="prose">Saveit then opens full screen from its own icon, like any other app, and works offline.</p>
      ${canPromptInstall() ? '<button type="button" class="btn" data-install>Install Saveit</button>' : ''}
      ${os === 'android' ? android + ios : ios + android}
    </div>`);
  const sheet = openSheet({ title: 'Install Saveit', body, grouped: true, left: null, right: { label: 'Done', strong: true } });
  body.querySelector('[data-install]')?.addEventListener('click', async () => {
    const ok = await promptInstall();
    if (ok) {
      sheet.close();
      toast('Saveit installed');
    }
  });
}

const stamp = () => todayISO();

async function exportCSV() {
  const { transactions, settings } = getState();
  if (!transactions.length) {
    toast('Nothing to export yet.');
    return;
  }
  const saved = await saveFile(`saveit-${stamp()}.csv`, toCSV(transactions, categoriesById(), settings.currency), 'text/csv');
  if (saved) toast('Spreadsheet exported');
}

async function backup() {
  const { transactions, categories, budgets, settings } = getState();
  const json = JSON.stringify(makeBackup({ transactions, categories, budgets, settings }), null, 2);
  const saved = await saveFile(`saveit-backup-${stamp()}.json`, json, 'application/json');
  if (saved) {
    updateSettings({ lastBackupAt: Date.now() });
    toast('Backup saved');
  }
}

async function restoreFrom(file) {
  let data;
  try {
    data = parseBackup(await file.text());
  } catch (err) {
    toast(err.message || "That file couldn't be read.", { duration: 6000 });
    return;
  }
  const n = data.transactions.length;
  const ok = await confirmSheet({
    title: 'Replace your data?',
    message: `Everything on this device will be replaced with the backup: ${n} ${n === 1 ? 'transaction' : 'transactions'}, plus its categories, budgets and settings.`,
    confirmLabel: 'Restore backup',
  });
  if (!ok) return;
  try {
    await replaceAllData(data);
    toast('Backup restored');
  } catch {
    toast("Couldn't restore the backup. Your data wasn't changed.");
  }
}

async function deleteEverything() {
  const ok = await confirmSheet({
    title: 'Delete all data?',
    message: 'This removes every transaction, budget and custom category from this device. It can’t be undone, so back up first if you might need it.',
    confirmLabel: 'Delete everything',
  });
  if (!ok) return;
  await deleteAllData();
  toast('All data deleted');
}

export function mount(section) {
  const content = section.querySelector('.screen-content');

  content.addEventListener('change', (e) => {
    const select = e.target.closest('[data-setting]');
    if (select) {
      const key = select.dataset.setting;
      updateSettings({ [key]: key === 'monthStartDay' ? Number(select.value) : select.value });
      return;
    }
    if (e.target.matches('[data-restore-input]')) {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) restoreFrom(file);
    }
  });

  content.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    switch (el.dataset.action) {
      case 'categories-expense':
        openCategoryList('expense');
        break;
      case 'categories-income':
        openCategoryList('income');
        break;
      case 'export-csv':
        exportCSV();
        break;
      case 'backup':
        backup();
        break;
      case 'restore':
        content.querySelector('[data-restore-input]').click();
        break;
      case 'delete-all':
        deleteEverything();
        break;
      case 'install':
        if (!isStandalone()) openInstallHelp();
        break;
      case 'storage':
        toast(
          isStoragePersisted()
            ? 'Your browser has agreed to keep Saveit’s data safe.'
            : 'Your browser may clear app data when space is low. Regular backups keep you safe.',
          { duration: 6000 },
        );
        break;
      default:
    }
  });
}
