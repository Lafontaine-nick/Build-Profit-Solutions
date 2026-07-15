import {
  resolveQuickMeasurementFields,
  summarizeQuickMeasurementFieldStates,
  quickMeasurementSummaryLine,
  tagPlanDetectedQuickMeasurementKeys,
  groupQuickMeasurementFields,
  pinQuickMeasurementFieldInGroup,
  splitWetAreaQuickMeasurementFields,
} from '@/utils/quickMeasurementProvenance';
import { emptyQuickMeasurementInput, quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';

function groundUpRows() {
  return quickMeasurementRowsForInput('ground_up', 'ground_up', emptyQuickMeasurementInput(), []);
}

describe('resolveQuickMeasurementFields', () => {
  test('a value written directly from plan takeoff shows as Detected from plan', () => {
    const rows = groundUpRows();
    const measurements = { ...emptyQuickMeasurementInput(), floorAreaSqft: '1879', garageSqft: '994' };
    const results = resolveQuickMeasurementFields({
      rows,
      measurements,
      sourceMap: { floorAreaSqft: 'plan_detected', garageSqft: 'plan_detected' },
      includedScopeKeys: [],
    });
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    expect(byKey.floorAreaSqft.state).toBe('detected');
    expect(byKey.garageSqft.state).toBe('detected');
  });

  test('an empty field with a footprint-derived formula shows Estimate available, not Detected', () => {
    const rows = groundUpRows();
    const measurements = { ...emptyQuickMeasurementInput(), floorAreaSqft: '1879', garageSqft: '994' };
    const results = resolveQuickMeasurementFields({
      rows,
      measurements,
      sourceMap: { floorAreaSqft: 'plan_detected', garageSqft: 'plan_detected' },
      includedScopeKeys: ['roofing', 'foundation', 'excavation'],
    });
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    expect(byKey.roofSquares.state).toBe('estimate_available');
    expect(byKey.roofSquares.estimate?.value).toBeGreaterThan(0);
    expect(byKey.concreteCy.state).toBe('estimate_available');
    expect(byKey.excavationCy.state).toBe('estimate_available');
  });

  test('an empty, relevant field with no derivable estimate needs confirmation', () => {
    const rows = groundUpRows();
    const measurements = { ...emptyQuickMeasurementInput(), floorAreaSqft: '1879' };
    const results = resolveQuickMeasurementFields({
      rows,
      measurements,
      includedScopeKeys: ['shower_tile', 'cabinets'],
    });
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    expect(byKey.showerWallTileSqft.state).toBe('needs_confirmation');
    expect(byKey.cabinetLf.state).toBe('needs_confirmation');
  });

  test('irrelevant (not-included) scopes do not surface needs_confirmation or estimate states', () => {
    const rows = groundUpRows();
    const measurements = { ...emptyQuickMeasurementInput(), floorAreaSqft: '1879' };
    const results = resolveQuickMeasurementFields({
      rows,
      measurements,
      sourceMap: { floorAreaSqft: 'plan_detected' },
      includedScopeKeys: [], // nothing included
    });
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    expect(byKey.showerWallTileSqft.state).toBe('not_relevant');
    expect(byKey.cabinetLf.state).toBe('not_relevant');
    expect(byKey.roofSquares.state).toBe('not_relevant');
    expect(byKey.excavationCy.state).toBe('not_relevant');
    // Core structural fields stay relevant even with nothing else included.
    expect(byKey.floorAreaSqft.state).toBe('detected');
  });

  test('note-backed measurements are treated as relevant even when the scope item is not included', () => {
    const rows = groundUpRows();
    const measurements = { ...emptyQuickMeasurementInput(), floorAreaSqft: '1879' };
    const results = resolveQuickMeasurementFields({
      rows,
      measurements,
      noteBackedKeys: ['cabinetLf'],
      includedScopeKeys: [],
    });
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
    expect(byKey.cabinetLf.state).toBe('needs_confirmation');
  });

  test('a suggestion is not confirmed until accepted — raw sourceMap tag alone does not produce a Confirmed badge', () => {
    const rows = groundUpRows();
    const measurements = { ...emptyQuickMeasurementInput(), floorAreaSqft: '1879', garageSqft: '994', roofSquares: '30' };
    const notAccepted = resolveQuickMeasurementFields({
      rows,
      measurements,
      includedScopeKeys: ['roofing'],
    });
    const roofResult = notAccepted.find((r) => r.key === 'roofSquares')!;
    expect(roofResult.filled).toBe(true);
    expect(roofResult.showConfirmedBadge).toBe(false);

    const accepted = resolveQuickMeasurementFields({
      rows,
      measurements,
      sourceMap: { roofSquares: 'user_confirmed_suggestion' },
      userOverrides: { roofSquares: true },
      includedScopeKeys: ['roofing'],
    });
    const acceptedResult = accepted.find((r) => r.key === 'roofSquares')!;
    expect(acceptedResult.state).toBe('confirmed');
    expect(acceptedResult.showConfirmedBadge).toBe(true);
  });

  test('editing a plan-detected value preserves the original provenance tag while resolving as confirmed', () => {
    const rows = groundUpRows();
    const measurements = { ...emptyQuickMeasurementInput(), floorAreaSqft: '2100' };
    const results = resolveQuickMeasurementFields({
      rows,
      measurements,
      sourceMap: { floorAreaSqft: 'plan_detected' },
      userOverrides: { floorAreaSqft: true },
      includedScopeKeys: [],
    });
    const result = results.find((r) => r.key === 'floorAreaSqft')!;
    // State resolves as confirmed (user has overridden it)...
    expect(result.state).toBe('confirmed');
    // ...but no green "just accepted" badge — this was a plain edit, not a "Use suggestion" accept.
    expect(result.showConfirmedBadge).toBe(false);
  });
});

describe('summarizeQuickMeasurementFieldStates', () => {
  test('counts only relevant fields, excluding not_relevant', () => {
    const rows = groundUpRows();
    const measurements = { ...emptyQuickMeasurementInput(), floorAreaSqft: '1879', garageSqft: '994' };
    const results = resolveQuickMeasurementFields({
      rows,
      measurements,
      sourceMap: { floorAreaSqft: 'plan_detected', garageSqft: 'plan_detected' },
      includedScopeKeys: ['roofing'],
    });
    const summary = summarizeQuickMeasurementFieldStates(results);
    expect(summary.detected).toBeGreaterThanOrEqual(2);
    expect(summary.estimateAvailable).toBeGreaterThanOrEqual(1); // roof squares
    expect(summary.relevantTotal).toBe(
      summary.detected + summary.estimateAvailable + summary.needsConfirmation + summary.confirmed
    );
  });

  test('quickMeasurementSummaryLine renders the three-bucket summary format', () => {
    const line = quickMeasurementSummaryLine({
      detected: 12,
      estimateAvailable: 6,
      needsConfirmation: 4,
      confirmed: 0,
      relevantTotal: 22,
    });
    expect(line).toBe('12 from plan · 6 suggestions · 4 need confirmation');
  });
});

describe('groupQuickMeasurementFields', () => {
  test('splits fields into From plan, Suggestions, Needs confirmation, and More', () => {
    const rows = groundUpRows();
    const measurements = { ...emptyQuickMeasurementInput(), floorAreaSqft: '1879', garageSqft: '994' };
    const results = resolveQuickMeasurementFields({
      rows,
      measurements,
      sourceMap: { floorAreaSqft: 'plan_detected', garageSqft: 'plan_detected' },
      includedScopeKeys: ['roofing', 'foundation', 'excavation', 'cabinets', 'shower_tile'],
    });
    const groups = groupQuickMeasurementFields(results);
    expect(groups.fromPlan.map((r) => r.key)).toEqual(expect.arrayContaining(['floorAreaSqft', 'garageSqft']));
    expect(groups.suggestions.map((r) => r.key)).toEqual(
      expect.arrayContaining(['roofSquares', 'concreteCy', 'excavationCy'])
    );
    expect(groups.needsConfirmation.map((r) => r.key)).toEqual(
      expect.arrayContaining(['cabinetLf', 'showerWallTileSqft'])
    );
    expect(groups.more.length).toBeGreaterThan(0);
    expect(groups.more.every((r) => r.state === 'not_relevant')).toBe(true);
    // Irrelevant blanks must not appear in needs confirmation.
    expect(groups.needsConfirmation.every((r) => r.state === 'needs_confirmation')).toBe(true);
  });
});

describe('splitWetAreaQuickMeasurementFields', () => {
  test('moves shower and bath floor fields out of Suggestions / Needs confirmation', () => {
    const rows = groundUpRows();
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: {
        ...emptyQuickMeasurementInput(),
        floorAreaSqft: '1879',
        wetAreaFinish: 'tile',
        bathCount: 2,
      },
      includedScopeKeys: ['roofing', 'tile_flooring', 'interior_finishes', 'cabinets_counters'],
    });
    const groups = groupQuickMeasurementFields(results);
    expect(groups.suggestions.map((r) => r.key)).toEqual(
      expect.arrayContaining(['showerWallTileSqft', 'showerFloorTileSqft'])
    );

    const split = splitWetAreaQuickMeasurementFields(groups);
    expect(split.groups.suggestions.map((r) => r.key)).not.toContain('showerWallTileSqft');
    expect(split.groups.suggestions.map((r) => r.key)).not.toContain('showerFloorTileSqft');
    expect(split.groups.needsConfirmation.map((r) => r.key)).not.toContain('bathroomFloorSqft');
    expect(split.wetArea.map((r) => r.key)).toEqual([
      'bathroomFloorSqft',
      'showerWallTileSqft',
      'showerFloorTileSqft',
    ]);
  });
});

describe('pinQuickMeasurementFieldInGroup', () => {
  test('keeps a typed field in Needs confirmation while focused instead of jumping to Confirmed', () => {
    const rows = groundUpRows();
    const empty = resolveQuickMeasurementFields({
      rows,
      measurements: { ...emptyQuickMeasurementInput(), floorAreaSqft: '1879' },
      includedScopeKeys: ['tile_flooring', 'cabinets'],
    });
    const emptyGroups = groupQuickMeasurementFields(empty);
    const bathIndex = emptyGroups.needsConfirmation.findIndex((r) => r.key === 'bathroomFloorSqft');
    expect(bathIndex).toBeGreaterThanOrEqual(0);

    const filled = resolveQuickMeasurementFields({
      rows,
      measurements: { ...emptyQuickMeasurementInput(), floorAreaSqft: '1879', bathroomFloorSqft: '95' },
      userOverrides: { bathroomFloorSqft: true },
      includedScopeKeys: ['tile_flooring', 'cabinets'],
    });
    const filledGroups = groupQuickMeasurementFields(filled);
    expect(filledGroups.confirmed.map((r) => r.key)).toContain('bathroomFloorSqft');
    expect(filledGroups.needsConfirmation.map((r) => r.key)).not.toContain('bathroomFloorSqft');

    const pinned = pinQuickMeasurementFieldInGroup(
      filledGroups,
      'bathroomFloorSqft',
      'needsConfirmation',
      bathIndex
    );
    expect(pinned.needsConfirmation.map((r) => r.key)).toContain('bathroomFloorSqft');
    expect(pinned.confirmed.map((r) => r.key)).not.toContain('bathroomFloorSqft');
    expect(pinned.needsConfirmation[bathIndex].key).toBe('bathroomFloorSqft');
  });
});

describe('tagPlanDetectedQuickMeasurementKeys', () => {
  test('tags new keys as detected_from_plan without clobbering an accepted-suggestion tag', () => {
    const existing = { roofSquares: 'user_confirmed_suggestion' as const };
    const next = tagPlanDetectedQuickMeasurementKeys(existing, ['roofSquares', 'floorAreaSqft']);
    expect(next.roofSquares).toBe('user_confirmed_suggestion');
    expect(next.floorAreaSqft).toBe('detected_from_plan');
  });
});
