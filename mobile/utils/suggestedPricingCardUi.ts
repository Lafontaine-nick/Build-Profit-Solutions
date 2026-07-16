/**
 * Confirm Scope suggested-pricing card presentation helpers.
 * Display-only — does not change stored totals, apply math, or rate metadata.
 */

import { formatDraftMoney } from '@/utils/estimateAiDraft';
import { formatUnitLabel, type SuggestedPricingBlock } from '@/utils/scopeItemQuantities';

/** Scopes temporarily priced from living area when the correct measurement is missing. */
export const LIVING_AREA_FALLBACK_SCOPE_IDS = new Set([
  'windows_doors',
  'plumbing_rough',
  'electrical_rough',
  'hvac',
  'insulation',
]);

export type SuggestedQuantitySource =
  | 'notes'
  | 'plan'
  | 'user'
  | 'calculated'
  | 'assumption'
  | 'fallback'
  | 'unknown';

export type SuggestedPricingStatus = 'ready' | 'planning' | 'allowance' | 'review_required';

export type SuggestedPricingActionType = 'apply_price' | 'apply_allowance' | 'use_planning_price';

export type SuggestedPricingCardDisplay = {
  quantitySource: SuggestedQuantitySource;
  pricingSource: string;
  pricingStatus: SuggestedPricingStatus;
  confidenceLevel: 'low' | 'medium' | 'high' | 'unknown' | null;
  missingMeasurementKey: string | null;
  isFallbackPricing: boolean;
  pricingBasisLabel: string | null;
  actionType: SuggestedPricingActionType;
  title: string;
  quantityLine: string | null;
  fallbackBasisLine: string | null;
  missingMeasurementTitle: string | null;
  missingMeasurementHint: string | null;
  displayTotal: string;
  splitLine: string | null;
  unitRateLine: string | null;
  sourceLine: string;
  statusLine: string | null;
  statusTone: 'amber' | 'neutral';
  actionLabel: string | null;
  allowanceExtraNote: string | null;
};

const FALLBACK_MEASUREMENT_COPY: Record<
  string,
  { title: string; hint: string; statusDetail: string }
> = {
  windows_doors: {
    title: 'Opening count needed',
    hint: 'Add the window and door count for more accurate pricing.',
    statusDetail: 'Opening count not provided',
  },
  plumbing_rough: {
    title: 'Rough-in count needed',
    hint: 'Add plumbing rough-in points for more accurate pricing.',
    statusDetail: 'Rough-in count not provided',
  },
  electrical_rough: {
    title: 'Circuit/device count needed',
    hint: 'Add the circuit or device count for more accurate pricing.',
    statusDetail: 'Circuit/device count not provided',
  },
  hvac: {
    title: 'System count needed',
    hint: 'Add HVAC system count or tons for more accurate pricing.',
    statusDetail: 'System count not provided',
  },
  insulation: {
    title: 'Envelope area needed',
    hint: 'Add envelope surface area for more accurate pricing.',
    statusDetail: 'Envelope surface area not provided',
  },
};

/** Visible source chip — short; full rateSourceLabel stays in underlying data. */
export function displayPriceSourceLabel(rateSourceLabel: string | null | undefined): string {
  const raw = String(rateSourceLabel || '').trim();
  const stripped = raw.replace(/^Suggested · /, '').replace(/^Adjusted · /, '').trim();
  if (!stripped) return 'BPS national benchmark';
  if (/national/i.test(stripped) || /builder-budget/i.test(stripped)) {
    return 'BPS national benchmark';
  }
  if (/southern\s*utah|local\s*benchmark/i.test(stripped)) {
    return 'Local benchmark';
  }
  if (/saved|template|company/i.test(stripped)) {
    return 'Saved contractor pricing';
  }
  if (/user\s*adjust/i.test(stripped)) {
    return 'User adjusted';
  }
  if (/user\s*enter/i.test(stripped)) {
    return 'User entered';
  }
  if (/notes|parsed/i.test(stripped)) {
    return 'From notes';
  }
  return stripped.length > 28 ? `${stripped.slice(0, 25).trimEnd()}…` : stripped;
}

/**
 * Display-only rounding for suggested / planning totals.
 * Under $1k → nearest $10; $1k–$10k → nearest $10; over $10k → nearest $50.
 */
export function roundSuggestedDisplayTotal(total: number | null | undefined): number | null {
  const n = Number(total);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1000) return Math.round(n / 10) * 10;
  if (n <= 10000) return Math.round(n / 10) * 10;
  return Math.round(n / 50) * 50;
}

/** Whole-dollar component display (nearest $10) — totals use roundSuggestedDisplayTotal. */
export function roundSuggestedDisplayComponent(amount: number | null | undefined): number | null {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n / 10) * 10;
}

export function formatSuggestedDisplayMoney(total: number | null | undefined): string {
  const rounded = roundSuggestedDisplayTotal(total);
  if (rounded == null) return '—';
  return `$${rounded.toLocaleString()}`;
}

export function formatSuggestedComponentMoney(amount: number | null | undefined): string {
  const rounded = roundSuggestedDisplayComponent(amount);
  if (rounded == null) return '—';
  return `$${rounded.toLocaleString()}`;
}

/** Keep exact money for user-entered / applied values. */
export function formatAppliedDisplayMoney(total: number | null | undefined): string {
  return formatDraftMoney(total);
}

export function normalizeQuantitySource(
  quantitySource?: string | null
): SuggestedQuantitySource {
  const key = String(quantitySource || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!key || key === 'missing') return 'unknown';
  if (key === 'notes' || /note/.test(key)) return 'notes';
  if (
    key === 'plan_vision' ||
    key === 'plan_explicit' ||
    key === 'plan_derived' ||
    /plan|vision|pdf/.test(key)
  ) {
    return 'plan';
  }
  if (key === 'user_entered' || key === 'manual_override' || /user|manual/.test(key)) return 'user';
  if (key === 'calculated_confirmed' || key === 'inferred' || /calculat|formula|derived/.test(key)) {
    return 'calculated';
  }
  if (key === 'default_assumption' || /assumption/.test(key)) return 'assumption';
  if (/fallback|planning|benchmark_estimate/.test(key)) return 'fallback';
  return 'unknown';
}

export function quantityProvenanceLabel(source: SuggestedQuantitySource | string | null | undefined): string {
  const normalized =
    typeof source === 'string' &&
    !['notes', 'plan', 'user', 'calculated', 'assumption', 'fallback', 'unknown'].includes(source)
      ? normalizeQuantitySource(source)
      : (source as SuggestedQuantitySource | null | undefined);
  switch (normalized) {
    case 'notes':
      return 'From notes';
    case 'plan':
      return 'From plan';
    case 'user':
      return 'User entered';
    case 'calculated':
      return 'Calculated';
    case 'assumption':
      return 'Planning assumption';
    case 'fallback':
      return 'Fallback basis';
    default:
      return 'Planning assumption';
  }
}

export function isLivingAreaFallbackPricing(input: {
  itemId: string;
  block: Pick<SuggestedPricingBlock, 'lumpSumOnly' | 'basis'>;
  quantitySource?: string | null;
  hasPrimaryTakeoff?: boolean;
}): boolean {
  const id = String(input.itemId || '')
    .trim()
    .toLowerCase();
  if (!LIVING_AREA_FALLBACK_SCOPE_IDS.has(id)) return false;
  if (input.block.lumpSumOnly) return false;
  if (input.hasPrimaryTakeoff === true) return false;
  const qs = normalizeQuantitySource(input.quantitySource);
  if (qs === 'notes' || qs === 'plan' || qs === 'user' || qs === 'calculated') {
    // Primary measurement present — not a living-area fallback.
    if (id === 'hvac' && input.block.basis?.unit === 'each') return false;
    if (input.block.basis?.unit && input.block.basis.unit !== 'sqft' && input.block.basis.unit !== 'living_sqft') {
      return false;
    }
    // Count-based trades with a real count source are ready.
    if (id !== 'insulation' && (input.block.basis?.unit === 'each' || input.block.basis?.unit === 'lf')) {
      return false;
    }
  }
  if (input.hasPrimaryTakeoff === false) return true;
  if (qs === 'unknown' || qs === 'fallback' || qs === 'assumption') return true;
  const unit = String(input.block.basis?.unit || '').toLowerCase();
  return unit === 'sqft' || unit === 'living_sqft';
}

export function suggestedCardTitle(input: {
  lumpSumOnly?: boolean;
  isComparison?: boolean;
  mode?: string | null;
  rateSourceLabel?: string;
  isFallbackPricing?: boolean;
}): string {
  const adjusted = String(input.rateSourceLabel || '').startsWith('Adjusted · ');
  if (input.lumpSumOnly) return adjusted ? 'Adjusted allowance' : 'Suggested allowance';
  if (input.isFallbackPricing) return adjusted ? 'Adjusted planning price' : 'Suggested planning price';
  if (input.mode === 'note_total_split' && !adjusted) return 'Budget split';
  if (input.isComparison) return 'Suggested comparison';
  return adjusted ? 'Adjusted pricing' : 'Suggested pricing';
}

export function resolveSuggestedActionType(input: {
  lumpSumOnly?: boolean;
  isFallbackPricing?: boolean;
  benchmarkAction?: string | null;
}): SuggestedPricingActionType {
  if (input.benchmarkAction === 'comparison_only' || input.benchmarkAction === 'included_in_stage') {
    return 'apply_price';
  }
  if (input.lumpSumOnly || input.benchmarkAction === 'benchmark_only') return 'apply_allowance';
  if (input.isFallbackPricing) return 'use_planning_price';
  return 'apply_price';
}

export function suggestedActionLabel(actionType: SuggestedPricingActionType): string {
  switch (actionType) {
    case 'apply_allowance':
      return 'Apply allowance';
    case 'use_planning_price':
      return 'Use planning price';
    default:
      return 'Apply price';
  }
}

/** @deprecated Prefer resolveSuggestedActionType + suggestedActionLabel */
export function applyPriceActionLabel(input: {
  lumpSumOnly?: boolean;
  benchmarkAction?: string | null;
  isFallbackPricing?: boolean;
}): string {
  return suggestedActionLabel(
    resolveSuggestedActionType({
      lumpSumOnly: input.lumpSumOnly,
      benchmarkAction: input.benchmarkAction,
      isFallbackPricing: input.isFallbackPricing,
    })
  );
}

export function formatQuantityProvenanceLine(input: {
  quantity: number | null | undefined;
  unit?: string | null;
  provenance?: SuggestedQuantitySource | string | null;
}): string | null {
  const qty = Number(input.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const rawUnit = String(input.unit || 'sqft').toLowerCase();
  const unit =
    rawUnit === 'floor_sqft' || rawUnit === 'living_sqft' || rawUnit === 'sf' || rawUnit === 'sq.ft'
      ? 'sqft'
      : formatUnitLabel(input.unit || 'sqft');
  const qtyLabel =
    Math.abs(qty - Math.round(qty)) < 0.05
      ? Math.round(qty).toLocaleString()
      : qty.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return `${qtyLabel} ${unit} · ${quantityProvenanceLabel(input.provenance)}`;
}

export function formatFallbackBasisLine(input: {
  livingSf: number | null | undefined;
}): string | null {
  const living = Number(input.livingSf);
  if (!Number.isFinite(living) || living <= 0) return null;
  return `Fallback basis: ${Math.round(living).toLocaleString()} sqft living area`;
}

export function formatSuggestedSplitLine(block: SuggestedPricingBlock): string | null {
  if (block.lumpSumOnly) return null;
  const buckets = block.costBuckets?.length
    ? block.costBuckets.filter((b) => b.amount > 0)
    : [
        ...(block.material > 0
          ? [{ key: 'material' as const, label: 'Material', amount: block.material }]
          : []),
        ...(block.labor > 0 ? [{ key: 'labor' as const, label: 'Labor', amount: block.labor }] : []),
      ];
  if (!buckets.length) return null;
  return buckets.map((b) => `${b.label} ${formatSuggestedComponentMoney(b.amount)}`).join(' · ');
}

export function formatSuggestedUnitRateLine(block: SuggestedPricingBlock): string | null {
  const qty = block.basis?.quantity;
  const unit = block.basis?.unit;
  if (!(qty && qty > 0) || !unit || block.lumpSumOnly) return null;
  if (unit === 'living_sqft') return null;
  const rate = block.total / qty;
  if (!(rate > 0) || !Number.isFinite(rate)) return null;
  const unitLabel = formatUnitLabel(unit === 'living_sqft' ? 'sqft' : unit);
  const decimals = rate >= 100 ? 0 : 2;
  return `$${rate.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}/${unitLabel}`;
}

export function buildSuggestedPricingCardDisplay(input: {
  itemId: string;
  block: SuggestedPricingBlock;
  quantitySource?: string | null;
  hasPrimaryTakeoff?: boolean;
  livingSf?: number | null;
  confidenceLabel?: string | null;
  adjusted?: boolean;
}): SuggestedPricingCardDisplay {
  const { block, itemId } = input;
  const isAdjusted = Boolean(input.adjusted || block.rateSourceLabel.startsWith('Adjusted · '));
  const quantitySource = normalizeQuantitySource(input.quantitySource);
  const isFallbackPricing = isLivingAreaFallbackPricing({
    itemId,
    block,
    quantitySource: input.quantitySource,
    hasPrimaryTakeoff: input.hasPrimaryTakeoff,
  });
  const lumpSumOnly = Boolean(block.lumpSumOnly);
  const actionType = resolveSuggestedActionType({
    lumpSumOnly,
    isFallbackPricing,
    benchmarkAction: block.benchmarkAction,
  });
  const pricingSource = displayPriceSourceLabel(
    isAdjusted
      ? block.rateSourceLabel.replace(/^Adjusted · /, '') || 'User adjusted'
      : block.rateSourceLabel
  );

  const fallbackCopy = FALLBACK_MEASUREMENT_COPY[itemId] || null;
  const livingSf =
    Number(input.livingSf) > 0
      ? Number(input.livingSf)
      : block.basis?.unit === 'sqft' || block.basis?.unit === 'living_sqft'
        ? Number(block.basis.quantity)
        : null;

  let pricingStatus: SuggestedPricingStatus = 'ready';
  if (lumpSumOnly) pricingStatus = 'allowance';
  else if (isFallbackPricing) pricingStatus = 'planning';
  else if (/low|review|measurement/i.test(String(input.confidenceLabel || ''))) {
    pricingStatus = 'review_required';
  }

  const confidenceLevel = /low/i.test(String(input.confidenceLabel || ''))
    ? 'low'
    : /medium/i.test(String(input.confidenceLabel || ''))
      ? 'medium'
      : /high/i.test(String(input.confidenceLabel || ''))
        ? 'high'
        : null;

  let statusLine: string | null = null;
  let statusTone: 'amber' | 'neutral' = 'neutral';
  let allowanceExtraNote: string | null = null;

  let missingMeasurementTitle: string | null = null;
  let missingMeasurementHint: string | null = null;

  if (lumpSumOnly) {
    statusTone = 'amber';
    if (itemId === 'permits') {
      statusLine = 'Planning allowance · Confirm locally';
      allowanceExtraNote = 'Water, sewer, fire, or utility fees may be separate.';
      missingMeasurementTitle = 'Needs local fee confirmation';
      missingMeasurementHint = 'Confirm permit and impact fees for the project jurisdiction.';
    } else if (itemId === 'plans_engineering') {
      statusLine = 'Planning allowance · Engineering and soils may be separate';
      missingMeasurementTitle = 'Needs allowance';
      missingMeasurementHint = 'Enter a plans and engineering allowance for this job.';
    } else if (itemId === 'cleanup') {
      statusLine = 'Planning allowance · Confirm locally';
      missingMeasurementTitle = 'Needs allowance';
      missingMeasurementHint = 'Enter cleanup and disposal allowance for this job.';
    } else {
      statusLine = 'Planning allowance';
      missingMeasurementTitle = 'Needs allowance';
      missingMeasurementHint = 'Enter an allowance for this job.';
    }
  } else if (isFallbackPricing) {
    statusTone = 'amber';
    statusLine = fallbackCopy
      ? `Planning price · ${fallbackCopy.statusDetail}`
      : 'Planning price · Uses living-area fallback';
    missingMeasurementTitle = fallbackCopy?.title || 'Measurement needed';
    missingMeasurementHint =
      fallbackCopy?.hint || 'Add the correct measurement for more accurate pricing.';
  } else if (confidenceLevel === 'low') {
    statusTone = 'amber';
    statusLine = 'Low confidence · Local pricing not verified';
  } else if (input.confidenceLabel) {
    statusLine = String(input.confidenceLabel).trim();
  }

  const displayTotal = isAdjusted
    ? formatDraftMoney(block.total)
    : formatSuggestedDisplayMoney(block.total);

  const quantityLine =
    isFallbackPricing || lumpSumOnly
      ? null
      : formatQuantityProvenanceLine({
          quantity: block.basis?.quantity,
          unit: block.basis?.unit,
          provenance: quantitySource === 'unknown' ? 'assumption' : quantitySource,
        });

  const fallbackBasisLine = isFallbackPricing ? formatFallbackBasisLine({ livingSf }) : null;

  return {
    quantitySource: isFallbackPricing ? 'fallback' : quantitySource,
    pricingSource,
    pricingStatus,
    confidenceLevel,
    missingMeasurementKey: isFallbackPricing ? itemId : null,
    isFallbackPricing,
    pricingBasisLabel: fallbackBasisLine,
    actionType,
    title: suggestedCardTitle({
      lumpSumOnly,
      isComparison: block.isComparison,
      mode: block.mode,
      rateSourceLabel: block.rateSourceLabel,
      isFallbackPricing,
    }),
    quantityLine,
    fallbackBasisLine,
    missingMeasurementTitle,
    missingMeasurementHint,
    displayTotal,
    splitLine: lumpSumOnly ? 'Allowance · Flat amount' : formatSuggestedSplitLine(block),
    unitRateLine: isFallbackPricing ? null : formatSuggestedUnitRateLine(block),
    sourceLine: pricingSource,
    statusLine,
    statusTone,
    actionLabel:
      block.benchmarkAction === 'comparison_only' || block.benchmarkAction === 'included_in_stage'
        ? null
        : suggestedActionLabel(actionType),
    allowanceExtraNote,
  };
}
