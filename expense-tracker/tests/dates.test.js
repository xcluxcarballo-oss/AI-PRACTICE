import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, addMonths, daysBetween, periodStart, periodRange, periodLabel, dayHeading,
  shortDate, isISODate, clampStartDay, periodShortLabel,
} from '../js/dates.js';

test('adds days and months across boundaries', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
});

test('days between', () => {
  assert.equal(daysBetween('2026-10-14', '2026-11-01'), 18);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // across DST change in Europe
  assert.equal(daysBetween('2026-10-14', '2026-10-14'), 0);
});

test('calendar month periods', () => {
  assert.equal(periodStart('2026-10-14', 1), '2026-10-01');
  assert.deepEqual(periodRange('2026-10-01'), { start: '2026-10-01', end: '2026-11-01' });
  assert.equal(periodLabel('2026-10-01', 'en-US'), 'October 2026');
});

test('custom start day periods (payday on the 25th)', () => {
  assert.equal(periodStart('2026-10-25', 25), '2026-10-25');
  assert.equal(periodStart('2026-10-24', 25), '2026-09-25');
  assert.equal(periodStart('2026-01-03', 25), '2025-12-25');
  assert.equal(periodLabel('2026-10-25', 'en-GB'), '25 Oct – 24 Nov');
  assert.equal(periodShortLabel('2026-10-25', 'en-GB'), 'Nov');
  assert.equal(periodShortLabel('2026-10-05', 'en-GB'), 'Oct');
});

test('start day is clamped to 1–28', () => {
  assert.equal(clampStartDay(31), 28);
  assert.equal(clampStartDay(0), 1);
  assert.equal(clampStartDay('abc'), 1);
  assert.equal(periodStart('2026-02-28', 31), '2026-02-28');
});

test('validates ISO dates', () => {
  assert.equal(isISODate('2026-02-28'), true);
  assert.equal(isISODate('2026-02-30'), false);
  assert.equal(isISODate('2026-2-3'), false);
  assert.equal(isISODate(20261014), false);
});

test('relative day labels', () => {
  const today = '2026-10-14';
  assert.equal(dayHeading('2026-10-14', today, 'en-GB'), 'Today');
  assert.equal(dayHeading('2026-10-13', today, 'en-GB'), 'Yesterday');
  assert.equal(dayHeading('2026-10-12', today, 'en-GB'), 'Mon 12 Oct');
  assert.equal(dayHeading('2025-01-03', today, 'en-GB'), 'Fri, 3 Jan 2025');
  assert.equal(shortDate('2026-10-12', today, 'en-GB'), '12 Oct');
  assert.equal(shortDate('2026-10-14', today, 'es-ES'), 'Hoy');
});
