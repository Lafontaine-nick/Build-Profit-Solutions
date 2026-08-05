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
  flooringExistingTypes?: Array<
    'carpet' | 'tile' | 'hardwood' | 'engineered_hardwood' | 'laminate' | 'lvp' | 'vinyl' | 'unknown'
  > | null;
};

export type FlooringInstallCounts = {
  flooringInstallScopeCount: number | null;
};

export type FlooringDemoCounts = {
  flooringDemoScopeCount: number | null;
};

// Flooring demo remains an independent Confirm Scope card so its pricing and
// Yes / No / Not sure state can be reviewed separately from the QM controls.
export const FLOORING_QM_EMBEDDED_IDS = new Set<string>();
const FLOORING_MEASUREMENT_SCOPE_MAP: Array<[string, string]> = [
  ['flooring_lvp', 'flooringLvpSqft'],
  ['flooring_laminate', 'flooringLaminateSqft'],
  ['flooring_engineered_hardwood', 'flooringEngineeredHardwoodSqft'],
  ['flooring_solid_hardwood', 'flooringSolidHardwoodSqft'],
  ['tile_flooring', 'flooringTileSqft'],
  ['flooring_carpet', 'flooringCarpetSqft'],
  ['floor_demo', 'floorDemoSqft'],
  ['underlayment', 'underlaymentSqft'],
  ['moisture_barrier', 'moistureBarrierSqft'],
  ['transitions', 'transitionLf'],
  ['quarter_round', 'quarterRoundLf'],
];
const FLOORING_PRODUCT_SCOPE_MAP: Array<[string, string]> = [
  ['flooring_lvp', 'lvp'],
  ['flooring_laminate', 'laminate'],
  ['flooring_engineered_hardwood', 'engineered_hardwood'],
  ['flooring_solid_hardwood', 'solid_hardwood'],
  ['tile_flooring', 'tile'],
  ['flooring_carpet', 'carpet'],
];

export function readFlooringExisting(m: Record<string, unknown>): FlooringExistingCounts {
  return {
    flooringExistingCount: positiveCount(m.flooringExistingCount),
    flooringExistingTypes: Array.isArray(m.flooringExistingTypes)
      ? (m.flooringExistingTypes as FlooringExistingCounts['flooringExistingTypes'])
      : null,
  };
}

export function readFlooringInstall(m: Record<string, unknown>): FlooringInstallCounts {
  return { flooringInstallScopeCount: positiveCount(m.flooringInstallScopeCount) };
}

export function readFlooringDemo(m: Record<string, unknown>): FlooringDemoCounts {
  return { flooringDemoScopeCount: positiveCount(m.flooringDemoScopeCount) };
}

export function emptyFlooringExisting(): FlooringExistingCounts {
  return { flooringExistingCount: null, flooringExistingTypes: null };
}

function notesMentionExistingFloor(n: string): boolean {
  return /\b(existing|current|old)\s+(?:floor|flooring|tile|lvp|vinyl|carpet)\b/.test(n);
}

export function inferExistingFlooringFromNotes(notes: string | null | undefined): FlooringExistingCounts {
  const n = String(notes || '').toLowerCase();
  const types: NonNullable<FlooringExistingCounts['flooringExistingTypes']> = [];
  const existingClauses = n.split(/[.;\n]+/);
  const hasExistingType = (pattern: RegExp) =>
    existingClauses.some((clause) => /\b(?:existing|current|old)\b/.test(clause) && pattern.test(clause));
  if (hasExistingType(/\bcarpet\b/)) types.push('carpet');
  if (hasExistingType(/\btile\b/)) types.push('tile');
  if (hasExistingType(/\bhardwood\b/) && !hasExistingType(/\bengineered\s+hardwood\b/)) types.push('hardwood');
  if (hasExistingType(/\bengineered\s+hardwood\b/)) types.push('engineered_hardwood');
  if (hasExistingType(/\blaminate\b/)) types.push('laminate');
  if (hasExistingType(/\blvp\b/)) types.push('lvp');
  if (hasExistingType(/\bvinyl\b/)) types.push('vinyl');
  return notesMentionExistingFloor(n) ? { flooringExistingCount: 1, flooringExistingTypes: types.length ? types : ['unknown'] } : emptyFlooringExisting();
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
    ((positiveCount(ex.flooringExistingCount) || (ex.flooringExistingTypes?.length ?? 0) > 0) ||
      positiveCount(ins.flooringInstallScopeCount))
  ) {
    return { flooringDemoScopeCount: 1 };
  }
  if ((positiveCount(ex.flooringExistingCount) || (ex.flooringExistingTypes?.length ?? 0) > 0) && positiveCount(ins.flooringInstallScopeCount)) {
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
  const existing = readFlooringExisting(m);
  const hasExistingFlooring =
    positiveCount(existing.flooringExistingCount) ||
    (existing.flooringExistingTypes?.length ?? 0) > 0;
  const hasMeasuredSpecificProduct = FLOORING_MEASUREMENT_SCOPE_MAP
    .slice(0, 6)
    .some(([, key]) => positiveCount(m[key]));
  const selectedProducts = new Set(
    Array.isArray(m.flooringProductScope) ? m.flooringProductScope.map(String) : []
  );
  const hasSpecificProduct = hasMeasuredSpecificProduct || selectedProducts.size > 0;
  let changed = false;
  const next = items.map((row) => {
    const measurementKey = FLOORING_MEASUREMENT_SCOPE_MAP.find(([id]) => id === row.id)?.[1];
    const productScope = FLOORING_PRODUCT_SCOPE_MAP.find(([id]) => id === row.id)?.[1];
    if ((measurementKey && positiveCount(m[measurementKey])) || (productScope && selectedProducts.has(productScope))) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const, noteBacked: true };
      }
    }
    if (row.id === 'flooring' && positiveCount(install.flooringInstallScopeCount)) {
      if (hasSpecificProduct) {
        if (row.state !== 'excluded') {
          changed = true;
          return { ...row, state: 'excluded' as const, noteBacked: false };
        }
        return row;
      }
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const, noteBacked: true };
      }
    }
    if (
      row.id === 'floor_demo' &&
      (positiveCount(demo.flooringDemoScopeCount) ||
        (hasExistingFlooring && positiveCount(install.flooringInstallScopeCount)))
    ) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const, noteBacked: true };
      }
    }
    return row;
  });
  return changed ? next : items;
}

function hydrateFlooring(ctx: QmPanelHydrateContext): Record<string, unknown> {
  const saved = ctx.measurements;
  const notes = String(ctx.notes || '').toLowerCase();
  const inferredProductScope = [
    /\b(?:lvp|luxury\s+vinyl)\b/.test(notes) ? 'lvp' : null,
    /\blaminate\b/.test(notes) ? 'laminate' : null,
    /\bengineered\s+hardwood\b/.test(notes) ? 'engineered_hardwood' : null,
    /\bsolid\s+hardwood\b/.test(notes) ? 'solid_hardwood' : null,
    /\b(?:floor|flooring)\s+tile\b|\btile\s+(?:floor|flooring)\b|\btile\b/.test(notes) ? 'tile' : null,
    /\bcarpet\b/.test(notes) ? 'carpet' : null,
  ].filter(Boolean);
  const hasSaved = positiveCount(saved.flooringInstallScopeCount) || positiveCount(saved.flooringDemoScopeCount);

  let existing = readFlooringExisting(saved);
  const inferredExisting = inferExistingFlooringFromNotes(ctx.notes);
  existing = {
    flooringExistingCount:
      positiveCount(saved.flooringExistingCount) || inferredExisting.flooringExistingCount,
    flooringExistingTypes:
      (Array.isArray(saved.flooringExistingTypes) && saved.flooringExistingTypes.length
        ? saved.flooringExistingTypes
        : inferredExisting.flooringExistingTypes) || null,
  };

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

  return {
    ...saved,
    flooringSqft:
      positiveCount(saved.flooringSqft) ||
      positiveCount(saved.floorAreaSqft) ||
      null,
    ...existing,
    ...install,
    ...demo,
    flooringProductScope:
      Array.isArray(saved.flooringProductScope) && saved.flooringProductScope.length
        ? saved.flooringProductScope
        : inferredProductScope,
  };
}

export const flooringQmPanel: QmPanelDefinition = {
  id: 'flooring_remodel',
  templateKeys: ['flooring'],
  embeddedScopeItemIds: [...FLOORING_QM_EMBEDDED_IDS],
  isActive: (ctx) => String(ctx.templateKey || '').toLowerCase() === 'flooring',
  hydrateMeasurements: hydrateFlooring,
  syncScopeItems: syncFlooringQmScopeItems,
};
