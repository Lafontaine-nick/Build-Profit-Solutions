import {
  applyScopeFoundClarification,
  flooringReplaceIncludesRemoval,
  interiorPaintSurfacesAnswered,
  measurementsForScopeFoundChoice,
  resolveScopeFoundClarification,
  scopeFoundPieceHasQuickMeasurement,
  scopeFoundRemovalMeasurements,
  scopeFoundRevealLines,
  scopeFoundTradePieceIds,
  splitRoofTearOffCards,
} from '@/utils/scopeFoundClarification';
import { getScopeUnitDefinition } from '@/utils/scopeIntelligence';
import { groupScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';

describe('scope found clarification', () => {
  it('keeps the shower question on a new pan and wall tile note', () => {
    const prompt = resolveScopeFoundClarification(
      'New prefab shower pan. Tile the shower walls, 90 sqft.'
    );
    expect(prompt?.id).toBe('shower');
    expect(prompt?.options.map(option => option.label)).toContain('Prefab pan');
    expect(prompt?.options.map(option => option.label)).toContain('Wall tile');
    expect(prompt?.options.map(option => option.label)).toContain('No demo');
  });

  it('asks once when new flooring does not include removal', () => {
    const prompt = resolveScopeFoundClarification('Install 1,200 sqft LVP');
    expect(prompt).toMatchObject({
      id: 'flooring_demo',
      multi: true,
      question: 'Is existing flooring being removed?',
    });
    expect(prompt?.options.map(option => option.label)).toEqual([
      'Carpet',
      'Tile',
      'Hardwood',
      'Vinyl',
      'Laminate',
      'No demo',
      'Not sure',
    ]);
    const items = applyScopeFoundClarification([], 'Install 1,200 sqft LVP', {
      scopeFoundClarificationId: 'flooring_demo',
      scopeFoundPieces: ['carpet', 'tile'],
    });
    expect(items.map(item => item.id)).toEqual(['floor_demo']);
    expect(
      scopeFoundRevealLines('Install 1,200 sqft LVP', 'flooring_demo', null, [
        'carpet',
        'tile',
      ])
    ).toEqual([
      { name: 'Remove carpet', amount: 0, quantity: '1,200 sqft' },
      { name: 'Remove tile', amount: 0, quantity: '1,200 sqft' },
    ]);
    expect(
      scopeFoundRevealLines(
        'Install 1,200 sqft LVP',
        'flooring_demo',
        null,
        ['carpet', 'tile'],
        {
          itemQuantities: {
            floor_demo__carpet: { quantity: 2000, unit: 'sqft' },
            floor_demo__tile: { quantity: 1200, unit: 'sqft' },
          },
        }
      )
    ).toEqual([
      { name: 'Remove carpet', amount: 0, quantity: '2,000 sqft' },
      { name: 'Remove tile', amount: 0, quantity: '1,200 sqft' },
    ]);
    expect(
      applyScopeFoundClarification([], 'Install 1,200 sqft LVP', {
        scopeFoundClarificationId: 'flooring_demo',
        scopeFoundChoice: 'unsure',
      })
    ).toEqual([]);
  });

  it('treats a flooring replacement as removal and asks nothing', () => {
    expect(flooringReplaceIncludesRemoval('Replace carpet with 900 sqft LVP')).toBe(
      true
    );
    expect(resolveScopeFoundClarification('Replace carpet with 900 sqft LVP')).toBe(
      null
    );
    expect(
      applyScopeFoundClarification([], 'Replace carpet with 900 sqft LVP', {}).map(
        item => item.id
      )
    ).toEqual(['floor_demo']);
  });

  it('asks about tear-off for new shingles and skips a reroof and a new build', () => {
    expect(
      resolveScopeFoundClarification('New architectural shingles, 26 squares')?.options.map(
        option => option.label
      )
    ).toEqual(['Shingles', 'Tile', 'Metal', 'Flat roof', 'No demo', 'Not sure']);
    expect(resolveScopeFoundClarification('Reroof 26 squares of architectural shingles')).toBe(
      null
    );
    expect(
      resolveScopeFoundClarification('Build a 2,600 sqft single-family home.')
    ).toBe(null);
  });

  it('prices each selected roof tear-off material from the 26 squares', () => {
    const next = splitRoofTearOffCards(
      [{ id: 'roofing_system', state: 'included' }],
      {
        tradeScopeSelections: { roofing: ['shingles', 'tear_off'] },
        scopeFoundPieces: ['shingles', 'metal'],
      }
    );
    expect(next.map(item => item.id)).toEqual([
      'tear_off_shingles',
      'tear_off_metal',
      'roofing_system',
    ]);
    expect(next.find(item => item.id === 'tear_off_shingles')?.noteBacked).toBe(
      false
    );
  });

  it('keeps each tear-off material on the squares typed for that material', () => {
    const seeded = measurementsForScopeFoundChoice(
      { roofSquares: 26 },
      'roof_tearoff',
      ['shingles', 'metal'],
      'New architectural shingles, 26 squares'
    );
    expect(seeded.itemQuantities?.tear_off_shingles).toBeUndefined();
    expect(seeded.itemQuantities?.tear_off_metal).toBeUndefined();
    const typed = {
      ...seeded,
      itemQuantities: {
        tear_off_shingles: {
          quantity: 20,
          unit: 'squares',
          quantitySource: 'user_entered' as const,
        },
        tear_off_metal: {
          quantity: 6,
          unit: 'squares',
          quantitySource: 'user_entered' as const,
        },
      },
    };
    expect(
      resolveChecklistItemQuantity('tear_off_shingles', typed, {
        templateKey: 'roofing',
      }).quantity
    ).toBe(20);
    expect(
      resolveChecklistItemQuantity('tear_off_metal', typed, {
        templateKey: 'roofing',
      }).quantity
    ).toBe(6);
    expect(
      scopeFoundRevealLines(
        'New architectural shingles, 26 squares',
        'roof_tearoff',
        null,
        ['shingles', 'metal'],
        typed
      ).map(line => line.quantity)
    ).toEqual(['20 squares', '6 squares']);
  });

  it('asks about an existing structure on a new build and stays quiet on a plain addition', () => {
    expect(
      resolveScopeFoundClarification(
        'Build a 2,600 sqft single-family home. The old garage is still on the lot.'
      )?.options.map(option => option.label)
    ).toEqual(['House', 'Garage', 'No demo', 'Not sure']);
    expect(
      resolveScopeFoundClarification('500 sqft bedroom addition with a tie-in roof.')
    ).toBe(null);
  });

  it('asks one grouped kitchen question and maps the answer onto the named surfaces', () => {
    const notes =
      'New cabinets 22 LF, quartz countertops 55 sqft, backsplash 30 sqft, new LVP 300 sqft.';
    const prompt = resolveScopeFoundClarification(notes);
    expect(prompt?.id).toBe('kitchen_demo');
    expect(prompt?.options.map(option => option.label)).toEqual([
      'Cabinets',
      'Countertops',
      'Backsplash',
      'Flooring',
      'No demo',
      'Not sure',
    ]);
    expect(
      applyScopeFoundClarification([], notes, {
        scopeFoundClarificationId: 'kitchen_demo',
        scopeFoundPieces: ['kitchen_floor'],
      }).map(item => item.id)
    ).toEqual(['floor_demo']);
    expect(
      scopeFoundRevealLines(notes, 'kitchen_demo', null, [
        'cabinets',
        'countertops',
        'backsplash',
        'kitchen_floor',
      ]).map(line => [line.name, line.quantity])
    ).toEqual([
      ['Cabinet demo', '22 LF'],
      ['Countertop demo', '55 sqft'],
      ['Backsplash demo', '30 sqft'],
      ['Flooring demo / removal', '300 sqft'],
    ]);
    const chosen = measurementsForScopeFoundChoice(
      {},
      'kitchen_demo',
      ['cabinets', 'countertops', 'backsplash', 'kitchen_floor'],
      notes
    );
    expect(chosen.cabinetLf).toBe(22);
    expect(chosen.countertopSqft).toBe(55);
    expect(chosen.backsplashSqft).toBe(30);
    expect(chosen.kitchenFloorSqft).toBe(300);
    expect(chosen.floorDemoSqft).toBe(300);
    expect(chosen.kitchenDemoCabinetCount).toBe(1);
    expect(chosen.kitchenDemoCounterCount).toBe(1);
    expect(chosen.kitchenDemoBacksplashCount).toBe(1);
    expect(chosen.kitchenDemoFloorCount).toBe(1);
    expect(chosen.kitchenDemoIslandCount).toBeNull();
    const withIsland = measurementsForScopeFoundChoice(
      {},
      'kitchen_demo',
      ['island'],
      notes
    );
    expect(withIsland.kitchenDemoIslandCount).toBe(1);
    expect(withIsland.itemQuantities?.island_demo).toMatchObject({
      quantity: 1,
      unit: 'each',
    });
  });

  it('keeps appliances that stay off the demolition question and does not borrow counter area for the floor', () => {
    const notes =
      'Quartz countertops, 60 sqft. Tile backsplash, 30 sqft. Appliances stay.';
    const prompt = resolveScopeFoundClarification(notes);
    expect(prompt?.options.map(option => option.label)).toEqual([
      'Countertops',
      'Backsplash',
      'Flooring',
      'No demo',
      'Not sure',
    ]);
    expect(
      scopeFoundRevealLines(notes, 'kitchen_demo', null, [
        'countertops',
        'backsplash',
        'kitchen_floor',
      ]).map(line => [line.name, line.quantity])
    ).toEqual([
      ['Countertop demo', '60 sqft'],
      ['Backsplash demo', '30 sqft'],
      ['Flooring demo / removal', ''],
    ]);
  });

  it('asks removal only for the counter and backsplash a kitchen note names', () => {
    const notes = 'Quartz countertops 60 sqft. Tile backsplash 30 sqft.';
    const prompt = resolveScopeFoundClarification(notes);
    expect(prompt?.id).toBe('kitchen_demo');
    expect(prompt?.options.map(option => option.label)).toEqual([
      'Countertops',
      'Backsplash',
      'Flooring',
      'No demo',
      'Not sure',
    ]);
    const chosen = measurementsForScopeFoundChoice(
      {},
      'kitchen_demo',
      ['countertops', 'backsplash'],
      notes
    );
    expect(chosen.kitchenDemoCounterCount).toBe(1);
    expect(chosen.kitchenDemoBacksplashCount).toBe(1);
    expect(chosen.kitchenDemoCabinetCount).toBeNull();
    expect(chosen.kitchenDemoFloorCount).toBeNull();
    expect(chosen.countertopSqft).toBe(60);
    expect(chosen.backsplashSqft).toBe(30);
    expect(chosen.itemQuantities?.countertop_demo).toMatchObject({
      quantity: 60,
      unit: 'sqft',
    });
    expect(chosen.itemQuantities?.backsplash_demo).toMatchObject({
      quantity: 30,
      unit: 'sqft',
    });
    expect(
      resolveScopeFoundClarification('New quartz vanity and tile shower.')?.id
    ).not.toBe('kitchen_demo');
  });

  it('asks about ceilings and trim only when the note says the entire interior', () => {
    expect(resolveScopeFoundClarification('Paint walls, 2,000 sqft')).toBe(null);
    const prompt = resolveScopeFoundClarification('Repaint entire interior');
    expect(prompt?.id).toBe('interior_paint_extent');
    expect(prompt?.options.map(option => option.label)).toEqual([
      'Walls',
      'Ceilings',
      'Trim',
      'Doors',
      'Cabinets',
      'Not sure',
    ]);
    const picked = measurementsForScopeFoundChoice(
      {},
      'interior_paint_extent',
      ['walls', 'ceilings'],
      'Repaint entire interior'
    );
    const both = measurementsForScopeFoundChoice(
      picked,
      'interior_paint_extent',
      ['walls', 'ceilings', 'trim', 'doors', 'paint_cabinets'],
      'Repaint entire interior'
    );
    expect(both.scopeFoundPieces).toEqual([
      'walls',
      'ceilings',
      'trim',
      'doors',
      'paint_cabinets',
    ]);
    expect(both.paintScope).toEqual(['walls', 'ceilings', 'trim', 'doors', 'cabinets']);
    expect(interiorPaintSurfacesAnswered(both)).toBe(true);
    expect(interiorPaintSurfacesAnswered({})).toBe(false);
    expect(
      applyScopeFoundClarification([], 'Repaint entire interior', {
        scopeFoundClarificationId: 'interior_paint_extent',
        scopeFoundPieces: ['doors', 'paint_cabinets'],
      }).map(item => item.id)
    ).toEqual(['door_paint', 'cabinet_paint']);
    expect(
      applyScopeFoundClarification([], 'Repaint entire interior', {
        scopeFoundClarificationId: 'interior_paint_extent',
        scopeFoundPieces: ['ceilings', 'trim'],
      }).map(item => item.id)
    ).toEqual(['ceiling_paint', 'trim_paint']);
  });

  it('asks one demolition question for a whole-home remodel', () => {
    const prompt = resolveScopeFoundClarification(
      'Whole house remodel. Kitchen, two bathrooms, flooring, paint, doors, and baseboard.'
    );
    expect(prompt?.id).toBe('whole_home_demo');
    expect(prompt?.options.map(option => option.label)).toEqual([
      'Cabinets',
      'Countertops',
      'Backsplash',
      'Appliances',
      'Carpet',
      'Tile',
      'Hardwood',
      'Vinyl',
      'Laminate',
      'No demo',
      'Not sure',
    ]);
  });

  it('puts selected deck removal on its own lines and prices the surface at the deck removal rate', () => {
    const notes = 'New 200 sqft deck';
    expect(
      applyScopeFoundClarification([], notes, {
        scopeFoundClarificationId: 'deck_demo',
        scopeFoundPieces: ['deck_surface', 'deck_railing', 'deck_stairs'],
      }).map(item => item.id)
    ).toEqual(['deck_surface_demo', 'deck_railing_demo', 'deck_stairs_demo']);
    const next = measurementsForScopeFoundChoice(
      { deckSqft: 200 },
      'deck_demo',
      ['deck_surface', 'deck_railing', 'deck_stairs'],
      notes
    );
    expect(next.deckDemoSqft).toBe(200);
    expect(next.deckStairDemoCount ?? null).toBeNull();
    expect(next.deckRailingDemoLf ?? null).toBeNull();
    expect(next.tradeScopeSelections.deck_patio).toEqual(
      expect.arrayContaining([
        'deck_surface_demo',
        'deck_railing_demo',
        'deck_stairs_demo',
      ])
    );
    const measurements = normalizeScopeMeasurements(next);
    const quantity = resolveChecklistItemQuantity('deck_surface_demo', measurements, {
      templateKey: 'deck_patio',
      notes,
    });
    expect(quantity.quantity).toBe(200);
    expect(
      resolveScopeItemSuggestedPricing(
        'deck_surface_demo',
        measurements,
        'deck_patio',
        quantity,
        null,
        null,
        notes
      ).fill
    ).toMatchObject({
      material: 400,
      labor: 1000,
      total: 1400,
      displayUnitRateLabel: '200 sqft × $7/sqft',
    });
    expect(
      resolveChecklistItemQuantity('deck_railing_demo', measurements, {
        templateKey: 'deck_patio',
        notes,
      }).quantity ?? null
    ).toBeNull();
    expect(
      resolveScopeItemSuggestedPricing(
        'deck_stairs_demo',
        measurements,
        'deck_patio',
        resolveChecklistItemQuantity('deck_stairs_demo', measurements, {
          templateKey: 'deck_patio',
          notes,
        }),
        null,
        null,
        notes
      ).fill?.total ?? null
    ).toBeNull();
    const measured = normalizeScopeMeasurements({
      ...measurements,
      deckRailingDemoLf: 15,
      deckStairDemoCount: 15,
    });
    const railingQuantity = resolveChecklistItemQuantity(
      'deck_railing_demo',
      measured,
      { templateKey: 'deck_patio', notes }
    );
    expect(railingQuantity.quantity).toBe(15);
    expect(
      resolveScopeItemSuggestedPricing(
        'deck_railing_demo',
        measured,
        'deck_patio',
        railingQuantity,
        null,
        null,
        notes
      ).fill
    ).toMatchObject({
      material: 30,
      labor: 75,
      total: 105,
      displayUnitRateLabel: '15 LF × $7/LF',
    });
    const stairQuantity = resolveChecklistItemQuantity(
      'deck_stairs_demo',
      measured,
      { templateKey: 'deck_patio', notes }
    );
    expect(stairQuantity.quantity).toBe(15);
    expect(
      resolveScopeItemSuggestedPricing(
        'deck_stairs_demo',
        measured,
        'deck_patio',
        stairQuantity,
        null,
        null,
        notes
      ).fill
    ).toMatchObject({
      material: 375,
      labor: 1875,
      total: 2250,
      displayUnitRateLabel: '15 flights × $150/flight',
    });
  });

  it('prices each selected exterior finish on its own card', () => {
    const notes = 'Rear house stucco, 800 sqft.';
    const pieces = [
      'old_stucco',
      'wood_siding',
      'vinyl_siding',
      'brick',
      'fiber_cement',
    ];
    const measured = measurementsForScopeFoundChoice(
      {},
      'stucco_demo',
      pieces,
      notes
    );
    const itemQuantities = {
      ...(measured.itemQuantities || {}),
      cladding_demo__old_stucco: {
        quantity: 800,
        unit: 'sqft',
        quantitySource: 'user_entered' as const,
      },
      cladding_demo__wood_siding: {
        quantity: 500,
        unit: 'sqft',
        quantitySource: 'user_entered' as const,
      },
      cladding_demo__vinyl_siding: {
        quantity: 500,
        unit: 'sqft',
        quantitySource: 'user_entered' as const,
      },
      cladding_demo__brick: {
        quantity: 500,
        unit: 'sqft',
        quantitySource: 'user_entered' as const,
      },
      cladding_demo__fiber_cement: {
        quantity: 500,
        unit: 'sqft',
        quantitySource: 'user_entered' as const,
      },
    };
    const items = applyScopeFoundClarification(
      [{ id: 'stucco' }, { id: 'cladding_demo' }],
      notes,
      { ...measured, itemQuantities }
    );
    expect(items.map(item => item.id)).toEqual([
      'stucco',
      'cladding_demo__old_stucco',
      'cladding_demo__wood_siding',
      'cladding_demo__vinyl_siding',
      'cladding_demo__brick',
      'cladding_demo__fiber_cement',
    ]);
    const normalized = normalizeScopeMeasurements({ itemQuantities });
    const expected = [
      ['cladding_demo__old_stucco', 800, 600, 1800, 2400],
      ['cladding_demo__wood_siding', 500, 250, 875, 1125],
      ['cladding_demo__vinyl_siding', 500, 175, 575, 750],
      ['cladding_demo__brick', 500, 625, 1875, 2500],
      ['cladding_demo__fiber_cement', 500, 300, 1075, 1375],
    ] as const;
    for (const [itemId, quantity, material, labor, total] of expected) {
      expect(getScopeUnitDefinition(itemId).preferredUnits).toContain('sqft');
      const resolved = resolveChecklistItemQuantity(itemId, normalized, { notes });
      expect(resolved).toMatchObject({ quantity, unit: 'sqft', pricingReady: true });
      const fill = resolveScopeItemSuggestedPricing(
        itemId,
        { itemQuantities },
        'stucco',
        resolved,
        null,
        null,
        notes
      ).fill;
      expect(fill).toMatchObject({ material, labor, total });
      expect((fill?.material || 0) + (fill?.labor || 0)).toBe(total);
    }
  });

  it('gives every scope found removal chip a quick measurement', () => {
    for (const pieceId of scopeFoundTradePieceIds()) {
      expect(scopeFoundPieceHasQuickMeasurement(pieceId)).toBe(true);
    }
    expect(
      scopeFoundRemovalMeasurements([
        'old_stucco',
        'wood_siding',
        'vinyl_siding',
        'brick',
        'fiber_cement',
      ]).map(row => row.label)
    ).toEqual([
      'Stucco removal',
      'Wood siding removal',
      'Vinyl siding removal',
      'Brick removal',
      'Fiber cement removal',
    ]);
  });

  it('asks which existing material is coming out on the other single-trade jobs', () => {
    expect(
      resolveScopeFoundClarification('New stucco, 1,800 sqft.')?.options.map(
        option => option.label
      )
    ).toEqual(['Stucco', 'Wood siding', 'Vinyl siding', 'Brick', 'Fiber cement', 'No demo', 'Not sure']);
    expect(
      resolveScopeFoundClarification('Pour a new 400 sqft concrete driveway.')?.options.map(
        option => option.label
      )
    ).toEqual(['Concrete', 'Asphalt', 'Pavers', 'Gravel', 'No demo', 'Not sure']);
    expect(
      resolveScopeFoundClarification('Install 2,000 sqft of sod.')?.options.map(
        option => option.label
      )
    ).toContain('Sod');
    expect(resolveScopeFoundClarification('Install R-38 attic insulation, 1,200 sqft.')?.id).toBe(
      'insulation_demo'
    );
    expect(resolveScopeFoundClarification('Frame 36 LF of stud wall.')?.id).toBe('framing_demo');
    expect(
      resolveScopeFoundClarification('Hang and finish 1,200 sqft of drywall.')?.id
    ).toBe('drywall_demo');
    expect(resolveScopeFoundClarification('Build a new 200 sqft deck.')?.id).toBe('deck_demo');
    expect(resolveScopeFoundClarification('Install a new furnace.')?.id).toBe('hvac_demo');
    expect(resolveScopeFoundClarification('Install 12 recessed lights.')?.id).toBe(
      'electrical_demo'
    );
    expect(resolveScopeFoundClarification('Install a new water heater.')?.id).toBe(
      'plumbing_demo'
    );
    expect(resolveScopeFoundClarification('Install 8 new windows.')?.id).toBe('openings_demo');
    expect(resolveScopeFoundClarification('Excavate 2,000 sqft for a foundation.')?.id).toBe(
      'excavation_demo'
    );
  });

  it('treats a stucco replacement as removal and asks nothing', () => {
    expect(resolveScopeFoundClarification('Replace the stucco, 1,800 sqft.')).toBe(null);
    expect(
      applyScopeFoundClarification([], 'Replace the stucco, 1,800 sqft.', {}).map(item => item.id)
    ).toEqual(['cladding_demo']);
  });

  it('adds the tapped concrete piece and leaves not sure empty', () => {
    const notes = 'Pour a new 400 sqft concrete driveway.';
    expect(
      applyScopeFoundClarification([], notes, {
        scopeFoundClarificationId: 'concrete_demo',
        scopeFoundPieces: ['concrete_slab'],
      }).map(item => item.id)
    ).toEqual(['demo_removal__concrete_slab']);
    expect(
      applyScopeFoundClarification([], notes, {
        scopeFoundClarificationId: 'concrete_demo',
        scopeFoundChoice: 'unsure',
      })
    ).toEqual([]);
    const next = measurementsForScopeFoundChoice(
      {},
      'concrete_demo',
      ['concrete_slab'],
      notes
    );
    expect(next.concreteDemoSqft).toBe(400);
    expect(next.itemQuantities?.demo_removal__concrete_slab).toMatchObject({
      quantity: 400,
      unit: 'sqft',
    });
    const normalized = normalizeScopeMeasurements({
      itemQuantities: next.itemQuantities,
    });
    const resolved = resolveChecklistItemQuantity(
      'demo_removal__concrete_slab',
      normalized,
      { notes }
    );
    expect(
      resolveScopeItemSuggestedPricing(
        'demo_removal__concrete_slab',
        { itemQuantities: next.itemQuantities },
        'concrete',
        resolved,
        null,
        null,
        notes
      ).fill
    ).toMatchObject({ material: 600, labor: 1000, total: 1600 });
    const gravel = measurementsForScopeFoundChoice(
      {},
      'concrete_demo',
      ['gravel'],
      notes
    );
    expect(
      applyScopeFoundClarification([], notes, gravel).map(item => item.id)
    ).toEqual(['demo_removal__gravel']);
    expect(gravel.concreteDemoSqft).toBe(400);
    expect(gravel.itemQuantities?.demo_removal__gravel).toMatchObject({
      quantity: 400,
      unit: 'sqft',
    });
    const gravelResolved = resolveChecklistItemQuantity(
      'demo_removal__gravel',
      normalizeScopeMeasurements({ itemQuantities: gravel.itemQuantities }),
      { notes }
    );
    expect(
      resolveScopeItemSuggestedPricing(
        'demo_removal__gravel',
        { itemQuantities: gravel.itemQuantities },
        'concrete',
        gravelResolved,
        null,
        null,
        notes
      ).fill
    ).toMatchObject({ material: 300, labor: 500, total: 800 });
    const groups = groupScopeChecklistItems(
      [
        { id: 'pour_flatwork', label: 'Pour flatwork', state: 'included', inputType: 'yes_no' },
        {
          id: 'demo_removal__concrete_slab',
          label: 'Concrete removal',
          state: 'included',
          inputType: 'yes_no',
        },
        { id: 'demo_removal__asphalt', label: 'Asphalt removal', state: 'included', inputType: 'yes_no' },
        {
          id: 'demo_removal__concrete_pavers',
          label: 'Paver removal',
          state: 'included',
          inputType: 'yes_no',
        },
        { id: 'demo_removal__gravel', label: 'Gravel removal', state: 'included', inputType: 'yes_no' },
      ],
      'concrete',
      { notes }
    );
    expect(groups.map(group => group.title)).toEqual(['Pour', 'Demo']);
    expect(groups[1]?.items.map(item => item.id)).toEqual([
      'demo_removal__concrete_slab',
      'demo_removal__asphalt',
      'demo_removal__concrete_pavers',
      'demo_removal__gravel',
    ]);
  });

  it('prices the other single-trade demos on their own cards', () => {
    const insulation = applyScopeFoundClarification([], 'Install R-38 attic insulation, 1,200 sqft.', {
      scopeFoundClarificationId: 'insulation_demo',
      scopeFoundPieces: ['batts', 'blown'],
    }).map(item => item.id);
    expect(insulation).toEqual([
      'insulation_removal__batts',
      'insulation_removal__blown',
    ]);
    const hvac = measurementsForScopeFoundChoice(
      {},
      'hvac_demo',
      ['hvac_furnace'],
      'Install a new furnace.'
    );
    expect(
      applyScopeFoundClarification([], 'Install a new furnace.', hvac).map(item => item.id)
    ).toEqual(['hvac_demo__hvac_furnace']);
    const normalized = normalizeScopeMeasurements({
      itemQuantities: hvac.itemQuantities,
    });
    const resolved = resolveChecklistItemQuantity('hvac_demo__hvac_furnace', normalized, {
      notes: 'Install a new furnace.',
    });
    expect(resolved).toMatchObject({ quantity: 1, unit: 'each', pricingReady: true });
    expect(
      resolveScopeItemSuggestedPricing(
        'hvac_demo__hvac_furnace',
        { itemQuantities: hvac.itemQuantities },
        'hvac',
        resolved,
        null,
        null,
        'Install a new furnace.'
      ).fill
    ).toMatchObject({ material: 75, labor: 225, total: 300 });
  });

  it('prices a confirmed panel and wiring removal at one each', () => {
    const notes = '12 outlets, 6 recessed lights, 2 ceiling fans.';
    expect(
      applyScopeFoundClarification([], notes, {
        scopeFoundClarificationId: 'electrical_demo',
        scopeFoundPieces: ['electrical_panel', 'electrical_wiring'],
      }).map(item => item.id)
    ).toEqual(['electrical_panel_removal', 'electrical_abandoned_circuit']);
    const next = measurementsForScopeFoundChoice(
      {},
      'electrical_demo',
      ['electrical_panel', 'electrical_wiring'],
      notes
    );
    expect(next.panelRemovalCount).toBe(1);
    expect(next.abandonedCircuitCount).toBe(1);
    expect(next.fixtureRemovalCount).toBeNull();
    expect(next.itemQuantities.electrical_panel_removal).toMatchObject({
      quantity: 1,
      unit: 'each',
    });
    expect(next.itemQuantities.electrical_abandoned_circuit).toMatchObject({
      quantity: 1,
      unit: 'each',
    });
  });

  it('asks fixture and wiring removal for kitchen GFCI outlets on a panel upgrade', () => {
    const notes = '8 kitchen GFCI outlets and a 200 amp panel upgrade.';
    const prompt = resolveScopeFoundClarification(notes);
    expect(prompt?.id).toBe('electrical_demo');
    expect(prompt?.question).toBe('Is existing electrical being removed?');
    expect(prompt?.options.map(option => option.label)).toEqual([
      'Fixtures',
      'Wiring',
      'No demo',
      'Not sure',
    ]);
    expect(
      resolveScopeFoundClarification('Install 12 recessed lights.')?.options.map(
        option => option.label
      )
    ).toEqual(['Panel', 'Fixtures', 'Wiring', 'No demo', 'Not sure']);
    expect(
      resolveScopeFoundClarification(
        'Kitchen remodel. New cabinets and quartz countertops.'
      )?.id
    ).toBe('kitchen_demo');
  });

  it('copies a stated flooring area onto the demo measurement', () => {
    const next = measurementsForScopeFoundChoice(
      { flooringSqft: 1200 },
      'flooring_demo',
      ['carpet'],
      'Install 1,200 sqft LVP'
    );
    expect(next.floorDemoSqft).toBe(1200);
    expect(next.scopeFoundPieces).toEqual(['carpet']);
    expect(next.scopeFoundChoice).toBeNull();
    expect(next.flooringExistingTypes).toEqual(['carpet']);
  });
});
