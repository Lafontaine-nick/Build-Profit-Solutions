import {
  CANONICAL_GOLD_NOTES,
  type CanonicalGoldNote,
} from '@/utils/canonicalScopeGoldNotes';
import {
  applyCanonicalScopeToChecklistItems,
  canonicalItemIsExcluded,
  canonicalScopeBlocksItemId,
  isFloorDemoScopeId,
} from '@/utils/canonicalScope';
import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import { hydrateScopeChecklistFromNotes } from '@/utils/estimateScopeChecklistUi';
import { confirmScopeDisplayItemsFromDraft } from '@/utils/scopePackagesForReview';
import { getInitialRevealChecklistScopePreview } from '@/utils/estimateInitialRevealUi';
import { quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';

function pipelineIds(fixture: CanonicalGoldNote) {
  const repaired = repairDraftRatePricingFromNotes(
    {
      originalNotes: fixture.notes,
      projectType: fixture.projectType,
      estimateTier: fixture.templateKey,
      scopeChecklist: {
        templateKey: fixture.templateKey,
        items: fixture.includedIds.map(id => ({
          id,
          label: id,
          state: 'included' as const,
        })),
      },
      scopeMeasurements: {},
      scopePackages: [],
    } as never,
    fixture.notes
  );
  const hydrated = hydrateScopeChecklistFromNotes(
    repaired.scopeChecklist?.items || [],
    fixture.templateKey,
    fixture.notes,
    repaired.scopeMeasurements as never,
    fixture.projectType,
    repaired.canonicalScope
  );
  const confirm = confirmScopeDisplayItemsFromDraft(repaired);
  const reveal = getInitialRevealChecklistScopePreview(repaired);
  const qmKeys = quickMeasurementRowsForInput(
    fixture.templateKey,
    fixture.projectType,
    repaired.scopeMeasurements || {},
    [],
    {
      scopeNotes: fixture.notes,
      canonicalScope: repaired.canonicalScope,
      crossScopeMode: fixture.templateKey === 'room_remodel',
    }
  )
    .flat()
    .map(field => field.key);
  const visibleIds = [
    ...(repaired.scopeChecklist?.items || []).map(item => String(item.id || '')),
    ...hydrated.map(item => String(item.id || '')),
    ...confirm.map(item => String(item.id || '')),
  ].filter(Boolean);
  return { repaired, hydrated, confirm, reveal, qmKeys, visibleIds };
}

describe('canonical gold notes', () => {
  it.each(CANONICAL_GOLD_NOTES)(
    '$id keeps included work and freezes exclusions through reveal, confirm, QM, and pricing',
    fixture => {
      const { repaired, confirm, reveal, qmKeys, visibleIds } =
        pipelineIds(fixture);

      const fromCanonical = applyCanonicalScopeToChecklistItems(
        [],
        fixture.notes,
        repaired.canonicalScope
      ).map(item => String(item.id || ''));

      for (const id of fixture.includedIds) {
        expect(canonicalItemIsExcluded(repaired.canonicalScope, id)).toBe(
          false
        );
        expect(visibleIds).toEqual(expect.arrayContaining([id]));
        expect(fromCanonical).toEqual(expect.arrayContaining([id]));
      }

      for (const id of fixture.excludedIds) {
        expect(canonicalItemIsExcluded(repaired.canonicalScope, id)).toBe(
          true
        );
        expect(canonicalScopeBlocksItemId(repaired.canonicalScope, id)).toBe(
          true
        );
        expect(visibleIds.filter(visible => visible === id)).toEqual([]);
        expect(
          confirm.filter(
            item =>
              item.id === id ||
              (id === 'floor_demo' && isFloorDemoScopeId(String(item.id)))
          )
        ).toEqual([]);
        if (id === 'floor_demo') {
          expect(
            reveal.some(row => /demo|removal/i.test(row.name))
          ).toBe(false);
        }
        if (id === 'drywall_hang') {
          expect(visibleIds).not.toContain('hang');
        }
      }

      for (const id of fixture.absentIds || []) {
        expect(canonicalItemIsExcluded(repaired.canonicalScope, id)).toBe(
          false
        );
        expect(visibleIds.filter(visible => visible === id)).toEqual([]);
      }

      for (const key of fixture.blockedMeasurementKeys || []) {
        expect(qmKeys).not.toContain(key);
        expect(
          (repaired.scopeMeasurements as Record<string, unknown> | undefined)?.[
            key
          ]
        ).toBeUndefined();
      }
    }
  );
});
