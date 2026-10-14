import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  keypadInput, inputToCents, centsToInput, formatMoney, formatInput, currencyParts,
} from '../js/money.js';

const type = (keys) => keys.reduce((s, k) => keypadInput(s, k), '');

test('keypad builds amounts', () => {
  assert.equal(type(['1', '2', '.', '4', '0']), '12.40');
  assert.equal(type(['.', '5']), '0.5');
  assert.equal(type(['0', '0', '7']), '7');
  assert.equal(type(['3', '.', '.', '1']), '3.1');
  assert.equal(type([',', '2']), '0.2');
});

test('keypad caps decimals and length', () => {
  assert.equal(type(['1', '.', '2', '3', '4']), '1.23');
  assert.equal(type(Array(12).fill('9')), '999999999');
});

test('keypad backspace', () => {
  assert.equal(type(['1', '2', '.', '5', 'back']), '12.');
  assert.equal(type(['back']), '');
  assert.equal(type(['x']), '');
});

test('input ↔ cents round trip', () => {
  assert.equal(inputToCents('24.5'), 2450);
  assert.equal(inputToCents('24.05'), 2405);
  assert.equal(inputToCents('24.'), 2400);
  assert.equal(inputToCents('0.'), 0);
  assert.equal(inputToCents(''), 0);
  assert.equal(inputToCents('999999999.99'), 99999999999);
  assert.equal(centsToInput(2450), '24.50');
  assert.equal(centsToInput(2405), '24.05');
  assert.equal(centsToInput(2400), '24');
  assert.equal(centsToInput(0), '');
  for (const c of [1, 10, 99, 100, 101, 123456]) assert.equal(inputToCents(centsToInput(c)), c);
});

test('no floating point drift when summing cents', () => {
  const sum = [10, 20].map((c) => c).reduce((a, b) => a + b, 0);
  assert.equal(formatMoney(sum, { locale: 'en-US', currency: 'USD' }), '$0.30');
});

test('formats money by locale', () => {
  assert.equal(formatMoney(123450, { locale: 'en-IE' }), '€1,234.50');
  assert.match(formatMoney(1234500, { locale: 'es-ES' }), /^12\.345,00\s€$/);
  assert.equal(formatMoney(500, { locale: 'en-IE', sign: true }), '+€5.00');
  assert.equal(formatMoney(-500, { locale: 'en-IE', sign: true }), '-€5.00');
  assert.equal(formatMoney(0, { locale: 'en-IE', sign: true }), '€0.00');
});

test('formats keypad input with locale marks', () => {
  assert.equal(formatInput('1234.5', 'en-US'), '1,234.5');
  assert.equal(formatInput('1234.', 'de-DE'), '1.234,');
  assert.equal(formatInput('', 'en-US'), '0');
});

test('currency symbol position', () => {
  assert.deepEqual(currencyParts('EUR', 'en-IE'), { symbol: '€', before: true });
  assert.deepEqual(currencyParts('EUR', 'es-ES'), { symbol: '€', before: false });
});
