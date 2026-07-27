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

  test('finish carpentry phrasing includes trim scope', () => {
    expect(inferItemStateFromNotes('trim', 'Basement finish with paint, trim and doors.')).toBe('included');
  });
});
