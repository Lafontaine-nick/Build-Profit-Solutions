import {
  FRAMING_CARDS,
  FRAMING_PLAN_EXPORT_CHECKLIST_GROUPS,
  FRAMING_REVIEW_MEASUREMENT_KEYS,
  buildFramingStructuredMeasurements,
  normalizeFramingPlanMeasurements,
  parseFramingMeasurementsFromNotes,
  resolveCoveredFramedAreaSqft,
  syncFramingScopeItems,
} from '@/utils/subcontractorTrade/framingPlanConvergence';
import { groupScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import { getSubcontractorTradeDefinition } from '@/utils/subcontractorTrade/tradeDefinitions';
import {
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
} from '@/utils/planImportTradeConfig';
import { applyPlanImportToDraft } from '@/utils/estimateAiDraft';
import { reconcileFramingScopeMeasurements } from '@/utils/planTakeoffReviewUi';
import {
  buildNormalizedScopeMeasurementsFromInput,
  getChecklistItemQuantityRule,
  getNationalAverageBudgetSplit,
  prepareScopeMeasurementsInputForUi,
  resolveChecklistItemQuantity,
} from '@/utils/scopeItemQuantities';

describe('framing canonical architecture', () => {
  it('defines one canonical owner for every Framing quantity', () => {
    const keys = FRAMING_CARDS.map(card => card.measurementKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(getSubcontractorTradeDefinition('framing')).toMatchObject({
      status: 'complete',
      standaloneTemplateKey: 'framing',
      reviewMeasurementKeys: FRAMING_REVIEW_MEASUREMENT_KEYS,
    });
  });

  it('groups plan export scopes by shell, sheathing, and closeout', () => {
    expect(FRAMING_PLAN_EXPORT_CHECKLIST_GROUPS.map(group => group.title)).toEqual([
      'Shell framing',
      'Sheathing',
      'Closeout',
    ]);

    const items = ['framing', 'wall_framing', 'shear_sheathing', 'cleanup'].map(id => ({
      id,
      label: id,
      state: 'included' as const,
      inputType: 'yes_no' as const,
    }));
    const grouped = groupScopeChecklistItems(items, 'framing');
    expect(grouped.map(group => group.title)).toEqual([
      'Shell framing',
      'Sheathing',
      'Closeout',
    ]);
  });

  it('derives covered framed SF from living plus garage', () => {
    expect(
      resolveCoveredFramedAreaSqft({ floorAreaSqft: 2000, garageSqft: 400 })
    ).toBe(2400);
    expect(
      normalizeFramingPlanMeasurements({ floorAreaSqft: 1800, garageSqft: 300 })
        .framedAreaSqft
    ).toBe(2100);
  });

  it('parses remodel wall framing from notes', () => {
    expect(
      parseFramingMeasurementsFromNotes('Frame 24 LF stud wall in garage')
    ).toEqual({ wallFramingLf: 24 });
  });

  it('keeps selected-trade Plan Export scoped to framing cards', () => {
    expect(
      Object.keys(
        filterPlanMeasurementsForTrade(
          {
            framedAreaSqft: 2400,
            sheathingSqft: 3200,
            wallFramingLf: 24,
            plumbingRoughPointCount: 10,
            wallPaintSqft: 1800,
          },
          'selected_trade',
          'framing'
        )
      )
    ).toEqual(['framedAreaSqft', 'sheathingSqft', 'wallFramingLf']);

    expect(
      filterPlanScopesForTrade(
        [
          { itemId: 'framing' },
          { itemId: 'shear_sheathing' },
          { itemId: 'plumbing_rough' },
          { itemId: 'layout' },
        ],
        'selected_trade',
        'framing'
      ).map(row => row.itemId)
    ).toEqual(['framing', 'shear_sheathing']);
  });

  it('builds structured scope and syncs checklist cards from measurements', () => {
    const structured = buildFramingStructuredMeasurements({
      floorAreaSqft: 2000,
      garageSqft: 400,
      sheathingSqft: 3100,
    });
    expect(structured.framingScope).toEqual(['framing', 'shear_sheathing']);
    expect(structured.itemQuantities?.framing).toMatchObject({
      quantity: 2400,
      unit: 'sqft',
    });

    const normalized = normalizeTradeMeasurements(
      'framing',
      { floorAreaSqft: 2000, garageSqft: 400, sheathingSqft: 3100 },
      'plan'
    );
    expect(normalized.measurements.framedAreaSqft).toBe(2400);
    expect(normalized.structuredMeasurements?.framingScope).toEqual([
      'framing',
      'shear_sheathing',
    ]);

    const synced = syncFramingScopeItems(
      FRAMING_CARDS.map(card => ({
        id: card.itemId,
        label: card.label,
        state: 'unsure' as const,
      })),
      {
        framingScope: structured.framingScope,
        quantities: { floorAreaSqft: 2000, garageSqft: 400, sheathingSqft: 3100 },
      }
    );
    expect(synced.filter(item => item.state === 'included').map(item => item.id)).toEqual([
      'framing',
      'shear_sheathing',
    ]);
  });

  it('applies framing plan import onto a draft checklist', () => {
    const next = applyPlanImportToDraft(
      {
        scopeChecklist: {
          templateKey: 'ground_up',
          title: 'Ground up',
          intro: 'Confirm scope',
          items: [
            { id: 'framing', label: 'Framing', state: 'unsure' },
            { id: 'plumbing', label: 'Plumbing', state: 'unsure' },
          ],
        },
        scopeMeasurements: {},
      } as any,
      {
        estimatingMode: 'selected_trade',
        selectedTrade: 'framing',
        measurements: {
          floorAreaSqft: 2000,
          garageSqft: 400,
          sheathingSqft: 3200,
        },
        scopeDetections: [{ itemId: 'framing' }, { itemId: 'shear_sheathing' }],
        planImportFingerprint: 'plan-58-framing',
      } as any
    );

    expect(next.scopeChecklist?.templateKey).toBe('framing');
    expect(
      next.scopeChecklist?.items?.filter(item => item.state === 'included').map(item => item.id)
    ).toEqual(['framing', 'shear_sheathing']);
    expect(Number(next.scopeMeasurements?.framedAreaSqft)).toBe(2400);
  });

  it('reconciles Plan 58-style measurements for Confirm Scope', () => {
    const reconciled = reconcileFramingScopeMeasurements({
      planImportTradeKey: 'framing',
      floorAreaSqft: 3660,
      garageSqft: 781,
      sheathingSqft: 2530,
      quickMeasurementSources: {
        floorAreaSqft: 'plan_verified',
        garageSqft: 'plan_verified',
        sheathingSqft: 'plan_detected',
      },
    });

    expect(Number(reconciled.framedAreaSqft)).toBe(4441);
    expect(reconciled.framingScope).toEqual(['framing', 'shear_sheathing']);
    expect(reconciled.quickMeasurementSources?.framedAreaSqft).toBe(
      'plan_detected'
    );
    expect(reconciled.quickMeasurementSources?.sheathingSqft).toBe(
      'plan_detected'
    );
    expect(reconciled.itemQuantities?.framing).toMatchObject({
      quantity: 4441,
      unit: 'sqft',
      quantitySource: 'plan_detected',
    });
    expect(reconciled.itemQuantities?.shear_sheathing).toMatchObject({
      quantity: 2530,
      unit: 'sqft',
      quantitySource: 'plan_detected',
    });
  });

  it('does not stack wall LF or opening counts onto ground-up shell bids', () => {
    const reconciled = reconcileFramingScopeMeasurements({
      planImportTradeKey: 'framing',
      floorAreaSqft: 3660,
      garageSqft: 781,
      sheathingSqft: 2530,
      wallFramingLf: 750,
      framingOpeningCount: 75,
      quickMeasurementSources: {
        floorAreaSqft: 'plan_verified',
        garageSqft: 'plan_verified',
        sheathingSqft: 'plan_detected',
        wallFramingLf: 'plan_detected',
        framingOpeningCount: 'plan_detected',
      },
    });

    expect(reconciled.framingScope).toEqual(['framing', 'shear_sheathing']);
    expect(reconciled.wallFramingLf).toBeUndefined();
    expect(reconciled.framingOpeningCount).toBeUndefined();
    expect(reconciled.itemQuantities?.wall_framing).toBeUndefined();
    expect(reconciled.itemQuantities?.openings).toBeUndefined();
  });

  it('preserves contractor-entered wall framing on shell bids', () => {
    const reconciled = reconcileFramingScopeMeasurements({
      planImportTradeKey: 'framing',
      floorAreaSqft: 3660,
      garageSqft: 781,
      sheathingSqft: 2530,
      wallFramingLf: '24',
      quickMeasurementSources: {
        floorAreaSqft: 'plan_verified',
        garageSqft: 'plan_verified',
        sheathingSqft: 'plan_detected',
        wallFramingLf: 'user_entered',
      },
      quickMeasurementUserOverrides: { wallFramingLf: true },
    });

    expect(reconciled.wallFramingLf).toBe('24');
    expect(reconciled.framingScope).toContain('wall_framing');
  });

  it('exposes framing template quantity rules and national planning rates', () => {
    expect(getChecklistItemQuantityRule('framing', 'framing')).toMatchObject({
      defaultUnit: 'sqft',
      measurementKeys: ['framedAreaSqft', 'floorAreaSqft', 'garageSqft'],
    });
    expect(getChecklistItemQuantityRule('shear_sheathing', 'framing')).toMatchObject({
      defaultUnit: 'sqft',
      measurementKeys: ['sheathingSqft', 'stuccoGrossWallSqft'],
    });
    expect(getNationalAverageBudgetSplit('framing', 'sqft')).toMatchObject({
      material: 10,
      labor: 7.5,
    });
    expect(getNationalAverageBudgetSplit('shear_sheathing', 'sqft')).toMatchObject({
      material: 2.5,
      labor: 2,
    });

    const measurements = buildNormalizedScopeMeasurementsFromInput(
      {
        framedAreaSqft: '4441',
        sheathingSqft: '2530',
        itemQuantities: {
          framing: {
            quantity: 4441,
            unit: 'sqft',
            quantitySource: 'plan_detected',
          },
          shear_sheathing: {
            quantity: 2530,
            unit: 'sqft',
            quantitySource: 'plan_detected',
          },
        },
      },
      { templateKey: 'framing' }
    );
    expect(
      resolveChecklistItemQuantity('framing', measurements, {
        templateKey: 'framing',
      })
    ).toMatchObject({
      pricingReady: true,
      quantity: 4441,
      unit: 'sqft',
    });
    expect(
      resolveChecklistItemQuantity('shear_sheathing', measurements, {
        templateKey: 'framing',
      })
    ).toMatchObject({
      pricingReady: true,
      quantity: 2530,
      unit: 'sqft',
    });

    const synced = syncFramingScopeItems(
      FRAMING_CARDS.map(card => ({
        id: card.itemId,
        label: card.label,
        state: 'unsure' as const,
      })),
      {
        framingScope: ['framing', 'shear_sheathing'],
        quantities: {
          framedAreaSqft: 4441,
          sheathingSqft: 2530,
        },
      }
    );
    expect(synced.filter(item => item.state === 'included').map(item => item.id)).toEqual([
      'framing',
      'shear_sheathing',
    ]);
    expect(
      synced.filter(item => item.state === 'unsure').map(item => item.id)
    ).toEqual(['wall_framing', 'openings', 'cleanup']);
  });

  it('preserves Framing quick measurements through Confirm Scope UI round-trip', () => {
    const input = {
      floorAreaSqft: '3660',
      garageSqft: '781',
      framedAreaSqft: '4441',
      sheathingSqft: '2530',
      quickMeasurementSources: {
        floorAreaSqft: 'plan_detected',
        garageSqft: 'plan_detected',
        framedAreaSqft: 'plan_detected',
        sheathingSqft: 'plan_detected',
      },
      framingScope: ['framing', 'shear_sheathing'],
      itemQuantities: {
        framing: {
          quantity: '4441',
          unit: 'sqft',
          quantitySource: 'plan_detected',
        },
        shear_sheathing: {
          quantity: '2530',
          unit: 'sqft',
          quantitySource: 'plan_detected',
        },
      },
    };
    const roundTrip = prepareScopeMeasurementsInputForUi(input as never, {
      templateKey: 'framing',
      notes: 'Framing takeoff from Plan 58.',
    });
    expect(roundTrip.framedAreaSqft).toBe('4441');
    expect(roundTrip.sheathingSqft).toBe('2530');
    expect(roundTrip.framingScope).toEqual(['framing', 'shear_sheathing']);
    expect(roundTrip.itemQuantities?.shear_sheathing).toMatchObject({
      quantity: '2530',
      unit: 'sqft',
    });
    expect(roundTrip.quickMeasurementSources?.sheathingSqft).toBe('plan_detected');
  });
});
