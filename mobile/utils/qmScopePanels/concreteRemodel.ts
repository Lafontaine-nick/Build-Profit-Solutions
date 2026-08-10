import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

/** Checklist lines synced from the concrete QM panel. */
export const CONCRETE_QM_SYNC_SCOPE_IDS = new Set([
  'demo_removal',
  'site_prep',
  'excavation',
  'reinforcement',
  'pour_flatwork',
  'pour_foundation',
  'complex_forming',
  'concrete_sealer',
  'decorative_finish',
  'additional_haul_off',
]);
const CONCRETE_QM_LEGACY_BASE_IDS = new Set(['forms', 'finish_seal', 'cleanup', 'finish_options']);

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
  const add = (id: string, pattern: RegExp, options: { allowNoteInference?: boolean } = {}) => {
    const existing = items.find((item) => item.id === id);
    const keepManualSelection = existing?.state === 'included' && existing.noteBacked !== true;
    const noteState = options.allowNoteInference === false ? null : inferItemStateFromNotes(id, notes);
    if (keepManualSelection || noteState === 'included' || pattern.test(notes)) {
      ids.add(id);
    }
  };
  add('demo_removal', /\b(?:demo|demolition|remove|tear[\s-]?out|break(?:ing)?\s+out)\b[^.;]{0,40}\b(?:concrete|slab|sidewalk|driveway|patio)\b|\b(?:concrete|slab|sidewalk|driveway|patio)\b[^.;]{0,40}\b(?:demo|demolition|remove|tear[\s-]?out)\b/);
  if (/\b(?:dirt|soil|earth)\b[^.;]{0,50}\b(?:remove|excavat|dig|cut\s*(?:\/|and)?\s*fill)\b|\b(?:remove|excavat|dig|cut\s*(?:\/|and)?\s*fill)\b[^.;]{0,50}\b(?:dirt|soil|earth)\b/.test(notes)) {
    ids.delete('demo_removal');
  }
  // A note can mention grading without supplying a priced quantity. Keep that
  // as a review item rather than silently selecting site prep in the bid.
  add(
    'site_prep',
    /\b(?:basic\s+)?(?:site\s+prep|grading|subgrade\s+prep)\b/,
    { allowNoteInference: false }
  );
  add('excavation', /\b(?:excavat(?:e|ion)|cut\s*(?:\/|and)?\s*fill|soil\s+movement|dirt|soil)\b[^.;]{0,50}\b(?:\d[\d,]*(?:\.\d+)?\s*(?:cy|cubic\s+yards?)|\d[\d,]*(?:\.\d+)?\s*(?:inches?|["″]))\b|\b(?:\d[\d,]*(?:\.\d+)?\s*(?:cy|cubic\s+yards?)|\d[\d,]*(?:\.\d+)?\s*(?:inches?|["″]))\b[^.;]{0,50}\b(?:excavat(?:e|ion)|cut\s*(?:\/|and)?\s*fill|soil\s+movement|dirt|soil)\b/);
  add('reinforcement', /\b(?:rebar|mesh|reinforc(?:e|ement))\b/);
  add('pour_foundation', /\b(?:footings?|piers?|foundation\s+pour)\b/);
  add('complex_forming', /\b(?:complex|curved|isolated|raised|thickened|step|unusual)\b[^.;]{0,30}\b(?:forms?|formwork)\b/);
  add('concrete_sealer', /\b(?:concrete\s+)?sealer\b/);
  add('decorative_finish', /\b(?:stamped|colored|exposed\s+aggregate|decorative|specialty)\s+concrete\b/);
  add('additional_haul_off', /\b(?:extra|additional|excess)\b[^.;]{0,30}\b(?:haul[\s-]?off|disposal|debris)\b/);
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
      return selected.has('site_prep');
    case 'excavation':
      return selected.has('excavation');
    case 'reinforcement':
      return selected.has('reinforcement') || selected.has('rebar');
    case 'complex_forming':
      return selected.has('complex_forming');
    case 'concrete_sealer':
      return selected.has('concrete_sealer');
    case 'decorative_finish':
      return selected.has('decorative_finish');
    case 'additional_haul_off':
      return selected.has('additional_haul_off');
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
      return positiveNumber(measurements.concreteSubgradePrepSqft) != null;
    case 'excavation':
      return positiveNumber(measurements.excavationCy) != null;
    case 'reinforcement':
    case 'concrete_sealer':
    case 'decorative_finish':
    case 'pour_flatwork':
      return positiveNumber(measurements.concreteSqft) != null;
    case 'complex_forming':
      return positiveNumber(measurements.complexFormingLf) != null;
    case 'additional_haul_off':
      return positiveNumber(measurements.additionalHaulOffLoadCount) != null;
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
  site_prep: 'Basic subgrade prep / grading',
  excavation: 'Excavation / soil movement',
  reinforcement: 'Rebar / mesh',
  pour_flatwork: 'Pour flatwork',
  pour_foundation: 'Footings / foundation',
  complex_forming: 'Complex forming',
  concrete_sealer: 'Concrete sealer',
  decorative_finish: 'Decorative finish',
  additional_haul_off: 'Additional haul-off / disposal',
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
    if (CONCRETE_QM_LEGACY_BASE_IDS.has(item.id) && item.state === 'included' && item.noteBacked === true) {
      changed = true;
      return { ...item, state: 'excluded' as const, noteBacked: false };
    }
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
  const hasExcavationQuantity = positiveNumber(ctx.measurements.excavationCy) != null;
  const manuallyIncludedSitePrep = ctx.checklistItems.some(
    (item) => item.id === 'site_prep' && item.state === 'included' && item.noteBacked !== true
  );
  const legacyIncludedByBaseFlatwork = new Set(['forms', 'finish_seal', 'cleanup', 'finish_options']);
  const withoutLegacyBaseItems = scope.filter((id) => !legacyIncludedByBaseFlatwork.has(id));
  const cleanedScope =
    hasExcavationQuantity || manuallyIncludedSitePrep
      ? withoutLegacyBaseItems
      : withoutLegacyBaseItems.filter((id) => concreteScopeCanonicalId(id) !== 'site_prep');
  const selectedFlatworkIds = cleanedScope.filter((id) => CONCRETE_FLATWORK_OPTION_IDS.has(id as ConcreteFlatworkOptionId));
  const hasAreaBreakdown = ctx.measurements.concreteAreaByType && Object.keys(ctx.measurements.concreteAreaByType).length > 0;
  return {
    ...ctx.measurements,
    concreteScope: cleanedScope.length ? cleanedScope : null,
    ...(selectedFlatworkIds.length > 1 && !hasAreaBreakdown ? { concreteSqft: null } : {}),
  };
}

export const CONCRETE_FLATWORK_OPTIONS = [
  { id: 'driveways' as const, label: 'Driveway' },
  { id: 'sidewalks' as const, label: 'Sidewalk' },
  { id: 'patios' as const, label: 'Patio' },
  { id: 'rv_pads' as const, label: 'RV pad' },
  { id: 'walkways' as const, label: 'Walkway' },
];

export const CONCRETE_SLAB_THICKNESS_OPTIONS = [
  { id: '4', label: '4 in', inches: 4 },
  { id: '5', label: '5 in', inches: 5 },
  { id: '6', label: '6 in', inches: 6 },
] as const;

export const CONCRETE_DECORATIVE_FINISH_OPTIONS = [
  { id: 'integral_color', label: 'Integral color', rate: 1.5 },
  { id: 'exposed_aggregate', label: 'Exposed aggregate', rate: 4 },
  { id: 'basic_stamped', label: 'Basic stamped', rate: 5 },
  { id: 'premium_stamped', label: 'Premium / multi-color stamped', rate: 8 },
] as const;

export const CONCRETE_DEMO_THICKNESS_OPTIONS = [
  { id: 'thin_2_3', label: '2–3 in' },
  { id: 'standard_4', label: '4 in' },
  { id: 'heavy_5_6', label: '5–6 in' },
  { id: 'structural_7_plus', label: '7+ in / structural' },
] as const;

export const CONCRETE_SCOPE_OPTIONS = [
  {
    id: 'demo_removal',
    label: 'Demo / removal',
    measurementKey: 'concreteDemoSqft' as const,
    unit: 'sqft',
    helperText: 'Existing concrete removal area. Select thickness before pricing; normal haul-off/disposal is included.',
  },
  {
    id: 'site_prep',
    label: 'Basic subgrade prep / grading',
    measurementKey: 'concreteSubgradePrepSqft' as const,
    unit: 'sqft',
    helperText: 'Optional basic leveling and compaction for the affected flatwork area. National average is $2/sqft.',
  },
  {
    id: 'excavation',
    label: 'Excavation / soil movement',
    measurementKey: 'excavationCy' as const,
    unit: 'CY',
    helperText: 'Separate excavation, cut/fill, or soil movement. Pricing includes labor and equipment. Export, haul-off, dump fees, and imported fill are separate.',
  },
  {
    id: 'reinforcement',
    label: 'Rebar / mesh',
    measurementKey: 'concreteReinforcementSqft' as const,
    unit: 'sqft',
    helperText: 'Optional reinforcement area. Defaults to the combined flatwork area when left blank.',
  },
  {
    id: 'pour_foundation',
    label: 'Footing / foundation concrete pour',
    measurementKey: 'concreteCy' as const,
    unit: 'CY',
    helperText: 'Concrete material and placement only at $350/CY. Excavation, forms, reinforcement, waterproofing, and structural accessories are separate.',
  },
  {
    id: 'complex_forming',
    label: 'Complex forming',
    measurementKey: 'complexFormingLf' as const,
    unit: 'LF',
    helperText: 'Additional curved, stepped, isolated, or unusual formwork beyond a normal perimeter.',
  },
  {
    id: 'concrete_sealer',
    label: 'Concrete sealer',
    measurementKey: 'concreteSealerSqft' as const,
    unit: 'sqft',
    helperText: 'Optional upgrade at +$1.50/sqft. Planning split: $0.60 material + $0.90 labor.',
  },
  {
    id: 'decorative_finish',
    label: 'Decorative finish',
    helperText: 'Optional add-on to standard flatwork. Select the finish type below.',
  },
  {
    id: 'additional_haul_off',
    label: 'Additional haul-off / disposal',
    measurementKey: 'additionalHaulOffLoadCount' as const,
    unit: 'load',
    helperText: 'Disposal beyond normal flatwork or demolition cleanup.',
  },
] as const;

export const concreteQmPanel: QmPanelDefinition = {
  id: 'concrete_remodel',
  templateKeys: ['concrete'],
  embeddedScopeItemIds: [...CONCRETE_QM_EMBEDDED_IDS],
  isActive: (ctx) => String(ctx.templateKey || '').toLowerCase() === 'concrete',
  hydrateMeasurements: hydrateConcrete,
  syncScopeItems: syncConcreteQmScopeItems,
};
