import {
  buildPlumbingStructuredMeasurements,
  hasDetailedPlumbingQuantities,
  normalizePlumbingPlanMeasurements,
  parsePlumbingMeasurementsFromNotes,
  PLUMBING_CARDS,
  PLUMBING_REVIEW_MEASUREMENT_KEYS,
  syncPlumbingScopeItems,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import { getSubcontractorTradeDefinition } from '@/utils/subcontractorTrade/tradeDefinitions';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { applyPlanImportToDraft } from '@/utils/estimateAiDraft';
import {
  filterChecklistItemsForTrade,
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
} from '@/utils/planImportTradeConfig';

describe('plumbing canonical architecture', () => {
  it('defines one canonical owner for every Plumbing quantity', () => {
    const keys = PLUMBING_CARDS.map(card => card.measurementKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(getSubcontractorTradeDefinition('plumbing')).toMatchObject({
      status: 'complete',
      standaloneTemplateKey: 'plumbing_service',
      reviewMeasurementKeys: PLUMBING_REVIEW_MEASUREMENT_KEYS,
    });
  });

  it('keeps service and allowance cards out of selected-trade Plan Export', () => {
    expect(
      Object.keys(
        filterPlanMeasurementsForTrade(
          {
            plumbingRoughPointCount: 4,
            fixtureReplacementCount: 3,
            serviceCallCount: 1,
            fixtureRepairCount: 2,
            partsMaterialsCount: 1,
            gasLineLf: 100,
          },
          'selected_trade',
          'plumbing'
        )
      )
    ).toEqual(['plumbingRoughPointCount', 'gasLineLf']);

    expect(
      filterChecklistItemsForTrade(
        [
          { id: 'plumbing_rough' },
          { id: 'fixture_replace' },
          { id: 'service_call' },
          { id: 'fixture_repair' },
          { id: 'parts_materials' },
          { id: 'gas_line' },
        ],
        'selected_trade',
        'plumbing'
      ).map(item => item.id)
    ).toEqual(['plumbing_rough', 'gas_line']);

    expect(
      filterPlanScopesForTrade(
        [
          { itemId: 'plumbing_rough' },
          { itemId: 'water_line' },
          { itemId: 'drain_cleaning' },
          { itemId: 'emergency_fee' },
          { itemId: 'gas_line' },
        ],
        'selected_trade',
        'plumbing'
      ).map(item => item.itemId)
    ).toEqual(['plumbing_rough', 'water_line', 'gas_line']);
  });

  it('routes standalone Plumbing notes into a Plumbing-only checklist', () => {
    const draft = {
      scopeChecklist: {
        templateKey: 'bathroom',
        title: 'Bathroom Remodel',
        intro: 'Confirm bathroom scope.',
        items: [
          { id: 'demo', label: 'Demo', state: 'unsure' },
          { id: 'tile', label: 'Tile', state: 'unsure' },
        ],
      },
      scopeMeasurements: {
        bathroomFloorSqft: 80,
        itemQuantities: {},
      },
      rooms: [],
    } as any;

    const next = applyPlanImportToDraft(draft, {
      tradeWorkflowSource: 'standalone_trade',
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      plumbingWorkflowMode: 'service',
      plumbingPerformerMode: 'subcontracted',
    });

    expect(next.scopeChecklist?.templateKey).toBe('plumbing_service');
    expect(next.scopeChecklist?.items.map(item => item.id)).toEqual([
      'service_call',
      'fixture_repair',
      'fixture_replace',
      'drain_cleaning',
    ]);
    expect(next.scopeMeasurements?.tradeWorkflowSource).toBe(
      'standalone_trade'
    );
    expect(next.scopeMeasurements?.plumbingWorkflowMode).toBe('service');
    expect(next.scopeMeasurements?.plumbingPerformerMode).toBe('subcontracted');
    expect(next.scopeMeasurements?.bathroomFloorSqft).toBeUndefined();
  });

  it('normalizes Plan aliases without using living area', () => {
    expect(
      normalizePlumbingPlanMeasurements({
        roughInPoints: 3,
        waterLineFeet: 42,
        livingSf: 2400,
      })
    ).toEqual({
      plumbingRoughPointCount: 3,
      waterLineLf: 42,
    });
  });

  it('parses explicit Notes quantities and ignores vague plumbing text', () => {
    expect(
      parsePlumbingMeasurementsFromNotes(
        '2 plumbing rough-in points, 40 LF of water line, and 1 drain cleaning.'
      )
    ).toMatchObject({
      plumbingRoughPointCount: 2,
      waterLineLf: 40,
      drainCleaningCount: 1,
    });
    expect(
      parsePlumbingMeasurementsFromNotes('Plumbing work as needed.')
    ).toEqual({});
  });

  it('converges Plan and Notes onto the same canonical keys with different provenance', () => {
    const plan = normalizeTradeMeasurements(
      'plumbing',
      { roughInPoints: 2, waterLineFeet: 40 },
      'plan'
    );
    const notes = normalizeTradeMeasurements(
      'plumbing',
      {
        roughInPoints: 2,
        waterLineFeet: 40,
        notes: '2 plumbing rough-in points, 40 LF of water line.',
      },
      'notes'
    );
    expect(plan.measurements).toMatchObject({
      plumbingRoughPointCount: 2,
      waterLineLf: 40,
    });
    expect(notes.measurements).toMatchObject(plan.measurements);
    expect(plan.quickMeasurementSources).toEqual({
      plumbingRoughPointCount: 'plan_detected',
      waterLineLf: 'plan_detected',
    });
    expect(notes.quickMeasurementSources).toEqual({
      plumbingRoughPointCount: 'user_entered',
      waterLineLf: 'user_entered',
    });
  });

  it('materializes canonical item quantities and recognizes detailed scope', () => {
    const structured = buildPlumbingStructuredMeasurements(
      { plumbingRoughPointCount: 2, plumbingTrimHookupCount: 3 },
      'plan_detected'
    );
    expect(structured.itemQuantities).toMatchObject({
      plumbing_rough: {
        quantity: 2,
        unit: 'each',
        quantitySource: 'plan_detected',
      },
      plumbing_trim: {
        quantity: 3,
        unit: 'each',
        quantitySource: 'plan_detected',
      },
    });
    expect(hasDetailedPlumbingQuantities(structured)).toBe(true);
  });

  it('materializes selected Plumbing quantities as visible Confirm Scope cards', () => {
    const selected = syncPlumbingScopeItems([], {
      quantities: { plumbingRoughPointCount: 2, waterLineLf: 40 },
    });
    expect(selected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'plumbing_rough',
          state: 'included',
        }),
        expect.objectContaining({
          id: 'water_line',
          state: 'included',
        }),
      ])
    );
  });

  it('returns cleared Plumbing cards to review without removing them', () => {
    const selected = syncPlumbingScopeItems(
      [{ id: 'water_line', state: 'included' }],
      {
        plumbingScope: ['water_line'],
        quantities: { waterLineLf: 40 },
      }
    );
    const cleared = syncPlumbingScopeItems(selected, {
      plumbingScope: ['water_line'],
      quantities: { waterLineLf: '' },
    });
    expect(cleared).toEqual([
      expect.objectContaining({ id: 'water_line', state: 'unsure' }),
    ]);
  });

  it('provides pricing for every measurable Plumbing quantity card', () => {
    for (const card of PLUMBING_CARDS) {
      const normalized = normalizeTradeMeasurements(
        'plumbing',
        { [card.measurementKey]: 1 },
        'plan'
      );
      const fields = {
        ...normalized.measurements,
        itemQuantities: normalized.structuredMeasurements?.itemQuantities,
      };
      const resolved = resolveChecklistItemQuantity(
        card.itemId,
        normalizeScopeMeasurements(fields as never),
        { templateKey: 'plumbing_service' }
      );
      const pricing = resolveScopeItemSuggestedPricing(
        card.itemId,
        fields as never,
        'plumbing_service',
        resolved
      );
      if (card.pricingBehavior === 'ALLOWANCE') {
        if (pricing.fill) expect(pricing.fill.total).toBeGreaterThan(0);
      } else {
        expect(resolved.pricingReady).toBe(true);
        expect(pricing.fill).not.toBeNull();
      }
    }
  });

  it('converts raw Plumbing Quick Measurement input into canonical quantities at persist time', () => {
    const persisted = scopeMeasurementsPayloadForPersist(
      {
        plumbingRoughPointCount: '2',
        waterLineLf: '40',
      },
      { templateKey: 'plumbing_service' }
    );
    expect(persisted.itemQuantities).toMatchObject({
      plumbing_rough: {
        quantity: 2,
        unit: 'each',
        quantitySource: 'user_entered',
      },
      water_line: {
        quantity: 40,
        unit: 'lf',
        quantitySource: 'user_entered',
      },
    });
    const normalized = normalizeScopeMeasurements(persisted);
    expect(
      resolveChecklistItemQuantity('water_line', normalized, {
        templateKey: 'plumbing_service',
      }).pricingReady
    ).toBe(true);
  });

  it('uses the same canonical rough-in pricing for Plan and Notes quantities', () => {
    const plan = normalizeTradeMeasurements(
      'plumbing',
      { plumbingRoughPointCount: 2 },
      'plan'
    );
    const notes = normalizeTradeMeasurements(
      'plumbing',
      { notes: '2 plumbing rough-in points.' },
      'notes'
    );
    const price = (itemId: string, normalized: typeof plan) => {
      const fields = {
        ...normalized.measurements,
        itemQuantities: normalized.structuredMeasurements?.itemQuantities,
      };
      const resolved = resolveChecklistItemQuantity(
        itemId,
        normalizeScopeMeasurements(fields as never),
        { templateKey: 'plumbing_service' }
      );
      return resolveScopeItemSuggestedPricing(
        itemId,
        fields as never,
        'plumbing_service',
        resolved
      ).fill?.total;
    };
    expect(price('plumbing_rough', plan)).toBe(1000);
    expect(price('plumbing_rough', notes)).toBe(1000);
    expect(
      price(
        'plumbing_trim',
        normalizeTradeMeasurements(
          'plumbing',
          { plumbingTrimHookupCount: 2 },
          'plan'
        )
      )
    ).toBe(900);
    expect(
      price(
        'fixture_replace',
        normalizeTradeMeasurements(
          'plumbing',
          { fixtureReplacementCount: 2 },
          'notes'
        )
      )
    ).toBe(600);
    expect(
      price(
        'water_line',
        normalizeTradeMeasurements('plumbing', { waterLineLf: 40 }, 'plan')
      )
    ).toBe(1200);
    expect(
      price(
        'service_call',
        normalizeTradeMeasurements('plumbing', { serviceCallCount: 1 }, 'notes')
      )
    ).toBe(250);
    expect(
      price(
        'fixture_repair',
        normalizeTradeMeasurements(
          'plumbing',
          { fixtureRepairCount: 1 },
          'notes'
        )
      )
    ).toBe(300);
    expect(
      price(
        'drain_cleaning',
        normalizeTradeMeasurements(
          'plumbing',
          { drainCleaningCount: 1 },
          'notes'
        )
      )
    ).toBe(300);
    expect(
      price(
        'sewer_line',
        normalizeTradeMeasurements('plumbing', { sewerLineLf: 10 }, 'notes')
      )
    ).toBe(500);
    expect(
      price(
        'gas_line',
        normalizeTradeMeasurements('plumbing', { gasLineLf: 10 }, 'plan')
      )
    ).toBe(300);
  });

  it('retains a same-plan quantity disagreement for confirmation before pricing', () => {
    const draft = {
      scopeChecklist: {
        templateKey: 'plumbing_service',
        title: 'Confirm Plumbing scope',
        intro: '',
        items: [],
      },
      scopeMeasurements: {
        planImportFingerprint: 'same-plumbing-plan',
        plumbingRoughPointCount: '4',
        quickMeasurementSources: {
          plumbingRoughPointCount: 'plan_detected',
        },
        measurementProvenance: {
          plumbingRoughPointCount: {
            source: 'detected_from_plan',
            value: 4,
          },
        },
      },
    } as any;
    const next = applyPlanImportToDraft(draft, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      planImportFingerprint: 'same-plumbing-plan',
      measurements: { plumbingRoughPointCount: 2 },
      scopeDetections: [],
    });
    expect(next.scopeMeasurements?.plumbingRoughPointCount).toBe(4);
    expect(
      next.scopeMeasurements?.quickMeasurementSources?.plumbingRoughPointCount
    ).toBe('needs_confirmation');
    expect(
      next.scopeMeasurements?.measurementProvenance?.plumbingRoughPointCount
    ).toMatchObject({
      value: 4,
      pricingEligible: false,
      status: 'needs_review',
    });
  });
});
