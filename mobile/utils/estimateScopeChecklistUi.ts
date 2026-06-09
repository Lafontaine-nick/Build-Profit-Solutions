import type { ScopeChecklistItem, ScopeChecklistOption } from '@/utils/estimateAiDraft';

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
  { id: 'no_changes', label: 'No wall changes' },
  { id: 'remove', label: 'Removing wall(s)' },
  { id: 'add', label: 'Adding / moving wall(s)' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

/** Items that must use pick-one chips — never Yes/No. */
const CHOICE_ITEM_CONFIG: Record<
  string,
  { label: string; helperText: string; options: ScopeChecklistOption[] }
> = {
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
    helperText: 'Any walls removed or moved?',
    options: WALL_CHOICE_OPTIONS,
  },
};

function labelLooksLikeChoiceQuestion(label: string): boolean {
  const t = label.toLowerCase();
  return (
    /\b(staying|replacing|relocating)\b/.test(t) &&
    (/\bor\b/.test(t) || /—/.test(label) || /\?/.test(t))
  );
}

function isChoiceItem(item: ScopeChecklistItem): boolean {
  if (item.inputType === 'choice') return true;
  if (CHOICE_ITEM_CONFIG[item.id]) return true;
  return labelLooksLikeChoiceQuestion(item.label);
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

export function normalizeScopeChecklistItems(items: ScopeChecklistItem[]): ScopeChecklistItem[] {
  return items.map(normalizeScopeChecklistItem);
}
