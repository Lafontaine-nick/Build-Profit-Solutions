import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealStatusLabel,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import { applyStep2NoteScopeFilters } from '@/utils/scopePackagesForReview';
import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import {
  notesWithStructureAnswer,
  vagueScopeChips,
  vagueScopeQuestion,
  vagueScopeTitle,
} from '@/utils/vagueScopeNote';
import { bathroomScopeLines } from '@/utils/bathroomNoteScope';
import { applyWholeHomeRemodelChecklist } from '@/utils/wholeHomeRemodelNote';

function draft(notes: string): EstimateAiDraft {
  return {
    originalNotes: notes,
    projectType: 'other',
    scopeChecklist: {
      templateKey: 'room_remodel',
      items: [
        {
          id: 'demo',
          label: 'Demolition scope',
          state: 'included',
          inputType: 'yes_no',
        },
      ],
    },
    scopePackages: [{ name: 'Whole House', checklistItemId: 'whole_house' }],
  } as EstimateAiDraft;
}

describe('vague notes ask instead of pricing', () => {
  it('asks for a house-size remodel and hides invented scope', () => {
    const notes = 'Whole house remodel, 2,000 SF';
    expect(vagueScopeQuestion(notes)).toBe(
      'Which job scopes are being done? The house area is 2,000 SF. Add the measurements you already have, and what each scope still needs, so the bid can be structured.'
    );
    expect(vagueScopeTitle(notes)).toBe('Whole house remodel');
    expect(getInitialRevealChecklistScopePreview(draft(notes))).toEqual([]);
    expect(getInitialRevealUnderstoodBullets(draft(notes))).toEqual([]);
    expect(getInitialRevealConfirmItems(draft(notes)).pricingScope).toEqual([
      'Which job scopes are being done? The house area is 2,000 SF. Add the measurements you already have, and what each scope still needs, so the bid can be structured.',
    ]);
    expect(getInitialRevealTotals(draft(notes)).heroTotal).toBeNull();
    expect(getInitialRevealTotals(draft(notes)).scopeItemCount).toBe(0);
    expect(getInitialRevealStatusLabel(draft(notes), 1)).toEqual({
      label: 'Needs scope',
      tone: 'review',
    });
  });

  it.each([
    [
      'Whole house remodel',
      'Which job scopes are being done? Add the measurements you already have, and what each scope still needs, so the bid can be structured.',
      'Whole house remodel',
    ],
    ['Update the master bath.', 'Which parts of the bathroom are in this remodel?', 'Bathroom remodel'],
    ['Bathroom remodel.', 'Which parts of the bathroom are in this remodel?', 'Bathroom remodel'],
    ['Kitchen remodel.', 'Which parts of the kitchen are in this remodel?', 'Kitchen remodel'],
    ['Paint.', 'Which surfaces are being painted?', 'Painting'],
    [
      'Stucco.',
      'Which walls are getting stucco? The wall area stays blank until measured.',
      'Stucco',
    ],
    ['Electrical.', 'Which electrical work is in this job?', 'Electrical'],
    ['Plumbing.', 'Which plumbing work is in this job?', 'Plumbing'],
    ['HVAC.', 'Which HVAC work is in this job?', 'HVAC'],
    [
      'Roof.',
      'Which parts of the roof are in this job? The roof area stays blank until measured.',
      'Roofing',
    ],
    [
      'Flooring.',
      'Which floors are being done, and which product? The area stays blank until measured.',
      'Flooring',
    ],
    [
      'Drywall.',
      'Which drywall work is in this job? Wall and ceiling area stay blank until measured.',
      'Drywall',
    ],
    ['Windows.', 'Which windows are in this job?', 'Windows'],
    ['Doors.', 'Which doors are in this job?', 'Doors'],
    [
      'Insulation.',
      'Where is the insulation going? The area stays blank until measured.',
      'Insulation',
    ],
    [
      'Concrete.',
      'Which concrete work is in this job? The area stays blank until measured.',
      'Concrete',
    ],
    [
      'Framing.',
      'Which framing is in this job? The area stays blank until measured.',
      'Framing',
    ],
    [
      'Deck.',
      'Which parts of the deck are in this job? The size stays blank until measured.',
      'Deck',
    ],
    [
      'Siding.',
      'Which walls are getting siding? The wall area stays blank until measured.',
      'Siding',
    ],
    ['Landscaping.', 'Which landscaping work is in this job?', 'Landscaping'],
    ['Tile.', 'Which surfaces are being tiled?', 'Tile'],
    ['Demo.', 'What is being demolished?', 'Demolition'],
    ['Gutters.', 'Which gutters are in this job?', 'Gutters'],
    [
      'Fence.',
      'Which fence work is in this job? The length stays blank until measured.',
      'Fence',
    ],
    [
      'Electrical and plumbing.',
      'Which electrical and plumbing work is in this job?',
      'Electrical and Plumbing',
    ],
  ])('asks when %s names the job and no work', (notes, question, title) => {
    expect(vagueScopeQuestion(notes)).toBe(question);
    expect(vagueScopeTitle(notes)).toBe(title);
    expect(getInitialRevealDisplayTitle(draft(notes))).toBe(title);
    const items = applyStep2NoteScopeFilters(
      [
        {
          id: 'demo',
          label: 'Demolition',
          state: 'included',
          inputType: 'yes_no',
        },
      ] as ScopeChecklistItem[],
      draft(notes),
      {},
      'room_remodel'
    );
    expect(items.every(item => item.state === 'excluded')).toBe(true);
  });

  it('bathroom chips add a prefab pan, a prefab shower, and a mud pan', () => {
    const chips = vagueScopeChips('Bathroom remodel.');
    const text = (label: string) =>
      chips.find(item => item.label === label)?.text;
    expect(text('Prefab pan')).toBe('New prefab pan');
    expect(text('Prefab shower')).toBe('New prefab shower enclosure');
    expect(text('Mud pan')).toBe('Build a mud pan');
    expect(
      bathroomScopeLines(`Bathroom remodel.\n${text('Prefab pan')}`).map(
        line => line.id
      )
    ).toEqual(['prefab_shower_pan']);
    expect(
      bathroomScopeLines(`Bathroom remodel.\n${text('Prefab shower')}`).map(
        line => line.id
      )
    ).toEqual(['prefab_shower_enclosure']);
    expect(
      bathroomScopeLines(`Bathroom remodel.\n${text('Mud pan')}`).map(
        line => line.id
      )
    ).toContain('shower_pan');
    expect(
      bathroomScopeLines(`Bathroom remodel.\n${text('New tub')}`).map(
        line => line.id
      )
    ).toEqual(['tub_install']);
    expect(
      bathroomScopeLines(`Bathroom remodel.\n${text('Shower door')}`).map(
        line => line.id
      )
    ).toEqual(['glass_door']);
    expect(text('Countertop')).toBe('New countertop');
    expect(text('Demo vanity')).toBe('Remove the vanity');
    expect(text('Demo countertop')).toBe('Remove the countertop');
    expect(
      bathroomScopeLines(`Bathroom remodel.\n${text('Countertop')}`).map(
        line => line.id
      )
    ).toEqual(['countertops']);
    expect(
      bathroomScopeLines(`Bathroom remodel.\n${text('Demo vanity')}`).map(
        line => line.id
      )
    ).toEqual(['vanity_demo']);
    expect(
      bathroomScopeLines(`Bathroom remodel.\n${text('Demo countertop')}`).map(
        line => line.id
      )
    ).toEqual(['countertop_demo']);
    expect(
      bathroomScopeLines(`Bathroom remodel.\n${text('Vanity')}`).map(
        line => line.id
      )
    ).toEqual(['vanity']);
  });

  it('plumbing chips name trim, gas, sewer, a service call, and drain cleaning', () => {
    const chips = vagueScopeChips('Plumbing.');
    const text = (label: string) =>
      chips.find(item => item.label === label)?.text;
    expect(chips.map(item => item.label)).toEqual([
      'Toilets',
      'Sinks',
      'Faucets',
      'Water heater',
      'Rough-in',
      'Trim',
      'Gas',
      'Sewer',
      'Service call',
      'Drain cleaning',
    ]);
    expect(text('Trim')).toBe('Plumbing trim');
    expect(text('Gas')).toBe('Gas line');
    expect(text('Sewer')).toBe('Sewer line');
    expect(text('Service call')).toBe('Plumbing service call');
    expect(chips).toHaveLength(10);
    for (const label of ['Gas', 'Sewer', 'Trim', 'Service call']) {
      expect(vagueScopeQuestion(`Plumbing.\n${text(label)}`)).toBeNull();
    }
  });

  it('kitchen chips name a tear-out and a new island', () => {
    const chips = vagueScopeChips('Kitchen remodel.');
    const text = (label: string) =>
      chips.find(item => item.label === label)?.text;
    expect(chips.map(item => item.label)).toEqual([
      'Demo',
      'Cabinets',
      'Countertops',
      'Backsplash',
      'Flooring',
      'Sink',
      'Appliances',
      'Island',
    ]);
    expect(text('Demo')).toBe('Remove the cabinets and countertops');
    expect(text('Island')).toBe('New island');
    expect(vagueScopeQuestion(`Kitchen remodel.\n${text('Demo')}`)).toBeNull();
    expect(vagueScopeQuestion(`Kitchen remodel.\n${text('Island')}`)).toBeNull();
  });

  it('flooring chips name laminate, sheet vinyl, engineered hardwood, and a tear-out', () => {
    const chips = vagueScopeChips('Flooring.');
    const text = (label: string) =>
      chips.find(item => item.label === label)?.text;
    expect(chips.map(item => item.label)).toEqual([
      'LVP',
      'Carpet',
      'Hardwood',
      'Engineered',
      'Laminate',
      'Sheet vinyl',
      'Tile',
      'Main level',
      'Demo',
    ]);
    expect(text('Engineered')).toBe('Engineered hardwood');
    expect(text('Sheet vinyl')).toBe('Sheet vinyl');
    expect(text('Demo')).toBe('Remove the existing floor');
    expect(vagueScopeQuestion('Flooring.\nEngineered hardwood')).toBeNull();
    expect(vagueScopeQuestion('Flooring.\nRemove the existing floor')).toBeNull();
  });

  it('siding chips name every wall and vinyl', () => {
    const chips = vagueScopeChips('Siding.');
    const text = (label: string) =>
      chips.find(item => item.label === label)?.text;
    expect(chips.map(item => item.label)).toEqual([
      'Replace',
      'Front',
      'Back',
      'Sides',
      'All walls',
      'Hardie',
      'Vinyl',
    ]);
    expect(text('All walls')).toBe('All exterior walls');
    expect(text('Vinyl')).toBe('Vinyl siding');
    expect(text('Hardie')).toBe('Fiber cement siding');
    for (const label of ['All walls', 'Vinyl', 'Hardie']) {
      expect(vagueScopeQuestion(`Siding.\n${text(label)}`)).toBeNull();
    }
  });

  it('HVAC chips name a heat pump, a mini-split, and an air handler', () => {
    const chips = vagueScopeChips('HVAC.');
    const text = (label: string) =>
      chips.find(item => item.label === label)?.text;
    expect(chips.map(item => item.label)).toEqual([
      'Furnace',
      'AC',
      'Heat pump',
      'Mini-split',
      'Air handler',
      'Ductwork',
      'Thermostat',
      'Service call',
    ]);
    expect(text('Heat pump')).toBe('Replace the heat pump');
    expect(text('Mini-split')).toBe('Replace the mini-split');
    expect(text('Air handler')).toBe('Replace the air handler');
    for (const label of ['Heat pump', 'Mini-split', 'Air handler']) {
      expect(vagueScopeQuestion(`HVAC.\n${text(label)}`)).toBeNull();
    }
  });

  it('electrical chips name GFCI, smoke detectors, a bath fan, and an EV charger', () => {
    const chips = vagueScopeChips('Electrical.');
    const text = (label: string) =>
      chips.find(item => item.label === label)?.text;
    expect(chips.map(item => item.label)).toEqual([
      'Outlets',
      'Switches',
      'Recessed lights',
      'Ceiling fans',
      'Panel',
      'GFCI',
      'Smoke',
      'Exhaust fan',
      'EV charger',
    ]);
    expect(text('GFCI')).toBe('GFCI receptacles');
    expect(text('Smoke')).toBe('Smoke detectors');
    expect(text('Exhaust fan')).toBe('Bath exhaust fan');
    expect(text('EV charger')).toBe('EV charger');
    for (const label of ['GFCI', 'Smoke', 'Exhaust fan', 'EV charger']) {
      expect(vagueScopeQuestion(`Electrical.\n${text(label)}`)).toBeNull();
    }
  });

  it.each([
    'Whole house remodel',
    'Whole house remodel, 2,000 SF',
    'Bathroom remodel.',
    'Kitchen remodel.',
    'Paint.',
    'Stucco.',
    'Electrical.',
    'Flooring.',
    'Roof.',
    'Siding.',
    'Plumbing.',
  ])('each chip on %s answers the question', notes => {
    const chips = vagueScopeChips(notes);
    expect(chips.length).toBeGreaterThan(0);
    const stillVague = chips
      .map(item => item.text)
      .filter(text => vagueScopeQuestion(`${notes}\n${text}`));
    expect(stillVague).toEqual([]);
  });

  it.each([
    'HVAC',
    'New furnace',
    'Roof replacement',
    'Siding',
    'Gutters',
    'Deck',
    'Fireplace',
    'Exterior paint',
    'Cabinets',
    'Countertops',
    'Tile',
    'Demo',
    'Garage door',
    'Concrete driveway',
    'Landscaping',
    'Fence',
    'Stucco',
    'Water heater',
    'Lighting',
    'Stairs',
    'Basement finish',
    'Closets',
    'Appliances',
  ])('accepts a typed whole-house scope that is not a chip: %s', answer => {
    expect(vagueScopeQuestion(`Whole house remodel\n${answer}`)).toBeNull();
  });

  it('keeps the original line and the named trades on the note', () => {
    const notes = 'Whole house remodel, 2,000 SF';
    const answer = 'Bathroom updates, Kitchen updates, Drywall, Plumbing';
    const saved = notesWithStructureAnswer(notes, answer);
    expect(saved).toBe(`${notes}\n${answer}`);
    expect(vagueScopeQuestion(saved)).toBeNull();
    expect(notesWithStructureAnswer(saved, answer)).toBe(saved);
    expect(notesWithStructureAnswer(notes, 'the house')).toBeNull();
  });

  it('keeps a typed whole-house trade in scope with no invented quantity', () => {
    const rows = applyWholeHomeRemodelChecklist(
      [{ id: 'interior_paint', label: 'Interior paint', state: 'included' }],
      'Whole house remodel\nHVAC, Exterior paint'
    );
    expect(rows.find(row => row.id === 'hvac')?.state).toBe('included');
    expect(rows.find(row => row.id === 'exterior_paint')?.state).toBe('included');
    expect(rows.find(row => row.id === 'interior_paint')?.state).toBe('excluded');
  });

  it('keeps a whole-house note with a named trade off the trade questions', () => {
    expect(vagueScopeQuestion('Whole house remodel\nPaint the interior')).toBeNull();
    expect(vagueScopeQuestion('Whole house remodel\nFlooring')).toBeNull();
    expect(
      vagueScopeQuestion('Whole house remodel. Keep the windows and doors.')
    ).not.toBeNull();
  });

  it('keeps a note that names the work', () => {
    expect(vagueScopeQuestion('Paint the doors and walls.')).toBeNull();
    expect(
      getInitialRevealStatusLabel(draft('Paint the doors and walls.'), 0).label
    ).toBe('Mostly ready');
    expect(vagueScopeQuestion('Flooring on the main level.')).toBeNull();
    expect(vagueScopeQuestion('Roof replacement.')).toBeNull();
    expect(
      vagueScopeQuestion('Replace the roof vents and the chimney flashing.')
    ).toBeNull();
    expect(
      vagueScopeQuestion(
        'Hang and finish drywall in the addition. 1,200 sqft of wall. Ceilings too.'
      )
    ).toBeNull();
    expect(
      vagueScopeQuestion(
        'Install five paint-grade interior doors with hardware.'
      )
    ).toBeNull();
    expect(
      vagueScopeQuestion(
        'Demo the kitchen to the studs. Cabinets, counters, backsplash, and the floor come out.'
      )
    ).toBeNull();
    expect(
      vagueScopeQuestion(
        'New 1,600 sqft ranch. Full build price. Plans come next week.'
      )
    ).toBeNull();
    expect(vagueScopeQuestion('Insulation in the attic.')).toBeNull();
    expect(vagueScopeQuestion('HVAC service call.')).toBeNull();
    expect(
      vagueScopeQuestion(
        'Kitchen remodel. New cabinets, quartz counters, and a tile backsplash.'
      )
    ).toBeNull();
    expect(
      vagueScopeQuestion('Stucco the front of the house and replace 8 windows.')
    ).toBeNull();
    expect(
      vagueScopeQuestion(
        'Guest bath remodel. Remove the tub and demo the old bathroom floor tile. New vanity. New toilet. No paint.'
      )
    ).toBeNull();
  });
});
