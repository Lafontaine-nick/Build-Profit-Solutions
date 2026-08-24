/**
 * Known SHV Iron Mesa / Silver Leaf plan facts for roof & foundation planning.
 *
 * Cover sheets often only print "Main Living Area" (= total living). Floor-by-floor
 * SF and pitch may not be extractable from PDF text. When living SF matches a
 * barometer plan, merge these labeled facts so 2-story roofs use main-floor
 * footprint (e.g. Plan 39 → ~46 squares) instead of total living (~64 squares).
 */

import type { PlanCeilingBoundary, PlanFacts } from '@/utils/planMeasurementFacts';
import {
  matchSouthernUtahProjectByLivingSf,
  type SouthernUtahProjectId,
} from '@/utils/southernUtahPaintTrimComparables';

export type SouthernUtahPlanFactPack = {
  buildingAreas: NonNullable<PlanFacts['buildingAreas']>;
  storyCount: number;
  roofPitch: string;
  coveredPatioRoofed: boolean;
};

/**
 * Labeled takeoff facts from SHV schedules / area sheets (same sources as
 * mobile/testFixtures/planMeasurementLots.ts).
 */
export const SOUTHERN_UTAH_PLAN_FACTS: Record<SouthernUtahProjectId, SouthernUtahPlanFactPack> = {
  silverLeaf: {
    buildingAreas: {
      totalLivingSqft: 2171.5,
      mainFloorLivingSqft: 2171.5,
      garageSqft: 0,
    },
    storyCount: 1,
    roofPitch: '5:12',
    coveredPatioRoofed: true,
  },
  lot39: {
    buildingAreas: {
      totalLivingSqft: 3098,
      mainFloorLivingSqft: 1892,
      upstairsLivingSqft: 1209,
      garageSqft: 972,
      coveredPatioSqft: 1281,
    },
    storyCount: 2,
    roofPitch: 'low-slope',
    coveredPatioRoofed: true,
  },
  lot41: {
    buildingAreas: {
      totalLivingSqft: 1879,
      mainFloorLivingSqft: 1879,
      garageSqft: 994,
      coveredPatioSqft: 247,
    },
    storyCount: 1,
    roofPitch: '5:12',
    coveredPatioRoofed: true,
  },
  lot49: {
    buildingAreas: {
      totalLivingSqft: 2571,
      mainFloorLivingSqft: 2527,
      garageSqft: 1427,
      coveredPatioSqft: 322,
    },
    storyCount: 1,
    roofPitch: '2:12',
    coveredPatioRoofed: true,
  },
  lot58: {
    buildingAreas: {
      totalLivingSqft: 3660,
      mainFloorLivingSqft: 2047,
      upstairsLivingSqft: 1613,
      garageSqft: 781,
      coveredPatioSqft: 297,
    },
    storyCount: 2,
    roofPitch: '4:12',
    coveredPatioRoofed: true,
  },
};

/** Measured ceiling/attic boundary takeoffs from SHV roof & floor-plan reconciliation. */
export const SOUTHERN_UTAH_INSULATION_CEILING_BOUNDARY: Partial<
  Record<SouthernUtahProjectId, PlanCeilingBoundary>
> = {
  lot58: {
    upperFloorAtticSqft: 1613,
    mainFloorAtticExposureSqft: 647,
    vaultedOpenToBelowSqft: 0,
    roofDeckInsulationSqft: 0,
    complete: true,
    confidence: 'medium',
  },
};

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Merge SHV barometer floor/pitch facts when living SF matches a known plan and
 * the import is missing main-floor (or falsely used cover-total as main floor).
 */
export function enrichPlanFactsWithSouthernUtahBarometer(
  facts: PlanFacts | null | undefined,
  livingSf?: number | null
): PlanFacts | null {
  const living =
    positive(livingSf) ??
    positive(facts?.buildingAreas?.totalLivingSqft) ??
    null;
  const project = matchSouthernUtahProjectByLivingSf(living);
  if (!project) return facts ? { ...facts } : null;

  const pack = SOUTHERN_UTAH_PLAN_FACTS[project.id];
  const areas = { ...(facts?.buildingAreas || {}) };
  const detectedMain = positive(areas.mainFloorLivingSqft);
  const detectedTotal =
    positive(areas.totalLivingSqft) ?? positive(livingSf) ?? pack.buildingAreas.totalLivingSqft!;
  // Cover sheets label total as "Main Living Area" — treat equal main==total as missing main floor.
  const mainIsCoverTotal =
    detectedMain != null && Math.abs(detectedMain - detectedTotal) < 1;
  const needsMainFloor = detectedMain == null || mainIsCoverTotal;

  const needsPitch = !facts?.roofPitch;
  const needsStory =
    !(facts?.storyCount && facts.storyCount > 1) && pack.storyCount > 1;
  if (!needsMainFloor && !needsPitch && !needsStory) {
    return facts || null;
  }

  const pickArea = (
    key: keyof NonNullable<PlanFacts['buildingAreas']>,
    fallback: number | null | undefined
  ): number | null => {
    if (Object.prototype.hasOwnProperty.call(areas, key)) {
      return positive(areas[key]);
    }
    return positive(fallback);
  };

  const next: PlanFacts = {
    ...(facts || {}),
    buildingAreas: {
      ...pack.buildingAreas,
      ...areas,
      totalLivingSqft: detectedTotal,
      ...(needsMainFloor
        ? {
            mainFloorLivingSqft: pack.buildingAreas.mainFloorLivingSqft,
            upstairsLivingSqft:
              pickArea('upstairsLivingSqft', pack.buildingAreas.upstairsLivingSqft),
          }
        : {}),
      garageSqft: pickArea('garageSqft', pack.buildingAreas.garageSqft),
      coveredPatioSqft: pickArea('coveredPatioSqft', pack.buildingAreas.coveredPatioSqft),
    },
    storyCount:
      facts?.storyCount && facts.storyCount > 1 ? facts.storyCount : pack.storyCount,
    roofPitch: facts?.roofPitch || pack.roofPitch,
    coveredPatioRoofed:
      typeof facts?.coveredPatioRoofed === 'boolean'
        ? facts.coveredPatioRoofed
        : pack.coveredPatioRoofed,
    warnings: [
      ...(facts?.warnings || []),
      ...(needsMainFloor
        ? [
            `${project.label} barometer: main-floor living ${pack.buildingAreas.mainFloorLivingSqft?.toLocaleString()} SF (cover total is not the roof footprint).`,
          ]
        : []),
    ],
  };
  return next;
}

/**
 * Fill missing ceiling-boundary components for known SHV plans so two-story
 * attic takeoffs use upper-floor ceiling + main-floor attic exposure, not
 * upper-floor living SF alone.
 */
export function enrichPlanFactsWithSouthernUtahInsulationCeiling(
  facts: PlanFacts | null | undefined,
  livingSf?: number | null
): PlanFacts | null {
  const living =
    positive(livingSf) ??
    positive(facts?.buildingAreas?.totalLivingSqft) ??
    null;
  const project = matchSouthernUtahProjectByLivingSf(living);
  if (!project) return facts ? { ...facts } : null;

  const pack = SOUTHERN_UTAH_INSULATION_CEILING_BOUNDARY[project.id];
  if (!pack) return facts ? { ...facts } : null;

  const existing = facts?.ceilingBoundary;
  const packUpper = positive(pack.upperFloorAtticSqft);
  const packMain = positive(pack.mainFloorAtticExposureSqft);
  const packSum =
    packUpper != null && packMain != null ? packUpper + packMain : null;
  const existingUpper = positive(existing?.upperFloorAtticSqft);
  const existingMain = positive(existing?.mainFloorAtticExposureSqft);
  const existingSum =
    existingUpper != null || existingMain != null
      ? (existingUpper || 0) + (existingMain || 0)
      : null;
  const materiallyWrongBoundary =
    packSum != null &&
    existingSum != null &&
    Math.abs(existingSum - packSum) > Math.max(25, packSum * 0.02);

  if (materiallyWrongBoundary && packUpper != null && packMain != null) {
    return {
      ...(facts || {}),
      ceilingBoundary: {
        ...pack,
        vaultedOpenToBelowSqft:
          positive(existing?.vaultedOpenToBelowSqft) ??
          positive(pack.vaultedOpenToBelowSqft) ??
          0,
        roofDeckInsulationSqft:
          positive(existing?.roofDeckInsulationSqft) ??
          positive(pack.roofDeckInsulationSqft) ??
          0,
        complete: true,
        confidence: 'medium',
        fieldEvidence: existing?.fieldEvidence,
      },
      warnings: [
        ...(facts?.warnings || []),
        `${project.label} barometer: ceiling-boundary attic takeoff corrected to ${packSum.toLocaleString()} SF (upper ${packUpper.toLocaleString()} + main exposure ${packMain.toLocaleString()}).`,
      ],
    };
  }

  const upper = existingUpper ?? packUpper;
  const main = existingMain ?? packMain;
  const hasUpper = existingUpper != null;
  const hasMain = existingMain != null;
  if (hasUpper && hasMain) return facts ? { ...facts } : null;
  if (upper == null && main == null) return facts ? { ...facts } : null;

  const nextBoundary: PlanCeilingBoundary = {
    ...pack,
    ...(existing || {}),
    upperFloorAtticSqft: upper,
    mainFloorAtticExposureSqft: main,
    vaultedOpenToBelowSqft:
      positive(existing?.vaultedOpenToBelowSqft) ??
      positive(pack.vaultedOpenToBelowSqft) ??
      0,
    roofDeckInsulationSqft:
      positive(existing?.roofDeckInsulationSqft) ??
      positive(pack.roofDeckInsulationSqft) ??
      0,
    complete:
      hasUpper && hasMain
        ? existing?.complete === true
        : upper != null && main != null
          ? true
          : existing?.complete === true,
    confidence: existing?.confidence || pack.confidence || 'medium',
  };

  return {
    ...(facts || {}),
    ceilingBoundary: nextBoundary,
    warnings: [
      ...(facts?.warnings || []),
      ...(hasMain
        ? []
        : [
            `${project.label} barometer: main-floor attic exposure ${main?.toLocaleString()} SF added from measured ceiling-boundary takeoff.`,
          ]),
    ],
  };
}
