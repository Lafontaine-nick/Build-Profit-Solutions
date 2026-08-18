import { quoteElectricalSpecialSystem } from '@/utils/subcontractorTrade/electricalSpecialSystemsPricing';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
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

describe('electrical Phase 2G special systems pricing', () => {
  it('quotes hardwired smoke detectors at the locked split', () => {
    const quote = quoteElectricalSpecialSystem({
      itemId: 'electrical_smoke_detector',
      quantity: 4,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 160,
      labor: 440,
      total: 600,
    });
    expect(quote?.helper).toMatch(/homerun not included/i);
    expect(quote?.helper).toMatch(/approved split/i);
  });

  it('quotes camera prewire as a drop only', () => {
    const quote = quoteElectricalSpecialSystem({
      itemId: 'electrical_camera_prewire',
      quantity: 4,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 140,
      labor: 360,
      total: 500,
    });
  });

  it('applies job condition to labor only', () => {
    const quote = quoteElectricalSpecialSystem({
      itemId: 'electrical_cat6_drop',
      quantity: 6,
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(quote?.material).toBe(240);
    expect(quote?.labor).toBe(714);
    expect(quote?.total).toBe(954);
  });

  it('wires Confirm Scope locked pricing for special-system cards only', () => {
    const smoke = resolveScopeItemSuggestedPricing(
      'electrical_smoke_detector',
      inputWith({
        smokeDetectorCount: '4',
        itemQuantities: {
          electrical_smoke_detector: {
            quantity: '4',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_smoke_detector',
        normalizeScopeMeasurements({ smokeDetectorCount: 4 }),
        { templateKey: 'electrical' }
      )
    );
    expect(smoke.fill?.total).toBe(600);
    expect(smoke.fill?.rateSourceLabel).toMatch(/approved device\/drop/i);
    expect(smoke.fill?.productionStatus).toBe('production_ready');
    expect(smoke.fill?.pricingRecordId).toBe(
      'bps_electrical_special:electrical_smoke_detector'
    );

    const camera = resolveScopeItemSuggestedPricing(
      'electrical_camera_prewire',
      inputWith({
        cameraPrewireCount: '4',
        itemQuantities: {
          electrical_camera_prewire: {
            quantity: '4',
            unit: 'each',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_camera_prewire',
        normalizeScopeMeasurements({ cameraPrewireCount: 4 }),
        { templateKey: 'electrical' }
      )
    );
    expect(camera.fill?.total).toBe(500);
    expect(camera.fill?.productionStatus).toBe('production_ready');
    expect(
      resolveStep2PricingTier('electrical_smoke_detector', 'electrical').tier
    ).toBe('auto_planning');
    expect(
      resolveStep2PricingTier('electrical_camera_prewire', 'electrical').tier
    ).toBe('auto_planning');
  });

  it('does not put rates on electrical_rough', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        smokeDetectorCount: '4',
        cat6DropCount: '6',
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          smokeDetectorCount: 4,
          cat6DropCount: 6,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });
});
