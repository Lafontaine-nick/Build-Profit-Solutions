import { buildAreaReconciliation } from '@/utils/measurementSemantics';
import {
  applyPlanTakeoffButtonLabel,
  buildImportedPlanSummaryText,
  garageReconciliationStatusLabel,
  importedPlanSummaryCollapsedSubtitle,
  livingReconciliationStatusLabel,
  measurementDisplayLabel,
  measurementSourceLabel,
  readyStateSummary,
  resolvePlanAreaReconciliation,
  scopeTakeoffStatusLines,
  spacesDetectedTitle,
  stripPlanTakeoffFromNotes,
} from '@/utils/planTakeoffReviewUi';

/** Lot 41-style spaces used across reconciliation + label tests. */
const LOT_41_ROOMS = [
  { name: 'Dining', areaSqft: 112.3 },
  { name: 'Primary Suite', areaSqft: 254.3 },
  { name: 'Great Room', areaSqft: 259.6 },
  { name: 'Closet', areaSqft: 54.6 },
  { name: 'Kitchen', areaSqft: 194.1 },
  { name: 'Laundry', areaSqft: 42 },
  { name: 'RV Garage', areaSqft: 512.5 },
  { name: 'Pantry', areaSqft: 39 },
  { name: 'Den/Bed 4', areaSqft: 110.2 },
  { name: 'Garage', areaSqft: 443.7 },
  { name: 'Bed 3', areaSqft: 106.8 },
  { name: 'Bed 2/Office', areaSqft: 109.3 },
];

describe('plan takeoff review UI polish', () => {
  const originalSemantics = process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1;

  afterEach(() => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = originalSemantics;
  });

  it('replaces Rooms (x of x) with spaces detected when semantics enabled', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    expect(spacesDetectedTitle(12)).toBe('12 spaces detected');
    expect(spacesDetectedTitle(12)).not.toMatch(/Rooms\s*\(/i);
  });

  it('computes Lot 41 living and garage area reconciliation without changing math', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const recon = resolvePlanAreaReconciliation({
      measurements: { floorAreaSqft: 1879, garageSqft: 994, deckSqft: 247 },
      rooms: LOT_41_ROOMS,
    });

    expect(recon.declaredLivingSf).toBe(1879);
    expect(recon.detectedLivingRoomSf).toBeCloseTo(1282.2, 1);
    expect(recon.unassignedLivingSf).toBeCloseTo(596.8, 1);
    expect(recon.declaredGarageSf).toBe(994);
    expect(recon.detectedGarageRoomSf).toBeCloseTo(956.2, 1);
    expect(recon.unassignedGarageSf).toBeCloseTo(37.8, 1);
    // Underlying status threshold may still be material_variance — display must not say that.
    expect(recon.status).toBe('material_variance');
  });

  it('does not display material variance for living net-vs-gross room gap', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const recon = buildAreaReconciliation({
      declaredLivingSf: 1879,
      declaredGarageSf: 994,
      rooms: LOT_41_ROOMS,
    });
    const livingStatus = livingReconciliationStatusLabel(recon);
    expect(livingStatus).toMatch(/Room detection incomplete|Partial room coverage/i);
    expect(livingStatus).toMatch(/596\.8/);
    expect(livingStatus).not.toMatch(/material variance/i);

    const garageStatus = garageReconciliationStatusLabel(recon);
    expect(garageStatus).toBe('Minor unreconciled area');
    expect(garageStatus).not.toMatch(/material variance/i);
  });

  it('shows one concise Gross interior floor area explanation', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const display = measurementDisplayLabel('flooringSqft', 1879, 1879);
    expect(display.label).toBe('Gross interior floor area');
    expect(display.subtext).toBe(
      'Derived from declared living area — finish allocation required'
    );
    // No second source/explanation line for flooring derived from living SF.
    expect(
      measurementSourceLabel({ key: 'flooringSqft', value: 1879, livingSf: 1879 })
    ).toBeNull();
  });

  it('shows measurement source labels when semantics enabled', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const living = measurementSourceLabel({
      key: 'floorAreaSqft',
      assumptions: ['Total living from Building Areas table on cover sheet page 1'],
    });
    expect(living).toMatch(/Explicitly stated on cover sheet/i);
    expect(living).toMatch(/page 1/i);

    const kitchen = measurementSourceLabel({
      key: 'kitchenFloorSqft',
      assumptions: ['Kitchen floor derived from room dimensions on page 4'],
    });
    expect(kitchen).toMatch(/Derived from room dimensions/i);
    expect(kitchen).toMatch(/page 4/i);
  });

  it('distinguishes MEP electrical evidence from plumbing/HVAC assumptions', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const mep = scopeTakeoffStatusLines({
      itemId: 'mep_rough',
      evidence: 'electrical plan on page 10',
    });
    expect(mep[0]).toMatch(/Electrical detected on page 10/i);
    expect(mep[0]).toMatch(/plumbing and HVAC require trade review/i);
    expect(mep.some((l) => /Needs trade counts \/ installed-package pricing/i.test(l))).toBe(true);
    expect(mep.join(' ')).not.toMatch(/^Detected from electrical plan — page 10$/i);
  });

  it('keeps tile & flooring page-4 source when plan floor areas exist', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const tile = scopeTakeoffStatusLines({
      itemId: 'tile_flooring',
      evidence: 'standard for ground-up new construction',
      hasPlanFloorAreas: true,
      assumptions: ['Room dimensions from floor plan page 4'],
    });
    expect(tile.some((l) => /Floor areas detected from page 4/i.test(l))).toBe(true);
    expect(tile.some((l) => /Needs finish allocation and material-specific takeoff/i.test(l))).toBe(
      true
    );
    expect(tile.join(' ').toLowerCase()).not.toBe('standard for ground-up new construction');
  });

  it('shows missing-takeoff statuses for foundation, framing, insulation and drywall', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    expect(
      scopeTakeoffStatusLines({
        itemId: 'foundation',
        evidence: 'foundation plan on page 3',
      }).some((l) => /Needs structural takeoff/i.test(l))
    ).toBe(true);

    expect(
      scopeTakeoffStatusLines({
        itemId: 'framing',
        evidence: 'framing plan on page 5',
      }).some((l) => /Benchmark pricing available/i.test(l))
    ).toBe(true);

    expect(
      scopeTakeoffStatusLines({
        itemId: 'insulation',
        evidence: 'Standard ground-up scope for a full residential plan set',
      }).some((l) => /Needs envelope surface takeoff/i.test(l))
    ).toBe(true);

    expect(
      scopeTakeoffStatusLines({
        itemId: 'drywall',
        evidence: 'Standard ground-up scope for a full residential plan set',
      }).some((l) => /Needs wall and ceiling takeoff/i.test(l))
    ).toBe(true);
  });

  it('keeps imported plan summary distinct and provides collapsed subtitle', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const merged =
      'Customer wants LVP in living areas.\n\n--- Plan takeoff ---\nTotal living area is 1879 sqft.\n';
    const jobNotes = stripPlanTakeoffFromNotes(merged);
    expect(jobNotes).toContain('Customer wants LVP');
    expect(jobNotes).not.toMatch(/Plan takeoff/i);

    const summary = buildImportedPlanSummaryText({
      notesBlock: '--- Plan takeoff ---\nTotal living area is 1879 sqft.',
      measurements: { floorAreaSqft: 1879 },
      rooms: LOT_41_ROOMS.slice(0, 2),
    });
    expect(summary).toMatch(/Plan takeoff/i);
    expect(jobNotes).not.toEqual(summary);

    expect(
      importedPlanSummaryCollapsedSubtitle({
        livingSf: 1879,
        spaceCount: 12,
        scopeCount: 13,
      })
    ).toBe('1,879 SF · 12 detected spaces · 13 scope items');
  });

  it('uses Apply plan takeoff when semantics enabled', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    expect(
      applyPlanTakeoffButtonLabel({
        includedMeasurementCount: 5,
        checkedScopeCount: 13,
        semanticsEnabled: true,
      })
    ).toBe('Apply plan takeoff');
  });

  it('uses preferred ready-state copy with detected spaces', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    expect(
      readyStateSummary({ measurementCount: 5, spaceCount: 12, scopeCount: 13 })
    ).toBe('Ready · 5 project measurements · 12 detected spaces · 13 scope items');
  });

  it('preserves legacy UI wording when feature flag disabled', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'false';
    expect(measurementDisplayLabel('flooringSqft', 1879, 1879).label).toBe('flooringSqft');
    expect(measurementSourceLabel({ key: 'floorAreaSqft' })).toBeNull();
    expect(scopeTakeoffStatusLines({ itemId: 'foundation', evidence: 'page 3' })).toEqual([
      'page 3',
    ]);
    expect(
      applyPlanTakeoffButtonLabel({
        includedMeasurementCount: 5,
        checkedScopeCount: 13,
        semanticsEnabled: false,
      })
    ).toBe('Apply to bid');
  });

  it('does not force room totals to declared living area', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const recon = buildAreaReconciliation({
      declaredLivingSf: 1879,
      declaredGarageSf: 994,
      rooms: LOT_41_ROOMS,
    });
    expect(recon.detectedLivingRoomSf).not.toBe(1879);
    expect(recon.unassignedLivingSf).toBeGreaterThan(0);
  });
});
