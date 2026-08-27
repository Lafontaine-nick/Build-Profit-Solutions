import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  inferChoiceFromNotes,
  inferChoicesFromNotes,
  inferItemStateFromNotes,
} from '@/utils/scopeItemNoteHints';
import {
  checklistItemInScope,
  resolveChecklistItemQuantity,
  type NormalizedScopeMeasurements,
} from '@/utils/scopeItemQuantities';

export type ScopeItemVisualTier = 'primary' | 'secondary' | 'muted';

export type ScopeItemNoteBadge =
  | 'prefilled'
  | 'mentioned'
  | 'from_photo'
  | 'from_plan'
  | 'review';

function notesIncludeSitePhotos(notes: string | null | undefined): boolean {
  const n = String(notes || '');
  return /---\s*Site photos\s*---|Detected from site photos/i.test(n);
}

function maybePhotoBadge(
  badge: ScopeItemNoteBadge,
  notes: string | null | undefined
): ScopeItemNoteBadge {
  if (badge === 'mentioned' && notesIncludeSitePhotos(notes)) return 'from_photo';
  return badge;
}

export const SCOPE_ITEM_TIER_OPACITY: Record<ScopeItemVisualTier, number> = {
  primary: 1,
  secondary: 1,
  muted: 0.35,
};

/** Not-sure cards stay readable but sit below Yes / included cards. */
export const SCOPE_ITEM_UNSURE_OPACITY = 0.82;

export type ScopeCardAccent = {
  opacity: number;
  backgroundColor?: string;
  borderColor?: string;
};

/** Bathroom fixture rows that stay visible even when notes/photos omit them. */
export const BATHROOM_ALWAYS_VISIBLE_SCOPE_IDS = new Set(['toilet']);

export type ScopeItemVisualContext = {
  notes?: string | null;
  templateKey?: string | null;
  measurements: NormalizedScopeMeasurements;
};

const ROOFING_SELECTION_ALIASES: Record<string, string[]> = {
  tear_off: ['tear_off'],
  roofing_system: ['roofing_system', 'shingles', 'shingles_roofing'],
  shingles_roofing: ['shingles', 'shingles_roofing'],
  roof_repairs: ['roof_repairs'],
  underlayment: ['underlayment'],
  ice_water_shield: ['ice_water_shield'],
};

const ROOFING_QM_MEASUREMENT_SIGNALS: Record<
  string,
  {
    aliases: string[];
    measurementValue: (measurements: NormalizedScopeMeasurements) => number;
  }
> = {
  tear_off: {
    aliases: ['tear_off'],
    measurementValue: measurements => Number(measurements.roofSquares) || 0,
  },
  roofing_system: {
    aliases: ['shingles', 'shingles_roofing'],
    measurementValue: measurements => Number(measurements.roofSquares) || 0,
  },
  shingles_roofing: {
    aliases: ['shingles', 'shingles_roofing'],
    measurementValue: measurements => Number(measurements.roofSquares) || 0,
  },
  roof_repairs: {
    aliases: ['roof_repairs'],
    measurementValue: measurements =>
      Number(measurements.roofRepairAffectedSqft) || 0,
  },
};

function roofingQmHasMeasurement(
  itemId: string,
  measurements: NormalizedScopeMeasurements
): boolean {
  const signal = ROOFING_QM_MEASUREMENT_SIGNALS[itemId];
  if (!signal) return false;
  const selections = measurements.tradeScopeSelections?.roofing;
  if (!Array.isArray(selections)) return false;
  if (!signal.aliases.some(alias => selections.includes(alias))) return false;
  return signal.measurementValue(measurements) > 0;
}

/** Confirm-scope card still needs a choice/state after QM takeoff is entered. */
function roofingCardNeedsConfirmation(item: ScopeChecklistItem): boolean {
  if (item.id === 'tear_off') {
    return (
      !item.choiceId ||
      item.choiceId === 'unsure' ||
      item.choiceId === 'new_construction'
    );
  }
  if (item.id === 'roofing_system') {
    return (
      !item.choiceId ||
      item.choiceId === 'unsure' ||
      item.choiceId === 'not_in_scope'
    );
  }
  if (item.id === 'roof_repairs') {
    if (item.state === 'excluded' || item.choiceId === 'not_in_scope') {
      return true;
    }
    return !item.choiceId || item.choiceId === 'unsure';
  }
  if (item.id === 'shingles_roofing') {
    return !checklistItemInScope(item);
  }
  return !checklistItemInScope(item);
}

export function scopeItemHasMeasuredSelection(
  item: ScopeChecklistItem,
  ctx: ScopeItemVisualContext
): boolean {
  if (String(ctx.templateKey || '').toLowerCase() !== 'roofing') return false;

  if (
    roofingQmHasMeasurement(item.id, ctx.measurements) &&
    roofingCardNeedsConfirmation(item)
  ) {
    return true;
  }

  const selections = ctx.measurements.tradeScopeSelections?.roofing;
  if (!Array.isArray(selections)) return false;
  const aliases = ROOFING_SELECTION_ALIASES[item.id] || [item.id];
  if (!selections.some(selection => aliases.includes(String(selection)))) {
    return false;
  }
  const resolved = resolveChecklistItemQuantity(item.id, ctx.measurements, {
    choiceId: item.choiceId,
    templateKey: ctx.templateKey,
    notes: ctx.notes,
  });
  return Number(resolved.quantity) > 0;
}

function itemIsExcluded(item: ScopeChecklistItem): boolean {
  if (item.inputType === 'multi_choice') {
    return (item.choiceIds ?? []).includes('not_in_scope');
  }
  if (item.inputType === 'choice') {
    return item.choiceId === 'not_in_scope';
  }
  return item.state === 'excluded';
}

function itemPricingFromNotes(item: ScopeChecklistItem, ctx: ScopeItemVisualContext): boolean {
  const resolved = resolveChecklistItemQuantity(item.id, ctx.measurements, {
    choiceId: item.choiceId,
    templateKey: ctx.templateKey,
    notes: ctx.notes,
  });
  return resolved.pricingReady && resolved.quantitySource === 'notes';
}

const PLAN_MEASUREMENT_KEYS_BY_SCOPE: Record<string, string[]> = {
  stucco: ['stuccoNetWallSqft'],
  stucco_soffits: ['stuccoSoffitSqft'],
  stucco_parapets: ['stuccoParapetSqft'],
  stucco_foam_trim: ['stuccoFoamTrimLf'],
  stucco_other_finish: ['stuccoOtherFinishDeductionSqft'],
};

function itemMeasuredFromPlan(
  item: ScopeChecklistItem,
  ctx: ScopeItemVisualContext
): boolean {
  const sourceMap = ctx.measurements.quickMeasurementSources || {};
  const planTags = new Set([
    'plan_detected',
    'plan_vision',
    'plan_explicit',
    'detected_from_plan',
  ]);
  return (PLAN_MEASUREMENT_KEYS_BY_SCOPE[item.id] || []).some(key => {
    const value = Number(
      String((ctx.measurements as Record<string, unknown>)[key] ?? '').replace(
        /,/g,
        ''
      )
    );
    return value > 0 && planTags.has(String(sourceMap[key] || ''));
  });
}

function itemMentionedInNotes(item: ScopeChecklistItem, ctx: ScopeItemVisualContext): boolean {
  const notes = ctx.notes;
  if (item.noteBacked) return true;
  if (!String(notes || '').trim()) return false;

  if (inferItemStateFromNotes(item.id, notes) !== 'unsure') return true;
  if (item.inputType === 'choice' && inferChoiceFromNotes(item.id, notes)) return true;
  if (item.inputType === 'multi_choice' && inferChoicesFromNotes(item.id, notes).length > 0) return true;

  if (ctx.templateKey === 'kitchen' && item.id === 'appliance_removal') {
    if (inferItemStateFromNotes('appliances', notes) === 'included') return true;
  }

  return false;
}

/** Notes mention this item (yes/no hint, choice, measurement pricing, or kitchen removal inference). */
export function scopeItemHasNoteSignal(item: ScopeChecklistItem, ctx: ScopeItemVisualContext): boolean {
  return itemMentionedInNotes(item, ctx) || itemPricingFromNotes(item, ctx);
}

/** Green badge: prefilled qty/pricing parsed from notes, or mentioned-only when in scope. */
export function scopeItemNoteBadge(
  item: ScopeChecklistItem,
  ctx: ScopeItemVisualContext
): ScopeItemNoteBadge | null {
  const notes = ctx.notes;
  if (checklistItemInScope(item) && itemMeasuredFromPlan(item, ctx)) {
    return 'from_plan';
  }
  if (!String(notes || '').trim() && !item.noteBacked) return null;

  if (itemPricingFromNotes(item, ctx) && checklistItemInScope(item)) return 'prefilled';

  const resolved = resolveChecklistItemQuantity(item.id, ctx.measurements, {
    choiceId: item.choiceId,
    templateKey: ctx.templateKey,
    notes: ctx.notes,
  });
  if (checklistItemInScope(item) && itemMentionedInNotes(item, ctx) && resolved.showInput && !resolved.pricingReady) {
    return 'review';
  }

  if (item.noteBacked && checklistItemInScope(item)) return maybePhotoBadge('mentioned', notes);

  if (itemIsExcluded(item) && inferItemStateFromNotes(item.id, notes) === 'excluded') {
    return maybePhotoBadge('mentioned', notes);
  }

  if (item.inputType === 'choice' && item.choiceId && item.choiceId !== 'unsure') {
    const inferred = inferChoiceFromNotes(item.id, notes);
    if (inferred && inferred === item.choiceId) return maybePhotoBadge('mentioned', notes);
  }

  if (item.inputType === 'multi_choice') {
    const inferred = inferChoicesFromNotes(item.id, notes);
    const choiceIds = item.choiceIds ?? [];
    if (inferred.length && inferred.some((id) => choiceIds.includes(id))) {
      return maybePhotoBadge('mentioned', notes);
    }
  }

  if (item.state === 'included' && inferItemStateFromNotes(item.id, notes) === 'included') {
    return itemPricingFromNotes(item, ctx)
      ? 'prefilled'
      : maybePhotoBadge('mentioned', notes);
  }

  if (
    ctx.templateKey === 'kitchen' &&
    item.id === 'appliance_removal' &&
    item.state === 'included' &&
    inferItemStateFromNotes('appliances', notes) === 'included'
  ) {
    return maybePhotoBadge('mentioned', notes);
  }

  return null;
}

/** @deprecated Use scopeItemNoteBadge */
export function scopeItemShowsFromNotesBadge(item: ScopeChecklistItem, ctx: ScopeItemVisualContext): boolean {
  return scopeItemNoteBadge(item, ctx) != null;
}

export function scopeItemVisualTier(item: ScopeChecklistItem, ctx: ScopeItemVisualContext): ScopeItemVisualTier {
  if (itemIsExcluded(item)) return 'muted';
  if (ctx.templateKey === 'bathroom' && BATHROOM_ALWAYS_VISIBLE_SCOPE_IDS.has(item.id)) {
    return 'primary';
  }
  if (
    String(ctx.templateKey || '').toLowerCase() === 'roofing' &&
    roofingQmHasMeasurement(item.id, ctx.measurements) &&
    roofingCardNeedsConfirmation(item)
  ) {
    return 'primary';
  }
  if (checklistItemInScope(item)) return 'primary';
  if (scopeItemHasNoteSignal(item, ctx)) return 'primary';
  return 'secondary';
}

export function scopeItemIsUnsure(
  item: Pick<ScopeChecklistItem, 'state' | 'choiceId' | 'inputType' | 'choiceIds'>
): boolean {
  if (item.state === 'unsure') return true;
  if (item.choiceId === 'unsure') return true;
  const ids = item.choiceIds ?? [];
  return item.inputType === 'multi_choice' && ids.length === 1 && ids[0] === 'unsure';
}

/** Card chrome — one surface color on Confirm Scope; tier/unsure only adjusts opacity. */
export function scopeCardAccentForItem(
  tier: ScopeItemVisualTier,
  item: Pick<
    ScopeChecklistItem,
    'state' | 'choiceId' | 'inputType' | 'choiceIds' | 'noteBacked'
  >,
  darkMode: boolean,
  measuredSelection = false
): ScopeCardAccent {
  const standardSurface = darkMode ? '#202022' : 'rgba(248, 250, 252, 0.96)';
  const standardBorder = darkMode
    ? 'rgba(148, 163, 184, 0.12)'
    : 'rgba(148, 163, 184, 0.22)';

  if (tier === 'muted' || itemIsExcluded(item as ScopeChecklistItem)) {
    return { opacity: SCOPE_ITEM_TIER_OPACITY.muted };
  }
  if (measuredSelection) {
    return {
      opacity: 1,
      backgroundColor: darkMode
        ? 'rgba(251, 191, 36, 0.14)'
        : 'rgba(251, 191, 36, 0.12)',
      borderColor: '#fbbf24',
    };
  }
  const qmBackedIncluded =
    item.state === 'included' && item.noteBacked === true;
  if (scopeItemIsUnsure(item) && !qmBackedIncluded) {
    return {
      opacity: SCOPE_ITEM_UNSURE_OPACITY,
      backgroundColor: standardSurface,
      borderColor: standardBorder,
    };
  }
  if (tier === 'secondary') {
    return {
      opacity: 1,
      backgroundColor: standardSurface,
      borderColor: standardBorder,
    };
  }
  return {
    opacity: SCOPE_ITEM_TIER_OPACITY[tier],
    backgroundColor: standardSurface,
    borderColor: standardBorder,
  };
}

/** @deprecated Use scopeCardAccentForItem */
export function scopeCardOpacityForItem(
  tier: ScopeItemVisualTier,
  item: Pick<ScopeChecklistItem, 'state' | 'choiceId' | 'inputType' | 'choiceIds'>
): number {
  return scopeCardAccentForItem(tier, item, true).opacity;
}

export function scopeChecklistNoteSummary(
  items: ScopeChecklistItem[],
  ctx: ScopeItemVisualContext
): { fromNotes: number; toConfirm: number } {
  let fromNotes = 0;
  let toConfirm = 0;
  for (const item of items) {
    if (scopeItemNoteBadge(item, ctx)) fromNotes += 1;
    else if (scopeItemVisualTier(item, ctx) === 'secondary') toConfirm += 1;
  }
  return { fromNotes, toConfirm };
}

export function scopeItemVisualContextFromMeasurements(
  measurements: NormalizedScopeMeasurements,
  templateKey?: string | null,
  notes?: string | null
): ScopeItemVisualContext {
  return { notes, templateKey, measurements };
}
