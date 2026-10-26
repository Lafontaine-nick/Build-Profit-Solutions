/**
 * A paint-only note is the walls and ceilings it names.
 * "No flooring" does not turn the job into flooring.
 */

type ExplicitScopeItem = {
  id: string;
  inputType: 'yes_no';
  label: string;
  helperText: string;
  category: string;
  state: 'included';
  noteBacked: true;
};

const PAINT_WORK_RE = /\b(?:re)?paint(?:ing)?\b|\bpaintable\s+area\b/i;

const PAINT_COMPANION_RE =
  /\b(?:flooring|lvp|luxury\s+vinyl|vinyl\s+plank|laminate|carpet|hardwood|sheet\s+vinyl|vct|kitchen|bath(?:room)?|roof(?:ing)?|windows?|electrical|plumbing|hvac|drywall|sheetrock|siding|concrete|framing)\b/i;

function affirmativeNoteText(notes: string | null | undefined): string {
  return String(notes || '')
    .split(/\n+|(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(
      sentence =>
        sentence &&
        !/^(?:no|not|without|do not|don't|dont|never)\b/i.test(sentence)
    )
    .join(' ');
}

export function notesDescribeDedicatedPaintingJob(
  notes: string | null | undefined
): boolean {
  const affirmative = affirmativeNoteText(notes);
  if (!PAINT_WORK_RE.test(affirmative)) return false;
  if (
    /\b(?:kitchen|bath(?:room)?)\s+(?:remodel|renovation|refresh|reno)\b/i.test(
      affirmative
    ) ||
    /\b(?:whole|entire|full)\s+(?:existing\s+)?home\b/i.test(affirmative)
  ) {
    return false;
  }
  const stripped = affirmative.replace(
    /\b(?:re)?paint(?:ing)?\b|\bpaintable\b|\bprime\b|\bprep\b|\bpatches\b|\bfinish\s+coats?\b/gi,
    ' '
  );
  return !PAINT_COMPANION_RE.test(stripped);
}

export function dedicatedPaintingAreaSqft(
  notes: string | null | undefined
): number | null {
  const text = String(notes || '');
  const match =
    text.match(
      /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+of\s+paintable\s+area\b/i
    ) ||
    text.match(
      /\bpaintable\s+area\b[^.]{0,30}(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i
    );
  const value = Number(String(match?.[1] || '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function dedicatedPaintingLumpTotal(
  notes: string | null | undefined
): number | null {
  const text = String(notes || '');
  const match = text.match(
    /\blump\s+sum\s+\$?\s*(\d[\d,]*(?:\.\d+)?)|\b\$\s*(\d[\d,]*(?:\.\d+)?)\s+(?:for\s+)?(?:labor\s+and\s+materials?|materials?\s+and\s+labor)\b/i
  );
  const value = Number(String(match?.[1] || match?.[2] || '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function dedicatedPaintingRevealQuantity(
  itemId: string,
  measurements: {
    combinedPaintableAreaSqft?: unknown;
    paintAreaSqft?: unknown;
  } | null | undefined
): string | null {
  if (itemId !== 'interior_paint' && itemId !== 'paint') return null;
  const value = Number(
    String(
      measurements?.combinedPaintableAreaSqft ??
        measurements?.paintAreaSqft ??
        ''
    ).replace(/,/g, '')
  );
  return Number.isFinite(value) && value > 0 ? `${value} sqft` : null;
}

export function dedicatedPaintingConfirmScopeItems(
  notes: string | null | undefined
): ExplicitScopeItem[] {
  if (!notesDescribeDedicatedPaintingJob(notes)) return [];
  return [
    {
      id: 'interior_paint',
      inputType: 'yes_no',
      label: 'Interior painting',
      helperText: 'Walls and ceilings named in the notes.',
      category: 'paint',
      state: 'included',
      noteBacked: true,
    },
  ];
}
