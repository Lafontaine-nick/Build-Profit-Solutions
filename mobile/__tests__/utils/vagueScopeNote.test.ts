import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
  getInitialRevealDisplayTitle,
  getInitialRevealTotals,
  getInitialRevealUnderstoodBullets,
} from '@/utils/estimateInitialRevealUi';
import { applyStep2NoteScopeFilters } from '@/utils/scopePackagesForReview';
import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import {
  vagueScopeChips,
  vagueScopeQuestion,
  vagueScopeTitle,
} from '@/utils/vagueScopeNote';
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
