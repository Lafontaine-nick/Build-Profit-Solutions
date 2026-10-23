import { scopeExtractionClarificationQuestions } from '@/utils/estimateAiDraft';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import {
  applyStructuredScopeIntentToItems,
  applyStructuredScopeIntentToMeasurements,
} from '@/utils/scopeIntent';

describe('scopeExtractionClarificationQuestions', () => {
  it('returns the scorer questions only when the note needs clarification', () => {
    const draft = {
      extractionConfidence: {
        overallConfidence: 'medium',
        requiresClarification: true,
        clarificationQuestions: [
          {
            id: 'paint_sqft_basis',
            question:
              'Does the sqft refer to floor area or paintable wall and ceiling area?',
          },
        ],
      },
    } as EstimateAiDraft;

    expect(scopeExtractionClarificationQuestions(draft)).toEqual(
      draft.extractionConfidence?.clarificationQuestions
    );
    expect(
      scopeExtractionClarificationQuestions({
        extractionConfidence: {
          overallConfidence: 'high',
          requiresClarification: false,
          clarificationQuestions: draft.extractionConfidence?.clarificationQuestions,
        },
      } as EstimateAiDraft)
    ).toEqual([]);
  });

  it('keeps a keep-the-doors read off the door install and blanks an unstated paint area', () => {
    const items = applyStructuredScopeIntentToItems(
      [
        {
          id: 'interior_door_install',
          state: 'included',
          inputType: 'yes_no',
        },
      ],
      {
        items: [
          {
            id: 'interior_door_install',
            state: 'uncertain',
            evidence: 'Keep the windows and doors',
          },
        ],
      }
    );
    expect(items[0].state).toBe('unsure');
    expect(
      applyStructuredScopeIntentToMeasurements(
        {
          paintAreaSqft: 250,
          paintAreaBasis: 'unknown',
          paintAreaNeedsConfirmation: true,
        },
        {
          items: [
            {
              id: 'paint',
              state: 'uncertain',
              quantity: null,
              evidence: 'Paint the room, about 250 sqft',
            },
          ],
        }
      ).paintAreaSqft
    ).toBeUndefined();
  });
});
