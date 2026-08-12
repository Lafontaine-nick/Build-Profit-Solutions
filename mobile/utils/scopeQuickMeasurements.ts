/**
 * Quick measurement fields shown per scope checklist template.
 * All fields render for the job type; values prefill from notes when parsed.
 */
import { measurementSemanticsV1Enabled } from '@/utils/measurementSemantics';

export type QuickMeasurementFieldKey =
  | 'bathroomFloorSqft'
  | 'kitchenFloorSqft'
  | 'floorAreaSqft'
  | 'backsplashSqft'
  | 'countertopSqft'
  | 'cabinetLf'
  | 'showerWallTileSqft'
  | 'showerFloorTileSqft'
  | 'wallPaintSqft'
  | 'ceilingPaintSqft'
  | 'paintAreaSqft'
  | 'exteriorPaintSqft'
  | 'baseboardLf'
  | 'interiorDoorCount'
  | 'cabinetPaintSqft'
  | 'cabinetUpperLf'
  | 'cabinetLowerLf'
  | 'cabinetTallLf'
  | 'cabinetRunLf'
  | 'railingLf'
  | 'landscapeSqft'
  | 'artificialTurfSqft'
  | 'demoClearingSqft'
  | 'gradingSqft'
  | 'soilPrepSqft'
  | 'sodSqft'
  | 'paverSqft'
  | 'rockMulchSqft'
  | 'landscapeTons'
  | 'plantCount'
  | 'treeCount'
  | 'irrigationZoneCount'
  | 'drainageLf'
  | 'concreteEdgingLf'
  | 'boulderCount'
  | 'landscapeLightCount'
  | 'roofSquares'
  | 'roofAreaSqft'
  | 'roofIceWaterShieldSqft'
  | 'roofPitch'
  | 'storyCount'
  | 'roofDeckingReplacementSqft'
  | 'roofDripEdgeLf'
  | 'roofRidgeCapLf'
  | 'roofRidgeVentLf'
  | 'roofValleyFlashingLf'
  | 'roofStepFlashingLf'
  | 'roofWallFlashingLf'
  | 'roofChimneyFlashingCount'
  | 'roofPipeBootCount'
  | 'roofVentCount'
  | 'roofTurbineVentCount'
  | 'roofSkylightCount'
  | 'roofPenetrationCount'
  | 'roofRepairAffectedSqft'
  | 'roofGutterLf'
  | 'roofDownspoutCount'
  | 'drywallSqft'
  | 'flooringSqft'
  | 'flooringLvpSqft'
  | 'flooringLaminateSqft'
  | 'flooringEngineeredHardwoodSqft'
  | 'flooringSolidHardwoodSqft'
  | 'flooringTileSqft'
  | 'flooringCarpetSqft'
  | 'floorDemoSqft'
  | 'floorPrepSqft'
  | 'underlaymentSqft'
  | 'moistureBarrierSqft'
  | 'transitionLf'
  | 'transitionCount'
  | 'quarterRoundLf'
  | 'concreteSqft'
  | 'concreteDemoSqft'
  | 'concreteCy'
  | 'excavationCy'
  | 'concreteDrivewaySqft'
  | 'concreteSidewalkSqft'
  | 'concretePatioSqft'
  | 'concreteWalkwaySqft'
  | 'concreteRvPadSqft'
  | 'concreteDrivewayThicknessInches'
  | 'concreteSidewalkThicknessInches'
  | 'concretePatioThicknessInches'
  | 'concreteWalkwayThicknessInches'
  | 'concreteRvPadThicknessInches'
  | 'concreteReinforcementSqft'
  | 'concreteSubgradePrepSqft'
  | 'complexFormingLf'
  | 'deckSqft'
  | 'garageSqft'
  | 'stuccoGrossWallSqft'
  | 'stuccoWindowDoorOpeningSqft'
  | 'stuccoGarageOpeningSqft'
  | 'stuccoOtherFinishDeductionSqft'
  | 'stuccoNetWallSqft'
  | 'stuccoSoffitSqft'
  | 'stuccoParapetSqft'
  | 'stuccoFoamTrimLf'
  | 'stuccoControlJointLf'
  | 'stuccoAccessAffectedSqft'
  | 'stuccoRepairAffectedSqft'
  | 'stuccoStories'
  | 'stuccoWallHeightFt';

export type QuickMeasurementGroupId =
  | 'site'
  | 'structure'
  | 'interior'
  | 'exterior'
  | 'other';

export type QuickMeasurementFieldDef = {
  key: QuickMeasurementFieldKey;
  label: string;
  placeholder: string;
  unit: string;
  group: QuickMeasurementGroupId;
  /** Emphasize as the main driver field (full-width, first). */
  primary?: boolean;
  /** Short clarifying line shown under the label (e.g. what's included/excluded). */
  helperText?: string;
};

/** Two fields per row when consecutive defs share a row group. */
export type QuickMeasurementRow = QuickMeasurementFieldDef[];

export type QuickMeasurementSection = {
  id: QuickMeasurementGroupId;
  title: string;
  rows: QuickMeasurementRow[];
};

const GROUP_TITLES: Record<QuickMeasurementGroupId, string> = {
  site: 'Site',
  structure: 'Structure',
  interior: 'Interior',
  exterior: 'Exterior',
  other: 'Other',
};

const GROUP_ORDER: QuickMeasurementGroupId[] = [
  'site',
  'structure',
  'interior',
  'exterior',
  'other',
];

const row = (...fields: QuickMeasurementFieldDef[]): QuickMeasurementRow =>
  fields;

const F = (
  key: QuickMeasurementFieldKey,
  label: string,
  placeholder: string,
  unit: string,
  group: QuickMeasurementGroupId,
  primary?: boolean,
  helperText?: string
): QuickMeasurementFieldDef => ({
  key,
  label,
  placeholder,
  unit,
  group,
  primary,
  helperText,
});

const EXTERIOR_FLATWORK_LABEL = 'Exterior concrete flatwork';
const EXTERIOR_FLATWORK_HELPER =
  'Driveway, walkways, porch, and exterior patio slabs — not the house or garage slab.';

const QUICK_MEASUREMENT_FIELD_DEFS: Partial<Record<
  QuickMeasurementFieldKey,
  QuickMeasurementFieldDef
>> = {
  bathroomFloorSqft: F(
    'bathroomFloorSqft',
    'Bath floor',
    '90',
    'sqft',
    'interior'
  ),
  kitchenFloorSqft: F(
    'kitchenFloorSqft',
    'Kitchen floor',
    '180',
    'sqft',
    'interior'
  ),
  floorAreaSqft: F(
    'floorAreaSqft',
    'Floor area',
    '1200',
    'sqft',
    'structure',
    true
  ),
  backsplashSqft: F('backsplashSqft', 'Backsplash', '40', 'sqft', 'interior'),
  countertopSqft: F('countertopSqft', 'Counters', '55', 'sqft', 'interior'),
  cabinetLf: F('cabinetLf', 'Cabinets / vanity', '24', 'LF', 'interior'),
  showerWallTileSqft: F(
    'showerWallTileSqft',
    'Shower walls',
    '90',
    'sqft',
    'interior'
  ),
  showerFloorTileSqft: F(
    'showerFloorTileSqft',
    'Shower floor',
    '15',
    'sqft',
    'interior'
  ),
  wallPaintSqft: F(
    'wallPaintSqft',
    'Interior paint',
    '320',
    'sqft',
    'interior'
  ),
  ceilingPaintSqft: F(
    'ceilingPaintSqft',
    'Ceilings',
    '320',
    'sqft',
    'interior'
  ),
  paintAreaSqft: F(
    'paintAreaSqft',
    'Paint area — confirm basis',
    '1500',
    'sqft',
    'interior'
  ),
  exteriorPaintSqft: F(
    'exteriorPaintSqft',
    'Exterior paint',
    '2200',
    'sqft',
    'exterior'
  ),
  baseboardLf: F('baseboardLf', 'Baseboard', '48', 'LF', 'interior'),
  interiorDoorCount: F(
    'interiorDoorCount',
    'Interior doors',
    '6',
    'each',
    'interior'
  ),
  cabinetPaintSqft: F(
    'cabinetPaintSqft',
    'Paintable Cabinet Surface Area',
    '200',
    'sqft',
    'interior',
    undefined,
    'Enter total paintable surface area for selected doors, drawer fronts, face frames, and exposed cabinet panels. Do not use kitchen floor area.'
  ),
  cabinetUpperLf: F('cabinetUpperLf', 'Upper Cabinets', '15', 'LF', 'interior'),
  cabinetLowerLf: F('cabinetLowerLf', 'Lower Cabinets', '15', 'LF', 'interior'),
  cabinetTallLf: F(
    'cabinetTallLf',
    'Tall / Pantry Cabinets',
    '0',
    'LF',
    'interior'
  ),
  cabinetRunLf: F(
    'cabinetRunLf',
    'Cabinet Run Length',
    '30',
    'LF',
    'interior',
    undefined,
    'Enter the total linear feet of upper, lower, and pantry cabinets being painted.'
  ),
  railingLf: F('railingLf', 'Railing', '48', 'LF', 'exterior'),
  landscapeSqft: F('landscapeSqft', 'Coverage', '1200', 'sqft', 'site'),
  artificialTurfSqft: F(
    'artificialTurfSqft',
    'Artificial turf',
    '900',
    'sqft',
    'site'
  ),
  sodSqft: F('sodSqft', 'Sod / turf', '900', 'sqft', 'site'),
  paverSqft: F('paverSqft', 'Pavers', '180', 'sqft', 'site'),
  rockMulchSqft: F('rockMulchSqft', 'Rock / mulch', '600', 'sqft', 'site'),
  landscapeTons: F('landscapeTons', 'Rock / mulch', '12', 'tons', 'site'),
  roofSquares: F('roofSquares', 'Roof', '28', 'sq', 'structure'),
  roofAreaSqft: F(
    'roofAreaSqft',
    'Roof surface area',
    'Enter',
    'sqft',
    'structure',
    undefined,
    'Use only a measured roof surface area; do not substitute living or floor area.'
  ),
  roofPitch: F('roofPitch', 'Roof pitch / slope', 'e.g. 5:12', 'ratio', 'structure'),
  storyCount: F('storyCount', 'Stories', '1', 'story', 'structure'),
  roofDeckingReplacementSqft: F(
    'roofDeckingReplacementSqft',
    'Decking replacement',
    'e.g. 200',
    'sqft',
    'structure'
  ),
  roofDripEdgeLf: F('roofDripEdgeLf', 'Drip edge', 'e.g. 120', 'LF', 'structure'),
  roofRidgeCapLf: F('roofRidgeCapLf', 'Ridge cap', 'e.g. 80', 'LF', 'structure'),
  roofRidgeVentLf: F('roofRidgeVentLf', 'Ridge vent', 'e.g. 2', 'EA', 'structure'),
  roofValleyFlashingLf: F(
    'roofValleyFlashingLf',
    'Valley flashing',
    'e.g. 60',
    'LF',
    'structure'
  ),
  roofStepFlashingLf: F(
    'roofStepFlashingLf',
    'Step flashing',
    'e.g. 40',
    'LF',
    'structure'
  ),
  roofWallFlashingLf: F(
    'roofWallFlashingLf',
    'Wall flashing',
    'e.g. 40',
    'LF',
    'structure'
  ),
  roofChimneyFlashingCount: F(
    'roofChimneyFlashingCount',
    'Chimney flashing',
    'e.g. 1',
    'EA',
    'structure'
  ),
  roofPipeBootCount: F('roofPipeBootCount', 'Pipe boots', 'e.g. 4', 'EA', 'structure'),
  roofVentCount: F('roofVentCount', 'Roof vents', 'e.g. 2', 'EA', 'structure'),
  roofTurbineVentCount: F(
    'roofTurbineVentCount',
    'Turbine vents',
    'e.g. 2',
    'EA',
    'structure'
  ),
  roofSkylightCount: F(
    'roofSkylightCount',
    'Skylight flashing',
    'e.g. 1',
    'EA',
    'structure'
  ),
  roofPenetrationCount: F(
    'roofPenetrationCount',
    'Other penetrations',
    'e.g. 2',
    'EA',
    'structure'
  ),
  roofRepairAffectedSqft: F(
    'roofRepairAffectedSqft',
    'Roof repair affected area',
    'e.g. 100',
    'sqft',
    'structure'
  ),
  roofGutterLf: F('roofGutterLf', 'Gutters', 'e.g. 150', 'LF', 'structure'),
  roofDownspoutCount: F(
    'roofDownspoutCount',
    'Downspouts',
    'e.g. 4',
    'EA',
    'structure'
  ),
  drywallSqft: F('drywallSqft', 'Drywall', '800', 'sqft', 'interior'),
  flooringSqft: F(
    'flooringSqft',
    'Total Flooring Area',
    '600',
    'sqft',
    'interior',
    undefined,
    'Usually matches living area unless unfinished space differs.'
  ),
  flooringLvpSqft: F('flooringLvpSqft', 'LVP', '600', 'sqft', 'interior'),
  flooringLaminateSqft: F(
    'flooringLaminateSqft',
    'Laminate',
    '600',
    'sqft',
    'interior'
  ),
  flooringEngineeredHardwoodSqft: F(
    'flooringEngineeredHardwoodSqft',
    'Engineered hardwood',
    '600',
    'sqft',
    'interior'
  ),
  flooringSolidHardwoodSqft: F(
    'flooringSolidHardwoodSqft',
    'Solid hardwood',
    '600',
    'sqft',
    'interior'
  ),
  flooringTileSqft: F('flooringTileSqft', 'Tile', '600', 'sqft', 'interior'),
  flooringCarpetSqft: F(
    'flooringCarpetSqft',
    'Carpet',
    '600',
    'sqft',
    'interior'
  ),
  floorDemoSqft: F(
    'floorDemoSqft',
    'Floor demo / removal',
    '600',
    'sqft',
    'interior'
  ),
  floorPrepSqft: F(
    'floorPrepSqft',
    'Affected floor-prep area',
    'Enter only the area requiring residual adhesive or thinset removal, grinding, patching, skim coating, or leveling after demolition.',
    'sqft',
    'interior',
    undefined,
    'Enter only the area requiring residual adhesive or thinset removal, grinding, patching, skim coating, or leveling after demolition.'
  ),
  underlaymentSqft: F(
    'underlaymentSqft',
    'Underlayment',
    '600',
    'sqft',
    'interior'
  ),
  moistureBarrierSqft: F(
    'moistureBarrierSqft',
    'Vapor / moisture barrier',
    '600',
    'sqft',
    'interior'
  ),
  quarterRoundLf: F('quarterRoundLf', 'Quarter round', '48', 'LF', 'interior'),
  concreteSqft: F(
    'concreteSqft',
    EXTERIOR_FLATWORK_LABEL,
    '400',
    'sqft',
    'structure',
    undefined,
    EXTERIOR_FLATWORK_HELPER
  ),
  concreteDrivewaySqft: F(
    'concreteDrivewaySqft',
    'Driveway area',
    '800',
    'sqft',
    'structure',
    undefined,
    'Labeled driveway flatwork only.'
  ),
  concreteSidewalkSqft: F(
    'concreteSidewalkSqft',
    'Sidewalk area',
    '120',
    'sqft',
    'structure',
    undefined,
    'Labeled sidewalk flatwork only.'
  ),
  concretePatioSqft: F(
    'concretePatioSqft',
    'Patio area',
    '250',
    'sqft',
    'structure',
    undefined,
    'Exterior concrete patio slab only — not covered patio.'
  ),
  concreteWalkwaySqft: F(
    'concreteWalkwaySqft',
    'Walkway area',
    '140',
    'sqft',
    'structure',
    undefined,
    'Labeled walkway flatwork only.'
  ),
  concreteRvPadSqft: F(
    'concreteRvPadSqft',
    'RV pad area',
    '400',
    'sqft',
    'structure',
    undefined,
    'Labeled RV pad flatwork only.'
  ),
  concreteCy: F(
    'concreteCy',
    'Footing / foundation concrete',
    '12',
    'CY',
    'structure',
    undefined,
    'Structural footing or foundation pour — separate from flatwork SF.'
  ),
  excavationCy: F('excavationCy', 'Excavation', '45', 'CY', 'site'),
  concreteDemoSqft: F(
    'concreteDemoSqft',
    'Concrete demo / removal',
    '100',
    'sqft',
    'site',
    undefined,
    'Existing concrete removal area only — not inferred from new flatwork.'
  ),
  concreteReinforcementSqft: F(
    'concreteReinforcementSqft',
    'Rebar / mesh area',
    '400',
    'sqft',
    'structure',
    undefined,
    'Reinforcement area only when explicitly supported.'
  ),
  deckSqft: F('deckSqft', 'Deck / patio', '320', 'sqft', 'exterior'),
  garageSqft: F('garageSqft', 'Garage', '480', 'sqft', 'structure'),
  stuccoGrossWallSqft: F(
    'stuccoGrossWallSqft',
    'Exterior wall area — gross',
    'Enter',
    'sqft',
    'exterior',
    true,
    'Gross exterior wall surface before windows, doors, garage openings, or other finish deductions.'
  ),
  stuccoWindowDoorOpeningSqft: F(
    'stuccoWindowDoorOpeningSqft',
    'Window & door openings',
    'Enter',
    'sqft',
    'exterior',
    undefined,
    'Deduct window and exterior door openings from gross wall area; garage doors are tracked separately.'
  ),
  stuccoGarageOpeningSqft: F(
    'stuccoGarageOpeningSqft',
    'Garage door openings',
    'Enter',
    'sqft',
    'exterior',
    undefined,
    'Deduct garage door openings from gross wall area.'
  ),
  stuccoOtherFinishDeductionSqft: F(
    'stuccoOtherFinishDeductionSqft',
    'Other finish deductions',
    'Enter',
    'sqft',
    'exterior',
    undefined,
    'Stone, brick, siding, panels, or other areas not receiving stucco.'
  ),
  stuccoNetWallSqft: F(
    'stuccoNetWallSqft',
    'Net stucco wall area',
    'Calculated',
    'sqft',
    'exterior',
    true,
    'Calculated: gross wall area minus openings and other finish deductions.'
  ),
  stuccoSoffitSqft: F(
    'stuccoSoffitSqft',
    'Soffits / stucco ceilings',
    'Enter',
    'sqft',
    'exterior'
  ),
  stuccoParapetSqft: F(
    'stuccoParapetSqft',
    'Parapets / raised walls',
    'Enter',
    'sqft',
    'exterior'
  ),
  stuccoFoamTrimLf: F(
    'stuccoFoamTrimLf',
    'Foam trim / architectural bands',
    'Enter',
    'LF',
    'exterior'
  ),
  stuccoControlJointLf: F(
    'stuccoControlJointLf',
    'Control / expansion joints',
    'Enter',
    'LF',
    'exterior'
  ),
  stuccoAccessAffectedSqft: F(
    'stuccoAccessAffectedSqft',
    'Access premium affected area',
    'Enter',
    'sqft',
    'exterior',
    undefined,
    'Only wall area requiring difficult access, scaffolding, or a lift.'
  ),
  stuccoRepairAffectedSqft: F(
    'stuccoRepairAffectedSqft',
    'Substrate repair affected area',
    'Enter',
    'sqft',
    'exterior',
    undefined,
    'Only area requiring repair or additional surface preparation.'
  ),
  stuccoStories: F('stuccoStories', 'Stories', '1', 'story', 'exterior'),
  stuccoWallHeightFt: F(
    'stuccoWallHeightFt',
    'Typical wall height / story',
    'Enter',
    'ft',
    'exterior'
  ),
};

const NOTE_BACKED_QUICK_FIELD_ORDER: QuickMeasurementFieldKey[] = [
  'showerWallTileSqft',
  'showerFloorTileSqft',
  'railingLf',
  'landscapeTons',
  'rockMulchSqft',
  'deckSqft',
  'garageSqft',
  'roofSquares',
  'concreteSqft',
  'concreteCy',
  'excavationCy',
  'sodSqft',
  'paverSqft',
  'floorAreaSqft',
  'bathroomFloorSqft',
  'kitchenFloorSqft',
  'backsplashSqft',
  'countertopSqft',
  'cabinetLf',
  'wallPaintSqft',
  'ceilingPaintSqft',
  'paintAreaSqft',
  'exteriorPaintSqft',
  'drywallSqft',
  'flooringSqft',
  'baseboardLf',
  'landscapeSqft',
];

export const SCOPE_QUICK_MEASUREMENT_ROWS: Record<
  string,
  QuickMeasurementRow[]
> = {
  bathroom: [
    row(
      F('bathroomFloorSqft', 'Bath floor', '90', 'sqft', 'interior'),
      F('showerWallTileSqft', 'Shower walls', '90', 'sqft', 'interior')
    ),
    row(
      F('showerFloorTileSqft', 'Shower floor', '15', 'sqft', 'interior'),
      F('wallPaintSqft', 'Paint', '175', 'sqft', 'interior')
    ),
  ],
  kitchen: [
    row(
      F('kitchenFloorSqft', 'Kitchen floor', '180', 'sqft', 'interior', true),
      F('backsplashSqft', 'Backsplash', '40', 'sqft', 'interior')
    ),
    row(
      F('countertopSqft', 'Counters', '55', 'sqft', 'interior'),
      F('cabinetLf', 'Cabinets / vanity', '24', 'LF', 'interior')
    ),
    row(
      F('wallPaintSqft', 'Paint', '320', 'sqft', 'interior'),
      F('baseboardLf', 'Trim', '48', 'LF', 'interior')
    ),
  ],
  flooring: [
    row(
      F('bathroomFloorSqft', 'Bath floor', 'e.g. 90', 'sqft', 'interior'),
      F('kitchenFloorSqft', 'Kitchen floor', 'e.g. 180', 'sqft', 'interior')
    ),
    row(
      F(
        'floorAreaSqft',
        'Total Flooring Area',
        'e.g. 1000',
        'sqft',
        'structure',
        true
      ),
      F('baseboardLf', 'Baseboard', 'e.g. 200', 'LF', 'interior')
    ),
    row(
      F('flooringSqft', 'Flooring area', 'e.g. 1000', 'sqft', 'interior', true),
      F(
        'floorDemoSqft',
        'Floor demo / removal',
        'e.g. 1000',
        'sqft',
        'interior'
      )
    ),
    row(
      F(
        'floorPrepSqft',
        'Affected floor-prep area',
        'e.g. 250',
        'sqft',
        'interior'
      )
    ),
    row(
      F('flooringLvpSqft', 'LVP', 'e.g. 1000', 'sqft', 'interior'),
      F('flooringLaminateSqft', 'Laminate', 'e.g. 1000', 'sqft', 'interior')
    ),
    row(
      F(
        'flooringEngineeredHardwoodSqft',
        'Engineered hardwood',
        'e.g. 1000',
        'sqft',
        'interior'
      ),
      F(
        'flooringSolidHardwoodSqft',
        'Solid hardwood',
        'e.g. 1000',
        'sqft',
        'interior'
      )
    ),
    row(
      F('flooringTileSqft', 'Tile', 'e.g. 1000', 'sqft', 'interior'),
      F('flooringCarpetSqft', 'Carpet', 'e.g. 1000', 'sqft', 'interior')
    ),
    row(
      F('underlaymentSqft', 'Underlayment', 'e.g. 1000', 'sqft', 'interior'),
      F(
        'moistureBarrierSqft',
        'Vapor / moisture barrier',
        'e.g. 1000',
        'sqft',
        'interior'
      )
    ),
    row(F('quarterRoundLf', 'Quarter round', 'e.g. 48', 'LF', 'interior')),
  ],
  landscaping: [
    row(
      F('sodSqft', 'Sod / turf', '900', 'sqft', 'site', true),
      F('rockMulchSqft', 'Rock / mulch', '600', 'sqft', 'site')
    ),
    row(
      F('paverSqft', 'Pavers', '180', 'sqft', 'site'),
      F('landscapeTons', 'Rock / mulch', '12', 'tons', 'site')
    ),
    row(F('landscapeSqft', 'Coverage', '1200', 'sqft', 'site')),
  ],
  roofing: [
    row(F('roofSquares', 'Roof squares', '28', 'sq', 'structure', true)),
    row(
      F('roofAreaSqft', 'Roof surface area', 'e.g. 2800', 'sqft', 'structure'),
      F('roofPitch', 'Roof pitch / slope', 'e.g. 5:12', 'ratio', 'structure')
    ),
    row(F('storyCount', 'Stories', '1', 'story', 'structure')),
    row(
      F(
        'roofDeckingReplacementSqft',
        'Decking replacement',
        'e.g. 200',
        'sqft',
        'structure'
      ),
      F(
        'roofRepairAffectedSqft',
        'Roof repair affected area',
        'e.g. 100',
        'sqft',
        'structure'
      )
    ),
    row(
      F('roofDripEdgeLf', 'Drip edge', 'e.g. 120', 'LF', 'structure'),
      F('roofRidgeCapLf', 'Ridge cap', 'e.g. 80', 'LF', 'structure')
    ),
    row(
      F('roofRidgeVentLf', 'Ridge vent', 'e.g. 2', 'EA', 'structure'),
      F('roofValleyFlashingLf', 'Valley flashing', 'e.g. 60', 'LF', 'structure')
    ),
    row(
      F('roofStepFlashingLf', 'Step flashing', 'e.g. 40', 'LF', 'structure'),
      F('roofWallFlashingLf', 'Wall flashing', 'e.g. 40', 'LF', 'structure')
    ),
    row(
      F('roofChimneyFlashingCount', 'Chimney flashing', 'e.g. 1', 'EA', 'structure'),
      F('roofPipeBootCount', 'Pipe boots', 'e.g. 4', 'EA', 'structure')
    ),
    row(
      F('roofVentCount', 'Roof vents', 'e.g. 2', 'EA', 'structure'),
      F('roofTurbineVentCount', 'Turbine vents', 'e.g. 2', 'EA', 'structure')
    ),
    row(
      F('roofSkylightCount', 'Skylight flashing', 'e.g. 1', 'EA', 'structure'),
      F('roofPenetrationCount', 'Other penetrations', 'e.g. 2', 'EA', 'structure')
    ),
    row(
      F('roofGutterLf', 'Gutters', 'e.g. 150', 'LF', 'structure'),
      F('roofDownspoutCount', 'Downspouts', 'e.g. 4', 'EA', 'structure')
    ),
  ],
  drywall: [row(F('drywallSqft', 'Drywall', '800', 'sqft', 'interior', true))],
  painting: [
    row(
      F('wallPaintSqft', 'Walls', '1500', 'sqft', 'interior', true),
      F('ceilingPaintSqft', 'Ceilings', '1200', 'sqft', 'interior')
    ),
    row(
      F(
        'paintAreaSqft',
        'Paint area — confirm basis',
        '1500',
        'sqft',
        'interior'
      )
    ),
    row(
      F(
        'baseboardLf',
        'Baseboard / trim',
        '200',
        'LF',
        'interior',
        undefined,
        'Include baseboards, window casing, door casing, crown, and other interior trim. Exclude door slabs and door jambs/frames.'
      ),
      F('interiorDoorCount', 'Interior doors', '6', 'each', 'interior')
    ),
    row(
      F('cabinetUpperLf', 'Upper Cabinets', '15', 'LF', 'interior'),
      F('cabinetLowerLf', 'Lower Cabinets', '15', 'LF', 'interior')
    ),
    row(F('cabinetRunLf', 'Cabinet Run Length', '30', 'LF', 'interior')),
    row(F('exteriorPaintSqft', 'Exterior Paint', '2200', 'sqft', 'exterior')),
  ],
  concrete: [
    row(
      F(
        'concreteSqft',
        EXTERIOR_FLATWORK_LABEL,
        '400',
        'sqft',
        'structure',
        true,
        EXTERIOR_FLATWORK_HELPER
      ),
      F('concreteCy', 'Concrete', '12', 'CY', 'structure')
    ),
  ],
  stucco: [
    row(
      F(
        'stuccoGrossWallSqft',
        'Exterior wall area — gross',
        'Enter',
        'sqft',
        'exterior',
        true
      )
    ),
    row(
      F(
        'stuccoWindowDoorOpeningSqft',
        'Window & door openings',
        'Enter',
        'sqft',
        'exterior'
      ),
      F(
        'stuccoGarageOpeningSqft',
        'Garage door openings',
        'Enter',
        'sqft',
        'exterior'
      )
    ),
    row(
      F(
        'stuccoOtherFinishDeductionSqft',
        'Other finish deductions',
        'Enter',
        'sqft',
        'exterior'
      ),
      F(
        'stuccoNetWallSqft',
        'Net stucco wall area',
        'Calculated',
        'sqft',
        'exterior',
        true
      )
    ),
    row(
      F(
        'stuccoSoffitSqft',
        'Soffits / stucco ceilings',
        'Enter',
        'sqft',
        'exterior'
      ),
      F(
        'stuccoParapetSqft',
        'Parapets / raised walls',
        'Enter',
        'sqft',
        'exterior'
      )
    ),
    row(
      F(
        'stuccoFoamTrimLf',
        'Foam trim / architectural bands',
        'Enter',
        'LF',
        'exterior'
      ),
      F(
        'stuccoControlJointLf',
        'Control / expansion joints',
        'Enter',
        'LF',
        'exterior'
      )
    ),
    row(
      F('stuccoStories', 'Stories', '1', 'story', 'exterior'),
      F(
        'stuccoWallHeightFt',
        'Typical wall height / story',
        'Enter',
        'ft',
        'exterior'
      )
    ),
  ],
  deck_patio: [
    row(
      F('deckSqft', 'Deck / patio', '320', 'sqft', 'exterior', true),
      F(
        'concreteSqft',
        EXTERIOR_FLATWORK_LABEL,
        '180',
        'sqft',
        'structure',
        undefined,
        EXTERIOR_FLATWORK_HELPER
      )
    ),
    row(F('railingLf', 'Railing', '48', 'LF', 'exterior')),
  ],
  excavation: [
    row(
      F('excavationCy', 'Excavation', '45', 'CY', 'site', true),
      F('concreteCy', 'Concrete', '12', 'CY', 'structure')
    ),
  ],
  room_remodel: [
    row(
      F('bathroomFloorSqft', 'Room floor', '150', 'sqft', 'interior', true),
      F('wallPaintSqft', 'Paint', '320', 'sqft', 'interior')
    ),
    row(
      F('drywallSqft', 'Drywall', '200', 'sqft', 'interior'),
      F('baseboardLf', 'Trim', '48', 'LF', 'interior')
    ),
  ],
  /**
   * New build / ground-up — living SF first, then structure/site, then
   * room finishes (bath/shower/kitchen) and envelope quantities needed to
   * price a fuller preliminary build. Confirm Scope shows each empty field's
   * source-aware state (Detected / Estimate available / Needs confirmation)
   * rather than a blanket "Recommended" flag.
   */
  ground_up: [
    row(F('floorAreaSqft', 'Living area', '2400', 'sqft', 'structure', true)),
    row(
      F('garageSqft', 'Garage', '480', 'sqft', 'structure'),
      F('deckSqft', 'Deck / patio', '400', 'sqft', 'exterior')
    ),
    row(
      F(
        'concreteSqft',
        EXTERIOR_FLATWORK_LABEL,
        '400',
        'sqft',
        'structure',
        undefined,
        EXTERIOR_FLATWORK_HELPER
      ),
      F('roofSquares', 'Roof', '28', 'sq', 'structure')
    ),
    row(
      F('excavationCy', 'Excavation', '45', 'CY', 'site'),
      F('concreteCy', 'Foundation and building slabs', '18', 'CY', 'structure')
    ),
    row(
      F('kitchenFloorSqft', 'Kitchen floor', '180', 'sqft', 'interior'),
      F('bathroomFloorSqft', 'Bath floor', '90', 'sqft', 'interior')
    ),
    row(
      F('showerWallTileSqft', 'Shower walls', '90', 'sqft', 'interior'),
      F('showerFloorTileSqft', 'Shower floor', '15', 'sqft', 'interior')
    ),
    row(
      F('cabinetLf', 'Cabinets / vanity', '24', 'LF', 'interior'),
      F('countertopSqft', 'Counters', '55', 'sqft', 'interior')
    ),
    row(
      F('drywallSqft', 'Drywall', '800', 'sqft', 'interior'),
      F('flooringSqft', 'Flooring', '2400', 'sqft', 'interior')
    ),
    row(
      F('wallPaintSqft', 'Interior paint', '3200', 'sqft', 'interior'),
      F('exteriorPaintSqft', 'Exterior paint', '2200', 'sqft', 'exterior')
    ),
  ],
  /** Whole-home remodel / addition — same living-first layout as ground_up. */
  addition: [
    row(F('floorAreaSqft', 'Living area', '1200', 'sqft', 'structure', true)),
    row(
      F('garageSqft', 'Garage', '480', 'sqft', 'structure'),
      F('deckSqft', 'Deck / patio', '320', 'sqft', 'exterior')
    ),
    row(
      F(
        'concreteSqft',
        EXTERIOR_FLATWORK_LABEL,
        '400',
        'sqft',
        'structure',
        undefined,
        EXTERIOR_FLATWORK_HELPER
      ),
      F('roofSquares', 'Roof', '22', 'sq', 'structure')
    ),
    row(
      F('excavationCy', 'Excavation', '45', 'CY', 'site'),
      F('concreteCy', 'Foundation and building slabs', '18', 'CY', 'structure')
    ),
    row(
      F('kitchenFloorSqft', 'Kitchen floor', '180', 'sqft', 'interior'),
      F('bathroomFloorSqft', 'Bath floor', '90', 'sqft', 'interior')
    ),
    row(
      F('showerWallTileSqft', 'Shower walls', '90', 'sqft', 'interior'),
      F('showerFloorTileSqft', 'Shower floor', '15', 'sqft', 'interior')
    ),
    row(
      F('cabinetLf', 'Cabinets / vanity', '24', 'LF', 'interior'),
      F('countertopSqft', 'Counters', '55', 'sqft', 'interior')
    ),
    row(
      F('drywallSqft', 'Drywall', '800', 'sqft', 'interior'),
      F('flooringSqft', 'Flooring', '1200', 'sqft', 'interior')
    ),
    row(
      F('wallPaintSqft', 'Interior paint', '2400', 'sqft', 'interior'),
      F('exteriorPaintSqft', 'Exterior paint', '1800', 'sqft', 'exterior')
    ),
  ],
};

export function resolveQuickMeasurementTemplateKey(
  templateKey?: string | null,
  projectType?: string | null
): string {
  const tk = String(templateKey || '').toLowerCase();
  const pt = String(projectType || '').toLowerCase();
  // Checklist template wins. projectType must not force flooring fields onto a
  // kitchen/bath remodel just because notes also mention floor tile.
  if (tk && SCOPE_QUICK_MEASUREMENT_ROWS[tk]) return tk;
  if (pt === 'new_build' || pt === 'ground_up') return 'ground_up';
  if (
    pt === 'home_addition' ||
    pt === 'whole_home' ||
    pt === 'whole_home_remodel'
  )
    return 'addition';
  if (pt === 'flooring') return 'flooring';
  if (pt === 'kitchen') return 'kitchen';
  if (pt === 'bathroom') return 'bathroom';
  if (pt === 'landscaping') return 'landscaping';
  if (pt === 'roofing') return 'roofing';
  if (pt === 'drywall') return 'drywall';
  if (pt === 'painting') return 'painting';
  if (pt === 'stucco' || pt === 'exterior_finish') return 'stucco';
  if (pt === 'concrete') return 'concrete';
  if (pt === 'deck_patio') return 'deck_patio';
  if (pt === 'excavation') return 'excavation';
  return tk || 'room_remodel';
}

/**
 * Prefer the full ground-up Quick measurements card when plan takeoff looks like
 * a whole-home set — even if the checklist still says room_remodel.
 */
export function resolveEffectiveQuickMeasurementTemplateKey(params: {
  templateKey?: string | null;
  projectType?: string | null;
  planRoomCount?: number;
  livingSf?: number | null;
  garageSf?: number | null;
}): string {
  const resolved = resolveQuickMeasurementTemplateKey(
    params.templateKey,
    params.projectType
  );
  if (resolved === 'ground_up' || resolved === 'addition') return resolved;

  const rooms = Number(params.planRoomCount) || 0;
  const living = Number(params.livingSf);
  const garage = Number(params.garageSf);
  const looksWholeHome =
    rooms >= 4 ||
    (Number.isFinite(living) && living >= 800 && rooms >= 2) ||
    (Number.isFinite(living) &&
      living >= 800 &&
      Number.isFinite(garage) &&
      garage > 0);

  if (looksWholeHome && (resolved === 'room_remodel' || !params.templateKey)) {
    return 'ground_up';
  }
  return resolved;
}

export function isWholeHomeQuickMeasurementTemplate(
  templateKey?: string | null
): boolean {
  const key = String(templateKey || '').toLowerCase();
  return key === 'ground_up' || key === 'addition';
}

export function quickMeasurementRowsForTemplate(
  templateKey?: string | null,
  projectType?: string | null
): QuickMeasurementRow[] {
  const key = resolveQuickMeasurementTemplateKey(templateKey, projectType);
  return applyProjectSpecificQuickMeasurementLabels(
    SCOPE_QUICK_MEASUREMENT_ROWS[key] ||
      SCOPE_QUICK_MEASUREMENT_ROWS.room_remodel,
    key,
    projectType
  );
}

function projectAreaFieldLabel(projectType?: string | null): string | null {
  switch (String(projectType || '').toLowerCase()) {
    case 'adu':
      return 'ADU';
    case 'room_addition':
      return 'Room addition';
    case 'home_addition':
      return 'Addition';
    case 'garage_conversion':
      return 'Garage conversion';
    case 'new_build':
      return 'Living area';
    default:
      return null;
  }
}

function applyProjectSpecificQuickMeasurementLabels(
  rows: QuickMeasurementRow[],
  templateKey: string,
  projectType?: string | null
): QuickMeasurementRow[] {
  if (templateKey !== 'addition' && templateKey !== 'ground_up') return rows;
  const floorAreaLabel = projectAreaFieldLabel(projectType);
  // new_build / ground_up keep "Living area"; ADU/addition variants override.
  if (!floorAreaLabel) return rows;

  return rows.map(measurementRow =>
    measurementRow.map(field =>
      field.key === 'floorAreaSqft'
        ? {
            ...field,
            label: floorAreaLabel,
            placeholder: projectType === 'adu' ? '650' : field.placeholder,
            primary: true,
          }
        : field
    )
  );
}

export function hasQuickMeasurementValue(value: unknown): boolean {
  const n = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) && n > 0;
}

/** Live form value for a quick measurement field (note prefill until the user types). */
export function resolveQuickMeasurementDisplayValue(
  key: QuickMeasurementFieldKey,
  measurements: Partial<Record<QuickMeasurementFieldKey, string | undefined>>,
  noteValues: Partial<Record<QuickMeasurementFieldKey, string>> = {}
): string {
  const raw = measurements[key];
  if (raw != null && String(raw).trim() !== '') {
    return String(raw);
  }
  return noteValues[key] || String(raw ?? '');
}

function chunkRows(fields: QuickMeasurementFieldDef[]): QuickMeasurementRow[] {
  const rows: QuickMeasurementRow[] = [];
  for (let i = 0; i < fields.length; i += 2) {
    rows.push(fields.slice(i, i + 2));
  }
  return rows;
}

export function quickMeasurementRowsForInput(
  templateKey: string | null | undefined,
  projectType: string | null | undefined,
  measurements: Partial<
    Record<QuickMeasurementFieldKey, string | number | null | undefined>
  >,
  noteBackedKeys?: Iterable<QuickMeasurementFieldKey>
): QuickMeasurementRow[] {
  const resolvedKey = resolveQuickMeasurementTemplateKey(
    templateKey,
    projectType
  );
  const noteKeySet = noteBackedKeys ? new Set(noteBackedKeys) : null;
  const baseRows = quickMeasurementRowsForTemplate(templateKey, projectType);
  const baseKeys = new Set(baseRows.flatMap(r => r.map(f => f.key)));
  const extraFields = NOTE_BACKED_QUICK_FIELD_ORDER.filter(
    key =>
      !baseKeys.has(key) &&
      (!noteKeySet || noteKeySet.has(key)) &&
      hasQuickMeasurementValue(measurements[key])
  )
    .map(key => QUICK_MEASUREMENT_FIELD_DEFS[key])
    .filter((field): field is QuickMeasurementFieldDef => Boolean(field));

  // Keep row order stable while typing — dynamic note-only rows caused TextInput focus to jump.
  if (resolvedKey === 'room_remodel') {
    return baseRows;
  }

  if (!extraFields.length) return baseRows;

  return [...baseRows, ...chunkRows(extraFields)];
}

/** Group flat rows into Site / Structure / Interior sections; primary fields lead. */
export function quickMeasurementSectionsForRows(
  rows: QuickMeasurementRow[]
): QuickMeasurementSection[] {
  const fields = rows.flat();
  if (!fields.length) return [];

  const byGroup = new Map<
    QuickMeasurementGroupId,
    QuickMeasurementFieldDef[]
  >();
  for (const field of fields) {
    const list = byGroup.get(field.group) || [];
    list.push(field);
    byGroup.set(field.group, list);
  }

  const primaryGroup = fields.find(f => f.primary)?.group;
  const orderedGroups = primaryGroup
    ? [primaryGroup, ...GROUP_ORDER.filter(id => id !== primaryGroup)]
    : GROUP_ORDER;

  const sections: QuickMeasurementSection[] = [];
  for (const groupId of orderedGroups) {
    const groupFields = byGroup.get(groupId);
    if (!groupFields?.length) continue;
    const primary = groupFields.filter(f => f.primary);
    const rest = groupFields.filter(f => !f.primary);
    const sectionRows: QuickMeasurementRow[] = [];
    for (const field of primary) {
      sectionRows.push([field]);
    }
    sectionRows.push(...chunkRows(rest));
    sections.push({
      id: groupId,
      title: GROUP_TITLES[groupId],
      rows: sectionRows,
    });
  }
  return sections;
}

export function countFilledQuickMeasurements(
  rows: QuickMeasurementRow[],
  measurements: Partial<Record<QuickMeasurementFieldKey, string | undefined>>,
  noteValues: Partial<Record<QuickMeasurementFieldKey, string>> = {}
): { filled: number; total: number } {
  const fields = rows.flat();
  let filled = 0;
  for (const field of fields) {
    const value = resolveQuickMeasurementDisplayValue(
      field.key,
      measurements,
      noteValues
    );
    if (hasQuickMeasurementValue(value)) filled += 1;
  }
  return { filled, total: fields.length };
}

/** Contractor-friendly label + unit for a quick-measurement key (plan takeoff review, alerts). */
export function quickMeasurementFieldMeta(key: string): {
  label: string;
  unit: string;
} {
  const def = QUICK_MEASUREMENT_FIELD_DEFS[key as QuickMeasurementFieldKey];
  if (def) return { label: def.label, unit: def.unit };
  return { label: key, unit: '' };
}

/**
 * Example numeric placeholders look like calculated values in Confirm Scope.
 * With measurement-semantics on, show Enter / Not measured instead.
 */
export function quickMeasurementPlaceholder(
  field: QuickMeasurementFieldDef
): string {
  if (!measurementSemanticsV1Enabled()) return field.placeholder;
  if (
    field.key === 'floorAreaSqft' ||
    field.key === 'garageSqft' ||
    field.key === 'deckSqft'
  ) {
    return 'Enter';
  }
  if (field.key === 'flooringSqft') return 'Not measured';
  return 'Enter';
}

export function quickMeasurementDisplayLabel(
  field: QuickMeasurementFieldDef
): string {
  if (!measurementSemanticsV1Enabled()) return field.label;
  if (field.key === 'flooringSqft') return 'Total Flooring Area';
  if (field.key === 'floorAreaSqft' && field.label === 'Floor area')
    return 'Living area';
  return field.label;
}

/** Short clarifying line under a field label (Living vs Gross interior, flatwork exclusions, etc.). */
export function quickMeasurementHelperText(
  field: QuickMeasurementFieldDef
): string | undefined {
  if (field.helperText) return field.helperText;
  if (field.key === 'flooringSqft') {
    return 'Total SF being replaced or receiving new flooring. Use this as the overall flooring-area reference.';
  }
  if (field.key === 'floorAreaSqft') {
    return 'Heated living area from the plan.';
  }
  if (field.key === 'cabinetLf') {
    return 'Total for kitchen, bathrooms, laundry, and other cabinetry/vanities.';
  }
  if (field.key === 'countertopSqft') {
    return 'Total for kitchen, bathrooms, and other countertops.';
  }
  return undefined;
}

export function emptyQuickMeasurementInput(): Record<
  QuickMeasurementFieldKey,
  string
> {
  return {
    bathroomFloorSqft: '',
    kitchenFloorSqft: '',
    floorAreaSqft: '',
    backsplashSqft: '',
    countertopSqft: '',
    cabinetLf: '',
    showerWallTileSqft: '',
    showerFloorTileSqft: '',
    wallPaintSqft: '',
    ceilingPaintSqft: '',
    paintAreaSqft: '',
    exteriorPaintSqft: '',
    baseboardLf: '',
    interiorDoorCount: '',
    cabinetPaintSqft: '',
    cabinetUpperLf: '',
    cabinetLowerLf: '',
    cabinetTallLf: '',
    cabinetRunLf: '',
    railingLf: '',
    landscapeSqft: '',
    artificialTurfSqft: '',
    demoClearingSqft: '',
    gradingSqft: '',
    soilPrepSqft: '',
    sodSqft: '',
    paverSqft: '',
    rockMulchSqft: '',
    landscapeTons: '',
    roofSquares: '',
    roofAreaSqft: '',
    roofIceWaterShieldSqft: '',
    roofPitch: '',
    storyCount: '',
    drywallSqft: '',
    flooringSqft: '',
    flooringLvpSqft: '',
    flooringLaminateSqft: '',
    flooringEngineeredHardwoodSqft: '',
    flooringSolidHardwoodSqft: '',
    flooringTileSqft: '',
    flooringCarpetSqft: '',
    floorDemoSqft: '',
    floorPrepSqft: '',
    floorPrepByProduct: null,
    flooringExistingLvpInstallMethod: null,
    flooringExistingSheetVinylType: null,
    floorPrepLevel: null,
    floorPrepTransitions: null,
    flooringDemoIncludesSubstratePrep: null,
    underlaymentSqft: '',
    moistureBarrierSqft: '',
    transitionLf: '',
    transitionCount: '',
    quarterRoundLf: '',
    concreteSqft: '',
    concreteDemoSqft: '',
    concreteCy: '',
    excavationCy: '',
    deckSqft: '',
    garageSqft: '',
    stuccoGrossWallSqft: '',
    stuccoWindowDoorOpeningSqft: '',
    stuccoGarageOpeningSqft: '',
    stuccoOtherFinishDeductionSqft: '',
    stuccoNetWallSqft: '',
    stuccoSoffitSqft: '',
    stuccoParapetSqft: '',
    stuccoFoamTrimLf: '',
    stuccoControlJointLf: '',
    stuccoAccessAffectedSqft: '',
    stuccoRepairAffectedSqft: '',
    stuccoStories: '',
    stuccoWallHeightFt: '',
  };
}
