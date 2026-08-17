import {
  applyElectricalQuickMeasurementPatch,
  buildElectricalQuickMeasurementGroups,
  electricalQuickMeasurementSourceFromProvenance,
  electricalConfirmScopeAttributesEqual,
  electricalConfirmScopeAttributesFromMeasurements,
  electricalLivePricingAttributesChanged,
  electricalQuantityFieldsChanged,
  electricalMeasurementsShouldFlushImmediately,
  electricalConfirmScopeCardTitles,
  electricalQmGroupDefaultCollapsed,
  electricalQmChipSelected,
  electricalQmOptionActive,
  electricalQmQuantityInputValue,
  electricalQmShowsQuantity,
  electricalQmTapQuantity,
  electricalServiceAmperageTap,
  electricalScopeGroupDefaultCollapsed,
  confirmScopeChipPainted,
  electricalScopeSyncSignature,
  CONFIRM_SCOPE_CHIP_COMMIT_MS,
  CONFIRM_SCOPE_CHIP_PRESS_LOCK_MS,
  CONFIRM_SCOPE_CHIP_SCROLL_SLOP,
  confirmScopeChipIsTap,
  restorePlanMeasurementConflict,
  unresolvedElectricalConflictFields,
} from '@/utils/electricalQuickMeasurementUi';

describe('electricalQuickMeasurementUi', () => {
  const lot58 = {
    mainPanelCount: 1,
    standardReceptacleCount: 50,
    gfciReceptacleCount: 8,
    singlePoleSwitchCount: 15,
    threeWaySwitchCount: 5,
    ceilingFanCount: 8,
    rangeHookupCount: 1,
    dryerHookupCount: 1,
    dishwasherHookupCount: 1,
    recessedLightCount: 40,
  };

  it('keeps explicit panel evidence as Plan verified across the compact badge path', () => {
    expect(
      electricalQuickMeasurementSourceFromProvenance({
        status: 'plan_verified',
        normalizedSource: 'FROM_PLAN',
        pricingEligible: true,
      })
    ).toBe('plan_verified');
    const groups = buildElectricalQuickMeasurementGroups({
      measurements: { mainPanelCount: 1 },
      sources: { mainPanelCount: 'plan_verified' },
    });
    expect(
      groups
        .flatMap(group => group.fields)
        .find(field => field.key === 'mainPanelCount')?.provenanceLabel
    ).toBe('Plan verified');
  });

  it('does not let stale AI verification override a blocked or contractor-confirmed record', () => {
    expect(
      electricalQuickMeasurementSourceFromProvenance({
        status: 'needs_review',
        normalizedSource: 'NEEDS_REVIEW',
        pricingEligible: false,
      })
    ).toBe('needs_confirmation');
    expect(
      electricalQuickMeasurementSourceFromProvenance({
        normalizedSource: 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW',
        confirmedFrom: 'PLAN_REVIEW',
      })
    ).toBe('contractor_confirmed_from_plan_review');
  });

  it('hydrates Quick Measurements from canonical Electrical keys', () => {
    const groups = buildElectricalQuickMeasurementGroups({
      measurements: lot58,
      sources: {
        mainPanelCount: 'plan_detected',
        standardReceptacleCount: 'plan_detected',
      },
    });
    const fields = groups.flatMap(group => group.fields);
    const byKey = Object.fromEntries(fields.map(field => [field.key, field]));
    expect(byKey.mainPanelCount).toMatchObject({
      selected: true,
      value: 1,
      unit: 'EA',
      label: 'Main panel',
      provenanceLabel: 'From plan',
    });
    expect(byKey.standardReceptacleCount).toMatchObject({
      selected: true,
      value: 50,
      unit: 'EA',
    });
    expect(byKey.gfciReceptacleCount?.value).toBe(8);
    expect(byKey.singlePoleSwitchCount?.value).toBe(15);
    expect(byKey.threeWaySwitchCount?.value).toBe(5);
    expect(byKey.subpanelCount).toMatchObject({ selected: false, value: null });
    expect(fields.some(field => field.key === 'serviceAmperage')).toBe(false);
    expect(electricalConfirmScopeCardTitles(groups)).toEqual([
      'Job condition',
      'Service amperage',
      'Panel location',
      'Project / service',
      'Circuits',
      'Receptacles',
      'Switches / controls',
      'Lighting / fans',
      'Appliance circuit + hookup',
      'Life safety / low voltage',
      'Modifications',
      'Packages',
      'Conduit / trenching',
    ]);
  });

  it('does not select a conflicted quantity until the contractor confirms', () => {
    const groups = buildElectricalQuickMeasurementGroups({
      measurements: lot58,
      conflictFields: unresolvedElectricalConflictFields([
        {
          field: 'recessedLightCount',
          requiresConfirmation: true,
        },
        {
          field: 'gfciReceptacleCount',
          requiresConfirmation: true,
        },
      ]),
    });
    const fields = groups.flatMap(group => group.fields);
    const byKey = Object.fromEntries(fields.map(field => [field.key, field]));
    expect(byKey.recessedLightCount).toMatchObject({
      selected: false,
      value: null,
      conflicted: true,
      provenanceLabel: 'Needs confirmation',
    });
    expect(byKey.gfciReceptacleCount).toMatchObject({
      selected: false,
      value: null,
      conflicted: true,
    });
    expect(byKey.standardReceptacleCount?.selected).toBe(true);
    expect(electricalQmOptionActive(byKey.recessedLightCount)).toBe(false);
    expect(electricalQmShowsQuantity(byKey.recessedLightCount, false)).toBe(
      false
    );
    expect(electricalQmShowsQuantity(byKey.recessedLightCount, true)).toBe(
      true
    );
    expect(
      electricalQmShowsQuantity(byKey.standardReceptacleCount, false)
    ).toBe(true);
  });

  it('lets a contractor type a count on an unresolved conflict row', () => {
    const conflicted = { value: null, conflicted: true };
    expect(electricalQmQuantityInputValue(conflicted)).toBe('');
    expect(electricalQmQuantityInputValue(conflicted, '2')).toBe('2');
    expect(electricalQmQuantityInputValue(conflicted, '')).toBe('');
  });

  it('keeps a typed conflicted quantity so the contractor can resolve it', () => {
    const groups = buildElectricalQuickMeasurementGroups({
      measurements: { singlePoleSwitchCount: '20' },
      conflictFields: ['singlePoleSwitchCount'],
      userOverrides: { singlePoleSwitchCount: true },
    });
    const field = groups
      .flatMap(group => group.fields)
      .find(item => item.key === 'singlePoleSwitchCount');
    expect(field).toMatchObject({
      selected: true,
      value: 20,
      conflicted: false,
    });
  });

  it('does not turn a stale conflicted count into a green selected chip', () => {
    const groups = buildElectricalQuickMeasurementGroups({
      measurements: { singlePoleSwitchCount: 15, threeWaySwitchCount: 5 },
      conflictFields: ['singlePoleSwitchCount'],
    });
    const byKey = Object.fromEntries(
      groups.flatMap(group => group.fields).map(field => [field.key, field])
    );
    expect(byKey.singlePoleSwitchCount).toMatchObject({
      selected: false,
      value: null,
      conflicted: true,
    });
    expect(electricalQmOptionActive(byKey.singlePoleSwitchCount)).toBe(false);
    expect(byKey.threeWaySwitchCount).toMatchObject({
      selected: true,
      value: 5,
      conflicted: false,
    });
  });

  it('shows a retained repeat-plan count while keeping it marked for confirmation', () => {
    const groups = buildElectricalQuickMeasurementGroups({
      measurements: { singlePoleSwitchCount: 12 },
      conflictFields: ['singlePoleSwitchCount'],
      sources: { singlePoleSwitchCount: 'needs_confirmation' },
    });
    const field = groups
      .flatMap(group => group.fields)
      .find(item => item.key === 'singlePoleSwitchCount');
    expect(field).toMatchObject({
      selected: true,
      value: 12,
      conflicted: false,
      provenanceLabel: 'Needs confirmation',
    });
  });

  it('writes the same canonical key and item quantity the cards use', () => {
    const next = applyElectricalQuickMeasurementPatch(
      {
        standardReceptacleCount: '50',
        itemQuantities: {
          electrical_standard_receptacle: {
            quantity: '50',
            unit: 'each',
            quantitySource: 'plan_detected',
          },
        },
      },
      'standardReceptacleCount',
      '52'
    );
    expect(next.standardReceptacleCount).toBe('52');
    expect(next.itemQuantities?.electrical_standard_receptacle).toMatchObject({
      quantity: '52',
      unit: 'each',
      quantitySource: 'user_entered',
    });
    expect(next.quickMeasurementUserOverrides?.standardReceptacleCount).toBe(
      true
    );
  });

  it('unblocks a repeat-plan field after the contractor enters a quantity', () => {
    const next = applyElectricalQuickMeasurementPatch(
      {
        singlePoleSwitchCount: '12',
        electricalValidation: {
          fields: {
            singlePoleSwitchCount: {
              status: 'needs_review',
              pricingEligible: false,
              deterministicRepeatedImportStable: false,
            },
          },
          priceableFields: [],
          blockedFields: ['singlePoleSwitchCount'],
        },
        itemQuantities: {},
      },
      'singlePoleSwitchCount',
      '12'
    );

    expect(
      next.electricalValidation?.fields?.singlePoleSwitchCount
    ).toMatchObject({
      status: 'user_confirmed',
      pricingEligible: true,
    });
    expect(next.electricalValidation?.priceableFields).toContain(
      'singlePoleSwitchCount'
    );
    expect(next.electricalValidation?.blockedFields).not.toContain(
      'singlePoleSwitchCount'
    );
  });

  it('preserves contractor confirmation when reapplying the selected plan candidate', () => {
    const next = applyElectricalQuickMeasurementPatch(
      {
        recessedLightCount: '46',
        quickMeasurementSources: {
          recessedLightCount: 'contractor_confirmed_from_plan_review',
        },
      },
      'recessedLightCount',
      '46'
    );
    expect(next.itemQuantities?.electrical_recessed_light).toMatchObject({
      quantitySource: 'contractor_confirmed_from_plan_review',
    });
    expect(next.quickMeasurementSources?.recessedLightCount).toBe(
      'contractor_confirmed_from_plan_review'
    );
  });

  it('deselecting a populated row clears the quantity, item, and electricalScope', () => {
    const next = applyElectricalQuickMeasurementPatch(
      {
        mainPanelCount: '1',
        electricalScope: [
          'electrical_main_panel',
          'electrical_standard_receptacle',
        ],
        itemQuantities: {
          electrical_main_panel: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'plan_detected',
          },
        },
        pricingAcceptance: {
          electrical_main_panel: { selectionStatus: 'accepted' },
        },
      },
      'mainPanelCount',
      ''
    );
    expect(next.mainPanelCount).toBe('');
    expect(next.itemQuantities?.electrical_main_panel).toBeUndefined();
    expect(next.electricalScope).toEqual(['electrical_standard_receptacle']);
    expect(next.pricingAcceptance?.electrical_main_panel).toBeUndefined();
    const groups = buildElectricalQuickMeasurementGroups({
      measurements: next,
    });
    const mainPanel = groups
      .flatMap(group => group.fields)
      .find(field => field.key === 'mainPanelCount');
    expect(mainPanel).toMatchObject({ selected: false, value: null });
  });

  it('restores a plan conflict when the contractor deselects the confirmed count', () => {
    const conflict = {
      field: 'ceilingFanCount',
      selectedValue: 8,
      selectedSource: 'general_plan_takeoff',
      threshold: 0.15,
      requiresConfirmation: true,
      candidates: [
        {
          value: 8,
          source: 'general_plan_takeoff',
          confidence: 0.7,
          directEvidence: true,
        },
        {
          value: 6,
          source: 'focused_trade',
          confidence: 0.7,
          directEvidence: true,
        },
      ],
    };
    const selected = applyElectricalQuickMeasurementPatch(
      {
        ceilingFanCount: '',
        measurementConflicts: [conflict],
      },
      'ceilingFanCount',
      8
    );
    const restored = restorePlanMeasurementConflict(
      {
        ...selected,
        measurementConflicts: [],
      },
      'ceilingFanCount',
      conflict
    );
    expect(restored.ceilingFanCount).toBe('');
    expect(
      restored.quickMeasurementUserOverrides?.ceilingFanCount
    ).toBeUndefined();
    expect(restored.measurementConflicts).toEqual([conflict]);
  });

  it('starts Electrical quantity groups collapsed so attribute taps stay responsive', () => {
    expect(electricalQmGroupDefaultCollapsed()).toBe(true);
  });

  it('does not hide Electrical pricing cards behind Quick Measurements', () => {
    expect(
      electricalScopeGroupDefaultCollapsed('electrical', true, 'Lighting')
    ).toBe(false);
    expect(
      electricalScopeGroupDefaultCollapsed('electrical', false, 'Lighting')
    ).toBe(false);
  });

  it('does not treat amperage, location, or job condition as scope-sync changes', () => {
    const base = {
      mainPanelCount: 1,
      standardReceptacleCount: 50,
      electricalScope: ['electrical_main_panel'],
    };
    const signature = electricalScopeSyncSignature(base);
    expect(
      electricalScopeSyncSignature({
        ...base,
        serviceAmperage: 200,
        electricalPanelLocation: 'outdoor',
        electricalProjectCondition: 'finished_wall_service',
        electricalMeterMainCombo: true,
      })
    ).toBe(signature);
    expect(
      electricalScopeSyncSignature({
        ...base,
        mainPanelCount: 2,
      })
    ).not.toBe(signature);
    expect(
      electricalScopeSyncSignature({
        ...base,
        electricalIncludeRough: true,
      })
    ).not.toBe(signature);
  });

  it('keeps blank chips unselected until the contractor taps them', () => {
    const blank = electricalConfirmScopeAttributesFromMeasurements({});
    const selected = electricalConfirmScopeAttributesFromMeasurements({
      serviceAmperage: 100,
      electricalPanelLocation: 'outdoor',
      electricalProjectCondition: 'new_construction',
    });
    expect(blank.serviceAmperage).toBeNull();
    expect(blank.electricalPanelLocation).toBeNull();
    expect(blank.electricalProjectCondition).toBeNull();
    expect(electricalConfirmScopeAttributesEqual(blank, selected)).toBe(false);
    expect(
      electricalConfirmScopeAttributesEqual(selected, {
        ...blank,
        serviceAmperage: 100,
        electricalPanelLocation: 'outdoor',
        electricalProjectCondition: 'new_construction',
      })
    ).toBe(true);
  });

  it('toggles service amperage as a single selected value', () => {
    expect(electricalServiceAmperageTap(null, 200)).toBe(200);
    expect(electricalServiceAmperageTap(200, 100)).toBe(100);
    expect(electricalServiceAmperageTap(100, 100)).toBeNull();
  });

  it('tapping a blank EA row starts at zero without making it price-ready', () => {
    const subpanel = { unit: 'EA', selected: false, conflicted: false };
    expect(electricalQmTapQuantity(subpanel)).toBe('0');
    expect(electricalQmChipSelected(subpanel, false)).toBe(false);
    const included = applyElectricalQuickMeasurementPatch(
      {
        itemQuantities: {},
        quickMeasurementUserOverrides: {},
        quickMeasurementSources: {},
        electricalScope: [],
        pricingAcceptance: {},
      },
      'subpanelCount',
      '0'
    );
    const field = buildElectricalQuickMeasurementGroups({
      measurements: included,
      userOverrides: included.quickMeasurementUserOverrides,
    })
      .flatMap(group => group.fields)
      .find(item => item.key === 'subpanelCount');
    expect(field).toMatchObject({ selected: true, value: 0, unit: 'EA' });
    expect(included.itemQuantities?.electrical_subpanel).toMatchObject({
      quantity: '0',
    });
    expect(electricalQmOptionActive(field)).toBe(true);
    expect(electricalQmChipSelected(field, false)).toBe(true);
  });

  it('tapping an active EA row clears the quantity', () => {
    expect(
      electricalQmTapQuantity({ unit: 'EA', selected: true, conflicted: false })
    ).toBe('');
  });

  it('does not invent 1 LF on tap or mark an expanded LF row as selected', () => {
    const conduit = { unit: 'LF', selected: false, conflicted: false };
    expect(electricalQmTapQuantity(conduit)).toBeNull();
    expect(electricalQmChipSelected(conduit, false)).toBe(false);
    expect(electricalQmChipSelected(conduit, true)).toBe(false);
  });

  it('does not auto-select a conflicted row on tap', () => {
    const conflicted = { unit: 'EA', selected: false, conflicted: true };
    expect(electricalQmTapQuantity(conflicted)).toBeNull();
    expect(electricalQmChipSelected(conflicted, true)).toBe(false);
  });

  it('treats amperage and other attribute chips as live pricing writes', () => {
    const blank = electricalConfirmScopeAttributesFromMeasurements({});
    const withAmps = electricalConfirmScopeAttributesFromMeasurements({
      serviceAmperage: 125,
    });
    expect(
      electricalLivePricingAttributesChanged(
        blank as unknown as Record<string, unknown>,
        { ...blank, standardReceptacleCount: 50 } as unknown as Record<
          string,
          unknown
        >
      )
    ).toBe(false);
    expect(
      electricalLivePricingAttributesChanged(
        blank as unknown as Record<string, unknown>,
        withAmps as unknown as Record<string, unknown>
      )
    ).toBe(true);
    expect(
      electricalLivePricingAttributesChanged(
        withAmps as unknown as Record<string, unknown>,
        {
          ...withAmps,
          electricalPanelLocation: 'indoor',
        } as unknown as Record<string, unknown>
      )
    ).toBe(true);
  });

  it('stages all electrical edits until Confirm Scope flushes them', () => {
    const base = { mainPanelCount: '', standardReceptacleCount: 50 };
    expect(
      electricalQuantityFieldsChanged(
        base as Record<string, unknown>,
        { ...base, mainPanelCount: '1' } as Record<string, unknown>
      )
    ).toBe(true);
    expect(
      electricalMeasurementsShouldFlushImmediately(
        base as Record<string, unknown>,
        { ...base, mainPanelCount: '1' } as Record<string, unknown>
      )
    ).toBe(false);
    expect(
      electricalMeasurementsShouldFlushImmediately(
        base as Record<string, unknown>,
        { ...base, electricalPanelLocation: 'indoor' } as Record<
          string,
          unknown
        >
      )
    ).toBe(false);
  });

  it('defers Confirm Scope parent commits so chip paint is not blocked', () => {
    expect(CONFIRM_SCOPE_CHIP_COMMIT_MS).toBeGreaterThanOrEqual(180);
    expect(CONFIRM_SCOPE_CHIP_PRESS_LOCK_MS).toBeGreaterThanOrEqual(100);
    expect(confirmScopeChipPainted(false, null)).toBe(false);
    expect(confirmScopeChipPainted(false, true)).toBe(true);
    expect(confirmScopeChipPainted(true, false)).toBe(false);
    expect(confirmScopeChipPainted(true, null)).toBe(true);
    expect(confirmScopeChipPainted(true, false, true)).toBe(false);
  });

  it('treats finger travel past the slop as a scroll, not a chip tap', () => {
    expect(CONFIRM_SCOPE_CHIP_SCROLL_SLOP).toBeGreaterThanOrEqual(12);
    expect(confirmScopeChipIsTap(0, 0)).toBe(true);
    expect(confirmScopeChipIsTap(4, 4)).toBe(true);
    expect(confirmScopeChipIsTap(0, CONFIRM_SCOPE_CHIP_SCROLL_SLOP)).toBe(true);
    expect(confirmScopeChipIsTap(0, CONFIRM_SCOPE_CHIP_SCROLL_SLOP + 1)).toBe(
      false
    );
    expect(confirmScopeChipIsTap(20, 20)).toBe(false);
  });
});
