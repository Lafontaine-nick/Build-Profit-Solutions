import type { EstimateAiDraft, ScopeChecklistItem, ScopeChecklistOption, ScopeMeasurements } from '@/utils/estimateAiDraft';
import { resolveDraftScopeNotes } from '@/utils/estimateAiDraft';
import {
  checklistItemInScope,
  formatUnitLabel,
  getChecklistItemQuantityRule,
  notesHaveCombinedCabinetsCounters,
  resolveChecklistItemQuantity,
  type NormalizedScopeMeasurements,
} from '@/utils/scopeItemQuantities';
import {
  inferChoiceFromNotes,
  inferChoicesFromNotes,
  inferItemStateFromNotes,
} from '@/utils/scopeItemNoteHints';
import { scopeItemHasNoteSignal, scopeItemNoteBadge } from '@/utils/scopeItemVisualTier';
import { applyScopeGapExclusionsToDraft } from '@/utils/scopeReviewUi';

const FIXTURE_CHOICE_OPTIONS: ScopeChecklistOption[] = [
  { id: 'staying', label: 'Staying' },
  { id: 'replacing', label: 'Replacing' },
  { id: 'relocating', label: 'Relocating' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const FIXTURE_CHOICE_NO_RELOCATE: ScopeChecklistOption[] = [
  { id: 'staying', label: 'Staying' },
  { id: 'replacing', label: 'Replacing' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const WALL_CHOICE_OPTIONS: ScopeChecklistOption[] = [
  { id: 'remove', label: 'Removing wall(s)' },
  { id: 'add', label: 'Adding / moving wall(s)' },
  { id: 'no_changes', label: 'No wall changes' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const WALL_LAYOUT_WORK_IDS = new Set(['remove', 'add']);
const WALL_LAYOUT_EXCLUSIVE_IDS = new Set(['no_changes', 'not_in_scope', 'unsure']);

export function choiceIdsToScopeState(choiceIds: string[] | undefined): 'included' | 'excluded' | 'unsure' {
  const ids = choiceIds ?? [];
  if (!ids.length) return 'unsure';
  if (ids.includes('not_in_scope')) return 'excluded';
  if (ids.includes('unsure') && ids.length === 1) return 'unsure';
  if (ids.some((id) => WALL_LAYOUT_WORK_IDS.has(id))) return 'included';
  if (ids.includes('no_changes')) return 'included';
  return 'unsure';
}

/** Toggle wall layout chips — remove/add can combine; other options are exclusive. */
export function toggleWallLayoutChoiceIds(current: string[] | undefined, optionId: string): string[] {
  if (WALL_LAYOUT_EXCLUSIVE_IDS.has(optionId)) {
    const ids = current ?? [];
    if (ids.length === 1 && ids[0] === optionId) return [];
    return [optionId];
  }
  let next = (current ?? []).filter((id) => WALL_LAYOUT_WORK_IDS.has(id));
  if (next.includes(optionId)) {
    next = next.filter((id) => id !== optionId);
  } else {
    next = [...next, optionId];
  }
  return next;
}

const SHOWER_PAN_CHOICE_OPTIONS: ScopeChecklistOption[] = [
  { id: 'prefab', label: 'Prefab pan / base' },
  { id: 'tile_pan', label: 'Tile shower pan' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const WET_AREA_INSTALL_OPTIONS: ScopeChecklistOption[] = [
  { id: 'tub', label: 'Tub install' },
  { id: 'prefab', label: 'Prefab shower pan / base' },
  { id: 'tile_pan', label: 'Tile shower pan' },
  { id: 'staying', label: 'Keeping existing tub/shower' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

/** Items that must use pick-one chips — never Yes/No. */
const CHOICE_ITEM_CONFIG: Record<
  string,
  { label: string; helperText: string; options: ScopeChecklistOption[] }
> = {
  wet_area_install: {
    label: 'Wet area install',
    helperText: 'Pick one — tub, prefab pan, or tile shower pan?',
    options: WET_AREA_INSTALL_OPTIONS,
  },
  tub_shower: {
    label: 'Tub or shower',
    helperText: 'Pick one — staying, replacing, or relocating?',
    options: FIXTURE_CHOICE_OPTIONS,
  },
  toilet: {
    label: 'Toilet',
    helperText: 'Pick one — staying, replacing, or relocating?',
    options: FIXTURE_CHOICE_OPTIONS,
  },
  vanity: {
    label: 'Vanity & countertop',
    helperText: 'Pick one — staying or replacing?',
    options: FIXTURE_CHOICE_NO_RELOCATE,
  },
  walls_moving: {
    label: 'Wall layout changes',
    helperText: 'Select all that apply — you can remove and add walls on the same job.',
    options: WALL_CHOICE_OPTIONS,
  },
  shower_pan: {
    label: 'Shower pan',
    helperText: 'Pick one — prefab pan/base or tile shower pan?',
    options: SHOWER_PAN_CHOICE_OPTIONS,
  },
};

function labelLooksLikeChoiceQuestion(label: string): boolean {
  const t = label.toLowerCase();
  return (
    /\b(staying|replacing|relocating)\b/.test(t) &&
    (/\bor\b/.test(t) || /—/.test(label) || /\?/.test(t))
  );
}

function isMultiChoiceItem(item: ScopeChecklistItem): boolean {
  return item.inputType === 'multi_choice' || item.id === 'walls_moving';
}

function isChoiceItem(item: ScopeChecklistItem): boolean {
  if (isMultiChoiceItem(item)) return false;
  if (item.inputType === 'choice') return true;
  if (CHOICE_ITEM_CONFIG[item.id]) return true;
  return labelLooksLikeChoiceQuestion(item.label);
}

function normalizeMultiChoiceItem(item: ScopeChecklistItem): ScopeChecklistItem {
  const config = CHOICE_ITEM_CONFIG[item.id];
  const options = item.options?.length ? item.options : config?.options || WALL_CHOICE_OPTIONS;
  let choiceIds = item.choiceIds?.length
    ? [...item.choiceIds]
    : item.choiceId
      ? [item.choiceId]
      : [];
  if (!choiceIds.length && item.state === 'excluded') choiceIds = ['not_in_scope'];
  return {
    ...item,
    inputType: 'multi_choice',
    label: config?.label || item.label,
    helperText: config?.helperText || item.helperText,
    options,
    choiceIds,
    choiceId: choiceIds[0] ?? null,
    state: choiceIdsToScopeState(choiceIds),
  };
}

function defaultOptionsForItem(item: ScopeChecklistItem): ScopeChecklistOption[] {
  if (item.options?.length) return item.options;
  if (CHOICE_ITEM_CONFIG[item.id]) return CHOICE_ITEM_CONFIG[item.id].options;
  if (item.id === 'vanity') return FIXTURE_CHOICE_NO_RELOCATE;
  if (item.id === 'walls_moving') return WALL_CHOICE_OPTIONS;
  return FIXTURE_CHOICE_OPTIONS;
}

/** Normalize server or cached checklist rows so choice questions never show Yes/No. */
export function normalizeScopeChecklistItem(item: ScopeChecklistItem): ScopeChecklistItem {
  if (isMultiChoiceItem(item)) {
    return normalizeMultiChoiceItem(item);
  }
  if (!isChoiceItem(item)) {
    return {
      ...item,
      inputType: 'yes_no',
    };
  }

  const config = CHOICE_ITEM_CONFIG[item.id];
  const options = defaultOptionsForItem(item);
  let choiceId = item.choiceId ?? null;

  if (!choiceId && item.state === 'excluded') choiceId = 'not_in_scope';
  if (!choiceId && item.state === 'unsure') choiceId = 'unsure';

  return {
    ...item,
    inputType: 'choice',
    label: config?.label || item.label.replace(/\s*—\s*.*$/u, '').replace(/\s*included\?\s*$/i, '').trim(),
    helperText:
      config?.helperText ||
      item.helperText ||
      'Pick the option that matches the job — not Yes/No.',
    options,
    choiceId,
    state:
      choiceId === 'not_in_scope'
        ? 'excluded'
        : choiceId && choiceId !== 'unsure'
          ? 'included'
          : 'unsure',
  };
}

function choiceIdToState(choiceId: string | null | undefined): 'included' | 'excluded' | 'unsure' {
  if (!choiceId || choiceId === 'unsure') return 'unsure';
  if (choiceId === 'not_in_scope') return 'excluded';
  return 'included';
}

/** Map legacy tub_shower + shower_pan rows to wet_area_install when reopening saved drafts. */
function migrateLegacyBathroomScopeItems(items: ScopeChecklistItem[]): ScopeChecklistItem[] {
  const hasNewIds = items.some((i) =>
    ['tub_demo', 'shower_floor_demo', 'wet_area_install'].includes(i.id)
  );
  if (hasNewIds) return items;

  const tubShower = items.find((i) => i.id === 'tub_shower');
  const showerPan = items.find((i) => i.id === 'shower_pan');
  if (!tubShower && !showerPan) return items;

  let wetChoiceId: string | null = null;
  if (showerPan?.choiceId && showerPan.choiceId !== 'unsure') {
    wetChoiceId = showerPan.choiceId;
  } else if (tubShower?.choiceId === 'staying') {
    wetChoiceId = 'staying';
  } else if (tubShower?.choiceId === 'not_in_scope') {
    wetChoiceId = 'not_in_scope';
  } else if (tubShower?.choiceId === 'unsure' || showerPan?.choiceId === 'unsure') {
    wetChoiceId = 'unsure';
  }

  const wetAreaInstall: ScopeChecklistItem = {
    id: 'wet_area_install',
    inputType: 'choice',
    label: 'Wet area install',
    helperText: 'What is being installed in the tub/shower area?',
    options: WET_AREA_INSTALL_OPTIONS,
    choiceId: wetChoiceId,
    state: choiceIdToState(wetChoiceId),
    category: 'shower',
  };

  return [...items.filter((i) => i.id !== 'tub_shower' && i.id !== 'shower_pan'), wetAreaInstall];
}

export type KitchenScopeInferenceCtx = {
  notes?: string | null;
  measurements?: NormalizedScopeMeasurements;
};

/** Kitchen: reinstalling appliances implies removal; combined cabinets+counters implies countertops. */
export function applyKitchenScopeInferences(
  items: ScopeChecklistItem[],
  templateKey?: string | null,
  ctx?: KitchenScopeInferenceCtx
): ScopeChecklistItem[] {
  if (templateKey !== 'kitchen') return items;

  const next = items.map((item) => ({ ...item }));
  const removalIdx = next.findIndex((i) => i.id === 'appliance_removal');
  const reinstallIdx = next.findIndex((i) => i.id === 'appliances');
  if (
    removalIdx >= 0 &&
    reinstallIdx >= 0 &&
    next[reinstallIdx].state === 'included' &&
    next[removalIdx].state === 'unsure'
  ) {
    next[removalIdx] = { ...next[removalIdx], state: 'included' };
  }

  const cabinetsIdx = next.findIndex((i) => i.id === 'cabinets');
  const countertopsIdx = next.findIndex((i) => i.id === 'countertops');
  if (cabinetsIdx >= 0 && countertopsIdx >= 0) {
    const cabinetsIncluded = next[cabinetsIdx].state === 'included';
    const cabinetEntry = ctx?.measurements?.itemQuantities?.cabinets;
    const countertopEntry = ctx?.measurements?.itemQuantities?.countertops;
    const combined =
      Boolean(cabinetEntry?.includesCountertops) ||
      notesHaveCombinedCabinetsCounters(ctx?.notes) ||
      (cabinetEntry?.unit === 'allowance' &&
        (cabinetEntry.quantity ?? 0) >= 5000 &&
        !(countertopEntry?.quantity != null && countertopEntry.quantity > 0));
    if (combined && cabinetsIncluded) {
      const cabinetAmt = cabinetEntry?.quantity;
      next[cabinetsIdx] = {
        ...next[cabinetsIdx],
        helperText:
          'Cabinet supply and installation — allowance includes countertops.',
      };
      if (next[countertopsIdx].state !== 'excluded') {
        next[countertopsIdx] = {
          ...next[countertopsIdx],
          state: 'included',
          helperText: cabinetAmt
            ? `Included in the $${Number(cabinetAmt).toLocaleString()} cabinet allowance — not priced separately.`
            : 'Included in cabinet allowance — confirm only if priced separately.',
        };
      }
    }
  }

  return next;
}

/** Set Yes/choice from note hints for items still on Not sure. */
export function applyScopeInferencesFromNotes(
  items: ScopeChecklistItem[],
  notes: string | null | undefined,
  templateKey?: string | null,
  measurements?: NormalizedScopeMeasurements
): ScopeChecklistItem[] {
  if (!String(notes || '').trim()) return items;

  const next = items.map((item) => {
    if (item.inputType === 'multi_choice') {
      const choiceIds = inferChoicesFromNotes(item.id, notes);
      if (choiceIds.length) {
        return {
          ...item,
          choiceIds,
          choiceId: choiceIds[0] ?? null,
          state: choiceIdsToScopeState(choiceIds),
        };
      }
      return item;
    }
    if (item.inputType === 'choice') {
      const choiceId = inferChoiceFromNotes(item.id, notes);
      if (choiceId && (!item.choiceId || item.choiceId === 'unsure')) {
        return { ...item, choiceId, state: choiceIdToState(choiceId) };
      }
      return item;
    }
    const inferred = inferItemStateFromNotes(item.id, notes);
    if (item.state === 'unsure' && inferred === 'included') {
      return { ...item, state: 'included' as const };
    }
    if (item.state === 'unsure' && inferred === 'excluded') {
      return { ...item, state: 'excluded' as const };
    }
    return item;
  });

  return applyKitchenScopeInferences(next, templateKey, { notes, measurements });
}

export function normalizeScopeChecklistItems(
  items: ScopeChecklistItem[],
  templateKey?: string | null,
  inferenceCtx?: KitchenScopeInferenceCtx
): ScopeChecklistItem[] {
  const migrated = migrateLegacyBathroomScopeItems(items).map(normalizeScopeChecklistItem);
  return applyKitchenScopeInferences(migrated, templateKey, inferenceCtx);
}

const NOTE_BACKED_SCOPE_COPY: Record<string, { label: string; helperText: string; category?: string }> = {
  shower_tile: {
    label: 'Shower Tile',
    helperText: 'Shower wall tile labor and materials.',
    category: 'from_notes',
  },
  railing: {
    label: 'Railing / guardrails',
    helperText: 'Railing labor and materials from notes.',
    category: 'from_notes',
  },
  rock_mulch: {
    label: 'Rock / mulch',
    helperText: 'Rock, mulch, or gravel from notes.',
    category: 'from_notes',
  },
  decking: {
    label: 'Decking / surface install',
    helperText: 'Deck surface labor and materials from notes.',
    category: 'from_notes',
  },
  concrete: {
    label: 'Concrete work',
    helperText: 'Concrete labor and materials from notes.',
    category: 'from_notes',
  },
};

function itemIdFromQuantityKey(key: string): string {
  return key.replace(/__(?:material|labor|allowance)$/, '');
}

function injectNoteBackedPricedItems(
  items: ScopeChecklistItem[],
  measurements?: NormalizedScopeMeasurements
): ScopeChecklistItem[] {
  const itemQuantities = measurements?.itemQuantities || {};
  const existingIds = new Set(items.map((item) => item.id));
  const addedIds = new Set<string>();
  const additions: ScopeChecklistItem[] = [];

  for (const key of Object.keys(itemQuantities)) {
    const itemId = itemIdFromQuantityKey(key);
    if (!itemId || existingIds.has(itemId) || addedIds.has(itemId)) continue;
    if (!getChecklistItemQuantityRule(itemId)) continue;

    const copy = NOTE_BACKED_SCOPE_COPY[itemId] || {
      label: itemId.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      helperText: 'Scope item found in notes.',
      category: 'from_notes',
    };
    additions.push({
      id: itemId,
      inputType: 'yes_no',
      label: copy.label,
      helperText: copy.helperText,
      category: copy.category || 'from_notes',
      state: 'included',
      noteBacked: true,
    });
    addedIds.add(itemId);
  }

  return additions.length ? [...items, ...additions] : items;
}

function shouldSuppressGenericDemo(
  item: ScopeChecklistItem,
  templateKey?: string | null,
  measurements?: NormalizedScopeMeasurements
): boolean {
  return (
    item.id === 'demo' &&
    templateKey === 'flooring' &&
    Boolean(measurements?.itemQuantities?.floor_demo?.quantity) &&
    !measurements?.itemQuantities?.demo?.quantity
  );
}

/** Re-apply note hints + kitchen linked allowances on each Confirm Scope open. */
export function hydrateScopeChecklistFromNotes(
  items: ScopeChecklistItem[],
  templateKey?: string | null,
  notes?: string | null,
  measurements?: NormalizedScopeMeasurements
): ScopeChecklistItem[] {
  const scopedItems = items.filter((item) => !shouldSuppressGenericDemo(item, templateKey, measurements));
  const withNoteBacked = injectNoteBackedPricedItems(scopedItems, measurements);
  const normalized = normalizeScopeChecklistItems(withNoteBacked, templateKey, { notes, measurements });
  return applyScopeInferencesFromNotes(normalized, notes, templateKey, measurements);
}

/** Strip UI-only derived lines before saving scope back to the draft. */
export function scopeChecklistItemsForPersist(items: ScopeChecklistItem[]): ScopeChecklistItem[] {
  return items.filter((i) => !i.derivedFrom && !WET_AREA_DERIVED_ITEM_IDS.has(i.id));
}

/** Restore Confirm Scope form from saved assumptions or the original checklist. */
export function scopeChecklistItemsForEditing(draft: EstimateAiDraft | null): ScopeChecklistItem[] {
  const confirmed = draft?.confirmedAssumptions;
  if (confirmed?.length) {
    return confirmed.map((item) => ({ ...item }));
  }
  const checklistItems = draft?.scopeChecklist?.items;
  if (checklistItems?.length) {
    return checklistItems.map((item) => ({ ...item }));
  }
  return [];
}

export function mergeScopeProgressIntoDraft(
  draft: EstimateAiDraft,
  items: ScopeChecklistItem[],
  measurements?: ScopeMeasurements | null,
  options?: { scopeNotes?: string | null }
): EstimateAiDraft {
  const persistedItems = scopeChecklistItemsForPersist(items);
  if (!persistedItems.length && !measurements) return draft;

  const scopeNotes = String(options?.scopeNotes || resolveDraftScopeNotes(draft) || '').trim();

  const next: EstimateAiDraft = {
    ...draft,
    confirmedAssumptions: persistedItems.length ? persistedItems : draft.confirmedAssumptions,
    ...(scopeNotes && !String(draft.originalNotes || '').trim() ? { originalNotes: scopeNotes } : {}),
  };

  if (measurements) {
    next.scopeMeasurements = measurements;
    next.exclusions = applyScopeGapExclusionsToDraft(
      draft.exclusions || [],
      measurements.scopeGapResolutions,
      draft.scopeMeasurements?.scopeGapResolutions
    );
  }

  if (draft.scopeChecklist && persistedItems.length) {
    next.scopeChecklist = {
      ...draft.scopeChecklist,
      items: persistedItems.map((item) => ({ ...item })),
    };
  }

  return next;
}

/** Labor + materials line shown under wet area install picker. */
const WET_AREA_INSTALL_DERIVED: Record<
  string,
  { id: string; label: string; helperText: string }
> = {
  tub: {
    id: 'tub_install',
    label: 'Tub install',
    helperText: 'Labor + materials for bathtub supply and install.',
  },
  prefab: {
    id: 'prefab_shower_pan',
    label: 'Prefab shower pan / base install',
    helperText: 'Labor + materials for prefab pan or acrylic base.',
  },
  tile_pan: {
    id: 'shower_pan',
    label: 'Tile shower pan (mud pan build)',
    helperText: 'Labor + materials — slope, drain, liner, and mud bed.',
  },
};

export const WET_AREA_DERIVED_ITEM_IDS = new Set(['tub_install', 'prefab_shower_pan', 'shower_pan']);

/** Inject the matching labor + materials card directly under wet area install. */
export function expandWetAreaDerivedScopeItems(items: ScopeChecklistItem[]): ScopeChecklistItem[] {
  const withoutDerived = items.filter((i) => !WET_AREA_DERIVED_ITEM_IDS.has(i.id));
  const wet = withoutDerived.find((i) => i.id === 'wet_area_install');
  const spec = wet?.choiceId ? WET_AREA_INSTALL_DERIVED[wet.choiceId] : null;
  if (!spec) return withoutDerived;

  const derived: ScopeChecklistItem = {
    id: spec.id,
    label: spec.label,
    helperText: spec.helperText,
    inputType: 'yes_no',
    state: 'included',
    category: 'shower',
    derivedFrom: 'wet_area_install',
  };

  const idx = withoutDerived.findIndex((i) => i.id === 'wet_area_install');
  if (idx < 0) return [...withoutDerived, derived];
  const result = [...withoutDerived];
  result.splice(idx + 1, 0, derived);
  return result;
}

/** Kitchen-specific helper copy (ids overlap with bathroom checklist). */
export const KITCHEN_CHECKLIST_HELPER_OVERRIDES: Record<string, string> = {
  demo: 'Remove cabinets, counters, and built-ins.',
  appliance_removal: 'Disconnect and haul off existing appliances.',
  floor_demo: 'Remove existing kitchen flooring.',
  appliances: 'Reconnect and install appliances after cabinets.',
};

/** Shorter contractor-friendly helper copy (overrides server text in Confirm Scope UI). */
export const CHECKLIST_HELPER_OVERRIDES: Record<string, string> = {
  demo: 'Remove fixtures, tile, and finishes.',
  floor_demo: 'Remove existing floor tile, LVP, vinyl, or flooring.',
  tub_demo: 'Demo and haul off the existing bathtub.',
  shower_floor_demo: 'Demo existing shower base, prefab pan, or shower floor tile.',
  wet_area_install: 'Tub install, prefab pan/base, or tile shower pan — labor + materials.',
  tub_install: 'Labor + materials for tub supply and install.',
  prefab_shower_pan: 'Labor + materials for prefab pan or acrylic base.',
  shower_pan: 'Labor + materials for mud pan build (slope, drain, liner).',
  shower_tile: 'Shower wall tile labor and materials.',
  shower_floor_tile: 'Shower floor tile labor and materials.',
  waterproofing: 'Membrane and backer before tile.',
  shower_pan: 'Prefab pan/base or custom tile shower pan.',
  shower_niche: 'Frame, waterproof, and tile niche.',
  shower_bench_curb: 'Build, waterproof, and tile bench or curb.',
  floor_tile: 'Bathroom floor tile labor and materials.',
  floor_prep: 'Leveling, patching, or underlayment before flooring.',
  plumbing_rough: 'New/relocated lines, not fixture hookup only.',
  electrical_rough: 'New circuits, boxes, wiring, or GFCI changes.',
  lighting: 'Fixture + install, not fixture cost only.',
  exhaust_fan: 'Replace or install bath fan and ducting if needed.',
  mirror_accessories: 'Mirror, towel bars, hooks, or accessories.',
  paint: 'Prep, labor, and paint for walls/ceiling.',
  trim: 'Trim/baseboard labor and materials.',
  glass_door: 'Door unit + install.',
  drywall: 'Patch or replace after layout changes.',
  plumbing_trim: 'Set fixtures and finish connections.',
  electrical_trim: 'Devices, plates, and bulbs.',
  permits: 'Permit fees and inspections in your price.',
  cleanup: 'Final clean, debris haul-off, dump fees.',
};

export function checklistDisplayHelper(
  item: ScopeChecklistItem,
  templateKey?: string | null
): string | undefined {
  if (templateKey === 'kitchen' && KITCHEN_CHECKLIST_HELPER_OVERRIDES[item.id]) {
    return KITCHEN_CHECKLIST_HELPER_OVERRIDES[item.id];
  }
  return CHECKLIST_HELPER_OVERRIDES[item.id] || item.helperText;
}

export const QUANTITY_NEEDED_LABELS_BY_TEMPLATE: Record<string, Record<string, string>> = {
  kitchen: {
    demo: 'cabinet demo lump sum or LF',
    appliance_removal: 'appliance count',
    appliances: 'appliance count or allowance',
    countertops: 'countertop sqft',
    floor_demo: 'kitchen floor sqft',
  },
  bathroom: {
    demo: 'tear-out sqft (floor + shower)',
    floor_demo: 'bathroom floor sqft',
  },
};

export function quantityNeededLabel(
  itemId: string,
  templateKey: string | null | undefined,
  fallbackUnit: string
): string {
  const byTemplate = templateKey && QUANTITY_NEEDED_LABELS_BY_TEMPLATE[templateKey]?.[itemId];
  if (byTemplate) return byTemplate;
  return formatUnitLabel(fallbackUnit);
}

export type ScopeChecklistGroup = {
  title: string;
  itemIds: string[];
};

export const SCOPE_CHECKLIST_GROUPS: Record<string, ScopeChecklistGroup[]> = {
  bathroom: [
    { title: 'Demo', itemIds: ['demo', 'floor_demo', 'tub_demo', 'shower_floor_demo'] },
    {
      title: 'Shower',
      itemIds: [
        'wet_area_install',
        'tub_install',
        'prefab_shower_pan',
        'shower_pan',
        'waterproofing',
        'shower_tile',
        'shower_floor_tile',
        'shower_niche',
        'shower_bench_curb',
        'glass_door',
      ],
    },
    { title: 'Bathroom Floor', itemIds: ['floor_tile'] },
    {
      title: 'Fixtures',
      itemIds: ['toilet', 'vanity', 'lighting', 'exhaust_fan', 'mirror_accessories'],
    },
    {
      title: 'Trades',
      itemIds: ['plumbing_rough', 'electrical_rough', 'floor_prep', 'drywall', 'paint', 'trim'],
    },
    {
      title: 'Trim-out & Closeout',
      itemIds: ['plumbing_trim', 'electrical_trim', 'permits', 'cleanup'],
    },
  ],
  kitchen: [
    { title: 'Demo', itemIds: ['demo', 'floor_demo', 'wall_demo'] },
    { title: 'Appliances', itemIds: ['appliance_removal', 'appliances'] },
    {
      title: 'Cabinets & Counters',
      itemIds: ['cabinets', 'countertops', 'sink_faucet', 'cabinet_hardware', 'island'],
    },
    {
      title: 'Tile & Flooring',
      itemIds: ['backsplash', 'flooring', 'floor_prep'],
    },
    {
      title: 'Trades',
      itemIds: ['plumbing', 'electrical', 'lighting', 'drywall', 'paint', 'trim', 'walls_moving'],
    },
    { title: 'Closeout', itemIds: ['permits', 'cleanup'] },
  ],
  landscaping: [
    { title: 'Sitework', itemIds: ['demo_clearing', 'grading', 'soil_prep', 'drainage'] },
    {
      title: 'Landscape',
      itemIds: ['irrigation', 'sod_turf', 'rock_mulch', 'plants_trees'],
    },
    { title: 'Hardscape', itemIds: ['pavers', 'concrete'] },
    { title: 'Electrical', itemIds: ['landscape_lighting'] },
    { title: 'Closeout', itemIds: ['mobilization', 'cleanup'] },
  ],
  plumbing_service: [
    { title: 'Service', itemIds: ['service_call', 'fixture_repair', 'fixture_replace', 'drain_cleaning'] },
    {
      title: 'Lines & Rough',
      itemIds: ['water_line', 'sewer_line', 'plumbing_rough', 'plumbing_trim', 'parts_materials'],
    },
    { title: 'Closeout', itemIds: ['emergency_fee', 'cleanup'] },
  ],
  framing: [
    {
      title: 'Framing',
      itemIds: [
        'layout',
        'wall_framing',
        'openings',
        'blocking',
        'shear_sheathing',
        'hardware',
        'materials_package',
        'labor',
      ],
    },
    { title: 'Closeout', itemIds: ['cleanup'] },
  ],
  addition: [
    { title: 'Preconstruction', itemIds: ['plans_engineering', 'permits', 'utility_coordination'] },
    {
      title: 'Sitework',
      itemIds: ['sitework', 'excavation', 'grading', 'utility_trenching'],
    },
    { title: 'Foundation', itemIds: ['foundation', 'concrete'] },
    {
      title: 'Shell',
      itemIds: ['framing', 'roof_tie_in', 'windows_doors', 'exterior_finishes'],
    },
    { title: 'MEP Rough-ins', itemIds: ['plumbing_rough', 'electrical_rough', 'hvac'] },
    {
      title: 'Interior',
      itemIds: [
        'insulation',
        'drywall',
        'paint',
        'flooring',
        'cabinets_counters',
        'tile',
        'interior_trim',
      ],
    },
    {
      title: 'Trim-out & Closeout',
      itemIds: [
        'plumbing_trim',
        'electrical_trim',
        'hvac_startup',
        'appliances',
        'final_inspections',
        'cleanup',
        'contingency',
      ],
    },
  ],
  ground_up: [
    { title: 'Preconstruction', itemIds: ['plans_engineering', 'permits'] },
    { title: 'Sitework', itemIds: ['sitework', 'utility_taps'] },
    { title: 'Structure', itemIds: ['foundation', 'framing', 'roofing', 'exterior'] },
    { title: 'MEP & Envelope', itemIds: ['mep_rough', 'insulation'] },
    {
      title: 'Finishes',
      itemIds: ['drywall', 'cabinets_counters', 'tile_flooring', 'paint_trim', 'appliances'],
    },
    { title: 'Closeout', itemIds: ['contingency', 'overhead_profit', 'cleanup'] },
  ],
  room_remodel: [
    { title: 'Scope', itemIds: ['demo', 'cleanup'] },
    { title: 'Trades', itemIds: ['framing', 'plumbing', 'electrical', 'hvac'] },
    { title: 'Finishes', itemIds: ['drywall', 'flooring', 'paint', 'trim'] },
    { title: 'Closeout', itemIds: ['permits'] },
  ],
  roofing: [
    { title: 'Roof', itemIds: ['tear_off', 'decking_repair', 'underlayment', 'shingles_roofing', 'flashing', 'vents_penetrations'] },
    { title: 'Exterior', itemIds: ['gutters_downspouts'] },
    { title: 'Closeout', itemIds: ['permits', 'cleanup'] },
  ],
  hvac: [
    { title: 'Service', itemIds: ['service_call'] },
    { title: 'Equipment', itemIds: ['equipment_replace', 'refrigerant', 'thermostat'] },
    { title: 'Distribution', itemIds: ['ductwork', 'ventilation'] },
    { title: 'Closeout', itemIds: ['permits', 'cleanup'] },
  ],
  deck_patio: [
    { title: 'Demo', itemIds: ['demo_removal'] },
    { title: 'Structure', itemIds: ['footings_piers', 'framing_structure'] },
    { title: 'Surface', itemIds: ['decking', 'railing', 'stairs', 'staining_sealing'] },
    { title: 'Hardscape', itemIds: ['concrete_patio'] },
    { title: 'Closeout', itemIds: ['permits', 'cleanup'] },
  ],
  concrete: [
    { title: 'Prep', itemIds: ['demo_removal', 'site_prep', 'forms', 'reinforcement'] },
    { title: 'Pour', itemIds: ['pour_flatwork', 'pour_foundation'] },
    { title: 'Finish', itemIds: ['finish_seal', 'cleanup'] },
  ],
  excavation: [
    { title: 'Sitework', itemIds: ['mobilization', 'clearing'] },
    { title: 'Earthwork', itemIds: ['excavation', 'trenching', 'grading', 'backfill'] },
    { title: 'Closeout', itemIds: ['haul_off', 'cleanup'] },
  ],
  drywall: [
    { title: 'Drywall', itemIds: ['demo_removal', 'hang', 'finish_tape', 'texture', 'patch_repair'] },
    { title: 'Closeout', itemIds: ['cleanup'] },
  ],
  painting: [
    { title: 'Prep & Paint', itemIds: ['prep', 'interior_paint', 'exterior_paint', 'trim_paint'] },
    { title: 'Closeout', itemIds: ['cleanup'] },
  ],
};

/** @deprecated use SCOPE_CHECKLIST_GROUPS.bathroom */
export const BATHROOM_SCOPE_GROUPS = SCOPE_CHECKLIST_GROUPS.bathroom;

export function groupScopeChecklistItems(
  items: ScopeChecklistItem[],
  templateKey?: string
): Array<{ title: string; items: ScopeChecklistItem[] }> {
  const groups = templateKey ? SCOPE_CHECKLIST_GROUPS[templateKey] : null;
  if (!groups) {
    return [{ title: '', items }];
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const used = new Set<string>();
  const result: Array<{ title: string; items: ScopeChecklistItem[] }> = [];

  for (const group of groups) {
    const groupItems = group.itemIds
      .map((id) => byId.get(id))
      .filter((i): i is ScopeChecklistItem => Boolean(i));
    groupItems.forEach((i) => used.add(i.id));
    if (groupItems.length) result.push({ title: group.title, items: groupItems });
  }

  const remainder = items.filter((i) => !used.has(i.id));
  if (remainder.length) result.push({ title: 'Other', items: remainder });

  return result;
}

export function scopeChecklistSummaryCounts(
  items: ScopeChecklistItem[],
  needsMeasurement: number
): { included: number; unsure: number; excluded: number; needsMeasurement: number } {
  let included = 0;
  let unsure = 0;
  let excluded = 0;
  for (const item of items) {
    if (item.inputType === 'multi_choice') {
      const ids = item.choiceIds ?? [];
      if (ids.includes('not_in_scope')) excluded += 1;
      else if (!ids.length || (ids.length === 1 && ids.includes('unsure'))) unsure += 1;
      else included += 1;
    } else if (item.inputType === 'choice') {
      if (item.choiceId === 'not_in_scope') excluded += 1;
      else if (!item.choiceId || item.choiceId === 'unsure') unsure += 1;
      else included += 1;
    } else if (item.state === 'included') included += 1;
    else if (item.state === 'unsure') unsure += 1;
    else excluded += 1;
  }
  return { included, unsure, excluded, needsMeasurement };
}

function itemNeedsMeasurement(
  item: ScopeChecklistItem,
  measurements: NormalizedScopeMeasurements,
  templateKey?: string | null,
  notes?: string | null
): boolean {
  if (!checklistItemInScope(item)) return false;
  if (!getChecklistItemQuantityRule(item.id, templateKey)) return false;
  const resolved = resolveChecklistItemQuantity(item.id, measurements, {
    choiceId: item.choiceId,
    templateKey,
    notes,
  });
  return resolved.showInput && !resolved.pricingReady;
}

/** Scope groups that stay open on first load even when items are still "Not sure". */
const SCOPE_GROUPS_DEFAULT_EXPANDED: Record<string, ReadonlySet<string>> = {
  kitchen: new Set(['Cabinets & Counters', 'Tile & Flooring', 'Appliances', 'Trades']),
};

/** Collapse groups with no included items and no missing measurements. */
export function initialScopeGroupCollapse(
  grouped: Array<{ title: string; items: ScopeChecklistItem[] }>,
  measurements: NormalizedScopeMeasurements,
  templateKey?: string | null,
  notes?: string | null
): Record<string, boolean> {
  const alwaysExpand = SCOPE_GROUPS_DEFAULT_EXPANDED[templateKey || ''] || new Set<string>();
  const visualCtx = { measurements, templateKey, notes };
  const collapsed: Record<string, boolean> = {};
  for (const group of grouped) {
    if (!group.title) continue;
    const shouldExpand =
      alwaysExpand.has(group.title) ||
      group.items.some(
        (item) =>
          checklistItemInScope(item) ||
          itemNeedsMeasurement(item, measurements, templateKey, notes) ||
          scopeItemHasNoteSignal(item, visualCtx) ||
          scopeItemNoteBadge(item, visualCtx) != null
      );
    collapsed[group.title] = !shouldExpand;
  }
  return collapsed;
}

export function createCustomScopeItem(label: string): ScopeChecklistItem {
  const trimmed = label.trim();
  const id = `custom_${Date.now()}`;
  return {
    id,
    inputType: 'yes_no',
    label: trimmed,
    helperText: 'Added manually. Price as total, sqft, or LF.',
    state: 'included',
    category: 'custom',
  };
}

export function markAllUnsureAsExcluded(items: ScopeChecklistItem[]): ScopeChecklistItem[] {
  return items.map((item) => {
    if (item.inputType === 'multi_choice') {
      const ids = item.choiceIds ?? [];
      if (!ids.length || ids.includes('unsure')) {
        return {
          ...item,
          choiceIds: ['not_in_scope'],
          choiceId: 'not_in_scope',
          state: 'excluded',
        };
      }
      return item;
    }
    if (item.inputType === 'choice') {
      if (!item.choiceId || item.choiceId === 'unsure') {
        return { ...item, choiceId: 'not_in_scope', state: 'excluded' };
      }
      return item;
    }
    if (item.state === 'unsure') {
      return { ...item, state: 'excluded' };
    }
    return item;
  });
}
