/**
 * US-style phone display: XXX-XXX-XXXX. A leading country code 1 is not shown — digits
 * after 1 are formatted as the 10-digit national number. Reformats on each keystroke.
 */
function formatTenDigitBlock(digits: string): string {
  const n = digits.slice(0, 10);
  const extra = digits.slice(10);
  if (n.length <= 3) return n + extra;
  if (n.length <= 6) return `${n.slice(0, 3)}-${n.slice(3)}${extra}`;
  const base = `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;
  return extra ? base + extra : base;
}

export function formatUsPhoneDashes(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // Drop leading US country code 1 for display (e.g. 1255… → 255-…)
  if (digits[0] === '1') {
    if (digits.length === 1) return '';
    return formatTenDigitBlock(digits.slice(1, 12));
  }
  return formatTenDigitBlock(digits);
}
