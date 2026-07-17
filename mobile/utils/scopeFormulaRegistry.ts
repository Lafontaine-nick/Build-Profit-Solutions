import type { NormalizedScopeMeasurements } from '@/utils/scopeItemQuantities';
import { formatUnitLabel, getNationalAverageBudgetSplit } from '@/utils/scopeItemQuantities';

export type FormulaConfidence = 'high' | 'medium' | 'low';
export type FormulaUnitCode = string;
export type FormulaMeasurementType = string;

export type FormulaAssumption = {
  key: string;
  description: string;
  applicableScopes: string[];
  defaultValue: number;
  unit: FormulaUnitCode;
  confidenceImpact: 'minor' | 'material';
  mayUseAutomatically: boolean;
  recommendedConfirmation: boolean;
  low?: number;
  high?: number;
};

export type FormulaInputDefinition = {
  key: string;
  label: string;
  unit: FormulaUnitCode;
  measurementFields?: Array<keyof NormalizedScopeMeasurements>;
  required?: boolean;
  assumptionKey?: string;
  critical?: boolean;
};

export type FormulaInputUsed = {
  key: string;
  label: string;
  value: number;
  unit: FormulaUnitCode;
  source: 'measurement' | 'assumption' | 'provided';
};

export type FormulaAssumptionUsed = {
  key: string;
  description: string;
  value: number;
  unit: FormulaUnitCode;
  low?: number;
  high?: number;
};

export type FormulaCalculationResult = {
  formulaKey: string;
  formulaName: string;
  value: number;
  unit: FormulaUnitCode;
  exactValue: number;
  roundedValue: number;
  expectedRange?: { low: number; high: number };
  inputsUsed: FormulaInputUsed[];
  assumptionsUsed: FormulaAssumptionUsed[];
  missingInputs: Array<{ type: FormulaMeasurementType; label: string }>;
  confidence: FormulaConfidence;
  formulaExplanation: string;
  validationNotices: Array<{ ruleKey: string; severity: 'info' | 'review' | 'warning' | 'blocking'; message: string }>;
  trace: string[];
};

export type FormulaContext = {
  scopeKey?: string;
  projectContext?: string | null;
  materialType?: string | null;
};

export type FormulaDefinition = {
  key: string;
  name: string;
  trade: string;
  applicableScopeKeys: string[];
  outputMeasurementType: FormulaMeasurementType;
  outputUnit: FormulaUnitCode;
  requiredInputs: FormulaInputDefinition[];
  optionalInputs?: FormulaInputDefinition[];
  defaultAssumptionKeys?: string[];
  calculate: (inputs: Record<string, number>, ctx: { assumptions: Record<string, FormulaAssumptionUsed>; context: FormulaContext }) => {
    exactValue: number;
    trace: string[];
    rangeFromAssumptions?: (assumptions: Record<string, FormulaAssumptionUsed>) => { low: number; high: number } | null;
  };
  rounding: 'sqft' | 'lf' | 'cy' | 'each' | 'squares' | 'purchase_up' | 'none';
  explanation: (result: { roundedValue: number; unit: string; inputs: FormulaInputUsed[]; assumptions: FormulaAssumptionUsed[] }) => string;
};

const ASSUMPTIONS: Record<string, FormulaAssumption> = {
  flooring_waste_lvp: {
    key: 'flooring_waste_lvp',
    description: 'LVP/laminate waste factor',
    applicableScopes: ['flooring'],
    defaultValue: 0.08,
    unit: 'percentage',
    confidenceImpact: 'minor',
    mayUseAutomatically: true,
    recommendedConfirmation: true,
    low: 0.05,
    high: 0.12,
  },
  tile_waste_straight: {
    key: 'tile_waste_straight',
    description: 'Straight-lay tile waste factor',
    applicableScopes: ['floor_tile', 'backsplash', 'shower_tile', 'shower_floor_tile'],
    defaultValue: 0.1,
    unit: 'percentage',
    confidenceImpact: 'minor',
    mayUseAutomatically: true,
    recommendedConfirmation: true,
    low: 0.08,
    high: 0.15,
  },
  drywall_surface_multiplier: {
    key: 'drywall_surface_multiplier',
    description: 'Drywall surface multiplier from floor area when wall geometry is missing',
    // Insulation must NOT use drywall wall+ceiling surface (excludes thermal envelope model).
    applicableScopes: ['drywall', 'hang', 'finish_tape', 'paint'],
    defaultValue: 3.5,
    unit: 'multiplier',
    confidenceImpact: 'material',
    mayUseAutomatically: true,
    recommendedConfirmation: true,
    low: 3,
    high: 4.2,
  },
  insulation_openings_percent: {
    key: 'insulation_openings_percent',
    description: 'Window/door opening deduction on exterior wall insulation area',
    applicableScopes: ['insulation'],
    defaultValue: 15,
    unit: 'percentage',
    confidenceImpact: 'material',
    mayUseAutomatically: true,
    recommendedConfirmation: true,
    low: 10,
    high: 20,
  },
  insulation_wall_height_ft: {
    key: 'insulation_wall_height_ft',
    description: 'Exterior wall height for insulation envelope planning',
    applicableScopes: ['insulation'],
    defaultValue: 9,
    unit: 'ft',
    confidenceImpact: 'material',
    mayUseAutomatically: true,
    recommendedConfirmation: true,
    low: 8,
    high: 10,
  },
  paint_surface_multiplier: {
    key: 'paint_surface_multiplier',
    description: 'Paintable surface multiplier from floor area when wall geometry is missing',
    applicableScopes: ['paint', 'interior_paint'],
    defaultValue: 3.2,
    unit: 'multiplier',
    confidenceImpact: 'material',
    mayUseAutomatically: true,
    recommendedConfirmation: true,
    low: 2.6,
    high: 3.8,
  },
  slab_thickness_inches_4: {
    key: 'slab_thickness_inches_4',
    description: 'Typical flatwork slab thickness',
    applicableScopes: ['concrete', 'pour_flatwork', 'sidewalk', 'patio', 'driveway'],
    defaultValue: 4,
    unit: 'in',
    confidenceImpact: 'material',
    mayUseAutomatically: true,
    recommendedConfirmation: true,
    low: 3.5,
    high: 6,
  },
  trench_width_ft: {
    key: 'trench_width_ft',
    description: 'Typical utility trench width',
    applicableScopes: ['utility_trenching', 'excavation', 'backfill'],
    defaultValue: 1.5,
    unit: 'ft',
    confidenceImpact: 'material',
    mayUseAutomatically: false,
    recommendedConfirmation: true,
    low: 1,
    high: 2,
  },
  trench_depth_ft: {
    key: 'trench_depth_ft',
    description: 'Typical utility trench depth',
    applicableScopes: ['utility_trenching', 'excavation', 'backfill'],
    defaultValue: 2.5,
    unit: 'ft',
    confidenceImpact: 'material',
    mayUseAutomatically: false,
    recommendedConfirmation: true,
    low: 1.5,
    high: 4,
  },
  rock_mulch_depth_inches: {
    key: 'rock_mulch_depth_inches',
    description: 'Landscape material depth',
    applicableScopes: ['rock_mulch', 'topsoil', 'aggregate_base'],
    defaultValue: 2,
    unit: 'in',
    confidenceImpact: 'material',
    mayUseAutomatically: true,
    recommendedConfirmation: true,
    low: 1.5,
    high: 3,
  },
  countertop_depth_ft: {
    key: 'countertop_depth_ft',
    description: 'Standard countertop depth',
    applicableScopes: ['countertops'],
    defaultValue: 2.083,
    unit: 'ft',
    confidenceImpact: 'minor',
    mayUseAutomatically: true,
    recommendedConfirmation: true,
    low: 2,
    high: 2.25,
  },
  post_spacing_ft: {
    key: 'post_spacing_ft',
    description: 'Fence/railing post spacing',
    applicableScopes: ['fencing', 'railing'],
    defaultValue: 8,
    unit: 'ft',
    confidenceImpact: 'minor',
    mayUseAutomatically: true,
    recommendedConfirmation: true,
    low: 6,
    high: 10,
  },
};

function n(v: unknown): number | null {
  const parsed = Number(v);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function round(value: number, rule: FormulaDefinition['rounding']): number {
  if (!Number.isFinite(value)) return 0;
  if (rule === 'cy' || rule === 'squares') return Math.round(value * 10) / 10;
  if (rule === 'each' || rule === 'purchase_up') return Math.ceil(value);
  if (rule === 'none') return Math.round(value * 100) / 100;
  return Math.round(value);
}

function valueFromMeasurements(input: FormulaInputDefinition, measurements?: NormalizedScopeMeasurements | null): number | null {
  for (const field of input.measurementFields || []) {
    const value = n(measurements?.[field]);
    if (value != null) return value;
  }
  return null;
}

function confidenceFor(assumptions: FormulaAssumptionUsed[], missingCount: number): FormulaConfidence {
  if (missingCount > 0) return 'low';
  if (!assumptions.length) return 'high';
  return assumptions.some((a) => ASSUMPTIONS[a.key]?.confidenceImpact === 'material') ? 'low' : 'medium';
}

function input(key: string, label: string, unit: string, measurementFields: Array<keyof NormalizedScopeMeasurements>, required = true): FormulaInputDefinition {
  return { key, label, unit, measurementFields, required, critical: required };
}

function assumptionInput(key: string, label: string, unit: string, assumptionKey: string, required = true): FormulaInputDefinition {
  return { key, label, unit, assumptionKey, required, critical: required };
}

function formatList(parts: string[]): string {
  return parts.filter(Boolean).join(', ');
}

const FORMULAS: FormulaDefinition[] = [
  {
    key: 'flooring_purchase_with_waste',
    name: 'Flooring purchase area with waste',
    trade: 'flooring',
    // Bath floor tile has its own formula — living SF must never seed bathroom tile.
    applicableScopeKeys: ['flooring'],
    outputMeasurementType: 'flooring_area',
    outputUnit: 'sqft',
    requiredInputs: [input('netAreaSqft', 'net floor area', 'sqft', ['flooringSqft', 'floorAreaSqft', 'kitchenFloorSqft'])],
    optionalInputs: [assumptionInput('wastePercent', 'waste factor', 'percentage', 'flooring_waste_lvp', false)],
    defaultAssumptionKeys: ['flooring_waste_lvp'],
    calculate: ({ netAreaSqft, wastePercent }) => {
      const exactValue = netAreaSqft * (1 + (wastePercent || 0));
      return {
        exactValue,
        trace: [`${netAreaSqft} sqft net floor area × ${(1 + (wastePercent || 0)).toFixed(2)} waste factor`],
        rangeFromAssumptions: (assumptions) => {
          const waste = assumptions.flooring_waste_lvp;
          return waste?.low != null && waste.high != null
            ? { low: netAreaSqft * (1 + waste.low), high: netAreaSqft * (1 + waste.high) }
            : null;
        },
      };
    },
    rounding: 'sqft',
    explanation: ({ roundedValue, inputs, assumptions }) =>
      `Calculated ${roundedValue.toLocaleString()} sqft from ${inputs[0]?.value.toLocaleString()} sqft net floor area${assumptions[0] ? ` plus ${Math.round(assumptions[0].value * 100)}% waste` : ''}.`,
  },
  {
    key: 'bath_floor_tile_with_waste',
    name: 'Bath floor tile purchase area with waste',
    trade: 'tile',
    applicableScopeKeys: ['floor_tile'],
    outputMeasurementType: 'flooring_area',
    outputUnit: 'sqft',
    // Bathroom floor only — never living SF / whole-home flooring area.
    requiredInputs: [input('netAreaSqft', 'bathroom floor area', 'sqft', ['bathroomFloorSqft'])],
    optionalInputs: [assumptionInput('wastePercent', 'waste factor', 'percentage', 'tile_waste_straight', false)],
    defaultAssumptionKeys: ['tile_waste_straight'],
    calculate: ({ netAreaSqft, wastePercent }) => {
      const exactValue = netAreaSqft * (1 + (wastePercent || 0));
      return {
        exactValue,
        trace: [`${netAreaSqft} sqft bathroom floor × ${(1 + (wastePercent || 0)).toFixed(2)} waste factor`],
        rangeFromAssumptions: (assumptions) => {
          const waste = assumptions.tile_waste_straight;
          return waste?.low != null && waste.high != null
            ? { low: netAreaSqft * (1 + waste.low), high: netAreaSqft * (1 + waste.high) }
            : null;
        },
      };
    },
    rounding: 'sqft',
    explanation: ({ roundedValue, inputs, assumptions }) =>
      `Calculated ${roundedValue.toLocaleString()} sqft from ${inputs[0]?.value.toLocaleString()} sqft bathroom floor${assumptions[0] ? ` plus ${Math.round(assumptions[0].value * 100)}% waste` : ''}.`,
  },
  {
    key: 'surface_area_from_floor_area_benchmark',
    name: 'Wall/ceiling surface from floor area benchmark',
    trade: 'drywall',
    applicableScopeKeys: ['drywall', 'hang', 'finish_tape'],
    outputMeasurementType: 'wall_surface_area',
    outputUnit: 'sqft',
    requiredInputs: [input('floorAreaSqft', 'floor area', 'sqft', ['floorAreaSqft'])],
    optionalInputs: [assumptionInput('surfaceMultiplier', 'surface multiplier', 'multiplier', 'drywall_surface_multiplier', false)],
    defaultAssumptionKeys: ['drywall_surface_multiplier'],
    calculate: ({ floorAreaSqft, surfaceMultiplier }) => {
      const exactValue = floorAreaSqft * surfaceMultiplier;
      return {
        exactValue,
        trace: [`${floorAreaSqft} sqft floor area × ${surfaceMultiplier} surface multiplier`],
        rangeFromAssumptions: (assumptions) => {
          const m = assumptions.drywall_surface_multiplier;
          return m?.low != null && m.high != null
            ? { low: floorAreaSqft * m.low, high: floorAreaSqft * m.high }
            : null;
        },
      };
    },
    rounding: 'sqft',
    explanation: ({ roundedValue, inputs, assumptions }) =>
      `Calculated ${roundedValue.toLocaleString()} sqft from ${inputs[0]?.value.toLocaleString()} sqft floor area using an approved ${assumptions[0]?.value ?? ''}× surface multiplier assumption.`,
  },
  {
    key: 'insulation_envelope_from_exterior_and_attic',
    name: 'Thermal envelope from exterior walls and attic',
    trade: 'insulation',
    applicableScopeKeys: ['insulation'],
    outputMeasurementType: 'envelope_area',
    outputUnit: 'sqft',
    requiredInputs: [input('floorAreaSqft', 'conditioned floor / attic footprint', 'sqft', ['floorAreaSqft'])],
    optionalInputs: [
      assumptionInput('wallHeightFt', 'wall height', 'ft', 'insulation_wall_height_ft', false),
      assumptionInput('openingsPercent', 'openings percent', 'percentage', 'insulation_openings_percent', false),
    ],
    defaultAssumptionKeys: ['insulation_wall_height_ft', 'insulation_openings_percent'],
    calculate: ({ floorAreaSqft, wallHeightFt, openingsPercent }) => {
      // Perimeter unknown in pure measurement inputs — square-footprint planning perimeter.
      const perimeter = 4 * Math.sqrt(floorAreaSqft);
      const grossWalls = perimeter * wallHeightFt;
      const openings = grossWalls * (Math.max(0, Math.min(50, openingsPercent)) / 100);
      const netWalls = Math.max(0, grossWalls - openings);
      const attic = floorAreaSqft;
      const exactValue = netWalls + attic;
      return {
        exactValue,
        trace: [
          `Exterior walls ≈ ${perimeter.toFixed(0)} LF × ${wallHeightFt} ft − ${openingsPercent}% openings`,
          `Attic/ceiling ${attic} sqft`,
          `Envelope ${netWalls.toFixed(0)} + ${attic} = ${exactValue.toFixed(0)} sqft`,
        ],
        rangeFromAssumptions: (assumptions) => {
          const h = assumptions.insulation_wall_height_ft;
          const o = assumptions.insulation_openings_percent;
          if (h?.low == null || h.high == null || o?.low == null || o.high == null) return null;
          const lowWalls = Math.max(0, perimeter * h.low * (1 - o.high / 100));
          const highWalls = Math.max(0, perimeter * h.high * (1 - o.low / 100));
          return { low: lowWalls + attic, high: highWalls + attic };
        },
      };
    },
    rounding: 'sqft',
    explanation: ({ roundedValue, inputs }) =>
      `Planning estimate ${roundedValue.toLocaleString()} sqft thermal envelope from exterior walls + conditioned ceiling (${inputs[0]?.value.toLocaleString()} sqft living). Not a drywall surface takeoff.`,
  },
  {
    key: 'paintable_area_from_floor_area_benchmark',
    name: 'Paintable area from floor area benchmark',
    trade: 'painting',
    applicableScopeKeys: ['paint', 'interior_paint'],
    outputMeasurementType: 'paintable_surface_area',
    outputUnit: 'sqft',
    requiredInputs: [input('floorAreaSqft', 'floor area', 'sqft', ['floorAreaSqft'])],
    optionalInputs: [assumptionInput('surfaceMultiplier', 'surface multiplier', 'multiplier', 'paint_surface_multiplier', false)],
    defaultAssumptionKeys: ['paint_surface_multiplier'],
    calculate: ({ floorAreaSqft, surfaceMultiplier }) => {
      const exactValue = floorAreaSqft * surfaceMultiplier;
      return {
        exactValue,
        trace: [`${floorAreaSqft} sqft floor area × ${surfaceMultiplier} paintable surface multiplier`],
        rangeFromAssumptions: (assumptions) => {
          const m = assumptions.paint_surface_multiplier;
          return m?.low != null && m.high != null
            ? { low: floorAreaSqft * m.low, high: floorAreaSqft * m.high }
            : null;
        },
      };
    },
    rounding: 'sqft',
    explanation: ({ roundedValue, inputs, assumptions }) =>
      `Calculated ${roundedValue.toLocaleString()} sqft from ${inputs[0]?.value.toLocaleString()} sqft floor area using an approved ${assumptions[0]?.value ?? ''}× paintable-area assumption.`,
  },
  {
    key: 'flatwork_cy_from_area_thickness',
    name: 'Concrete flatwork volume',
    trade: 'concrete',
    applicableScopeKeys: ['concrete', 'pour_flatwork', 'sidewalk', 'patio', 'driveway'],
    outputMeasurementType: 'concrete_volume',
    outputUnit: 'cy',
    requiredInputs: [input('areaSqft', 'slab/flatwork area', 'sqft', ['concreteSqft'])],
    optionalInputs: [assumptionInput('thicknessInches', 'slab thickness', 'in', 'slab_thickness_inches_4', false)],
    defaultAssumptionKeys: ['slab_thickness_inches_4'],
    calculate: ({ areaSqft, thicknessInches }) => {
      const exactValue = areaSqft * (thicknessInches / 12) / 27;
      return {
        exactValue,
        trace: [`${areaSqft} sqft × ${thicknessInches} in ÷ 12 ÷ 27`],
        rangeFromAssumptions: (assumptions) => {
          const t = assumptions.slab_thickness_inches_4;
          return t?.low != null && t.high != null
            ? { low: areaSqft * (t.low / 12) / 27, high: areaSqft * (t.high / 12) / 27 }
            : null;
        },
      };
    },
    rounding: 'cy',
    explanation: ({ roundedValue, inputs, assumptions }) => {
      const sqft = inputs[0]?.value.toLocaleString() ?? '';
      const thickness = assumptions[0]?.value ?? '';
      return `Slab area ${sqft} sqft at ${thickness} in thick ≈ ${roundedValue.toLocaleString()} CY volume cross-check. Pricing uses the slab sqft at national-average $/sqft rates.`;
    },
  },
  {
    key: 'trench_volume_cy',
    name: 'Trench excavation volume',
    trade: 'sitework',
    applicableScopeKeys: ['utility_trenching', 'excavation', 'backfill'],
    outputMeasurementType: 'excavation_volume',
    outputUnit: 'cy',
    requiredInputs: [input('lengthLf', 'trench length', 'lf', ['railingLf', 'baseboardLf'])],
    optionalInputs: [
      assumptionInput('widthFt', 'trench width', 'ft', 'trench_width_ft'),
      assumptionInput('depthFt', 'trench depth', 'ft', 'trench_depth_ft'),
    ],
    defaultAssumptionKeys: [],
    calculate: ({ lengthLf, widthFt, depthFt }) => ({
      exactValue: lengthLf * widthFt * depthFt / 27,
      trace: [`${lengthLf} LF × ${widthFt} ft width × ${depthFt} ft depth ÷ 27`],
    }),
    rounding: 'cy',
    explanation: ({ roundedValue, inputs, assumptions }) =>
      `Calculated ${roundedValue.toLocaleString()} CY from ${inputs[0]?.value.toLocaleString()} LF trench length${assumptions.length ? ` with ${formatList(assumptions.map((a) => `${a.value} ${a.unit} ${a.description}`))}` : ''}.`,
  },
  {
    key: 'landscape_material_cy_from_area_depth',
    name: 'Landscape material volume',
    trade: 'landscaping',
    applicableScopeKeys: ['rock_mulch', 'aggregate_base', 'topsoil'],
    outputMeasurementType: 'excavation_volume',
    outputUnit: 'cy',
    requiredInputs: [input('areaSqft', 'coverage area', 'sqft', ['rockMulchSqft', 'landscapeSqft'])],
    optionalInputs: [assumptionInput('depthInches', 'material depth', 'in', 'rock_mulch_depth_inches', false)],
    defaultAssumptionKeys: ['rock_mulch_depth_inches'],
    calculate: ({ areaSqft, depthInches }) => {
      const exactValue = areaSqft * (depthInches / 12) / 27;
      return {
        exactValue,
        trace: [`${areaSqft} sqft × ${depthInches} in ÷ 12 ÷ 27`],
        rangeFromAssumptions: (assumptions) => {
          const d = assumptions.rock_mulch_depth_inches;
          return d?.low != null && d.high != null
            ? { low: areaSqft * (d.low / 12) / 27, high: areaSqft * (d.high / 12) / 27 }
            : null;
        },
      };
    },
    rounding: 'cy',
    explanation: ({ roundedValue, inputs, assumptions }) =>
      `Calculated ${roundedValue.toLocaleString()} CY from ${inputs[0]?.value.toLocaleString()} sqft coverage at ${assumptions[0]?.value ?? ''} in depth.`,
  },
  {
    key: 'roofing_squares_from_roof_area',
    name: 'Roofing squares from roof area',
    trade: 'roofing',
    applicableScopeKeys: ['shingles_roofing', 'tear_off', 'roof_tie_in'],
    outputMeasurementType: 'roof_area',
    outputUnit: 'squares',
    requiredInputs: [input('roofSquares', 'roof squares', 'squares', ['roofSquares'])],
    calculate: ({ roofSquares }) => ({
      exactValue: roofSquares,
      trace: [`${roofSquares} roofing squares from confirmed roof measurement`],
    }),
    rounding: 'squares',
    explanation: ({ roundedValue }) => `Using ${roundedValue.toLocaleString()} roofing squares from confirmed roof measurement.`,
  },
  {
    key: 'baseboard_lf_from_perimeter',
    name: 'Linear trim from perimeter',
    trade: 'finish_carpentry',
    applicableScopeKeys: ['trim', 'baseboard', 'interior_trim'],
    outputMeasurementType: 'linear_length',
    outputUnit: 'lf',
    requiredInputs: [input('perimeterLf', 'perimeter/baseboard LF', 'lf', ['baseboardLf'])],
    calculate: ({ perimeterLf }) => ({
      exactValue: perimeterLf,
      trace: [`${perimeterLf} LF confirmed perimeter/trim length`],
    }),
    rounding: 'lf',
    explanation: ({ roundedValue }) => `Using ${roundedValue.toLocaleString()} LF from confirmed perimeter/trim measurement.`,
  },
  {
    key: 'countertop_area_from_cabinet_lf',
    name: 'Countertop area from cabinet run',
    trade: 'countertops',
    applicableScopeKeys: ['countertops'],
    outputMeasurementType: 'countertop_area',
    outputUnit: 'sqft',
    requiredInputs: [input('cabinetLf', 'counter-bearing cabinet run', 'lf', ['cabinetLf'])],
    optionalInputs: [assumptionInput('countertopDepthFt', 'countertop depth', 'ft', 'countertop_depth_ft', false)],
    defaultAssumptionKeys: ['countertop_depth_ft'],
    calculate: ({ cabinetLf, countertopDepthFt }) => {
      const exactValue = cabinetLf * countertopDepthFt;
      return {
        exactValue,
        trace: [`${cabinetLf} LF counter-bearing cabinet run × ${countertopDepthFt} ft countertop depth`],
        rangeFromAssumptions: (assumptions) => {
          const d = assumptions.countertop_depth_ft;
          return d?.low != null && d.high != null
            ? { low: cabinetLf * d.low, high: cabinetLf * d.high }
            : null;
        },
      };
    },
    rounding: 'sqft',
    explanation: ({ roundedValue, inputs, assumptions }) =>
      `Calculated ${roundedValue.toLocaleString()} sqft from ${inputs[0]?.value.toLocaleString()} LF counter-bearing cabinet run at ${assumptions[0]?.value ?? ''} ft depth. Use only for topped base runs — not whole-home cabinet LF.`,
  },
  {
    key: 'post_count_from_length_spacing',
    name: 'Post count from linear length',
    trade: 'fencing',
    applicableScopeKeys: ['fencing', 'railing'],
    outputMeasurementType: 'fixture_count',
    outputUnit: 'each',
    requiredInputs: [input('lengthLf', 'total length', 'lf', ['railingLf', 'baseboardLf'])],
    optionalInputs: [assumptionInput('spacingFt', 'post spacing', 'ft', 'post_spacing_ft', false)],
    defaultAssumptionKeys: ['post_spacing_ft'],
    calculate: ({ lengthLf, spacingFt }) => ({
      exactValue: Math.ceil(lengthLf / spacingFt) + 1,
      trace: [`ceil(${lengthLf} LF ÷ ${spacingFt} ft spacing) + 1 end post`],
    }),
    rounding: 'each',
    explanation: ({ roundedValue, inputs, assumptions }) =>
      `Calculated ${roundedValue.toLocaleString()} posts from ${inputs[0]?.value.toLocaleString()} LF at ${assumptions[0]?.value ?? ''} ft spacing.`,
  },
];

export function getFormulaDefinitionsForScope(scopeKey: string, projectContext?: string | null): FormulaDefinition[] {
  void projectContext;
  return FORMULAS.filter((formula) => formula.applicableScopeKeys.includes(scopeKey));
}

function resolveInputs(
  formula: FormulaDefinition,
  measurements: NormalizedScopeMeasurements | null | undefined,
  providedInputs: Record<string, number> = {},
  context: FormulaContext = {}
) {
  const inputDefs = [...formula.requiredInputs, ...(formula.optionalInputs || [])];
  const inputs: Record<string, number> = {};
  const inputsUsed: FormulaInputUsed[] = [];
  const assumptionsUsed: FormulaAssumptionUsed[] = [];
  const missingInputs: FormulaCalculationResult['missingInputs'] = [];

  for (const def of inputDefs) {
    const provided = n(providedInputs[def.key]);
    const measured = provided ?? valueFromMeasurements(def, measurements);
    if (measured != null) {
      inputs[def.key] = measured;
      inputsUsed.push({
        key: def.key,
        label: def.label,
        value: measured,
        unit: def.unit,
        source: provided != null ? 'provided' : 'measurement',
      });
      continue;
    }

    const assumption = def.assumptionKey ? ASSUMPTIONS[def.assumptionKey] : null;
    if (assumption && assumption.mayUseAutomatically && (!context.scopeKey || assumption.applicableScopes.includes(context.scopeKey))) {
      inputs[def.key] = assumption.defaultValue;
      const used: FormulaAssumptionUsed = {
        key: assumption.key,
        description: assumption.description,
        value: assumption.defaultValue,
        unit: assumption.unit,
        low: assumption.low,
        high: assumption.high,
      };
      assumptionsUsed.push(used);
      inputsUsed.push({
        key: def.key,
        label: def.label,
        value: assumption.defaultValue,
        unit: assumption.unit,
        source: 'assumption',
      });
      continue;
    }

    if (def.required !== false) {
      missingInputs.push({ type: def.key, label: def.label });
    }
  }

  return { inputs, inputsUsed, assumptionsUsed, missingInputs };
}

export function executeFormula(
  formulaKey: string,
  providedInputs: Record<string, number>,
  context: FormulaContext = {}
): FormulaCalculationResult | null {
  const formula = FORMULAS.find((f) => f.key === formulaKey);
  if (!formula) return null;
  return calculateFormula(formula, null, providedInputs, context);
}

function calculateFormula(
  formula: FormulaDefinition,
  measurements: NormalizedScopeMeasurements | null | undefined,
  providedInputs: Record<string, number> = {},
  context: FormulaContext = {}
): FormulaCalculationResult | null {
  const resolved = resolveInputs(formula, measurements, providedInputs, { ...context, scopeKey: context.scopeKey });
  if (resolved.missingInputs.length) {
    return {
      formulaKey: formula.key,
      formulaName: formula.name,
      value: 0,
      unit: formula.outputUnit,
      exactValue: 0,
      roundedValue: 0,
      inputsUsed: resolved.inputsUsed,
      assumptionsUsed: resolved.assumptionsUsed,
      missingInputs: resolved.missingInputs,
      confidence: 'low',
      formulaExplanation: `Missing ${resolved.missingInputs.map((m) => m.label).join(', ')}.`,
      validationNotices: resolved.missingInputs.map((missing) => ({
        ruleKey: 'formula_missing_input',
        severity: 'review',
        message: `Formula needs ${missing.label}.`,
      })),
      trace: [],
    };
  }

  const assumptions = Object.fromEntries(resolved.assumptionsUsed.map((a) => [a.key, a]));
  const raw = formula.calculate(resolved.inputs, { assumptions, context });
  const notices: FormulaCalculationResult['validationNotices'] = [];
  if (!Number.isFinite(raw.exactValue) || raw.exactValue <= 0) {
    notices.push({ ruleKey: 'formula_invalid_result', severity: 'warning', message: 'Formula result was not usable.' });
    return null;
  }
  const roundedValue = round(raw.exactValue, formula.rounding);
  const range = raw.rangeFromAssumptions?.(assumptions) || undefined;
  const expectedRange = range
    ? { low: round(range.low, formula.rounding), high: round(range.high, formula.rounding) }
    : undefined;
  const resultForExplanation = {
    roundedValue,
    unit: formula.outputUnit,
    inputs: resolved.inputsUsed,
    assumptions: resolved.assumptionsUsed,
  };
  return {
    formulaKey: formula.key,
    formulaName: formula.name,
    value: roundedValue,
    unit: formula.outputUnit,
    exactValue: raw.exactValue,
    roundedValue,
    expectedRange,
    inputsUsed: resolved.inputsUsed,
    assumptionsUsed: resolved.assumptionsUsed,
    missingInputs: [],
    confidence: confidenceFor(resolved.assumptionsUsed, 0),
    formulaExplanation: formula.explanation(resultForExplanation),
    validationNotices: notices,
    trace: raw.trace,
  };
}

/**
 * Ground-up cabinet LF is usually whole-home (kitchen + baths + laundry), not
 * counter-bearing base run. LF × 25" depth overstates tops (e.g. 120 LF → 250 SF).
 * Keep the ~80 SF planning basis instead; kitchen remodels can still use the formula.
 */
export function shouldSkipCountertopCabinetLfFormula(projectContext?: string | null): boolean {
  return String(projectContext || '').toLowerCase() === 'ground_up';
}

export function calculateFormulaForScope(params: {
  scopeKey: string;
  measurements: NormalizedScopeMeasurements;
  projectContext?: string | null;
  materialType?: string | null;
}): FormulaCalculationResult | null {
  const formulas = getFormulaDefinitionsForScope(params.scopeKey, params.projectContext);
  for (const formula of formulas) {
    if (
      formula.key === 'countertop_area_from_cabinet_lf' &&
      shouldSkipCountertopCabinetLfFormula(params.projectContext)
    ) {
      continue;
    }
    const result = calculateFormula(formula, params.measurements, {}, {
      scopeKey: params.scopeKey,
      projectContext: params.projectContext,
      materialType: params.materialType,
    });
    if (result && result.missingInputs.length === 0 && result.value > 0) {
      return result;
    }
  }
  return null;
}

export function getMissingFormulaInputs(scopeKey: string): Array<{ type: string; label: string }> {
  const formula = getFormulaDefinitionsForScope(scopeKey)[0];
  if (!formula) return [];
  return formula.requiredInputs.map((inputDef) => ({ type: inputDef.key, label: inputDef.label }));
}

export function getAssumptionsForScope(scopeKey: string): FormulaAssumption[] {
  return Object.values(ASSUMPTIONS).filter((assumption) => assumption.applicableScopes.includes(scopeKey));
}

export type FormulaQuantityApplyTarget = {
  quantity: number;
  unit: string;
  buttonLabel: string;
  accessibilityLabel: string;
};

/**
 * Flatwork slab formulas output CY volume, but national-average slab pricing uses $/sqft.
 * Apply the measured slab sqft to pricing instead of the converted CY so totals stay correct.
 */
const FLATWORK_SQFT_PRICING_SCOPE_KEYS = new Set([
  'concrete',
  'pour_flatwork',
  'sidewalk',
  'patio',
  'driveway',
]);

export function usesAutoFlatworkSqftPricing(params: {
  scopeKey: string;
  formula: Pick<FormulaCalculationResult, 'formulaKey' | 'inputsUsed'>;
}): boolean {
  if (params.formula.formulaKey !== 'flatwork_cy_from_area_thickness') return false;
  if (!FLATWORK_SQFT_PRICING_SCOPE_KEYS.has(params.scopeKey)) return false;
  const areaInput = params.formula.inputsUsed.find((entry) => entry.key === 'areaSqft' && entry.value > 0);
  return Boolean(areaInput && getNationalAverageBudgetSplit(params.scopeKey, 'sqft'));
}

export function shouldShowFormulaQuantityButton(params: {
  scopeKey: string;
  formula: Pick<FormulaCalculationResult, 'formulaKey' | 'inputsUsed'>;
  projectContext?: string | null;
}): boolean {
  if (usesAutoFlatworkSqftPricing(params)) return false;
  if (
    params.formula.formulaKey === 'countertop_area_from_cabinet_lf' &&
    shouldSkipCountertopCabinetLfFormula(params.projectContext)
  ) {
    return false;
  }
  // Installed paint budgets match living SF — paintable SF takeoff does not change price.
  if (
    (params.scopeKey === 'interior_paint' || params.scopeKey === 'paint') &&
    params.formula.formulaKey === 'paintable_area_from_floor_area_benchmark'
  ) {
    return false;
  }
  // Ground-up auto-replaces thin notes drywall SF with living×3.5 — no manual "Use calculated".
  if (
    (params.scopeKey === 'drywall' ||
      params.scopeKey === 'hang' ||
      params.scopeKey === 'finish_tape') &&
    params.formula.formulaKey === 'surface_area_from_floor_area_benchmark'
  ) {
    return false;
  }
  return true;
}

export function isFormulaQuantityApplyTargetActive(params: {
  scopeKey: string;
  formula: Pick<FormulaCalculationResult, 'formulaKey' | 'roundedValue' | 'unit' | 'inputsUsed'>;
  quantity: number | null | undefined;
  unit: string | null | undefined;
  source?: string | null;
}): boolean {
  if (params.source === 'calculated_confirmed') return true;
  const applyTarget = resolveFormulaQuantityApplyTarget({
    scopeKey: params.scopeKey,
    formula: params.formula,
  });
  const currentQuantity = Number(params.quantity);
  return (
    params.unit === applyTarget.unit &&
    Number.isFinite(currentQuantity) &&
    Math.abs(currentQuantity - applyTarget.quantity) < 0.01
  );
}

export function resolveFormulaQuantityApplyTarget(params: {
  scopeKey: string;
  formula: Pick<FormulaCalculationResult, 'formulaKey' | 'roundedValue' | 'unit' | 'inputsUsed'>;
}): FormulaQuantityApplyTarget {
  const { formula, scopeKey } = params;
  const qtyLabel = (value: number) => value.toLocaleString();

  if (formula.formulaKey === 'flatwork_cy_from_area_thickness') {
    const areaInput = formula.inputsUsed.find((entry) => entry.key === 'areaSqft' && entry.value > 0);
    if (areaInput && getNationalAverageBudgetSplit(scopeKey, 'sqft')) {
      const sqft = areaInput.value;
      const volumeCy = formula.roundedValue;
      return {
        quantity: sqft,
        unit: 'sqft',
        buttonLabel: `Use ${qtyLabel(sqft)} sqft slab area for pricing`,
        accessibilityLabel: `Use ${qtyLabel(sqft)} square feet of slab area for pricing. Volume cross-check is about ${qtyLabel(volumeCy)} cubic yards.`,
      };
    }
  }

  const unitLabel = formatUnitLabel(formula.unit);
  return {
    quantity: formula.roundedValue,
    unit: formula.unit,
    buttonLabel: `Use ${qtyLabel(formula.roundedValue)} ${unitLabel} calculated quantity`,
    accessibilityLabel: `Use calculated quantity of ${qtyLabel(formula.roundedValue)} ${unitLabel}`,
  };
}
