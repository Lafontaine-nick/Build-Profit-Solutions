import { isWholeHomeQuickMeasurementTemplate } from '@/utils/scopeQuickMeasurements';
import type { QmPhotoNotesContext } from '@/utils/qmScopePanels/types';

/** Photo/notes single-scope jobs get QM scope panels — not plan PDF / whole-home. */
export function isPhotoNotesScopeJob(ctx: QmPhotoNotesContext): boolean {
  if (ctx.wholeHomeLayout || isWholeHomeQuickMeasurementTemplate(ctx.templateKey)) return false;
  const key = String(ctx.templateKey || '').toLowerCase();
  return PHOTO_NOTES_QM_TEMPLATES.has(key);
}

export const PHOTO_NOTES_QM_TEMPLATES = new Set([
  'bathroom',
  'kitchen',
  'flooring',
  'painting',
  'drywall',
  'roofing',
  'deck_patio',
  'concrete',
  'hvac',
  'landscaping',
]);
