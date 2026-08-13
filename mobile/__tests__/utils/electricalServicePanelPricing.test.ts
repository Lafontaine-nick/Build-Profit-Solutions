import {
  electricalServicePanelCardShouldPrice,
  quoteElectricalServicePanel,
  resolveElectricalServicePanelSuggestedPricing,
  snapElectricalAmperageTier,
} from '@/utils/subcontractorTrade/electricalServicePanelPricing';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsPayloadForPersist,
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

describe('electrical Phase 2A service/panel pricing', () => {
  it('snaps amperage onto the service/panel tiers', () => {
    expect(snapElectricalAmperageTier(200, 'electrical_main_panel')).toBe(200);
    expect(snapElectricalAmperageTier(90, 'electrical_subpanel')).toBe(100);
    expect(snapElectricalAmperageTier(400, 'electrical_service_upgrade')).toBe(400);
  });

  it('quotes a new indoor 200A main panel at the proposed split', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({
      material: 850,
      labor: 1200,
      total: 2050,
      amperageTier: 200,
      specialty: false,
    });
  });

  it('applies job condition to labor only', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(quote?.material).toBe(850);
    expect(quote?.labor).toBe(1680);
    expect(quote?.total).toBe(2530);
  });

  it('defaults an unspecified 200A service upgrade to the increase split', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_service_upgrade',
      quantity: 1,
      serviceAmperage: 200,
    });
    expect(quote).toMatchObject({ material: 2000, labor: 3250, total: 5250 });
  });

  it('uses the replacement split for same-size 200A service work', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_service_upgrade',
      quantity: 1,
      serviceAmperage: 200,
      existingServiceAmperage: 200,
    });
    expect(quote).toMatchObject({ material: 1600, labor: 2400, total: 4000 });
  });

  it('prices a 100A to 200A service upgrade without stacking panel cards', () => {
    const service = quoteElectricalServicePanel({
      itemId: 'electrical_service_upgrade',
      quantity: 1,
      serviceAmperage: 200,
      existingServiceAmperage: 100,
      quantitySource: 'notes',
      serviceUpgradeCount: 1,
    });
    expect(service).toMatchObject({
      material: 2000,
      labor: 3250,
      total: 5250,
    });
    expect(
      electricalServicePanelCardShouldPrice('electrical_main_panel', {
        itemId: 'electrical_main_panel',
        quantity: 1,
        quantitySource: 'notes',
        serviceUpgradeCount: 1,
        mainPanelCount: 1,
      })
    ).toBe(false);
    expect(
      electricalServicePanelCardShouldPrice('electrical_panel_upgrade', {
        itemId: 'electrical_panel_upgrade',
        quantity: 1,
        quantitySource: 'notes',
        serviceUpgradeCount: 1,
        panelUpgradeCount: 1,
      })
    ).toBe(false);
    expect(
      quoteElectricalServicePanel({
        itemId: 'electrical_main_panel',
        quantity: 1,
        quantitySource: 'notes',
        serviceUpgradeCount: 1,
        serviceAmperage: 200,
      })
    ).toBeNull();
  });

  it('still prices an independently selected main panel beside a service upgrade', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      quantitySource: 'user_entered',
      serviceUpgradeCount: 1,
      serviceAmperage: 200,
    });
    expect(quote?.total).toBe(2050);
  });

  it('keeps a subpanel independent', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_subpanel',
      quantity: 1,
      serviceAmperage: 100,
      serviceUpgradeCount: 1,
      quantitySource: 'notes',
    });
    expect(quote).toMatchObject({ material: 350, labor: 575, total: 925 });
  });

  it('does not add a meter/main adder on service upgrade', () => {
    const withCombo = quoteElectricalServicePanel({
      itemId: 'electrical_service_upgrade',
      quantity: 1,
      serviceAmperage: 200,
      existingServiceAmperage: 100,
      electricalMeterMainCombo: true,
    });
    const withoutCombo = quoteElectricalServicePanel({
      itemId: 'electrical_service_upgrade',
      quantity: 1,
      serviceAmperage: 200,
      existingServiceAmperage: 100,
      electricalMeterMainCombo: false,
    });
    expect(withCombo?.total).toBe(withoutCombo?.total);
  });

  it('marks 400A as a specialty review tier', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 400,
    });
    expect(quote?.specialty).toBe(true);
    expect(quote?.helper).toMatch(/specialty/i);
    expect(resolveElectricalServicePanelSuggestedPricing({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 400,
    }).fill?.productionStatus).toBe('review_required');
  });

  it('wires Confirm Scope proposed pricing for service/panel only', () => {
    const saved = scopeMeasurementsPayloadForPersist(
      inputWith({
        serviceUpgradeCount: '1',
        serviceAmperage: '200',
        existingServiceAmperage: '100',
        electricalProjectCondition: 'new_construction',
      }),
      { templateKey: 'electrical' }
    );
    const restored = inputWith({
      ...saved,
      serviceUpgradeCount: '1',
      serviceAmperage: '200',
      existingServiceAmperage: '100',
      electricalProjectCondition: 'new_construction',
      itemQuantities: {
        electrical_service_upgrade: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'notes',
        },
      },
    });
    const servicePricing = resolveScopeItemSuggestedPricing(
      'electrical_service_upgrade',
      restored,
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_service_upgrade',
        normalizeScopeMeasurements(saved),
        { templateKey: 'electrical' }
      )
    );
    expect(servicePricing.fill?.total).toBe(5250);
    expect(servicePricing.fill?.rateSourceLabel).toMatch(/100–200A approved/i);
    expect(servicePricing.fill?.productionStatus).toBe('production_ready');
    expect(resolveStep2PricingTier('electrical_service_upgrade', 'electrical').tier).toBe(
      'auto_planning'
    );
  });

  it('does not put rates on electrical_rough', () => {
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
});
