import { bathroomFixturesQmPanel, BATHROOM_FIXTURES_QM_EMBEDDED_IDS } from '@/utils/qmScopePanels/bathroomFixtures';
import { bathroomWetAreaQmPanel, BATHROOM_WET_AREA_EMBEDDED_IDS } from '@/utils/qmScopePanels/bathroomWetArea';
import { flooringQmPanel, FLOORING_QM_EMBEDDED_IDS } from '@/utils/qmScopePanels/flooringRemodel';
import { kitchenQmPanel, KITCHEN_QM_EMBEDDED_IDS } from '@/utils/qmScopePanels/kitchenRemodel';
import { isPhotoNotesScopeJob, PHOTO_NOTES_QM_TEMPLATES } from '@/utils/qmScopePanels/photoNotesJob';
import type { QmPanelDefinition, QmPanelHydrateContext, QmPhotoNotesContext } from '@/utils/qmScopePanels/types';

export { isPhotoNotesScopeJob, PHOTO_NOTES_QM_TEMPLATES };
export { BATHROOM_FIXTURES_QM_EMBEDDED_IDS, BATHROOM_WET_AREA_EMBEDDED_IDS, KITCHEN_QM_EMBEDDED_IDS, FLOORING_QM_EMBEDDED_IDS };
export * from '@/utils/qmScopePanels/bathroomFixtures';
export * from '@/utils/qmScopePanels/kitchenRemodel';
export * from '@/utils/qmScopePanels/flooringRemodel';

const QM_PANELS: QmPanelDefinition[] = [
  bathroomWetAreaQmPanel,
  bathroomFixturesQmPanel,
  kitchenQmPanel,
  flooringQmPanel,
];

export function getActiveQmPanels(ctx: QmPhotoNotesContext): QmPanelDefinition[] {
  if (!isPhotoNotesScopeJob(ctx)) return [];
  return QM_PANELS.filter((p) => p.isActive(ctx));
}

export function getQmEmbeddedScopeIds(ctx: QmPhotoNotesContext): Set<string> {
  const ids = new Set<string>();
  for (const panel of getActiveQmPanels(ctx)) {
    for (const id of panel.embeddedScopeItemIds) ids.add(id);
  }
  return ids;
}

export function hydrateQmPanelMeasurements(ctx: QmPanelHydrateContext & QmPhotoNotesContext): Record<string, unknown> {
  let measurements = { ...ctx.measurements };
  for (const panel of getActiveQmPanels(ctx)) {
    measurements = panel.hydrateMeasurements({ ...ctx, measurements });
  }
  return measurements;
}

export function syncQmPanelScopeItems(
  items: import('@/utils/estimateAiDraft').ScopeChecklistItem[],
  ctx: QmPhotoNotesContext,
  measurements: Record<string, unknown>
): import('@/utils/estimateAiDraft').ScopeChecklistItem[] {
  let next = items;
  for (const panel of getActiveQmPanels(ctx)) {
    next = panel.syncScopeItems(next, measurements);
  }
  return next;
}

export function getQmPanelForTemplate(templateKey?: string | null): QmPanelDefinition | null {
  const key = String(templateKey || '').toLowerCase();
  return QM_PANELS.find((p) => p.templateKeys.includes(key)) ?? null;
}
