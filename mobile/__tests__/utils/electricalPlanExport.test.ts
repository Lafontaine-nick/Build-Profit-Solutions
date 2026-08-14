import {
  ELECTRICAL_PLAN_EXPORT_RESIDENTIAL_FIXTURE,
  hasDetailedElectricalQuantities,
  normalizeElectricalPlanMeasurements,
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
import { buildElectricalPlanReviewSummary } from '@/utils/planTakeoffReviewUi';

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
  ['electrical_smoke_detector', 1225],
  ['electrical_co_detector', 320],
  ['electrical_range_hookup', 950],
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

  it('does not auto-include Electrical rough/trim packages from plan detections', () => {
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
      'cleanup',
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
        { label: 'Range hookup', value: '1 EA' },
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
});
