import {
  ELECTRICAL_PLAN_EXPORT_RESIDENTIAL_FIXTURE,
  hasDetailedElectricalQuantities,
  normalizeElectricalPlanMeasurements,
  parseElectricalMeasurementsFromNotes,
  shouldAutoPriceElectricalRoughPackage,
  shouldAutoPriceElectricalTrimPackage,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { filterPlanMeasurementsForTrade, filterPlanScopesForTrade } from '@/utils/planImportTradeConfig';
import {
  buildElectricalPlanReviewSummary,
  electricalPlanReadinessLine,
} from '@/utils/planTakeoffReviewUi';
import { applyElectricalQuickMeasurementPatch } from '@/utils/electricalQuickMeasurementUi';
import {
  includeUnconfirmedSuggestedPricingFill,
  suggestedPricingFooterCountsAmperageConfirm,
} from '@/utils/suggestedPricingCardUi';
import { footerSuggestedPricingSummary } from '@/utils/measurementSemantics/scopePriceUi';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

function priceElectrical(
  itemId: string,
  fields: Record<string, unknown>
) {
  const input = inputWith(fields as Partial<ScopeMeasurementsInputExtended>);
  return resolveScopeItemSuggestedPricing(
    itemId,
    input,
    'electrical',
    resolveChecklistItemQuantity(
      itemId,
      normalizeScopeMeasurements(fields),
      { templateKey: 'electrical' }
    )
  );
}

const FIXTURE_PRICING: Array<[string, number]> = [
  ['electrical_main_panel', 2050],
  ['electrical_standard_receptacle', 4620],
  ['electrical_gfci_receptacle', 1400],
  ['electrical_exterior_receptacle', 1290],
  ['electrical_single_pole_switch', 2945],
  ['electrical_3way_switch', 910],
  ['electrical_recessed_light', 3600],
  ['electrical_pendant_light', 480],
  ['electrical_exterior_light', 720],
  ['electrical_ceiling_fan', 1375],
  ['electrical_smoke_detector', 1050],
  ['electrical_co_detector', 320],
  ['electrical_range_hookup', 800],
  ['electrical_dryer_hookup', 675],
  ['electrical_dishwasher_hookup', 500],
];

describe('electrical Phase 3A plan export adapter', () => {
  it('maps the residential fixture onto existing canonical keys without inventing homeruns', () => {
    const normalized = normalizeElectricalPlanMeasurements({
      ...ELECTRICAL_PLAN_EXPORT_RESIDENTIAL_FIXTURE,
      floorAreaSqft: 2000,
    });
    expect(normalized.mainPanelCount).toBe(1);
    expect(normalized.serviceAmperage).toBe(200);
    expect(normalized.standardReceptacleCount).toBe(42);
    expect(normalized.gfciReceptacleCount).toBe(8);
    expect(normalized.exteriorReceptacleCount).toBe(6);
    expect(normalized.rangeHookupCount).toBe(1);
    expect(normalized.standardCircuitCount).toBeUndefined();
    expect(normalized.circuit50aCount).toBeUndefined();
    expect(normalized.dedicated20aCircuitCount).toBeUndefined();
    expect(normalized.electricalIncludeRough).toBeUndefined();
    expect(normalized.electricalIncludeTrim).toBeUndefined();
    expect(normalized.conduitLf).toBeUndefined();
    expect(normalized.trenchingLf).toBeUndefined();
  });

  it('folds plan aliases and applies hookup ownership', () => {
    const normalized = normalizeElectricalPlanMeasurements({
      panelCount: 1,
      serviceAmps: 200,
      duplexReceptacleCount: 42,
      gfciCount: 8,
      wrReceptacleCount: 6,
      threeWayCount: 7,
      canLightCount: 24,
      pendantCount: 3,
      rangeCircuitCount: 1,
      circuit50aCount: 1,
      dryerCircuitCount: 1,
      dishwasherCircuitCount: 1,
      dedicated20aCircuitCount: 1,
    });
    expect(normalized.mainPanelCount).toBe(1);
    expect(normalized.serviceAmperage).toBe(200);
    expect(normalized.standardReceptacleCount).toBe(42);
    expect(normalized.gfciReceptacleCount).toBe(8);
    expect(normalized.exteriorReceptacleCount).toBe(6);
    expect(normalized.threeWaySwitchCount).toBe(7);
    expect(normalized.recessedLightCount).toBe(24);
    expect(normalized.pendantLightCount).toBe(3);
    expect(normalized.rangeHookupCount).toBe(1);
    expect(normalized.dryerHookupCount).toBe(1);
    expect(normalized.dishwasherHookupCount).toBe(1);
    expect(normalized.circuit50aCount).toBeUndefined();
    expect(normalized.dedicated20aCircuitCount).toBeUndefined();
    expect(normalized.standardReceptacleCount).not.toBe(42 + 8 + 6);
  });

  it('matches manual pricing for the residential fixture and does not add packages', () => {
    const planNormalized = normalizeTradeMeasurements(
      'electrical',
      ELECTRICAL_PLAN_EXPORT_RESIDENTIAL_FIXTURE,
      'plan'
    );
    expect(planNormalized.quickMeasurementSources?.standardReceptacleCount).toBe(
      'plan_detected'
    );
    expect(
      planNormalized.structuredMeasurements?.itemQuantities
        ?.electrical_standard_receptacle
    ).toMatchObject({
      quantity: 42,
      unit: 'each',
      quantitySource: 'plan_detected',
    });
    expect(
      planNormalized.structuredMeasurements?.itemQuantities?.electrical_circuit_50a
    ).toBeUndefined();

    const planFields = {
      ...ELECTRICAL_PLAN_EXPORT_RESIDENTIAL_FIXTURE,
      ...(planNormalized.structuredMeasurements || {}),
      floorAreaSqft: 2000,
    };
    const manualFields = {
      ...ELECTRICAL_PLAN_EXPORT_RESIDENTIAL_FIXTURE,
    };

    for (const [itemId, total] of FIXTURE_PRICING) {
      const manual = priceElectrical(itemId, manualFields);
      const plan = priceElectrical(itemId, planFields);
      expect(plan.fill?.total).toBe(total);
      expect(plan.fill?.total).toBe(manual.fill?.total);
    }

    expect(hasDetailedElectricalQuantities(planFields)).toBe(true);
    expect(
      shouldAutoPriceElectricalRoughPackage(
        { ...planFields, electricalIncludeRough: true },
        'electrical'
      )
    ).toBe(false);
    expect(
      shouldAutoPriceElectricalTrimPackage(
        { ...planFields, electricalIncludeTrim: true },
        'electrical'
      )
    ).toBe(false);
    expect(
      priceElectrical('electrical_rough', {
        ...planFields,
        electricalIncludeRough: true,
      }).fill
    ).toBeNull();
    expect(
      priceElectrical('electrical_trim', {
        ...planFields,
        electricalIncludeTrim: true,
      }).fill
    ).toBeNull();
    expect(
      priceElectrical('electrical_circuit_50a', planFields).fill
    ).toBeNull();
    expect(
      priceElectrical('electrical_dedicated_20a', planFields).fill
    ).toBeNull();
  });

  it('keeps Electrical selected-trade filtering on canonical keys only', () => {
    const filtered = filterPlanMeasurementsForTrade(
      {
        ...ELECTRICAL_PLAN_EXPORT_RESIDENTIAL_FIXTURE,
        floorAreaSqft: 2000,
        wallPaintSqft: 8500,
      } as Record<string, number>,
      'selected_trade',
      'electrical'
    );
    expect(filtered.standardReceptacleCount).toBe(42);
    expect(filtered.serviceAmperage).toBe(200);
    expect(filtered.floorAreaSqft).toBeUndefined();
    expect(filtered.wallPaintSqft).toBeUndefined();
  });

  it('does not auto-include Electrical rough/trim or cleanup from plan detections', () => {
    const filtered = filterPlanScopesForTrade(
      [
        { itemId: 'electrical_rough', label: 'Electrical rough-in' },
        { itemId: 'electrical_trim', label: 'Electrical fixtures' },
        { itemId: 'electrical', label: 'Electrical' },
        { itemId: 'cleanup', label: 'Cleanup & disposal' },
        { itemId: 'electrical_standard_receptacle', label: 'Standard receptacle' },
      ],
      'selected_trade',
      'electrical'
    );
    expect(filtered.map(row => row.itemId)).toEqual([
      'electrical_standard_receptacle',
    ]);
  });

  it('builds a grouped Electrical takeoff summary without living SF', () => {
    const summary = buildElectricalPlanReviewSummary({
      ...ELECTRICAL_PLAN_EXPORT_RESIDENTIAL_FIXTURE,
      floorAreaSqft: 2000,
    });
    expect(summary).toEqual(
      expect.arrayContaining([
        { label: 'Main panel', value: '1 EA · 200A' },
        { label: 'Standard receptacles', value: '42 EA' },
        { label: 'GFCI receptacles', value: '8 EA' },
        { label: 'Exterior receptacles', value: '6 EA' },
        { label: 'Single-pole switch', value: '31 EA' },
        { label: '3-way switch', value: '7 EA' },
        { label: 'Recessed / canless / wafer light', value: '24 EA' },
        { label: 'Pendant light', value: '3 EA' },
        { label: 'Electric range circuit + hookup', value: '1 EA' },
        {
          label: 'Shared homeruns / unlabeled circuits',
          value: 'Needs confirmation',
          note: 'Device symbols do not invent circuit relationships',
        },
        { label: 'Conduit', value: 'Needs confirmation' },
        { label: 'Trenching', value: 'Needs confirmation' },
        {
          label: 'Rough / trim packages',
          value: 'Not auto-priced from detailed takeoff',
        },
        { label: 'Job condition', value: 'Needs confirmation' },
      ])
    );
    expect(summary.some(line => /living|sqft/i.test(line.label))).toBe(false);
    expect(summary.some(line => line.value.includes('10,000'))).toBe(false);
    expect(summary.some(line => line.value.includes('2,500'))).toBe(false);
  });

  it('keeps export readiness blocked by conflicts and unclassified fixtures', () => {
    const readiness = electricalPlanReadinessLine({
      measurements: {
        standardReceptacleCount: 50,
        gfciReceptacleCount: 8,
        threeWaySwitchCount: 6,
        smokeDetectorCount: 10,
      },
      conflicts: [
        { field: 'threeWaySwitchCount' },
        { field: 'smokeDetectorCount' },
      ],
      unclassifiedFixtureCount: 3,
      validation: {
        fields: {
          standardReceptacleCount: {
            status: 'ai_verified',
            pricingEligible: true,
          },
          gfciReceptacleCount: {
            status: 'needs_review',
            pricingEligible: false,
          },
          threeWaySwitchCount: {
            status: 'conflict',
            pricingEligible: false,
          },
          smokeDetectorCount: {
            status: 'conflict',
            pricingEligible: false,
          },
        },
        priceableFields: ['standardReceptacleCount'],
        blockedFields: [
          'gfciReceptacleCount',
          'threeWaySwitchCount',
          'smokeDetectorCount',
        ],
      },
    });

    expect(readiness.value).toBe('1 prices ready · 4 to confirm');
    expect(readiness.note).toMatch(/conflicts and inferred quantities are not priced/);
  });

  it('counts Plan verified provenance in the readiness summary', () => {
    const readiness = electricalPlanReadinessLine({
      measurements: {
        mainPanelCount: 1,
        standardReceptacleCount: 50,
      },
      provenance: {
        mainPanelCount: {
          status: 'plan_verified',
          normalizedSource: 'FROM_PLAN',
          evidenceKind: 'explicit_label',
          pricingEligible: true,
        },
        standardReceptacleCount: {
          status: 'ai_verified',
          normalizedSource: 'AI_VERIFIED',
          pricingEligible: true,
        },
      },
      validation: {
        fields: {
          mainPanelCount: {
            status: 'plan_verified',
            pricingEligible: true,
          },
          standardReceptacleCount: {
            status: 'ai_verified',
            pricingEligible: true,
          },
        },
        priceableFields: ['mainPanelCount', 'standardReceptacleCount'],
        blockedFields: [],
      },
    });

    expect(readiness.value).toBe('2 prices ready · 0 to confirm');
    expect(readiness.note).toMatch(/1 Plan verified · 1 AI verified/);
  });

  it('does not price a conflicted recessed count until the contractor confirms', () => {
    const agreed = {
      standardReceptacleCount: 50,
      gfciReceptacleCount: 8,
      ceilingFanCount: 8,
      mainPanelCount: 1,
      rangeHookupCount: 1,
      dryerHookupCount: 1,
      dishwasherHookupCount: 1,
    };
    expect(priceElectrical('electrical_recessed_light', agreed).fill).toBeNull();
    expect(
      priceElectrical('electrical_standard_receptacle', agreed).fill?.total
    ).toBeGreaterThan(0);

    const confirmedCount = 48;
    const planConfirmed = { ...agreed, recessedLightCount: confirmedCount };
    const fromNotes = parseElectricalMeasurementsFromNotes(
      'Install 48 recessed lights. Add 50 standard outlets. Add 8 GFCI outlets. Add 8 ceiling fans.'
    );
    expect(fromNotes.recessedLightCount).toBe(confirmedCount);
    expect(fromNotes.standardReceptacleCount).toBe(50);
    expect(
      priceElectrical('electrical_recessed_light', planConfirmed).fill?.total
    ).toBe(
      priceElectrical('electrical_recessed_light', fromNotes).fill?.total
    );
    expect(
      priceElectrical('electrical_standard_receptacle', planConfirmed).fill?.total
    ).toBe(
      priceElectrical('electrical_standard_receptacle', fromNotes).fill?.total
    );
  });

  it('prices confirmed residential Confirm Scope counts the same as Notes/Voice', () => {
    const confirmedPlan = {
      mainPanelCount: 1,
      standardReceptacleCount: 50,
      gfciReceptacleCount: 8,
      singlePoleSwitchCount: 20,
      threeWaySwitchCount: 5,
      recessedLightCount: 48,
      ceilingFanCount: 10,
      rangeHookupCount: 1,
      dryerHookupCount: 1,
      dishwasherHookupCount: 1,
      smokeDetectorCount: 6,
    };
    const fromNotes = parseElectricalMeasurementsFromNotes(
      [
        'Install 1 main panel.',
        'Add 50 standard outlets.',
        'Add 8 GFCI outlets.',
        'Add 20 single-pole switches.',
        'Add 5 three-way switches.',
        'Install 48 recessed lights.',
        'Add 10 ceiling fans.',
        'Install one 50 amp range circuit.',
        'Add a 30 amp dryer circuit.',
        'Run a dedicated 20 amp dishwasher circuit.',
        'Add 6 smoke detectors.',
      ].join(' ')
    );

    expect(fromNotes.serviceAmperage).toBeUndefined();
    expect(fromNotes.standardCircuitCount).toBeUndefined();
    expect(fromNotes.dedicated20aCircuitCount).toBeUndefined();
    expect(fromNotes.circuit30aCount).toBeUndefined();
    expect(fromNotes.circuit50aCount).toBeUndefined();
    expect(fromNotes.electricalIncludeRough).toBeUndefined();
    expect(fromNotes.electricalIncludeTrim).toBeUndefined();
    expect(fromNotes.conduitLf).toBeUndefined();
    expect(fromNotes.trenchingLf).toBeUndefined();
    expect(fromNotes.pendantLightCount).toBeUndefined();
    expect(fromNotes.standardFixtureCount).toBeUndefined();
    expect(fromNotes).toMatchObject(confirmedPlan);

    const planNormalized = normalizeTradeMeasurements(
      'electrical',
      confirmedPlan,
      'plan'
    );
    const notesNormalized = normalizeTradeMeasurements(
      'electrical',
      fromNotes,
      'notes'
    );
    const planFields = {
      ...confirmedPlan,
      ...(planNormalized.structuredMeasurements || {}),
    };
    const notesFields = {
      ...fromNotes,
      ...(notesNormalized.structuredMeasurements || {}),
    };

    const pricedCards: Array<[string, number]> = [
      ['electrical_standard_receptacle', 5500],
      ['electrical_gfci_receptacle', 1400],
      ['electrical_single_pole_switch', 1900],
      ['electrical_3way_switch', 650],
      ['electrical_recessed_light', 7200],
      ['electrical_ceiling_fan', 2750],
      ['electrical_range_hookup', 800],
      ['electrical_dryer_hookup', 675],
      ['electrical_dishwasher_hookup', 500],
      ['electrical_smoke_detector', 900],
    ];

    for (const [itemId, total] of pricedCards) {
      const fromPlan = priceElectrical(itemId, planFields);
      const fromVoice = priceElectrical(itemId, notesFields);
      expect(fromPlan.fill?.total).toBe(total);
      expect(fromPlan.fill?.material).toBe(fromVoice.fill?.material);
      expect(fromPlan.fill?.labor).toBe(fromVoice.fill?.labor);
      expect(fromPlan.fill?.total).toBe(fromVoice.fill?.total);
    }

    const panel = priceElectrical('electrical_main_panel', planFields);
    expect(panel.fill?.total).toBe(0);
    expect(panel.fill?.needsServiceAmperage).toBe(true);
    expect(panel.fill?.total).toBe(
      priceElectrical('electrical_main_panel', notesFields).fill?.total
    );
    expect(includeUnconfirmedSuggestedPricingFill(panel.fill)).toBe(true);
    expect(suggestedPricingFooterCountsAmperageConfirm(panel.fill!)).toBe(true);

    expect(priceElectrical('electrical_circuit_50a', planFields).fill).toBeNull();
    expect(priceElectrical('electrical_dedicated_20a', planFields).fill).toBeNull();
    expect(priceElectrical('electrical_circuit_30a', planFields).fill).toBeNull();
    expect(
      priceElectrical('electrical_rough', {
        ...planFields,
        electricalIncludeRough: true,
      }).fill
    ).toBeNull();
    expect(
      priceElectrical('electrical_trim', {
        ...planFields,
        electricalIncludeTrim: true,
      }).fill
    ).toBeNull();
    expect(priceElectrical('electrical_conduit', planFields).fill).toBeNull();
    expect(priceElectrical('electrical_trenching', planFields).fill).toBeNull();
    expect(
      priceElectrical('electrical_pendant_light', {
        unclassifiedFixtureCount: 5,
      }).fill
    ).toBeNull();
    expect(
      priceElectrical('electrical_standard_fixture', {
        unclassifiedFixtureCount: 5,
      }).fill
    ).toBeNull();

    const cleanupFromPlan = priceElectrical('cleanup', planFields);
    const cleanupFromNotes = priceElectrical('cleanup', notesFields);
    expect(cleanupFromPlan.fill?.total).toBe(cleanupFromNotes.fill?.total);
    expect(cleanupFromPlan.fill?.total).toBe(1000);

    const footer = footerSuggestedPricingSummary({
      readyCount: pricedCards.length,
      benchmarkOnlyCount: 0,
      needsMeasurementCount: 1,
    });
    expect(footer).toMatch(/10 prices ready/);
    expect(footer).toMatch(/1 to confirm/);
  });

  it('prices a confirmed 46 recessed count the same as Notes/Voice 46', () => {
    const fromNotes = parseElectricalMeasurementsFromNotes(
      'Install 46 recessed lights.'
    );
    expect(fromNotes.recessedLightCount).toBe(46);
    expect(
      priceElectrical('electrical_recessed_light', {
        recessedLightCount: 46,
      }).fill?.total
    ).toBe(
      priceElectrical('electrical_recessed_light', fromNotes).fill?.total
    );
    expect(
      priceElectrical('electrical_standard_receptacle', {}).fill
    ).toBeNull();
  });

  it('reprices from the same canonical key when Quick Measurements edits a count', () => {
    const patched = applyElectricalQuickMeasurementPatch(
      { standardReceptacleCount: 50 },
      'standardReceptacleCount',
      52
    );
    expect(patched.standardReceptacleCount).toBe('52');
    expect(
      priceElectrical('electrical_standard_receptacle', patched).fill?.total
    ).toBe(5720);
    const reverted = applyElectricalQuickMeasurementPatch(
      patched,
      'standardReceptacleCount',
      50
    );
    expect(
      priceElectrical('electrical_standard_receptacle', reverted).fill?.total
    ).toBe(5500);
  });

  it('unprices the card when Quick Measurements deselects a takeoff row', () => {
    const selected = applyElectricalQuickMeasurementPatch(
      { mainPanelCount: 1, standardReceptacleCount: 50 },
      'standardReceptacleCount',
      50
    );
    expect(
      priceElectrical('electrical_standard_receptacle', selected).fill?.total
    ).toBe(5500);
    expect(
      priceElectrical('electrical_main_panel', selected).fill?.needsServiceAmperage
    ).toBe(true);
    expect(priceElectrical('electrical_main_panel', selected).fill?.total).toBe(0);

    const deselected = applyElectricalQuickMeasurementPatch(
      selected,
      'standardReceptacleCount',
      ''
    );
    expect(deselected.standardReceptacleCount).toBe('');
    expect(
      priceElectrical('electrical_standard_receptacle', deselected).fill
    ).toBeNull();
    expect(
      priceElectrical('electrical_main_panel', deselected).fill?.needsServiceAmperage
    ).toBe(true);
    expect(
      priceElectrical('electrical_main_panel', deselected).fill?.total
    ).toBe(0);

    const panelOff = applyElectricalQuickMeasurementPatch(
      deselected,
      'mainPanelCount',
      ''
    );
    expect(priceElectrical('electrical_main_panel', panelOff).fill).toBeNull();
  });
});
