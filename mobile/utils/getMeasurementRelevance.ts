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

/** Whole-home templates keep the full Quick measurements card visible. */
function isWholeHomeTemplate(templateKey?: string | null): boolean {
  const key = String(templateKey || '').toLowerCase();
  return key === 'ground_up' || key === 'addition';
}

/** Quick Measurement key → checklist item ids that consume it for pricing/quantity. */
const RELATED_SCOPE_KEYS: Partial<Record<QuickMeasurementFieldKey, string[]>> = {
  bathroomFloorSqft: ['floor_tile', 'floor_demo', 'flooring', 'floor_prep'],
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
  tilePanBathCount?: number | null;
  wholeHomeLayout?: boolean;
  /** ground_up / addition show the full field list — not only scopes currently included. */
  templateKey?: string | null;
}): MeasurementRelevance {
  const { measurementKey } = params;
  const relatedScopeKeys = RELATED_SCOPE_KEYS[measurementKey] || [];
  const wholeHome = isWholeHomeTemplate(params.templateKey);
  const splitTile = isSplitTileWetAreaCounts({
    templateKey: params.templateKey,
    wholeHomeLayout: params.wholeHomeLayout,
  });

  // Tub / prefab pans use a manufactured base — shower floor tile SF is not used.
  if (measurementKey === 'showerFloorTileSqft') {
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
    } else if (params.wetAreaFinish === 'tub' || params.wetAreaFinish === 'prefab') {
      return {
        relevant: false,
        blockingPrice: false,
        relatedScopeKeys,
        reason: 'Shower floor tile SF is not used for tub or prefab wet-area finishes.',
      };
    }
  }

  // Alcove tub — no tiled shower walls to take off (prefab can still have tile walls).
  if (measurementKey === 'showerWallTileSqft' && params.wetAreaFinish === 'tub') {
    return {
      relevant: false,
      blockingPrice: false,
      relatedScopeKeys,
      reason: 'Shower wall tile SF is not used for tub wet-area finishes.',
    };
  }

  const includedSet = new Set(params.includedScopeKeys);
  const floorWorkScope = ['floor_tile', 'floor_demo', 'flooring', 'floor_prep'];
  const floorWorkIncluded = floorWorkScope.some((id) => includedSet.has(id));

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
      reason: 'Not needed unless bath floor tile or flooring demo/install is in this bid.',
    };
  }

  if (ALWAYS_RELEVANT_KEYS.has(measurementKey) || wholeHome) {
    return {
      relevant: true,
      blockingPrice: ALWAYS_RELEVANT_KEYS.has(measurementKey) || relatedScopeKeys.length > 0,
      relatedScopeKeys,
      reason: wholeHome
        ? 'Whole-home bid — keep full Quick measurements visible.'
        : 'Core structural measurement used across the bid.',
    };
  }

  if (!relatedScopeKeys.length) {
    return { relevant: true, blockingPrice: false, relatedScopeKeys: [] };
  }

  const noteSet = new Set(params.noteBackedKeys || []);
  const scopeIncluded = relatedScopeKeys.some((id) => includedSet.has(id));
  const relevant = scopeIncluded || noteSet.has(measurementKey);

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
