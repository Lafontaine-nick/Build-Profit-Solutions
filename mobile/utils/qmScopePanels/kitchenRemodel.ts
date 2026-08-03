import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

function positiveCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export type KitchenExistingCounts = {
  kitchenExistingCabinetCount: number | null;
  kitchenExistingCounterCount: number | null;
  kitchenExistingApplianceCount: number | null;
  kitchenExistingBacksplashCount: number | null;
  kitchenExistingFloorCount: number | null;
};

export type KitchenInstallCounts = {
  kitchenInstallCabinetCount: number | null;
  kitchenInstallCounterCount: number | null;
  kitchenInstallApplianceCount: number | null;
  kitchenInstallBacksplashCount: number | null;
  kitchenInstallFlooringCount: number | null;
  kitchenInstallIslandCount: number | null;
};

export type KitchenDemoCounts = {
  kitchenDemoCabinetCount: number | null;
  kitchenDemoCounterCount: number | null;
  kitchenDemoBacksplashCount: number | null;
  kitchenDemoIslandCount: number | null;
  kitchenDemoApplianceCount: number | null;
  kitchenDemoFloorCount: number | null;
  kitchenDemoWallCount: number | null;
};

export type KitchenDemoOverrideKey = keyof KitchenDemoCounts;

export const KITCHEN_QM_EMBEDDED_IDS = new Set([
  'demo',
  'floor_demo',
  'wall_demo',
  'appliance_removal',
  'cabinets',
  'countertops',
  'backsplash',
  'flooring',
  'appliances',
  'island',
]);

const EXISTING_KEYS: (keyof KitchenExistingCounts)[] = [
  'kitchenExistingCabinetCount',
  'kitchenExistingCounterCount',
  'kitchenExistingApplianceCount',
  'kitchenExistingBacksplashCount',
  'kitchenExistingFloorCount',
];

const INSTALL_KEYS: (keyof KitchenInstallCounts)[] = [
  'kitchenInstallCabinetCount',
  'kitchenInstallCounterCount',
  'kitchenInstallApplianceCount',
  'kitchenInstallBacksplashCount',
  'kitchenInstallFlooringCount',
  'kitchenInstallIslandCount',
];

const DEMO_KEYS: (keyof KitchenDemoCounts)[] = [
  'kitchenDemoCabinetCount',
  'kitchenDemoCounterCount',
  'kitchenDemoBacksplashCount',
  'kitchenDemoIslandCount',
  'kitchenDemoApplianceCount',
  'kitchenDemoFloorCount',
  'kitchenDemoWallCount',
];

export function readKitchenExistingCounts(m: Record<string, unknown>): KitchenExistingCounts {
  return {
    kitchenExistingCabinetCount: positiveCount(m.kitchenExistingCabinetCount),
    kitchenExistingCounterCount: positiveCount(m.kitchenExistingCounterCount),
    kitchenExistingApplianceCount: positiveCount(m.kitchenExistingApplianceCount),
    kitchenExistingBacksplashCount: positiveCount(m.kitchenExistingBacksplashCount),
    kitchenExistingFloorCount: positiveCount(m.kitchenExistingFloorCount),
  };
}

export function readKitchenInstallCounts(m: Record<string, unknown>): KitchenInstallCounts {
  return {
    kitchenInstallCabinetCount: positiveCount(m.kitchenInstallCabinetCount),
    kitchenInstallCounterCount: positiveCount(m.kitchenInstallCounterCount),
    kitchenInstallApplianceCount: positiveCount(m.kitchenInstallApplianceCount),
    kitchenInstallBacksplashCount: positiveCount(m.kitchenInstallBacksplashCount),
    kitchenInstallFlooringCount: positiveCount(m.kitchenInstallFlooringCount),
    kitchenInstallIslandCount: positiveCount(m.kitchenInstallIslandCount),
  };
}

export function readKitchenDemoCounts(m: Record<string, unknown>): KitchenDemoCounts {
  return {
    kitchenDemoCabinetCount: positiveCount(m.kitchenDemoCabinetCount),
    kitchenDemoCounterCount:
      m.kitchenDemoCounterCount === undefined
        ? positiveCount(m.kitchenDemoCabinetCount)
        : positiveCount(m.kitchenDemoCounterCount),
    kitchenDemoBacksplashCount: positiveCount(m.kitchenDemoBacksplashCount),
    kitchenDemoIslandCount: positiveCount(m.kitchenDemoIslandCount),
    kitchenDemoApplianceCount: positiveCount(m.kitchenDemoApplianceCount),
    kitchenDemoFloorCount: positiveCount(m.kitchenDemoFloorCount),
    kitchenDemoWallCount: positiveCount(m.kitchenDemoWallCount),
  };
}

export function emptyKitchenExistingCounts(): KitchenExistingCounts {
  return {
    kitchenExistingCabinetCount: null,
    kitchenExistingCounterCount: null,
    kitchenExistingApplianceCount: null,
    kitchenExistingBacksplashCount: null,
    kitchenExistingFloorCount: null,
  };
}

function notesMentionExistingCabinets(n: string): boolean {
  return /\b(existing|current|old)\s+cabinets?\b|\bcabinets?\s+and\s+counters?\b/.test(n);
}

function notesMentionExistingCounters(n: string): boolean {
  return /\b(existing|current|old)\s+(?:countertops?|counters?)\b/.test(n);
}

function notesMentionExistingAppliances(n: string): boolean {
  return /\b(existing|current)\s+(?:appliances?|range|dishwasher|refrigerator)\b/.test(n);
}

export function inferExistingKitchenFromNotes(notes: string | null | undefined): KitchenExistingCounts {
  const n = String(notes || '').toLowerCase();
  const out = emptyKitchenExistingCounts();
  if (notesMentionExistingCabinets(n)) out.kitchenExistingCabinetCount = 1;
  if (notesMentionExistingCounters(n)) out.kitchenExistingCounterCount = 1;
  if (notesMentionExistingAppliances(n)) out.kitchenExistingApplianceCount = 1;
  if (/\b(existing|current)\s+backsplash\b/.test(n)) out.kitchenExistingBacksplashCount = 1;
  if (/\b(existing|current)\s+(?:kitchen\s+)?(?:floor|flooring|tile|lvp)\b/.test(n)) {
    out.kitchenExistingFloorCount = 1;
  }
  return out;
}

function checklistIncluded(items: ScopeChecklistItem[], id: string): boolean {
  return items.find((r) => r.id === id)?.state === 'included';
}

export function inferKitchenInstallFromIntent(params: {
  notes?: string | null;
  checklistItems?: ScopeChecklistItem[];
}): KitchenInstallCounts {
  const n = String(params.notes || '').toLowerCase();
  const items = params.checklistItems || [];
  const out: KitchenInstallCounts = {
    kitchenInstallCabinetCount: null,
    kitchenInstallCounterCount: null,
    kitchenInstallApplianceCount: null,
    kitchenInstallBacksplashCount: null,
    kitchenInstallFlooringCount: null,
    kitchenInstallIslandCount: null,
  };
  if (checklistIncluded(items, 'cabinets') || inferItemStateFromNotes('cabinets', n) === 'included') {
    out.kitchenInstallCabinetCount = 1;
  }
  if (
    checklistIncluded(items, 'countertops') ||
    inferItemStateFromNotes('countertops', n) === 'included'
  ) {
    out.kitchenInstallCounterCount = 1;
  }
  if (
    checklistIncluded(items, 'appliances') ||
    inferItemStateFromNotes('appliances', n) === 'included'
  ) {
    out.kitchenInstallApplianceCount = 1;
  }
  if (
    checklistIncluded(items, 'backsplash') ||
    inferItemStateFromNotes('backsplash', n) === 'included'
  ) {
    out.kitchenInstallBacksplashCount = 1;
  }
  if (checklistIncluded(items, 'flooring') || inferItemStateFromNotes('flooring', n) === 'included') {
    out.kitchenInstallFlooringCount = 1;
  }
  const islandCountertopOnly =
    /\bisland\s+(?:countertops?|counters?)\b|\b(?:countertops?|counters?)\s+on\s+(?:the\s+)?island\b/.test(n);
  const notesRequestIslandBase =
    /\b(?:new|install|build|add|replace)\b[^.]{0,30}\bisland\b(?!\s+(?:countertops?|counters?)\b)/.test(n);
  if ((checklistIncluded(items, 'island') && !islandCountertopOnly) || notesRequestIslandBase) {
    out.kitchenInstallIslandCount = 1;
  }
  if (/\bnew\s+cabinets?\b/.test(n) && !out.kitchenInstallCabinetCount) out.kitchenInstallCabinetCount = 1;
  if (/\bnew\s+(?:countertops?|counters?|quartz|granite)\b/.test(n) && !out.kitchenInstallCounterCount) {
    out.kitchenInstallCounterCount = 1;
  }
  return out;
}

export function resolveKitchenDemoFromIntent(params: {
  notes?: string | null;
  existing: KitchenExistingCounts;
  install: KitchenInstallCounts;
  tubDemoIncluded?: boolean;
  checklistItems?: ScopeChecklistItem[];
}): KitchenDemoCounts {
  const n = String(params.notes || '').toLowerCase();
  const ex = params.existing;
  const ins = params.install;
  const items = params.checklistItems || [];
  const demo: KitchenDemoCounts = {
    kitchenDemoCabinetCount: null,
    kitchenDemoCounterCount: null,
    kitchenDemoBacksplashCount: null,
    kitchenDemoIslandCount: null,
    kitchenDemoApplianceCount: null,
    kitchenDemoFloorCount: null,
    kitchenDemoWallCount: null,
  };
  const islandCountertopOnly =
    /\bisland\s+(?:countertops?|counters?)\b|\b(?:countertops?|counters?)\s+on\s+(?:the\s+)?island\b/.test(n);

  const explicitCabinetDemo =
    /\b(?:demo|remove|tear[\s-]?out)\b[^.]{0,50}\b(?:cabinets?|built[\s-]?ins?)\b/.test(n);
  const explicitCounterDemo =
    /\b(?:demo|remove|tear[\s-]?out)\b[^.]{0,50}\b(?:countertops?|counters?)\b/.test(n) ||
    /\b(?:countertops?|counters?)\b[^.]{0,50}\b(?:demo|remove|tear[\s-]?out)\b/.test(n);
  const cabinetDemo =
    checklistIncluded(items, 'demo') ||
    inferItemStateFromNotes('demo', n) === 'included' ||
    (explicitCabinetDemo &&
      (positiveCount(ex.kitchenExistingCabinetCount) || positiveCount(ex.kitchenExistingCounterCount)));
  if (explicitCabinetDemo) {
    demo.kitchenDemoCabinetCount = 1;
  }
  if (explicitCounterDemo) {
    demo.kitchenDemoCounterCount = 1;
  }
  if (
    checklistIncluded(items, 'backsplash_demo') ||
    inferItemStateFromNotes('backsplash_demo', n) === 'included'
  ) {
    demo.kitchenDemoBacksplashCount = 1;
  }
  if (
    cabinetDemo &&
    (positiveCount(ex.kitchenExistingCabinetCount) ||
      positiveCount(ex.kitchenExistingCounterCount)) &&
    (positiveCount(ins.kitchenInstallCabinetCount) ||
      positiveCount(ins.kitchenInstallCounterCount) ||
      cabinetDemo)
  ) {
    demo.kitchenDemoCabinetCount = 1;
  } else if (
    (positiveCount(ex.kitchenExistingCabinetCount) || positiveCount(ex.kitchenExistingCounterCount)) &&
    (positiveCount(ins.kitchenInstallCabinetCount) || positiveCount(ins.kitchenInstallCounterCount))
  ) {
    demo.kitchenDemoCabinetCount = 1;
  }

  const explicitIslandBaseDemo =
    /\b(?:demo|remove|tear[\s-]?out)\b[^.]{0,40}\b(?:island\s+(?:cabinet|base)|island)\b/.test(n) ||
    /\b(?:island\s+(?:cabinet|base)|island)\b[^.]{0,40}\b(?:demo|remove|tear[\s-]?out)\b/.test(n);
  if (explicitIslandBaseDemo && !islandCountertopOnly) {
    demo.kitchenDemoIslandCount = 1;
  }

  if (
    (checklistIncluded(items, 'appliance_removal') ||
      inferItemStateFromNotes('appliance_removal', n) === 'included' ||
      (positiveCount(ex.kitchenExistingApplianceCount) && positiveCount(ins.kitchenInstallApplianceCount))) &&
    positiveCount(ex.kitchenExistingApplianceCount)
  ) {
    demo.kitchenDemoApplianceCount = 1;
  }

  if (
    (checklistIncluded(items, 'floor_demo') ||
      inferItemStateFromNotes('floor_demo', n) === 'included' ||
      (positiveCount(ex.kitchenExistingFloorCount) && positiveCount(ins.kitchenInstallFlooringCount))) &&
    positiveCount(ex.kitchenExistingFloorCount)
  ) {
    demo.kitchenDemoFloorCount = 1;
  }

  if (
    checklistIncluded(items, 'wall_demo') ||
    inferItemStateFromNotes('wall_demo', n) === 'included' ||
    /\b(remove|demo|tear[\s-]?out)\b[^.]{0,40}\b(soffit|bulkhead|wall)\b/.test(n)
  ) {
    demo.kitchenDemoWallCount = 1;
  }

  return demo;
}

export function mergeKitchenCounts<T extends Record<string, unknown>>(
  base: T,
  patch: Record<string, unknown>
): T {
  const out = { ...base };
  for (const key of [...EXISTING_KEYS, ...INSTALL_KEYS, ...DEMO_KEYS]) {
    if (patch[key] != null) (out as Record<string, unknown>)[key] = patch[key];
    else if (key in patch) (out as Record<string, unknown>)[key] = null;
  }
  return out;
}

function mergeCountLayers(
  ...layers: Array<Record<string, number | null | undefined>>
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (positiveCount(v)) out[k] = 1;
    }
  }
  return out;
}

export function syncKitchenQmScopeItems(
  items: ScopeChecklistItem[],
  m: Record<string, unknown>
): ScopeChecklistItem[] {
  const install = readKitchenInstallCounts(m);
  const demo = readKitchenDemoCounts(m);
  let changed = false;
  const next = items.map((row) => {
    const syncIncluded = (cond: boolean) => {
      if (cond && row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
      // The QM stepper is the source of truth for embedded kitchen scopes.
      // Remove a previously synced scope when its stepper is turned off;
      // otherwise its measurement fields remain relevant after deselection.
      if (!cond && row.state === 'included') {
        changed = true;
        return { ...row, state: 'excluded' as const };
      }
      return row;
    };
    switch (row.id) {
      case 'cabinets':
        return syncIncluded(positiveCount(install.kitchenInstallCabinetCount) != null);
      case 'countertops':
        return syncIncluded(positiveCount(install.kitchenInstallCounterCount) != null);
      case 'backsplash':
        return syncIncluded(positiveCount(install.kitchenInstallBacksplashCount) != null);
      case 'flooring':
        return syncIncluded(positiveCount(install.kitchenInstallFlooringCount) != null);
      case 'appliances':
        return syncIncluded(positiveCount(install.kitchenInstallApplianceCount) != null);
      case 'island':
        return syncIncluded(positiveCount(install.kitchenInstallIslandCount) != null);
      case 'demo':
        return syncIncluded(
          positiveCount(demo.kitchenDemoCabinetCount) != null ||
            positiveCount(demo.kitchenDemoCounterCount) != null ||
            positiveCount(demo.kitchenDemoIslandCount) != null
        );
      case 'backsplash_demo':
        return syncIncluded(positiveCount(demo.kitchenDemoBacksplashCount) != null);
      case 'appliance_removal':
        return syncIncluded(positiveCount(demo.kitchenDemoApplianceCount) != null);
      case 'floor_demo':
        return syncIncluded(positiveCount(demo.kitchenDemoFloorCount) != null);
      case 'wall_demo':
        return syncIncluded(positiveCount(demo.kitchenDemoWallCount) != null);
      default:
        return row;
    }
  });
  return changed ? next : items;
}

function hydrateKitchen(ctx: QmPanelHydrateContext): Record<string, unknown> {
  const saved = ctx.measurements;
  const hasSavedInstall = INSTALL_KEYS.some((k) => positiveCount(saved[k]));
  const hasSavedDemo = DEMO_KEYS.some((k) => positiveCount(saved[k]));
  const hasSavedExisting = EXISTING_KEYS.some((k) => positiveCount(saved[k]));

  let existing = readKitchenExistingCounts(saved);
  if (ctx.hasSitePhotos) {
    existing = {
      ...existing,
      ...mergeCountLayers(
        inferExistingKitchenFromNotes(ctx.notes),
        readKitchenExistingCounts(saved)
      ),
    } as KitchenExistingCounts;
  } else if (!hasSavedExisting) {
    existing = emptyKitchenExistingCounts();
  }

  const install = hasSavedInstall
    ? readKitchenInstallCounts(saved)
    : inferKitchenInstallFromIntent({ notes: ctx.notes, checklistItems: ctx.checklistItems });

  const demo = hasSavedDemo
    ? readKitchenDemoCounts(saved)
    : resolveKitchenDemoFromIntent({
        notes: ctx.notes,
        existing,
        install,
        checklistItems: ctx.checklistItems,
      });

  return mergeKitchenCounts(saved, { ...existing, ...install, ...demo });
}

export const kitchenQmPanel: QmPanelDefinition = {
  id: 'kitchen_remodel',
  templateKeys: ['kitchen'],
  embeddedScopeItemIds: [...KITCHEN_QM_EMBEDDED_IDS],
  isActive: (ctx) => String(ctx.templateKey || '').toLowerCase() === 'kitchen',
  hydrateMeasurements: hydrateKitchen,
  syncScopeItems: syncKitchenQmScopeItems,
};
