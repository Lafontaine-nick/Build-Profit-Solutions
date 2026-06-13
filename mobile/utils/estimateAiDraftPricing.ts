import type { EstimateAiDraft, EstimateDraftScopePackage } from '@/utils/estimateAiDraft';
import { getScopePackages } from '@/utils/estimateAiDraft';
import {
  fetchPricingLibrary,
  fetchSuggestMissingPrices,
  pricingMemoryFetch,
  type MissingPriceSuggestion,
} from '@/utils/contractorPricingMemory';
import { loadSavedBidTemplates } from '@/utils/estimateSavedBidTemplates';
import { expandJobScopeDraft } from '@/utils/estimateDraftScopeSplit';
import {
  inferPlanningQuantityForPackage,
  lookupRuleKeyForPackage,
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
} from '@/utils/scopeItemQuantities';
import {
  APPROVAL_SUBTEXT,
  BLOCKED_PRICING_MESSAGE,
  isAutoSelectEligibleScope,
  isManualPricingScope,
  isNeedsApprovalScope,
  MANUAL_PRICING_NO_SOURCE_MESSAGE,
  suggestItemNeedsManualPricing,
  suggestItemPricingBlocked,
  suggestItemSelectable,
  validateClientPricingUnits,
} from '@/utils/pricingUnitValidation';
import { isNeedsApprovalScope as matrixNeedsApproval } from '@/utils/scopePricingMatrix';

export const SUGGESTED_PRICING_DISCLAIMER =
  'Suggested prices are planning estimates. Verify scope, material selections, labor rates, taxes, permits, overhead, and markup before sending to a client.';

export {
  APPROVAL_SUBTEXT,
  BLOCKED_PRICING_MESSAGE,
  MANUAL_PRICING_NO_SOURCE_MESSAGE,
  suggestItemNeedsManualPricing,
  suggestItemPricingBlocked,
  suggestItemSelectable,
  validateClientPricingUnits,
  isAutoSelectEligibleScope,
  isNeedsApprovalScope,
  isManualPricingScope,
} from '@/utils/pricingUnitValidation';

/** ZIP from bid fields or draft notes — supplier pricing requires this. */
export function resolvePricingZipCode(
  draft?: EstimateAiDraft | null,
  bid?: { zipCode?: string; customerZip?: string } | null
): string {
  const fromBid = String(bid?.zipCode || bid?.customerZip || '').trim();
  if (/^\d{5}(-\d{4})?$/.test(fromBid)) return fromBid.slice(0, 5);
  const draftZip = String((draft as { zipCode?: string })?.zipCode || '').trim();
  if (/^\d{5}(-\d{4})?$/.test(draftZip)) return draftZip.slice(0, 5);
  const notes = String(draft?.originalNotes || draft?.projectDescription || '');
  const labeled = notes.match(/\b(?:zip\s*(?:code)?|zipcode)\s*[:.]?\s*(\d{5})\b/i);
  if (labeled) return labeled[1];
  const bare = notes.match(/\b(\d{5})\b/);
  return bare ? bare[1] : '';
}

/** Keep in sync with backend FIXTURE_PLANNING_RATES + NATIONAL_TRADE_AVERAGES. */
const FIXTURE_PLANNING_RATES_LOCAL: Record<
  string,
  { material: number; labor: number; materialLabel: string; laborLabel: string }
> = {
  toilet: {
    material: 425,
    labor: 475,
    materialLabel: 'Toilet & rough-in materials',
    laborLabel: 'Toilet install labor',
  },
  vanity: {
    material: 950,
    labor: 650,
    materialLabel: 'Vanity & top materials',
    laborLabel: 'Vanity install labor',
  },
  shower_door: {
    material: 650,
    labor: 450,
    materialLabel: 'Shower door / enclosure materials',
    laborLabel: 'Shower door install labor',
  },
  tub: {
    material: 1200,
    labor: 850,
    materialLabel: 'Tub / surround materials',
    laborLabel: 'Tub install labor',
  },
  prefab_shower_pan: {
    material: 850,
    labor: 650,
    materialLabel: 'Prefab shower pan / base materials',
    laborLabel: 'Prefab shower pan install labor',
  },
  tile_shower_pan: {
    material: 450,
    labor: 1200,
    materialLabel: 'Tile shower pan materials (liner, drain, mud)',
    laborLabel: 'Tile shower pan / mud pan build labor',
  },
  shower_niche: {
    material: 275,
    labor: 450,
    materialLabel: 'Niche kit / backer / tile materials',
    laborLabel: 'Niche frame, waterproof & tile labor',
  },
  shower_bench: {
    material: 350,
    labor: 650,
    materialLabel: 'Bench / curb materials & tile',
    laborLabel: 'Bench / curb build & tile labor',
  },
  exhaust_fan: {
    material: 150,
    labor: 275,
    materialLabel: 'Exhaust fan & vent materials',
    laborLabel: 'Exhaust fan install labor',
  },
  mirror_accessories: {
    material: 125,
    labor: 175,
    materialLabel: 'Mirror & accessory materials',
    laborLabel: 'Mirror / accessory install labor',
  },
  lighting_fixture: {
    material: 200,
    labor: 275,
    materialLabel: 'Light fixture materials',
    laborLabel: 'Light fixture install labor',
  },
};

const NATIONAL_TRADE_AVERAGES_LOCAL: Record<
  string,
  { unit: string; material: number; labor: number; materialLabel: string; laborLabel: string }
> = {
  demo: { unit: 'sqft', material: 0.5, labor: 5, materialLabel: 'Demo materials allowance', laborLabel: 'Demo labor' },
  flooring: { unit: 'sqft', material: 4, labor: 5, materialLabel: 'Flooring material allowance', laborLabel: 'Flooring install labor' },
  baseboard: { unit: 'lf', material: 2, labor: 5, materialLabel: 'Baseboard material', laborLabel: 'Baseboard install labor' },
  bathroom: { unit: 'sqft', material: 45, labor: 85, materialLabel: 'Bathroom materials', laborLabel: 'Bathroom labor' },
  shower_waterproofing: {
    unit: 'sqft',
    material: 5,
    labor: 7,
    materialLabel: 'Backer board, membrane & prep materials',
    laborLabel: 'Waterproofing & backer board labor',
  },
  shower_tile: {
    unit: 'sqft',
    material: 8,
    labor: 14,
    materialLabel: 'Shower tile materials allowance',
    laborLabel: 'Shower tile install labor',
  },
  shower_full_package: {
    unit: 'sqft',
    material: 45,
    labor: 85,
    materialLabel: 'Full shower system materials',
    laborLabel: 'Full shower install labor',
  },
  kitchen: { unit: 'sqft', material: 55, labor: 95, materialLabel: 'Kitchen materials', laborLabel: 'Kitchen labor' },
  painting: { unit: 'sqft', material: 0.85, labor: 2.5, materialLabel: 'Paint materials', laborLabel: 'Painting labor' },
  plumbing: { unit: 'hour', material: 75, labor: 125, materialLabel: 'Plumbing materials', laborLabel: 'Plumber labor' },
  plumbing_service: { unit: 'hour', material: 75, labor: 125, materialLabel: 'Plumbing materials', laborLabel: 'Plumber labor' },
  electrical: { unit: 'hour', material: 45, labor: 95, materialLabel: 'Electrical materials', laborLabel: 'Electrician labor' },
  roofing: { unit: 'square', material: 350, labor: 450, materialLabel: 'Roofing materials', laborLabel: 'Roofing labor' },
  concrete: { unit: 'sqft', material: 4, labor: 6, materialLabel: 'Concrete materials', laborLabel: 'Concrete labor' },
  other: { unit: 'sqft', material: 35, labor: 50, materialLabel: 'Materials allowance', laborLabel: 'Labor' },
};

function resolveFixtureKindLocal(scopeName: string): string | null {
  const n = String(scopeName || '').toLowerCase();
  if (/shower\s+niche|\bniche\b/.test(n) && !/kitchen|counter/.test(n)) return 'shower_niche';
  if (/shower\s+bench|\bcurb\b/.test(n) && !/demolition|demo|removal/.test(n)) return 'shower_bench';
  if (/exhaust\s+fan|\bventilation\b/.test(n)) return 'exhaust_fan';
  if (/mirror|\bbath\s+accessories/.test(n)) return 'mirror_accessories';
  if (/\blighting|\blight\s+fixture/.test(n) && /\binstall/.test(n)) return 'lighting_fixture';
  if (/toilet/.test(n)) return 'toilet';
  if (/vanity/.test(n)) return 'vanity';
  if (/shower\s+door|glass\s+door|enclosure/.test(n)) return 'shower_door';
  if (/prefab\s+shower\s+pan|prefab\s+pan/.test(n)) return 'prefab_shower_pan';
  if (/tile\s+shower\s+pan|mud\s+pan/.test(n)) return 'tile_shower_pan';
  if (/\btub\b|bathtub/.test(n)) return 'tub';
  return null;
}

function isShowerWaterproofingPackage(name: string, scope = ''): boolean {
  const ns = `${name} ${scope}`.toLowerCase();
  if (/\b(full\s+wet|complete\s+shower|shower\s+system)\b/.test(ns)) return false;
  if (/\bwaterproofing\s*&\s*backer/i.test(ns)) return true;
  return /\b(waterproof|backer\s+board|hardie|cement\s+board|redgard|membrane|hydro\s*ban|kerdi)\b/i.test(ns);
}

function isShowerTilePackage(name: string, scope = ''): boolean {
  const ns = `${name} ${scope}`.toLowerCase();
  if (isShowerWaterproofingPackage(name, scope)) return false;
  return (
    /\b(shower\s+(wall|floor)\s+tile|shower\s+tile\s+(install|installation))\b/i.test(ns) ||
    (/\bshower\b/i.test(ns) &&
      /\btile\b/i.test(ns) &&
      /\b(install|installation|setting|grout)\b/i.test(ns) &&
      !/\b(demo|removal|waterproof|backer|membrane|redgard)\b/i.test(ns))
  );
}

function isShowerFullPackage(name: string, scope = ''): boolean {
  return /\b(full\s+wet\s+area|complete\s+shower|tile\s+shower\s+package|shower\s+system|wet\s+area\s+package)\b/i.test(
    `${name} ${scope}`.toLowerCase()
  );
}

function inferTradeFromPackage(pkg: EstimateDraftScopePackage, draft: EstimateAiDraft): string {
  const blob = `${pkg.name} ${pkg.scope || ''} ${draft.originalNotes || ''} ${draft.projectType || ''}`.toLowerCase();
  if (isShowerFullPackage(pkg.name, pkg.scope || '')) return 'shower_full_package';
  if (isShowerWaterproofingPackage(pkg.name, pkg.scope || '')) return 'shower_waterproofing';
  if (isShowerTilePackage(pkg.name, pkg.scope || '')) return 'shower_tile';
  const fixture = resolveFixtureKindLocal(pkg.name);
  if (fixture && /\binstall/.test(blob)) return 'bathroom_fixture';
  if (/\btile\s+shower\s+pan|\bmud\s+pan\b/.test(pkg.name.toLowerCase())) return 'bathroom_fixture';
  if (/\b(demo|removal|demolition)\b/.test(blob) || /\bdemo\b/i.test(pkg.name)) return 'demo';
  if (/\b(baseboard|trim|crown|molding)\b/.test(blob)) return 'baseboard';
  if (/\b(paint|painting)\b/.test(blob) && !/\b(floor|tile)\b/.test(blob)) return 'painting';
  if (/\b(plumb|faucet|toilet|sink)\b/.test(blob)) return 'plumbing';
  if (/\b(electric|outlet|panel)\b/.test(blob)) return 'electrical';
  if (/\b(roof|shingle)\b/.test(blob)) return 'roofing';
  if (/\b(concrete|slab|deck|patio)\b/.test(blob)) return 'concrete';
  if (/\b(kitchen|cabinet|counter)\b/.test(blob)) return 'kitchen';
  if (/\b(bath|shower|vanity)\b/.test(blob)) {
    if (isShowerWaterproofingPackage(pkg.name, pkg.scope || '')) return 'shower_waterproofing';
    if (isShowerTilePackage(pkg.name, pkg.scope || '')) return 'shower_tile';
    return 'bathroom';
  }
  if (/\b(tile|laminate|flooring|lvp|carpet)\b/.test(blob)) return 'flooring';
  if (draft.projectType === 'flooring') return 'flooring';
  if (draft.projectType === 'kitchen') return 'kitchen';
  if (draft.projectType === 'bathroom') return 'bathroom';
  return 'other';
}

export function isPricingRouteMissingError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '').toLowerCase();
  return (
    msg.includes('not found') ||
    msg.includes('route_not_found') ||
    msg.includes('http 404') ||
    msg.includes('cannot post') ||
    msg.includes('cannot get')
  );
}

export type PricingProposalLine = {
  packageName: string;
  lineType: 'material' | 'labor' | 'lump_sum';
  label: string;
  unitType: string;
  quantity: number | null;
  unitRate: number | null;
  total: number;
  formula: string;
  priceSource: string;
  sourceLabel: string;
  confidence: string;
  status: string;
  requiresApproval?: boolean;
};

export type PricingSourceComparisonRow = {
  rate: number;
  unit: string | null;
  summary: string;
};

export type PricingSourceComparison = {
  available: boolean;
  label: string;
  summary: string;
  rate?: number | null;
  unit?: string | null;
  material?: PricingSourceComparisonRow | null;
  labor?: PricingSourceComparisonRow | null;
};

export type PricingScopeItemProposal = {
  scopeItemId: string;
  scopeName: string;
  quantity: number | null;
  unit: string;
  proposedRates: Array<{
    label: string;
    pricingType: string;
    rate: number | null;
    unit: string | null;
    quantity: number | null;
    total: number | null;
    formula: string | null;
    source: string;
    confidence: string;
    assumptions: string[];
    requiresApproval: boolean;
  }>;
  comparison: Record<string, PricingSourceComparison>;
  recommended: {
    source: string;
    sourceLabel: string;
    reason: string;
    confidence: string;
    sourceType?: string;
    sourceName?: string;
    disclaimerText?: string;
  } | null;
  warnings: string[];
  requiresConfirmBeforeApply?: boolean;
  reviewStatus?: PricingReviewStatus;
  classification?: ScopePricingClassification;
  priceRangeHint?: PriceRangeHint | null;
  pricingBlocked?: boolean;
  autoSelectEligible?: boolean;
  unitMismatchSubtext?: string | null;
  approvalSubtext?: string | null;
};

export type PricingReviewStatus =
  | 'confirmed'
  | 'needs_price'
  | 'needs_approval'
  | 'suggested_rough_price'
  | 'high_price_warning'
  | 'unit_mismatch'
  | 'scope_mismatch'
  | 'manual_review_required';

export type ScopePricingClassification = {
  tradeCategory: string;
  pricingCategory: string;
  scopeType: 'project' | 'assembly' | 'subScope' | 'materialOnly' | 'laborOnly' | 'serviceCall' | 'allowance';
  pricingUnit: string;
  complexity: 'low' | 'standard' | 'high' | 'unknown';
  includedWork?: string[];
  excludedWork?: string[];
};

export type PriceRangeHint = {
  unit: string;
  combinedPerUnit?: { low: number; typical: number; high: number };
  combinedTotal?: { low: number; high: number };
};

function scopeItemBlob(item: Pick<PricingScopeItemProposal, 'scopeName'> & { scope?: string }) {
  return `${item.scopeName || ''} ${(item as { scope?: string }).scope || ''}`.toLowerCase();
}

export function suggestItemIsManualOnly(item: PricingScopeItemProposal): boolean {
  return isManualPricingScope(item);
}

export function suggestItemNeedsApproval(item: PricingScopeItemProposal): boolean {
  return item.reviewStatus === 'needs_approval' || matrixNeedsApproval(item);
}

export function suggestItemNeedsPricing(item: PricingScopeItemProposal): boolean {
  return suggestItemNeedsManualPricing(item);
}

const SAVED_BID_TEMPLATE_SOURCES = new Set([
  'saved_pricing',
  'saved_template',
  'pricing_history',
  'company_default',
]);

const ROUGH_PLANNING_SOURCES = new Set([
  'national_trade_average',
  'supplier_pricing',
  'ai_rough_estimate',
  'ai_rough_estimate_fallback',
  'regional_default',
]);

export function suggestItemUsesSavedBidOrTemplate(item: PricingScopeItemProposal): boolean {
  const rates = (item.proposedRates || []).filter((r) => (r.total || 0) > 0);
  if (!rates.length) return false;
  return rates.every((r) => SAVED_BID_TEMPLATE_SOURCES.has(r.source));
}

/** National / vendor / AI planning prices — show bright, unchecked by default. */
export function suggestItemIsRoughPlanningItem(item: PricingScopeItemProposal): boolean {
  if (!scopeItemHasSavedRates(item)) return false;
  if (suggestItemUsesSavedBidOrTemplate(item)) return false;
  const rec = item.recommended?.source;
  if (rec && ROUGH_PLANNING_SOURCES.has(rec)) return true;
  const rates = (item.proposedRates || []).filter((r) => (r.total || 0) > 0);
  return rates.some((r) => ROUGH_PLANNING_SOURCES.has(r.source));
}

export function suggestItemDefaultIncluded(item: PricingScopeItemProposal): boolean {
  if (suggestItemPricingBlocked(item)) return false;
  if (!suggestItemSelectable(item)) return false;
  if (item.reviewStatus === 'needs_approval') return false;
  if (isNeedsApprovalScope(item)) return false;
  if (item.requiresConfirmBeforeApply) return false;
  if (
    item.reviewStatus === 'unit_mismatch' ||
    item.reviewStatus === 'scope_mismatch' ||
    item.reviewStatus === 'manual_review_required'
  ) {
    return false;
  }
  if (suggestItemIsManualOnly(item)) return false;

  if (suggestItemUsesSavedBidOrTemplate(item)) return true;

  if (item.autoSelectEligible === true) return true;
  if (item.autoSelectEligible === false) return false;
  return isAutoSelectEligibleScope(item);
}

/** Saved template/bid + auto-select rough estimates start checked; needs-approval stays unchecked. */
export function defaultIncludedSuggestScopeIds(items: PricingScopeItemProposal[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    if (suggestItemDefaultIncluded(item)) ids.add(item.scopeItemId);
  }
  return ids;
}

export function filterProposalToScopeItems(
  proposal: PricingProposal,
  includedIds: Set<string>
): PricingProposal {
  const scopeItems = (proposal.scopeItems || []).filter(
    (item) => includedIds.has(item.scopeItemId) && suggestItemSelectable(item)
  );
  const lines = scopeItemsToProposalLines(scopeItems);
  const totalSuggested = lines.reduce((s, l) => s + (l.total || 0), 0);
  return normalizePricingProposal({
    ...proposal,
    scopeItems,
    lines,
    totalSuggested,
    empty: lines.length === 0,
  });
}

export function countValidSelectedSuggestItems(
  scopeItems: PricingScopeItemProposal[] | undefined,
  includedIds: Set<string>
): number {
  let n = 0;
  for (const item of scopeItems || []) {
    if (includedIds.has(item.scopeItemId) && suggestItemSelectable(item)) n += 1;
  }
  return n;
}

export function sumValidSelectedSuggestTotal(
  scopeItems: PricingScopeItemProposal[] | undefined,
  includedIds: Set<string>
): number {
  let sum = 0;
  for (const item of scopeItems || []) {
    if (!includedIds.has(item.scopeItemId) || !suggestItemSelectable(item)) continue;
    sum += (item.proposedRates || []).reduce((s, r) => s + (r.total || 0), 0);
  }
  return sum;
}

export function confidenceVisual(confidence: string | undefined): { label: string; color: string; bg: string } {
  if (confidence === 'high') {
    return { label: 'High confidence', color: '#22c55e', bg: 'rgba(34,197,94,0.14)' };
  }
  if (confidence === 'low') {
    return { label: 'Low confidence', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' };
  }
  return { label: 'Medium confidence', color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' };
}

export type PricingProposal = {
  empty: boolean;
  source: 'saved_pricing' | 'saved_template' | 'ai_rough_estimate' | 'manual';
  sourceLabel: string;
  lines: PricingProposalLine[];
  totalSuggested: number;
  message?: string | null;
  assumptions?: string[];
  disclaimer?: string;
  scopeItems?: PricingScopeItemProposal[];
  warnings?: string[];
  anyRealSource?: boolean;
  anyFallbackOnly?: boolean;
  engine?: boolean;
  primarySource?: string;
  templateCount?: number;
  supplierZip?: string;
  supplierZipIsFallback?: boolean;
  supplierZipSource?: 'bid' | 'draft' | 'notes' | 'default';
  /** saved_only = template/library lookup only; suggest = rough prices with HD + national */
  pricingMode?: 'saved_only' | 'suggest';
  requiresConfirmBeforeApply?: boolean;
  canApplyWithoutConfirm?: boolean;
};

export const PRICING_SOURCE_LABELS: Record<string, string> = {
  user_provided: 'Manual',
  saved_pricing: 'Saved bid',
  saved_template: 'Saved template',
  company_default: 'Vendor',
  supplier_pricing: 'Vendor',
  national_trade_average: 'National Average',
  regional_labor_benchmark: 'Regional',
  construction_cost_database: 'Regional',
  ai_rough_estimate_fallback: 'AI rough',
  manually_entered: 'Manual',
  pricing_history: 'Saved bid',
  ai_rough_estimate: 'AI rough',
};

export function sourceDisplayLabel(source: string): string {
  return PRICING_SOURCE_LABELS[source] || source.replace(/_/g, ' ');
}

export function sourceBadgeColor(source: string): string {
  if (source === 'saved_pricing' || source === 'pricing_history' || source === 'saved_template') {
    return '#60a5fa';
  }
  if (source === 'national_trade_average' || source === 'regional_labor_benchmark') return '#a78bfa';
  if (source === 'supplier_pricing' || source === 'company_default') return '#34d399';
  if (source === 'ai_rough_estimate_fallback' || source === 'ai_rough_estimate') return '#fbbf24';
  return '#94a3b8';
}

export type SourceVisual = {
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
};

export function sourceVisual(source: string, mode: 'saved' | 'suggest' = 'saved'): SourceVisual {
  if (source === 'saved_template') {
    return {
      label: mode === 'suggest' ? 'Saved template' : 'Saved template',
      shortLabel: 'Template',
      color: '#60a5fa',
      bg: 'rgba(96,165,250,0.14)',
    };
  }
  if (source === 'saved_pricing' || source === 'pricing_history') {
    return {
      label: mode === 'suggest' ? 'Saved Pricing' : 'Saved bid',
      shortLabel: mode === 'suggest' ? 'Saved' : 'Bid',
      color: '#60a5fa',
      bg: 'rgba(96,165,250,0.14)',
    };
  }
  if (source === 'manually_entered' || source === 'user_provided') {
    return {
      label: 'Manual',
      shortLabel: 'Manual',
      color: '#94a3b8',
      bg: 'rgba(148,163,184,0.14)',
    };
  }
  if (source === 'supplier_pricing') {
    return {
      label: mode === 'suggest' ? 'Vendor Live' : 'Vendor',
      shortLabel: 'Vendor',
      color: '#34d399',
      bg: 'rgba(52,211,153,0.14)',
    };
  }
  if (source === 'company_default') {
    return {
      label: mode === 'suggest' ? 'Saved Pricing' : 'Vendor',
      shortLabel: 'Saved',
      color: '#60a5fa',
      bg: 'rgba(96,165,250,0.14)',
    };
  }
  if (source === 'regional_labor_benchmark' || source === 'construction_cost_database') {
    return {
      label: 'Regional Labor',
      shortLabel: 'Regional',
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.14)',
    };
  }
  if (source === 'national_trade_average') {
    return {
      label: 'National Average',
      shortLabel: 'National',
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.14)',
    };
  }
  if (source === 'ai_rough_estimate_fallback' || source === 'ai_rough_estimate') {
    return {
      label: 'AI Rough',
      shortLabel: 'AI Rough',
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.14)',
    };
  }
  const label = sourceDisplayLabel(source);
  const color = sourceBadgeColor(source);
  return { label, shortLabel: label.split(' ')[0], color, bg: `${color}22` };
}

export function isLumpSumUnit(unit: string | null | undefined): boolean {
  const u = String(unit || '')
    .trim()
    .toLowerCase();
  return u === 'lump_sum' || u === 'lump' || u === 'lot' || u === 'flat';
}

export function scopeItemHasSavedRates(item: PricingScopeItemProposal): boolean {
  return (item.proposedRates || []).some((r) => (r.total || 0) > 0);
}

export function countSavedPricingScopeItems(proposal: PricingProposal | null): {
  priced: number;
  needsPricing: number;
  total: number;
} {
  const items = proposal?.scopeItems || [];
  let priced = 0;
  let needsPricing = 0;
  for (const item of items) {
    if (scopeItemHasSavedRates(item)) priced += 1;
    else if ((item.warnings?.length ?? 0) > 0) needsPricing += 1;
  }
  return { priced, needsPricing, total: items.length };
}

function roundProposalMoney(n: number): number {
  return Math.round(Number(n) || 0);
}

function formatProposalUnitRate(rate: number, unit: string | null): string {
  const rounded = Math.round(rate * 100) / 100;
  const display = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2);
  return `$${display}/${formatDisplayUnit(unit) || 'unit'}`;
}

/** User-facing unit labels (internal storage stays lowercase, e.g. lf). */
export function formatDisplayUnit(unit: string | null | undefined): string {
  if (!unit) return '';
  const key = unit.trim().toLowerCase();
  if (key === 'lf') return 'LF';
  if (key === 'sqft' || key === 'sf') return 'sqft';
  if (key === 'hr' || key === 'hour' || key === 'hours') return 'hr';
  if (key === 'lump_sum') return 'lump sum';
  return unit;
}

export function comparisonMaterialDetail(
  row: PricingSourceComparison | undefined
): PricingSourceComparisonRow | null {
  if (!row?.available) return null;
  if (row.material) return row.material;
  if (row.rate != null) {
    return { rate: row.rate, unit: row.unit ?? null, summary: row.summary };
  }
  return null;
}

function scopeItemsToProposalLines(scopeItems: PricingScopeItemProposal[]): PricingProposalLine[] {
  return scopeItems.flatMap((it) =>
    (it.proposedRates || []).map((p) => ({
      packageName: it.scopeName,
      lineType:
        p.pricingType === 'material' ? 'material' : p.pricingType === 'lump_sum' ? 'lump_sum' : 'labor',
      label: p.label,
      unitType: p.unit || it.unit,
      quantity: p.quantity,
      unitRate: p.rate,
      total: p.total || 0,
      formula: p.formula,
      priceSource: p.source,
      sourceLabel: sourceDisplayLabel(p.source),
      confidence: p.confidence,
      status:
        p.source === 'ai_rough_estimate_fallback' ? 'rough_price' : 'pricing_memory_suggested',
      requiresApproval: p.requiresApproval !== false,
    }))
  );
}

function linesToScopeItems(lines: PricingProposalLine[]): PricingScopeItemProposal[] {
  const byPkg = new Map<string, PricingProposalLine[]>();
  for (const line of lines) {
    const list = byPkg.get(line.packageName) || [];
    list.push(line);
    byPkg.set(line.packageName, list);
  }
  return [...byPkg.entries()].map(([scopeName, pkgLines]) => {
    const source = pkgLines[0]?.priceSource || 'saved_pricing';
    return {
      scopeItemId: normalizePackageKey(scopeName).replace(/\s+/g, '_') || 'scope',
      scopeName,
      quantity: pkgLines[0]?.quantity ?? null,
      unit: pkgLines[0]?.unitType ?? 'lump_sum',
      proposedRates: pkgLines.map((line) => ({
        label: line.label,
        pricingType: line.lineType,
        rate: line.unitRate,
        unit: line.unitType,
        quantity: line.quantity,
        total: line.total,
        formula: line.formula,
        source: line.priceSource,
        confidence: line.confidence,
        assumptions: line.sourceLabel ? [line.sourceLabel] : [],
        requiresApproval: line.requiresApproval !== false,
      })),
      comparison: {},
      recommended: {
        source,
        sourceLabel: sourceDisplayLabel(source),
        reason: 'Matched from saved pricing.',
        confidence: 'medium',
      },
      warnings: [],
    };
  });
}

/** Ensure lines/scopeItems arrays exist and stay in sync for modal + apply. */
export function proposalHasSavedRates(proposal: PricingProposal | null | undefined): boolean {
  if (!proposal) return false;
  const lines = proposal.lines || [];
  if (lines.some((l) => (l.total || 0) > 0)) return true;
  return (proposal.scopeItems || []).some((item) =>
    (item.proposedRates || []).some((r) => (r.total || 0) > 0)
  );
}

function inferPrimarySource(
  lines: PricingProposalLine[],
  scopeItems: PricingScopeItemProposal[]
): PricingProposal['primarySource'] {
  const sources = new Set<string>();
  for (const line of lines) {
    if (line.priceSource) sources.add(line.priceSource);
  }
  for (const item of scopeItems) {
    if (item.recommended?.source) sources.add(item.recommended.source);
    for (const rate of item.proposedRates || []) {
      if (rate.source) sources.add(rate.source);
    }
  }
  if (sources.has('saved_template')) return 'saved_template';
  if (sources.has('saved_pricing') || sources.has('pricing_history')) return 'saved_pricing';
  if (sources.has('company_default')) return 'company_default';
  return undefined;
}

export function emptyPricingProposal(
  overrides: Partial<PricingProposal> = {}
): PricingProposal {
  return {
    empty: true,
    source: 'saved_pricing',
    sourceLabel: '',
    lines: [],
    totalSuggested: 0,
    scopeItems: [],
    ...overrides,
  };
}

function cleanupTemplateRateValid(
  scopeName: string,
  scope: string,
  rate: { label?: string; source?: string; total?: number | null; rate?: number | null; unit?: string | null }
): boolean {
  if (rate.source !== 'saved_template' && rate.source !== 'saved_pricing') return true;
  const label = `${rate.label || ''}`.toLowerCase();
  if (
    !/\b(cleanup|disposal|dumpster|haul[\s-]?off|final\s+clean|jobsite\s+clean|permits?|inspection)\b/i.test(
      label
    )
  ) {
    return false;
  }
  const amount = rate.total ?? rate.rate ?? 0;
  if (isLumpSumUnit(rate.unit || 'lump_sum') && amount > 0 && amount < 50) return false;
  return true;
}

function filterScopeItemSavedRates(item: PricingScopeItemProposal): PricingScopeItemProposal {
  if (!isCloseoutScopePackage(item.scopeName, '')) return item;
  const proposedRates = (item.proposedRates || []).filter((r) =>
    cleanupTemplateRateValid(item.scopeName, '', r)
  );
  if (proposedRates.length === (item.proposedRates || []).length) return item;
  return {
    ...item,
    proposedRates,
    recommended: proposedRates.length ? item.recommended : null,
    warnings: proposedRates.length ? item.warnings : ['Needs manual pricing — no reliable source found.'],
  };
}

function waterproofingRateInvalid(rate: { pricingType?: string; rate?: number | null }): boolean {
  if (rate.pricingType === 'material' && (rate.rate ?? 0) >= 25) return true;
  if (rate.pricingType === 'labor' && (rate.rate ?? 0) >= 40) return true;
  return false;
}

function applyClientUnitValidation(item: PricingScopeItemProposal): PricingScopeItemProposal {
  if (item.pricingBlocked) {
    return {
      ...item,
      proposedRates: [],
      autoSelectEligible: false,
      recommended: null,
    };
  }
  const check = validateClientPricingUnits(item);
  if (!check.blocked) return item;
  return {
    ...item,
    proposedRates: [],
    pricingBlocked: true,
    autoSelectEligible: false,
    warnings: [...new Set([...(item.warnings || []), ...check.warnings])],
    unitMismatchSubtext: check.unitMismatchSubtext ?? item.unitMismatchSubtext ?? null,
    reviewStatus: 'needs_price',
    recommended: null,
  };
}

function enrichScopeItemValidation(item: PricingScopeItemProposal): PricingScopeItemProposal {
  const unitValidated = applyClientUnitValidation(item);
  if (unitValidated.pricingBlocked) return unitValidated;
  if (unitValidated.reviewStatus && unitValidated.classification) return unitValidated;
  if (!isShowerWaterproofingPackage(unitValidated.scopeName)) return unitValidated;
  return enrichWaterproofingScopeItem(unitValidated);
}

function enrichWaterproofingScopeItem(item: PricingScopeItemProposal): PricingScopeItemProposal {
  if (!isShowerWaterproofingPackage(item.scopeName)) return item;
  const proposedRates = (item.proposedRates || []).filter((r) => !waterproofingRateInvalid(r));
  const warnings = [...(item.warnings || [])];
  let requiresConfirmBeforeApply = item.requiresConfirmBeforeApply || false;
  const qty = item.quantity || 1;
  const matRate = proposedRates.find((r) => r.pricingType === 'material')?.rate ?? 0;
  const labRate = proposedRates.find((r) => r.pricingType === 'labor')?.rate ?? 0;
  const perSqft = matRate + labRate;
  const total = proposedRates.reduce(
    (s, r) => s + (r.total ?? (r.rate ?? 0) * (r.quantity ?? qty)),
    0
  );
  const pushWarn = (msg: string) => {
    if (!warnings.includes(msg)) warnings.push(msg);
  };
  if (perSqft > 25) {
    pushWarn(
      'This rate appears high for backer board + waterproofing only. Confirm this is not a full shower tile package.'
    );
  }
  const savedSources = ['saved_template', 'saved_pricing', 'company_default'];
  if (
    proposedRates.some((r) => savedSources.includes(r.source)) &&
    perSqft > 17
  ) {
    pushWarn('This saved rate looks high for this scope. Review before applying.');
  }
  if (total > 2500) {
    pushWarn('Total exceeds $2,500 for waterproofing/backer board only — verify scope.');
  }
  if (total > 5000) {
    requiresConfirmBeforeApply = true;
    pushWarn('Total exceeds $5,000 — confirm this is not a full shower package before applying.');
  }
  return {
    ...item,
    proposedRates,
    warnings,
    requiresConfirmBeforeApply,
    reviewStatus: requiresConfirmBeforeApply ? 'manual_review_required' : perSqft > 25 ? 'scope_mismatch' : item.reviewStatus,
  };
}

export function reviewStatusVisual(status: PricingReviewStatus | undefined): {
  label: string;
  color: string;
  bg: string;
} | null {
  switch (status) {
    case 'needs_price':
      return {
        label: MANUAL_PRICING_NO_SOURCE_MESSAGE,
        color: '#fbbf24',
        bg: 'rgba(251,191,36,0.14)',
      };
    case 'needs_approval':
      return { label: 'Needs approval', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' };
    case 'suggested_rough_price':
      return { label: 'Planning estimate', color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' };
    case 'high_price_warning':
      return { label: 'High price warning', color: '#fb923c', bg: 'rgba(251,146,60,0.14)' };
    case 'unit_mismatch':
      return {
        label: BLOCKED_PRICING_MESSAGE,
        color: '#f87171',
        bg: 'rgba(248,113,113,0.14)',
      };
    case 'scope_mismatch':
      return { label: 'Scope mismatch', color: '#f87171', bg: 'rgba(248,113,113,0.14)' };
    case 'manual_review_required':
      return { label: 'Manual review', color: '#f87171', bg: 'rgba(248,113,113,0.14)' };
    case 'confirmed':
      return { label: 'Confirmed', color: '#22c55e', bg: 'rgba(34,197,94,0.14)' };
    default:
      return null;
  }
}

export function getPricingConfirmMessage(proposal: PricingProposal): string | null {
  const flagged = (proposal.scopeItems || []).filter((item) => item.requiresConfirmBeforeApply);
  if (flagged.length === 0 && !proposal.requiresConfirmBeforeApply) return null;
  const names = flagged.map((i) => i.scopeName).slice(0, 3);
  const suffix = flagged.length > 3 ? ` and ${flagged.length - 3} more` : '';
  return `Pricing for ${names.join(', ')}${suffix} may not match scope (rate too high or wrong assembly). Confirm before applying.`;
}

/** @deprecated use getPricingConfirmMessage */
export function getWaterproofingConfirmMessage(proposal: PricingProposal): string | null {
  return getPricingConfirmMessage(proposal);
}

export function normalizePricingProposal(
  proposal: PricingProposal | null | undefined
): PricingProposal {
  if (!proposal) return emptyPricingProposal();
  let lines = normalizeLumpSumLines(proposal.lines || []).filter((line) => {
    if (!isCloseoutScopePackage(line.packageName, '')) return true;
    return cleanupTemplateRateValid(line.packageName, '', {
      label: line.label,
      source: line.priceSource,
      total: line.total,
      rate: line.unitRate,
      unit: line.unitType,
    });
  });
  let scopeItems = normalizeLumpSumScopeItems(proposal.scopeItems || [])
    .map(filterScopeItemSavedRates)
    .map(enrichScopeItemValidation);
  if (scopeItems.length && !lines.length) {
    lines = scopeItemsToProposalLines(scopeItems);
  } else if (!scopeItems.length && lines.length) {
    scopeItems = linesToScopeItems(lines);
  }
  const totalSuggested = lines.reduce((s, l) => s + (l.total || 0), 0);
  const hasRates = proposalHasSavedRates({ ...proposal, lines, scopeItems, totalSuggested });
  const primarySource =
    proposal.primarySource && proposal.primarySource !== 'ai_rough_estimate_fallback'
      ? proposal.primarySource
      : inferPrimarySource(lines, scopeItems) || proposal.primarySource;
  return {
    ...proposal,
    lines,
    scopeItems,
    totalSuggested,
    empty: !hasRates,
    anyRealSource: hasRates,
    primarySource,
    requiresConfirmBeforeApply:
      proposal.requiresConfirmBeforeApply ||
      scopeItems.some((i) => i.requiresConfirmBeforeApply),
  };
}

/** Swap recommended material rate between HD Live and National Average for one scope item. */
export function setScopeMaterialSource(
  proposal: PricingProposal,
  scopeItemId: string,
  materialSource: 'supplier_pricing' | 'national_trade_average'
): PricingProposal {
  if (!proposal.scopeItems?.length) return proposal;

  const scopeItems = proposal.scopeItems.map((item) => {
    if (item.scopeItemId !== scopeItemId) return item;
    const existingMat = item.proposedRates.find((r) => r.pricingType === 'material');
    const laborRates = item.proposedRates.filter((r) => r.pricingType !== 'material');
    const detail = comparisonMaterialDetail(item.comparison?.[materialSource]);
    if (!detail?.rate) return item;

    const qty =
      existingMat?.quantity ?? (item.quantity != null && item.quantity > 0 ? item.quantity : null);
    const unit = detail.unit || existingMat?.unit || item.unit;
    const total =
      qty != null && qty > 0 ? roundProposalMoney(detail.rate * qty) : existingMat?.total ?? null;
    const formula =
      total != null && qty != null && unit
        ? `${qty.toLocaleString()} ${unit} × ${formatProposalUnitRate(detail.rate, unit)} = $${total.toLocaleString()}`
        : existingMat?.formula ?? null;

    const newMat = {
      label: existingMat?.label || `${item.scopeName} material`,
      pricingType: 'material',
      rate: detail.rate,
      unit,
      quantity: qty,
      total,
      formula,
      source: materialSource,
      confidence: materialSource === 'supplier_pricing' ? 'medium' : 'low',
      assumptions: existingMat?.assumptions || [],
      requiresApproval: true,
    };

    const laborSource = laborRates[0]?.source;
    const recommendedSource =
      materialSource === 'supplier_pricing' && laborSource === 'national_trade_average'
        ? 'supplier_pricing'
        : materialSource;

    return {
      ...item,
      proposedRates: [newMat, ...laborRates],
      recommended: item.recommended
        ? {
            ...item.recommended,
            source: recommendedSource,
            sourceLabel: sourceDisplayLabel(recommendedSource),
            reason:
              materialSource === 'supplier_pricing'
                ? 'Live Home Depot material selected for the bid.'
                : 'National average material selected for the bid.',
          }
        : null,
    };
  });

  const lines = scopeItemsToProposalLines(scopeItems);
  return {
    ...proposal,
    scopeItems,
    lines,
    totalSuggested: lines.reduce((s, l) => s + (l.total || 0), 0),
  };
}

/** Edit material or labor unit rate on one scope card; recalculates totals. */
export function updateScopeProposedRate(
  proposal: PricingProposal,
  scopeItemId: string,
  pricingType: 'material' | 'labor',
  rate: number
): PricingProposal {
  if (!proposal.scopeItems?.length || !Number.isFinite(rate) || rate < 0) return proposal;

  const scopeItems = proposal.scopeItems.map((item) => {
    if (item.scopeItemId !== scopeItemId) return item;
    const proposedRates = (item.proposedRates || []).map((line) => {
      const lineType = line.pricingType === 'material' ? 'material' : 'labor';
      if (lineType !== pricingType) return line;
      const qty =
        line.quantity != null && line.quantity > 0
          ? line.quantity
          : item.quantity != null && item.quantity > 0
            ? item.quantity
            : null;
      const unit = line.unit || item.unit;
      const total =
        qty != null && qty > 0 ? roundProposalMoney(rate * qty) : line.total ?? null;
      const formula =
        total != null && qty != null && unit
          ? `${qty.toLocaleString()} ${formatDisplayUnit(unit)} × ${formatProposalUnitRate(rate, unit)} = $${total.toLocaleString()}`
          : line.formula ?? null;
      return {
        ...line,
        rate,
        quantity: qty,
        total,
        formula,
        requiresApproval: true,
      };
    });
    return { ...item, proposedRates };
  });

  const lines = scopeItemsToProposalLines(scopeItems);
  return normalizePricingProposal({
    ...proposal,
    scopeItems,
    lines,
    totalSuggested: lines.reduce((s, l) => s + (l.total || 0), 0),
  });
}

export function proposalUsesSavedPricing(proposal: PricingProposal | null): boolean {
  if (!proposal) return false;
  if (proposal.primarySource === 'saved_pricing' || proposal.primarySource === 'saved_template') {
    return true;
  }
  return (proposal.scopeItems || []).some(
    (item) =>
      item.recommended?.source === 'saved_pricing' || item.recommended?.source === 'saved_template'
  );
}

async function fetchEngineProposal(
  draft: EstimateAiDraft,
  options: {
    mode: 'suggest' | 'saved_only';
    savedTemplates?: unknown[];
    projectLocation?: string;
    zipCode?: string;
  }
): Promise<PricingProposal | null> {
  const body = {
    draft,
    mode: options.mode,
    savedTemplates: options.savedTemplates || [],
    projectLocation: options.projectLocation || draft.projectAddress || '',
    zipCode: options.zipCode || resolvePricingZipCode(draft) || '',
  };
  try {
    const res = await pricingMemoryFetch<{
      proposal?: PricingProposal;
      engine?: { scopeItems: PricingScopeItemProposal[] };
    }>('/proposal', { method: 'POST', body: JSON.stringify(body) }, { apiPath: '/api/pricing-engine' });
    const proposal = res.proposal;
    const engineItems = res.engine?.scopeItems;
    const engineHasRates = (engineItems || []).some((item) =>
      (item.proposedRates || []).some((r) => (r.total || 0) > 0)
    );
    if (proposal && !proposal.empty) {
      proposal.pricingMode = options.mode;
      if (res.engine?.supplierZip) {
        proposal.supplierZip = res.engine.supplierZip;
        proposal.supplierZipIsFallback = res.engine.supplierZipIsFallback;
        proposal.supplierZipSource = res.engine.supplierZipSource;
      }
      if (!proposal.scopeItems?.length && engineItems?.length) {
        proposal.scopeItems = engineItems;
      }
      return normalizePricingProposal(proposal);
    }
    if (engineHasRates && engineItems?.length) {
      return normalizePricingProposal({
        empty: false,
        source: 'ai_rough_estimate',
        sourceLabel: 'National Average',
        lines: [],
        scopeItems: engineItems,
        totalSuggested: 0,
        pricingMode: options.mode,
        supplierZip: res.engine?.supplierZip,
        supplierZipIsFallback: res.engine?.supplierZipIsFallback,
        supplierZipSource: res.engine?.supplierZipSource,
      });
    }
  } catch (err) {
    if (!isPricingRouteMissingError(err)) throw err;
  }
  const legacyPath =
    options.mode === 'saved_only' ? '/saved-pricing-proposal' : '/rough-pricing-proposal';
  try {
    const res = await pricingMemoryFetch<{ proposal?: PricingProposal }>(legacyPath, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.proposal && !res.proposal.empty) return res.proposal;
  } catch (err) {
    if (!isPricingRouteMissingError(err)) throw err;
  }
  return null;
}

async function resolveSavedBidTemplates(savedTemplates: unknown[]): Promise<unknown[]> {
  if (savedTemplates?.length) return savedTemplates;
  try {
    return await loadSavedBidTemplates();
  } catch {
    return [];
  }
}

type SavedTemplateRecord = {
  name?: string;
  payload?: {
    laborLineItems?: Record<string, unknown>[];
    materialLineItems?: Record<string, unknown>[];
  };
};

function lineText(line: Record<string, unknown>): string {
  return `${line.name || ''} ${line.description || ''}`.toLowerCase();
}

function isDemoLine(line: Record<string, unknown>): boolean {
  return /\b(demo|demolition|removal|tear\s*out)\b/.test(lineText(line));
}

function isDemoPackage(name: string): boolean {
  return /\b(demo|demolition|removal)\b/i.test(name);
}

function isCloseoutScopePackage(name: string, scope = ''): boolean {
  const blob = `${name} ${scope}`.trim();
  return isCleanupPackage(name) || isPermitsPackage(name) || isCleanupPackage(blob) || isPermitsPackage(blob);
}

function pickPackageQuantity(
  pkg: EstimateDraftScopePackage,
  originalNotes = '',
  draft?: EstimateAiDraft | null
): { quantity: number; unit: string } | null {
  const scopeText = pkg.scope || '';
  if (isCloseoutScopePackage(pkg.name, scopeText)) {
    return { quantity: 1, unit: 'lump_sum' };
  }

  let qs = pkg.scopeQuantities || [];
  if (!qs.length && draft?.scopePackages?.length) {
    const fromScopePkg = draft.scopePackages.find((p) => p.name === pkg.name);
    if (fromScopePkg?.scopeQuantities?.length) qs = fromScopePkg.scopeQuantities;
  }
  if (!qs.length && draft?.rooms?.length) {
    const fromRoom = draft.rooms.find((r) => r.name === pkg.name);
    if (fromRoom?.scopeQuantities?.length) qs = fromRoom.scopeQuantities;
  }
  if (!qs.length) {
    qs = extractScopeQuantitiesForPackage(pkg.name, pkg.scope || '', originalNotes);
  }
  const n = pkg.name.toLowerCase();
  if (/baseboard|trim/.test(n)) {
    const lf = qs.find((q) => q.unit === 'lf');
    if (lf) return { quantity: lf.quantity, unit: 'lf' };
  }
  const sqft = qs.find((q) => q.unit === 'sqft');
  if (sqft) return { quantity: sqft.quantity, unit: 'sqft' };
  const each = qs.find((q) => q.unit === 'each');
  if (each) return { quantity: each.quantity, unit: 'each' };
  const lump = qs.find((q) => q.unit === 'lump_sum');
  if (lump) return { quantity: 1, unit: 'lump_sum' };

  if (draft) {
    const ruleKey = lookupRuleKeyForPackage(pkg.name, pkg.scope || '');
    if (ruleKey) {
      const resolved = resolveChecklistItemQuantity(
        ruleKey,
        normalizeScopeMeasurements(draft.scopeMeasurements)
      );
      if (resolved.pricingReady && resolved.quantity != null && resolved.quantity > 0) {
        return { quantity: resolved.quantity, unit: resolved.unit };
      }
    }
    const planning = inferPlanningQuantityForPackage(pkg.name, pkg.scope || '', draft);
    if (planning && planning.quantity > 0) {
      return planning;
    }
  }

  if (/cleanup|disposal|haul|permits?|plumb|electrical\s+trim/i.test(n)) {
    return { quantity: 1, unit: 'lump_sum' };
  }
  if (/tub\s+install|prefab\s+shower|shower\s+pan|mud\s+pan|toilet|vanity|glass\s+shower/i.test(n)) {
    return { quantity: 1, unit: 'each' };
  }
  return null;
}

function normalizeLineUnit(raw: unknown): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/** Flat / lump-sum amount from a saved bid line (template or library). */
export function savedLumpSumAmount(line: Record<string, unknown>, scopeName = ''): number | null {
  const lt = String(line.name || line.description || '').toLowerCase();
  const explicit = Number(
    line.saved_lump_sum_amount ?? line.savedLumpSumAmount ?? line.lumpTotal ?? 0
  );
  if (Number.isFinite(explicit) && explicit > 0) return roundMoney(explicit);

  const mode = String(line.mode || line.pricingMode || '').toLowerCase();
  const unit = normalizeLineUnit(line.unit);
  const flatUnits = new Set(['lot', 'lump_sum', 'lump', 'flat', 'job', 'project', 'total']);
  const isFlat =
    mode === 'flat' || mode === 'lump' || mode === 'lump_sum' || flatUnits.has(unit);
  if (!isFlat) return null;

  if (isCleanupPackage(scopeName) && !/\b(cleanup|disposal|dumpster|haul|final\s+clean)\b/i.test(lt)) {
    return null;
  }

  const total = Number(line.total || 0);
  if (total > 0) {
    if (isCleanupPackage(scopeName) && total < 50) return null;
    return roundMoney(total);
  }

  const qty = Number(line.quantity || line.qty || 0) || 0;
  const unitPrice = Number(line.unitPrice ?? line.rate ?? line.cost ?? 0);
  if (qty <= 1 && unitPrice > 0) {
    if (isCleanupPackage(scopeName) && unitPrice < 50) return null;
    return roundMoney(unitPrice);
  }
  return null;
}

function normalizeLumpSumScopeItems(
  scopeItems: PricingScopeItemProposal[]
): PricingScopeItemProposal[] {
  return scopeItems.map((item) => {
    const itemIsLump = isLumpSumUnit(item.unit);
    let proposedRates = (item.proposedRates || []).map((line) => {
      const lineIsLump =
        itemIsLump || isLumpSumUnit(line.unit) || line.pricingType === 'lump_sum';
      if (!lineIsLump) return line;

      const lump =
        (line.total != null && line.total > 0
          ? line.total
          : savedLumpSumAmount({
              total: line.total,
              unitPrice: line.rate,
              unit: line.unit,
              mode: 'lump_sum',
            })) ?? null;

      if (lump == null || lump <= 0) {
        return { ...line, rate: null, total: null, unit: 'lump_sum' };
      }

      return {
        ...line,
        pricingType:
          line.pricingType === 'material' || line.pricingType === 'labor'
            ? line.pricingType
            : 'lump_sum',
        rate: null,
        unit: 'lump_sum',
        quantity: 1,
        total: lump,
        formula: `$${formatMoney(lump)} lump sum`,
      };
    });

    const hasValidTotal = proposedRates.some((r) => (r.total || 0) > 0);
    if (itemIsLump && !hasValidTotal) {
      proposedRates = [];
      return {
        ...item,
        proposedRates,
        warnings:
          item.warnings?.length > 0
            ? item.warnings
            : ['No saved lump sum amount found.'],
      };
    }

    return { ...item, proposedRates };
  });
}

function normalizeLumpSumLines(lines: PricingProposalLine[]): PricingProposalLine[] {
  return lines.map((line) => {
    if (!isLumpSumUnit(line.unitType) && line.lineType !== 'lump_sum') return line;
    const lump =
      (line.total != null && line.total > 0 ? line.total : savedLumpSumAmount({
        total: line.total,
        unitPrice: line.unitRate,
        unit: line.unitType,
        mode: 'lump_sum',
      })) ?? null;
    if (lump == null || lump <= 0) return { ...line, unitRate: 0, total: 0 };
    return {
      ...line,
      lineType: 'lump_sum',
      unitType: 'lump_sum',
      quantity: 1,
      unitRate: 0,
      total: lump,
      formula: `$${formatMoney(lump)} lump sum`,
    };
  });
}

function templateLineUnitRate(line: Record<string, unknown>, scopeUnit: string): number | null {
  const mode = String(line.mode || line.pricingMode || '').toLowerCase();
  if (mode === 'flat' || mode === 'lump_sum' || mode === 'lump') return null;

  const qty = Number(line.quantity || line.qty || 0) || 0;
  let rate = Number(line.unitPrice ?? line.rate ?? line.cost ?? 0);
  if (rate <= 0 && qty > 1 && Number(line.total) > 0) {
    rate = Number(line.total) / qty;
  }
  if (rate <= 0) return null;

  if (mode === 'sqft' || mode === 'lf' || mode === 'hourly' || mode === 'hr') {
    if (mode === 'sqft' && scopeUnit !== 'sqft') return null;
    if (mode === 'lf' && scopeUnit !== 'lf') return null;
    if (scopeUnit === 'sqft' && rate > 200) return null;
    if (scopeUnit === 'lf' && rate > 100) return null;
    return rate;
  }

  const unit = normalizeLineUnit(line.unit);
  const flatUnits = new Set(['lot', 'lump_sum', 'lump', 'flat', 'job', 'project', 'total']);
  if (flatUnits.has(unit)) return null;
  if (qty <= 1 && (unit === '' || unit === 'lot') && Number(line.total) > 0) {
    if (rate <= 0 || Math.abs(rate - Number(line.total)) < 1) return null;
  }

  if (scopeUnit === 'sqft' && (unit.includes('sq') || unit === 'sf')) {
    return rate < 500 ? rate : null;
  }
  if (scopeUnit === 'lf' && (unit.includes('lf') || unit.includes('linear'))) {
    return rate < 200 ? rate : null;
  }
  if (qty > 1 && rate > 0) {
    if (scopeUnit === 'sqft' && unit.includes('sq') && rate < 500) return rate;
    if (scopeUnit === 'lf' && unit.includes('lf') && rate < 200) return rate;
  }
  return null;
}

function packageWorkType(name: string): 'demo' | 'install' {
  if (isDemoPackage(name)) return 'demo';
  return 'install';
}

function lineWorkType(line: Record<string, unknown>, source: 'labor' | 'material'): 'demo' | 'install' {
  const lt = lineText(line);
  if (/\b(demo|demolition|removal|tear\s*out)\b/.test(lt)) return 'demo';
  if (/\b(install|installation|installing)\b/.test(lt)) return 'install';
  if (source === 'material' && !/\b(demo|removal)\b/.test(lt)) return 'install';
  if (/\btile\b/.test(lt) && !/\b(demo|removal|demolition)\b/.test(lt)) return 'install';
  return 'install';
}

function isCleanupPackage(name: string): boolean {
  return /\b(cleanup|disposal|dumpster|haul[\s-]?off|jobsite\s+clean|final\s+clean)\b/i.test(name);
}

function isPermitsPackage(name: string): boolean {
  return /\bpermits?\b|\binspection\s+fees?\b/i.test(name);
}

function templateLineMatchesCloseoutPackage(
  pkgName: string,
  line: Record<string, unknown>
): boolean {
  const lt = lineText(line);
  if (isCleanupPackage(pkgName)) {
    return /\b(cleanup|disposal|dumpster|haul[\s-]?off|final\s+clean|jobsite\s+clean)\b/i.test(lt);
  }
  if (isPermitsPackage(pkgName)) {
    return /\bpermits?\b|\binspection\s+fees?\b/i.test(lt);
  }
  return false;
}

function isWaterproofingPackageName(name: string): boolean {
  return isShowerWaterproofingPackage(name);
}

function scoreTemplateLineToPackage(
  pkg: EstimateDraftScopePackage,
  line: Record<string, unknown>,
  source: 'labor' | 'material'
): number {
  const pkgDemo = isDemoPackage(pkg.name);
  const lineDemo = isDemoLine(line);
  if (pkgDemo !== lineDemo) return 0;
  if (pkgDemo && source !== 'labor') return 0;

  const pkgWork = packageWorkType(pkg.name);
  const lineWork = lineWorkType(line, source);
  if (pkgWork === 'demo' && lineWork !== 'demo') return 0;
  if (pkgWork === 'install' && lineWork === 'demo') return 0;

  const pn = pkg.name.toLowerCase();
  const lt = lineText(line);
  if (isCleanupPackage(pkg.name) || isPermitsPackage(pkg.name)) {
    return templateLineMatchesCloseoutPackage(pkg.name, line) ? 45 : 0;
  }
  if (isWaterproofingPackageName(pn)) {
    if (
      /\b(waterproof|backer|hardie|cement\s+board|redgard|membrane|hydro\s*ban|kerdi|wedi|goboard|densshield|tape|thinset)\b/i.test(
        lt
      )
    ) {
      if (/\btile\s+install|\binstall.*\btile\b/.test(lt) && !/\b(waterproof|backer|redgard|membrane)\b/.test(lt)) {
        return 0;
      }
      return 40;
    }
    return 0;
  }
  if (isShowerTilePackage(pn)) {
    if (lineDemo) return 0;
    if (/\btile\b/.test(lt) && !/\b(waterproof|backer|redgard|membrane|demo|removal)\b/.test(lt)) {
      return /\b(install|installation|grout|thinset|setting)\b/.test(lt) || source === 'material' ? 38 : 36;
    }
    return 0;
  }
  if (/baseboard|trim/.test(pn)) {
    return /baseboard|trim/.test(lt) ? 30 : 0;
  }
  if (/laminate|flooring|lvp/.test(pn) && !pkgDemo) {
    if (lineDemo) return 0;
    if (/\btile\b/.test(lt) && !/laminate|lvp|vinyl|flooring/.test(lt)) return 0;
    return /laminate|flooring|lvp|vinyl/.test(lt) ? 25 : 0;
  }
  if (pkgDemo && lineDemo) return 40;
  if (/\btile\b/.test(pn) && /\b(install|installation)\b/.test(pn) && !pkgDemo) {
    if (lineDemo) return 0;
    if (/\btile\b/.test(lt) && /\b(install|installation|installing)\b/.test(lt)) return 42;
    if (/\btile\b/.test(lt) && !/\b(demo|removal|demolition)\b/.test(lt)) {
      return source === 'material' ? 30 : 28;
    }
    return 0;
  }
  if (pkgDemo && lineDemo) return 40;
  if (/\btile\b/.test(pn) && !/laminate|lvp|vinyl|flooring/.test(pn)) {
    if (lineDemo) return 0;
    if (/\btile\b/.test(lt) && !/laminate|lvp|vinyl|flooring/.test(lt)) {
      if (source === 'material') return /tile/.test(lt) ? 28 : 0;
      return /install|tile/.test(lt) ? 28 : 0;
    }
  }
  return 0;
}

function expandDraftForPricingMatch(draft: EstimateAiDraft): EstimateAiDraft {
  return expandJobScopeDraft(draft, { aggressive: true });
}

function libraryEntryMatchesPackage(
  pkgName: string,
  entry: { scopeItemName: string; category?: string },
  role: 'material' | 'labor'
): boolean {
  const pkg = pkgName.toLowerCase();
  const text = `${entry.scopeItemName} ${entry.category || ''}`.toLowerCase();
  const pkgDemo = /\b(demo|demolition|removal|gut|tear)\b/.test(pkg);
  const entryDemo = /\b(demo|demolition|removal|tear)\b/.test(text);
  if (pkgDemo !== entryDemo && !(pkgDemo && entryDemo)) {
    if (pkgDemo && !entryDemo) return false;
    if (!pkgDemo && entryDemo && !/\binstall\b/.test(pkg)) return false;
  }

  const entryMat =
    entry.category === 'material' || /\bmaterial|allowance|supply\b/.test(text);
  if (role === 'material' && !entryMat) return false;
  if (role === 'labor' && entryMat) return false;

  if (/\blaminate|lvp|vinyl\b/.test(pkg) && /\btile\b/.test(text) && !/\blaminate|lvp|vinyl\b/.test(text)) {
    return false;
  }
  if (/\bshower\b/.test(pkg) && /\bvanity\b/.test(text) && !/\bshower\b/.test(text)) return false;
  if (/\bvanity\b/.test(pkg) && /\bshower\b/.test(text) && !/\bvanity\b/.test(text)) return false;

  const tokens = pkg.replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((t) => t.length > 2);
  if (pkgDemo && entryDemo) return tokens.some((t) => text.includes(t)) || /demo|tile|bath|kitchen/.test(text);
  return tokens.filter((t) => text.includes(t)).length >= 1;
}

function mergeProposalsLibraryFirst(
  library: PricingProposal,
  templates: PricingProposal
): PricingProposal {
  const linesByPkg = new Map<string, PricingProposalLine[]>();

  for (const line of library.lines) {
    const list = linesByPkg.get(line.packageName) || [];
    list.push(line);
    linesByPkg.set(line.packageName, list);
  }

  const templateNames = new Set<string>();
  for (const line of templates.lines) {
    const existing = linesByPkg.get(line.packageName) || [];
    const hasMat = existing.some((l) => l.lineType === 'material');
    const hasLab = existing.some((l) => l.lineType === 'labor');
    if (line.lineType === 'material' && hasMat) continue;
    if (line.lineType === 'labor' && hasLab) continue;
    if (existing.length && line.lineType === 'lump_sum') continue;
    existing.push(line);
    linesByPkg.set(line.packageName, existing);
    if (line.sourceLabel?.includes('template')) {
      const m = line.sourceLabel.match(/template:?\s*(.+)/i);
      if (m) templateNames.add(m[1].trim());
    }
  }

  const lines = [...linesByPkg.values()].flat();
  const fromLibrary = library.lines.length > 0;
  const fromTemplate = templates.lines.length > 0 && lines.length > library.lines.length;

  let sourceLabel = 'Saved pricing';
  if (fromLibrary && fromTemplate) {
    sourceLabel = `Pricing library + saved bid template${templateNames.size ? ` (${[...templateNames].join(', ')})` : ''}`;
  } else if (fromLibrary) {
    sourceLabel = library.sourceLabel || 'Based on your past approved bids';
  } else if (fromTemplate) {
    sourceLabel = templates.sourceLabel || 'Saved bid template';
  }

  return {
    empty: lines.length === 0,
    source: fromLibrary ? 'saved_pricing' : 'saved_template',
    sourceLabel,
    lines,
    totalSuggested: lines.reduce((s, l) => s + l.total, 0),
    templateCount: templates.templateCount,
    anyRealSource: lines.length > 0,
    engine: false,
    assumptions: [
      ...(library.assumptions || []),
      ...(fromTemplate ? ['Unmatched lines filled from saved bid template(s).'] : []),
    ],
  };
}

async function buildSavedPricingProposalHybrid(
  draft: EstimateAiDraft,
  templates: unknown[]
): Promise<PricingProposal> {
  const fromLibrary = await buildSavedPricingProposalLocal(draft);
  if (!templates?.length) return fromLibrary;
  const fromTemplates = buildSavedPricingProposalFromTemplates(draft, templates);
  if (fromLibrary.empty) return fromTemplates;
  if (fromTemplates.empty) return fromLibrary;
  return mergeProposalsLibraryFirst(fromLibrary, fromTemplates);
}

function packageKeysMatch(a: string, b: string): boolean {
  const ka = normalizePackageKey(a);
  const kb = normalizePackageKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  return ka.includes(kb) || kb.includes(ka);
}

/** Match draft room names (e.g. Tile Flooring) to proposal packages (e.g. Tile Removal / Tile Installation). */
function roomMatchesProposalPackage(roomName: string, packageName: string): boolean {
  if (packageKeysMatch(roomName, packageName)) return true;
  const room = normalizePackageKey(roomName);
  const pkg = normalizePackageKey(packageName);
  if (/\btile\b/.test(room) && /\b(floor|flooring)\b/.test(room) && /\btile\b/.test(pkg)) {
    return true;
  }
  if (/\bbaseboard\b/.test(room) && /\b(baseboard|trim)\b/.test(pkg)) {
    return true;
  }
  if (/\b(floor|flooring|laminate|lvp)\b/.test(room) && /\b(floor|flooring|laminate|lvp)\b/.test(pkg)) {
    return true;
  }
  return false;
}

function indexProposalLinesByRoom(
  rooms: Array<{ name: string }>,
  lines: PricingProposalLine[]
): Map<string, PricingProposalLine[]> {
  const byRoom = new Map<string, PricingProposalLine[]>();
  const used = new Set<number>();

  for (const room of rooms) {
    const matched: PricingProposalLine[] = [];
    lines.forEach((line, i) => {
      if (used.has(i)) return;
      if (line.packageName === room.name || roomMatchesProposalPackage(room.name, line.packageName)) {
        matched.push(line);
        used.add(i);
      }
    });
    if (matched.length) byRoom.set(room.name, matched);
  }
  return byRoom;
}

function linesForPackageName(
  linesByPkg: Map<string, PricingProposalLine[]>,
  packageName: string
): PricingProposalLine[] {
  const direct = linesByPkg.get(packageName);
  if (direct?.length) return direct;
  const key = normalizePackageKey(packageName);
  const byKey = linesByPkg.get(key);
  if (byKey?.length) return byKey;
  for (const [pkgKey, list] of linesByPkg.entries()) {
    if (packageKeysMatch(pkgKey, packageName)) return list;
  }
  return [];
}

function deviceLinesForScopeName(
  deviceLines: PricingProposalLine[],
  scopeName: string
): PricingProposalLine[] {
  const direct = deviceLines.filter((l) => l.packageName === scopeName);
  if (direct.length) return direct;
  return deviceLines.filter((l) => packageKeysMatch(l.packageName, scopeName));
}

/** Fill gaps when the pricing engine matched only some scope packages (e.g. demo but not install). */
function mergeEngineProposalWithTemplates(
  engine: PricingProposal,
  device: PricingProposal
): PricingProposal {
  if (!engine.scopeItems?.length || device.empty) return engine;

  const linesByPkg = new Map<string, PricingProposalLine[]>();
  const addLine = (pkgName: string, line: PricingProposalLine) => {
    const key = normalizePackageKey(pkgName) || pkgName;
    const existing = linesForPackageName(linesByPkg, pkgName);
    const hasMat = existing.some((l) => l.lineType === 'material');
    const hasLab = existing.some((l) => l.lineType === 'labor');
    if (line.lineType === 'material' && hasMat) return;
    if (line.lineType === 'labor' && hasLab) return;
    if (existing.length && line.lineType === 'lump_sum') return;
    const list = linesByPkg.get(key) || [];
    list.push({ ...line, packageName: pkgName });
    linesByPkg.set(key, list);
  };

  for (const line of engine.lines || []) {
    addLine(line.packageName, line);
  }
  for (const line of device.lines || []) {
    addLine(line.packageName, line);
  }

  const lines = [...linesByPkg.values()].flat();

  const scopeItems = engine.scopeItems.map((item) => {
    const hasTemplateRates = (item.proposedRates || []).some((r) => r.source === 'saved_template');
    if (hasTemplateRates && item.comparison?.saved_template?.available) return item;

    const fromDevice = deviceLinesForScopeName(device.lines, item.scopeName);
    const pkgLines = linesForPackageName(linesByPkg, item.scopeName);
    if (!fromDevice.length && !pkgLines.length) return item;

    const mergeLines = fromDevice.length ? fromDevice : pkgLines;
    const proposedRates = mergeLines.map((line) => ({
      label: line.label,
      pricingType: line.lineType,
      rate: line.unitRate,
      unit: line.unitType,
      quantity: line.quantity,
      total: line.total,
      formula: line.formula,
      source: 'saved_template' as const,
      confidence: line.confidence,
      assumptions: [line.sourceLabel],
      requiresApproval: true,
    }));

    const templateTotal = mergeLines.reduce((s, l) => s + l.total, 0);
    return {
      ...item,
      comparison: {
        ...item.comparison,
        saved_template: {
          available: true,
          label: 'Saved Bid Template',
          summary: `${formatMoney(templateTotal)} total`,
          rate: mergeLines[0]?.unitRate ?? null,
          unit: mergeLines[0]?.unitType,
        },
      },
      recommended: {
        source: 'saved_template',
        sourceLabel: 'Saved Bid Template',
        reason: 'Matched rates from a saved bid template.',
        confidence: 'medium',
      },
      proposedRates,
      warnings: [],
    };
  });

  return normalizePricingProposal({
    ...engine,
    scopeItems,
    lines,
    totalSuggested: lines.reduce((s, l) => s + l.total, 0),
    anyRealSource: lines.length > 0,
    primarySource: 'saved_template',
    message: null,
    assumptions: [
      ...(engine.assumptions || []),
      ...(device.lines.length > engine.lines.length
        ? ['Some lines were matched on-device from your saved bid template.']
        : []),
    ],
  });
}

/** Ensure modal comparison cards reflect saved_template lines (e.g. tile install) even when API omitted them. */
function patchScopeItemsFromTemplateLines(proposal: PricingProposal): PricingProposal {
  const templateLines = (proposal.lines || []).filter((l) => l.priceSource === 'saved_template');
  if (!templateLines.length) return proposal;

  const items = [...(proposal.scopeItems || [])];
  const byPkg = new Map<string, PricingProposalLine[]>();
  for (const line of templateLines) {
    const list = byPkg.get(line.packageName) || [];
    list.push(line);
    byPkg.set(line.packageName, list);
  }

  for (const [pkgName, pkgLines] of byPkg) {
    const mergeLines = pkgLines;
    const templateTotal = mergeLines.reduce((s, l) => s + l.total, 0);
    const proposedRates = mergeLines.map((line) => ({
      label: line.label,
      pricingType: line.lineType,
      rate: line.unitRate,
      unit: line.unitType,
      quantity: line.quantity,
      total: line.total,
      formula: line.formula,
      source: 'saved_template' as const,
      confidence: line.confidence,
      assumptions: [line.sourceLabel],
      requiresApproval: true,
    }));

    const idx = items.findIndex((it) => packageKeysMatch(it.scopeName, pkgName));
    if (idx >= 0) {
      const item = items[idx];
      const hasRates = (item.proposedRates || []).some((r) => r.formula || (r.rate != null && r.rate > 0));
      if (hasRates) continue;
      items[idx] = {
        ...item,
        comparison: {
          ...item.comparison,
          saved_template: {
            available: true,
            label: 'Saved Bid Template',
            summary: `${formatMoney(templateTotal)} total`,
            rate: mergeLines[0]?.unitRate ?? null,
            unit: mergeLines[0]?.unitType,
          },
        },
        recommended: {
          source: 'saved_template',
          sourceLabel: 'Saved Bid Template',
          reason: 'Matched rates from a saved bid template.',
          confidence: 'medium',
        },
        proposedRates,
        warnings: [],
      };
    } else {
      items.push({
        scopeItemId: normalizePackageKey(pkgName).replace(/\s+/g, '_'),
        scopeName: pkgName,
        quantity: mergeLines[0]?.quantity ?? null,
        unit: mergeLines[0]?.unitType ?? 'sqft',
        proposedRates,
        comparison: {
          saved_pricing: { available: false, label: 'Saved Pricing', summary: 'not found' },
          saved_template: {
            available: true,
            label: 'Saved Bid Template',
            summary: `${formatMoney(templateTotal)} total`,
            rate: mergeLines[0]?.unitRate ?? null,
            unit: mergeLines[0]?.unitType,
          },
          company_default: { available: false, label: 'Company Default', summary: 'not found' },
        },
        recommended: {
          source: 'saved_template',
          sourceLabel: 'Saved Bid Template',
          reason: 'Matched rates from a saved bid template.',
          confidence: 'medium',
        },
        warnings: [],
      });
    }
  }

  return normalizePricingProposal({
    ...proposal,
    scopeItems: items,
    primarySource: 'saved_template',
  });
}

const SQFT_QTY_RE =
  /\b(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|sq\s*ft|square\s*feet|ft\.?\s*²|ft\.?\s*2\b|sf\b)/i;
const LF_QTY_RE =
  /\b(\d[\d,]*)\s*(?:linear\s*feet|ln\.?\s*ft\.?|\blf\b)/i;

function matchAllQty(clause: string, pattern: RegExp): RegExpMatchArray[] {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  return [...clause.matchAll(re)];
}

function normalizePackageKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function packageAcceptsUnit(packageName: string, scopeText: string, unit: string): boolean {
  const pkgKey = normalizePackageKey(packageName);
  const scopeKey = normalizePackageKey(scopeText);
  if (unit === 'lf') {
    return (
      /baseboard|trim|crown|moulding|molding|casing/.test(pkgKey) ||
      /baseboard|trim|linear/.test(scopeKey) ||
      (/paint/.test(pkgKey) && !/tile|floor|laminate|demo|removal/.test(pkgKey))
    );
  }
  if (unit === 'sqft') {
    const trimOnly =
      /\b(baseboard|trim)\b/.test(pkgKey) &&
      !/\b(tile|demo|removal|flooring|laminate|lvp)\b/.test(pkgKey);
    return !trimOnly;
  }
  return true;
}

function splitNoteClauses(text: string): string[] {
  const sentences = String(text || '')
    .split(/[;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const clauses: string[] = [];
  for (const sentence of sentences) {
    const parts = sentence
      .split(
        /\s+(?:and|&|\+)\s+|\s+in\s+(?=\d[\d,]*\s*(?:sq\.?\s*ft\.?|sqft|sq\s*ft|square\s*feet|ft\.?\s*²|ft\.?\s*2\b|linear\s*feet|ln\.?\s*ft\.?|\blf\b))/i
      )
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) clauses.push(...parts);
    else clauses.push(sentence);
  }
  return clauses;
}

function sentenceMatchesPackage(packageName: string, scopeText: string, sentence: string): boolean {
  const pkgKey = packageName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const scopeKey = scopeText.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const s = sentence.toLowerCase();
  if (/\btile\b/.test(pkgKey) && /\b(install|installation)\b/.test(pkgKey) && !/\b(demo|removal)\b/.test(pkgKey)) {
    return (
      /\btile\b/.test(s) &&
      /\b(install|installation|installing)\b/.test(s) &&
      !/\b(demo|demolish|removal|remove|tear[\s-]?out)\b/.test(s)
    );
  }
  if (/\btile\b/.test(pkgKey) && /\b(demo|removal)\b/.test(pkgKey)) {
    return /\btile\b/.test(s) && /\b(demo|demolish|removal|remove|tear[\s-]?out)\b/.test(s);
  }
  if ((/laminate|flooring|lvp/.test(pkgKey) || /laminate|flooring/.test(scopeKey)) && !/baseboard/.test(pkgKey)) {
    return /\b(laminate|lvp|vinyl|flooring)\b/.test(s) && /\b(install|installation)\b/.test(s);
  }
  if (/baseboard|trim/.test(pkgKey) || /baseboard/.test(scopeKey)) {
    return /\b(baseboard|trim)\b/.test(s) || (/\b(linear\s*feet|lf)\b/.test(s) && !/\btile\b/.test(s) && !/\blaminate\b/.test(s));
  }
  if (/paint/.test(pkgKey) && !/baseboard|trim/.test(pkgKey)) {
    return (
      /\b(paint|painting|primer)\b/.test(s) &&
      !/\b(baseboard|trim)\b/.test(s) &&
      !/\b(tile|laminate|lvp|flooring)\b/.test(s)
    );
  }
  if (/shower|tub/.test(pkgKey)) return /\b(shower|tub)\b/.test(s) && /\b(tile|install|surround)\b/.test(s);
  if (/vanity/.test(pkgKey)) return /\bvanity\b/.test(s);
  if (/toilet/.test(pkgKey)) return /\btoilet\b/.test(s);
  if (/cabinet/.test(pkgKey)) return /\b(cabinet|cabinets)\b/.test(s);
  if (/countertop|counter top/.test(pkgKey)) return /\b(countertop|counter\s*top|quartz|granite)\b/.test(s);
  if (/backsplash/.test(pkgKey)) return /\bbacksplash\b/.test(s);
  const tokens = pkgKey.split(' ').filter((w) => w.length > 3);
  return tokens.some((t) => s.includes(t));
}

function extractScopeQuantitiesForPackage(
  packageName: string,
  scopeText: string,
  originalNotes: string
): Array<{ label: string; quantity: number; unit: string }> {
  const source = `${scopeText || ''}\n${originalNotes || ''}`.trim();
  if (!source) return [];
  const results: Array<{ label: string; quantity: number; unit: string }> = [];
  const clauses = splitNoteClauses(source);
  for (const clause of clauses) {
    const sqftMatches = matchAllQty(clause, SQFT_QTY_RE);
    const lfMatches = matchAllQty(clause, LF_QTY_RE);
    if (
      sqftMatches.length &&
      sentenceMatchesPackage(packageName, scopeText, clause) &&
      packageAcceptsUnit(packageName, scopeText, 'sqft')
    ) {
      for (const m of sqftMatches) {
        const qty = Number(String(m[1]).replace(/,/g, ''));
        if (Number.isFinite(qty) && qty > 0) {
          results.push({ label: packageName, quantity: qty, unit: 'sqft' });
        }
      }
    }
    if (
      lfMatches.length &&
      sentenceMatchesPackage(packageName, scopeText, clause) &&
      packageAcceptsUnit(packageName, scopeText, 'lf')
    ) {
      for (const m of lfMatches) {
        const qty = Number(String(m[1]).replace(/,/g, ''));
        if (Number.isFinite(qty) && qty > 0) {
          results.push({ label: packageName, quantity: qty, unit: 'lf' });
        }
      }
    }
  }
  if (results.length === 0 && scopeText) {
    const sqftM = scopeText.match(/\b(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft|sq\s*ft|square\s*feet|ft\s*[²2ˆ]?)\b/i);
    const lfM = scopeText.match(/\b(\d[\d,]*)\s*(?:linear\s*feet|ln\.?\s*ft|\blf\b)/i);
    if (sqftM) results.push({ label: packageName, quantity: Number(sqftM[1].replace(/,/g, '')), unit: 'sqft' });
    else if (lfM) results.push({ label: packageName, quantity: Number(lfM[1].replace(/,/g, '')), unit: 'lf' });
  }
  const byUnit = new Map<string, { label: string; quantity: number; unit: string }>();
  for (const r of results) {
    if (!byUnit.has(r.unit)) byUnit.set(r.unit, r);
  }
  return [...byUnit.values()];
}

function shouldSkipSavedTemplateMatch(pkg: EstimateDraftScopePackage): boolean {
  if (pkg.priceProvidedByUser) return true;
  if (pkg.status === 'user_provided' || pkg.status === 'confirmed') return true;
  // Cleanup/permits need explicit closeout lines — never auto-fill from demo/install template rates.
  if (isCloseoutScopePackage(pkg.name, pkg.scope || '')) return true;
  return false;
}

/** Match saved bid templates on-device when API routes are unavailable or omit templates. */
export function buildSavedPricingProposalFromTemplates(
  draft: EstimateAiDraft,
  templates: unknown[]
): PricingProposal {
  const matchDraft = expandDraftForPricingMatch(draft);
  const notes = String(matchDraft.originalNotes || '').trim();
  const lines: PricingProposalLine[] = [];
  const matchedTemplateNames: string[] = [];

  for (const pkg of getScopePackages(matchDraft)) {
    if (shouldSkipSavedTemplateMatch(pkg)) continue;
    const qtyInfo = pickPackageQuantity(pkg, notes, matchDraft);
    if (!qtyInfo || qtyInfo.quantity <= 0) continue;

    type Candidate = {
      score: number;
      rate: number | null;
      lumpTotal: number | null;
      line: Record<string, unknown>;
      source: 'labor' | 'material';
      templateName: string;
    };
    const candidates: Candidate[] = [];
    const scopeIsLump = isLumpSumUnit(qtyInfo.unit);

    for (const tpl of templates as SavedTemplateRecord[]) {
      const payload = tpl.payload;
      if (!payload || typeof payload !== 'object') continue;
      const templateName = tpl.name || 'Saved bid';
      const laborLines = Array.isArray(payload.laborLineItems) ? payload.laborLineItems : [];
      const materialLines = Array.isArray(payload.materialLineItems) ? payload.materialLineItems : [];

      for (const line of laborLines) {
        const score = scoreTemplateLineToPackage(pkg, line, 'labor');
        if (score <= 0) continue;
        if (scopeIsLump) {
          const lump = savedLumpSumAmount(line, pkg.name);
          if (lump != null && lump > 0) {
            candidates.push({ score, rate: null, lumpTotal: lump, line, source: 'labor', templateName });
          }
        } else {
          const rate = templateLineUnitRate(line, qtyInfo.unit);
          if (rate != null) {
            candidates.push({ score, rate, lumpTotal: null, line, source: 'labor', templateName });
          }
        }
      }
      for (const line of materialLines) {
        const score = scoreTemplateLineToPackage(pkg, line, 'material');
        if (score <= 0) continue;
        if (scopeIsLump) {
          const lump = savedLumpSumAmount(line, pkg.name);
          if (lump != null && lump > 0) {
            candidates.push({ score, rate: null, lumpTotal: lump, line, source: 'material', templateName });
          }
        } else {
          const rate = templateLineUnitRate(line, qtyInfo.unit);
          if (rate != null) {
            candidates.push({ score, rate, lumpTotal: null, line, source: 'material', templateName });
          }
        }
      }
    }

    if (!candidates.length) continue;

    const wantMaterial = !isDemoPackage(pkg.name);
    const picked: Candidate[] = [];
    if (wantMaterial) {
      const mat = [...candidates]
        .filter((c) => c.source === 'material')
        .sort((a, b) => b.score - a.score)[0];
      const lab = [...candidates]
        .filter((c) => c.source === 'labor')
        .sort((a, b) => b.score - a.score)[0];
      if (mat) picked.push(mat);
      if (lab) picked.push(lab);
    } else {
      const lab = [...candidates]
        .filter((c) => c.source === 'labor')
        .sort((a, b) => b.score - a.score)[0];
      if (lab) picked.push(lab);
    }
    if (!picked.length) {
      picked.push([...candidates].sort((a, b) => b.score - a.score)[0]);
    }

    for (const pick of picked) {
      if (!matchedTemplateNames.includes(pick.templateName)) {
        matchedTemplateNames.push(pick.templateName);
      }
      if (pick.lumpTotal != null && pick.lumpTotal > 0) {
        lines.push({
          packageName: pkg.name,
          lineType: 'lump_sum',
          label: String(pick.line.name || pkg.name),
          unitType: 'lump_sum',
          quantity: 1,
          unitRate: 0,
          total: pick.lumpTotal,
          formula: `$${formatMoney(pick.lumpTotal)} lump sum`,
          priceSource: 'saved_template',
          sourceLabel: `Saved bid template: ${pick.templateName}`,
          confidence: 'medium',
          status: 'confirmed',
          requiresApproval: true,
        });
        continue;
      }
      if (pick.rate == null || pick.rate <= 0) continue;
      const total = roundMoney(pick.rate * qtyInfo.quantity);
      lines.push({
        packageName: pkg.name,
        lineType: pick.source,
        label: String(pick.line.name || pkg.name),
        unitType: qtyInfo.unit,
        quantity: qtyInfo.quantity,
        unitRate: pick.rate,
        total,
        formula: `${qtyInfo.quantity.toLocaleString()} ${qtyInfo.unit} × $${pick.rate}/${qtyInfo.unit} = $${formatMoney(total)}`,
        priceSource: 'saved_template',
        sourceLabel: `Saved bid template: ${pick.templateName}`,
        confidence: 'medium',
        status: 'confirmed',
        requiresApproval: true,
      });
    }
  }

  const totalSuggested = lines.reduce((s, l) => s + l.total, 0);
  return normalizePricingProposal({
    empty: lines.length === 0,
    source: 'saved_template',
    sourceLabel: matchedTemplateNames.length
      ? `Saved bid template (${matchedTemplateNames.join(', ')})`
      : 'Saved Bid Template',
    primarySource: 'saved_template',
    lines,
    totalSuggested,
    templateCount: templates.length,
    anyRealSource: lines.length > 0,
    engine: false,
  });
}

function enrichSavedScopeItemsFromDraft(
  draft: EstimateAiDraft,
  proposal: PricingProposal
): PricingProposal {
  const notes = String(draft.originalNotes || '');
  const packages = getScopePackages(expandDraftForPricingMatch(draft));
  const scopeItems = [...(proposal.scopeItems || [])];

  for (const pkg of packages) {
    const found = scopeItems.some((s) => packageKeysMatch(s.scopeName, pkg.name));
    if (found) continue;
    const qtyInfo = pickPackageQuantity(pkg, notes, draft);
    scopeItems.push({
      scopeItemId: normalizePackageKey(pkg.name).replace(/\s+/g, '_') || 'scope',
      scopeName: pkg.name,
      quantity: qtyInfo?.quantity ?? null,
      unit: qtyInfo?.unit ?? 'lump_sum',
      proposedRates: [],
      comparison: {},
      recommended: null,
      warnings: ['Needs pricing'],
    });
  }

  return { ...proposal, scopeItems };
}

export async function fetchSavedPricingProposal(
  draft: EstimateAiDraft,
  savedTemplates: unknown[] = [],
  location?: { projectLocation?: string; zipCode?: string }
): Promise<PricingProposal> {
  const matchDraft = expandDraftForPricingMatch(draft);
  const stampSaved = (p: PricingProposal) =>
    normalizePricingProposal(
      patchScopeItemsFromTemplateLines(
        enrichSavedScopeItemsFromDraft(matchDraft, { ...p, pricingMode: 'saved_only' as const })
      )
    );
  const templates = await resolveSavedBidTemplates(savedTemplates);
  const fromTemplates =
    templates.length > 0 ? buildSavedPricingProposalFromTemplates(matchDraft, templates) : null;
  const engineOpts = {
    mode: 'saved_only' as const,
    savedTemplates: templates,
    projectLocation: location?.projectLocation,
    zipCode: location?.zipCode,
  };

  try {
    const fromApi = await fetchEngineProposal(matchDraft, engineOpts);
    if (fromApi && proposalHasSavedRates(fromApi)) {
      if (fromTemplates && proposalHasSavedRates(fromTemplates)) {
        return stampSaved(mergeEngineProposalWithTemplates(fromApi, fromTemplates));
      }
      return stampSaved(patchScopeItemsFromTemplateLines(fromApi));
    }
  } catch {
    // fall through to on-device template + library matching
  }

  if (fromTemplates && proposalHasSavedRates(fromTemplates)) {
    return stampSaved(fromTemplates);
  }

  if (templates.length > 0) {
    const hybrid = await buildSavedPricingProposalHybrid(matchDraft, templates);
    if (!hybrid.empty) return stampSaved(hybrid);
  } else {
    const fromLibrary = await buildSavedPricingProposalLocal(matchDraft);
    if (!fromLibrary.empty) return stampSaved(fromLibrary);
  }

  return stampSaved(buildSavedPricingProposalLocal(matchDraft));
}

/** Prefer a fresh fetch; optional stale pending only when explicitly allowed. */
export function resolveSavedPricingProposalForDraft(
  draft: EstimateAiDraft,
  fetched: PricingProposal,
  options?: { allowStalePending?: boolean }
): PricingProposal {
  const normalized = normalizePricingProposal(fetched);
  if (proposalHasSavedRates(normalized)) return normalized;
  if (options?.allowStalePending && draft.pendingPricingProposal) {
    const pending = normalizePricingProposal({
      ...draft.pendingPricingProposal,
      pricingMode: 'saved_only',
    });
    if (proposalHasSavedRates(pending)) return pending;
  }
  return normalized;
}

export async function fetchRoughPricingProposal(
  draft: EstimateAiDraft,
  savedTemplates: unknown[] = [],
  location?: { projectLocation?: string; zipCode?: string }
): Promise<PricingProposal> {
  const templates = await resolveSavedBidTemplates(savedTemplates);
  try {
    const fromApi = await fetchEngineProposal(draft, {
      mode: 'suggest',
      savedTemplates: templates,
      projectLocation: location?.projectLocation,
      zipCode: location?.zipCode,
    });
    if (fromApi && !fromApi.empty) {
      fromApi.pricingMode = 'suggest';
      return fromApi;
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('fetchRoughPricingProposal: API failed, using local fallback', err);
    }
  }
  return normalizePricingProposal({
    ...buildRoughPricingProposalLocal(draft),
    pricingMode: 'suggest' as const,
  });
}

function buildRoughPricingProposalLocal(draft: EstimateAiDraft): PricingProposal {
  const notes = String(draft.originalNotes || '');
  const lines: PricingProposalLine[] = [];
  for (const pkg of getScopePackages(draft)) {
    const amount = pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0;
    if (amount > 0) continue;

    const qtyInfo = pickPackageQuantity(pkg, notes, draft);
    const qty = qtyInfo ? { quantity: qtyInfo.quantity, unit: qtyInfo.unit } : null;
    const trade = inferTradeFromPackage(pkg, draft);

    if (trade === 'bathroom_fixture' && qty?.unit === 'each') {
      const fixture = resolveFixtureKindLocal(pkg.name);
      const band = fixture ? FIXTURE_PLANNING_RATES_LOCAL[fixture] : null;
      if (band) {
        const quantity = qty.quantity > 0 ? qty.quantity : 1;
        const pushFixture = (lineType: 'material' | 'labor', label: string, unitRate: number) => {
          const total = roundMoney(unitRate * quantity);
          lines.push({
            packageName: pkg.name,
            lineType,
            label,
            unitType: 'each',
            quantity,
            unitRate,
            total,
            formula: `${quantity.toLocaleString()} each × $${unitRate}/each = $${formatMoney(total)}`,
            priceSource: 'national_trade_average',
            sourceLabel: 'National Average',
            confidence: lineType === 'labor' ? 'medium' : 'low',
            status: 'rough_price',
            requiresApproval: true,
          });
        };
        if (band.material > 0) pushFixture('material', band.materialLabel, band.material);
        if (band.labor > 0) pushFixture('labor', band.laborLabel, band.labor);
        continue;
      }
    }

    const band = NATIONAL_TRADE_AVERAGES_LOCAL[trade] || NATIONAL_TRADE_AVERAGES_LOCAL.other;
    if (!qty || qty.quantity <= 0 || qty.unit !== band.unit) continue;

    const push = (
      lineType: 'material' | 'labor',
      label: string,
      unitType: string,
      quantity: number,
      unitRate: number
    ) => {
      const total = roundMoney(unitRate * quantity);
      lines.push({
        packageName: pkg.name,
        lineType,
        label,
        unitType,
        quantity,
        unitRate,
        total,
        formula: `${quantity.toLocaleString()} ${formatDisplayUnit(unitType)} × $${unitRate}/${formatDisplayUnit(unitType)} = $${formatMoney(total)}`,
        priceSource: 'national_trade_average',
        sourceLabel: 'National Average',
        confidence: lineType === 'labor' ? 'medium' : 'low',
        status: 'rough_price',
        requiresApproval: true,
      });
    };

    if (band.material > 0) {
      push('material', band.materialLabel, band.unit, qty.quantity, band.material);
    }
    if (band.labor > 0) {
      push('labor', band.laborLabel, band.unit, qty.quantity, band.labor);
    }
  }

  const totalSuggested = lines.reduce((s, l) => s + l.total, 0);
  return {
    empty: lines.length === 0,
    source: 'ai_rough_estimate',
    sourceLabel: 'National Average',
    lines,
    totalSuggested,
    message: lines.length === 0 ? 'Could not build per-item rough pricing from scope quantities.' : null,
    assumptions: [
      'Suggested prices use general trade assumptions — not from your notes or saved bids',
      'Review each rate before applying',
    ],
    disclaimer:
      'Indicative only. Approve before applying; line items will be labeled AI Rough Estimate.',
  };
}

async function buildSavedPricingProposalLocal(draft: EstimateAiDraft): Promise<PricingProposal> {
  let rates: Array<{ scopeItemName: string; unitType: string; unitRate: number; category?: string }> = [];
  try {
    const lib = await fetchPricingLibrary();
    for (const section of lib.sections || []) {
      for (const rate of section.items || []) {
        const ut = String(rate.unitType || '').toLowerCase();
        if (
          (rate.unitRate ?? 0) > 0 &&
          ut !== 'lump_sum' &&
          ut !== 'lot' &&
          ut !== 'flat' &&
          ['sqft', 'lf', 'hr', 'each'].includes(ut)
        ) {
          rates.push({
            scopeItemName: rate.scopeItemName,
            unitType: rate.unitType,
            unitRate: rate.unitRate as number,
            category: rate.category,
          });
        }
      }
    }
  } catch {
    rates = [];
  }

  const findRateForPackage = (pkgName: string, role: 'material' | 'labor', unitType: string) => {
    const matched = rates.filter(
      (r) =>
        r.unitRate > 0 &&
        r.unitType === unitType &&
        libraryEntryMatchesPackage(pkgName, r, role)
    );
    if (!matched.length) return null;
    const sorted = [...matched].map((m) => m.unitRate).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const lines: PricingProposalLine[] = [];
  for (const pkg of getScopePackages(draft)) {
    const qtyInfo = pickPackageQuantity(pkg, String(draft.originalNotes || ''), draft);
    if (!qtyInfo || qtyInfo.quantity <= 0) continue;

    const pkgDemo = isDemoPackage(pkg.name);
    const add = (
      lineType: 'material' | 'labor',
      label: string,
      unitType: string,
      quantity: number,
      unitRate: number
    ) => {
      const total = roundMoney(unitRate * quantity);
      lines.push({
        packageName: pkg.name,
        lineType,
        label,
        unitType,
        quantity,
        unitRate,
        total,
        formula: `${quantity.toLocaleString()} ${formatDisplayUnit(unitType)} × $${unitRate}/${formatDisplayUnit(unitType)} = $${formatMoney(total)}`,
        priceSource: 'pricing_history',
        sourceLabel: 'Based on your past approved bids',
        confidence: 'medium',
        status: 'pricing_memory_suggested',
        requiresApproval: true,
      });
    };

    if (pkgDemo) {
      const rate = findRateForPackage(pkg.name, 'labor', qtyInfo.unit);
      if (rate) add('labor', pkg.name, qtyInfo.unit, qtyInfo.quantity, rate);
      continue;
    }

    const wantMaterial = !/demo|demolition|removal|paint|plumb|electrical|haul/.test(pkg.name.toLowerCase());
    if (wantMaterial) {
      const mat = findRateForPackage(pkg.name, 'material', qtyInfo.unit);
      if (mat) add('material', `${pkg.name} material`, qtyInfo.unit, qtyInfo.quantity, mat);
    }
    const lab = findRateForPackage(pkg.name, 'labor', qtyInfo.unit);
    if (lab) add('labor', `${pkg.name} labor`, qtyInfo.unit, qtyInfo.quantity, lab);
  }

  const totalSuggested = lines.reduce((s, l) => s + l.total, 0);
  return {
    empty: lines.length === 0,
    source: 'saved_pricing',
    sourceLabel: rates.length > 0 ? 'Based on your past approved bids' : 'Based on your saved pricing',
    lines,
    totalSuggested,
    message:
      lines.length === 0
        ? 'You have not saved pricing for this scope yet. Add prices manually or request a rough AI estimate.'
        : null,
  };
}

function formatMoney(amount: number) {
  return roundMoney(amount).toLocaleString();
}

export function draftHasApplyablePricing(draft: EstimateAiDraft | null): boolean {
  if (!draft) return false;
  if ((draft.calculatedLineItemTotal || 0) > 0) return true;
  if ((draft.knownSubtotal || 0) > 0) return true;
  const rooms = draft.rooms || [];
  if (rooms.some((r) => r.price != null && r.price > 0)) return true;
  if ((draft.pendingPricingProposal?.lines?.length ?? 0) > 0) return true;
  return getScopePackages(draft).some((p) => (p.price ?? 0) > 0 || (p.knownSubtotal ?? 0) > 0);
}

function isPackageUnpriced(pkg: EstimateDraftScopePackage): boolean {
  const amount = pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0;
  return amount <= 0;
}

function resolvePackageNameForSuggestion(
  draft: EstimateAiDraft,
  suggestion: MissingPriceSuggestion & { packageName?: string }
): string | null {
  if (suggestion.packageName) return suggestion.packageName;
  const missing = String(suggestion.missingItem || '').replace(/\s*—\s*full package pricing$/i, '').trim();
  const packages = getScopePackages(draft);
  const exact = packages.find((p) => p.name === missing);
  if (exact) return exact.name;
  const fuzzy = packages.find(
    (p) =>
      missing.toLowerCase().includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(missing.toLowerCase())
  );
  return fuzzy?.name || null;
}

function suggestionToProposalLine(
  suggestion: MissingPriceSuggestion & { packageName?: string; lineType?: string },
  packageName: string
): PricingProposalLine | null {
  if (suggestion.suggestedAmount != null && suggestion.suggestedAmount > 0) {
    return {
      packageName,
      lineType: 'lump_sum',
      label: suggestion.scopeItemName || suggestion.missingItem,
      unitType: suggestion.unitType || 'lump_sum',
      quantity: null,
      unitRate: suggestion.suggestedAmount,
      total: suggestion.suggestedAmount,
      formula: `$${formatMoney(suggestion.suggestedAmount)} lump sum`,
      priceSource:
        suggestion.source === 'regional_default' ? 'ai_rough_estimate' : suggestion.source || 'ai_rough_estimate',
      sourceLabel: suggestion.sourceLabel,
      confidence: suggestion.confidence,
      status: 'rough_price',
      requiresApproval: true,
    };
  }
  if (
    suggestion.suggestedUnitRate != null &&
    suggestion.suggestedUnitRate > 0 &&
    suggestion.quantity != null &&
    suggestion.quantity > 0
  ) {
    const unit = suggestion.unitType || 'unit';
    const total = roundMoney(suggestion.suggestedUnitRate * suggestion.quantity);
    const lineType =
      suggestion.lineType === 'material'
        ? 'material'
        : suggestion.lineType === 'labor'
          ? 'labor'
          : /\bmaterial|allowance|supply\b/i.test(`${suggestion.missingItem} ${suggestion.scopeItemName}`)
            ? 'material'
            : 'labor';
    return {
      packageName,
      lineType,
      label: suggestion.scopeItemName || suggestion.missingItem,
      unitType: unit,
      quantity: suggestion.quantity,
      unitRate: suggestion.suggestedUnitRate,
      total,
      formula: `${suggestion.quantity.toLocaleString()} ${formatDisplayUnit(unit)} × $${suggestion.suggestedUnitRate}/${formatDisplayUnit(unit)} = $${formatMoney(total)}`,
      priceSource:
        suggestion.source === 'regional_default' ? 'ai_rough_estimate' : suggestion.source || 'ai_rough_estimate',
      sourceLabel: suggestion.sourceLabel,
      confidence: suggestion.confidence,
      status: suggestion.source === 'saved_template' ? 'confirmed' : 'rough_price',
      requiresApproval: true,
    };
  }
  return null;
}

/** One material + one labor per scope package; labels may differ (API vs local rough). */
function proposalLineCoalesceKey(line: PricingProposalLine): string {
  const lt = line.lineType;
  if (lt === 'material' || lt === 'labor') {
    return `${line.packageName}|${lt}`;
  }
  return `${line.packageName}|${lt}|${String(line.label || '')
    .toLowerCase()
    .trim()}`;
}

function dedupePricingProposalLines(lines: PricingProposalLine[]): PricingProposalLine[] {
  const seen = new Set<string>();
  const out: PricingProposalLine[] = [];
  for (const line of lines) {
    const key = proposalLineCoalesceKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/** Turn suggest-missing API results into a proposal and fill gaps with rough lf/sqft defaults. */
export function buildProposalFromMissingSuggestions(
  draft: EstimateAiDraft,
  suggestions: MissingPriceSuggestion[]
): PricingProposal {
  const lines: PricingProposalLine[] = [];
  const coveredLineKeys = new Set<string>();

  for (const suggestion of suggestions) {
    const packageName = resolvePackageNameForSuggestion(draft, suggestion);
    if (!packageName) continue;
    const pkg = getScopePackages(draft).find((p) => p.name === packageName);
    if (pkg && !isPackageUnpriced(pkg)) continue;
    const line = suggestionToProposalLine(suggestion, packageName);
    if (line) {
      const key = proposalLineCoalesceKey(line);
      if (coveredLineKeys.has(key)) continue;
      coveredLineKeys.add(key);
      lines.push(line);
    }
  }

  const rough = buildRoughPricingProposalLocal(draft);
  for (const line of rough.lines) {
    const key = proposalLineCoalesceKey(line);
    if (coveredLineKeys.has(key)) continue;
    const pkg = getScopePackages(draft).find((p) => p.name === line.packageName);
    if (pkg && !isPackageUnpriced(pkg)) continue;
    coveredLineKeys.add(key);
    lines.push(line);
  }

  const deduped = dedupePricingProposalLines(lines);
  const totalSuggested = deduped.reduce((s, l) => s + l.total, 0);
  const hasRough = deduped.some((l) => l.priceSource === 'ai_rough_estimate');
  return {
    empty: deduped.length === 0,
    source: hasRough ? 'ai_rough_estimate' : 'saved_pricing',
    sourceLabel: hasRough ? 'AI Rough Estimate' : 'Suggested from your pricing history',
    lines: deduped,
    totalSuggested,
    message:
      deduped.length === 0
        ? 'No pricing suggestions available for the remaining scope items.'
        : null,
    assumptions: hasRough
      ? ['Some rates are AI regional defaults — review before applying', 'Approve each line before sending a bid']
      : undefined,
    disclaimer: hasRough
      ? 'Indicative only. Approve before applying; line items will be labeled AI Rough Estimate.'
      : undefined,
  };
}

function packageNeedsBudgetSplit(pkg: EstimateDraftScopePackage): boolean {
  const total = Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0);
  if (total <= 0) return false;
  const noteBacked =
    pkg.status === 'calculated' ||
    pkg.priceSource === 'notes' ||
    Boolean((pkg as EstimateDraftScopePackage & { pricedFromSqftAllowances?: boolean }).pricedFromSqftAllowances) ||
    (pkg.pricingItems || []).some((item) => item.priceSource === 'notes');
  if (!noteBacked) return false;
  if ((pkg.materialPrice ?? 0) > 0 || (pkg.laborPrice ?? 0) > 0) return false;
  if ((pkg.pricingItems || []).some((item) => item.pricingType === 'material' || item.pricingType === 'labor')) {
    return false;
  }
  return true;
}

/** Build approval-required material/labor budget splits for note-backed lump sums or single total rates. */
export function buildBudgetSplitProposalFromDraft(draft: EstimateAiDraft): PricingProposal {
  const scopeItems: PricingScopeItemProposal[] = [];
  const lines: PricingProposalLine[] = [];

  for (const pkg of getScopePackages(draft)) {
    if (!packageNeedsBudgetSplit(pkg)) continue;

    const qty = pkg.scopeQuantities?.[0];
    const trade = inferTradeFromPackage(pkg, draft);
    const band = NATIONAL_TRADE_AVERAGES_LOCAL[trade];
    const total = roundMoney(Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0));
    if (!band || !qty || qty.quantity <= 0 || qty.unit !== band.unit || total <= 0 || band.material <= 0) {
      continue;
    }

    const materialTotal = Math.min(total, roundMoney(qty.quantity * band.material));
    const laborTotal = roundMoney(total - materialTotal);
    if (materialTotal <= 0 || laborTotal <= 0) continue;

    const rates = [
      {
        label: band.materialLabel,
        pricingType: 'material',
        rate: band.material,
        unit: band.unit,
        quantity: qty.quantity,
        total: materialTotal,
        formula: `${qty.quantity.toLocaleString()} ${band.unit.toUpperCase()} × $${band.material}/${band.unit} = $${formatMoney(materialTotal)}`,
        source: 'national_trade_average',
        confidence: 'medium',
        assumptions: [
          `Suggested material budget split from National Average; original note total stays $${formatMoney(total)}.`,
        ],
        requiresApproval: true,
      },
      {
        label: band.laborLabel,
        pricingType: 'labor',
        rate: laborTotal,
        unit: 'lump_sum',
        quantity: 1,
        total: laborTotal,
        formula: `$${formatMoney(total)} note total - $${formatMoney(materialTotal)} suggested materials = $${formatMoney(laborTotal)} labor`,
        source: 'national_trade_average',
        confidence: 'medium',
        assumptions: [
          `Suggested labor remainder from National Average material split; review before applying to project budget.`,
        ],
        requiresApproval: true,
      },
    ];

    scopeItems.push({
      scopeItemId: normalizePackageKey(pkg.name).replace(/\s+/g, '_') || 'budget_split',
      scopeName: pkg.name,
      quantity: qty.quantity,
      unit: qty.unit,
      proposedRates: rates,
      comparison: {},
      recommended: {
        source: 'national_trade_average',
        sourceLabel: 'National Average',
        reason: `Original notes gave a total of $${formatMoney(total)} but did not split material vs labor.`,
        confidence: 'medium',
        disclaimerText: 'Suggested split is for internal budget tracking and can be edited before applying.',
      },
      warnings: [`Review suggested split; original note total remains $${formatMoney(total)}.`],
      requiresConfirmBeforeApply: true,
      reviewStatus: 'needs_approval',
      autoSelectEligible: false,
      approvalSubtext: 'National Average suggested split for project budget tracking.',
    });

    for (const rate of rates) {
      lines.push({
        packageName: pkg.name,
        lineType: rate.pricingType as 'material' | 'labor',
        label: rate.label,
        unitType: rate.unit || 'lump_sum',
        quantity: rate.quantity,
        unitRate: rate.rate,
        total: rate.total || 0,
        formula: rate.formula,
        priceSource: 'national_trade_average',
        sourceLabel: 'National Average',
        confidence: rate.confidence,
        status: 'rough_price',
        requiresApproval: true,
      });
    }
  }

  const totalSuggested = lines.reduce((sum, line) => sum + (line.total || 0), 0);
  return normalizePricingProposal({
    empty: lines.length === 0,
    source: 'manual',
    sourceLabel: 'National Average Budget Split',
    lines,
    scopeItems,
    totalSuggested,
    pricingMode: 'suggest',
    message: lines.length ? null : 'No note-backed lump sums need a budget split.',
    assumptions: [
      'Original note totals are preserved.',
      'Material/labor split is suggested from National Average rates for project budget tracking.',
    ],
    disclaimer: 'Review and approve before applying. These splits affect internal material/labor budgets.',
    anyRealSource: true,
    requiresConfirmBeforeApply: true,
  });
}

/** Sum template/proposal lines that belong on this scope row (supports name mismatches like Tile Flooring ↔ Tile Removal). */
export function proposalTotalForScopeName(
  proposal: PricingProposal | null | undefined,
  scopeName: string
): number {
  if (!proposal?.lines?.length) return 0;
  return proposal.lines
    .filter(
      (l) => l.packageName === scopeName || roomMatchesProposalPackage(scopeName, l.packageName)
    )
    .reduce((s, l) => s + (l.total || 0), 0);
}

export function applyPricingProposalToDraft(
  draft: EstimateAiDraft,
  proposal: PricingProposal,
  options: { approved?: boolean } = {}
): EstimateAiDraft {
  const approved = options.approved !== false;
  const linesByRoom = indexProposalLinesByRoom(draft.rooms || [], proposal.lines || []);

  const isRough = proposal.source === 'ai_rough_estimate';
  const rooms = (draft.rooms || []).map((room) => {
    const pkgLines = linesByRoom.get(room.name);
    if (!pkgLines?.length) return room;

    const lump = pkgLines.find((l) => l.lineType === 'lump_sum');
    const labor = pkgLines
      .filter((l) => l.lineType === 'labor')
      .reduce((sum, l) => sum + l.total, 0);
    const material = pkgLines
      .filter((l) => l.lineType === 'material')
      .reduce((sum, l) => sum + l.total, 0);
    const price = lump ? lump.total : roundMoney(labor + material);

    const pricingItems = pkgLines.map((l) => ({
      name: l.label,
      amount: l.total,
      unitRate: l.unitRate,
      quantity: l.quantity,
      unit: l.unitType,
      pricingType: l.lineType,
      priceSource: l.priceSource,
      status: isRough ? 'rough_price' : 'confirmed',
      formula: l.formula,
      includedInSubtotal: true,
      approvedByUser: approved,
    }));

    return {
      ...room,
      price: price > 0 ? price : null,
      laborPrice: labor > 0 ? labor : null,
      materialPrice: material > 0 ? material : null,
      priceIncludesLaborAndMaterials: !lump && labor > 0 && material > 0,
      priceProvidedByUser: !isRough,
      splitIsSuggested: false,
      pricingItems,
      packageStatus: isRough ? 'rough_price' : 'confirmed',
      applyEligible: approved && price > 0,
      roughPricePendingApproval: isRough && !approved,
    };
  });

  const lineTotal = rooms.reduce((sum, r) => sum + (r.price || 0), 0);
  const laborTotal = rooms.reduce((sum, r) => sum + (r.laborPrice || 0), 0);
  const materialTotal = rooms.reduce((sum, r) => sum + (r.materialPrice || 0), 0);
  const pricedRooms = rooms.filter((r) => (r.price || 0) > 0).length;
  const totalRooms = rooms.length;
  const allPriced = totalRooms > 0 && pricedRooms === totalRooms;
  const partial = pricedRooms > 0 && !allPriced;

  const synced = syncDraftAfterPricingApply(
    {
      ...draft,
      rooms,
      scopePackages: undefined,
      pendingPricingProposal: proposal,
      pricingProposalApproved: approved,
      noPricingDetected: pricedRooms === 0,
      calculatedLineItemTotal: lineTotal > 0 ? lineTotal : null,
      calculatedLaborTotal: laborTotal > 0 ? laborTotal : null,
      calculatedMaterialTotal: materialTotal > 0 ? materialTotal : null,
    },
    { isRough, allPriced, partial, approved, proposalSource: proposal.source }
  );

  return {
    ...synced,
    estimateConfidence:
      approved && pricedRooms > 0
        ? {
            level: isRough ? 'medium' : allPriced ? 'high' : 'medium',
            label: isRough ? 'Medium confidence' : allPriced ? 'High confidence' : 'Medium confidence',
            summary: isRough
              ? 'AI rough estimate — review before applying to bid'
              : proposal.source === 'manual'
                ? allPriced
                  ? 'Manually entered pricing — review before applying'
                  : 'Partial manual pricing — some scope items still need prices'
                : 'Pricing from your saved rates — review before applying',
            reasons: partial ? ['Some scope items still missing prices'] : [],
          }
        : draft.estimateConfidence,
  };
}

function packageStatusFromRoom(
  room: EstimateAiDraft['rooms'][number],
  isRough: boolean
): EstimateDraftScopePackage['status'] {
  if (room.roughPricePendingApproval) return 'rough_price';
  if (room.packageStatus) return room.packageStatus;
  if ((room.price || 0) <= 0) return 'missing_price';
  if (room.priceIncludesLaborAndMaterials && room.priceProvidedByUser) return 'user_provided';
  if (room.laborPrice != null && room.materialPrice != null) return 'calculated';
  return isRough ? 'rough_price' : 'confirmed';
}

function detectNoteProfileFromPackages(
  scopePackages: EstimateDraftScopePackage[],
  lineTotal: number
): NonNullable<EstimateAiDraft['noteProfile']> {
  const calculated = scopePackages.filter((p) => p.status === 'calculated').length;
  const lump = scopePackages.filter(
    (p) =>
      p.status === 'user_provided' ||
      (p.status === 'confirmed' && p.priceIncludesLaborAndMaterials && (p.price ?? 0) > 0)
  ).length;
  const scopeOnly = scopePackages.filter((p) => p.status === 'missing_price').length;
  const partial = scopePackages.filter((p) => p.status === 'partial_pricing').length;
  const rough = scopePackages.filter((p) => p.status === 'rough_price').length;

  let primary: NonNullable<EstimateAiDraft['noteProfile']>['primary'] = 'mixed';
  if (scopePackages.length === 0) {
    primary = lineTotal > 0 ? 'exact_rate' : 'scope_only';
  } else if (scopeOnly === scopePackages.length) {
    primary = 'scope_only';
  } else if (calculated > 0 && lump === 0 && scopeOnly === 0) {
    primary = 'exact_rate';
  } else if (lump > 0 && calculated === 0 && scopeOnly === 0) {
    primary = 'lump_sum';
  } else if (lump > 0 || calculated > 0) {
    primary = 'mixed';
  }

  return {
    primary,
    calculatedCount: calculated,
    lumpSumCount: lump,
    scopeOnlyCount: scopeOnly,
    partialCount: partial,
    roughCount: rough,
  };
}

function syncDraftAfterPricingApply(
  draft: EstimateAiDraft,
  options: {
    isRough: boolean;
    allPriced: boolean;
    partial: boolean;
    approved: boolean;
    proposalSource: PricingProposal['source'];
  }
): EstimateAiDraft {
  const scopePackages = (draft.rooms || []).map((room) => {
    const status = packageStatusFromRoom(room, options.isRough);
    const price = room.price ?? null;
    return {
      name: room.name,
      scope: room.scope,
      scopeQuantities: room.scopeQuantities,
      price,
      laborPrice: room.laborPrice ?? null,
      materialPrice: room.materialPrice ?? null,
      pricingType: price != null ? ('lump_sum' as const) : ('unknown' as const),
      includesLabor: room.laborPrice != null ? true : null,
      includesMaterials: room.materialPrice != null ? true : null,
      priceSource: room.priceProvidedByUser ? ('user_provided' as const) : ('missing' as const),
      status,
      knownSubtotal: price != null && price > 0 ? price : null,
      formula: null,
      missingInfo: [],
      missingPriceItems: room.missingPriceItems || [],
      pricingItems: room.pricingItems || [],
      priceIncludesLaborAndMaterials: room.priceIncludesLaborAndMaterials,
      splitIsSuggested: Boolean(room.splitIsSuggested),
      priceProvidedByUser: Boolean(room.priceProvidedByUser),
      applyEligible: room.applyEligible ?? (price != null && price > 0),
    };
  });

  const lineTotal = draft.calculatedLineItemTotal || 0;
  const noteProfile = detectNoteProfileFromPackages(scopePackages, lineTotal);
  const stillNeededReview = scopePackages
    .filter((p) => p.status === 'missing_price')
    .map((p) => {
      const hint = p.name.toLowerCase();
      if (/tile|demo/.test(hint)) return `Pricing for ${p.name} (demo)`;
      if (/laminate|flooring|baseboard|trim/.test(hint)) return `Pricing for ${p.name} (material + labor)`;
      return `Pricing for ${p.name}`;
    });
  const knownSubtotal = scopePackages.reduce(
    (sum, p) => sum + (p.knownSubtotal != null && p.knownSubtotal > 0 ? p.knownSubtotal : 0),
    0
  );

  return {
    ...draft,
    scopePackages,
    noteProfile,
    stillNeededReview: stillNeededReview.length ? stillNeededReview : draft.stillNeededReview,
    knownSubtotal: knownSubtotal > 0 ? knownSubtotal : draft.knownSubtotal,
    noPricingDetected: lineTotal <= 0 && knownSubtotal <= 0,
  };
}

function roundMoney(n: number) {
  return Math.round(Number(n) || 0);
}

export type ManualPackageMode = 'rate' | 'lump_sum' | 'split';

export type ManualPricingInputs = Record<
  string,
  {
    mode?: ManualPackageMode;
    demoRateSqft?: string;
    materialRateSqft?: string;
    laborRateSqft?: string;
    materialRateLf?: string;
    laborRateLf?: string;
    /** Total $ for material when split mode has no unit rate (allowance, each, etc.). */
    materialTotal?: string;
    /** Total $ for labor when split mode has no unit rate. */
    laborTotal?: string;
    lumpSum?: string;
    caulkPaintLump?: string;
  }
>;

export type ManualPackagePreview = {
  packageName: string;
  breakdown: string[];
  total: number;
};

export type PackagePricingKind = 'tile_demo' | 'flooring' | 'baseboard' | 'other';

export function classifyPackageKind(name: string): PackagePricingKind {
  const n = name.toLowerCase();
  if (/\b(demo|demolition|tile)\b/.test(n)) return 'tile_demo';
  if (
    /\b(baseboard|crown|case)\b/.test(n) ||
    (/\btrim\b/.test(n) && !/plumbing|electrical/.test(n))
  ) {
    return 'baseboard';
  }
  if (
    (/\b(laminate|flooring|lvp|vinyl)\b/.test(n) || /\binstall\b/.test(n)) &&
    !/baseboard|trim|door|vanity|toilet|fan|light|lighting|fixture|exhaust|mirror|glass|niche|bench|curb|cleanup|haul|accessories|allowance|permits?/.test(
      n
    )
  ) {
    return 'flooring';
  }
  return 'other';
}

export function defaultManualMode(kind: PackagePricingKind): ManualPackageMode {
  if (kind === 'tile_demo') return 'rate';
  if (kind === 'other') return 'lump_sum';
  return 'split';
}

export function packageQuantityUnit(pkg: EstimateDraftScopePackage): string | null {
  const unit = pkg.scopeQuantities?.[0]?.unit;
  return unit ? String(unit).trim().toLowerCase() : null;
}

/** How split-mode manual inputs should be captured for this package unit. */
export function manualSplitInputKind(unit: string | null): 'sqft' | 'lf' | 'totals' {
  if (unit === 'sqft' || unit === 'sf') return 'sqft';
  if (unit === 'lf') return 'lf';
  return 'totals';
}

function addManualSplitPreview(
  pkg: EstimateDraftScopePackage,
  inp: ManualPricingInputs[string] | undefined,
  breakdown: string[],
  addLine: (text: string, amount: number) => void
) {
  const qty = pkg.scopeQuantities?.[0];
  const splitKind = manualSplitInputKind(packageQuantityUnit(pkg));
  if (splitKind === 'sqft' && qty?.unit === 'sqft') {
    const mat = parseMoney(inp?.materialRateSqft);
    const lab = parseMoney(inp?.laborRateSqft);
    if (mat) {
      const t = roundMoney(mat * qty.quantity);
      addLine(`Material: ${qty.quantity.toLocaleString()} sqft × $${mat}/sqft = $${formatMoney(t)}`, t);
    }
    if (lab) {
      const t = roundMoney(lab * qty.quantity);
      addLine(`Labor: ${qty.quantity.toLocaleString()} sqft × $${lab}/sqft = $${formatMoney(t)}`, t);
    }
    return;
  }
  if (splitKind === 'lf' && qty?.unit === 'lf') {
    const mat = parseMoney(inp?.materialRateLf);
    const lab = parseMoney(inp?.laborRateLf);
    if (mat) {
      const t = roundMoney(mat * qty.quantity);
      addLine(`Material: ${qty.quantity.toLocaleString()} LF × $${mat}/LF = $${formatMoney(t)}`, t);
    }
    if (lab) {
      const t = roundMoney(lab * qty.quantity);
      addLine(`Labor: ${qty.quantity.toLocaleString()} LF × $${lab}/LF = $${formatMoney(t)}`, t);
    }
    const caulk = parseMoney(inp?.caulkPaintLump);
    if (caulk) addLine(`Caulk & paint: $${formatMoney(caulk)}`, caulk);
    return;
  }
  const mat = parseMoney(inp?.materialTotal);
  const lab = parseMoney(inp?.laborTotal);
  if (mat) addLine(`Material: $${formatMoney(mat)}`, mat);
  if (lab) addLine(`Labor: $${formatMoney(lab)}`, lab);
}

function pushManualSplitLines(
  pkg: EstimateDraftScopePackage,
  inp: ManualPricingInputs[string],
  lines: PricingProposalLine[],
  pushRate: (
    lineType: 'material' | 'labor',
    label: string,
    unitType: string,
    rateStr: string | undefined,
    quantity: number | null
  ) => void
) {
  const kind = classifyPackageKind(pkg.name);
  const qty = pkg.scopeQuantities?.[0];
  const splitKind = manualSplitInputKind(packageQuantityUnit(pkg));
  const matLabel =
    kind === 'flooring' ? 'Laminate material' : kind === 'baseboard' ? 'Baseboard material' : 'Materials';
  const labLabel =
    kind === 'flooring'
      ? 'Laminate install labor'
      : kind === 'baseboard'
        ? 'Baseboard install labor'
        : 'Labor';
  if (splitKind === 'sqft' && qty?.unit === 'sqft') {
    pushRate('material', matLabel, 'sqft', inp.materialRateSqft, qty.quantity);
    pushRate('labor', labLabel, 'sqft', inp.laborRateSqft, qty.quantity);
    return;
  }
  if (splitKind === 'lf' && qty?.unit === 'lf') {
    pushRate('material', matLabel, 'lf', inp.materialRateLf, qty.quantity);
    pushRate('labor', labLabel, 'lf', inp.laborRateLf, qty.quantity);
    const caulk = parseMoney(inp.caulkPaintLump);
    if (caulk) {
      lines.push({
        packageName: pkg.name,
        lineType: 'labor',
        label: 'Caulk & paint',
        unitType: 'lump_sum',
        quantity: null,
        unitRate: null,
        total: caulk,
        formula: `$${formatMoney(caulk)} lump sum`,
        priceSource: 'manually_entered',
        sourceLabel: 'Manually entered',
        confidence: 'high',
        status: 'confirmed',
      });
    }
    return;
  }
  const mat = parseMoney(inp.materialTotal);
  const lab = parseMoney(inp.laborTotal);
  if (mat) {
    lines.push({
      packageName: pkg.name,
      lineType: 'material',
      label: 'Materials',
      unitType: 'lump_sum',
      quantity: null,
      unitRate: null,
      total: mat,
      formula: `$${formatMoney(mat)} material`,
      priceSource: 'manually_entered',
      sourceLabel: 'Manually entered',
      confidence: 'high',
      status: 'confirmed',
    });
  }
  if (lab) {
    lines.push({
      packageName: pkg.name,
      lineType: 'labor',
      label: 'Labor',
      unitType: 'lump_sum',
      quantity: null,
      unitRate: null,
      total: lab,
      formula: `$${formatMoney(lab)} labor`,
      priceSource: 'manually_entered',
      sourceLabel: 'Manually entered',
      confidence: 'high',
      status: 'confirmed',
    });
  }
}

export function computeManualPackagePreview(
  pkg: EstimateDraftScopePackage,
  inp: ManualPricingInputs[string] | undefined
): ManualPackagePreview {
  const kind = classifyPackageKind(pkg.name);
  const mode = inp?.mode ?? defaultManualMode(kind);
  const qty = pkg.scopeQuantities?.[0];
  const breakdown: string[] = [];
  let total = 0;

  const addLine = (text: string, amount: number) => {
    if (amount > 0) {
      breakdown.push(text);
      total += amount;
    }
  };

  if (kind === 'tile_demo') {
    if (mode === 'lump_sum') {
      const lump = parseMoney(inp?.lumpSum);
      if (lump) addLine(`Demo lump sum: $${formatMoney(lump)}`, lump);
    } else {
      const rate = parseMoney(inp?.demoRateSqft);
      if (rate && qty?.unit === 'sqft') {
        const t = roundMoney(rate * qty.quantity);
        addLine(`Demo rate: $${rate}/sqft`, t);
        breakdown[breakdown.length - 1] = `${qty.quantity.toLocaleString()} sqft × $${rate}/sqft = $${formatMoney(t)}`;
      }
    }
  } else if (kind === 'flooring' || kind === 'baseboard' || kind === 'other') {
    if (mode === 'lump_sum') {
      const lump = parseMoney(inp?.lumpSum);
      if (lump) addLine(`Total: $${formatMoney(lump)}`, lump);
    } else if (mode === 'split') {
      addManualSplitPreview(pkg, inp, breakdown, addLine);
    }
  }

  return { packageName: pkg.name, breakdown, total: roundMoney(total) };
}

export function computeManualGrandTotal(
  draft: EstimateAiDraft,
  inputs: ManualPricingInputs
): number {
  return getScopePackages(draft).reduce((sum, pkg) => {
    return sum + computeManualPackagePreview(pkg, inputs[pkg.name]).total;
  }, 0);
}

export function buildManualPricingProposal(
  draft: EstimateAiDraft,
  inputs: ManualPricingInputs
): PricingProposal {
  const lines: PricingProposalLine[] = [];
  const packages = getScopePackages(draft);

  for (const pkg of packages) {
    const inp = inputs[pkg.name] || {};
    const qty = pkg.scopeQuantities?.[0];
    const name = pkg.name.toLowerCase();

    const pushRate = (
      lineType: 'material' | 'labor',
      label: string,
      unitType: string,
      rateStr: string | undefined,
      quantity: number | null
    ) => {
      const rate = parseMoney(rateStr);
      if (rate == null || rate <= 0 || quantity == null) return;
      const total = roundMoney(rate * quantity);
      lines.push({
        packageName: pkg.name,
        lineType,
        label,
        unitType,
        quantity,
        unitRate: rate,
        total,
        formula: `${quantity.toLocaleString()} ${formatDisplayUnit(unitType)} × $${rate}/${formatDisplayUnit(unitType)} = $${total.toLocaleString()}`,
        priceSource: 'manually_entered',
        sourceLabel: 'Manually entered',
        confidence: 'high',
        status: 'confirmed',
        requiresApproval: false,
      });
    };

    const kind = classifyPackageKind(pkg.name);
    const mode = inp.mode ?? defaultManualMode(kind);

    if (kind === 'tile_demo') {
      const q = qty?.unit === 'sqft' ? qty.quantity : null;
      if (mode === 'lump_sum') {
        const lump = parseMoney(inp.lumpSum);
        if (lump) {
          lines.push({
            packageName: pkg.name,
            lineType: 'lump_sum',
            label: 'Tile demo lump sum',
            unitType: 'lump_sum',
            quantity: null,
            unitRate: null,
            total: lump,
            formula: `$${formatMoney(lump)} lump sum`,
            priceSource: 'manually_entered',
            sourceLabel: 'Manually entered',
            confidence: 'high',
            status: 'confirmed',
          });
        }
      } else {
        pushRate('labor', 'Tile demo', 'sqft', inp.demoRateSqft, q);
      }
      continue;
    }

    if (kind === 'flooring' || kind === 'baseboard' || kind === 'other') {
      if (mode === 'lump_sum' || (kind === 'other' && mode === 'rate')) {
        const lump = parseMoney(inp.lumpSum);
        if (lump) {
          lines.push({
            packageName: pkg.name,
            lineType: 'lump_sum',
            label: `${pkg.name} total`,
            unitType: 'lump_sum',
            quantity: null,
            unitRate: null,
            total: lump,
            formula: `$${formatMoney(lump)} lump sum`,
            priceSource: 'manually_entered',
            sourceLabel: 'Manually entered',
            confidence: 'high',
            status: 'confirmed',
          });
        }
      } else if (mode === 'split') {
        pushManualSplitLines(pkg, inp, lines, pushRate);
      }
      continue;
    }
  }

  const totalSuggested = lines.reduce((s, l) => s + l.total, 0);
  return {
    empty: lines.length === 0,
    source: 'manual',
    sourceLabel: 'Manually entered',
    lines,
    totalSuggested,
    message: lines.length === 0 ? 'Enter at least one rate or lump sum.' : null,
  };
}

function parseMoney(raw?: string): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function manualRateInputString(rate: number | null | undefined): string | undefined {
  if (rate == null || rate <= 0) return undefined;
  const rounded = Math.round(rate * 100) / 100;
  return String(rounded % 1 === 0 ? rounded : rounded);
}

function proposalLinesForPackage(
  lines: PricingProposalLine[],
  packageName: string
): PricingProposalLine[] {
  return lines.filter(
    (l) => l.packageName === packageName || roomMatchesProposalPackage(packageName, l.packageName)
  );
}

/** Seed manual/adjust-rate fields from a saved or rough pricing proposal. */
export function manualPricingInputsFromProposal(
  draft: EstimateAiDraft,
  proposal: PricingProposal | null | undefined
): ManualPricingInputs {
  if (!proposal) return {};
  const normalized = normalizePricingProposal(proposal);
  const lines =
    normalized.lines?.length > 0
      ? normalized.lines
      : scopeItemsToProposalLines(normalized.scopeItems || []);
  if (!lines.length) return {};

  const inputs: ManualPricingInputs = {};
  for (const pkg of getScopePackages(draft)) {
    const pkgLines = proposalLinesForPackage(lines, pkg.name);
    if (!pkgLines.length) continue;

    const kind = classifyPackageKind(pkg.name);
    const inp: ManualPricingInputs[string] = {};
    const lump = pkgLines.find((l) => l.lineType === 'lump_sum' && (l.total || 0) > 0);
    if (lump) {
      inp.mode = 'lump_sum';
      inp.lumpSum = manualRateInputString(lump.total);
      inputs[pkg.name] = inp;
      continue;
    }

    const material = pkgLines.find((l) => l.lineType === 'material');
    const labor = pkgLines.find((l) => l.lineType === 'labor');

    if (kind === 'tile_demo') {
      if (labor?.unitRate) {
        inp.mode = 'rate';
        inp.demoRateSqft = manualRateInputString(labor.unitRate);
      }
    } else if (kind === 'flooring') {
      inp.mode = 'split';
      if (material?.unitRate) inp.materialRateSqft = manualRateInputString(material.unitRate);
      if (labor?.unitRate) inp.laborRateSqft = manualRateInputString(labor.unitRate);
    } else if (kind === 'baseboard') {
      inp.mode = 'split';
      if (material?.unitRate) inp.materialRateLf = manualRateInputString(material.unitRate);
      if (labor?.unitRate) inp.laborRateLf = manualRateInputString(labor.unitRate);
    } else {
      inp.mode = 'split';
      if (material?.unitRate) {
        if (material.unitType === 'lf') inp.materialRateLf = manualRateInputString(material.unitRate);
        else if (material.unitType === 'sqft') inp.materialRateSqft = manualRateInputString(material.unitRate);
        else if (material.total) inp.materialTotal = manualRateInputString(material.total);
      } else if (material?.total) {
        inp.materialTotal = manualRateInputString(material.total);
      }
      if (labor?.unitRate) {
        if (labor.unitType === 'lf') inp.laborRateLf = manualRateInputString(labor.unitRate);
        else if (labor.unitType === 'sqft') inp.laborRateSqft = manualRateInputString(labor.unitRate);
        else if (labor.total) inp.laborTotal = manualRateInputString(labor.total);
      } else if (labor?.total) {
        inp.laborTotal = manualRateInputString(labor.total);
      }
    }

    if (
      inp.lumpSum ||
      inp.demoRateSqft ||
      inp.materialRateSqft ||
      inp.laborRateSqft ||
      inp.materialRateLf ||
      inp.laborRateLf ||
      inp.materialTotal ||
      inp.laborTotal
    ) {
      inputs[pkg.name] = inp;
    }
  }
  return inputs;
}

/** Apply a uniform % bump to all filled manual rate fields. */
export function bumpManualInputRates(inputs: ManualPricingInputs, percent: number): ManualPricingInputs {
  const mult = 1 + percent / 100;
  const bump = (raw?: string) => {
    const n = parseMoney(raw);
    if (n == null) return raw;
    return manualRateInputString(n * mult);
  };
  const out: ManualPricingInputs = {};
  for (const [name, inp] of Object.entries(inputs)) {
    out[name] = {
      ...inp,
      demoRateSqft: bump(inp.demoRateSqft),
      materialRateSqft: bump(inp.materialRateSqft),
      laborRateSqft: bump(inp.laborRateSqft),
      materialRateLf: bump(inp.materialRateLf),
      laborRateLf: bump(inp.laborRateLf),
      materialTotal: bump(inp.materialTotal),
      laborTotal: bump(inp.laborTotal),
      lumpSum: bump(inp.lumpSum),
      caulkPaintLump: bump(inp.caulkPaintLump),
    };
  }
  return out;
}

export { fetchSuggestMissingPrices };
