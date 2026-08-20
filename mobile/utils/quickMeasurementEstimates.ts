/**
 * Hierarchical planning quantities. These never write into pricing until the
 * contractor accepts them. Exact plan facts/geometry win; missing inputs
 * degrade to transparent, low-confidence fallbacks rather than masquerading
 * as plan takeoff.
 */
import { executeFormula } from '@/utils/scopeFormulaRegistry';
import type { PlanRoomMeasurement } from '@/utils/estimateAiDraft';
import type { QuickMeasurementFieldKey } from '@/utils/scopeQuickMeasurements';
import {
  resolveEffectiveWetAreaFinish,
  resolveShowerWallBathCount,
  resolveTilePanBathCount,
  TYPICAL_SHOWER_FLOOR_SQFT_PER_BATH,
  TYPICAL_SHOWER_WALL_SQFT_PER_BATH,
  type WetAreaFinishChoice,
} from '@/utils/planBathRooms';
import {
  geometryArea,
  geometryPerimeter,
  planFirstFloorLivingSqft,
  planTotalLivingSqft,
  type MeasurementSuggestion,
  type PlanEvidence,
  type PlanFacts,
  type PlanMeasurementConfidence,
  type PlanMeasurementSourceType,
} from '@/utils/planMeasurementFacts';
import { enrichPlanFactsWithSouthernUtahBarometer } from '@/utils/southernUtahPlanFacts';
import {
  insulationEnvelopeInputsFromPlanFacts,
  resolveInsulationEnvelopePlanningQuantity,
  type InsulationEnvelopeInputs,
} from '@/utils/insulationEnvelopeQuantity';

export type QuickMeasurementEstimate = MeasurementSuggestion & {
  key: QuickMeasurementFieldKey;
  summary: string;
  basis: string;
  quantityLabel?: string;
};

type MeasurementLookup = Partial<
  Record<QuickMeasurementFieldKey, string | number | null | undefined>
> & {
  planFacts?: PlanFacts;
  planRooms?: PlanRoomMeasurement[];
  wetAreaFinish?: WetAreaFinishChoice | null;
  bathCount?: number | null;
  prefabBathCount?: number | null;
  tubBathCount?: number | null;
  itemQuantities?: Record<
    string,
    {
      quantity?: string | number | null;
      unit?: string;
      quantitySource?: string;
    }
  >;
};

function n(value: unknown): number | null {
  const parsed = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Roofing pitch → true-area multiplier (rise:run). */
const PITCH_MULTIPLIERS: Record<string, number> = {
  'low-slope': 1.014,
  '1:12': 1.003,
  '2:12': 1.014,
  '3:12': 1.03,
  '4:12': 1.054,
  '5:12': 1.083,
  '6:12': 1.118,
  '7:12': 1.158,
  '8:12': 1.202,
  '9:12': 1.25,
  '10:12': 1.302,
  '12:12': 1.414,
};
const DEFAULT_ROOF_PITCH = '5:12';
const ROOF_WASTE_FACTOR = 0.1;

/**
 * Slab-on-grade foundation excavation: footing trench + thin pad scrape.
 * Does NOT excavate the full building footprint to frost depth (that modeled
 * a basement/full-site dig and produced unrealistically high CY).
 */
const FOOTING_TRENCH_WIDTH_FT = 3; // footing width + working room each side
const FOOTING_TRENCH_DEPTH_FT = 3; // typical footing dig
const SLAB_OVEREX_DEPTH_FT = 0.5; // thin scrape under living + garage slab only

const FOOTING_WIDTH_FT = 1.5;
const FOOTING_DEPTH_FT = 1;
const STEM_WALL_HEIGHT_FT = 2.5;
const STEM_WALL_THICKNESS_FT = 0.667;
const SLAB_THICKNESS_FT = 4 / 12;
const FOUNDATION_WASTE_FACTOR = 0.1;
const INTERIOR_FOOTING_RATIO = 0.15;

const EXTERIOR_WALL_HEIGHT_FT = 9;
const EXTERIOR_OPENINGS_DEDUCTION = 0.15;
const DEFAULT_NON_PAINTED_DEDUCTION = 0;
const FORMULA_VERSION = '2.3.0';
const DRYWALL_PARTITION_SURFACE_FACTOR = 1.8;
const DRYWALL_OPENINGS_DEDUCTION = 0.05;
/** Approximate wall coverage behind base + wall cabinet runs. */
const CABINET_COVERED_HEIGHT_FT = 7;
const MIN_ROOMS_FOR_SURFACE_MODEL = 3;
const GARAGE_ROOM_RE = /\b(rv\s*)?garage\b/i;

/** Rough perimeter from a footprint area, assuming a roughly square building. */
function estimatedPerimeterFt(footprintSqft: number): number {
  return 4 * Math.sqrt(footprintSqft);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Display rounding: roof squares keep 1 decimal; surface/CY/LF show whole numbers. */
export function roundSuggestedDisplayNumber(
  value: number,
  unit: string
): number {
  const u = String(unit || '').toLowerCase();
  if (u === 'sq' || u === 'squares') return round1(value);
  return Math.round(value);
}

export function formatSuggestedDisplayValue(
  value: number,
  unit: string
): string {
  return `${roundSuggestedDisplayNumber(value, unit).toLocaleString()} ${unit}`;
}

function evidenceFor(
  facts: PlanFacts | undefined,
  keys: string[]
): PlanEvidence[] {
  const evidence: PlanEvidence[] = [];
  for (const key of keys) {
    evidence.push(
      ...(facts?.fieldEvidence?.[key]?.evidence ||
        facts?.fieldEvidence?.[`buildingAreas.${key}`]?.evidence ||
        [])
    );
  }
  return evidence;
}

function pitchMultiplier(pitch: string): number {
  return PITCH_MULTIPLIERS[pitch] || PITCH_MULTIPLIERS[DEFAULT_ROOF_PITCH];
}

function component(
  label: string,
  value: number,
  unit: string,
  operation?: string
): QuickMeasurementEstimate['calculationBreakdown'][number] {
  return { label, value: round1(value), unit, operation };
}

function baseEstimate(params: {
  key: QuickMeasurementFieldKey;
  value: number;
  unit: string;
  sourceType: PlanMeasurementSourceType;
  confidence: PlanMeasurementConfidence;
  confidenceReason: string;
  formulaId: string;
  basis: string;
  inputsUsed: QuickMeasurementEstimate['inputsUsed'];
  assumptions: string[];
  includedComponents: string[];
  excludedComponents: string[];
  warning?: string | null;
  planEvidence?: PlanEvidence[];
  calculationBreakdown: QuickMeasurementEstimate['calculationBreakdown'];
  quantityLabel?: string;
}): QuickMeasurementEstimate {
  const displayValue = roundSuggestedDisplayNumber(params.value, params.unit);
  return {
    ...params,
    // Persist the same number the contractor sees on the suggestion row.
    value: displayValue,
    formulaVersion: FORMULA_VERSION,
    requiresConfirmation: true,
    planEvidence: params.planEvidence || [],
    summary: formatSuggestedDisplayValue(params.value, params.unit),
  };
}

function floorAreas(
  facts: PlanFacts | undefined,
  fallbackLiving: number
): number[] {
  const areas = facts?.buildingAreas;
  const explicit = [
    n(areas?.mainFloorLivingSqft),
    n(areas?.upstairsLivingSqft),
    ...(areas?.additionalFloorAreas || []).map(n),
  ].filter((value): value is number => value != null);
  return explicit.length ? explicit : [fallbackLiving];
}

function labeledWallHeightFt(facts: PlanFacts | undefined): number | null {
  return n(facts?.wallHeightFt) ?? n(facts?.plateHeightFt);
}

function roomPerimeterFt(room: PlanRoomMeasurement): number | null {
  const length = n(room.lengthFt);
  const width = n(room.widthFt);
  if (length != null && width != null) return 2 * (length + width);
  const area = n(room.areaSqft);
  if (area != null) return 4 * Math.sqrt(area);
  return null;
}

function roomAreaSqft(room: PlanRoomMeasurement): number | null {
  const area = n(room.areaSqft);
  if (area != null) return area;
  const length = n(room.lengthFt);
  const width = n(room.widthFt);
  if (length != null && width != null)
    return Math.round(length * width * 10) / 10;
  return null;
}

function livingPlanRooms(
  rooms: PlanRoomMeasurement[] | undefined
): PlanRoomMeasurement[] {
  return (rooms || []).filter(
    room => !GARAGE_ROOM_RE.test(String(room.name || ''))
  );
}

type InteriorSurfaceModel = {
  ceilings: number;
  walls: number;
  openings: number;
  value: number;
  roomCount: number;
  usedExactDimensions: boolean;
};

/**
 * Room-perimeter surface model: ceilings = Σ room SF; walls = Σ 2(L+W)×height.
 * Shared partitions are counted once per abutting room (= both faces). Exterior
 * walls are counted once (= inside face). Garage rooms are excluded.
 */
function interiorSurfaceFromRooms(
  rooms: PlanRoomMeasurement[] | undefined,
  wallHeight: number
): InteriorSurfaceModel | null {
  const living = livingPlanRooms(rooms);
  let ceilings = 0;
  let walls = 0;
  let roomCount = 0;
  let usedExactDimensions = 0;
  for (const room of living) {
    const area = roomAreaSqft(room);
    const perimeter = roomPerimeterFt(room);
    if (area == null || perimeter == null) continue;
    ceilings += area;
    walls += perimeter * wallHeight;
    roomCount += 1;
    if (n(room.lengthFt) != null && n(room.widthFt) != null)
      usedExactDimensions += 1;
  }
  if (roomCount < MIN_ROOMS_FOR_SURFACE_MODEL) return null;
  const openings = (ceilings + walls) * DRYWALL_OPENINGS_DEDUCTION;
  return {
    ceilings: round1(ceilings),
    walls: round1(walls),
    openings: round1(openings),
    value: round1(ceilings + walls - openings),
    roomCount,
    usedExactDimensions: usedExactDimensions >= Math.ceil(roomCount * 0.5),
  };
}

function estimatedInteriorSurfaceFromFloorAreas(params: {
  totalLiving: number;
  areas: number[];
  wallHeight: number;
}): {
  ceilings: number;
  exteriorWalls: number;
  partitions: number;
  openings: number;
  value: number;
} {
  const ceilings = params.totalLiving;
  const exteriorWalls = params.areas.reduce(
    (sum, area) => sum + estimatedPerimeterFt(area) * params.wallHeight,
    0
  );
  const partitions = params.totalLiving * DRYWALL_PARTITION_SURFACE_FACTOR;
  const gross = ceilings + exteriorWalls + partitions;
  const openings = gross * DRYWALL_OPENINGS_DEDUCTION;
  return {
    ceilings: round1(ceilings),
    exteriorWalls: round1(exteriorWalls),
    partitions: round1(partitions),
    openings: round1(openings),
    value: round1(gross - openings),
  };
}

function finishPaintDeductions(measurements: MeasurementLookup): {
  showerWallTileSqft: number;
  backsplashSqft: number;
  cabinetCoverageSqft: number;
  total: number;
} {
  const showerWallTileSqft = n(measurements.showerWallTileSqft) ?? 0;
  const backsplashSqft = n(measurements.backsplashSqft) ?? 0;
  const cabinetLf = n(measurements.cabinetLf) ?? 0;
  const cabinetCoverageSqft =
    cabinetLf > 0 ? cabinetLf * CABINET_COVERED_HEIGHT_FT : 0;
  return {
    showerWallTileSqft,
    backsplashSqft,
    cabinetCoverageSqft: round1(cabinetCoverageSqft),
    total: round1(showerWallTileSqft + backsplashSqft + cabinetCoverageSqft),
  };
}

/**
 * Planning-estimate suggestion for a Quick Measurement key, or null when
 * there isn't enough footprint data to produce one. Only covers keys that
 * are empty candidates for a derived quantity — callers should only surface
 * this when the field itself has no value yet.
 */
/** True when stored squares match the bad total-living + garage + patio @ 5:12 path. */
export function isLegacyTotalLivingRoofSquares(
  roofSquares: number,
  measurements: MeasurementLookup
): boolean {
  const living = n(measurements.floorAreaSqft);
  if (living == null || !(roofSquares > 0)) return false;
  const garage =
    n(measurements.planFacts?.buildingAreas?.garageSqft) ??
    n(measurements.garageSqft) ??
    0;
  const patio =
    n(measurements.planFacts?.buildingAreas?.coveredPatioSqft) ??
    n(measurements.deckSqft) ??
    0;
  const legacy =
    ((living + garage + patio) *
      pitchMultiplier(DEFAULT_ROOF_PITCH) *
      (1 + ROOF_WASTE_FACTOR)) /
    100;
  return Math.abs(roofSquares - legacy) < 0.35;
}

/**
 * True when stored drywall SF is living-area (or near it) instead of wall+ceiling
 * surface — e.g. Plan 39 4,056 SF (~1.3× living) vs ~10.8k (3.5×).
 */
export function isUndercountedDrywallSurface(
  drywallSqft: number,
  livingSf: number | null | undefined
): boolean {
  const living = n(livingSf);
  if (!(drywallSqft > 0) || living == null) return false;
  if (Math.abs(drywallSqft - living) < 0.51) return true;
  return drywallSqft / living < 2.5;
}

function asMeasurementNumber<T extends MeasurementLookup>(
  measurements: T,
  key: 'roofSquares' | 'drywallSqft' | 'wallPaintSqft',
  value: number
): string | number {
  const unit = key === 'roofSquares' ? 'sq' : 'sqft';
  const rounded = roundSuggestedDisplayNumber(value, unit);
  return typeof measurements[key] === 'string' ? String(rounded) : rounded;
}

/**
 * Attach SHV barometer floor/pitch facts; replace bad roof squares and
 * undercounted drywall/paint surface SF (Plan 39 4,056 → ~10.8k @ ~$2.10/SF blend).
 */
export function syncMeasurementsWithSouthernUtahPlanFacts<
  T extends MeasurementLookup,
>(measurements: T, options?: { templateKey?: string | null }): T {
  const living = n(measurements.floorAreaSqft);
  const enriched = enrichPlanFactsWithSouthernUtahBarometer(
    measurements.planFacts,
    living
  );
  let next: T = enriched
    ? { ...measurements, planFacts: enriched }
    : { ...measurements };

  const insulationFlow =
    String(options?.templateKey || '').toLowerCase() === 'insulation' ||
    String(
      (measurements as MeasurementLookup).planImportTradeKey || ''
    ).toLowerCase() === 'insulation';
  if (insulationFlow && next.planFacts) {
    const planInsulation = next.planFacts as PlanFacts & {
      insulationMaterialType?: string | null;
      insulationRValue?: string | null;
      garageInsulationIncluded?: boolean | null;
    };
    if (
      !String(next.insulationMaterialType || '').trim() &&
      planInsulation.insulationMaterialType
    ) {
      next.insulationMaterialType = planInsulation.insulationMaterialType;
    }
    if (
      !String(next.insulationRValue || '').trim() &&
      planInsulation.insulationRValue
    ) {
      next.insulationRValue = planInsulation.insulationRValue;
    }
    if (
      next.garageInsulationIncluded == null &&
      planInsulation.garageInsulationIncluded != null
    ) {
      next.garageInsulationIncluded = planInsulation.garageInsulationIncluded
        ? 'yes'
        : 'no';
    }
    const envelope = resolveInsulationEnvelopePlanningQuantity(
      insulationEnvelopeInputsFromPlanFacts(
        next.planFacts,
        living,
        next as Partial<InsulationEnvelopeInputs>
      )
    );
    if (envelope) {
      const componentValues = Object.fromEntries(
        envelope.components
          .filter(component => {
            if (!component.included) return false;
            if (component.source === 'planning_assumption') return false;
            if (
              component.key === 'atticInsulationSqft' &&
              component.source !== 'contractor_entered' &&
              component.source !== 'detected_from_plan'
            ) {
              return false;
            }
            return true;
          })
          .map(component => [component.key, component.quantity])
      ) as Partial<T>;
      next = {
        ...next,
        ...Object.fromEntries(
          Object.entries(componentValues).filter(
            ([key]) => !Number((measurements as Record<string, unknown>)[key])
          )
        ),
      } as T;
    }
  }

  const roofEstimate = getQuickMeasurementEstimate(
    'roofSquares',
    next,
    next.planFacts
  );
  const currentRoof = n(measurements.roofSquares);
  // Only rewrite the bad total-living roof path — leave empty for QM "estimate available".
  if (
    roofEstimate &&
    currentRoof != null &&
    isLegacyTotalLivingRoofSquares(currentRoof, measurements)
  ) {
    next = {
      ...next,
      roofSquares: asMeasurementNumber(next, 'roofSquares', roofEstimate.value),
    };
  }

  const isGroundUp =
    String(options?.templateKey || '').toLowerCase() === 'ground_up';
  const currentDrywall = n(measurements.drywallSqft);
  // Ground-up only: rewrite thin notes drywall SF (4,056) to living×3.5 (10,843). Leave empty for QM.
  const formulaSurface = living != null ? Math.round(living * 3.5) : null;
  if (
    isGroundUp &&
    formulaSurface != null &&
    currentDrywall != null &&
    isUndercountedDrywallSurface(currentDrywall, living)
  ) {
    const drywallValue = asMeasurementNumber(
      next,
      'drywallSqft',
      formulaSurface
    );
    next = { ...next, drywallSqft: drywallValue };
    const currentPaint = n(measurements.wallPaintSqft);
    if (
      currentPaint != null &&
      (Math.abs(currentPaint - currentDrywall) < 1 ||
        isUndercountedDrywallSurface(currentPaint, living))
    ) {
      next = {
        ...next,
        wallPaintSqft: asMeasurementNumber(
          next,
          'wallPaintSqft',
          formulaSurface
        ),
      };
    }
    // Drop undercounted notes itemQuantities so resolve/pricing cannot keep $8.8k on 4,056 SF.
    if (next.itemQuantities) {
      const itemQuantities = { ...next.itemQuantities };
      for (const itemId of ['drywall', 'hang', 'finish_tape'] as const) {
        const entry = itemQuantities[itemId];
        const qty = n(entry?.quantity);
        if (
          entry &&
          entry.quantitySource !== 'user_entered' &&
          entry.quantitySource !== 'manual_override' &&
          qty != null &&
          isUndercountedDrywallSurface(qty, living)
        ) {
          delete itemQuantities[itemId];
        }
      }
      next = { ...next, itemQuantities };
    }
  }

  return next;
}

export function getQuickMeasurementEstimate(
  key: QuickMeasurementFieldKey,
  measurements: MeasurementLookup,
  suppliedFacts?: PlanFacts,
  templateKey?: string | null
): QuickMeasurementEstimate | null {
  const living = n(measurements.floorAreaSqft);
  const baseFacts = suppliedFacts || measurements.planFacts;
  // Roof footprint needs main-floor + pitch; cover sheets often omit those.
  const facts =
    key === 'roofSquares'
      ? enrichPlanFactsWithSouthernUtahBarometer(baseFacts, living) || baseFacts
      : baseFacts;
  const totalLiving = planTotalLivingSqft(facts, living);
  const firstFloorLiving = planFirstFloorLivingSqft(facts, living);
  const garage =
    n(facts?.buildingAreas?.garageSqft) ?? n(measurements.garageSqft) ?? 0;
  const patio =
    n(facts?.buildingAreas?.coveredPatioSqft) ?? n(measurements.deckSqft) ?? 0;
  const labeledHeight = labeledWallHeightFt(facts);
  const wallHeight = labeledHeight ?? EXTERIOR_WALL_HEIGHT_FT;
  const rooms = measurements.planRooms;

  switch (key) {
    case 'drywallSqft': {
      if (totalLiving == null && !livingPlanRooms(rooms).length) return null;
      const roomSurface = interiorSurfaceFromRooms(rooms, wallHeight);
      if (roomSurface) {
        const planSupported = Boolean(
          labeledHeight && roomSurface.usedExactDimensions
        );
        return baseEstimate({
          key,
          value: roomSurface.value,
          unit: 'sqft',
          // Room-perimeter math is plan-supported planning, not measured geometry.
          sourceType: 'estimated_from_formula',
          confidence: planSupported ? 'medium' : 'low',
          confidenceReason: planSupported
            ? 'Uses room L×W perimeters and a labeled wall/plate height; openings and coverage remain planning assumptions.'
            : 'Uses room areas/perimeters, but wall height or room dimensions still rely on assumptions.',
          formulaId: 'drywall_from_room_perimeters',
          basis:
            'Room ceilings + room-perimeter wall faces (shared partitions counted as both faces), less major openings. Garage rooms excluded.',
          inputsUsed: {
            roomCount: roomSurface.roomCount,
            wallHeightFt: wallHeight,
            wallHeightLabeled: labeledHeight != null,
            openingsDeductionPercent: DRYWALL_OPENINGS_DEDUCTION * 100,
            ceilingSqft: roomSurface.ceilings,
            wallSqft: roomSurface.walls,
          },
          assumptions: [
            ...(labeledHeight != null
              ? []
              : [`${EXTERIOR_WALL_HEIGHT_FT} ft wall-height fallback`]),
            `${Math.round(DRYWALL_OPENINGS_DEDUCTION * 100)}% major-opening deduction`,
            'Garage drywall excluded unless finished-garage scope is selected later',
          ],
          includedComponents: [
            'Room ceilings',
            'Room wall faces',
            'Closets included when listed as rooms',
          ],
          excludedComponents: [
            'Garage drywall',
            'Wet-area backing',
            'Fire-rated assemblies',
            'Vaulted surfaces',
            'Shaft walls',
            'Level 5 finish',
          ],
          warning: planSupported
            ? 'Planning quantity from room list and plate height — not a wall-by-wall takeoff.'
            : 'Planning quantity from room list; confirm wall height and openings.',
          planEvidence: evidenceFor(facts, [
            'wallHeightFt',
            'plateHeightFt',
            'totalLivingSqft',
          ]),
          calculationBreakdown: [
            component('Ceilings (room floors)', roomSurface.ceilings, 'sqft'),
            component(
              'Wall faces (room perimeters × height)',
              roomSurface.walls,
              'sqft'
            ),
            component(
              'Major openings',
              roomSurface.openings,
              'sqft',
              'subtract'
            ),
          ],
        });
      }

      if (totalLiving == null) return null;
      const areas = floorAreas(facts, totalLiving);
      const hasFloorFacts = Boolean(
        n(facts?.buildingAreas?.mainFloorLivingSqft) &&
        (facts?.storyCount === 1 || n(facts?.buildingAreas?.upstairsLivingSqft))
      );
      if (hasFloorFacts) {
        const surface = estimatedInteriorSurfaceFromFloorAreas({
          totalLiving,
          areas,
          wallHeight,
        });
        return baseEstimate({
          key,
          value: surface.value,
          unit: 'sqft',
          sourceType: 'estimated_from_formula',
          confidence: 'low',
          confidenceReason:
            'Uses living-area floor facts with estimated perimeter/partition density — not a room-by-room takeoff.',
          formulaId: 'drywall_components_from_floor_areas',
          basis:
            'Ceilings + estimated exterior-wall inside faces + estimated partition faces, less major openings.',
          inputsUsed: {
            totalLivingSqft: totalLiving,
            floorAreasSqft: areas.join(', '),
            wallHeightFt: wallHeight,
            partitionSurfaceFactor: DRYWALL_PARTITION_SURFACE_FACTOR,
            openingsDeductionPercent: DRYWALL_OPENINGS_DEDUCTION * 100,
          },
          assumptions: [
            ...(labeledHeight != null
              ? []
              : [`${EXTERIOR_WALL_HEIGHT_FT} ft wall-height fallback`]),
            'Partition density is estimated from conditioned floor area',
            `${Math.round(DRYWALL_OPENINGS_DEDUCTION * 100)}% major-opening deduction`,
          ],
          includedComponents: [
            'Ceilings',
            'Inside face of exterior walls',
            'Both sides of interior partitions',
            'Closets',
          ],
          excludedComponents: [
            'Garage drywall',
            'Wet-area backing',
            'Fire-rated assemblies',
            'Vaulted surfaces',
            'Shaft walls',
            'Level 5 finish',
          ],
          warning:
            'Planning quantity, not a wall-by-wall takeoff. Room L×W would strengthen this.',
          planEvidence: evidenceFor(facts, [
            'totalLivingSqft',
            'mainFloorLivingSqft',
            'upstairsLivingSqft',
            'wallHeightFt',
          ]),
          calculationBreakdown: [
            component('Ceilings', surface.ceilings, 'sqft'),
            component('Exterior wall surfaces', surface.exteriorWalls, 'sqft'),
            component(
              'Interior partition surfaces',
              surface.partitions,
              'sqft'
            ),
            component(
              'Openings deduction',
              surface.openings,
              'sqft',
              'subtract'
            ),
          ],
        });
      }
      const formula = executeFormula('surface_area_from_floor_area_benchmark', {
        floorAreaSqft: totalLiving,
      });
      if (!formula || formula.missingInputs.length) return null;
      const multiplier = formula.assumptionsUsed[0]?.value ?? 3.5;
      return baseEstimate({
        key,
        value: formula.roundedValue,
        unit: 'sqft',
        sourceType: 'fallback_multiplier',
        confidence: 'low',
        confidenceReason:
          'No wall geometry or complete floor-by-floor facts were available.',
        formulaId: formula.formulaKey,
        basis: `Planning estimate based on living area × ${multiplier}. Not a wall-by-wall takeoff.`,
        inputsUsed: {
          totalLivingSqft: totalLiving,
          surfaceMultiplier: multiplier,
        },
        assumptions: ['Living-area surface multiplier (3–4.2× range)'],
        includedComponents: [
          'Walls and ceilings represented by benchmark multiplier',
        ],
        excludedComponents: [
          'Garage drywall',
          'Wet-area backing',
          'Fire-rated assemblies',
          'Vaulted surfaces',
          'Shaft walls',
          'Level 5 finish',
        ],
        warning: 'Low-confidence fallback; contractor confirmation required.',
        planEvidence: evidenceFor(facts, ['totalLivingSqft']),
        calculationBreakdown: [
          component('Living area', totalLiving, 'sqft'),
          component('Drywall multiplier', multiplier, 'x'),
        ],
      });
    }
    case 'wallPaintSqft': {
      const drywall = getQuickMeasurementEstimate(
        'drywallSqft',
        measurements,
        suppliedFacts
      );
      if (!drywall) return null;
      const deductions = finishPaintDeductions(measurements);
      const value = Math.max(0, drywall.value - deductions.total);
      const hasFinishDeductions = deductions.total > 0;
      return baseEstimate({
        key,
        value,
        unit: 'sqft',
        sourceType: drywall.sourceType,
        confidence: drywall.confidence,
        confidenceReason: hasFinishDeductions
          ? 'Interior paint inherits the drywall surface estimate and applies entered finish deductions.'
          : 'Interior paint is derived from the drywall surface estimate; no tile/cabinet/backsplash deductions were entered yet.',
        formulaId: 'interior_paint_from_drywall_surface_estimate',
        basis: hasFinishDeductions
          ? 'Drywall surface estimate minus shower tile, backsplash, and cabinet-covered wall area.'
          : 'Derived from drywall surfaces until finish deductions are entered; ceilings and walls listed separately in Details.',
        inputsUsed: {
          basedOnDrywallSurfaceEstimate: drywall.value,
          drywallFormulaId: drywall.formulaId,
          showerWallTileSqft: deductions.showerWallTileSqft || null,
          backsplashSqft: deductions.backsplashSqft || null,
          cabinetCoverageSqft: deductions.cabinetCoverageSqft || null,
          wallHeightFt: wallHeight,
        },
        assumptions: [
          ...drywall.assumptions,
          ...(hasFinishDeductions
            ? []
            : [
                'No shower-tile, backsplash, or cabinet coverage deductions were available',
              ]),
          ...(deductions.cabinetCoverageSqft > 0
            ? [
                `Cabinet runs cover ~${CABINET_COVERED_HEIGHT_FT} ft of wall height`,
              ]
            : []),
        ],
        includedComponents: ['Interior walls', 'Ceilings', 'Closets'],
        excludedComponents: [
          'Garage',
          'Trim',
          'Doors',
          ...(hasFinishDeductions
            ? ['Tiled shower walls', 'Backsplash', 'Cabinet-covered wall']
            : ['Cabinets', 'Specialty finishes']),
          'Exterior surfaces',
        ],
        warning: hasFinishDeductions
          ? 'Verify tiled walls, cabinets, and specialty finishes against the finish schedule.'
          : 'Paint currently matches drywall because it is derived from drywall surfaces with no finish deductions entered.',
        planEvidence: drywall.planEvidence,
        calculationBreakdown: [
          ...drywall.calculationBreakdown.filter(step =>
            /ceiling|wall|partition|opening/i.test(step.label)
          ),
          ...(deductions.showerWallTileSqft > 0
            ? [
                component(
                  'Shower wall tile',
                  deductions.showerWallTileSqft,
                  'sqft',
                  'subtract'
                ),
              ]
            : []),
          ...(deductions.backsplashSqft > 0
            ? [
                component(
                  'Backsplash',
                  deductions.backsplashSqft,
                  'sqft',
                  'subtract'
                ),
              ]
            : []),
          ...(deductions.cabinetCoverageSqft > 0
            ? [
                component(
                  'Cabinet-covered wall',
                  deductions.cabinetCoverageSqft,
                  'sqft',
                  'subtract'
                ),
              ]
            : []),
        ],
      });
    }
    case 'exteriorPaintSqft': {
      if (firstFloorLiving == null) return null;
      const measuredPerimeter =
        n(facts?.exteriorPerimeterLf) ??
        n(facts?.foundationPerimeterLf) ??
        geometryPerimeter(facts, [
          'living_footprint',
          'garage_footprint',
          'foundation',
        ]);
      const firstFloorFootprint = firstFloorLiving + garage;
      const perimeter =
        measuredPerimeter ?? estimatedPerimeterFt(firstFloorFootprint);
      const stories = Math.max(1, Math.round(n(facts?.storyCount) ?? 1));
      const openings = Math.max(
        0,
        Math.min(
          0.5,
          (facts?.openingsPercent ?? EXTERIOR_OPENINGS_DEDUCTION * 100) / 100
        )
      );
      const nonPainted = Math.max(
        0,
        Math.min(
          0.9,
          (facts?.nonPaintedExteriorPercent ??
            DEFAULT_NON_PAINTED_DEDUCTION * 100) / 100
        )
      );
      const grossWalls = perimeter * wallHeight * stories;
      const openingsDeduction = grossWalls * openings;
      const finishDeduction = (grossWalls - openingsDeduction) * nonPainted;
      const value = grossWalls - openingsDeduction - finishDeduction;
      const calculated = measuredPerimeter != null && labeledHeight != null;
      const geometryBased = measuredPerimeter != null;
      return baseEstimate({
        key,
        value,
        unit: 'sqft',
        sourceType: calculated
          ? 'calculated_from_components'
          : 'estimated_from_formula',
        confidence: calculated ? 'medium' : 'low',
        confidenceReason: calculated
          ? 'Uses labeled exterior perimeter and wall/plate height; finish transitions still require review.'
          : geometryBased
            ? 'Uses measured exterior perimeter, but wall height still relies on a planning assumption.'
            : 'Exterior perimeter is approximated because elevation/foundation perimeter was unavailable.',
        formulaId: 'exterior_paint_from_footprint_perimeter',
        basis:
          'Exterior perimeter × wall height × stories, less openings and known non-painted finishes.',
        inputsUsed: {
          exteriorPerimeterLf: perimeter,
          wallHeightFt: wallHeight,
          wallHeightLabeled: labeledHeight != null,
          storyCount: stories,
          openingsPercent: openings * 100,
          nonPaintedExteriorPercent: nonPainted * 100,
          perimeterMeasured: measuredPerimeter != null,
        },
        assumptions: [
          ...(geometryBased
            ? []
            : [
                'Perimeter approximated from first-floor living + garage footprint',
              ]),
          ...(labeledHeight != null
            ? []
            : [`${EXTERIOR_WALL_HEIGHT_FT} ft wall-height fallback`]),
          `${Math.round(openings * 100)}% openings allowance`,
        ],
        includedComponents: ['Exterior wall faces', 'Upper-story wall faces'],
        excludedComponents: [
          'Windows and doors',
          'Known non-painted finishes',
          'Trim',
          'Soffit',
          'Fascia',
        ],
        warning:
          nonPainted === 0
            ? 'No masonry/stone/stucco deduction was detected; verify exterior finish transitions.'
            : null,
        planEvidence: evidenceFor(facts, [
          'exteriorPerimeterLf',
          'foundationPerimeterLf',
          'wallHeightFt',
          'plateHeightFt',
          'storyCount',
          'nonPaintedExteriorPercent',
        ]),
        calculationBreakdown: [
          component('Gross exterior walls', grossWalls, 'sqft'),
          component(
            'Openings deduction',
            openingsDeduction,
            'sqft',
            'subtract'
          ),
          component(
            'Non-painted finish deduction',
            finishDeduction,
            'sqft',
            'subtract'
          ),
        ],
      });
    }
    case 'roofSquares': {
      const roofPlanes = (facts?.geometry || []).filter(
        region =>
          region.kind === 'roof_plane' &&
          region.isIncluded !== false &&
          n(region.areaSqft)
      );
      const detectedPitch = facts?.roofPitch || null;
      const pitch = detectedPitch || DEFAULT_ROOF_PITCH;
      const pitchIsDescriptor = pitch === 'low-slope';
      const wastePercent = facts?.roofWastePercent ?? ROOF_WASTE_FACTOR * 100;
      const waste = wastePercent / 100;
      let projectedArea = 0;
      let slopedArea = 0;
      let sourceType: PlanMeasurementSourceType;
      let confidence: PlanMeasurementConfidence;
      let confidenceReason: string;
      let includedComponents: string[];
      const breakdown: QuickMeasurementEstimate['calculationBreakdown'] = [];

      if (roofPlanes.length) {
        for (const plane of roofPlanes) {
          const area = Number(plane.areaSqft);
          const planePitch = plane.pitch || pitch;
          projectedArea += area;
          const planeSloped = area * pitchMultiplier(planePitch);
          slopedArea += planeSloped;
          breakdown.push(
            component(
              `Roof plane ${plane.id}`,
              planeSloped,
              'sqft',
              `${area} sqft @ ${planePitch}`
            )
          );
        }
        sourceType = 'measured_from_geometry';
        confidence = roofPlanes.every(
          plane => plane.pitch || (detectedPitch && !pitchIsDescriptor)
        )
          ? 'high'
          : 'medium';
        confidenceReason = pitchIsDescriptor
          ? 'Uses roof-plane geometry, but the low-slope label requires a numeric pitch assumption.'
          : 'Uses supplied roof-plane geometry and detected/assigned pitch per plane.';
        includedComponents = ['Measured roof planes'];
      } else {
        if (firstFloorLiving == null) return null;
        const patioIncluded = patio > 0 && facts?.coveredPatioRoofed !== false;
        projectedArea = firstFloorLiving + garage + (patioIncluded ? patio : 0);
        slopedArea = projectedArea * pitchMultiplier(pitch);
        const hasPlanFootprint = Boolean(
          n(facts?.buildingAreas?.mainFloorLivingSqft) ||
          n(facts?.roofedFootprintSqft)
        );
        if (n(facts?.roofedFootprintSqft)) {
          projectedArea = Number(facts?.roofedFootprintSqft);
          slopedArea = projectedArea * pitchMultiplier(pitch);
        }
        sourceType = hasPlanFootprint
          ? 'calculated_from_components'
          : 'fallback_multiplier';
        confidence =
          hasPlanFootprint && detectedPitch && !pitchIsDescriptor
            ? 'medium'
            : 'low';
        confidenceReason = hasPlanFootprint
          ? 'Uses explicit first-floor roofed components; roof-plane shapes and overhangs are not measured.'
          : 'Uses living/garage footprint fallback because roof geometry and first-floor facts were unavailable.';
        includedComponents = [
          'Main-floor living roof',
          ...(garage > 0 ? ['Garage roof'] : []),
          ...(patioIncluded ? ['Roofed covered patio'] : []),
        ];
        breakdown.push(
          component('Projected roofed footprint', projectedArea, 'sqft')
        );
        breakdown.push(
          component('Pitch-adjusted roof area', slopedArea, 'sqft', pitch)
        );
      }
      const wasteArea = slopedArea * waste;
      const squares = (slopedArea + wasteArea) / 100;
      breakdown.push(component('Waste', wasteArea, 'sqft', `${wastePercent}%`));
      return baseEstimate({
        key,
        value: squares,
        unit: 'sq',
        sourceType,
        confidence,
        confidenceReason,
        formulaId: 'roof_squares_from_footprint_pitch',
        basis: `${projectedArea.toLocaleString()} sqft projected roof area × ${pitch} pitch slope factor + ${wastePercent}% waste.`,
        inputsUsed: {
          projectedRoofAreaSqft: projectedArea,
          roofPitch: pitch,
          slopeFactor: pitchMultiplier(pitch),
          wastePercent,
          coveredPatioIncluded:
            patio > 0 && facts?.coveredPatioRoofed !== false,
        },
        assumptions: [
          ...(detectedPitch ? [] : [`${DEFAULT_ROOF_PITCH} pitch fallback`]),
          ...(pitchIsDescriptor
            ? [
                'Low-slope descriptor modeled with a 2:12 slope factor; confirm numeric pitch',
              ]
            : []),
          ...(roofPlanes.length
            ? []
            : [
                'Overhangs are not included unless captured in roofed-footprint facts',
              ]),
        ],
        includedComponents,
        excludedComponents: [
          'Detached structures unless supplied',
          'Unmeasured overhangs',
          'Exterior flatwork',
        ],
        warning:
          sourceType === 'fallback_multiplier' || pitchIsDescriptor
            ? 'Planning estimate only; verify roof geometry, numeric pitch, overhangs, and waste.'
            : null,
        planEvidence: evidenceFor(facts, [
          'roofPitch',
          'roofedFootprintSqft',
          'mainFloorLivingSqft',
          'garageSqft',
          'coveredPatioSqft',
        ]),
        calculationBreakdown: breakdown,
      });
    }
    case 'concreteCy': {
      const geometryFootprint = geometryArea(facts, ['foundation']);
      const livingFootprint =
        geometryFootprint ??
        n(facts?.foundationFootprintSqft) ??
        firstFloorLiving;
      if (livingFootprint == null) return null;
      const patioIncluded =
        facts?.includeCoveredPatioSlab === true && patio > 0;
      const slabFootprint =
        livingFootprint + garage + (patioIncluded ? patio : 0);
      const measuredPerimeter =
        n(facts?.foundationPerimeterLf) ??
        geometryPerimeter(facts, ['foundation']);
      const perimeter =
        measuredPerimeter ?? estimatedPerimeterFt(livingFootprint + garage);
      const interiorFootingLf = perimeter * INTERIOR_FOOTING_RATIO;
      const footingCf = perimeter * FOOTING_WIDTH_FT * FOOTING_DEPTH_FT;
      const interiorFootingCf =
        interiorFootingLf * FOOTING_WIDTH_FT * FOOTING_DEPTH_FT;
      const stemCf = perimeter * STEM_WALL_HEIGHT_FT * STEM_WALL_THICKNESS_FT;
      const slabCf = slabFootprint * SLAB_THICKNESS_FT;
      const subtotalCf = footingCf + interiorFootingCf + stemCf + slabCf;
      const wasteCf = subtotalCf * FOUNDATION_WASTE_FACTOR;
      const totalCy = (subtotalCf + wasteCf) / 27;
      const componentFacts = Boolean(
        n(facts?.foundationFootprintSqft) ||
        geometryFootprint ||
        measuredPerimeter
      );
      return baseEstimate({
        key,
        value: totalCy,
        unit: 'CY',
        sourceType: componentFacts
          ? 'calculated_from_components'
          : 'estimated_from_formula',
        confidence: componentFacts ? 'medium' : 'low',
        confidenceReason: componentFacts
          ? 'Uses foundation area/perimeter facts; structural member sizes remain assumptions.'
          : 'Uses first-floor area and estimated perimeter because structural geometry was unavailable.',
        formulaId: 'foundation_cy_from_footprint',
        basis:
          'House/garage slabs + continuous/interior footings + stem walls + waste. Verify against structural plans.',
        quantityLabel: 'Foundation and building slabs',
        inputsUsed: {
          firstFloorLivingFootprintSqft: livingFootprint,
          garageSlabSqft: garage,
          coveredPatioSlabSqft: patioIncluded ? patio : 0,
          foundationPerimeterLf: perimeter,
          interiorFootingLf,
          slabThicknessIn: SLAB_THICKNESS_FT * 12,
          wastePercent: FOUNDATION_WASTE_FACTOR * 100,
        },
        assumptions: [
          `Footing ${FOOTING_WIDTH_FT} ft wide × ${FOOTING_DEPTH_FT} ft deep`,
          `Stem wall ${STEM_WALL_HEIGHT_FT} ft high × ${Math.round(STEM_WALL_THICKNESS_FT * 12)} in thick`,
          `Interior footing allowance ${Math.round(INTERIOR_FOOTING_RATIO * 100)}% of exterior perimeter`,
          `Building slab ${Math.round(SLAB_THICKNESS_FT * 12)} in thick`,
          'Exterior flatwork and driveway concrete are excluded',
        ],
        includedComponents: [
          'House slab',
          'Garage slab',
          ...(patioIncluded ? ['Covered patio slab'] : []),
          'Continuous footings',
          'Interior footing allowance',
          'Stem walls / thickened edges',
          'Waste',
        ],
        excludedComponents: [
          ...(patioIncluded ? [] : ['Covered patio slab']),
          'Exterior flatwork',
          'Driveway',
          'Walkways',
          'Retaining walls',
          'Pool concrete',
          'Site walls',
          'Piers/pads unless supplied',
        ],
        warning:
          'Verify footing, stem-wall, thickened-edge, pier, and slab details against structural plans.',
        planEvidence: evidenceFor(facts, [
          'foundationFootprintSqft',
          'foundationPerimeterLf',
          'mainFloorLivingSqft',
          'garageSqft',
        ]),
        calculationBreakdown: [
          component('Building slabs', slabCf / 27, 'CY'),
          component('Continuous footings', footingCf / 27, 'CY'),
          component('Interior footings', interiorFootingCf / 27, 'CY'),
          component('Stem walls / thickened edges', stemCf / 27, 'CY'),
          component('Waste', wasteCf / 27, 'CY'),
        ],
      });
    }
    case 'excavationCy': {
      const geometryFootprint = geometryArea(facts, ['foundation']);
      const livingFootprint =
        geometryFootprint ??
        n(facts?.foundationFootprintSqft) ??
        firstFloorLiving;
      if (livingFootprint == null) return null;
      const footprint = livingFootprint + garage;
      const measuredPerimeter =
        n(facts?.foundationPerimeterLf) ??
        geometryPerimeter(facts, ['foundation']);
      const perimeter = measuredPerimeter ?? estimatedPerimeterFt(footprint);
      const trenchCy =
        (perimeter * FOOTING_TRENCH_WIDTH_FT * FOOTING_TRENCH_DEPTH_FT) / 27;
      const padCutCy = (footprint * SLAB_OVEREX_DEPTH_FT) / 27;
      const workingRoomCy = trenchCy * 0.1;
      const totalCy = trenchCy + padCutCy + workingRoomCy;
      const hasFoundationFacts = Boolean(
        geometryFootprint ||
        n(facts?.foundationFootprintSqft) ||
        measuredPerimeter
      );
      return baseEstimate({
        key,
        value: totalCy,
        unit: 'CY',
        sourceType: hasFoundationFacts
          ? 'calculated_from_components'
          : 'estimated_from_formula',
        confidence: 'low',
        confidenceReason:
          'Architectural footprint supports a shallow allowance, but civil grading, structural footing, and geotechnical data are missing.',
        formulaId: 'excavation_cy_from_footing_trench',
        basis:
          'Planning excavation allowance: shallow building-pad cut + footing trench + working room. Not a full building dig.',
        inputsUsed: {
          foundationFootprintSqft: footprint,
          foundationPerimeterLf: perimeter,
          footingTrenchWidthFt: FOOTING_TRENCH_WIDTH_FT,
          footingTrenchDepthFt: FOOTING_TRENCH_DEPTH_FT,
          shallowPadCutDepthFt: SLAB_OVEREX_DEPTH_FT,
          workingRoomPercent: 10,
        },
        assumptions: [
          `Perimeter footing trench ${FOOTING_TRENCH_WIDTH_FT} ft wide × ${FOOTING_TRENCH_DEPTH_FT} ft deep`,
          `${SLAB_OVEREX_DEPTH_FT} ft shallow pad cut under living + garage footprint`,
          '10% footing-trench working-room allowance',
          'Does not excavate the full building area to frost depth',
          'Excludes rock excavation, haul-off/export, dump fees, imported fill, and utility trenching',
        ],
        includedComponents: [
          'Building pad cut',
          'Footing/stem-wall trench',
          'Working-room allowance',
        ],
        excludedComponents: [
          'Haul-off/export',
          'Dump fees',
          'Imported fill',
          'Rock excavation',
          'Utility trenching',
          'Mass grading',
          'Retaining-wall excavation',
          'Shoring',
          'Dewatering',
        ],
        warning:
          'Final quantity depends on grading, soils, footing design, over-excavation, rock, and export requirements.',
        planEvidence: evidenceFor(facts, [
          'foundationFootprintSqft',
          'foundationPerimeterLf',
          'mainFloorLivingSqft',
          'garageSqft',
        ]),
        calculationBreakdown: [
          component('Shallow building-pad cut', padCutCy, 'CY'),
          component('Footing/stem trench', trenchCy, 'CY'),
          component('Working room', workingRoomCy, 'CY'),
        ],
      });
    }
    case 'showerWallTileSqft':
    case 'showerFloorTileSqft': {
      const finishParams = {
        bathCount: measurements.bathCount,
        tilePanBathCount: measurements.tilePanBathCount,
        prefabBathCount: measurements.prefabBathCount,
        prefabEnclosureBathCount: measurements.prefabEnclosureBathCount,
        tubBathCount: measurements.tubBathCount,
        wetAreaFinish: measurements.wetAreaFinish,
        templateKey: templateKey ?? measurements.templateKey,
      };
      const finish = resolveEffectiveWetAreaFinish(finishParams);
      if (key === 'showerFloorTileSqft' && finish !== 'tile') return null;
      if (key === 'showerWallTileSqft' && finish === 'tub') return null;
      const baths =
        key === 'showerWallTileSqft'
          ? resolveShowerWallBathCount({
              planRooms: rooms,
              bathCount: measurements.bathCount,
              tilePanBathCount: measurements.tilePanBathCount,
              prefabBathCount: measurements.prefabBathCount,
              prefabEnclosureBathCount: measurements.prefabEnclosureBathCount,
              tubBathCount: measurements.tubBathCount,
              bathroomFloorSqft: measurements.bathroomFloorSqft,
              wetAreaFinish: finish,
              templateKey: templateKey ?? measurements.templateKey,
            })
          : resolveTilePanBathCount({
              planRooms: rooms,
              bathCount: measurements.bathCount,
              tilePanBathCount: measurements.tilePanBathCount,
              bathroomFloorSqft: measurements.bathroomFloorSqft,
              wetAreaFinish: finish,
              templateKey: templateKey ?? measurements.templateKey,
            });
      if (baths == null) return null;
      const perBath =
        key === 'showerWallTileSqft'
          ? TYPICAL_SHOWER_WALL_SQFT_PER_BATH
          : TYPICAL_SHOWER_FLOOR_SQFT_PER_BATH;
      const value = baths * perBath;
      const unitLabel =
        key === 'showerWallTileSqft' ? 'shower wall' : 'shower floor';
      return baseEstimate({
        key,
        value,
        unit: 'sqft',
        sourceType: 'estimated_from_formula',
        confidence: 'low',
        confidenceReason: `Planning allowance of ${perBath} sqft ${unitLabel} per tiled bath × ${baths} bath${baths === 1 ? '' : 's'}.`,
        formulaId:
          key === 'showerWallTileSqft'
            ? 'shower_wall_from_bath_count_tile'
            : 'shower_floor_from_bath_count_tile',
        basis: `Typical tiled ${unitLabel} allowance × ${baths} bath${baths === 1 ? '' : 's'}. Not a measured shower takeoff.`,
        quantityLabel:
          key === 'showerWallTileSqft' ? 'Shower walls' : 'Shower floor',
        inputsUsed: {
          bathCount: baths,
          wetAreaFinish: 'tile',
          perBathSqft: perBath,
        },
        assumptions: [
          `${perBath} sqft typical tiled ${unitLabel} per bath`,
          'Confirm each shower size against the plan',
        ],
        includedComponents: [
          key === 'showerWallTileSqft'
            ? 'Tiled shower wall surfaces'
            : 'Tiled shower floor / pan surface',
        ],
        excludedComponents: [
          'Tub surrounds',
          'Prefab pan finishes',
          'Niche/bench extras unless measured',
          'Bathroom floor tile outside the shower',
        ],
        warning:
          'Planning allowance only — verify shower dimensions on the plan.',
        calculationBreakdown: [
          component('Baths with tiled showers', baths, 'ea'),
          component(`Typical ${unitLabel} per bath`, perBath, 'sqft'),
        ],
      });
    }
    default:
      return null;
  }
}
