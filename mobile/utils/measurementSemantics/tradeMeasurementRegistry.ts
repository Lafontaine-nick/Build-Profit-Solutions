import type { MeasurementStatus, MeasurementUnit } from './types';

export type QuantityStrategy =
  | 'plan_explicit'
  | 'plan_geometry'
  | 'derived_formula'
  | 'count_from_plan'
  | 'installed_package'
  | 'allowance_required'
  | 'hybrid';

export type TradeMeasurementProfile = {
  scopeKey: string;
  preferredPrimaryUnits: MeasurementUnit[];
  allowedPricingUnits: MeasurementUnit[];
  allowedBenchmarkUnits: MeasurementUnit[];
  quantityStrategy: QuantityStrategy;
  canUseLivingSfAsPrimary: boolean;
  canUseLivingSfAsPricing: boolean;
  canUseLivingSfAsBenchmark: boolean;
  missingQuantityBehavior: MeasurementStatus;
  requiredInputs?: string[];
  optionalInputs?: string[];
};

const LIVING_BENCHMARK: MeasurementUnit[] = ['living_sqft'];
const SURFACE: MeasurementUnit[] = ['surface_sqft', 'sqft'];
const FLOOR: MeasurementUnit[] = ['floor_sqft', 'sqft'];
const ROOF: MeasurementUnit[] = ['roof_square', 'roof_sqft', 'sqft'];
const EA: MeasurementUnit[] = ['ea', 'fixture', 'opening'];
const LS: MeasurementUnit[] = ['ls', 'package'];

function profile(
  scopeKey: string,
  preferredPrimaryUnits: MeasurementUnit[],
  opts: Partial<TradeMeasurementProfile> = {}
): TradeMeasurementProfile {
  return {
    scopeKey,
    preferredPrimaryUnits,
    allowedPricingUnits: opts.allowedPricingUnits || [...preferredPrimaryUnits, 'ls', 'living_sqft'],
    allowedBenchmarkUnits: opts.allowedBenchmarkUnits || LIVING_BENCHMARK,
    quantityStrategy: opts.quantityStrategy || 'hybrid',
    canUseLivingSfAsPrimary: opts.canUseLivingSfAsPrimary ?? false,
    canUseLivingSfAsPricing: opts.canUseLivingSfAsPricing ?? true,
    canUseLivingSfAsBenchmark: opts.canUseLivingSfAsBenchmark ?? true,
    missingQuantityBehavior: opts.missingQuantityBehavior || 'needs_takeoff',
    requiredInputs: opts.requiredInputs,
    optionalInputs: opts.optionalInputs,
  };
}

/** Authoritative trade measurement semantics for ground-up / shell scopes. */
export const TRADE_MEASUREMENT_REGISTRY: Record<string, TradeMeasurementProfile> = {
  sitework: profile('sitework', ['sqft', 'cy', 'lf'], {
    missingQuantityBehavior: 'needs_takeoff',
    quantityStrategy: 'plan_geometry',
  }),
  excavation: profile('excavation', ['cy'], {
    allowedPricingUnits: ['cy', 'ls'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_takeoff',
  }),
  utility_trenching: profile('utility_trenching', ['lf'], {
    allowedPricingUnits: ['lf', 'cy', 'ls'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_takeoff',
  }),
  foundation: profile('foundation', ['floor_sqft', 'lf', 'cy', 'sqft'], {
    missingQuantityBehavior: 'needs_structural_takeoff',
    quantityStrategy: 'hybrid',
    requiredInputs: ['slab_sf', 'footing_lf', 'concrete_cy'],
  }),
  pour_flatwork: profile('pour_flatwork', ['sqft', 'floor_sqft'], {
    preferredPrimaryUnits: ['sqft'],
    allowedPricingUnits: ['sqft', 'ls'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_takeoff',
    quantityStrategy: 'plan_geometry',
    requiredInputs: ['exterior_flatwork_sf'],
  }),
  framing: profile('framing', ['package', 'ls', 'unknown'], {
    allowedPricingUnits: ['living_sqft', 'ls', 'package'],
    missingQuantityBehavior: 'needs_takeoff',
    quantityStrategy: 'installed_package',
  }),
  roofing: profile('roofing', ROOF, {
    missingQuantityBehavior: 'needs_takeoff',
    quantityStrategy: 'plan_geometry',
  }),
  exterior: profile('exterior', SURFACE, {
    preferredPrimaryUnits: ['surface_sqft', 'sqft'],
    missingQuantityBehavior: 'needs_takeoff',
  }),
  exterior_finishes: profile('exterior_finishes', SURFACE, {
    missingQuantityBehavior: 'needs_takeoff',
  }),
  stucco: profile('stucco', SURFACE, {
    preferredPrimaryUnits: ['surface_sqft', 'sqft'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_takeoff',
    quantityStrategy: 'derived_formula',
  }),
  windows_doors: profile('windows_doors', ['ea', 'ls'], {
    preferredPrimaryUnits: ['ea'],
    allowedPricingUnits: ['ea', 'living_sqft', 'ls'],
    canUseLivingSfAsPricing: true,
    missingQuantityBehavior: 'needs_count',
    quantityStrategy: 'count_from_plan',
  }),
  mep_rough: profile('mep_rough', ['ea', 'fixture', 'ls'], {
    allowedPricingUnits: ['living_sqft', 'ls', 'ea', 'fixture'],
    missingQuantityBehavior: 'needs_count',
    quantityStrategy: 'count_from_plan',
  }),
  plumbing_rough: profile('plumbing_rough', ['ea', 'fixture', 'ls'], {
    preferredPrimaryUnits: ['ea', 'fixture'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_count',
    quantityStrategy: 'count_from_plan',
  }),
  electrical_rough: profile('electrical_rough', ['ea', 'ls'], {
    preferredPrimaryUnits: ['ea'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_count',
    quantityStrategy: 'count_from_plan',
  }),
  insulation: profile('insulation', SURFACE, {
    missingQuantityBehavior: 'needs_takeoff',
    quantityStrategy: 'derived_formula',
  }),
  drywall: profile('drywall', SURFACE, {
    missingQuantityBehavior: 'needs_takeoff',
    quantityStrategy: 'derived_formula',
  }),
  paint_trim: profile('paint_trim', ['surface_sqft', 'lf', 'sqft'], {
    missingQuantityBehavior: 'needs_takeoff',
  }),
  paint: profile('paint', SURFACE, { missingQuantityBehavior: 'needs_takeoff' }),
  trim: profile('trim', ['lf'], {
    allowedPricingUnits: ['lf', 'ls'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_takeoff',
  }),
  cabinets_counters: profile('cabinets_counters', ['lf', 'ea', 'ls'], {
    allowedPricingUnits: ['lf', 'ea', 'ls', 'sqft'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_allowance',
  }),
  cabinets: profile('cabinets', ['lf', 'ea', 'ls'], {
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_takeoff',
  }),
  countertops: profile('countertops', FLOOR, {
    preferredPrimaryUnits: ['sqft'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_takeoff',
  }),
  tile_flooring: profile('tile_flooring', FLOOR, {
    missingQuantityBehavior: 'needs_takeoff',
  }),
  flooring: profile('flooring', FLOOR, { missingQuantityBehavior: 'needs_takeoff' }),
  floor_tile: profile('floor_tile', FLOOR, {
    preferredPrimaryUnits: ['floor_sqft', 'sqft'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_takeoff',
  }),
  shower_tile: profile('shower_tile', SURFACE, {
    preferredPrimaryUnits: ['sqft', 'surface_sqft'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_takeoff',
  }),
  shower_floor_tile: profile('shower_floor_tile', FLOOR, {
    preferredPrimaryUnits: ['sqft', 'floor_sqft'],
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'needs_takeoff',
  }),
  appliances: profile('appliances', EA, {
    allowedPricingUnits: ['ea', 'ls'],
    canUseLivingSfAsPricing: false,
    canUseLivingSfAsBenchmark: false,
    missingQuantityBehavior: 'needs_count',
  }),
  hvac: profile('hvac', ['ton', 'ea', 'ls'], {
    allowedPricingUnits: ['ton', 'ea', 'ls'],
    missingQuantityBehavior: 'needs_count',
    quantityStrategy: 'installed_package',
  }),
  cleanup: profile('cleanup', LS, {
    allowedBenchmarkUnits: LIVING_BENCHMARK,
    missingQuantityBehavior: 'needs_allowance',
    quantityStrategy: 'allowance_required',
  }),
  interior_finishes: profile('interior_finishes', LS, {
    allowedBenchmarkUnits: LIVING_BENCHMARK,
    canUseLivingSfAsBenchmark: true,
    canUseLivingSfAsPrimary: false,
    canUseLivingSfAsPricing: false,
    missingQuantityBehavior: 'benchmark_only',
    quantityStrategy: 'allowance_required',
  }),
  plans_engineering: profile('plans_engineering', LS, {
    missingQuantityBehavior: 'needs_allowance',
    quantityStrategy: 'allowance_required',
  }),
  permits: profile('permits', LS, {
    missingQuantityBehavior: 'needs_allowance',
    quantityStrategy: 'allowance_required',
  }),
};

export function getTradeMeasurementProfile(scopeKey: string): TradeMeasurementProfile | null {
  return TRADE_MEASUREMENT_REGISTRY[scopeKey] || null;
}

export function livingSfAllowedAsPrimary(scopeKey: string): boolean {
  return getTradeMeasurementProfile(scopeKey)?.canUseLivingSfAsPrimary === true;
}

export function missingStatusForScope(scopeKey: string): MeasurementStatus {
  return getTradeMeasurementProfile(scopeKey)?.missingQuantityBehavior || 'needs_takeoff';
}

export function preferredPrimaryUnit(scopeKey: string): MeasurementUnit {
  const profileEntry = getTradeMeasurementProfile(scopeKey);
  return profileEntry?.preferredPrimaryUnits[0] || 'unknown';
}

/** Scopes that must never receive living SF as primary takeoff under measurement semantics. */
export const NO_LIVING_SF_PRIMARY_SEED_KEYS = new Set([
  'sitework',
  'excavation',
  'foundation',
  'pour_flatwork',
  'framing',
  'roofing',
  'exterior',
  'exterior_finishes',
  'stucco',
  'mep_rough',
  'plumbing_rough',
  'electrical_rough',
  'insulation',
  'drywall',
  'paint',
  'paint_trim',
  'trim',
  'interior_trim',
  'hvac',
  'windows_doors',
  'cabinets',
  'cabinets_counters',
  'countertops',
  'tile',
  'tile_flooring',
  'flooring',
  'floor_tile',
  'shower_tile',
  'shower_floor_tile',
  'appliances',
]);
