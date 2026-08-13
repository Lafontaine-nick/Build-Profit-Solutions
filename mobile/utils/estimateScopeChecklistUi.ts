import type {
  EstimateAiDraft,
  ScopeChecklistItem,
  ScopeChecklistOption,
  ScopeMeasurements,
} from '@/utils/estimateAiDraft';
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
  electricalChecklistGroups,
  syncElectricalScopeItems,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import {
  floorDemoNotesHint,
  inferChoiceFromNotes,
  inferChoicesFromNotes,
  inferItemStateFromNotes,
} from '@/utils/scopeItemNoteHints';
import {
  scopeItemHasNoteSignal,
  scopeItemNoteBadge,
  BATHROOM_ALWAYS_VISIBLE_SCOPE_IDS,
} from '@/utils/scopeItemVisualTier';
import { hasAcceptedScopePricing } from '@/utils/acceptedPricingSummaryUi';
import { hasPaintRepairScopeSelection } from '@/utils/bathroomDrywallPaintScope';
import { resolveBathroomVanityCountertopMaterialType } from '@/utils/bathroomVanityCountertopPricing';
import { resolveStep2PricingTier } from '@/utils/confirmScopeStep2Pricing';
import { mergeScopeMeasurementsPreservingFields } from '@/utils/benchmarkReasonablenessContext';
import { applyScopeGapExclusionsToDraft } from '@/utils/scopeReviewUi';
import {
  primaryWetAreaInstallChoiceFromSteppers,
  type WetAreaStepperCounts,
} from '@/utils/planBathRooms';
import type { WetAreaDemoCounts } from '@/utils/wetAreaExistingDemo';
import { anyDemoWetAreaActive } from '@/utils/wetAreaExistingDemo';

const GARBAGE_DISPOSAL_CHOICE_OPTIONS: ScopeChecklistOption[] = [
  { id: 'reuse_install', label: 'Reuse / install' },
  { id: 'replace_install', label: 'Replace / install' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const FIXTURE_CHOICE_OPTIONS: ScopeChecklistOption[] = [
  { id: 'staying', label: 'Staying' },
  { id: 'replacing', label: 'Replacing' },
  { id: 'relocating', label: 'Relocating' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

/** Toilet-only — reset replaces legacy "staying" (no separate stay-in-place option). */
const TOILET_FIXTURE_CHOICE_OPTIONS: ScopeChecklistOption[] = [
  { id: 'reset', label: 'Reset' },
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
const WALL_LAYOUT_EXCLUSIVE_IDS = new Set([
  'no_changes',
  'not_in_scope',
  'unsure',
]);

export function choiceIdsToScopeState(
  choiceIds: string[] | undefined
): 'included' | 'excluded' | 'unsure' {
  const ids = choiceIds ?? [];
  if (!ids.length) return 'unsure';
  if (ids.includes('not_in_scope')) return 'excluded';
  if (ids.includes('unsure') && ids.length === 1) return 'unsure';
  if (ids.some(id => WALL_LAYOUT_WORK_IDS.has(id))) return 'included';
  if (ids.includes('no_changes')) return 'included';
  return 'unsure';
}

/** Toggle wall layout chips — remove/add can combine; other options are exclusive. */
export function toggleWallLayoutChoiceIds(
  current: string[] | undefined,
  optionId: string
): string[] {
  if (WALL_LAYOUT_EXCLUSIVE_IDS.has(optionId)) {
    const ids = current ?? [];
    if (ids.length === 1 && ids[0] === optionId) return [];
    return [optionId];
  }
  let next = (current ?? []).filter(id => WALL_LAYOUT_WORK_IDS.has(id));
  if (next.includes(optionId)) {
    next = next.filter(id => id !== optionId);
  } else {
    next = [...next, optionId];
  }
  return next;
}

const SHOWER_PAN_CHOICE_OPTIONS: ScopeChecklistOption[] = [
  { id: 'prefab', label: 'Prefab pan / base' },
  { id: 'tile_pan', label: 'Mud pan (tile shower)' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const WET_AREA_INSTALL_OPTIONS: ScopeChecklistOption[] = [
  { id: 'tub', label: 'Tub install' },
  { id: 'prefab', label: 'Prefab shower pan / base' },
  { id: 'tile_pan', label: 'Mud pan (tile shower)' },
  { id: 'staying', label: 'Keeping existing tub/shower' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

/** Items that must use pick-one chips — never Yes/No. */
const CHOICE_ITEM_CONFIG: Record<
  string,
  { label: string; helperText: string; options: ScopeChecklistOption[] }
> = {
  transitions: {
    label: 'Transitions & reducers',
    helperText: 'Select each transition type needed, then enter quantities.',
    options: [
      { id: 'standard_transition', label: 'Standard T-molding / transition' },
      { id: 'reducer', label: 'Reducer' },
      { id: 'threshold', label: 'Threshold / end cap' },
      { id: 'custom_transition', label: 'Custom / difficult transition' },
      { id: 'unsure', label: 'Not sure' },
    ],
  },
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
    helperText: 'Pick one — reset, replacing, or relocating?',
    options: TOILET_FIXTURE_CHOICE_OPTIONS,
  },
  vanity: {
    label: 'Vanity & countertop',
    helperText: 'Pick one — staying or replacing?',
    options: FIXTURE_CHOICE_NO_RELOCATE,
  },
  garbage_disposal: {
    label: 'Garbage disposal',
    helperText: 'Pick one — reuse/install existing or replace/install new?',
    options: GARBAGE_DISPOSAL_CHOICE_OPTIONS,
  },
  walls_moving: {
    label: 'Wall layout changes',
    helperText:
      'Select all that apply — you can remove and add walls on the same job.',
    options: WALL_CHOICE_OPTIONS,
  },
  shower_pan: {
    label: 'Shower pan',
    helperText: 'Pick one — prefab pan/base or custom mud pan?',
    options: SHOWER_PAN_CHOICE_OPTIONS,
  },
  irrigation: {
    label: 'Irrigation type',
    helperText: 'Pick one — sprinkler, drip, or not sure?',
    options: [
      { id: 'sprinkler', label: 'Sprinkler irrigation' },
      { id: 'drip', label: 'Drip irrigation' },
      { id: 'unsure', label: 'Not sure' },
    ],
  },
  rock: {
    label: 'Decorative rock depth',
    helperText: 'Select the installed rock depth before pricing.',
    options: [
      { id: 'rock_2in', label: '2 inch depth' },
      { id: 'rock_3in', label: '3 inch depth' },
      { id: 'premium_heavy', label: 'Premium / heavy rock' },
      { id: 'unsure', label: 'Not sure' },
    ],
  },
  demo_clearing: {
    label: 'Clearing level',
    helperText:
      'Select the clearing intensity. Dirt excavation is priced separately by CY.',
    options: [
      { id: 'light_clearing', label: 'Light clearing' },
      { id: 'medium_vegetation', label: 'Medium vegetation clearing' },
      { id: 'dense_vegetation', label: 'Dense vegetation clearing' },
      { id: 'unsure', label: 'Not sure' },
    ],
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
  return (
    item.inputType === 'multi_choice' ||
    item.id === 'walls_moving' ||
    item.id === 'transitions'
  );
}

function isChoiceItem(item: ScopeChecklistItem): boolean {
  if (isMultiChoiceItem(item)) return false;
  if (item.inputType === 'choice') return true;
  if (CHOICE_ITEM_CONFIG[item.id]) return true;
  return labelLooksLikeChoiceQuestion(item.label);
}

function normalizeMultiChoiceItem(
  item: ScopeChecklistItem
): ScopeChecklistItem {
  const config = CHOICE_ITEM_CONFIG[item.id];
  const options = item.options?.length
    ? item.options
    : config?.options || WALL_CHOICE_OPTIONS;
  let choiceIds = item.choiceIds?.length
    ? [...item.choiceIds]
    : item.choiceId
      ? [item.choiceId]
      : [];
  if (!choiceIds.length && item.state === 'excluded')
    choiceIds = ['not_in_scope'];
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

function defaultOptionsForItem(
  item: ScopeChecklistItem
): ScopeChecklistOption[] {
  // Canonical config wins over stale persisted options (e.g. toilet reset chip added later).
  if (CHOICE_ITEM_CONFIG[item.id]) return CHOICE_ITEM_CONFIG[item.id].options;
  if (item.options?.length) return item.options;
  if (item.id === 'vanity') return FIXTURE_CHOICE_NO_RELOCATE;
  if (item.id === 'walls_moving') return WALL_CHOICE_OPTIONS;
  return FIXTURE_CHOICE_OPTIONS;
}

/** Canonical labels for yes/no rows that were renamed after drafts were saved. */
const YES_NO_LABEL_OVERRIDES: Record<
  string,
  { label: string; helperText?: string }
> = {
  glass_door: {
    label: 'Shower doors',
    helperText:
      'Glass shower door / enclosure — material and install. Choose standard slider or premium frameless. Mirror and accessories are separate.',
  },
  shower_bench: {
    label: 'Shower bench',
    helperText:
      'Build, waterproof, and tile a shower bench — not the shower entry curb (included on the mud pan build line).',
  },
};

/** Normalize server or cached checklist rows so choice questions never show Yes/No. */
export function normalizeScopeChecklistItem(
  item: ScopeChecklistItem
): ScopeChecklistItem {
  if (isMultiChoiceItem(item)) {
    return normalizeMultiChoiceItem(item);
  }
  if (!isChoiceItem(item)) {
    const override = YES_NO_LABEL_OVERRIDES[item.id];
    return {
      ...item,
      inputType: 'yes_no',
      ...(override
        ? {
            label: override.label,
            helperText: override.helperText || item.helperText,
          }
        : null),
    };
  }

  const config = CHOICE_ITEM_CONFIG[item.id];
  const options = defaultOptionsForItem(item);
  let choiceId = item.choiceId ?? null;

  // Legacy toilet "staying" (no work) — option removed; clear so user picks reset/replace/etc.
  if (item.id === 'toilet' && choiceId === 'staying') {
    choiceId = null;
  }

  if (!choiceId && item.state === 'excluded') choiceId = 'not_in_scope';
  if (!choiceId && item.state === 'unsure') choiceId = 'unsure';

  return {
    ...item,
    inputType: 'choice',
    label:
      config?.label ||
      item.label
        .replace(/\s*—\s*.*$/u, '')
        .replace(/\s*included\?\s*$/i, '')
        .trim(),
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

function choiceIdToState(
  choiceId: string | null | undefined
): 'included' | 'excluded' | 'unsure' {
  if (!choiceId || choiceId === 'unsure') return 'unsure';
  if (choiceId === 'not_in_scope') return 'excluded';
  return 'included';
}

/** Map legacy combined bench/curb row to shower bench only (curb → mud pan build). */
function migrateShowerBenchCurbScopeItem(
  items: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  return items.map(item => {
    if (item.id !== 'shower_bench_curb') return item;
    return {
      ...item,
      id: 'shower_bench',
      label: 'Shower bench',
      helperText:
        'Build, waterproof, and tile a shower bench — not the shower entry curb (included on the mud pan build line).',
    };
  });
}

/** Map legacy tub_shower + shower_pan rows to wet_area_install when reopening saved drafts. */
function migrateLegacyBathroomScopeItems(
  items: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  const hasNewIds = items.some(i =>
    ['tub_demo', 'shower_floor_demo', 'wet_area_install'].includes(i.id)
  );
  if (hasNewIds) return items;

  const tubShower = items.find(i => i.id === 'tub_shower');
  const showerPan = items.find(i => i.id === 'shower_pan');
  if (!tubShower && !showerPan) return items;

  let wetChoiceId: string | null = null;
  if (showerPan?.choiceId && showerPan.choiceId !== 'unsure') {
    wetChoiceId = showerPan.choiceId;
  } else if (tubShower?.choiceId === 'staying') {
    wetChoiceId = 'staying';
  } else if (tubShower?.choiceId === 'not_in_scope') {
    wetChoiceId = 'not_in_scope';
  } else if (
    tubShower?.choiceId === 'unsure' ||
    showerPan?.choiceId === 'unsure'
  ) {
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

  return [
    ...items.filter(i => i.id !== 'tub_shower' && i.id !== 'shower_pan'),
    wetAreaInstall,
  ];
}

/** Split legacy kitchen sink+faucet+disposal row into separate garbage_disposal choice line. */
function migrateKitchenSinkDisposalSplit(
  items: ScopeChecklistItem[],
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (templateKey !== 'kitchen') return items;
  if (items.some(i => i.id === 'garbage_disposal')) return items;

  const sinkIdx = items.findIndex(i => i.id === 'sink_faucet');
  const sink = sinkIdx >= 0 ? items[sinkIdx] : null;
  const insertAt = sinkIdx >= 0 ? sinkIdx + 1 : items.length;

  let choiceId: string | null = null;
  let state: 'included' | 'excluded' | 'unsure' = 'unsure';
  if (sink?.state === 'included') {
    state = 'included';
    choiceId = 'replace_install';
  } else if (sink?.state === 'excluded') {
    state = 'excluded';
    choiceId = 'not_in_scope';
  }

  const garbageDisposal: ScopeChecklistItem = {
    id: 'garbage_disposal',
    inputType: 'choice',
    label: 'Garbage disposal',
    helperText: 'Pick one — reuse/install existing or replace/install new?',
    options: GARBAGE_DISPOSAL_CHOICE_OPTIONS,
    choiceId,
    state,
    category: 'cabinets',
  };

  const next = [...items];
  next.splice(insertAt, 0, garbageDisposal);
  return next;
}

export type KitchenScopeInferenceCtx = {
  notes?: string | null;
  measurements?: NormalizedScopeMeasurements;
};

/** Kitchen: reinstalling appliances implies removal unless notes say already removed; combined cabinets+counters implies countertops. */
export function applyKitchenScopeInferences(
  items: ScopeChecklistItem[],
  templateKey?: string | null,
  ctx?: KitchenScopeInferenceCtx
): ScopeChecklistItem[] {
  if (templateKey !== 'kitchen') return items;

  const next = items.map(item => ({ ...item }));
  const removalIdx = next.findIndex(i => i.id === 'appliance_removal');
  const reinstallIdx = next.findIndex(i => i.id === 'appliances');
  const notesSayAlreadyRemoved =
    inferItemStateFromNotes('appliance_removal', ctx?.notes) === 'excluded';
  if (
    removalIdx >= 0 &&
    reinstallIdx >= 0 &&
    next[reinstallIdx].state === 'included' &&
    next[removalIdx].state === 'unsure' &&
    !notesSayAlreadyRemoved
  ) {
    next[removalIdx] = { ...next[removalIdx], state: 'included' };
  }

  const cabinetsIdx = next.findIndex(i => i.id === 'cabinets');
  const countertopsIdx = next.findIndex(i => i.id === 'countertops');
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

/** Soft costs that default to Yes on ground-up when notes do not exclude them. */
const GROUND_UP_SOFT_COST_DEFAULT_INCLUDED = new Set([
  'plans_engineering',
  'permits',
]);

export function applyGroundUpSoftCostDefaults(
  items: ScopeChecklistItem[],
  templateKey?: string | null,
  notes?: string | null
): ScopeChecklistItem[] {
  if (String(templateKey || '').toLowerCase() !== 'ground_up') return items;
  return items.map(item => {
    if (
      !GROUND_UP_SOFT_COST_DEFAULT_INCLUDED.has(item.id) ||
      item.state !== 'unsure'
    )
      return item;
    // Respect explicit "no permits / owner pulls permits" style exclusions.
    if (
      /\b(no\s+permits|permits\s+not\s+included|owner\s+pulls?\s+permits)\b/i.test(
        String(notes || '')
      )
    ) {
      if (item.id === 'permits') return item;
    }
    return { ...item, state: 'included' as const };
  });
}

/** Set Yes/choice from note hints for items still on Not sure. */
export function applyScopeInferencesFromNotes(
  items: ScopeChecklistItem[],
  notes: string | null | undefined,
  templateKey?: string | null,
  measurements?: NormalizedScopeMeasurements
): ScopeChecklistItem[] {
  const inferred = !String(notes || '').trim()
    ? items
    : items.map(item => {
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
        const inferredState = inferItemStateFromNotes(item.id, notes);
        if (item.state === 'unsure' && inferredState === 'included') {
          return { ...item, state: 'included' as const };
        }
        if (item.state === 'unsure' && inferredState === 'excluded') {
          return { ...item, state: 'excluded' as const };
        }
        return item;
      });

  const withSoftCosts = applyGroundUpSoftCostDefaults(
    inferred,
    templateKey,
    notes
  );
  const withKitchenInferences = applyKitchenScopeInferences(
    withSoftCosts,
    templateKey,
    {
      notes,
      measurements,
    }
  );
  const withElectrical = syncElectricalScopeItems(withKitchenInferences, {
    electricalScope: (measurements as { electricalScope?: string[] | null })
      ?.electricalScope,
    quantities: measurements as Partial<Record<string, unknown>>,
  });
  return applyMeasuredStuccoScopeInferences(withElectrical, measurements);
}

export function applyMeasuredStuccoScopeInferences(
  items: ScopeChecklistItem[],
  measurements?: NormalizedScopeMeasurements
): ScopeChecklistItem[] {
  const measured = {
    stuccoSoffitSqft: Number(measurements?.stuccoSoffitSqft) || 0,
    stuccoParapetSqft: Number(measurements?.stuccoParapetSqft) || 0,
    stuccoFoamTrimLf: Number(measurements?.stuccoFoamTrimLf) || 0,
    stuccoOtherFinishDeductionSqft:
      Number(measurements?.stuccoOtherFinishDeductionSqft) || 0,
  };
  if (
    measured.stuccoSoffitSqft <= 0 &&
    measured.stuccoParapetSqft <= 0 &&
    measured.stuccoFoamTrimLf <= 0 &&
    measured.stuccoOtherFinishDeductionSqft <= 0
  ) {
    return items;
  }

  return items.map(item => {
    if (
      (item.id === 'stucco_soffits' && measured.stuccoSoffitSqft > 0) ||
      (item.id === 'stucco_parapets' && measured.stuccoParapetSqft > 0) ||
      (item.id === 'stucco_other_finish' &&
        measured.stuccoOtherFinishDeductionSqft > 0)
    ) {
      return item.state === 'unsure'
        ? { ...item, state: 'included' as const }
        : item;
    }
    if (
      item.id === 'stucco_foam_trim' &&
      measured.stuccoFoamTrimLf > 0 &&
      item.state === 'unsure' &&
      (!item.choiceId || item.choiceId === 'unsure')
    ) {
      // The LF proves trim exists, but not which profile was specified.
      // Include the scope while leaving the profile choice for the contractor.
      return { ...item, state: 'included' as const };
    }
    return item;
  });
}

export function normalizeScopeChecklistItems(
  items: ScopeChecklistItem[],
  templateKey?: string | null,
  inferenceCtx?: KitchenScopeInferenceCtx
): ScopeChecklistItem[] {
  const migrated = migrateGroundUpTakeoffScopeItems(
    migrateKitchenSinkDisposalSplit(
      migrateShowerBenchCurbScopeItem(migrateLegacyBathroomScopeItems(items)),
      templateKey
    ),
    templateKey
  ).map(normalizeScopeChecklistItem);
  // Do not force soft-cost Yes here — that would overwrite an intentional Not sure
  // on every reopen. Defaults are applied at checklist build / note inference time.
  return applyKitchenScopeInferences(migrated, templateKey, inferenceCtx);
}

/** Split legacy cabinets_counters and inject takeoff-priced ground-up lines. */
function migrateGroundUpTakeoffScopeItems(
  items: ScopeChecklistItem[],
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (templateKey !== 'ground_up') return items;
  let next = [...items];

  // O&P belongs on estimate markup (Step 5), not Confirm Scope.
  next = next.filter(i => i.id !== 'overhead_profit');

  // Split legacy Windows & doors into windows / exterior / sliding / garage.
  const windowsDoorsIdx = next.findIndex(i => i.id === 'windows_doors');
  if (windowsDoorsIdx >= 0) {
    const combined = next[windowsDoorsIdx];
    const hasWindows = next.some(i => i.id === 'windows');
    const hasExtDoors = next.some(i => i.id === 'exterior_doors');
    const hasSliding = next.some(i => i.id === 'sliding_doors');
    const hasGarage = next.some(i => i.id === 'garage_doors');
    next.splice(windowsDoorsIdx, 1);
    let insertAt = windowsDoorsIdx;
    const inject = (
      id: string,
      label: string,
      helperText: string,
      already: boolean
    ) => {
      if (already) return;
      next.splice(insertAt, 0, {
        ...combined,
        id,
        label,
        helperText,
        category: 'exterior',
      });
      insertAt += 1;
    };
    inject(
      'windows',
      'Windows',
      'Window count for material and labor.',
      hasWindows
    );
    inject(
      'exterior_doors',
      'Exterior doors',
      'Swing entry/exit doors including iron/specialty entry — material and install. Not sliding, garage, or site gates.',
      hasExtDoors
    );
    inject(
      'sliding_doors',
      'Exterior sliding doors',
      'Patio / multi-panel sliding doors — material and install.',
      hasSliding
    );
    inject(
      'garage_doors',
      'Garage doors',
      'Priced by type: single, double, or RV/oversized. Enter counts on the card.',
      hasGarage
    );
  }

  const combinedIdx = next.findIndex(i => i.id === 'cabinets_counters');
  if (combinedIdx >= 0) {
    const combined = next[combinedIdx];
    const hasCabinets = next.some(i => i.id === 'cabinets');
    const hasCounters = next.some(i => i.id === 'countertops');
    next.splice(combinedIdx, 1);
    if (!hasCabinets) {
      next.splice(combinedIdx, 0, {
        ...combined,
        id: 'cabinets',
        label: 'Cabinets / vanity',
        helperText: 'Cabinet and vanity LF — kitchen, baths, laundry.',
      });
    }
    if (!hasCounters) {
      const insertAt = next.findIndex(i => i.id === 'cabinets') + 1;
      next.splice(insertAt > 0 ? insertAt : combinedIdx, 0, {
        ...combined,
        id: 'countertops',
        label: 'Counters',
        helperText: 'Countertop sqft — kitchen, baths, and elsewhere.',
      });
    }
  }

  // Split legacy combined Paint & trim into interior paint / exterior paint / finish carpentry.
  const paintTrimIdx = next.findIndex(i => i.id === 'paint_trim');
  if (paintTrimIdx >= 0) {
    const combined = next[paintTrimIdx];
    const hasInteriorPaint = next.some(
      i => i.id === 'interior_paint' || i.id === 'paint'
    );
    const hasExteriorPaint = next.some(i => i.id === 'exterior_paint');
    const hasInteriorTrim = next.some(i => i.id === 'interior_trim');
    next.splice(paintTrimIdx, 1);
    let insertAt = paintTrimIdx;
    if (!hasInteriorPaint) {
      next.splice(insertAt, 0, {
        ...combined,
        id: 'interior_paint',
        label: 'Interior paint',
        helperText:
          'Wall/ceiling paint — installed budget from local comparables when available.',
      });
      insertAt += 1;
    }
    if (!hasExteriorPaint) {
      next.splice(insertAt, 0, {
        ...combined,
        id: 'exterior_paint',
        label: 'Exterior paint',
        helperText:
          'Exterior paint application for siding, stucco, soffit, and fascia. Prep, masking, heavy repairs, access work, and specialty coatings are separate.',
      });
      insertAt += 1;
    }
    if (!hasInteriorTrim) {
      next.splice(insertAt, 0, {
        ...combined,
        id: 'interior_trim',
        label: 'Finish carpentry / interior trim',
        helperText:
          'Finish trim, interior doors & shelving package until detailed takeoff.',
      });
    }
  }

  const ensure = (
    id: string,
    label: string,
    helperText: string,
    category: string,
    afterId?: string
  ) => {
    if (next.some(i => i.id === id)) return;
    const item: ScopeChecklistItem = {
      id,
      label,
      helperText,
      inputType: 'yes_no',
      state: 'unsure',
      category,
    };
    const afterIdx = afterId ? next.findIndex(i => i.id === afterId) : -1;
    if (afterIdx >= 0) next.splice(afterIdx + 1, 0, item);
    else next.push(item);
  };

  ensure(
    'excavation',
    'Excavation',
    'Excavation CY for material and labor.',
    'sitework',
    'sitework'
  );
  ensure(
    'landscaping',
    'Landscaping / site walls & gates',
    'Landscaping, exterior site walls, fences & gates package. Not driveway flatwork or iron entry doors.',
    'sitework',
    'utility_taps'
  );
  ensure(
    'pour_flatwork',
    'Exterior concrete flatwork',
    'Driveway, walkways, porch, and exterior patio slabs — not the house or garage slab. SF takeoff preferred; local allowance when SF is unknown.',
    'structural',
    'foundation'
  );
  ensure(
    'windows',
    'Windows',
    'Window count for material and labor.',
    'exterior',
    'exterior'
  );
  ensure(
    'exterior_doors',
    'Exterior doors',
    'Swing entry/exit doors including iron/specialty entry — material and install. Not sliding, garage, or site gates.',
    'exterior',
    'windows'
  );
  ensure(
    'sliding_doors',
    'Exterior sliding doors',
    'Patio / multi-panel sliding doors — material and install.',
    'exterior',
    'exterior_doors'
  );
  ensure(
    'garage_doors',
    'Garage doors',
    'Priced by type: single, double, or RV/oversized. Enter counts on the card.',
    'exterior',
    'sliding_doors'
  );
  ensure(
    'stucco',
    'Stucco / exterior wall finish',
    'Exterior wall surface SF for material and labor.',
    'exterior',
    'garage_doors'
  );
  ensure(
    'plumbing_rough',
    'Plumbing rough-in',
    'Rough-in points (supply/drain) for material and labor.',
    'mep',
    'mep_rough'
  );
  ensure(
    'electrical_rough',
    'Electrical rough-in',
    'Circuits / boxes / devices for material and labor.',
    'mep',
    'plumbing_rough'
  );
  ensure(
    'hvac',
    'HVAC',
    'System count (or tons) for material and labor.',
    'mep',
    'electrical_rough'
  );
  ensure(
    'plumbing_trim',
    'Plumbing fixtures & trim',
    'Plumbing fixtures and trim-out package (toilets, faucets, trim). Not plumbing rough-in.',
    'mep',
    'hvac'
  );
  ensure(
    'electrical_trim',
    'Electrical fixtures',
    'Light fixtures and finish electrical — material and install. Not electrical rough-in.',
    'mep',
    'plumbing_trim'
  );
  ensure(
    'cabinets',
    'Cabinets / vanity',
    'Cabinet and vanity LF — kitchen, baths, laundry.',
    'finishes',
    'drywall'
  );
  ensure(
    'countertops',
    'Counters',
    'Countertop sqft — kitchen, baths, and elsewhere.',
    'finishes',
    'cabinets'
  );
  ensure(
    'floor_tile',
    'Bath floor tile',
    'Bathroom floor tile labor and materials.',
    'finishes',
    'tile_flooring'
  );
  ensure(
    'shower_tile',
    'Shower wall tile',
    'Shower wall tile labor and materials.',
    'finishes',
    'floor_tile'
  );
  ensure(
    'shower_floor_tile',
    'Shower floor tile',
    'Shower floor tile labor and materials.',
    'finishes',
    'shower_tile'
  );
  ensure(
    'glass_door',
    'Shower doors',
    'Glass shower door / enclosure — material and install.',
    'finishes',
    'shower_floor_tile'
  );
  ensure(
    'interior_paint',
    'Interior paint',
    'Wall/ceiling paint — installed budget from local comparables when available.',
    'finishes',
    'glass_door'
  );
  ensure(
    'exterior_paint',
    'Exterior paint',
    'Exterior paint application for siding, stucco, soffit, and fascia. Prep, masking, heavy repairs, access work, and specialty coatings are separate.',
    'finishes',
    'interior_paint'
  );
  ensure(
    'interior_trim',
    'Finish carpentry / interior trim',
    'Finish trim, interior doors, door hardware & shelving package until detailed takeoff.',
    'finishes',
    'exterior_paint'
  );
  if (String(templateKey || '').toLowerCase() === 'flooring') {
    ensure(
      'adhesive_mastic_removal',
      'Adhesive, mastic or thinset removal',
      'Optional additional scraping or grinding beyond ordinary flooring removal.',
      'demo',
      'floor_demo'
    );
    ensure(
      'flooring_lvp',
      'LVP installation',
      'Luxury vinyl plank material and standard installation.',
      'flooring',
      'flooring'
    );
    ensure(
      'flooring_laminate',
      'Laminate installation',
      'Laminate flooring material and standard installation.',
      'flooring',
      'flooring_lvp'
    );
    ensure(
      'flooring_engineered_hardwood',
      'Engineered hardwood installation',
      'Engineered hardwood material and standard installation.',
      'flooring',
      'flooring_laminate'
    );
    ensure(
      'flooring_solid_hardwood',
      'Solid hardwood installation',
      'Solid hardwood material and standard installation. Refinishing is separate.',
      'flooring',
      'flooring_engineered_hardwood'
    );
    ensure(
      'tile_flooring',
      'Tile installation',
      'Floor tile material and standard installation. Specialty patterns and stone upgrades are separate.',
      'flooring',
      'flooring_solid_hardwood'
    );
    ensure(
      'flooring_carpet',
      'Carpet installation',
      'Carpet material, pad, seams, and standard installation.',
      'flooring',
      'tile_flooring'
    );
    ensure(
      'underlayment',
      'Underlayment',
      'Underlayment material and installation beneath the selected flooring.',
      'flooring',
      'floor_prep'
    );
    ensure(
      'moisture_barrier',
      'Vapor / moisture barrier',
      'Standard polyethylene vapor barrier beneath flooring where required.',
      'flooring',
      'underlayment'
    );
    ensure(
      'transitions',
      'Transitions & reducers',
      'Transition strips, reducers, thresholds, and related installation.',
      'trim',
      'trim'
    );
    ensure(
      'quarter_round',
      'Quarter round',
      'Quarter-round material and installation.',
      'trim',
      'transitions'
    );
  }

  next = next.map(i => {
    if (
      String(templateKey || '').toLowerCase() === 'flooring' &&
      i.id === 'floor_demo'
    ) {
      return {
        ...i,
        label: 'Demo Existing Flooring',
        helperText:
          'Removes existing flooring and bulk setting material, then cleans the exposed substrate. Includes protection, haul-off, and disposal. Extra residual grinding, patching, skim coating, and leveling are separate under floor prep.',
      };
    }
    if (
      String(templateKey || '').toLowerCase() === 'flooring' &&
      i.id === 'flooring'
    ) {
      return {
        ...i,
        label: 'New Flooring',
        helperText:
          'Fallback flooring install card when no specific product has been selected.',
      };
    }
    if (
      String(templateKey || '').toLowerCase() === 'flooring' &&
      i.id === 'floor_prep'
    ) {
      return {
        ...i,
        label: 'Subfloor / floor prep',
        helperText:
          'Extra substrate work after demo and cleaning — residual adhesive/thinset grinding, patching, skim coating, or leveling required for the new floor. Ordinary demo cleanup is not included here.',
      };
    }
    if (
      String(templateKey || '').toLowerCase() === 'flooring' &&
      i.id === 'underlayment'
    ) {
      return {
        ...i,
        label: 'Underlayment',
        helperText:
          'Underlayment material and standard installation beneath the selected flooring.',
      };
    }
    if (
      String(templateKey || '').toLowerCase() === 'roofing' &&
      i.id === 'underlayment'
    ) {
      return {
        ...i,
        label: 'Premium / synthetic underlayment upgrade',
        helperText:
          'Incremental upgrade above the standard underlayment included in supported base Roofing systems.',
      };
    }
    if (
      String(templateKey || '').toLowerCase() === 'roofing' &&
      i.id === 'ice_water_shield'
    ) {
      return {
        ...i,
        label: 'Ice & water shield',
        helperText:
          'Localized self-adhered waterproofing membrane for explicitly measured roofing protection areas.',
      };
    }
    if (
      String(templateKey || '').toLowerCase() === 'flooring' &&
      i.id === 'moisture_barrier'
    ) {
      return {
        ...i,
        label: 'Vapor / moisture barrier',
        helperText:
          'Standard polyethylene vapor barrier beneath flooring where required.',
      };
    }
    if (
      String(templateKey || '').toLowerCase() === 'flooring' &&
      i.id === 'trim'
    ) {
      return {
        ...i,
        label: 'Trim & baseboard install',
        helperText:
          'Paint-grade baseboard material, installation, caulking, light prep, and standard finish painting.',
      };
    }
    if (
      String(templateKey || '').toLowerCase() === 'flooring' &&
      i.id === 'cleanup'
    ) {
      return {
        ...i,
        label: 'Cleanup & Disposal',
        helperText:
          'Final project cleaning and debris from other scopes. Flooring demolition already includes normal loading, haul-off, and disposal; additional dumpsters, excessive hauling, and hazardous-material handling are separate.',
      };
    }
    if (i.id === 'sitework' && /excavation/i.test(i.label || '')) {
      return { ...i, label: 'Sitework' };
    }
    if (i.id === 'pour_flatwork') {
      return {
        ...i,
        label: 'Exterior concrete flatwork',
        helperText:
          'Driveway, walkways, porch, and exterior patio slabs — not the house or garage slab. SF takeoff preferred; local allowance when SF is unknown.',
        category: i.category || 'structural',
      };
    }
    if (i.id === 'landscaping') {
      return {
        ...i,
        label: 'Landscaping / site walls & gates',
        helperText:
          'Landscaping, exterior site walls, fences & gates package. Not driveway flatwork or iron entry doors.',
        category: i.category || 'sitework',
      };
    }
    if (i.id === 'plumbing_trim') {
      return {
        ...i,
        label: 'Plumbing fixtures (trim-out)',
        helperText:
          'Set faucets, toilet, and hookups — fixture trim-out. Not baseboard trim or rough-in.',
        category: i.category || 'mep',
      };
    }
    if (i.id === 'electrical_trim') {
      return {
        ...i,
        label: 'Electrical fixtures',
        helperText:
          'Light fixtures and finish electrical — material and install. Not electrical rough-in.',
        category: i.category || 'mep',
      };
    }
    return i;
  });

  next = ensureGroundUpFlatworkScopeCard(next);
  next = ensureGroundUpOpeningScopeCards(next);
  return applyGroundUpStageHostDemotions(next, templateKey);
}

/** Guarantee exterior flatwork card exists for ground-up UI (after Foundation). */
export function ensureGroundUpFlatworkScopeCard(
  items: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  if (items.some(i => i.id === 'pour_flatwork')) return items;
  const next = [...items];
  const item: ScopeChecklistItem = {
    id: 'pour_flatwork',
    label: 'Exterior concrete flatwork',
    helperText:
      'Driveway, walkways, porch, and exterior patio slabs — not the house or garage slab. SF takeoff preferred; local allowance when SF is unknown.',
    inputType: 'yes_no',
    state: 'unsure',
    category: 'structural',
  };
  const afterIdx = next.findIndex(i => i.id === 'foundation');
  if (afterIdx >= 0) next.splice(afterIdx + 1, 0, item);
  else next.push(item);
  return next;
}

/** Guarantee windows / exterior / sliding / garage door cards exist for ground-up UI. */
export function ensureGroundUpOpeningScopeCards(
  items: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  let next = [...items];
  const ensure = (
    id: string,
    label: string,
    helperText: string,
    afterId?: string
  ) => {
    if (next.some(i => i.id === id)) return;
    const item: ScopeChecklistItem = {
      id,
      label,
      helperText,
      inputType: 'yes_no',
      state: 'unsure',
      category: 'exterior',
    };
    const afterIdx = afterId ? next.findIndex(i => i.id === afterId) : -1;
    if (afterIdx >= 0) next.splice(afterIdx + 1, 0, item);
    else next.push(item);
  };
  ensure(
    'windows',
    'Windows',
    'Window count for material and labor.',
    'exterior'
  );
  ensure(
    'exterior_doors',
    'Exterior doors',
    'Swing entry/exit doors including iron/specialty entry — material and install. Not sliding, garage, or site gates.',
    'windows'
  );
  ensure(
    'sliding_doors',
    'Exterior sliding doors',
    'Patio / multi-panel sliding doors — material and install.',
    'exterior_doors'
  );
  ensure(
    'garage_doors',
    'Garage doors',
    'Priced by type: single, double, or RV/oversized. Set counts in Quick measurements.',
    'sliding_doors'
  );
  return next;
}

export function applyGroundUpStageHostDemotions(
  items: ScopeChecklistItem[],
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (templateKey !== 'ground_up') return items;

  const exteriorChildIds = [
    'roofing',
    'windows',
    'exterior_doors',
    'sliding_doors',
    'garage_doors',
    'windows_doors',
    'stucco',
  ];
  const mepChildIds = [
    'plumbing_rough',
    'electrical_rough',
    'hvac',
    'plumbing_trim',
    'electrical_trim',
  ];
  const siteChildIds = ['excavation', 'landscaping'];
  const finishChildIds = [
    'drywall',
    'paint_trim',
    'interior_paint',
    'exterior_paint',
    'interior_trim',
    'cabinets',
    'countertops',
    'tile_flooring',
    'floor_tile',
    'shower_tile',
    'shower_floor_tile',
    'glass_door',
    'insulation',
  ];
  const exteriorChildrenIncluded = exteriorChildIds.some(id =>
    items.some(i => i.id === id && i.state === 'included')
  );
  const exteriorWasIncluded = items.some(
    i => i.id === 'exterior' && i.state === 'included'
  );
  const mepWasIncluded = items.some(
    i => i.id === 'mep_rough' && i.state === 'included'
  );
  const mepChildrenIncluded = mepChildIds.some(id =>
    items.some(i => i.id === id && i.state === 'included')
  );
  const siteWasIncluded = items.some(
    i => i.id === 'sitework' && i.state === 'included'
  );
  const siteChildrenIncluded = siteChildIds.some(id =>
    items.some(i => i.id === id && i.state === 'included')
  );
  const demoteSiteHost = siteWasIncluded || siteChildrenIncluded;
  const interiorWasIncluded = items.some(
    i => i.id === 'interior_finishes' && i.state === 'included'
  );
  const finishChildrenIncluded = finishChildIds.some(id =>
    items.some(i => i.id === id && i.state === 'included')
  );
  const demoteMepHost = mepWasIncluded || mepChildrenIncluded;
  const demoteInteriorHost = interiorWasIncluded || finishChildrenIncluded;
  const promoteFinishChildren =
    interiorWasIncluded ||
    items.some(
      i =>
        ['drywall', 'paint_trim', 'interior_paint', 'tile_flooring'].includes(
          i.id
        ) && i.state === 'included'
    );

  return items.map(i => {
    if (i.id === 'sitework') {
      return {
        ...i,
        label: i.label || 'Sitework',
        helperText:
          'Planning comparison only — price excavation and other site trades separately.',
        state: demoteSiteHost ? 'excluded' : i.state,
      };
    }
    if (siteChildIds.includes(i.id)) {
      return {
        ...i,
        state: siteWasIncluded && i.state === 'unsure' ? 'included' : i.state,
      };
    }
    if (i.id === 'mep_rough') {
      return {
        ...i,
        label: i.label || 'MEP rough-in',
        helperText:
          'Planning comparison only — price plumbing / electrical / HVAC trades separately.',
        state: demoteMepHost ? 'excluded' : i.state,
      };
    }
    if (mepChildIds.includes(i.id)) {
      return {
        ...i,
        state: mepWasIncluded && i.state === 'unsure' ? 'included' : i.state,
      };
    }
    if (i.id === 'interior_finishes') {
      return {
        ...i,
        helperText:
          'Planning comparison only — price drywall, paint, cabinets, counters, and tile separately.',
        state: demoteInteriorHost ? 'excluded' : i.state,
      };
    }
    if (finishChildIds.includes(i.id)) {
      return {
        ...i,
        state:
          promoteFinishChildren && i.state === 'unsure' ? 'included' : i.state,
      };
    }
    if (i.id === 'exterior') {
      return {
        ...i,
        helperText:
          'Planning comparison only — price roofing, windows/doors, and stucco separately.',
        state:
          exteriorChildrenIncluded || exteriorWasIncluded
            ? 'excluded'
            : i.state,
      };
    }
    if (exteriorChildIds.includes(i.id)) {
      return {
        ...i,
        label:
          i.id === 'stucco'
            ? i.label || 'Stucco / exterior wall finish'
            : i.id === 'windows_doors'
              ? i.label || 'Windows & doors'
              : i.label,
        helperText:
          i.id === 'stucco'
            ? i.helperText || 'Exterior wall surface SF for material and labor.'
            : i.id === 'windows_doors'
              ? i.helperText ||
                'Opening count for material and labor — planning from living SF when count is missing.'
              : i.helperText,
        state:
          exteriorWasIncluded && i.state === 'unsure' ? 'included' : i.state,
      };
    }
    return i;
  });
}

const NOTE_BACKED_SCOPE_COPY: Record<
  string,
  { label: string; helperText: string; category?: string }
> = {
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
  measurements?: NormalizedScopeMeasurements,
  templateKey?: string | null
): ScopeChecklistItem[] {
  const itemQuantities = measurements?.itemQuantities || {};
  const existingIds = new Set(items.map(item => item.id));
  const addedIds = new Set<string>();
  const additions: ScopeChecklistItem[] = [];

  for (const key of Object.keys(itemQuantities)) {
    const itemId = itemIdFromQuantityKey(key);
    if (!itemId || existingIds.has(itemId) || addedIds.has(itemId)) continue;
    if (
      itemId === 'floor_demo' &&
      String(templateKey || '').toLowerCase() === 'bathroom' &&
      items.some(
        i =>
          ['demo', 'tub_demo', 'shower_floor_demo'].includes(i.id) &&
          (i.state === 'included' || i.noteBacked)
      )
    ) {
      continue;
    }
    if (!getChecklistItemQuantityRule(itemId)) continue;

    const copy = NOTE_BACKED_SCOPE_COPY[itemId] || {
      label: itemId.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase()),
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

const BATH_WET_AREA_DEMO_IDS = [
  'demo',
  'tub_demo',
  'shower_floor_demo',
] as const;

function bathroomHasWetAreaDemoInScope(items: ScopeChecklistItem[]): boolean {
  return items.some(
    i =>
      BATH_WET_AREA_DEMO_IDS.includes(
        i.id as (typeof BATH_WET_AREA_DEMO_IDS)[number]
      ) && checklistItemInScope(i)
  );
}

/**
 * Tub/shower tear-out must not keep bathroom floor demo in scope.
 * Photo vision often marks floor_demo when it sees bath floor tile; that is not
 * demo intent. Keep floor_demo only when notes ask for it or the bath-floor
 * demo stepper is on. Otherwise leave cards as Not sure (QM is source of truth).
 */
export function suppressBathroomFalsePositiveFloorDemoScope(
  items: ScopeChecklistItem[],
  templateKey?: string | null,
  notes?: string | null,
  measurements?: NormalizedScopeMeasurements | null
): ScopeChecklistItem[] {
  if (String(templateKey || '').toLowerCase() !== 'bathroom') return items;
  const n = String(notes || '').toLowerCase();
  if (floorDemoNotesHint(n)) return items;
  if (
    stepperCountActive(
      (
        measurements as
          | { demoBathFloorTileCount?: number | null }
          | null
          | undefined
      )?.demoBathFloorTileCount
    )
  ) {
    return items;
  }

  const wetAreaDemoInScope = bathroomHasWetAreaDemoInScope(items);
  const notesSuggestWetArea =
    /\b(shower|tub|bathtub|prefab|mud\s+pan|wet\s+area|tile\s+surround)\b/.test(
      n
    );
  // Floor-only bathroom jobs (no wet-area signal) keep whatever the checklist already has.
  if (!wetAreaDemoInScope && !notesSuggestWetArea) return items;

  const hasBathFloorSf = positiveSqft(measurements?.bathroomFloorSqft);

  return items.map(item => {
    if (item.id === 'floor_demo' && item.state === 'included') {
      return { ...item, state: 'unsure' as const, noteBacked: false };
    }
    if (
      item.id === 'floor_tile' &&
      item.state === 'included' &&
      !hasBathFloorSf
    ) {
      return { ...item, state: 'unsure' as const, noteBacked: false };
    }
    if (
      item.id === 'floor_tile' &&
      item.state === 'included' &&
      item.noteBacked &&
      inferItemStateFromNotes('floor_tile', notes) !== 'included'
    ) {
      return { ...item, state: 'unsure' as const, noteBacked: false };
    }
    return item;
  });
}

/** Drop stale floor_demo itemQuantities parsed from tub/shower tile tear-out phrasing. */
export function stripBathroomFalsePositiveFloorDemoQuantities<
  T extends Record<string, unknown> | undefined,
>(itemQuantities: T, templateKey?: string | null, notes?: string | null): T {
  if (!itemQuantities?.floor_demo) return itemQuantities;
  if (String(templateKey || '').toLowerCase() !== 'bathroom')
    return itemQuantities;
  if (floorDemoNotesHint(String(notes || '').toLowerCase()))
    return itemQuantities;

  const next = { ...itemQuantities } as Record<string, unknown>;
  for (const key of Object.keys(next)) {
    if (key === 'floor_demo' || key.startsWith('floor_demo__'))
      delete next[key];
  }
  return next as T;
}

/** Bathroom fixture rows that must stay on Confirm Scope even when notes/photos omit them. */
export { BATHROOM_ALWAYS_VISIBLE_SCOPE_IDS } from '@/utils/scopeItemVisualTier';

/** Bathroom rows driven by Vanity & countertop QM — absent from older AI checklists. */
export const BATHROOM_QM_FIXTURE_SCOPE_IDS = ['countertops'] as const;

function createDefaultBathroomChecklistItem(
  id: string
): ScopeChecklistItem | null {
  if (id === 'toilet') {
    const config = CHOICE_ITEM_CONFIG.toilet;
    return {
      id: 'toilet',
      inputType: 'choice',
      label: config.label,
      helperText: config.helperText,
      options: config.options,
      category: 'fixtures',
      state: 'unsure',
      choiceId: null,
    };
  }
  if (id === 'countertops') {
    return {
      id: 'countertops',
      inputType: 'yes_no',
      label: 'Counters',
      helperText:
        CHECKLIST_HELPER_OVERRIDES.countertops ||
        'Countertop sqft — kitchen, baths, and elsewhere.',
      category: 'fixtures',
      state: 'unsure',
    };
  }
  return null;
}

/** Inject standard bathroom fixture cards when AI/photo scope omitted them. */
export function ensureBathroomChecklistItems(
  items: ScopeChecklistItem[],
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (String(templateKey || '').toLowerCase() !== 'bathroom') return items;
  const existing = new Set(items.map(item => item.id));
  const additions: ScopeChecklistItem[] = [];
  const requiredIds = [
    ...BATHROOM_ALWAYS_VISIBLE_SCOPE_IDS,
    ...BATHROOM_QM_FIXTURE_SCOPE_IDS,
  ];
  for (const id of requiredIds) {
    if (existing.has(id)) continue;
    const row = createDefaultBathroomChecklistItem(id);
    if (row) additions.push(row);
  }
  if (!additions.length) return items;

  const fixturesIdx = items.findIndex(
    item => item.id === 'lighting' || item.category === 'fixtures'
  );
  if (fixturesIdx >= 0) {
    return [
      ...items.slice(0, fixturesIdx),
      ...additions,
      ...items.slice(fixturesIdx),
    ];
  }
  return [...items, ...additions];
}

/** Inject localized paint-repair row for bathroom remodels (single card for patch + paint). */
export function ensureBathroomPaintRepairItem(
  items: ScopeChecklistItem[],
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (String(templateKey || '').toLowerCase() !== 'bathroom') return items;
  if (items.some(row => row.id === 'paint_repair')) return items;
  const paintRepair: ScopeChecklistItem = {
    id: 'paint_repair',
    inputType: 'yes_no',
    label: BATHROOM_CHECKLIST_LABEL_OVERRIDES.paint_repair,
    helperText: BATHROOM_CHECKLIST_HELPER_OVERRIDES.paint_repair,
    category: 'trades',
    state: 'unsure',
  };
  const tradesIdx = items.findIndex(row =>
    ['floor_prep', 'plumbing_rough', 'electrical_rough', 'trim'].includes(
      row.id
    )
  );
  if (tradesIdx >= 0) {
    return [
      ...items.slice(0, tradesIdx + 1),
      paintRepair,
      ...items.slice(tradesIdx + 1),
    ];
  }
  return [...items, paintRepair];
}

/** Hide the legacy drywall patch card — patch SF and pricing live on paint_repair. */
export function suppressBathroomDrywallChecklistItems(
  items: ScopeChecklistItem[],
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (String(templateKey || '').toLowerCase() !== 'bathroom') return items;
  const legacyDrywall = items.find(
    row =>
      (row.id === 'drywall' || row.id === 'patch_repair') &&
      (row.state === 'included' || row.state === 'unsure')
  );
  let next = items;
  if (legacyDrywall) {
    next = next.map(row => {
      if (row.id !== 'paint_repair' || row.state !== 'excluded') return row;
      return {
        ...row,
        state:
          legacyDrywall.state === 'included'
            ? ('included' as const)
            : ('unsure' as const),
      };
    });
  }
  return next.filter(row => row.id !== 'drywall' && row.id !== 'patch_repair');
}

/** Hide interior paint rows — full-room and repair-area paint live on paint_repair. */
export function suppressBathroomInteriorPaintChecklistItems(
  items: ScopeChecklistItem[],
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (String(templateKey || '').toLowerCase() !== 'bathroom') return items;
  const legacyPaint = items.find(
    row =>
      (row.id === 'interior_paint' || row.id === 'paint') &&
      (row.state === 'included' || row.state === 'unsure')
  );
  let next = items;
  if (legacyPaint) {
    next = next.map(row => {
      if (row.id !== 'paint_repair' || row.state !== 'excluded') return row;
      return {
        ...row,
        state:
          legacyPaint.state === 'included'
            ? ('included' as const)
            : ('unsure' as const),
      };
    });
  }
  return next.filter(row => row.id !== 'interior_paint' && row.id !== 'paint');
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
  const scopedItems = items.filter(
    item => !shouldSuppressGenericDemo(item, templateKey, measurements)
  );
  const withNoteBacked = injectNoteBackedPricedItems(
    scopedItems,
    measurements,
    templateKey
  );
  const withBathroomDefaults = ensureBathroomChecklistItems(
    withNoteBacked,
    templateKey
  );
  const withPaintRepair = ensureBathroomPaintRepairItem(
    withBathroomDefaults,
    templateKey
  );
  const withoutLegacyDrywall = suppressBathroomDrywallChecklistItems(
    withPaintRepair,
    templateKey
  );
  const normalized = normalizeScopeChecklistItems(
    withoutLegacyDrywall,
    templateKey,
    { notes, measurements }
  );
  // Notes may flip drywall/paint/tile to Yes after structural migrate — re-promote children.
  const inferred = applyScopeInferencesFromNotes(
    normalized,
    notes,
    templateKey,
    measurements
  );
  return suppressBathroomInteriorPaintChecklistItems(
    suppressBathroomFalsePositiveFloorDemoScope(
      applyGroundUpStageHostDemotions(inferred, templateKey),
      templateKey,
      notes,
      measurements
    ),
    templateKey
  );
}

/** Strip UI-only derived lines before saving scope back to the draft. */
export function scopeChecklistItemsForPersist(
  items: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  const base = items.filter(
    i => !i.derivedFrom && !WET_AREA_DERIVED_ITEM_IDS.has(i.id)
  );
  if (base.some(i => i.id === 'paint_repair')) {
    return base.filter(
      i =>
        i.id !== 'drywall' &&
        i.id !== 'patch_repair' &&
        i.id !== 'interior_paint' &&
        i.id !== 'paint'
    );
  }
  return base;
}

/** Restore Confirm Scope form from saved assumptions or the original checklist. */
export function scopeChecklistItemsForEditing(
  draft: EstimateAiDraft | null
): ScopeChecklistItem[] {
  const confirmed = draft?.confirmedAssumptions;
  if (confirmed?.length) {
    return confirmed.map(item => ({ ...item }));
  }
  const checklistItems = draft?.scopeChecklist?.items;
  if (checklistItems?.length) {
    return checklistItems.map(item => ({ ...item }));
  }
  return [];
}

/** Keep Yes/No/choice states from confirmed scope when re-hydrating from notes. */
export function restoreConfirmedChecklistItemStates(
  hydrated: ScopeChecklistItem[],
  confirmed: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  if (!confirmed.length) return hydrated;
  const byId = new Map(confirmed.map(item => [item.id, item]));
  return hydrated.map(item => {
    const saved = byId.get(item.id);
    if (!saved) return item;
    return {
      ...item,
      state: saved.state,
      choiceId: saved.choiceId,
      choiceIds: saved.choiceIds,
      inScope: saved.inScope,
    };
  });
}

export function mergeScopeProgressIntoDraft(
  draft: EstimateAiDraft,
  items: ScopeChecklistItem[],
  measurements?: ScopeMeasurements | null,
  options?: { scopeNotes?: string | null }
): EstimateAiDraft {
  const persistedItems = scopeChecklistItemsForPersist(items);
  if (!persistedItems.length && !measurements) return draft;

  const scopeNotes = String(
    options?.scopeNotes || resolveDraftScopeNotes(draft) || ''
  ).trim();

  const next: EstimateAiDraft = {
    ...draft,
    confirmedAssumptions: persistedItems.length
      ? persistedItems
      : draft.confirmedAssumptions,
    ...(scopeNotes && !String(draft.originalNotes || '').trim()
      ? { originalNotes: scopeNotes }
      : {}),
  };

  if (measurements) {
    next.scopeMeasurements = mergeScopeMeasurementsPreservingFields(
      draft.scopeMeasurements,
      measurements
    );
    next.exclusions = applyScopeGapExclusionsToDraft(
      draft.exclusions || [],
      measurements.scopeGapResolutions,
      draft.scopeMeasurements?.scopeGapResolutions
    );
  }

  if (draft.scopeChecklist && persistedItems.length) {
    next.scopeChecklist = {
      ...draft.scopeChecklist,
      items: persistedItems.map(item => ({ ...item })),
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
  prefab_enclosure: {
    id: 'prefab_shower_enclosure',
    label: 'Prefab shower enclosure',
    helperText: 'Labor + materials for prefab surround / one-piece enclosure.',
  },
  tile_pan: {
    id: 'shower_pan',
    label: 'Shower mud pan build',
    helperText:
      'Liner, mud bed, drain, and entry curb — substrate only. Floor tile is a separate Shower floor tile line.',
  },
};

export const WET_AREA_DERIVED_ITEM_IDS = new Set([
  'tub_install',
  'prefab_shower_pan',
  'prefab_shower_enclosure',
  'shower_pan',
]);

/** Demo sub-lines controlled from QM steppers (no separate Confirm Scope card). */
export const WET_AREA_DEMO_EMBEDDED_IDS = new Set([
  'tub_demo',
  'shower_floor_demo',
]);

/** Inject the matching labor + materials card directly under wet area install. */
export function expandWetAreaDerivedScopeItems(
  items: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  const wet = items.find(i => i.id === 'wet_area_install');
  // A notes-only draft can contain a direct shower_pan row without the newer
  // wet_area_install parent. Preserve that card so applied mud-pan pricing
  // never becomes an orphaned line with no Confirm Scope card.
  if (!wet || !checklistItemInScope(wet)) {
    return items.filter(
      i => !WET_AREA_DERIVED_ITEM_IDS.has(i.id) || i.id === 'shower_pan'
    );
  }
  const withoutDerived = items.filter(
    i => !WET_AREA_DERIVED_ITEM_IDS.has(i.id)
  );
  const spec = wet.choiceId ? WET_AREA_INSTALL_DERIVED[wet.choiceId] : null;
  if (!spec) return withoutDerived;

  const existingPan = withoutDerived.find(i => i.id === spec.id);
  const derived: ScopeChecklistItem = {
    id: spec.id,
    label: spec.label,
    helperText: spec.helperText,
    inputType: 'yes_no',
    state: existingPan?.state === 'excluded' ? 'excluded' : 'included',
    category: 'shower',
    ...(spec.id !== 'shower_pan'
      ? { derivedFrom: 'wet_area_install' as const }
      : {}),
  };

  const idx = withoutDerived.findIndex(i => i.id === 'wet_area_install');
  if (idx < 0) return [...withoutDerived, derived];
  const result = [...withoutDerived];
  result.splice(idx + 1, 0, derived);
  return result;
}

function stepperCountActive(value: number | null | undefined): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function positiveSqft(value: string | number | null | undefined): boolean {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0;
}

/** Auto-include shower wall/floor tile scope from confirmed QM measurements or steppers. */
export function syncWetAreaTileScopeItems(
  items: ScopeChecklistItem[],
  params: {
    bathCount?: number | null;
    tilePanBathCount?: number | null;
    showerWallTileSqft?: string | number | null;
    showerFloorTileSqft?: string | number | null;
    keepingExisting?: boolean;
    /** Bathroom photo job splits wall vs pan steppers; whole-home QM uses combined counts. */
    splitTileWetArea?: boolean;
  }
): ScopeChecklistItem[] {
  let scopedItems = items;
  if (params.keepingExisting) {
    let changed = false;
    scopedItems = items.map(row => {
      if (row.id === 'shower_floor_tile' && row.state !== 'excluded') {
        changed = true;
        return { ...row, state: 'excluded' as const };
      }
      return row;
    });
    if (!changed) scopedItems = items;
  }

  const splitTileWetArea = params.splitTileWetArea !== false;
  const wallActive =
    stepperCountActive(params.bathCount) ||
    positiveSqft(params.showerWallTileSqft);
  const floorActive = params.keepingExisting
    ? false
    : stepperCountActive(params.tilePanBathCount) ||
      positiveSqft(params.showerFloorTileSqft) ||
      (!splitTileWetArea && stepperCountActive(params.bathCount));

  let changed = false;
  const next = scopedItems.map(row => {
    if (row.id === 'shower_tile') {
      if (wallActive) {
        if (row.state !== 'included') {
          changed = true;
          return { ...row, state: 'included' as const };
        }
        return row;
      }
      if (row.state === 'included') {
        changed = true;
        return { ...row, state: 'unsure' as const, noteBacked: false };
      }
      return row;
    }
    if (row.id === 'shower_floor_tile') {
      if (floorActive) {
        if (row.state !== 'included') {
          changed = true;
          return { ...row, state: 'included' as const };
        }
        return row;
      }
      if (
        row.state === 'included' ||
        (params.keepingExisting && row.state !== 'excluded')
      ) {
        changed = true;
        return {
          ...row,
          state: (params.keepingExisting ? 'excluded' : 'unsure') as
            | 'excluded'
            | 'unsure',
          noteBacked: false,
        };
      }
      return row;
    }
    return row;
  });
  return syncWaterproofingFromTileScopeItems(changed ? next : scopedItems);
}

const SHOWER_TILE_SCOPE_IDS = new Set(['shower_tile', 'shower_floor_tile']);

/** Tile shower work requires waterproofing — auto-select when wall/floor tile is in scope. */
export function syncWaterproofingFromTileScopeItems(
  items: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  const showerTileIncluded = items.some(
    row => SHOWER_TILE_SCOPE_IDS.has(row.id) && row.state === 'included'
  );
  if (!showerTileIncluded) return items;

  let changed = false;
  const next = items.map(row => {
    if (row.id === 'waterproofing' && row.state === 'unsure') {
      changed = true;
      return { ...row, state: 'included' as const };
    }
    return row;
  });
  return changed ? next : items;
}

/** Sync checklist wet area + derived lines from plan-style stepper counts. */
export function syncWetAreaScopeFromSteppers(
  items: ScopeChecklistItem[],
  params: {
    counts: WetAreaStepperCounts;
    keepingExisting?: boolean;
    showerWallTileSqft?: string | number | null;
    showerFloorTileSqft?: string | number | null;
  }
): ScopeChecklistItem[] {
  const withoutDerived = items.filter(
    i => !WET_AREA_DERIVED_ITEM_IDS.has(i.id)
  );

  const derivedKeys: string[] = [];
  if (stepperCountActive(params.counts.tubBathCount)) derivedKeys.push('tub');
  if (stepperCountActive(params.counts.prefabBathCount))
    derivedKeys.push('prefab');
  if (stepperCountActive(params.counts.prefabEnclosureBathCount))
    derivedKeys.push('prefab_enclosure');
  if (stepperCountActive(params.counts.tilePanBathCount))
    derivedKeys.push('tile_pan');

  const choiceId = primaryWetAreaInstallChoiceFromSteppers({
    counts: params.counts,
    keepingExisting: params.keepingExisting,
  });

  let next = withoutDerived.map(row => {
    if (row.id !== 'wet_area_install') return row;
    if (params.keepingExisting) {
      return { ...row, choiceId: 'staying', state: 'included' as const };
    }
    if (derivedKeys.length === 0) {
      return { ...row, choiceId: 'not_in_scope', state: 'excluded' as const };
    }
    if (choiceId) {
      return { ...row, choiceId, state: choiceIdToState(choiceId) };
    }
    // Wall-tile steppers without a tub/pan install — no wet-area install line.
    return { ...row, choiceId: 'not_in_scope', state: 'excluded' as const };
  });

  const derivedItems: ScopeChecklistItem[] = derivedKeys.map(key => {
    const spec = WET_AREA_INSTALL_DERIVED[key];
    const existing = withoutDerived.find(row => row.id === spec.id);
    return {
      id: spec.id,
      label: spec.label,
      helperText: spec.helperText,
      inputType: 'yes_no',
      state: existing?.state === 'excluded' ? 'excluded' : 'included',
      category: 'shower',
      ...(spec.id !== 'shower_pan'
        ? { derivedFrom: 'wet_area_install' as const }
        : {}),
    };
  });

  const wetIdx = next.findIndex(i => i.id === 'wet_area_install');
  if (wetIdx >= 0 && derivedItems.length) {
    next = [
      ...next.slice(0, wetIdx + 1),
      ...derivedItems,
      ...next.slice(wetIdx + 1),
    ];
  } else if (derivedItems.length) {
    next = [...next, ...derivedItems];
  }
  return syncWetAreaTileScopeItems(next, {
    bathCount: params.counts.bathCount,
    tilePanBathCount: params.keepingExisting
      ? null
      : params.counts.tilePanBathCount,
    showerWallTileSqft: params.showerWallTileSqft,
    showerFloorTileSqft: params.keepingExisting
      ? null
      : params.showerFloorTileSqft,
    keepingExisting: params.keepingExisting,
  });
}

/** Bath floor install card follows the confirmed bath-floor measurement or stepper. */
export function syncBathroomFloorTileScopeItems(
  items: ScopeChecklistItem[],
  params: {
    bathroomFloorSqft?: string | number | null;
    bathFloorTileCount?: number | null;
  }
): ScopeChecklistItem[] {
  const active =
    stepperCountActive(params.bathFloorTileCount) ||
    positiveSqft(params.bathroomFloorSqft);
  let changed = false;
  const next = items.map(row => {
    if (row.id !== 'floor_tile') return row;
    if (active) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
      return row;
    }
    if (row.state === 'included') {
      changed = true;
      return { ...row, state: 'unsure' as const, noteBacked: false };
    }
    return row;
  });
  return changed ? next : items;
}

const INTERIOR_PAINT_SCOPE_IDS = new Set([
  'paint',
  'interior_paint',
  'prep',
  'exterior_prep',
  'trim_paint',
  'door_paint',
  'cabinet_paint',
  'exterior_paint',
]);

/** Auto-include painting scope rows when their Quick Measurement driver is set. */
export function syncInteriorPaintScopeItems(
  items: ScopeChecklistItem[],
  params: {
    wallPaintSqft?: string | number | null;
    ceilingPaintSqft?: string | number | null;
    paintAreaSqft?: string | number | null;
    paintAreaBasis?:
      | 'walls'
      | 'ceilings'
      | 'combined'
      | 'floor_area'
      | 'unknown'
      | null;
    paintAreaNeedsConfirmation?: boolean | null;
    paintPricingMethod?: 'combined' | 'separate' | null;
    combinedPaintableAreaSqft?: string | number | null;
    paintScope?: Array<
      'walls' | 'ceilings' | 'trim' | 'doors' | 'cabinets' | 'exterior'
    > | null;
    baseboardLf?: string | number | null;
    interiorDoorCount?: string | number | null;
    cabinetPaintSqft?: string | number | null;
    exteriorPaintSqft?: string | number | null;
  }
): ScopeChecklistItem[] {
  const measuredScopeIds = new Set<string>();
  const explicitScope = params.paintScope;
  const bothWallsCeilings = Boolean(
    explicitScope?.includes('walls') && explicitScope.includes('ceilings')
  );
  if (explicitScope) {
    if (explicitScope.includes('walls')) measuredScopeIds.add('interior_paint');
    if (explicitScope.includes('ceilings'))
      measuredScopeIds.add('ceiling_paint');
    if (explicitScope.includes('trim')) measuredScopeIds.add('trim_paint');
    if (explicitScope.includes('doors')) measuredScopeIds.add('door_paint');
    if (explicitScope.includes('cabinets'))
      measuredScopeIds.add('cabinet_paint');
    if (explicitScope.includes('exterior')) {
      measuredScopeIds.add('exterior_paint');
      measuredScopeIds.add('exterior_prep');
    }
    if (
      explicitScope.some(
        surface => surface === 'walls' || surface === 'ceilings'
      )
    ) {
      measuredScopeIds.add('prep');
    }
  }
  if (!explicitScope) {
    if (positiveSqft(params.wallPaintSqft)) {
      measuredScopeIds.add('paint');
      measuredScopeIds.add('interior_paint');
      measuredScopeIds.add('prep');
    }
    if (positiveSqft(params.ceilingPaintSqft))
      measuredScopeIds.add('ceiling_paint');
    if (
      params.paintPricingMethod !== 'separate' &&
      params.paintAreaBasis === 'combined' &&
      positiveSqft(params.paintAreaSqft)
    ) {
      measuredScopeIds.add('interior_paint');
    }
    if (
      params.paintAreaBasis === 'walls' &&
      positiveSqft(params.paintAreaSqft)
    ) {
      measuredScopeIds.add('interior_paint');
    }
    if (
      params.paintPricingMethod === 'combined' &&
      positiveSqft(params.combinedPaintableAreaSqft)
    ) {
      measuredScopeIds.add('interior_paint');
    }
    if (positiveSqft(params.baseboardLf)) measuredScopeIds.add('trim_paint');
    if (positiveSqft(params.interiorDoorCount))
      measuredScopeIds.add('door_paint');
    if (positiveSqft(params.cabinetPaintSqft))
      measuredScopeIds.add('cabinet_paint');
    if (positiveSqft(params.exteriorPaintSqft)) {
      measuredScopeIds.add('exterior_paint');
      measuredScopeIds.add('exterior_prep');
    }
  }
  if (!measuredScopeIds.size && !explicitScope) return items;
  let workingItems = items;
  if (explicitScope?.includes('exterior')) {
    const exteriorRows = [
      {
        id: 'exterior_prep',
        inputType: 'yes_no' as const,
        label: 'Exterior Prep & Masking',
        helperText:
          'Exterior surface cleaning, masking, light scraping, spot priming, and standard prep before exterior painting.',
        category: 'prep',
        state: 'included' as const,
        noteBacked: true,
      },
      {
        id: 'exterior_paint',
        inputType: 'yes_no' as const,
        label: 'Exterior Paint',
        helperText:
          'Paintable exterior surface area for siding, stucco, soffits, and fascia. Heavy repairs, access work, and specialty coatings are separate.',
        category: 'paint',
        state: 'included' as const,
        noteBacked: true,
      },
    ];
    const missingExteriorRows = exteriorRows.filter(
      row => !items.some(item => item.id === row.id)
    );
    if (missingExteriorRows.length)
      workingItems = [...items, ...missingExteriorRows];
  }
  const bathroomPaintRepair = workingItems.some(
    row => row.id === 'paint_repair'
  );
  const targetIds = bathroomPaintRepair
    ? new Set(['paint_repair'])
    : measuredScopeIds;
  // Bathroom uses one physical paint card. QM paint SF must not also keep legacy
  // interior_paint/paint/prep selected — that double-counts ready pricing.
  const legacyPaintIds = bathroomPaintRepair
    ? new Set(['interior_paint', 'paint', 'paint_trim', 'prep'])
    : null;
  let changed = false;
  const next = workingItems.map(row => {
    if (
      bothWallsCeilings &&
      params.paintPricingMethod === 'combined' &&
      row.id === 'ceiling_paint' &&
      row.state !== 'excluded'
    ) {
      changed = true;
      return { ...row, state: 'excluded' as const, noteBacked: false };
    }
    if (explicitScope && INTERIOR_PAINT_SCOPE_IDS.has(row.id)) {
      const shouldInclude = measuredScopeIds.has(row.id);
      if (!shouldInclude && row.state !== 'unsure') {
        changed = true;
        return { ...row, state: 'unsure' as const, noteBacked: false };
      }
    }
    if (
      params.paintPricingMethod === 'separate' &&
      row.id === 'interior_paint' &&
      row.state === 'included' &&
      row.label === 'Walls & Ceilings'
    ) {
      changed = true;
      return { ...row, label: 'Walls' };
    }
    if (
      params.paintAreaNeedsConfirmation &&
      !['walls', 'combined'].includes(params.paintAreaBasis || '') &&
      (row.id === 'interior_paint' || row.id === 'ceiling_paint') &&
      row.state === 'included'
    ) {
      changed = true;
      return { ...row, state: 'unsure' as const, noteBacked: false };
    }
    if (legacyPaintIds?.has(row.id) && row.state !== 'excluded') {
      changed = true;
      return { ...row, state: 'excluded' as const };
    }
    if (targetIds.has(row.id) && row.state !== 'included') {
      changed = true;
      return {
        ...row,
        label:
          row.id === 'interior_paint' &&
          params.paintPricingMethod === 'combined'
            ? 'Walls & Ceilings'
            : row.label,
        state: 'included' as const,
      };
    }
    if (
      row.id === 'interior_paint' &&
      row.state === 'included' &&
      params.paintAreaBasis === 'combined'
    ) {
      if (row.label !== 'Walls & Ceilings') {
        changed = true;
        return { ...row, label: 'Walls & Ceilings' };
      }
    }
    return row;
  });
  return changed || workingItems !== items ? next : items;
}

function wetAreaGenericDemoActive(demo: WetAreaDemoCounts): boolean {
  return (
    stepperCountActive(demo.demoTubCount) ||
    stepperCountActive(demo.demoTilePanCount) ||
    stepperCountActive(demo.demoPrefabPanCount) ||
    stepperCountActive(demo.demoPrefabEnclosureCount) ||
    stepperCountActive(demo.demoShowerDoorCount)
  );
}

/** Auto-include demo scope rows from QM existing/demo steppers. */
export function syncWetAreaDemoScopeItems(
  items: ScopeChecklistItem[],
  params: {
    demo: WetAreaDemoCounts;
    reuseExistingShowerDoor?: boolean;
    installShowerDoorCount?: number | null;
  }
): ScopeChecklistItem[] {
  const showerFloorDemo =
    stepperCountActive(params.demo.demoTilePanCount) ||
    stepperCountActive(params.demo.demoPrefabPanCount) ||
    stepperCountActive(params.demo.demoPrefabEnclosureCount);
  const genericDemo =
    stepperCountActive(params.demo.demoTileWallCount) ||
    wetAreaGenericDemoActive(params.demo);

  let changed = false;
  const next = items.map(row => {
    if (row.id === 'floor_demo') {
      const bathFloorDemoOn = stepperCountActive(
        params.demo.demoBathFloorTileCount
      );
      if (bathFloorDemoOn) {
        if (row.state !== 'included') {
          changed = true;
          return { ...row, state: 'included' as const };
        }
        return row;
      }
      // Demo / tear-out bath floor off → Confirm Scope floor demo is Not sure.
      if (row.state === 'included') {
        changed = true;
        return { ...row, state: 'unsure' as const, noteBacked: false };
      }
      return row;
    }
    if (row.id === 'tub_demo' && stepperCountActive(params.demo.demoTubCount)) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
      return row;
    }
    if (row.id === 'shower_floor_demo' && showerFloorDemo) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
      return row;
    }
    if (row.id === 'demo' && genericDemo) {
      if (row.state !== 'included') {
        changed = true;
        return { ...row, state: 'included' as const };
      }
      return row;
    }
    if (row.id === 'glass_door') {
      if (params.reuseExistingShowerDoor) {
        if (row.state !== 'excluded') {
          changed = true;
          return { ...row, state: 'excluded' as const };
        }
        return row;
      }
      if (
        stepperCountActive(params.installShowerDoorCount) &&
        row.state !== 'included'
      ) {
        changed = true;
        return { ...row, state: 'included' as const };
      }
    }
    return row;
  });
  return changed ? next : items;
}

/** Kitchen-specific helper copy (ids overlap with bathroom checklist). */
export const KITCHEN_CHECKLIST_HELPER_OVERRIDES: Record<string, string> = {
  demo: 'Remove cabinets, counters, and built-ins.',
  appliance_removal: 'Disconnect and haul off existing appliances.',
  floor_demo: 'Remove existing kitchen flooring.',
  appliances: 'Reconnect and install appliances after cabinets.',
  sink_faucet: 'Sink and faucet supply and install at existing rough-in.',
  garbage_disposal:
    'Reuse/install existing disposal or replace/install new — priced separately from sink & faucet.',
};

/** Bathroom-specific helper copy (shower vs bath floor demo are separate scope lines). */
export const BATHROOM_CHECKLIST_HELPER_OVERRIDES: Record<string, string> = {
  demo: 'Remove shower wall tile, shower base or pan (tile or prefab), and tub when present — bath floor demo is a separate line.',
  floor_demo:
    'Remove bathroom floor tile, LVP, or vinyl — often includes thinset grind (separate from shower).',
  plumbing_trim:
    'Trim-out hookups only — lav faucet and shower/tub valve connections. Toilet and vanity installs are separate lines when selected above.',
  plumbing_rough:
    'Shower and tub rough-in — valve, head supply (in wall), and floor drain. Pick fixture type, same-location vs relocated, whether remodel demolition exposes the plumbing, and floor construction. Toilet rough-in is on Toilet; lav/sink rough-in is on Vanity.',
  drywall:
    'Legacy — use Interior painting/patch and repair for bathroom paint scope.',
  paint_repair:
    'Enter patch SF or room wall/ceiling SF, pick paint scope below, then apply pricing.',
  interior_paint:
    'Wall and ceiling surface area — not room floor SF. Standalone small scopes use a $350 minimum for mobilization and prep.',
  paint:
    'Wall and ceiling surface area — not room floor SF. Standalone small scopes use a $350 minimum for mobilization and prep.',
};

export const BATHROOM_CHECKLIST_LABEL_OVERRIDES: Record<string, string> = {
  plumbing_rough: 'Plumbing rough-in (shower / tub)',
  drywall: 'Drywall repair / patching + texture',
  paint_repair: 'Interior painting/patch and repair',
  interior_paint: 'Interior painting — prep, labor, and paint',
  paint: 'Interior painting — prep, labor, and paint',
};

export const KITCHEN_CHECKLIST_LABEL_OVERRIDES: Record<string, string> = {
  sink_faucet: 'Sink & faucet',
  island: 'Island cabinet/base install',
};

/** Shorter contractor-friendly helper copy (overrides server text in Confirm Scope UI). */
export const CHECKLIST_HELPER_OVERRIDES: Record<string, string> = {
  demo: 'Remove fixtures, tile, and finishes.',
  backsplash_demo:
    'Remove existing backsplash tile and adhesive; wall repair is separate.',
  floor_demo:
    'Remove existing floor tile, LVP, vinyl, or flooring. Standard rates include ordinary scraping during removal; extensive adhesive, mastic, thinset grinding, stairs, hazardous materials, and subfloor repair are separate.',
  adhesive_mastic_removal:
    'Optional additional scraping or grinding beyond ordinary removal. Standard flooring demo rates exclude extensive adhesive, mastic, or thinset removal.',
  tub_demo: 'Demo and haul off the existing bathtub.',
  shower_floor_demo:
    'Demo existing shower base, prefab pan, or shower floor tile.',
  vanity_demo:
    'Demo and haul off the existing vanity cabinet — not the top alone.',
  countertop_demo:
    'Demo and haul off the existing vanity top or bathroom counter.',
  wet_area_install:
    'Tub install, prefab pan/base, or custom mud pan — labor + materials.',
  tub_install: 'Labor + materials for tub supply and install.',
  prefab_shower_pan: 'Labor + materials for prefab pan or acrylic base.',
  prefab_shower_enclosure:
    'Labor + materials for prefab surround / one-piece enclosure.',
  shower_pan:
    'Liner, mud bed, drain, and entry curb — substrate only. Floor tile is a separate Shower floor tile line.',
  shower_tile: 'Shower wall tile labor and materials.',
  shower_floor_tile:
    'Floor tile setting on the mud pan — tile/thinset/grout only (pan build is separate).',
  waterproofing:
    'Backer board (Hardie, foam, DensShield), RedGard-class membrane, vapor barrier, tape, screws, and wall-cavity insulation — before tile.',
  shower_bench:
    'Build, waterproof, and tile a shower bench — not the shower entry curb.',
  shower_niche: 'Frame, waterproof, and tile niche.',
  shower_bench_curb:
    'Build, waterproof, and tile a shower bench — not the shower entry curb.',
  floor_tile: 'Bathroom floor tile labor and materials.',
  floor_prep:
    'Surface preparation after flooring removal. Enter only the area requiring preparation; structural repairs, moisture mitigation, and subfloor replacement are separate.',
  plumbing_rough:
    'New/relocated lines priced per rough-in point, not fixture hookup only.',
  electrical_rough:
    'New circuits, boxes, or devices — priced per circuit/device when counted.',
  lighting: 'Fixture + install, not fixture cost only.',
  exhaust_fan: 'Replace or install bath fan and ducting if needed.',
  mirror_accessories:
    'Towel bars, paper holder, hooks, or accessories — not shower doors.',
  paint: 'Wall/ceiling surface sqft (not floor area). Prep, labor, and paint.',
  trim: 'Trim/baseboard labor and materials.',
  glass_door:
    'Glass shower door / enclosure — material and install. Towel bars/accessories separate.',
  drywall:
    'Wall/ceiling surface sqft (not floor area). Patch or replace after layout changes.',
  cabinets: 'Cabinet and vanity LF — kitchen, baths, laundry.',
  countertops: 'Countertop sqft — kitchen, baths, and elsewhere.',
  mep_rough:
    'Planning comparison only — price plumbing / electrical / HVAC trades separately.',
  exterior:
    'Planning comparison only — price roofing, windows/doors, and stucco separately.',
  interior_finishes:
    'Planning comparison only — price drywall, paint, cabinets, counters, and tile separately.',
  sitework:
    'Planning comparison only — price excavation and other site trades separately.',
  plumbing_rough: 'Rough-in points (supply/drain) for material and labor.',
  electrical_rough: 'Circuits / boxes / devices for material and labor.',
  hvac: 'System count (or tons) for material and labor — not living SF.',
  windows: 'Window count for material and labor.',
  exterior_doors:
    'Swing entry/exit doors including iron/specialty entry — material and install. Not sliding, garage, or site gates.',
  sliding_doors:
    'Patio / multi-panel sliding doors — material and install. Large multi-panel packages vary widely.',
  garage_doors:
    'Priced by type: single (~$1,800), double (~$2,400), RV (~$8,300). Double+RV ≈ $10,700 locally.',
  windows_doors: 'Opening count for material and labor.',
  excavation: 'Excavation CY for material and labor.',
  landscaping:
    'Landscaping, exterior site walls, fences & gates package. Not driveway flatwork or iron entry doors.',
  foundation: 'Foundation / slab concrete CY for material and labor.',
  pour_flatwork:
    'Driveway, walkways, porch, and exterior patio slabs — not the house or garage slab.',
  plumbing_trim:
    'Plumbing fixtures and trim-out package. Not plumbing rough-in.',
  electrical_trim:
    'Light fixtures and finish electrical — material and install. Not electrical rough-in.',
  roofing: 'Roof squares for material and labor.',
  paint_trim: 'Wall/ceiling paint surface sqft for material and labor.',
  interior_paint:
    'Paintable wall/ceiling SF (physical). Local budgets are installed lump sums.',
  exterior_paint:
    'Exterior paint application for siding, stucco, soffit, and fascia. Prep, masking, heavy repairs, access work, and specialty coatings are separate.',
  interior_trim:
    'Finish trim, interior doors, door hardware & shelving package until detailed takeoff.',
  plumbing_trim:
    'Set fixtures and finish connections — excludes toilet/vanity when those are separate scope lines.',
  electrical_trim: 'Devices, plates, and bulbs.',
  permits: 'Confirm permit and impact fees for the project jurisdiction.',
  cleanup:
    'Final project cleaning and debris from other scopes. Flooring demolition already includes normal loading, haul-off, and disposal; additional dumpsters, excessive hauling, and hazardous-material handling are separate.',
};

export function checklistDisplayHelper(
  item: ScopeChecklistItem,
  templateKey?: string | null
): string | undefined {
  if (
    templateKey === 'kitchen' &&
    KITCHEN_CHECKLIST_HELPER_OVERRIDES[item.id]
  ) {
    return KITCHEN_CHECKLIST_HELPER_OVERRIDES[item.id];
  }
  if (
    templateKey === 'bathroom' &&
    BATHROOM_CHECKLIST_HELPER_OVERRIDES[item.id]
  ) {
    return BATHROOM_CHECKLIST_HELPER_OVERRIDES[item.id];
  }
  return CHECKLIST_HELPER_OVERRIDES[item.id] || item.helperText;
}

export function checklistDisplayLabel(
  item: ScopeChecklistItem,
  templateKey?: string | null
): string {
  if (
    templateKey === 'bathroom' &&
    BATHROOM_CHECKLIST_LABEL_OVERRIDES[item.id]
  ) {
    return BATHROOM_CHECKLIST_LABEL_OVERRIDES[item.id];
  }
  if (templateKey === 'kitchen' && KITCHEN_CHECKLIST_LABEL_OVERRIDES[item.id]) {
    return KITCHEN_CHECKLIST_LABEL_OVERRIDES[item.id];
  }
  return item.label;
}

export const QUANTITY_NEEDED_LABELS_BY_TEMPLATE: Record<
  string,
  Record<string, string>
> = {
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
    plumbing_rough:
      'fixture type, work type, plumbing exposure & floor construction',
  },
};

export function quantityNeededLabel(
  itemId: string,
  templateKey: string | null | undefined,
  fallbackUnit: string
): string {
  const byTemplate =
    templateKey && QUANTITY_NEEDED_LABELS_BY_TEMPLATE[templateKey]?.[itemId];
  if (byTemplate) return byTemplate;
  return formatUnitLabel(fallbackUnit);
}

export type ScopeChecklistGroup = {
  title: string;
  itemIds: string[];
};

export const SCOPE_CHECKLIST_GROUPS: Record<string, ScopeChecklistGroup[]> = {
  bathroom: [
    {
      title: 'Demo',
      itemIds: [
        'demo',
        'floor_demo',
        'tub_demo',
        'shower_floor_demo',
        'vanity_demo',
        'countertop_demo',
      ],
    },
    {
      title: 'Wet area finish',
      itemIds: [
        'waterproofing',
        'wet_area_install',
        'tub_install',
        'prefab_shower_pan',
        'prefab_shower_enclosure',
        'shower_pan',
        'shower_tile',
        'shower_floor_tile',
        'shower_niche',
        'shower_bench',
        'glass_door',
      ],
    },
    { title: 'Bathroom Floor', itemIds: ['floor_tile'] },
    {
      title: 'Fixtures',
      itemIds: [
        'toilet',
        'vanity',
        'countertops',
        'lighting',
        'exhaust_fan',
        'mirror_accessories',
      ],
    },
    {
      title: 'Trades',
      itemIds: [
        'plumbing_rough',
        'electrical_rough',
        'floor_prep',
        'paint_repair',
        'trim',
      ],
    },
    {
      title: 'Trim-out & Closeout',
      itemIds: ['plumbing_trim', 'electrical_trim', 'permits', 'cleanup'],
    },
  ],
  kitchen: [
    {
      title: 'Demo',
      itemIds: ['demo', 'backsplash_demo', 'floor_demo', 'wall_demo'],
    },
    { title: 'Appliances', itemIds: ['appliance_removal', 'appliances'] },
    {
      title: 'Cabinets & Counters',
      itemIds: [
        'cabinets',
        'countertops',
        'sink_faucet',
        'garbage_disposal',
        'cabinet_hardware',
        'island',
      ],
    },
    {
      title: 'Tile & Flooring',
      itemIds: ['backsplash', 'flooring', 'floor_prep'],
    },
    {
      title: 'Trades',
      itemIds: [
        'plumbing',
        'electrical',
        'lighting',
        'drywall',
        'paint',
        'trim',
        'walls_moving',
      ],
    },
    { title: 'Closeout', itemIds: ['permits', 'cleanup'] },
  ],
  landscaping: [
    {
      title: 'Sitework',
      itemIds: ['demo_clearing', 'grading', 'soil_prep', 'drainage'],
    },
    {
      title: 'Landscape',
      itemIds: [
        'irrigation',
        'sod_turf',
        'artificial_turf',
        'rock',
        'mulch',
        'plants',
        'trees',
        'landscape_boulders',
      ],
    },
    { title: 'Hardscape', itemIds: ['pavers', 'concrete'] },
    { title: 'Electrical', itemIds: ['landscape_lighting'] },
    { title: 'Closeout', itemIds: ['mobilization', 'cleanup'] },
  ],
  plumbing_service: [
    {
      title: 'Service',
      itemIds: [
        'service_call',
        'fixture_repair',
        'fixture_replace',
        'drain_cleaning',
      ],
    },
    {
      title: 'Lines & Rough',
      itemIds: [
        'water_line',
        'sewer_line',
        'plumbing_rough',
        'plumbing_trim',
        'parts_materials',
      ],
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
    {
      title: 'Preconstruction',
      itemIds: ['plans_engineering', 'permits', 'utility_coordination'],
    },
    {
      title: 'Sitework',
      itemIds: ['sitework', 'excavation', 'grading', 'utility_trenching'],
    },
    { title: 'Foundation', itemIds: ['foundation', 'concrete'] },
    {
      title: 'Shell',
      itemIds: ['framing', 'roof_tie_in', 'windows_doors', 'exterior_finishes'],
    },
    {
      title: 'MEP Rough-ins',
      itemIds: ['plumbing_rough', 'electrical_rough', 'hvac'],
    },
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
    {
      title: 'Sitework',
      itemIds: ['sitework', 'excavation', 'utility_taps', 'landscaping'],
    },
    {
      title: 'Structure',
      itemIds: [
        'foundation',
        'pour_flatwork',
        'framing',
        'roofing',
        'exterior',
        'windows',
        'exterior_doors',
        'sliding_doors',
        'garage_doors',
        'stucco',
      ],
    },
    {
      title: 'MEP & Envelope',
      itemIds: [
        'mep_rough',
        'plumbing_rough',
        'electrical_rough',
        'hvac',
        'plumbing_trim',
        'electrical_trim',
        'insulation',
      ],
    },
    {
      title: 'Finishes',
      itemIds: [
        'interior_finishes',
        'drywall',
        'cabinets',
        'countertops',
        'tile_flooring',
        'interior_paint',
        'exterior_paint',
        'interior_trim',
        'appliances',
      ],
    },
    {
      title: 'Wet area finish',
      itemIds: ['floor_tile', 'shower_tile', 'shower_floor_tile', 'glass_door'],
    },
    { title: 'Closeout', itemIds: ['contingency', 'cleanup'] },
  ],
  room_remodel: [
    { title: 'Scope', itemIds: ['demo', 'cleanup'] },
    { title: 'Trades', itemIds: ['framing', 'plumbing', 'electrical', 'hvac'] },
    { title: 'Finishes', itemIds: ['drywall', 'flooring', 'paint', 'trim'] },
    { title: 'Closeout', itemIds: ['permits'] },
  ],
  roofing: [
    { title: 'Roofing System', itemIds: ['roofing_system', 'shingles_roofing'] },
    {
      title: 'Existing Roof / Tear-Off',
      itemIds: [
        'tear_off',
      ],
    },
    {
      title: 'Underlayment & Waterproofing',
      itemIds: ['underlayment', 'ice_water_shield'],
    },
    {
      title: 'Decking / Substrate',
      itemIds: ['decking_repair'],
    },
    {
      title: 'Flashing & Edge Accessories',
      itemIds: [
        'drip_edge',
        'ridge_cap',
        'valley_flashing',
        'step_flashing',
        'wall_flashing',
      ],
    },
    {
      title: 'Roof Ventilation',
      itemIds: ['ridge_vent', 'roof_vents', 'turbine_vents'],
    },
    {
      title: 'Penetrations & Special Flashing',
      itemIds: [
        'pipe_boots',
        'chimney_flashing',
        'skylight_flashing',
        'roof_penetrations',
      ],
    },
    {
      title: 'Pitch / Complexity / Access',
      itemIds: ['roof_pitch_complexity_access'],
    },
    {
      title: 'Roofing Repairs',
      itemIds: ['roof_repairs'],
    },
    {
      title: 'Exclusions / Confirmations',
      itemIds: ['roof_exclusions'],
    },
    {
      title: 'Other / Drainage',
      itemIds: ['gutters', 'downspouts'],
    },
    {
      title: 'Closeout',
      itemIds: [
        'permits',
        'cleanup',
      ],
    },
  ],
  hvac: [
    { title: 'Service', itemIds: ['service_call'] },
    {
      title: 'Equipment',
      itemIds: ['equipment_replace', 'refrigerant', 'thermostat'],
    },
    { title: 'Distribution', itemIds: ['ductwork', 'ventilation'] },
    { title: 'Closeout', itemIds: ['permits', 'cleanup'] },
  ],
  deck_patio: [
    { title: 'Demo', itemIds: ['demo_removal'] },
    { title: 'Structure', itemIds: ['footings_piers', 'framing_structure'] },
    {
      title: 'Surface',
      itemIds: ['decking', 'railing', 'stairs', 'staining_sealing'],
    },
    { title: 'Hardscape', itemIds: ['concrete_patio'] },
    { title: 'Closeout', itemIds: ['permits', 'cleanup'] },
  ],
  concrete: [
    {
      title: 'Additional work',
      itemIds: [
        'demo_removal',
        'site_prep',
        'excavation',
        'reinforcement',
        'complex_forming',
      ],
    },
    { title: 'Pour', itemIds: ['pour_flatwork', 'pour_foundation'] },
    {
      title: 'Upgrades / disposal',
      itemIds: ['concrete_sealer', 'decorative_finish', 'additional_haul_off'],
    },
  ],
  excavation: [
    { title: 'Sitework', itemIds: ['mobilization', 'clearing'] },
    {
      title: 'Earthwork',
      itemIds: ['excavation', 'trenching', 'grading', 'backfill'],
    },
    { title: 'Closeout', itemIds: ['haul_off', 'cleanup'] },
  ],
  drywall: [
    {
      title: 'Drywall',
      itemIds: [
        'demo_removal',
        'hang',
        'finish_tape',
        'texture',
        'patch_repair',
      ],
    },
    { title: 'Closeout', itemIds: ['cleanup'] },
  ],
  painting: [
    {
      title: 'Interior painting',
      itemIds: [
        'prep',
        'interior_paint',
        'ceiling_paint',
        'trim_paint',
        'door_paint',
        'cabinet_paint',
      ],
    },
    { title: 'Closeout', itemIds: ['cleanup'] },
  ],
  electrical: electricalChecklistGroups(),
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

  const byId = new Map(items.map(i => [i.id, i]));
  const used = new Set<string>();
  const result: Array<{ title: string; items: ScopeChecklistItem[] }> = [];

  for (const group of groups) {
    const groupItems = group.itemIds
      .map(id => byId.get(id))
      .filter((i): i is ScopeChecklistItem => Boolean(i));
    groupItems.forEach(i => used.add(i.id));
    if (groupItems.length)
      result.push({ title: group.title, items: groupItems });
  }

  const remainder = items.filter(i => !used.has(i.id));
  if (remainder.length) result.push({ title: 'Other', items: remainder });

  return result;
}

export function scopeChecklistSummaryCounts(
  items: ScopeChecklistItem[],
  needsMeasurement: number
): {
  included: number;
  unsure: number;
  excluded: number;
  needsMeasurement: number;
} {
  let included = 0;
  let unsure = 0;
  let excluded = 0;
  for (const item of items) {
    if (item.inputType === 'multi_choice') {
      const ids = item.choiceIds ?? [];
      if (ids.includes('not_in_scope')) excluded += 1;
      else if (!ids.length || (ids.length === 1 && ids.includes('unsure')))
        unsure += 1;
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

/** All scope groups start expanded on Confirm Scope — users can still collapse manually. */
export function initialScopeGroupCollapse(
  grouped: Array<{ title: string; items: ScopeChecklistItem[] }>,
  _measurements: NormalizedScopeMeasurements,
  _templateKey?: string | null,
  _notes?: string | null
): Record<string, boolean> {
  const collapsed: Record<string, boolean> = {};
  for (const group of grouped) {
    if (!group.title) continue;
    collapsed[group.title] = false;
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

export type ScopeItemNeedingConfirmation = {
  itemId: string;
  label: string;
  reason?: string;
};

export type ScopePricingQuestionsOptions = {
  templateKey?: string | null;
  notes?: string | null;
  pricingAcceptance?: Record<
    string,
    import('@/utils/estimateAiDraft').ScopePricingAcceptanceMetadata
  >;
  bathroomPaintRepairScope?: string | null;
  bathroomPaintRepairEntireRoom?: boolean | null;
  bathroomToiletRelocateFloorType?: string | null;
  bathroomVanityCountertopMaterialType?: string | null;
};

/** True when a scope card still shows unanswered Step 2 pricing prompts (not takeoff-only gaps). */
export function scopeItemNeedsPricingQuestions(
  item: ScopeChecklistItem,
  measurements: NormalizedScopeMeasurements,
  options?: ScopePricingQuestionsOptions
): ScopeItemNeedingConfirmation | null {
  const templateKey = options?.templateKey;
  const notes = options?.notes;
  const visualCtx = { measurements, templateKey, notes };

  if (WET_AREA_DEMO_EMBEDDED_IDS.has(item.id)) return null;
  if (
    hasAcceptedScopePricing(
      item.id,
      measurements.itemQuantities,
      options?.pricingAcceptance
    )
  ) {
    return null;
  }

  const tierConfig = resolveStep2PricingTier(item.id, templateKey);
  const label = checklistDisplayLabel(item, templateKey);

  if (item.inputType === 'choice') {
    if (item.choiceId && item.choiceId !== 'unsure') {
      if (
        item.id === 'toilet' &&
        item.choiceId === 'relocating' &&
        !options?.bathroomToiletRelocateFloorType
      ) {
        return { itemId: item.id, label, reason: 'Select floor type' };
      }
      return null;
    }
    if (
      tierConfig.tier !== 'prompt_first' &&
      !BATHROOM_ALWAYS_VISIBLE_SCOPE_IDS.has(item.id)
    ) {
      return null;
    }
    if (
      BATHROOM_ALWAYS_VISIBLE_SCOPE_IDS.has(item.id) ||
      scopeItemHasNoteSignal(item, visualCtx)
    ) {
      return { itemId: item.id, label, reason: 'Pick scope option' };
    }
    return null;
  }

  if (!checklistItemInScope(item)) return null;
  if (tierConfig.tier !== 'prompt_first') return null;

  switch (tierConfig.promptKey) {
    case 'paint_repair_scope':
      if (
        !hasPaintRepairScopeSelection({
          localizedScope: options?.bathroomPaintRepairScope,
          entireRoom: options?.bathroomPaintRepairEntireRoom,
          legacyScope: options?.bathroomPaintRepairScope,
        })
      ) {
        return { itemId: item.id, label, reason: 'Select paint scope' };
      }
      return null;
    case 'vanity_countertop_material': {
      const materialType = resolveBathroomVanityCountertopMaterialType({
        storedType: options?.bathroomVanityCountertopMaterialType,
        notes,
      });
      if (materialType === 'unknown') {
        return { itemId: item.id, label, reason: 'Select countertop material' };
      }
      return null;
    }
    default:
      // plumbing rough, glass door, interior paint — defaults allow Apply without more prompts.
      return null;
  }
}

/** Scope rows with unanswered pricing prompts — e.g. toilet fixture choice, paint scope chips. */
export function listScopeItemsNeedingConfirmation(
  items: ScopeChecklistItem[],
  measurements: NormalizedScopeMeasurements,
  options?: ScopePricingQuestionsOptions
): ScopeItemNeedingConfirmation[] {
  const results: ScopeItemNeedingConfirmation[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const pending = scopeItemNeedsPricingQuestions(item, measurements, options);
    if (!pending || seen.has(pending.itemId)) continue;
    seen.add(pending.itemId);
    results.push(pending);
  }

  return results;
}

export function markAllUnsureAsExcluded(
  items: ScopeChecklistItem[]
): ScopeChecklistItem[] {
  return items.map(item => {
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
