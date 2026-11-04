import {
  CANONICAL_GOLD_NOTES,
  CANONICAL_GOLD_NOTES_VERSION,
  type CanonicalGoldNote,
} from '@/utils/canonicalScopeGoldNotes';

/**
 * One versioned corpus for the launch acceptance gate.
 * Scope fixtures live in the gold-note list. This file adds the notes and
 * plan cases the gate scores for measurements, national prices, and the
 * confirmed snapshot.
 */
export const REAL_NOTES_ACCEPTANCE_CORPUS_VERSION = CANONICAL_GOLD_NOTES_VERSION;

export type RealNotesScenario =
  | 'single_trade'
  | 'whole_home'
  | 'addition'
  | 'adu'
  | 'garage_conversion'
  | 'new_build'
  | 'exclusion'
  | 'mixed'
  | 'incomplete'
  | 'plan_takeoff';

export type RealNotesAcceptanceCase = CanonicalGoldNote & {
  scenario: RealNotesScenario;
  expectedMeasurements?: Record<string, number>;
  absentMeasurements?: string[];
  /** Included cards that must carry a positive national or production price. */
  pricedItemIds?: string[];
  /** Plan or confirmed takeoff that the note text does not spell out. */
  measurementOverrides?: Record<string, unknown>;
  priceBand?: {
    itemId: string;
    minQuantity: number;
    minTotal: number;
    maxTotal: number;
  };
};

const LAUNCH_CASES: RealNotesAcceptanceCase[] = [
  {
    id: 'october_bathroom_shower_and_lvp',
    scenario: 'mixed',
    notes:
      'Replace the shower tile and install 80 sqft of LVP in the bathroom.',
    templateKey: 'bathroom',
    projectType: 'bathroom',
    includedIds: ['shower_tile', 'flooring_lvp'],
    excludedIds: [],
    absentIds: ['floor_demo'],
    expectedMeasurements: { flooringLvpSqft: 80 },
    absentMeasurements: ['showerWallTileSqft'],
    pricedItemIds: ['flooring_lvp'],
  },
  {
    id: 'kitchen_exclusion_and_allowance',
    scenario: 'exclusion',
    notes:
      'Kitchen remodel with 18 LF cabinets, 55 sqft counters, and 28 sqft backsplash. Flooring by others. Labor $8,500, material $12,000.',
    templateKey: 'kitchen',
    projectType: 'kitchen',
    includedIds: ['cabinets'],
    excludedIds: ['flooring', 'flooring_lvp'],
    expectedMeasurements: { cabinetLf: 18 },
  },
  {
    id: 'bedroom_addition',
    scenario: 'addition',
    notes:
      'Build a 320 sqft bedroom addition. Frame the walls. No roofing in this bid.',
    templateKey: 'addition',
    projectType: 'addition',
    includedIds: ['wall_framing'],
    excludedIds: ['roofing'],
    expectedMeasurements: { floorAreaSqft: 320 },
  },
  {
    id: 'garage_conversion_shell',
    scenario: 'garage_conversion',
    notes:
      'Convert the 400 sqft garage to living space. Hang 800 sqft of drywall and install 400 sqft of LVP. No new HVAC.',
    templateKey: 'room_remodel',
    projectType: 'other',
    includedIds: ['drywall', 'flooring_lvp'],
    excludedIds: ['hvac'],
    expectedMeasurements: { flooringLvpSqft: 400 },
    pricedItemIds: ['flooring_lvp'],
  },
  {
    id: 'detached_adu_shell',
    scenario: 'adu',
    notes:
      'Build a 720 sqft addition for a detached ADU. Frame the walls. No roofing in this bid.',
    templateKey: 'addition',
    projectType: 'addition',
    includedIds: ['wall_framing'],
    excludedIds: ['roofing'],
    expectedMeasurements: { floorAreaSqft: 720 },
  },
  {
    id: 'new_build_owner_utilities',
    scenario: 'new_build',
    notes:
      '2,800 sqft new home with an attached garage. Frame 2,800 sqft. Sitework and utilities by owner.',
    templateKey: 'addition',
    projectType: 'addition',
    includedIds: ['wall_framing'],
    excludedIds: ['utility_taps', 'utility_trenching'],
  },
  {
    id: 'plan_39_drywall_package',
    scenario: 'plan_takeoff',
    notes: 'Plan 39 house and garage drywall package from the cover sheet.',
    templateKey: 'ground_up',
    projectType: 'ground_up',
    includedIds: ['drywall'],
    excludedIds: [],
    pricedItemIds: ['drywall'],
    measurementOverrides: {
      floorAreaSqft: '3098',
      garageSqft: '972',
      drywallWallSqft: '7742',
      drywallCeilingSqft: '3101',
      garageWallDrywallSqft: '1248',
      garageCeilingDrywallSqft: '972',
      planFacts: {
        buildingAreas: {
          totalLivingSqft: 3098,
          mainFloorLivingSqft: 1892,
          upstairsLivingSqft: 1209,
          garageSqft: 972,
        },
      },
    },
    priceBand: {
      itemId: 'drywall',
      minQuantity: 13000,
      minTotal: 22500,
      maxTotal: 23200,
    },
  },
];

function scenarioFor(note: CanonicalGoldNote): RealNotesScenario {
  if (note.excludedIds.length > 0) return 'exclusion';
  if (note.templateKey === 'room_remodel') return 'mixed';
  if (note.id === 'whole_house_named_packages') return 'whole_home';
  if (note.templateKey === 'addition') return 'addition';
  return 'single_trade';
}

const GOLD_CASES: RealNotesAcceptanceCase[] = CANONICAL_GOLD_NOTES.map(note => ({
  ...note,
  scenario:
    note.id === 'whole_house_named_packages' ? 'whole_home' : scenarioFor(note),
  pricedItemIds:
    note.id === 'contractor_replace_carpet_lvp' ? ['flooring_lvp'] : undefined,
  priceBand:
    note.id === 'contractor_replace_carpet_lvp'
      ? {
          itemId: 'flooring_lvp',
          minQuantity: 800,
          minTotal: 4000,
          maxTotal: 8000,
        }
      : undefined,
  expectedMeasurements:
    note.id === 'paint_walls'
      ? { wallPaintSqft: 2000 }
      : note.id === 'reroof_squares'
        ? { roofSquares: 26 }
        : undefined,
}));

export const REAL_NOTES_ACCEPTANCE_CORPUS: RealNotesAcceptanceCase[] = [
  ...GOLD_CASES,
  ...LAUNCH_CASES,
];

export const REAL_NOTES_ACCEPTANCE_RELEASE = {
  minPassRate: 0.95,
  maxInventedExclusions: 0,
  maxDuplicateLines: 0,
} as const;
