import {
  collectRoofingInferenceNotes,
  inferChoiceFromNotes,
  inferItemStateFromNotes,
  inferRoofingSystemFromNotes,
  inferRoofingTearOffFromNotes,
  inferRoofingTradeScopeSelectionsFromNotes,
  infersRoofingUnderlaymentUpgradeFromNotes,
  parseRoofingDeckingAllowanceFromNotes,
} from '@/utils/scopeItemNoteHints';
import { applyScopeInferencesFromNotes } from '@/utils/estimateScopeChecklistUi';

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

  test('does not auto-include permits from vague inspection language', () => {
    expect(
      inferItemStateFromNotes(
        'permits',
        'Bathroom remodel with final inspection and cleanup.'
      )
    ).toBe('unsure');
    expect(
      inferItemStateFromNotes('permits', 'Include permits in the bid for this remodel.')
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
    expect(inferRoofingSystemFromNotes('Install standing seam metal roof.')).toBe(
      'standing_seam_metal'
    );
    expect(inferRoofingSystemFromNotes('TPO flat roof replacement.')).toBe('tpo');
    expect(inferRoofingSystemFromNotes('EPDM rubber membrane roof.')).toBe('epdm');
  });

  test('infers tear-off depth from notes', () => {
    expect(inferRoofingTearOffFromNotes('Tear off existing shingles, one layer.')).toBe(
      'one_layer'
    );
    expect(inferRoofingTearOffFromNotes('Two layer tear-off required.')).toBe('two_layers');
    expect(inferRoofingTearOffFromNotes('Roof-over / recover, no tear-off.')).toBe(
      'new_construction'
    );
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
      expect.arrayContaining(['tear_off', 'shingles', 'ridge_vent', 'drip_edge'])
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
    expect(
      inferRoofingTradeScopeSelectionsFromNotes(combined)
    ).toEqual(expect.arrayContaining(['ice_water_shield', 'drip_edge']));
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
