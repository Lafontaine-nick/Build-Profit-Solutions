import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';

const WET_AREA_INSTALL_DERIVED_IDS = new Set([
  'tub_install',
  'prefab_shower_pan',
  'prefab_shower_enclosure',
  'shower_pan',
]);

/** True when the tile mud-pan install stepper is above zero. */
export function tileShowerPanStepperActive(
  measurements: Record<string, unknown> | null | undefined
): boolean {
  const n = Number(measurements?.tilePanBathCount);
  return Number.isFinite(n) && n > 0;
}

/** True when QM wet-area install steppers (tub / pan) are above zero. */
export function wetAreaInstallSteppersActive(
  measurements: Record<string, unknown> | null | undefined
): boolean {
  const keys = ['tilePanBathCount', 'prefabBathCount', 'prefabEnclosureBathCount', 'tubBathCount'] as const;
  return keys.some((key) => {
    const n = Number(measurements?.[key]);
    return Number.isFinite(n) && n > 0;
  });
}

/** Drop QM-hidden wet-area install lines when no install steppers are set. */
export function finalizeWetAreaInstallScopeFromMeasurements(
  items: ScopeChecklistItem[],
  measurements: Record<string, unknown> | null | undefined
): ScopeChecklistItem[] {
  // Preserve legacy / notes-only direct shower_pan rows. There is no QM
  // wet-area parent in this shape, so the install stepper gate cannot
  // determine whether the mud-pan line is intentional.
  if (!items.some(item => item.id === 'wet_area_install')) return items;
  if (wetAreaInstallSteppersActive(measurements)) return items;
  return items
    .filter((i) => !WET_AREA_INSTALL_DERIVED_IDS.has(i.id))
    .map((row) =>
      row.id === 'wet_area_install'
        ? { ...row, choiceId: 'not_in_scope', state: 'excluded' as const }
        : row
    );
}
