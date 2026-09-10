import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import { resolveBathroomGlassDoorSuggestedPricing } from '@/utils/bathroomGlassDoorPricing';
import { resolveKitchenBacksplashDemoSuggestedPricing } from '@/utils/kitchenBacksplashDemoPricing';
import {
  parseEnteredBathroomPatchSqft,
  resolveBathroomDrywallPatchSuggestedPricing,
  resolveKitchenDrywallPatchSuggestedPricing,
} from '@/utils/bathroomDrywallPatchPricing';
import {
  resolveBathroomPaintRepairScope,
  shouldUseCombinedDrywallPaintAssembly,
} from '@/utils/bathroomDrywallPaintScope';
import { paintRepairScopeSelectionComplete } from '@/utils/bathroomPaintRepairFlow';
import { resolveBathroomInteriorPaintSuggestedPricing } from '@/utils/bathroomInteriorPaintPricing';
import { resolveBathroomPaintRepairSuggestedPricing } from '@/utils/bathroomPaintRepairPricing';
import { resolveBathroomPlumbingRoughSuggestedPricing } from '@/utils/bathroomPlumbingRoughPricing';
import { resolveBathroomPlumbingTrimSuggestedPricing } from '@/utils/bathroomPlumbingTrimPricing';
import { resolveBathroomWetAreaDemoSuggestedPricing } from '@/utils/bathroomWetAreaDemoPricing';
import {
  PREFAB_ENCLOSURE_DEMO_EACH,
  PREFAB_PAN_DEMO_EACH,
  SHOWER_DOOR_DEMO_EACH,
  TUB_DEMO_EACH,
} from '@/utils/bathroomWetAreaDemoPricing';
import type {
  ScopeItemSuggestedPricing,
  ScopeMeasurementsInputExtended,
  ScopePricingContext,
} from '@/utils/scopeItemQuantities';
import {
  getChecklistItemQuantityRuleOrDefault,
  readStoredSqftPricingBasis,
  shouldSuppressSuggestedPricingAfterApply,
} from '@/utils/scopeItemQuantities';
import { parseScopeMeasurementInput } from '@/utils/scopeMeasurements';
import { isElectricalServicePanelItemId } from '@/utils/subcontractorTrade/electricalServicePanelPricing';
import { isElectricalCircuitItemId } from '@/utils/subcontractorTrade/electricalCircuitPricing';
import { isElectricalReceptacleItemId } from '@/utils/subcontractorTrade/electricalReceptaclePricing';
import { isElectricalSwitchItemId } from '@/utils/subcontractorTrade/electricalSwitchPricing';
import { isElectricalLightingFanItemId } from '@/utils/subcontractorTrade/electricalLightingFanPricing';
import { isElectricalHookupItemId } from '@/utils/subcontractorTrade/electricalHookupPricing';
import { isElectricalSpecialSystemItemId } from '@/utils/subcontractorTrade/electricalSpecialSystemsPricing';
import { isElectricalModificationItemId } from '@/utils/subcontractorTrade/electricalModificationPricing';
import { isElectricalRacewayItemId } from '@/utils/subcontractorTrade/electricalRacewayPricing';
import { isElectricalTrimItemId } from '@/utils/subcontractorTrade/electricalTrimPricing';
import { isElectricalRoughItemId } from '@/utils/subcontractorTrade/electricalRoughPricing';

/** How Step 2 should treat pricing for a checklist row before Apply. */
export type Step2PricingTier =
  | 'auto_planning'
  | 'prompt_first'
  | 'takeoff_required'
  | 'comparison_only';

export type Step2PricingPromptKey =
  | 'bathroom_plumbing_access'
  | 'bathroom_plumbing_work_type'
  | 'toilet_relocate_floor'
  | 'vanity_countertop_material'
  | 'paint_repair_scope'
  | 'interior_paint_scope'
  | 'glass_door_style'
  | 'backsplash_demo_difficulty';

export type Step2PricingTierConfig = {
  tier: Step2PricingTier;
  /** Short basis shown in “Needs …” when no planning total is available. */
  takeoffLabel?: string;
  /** Read-only benchmark hint when takeoff is required (no line total). */
  benchmarkUnitHint?: string;
  promptKey?: Step2PricingPromptKey;
};

const DEFAULT_TIER: Step2PricingTierConfig = { tier: 'takeoff_required' };

/** Default tiers — template overrides below take precedence. */
const GLOBAL_STEP2_PRICING_TIER: Record<string, Step2PricingTierConfig> = {
  plumbing_rough: {
    tier: 'takeoff_required',
    takeoffLabel: 'plumbing rough-in points',
    benchmarkUnitHint: '~$500 per rough-in point',
  },
  electrical_rough: {
    tier: 'takeoff_required',
    takeoffLabel: 'circuit / device count',
    benchmarkUnitHint: '~$175 per circuit/device',
  },
  hvac: {
    tier: 'takeoff_required',
    takeoffLabel: 'HVAC system count or tons',
    benchmarkUnitHint: '~$7,500+ per system (varies widely)',
  },
  insulation: {
    tier: 'takeoff_required',
    takeoffLabel: 'whole-house insulation surface SF',
  },
  drywall: {
    tier: 'takeoff_required',
    takeoffLabel: 'wall and ceiling surface SF',
    benchmarkUnitHint: '~$2.10 per SF (hang/finish)',
  },
  patch_repair: {
    tier: 'takeoff_required',
    takeoffLabel: 'patch/repair SF',
    benchmarkUnitHint: '~$2.10 per SF',
  },
  interior_paint: {
    tier: 'takeoff_required',
    takeoffLabel: 'paintable wall/ceiling SF',
  },
  paint: {
    tier: 'takeoff_required',
    takeoffLabel: 'paintable wall/ceiling SF',
  },
  permits: { tier: 'takeoff_required', takeoffLabel: 'local fee confirmation' },
  plans_engineering: { tier: 'takeoff_required', takeoffLabel: 'allowance' },
  cleanup: { tier: 'auto_planning' },
};

const GROUND_UP_STEP2_PRICING_TIER: Record<string, Step2PricingTierConfig> = {
  framing: {
    tier: 'auto_planning',
    takeoffLabel: 'covered framed SF (living + garage)',
  },
  mep_rough: { tier: 'comparison_only', takeoffLabel: 'child MEP trade lines' },
  exterior: { tier: 'comparison_only', takeoffLabel: 'child exterior trade lines' },
  interior_finishes: {
    tier: 'comparison_only',
    takeoffLabel: 'child finish trade lines',
  },
  sitework: { tier: 'comparison_only', takeoffLabel: 'child site trade lines' },
};

const BATHROOM_STEP2_PRICING_TIER: Record<string, Step2PricingTierConfig> = {
  // Planning host only — never bulk-apply a stage allowance on bathroom remodel.
  interior_finishes: {
    tier: 'comparison_only',
    takeoffLabel: 'child finish trade lines',
  },
  demo: {
    tier: 'takeoff_required',
    takeoffLabel: 'shower tile demo SF',
    benchmarkUnitHint:
      '~$5.50/SF tile · tub/prefab pan $350 · enclosure $600 · shower door $125',
  },
  floor_demo: {
    tier: 'takeoff_required',
    takeoffLabel: 'bathroom floor demo SF',
    benchmarkUnitHint: '~$5.50/SF',
  },
  vanity_demo: { tier: 'auto_planning' },
  countertop_demo: { tier: 'auto_planning' },
  shower_tile: { tier: 'takeoff_required', takeoffLabel: 'shower wall tile SF' },
  shower_pan: {
    tier: 'takeoff_required',
    takeoffLabel: 'shower floor sqft (mud pan area)',
    benchmarkUnitHint: '~$99/SF mud pan build ($27 mat + $72 labor) · scales with pan size',
  },
  shower_floor_tile: { tier: 'takeoff_required', takeoffLabel: 'shower floor tile SF' },
  floor_tile: { tier: 'auto_planning' },
  waterproofing: { tier: 'auto_planning' },
  glass_door: {
    tier: 'prompt_first',
    promptKey: 'glass_door_style',
    takeoffLabel: 'shower door count',
    benchmarkUnitHint: '$1,450 standard slider · $2,500 premium frameless installed (per door)',
  },
  toilet: { tier: 'prompt_first', promptKey: 'toilet_relocate_floor' },
  vanity: { tier: 'auto_planning' },
  countertops: {
    tier: 'prompt_first',
    promptKey: 'vanity_countertop_material',
    takeoffLabel: 'countertop material/type',
  },
  mirror_accessories: { tier: 'auto_planning' },
  plumbing_trim: { tier: 'auto_planning' },
  plumbing_rough: {
    tier: 'prompt_first',
    promptKey: 'bathroom_plumbing_work_type',
    takeoffLabel: 'shower/tub work type & access',
    benchmarkUnitHint: '$1,150–$3,500 by in-place vs relocation & access',
  },
  electrical_rough: {
    tier: 'takeoff_required',
    takeoffLabel: 'circuit / device count',
    benchmarkUnitHint: '~$175 per circuit/device',
  },
  drywall: {
    tier: 'takeoff_required',
    takeoffLabel: 'patch/repair SF',
    benchmarkUnitHint: '~$12/SF localized patch + texture; primer and paint separate',
  },
  patch_repair: {
    tier: 'takeoff_required',
    takeoffLabel: 'patch/repair SF',
    benchmarkUnitHint: '~$12/SF localized patch + texture; primer and paint separate',
  },
  paint_repair: {
    tier: 'prompt_first',
    promptKey: 'paint_repair_scope',
    takeoffLabel: 'patch/repair SF and localized paint scope',
    benchmarkUnitHint: '$700 combined patch + paint · $300–$500 paint-only @ ~36 SF',
  },
  interior_paint: {
    tier: 'prompt_first',
    promptKey: 'interior_paint_scope',
    takeoffLabel: 'paintable wall/ceiling SF',
    benchmarkUnitHint: '$3.35/SF with $350 standalone minimum',
  },
  paint: {
    tier: 'prompt_first',
    promptKey: 'interior_paint_scope',
    takeoffLabel: 'paintable wall/ceiling SF',
    benchmarkUnitHint: '$3.35/SF with $350 standalone minimum',
  },
  floor_prep: { tier: 'auto_planning' },
};

const PLUMBING_SERVICE_STEP2_PRICING_TIER: Record<string, Step2PricingTierConfig> = {
  plumbing_rough: { tier: 'auto_planning' },
  plumbing_trim: { tier: 'auto_planning' },
  water_line: { tier: 'auto_planning' },
  sewer_line: { tier: 'auto_planning' },
  gas_line: { tier: 'auto_planning' },
};

const KITCHEN_STEP2_PRICING_TIER: Record<string, Step2PricingTierConfig> = {
  cabinet_demo: { tier: 'auto_planning' },
  countertop_demo: { tier: 'auto_planning' },
  backsplash_demo: {
    tier: 'prompt_first',
    promptKey: 'backsplash_demo_difficulty',
    takeoffLabel: 'backsplash demo area',
    benchmarkUnitHint: '$4.50–$12/SF by removal difficulty · moderate default $7.50/SF',
  },
  drywall: {
    tier: 'takeoff_required',
    takeoffLabel: 'patch/repair SF',
    benchmarkUnitHint: '$400 localized patch + texture @ ~36 SF reference',
  },
  patch_repair: {
    tier: 'takeoff_required',
    takeoffLabel: 'patch/repair SF',
    benchmarkUnitHint: '$400 localized patch + texture @ ~36 SF reference',
  },
};

export function resolveStep2PricingTier(
  itemId: string,
  templateKey?: string | null
): Step2PricingTierConfig {
  const template = String(templateKey || '').toLowerCase();
  if (
    template === 'electrical' &&
    itemId.startsWith('electrical_') &&
    itemId !== 'electrical_rough' &&
    itemId !== 'electrical_trim' &&
    !isElectricalServicePanelItemId(itemId) &&
    !isElectricalCircuitItemId(itemId) &&
    !isElectricalReceptacleItemId(itemId) &&
    !isElectricalSwitchItemId(itemId) &&
    !isElectricalLightingFanItemId(itemId) &&
    !isElectricalHookupItemId(itemId) &&
    !isElectricalSpecialSystemItemId(itemId) &&
    !isElectricalModificationItemId(itemId) &&
    !isElectricalRacewayItemId(itemId)
  ) {
    return { tier: 'takeoff_required', takeoffLabel: 'pricing' };
  }
  if (
    template === 'electrical' &&
    (isElectricalServicePanelItemId(itemId) ||
      isElectricalCircuitItemId(itemId) ||
      isElectricalReceptacleItemId(itemId) ||
      isElectricalSwitchItemId(itemId) ||
      isElectricalLightingFanItemId(itemId) ||
      isElectricalHookupItemId(itemId) ||
      isElectricalSpecialSystemItemId(itemId) ||
      isElectricalModificationItemId(itemId) ||
      isElectricalRacewayItemId(itemId) ||
      isElectricalTrimItemId(itemId) ||
      isElectricalRoughItemId(itemId))
  ) {
    return { tier: 'auto_planning' };
  }
  if (template === 'bathroom' && BATHROOM_STEP2_PRICING_TIER[itemId]) {
    return BATHROOM_STEP2_PRICING_TIER[itemId];
  }
  if (template === 'kitchen' && KITCHEN_STEP2_PRICING_TIER[itemId]) {
    return KITCHEN_STEP2_PRICING_TIER[itemId];
  }
  if (template === 'plumbing_service' && PLUMBING_SERVICE_STEP2_PRICING_TIER[itemId]) {
    return PLUMBING_SERVICE_STEP2_PRICING_TIER[itemId];
  }
  if (template === 'ground_up' && GROUND_UP_STEP2_PRICING_TIER[itemId]) {
    return GROUND_UP_STEP2_PRICING_TIER[itemId];
  }
  return GLOBAL_STEP2_PRICING_TIER[itemId] || DEFAULT_TIER;
}

/** “Needs …” label for Step 2 when no suggested total — template-aware. */
export function resolveStep2MissingStatusLabel(
  itemId: string,
  templateKey?: string | null
): string | null {
  const config = resolveStep2PricingTier(itemId, templateKey);
  if (config.tier === 'comparison_only') {
    return 'Planning benchmark — price child lines separately';
  }
  if (config.takeoffLabel) {
    return `Needs ${config.takeoffLabel}`;
  }
  return null;
}

export function resolveStep2BenchmarkUnitHint(
  itemId: string,
  templateKey?: string | null
): string | null {
  return resolveStep2PricingTier(itemId, templateKey).benchmarkUnitHint ?? null;
}

export function step2TierExpectsSuggestedFill(
  itemId: string,
  templateKey?: string | null
): boolean {
  const tier = resolveStep2PricingTier(itemId, templateKey).tier;
  return tier === 'auto_planning' || tier === 'prompt_first';
}

/** Show a takeoff quantity field on the card before pricing is ready (no Edit tap). */
export function step2TierNeedsInlineTakeoffEntry(
  itemId: string,
  templateKey?: string | null,
  resolved?: { pricingReady?: boolean; unit?: string | null } | null,
  pricingApplied?: boolean
): boolean {
  const template = String(templateKey || '').toLowerCase();
  if (itemId === 'paint_repair' && template === 'bathroom') {
    if (pricingApplied) return false;
    return true;
  }
  if ((itemId === 'demo' || itemId === 'floor_demo') && template === 'bathroom') {
    // SF is entered in Demo / tear-out Quick Measurements — no duplicate on-card takeoff box.
    return false;
  }
  if (itemId === 'framing' && template === 'ground_up') {
    // Covered framed SF (living + garage) is a planning assumption on the Suggest card.
    return false;
  }
  if (
    itemId === 'shower_floor_tile' &&
    template === 'bathroom'
  ) {
    // Shower floor tile SF is entered in Wet area install Quick Measurements.
    return false;
  }
  if (itemId === 'shower_pan' && template === 'bathroom') {
    // A mud-pan install needs its own area basis even when no existing pan
    // demo was selected. Keep the field on the Confirm Scope card.
    return true;
  }
  if (resolved?.pricingReady) return false;
  const rule = getChecklistItemQuantityRuleOrDefault(itemId, templateKey);
  // Flat allowance scopes (permits, plans, etc.) price via Suggest + Edit — not an on-card qty box.
  if (rule.lumpSumOnly) return false;
  const inlineUnit = String(resolved?.unit || rule.defaultUnit || '').toLowerCase();
  // Installed packages priced as allowances (landscaping, fixture packages, etc.) — same as permits/plans.
  if (inlineUnit === 'allowance' || inlineUnit === 'lump_sum') return false;
  const config = resolveStep2PricingTier(itemId, templateKey).tier;
  if (config === 'takeoff_required') return true;
  return false;
}

export type Step2ComponentSuggestedPricingParams = {
  itemId: string;
  templateKey?: string | null;
  measurementsInput: ScopeMeasurementsInputExtended;
  resolved: {
    quantity?: number | null;
    unit?: string | null;
    quantitySource?: string | null;
    sourceLabel?: string | null;
  };
  pricingContext?: ScopePricingContext | null;
};

/**
 * Template-specific component resolvers for Step 2 planning fills.
 * Returns `undefined` when the generic national-average path should run.
 */
export function resolveStep2ComponentSuggestedPricing(
  params: Step2ComponentSuggestedPricingParams
): ScopeItemSuggestedPricing | undefined {
  const template = String(params.templateKey || '').toLowerCase();
  const { itemId, measurementsInput, resolved } = params;
  const qty = resolved.quantity;

  if (
    template === 'kitchen' &&
    itemId === 'backsplash_demo' &&
    resolved.unit === 'sqft' &&
    qty != null &&
    qty > 0
  ) {
    const backsplash = resolveKitchenBacksplashDemoSuggestedPricing({
      sqft: qty,
      difficulty: measurementsInput.kitchenBacksplashDemoDifficulty,
    });
    if (backsplash !== undefined) return backsplash;
    return undefined;
  }

  if (template === 'kitchen') {
    const itemQuantities = measurementsInput.itemQuantities || {};
    if (
      shouldSuppressSuggestedPricingAfterApply(
        itemId,
        itemQuantities,
        measurementsInput.pricingAcceptance
      )
    ) {
      return { fill: null, comparison: null };
    }

    if (
      (itemId === 'drywall' || itemId === 'patch_repair') &&
      qty != null &&
      qty > 0
    ) {
      const patch = resolveKitchenDrywallPatchSuggestedPricing({ quantity: qty });
      if (patch !== undefined) return patch;
    }

    return undefined;
  }

  if (template !== 'bathroom') return undefined;

  const { pricingContext } = params;
  // Bathroom Interior Finishes is a planning host only — never an applyable fill.
  if (resolveStep2PricingTier(itemId, params.templateKey).tier === 'comparison_only') {
    return { fill: null, comparison: null };
  }

  const itemQuantities = measurementsInput.itemQuantities || {};
  if (
    shouldSuppressSuggestedPricingAfterApply(
      itemId,
      itemQuantities,
      measurementsInput.pricingAcceptance
    )
  ) {
    return { fill: null, comparison: null };
  }

  if (itemId === 'trim_paint' && qty != null && qty > 0) {
    const material = Math.round(qty * 1.5 * 100) / 100;
    const labor = Math.round(qty * 4.5 * 100) / 100;
    return {
      fill: {
        material,
        labor,
        total: material + labor,
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel:
          'Suggested budget split · National Average · baseboard prep & paint',
        helper: `${qty.toLocaleString()} LF baseboard prep and paint × $6.00/LF`,
        mode: 'suggested_price',
        basis: { quantity: qty, unit: 'lf' },
        splitSource: 'source',
        splitConfidence: 'medium',
        productionStatus: 'review_required',
      },
      comparison: null,
    };
  }

  const flatDemoPricing: Record<
    string,
    { material: number; labor: number; total: number; label: string }
  > = {
    tub_demo: { ...TUB_DEMO_EACH, label: 'existing tub removal' },
    shower_floor_demo: {
      ...PREFAB_PAN_DEMO_EACH,
      label: 'existing prefab shower pan removal',
    },
    shower_enclosure_demo: {
      ...PREFAB_ENCLOSURE_DEMO_EACH,
      label: 'existing prefab shower enclosure removal',
    },
    glass_door_demo: {
      ...SHOWER_DOOR_DEMO_EACH,
      label: 'existing shower door removal',
    },
  };
  const flatDemo = flatDemoPricing[itemId];
  if (flatDemo && qty != null && qty > 0) {
    return {
      fill: {
        ...flatDemo,
        rateSourceLabel: `Suggested budget split · National Average · ${flatDemo.label}`,
        helper: `${qty.toLocaleString()} each × $${flatDemo.total.toLocaleString()}`,
        mode: 'suggested_price',
        basis: { quantity: qty, unit: 'each' },
        splitSource: 'source',
        splitConfidence: 'medium',
        productionStatus: 'review_required',
      },
      comparison: null,
    };
  }

  const checklistItems = pricingContext?.checklistItems;

  if (itemId === 'demo') {
    const storedBasis = readStoredSqftPricingBasis(itemQuantities, itemId);
    const tileSqft =
      storedBasis ??
      (resolved.unit === 'sqft' && resolved.quantity && resolved.quantity > 0
        ? resolved.quantity
        : 0);
    const wetAreaDemo = resolveBathroomWetAreaDemoSuggestedPricing({
      measurementsInput,
      tileSqft,
      wallTileSqft: Number(measurementsInput.showerWallTileSqft) || undefined,
      panSqft: Number(measurementsInput.showerFloorTileSqft) || undefined,
      sourceLabel: resolved.sourceLabel,
    });
    if (wetAreaDemo.fill) return wetAreaDemo as ScopeItemSuggestedPricing;
    return undefined;
  }

  if (itemId === 'plumbing_trim') {
    const trim = resolveBathroomPlumbingTrimSuggestedPricing({ checklistItems });
    if (trim !== undefined) return trim;
    return undefined;
  }

  if (itemId === 'plumbing_rough' && (!qty || qty <= 0)) {
    const rough = resolveBathroomPlumbingRoughSuggestedPricing({
      checklistItems,
      quantity: qty,
      fixtureType: measurementsInput.bathroomShowerRoughFixtureType,
      fixtureTypeSource: measurementsInput.bathroomShowerRoughFixtureTypeSource,
      workType: measurementsInput.bathroomShowerRoughWorkType,
      workTypeSource: measurementsInput.bathroomShowerRoughWorkTypeSource,
      plumbingExposed: measurementsInput.bathroomShowerRoughPlumbingExposed,
      plumbingExposedSource: measurementsInput.bathroomShowerRoughPlumbingExposedSource,
      wallAccess: measurementsInput.bathroomShowerRoughWallAccess,
      wallAccessSource: measurementsInput.bathroomShowerRoughWallAccessSource,
      floorConstruction: measurementsInput.bathroomShowerRoughFloorConstruction,
      floorConstructionSource: measurementsInput.bathroomShowerRoughFloorConstructionSource,
      slabWorkRequired: measurementsInput.bathroomShowerRoughSlabWorkRequired,
      slabWorkRequiredSource: measurementsInput.bathroomShowerRoughSlabWorkRequiredSource,
      accessType: measurementsInput.bathroomShowerRoughAccessType,
      accessFloorType: measurementsInput.bathroomToiletRelocateFloorType,
    });
    if (rough !== undefined) return rough;
    return undefined;
  }

  if (
    (itemId === 'drywall' || itemId === 'patch_repair') &&
    qty != null &&
    qty > 0
  ) {
    const patch = resolveBathroomDrywallPatchSuggestedPricing({
      checklistItems,
      quantity: qty,
      showerWallTileSqft: parseScopeMeasurementInput(measurementsInput.showerWallTileSqft),
      useCombinedAssembly: measurementsInput.bathroomDrywallPaintUseCombinedAssembly,
      paintRepairScope: measurementsInput.bathroomPaintRepairScope,
    });
    if (patch !== undefined) return patch;
    return undefined;
  }

  if (itemId === 'paint_repair') {
    const showerWallTileSqft = parseScopeMeasurementInput(measurementsInput.showerWallTileSqft);
    const paintRepairEntry = measurementsInput.itemQuantities?.paint_repair;
    const paintRepairQty = parseScopeMeasurementInput(
      String(paintRepairEntry?.quantity ?? '')
    );
    const enteredPatchSf = parseEnteredBathroomPatchSqft({
      paintRepairQuantity:
        paintRepairQty ??
        (resolved.unit === 'sqft' && qty != null && qty > 0 ? qty : null),
      paintRepairUnit: paintRepairEntry?.unit,
      sqftBasisQuantity: parseScopeMeasurementInput(
        String(
          measurementsInput.itemQuantities?.paint_repair__sqft_basis?.quantity ??
            ''
        )
      ),
      wallPaintSqft: measurementsInput.wallPaintSqft,
    });
    const planningPatchSf = enteredPatchSf;
    const paintRepairScope = measurementsInput.bathroomPaintRepairScope;
    const useCombinedAssembly = measurementsInput.bathroomDrywallPaintUseCombinedAssembly;

    // No ready/applyable paint price until the contractor picks affected-area
    // or full-room. Prevents sticky entireRoom flags from pre-counting paint.
    if (
      !paintRepairScopeSelectionComplete({
        localizedScope: paintRepairScope,
        entireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
        legacyScope: paintRepairScope,
        scopeSource: measurementsInput.bathroomPaintRepairScopeSource,
        wallPaintSqft: measurementsInput.wallPaintSqft,
        bathroomFloorSqft: measurementsInput.bathroomFloorSqft,
        enteredTakeoffSqft: planningPatchSf,
      })
    ) {
      return { fill: null, comparison: null };
    }

    if (
      shouldUseCombinedDrywallPaintAssembly({
        useCombinedAssembly,
        paintRepairScope,
      }) &&
      planningPatchSf != null &&
      planningPatchSf > 0
    ) {
      const assembly = resolveBathroomDrywallPatchSuggestedPricing({
        checklistItems,
        quantity: planningPatchSf,
        showerWallTileSqft,
        useCombinedAssembly: true,
        paintRepairScope,
        severity: measurementsInput.bathroomPaintRepairSeverity,
      });
      if (assembly?.fill) {
        return {
          ...assembly,
          fill: {
            ...assembly.fill,
            benchmarkScopeKey: 'paint_repair',
          },
        };
      }
    }

    const fullRoomTakeoffSqft =
      resolved.unit === 'sqft' && qty != null && qty > 0 ? qty : enteredPatchSf;
    const paintRepair = resolveBathroomPaintRepairSuggestedPricing({
      checklistItems,
      patchSqft: enteredPatchSf,
      showerWallTileSqft,
      paintRepairScope,
      paintRepairEntireRoom: measurementsInput.bathroomPaintRepairEntireRoom,
      entireRoomSqft:
        resolveBathroomPaintRepairScope(paintRepairScope) === 'full_room'
          ? fullRoomTakeoffSqft
          : parseScopeMeasurementInput(measurementsInput.bathroomPaintRepairEntireRoomSqft),
      interiorPaintMobilization: measurementsInput.bathroomInteriorPaintMobilization,
      interiorPaintSurface: measurementsInput.bathroomInteriorPaintSurface,
      interiorPaintCondition: measurementsInput.bathroomInteriorPaintCondition,
      useCombinedAssembly,
      severity: measurementsInput.bathroomPaintRepairSeverity,
    });
    if (paintRepair !== undefined) return paintRepair;
    return undefined;
  }

  if (
    (itemId === 'interior_paint' || itemId === 'paint') &&
    resolved.unit === 'sqft' &&
    qty != null &&
    qty > 0
  ) {
    const paint = resolveBathroomInteriorPaintSuggestedPricing({
      sqft: qty,
      mobilization: measurementsInput.bathroomInteriorPaintMobilization,
      surface: measurementsInput.bathroomInteriorPaintSurface,
      condition: measurementsInput.bathroomInteriorPaintCondition,
      itemId,
    });
    if (paint !== undefined) return paint;
    return undefined;
  }

  if (itemId === 'glass_door') {
    const doors =
      qty != null && qty > 0
        ? qty
        : parseScopeMeasurementInput(measurementsInput.showerDoorCount) || 1;
    const glass = resolveBathroomGlassDoorSuggestedPricing({
      quantity: doors,
      showerDoorCount: parseScopeMeasurementInput(measurementsInput.showerDoorCount),
      style: measurementsInput.bathroomGlassDoorStyle,
    });
    if (glass !== undefined) return glass;
    return undefined;
  }

  return undefined;
}

/** Whether Step 2 should show an access/floor prompt for this row. */
export function step2PricingPromptKey(
  itemId: string,
  templateKey?: string | null,
  choiceId?: string | null
): Step2PricingPromptKey | null {
  const config = resolveStep2PricingTier(itemId, templateKey);
  if (config.promptKey === 'toilet_relocate_floor') {
    return choiceId === 'relocating' ? config.promptKey : null;
  }
  if (config.promptKey === 'bathroom_plumbing_work_type') {
    return config.promptKey;
  }
  if (config.promptKey === 'bathroom_plumbing_access') {
    return config.promptKey;
  }
  if (config.promptKey === 'vanity_countertop_material') {
    return config.promptKey;
  }
  if (config.promptKey === 'paint_repair_scope') {
    return config.promptKey;
  }
  if (config.promptKey === 'interior_paint_scope') {
    return config.promptKey;
  }
  if (config.promptKey === 'glass_door_style') {
    return config.promptKey;
  }
  if (config.promptKey === 'backsplash_demo_difficulty') {
    return config.promptKey;
  }
  return null;
}

export type { ScopeChecklistItem };