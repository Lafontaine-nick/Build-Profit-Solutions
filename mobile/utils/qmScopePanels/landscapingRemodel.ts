import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

export const LANDSCAPING_QM_EMBEDDED_IDS = new Set([
  'demo_clearing',
  'grading',
  'soil_prep',
  'drainage',
  'irrigation',
  'sod_turf',
  'rock_mulch',
  'plants_trees',
  'pavers',
  'concrete',
  'landscape_lighting',
  'mobilization',
  'cleanup',
]);

const SCOPE_ID_ALIASES: Record<string, string> = {
  artificial_turf: 'sod_turf',
  sod: 'sod_turf',
  rock: 'rock_mulch',
  mulch: 'rock_mulch',
  decorative_boulders: 'rock_mulch',
  concrete_edging: 'concrete',
  irrigation: 'irrigation',
  plants: 'plants_trees',
  trees: 'plants_trees',
  pavers: 'pavers',
  demo_clearing: 'demo_clearing',
  grading: 'grading',
  soil_prep: 'soil_prep',
  drainage: 'drainage',
  landscape_lighting: 'landscape_lighting',
  mobilization: 'mobilization',
  cleanup: 'cleanup',
};

export function landscapingScopeCanonicalId(id: string): string {
  return SCOPE_ID_ALIASES[id] || id;
}

function positiveNumber(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isIncluded(items: ScopeChecklistItem[], id: string): boolean {
  return items.some((item) => item.id === id && item.state === 'included');
}

function inferredScope(notes: string, items: ScopeChecklistItem[]): string[] {
  const ids = new Set<string>();
  const add = (id: string, pattern: RegExp) => {
    if (isIncluded(items, id) || inferItemStateFromNotes(id, notes) === 'included' || pattern.test(notes)) {
      ids.add(id);
    }
  };
  add('demo_clearing', /\b(?:demo|clear(?:ing)?|remove|tear[\s-]?out)\b/);
  add('grading', /\bgrading?\b/);
  add('soil_prep', /\bsoil\s+prep(?:aration)?\b/);
  add('drainage', /\bdrain(?:age|ing)\b/);
  add('irrigation', /\birrigation\b/);
  add('sod_turf', /\b(?:sod|turf|artificial\s+grass|synthetic\s+grass)\b/);
  add('rock_mulch', /\b(?:rock|mulch|gravel|decorative\s+boulders?)\b/);
  add('plants_trees', /\b(?:plants?|trees?|shrubs?|planting)\b/);
  add('pavers', /\bpavers?\b/);
  add('concrete', /\bconcrete\s+(?:edging|flatwork|curb)|\bedging\b/);
  add('landscape_lighting', /\blandscape\s+lighting\b/);
  add('mobilization', /\bmobilization\b|\bequipment\b/);
  add('cleanup', /\b(?:cleanup|haul[\s-]?off|disposal)\b/);
  return [...ids];
}

export function readLandscapingScope(m: Record<string, unknown>): string[] {
  return Array.isArray(m.landscapeScope) ? m.landscapeScope.map(String) : [];
}

export function syncLandscapingQmScopeItems(
  items: ScopeChecklistItem[],
  measurements: Record<string, unknown>
): ScopeChecklistItem[] {
  const selected = new Set(readLandscapingScope(measurements));
  const included = new Set<string>();
  for (const id of selected) included.add(landscapingScopeCanonicalId(id));
  if (positiveNumber(measurements.sodSqft)) included.add('sod_turf');
  if (positiveNumber(measurements.paverSqft)) included.add('pavers');
  if (positiveNumber(measurements.rockMulchSqft) || positiveNumber(measurements.landscapeTons)) included.add('rock_mulch');

  let changed = false;
  const next = items.map((item) => {
    if (!LANDSCAPING_QM_EMBEDDED_IDS.has(item.id)) return item;
    if (included.has(item.id)) {
      if (item.state === 'included') return item;
      changed = true;
      return { ...item, state: 'included' as const, noteBacked: true };
    }
    if (item.state === 'included') {
      changed = true;
      return { ...item, state: 'excluded' as const, noteBacked: false };
    }
    return item;
  });
  return changed ? next : items;
}

function hydrateLandscaping(ctx: QmPanelHydrateContext): Record<string, unknown> {
  const saved = readLandscapingScope(ctx.measurements);
  const inferred = inferredScope(String(ctx.notes || '').toLowerCase(), ctx.checklistItems);
  const scope = saved.length ? saved : inferred;
  return {
    ...ctx.measurements,
    landscapeScope: scope.length ? scope : null,
  };
}

export const landscapingQmPanel: QmPanelDefinition = {
  id: 'landscaping_remodel',
  templateKeys: ['landscaping'],
  embeddedScopeItemIds: [...LANDSCAPING_QM_EMBEDDED_IDS],
  isActive: (ctx) => String(ctx.templateKey || '').toLowerCase() === 'landscaping',
  hydrateMeasurements: hydrateLandscaping,
  syncScopeItems: syncLandscapingQmScopeItems,
};

