export function calcOverrunRatio(forecastCost: number, approvedBudget: number) {
  if (!isFinite(forecastCost) || !isFinite(approvedBudget) || approvedBudget <= 0) return 0;
  return (forecastCost - approvedBudget) / approvedBudget;
}

const pctFmt = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const moneyCompactFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const dateShortFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const timeShortFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

export function formatOverrunPercent(ratio: number) {
  const clamped = Math.max(-0.99, Math.min(0.99, ratio));
  return pctFmt.format(clamped);
}

export function formatOverrunImpact(forecastCost: number, approvedBudget: number) {
  const impact = Math.max(0, forecastCost - approvedBudget);
  return moneyCompactFmt.format(impact);
}

/** Full USD with two decimals, e.g. $12,345.67 */
export function formatMoneyUSD(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Compact currency for summaries (K / M / B). Small values use full USD like formatMoneyUSD.
 */
export function formatMoneyCompact(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return formatMoneyUSD(value);
}

/** Display 0–100 style percentages, e.g. 12.5% */
export function formatPercentDisplay(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

/** Ratio 0–1 → percent string, e.g. 0.125 → 12.5% */
export function formatRatioAsPercent(ratio: number, fractionDigits = 1): string {
  return formatPercentDisplay(ratio * 100, fractionDigits);
}

export function formatDateShort(input: Date | string | number): string {
  const d =
    input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return dateShortFmt.format(d);
}

export function formatTimeShort(input: Date | string | number): string {
  const d =
    input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return timeShortFmt.format(d);
}

/** Title-case single-word or phrase status for display */
export function normalizeStatusLabel(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
