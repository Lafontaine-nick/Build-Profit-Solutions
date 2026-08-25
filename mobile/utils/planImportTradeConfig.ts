import {
  getSubcontractorTradeDefinition,
  getTradeScopeAllowlist,
  PLAN_EXPORT_TRADE_KEYS,
  type LegacyPlanTradeKey,
  type SubcontractorTradeKey,
} from '@/utils/subcontractorTrade';
import {
  PLUMBING_PLAN_QUICK_MEASUREMENT_KEYS,
  PLUMBING_PLAN_SCOPE_ALLOWLIST,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import {
  FRAMING_PLAN_QUICK_MEASUREMENT_KEYS,
  FRAMING_PLAN_SCOPE_ALLOWLIST,
} from '@/utils/subcontractorTrade/framingPlanConvergence';

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
    status:
      def.status === 'reference' || def.status === 'complete'
        ? 'reference'
        : 'stub',
    scopeHint: def.scopeHint,
    missingInfo: def.missingInfo,
    reviewMeasurementKeys: def.reviewMeasurementKeys,
    reviewScopeKeywords: def.reviewScopeKeywords,
  };
}

const LEGACY_PLAN_TRADE_CONFIGURATIONS: PlanTradeConfiguration[] = [
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

/** Trades shown in Plan Export / Single Trade menu. */
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
  const allowed =
    tradeKey === 'plumbing'
      ? [...PLUMBING_PLAN_QUICK_MEASUREMENT_KEYS]
      : tradeKey === 'framing'
        ? [...FRAMING_PLAN_QUICK_MEASUREMENT_KEYS]
        : config?.reviewMeasurementKeys || [];
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
  return [];
}

/** Plan-detected Electrical packages stay confirmation-only until the contractor selects them. */
const ELECTRICAL_PLAN_CONFIRMATION_ONLY_SCOPE_IDS = new Set([
  'electrical_rough',
  'electrical_trim',
  'electrical',
  'cleanup',
]);

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
  const allowedIds =
    tradeKey === 'plumbing'
      ? [...PLUMBING_PLAN_SCOPE_ALLOWLIST]
      : tradeKey === 'framing'
        ? [...FRAMING_PLAN_SCOPE_ALLOWLIST]
        : getTradeScopeAllowlist(tradeKey);
  const keepDetection = (detection: T) => {
    const itemId = String(detection.itemId || '').trim();
    if (
      tradeKey === 'electrical' &&
      ELECTRICAL_PLAN_CONFIRMATION_ONLY_SCOPE_IDS.has(itemId)
    ) {
      return false;
    }
    if (allowedIds?.length) {
      return allowedIds.includes(itemId);
    }
    const keywords =
      getPlanTradeConfiguration(tradeKey)?.reviewScopeKeywords || [];
    if (!keywords.length) return false;
    const haystack =
      `${detection.itemId || ''} ${detection.label || ''} ${detection.evidence || ''}`.toLowerCase();
    return keywords.some(keyword => haystack.includes(keyword));
  };
  return detections.filter(keepDetection);
}

export function filterChecklistItemsForTrade<T extends { id: string }>(
  items: T[],
  mode?: PlanEstimatingMode,
  tradeKey?: PlanTradeKey | null
): T[] {
  if (mode !== 'selected_trade') return items;
  const allowed =
    tradeKey === 'plumbing'
      ? [...PLUMBING_PLAN_SCOPE_ALLOWLIST]
      : tradeKey === 'framing'
        ? [...FRAMING_PLAN_SCOPE_ALLOWLIST]
        : getTradeScopeAllowlist(tradeKey);
  const filtered = allowed ? items.filter(item => allowed.includes(item.id)) : items;
  if (tradeKey !== 'windows_doors') return filtered;

  const combined = filtered.find(item => item.id === 'windows_doors');
  const cards = [
    ['windows', 'Windows', 'Window units — material and installation.'],
    [
      'exterior_doors',
      'Exterior doors',
      'Swing entry/exit doors — material and installation. Not sliding or garage.',
    ],
    [
      'sliding_doors',
      'Sliding doors',
      'Patio / multi-panel sliding doors — material and installation.',
    ],
    [
      'garage_doors',
      'Garage doors',
      'Single, double, or RV/oversized garage doors — type counts required.',
    ],
  ] as const;
  const combinedIndex =
    combined ? filtered.indexOf(combined) : filtered.length;
  const existingIds = new Set(filtered.map(item => item.id));
  const missingCards = cards.filter(([id]) => !existingIds.has(id));
  const withoutCombined = filtered.filter(item => item.id !== 'windows_doors');
  const cardBase =
    combined ||
    ({
      id: 'windows_doors',
      label: 'Windows & doors',
      inputType: 'yes_no',
      state: 'unsure',
      category: 'exterior',
    } as T);
  return [
    ...withoutCombined.slice(0, combinedIndex),
    ...missingCards.map(([id, label, helperText]) =>
      ({
        ...cardBase,
        id,
        label,
        helperText,
      } as T)
    ),
    ...withoutCombined.slice(combinedIndex),
  ];
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
      tradeWorkflowSource?: 'standalone_trade' | null;
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
  const isStandaloneTrade =
    sources.planImport?.tradeWorkflowSource === 'standalone_trade';
  const isSingleTrade =
    mode === 'selected_trade' && Boolean(tradeKey) && !isStandaloneTrade;
  return { isSingleTrade, tradeKey: isSingleTrade ? tradeKey : null };
}

/** Drop whole-project quick measurements and scope quantities for trade-only Step 2. */
export function stripScopeInputForSingleTrade<
  T extends Record<string, unknown>,
>(input: T, tradeKey: PlanTradeKey | null): T {
  const preserveMepComplexity =
    tradeKey === 'electrical' || tradeKey === 'plumbing';
  const complexitySnapshot = preserveMepComplexity
    ? {
        planFacts: input.planFacts,
        floorAreaSqft: input.floorAreaSqft,
        storyCount: input.storyCount,
        projectComplexity: input.projectComplexity,
        floorAreaSource: (input.quickMeasurementSources as Record<string, string> | undefined)
          ?.floorAreaSqft,
        storySource: (input.quickMeasurementSources as Record<string, string> | undefined)
          ?.storyCount,
      }
    : null;
  const allowedQm = new Set(tradeQuickMeasurementFieldKeys(tradeKey));
  const next = { ...input };
  for (const key of WHOLE_PROJECT_QUICK_MEASUREMENT_KEYS) {
    if (!allowedQm.has(key)) {
      if (typeof next[key] === 'string') next[key] = '';
      else if (key in next) delete next[key];
    }
  }
  delete next.planRooms;
  // Insulation and drywall derive quantities from plan facts / room geometry.
  if (tradeKey !== 'insulation' && tradeKey !== 'drywall') delete next.planFacts;
  delete next.areaReconciliation;
  if (tradeKey !== 'windows_doors') {
    delete next.garageDoorSingleCount;
    delete next.garageDoorDoubleCount;
    delete next.garageDoorRvCount;
  }
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
  if (complexitySnapshot) {
    if (complexitySnapshot.planFacts) next.planFacts = complexitySnapshot.planFacts;
    if (complexitySnapshot.floorAreaSqft) {
      next.floorAreaSqft = complexitySnapshot.floorAreaSqft;
    }
    if (complexitySnapshot.storyCount) next.storyCount = complexitySnapshot.storyCount;
    if (complexitySnapshot.projectComplexity) {
      next.projectComplexity = complexitySnapshot.projectComplexity;
    }
    if (complexitySnapshot.floorAreaSource || complexitySnapshot.storySource) {
      next.quickMeasurementSources = {
        ...(next.quickMeasurementSources as Record<string, string> | undefined),
        ...(complexitySnapshot.floorAreaSource
          ? { floorAreaSqft: complexitySnapshot.floorAreaSource }
          : {}),
        ...(complexitySnapshot.storySource
          ? { storyCount: complexitySnapshot.storySource }
          : {}),
      };
    }
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
