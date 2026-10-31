/**
 * One interpretation of the contractor note. Downstream screens read this
 * object instead of re-deriving scope from the raw sentence.
 */
import { notesDescribeDedicatedFlooringJob } from '@/utils/flooringNoteScope';
import { notesOwnerHandlesFlooringDemo } from '@/utils/flooringOwnerDemoNote';
import { notesNameWallAreaFramingWithFlooring } from '@/utils/subcontractorTrade/framingPlanConvergence';
import {
  noteKeepsItsOwnChecklist,
  notesDescribeMixedProjectScope,
  readNoteWork,
} from '@/utils/noteClauseReader';
import { notesOwnerHandlesScopeCategory } from '@/utils/scopeItemNoteHints';
import { wholeHomeRemodelNamedItemIds } from '@/utils/wholeHomeRemodelNote';

export const CANONICAL_SCOPE_SCHEMA_VERSION = 1 as const;

export type CanonicalScopeStatus = 'included' | 'excluded' | 'unknown';
export type CanonicalScopeResponsibility =
  | 'contractor'
  | 'owner'
  | 'others'
  | 'unknown';

export type CanonicalScopeItem = {
  id: string;
  action?: string | null;
  object?: string | null;
  status: CanonicalScopeStatus;
  responsibility: CanonicalScopeResponsibility;
  quantity?: number | null;
  unit?: string | null;
  location?: string | null;
  catalogMatch?: string | null;
  evidence?: string | null;
  confidence?: 'low' | 'medium' | 'high' | null;
  source: 'notes' | 'user' | 'clarification';
};

export type CanonicalScope = {
  schemaVersion: typeof CANONICAL_SCOPE_SCHEMA_VERSION;
  notesFingerprint: string;
  items: CanonicalScopeItem[];
};

const FLOOR_DEMO_IDS = ['floor_demo'];
const FLOOR_DEMO_STYLE_PREFIX = 'floor_demo_style_';
const FLOOR_DEMO_MEASUREMENT_KEYS = [
  'floorDemoSqft',
  'flooringDemoScopeCount',
  'flooringExistingCount',
  'flooringExistingTypes',
];

const OWNER_CATEGORY_IDS: Array<{
  id: string;
  category: 'sitework' | 'utilities' | 'landscaping';
}> = [
  { id: 'sitework', category: 'sitework' },
  { id: 'excavation', category: 'sitework' },
  { id: 'grading', category: 'sitework' },
  { id: 'utility_taps', category: 'utilities' },
  { id: 'utility_trenching', category: 'utilities' },
  { id: 'landscaping', category: 'landscaping' },
];

export function notesFingerprint(notes: string | null | undefined): string {
  return String(notes || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function itemId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function isFloorDemoScopeId(id: string): boolean {
  return (
    FLOOR_DEMO_IDS.includes(id) || id.startsWith(FLOOR_DEMO_STYLE_PREFIX)
  );
}

export function canonicalScopeExcludedIds(
  scope: CanonicalScope | null | undefined
): Set<string> {
  const ids = new Set<string>();
  for (const item of scope?.items || []) {
    if (item.status === 'excluded' && item.id) ids.add(item.id);
  }
  return ids;
}

export function canonicalItemIsExcluded(
  scope: CanonicalScope | null | undefined,
  id: string
): boolean {
  const key = itemId(id);
  if (!key) return false;
  return (scope?.items || []).some(
    item => itemId(item.id) === key && item.status === 'excluded'
  );
}

const EXCLUDED_ID_ALIASES: Record<string, string[]> = {
  floor_demo: ['floor_demo', 'existing_floor_removal'],
  drywall_hang: ['drywall_hang', 'hang'],
  interior_paint: ['interior_paint', 'paint', 'paint_repair'],
  electrical: ['electrical', 'electrical_rough'],
  plumbing: ['plumbing'],
  hvac: ['hvac', 'furnace', 'equipment_replace'],
  appliances: ['appliances', 'appliance_removal'],
  windows: ['windows', 'window_install'],
  excavation: ['excavation', 'sitework'],
  grading: ['grading', 'sitework'],
};

const MEASUREMENT_KEY_TO_SCOPE_ID: Record<string, string> = {
  floorDemoSqft: 'floor_demo',
  flooringDemoScopeCount: 'floor_demo',
  flooringExistingCount: 'floor_demo',
  flooringExistingTypes: 'floor_demo',
  excavationCy: 'excavation',
  landscapingSf: 'landscaping',
  landscapingSqft: 'landscaping',
  windowCount: 'windows',
  wallPaintSqft: 'interior_paint',
  paintAreaSqft: 'interior_paint',
};

/** Confirm Scope, QM, and pricing all use this. Excluded ids stay off those screens. */
export function canonicalScopeBlocksItemId(
  scope: CanonicalScope | null | undefined,
  id: string | null | undefined
): boolean {
  const key = itemId(id);
  if (!key || !scope) return false;
  if (canonicalItemIsExcluded(scope, key)) return true;
  if (isFloorDemoScopeId(key) && canonicalItemIsExcluded(scope, 'floor_demo')) {
    return true;
  }
  for (const [canonicalId, aliases] of Object.entries(EXCLUDED_ID_ALIASES)) {
    if (
      aliases.includes(key) &&
      canonicalItemIsExcluded(scope, canonicalId)
    ) {
      return true;
    }
  }
  return false;
}

export function filterChecklistByCanonicalScope<
  T extends { id?: string | null },
>(items: T[], scope: CanonicalScope | null | undefined): T[] {
  if (!scope || !items.length) return items;
  return items.filter(item => !canonicalScopeBlocksItemId(scope, item.id));
}

export function canonicalScopeBlocksMeasurementKey(
  scope: CanonicalScope | null | undefined,
  key: string | null | undefined
): boolean {
  const measurementKey = String(key || '');
  if (!measurementKey || !scope) return false;
  if (
    (measurementKey === 'floorDemoSqft' ||
      measurementKey.startsWith('floor_demo')) &&
    canonicalItemIsExcluded(scope, 'floor_demo')
  ) {
    return true;
  }
  const mapped = MEASUREMENT_KEY_TO_SCOPE_ID[measurementKey];
  return mapped ? canonicalScopeBlocksItemId(scope, mapped) : false;
}

export function filterQmRowsByCanonicalScope<
  T extends { key?: string | null },
>(rows: T[][], scope: CanonicalScope | null | undefined): T[][] {
  if (!scope) return rows;
  return rows
    .map(row => row.filter(field => !canonicalScopeBlocksMeasurementKey(scope, field.key)))
    .filter(row => row.length > 0);
}

function upsertItem(
  items: Map<string, CanonicalScopeItem>,
  next: CanonicalScopeItem
): void {
  const id = itemId(next.id);
  if (!id) return;
  const current = items.get(id);
  if (!current) {
    items.set(id, { ...next, id });
    return;
  }
  const statusRank: Record<CanonicalScopeStatus, number> = {
    excluded: 3,
    included: 2,
    unknown: 1,
  };
  const keepExcluded = current.status === 'excluded' || next.status === 'excluded';
  items.set(id, {
    ...current,
    ...next,
    id,
    status: keepExcluded
      ? 'excluded'
      : statusRank[next.status] >= statusRank[current.status]
        ? next.status
        : current.status,
    responsibility:
      next.responsibility !== 'unknown'
        ? next.responsibility
        : current.responsibility,
    evidence: next.evidence || current.evidence,
    quantity: next.quantity ?? current.quantity,
    unit: next.unit || current.unit,
    catalogMatch: next.catalogMatch || current.catalogMatch || id,
  });
}

function noteDrivenInclusions(notes: string): CanonicalScopeItem[] {
  const items: CanonicalScopeItem[] = readNoteWork(notes).lines.map(line => ({
    id: line.id,
    status: 'included' as const,
    responsibility: 'contractor' as const,
    quantity: line.quantity,
    unit: line.unit,
    catalogMatch: line.id,
    evidence: line.label,
    source: 'notes' as const,
    confidence: 'high' as const,
  }));
  const named = wholeHomeRemodelNamedItemIds(notes);
  if (named) {
    for (const id of named) {
      if (items.some(item => item.id === id)) continue;
      items.push({
        id,
        status: 'included',
        responsibility: 'contractor',
        catalogMatch: id,
        evidence: id,
        source: 'notes',
        confidence: 'medium',
      });
    }
  }
  return items;
}

function noteDrivenExclusions(notes: string): CanonicalScopeItem[] {
  const items: CanonicalScopeItem[] = [];
  if (notesOwnerHandlesFlooringDemo(notes)) {
    items.push({
      id: 'floor_demo',
      action: 'remove',
      object: 'existing_flooring',
      status: 'excluded',
      responsibility: 'owner',
      catalogMatch: 'floor_demo',
      evidence: 'Owner or homeowner is handling flooring removal.',
      source: 'notes',
      confidence: 'high',
    });
  }
  for (const { id, category } of OWNER_CATEGORY_IDS) {
    if (!notesOwnerHandlesScopeCategory(notes, category)) continue;
    items.push({
      id,
      status: 'excluded',
      responsibility: 'owner',
      catalogMatch: id,
      evidence: `Owner is handling ${category}.`,
      source: 'notes',
      confidence: 'high',
    });
  }
  for (const id of readNoteWork(notes).excludedIds) {
    items.push({
      id,
      status: 'excluded',
      responsibility: 'unknown',
      catalogMatch: id,
      evidence: 'Explicitly excluded in the notes.',
      source: 'notes',
      confidence: 'high',
    });
  }
  if (/\bno\s+new\s+hang\b/i.test(notes)) {
    items.push({
      id: 'drywall_hang',
      action: 'install',
      object: 'drywall',
      status: 'excluded',
      responsibility: 'unknown',
      catalogMatch: 'hang',
      evidence: 'No new hang.',
      source: 'notes',
      confidence: 'high',
    });
  }
  return items;
}

type ChecklistLike = {
  id?: string | null;
  state?: string | null;
  sourceText?: string | null;
  catalogScopeId?: string | null;
};

type FactLike = {
  scopeId?: string | null;
  action?: string | null;
  object?: string | null;
  excluded?: boolean;
  status?: string | null;
  quantity?: number | null;
  unit?: string | null;
  sourceText?: string | null;
};

export function buildCanonicalScope(input: {
  notes?: string | null;
  checklistItems?: ChecklistLike[] | null;
  scopeFacts?: FactLike[] | null;
  existing?: CanonicalScope | null;
}): CanonicalScope {
  const notes = String(input.notes || '');
  const fingerprint = notesFingerprint(notes);
  const items = new Map<string, CanonicalScopeItem>();

  if (
    input.existing?.schemaVersion === CANONICAL_SCOPE_SCHEMA_VERSION &&
    input.existing.notesFingerprint === fingerprint
  ) {
    for (const item of input.existing.items || []) {
      upsertItem(items, item);
    }
  }

  for (const fact of input.scopeFacts || []) {
    const id = itemId(fact.scopeId);
    if (!id) continue;
    const excluded =
      Boolean(fact.excluded) || String(fact.status || '') === 'excluded';
    upsertItem(items, {
      id,
      action: fact.action || null,
      object: fact.object || null,
      status: excluded ? 'excluded' : 'included',
      responsibility: excluded ? 'unknown' : 'contractor',
      quantity: fact.quantity ?? null,
      unit: fact.unit || null,
      catalogMatch: id,
      evidence: fact.sourceText || null,
      source: 'notes',
      confidence: 'medium',
    });
  }

  for (const row of input.checklistItems || []) {
    const id = itemId(row.id);
    if (!id) continue;
    const state = String(row.state || '');
    if (state !== 'included' && state !== 'excluded') continue;
    upsertItem(items, {
      id,
      status: state,
      responsibility: state === 'excluded' ? 'unknown' : 'contractor',
      catalogMatch: row.catalogScopeId || id,
      evidence: row.sourceText || null,
      source: 'notes',
      confidence: 'medium',
    });
  }

  for (const item of noteDrivenInclusions(notes)) {
    upsertItem(items, item);
  }
  for (const item of noteDrivenExclusions(notes)) {
    upsertItem(items, item);
  }

  return {
    schemaVersion: CANONICAL_SCOPE_SCHEMA_VERSION,
    notesFingerprint: fingerprint,
    items: [...items.values()],
  };
}

export function resolveCanonicalScopeForNotes(
  notes?: string | null,
  existing?: CanonicalScope | null
): CanonicalScope {
  return buildCanonicalScope({ notes, existing });
}

function namedIncludedIdsFromNotes(notes?: string | null): Set<string> {
  return new Set(
    noteDrivenInclusions(String(notes || ''))
      .filter(item => item.status === 'included')
      .map(item => itemId(item.id))
      .filter(Boolean)
  );
}

function itemMatchesNamedIncluded(id: string, named: Set<string>): boolean {
  if (!id) return false;
  if (id.startsWith('custom_')) return true;
  if (named.has(id)) return true;
  if (isFloorDemoScopeId(id) && named.has('floor_demo')) return true;
  for (const [canonicalId, aliases] of Object.entries(EXCLUDED_ID_ALIASES)) {
    if (named.has(canonicalId) && aliases.includes(id)) return true;
  }
  return false;
}

function shouldRestrictChecklistToNamedNotes(notes?: string | null): boolean {
  const text = String(notes || '');
  if (!namedIncludedIdsFromNotes(text).size) return false;
  if (noteKeepsItsOwnChecklist(text)) return false;
  if (notesDescribeMixedProjectScope(text)) return false;
  if (wholeHomeRemodelNamedItemIds(text)) return false;
  if (notesDescribeDedicatedFlooringJob(text)) return false;
  if (notesNameWallAreaFramingWithFlooring(text)) return false;
  if (
    /\b(?:kitchen|kitch|cabs?|cabinets?|backsplash|bath(?:room)?|shower|vanity|toilet|prefab)\b/i.test(
      text
    )
  ) {
    return false;
  }
  return true;
}

export function applyCanonicalScopeToChecklistItems<
  T extends { id?: string | null; state?: string | null; label?: string | null },
>(items: T[], notes?: string | null, existing?: CanonicalScope | null): T[] {
  const scope = buildCanonicalScope({
    notes,
    checklistItems: items,
    existing,
  });
  let next = filterChecklistByCanonicalScope(items, scope);
  const named = namedIncludedIdsFromNotes(notes);
  const restrict = shouldRestrictChecklistToNamedNotes(notes);
  if (restrict) {
    next = next.filter(item =>
      itemMatchesNamedIncluded(itemId(item.id), named)
    );
  }
  const seen = new Set(next.map(item => itemId(item.id)));
  for (const item of scope.items) {
    if (item.status !== 'included') continue;
    if (canonicalScopeBlocksItemId(scope, item.id)) continue;
    if (restrict && !itemMatchesNamedIncluded(item.id, named)) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next = [
      ...next,
      {
        id: item.id,
        label: item.evidence || item.id,
        state: 'included',
      } as T,
    ];
  }
  return next;
}

export function stripCanonicalExcludedMeasurements<
  T extends Record<string, unknown>,
>(measurements: T | null | undefined, scope: CanonicalScope | null | undefined): T {
  const next = { ...(measurements || {}) } as Record<string, unknown>;
  const excluded = canonicalScopeExcludedIds(scope);
  if (!excluded.size) return next as T;
  if (excluded.has('floor_demo')) {
    for (const key of FLOOR_DEMO_MEASUREMENT_KEYS) delete next[key];
  }
  for (const [measurementKey, scopeId] of Object.entries(
    MEASUREMENT_KEY_TO_SCOPE_ID
  )) {
    if (canonicalScopeBlocksItemId(scope, scopeId)) delete next[measurementKey];
  }
  const quantities = {
    ...((next.itemQuantities as Record<string, unknown>) || {}),
  };
  for (const key of Object.keys(quantities)) {
    const itemIdFromKey = key.split('__')[0];
    if (
      canonicalScopeBlocksItemId(scope, itemIdFromKey) ||
      canonicalScopeBlocksMeasurementKey(scope, key)
    ) {
      delete quantities[key];
    }
  }
  next.itemQuantities = quantities;
  return next as T;
}

export function applyCanonicalIncludedMeasurements<
  T extends Record<string, unknown>,
>(
  measurements: T | null | undefined,
  scope: CanonicalScope | null | undefined,
  notes?: string | null
): T {
  const next = { ...(measurements || {}) } as Record<string, unknown>;
  if (!scope) return next as T;
  for (const line of readNoteWork(notes).lines) {
    if (canonicalScopeBlocksItemId(scope, line.id)) continue;
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    for (const key of line.measurementKeys) {
      if (!key || canonicalScopeBlocksMeasurementKey(scope, key)) continue;
      const current = Number(
        String(next[key] ?? '').replace(/,/g, '')
      );
      if (Number.isFinite(current) && current > 0) continue;
      next[key] = quantity;
    }
  }
  return next as T;
}

export function finalizeCanonicalScope<
  T extends {
    originalNotes?: string | null;
    canonicalScope?: CanonicalScope | null;
    scopeChecklist?: {
      items?: ChecklistLike[];
      scopeFacts?: FactLike[];
    } | null;
    scopeMeasurements?: Record<string, unknown> | null;
  },
>(draft: T, notes?: string | null): T {
  const text = String(notes || draft.originalNotes || '');
  const scope = buildCanonicalScope({
    notes: text,
    checklistItems: draft.scopeChecklist?.items,
    scopeFacts: draft.scopeChecklist?.scopeFacts,
    existing: draft.canonicalScope,
  });
  const items = applyCanonicalScopeToChecklistItems(
    (draft.scopeChecklist?.items || []) as ChecklistLike[],
    text,
    scope
  );
  return {
    ...draft,
    canonicalScope: scope,
    scopeChecklist: draft.scopeChecklist
      ? {
          ...draft.scopeChecklist,
          items,
        }
      : draft.scopeChecklist,
    scopeMeasurements: applyCanonicalIncludedMeasurements(
      stripCanonicalExcludedMeasurements(
        draft.scopeMeasurements || {},
        scope
      ),
      scope,
      text
    ),
  };
}
