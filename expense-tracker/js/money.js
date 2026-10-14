// Money helpers. Amounts are always integer cents (2450 = 24.50) so sums
// never pick up floating-point errors. Only formatting divides by 100.

export const MAX_INT_DIGITS = 9;

const formatters = new Map();

function getFormatter(locale, options) {
  const key = `${locale || ''}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    formatters.set(key, f);
  }
  return f;
}

/** 2450 → "€24.50". `sign: true` adds "+" to positive amounts. */
export function formatMoney(cents, { currency = 'EUR', locale, sign = false } = {}) {
  return getFormatter(locale, {
    style: 'currency',
    currency,
    signDisplay: sign ? 'exceptZero' : 'auto',
  }).format(cents / 100);
}

/** Short form for chart labels: 125000 → "€1.3K". */
export function formatMoneyCompact(cents, { currency = 'EUR', locale } = {}) {
  return getFormatter(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

/** The symbol and whether it goes before or after the number in this locale. */
export function currencyParts(currency = 'EUR', locale) {
  const parts = getFormatter(locale, { style: 'currency', currency }).formatToParts(1);
  const symbolIndex = parts.findIndex((p) => p.type === 'currency');
  const numberIndex = parts.findIndex((p) => p.type === 'integer');
  return {
    symbol: parts[symbolIndex]?.value ?? currency,
    before: symbolIndex < numberIndex,
  };
}

/**
 * Applies one keypad press to the amount string being typed.
 * Keys are "0"–"9", "." and "back". Allows at most two decimals and
 * MAX_INT_DIGITS whole digits, and drops leading zeros.
 */
export function keypadInput(current, key) {
  if (key === 'back') return current.slice(0, -1);
  if (key === '.' || key === ',') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  if (!/^\d$/.test(key)) return current;

  const [whole, decimals] = current.split('.');
  if (decimals !== undefined) {
    return decimals.length >= 2 ? current : current + key;
  }
  if (whole === '0') return key;
  if (whole.length >= MAX_INT_DIGITS) return current;
  return current + key;
}

/** "24.5" → 2450 */
export function inputToCents(input) {
  if (!input) return 0;
  const [whole, decimals = ''] = input.split('.');
  return Number(whole || '0') * 100 + Number(`${decimals}00`.slice(0, 2));
}

/** 2450 → "24.50", 2400 → "24", 0 → "" (the inverse of inputToCents) */
export function centsToInput(cents) {
  if (!cents) return '';
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0')}`;
}

/** Shows a keypad string with the locale's grouping and decimal mark: "1234.5" → "1,234.5". */
export function formatInput(input, locale) {
  if (!input) return '0';
  const [whole, decimals] = input.split('.');
  const grouped = getFormatter(locale, { maximumFractionDigits: 0 }).format(Number(whole || '0'));
  if (decimals === undefined) return grouped;
  const mark = getFormatter(locale, {}).formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.';
  return `${grouped}${mark}${decimals}`;
}
