import { quoteElectricalTrim } from '@/utils/subcontractorTrade/electricalTrimPricing';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  parseElectricalMeasurementsFromNotes,
  shouldAutoPriceElectricalTrimPackage,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { resolveStep2PricingTier } from '@/utils/confirmScopeStep2Pricing';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

describe('electrical Phase 2J trim-out package pricing', () => {
  it('quotes a locked $2,500 planning allowance without inventing a device count or using living SF', () => {
    const quote = quoteElectricalTrim({
      itemId: 'electrical_trim',
      electricalIncludeTrim: true,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 750,
      labor: 1750,
      total: 2500,
      unit: 'allowance',
      specialty: true,
    });
    expect(quote?.helper).toMatch(/planning allowance/i);
    expect(quote?.helper).toMatch(/confirm actual quantity/i);
    expect(quote?.helper).toMatch(/fixtures \/ fans not included/i);
    expect(quote?.ratesStatus).toBe('locked');
  });

  it('quotes a user-entered trim device count below the locked 2C receptacle split', () => {
    const quote = quoteElectricalTrim({
      itemId: 'electrical_trim',
      quantity: 20,
      unit: 'each',
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 400,
      labor: 700,
      total: 1100,
      unit: 'each',
    });
    expect(quote?.helper).toMatch(/no new circuit\/homerun/i);
    expect(quote?.helper).toMatch(/approved split/i);
    expect(quote?.total).toBeLessThan(20 * 110);

    const priced = resolveScopeItemSuggestedPricing(
      'electrical_trim',
      inputWith({
        itemQuantities: {
          electrical_trim: {
            quantity: '20',
            unit: 'each',
            quantitySource: 'user_entered',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_trim',
        normalizeScopeMeasurements({
          itemQuantities: {
            electrical_trim: {
              quantity: 20,
              unit: 'each',
              quantitySource: 'user_entered',
            },
          },
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(priced.fill?.total).toBe(1100);
    expect(priced.fill?.productionStatus).toBe('production_ready');
  });

  it('does not invent a trim price from living SF', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_trim',
      inputWith({
        electricalIncludeTrim: true,
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_trim',
        normalizeScopeMeasurements({
          electricalIncludeTrim: true,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill?.total).toBe(2500);
    expect(pricing.fill?.basis?.unit).toBe('allowance');
    expect(pricing.fill?.productionStatus).toBe('review_required');
    expect(pricing.fill?.pricingRecordId).toBe(
      'bps_electrical_trim:electrical_trim'
    );
  });

  it('does not auto-price trim when detailed receptacle counts exist', () => {
    expect(
      shouldAutoPriceElectricalTrimPackage(
        { electricalIncludeTrim: true, standardReceptacleCount: 12 },
        'electrical'
      )
    ).toBe(false);

    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_trim',
      inputWith({
        electricalIncludeTrim: true,
        standardReceptacleCount: '12',
        itemQuantities: {
          electrical_standard_receptacle: {
            quantity: '12',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_trim',
        normalizeScopeMeasurements({
          electricalIncludeTrim: true,
          standardReceptacleCount: 12,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();

    const receptacles = resolveScopeItemSuggestedPricing(
      'electrical_standard_receptacle',
      inputWith({
        standardReceptacleCount: '12',
        itemQuantities: {
          electrical_standard_receptacle: {
            quantity: '12',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_standard_receptacle',
        normalizeScopeMeasurements({ standardReceptacleCount: 12 }),
        { templateKey: 'electrical' }
      )
    );
    expect(receptacles.fill?.total).toBe(1320);
  });

  it('does not auto-price trim when detailed switch or fixture counts exist', () => {
    expect(
      shouldAutoPriceElectricalTrimPackage(
        { electricalIncludeTrim: true, singlePoleSwitchCount: 8 },
        'electrical'
      )
    ).toBe(false);
    expect(
      shouldAutoPriceElectricalTrimPackage(
        { electricalIncludeTrim: true, recessedLightCount: 18 },
        'electrical'
      )
    ).toBe(false);

    const fixtureTrim = resolveScopeItemSuggestedPricing(
      'electrical_trim',
      inputWith({
        electricalIncludeTrim: true,
        recessedLightCount: '18',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_trim',
        normalizeScopeMeasurements({
          electricalIncludeTrim: true,
          recessedLightCount: 18,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(fixtureTrim.fill).toBeNull();
  });

  it('parses trim-out language without inventing device or fixture counts', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Electrical: finish electrical and install devices and plates'
    );
    expect(parsed.electricalIncludeTrim).toBe(true);
    expect(parsed.standardReceptacleCount).toBeUndefined();
    expect(parsed.singlePoleSwitchCount).toBeUndefined();
    expect(parsed.standardFixtureCount).toBeUndefined();
    expect(
      shouldAutoPriceElectricalTrimPackage(parsed as Record<string, unknown>, 'electrical')
    ).toBe(true);
  });

  it('does not price trim from a bare Electrical job with no trim request', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_trim',
      inputWith({ floorAreaSqft: '1879' }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_trim',
        normalizeScopeMeasurements({ floorAreaSqft: 1879 }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });

  it('keeps electrical_rough unpriced while trim package is proposed', () => {
    const rough = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        electricalIncludeTrim: true,
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          electricalIncludeTrim: true,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(rough.fill).toBeNull();
    expect(
      resolveStep2PricingTier('electrical_trim', 'electrical').tier
    ).toBe('auto_planning');
  });

  it('suppresses ground-up electrical_trim living-SF package when detailed 2C counts exist', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_trim',
      inputWith({
        floorAreaSqft: '1879',
        standardReceptacleCount: '12',
      }),
      'ground_up',
      resolveChecklistItemQuantity(
        'electrical_trim',
        normalizeScopeMeasurements({
          floorAreaSqft: 1879,
          standardReceptacleCount: 12,
        }),
        { templateKey: 'ground_up' }
      )
    );
    expect(pricing.fill).toBeNull();
  });
});
