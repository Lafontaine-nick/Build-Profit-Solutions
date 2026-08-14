import { buildAreaReconciliation } from '@/utils/measurementSemantics';
import {
  applyPlanTakeoffButtonLabel,
  buildConcretePlanReviewSummary,
  buildElectricalPlanReviewSummary,
  buildFlooringPlanReviewSummary,
  buildPaintingPlanReviewSummary,
  buildImportedPlanSummaryText,
  buildPlanReadyJobNotesPrompt,
  ensureGroundUpPlanNotes,
  garageReconciliationStatusLabel,
  importedPlanSummaryCollapsedSubtitle,
  planImportLooksLikeGroundUp,
  livingReconciliationStatusLabel,
  measurementDisplayLabel,
  measurementSourceLabel,
  planReviewProvenanceFlags,
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

  it('prefills job notes prompt after plan import when user notes are empty', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const prompt = buildPlanReadyJobNotesPrompt({
      livingSf: 3098,
      measurementCount: 4,
      spaceCount: 9,
      scopeCount: 18,
    });
    expect(prompt).toMatch(/Ground-up new construction plan imported and ready to generate/i);
    expect(prompt).toMatch(/3,098 SF/);
    expect(prompt).toMatch(/Generate Estimate Draft/i);
    expect(prompt).not.toMatch(/Plan takeoff/i);
  });

  it('detects whole-home plan import and stamps ground-up notes for draft classification', () => {
    expect(
      planImportLooksLikeGroundUp({
        measurements: { floorAreaSqft: 3098, garageSqft: 972 },
        rooms: Array.from({ length: 9 }, (_, i) => ({ name: `Room ${i}`, areaSqft: 100 })),
        scopeDetections: [{ itemId: 'foundation' }, { itemId: 'framing' }],
      })
    ).toBe(true);
    expect(ensureGroundUpPlanNotes('3,098 SF · 9 detected spaces', true)).toMatch(
      /Ground-up new construction/i
    );
    expect(ensureGroundUpPlanNotes('Kitchen remodel only', true)).toMatch(/Kitchen remodel only/i);
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

  it('builds grouped Concrete plan review summary with per-type flatwork and footing CY', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const summary = buildConcretePlanReviewSummary({
      concreteDrivewaySqft: 800,
      concretePatioSqft: 250,
      concreteWalkwaySqft: 140,
      concreteCy: 32,
      excavationCy: 100,
    });
    expect(summary).toEqual(
      expect.arrayContaining([
        { label: 'Driveway', value: '800 sqft' },
        { label: 'Patio', value: '250 sqft' },
        { label: 'Walkway', value: '140 sqft' },
        { label: 'Sidewalk', value: '—' },
        { label: 'RV pad', value: '—' },
        { label: 'Footing / foundation', value: '32 CY' },
        { label: 'Excavation', value: '100 CY' },
        {
          label: 'Thickness',
          value: 'Needs confirmation',
          note: 'Confirm 4" / 5" / 6" per slab type in Confirm Scope',
        },
      ])
    );
  });

  it('shows aggregate flatwork total when only concreteSqft is supplied', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const summary = buildConcretePlanReviewSummary({ concreteSqft: 500 });
    expect(summary[0]).toMatchObject({
      label: 'Flatwork total',
      value: '500 sqft',
      note: 'Assign driveway / patio / walkway type in Confirm Scope',
    });
  });

  it('builds grouped Flooring plan review summary with per-type install areas', () => {
    const summary = buildFlooringPlanReviewSummary({
      flooringCarpetSqft: 500,
      flooringTileSqft: 1500,
      flooringExistingTypes: ['carpet', 'tile'],
      floorDemoSqft: 2000,
      baseboardLf: 200,
    });
    expect(summary).toEqual(
      expect.arrayContaining([
        { label: 'Total floor area', value: '2,000 sqft' },
        { label: 'Carpet', value: '500 sqft' },
        { label: 'Tile', value: '1,500 sqft' },
        { label: 'Existing floor', value: 'Carpet, Tile' },
        { label: 'Demo / removal', value: '2,000 sqft' },
        { label: 'Subfloor prep', value: 'Needs confirmation' },
        { label: 'Baseboards', value: '200 LF' },
        { label: 'Transitions', value: '—' },
        { label: 'Quarter round', value: '—' },
      ])
    );
  });

  it('shows aggregate flooring total and needs confirmation when only flooringSqft is supplied', () => {
    const summary = buildFlooringPlanReviewSummary({ flooringSqft: 1850 });
    expect(summary).toEqual(
      expect.arrayContaining([
        { label: 'Total floor area', value: '1,850 sqft' },
        {
          label: 'Flooring type',
          value: 'Needs confirmation',
          note: 'Assign flooring type in Confirm Scope',
        },
        { label: 'Existing floor', value: 'Needs confirmation' },
        { label: 'Demo / removal', value: 'Needs confirmation' },
        { label: 'Subfloor prep', value: 'Needs confirmation' },
      ])
    );
  });

  it('builds grouped Painting plan review summary with interior and exterior rows', () => {
    const summary = buildPaintingPlanReviewSummary({
      wallPaintSqft: 8500,
      ceilingPaintSqft: 3200,
      interiorDoorCount: 16,
      baseboardLf: 1150,
      cabinetRunLf: 62,
      exteriorPaintSqft: 3800,
    });
    expect(summary).toEqual(
      expect.arrayContaining([
        { label: 'Walls', value: '8,500 sqft' },
        { label: 'Ceilings', value: '3,200 sqft' },
        { label: 'Doors', value: '16 EA' },
        { label: 'Baseboard / trim', value: '1,150 LF' },
        { label: 'Cabinet painting', value: '62 LF' },
        { label: 'Exterior walls', value: '3,800 sqft' },
        { label: 'Job condition', value: 'Needs confirmation' },
        { label: 'Application method', value: 'Needs confirmation' },
        { label: 'Prep / masking', value: 'Needs confirmation' },
      ])
    );
  });

  it('shows combined painting area as needs confirmation without occupancy defaults', () => {
    const summary = buildPaintingPlanReviewSummary({ paintAreaSqft: 1500 });
    expect(summary).toEqual(
      expect.arrayContaining([
        {
          label: 'Combined paintable area',
          value: '1,500 sqft',
          note: 'Choose combined or separate walls/ceilings in Confirm Scope',
        },
        { label: 'Job condition', value: 'Needs confirmation' },
        { label: 'Application method', value: 'Needs confirmation' },
      ])
    );
    expect(summary.some(line => line.label === 'Walls')).toBe(false);
    expect(summary.some(line => line.label === 'Ceilings')).toBe(false);
  });

  it('labels geometry-derived Painting quantities in Plan Review', () => {
    const summary = buildPaintingPlanReviewSummary(
      {
        wallPaintSqft: 5000,
        ceilingPaintSqft: 2000,
        interiorDoorCount: 12,
        baseboardLf: 800,
      },
      {
        wallPaintSqft: { source: 'measured_from_geometry' },
        ceilingPaintSqft: { source: 'measured_from_geometry' },
        interiorDoorCount: { source: 'detected_from_plan' },
        baseboardLf: { source: 'measured_from_geometry' },
      }
    );
    expect(summary).toEqual(
      expect.arrayContaining([
        {
          label: 'Walls',
          value: '5,000 sqft',
          note: 'Calculated from plan geometry',
        },
        {
          label: 'Ceilings',
          value: '2,000 sqft',
          note: 'Calculated from plan geometry',
        },
        { label: 'Doors', value: '12 EA', note: 'From plan' },
        {
          label: 'Baseboard / trim',
          value: '800 LF',
          note: 'Calculated from plan geometry',
        },
        { label: 'Job condition', value: 'Needs confirmation' },
      ])
    );
  });

  it('treats geometry-derived painting keys as calculated, not planning estimates', () => {
    expect(
      planReviewProvenanceFlags({
        key: 'ceilingPaintSqft',
        provenanceEntry: { source: 'measured_from_geometry' },
      })
    ).toMatchObject({
      hasReliableDimensions: true,
      hasExplicitPlanSource: false,
    });
    expect(
      planReviewProvenanceFlags({
        key: 'interiorDoorCount',
        provenanceEntry: { source: 'detected_from_plan' },
      }).hasExplicitPlanSource
    ).toBe(true);
  });

  it('flags incomplete painting geometry as needs review, not reliable dimensions', () => {
    expect(
      planReviewProvenanceFlags({
        key: 'wallPaintSqft',
        provenanceEntry: { source: 'measured_from_geometry', coverage: 'incomplete' },
      })
    ).toMatchObject({
      hasReliableDimensions: false,
      roomDependent: true,
    });
    const summary = buildPaintingPlanReviewSummary(
      { wallPaintSqft: 4918.2, ceilingPaintSqft: 3660, baseboardLf: 482.2 },
      {
        wallPaintSqft: { source: 'measured_from_geometry', coverage: 'incomplete' },
        ceilingPaintSqft: { source: 'measured_from_geometry' },
        baseboardLf: { source: 'measured_from_geometry', coverage: 'incomplete' },
      }
    );
    expect(summary).toEqual(
      expect.arrayContaining([
        {
          label: 'Walls',
          value: '4,918.2 sqft',
          note: 'Partial room geometry — confirm',
        },
        {
          label: 'Ceilings',
          value: '3,660 sqft',
          note: 'Calculated from plan geometry',
        },
        {
          label: 'Baseboard / trim',
          value: '482.2 LF',
          note: 'Partial room geometry — confirm',
        },
      ])
    );
  });

  it('builds grouped Electrical plan review summary from canonical counts', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    expect(measurementDisplayLabel('standardReceptacleCount').label).toBe(
      'Standard receptacles'
    );
    const summary = buildElectricalPlanReviewSummary({
      mainPanelCount: 1,
      serviceAmperage: 200,
      standardReceptacleCount: 42,
      gfciReceptacleCount: 8,
      recessedLightCount: 24,
      rangeHookupCount: 1,
    });
    expect(summary).toEqual(
      expect.arrayContaining([
        { label: 'Main panel', value: '1 EA · 200A' },
        { label: 'Standard receptacles', value: '42 EA' },
        { label: 'GFCI receptacles', value: '8 EA' },
        { label: 'Recessed / canless / wafer light', value: '24 EA' },
        { label: 'Range hookup', value: '1 EA' },
        {
          label: 'Rough / trim packages',
          value: 'Not auto-priced from detailed takeoff',
        },
      ])
    );
  });

  it('shows Electrical provenance notes on the review summary', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const summary = buildElectricalPlanReviewSummary(
      {
        mainPanelCount: 1,
        serviceAmperage: 200,
        recessedLightCount: 34,
        gfciReceptacleCount: 6,
        threeWaySwitchCount: 4,
      },
      {
        mainPanelCount: { note: 'From panel callout', source: 'detected_from_plan' },
        recessedLightCount: {
          note: 'Counted from electrical plan',
          source: 'detected_from_plan',
        },
        gfciReceptacleCount: {
          note: 'Counted from symbols',
          source: 'detected_from_plan',
        },
        threeWaySwitchCount: {
          note: 'Calculated from symbols, confirm',
          source: 'calculated_from_symbols',
          confidenceTier: 2,
        },
      }
    );
    expect(summary).toEqual(
      expect.arrayContaining([
        {
          label: 'Main panel',
          value: '1 EA · 200A',
          note: 'From panel callout',
        },
        {
          label: 'Recessed / canless / wafer light',
          value: '34 EA',
          note: 'Counted from electrical plan',
        },
        {
          label: 'GFCI receptacles',
          value: '6 EA',
          note: 'Counted from symbols',
        },
        {
          label: '3-way switch',
          value: '4 EA',
          note: 'Calculated from symbols, confirm',
        },
        {
          label: 'Shared homeruns / unlabeled circuits',
          value: 'Needs confirmation',
          note: 'Device symbols do not invent circuit relationships',
        },
      ])
    );
    expect(measurementSourceLabel({ key: 'recessedLightCount' })).toMatch(
      /electrical plan/i
    );
  });
});
