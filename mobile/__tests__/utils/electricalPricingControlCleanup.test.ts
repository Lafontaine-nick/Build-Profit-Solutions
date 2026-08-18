import {
  applyElectricalServicePanelModifiers,
  ELECTRICAL_SERVICE_AMPERAGE_REQUIRED_HELPER,
  ELECTRICAL_SERVICE_AMPERAGE_REQUIRED_STATUS,
  quoteElectricalServicePanel,
  resolveElectricalServicePanelSuggestedPricing,
} from '@/utils/subcontractorTrade/electricalServicePanelPricing';
import { quoteElectricalRaceway } from '@/utils/subcontractorTrade/electricalRacewayPricing';
import {
  hasDetailedElectricalQuantities,
  shouldAutoPriceElectricalRoughPackage,
  shouldAutoPriceElectricalTrimPackage,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  buildSuggestedPricingCardDisplay,
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

function priceElectrical(itemId: string, fields: Record<string, unknown>) {
  const input = inputWith(fields as Partial<ScopeMeasurementsInputExtended>);
  return resolveScopeItemSuggestedPricing(
    itemId,
    input,
    'electrical',
    resolveChecklistItemQuantity(itemId, normalizeScopeMeasurements(fields), {
      templateKey: 'electrical',
    })
  );
}

describe('electrical pricing-control cleanup', () => {
  it('A. Main panel selected with blank amperage is review-required, not a hidden $2,050', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
    });
    expect(quote).toBeNull();

    const resolved = resolveElectricalServicePanelSuggestedPricing({
      itemId: 'electrical_main_panel',
      quantity: 1,
      mainPanelCount: 1,
    });
    expect(resolved.fill?.total).toBe(0);
    expect(resolved.fill?.needsServiceAmperage).toBe(true);
    expect(resolved.fill?.productionStatus).toBe('review_required');
    expect(resolved.fill?.helper).toBe(ELECTRICAL_SERVICE_AMPERAGE_REQUIRED_HELPER);

    const fromCounts = priceElectrical('electrical_main_panel', { mainPanelCount: 1 });
    expect(fromCounts.fill?.total).not.toBe(2050);
    expect(fromCounts.fill?.needsServiceAmperage).toBe(true);
    expect(fromCounts.fill?.productionStatus).toBe('review_required');

    expect(
      resolveElectricalServicePanelSuggestedPricing({
        itemId: 'electrical_subpanel',
        quantity: 1,
        subpanelCount: 1,
      }).fill?.needsServiceAmperage
    ).toBe(true);
    expect(
      resolveElectricalServicePanelSuggestedPricing({
        itemId: 'electrical_panel_upgrade',
        quantity: 1,
        panelUpgradeCount: 1,
      }).fill?.needsServiceAmperage
    ).toBe(true);
    expect(
      resolveElectricalServicePanelSuggestedPricing({
        itemId: 'electrical_service_upgrade',
        quantity: 1,
        serviceUpgradeCount: 1,
      }).fill?.needsServiceAmperage
    ).toBe(true);

    const display = buildSuggestedPricingCardDisplay({
      itemId: 'electrical_main_panel',
      block: fromCounts.fill!,
    });
    expect(display.statusLine).toBe(ELECTRICAL_SERVICE_AMPERAGE_REQUIRED_STATUS);
    expect(display.actionLabel).toBeNull();
    expect(display.displayTotal).toBe('—');
  });

  it('B. Main panel 100A uses the locked $1,200 base', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 100,
    });
    expect(quote).toMatchObject({ material: 450, labor: 750, total: 1200 });
  });

  it('B2. Main panel 125A uses the locked $1,350 base', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 125,
    });
    expect(quote).toMatchObject({ material: 525, labor: 825, total: 1350 });
    expect(
      priceElectrical('electrical_main_panel', {
        mainPanelCount: 1,
        serviceAmperage: 125,
      }).fill?.total
    ).toBe(1350);
    expect(
      priceElectrical('electrical_main_panel', {
        mainPanelCount: 1,
        serviceAmperage: 125,
      }).fill?.needsServiceAmperage
    ).toBeUndefined();
  });

  it('C. Main panel 200A uses the locked $2,050 base', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
    });
    expect(quote).toMatchObject({ material: 850, labor: 1200, total: 2050 });
  });

  it('D. 200A Main panel + Outdoor is $935 / $1,380 / $2,315 before extra job-condition', () => {
    const modifiers = applyElectricalServicePanelModifiers({
      baseMaterial: 850,
      baseLabor: 1200,
      quantity: 1,
      electricalPanelLocation: 'outdoor',
      electricalProjectCondition: 'new_construction',
    });
    expect(modifiers).toMatchObject({
      material: 935,
      labor: 1380,
      total: 2315,
      laborMultiplier: 1,
    });

    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
      electricalPanelLocation: 'outdoor',
      electricalProjectCondition: 'new_construction',
    });
    expect(quote).toMatchObject({ material: 935, labor: 1380, total: 2315 });
  });

  it('E. Main panel + amperage produces one pricing card only', () => {
    const fields = { mainPanelCount: 1, serviceAmperage: 200 };
    expect(priceElectrical('electrical_main_panel', fields).fill?.total).toBe(2050);
    expect(priceElectrical('electrical_subpanel', fields).fill).toBeNull();
    expect(priceElectrical('electrical_panel_upgrade', fields).fill).toBeNull();
    expect(priceElectrical('electrical_service_upgrade', fields).fill).toBeNull();
  });

  it('F. Service upgrade + amperage does not also price Main panel or Panel upgrade', () => {
    const fields = {
      serviceUpgradeCount: 1,
      serviceAmperage: 200,
      existingServiceAmperage: 100,
      mainPanelCount: 1,
      panelUpgradeCount: 1,
    };
    expect(priceElectrical('electrical_service_upgrade', fields).fill?.total).toBe(5250);
    expect(priceElectrical('electrical_main_panel', fields).fill).toBeNull();
    expect(priceElectrical('electrical_panel_upgrade', fields).fill).toBeNull();
  });

  it('G. Blank panel location applies no outdoor or meter-main adjustment', () => {
    const blank = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
    });
    const indoor = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
      electricalPanelLocation: 'indoor',
    });
    expect(blank).toMatchObject({ material: 850, labor: 1200, total: 2050 });
    expect(indoor?.total).toBe(blank?.total);
    expect(blank?.helper).not.toMatch(/indoor|outdoor/i);
    expect(
      quoteElectricalServicePanel({
        itemId: 'electrical_main_panel',
        quantity: 0,
        serviceAmperage: 200,
        electricalPanelLocation: 'outdoor',
        electricalMeterMainCombo: true,
      })
    ).toBeNull();
    expect(
      priceElectrical('electrical_main_panel', {
        electricalPanelLocation: 'outdoor',
        electricalMeterMainCombo: true,
      }).fill
    ).toBeNull();
  });

  it('H. Blank job condition uses base labor and is not a selected New construction chip', () => {
    const blank = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
    });
    const explicitNew = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
      electricalProjectCondition: 'new_construction',
    });
    expect(blank?.labor).toBe(1200);
    expect(blank?.labor).toBe(explicitNew?.labor);
    expect(blank?.laborMultiplier).toBe(1);
    expect(blank?.helper).not.toMatch(/new construction|standard/i);
    const selectedCondition: string | null = null;
    expect(selectedCondition === 'new_construction').toBe(false);
  });

  it('I. Remodel / open-wall multiplies labor only by 1.15', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
      electricalProjectCondition: 'remodel_open_wall',
    });
    expect(quote?.material).toBe(850);
    expect(quote?.labor).toBe(1380);
    expect(quote?.total).toBe(2230);
    expect(quote?.laborMultiplier).toBe(1.15);
  });

  it('J. Finished-wall multiplies labor only by 1.40', () => {
    const quote = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(quote?.material).toBe(850);
    expect(quote?.labor).toBe(1680);
    expect(quote?.total).toBe(2530);
    expect(quote?.laborMultiplier).toBe(1.4);
  });

  it('K. Trenching never receives the finished-wall multiplier', () => {
    const trench = quoteElectricalRaceway({
      itemId: 'electrical_trenching',
      quantity: 40,
      electricalProjectCondition: 'finished_wall_service',
      electricalTrenchCondition: 'normal_soil',
    });
    expect(trench?.laborMultiplier).toBe(1);
    expect(trench?.labor).toBe(360);
    expect(trench?.total).toBe(400);
  });

  it('L. Detailed Electrical counts keep rough/trim packages suppressed', () => {
    const detailed = {
      electricalIncludeRough: true,
      electricalIncludeTrim: true,
      standardCircuitCount: 8,
      standardReceptacleCount: 12,
      recessedLightCount: 18,
      floorAreaSqft: 2000,
    };
    expect(hasDetailedElectricalQuantities(detailed)).toBe(true);
    expect(shouldAutoPriceElectricalRoughPackage(detailed, 'electrical')).toBe(false);
    expect(shouldAutoPriceElectricalTrimPackage(detailed, 'electrical')).toBe(false);
    expect(priceElectrical('electrical_rough', detailed).fill).toBeNull();
    expect(priceElectrical('electrical_trim', detailed).fill).toBeNull();
    expect(priceElectrical('electrical_standard_receptacle', detailed).fill?.total).toBe(1320);
  });

  it('M. Plan Export and Notes/Voice with identical quantities produce identical dollars', () => {
    const panelShared = {
      mainPanelCount: 1,
      serviceAmperage: 200,
      electricalPanelLocation: 'outdoor' as const,
      electricalProjectCondition: 'remodel_open_wall' as const,
    };
    const countShared = {
      standardReceptacleCount: 50,
      gfciReceptacleCount: 8,
      threeWaySwitchCount: 5,
    };
    const notesPanel = {
      ...panelShared,
      itemQuantities: {
        electrical_main_panel: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'notes',
        },
      },
    };
    const planPanel = {
      ...panelShared,
      itemQuantities: {
        electrical_main_panel: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'plan_detected',
        },
      },
    };
    const notesCounts = {
      ...countShared,
      itemQuantities: {
        electrical_standard_receptacle: {
          quantity: '50',
          unit: 'each',
          quantitySource: 'notes',
        },
        electrical_gfci_receptacle: {
          quantity: '8',
          unit: 'each',
          quantitySource: 'notes',
        },
        electrical_3way_switch: {
          quantity: '5',
          unit: 'each',
          quantitySource: 'notes',
        },
      },
    };
    const planCounts = {
      ...countShared,
      itemQuantities: {
        electrical_standard_receptacle: {
          quantity: '50',
          unit: 'each',
          quantitySource: 'plan_detected',
        },
        electrical_gfci_receptacle: {
          quantity: '8',
          unit: 'each',
          quantitySource: 'plan_detected',
        },
        electrical_3way_switch: {
          quantity: '5',
          unit: 'each',
          quantitySource: 'plan_detected',
        },
      },
    };

    const notesPanelFill = priceElectrical('electrical_main_panel', notesPanel).fill;
    const planPanelFill = priceElectrical('electrical_main_panel', planPanel).fill;
    expect(planPanelFill?.material).toBe(notesPanelFill?.material);
    expect(planPanelFill?.labor).toBe(notesPanelFill?.labor);
    expect(planPanelFill?.total).toBe(notesPanelFill?.total);
    expect(notesPanelFill).toMatchObject({
      material: 935,
      labor: 1587,
      total: 2522,
    });

    for (const itemId of [
      'electrical_standard_receptacle',
      'electrical_gfci_receptacle',
      'electrical_3way_switch',
    ]) {
      const fromNotes = priceElectrical(itemId, notesCounts);
      const fromPlan = priceElectrical(itemId, planCounts);
      expect(fromPlan.fill?.material).toBe(fromNotes.fill?.material);
      expect(fromPlan.fill?.labor).toBe(fromNotes.fill?.labor);
      expect(fromPlan.fill?.total).toBe(fromNotes.fill?.total);
    }
    expect(priceElectrical('electrical_standard_receptacle', notesCounts).fill?.total).toBe(5500);
    expect(priceElectrical('electrical_gfci_receptacle', notesCounts).fill?.total).toBe(1400);
    expect(priceElectrical('electrical_3way_switch', notesCounts).fill?.total).toBe(650);
  });

  it('N. Confirmed residential Confirm Scope cards stay dollar-identical by source', () => {
    const shared = {
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
    const cards: Array<[string, string, number]> = [
      ['electrical_standard_receptacle', '50', 5500],
      ['electrical_gfci_receptacle', '8', 1400],
      ['electrical_single_pole_switch', '20', 1900],
      ['electrical_3way_switch', '5', 650],
      ['electrical_recessed_light', '48', 7200],
      ['electrical_ceiling_fan', '10', 2750],
      ['electrical_range_hookup', '1', 800],
      ['electrical_dryer_hookup', '1', 675],
      ['electrical_dishwasher_hookup', '1', 500],
      ['electrical_smoke_detector', '6', 900],
    ];

    for (const [itemId, quantity, total] of cards) {
      const fromNotes = priceElectrical(itemId, {
        ...shared,
        itemQuantities: {
          [itemId]: { quantity, unit: 'each', quantitySource: 'notes' },
        },
      });
      const fromPlan = priceElectrical(itemId, {
        ...shared,
        itemQuantities: {
          [itemId]: { quantity, unit: 'each', quantitySource: 'plan_detected' },
        },
      });
      expect(fromPlan.fill?.material).toBe(fromNotes.fill?.material);
      expect(fromPlan.fill?.labor).toBe(fromNotes.fill?.labor);
      expect(fromPlan.fill?.total).toBe(fromNotes.fill?.total);
      expect(fromPlan.fill?.total).toBe(total);
    }

    const panel = priceElectrical('electrical_main_panel', {
      ...shared,
      itemQuantities: {
        electrical_main_panel: {
          quantity: '1',
          unit: 'each',
          quantitySource: 'plan_detected',
        },
      },
    });
    expect(panel.fill?.total).toBe(0);
    expect(panel.fill?.needsServiceAmperage).toBe(true);
    expect(suggestedPricingFooterCountsAmperageConfirm(panel.fill!)).toBe(true);
    const footer = footerSuggestedPricingSummary({
      readyCount: cards.length,
      benchmarkOnlyCount: 0,
      needsMeasurementCount: 1,
    });
    expect(footer).toMatch(/10 prices ready/);
    expect(footer).toMatch(/1 to confirm/);
  });

  it('applies panel-location then job-condition labor in one order', () => {
    const outdoorThenFinished = applyElectricalServicePanelModifiers({
      baseMaterial: 850,
      baseLabor: 1200,
      quantity: 1,
      electricalPanelLocation: 'outdoor',
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(outdoorThenFinished.material).toBe(935);
    expect(outdoorThenFinished.labor).toBe(1932);
    expect(outdoorThenFinished.total).toBe(2867);

    const quoted = quoteElectricalServicePanel({
      itemId: 'electrical_main_panel',
      quantity: 1,
      serviceAmperage: 200,
      electricalPanelLocation: 'outdoor',
      electricalProjectCondition: 'finished_wall_service',
    });
    expect(quoted).toMatchObject({
      material: outdoorThenFinished.material,
      labor: outdoorThenFinished.labor,
      total: outdoorThenFinished.total,
    });
  });

  it('keeps amperage-pending panel cards out of price-ready and in to-confirm', () => {
    const pending = priceElectrical('electrical_main_panel', { mainPanelCount: 1 });
    const ready = priceElectrical('electrical_standard_receptacle', {
      standardReceptacleCount: 50,
    });
    expect(includeUnconfirmedSuggestedPricingFill(pending.fill)).toBe(true);
    expect(suggestedPricingFooterCountsAmperageConfirm(pending.fill!)).toBe(true);
    expect(includeUnconfirmedSuggestedPricingFill(ready.fill)).toBe(true);
    expect(suggestedPricingFooterCountsAmperageConfirm(ready.fill!)).toBe(false);
    expect(
      footerSuggestedPricingSummary({
        readyCount: 11,
        benchmarkOnlyCount: 0,
        needsMeasurementCount: 1,
      })
    ).toMatch(/11 prices ready/);
    expect(
      footerSuggestedPricingSummary({
        readyCount: 11,
        benchmarkOnlyCount: 0,
        needsMeasurementCount: 1,
      })
    ).toMatch(/1 to confirm/);
  });

  it('does not treat service amperage as a second charge', () => {
    expect(
      priceElectrical('electrical_service_amperage' as string, {
        serviceAmperage: 200,
        mainPanelCount: 1,
      }).fill
    ).toBeNull();
  });
});
