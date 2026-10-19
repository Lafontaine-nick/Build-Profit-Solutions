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
    return id === 'stucco' || id.startsWith('custom_');
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
