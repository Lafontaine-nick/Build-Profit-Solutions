const {
  attachReadOnlyNoteReading,
  noteNeedsReaderPass,
  sanitizeNoteReading,
} = require('../noteComprehension');

describe('read-only note reader', () => {
  const messy =
    'Customer wants the shower retiled. Pull the old tile. Throw down about 80 square feet of vinyl plank in that bath.';

  it('skips a short note the checker already resolves', () => {
    expect(
      noteNeedsReaderPass(
        'Replace the shower tile and install 80 sqft of LVP in the bathroom.',
        {}
      )
    ).toBe(false);
    expect(noteNeedsReaderPass(messy, {})).toBe(true);
  });

  it('keeps only quantities and jobs whose words are in the note', () => {
    const reading = sanitizeNoteReading(messy, {
      jobs: [
        { label: 'Vinyl plank', evidence: 'vinyl plank' },
        { label: 'Waterproofing', evidence: 'waterproof the walls' },
      ],
      quantities: [
        { label: 'Vinyl plank', quantity: 80, unit: 'sqft', evidence: '80 square feet of vinyl plank' },
        { label: 'Shower wall', quantity: 90, unit: 'sqft', evidence: 'about 90 sqft of wall' },
      ],
      missingCompanions: [{ label: 'Tub' }, { label: 'tile' }],
      wouldAsk: 'Any other removal?',
      items: [{ id: 'waterproofing', state: 'included' }],
    });
    expect(reading.authoritative).toBe(false);
    expect(reading.jobs.map(job => job.label)).toEqual(['Vinyl plank']);
    expect(reading.quantities).toEqual([
      {
        label: 'Vinyl plank',
        quantity: 80,
        unit: 'sqft',
        evidence: '80 square feet of vinyl plank',
      },
    ]);
    expect(reading.missingCompanions).toEqual(['Tub']);
    expect(reading.wouldAsk).toBe('Any other removal?');
    expect(reading.items).toBeUndefined();
  });

  it('stores the reading without changing the checklist', () => {
    const draft = {
      scopeChecklist: {
        items: [{ id: 'flooring_lvp', state: 'included' }],
      },
      scopeMeasurements: { flooringLvpSqft: 80 },
    };
    const reading = sanitizeNoteReading(messy, {
      jobs: [{ label: 'Vinyl plank', evidence: 'vinyl plank' }],
      missingCompanions: [{ label: 'Tub' }],
      wouldAsk: 'Any other removal?',
    });
    const next = attachReadOnlyNoteReading(draft, reading);
    expect(next.scopeChecklist).toEqual(draft.scopeChecklist);
    expect(next.scopeMeasurements).toEqual(draft.scopeMeasurements);
    expect(next.noteReading.authoritative).toBe(false);
    expect(next.noteReading.missingCompanions).toEqual(['Tub']);
  });
});
