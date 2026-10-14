// Startup, tab routing, theme and the add button.

import * as store from './store.js';
import * as home from './screens/home.js';
import * as activity from './screens/activity.js';
import * as budgets from './screens/budgets.js';
import * as settings from './screens/settings.js';
import { openTransactionEditor } from './screens/edit.js';
import { toast } from './ui/toast.js';
import { initPWA, requestPersistence, onPWAChange } from './pwa.js';

const screens = { home, activity, budgets, settings };
const titles = { home: 'Overview', activity: 'Activity', budgets: 'Budgets', settings: 'Settings' };
let current = null;
let appliedTheme = null;

const sectionFor = (name) => document.getElementById(`screen-${name}`);

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  appliedTheme = theme;
  // Match the browser/status bar to the app background.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

function routeName() {
  const name = location.hash.replace(/^#\/?/, '');
  return screens[name] ? name : 'home';
}

function render(name = current) {
  if (name) screens[name].render(sectionFor(name));
}

function show(name) {
  if (name === current) return;
  current = name;
  for (const key of Object.keys(screens)) sectionFor(key).hidden = key !== name;
  document.querySelectorAll('.tab').forEach((tab) => {
    if (tab.dataset.tab === name) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  document.querySelector('.fab').hidden = name === 'settings';
  document.title = name === 'home' ? 'Saveit' : `${titles[name]} · Saveit`;
  render(name);
}

/** Frosts the header and shows its small title once the large title scrolls under it. */
function setupLargeTitle(section) {
  const title = section.querySelector('.large-title');
  const bar = section.querySelector('.topbar');
  const update = () => {
    section.classList.toggle('is-scrolled', section.scrollTop > title.offsetTop + title.offsetHeight - bar.offsetHeight - 4);
  };
  section.addEventListener('scroll', update, { passive: true });
}

function setupTabs() {
  document.querySelector('.tabbar').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    e.preventDefault();
    const name = tab.dataset.tab;
    if (name === current) {
      // Tapping the active tab scrolls back to the top, as in native apps.
      sectionFor(name).scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      location.replace(`#/${name}`);
    }
  });
  window.addEventListener('hashchange', () => show(routeName()));
}

async function start() {
  initPWA();
  store.onError(() => toast('Couldn’t save that change. Check that storage is allowed for this site.', { duration: 6000 }));
  await store.init();
  applyTheme(store.getState().settings.theme);

  for (const [name, mod] of Object.entries(screens)) {
    const section = sectionFor(name);
    mod.mount(section);
    setupLargeTitle(section);
  }
  setupTabs();

  store.subscribe((state) => {
    if (state.settings.theme !== appliedTheme) applyTheme(state.settings.theme);
    render();
  });
  onPWAChange(() => current === 'settings' && render());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(appliedTheme));

  document.querySelector('.fab').addEventListener('click', () => {
    const type = current === 'activity' && store.getState().ui.activity.type === 'income' ? 'income' : 'expense';
    openTransactionEditor(null, { type });
  });

  show(routeName());
  document.documentElement.classList.remove('is-loading');

  // Home-screen shortcut ("Add expense") opens straight into the add sheet.
  if (new URLSearchParams(location.search).get('action') === 'add') {
    history.replaceState(null, '', location.pathname + location.hash);
    openTransactionEditor();
  }

  requestPersistence();
}

start().catch((err) => {
  console.error(err);
  document.querySelector('.app').innerHTML =
    '<div class="empty"><div class="empty-emoji">⚠️</div><h2>Saveit couldn’t start</h2><p>Try reloading the page. If it keeps happening, check that this browser allows site storage.</p></div>';
});
