# Saveit: Expense Tracker

A personal expense and income tracker that feels like a native phone app. It installs to your home screen on iPhone and Android, works offline, and keeps all data on your device.

Plain HTML, CSS and JavaScript. There's no framework, no build step, and nothing to install to run it.

## Features

- **Fast entry:** tap **+**, type the amount on the big keypad, tap **Save**. The last category you used is preselected.
- **Expenses and income**, with 11 expense and 6 income starter categories. You can rename, recolor, reorder and archive them, and add your own.
- **Home:** the month's balance, income and spending, budget progress, a spending-by-category chart, and recent activity.
- **Activity:** everything grouped by day, with search (notes, categories, or an exact amount like `12.40`), filters by type, category and date, and swipe left to delete, with Undo.
- **Budgets:** a monthly limit plus optional per-category limits, "about €X a day" guidance, and a 6-month chart.
- **Settings:** currency, which day your budget month starts (handy if you're paid on the 25th), and light/dark/system theme.
- **Your data:** export to CSV for Excel or Google Sheets, back up to and restore from a JSON file, or delete everything.
- **Feels native:** large titles that collapse as you scroll, a frosted tab bar, bottom sheets you can drag down to close, and the phone's Back gesture closes sheets. Dark mode, safe areas for the notch and home bar, and reduced motion are all respected.

## Run it locally

From this folder:

```sh
npm start         # serves on http://localhost:8080 (uses npx http-server)
```

Any static file server works. Opening `index.html` directly from disk doesn't work, because browsers block JavaScript modules on `file://` URLs.

## Tests

```sh
npm test          # Node's built-in test runner, no dependencies
```

The tests cover the logic that has to be right: cents arithmetic and keypad input, budget-period dates (including custom start days and leap years), totals, budgets, filters, CSV escaping, and backup validation.

## Install it on your phone

The app must be served over HTTPS (GitHub Pages does this).

- **iPhone:** open the link in **Safari** → tap **Share** → **Add to Home Screen**.
- **Android:** open the link in **Chrome** → **⋮** menu → **Install app**. You can also use the **Install** button in Saveit's Settings.

## Deploy with GitHub Pages

1. Merge this branch into the default branch.
2. In the repo, go to **Settings → Pages** and choose **Deploy from a branch**, then select the default branch and the `/ (root)` folder.
3. The app will be at `https://<username>.github.io/<repo>/expense-tracker/`.

## Your data

Everything is stored in the browser's IndexedDB on your device. Nothing is sent anywhere. Saveit asks the browser to keep its data permanently, but browsers (Safari especially) can still clear site data, so the app reminds you to back up every 30 days once you have 10 or more transactions. Back up from **Settings → Back up**.

## Project layout

```
index.html              app shell: screens, tab bar, add button
manifest.webmanifest    name, icons, colors, "Add expense" shortcut
sw.js                   offline cache (bump VERSION when the file list changes)
css/
  tokens.css            colors, spacing, type and motion, for light and dark
  base.css              reset, typography, screen frame, large titles
  components.css        tab bar, lists, sheets, keypad, chips, charts, toasts
js/
  app.js                startup, tab routing, theme
  store.js              app state and all changes to it
  db.js                 IndexedDB storage
  money.js, dates.js, stats.js, export.js   pure logic (unit-tested)
  defaults.js           starter categories, currencies, settings
  pwa.js                install prompt, service worker, persistent storage
  ui/                   sheet, toast, swipe, keypad, charts, icons
  screens/              home, activity, budgets, settings, edit, categories
icons/                  app icons (SVG source and PNG renders)
tests/                  unit tests
```

## Notes for changes

- **Money is stored in integer cents** (2450 = €24.50) and only divided by 100 for display. Keep it that way to avoid rounding errors.
- **Dates are stored as local calendar days** (`"2026-10-14"`), not timestamps, so transactions don't shift days when you travel.
- **When you add a file,** list it in `FILES` in `sw.js` and bump `VERSION`, or it won't be available offline.
