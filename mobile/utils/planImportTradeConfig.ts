import {
  getSubcontractorTradeDefinition,
  getTradeScopeAllowlist,
  PLAN_EXPORT_TRADE_KEYS,
  type LegacyPlanTradeKey,
  type SubcontractorTradeKey,
} from '@/utils/subcontractorTrade';

export type PlanEstimatingMode = 'whole_project' | 'selected_trade';

export type { SubcontractorTradeKey, LegacyPlanTradeKey };
export type PlanTradeKey = SubcontractorTradeKey | LegacyPlanTradeKey;

export { PLAN_EXPORT_TRADE_KEYS };

export type PlanTradeConfiguration = {
  key: PlanTradeKey;
  label: string;
  status: 'reference' | 'stub';
  scopeHint: string;
  missingInfo: string[];
  reviewMeasurementKeys?: string[];
  reviewScopeKeywords?: string[];
};

function subcontractorDefinitionToPlanConfig(
  key: SubcontractorTradeKey
): PlanTradeConfiguration {
  const def = getSubcontractorTradeDefinition(key)!;
  return {
    key: def.key,
    label: def.label,
    status: def.status === 'reference' || def.status === 'complete' ? 'reference' : 'stub',
    scopeHint: def.scopeHint,
    missingInfo: def.missingInfo,
    reviewMeasurementKeys: def.reviewMeasurementKeys,
    reviewScopeKeywords: def.reviewScopeKeywords,
  };
}

const LEGACY_PLAN_TRADE_CONFIGURATIONS: PlanTradeConfiguration[] = [
  {
    key: 'painting',
    label: 'Painting',
    status: 'stub',
    scopeHint:
      'Focus on painting sheets and notes; do not infer detailed quantities.',
    missingInfo: [
      'Trade-specific plan/schedule details',
      'Scope inclusions and exclusions',
      'Quantities requiring contractor confirmation',
    ],
    reviewScopeKeywords: ['painting', 'paint'],
  },
  {
    key: 'cabinets',
    label: 'Cabinets',
    status: 'stub',
    scopeHint:
      'Focus on cabinets sheets and notes; do not infer detailed quantities.',
    missingInfo: [
      'Trade-specific plan/schedule details',
      'Scope inclusions and exclusions',
      'Quantities requiring contractor confirmation',
    ],
    reviewScopeKeywords: ['cabinets', 'cabinet'],
  },
  {
    key: 'landscaping',
    label: 'Landscaping',
    status: 'stub',
    scopeHint:
      'Focus on landscaping sheets and notes; do not infer detailed quantities.',
    missingInfo: [
      'Trade-specific plan/schedule details',
      'Scope inclusions and exclusions',
      'Quantities requiring contractor confirmation',
    ],
    reviewScopeKeywords: ['landscaping', 'landscape'],
  },
  {
    key: 'other',
    label: 'Other',
    status: 'stub',
    scopeHint:
      'Focus on other sheets and notes; do not infer detailed quantities.',
    missingInfo: [
      'Trade-specific plan/schedule details',
      'Scope inclusions and exclusions',
      'Quantities requiring contractor confirmation',
    ],
    reviewScopeKeywords: ['other'],
  },
];

/** Trades shown in Plan Export / Single Trade menu (11 supported trades). */
export const PLAN_EXPORT_TRADE_CONFIGURATIONS: PlanTradeConfiguration[] =
  PLAN_EXPORT_TRADE_KEYS.map(subcontractorDefinitionToPlanConfig);

/** All trade configs including legacy keys for persisted draft compatibility. */
export const PLAN_TRADE_CONFIGURATIONS: PlanTradeConfiguration[] = [
  ...PLAN_EXPORT_TRADE_CONFIGURATIONS,
  ...LEGACY_PLAN_TRADE_CONFIGURATIONS,
];

export const WHOLE_PROJECT_PLAN_TRADE: PlanTradeConfiguration = {
  key: 'electrical',
  label: 'Whole project',
  status: 'reference',
  scopeHint:
    'Read the complete plan set and preserve existing whole-project behavior.',
  missingInfo: [],
};

export function getPlanTradeConfiguration(
  key: string | null | undefined
): PlanTradeConfiguration | null {
  return PLAN_TRADE_CONFIGURATIONS.find(trade => trade.key === key) || null;
}

export function normalizePlanImportSelection(
  mode?: PlanEstimatingMode | null,
  tradeKey?: string | null
): { mode: PlanEstimatingMode; trade: PlanTradeConfiguration | null } {
  const trade = getPlanTradeConfiguration(tradeKey);
  return {
    mode:
      mode === 'selected_trade' && trade ? 'selected_trade' : 'whole_project',
    trade: mode === 'selected_trade' ? trade : null,
  };
}

export function filterPlanMeasurementsForTrade(
  measurements: Record<string, number>,
  mode?: PlanEstimatingMode,
  tradeKey?: PlanTradeKey | null
): Record<string, number>;
export function filterPlanMeasurementsForTrade(
  measurements: Record<string, number | string>,
  mode?: PlanEstimatingMode,
  tradeKey?: PlanTradeKey | null
): Record<string, number | string>;
export function filterPlanMeasurementsForTrade(
  measurements: Record<string, number | string>,
  mode?: PlanEstimatingMode,
  tradeKey?: PlanTradeKey | null
): Record<string, number | string> {
  if (mode !== 'selected_trade') return measurements;
  const config = getPlanTradeConfiguration(tradeKey);
  const allowed = config?.reviewMeasurementKeys || [];
  return Object.fromEntries(
    Object.entries(measurements || {}).filter(([key]) => allowed.includes(key))
  );
}

export function tradeQuickMeasurementFieldKeys(
  tradeKey?: PlanTradeKey | null
): string[] {
  const def = getSubcontractorTradeDefinition(tradeKey || '');
  if (def?.quickMeasurementFieldKeys?.length) {
    return def.quickMeasurementFieldKeys;
  }
  if (tradeKey === 'painting') {
    return ['exteriorPaintSqft', 'wallPaintSqft'];
  }
  return [];
}

export function filterPlanScopesForTrade<
  T extends {
    itemId?: string | null;
    label?: string | null;
    evidence?: string | null;
  },
>(
  detections: T[],
  mode?: PlanEstimatingMode,
  tradeKey?: PlanTradeKey | null
): T[] {
  if (mode !== 'selected_trade') return detections;
  const allowedIds = getTradeScopeAllowlist(tradeKey);
  if (allowedIds?.length) {
    return detections.filter(detection =>
      allowedIds.includes(String(detection.itemId || '').trim())
    );
  }
  const keywords =
    getPlanTradeConfiguration(tradeKey)?.reviewScopeKeywords || [];
  if (!keywords.length) return [];
  return detections.filter(detection => {
    const haystack =
      `${detection.itemId || ''} ${detection.label || ''} ${detection.evidence || ''}`.toLowerCase();
    return keywords.some(keyword => haystack.includes(keyword));
  });
}

export function filterChecklistItemsForTrade<T extends { id: string }>(
  items: T[],
  mode?: PlanEstimatingMode,
  tradeKey?: PlanTradeKey | null
): T[] {
  if (mode !== 'selected_trade') return items;
  const allowed = getTradeScopeAllowlist(tradeKey);
  return allowed ? items.filter(item => allowed.includes(item.id)) : items;
}

const WHOLE_PROJECT_QUICK_MEASUREMENT_KEYS = [
  'bathroomFloorSqft',
  'kitchenFloorSqft',
  'floorAreaSqft',
  'flooringSqft',
  'garageSqft',
  'deckSqft',
  'concreteSqft',
  'concreteDemoSqft',
  'concreteCy',
  'excavationCy',
  'roofAreaSqft',
  'roofSquares',
  'roofPitch',
  'storyCount',
  'roofDeckingReplacementSqft',
  'roofDripEdgeLf',
  'roofRidgeCapLf',
  'roofRidgeVentLf',
  'roofValleyFlashingLf',
  'roofStepFlashingLf',
  'roofWallFlashingLf',
  'roofChimneyFlashingCount',
  'roofPipeBootCount',
  'roofVentCount',
  'roofTurbineVentCount',
  'roofSkylightCount',
  'roofPenetrationCount',
  'roofRepairAffectedSqft',
  'roofGutterLf',
  'roofDownspoutCount',
  'drywallSqft',
  'wallPaintSqft',
  'ceilingPaintSqft',
  'paintAreaSqft',
  'baseboardLf',
  'interiorDoorCount',
  'cabinetLf',
  'cabinetRunLf',
  'cabinetUpperLf',
  'cabinetLowerLf',
  'cabinetTallLf',
  'cabinetPaintSqft',
  'countertopSqft',
  'backsplashSqft',
  'showerWallTileSqft',
  'showerFloorTileSqft',
  'landscapeSqft',
  'artificialTurfSqft',
  'demoClearingSqft',
  'gradingSqft',
  'soilPrepSqft',
  'sodSqft',
  'paverSqft',
  'rockMulchSqft',
  'landscapeTons',
  'flooringLvpSqft',
  'flooringLaminateSqft',
  'flooringEngineeredHardwoodSqft',
  'flooringSolidHardwoodSqft',
  'flooringTileSqft',
  'flooringCarpetSqft',
  'floorDemoSqft',
  'floorPrepSqft',
  'underlaymentSqft',
  'moistureBarrierSqft',
  'transitionLf',
  'transitionCount',
  'quarterRoundLf',
  'railingLf',
  'exteriorPaintSqft',
] as const;

/** Resolve single-trade plan import from measurements, draft, or Step 1 payload. */
export function resolveSingleTradePlanContext(
  sources: {
    measurements?: {
      planImportMode?: PlanEstimatingMode | null;
      planImportTradeKey?: PlanTradeKey | null;
    } | null;
    draftScopeMeasurements?: {
      planImportMode?: PlanEstimatingMode | null;
      planImportTradeKey?: PlanTradeKey | null;
    } | null;
    planImport?: {
      estimatingMode?: PlanEstimatingMode;
      selectedTrade?: PlanTradeKey | null;
    } | null;
  } = {}
): { isSingleTrade: boolean; tradeKey: PlanTradeKey | null } {
  const mode =
    sources.measurements?.planImportMode ??
    sources.draftScopeMeasurements?.planImportMode ??
    sources.planImport?.estimatingMode;
  const tradeKey =
    sources.measurements?.planImportTradeKey ??
    sources.draftScopeMeasurements?.planImportTradeKey ??
    sources.planImport?.selectedTrade ??
    null;
  const isSingleTrade = mode === 'selected_trade' && Boolean(tradeKey);
  return { isSingleTrade, tradeKey: isSingleTrade ? tradeKey : null };
}

/** Drop whole-project quick measurements and scope quantities for trade-only Step 2. */
export function stripScopeInputForSingleTrade<T extends Record<string, unknown>>(
  input: T,
  tradeKey: PlanTradeKey | null
): T {
  const allowedQm = new Set(tradeQuickMeasurementFieldKeys(tradeKey));
  const next = { ...input };
  for (const key of WHOLE_PROJECT_QUICK_MEASUREMENT_KEYS) {
    if (!allowedQm.has(key)) {
      if (typeof next[key] === 'string') next[key] = '';
      else if (key in next) delete next[key];
    }
  }
  delete next.planRooms;
  delete next.planFacts;
  delete next.areaReconciliation;
  delete next.garageDoorSingleCount;
  delete next.garageDoorDoubleCount;
  delete next.garageDoorRvCount;
  delete next.wetAreaFinish;
  delete next.bathCount;
  delete next.tilePanBathCount;
  delete next.prefabBathCount;
  delete next.prefabEnclosureBathCount;
  delete next.tubBathCount;
  delete next.bathFloorTileCount;
  delete next.showerDoorCount;
  const allowedScopeIds = getTradeScopeAllowlist(tradeKey) || [];
  if (allowedScopeIds.length && next.itemQuantities) {
    const quantities = next.itemQuantities as Record<string, unknown>;
    next.itemQuantities = Object.fromEntries(
      Object.entries(quantities).filter(([id]) =>
        allowedScopeIds.some(
          allowed => id === allowed || id.startsWith(`${allowed}__`)
        )
      )
    );
  }
  return next;
}

// Re-export shared trade definitions for callers that need the full contract.
export {
  getPlanExportTradeConfigurations,
  getSubcontractorTradeDefinition,
  getTradeScopeAllowlist,
  normalizeTradeMeasurements,
  SUBCONTRACTOR_TRADE_DEFINITIONS,
} from '@/utils/subcontractorTrade';
