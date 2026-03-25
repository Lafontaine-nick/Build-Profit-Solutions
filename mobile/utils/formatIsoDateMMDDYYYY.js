/**
 * Format strict ISO calendar date (YYYY-MM-DD) as MM-DD-YYYY for US-style UI copy.
 * Returns the original string if it is not YYYY-MM-DD.
 */
export function formatIsoDateMMDDYYYY(iso) {
  const s = String(iso || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[2]}-${m[3]}-${m[1]}`;
}
