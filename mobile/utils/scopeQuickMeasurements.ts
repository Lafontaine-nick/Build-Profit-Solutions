/**
 * Quick measurement fields shown per scope checklist template.
 * All fields render for the job type; values prefill from notes when parsed.
 */
import { measurementSemanticsV1Enabled } from '@/utils/measurementSemantics';
import { isGarageConversionJob } from '@/utils/additionConversionPlanning';
import type { PlumbingWorkflowMode } from '@/utils/subcontractorTrade/plumbingPlanConvergence';

export type QuickMeasurementFieldKey =
  | 'bathroomFloorSqft'
  | 'kitchenFloorSqft'
  | 'floorAreaSqft'
  | 'backsplashSqft'
  | 'countertopSqft'
  | 'countertopLf'
  | 'cabinetLf'
  | 'showerWallTileSqft'
  | 'showerFloorTileSqft'
  | 'wallPaintSqft'
  | 'ceilingPaintSqft'
  | 'paintAreaSqft'
  | 'patchRepairSqft'
  | 'exteriorPaintSqft'
  | 'baseboardLf'
  | 'interiorDoorCount'
  | 'windowCount'
  | 'exteriorDoorCount'
  | 'slidingDoorCount'
  | 'garageDoorSingleCount'
  | 'garageDoorDoubleCount'
  | 'garageDoorRvCount'
  | 'garageDoorOpenerCount'
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
  | 'hvacSystemCount'
  | 'hvacSystemTons'
  | 'hvacServiceCallCount'
  | 'hvacEquipmentReplacementCount'
  | 'hvacRefrigerantCount'
  | 'hvacThermostatCount'
  | 'hvacDuctworkLf'
  | 'hvacSupplyRegisterCount'
  | 'hvacReturnGrilleCount'
  | 'hvacVentilationCount'
  | 'hvacPermitCount'
  | 'hvacCleanupCount'
  | 'drywallSqft'
  | 'drywallWallSqft'
  | 'drywallCeilingSqft'
  | 'drywallOpeningDeductionSqft'
  | 'garageWallDrywallSqft'
  | 'garageCeilingDrywallSqft'
  | 'moistureResistantDrywallSqft'
  | 'fireRatedDrywallSqft'
  | 'specialtyDrywallSqft'
  | 'highCeilingDrywallSqft'
  | 'vaultedCeilingDrywallSqft'
  | 'level5FinishSqft'
  | 'drywallGarageFireRatedSqft'
  | 'drywallMoistureResistantSqft'
  | 'drywallVaultedSlopedSqft'
  | 'drywallHighCeilingSqft'
  | 'exteriorWallGrossSqft'
  | 'exteriorWallInsulationSqft'
  | 'atticInsulationSqft'
  | 'insulatedRoofDeckSqft'
  | 'floorInsulationSqft'
  | 'garageSeparationInsulationSqft'
  | 'insulatedGarageWallSqft'
  | 'insulatedGarageCeilingSqft'
  | 'openingDeductionSqft'
  | 'insulationMaterialType'
  | 'insulationRValue'
  | 'garageInsulationIncluded'
  | 'serviceCallCount'
  | 'fixtureRepairCount'
  | 'fixtureReplacementCount'
  | 'drainCleaningCount'
  | 'waterLineLf'
  | 'sewerLineLf'
  | 'gasLineLf'
  | 'plumbingRoughPointCount'
  | 'plumbingTrimHookupCount'
  | 'plumbingFixturesHardwareCount'
  | 'waterHeaterCount'
  | 'gasApplianceConnectionCount'
  | 'partsMaterialsCount'
  | 'emergencyFeeCount'
  | 'plumbingCleanupCount'
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
  | 'concreteStructuralReinforcementSqft'
  | 'concreteFlatworkReinforcementSqft'
  | 'concreteSubgradePrepSqft'
  | 'concreteStructuralSubgradePrepSqft'
  | 'concreteFlatworkSubgradePrepSqft'
  | 'concreteStructuralGravelBaseCy'
  | 'concreteFlatworkGravelBaseCy'
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
  | 'stuccoWallHeightFt'
  | 'framedAreaSqft'
  | 'wallFramingLf'
  | 'sheathingSqft'
  | 'framingOpeningCount'
  | 'framingCleanupCount';

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

const QUICK_MEASUREMENT_FIELD_DEFS: Partial<
  Record<QuickMeasurementFieldKey, QuickMeasurementFieldDef>
> = {
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
  countertopLf: F('countertopLf', 'Countertops', 'Enter', 'LF', 'interior'),
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
  patchRepairSqft: F(
    'patchRepairSqft',
    'Drywall patch & texture',
    'e.g. 25',
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
  windowCount: F(
    'windowCount',
    'Windows',
    'e.g. 12',
    'each',
    'exterior',
    undefined,
    'Count window units from the window schedule or readable exterior elevations.'
  ),
  exteriorDoorCount: F(
    'exteriorDoorCount',
    'Exterior swing doors',
    'e.g. 3',
    'each',
    'exterior',
    undefined,
    'Count hinged/French exterior openings as units, not leaves. Exclude explicit sliders and garage doors.'
  ),
  slidingDoorCount: F(
    'slidingDoorCount',
    'Sliding / patio doors',
    'e.g. 2',
    'each',
    'exterior',
    undefined,
    'Count only explicit sliding, multi-slide, or bypass units — not hinged French/patio doors.'
  ),
  garageDoorSingleCount: F(
    'garageDoorSingleCount',
    'Single garage doors',
    'e.g. 1',
    'each',
    'exterior',
    undefined,
    'Use the garage door schedule or elevation; do not infer type from garage area.'
  ),
  garageDoorDoubleCount: F(
    'garageDoorDoubleCount',
    'Double garage doors',
    'e.g. 1',
    'each',
    'exterior',
    undefined,
    'Use the garage door schedule or elevation; do not infer type from garage area.'
  ),
  garageDoorRvCount: F(
    'garageDoorRvCount',
    'RV / oversized garage doors',
    'e.g. 1',
    'each',
    'exterior',
    undefined,
    'Count only when the larger/taller opening is documented.'
  ),
  garageDoorOpenerCount: F(
    'garageDoorOpenerCount',
    'Garage door openers',
    'e.g. 2',
    'each',
    'exterior',
    undefined,
    'Count only when openers are labeled or specified.'
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
  roofPitch: F(
    'roofPitch',
    'Roof pitch / slope',
    'e.g. 5:12',
    'ratio',
    'structure'
  ),
  storyCount: F('storyCount', 'Stories', '1', 'story', 'structure'),
  roofDeckingReplacementSqft: F(
    'roofDeckingReplacementSqft',
    'Decking replacement',
    'e.g. 200',
    'sqft',
    'structure'
  ),
  roofDripEdgeLf: F(
    'roofDripEdgeLf',
    'Drip edge',
    'e.g. 120',
    'LF',
    'structure'
  ),
  roofRidgeCapLf: F(
    'roofRidgeCapLf',
    'Ridge cap',
    'e.g. 80',
    'LF',
    'structure'
  ),
  roofRidgeVentLf: F(
    'roofRidgeVentLf',
    'Ridge vent',
    'e.g. 2',
    'EA',
    'structure'
  ),
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
  roofPipeBootCount: F(
    'roofPipeBootCount',
    'Pipe boots',
    'e.g. 4',
    'EA',
    'structure'
  ),
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
  exteriorWallInsulationSqft: F(
    'exteriorWallInsulationSqft',
    'Exterior wall insulation',
    'e.g. 4500',
    'sqft',
    'structure'
  ),
  atticInsulationSqft: F(
    'atticInsulationSqft',
    'Attic / ceiling insulation',
    'e.g. 2000',
    'sqft',
    'structure'
  ),
  insulatedRoofDeckSqft: F(
    'insulatedRoofDeckSqft',
    'Insulated roof deck',
    'e.g. 2000',
    'sqft',
    'structure'
  ),
  floorInsulationSqft: F(
    'floorInsulationSqft',
    'Floor insulation',
    'e.g. 800',
    'sqft',
    'structure'
  ),
  garageSeparationInsulationSqft: F(
    'garageSeparationInsulationSqft',
    'Garage separation insulation',
    'e.g. 400',
    'sqft',
    'structure'
  ),
  insulatedGarageWallSqft: F(
    'insulatedGarageWallSqft',
    'Insulated garage walls',
    'e.g. 800',
    'sqft',
    'structure'
  ),
  insulatedGarageCeilingSqft: F(
    'insulatedGarageCeilingSqft',
    'Insulated garage ceiling',
    'e.g. 800',
    'sqft',
    'structure'
  ),
  openingDeductionSqft: F(
    'openingDeductionSqft',
    'Exterior opening deduction',
    'e.g. 600',
    'sqft',
    'structure'
  ),
  insulationMaterialType: F(
    'insulationMaterialType',
    'Insulation type',
    'e.g. batt, blown, spray foam',
    'type',
    'structure'
  ),
  insulationRValue: F(
    'insulationRValue',
    'Target R-value',
    'e.g. R-21 wall, R-49 attic',
    'R-value',
    'structure'
  ),
  garageInsulationIncluded: F(
    'garageInsulationIncluded',
    'Garage insulation included',
    'yes / no / separation only',
    'choice',
    'structure'
  ),
  serviceCallCount: F(
    'serviceCallCount',
    'Service calls',
    '1',
    'each',
    'other',
    undefined,
    'Explicit plumbing service visits only.'
  ),
  fixtureRepairCount: F(
    'fixtureRepairCount',
    'Fixture repairs',
    '1',
    'each',
    'interior',
    undefined,
    'Existing fixture repairs; replacement is separate.'
  ),
  fixtureReplacementCount: F(
    'fixtureReplacementCount',
    'Fixture replacements',
    '1',
    'each',
    'interior',
    undefined,
    'Set, install, or replace fixtures at documented rough; trim connections are separate.'
  ),
  drainCleaningCount: F(
    'drainCleaningCount',
    'Drain cleanings',
    '1',
    'each',
    'other',
    undefined,
    'Drain clearing only; line replacement is separate.'
  ),
  waterLineLf: F(
    'waterLineLf',
    'Water line',
    '40',
    'LF',
    'structure',
    undefined,
    'Use documented water-supply line length only.'
  ),
  sewerLineLf: F(
    'sewerLineLf',
    'Sewer / drain piping',
    '40',
    'LF',
    'structure',
    undefined,
    'Use documented sewer or drain-line length only.'
  ),
  gasLineLf: F(
    'gasLineLf',
    'Gas piping',
    'e.g. 100',
    'LF',
    'structure',
    undefined,
    'Use only gas piping or gas stubs explicitly shown or noted on the plan.'
  ),
  plumbingRoughPointCount: F(
    'plumbingRoughPointCount',
    'Plumbing rough-in points',
    '4',
    'fixtures',
    'structure',
    true,
    'Supply, drain, vent, or fixture rough-in points; not living SF.'
  ),
  plumbingTrimHookupCount: F(
    'plumbingTrimHookupCount',
    'Plumbing trim / hookups',
    '4',
    'fixtures',
    'interior',
    undefined,
    'Fixture trim and final connections only.'
  ),
  plumbingFixturesHardwareCount: F(
    'plumbingFixturesHardwareCount',
    'Plumbing fixture allowance',
    '10',
    'fixtures',
    'interior',
    undefined,
    'Fixture product allowance — not rough-in or trim labor.'
  ),
  waterHeaterCount: F(
    'waterHeaterCount',
    'Water heater',
    '1',
    'each',
    'interior',
    undefined,
    'Water heater supply and set when documented.'
  ),
  gasApplianceConnectionCount: F(
    'gasApplianceConnectionCount',
    'Gas appliance connections',
    '3',
    'each',
    'interior',
    undefined,
    'Final gas hookups at documented stubs.'
  ),
  partsMaterialsCount: F(
    'partsMaterialsCount',
    'Parts / materials allowances',
    '1',
    'allowance',
    'other',
    undefined,
    'Explicit unassigned plumbing allowance.'
  ),
  emergencyFeeCount: F(
    'emergencyFeeCount',
    'Emergency fees',
    '1',
    'allowance',
    'other',
    undefined,
    'Explicit after-hours or emergency fee only.'
  ),
  plumbingCleanupCount: F(
    'plumbingCleanupCount',
    'Plumbing cleanup',
    '1',
    'allowance',
    'other',
    undefined,
    'Explicit plumbing cleanup/disposal only.'
  ),
  hvacSystemCount: F(
    'hvacSystemCount',
    'HVAC systems',
    'e.g. 1',
    'each',
    'structure',
    true,
    'Count documented HVAC systems; do not use living SF.'
  ),
  hvacSystemTons: F(
    'hvacSystemTons',
    'HVAC capacity',
    'e.g. 4',
    'tons',
    'structure',
    undefined,
    'Enter labeled system tonnage only.'
  ),
  hvacServiceCallCount: F(
    'hvacServiceCallCount',
    'HVAC service calls',
    'e.g. 1',
    'each',
    'other',
    undefined,
    'Explicit service or diagnostic visits only.'
  ),
  hvacEquipmentReplacementCount: F(
    'hvacEquipmentReplacementCount',
    'Equipment replacements',
    'e.g. 1',
    'each',
    'interior',
    undefined,
    'Documented furnace, air-handler, condenser, or heat-pump replacements.'
  ),
  hvacRefrigerantCount: F(
    'hvacRefrigerantCount',
    'Refrigerant service',
    'e.g. 1',
    'each',
    'interior',
    undefined,
    'Explicit refrigerant recovery, recharge, or line-set service.'
  ),
  hvacThermostatCount: F(
    'hvacThermostatCount',
    'Thermostats',
    'e.g. 1',
    'each',
    'interior'
  ),
  hvacDuctworkLf: F(
    'hvacDuctworkLf',
    'Ductwork',
    'e.g. 120',
    'LF',
    'structure',
    undefined,
    'Enter labeled or dimensioned ductwork LF only.'
  ),
  hvacSupplyRegisterCount: F(
    'hvacSupplyRegisterCount',
    'Supply registers',
    'e.g. 12',
    'each',
    'structure',
    undefined,
    'Count documented supply registers or diffusers.'
  ),
  hvacReturnGrilleCount: F(
    'hvacReturnGrilleCount',
    'Return grilles',
    'e.g. 4',
    'each',
    'structure',
    undefined,
    'Count documented return air grilles.'
  ),
  hvacVentilationCount: F(
    'hvacVentilationCount',
    'Whole-house ventilation',
    'e.g. 1',
    'each',
    'structure',
    undefined,
    'Count whole-house ventilation systems — 1 ERV or HRV = 1 each. Not bath exhaust fans.'
  ),
  hvacPermitCount: F(
    'hvacPermitCount',
    'HVAC permits / inspections',
    'e.g. 1',
    'each',
    'other'
  ),
  hvacCleanupCount: F(
    'hvacCleanupCount',
    'HVAC cleanup',
    'e.g. 1',
    'each',
    'other'
  ),
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
  framedAreaSqft: F(
    'framedAreaSqft',
    'Framed floor area',
    'e.g. 2400',
    'sqft',
    'structure',
    undefined,
    'Covered framed SF — living plus garage when both are documented.'
  ),
  wallFramingLf: F(
    'wallFramingLf',
    'Wall framing',
    'e.g. 24',
    'LF',
    'structure',
    undefined,
    'New or reworked stud walls priced by linear feet.'
  ),
  sheathingSqft: F(
    'sheathingSqft',
    'Sheathing / shear',
    'e.g. 3200',
    'sqft',
    'structure',
    undefined,
    'Structural wall or roof sheathing when documented.'
  ),
  framingOpeningCount: F(
    'framingOpeningCount',
    'Door / window openings',
    'e.g. 12',
    'each',
    'structure'
  ),
  framingCleanupCount: F(
    'framingCleanupCount',
    'Framing cleanup',
    '1',
    'allowance',
    'other'
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
  'countertopLf',
  'cabinetLf',
  'wallPaintSqft',
  'ceilingPaintSqft',
  'paintAreaSqft',
  'patchRepairSqft',
  'interiorDoorCount',
  'cabinetPaintSqft',
  'cabinetRunLf',
  'exteriorPaintSqft',
  'drywallSqft',
  'flooringSqft',
  'baseboardLf',
  'landscapeSqft',
];

/** Plan Export Framing rows for ground-up/addition takeoffs. */
export const FRAMING_PLAN_QUICK_MEASUREMENT_ROWS: QuickMeasurementRow[] = [
  row(
    F(
      'framedAreaSqft',
      'Framed floor area',
      'e.g. 2400',
      'sqft',
      'structure',
      undefined,
      'Covered framed SF — living plus garage when both are documented.'
    ),
    F('garageSqft', 'Garage area', 'e.g. 400', 'sqft', 'structure')
  ),
  row(
    F(
      'sheathingSqft',
      'Sheathing / shear',
      'e.g. 3200',
      'sqft',
      'structure',
      undefined,
      'Structural wall or roof sheathing when documented.'
    ),
    F(
      'wallFramingLf',
      'Wall framing',
      'e.g. 24',
      'LF',
      'structure',
      undefined,
      'Partial-wall or remodel framing only when documented.'
    )
  ),
  row(
    F(
      'framingOpeningCount',
      'Door / window openings',
      'e.g. 12',
      'each',
      'structure'
    ),
    F('floorAreaSqft', 'Living area', 'e.g. 2000', 'sqft', 'interior')
  ),
];

export const HVAC_PLAN_QUICK_MEASUREMENT_ROWS: QuickMeasurementRow[] = [
  row(
    F(
      'hvacSystemCount',
      'HVAC systems',
      'e.g. 1',
      'each',
      'structure',
      true,
      'Count documented systems; do not infer from living area.'
    ),
    F(
      'hvacSystemTons',
      'System capacity',
      'e.g. 4',
      'tons',
      'structure',
      undefined,
      'Use labeled tonnage only.'
    )
  ),
  row(
    F(
      'hvacDuctworkLf',
      'Ductwork',
      'e.g. 120',
      'LF',
      'structure',
      undefined,
      'Use labeled or dimensioned ductwork LF only.'
    ),
    F(
      'hvacSupplyRegisterCount',
      'Supply registers',
      'e.g. 12',
      'each',
      'structure',
      undefined,
      'Count documented supply registers or diffusers.'
    )
  ),
  row(
    F(
      'hvacReturnGrilleCount',
      'Return grilles',
      'e.g. 4',
      'each',
      'structure',
      undefined,
      'Count documented return air grilles.'
    ),
    F('hvacThermostatCount', 'Thermostats', 'e.g. 1', 'each', 'interior')
  ),
  row(
    F(
      'hvacVentilationCount',
      'Whole-house ventilation',
      'e.g. 1',
      'each',
      'structure'
    ),
    F(
      'hvacEquipmentReplacementCount',
      'Equipment replacements',
      'e.g. 1',
      'each',
      'interior'
    )
  ),
  row(
    F('hvacServiceCallCount', 'HVAC service calls', 'e.g. 1', 'each', 'other'),
    F(
      'hvacRefrigerantCount',
      'Refrigerant service',
      'e.g. 1',
      'each',
      'interior'
    )
  ),
  row(
    F(
      'hvacPermitCount',
      'HVAC permits / inspections',
      'e.g. 1',
      'each',
      'other'
    ),
    F('hvacCleanupCount', 'HVAC cleanup', 'e.g. 1', 'each', 'other')
  ),
];

export const SCOPE_QUICK_MEASUREMENT_ROWS: Record<
  string,
  QuickMeasurementRow[]
> = {
  framing: FRAMING_PLAN_QUICK_MEASUREMENT_ROWS,
  plumbing: [
    row(
      F(
        'plumbingRoughPointCount',
        'Plumbing rough-in points',
        'e.g. 4',
        'each',
        'structure',
        true,
        'Supply, drain, vent, or fixture rough-in points; not living SF.'
      ),
      F(
        'plumbingTrimHookupCount',
        'Trim / hookups',
        'e.g. 4',
        'each',
        'interior'
      )
    ),
    row(
      F(
        'fixtureReplacementCount',
        'Fixture replacements',
        'e.g. 2',
        'each',
        'interior'
      ),
      F('fixtureRepairCount', 'Fixture repairs', 'e.g. 1', 'each', 'interior')
    ),
    row(
      F('waterLineLf', 'Water line piping', 'e.g. 40', 'LF', 'structure'),
      F('sewerLineLf', 'Sewer / drain piping', 'e.g. 20', 'LF', 'structure')
    ),
    row(
      F(
        'plumbingFixturesHardwareCount',
        'Fixture allowance',
        'e.g. 10',
        'each',
        'interior'
      ),
      F('waterHeaterCount', 'Water heater', 'e.g. 1', 'each', 'interior')
    ),
    row(
      F('gasLineLf', 'Gas piping', 'e.g. 100', 'LF', 'structure'),
      F(
        'gasApplianceConnectionCount',
        'Gas appliance hookups',
        'e.g. 3',
        'each',
        'interior'
      )
    ),
  ],
  framing: FRAMING_PLAN_QUICK_MEASUREMENT_ROWS,
  hvac: HVAC_PLAN_QUICK_MEASUREMENT_ROWS,
  bathroom: [
    row(
      F('bathroomFloorSqft', 'Bath floor', '90', 'sqft', 'interior'),
      F('showerWallTileSqft', 'Shower walls', '90', 'sqft', 'interior')
    ),
    row(
      F('showerFloorTileSqft', 'Shower floor', '15', 'sqft', 'interior'),
      F('wallPaintSqft', 'Paint', '175', 'sqft', 'interior'),
      F(
        'patchRepairSqft',
        'Drywall patch & texture',
        'e.g. 25',
        'sqft',
        'interior'
      )
    ),
    row(F('baseboardLf', 'Baseboard', 'e.g. 200', 'LF', 'interior')),
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
      F('baseboardLf', 'Trim', '48', 'LF', 'interior'),
      F('drywallSqft', 'Drywall repair', 'Enter sqft', 'sqft', 'interior')
    ),
    row(
      F(
        'exteriorWallInsulationSqft',
        'Exterior wall insulation',
        'Enter sqft',
        'sqft',
        'structure'
      )
    ),
    row(
      F('windowCount', 'Windows', 'Enter count', 'each', 'exterior'),
      F(
        'exteriorDoorCount',
        'Exterior doors',
        'Enter count',
        'each',
        'exterior'
      )
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
      F(
        'roofChimneyFlashingCount',
        'Chimney flashing',
        'e.g. 1',
        'EA',
        'structure'
      ),
      F('roofPipeBootCount', 'Pipe boots', 'e.g. 4', 'EA', 'structure')
    ),
    row(
      F('roofVentCount', 'Roof vents', 'e.g. 2', 'EA', 'structure'),
      F('roofTurbineVentCount', 'Turbine vents', 'e.g. 2', 'EA', 'structure')
    ),
    row(
      F('roofSkylightCount', 'Skylight flashing', 'e.g. 1', 'EA', 'structure'),
      F(
        'roofPenetrationCount',
        'Other penetrations',
        'e.g. 2',
        'EA',
        'structure'
      )
    ),
    row(
      F('roofGutterLf', 'Gutters', 'e.g. 150', 'LF', 'structure'),
      F('roofDownspoutCount', 'Downspouts', 'e.g. 4', 'EA', 'structure')
    ),
  ],
  drywall: [
    row(
      F(
        'drywallWallSqft',
        'Wall drywall',
        'e.g. 8200',
        'sqft',
        'interior',
        true
      ),
      F(
        'drywallCeilingSqft',
        'Ceiling drywall',
        'e.g. 3660',
        'sqft',
        'interior',
        true
      )
    ),
    row(
      F(
        'garageWallDrywallSqft',
        'Garage walls',
        'e.g. 900',
        'sqft',
        'interior',
        undefined,
        'Garage wall surface SF from plan geometry.'
      ),
      F(
        'garageCeilingDrywallSqft',
        'Garage ceiling',
        'e.g. 780',
        'sqft',
        'interior',
        undefined,
        'Garage ceiling surface SF from plan geometry.'
      )
    ),
    row(
      F(
        'moistureResistantDrywallSqft',
        'Moisture-resistant board',
        'e.g. 300',
        'sqft',
        'interior'
      ),
      F(
        'fireRatedDrywallSqft',
        'Fire-rated board',
        'e.g. 900',
        'sqft',
        'interior',
        undefined,
        'Garage or separation assemblies — typically 5/8" Type X.'
      )
    ),
    row(
      F(
        'highCeilingDrywallSqft',
        'High-ceiling drywall',
        'e.g. 800',
        'sqft',
        'interior'
      ),
      F(
        'vaultedCeilingDrywallSqft',
        'Vaulted / sloped drywall',
        'e.g. 500',
        'sqft',
        'interior'
      )
    ),
    row(
      F(
        'specialtyDrywallSqft',
        'Specialty board',
        'e.g. 200',
        'sqft',
        'interior'
      ),
      F(
        'level5FinishSqft',
        'Level 5 finish area',
        'e.g. 400',
        'sqft',
        'interior'
      )
    ),
  ],
  insulation: [
    row(
      F(
        'exteriorWallInsulationSqft',
        'Exterior wall insulation',
        'e.g. 4500',
        'sqft',
        'structure',
        true
      ),
      F(
        'atticInsulationSqft',
        'Attic / ceiling insulation',
        'e.g. 2000',
        'sqft',
        'structure'
      )
    ),
    row(
      F(
        'insulatedRoofDeckSqft',
        'Insulated roof deck',
        'e.g. 2000',
        'sqft',
        'structure'
      ),
      F(
        'openingDeductionSqft',
        'Exterior opening deduction',
        'e.g. 600',
        'sqft',
        'structure'
      )
    ),
    row(
      F(
        'garageSeparationInsulationSqft',
        'Garage separation insulation',
        'e.g. 400',
        'sqft',
        'structure'
      ),
      F(
        'floorInsulationSqft',
        'Floor insulation',
        'e.g. 800',
        'sqft',
        'structure'
      )
    ),
    row(
      F(
        'insulationMaterialType',
        'Insulation type',
        'e.g. batt, blown, spray foam',
        'type',
        'structure',
        true
      ),
      F(
        'insulationRValue',
        'Target R-value',
        'e.g. R-21 wall, R-49 attic',
        'R-value',
        'structure'
      )
    ),
    row(
      F(
        'garageInsulationIncluded',
        'Garage insulation included',
        'yes / no / separation only',
        'choice',
        'structure'
      )
    ),
  ],
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
    row(
      F(
        'cabinetPaintSqft',
        'Paintable Cabinet Surface Area',
        '200',
        'sqft',
        'interior',
        undefined,
        'Enter total paintable surface area for selected doors, drawer fronts, face frames, and exposed cabinet panels. Do not use kitchen floor area.'
      )
    ),
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
      F('floorAreaSqft', 'Living area', '1400', 'sqft', 'structure', true),
      F('flooringSqft', 'Total flooring area', 'Enter', 'sqft', 'interior')
    ),
    row(
      F('cabinetLf', 'Cabinets', '42', 'LF', 'interior'),
      F('countertopSqft', 'Counters', 'Enter', 'sqft', 'interior')
    ),
    row(
      F('drywallSqft', 'Drywall repair', '300', 'sqft', 'interior'),
      F('baseboardLf', 'Baseboard', '180', 'LF', 'interior')
    ),
    row(
      F('wallPaintSqft', 'Interior wall paint', '3080', 'sqft', 'interior'),
      F(
        'ceilingPaintSqft',
        'Interior ceiling paint',
        '1400',
        'sqft',
        'interior'
      )
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

/** Plan Export Plumbing rows for ground-up/addition takeoffs. */
export const PLUMBING_PLAN_QUICK_MEASUREMENT_ROWS: QuickMeasurementRow[] = [
  row(
    F(
      'plumbingRoughPointCount',
      'Plumbing rough-in points',
      'e.g. 12',
      'each',
      'structure',
      true,
      'Use explicit rough-in callouts or schedules; do not infer from living SF.'
    )
  ),
  row(
    F(
      'plumbingTrimHookupCount',
      'Trim / hookups',
      'e.g. 12',
      'each',
      'interior'
    )
  ),
  row(
    F(
      'waterLineLf',
      'Underground water service / under-slab piping',
      'e.g. 150',
      'LF',
      'structure',
      undefined,
      'Document water service or under-slab piping only; excavation, tap fees, and permits are separate unless included.'
    ),
    F(
      'sewerLineLf',
      'Underground sewer / drain / under-slab DWV',
      'e.g. 80',
      'LF',
      'structure',
      undefined,
      'Document sewer, building drain, or under-slab DWV only; excavation, tap fees, and permits are separate unless included.'
    )
  ),
  row(
    F(
      'gasLineLf',
      'Gas piping',
      'e.g. 100',
      'LF',
      'structure',
      undefined,
      'Count only explicit gas piping or gas stubs shown or noted on the plan.'
    )
  ),
];

/** Plan Export Windows & doors rows for a focused opening takeoff. */
export const WINDOWS_DOORS_PLAN_QUICK_MEASUREMENT_ROWS: QuickMeasurementRow[] =
  [
    row(
      F(
        'windowCount',
        'Windows',
        'e.g. 12',
        'each',
        'exterior',
        true,
        'Count window units from the window schedule or readable exterior elevations.'
      ),
      F(
        'exteriorDoorCount',
        'Exterior swing doors',
        'e.g. 3',
        'each',
        'exterior',
        undefined,
        'Count hinged/French exterior openings as units, not leaves. Exclude explicit sliders and garage doors.'
      )
    ),
    row(
      F(
        'slidingDoorCount',
        'Sliding / patio doors',
        'e.g. 2',
        'each',
        'exterior',
        undefined,
        'Count only explicit sliding, multi-slide, or bypass units — not hinged French/patio doors.'
      ),
      F(
        'interiorDoorCount',
        'Interior doors',
        'e.g. 12',
        'each',
        'interior',
        undefined,
        'Count interior openings (including closets). Confirm if there is no door schedule.'
      )
    ),
  ];

export const GARAGE_DOORS_PLAN_QUICK_MEASUREMENT_ROWS: QuickMeasurementRow[] = [
  row(
    F(
      'garageDoorSingleCount',
      'Single garage doors',
      'e.g. 1',
      'each',
      'exterior',
      true,
      'Use the garage door schedule or elevation; do not infer type from garage area.'
    ),
    F(
      'garageDoorDoubleCount',
      'Double garage doors',
      'e.g. 1',
      'each',
      'exterior',
      undefined,
      'Use the garage door schedule or elevation; do not infer type from garage area.'
    )
  ),
  row(
    F(
      'garageDoorRvCount',
      'RV / oversized garage doors',
      'e.g. 1',
      'each',
      'exterior',
      undefined,
      'Count only when the larger/taller opening is documented.'
    ),
    F(
      'garageDoorOpenerCount',
      'Garage door openers',
      'e.g. 2',
      'each',
      'exterior',
      undefined,
      'Count only when openers are labeled or specified.'
    )
  ),
];

/** Notes/manual Windows & doors rows add reframing only when explicitly requested. */
export const WINDOWS_DOORS_NOTES_QUICK_MEASUREMENT_ROWS: QuickMeasurementRow[] =
  [
    ...WINDOWS_DOORS_PLAN_QUICK_MEASUREMENT_ROWS,
    row(
      F(
        'framingOpeningCount',
        'Structural reframing / new openings',
        'e.g. 1',
        'each',
        'structure',
        undefined,
        'Use only for an explicitly new, resized, enlarged, or reframed opening. Replacement-only work stays blank.'
      )
    ),
  ];

/** Notes/manual Plumbing rows may include explicit service operations. */
export const PLUMBING_NOTES_QUICK_MEASUREMENT_ROWS: QuickMeasurementRow[] = [
  ...SCOPE_QUICK_MEASUREMENT_ROWS.plumbing,
  row(
    F(
      'serviceCallCount',
      'Service calls',
      'e.g. 1',
      'each',
      'other',
      undefined,
      'Explicit service visits only.'
    ),
    F(
      'drainCleaningCount',
      'Drain cleanings',
      'e.g. 1',
      'each',
      'other',
      undefined,
      'Explicit drain-clearing service only.'
    )
  ),
];

export const PLUMBING_SERVICE_QUICK_MEASUREMENT_ROWS: QuickMeasurementRow[] = [
  row(
    F('serviceCallCount', 'Service calls', 'e.g. 1', 'each', 'other'),
    F('fixtureRepairCount', 'Fixture repairs', 'e.g. 1', 'each', 'interior')
  ),
  row(
    F(
      'fixtureReplacementCount',
      'Fixture replacements',
      'e.g. 1',
      'each',
      'interior'
    ),
    F('drainCleaningCount', 'Drain cleanings', 'e.g. 1', 'each', 'other')
  ),
];

export function resolveQuickMeasurementTemplateKey(
  templateKey?: string | null,
  projectType?: string | null
): string {
  const tk = String(templateKey || '').toLowerCase();
  const pt = String(projectType || '').toLowerCase();
  if (tk === 'plumbing_service') return 'plumbing';
  if (tk === 'windows_doors') return 'windows_doors';
  if (tk === 'garage_doors') return 'garage_doors';
  if (tk === 'room_addition' || tk === 'home_addition') return 'addition';
  // Checklist template wins. projectType must not force flooring fields onto a
  // kitchen/bath remodel just because notes also mention floor tile.
  if (tk && SCOPE_QUICK_MEASUREMENT_ROWS[tk]) return tk;
  if (pt === 'new_build' || pt === 'ground_up') return 'ground_up';
  if (pt === 'windows_doors' || pt === 'windows_and_doors') {
    return 'windows_doors';
  }
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
  if (pt === 'plumbing' || pt === 'plumbing_service') return 'plumbing';
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
  notes?: string | null;
}): string {
  const resolved = resolveQuickMeasurementTemplateKey(
    params.templateKey,
    params.projectType
  );
  const notes = String(params.notes || '');
  const insulationRequested =
    /\b(?:insulat(?:e|ion|ed)|R[-\s]?\d{2,3}|fiberglass\s+batt|blown[-\s]?in)\b/i.test(
      notes
    );
  const drywallWorkRequested = notes
    .split(/[.;\n]/)
    .some(
      clause =>
        /\b(?:drywall|sheetrock)\b[^.;\n]{0,50}\b(?:install|hang|finish|replace|repair|remove|removal|demo|demolition)\b|\b(?:install|hang|finish|replace|remove|removal|demo|demolition|repair)\b[^.;\n]{0,50}\b(?:drywall|sheetrock)\b/i.test(
          clause
        ) &&
        !/\b(?:no|without|exclude|excluding|not)\b[^.;\n]{0,20}\b(?:drywall|sheetrock)\b/i.test(
          clause
        )
    );
  const framingFocusedAddition =
    ['addition', 'room_addition', 'home_addition'].includes(resolved) &&
    /\b(?:room\s+)?addition\b/i.test(notes) &&
    /\b(?:frame|framing|framed|stud\s+walls?|wall\s+framing|interior\s+partitions?)\b/i.test(
      notes
    );
  if (framingFocusedAddition) return 'framing';
  if (
    resolved === 'room_remodel' &&
    insulationRequested &&
    !drywallWorkRequested
  ) {
    return 'insulation';
  }
  const hasKitchenScope = /\bkitchen\b/i.test(notes);
  const hasBathroomScope = /\bbathroom\b|\bbathrooms\b|\bbaths?\b/i.test(
    notes
  );
  const hasMultipleBathrooms =
    /\b(?:\d+|one|two|three|four|five|multiple)\s+bathrooms?\b/i.test(notes);
  const isMultiRoomRemodel =
    (hasKitchenScope && hasBathroomScope) || hasMultipleBathrooms;
  if (
    isMultiRoomRemodel &&
    (resolved === 'kitchen' ||
      resolved === 'bathroom' ||
      resolved === 'room_remodel')
  ) {
    return 'room_remodel';
  }
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

  if (looksWholeHome && !params.templateKey) {
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
  projectType?: string | null,
  notes?: string | null
): QuickMeasurementRow[] {
  const resolvedKey = resolveQuickMeasurementTemplateKey(
    templateKey,
    projectType
  );
  const framingNoteText = String(notes || '');
  const key =
    resolvedKey === 'addition' &&
    /\b(?:room\s+)?addition\b/i.test(framingNoteText) &&
    /\b(?:frame|framing|framed|stud\s+walls?|wall\s+framing|interior\s+partitions?)\b/i.test(
      framingNoteText
    )
      ? 'framing'
      : resolvedKey;
  if (key === 'windows_doors') {
    return WINDOWS_DOORS_PLAN_QUICK_MEASUREMENT_ROWS;
  }
  if (key === 'garage_doors') {
    return GARAGE_DOORS_PLAN_QUICK_MEASUREMENT_ROWS;
  }
  const labeled = applyProjectSpecificQuickMeasurementLabels(
    SCOPE_QUICK_MEASUREMENT_ROWS[key] ||
      SCOPE_QUICK_MEASUREMENT_ROWS.room_remodel,
    key,
    projectType
  );
  const garageFiltered = filterGarageConversionQuickMeasurementRows(
    labeled,
    projectType,
    notes
  );
  const mixedFiltered = filterMixedInteriorRefreshRows(
    garageFiltered,
    key,
    notes
  );
  const remodelRows =
    key === 'room_remodel' &&
    /\b(?:\d[\d,]*(?:\.\d+)?)\s*(?:linear\s+feet|linear\s+foot|lf)\s+(?:of\s+)?(?:kitchen\s+)?countertops?\b/i.test(
      String(notes || '')
    )
      ? mixedFiltered.map(row =>
          row.map(field =>
            field.key === 'countertopSqft'
              ? QUICK_MEASUREMENT_FIELD_DEFS.countertopLf!
              : field
          )
        )
      : mixedFiltered;
  if (key !== 'room_remodel' || !String(notes || '').trim()) {
    return remodelRows;
  }
  const remodelNoteText = String(notes || '');
  const hasPaint = /\b(?:paint(?:ing)?|repaint)\b/i.test(remodelNoteText);
  const hasFlooring =
    !/\bfloor(?:ing)?\s+protection\b/i.test(remodelNoteText) &&
    /\b(?:install|installation|replace|replacement|new|demo|demolition|remove|removal|tear[\s-]?out)\b[^.;\n]{0,80}\b(?:flooring|floor\s+tile|lvp|laminate|vinyl|carpet)\b|\b(?:flooring|floor\s+tile|lvp|laminate|vinyl|carpet)\b[^.;\n]{0,80}\b(?:install|installation|replace|replacement|new|demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(
      remodelNoteText
    );
  const hasDrywall =
    /\b(?:drywall|sheetrock|patch(?:ing)?|wall\s+repair)\b/i.test(
      remodelNoteText
    );
  const hasBaseboard = /\bbaseboards?\b|\btrim\b/i.test(remodelNoteText);
  const optionalKeys = new Set<QuickMeasurementFieldKey>([
    'floorAreaSqft',
    'flooringSqft',
    'drywallSqft',
    'baseboardLf',
    'wallPaintSqft',
    'ceilingPaintSqft',
  ]);
  return remodelRows
    .map(row =>
      row.filter(field => {
        if (!optionalKeys.has(field.key)) return true;
        if (field.key === 'floorAreaSqft' || field.key === 'flooringSqft')
          return hasFlooring;
        if (field.key === 'drywallSqft') return hasDrywall;
        if (field.key === 'baseboardLf') return hasBaseboard;
        return hasPaint;
      })
    )
    .filter(row => row.length > 0);
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
            placeholder:
              projectType === 'adu'
                ? '650'
                : projectType === 'garage_conversion'
                  ? '400'
                  : field.placeholder,
            primary: true,
          }
        : field
    )
  );
}

const GARAGE_CONVERSION_HIDDEN_MEASUREMENT_KEYS =
  new Set<QuickMeasurementFieldKey>([
    'garageSqft',
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

function garageConversionOpeningMeasurementRows(
  rows: QuickMeasurementRow[]
): QuickMeasurementRow[] {
  const existingKeys = new Set(rows.flat().map(field => field.key));
  return WINDOWS_DOORS_PLAN_QUICK_MEASUREMENT_ROWS.map(row =>
    row.filter(field => !existingKeys.has(field.key))
  ).filter(row => row.length > 0);
}

function filterGarageConversionQuickMeasurementRows(
  rows: QuickMeasurementRow[],
  projectType?: string | null,
  notes?: string | null
): QuickMeasurementRow[] {
  if (!isGarageConversionJob(projectType, notes)) return rows;
  const filtered = rows
    .map(row =>
      row.filter(
        field => !GARAGE_CONVERSION_HIDDEN_MEASUREMENT_KEYS.has(field.key)
      )
    )
    .filter(row => row.length > 0);
  return [...filtered, ...garageConversionOpeningMeasurementRows(filtered)];
}

function isMixedInteriorRefreshNotes(notes?: string | null): boolean {
  const text = String(notes || '');
  if (/\b(?:kitchen|bath(?:room)?|shower|tub|vanity|toilet)\b/i.test(text)) {
    return false;
  }
  const signals = [
    /\bpaint(?:ing)?\b/i,
    /\b(?:lvp|laminate|vinyl|carpet|hardwood|flooring)\b/i,
    /\b(?:interior\s+)?doors?\b|\b(?:baseboard|trim)\b/i,
    /\bdrywall\b|\bpatch(?:ing)?\b/i,
  ];
  return signals.filter(pattern => pattern.test(text)).length >= 2;
}

function filterMixedInteriorRefreshRows(
  rows: QuickMeasurementRow[],
  templateKey?: string | null,
  notes?: string | null
): QuickMeasurementRow[] {
  if (
    String(templateKey || '').toLowerCase() !== 'room_remodel' ||
    !isMixedInteriorRefreshNotes(notes)
  ) {
    return rows;
  }
  return rows
    .map(row => row.filter(field => field.key !== 'bathroomFloorSqft'))
    .filter(row => row.length > 0);
}

export function hasQuickMeasurementValue(value: unknown): boolean {
  const n = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(n) && n > 0;
}

export function notesRequireInteriorPaintMeasurements(
  notes?: string | null
): boolean {
  const text = String(notes || '');
  return (
    /\b(?:paint|painting|repaint)\b[^.;\n]{0,50}\b(?:interior\s+)?(?:wall|ceiling)s?\b/i.test(
      text
    ) ||
    /\b(?:interior\s+)?(?:wall|ceiling)s?\b[^.;\n]{0,50}\b(?:paint|painting|repaint)\b/i.test(
      text
    )
  );
}

/** Live form value for a quick measurement field (note prefill until the user types). */
export function resolveQuickMeasurementDisplayValue(
  key: QuickMeasurementFieldKey,
  measurements: Partial<Record<QuickMeasurementFieldKey, string | undefined>>,
  noteValues: Partial<Record<QuickMeasurementFieldKey, string>> = {},
  userOverrides: Partial<Record<QuickMeasurementFieldKey, boolean>> = {}
): string {
  const raw = measurements[key];
  if (userOverrides[key]) {
    return String(raw ?? '');
  }
  // Explicit note quantities are authoritative over stale inferred/formula
  // values that may already be persisted on the draft.
  if (noteValues[key]) {
    return noteValues[key];
  }
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
  noteBackedKeys?: Iterable<QuickMeasurementFieldKey>,
  options?: {
    plumbingPlanImport?: boolean;
    windowsDoorsPlanImport?: boolean;
    garageDoorsPlanImport?: boolean;
    windowsDoorsNotesFlow?: boolean;
    plumbingNotesFlow?: boolean;
    plumbingWorkflowMode?: PlumbingWorkflowMode | null;
    scopeNotes?: string | null;
  }
): QuickMeasurementRow[] {
  const resolvedKey = resolveQuickMeasurementTemplateKey(
    templateKey,
    projectType
  );
  const noteKeySet = noteBackedKeys ? new Set(noteBackedKeys) : null;
  const plumbingTemplate =
    resolvedKey === 'plumbing' &&
    ['plumbing', 'plumbing_service'].includes(
      String(templateKey || '').toLowerCase()
    );
  const baseRows = options?.windowsDoorsNotesFlow
    ? WINDOWS_DOORS_NOTES_QUICK_MEASUREMENT_ROWS
    : options?.windowsDoorsPlanImport
      ? WINDOWS_DOORS_PLAN_QUICK_MEASUREMENT_ROWS
      : options?.garageDoorsPlanImport
        ? GARAGE_DOORS_PLAN_QUICK_MEASUREMENT_ROWS
        : options?.plumbingPlanImport && plumbingTemplate
          ? PLUMBING_PLAN_QUICK_MEASUREMENT_ROWS
          : options?.plumbingNotesFlow && plumbingTemplate
            ? options.plumbingWorkflowMode === 'service'
              ? PLUMBING_SERVICE_QUICK_MEASUREMENT_ROWS
              : options.plumbingWorkflowMode === 'new_construction'
                ? PLUMBING_PLAN_QUICK_MEASUREMENT_ROWS
                : PLUMBING_NOTES_QUICK_MEASUREMENT_ROWS
            : quickMeasurementRowsForTemplate(
                templateKey,
                projectType,
                options?.scopeNotes
              );
  const baseKeys = new Set(baseRows.flatMap(r => r.map(f => f.key)));
  const plumbingRowsAreExplicit =
    plumbingTemplate &&
    (options?.plumbingPlanImport || options?.plumbingNotesFlow);
  const extraFields = plumbingRowsAreExplicit
    ? []
    : NOTE_BACKED_QUICK_FIELD_ORDER.filter(
        key =>
          !baseKeys.has(key) &&
          (!noteKeySet || noteKeySet.has(key)) &&
          hasQuickMeasurementValue(measurements[key])
      )
        .map(key => QUICK_MEASUREMENT_FIELD_DEFS[key])
        .filter((field): field is QuickMeasurementFieldDef => Boolean(field));

  // Framing has a dedicated takeoff surface. Do not append unrelated
  // note-backed fields such as roof squares or living area to it.
  if (resolvedKey === 'framing') return baseRows;
  // Insulation has its own dedicated measurement surface. Do not append
  // stale or unrelated note-backed finish fields such as interior paint,
  // drywall, or flooring to an insulation scope.
  if (resolvedKey === 'insulation') {
    const notes = String(options?.scopeNotes || '');
    const hasRoofDeckReference =
      noteKeySet?.has('insulatedRoofDeckSqft') ||
      /\b(?:insulated|insulation|insulate)\b[^.;\n]{0,45}\b(?:roof\s+deck|roof\s+sheathing)\b|\b(?:roof\s+deck|roof\s+sheathing)\b[^.;\n]{0,45}\b(?:insulated|insulation|insulate)\b/i.test(
        notes
      );
    const hasOpeningDeductionReference =
      noteKeySet?.has('openingDeductionSqft') ||
      /\b(?:opening|window|door)\b[^.;\n]{0,45}\b(?:deduction|subtract|deduct)\b|\b(?:deduction|subtract|deduct)\b[^.;\n]{0,45}\b(?:opening|window|door)\b/i.test(
        notes
      );
    const optionalFields = new Set<QuickMeasurementFieldKey>([
      'insulatedRoofDeckSqft',
      'openingDeductionSqft',
    ]);
    return baseRows
      .map(row =>
        row.filter(field => {
          if (!optionalFields.has(field.key)) return true;
          return field.key === 'insulatedRoofDeckSqft'
            ? Boolean(hasRoofDeckReference)
            : Boolean(hasOpeningDeductionReference);
        })
      )
      .filter(row => row.length > 0);
  }

  // Keep row order stable while typing — dynamic note-only rows caused TextInput focus to jump.
  if (resolvedKey === 'room_remodel' || resolvedKey === 'kitchen') {
    const notes = String(options?.scopeNotes || '');
    const kitchenNotes =
      /\bkitchen(?:\s+remodel)?\b/i.test(notes) ||
      /\b(?:countertops?|backsplash|cabinetry|quartz)\b/i.test(notes);
    if (kitchenNotes) {
      const optionalKitchenKeys = new Set<QuickMeasurementFieldKey>([
        'floorAreaSqft',
        'flooringSqft',
        'kitchenFloorSqft',
        'drywallSqft',
        'baseboardLf',
        'wallPaintSqft',
        'ceilingPaintSqft',
        'paintAreaSqft',
      ]);
      const explicitFloorWork =
        /\b(?:install|installation|replace|replacement|new|demo|demolition|remove|removal|tear[\s-]?out)\b[^.;]{0,80}\b(?:flooring|floor\s+tile|lvp|laminate|vinyl|carpet)\b|\b(?:flooring|floor\s+tile|lvp|laminate|vinyl|carpet)\b[^.;]{0,80}\b(?:install|installation|replace|replacement|demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(
          notes
        ) ||
        /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b[^.;\n]{0,35}\b(?:flooring|floor\s+tile|lvp|laminate|vinyl|carpet)\b|\b(?:flooring|floor\s+tile|lvp|laminate|vinyl|carpet)\b[^.;\n]{0,35}\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i.test(
          notes
        );
      const explicitDrywall =
        /\b(?:drywall|sheetrock|gypsum|wall\s+repair|patch(?:ing)?)\b/i.test(
          notes
        );
      const explicitBaseboard = /\b(?:baseboards?|base\s*board)\b/i.test(notes);
      const explicitPaint = /\b(?:paint(?:ing)?|repaint|primer)\b/i.test(notes);
      const keepField = (field: QuickMeasurementFieldDef) => {
        if (!optionalKitchenKeys.has(field.key)) return true;
        if (
          field.key === 'floorAreaSqft' ||
          field.key === 'flooringSqft' ||
          field.key === 'kitchenFloorSqft'
        ) {
          return explicitFloorWork;
        }
        if (field.key === 'drywallSqft') return explicitDrywall;
        if (field.key === 'baseboardLf') return explicitBaseboard;
        return explicitPaint;
      };
      const filteredRows = baseRows
        .map(row => row.filter(keepField))
        .filter(row => row.length > 0);
      const hasKitchenFloorField = filteredRows.some(row =>
        row.some(field => field.key === 'kitchenFloorSqft')
      );
      if (
        explicitFloorWork &&
        !hasKitchenFloorField &&
        QUICK_MEASUREMENT_FIELD_DEFS.kitchenFloorSqft
      ) {
        return filteredRows.map(row =>
          row.map(field =>
            field.key === 'flooringSqft'
              ? QUICK_MEASUREMENT_FIELD_DEFS.kitchenFloorSqft
              : field
          )
        );
      }
      return filteredRows;
    }
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
      noteValues,
      (
        measurements as {
          quickMeasurementUserOverrides?: Partial<
            Record<QuickMeasurementFieldKey, boolean>
          >;
        }
      ).quickMeasurementUserOverrides
    );
    if (hasQuickMeasurementValue(value)) filled += 1;
  }
  return { filled, total: fields.length };
}

export function quickMeasurementFieldDef(
  key: QuickMeasurementFieldKey
): QuickMeasurementFieldDef | undefined {
  return QUICK_MEASUREMENT_FIELD_DEFS[key];
}

/** Contractor-friendly label + unit for a quick-measurement key (plan takeoff review, alerts). */
export function quickMeasurementFieldMeta(key: string): {
  label: string;
  unit: string;
} {
  const def = QUICK_MEASUREMENT_FIELD_DEFS[key as QuickMeasurementFieldKey];
  if (def) {
    return {
      label: def.label,
      unit:
        key === 'plumbingRoughPointCount' || key === 'plumbingTrimHookupCount'
          ? 'fixtures'
          : def.unit,
    };
  }
  for (const rows of Object.values(SCOPE_QUICK_MEASUREMENT_ROWS)) {
    for (const row of rows) {
      for (const field of row) {
        if (field.key === key) {
          return { label: field.label, unit: field.unit };
        }
      }
    }
  }
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
    return 'Total SF being replaced or receiving new flooring. Usually matches living area unless unfinished space differs.';
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
    countertopLf: '',
    cabinetLf: '',
    showerWallTileSqft: '',
    showerFloorTileSqft: '',
    wallPaintSqft: '',
    ceilingPaintSqft: '',
    paintAreaSqft: '',
    patchRepairSqft: '',
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
    roofDeckingReplacementSqft: '',
    roofDripEdgeLf: '',
    roofRidgeCapLf: '',
    roofRidgeVentLf: '',
    roofValleyFlashingLf: '',
    roofStepFlashingLf: '',
    roofWallFlashingLf: '',
    roofChimneyFlashingCount: '',
    roofPipeBootCount: '',
    roofVentCount: '',
    roofTurbineVentCount: '',
    roofSkylightCount: '',
    roofPenetrationCount: '',
    roofRepairAffectedSqft: '',
    roofGutterLf: '',
    roofDownspoutCount: '',
    roofPitch: '',
    storyCount: '',
    drywallSqft: '',
    drywallWallSqft: '',
    drywallCeilingSqft: '',
    drywallOpeningDeductionSqft: '',
    garageWallDrywallSqft: '',
    garageCeilingDrywallSqft: '',
    moistureResistantDrywallSqft: '',
    fireRatedDrywallSqft: '',
    highCeilingDrywallSqft: '',
    vaultedCeilingDrywallSqft: '',
    level5FinishSqft: '',
    exteriorWallGrossSqft: '',
    exteriorWallInsulationSqft: '',
    atticInsulationSqft: '',
    insulatedRoofDeckSqft: '',
    floorInsulationSqft: '',
    garageSeparationInsulationSqft: '',
    insulatedGarageWallSqft: '',
    insulatedGarageCeilingSqft: '',
    openingDeductionSqft: '',
    insulationMaterialType: '',
    insulationRValue: '',
    garageInsulationIncluded: '',
    serviceCallCount: '',
    fixtureRepairCount: '',
    fixtureReplacementCount: '',
    drainCleaningCount: '',
    waterLineLf: '',
    sewerLineLf: '',
    gasLineLf: '',
    plumbingRoughPointCount: '',
    plumbingTrimHookupCount: '',
    plumbingFixturesHardwareCount: '',
    waterHeaterCount: '',
    gasApplianceConnectionCount: '',
    partsMaterialsCount: '',
    emergencyFeeCount: '',
    plumbingCleanupCount: '',
    hvacSystemCount: '',
    hvacSystemTons: '',
    hvacServiceCallCount: '',
    hvacEquipmentReplacementCount: '',
    hvacRefrigerantCount: '',
    hvacThermostatCount: '',
    hvacDuctworkLf: '',
    hvacSupplyRegisterCount: '',
    hvacReturnGrilleCount: '',
    hvacVentilationCount: '',
    hvacPermitCount: '',
    hvacCleanupCount: '',
    flooringSqft: '',
    flooringLvpSqft: '',
    flooringLaminateSqft: '',
    flooringEngineeredHardwoodSqft: '',
    flooringSolidHardwoodSqft: '',
    flooringTileSqft: '',
    flooringCarpetSqft: '',
    floorDemoSqft: '',
    floorPrepSqft: '',
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
    framedAreaSqft: '',
    wallFramingLf: '',
    sheathingSqft: '',
    framingOpeningCount: '',
    framingCleanupCount: '',
  };
}
