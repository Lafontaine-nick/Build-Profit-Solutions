import { parseStuccoMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { notesDescribeGroundUpHome } from '@/utils/scopeItemNoteHints';

const COMPANION_TRADE =
  /\b(?:plumbing|hvac|framing|roof(?:ing)?|drywall|sheetrock|flooring|lvp|tile|cabinets?|concrete|foundation|insulat(?:e|ion|ed)|paint(?:ing)?|electrical|windows?|doors?|landscap(?:e|ing)|siding)\b/i;

function notesAreStuccoOnly(notes: string | null | undefined): boolean {
  const text = String(notes || '');
  if (notesDescribeGroundUpHome(text)) return false;
  const namesStucco = /\bstucco\b|\beifs\b/i.test(text);
  return namesStucco && !COMPANION_TRADE.test(text);
}

export function notesDescribeDedicatedStuccoJob(
  notes: string | null | undefined
): boolean {
  return notesAreStuccoOnly(notes);
}

export type StuccoInstallSystemId =
  | 'three_coat'
  | 'one_coat'
  | 'eifs'
  | 'finish_only';

/** A new stucco install is 3-coat or 1-coat. EIFS and a color coat stay off until the note names them. */
export function stuccoInstallSystemIds(
  notes?: string | null
): StuccoInstallSystemId[] {
  const text = String(notes || '');
  const ids: StuccoInstallSystemId[] = ['three_coat', 'one_coat'];
  if (/\beifs\b|\bsynthetic(?:\s+stucco)?\b/i.test(text)) ids.push('eifs');
  if (
    /\b(?:finish|color|texture)\s+coat\b|\brecoat\b|\bre-?stucco\b/i.test(text)
  ) {
    ids.push('finish_only');
  }
  return ids;
}

/**
 * "Stucco 1,200 sqft of exterior walls and replace 8 windows."
 * Those two lines are the job. A new house, and any other trade, stays off.
 */
export function notesNameStuccoWithWindows(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (!text.trim() || notesDescribeGroundUpHome(text)) return false;
  if (!/\bstucco\b|\beifs\b/i.test(text)) return false;
  if (
    !/\b(?:replace|replacement|install|new)\b[^.;\n]{0,40}\bwindows?\b|\bwindows?\b[^.;\n]{0,40}\b(?:replace|replacement|install)\b|\b\d[\d,]*\s+windows?\b/i.test(
      text
    )
  ) {
    return false;
  }
  const withoutWindows = text.replace(/\bwindows?\b/gi, ' ');
  return !/\b(?:plumbing|hvac|framing|roof(?:ing)?|drywall|sheetrock|flooring|lvp|tile|cabinets?|concrete|foundation|insulat(?:e|ion|ed)|paint(?:ing)?|electrical|doors?|landscap(?:e|ing)|siding|kitchen|bath(?:room)?|garage)\b/i.test(
    withoutWindows
  );
}

export function stuccoWithWindowsCount(
  notes: string | null | undefined
): number | null {
  const match = String(notes || '').match(/\b(\d[\d,]*)\s+windows?\b/i);
  const count = Number(String(match?.[1] || '').replace(/,/g, ''));
  return Number.isFinite(count) && count > 0 ? count : null;
}

/** Wall area the note already gave. Mesh and base coat stay inside this area. */
export function dedicatedStuccoWallSqft(
  notes: string | null | undefined
): number | null {
  const parsed = parseStuccoMeasurementsFromNotes(String(notes || ''));
  const net = Number(parsed.stuccoNetWallSqft);
  if (Number.isFinite(net) && net > 0) return net;
  const gross = Number(parsed.stuccoGrossWallSqft);
  if (Number.isFinite(gross) && gross > 0) return gross;
  return null;
}

export function dedicatedStuccoRevealLines(
  notes: string | null | undefined
): string[] {
  const sqft = dedicatedStuccoWallSqft(notes);
  const label = 'Stucco / exterior wall finish';
  return sqft ? [`${label} · ${sqft.toLocaleString()} sqft`] : [label];
}

/** Stucco wall area and the window count. Window install is the same trade. */
export function stuccoWithWindowsRevealRows(
  notes: string | null | undefined
): Array<{ id: string; name: string; quantity?: string }> {
  if (!notesNameStuccoWithWindows(notes)) return [];
  const sqft = dedicatedStuccoWallSqft(notes);
  const count = stuccoWithWindowsCount(notes);
  return [
    {
      id: 'stucco',
      name: 'Stucco / exterior wall finish',
      ...(sqft ? { quantity: `${sqft} sqft` } : {}),
    },
    {
      id: 'windows',
      name: 'Windows',
      ...(count ? { quantity: `${count} each` } : {}),
    },
  ];
}

export function dedicatedStuccoRevealRows(
  notes: string | null | undefined
): Array<{ name: string; amount: number; quantity?: string }> {
  const sqft = dedicatedStuccoWallSqft(notes);
  return [
    {
      name: 'Stucco / exterior wall finish',
      amount: 0,
      ...(sqft ? { quantity: `${sqft.toLocaleString()} sqft` } : {}),
    },
  ];
}

const STUCCO_WITH_WINDOWS_ITEMS = {
  stucco: {
    id: 'stucco',
    label: 'Stucco / exterior wall finish',
    helperText: 'Exterior wall area from the job notes.',
    category: 'exterior',
  },
  windows: {
    id: 'windows',
    label: 'Windows',
    helperText: 'Window count from the job notes.',
    category: 'exterior',
  },
} as const;

/** Keep stucco and the window count. The rest of a house shell is not this note. */
export function filterStuccoWithWindowsConfirmItems<
  T extends {
    id?: string | null;
    label?: string | null;
    state?: string | null;
    noteBacked?: boolean | null;
    inputType?: string | null;
    helperText?: string | null;
    category?: string | null;
  },
>(items: T[], notes?: string | null, options?: { planBacked?: boolean }): T[] {
  if (options?.planBacked) return items;
  if (!notesNameStuccoWithWindows(notes)) return items;
  const kept = items.filter(item => {
    const id = String(item.id || '');
    return id === 'stucco' || id === 'windows' || id.startsWith('custom_');
  });
  const withSeeds = (['stucco', 'windows'] as const).reduce((rows, id) => {
    if (rows.some(item => item.id === id)) return rows;
    return [
      ...rows,
      {
        ...STUCCO_WITH_WINDOWS_ITEMS[id],
        inputType: 'yes_no',
        state: 'included',
        noteBacked: true,
      } as T,
    ];
  }, kept);
  return withSeeds.map(item => {
    const id = String(item.id || '');
    const seed = id === 'stucco' || id === 'windows' ? STUCCO_WITH_WINDOWS_ITEMS[id] : null;
    if (!seed) return item;
    return {
      ...item,
      label: seed.label,
      helperText: seed.helperText,
      state: 'included' as T['state'],
      noteBacked: true,
      inputType: 'yes_no' as T['inputType'],
    };
  });
}

export function filterDedicatedStuccoConfirmItems<
  T extends {
    id?: string | null;
    state?: string | null;
    noteBacked?: boolean | null;
    inputType?: string | null;
  },
>(
  items: T[],
  notes?: string | null,
  options?: { planBacked?: boolean }
): T[] {
  if (options?.planBacked) return items;
  if (!notesDescribeDedicatedStuccoJob(notes)) return items;
  const named = items.filter(item => {
    const id = String(item.id || '');
    return (
      id === 'stucco' ||
      id === 'cladding_demo' ||
      id.startsWith('cladding_demo__') ||
      id.startsWith('custom_')
    );
  });
  return named.map(item =>
    item.id === 'stucco'
      ? {
          ...item,
          state: 'included' as T['state'],
          noteBacked: true,
          inputType: 'yes_no' as T['inputType'],
        }
      : item
  );
}
