/** Helpers for `keyboardType="number-pad"` money fields (ZIP-style digits; last 2 digits = cents). */

const MAX_CENT_DIGITS = 12;

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** POS-style: raw digit string → dollars (e.g. "199" → 1.99, "12345" → 123.45). */
export function centsDigitsToNumber(digits: string): number {
  const d = digitsOnly(digits);
  if (!d) return 0;
  const n = parseInt(d, 10);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

export function dollarsToCentsDigits(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.round(n * 100)).slice(0, MAX_CENT_DIGITS);
}

export function clampCentsDigitsInput(raw: string): string {
  return digitsOnly(raw).slice(0, MAX_CENT_DIGITS);
}
