import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { inferChoiceFromNotes, inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import {
  BATHROOM_VANITY_COUNTERTOP_MATERIAL_OPTIONS,
  bathroomVanityCountertopScopeLabel,
  inferBathroomVanityCountertopMaterialFromNotes,
  resolveBathroomVanityCountertopMaterialType,
} from '@/utils/bathroomVanityCountertopPricing';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

function checklistRowInScope(item: ScopeChecklistItem): boolean {
  if (item.inputType === 'multi_choice') {
    const ids = item.choiceIds ?? [];
    if (!ids.length || ids.includes('not_in_scope') || ids.includes('unsure')) return false;
    if (ids.includes('no_changes') && !ids.some((id) => id === 'remove' || id === 'add')) return false;
    return ids.some((id) => id === 'remove' || id === 'add');
  }
  if (item.inputType === 'choice') {
    return Boolean(item.choiceId && item.choiceId !== 'not_in_scope' && item.choiceId !== 'unsure');
  }
  return item.state === 'included';
}

function positiveCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export type BathroomExistingFixtureCounts = {
  bathroomExistingVanityCount: number | null;
  bathroomExistingCounterCount: number | null;
};

export type BathroomInstallFixtureCounts = {
  bathroomInstallVanityCount: number | null;
  bathroomInstallCounterCount: number | null;
};

export type BathroomDemoFixtureCounts = {
  bathroomDemoVanityCount: number | null;
  bathroomDemoCounterCount: number | null;
};

export type BathroomFixtureDemoOverrideKey = keyof BathroomDemoFixtureCounts;

export const BATHROOM_FIXTURES_QM_EMBEDDED_IDS = new Set([
  'vanity',
  'countertops',
  'vanity_demo',
  'countertop_demo',
]);

/** Show the normal Confirm Scope pricing card when QM steppers or checklist say this line is in scope. */
export function bathroomFixtureScopeCardVisible(
  itemId: string,
  measurements: Record<string, unknown>,
  items?: ScopeChecklistItem[]
): boolean {
  if (!BATHROOM_FIXTURES_QM_EMBEDDED_IDS.has(itemId)) return false;

  const install = readBathroomInstallFixtureCounts(measurements);
  const demo = readBathroomDemoFixtureCounts(measurements);
  if (itemId === 'vanity' && positiveCount(install.bathroomInstallVanityCount) != null) return true;
  if (itemId === 'countertops' && positiveCount(install.bathroomInstallCounterCount) != null) {
    return true;
  }
  if (itemId === 'vanity_demo' && positiveCount(demo.bathroomDemoVanityCount) != null) return true;
  if (itemId === 'countertop_demo' && positiveCount(demo.bathroomDemoCounterCount) != null) {
    return true;
  }

  const row = items?.find((r) => r.id === itemId);
  return Boolean(row && checklistRowInScope(row));
}

/** Hide from the scope list only while QM embed is active and the line is not in scope yet. */
export function shouldHideBathroomFixtureScopeCardInQmEmbed(
  itemId: string,
  measurements: Record<string, unknown>,
  items?: ScopeChecklistItem[]
): boolean {
  if (!BATHROOM_FIXTURES_QM_EMBEDDED_IDS.has(itemId)) return false;
  return !bathroomFixtureScopeCardVisible(itemId, measurements, items);
}

const FIXTURE_QM_SCOPE_LABELS: Record<string, { label: string; helperText: string }> = {
  vanity: {
    label: 'New vanity',
    helperText: 'Vanity cabinet supply and install — labor and materials.',
  },
  countertops: {
    label: 'New countertop',
    helperText: 'Enter countertop sqft and material type in Vanity & countertop measurements.',
  },
  vanity_demo: {
    label: 'Remove vanity',
    helperText: 'Demo and haul off the existing vanity cabinet — not the top alone.',
  },
  countertop_demo: {
    label: 'Remove countertop',
    helperText: 'Demo and haul off the existing vanity top or bathroom counter.',
  },
};

function defaultBathroomFixtureScopeRow(id: string): ScopeChecklistItem {
  const copy = FIXTURE_QM_SCOPE_LABELS[id];
  return {
    id,
    label: copy?.label || id,
    helperText: copy?.helperText,
    inputType: 'yes_no',
    state: 'included',
    category: id.endsWith('_demo') ? 'demo' : 'fixtures',
  };
}

/**
 * When Vanity & countertop QM steppers are set, expose one pricing card per line
 * (New vanity, New countertop, Remove vanity, Remove countertop).
 */
export function expandBathroomFixtureScopeDisplayItems(
  items: ScopeChecklistItem[],
  measurements: Record<string, unknown>,
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (String(templateKey || '').toLowerCase() !== 'bathroom') return items;

  const install = readBathroomInstallFixtureCounts(measurements);
  const demo = readBathroomDemoFixtureCounts(measurements);
  const active: Array<{ id: keyof typeof FIXTURE_QM_SCOPE_LABELS; patch: Partial<ScopeChecklistItem> }> =
    [];
  if (positiveCount(install.bathroomInstallVanityCount) != null) {
    active.push({ id: 'vanity', patch: { inputType: 'yes_no', state: 'included', choiceId: null } });
  }
  if (positiveCount(install.bathroomInstallCounterCount) != null) {
    active.push({ id: 'countertops', patch: { inputType: 'yes_no', state: 'included' } });
  }
  if (positiveCount(demo.bathroomDemoVanityCount) != null) {
    active.push({ id: 'vanity_demo', patch: { inputType: 'yes_no', state: 'included' } });
  }
  if (positiveCount(demo.bathroomDemoCounterCount) != null) {
    active.push({ id: 'countertop_demo', patch: { inputType: 'yes_no', state: 'included' } });
  }
  if (!active.length) return items;

  const next = items.map((row) => ({ ...row }));
  for (const { id, patch } of active) {
    const copy = FIXTURE_QM_SCOPE_LABELS[id];
    const idx = next.findIndex((r) => r.id === id);
    const base = idx >= 0 ? next[idx] : defaultBathroomFixtureScopeRow(id);
    let row: ScopeChecklistItem = {
      ...base,
      ...patch,
      label: copy.label,
      helperText: copy.helperText,
    };
    if (id === 'countertops') {
      const materialType = resolveBathroomVanityCountertopMaterialType({
        storedType: measurements.bathroomVanityCountertopMaterialType,
        choiceId: base.choiceId,
        notes: undefined,
      });
      const display = bathroomVanityCountertopScopeLabel(materialType);
      row = {
        ...row,
        label: display.label,
        helperText: display.helperText,
      };
      if (materialType === 'unknown') {
        row = {
          ...row,
          inputType: 'choice',
          options: BATHROOM_VANITY_COUNTERTOP_MATERIAL_OPTIONS.map((opt) => ({
            id: opt.id,
            label: opt.label,
          })),
          choiceId: base.choiceId ?? null,
          state: base.choiceId ? 'included' : row.state,
        };
      }
    }
    if (idx >= 0) next[idx] = row;
    else next.push(row);
  }
  return next;
}

const EXISTING_KEYS: (keyof BathroomExistingFixtureCounts)[] = [
  'bathroomExistingVanityCount',
  'bathroomExistingCounterCount',
];

const INSTALL_KEYS: (keyof BathroomInstallFixtureCounts)[] = [
  'bathroomInstallVanityCount',
  'bathroomInstallCounterCount',
];

const DEMO_KEYS: (keyof BathroomDemoFixtureCounts)[] = [
  'bathroomDemoVanityCount',
  'bathroomDemoCounterCount',
];

export function readBathroomExistingFixtureCounts(
  m: Record<string, unknown>
): BathroomExistingFixtureCounts {
  return {
    bathroomExistingVanityCount: positiveCount(m.bathroomExistingVanityCount),
    bathroomExistingCounterCount: positiveCount(m.bathroomExistingCounterCount),
  };
}

export function readBathroomInstallFixtureCounts(
  m: Record<string, unknown>
): BathroomInstallFixtureCounts {
  return {
    bathroomInstallVanityCount: positiveCount(m.bathroomInstallVanityCount),
    bathroomInstallCounterCount: positiveCount(m.bathroomInstallCounterCount),
  };
}

export function readBathroomDemoFixtureCounts(
  m: Record<string, unknown>
): BathroomDemoFixtureCounts {
  return {
    bathroomDemoVanityCount: positiveCount(m.bathroomDemoVanityCount),
    bathroomDemoCounterCount: positiveCount(m.bathroomDemoCounterCount),
  };
}

export function emptyBathroomExistingFixtureCounts(): BathroomExistingFixtureCounts {
  return {
    bathroomExistingVanityCount: null,
    bathroomExistingCounterCount: null,
  };
}

function notesMentionExistingVanity(n: string): boolean {
  return (
    /\b(existing|current|old)\s+vanity\b/.test(n) ||
    /\b(existing|current|old)\s+bath(?:room)?\s+cabinets?\b/.test(n)
  );
}

function notesMentionExistingCounter(n: string): boolean {
  return /\b(existing|current|old)\s+(?:vanity\s+)?(?:countertops?|counters?|top)\b/.test(n);
}

function notesMentionDemoVanity(n: string): boolean {
  return (
    /\b(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\bvanity\b/.test(
      n
    ) || /\bvanity\b[^.]{0,50}\b(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/.test(n)
  );
}

function notesMentionDemoCountertop(n: string): boolean {
  return (
    /\b(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\b(countertops?|counters?)\b/.test(
      n
    ) ||
    /\b(countertops?|counters?)\b[^.]{0,50}\b(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/.test(
      n
    )
  );
}

export function inferExistingBathroomFixturesFromNotes(
  notes: string | null | undefined
): BathroomExistingFixtureCounts {
  const n = String(notes || '').toLowerCase();
  const out = emptyBathroomExistingFixtureCounts();
  if (notesMentionExistingVanity(n)) out.bathroomExistingVanityCount = 1;
  if (notesMentionExistingCounter(n)) out.bathroomExistingCounterCount = 1;
  return out;
}

function checklistIncluded(items: ScopeChecklistItem[], id: string): boolean {
  return items.find((r) => r.id === id)?.state === 'included';
}

export function inferBathroomFixtureInstallFromIntent(params: {
  notes?: string | null;
  checklistItems?: ScopeChecklistItem[];
}): BathroomInstallFixtureCounts {
  const n = String(params.notes || '').toLowerCase();
  const items = params.checklistItems || [];
  const out: BathroomInstallFixtureCounts = {
    bathroomInstallVanityCount: null,
    bathroomInstallCounterCount: null,
  };
  const vanityRow = items.find((r) => r.id === 'vanity');
  const vanityReplacing =
    (vanityRow?.state === 'included' && vanityRow.choiceId === 'replacing') ||
    inferChoiceFromNotes('vanity', params.notes) === 'replacing' ||
    /\b(new|replace|install)\b[^.]{0,40}\bvanity\b/.test(n) ||
    /\bvanity\b[^.]{0,40}\b(replace|new|install)\b/.test(n);
  if (vanityReplacing && !/\b(keep|keeping|stay|staying|reuse|reusing)\b[^.]{0,30}\bvanity\b/.test(n)) {
    out.bathroomInstallVanityCount = 1;
  }
  if (
    checklistIncluded(items, 'countertops') ||
    inferItemStateFromNotes('countertops', n) === 'included' ||
    /\b(new|replace|install)\b[^.]{0,40}\b(countertops?|counters?|quartz|granite|vanity\s+top)\b/.test(n) ||
    /\b(countertops?|counters?|quartz|granite|vanity\s+top)\b[^.]{0,40}\b(replace|new|install)\b/.test(n)
  ) {
    out.bathroomInstallCounterCount = 1;
  }
  return out;
}

function shouldDemoVanity(params: {
  notes: string;
  existing: BathroomExistingFixtureCounts;
  install: BathroomInstallFixtureCounts;
  items: ScopeChecklistItem[];
  vanityDemoIncluded?: boolean;
}): boolean {
  const { notes: n, existing: ex, install: ins, items } = params;
  const hasExisting = positiveCount(ex.bathroomExistingVanityCount) != null;
  const installing = positiveCount(ins.bathroomInstallVanityCount) != null;
  return (
    Boolean(params.vanityDemoIncluded) ||
    checklistIncluded(items, 'vanity_demo') ||
    inferItemStateFromNotes('vanity_demo', n) === 'included' ||
    (hasExisting && notesMentionDemoVanity(n)) ||
    (hasExisting && installing)
  );
}

function shouldDemoCountertop(params: {
  notes: string;
  existing: BathroomExistingFixtureCounts;
  install: BathroomInstallFixtureCounts;
  items: ScopeChecklistItem[];
  countertopDemoIncluded?: boolean;
}): boolean {
  const { notes: n, existing: ex, install: ins, items } = params;
  const hasExisting = positiveCount(ex.bathroomExistingCounterCount) != null;
  const installing = positiveCount(ins.bathroomInstallCounterCount) != null;
  return (
    Boolean(params.countertopDemoIncluded) ||
    checklistIncluded(items, 'countertop_demo') ||
    inferItemStateFromNotes('countertop_demo', n) === 'included' ||
    (hasExisting && notesMentionDemoCountertop(n)) ||
    (hasExisting && installing)
  );
}

/** Legacy explicit pairing — UI install steppers no longer call this on commit. */
export function syncPairedBathroomDemoFromInstall(
  install: BathroomInstallFixtureCounts,
  demo: BathroomDemoFixtureCounts,
  overrides: Partial<Record<BathroomFixtureDemoOverrideKey, boolean>>
): BathroomDemoFixtureCounts {
  const next = { ...demo };
  if (!overrides.bathroomDemoVanityCount) {
    next.bathroomDemoVanityCount = positiveCount(install.bathroomInstallVanityCount) ? 1 : null;
  }
  if (!overrides.bathroomDemoCounterCount) {
    next.bathroomDemoCounterCount = positiveCount(install.bathroomInstallCounterCount) ? 1 : null;
  }
  return next;
}

export function resolveBathroomFixtureDemoFromIntent(params: {
  notes?: string | null;
  existing: BathroomExistingFixtureCounts;
  install: BathroomInstallFixtureCounts;
  checklistItems?: ScopeChecklistItem[];
  vanityDemoIncluded?: boolean;
  countertopDemoIncluded?: boolean;
}): BathroomDemoFixtureCounts {
  const n = String(params.notes || '').toLowerCase();
  const items = params.checklistItems || [];
  const demo: BathroomDemoFixtureCounts = {
    bathroomDemoVanityCount: null,
    bathroomDemoCounterCount: null,
  };
  if (
    shouldDemoVanity({
      notes: n,
      existing: params.existing,
      install: params.install,
      items,
      vanityDemoIncluded: params.vanityDemoIncluded,
    })
  ) {
    demo.bathroomDemoVanityCount = 1;
  }
  if (
    shouldDemoCountertop({
      notes: n,
      existing: params.existing,
      install: params.install,
      items,
      countertopDemoIncluded: params.countertopDemoIncluded,
    })
  ) {
    demo.bathroomDemoCounterCount = 1;
  }
  return demo;
}

export function syncBathroomFixtureQmScopeItems(
  items: ScopeChecklistItem[],
  m: Record<string, unknown>
): ScopeChecklistItem[] {
  const install = readBathroomInstallFixtureCounts(m);
  const demo = readBathroomDemoFixtureCounts(m);
  let changed = false;
  const next = items.map((row) => {
    if (row.id === 'vanity') {
      if (positiveCount(install.bathroomInstallVanityCount) != null) {
        if (row.state !== 'included' || row.choiceId !== 'replacing') {
          changed = true;
          return { ...row, state: 'included' as const, choiceId: 'replacing' };
        }
        return row;
      }
      if (
        positiveCount(install.bathroomInstallCounterCount) != null &&
        positiveCount(install.bathroomInstallVanityCount) == null &&
        row.state === 'included' &&
        row.choiceId === 'replacing'
      ) {
        changed = true;
        return { ...row, state: 'included' as const, choiceId: 'staying' };
      }
    }
    if (row.id === 'countertops' && positiveCount(install.bathroomInstallCounterCount) != null) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
      return row;
    }
    if (row.id === 'vanity_demo' && positiveCount(demo.bathroomDemoVanityCount) != null) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
      return row;
    }
    if (row.id === 'countertop_demo' && positiveCount(demo.bathroomDemoCounterCount) != null) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
      return row;
    }
    return row;
  });
  return changed ? next : items;
}

function mergeFixtureCounts<T extends Record<string, unknown>>(
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

/** Pull bath counter sqft from notes when New countertop is in scope. */
export function inferBathroomCountertopSqftFromNotes(notes?: string | null): string | null {
  const n = String(notes || '').toLowerCase();
  const forward =
    /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sf)\b[^.]{0,50}\b(countertops?|counters?|vanity\s+top|quartz|granite)/;
  const reverse =
    /\b(countertops?|counters?|vanity\s+top|quartz|granite)\b[^.]{0,50}(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sf)\b/;
  const forwardMatch = n.match(forward);
  if (forwardMatch?.[1] && Number(forwardMatch[1]) > 0) return forwardMatch[1];
  const reverseMatch = n.match(reverse);
  if (reverseMatch?.[2] && Number(reverseMatch[2]) > 0) return reverseMatch[2];
  return null;
}

function hydrateBathroomFixtures(ctx: QmPanelHydrateContext): Record<string, unknown> {
  const saved = ctx.measurements;
  const hasSavedInstall = INSTALL_KEYS.some((k) => positiveCount(saved[k]));
  const hasSavedDemo = DEMO_KEYS.some((k) => positiveCount(saved[k]));
  const hasSavedExisting = EXISTING_KEYS.some((k) => positiveCount(saved[k]));

  let existing = readBathroomExistingFixtureCounts(saved);
  if (ctx.hasSitePhotos) {
    existing = {
      ...emptyBathroomExistingFixtureCounts(),
      ...inferExistingBathroomFixturesFromNotes(ctx.notes),
      ...readBathroomExistingFixtureCounts(saved),
    };
  } else if (!hasSavedExisting) {
    existing = emptyBathroomExistingFixtureCounts();
  }

  const vanityDemo = ctx.checklistItems.find((r) => r.id === 'vanity_demo');
  const countertopDemo = ctx.checklistItems.find((r) => r.id === 'countertop_demo');

  const install = hasSavedInstall
    ? readBathroomInstallFixtureCounts(saved)
    : inferBathroomFixtureInstallFromIntent({
        notes: ctx.notes,
        checklistItems: ctx.checklistItems,
      });

  const demo = hasSavedDemo
    ? readBathroomDemoFixtureCounts(saved)
    : resolveBathroomFixtureDemoFromIntent({
        notes: ctx.notes,
        existing,
        install,
        checklistItems: ctx.checklistItems,
        vanityDemoIncluded: vanityDemo?.state === 'included',
        countertopDemoIncluded: countertopDemo?.state === 'included',
      });

  const patch: Record<string, unknown> = { ...existing, ...install, ...demo };
  const savedSqft = String(saved.countertopSqft ?? '').trim();
  if (!savedSqft && positiveCount(install.bathroomInstallCounterCount) != null) {
    const inferred = inferBathroomCountertopSqftFromNotes(ctx.notes);
    if (inferred) patch.countertopSqft = inferred;
  }
  if (
    !saved.bathroomVanityCountertopMaterialType &&
    positiveCount(install.bathroomInstallCounterCount) != null
  ) {
    const inferredMaterial = inferBathroomVanityCountertopMaterialFromNotes(ctx.notes);
    if (inferredMaterial) patch.bathroomVanityCountertopMaterialType = inferredMaterial;
  }

  return mergeFixtureCounts(saved, patch);
}

export const bathroomFixturesQmPanel: QmPanelDefinition = {
  id: 'bathroom_fixtures',
  templateKeys: ['bathroom'],
  embeddedScopeItemIds: [...BATHROOM_FIXTURES_QM_EMBEDDED_IDS],
  isActive: (ctx) => String(ctx.templateKey || '').toLowerCase() === 'bathroom',
  hydrateMeasurements: hydrateBathroomFixtures,
  syncScopeItems: syncBathroomFixtureQmScopeItems,
};
