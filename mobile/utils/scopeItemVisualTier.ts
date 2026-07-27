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

export type ScopeItemNoteBadge = 'prefilled' | 'mentioned' | 'from_photo' | 'review';

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
  secondary: 0.55,
  muted: 0.35,
};

/** Bathroom fixture rows that stay visible even when notes/photos omit them. */
export const BATHROOM_ALWAYS_VISIBLE_SCOPE_IDS = new Set(['toilet']);

export type ScopeItemVisualContext = {
  notes?: string | null;
  templateKey?: string | null;
  measurements: NormalizedScopeMeasurements;
};

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
  if (checklistItemInScope(item)) return 'primary';
  if (scopeItemHasNoteSignal(item, ctx)) return 'primary';
  return 'secondary';
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
