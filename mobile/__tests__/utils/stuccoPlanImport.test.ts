import {
  applyPlanImportToDraft,
  buildStuccoTradeChecklistItems,
  planMeasurementsToScopeMeasurements,
} from '@/utils/estimateAiDraft';
import { getMeasurementRelevance } from '@/utils/getMeasurementRelevance';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsInputFromPayload,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import {
  emptyQuickMeasurementInput,
  quickMeasurementFieldMeta,
  quickMeasurementRowsForInput,
} from '@/utils/scopeQuickMeasurements';
import { resolveQuickMeasurementFields } from '@/utils/quickMeasurementProvenance';
import { hydrateScopeChecklistFromNotes } from '@/utils/estimateScopeChecklistUi';

describe('Stucco plan import', () => {
  it('calculates net stucco wall area and preserves the pricing alias', () => {
    const measurements = planMeasurementsToScopeMeasurements({
      stuccoGrossWallSqft: 4920,
      stuccoWindowDoorOpeningSqft: 620,
      stuccoGarageOpeningSqft: 410,
      stuccoOtherFinishDeductionSqft: 380,
    });

    expect(measurements.stuccoNetWallSqft).toBe(3510);
    expect(measurements.exteriorPaintSqft).toBe(3510);
  });

  it('keeps separate stucco add-on quantities out of base net wall area', () => {
    const measurements = planMeasurementsToScopeMeasurements({
      stuccoGrossWallSqft: 3450,
      stuccoWindowDoorOpeningSqft: 289.6,
      stuccoGarageOpeningSqft: 225,
      stuccoOtherFinishDeductionSqft: 150,
      stuccoSoffitSqft: 200,
      stuccoParapetSqft: 200,
      stuccoFoamTrimLf: 150,
      stuccoControlJointLf: 100,
    });

    expect(measurements.stuccoNetWallSqft).toBe(2785.4);
    expect(measurements.exteriorPaintSqft).toBe(2785.4);
  });

  it('uses explicit stucco wall-height terminology and units', () => {
    expect(quickMeasurementFieldMeta('stuccoWallHeightFt')).toEqual({
      label: 'Typical wall height / story',
      unit: 'ft',
    });
    expect(quickMeasurementFieldMeta('stuccoStories')).toEqual({
      label: 'Stories',
      unit: 'story',
    });
    expect(quickMeasurementFieldMeta('stuccoFoamTrimLf').unit).toBe('LF');
    expect(quickMeasurementFieldMeta('stuccoControlJointLf').unit).toBe('LF');
  });

  it('auto-includes measured add-ons without guessing unrelated scope choices', () => {
    const items = [
      { id: 'stucco_soffits', label: 'Soffits', state: 'unsure' },
      { id: 'stucco_parapets', label: 'Parapets', state: 'unsure' },
      {
        id: 'stucco_foam_trim',
        label: 'Foam trim',
        inputType: 'choice',
        choiceId: 'unsure',
        state: 'unsure',
      },
      { id: 'stucco_access', label: 'Access', state: 'unsure' },
      { id: 'stucco_repairs', label: 'Repairs', state: 'unsure' },
      {
        id: 'stucco',
        label: 'Stucco system',
        inputType: 'choice',
        choiceId: 'unsure',
        state: 'unsure',
      },
    ] as any;

    const hydrated = hydrateScopeChecklistFromNotes(items, 'ground_up', '', {
      stuccoSoffitSqft: 200,
      stuccoParapetSqft: 200,
      stuccoFoamTrimLf: 150,
      stuccoAccessAffectedSqft: 0,
      stuccoRepairAffectedSqft: 0,
    } as any);
    const byId = Object.fromEntries(hydrated.map(item => [item.id, item]));

    expect(byId.stucco_soffits.state).toBe('included');
    expect(byId.stucco_parapets.state).toBe('included');
    expect(byId.stucco_foam_trim.state).toBe('included');
    expect(byId.stucco_foam_trim.choiceId).toBe('unsure');
    expect(byId.stucco_access.state).toBe('unsure');
    expect(byId.stucco_repairs.state).toBe('unsure');
    expect(byId.stucco.state).toBe('unsure');
  });

  it('creates the Stucco package inside the existing Confirm Scope checklist', () => {
    const draft = {
      scopeChecklist: {
        estimateTier: 'standard',
        templateKey: 'ground_up',
        title: 'Ground-up',
        intro: '',
        items: [
          { id: 'stucco', label: 'Stucco', state: 'unsure' },
          { id: 'framing', label: 'Framing', state: 'unsure' },
        ],
      },
    } as any;

    const next = applyPlanImportToDraft(draft, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'stucco',
      measurements: { stuccoNetWallSqft: 3510 },
      scopeDetections: [],
    });

    expect(next.scopeChecklist.items.map((item: any) => item.id)).toEqual([
      'stucco',
      'stucco_wrb',
      'stucco_lath',
      'stucco_base_coat',
      'stucco_finish_coat',
      'stucco_foam_trim',
      'stucco_accessories',
      'stucco_soffits',
      'stucco_parapets',
      'stucco_access',
      'stucco_repairs',
      'stucco_other_finish',
    ]);
    expect(next.scopeChecklist.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'framing' })])
    );
    expect(next.scopeChecklist.templateKey).toBe('stucco');
  });

  it('carries plan conflict metadata into Confirm Scope state', () => {
    const draft = {
      scopeChecklist: {
        estimateTier: 'standard',
        templateKey: 'ground_up',
        title: 'Ground-up',
        intro: '',
        items: [{ id: 'stucco', label: 'Stucco', state: 'unsure' }],
      },
    } as any;
    const conflict = {
      field: 'stuccoGrossWallSqft',
      selectedValue: 3600,
      selectedSource: 'focused_trade_takeoff',
      threshold: 180,
      requiresConfirmation: true,
      candidates: [
        {
          value: 3600,
          source: 'focused_trade_takeoff',
          confidence: 0.9,
          directEvidence: true,
        },
        {
          value: 3300,
          source: 'general_plan_takeoff',
          confidence: 0.8,
          directEvidence: false,
        },
      ],
    };
    const next = applyPlanImportToDraft(draft, {
      measurements: { stuccoGrossWallSqft: 3600 },
      measurementProvenance: {
        stuccoGrossWallSqft: {
          value: 3600,
          source: 'focused_trade_takeoff',
          alternatives: [{ value: 3300, source: 'general_plan_takeoff' }],
        },
      },
      measurementConflicts: [conflict],
      scopeDetections: [],
    });

    expect(next.scopeMeasurements?.measurementConflicts).toEqual([conflict]);
    expect(
      next.scopeMeasurements?.measurementProvenance?.stuccoGrossWallSqft
    ).toMatchObject({ value: 3600 });
  });

  it('renders a material plan conflict as needs confirmation', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      stuccoGrossWallSqft: '3600',
      quickMeasurementSources: {
        stuccoGrossWallSqft: 'detected_from_plan',
      },
      measurementConflicts: [
        {
          field: 'stuccoGrossWallSqft',
          selectedValue: 3600,
          selectedSource: 'focused_trade_takeoff',
          threshold: 180,
          requiresConfirmation: true,
          candidates: [
            {
              value: 3600,
              source: 'focused_trade_takeoff',
              confidence: 0.9,
              directEvidence: false,
            },
            {
              value: 3300,
              source: 'general_plan_takeoff',
              confidence: 0.8,
              directEvidence: false,
            },
          ],
        },
      ],
    } as any;
    const rows = quickMeasurementRowsForInput('stucco', 'stucco', input, []);
    const results = resolveQuickMeasurementFields({
      rows,
      measurements: input,
      sourceMap: input.quickMeasurementSources,
      includedScopeKeys: ['stucco'],
      templateKey: 'stucco',
      measurementConflicts: input.measurementConflicts,
    });
    const gross = results.find(result => result.key === 'stuccoGrossWallSqft');

    expect(gross?.state).toBe('needs_confirmation');
    expect(gross?.sourceLabel).toBe(
      'Conflicting plan takeoffs — confirm measurement'
    );
  });

  it('treats optional architectural details as neutral until their scope is included', () => {
    const context = {
      templateKey: 'stucco',
      includedScopeKeys: ['stucco'],
    };
    expect(
      getMeasurementRelevance({
        measurementKey: 'stuccoNetWallSqft',
        ...context,
      }).relevant
    ).toBe(true);
    expect(
      getMeasurementRelevance({
        measurementKey: 'stuccoParapetSqft',
        ...context,
      }).relevant
    ).toBe(false);
    expect(
      getMeasurementRelevance({
        measurementKey: 'stuccoFoamTrimLf',
        ...context,
      }).relevant
    ).toBe(false);
  });

  it('round-trips plan measurements through Confirm Scope persistence', () => {
    const saved = scopeMeasurementsPayloadForPersist({
      stuccoGrossWallSqft: '3,870',
      stuccoWindowDoorOpeningSqft: '383.8',
      stuccoNetWallSqft: '3,486.2',
      stuccoStories: '2',
      stuccoWallHeightFt: '10.2',
      planImportMode: 'selected_trade',
      planImportTradeKey: 'stucco',
      quickMeasurementSources: {
        stuccoGrossWallSqft: 'plan_detected',
        stuccoNetWallSqft: 'plan_detected',
      },
    });
    const restored = scopeMeasurementsInputFromPayload(saved);

    expect(restored.stuccoGrossWallSqft).toBe('3870');
    expect(restored.stuccoWindowDoorOpeningSqft).toBe('383.8');
    expect(restored.stuccoNetWallSqft).toBe('3486.2');
    expect(restored.stuccoStories).toBe('2');
    expect(restored.stuccoWallHeightFt).toBe('10.2');
    expect(restored.planImportMode).toBe('selected_trade');
    expect(restored.planImportTradeKey).toBe('stucco');
    expect(restored.quickMeasurementSources?.stuccoGrossWallSqft).toBe(
      'plan_detected'
    );
  });

  it('prefills the Stucco system card from net wall area', () => {
    const saved = scopeMeasurementsPayloadForPersist({
      stuccoNetWallSqft: '3016.2',
    });
    const restored = scopeMeasurementsInputFromPayload(saved);
    const resolved = resolveChecklistItemQuantity(
      'stucco',
      normalizeScopeMeasurements(saved),
      { templateKey: 'stucco', choiceId: 'three_coat' }
    );

    expect(restored.stuccoNetWallSqft).toBe('3016.2');
    expect(resolved.quantity).toBe(3016.2);
    expect(resolved.unit).toBe('sqft');
    expect(resolved.pricingReady).toBe(true);
    const pricing = resolveScopeItemSuggestedPricing(
      'stucco',
      restored as any,
      'stucco',
      resolved,
      {
        checklistItems: [
          { id: 'stucco', state: 'included', choiceId: 'three_coat' },
        ],
      },
      'three_coat'
    );
    expect(pricing.fill?.total).toBe(27145.8);
    const oneCoatPricing = resolveScopeItemSuggestedPricing(
      'stucco',
      restored as any,
      'stucco',
      resolved,
      {
        checklistItems: [
          { id: 'stucco', state: 'included', choiceId: 'one_coat' },
        ],
      },
      'one_coat'
    );
    expect(oneCoatPricing.fill?.total).toBe(21113.4);
  });

  it('prices separate repair/re-stucco add-ons from affected area and severity', () => {
    const input = scopeMeasurementsInputFromPayload(
      scopeMeasurementsPayloadForPersist({
        stuccoNetWallSqft: '3016.2',
        stuccoRepairAffectedSqft: '100',
      })
    );
    const normalized = normalizeScopeMeasurements(input as any);
    const resolved = resolveChecklistItemQuantity(
      'stucco_repairs',
      normalized,
      { templateKey: 'stucco', choiceId: 'moderate_repair' }
    );
    const pricing = resolveScopeItemSuggestedPricing(
      'stucco_repairs',
      input as any,
      'stucco',
      resolved,
      { checklistItems: [] },
      'moderate_repair'
    );

    expect(resolved.quantity).toBe(100);
    expect(pricing.fill?.total).toBe(1200);
    expect(pricing.fill?.material).toBe(350);
    expect(pricing.fill?.labor).toBe(850);
  });

  it('preserves manually added custom scope items', () => {
    const items = buildStuccoTradeChecklistItems([
      {
        id: 'custom_123',
        label: 'Exterior trim',
        inputType: 'yes_no',
        state: 'included',
        category: 'custom',
      },
    ]);
    expect(items.some(item => item.id === 'custom_123')).toBe(true);
  });

  it('keeps repair as a separate add-on card with an affected-area quantity', () => {
    const items = buildStuccoTradeChecklistItems([]);
    const system = items.find(item => item.id === 'stucco');
    const repair = items.find(item => item.id === 'stucco_repairs');

    expect(system?.options?.map(option => option.id)).toEqual([
      'three_coat',
      'one_coat',
      'eifs',
      'finish_only',
    ]);
    expect(repair?.label).toBe('Stucco repair / re-stucco');
    expect(repair?.options?.map(option => option.id)).toEqual([
      'no_repair',
      'light_repair',
      'moderate_repair',
      'full_depth_repair',
      'severe_damage',
    ]);
    const normalized = normalizeScopeMeasurements({
      stuccoRepairAffectedSqft: 85,
    } as any);
    expect(
      resolveChecklistItemQuantity('stucco_repairs', normalized, {
        templateKey: 'stucco',
        choiceId: 'moderate_repair',
      }).quantity
    ).toBe(85);
  });

  it('applies repair minimum charges without changing the repair quantity', () => {
    const input = scopeMeasurementsInputFromPayload(
      scopeMeasurementsPayloadForPersist({
        stuccoRepairAffectedSqft: '50',
      })
    );
    const normalized = normalizeScopeMeasurements(input as any);
    const resolved = resolveChecklistItemQuantity(
      'stucco_repairs',
      normalized,
      { templateKey: 'stucco', choiceId: 'light_repair' }
    );
    const pricing = resolveScopeItemSuggestedPricing(
      'stucco_repairs',
      input as any,
      'stucco',
      resolved,
      { checklistItems: [] },
      'light_repair'
    );

    expect(resolved.quantity).toBe(50);
    expect(pricing.fill?.total).toBe(400);
    expect(pricing.fill?.material).toBe(100);
    expect(pricing.fill?.labor).toBe(300);
    expect(pricing.fill?.basis).toEqual({ quantity: 50, unit: 'sqft' });
  });

  it('prices two-story access at the affected wall area only', () => {
    const input = scopeMeasurementsInputFromPayload(
      scopeMeasurementsPayloadForPersist({
        stuccoAccessAffectedSqft: '100',
      })
    );
    const normalized = normalizeScopeMeasurements(input as any);
    const resolved = resolveChecklistItemQuantity(
      'stucco_access',
      normalized,
      { templateKey: 'stucco', choiceId: 'two_story' }
    );
    const pricing = resolveScopeItemSuggestedPricing(
      'stucco_access',
      input as any,
      'stucco',
      resolved,
      { checklistItems: [] },
      'two_story'
    );

    expect(resolved.quantity).toBe(100);
    expect(pricing.fill?.total).toBe(150);
  });

  it('prices parapets separately at the selected full-system rate', () => {
    const input = scopeMeasurementsInputFromPayload(
      scopeMeasurementsPayloadForPersist({
        stuccoParapetSqft: '200',
      })
    );
    const normalized = normalizeScopeMeasurements(input as any);
    const context = {
      checklistItems: [
        { id: 'stucco', state: 'included', choiceId: 'three_coat' },
        { id: 'stucco_parapets', state: 'included' },
      ],
    };
    const resolved = resolveChecklistItemQuantity(
      'stucco_parapets',
      normalized,
      { templateKey: 'stucco', choiceId: 'additional_surface' }
    );
    const additional = resolveScopeItemSuggestedPricing(
      'stucco_parapets',
      input as any,
      'stucco',
      resolved,
      context,
      undefined
    );

    expect(additional.fill?.total).toBe(1800);
    expect(additional.fill?.material).toBe(750);
    expect(additional.fill?.labor).toBe(1050);

    const excluded = resolveScopeItemSuggestedPricing(
      'stucco_parapets',
      input as any,
      'stucco',
      resolved,
      {
        checklistItems: [
          { id: 'stucco', state: 'included', choiceId: 'three_coat' },
          { id: 'stucco_parapets', state: 'excluded' },
        ],
      },
      undefined
    );
    expect(excluded.fill).toBeNull();
  });
});
