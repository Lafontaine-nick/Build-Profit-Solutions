import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

/** Checklist lines synced from the landscaping QM panel. */
export const LANDSCAPING_QM_SYNC_SCOPE_IDS = new Set([
  'demo_clearing',
  'grading',
  'soil_prep',
  'drainage',
  'irrigation',
  'sod_turf',
  'artificial_turf',
  'rock',
  'mulch',
  'plants',
  'trees',
  'landscape_boulders',
  'pavers',
  'concrete',
  'landscape_lighting',
  'mobilization',
  'cleanup',
]);

/** Empty — landscaping scope cards render in Confirm Scope (same as flooring). */
export const LANDSCAPING_QM_EMBEDDED_IDS = new Set<string>();

export const LANDSCAPING_CONFIRM_SCOPE_LINE_CARD_IDS = new Set([
  ...LANDSCAPING_QM_SYNC_SCOPE_IDS,
  // Legacy combined cards from older drafts.
  'rock_mulch',
  'plants_trees',
]);

const SCOPE_ID_ALIASES: Record<string, string> = {
  sod: 'sod_turf',
  decorative_boulders: 'landscape_boulders',
  concrete_edging: 'concrete',
  irrigation: 'irrigation',
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
    // Normal cleanup, haul-off, and equipment use belong to the individual
    // landscaping assembly. Only explicit extra project-level work should
    // create these separate cards.
    if (id === 'mobilization' || id === 'cleanup') {
      if (pattern.test(notes)) ids.add(id);
      return;
    }
    if (isIncluded(items, id) || inferItemStateFromNotes(id, notes) === 'included' || pattern.test(notes)) {
      ids.add(id);
    }
  };
  add('demo_clearing', /\b(?:demo|clear(?:ing)?|remove|tear[\s-]?out)\b/);
  add('grading', /\bgrading?\b/);
  add('soil_prep', /\bsoil\s+prep(?:aration)?\b/);
  add('drainage', /\bdrain(?:age|ing)\b/);
  add('irrigation', /\birrigation\b/);
  add('sod_turf', /\b(?:sod|natural\s+grass)\b/);
  add('artificial_turf', /\b(?:turf|artificial\s+grass|synthetic\s+grass)\b/);
  add('rock', /\b(?:rock|gravel)\b/);
  add('mulch', /\bmulch\b/);
  add('plants', /\b(?:plants?|shrubs?|planting)\b/);
  add('trees', /\btrees?\b/);
  add('landscape_boulders', /\b(?:landscape\s+)?boulders?\b/);
  add('pavers', /\bpavers?\b/);
  add('concrete', /\bconcrete\s+(?:edging|flatwork|curb)|\bedging\b/);
  add('landscape_lighting', /\blandscape\s+lighting\b/);
  add(
    'mobilization',
    /\b(?:dedicated|extra|additional|specialty)\b[^.;]{0,50}\b(?:mobilization|skid[\s-]?steer|excavator|compactor|crane|equipment)\b|\b(?:mobilization|skid[\s-]?steer|excavator|compactor|crane)\s+(?:rental|charge|delivery)\b/
  );
  add(
    'cleanup',
    /\b(?:extra|additional|multiple|large|extraordinary)\b[^.;]{0,50}\b(?:cleanup|haul[\s-]?off|disposal|dumpster|dump trailer|dump runs?)\b|\b(?:dumpster|dump trailer|multiple dump runs?|extraordinary disposal)\b/
  );
  return [...ids];
}

export function readLandscapingScope(m: Record<string, unknown>): string[] {
  return Array.isArray(m.landscapeScope) ? m.landscapeScope.map(String) : [];
}

function scopeSelectionActivatesItem(itemId: string, scope: string[]): boolean {
  const selected = new Set(scope);
  const canonical = new Set(scope.map(landscapingScopeCanonicalId));
  if (canonical.has(itemId)) return true;
  switch (itemId) {
    case 'sod_turf':
      return selected.has('sod');
    case 'artificial_turf':
      return selected.has('artificial_turf');
    case 'rock':
      return selected.has('rock');
    case 'mulch':
      return selected.has('mulch');
    case 'plants':
      return selected.has('plants');
    case 'trees':
      return selected.has('trees');
    case 'landscape_boulders':
      return selected.has('decorative_boulders') || selected.has('landscape_boulders');
    case 'concrete':
      return selected.has('concrete_edging');
    // Legacy combined cards.
    case 'rock_mulch':
      return (
        selected.has('rock') ||
        selected.has('mulch') ||
        selected.has('decorative_boulders')
      );
    case 'plants_trees':
      return selected.has('plants') || selected.has('trees');
    default:
      return selected.has(itemId);
  }
}

export function isLandscapingQmScopeItemActive(
  itemId: string,
  measurements: Record<string, unknown>
): boolean {
  const rawScope = measurements.landscapeScope;
  const scope = readLandscapingScope(measurements);
  // Once the user has interacted with the landscaping scope selector, the
  // selection list is authoritative. A previous sqft value must not bring a
  // deselected card back.
  if (Array.isArray(rawScope)) {
    return scopeSelectionActivatesItem(itemId, scope);
  }
  switch (itemId) {
    case 'demo_clearing':
      return positiveNumber(measurements.demoClearingSqft) != null;
    case 'grading':
      return positiveNumber(measurements.gradingSqft) != null;
    case 'soil_prep':
      return positiveNumber(measurements.soilPrepSqft) != null;
    case 'drainage':
      return positiveNumber(measurements.drainageLf) != null;
    case 'sod_turf':
      return positiveNumber(measurements.sodSqft) != null;
    case 'artificial_turf':
      return positiveNumber(measurements.artificialTurfSqft) != null;
    case 'pavers':
      return positiveNumber(measurements.paverSqft) != null;
    case 'rock':
    case 'rock_mulch':
      return (
        positiveNumber(measurements.rockMulchSqft) != null ||
        positiveNumber(measurements.landscapeTons) != null ||
        positiveNumber(measurements.boulderCount) != null
      );
    case 'mulch':
      return positiveNumber(measurements.rockMulchSqft) != null;
    case 'plants':
    case 'plants_trees':
      return positiveNumber(measurements.plantCount) != null;
    case 'trees':
      return positiveNumber(measurements.treeCount) != null;
    case 'landscape_boulders':
      return positiveNumber(measurements.boulderCount) != null;
    case 'irrigation':
      return positiveNumber(measurements.irrigationZoneCount) != null;
    case 'concrete':
      return positiveNumber(measurements.concreteEdgingLf) != null;
    case 'landscape_lighting':
      return positiveNumber(measurements.landscapeLightCount) != null;
    default:
      return false;
  }
}

export function shouldUseLandscapingConfirmScopeLineCard(
  templateKey: string | null | undefined,
  item: Pick<ScopeChecklistItem, 'id' | 'state' | 'noteBacked'>
): boolean {
  return (
    String(templateKey || '').toLowerCase() === 'landscaping' &&
    LANDSCAPING_CONFIRM_SCOPE_LINE_CARD_IDS.has(item.id) &&
    item.state === 'included' &&
    item.noteBacked === true
  );
}

export function isLandscapingConfirmScopePricingCard(itemId: string | null | undefined): boolean {
  return LANDSCAPING_CONFIRM_SCOPE_LINE_CARD_IDS.has(String(itemId || ''));
}

const LANDSCAPING_SCOPE_ITEM_LABELS: Record<string, string> = {
  artificial_turf: 'Artificial turf',
  sod_turf: 'Sod',
  rock: 'Decorative rock',
  mulch: 'Mulch',
  plants: 'Plants / shrubs',
  trees: 'Trees',
  landscape_boulders: 'Decorative boulders',
};

export function syncLandscapingQmScopeItems(
  items: ScopeChecklistItem[],
  measurements: Record<string, unknown>
): ScopeChecklistItem[] {
  const included = new Set<string>();
  for (const id of LANDSCAPING_QM_SYNC_SCOPE_IDS) {
    if (isLandscapingQmScopeItemActive(id, measurements)) included.add(id);
  }

  let changed = false;
  const next = items.map((item) => {
    if (!LANDSCAPING_QM_SYNC_SCOPE_IDS.has(item.id) && !['rock_mulch', 'plants_trees'].includes(item.id)) {
      return item;
    }
    if (LANDSCAPING_QM_SYNC_SCOPE_IDS.has(item.id)) {
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
    }
    // Hide legacy combined cards when the split cards are active.
    if (['rock_mulch', 'plants_trees'].includes(item.id)) {
      const replacementActive =
        item.id === 'rock_mulch'
          ? included.has('rock') || included.has('mulch')
          : included.has('plants') || included.has('trees');
      if (replacementActive && item.state === 'included') {
        changed = true;
        return { ...item, state: 'excluded' as const, noteBacked: false };
      }
    }
    return item;
  });

  // Migrate existing landscaping drafts created before newer QM-backed
  // checklist items were added (for example, artificial turf, trees).
  for (const itemId of LANDSCAPING_QM_SYNC_SCOPE_IDS) {
    if (!included.has(itemId) || next.some((item) => item.id === itemId)) continue;
    next.push({
      id: itemId,
      label: LANDSCAPING_SCOPE_ITEM_LABELS[itemId] || itemId.replace(/_/g, ' '),
      inputType: 'yes_no',
      state: 'included',
      category: 'landscape',
      noteBacked: true,
    });
    changed = true;
  }

  return changed ? next : items;
}

function hydrateLandscaping(ctx: QmPanelHydrateContext): Record<string, unknown> {
  const saved = readLandscapingScope(ctx.measurements);
  const inferred = inferredScope(String(ctx.notes || '').toLowerCase(), ctx.checklistItems);
  const notes = String(ctx.notes || '').toLowerCase();
  const notesDescribeArtificialTurf =
    /\b(?:fake|artificial|synthetic)\s+(?:grass|turf)\b|\bartificial\s+turf\b/.test(notes) &&
    !/\b(?:natural\s+)?sod\b/.test(notes);
  const migratedSaved = notesDescribeArtificialTurf
    ? saved.map((id) => (id === 'sod' || id === 'sod_turf' ? 'artificial_turf' : id))
    : saved;
  const scope = migratedSaved.length ? migratedSaved : inferred;
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
