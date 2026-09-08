jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  buildNormalizedScopeMeasurementsFromInput,
  prepareScopeMeasurementsInputForUi,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  seedAdditionConversionPhysicalMeasurements,
} from '@/utils/scopeItemQuantities';
import {
  conversionDrywallSurfaceSqft,
  conversionWallFramingLf,
  consolidateExistingShellConversionMeasurements,
  estimateExistingShellConversionRoughCircuits,
  existingShellConversionElectricalBreakdown,
} from '@/utils/additionConversionPlanning';
import { getQuickMeasurementEstimate } from '@/utils/quickMeasurementEstimates';
import {
  applyAdditionConversionScopeDefaults,
  applyScopeInferencesFromNotes,
  hydrateScopeChecklistFromNotes,
} from '@/utils/estimateScopeChecklistUi';

const GARAGE_OFFICE_NOTES =
  'Convert 2-car garage to office/studio, about 400 sqft. Insulate walls and ceiling, drywall hang and finish, paint, add 4 recessed lights and a few outlets, mini split HVAC. Keep existing garage door for now.';

function additionChecklistItems() {
  return [
    'framing',
    'wall_framing',
    'exterior_finishes',
    'insulation',
    'drywall',
    'paint',
    'flooring',
    'interior_trim',
    'electrical_rough',
    'electrical_trim',
    'hvac',
    'cleanup',
  ].map(id => ({
    id,
    label: id,
    inputType: 'yes_no' as const,
    state: 'unsure' as const,
  }));
}

describe('addition conversion pricing parity', () => {
  it('uses shell surface SF for conversion drywall — not floor area', () => {
    expect(conversionDrywallSurfaceSqft(400)).toBe(944);
    expect(conversionWallFramingLf(400)).toBe(68);
  });

  it('does not price inferred wall framing unless notes request framing', () => {
    const input = buildNormalizedScopeMeasurementsFromInput({
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '400',
      wallFramingLf: '68',
    });
    const quantity = resolveChecklistItemQuantity('wall_framing', input, {
      templateKey: 'addition',
      projectType: 'garage_conversion',
      notes: GARAGE_OFFICE_NOTES,
    });
    expect(quantity.quantity).toBeNull();
    expect(quantity.pricingReady).toBe(false);
  });

  it('seeds drywall, paint, flooring, insulation, and wall framing QM from conversion floor area', () => {
    const seeded = seedAdditionConversionPhysicalMeasurements(
      {
        ...emptyQuickMeasurementInput(),
        floorAreaSqft: '400',
      },
      {
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes: GARAGE_OFFICE_NOTES,
      }
    );

    expect(Number(seeded.drywallSqft)).toBe(944);
    expect(Number(seeded.wallPaintSqft)).toBe(944);
    expect(Number(seeded.flooringSqft)).toBe(400);
    expect(Number(seeded.atticInsulationSqft)).toBe(400);
    expect(Number(seeded.exteriorWallInsulationSqft)).toBeGreaterThan(0);
    expect(Number(seeded.wallFramingLf)).toBe(68);
  });

  it('suggests flooring sqft from conversion living area in Quick Measurements', () => {
    const estimate = getQuickMeasurementEstimate(
      'flooringSqft',
      { floorAreaSqft: '400' },
      undefined,
      'addition'
    );
    expect(estimate?.value).toBe(400);
    expect(estimate?.formulaId).toBe('flooring_from_conditioned_floor_area');
  });

  it('suggests conversion shell drywall instead of floor area or 3.5× multiplier', () => {
    const estimate = getQuickMeasurementEstimate(
      'drywallSqft',
      { floorAreaSqft: '400' },
      undefined,
      'addition',
      { projectType: 'garage_conversion', notes: GARAGE_OFFICE_NOTES }
    );
    expect(estimate?.value).toBe(944);
    expect(estimate?.formulaId).toBe('conversion_shell_drywall_surface');
  });

  it('replaces a stale 3.5x drywall quantity on existing-shell conversions', () => {
    const quantity = resolveChecklistItemQuantity(
      'drywall',
      {
        ...emptyQuickMeasurementInput(),
        floorAreaSqft: '400',
        drywallSqft: '1400',
      },
      {
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes: GARAGE_OFFICE_NOTES,
      }
    );
    expect(quantity.quantity).toBe(944);
    expect(quantity.quantitySource).toBe('inferred');
  });

  it('uses mini-split pricing for existing-shell conversion HVAC notes', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '400',
      hvacSystemCount: '1',
    };
    const quantity = resolveChecklistItemQuantity('hvac', input, {
      templateKey: 'addition',
      projectType: 'garage_conversion',
      notes: GARAGE_OFFICE_NOTES,
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'hvac',
      input,
      'addition',
      quantity,
      { checklistItems: additionChecklistItems(), notes: GARAGE_OFFICE_NOTES },
      null,
      GARAGE_OFFICE_NOTES
    );
    expect(pricing.fill?.total).toBe(7500);
    expect(pricing.fill?.displayQuantityLine).toBe('1 mini-split system');
  });

  it('uses mini-split pricing even when the checklist starts on generic HVAC', () => {
    const notes = 'Install one mini-split HVAC system with dedicated electrical.';
    const input = {
      ...emptyQuickMeasurementInput(),
      hvacSystemCount: '1',
      itemQuantities: {},
    };
    const quantity = resolveChecklistItemQuantity('hvac', input, {
      templateKey: 'ground_up',
      notes,
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'hvac',
      input,
      'ground_up',
      quantity,
      { checklistItems: [{ id: 'hvac', state: 'included' }], notes },
      null,
      notes
    );
    expect(pricing.fill?.total).toBe(7500);
    expect(pricing.fill?.displayQuantityLine).toBe('1 mini-split system');
  });

  it('uses scope notes when the modal does not pass original notes separately', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      hvacSystemCount: '1',
      scopeNotes: 'Convert the garage to an office with a mini split HVAC system.',
    };
    const quantity = resolveChecklistItemQuantity('hvac', input, {
      templateKey: 'addition',
      notes: input.scopeNotes,
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'hvac',
      input,
      'addition',
      quantity,
      { checklistItems: [{ id: 'hvac', state: 'included' }] },
      null
    );
    expect(pricing.fill?.total).toBe(7500);
    expect(pricing.fill?.displayQuantityLine).toBe('1 mini-split system');
  });

  it('uses the structured mini-split HVAC selection when notes text is summarized', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      hvacSystemCount: '1',
      scopeNotes: 'Convert the garage to an office.',
      tradeScopeSelections: { hvac: ['mini_split'] },
    };
    const quantity = resolveChecklistItemQuantity('hvac', input, {
      templateKey: 'addition',
      notes: input.scopeNotes,
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'hvac',
      input,
      'addition',
      quantity,
      { checklistItems: [{ id: 'hvac', state: 'included' }] },
      null
    );
    expect(pricing.fill?.total).toBe(7500);
    expect(pricing.fill?.displayQuantityLine).toBe('1 mini-split system');
  });

  it('derives conversion interior trim area from measured interior doors', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '400',
      interiorDoorCount: '2',
    };
    const quantity = resolveChecklistItemQuantity('interior_trim', input, {
      templateKey: 'addition',
      projectType: 'garage_conversion',
      notes: GARAGE_OFFICE_NOTES,
    });
    expect(quantity.quantity).toBe(40);
    expect(quantity.unit).toBe('sqft');
    expect(quantity.quantitySource).toBe('inferred');
    expect(quantity.quantityHelper).toContain('2 interior doors');

    const pricing = resolveScopeItemSuggestedPricing(
      'interior_trim',
      input,
      'addition',
      quantity,
      { checklistItems: additionChecklistItems(), notes: GARAGE_OFFICE_NOTES },
      null,
      GARAGE_OFFICE_NOTES
    );
    expect(pricing.fill?.total).toBeGreaterThan(0);
    expect(pricing.fill?.material).toBeGreaterThan(0);
    expect(pricing.fill?.labor).toBeGreaterThan(0);
    expect(pricing.fill?.pricingDetail).toMatch(/paint|preparation/i);
  });

  it('prices a calculated trim quantity when the door count is already persisted', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '400',
      itemQuantities: {
        interior_trim: {
          quantity: '40',
          unit: 'sqft',
          quantitySource: 'inferred',
        },
      },
    };
    const pricing = resolveScopeItemSuggestedPricing(
      'interior_trim',
      input,
      'addition',
      {
        quantity: 40,
        unit: 'sqft',
        quantitySource: 'inferred',
      },
      { checklistItems: additionChecklistItems() },
      null
    );
    expect(pricing.fill?.total).toBeGreaterThan(0);
  });

  it('clears mistaken floor-area drywall on hydrate', () => {
    const prepared = prepareScopeMeasurementsInputForUi(
      {
        ...emptyQuickMeasurementInput(),
        floorAreaSqft: '400',
        drywallSqft: '400',
      },
      {
        notes: GARAGE_OFFICE_NOTES,
        templateKey: 'addition',
        projectType: 'garage_conversion',
      }
    );
    expect(Number(prepared.drywallSqft)).toBe(944);
    expect(Number(prepared.wallPaintSqft)).toBe(944);
  });

  it('prepareScopeMeasurementsInputForUi seeds flooring for garage conversion', () => {
    const prepared = prepareScopeMeasurementsInputForUi(
      {
        ...emptyQuickMeasurementInput(),
        floorAreaSqft: '400',
      },
      {
        notes: GARAGE_OFFICE_NOTES,
        templateKey: 'addition',
        projectType: 'garage_conversion',
      }
    );
    expect(Number(prepared.flooringSqft)).toBe(400);
  });

  it('resolves LF wall framing — not shell SF — for garage conversion', () => {
    const checklist = applyScopeInferencesFromNotes(
      additionChecklistItems(),
      GARAGE_OFFICE_NOTES,
      'addition',
      undefined,
      'garage_conversion'
    );
    const measurements = buildNormalizedScopeMeasurementsFromInput(
      {
        ...emptyQuickMeasurementInput(),
        floorAreaSqft: '400',
        wallFramingLf: '68',
      },
      {
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes: GARAGE_OFFICE_NOTES,
      }
    );

    expect(checklist.find(item => item.id === 'framing')?.state).toBe('excluded');
    expect(checklist.find(item => item.id === 'wall_framing')?.state).toBe(
      'included'
    );

    const wallFramingQty = resolveChecklistItemQuantity(
      'wall_framing',
      measurements,
      {
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes: GARAGE_OFFICE_NOTES,
      }
    );
    expect(wallFramingQty.pricingReady).toBe(true);
    expect(wallFramingQty.unit).toBe('lf');
    expect(Number(wallFramingQty.quantity)).toBe(68);

    const wallFramingPricing = resolveScopeItemSuggestedPricing(
      'wall_framing',
      {
        ...emptyQuickMeasurementInput(),
        floorAreaSqft: '400',
        wallFramingLf: '68',
        quickMeasurementSources: measurements.quickMeasurementSources,
      },
      'addition',
      wallFramingQty,
      { checklistItems: checklist, notes: GARAGE_OFFICE_NOTES },
      null,
      GARAGE_OFFICE_NOTES
    );
    expect(wallFramingPricing.fill?.total).toBe(816);

    for (const itemId of ['drywall', 'insulation', 'flooring'] as const) {
      const row = checklist.find(item => item.id === itemId);
      expect(row?.state).toBe('included');
      const qty = resolveChecklistItemQuantity(itemId, measurements, {
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes: GARAGE_OFFICE_NOTES,
      });
      expect(qty.pricingReady).toBe(true);
      expect(Number(qty.quantity)).toBeGreaterThan(0);
      expect(qty.unit).toBe('sqft');

      const pricing = resolveScopeItemSuggestedPricing(
        itemId,
        {
          ...emptyQuickMeasurementInput(),
          floorAreaSqft: '400',
          drywallSqft: measurements.drywallSqft,
          wallPaintSqft: measurements.wallPaintSqft,
          flooringSqft: measurements.flooringSqft,
          atticInsulationSqft: measurements.atticInsulationSqft,
          exteriorWallInsulationSqft: measurements.exteriorWallInsulationSqft,
          quickMeasurementSources: measurements.quickMeasurementSources,
        },
        'addition',
        qty,
        { checklistItems: checklist, notes: GARAGE_OFFICE_NOTES },
        null,
        GARAGE_OFFICE_NOTES
      );
      expect(pricing.fill?.total).toBeGreaterThan(0);
    }
  });

  it('rolls garage conversion electrical into rough package circuits', () => {
    const circuits = estimateExistingShellConversionRoughCircuits({
      recessedLightCount: 4,
      standardReceptacleCount: 3,
      hvacHookupCount: 1,
      itemQuantities: {
        electrical_recessed_light: { quantity: 4 },
        electrical_standard_receptacle: { quantity: 3 },
        electrical_hvac_hookup: { quantity: 1 },
      },
    });
    expect(circuits).toBe(3);
  });

  it('explains the garage conversion electrical rollup without changing its total', () => {
    const breakdown = existingShellConversionElectricalBreakdown({
      recessedLightCount: 4,
      standardReceptacleCount: 5,
      hvacHookupCount: 1,
    });
    expect(breakdown).toMatchObject({
      lights: 4,
      lightCircuits: 1,
      receptacles: 5,
      receptacleCircuits: 1,
      dedicatedHookups: 1,
      total: 3,
    });
    expect(breakdown.total).toBe(
      estimateExistingShellConversionRoughCircuits({
        recessedLightCount: 4,
        standardReceptacleCount: 5,
        hvacHookupCount: 1,
      })
    );
  });

  it('strips granular electrical line items for existing-shell conversion hydrate', () => {
    const measurements = consolidateExistingShellConversionMeasurements(
      {
        ...emptyQuickMeasurementInput(),
        floorAreaSqft: '400',
        recessedLightCount: '4',
        standardReceptacleCount: '3',
        hvacHookupCount: '1',
        itemQuantities: {
          electrical_recessed_light: { quantity: 4, unit: 'each' },
          electrical_standard_receptacle: { quantity: 3, unit: 'each' },
          electrical_hvac_hookup: { quantity: 1, unit: 'each' },
        },
      },
      {
        templateKey: 'addition',
        projectType: 'garage_conversion',
        notes: GARAGE_OFFICE_NOTES,
      }
    );
    expect(measurements.itemQuantities?.electrical_recessed_light).toBeUndefined();
    expect(Number(measurements.itemQuantities?.electrical_rough?.quantity)).toBe(
      3
    );
  });

  it('hydrate keeps one paint card and package electrical only', () => {
    const checklist = additionChecklistItems();
    const hydrated = hydrateScopeChecklistFromNotes(
      checklist,
      'addition',
      GARAGE_OFFICE_NOTES,
      {
        ...emptyQuickMeasurementInput(),
        floorAreaSqft: '400',
        recessedLightCount: '4',
        standardReceptacleCount: '3',
        itemQuantities: {
          electrical_recessed_light: { quantity: 4, unit: 'each' },
          interior_paint: { quantity: 944, unit: 'sqft' },
        },
      },
      'garage_conversion'
    );
    const ids = hydrated.map(item => item.id);
    expect(ids).toContain('paint');
    expect(ids).not.toContain('interior_paint');
    expect(ids).not.toContain('electrical_recessed_light');
    expect(ids).toContain('electrical_rough');
    expect(hydrated.find(item => item.id === 'electrical_trim')?.state).toBe(
      'excluded'
    );
  });

  it('defaults room addition checklist with full shell framing', () => {
    const notes = '400 sqft bedroom addition off the back of the house.';
    const next = applyAdditionConversionScopeDefaults(additionChecklistItems(), {
      templateKey: 'addition',
      projectType: 'room_addition',
      notes,
    });
    const included = next.filter(item => item.state === 'included').map(item => item.id);
    expect(included).toEqual(
      expect.arrayContaining(['framing', 'drywall', 'insulation', 'flooring'])
    );
    expect(included).not.toContain('wall_framing');
  });
});
