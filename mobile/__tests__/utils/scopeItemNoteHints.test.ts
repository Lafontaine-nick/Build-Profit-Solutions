import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';

describe('scopeItemNoteHints trim inference', () => {
  const BATH_REMODEL =
    'Bathroom remodel. Tile shower walls, new shower pan, move rough plumbing, shower door. Final plumbing trim (faucets, toilet set, hookups) with new fixtures.';

  test('plumbing trim does not include trim & baseboard scope', () => {
    expect(inferItemStateFromNotes('trim', BATH_REMODEL)).toBe('unsure');
    expect(inferItemStateFromNotes('plumbing_trim', BATH_REMODEL)).toBe('included');
  });

  test('baseboard install still includes trim scope', () => {
    expect(inferItemStateFromNotes('trim', 'Install baseboards throughout 220 LF.')).toBe('included');
  });

  test('shower floor tile notes do not include floor_tile', () => {
    expect(
      inferItemStateFromNotes(
        'floor_tile',
        'Tile shower walls and tile the shower floor.'
      )
    ).toBe('unsure');
    expect(
      inferItemStateFromNotes('floor_tile', 'Install bathroom floor tile outside the shower.')
    ).toBe('included');
  });
});
