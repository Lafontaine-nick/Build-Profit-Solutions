import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { resolveCustomScopeItemPlaceholder } from '@/utils/estimateScopeChecklistUi';
import {
  buildNormalizedScopeMeasurementsFromInput,
  DEFAULT_SCOPE_ALLOWANCE_QUANTITY_RULE,
  getChecklistItemQuantityRuleOrDefault,
  isPlaceholderAllowancePricing,
  isStaleLivingSfPricingBasis,
  resolveAllowanceEditorDefaultBasisUnit,
  resolveAllowanceEditorPricingBasis,
  resolveChecklistItemQuantity,
  isCustomScopePricingApplied,
  resolveCustomScopeDraftPricing,
  customScopeEditorRateValue,
  looksLikeCustomScopeUnitRate,
  resolveInsulationAssemblyLumpBenchmarkComparison,
  resolveInsulationAssemblyNationalRateCardComparison,
  resolveInsulationAssemblyScopeSuggestedPricing,
  primaryQuantityForAppliedSuggestedBlock,
  resolveScopeItemSuggestedPricing,
  resolveInsulationAssemblyRowPricing,
  resolveInsulationAssemblyRowPricingMap,
  resolveTemplateRateForItem,
  templateRateSourceLabel,
  resolveDualRatePricingDisplayFromNotes,
  type ScopeMeasurementsInputExtended,
  type ScopePricingContext,
} from '@/utils/scopeItemQuantities';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

// National-average flooring rate: material $4/sqft, labor $5/sqft.
describe('resolveScopeItemSuggestedPricing', () => {
  it('uses the approved Roofing architectural-shingle baseline and layered tear-off rates', () => {
    const input = inputWith({ roofSquares: '30' });
    const base = resolveScopeItemSuggestedPricing(
      'shingles_roofing',
      input,
      'roofing',
      { quantity: 30, unit: 'squares', quantitySource: 'user_entered' },
      {
        checklistItems: [
          {
            id: 'roofing_system',
            state: 'included',
            choiceId: 'architectural_shingles',
          },
        ],
      }
    );
    expect(base.fill).toMatchObject({
      material: 7500,
      labor: 9750,
      total: 17250,
    });

    const oneLayer = resolveScopeItemSuggestedPricing(
      'tear_off',
      input,
      'roofing',
      { quantity: 30, unit: 'squares', quantitySource: 'user_entered' },
      undefined,
      'one_layer'
    );
    const twoLayer = resolveScopeItemSuggestedPricing(
      'tear_off',
      input,
      'roofing',
      { quantity: 30, unit: 'squares', quantitySource: 'user_entered' },
      undefined,
      'two_layers'
    );
    expect(oneLayer.fill?.total).toBe(5250);
    expect(twoLayer.fill?.total).toBe(7500);

    const specializedTearOffRates = [
      ['three_plus_custom', 9750],
      ['tile_removal', 12000],
      ['metal_removal', 8250],
      ['membrane_removal', 9000],
    ] as const;
    for (const [choiceId, total] of specializedTearOffRates) {
      const specialized = resolveScopeItemSuggestedPricing(
        'tear_off',
        input,
        'roofing',
        { quantity: 30, unit: 'squares', quantitySource: 'user_entered' },
        undefined,
        choiceId
      );
      expect(specialized.fill).toMatchObject({
        total,
        basis: { quantity: 30, unit: 'squares' },
      });
    }
  });

  it('wires the selected Roofing system card to roofSquares', () => {
    const input = inputWith({ roofSquares: '30' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const pricingContext: ScopePricingContext = {
      checklistItems: [
        {
          id: 'roofing_system',
          state: 'included',
          choiceId: 'architectural_shingles',
        },
      ],
    };
    const resolved = resolveChecklistItemQuantity('roofing_system', measurements, {
      templateKey: 'roofing',
      choiceId: 'architectural_shingles',
    });
    const suggested = resolveScopeItemSuggestedPricing(
      'roofing_system',
      input,
      'roofing',
      resolved,
      pricingContext,
      'architectural_shingles'
    );

    expect(resolved).toMatchObject({
      quantity: 30,
      unit: 'squares',
      pricingReady: true,
    });
    expect(suggested.fill).toMatchObject({
      material: 7500,
      labor: 9750,
      total: 17250,
      basis: { quantity: 30, unit: 'squares' },
    });
  });

  it('hides the Roofing system card when its Quick Measurement scope is deselected', () => {
    const input = inputWith({
      roofSquares: '30',
      tradeScopeSelections: { roofing: null },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const pricingContext: ScopePricingContext = {
      checklistItems: [
        {
          id: 'roofing_system',
          state: 'included',
          choiceId: 'architectural_shingles',
        },
      ],
    };
    const resolved = resolveChecklistItemQuantity('roofing_system', measurements, {
      templateKey: 'roofing',
      choiceId: 'architectural_shingles',
    });
    const hidden = resolveScopeItemSuggestedPricing(
      'roofing_system',
      input,
      'roofing',
      resolved,
      pricingContext,
      'architectural_shingles'
    );
    const restored = resolveScopeItemSuggestedPricing(
      'roofing_system',
      inputWith({
        roofSquares: '30',
        tradeScopeSelections: { roofing: ['shingles'] },
      }),
      'roofing',
      resolved,
      pricingContext,
      'architectural_shingles'
    );

    expect(hidden.fill).toBeNull();
    expect(restored.fill?.total).toBe(17250);
  });

  it('keeps alternate Roofing systems on the same roofSquares card path', () => {
    const input = inputWith({ roofSquares: '30' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const rates = [
      ['three_tab_shingles', 15000],
      ['standing_seam_metal', 39000],
      ['tpo', 25500],
    ] as const;

    for (const [choiceId, total] of rates) {
      const pricingContext: ScopePricingContext = {
        checklistItems: [
          { id: 'roofing_system', state: 'included', choiceId },
        ],
      };
      const resolved = resolveChecklistItemQuantity('roofing_system', measurements, {
        templateKey: 'roofing',
        choiceId,
      });
      const suggested = resolveScopeItemSuggestedPricing(
        'roofing_system',
        input,
        'roofing',
        resolved,
        pricingContext,
        choiceId
      );

      expect(suggested.fill?.total).toBe(total);
    }
  });

  it('treats roofing_system roofSquares as an approved squares basis', () => {
    const input = inputWith({ roofSquares: '30' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('roofing_system', measurements, {
      templateKey: 'roofing',
      choiceId: 'three_tab_shingles',
    });

    expect(resolved).toMatchObject({
      quantity: 30,
      unit: 'squares',
      quantitySource: 'inferred',
      pricingReady: true,
    });

    const rule = getChecklistItemQuantityRuleOrDefault('roofing_system', 'roofing');
    expect(rule.allowedUnits).toEqual(
      expect.arrayContaining(['squares', 'sqft', 'lump_sum', 'allowance'])
    );
    expect(rule.measurementKey).toBe('roofSquares');
  });

  it('prices approved Roofing decking, accessories, and repair minimums from dedicated keys', () => {
    const input = inputWith({
      roofDeckingReplacementSqft: '100',
      roofDripEdgeLf: '10',
      roofVentCount: '1',
      roofRepairAffectedSqft: '10',
    });
    const decking = resolveScopeItemSuggestedPricing(
      'decking_repair',
      input,
      'roofing',
      { quantity: 100, unit: 'sqft', quantitySource: 'user_entered' }
    );
    const dripEdge = resolveScopeItemSuggestedPricing(
      'drip_edge',
      input,
      'roofing',
      { quantity: 100, unit: 'lf', quantitySource: 'user_entered' }
    );
    const vent = resolveScopeItemSuggestedPricing(
      'roof_vents',
      input,
      'roofing',
      { quantity: 2, unit: 'each', quantitySource: 'user_entered' }
    );
    const repair = resolveScopeItemSuggestedPricing(
      'roof_repairs',
      input,
      'roofing',
      { quantity: 10, unit: 'sqft', quantitySource: 'user_entered' },
      undefined,
      'light_repair'
    );
    expect(decking.fill?.total).toBe(500);
    expect(dripEdge.fill?.total).toBe(400);
    expect(vent.fill?.total).toBe(450);
    expect(repair.fill?.total).toBe(400);
  });

  it('uses the approved Roofing refinements and keeps canonical rates visible under minimums', () => {
    const price = (
      itemId: string,
      quantity: number,
      unit: string,
      choiceId?: string
    ) =>
      resolveScopeItemSuggestedPricing(
        itemId,
        inputWith({}),
        'roofing',
        { quantity, unit, quantitySource: 'user_entered' },
        undefined,
        choiceId
      ).fill;

    expect(price('decking_repair', 50, 'sqft')).toMatchObject({
      total: 300,
      basis: { quantity: 50, unit: 'sqft' },
    });
    expect(price('decking_repair', 100, 'sqft')).toMatchObject({
      total: 500,
    });
    expect(price('turbine_vents', 3, 'each')).toMatchObject({
      total: 900,
      basis: { quantity: 3, unit: 'each' },
    });

    const dripEdge = price('drip_edge', 50, 'lf');
    expect(dripEdge).toMatchObject({
      total: 250,
      helper: '$250 minimum applied',
    });
    expect(dripEdge?.costBuckets?.map(bucket => bucket.rate)).toEqual([
      1.5,
      2.5,
    ]);

    expect(price('ridge_cap', 50, 'lf')?.total).toBe(350);
    expect(price('valley_flashing', 50, 'lf')?.total).toBe(500);
    expect(price('step_flashing', 50, 'lf')?.total).toBe(600);
    expect(price('wall_flashing', 50, 'lf')?.total).toBe(500);
    expect(price('roof_vents', 3, 'each')?.total).toBe(675);
    expect(price('pipe_boots', 2, 'each')?.total).toBe(350);
    expect(price('chimney_flashing', 3, 'each')?.total).toBe(1950);
    expect(price('skylight_flashing', 3, 'each')?.total).toBe(1500);
    expect(price('roof_repairs', 50, 'sqft', 'light_repair')?.total).toBe(400);
    expect(price('roof_repairs', 50, 'sqft', 'moderate_repair')?.total).toBe(600);

    expect(price('gutters', 150, 'lf')).toMatchObject({
      total: 1500,
      material: 600,
      labor: 900,
    });
    expect(price('gutters', 25, 'lf')).toMatchObject({
      total: 400,
      helper: '$400 minimum applied',
    });
    expect(price('downspouts', 4, 'each')).toMatchObject({
      total: 500,
      material: 200,
      labor: 300,
    });
    expect(price('downspouts', 1, 'each')).toMatchObject({
      total: 250,
      helper: '$250 minimum applied',
    });
    expect(price('roof_repairs', 50, 'sqft', 'full_depth_repair')?.total).toBe(900);
  });

  it('prices Roofing underlayment from roofAreaSqft, not flooring underlaymentSqft', () => {
    const input = inputWith({
      roofAreaSqft: '50',
      underlaymentSqft: '800',
      tradeScopeSelections: { roofing: ['underlayment'] },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('underlayment', measurements, {
      templateKey: 'roofing',
    });
    const suggested = resolveScopeItemSuggestedPricing(
      'underlayment',
      input,
      'roofing',
      resolved
    );

    expect(resolved).toMatchObject({
      quantity: 50,
      unit: 'sqft',
      pricingReady: true,
    });
    expect(suggested.fill).toMatchObject({
      material: 37.5,
      labor: 25,
      total: 62.5,
      basis: { quantity: 50, unit: 'sqft' },
    });
  });

  it('prices Ice & Water Shield from its dedicated roofing quantity', () => {
    const input = inputWith({
      roofAreaSqft: '3000',
      roofIceWaterShieldSqft: '25',
      tradeScopeSelections: { roofing: ['ice_water_shield'] },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('ice_water_shield', measurements, {
      templateKey: 'roofing',
    });
    const suggested = resolveScopeItemSuggestedPricing(
      'ice_water_shield',
      input,
      'roofing',
      resolved
    );

    expect(resolved.quantity).toBe(25);
    expect(suggested.fill).toMatchObject({
      material: 30,
      labor: 20,
      total: 50,
    });
  });

  it('prices Ridge vent by each', () => {
    const input = inputWith({ roofRidgeVentLf: '40' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('ridge_vent', measurements, {
      templateKey: 'roofing',
    });
    const suggested = resolveScopeItemSuggestedPricing(
      'ridge_vent',
      input,
      'roofing',
      resolved
    );

    expect(resolved).toMatchObject({
      quantity: 40,
      unit: 'each',
      pricingReady: true,
    });
    expect(suggested.fill).toMatchObject({
      material: 160,
      labor: 320,
      total: 480,
      basis: { quantity: 40, unit: 'each' },
    });
  });

  it('prices cabinet hardware at $12 material + $15 labor per piece', () => {
    const input = inputWith({
      itemQuantities: {
        floor_prep: { quantity: 1700, unit: 'sqft', quantitySource: 'notes' },
      },
    });
    const one = resolveScopeItemSuggestedPricing(
      'cabinet_hardware',
      input,
      'kitchen',
      {
        quantity: 1,
        unit: 'each',
        quantitySource: 'inferred',
      }
    );
    const twentyFour = resolveScopeItemSuggestedPricing(
      'cabinet_hardware',
      input,
      'kitchen',
      {
        quantity: 24,
        unit: 'each',
        quantitySource: 'inferred',
      }
    );

    expect(one.fill).toMatchObject({ material: 12, labor: 15, total: 27 });
    expect(twentyFour.fill).toMatchObject({
      material: 288,
      labor: 360,
      total: 648,
    });
  });

  it('audits the current excavation national-average suggestion with a defined base-scope profile', () => {
    const input = inputWith({ excavationCy: '50' });
    const resolved = {
      quantity: 50,
      unit: 'cy',
      quantitySource: 'inferred' as const,
    };
    const { fill } = resolveScopeItemSuggestedPricing(
      'excavation',
      input,
      'addition',
      resolved
    );
    expect(fill).toMatchObject({
      material: 250,
      labor: 2250,
      total: 2500,
      materialSource: 'national_average',
      laborSource: 'national_average',
      basis: { quantity: 50, unit: 'cy' },
    });
    expect(fill?.benchmarkScopeProfile).toMatchObject({
      pricingSource: 'national_average',
      geographicBasis: 'national',
      scopeAssumptionsDefined: true,
      audit: {
        quantity: 50,
        unit: 'cy',
        materialRate: 5,
        laborRate: 45,
        equipmentRate: null,
        total: 2500,
      },
    });
    expect(fill?.benchmarkScopeProfile?.scopeAssumptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scopeKey: 'excavation', status: 'included' }),
        expect.objectContaining({ scopeKey: 'haul_off', status: 'excluded' }),
        expect.objectContaining({ scopeKey: 'dump_fees', status: 'excluded' }),
        expect.objectContaining({ scopeKey: 'backfill', status: 'excluded' }),
        expect.objectContaining({ scopeKey: 'compaction', status: 'excluded' }),
        expect.objectContaining({ scopeKey: 'shoring', status: 'excluded' }),
      ])
    );
    expect(fill?.benchmarkScopeProfile?.audit?.rootCause).toMatch(
      /base excavation only/i
    );
  });

  it('splits a lump-sum total into material + labor using the national ratio', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = {
      quantity: 5000,
      unit: 'allowance',
      quantitySource: 'notes' as const,
      dualAllowance: { quantity: 5000, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'flooring',
      input,
      'flooring',
      resolved
    );
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({
      mode: 'note_total_split',
      material: 4000,
      labor: 1000,
      total: 5000,
    });
    expect(fill?.materialSource).toBe('national_average');
  });

  it('prices distinct flooring products and LF add-ons from their own measurements', () => {
    const input = inputWith({
      flooringLvpSqft: '600',
      flooringTileSqft: '400',
      transitionLf: '48',
    });
    const lvp = resolveScopeItemSuggestedPricing(
      'flooring_lvp',
      input,
      'flooring',
      { quantity: 600, unit: 'sqft', quantitySource: 'user_entered' }
    );
    const tile = resolveScopeItemSuggestedPricing(
      'tile_flooring',
      input,
      'flooring',
      { quantity: 400, unit: 'sqft', quantitySource: 'user_entered' }
    );
    const transitions = resolveScopeItemSuggestedPricing(
      'transitions',
      input,
      'flooring',
      { quantity: 48, unit: 'each', quantitySource: 'user_entered' }
    );

    expect(lvp.fill?.total).toBe(4200);
    expect(tile.fill?.total).toBeGreaterThan(0);
    expect(tile.fill?.total).not.toBe(lvp.fill?.total);
    expect(transitions.fill).toMatchObject({
      material: 960,
      labor: 1440,
      total: 2400,
    });
    expect(transitions.fill?.basis?.unit).toBe('each');
  });

  it('uses the launch flooring add-on planning rates and reconciled splits', () => {
    const input = inputWith({
      underlaymentSqft: '800',
      moistureBarrierSqft: '800',
      quarterRoundLf: '50',
    });
    const underlayment = resolveScopeItemSuggestedPricing(
      'underlayment',
      input,
      'flooring',
      {
        quantity: 800,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    const vaporBarrier = resolveScopeItemSuggestedPricing(
      'moisture_barrier',
      input,
      'flooring',
      {
        quantity: 800,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    const quarterRound = resolveScopeItemSuggestedPricing(
      'quarter_round',
      input,
      'flooring',
      {
        quantity: 50,
        unit: 'lf',
        quantitySource: 'user_entered',
      }
    );

    expect(underlayment.fill).toMatchObject({
      material: 600,
      labor: 600,
      total: 1200,
    });
    expect(vaporBarrier.fill).toMatchObject({
      material: 520,
      labor: 480,
      total: 1000,
    });
    expect(quarterRound.fill).toMatchObject({
      material: 75,
      labor: 125,
      total: 200,
    });
  });

  it('prices each transition type from its selected quantity', () => {
    const input = inputWith({
      itemQuantities: {
        transitions__standard_transition: {
          quantity: 2,
          unit: 'each',
          quantitySource: 'user_entered',
        },
        transitions__reducer: {
          quantity: 3,
          unit: 'each',
          quantitySource: 'user_entered',
        },
        transitions__threshold: {
          quantity: 2,
          unit: 'each',
          quantitySource: 'user_entered',
        },
        transitions__custom_transition: {
          quantity: 1,
          unit: 'each',
          quantitySource: 'user_entered',
        },
      },
    });
    const transitions = resolveScopeItemSuggestedPricing(
      'transitions',
      input,
      'flooring',
      { quantity: 8, unit: 'each', quantitySource: 'user_entered' },
      undefined,
      'standard_transition,reducer,threshold,custom_transition'
    );

    expect(transitions.fill).toMatchObject({
      material: 240,
      labor: 305,
      total: 545,
    });
  });

  it('shows saved flooring rates as a comparison instead of splitting a note total into saved material plus remainder', () => {
    const input = inputWith({ floorAreaSqft: '850' });
    const resolved = {
      quantity: 3825,
      unit: 'allowance',
      quantitySource: 'notes' as const,
      dualAllowance: { quantity: 3825, unit: 'allowance' },
    };
    const pricingContext: ScopePricingContext = {
      templates: [
        {
          name: 'LVP Floors',
          materialLineItems: [
            { name: 'LVP plank flooring', unit: 'sqft', unitPrice: 3 },
          ],
          laborLineItems: [
            { name: 'LVP install labor', unit: 'sqft', unitPrice: 4 },
          ],
        },
      ],
    };

    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'flooring',
      input,
      'flooring',
      resolved,
      pricingContext
    );

    expect(fill).toBeNull();
    expect(comparison).toMatchObject({
      material: 2550,
      labor: 3400,
      total: 5950,
      materialSource: 'template',
      laborSource: 'template',
      isComparison: true,
    });
  });

  it('fills the missing labor leg when notes priced only material', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = {
      quantity: 1000,
      unit: 'sqft',
      quantitySource: 'notes' as const,
      dualMaterial: { quantity: 4000, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'flooring',
      input,
      'flooring',
      resolved
    );
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({
      mode: 'fill_missing',
      material: 4000,
      labor: 5000,
    });
    expect(fill?.materialSource).toBe('notes');
    expect(fill?.laborSource).toBe('national_average');
  });

  it('fills the missing material leg when notes priced only labor', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = {
      quantity: 1000,
      unit: 'sqft',
      quantitySource: 'notes' as const,
      dualLabor: { quantity: 3000, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'flooring',
      input,
      'flooring',
      resolved
    );
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({
      mode: 'fill_missing',
      material: 4000,
      labor: 3000,
    });
    expect(fill?.materialSource).toBe('national_average');
    expect(fill?.laborSource).toBe('notes');
  });

  it('splits flooring demo lump totals into material + labor budget tracking', () => {
    const input = inputWith({ floorAreaSqft: '850' });
    const resolved = {
      quantity: 2550,
      unit: 'allowance',
      quantitySource: 'notes' as const,
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'floor_demo',
      input,
      'flooring',
      resolved
    );
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({
      mode: 'note_total_split',
      material: 255,
      labor: 2295,
      total: 2550,
      materialSource: 'national_average',
    });
  });

  it('weights flooring demo pricing by each existing flooring removal area', () => {
    const input = inputWith({
      floorDemoSqft: '100',
      flooringExistingTypes: ['carpet', 'tile'],
      itemQuantities: {
        floor_demo__carpet: { quantity: '60', unit: 'sqft' },
        floor_demo__tile: { quantity: '40', unit: 'sqft' },
      },
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_demo',
      input,
      'flooring',
      {
        quantity: 100,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    expect(fill).toMatchObject({
      material: 57,
      labor: 228,
      total: 285,
    });
    expect(fill?.costBuckets?.[0]).toMatchObject({
      label: 'Equipment, protection, haul-off & disposal',
      rate: 0.57,
    });
  });

  it.each([
    ['lvp', 'floating', 2, 2400],
    ['lvp', 'glue_down', 3.25, 3900],
    ['sheet_vinyl_vct', 'sheet_vinyl', 2.25, 2700],
    ['sheet_vinyl_vct', 'vct', 3.25, 3900],
  ])(
    'prices %s demo subtype %s at the requested rate',
    (type, subtype, rate, total) => {
      const input = inputWith({
        floorDemoSqft: '1200',
        flooringExistingTypes: [type as 'lvp'],
        itemQuantities: {
          [`floor_demo__${type}`]: { quantity: '1200', unit: 'sqft' },
        },
        flooringExistingLvpInstallMethod:
          type === 'lvp' ? (subtype as 'floating' | 'glue_down') : null,
        flooringExistingSheetVinylType:
          type === 'sheet_vinyl_vct'
            ? (subtype as 'sheet_vinyl' | 'vct')
            : null,
      });
      const { fill } = resolveScopeItemSuggestedPricing(
        'floor_demo',
        input,
        'flooring',
        {
          quantity: 1200,
          unit: 'sqft',
          quantitySource: 'user_entered',
        }
      );
      const materialRate =
        type === 'lvp'
          ? subtype === 'glue_down'
            ? 0.55
            : 0.4
          : subtype === 'vct'
            ? 0.6
            : 0.45;
      expect(fill).toMatchObject({
        total,
        material: 1200 * materialRate,
        labor: total - 1200 * materialRate,
      });
      expect(fill?.pricingDetail).toContain(`1,200 SF`);
      expect(fill?.pricingDetail).toContain(`$${rate.toFixed(2)}/SF`);
    }
  );

  it.each([
    ['floating', 7, 8400],
    ['glue_down', 9, 10800],
  ])(
    'updates new LVP installation pricing for %s scope',
    (method, rate, total) => {
      const input = inputWith({
        flooringProductScope: ['lvp'],
        flooringLvpSqft: '1200',
        flooringNewLvpInstallMethod: method as 'floating' | 'glue_down',
      });
      const { fill } = resolveScopeItemSuggestedPricing(
        'flooring_lvp',
        input,
        'flooring',
        {
          quantity: 1200,
          unit: 'sqft',
          quantitySource: 'user_entered',
        }
      );
      expect(fill).toMatchObject({
        total,
        material: method === 'glue_down' ? 5100 : 4200,
      });
      expect(Number(fill?.total || 0) / 1200).toBe(rate);
    }
  );

  it.each([
    ['sheet_vinyl', 5, 3000, 1500, 1500],
    ['vct', 7, 4200, 1800, 2400],
  ])(
    'uses the catalog install split for new %s',
    (type, rate, total, material, labor) => {
      const input = inputWith({
        flooringProductScope: ['sheet_vinyl_vct'],
        flooringSheetVinylSqft: '600',
        flooringNewSheetVinylType: type as 'sheet_vinyl' | 'vct',
      });
      const { fill } = resolveScopeItemSuggestedPricing(
        'flooring_sheet_vinyl',
        input,
        'flooring',
        {
          quantity: 600,
          unit: 'sqft',
          quantitySource: 'user_entered',
        }
      );
      expect(fill).toMatchObject({ total, material, labor });
      expect(Number(fill?.total || 0) / 600).toBe(rate);
    }
  );

  it('uses the catalog carpet and pad install split', () => {
    const input = inputWith({
      flooringProductScope: ['carpet'],
      flooringCarpetSqft: '600',
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'flooring_carpet',
      input,
      'flooring',
      {
        quantity: 600,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    expect(fill).toMatchObject({ total: 3000, material: 2100, labor: 900 });
  });

  it('prices flooring trim as an all-in LF install with prep and paint', () => {
    const input = inputWith({ baseboardLf: '200' });
    const { fill } = resolveScopeItemSuggestedPricing(
      'trim',
      input,
      'flooring',
      {
        quantity: 200,
        unit: 'lf',
        quantitySource: 'user_entered',
      }
    );
    expect(fill).toMatchObject({ total: 1700, material: 400, labor: 1300 });
    expect(fill?.costBuckets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Baseboard / trim material',
          amount: 400,
        }),
        expect.objectContaining({
          label: 'Cut, fit & installation labor',
          amount: 700,
        }),
        expect.objectContaining({
          label: 'Fill nail holes, caulk & light prep',
          amount: 200,
        }),
        expect.objectContaining({
          label: 'Standard finish painting',
          amount: 400,
        }),
      ])
    );
  });

  it('uses per-product tile SF instead of rolled-up flooringSqft for tile install card', () => {
    process.env.EXPO_PUBLIC_BUILD_AI_MEASUREMENT_SEMANTICS_V1 = 'true';
    const input = inputWith({
      flooringProductScope: ['carpet', 'tile'],
      floorAreaSqft: '1700',
      flooringSqft: '1700',
      flooringCarpetSqft: '500',
      flooringTileSqft: '1200',
    });
    const resolved = resolveChecklistItemQuantity('tile_flooring', input, {
      templateKey: 'flooring',
    });
    expect(resolved).toMatchObject({
      quantity: 1200,
      unit: 'sqft',
      pricingReady: true,
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'tile_flooring',
      input,
      'flooring',
      resolved
    );
    expect(fill?.total).toBeGreaterThan(0);
  });

  it('prices carpet and floating LVP demo areas independently', () => {
    const input = inputWith({
      floorDemoSqft: '1700',
      flooringExistingTypes: ['carpet', 'lvp'],
      flooringExistingLvpInstallMethod: 'floating',
      itemQuantities: {
        floor_demo__carpet: { quantity: '500', unit: 'sqft' },
        floor_demo__lvp: { quantity: '1200', unit: 'sqft' },
      },
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_demo',
      input,
      'flooring',
      {
        quantity: 1700,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    expect(fill).toMatchObject({ total: 3275, material: 655, labor: 2620 });
  });

  it.each([
    ['carpet', {}, 1.75, 35, 140],
    ['tile', {}, 4.5, 90, 360],
    ['tile', { notes: 'heavy tile with thick mortar bed' }, 5.5, 110, 440],
    ['solid_hardwood', {}, 4, 65, 335],
    ['engineered_hardwood', {}, 3.5, 55, 295],
    ['laminate', {}, 1.75, 30, 145],
    ['lvp', { flooringExistingLvpInstallMethod: 'floating' }, 2, 40, 160],
    ['lvp', { flooringExistingLvpInstallMethod: 'glue_down' }, 3.25, 55, 270],
    ['lvp', { flooringExistingLvpInstallMethod: 'unknown' }, 2.5, 45, 205],
    [
      'sheet_vinyl_vct',
      { flooringExistingSheetVinylType: 'sheet_vinyl' },
      2.25,
      45,
      180,
    ],
    [
      'sheet_vinyl_vct',
      { flooringExistingSheetVinylType: 'vct' },
      3.25,
      60,
      265,
    ],
    [
      'sheet_vinyl_vct',
      { flooringExistingSheetVinylType: 'unknown' },
      2.75,
      50,
      225,
    ],
    ['unknown', {}, 3, 60, 240],
  ])(
    'keeps %s all-in rate equal to its two components',
    (
      type,
      overrides,
      expectedRate,
      expectedMaterialRate,
      expectedLaborRate
    ) => {
      const notes =
        'notes' in overrides
          ? String((overrides as { notes?: string }).notes || '')
          : null;
      const input = inputWith({
        floorDemoSqft: '100',
        flooringExistingTypes: [type as 'carpet'],
        itemQuantities: {
          [`floor_demo__${type}`]: { quantity: '100', unit: 'sqft' },
        },
        ...(overrides as Partial<ScopeMeasurementsInputExtended>),
      });
      const { fill } = resolveScopeItemSuggestedPricing(
        'floor_demo',
        input,
        'flooring',
        { quantity: 100, unit: 'sqft', quantitySource: 'user_entered' },
        null,
        null,
        notes
      );
      expect(fill).not.toBeNull();
      expect(fill!.total).toBeCloseTo(100 * expectedRate, 2);
      expect(fill!.material).toBeCloseTo(100 * expectedMaterialRate, 2);
      expect(fill!.labor).toBeCloseTo(100 * expectedLaborRate, 2);
      expect(fill!.material + fill!.labor).toBeCloseTo(fill!.total, 2);
    }
  );

  it('prices LVP demo with a reviewable mid-rate when install method is not selected yet', () => {
    const input = inputWith({
      floorDemoSqft: '1200',
      flooringExistingTypes: ['lvp'],
      itemQuantities: { floor_demo__lvp: { quantity: 1200, unit: 'sqft' } },
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_demo',
      input,
      'flooring',
      {
        quantity: 1200,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    expect(fill?.total).toBe(1200 * 2.5);
    expect(fill?.rateSourceLabel).toMatch(/Review before bid/i);
  });

  it.each([
    ['carpet', 'lvp', null, 0.75, 0.75],
    ['carpet', 'tile', null, 1.5, 1.5],
    ['tile', 'lvp', null, 3, 3],
    ['tile', 'tile', null, 3, 3],
    ['sheet_vinyl_vct', 'lvp', 'sheet_vct', 1.5, 1.5],
    ['lvp', 'lvp', 'glue_down', 3, 3],
    ['lvp', 'lvp', 'floating', 0.75, 0.75],
  ])(
    'prices %s to %s floor prep at the correct level',
    (existing, product, vinylMethod, expectedRate, expectedTotalRate) => {
      const severity =
        expectedRate === 0.75
          ? 'light'
          : expectedRate === 1.5
            ? 'medium'
            : expectedRate === 3
              ? 'heavy'
              : 'medium';
      const input = inputWith({
        flooringExistingTypes: [existing as 'carpet'],
        flooringProductScope: [product as 'lvp'],
        flooringExistingLvpInstallMethod:
          existing === 'lvp' ? (vinylMethod as 'floating') : null,
        flooringExistingSheetVinylType:
          existing === 'sheet_vinyl_vct'
            ? (vinylMethod as 'sheet_vinyl')
            : null,
        floorPrepByProduct: {
          [product]: { sqft: 400, severity },
        },
      });
      const { fill } = resolveScopeItemSuggestedPricing(
        'floor_prep',
        input,
        'flooring',
        {
          quantity: 400,
          unit: 'sqft',
          quantitySource: 'user_entered',
        }
      );
      expect(fill?.total).toBe(400 * expectedTotalRate);
      expect(fill?.total / 400).toBe(expectedRate);
    }
  );

  it('applies the level minimum once for a small prep transition', () => {
    const input = inputWith({
      flooringExistingTypes: ['carpet'],
      flooringProductScope: ['lvp'],
      floorPrepByProduct: {
        lvp: { sqft: 100, severity: 'light' },
      },
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 100,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    expect(fill).toMatchObject({ material: 50, labor: 200, total: 250 });
  });

  it('prices only migrated transition rows that match selected products', () => {
    const input = inputWith({
      floorPrepSqft: '1700',
      flooringExistingTypes: ['carpet', 'tile'],
      flooringProductScope: ['carpet', 'tile'],
      floorPrepTransitions: [
        { existingType: 'carpet', newProduct: 'carpet', sqft: 500 },
      ],
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 1700,
        unit: 'sqft',
        quantitySource: 'notes',
      }
    );
    expect(fill?.total).toBe(500 * 0.75);
  });

  it('prices per-product prep when cross-type products are selected', () => {
    const input = inputWith({
      flooringExistingTypes: ['carpet', 'tile'],
      flooringProductScope: ['lvp', 'tile'],
      flooringLvpSqft: '1200',
      flooringTileSqft: '500',
      floorPrepByProduct: {
        lvp: { sqft: 1200, severity: 'light' },
        tile: { sqft: 500, severity: 'heavy' },
      },
      itemQuantities: {
        floor_demo__carpet: {
          quantity: 1200,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        floor_demo__tile: {
          quantity: 500,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
      },
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 1700,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    // tile→tile type-match + carpet→lvp remainder, weighted by install SF
    expect(fill?.total).toBe(500 * 3 + 1200 * 0.75);
  });

  it('infers type-matched floor prep transitions for carpet and tile replacements', () => {
    const input = inputWith({
      flooringExistingTypes: ['carpet', 'tile'],
      flooringProductScope: ['carpet', 'tile'],
      flooringCarpetSqft: '500',
      flooringTileSqft: '1200',
      floorPrepByProduct: {
        carpet: { sqft: 500, severity: 'light' },
        tile: { sqft: 1200, severity: 'heavy' },
      },
      itemQuantities: {
        floor_demo__carpet: {
          quantity: 500,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        floor_demo__tile: {
          quantity: 1200,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
      },
      floorPrepTransitions: [
        { existingType: 'carpet', newProduct: 'carpet', sqft: 500 },
        { existingType: 'tile', newProduct: 'tile', sqft: 1200 },
      ],
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 1700,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    expect(fill?.total).toBe(500 * 0.75 + 1200 * 3);
  });

  it('does not price floor prep from demolition area without confirmed per-product prep', () => {
    const input = inputWith({
      flooringExistingTypes: ['carpet', 'tile'],
      flooringProductScope: ['carpet', 'tile'],
      itemQuantities: {
        floor_demo__carpet: {
          quantity: 500,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        floor_demo__tile: {
          quantity: 1200,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
      },
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 1700,
        unit: 'sqft',
        quantitySource: 'missing',
      }
    );
    expect(fill).toBeNull();
  });

  it('does not auto-price floor prep from notes quantity without per-product confirmation', () => {
    const input = inputWith({
      flooringExistingTypes: ['carpet', 'tile'],
      flooringProductScope: ['carpet', 'tile'],
      flooringCarpetSqft: '500',
      flooringTileSqft: '1200',
      itemQuantities: {
        floor_demo__carpet: {
          quantity: 500,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        floor_demo__tile: {
          quantity: 1200,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
      },
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 1700,
        unit: 'sqft',
        quantitySource: 'notes',
      }
    );
    expect(fill).toBeNull();
  });

  it('marks floor prep included in demo when custom demolition includes substrate prep', () => {
    const input = inputWith({
      flooringDemoIncludesSubstratePrep: 'yes',
      flooringExistingTypes: ['carpet'],
      flooringProductScope: ['carpet'],
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 0,
        unit: 'sqft',
        quantitySource: 'missing',
      }
    );
    expect(fill?.total).toBe(0);
    expect(fill?.pricingDetail).toMatch(/Included in demo/i);
  });

  it('keeps prep pricing visible as review-only when demo coverage is unresolved', () => {
    const input = inputWith({
      flooringDemoIncludesSubstratePrep: 'unsure',
      flooringExistingTypes: ['carpet', 'tile'],
      flooringProductScope: ['carpet', 'tile'],
      flooringCarpetSqft: '500',
      flooringTileSqft: '1200',
      floorPrepByProduct: {
        carpet: { sqft: 500, severity: 'light' },
        tile: { sqft: 1200, severity: 'heavy' },
      },
      itemQuantities: {
        floor_demo__carpet: {
          quantity: 500,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        floor_demo__tile: {
          quantity: 1200,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
      },
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 1700,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    expect(fill?.total).toBe(3975);
    expect(fill?.benchmarkAction).toBe('comparison_only');
    expect(fill?.pricingDetail).toMatch(/Review before bid/i);
  });

  it('does not price notes-only floor prep without product scope confirmation', () => {
    const input = inputWith({
      itemQuantities: {
        floor_prep: { quantity: 1700, unit: 'sqft', quantitySource: 'notes' },
      },
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 1700,
        unit: 'sqft',
        quantitySource: 'notes',
      }
    );
    expect(fill).toBeNull();
  });

  it('prices floor prep when only the normalized prep SF field is present for a single product', () => {
    const input = inputWith({
      floorPrepSqft: '400',
      flooringExistingTypes: ['carpet'],
      flooringProductScope: ['lvp'],
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 400,
        unit: 'sqft',
        quantitySource: 'inferred',
      }
    );
    expect(fill?.total).toBe(400 * 0.75);
  });

  it('prices mixed assigned transitions independently by affected area', () => {
    const input = inputWith({
      floorPrepSqft: '1700',
      flooringExistingTypes: ['carpet', 'sheet_vinyl_vct'],
      flooringProductScope: ['tile', 'lvp'],
      flooringExistingSheetVinylType: 'sheet_vinyl',
      floorPrepTransitions: [
        { existingType: 'carpet', newProduct: 'tile', sqft: 500 },
        { existingType: 'sheet_vinyl_vct', newProduct: 'lvp', sqft: 1200 },
      ],
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'floor_prep',
      input,
      'flooring',
      {
        quantity: 1700,
        unit: 'sqft',
        quantitySource: 'user_entered',
      }
    );
    expect(fill).toMatchObject({ material: 765, labor: 1785, total: 2550 });
  });

  it('shows only a comparison when notes priced both legs', () => {
    const input = inputWith({ floorAreaSqft: '850' });
    const resolved = {
      quantity: 850,
      unit: 'sqft',
      quantitySource: 'notes' as const,
      dualMaterial: { quantity: 4500, unit: 'allowance' },
      dualLabor: { quantity: 3250, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'flooring',
      input,
      'flooring',
      resolved
    );
    expect(fill).toBeNull();
    expect(comparison).toMatchObject({
      material: 3400,
      labor: 4250,
      total: 7650,
      isComparison: true,
    });
  });

  it('prefers a saved template rate over the national average for quantity-only items', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = {
      quantity: 1000,
      unit: 'sqft',
      quantitySource: 'inferred' as const,
    };
    const pricingContext: ScopePricingContext = {
      templates: [
        {
          name: 'LVP Floors',
          materialLineItems: [
            { name: 'LVP plank flooring', unit: 'sqft', unitPrice: 6 },
          ],
          laborLineItems: [
            { name: 'LVP install labor', unit: 'sqft', unitPrice: 4 },
          ],
        },
      ],
    };
    const { fill } = resolveScopeItemSuggestedPricing(
      'flooring',
      input,
      'flooring',
      resolved,
      pricingContext
    );
    expect(fill).toMatchObject({
      material: 6000,
      labor: 4000,
      mode: 'suggested_price',
    });
    expect(fill?.materialSource).toBe('template');
    expect(fill?.laborSource).toBe('template');
    expect(fill?.rateSourceLabel).toContain('From saved template');
  });

  it('includes national average comparison when saved library pricing is the fill', () => {
    const input = inputWith({ showerWallTileSqft: '80' });
    const resolved = {
      quantity: 80,
      unit: 'sqft',
      quantitySource: 'notes' as const,
    };
    const pricingContext: ScopePricingContext = {
      libraryRates: [
        {
          scopeItemName: 'Shower waterproofing & backer board — materials',
          category: 'material',
          unitType: 'sqft',
          unitRate: 5,
        },
        {
          scopeItemName: 'Shower waterproofing & backer board — labor',
          category: 'labor',
          unitType: 'sqft',
          unitRate: 8.75,
        },
      ],
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'waterproofing',
      input,
      'bathroom',
      resolved,
      pricingContext
    );
    expect(fill?.materialSource).toBe('template');
    expect(fill?.total).toBe(1100);
    expect(comparison).toMatchObject({ isComparison: true, total: 960 });
    expect(comparison?.rateSourceLabel).toMatch(/national average comparison/i);
  });

  it('does not attach national planning comparison for exterior paint without pricing library', () => {
    const input = inputWith({ exteriorPaintSqft: '2000' });
    const resolved = {
      quantity: 2000,
      unit: 'sqft' as const,
      quantitySource: 'user_entered' as const,
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'exterior_paint',
      input,
      'painting',
      resolved,
      { libraryRates: [] }
    );
    expect(fill?.total).toBe(6300);
    expect(comparison).toBeNull();
  });

  it('does not attach exterior paint comparison to a non-library entered price', () => {
    const input = inputWith({
      exteriorPaintSqft: '2000',
      pricingAcceptance: {
        exterior_paint: { selectionStatus: 'user_entered' },
      },
    });
    const resolved = {
      quantity: 2000,
      unit: 'sqft' as const,
      quantitySource: 'user_entered' as const,
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'exterior_paint',
      input,
      'painting',
      resolved,
      { libraryRates: [] }
    );
    expect(fill).toBeNull();
    expect(comparison).toBeNull();
  });

  it('uses CY national average rates when concrete is measured in cubic yards', () => {
    const input = inputWith({ concreteCy: '18' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('concrete', measurements, {
      templateKey: 'addition',
    });

    expect(resolved.unit).toBe('cy');

    const { fill } = resolveScopeItemSuggestedPricing(
      'concrete',
      input,
      'addition',
      resolved
    );
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      material: 2970,
      labor: 3330,
      total: 6300,
      basis: { quantity: 18, unit: 'cy' },
    });
  });

  it('defaults addition concrete pricing basis to CY before a measurement is entered', () => {
    const input = inputWith({});
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('concrete', measurements, {
      templateKey: 'addition',
    });

    expect(resolved.unit).toBe('cy');
    expect(resolved.pricingReady).toBe(false);
  });

  it('migrates stale addition concrete card entries from sqft to CY', () => {
    const input = inputWith({});
    input.itemQuantities = {
      concrete: {
        quantity: '250',
        unit: 'sqft',
        quantitySource: 'user_entered',
      },
    };
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('concrete', measurements, {
      templateKey: 'addition',
    });

    expect(resolved.quantity).toBe(250);
    expect(resolved.unit).toBe('cy');
  });

  it('suggests rough plumbing pricing from rough-in points', () => {
    const input = inputWith({});
    input.itemQuantities = {
      plumbing_rough: {
        quantity: '3',
        unit: 'each',
        quantitySource: 'user_entered',
      },
    };
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'plumbing_rough',
      measurements,
      { templateKey: 'addition' }
    );

    const { fill } = resolveScopeItemSuggestedPricing(
      'plumbing_rough',
      input,
      'addition',
      resolved
    );
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      material: 450,
      labor: 1050,
      total: 1500,
      basis: { quantity: 3, unit: 'each' },
    });
  });

  it('suggests electrical rough-in pricing from device counts', () => {
    const input = inputWith({});
    input.itemQuantities = {
      electrical_rough: {
        quantity: '4',
        unit: 'each',
        quantitySource: 'user_entered',
      },
    };
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'electrical_rough',
      measurements,
      { templateKey: 'addition' }
    );

    const { fill } = resolveScopeItemSuggestedPricing(
      'electrical_rough',
      input,
      'addition',
      resolved
    );
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      material: 200,
      labor: 500,
      total: 700,
      basis: { quantity: 4, unit: 'each' },
    });
  });

  it('treats stale permit placeholder $1 as missing pricing', () => {
    const input = inputWith({});
    input.itemQuantities = {
      permits: {
        quantity: '1',
        unit: 'allowance',
        quantitySource: 'user_entered',
      },
    };
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('permits', measurements, {
      templateKey: 'addition',
    });

    expect(resolved.pricingReady).toBe(false);
    expect(resolved.quantity).toBeNull();
    expect(isPlaceholderAllowancePricing(1, 'allowance', 'permits')).toBe(true);
  });

  it('suggests flat permit allowance pricing for ADU scope', () => {
    const input = inputWith({});
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('permits', measurements, {
      templateKey: 'addition',
    });

    const { fill } = resolveScopeItemSuggestedPricing(
      'permits',
      input,
      'addition',
      resolved
    );
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      lumpSumOnly: true,
      material: 0,
      labor: 3500,
      total: 3500,
    });
  });

  it('suggests cleanup as material + labor split (dumpster material + clean/haul labor)', () => {
    const input = inputWith({});
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('cleanup', measurements, {
      templateKey: 'addition',
    });

    const { fill } = resolveScopeItemSuggestedPricing(
      'cleanup',
      input,
      'addition',
      resolved
    );
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      lumpSumOnly: false,
      material: 450,
      labor: 550,
      total: 1000,
    });
  });

  it('keeps flat allowance suggestions available after the user enters a different allowance', () => {
    const input = inputWith({});
    input.itemQuantities = {
      cleanup__allowance: {
        quantity: '1000',
        unit: 'allowance',
        quantitySource: 'user_entered',
      },
    };
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('cleanup', measurements, {
      templateKey: 'addition',
    });

    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'cleanup',
      input,
      'addition',
      resolved
    );
    // Manual entry is active — suggestion stays as comparison-only (not "price ready").
    expect(fill).toBeNull();
    expect(comparison).toMatchObject({
      mode: 'suggested_price',
      material: 450,
      labor: 550,
      total: 1000,
      isComparison: true,
    });
  });

  it('keeps ground-up permit suggestion available after editing the allowance', () => {
    const input = inputWith({
      itemQuantities: {
        permits__allowance: {
          quantity: '34000',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('permits', measurements, {
      templateKey: 'ground_up',
    });
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'permits',
      input,
      'ground_up',
      resolved
    );
    // Manual entry is active — soft-cost national stays comparison-only.
    expect(fill).toBeNull();
    expect(comparison).toMatchObject({
      lumpSumOnly: true,
      total: 32000,
      isComparison: true,
    });
  });

  it('shows pricing entry for addition items without explicit quantity rules', () => {
    const input = inputWith({});
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('framing', measurements, {
      templateKey: 'addition',
    });

    expect(resolved).toMatchObject({
      pricingReady: false,
      showInput: true,
      missingMessage: 'Enter framing sqft or pricing.',
    });
  });

  it('auto-plans ground-up framing from covered framed SF without an on-card qty box', () => {
    const input = inputWith({
      floorAreaSqft: '3660',
      garageSqft: '781',
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('framing', measurements, {
      templateKey: 'ground_up',
    });

    expect(resolved).toMatchObject({
      pricingReady: true,
      quantity: 4441,
      unit: 'sqft',
      quantitySource: 'inferred',
    });
  });

  it('marks allowance split items priced when lump sum subkey is entered', () => {
    const input = inputWith({
      itemQuantities: {
        permits__allowance: {
          quantity: '3500',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('permits', measurements, {
      templateKey: 'addition',
    });

    expect(resolved).toMatchObject({
      pricingReady: true,
      quantity: 3500,
      unit: 'allowance',
    });
  });

  it('marks default-rule allowance split items priced when lump sum subkey is entered', () => {
    const input = inputWith({
      itemQuantities: {
        plans_engineering__allowance: {
          quantity: '8500',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'plans_engineering',
      measurements,
      {
        templateKey: 'addition',
      }
    );

    expect(resolved).toMatchObject({
      pricingReady: true,
      quantity: 8500,
      unit: 'allowance',
    });
  });

  it('treats plans/engineering as a flat allowance line without sqft pricing basis', () => {
    const input = inputWith({ floorAreaSqft: '500' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'plans_engineering',
      measurements,
      {
        templateKey: 'addition',
      }
    );

    expect(resolved).toMatchObject({
      pricingReady: false,
      unit: 'allowance',
    });
    expect(
      resolveAllowanceEditorPricingBasis('plans_engineering', input, 'addition')
    ).toBeNull();
    expect(
      resolveScopeItemSuggestedPricing(
        'plans_engineering',
        input,
        'addition',
        resolved
      )
    ).toEqual({
      fill: null,
      comparison: null,
    });
  });

  it('treats soft-cost scopes as flat allowance lines across templates', () => {
    const input = inputWith({ floorAreaSqft: '600' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const flatAllowanceItems = [
      'cabinets_counters',
      'final_inspections',
      'contingency',
      'plans_engineering',
      'mobilization',
      'emergency_fee',
      'survey',
      'general_conditions',
      'supervision',
      'overhead_profit',
    ] as const;

    for (const itemId of flatAllowanceItems) {
      const rule = getChecklistItemQuantityRuleOrDefault(itemId, 'addition');
      expect(rule.lumpSumOnly).toBe(true);
      expect(rule.allowanceOrSplit).toBeFalsy();
      expect(
        resolveAllowanceEditorPricingBasis(itemId, input, 'addition')
      ).toBeNull();
      const resolved = resolveChecklistItemQuantity(itemId, measurements, {
        templateKey: 'addition',
      });
      expect(resolved.pricingReady).toBe(false);
    }

    for (const itemId of [
      'plumbing_trim',
      'electrical_trim',
      'haul_off',
    ] as const) {
      const rule = getChecklistItemQuantityRuleOrDefault(itemId, 'addition');
      expect(rule.lumpSumOnly).toBe(false);
    }

    // Same soft costs should stay allowance-only outside addition templates.
    expect(
      getChecklistItemQuantityRuleOrDefault('mobilization', 'excavation')
        .lumpSumOnly
    ).toBe(true);
    expect(
      getChecklistItemQuantityRuleOrDefault('overhead_profit', 'ground_up')
        .lumpSumOnly
    ).toBe(true);
    expect(
      getChecklistItemQuantityRuleOrDefault('emergency_fee', 'plumbing_service')
        .lumpSumOnly
    ).toBe(true);
  });

  it('keeps trade scopes on material/labor — allowance toggle only for soft costs', () => {
    const tradeItems = [
      'utility_coordination',
      'utility_trenching',
      'windows_doors',
      'hvac',
      'hvac_startup',
      'appliance_removal',
      'cabinets',
      'countertops',
      'mirror_accessories',
      'service_call',
      'parts_materials',
      'hardware',
      'materials_package',
      'utility_taps',
      'refrigerant',
      'thermostat',
      'roof_tie_in',
    ] as const;

    for (const itemId of tradeItems) {
      const rule = getChecklistItemQuantityRuleOrDefault(itemId, 'addition');
      expect(rule.allowanceOrSplit).toBeFalsy();
      expect(rule.lumpSumOnly).toBeFalsy();
    }

    expect(
      getChecklistItemQuantityRuleOrDefault('hvac', 'addition').defaultUnit
    ).toBe('sqft');
    expect(
      getChecklistItemQuantityRuleOrDefault('service_call', 'plumbing_service')
        .allowanceOrSplit
    ).toBeFalsy();
    expect(
      getChecklistItemQuantityRuleOrDefault('utility_taps', 'ground_up')
        .allowanceOrSplit
    ).toBeFalsy();
    expect(
      getChecklistItemQuantityRuleOrDefault('permits', 'addition').lumpSumOnly
    ).toBe(true);
    expect(
      getChecklistItemQuantityRuleOrDefault('appliances', 'addition')
        .lumpSumOnly
    ).toBe(true);
    expect(
      getChecklistItemQuantityRuleOrDefault('contingency', 'addition')
        .lumpSumOnly
    ).toBe(true);
    expect(DEFAULT_SCOPE_ALLOWANCE_QUANTITY_RULE.allowanceOrSplit).toBeFalsy();
  });

  it('uses ADU-specific pricing basis units for missing-price scope cards', () => {
    const input = inputWith({
      floorAreaSqft: '500',
      excavationCy: '50',
    });

    expect(
      resolveAllowanceEditorPricingBasis('permits', input, 'addition')
    ).toBeNull();
    expect(
      resolveAllowanceEditorPricingBasis('grading', input, 'addition')
    ).toEqual({
      quantity: 500,
      unit: 'sqft',
    });
    expect(
      resolveAllowanceEditorPricingBasis('excavation', input, 'addition')
    ).toEqual({
      quantity: 50,
      unit: 'cy',
    });
    expect(
      resolveAllowanceEditorPricingBasis('utility_trenching', input, 'addition')
    ).toBeNull();
  });

  it('uses the scope card takeoff as the Edit basis across count and area cards', () => {
    const input = inputWith({
      flooringSqft: '240',
      itemQuantities: {
        cabinet_hardware: {
          quantity: '3',
          unit: 'each',
          quantitySource: 'user_entered',
        },
        electrical: {
          quantity: '4',
          unit: 'each',
          quantitySource: 'user_entered',
        },
        flooring: {
          quantity: '240',
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
      },
    });

    expect(
      resolveAllowanceEditorPricingBasis('cabinet_hardware', input, 'kitchen')
    ).toEqual({
      quantity: 3,
      unit: 'each',
    });
    expect(
      resolveAllowanceEditorPricingBasis('electrical', input, 'kitchen')
    ).toEqual({
      quantity: 4,
      unit: 'each',
    });
    expect(
      resolveAllowanceEditorPricingBasis('flooring', input, 'kitchen')
    ).toEqual({
      quantity: 240,
      unit: 'sqft',
    });
  });

  it('uses foundation concrete CY for ground-up Edit basis — not living SF', () => {
    const input = inputWith({
      floorAreaSqft: '3098',
      concreteCy: '68',
      itemQuantities: {
        // Stale Edit session that wrongly stored living SF as the pricing basis.
        foundation__sqft_basis: {
          quantity: '3098',
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
      },
    });

    expect(
      resolveAllowanceEditorPricingBasis('foundation', input, 'ground_up')
    ).toEqual({
      quantity: 68,
      unit: 'cy',
    });
    expect(
      resolveAllowanceEditorDefaultBasisUnit('foundation', 'ground_up')
    ).toBe('cy');
  });

  it('uses covered framed SF (living + garage) for ground-up framing Edit basis', () => {
    const input = inputWith({
      floorAreaSqft: '3098',
      garageSqft: '972',
      itemQuantities: {
        // Stale Edit session that stored living-only SF.
        framing__sqft_basis: {
          quantity: '3098',
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
      },
    });

    expect(
      resolveAllowanceEditorPricingBasis('framing', input, 'ground_up')
    ).toEqual({
      quantity: 4070,
      unit: 'sqft',
    });
    expect(
      isStaleLivingSfPricingBasis({
        itemId: 'framing',
        storedQty: 3098,
        storedUnit: 'sqft',
        livingSf: 3098,
        garageSf: 972,
        preferredUnit: 'sqft',
        preferredMeasurementKeys: ['floorAreaSqft', 'garageSqft'],
        sumMeasurementKeys: true,
      })
    ).toBe(true);
  });

  it('aligns Edit basis with Suggest planning for drywall, insulation, paint, HVAC, cabinets', () => {
    const input = inputWith({
      floorAreaSqft: '3098',
      garageSqft: '972',
      // Thin notes takeoff — Suggest expands to living×3.5 (~10,843).
      drywallSqft: '4056',
      // Stale living-SF Edit seeds that must not stick.
      itemQuantities: {
        drywall__sqft_basis: {
          quantity: '3098',
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        insulation__sqft_basis: {
          quantity: '3098',
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        interior_paint__sqft_basis: {
          quantity: '3098',
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
      },
    });

    expect(
      resolveAllowanceEditorPricingBasis('drywall', input, 'ground_up')
    ).toEqual({
      quantity: Math.round(3098 * 3.5),
      unit: 'sqft',
    });
    expect(
      resolveAllowanceEditorPricingBasis('insulation', input, 'ground_up')?.unit
    ).toBe('sqft');
    expect(
      resolveAllowanceEditorPricingBasis('insulation', input, 'ground_up')!
        .quantity
    ).toBeGreaterThan(3098);
    expect(
      resolveAllowanceEditorPricingBasis('insulation', input, 'ground_up')!
        .quantity
    ).not.toBe(3098);
    expect(
      resolveAllowanceEditorPricingBasis('interior_paint', input, 'ground_up')
    ).toBeNull();
    expect(
      resolveAllowanceEditorPricingBasis('hvac', input, 'ground_up')
    ).toEqual({
      quantity: 1,
      unit: 'each',
    });
    expect(
      resolveAllowanceEditorPricingBasis('cabinets', input, 'ground_up')
    ).toEqual({
      quantity: Math.round(3098 / 25),
      unit: 'lf',
    });
    expect(
      resolveAllowanceEditorPricingBasis('countertops', input, 'ground_up')
    ).toEqual({
      quantity: 80,
      unit: 'sqft',
    });
  });

  it('does not seed living SF as paint Edit basis when paintable SF is present', () => {
    const input = inputWith({
      floorAreaSqft: '3098',
      wallPaintSqft: '10843',
      exteriorPaintSqft: '4200',
    });
    expect(
      resolveAllowanceEditorPricingBasis('interior_paint', input, 'ground_up')
    ).toEqual({
      quantity: 10843,
      unit: 'sqft',
    });
    expect(
      resolveAllowanceEditorPricingBasis('exterior_paint', input, 'ground_up')
    ).toEqual({
      quantity: 4200,
      unit: 'sqft',
    });
  });

  it('rejects living-SF Edit basis for CY / squares / each / LF scopes', () => {
    expect(
      isStaleLivingSfPricingBasis({
        itemId: 'roofing',
        storedQty: 3098,
        storedUnit: 'sqft',
        livingSf: 3098,
        preferredUnit: 'squares',
        preferredMeasurementKeys: ['roofSquares'],
      })
    ).toBe(true);
    expect(
      isStaleLivingSfPricingBasis({
        itemId: 'hvac',
        storedQty: 3098,
        storedUnit: 'sqft',
        livingSf: 3098,
        preferredUnit: 'each',
      })
    ).toBe(true);
    expect(
      isStaleLivingSfPricingBasis({
        itemId: 'drywall',
        storedQty: 3098,
        storedUnit: 'sqft',
        livingSf: 3098,
        preferredUnit: 'sqft',
        preferredMeasurementKeys: ['drywallSqft'],
      })
    ).toBe(true);

    const input = inputWith({
      floorAreaSqft: '3098',
      concreteCy: '68',
      excavationCy: '120',
      roofSquares: '46.2',
      drywallSqft: '10843',
      cabinetLf: '90',
      itemQuantities: {
        foundation__sqft_basis: { quantity: '3098', unit: 'sqft' },
        excavation__sqft_basis: { quantity: '3098', unit: 'sqft' },
        roofing__sqft_basis: { quantity: '3098', unit: 'sqft' },
        hvac__sqft_basis: { quantity: '3098', unit: 'sqft' },
        cabinets__sqft_basis: { quantity: '3098', unit: 'sqft' },
        drywall__sqft_basis: { quantity: '3098', unit: 'sqft' },
      },
    });

    expect(
      resolveAllowanceEditorPricingBasis('foundation', input, 'ground_up')
    ).toEqual({
      quantity: 68,
      unit: 'cy',
    });
    expect(
      resolveAllowanceEditorPricingBasis('excavation', input, 'ground_up')
    ).toEqual({
      quantity: 120,
      unit: 'cy',
    });
    expect(
      resolveAllowanceEditorPricingBasis('roofing', input, 'ground_up')
    ).toEqual({
      quantity: 46.2,
      unit: 'squares',
    });
    // HVAC Suggest defaults to 1 system — Edit must match (not living SF, not empty).
    expect(
      resolveAllowanceEditorPricingBasis('hvac', input, 'ground_up')
    ).toEqual({
      quantity: 1,
      unit: 'each',
    });
    expect(
      resolveAllowanceEditorPricingBasis('cabinets', input, 'ground_up')
    ).toEqual({
      quantity: 90,
      unit: 'lf',
    });
    expect(
      resolveAllowanceEditorPricingBasis('drywall', input, 'ground_up')
    ).toEqual({
      quantity: 10843,
      unit: 'sqft',
    });
    expect(
      resolveAllowanceEditorPricingBasis('foundation', input, 'addition')
    ).toEqual({
      quantity: 68,
      unit: 'cy',
    });
    expect(
      resolveAllowanceEditorPricingBasis('roof_tie_in', input, 'addition')
    ).toEqual({
      quantity: 46.2,
      unit: 'squares',
    });
  });

  it('uses scenario-specific pricing basis units outside ADU', () => {
    const input = inputWith({
      floorAreaSqft: '800',
      kitchenFloorSqft: '220',
      roofSquares: '18',
      deckSqft: '320',
      railingLf: '42',
      landscapeSqft: '1200',
      excavationCy: '75',
      cabinetLf: '24',
    });

    expect(
      resolveAllowanceEditorPricingBasis('flooring', input, 'kitchen')
    ).toEqual({
      quantity: 220,
      unit: 'sqft',
    });
    expect(
      resolveAllowanceEditorPricingBasis('cabinets', input, 'kitchen')
    ).toEqual({
      quantity: 24,
      unit: 'lf',
    });
    expect(
      resolveAllowanceEditorPricingBasis('shingles_roofing', input, 'roofing')
    ).toEqual({
      quantity: 18,
      unit: 'squares',
    });
    expect(
      resolveAllowanceEditorPricingBasis('decking', input, 'deck_patio')
    ).toEqual({
      quantity: 320,
      unit: 'sqft',
    });
    expect(
      resolveAllowanceEditorPricingBasis('railing', input, 'deck_patio')
    ).toEqual({
      quantity: 42,
      unit: 'lf',
    });
    expect(
      resolveAllowanceEditorPricingBasis('sod_turf', input, 'landscaping')
    ).toEqual({
      quantity: 1200,
      unit: 'sqft',
    });
    expect(
      resolveAllowanceEditorPricingBasis('backfill', input, 'excavation')
    ).toEqual({
      quantity: 75,
      unit: 'cy',
    });
    expect(
      resolveAllowanceEditorPricingBasis(
        'water_line',
        input,
        'plumbing_service'
      )
    ).toBeNull();
  });

  it('uses sqft national average rates when concrete is measured in square feet', () => {
    const input = inputWith({ concreteSqft: '500' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('concrete', measurements, {
      templateKey: 'addition',
    });

    expect(resolved.unit).toBe('sqft');

    const { fill } = resolveScopeItemSuggestedPricing(
      'concrete',
      input,
      'addition',
      resolved
    );
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      material: 2000,
      labor: 3000,
      total: 5000,
      basis: { quantity: 500, unit: 'sqft' },
    });
  });
});

describe('templateRateSourceLabel', () => {
  it('labels pricing library, bid, and saved template origins distinctly', () => {
    expect(
      templateRateSourceLabel({ origin: 'pricing_library', source: 'Pricing library' })
    ).toBe('Saved pricing');
    expect(templateRateSourceLabel({ origin: 'bid', source: 'Kitchen repaint' })).toBe(
      'From this bid'
    );
    expect(
      templateRateSourceLabel({ origin: 'saved_template', source: 'Painting job' })
    ).toBe('From saved template · Painting job');
  });
});

describe('resolveTemplateRateForItem', () => {
  it('matches saved line items within the same trade family and unit', () => {
    const ctx: ScopePricingContext = {
      templates: [
        {
          name: 'LVP Floors',
          materialLineItems: [
            { name: 'Vinyl plank flooring', unit: 'sqft', unitPrice: 5.5 },
          ],
          laborLineItems: [
            { name: 'Flooring install labor', unit: 'sqft', unitPrice: 3.25 },
          ],
        },
      ],
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toMatchObject({
      materialRate: 5.5,
      laborRate: 3.25,
      source: 'LVP Floors',
      origin: 'saved_template',
    });
  });

  it('matches saved sqft labor lines stored as hours and rate', () => {
    const ctx: ScopePricingContext = {
      templates: [
        {
          name: 'Nick',
          materialLineItems: [
            { name: 'LVP flooring', unit: 'sqft', unitPrice: 3 },
          ],
          laborLineItems: [
            {
              name: 'LVP install',
              mode: 'sqft',
              hours: 1200,
              rate: 4,
              total: 4800,
            },
          ],
        },
      ],
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toMatchObject({
      materialRate: 3,
      laborRate: 4,
      source: 'Nick',
      origin: 'saved_template',
    });
  });

  it('does not borrow a wall-tile rate for a flooring scope', () => {
    const ctx: ScopePricingContext = {
      templates: [
        {
          name: 'Bath Tile',
          materialLineItems: [
            { name: 'Wall tile', unit: 'sqft', unitPrice: 8 },
          ],
          laborLineItems: [
            { name: 'Wall tile setting', unit: 'sqft', unitPrice: 14 },
          ],
        },
      ],
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toBeNull();
  });

  it('ignores rates whose unit does not match the scope unit', () => {
    const ctx: ScopePricingContext = {
      bid: {
        name: 'This bid',
        materialLineItems: [
          { name: 'LVP flooring', unit: 'ea', unitPrice: 200 },
        ],
        laborLineItems: [],
      },
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toBeNull();
  });

  it('rehydrates notes material/labor split when only a partial user_entered allowance is stored', () => {
    const notes =
      'Install LVP flooring which is 850 sqft. Material is $4.50 a square foot and $3.25 a square foot for labor.';
    const input = inputWith({ floorAreaSqft: '850' });
    input.itemQuantities = {
      ...input.itemQuantities,
      flooring__allowance: {
        quantity: '3825',
        unit: 'allowance',
        quantitySource: 'user_entered',
      },
    };
    const fromNotes = resolveDualRatePricingDisplayFromNotes(
      'flooring',
      input,
      notes,
      'flooring'
    );
    expect(fromNotes).toMatchObject({
      dualMaterial: { quantity: 3825 },
      dualLabor: { quantity: 2762.5 },
      dualAllowance: { quantity: 6587.5 },
    });
  });

  it('prices ground-up insulation on thermal envelope SF, not living×3.5 drywall surface', () => {
    const livingSf = 1879;
    const drywallProxy = Math.round(livingSf * 3.5); // 6577 — must not be used
    const input = inputWith({
      floorAreaSqft: String(livingSf),
      atticInsulationSqft: String(livingSf),
    });
    const resolved = {
      quantity: livingSf,
      unit: 'sqft' as const,
      quantitySource: 'inferred' as const,
    };
    const { fill } = resolveScopeItemSuggestedPricing(
      'insulation',
      input,
      'ground_up',
      resolved
    );
    expect(fill?.basis?.unit).toBe('sqft');
    expect(fill?.basis?.quantity).not.toBe(drywallProxy);
    expect(fill?.basis?.quantity).not.toBe(livingSf);
    // Envelope planning without perimeter still stays well below drywall surface.
    expect(fill?.basis?.quantity).toBeLessThan(5000);
    expect(fill?.basis?.quantity).toBeGreaterThan(2500);
  });

  it('does not price a ground-up insulation scope until the ceiling boundary is confirmed', () => {
    const input = inputWith({
      floorAreaSqft: '1879',
      exteriorWallInsulationSqft: '1950.4',
      openingDeductionSqft: '289.6',
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'insulation',
      input,
      'ground_up',
      {
        quantity: 1950.4,
        unit: 'sqft',
        quantitySource: 'inferred',
      }
    );
    expect(fill).toBeNull();
  });

  it('does not price plan assemblies until a calculated ceiling is confirmed', () => {
    const input = inputWith({
      floorAreaSqft: '3660',
      exteriorWallInsulationSqft: '1950.4',
      atticInsulationSqft: '3660',
      insulationAssemblies: [
        {
          id: 'plan-wall',
          materialType: 'Batt',
          rValue: 'R-21',
          sqft: 1950.4,
          location: 'exterior_wall',
          source: 'detected_from_plan',
          confirmed: true,
        },
        {
          id: 'plan-attic',
          materialType: 'Batt',
          rValue: 'R-30',
          sqft: 3660,
          location: 'attic_ceiling',
          source: 'calculated_from_plan',
          confirmed: false,
        },
      ],
    });

    const { fill } = resolveScopeItemSuggestedPricing(
      'insulation',
      input,
      'ground_up',
      {
        quantity: 1950.4,
        unit: 'sqft',
        quantitySource: 'inferred',
      }
    );

    expect(fill).toBeNull();
  });

  it('prices roof deck, floor, and garage separation SF as separate insulation components', () => {
    const input = inputWith({
      floorAreaSqft: '1879',
      exteriorWallInsulationSqft: '1637',
      atticInsulationSqft: '1879',
      floorInsulationSqft: '400',
      garageSeparationInsulationSqft: '220',
      garageInsulationIncluded: 'separation only',
      insulationMaterialType: 'Batt',
      insulationRValue: 'R-21',
    });
    const resolved = {
      quantity: 3736,
      unit: 'sqft' as const,
      quantitySource: 'inferred' as const,
    };
    const { fill } = resolveScopeItemSuggestedPricing(
      'insulation',
      input,
      'ground_up',
      resolved
    );

    expect(fill?.basis).toEqual({ quantity: 4136, unit: 'sqft' });
    expect(fill?.total).toBe(9444.2);
    expect(fill?.pricingDetail).toMatch(/400 SF floor insulation @ \$2.75\/SF/);
    expect(fill?.pricingDetail).toMatch(
      /220 SF garage separation @ \$3.75\/SF/
    );
    expect(fill?.pricingDetail).not.toMatch(/insulated garage walls/);
    expect(fill?.rateSourceLabel).toMatch(/batt · R-21/i);
    expect(fill?.helper).toMatch(/Garage: separation only/i);
  });

  it('prices an insulated roof deck per SF and applies installation type and R-value', () => {
    const battInput = inputWith({
      floorAreaSqft: '1879',
      exteriorWallInsulationSqft: '1637',
      insulatedRoofDeckSqft: '1879',
      preferRoofDeckOverAttic: true,
      insulationMaterialType: 'Batt',
      insulationRValue: 'R-21',
    });
    const sprayFoamInput = inputWith({
      ...battInput,
      insulationMaterialType: 'Spray foam',
      insulationRValue: 'R-49',
    });
    const resolved = {
      quantity: 3516,
      unit: 'sqft' as const,
      quantitySource: 'inferred' as const,
    };

    const batt = resolveScopeItemSuggestedPricing(
      'insulation',
      battInput,
      'ground_up',
      resolved
    );
    const sprayFoam = resolveScopeItemSuggestedPricing(
      'insulation',
      sprayFoamInput,
      'ground_up',
      resolved
    );

    expect(batt.fill?.pricingDetail).toMatch(
      /1,879 SF insulated roof deck @ \$6.00\/SF/
    );
    expect(batt.fill?.rateSourceLabel).toMatch(/batt · R-21/i);
    expect(sprayFoam.fill?.rateSourceLabel).toMatch(/spray foam · R-49/i);
    expect(sprayFoam.fill!.total).toBeGreaterThan(batt.fill!.total);
  });

  it('provides pricing for every installation type and target R-value option', () => {
    const types = [
      'Batt',
      'Blown-in',
      'Spray foam',
      'Rigid foam board',
      'Cellulose',
      'Mineral wool',
    ];
    const rValues = ['R-13', 'R-15', 'R-19', 'R-21', 'R-30', 'R-38', 'R-49', 'R-60'];
    const resolved = {
      quantity: 3516,
      unit: 'sqft' as const,
      quantitySource: 'inferred' as const,
    };

    for (const insulationMaterialType of types) {
      const { fill } = resolveScopeItemSuggestedPricing(
        'insulation',
        inputWith({
          floorAreaSqft: '1879',
          exteriorWallInsulationSqft: '1637',
          atticInsulationSqft: '1879',
          insulationMaterialType,
          insulationRValue: 'R-21',
        }),
        'ground_up',
        resolved
      );
      expect(fill?.total).toBeGreaterThan(0);
      expect(fill?.rateSourceLabel).toMatch(new RegExp(insulationMaterialType, 'i'));
    }

    for (const insulationRValue of rValues) {
      const { fill } = resolveScopeItemSuggestedPricing(
        'insulation',
        inputWith({
          floorAreaSqft: '1879',
          exteriorWallInsulationSqft: '1637',
          atticInsulationSqft: '1879',
          insulationMaterialType: 'Batt',
          insulationRValue,
        }),
        'ground_up',
        resolved
      );
      expect(fill?.total).toBeGreaterThan(0);
      expect(fill?.rateSourceLabel).toContain(insulationRValue);
    }
  });

  it('prices multiple insulation assemblies by each selected type, R-value, and area', () => {
    const { fill } = resolveScopeItemSuggestedPricing(
      'insulation',
      inputWith({
        floorAreaSqft: '1879',
        exteriorWallInsulationSqft: '2000',
        atticInsulationSqft: '1500',
        insulationAssemblies: [
          {
            id: 'walls',
            materialType: 'Batt',
            rValue: 'R-13',
            sqft: '2000',
            location: 'exterior_wall',
          },
          {
            id: 'ceiling',
            materialType: 'Spray foam',
            rValue: 'R-30',
            sqft: '1500',
            location: 'roof_deck',
          },
        ],
      }),
      'ground_up',
      {
        quantity: 3500,
        unit: 'sqft',
        quantitySource: 'inferred',
      }
    );

    expect(fill?.basis).toEqual({ quantity: 3500, unit: 'sqft' });
    expect(fill?.pricingDetail).toMatch(/2,000 SF Batt R-13 exterior wall/);
    expect(fill?.pricingDetail).toMatch(/1,500 SF Spray foam R-30 roof deck/);
    expect(fill?.rateSourceLabel).toMatch(/Batt · R-13 \+ Spray foam · R-30/i);
    expect(fill?.total).toBeGreaterThan(0);
  });

  it('applies a flat faced batt material premium without changing labor', () => {
    const baseInput = {
      floorAreaSqft: '3660',
      exteriorWallInsulationSqft: '1000',
      insulationAssemblies: [
        {
          id: 'wall',
          materialType: 'Batt',
          rValue: 'R-21',
          sqft: 1000,
          location: 'exterior_wall',
          confirmed: true,
        },
      ],
    };
    const resolved = {
      quantity: 1000,
      unit: 'sqft' as const,
      quantitySource: 'user_entered' as const,
    };
    const unfaced = resolveScopeItemSuggestedPricing(
      'insulation',
      inputWith({
        ...baseInput,
        insulationAssemblies: [
          {
            ...baseInput.insulationAssemblies[0],
            battFacing: 'unfaced',
          },
        ],
      }),
      'ground_up',
      resolved
    );
    const faced = resolveScopeItemSuggestedPricing(
      'insulation',
      inputWith({
        ...baseInput,
        insulationAssemblies: [
          {
            ...baseInput.insulationAssemblies[0],
            battFacing: 'faced',
          },
        ],
      }),
      'ground_up',
      resolved
    );

    expect(unfaced.fill?.total).toBeGreaterThan(0);
    expect(faced.fill?.total).toBeGreaterThan(unfaced.fill?.total ?? 0);
    expect((faced.fill?.total ?? 0) - (unfaced.fill?.total ?? 0)).toBe(200);
    expect(faced.fill?.labor).toBe(unfaced.fill?.labor);
    expect(faced.fill?.material).toBe((unfaced.fill?.material ?? 0) + 200);
    expect(faced.fill?.pricingDetail).toMatch(/faced/i);
    expect(faced.fill?.pricingDetail).toMatch(/@ \$1\.70\/SF/);
    expect(unfaced.fill?.pricingDetail).toMatch(/@ \$1\.50\/SF/);
  });

  it('uses national rate card for assembly rows when not on ground-up planning', () => {
    const rows = [
      {
        id: 'wall',
        materialType: 'Batt',
        rValue: 'R-21',
        sqft: 1000,
        location: 'exterior_wall',
        battFacing: 'unfaced' as const,
        confirmed: true,
      },
    ];
    const smallHome = resolveInsulationAssemblyRowPricingMap(rows, {
      livingSf: 1200,
    });
    const largeHome = resolveInsulationAssemblyRowPricingMap(rows, {
      livingSf: 6000,
    });
    expect(smallHome.get('wall')?.installedRate).toBe(3);
    expect(largeHome.get('wall')?.installedRate).toBe(3);
    expect(smallHome.get('wall')?.total).toBe(3000);
  });

  it('prices Plan 58 insulation assemblies on production baseline near the SHV bid', () => {
    const input = inputWith({
      floorAreaSqft: '3660',
      insulationAssemblies: [
        {
          id: 'wall',
          materialType: 'Batt',
          rValue: 'R-21',
          sqft: 2958.8,
          location: 'exterior_wall',
          battFacing: 'unfaced',
          confirmed: true,
        },
        {
          id: 'attic',
          materialType: 'Batt',
          rValue: 'R-30',
          sqft: 2260,
          location: 'attic_ceiling',
          battFacing: 'not_sure',
          confirmed: true,
        },
      ],
    });
    const block = resolveInsulationAssemblyScopeSuggestedPricing(
      input,
      { state: 'UT' },
      'insulation'
    );
    const comparison = resolveInsulationAssemblyNationalRateCardComparison(
      input,
      { state: 'UT' },
      'insulation'
    );

    expect(block?.total).toBeGreaterThan(8140);
    expect(block?.total).toBeLessThan(8180);
    expect(block?.rateSourceLabel).toMatch(/Production planning rate/i);
    expect(comparison?.total).toBeGreaterThan(15000);
    expect(comparison?.isComparison).toBe(true);
    expect(comparison?.benchmarkAction).toBe('comparison_only');
  });

  it('prices individual insulation assembly rows for scope card display', () => {
    const rows = [
      {
        id: 'wall',
        materialType: 'Batt',
        rValue: 'R-21',
        sqft: 1000,
        location: 'exterior_wall',
        battFacing: 'unfaced' as const,
        confirmed: true,
      },
      {
        id: 'attic',
        materialType: 'Batt',
        rValue: 'R-21',
        sqft: 1000,
        location: 'attic_ceiling',
        battFacing: 'faced' as const,
        confirmed: true,
      },
    ];
    const pricing = resolveInsulationAssemblyRowPricingMap(rows, {
      livingSf: 2000,
    });
    const unfaced = pricing.get('wall');
    const faced = pricing.get('attic');

    expect(unfaced?.total).toBeGreaterThan(0);
    expect(faced?.total).toBeGreaterThan(unfaced?.total ?? 0);
    expect((faced?.total ?? 0) - (unfaced?.total ?? 0)).toBe(200);
    expect(faced?.labor).toBe(unfaced?.labor);
    expect(faced?.detail).toMatch(/faced/i);
  });

  it('builds insulation scope card pricing from priced assemblies', () => {
    const input = inputWith({
      floorAreaSqft: '3660',
      insulationAssemblies: [
        {
          id: 'wall',
          materialType: 'Batt',
          rValue: 'R-21',
          sqft: 2982.5,
          location: 'exterior_wall',
          battFacing: 'unfaced',
          confirmed: true,
        },
        {
          id: 'attic',
          materialType: 'Batt',
          rValue: 'R-30',
          sqft: 2260,
          location: 'attic_ceiling',
          battFacing: 'not_sure',
          confirmed: true,
        },
      ],
    });
    const block = resolveInsulationAssemblyScopeSuggestedPricing(input);

    expect(block?.basis).toEqual({ quantity: 5242.5, unit: 'sqft' });
    expect(block?.total).toBeGreaterThan(0);
    expect(block?.pricingDetail).toMatch(/2,983 SF Batt/i);
    expect(block?.pricingDetail).toMatch(/2,260 SF Batt/i);
    expect(block?.helper).toMatch(/2 priced assemblies/i);
  });

  it('exposes whole-house lump benchmark as comparison-only when assemblies exist', () => {
    const input = inputWith({
      floorAreaSqft: '3660',
      insulationAssemblies: [
        {
          id: 'wall',
          materialType: 'Batt',
          rValue: 'R-21',
          sqft: 2982.5,
          location: 'exterior_wall',
          battFacing: 'unfaced',
          confirmed: true,
        },
      ],
    });
    const comparison = resolveInsulationAssemblyLumpBenchmarkComparison(input, {
      state: 'UT',
    });

    expect(comparison?.isComparison).toBe(true);
    expect(comparison?.benchmarkAction).toBe('comparison_only');
    expect(comparison?.total).toBeGreaterThan(0);
    expect(comparison?.materialSource).toBe('local_benchmark');
    expect(comparison?.helper).toMatch(/not assembly rate-card pricing/i);
    expect(comparison?.rateSourceLabel).toMatch(/reference only/i);
  });

  it('uses priced insulation assemblies for checklist quantity', () => {
    const resolved = resolveChecklistItemQuantity(
      'insulation',
      buildNormalizedScopeMeasurementsFromInput(
        inputWith({
          floorAreaSqft: '3660',
          exteriorWallInsulationSqft: '5511',
          atticInsulationSqft: '3660',
          insulationAssemblies: [
            {
              id: 'wall',
              materialType: 'Batt',
              rValue: 'R-21',
              sqft: 2982.5,
              location: 'exterior_wall',
              confirmed: true,
            },
            {
              id: 'attic',
              materialType: 'Batt',
              rValue: 'R-30',
              sqft: 2260,
              location: 'attic_ceiling',
              confirmed: true,
            },
          ],
        })
      ),
      { templateKey: 'ground_up' }
    );

    expect(resolved.quantity).toBe(5242.5);
    expect(resolved.pricingReady).toBe(true);
    expect(resolved.sourceLabel).toBe('Insulation assemblies · plan takeoff');
  });

  it('keeps drywall notes surface takeoff (does not expand living SF when qty differs)', () => {
    const input = inputWith({
      floorAreaSqft: '1879',
      drywallSqft: '5469',
    });
    const resolved = {
      quantity: 5469,
      unit: 'sqft' as const,
      quantitySource: 'notes' as const,
    };
    const { fill } = resolveScopeItemSuggestedPricing(
      'drywall',
      input,
      'ground_up',
      resolved
    );
    expect(fill?.basis).toEqual({ quantity: 5469, unit: 'sqft' });
  });
});

describe('allowance split apply pricing', () => {
  it('stores dollar total on primary id when basis is 1 allowance', () => {
    const rule = getChecklistItemQuantityRuleOrDefault(
      'mirror_accessories',
      'bathroom'
    );
    const primary = primaryQuantityForAppliedSuggestedBlock(
      {
        total: 375,
        material: 200,
        labor: 175,
        basis: { quantity: 1, unit: 'allowance' },
      } as any,
      rule
    );
    expect(primary).toEqual({ quantity: '375', unit: 'allowance' });
  });

  it('does not store dollar total as LF quantity for plumbing line cards', () => {
    const rule = getChecklistItemQuantityRuleOrDefault(
      'water_line',
      'plumbing_service'
    );
    const primary = primaryQuantityForAppliedSuggestedBlock(
      {
        total: 1500,
        material: 400,
        labor: 1100,
      } as any,
      rule
    );
    expect(primary).toEqual({ quantity: '1', unit: 'lf' });
    const withBasis = primaryQuantityForAppliedSuggestedBlock(
      {
        total: 1500,
        material: 400,
        labor: 1100,
        basis: { quantity: 50, unit: 'lf' },
      } as any,
      rule
    );
    expect(withBasis).toEqual({ quantity: '50', unit: 'lf' });
  });

  it('resolves applied bath accessories from split subkeys, not stale count', () => {
    const input = inputWith({
      itemQuantities: {
        mirror_accessories: {
          quantity: '1',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        mirror_accessories__allowance: {
          quantity: '375',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        mirror_accessories__material: {
          quantity: '200',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        mirror_accessories__labor: {
          quantity: '175',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'mirror_accessories',
      measurements,
      {
        templateKey: 'bathroom',
      }
    );
    expect(resolved.quantity).toBe(375);
    expect(resolved.dualMaterial?.quantity).toBe(200);
    expect(resolved.dualLabor?.quantity).toBe(175);
  });

  it('shows national benchmark for user-entered bath accessories split (does not multiply 375 × $375)', () => {
    const input = inputWith({
      itemQuantities: {
        mirror_accessories: {
          quantity: '375',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        mirror_accessories__allowance: {
          quantity: '375',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        mirror_accessories__material: {
          quantity: '200',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        mirror_accessories__labor: {
          quantity: '175',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
      pricingAcceptance: {
        mirror_accessories: {
          selectionStatus: 'user_entered',
          totalAmount: 375,
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'mirror_accessories',
      measurements,
      {
        templateKey: 'bathroom',
      }
    );
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'mirror_accessories',
      input,
      'bathroom',
      resolved
    );
    expect(fill).toBeNull();
    expect(comparison?.total).toBeGreaterThanOrEqual(350);
    expect(comparison?.total).toBeLessThanOrEqual(400);
    expect(comparison?.total).not.toBe(375 * 375);
    expect(comparison?.isComparison).toBe(true);
  });

  it('shows national benchmark for user-entered flat bath accessories allowance', () => {
    const input = inputWith({
      itemQuantities: {
        mirror_accessories: {
          quantity: '500',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        mirror_accessories__allowance: {
          quantity: '500',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
      pricingAcceptance: {
        mirror_accessories: {
          selectionStatus: 'user_entered',
          totalAmount: 500,
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'mirror_accessories',
      measurements,
      {
        templateKey: 'bathroom',
      }
    );
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'mirror_accessories',
      input,
      'bathroom',
      resolved
    );
    expect(fill).toBeNull();
    expect(comparison?.total).toBeGreaterThanOrEqual(350);
    expect(comparison?.total).toBeLessThanOrEqual(400);
    expect(comparison?.isComparison).toBe(true);
  });

  it('shows sqft national benchmark when waterproofing is user-entered flat allowance with shower wall takeoff', () => {
    const input = inputWith({
      showerWallTileSqft: '80',
      itemQuantities: {
        waterproofing__allowance: {
          quantity: '1600',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
      pricingAcceptance: {
        waterproofing: {
          selectionStatus: 'user_entered',
          totalAmount: 1600,
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'waterproofing',
      measurements,
      {
        templateKey: 'bathroom',
      }
    );
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'waterproofing',
      input,
      'bathroom',
      resolved
    );
    // Manual price is active — national average is comparison-only, not a ready fill.
    expect(fill).toBeNull();
    expect(comparison?.total).toBe(960);
    expect(comparison?.isComparison).toBe(true);
    expect(comparison?.basis).toEqual({ quantity: 80, unit: 'sqft' });
  });

  it('uses shower wall takeoff instead of stale 1 SF when waterproofing flat allowance is user-entered', () => {
    const input = inputWith({
      showerWallTileSqft: '80',
      itemQuantities: {
        waterproofing__sqft_basis: {
          quantity: '1',
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        waterproofing__allowance: {
          quantity: '1100',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
      pricingAcceptance: {
        waterproofing: {
          selectionStatus: 'user_entered',
          totalAmount: 1100,
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'waterproofing',
      measurements,
      {
        templateKey: 'bathroom',
      }
    );
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'waterproofing',
      input,
      'bathroom',
      resolved
    );
    expect(fill).toBeNull();
    expect(comparison?.total).toBe(960);
    expect(comparison?.total).not.toBe(12);
    expect(comparison?.isComparison).toBe(true);
  });

  it('shows national benchmark for user-entered shower niche flat allowance', () => {
    const input = inputWith({
      itemQuantities: {
        shower_niche: {
          quantity: '875',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        shower_niche__allowance: {
          quantity: '875',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
      pricingAcceptance: {
        shower_niche: {
          selectionStatus: 'user_entered',
          totalAmount: 875,
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'shower_niche',
      measurements,
      {
        templateKey: 'bathroom',
      }
    );
    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'shower_niche',
      input,
      'bathroom',
      resolved
    );
    expect(fill).toBeNull();
    expect(comparison?.total).toBeGreaterThanOrEqual(700);
    expect(comparison?.total).toBeLessThanOrEqual(750);
    expect(comparison?.isComparison).toBe(true);
  });

  it('suggests ~$375 for bath accessories before apply (1 allowance × national average)', () => {
    const input = inputWith({});
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity(
      'mirror_accessories',
      measurements,
      {
        templateKey: 'bathroom',
      }
    );
    const { fill } = resolveScopeItemSuggestedPricing(
      'mirror_accessories',
      input,
      'bathroom',
      resolved
    );
    expect(fill?.total).toBeGreaterThanOrEqual(350);
    expect(fill?.total).toBeLessThanOrEqual(400);
    expect(fill?.basis?.quantity).toBe(1);
  });

  it('prices trees at the $450/EA national planning rate', () => {
    const input = inputWith({
      landscapeScope: ['trees'],
      treeCount: '5',
    });
    const resolved = resolveChecklistItemQuantity('trees', input, {
      templateKey: 'landscaping',
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'trees',
      input,
      'landscaping',
      resolved
    );
    expect(fill).toMatchObject({
      material: 1250,
      labor: 1000,
      total: 2250,
      basis: { quantity: 5, unit: 'each' },
    });
  });

  it('prices plants separately from trees at $65/EA', () => {
    const input = inputWith({
      landscapeScope: ['plants'],
      plantCount: '5',
    });
    const resolved = resolveChecklistItemQuantity('plants', input, {
      templateKey: 'landscaping',
    });
    const { fill } = resolveScopeItemSuggestedPricing(
      'plants',
      input,
      'landscaping',
      resolved
    );
    expect(fill).toMatchObject({
      material: 175,
      labor: 150,
      total: 325,
      basis: { quantity: 5, unit: 'each' },
    });
  });

  it('applies landscaping minimums for demo, soil prep, and rock', () => {
    const demoInput = inputWith({ demoClearingSqft: '100' });
    const demo = resolveScopeItemSuggestedPricing(
      'demo_clearing',
      demoInput,
      'landscaping',
      resolveChecklistItemQuantity('demo_clearing', demoInput, {
        templateKey: 'landscaping',
      })
    );
    expect(demo.fill?.total).toBe(250);

    const soilInput = inputWith({ soilPrepSqft: '100' });
    const soil = resolveScopeItemSuggestedPricing(
      'soil_prep',
      soilInput,
      'landscaping',
      resolveChecklistItemQuantity('soil_prep', soilInput, {
        templateKey: 'landscaping',
      })
    );
    expect(soil.fill?.total).toBe(300);

    const rockInput = inputWith({
      landscapeScope: ['rock'],
      rockMulchSqft: '50',
    });
    const rock = resolveScopeItemSuggestedPricing(
      'rock',
      rockInput,
      'landscaping',
      resolveChecklistItemQuantity('rock', rockInput, {
        templateKey: 'landscaping',
      })
    );
    expect(rock.fill?.total).toBe(250);
  });

  it('uses approved turf, sod, rock-depth, and irrigation planning splits', () => {
    const turfInput = inputWith({ artificialTurfSqft: '100' });
    const turf = resolveScopeItemSuggestedPricing(
      'artificial_turf',
      turfInput,
      'landscaping',
      resolveChecklistItemQuantity('artificial_turf', turfInput, {
        templateKey: 'landscaping',
      })
    );
    expect(turf.fill).toMatchObject({ material: 850, labor: 750, total: 1600 });

    const sodInput = inputWith({ sodSqft: '100' });
    const sod = resolveScopeItemSuggestedPricing(
      'sod_turf',
      sodInput,
      'landscaping',
      resolveChecklistItemQuantity('sod_turf', sodInput, {
        templateKey: 'landscaping',
      })
    );
    expect(sod.fill).toMatchObject({ material: 85, labor: 90, total: 175 });

    const rockInput = inputWith({ rockMulchSqft: '200' });
    const rock2 = resolveScopeItemSuggestedPricing(
      'rock',
      rockInput,
      'landscaping',
      resolveChecklistItemQuantity('rock', rockInput, {
        templateKey: 'landscaping',
      }),
      null,
      'rock_2in'
    );
    expect(rock2.fill).toMatchObject({ material: 310, labor: 140, total: 450 });

    const dripInput = inputWith({ irrigationZoneCount: '2' });
    const drip = resolveScopeItemSuggestedPricing(
      'irrigation',
      dripInput,
      'landscaping',
      resolveChecklistItemQuantity('irrigation', dripInput, {
        templateKey: 'landscaping',
      }),
      null,
      'drip'
    );
    expect(drip.fill).toMatchObject({ material: 750, labor: 750, total: 1500 });
  });

  it('uses demo clearing QM sqft over notes-derived yard coverage in normalized measurements', () => {
    const notes =
      'Lets create a landscaping bid, front yard and back yard will have both fake grass and rocks backyard is roughly 150 sqft and front yard is 250 sqft';
    const input = inputWith({
      demoClearingSqft: '200',
      landscapeScope: ['demo_clearing'],
      landscapeClearingLevel: 'medium_vegetation',
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input, {
      notes,
      templateKey: 'landscaping',
    });
    const resolved = resolveChecklistItemQuantity(
      'demo_clearing',
      measurements,
      {
        templateKey: 'landscaping',
        notes,
      }
    );
    expect(measurements.demoClearingSqft).toBe(200);
    expect(resolved.quantity).toBe(200);
    expect(resolved.quantitySource).toBe('user_entered');
  });

  it('uses concrete planning rates for flatwork, forms, foundation, and demo', () => {
    const flatworkInput = inputWith({
      concreteScope: ['patios'],
      concreteSqft: '200',
    });
    const flatworkNorm = buildNormalizedScopeMeasurementsFromInput(
      flatworkInput,
      { templateKey: 'concrete' }
    );
    const flatworkResolved = resolveChecklistItemQuantity(
      'pour_flatwork',
      flatworkNorm,
      {
        templateKey: 'concrete',
      }
    );
    const flatwork = resolveScopeItemSuggestedPricing(
      'pour_flatwork',
      flatworkInput,
      'concrete',
      flatworkResolved,
      null
    );
    expect(flatwork.fill).toMatchObject({
      material: 800,
      labor: 1200,
      total: 2000,
    });

    const formsInput = inputWith({
      concreteScope: ['forms'],
      concreteSqft: '200',
    });
    const formsNorm = buildNormalizedScopeMeasurementsFromInput(formsInput, {
      templateKey: 'concrete',
    });
    const forms = resolveScopeItemSuggestedPricing(
      'forms',
      formsInput,
      'concrete',
      resolveChecklistItemQuantity('forms', formsNorm, {
        templateKey: 'concrete',
      }),
      null
    );
    expect(forms.fill).toMatchObject({ material: 150, labor: 250, total: 400 });

    const foundationInput = inputWith({
      concreteScope: ['pour_foundation'],
      concreteCy: '10',
    });
    const foundationNorm = buildNormalizedScopeMeasurementsFromInput(
      foundationInput,
      { templateKey: 'concrete' }
    );
    const foundation = resolveScopeItemSuggestedPricing(
      'pour_foundation',
      foundationInput,
      'concrete',
      resolveChecklistItemQuantity('pour_foundation', foundationNorm, {
        templateKey: 'concrete',
      }),
      null
    );
    expect(foundation.fill?.basis).toEqual({ quantity: 10, unit: 'cy' });
    expect(foundation.fill?.total).toBeGreaterThan(3000);

    const demoInput = inputWith({
      concreteScope: ['demo_removal'],
      concreteDemoSqft: '100',
    });
    const demoNorm = buildNormalizedScopeMeasurementsFromInput(demoInput, {
      templateKey: 'concrete',
    });
    const demo = resolveScopeItemSuggestedPricing(
      'demo_removal',
      demoInput,
      'concrete',
      resolveChecklistItemQuantity('demo_removal', demoNorm, {
        templateKey: 'concrete',
      }),
      null
    );
    expect(demo.fill).toMatchObject({ material: 100, labor: 250, total: 350 });
  });
});

describe('custom scope item pricing units', () => {
  it('resolves cy quantity basis for custom scope lines', () => {
    const cyResolved = resolveChecklistItemQuantity(
      'custom_1',
      {
        itemQuantities: {
          custom_1: { quantity: 12, unit: 'cy', quantitySource: 'user_entered' },
          custom_1__material: { quantity: 2400, unit: 'allowance' },
          custom_1__labor: { quantity: 1800, unit: 'allowance' },
        },
      } as any,
      { templateKey: 'landscaping' }
    );
    expect(cyResolved).toMatchObject({
      unit: 'cy',
      pricingReady: true,
      dualCount: { quantity: 12, unit: 'cy' },
    });
  });

  it('requires material and labor totals for new custom scope pricing', () => {
    const splitResolved = resolveChecklistItemQuantity(
      'custom_2',
      {
        itemQuantities: {
          custom_2: { quantity: '', unit: 'sqft', quantitySource: 'user_entered' },
          custom_2__material: { quantity: 400, unit: 'allowance' },
          custom_2__labor: { quantity: 600, unit: 'allowance' },
        },
      } as any,
      { templateKey: 'landscaping' }
    );
    expect(splitResolved).toMatchObject({
      unit: 'sqft',
      pricingReady: true,
    });

    const lumpOnlyResolved = resolveChecklistItemQuantity(
      'custom_3',
      {
        itemQuantities: {
          custom_3: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
        },
      } as any,
      { templateKey: 'landscaping' }
    );
    expect(lumpOnlyResolved).toMatchObject({
      unit: 'allowance',
      pricingReady: true,
      dualAllowance: { quantity: 1000, unit: 'allowance' },
    });
  });

  it('treats custom scope as applied only after explicit acceptance', () => {
    expect(
      isCustomScopePricingApplied('custom_4', {
        custom_4: { selectionStatus: 'accepted', totalAmount: 500 },
      })
    ).toBe(true);
    expect(
      isCustomScopePricingApplied('custom_4', undefined)
    ).toBe(false);
    expect(isCustomScopePricingApplied('windows', {})).toBe(false);
  });

  it('scales per-unit mat/lab rates by takeoff quantity for custom scope totals', () => {
    expect(
      resolveCustomScopeDraftPricing({
        materialValue: 5,
        laborValue: 7,
        basisQuantity: 1000,
      })
    ).toMatchObject({
      material: 5000,
      labor: 7000,
      total: 12000,
      treatedAsRates: true,
    });

    const resolved = resolveChecklistItemQuantity(
      'custom_5',
      {
        itemQuantities: {
          custom_5: { quantity: 1000, unit: 'sqft', quantitySource: 'user_entered' },
          custom_5__material: { quantity: 5, unit: 'allowance' },
          custom_5__labor: { quantity: 7, unit: 'allowance' },
        },
      } as any,
      { templateKey: 'landscaping' }
    );
    expect(resolved).toMatchObject({
      pricingReady: true,
      dualMaterial: { quantity: 5000, unit: 'allowance' },
      dualLabor: { quantity: 7000, unit: 'allowance' },
    });
  });

  it('keeps stored job totals when mat/lab already exceed rate heuristics', () => {
    expect(
      resolveCustomScopeDraftPricing({
        materialValue: 400,
        laborValue: 600,
        basisQuantity: 1000,
      })
    ).toMatchObject({
      material: 400,
      labor: 600,
      total: 1000,
      treatedAsRates: false,
    });
  });

  it('converts applied job totals back to editor rates', () => {
    expect(customScopeEditorRateValue(5000, 1000)).toBe('5');
    expect(customScopeEditorRateValue(5, 1000)).toBe('5');
    expect(customScopeEditorRateValue(1200, null)).toBe('1200');
    expect(looksLikeCustomScopeUnitRate(5, 1000)).toBe(true);
    expect(looksLikeCustomScopeUnitRate(5000, 1000)).toBe(false);
  });

  it('scales a single mat/lab rate independently for draft totals', () => {
    expect(
      resolveCustomScopeDraftPricing({
        materialValue: 5,
        laborValue: '',
        basisQuantity: 1000,
      })
    ).toMatchObject({
      material: 5000,
      labor: 0,
      total: 5000,
      treatedAsRates: true,
    });
  });

  it('uses trade-aware placeholder examples for custom scope composer', () => {
    expect(
      resolveCustomScopeItemPlaceholder({
        templateKey: 'concrete',
      })
    ).toBe('e.g. curb & gutter, pump truck');
    expect(
      resolveCustomScopeItemPlaceholder({
        templateKey: 'ground_up',
        planImportTradeKey: 'concrete',
      })
    ).toBe('e.g. curb & gutter, pump truck');
    expect(
      resolveCustomScopeItemPlaceholder({
        templateKey: 'bathroom',
      })
    ).toBe('e.g. heated floor, niche shelf');
    expect(
      resolveCustomScopeItemPlaceholder({
        notes: 'Concrete flatwork for driveway and sidewalk.',
      })
    ).toBe('e.g. curb & gutter, pump truck');
    expect(resolveCustomScopeItemPlaceholder({})).toBe(
      'e.g. owner-requested work, misc allowance'
    );
  });
});
