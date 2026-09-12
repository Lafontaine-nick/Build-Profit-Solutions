/**
 * Scope-aware relevance for Quick Measurement fields. A measurement should
 * only be highlighted (Estimate available / Needs confirmation) when the
 * scope it feeds is actually part of the current bid — never merely because
 * the field exists in the registry.
 *
 * Related-scope maps include both trade-level ids (paint, cabinets) and
 * ground-up stage ids (paint_trim, cabinets_counters, tile_flooring) so
 * Confirm Scope grouping stays accurate across templates.
 */
import type { QuickMeasurementFieldKey } from '@/utils/scopeQuickMeasurements';
import { isSplitTileWetAreaCounts } from '@/utils/planBathRooms';
import { isGarageConversionJob } from '@/utils/additionConversionPlanning';
import { notesImplyMixedConcreteJob } from '@/utils/foundationPlanningMeasurements';

export type MeasurementRelevance = {
  relevant: boolean;
  /** True when an empty/unconfirmed value here would block pricing for an included scope. */
  blockingPrice: boolean;
  relatedScopeKeys: string[];
  reason?: string;
};

/**
 * Core structural quantities used across the whole bid (not one trade),
 * always shown regardless of which trade checklist items are included.
 * Bath floor is intentionally NOT here — it is scope-gated like shower/cabinets.
 */
const ALWAYS_RELEVANT_KEYS = new Set<QuickMeasurementFieldKey>([
  'floorAreaSqft',
  'garageSqft',
  'deckSqft',
  'flooringSqft',
]);

/** Whole-home templates keep the full Quick measurements card visible. */
function isWholeHomeTemplate(templateKey?: string | null): boolean {
  const key = String(templateKey || '').toLowerCase();
  return key === 'ground_up' || key === 'addition';
}

/** Quick Measurement key → checklist item ids that consume it for pricing/quantity. */
const RELATED_SCOPE_KEYS: Partial<Record<QuickMeasurementFieldKey, string[]>> =
  {
    bathroomFloorSqft: ['floor_tile', 'floor_demo', 'flooring', 'floor_prep'],
    concreteSqft: [
      'concrete',
      'pour_flatwork',
      'sidewalk',
      'patio',
      'driveway',
      'concrete_patio',
    ],
    concreteCy: ['foundation', 'pour_foundation'],
    excavationCy: ['excavation', 'sitework'],
    roofSquares: [
      'roofing',
      'shingles_roofing',
      'roof_tie_in',
      'tear_off',
      'roofing_system',
    ],
    roofAreaSqft: ['underlayment'],
    roofIceWaterShieldSqft: ['ice_water_shield'],
    roofDripEdgeLf: ['drip_edge'],
    roofRidgeCapLf: ['ridge_cap'],
    roofValleyFlashingLf: ['valley_flashing'],
    roofStepFlashingLf: ['step_flashing'],
    roofWallFlashingLf: ['wall_flashing'],
    roofRidgeVentLf: ['ridge_vent'],
    roofVentCount: ['roof_vents'],
    roofTurbineVentCount: ['turbine_vents'],
    roofPipeBootCount: ['pipe_boots'],
    roofChimneyFlashingCount: ['chimney_flashing'],
    roofSkylightCount: ['skylight_flashing'],
    roofPenetrationCount: ['roof_penetrations'],
    roofDeckingReplacementSqft: ['decking_repair'],
    roofRepairAffectedSqft: ['roof_repairs'],
    roofGutterLf: ['gutters'],
    roofDownspoutCount: ['downspouts'],
    roofPitch: ['roofing_system', 'shingles_roofing', 'tear_off'],
    storyCount: ['roofing_system', 'shingles_roofing', 'tear_off'],
    drywallSqft: ['drywall', 'hang', 'finish_tape'],
    exteriorWallInsulationSqft: ['insulation'],
    atticInsulationSqft: ['insulation'],
    floorInsulationSqft: ['insulation'],
    wallPaintSqft: ['paint', 'interior_paint', 'paint_repair', 'paint_trim'],
    ceilingPaintSqft: ['ceiling_paint', 'interior_paint', 'paint'],
    paintAreaSqft: ['paint', 'interior_paint', 'ceiling_paint'],
    patchRepairSqft: ['patch_repair', 'paint_repair', 'drywall'],
    // Exterior wall faces inform insulation envelope walls (not drywall interior surface).
    exteriorPaintSqft: [
      'exterior_paint',
      'paint_trim',
      'stucco',
      'exterior',
      'insulation',
    ],
    cabinetLf: ['cabinets', 'cabinets_counters'],
    countertopSqft: ['countertops', 'cabinets_counters'],
    showerWallTileSqft: [
      'shower_tile',
      'waterproofing',
      'tile_flooring',
      'tile_shower',
    ],
    showerFloorTileSqft: [
      'shower_tile',
      'shower_floor_tile',
      'tile_flooring',
      'tile_shower',
    ],
    baseboardLf: [
      'trim',
      'baseboard',
      'interior_trim',
      'paint_trim',
      'trim_paint',
    ],
    interiorDoorCount: ['interior_doors', 'door_paint', 'trim_paint'],
    windowCount: ['windows'],
    exteriorDoorCount: ['exterior_doors'],
    slidingDoorCount: ['sliding_doors'],
    cabinetPaintSqft: ['cabinet_paint'],
    cabinetRunLf: ['cabinet_paint'],
    railingLf: ['railing', 'fencing'],
    plumbingRoughPointCount: ['plumbing_rough'],
    plumbingTrimHookupCount: ['plumbing_trim'],
    fixtureReplacementCount: ['fixture_replace'],
    fixtureRepairCount: ['fixture_repair'],
    waterLineLf: ['water_line'],
    sewerLineLf: ['sewer_line'],
    gasLineLf: ['gas_line'],
    plumbingFixturesHardwareCount: ['plumbing_fixtures_hardware'],
    waterHeaterCount: ['water_heater'],
    gasApplianceConnectionCount: ['gas_appliance_connections'],
    serviceCallCount: ['service_call'],
    drainCleaningCount: ['drain_cleaning'],
    partsMaterialsCount: ['parts_materials'],
    emergencyFeeCount: ['emergency_fee'],
    plumbingCleanupCount: ['cleanup'],
    backsplashSqft: ['backsplash'],
    paverSqft: ['pavers', 'hardscape', 'landscaping'],
    sodSqft: ['sod', 'landscaping'],
    rockMulchSqft: ['rock', 'mulch', 'landscaping'],
    landscapeTons: ['rock', 'mulch', 'landscaping'],
    plantCount: ['plants', 'landscaping'],
    treeCount: ['trees', 'landscaping'],
    boulderCount: ['landscape_boulders', 'landscaping'],
    landscapeSqft: ['landscaping'],
    stuccoGrossWallSqft: ['stucco'],
    stuccoWindowDoorOpeningSqft: ['stucco'],
    stuccoGarageOpeningSqft: ['stucco'],
    stuccoOtherFinishDeductionSqft: ['stucco_other_finish'],
    stuccoNetWallSqft: ['stucco'],
    stuccoSoffitSqft: ['stucco_soffits'],
    stuccoParapetSqft: ['stucco_parapets'],
    stuccoFoamTrimLf: ['stucco_foam_trim'],
    stuccoControlJointLf: ['stucco_accessories'],
    stuccoStories: ['stucco_access'],
    stuccoWallHeightFt: ['stucco_access'],
    framedAreaSqft: ['framing'],
    wallFramingLf: ['wall_framing'],
    sheathingSqft: ['shear_sheathing'],
    framingOpeningCount: ['openings'],
    concreteReinforcementSqft: ['reinforcement'],
    concreteSubgradePrepSqft: ['site_prep'],
    gravelBaseCy: ['gravel_base'],
    concreteStructuralReinforcementSqft: ['reinforcement', 'pour_foundation'],
    concreteFlatworkReinforcementSqft: ['reinforcement', 'pour_flatwork'],
    concreteStructuralSubgradePrepSqft: ['site_prep', 'pour_foundation'],
    concreteFlatworkSubgradePrepSqft: ['site_prep', 'pour_flatwork'],
    concreteStructuralGravelBaseCy: ['gravel_base', 'pour_foundation'],
    concreteFlatworkGravelBaseCy: ['gravel_base', 'pour_flatwork'],
  };

const CONCRETE_MIXED_ZONE_MEASUREMENT_KEYS = new Set<QuickMeasurementFieldKey>([
  'concreteStructuralSubgradePrepSqft',
  'concreteFlatworkSubgradePrepSqft',
  'concreteStructuralReinforcementSqft',
  'concreteFlatworkReinforcementSqft',
  'concreteStructuralGravelBaseCy',
  'concreteFlatworkGravelBaseCy',
]);

const CONCRETE_MIXED_AGGREGATE_MEASUREMENT_KEYS =
  new Set<QuickMeasurementFieldKey>([
    'concreteSubgradePrepSqft',
    'concreteReinforcementSqft',
    'gravelBaseCy',
  ]);

const STUCCO_CORE_MEASUREMENT_KEYS = new Set<QuickMeasurementFieldKey>([
  'stuccoGrossWallSqft',
  'stuccoWindowDoorOpeningSqft',
  'stuccoGarageOpeningSqft',
  'stuccoNetWallSqft',
]);

const FRAMING_CORE_MEASUREMENT_KEYS = new Set<QuickMeasurementFieldKey>([
  'framedAreaSqft',
  'sheathingSqft',
  'floorAreaSqft',
  'garageSqft',
]);

function relatedLabel(relatedScopeKeys: string[]): string {
  if (!relatedScopeKeys.length) return 'the related scope';
  return relatedScopeKeys[0].replace(/_/g, ' ');
}

export function getMeasurementRelevance(params: {
  measurementKey: QuickMeasurementFieldKey;
  includedScopeKeys: Iterable<string>;
  noteBackedKeys?: Iterable<QuickMeasurementFieldKey>;
  /** When set, tub/prefab hide shower tile measurements; tile keeps them. */
  wetAreaFinish?: import('@/utils/planBathRooms').WetAreaFinishChoice | null;
  /** Tile shower walls stepper — gates shower wall SF on bathroom photo/notes jobs. */
  bathCount?: number | null;
  tilePanBathCount?: number | null;
  wholeHomeLayout?: boolean;
  /** ground_up / addition show the full field list — not garage conversions. */
  templateKey?: string | null;
  projectType?: string | null;
  notes?: string | null;
  /** Retile walls only — existing tub/pan stays; shower floor SF is not used. */
  keepingExistingWetArea?: boolean;
  wetAreaInstallChoiceId?: string | null;
}): MeasurementRelevance {
  const { measurementKey } = params;
  const relatedScopeKeys = RELATED_SCOPE_KEYS[measurementKey] || [];
  const notesText = String(params.notes || '');
  const kitchenMeasurementContext =
    String(params.templateKey || '').toLowerCase() === 'kitchen' ||
    String(params.projectType || '').toLowerCase() === 'kitchen' ||
    /\bkitchen(?:\s+remodel)?\b/i.test(notesText);
  if (
    kitchenMeasurementContext &&
    measurementKey === 'floorAreaSqft' &&
    !/\b(?:living\s+area|total\s+living|conditioned\s+(?:floor\s+)?area|heated\s+area|home\s+interior)\b/i.test(
      notesText
    )
  ) {
    return {
      relevant: false,
      blockingPrice: false,
      relatedScopeKeys,
      reason:
        'Living area is not needed unless it is provided for this kitchen bid.',
    };
  }
  const wholeHome = isWholeHomeTemplate(params.templateKey);
  const garageConversion = isGarageConversionJob(
    params.projectType,
    params.notes
  );
  const wholeHomeShowAll = wholeHome && !garageConversion;
  const splitTile = isSplitTileWetAreaCounts({
    templateKey: params.templateKey,
    wholeHomeLayout: params.wholeHomeLayout,
  });

  // Tub / prefab pans use a manufactured base — shower floor tile SF is not used.
  if (measurementKey === 'showerFloorTileSqft') {
    if (
      params.keepingExistingWetArea ||
      params.wetAreaInstallChoiceId === 'staying'
    ) {
      return {
        relevant: false,
        blockingPrice: false,
        relatedScopeKeys,
        reason:
          'Shower floor tile is not used when keeping the existing tub/shower.',
      };
    }
    if (splitTile) {
      const tilePan = Number(params.tilePanBathCount);
      if (!(Number.isFinite(tilePan) && tilePan > 0)) {
        return {
          relevant: false,
          blockingPrice: false,
          relatedScopeKeys,
          reason: 'Set tile shower pan to unlock shower floor measurements.',
        };
      }
    } else if (
      params.wetAreaFinish === 'tub' ||
      params.wetAreaFinish === 'prefab'
    ) {
      return {
        relevant: false,
        blockingPrice: false,
        relatedScopeKeys,
        reason:
          'Shower floor tile SF is not used for tub or prefab wet-area finishes.',
      };
    }
  }

  // Bathroom photo/notes — shower wall SF only while Tile shower walls stepper is on.
  if (measurementKey === 'showerWallTileSqft' && splitTile) {
    const walls = Number(params.bathCount);
    if (!(Number.isFinite(walls) && walls > 0)) {
      return {
        relevant: false,
        blockingPrice: false,
        relatedScopeKeys,
        reason: 'Set tile shower walls to unlock shower wall measurements.',
      };
    }
  }

  // Alcove tub — no tiled shower walls to take off (prefab can still have tile walls).
  if (
    measurementKey === 'showerWallTileSqft' &&
    params.wetAreaFinish === 'tub'
  ) {
    return {
      relevant: false,
      blockingPrice: false,
      relatedScopeKeys,
      reason: 'Shower wall tile SF is not used for tub wet-area finishes.',
    };
  }

  const includedSet = new Set(params.includedScopeKeys);
  const explicitWetAreaNotes =
    /\b(?:bath(?:room)?|shower|tub|wet\s+area|bath\s+floor|shower\s+(?:wall|floor)|tile\s+shower)\b/i.test(
      notesText
    );
  const explicitWetAreaScope = [
    'bathroom',
    'bathroom_floor',
    'shower_tile',
    'shower_floor_tile',
    'tile_shower',
    'wet_area_install',
    'shower_pan',
  ].some(id => includedSet.has(id));
  if (
    (measurementKey === 'bathroomFloorSqft' ||
      measurementKey === 'showerWallTileSqft' ||
      measurementKey === 'showerFloorTileSqft') &&
    !explicitWetAreaNotes &&
    !explicitWetAreaScope
  ) {
    return {
      relevant: false,
      blockingPrice: false,
      relatedScopeKeys,
      reason:
        'Not needed unless bathroom or shower work is included in this bid.',
    };
  }
  const floorWorkScope = ['floor_tile', 'floor_demo', 'flooring', 'floor_prep'];
  const floorWorkIncluded = floorWorkScope.some(id => includedSet.has(id));

  if (garageConversion) {
    if (measurementKey === 'garageSqft') {
      return {
        relevant: false,
        blockingPrice: false,
        relatedScopeKeys: [],
        reason:
          'Garage conversion uses the conditioned area field — not a separate garage SF.',
      };
    }
    const conversionHiddenKeys = new Set<QuickMeasurementFieldKey>([
      'excavationCy',
      'concreteCy',
      'concreteSqft',
      'roofSquares',
      'deckSqft',
      'bathroomFloorSqft',
      'showerWallTileSqft',
      'showerFloorTileSqft',
      'kitchenFloorSqft',
      'cabinetLf',
      'countertopSqft',
    ]);
    if (conversionHiddenKeys.has(measurementKey)) {
      const scopeIncluded = relatedScopeKeys.some(id => includedSet.has(id));
      if (!scopeIncluded) {
        return {
          relevant: false,
          blockingPrice: false,
          relatedScopeKeys,
          reason: 'Not typical for an existing garage conversion.',
        };
      }
    }
    if (measurementKey === 'floorAreaSqft') {
      return {
        relevant: true,
        blockingPrice: true,
        relatedScopeKeys: [
          'framing',
          'drywall',
          'insulation',
          'paint',
          'flooring',
        ],
      };
    }
    if (measurementKey === 'exteriorPaintSqft') {
      const notesText = String(params.notes || '');
      const exteriorFinishInNotes =
        /\bexterior\s+paint\b|\bpaint\s+exterior\b|\bstucco\b|\bsiding\b|\bexterior\s+finish/i.test(
          notesText
        );
      if (!exteriorFinishInNotes) {
        return {
          relevant: false,
          blockingPrice: false,
          relatedScopeKeys,
          reason:
            'Interior garage conversion — exterior paint SF is not used unless notes call out exterior finish.',
        };
      }
    }
  }

  if (measurementKey === 'paintAreaSqft') {
    return {
      relevant: true,
      blockingPrice: false,
      relatedScopeKeys: [],
      reason:
        params.templateKey === 'painting'
          ? 'Reference quantity only — the active combined/separate paint method controls pricing.'
          : undefined,
    };
  }

  // Kitchen floor is a scope-specific takeoff. Keeping it in the always-visible
  // set leaves a stale "Kitchen floor" confirmation row after flooring is
  // deselected from the kitchen install panel.
  if (measurementKey === 'kitchenFloorSqft') {
    const notesText = String(params.notes || '');
    const kitchenContext =
      String(params.templateKey || '').toLowerCase() === 'kitchen' ||
      String(params.projectType || '').toLowerCase() === 'kitchen' ||
      /\bkitchen(?:\s+remodel)?\b/i.test(notesText);
    const explicitFloorWork =
      /\b(?:install|installation|replace|replacement|new|demo|demolition|remove|removal|tear[\s-]?out)\b[^.;]{0,80}\b(?:flooring|floor\s+tile|lvp|laminate|vinyl|carpet)\b|\b(?:flooring|floor\s+tile|lvp|laminate|vinyl|carpet)\b[^.;]{0,80}\b(?:install|installation|replace|replacement|demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(
        notesText
      );
    const relevant =
      floorWorkIncluded && (!kitchenContext || explicitFloorWork);
    return {
      relevant,
      blockingPrice: relevant,
      relatedScopeKeys: floorWorkScope,
      reason: relevant
        ? undefined
        : 'Not needed unless kitchen flooring or floor demo is included in this bid.',
    };
  }

  const tradeOnlyTemplate = String(params.templateKey || '').toLowerCase();
  const kitchenContext =
    tradeOnlyTemplate === 'kitchen' ||
    String(params.projectType || '').toLowerCase() === 'kitchen' ||
    /\bkitchen(?:\s+remodel)?\b/i.test(notesText);
  if (
    kitchenContext &&
    (measurementKey === 'bathroomFloorSqft' ||
      measurementKey === 'showerWallTileSqft' ||
      measurementKey === 'showerFloorTileSqft') &&
    !explicitWetAreaNotes
  ) {
    return {
      relevant: false,
      blockingPrice: false,
      relatedScopeKeys,
      reason:
        'Not needed unless bathroom or shower work is included in the kitchen bid.',
    };
  }
  if (kitchenContext) {
    const kitchenOptionalMeasurementKeys = new Set<QuickMeasurementFieldKey>([
      'floorAreaSqft',
      'flooringSqft',
      'kitchenFloorSqft',
      'drywallSqft',
      'exteriorWallInsulationSqft',
      'baseboardLf',
      'wallPaintSqft',
      'ceilingPaintSqft',
      'paintAreaSqft',
    ]);
    if (kitchenOptionalMeasurementKeys.has(measurementKey)) {
      const explicitFloorWork =
        /\b(?:install|installation|replace|replacement|new|demo|demolition|remove|removal|tear[\s-]?out)\b[^.;]{0,80}\b(?:flooring|floor\s+tile|lvp|laminate|vinyl|carpet)\b|\b(?:flooring|floor\s+tile|lvp|laminate|vinyl|carpet)\b[^.;]{0,80}\b(?:install|installation|replace|replacement|demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(
          notesText
        );
      const explicitDrywall =
        /\b(?:drywall|sheetrock|gypsum|wall\s+repair|patch(?:ing)?)\b/i.test(
          notesText
        );
      const explicitWallInsulation =
        /\b(?:wall|exterior\s+wall|outside\s+wall)\s+insulation\b|\binsulation\b/i.test(
          notesText
        );
      const explicitBaseboard = /\b(?:baseboards?|base\s*board)\b/i.test(
        notesText
      );
      const explicitPaint = /\b(?:paint(?:ing)?|repaint|primer)\b/i.test(
        notesText
      );
      const relevant =
        measurementKey === 'floorAreaSqft' ||
        measurementKey === 'flooringSqft' ||
        measurementKey === 'kitchenFloorSqft'
          ? explicitFloorWork
          : measurementKey === 'drywallSqft'
            ? explicitDrywall
            : measurementKey === 'exteriorWallInsulationSqft'
              ? explicitWallInsulation
              : measurementKey === 'baseboardLf'
                ? explicitBaseboard
                : explicitPaint;
      return {
        relevant,
        blockingPrice: relevant,
        relatedScopeKeys,
        reason: relevant
          ? undefined
          : 'Not needed unless the kitchen notes explicitly include this work.',
      };
    }
  }
  if (
    tradeOnlyTemplate === 'stucco' &&
    STUCCO_CORE_MEASUREMENT_KEYS.has(measurementKey)
  ) {
    return {
      relevant: true,
      blockingPrice: measurementKey === 'stuccoNetWallSqft',
      relatedScopeKeys,
      reason: undefined,
    };
  }
  if (
    tradeOnlyTemplate === 'framing' &&
    FRAMING_CORE_MEASUREMENT_KEYS.has(measurementKey)
  ) {
    return {
      relevant: true,
      blockingPrice:
        measurementKey === 'framedAreaSqft' ||
        measurementKey === 'sheathingSqft',
      relatedScopeKeys,
      reason: undefined,
    };
  }
  if (
    measurementKey === 'floorAreaSqft' &&
    new Set([
      'concrete',
      'excavation',
      'landscaping',
      'roofing',
      'drywall',
      'painting',
      'deck_patio',
      'hvac',
      'plumbing',
      'plumbing_service',
      'bathroom',
    ]).has(tradeOnlyTemplate)
  ) {
    return {
      relevant: false,
      blockingPrice: false,
      relatedScopeKeys,
      reason: 'Living area is not used for this trade-specific bid.',
    };
  }

  const mixedConcreteJob =
    tradeOnlyTemplate === 'concrete' &&
    notesImplyMixedConcreteJob(params.notes);
  if (tradeOnlyTemplate === 'concrete') {
    if (measurementKey === 'garageSqft' || measurementKey === 'rockMulchSqft') {
      return {
        relevant: false,
        blockingPrice: false,
        relatedScopeKeys,
        reason: 'Not used on concrete flatwork / foundation bids.',
      };
    }
    if (mixedConcreteJob) {
      if (CONCRETE_MIXED_AGGREGATE_MEASUREMENT_KEYS.has(measurementKey)) {
        return {
          relevant: false,
          blockingPrice: false,
          relatedScopeKeys,
          reason:
            'Split into structural pad vs exterior flatwork on mixed foundation + flatwork jobs.',
        };
      }
      if (CONCRETE_MIXED_ZONE_MEASUREMENT_KEYS.has(measurementKey)) {
        return {
          relevant: true,
          blockingPrice: false,
          relatedScopeKeys,
          reason: undefined,
        };
      }
    }
  }

  // Single-bath remodel — bath floor SF only when floor work is actually in the bid.
  if (
    measurementKey === 'bathroomFloorSqft' &&
    String(params.templateKey || '').toLowerCase() === 'bathroom' &&
    !floorWorkIncluded
  ) {
    return {
      relevant: false,
      blockingPrice: false,
      relatedScopeKeys,
      reason:
        'Not needed unless bath floor tile or flooring demo/install is in this bid.',
    };
  }

  if (ALWAYS_RELEVANT_KEYS.has(measurementKey) || wholeHomeShowAll) {
    return {
      relevant: true,
      blockingPrice:
        ALWAYS_RELEVANT_KEYS.has(measurementKey) || relatedScopeKeys.length > 0,
      relatedScopeKeys,
      reason: wholeHomeShowAll
        ? 'Whole-home bid — keep full Quick measurements visible.'
        : 'Core structural measurement used across the bid.',
    };
  }

  if (!relatedScopeKeys.length) {
    return { relevant: true, blockingPrice: false, relatedScopeKeys: [] };
  }

  const noteSet = new Set(params.noteBackedKeys || []);
  const scopeIncluded = relatedScopeKeys.some(id => includedSet.has(id));
  const relevant = scopeIncluded || noteSet.has(measurementKey);

  return {
    relevant,
    blockingPrice: relevant,
    relatedScopeKeys,
    reason: relevant
      ? undefined
      : `Not needed unless ${relatedLabel(relatedScopeKeys)} is included in this bid.`,
  };
}

/** Copy for pricing-readiness / planning-vs-firm messaging. */
export const PLANNING_BID_CONFIDENCE_COPY =
  'Plan measurements and accepted suggestions structure a solid planning bid. For a firm sellable price, still confirm cabinets, counters, shower tile, exterior flatwork, and verify foundation/excavation and roof pitch against the plans.';
