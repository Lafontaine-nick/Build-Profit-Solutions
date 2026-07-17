import type { PlanFacts } from '@/utils/planMeasurementFacts';
import type { PlanRoomMeasurement } from '@/utils/estimateAiDraft';

export type PlanMeasurementLotFixture = {
  lot: '39' | '41' | '49' | '58';
  measurements: {
    floorAreaSqft: string;
    garageSqft: string;
    deckSqft: string;
  };
  facts: PlanFacts;
  /** Optional room L×W list used by the room-perimeter surface model. */
  rooms?: PlanRoomMeasurement[];
};

function evidence(page: number, sheet: string, label: string) {
  return [{ page, sheet, label, sourceType: 'pdf_text' as const, confidence: 0.98 }];
}

/** SHV Lot 41 living rooms with L×W from the floor-plan PDF text layer. */
export const LOT_41_PLAN_ROOMS: PlanRoomMeasurement[] = [
  { name: 'Dining', lengthFt: 13.083, widthFt: 8.583, areaSqft: 112.3, sourceType: 'plan_explicit' },
  { name: 'Primary Suite', lengthFt: 15.333, widthFt: 16.583, areaSqft: 254.3, sourceType: 'plan_explicit' },
  { name: 'Great Room', lengthFt: 14.833, widthFt: 17.5, areaSqft: 259.6, sourceType: 'plan_explicit' },
  { name: 'Closet', lengthFt: 11.5, widthFt: 4.75, areaSqft: 54.6, sourceType: 'plan_explicit' },
  { name: 'Kitchen', lengthFt: 13.083, widthFt: 14.833, areaSqft: 194.1, sourceType: 'plan_explicit' },
  { name: 'Laundry', lengthFt: 8, widthFt: 5.25, areaSqft: 42, sourceType: 'plan_explicit' },
  { name: 'Pantry', lengthFt: 9.167, widthFt: 4.25, areaSqft: 39, sourceType: 'plan_explicit' },
  { name: 'Den/Bed 4', lengthFt: 10.333, widthFt: 10.667, areaSqft: 110.2, sourceType: 'plan_explicit' },
  { name: 'Bed 3', lengthFt: 10.167, widthFt: 10.5, areaSqft: 106.8, sourceType: 'plan_explicit' },
  { name: 'Bed 2/Office', lengthFt: 10.75, widthFt: 10.167, areaSqft: 109.3, sourceType: 'plan_explicit' },
];

export const PLAN_MEASUREMENT_LOTS: Record<
  PlanMeasurementLotFixture['lot'],
  PlanMeasurementLotFixture
> = {
  '41': {
    lot: '41',
    measurements: { floorAreaSqft: '1879', garageSqft: '994', deckSqft: '247' },
    rooms: LOT_41_PLAN_ROOMS,
    facts: {
      buildingAreas: {
        totalLivingSqft: 1879,
        mainFloorLivingSqft: 1879,
        garageSqft: 994,
        coveredPatioSqft: 247,
      },
      storyCount: 1,
      roofPitch: '5:12',
      wallHeightFt: 9,
      foundationPerimeterLf: 214,
      plateHeightFt: 10.2,
      openingsPercent: 15,
      coveredPatioRoofed: true,
      fieldEvidence: {
        totalLivingSqft: {
          value: 1879,
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(1, 'A0.0', 'LIVING 1,879 SF'),
        },
        roofPitch: {
          value: '5:12',
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(8, 'A5.0', '5:12'),
        },
        plateHeightFt: {
          value: 10.2,
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(6, 'A-4', "TOP OF PLATE 10.2'"),
        },
      },
    },
  },
  '39': {
    lot: '39',
    measurements: { floorAreaSqft: '3098', garageSqft: '972', deckSqft: '1281' },
    facts: {
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
      warnings: ['Cover living total is 3,098 sqft; floor labels total 3,101 sqft.'],
      fieldEvidence: {
        totalLivingSqft: {
          value: 3098,
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(1, 'A0.0', 'TOTAL LIVING 3,098 SF'),
        },
        mainFloorLivingSqft: {
          value: 1892,
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(3, 'A2.0', 'MAIN FLOOR 1,892 SF'),
        },
        upstairsLivingSqft: {
          value: 1209,
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(4, 'A2.1', 'UPPER FLOOR 1,209 SF'),
        },
      },
    },
  },
  '49': {
    lot: '49',
    measurements: { floorAreaSqft: '2571', garageSqft: '1427', deckSqft: '322' },
    facts: {
      buildingAreas: {
        totalLivingSqft: 2571,
        mainFloorLivingSqft: 2527,
        garageSqft: 1427,
        coveredPatioSqft: 322,
      },
      storyCount: 1,
      roofPitch: '2:12',
      coveredPatioRoofed: true,
      warnings: ['Cover living total is 2,571 sqft; floor-plan label is 2,527 sqft.'],
      fieldEvidence: {
        totalLivingSqft: {
          value: 2571,
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(1, 'A0.0', 'LIVING 2,571 SF'),
        },
        mainFloorLivingSqft: {
          value: 2527,
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(3, 'A2.0', 'FLOOR PLAN 2,527 SF'),
        },
        roofPitch: {
          value: '2:12',
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(8, 'A5.0', '2:12'),
        },
      },
    },
  },
  '58': {
    lot: '58',
    measurements: { floorAreaSqft: '3660', garageSqft: '781', deckSqft: '297' },
    facts: {
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
      fieldEvidence: {
        totalLivingSqft: {
          value: 3660,
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(1, 'A0.0', 'TOTAL LIVING 3,660 SF'),
        },
        mainFloorLivingSqft: {
          value: 2047,
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(3, 'A2.0', 'MAIN FLOOR 2,047 SF'),
        },
        upstairsLivingSqft: {
          value: 1613,
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(4, 'A2.1', 'UPPER FLOOR 1,613 SF'),
        },
        roofPitch: {
          value: '4:12',
          sourceType: 'detected_from_plan',
          confidence: 'high',
          evidence: evidence(8, 'A5.0', '4:12'),
        },
      },
    },
  },
};

