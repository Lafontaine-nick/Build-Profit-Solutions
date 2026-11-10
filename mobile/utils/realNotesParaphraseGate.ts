import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import {
  REAL_NOTES_PARAPHRASES,
  type RealNotesParaphrase,
} from '@/utils/realNotesParaphraseCorpus';
import {
  framingShellCountsAsWallFraming,
  notesNameFramingOnlyAddition,
} from '@/utils/subcontractorTrade/framingPlanConvergence';

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
  const ids = (repaired.scopeChecklist?.items || [])
    .map(item => String(item.id || ''))
    .filter(Boolean);
  if (notesNameFramingOnlyAddition(notes) && !ids.includes('framing')) {
    const addition = repairDraftRatePricingFromNotes(
      {
        originalNotes: notes,
        projectType: 'addition',
        estimateTier: 'addition',
        scopeChecklist: {
          templateKey: 'addition',
          items: [
            {
              id: 'wall_framing',
              label: 'Wall framing',
              state: 'included',
            },
          ],
        },
        scopeMeasurements: {},
        scopePackages: [],
      } as never,
      notes
    );
    for (const item of addition.scopeChecklist?.items || []) {
      const id = String(item.id || '');
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

export function scoreParaphraseReading(
  fixture: RealNotesParaphrase
): ParaphraseReading {
  const visibleIds = visibleIdsFor(fixture.notes);
  const missingIds = fixture.includedIds.filter(
    id =>
      !visibleIds.includes(id) &&
      !(
        id === 'wall_framing' &&
        framingShellCountsAsWallFraming(fixture.notes, visibleIds)
      )
  );
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
