# Pocket: Mobile Expense Tracker Plan

> "Pocket" is a working name. Tell me if you want a different one.

## Goal

A personal expense tracker that feels like a native phone app. It should let you:

1. **Log an expense in about 5 seconds:** amount, category, done.
2. **See where your money went** this month, by category and by day.
3. **Stay within budget** with a monthly limit and optional per-category limits.
4. **Keep your data private:** it lives on your device, works offline, and you can export it at any time.

It runs in the browser but installs to the home screen on iPhone and Android, opens full-screen with no browser bar, and works with no connection.

## Tech choices

| Decision | Choice | Why |
|---|---|---|
| App type | **Installable web app (PWA)** | One codebase for iOS and Android. No App Store or Play Store, no developer accounts, no review wait. "Add to Home Screen" gives it an icon and a full-screen window. |
| Stack | Plain HTML, CSS and JavaScript (ES modules), no framework and no build step | Same approach as the portfolio in this repo: open the file and edit it. The app has about five screens, which is small enough to manage without React. |
| Storage | **IndexedDB** behind a small wrapper (`db.js`) | Built into every browser, works offline, and holds years of transactions. |
| Offline | Service worker that caches the app files | The app opens instantly and works in airplane mode. |
| Charts | Hand-drawn inline SVG (donut and bar chart) | Two simple charts don't justify a charting library. SVG stays sharp and follows the theme colors. |
| Icons | Inline SVG, with an emoji per category | No icon font or CDN. Emoji give category colors and personality for free. |
| Fonts | System font stack (`-apple-system` / SF Pro on iPhone, Roboto on Android) | Looks native on each platform with no network request. |
| Tests | `node --test` for the logic, plus Playwright screenshots at phone size | No dependencies needed for unit tests. Playwright and Chromium are already set up in this environment. |
| Hosting | GitHub Pages, at `…/AI-PRACTICE/expense-tracker/` | Free, and it deploys on every push to the default branch. Pages requires HTTPS, which PWAs need anyway. |

**Alternative, if you want real App Store and Play Store apps:** React Native with Expo. You'd get true native controls, haptics and widgets. The cost is a Node toolchain, building on your phone through Expo Go, and $99 per year for Apple's developer account to publish. I recommend starting with the PWA. The data model and screens below carry over if you move to native later.

## Design language

The aim is for the app to feel at home on both platforms. It takes the strongest, most familiar pattern from each:

| Element | Inspiration | Details |
|---|---|---|
| Large titles | iOS | Big bold screen title that shrinks into a small sticky header as you scroll. |
| Bottom tab bar | Both | Four tabs: Home, Activity, Budgets, Settings. Icons with labels, with the active tab tinted in the accent color. |
| Add button | Android (FAB) | A round floating **+** button above the tab bar, always one thumb-tap away. |
| Bottom sheets | Both | Add, edit and filter open as sheets that slide up, with a grab handle and swipe-down to close. |
| Grouped inset lists | iOS | Rounded list sections on a tinted background, used in Settings and the transaction list. |
| Swipe actions | iOS Mail | Swipe a transaction left to delete, with an **Undo** snackbar (Material) for 5 seconds. |
| Segmented control | iOS | For Week / Month / Year on charts, and Expense / Income if income is in scope. |
| Number keypad | Both | A large custom keypad on the Add sheet, so the system keyboard never covers the form. |
| Touch feedback | Both | Pressed states on everything, plus `navigator.vibrate` taps on Android (iOS Safari doesn't support vibration). |

**Visual system**

- **Color tokens** as CSS custom properties: background, surface, text, muted text, separator, accent, success, warning and danger. Each category gets its own color.
- **Light and dark mode** follow the system automatically, with a manual override in Settings.
- **Spacing** on a 4px grid. Touch targets are at least 44×44px.
- **Corner radius:** 12px on cards, 20px on sheets, fully round on the add button.
- **Motion:** 200–300ms ease-out for sheets and screen changes. All motion is turned off under `prefers-reduced-motion`.
- **Notch and home indicator:** `viewport-fit=cover` and `env(safe-area-inset-*)` padding, so nothing sits under the notch or the home bar.
- **Numbers:** tabular figures (`font-variant-numeric: tabular-nums`) so amounts line up in columns.

## Screens

### 1. Home

```
┌──────────────────────────────┐
│ October                  ⚙︎   │  large title (current month, ‹ › to change)
│                              │
│  Spent this month            │
│  €1,284.50                   │  big number
│  ███████████░░░░  €415 left  │  budget progress bar
│                              │
│      ╭───────╮   🍔 Food 38% │
│     │  donut  │  🚗 Transp 22%│  spending by category
│      ╰───────╯   🏠 Home 18% │  (tap a slice or row to filter)
│                              │
│  Recent                 See all│
│  🍔 Lunch        Today  €12.40│
│  🚗 Uber     Yesterday  €8.90 │
│  🛒 Groceries  12 Oct  €54.20 │
│                           (+)│  floating add button
├──────────────────────────────┤
│  ⌂ Home  ☰ Activity  ◔ Budgets  ⚙ Settings │
└──────────────────────────────┘
```

### 2. Add or edit expense (bottom sheet)

```
┌──────────────────────────────┐
│            ───               │  grab handle
│ Cancel     New expense   Save│
│                              │
│          €  24.50            │  amount, typed with the keypad below
│                              │
│ 🍔 🚗 🛒 🏠 🎉 💊 ✈️ ⋯        │  category chips, horizontal scroll
│ 📅 Today   📝 Add note       │  date and note
│                              │
│  ┌─────┬─────┬─────┐         │
│  │  1  │  2  │  3  │         │
│  │  4  │  5  │  6  │         │  custom keypad
│  │  7  │  8  │  9  │         │
│  │  .  │  0  │  ⌫  │         │
│  └─────┴─────┴─────┘         │
└──────────────────────────────┘
```

- The last-used category is preselected, so the fastest path is: tap **+**, type the amount, tap **Save**.
- Save stays disabled until the amount is above 0.
- Editing opens the same sheet, filled in, with a **Delete** button.

### 3. Activity

- All transactions, grouped by day with sticky headers ("Today", "Yesterday", "Mon 12 Oct") and a daily total on each header.
- A search field filters by note or category.
- A filter sheet narrows by category, date range and amount.
- Swipe left to delete, with Undo. Tap a row to edit.
- Loads in pages as you scroll, so it stays fast with thousands of entries.

### 4. Budgets

- One overall monthly budget, plus optional limits per category.
- Each budget shows a progress bar that turns amber at 80% and red at 100%.
- Shows "€X left for Y days, about €Z per day" so the number is useful.
- A bar chart compares the last 6 months.

### 5. Settings

- **Currency** (EUR, USD, CNY, HKD and others), formatted with `Intl.NumberFormat`.
- **First day of the budget month** (for example the 25th, if that's payday).
- **Categories:** add, rename, recolor, change the emoji, reorder, and archive.
- **Theme:** System, Light or Dark.
- **Data:** export to CSV (opens in Excel or Google Sheets), export and import a JSON backup, and delete all data (asks for confirmation).
- **About:** version and a "how to install" guide for iPhone and Android.

## Data model

```js
// Money is stored as integer cents (2450 = €24.50) to avoid floating-point errors.
Transaction {
  id: string,          // crypto.randomUUID()
  amount: number,      // integer cents, always positive
  type: "expense",     // "income" later, if wanted
  categoryId: string,
  date: "2026-10-14",  // local calendar date, so entries don't shift across time zones
  note: string,
  createdAt: number,   // timestamp, used for sort order within a day
  updatedAt: number
}

Category { id, name, emoji, color, order, archived }

Budget   { id, categoryId | null /* null = overall */, amount /* cents per month */ }

Settings { currency, monthStartDay, theme, lastCategoryId, schemaVersion }
```

Starter categories: 🍔 Food, 🛒 Groceries, 🚗 Transport, 🏠 Housing, 💡 Bills, 🎉 Fun, 🛍️ Shopping, 💊 Health, ✈️ Travel, 🎓 Education, ⋯ Other.

## File layout

```
expense-tracker/
├── index.html            # app shell: tab bar, screen containers, sheet container
├── manifest.webmanifest  # name, icons, theme color, display: standalone
├── sw.js                 # service worker: caches app files for offline use
├── css/
│   ├── tokens.css        # colors, spacing, radius, type scale, light/dark
│   ├── base.css          # reset, typography, safe areas
│   └── components.css    # tab bar, add button, sheet, list, keypad, chips, charts
├── js/
│   ├── app.js            # startup, router, screen switching
│   ├── db.js             # IndexedDB wrapper and schema migrations
│   ├── store.js          # app state plus subscribe/notify, so screens re-render on change
│   ├── money.js          # cents ↔ display, currency formatting
│   ├── stats.js          # totals, category breakdown, budget math (pure functions)
│   ├── export.js         # CSV and JSON export/import
│   ├── ui/               # sheet.js, swipe.js, keypad.js, toast.js, charts.js
│   └── screens/          # home.js, activity.js, budgets.js, settings.js, edit.js
├── icons/                # app icons (192, 512, maskable, apple-touch-icon)
├── tests/
│   ├── money.test.js
│   ├── stats.test.js
│   └── export.test.js
└── README.md             # how to run, install on a phone, and deploy
```

The portfolio site at the repo root is left untouched.

## Quality bar

- **Mobile first:** designed at 375–430px wide. On tablets and desktop it shows as a centered phone-width column.
- **Speed:** opens in under 1 second on a mid-range phone. No external requests.
- **Accessibility:**
  - Semantic HTML and real `<button>` elements.
  - Labels on icon buttons.
  - Sheets trap focus and close with Escape.
  - Swipe-to-delete also has a visible Delete button inside the edit sheet, so swiping is never the only way.
  - WCAG AA contrast in both themes.
  - Works with VoiceOver and TalkBack.
- **iOS quirks handled:**
  - `100dvh` instead of `100vh`.
  - Inputs at 16px or larger so iOS doesn't zoom in on focus.
  - `apple-touch-icon` and status bar meta tags.
  - iOS can clear website data that hasn't been used for a few weeks. The app requests persistent storage (`navigator.storage.persist()`) and reminds you to export a backup now and then.
- **Data safety:**
  - Every delete can be undone.
  - Import checks the file before replacing anything.
  - The database has a `schemaVersion` so future changes can migrate old data.

## Implementation steps

1. **Design tokens and shell:** `tokens.css`, the tab bar, large-title headers, the add button, safe areas and light/dark mode. Screens hold placeholder content at this stage.
2. **Data layer:** `db.js`, `store.js` and `money.js`, plus unit tests for cents handling and formatting.
3. **Add and edit sheet:** the bottom sheet component, keypad, category chips, date picker and note. This is the core loop, so it gets polished first.
4. **Activity screen:** list grouped by day, swipe to delete with undo, search and filters.
5. **Home screen:** monthly total, budget bar, donut chart and recent list. Uses `stats.js`, which gets unit tests.
6. **Budgets screen:** overall and per-category budgets, progress bars, per-day guidance and the 6-month bar chart.
7. **Settings:** currency, month start day, category editor, theme, and export/import.
8. **PWA:** manifest, icons, service worker, offline test and install test.
9. **Checks:**
   - Playwright screenshots of every screen at 390×844, in light and dark mode.
   - Keyboard and screen-reader pass.
   - Lighthouse (aim for 95+ on performance, accessibility and best practices, plus the installable check).
   - A manual test on a real iPhone and Android phone (that part is yours).
10. **Deploy and README:** enable GitHub Pages and write the install guide.

I'll commit after each step, so you can check progress on your phone as it goes.

## Later ideas (not in v1)

- Income tracking and a net balance
- Recurring expenses (rent, subscriptions) that add themselves each month
- Multiple currencies, with conversion
- Receipt photos
- Sync across devices (would need an account and a backend, so it's deliberately left out of v1 to keep data private and the app free)
- Native app via Expo, reusing the same data model and design

## What I need from you before building

- **Name:** keep "Pocket" or pick another
- **Currency:** your main one (EUR, CNY, HKD or another)
- **Platform:** the PWA (recommended), or native apps with React Native/Expo
- **Look:** one blended iOS/Android design (recommended), or a design that adapts per device (iOS styling on iPhone, Material styling on Android)
- **Accent color:** any preference (for example blue, green or purple)
- **Income:** track expenses only, or income too
- **Categories:** keep the starter list or send your own

If you'd like to start sooner, I'll build with the recommended defaults: Pocket, EUR, PWA, blended design, a green accent, and expenses only. You can change any of these later.
