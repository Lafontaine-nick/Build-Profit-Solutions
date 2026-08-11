import {
  applyPlanImportToDraft,
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
    expect(pricing.fill?.total).toBe(24129.6);
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
    expect(oneCoatPricing.fill?.total).toBe(18097.2);
  });

  it('prices repair/re-stucco from affected area and severity', () => {
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
    const repairSystemQuantity = resolveChecklistItemQuantity(
      'stucco',
      normalized,
      { templateKey: 'stucco', choiceId: 'repair_restucco' }
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
    expect(repairSystemQuantity.quantity).toBe(100);
    expect(pricing.fill?.total).toBe(1200);
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

    expect(additional.fill?.total).toBe(1600);
    expect(additional.fill?.material).toBe(650);
    expect(additional.fill?.labor).toBe(950);

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
