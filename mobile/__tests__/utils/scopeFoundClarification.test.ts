import {
  applyScopeFoundClarification,
  flooringReplaceIncludesRemoval,
  measurementsForScopeFoundChoice,
  resolveScopeFoundClarification,
  scopeFoundRevealLines,
  splitRoofTearOffCards,
} from '@/utils/scopeFoundClarification';
import { resolveChecklistItemQuantity } from '@/utils/scopeItemQuantities';

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
      'Island',
      'Appliances',
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

  it('asks about ceilings and trim only when the note says the entire interior', () => {
    expect(resolveScopeFoundClarification('Paint walls, 2,000 sqft')).toBe(null);
    const prompt = resolveScopeFoundClarification('Repaint entire interior');
    expect(prompt?.id).toBe('interior_paint_extent');
    expect(prompt?.options.map(option => option.label)).toEqual([
      'Ceilings',
      'Trim',
      'Walls only',
      'Not sure',
    ]);
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

  it('asks which existing material is coming out on the other single-trade jobs', () => {
    expect(
      resolveScopeFoundClarification('New stucco, 1,800 sqft.')?.options.map(
        option => option.label
      )
    ).toEqual(['Stucco', 'Wood siding', 'Vinyl siding', 'Brick', 'Fiber cement', 'No demo', 'Not sure']);
    expect(
      resolveScopeFoundClarification('Pour a new 400 sqft concrete driveway.')?.id
    ).toBe('concrete_demo');
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
    ).toEqual(['demo_removal']);
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
