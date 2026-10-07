/**
 * Review-only thresholds for Tax Center / vendor exports. These flags do **not** change revenue,
 * expenses, net income, margin, or subcontractor payment totals — they only drive "Potential 1099 review" UX.
 */
export const TAX_REVIEW_THRESHOLDS: Record<number, { potential1099Review: number }> = {
  2024: { potential1099Review: 600 },
  2025: { potential1099Review: 600 },
  // Payments made in 2026: the 1099-NEC threshold is $2,000.
  2026: { potential1099Review: 2000 },
};

export function getPotential1099ReviewThreshold(taxYear: number): number {
  const row = TAX_REVIEW_THRESHOLDS[taxYear];
  if (row) return row.potential1099Review;
  return taxYear >= 2026 ? 2000 : 600;
}
