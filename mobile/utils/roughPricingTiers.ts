import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { getScopePackages } from '@/utils/estimateAiDraft';
import type {
  PriceRangeHint,
  PricingProposal,
  PricingScopeItemProposal,
} from '@/utils/estimateAiDraftPricing';
import { getCachedBenchmarkSuggestion } from '@/utils/benchmarkEngine';
import {
  getChecklistItemQuantityRuleOrDefault,
  getNationalAverageBudgetSplit,
  lookupRuleKeyForPackage,
  normalizeScopeMeasurements,
  PLACEHOLDER_ALLOWANCE_ITEM_IDS,
} from '@/utils/scopeItemQuantities';
import { getBuilderBudgetSoftCostAllowance } from '@/utils/southernUtahCalibratedRates';
import { scopePackageNeedsManualPrice } from '@/utils/estimateDraftReviewUi';
import { validateClientPricingUnits } from '@/utils/pricingUnitValidation';

export type RoughPricingTier = 'ready' | 'planning' | 'manual_only';

export const ROUGH_PRICING_UNAVAILABLE_COPY =
  'Rough pricing unavailable — enter amount manually';

export const ROUGH_PLANNING_COPY =
  'Rough planning estimate — verify scope and rates before applying';

/** Scopes that must never receive auto-applied rough pricing. */
const ALWAYS_MANUAL_ROUGH_KEYS = new Set([
  'contingency',
  'utility_taps',
  'utility_coordination',
  'overhead_profit',
  'general_conditions',
  'supervision',
  'survey',
  'mobilization',
  'emergency_fee',
  'final_inspections',
  'mirror_accessories',
  'plumbing_trim',
  'electrical_trim',
]);

/** Living-SF trade fallbacks that may show a planning midpoint + range. */
const PLANNING_RULE_KEYS = new Set([
  'sitework',
  'site_prep',
  'grading',
  'clearing',
  'excavation',
  'utility_trenching',
]);

const ROUGH_PLANNING_SOURCES =
  /national_trade_average|national_high_side_planning|ai_rough_estimate|ai_rough_estimate_fallback|regional_default/;

const SITE_STAGE_BLENDED_PER_LIVING_SF = 13.16494147017887;
const SITE_TRADE_PER_LIVING_SF = 5.5;

const UTILITY_TAPS_RANGE = { low: 3500, high: 12000 };
const CONTINGENCY_PER_LIVING_SF = { low: 1.6139444803098772, high: 5.850267096477089 };

function templateKeyForDraft(draft?: EstimateAiDraft | null): string | null {
  return (
    draft?.scopeChecklist?.templateKey ||
    draft?.estimateTier ||
    draft?.projectType ||
    null
  );
}

function packageHasRoughCatalogRate(
  pkg: Pick<EstimateDraftScopePackage, 'name' | 'scope'>,
  draft?: EstimateAiDraft | null
): boolean {
  const ruleKey = ruleKeyForScope(pkg.name, pkg.scope || '');
  return isRoughCatalogReadyKey(ruleKey, draft);
}

function isRoughCatalogReadyKey(
  ruleKey: string | null,
  draft?: EstimateAiDraft | null
): boolean {
  if (!ruleKey) return false;
  if (getNationalAverageBudgetSplit(ruleKey)) return true;
  return Boolean(getBuilderBudgetSoftCostAllowance(ruleKey, templateKeyForDraft(draft)));
}

function isManualOnlyRuleKey(
  ruleKey: string | null,
  draft?: EstimateAiDraft | null
): boolean {
  if (!ruleKey) return false;
  if (ALWAYS_MANUAL_ROUGH_KEYS.has(ruleKey)) return true;
  if (isRoughCatalogReadyKey(ruleKey, draft)) return false;
  if (
    (PLACEHOLDER_ALLOWANCE_ITEM_IDS as readonly string[]).includes(
      ruleKey as (typeof PLACEHOLDER_ALLOWANCE_ITEM_IDS)[number]
    )
  ) {
    return true;
  }
  const rule = getChecklistItemQuantityRuleOrDefault(ruleKey, templateKeyForDraft(draft));
  if (rule.lumpSumOnly && rule.requiresUserQuantity !== false) return true;
  return false;
}

function isPlanningRuleKey(ruleKey: string | null, scopeName: string): boolean {
  if (ruleKey && PLANNING_RULE_KEYS.has(ruleKey)) return true;
  return /\b(site\s*prep|sitework|grading|clearing|excavat|utility\s+trench)\b/i.test(scopeName);
}

function normalizeKey(name: string, scope = ''): string {
  return `${name} ${scope}`.trim().toLowerCase();
}

function packageKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

export function resolveDraftLivingSf(draft: EstimateAiDraft | null | undefined): number | null {
  if (!draft) return null;
  const measurements = normalizeScopeMeasurements(draft.scopeMeasurements);
  if (measurements.floorAreaSqft != null && measurements.floorAreaSqft > 0) {
    return Number(measurements.floorAreaSqft);
  }
  const fromPkg = getScopePackages(draft)
    .flatMap((pkg) => pkg.scopeQuantities || [])
    .find((q) => q.unit === 'sqft' && Number(q.quantity) > 0);
  return fromPkg?.quantity != null ? Number(fromPkg.quantity) : null;
}

function findDraftPackage(
  draft: EstimateAiDraft | null | undefined,
  scopeName: string
): EstimateDraftScopePackage | null {
  if (!draft) return null;
  const target = packageKey(scopeName);
  return (
    getScopePackages(draft).find((pkg) => packageKey(pkg.name) === target) || null
  );
}

function ruleKeyForScope(scopeName: string, scope = ''): string | null {
  const fromLookup = lookupRuleKeyForPackage(scopeName, scope);
  if (fromLookup) return fromLookup;
  const scopeNorm = String(scope || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (scopeNorm && /^[a-z0-9_]+$/.test(scopeNorm)) return scopeNorm;
  if (/\butility\s+taps?\b/i.test(scopeName)) return 'utility_taps';
  if (/\bcontingenc/i.test(scopeName)) return 'contingency';
  if (/\bsite\s*prep|\bsitework\b/i.test(scopeName)) return 'sitework';
  if (/\bmobil/i.test(scopeName)) return 'mobilization';
  if (/\bsurvey\b/i.test(scopeName)) return 'survey';
  if (/\boverhead|\bprofit\b/i.test(scopeName) && /\boverhead\b|\bprofit\b/i.test(scopeName)) {
    return 'overhead_profit';
  }
  return null;
}

function normalizeUnit(unit: string | null | undefined): string {
  const u = String(unit || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (u === 'sf' || u === 'square_feet') return 'sqft';
  if (u === 'allowance' || u === 'lump' || u === 'flat' || u === 'ls') return 'lump_sum';
  return u;
}

function catalogUnitMatchesItem(
  ruleKey: string | null,
  item: Pick<PricingScopeItemProposal, 'unit'>
): boolean {
  const avg = ruleKey ? getNationalAverageBudgetSplit(ruleKey) : null;
  if (!avg) return false;
  const avgUnit = normalizeUnit(avg.unit);
  const itemUnit = normalizeUnit(item.unit);
  if (avgUnit === 'lump_sum' || avgUnit === 'allowance') {
    return itemUnit === 'lump_sum' || itemUnit === 'allowance' || itemUnit === 'each';
  }
  return avgUnit === itemUnit;
}

export function itemUsesLivingSfFallback(
  item: Pick<PricingScopeItemProposal, 'scopeName' | 'quantity' | 'unit'>,
  draft: EstimateAiDraft | null | undefined
): boolean {
  const livingSf = resolveDraftLivingSf(draft);
  if (!livingSf || item.quantity == null) return false;
  if (normalizeUnit(item.unit) !== 'sqft') return false;
  if (Math.abs(Number(item.quantity) - livingSf) / livingSf > 0.02) return false;
  const ruleKey = ruleKeyForScope(item.scopeName);
  if (ruleKey && isManualOnlyRuleKey(ruleKey, draft)) return true;
  if (ruleKey && getNationalAverageBudgetSplit(ruleKey)?.unit === 'sqft') return false;
  if (ruleKey && isPlanningRuleKey(ruleKey, item.scopeName)) return false;
  return true;
}

function rangeFromTotal(total: number, unit = 'lump_sum'): PriceRangeHint {
  const low = Math.max(0, Math.round(total * 0.65));
  const high = Math.max(low + 1, Math.round(total * 1.35));
  return {
    unit,
    combinedTotal: { low, high },
  };
}

function siteworkPlanningRange(draft: EstimateAiDraft | null | undefined): PriceRangeHint | null {
  const livingSf = resolveDraftLivingSf(draft);
  if (!livingSf) return null;
  const cached = getCachedBenchmarkSuggestion('sitework');
  const stageTotal = cached?.blendedBenchmark?.total;
  if (stageTotal != null && stageTotal > 0) {
    return rangeFromTotal(stageTotal, 'sqft');
  }
  const low = Math.round(livingSf * SITE_TRADE_PER_LIVING_SF * 0.85);
  const high = Math.round(livingSf * SITE_STAGE_BLENDED_PER_LIVING_SF * 1.1);
  return { unit: 'sqft', combinedTotal: { low, high } };
}

function utilityTapsRange(): PriceRangeHint {
  return {
    unit: 'lump_sum',
    combinedTotal: { ...UTILITY_TAPS_RANGE },
  };
}

function contingencyRange(draft: EstimateAiDraft | null | undefined): PriceRangeHint | null {
  const livingSf = resolveDraftLivingSf(draft);
  if (!livingSf) {
    return { unit: 'lump_sum', combinedTotal: { low: 5000, high: 12704 } };
  }
  return {
    unit: 'lump_sum',
    combinedTotal: {
      low: Math.round(livingSf * CONTINGENCY_PER_LIVING_SF.low),
      high: Math.round(livingSf * CONTINGENCY_PER_LIVING_SF.high),
    },
  };
}

function benchmarkRangeForRuleKey(
  ruleKey: string | null,
  draft: EstimateAiDraft | null | undefined
): PriceRangeHint | null {
  if (!ruleKey) return null;
  if (ruleKey === 'utility_taps' || ruleKey === 'utility_coordination') return utilityTapsRange();
  if (ruleKey === 'contingency') return contingencyRange(draft);
  if (isPlanningRuleKey(ruleKey, ruleKey)) return siteworkPlanningRange(draft);
  return null;
}

function resolveManualOnlyRange(
  ruleKey: string | null,
  draft: EstimateAiDraft | null | undefined
): PriceRangeHint | null {
  return benchmarkRangeForRuleKey(ruleKey, draft);
}

function resolvePlanningRange(
  ruleKey: string | null,
  draft: EstimateAiDraft | null | undefined,
  pricedTotal: number,
  unit: string
): PriceRangeHint | null {
  const benchmark = benchmarkRangeForRuleKey(ruleKey, draft);
  if (benchmark) return benchmark;
  if (pricedTotal > 0) {
    return rangeFromTotal(pricedTotal, normalizeUnit(unit) || 'lump_sum');
  }
  return null;
}

function isReadyTier(
  item: PricingScopeItemProposal,
  pkg: Pick<EstimateDraftScopePackage, 'name' | 'scope'> | null,
  draft: EstimateAiDraft | null | undefined,
  ruleKey: string | null
): boolean {
  const hasRates = (item.proposedRates || []).some((r) => (r.total || 0) > 0);
  if (!hasRates || !pkg || !draft || !ruleKey) return false;
  if (!isRoughCatalogReadyKey(ruleKey, draft)) return false;
  if (itemUsesLivingSfFallback(item, draft)) return false;
  if (validateClientPricingUnits(item).blocked) return false;
  if (!catalogUnitMatchesItem(ruleKey, item)) return false;
  return true;
}

export function classifyUnpricedPackageTier(
  pkg: Pick<EstimateDraftScopePackage, 'name' | 'scope'>,
  draft?: EstimateAiDraft | null
): RoughPricingTier {
  const ruleKey = ruleKeyForScope(pkg.name, pkg.scope || '');
  if (isManualOnlyRuleKey(ruleKey, draft)) return 'manual_only';
  if (draft && isRoughCatalogReadyKey(ruleKey, draft)) return 'ready';
  if (isPlanningRuleKey(ruleKey, pkg.name)) return 'planning';
  const blob = normalizeKey(pkg.name, pkg.scope || '');
  if (/\b(site\s*prep|sitework|grading|clearing|excavat|utility\s+trench)\b/.test(blob)) {
    return 'planning';
  }
  return 'manual_only';
}

export function classifyRoughPricingItemTier(
  item: PricingScopeItemProposal,
  pkg: Pick<EstimateDraftScopePackage, 'name' | 'scope'> | null,
  draft: EstimateAiDraft | null | undefined
): RoughPricingTier {
  const ruleKey = ruleKeyForScope(item.scopeName, pkg?.scope || '');
  const hasRates = (item.proposedRates || []).some((r) => (r.total || 0) > 0);

  if (isManualOnlyRuleKey(ruleKey, draft)) return 'manual_only';
  if (itemUsesLivingSfFallback(item, draft) && !isPlanningRuleKey(ruleKey, item.scopeName)) {
    return 'manual_only';
  }
  if (validateClientPricingUnits(item).blocked) return 'manual_only';

  if (isReadyTier(item, pkg, draft, ruleKey)) return 'ready';

  if (!hasRates) {
    if (pkg && draft) return classifyUnpricedPackageTier(pkg, draft);
    return 'manual_only';
  }

  if (isPlanningRuleKey(ruleKey, item.scopeName)) return 'planning';

  const recSource = item.recommended?.source || item.proposedRates?.[0]?.source || '';
  if (hasRates && ROUGH_PLANNING_SOURCES.test(recSource)) {
    return 'planning';
  }

  return 'manual_only';
}

function stripItemRates(item: PricingScopeItemProposal): PricingScopeItemProposal {
  return {
    ...item,
    proposedRates: [],
    recommended: null,
    reviewStatus: 'needs_price',
    autoSelectEligible: false,
    pricingBlocked: false,
    priceRangeHint: undefined,
  };
}

function applyTierToItem(
  item: PricingScopeItemProposal,
  tier: RoughPricingTier,
  draft: EstimateAiDraft | null | undefined,
  ruleKey: string | null
): PricingScopeItemProposal {
  const pricedTotal = (item.proposedRates || []).reduce((s, r) => s + (r.total || 0), 0);

  if (tier === 'manual_only') {
    const manualRange = resolveManualOnlyRange(ruleKey, draft);
    const stripped = stripItemRates(item);
    return {
      ...stripped,
      roughPricingTier: tier,
      priceRangeHint: manualRange,
      warnings: [
        ...new Set([
          ...(item.warnings || []).filter(
            (w) => !/planning estimate|verify before billing/i.test(w)
          ),
          ROUGH_PRICING_UNAVAILABLE_COPY,
          manualRange
            ? 'Typical planning range shown for reference — enter your amount manually.'
            : 'Enter an allowance or get a sub quote for this scope.',
        ]),
      ],
    };
  }

  if (tier === 'planning') {
    const planningRange = resolvePlanningRange(
      ruleKey,
      draft,
      pricedTotal,
      item.unit
    );
    return {
      ...item,
      roughPricingTier: tier,
      reviewStatus: 'suggested_rough_price',
      autoSelectEligible: false,
      priceRangeHint: planningRange,
      warnings: [...new Set([...(item.warnings || []), ROUGH_PLANNING_COPY])],
      recommended: item.recommended
        ? {
            ...item.recommended,
            confidence: 'low',
            reason: ROUGH_PLANNING_COPY,
          }
        : item.recommended,
    };
  }

  return {
    ...item,
    roughPricingTier: tier,
    autoSelectEligible: true,
    reviewStatus: item.reviewStatus || 'suggested_rough_price',
    priceRangeHint: undefined,
    recommended: item.recommended
      ? { ...item.recommended, confidence: item.recommended.confidence || 'medium' }
      : item.recommended,
  };
}

/** Classify suggest-mode proposal items into ready / planning / manual-only tiers. */
export function applyRoughPricingTiers(
  proposal: PricingProposal,
  draft: EstimateAiDraft | null | undefined
): PricingProposal {
  if (proposal.pricingMode !== 'suggest' || !draft) return proposal;

  const existingKeys = new Set(
    (proposal.scopeItems || []).map((item) => packageKey(item.scopeName))
  );
  const missingItems: PricingScopeItemProposal[] = [];
  for (const pkg of getScopePackages(draft)) {
    if (!scopePackageNeedsManualPrice(pkg, draft)) continue;
    if (existingKeys.has(packageKey(pkg.name))) continue;
    const qty = pkg.scopeQuantities?.[0];
    missingItems.push({
      scopeItemId: packageKey(pkg.name).replace(/\s+/g, '_') || 'scope',
      scopeName: pkg.name,
      quantity: qty?.quantity ?? null,
      unit: qty?.unit ?? 'lump_sum',
      proposedRates: [],
      comparison: {},
      recommended: null,
      warnings: [],
    });
  }

  const scopeItems = [...(proposal.scopeItems || []), ...missingItems].map((item) => {
    const pkg = findDraftPackage(draft, item.scopeName);
    const ruleKey = ruleKeyForScope(item.scopeName, pkg?.scope || '');
    const tier = classifyRoughPricingItemTier(item, pkg, draft);
    return applyTierToItem(item, tier, draft, ruleKey);
  });

  const manualKeys = new Set(
    scopeItems
      .filter((item) => item.roughPricingTier === 'manual_only')
      .map((item) => packageKey(item.scopeName))
  );

  const lines = (proposal.lines || []).filter(
    (line) => !manualKeys.has(packageKey(line.packageName))
  );

  const totalSuggested = lines.reduce((s, l) => s + (l.total || 0), 0);

  return {
    ...proposal,
    lines,
    scopeItems,
    totalSuggested,
    empty: scopeItems.length === 0,
  };
}

export function countUnpricedRoughPricingTiers(draft: EstimateAiDraft | null | undefined): {
  unpriced: number;
  ready: number;
  planning: number;
  manualOnly: number;
  suggestable: number;
} {
  if (!draft) {
    return { unpriced: 0, ready: 0, planning: 0, manualOnly: 0, suggestable: 0 };
  }
  const unpricedPackages = getScopePackages(draft).filter((pkg) =>
    scopePackageNeedsManualPrice(pkg, draft)
  );
  let ready = 0;
  let planning = 0;
  let manualOnly = 0;
  for (const pkg of unpricedPackages) {
    const tier = classifyUnpricedPackageTier(pkg, draft);
    if (tier === 'ready') ready += 1;
    else if (tier === 'planning') planning += 1;
    else manualOnly += 1;
  }
  return {
    unpriced: unpricedPackages.length,
    ready,
    planning,
    manualOnly,
    suggestable: ready + planning,
  };
}
