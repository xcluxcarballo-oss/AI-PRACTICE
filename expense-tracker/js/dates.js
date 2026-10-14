// Date helpers. Transactions store a local calendar date ("2026-10-14"), not a
// timestamp, so an expense never moves to another day when you travel.
// ISO date strings compare correctly as plain strings.

const pad = (n) => String(n).padStart(2, '0');

export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(now = new Date()) {
  return toISO(now);
}

export function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISO(parseISO(value)) === value;
}

export function addDays(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Adds months, clamping the day to the target month's length (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return toISO(target);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Budget months can start on any day from 1 to 28, so every month has that day. */
export function clampStartDay(day) {
  const n = Math.trunc(Number(day));
  return Number.isFinite(n) ? Math.min(28, Math.max(1, n)) : 1;
}

/** First day of the budget period containing `iso`. */
export function periodStart(iso, startDay = 1) {
  const day = clampStartDay(startDay);
  const [y, m, d] = iso.split('-').map(Number);
  const start = d >= day ? new Date(y, m - 1, day) : new Date(y, m - 2, day);
  return toISO(start);
}

/** The period beginning at `start`. `end` is exclusive (the next period's start). */
export function periodRange(start) {
  return { start, end: addMonths(start, 1) };
}

export function shiftPeriod(start, count) {
  return addMonths(start, count);
}

/** "October 2026" for calendar months, "25 Oct – 24 Nov" for custom start days. */
export function periodLabel(start, locale) {
  const startDate = parseISO(start);
  if (startDate.getDate() === 1) {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(startDate);
  }
  const last = parseISO(addDays(addMonths(start, 1), -1));
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  return `${fmt.format(startDate)} – ${fmt.format(last)}`;
}

/** Short label for a period on a chart axis: "Oct". */
export function periodShortLabel(start, locale) {
  const startDate = parseISO(start);
  // For custom start days, name the month that holds most of the period.
  const mid = startDate.getDate() > 15 ? parseISO(addMonths(start, 1)) : startDate;
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(mid);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function relativeWord(iso, today, locale) {
  const diff = daysBetween(iso, today);
  if (diff !== 0 && diff !== 1) return null;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return capitalize(rtf.format(-diff, 'day'));
}

/** Day group header: "Today", "Yesterday", "Mon, 12 Oct", "Fri, 3 Jan 2025". */
export function dayHeading(iso, today = todayISO(), locale) {
  const word = relativeWord(iso, today, locale);
  if (word) return word;
  const date = parseISO(iso);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

/** Compact date for rows and chips: "Today", "Yesterday", "12 Oct". */
export function shortDate(iso, today = todayISO(), locale) {
  const word = relativeWord(iso, today, locale);
  if (word) return word;
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(parseISO(iso));
}
