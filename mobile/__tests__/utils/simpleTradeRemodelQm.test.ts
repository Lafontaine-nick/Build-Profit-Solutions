import {
  applyHvacScopeMeasurements,
  dedicatedHvacEquipmentChecklistItems,
  applyHvacScopePanelMeasurementEdit,
  applyHvacScopeSelectionForConfirmedField,
  expandHvacEquipmentScopeDisplayItems,
  formatHvacOptionalAddOnChipCaption,
  releaseHvacVentilationSelection,
  hvacWholeHouseVentilationButtonVisible,
  formatHvacOptionalAddOnIdleHint,
  formatHvacScopeChipQuantity,
  HVAC_VENTILATION_IDLE_HINT,
  HVAC_CAPACITY_OPTION_ID,
  HVAC_EMBEDDED_QUICK_MEASUREMENT_KEYS,
  ROOFING_EMBEDDED_QUICK_MEASUREMENT_KEYS,
  HVAC_EQUIPMENT_OPTION_IDS,
  HVAC_SCOPE_EQUIPMENT_EXPAND_HIGHLIGHT,
  HVAC_SYSTEMS_OPTION_ID,
  isHvacQmScopeItemActive,
  hvacPlanInstallIncludesDistribution,
  hvacDistributionFoldedIntoSystemPrice,
  hvacFieldHasTakeoffEvidence,
  hvacScopeChipReviewState,
  hvacScopeOptionHasExplicitQuantityInNotes,
  hvacScopeOptionIdForMeasurementField,
  inferHvacScopeSelectionsFromNotes,
  inferHvacScopeSelectionsFromMeasurements,
  resolveHvacTradeScopeSelections,
  collapseDeckSurfaceSelections,
  nextDeckSurfaceSelections,
  summarizeHvacScopePanel,
  ROOFING_ACCESSORY_OPTION_IDS,
  ROOFING_DEMO_OPTION_IDS,
  ROOFING_DRAINAGE_OPTION_IDS,
  ROOFING_INSTALL_OPTION_IDS,
  SIMPLE_TRADE_SPECS,
  hvacScopePanelMeasurementRows,
  hvacScopePanelMeasurementValue,
  hvacScopeOptionMentionedInNotes,
  roofingDownspoutQuantityWarning,
  roofingOptionsForIds,
  simpleTradePanelFor,
} from '@/utils/qmScopePanels/simpleTradeRemodel';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import {
  getChecklistItemQuantityRule,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import { filterChecklistItemsForTrade } from '@/utils/planImportTradeConfig';

describe('simple trade QM panels', () => {
  it('routes mini-split notes to mini-split equipment pricing', () => {
    expect(
      inferHvacScopeSelectionsFromNotes('Install one mini-split HVAC system.')
    ).toEqual(['mini_split', 'hvac_systems']);

    const measurements = applyHvacScopeMeasurements({
      tradeScopeSelections: { hvac: ['mini_split'] },
    });
    expect(measurements.hvacEquipmentReplacementCount).toBe('1');
    expect(
      (measurements.itemQuantities as Record<string, { quantity?: number }>)?.[
        'mini_split'
      ]?.quantity
    ).toBe(1);
  });

  it('prices one air handler and leaves the condenser in place', () => {
    const notes = 'Replace one air handler. Leave the condenser in place.';
    expect(inferHvacScopeSelectionsFromNotes(notes)).toEqual(['air_handler']);
    const hydrated = simpleTradePanelFor('hvac').hydrateMeasurements({
      measurements: {
        tradeScopeSelections: {
          hvac: ['hvac_systems', 'hvac_capacity', 'condenser', 'air_handler'],
        },
      },
      notes,
      checklistItems: [],
    });
    expect(
      (hydrated.tradeScopeSelections as { hvac?: string[] }).hvac
    ).toEqual(['air_handler']);
    const priced = resolveScopeItemSuggestedPricing(
      'air_handler',
      hydrated,
      'hvac',
      { quantity: 1, unit: 'each' },
      undefined,
      notes
    );
    expect(priced.fill?.total).toBe(5500);
  });

  it('prices a condenser and thermostats without the system package', () => {
    const notes =
      'Replace one condenser and two thermostats. Leave the furnace in place.';
    expect(inferHvacScopeSelectionsFromNotes(notes)).toEqual(
      expect.arrayContaining(['condenser', 'thermostat'])
    );
    expect(inferHvacScopeSelectionsFromNotes(notes)).not.toContain('furnace');
    const hydrated = simpleTradePanelFor('hvac').hydrateMeasurements({
      measurements: {
        tradeScopeSelections: {
          hvac: [
            'hvac_systems',
            'hvac_capacity',
            'furnace',
            'condenser',
            'thermostat',
          ],
        },
      },
      notes,
      checklistItems: [],
    });
    const selections = (hydrated.tradeScopeSelections as { hvac?: string[] })
      .hvac;
    expect(selections).toEqual(expect.arrayContaining(['condenser', 'thermostat']));
    expect(selections).toEqual(
      expect.not.arrayContaining(['hvac_systems', 'hvac_capacity', 'furnace'])
    );
    expect(resolveHvacTradeScopeSelections(hydrated, notes)).toEqual(
      expect.not.arrayContaining(['hvac_systems', 'hvac_capacity'])
    );
  });

  it('prices one mini-split and leaves the ductwork in place', () => {
    const notes = 'Install one mini-split. Leave the ductwork in place.';
    expect(inferHvacScopeSelectionsFromNotes(notes)).toEqual(['mini_split']);
    const hydrated = simpleTradePanelFor('hvac').hydrateMeasurements({
      measurements: {
        tradeScopeSelections: { hvac: ['hvac_systems', 'ductwork'] },
      },
      notes,
      checklistItems: [],
    });
    expect(
      (hydrated.tradeScopeSelections as { hvac?: string[] }).hvac
    ).toEqual(['mini_split']);
    expect(resolveHvacTradeScopeSelections(hydrated, notes)).toEqual([
      'mini_split',
    ]);
    const cards = expandHvacEquipmentScopeDisplayItems(
      [
        {
          id: 'hvac',
          label: 'HVAC work',
          state: 'included',
          inputType: 'yes_no',
        },
      ],
      hydrated
    );
    expect(cards.some(card => card.id === 'mini_split' && card.state === 'included')).toBe(
      true
    );
    const priced = resolveScopeItemSuggestedPricing(
      'mini_split',
      hydrated,
      'hvac',
      { quantity: 1, unit: 'each' },
      undefined,
      notes
    );
    expect(priced.fill?.total).toBe(7500);
  });

  it('prices supply registers once and leaves the furnace off', () => {
    const notes = 'Install 4 supply registers. Leave the furnace in place.';
    expect(inferHvacScopeSelectionsFromNotes(notes)).toEqual(['registers']);
    expect(
      dedicatedHvacEquipmentChecklistItems(notes).map(item => item.id)
    ).toEqual(['supply_registers']);
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'hvac',
      projectType: 'hvac',
    });
    expect(parsed.hvacSupplyRegisterCount).toBe(4);
    const priced = resolveScopeItemSuggestedPricing(
      'supply_registers',
      { ...parsed, scopeNotes: notes },
      'hvac',
      { quantity: 4, unit: 'each' },
      undefined,
      notes
    );
    expect(priced.fill?.total).toBe(600);
  });

  it('prices two furnaces and leaves the ductwork in place', () => {
    const notes = 'Replace two furnaces. Leave the ductwork in place.';
    expect(inferHvacScopeSelectionsFromNotes(notes)).toEqual(['furnace']);
    expect(dedicatedHvacEquipmentChecklistItems(notes).map(item => item.id)).toEqual([
      'furnace',
    ]);
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'hvac',
      projectType: 'hvac',
    });
    expect(parsed.hvacEquipmentReplacementCount).toBe(2);
    const hydrated = simpleTradePanelFor('hvac').hydrateMeasurements({
      measurements: {
        ...parsed,
        tradeScopeSelections: {
          hvac: ['hvac_systems', 'hvac_capacity', 'furnace', 'ductwork'],
        },
      },
      notes,
      checklistItems: [],
    });
    expect(
      (hydrated.tradeScopeSelections as { hvac?: string[] }).hvac
    ).toEqual(['furnace']);
    expect(String(hydrated.hvacEquipmentReplacementCount)).toBe('2');
    const priced = resolveScopeItemSuggestedPricing(
      'furnace',
      hydrated,
      'hvac',
      { quantity: 2, unit: 'each' },
      undefined,
      notes
    );
    expect(priced.fill?.total).toBe(12000);
  });

  it('prices a furnace once and leaves ductwork and the system package off', () => {
    const notes = 'Replace one furnace. Leave the ductwork in place.';
    expect(inferHvacScopeSelectionsFromNotes(notes)).toEqual(['furnace']);
    const hydrated = simpleTradePanelFor('hvac').hydrateMeasurements({
      measurements: {
        tradeScopeSelections: {
          hvac: ['hvac_systems', 'hvac_capacity', 'furnace', 'ductwork'],
        },
      },
      notes,
      checklistItems: [],
    });
    expect(
      (hydrated.tradeScopeSelections as { hvac?: string[] }).hvac
    ).toEqual(['furnace']);
  });

  it('keeps an HVAC service call in the bid with a blank price', () => {
    const notes =
      'One HVAC service call to diagnose the furnace. Do not replace the equipment.';
    expect(inferHvacScopeSelectionsFromNotes(notes)).toEqual(['service_call']);
    expect(inferItemStateFromNotes('furnace', notes)).toBe('excluded');
    expect(inferItemStateFromNotes('equipment_replace', notes)).toBe(
      'excluded'
    );
    const priced = resolveScopeItemSuggestedPricing(
      'service_call',
      { hvacServiceCallCount: 1, scopeNotes: notes },
      'hvac',
      { quantity: 1, unit: 'each' },
      undefined,
      notes
    );
    expect(priced.fill).toBeNull();
  });

  it('leaves a heat pump in place off a register and return bid', () => {
    const notes =
      'Install 8 supply registers and 2 return grilles. Leave the heat pump in place.';

    expect(inferHvacScopeSelectionsFromNotes(notes)).toEqual([
      'registers',
      'returns',
    ]);
    expect(hvacScopeOptionMentionedInNotes('heat_pump', notes)).toBe(false);
    expect(
      hvacScopeOptionMentionedInNotes(HVAC_SYSTEMS_OPTION_ID, notes)
    ).toBe(false);
    expect(hvacScopeOptionMentionedInNotes('registers', notes)).toBe(true);
    expect(hvacScopeOptionMentionedInNotes('returns', notes)).toBe(true);
    expect(inferItemStateFromNotes('equipment_replace', notes)).toBe(
      'excluded'
    );

    const resolved = resolveHvacTradeScopeSelections(
      {
        tradeScopeSelections: {
          hvac: ['hvac_systems', 'heat_pump', 'registers', 'returns'],
        },
      },
      notes
    );
    expect(resolved).toEqual(expect.arrayContaining(['registers', 'returns']));
    expect(resolved).not.toEqual(
      expect.arrayContaining(['hvac_systems', 'heat_pump'])
    );
  });

  it('puts a new furnace install on its own pricing card', () => {
    const notes = 'Install a new furnace';
    expect(isHvacQmScopeItemActive('furnace', {}, notes)).toBe(true);
    const display = expandHvacEquipmentScopeDisplayItems(
      [{ id: 'hvac', label: 'HVAC', state: 'included', inputType: 'yes_no' }],
      {},
      notes
    );
    expect(display.find(item => item.id === 'furnace')).toMatchObject({
      label: 'Furnace',
      state: 'included',
    });
    const quantity = resolveChecklistItemQuantity('furnace', { itemQuantities: {} } as any, {
      notes,
      templateKey: 'hvac',
    });
    expect(quantity).toMatchObject({ quantity: 1, unit: 'each', pricingReady: true });
    expect(
      resolveScopeItemSuggestedPricing('furnace', { itemQuantities: {} }, 'hvac', quantity, null, null, notes)
        .fill?.total
    ).toBe(6000);
  });

  it('keeps a new furnace on the furnace line', () => {
    const notes = 'Install a new furnace';
    expect(inferHvacScopeSelectionsFromNotes(notes)).toEqual(['furnace']);
    expect(hvacScopeOptionMentionedInNotes(HVAC_SYSTEMS_OPTION_ID, notes)).toBe(
      false
    );
    expect(hvacScopeOptionMentionedInNotes(HVAC_CAPACITY_OPTION_ID, notes)).toBe(
      false
    );
    const resolved = resolveHvacTradeScopeSelections(
      {
        tradeScopeSelections: {
          hvac: ['hvac_systems', 'hvac_capacity', 'furnace'],
        },
        hvacSystemTons: 4,
      },
      notes
    );
    expect(resolved).toEqual(['furnace']);
  });

  it('opens systems and capacity when the note names a new system or unit', () => {
    for (const notes of [
      'Install a new HVAC system',
      'Install a new unit',
      'Install a new heat-pump system',
    ]) {
      expect(inferHvacScopeSelectionsFromNotes(notes)).toEqual(
        expect.arrayContaining(['hvac_systems'])
      );
      const resolved = resolveHvacTradeScopeSelections({}, notes);
      expect(resolved).toEqual(
        expect.arrayContaining(['hvac_systems', 'hvac_capacity'])
      );
      expect(resolved).not.toContain('furnace');
    }
  });

  it('keeps a named heat pump, mini-split, and air handler off the system package', () => {
    expect(inferHvacScopeSelectionsFromNotes('Replace the heat pump')).toEqual([
      'heat_pump',
    ]);
    expect(inferHvacScopeSelectionsFromNotes('Replace the mini-split')).toEqual([
      'mini_split',
    ]);
    expect(inferHvacScopeSelectionsFromNotes('Replace the air handler')).toEqual([
      'air_handler',
    ]);
  });

  it('routes heat-pump notes to heat-pump equipment pricing', () => {
    expect(
      inferHvacScopeSelectionsFromNotes(
        'Remove the existing HVAC system and ductwork, then replace one heat-pump system, install one thermostat and four registers.'
      )
    ).toEqual(
      expect.arrayContaining([
        'hvac_systems',
        'heat_pump',
        'ductwork',
        'thermostat',
        'registers',
      ])
    );
  });

  it('keeps compact mixed HVAC options limited to note-backed work', () => {
    const notes =
      'Remove the existing HVAC system and ductwork, then replace one heat-pump system, install 120 LF ductwork, one thermostat, four registers.';

    expect(
      [
        HVAC_SYSTEMS_OPTION_ID,
        HVAC_CAPACITY_OPTION_ID,
        'heat_pump',
        'ductwork',
        'thermostat',
        'registers',
      ].filter(optionId => hvacScopeOptionMentionedInNotes(optionId, notes))
    ).toEqual([
      HVAC_SYSTEMS_OPTION_ID,
      HVAC_CAPACITY_OPTION_ID,
      'heat_pump',
      'ductwork',
      'thermostat',
      'registers',
    ]);
    expect(hvacScopeOptionMentionedInNotes('furnace', notes)).toBe(false);
    expect(hvacScopeOptionMentionedInNotes('condenser', notes)).toBe(false);
    expect(hvacScopeOptionMentionedInNotes('returns', notes)).toBe(false);
    expect(hvacScopeOptionMentionedInNotes('ventilation', notes)).toBe(false);
  });

  it('keeps a selected heat pump off the system package until the note names one', () => {
    const measurements = applyHvacScopeMeasurements({
      tradeScopeSelections: { hvac: ['heat_pump'] },
      itemQuantities: {
        equipment_replace__heat_pump: { quantity: 1 },
      },
    });
    expect(measurements.hvacSystemCount).toBe(1);
    expect(resolveHvacTradeScopeSelections(measurements)).toEqual(['heat_pump']);
    expect(resolveHvacTradeScopeSelections(measurements)).not.toEqual(
      expect.arrayContaining([HVAC_SYSTEMS_OPTION_ID, HVAC_CAPACITY_OPTION_ID])
    );
    const synced = simpleTradePanelFor('hvac').syncScopeItems(
      [
        {
          id: 'hvac',
          label: 'HVAC',
          inputType: 'yes_no',
          state: 'included',
          noteBacked: true,
        },
        {
          id: 'ductwork',
          label: 'Ductwork',
          inputType: 'yes_no',
          state: 'included',
          noteBacked: true,
        },
        {
          id: 'thermostat',
          label: 'Thermostat',
          inputType: 'yes_no',
          state: 'included',
          noteBacked: true,
        },
      ],
      {
        ...measurements,
        tradeScopeSelections: {
          hvac: ['hvac_systems', 'heat_pump', 'ductwork', 'thermostat'],
        },
      }
    );
    expect(synced.find(item => item.id === 'hvac')?.state).toBe('excluded');
    expect(synced.find(item => item.id === 'heat_pump')?.state).toBe('included');
    expect(synced.find(item => item.id === 'ductwork')?.state).toBe('included');
    expect(synced.find(item => item.id === 'thermostat')?.state).toBe('included');
  });

  it('keeps wood and composite deck as one surface', () => {
    expect(
      nextDeckSurfaceSelections(['composite_deck', 'railings'], 'wood_deck')
    ).toEqual(['railings', 'wood_deck']);
    expect(
      nextDeckSurfaceSelections(['wood_deck', 'railings'], 'composite_deck')
    ).toEqual(['railings', 'composite_deck']);
    expect(
      collapseDeckSurfaceSelections([
        'composite_deck',
        'wood_deck',
        'stairs',
      ])
    ).toEqual(['wood_deck', 'stairs']);
    expect(
      nextDeckSurfaceSelections(
        ['composite_deck', 'wood_deck'],
        'composite_deck'
      )
    ).toEqual(['composite_deck']);
  });

  it('defines the three remaining simple-trade templates', () => {
    expect(Object.keys(SIMPLE_TRADE_SPECS)).toEqual(
      expect.arrayContaining(['deck_patio', 'hvac', 'roofing'])
    );
    expect(Object.keys(SIMPLE_TRADE_SPECS)).not.toContain('concrete');
  });

  it('keeps the provided scope labels mapped to priceable checklist ids', () => {
    expect(
      SIMPLE_TRADE_SPECS.deck_patio.options.find(
        option => option.id === 'wood_fence'
      )?.canonicalId
    ).toBe('landscaping');
    expect(
      SIMPLE_TRADE_SPECS.hvac.options.find(option => option.id === 'furnace')
        ?.canonicalId
    ).toBe('furnace');
    expect(
      SIMPLE_TRADE_SPECS.roofing.options.find(
        option => option.id === 'shingles'
      )?.canonicalId
    ).toBe('shingles_roofing');
  });

  it('registers each template as an active QM panel', () => {
    expect(simpleTradePanelFor('deck_patio').templateKeys).toEqual([
      'deck_patio',
    ]);
    expect(simpleTradePanelFor('hvac').templateKeys).toEqual(['hvac']);
    expect(simpleTradePanelFor('roofing').templateKeys).toEqual(['roofing']);
  });

  it('syncs Roofing selector deselection to excluded checklist scope items', () => {
    const panel = simpleTradePanelFor('roofing');
    const items = [
      { id: 'shingles_roofing', state: 'included' as const },
      { id: 'drip_edge', state: 'included' as const },
      { id: 'ridge_cap', state: 'included' as const },
    ];

    const selected = panel.syncScopeItems(items, {
      tradeScopeSelections: { roofing: ['shingles', 'drip_edge'] },
    });
    expect(selected.find(item => item.id === 'shingles_roofing')?.state).toBe(
      'included'
    );
    expect(selected.find(item => item.id === 'drip_edge')?.state).toBe(
      'included'
    );
    expect(selected.find(item => item.id === 'ridge_cap')?.state).toBe(
      'excluded'
    );

    const deselected = panel.syncScopeItems(selected, {
      tradeScopeSelections: { roofing: null },
    });
    expect(deselected.find(item => item.id === 'shingles_roofing')?.state).toBe(
      'excluded'
    );
    expect(deselected.find(item => item.id === 'drip_edge')?.state).toBe(
      'excluded'
    );
  });

  it('adds the Underlayment upgrade to the canonical roofing scope card', () => {
    const panel = simpleTradePanelFor('roofing');
    const items = [
      { id: 'underlayment', state: 'excluded' as const },
      { id: 'shingles_roofing', state: 'excluded' as const },
    ];

    const selected = panel.syncScopeItems(items, {
      tradeScopeSelections: { roofing: ['underlayment'] },
      roofAreaSqft: 2500,
    });

    expect(selected.find(item => item.id === 'underlayment')).toMatchObject({
      state: 'included',
      noteBacked: true,
    });
  });

  it('maps Ice & water shield selections onto the dedicated card', () => {
    const panel = simpleTradePanelFor('roofing');
    const selected = panel.syncScopeItems(
      [{ id: 'ice_water_shield', state: 'excluded' as const }],
      { tradeScopeSelections: { roofing: ['ice_water_shield'] } }
    );

    expect(selected.find(item => item.id === 'ice_water_shield')?.state).toBe(
      'included'
    );
  });

  it('partitions roofing QM options into install, tear-off, accessory, and drainage cards', () => {
    const allIds = SIMPLE_TRADE_SPECS.roofing.options.map(option => option.id);
    const grouped = [
      ...ROOFING_DEMO_OPTION_IDS,
      ...ROOFING_INSTALL_OPTION_IDS,
      ...ROOFING_ACCESSORY_OPTION_IDS,
      ...ROOFING_DRAINAGE_OPTION_IDS,
    ];
    expect(grouped).toEqual(expect.arrayContaining(allIds));
    expect(new Set(grouped).size).toBe(allIds.length);
    expect(
      roofingOptionsForIds(ROOFING_DEMO_OPTION_IDS).map(option => option.id)
    ).toEqual(['tear_off']);
    expect(roofingOptionsForIds(ROOFING_DRAINAGE_OPTION_IDS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'gutters',
          measurementKey: 'roofGutterLf',
          unit: 'LF',
        }),
        expect.objectContaining({
          id: 'downspouts',
          measurementKey: 'roofDownspoutCount',
          unit: 'EA',
        }),
      ])
    );
  });

  it('syncs gutters and downspouts independently from QM selections', () => {
    const panel = simpleTradePanelFor('roofing');
    const items = [
      { id: 'gutters', state: 'excluded' as const },
      { id: 'downspouts', state: 'excluded' as const },
    ];
    const selected = panel.syncScopeItems(items, {
      tradeScopeSelections: { roofing: ['gutters', 'downspouts'] },
      roofGutterLf: 150,
      roofDownspoutCount: 4,
    });
    expect(selected.find(item => item.id === 'gutters')?.state).toBe(
      'included'
    );
    expect(selected.find(item => item.id === 'downspouts')?.state).toBe(
      'included'
    );

    const guttersOnly = panel.syncScopeItems(selected, {
      tradeScopeSelections: { roofing: ['gutters'] },
      roofGutterLf: 150,
      roofDownspoutCount: 4,
    });
    expect(guttersOnly.find(item => item.id === 'gutters')?.state).toBe(
      'included'
    );
    expect(guttersOnly.find(item => item.id === 'downspouts')?.state).toBe(
      'excluded'
    );
  });

  it('uses LF for gutters and EA for downspouts quantity rules', () => {
    expect(getChecklistItemQuantityRule('gutters', 'roofing')).toMatchObject({
      defaultUnit: 'lf',
      measurementKey: 'roofGutterLf',
    });
    expect(getChecklistItemQuantityRule('downspouts', 'roofing')).toMatchObject(
      {
        defaultUnit: 'each',
        measurementKey: 'roofDownspoutCount',
      }
    );
  });

  it('flags an unusually high downspout count for review', () => {
    expect(
      roofingDownspoutQuantityWarning({
        roofGutterLf: '200',
        roofDownspoutCount: '200',
      })
    ).toContain('200 downspouts is unusually high');
    expect(
      roofingDownspoutQuantityWarning({ roofDownspoutCount: '6' })
    ).toBeNull();
  });

  it('maps HVAC scope chips to canonical measurement keys', () => {
    expect(SIMPLE_TRADE_SPECS.hvac.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: HVAC_SYSTEMS_OPTION_ID,
          measurementKey: 'hvacSystemCount',
          unit: 'each',
        }),
        expect.objectContaining({
          id: 'furnace',
          canonicalId: 'furnace',
          measurementKey: 'hvacEquipmentReplacementCount',
          unit: 'each',
        }),
        expect.objectContaining({
          id: 'ductwork',
          canonicalId: 'ductwork',
          measurementKey: 'hvacDuctworkLf',
          unit: 'LF',
        }),
        expect.objectContaining({
          id: 'thermostat',
          canonicalId: 'thermostat',
          measurementKey: 'hvacThermostatCount',
          unit: 'each',
        }),
        expect.objectContaining({
          id: 'ventilation',
          canonicalId: 'ventilation',
          measurementKey: 'hvacVentilationCount',
          unit: 'each',
        }),
        expect.objectContaining({
          id: 'registers',
          canonicalId: 'supply_registers',
          measurementKey: 'hvacSupplyRegisterCount',
          unit: 'each',
        }),
        expect.objectContaining({
          id: 'returns',
          canonicalId: 'return_grilles',
          measurementKey: 'hvacReturnGrilleCount',
          unit: 'each',
        }),
      ])
    );
    for (const id of HVAC_EQUIPMENT_OPTION_IDS) {
      expect(
        SIMPLE_TRADE_SPECS.hvac.options.find(option => option.id === id)
      ).not.toMatchObject({
        measurementKey: 'floorAreaSqft',
      });
    }
  });

  it('embeds HVAC chip-owned quick measurement keys including system tons', () => {
    expect(HVAC_EMBEDDED_QUICK_MEASUREMENT_KEYS).toEqual(
      expect.arrayContaining([
        'hvacSystemCount',
        'hvacSystemTons',
        'hvacDuctworkLf',
        'hvacThermostatCount',
      ])
    );
  });

  it('embeds roofing chip-owned quick measurement keys in the scope panel', () => {
    expect(ROOFING_EMBEDDED_QUICK_MEASUREMENT_KEYS).toEqual(
      expect.arrayContaining([
        'roofSquares',
        'roofDripEdgeLf',
        'roofRidgeCapLf',
        'roofDeckingReplacementSqft',
        'storyCount',
      ])
    );
  });

  it('hydrates roofing chip selections from job notes on first open', () => {
    const panel = simpleTradePanelFor('roofing');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'roofing',
      wholeHomeLayout: false,
      notes:
        'Tear off and install new architectural shingles. Ice & water at eaves, ridge vent, drip edge.',
      hasSitePhotos: false,
      measurements: { roofSquares: '22' },
      checklistItems: [],
    });
    expect(hydrated.tradeScopeSelections?.roofing).toEqual(
      expect.arrayContaining([
        'tear_off',
        'shingles',
        'ice_water_shield',
        'ridge_vent',
        'drip_edge',
      ])
    );
  });

  it('does not infer shingles from tear-off-only roof squares', () => {
    const panel = simpleTradePanelFor('roofing');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'roofing',
      wholeHomeLayout: false,
      notes: 'Tear off and remove the existing roof, then repair the decking.',
      hasSitePhotos: false,
      measurements: { roofSquares: '28' },
      checklistItems: [],
    });

    expect(hydrated.tradeScopeSelections?.roofing).toContain('tear_off');
    expect(hydrated.tradeScopeSelections?.roofing).not.toContain('shingles');
  });

  it('treats replacement roofing squares as install scope without inventing tear-off', () => {
    const panel = simpleTradePanelFor('roofing');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'room_remodel',
      wholeHomeLayout: false,
      notes: 'Replace 28 roofing squares and 120 LF gutters.',
      measurements: {},
      checklistItems: [
        {
          id: 'tear_off',
          label: 'Existing roof / tear-off',
          state: 'included',
          inputType: 'yes_no',
        },
      ],
    });

    expect(hydrated.tradeScopeSelections?.roofing).toContain('shingles');
    expect(hydrated.tradeScopeSelections?.roofing).not.toContain('tear_off');
  });

  it('preselects drainage options from cross-trade roofing notes', () => {
    const panel = simpleTradePanelFor('roofing');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'roofing',
      wholeHomeLayout: false,
      notes:
        'Tear off and remove the existing roof, then replace 28 roofing squares, repair 180 sqft decking, install gutters and downspouts, replace four windows, repair siding, install R-38 attic insulation, repair drywall, and paint ceilings.',
      hasSitePhotos: false,
      measurements: { roofSquares: 28, roofDeckingReplacementSqft: 180 },
      checklistItems: [],
    });

    expect(hydrated.tradeScopeSelections?.roofing).toEqual(
      expect.arrayContaining([
        'tear_off',
        'decking_repair',
        'gutters',
        'downspouts',
      ])
    );
  });

  it('does not override saved roofing chip selections with note inference', () => {
    const panel = simpleTradePanelFor('roofing');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'roofing',
      wholeHomeLayout: false,
      notes: 'Tear off and install new architectural shingles.',
      hasSitePhotos: false,
      measurements: {
        tradeScopeSelections: { roofing: ['gutters'] },
      },
      checklistItems: [],
    });
    expect(hydrated.tradeScopeSelections?.roofing).toEqual(
      expect.arrayContaining(['gutters', 'tear_off', 'shingles'])
    );
  });

  it('adds ice & water when notes mention it but other chips were already saved', () => {
    const panel = simpleTradePanelFor('roofing');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'roofing',
      wholeHomeLayout: false,
      notes:
        '22-square re-roof with architectural shingles, tear-off 1 layer, ice & water at eaves, drip edge',
      hasSitePhotos: false,
      measurements: {
        tradeScopeSelections: {
          roofing: ['tear_off', 'shingles', 'drip_edge'],
        },
        roofSquares: '22',
        roofDripEdgeLf: '188',
        roofIceWaterShieldSqft: '281',
      },
      checklistItems: [],
    });
    expect(hydrated.tradeScopeSelections?.roofing).toEqual(
      expect.arrayContaining(['ice_water_shield'])
    );
  });

  it('adds ice & water when only a short summary is passed but full notes are in ctx', () => {
    const panel = simpleTradePanelFor('roofing');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'roofing',
      wholeHomeLayout: false,
      notes:
        '22 square roof replacement\n\n22-square re-roof with architectural shingles, tear-off 1 layer, ice & water at eaves, drip edge',
      hasSitePhotos: false,
      measurements: {
        tradeScopeSelections: { roofing: ['drip_edge'] },
        roofSquares: '22',
        roofDripEdgeLf: '188',
      },
      checklistItems: [],
    });
    expect(hydrated.tradeScopeSelections?.roofing).toEqual(
      expect.arrayContaining(['ice_water_shield'])
    );
  });

  it('infers HVAC scope chips from plan takeoff without bulk-selecting equipment types', () => {
    const inferred = inferHvacScopeSelectionsFromMeasurements({
      hvacSystemCount: '2',
      hvacSystemTons: '5',
      hvacDuctworkLf: '150',
      hvacSupplyRegisterCount: '10',
      hvacReturnGrilleCount: '8',
      hvacThermostatCount: '2',
      quickMeasurementSources: {
        hvacSystemCount: 'contractor_confirmed_from_plan_review',
        hvacSystemTons: 'contractor_confirmed_from_plan_review',
        hvacDuctworkLf: 'contractor_confirmed_from_plan_review',
        hvacSupplyRegisterCount: 'contractor_confirmed_from_plan_review',
        hvacReturnGrilleCount: 'contractor_confirmed_from_plan_review',
        hvacThermostatCount: 'contractor_confirmed_from_plan_review',
      },
    });
    expect(inferred).toEqual(
      expect.arrayContaining([
        HVAC_SYSTEMS_OPTION_ID,
        HVAC_CAPACITY_OPTION_ID,
        'ductwork',
        'registers',
        'returns',
        'thermostat',
      ])
    );
    expect(inferred).not.toContain('furnace');
    expect(inferred).not.toContain('heat_pump');
  });

  it('resolveHvacTradeScopeSelections only selects confirmed takeoff chips', () => {
    expect(
      resolveHvacTradeScopeSelections({
        hvacSystemCount: '2',
        hvacSystemTons: '5',
        hvacDuctworkLf: '150',
        hvacSupplyRegisterCount: '10',
        hvacReturnGrilleCount: '8',
        hvacThermostatCount: '2',
        quickMeasurementSources: {
          hvacSystemCount: 'contractor_confirmed_from_plan_review',
          hvacSystemTons: 'needs_confirmation',
          hvacDuctworkLf: 'needs_confirmation',
          hvacSupplyRegisterCount: 'needs_confirmation',
          hvacReturnGrilleCount: 'needs_confirmation',
          hvacThermostatCount: 'needs_confirmation',
        },
        tradeScopeSelections: {
          hvac: [
            HVAC_SYSTEMS_OPTION_ID,
            HVAC_CAPACITY_OPTION_ID,
            'ductwork',
            'registers',
            'returns',
            'thermostat',
          ],
        },
      })
    ).toEqual([HVAC_SYSTEMS_OPTION_ID]);
  });

  it('does not select needs_confirmation HVAC chips from takeoff evidence', () => {
    const inferred = inferHvacScopeSelectionsFromMeasurements({
      hvacSystemCount: '2',
      hvacDuctworkLf: '150',
      hvacThermostatCount: '2',
      quickMeasurementSources: {
        hvacSystemCount: 'contractor_confirmed_from_plan_review',
        hvacDuctworkLf: 'contractor_confirmed_from_plan_review',
        hvacThermostatCount: 'needs_confirmation',
      },
    });
    expect(inferred).toEqual(
      expect.arrayContaining([HVAC_SYSTEMS_OPTION_ID, 'ductwork'])
    );
    expect(inferred).not.toContain('thermostat');
  });

  it('hydrates HVAC chip selections from plan measurements on first open', () => {
    const panel = simpleTradePanelFor('hvac');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'hvac',
      wholeHomeLayout: false,
      notes: '',
      hasSitePhotos: false,
      measurements: {
        hvacSystemCount: '2',
        hvacSystemTons: '5',
        hvacDuctworkLf: '150',
        hvacSupplyRegisterCount: '10',
        hvacReturnGrilleCount: '8',
        hvacThermostatCount: '2',
        quickMeasurementSources: {
          hvacSystemCount: 'contractor_confirmed_from_plan_review',
          hvacSystemTons: 'contractor_confirmed_from_plan_review',
          hvacDuctworkLf: 'contractor_confirmed_from_plan_review',
          hvacSupplyRegisterCount: 'contractor_confirmed_from_plan_review',
          hvacReturnGrilleCount: 'contractor_confirmed_from_plan_review',
          hvacThermostatCount: 'contractor_confirmed_from_plan_review',
        },
      },
      checklistItems: [],
    });
    expect(hydrated.tradeScopeSelections?.hvac).toEqual(
      expect.arrayContaining([
        HVAC_SYSTEMS_OPTION_ID,
        HVAC_CAPACITY_OPTION_ID,
        'ductwork',
        'registers',
        'returns',
        'thermostat',
      ])
    );
    expect(hydrated.tradeScopeSelections?.hvac).not.toContain('furnace');
  });

  it('does not invent HVAC quantities for unquantified note-backed selections', () => {
    const panel = simpleTradePanelFor('hvac');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'hvac',
      wholeHomeLayout: false,
      notes: 'Replace the heat-pump HVAC system and install ductwork.',
      hasSitePhotos: false,
      measurements: {},
      checklistItems: [],
    });

    expect(hydrated.tradeScopeSelections?.hvac).toEqual(
      expect.arrayContaining(['hvac_systems', 'heat_pump', 'ductwork'])
    );
    expect(hydrated.hvacSystemCount).toBeUndefined();
    expect(hydrated.hvacDuctworkLf).toBeUndefined();
    expect(hydrated.itemQuantities).not.toHaveProperty(
      'equipment_replace__heat_pump'
    );
  });

  it('clears non-authoritative heat-pump defaults when notes require confirmation', () => {
    const panel = simpleTradePanelFor('hvac');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'hvac',
      wholeHomeLayout: false,
      notes:
        'Install a new heat-pump system with thermostat, supply registers, and return grilles. System count and tonnage must be confirmed.',
      hasSitePhotos: false,
      measurements: {
        hvacEquipmentReplacementCount: 1,
        quickMeasurementSources: {
          hvacEquipmentReplacementCount: 'ai_verified',
        },
        itemQuantities: {
          equipment_replace__heat_pump: {
            quantity: 1,
            quantitySource: 'selection_default',
          },
        },
      },
      checklistItems: [],
    });

    expect(hydrated.hvacEquipmentReplacementCount).toBeUndefined();
    expect(hydrated.itemQuantities).not.toHaveProperty(
      'equipment_replace__heat_pump'
    );
  });

  it('preserves explicit mixed HVAC quantities while leaving capacity for measurement', () => {
    const panel = simpleTradePanelFor('hvac');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'hvac',
      wholeHomeLayout: false,
      notes:
        'Remove the existing HVAC system and ductwork, then replace one heat-pump system, install 120 LF ductwork, one thermostat, four registers.',
      hasSitePhotos: false,
      measurements: {
        hvacSystemCount: 1,
        hvacEquipmentReplacementCount: 1,
        hvacDuctworkLf: 120,
        hvacThermostatCount: 1,
        hvacSupplyRegisterCount: 4,
      },
      checklistItems: [],
    });

    expect(hydrated.hvacSystemCount).toBe(1);
    expect(hydrated.hvacSystemTons).toBeUndefined();
    expect(hydrated.itemQuantities).toMatchObject({
      equipment_replace__heat_pump: {
        quantity: 1,
      },
    });
  });

  it('marks selected HVAC chips awaiting review as needs_confirmation', () => {
    const furnace = SIMPLE_TRADE_SPECS.hvac.options.find(
      option => option.id === 'furnace'
    )!;
    const ductwork = SIMPLE_TRADE_SPECS.hvac.options.find(
      option => option.id === 'ductwork'
    )!;
    const measurements = {
      hvacSystemCount: '2',
      hvacDuctworkLf: '150',
      quickMeasurementSources: {
        hvacSystemCount: 'contractor_confirmed_from_plan_review',
        hvacDuctworkLf: 'needs_confirmation',
      },
      tradeScopeSelections: {
        hvac: [HVAC_SYSTEMS_OPTION_ID, 'ductwork'],
      },
    };
    expect(hvacScopeChipReviewState(measurements, ductwork, ['ductwork'])).toBe(
      'needs_confirmation'
    );
    expect(hvacScopeChipReviewState(measurements, furnace, ['furnace'])).toBe(
      'confirmed'
    );
    expect(hvacFieldHasTakeoffEvidence(measurements, 'hvacDuctworkLf')).toBe(
      true
    );
  });

  it('drops stale bulk equipment selections during hydrate', () => {
    const panel = simpleTradePanelFor('hvac');
    const hydrated = panel.hydrateMeasurements({
      templateKey: 'hvac',
      wholeHomeLayout: false,
      notes: '',
      hasSitePhotos: false,
      measurements: {
        hvacSystemCount: '2',
        hvacDuctworkLf: '150',
        tradeScopeSelections: {
          hvac: ['furnace', 'condenser', 'ductwork'],
        },
        quickMeasurementSources: {
          hvacSystemCount: 'contractor_confirmed_from_plan_review',
          hvacDuctworkLf: 'contractor_confirmed_from_plan_review',
        },
      },
      checklistItems: [],
    });
    expect(hydrated.tradeScopeSelections?.hvac).toEqual(
      expect.arrayContaining([HVAC_SYSTEMS_OPTION_ID, 'ductwork'])
    );
    expect(hydrated.tradeScopeSelections?.hvac).not.toContain('furnace');
    expect(hydrated.tradeScopeSelections?.hvac).not.toContain('condenser');
  });

  it('formats HVAC chip quantity captions for systems, equipment, and distribution', () => {
    const measurements = {
      hvacSystemCount: '2',
      hvacDuctworkLf: '150',
      hvacSupplyRegisterCount: '10',
    };
    const systems = SIMPLE_TRADE_SPECS.hvac.options.find(
      option => option.id === HVAC_SYSTEMS_OPTION_ID
    )!;
    const furnace = SIMPLE_TRADE_SPECS.hvac.options.find(
      option => option.id === 'furnace'
    )!;
    const ductwork = SIMPLE_TRADE_SPECS.hvac.options.find(
      option => option.id === 'ductwork'
    )!;
    expect(
      formatHvacScopeChipQuantity(measurements, systems, [
        HVAC_SYSTEMS_OPTION_ID,
      ])
    ).toBe('2 each');
    expect(formatHvacScopeChipQuantity(measurements, furnace, [])).toBeNull();
    expect(
      formatHvacScopeChipQuantity(
        {
          itemQuantities: { equipment_replace__furnace: { quantity: 2 } },
        },
        furnace,
        ['furnace']
      )
    ).toBe('2 each');
    expect(
      formatHvacScopeChipQuantity(measurements, ductwork, ['ductwork'])
    ).toBe('150 LF');
    expect(
      formatHvacScopeChipQuantity(
        measurements,
        SIMPLE_TRADE_SPECS.hvac.options.find(
          option => option.id === 'registers'
        )!,
        ['registers']
      )
    ).toBe('10 each');
  });

  it('seeds HVAC equipment, thermostat, and register counts from chip selections', () => {
    const seeded = applyHvacScopeMeasurements({
      tradeScopeSelections: {
        hvac: ['furnace', 'condenser', 'thermostat', 'registers', 'returns'],
      },
    });
    expect(seeded.hvacEquipmentReplacementCount).toBe('2');
    expect(seeded.hvacThermostatCount).toBe(1);
    expect(seeded.hvacSupplyRegisterCount).toBe(1);
    expect(seeded.hvacReturnGrilleCount).toBe(1);
  });

  it('keeps HVAC controls and project add-ons off Confirm Scope until Quick Measurements selects them', () => {
    const idle = {
      tradeScopeSelections: {
        hvac: [HVAC_SYSTEMS_OPTION_ID, HVAC_CAPACITY_OPTION_ID],
      },
      hvacSystemCount: 1,
      hvacSystemTons: 4,
    };
    expect(isHvacQmScopeItemActive('ventilation', idle)).toBe(false);
    expect(isHvacQmScopeItemActive('permits', idle)).toBe(false);
    expect(isHvacQmScopeItemActive('cleanup', idle)).toBe(false);
    expect(isHvacQmScopeItemActive('hvac', idle)).toBe(true);
    expect(isHvacQmScopeItemActive('thermostat', idle)).toBe(true);

    const panel = simpleTradePanelFor('hvac');
    const synced = panel.syncScopeItems(
      [
        { id: 'hvac', state: 'included' as const },
        { id: 'ventilation', state: 'unsure' as const },
        { id: 'permits', state: 'unsure' as const },
        { id: 'cleanup', state: 'unsure' as const },
      ],
      idle
    );
    expect(synced.find(item => item.id === 'ventilation')?.state).toBe(
      'excluded'
    );
    expect(synced.find(item => item.id === 'permits')?.state).toBe('excluded');
    expect(synced.find(item => item.id === 'cleanup')?.state).toBe('excluded');
    expect(synced.find(item => item.id === 'hvac')?.state).toBe('included');

    expect(
      isHvacQmScopeItemActive('ventilation', {
        tradeScopeSelections: { hvac: ['ventilation'] },
        hvacVentilationCount: 1,
      })
    ).toBe(true);
    expect(isHvacQmScopeItemActive('permits', { hvacPermitCount: 1 })).toBe(
      true
    );
    expect(isHvacQmScopeItemActive('cleanup', { hvacCleanupCount: 1 })).toBe(
      true
    );
  });

  it('does not seed whole-house ventilation without a documented count', () => {
    const seeded = applyHvacScopeMeasurements({
      tradeScopeSelections: {
        hvac: ['ventilation'],
      },
    });
    expect(seeded.hvacVentilationCount).toBeUndefined();
  });

  it('hides whole-house ventilation until an ERV or HRV is named', () => {
    const plan = {
      planImportTradeKey: 'hvac',
      hvacSystemCount: 1,
      quickMeasurementSources: { hvacSystemCount: 'new_build_assumption' },
      measurementProvenance: {
        hvacSystemCount: { offer: 'new_build_hvac_system', value: 1 },
      },
    };
    expect(hvacWholeHouseVentilationButtonVisible(plan)).toBe(false);
    expect(
      hvacWholeHouseVentilationButtonVisible({
        ...plan,
        hvacVentilationCount: 1,
        quickMeasurementSources: {
          hvacSystemCount: 'new_build_assumption',
          hvacVentilationCount: 'pdf_text_instance_tags',
        },
        measurementProvenance: {
          hvacSystemCount: { offer: 'new_build_hvac_system', value: 1 },
          hvacVentilationCount: { source: 'pdf_text_instance_tags' },
        },
      })
    ).toBe(true);
    expect(
      hvacWholeHouseVentilationButtonVisible(
        plan,
        'Install one ERV for whole-house ventilation.'
      )
    ).toBe(true);
    expect(
      summarizeHvacScopePanel(plan)
    ).toEqual({ inBidCount: 1, needsConfirmationCount: 0 });
    expect(
      summarizeHvacScopePanel({
        ...plan,
        hvacSystemTons: 4,
        quickMeasurementSources: {
          hvacSystemCount: 'new_build_assumption',
          hvacSystemTons: 'user_entered',
        },
        quickMeasurementUserOverrides: { hvacSystemTons: true },
      })
    ).toEqual({ inBidCount: 1, needsConfirmationCount: 0 });
  });

  it('shows optional ventilation as not on plans until documented', () => {
    const option = SIMPLE_TRADE_SPECS.hvac.options.find(
      item => item.id === 'ventilation'
    )!;
    expect(formatHvacOptionalAddOnChipCaption({}, option)).toBe(
      'Not in this bid'
    );
    expect(
      formatHvacOptionalAddOnChipCaption({ hvacVentilationCount: 1 }, option)
    ).toBe('1 each');
    expect(formatHvacOptionalAddOnIdleHint(option)).toBe(
      HVAC_VENTILATION_IDLE_HINT
    );
    expect(option.measurementHelper).toContain('1 ERV or HRV = 1 each');
  });

  it('removes whole-house ventilation and clears its count', () => {
    const next = releaseHvacVentilationSelection({
      hvacVentilationCount: 1,
      hvacSystemCount: 1,
      tradeScopeSelections: { hvac: ['hvac_systems', 'ventilation'] },
      itemQuantities: { ventilation: { quantity: 1, unit: 'each' } },
      quickMeasurementSources: { hvacVentilationCount: 'user_entered' },
    });
    expect(next.hvacVentilationCount).toBe('');
    expect(next.tradeScopeSelections).toEqual({
      hvac: ['hvac_systems'],
    });
    expect(next.itemQuantities).toEqual({});
    expect(next.quickMeasurementSources).toEqual({});
    expect(isHvacQmScopeItemActive('ventilation', next)).toBe(false);
  });

  it('creates a quantity row for every selected HVAC chip', () => {
    const active = SIMPLE_TRADE_SPECS.hvac.options.filter(option =>
      [HVAC_SYSTEMS_OPTION_ID, 'ductwork', 'ventilation'].includes(option.id)
    );
    expect(
      hvacScopePanelMeasurementRows(active).map(option => option.id)
    ).toEqual([HVAC_SYSTEMS_OPTION_ID, 'ductwork', 'ventilation']);
    expect(
      hvacScopePanelMeasurementValue(active[0], { hvacSystemCount: 2 })
    ).toBe('2');
    expect(
      applyHvacScopePanelMeasurementEdit({}, active[0], '3').hvacSystemCount
    ).toBe('3');
  });

  it('syncs HVAC chip selections onto checklist cards without living SF', () => {
    const panel = simpleTradePanelFor('hvac');
    const selected = panel.syncScopeItems(
      [
        { id: 'equipment_replace', state: 'excluded' as const },
        { id: 'ductwork', state: 'excluded' as const },
        { id: 'ventilation', state: 'excluded' as const },
      ],
      {
        tradeScopeSelections: { hvac: ['ductwork', 'ventilation'] },
        hvacDuctworkLf: 120,
        hvacVentilationCount: 2,
      }
    );
    expect(selected.find(item => item.id === 'ductwork')?.state).toBe(
      'included'
    );
    expect(selected.find(item => item.id === 'ventilation')?.state).toBe(
      'included'
    );
    expect(selected.find(item => item.id === 'equipment_replace')?.state).toBe(
      'excluded'
    );
  });

  it('promotes selected HVAC equipment types into priced Confirm Scope cards', () => {
    const panel = simpleTradePanelFor('hvac');
    const selected = panel.syncScopeItems(
      [
        { id: 'hvac', state: 'included' as const },
        { id: 'equipment_replace', state: 'excluded' as const },
        { id: 'ventilation', state: 'excluded' as const },
      ],
      {
        tradeScopeSelections: {
          hvac: ['furnace', 'condenser', 'ventilation'],
        },
        itemQuantities: {
          equipment_replace__furnace: { quantity: 1 },
          equipment_replace__condenser: { quantity: 1 },
        },
        hvacEquipmentReplacementCount: 2,
        hvacVentilationCount: 1,
      }
    );
    expect(selected.find(item => item.id === 'furnace')?.state).toBe(
      'included'
    );
    expect(selected.find(item => item.id === 'condenser')?.state).toBe(
      'included'
    );
    expect(selected.find(item => item.id === 'equipment_replace')?.state).toBe(
      'excluded'
    );
    expect(selected.find(item => item.id === 'ventilation')?.state).toBe(
      'included'
    );
  });

  it('uses canonical HVAC quantity rules for scoped cards', () => {
    expect(getChecklistItemQuantityRule('ductwork', 'hvac')).toMatchObject({
      defaultUnit: 'lf',
      measurementKey: 'hvacDuctworkLf',
    });
    expect(
      getChecklistItemQuantityRule('equipment_replace', 'hvac')
    ).toMatchObject({
      defaultUnit: 'each',
      measurementKey: 'hvacEquipmentReplacementCount',
    });
    expect(getChecklistItemQuantityRule('furnace', 'hvac')).toMatchObject({
      defaultUnit: 'each',
    });
    expect(getChecklistItemQuantityRule('thermostat', 'hvac')).toMatchObject({
      defaultUnit: 'each',
      measurementKey: 'hvacThermostatCount',
    });
  });

  it('maps confirmed plan-read fields to HVAC scope chip ids', () => {
    expect(hvacScopeOptionIdForMeasurementField('hvacDuctworkLf')).toBe(
      'ductwork'
    );
    expect(hvacScopeOptionIdForMeasurementField('hvacSystemCount')).toBe(
      HVAC_SYSTEMS_OPTION_ID
    );
    expect(
      hvacScopeOptionIdForMeasurementField('hvacEquipmentReplacementCount')
    ).toBe(HVAC_SCOPE_EQUIPMENT_EXPAND_HIGHLIGHT);
    expect(hvacScopeOptionIdForMeasurementField('unknownField')).toBeNull();
  });

  it('selects the matching HVAC chip when a plan read is confirmed', () => {
    const next = applyHvacScopeSelectionForConfirmedField(
      {
        hvacDuctworkLf: 150,
        quickMeasurementSources: {
          hvacDuctworkLf: 'contractor_confirmed_from_plan_review',
        },
      },
      'hvacDuctworkLf'
    );
    expect(resolveHvacTradeScopeSelections(next)).toContain('ductwork');
  });

  it('keeps manual HVAC equipment chip selections for quantity entry', () => {
    const next = applyHvacScopeMeasurements({
      tradeScopeSelections: { hvac: ['furnace', 'condenser'] },
    });
    expect(resolveHvacTradeScopeSelections(next)).toEqual(
      expect.arrayContaining(['furnace', 'condenser'])
    );
    expect(next.hvacEquipmentReplacementCount).toBe('2');
    expect(next.itemQuantities?.equipment_replace__furnace).toMatchObject({
      quantity: 1,
    });
    expect(
      applyHvacScopePanelMeasurementEdit(
        next,
        SIMPLE_TRADE_SPECS.hvac.options.find(
          option => option.id === 'furnace'
        )!,
        '3'
      ).itemQuantities?.equipment_replace__furnace
    ).toMatchObject({ quantity: '3' });
    const deselected = applyHvacScopeMeasurements({
      ...next,
      tradeScopeSelections: { hvac: ['condenser'] },
    });
    expect(resolveHvacTradeScopeSelections(deselected)).not.toContain(
      'furnace'
    );
    expect(
      deselected.itemQuantities?.equipment_replace__furnace
    ).toBeUndefined();
  });

  it('summarizes HVAC scope panel bid status', () => {
    expect(
      summarizeHvacScopePanel({
        tradeScopeSelections: { hvac: ['ductwork', 'registers'] },
        hvacDuctworkLf: 120,
        hvacSupplyRegisterCount: 4,
        quickMeasurementSources: {
          hvacDuctworkLf: 'contractor_confirmed_from_plan_review',
          hvacSupplyRegisterCount: 'contractor_confirmed_from_plan_review',
        },
      })
    ).toEqual({ inBidCount: 2, needsConfirmationCount: 0 });
  });

  it('treats explicit note quantities as confirmed HVAC measurements', () => {
    const notes =
      'Remove the existing HVAC system and ductwork, then replace one heat-pump system, install 120 LF ductwork, one thermostat, four registers, R-38 attic insulation, standard air sealing, drywall repairs, two interior doors, flooring, and ceiling paint.';
    const measurements = applyHvacScopeMeasurements({
      tradeScopeSelections: {
        hvac: [
          'hvac_systems',
          'heat_pump',
          'ductwork',
          'thermostat',
          'registers',
        ],
      },
      hvacSystemCount: 1,
      hvacDuctworkLf: 120,
      hvacThermostatCount: 1,
      hvacSupplyRegisterCount: 4,
      itemQuantities: {
        equipment_replace__heat_pump: { quantity: 1 },
      },
    });

    expect(
      hvacScopeOptionHasExplicitQuantityInNotes('hvac_systems', notes)
    ).toBe(true);
    expect(hvacScopeOptionHasExplicitQuantityInNotes('heat_pump', notes)).toBe(
      true
    );
    expect(
      hvacScopeChipReviewState(
        measurements,
        SIMPLE_TRADE_SPECS.hvac.options.find(
          option => option.id === 'ductwork'
        )!,
        ['hvac_systems', 'heat_pump', 'ductwork', 'thermostat', 'registers'],
        notes
      )
    ).toBe('confirmed');
    expect(summarizeHvacScopePanel(measurements, notes)).toMatchObject({
      needsConfirmationCount: 0,
    });
    expect(resolveHvacTradeScopeSelections(measurements, notes)).toEqual(
      expect.arrayContaining(['hvac_systems', 'hvac_capacity', 'heat_pump'])
    );
    expect(measurements.hvacSystemTons).toBeUndefined();
  });

  it('recognizes qualified HVAC note quantities as explicit', () => {
    const notes =
      'Replace and dispose of 1 existing HVAC system and 180 LF of existing ductwork. Install 1 new 3-ton heat-pump system, 1 thermostat, 8 supply registers, and 2 return grilles.';

    expect(
      hvacScopeOptionHasExplicitQuantityInNotes('hvac_systems', notes)
    ).toBe(true);
    expect(
      hvacScopeOptionHasExplicitQuantityInNotes('hvac_capacity', notes)
    ).toBe(true);
    expect(
      hvacScopeOptionHasExplicitQuantityInNotes('ductwork', notes)
    ).toBe(true);
  });

  it('opens HVAC systems and capacity for a new-build plan assumption', () => {
    expect(
      resolveHvacTradeScopeSelections({
        planImportTradeKey: 'hvac',
        hvacSystemCount: 1,
        quickMeasurementSources: { hvacSystemCount: 'new_build_assumption' },
        measurementProvenance: {
          hvacSystemCount: { offer: 'new_build_hvac_system', value: 1 },
        },
      })
    ).toEqual([HVAC_SYSTEMS_OPTION_ID, HVAC_CAPACITY_OPTION_ID]);
    expect(
      resolveHvacTradeScopeSelections({
        planImportTradeKey: 'hvac',
        hvacSystemCount: 1,
        hvacSystemTons: 4,
        quickMeasurementSources: { hvacSystemCount: 'new_build_assumption' },
        measurementProvenance: {
          hvacSystemCount: { offer: 'new_build_hvac_system', value: 1 },
        },
        tradeScopeSelections: { hvac: [HVAC_CAPACITY_OPTION_ID] },
      })
    ).toEqual([HVAC_CAPACITY_OPTION_ID, HVAC_SYSTEMS_OPTION_ID]);
  });

  it('keeps distribution inside the system price out of the unsure count', () => {
    const plan = {
      planImportTradeKey: 'hvac',
      hvacSystemCount: 1,
      quickMeasurementSources: { hvacSystemCount: 'new_build_assumption' },
      measurementProvenance: {
        hvacSystemCount: { offer: 'new_build_hvac_system', value: 1 },
      },
    };
    expect(hvacDistributionFoldedIntoSystemPrice('ductwork', plan)).toBe(true);
    expect(hvacDistributionFoldedIntoSystemPrice('thermostat', plan)).toBe(
      true
    );
    expect(
      hvacDistributionFoldedIntoSystemPrice('supply_registers', plan)
    ).toBe(true);
    expect(hvacDistributionFoldedIntoSystemPrice('return_grilles', plan)).toBe(
      true
    );
    expect(hvacDistributionFoldedIntoSystemPrice('hvac', plan)).toBe(false);
    const synced = simpleTradePanelFor('hvac').syncScopeItems(
      [
        { id: 'hvac', state: 'included' as const },
        { id: 'ductwork', state: 'unsure' as const },
        { id: 'supply_registers', state: 'unsure' as const },
        { id: 'return_grilles', state: 'unsure' as const },
        { id: 'thermostat', state: 'unsure' as const },
      ],
      plan
    );
    expect(synced.find(item => item.id === 'hvac')?.state).toBe('included');
    expect(synced.find(item => item.id === 'ductwork')?.state).toBe(
      'excluded'
    );
    expect(synced.find(item => item.id === 'thermostat')?.state).toBe(
      'excluded'
    );
    const separated = {
      ...plan,
      tradeScopeSelections: { hvac: ['hvac_systems', 'ductwork'] },
      hvacDuctworkLf: 80,
    };
    expect(
      hvacDistributionFoldedIntoSystemPrice('ductwork', separated)
    ).toBe(false);
    expect(
      simpleTradePanelFor('hvac')
        .syncScopeItems(
          [{ id: 'ductwork', state: 'unsure' as const }],
          separated
        )
        .find(item => item.id === 'ductwork')?.state
    ).toBe('included');
  });

  it('includes distribution in a plan-import HVAC install so it is not priced again', () => {
    expect(
      hvacPlanInstallIncludesDistribution(
        { planImportTradeKey: 'hvac', hvacSystemCount: '1' },
        [HVAC_SYSTEMS_OPTION_ID]
      )
    ).toBe(true);
    expect(
      hvacPlanInstallIncludesDistribution(
        { planImportTradeKey: 'hvac' },
        []
      )
    ).toBe(false);
    expect(
      hvacPlanInstallIncludesDistribution(
        { hvacSystemCount: '1' },
        [HVAC_SYSTEMS_OPTION_ID]
      )
    ).toBe(false);
  });

  it('flags a selected HVAC system when its quantity is blank', () => {
    expect(
      summarizeHvacScopePanel({
        tradeScopeSelections: { hvac: [HVAC_SYSTEMS_OPTION_ID] },
      })
    ).toEqual({ inBidCount: 1, needsConfirmationCount: 1 });
  });

  it('keeps a furnace and air conditioner note in the bid without extra confirmation measurements', () => {
    const notes =
      'Replace the furnace and air conditioner. Install new ductwork, 8 supply registers, 2 return grilles, and a thermostat.';
    const measurements = {
      tradeScopeSelections: {
        hvac: [
          HVAC_SYSTEMS_OPTION_ID,
          HVAC_CAPACITY_OPTION_ID,
          'ductwork',
          'thermostat',
          'registers',
          'returns',
        ],
      },
      hvacSupplyRegisterCount: 8,
      hvacReturnGrilleCount: 2,
      hvacThermostatCount: 1,
    };
    expect(hvacScopeOptionHasExplicitQuantityInNotes('thermostat', notes)).toBe(
      true
    );
    const resolved = resolveHvacTradeScopeSelections(measurements, notes);
    expect(resolved).not.toContain(HVAC_SYSTEMS_OPTION_ID);
    expect(resolved).not.toContain(HVAC_CAPACITY_OPTION_ID);
    expect(resolved).toEqual(
      expect.arrayContaining(['furnace', 'condenser'])
    );
    expect(summarizeHvacScopePanel(measurements, notes)).toEqual({
      inBidCount: 6,
      needsConfirmationCount: 0,
    });
  });

  it('keeps cleared HVAC panel qty editable instead of reverting to plan provenance', () => {
    const systems = SIMPLE_TRADE_SPECS.hvac.options.find(
      option => option.id === HVAC_SYSTEMS_OPTION_ID
    )!;
    const measurements = {
      hvacSystemCount: '2',
      measurementProvenance: {
        hvacSystemCount: { value: 2, status: 'user_confirmed' },
      },
    };
    const cleared = applyHvacScopePanelMeasurementEdit(
      measurements,
      systems,
      ''
    );
    expect(hvacScopePanelMeasurementValue(systems, cleared)).toBe('');
    expect(cleared.quickMeasurementSources?.hvacSystemCount).toBe(
      'user_entered'
    );
    const edited = applyHvacScopePanelMeasurementEdit(cleared, systems, '4');
    expect(hvacScopePanelMeasurementValue(systems, edited)).toBe('4');
  });

  it('inserts priced furnace and condenser Confirm Scope cards from equipment chips', () => {
    const measurements = {
      tradeScopeSelections: { hvac: ['furnace', 'condenser'] },
      itemQuantities: {
        equipment_replace__furnace: {
          quantity: 1,
          unit: 'each',
          quantitySource: 'user_entered',
        },
        equipment_replace__condenser: {
          quantity: 1,
          unit: 'each',
          quantitySource: 'user_entered',
        },
      },
    };
    const display = filterChecklistItemsForTrade(
      expandHvacEquipmentScopeDisplayItems(
        [{ id: 'hvac', label: 'HVAC system', state: 'included' }],
        measurements
      ),
      'selected_trade',
      'hvac'
    );
    expect(display.map(item => item.id)).toEqual([
      'hvac',
      'furnace',
      'condenser',
    ]);
    expect(display.find(item => item.id === 'furnace')).toMatchObject({
      label: 'Furnace',
      state: 'included',
    });
    expect(display.find(item => item.id === 'condenser')).toMatchObject({
      label: 'Condenser',
      state: 'included',
    });

    const furnaceQty = resolveChecklistItemQuantity(
      'furnace',
      measurements as any,
      {
        templateKey: 'hvac',
      }
    );
    const condenserQty = resolveChecklistItemQuantity(
      'condenser',
      measurements as any,
      { templateKey: 'hvac' }
    );
    expect(furnaceQty).toMatchObject({
      quantity: 1,
      unit: 'each',
      pricingReady: true,
    });
    expect(condenserQty).toMatchObject({
      quantity: 1,
      unit: 'each',
      pricingReady: true,
    });

    const furnacePrice = resolveScopeItemSuggestedPricing(
      'furnace',
      measurements as any,
      'hvac',
      furnaceQty
    );
    const condenserPrice = resolveScopeItemSuggestedPricing(
      'condenser',
      measurements as any,
      'hvac',
      condenserQty
    );
    expect(furnacePrice.fill?.total).toBe(6000);
    expect(condenserPrice.fill?.total).toBe(6000);
  });
});
