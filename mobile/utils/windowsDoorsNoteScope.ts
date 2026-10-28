import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';

const COMPANION_TRADE =
  /\b(?:plumbing|hvac|framing|roof(?:ing)?|drywall|sheetrock|flooring|lvp|tile|cabinets?|concrete|foundation|insulat(?:e|ion|ed)|paint(?:ing)?|masking|casing|trim|landscap(?:e|ing)|electrical|stucco|siding)\b/i;

type OpeningKey =
  | 'windows'
  | 'exterior_doors'
  | 'interior_doors'
  | 'sliding_doors'
  | 'garage_doors';

export type DedicatedOpeningLine = {
  key: OpeningKey;
  label: string;
  ids: string[];
  count: number | null;
};

function positiveCount(value: unknown): number | null {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : null;
}

function lineDenied(notes: string, noun: string): boolean {
  return new RegExp(
    `\\b(?:no|not|without|don'?t|do not)\\s+(?:any\\s+|the\\s+)?(?:\\d+\\s+)?(?:${noun})\\b`,
    'i'
  ).test(notes);
}

function notesAreOpeningsOnly(notes: string | null | undefined): boolean {
  const text = String(notes || '');
  const namesOpening = /\b(?:windows?|doors?)\b/i.test(text);
  return namesOpening && !COMPANION_TRADE.test(text);
}

/** Windows and doors the note names. Unnamed trim, paint, and masking stay off. */
export function dedicatedWindowsDoorsNamedLines(
  notes: string | null | undefined
): DedicatedOpeningLine[] {
  if (!notesAreOpeningsOnly(notes)) return [];
  const text = String(notes || '');
  const parsed = parseScopeMeasurementsFromNotes(text, {
    templateKey: 'windows_doors',
  });
  const lines: DedicatedOpeningLine[] = [];
  if (/\bwindows?\b/i.test(text) && !lineDenied(text, 'windows?')) {
    lines.push({
      key: 'windows',
      label: 'Window install',
      ids: ['windows', 'window_install'],
      count: positiveCount(parsed.windowCount),
    });
  }
  if (
    /\b(?:exterior|entry)\s+doors?\b/i.test(text) &&
    !lineDenied(text, '(?:exterior|entry)\\s+doors?')
  ) {
    lines.push({
      key: 'exterior_doors',
      label: 'Exterior doors',
      ids: ['exterior_doors', 'exterior_door_install'],
      count: positiveCount(parsed.exteriorDoorCount),
    });
  }
  if (
    /\binterior\s+doors?\b/i.test(text) &&
    !lineDenied(text, 'interior\\s+doors?')
  ) {
    lines.push({
      key: 'interior_doors',
      label: 'Interior door installation',
      ids: ['interior_door_install', 'interior_doors'],
      count: positiveCount(parsed.interiorDoorCount),
    });
  }
  if (
    /\b(?:sliding|patio)\s+doors?\b/i.test(text) &&
    !lineDenied(text, '(?:sliding|patio)\\s+doors?')
  ) {
    lines.push({
      key: 'sliding_doors',
      label: 'Sliding / patio doors',
      ids: ['sliding_doors'],
      count: positiveCount(parsed.slidingDoorCount),
    });
  }
  if (/\bgarage\s+doors?\b/i.test(text) && !lineDenied(text, 'garage\\s+doors?')) {
    const garageCount = [
      parsed.garageDoorSingleCount,
      parsed.garageDoorDoubleCount,
      parsed.garageDoorRvCount,
    ]
      .map(positiveCount)
      .reduce((sum, count) => sum + (count || 0), 0);
    lines.push({
      key: 'garage_doors',
      label: 'Garage doors',
      ids: ['garage_doors'],
      count: garageCount > 0 ? garageCount : null,
    });
  }
  return lines;
}

export function notesDescribeDedicatedWindowsDoorsJob(
  notes: string | null | undefined
): boolean {
  return dedicatedWindowsDoorsNamedLines(notes).length > 0;
}

export function dedicatedWindowsDoorsRevealLines(
  notes: string | null | undefined
): string[] {
  return dedicatedWindowsDoorsNamedLines(notes).map(line =>
    line.count ? `${line.label} · ${line.count} each` : line.label
  );
}

export function dedicatedWindowsDoorsRevealRows(
  notes: string | null | undefined
): Array<{ name: string; amount: number; quantity?: string }> {
  return dedicatedWindowsDoorsNamedLines(notes).map(line => ({
    name: line.label,
    amount: 0,
    ...(line.count ? { quantity: `${line.count} each` } : {}),
  }));
}

export function filterDedicatedWindowsDoorsConfirmItems<
  T extends { id?: string | null; state?: string | null; noteBacked?: boolean | null },
>(
  items: T[],
  notes?: string | null,
  options?: { planBacked?: boolean }
): T[] {
  if (options?.planBacked) return items;
  if (!notesDescribeDedicatedWindowsDoorsJob(notes)) return items;
  const lines = dedicatedWindowsDoorsNamedLines(notes);
  const byId = new Map(items.map(item => [String(item.id || ''), item]));
  const named = lines.flatMap(line => {
    const item = line.ids
      .map(id => byId.get(id))
      .find((row): row is T => Boolean(row));
    if (!item) return [];
    return [
      {
        ...item,
        state: 'included' as T['state'],
        noteBacked: true,
      },
    ];
  });
  const custom = items.filter(item =>
    String(item.id || '').startsWith('custom_')
  );
  const removal = items.filter(item =>
    String(item.id || '').startsWith('opening_demo')
  );
  return [...named, ...removal, ...custom];
}
