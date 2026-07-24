/**
 * Confirm Scope suggested-pricing card presentation helpers.
 * Display-only — does not change stored totals, apply math, or rate metadata.
 */

import { formatDraftMoney } from '@/utils/estimateAiDraft';
import { formatUnitLabel, type SuggestedPricingBlock } from '@/utils/scopeItemQuantities';

/** Scopes temporarily priced from living area when the correct measurement is missing. */
export const LIVING_AREA_FALLBACK_SCOPE_IDS = new Set([
  'windows',
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

export type SuggestedPricingActionType =
  | 'apply_price'
  | 'apply_allowance'
  | 'use_planning_price'
  | 'use_suggested';

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
  /** @deprecated Prefer a single statusLine — kept null for new cards. */
  missingMeasurementTitle: string | null;
  /** @deprecated Prefer a single statusLine — kept null for new cards. */
  missingMeasurementHint: string | null;
  displayTotal: string;
  splitLine: string | null;
  unitRateLine: string | null;
  sourceLine: string;
  statusLine: string | null;
  statusTone: 'amber' | 'neutral';
  actionLabel: string | null;
  allowanceExtraNote: string | null;
  /** Provenance lines retained for tests; Confirm Scope cards no longer disclose them. */
  whyThisPriceLines: string[];
  /** Compact alternative under an already-entered current price. */
  presentation: 'full' | 'compact';
  compactLine: string | null;
};

/** True when current entered/applied amount differs from the suggestion. */
export function shouldUseCompactSuggestedAlternative(params: {
  currentTotal?: number | null;
  suggestedTotal?: number | null;
}): boolean {
  const current = Number(params.currentTotal);
  const suggested = Number(params.suggestedTotal);
  if (!(Number.isFinite(current) && current > 0)) return false;
  if (!(Number.isFinite(suggested) && suggested > 0)) return false;
  return Math.abs(current - suggested) >= 0.01;
}

export function formatCompactSuggestedLine(total: number | null | undefined): string | null {
  const formatted = formatAppliedDisplayMoney(total);
  if (formatted === '—') return null;
  return `Suggested ${formatted}`;
}

export function compactSuggestedActionLabel(lumpSumOnly?: boolean): string {
  return lumpSumOnly ? 'Use suggested' : 'Use suggested';
}

const FALLBACK_MEASUREMENT_COPY: Record<
  string,
  { title: string; hint: string; statusDetail: string }
> = {
  windows: {
    title: 'Window count needed',
    hint: 'Add the window count for more accurate pricing.',
    statusDetail: 'Window count not provided',
  },
  exterior_doors: {
    title: 'Exterior door count needed',
    hint: 'Planning package available — add swing door count for per-door pricing.',
    statusDetail: 'Exterior door count not provided',
  },
  sliding_doors: {
    title: 'Sliding door count needed',
    hint: 'Planning package available — add sliding / patio door count for per-door pricing.',
    statusDetail: 'Sliding door count not provided',
  },
  garage_doors: {
    title: 'Garage door types needed',
    hint: 'Set single, double, and/or RV garage door counts — pricing differs by type.',
    statusDetail: 'Garage door type counts not provided',
  },
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
    title: 'Thermal-envelope area needed',
    hint: 'Add exterior wall + attic insulation SF (not drywall surface) for more accurate pricing.',
    statusDetail: 'Thermal-envelope takeoff not provided',
  },
};

/** Visible source chip — short; full rateSourceLabel stays in underlying data. */
export function displayPriceSourceLabel(rateSourceLabel: string | null | undefined): string {
  const raw = String(rateSourceLabel || '').trim();
  const stripped = raw.replace(/^Suggested · /, '').replace(/^Adjusted · /, '').trim();
  if (!stripped) return 'BPS national benchmark';
  // Keep full blended barometer labels (e.g. "Blended national + barometer · Plan 41 · CA").
  if (/blended\s*national\s*\+\s*barometer/i.test(stripped)) {
    return stripped.length > 52 ? `${stripped.slice(0, 49).trimEnd()}…` : stripped;
  }
  if (/national\s*average\s*comparison/i.test(stripped)) {
    return 'National average';
  }
  if (/national/i.test(stripped) || /builder-budget/i.test(stripped)) {
    return 'BPS national benchmark';
  }
  // Keep full Southern Utah comparable labels (e.g. "Southern Utah comparable · Plan 41").
  if (/southern\s*utah\s*comparable/i.test(stripped)) {
    return stripped.length > 48 ? `${stripped.slice(0, 45).trimEnd()}…` : stripped;
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

/** Exact apply amount — matches stored totals after Apply (no planning rounding). */
export function formatSuggestedDisplayMoney(total: number | null | undefined): string {
  return formatAppliedDisplayMoney(total);
}

export function formatSuggestedComponentMoney(amount: number | null | undefined): string {
  return formatAppliedDisplayMoney(amount);
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
  installedBudgetBenchmark?: boolean;
}): string {
  const adjusted = String(input.rateSourceLabel || '').startsWith('Adjusted · ');
  // Installed local paint budgets display as pricing (not a soft-cost allowance).
  if (input.installedBudgetBenchmark) {
    return adjusted ? 'Adjusted pricing' : 'Suggested pricing';
  }
  if (input.lumpSumOnly) return adjusted ? 'Adjusted allowance' : 'Suggested allowance';
  if (input.isFallbackPricing) return adjusted ? 'Adjusted planning price' : 'Suggested planning price';
  if (input.mode === 'note_total_split' && !adjusted) return 'Budget split';
  if (input.isComparison) {
    if (/national\s*average\s*comparison/i.test(String(input.rateSourceLabel || ''))) {
      return 'National comparison';
    }
    return 'Suggested comparison';
  }
  return adjusted ? 'Adjusted pricing' : 'Suggested pricing';
}

export function resolveSuggestedActionType(input: {
  lumpSumOnly?: boolean;
  isFallbackPricing?: boolean;
  benchmarkAction?: string | null;
  hasCurrentPricing?: boolean;
}): SuggestedPricingActionType {
  if (input.benchmarkAction === 'comparison_only' || input.benchmarkAction === 'included_in_stage') {
    return 'apply_price';
  }
  if (input.hasCurrentPricing) return 'use_suggested';
  if (input.lumpSumOnly || input.benchmarkAction === 'benchmark_only') return 'apply_allowance';
  if (input.isFallbackPricing) return 'use_planning_price';
  return 'apply_price';
}

/** One CTA verb across ready / planning / allowance — status lives in the title/chip. */
export function suggestedActionLabel(actionType: SuggestedPricingActionType): string {
  switch (actionType) {
    case 'apply_allowance':
    case 'use_planning_price':
    case 'use_suggested':
    case 'apply_price':
    default:
      return 'Apply';
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
  if (block.installedBudgetBenchmark || block.splitSource === 'none') {
    return 'Installed source budget · material/labor not separated';
  }
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
  const line = buckets.map((b) => `${b.label} ${formatSuggestedComponentMoney(b.amount)}`).join(' · ');
  if (block.splitSource === 'estimated') {
    return `Estimated material/labor split · ${line}`;
  }
  return line;
}

export function formatInstalledBudgetQuantityLine(block: SuggestedPricingBlock): string | null {
  const living = Number(block.benchmarkLivingSf);
  if (Number.isFinite(living) && living > 0) {
    return `${Math.round(living).toLocaleString()} living SF · house match`;
  }
  return null;
}

export function formatSuggestedUnitRateLine(block: SuggestedPricingBlock): string | null {
  if (block.installedBudgetBenchmark) {
    // Implied $/paintable SF is display-only — price is the installed house budget.
    if (block.impliedUnitRateLabel) {
      return `Reference only · ${block.impliedUnitRateLabel.replace(/^Implied from\s+/i, '')}`;
    }
    const qty = block.basis?.quantity;
    if (qty && qty > 0) {
      const rate = block.total / qty;
      if (rate > 0 && Number.isFinite(rate)) {
        return `Reference only · ~$${rate.toFixed(2)}/paintable SF (does not set price)`;
      }
    }
    return null;
  }
  if (block.impliedUnitRateLabel) return block.impliedUnitRateLabel;
  const qty = block.basis?.quantity;
  const unit = block.basis?.unit;
  if (!(qty && qty > 0) || !unit) return null;
  if (block.lumpSumOnly) return null;
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
  /** User already has an entered/applied amount — show compact alternative, not "Needs …". */
  hasCurrentPricing?: boolean;
  /**
   * Force the one-line suggested row (soft-cost idle / collapsed Confirm Scope cards).
   * Keeps Apply allowance when no current amount is present.
   */
  forceCompact?: boolean;
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
  const hasCurrentPricing = Boolean(input.hasCurrentPricing);
  const presentation: 'full' | 'compact' =
    hasCurrentPricing || Boolean(input.forceCompact) ? 'compact' : 'full';
  const actionType = resolveSuggestedActionType({
    lumpSumOnly,
    isFallbackPricing,
    benchmarkAction: block.benchmarkAction,
    hasCurrentPricing,
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
  else if (/planning estimate|assumptions to review|review before bid|low|review|measurement/i.test(String(input.confidenceLabel || ''))) {
    pricingStatus = 'review_required';
  }

  const confidenceLevel = /planning estimate|(?:^|\s)low/i.test(String(input.confidenceLabel || ''))
    ? 'low'
    : /review before bid|(?:^|\s)medium/i.test(String(input.confidenceLabel || ''))
      ? 'medium'
      : /high confidence|(?:^|\s)high/i.test(String(input.confidenceLabel || ''))
        ? 'high'
        : null;

  let statusLine: string | null = null;
  let statusTone: 'amber' | 'neutral' = 'neutral';
  let allowanceExtraNote: string | null = null;

  const whyThisPriceLines: string[] = [];

  if (block.installedBudgetBenchmark) {
    statusTone = 'amber';
    statusLine =
      itemId === 'landscaping'
        ? 'Installed site package'
        : itemId === 'plumbing_trim' || itemId === 'electrical_trim'
          ? 'Installed fixture package'
          : 'Installed house budget';
    whyThisPriceLines.push(
      itemId === 'landscaping'
        ? 'Landscaping + walls/gates. Material and labor were not separated in the source.'
        : itemId === 'plumbing_trim' || itemId === 'electrical_trim'
          ? 'Fixture package. Material and labor were not separated in the source.'
          : 'House match budget (not × paintable SF). Material and labor were not separated in the source.'
    );
    if (block.comparisonRange) {
      allowanceExtraNote = `Local range: $${block.comparisonRange.low.toLocaleString()}–$${block.comparisonRange.high.toLocaleString()}`;
    }
  } else if (itemId === 'exterior_paint') {
    statusTone = 'amber';
    statusLine = 'Local exterior samples not verified';
  } else if (itemId === 'interior_trim' && block.splitSource === 'source') {
    statusTone = 'amber';
    statusLine = 'Needs detailed trim takeoff';
  } else if (lumpSumOnly) {
    statusTone = 'amber';
    if (itemId === 'permits') {
      statusLine = 'Confirm local permit fees';
      allowanceExtraNote = 'Water, sewer, fire, or utility fees may be separate.';
    } else if (itemId === 'plans_engineering') {
      statusLine = 'Planning allowance · Engineering/soils may be separate';
    } else if (itemId === 'cleanup') {
      statusLine = 'Planning allowance · Confirm locally';
    } else {
      statusLine = 'Planning allowance';
    }
  } else if (isFallbackPricing) {
    statusTone = 'amber';
    // One amber ask — title/hint stacks were duplicating this on Windows etc.
    statusLine =
      fallbackCopy?.hint || 'Add the correct measurement for more accurate pricing.';
  } else if (confidenceLevel === 'low') {
    statusTone = 'amber';
    statusLine = 'Local pricing not verified';
  } else if (input.confidenceLabel) {
    statusLine = String(input.confidenceLabel).trim();
  }

  // Current amount already exists — never show soft-cost “needs allowance” status.
  if (hasCurrentPricing && lumpSumOnly) {
    statusTone = 'neutral';
    statusLine = null;
    allowanceExtraNote = null;
  }

  const displayTotal = isAdjusted
    ? formatDraftMoney(block.total)
    : formatSuggestedDisplayMoney(block.total);

  const quantityLine = block.installedBudgetBenchmark
    ? formatInstalledBudgetQuantityLine(block)
    : isFallbackPricing || lumpSumOnly
      ? null
      : formatQuantityProvenanceLine({
          quantity: block.basis?.quantity,
          unit: block.basis?.unit,
          provenance: quantitySource === 'unknown' ? 'assumption' : quantitySource,
        });

  const fallbackBasisLine = isFallbackPricing ? formatFallbackBasisLine({ livingSf }) : null;
  const compactLine = formatCompactSuggestedLine(block.total);
  const unitRateLine = isFallbackPricing ? null : formatSuggestedUnitRateLine(block);

  if (fallbackBasisLine) whyThisPriceLines.push(fallbackBasisLine);
  if (pricingSource) whyThisPriceLines.push(pricingSource);
  if (allowanceExtraNote) whyThisPriceLines.push(allowanceExtraNote);
  if (unitRateLine && /reference only/i.test(unitRateLine)) {
    whyThisPriceLines.push(unitRateLine);
  }

  return {
    quantitySource: isFallbackPricing ? 'fallback' : quantitySource,
    pricingSource,
    pricingStatus: block.installedBudgetBenchmark ? 'ready' : pricingStatus,
    confidenceLevel,
    missingMeasurementKey: isFallbackPricing && !hasCurrentPricing ? itemId : null,
    isFallbackPricing,
    pricingBasisLabel: fallbackBasisLine,
    actionType,
    title: suggestedCardTitle({
      lumpSumOnly,
      isComparison: block.isComparison,
      mode: block.mode,
      rateSourceLabel: block.rateSourceLabel,
      isFallbackPricing,
      installedBudgetBenchmark: block.installedBudgetBenchmark,
    }),
    quantityLine,
    fallbackBasisLine,
    missingMeasurementTitle: null,
    missingMeasurementHint: null,
    displayTotal,
    splitLine:
      block.installedBudgetBenchmark || block.splitSource === 'none'
        ? formatSuggestedSplitLine(block)
        : lumpSumOnly
          ? 'Allowance · Flat amount'
          : formatSuggestedSplitLine(block),
    unitRateLine:
      unitRateLine && /reference only/i.test(unitRateLine) ? null : unitRateLine,
    sourceLine: pricingSource,
    statusLine,
    statusTone,
    actionLabel:
      block.benchmarkAction === 'comparison_only' || block.benchmarkAction === 'included_in_stage'
        ? null
        : suggestedActionLabel(actionType),
    allowanceExtraNote,
    whyThisPriceLines: [...new Set(whyThisPriceLines.filter(Boolean))],
    presentation,
    compactLine,
  };
}
