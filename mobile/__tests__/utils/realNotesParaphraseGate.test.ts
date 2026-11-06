import { showerRemovalPrompt } from '@/utils/bathroomNoteScope';
import { REAL_NOTES_PARAPHRASES } from '@/utils/realNotesParaphraseCorpus';
import { scoreParaphraseReadings } from '@/utils/realNotesParaphraseGate';

describe('paraphrase reader score', () => {
  it('reads the clean shower sentence and records the messy gaps', () => {
    const readings = scoreParaphraseReadings();
    expect(readings).toHaveLength(REAL_NOTES_PARAPHRASES.length);
    expect(readings.find(row => row.id === 'shower_clean')).toMatchObject({
      passed: true,
      missingIds: [],
      presentAbsentIds: [],
    });
    expect(readings.filter(row => row.passed).map(row => row.id)).toEqual([
      'shower_clean',
      'shower_messy',
      'shower_with_tub',
      'shower_all_named',
      'kitchen_exclusion',
      'carpet_replace',
      'owner_removes_carpet',
      'drywall_denial',
      'garage_no_hvac',
      'stucco_replace',
      'whole_house_names',
    ]);
    expect(readings.filter(row => !row.passed).map(row => row.id)).toEqual([
      'addition_no_roof',
    ]);
  });

  it('asks about the unnamed shower pieces and does not ask for wall tile', () => {
    const prompt = showerRemovalPrompt(REAL_NOTES_PARAPHRASES[0].notes);
    expect(prompt?.question).toBe('Any other removal?');
    expect(prompt?.options.map(option => option.label)).not.toContain('Wall tile');
    expect(prompt?.options.map(option => option.label)).toContain('Tub');
  });
});
