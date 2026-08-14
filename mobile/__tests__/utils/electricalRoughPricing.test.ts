import { quoteElectricalRough } from '@/utils/subcontractorTrade/electricalRoughPricing';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  parseElectricalMeasurementsFromNotes,
  shouldAutoPriceElectricalRoughPackage,
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

describe('electrical Phase 2K rough-in package pricing', () => {
  it('quotes a locked $10,000 planning allowance without inventing a circuit count or using living SF', () => {
    const quote = quoteElectricalRough({
      itemId: 'electrical_rough',
      electricalIncludeRough: true,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 3000,
      labor: 7000,
      total: 10000,
      unit: 'allowance',
      specialty: true,
    });
    expect(quote?.helper).toMatch(/planning allowance — \$10,000/i);
    expect(quote?.helper).toMatch(/confirm detailed device\/circuit takeoff/i);
    expect(quote?.helper).toMatch(/not a national-average rough price/i);
    expect(quote?.ratesStatus).toBe('locked');
  });

  it('quotes a user-entered rough-point count as a generic $250/EA allowance, not a $300 homerun', () => {
    const quote = quoteElectricalRough({
      itemId: 'electrical_rough',
      quantity: 20,
      unit: 'each',
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 1500,
      labor: 3500,
      total: 5000,
      unit: 'each',
      specialty: false,
    });
    expect(quote?.helper).toMatch(/generic rough-point allowance/i);
    expect(quote?.helper).toMatch(/not a \$300 homerun card/i);
    expect(quote?.total).toBeLessThan(20 * 300);

    const priced = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        itemQuantities: {
          electrical_rough: {
            quantity: '20',
            unit: 'each',
            quantitySource: 'user_entered',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          itemQuantities: {
            electrical_rough: {
              quantity: 20,
              unit: 'each',
              quantitySource: 'user_entered',
            },
          },
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(priced.fill?.total).toBe(5000);
    expect(priced.fill?.productionStatus).toBe('production_ready');
    expect(priced.fill?.pricingRecordId).toBe(
      'bps_electrical_rough:electrical_rough'
    );
  });

  it('does not invent a rough price from living SF', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        electricalIncludeRough: true,
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          electricalIncludeRough: true,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill?.total).toBe(10000);
    expect(pricing.fill?.basis?.unit).toBe('allowance');
    expect(pricing.fill?.productionStatus).toBe('review_required');
    expect(pricing.fill?.pricingRecordId).toBe(
      'bps_electrical_rough:electrical_rough'
    );
  });

  it('does not auto-price rough when detailed 2A–2I counts exist', () => {
    expect(
      shouldAutoPriceElectricalRoughPackage(
        { electricalIncludeRough: true, standardCircuitCount: 8 },
        'electrical'
      )
    ).toBe(false);
    expect(
      shouldAutoPriceElectricalRoughPackage(
        { electricalIncludeRough: true, standardReceptacleCount: 12 },
        'electrical'
      )
    ).toBe(false);
    expect(
      shouldAutoPriceElectricalRoughPackage(
        { electricalIncludeRough: true, mainPanelCount: 1 },
        'electrical'
      )
    ).toBe(false);

    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        electricalIncludeRough: true,
        standardReceptacleCount: '12',
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          electricalIncludeRough: true,
          standardReceptacleCount: 12,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });

  it('parses rough-in language without inventing circuit or device counts', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Electrical: electrical rough-in'
    );
    expect(parsed.electricalIncludeRough).toBe(true);
    expect(parsed.standardCircuitCount).toBeUndefined();
    expect(parsed.standardReceptacleCount).toBeUndefined();
    expect(
      shouldAutoPriceElectricalRoughPackage(
        parsed as Record<string, unknown>,
        'electrical'
      )
    ).toBe(true);
  });

  it('does not activate the $10,000 package from a vague electrical-work note', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Need some electrical work'
    );
    expect(parsed.electricalIncludeRough).toBeUndefined();
    expect(
      shouldAutoPriceElectricalRoughPackage(
        parsed as Record<string, unknown>,
        'electrical'
      )
    ).toBe(false);

    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({ floorAreaSqft: '1879' }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({ floorAreaSqft: 1879 }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });

  it('lets rough and trim packages stack when no detailed 2A–2I counts exist', () => {
    const input = inputWith({
      electricalIncludeRough: true,
      electricalIncludeTrim: true,
    });
    const rough = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      input,
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          electricalIncludeRough: true,
          electricalIncludeTrim: true,
        }),
        { templateKey: 'electrical' }
      )
    );
    const trim = resolveScopeItemSuggestedPricing(
      'electrical_trim',
      input,
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_trim',
        normalizeScopeMeasurements({
          electricalIncludeRough: true,
          electricalIncludeTrim: true,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(rough.fill?.total).toBe(10000);
    expect(trim.fill?.total).toBe(2500);
    expect(
      resolveStep2PricingTier('electrical_rough', 'electrical').tier
    ).toBe('auto_planning');
  });

  it('does not create a 2B circuit card from a rough package', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Electrical: include rough-in and trim-out'
    );
    expect(parsed.electricalIncludeRough).toBe(true);
    expect(parsed.electricalIncludeTrim).toBe(true);
    expect(parsed.standardCircuitCount).toBeUndefined();
    expect(parsed.dedicated20aCircuitCount).toBeUndefined();
  });
});
