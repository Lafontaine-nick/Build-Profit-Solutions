import type {
  SubcontractorTradeKey,
  TradeMeasurementDefinition,
} from './types';
import { ELECTRICAL_CARDS } from './electricalPlanConvergence';
import { PLUMBING_CARDS } from './plumbingPlanConvergence';
import {
  HVAC_CARDS,
  HVAC_PLAN_REVIEW_MEASUREMENT_KEYS,
} from './hvacPlanConvergence';
import { WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS } from './windowsDoorsPlanConvergence';
import { GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS } from './garageDoorsPlanConvergence';

const M = (
  key: string,
  label: string,
  unit: string,
  tier: TradeMeasurementDefinition['tier'],
  opts: Partial<TradeMeasurementDefinition> = {}
): TradeMeasurementDefinition => ({
  key,
  label,
  unit,
  tier,
  ...opts,
});

/** Declarative measurement contracts — metadata only in Phase 0. */
export const TRADE_MEASUREMENT_SCHEMAS: Partial<
  Record<SubcontractorTradeKey, TradeMeasurementDefinition[]>
> = {
  stucco: [
    M('stuccoGrossWallSqft', 'Gross exterior wall area', 'sqft', 'primary', {
      quickMeasurementKey: 'stuccoGrossWallSqft',
    }),
    M(
      'stuccoWindowDoorOpeningSqft',
      'Window & door openings',
      'sqft',
      'primary',
      { quickMeasurementKey: 'stuccoWindowDoorOpeningSqft' }
    ),
    M('stuccoGarageOpeningSqft', 'Garage door openings', 'sqft', 'primary', {
      quickMeasurementKey: 'stuccoGarageOpeningSqft',
    }),
    M(
      'stuccoOtherFinishDeductionSqft',
      'Other finish deductions',
      'sqft',
      'primary',
      { quickMeasurementKey: 'stuccoOtherFinishDeductionSqft' }
    ),
    M('stuccoNetWallSqft', 'Net stucco wall area', 'sqft', 'calculated', {
      quickMeasurementKey: 'stuccoNetWallSqft',
      calculatedFrom: [
        'stuccoGrossWallSqft',
        'stuccoWindowDoorOpeningSqft',
        'stuccoGarageOpeningSqft',
        'stuccoOtherFinishDeductionSqft',
      ],
    }),
    M('stuccoSoffitSqft', 'Soffits / stucco ceilings', 'sqft', 'more', {
      quickMeasurementKey: 'stuccoSoffitSqft',
    }),
    M('stuccoParapetSqft', 'Parapets / raised walls', 'sqft', 'more', {
      quickMeasurementKey: 'stuccoParapetSqft',
    }),
    M('stuccoFoamTrimLf', 'Foam trim / architectural bands', 'LF', 'more', {
      quickMeasurementKey: 'stuccoFoamTrimLf',
    }),
    M('stuccoControlJointLf', 'Control / expansion joints', 'LF', 'more', {
      quickMeasurementKey: 'stuccoControlJointLf',
    }),
    M('stuccoStories', 'Stories', 'story', 'more', {
      quickMeasurementKey: 'stuccoStories',
    }),
    M('stuccoWallHeightFt', 'Typical wall height / story', 'ft', 'more', {
      quickMeasurementKey: 'stuccoWallHeightFt',
    }),
    M('stuccoRepairAffectedSqft', 'Repair affected area', 'sqft', 'more', {
      quickMeasurementKey: 'stuccoRepairAffectedSqft',
    }),
    M('stuccoAccessAffectedSqft', 'Access affected area', 'sqft', 'more', {
      quickMeasurementKey: 'stuccoAccessAffectedSqft',
    }),
  ],
  roofing: [
    M('roofAreaSqft', 'Roof surface area', 'sqft', 'primary', {
      quickMeasurementKey: 'roofAreaSqft',
    }),
    M('roofIceWaterShieldSqft', 'Ice & water shield area', 'sqft', 'more', {
      quickMeasurementKey: 'roofIceWaterShieldSqft',
    }),
    M('roofSquares', 'Roof squares', 'squares', 'primary', {
      quickMeasurementKey: 'roofSquares',
    }),
    M('roofPitch', 'Roof pitch / slope', 'ratio', 'primary', {
      quickMeasurementKey: 'roofPitch',
    }),
    M('storyCount', 'Stories', 'story', 'primary', {
      quickMeasurementKey: 'storyCount',
    }),
    M('roofDeckingReplacementSqft', 'Decking replacement', 'sqft', 'more', {
      quickMeasurementKey: 'roofDeckingReplacementSqft',
    }),
    M('roofDripEdgeLf', 'Drip edge', 'LF', 'more', {
      quickMeasurementKey: 'roofDripEdgeLf',
    }),
    M('roofRidgeCapLf', 'Ridge cap', 'LF', 'more', {
      quickMeasurementKey: 'roofRidgeCapLf',
    }),
    M('roofValleyFlashingLf', 'Valley flashing', 'LF', 'more', {
      quickMeasurementKey: 'roofValleyFlashingLf',
    }),
    M('roofStepFlashingLf', 'Step flashing', 'LF', 'more', {
      quickMeasurementKey: 'roofStepFlashingLf',
    }),
    M('roofWallFlashingLf', 'Wall flashing', 'LF', 'more', {
      quickMeasurementKey: 'roofWallFlashingLf',
    }),
    M('roofRidgeVentLf', 'Ridge vent', 'EA', 'more', {
      quickMeasurementKey: 'roofRidgeVentLf',
    }),
    M('roofVentCount', 'Roof vents', 'EA', 'more', {
      quickMeasurementKey: 'roofVentCount',
    }),
    M('roofTurbineVentCount', 'Turbine vents', 'EA', 'more', {
      quickMeasurementKey: 'roofTurbineVentCount',
    }),
    M('roofPipeBootCount', 'Pipe boots', 'EA', 'more', {
      quickMeasurementKey: 'roofPipeBootCount',
    }),
    M('roofChimneyFlashingCount', 'Chimney flashing', 'EA', 'more', {
      quickMeasurementKey: 'roofChimneyFlashingCount',
    }),
    M('roofSkylightCount', 'Skylight flashing', 'EA', 'more', {
      quickMeasurementKey: 'roofSkylightCount',
    }),
    M('roofPenetrationCount', 'Other penetrations', 'EA', 'more', {
      quickMeasurementKey: 'roofPenetrationCount',
    }),
    M('roofRepairAffectedSqft', 'Repair affected area', 'sqft', 'more', {
      quickMeasurementKey: 'roofRepairAffectedSqft',
    }),
    M('roofGutterLf', 'Gutters', 'LF', 'more', {
      quickMeasurementKey: 'roofGutterLf',
    }),
    M('roofDownspoutCount', 'Downspouts', 'EA', 'more', {
      quickMeasurementKey: 'roofDownspoutCount',
    }),
  ],
  plumbing: PLUMBING_CARDS.map(card =>
    M(
      card.measurementKey,
      card.label,
      card.unit,
      card.groupId === 'lines' ? 'primary' : 'more',
      {
        quickMeasurementKey: card.measurementKey,
      }
    )
  ),
  hvac: [
    ...HVAC_CARDS.map(card =>
      M(card.measurementKey, card.label, card.unit, 'more', {
        quickMeasurementKey: card.measurementKey,
      })
    ),
    M('hvacSystemTons', 'HVAC system capacity', 'ton', 'primary', {
      quickMeasurementKey: 'hvacSystemTons',
    }),
  ].filter(
    (definition, index, all) =>
      HVAC_PLAN_REVIEW_MEASUREMENT_KEYS.includes(
        definition.key as (typeof HVAC_PLAN_REVIEW_MEASUREMENT_KEYS)[number]
      ) &&
      all.findIndex(other => other.key === definition.key) === index
  ),
  concrete: [
    M('concreteDrivewaySqft', 'Driveway area', 'sqft', 'primary', {
      quickMeasurementKey: 'concreteDrivewaySqft',
    }),
    M('concreteSidewalkSqft', 'Sidewalk area', 'sqft', 'primary', {
      quickMeasurementKey: 'concreteSidewalkSqft',
    }),
    M('concretePatioSqft', 'Patio area', 'sqft', 'primary', {
      quickMeasurementKey: 'concretePatioSqft',
    }),
    M('concreteWalkwaySqft', 'Walkway area', 'sqft', 'primary', {
      quickMeasurementKey: 'concreteWalkwaySqft',
    }),
    M('concreteRvPadSqft', 'RV pad area', 'sqft', 'more', {
      quickMeasurementKey: 'concreteRvPadSqft',
    }),
    M('concreteSqft', 'Total flatwork area', 'sqft', 'calculated', {
      quickMeasurementKey: 'concreteSqft',
      calculatedFrom: [
        'concreteDrivewaySqft',
        'concreteSidewalkSqft',
        'concretePatioSqft',
        'concreteWalkwaySqft',
        'concreteRvPadSqft',
      ],
    }),
    M('concreteCy', 'Footing / foundation concrete', 'CY', 'primary', {
      quickMeasurementKey: 'concreteCy',
    }),
    M('excavationCy', 'Excavation', 'CY', 'more', {
      quickMeasurementKey: 'excavationCy',
    }),
    M('concreteDemoSqft', 'Concrete demo / removal', 'sqft', 'more', {
      quickMeasurementKey: 'concreteDemoSqft',
    }),
    M('concreteReinforcementSqft', 'Rebar / mesh area', 'sqft', 'more', {
      quickMeasurementKey: 'concreteReinforcementSqft',
    }),
    M('concreteSubgradePrepSqft', 'Subgrade prep / grading', 'sqft', 'more', {
      quickMeasurementKey: 'concreteSubgradePrepSqft',
    }),
    M('complexFormingLf', 'Complex forming', 'LF', 'more', {
      quickMeasurementKey: 'complexFormingLf',
    }),
  ],
  framing: [
    M('framedAreaSqft', 'Framed floor area', 'sqft', 'primary', {
      quickMeasurementKey: 'framedAreaSqft',
    }),
    M('wallFramingLf', 'Wall framing', 'LF', 'primary', {
      quickMeasurementKey: 'wallFramingLf',
    }),
    M('sheathingSqft', 'Sheathing / shear', 'sqft', 'primary', {
      quickMeasurementKey: 'sheathingSqft',
    }),
    M('framingOpeningCount', 'Door / window openings', 'each', 'more', {
      quickMeasurementKey: 'framingOpeningCount',
    }),
    M('framingCleanupCount', 'Framing cleanup', 'allowance', 'more', {
      quickMeasurementKey: 'framingCleanupCount',
    }),
    M('floorAreaSqft', 'Living area', 'sqft', 'more', {
      quickMeasurementKey: 'floorAreaSqft',
    }),
    M('garageSqft', 'Garage area', 'sqft', 'more', {
      quickMeasurementKey: 'garageSqft',
    }),
    M('stuccoGrossWallSqft', 'Gross wall area', 'sqft', 'more', {
      quickMeasurementKey: 'stuccoGrossWallSqft',
    }),
  ],
  drywall: [
    M('drywallSqft', 'Total drywall area', 'sqft', 'primary', {
      quickMeasurementKey: 'drywallSqft',
    }),
    M('drywallWallSqft', 'Drywall wall surface', 'sqft', 'primary', {
      quickMeasurementKey: 'drywallWallSqft',
    }),
    M('drywallCeilingSqft', 'Drywall ceiling surface', 'sqft', 'primary', {
      quickMeasurementKey: 'drywallCeilingSqft',
    }),
    M(
      'drywallOpeningDeductionSqft',
      'Drywall opening deductions',
      'sqft',
      'more',
      { quickMeasurementKey: 'drywallOpeningDeductionSqft' }
    ),
  ],
  insulation: [
    M(
      'exteriorWallInsulationSqft',
      'Exterior wall insulation',
      'sqft',
      'primary',
      { quickMeasurementKey: 'exteriorWallInsulationSqft' }
    ),
    M('atticInsulationSqft', 'Attic / ceiling insulation', 'sqft', 'primary', {
      quickMeasurementKey: 'atticInsulationSqft',
    }),
    M('insulatedRoofDeckSqft', 'Insulated roof deck', 'sqft', 'more', {
      quickMeasurementKey: 'insulatedRoofDeckSqft',
    }),
    M('floorInsulationSqft', 'Floor insulation', 'sqft', 'more', {
      quickMeasurementKey: 'floorInsulationSqft',
    }),
    M(
      'garageSeparationInsulationSqft',
      'Garage separation insulation',
      'sqft',
      'more',
      { quickMeasurementKey: 'garageSeparationInsulationSqft' }
    ),
    M('openingDeductionSqft', 'Exterior opening deduction', 'sqft', 'more', {
      quickMeasurementKey: 'openingDeductionSqft',
    }),
    M('insulationMaterialType', 'Insulation type', 'type', 'primary', {
      quickMeasurementKey: 'insulationMaterialType',
    }),
    M('insulationRValue', 'Target R-value', 'R-value', 'primary', {
      quickMeasurementKey: 'insulationRValue',
    }),
    M(
      'garageInsulationIncluded',
      'Garage insulation included',
      'choice',
      'more',
      { quickMeasurementKey: 'garageInsulationIncluded' }
    ),
  ],
  flooring: [
    M('flooringSqft', 'Total flooring area', 'sqft', 'primary', {
      quickMeasurementKey: 'flooringSqft',
    }),
    M('flooringLvpSqft', 'LVP install area', 'sqft', 'primary', {
      quickMeasurementKey: 'flooringLvpSqft',
    }),
    M('flooringLaminateSqft', 'Laminate install area', 'sqft', 'primary', {
      quickMeasurementKey: 'flooringLaminateSqft',
    }),
    M(
      'flooringEngineeredHardwoodSqft',
      'Engineered hardwood install area',
      'sqft',
      'more',
      { quickMeasurementKey: 'flooringEngineeredHardwoodSqft' }
    ),
    M(
      'flooringSolidHardwoodSqft',
      'Solid hardwood install area',
      'sqft',
      'more',
      { quickMeasurementKey: 'flooringSolidHardwoodSqft' }
    ),
    M('flooringTileSqft', 'Tile install area', 'sqft', 'primary', {
      quickMeasurementKey: 'flooringTileSqft',
    }),
    M('flooringCarpetSqft', 'Carpet install area', 'sqft', 'primary', {
      quickMeasurementKey: 'flooringCarpetSqft',
    }),
    M(
      'flooringSheetVinylSqft',
      'Sheet vinyl / VCT install area',
      'sqft',
      'more',
      { quickMeasurementKey: 'flooringSheetVinylSqft' }
    ),
    M('floorDemoSqft', 'Floor demo / removal', 'sqft', 'more', {
      quickMeasurementKey: 'floorDemoSqft',
    }),
    M('floorPrepSqft', 'Affected floor-prep area', 'sqft', 'more', {
      quickMeasurementKey: 'floorPrepSqft',
    }),
    M('underlaymentSqft', 'Underlayment', 'sqft', 'more', {
      quickMeasurementKey: 'underlaymentSqft',
    }),
    M('moistureBarrierSqft', 'Moisture barrier', 'sqft', 'more', {
      quickMeasurementKey: 'moistureBarrierSqft',
    }),
    M('baseboardLf', 'Baseboard / trim', 'LF', 'more', {
      quickMeasurementKey: 'baseboardLf',
    }),
    M('transitionCount', 'Transitions / reducers', 'each', 'more', {
      quickMeasurementKey: 'transitionCount',
    }),
    M('quarterRoundLf', 'Quarter round', 'LF', 'more', {
      quickMeasurementKey: 'quarterRoundLf',
    }),
  ],
  painting: [
    M('wallPaintSqft', 'Interior walls', 'sqft', 'primary', {
      quickMeasurementKey: 'wallPaintSqft',
    }),
    M('ceilingPaintSqft', 'Ceilings', 'sqft', 'primary', {
      quickMeasurementKey: 'ceilingPaintSqft',
    }),
    M('paintAreaSqft', 'Combined paintable area', 'sqft', 'primary', {
      quickMeasurementKey: 'paintAreaSqft',
    }),
    M(
      'combinedPaintableAreaSqft',
      'Combined paintable area',
      'sqft',
      'calculated',
      { quickMeasurementKey: 'combinedPaintableAreaSqft' }
    ),
    M('baseboardLf', 'Baseboard / trim', 'LF', 'more', {
      quickMeasurementKey: 'baseboardLf',
    }),
    M('interiorDoorCount', 'Interior doors', 'each', 'more', {
      quickMeasurementKey: 'interiorDoorCount',
    }),
    M('cabinetRunLf', 'Cabinet painting', 'LF', 'more', {
      quickMeasurementKey: 'cabinetRunLf',
    }),
    M('cabinetPaintSqft', 'Cabinet painting area', 'sqft', 'more', {
      quickMeasurementKey: 'cabinetPaintSqft',
    }),
    M('exteriorPaintSqft', 'Exterior paint', 'sqft', 'primary', {
      quickMeasurementKey: 'exteriorPaintSqft',
    }),
  ],
  windows_doors: WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS.map(key =>
    M(
      key,
      {
        windowCount: 'Windows',
        exteriorDoorCount: 'Exterior swing doors',
        slidingDoorCount: 'Sliding / patio doors',
        interiorDoorCount: 'Interior doors',
      }[key],
      'each',
      key === 'windowCount' || key === 'exteriorDoorCount' ? 'primary' : 'more',
      { quickMeasurementKey: key }
    )
  ),
  garage_doors: GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS.map(key =>
    M(
      key,
      {
        garageDoorSingleCount: 'Single garage doors',
        garageDoorDoubleCount: 'Double garage doors',
        garageDoorRvCount: 'RV / oversized garage doors',
        garageDoorOpenerCount: 'Garage door openers',
      }[key],
      'each',
      key === 'garageDoorOpenerCount' ? 'more' : 'primary',
      { quickMeasurementKey: key }
    )
  ),
  electrical: [
    M('serviceAmperage', 'Service amperage', 'amp', 'primary'),
    ...ELECTRICAL_CARDS.filter(
      card => card.measurementKey !== 'serviceAmperage'
    ).map(card =>
      M(
        card.measurementKey,
        card.label,
        card.unit,
        card.groupId === 'service_panels' || card.groupId === 'circuits'
          ? 'primary'
          : 'more'
      )
    ),
  ],
};

export function getTradeMeasurementSchema(
  tradeKey: SubcontractorTradeKey
): TradeMeasurementDefinition[] {
  return TRADE_MEASUREMENT_SCHEMAS[tradeKey] || [];
}
