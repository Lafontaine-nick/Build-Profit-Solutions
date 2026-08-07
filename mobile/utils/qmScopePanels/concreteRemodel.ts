import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

/** Checklist lines synced from the concrete QM panel. */
export const CONCRETE_QM_SYNC_SCOPE_IDS = new Set([
  'demo_removal',
  'site_prep',
  'forms',
  'reinforcement',
  'pour_flatwork',
  'pour_foundation',
  'finish_seal',
  'cleanup',
]);

/** Empty — concrete scope cards render in Confirm Scope (same as landscaping). */
export const CONCRETE_QM_EMBEDDED_IDS = new Set<string>();

export const CONCRETE_CONFIRM_SCOPE_LINE_CARD_IDS = new Set([...CONCRETE_QM_SYNC_SCOPE_IDS]);

export type ConcreteFlatworkOptionId =
  | 'driveways'
  | 'sidewalks'
  | 'patios'
  | 'rv_pads'
  | 'walkways';

export const CONCRETE_FLATWORK_OPTION_IDS = new Set<ConcreteFlatworkOptionId>([
  'driveways',
  'sidewalks',
  'patios',
  'rv_pads',
  'walkways',
]);

const SCOPE_ID_ALIASES: Record<string, string> = {
  footings: 'pour_foundation',
  excavation: 'site_prep',
  finish_options: 'finish_seal',
  rebar: 'reinforcement',
};

export function concreteScopeCanonicalId(id: string): string {
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
  add('demo_removal', /\b(?:demo|demolition|remove|tear[\s-]?out|break(?:ing)?\s+out)\b[^.;]{0,40}\b(?:concrete|slab|sidewalk|driveway|patio)\b|\b(?:concrete|slab|sidewalk|driveway|patio)\b[^.;]{0,40}\b(?:demo|demolition|remove|tear[\s-]?out)\b/);
  add('site_prep', /\b(?:site\s+prep|grading|excavat(?:e|ion)|subgrade)\b/);
  add('forms', /\b(?:forms?|formwork|layout)\b/);
  add('reinforcement', /\b(?:rebar|mesh|reinforc(?:e|ement))\b/);
  add('pour_foundation', /\b(?:footings?|piers?|foundation\s+pour)\b/);
  add('finish_seal', /\b(?:broom\s+finish|seal(?:er)?|cure|finish(?:ing)?)\b/);
  add('cleanup', /\b(?:cleanup|haul[\s-]?off|disposal)\b/);
  if (
    /\b(?:concrete\s+patio|slab|flatwork|sidewalk|driveway|walkway|rv\s+pad)\b/.test(notes) ||
    isIncluded(items, 'pour_flatwork')
  ) {
    ids.add('pour_flatwork');
    if (/\bdriveway\b/.test(notes)) ids.add('driveways');
    if (/\bsidewalk\b/.test(notes)) ids.add('sidewalks');
    if (/\bpatio\b/.test(notes)) ids.add('patios');
    if (/\brv\s+pad\b/.test(notes)) ids.add('rv_pads');
    if (/\bwalkway\b/.test(notes)) ids.add('walkways');
  }
  return [...ids];
}

export function readConcreteScope(m: Record<string, unknown>): string[] {
  return Array.isArray(m.concreteScope) ? m.concreteScope.map(String) : [];
}

function readLegacyConcreteScope(m: Record<string, unknown>): string[] {
  const selections = m.tradeScopeSelections;
  if (!selections || typeof selections !== 'object' || Array.isArray(selections)) return [];
  const concrete = (selections as Record<string, unknown>).concrete;
  return Array.isArray(concrete) ? concrete.map(String) : [];
}

function scopeSelectionActivatesItem(itemId: string, scope: string[]): boolean {
  const selected = new Set(scope);
  const canonical = new Set(scope.map(concreteScopeCanonicalId));
  if (canonical.has(itemId)) return true;
  switch (itemId) {
    case 'pour_flatwork':
      return [...CONCRETE_FLATWORK_OPTION_IDS].some((id) => selected.has(id));
    case 'pour_foundation':
      return selected.has('footings') || selected.has('pour_foundation');
    case 'site_prep':
      return selected.has('site_prep') || selected.has('excavation');
    case 'reinforcement':
      return selected.has('reinforcement') || selected.has('rebar');
    case 'finish_seal':
      return selected.has('finish_seal') || selected.has('finish_options');
    default:
      return selected.has(itemId);
  }
}

export function isConcreteQmScopeItemActive(
  itemId: string,
  measurements: Record<string, unknown>
): boolean {
  const rawScope = measurements.concreteScope;
  const legacyScope = readLegacyConcreteScope(measurements);
  const scope = readConcreteScope(measurements);
  const effectiveScope = scope.length ? scope : legacyScope;
  if (Array.isArray(rawScope) || legacyScope.length > 0) {
    return scopeSelectionActivatesItem(itemId, effectiveScope);
  }
  switch (itemId) {
    case 'demo_removal':
      return positiveNumber(measurements.concreteDemoSqft) != null;
    case 'site_prep':
      return positiveNumber(measurements.excavationCy) != null;
    case 'forms':
    case 'reinforcement':
    case 'finish_seal':
    case 'pour_flatwork':
      return positiveNumber(measurements.concreteSqft) != null;
    case 'pour_foundation':
      return positiveNumber(measurements.concreteCy) != null;
    default:
      return false;
  }
}

export function shouldUseConcreteConfirmScopeLineCard(
  templateKey: string | null | undefined,
  item: Pick<ScopeChecklistItem, 'id' | 'state' | 'noteBacked'>
): boolean {
  return (
    String(templateKey || '').toLowerCase() === 'concrete' &&
    CONCRETE_CONFIRM_SCOPE_LINE_CARD_IDS.has(item.id) &&
    item.state === 'included' &&
    item.noteBacked === true
  );
}

export function isConcreteConfirmScopePricingCard(itemId: string | null | undefined): boolean {
  return CONCRETE_CONFIRM_SCOPE_LINE_CARD_IDS.has(String(itemId || ''));
}

const CONCRETE_SCOPE_ITEM_LABELS: Record<string, string> = {
  demo_removal: 'Demo / removal',
  site_prep: 'Site prep / grading',
  forms: 'Forms / layout',
  reinforcement: 'Rebar / mesh',
  pour_flatwork: 'Pour flatwork',
  pour_foundation: 'Footings / foundation',
  finish_seal: 'Finish / seal / cure',
  cleanup: 'Cleanup & disposal',
};

export function syncConcreteQmScopeItems(
  items: ScopeChecklistItem[],
  measurements: Record<string, unknown>
): ScopeChecklistItem[] {
  const included = new Set<string>();
  for (const id of CONCRETE_QM_SYNC_SCOPE_IDS) {
    if (isConcreteQmScopeItemActive(id, measurements)) included.add(id);
  }

  let changed = false;
  const next = items.map((item) => {
    if (!CONCRETE_QM_SYNC_SCOPE_IDS.has(item.id)) return item;
    if (included.has(item.id)) {
      if (item.state === 'included' && item.noteBacked === true) return item;
      changed = true;
      return { ...item, state: 'included' as const, noteBacked: true };
    }
    if (item.state === 'included' && item.noteBacked === true) {
      changed = true;
      return { ...item, state: 'excluded' as const, noteBacked: false };
    }
    return item;
  });

  for (const itemId of CONCRETE_QM_SYNC_SCOPE_IDS) {
    if (!included.has(itemId) || next.some((item) => item.id === itemId)) continue;
    next.push({
      id: itemId,
      label: CONCRETE_SCOPE_ITEM_LABELS[itemId] || itemId.replace(/_/g, ' '),
      inputType: 'yes_no',
      state: 'included',
      category: 'concrete',
      noteBacked: true,
    });
    changed = true;
  }

  return changed ? next : items;
}

function hydrateConcrete(ctx: QmPanelHydrateContext): Record<string, unknown> {
  const saved = readConcreteScope(ctx.measurements);
  const legacy = readLegacyConcreteScope(ctx.measurements);
  const inferred = inferredScope(String(ctx.notes || '').toLowerCase(), ctx.checklistItems);
  const scope = saved.length ? saved : legacy.length ? legacy : inferred;
  return {
    ...ctx.measurements,
    concreteScope: scope.length ? scope : null,
  };
}

export const CONCRETE_FLATWORK_OPTIONS = [
  { id: 'driveways' as const, label: 'Driveway' },
  { id: 'sidewalks' as const, label: 'Sidewalk' },
  { id: 'patios' as const, label: 'Patio' },
  { id: 'rv_pads' as const, label: 'RV pad' },
  { id: 'walkways' as const, label: 'Walkway' },
];

export const CONCRETE_SCOPE_OPTIONS = [
  {
    id: 'demo_removal',
    label: 'Demo / removal',
    measurementKey: 'concreteDemoSqft' as const,
    unit: 'sqft',
    helperText: 'Existing concrete slab, sidewalk, or patio removal area.',
  },
  {
    id: 'site_prep',
    label: 'Site prep / grading',
    measurementKey: 'excavationCy' as const,
    unit: 'CY',
    helperText: 'Excavation or subgrade prep quantity in cubic yards.',
  },
  { id: 'forms', label: 'Forms / layout' },
  { id: 'reinforcement', label: 'Rebar / mesh' },
  {
    id: 'pour_foundation',
    label: 'Footings / foundation',
    measurementKey: 'concreteCy' as const,
    unit: 'CY',
    helperText: 'Foundation or footing concrete in cubic yards.',
  },
  { id: 'finish_seal', label: 'Finish / seal / cure' },
  { id: 'cleanup', label: 'Cleanup & disposal' },
] as const;

export const concreteQmPanel: QmPanelDefinition = {
  id: 'concrete_remodel',
  templateKeys: ['concrete'],
  embeddedScopeItemIds: [...CONCRETE_QM_EMBEDDED_IDS],
  isActive: (ctx) => String(ctx.templateKey || '').toLowerCase() === 'concrete',
  hydrateMeasurements: hydrateConcrete,
  syncScopeItems: syncConcreteQmScopeItems,
};
