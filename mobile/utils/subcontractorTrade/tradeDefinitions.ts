import type { ScopePricingBehavior } from './scopePricingBehavior';
import { CONCRETE_REVIEW_MEASUREMENT_KEYS } from './concretePlanConvergence';
import { FLOORING_REVIEW_MEASUREMENT_KEYS } from './flooringPlanConvergence';
import { PAINTING_REVIEW_MEASUREMENT_KEYS } from './paintingPlanConvergence';
import {
  ELECTRICAL_CARDS,
  ELECTRICAL_REVIEW_MEASUREMENT_KEYS,
} from './electricalPlanConvergence';
import {
  PLUMBING_CARDS,
  PLUMBING_PLAN_QUICK_MEASUREMENT_KEYS,
  PLUMBING_REVIEW_MEASUREMENT_KEYS,
} from './plumbingPlanConvergence';
import {
  FRAMING_CARDS,
  FRAMING_PLAN_QUICK_MEASUREMENT_KEYS,
  FRAMING_REVIEW_MEASUREMENT_KEYS,
} from './framingPlanConvergence';
import {
  INSULATION_PLAN_QUICK_MEASUREMENT_KEYS,
  INSULATION_PLAN_REVIEW_MEASUREMENT_KEYS,
} from './insulationPlanConvergence';
import { getTradeMeasurementSchema } from './measurementSchemas';
import {
  TRADE_SCOPE_ALLOWLISTS,
  getTradeScopeAllowlist,
} from './tradeAllowlists';
import type {
  SubcontractorTradeDefinition,
  SubcontractorTradeKey,
  TradeScopeItemDefinition,
} from './types';

export const PLAN_EXPORT_TRADE_KEYS: SubcontractorTradeKey[] = [
  'electrical',
  'plumbing',
  'hvac',
  'roofing',
  'concrete',
  'framing',
  'drywall',
  'stucco',
  'insulation',
  'flooring',
  'painting',
  'windows_doors',
];

const STUCCO_REVIEW_MEASUREMENT_KEYS = [
  'stuccoSqft',
  'exteriorWallSqft',
  'exteriorFinishSqft',
  'exteriorFinishesSqft',
  'exteriorPaintSqft',
  'stuccoGrossWallSqft',
  'stuccoWindowDoorOpeningSqft',
  'stuccoGarageOpeningSqft',
  'stuccoOtherFinishDeductionSqft',
  'stuccoNetWallSqft',
  'stuccoSoffitSqft',
  'stuccoParapetSqft',
  'stuccoFoamTrimLf',
  'stuccoControlJointLf',
  'stuccoAccessAffectedSqft',
  'stuccoRepairAffectedSqft',
  'stuccoStories',
  'stuccoWallHeightFt',
];

const STUCCO_QUICK_MEASUREMENT_KEYS = [
  'stuccoGrossWallSqft',
  'stuccoWindowDoorOpeningSqft',
  'stuccoGarageOpeningSqft',
  'stuccoOtherFinishDeductionSqft',
  'stuccoNetWallSqft',
  'stuccoSoffitSqft',
  'stuccoParapetSqft',
  'stuccoFoamTrimLf',
  'stuccoControlJointLf',
  'stuccoStories',
  'stuccoWallHeightFt',
  'exteriorPaintSqft',
];

/** Descriptive metadata mapping existing Stucco behavior — not consumed by pricing yet. */
const STUCCO_SCOPE_ITEMS: TradeScopeItemDefinition[] = [
  { scopeItemId: 'stucco', pricingBehavior: 'ALTERNATE_SYSTEM' },
  { scopeItemId: 'stucco_wrb', pricingBehavior: 'INCLUDED_IN_BASE' },
  { scopeItemId: 'stucco_lath', pricingBehavior: 'INCLUDED_IN_BASE' },
  { scopeItemId: 'stucco_base_coat', pricingBehavior: 'INCLUDED_IN_BASE' },
  { scopeItemId: 'stucco_finish_coat', pricingBehavior: 'INCLUDED_IN_BASE' },
  { scopeItemId: 'stucco_accessories', pricingBehavior: 'INCLUDED_IN_BASE' },
  {
    scopeItemId: 'stucco_foam_trim',
    pricingBehavior: 'SEPARATE_ADDON',
    measurementKeys: ['stuccoFoamTrimLf'],
  },
  {
    scopeItemId: 'stucco_soffits',
    pricingBehavior: 'SEPARATE_ADDON',
    measurementKeys: ['stuccoSoffitSqft'],
  },
  {
    scopeItemId: 'stucco_parapets',
    pricingBehavior: 'SEPARATE_ADDON',
    measurementKeys: ['stuccoParapetSqft'],
  },
  {
    scopeItemId: 'stucco_access',
    pricingBehavior: 'SEPARATE_ADDON',
    measurementKeys: ['stuccoAccessAffectedSqft'],
  },
  {
    scopeItemId: 'stucco_repairs',
    pricingBehavior: 'SEPARATE_ADDON',
    measurementKeys: ['stuccoRepairAffectedSqft'],
  },
  {
    scopeItemId: 'stucco_other_finish',
    pricingBehavior: 'NON_PRICED_CONFIRMATION',
  },
];

function scaffoldedTrade(
  key: SubcontractorTradeKey,
  label: string,
  opts: Partial<SubcontractorTradeDefinition> = {}
): SubcontractorTradeDefinition {
  const allowlist = TRADE_SCOPE_ALLOWLISTS[key];
  const keywords = label
    .toLowerCase()
    .split(/[^\w]+/)
    .filter(Boolean);
  return {
    key,
    label,
    status: 'scaffolded',
    scopeHint: `Focus on ${label.toLowerCase()} sheets and notes; do not infer detailed quantities.`,
    missingInfo: [
      'Trade-specific plan/schedule details',
      'Scope inclusions and exclusions',
      'Quantities requiring contractor confirmation',
    ],
    measurements: getTradeMeasurementSchema(key),
    scopeItems: [],
    allowedScopeItemIds: allowlist,
    reviewMeasurementKeys: [],
    reviewScopeKeywords: keywords,
    quickMeasurementFieldKeys: [],
    ...opts,
  };
}

const STUCCO_DEFINITION: SubcontractorTradeDefinition = {
  key: 'stucco',
  label: 'Stucco / Exterior Finish',
  status: 'complete',
  standaloneTemplateKey: 'stucco',
  scopeHint:
    'Focus on exterior elevations, wall areas, openings, soffits, and stucco notes.',
  missingInfo: [
    'Exterior wall area and openings',
    'Stucco system and finish',
    'Access, scaffolding, and repair conditions',
  ],
  measurements: getTradeMeasurementSchema('stucco'),
  scopeItems: STUCCO_SCOPE_ITEMS,
  allowedScopeItemIds: TRADE_SCOPE_ALLOWLISTS.stucco,
  reviewMeasurementKeys: STUCCO_REVIEW_MEASUREMENT_KEYS,
  reviewScopeKeywords: ['stucco'],
  quickMeasurementFieldKeys: STUCCO_QUICK_MEASUREMENT_KEYS,
};

const ROOFING_SCOPE_ITEMS = [
  {
    scopeItemId: 'roofing_system',
    pricingBehavior: 'ALTERNATE_SYSTEM' as const,
  },
  {
    scopeItemId: 'shingles_roofing',
    pricingBehavior: 'INCLUDED_IN_BASE' as const,
    measurementKeys: ['roofSquares'],
  },
  {
    scopeItemId: 'tear_off',
    pricingBehavior: 'SEPARATE_ADDON' as const,
    measurementKeys: ['roofSquares'],
  },
  {
    scopeItemId: 'underlayment',
    pricingBehavior: 'SEPARATE_ADDON' as const,
    measurementKeys: ['roofAreaSqft'],
  },
  {
    scopeItemId: 'ice_water_shield',
    pricingBehavior: 'SEPARATE_ADDON' as const,
    measurementKeys: ['roofIceWaterShieldSqft'],
  },
  {
    scopeItemId: 'decking_repair',
    pricingBehavior: 'SEPARATE_ADDON' as const,
    measurementKeys: ['roofDeckingReplacementSqft'],
  },
  ...(
    [
      ['drip_edge', 'roofDripEdgeLf'],
      ['ridge_cap', 'roofRidgeCapLf'],
      ['valley_flashing', 'roofValleyFlashingLf'],
      ['step_flashing', 'roofStepFlashingLf'],
      ['wall_flashing', 'roofWallFlashingLf'],
      ['ridge_vent', 'roofRidgeVentLf'],
      ['roof_vents', 'roofVentCount'],
      ['turbine_vents', 'roofTurbineVentCount'],
      ['pipe_boots', 'roofPipeBootCount'],
      ['chimney_flashing', 'roofChimneyFlashingCount'],
      ['skylight_flashing', 'roofSkylightCount'],
      ['roof_penetrations', 'roofPenetrationCount'],
      ['gutters', 'roofGutterLf'],
      ['downspouts', 'roofDownspoutCount'],
    ] as const
  ).map(([scopeItemId, measurementKey]) => ({
    scopeItemId,
    pricingBehavior: 'SEPARATE_ADDON' as const,
    measurementKeys: [measurementKey],
  })),
  {
    scopeItemId: 'roof_repairs',
    pricingBehavior: 'SEPARATE_ADDON' as const,
    measurementKeys: ['roofRepairAffectedSqft'],
  },
] satisfies SubcontractorTradeDefinition['scopeItems'];

const CONCRETE_SCOPE_ITEMS = [
  { scopeItemId: 'pour_flatwork', pricingBehavior: 'SEPARATE_ADDON' as const },
  {
    scopeItemId: 'pour_foundation',
    pricingBehavior: 'SEPARATE_ADDON' as const,
  },
  { scopeItemId: 'demo_removal', pricingBehavior: 'SEPARATE_ADDON' as const },
  { scopeItemId: 'excavation', pricingBehavior: 'SEPARATE_ADDON' as const },
  { scopeItemId: 'reinforcement', pricingBehavior: 'SEPARATE_ADDON' as const },
  { scopeItemId: 'site_prep', pricingBehavior: 'SEPARATE_ADDON' as const },
  {
    scopeItemId: 'complex_forming',
    pricingBehavior: 'SEPARATE_ADDON' as const,
  },
  {
    scopeItemId: 'concrete_sealer',
    pricingBehavior: 'SEPARATE_ADDON' as const,
  },
  {
    scopeItemId: 'decorative_finish',
    pricingBehavior: 'SEPARATE_ADDON' as const,
  },
  {
    scopeItemId: 'additional_haul_off',
    pricingBehavior: 'SEPARATE_ADDON' as const,
  },
] satisfies SubcontractorTradeDefinition['scopeItems'];

const ELECTRICAL_DEFINITION: SubcontractorTradeDefinition = {
  key: 'electrical',
  label: 'Electrical',
  status: 'reference',
  standaloneTemplateKey: 'electrical',
  scopeHint:
    'Focus on electrical sheets, panels, circuits, devices, lighting, and electrical notes. Plan Export maps symbol/schedule counts onto the locked 2A–2K keys — it does not create a second estimator.',
  missingInfo: [
    'Device and fixture counts',
    'Panel/circuit schedule',
    'Service size and utility scope',
    'Installation condition (new construction, open-wall remodel, or finished-wall service)',
  ],
  measurements: getTradeMeasurementSchema('electrical'),
  scopeItems: ELECTRICAL_CARDS.filter(
    card => card.measurementKey !== 'serviceAmperage'
  ).map(card => ({
    scopeItemId: card.itemId,
    pricingBehavior: 'CUSTOM_PRICE' as const,
    measurementKeys: [card.measurementKey],
  })),
  allowedScopeItemIds: TRADE_SCOPE_ALLOWLISTS.electrical,
  reviewMeasurementKeys: [...ELECTRICAL_REVIEW_MEASUREMENT_KEYS],
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
  quickMeasurementFieldKeys: [...ELECTRICAL_REVIEW_MEASUREMENT_KEYS],
};

const PLUMBING_DEFINITION: SubcontractorTradeDefinition = {
  key: 'plumbing',
  label: 'Plumbing',
  status: 'complete',
  standaloneTemplateKey: 'plumbing_service',
  scopeHint:
    'Focus on plumbing plans, fixture schedules, risers, water/sewer/gas lines, rough-in points, and plumbing notes. Map explicit quantities onto the canonical Plumbing cards; do not infer quantities from living area or appliance symbols.',
  missingInfo: [
    'Fixture and connection counts',
    'Rough-in points and access conditions',
    'Water, sewer, and drain-line lengths',
    'Documented gas piping or gas stubs when present',
    'Repair, service, and allowance details',
  ],
  measurements: getTradeMeasurementSchema('plumbing'),
  scopeItems: PLUMBING_CARDS.map(card => ({
    scopeItemId: card.itemId,
    pricingBehavior: card.pricingBehavior,
    measurementKeys: [card.measurementKey],
  })),
  allowedScopeItemIds: TRADE_SCOPE_ALLOWLISTS.plumbing,
  reviewMeasurementKeys: [...PLUMBING_REVIEW_MEASUREMENT_KEYS],
  reviewScopeKeywords: [
    'plumbing',
    'plumber',
    'fixture',
    'toilet',
    'sink',
    'faucet',
    'drain',
    'sewer',
    'water line',
    'gas',
    'gas line',
    'gas piping',
    'rough-in',
    'rough in',
  ],
  quickMeasurementFieldKeys: [...PLUMBING_PLAN_QUICK_MEASUREMENT_KEYS],
};

export const SUBCONTRACTOR_TRADE_DEFINITIONS: Record<
  SubcontractorTradeKey,
  SubcontractorTradeDefinition
> = {
  electrical: ELECTRICAL_DEFINITION,
  plumbing: PLUMBING_DEFINITION,
  hvac: scaffoldedTrade('hvac', 'HVAC', { standaloneTemplateKey: 'hvac' }),
  roofing: scaffoldedTrade('roofing', 'Roofing', {
    standaloneTemplateKey: 'roofing',
    reviewMeasurementKeys: [
      'roofAreaSqft',
      'roofIceWaterShieldSqft',
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
    ],
    quickMeasurementFieldKeys: [
      'roofAreaSqft',
      'roofIceWaterShieldSqft',
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
    ],
    scopeItems: ROOFING_SCOPE_ITEMS,
  }),
  concrete: scaffoldedTrade('concrete', 'Concrete', {
    standaloneTemplateKey: 'concrete',
    status: 'complete',
    scopeHint:
      'Focus on labeled flatwork areas, footing/foundation CY, excavation, and concrete notes.',
    missingInfo: [
      'Flatwork type areas and slab thickness',
      'Footing / foundation CY when not dimensioned',
      'Demo, excavation, and reinforcement only when explicitly supported',
    ],
    reviewMeasurementKeys: [...CONCRETE_REVIEW_MEASUREMENT_KEYS],
    reviewScopeKeywords: [
      'concrete',
      'flatwork',
      'driveway',
      'sidewalk',
      'walkway',
      'patio',
      'footing',
      'foundation',
      'excavation',
    ],
    quickMeasurementFieldKeys: [
      'concreteDrivewaySqft',
      'concreteSidewalkSqft',
      'concretePatioSqft',
      'concreteWalkwaySqft',
      'concreteRvPadSqft',
      'concreteSqft',
      'concreteCy',
      'excavationCy',
      'concreteDemoSqft',
      'concreteReinforcementSqft',
    ],
    scopeItems: CONCRETE_SCOPE_ITEMS,
  }),
  framing: scaffoldedTrade('framing', 'Framing', {
    standaloneTemplateKey: 'framing',
    status: 'complete',
    scopeHint:
      'Focus on floor plans, building sections, and framing notes. Map covered framed floor area (living plus garage when documented) and sheathing when explicitly supported. Do not infer stud counts or hardware from living area alone.',
    missingInfo: [
      'Covered framed floor area when not dimensioned',
      'Wall framing LF for partial remodel work',
      'Sheathing / shear area when not on elevations',
      'Rough opening counts only when documented',
    ],
    reviewMeasurementKeys: [...FRAMING_REVIEW_MEASUREMENT_KEYS],
    reviewScopeKeywords: [
      'framing',
      'frame',
      'stud',
      'sheathing',
      'shear',
      'osb',
      'plywood',
      'truss',
      'lumber',
    ],
    quickMeasurementFieldKeys: [...FRAMING_PLAN_QUICK_MEASUREMENT_KEYS],
    scopeItems: FRAMING_CARDS.map(card => ({
      scopeItemId: card.itemId,
      pricingBehavior: card.pricingBehavior,
      measurementKeys: [card.measurementKey],
    })),
  }),
  drywall: scaffoldedTrade('drywall', 'Drywall', {
    standaloneTemplateKey: 'drywall',
    quickMeasurementFieldKeys: ['drywallSqft'],
  }),
  stucco: STUCCO_DEFINITION,
  insulation: scaffoldedTrade('insulation', 'Insulation', {
    standaloneTemplateKey: 'insulation',
    status: 'complete',
    scopeHint:
      'Focus on the thermal envelope: exterior walls plus one attic or roof-deck boundary. Do not use drywall surface area as insulation quantity.',
    missingInfo: [
      'Exterior wall insulation area and assembly',
      'Attic/ceiling versus insulated roof-deck boundary',
      'Opening deductions, garage separation, and required R-values',
    ],
    reviewMeasurementKeys: [...INSULATION_PLAN_REVIEW_MEASUREMENT_KEYS],
    reviewScopeKeywords: [
      'insulation',
      'insulated',
      'batt',
      'blown',
      'spray foam',
      'r-value',
      'attic',
      'thermal envelope',
    ],
    quickMeasurementFieldKeys: [...INSULATION_PLAN_QUICK_MEASUREMENT_KEYS],
    scopeItems: [
      {
        scopeItemId: 'insulation',
        pricingBehavior: 'CUSTOM_PRICE',
        measurementKeys: ['exteriorWallInsulationSqft', 'atticInsulationSqft'],
      },
    ],
  }),
  flooring: scaffoldedTrade('flooring', 'Flooring', {
    standaloneTemplateKey: 'flooring',
    status: 'complete',
    scopeHint:
      'Focus on finish schedules, floor areas, and flooring notes. Do not infer demo, prep severity, or accessories without explicit support.',
    missingInfo: [
      'New flooring product types and install areas',
      'Existing floor types when not on finish schedule',
      'Demo, prep severity, and accessories only when explicitly supported',
    ],
    reviewMeasurementKeys: [...FLOORING_REVIEW_MEASUREMENT_KEYS],
    reviewScopeKeywords: [
      'flooring',
      'floor',
      'tile',
      'carpet',
      'lvp',
      'vinyl',
      'laminate',
      'hardwood',
    ],
    quickMeasurementFieldKeys: [
      'flooringSqft',
      'flooringLvpSqft',
      'flooringLaminateSqft',
      'flooringEngineeredHardwoodSqft',
      'flooringSolidHardwoodSqft',
      'flooringTileSqft',
      'flooringCarpetSqft',
      'flooringSheetVinylSqft',
      'floorDemoSqft',
      'floorPrepSqft',
      'underlaymentSqft',
      'moistureBarrierSqft',
      'baseboardLf',
      'transitionCount',
      'quarterRoundLf',
    ],
    scopeItems: [
      {
        scopeItemId: 'flooring_lvp',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
      {
        scopeItemId: 'tile_flooring',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
      {
        scopeItemId: 'flooring_carpet',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
      { scopeItemId: 'floor_demo', pricingBehavior: 'SEPARATE_ADDON' as const },
      { scopeItemId: 'floor_prep', pricingBehavior: 'SEPARATE_ADDON' as const },
      { scopeItemId: 'trim', pricingBehavior: 'SEPARATE_ADDON' as const },
      {
        scopeItemId: 'transitions',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
      {
        scopeItemId: 'quarter_round',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
      {
        scopeItemId: 'underlayment',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
      {
        scopeItemId: 'moisture_barrier',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
    ],
  }),
  painting: scaffoldedTrade('painting', 'Painting', {
    standaloneTemplateKey: 'painting',
    status: 'complete',
    scopeHint:
      'Inspect floor plans, reflected ceiling plans, finish schedules, door schedules, interior elevations, cabinet/millwork sheets, and exterior elevations — not only sheets titled Paint. Calculate wall, ceiling, trim, and door quantities from labeled paint totals or from dimensioned plan geometry with an explicit wall/plate height. Never infer paint from living/floor area. Do not infer prep, occupancy, or application method. Cabinets only when the plan supports paint-grade millwork.',
    missingInfo: [
      'Interior wall and ceiling areas when not dimensioned',
      'Job condition and application method',
      'Prep / masking only when explicitly supported',
    ],
    reviewMeasurementKeys: [...PAINTING_REVIEW_MEASUREMENT_KEYS],
    reviewScopeKeywords: [
      'painting',
      'paint',
      'trim',
      'cabinet',
      'floor plan',
      'finish plan',
      'finish schedule',
      'room finish',
      'rcp',
      'reflected ceiling',
      'door schedule',
      'interior elevation',
      'exterior elevation',
      'elevation',
      'millwork',
      'baseboard',
      'wall finish',
      'ceiling finish',
    ],
    quickMeasurementFieldKeys: [
      'wallPaintSqft',
      'ceilingPaintSqft',
      'paintAreaSqft',
      'baseboardLf',
      'interiorDoorCount',
      'cabinetRunLf',
      'exteriorPaintSqft',
    ],
    scopeItems: [
      { scopeItemId: 'prep', pricingBehavior: 'SEPARATE_ADDON' as const },
      {
        scopeItemId: 'interior_paint',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
      {
        scopeItemId: 'ceiling_paint',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
      { scopeItemId: 'trim_paint', pricingBehavior: 'SEPARATE_ADDON' as const },
      { scopeItemId: 'door_paint', pricingBehavior: 'SEPARATE_ADDON' as const },
      {
        scopeItemId: 'cabinet_paint',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
      {
        scopeItemId: 'exterior_prep',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
      {
        scopeItemId: 'exterior_paint',
        pricingBehavior: 'SEPARATE_ADDON' as const,
      },
    ],
  }),
  windows_doors: scaffoldedTrade('windows_doors', 'Windows & doors'),
};

export function getSubcontractorTradeDefinition(
  key: string | null | undefined
): SubcontractorTradeDefinition | null {
  if (!key) return null;
  return SUBCONTRACTOR_TRADE_DEFINITIONS[key as SubcontractorTradeKey] || null;
}

export function getPlanExportTradeConfigurations(): SubcontractorTradeDefinition[] {
  return PLAN_EXPORT_TRADE_KEYS.map(
    key => SUBCONTRACTOR_TRADE_DEFINITIONS[key]
  );
}

export { getTradeScopeAllowlist, TRADE_SCOPE_ALLOWLISTS };

export type { ScopePricingBehavior };
