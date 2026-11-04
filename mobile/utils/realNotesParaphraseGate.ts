import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import {
  REAL_NOTES_PARAPHRASES,
  type RealNotesParaphrase,
} from '@/utils/realNotesParaphraseCorpus';

export type ParaphraseReading = {
  id: string;
  passed: boolean;
  visibleIds: string[];
  missingIds: string[];
  presentAbsentIds: string[];
};

function visibleIdsFor(notes: string): string[] {
  const repaired = repairDraftRatePricingFromNotes(
    {
      originalNotes: notes,
      projectType: 'other',
      scopeChecklist: { templateKey: 'room_remodel', items: [] },
      scopeMeasurements: {},
      scopePackages: [],
    } as never,
    notes
  );
  return (repaired.scopeChecklist?.items || [])
    .map(item => String(item.id || ''))
    .filter(Boolean);
}

export function scoreParaphraseReading(
  fixture: RealNotesParaphrase
): ParaphraseReading {
  const visibleIds = visibleIdsFor(fixture.notes);
  const missingIds = fixture.includedIds.filter(id => !visibleIds.includes(id));
  const presentAbsentIds = fixture.absentIds.filter(id => visibleIds.includes(id));
  return {
    id: fixture.id,
    passed: missingIds.length === 0 && presentAbsentIds.length === 0,
    visibleIds,
    missingIds,
    presentAbsentIds,
  };
}

export function scoreParaphraseReadings(): ParaphraseReading[] {
  return REAL_NOTES_PARAPHRASES.map(scoreParaphraseReading);
}
