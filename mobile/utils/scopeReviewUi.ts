import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import type { AssemblyComponentStatus } from '@/utils/scopeAssemblyRegistry';
import {
  itemSpecificAssemblyComponents,
  isItemSpecificAssemblyComponent,
  markManualPricingAdjustment,
} from '@/utils/acceptedPricingSummaryUi';
import type { ScopePricingAcceptanceMetadata } from '@/utils/acceptedPricingSummaryUi';
import {
  allowanceSplitSubKey,
  hasCompleteUserSelectedPricing,
  roughAllowanceSubKey,
  type ScopeItemQuantityValue,
  type SuggestedPricingBlock,
} from '@/utils/scopeItemQuantities';
import {
  benchmarkAssumptionLabel,
  benchmarkRecommendedResolution,
  canonicalBenchmarkScopeKey,
  findBenchmarkAssumption,
  getBenchmarkAssumptionReviewRequirement,
  HIGH_IMPACT_FALLBACK_SCOPE_KEYS,
  NATIONAL_AVERAGE_BASE_SCOPE_NOTE,
  buildNationalAverageScopeNote,
  scopeKeyFromBenchmarkProfile,
  type BenchmarkScopeAssumption,
  type BenchmarkScopeAssumptionProfile,
  type BenchmarkScopeAssumptionStatus,
} from '@/utils/benchmarkScopeAssumptions';
import {
  getTradeScopeGuidance,
  recommendedActionLabel,
  type TradeScopeGuidance,
} from '@/utils/tradeScopeGuidance';

export type ScopeGapResolutionStatus =
  | 'not_confirmed'
  | 'included'
  | 'excluded'
  | 'price_separately'
  | 'priced_elsewhere';

export type ScopeGapPricingStatus = 'not_required' | 'needs_pricing' | 'priced' | 'linked_elsewhere';

export type ScopeGapResolutionRecord = {
  status: ScopeGapResolutionStatus;
  pricingStatus?: ScopeGapPricingStatus;
  benchmarkAssumptionStatus?: BenchmarkScopeAssumptionStatus;
  benchmarkScopeKey?: string;
  benchmarkDisplayLabel?: string;
  benchmarkConditionText?: string;
  benchmarkSourceReference?: string;
  sourceRecordId?: string;
  parentPricingRecordId?: string;
  linkedLineItemId?: string;
  parentScopeItemId?: string;
  pricedElsewhereItemId?: string;
  customerFacingExclusion?: boolean;
  overriddenBenchmarkAssumption?: boolean;
  /** Dollars added to the parent scope price when included in the parent allowance. */
  parentPriceAddon?: number;
  /** Cost bucket the parent price addon rolls into on the accepted card. */
  parentPriceAddonBucket?: ScopeGapAddonCostBucket;
  updatedAt?: string;
};

export type ScopeGapAddonCostBucket = 'labor' | 'material' | 'allowance' | 'subcontractor';

/** Persisted on draft scopeMeasurements.scopeGapResolutions — key: `${scopeItemId}::${componentKey}` */
export type ScopeGapResolutionsMap = Record<string, ScopeGapResolutionRecord>;

export type ScopeGapPricingContext = {
  itemQuantities?: Record<
    string,
    ScopeItemQuantityValue | { quantity: string; unit: string; quantitySource?: string }
  >;
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>;
};

export const SCOPE_GAP_DISPLAY_LABELS: Record<string, string> = {
  loading: 'Loading excavated material',
  stockpiling: 'Stockpiling onsite',
  export: 'Haul-off / export',
  haul_off: 'Haul-off / export',
  spoils_export: 'Haul-off / export',
  dump_fees: 'Dump fees',
  backfill: 'Backfill',
  compaction: 'Compaction',
  testing: 'Compaction or soil testing',
  shoring: 'Shoring',
  disposal: 'Disposal / haul-off',
  cleanup_or_hauloff: 'Cleanup or haul-off',
  surface_restoration: 'Surface restoration',
  utility_coordination: 'Utility coordination',
  bedding: 'Bedding material',
  sawcutting: 'Sawcutting',
  cut: 'Cut',
  fill: 'Fill',
  import: 'Import material',
  protection: 'Protection of existing work',
  removal: 'Removal',
  equipment: 'Equipment',
  operator: 'Operator',
  excavation: 'Excavation work',
  trench_excavation: 'Trench excavation',
  meter_fees: 'Meter fees',
};

/** Checklist scope ids that can become separate line items when pricing a gap separately. */
const KNOWN_SCOPE_LINE_ITEM_IDS = new Set([
  'haul_off',
  'backfill',
  'grading',
  'excavation',
  'utility_trenching',
  'concrete',
  'demo',
  'cleanup',
  'compaction',
  'permits',
  'sitework',
  'trenching',
  'foundation',
  'plumbing_rough',
  'electrical_rough',
  'roofing',
  'framing',
  'insulation',
  'drywall',
  'flooring',
  'paint',
  'cabinets',
  'countertops',
  'hvac',
]);

/** High-priority item-specific gaps by checklist scope id (not exhaustive — filters info-severity noise). */
export const TRADE_PRIORITY_GAP_KEYS: Record<string, readonly string[]> = {
  excavation: ['export', 'haul_off', 'spoils_export', 'dump_fees', 'backfill', 'compaction', 'shoring'],
  utility_trenching: ['spoils_export', 'backfill', 'compaction', 'bedding', 'surface_restoration'],
  grading: ['export', 'compaction', 'cut', 'fill', 'import'],
  sitework: ['export', 'compaction', 'haul_off', 'dump_fees'],
  demo: ['haul_off', 'disposal', 'dump_fees'],
  floor_demo: ['haul_off', 'disposal'],
  wall_demo: ['haul_off', 'disposal'],
  concrete: ['sawcutting', 'haul_off', 'disposal'],
  foundation: ['excavation', 'backfill', 'compaction'],
  cleanup: ['disposal', 'haul_off', 'dump_fees'],
  plumbing_rough: ['sawcutting', 'backfill'],
  electrical_rough: ['sawcutting', 'trenching'],
  roofing: ['disposal', 'protection'],
  framing: ['shoring', 'protection'],
  insulation: ['air_sealing', 'vapor_barrier'],
  drywall: ['texture', 'patching'],
  flooring: ['floor_prep', 'disposal'],
  paint: ['prep', 'protection'],
  cabinets: ['installation', 'trim'],
  countertops: ['template', 'installation'],
  hvac: ['startup', 'registers'],
  permits: ['meter_fees', 'plan_check'],
};

export function scopeGapResolutionKey(scopeItemId: string, componentKey: string): string {
  return `${scopeItemId}::${componentKey}`;
}

export function parseScopeGapResolutionKey(key: string): { scopeItemId: string; componentKey: string } | null {
  const idx = key.indexOf('::');
  if (idx <= 0) return null;
  return { scopeItemId: key.slice(0, idx), componentKey: key.slice(idx + 2) };
}

export function getScopeGapDisplayLabel(componentKey: string, fallbackLabel: string): string {
  return SCOPE_GAP_DISPLAY_LABELS[componentKey] || fallbackLabel;
}

export function normalizeScopeGapRecord(record: ScopeGapResolutionRecord): ScopeGapResolutionRecord {
  if (record.pricingStatus) return record;
  switch (record.status) {
    case 'included':
      return { ...record, pricingStatus: 'not_required' };
    case 'excluded':
      return { ...record, pricingStatus: 'not_required', customerFacingExclusion: true };
    case 'priced_elsewhere':
      return { ...record, pricingStatus: 'linked_elsewhere' };
    case 'price_separately':
      return { ...record, pricingStatus: 'needs_pricing' };
    default:
      return record;
  }
}

export function getScopeGapRecord(
  resolutions: ScopeGapResolutionsMap | undefined,
  scopeItemId: string,
  componentKey: string
): ScopeGapResolutionRecord | null {
  const raw = resolutions?.[scopeGapResolutionKey(scopeItemId, componentKey)];
  return raw ? normalizeScopeGapRecord(raw) : null;
}

export function linkedLineItemHasValidPricing(
  lineItemId: string | undefined,
  pricingContext?: ScopeGapPricingContext
): boolean {
  if (!lineItemId || !pricingContext) return false;
  const { itemQuantities = {}, pricingAcceptance = {} } = pricingContext;
  if (pricingAcceptance[lineItemId]) return true;
  if (hasCompleteUserSelectedPricing(itemQuantities as Record<string, ScopeItemQuantityValue>, lineItemId)) {
    return true;
  }
  const allowanceKey = allowanceSplitSubKey(lineItemId, 'allowance');
  const roughKey = roughAllowanceSubKey(lineItemId);
  const candidates = [itemQuantities[allowanceKey], itemQuantities[roughKey], itemQuantities[lineItemId]];
  return candidates.some(
    (entry) =>
      entry?.quantitySource === 'user_entered' &&
      Number(String(entry.quantity ?? '').replace(/,/g, '')) > 0
  );
}

export function isScopeGapScopeDecisionMade(record: ScopeGapResolutionRecord | null | undefined): boolean {
  return Boolean(record && record.status !== 'not_confirmed');
}

export function isScopeGapFullyResolved(
  record: ScopeGapResolutionRecord | null | undefined,
  pricingContext?: ScopeGapPricingContext
): boolean {
  if (!record || record.status === 'not_confirmed') return false;
  const normalized = normalizeScopeGapRecord(record);
  if (normalized.status === 'price_separately') {
    if (normalized.pricingStatus === 'priced') return true;
    return linkedLineItemHasValidPricing(normalized.linkedLineItemId, pricingContext);
  }
  return normalized.status === 'included' || normalized.status === 'excluded' || normalized.status === 'priced_elsewhere';
}

/** @deprecated Use isScopeGapFullyResolved — kept for callers that only check scope status. */
export function isScopeGapResolved(status: ScopeGapResolutionStatus | undefined): boolean {
  return status === 'included' || status === 'excluded' || status === 'priced_elsewhere';
}

export function resolveScopeGapStatus(
  resolutions: ScopeGapResolutionsMap | undefined,
  scopeItemId: string,
  componentKey: string
): ScopeGapResolutionStatus {
  return getScopeGapRecord(resolutions, scopeItemId, componentKey)?.status || 'not_confirmed';
}

export function scopeGapStatusActionLabel(status: ScopeGapResolutionStatus): string {
  switch (status) {
    case 'included':
      return 'Included';
    case 'excluded':
      return 'Not in this bid';
    case 'price_separately':
      return 'Price separately';
    case 'priced_elsewhere':
      return 'Covered elsewhere';
    default:
      return 'Not confirmed';
  }
}

export type ScopeGapResolutionActionChoice = {
  status: ScopeGapResolutionStatus;
  label: string;
};

export type ScopeGapResolutionActionGroups = {
  primary: ScopeGapResolutionActionChoice[];
  moreOptions: ScopeGapResolutionActionChoice[];
};

export function scopeGapResolutionActionGroups(
  assumptionStatus?: BenchmarkScopeAssumptionStatus,
  options?: { offersIncludeWithCost?: boolean }
): ScopeGapResolutionActionGroups {
  const offersIncludeWithCost = options?.offersIncludeWithCost ?? false;

  if (assumptionStatus === 'included') {
    return {
      primary: [
        { status: 'included', label: 'Keep included' },
        { status: 'price_separately', label: 'Add as separate item' },
      ],
      moreOptions: [
        { status: 'priced_elsewhere', label: 'Covered elsewhere' },
        { status: 'excluded', label: 'Not in this bid' },
      ],
    };
  }

  if (assumptionStatus === 'conditional') {
    return {
      primary: [
        { status: 'included', label: 'Condition applies - keep included' },
        { status: 'price_separately', label: 'Condition does not apply - add separately' },
      ],
      moreOptions: [
        { status: 'priced_elsewhere', label: 'Covered elsewhere' },
        { status: 'excluded', label: 'Not in this bid' },
      ],
    };
  }

  if (assumptionStatus === 'excluded' || (assumptionStatus == null && offersIncludeWithCost)) {
    return {
      primary: [
        { status: 'price_separately', label: 'Add as separate item' },
        { status: 'excluded', label: 'Not in this bid' },
      ],
      moreOptions: [
        { status: 'priced_elsewhere', label: 'Covered elsewhere' },
        { status: 'included', label: 'Include without price change' },
      ],
    };
  }

  return {
    primary: [
      { status: 'included', label: 'Include without price change' },
      { status: 'price_separately', label: 'Add as separate item' },
      { status: 'excluded', label: 'Not in this bid' },
    ],
    moreOptions: [{ status: 'priced_elsewhere', label: 'Covered elsewhere' }],
  };
}

export function shouldAutoExpandScopeGapMoreOptions(
  record: ScopeGapResolutionRecord | null,
  actionGroups: ScopeGapResolutionActionGroups
): boolean {
  if (!record || record.status === 'not_confirmed') return false;
  const normalized = normalizeScopeGapRecord(record);
  if (
    normalized.status === 'included' &&
    normalized.parentPriceAddon != null &&
    normalized.parentPriceAddon > 0
  ) {
    return false;
  }
  return actionGroups.moreOptions.some((choice) => choice.status === normalized.status);
}

export function scopeGapStatusRowLabel(
  record: ScopeGapResolutionRecord | null,
  pricingContext?: ScopeGapPricingContext,
  benchmarkPrefill?: ScopeGapResolutionStatus | null
): string {
  if (!record || record.status === 'not_confirmed') {
    if (benchmarkPrefill === 'included') return 'Included';
    return 'Not confirmed';
  }
  const normalized = normalizeScopeGapRecord(record);
  switch (normalized.status) {
    case 'included':
      if (normalized.parentPriceAddon != null && normalized.parentPriceAddon > 0) {
        return `Included (+$${Math.round(normalized.parentPriceAddon).toLocaleString()})`;
      }
      return 'Included';
    case 'excluded':
      return 'Not in bid';
    case 'priced_elsewhere':
      return 'Covered elsewhere';
    case 'price_separately':
      if (
        normalized.pricingStatus === 'needs_pricing' &&
        !linkedLineItemHasValidPricing(normalized.linkedLineItemId, pricingContext)
      ) {
        return 'Needs separate price';
      }
      return 'Priced separately';
    default:
      return 'Not confirmed';
  }
}

/** @deprecated Prefer scopeGapStatusRowLabel with full record. */
export function scopeGapStatusLabel(status: ScopeGapResolutionStatus): string {
  return scopeGapStatusActionLabel(status);
}

export function resolveSeparateLineItemId(
  component: AssemblyComponentStatus,
  parentScopeItemId: string
): string {
  for (const key of component.relatedScopeKeys || []) {
    if (key !== parentScopeItemId && KNOWN_SCOPE_LINE_ITEM_IDS.has(key)) return key;
  }
  if (component.key !== parentScopeItemId && KNOWN_SCOPE_LINE_ITEM_IDS.has(component.key)) {
    return component.key;
  }
  for (const key of component.relatedScopeKeys || []) {
    if (key !== parentScopeItemId) return key;
  }
  return `${parentScopeItemId}__gap__${component.key}`;
}

export function buildSeparateScopeChecklistItem(
  lineItemId: string,
  component: AssemblyComponentStatus,
  parentScopeItemId: string
): ScopeChecklistItem {
  const label = getScopeGapDisplayLabel(component.key, component.label);
  return {
    id: lineItemId,
    inputType: 'yes_no',
    label,
    helperText: `Priced separately from ${parentScopeItemId.replace(/_/g, ' ')}.`,
    state: 'included',
    category: 'scope_gap',
    derivedFrom: parentScopeItemId,
  };
}

export function ensureSeparateScopeItemInChecklist(
  items: ScopeChecklistItem[],
  component: AssemblyComponentStatus,
  parentScopeItemId: string
): { items: ScopeChecklistItem[]; lineItemId: string; created: boolean } {
  const lineItemId = resolveSeparateLineItemId(component, parentScopeItemId);
  const existing = items.find((item) => item.id === lineItemId);
  if (existing) {
    if (existing.state === 'excluded') {
      return {
        items: items.map((item) =>
          item.id === lineItemId ? { ...item, state: 'included' as const } : item
        ),
        lineItemId,
        created: false,
      };
    }
    return { items, lineItemId, created: false };
  }
  return {
    items: [...items, buildSeparateScopeChecklistItem(lineItemId, component, parentScopeItemId)],
    lineItemId,
    created: true,
  };
}

function notesMentionComponent(notes: string, component: AssemblyComponentStatus): boolean {
  const lower = notes.toLowerCase();
  const label = component.label.toLowerCase();
  const display = getScopeGapDisplayLabel(component.key, component.label).toLowerCase();
  return lower.includes(label) || lower.includes(display) || lower.includes(component.key.replace(/_/g, ' '));
}

export function shouldShowComponentInScopeReview(
  component: AssemblyComponentStatus,
  scopeKey: string,
  notes?: string | null
): boolean {
  if (!isItemSpecificAssemblyComponent(component, scopeKey)) return false;
  if (component.severity === 'blocking' || component.severity === 'warning' || component.severity === 'review') {
    return true;
  }
  const priorities = TRADE_PRIORITY_GAP_KEYS[scopeKey];
  if (priorities?.includes(component.key)) return true;
  if (notes?.trim() && notesMentionComponent(notes.trim(), component)) return true;
  return false;
}

function buildFallbackScopeComponent(
  componentKey: string,
  parentScopeKey: string
): AssemblyComponentStatus {
  return {
    key: componentKey,
    label: getScopeGapDisplayLabel(componentKey, componentKey.replace(/_/g, ' ')),
    status: 'unknown',
    severity: 'review',
    relatedScopeKeys: [parentScopeKey, componentKey],
    message: '',
  };
}

function dedupeReviewableComponents(components: AssemblyComponentStatus[]): AssemblyComponentStatus[] {
  const seen = new Set<string>();
  return components.filter((component) => {
    const canonicalKey = canonicalBenchmarkScopeKey(component.key);
    if (seen.has(canonicalKey)) return false;
    seen.add(canonicalKey);
    return true;
  });
}

export function getReviewableScopeComponents(
  unknownComponents: AssemblyComponentStatus[] | undefined,
  scopeKey: string,
  notes?: string | null,
  benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
): AssemblyComponentStatus[] {
  if (benchmarkProfile?.scopeAssumptionsDefined) {
    return benchmarkProfile.scopeAssumptions
      .map((assumption) => {
        const component: AssemblyComponentStatus = {
          key: assumption.scopeKey,
          label: assumption.displayLabel || getScopeGapDisplayLabel(assumption.scopeKey, assumption.scopeKey.replace(/_/g, ' ')),
          status: 'unknown',
          severity: assumption.riskLevel === 'high' ? 'review' : 'info',
          relatedScopeKeys: [scopeKey, assumption.scopeKey],
          message: assumption.conditionText || benchmarkAssumptionLabel(assumption, benchmarkProfile),
        };
        return getBenchmarkAssumptionReviewRequirement({
          assumption,
          component,
          scopeKey,
          profile: benchmarkProfile,
        }).requiresReview
          ? component
          : null;
      })
      .filter(Boolean) as AssemblyComponentStatus[];
  }

  const priorities =
    TRADE_PRIORITY_GAP_KEYS[scopeKey] || HIGH_IMPACT_FALLBACK_SCOPE_KEYS[scopeKey] || [];
  const fromAssembly = itemSpecificAssemblyComponents(unknownComponents, scopeKey).filter((component) =>
    shouldShowComponentInScopeReview(component, scopeKey, notes)
  );
  const byKey = new Map(fromAssembly.map((component) => [component.key, component]));
  for (const key of priorities) {
    if (!byKey.has(key)) {
      byKey.set(key, buildFallbackScopeComponent(key, scopeKey));
    }
  }
  const ordered = priorities
    .map((key) => byKey.get(key))
    .filter(Boolean) as AssemblyComponentStatus[];
  for (const component of fromAssembly) {
    if (
      !priorities.includes(component.key) &&
      (component.severity === 'blocking' ||
        component.severity === 'warning' ||
        component.severity === 'review')
    ) {
      ordered.push(component);
    }
  }
  return dedupeReviewableComponents(ordered);
}

export function countReviewableScopeAssumptions(
  unknownComponents: AssemblyComponentStatus[] | undefined,
  scopeKey: string,
  notes?: string | null,
  benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
): number {
  return getReviewableScopeComponents(unknownComponents, scopeKey, notes, benchmarkProfile).length;
}

export function benchmarkAssumptionForComponent(
  benchmarkProfile: BenchmarkScopeAssumptionProfile | null | undefined,
  component: AssemblyComponentStatus
): BenchmarkScopeAssumption | null {
  return findBenchmarkAssumption(benchmarkProfile, component.key);
}

export function benchmarkAssumptionRowLabel(
  benchmarkProfile: BenchmarkScopeAssumptionProfile | null | undefined,
  component: AssemblyComponentStatus
): string {
  return benchmarkAssumptionLabel(benchmarkAssumptionForComponent(benchmarkProfile, component), benchmarkProfile);
}

export function scopeReviewRowGuidance(
  scopeKey: string,
  component: AssemblyComponentStatus,
  benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
): TradeScopeGuidance | null {
  const assumption = benchmarkAssumptionForComponent(benchmarkProfile, component);
  if (benchmarkProfile?.scopeAssumptionsDefined && assumption?.status !== 'unknown') {
    return null;
  }
  return getTradeScopeGuidance(scopeKey, component.key);
}

export function scopeReviewRecommendedActionLabel(params: {
  scopeKey: string;
  component: AssemblyComponentStatus;
  benchmarkProfile?: BenchmarkScopeAssumptionProfile | null;
}): string | null {
  const assumption = benchmarkAssumptionForComponent(params.benchmarkProfile, params.component);
  if (params.benchmarkProfile?.scopeAssumptionsDefined) {
    if (assumption?.status === 'excluded') return 'Recommended: Add as separate item';
    if (assumption?.status === 'included' && assumption.riskLevel !== 'high') {
      return 'Recommended: Keep included';
    }
    if (assumption?.status === 'conditional') return 'Recommended: Confirm project conditions';
    return null;
  }
  const guidance = scopeReviewRowGuidance(params.scopeKey, params.component, params.benchmarkProfile);
  return guidance ? recommendedActionLabel(guidance.recommendedAction) : null;
}

export function benchmarkResolutionPrefillStatus(params: {
  record: ScopeGapResolutionRecord | null;
  benchmarkProfile?: BenchmarkScopeAssumptionProfile | null;
  component: AssemblyComponentStatus;
}): ScopeGapResolutionStatus | null {
  if (params.record && params.record.status !== 'not_confirmed') return null;
  const assumption = benchmarkAssumptionForComponent(params.benchmarkProfile, params.component);
  const recommended = benchmarkRecommendedResolution(assumption, params.benchmarkProfile);
  return recommended;
}

export function benchmarkScopeSummary(
  profile: BenchmarkScopeAssumptionProfile | null | undefined,
  priceLabel: string,
  scopeKey?: string
): {
  title: string;
  body: string;
  included: string[];
  notIncluded: string[];
  conditional: string[];
} {
  const resolvedScopeKey = scopeKey || scopeKeyFromBenchmarkProfile(profile);
  if (!profile?.scopeAssumptionsDefined) {
    const isNationalAverage = profile?.pricingSource === 'national_average';
    const scopeNote = buildNationalAverageScopeNote({ profile, scopeKey: resolvedScopeKey });
    return {
      title: isNationalAverage ? 'Base national average only' : 'Benchmark inclusions not defined',
      body: isNationalAverage
        ? `${scopeNote} Use the guidance below to confirm each high-impact item.`
        : 'This source does not specify all included work. Use the guidance below to confirm each high-impact item.',
      included: [],
      notIncluded: [],
      conditional: [],
    };
  }
  const source = profile.pricingSource ? profile.pricingSource.replace(/_/g, ' ') : 'benchmark';
  const isNationalAverage = profile.pricingSource === 'national_average';
  const included = profile.scopeAssumptions
    .filter((item) => item.status === 'included')
    .map((item) => item.displayLabel || getScopeGapDisplayLabel(item.scopeKey, item.scopeKey.replace(/_/g, ' ')))
    .slice(0, 4);
  const notIncluded = profile.scopeAssumptions
    .filter((item) => item.status === 'excluded')
    .map((item) => item.displayLabel || getScopeGapDisplayLabel(item.scopeKey, item.scopeKey.replace(/_/g, ' ')))
    .slice(0, 4);
  const conditional = profile.scopeAssumptions
    .filter((item) => item.status === 'conditional')
    .map((item) => {
      const label = item.displayLabel || getScopeGapDisplayLabel(item.scopeKey, item.scopeKey.replace(/_/g, ' '));
      return item.conditionText ? `${label}: ${item.conditionText}` : label;
    })
    .slice(0, 3);
  return {
    title: isNationalAverage
      ? `Base national average scope for ${priceLabel}`
      : `What the ${priceLabel} suggested price includes`,
    body: isNationalAverage
      ? buildNationalAverageScopeNote({ profile, scopeKey: resolvedScopeKey })
      : `This ${source} price carries a defined scope-assumption profile.`,
    included,
    notIncluded,
    conditional,
  };
}

export function countUnresolvedScopeDecisions(
  scopeItemId: string,
  components: AssemblyComponentStatus[],
  resolutions?: ScopeGapResolutionsMap
): number {
  return components.filter((component) => {
    const record = getScopeGapRecord(resolutions, scopeItemId, component.key);
    return !isScopeGapScopeDecisionMade(record);
  }).length;
}

export function countNeedsSeparatePricing(
  scopeItemId: string,
  components: AssemblyComponentStatus[],
  resolutions?: ScopeGapResolutionsMap,
  pricingContext?: ScopeGapPricingContext
): number {
  return components.filter((component) => {
    const record = getScopeGapRecord(resolutions, scopeItemId, component.key);
    if (!record || record.status !== 'price_separately') return false;
    return !isScopeGapFullyResolved(record, pricingContext);
  }).length;
}

export function countUnresolvedScopeGaps(
  scopeItemId: string,
  components: AssemblyComponentStatus[],
  resolutions?: ScopeGapResolutionsMap,
  pricingContext?: ScopeGapPricingContext
): number {
  return components.filter(
    (component) => !isScopeGapFullyResolved(getScopeGapRecord(resolutions, scopeItemId, component.key), pricingContext)
  ).length;
}

export function countReviewedScopeGaps(
  scopeItemId: string,
  components: AssemblyComponentStatus[],
  resolutions?: ScopeGapResolutionsMap,
  pricingContext?: ScopeGapPricingContext
): number {
  return components.filter((component) =>
    isScopeGapFullyResolved(getScopeGapRecord(resolutions, scopeItemId, component.key), pricingContext)
  ).length;
}

export function formatReviewScopeItemsLabel(unresolvedCount: number): string {
  if (unresolvedCount <= 0) return '';
  return unresolvedCount === 1 ? 'Review 1 scope item' : `Review ${unresolvedCount} scope items`;
}

export function formatNeedsSeparatePricingLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '1 item still needs pricing' : `${count} items still need pricing`;
}

export function buildScopeReviewFooterText(params: {
  total: number;
  unresolvedDecisionCount: number;
  reviewedCount: number;
  needsPricingCount: number;
}): string {
  const { total, unresolvedDecisionCount, reviewedCount, needsPricingCount } = params;
  if (unresolvedDecisionCount > 0) {
    return `${unresolvedDecisionCount} item${unresolvedDecisionCount === 1 ? '' : 's'} still need review`;
  }
  if (needsPricingCount > 0) {
    if (reviewedCount > 0 && reviewedCount < total) {
      return `${reviewedCount} of ${total} reviewed · ${needsPricingCount} still need${needsPricingCount === 1 ? 's' : ''} pricing`;
    }
    return formatNeedsSeparatePricingLabel(needsPricingCount);
  }
  return `${reviewedCount} of ${total} reviewed`;
}

export function buildScopeReviewSheetTitle(scopeItemLabel: string): string {
  const trimmed = scopeItemLabel.trim();
  if (!trimmed) return 'Review scope';
  return `Review ${trimmed.toLowerCase()} scope`;
}

export function buildScopeReviewSheetSubtitle(
  scopeItemLabel: string,
  priceLabel: string,
  options?: {
    scopeKey?: string;
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null;
  }
): string {
  const scope = scopeItemLabel.trim().toLowerCase() || 'this';
  const price = priceLabel.trim() || 'accepted';
  const scopeNote = buildNationalAverageScopeNote({
    profile: options?.benchmarkProfile,
    scopeKey: options?.scopeKey,
  });
  return `${scopeNote} Confirm how each item applies to the ${price} ${scope} price.`;
}

export function buildScopeGapResolutionPrompt(
  componentLabel: string,
  priceLabel: string,
  scopeItemLabel: string,
  assumptionStatus?: BenchmarkScopeAssumptionStatus
): string {
  const price = priceLabel.trim() || 'this price';
  const scope = scopeItemLabel.trim().toLowerCase() || 'scope';
  switch (assumptionStatus) {
    case 'excluded':
      return `${componentLabel} is not included in the ${price} suggested ${scope} price. How should it be handled?`;
    case 'included':
      return `The benchmark assumes ${componentLabel} is included in the ${price} ${scope} price.`;
    case 'conditional':
      return `Does the stated condition apply for ${componentLabel} in the ${price} ${scope} price?`;
    default:
      return `How should ${componentLabel} be handled for the ${price} ${scope} price?`;
  }
}

export function applyScopeGapExclusionsToDraft(
  exclusions: string[],
  resolutions?: ScopeGapResolutionsMap,
  previousResolutions?: ScopeGapResolutionsMap
): string[] {
  const prevGap = new Set(collectScopeGapExclusionLabelsFromEntries(previousResolutions));
  const nextGap = collectScopeGapExclusionLabelsFromEntries(resolutions);
  const nextGapSet = new Set(nextGap);
  const kept = exclusions.filter((label) => !prevGap.has(label) || nextGapSet.has(label));
  for (const label of nextGap) {
    if (!kept.includes(label)) kept.push(label);
  }
  return kept;
}

export function collectScopeGapExclusionLabelsFromEntries(
  resolutions: ScopeGapResolutionsMap | undefined
): string[] {
  const labels: string[] = [];
  for (const [key, raw] of Object.entries(resolutions || {})) {
    const normalized = normalizeScopeGapRecord(raw);
    if (normalized.status !== 'excluded') continue;
    const parsed = parseScopeGapResolutionKey(key);
    if (!parsed) continue;
    const label = getScopeGapDisplayLabel(parsed.componentKey, parsed.componentKey.replace(/_/g, ' '));
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

export function syncScopeGapPricingStatuses(
  resolutions: ScopeGapResolutionsMap | undefined,
  pricingContext?: ScopeGapPricingContext
): ScopeGapResolutionsMap {
  if (!resolutions) return {};
  let changed = false;
  const next: ScopeGapResolutionsMap = {};
  for (const [key, raw] of Object.entries(resolutions)) {
    const record = normalizeScopeGapRecord(raw);
    if (record.status === 'price_separately') {
      const hasPricing = linkedLineItemHasValidPricing(record.linkedLineItemId, pricingContext);
      const pricingStatus: ScopeGapPricingStatus = hasPricing ? 'priced' : 'needs_pricing';
      if (record.pricingStatus !== pricingStatus) {
        changed = true;
        next[key] = { ...record, pricingStatus, updatedAt: new Date().toISOString() };
        continue;
      }
    }
    next[key] = record;
  }
  return changed ? next : resolutions;
}

export type SetScopeGapResolutionOptions = {
  pricedElsewhereItemId?: string;
  linkedLineItemId?: string;
  parentScopeItemId?: string;
  parentPriceAddon?: number;
  componentKey?: string;
  pricingContext?: ScopeGapPricingContext;
  benchmarkAssumption?: BenchmarkScopeAssumption | null;
  benchmarkProfile?: BenchmarkScopeAssumptionProfile | null;
};

function readScopeQuantityAmount(
  entry:
    | ScopeItemQuantityValue
    | { quantity: string; unit: string; quantitySource?: string }
    | undefined
): number {
  const parsed = Number(String(entry?.quantity ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function bumpSuggestedPricingBlock(
  block: SuggestedPricingBlock,
  addonAmount: number,
  bucket: ScopeGapAddonCostBucket = 'labor'
): SuggestedPricingBlock {
  return adjustSuggestedPricingBlock(block, addonAmount, bucket);
}

export function scopeGapAddonCostBucketForComponent(componentKey: string): ScopeGapAddonCostBucket {
  const key = canonicalBenchmarkScopeKey(componentKey);
  const allowanceKeys = new Set([
    'haul_off',
    'export',
    'spoils_export',
    'disposal',
    'dump_fees',
    'cleanup_or_hauloff',
    'cleanup',
    'stockpiling',
  ]);
  const materialKeys = new Set(['reinforcement', 'rebar', 'wire_mesh', 'bedding', 'import', 'imported_fill']);
  if (allowanceKeys.has(key)) return 'allowance';
  if (materialKeys.has(key)) return 'material';
  return 'labor';
}

function applyBucketDelta(
  bucket: ScopeGapAddonCostBucket,
  amounts: {
    material: number;
    labor: number;
    allowance: number;
    subcontractor: number;
  },
  delta: number
): void {
  if (!Number.isFinite(delta) || delta === 0) return;
  switch (bucket) {
    case 'material':
      amounts.material = Math.max(0, amounts.material + delta);
      break;
    case 'labor':
      amounts.labor = Math.max(0, amounts.labor + delta);
      break;
    case 'allowance':
      amounts.allowance = Math.max(0, amounts.allowance + delta);
      break;
    case 'subcontractor':
      amounts.subcontractor = Math.max(0, amounts.subcontractor + delta);
      break;
    default:
      break;
  }
}

export function adjustSuggestedPricingBlock(
  block: SuggestedPricingBlock,
  delta: number,
  bucket: ScopeGapAddonCostBucket = 'labor'
): SuggestedPricingBlock {
  if (!Number.isFinite(delta) || delta === 0) return block;
  const next: SuggestedPricingBlock = { ...block, total: Math.max(0, block.total + delta) };
  switch (bucket) {
    case 'material':
      next.material = Math.max(0, block.material + delta);
      break;
    case 'labor':
      if (block.labor > 0) {
        next.labor = Math.max(0, block.labor + delta);
      } else if (block.material > 0) {
        next.material = Math.max(0, block.material + delta);
      }
      break;
    case 'allowance':
    case 'subcontractor':
      break;
    default:
      break;
  }
  return next;
}

export function applyParentScopeGapPriceAddon(params: {
  parentScopeItemId: string;
  componentKey: string;
  addonAmount: number;
  previousAddonAmount?: number;
  previousAddonBucket?: ScopeGapAddonCostBucket;
  itemQuantities?: ScopeGapPricingContext['itemQuantities'];
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>;
}): {
  itemQuantities: NonNullable<ScopeGapPricingContext['itemQuantities']>;
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>;
} {
  const {
    parentScopeItemId,
    componentKey,
    addonAmount,
    previousAddonAmount = 0,
    previousAddonBucket,
  } = params;
  const itemQuantities = { ...(params.itemQuantities || {}) };
  const bucket = scopeGapAddonCostBucketForComponent(componentKey);
  const delta = addonAmount - previousAddonAmount;
  if (!Number.isFinite(addonAmount) || addonAmount < 0 || delta === 0) {
    return { itemQuantities, pricingAcceptance: params.pricingAcceptance };
  }

  const acceptance = params.pricingAcceptance?.[parentScopeItemId];
  const allowanceKey = roughAllowanceSubKey(parentScopeItemId);
  const materialKey = allowanceSplitSubKey(parentScopeItemId, 'material');
  const laborKey = allowanceSplitSubKey(parentScopeItemId, 'labor');

  const amounts = {
    material: acceptance?.materialAmount ?? readScopeQuantityAmount(itemQuantities[materialKey]),
    labor: acceptance?.laborAmount ?? readScopeQuantityAmount(itemQuantities[laborKey]),
    allowance: acceptance?.allowanceAmount ?? 0,
    subcontractor: acceptance?.subcontractorAmount ?? 0,
  };
  if (previousAddonAmount > 0) {
    applyBucketDelta(previousAddonBucket || bucket, amounts, -previousAddonAmount);
  }
  applyBucketDelta(bucket, amounts, addonAmount);

  const newTotal =
    amounts.material + amounts.labor + amounts.allowance + amounts.subcontractor;

  const userEntered = { quantitySource: 'user_entered' as const };
  const parentUnit = itemQuantities[parentScopeItemId]?.unit || 'allowance';
  itemQuantities[parentScopeItemId] = {
    quantity: String(newTotal),
    unit: parentUnit,
    ...userEntered,
  };
  itemQuantities[allowanceKey] = {
    quantity: String(newTotal),
    unit: 'allowance',
    ...userEntered,
  };
  if (amounts.material > 0) {
    itemQuantities[materialKey] = {
      quantity: String(amounts.material),
      unit: 'allowance',
      ...userEntered,
    };
  }
  if (amounts.labor > 0) {
    itemQuantities[laborKey] = {
      quantity: String(amounts.labor),
      unit: 'allowance',
      ...userEntered,
    };
  }

  let pricingAcceptance = params.pricingAcceptance;
  if (acceptance) {
    pricingAcceptance = markManualPricingAdjustment(acceptance, parentScopeItemId, pricingAcceptance, newTotal);
    const adjusted = pricingAcceptance?.[parentScopeItemId];
    if (adjusted) {
      pricingAcceptance = {
        ...pricingAcceptance,
        [parentScopeItemId]: {
          ...adjusted,
          materialAmount: amounts.material > 0 ? amounts.material : adjusted.materialAmount,
          laborAmount: amounts.labor > 0 ? amounts.labor : adjusted.laborAmount,
          allowanceAmount: amounts.allowance > 0 ? amounts.allowance : undefined,
          subcontractorAmount: amounts.subcontractor > 0 ? amounts.subcontractor : undefined,
        },
      };
    }
  } else if (newTotal > 0) {
    pricingAcceptance = {
      ...(pricingAcceptance || {}),
      [parentScopeItemId]: {
        selectionStatus: 'manual_adjusted',
        pricingSourceLabel: 'User adjusted',
        pricingSourceKind: 'user_entered',
        pricingTypeLabel:
          amounts.material > 0 && amounts.labor > 0 ? 'Material + labor split' : 'Lump sum allowance',
        totalAmount: newTotal,
        materialAmount: amounts.material > 0 ? amounts.material : undefined,
        laborAmount: amounts.labor > 0 ? amounts.labor : undefined,
        allowanceAmount: amounts.allowance > 0 ? amounts.allowance : undefined,
        subcontractorAmount: amounts.subcontractor > 0 ? amounts.subcontractor : undefined,
      },
    };
  }

  return { itemQuantities, pricingAcceptance };
}

export function collectParentIncludedScopeGapLines(
  parentScopeItemId: string,
  resolutions: ScopeGapResolutionsMap | undefined
): string[] {
  const lines: string[] = [];
  for (const [key, raw] of Object.entries(resolutions || {})) {
    const parsed = parseScopeGapResolutionKey(key);
    if (!parsed || parsed.scopeItemId !== parentScopeItemId) continue;
    const record = normalizeScopeGapRecord(raw);
    if (record.status !== 'included' || !record.parentPriceAddon || record.parentPriceAddon <= 0) continue;
    const label = getScopeGapDisplayLabel(parsed.componentKey, parsed.componentKey.replace(/_/g, ' '));
    lines.push(`${label} (+$${Math.round(record.parentPriceAddon).toLocaleString()})`);
  }
  return lines;
}

export function formatParentIncludedScopeGapSummary(
  parentScopeItemId: string,
  resolutions: ScopeGapResolutionsMap | undefined,
  options?: { maxVisible?: number }
): string | null {
  const lines = collectParentIncludedScopeGapLines(parentScopeItemId, resolutions);
  if (!lines.length) return null;
  const maxVisible = options?.maxVisible ?? 2;
  if (lines.length > maxVisible) {
    const countLabel = lines.length === 1 ? '1 added scope item' : `${lines.length} added scope items`;
    return `Includes: ${countLabel}`;
  }
  return `Includes: ${lines.join(' · ')}`;
}

export function setScopeGapResolution(
  resolutions: ScopeGapResolutionsMap | undefined,
  scopeItemId: string,
  componentKey: string,
  status: ScopeGapResolutionStatus,
  options: SetScopeGapResolutionOptions = {}
): ScopeGapResolutionsMap {
  const key = scopeGapResolutionKey(scopeItemId, componentKey);
  const next = { ...(resolutions || {}) };
  if (status === 'not_confirmed') {
    delete next[key];
    return next;
  }

  let pricingStatus: ScopeGapPricingStatus = 'not_required';
  let customerFacingExclusion = false;
  let linkedLineItemId = options.linkedLineItemId;
  const pricedElsewhereItemId = options.pricedElsewhereItemId;
  const benchmarkAssumption = options.benchmarkAssumption;
  const overriddenBenchmarkAssumption =
    Boolean(benchmarkAssumption) &&
    !(
      (benchmarkAssumption?.status === 'included' && status === 'included') ||
      (benchmarkAssumption?.status === 'excluded' && status === 'price_separately') ||
      (benchmarkAssumption?.status === 'conditional' && status === 'included')
    );

  switch (status) {
    case 'included':
      pricingStatus = 'not_required';
      break;
    case 'excluded':
      pricingStatus = 'not_required';
      customerFacingExclusion = true;
      break;
    case 'priced_elsewhere':
      pricingStatus = 'linked_elsewhere';
      break;
    case 'price_separately': {
      pricingStatus = linkedLineItemHasValidPricing(linkedLineItemId, options.pricingContext)
        ? 'priced'
        : 'needs_pricing';
      break;
    }
    default:
      break;
  }

  next[key] = {
    status,
    pricingStatus,
    ...(benchmarkAssumption
      ? {
          benchmarkAssumptionStatus: benchmarkAssumption.status,
          benchmarkScopeKey: benchmarkAssumption.scopeKey,
          benchmarkDisplayLabel: benchmarkAssumption.displayLabel,
          benchmarkConditionText: benchmarkAssumption.conditionText,
          benchmarkSourceReference: benchmarkAssumption.sourceReference,
        }
      : {}),
    ...(options.benchmarkProfile?.sourceRecordId ? { sourceRecordId: options.benchmarkProfile.sourceRecordId } : {}),
    ...(options.benchmarkProfile?.parentPricingRecordId ? { parentPricingRecordId: options.benchmarkProfile.parentPricingRecordId } : {}),
    ...(linkedLineItemId ? { linkedLineItemId } : {}),
    ...(options.parentScopeItemId ? { parentScopeItemId: options.parentScopeItemId } : {}),
    ...(pricedElsewhereItemId ? { pricedElsewhereItemId } : {}),
    ...(customerFacingExclusion ? { customerFacingExclusion: true } : {}),
    ...(overriddenBenchmarkAssumption ? { overriddenBenchmarkAssumption: true } : {}),
    ...(options.parentPriceAddon != null && options.parentPriceAddon > 0
      ? {
          parentPriceAddon: options.parentPriceAddon,
          parentPriceAddonBucket: scopeGapAddonCostBucketForComponent(componentKey),
        }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  return next;
}

export const SCOPE_GAP_RESOLUTION_ACTIONS: ScopeGapResolutionStatus[] = [
  'included',
  'excluded',
  'price_separately',
  'priced_elsewhere',
];
