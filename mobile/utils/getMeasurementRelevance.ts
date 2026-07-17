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
  'kitchenFloorSqft',
]);

/** Quick Measurement key → checklist item ids that consume it for pricing/quantity. */
const RELATED_SCOPE_KEYS: Partial<Record<QuickMeasurementFieldKey, string[]>> = {
  bathroomFloorSqft: ['tile_flooring', 'flooring', 'floor_tile', 'bathroom', 'bath_floor', 'interior_finishes'],
  concreteSqft: ['concrete', 'pour_flatwork', 'sidewalk', 'patio', 'driveway', 'concrete_patio'],
  concreteCy: ['foundation', 'pour_foundation'],
  excavationCy: ['excavation', 'sitework'],
  roofSquares: ['roofing', 'shingles_roofing', 'roof_tie_in', 'tear_off'],
  drywallSqft: ['drywall', 'hang', 'finish_tape', 'interior_finishes'],
  wallPaintSqft: ['paint', 'interior_paint', 'paint_trim', 'interior_finishes'],
  // Exterior wall faces inform insulation envelope walls (not drywall interior surface).
  exteriorPaintSqft: ['exterior_paint', 'paint_trim', 'stucco', 'exterior', 'insulation'],
  cabinetLf: ['cabinets', 'cabinets_counters'],
  countertopSqft: ['countertops', 'cabinets_counters'],
  showerWallTileSqft: ['shower_tile', 'waterproofing', 'tile_flooring', 'tile_shower', 'interior_finishes'],
  showerFloorTileSqft: ['shower_tile', 'shower_floor_tile', 'tile_flooring', 'tile_shower', 'interior_finishes'],
  baseboardLf: ['trim', 'baseboard', 'interior_trim', 'paint_trim'],
  railingLf: ['railing', 'fencing'],
  backsplashSqft: ['backsplash'],
  paverSqft: ['pavers', 'hardscape', 'landscaping'],
  sodSqft: ['sod', 'landscaping'],
  rockMulchSqft: ['rock_mulch', 'landscaping'],
  landscapeTons: ['rock_mulch', 'landscaping'],
  landscapeSqft: ['landscaping'],
};

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
}): MeasurementRelevance {
  const { measurementKey } = params;

  if (ALWAYS_RELEVANT_KEYS.has(measurementKey)) {
    return {
      relevant: true,
      blockingPrice: true,
      relatedScopeKeys: [],
      reason: 'Core structural measurement used across the bid.',
    };
  }

  const relatedScopeKeys = RELATED_SCOPE_KEYS[measurementKey] || [];
  if (!relatedScopeKeys.length) {
    return { relevant: true, blockingPrice: false, relatedScopeKeys: [] };
  }

  const includedSet = new Set(params.includedScopeKeys);
  const noteSet = new Set(params.noteBackedKeys || []);
  const scopeIncluded = relatedScopeKeys.some((id) => includedSet.has(id));
  let relevant = scopeIncluded || noteSet.has(measurementKey);

  // Tub / prefab wet areas do not need shower tile SF suggestions.
  if (
    relevant &&
    (measurementKey === 'showerWallTileSqft' || measurementKey === 'showerFloorTileSqft') &&
    (params.wetAreaFinish === 'tub' || params.wetAreaFinish === 'prefab')
  ) {
    return {
      relevant: false,
      blockingPrice: false,
      relatedScopeKeys,
      reason: 'Shower tile measurements are not used for tub or prefab wet-area finishes.',
    };
  }

  return {
    relevant,
    blockingPrice: relevant,
    relatedScopeKeys,
    reason: relevant ? undefined : `Not needed unless ${relatedLabel(relatedScopeKeys)} is included in this bid.`,
  };
}

/** Copy for pricing-readiness / planning-vs-firm messaging. */
export const PLANNING_BID_CONFIDENCE_COPY =
  'Plan measurements and accepted suggestions structure a solid planning bid. For a firm sellable price, still confirm cabinets, counters, shower tile, exterior flatwork, and verify foundation/excavation and roof pitch against the plans.';
