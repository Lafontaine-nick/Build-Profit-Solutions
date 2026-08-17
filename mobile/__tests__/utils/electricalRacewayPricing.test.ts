import { quoteElectricalRaceway } from '@/utils/subcontractorTrade/electricalRacewayPricing';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { parseElectricalMeasurementsFromNotes } from '@/utils/subcontractorTrade/electricalPlanConvergence';
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

describe('electrical Phase 2I conduit / trenching pricing', () => {
  it('quotes 80 LF conduit + 40 LF normal trench at the locked $7/$10 split', () => {
    const conduit = quoteElectricalRaceway({
      itemId: 'electrical_conduit',
      quantity: 80,
      electricalProjectCondition: 'new_construction',
    });
    const trench = quoteElectricalRaceway({
      itemId: 'electrical_trenching',
      quantity: 40,
      electricalProjectCondition: 'new_construction',
      electricalTrenchCondition: 'normal_soil',
    });
    expect(conduit).toMatchObject({
      material: 240,
      labor: 320,
      total: 560,
      unit: 'lf',
      specialty: false,
    });
    expect(trench).toMatchObject({
      material: 40,
      labor: 360,
      total: 400,
      unit: 'lf',
      specialty: false,
    });
    expect((conduit?.total || 0) + (trench?.total || 0)).toBe(960);
    expect(conduit?.helper).toMatch(/homerun not included/i);
    expect(trench?.helper).toMatch(/not conduit/i);
    expect(conduit?.helper).toMatch(/approved split/i);
    expect(trench?.helper).toMatch(/normal soil/i);
    expect(conduit?.pricingDetail).toMatch(
      /finished-wall condition affects labor only/i
    );
    expect(trench?.pricingDetail).toMatch(/does not change trenching labor/i);
  });

  it('prices 100 LF of standard conduit at $700 before condition modifiers', () => {
    expect(
      quoteElectricalRaceway({
        itemId: 'electrical_conduit',
        quantity: 100,
        electricalProjectCondition: 'new_construction',
      })
    ).toMatchObject({
      material: 300,
      labor: 400,
      total: 700,
    });
  });

  it('prices 100 LF of normal-soil trenching at $1,000', () => {
    expect(
      quoteElectricalRaceway({
        itemId: 'electrical_trenching',
        quantity: 100,
        electricalProjectCondition: 'finished_wall_service',
        electricalTrenchCondition: 'normal_soil',
      })
    ).toMatchObject({
      material: 100,
      labor: 900,
      total: 1000,
      laborMultiplier: 1,
    });
  });

  it('applies finished-wall labor only to conduit, never to trenching', () => {
    const conduit = quoteElectricalRaceway({
      itemId: 'electrical_conduit',
      quantity: 80,
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(conduit?.material).toBe(240);
    expect(conduit?.labor).toBe(448);
    expect(conduit?.total).toBe(688);
    expect(conduit?.laborMultiplier).toBe(1.4);

    const trench = quoteElectricalRaceway({
      itemId: 'electrical_trenching',
      quantity: 40,
      electricalProjectCondition: 'finished_wall_service',
      electricalTrenchCondition: 'normal_soil',
    });
    expect(trench?.material).toBe(40);
    expect(trench?.labor).toBe(360);
    expect(trench?.total).toBe(400);
    expect(trench?.laborMultiplier).toBe(1);
  });

  it('does not apply remodel open-wall labor to conduit or trench', () => {
    const conduit = quoteElectricalRaceway({
      itemId: 'electrical_conduit',
      quantity: 80,
      electricalProjectCondition: 'remodel_open_wall',
    });
    expect(conduit?.labor).toBe(320);
    expect(conduit?.laborMultiplier).toBe(1);

    const trench = quoteElectricalRaceway({
      itemId: 'electrical_trenching',
      quantity: 40,
      electricalProjectCondition: 'remodel_open_wall',
    });
    expect(trench?.labor).toBe(360);
    expect(trench?.laborMultiplier).toBe(1);
  });

  it('does not invent LF or a price from a bare conduit flag', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Electrical: include conduit and trenching'
    );
    expect(parsed.electricalConduit).toBe(true);
    expect(parsed.electricalTrenching).toBe(true);
    expect(parsed.conduitLf).toBeUndefined();
    expect(parsed.trenchingLf).toBeUndefined();

    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_conduit',
      inputWith({ electricalConduit: true }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_conduit',
        normalizeScopeMeasurements({ electricalConduit: true }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
    const trenchPricing = resolveScopeItemSuggestedPricing(
      'electrical_trenching',
      inputWith({ electricalTrenching: true }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_trenching',
        normalizeScopeMeasurements({ electricalTrenching: true }),
        { templateKey: 'electrical' }
      )
    );
    expect(trenchPricing.fill).toBeNull();
  });

  it('parses conduit and trench lengths without stacking a homerun', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Electrical: run 80 ft of conduit and trench 40 feet'
    );
    expect(parsed.conduitLf).toBe(80);
    expect(parsed.trenchingLf).toBe(40);
    expect(parsed.standardCircuitCount).toBeUndefined();
    expect(parsed.electricalConduit).toBe(true);
    expect(parsed.electricalTrenching).toBe(true);
    expect(parsed.electricalTrenchCondition).toBe('normal_soil');
    expect(parsed.electricalConduitSpecialty).toBeUndefined();
  });

  it('keeps rocky trench LF but does not auto-fill the $10 normal-soil rate', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Electrical: trench 40 feet through rocky soil'
    );
    expect(parsed.trenchingLf).toBe(40);
    expect(parsed.electricalTrenchCondition).toBe('rocky');

    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_trenching',
      inputWith({
        trenchingLf: '40',
        electricalTrenchCondition: 'rocky',
        itemQuantities: {
          electrical_trenching: {
            quantity: '40',
            unit: 'lf',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_trenching',
        normalizeScopeMeasurements({
          trenchingLf: 40,
          electricalTrenchCondition: 'rocky',
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });

  it('keeps rigid conduit LF but does not auto-fill the $7 PVC rate', () => {
    const parsed = parseElectricalMeasurementsFromNotes(
      'Electrical: run 80 ft of rigid conduit'
    );
    expect(parsed.conduitLf).toBe(80);
    expect(parsed.electricalConduitSpecialty).toBe(true);

    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_conduit',
      inputWith({
        conduitLf: '80',
        electricalConduitSpecialty: true,
        itemQuantities: {
          electrical_conduit: {
            quantity: '80',
            unit: 'lf',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_conduit',
        normalizeScopeMeasurements({
          conduitLf: 80,
          electricalConduitSpecialty: true,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });

  it('wires Confirm Scope locked PVC / normal-soil pricing when LF exists', () => {
    const conduit = resolveScopeItemSuggestedPricing(
      'electrical_conduit',
      inputWith({
        conduitLf: '80',
        itemQuantities: {
          electrical_conduit: {
            quantity: '80',
            unit: 'lf',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_conduit',
        normalizeScopeMeasurements({ conduitLf: 80 }),
        { templateKey: 'electrical' }
      )
    );
    expect(conduit.fill?.total).toBe(560);
    expect(conduit.fill?.productionStatus).toBe('production_ready');
    expect(conduit.fill?.rateSourceLabel).toMatch(/approved PVC raceway/i);
    expect(conduit.fill?.pricingRecordId).toBe(
      'bps_electrical_raceway:electrical_conduit'
    );

    const trench = resolveScopeItemSuggestedPricing(
      'electrical_trenching',
      inputWith({
        trenchingLf: '40',
        electricalTrenchCondition: 'normal_soil',
        itemQuantities: {
          electrical_trenching: {
            quantity: '40',
            unit: 'lf',
            quantitySource: 'notes',
          },
        },
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_trenching',
        normalizeScopeMeasurements({
          trenchingLf: 40,
          electricalTrenchCondition: 'normal_soil',
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(trench.fill?.total).toBe(400);
    expect((conduit.fill?.total || 0) + (trench.fill?.total || 0)).toBe(960);
    expect(
      resolveStep2PricingTier('electrical_conduit', 'electrical').tier
    ).toBe('auto_planning');
  });

  it('does not put rates on electrical_rough', () => {
    const pricing = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      inputWith({
        conduitLf: '80',
        trenchingLf: '40',
        floorAreaSqft: '1879',
      }),
      'electrical',
      resolveChecklistItemQuantity(
        'electrical_rough',
        normalizeScopeMeasurements({
          conduitLf: 80,
          trenchingLf: 40,
          floorAreaSqft: 1879,
        }),
        { templateKey: 'electrical' }
      )
    );
    expect(pricing.fill).toBeNull();
  });
});
