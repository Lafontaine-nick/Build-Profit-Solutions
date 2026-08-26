import {
  applyHvacScopeMeasurements,
  applyHvacScopePanelMeasurementEdit,
  applyHvacScopeSelectionForConfirmedField,
  formatHvacOptionalAddOnChipCaption,
  formatHvacOptionalAddOnIdleHint,
  formatHvacScopeChipQuantity,
  HVAC_VENTILATION_IDLE_HINT,
  HVAC_CAPACITY_OPTION_ID,
  HVAC_EMBEDDED_QUICK_MEASUREMENT_KEYS,
  HVAC_EQUIPMENT_OPTION_IDS,
  HVAC_SCOPE_EQUIPMENT_EXPAND_HIGHLIGHT,
  HVAC_SYSTEMS_OPTION_ID,
  hvacFieldHasTakeoffEvidence,
  hvacScopeChipReviewState,
  hvacScopeOptionIdForMeasurementField,
  inferHvacScopeSelectionsFromMeasurements,
  resolveHvacTradeScopeSelections,
  summarizeHvacScopePanel,
  ROOFING_ACCESSORY_OPTION_IDS,
  ROOFING_DEMO_OPTION_IDS,
  ROOFING_DRAINAGE_OPTION_IDS,
  ROOFING_INSTALL_OPTION_IDS,
  SIMPLE_TRADE_SPECS,
  hvacScopePanelMeasurementRows,
  hvacScopePanelMeasurementValue,
  roofingOptionsForIds,
  simpleTradePanelFor,
} from '@/utils/qmScopePanels/simpleTradeRemodel';
import { getChecklistItemQuantityRule } from '@/utils/scopeItemQuantities';

describe('simple trade QM panels', () => {
  it('defines the three remaining simple-trade templates', () => {
    expect(Object.keys(SIMPLE_TRADE_SPECS)).toEqual(
      expect.arrayContaining(['deck_patio', 'hvac', 'roofing'])
    );
    expect(Object.keys(SIMPLE_TRADE_SPECS)).not.toContain('concrete');
  });

  it('keeps the provided scope labels mapped to priceable checklist ids', () => {
    expect(SIMPLE_TRADE_SPECS.deck_patio.options.find((option) => option.id === 'wood_fence')?.canonicalId).toBe(
      'landscaping'
    );
    expect(SIMPLE_TRADE_SPECS.hvac.options.find((option) => option.id === 'furnace')?.canonicalId).toBe(
      'equipment_replace'
    );
    expect(SIMPLE_TRADE_SPECS.roofing.options.find((option) => option.id === 'shingles')?.canonicalId).toBe(
      'shingles_roofing'
    );
  });

  it('registers each template as an active QM panel', () => {
    expect(simpleTradePanelFor('deck_patio').templateKeys).toEqual(['deck_patio']);
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
    const allIds = SIMPLE_TRADE_SPECS.roofing.options.map((option) => option.id);
    const grouped = [
      ...ROOFING_DEMO_OPTION_IDS,
      ...ROOFING_INSTALL_OPTION_IDS,
      ...ROOFING_ACCESSORY_OPTION_IDS,
      ...ROOFING_DRAINAGE_OPTION_IDS,
    ];
    expect(grouped).toEqual(expect.arrayContaining(allIds));
    expect(new Set(grouped).size).toBe(allIds.length);
    expect(roofingOptionsForIds(ROOFING_DEMO_OPTION_IDS).map((option) => option.id)).toEqual([
      'tear_off',
    ]);
    expect(roofingOptionsForIds(ROOFING_DRAINAGE_OPTION_IDS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'gutters', measurementKey: 'roofGutterLf', unit: 'LF' }),
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
    expect(selected.find(item => item.id === 'gutters')?.state).toBe('included');
    expect(selected.find(item => item.id === 'downspouts')?.state).toBe('included');

    const guttersOnly = panel.syncScopeItems(selected, {
      tradeScopeSelections: { roofing: ['gutters'] },
      roofGutterLf: 150,
      roofDownspoutCount: 4,
    });
    expect(guttersOnly.find(item => item.id === 'gutters')?.state).toBe('included');
    expect(guttersOnly.find(item => item.id === 'downspouts')?.state).toBe('excluded');
  });

  it('uses LF for gutters and EA for downspouts quantity rules', () => {
    expect(getChecklistItemQuantityRule('gutters', 'roofing')).toMatchObject({
      defaultUnit: 'lf',
      measurementKey: 'roofGutterLf',
    });
    expect(getChecklistItemQuantityRule('downspouts', 'roofing')).toMatchObject({
      defaultUnit: 'each',
      measurementKey: 'roofDownspoutCount',
    });
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
          canonicalId: 'equipment_replace',
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
      expect(SIMPLE_TRADE_SPECS.hvac.options.find(option => option.id === id)).not.toMatchObject({
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
    ).toEqual(
      [HVAC_SYSTEMS_OPTION_ID]
    );
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
    expect(
      hvacScopeChipReviewState(measurements, ductwork, ['ductwork'])
    ).toBe('needs_confirmation');
    expect(
      hvacScopeChipReviewState(measurements, furnace, ['furnace'])
    ).toBe('confirmed');
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
      formatHvacScopeChipQuantity(measurements, systems, [HVAC_SYSTEMS_OPTION_ID])
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
        SIMPLE_TRADE_SPECS.hvac.options.find((option) => option.id === 'registers')!,
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

  it('does not seed whole-house ventilation without a documented count', () => {
    const seeded = applyHvacScopeMeasurements({
      tradeScopeSelections: {
        hvac: ['ventilation'],
      },
    });
    expect(seeded.hvacVentilationCount).toBeUndefined();
  });

  it('shows optional ventilation as not on plans until documented', () => {
    const option = SIMPLE_TRADE_SPECS.hvac.options.find(
      item => item.id === 'ventilation'
    )!;
    expect(
      formatHvacOptionalAddOnChipCaption({}, option)
    ).toBe('Not on plans · $0');
    expect(
      formatHvacOptionalAddOnChipCaption({ hvacVentilationCount: 1 }, option)
    ).toBe('1 each');
    expect(formatHvacOptionalAddOnIdleHint(option)).toBe(HVAC_VENTILATION_IDLE_HINT);
    expect(option.measurementHelper).toContain('1 ERV or HRV = 1 each');
  });

  it('creates a quantity row for every selected HVAC chip', () => {
    const active = SIMPLE_TRADE_SPECS.hvac.options.filter(option =>
      [HVAC_SYSTEMS_OPTION_ID, 'ductwork', 'ventilation'].includes(option.id)
    );
    expect(hvacScopePanelMeasurementRows(active).map(option => option.id)).toEqual([
      HVAC_SYSTEMS_OPTION_ID,
      'ductwork',
      'ventilation',
    ]);
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
    expect(selected.find(item => item.id === 'ductwork')?.state).toBe('included');
    expect(selected.find(item => item.id === 'ventilation')?.state).toBe('included');
    expect(selected.find(item => item.id === 'equipment_replace')?.state).toBe('excluded');
  });

  it('uses canonical HVAC quantity rules for scoped cards', () => {
    expect(getChecklistItemQuantityRule('ductwork', 'hvac')).toMatchObject({
      defaultUnit: 'lf',
      measurementKey: 'hvacDuctworkLf',
    });
    expect(getChecklistItemQuantityRule('equipment_replace', 'hvac')).toMatchObject({
      defaultUnit: 'each',
      measurementKey: 'hvacEquipmentReplacementCount',
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
    expect(hvacScopeOptionIdForMeasurementField('hvacEquipmentReplacementCount')).toBe(
      HVAC_SCOPE_EQUIPMENT_EXPAND_HIGHLIGHT
    );
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
      applyHvacScopePanelMeasurementEdit(next, SIMPLE_TRADE_SPECS.hvac.options.find(
        option => option.id === 'furnace'
      )!, '3').itemQuantities?.equipment_replace__furnace
    ).toMatchObject({ quantity: '3' });
    const deselected = applyHvacScopeMeasurements({
      ...next,
      tradeScopeSelections: { hvac: ['condenser'] },
    });
    expect(resolveHvacTradeScopeSelections(deselected)).not.toContain('furnace');
    expect(deselected.itemQuantities?.equipment_replace__furnace).toBeUndefined();
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
    const cleared = applyHvacScopePanelMeasurementEdit(measurements, systems, '');
    expect(hvacScopePanelMeasurementValue(systems, cleared)).toBe('');
    expect(cleared.quickMeasurementSources?.hvacSystemCount).toBe('user_entered');
    const edited = applyHvacScopePanelMeasurementEdit(cleared, systems, '4');
    expect(hvacScopePanelMeasurementValue(systems, edited)).toBe('4');
  });
});
