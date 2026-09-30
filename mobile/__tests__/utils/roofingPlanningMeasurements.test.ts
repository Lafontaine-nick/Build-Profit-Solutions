import {
  applyRoofingPlanningMeasurements,
  estimatedIceWaterShieldSqft,
  estimatedRoofPerimeterLf,
  reconcileRoofingQuickMeasurements,
  reconcileRoofSquaresFromRoofAreaSqft,
  roofSquaresLooksLikeSqftBleed,
} from '@/utils/roofingPlanningMeasurements';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { applyScopeInferencesFromNotes, hydrateScopeChecklistFromNotes } from '@/utils/estimateScopeChecklistUi';
import {
  initialScopeMeasurementInputExtended,
  resolveChecklistItemQuantity,
  buildNormalizedScopeMeasurementsFromInput,
  prepareScopeMeasurementsInputForUi,
} from '@/utils/scopeItemQuantities';
import { mergeConfirmScopeSavedMeasurements } from '@/utils/benchmarkReasonablenessContext';
import { SCOPE_PLANNING_ESTIMATE_LABEL } from '@/constants/scopeNoteSourceLabels';
import {
  ensureGroundUpRoofingPlanChecklistItems,
  finalizeRoofingScopeSelections,
} from '@/utils/qmScopePanels/simpleTradeRemodel';

const REPAIR_50_SQFT_NOTES =
  'I need to build a roofing repair bid, about 50 sqft area, asphalt shingles tear off and replace';

describe('roofingPlanningMeasurements', () => {
  const RE_ROOF_NOTES =
    '22-square architectural shingle re-roof with tear-off. Ice & water at eaves, drip edge included.';

  test('estimates drip edge LF from roof squares when notes mention drip edge', () => {
    const planned = applyRoofingPlanningMeasurements(
      { roofSquares: 22 },
      RE_ROOF_NOTES
    );
    expect(planned.roofDripEdgeLf).toBe(estimatedRoofPerimeterLf(22));
    expect(planned.roofIceWaterShieldSqft).toBe(estimatedIceWaterShieldSqft(22));
    expect(planned.roofingPlanningKeys).toEqual(
      expect.arrayContaining(['roofDripEdgeLf', 'roofIceWaterShieldSqft'])
    );
  });

  test('defaults pipe boot count when notes mention pipe boots without a number', () => {
    const planned = applyRoofingPlanningMeasurements({}, 'Include pipe boots.');
    expect(planned.roofPipeBootCount).toBe(1);
    expect(planned.roofingPlanningKeys).toContain('roofPipeBootCount');
  });

  test('does not override explicit drip edge LF from notes', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      '30 squares roof. Drip edge 180 LF, ice & water 90 sqft.',
      { templateKey: 'roofing' }
    );
    expect(parsed.roofDripEdgeLf).toBe(180);
    expect(parsed.roofIceWaterShieldSqft).toBe(90);
    expect(parsed.roofingPlanningKeys).toBeUndefined();
  });

  test('parser applies planning measurements for roofing notes', () => {
    const parsed = parseScopeMeasurementsFromNotes(RE_ROOF_NOTES, {
      templateKey: 'roofing',
    });
    expect(parsed.roofSquares).toBe(22);
    expect(parsed.roofDripEdgeLf).toBeGreaterThan(0);
    expect(parsed.roofIceWaterShieldSqft).toBeGreaterThan(0);
  });

  test('initialScopeMeasurementInputExtended hydrates roofing LF fields', () => {
    const input = initialScopeMeasurementInputExtended(
      {
        scopeChecklist: { templateKey: 'roofing' },
        projectType: 'roofing',
      },
      RE_ROOF_NOTES
    );
    expect(Number(input.roofDripEdgeLf)).toBeGreaterThan(0);
    expect(Number(input.roofIceWaterShieldSqft)).toBeGreaterThan(0);
    expect(input.quickMeasurementSources?.roofDripEdgeLf).toBe(
      'estimated_from_formula'
    );
  });

  test('applyScopeInferencesFromNotes includes roofing cleanup on tear-off jobs', () => {
    const items = [
      {
        id: 'cleanup',
        inputType: 'yes_no' as const,
        label: 'Cleanup',
        state: 'unsure' as const,
      },
    ];
    const next = applyScopeInferencesFromNotes(
      items,
      '22-square re-roof with full tear-off.',
      'roofing'
    );
    expect(next[0]).toMatchObject({ state: 'included', noteBacked: true });
  });

  test('hydrates typical re-roof notes with pipe boots, haul-off, and decking allowance', () => {
    const notes =
      'Tear off and reroof, 22 squares architectural shingles. New underlayment, drip edge, pipe boots, haul off old shingles. Decking looks ok but put $1,000 allowance if we find bad wood.';
    const input = initialScopeMeasurementInputExtended(
      {
        scopeChecklist: { templateKey: 'roofing' },
        projectType: 'roofing',
      },
      notes
    );
    expect(input.tradeScopeSelections?.roofing).toEqual(
      expect.arrayContaining([
        'tear_off',
        'shingles',
        'drip_edge',
        'pipe_boots',
        'cleanup',
        'decking_repair',
      ])
    );
    expect(input.itemQuantities?.decking_repair__allowance).toMatchObject({
      quantity: '1000',
      unit: 'allowance',
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const deckingQty = resolveChecklistItemQuantity('decking_repair', measurements, {
      templateKey: 'roofing',
      notes,
    });
    expect(deckingQty).toMatchObject({
      unit: 'allowance',
      quantity: 1000,
      quantitySource: 'notes',
    });
  });

  test('does not surface electrical disposal hookup on roofing jobs', () => {
    const notes =
      'I need to build a roofing repair bid, about 50 sqft area, asphalt shingles tear off and replace';
    const input = initialScopeMeasurementInputExtended(
      {
        scopeChecklist: { templateKey: 'roofing' },
        projectType: 'roofing',
        scopeMeasurements: {
          disposalHookupCount: 1,
          itemQuantities: {
            electrical_disposal_hookup: {
              quantity: '1',
              unit: 'each',
              quantitySource: 'notes',
            },
          },
        },
      },
      notes
    );
    expect(input.disposalHookupCount).toBeFalsy();
    expect(input.itemQuantities?.electrical_disposal_hookup).toBeUndefined();
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const items = hydrateScopeChecklistFromNotes(
      [],
      'roofing',
      notes,
      measurements,
      'roofing'
    );
    expect(items.some(item => item.id === 'electrical_disposal_hookup')).toBe(
      false
    );
  });

  test('labels formula-filled drip edge qty as planning estimate', () => {
    const input = initialScopeMeasurementInputExtended({
      originalNotes: RE_ROOF_NOTES,
      scopeChecklist: { templateKey: 'roofing', items: [] },
    } as import('@/utils/estimateAiDraft').EstimateAiDraft);
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('drip_edge', measurements, {
      templateKey: 'roofing',
      notes: RE_ROOF_NOTES,
    });
    expect(resolved.sourceLabel).toBe(SCOPE_PLANNING_ESTIMATE_LABEL);
    expect(resolved.quantity).toBe(estimatedRoofPerimeterLf(22));
  });

  test('detects sqft bleed into roofSquares', () => {
    expect(roofSquaresLooksLikeSqftBleed(50, 50)).toBe(true);
    expect(roofSquaresLooksLikeSqftBleed(0.5, 50)).toBe(false);
    expect(roofSquaresLooksLikeSqftBleed(22, 2200)).toBe(false);
  });

  test('reconciles 50 sqft repair notes to 0.5 squares', () => {
    const fixed = reconcileRoofSquaresFromRoofAreaSqft(
      { roofSquares: 50, roofAreaSqft: 50 },
      REPAIR_50_SQFT_NOTES
    );
    expect(fixed.changed).toBe(true);
    expect(fixed.roofSquares).toBe('0.5');
  });

  test('confirm scope hydrate fixes stale saved squares on 50 sqft repair', () => {
    const base = prepareScopeMeasurementsInputForUi(
      initialScopeMeasurementInputExtended(
        { scopeChecklist: { templateKey: 'roofing' }, projectType: 'roofing' },
        REPAIR_50_SQFT_NOTES
      ),
      { notes: REPAIR_50_SQFT_NOTES, templateKey: 'roofing' }
    );
    expect(Number(base.roofSquares)).toBe(0.5);

    const merged = mergeConfirmScopeSavedMeasurements(
      base,
      { roofSquares: 50, roofAreaSqft: 50 },
      REPAIR_50_SQFT_NOTES
    );
    expect(Number(merged.roofSquares)).toBe(0.5);
    expect(Number(merged.roofAreaSqft)).toBe(50);
  });

  test('restores note-parsed squares when saved draft cleared the fields', () => {
    const base = prepareScopeMeasurementsInputForUi(
      initialScopeMeasurementInputExtended(
        { scopeChecklist: { templateKey: 'roofing' }, projectType: 'roofing' },
        REPAIR_50_SQFT_NOTES
      ),
      { notes: REPAIR_50_SQFT_NOTES, templateKey: 'roofing' }
    );
    const merged = mergeConfirmScopeSavedMeasurements(
      base,
      {
        roofSquares: '',
        roofAreaSqft: '',
        tradeScopeSelections: { roofing: ['tear_off', 'shingles'] },
      } as never,
      REPAIR_50_SQFT_NOTES
    );
    expect(Number(merged.roofSquares)).toBe(0.5);
    expect(Number(merged.roofAreaSqft)).toBe(50);
  });

  test('fills missing roofSquares from sqft notes alone', () => {
    const filled = reconcileRoofingQuickMeasurements(
      { roofSquares: '', roofAreaSqft: '' },
      REPAIR_50_SQFT_NOTES
    );
    expect(Number(filled.roofSquares)).toBe(0.5);
    expect(Number(filled.roofAreaSqft)).toBe(50);
  });

  test('does not auto-select premium underlayment from roofAreaSqft alone', () => {
    const input = initialScopeMeasurementInputExtended(
      { scopeChecklist: { templateKey: 'roofing' }, projectType: 'roofing' },
      REPAIR_50_SQFT_NOTES
    );
    expect(input.tradeScopeSelections?.roofing || []).not.toContain('underlayment');
  });

  test('does not auto-select roof repairs when notes say tear off and replace', () => {
    const input = initialScopeMeasurementInputExtended(
      { scopeChecklist: { templateKey: 'roofing' }, projectType: 'roofing' },
      REPAIR_50_SQFT_NOTES
    );
    expect(input.tradeScopeSelections?.roofing || []).toEqual(
      expect.arrayContaining(['tear_off', 'shingles'])
    );
    expect(input.tradeScopeSelections?.roofing || []).not.toContain('roof_repairs');
    expect(input.roofRepairAffectedSqft).toBeFalsy();
  });

  test('still infers roof repairs for patch-only notes without tear-off install', () => {
    const notes = 'Roof repairs affect about 50 sqft near the chimney.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'roofing',
      projectType: 'roofing',
    });
    expect(parsed.roofRepairAffectedSqft).toBe(50);
    const input = initialScopeMeasurementInputExtended(
      { scopeChecklist: { templateKey: 'roofing' }, projectType: 'roofing' },
      notes
    );
    expect(input.tradeScopeSelections?.roofing || []).toContain('roof_repairs');
  });

  test('selects the standard new-roof chips for a ground-up plan export', () => {
    const selected = finalizeRoofingScopeSelections(
      {
        measurements: {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'roofing',
          planImportFingerprint: 'shv-lot-49',
          roofPitch: '2:12',
          storyCount: 2,
        },
        notes: 'SHV Lot 49 Architectural Plans',
        checklistItems: [],
      },
      [],
      [],
      []
    );
    expect(selected).toEqual([
      'shingles',
      'drip_edge',
      'ridge_cap',
      'ridge_vent',
      'pipe_boots',
      'gutters',
      'downspouts',
    ]);
  });

  test('drops inferred tear-off on a new-construction roofing plan', () => {
    const selected = finalizeRoofingScopeSelections(
      {
        measurements: {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'roofing',
          planImportFingerprint: 'shv-lot-49',
          tradeScopeSelections: { roofing: ['tear_off'] },
        },
        notes: 'Remove temporary bracing. Roof plan.',
        checklistItems: [],
      },
      ['tear_off'],
      ['tear_off', 'shingles'],
      []
    );
    expect(selected).toEqual([
      'shingles',
      'drip_edge',
      'ridge_cap',
      'ridge_vent',
      'pipe_boots',
      'gutters',
      'downspouts',
    ]);
  });

  test('replaces the wide auto-selection with the necessary new-roof chips', () => {
    const selected = finalizeRoofingScopeSelections(
      {
        measurements: {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'roofing',
          planImportFingerprint: 'shv-lot-49',
          tradeScopeSelections: {
            roofing: [
              'shingles',
              'ice_water_shield',
              'valley_flashing',
              'chimney_flashing',
            ],
          },
        },
        notes: '',
        checklistItems: [],
      },
      ['shingles', 'ice_water_shield', 'valley_flashing', 'chimney_flashing'],
      [],
      []
    );
    expect(selected).toEqual([
      'shingles',
      'drip_edge',
      'ridge_cap',
      'ridge_vent',
      'pipe_boots',
      'gutters',
      'downspouts',
    ]);
  });

  test('builds new-roof pricing cards even when the checklist omitted them', () => {
    const cards = ensureGroundUpRoofingPlanChecklistItems([
      { id: 'roofing_system', state: 'included', label: 'Roofing system' },
      { id: 'tear_off', state: 'included', label: 'Tear-off' },
    ]);
    expect(cards.map(card => card.id)).toEqual([
      'shingles_roofing',
      'ridge_vent',
      'pipe_boots',
      'gutters',
      'downspouts',
    ]);
    expect(cards.find(card => card.id === 'shingles_roofing')?.helperText).toMatch(
      /drip edge, and ridge cap/i
    );
    expect(cards.every(card => card.state === 'included')).toBe(true);
  });

  test('keeps a contractor roofing selection instead of restoring ground-up defaults', () => {
    const selected = finalizeRoofingScopeSelections(
      {
        measurements: {
          planImportMode: 'selected_trade',
          planImportTradeKey: 'roofing',
          planImportFingerprint: 'shv-lot-49',
          tradeScopeSelections: { roofing: ['shingles'] },
        },
        notes: '',
        checklistItems: [],
      },
      ['shingles'],
      [],
      []
    );
    expect(selected).toEqual(['shingles']);
  });

  test('reconcileRoofingQuickMeasurements leaves explicit square jobs alone', () => {
    const untouched = reconcileRoofingQuickMeasurements(
      { roofSquares: '22', roofAreaSqft: '2200' },
      RE_ROOF_NOTES
    );
    expect(untouched.roofSquares).toBe('22');
  });
});
