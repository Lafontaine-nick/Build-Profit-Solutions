import {
  collectRoofingInferenceNotes,
  inferChoiceFromNotes,
  inferItemStateFromNotes,
  inferRoofingSystemFromNotes,
  inferRoofingTearOffFromNotes,
  inferRoofingTradeScopeSelectionsFromNotes,
  infersRoofingUnderlaymentUpgradeFromNotes,
  notesExcludeElectricalServiceUpgrade,
  notesOwnerHandlesScopeCategory,
  parseRoofingDeckingAllowanceFromNotes,
} from '@/utils/scopeItemNoteHints';
import {
  applyGroundUpShellScopeDefaults,
  ensureWholeProjectGroundUpScopeItems,
  filterRoomRemodelNoteScopeItems,
  groupScopeChecklistItems,
  isMixedExteriorScopeNotes,
  isWholeProjectPlanExport,
  applyScopeInferencesFromNotes,
  hydrateScopeChecklistFromNotes,
} from '@/utils/estimateScopeChecklistUi';
import { resolveChecklistItemQuantity } from '@/utils/scopeItemQuantities';

describe('scopeItemNoteHints trim inference', () => {
  const BATH_REMODEL =
    'Bathroom remodel. Tile shower walls, new shower pan, move rough plumbing, shower door. Final plumbing trim (faucets, toilet set, hookups) with new fixtures.';

  test('plumbing trim does not include trim & baseboard scope', () => {
    expect(inferItemStateFromNotes('trim', BATH_REMODEL)).toBe('unsure');
    expect(inferItemStateFromNotes('plumbing_trim', BATH_REMODEL)).toBe(
      'included'
    );
  });

  test('baseboard install still includes trim scope', () => {
    expect(
      inferItemStateFromNotes('trim', 'Install baseboards throughout 220 LF.')
    ).toBe('included');
  });

  test('treats explicitly excluded electrical service upgrades as excluded', () => {
    const notes =
      'Replace the existing HVAC system and ductwork. Excludes plumbing, electrical service upgrades, and building repairs.';

    expect(notesExcludeElectricalServiceUpgrade(notes)).toBe(true);
    expect(inferItemStateFromNotes('electrical_service_upgrade', notes)).toBe(
      'excluded'
    );
  });

  test('room remodel scope keeps explicit work and drops unsupported finish inferences', () => {
    const notes =
      'Remodel a 2,400 sqft home with demolition and removal of existing cabinets, fixtures, flooring, drywall, and finishes as needed; kitchen and bathroom updates, 1,800 sqft flooring, 500 sqft drywall repair, six windows, two exterior doors, four interior doors, wall and attic insulation, air sealing, trim, plumbing, electrical, and interior paint.';
    const items = [
      'plumbing',
      'electrical',
      'drywall',
      'flooring',
      'insulation',
      'exterior_door_install',
      'window_install',
      'interior_door_install',
      'cabinet_demo',
      'floor_demo',
      'fixture_demo',
      'air_sealing',
      'baseboard_install',
      'door_paint',
      'door_casing_paint',
      'exterior_trim_paint',
      'trim_paint',
    ].map(id => ({
      id,
      label: id,
      inputType: 'yes_no' as const,
      state: 'included' as const,
    }));

    const hydrated = hydrateScopeChecklistFromNotes(
      items,
      'room_remodel',
      notes,
      { itemQuantities: {} } as any,
      'other'
    );
    const includedIds = hydrated
      .filter(item => item.state === 'included')
      .map(item => item.id);
    expect(includedIds).toEqual(
      expect.arrayContaining([
        'plumbing',
        'electrical',
        'drywall',
        'flooring',
        'insulation',
        'exterior_door_install',
        'window_install',
        'interior_door_install',
        'cabinet_demo',
        'floor_demo',
        'fixture_demo',
        'air_sealing',
        'baseboard_install',
      ])
    );
    expect(includedIds).not.toEqual(
      expect.arrayContaining([
        'door_paint',
        'door_casing_paint',
        'exterior_trim_paint',
        'trim_paint',
      ])
    );
  });

  test('mixed HVAC notes honor exclusions and retain unquantified HVAC components', () => {
    const notes =
      'Remove the existing HVAC system and ductwork, then install a new heat-pump system with thermostat, supply registers, and return grilles, including startup and testing. System count, tonnage, ductwork length, thermostat count, register count, and return grille count must be confirmed. Also patch drywall and paint ceilings. Excludes electrical service upgrades and plumbing.';
    const items = [
      'demo',
      'hvac',
      'drywall',
      'paint',
      'plumbing',
      'electrical',
      'ductwork',
      'thermostat',
      'supply_registers',
      'return_grilles',
      'equipment_replace',
    ].map(id => ({
      id,
      label: id,
      inputType: 'yes_no' as const,
      state: 'included' as const,
    }));

    const hydrated = hydrateScopeChecklistFromNotes(
      items,
      'room_remodel',
      notes,
      { itemQuantities: {} } as any,
      'other'
    );
    const includedIds = hydrated
      .filter(item => item.state === 'included')
      .map(item => item.id);

    expect(includedIds).toEqual(
      expect.arrayContaining([
        'hvac',
        'drywall',
        'paint',
        'ductwork',
        'thermostat',
        'supply_registers',
        'return_grilles',
        'equipment_replace',
      ])
    );
    expect(includedIds).not.toEqual(
      expect.arrayContaining(['demo', 'plumbing', 'electrical'])
    );
  });

  test('mixed addition notes keep only explicitly stated trade checklist items', () => {
    const notes =
      'Remodel an existing 2,000 sqft home and build a 350 sqft addition. Electrical scope includes a 200A main panel, wiring and boxes for 30 standard receptacle locations, 6 GFCI receptacle locations, 20 switch locations, 26 recessed-light rough-in locations, four dedicated 20A circuits, and 240 LF of conduit. Repair 420 sqft of drywall, install six windows and two exterior doors, add R-21 wall insulation, install 1,100 sqft flooring, replace 160 LF baseboard, and paint the interior.';
    const items = [
      'foundation',
      'framing',
      'roofing',
      'hvac',
      'electrical',
      'electrical_main_panel',
      'electrical_dedicated_20a',
      'drywall',
      'electrical_standard_receptacle',
      'electrical_gfci_receptacle',
      'electrical_single_pole_switch',
      'electrical_recessed_light',
      'electrical_conduit',
      'windows',
      'window_install',
      'exterior_doors',
      'insulation',
      'flooring',
      'baseboard_install',
      'interior_paint',
      'cabinets',
      'countertops',
      'deck_patio',
      'garage_doors',
    ].map(id => ({
      id,
      label: id,
      inputType: 'yes_no' as const,
      state: 'included' as const,
    }));

    const filtered = filterRoomRemodelNoteScopeItems(items, notes);
    const ids = filtered.map(item => item.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'foundation',
        'framing',
        'roofing',
        'hvac',
        'electrical',
        'electrical_main_panel',
        'electrical_dedicated_20a',
        'electrical_standard_receptacle',
        'electrical_gfci_receptacle',
        'electrical_single_pole_switch',
        'electrical_recessed_light',
        'electrical_conduit',
        'drywall',
        'windows',
        'window_install',
        'exterior_doors',
        'insulation',
        'flooring',
        'baseboard_install',
        'interior_paint',
      ])
    );
    expect(ids).not.toEqual(
      expect.arrayContaining([
        'cabinets',
        'countertops',
        'deck_patio',
        'garage_doors',
      ])
    );
  });

  test('surfaces generic door notes as interior door installation', () => {
    const next = hydrateScopeChecklistFromNotes(
      [],
      'bathroom',
      'Remodel the bathroom with doors, drywall, and paint.'
    );

    expect(next).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'interior_door_install',
          state: 'included',
          noteBacked: true,
        }),
      ])
    );
    expect(next.some(item => item.id === 'doors')).toBe(false);
  });

  test('cross-trade note aliases identify standard air sealing', () => {
    for (const phrase of [
      'Include gap sealing.',
      'Include gap seal around penetrations.',
      'Include draft seal at accessible openings.',
      'Include penetration sealing.',
    ]) {
      expect(inferItemStateFromNotes('air_sealing', phrase)).toBe('included');
    }
  });

  test('scoped insulation exclusions do not remove house insulation', () => {
    const notes = 'Insulate the house, but no garage insulation.';
    expect(inferItemStateFromNotes('insulation', notes)).toBe('included');
    expect(inferItemStateFromNotes('garage_insulation', notes)).not.toBe(
      'included'
    );
  });

  test('kitchen protection and structural exclusions override stale generic scope', () => {
    const notes =
      'Remodel an existing kitchen without changing the footprint. Include flooring protection and cleanup. No wall removal or structural framing.';
    expect(inferItemStateFromNotes('flooring', notes)).toBe('excluded');
    expect(inferItemStateFromNotes('framing', notes)).toBe('excluded');
    expect(inferItemStateFromNotes('walls_moving', notes)).toBe('excluded');
  });

  test('shower floor tile notes do not include floor_tile', () => {
    expect(
      inferItemStateFromNotes(
        'floor_tile',
        'Tile shower walls and tile the shower floor.'
      )
    ).toBe('unsure');
    expect(
      inferItemStateFromNotes(
        'floor_tile',
        'Install bathroom floor tile outside the shower.'
      )
    ).toBe('included');
  });

  test('does not auto-include permits from vague inspection language', () => {
    expect(
      inferItemStateFromNotes(
        'permits',
        'Bathroom remodel with final inspection and cleanup.'
      )
    ).toBe('unsure');
    expect(
      inferItemStateFromNotes(
        'permits',
        'Include permits in the bid for this remodel.'
      )
    ).toBe('included');
  });
});

describe('scopeItemNoteHints roofing inference', () => {
  test('infers architectural shingles from common re-roof notes', () => {
    expect(
      inferRoofingSystemFromNotes(
        'Full tear-off and re-roof with architectural shingles. Ice & water at eaves.'
      )
    ).toBe('architectural_shingles');
    expect(
      inferChoiceFromNotes(
        'roofing_system',
        'Full tear-off and re-roof with architectural shingles.'
      )
    ).toBe('architectural_shingles');
  });

  test('infers standing seam metal and membrane systems', () => {
    expect(
      inferRoofingSystemFromNotes('Install standing seam metal roof.')
    ).toBe('standing_seam_metal');
    expect(inferRoofingSystemFromNotes('TPO flat roof replacement.')).toBe(
      'tpo'
    );
    expect(inferRoofingSystemFromNotes('EPDM rubber membrane roof.')).toBe(
      'epdm'
    );
  });

  test('infers tear-off depth from notes', () => {
    expect(
      inferRoofingTearOffFromNotes('Tear off existing shingles, one layer.')
    ).toBe('one_layer');
    expect(inferRoofingTearOffFromNotes('Two layer tear-off required.')).toBe(
      'two_layers'
    );
    expect(
      inferRoofingTearOffFromNotes('Roof-over / recover, no tear-off.')
    ).toBe('new_construction');
    expect(
      inferChoiceFromNotes('tear_off', 'Full roof replacement with tear-off.')
    ).toBe('one_layer');
  });

  test('pre-selects QM roofing chips from notes when tear-off and shingles are mentioned', () => {
    expect(
      inferRoofingTradeScopeSelectionsFromNotes(
        'Tear off and install new architectural shingles. Add ridge vent and drip edge.'
      )
    ).toEqual(
      expect.arrayContaining([
        'tear_off',
        'shingles',
        'ridge_vent',
        'drip_edge',
      ])
    );
  });

  test('collectRoofingInferenceNotes unions draft note fields for chip inference', () => {
    const combined = collectRoofingInferenceNotes(
      {
        originalNotes:
          '22-square re-roof with architectural shingles, tear-off 1 layer, ice & water at eaves, drip edge',
      },
      '22 square roof replacement'
    );
    expect(combined).toContain('ice & water at eaves');
    expect(inferRoofingTradeScopeSelectionsFromNotes(combined)).toEqual(
      expect.arrayContaining(['ice_water_shield', 'drip_edge'])
    );
  });

  test('applyScopeInferencesFromNotes marks inferred roofing choices as note-backed', () => {
    const items = [
      {
        id: 'roofing_system',
        inputType: 'choice' as const,
        label: 'Roofing system',
        state: 'unsure' as const,
        choiceId: 'unsure',
      },
      {
        id: 'tear_off',
        inputType: 'choice' as const,
        label: 'Existing roof / tear-off',
        state: 'unsure' as const,
        choiceId: 'unsure',
      },
    ];
    const next = applyScopeInferencesFromNotes(
      items,
      'Re-roof with architectural shingles. Tear off one layer.',
      'roofing'
    );
    expect(next.find(item => item.id === 'roofing_system')).toMatchObject({
      choiceId: 'architectural_shingles',
      noteBacked: true,
    });
    expect(next.find(item => item.id === 'tear_off')).toMatchObject({
      choiceId: 'one_layer',
      noteBacked: true,
    });
  });

  test('does not treat standard new underlayment as premium upgrade chip', () => {
    const notes =
      'Tear off and reroof, 22 squares architectural shingles. New underlayment, drip edge, pipe boots, haul off old shingles.';
    expect(infersRoofingUnderlaymentUpgradeFromNotes(notes)).toBe(false);
    expect(inferRoofingTradeScopeSelectionsFromNotes(notes)).not.toContain(
      'underlayment'
    );
    expect(inferRoofingTradeScopeSelectionsFromNotes(notes)).toEqual(
      expect.arrayContaining([
        'tear_off',
        'shingles',
        'drip_edge',
        'pipe_boots',
        'cleanup',
      ])
    );
  });

  test('parses decking allowance and selects decking repair chip', () => {
    const notes =
      'Tear off and reroof, 22 squares architectural shingles. Decking looks ok but put $1,000 allowance if we find bad wood.';
    expect(parseRoofingDeckingAllowanceFromNotes(notes)).toBe(1000);
    expect(inferRoofingTradeScopeSelectionsFromNotes(notes)).toContain(
      'decking_repair'
    );
  });
});

describe('ground-up owner-handled scope exclusions', () => {
  const GROUND_UP_HOME_NOTES = `New 2,800 sqft two story home with attached 2-car garage. Standard builder grade finishes. Owner is taking care of sitework, utilities, and landscaping separate from us.`;

  test('detects owner-handled sitework, utilities, and landscaping', () => {
    expect(
      notesOwnerHandlesScopeCategory(GROUND_UP_HOME_NOTES, 'sitework')
    ).toBe(true);
    expect(
      notesOwnerHandlesScopeCategory(GROUND_UP_HOME_NOTES, 'utilities')
    ).toBe(true);
    expect(
      notesOwnerHandlesScopeCategory(GROUND_UP_HOME_NOTES, 'landscaping')
    ).toBe(true);
  });

  test('excludes sitework-related cards when owner handles them', () => {
    expect(inferItemStateFromNotes('excavation', GROUND_UP_HOME_NOTES)).toBe(
      'excluded'
    );
    expect(inferItemStateFromNotes('landscaping', GROUND_UP_HOME_NOTES)).toBe(
      'excluded'
    );
    expect(inferItemStateFromNotes('utility_taps', GROUND_UP_HOME_NOTES)).toBe(
      'excluded'
    );
    expect(inferItemStateFromNotes('framing', GROUND_UP_HOME_NOTES)).toBe(
      'unsure'
    );
  });

  test('promotes shell trades on new-build ground-up notes', () => {
    const items = applyGroundUpShellScopeDefaults(
      [
        {
          id: 'framing',
          label: 'Framing',
          inputType: 'yes_no',
          state: 'unsure',
        },
        {
          id: 'drywall',
          label: 'Drywall',
          inputType: 'yes_no',
          state: 'unsure',
        },
        {
          id: 'excavation',
          label: 'Excavation',
          inputType: 'yes_no',
          state: 'unsure',
        },
      ] as any,
      { templateKey: 'ground_up', notes: GROUND_UP_HOME_NOTES }
    );
    expect(items.find(i => i.id === 'framing')?.state).toBe('included');
    expect(items.find(i => i.id === 'drywall')?.state).toBe('included');
    expect(items.find(i => i.id === 'excavation')?.state).toBe('unsure');
  });

  test('includes site trades on a general-contractor plan export', () => {
    const notes =
      'Ground-up new construction from imported architectural plans. --- Plan takeoff --- Living area: 2,571 sqft.';
    const items = applyGroundUpShellScopeDefaults(
      ['excavation', 'landscaping', 'utility_taps', 'sitework'].map(id => ({
        id,
        label: id,
        inputType: 'yes_no' as const,
        state: 'unsure' as const,
      })),
      { templateKey: 'ground_up', notes }
    );
    expect(items.find(i => i.id === 'excavation')?.state).toBe('included');
    expect(items.find(i => i.id === 'landscaping')?.state).toBe('included');
    expect(items.find(i => i.id === 'utility_taps')?.state).toBe('included');
    expect(items.find(i => i.id === 'sitework')?.state).toBe('unsure');
  });

  test('plan export keeps the ground-up checklist and does not price living area as flatwork', () => {
    const notes =
      'Ground-up new construction from imported architectural plans.\n--- Plan takeoff ---\nLiving area: 2,571 sqft. Deck / patio: 322 sqft. Windows: 31. Exterior doors: 4. Roofing.';
    const shortList = [
      {
        id: 'pour_flatwork',
        label: 'Pour flatwork',
        inputType: 'yes_no' as const,
        state: 'included' as const,
      },
      {
        id: 'windows',
        label: 'Windows',
        inputType: 'yes_no' as const,
        state: 'included' as const,
      },
      {
        id: 'exterior_trim_paint',
        label: 'Exterior trim paint',
        inputType: 'yes_no' as const,
        state: 'included' as const,
      },
      {
        id: 'exterior_prep',
        label: 'Exterior Prep & Masking',
        inputType: 'yes_no' as const,
        state: 'included' as const,
      },
    ];
    expect(isMixedExteriorScopeNotes(notes)).toBe(false);
    expect(filterRoomRemodelNoteScopeItems(shortList, notes)).toHaveLength(
      shortList.length
    );
    const items = ensureWholeProjectGroundUpScopeItems(shortList, notes);
    for (const id of [
      'excavation',
      'utility_taps',
      'landscaping',
      'foundation',
      'framing',
      'roofing',
      'insulation',
      'drywall',
      'interior_paint',
      'exterior_paint',
      'electrical_rough',
      'electrical_trim',
      'plumbing_rough',
      'plumbing_trim',
      'hvac',
      'flooring',
      'cabinets',
      'permits',
    ]) {
      expect(items.find(item => item.id === id)?.state).toBe('included');
    }
    expect(items.some(item => item.id === 'exterior_trim_paint')).toBe(false);
    expect(items.some(item => item.id === 'exterior_prep')).toBe(false);
    const groups = groupScopeChecklistItems(items, 'ground_up', { notes });
    expect(groups.some(group => group.title === 'Structure')).toBe(true);
    expect(groups.some(group => group.title === 'Mixed exterior scope')).toBe(
      false
    );
    const mixedNotes =
      'Covered patio 322 sqft and exterior doors. Pour flatwork.';
    expect(
      groupScopeChecklistItems(items, 'painting', {
        notes: mixedNotes,
        wholeProjectPlan: true,
      }).some(group => group.title === 'Mixed exterior scope')
    ).toBe(false);
    expect(
      isWholeProjectPlanExport({
        hasPlanBuildingAreas: true,
        notes: mixedNotes,
      })
    ).toBe(true);
    expect(items.some(item => item.id === 'electrical')).toBe(false);
    const flatwork = resolveChecklistItemQuantity(
      'pour_flatwork',
      {
        floorAreaSqft: '2571',
        concreteSqft: '2571',
        itemQuantities: {
          pour_flatwork: {
            quantity: 2571,
            unit: 'sqft',
            quantitySource: 'user_entered',
          },
        },
      } as any,
      { templateKey: 'ground_up', notes }
    );
    expect(flatwork.quantity).not.toBe(2571);
  });

  test('applyScopeInferencesFromNotes excludes owner sitework and includes shell', () => {
    const items = applyScopeInferencesFromNotes(
      [
        {
          id: 'framing',
          label: 'Framing',
          inputType: 'yes_no',
          state: 'unsure',
        },
        {
          id: 'roofing',
          label: 'Roofing',
          inputType: 'yes_no',
          state: 'unsure',
        },
        {
          id: 'landscaping',
          label: 'Landscaping',
          inputType: 'yes_no',
          state: 'unsure',
        },
        {
          id: 'excavation',
          label: 'Excavation',
          inputType: 'yes_no',
          state: 'unsure',
        },
      ] as any,
      GROUND_UP_HOME_NOTES,
      'ground_up'
    );
    expect(items.find(i => i.id === 'framing')?.state).toBe('included');
    expect(items.find(i => i.id === 'roofing')?.state).toBe('included');
    expect(items.find(i => i.id === 'landscaping')?.state).toBe('excluded');
    expect(items.find(i => i.id === 'excavation')?.state).toBe('excluded');
  });
});
