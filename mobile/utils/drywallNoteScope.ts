/**
 * A drywall-only note is a drywall bid.
 * Hang and finish keeps its own area. A patch named with "including" stays
 * visible and does not add a second charge. Any other patch is priced.
 * Demolition stays unpriced until Quick measurements has a demolition area.
 */

const OTHER_TRADE_RE =
  /\b(?:kitchen|bath(?:room)?|shower|vanity|toilet|flooring|lvp|laminate|vinyl|carpet|cabinets?|countertops?|plumbing|electrical|hvac|roof(?:ing)?|windows?|doors?|insulation|tile|siding|concrete|framing|paint(?:ing)?)\b/i;

export function notesDescribeDedicatedDrywallJob(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (!/\bhang\s+and\s+finish\b/i.test(text)) return false;
  const namesDrywall = /\b(?:drywall|sheetrock|gypsum)\b/i.test(text);
  const namesFinishWork = /\b(?:tape|mud|texture)\b/i.test(text);
  if (!namesDrywall && !namesFinishWork) return false;
  return !OTHER_TRADE_RE.test(text);
}

function hangFinishHelper(notes: string): string {
  const parts = [
    /\btape\b/i.test(notes) ? 'tape' : '',
    /\bmud\b/i.test(notes) ? 'mud' : '',
    /\bsanding\b/i.test(notes) ? 'sanding' : '',
    /\btexture\b/i.test(notes) ? 'texture' : '',
  ].filter(Boolean);
  if (!parts.length) return 'Hang and finish.';
  if (parts.length === 1) return `Hang and finish, including ${parts[0]}.`;
  const last = parts[parts.length - 1];
  return `Hang and finish, including ${parts.slice(0, -1).join(', ')}, and ${last}.`;
}

/** "Remove 500 sqft of damaged drywall" states the demolition area. */
export function statedDedicatedDrywallDemoSqft(
  notes: string | null | undefined
): number | null {
  const text = String(notes || '');
  const quantity = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet))`;
  const surface = String.raw`(?:drywall|sheetrock|gypsum)`;
  const demoVerb = String.raw`(?:demo|demolition|demolish|remove|removal|tear[\s-]?out)`;
  const patterns = [
    new RegExp(
      String.raw`\b${demoVerb}\b[^.;\n]{0,40}?${quantity}\b[^.;\n]{0,30}\b(?:of\s+)?(?:damaged\s+)?${surface}\b`,
      'i'
    ),
    new RegExp(
      String.raw`${quantity}\b[^.;\n]{0,30}\b(?:of\s+)?(?:damaged\s+)?${surface}\b[^.;\n]{0,40}?\b${demoVerb}\b`,
      'i'
    ),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = match?.[1] ? Number(match[1].replace(/,/g, '')) : null;
    if (parsed && Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/** "including 300 sqft of patch repair" sits inside the hang / finish area. */
export function notesIncludeDrywallPatchInHang(
  notes: string | null | undefined
): boolean {
  if (!notesDescribeDedicatedDrywallJob(notes)) return false;
  return /\bincluding\b[^.]{0,160}\b(?:patch(?:ing)?|repair)\b/i.test(
    String(notes || '')
  );
}

/**
 * Suppress the patch dollars only when the note includes the patch and the
 * patch area fits inside the hang / finish area.
 */
export function dedicatedDrywallIncludedPatchSqft(
  notes: string | null | undefined,
  measurements: { drywallSqft?: unknown; patchRepairSqft?: unknown } | null | undefined
): { hangSqft: number; patchSqft: number } | null {
  if (!notesIncludeDrywallPatchInHang(notes)) return null;
  const hangSqft = positiveSqft(measurements?.drywallSqft);
  const patchSqft = positiveSqft(measurements?.patchRepairSqft);
  if (hangSqft == null || patchSqft == null || patchSqft > hangSqft) return null;
  return { hangSqft, patchSqft };
}

/**
 * Confirm Scope renames the drywall sqft field for ordinary repair notes.
 * A dedicated hang-and-finish note keeps the field's own hang / finish label.
 * Returns null when the caller should leave the field label alone.
 */
export function confirmScopeDrywallSqftLabel(
  notes: string | null | undefined,
  options: { installNamed: boolean; repairNamed: boolean }
): string | null {
  if (notesDescribeDedicatedDrywallJob(notes)) return null;
  if (options.installNamed && !options.repairNamed) return 'Drywall install';
  return 'Drywall repair area';
}

export function dedicatedDrywallConfirmScopeItems(
  notes: string | null | undefined
): Array<{
  id: string;
  inputType: 'yes_no';
  label: string;
  helperText: string;
  category: string;
  state: 'included';
  noteBacked: true;
}> {
  const text = String(notes || '');
  const items: Array<{
    id: string;
    inputType: 'yes_no';
    label: string;
    helperText: string;
    category: string;
    state: 'included';
    noteBacked: true;
  }> = [];
  if (/\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b/i.test(text)) {
    items.push({
      id: 'demo_removal',
      inputType: 'yes_no',
      label: 'Drywall demo / removal',
      helperText: statedDedicatedDrywallDemoSqft(text)
        ? `Remove ${statedDedicatedDrywallDemoSqft(text)!.toLocaleString()} sqft of damaged drywall.`
        : 'Remove damaged drywall. Enter the demolition area in Quick measurements.',
      category: 'Drywall',
      state: 'included',
      noteBacked: true,
    });
  }
  items.push({
    id: 'drywall',
    inputType: 'yes_no',
    label: 'Drywall hang / finish',
    helperText: hangFinishHelper(text),
    category: 'Drywall',
    state: 'included',
    noteBacked: true,
  });
  if (/\b(?:patch(?:ing)?|repair)\b/i.test(text)) {
    items.push({
      id: 'patch_repair',
      inputType: 'yes_no',
      label: 'Drywall patch / repair',
      helperText: notesIncludeDrywallPatchInHang(text)
        ? 'Included in the hang / finish area. No separate charge.'
        : 'Patch repair area stated in the notes.',
      category: 'Drywall',
      state: 'included',
      noteBacked: true,
    });
  }
  return items;
}

function positiveSqft(value: unknown): number | null {
  const quantity = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

/** Scope found quantity for a dedicated drywall note. Demo stays blank. */
export function dedicatedDrywallRevealQuantity(
  id: string,
  measurements: { drywallSqft?: unknown; patchRepairSqft?: unknown } | null
): string | null | undefined {
  if (!measurements) return undefined;
  if (id === 'demo' || id === 'demo_removal') return null;
  if (id === 'drywall' || id === 'hang' || id === 'finish_tape') {
    const hang = positiveSqft(measurements.drywallSqft);
    return hang ? `${hang} sqft` : null;
  }
  if (id === 'patch_repair') {
    const patch = positiveSqft(measurements.patchRepairSqft);
    return patch ? `${patch} sqft` : null;
  }
  return undefined;
}
