import { parseInsulationAssembliesFromNotes } from '@/utils/scopeMeasurementParser';

const COMPANION_TRADE =
  /\b(?:plumbing|hvac|framing|roof(?:ing)?|drywall|sheetrock|flooring|lvp|tile|cabinets?|concrete|foundation|paint(?:ing)?|electrical|windows?|doors?|landscap(?:e|ing)|stucco|siding)\b/i;

function notesAreInsulationOnly(notes: string | null | undefined): boolean {
  const text = String(notes || '');
  const namesInsulation = /\binsulat(?:e|ion|ed)\b|\bR[-\s]?\d{2,3}\b/i.test(
    text
  );
  return namesInsulation && !COMPANION_TRADE.test(text);
}

/** Fresh note parse wins over a stored copy of the same note. Contractor edits stay. */
export function insulationAssembliesMatchingNote<
  T extends {
    location?: string | null;
    sqft?: number | string | null;
    rValue?: string | null;
    source?: string | null;
  },
>(stored: T[] | null | undefined, notes: string | null | undefined): T[] {
  const parsed = parseInsulationAssembliesFromNotes(String(notes || ''));
  const rows = Array.isArray(stored) ? stored : [];
  if (!parsed.length) return rows;
  if (rows.some(row => row?.source === 'contractor_entered')) return rows;
  const matches =
    rows.length === parsed.length &&
    parsed.every(parsedRow =>
      rows.some(row => {
        const sqft = Number(String(row?.sqft ?? '').replace(/,/g, ''));
        return (
          row?.location === parsedRow.location &&
          sqft === parsedRow.sqft &&
          String(row?.rValue || '').trim().toLowerCase() ===
            parsedRow.rValue.trim().toLowerCase()
        );
      })
    );
  if (matches) return rows;
  return parsed.map((row, index) => ({
    ...row,
    id: `notes_insulation_${index + 1}`,
    source: 'parsed_from_notes' as const,
    confirmed: true,
    battFacing:
      row.materialType === 'Batt' ? row.battFacing || 'not_sure' : null,
  })) as unknown as T[];
}

export function notesDescribeDedicatedInsulationJob(
  notes: string | null | undefined
): boolean {
  if (!notesAreInsulationOnly(notes)) return false;
  return parseInsulationAssembliesFromNotes(String(notes || '')).length > 0;
}

export function notesNameAirSealing(notes: string | null | undefined): boolean {
  return /\b(?:air[\s-]*seal(?:ing)?|gap\s+sealing)\b/i.test(String(notes || ''));
}

/** Wall area is named. A bare “insulation” mention is not a wall. */
export function insulationNoteNamesWallArea(
  notes: string | null | undefined
): boolean {
  return /\bwalls?\b/i.test(String(notes || ''));
}

const ATTIC_DRYWALL_OTHER_TRADE =
  /\b(?:kitchen|bath(?:room)?|shower|vanity|toilet|flooring|lvp|laminate|vinyl|carpet|cabinets?|countertops?|plumbing|electrical|hvac|roof(?:ing)?|windows?|doors?|tile|siding|concrete|framing|paint(?:ing)?|stucco)\b/i;

/** Attic insulation and a drywall hang in one note, with no other trade named. */
export function notesNameAtticInsulationWithDrywallHang(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (ATTIC_DRYWALL_OTHER_TRADE.test(text)) return false;
  if (
    /\b(?:whole|entire|full)\s+(?:existing\s+)?home\b|\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+home\b/i.test(
      text
    )
  ) {
    return false;
  }
  const namesInsulation = /\binsulat(?:e|ion|ed)\b|\bR[-\s]?\d{2,3}\b/i.test(
    text
  );
  const namesAttic = /\battic\b/i.test(text);
  const namesDrywallHang =
    /\b(?:hang|install)\b[^.;\n]{0,80}\b(?:drywall|sheetrock|gypsum)\b|\b(?:drywall|sheetrock|gypsum)\b[^.;\n]{0,40}\bhang\b/i.test(
      text
    );
  return namesInsulation && namesAttic && namesDrywallHang;
}

export function atticInsulationWithDrywallAreas(
  notes: string | null | undefined
): { atticSqft: number | null; drywallSqft: number | null; rValue: string | null } {
  const text = String(notes || '');
  const attic = text.match(
    /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+of\s+(?:the\s+)?attic\b/i
  );
  const drywall = text.match(
    /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+of\s+(?:drywall|sheetrock|gypsum)\b/i
  );
  const rValue = text.match(/\bR[-\s]?(\d{2,3})\b/i);
  const amount = (raw?: string) => {
    const value = Number(String(raw || '').replace(/,/g, ''));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  return {
    atticSqft: amount(attic?.[1]),
    drywallSqft: amount(drywall?.[1]),
    rValue: rValue ? `R-${rValue[1]}` : null,
  };
}

export function atticInsulationWithDrywallHelpers(
  notes: string | null | undefined
): { insulation: string; drywall: string } {
  const areas = atticInsulationWithDrywallAreas(notes);
  const insulationPlace = areas.rValue
    ? `${areas.rValue} attic insulation`
    : 'Attic insulation';
  return {
    insulation: areas.atticSqft
      ? `${insulationPlace}. Uses the attic area from the notes.`
      : 'Attic insulation from the notes. Enter the attic square feet.',
    drywall: 'Hang and finish the drywall named in the notes.',
  };
}

export function applyAtticInsulationWithDrywallCards<
  T extends {
    id?: string | null;
    label?: string | null;
    helperText?: string | null;
    noteBacked?: boolean | null;
  },
>(items: T[], notes: string | null | undefined): T[] {
  if (!notesNameAtticInsulationWithDrywallHang(notes)) return items;
  const helpers = atticInsulationWithDrywallHelpers(notes);
  return items
    .filter(item => item.id !== 'hang')
    .map(item => {
      if (item.id === 'insulation') {
        return {
          ...item,
          label: 'Attic insulation',
          helperText: helpers.insulation,
          noteBacked: true,
        };
      }
      if (item.id === 'drywall') {
        return {
          ...item,
          label: 'Drywall hang / finish',
          helperText: helpers.drywall,
          noteBacked: true,
        };
      }
      return item;
    });
}

/** Attic or ceiling insulation is named. “Paint the ceilings” is not attic area. */
export function insulationNoteNamesAtticArea(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    /\battic\b/i.test(text) ||
    /\bceilings?\s+insulation\b/i.test(text) ||
    /\binsulation\b[^.;\n]{0,40}\bceilings?\b/i.test(text)
  );
}

function insulationRevealLabel(location: string | null, rValue: string): string {
  const place =
    location === 'exterior_wall'
      ? 'Wall insulation'
      : location === 'attic_ceiling'
        ? 'Attic insulation'
        : location === 'floor'
          ? 'Floor insulation'
          : 'Insulation';
  return rValue ? `${place} · ${rValue}` : place;
}

export function dedicatedInsulationRevealLines(
  notes: string | null | undefined
): string[] {
  return parseInsulationAssembliesFromNotes(String(notes || '')).map(row => {
    const label = insulationRevealLabel(row.location, row.rValue);
    return row.sqft > 0
      ? `${label} · ${row.sqft.toLocaleString()} sqft`
      : label;
  });
}

export function dedicatedInsulationRevealRows(
  notes: string | null | undefined
): Array<{ name: string; amount: number; quantity?: string }> {
  return parseInsulationAssembliesFromNotes(String(notes || '')).map(row => {
    const name = insulationRevealLabel(row.location, row.rValue);
    return {
      name,
      amount: 0,
      ...(row.sqft > 0 ? { quantity: `${row.sqft.toLocaleString()} sqft` } : {}),
    };
  });
}

export function filterDedicatedInsulationConfirmItems<
  T extends { id?: string | null; state?: string | null; noteBacked?: boolean | null },
>(
  items: T[],
  notes?: string | null,
  options?: { planBacked?: boolean }
): T[] {
  if (options?.planBacked) return items;
  if (!notesDescribeDedicatedInsulationJob(notes)) return items;
  const keepAirSealing = notesNameAirSealing(notes);
  const named = items.filter(item => {
    const id = String(item.id || '');
    if (id === 'insulation') return true;
    if (id === 'air_sealing') return keepAirSealing;
    if (id === 'insulation_removal' || id.startsWith('insulation_removal__')) return true;
    return id.startsWith('custom_');
  });
  return named.map(item =>
    item.id === 'insulation' || item.id === 'air_sealing'
      ? { ...item, state: 'included' as T['state'], noteBacked: true }
      : item
  );
}
