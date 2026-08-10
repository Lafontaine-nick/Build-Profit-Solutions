export type PlanEstimatingMode = 'whole_project' | 'selected_trade';

export type PlanTradeKey =
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'roofing'
  | 'concrete'
  | 'framing'
  | 'drywall'
  | 'painting'
  | 'stucco'
  | 'insulation'
  | 'flooring'
  | 'cabinets'
  | 'windows_doors'
  | 'landscaping'
  | 'other';

export type PlanTradeConfiguration = {
  key: PlanTradeKey;
  label: string;
  status: 'reference' | 'stub';
  scopeHint: string;
  missingInfo: string[];
  reviewMeasurementKeys?: string[];
  reviewScopeKeywords?: string[];
};

export const PLAN_TRADE_CONFIGURATIONS: PlanTradeConfiguration[] = [
  {
    key: 'electrical',
    label: 'Electrical',
    status: 'reference',
    scopeHint:
      'Focus on electrical sheets, panels, circuits, devices, lighting, and electrical notes.',
    missingInfo: [
      'Device and fixture counts',
      'Panel/circuit schedule',
      'Service size and utility scope',
    ],
    reviewMeasurementKeys: [],
    reviewScopeKeywords: [
      'electrical',
      'receptacle',
      'switch',
      'lighting',
      'panel',
      'circuit',
      'smoke',
      'detector',
    ],
  },
  ...(
    [
      ['plumbing', 'Plumbing'],
      ['hvac', 'HVAC'],
      ['roofing', 'Roofing'],
      ['concrete', 'Concrete'],
      ['framing', 'Framing'],
      ['drywall', 'Drywall'],
      ['painting', 'Painting'],
      ['stucco', 'Stucco / Exterior Finish'],
      ['insulation', 'Insulation'],
      ['flooring', 'Flooring'],
      ['cabinets', 'Cabinets'],
      ['windows_doors', 'Windows & doors'],
      ['landscaping', 'Landscaping'],
      ['other', 'Other'],
    ] as ReadonlyArray<[PlanTradeKey, string]>
  ).map(([key, label]) => ({
    key,
    label,
    status: 'stub' as const,
    scopeHint: `Focus on ${label.toLowerCase()} sheets and notes; do not infer detailed quantities.`,
    missingInfo:
      label === 'Stucco / Exterior Finish'
        ? [
            'Exterior wall area and openings',
            'Stucco system and finish',
            'Access, scaffolding, and repair conditions',
          ]
        : [
            'Trade-specific plan/schedule details',
            'Scope inclusions and exclusions',
            'Quantities requiring contractor confirmation',
          ],
    reviewMeasurementKeys:
      key === 'stucco'
        ? [
            'stuccoSqft',
            'exteriorWallSqft',
            'exteriorFinishSqft',
            'exteriorFinishesSqft',
            'exteriorPaintSqft',
          ]
        : [],
    reviewScopeKeywords:
      key === 'stucco'
        ? ['stucco']
        : String(label)
            .toLowerCase()
            .split(/[^\w]+/)
            .filter(Boolean),
  })),
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
): Record<string, number> {
  if (mode !== 'selected_trade') return measurements;
  const config = getPlanTradeConfiguration(tradeKey);
  const allowed = config?.reviewMeasurementKeys || [];
  return Object.fromEntries(
    Object.entries(measurements || {}).filter(([key]) => allowed.includes(key))
  );
}

const TRADE_SCOPE_ITEM_IDS: Partial<Record<PlanTradeKey, string[]>> = {
  electrical: ['electrical_rough'],
  stucco: ['stucco'],
};

export function tradeQuickMeasurementFieldKeys(
  tradeKey?: PlanTradeKey | null
): string[] {
  const byTrade: Partial<Record<PlanTradeKey, string[]>> = {
    stucco: ['exteriorPaintSqft'],
    painting: ['exteriorPaintSqft', 'wallPaintSqft'],
  };
  return byTrade[tradeKey || 'other'] || [];
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
  const allowedIds = TRADE_SCOPE_ITEM_IDS[tradeKey || 'other'];
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
  const allowedByTrade: Partial<Record<PlanTradeKey, string[]>> = {
    electrical: ['electrical_rough'],
    stucco: ['stucco'],
  };
  const allowed = allowedByTrade[tradeKey || 'other'];
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
  'roofSquares',
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
  const allowedScopeIds = TRADE_SCOPE_ITEM_IDS[tradeKey || 'other'] || [];
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
