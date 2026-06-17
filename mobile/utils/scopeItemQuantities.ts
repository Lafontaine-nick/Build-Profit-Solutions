/**
 * Client-side mirror of bathroom checklist quantity rules for Confirm Scope UI.
 * Backend source of truth: backend/src/services/scopeItemQuantityCatalog.js
 */

import type { EstimateAiDraft, ScopeMeasurements } from '@/utils/estimateAiDraft';
import { resolveDraftScopeNotes } from '@/utils/estimateAiDraft';
import { parseScopeMeasurementInput } from '@/utils/scopeMeasurements';
import { parseScopeItemAllowancesFromNotes } from '@/utils/scopeAllowanceParser';
import {
  clearStalePricingWhenNotesUnpriced,
  parseScopeMeasurementsFromNotes,
} from '@/utils/scopeMeasurementParser';
import {
  getRatePricingMatcher,
  parseScopeItemRatePricingFromNotes,
  resolveItemRatePricingFromNotes,
} from '@/utils/scopeRatePricingParser';
import {
  emptyQuickMeasurementInput,
  type QuickMeasurementFieldKey,
} from '@/utils/scopeQuickMeasurements';

export type QuantitySource =
  | 'notes'
  | 'user_entered'
  | 'inferred'
  | 'default_assumption'
  | 'missing'
  | 'not_applicable';

export type ScopeItemQuantityRule = {
  defaultUnit: string;
  allowedUnits: string[];
  measurementKey?: keyof NormalizedScopeMeasurements;
  measurementKeys?: Array<keyof NormalizedScopeMeasurements>;
  aggregateMeasurementKeys?: Array<keyof NormalizedScopeMeasurements>;
  choiceIds?: string[];
  canUseRoomSqft?: boolean;
  requiresUserQuantity?: boolean;
  /** Separate count + dollar allowance inputs (plumbing/electrical rough-in). */
  dualAllowanceField?: boolean;
  defaultQuantity?: number;
  quantityHelper?: string;
  missingMessage?: string;
};

export const DUAL_ALLOWANCE_ITEM_IDS = ['plumbing_rough', 'electrical_rough'] as const;

export function roughAllowanceSubKey(itemId: string): string {
  return `${itemId}__allowance`;
}

export function isDualAllowanceItem(itemId: string): boolean {
  return Boolean(CHECKLIST_ITEM_QUANTITY_RULES[itemId]?.dualAllowanceField);
}

export const DUAL_QUANTITY_FIELD_LABELS: Record<
  string,
  { count: string; countUnit: string; allowance: string }
> = {
  plumbing_rough: {
    count: 'Rough-in points',
    countUnit: 'points',
    allowance: 'Allowance ($)',
  },
  electrical_rough: {
    count: 'Circuits / devices / boxes',
    countUnit: 'each',
    allowance: 'Allowance ($)',
  },
  backsplash: {
    count: 'Tile area',
    countUnit: 'sqft',
    allowance: 'Calculated total ($)',
  },
  paint: {
    count: 'Paint area',
    countUnit: 'sqft',
    allowance: 'Calculated total ($)',
  },
  shower_tile: {
    count: 'Shower wall tile area',
    countUnit: 'sqft',
    allowance: 'Calculated total ($)',
  },
  flooring: {
    count: 'Flooring area',
    countUnit: 'sqft',
    allowance: 'Calculated total ($)',
  },
};

export type NormalizedScopeMeasurements = {
  bathroomFloorSqft: number | null;
  kitchenFloorSqft: number | null;
  floorAreaSqft: number | null;
  backsplashSqft: number | null;
  countertopSqft: number | null;
  cabinetLf: number | null;
  landscapeSqft: number | null;
  sodSqft: number | null;
  paverSqft: number | null;
  rockMulchSqft: number | null;
  landscapeTons: number | null;
  roofSquares: number | null;
  drywallSqft: number | null;
  concreteSqft: number | null;
  concreteCy: number | null;
  excavationCy: number | null;
  deckSqft: number | null;
  exteriorPaintSqft: number | null;
  railingLf: number | null;
  baseboardLf: number | null;
  showerWallTileSqft: number | null;
  showerFloorTileSqft: number | null;
  wallPaintSqft: number | null;
  itemQuantities: Record<string, ScopeItemQuantityValue>;
};

export type ScopeItemQuantityValue = {
  quantity: number | null;
  unit: string;
  quantitySource?: QuantitySource;
  /** Cabinets allowance line in notes also covered countertops. */
  includesCountertops?: boolean;
};

export type ResolvedItemQuantity = {
  quantity: number | null;
  unit: string;
  quantitySource: QuantitySource;
  sourceLabel: string;
  pricingReady: boolean;
  quantityHelper?: string;
  missingMessage?: string;
  showInput: boolean;
  dualCount?: { quantity: number; unit: string } | null;
  dualMaterial?: { quantity: number; unit: string } | null;
  dualLabor?: { quantity: number; unit: string } | null;
  dualAllowance?: { quantity: number; unit: string } | null;
  /** Parent line shows the single combined $; child line is confirm-only. */
  combinedAllowanceRole?: 'combined_total' | 'included_in_combined';
  combinedAllowanceTotal?: number;
};

export type SuggestedBudgetSplitDisplay = {
  material: number;
  labor: number;
  total: number;
  sourceLabel: string;
  helper: string;
  mode: 'note_total_split' | 'suggested_price';
  basis?: { quantity: number; unit: string } | null;
};

const NATIONAL_AVERAGE_BUDGET_SPLITS: Record<
  string,
  { unit: string; material: number; labor: number; sourceLabel: string }
> = {
  trim: { unit: 'lf', material: 2, labor: 5, sourceLabel: 'Suggested budget split · National Average' },
  flooring: { unit: 'sqft', material: 4, labor: 5, sourceLabel: 'Suggested budget split · National Average' },
  floor_demo: { unit: 'sqft', material: 0.5, labor: 5, sourceLabel: 'Suggested budget split · National Average' },
  demo: { unit: 'sqft', material: 0.5, labor: 5, sourceLabel: 'Suggested budget split · National Average' },
  backsplash: { unit: 'sqft', material: 8, labor: 14, sourceLabel: 'Suggested budget split · National Average' },
  paint: { unit: 'sqft', material: 0.85, labor: 2.5, sourceLabel: 'Suggested budget split · National Average' },
  interior_paint: { unit: 'sqft', material: 0.85, labor: 2.5, sourceLabel: 'Suggested budget split · National Average' },
  exterior_paint: { unit: 'sqft', material: 0.85, labor: 2.5, sourceLabel: 'Suggested budget split · National Average' },
  shower_tile: { unit: 'sqft', material: 8, labor: 14, sourceLabel: 'Suggested budget split · National Average' },
  floor_tile: { unit: 'sqft', material: 8, labor: 14, sourceLabel: 'Suggested budget split · National Average' },
  floor_prep: { unit: 'sqft', material: 4, labor: 5, sourceLabel: 'Suggested budget split · National Average' },
  waterproofing: { unit: 'sqft', material: 5, labor: 7, sourceLabel: 'Suggested budget split · National Average' },
  railing: { unit: 'lf', material: 15, labor: 25, sourceLabel: 'Suggested budget split · National Average' },
  pour_flatwork: { unit: 'sqft', material: 4, labor: 6, sourceLabel: 'Suggested budget split · National Average' },
  concrete: { unit: 'sqft', material: 4, labor: 6, sourceLabel: 'Suggested budget split · National Average' },
  drywall: { unit: 'sqft', material: 1.5, labor: 3, sourceLabel: 'Suggested budget split · National Average' },
  decking: { unit: 'sqft', material: 8, labor: 12, sourceLabel: 'Suggested budget split · National Average' },
  countertops: { unit: 'sqft', material: 35, labor: 25, sourceLabel: 'Suggested budget split · National Average' },
  cabinets: { unit: 'lf', material: 150, labor: 75, sourceLabel: 'Suggested budget split · National Average' },
  shingles_roofing: { unit: 'squares', material: 350, labor: 450, sourceLabel: 'Suggested budget split · National Average' },
  tear_off: { unit: 'squares', material: 50, labor: 200, sourceLabel: 'Suggested budget split · National Average' },
  pavers: { unit: 'sqft', material: 6, labor: 8, sourceLabel: 'Suggested budget split · National Average' },
};

const NATIONAL_AVERAGE_BUDGET_SPLIT_ALIASES: Record<string, string> = {
  hang: 'drywall',
  finish_tape: 'drywall',
  patch_repair: 'drywall',
};

export function getNationalAverageBudgetSplit(itemId: string) {
  return (
    NATIONAL_AVERAGE_BUDGET_SPLITS[itemId] ??
    NATIONAL_AVERAGE_BUDGET_SPLITS[NATIONAL_AVERAGE_BUDGET_SPLIT_ALIASES[itemId] || '']
  );
}

export function computeNationalAverageBudgetSplit(
  itemId: string,
  total: number,
  count: number
): { material: number; labor: number } | null {
  const average = getNationalAverageBudgetSplit(itemId);
  if (!average || !Number.isFinite(count) || count <= 0 || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  const material = Math.min(total, Math.round(count * average.material * 100) / 100);
  const labor = Math.max(0, Math.round((total - material) * 100) / 100);
  if (material <= 0 || labor <= 0) return null;
  return { material, labor };
}

export const CHECKLIST_ITEM_QUANTITY_RULES: Record<string, ScopeItemQuantityRule> = {
  demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    aggregateMeasurementKeys: ['bathroomFloorSqft', 'showerWallTileSqft', 'showerFloorTileSqft'],
    canUseRoomSqft: true,
    quantityHelper: 'Sums bathroom floor + shower walls + shower floor for full tear-out.',
  },
  floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['bathroomFloorSqft', 'showerFloorTileSqft', 'kitchenFloorSqft', 'floorAreaSqft'],
    canUseRoomSqft: true,
    quantityHelper: 'Uses bathroom floor sqft for floor removal.',
  },
  tub_demo: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 tub removal. Edit if multiple.',
  },
  shower_floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerFloorTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter shower pan / shower floor demo sqft.',
    missingMessage: 'Enter shower floor demo sqft.',
  },
  shower_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerWallTileSqft',
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper: 'Enter shower wall tile sqft — not bathroom floor sqft.',
    missingMessage: 'Enter shower wall tile sqft.',
  },
  waterproofing: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerWallTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Usually same as shower wall tile sqft.',
    missingMessage: 'Enter shower waterproofing sqft.',
  },
  floor_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'bathroomFloorSqft',
    canUseRoomSqft: true,
    quantityHelper: 'Uses bathroom floor sqft.',
  },
  shower_pan: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Mud pan build — labor + materials (1 shower).',
  },
  wet_area_install: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Pick install type above — labor + materials show on the line below.',
  },
  tub_install: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 tub install (labor + materials).',
  },
  prefab_shower_pan: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 prefab pan install (labor + materials).',
  },
  shower_floor_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerFloorTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter shower floor tile sqft — not bathroom floor sqft.',
    missingMessage: 'Enter shower floor tile sqft.',
  },
  shower_niche: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 niche. Edit count if different.',
  },
  shower_bench_curb: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lf'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 bench/curb — or enter linear feet.',
  },
  tub_shower: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'each'],
    measurementKey: 'showerWallTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter shower wall tile sqft if replacing tile.',
    missingMessage: 'Enter shower area sqft.',
  },
  vanity: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 vanity. Edit if different.',
  },
  toilet: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 toilet. Edit if different.',
  },
  plumbing_rough: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Rough-in points = supply/drain relocations. Fixture hookup is on Toilet, Vanity, or Plumbing trim.',
    missingMessage: 'Enter rough-in points and/or a dollar allowance.',
  },
  electrical_rough: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum', 'hr'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    quantityHelper:
      'Circuits, boxes, or devices affected. Device trim and plates are on Electrical trim.',
    missingMessage: 'Enter circuit/device count and/or a dollar allowance.',
  },
  lighting: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 light fixture. Edit count if different.',
  },
  exhaust_fan: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 bath fan. Edit if different.',
  },
  mirror_accessories: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 accessories allowance.',
  },
  floor_prep: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'bathroomFloorSqft',
    canUseRoomSqft: true,
    quantityHelper: 'Uses bathroom floor sqft or enter allowance.',
  },
  drywall: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter patch/repair sqft or lump sum.',
    missingMessage: 'Enter drywall repair sqft.',
  },
  paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'wallPaintSqft',
    dualAllowanceField: true,
    requiresUserQuantity: true,
    quantityHelper: 'Enter paint sqft and/or calculated total from notes rates.',
    missingMessage: 'Enter wall/ceiling paint sqft.',
  },
  trim: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'baseboardLf',
    requiresUserQuantity: true,
    quantityHelper: 'Linear feet around bathroom perimeter.',
    missingMessage: 'Enter baseboard LF.',
  },
  glass_door: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 shower door.',
  },
  plumbing_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 plumbing trim allowance.',
  },
  electrical_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 electrical trim allowance.',
  },
  permits: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 permit allowance.',
  },
  cleanup: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 cleanup/disposal lump sum.',
  },
  appliance_removal: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lump_sum', 'allowance'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 appliance set to remove. Edit count if multiple.',
  },
  appliances: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter appliance count or allowance from notes.',
    missingMessage: 'Enter appliance count or allowance.',
  },
  cabinets: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'each', 'allowance', 'lump_sum'],
    measurementKey: 'cabinetLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter cabinet run LF or lump sum.',
    missingMessage: 'Enter cabinet LF or allowance.',
  },
  countertops: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'allowance', 'lump_sum'],
    measurementKey: 'countertopSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter countertop sqft.',
    missingMessage: 'Enter countertop sqft.',
  },
  backsplash: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'allowance'],
    measurementKey: 'backsplashSqft',
    dualAllowanceField: true,
    requiresUserQuantity: true,
    quantityHelper: 'Enter backsplash sqft and/or calculated total from notes.',
    missingMessage: 'Enter backsplash sqft.',
  },
  flooring: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['floorAreaSqft', 'kitchenFloorSqft', 'bathroomFloorSqft'],
    dualAllowanceField: true,
    requiresUserQuantity: true,
    quantityHelper: 'Enter kitchen or room floor sqft.',
    missingMessage: 'Enter floor sqft.',
  },
  sod_turf: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['sodSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter sod/turf sqft.',
    missingMessage: 'Enter sod/turf sqft.',
  },
  pavers: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['paverSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter paver sqft.',
    missingMessage: 'Enter paver sqft.',
  },
  rock_mulch: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'ton', 'allowance', 'lump_sum'],
    measurementKeys: ['rockMulchSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter coverage sqft, CY, or tons.',
    missingMessage: 'Enter rock/mulch quantity.',
  },
  tear_off: {
    defaultUnit: 'squares',
    allowedUnits: ['squares', 'sqft', 'lump_sum'],
    measurementKey: 'roofSquares',
    requiresUserQuantity: true,
    quantityHelper: 'Enter roof squares.',
    missingMessage: 'Enter roof squares.',
  },
  shingles_roofing: {
    defaultUnit: 'squares',
    allowedUnits: ['squares', 'sqft', 'lump_sum'],
    measurementKey: 'roofSquares',
    requiresUserQuantity: true,
    quantityHelper: 'Enter roof squares.',
    missingMessage: 'Enter roof squares.',
  },
  decking: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'allowance', 'lump_sum'],
    measurementKey: 'deckSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter deck surface sqft or LF.',
    missingMessage: 'Enter deck sqft or LF.',
  },
  railing: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'railingLf',
    requiresUserQuantity: true,
    quantityHelper: 'Enter railing linear feet.',
    missingMessage: 'Enter railing LF.',
  },
  pour_flatwork: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'allowance', 'lump_sum'],
    measurementKeys: ['concreteSqft', 'concreteCy'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter concrete sqft or CY.',
    missingMessage: 'Enter concrete quantity.',
  },
  hang: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter drywall hang sqft.',
    missingMessage: 'Enter drywall sqft.',
  },
  finish_tape: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter drywall finish sqft.',
    missingMessage: 'Enter drywall sqft.',
  },
  patch_repair: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter patch/repair sqft.',
    missingMessage: 'Enter drywall repair sqft.',
  },
  interior_paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'wallPaintSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter interior paint sqft.',
    missingMessage: 'Enter paint sqft.',
  },
  exterior_paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'exteriorPaintSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter exterior paint sqft.',
    missingMessage: 'Enter exterior paint sqft.',
  },
  excavation: {
    defaultUnit: 'cy',
    allowedUnits: ['cy', 'sqft', 'lf', 'allowance', 'lump_sum'],
    measurementKey: 'excavationCy',
    requiresUserQuantity: true,
    quantityHelper: 'Enter excavation CY or lump sum.',
    missingMessage: 'Enter excavation quantity.',
  },
};

function sourceLabel(source: QuantitySource): string {
  switch (source) {
    case 'notes':
      return 'From notes';
    case 'user_entered':
      return 'Entered';
    case 'inferred':
      return 'From room measurement';
    case 'default_assumption':
      return 'Assumed';
    case 'missing':
      return 'Needs measurement';
    default:
      return '';
  }
}

export function normalizeScopeMeasurements(measurements?: ScopeMeasurements | null): NormalizedScopeMeasurements {
  const itemQuantities = { ...(measurements?.itemQuantities || {}) };
  const num = (v: unknown) => parseScopeMeasurementInput(String(v ?? ''));
  return {
    bathroomFloorSqft:
      num(measurements?.bathroomFloorSqft) ?? num(measurements?.sqft),
    kitchenFloorSqft: num(measurements?.kitchenFloorSqft),
    floorAreaSqft: num(measurements?.floorAreaSqft),
    backsplashSqft: num(measurements?.backsplashSqft),
    countertopSqft: num(measurements?.countertopSqft),
    cabinetLf: num(measurements?.cabinetLf),
    landscapeSqft: num(measurements?.landscapeSqft),
    sodSqft: num(measurements?.sodSqft),
    paverSqft: num(measurements?.paverSqft),
    rockMulchSqft: num(measurements?.rockMulchSqft),
    landscapeTons: num(measurements?.landscapeTons),
    roofSquares: num(measurements?.roofSquares),
    drywallSqft: num(measurements?.drywallSqft),
    concreteSqft: num(measurements?.concreteSqft),
    concreteCy: num(measurements?.concreteCy),
    excavationCy: num(measurements?.excavationCy),
    deckSqft: num(measurements?.deckSqft),
    exteriorPaintSqft: num(measurements?.exteriorPaintSqft),
    railingLf: num(measurements?.railingLf),
    baseboardLf:
      num(measurements?.baseboardLf) ?? num(measurements?.lf),
    showerWallTileSqft: num(measurements?.showerWallTileSqft),
    showerFloorTileSqft: num(measurements?.showerFloorTileSqft),
    wallPaintSqft: num(measurements?.wallPaintSqft),
    itemQuantities,
  };
}

export function formatUnitLabel(unit: string): string {
  if (unit === 'sqft') return 'sqft';
  if (unit === 'lf') return 'LF';
  if (unit === 'each') return 'each';
  if (unit === 'allowance') return 'allowance';
  if (unit === 'lump_sum') return 'lump sum';
  if (unit === 'hr') return 'hr';
  if (unit === 'squares') return 'squares';
  if (unit === 'cy') return 'CY';
  if (unit === 'ton') return 'tons';
  return unit;
}

function sumMeasurementKeys(
  measurements: NormalizedScopeMeasurements,
  keys: Array<keyof NormalizedScopeMeasurements>
): { quantity: number; parts: number } | null {
  let total = 0;
  let parts = 0;
  for (const key of keys) {
    const v = measurements[key];
    if (typeof v === 'number' && v > 0) {
      total += v;
      parts += 1;
    }
  }
  if (parts === 0) return null;
  return { quantity: total, parts };
}

function aggregatedMeasurementSourceLabel(parts: number): string {
  if (parts >= 3) return 'Floor + shower walls + shower floor';
  if (parts === 2) return 'Combined tear-out sqft';
  return 'From room measurement';
}

export function notesHaveCombinedCabinetsCounters(notes?: string | null): boolean {
  const n = String(notes || '').toLowerCase();
  return (
    /\b(cabinets?|cabinetry)\b/.test(n) && /\b(counters?|countertops?|quartz|granite)\b/.test(n)
  );
}

function parsedNotesItemQuantities(
  notes?: string | null,
  templateKey?: string | null
): Record<string, ScopeItemQuantityValue> {
  const text = String(notes || '').trim();
  if (!text) return {};
  const parsed = parseScopeMeasurementsFromNotes(text, { templateKey: templateKey ?? undefined });
  return (parsed.itemQuantities || {}) as Record<string, ScopeItemQuantityValue>;
}

function resolvedQuantityFromNotes(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  ctx: { templateKey?: string | null; notes?: string | null }
): ResolvedItemQuantity | null {
  const rule = getChecklistItemQuantityRule(itemId, ctx.templateKey);
  if (!rule || !ctx.notes) return null;

  const fromNotes = parsedNotesItemQuantities(ctx.notes, ctx.templateKey);
  const linkedCountertop = resolveLinkedCountertopAllowance(itemId, measurements, ctx.notes);
  if (linkedCountertop) return linkedCountertop;

  if (rule.dualAllowanceField) {
    let countEntry =
      rule.measurementKey && measurements[rule.measurementKey]
        ? {
            quantity: measurements[rule.measurementKey]!,
            unit: rule.defaultUnit,
            quantitySource: 'inferred' as const,
          }
        : null;
    const allowanceEntry = parseStoredItemQuantity(measurements, roughAllowanceSubKey(itemId));
    const { effectiveAllowance, materialEntry, laborEntry } = applyRatePricingBreakdown(
      itemId,
      measurements,
      ctx.notes,
      ctx.templateKey,
      countEntry,
      allowanceEntry,
      null
    );
    if (!countEntry && !effectiveAllowance) return null;
    const primary = countEntry || effectiveAllowance!;
    return {
      quantity: primary.quantity,
      unit: primary.unit,
      quantitySource: 'notes',
      sourceLabel: sourceLabel('notes'),
      pricingReady: true,
      quantityHelper: rule.quantityHelper,
      showInput: true,
      dualCount: countEntry,
      dualMaterial: materialEntry,
      dualLabor: laborEntry,
      dualAllowance: effectiveAllowance,
    };
  }

  const raw = fromNotes[itemId];
  if (!raw?.quantity || Number(raw.quantity) <= 0) return null;
  return {
    quantity: Number(raw.quantity),
    unit: raw.unit || rule.defaultUnit,
    quantitySource: 'notes',
    sourceLabel: sourceLabel('notes'),
    pricingReady: true,
    quantityHelper: rule.quantityHelper,
    showInput: true,
  };
}

function resolveLinkedCountertopAllowance(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  notes?: string | null
): ResolvedItemQuantity | null {
  if (itemId !== 'countertops') return null;
  const rule = getChecklistItemQuantityRule('countertops');
  if (!rule) return null;

  const cabinetEntry = measurements.itemQuantities.cabinets;
  if (!cabinetEntry?.quantity || cabinetEntry.quantity <= 0) return null;
  if (!['allowance', 'lump_sum'].includes(cabinetEntry.unit || '')) return null;
  const countertopEntry = measurements.itemQuantities.countertops;
  const combined =
    Boolean(cabinetEntry.includesCountertops) ||
    notesHaveCombinedCabinetsCounters(notes) ||
    (cabinetEntry.unit === 'allowance' &&
      cabinetEntry.quantity >= 5000 &&
      !(countertopEntry?.quantity != null && countertopEntry.quantity > 0));
  if (!combined) return null;

  return {
    quantity: cabinetEntry.quantity,
    unit: 'allowance',
    quantitySource: 'notes',
    sourceLabel: 'No separate charge',
    pricingReady: true,
    quantityHelper: rule.quantityHelper,
    showInput: true,
    combinedAllowanceRole: 'included_in_combined',
    combinedAllowanceTotal: cabinetEntry.quantity,
  };
}

/** Kitchen shares checklist ids with bathroom — override quantity semantics per template. */
const KITCHEN_CHECKLIST_ITEM_QUANTITY_RULES: Record<string, ScopeItemQuantityRule> = {
  demo: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance', 'lf'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 cabinet/counter demo lump sum. Edit LF if priced by run.',
  },
  floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['kitchenFloorSqft', 'floorAreaSqft'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter kitchen floor sqft for flooring removal.',
    missingMessage: 'Enter kitchen floor demo sqft.',
  },
};

export function getChecklistItemQuantityRule(
  itemId: string,
  templateKey?: string | null
): ScopeItemQuantityRule | undefined {
  if (templateKey === 'kitchen' && KITCHEN_CHECKLIST_ITEM_QUANTITY_RULES[itemId]) {
    return KITCHEN_CHECKLIST_ITEM_QUANTITY_RULES[itemId];
  }
  return CHECKLIST_ITEM_QUANTITY_RULES[itemId];
}

function parseStoredItemQuantity(
  measurements: NormalizedScopeMeasurements,
  key: string
): { quantity: number; unit: string; quantitySource?: QuantitySource } | null {
  const override = measurements.itemQuantities[key];
  if (override?.quantity != null && override.quantity > 0) {
    return {
      quantity: override.quantity,
      unit: override.unit || 'each',
      quantitySource: override.quantitySource,
    };
  }
  return null;
}

function sqftFromItemQuantities(
  measurements: NormalizedScopeMeasurements | ScopeMeasurementsInputExtended,
  itemId: string
): number | undefined {
  const entry = measurements.itemQuantities?.[itemId];
  if (!entry?.quantity || entry.unit !== 'sqft') return undefined;
  const q = parseScopeMeasurementInput(String(entry.quantity));
  return q && q > 0 ? q : undefined;
}

/** Copy sqft counts saved on itemQuantities into quick-measurement fields when missing. */
export function syncDualAllowanceSqftFields(
  input: ScopeMeasurementsInputExtended
): ScopeMeasurementsInputExtended {
  const next = { ...input };
  const sync = (itemId: string, field: 'backsplashSqft' | 'wallPaintSqft' | 'showerWallTileSqft') => {
    if (parseScopeMeasurementInput(String(next[field] ?? ''))) return;
    const q = sqftFromItemQuantities(input, itemId);
    if (q) next[field] = String(q);
  };
  sync('backsplash', 'backsplashSqft');
  sync('paint', 'wallPaintSqft');
  sync('shower_tile', 'showerWallTileSqft');
  return next;
}

function measurementsForRatePricing(
  measurements: NormalizedScopeMeasurements
): Parameters<typeof resolveItemRatePricingFromNotes>[1] {
  return {
    backsplashSqft: measurements.backsplashSqft ?? sqftFromItemQuantities(measurements, 'backsplash'),
    wallPaintSqft: measurements.wallPaintSqft ?? sqftFromItemQuantities(measurements, 'paint'),
    showerWallTileSqft: measurements.showerWallTileSqft ?? sqftFromItemQuantities(measurements, 'shower_tile'),
    kitchenFloorSqft: measurements.kitchenFloorSqft ?? undefined,
    bathroomFloorSqft: measurements.bathroomFloorSqft ?? undefined,
    floorAreaSqft: measurements.floorAreaSqft ?? undefined,
    drywallSqft: measurements.drywallSqft ?? undefined,
    exteriorPaintSqft: measurements.exteriorPaintSqft ?? undefined,
    landscapeSqft: measurements.landscapeSqft ?? undefined,
    sodSqft: measurements.sodSqft ?? undefined,
    paverSqft: measurements.paverSqft ?? undefined,
    rockMulchSqft: measurements.rockMulchSqft ?? undefined,
    landscapeTons: measurements.landscapeTons ?? undefined,
    roofSquares: measurements.roofSquares ?? undefined,
    concreteSqft: measurements.concreteSqft ?? undefined,
    concreteCy: measurements.concreteCy ?? undefined,
    excavationCy: measurements.excavationCy ?? undefined,
    deckSqft: measurements.deckSqft ?? undefined,
    railingLf: measurements.railingLf ?? undefined,
    baseboardLf: measurements.baseboardLf ?? undefined,
  };
}

function measurementsForRatePricingWithCount(
  measurements: NormalizedScopeMeasurements,
  itemId: string,
  countEntry: ReturnType<typeof parseStoredItemQuantity>
): Parameters<typeof resolveItemRatePricingFromNotes>[1] {
  const base = measurementsForRatePricing(measurements);
  if (countEntry?.unit !== 'sqft' || !countEntry.quantity) return base;
  if (itemId === 'backsplash' && !base.backsplashSqft) {
    return { ...base, backsplashSqft: countEntry.quantity };
  }
  if (itemId === 'paint' && !base.wallPaintSqft) {
    return { ...base, wallPaintSqft: countEntry.quantity };
  }
  if (itemId === 'shower_tile' && !base.showerWallTileSqft) {
    return { ...base, showerWallTileSqft: countEntry.quantity };
  }
  return base;
}

function isRatePricingSubKey(key: string): boolean {
  return /__(?:material|labor|allowance)$/.test(key);
}

function measurementsPayloadForRatePricing(
  input: ScopeMeasurementsInputExtended
): Parameters<typeof parseScopeItemRatePricingFromNotes>[1] {
  const synced = syncDualAllowanceSqftFields(input);
  return {
    backsplashSqft:
      parseScopeMeasurementInput(synced.backsplashSqft) ??
      sqftFromItemQuantities(synced, 'backsplash'),
    wallPaintSqft:
      parseScopeMeasurementInput(synced.wallPaintSqft) ??
      sqftFromItemQuantities(synced, 'paint'),
    showerWallTileSqft:
      parseScopeMeasurementInput(synced.showerWallTileSqft) ??
      sqftFromItemQuantities(synced, 'shower_tile'),
    kitchenFloorSqft: parseScopeMeasurementInput(input.kitchenFloorSqft) ?? undefined,
    bathroomFloorSqft: parseScopeMeasurementInput(input.bathroomFloorSqft) ?? undefined,
    floorAreaSqft: parseScopeMeasurementInput(input.floorAreaSqft) ?? undefined,
    drywallSqft: parseScopeMeasurementInput(input.drywallSqft) ?? undefined,
    exteriorPaintSqft: parseScopeMeasurementInput(input.exteriorPaintSqft) ?? undefined,
    landscapeSqft: parseScopeMeasurementInput(input.landscapeSqft) ?? undefined,
    sodSqft: parseScopeMeasurementInput(input.sodSqft) ?? undefined,
    paverSqft: parseScopeMeasurementInput(input.paverSqft) ?? undefined,
    rockMulchSqft: parseScopeMeasurementInput(input.rockMulchSqft) ?? undefined,
    landscapeTons: parseScopeMeasurementInput(input.landscapeTons) ?? undefined,
    roofSquares: parseScopeMeasurementInput(input.roofSquares) ?? undefined,
    concreteSqft: parseScopeMeasurementInput(input.concreteSqft) ?? undefined,
    concreteCy: parseScopeMeasurementInput(input.concreteCy) ?? undefined,
    excavationCy: parseScopeMeasurementInput(input.excavationCy) ?? undefined,
    deckSqft: parseScopeMeasurementInput(input.deckSqft) ?? undefined,
    railingLf: parseScopeMeasurementInput(input.railingLf) ?? undefined,
    baseboardLf: parseScopeMeasurementInput(input.baseboardLf) ?? undefined,
  };
}

/** Drop allowance totals that are actually $/sqft rates saved by mistake. */
export function sanitizeMistakenUnitRateAllowances(
  input: ScopeMeasurementsInputExtended
): ScopeMeasurementsInputExtended {
  const synced = syncDualAllowanceSqftFields(input);
  const itemQuantities = { ...synced.itemQuantities };
  const checks: Array<{ itemId: string; sqftKey: keyof ScopeMeasurementsInputExtended }> = [
    { itemId: 'backsplash', sqftKey: 'backsplashSqft' },
    { itemId: 'paint', sqftKey: 'wallPaintSqft' },
    { itemId: 'shower_tile', sqftKey: 'showerWallTileSqft' },
  ];
  for (const { itemId, sqftKey } of checks) {
    const sqft =
      parseScopeMeasurementInput(String(synced[sqftKey] ?? '')) ??
      sqftFromItemQuantities(synced, itemId);
    if (!sqft) continue;
    const allowanceKey = roughAllowanceSubKey(itemId);
    const entry = itemQuantities[allowanceKey];
    if (entry?.quantity && Number(entry.quantity) > 0 && Number(entry.quantity) < sqft) {
      delete itemQuantities[allowanceKey];
    }
  }
  return { ...synced, itemQuantities };
}

function ratePricingItemIdFromKey(key: string): string | null {
  const match = String(key || '').match(/^(.+)__(?:material|labor|allowance)$/);
  return match ? match[1] : null;
}

function stripRatePricingSubkeys(
  itemQuantities: Record<string, ScopeItemQuantityValue> | undefined
): Record<string, ScopeItemQuantityValue> {
  const out: Record<string, ScopeItemQuantityValue> = {};
  for (const [id, val] of Object.entries(itemQuantities || {})) {
    if (/__(?:material|labor|allowance)$/.test(id)) continue;
    out[id] = val;
  }
  return out;
}

/** Bake sqft × rate totals into itemQuantities so UI does not depend on live notes at render. */
export function reparseRatePricingIntoItemQuantities(
  input: ScopeMeasurementsInputExtended,
  scopeNotes: string,
  templateKey?: string | null
): ScopeMeasurementsInputExtended {
  const text = String(scopeNotes || '').trim();
  if (!text) return input;

  const itemQuantities = { ...input.itemQuantities };
  const rateItems = parseScopeItemRatePricingFromNotes(
    text,
    measurementsPayloadForRatePricing(input),
    { templateKey: templateKey ?? undefined }
  );

  const touchedItemIds = new Set<string>();
  for (const key of Object.keys(rateItems)) {
    const itemId = ratePricingItemIdFromKey(key) || (rateItems[key] ? key : null);
    if (itemId) touchedItemIds.add(itemId);
  }
  for (const itemId of touchedItemIds) {
    delete itemQuantities[`${itemId}__material`];
    delete itemQuantities[`${itemId}__labor`];
    delete itemQuantities[`${itemId}__allowance`];
  }

  for (const [id, val] of Object.entries(rateItems)) {
    if (!val.quantity || Number(val.quantity) <= 0) continue;
    itemQuantities[id] = {
      quantity: String(val.quantity),
      unit: val.unit || 'allowance',
      quantitySource: 'notes',
    };
  }
  return { ...input, itemQuantities };
}

function finalizeRateAllowanceTotal(
  effectiveAllowance: ReturnType<typeof parseStoredItemQuantity>,
  materialEntry: ReturnType<typeof parseStoredItemQuantity>,
  laborEntry: ReturnType<typeof parseStoredItemQuantity>,
  countEntry: ReturnType<typeof parseStoredItemQuantity>
): ReturnType<typeof parseStoredItemQuantity> {
  const sqft = countEntry?.quantity ?? null;
  const splitTotal = (materialEntry?.quantity || 0) + (laborEntry?.quantity || 0);
  const looksLikeUnitRate =
    effectiveAllowance &&
    sqft != null &&
    effectiveAllowance.quantity > 0 &&
    effectiveAllowance.quantity < sqft;
  if (
    splitTotal > 0 &&
    (!effectiveAllowance || looksLikeUnitRate || effectiveAllowance.quantity < splitTotal)
  ) {
    return {
      quantity: splitTotal,
      unit: 'allowance',
      quantitySource:
        materialEntry?.quantitySource || laborEntry?.quantitySource || effectiveAllowance?.quantitySource || 'notes',
    };
  }
  if (looksLikeUnitRate && effectiveAllowance && sqft != null) {
    return {
      quantity: Math.round(effectiveAllowance.quantity * sqft * 100) / 100,
      unit: 'allowance',
      quantitySource: effectiveAllowance.quantitySource || 'notes',
    };
  }
  return effectiveAllowance;
}

function withRatePricingHydratedFromNotes(
  measurements: NormalizedScopeMeasurements,
  itemId: string,
  notes?: string | null,
  templateKey?: string | null,
  countEntry?: ReturnType<typeof parseStoredItemQuantity>
): NormalizedScopeMeasurements {
  const text = String(notes || '').trim();
  if (!text) return measurements;

  const parsed = parseScopeItemRatePricingFromNotes(
    text,
    measurementsForRatePricingWithCount(measurements, itemId, countEntry ?? null),
    { templateKey: templateKey ?? undefined }
  );
  if (!Object.keys(parsed).length) return measurements;

  const ratePayload = measurementsForRatePricingWithCount(measurements, itemId, countEntry ?? null);
  const sqft =
    itemId === 'paint'
      ? ratePayload.wallPaintSqft ?? null
      : itemId === 'backsplash'
        ? ratePayload.backsplashSqft ?? null
        : itemId === 'shower_tile'
          ? ratePayload.showerWallTileSqft ?? null
          : null;

  const itemQuantities = { ...measurements.itemQuantities };
  for (const [key, val] of Object.entries(parsed)) {
    if (!key.startsWith(`${itemId}__`)) continue;
    const existing = itemQuantities[key];
    const existingLooksLikeUnitRate =
      existing?.quantity != null &&
      sqft != null &&
      existing.quantity > 0 &&
      existing.quantity < sqft;
    if (
      existing?.quantitySource === 'user_entered' &&
      !isRatePricingSubKey(key) &&
      !existingLooksLikeUnitRate
    ) {
      continue;
    }
    itemQuantities[key] = {
      quantity: val.quantity,
      unit: val.unit || 'allowance',
      quantitySource: val.quantitySource || 'notes',
    };
  }
  return { ...measurements, itemQuantities };
}

function applyRatePricingBreakdown(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  notes: string | null | undefined,
  templateKey: string | null | undefined,
  countEntry: ReturnType<typeof parseStoredItemQuantity>,
  allowanceEntry: ReturnType<typeof parseStoredItemQuantity>,
  legacyAllowance: ReturnType<typeof parseStoredItemQuantity>
): {
  effectiveAllowance: ReturnType<typeof parseStoredItemQuantity>;
  materialEntry: ReturnType<typeof parseStoredItemQuantity>;
  laborEntry: ReturnType<typeof parseStoredItemQuantity>;
} {
  let effectiveAllowance = allowanceEntry || legacyAllowance;
  let materialEntry = parseStoredItemQuantity(measurements, `${itemId}__material`);
  let laborEntry = parseStoredItemQuantity(measurements, `${itemId}__labor`);

  const sqft = countEntry?.quantity ?? null;

  if (!notes?.trim()) {
    if (materialEntry || laborEntry) {
      effectiveAllowance = finalizeRateAllowanceTotal(
        effectiveAllowance,
        materialEntry,
        laborEntry,
        countEntry
      );
    } else if (
      effectiveAllowance &&
      sqft != null &&
      effectiveAllowance.quantity > 0 &&
      effectiveAllowance.quantity < sqft
    ) {
      effectiveAllowance = {
        quantity: Math.round(effectiveAllowance.quantity * sqft * 100) / 100,
        unit: 'allowance',
        quantitySource: effectiveAllowance.quantitySource || 'notes',
      };
    }
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  const rateBreakdown = resolveItemRatePricingFromNotes(
    itemId,
    measurementsForRatePricingWithCount(measurements, itemId, countEntry),
    notes,
    { templateKey: templateKey ?? undefined }
  );
  if (!rateBreakdown) {
    effectiveAllowance = finalizeRateAllowanceTotal(
      effectiveAllowance,
      materialEntry,
      laborEntry,
      countEntry
    );
    if (
      !effectiveAllowance &&
      sqft != null &&
      allowanceEntry &&
      allowanceEntry.quantity > 0 &&
      allowanceEntry.quantity < sqft
    ) {
      effectiveAllowance = {
        quantity: Math.round(allowanceEntry.quantity * sqft * 100) / 100,
        unit: 'allowance',
        quantitySource: allowanceEntry.quantitySource || 'notes',
      };
    }
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  const storedLooksLikeUnitRate =
    effectiveAllowance &&
    sqft != null &&
    effectiveAllowance.quantity > 0 &&
    effectiveAllowance.quantity < sqft;

  const userLocked =
    allowanceEntry?.quantitySource === 'user_entered' &&
    effectiveAllowance &&
    !storedLooksLikeUnitRate &&
    effectiveAllowance.quantity >= rateBreakdown.total;

  if (userLocked) {
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  effectiveAllowance = {
    quantity: rateBreakdown.total,
    unit: 'allowance',
    quantitySource: 'notes',
  };
  if (rateBreakdown.material != null) {
    materialEntry = {
      quantity: rateBreakdown.material,
      unit: 'allowance',
      quantitySource: 'notes',
    };
  }
  if (rateBreakdown.labor != null) {
    laborEntry = {
      quantity: rateBreakdown.labor,
      unit: 'allowance',
      quantitySource: 'notes',
    };
  }
  effectiveAllowance = finalizeRateAllowanceTotal(
    effectiveAllowance,
    materialEntry,
    laborEntry,
    countEntry
  );
  return { effectiveAllowance, materialEntry, laborEntry };
}

/**
 * Display-only: sqft × $/sqft from notes, ignoring persisted __material/__labor/__allowance.
 * Used when Step 2 reopens with stale saved measurements from an older parse.
 */
export function resolveDualRatePricingDisplayFromNotes(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  notes?: string | null,
  templateKey?: string | null
): Pick<
  ResolvedItemQuantity,
  'dualCount' | 'dualMaterial' | 'dualLabor' | 'dualAllowance' | 'pricingReady' | 'quantitySource' | 'sourceLabel'
> | null {
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!rule?.dualAllowanceField) return null;

  const text = String(notes || '').trim();
  if (!text) return null;

  let sqft: number | null = null;
  if (rule.measurementKey) {
    sqft = parseScopeMeasurementInput(
      String(measurementsInput[rule.measurementKey as keyof ScopeMeasurementsInputExtended] ?? '')
    );
  }
  if (!sqft && rule.measurementKeys?.length) {
    for (const key of rule.measurementKeys) {
      sqft = parseScopeMeasurementInput(
        String(measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? '')
      );
      if (sqft) break;
    }
  }
  sqft = sqft ?? sqftFromItemQuantities(measurementsInput, itemId) ?? null;
  if (!sqft) return null;

  const syncedInput: ScopeMeasurementsInputExtended = {
    ...measurementsInput,
    ...(itemId === 'backsplash' ? { backsplashSqft: String(sqft) } : {}),
    ...(itemId === 'paint' ? { wallPaintSqft: String(sqft) } : {}),
    ...(itemId === 'shower_tile' ? { showerWallTileSqft: String(sqft) } : {}),
    ...(itemId === 'flooring' ? { floorAreaSqft: String(sqft) } : {}),
  };

  const breakdown = resolveItemRatePricingFromNotes(
    itemId,
    measurementsPayloadForRatePricing(syncedInput),
    text,
    { templateKey: templateKey ?? undefined }
  );
  if (!breakdown?.total) return null;

  const countEntry = {
    quantity: sqft,
    unit: rule.defaultUnit,
    quantitySource: 'notes' as const,
  };
  const materialEntry =
    breakdown.material != null
      ? { quantity: breakdown.material, unit: 'allowance' as const, quantitySource: 'notes' as const }
      : null;
  let laborEntry =
    breakdown.labor != null
      ? { quantity: breakdown.labor, unit: 'allowance' as const, quantitySource: 'notes' as const }
      : null;
  const allowanceEntry = {
    quantity: breakdown.total,
    unit: 'allowance' as const,
    quantitySource: 'notes' as const,
  };

  return {
    dualCount: countEntry,
    dualMaterial: materialEntry,
    dualLabor: laborEntry,
    dualAllowance: finalizeRateAllowanceTotal(
      allowanceEntry,
      materialEntry,
      laborEntry,
      countEntry
    ),
    pricingReady: true,
    quantitySource: 'notes',
    sourceLabel: sourceLabel('notes'),
  };
}

function firstMeasurementQuantityForRule(
  rule: ScopeItemQuantityRule,
  measurementsInput: ScopeMeasurementsInputExtended
): number | null {
  if (rule.measurementKey) {
    const quantity = parseScopeMeasurementInput(
      String(measurementsInput[rule.measurementKey as keyof ScopeMeasurementsInputExtended] ?? '')
    );
    if (quantity && quantity > 0) return quantity;
  }
  if (rule.measurementKeys?.length) {
    for (const key of rule.measurementKeys) {
      const quantity = parseScopeMeasurementInput(
        String(measurementsInput[key as keyof ScopeMeasurementsInputExtended] ?? '')
      );
      if (quantity && quantity > 0) return quantity;
    }
  }
  return null;
}

export function resolveBudgetSplitQuantity(
  itemId: string,
  templateKey: string | null | undefined,
  measurementsInput: ScopeMeasurementsInputExtended,
  resolved: Pick<ResolvedItemQuantity, 'quantity' | 'unit' | 'dualCount'>,
  scopeQuantity?: { quantity: number; unit: string } | null
): number | null {
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  const average = getNationalAverageBudgetSplit(itemId);
  if (!rule || !average) return null;

  if (scopeQuantity && scopeQuantity.quantity > 0 && scopeQuantity.unit === average.unit) {
    return scopeQuantity.quantity;
  }
  if (resolved.dualCount?.unit === average.unit && resolved.dualCount.quantity > 0) {
    return resolved.dualCount.quantity;
  }
  if (resolved.quantity != null && resolved.unit === average.unit && resolved.quantity > 0) {
    return resolved.quantity;
  }
  if (itemId === 'floor_demo' && average.unit === 'sqft') {
    const floorArea = parseScopeMeasurementInput(measurementsInput.floorAreaSqft);
    if (floorArea && floorArea > 0) return floorArea;
  }
  return firstMeasurementQuantityForRule(rule, measurementsInput);
}

export function resolveSuggestedBudgetSplitDisplay(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  templateKey: string | null | undefined,
  resolved: Pick<
    ResolvedItemQuantity,
    'quantity' | 'unit' | 'quantitySource' | 'dualCount' | 'dualMaterial' | 'dualLabor' | 'dualAllowance'
  >
): SuggestedBudgetSplitDisplay | null {
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  const average = getNationalAverageBudgetSplit(itemId);
  if (!rule || !average) return null;
  if (resolved.dualMaterial || resolved.dualLabor) return null;

  const count =
    resolved.dualCount?.unit === average.unit && resolved.dualCount.quantity > 0
      ? resolved.dualCount.quantity
      : itemId === 'floor_demo' && average.unit === 'sqft'
        ? parseScopeMeasurementInput(measurementsInput.floorAreaSqft) ?? firstMeasurementQuantityForRule(rule, measurementsInput)
        : firstMeasurementQuantityForRule(rule, measurementsInput);

  const hasNoteTotal = resolved.quantitySource === 'notes' || resolved.dualAllowance?.quantity != null;
  const inferredCountCanPrice =
    !hasNoteTotal &&
    resolved.quantity != null &&
    resolved.unit === average.unit &&
    resolved.quantity > 0;
  if (!hasNoteTotal && !inferredCountCanPrice) return null;

  const total = hasNoteTotal
    ? Number(resolved.dualAllowance?.quantity ?? resolved.quantity ?? 0)
    : Math.round(Number(resolved.quantity) * (average.material + average.labor) * 100) / 100;
  if (!Number.isFinite(total) || total <= 0) return null;

  const split = computeNationalAverageBudgetSplit(itemId, total, count ?? 0);
  if (!split || !count) return null;

  return {
    material: split.material,
    labor: split.labor,
    total,
    sourceLabel: average.sourceLabel,
    helper: `${count.toLocaleString()} ${average.unit.toUpperCase()} · for budget tracking`,
    mode: hasNoteTotal ? 'note_total_split' : 'suggested_price',
    basis: { quantity: count, unit: average.unit },
  };
}

// ---------------------------------------------------------------------------
// Unified scope pricing engine
// ---------------------------------------------------------------------------
// One model that resolves each item's material + labor legs independently from
// a clear source priority: notes (explicit) -> saved template/bid rate (same
// trade family) -> national average. Handles lump-sum split, material-only
// fill, labor-only fill, and a comparison split when notes priced both legs.

export type PricingLegSource = 'notes' | 'template' | 'national_average';

export type ScopePricingLineItem = {
  name?: string | null;
  label?: string | null;
  description?: string | null;
  unit?: string | null;
  quantity?: number | null;
  qty?: number | null;
  unitPrice?: number | null;
  cost?: number | null;
  rate?: number | null;
  total?: number | null;
};

export type ScopePricingTemplateSource = {
  name?: string | null;
  materialLineItems?: ScopePricingLineItem[] | null;
  laborLineItems?: ScopePricingLineItem[] | null;
};

/** Saved templates + the active bid, used to derive $/unit rates by trade family. */
export type ScopePricingContext = {
  templates?: ScopePricingTemplateSource[] | null;
  bid?: ScopePricingTemplateSource | null;
};

export type TemplateRateMatch = {
  materialRate: number | null;
  laborRate: number | null;
  source: string;
};

/** Fallback trade families for items that have no rate-pricing matcher. */
const TEMPLATE_FAMILY_FALLBACK: Record<string, RegExp> = {
  countertops: /counter\s*top|quartz|granite|laminate\s*top|solid\s*surface|butcher\s*block/i,
  cabinets: /cabinet|cabinetry|vanity/i,
  floor_prep: /floor\s*prep|underlayment|leveling|self\s*level|patch/i,
  waterproofing: /waterproof|kerdi|redgard|red\s*guard|schluter|membrane/i,
  demo: /demo|demolition|tear\s*out|removal|remove|haul/i,
  floor_demo: /demo|demolition|tear\s*out|removal|remove/i,
};

function normalizeRateUnit(unit?: string | null): string | null {
  const value = String(unit || '').toLowerCase().trim();
  if (!value) return null;
  if (/^(sqft|sf|sq\.?\s*ft|square\s*f(?:oo|ee)t)$/.test(value)) return 'sqft';
  if (/^(lf|linear\s*f(?:oo|ee)t|ln\.?\s*ft|lin\.?\s*ft)$/.test(value)) return 'lf';
  if (/^(cy|cubic\s*yards?)$/.test(value)) return 'cy';
  if (/^(ton|tons)$/.test(value)) return 'ton';
  if (/^(square|squares)$/.test(value)) return 'squares';
  return value;
}

function lineItemRatePerUnit(item: ScopePricingLineItem): number | null {
  const direct = Number(item.unitPrice ?? item.cost ?? item.rate ?? 0);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct * 100) / 100;
  const qty = Number(item.quantity ?? item.qty ?? 0);
  const total = Number(item.total ?? 0);
  if (qty > 0 && total > 0) return Math.round((total / qty) * 100) / 100;
  return null;
}

function lineItemMatchesFamily(
  item: ScopePricingLineItem,
  matcher: { match: RegExp; exclude?: RegExp }
): boolean {
  const text = `${item.name || ''} ${item.label || ''} ${item.description || ''}`.trim();
  if (!text) return false;
  if (!matcher.match.test(text)) return false;
  if (matcher.exclude?.test(text)) return false;
  return true;
}

function averageMatchingRate(
  items: ScopePricingLineItem[] | null | undefined,
  matcher: { match: RegExp; exclude?: RegExp },
  targetUnit: string | null
): number | null {
  if (!Array.isArray(items) || !items.length) return null;
  const rates: number[] = [];
  for (const item of items) {
    if (!lineItemMatchesFamily(item, matcher)) continue;
    if (targetUnit && normalizeRateUnit(item.unit) !== targetUnit) continue;
    const rate = lineItemRatePerUnit(item);
    if (rate) rates.push(rate);
  }
  if (!rates.length) return null;
  const sum = rates.reduce((acc, r) => acc + r, 0);
  return Math.round((sum / rates.length) * 100) / 100;
}

/**
 * Resolve a $/unit material + labor rate for a checklist item from saved
 * templates and the active bid, matched within the same trade family and unit.
 * The active bid is checked first (most specific to the current job).
 */
export function resolveTemplateRateForItem(
  itemId: string,
  unit: string | null | undefined,
  ctx?: ScopePricingContext | null
): TemplateRateMatch | null {
  if (!ctx) return null;
  const matcher =
    getRatePricingMatcher(itemId) ||
    (TEMPLATE_FAMILY_FALLBACK[itemId] ? { match: TEMPLATE_FAMILY_FALLBACK[itemId] } : null);
  if (!matcher) return null;

  const targetUnit = normalizeRateUnit(unit);
  const sources: ScopePricingTemplateSource[] = [
    ...(ctx.bid ? [ctx.bid] : []),
    ...((ctx.templates || []).filter(Boolean) as ScopePricingTemplateSource[]),
  ];

  for (const source of sources) {
    const materialRate = averageMatchingRate(source.materialLineItems, matcher, targetUnit);
    const laborRate = averageMatchingRate(source.laborLineItems, matcher, targetUnit);
    if (materialRate || laborRate) {
      return {
        materialRate: materialRate ?? null,
        laborRate: laborRate ?? null,
        source: String(source.name || 'Saved pricing'),
      };
    }
  }
  return null;
}

export type SuggestedPricingMode =
  | 'note_total_split'
  | 'fill_missing'
  | 'suggested_price';

/** Suggested pricing block enriched with per-leg sources for the Confirm Scope UI. */
export type SuggestedPricingBlock = {
  material: number;
  labor: number;
  total: number;
  materialSource: PricingLegSource;
  laborSource: PricingLegSource;
  rateSourceLabel: string;
  templateName?: string | null;
  helper: string;
  mode: SuggestedPricingMode;
  isComparison?: boolean;
  basis?: { quantity: number; unit: string } | null;
};

export type ScopeItemSuggestedPricing = {
  /** Inline suggestion: fills a missing leg, splits a lump sum, or prices a quantity. */
  fill: SuggestedPricingBlock | null;
  /** Collapsible comparison shown when notes already priced both legs. */
  comparison: SuggestedPricingBlock | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rateSourceLabelFor(
  materialSource: PricingLegSource,
  laborSource: PricingLegSource,
  templateName: string | null
): string {
  const usesTemplate = materialSource === 'template' || laborSource === 'template';
  if (usesTemplate && templateName) return `Suggested · ${templateName}`;
  return 'Suggested · National Average';
}

/**
 * Canonical pricing resolver for the Confirm Scope UI. Resolves material and
 * labor independently with the priority notes -> template/bid -> national
 * average, and works for any trade/material/labor combination.
 */
export function resolveScopeItemSuggestedPricing(
  itemId: string,
  measurementsInput: ScopeMeasurementsInputExtended,
  templateKey: string | null | undefined,
  resolved: Pick<
    ResolvedItemQuantity,
    'quantity' | 'unit' | 'quantitySource' | 'dualCount' | 'dualMaterial' | 'dualLabor' | 'dualAllowance'
  >,
  pricingContext?: ScopePricingContext | null
): ScopeItemSuggestedPricing {
  const empty: ScopeItemSuggestedPricing = { fill: null, comparison: null };
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  const average = getNationalAverageBudgetSplit(itemId);
  if (!rule) return empty;

  const unit = average?.unit || rule.defaultUnit || 'sqft';

  // Quantity in the rate unit (e.g. 850 sqft, 220 lf).
  const count =
    resolved.dualCount?.unit === unit && resolved.dualCount.quantity > 0
      ? resolved.dualCount.quantity
      : itemId === 'floor_demo' && unit === 'sqft'
        ? parseScopeMeasurementInput(measurementsInput.floorAreaSqft) ??
          firstMeasurementQuantityForRule(rule, measurementsInput)
        : resolved.quantity != null && resolved.unit === unit && resolved.quantity > 0
          ? resolved.quantity
          : firstMeasurementQuantityForRule(rule, measurementsInput);
  if (!count || count <= 0) return empty;

  const template = resolveTemplateRateForItem(itemId, unit, pricingContext);
  const materialRate = template?.materialRate ?? average?.material ?? null;
  const laborRate = template?.laborRate ?? average?.labor ?? null;
  const materialRateSource: PricingLegSource = template?.materialRate ? 'template' : 'national_average';
  const laborRateSource: PricingLegSource = template?.laborRate ? 'template' : 'national_average';
  const templateName = template?.source ?? null;

  if (!materialRate && !laborRate) return empty;

  // Notes breakdown (canonical from the resolved item).
  const noteMaterial = resolved.dualMaterial?.quantity ?? null;
  const noteLabor = resolved.dualLabor?.quantity ?? null;
  const noteTotal =
    resolved.dualAllowance?.quantity ??
    (resolved.quantitySource === 'notes' &&
    (resolved.unit === 'allowance' || resolved.unit === 'lump_sum')
      ? resolved.quantity
      : null);

  const basis = { quantity: count, unit };
  const basisHelper = `${count.toLocaleString()} ${unit.toUpperCase()}`;

  // Case A: notes priced both legs -> collapsible comparison only.
  if (noteMaterial != null && noteLabor != null) {
    if (!materialRate || !laborRate) return empty;
    const material = round2(count * materialRate);
    const labor = round2(count * laborRate);
    return {
      fill: null,
      comparison: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: materialRateSource,
        laborSource: laborRateSource,
        rateSourceLabel: rateSourceLabelFor(materialRateSource, laborRateSource, templateName),
        templateName,
        helper: `${basisHelper} · suggested comparison`,
        mode: 'suggested_price',
        isComparison: true,
        basis,
      },
    };
  }

  // Case B: exactly one leg from notes -> fill the missing leg.
  if (noteMaterial != null && noteLabor == null) {
    if (!laborRate) return empty;
    const labor = round2(count * laborRate);
    const material = round2(noteMaterial);
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: 'notes',
        laborSource: laborRateSource,
        rateSourceLabel: rateSourceLabelFor('notes', laborRateSource, templateName),
        templateName,
        helper: `${basisHelper} · labor suggested, material from notes`,
        mode: 'fill_missing',
        basis,
      },
      comparison: null,
    };
  }
  if (noteLabor != null && noteMaterial == null) {
    if (!materialRate) return empty;
    const material = round2(count * materialRate);
    const labor = round2(noteLabor);
    return {
      fill: {
        material,
        labor,
        total: round2(material + labor),
        materialSource: materialRateSource,
        laborSource: 'notes',
        rateSourceLabel: rateSourceLabelFor(materialRateSource, 'notes', templateName),
        templateName,
        helper: `${basisHelper} · material suggested, labor from notes`,
        mode: 'fill_missing',
        basis,
      },
      comparison: null,
    };
  }

  // Case C: lump-sum total from notes -> split via template/national ratio.
  if (noteTotal != null && noteTotal > 0) {
    if (!materialRate) return empty;
    const material = Math.min(noteTotal, round2(count * materialRate));
    const labor = round2(noteTotal - material);
    if (material <= 0 || labor <= 0) return empty;
    return {
      fill: {
        material,
        labor,
        total: round2(noteTotal),
        materialSource: materialRateSource,
        laborSource: 'notes',
        rateSourceLabel: rateSourceLabelFor(materialRateSource, materialRateSource, templateName),
        templateName,
        helper: `${basisHelper} · for budget tracking`,
        mode: 'note_total_split',
        basis,
      },
      comparison: null,
    };
  }

  // Case D: quantity only, no notes pricing -> full suggested price.
  if (!materialRate || !laborRate) return empty;
  const material = round2(count * materialRate);
  const labor = round2(count * laborRate);
  return {
    fill: {
      material,
      labor,
      total: round2(material + labor),
      materialSource: materialRateSource,
      laborSource: laborRateSource,
      rateSourceLabel: rateSourceLabelFor(materialRateSource, laborRateSource, templateName),
      templateName,
      helper: `${basisHelper} · suggested pricing`,
      mode: 'suggested_price',
      basis,
    },
    comparison: null,
  };
}

/** Last-resort display merge: sqft × $/sqft from notes and/or baked itemQuantities subkeys. */
export function overlayDualRatePricingDisplay(
  itemId: string,
  resolved: ResolvedItemQuantity,
  measurements: NormalizedScopeMeasurements,
  notes?: string | null,
  templateKey?: string | null
): ResolvedItemQuantity {
  const rule = getChecklistItemQuantityRule(itemId, templateKey);
  if (!rule?.dualAllowanceField) return resolved;

  let countEntry =
    resolved.dualCount ??
    (resolved.quantity != null && resolved.unit === 'sqft'
      ? {
          quantity: resolved.quantity,
          unit: 'sqft' as const,
          quantitySource: resolved.quantitySource || ('inferred' as const),
        }
      : null);

  if (!countEntry && rule.measurementKey && measurements[rule.measurementKey]) {
    countEntry = {
      quantity: measurements[rule.measurementKey]!,
      unit: rule.defaultUnit,
      quantitySource: 'inferred',
    };
  }

  let materialEntry = parseStoredItemQuantity(measurements, `${itemId}__material`);
  let laborEntry = parseStoredItemQuantity(measurements, `${itemId}__labor`);
  let allowanceEntry = parseStoredItemQuantity(measurements, roughAllowanceSubKey(itemId));

  const text = String(notes || '').trim();
  if (text && countEntry) {
    const rateBreakdown = resolveItemRatePricingFromNotes(
      itemId,
      measurementsForRatePricingWithCount(measurements, itemId, countEntry),
      text,
      { templateKey: templateKey ?? undefined }
    );
    if (rateBreakdown) {
      if (rateBreakdown.material != null) {
        materialEntry = {
          quantity: rateBreakdown.material,
          unit: 'allowance',
          quantitySource: 'notes',
        };
      }
      if (rateBreakdown.labor != null) {
        laborEntry = {
          quantity: rateBreakdown.labor,
          unit: 'allowance',
          quantitySource: 'notes',
        };
      }
      allowanceEntry = {
        quantity: rateBreakdown.total,
        unit: 'allowance',
        quantitySource: 'notes',
      };
    } else {
      const parsed = parseScopeItemRatePricingFromNotes(
        text,
        measurementsForRatePricingWithCount(measurements, itemId, countEntry),
        { templateKey: templateKey ?? undefined }
      );
      const material = parsed[`${itemId}__material`];
      const labor = parsed[`${itemId}__labor`];
      const total = parsed[`${itemId}__allowance`];
      if (material?.quantity) {
        materialEntry = {
          quantity: Number(material.quantity),
          unit: 'allowance',
          quantitySource: 'notes',
        };
      }
      if (labor?.quantity) {
        laborEntry = {
          quantity: Number(labor.quantity),
          unit: 'allowance',
          quantitySource: 'notes',
        };
      }
      if (total?.quantity) {
        allowanceEntry = {
          quantity: Number(total.quantity),
          unit: 'allowance',
          quantitySource: 'notes',
        };
      }
    }
  }

  const effectiveAllowance = finalizeRateAllowanceTotal(
    allowanceEntry,
    materialEntry,
    laborEntry,
    countEntry
  );

  if (!countEntry && !effectiveAllowance) return resolved;

  const fromNotes =
    materialEntry?.quantitySource === 'notes' ||
    laborEntry?.quantitySource === 'notes' ||
    effectiveAllowance?.quantitySource === 'notes';

  return {
    ...resolved,
    quantity: countEntry?.quantity ?? effectiveAllowance!.quantity,
    unit: countEntry?.unit ?? effectiveAllowance!.unit,
    quantitySource: fromNotes ? 'notes' : resolved.quantitySource,
    sourceLabel: fromNotes ? sourceLabel('notes') : resolved.sourceLabel,
    pricingReady: true,
    showInput: true,
    dualCount: countEntry,
    dualMaterial: materialEntry,
    dualLabor: laborEntry,
    dualAllowance: effectiveAllowance,
  };
}

function resolveDualAllowanceQuantity(
  itemId: string,
  rule: ScopeItemQuantityRule,
  measurements: NormalizedScopeMeasurements,
  notes?: string | null,
  templateKey?: string | null
): ResolvedItemQuantity | null {
  let countEntry = parseStoredItemQuantity(measurements, itemId);
  if (!countEntry && rule.measurementKey && measurements[rule.measurementKey]) {
    countEntry = {
      quantity: measurements[rule.measurementKey]!,
      unit: rule.defaultUnit,
      quantitySource: 'inferred',
    };
  }

  const hydrated = withRatePricingHydratedFromNotes(
    measurements,
    itemId,
    notes,
    templateKey,
    countEntry
  );
  const allowanceEntry = parseStoredItemQuantity(hydrated, roughAllowanceSubKey(itemId));

  // Legacy: single field saved as allowance/lump_sum on the main key
  const legacyAllowance =
    !countEntry &&
    !allowanceEntry &&
    hydrated.itemQuantities[itemId] &&
    ['allowance', 'lump_sum'].includes(hydrated.itemQuantities[itemId].unit || '')
      ? parseStoredItemQuantity(hydrated, itemId)
      : null;

  let { effectiveAllowance, materialEntry, laborEntry } = applyRatePricingBreakdown(
    itemId,
    hydrated,
    notes,
    templateKey,
    countEntry,
    allowanceEntry,
    legacyAllowance
  );

  const forced = overlayDualRatePricingDisplay(
    itemId,
    {
      quantity: countEntry?.quantity ?? effectiveAllowance?.quantity ?? null,
      unit: countEntry?.unit ?? effectiveAllowance?.unit ?? rule.defaultUnit,
      quantitySource: 'inferred',
      sourceLabel: '',
      pricingReady: Boolean(countEntry || effectiveAllowance),
      showInput: true,
      dualCount: countEntry,
      dualMaterial: materialEntry,
      dualLabor: laborEntry,
      dualAllowance: effectiveAllowance,
    },
    hydrated,
    notes,
    templateKey
  );
  countEntry = forced.dualCount ?? countEntry;
  materialEntry = forced.dualMaterial ?? materialEntry;
  laborEntry = forced.dualLabor ?? laborEntry;
  effectiveAllowance = forced.dualAllowance ?? effectiveAllowance;

  if (!countEntry && !effectiveAllowance) return null;

  const primary = countEntry || effectiveAllowance!;
  const summaryParts: string[] = [];
  if (countEntry) {
    const unitLabel =
      itemId === 'plumbing_rough' ? 'rough-in points' : formatUnitLabel(countEntry.unit);
    summaryParts.push(`${countEntry.quantity.toLocaleString()} ${unitLabel}`);
  }
  if (materialEntry) {
    summaryParts.push(`$${materialEntry.quantity.toLocaleString()} material`);
  }
  if (laborEntry) {
    summaryParts.push(`$${laborEntry.quantity.toLocaleString()} labor`);
  }
  if (effectiveAllowance && (materialEntry || laborEntry)) {
    summaryParts.push(`$${effectiveAllowance.quantity.toLocaleString()} total`);
  } else if (effectiveAllowance) {
    summaryParts.push(`$${effectiveAllowance.quantity.toLocaleString()} allowance`);
  }

  const quantitySource: QuantitySource =
    allowanceEntry?.quantitySource === 'notes' ||
    countEntry?.quantitySource === 'notes' ||
    materialEntry?.quantitySource === 'notes' ||
    laborEntry?.quantitySource === 'notes' ||
    effectiveAllowance?.quantitySource === 'notes'
      ? 'notes'
      : 'user_entered';

  return {
    quantity: primary.quantity,
    unit: primary.unit,
    quantitySource,
    sourceLabel:
      quantitySource === 'notes' ? sourceLabel('notes') : summaryParts.join(' · '),
    pricingReady: true,
    quantityHelper: rule.quantityHelper,
    showInput: true,
    dualCount: countEntry,
    dualMaterial: materialEntry,
    dualLabor: laborEntry,
    dualAllowance: effectiveAllowance,
  };
}

function applyPricingReadyFlags(
  resolved: ResolvedItemQuantity,
  itemId: string,
  ctx: { notes?: string | null } = {}
): ResolvedItemQuantity {
  void itemId;
  void ctx;
  return resolved;
}

export function resolveChecklistItemQuantity(
  itemId: string,
  measurements: NormalizedScopeMeasurements,
  ctx: { choiceId?: string | null; templateKey?: string | null; notes?: string | null } = {}
): ResolvedItemQuantity {
  const choiceId = ctx.choiceId ?? null;
  const rule = getChecklistItemQuantityRule(itemId, ctx.templateKey);
  if (!rule) {
    return {
      quantity: null,
      unit: 'lump_sum',
      quantitySource: 'missing',
      sourceLabel: 'Needs measurement',
      pricingReady: false,
      showInput: false,
    };
  }

  if (rule.choiceIds?.length && choiceId && !rule.choiceIds.includes(choiceId)) {
    return {
      quantity: null,
      unit: rule.defaultUnit,
      quantitySource: 'not_applicable',
      sourceLabel: '',
      pricingReady: false,
      showInput: false,
    };
  }

  if (
    itemId === 'wet_area_install' &&
    choiceId &&
    ['tub', 'prefab', 'tile_pan', 'staying', 'not_in_scope', 'unsure'].includes(choiceId)
  ) {
    return {
      quantity: null,
      unit: 'each',
      quantitySource: 'not_applicable',
      sourceLabel: '',
      pricingReady: false,
      showInput: false,
    };
  }

  const linkedCountertop = resolveLinkedCountertopAllowance(itemId, measurements, ctx.notes);
  if (linkedCountertop) return linkedCountertop;

  const override = measurements.itemQuantities[itemId];
  if (!rule.dualAllowanceField && override?.quantitySource !== 'user_entered' && ctx.notes?.trim()) {
    const parsedAllowance = parseScopeItemAllowancesFromNotes(ctx.notes, {
      templateKey: ctx.templateKey ?? undefined,
    })[itemId];
    if (parsedAllowance?.quantity && Number(parsedAllowance.quantity) > 0) {
      const includesCountertops =
        Boolean(parsedAllowance.includesCountertops) ||
        (itemId === 'cabinets' && notesHaveCombinedCabinetsCounters(ctx.notes));
      const combinedCabinetsCounters = itemId === 'cabinets' && includesCountertops;
      return {
        quantity: Number(parsedAllowance.quantity),
        unit: parsedAllowance.unit || rule.defaultUnit,
        quantitySource: 'notes',
        sourceLabel: combinedCabinetsCounters
          ? `Combined total · cabinets + counters · ${sourceLabel('notes')}`
          : sourceLabel('notes'),
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
        ...(combinedCabinetsCounters
          ? {
              combinedAllowanceRole: 'combined_total' as const,
              combinedAllowanceTotal: Number(parsedAllowance.quantity),
            }
          : {}),
      };
    }
  }
  if (rule.dualAllowanceField) {
    const dual = resolveDualAllowanceQuantity(
      itemId,
      rule,
      measurements,
      ctx.notes,
      ctx.templateKey
    );
    if (dual) return dual;
  } else if (override?.quantity != null && override.quantity > 0) {
    const includesCountertops =
      Boolean(override.includesCountertops) ||
      (itemId === 'cabinets' && notesHaveCombinedCabinetsCounters(ctx.notes));
    const baseLabel = sourceLabel(override.quantitySource || 'user_entered');
    const combinedCabinetsCounters =
      itemId === 'cabinets' && includesCountertops;
    return {
      quantity: override.quantity,
      unit: override.unit || rule.defaultUnit,
      quantitySource: override.quantitySource || 'user_entered',
      sourceLabel: combinedCabinetsCounters
        ? `Combined total · cabinets + counters · ${baseLabel}`
        : baseLabel,
      pricingReady: true,
      quantityHelper: rule.quantityHelper,
      showInput: true,
      ...(combinedCabinetsCounters
        ? {
            combinedAllowanceRole: 'combined_total' as const,
            combinedAllowanceTotal: override.quantity,
          }
        : {}),
    };
  }

  if (rule.aggregateMeasurementKeys?.length) {
    const agg = sumMeasurementKeys(measurements, rule.aggregateMeasurementKeys);
    if (agg) {
      return {
        quantity: agg.quantity,
        unit: rule.defaultUnit,
        quantitySource: 'inferred',
        sourceLabel: aggregatedMeasurementSourceLabel(agg.parts),
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
      };
    }
  }

  for (const key of rule.measurementKeys || (rule.measurementKey ? [rule.measurementKey] : [])) {
    const val = Number(measurements[key]);
    if (Number.isFinite(val) && val > 0) {
      const resolved: ResolvedItemQuantity = {
        quantity: val,
        unit: rule.defaultUnit,
        quantitySource: 'inferred',
        sourceLabel: 'From notes',
        pricingReady: true,
        quantityHelper: rule.quantityHelper,
        showInput: true,
      };
      return applyPricingReadyFlags(resolved, itemId, ctx);
    }
  }

  if (rule.defaultQuantity != null && !rule.requiresUserQuantity) {
    return {
      quantity: rule.defaultQuantity,
      unit: rule.defaultUnit,
      quantitySource: 'default_assumption',
      sourceLabel: sourceLabel('default_assumption'),
      pricingReady: true,
      quantityHelper: rule.quantityHelper,
      showInput: true,
    };
  }

  const fromNotes = resolvedQuantityFromNotes(itemId, measurements, ctx);
  if (fromNotes) return fromNotes;

  return {
    quantity: null,
    unit: rule.defaultUnit,
    quantitySource: 'missing',
    sourceLabel: sourceLabel('missing'),
    pricingReady: false,
    quantityHelper: rule.quantityHelper,
    missingMessage: rule.missingMessage,
    showInput: true,
  };
}

/** Package name patterns → checklist quantity rule key (mirrors backend catalog). */
const PACKAGE_NAME_TO_RULE_KEY: Array<{ test: RegExp; key: string }> = [
  { test: /\bbath(?:room)?\s+demo\b|\bdemo\b.*\bbath/i, key: 'demo' },
  { test: /\btile\s+demo|\btile\s+removal|\btile\s+demolition/i, key: 'floor_demo' },
  { test: /\bfloor\s+demo|\bflooring\s+demo/i, key: 'floor_demo' },
  {
    test: /\b(lvp|laminate|vinyl|carpet|flooring)\b.*\b(install|installation)\b|\b(install|installation)\b.*\b(lvp|laminate|vinyl|carpet|flooring)\b/i,
    key: 'flooring',
  },
  { test: /\b(lvp|laminate|vinyl|carpet)\b|\bflooring\s+install/i, key: 'flooring' },
  { test: /\bshower\s+floor\s+tile|\btile\s+shower\s+floor/i, key: 'shower_floor_tile' },
  { test: /\bprefab\s+shower\s+pan|\bshower\s+pan\s+install/i, key: 'prefab_shower_pan' },
  { test: /\btile\s+shower\s+pan|\bmud\s+pan/i, key: 'shower_pan' },
  { test: /\bshower\s+pan|\btile\s+pan/i, key: 'shower_pan' },
  { test: /\btub\s+install|\btub\s+installation|\bbathtub/i, key: 'tub_install' },
  { test: /\bshower\s+niche|\bniche/i, key: 'shower_niche' },
  { test: /\bshower\s+bench|\bcurb/i, key: 'shower_bench_curb' },
  { test: /\bexhaust\s+fan|\bbath\s+fan|\bventilation/i, key: 'exhaust_fan' },
  { test: /\bmirror|\baccessories|\btowel\s+bar/i, key: 'mirror_accessories' },
  { test: /\bfloor\s+prep|\bsubfloor|\bunderlayment/i, key: 'floor_prep' },
  { test: /\bback\s*splash/i, key: 'backsplash' },
  { test: /\bcabinet/i, key: 'cabinets' },
  { test: /\bcountertop/i, key: 'countertops' },
  { test: /\brock|\bmulch|\bgravel/i, key: 'rock_mulch' },
  { test: /\bsod|\bturf/i, key: 'sod_turf' },
  { test: /\bpaver/i, key: 'pavers' },
  { test: /\bconcrete\b/i, key: 'pour_flatwork' },
  { test: /\bexcavat/i, key: 'excavation' },
  { test: /\brail(?:ing)?\b|\bguardrail\b/i, key: 'railing' },
  { test: /\bshower\b.*\btile\b|\btile\b.*\bshower\b|\bshower\s+wall\s+tile/i, key: 'shower_tile' },
  { test: /\bwaterproof|\bbacker\s+board/i, key: 'waterproofing' },
  { test: /\bfloor\b.*\btile\b|\btile\b.*\bfloor\b/i, key: 'floor_tile' },
  { test: /\bvanity\b/i, key: 'vanity' },
  { test: /\btoilet\b/i, key: 'toilet' },
  { test: /\bplumb.*\brough|\brough[\s-]?in\b.*\bplumb/i, key: 'plumbing_rough' },
  { test: /\belectrical\b(?!.*trim)|\bnew\s+circuits\b/i, key: 'electrical_rough' },
  { test: /\blight(?:ing)?\s+fix|\bfixture.*\blight/i, key: 'lighting' },
  { test: /\bdrywall\b|\bpatch/i, key: 'drywall' },
  { test: /\bpaint|\bpainting/i, key: 'paint' },
  { test: /\bbaseboard|\btrim\s+install|\btrim\s+&\s+baseboard/i, key: 'trim' },
  { test: /\bshower\s+door|\bglass\s+door|\benclosure/i, key: 'glass_door' },
  { test: /\bplumb.*\btrim|\bplumbing\s+trim|\bfinal\s+plumb/i, key: 'plumbing_trim' },
  { test: /\belectrical\s+trim|\bdevices.*\bplates/i, key: 'electrical_trim' },
  { test: /\bpermit|\binspection/i, key: 'permits' },
  { test: /\bcleanup|\bdisposal|\bhaul[\s-]?off|\bdumpster/i, key: 'cleanup' },
  { test: /\bplumb(?!.*trim)/i, key: 'plumbing_rough' },
];

export function lookupRuleKeyForPackage(name: string, scope = ''): string | null {
  const nameStr = String(name || '');
  const fullBlob = `${nameStr} ${scope || ''}`;
  for (const row of PACKAGE_NAME_TO_RULE_KEY) {
    if (row.test.test(nameStr)) return row.key;
  }
  for (const row of PACKAGE_NAME_TO_RULE_KEY) {
    if (row.test.test(fullBlob)) return row.key;
  }
  return null;
}

/** Planning qty when measurements/notes are missing — enables saved template $/sqft on demo/install rows. */
export function inferPlanningQuantityForPackage(
  packageName: string,
  scopeText: string,
  draft?: { projectType?: string; estimateTier?: string; originalNotes?: string } | null
): { quantity: number; unit: string } | null {
  const tier = String(draft?.estimateTier || '').toLowerCase();
  const pt = String(draft?.projectType || '').toLowerCase();
  const notes = String(draft?.originalNotes || '');
  const isRemodel =
    tier === 'room_remodel' ||
    tier === 'addition' ||
    tier === 'ground_up' ||
    ['bathroom', 'bath', 'kitchen', 'flooring'].includes(pt) ||
    /\b(bath(?:room)?\s+remodel|kitchen\s+remodel|floor\s+job|floor\s+remodel)\b/i.test(notes);
  if (!isRemodel) return null;

  const blob = `${packageName} ${scopeText}`.toLowerCase();
  if (/shower/.test(blob) && /tile/.test(blob) && !/\b(demo|removal)\b/.test(blob)) {
    return { quantity: 90, unit: 'sqft' };
  }
  if ((/floor/.test(blob) && /tile/.test(blob)) || /\btile\s+demo\b/.test(blob)) {
    return { quantity: 45, unit: 'sqft' };
  }
  if (/tile/.test(blob) && /\binstall/.test(blob) && !/\b(demo|removal)\b/.test(blob)) {
    return { quantity: /\bshower\b/.test(blob) || /\bshower\b/.test(notes.toLowerCase()) ? 90 : 45, unit: 'sqft' };
  }
  if (/\b(demo|removal|tear[\s-]?out)\b/.test(blob) && /\btile\b/.test(blob)) {
    return { quantity: 45, unit: 'sqft' };
  }
  if (/\b(paint|painting)\b/.test(blob) && !/\b(floor|tile|exterior)\b/.test(blob)) {
    return { quantity: 175, unit: 'sqft' };
  }
  return null;
}

export function checklistItemInScope(item: {
  inputType?: string;
  state?: string;
  choiceId?: string | null;
  choiceIds?: string[];
}): boolean {
  if (item.inputType === 'multi_choice') {
    const ids = item.choiceIds ?? [];
    if (!ids.length || ids.includes('not_in_scope') || ids.includes('unsure')) return false;
    if (ids.includes('no_changes') && !ids.some((id) => id === 'remove' || id === 'add')) return false;
    return ids.some((id) => id === 'remove' || id === 'add');
  }
  if (item.inputType === 'choice') {
    return Boolean(item.choiceId && item.choiceId !== 'not_in_scope' && item.choiceId !== 'unsure');
  }
  return item.state === 'included';
}

export function countScopePricingReadiness(
  items: Array<{ id: string; inputType?: string; state?: string; choiceId?: string | null }>,
  measurements: NormalizedScopeMeasurements,
  templateKey?: string | null,
  notes?: string | null
): { ready: number; needsMeasurement: number } {
  let ready = 0;
  let needsMeasurement = 0;
  for (const item of items) {
    if (!checklistItemInScope(item)) continue;
    const rule = getChecklistItemQuantityRule(item.id, templateKey);
    if (!rule) continue;
    const resolved = resolveChecklistItemQuantity(item.id, measurements, {
      choiceId: item.choiceId,
      templateKey,
      notes,
    });
    if (!resolved.showInput && !resolved.pricingReady) continue;
    if (resolved.pricingReady) ready += 1;
    else needsMeasurement += 1;
  }
  return { ready, needsMeasurement };
}

function countPackageScopeReadiness(draft: EstimateAiDraft): { ready: number; needsMeasurement: number } {
  let ready = 0;
  let needsMeasurement = 0;
  const packages = draft.scopePackages?.length
    ? draft.scopePackages
    : (draft.rooms || []).map((room) => ({
        scopeQuantities: room.scopeQuantities,
        price: room.price,
        knownSubtotal: room.knownSubtotal,
      }));
  for (const pkg of packages) {
    const q = pkg.scopeQuantities?.[0];
    const priced = (pkg.price ?? 0) > 0 || (pkg.knownSubtotal ?? 0) > 0;
    if (q && q.quantity > 0) ready += 1;
    else if (!priced) needsMeasurement += 1;
  }
  return { ready, needsMeasurement };
}

export function countDraftPricingReadiness(draft: EstimateAiDraft | null | undefined): {
  ready: number;
  needsMeasurement: number;
} {
  if (!draft) return { ready: 0, needsMeasurement: 0 };
  const items = draft.confirmedAssumptions || draft.scopeChecklist?.items || [];
  const norm = normalizeScopeMeasurements(draft.scopeMeasurements);
  const fromChecklist = countScopePricingReadiness(items, norm);
  const fromPackages = countPackageScopeReadiness(draft);
  return {
    ready: Math.max(fromChecklist.ready, fromPackages.ready),
    needsMeasurement:
      fromPackages.ready > fromChecklist.ready
        ? fromPackages.needsMeasurement
        : fromChecklist.needsMeasurement,
  };
}

export function buildNormalizedScopeMeasurementsFromInput(
  input: ScopeMeasurementsInputExtended,
  options?: { notes?: string | null; templateKey?: string | null }
): NormalizedScopeMeasurements {
  let extended = syncDualAllowanceSqftFields(input);
  const notes = String(options?.notes || '').trim();
  if (notes) {
    extended = reparseRatePricingIntoItemQuantities(extended, notes, options?.templateKey);
  }
  return normalizeScopeMeasurements(scopeMeasurementsToPayload(extended));
}

/** Persist scope measurements with rate-pricing subkeys baked from notes when available. */
export function scopeMeasurementsPayloadForPersist(
  input: ScopeMeasurementsInputExtended,
  options?: { notes?: string | null; templateKey?: string | null }
): ScopeMeasurements {
  let extended = syncDualAllowanceSqftFields(input);
  const notes = String(options?.notes || '').trim();
  if (notes) {
    extended = reparseRatePricingIntoItemQuantities(extended, notes, options?.templateKey);
  }
  return scopeMeasurementsToPayload(extended);
}

export function scopeMeasurementsToPayload(
  input: ScopeMeasurementsInputExtended
): ScopeMeasurements {
  const sanitized = sanitizeMistakenUnitRateAllowances(input);
  const itemQuantities: Record<string, ScopeItemQuantityValue> = {};
  for (const [id, raw] of Object.entries(sanitized.itemQuantities || {})) {
    const q = parseScopeMeasurementInput(raw.quantity);
    if (q) {
      itemQuantities[id] = {
        quantity: q,
        unit: raw.unit,
        quantitySource: raw.quantitySource,
        ...(raw.includesCountertops ? { includesCountertops: true } : {}),
      };
    }
  }
  const payload: ScopeMeasurements = {
    bathroomFloorSqft: parseScopeMeasurementInput(sanitized.bathroomFloorSqft),
    kitchenFloorSqft: parseScopeMeasurementInput(sanitized.kitchenFloorSqft),
    floorAreaSqft: parseScopeMeasurementInput(sanitized.floorAreaSqft),
    backsplashSqft: parseScopeMeasurementInput(sanitized.backsplashSqft),
    countertopSqft: parseScopeMeasurementInput(sanitized.countertopSqft),
    cabinetLf: parseScopeMeasurementInput(sanitized.cabinetLf),
    landscapeSqft: parseScopeMeasurementInput(sanitized.landscapeSqft),
    sodSqft: parseScopeMeasurementInput(sanitized.sodSqft),
    paverSqft: parseScopeMeasurementInput(sanitized.paverSqft),
    rockMulchSqft: parseScopeMeasurementInput(sanitized.rockMulchSqft),
    landscapeTons: parseScopeMeasurementInput(sanitized.landscapeTons),
    roofSquares: parseScopeMeasurementInput(sanitized.roofSquares),
    drywallSqft: parseScopeMeasurementInput(sanitized.drywallSqft),
    concreteSqft: parseScopeMeasurementInput(sanitized.concreteSqft),
    concreteCy: parseScopeMeasurementInput(sanitized.concreteCy),
    excavationCy: parseScopeMeasurementInput(sanitized.excavationCy),
    deckSqft: parseScopeMeasurementInput(sanitized.deckSqft),
    exteriorPaintSqft: parseScopeMeasurementInput(sanitized.exteriorPaintSqft),
    railingLf: parseScopeMeasurementInput(sanitized.railingLf),
    baseboardLf: parseScopeMeasurementInput(sanitized.baseboardLf),
    showerWallTileSqft: parseScopeMeasurementInput(sanitized.showerWallTileSqft),
    showerFloorTileSqft: parseScopeMeasurementInput(sanitized.showerFloorTileSqft),
    wallPaintSqft: parseScopeMeasurementInput(sanitized.wallPaintSqft),
    sqft: parseScopeMeasurementInput(sanitized.bathroomFloorSqft),
    lf: parseScopeMeasurementInput(sanitized.baseboardLf),
    itemQuantities: Object.keys(itemQuantities).length ? itemQuantities : undefined,
  };
  return payload;
}

function measurementFieldString(value: unknown): string {
  const n = parseScopeMeasurementInput(String(value ?? ''));
  return n != null && n > 0 ? String(n) : '';
}

/** Round-trip persisted payload back into Confirm Scope form state. */
export function scopeMeasurementsInputFromPayload(
  payload: ScopeMeasurements
): ScopeMeasurementsInputExtended {
  const base = emptyQuickMeasurementInput();
  const itemQuantities: ScopeMeasurementsInputExtended['itemQuantities'] = {};
  for (const [id, val] of Object.entries(payload.itemQuantities || {})) {
    if (!val?.quantity) continue;
    itemQuantities[id] = {
      quantity: String(val.quantity),
      unit: val.unit || 'sqft',
      quantitySource: val.quantitySource,
      ...(val.includesCountertops ? { includesCountertops: true } : {}),
    };
  }
  return {
    ...base,
    bathroomFloorSqft: measurementFieldString(payload.bathroomFloorSqft ?? payload.sqft),
    kitchenFloorSqft: measurementFieldString(payload.kitchenFloorSqft),
    floorAreaSqft: measurementFieldString(payload.floorAreaSqft),
    backsplashSqft: measurementFieldString(payload.backsplashSqft),
    countertopSqft: measurementFieldString(payload.countertopSqft),
    cabinetLf: measurementFieldString(payload.cabinetLf),
    landscapeSqft: measurementFieldString(payload.landscapeSqft),
    sodSqft: measurementFieldString(payload.sodSqft),
    paverSqft: measurementFieldString(payload.paverSqft),
    rockMulchSqft: measurementFieldString(payload.rockMulchSqft),
    landscapeTons: measurementFieldString(payload.landscapeTons),
    roofSquares: measurementFieldString(payload.roofSquares),
    drywallSqft: measurementFieldString(payload.drywallSqft),
    concreteSqft: measurementFieldString(payload.concreteSqft),
    concreteCy: measurementFieldString(payload.concreteCy),
    excavationCy: measurementFieldString(payload.excavationCy),
    deckSqft: measurementFieldString(payload.deckSqft),
    exteriorPaintSqft: measurementFieldString(payload.exteriorPaintSqft),
    railingLf: measurementFieldString(payload.railingLf),
    baseboardLf: measurementFieldString(payload.baseboardLf),
    showerWallTileSqft: measurementFieldString(payload.showerWallTileSqft),
    showerFloorTileSqft: measurementFieldString(payload.showerFloorTileSqft),
    wallPaintSqft: measurementFieldString(payload.wallPaintSqft),
    itemQuantities,
  };
}

/** Sync sqft fields, sanitize mistaken rates, and bake sqft × $/sqft totals for the form. */
export function prepareScopeMeasurementsInputForUi(
  input: ScopeMeasurementsInputExtended,
  options?: { notes?: string | null; templateKey?: string | null }
): ScopeMeasurementsInputExtended {
  const notes = String(options?.notes || '').trim();
  const payload = scopeMeasurementsPayloadForPersist(input, options);
  if (!notes) return scopeMeasurementsInputFromPayload(payload);

  const parsed = parseScopeMeasurementsFromNotes(notes, {
    templateKey: options?.templateKey ?? undefined,
  });
  const itemQuantities = {
    ...(payload.itemQuantities || {}),
    ...(parsed.itemQuantities || {}),
  };
  clearStalePricingWhenNotesUnpriced(itemQuantities, notes, parsed.itemQuantities);

  return scopeMeasurementsInputFromPayload({
    ...payload,
    ...parsed,
    itemQuantities,
  });
}

export type ScopeMeasurementsInputExtended = ReturnType<typeof emptyQuickMeasurementInput> & {
  itemQuantities: Record<
    string,
    { quantity: string; unit: string; quantitySource?: QuantitySource; includesCountertops?: boolean }
  >;
};

export function initialScopeMeasurementInputExtended(
  draft: {
    scopeMeasurements?: ScopeMeasurements | null;
    originalNotes?: string | null;
    scopeChecklist?: { templateKey?: string; suggestedMeasurements?: ScopeMeasurements | null } | null;
    projectType?: string | null;
  } | null,
  notesOverride?: string | null
): ScopeMeasurementsInputExtended {
  const saved = draft?.scopeMeasurements;
  const suggested = draft?.scopeChecklist?.suggestedMeasurements;
  const scopeNotes = String(notesOverride || resolveDraftScopeNotes(draft) || '').trim();
  const parsedFromNotes = scopeNotes
    ? parseScopeMeasurementsFromNotes(scopeNotes, {
        templateKey: draft?.scopeChecklist?.templateKey,
        projectType: draft?.projectType ?? undefined,
      })
    : {};
  // Fresh notes parse wins over stale suggestedMeasurements persisted on older drafts
  const parsed = {
    ...suggested,
    ...parsedFromNotes,
    itemQuantities: {
      ...(suggested?.itemQuantities || {}),
      ...(parsedFromNotes.itemQuantities || {}),
    },
  };

  const itemQuantities: ScopeMeasurementsInputExtended['itemQuantities'] = {};
  const putItemQuantity = (
    id: string,
    val: { quantity: number | string; unit: string; quantitySource?: QuantitySource; includesCountertops?: boolean }
  ) => {
    if (val.quantity == null || Number(val.quantity) <= 0 || !val.unit) return;
    const includesCountertops = val.includesCountertops;
    if (id.endsWith('__allowance')) {
      itemQuantities[id] = {
        quantity: String(val.quantity),
        unit: val.unit || 'lump_sum',
        quantitySource: val.quantitySource,
      };
      return;
    }
    if (isDualAllowanceItem(id) && (val.unit === 'allowance' || val.unit === 'lump_sum')) {
      itemQuantities[roughAllowanceSubKey(id)] = {
        quantity: String(val.quantity),
        unit: val.unit || 'lump_sum',
        quantitySource: val.quantitySource,
      };
      return;
    }
    itemQuantities[id] = {
      quantity: String(val.quantity),
      unit: val.unit,
      quantitySource: val.quantitySource,
      ...(includesCountertops ? { includesCountertops: true } : {}),
    };
  };

  const isPricingSubKey = (id: string) => /__(?:material|labor|allowance)$/.test(id);

  for (const [id, val] of Object.entries(saved?.itemQuantities || {})) {
    if (!val.quantity) continue;
    // Never hydrate stale rate splits from saved scope — always reparse from notes below.
    if (isPricingSubKey(id)) continue;
    putItemQuantity(id, {
      quantity: val.quantity,
      unit: val.unit,
      quantitySource: val.quantitySource,
      includesCountertops: (val as ScopeItemQuantityValue).includesCountertops,
    });
  }

  const mergeParsedItemQuantities = (
    source: Record<string, ScopeItemQuantityValue> | undefined
  ) => {
    for (const [id, val] of Object.entries(source || {})) {
      if (id === 'demo' && parsedFromNotes.itemQuantities?.floor_demo && !parsedFromNotes.itemQuantities?.demo) {
        continue;
      }
      const existing = itemQuantities[id];
      const notesQty = String(val.quantity);
      if (existing?.quantity && existing.quantitySource === 'user_entered') {
        if (existing.quantity === notesQty || isPricingSubKey(id)) {
          putItemQuantity(id, {
            quantity: val.quantity,
            unit: val.unit,
            quantitySource: 'notes',
            includesCountertops: (val as { includesCountertops?: boolean }).includesCountertops,
          });
        }
        continue;
      }
      putItemQuantity(id, {
        quantity: val.quantity,
        unit: val.unit,
        quantitySource: val.quantitySource || 'notes',
        includesCountertops: (val as { includesCountertops?: boolean }).includesCountertops,
      });
    }
  };

  // Backend suggestedMeasurements first, then fresh notes parse — current notes win over stale server/saved totals.
  mergeParsedItemQuantities(suggested?.itemQuantities as Record<string, ScopeItemQuantityValue>);
  mergeParsedItemQuantities(parsedFromNotes.itemQuantities as Record<string, ScopeItemQuantityValue>);
  clearStalePricingWhenNotesUnpriced(itemQuantities, scopeNotes, parsedFromNotes.itemQuantities);

  const cabinetsEntry = itemQuantities.cabinets;
  if (cabinetsEntry) {
    const combinedFlag =
      parsedFromNotes.itemQuantities?.cabinets?.includesCountertops ||
      suggested?.itemQuantities?.cabinets?.includesCountertops ||
      notesHaveCombinedCabinetsCounters(scopeNotes);
    if (combinedFlag) {
      itemQuantities.cabinets = { ...cabinetsEntry, includesCountertops: true };
    }
  }

  const pick = (key: QuickMeasurementFieldKey) => {
    const parsedNoteValueRaw = parsedFromNotes[key as keyof typeof parsedFromNotes];
    const parsedNoteValue =
      typeof parsedNoteValueRaw === 'number' || typeof parsedNoteValueRaw === 'string'
        ? parsedNoteValueRaw
        : undefined;
    const fromNotes =
      parsedNoteValue ??
      suggested?.[key as keyof ScopeMeasurements];
    const s = saved?.[key as keyof ScopeMeasurements];
    const backsplashFromNotes = parsedFromNotes.backsplashSqft;

    if (parsedNoteValue != null && Number(parsedNoteValue) > 0) {
      return String(parsedNoteValue);
    }

    // Paint sqft often stale at 45 when it duplicated backsplash on older drafts / parsers
    if (key === 'wallPaintSqft' && fromNotes != null && Number(fromNotes) > 0) {
      const savedNum = s != null ? Number(s) : null;
      const leaked =
        savedNum != null &&
        backsplashFromNotes != null &&
        savedNum === Number(backsplashFromNotes) &&
        Number(fromNotes) !== savedNum;
      if (leaked || savedNum == null || savedNum <= 0) {
        return String(fromNotes);
      }
    }

    if (s != null && Number(s) > 0) return String(s);
    if (fromNotes != null && Number(fromNotes) > 0) return String(fromNotes);
    return '';
  };

  const hasBaseboardNotes = /\b(baseboards?|trim|crown|moulding|molding|casing)\b/i.test(scopeNotes);
  const pickBaseboardLf = () => {
    if (!hasBaseboardNotes) return '';
    const fromNotes =
      parsedFromNotes.baseboardLf ??
      suggested?.baseboardLf;
    if (fromNotes != null && Number(fromNotes) > 0) return String(fromNotes);
    return pick('baseboardLf') || (saved?.lf ? String(saved.lf) : parsed.lf ? String(parsed.lf) : '');
  };

  const base = emptyQuickMeasurementInput();
  let result: ScopeMeasurementsInputExtended = {
    ...base,
    bathroomFloorSqft:
      pick('bathroomFloorSqft') ||
      (saved?.sqft ? String(saved.sqft) : parsed.sqft ? String(parsed.sqft) : ''),
    kitchenFloorSqft: pick('kitchenFloorSqft'),
    floorAreaSqft: pick('floorAreaSqft'),
    backsplashSqft: pick('backsplashSqft'),
    countertopSqft: pick('countertopSqft'),
    cabinetLf: pick('cabinetLf'),
    landscapeSqft: pick('landscapeSqft'),
    sodSqft: pick('sodSqft'),
    paverSqft: pick('paverSqft'),
    rockMulchSqft: pick('rockMulchSqft'),
    landscapeTons: pick('landscapeTons'),
    roofSquares: pick('roofSquares'),
    drywallSqft: pick('drywallSqft'),
    concreteSqft: pick('concreteSqft'),
    concreteCy: pick('concreteCy'),
    excavationCy: pick('excavationCy'),
    deckSqft: pick('deckSqft'),
    exteriorPaintSqft: pick('exteriorPaintSqft'),
    railingLf: pick('railingLf'),
    baseboardLf: pickBaseboardLf(),
    showerWallTileSqft: pick('showerWallTileSqft'),
    showerFloorTileSqft: pick('showerFloorTileSqft'),
    wallPaintSqft: pick('wallPaintSqft'),
    itemQuantities,
  };

  result = syncDualAllowanceSqftFields(result);
  result = sanitizeMistakenUnitRateAllowances(result);
  result = reparseRatePricingIntoItemQuantities(
    result,
    scopeNotes,
    draft?.scopeChecklist?.templateKey
  );

  if (result.itemQuantities.cabinets) {
    const combinedFlag =
      parsedFromNotes.itemQuantities?.cabinets?.includesCountertops ||
      suggested?.itemQuantities?.cabinets?.includesCountertops ||
      notesHaveCombinedCabinetsCounters(scopeNotes) ||
      Boolean(result.itemQuantities.cabinets.includesCountertops);
    if (combinedFlag) {
      result.itemQuantities.cabinets = {
        ...result.itemQuantities.cabinets,
        includesCountertops: true,
      };
    }
  }

  return result;
}
