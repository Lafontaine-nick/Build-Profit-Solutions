import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

function positiveCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export type FlooringExistingCounts = {
  flooringExistingCount: number | null;
};

export type FlooringInstallCounts = {
  flooringInstallScopeCount: number | null;
};

export type FlooringDemoCounts = {
  flooringDemoScopeCount: number | null;
};

export const FLOORING_QM_EMBEDDED_IDS = new Set(['floor_demo', 'flooring']);

export function readFlooringExisting(m: Record<string, unknown>): FlooringExistingCounts {
  return { flooringExistingCount: positiveCount(m.flooringExistingCount) };
}

export function readFlooringInstall(m: Record<string, unknown>): FlooringInstallCounts {
  return { flooringInstallScopeCount: positiveCount(m.flooringInstallScopeCount) };
}

export function readFlooringDemo(m: Record<string, unknown>): FlooringDemoCounts {
  return { flooringDemoScopeCount: positiveCount(m.flooringDemoScopeCount) };
}

export function emptyFlooringExisting(): FlooringExistingCounts {
  return { flooringExistingCount: null };
}

function notesMentionExistingFloor(n: string): boolean {
  return /\b(existing|current|old)\s+(?:floor|flooring|tile|lvp|vinyl|carpet)\b/.test(n);
}

export function inferExistingFlooringFromNotes(notes: string | null | undefined): FlooringExistingCounts {
  const n = String(notes || '').toLowerCase();
  return notesMentionExistingFloor(n) ? { flooringExistingCount: 1 } : emptyFlooringExisting();
}

export function inferFlooringInstallFromIntent(params: {
  notes?: string | null;
  checklistItems?: ScopeChecklistItem[];
}): FlooringInstallCounts {
  const n = String(params.notes || '').toLowerCase();
  const included =
    params.checklistItems?.find((r) => r.id === 'flooring')?.state === 'included' ||
    inferItemStateFromNotes('flooring', n) === 'included' ||
    /\b(install|new)\s+(?:lvp|laminate|vinyl|flooring|carpet|tile\s+floor)\b/.test(n);
  return { flooringInstallScopeCount: included ? 1 : null };
}

export function resolveFlooringDemoFromIntent(params: {
  notes?: string | null;
  existing: FlooringExistingCounts;
  install: FlooringInstallCounts;
  checklistItems?: ScopeChecklistItem[];
}): FlooringDemoCounts {
  const n = String(params.notes || '').toLowerCase();
  const ex = params.existing;
  const ins = params.install;
  const floorDemoIncluded =
    params.checklistItems?.find((r) => r.id === 'floor_demo')?.state === 'included' ||
    inferItemStateFromNotes('floor_demo', n) === 'included' ||
    /\b(demo|remove|tear[\s-]?out)\b[^.]{0,50}\b(floor|flooring|tile|lvp|vinyl|carpet)\b/.test(n);

  if (
    floorDemoIncluded &&
    (positiveCount(ex.flooringExistingCount) ||
      positiveCount(ins.flooringInstallScopeCount))
  ) {
    return { flooringDemoScopeCount: 1 };
  }
  if (positiveCount(ex.flooringExistingCount) && positiveCount(ins.flooringInstallScopeCount)) {
    return { flooringDemoScopeCount: 1 };
  }
  return { flooringDemoScopeCount: null };
}

export function syncFlooringQmScopeItems(
  items: ScopeChecklistItem[],
  m: Record<string, unknown>
): ScopeChecklistItem[] {
  const install = readFlooringInstall(m);
  const demo = readFlooringDemo(m);
  let changed = false;
  const next = items.map((row) => {
    if (row.id === 'flooring' && positiveCount(install.flooringInstallScopeCount)) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
    }
    if (row.id === 'floor_demo' && positiveCount(demo.flooringDemoScopeCount)) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
    }
    return row;
  });
  return changed ? next : items;
}

function hydrateFlooring(ctx: QmPanelHydrateContext): Record<string, unknown> {
  const saved = ctx.measurements;
  const hasSaved = positiveCount(saved.flooringInstallScopeCount) || positiveCount(saved.flooringDemoScopeCount);

  let existing = readFlooringExisting(saved);
  if (ctx.hasSitePhotos) {
    existing = {
      flooringExistingCount:
        positiveCount(saved.flooringExistingCount) ||
        inferExistingFlooringFromNotes(ctx.notes).flooringExistingCount,
    };
  } else if (!positiveCount(saved.flooringExistingCount)) {
    existing = emptyFlooringExisting();
  }

  const install = positiveCount(saved.flooringInstallScopeCount)
    ? readFlooringInstall(saved)
    : inferFlooringInstallFromIntent({ notes: ctx.notes, checklistItems: ctx.checklistItems });

  const demo = positiveCount(saved.flooringDemoScopeCount)
    ? readFlooringDemo(saved)
    : resolveFlooringDemoFromIntent({
        notes: ctx.notes,
        existing,
        install,
        checklistItems: ctx.checklistItems,
      });

  return { ...saved, ...existing, ...install, ...demo };
}

export const flooringQmPanel: QmPanelDefinition = {
  id: 'flooring_remodel',
  templateKeys: ['flooring'],
  embeddedScopeItemIds: [...FLOORING_QM_EMBEDDED_IDS],
  isActive: (ctx) => String(ctx.templateKey || '').toLowerCase() === 'flooring',
  hydrateMeasurements: hydrateFlooring,
  syncScopeItems: syncFlooringQmScopeItems,
};
