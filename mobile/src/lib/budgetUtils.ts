// src/lib/budgetUtils.ts
// Utilities to clamp projections, format $, compute %, normalize progress bars,
// and handle invalid dates (Cursor/Expo safe).

/** ---------- Number formatting ---------- */
export type Currency = "USD" | "EUR" | "GBP";

const SMALL = 1_000;
const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

/** Human $ with K/M (never shows B unless you explicitly allow it) */
export function formatMoneyShort(
  value: number,
  opts: { currency?: Currency; allowBillion?: boolean } = {}
): string {
  const { currency = "USD", allowBillion = false } = opts;
  const sign = value < 0 ? "-" : "";
  const v = Math.abs(value);

  if (!allowBillion && v >= BILLION) {
    // Clamp to millions if insane (prevents $795B/$794,707,148,700)
    return `${sign}${currencySymbol(currency)}${(v / MILLION).toFixed(0)}M`;
  }

  if (v >= MILLION) return `${sign}${currencySymbol(currency)}${trimZeros(v / MILLION)}M`;
  if (v >= SMALL) return `${sign}${currencySymbol(currency)}${trimZeros(v / SMALL)}K`;

  // Under 1k: standard currency formatting
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(`${sign}${v}`));
}

function currencySymbol(c: Currency): string {
  switch (c) {
    case "USD": return "$";
    case "EUR": return "€";
    case "GBP": return "£";
    default: return "$";
  }
}

function trimZeros(n: number): string {
  // Keep one decimal when helpful (e.g., 1.2M), else integer (e.g., 12M)
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
}

/** Compact percent with hard ceiling (prevents 1268689545%) */
export function formatPercentSafe(
  numerator: number,
  denominator: number,
  opts: { max?: number; decimals?: number } = {}
): string {
  const { max = 999, decimals = 1 } = opts;
  const pct = percentSafe(numerator, denominator, { max });
  return `${pct.toFixed(decimals)}%`;
}

/** Returns a safe percent number (0..max). If denominator <= 0 -> 0. */
export function percentSafe(
  numerator: number,
  denominator: number,
  opts: { max?: number } = {}
): number {
  const { max = 999 } = opts; // cap at 999% by default
  if (!isFinite(numerator) || !isFinite(denominator) || denominator <= 0) return 0;
  const raw = (numerator / denominator) * 100;
  if (!isFinite(raw) || isNaN(raw)) return 0;
  return Math.max(0, Math.min(raw, max));
}

/** ---------- Budget math ---------- */

/**
 * Clamp projected cost to a realistic window around planned (e.g., 0.5x..3x).
 * Also strips NaN/Infinity.
 */
export function clampProjected(
  projectedRaw: number,
  planned: number,
  opts: { minMultiplier?: number; maxMultiplier?: number } = {}
): number {
  const { minMultiplier = 0.5, maxMultiplier = 3 } = opts;
  const p = safeNumber(projectedRaw);
  const base = Math.max(1, safeNumber(planned)); // avoid 0
  const min = base * minMultiplier;
  const max = base * maxMultiplier;
  return Math.min(Math.max(p, min), max);
}

/** Overrun amount & % given planned and projected */
export function calcOverrun(planned: number, projectedRaw: number) {
  const plannedSafe = Math.max(1, safeNumber(planned));
  const projected = clampProjected(projectedRaw, plannedSafe);
  const overrun = Math.max(0, projected - plannedSafe);
  const pct = percentSafe(overrun, plannedSafe, { max: 999 });
  return { projected, overrun, pct };
}

/** ---------- Progress normalization ---------- */

/**
 * Normalized progress [0..1]. Handles negatives, NaN, and denominator<=0.
 * Use one function everywhere so bars stay consistent.
 */
export function progress01(used: number, total: number): number {
  const u = Math.max(0, safeNumber(used));
  const t = Math.max(0, safeNumber(total));
  if (t <= 0) return 0; // unknown total -> show 0% and maybe a "—" label in UI
  return Math.max(0, Math.min(u / t, 1));
}

/** Pretty "83.3%" (fixed decimals) from progress01 value */
export function progressLabel(p01: number, decimals = 1): string {
  const pct = Math.max(0, Math.min(p01, 1)) * 100;
  return `${pct.toFixed(decimals)}%`;
}

/** ---------- Dates ---------- */

/**
 * Safely parse a date input. If invalid, return a friendly placeholder.
 * Example placeholders:
 *  - "Pending Update" (no schedule yet)
 *  - "Awaiting Schedule Input" (requires user action)
 */
export function safeDateLabel(
  dateInput: string | number | Date | null | undefined,
  opts: { placeholder?: string; format?: Intl.DateTimeFormatOptions } = {}
): string {
  const { placeholder = "Pending Update", format } = opts;
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput ?? "");
  if (isNaN(d.getTime())) return placeholder;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(format || {}),
  }).format(d);
}

/** ---------- Helpers ---------- */

/**
 * Convert unknown input to a safe finite number.
 * Returns 0 for NaN, Infinity, null, undefined, or non-numeric values.
 */
function safeNumber(n: unknown): number {
  if (typeof n !== "number") return 0;
  if (!isFinite(n) || isNaN(n)) return 0;
  return n;
}

/** ---------- Additional utilities ---------- */

/**
 * Format full currency amount (no abbreviations)
 * e.g., $12,345.67
 */
export function formatMoneyFull(
  value: number,
  opts: { currency?: Currency; decimals?: number } = {}
): string {
  const { currency = "USD", decimals = 2 } = opts;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safeNumber(value));
}

/**
 * Calculate days remaining from a date
 * Returns negative if date is in the past
 */
export function daysRemaining(dateInput: string | number | Date | null | undefined): number | null {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput ?? "");
  if (isNaN(d.getTime())) return null;
  
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Format days remaining as human-readable string
 * e.g., "5 days left", "Overdue by 3 days", "Due today"
 */
export function daysRemainingLabel(dateInput: string | number | Date | null | undefined): string {
  const days = daysRemaining(dateInput);
  if (days === null) return "No deadline";
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  if (days > 1) return `${days} days left`;
  if (days === -1) return "Overdue by 1 day";
  return `Overdue by ${Math.abs(days)} days`;
}

/**
 * Calculate budget health score (0-100)
 * 100 = on budget, <100 = over budget, >100 = under budget
 */
export function budgetHealthScore(spent: number, budget: number): number {
  const s = safeNumber(spent);
  const b = Math.max(1, safeNumber(budget));
  const ratio = s / b;
  
  if (ratio <= 1) {
    // Under or on budget: 100-50 scale
    return Math.round(100 - (ratio * 50));
  } else {
    // Over budget: 50-0 scale
    const overageRatio = Math.min((ratio - 1) * 2, 1); // Max out at 2x over
    return Math.round(50 * (1 - overageRatio));
  }
}

/**
 * Get budget status color
 */
export function budgetStatusColor(spent: number, budget: number): string {
  const pct = percentSafe(spent, budget);
  if (pct >= 100) return "#ef4444"; // red - over budget
  if (pct >= 90) return "#f59e0b"; // amber - warning
  if (pct >= 75) return "#eab308"; // yellow - caution
  return "#10b981"; // green - healthy
}

/**
 * Get budget status label
 */
export function budgetStatusLabel(spent: number, budget: number): string {
  const pct = percentSafe(spent, budget);
  if (pct >= 100) return "Over Budget";
  if (pct >= 90) return "Critical";
  if (pct >= 75) return "Warning";
  return "On Track";
} 