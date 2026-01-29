export function calcOverrunRatio(forecastCost: number, approvedBudget: number) {
  if (!isFinite(forecastCost) || !isFinite(approvedBudget) || approvedBudget <= 0) return 0;
  // ratio: 0.27 = 27% over; -0.12 = 12% under
  return (forecastCost - approvedBudget) / approvedBudget;
}

const pctFmt = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1, // "12.7%"
});

const moneyCompactFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',       // K, M, B, T
  maximumFractionDigits: 1,  // "$570.9B" -> adjust to 0 for "$571B"
});

export function formatOverrunPercent(ratio: number) {
  // Optional: clamp display to ±99%
  const clamped = Math.max(-0.99, Math.min(0.99, ratio)); // -99% … 99%
  return pctFmt.format(clamped);
}

export function formatOverrunImpact(forecastCost: number, approvedBudget: number) {
  const impact = Math.max(0, forecastCost - approvedBudget);
  return moneyCompactFmt.format(impact); // "$570B"
} 