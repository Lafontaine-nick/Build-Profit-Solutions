import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  readWetAreaDemoCounts,
  type WetAreaDemoCounts,
  type WetAreaDemoOverrideKey,
} from '@/utils/wetAreaExistingDemo';

export const WET_AREA_DEMO_QM_SCOPE_IDS = new Set([
  'tub_demo',
  'shower_floor_demo',
  'shower_enclosure_demo',
  'glass_door_demo',
]);

const DEMO_SCOPE_OVERRIDE_KEYS: Record<string, WetAreaDemoOverrideKey[]> = {
  tub_demo: ['demoTubCount'],
  shower_floor_demo: ['demoTilePanCount', 'demoPrefabPanCount'],
  shower_enclosure_demo: ['demoPrefabEnclosureCount'],
  glass_door_demo: ['demoShowerDoorCount'],
};

const DEMO_SCOPE_LABELS: Record<
  string,
  { label: string; helperText: string; category: string }
> = {
  shower_enclosure_demo: {
    label: 'Remove existing prefab shower enclosure',
    helperText:
      'Demo and haul off the existing prefab surround or one-piece enclosure.',
    category: 'demo',
  },
  glass_door_demo: {
    label: 'Remove existing shower door',
    helperText: 'Demo and haul off the existing glass or framed shower door.',
    category: 'demo',
  },
};

function stepperCountActive(value: number | null | undefined): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

/** True when a QM demo stepper row should show its Confirm Scope pricing card. */
export function bathroomWetAreaDemoCardActive(
  itemId: string,
  measurements: Record<string, unknown> | null | undefined
): boolean {
  if (!WET_AREA_DEMO_QM_SCOPE_IDS.has(itemId)) return true;
  const demo = readWetAreaDemoCounts(measurements);
  switch (itemId) {
    case 'tub_demo':
      return stepperCountActive(demo.demoTubCount);
    case 'shower_floor_demo':
      return (
        stepperCountActive(demo.demoTilePanCount) ||
        stepperCountActive(demo.demoPrefabPanCount)
      );
    case 'shower_enclosure_demo':
      return stepperCountActive(demo.demoPrefabEnclosureCount);
    case 'glass_door_demo':
      return stepperCountActive(demo.demoShowerDoorCount);
    default:
      return false;
  }
}

function defaultDemoScopeRow(id: string): ScopeChecklistItem {
  const copy = DEMO_SCOPE_LABELS[id];
  return {
    id,
    inputType: 'yes_no',
    label: copy?.label || id,
    helperText: copy?.helperText || 'Demo scope controlled from Quick Measurements.',
    category: copy?.category || 'demo',
    state: 'included',
  };
}

/** Inject enclosure / shower-door demo cards when QM steppers are on. */
export function expandBathroomWetAreaDemoScopeDisplayItems(
  items: ScopeChecklistItem[],
  measurements: Record<string, unknown>,
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (String(templateKey || '').toLowerCase() !== 'bathroom') return items;

  const demo = readWetAreaDemoCounts(measurements);
  const activeIds: string[] = [];
  if (stepperCountActive(demo.demoPrefabEnclosureCount)) {
    activeIds.push('shower_enclosure_demo');
  }
  if (stepperCountActive(demo.demoShowerDoorCount)) {
    activeIds.push('glass_door_demo');
  }
  if (!activeIds.length) return items;

  const next = items.map(row => ({ ...row }));
  for (const id of activeIds) {
    const idx = next.findIndex(row => row.id === id);
    const base = idx >= 0 ? next[idx] : defaultDemoScopeRow(id);
    const row: ScopeChecklistItem = {
      ...base,
      inputType: 'yes_no',
      state: 'included',
      label: DEMO_SCOPE_LABELS[id]?.label || base.label,
      helperText: DEMO_SCOPE_LABELS[id]?.helperText || base.helperText,
    };
    if (idx >= 0) next[idx] = row;
    else next.push(row);
  }
  return next;
}

/**
 * Drop QM-hidden wet-area demo lines. Quick Measurements is authoritative for
 * tub / pan / enclosure / shower-door tear-out cards on bathroom jobs.
 */
export function finalizeWetAreaDemoScopeFromMeasurements(
  items: ScopeChecklistItem[],
  measurements: Record<string, unknown> | null | undefined
): ScopeChecklistItem[] {
  const demo = readWetAreaDemoCounts(measurements);
  const overrides = (measurements?.demoWetAreaManualOverrides || {}) as Partial<
    Record<WetAreaDemoOverrideKey, boolean>
  >;
  const qmTouched =
    Object.keys(overrides).length > 0 ||
    Object.values(demo).some(value => value != null);

  if (!qmTouched) return items;

  return items.filter(item => {
    if (!WET_AREA_DEMO_QM_SCOPE_IDS.has(item.id)) return true;
    return bathroomWetAreaDemoCardActive(item.id, measurements);
  });
}

export function wetAreaDemoScopeKeysForSync(): WetAreaDemoOverrideKey[] {
  return [
    'demoTubCount',
    'demoTilePanCount',
    'demoPrefabPanCount',
    'demoPrefabEnclosureCount',
    'demoShowerDoorCount',
    'demoBathFloorTileCount',
    'demoTileWallCount',
  ];
}

/** Whether a demo scope row should be excluded after QM sync. */
export function wetAreaDemoScopeShouldExclude(
  scopeId: string,
  demo: WetAreaDemoCounts,
  overrides?: Partial<Record<WetAreaDemoOverrideKey, boolean>> | null,
  noteBacked?: boolean
): boolean {
  if (bathroomWetAreaDemoCardActive(scopeId, { ...demo })) return false;
  const keys = DEMO_SCOPE_OVERRIDE_KEYS[scopeId];
  if (!keys?.length) return !noteBacked;
  if (keys.some(key => overrides?.[key])) return true;
  return !noteBacked;
}
