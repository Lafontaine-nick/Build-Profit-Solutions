/**
 * Regression fixture using the real SHV Lot 41 plan takeoff figures
 * (1,879 sqft living, 994 sqft garage, 247 sqft covered patio, dimensioned
 * rooms, foundation/roof plans with 5:12 pitch). Validates general
 * source-aware Quick Measurement behavior end to end — plan import →
 * Confirm Scope hydration → per-field UI state — without hard-coding
 * pricing values for this specific plan.
 */
jest.mock('@/utils/resolveAiBackendUrl', () => ({
  postAiAssistantJson: jest.fn(),
  resolveAiBackendUrl: jest.fn(() => 'http://localhost'),
}));

import { applyPlanImportToDraft } from '@/utils/estimateAiDraft';
import { initialScopeMeasurementInputExtended } from '@/utils/scopeItemQuantities';
import { resolveQuickMeasurementFields, groupQuickMeasurementFields } from '@/utils/quickMeasurementProvenance';
import { quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';
import { LOT_41_PLAN_ROOMS, PLAN_MEASUREMENT_LOTS } from '@/testFixtures/planMeasurementLots';

const LOT_41_INCLUDED_SCOPE_KEYS = [
  'foundation',
  'excavation',
  'sitework',
  'roofing',
  'drywall',
  'interior_finishes',
  'paint_trim',
  'tile_flooring',
  'cabinets',
  'countertops',
  'floor_tile',
  'shower_tile',
  'shower_floor_tile',
  'concrete',
];

function buildLot41Draft() {
  return {
    scopeChecklist: {
      estimateTier: 'complex',
      templateKey: 'ground_up',
      title: 'Confirm scope',
      intro: '',
      items: LOT_41_INCLUDED_SCOPE_KEYS.map((id) => ({ id, label: id, state: 'included' as const })),
    },
  } as any;
}

function buildLot41FieldStates() {
  const draft = applyPlanImportToDraft(buildLot41Draft(), {
    measurements: {
      floorAreaSqft: 1879,
      garageSqft: 994,
      deckSqft: 247,
    },
    rooms: [
      { name: 'Kitchen', lengthFt: 13.083, widthFt: 14.833, areaSqft: 194.1, sourceType: 'plan_explicit' },
      { name: 'Primary Bath', lengthFt: 10, widthFt: 9.5, areaSqft: 95, sourceType: 'plan_explicit' },
      { name: 'Primary Suite', lengthFt: 15.333, widthFt: 16.583, areaSqft: 254.3, sourceType: 'plan_explicit' },
      { name: 'Great Room', lengthFt: 14.833, widthFt: 17.5, areaSqft: 259.6, sourceType: 'plan_explicit' },
      { name: 'Garage', areaSqft: 994, sourceType: 'plan_explicit' },
    ],
    planFacts: PLAN_MEASUREMENT_LOTS['41'].facts,
  });

  const input = initialScopeMeasurementInputExtended(draft);
  const rows = quickMeasurementRowsForInput('ground_up', 'ground_up', input, []);
  const results = resolveQuickMeasurementFields({
    rows,
    measurements: input,
    sourceMap: input.quickMeasurementSources,
    userOverrides: input.quickMeasurementUserOverrides,
    includedScopeKeys: LOT_41_INCLUDED_SCOPE_KEYS,
  });
  return { draft, input, byKey: Object.fromEntries(results.map((r) => [r.key, r])) };
}

describe('SHV Lot 41 Quick Measurement states (regression fixture)', () => {
  test('living area, garage, and patio detect directly from plan takeoff', () => {
    const { byKey } = buildLot41FieldStates();
    expect(byKey.floorAreaSqft.state).toBe('detected');
    expect(byKey.garageSqft.state).toBe('detected');
    expect(byKey.deckSqft.state).toBe('detected');
  });

  test('kitchen floor detects from plan room fold-in', () => {
    const { byKey } = buildLot41FieldStates();
    expect(byKey.kitchenFloorSqft.state).toBe('detected');
  });

  test('room list is captured from the plan for background formula use', () => {
    const { draft } = buildLot41FieldStates();
    expect(draft.scopeMeasurements?.planRooms?.length).toBeGreaterThan(0);
    expect(draft.scopeMeasurements?.planRooms?.map((r: any) => r.name)).toContain('Kitchen');
  });

  test('roof squares, foundation CY, and excavation CY are Estimate available — not Detected, not Needs confirmation', () => {
    const { byKey } = buildLot41FieldStates();
    expect(byKey.roofSquares.state).toBe('estimate_available');
    expect(byKey.concreteCy.state).toBe('estimate_available');
    expect(byKey.excavationCy.state).toBe('estimate_available');
    expect(byKey.roofSquares.estimate).not.toBeNull();
    expect(byKey.concreteCy.estimate).not.toBeNull();
    expect(byKey.excavationCy.estimate).not.toBeNull();
  });

  test('drywall and interior/exterior paint are Estimate available and never mislabeled Detected', () => {
    const { byKey } = buildLot41FieldStates();
    expect(byKey.drywallSqft.state).toBe('estimate_available');
    expect(byKey.wallPaintSqft.state).toBe('estimate_available');
    expect(byKey.exteriorPaintSqft.state).toBe('estimate_available');
    expect(byKey.drywallSqft.estimate?.sourceType).toBe('estimated_from_formula');
    expect(byKey.wallPaintSqft.estimate?.sourceType).toBe('estimated_from_formula');
    expect(byKey.exteriorPaintSqft.estimate?.sourceType).toBe('estimated_from_formula');
    expect(byKey.drywallSqft.sourceLabel).toBe('Planning estimate');
    expect(byKey.wallPaintSqft.sourceLabel).toBe('Planning estimate · derived from drywall surfaces');
    expect(byKey.exteriorPaintSqft.sourceLabel).toBe('Planning estimate');
    expect(byKey.drywallSqft.estimate?.inputsUsed.wallHeightFt).toBe(10.2);
    expect(byKey.drywallSqft.estimate?.summary).not.toMatch(/\.\d/);
    expect(byKey.wallPaintSqft.estimate?.summary).toBe(byKey.drywallSqft.estimate?.summary);
  });

  test('cabinets, countertops, and shower tile need confirmation — no invented quantities without tile finish', () => {
    const { byKey } = buildLot41FieldStates();
    expect(byKey.cabinetLf.state).toBe('needs_confirmation');
    expect(byKey.countertopSqft.state).toBe('needs_confirmation');
    expect(byKey.showerWallTileSqft.state).toBe('needs_confirmation');
    expect(byKey.showerFloorTileSqft.state).toBe('needs_confirmation');
    expect(byKey.cabinetLf.estimate).toBeNull();
    expect(byKey.countertopSqft.estimate).toBeNull();
    expect(byKey.showerWallTileSqft.estimate).toBeNull();
  });

  test('tile wet-area finish unlocks shower planning estimates from labeled baths', () => {
    const draft = applyPlanImportToDraft(buildLot41Draft(), {
      measurements: {
        floorAreaSqft: 1879,
        garageSqft: 994,
        deckSqft: 247,
      },
      rooms: [
        { name: 'Kitchen', lengthFt: 13.083, widthFt: 14.833, areaSqft: 194.1, sourceType: 'plan_explicit' },
        { name: 'Primary Bath', lengthFt: 10, widthFt: 9.5, areaSqft: 95, sourceType: 'plan_explicit' },
        { name: 'Bath 2', areaSqft: 42, sourceType: 'plan_explicit' },
      ],
      planFacts: PLAN_MEASUREMENT_LOTS['41'].facts,
    });
    draft.scopeMeasurements = {
      ...(draft.scopeMeasurements || {}),
      wetAreaFinish: 'tile',
      bathCount: 2,
    };
    const input = initialScopeMeasurementInputExtended(draft);
    expect(input.bathCount).toBe(2);
    expect(Number(input.bathroomFloorSqft)).toBe(137);
    const rows = quickMeasurementRowsForInput('ground_up', 'ground_up', input, []);
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: input,
      sourceMap: input.quickMeasurementSources,
      userOverrides: input.quickMeasurementUserOverrides,
      includedScopeKeys: LOT_41_INCLUDED_SCOPE_KEYS,
    });
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    expect(byKey.showerWallTileSqft.state).toBe('estimate_available');
    expect(byKey.showerFloorTileSqft.state).toBe('estimate_available');
    expect(byKey.showerWallTileSqft.estimate?.value).toBe(160);
    expect(byKey.showerFloorTileSqft.estimate?.value).toBe(30);
  });

  test('entered bath count unlocks shower planning estimates when plan has no bath labels', () => {
    const draft = applyPlanImportToDraft(buildLot41Draft(), {
      measurements: { floorAreaSqft: 1879, garageSqft: 994, deckSqft: 247 },
      rooms: LOT_41_PLAN_ROOMS,
      planFacts: PLAN_MEASUREMENT_LOTS['41'].facts,
    });
    draft.scopeMeasurements = {
      ...(draft.scopeMeasurements || {}),
      wetAreaFinish: 'tile',
      bathCount: 3,
    };
    const input = initialScopeMeasurementInputExtended(draft);
    expect(input.bathCount).toBe(3);
    const rows = quickMeasurementRowsForInput('ground_up', 'ground_up', input, []);
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: input,
      sourceMap: input.quickMeasurementSources,
      includedScopeKeys: LOT_41_INCLUDED_SCOPE_KEYS,
    });
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    expect(byKey.showerWallTileSqft.state).toBe('estimate_available');
    expect(byKey.showerFloorTileSqft.state).toBe('estimate_available');
    expect(byKey.showerWallTileSqft.estimate?.value).toBe(240);
    expect(byKey.showerFloorTileSqft.estimate?.value).toBe(45);
  });

  test('prefab bath count can be added without clearing tile shower estimates', () => {
    const draft = applyPlanImportToDraft(buildLot41Draft(), {
      measurements: { floorAreaSqft: 1879, garageSqft: 994, deckSqft: 247 },
      rooms: LOT_41_PLAN_ROOMS,
      planFacts: PLAN_MEASUREMENT_LOTS['41'].facts,
    });
    draft.scopeMeasurements = {
      ...(draft.scopeMeasurements || {}),
      bathCount: 2,
      prefabBathCount: 1,
      wetAreaFinish: 'tile',
      bathroomFloorSqft: 160,
      showerWallTileSqft: 180,
      showerFloorTileSqft: 40,
    };
    const input = initialScopeMeasurementInputExtended(draft);
    expect(input.bathCount).toBe(2);
    expect(input.prefabBathCount).toBe(1);
    expect(Number(input.showerWallTileSqft)).toBe(180);
    const rows = quickMeasurementRowsForInput('ground_up', 'ground_up', input, []);
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: {
        ...input,
        // Simulate empty shower fields with mixed counts — estimates still tile-based.
        showerWallTileSqft: '',
        showerFloorTileSqft: '',
      },
      sourceMap: input.quickMeasurementSources,
      includedScopeKeys: LOT_41_INCLUDED_SCOPE_KEYS,
    });
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    expect(byKey.showerWallTileSqft.state).toBe('estimate_available');
    expect(byKey.showerWallTileSqft.estimate?.value).toBe(160);
    expect(byKey.showerFloorTileSqft.estimate?.value).toBe(30);
  });

  test('tub wet-area finish hides shower tile Quick Measurements', () => {
    const draft = applyPlanImportToDraft(buildLot41Draft(), {
      measurements: { floorAreaSqft: 1879, garageSqft: 994, deckSqft: 247 },
      rooms: [{ name: 'Primary Bath', areaSqft: 95, sourceType: 'plan_explicit' }],
      planFacts: PLAN_MEASUREMENT_LOTS['41'].facts,
    });
    draft.scopeMeasurements = {
      ...(draft.scopeMeasurements || {}),
      wetAreaFinish: 'tub',
      tubBathCount: 1,
      bathCount: null,
    };
    const input = initialScopeMeasurementInputExtended(draft);
    const rows = quickMeasurementRowsForInput('ground_up', 'ground_up', input, []);
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: { ...input, bathCount: null, tubBathCount: 1, wetAreaFinish: 'tub' },
      sourceMap: input.quickMeasurementSources,
      includedScopeKeys: LOT_41_INCLUDED_SCOPE_KEYS,
    });
    const showerWall = results.find((r) => r.key === 'showerWallTileSqft');
    const showerFloor = results.find((r) => r.key === 'showerFloorTileSqft');
    expect(showerWall?.state).toBe('not_relevant');
    expect(showerFloor?.state).toBe('not_relevant');
  });

  test('bath floor is scope-gated and detected from plan rooms when present', () => {
    const { byKey } = buildLot41FieldStates();
    // Primary Bath room folds into bathroomFloorSqft on import.
    expect(byKey.bathroomFloorSqft.state).toBe('detected');
    expect(byKey.bathroomFloorSqft.relevant).toBe(true);
  });

  test('bath floor is not a blocker when flooring/tile scopes are excluded', () => {
    const draft = applyPlanImportToDraft(buildLot41Draft(), {
      measurements: { floorAreaSqft: 1879, garageSqft: 994, deckSqft: 247 },
      rooms: [],
    });
    const input = initialScopeMeasurementInputExtended(draft);
    const rows = quickMeasurementRowsForInput('ground_up', 'ground_up', input, []);
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: input,
      sourceMap: input.quickMeasurementSources,
      includedScopeKeys: ['foundation', 'roofing', 'drywall'],
    });
    const bath = results.find((r) => r.key === 'bathroomFloorSqft');
    expect(bath?.state).toBe('not_relevant');
  });

  test('exterior flatwork needs confirmation until driveway/walks can be measured from a site plan', () => {
    const { byKey } = buildLot41FieldStates();
    expect(byKey.concreteSqft.state).toBe('needs_confirmation');
  });

  test('no planning estimate is ever labeled Detected from plan', () => {
    const { byKey } = buildLot41FieldStates();
    const estimateKeys = ['roofSquares', 'concreteCy', 'excavationCy', 'drywallSqft', 'wallPaintSqft', 'exteriorPaintSqft'];
    for (const key of estimateKeys) {
      expect(byKey[key].state).not.toBe('detected');
    }
  });

  test('fields group into From plan / Suggestions / Needs confirmation without mixing', () => {
    const { byKey } = buildLot41FieldStates();
    const results = Object.values(byKey);
    const groups = groupQuickMeasurementFields(results);
    expect(groups.fromPlan.every((r) => r.state === 'detected')).toBe(true);
    expect(groups.suggestions.every((r) => r.state === 'estimate_available')).toBe(true);
    expect(groups.needsConfirmation.every((r) => r.state === 'needs_confirmation')).toBe(true);
    expect(groups.fromPlan.map((r) => r.key)).toEqual(
      expect.arrayContaining(['floorAreaSqft', 'garageSqft', 'deckSqft'])
    );
    expect(groups.suggestions.map((r) => r.key)).toEqual(
      expect.arrayContaining(['roofSquares', 'concreteCy', 'excavationCy', 'drywallSqft'])
    );
    expect(groups.needsConfirmation.map((r) => r.key)).toEqual(
      expect.arrayContaining(['cabinetLf', 'countertopSqft', 'showerWallTileSqft'])
    );
    // Excavation suggestion must not be the old full-footprint dig (~489 CY).
    expect(byKey.excavationCy.estimate!.value).toBeLessThan(200);
    expect(byKey.concreteCy.estimate!.quantityLabel).toMatch(/building slabs/i);
  });
});
