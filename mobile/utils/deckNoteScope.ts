/**
 * A deck-only note is the lines it names.
 * Fence, concrete patio, and house fields stay off.
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

const DECK_WORK_RE = /\b(?:deck(?:ing)?|patio|guardrails?|railings?)\b/i;

const DECK_COMPANION_RE =
  /\b(?:kitchen|bath(?:room)?|shower|vanity|toilet|cabinets?|countertops?|plumbing|electrical|hvac|roof(?:ing)?|shingles?|windows?|doors?|insulation|siding|stucco|drywall|sheetrock|gypsum|paint(?:ing)?|flooring|lvp|laminate|carpet|hardwood)\b/i;

export function notesDescribeDedicatedDeckJob(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  // A new house that includes a patio is still a house. The patio is one
  // measurement, not a deck-only bid.
  if (
    /\b(?:new\s+(?:build|construction|home)|ground[\s-]?up|custom\s+home|spec\s+home)\b/i.test(
      text
    ) ||
    /\bnew\s+[\d,]+\s*(?:sq\.?\s*ft|sqft|square\s+feet)\b[^.]{0,48}\b(?:home|house)\b/i.test(
      text
    ) ||
    /\b(?:single|one|two|three|1|2|3)[\s-]?story\s+(?:home|house)\b/i.test(
      text
    ) ||
    (/\b(?:home|house)\b/i.test(text) && /\bgarage\b/i.test(text))
  ) {
    return false;
  }
  if (/\bconcrete\s+patio\b/i.test(text) && !/\bdeck(?:ing)?\b/i.test(text)) {
    return false;
  }
  if (/\bconcrete plan imported\b/i.test(text)) return false;
  // A cover-sheet covered patio is an area, not a deck bid.
  if (
    /\bcovered\s+patio\b/i.test(text) &&
    !/\bdeck(?:ing)?\b/i.test(text) &&
    !notesRequestDeckDemo(text) &&
    !notesRequestDeckFootings(text) &&
    !notesRequestDeckFraming(text) &&
    !notesRequestDeckSurface(text) &&
    !notesRequestDeckRailing(text) &&
    !notesRequestDeckStairs(text)
  ) {
    return false;
  }
  if (
    /\b(?:roof|roofing|shingles?)\b/i.test(text) &&
    /\bdeck(?:ing)?\b/i.test(text) &&
    !/\b(?:composite|railing|stairs|footings?|patio)\b/i.test(text)
  ) {
    return false;
  }
  if (!DECK_WORK_RE.test(text)) return false;
  const stripped = text.replace(
    /\b(?:deck(?:ing)?|patio|railings?|guardrails?|stairs?|steps?|footings?|piers?|posts?|frame|framing|composite|existing|wood)\b/gi,
    ' '
  );
  return !DECK_COMPANION_RE.test(stripped);
}

export function dedicatedDeckAreaSqft(
  notes: string | null | undefined
): number | null {
  const match = String(notes || '').match(
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:feet|foot))\b/i
  );
  const value = Number(String(match?.[1] || '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function dedicatedDeckFootingCount(
  notes: string | null | undefined
): number | null {
  const match = String(notes || '').match(/\b(\d+)\s+footings?\b/i);
  const value = Number(match?.[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function notesRequestDeckDemo(
  notes: string | null | undefined
): boolean {
  return /\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b[^.]{0,48}\b(?:existing\s+)?deck\b/i.test(
    String(notes || '')
  );
}

export function notesRequestDeckFootings(
  notes: string | null | undefined
): boolean {
  return /\b(?:footings?|piers?|posts?)\b/i.test(String(notes || ''));
}

export function notesRequestDeckFraming(
  notes: string | null | undefined
): boolean {
  return /\b(?:frame|framing)\b/i.test(String(notes || ''));
}

export function notesRequestDeckSurface(
  notes: string | null | undefined
): boolean {
  return /\b(?:deck(?:ing)?|composite)\b/i.test(String(notes || ''));
}

export function notesRequestDeckRailing(
  notes: string | null | undefined
): boolean {
  return /\b(?:railings?|guardrails?)\b/i.test(String(notes || ''));
}

export function dedicatedDeckRailingLf(
  notes: string | null | undefined
): number | null {
  const text = String(notes || '');
  const match = text.match(
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s*(?:feet|foot|ft))\s+of\s+(?:railing|guardrail)s?\b|\b(?:railing|guardrail)s?\b[^.]{0,32}?(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s*(?:feet|foot|ft))\b/i
  );
  const value = Number(String(match?.[1] || match?.[2] || '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function notesRequestDeckStairs(
  notes: string | null | undefined
): boolean {
  return /\b(?:stairs?|steps?)\b/i.test(String(notes || ''));
}

export function dedicatedDeckSurfaceLabel(
  notes: string | null | undefined
): string {
  const text = String(notes || '');
  if (/\bcomposite\b/i.test(text)) return 'Composite decking';
  if (/\bwood\s+deck(?:ing)?\b/i.test(text)) return 'Wood decking';
  return 'Decking / surface install';
}

export function dedicatedDeckScopeSelections(
  notes: string | null | undefined
): string[] {
  if (!notesDescribeDedicatedDeckJob(notes)) return [];
  const text = String(notes || '');
  const ids: string[] = [];
  if (notesRequestDeckDemo(text)) ids.push('deck_demo');
  if (notesRequestDeckFootings(text)) ids.push('footings');
  if (notesRequestDeckFraming(text)) ids.push('deck_framing');
  if (notesRequestDeckSurface(text)) {
    if (/\bcomposite\b/i.test(text)) ids.push('composite_deck');
    else if (/\bwood\s+deck(?:ing)?\b/i.test(text)) ids.push('wood_deck');
  }
  if (notesRequestDeckRailing(text)) ids.push('railings');
  if (notesRequestDeckStairs(text)) ids.push('stairs');
  return ids;
}

export function dedicatedDeckConfirmScopeItems(
  notes: string | null | undefined
): ExplicitScopeItem[] {
  if (!notesDescribeDedicatedDeckJob(notes)) return [];
  const text = String(notes || '');
  const items: ExplicitScopeItem[] = [];
  if (notesRequestDeckDemo(text)) {
    items.push({
      id: 'demo_removal',
      inputType: 'yes_no',
      label: 'Deck demo / removal',
      helperText: 'Remove the existing deck. Enter the area if the note does not give one.',
      category: 'demo',
      state: 'included',
      noteBacked: true,
    });
  }
  if (notesRequestDeckFootings(text)) {
    items.push({
      id: 'footings_piers',
      inputType: 'yes_no',
      label: 'Footings',
      helperText: 'Footing count from the notes.',
      category: 'structure',
      state: 'included',
      noteBacked: true,
    });
  }
  if (notesRequestDeckFraming(text)) {
    items.push({
      id: 'framing_structure',
      inputType: 'yes_no',
      label: 'Deck framing',
      helperText: 'Frame the deck area named in the notes.',
      category: 'structure',
      state: 'included',
      noteBacked: true,
    });
  }
  if (notesRequestDeckSurface(text)) {
    const label = dedicatedDeckSurfaceLabel(text);
    items.push({
      id: 'decking',
      inputType: 'yes_no',
      label,
      helperText: `Install the ${label.toLowerCase()} area named in the notes.`,
      category: 'surface',
      state: 'included',
      noteBacked: true,
    });
  }
  if (notesRequestDeckRailing(text)) {
    const railingLf = dedicatedDeckRailingLf(text);
    items.push({
      id: 'railing',
      inputType: 'yes_no',
      label: 'Railing / guardrails',
      helperText: railingLf
        ? 'Railing length from the notes.'
        : 'Enter the railing length. The note does not give one.',
      category: 'surface',
      state: 'included',
      noteBacked: true,
    });
  }
  if (notesRequestDeckStairs(text)) {
    items.push({
      id: 'stairs',
      inputType: 'yes_no',
      label: 'Stair runs',
      helperText: 'Enter the number of stair runs. The note does not give one.',
      category: 'surface',
      state: 'included',
      noteBacked: true,
    });
  }
  return items;
}

export function filterDedicatedDeckConfirmItems<
  T extends { id?: string | null },
>(items: T[], notes?: string | null): T[] {
  if (!notesDescribeDedicatedDeckJob(notes)) return items;
  const allowed = new Set(
    dedicatedDeckConfirmScopeItems(notes).map(item => item.id)
  );
  return items.filter(item => {
    const id = String(item.id || '');
    return id.startsWith('custom_') || allowed.has(id);
  });
}

export function dedicatedDeckRevealQuantity(
  itemId: string,
  measurements: Record<string, unknown> | null | undefined
): string | null {
  if (!measurements) return null;
  const read = (key: string) => {
    const value = Number(String(measurements[key] ?? '').replace(/,/g, ''));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  if (itemId === 'footings_piers') {
    const count = read('deckFootingCount');
    return count ? `${count} each` : null;
  }
  if (itemId === 'framing_structure' || itemId === 'decking') {
    const area = read('deckSqft');
    return area ? `${area} sqft` : null;
  }
  if (itemId === 'railing') {
    const length = read('railingLf');
    return length ? `${length} LF` : null;
  }
  if (itemId === 'stairs') {
    const count = read('deckStairCount');
    return count ? `${count} ${count === 1 ? 'run' : 'runs'}` : null;
  }
  return null;
}

export function dedicatedDeckMeasurementSeed(
  notes: string | null | undefined
): Record<string, unknown> {
  const text = String(notes || '');
  const area = dedicatedDeckAreaSqft(text);
  const footings = dedicatedDeckFootingCount(text);
  const seed: Record<string, unknown> = {
    tradeScopeSelections: {
      deck_patio: dedicatedDeckScopeSelections(text),
    },
  };
  const itemQuantities: Record<
    string,
    { quantity: number; unit: 'sqft' | 'each' | 'lf'; quantitySource: 'notes' }
  > = {};
  if (area && (notesRequestDeckSurface(text) || notesRequestDeckFraming(text))) {
    seed.deckSqft = area;
  }
  if (area && notesRequestDeckSurface(text)) {
    itemQuantities.decking = {
      quantity: area,
      unit: 'sqft',
      quantitySource: 'notes',
    };
  }
  if (area && notesRequestDeckFraming(text)) {
    itemQuantities.framing_structure = {
      quantity: area,
      unit: 'sqft',
      quantitySource: 'notes',
    };
  }
  if (footings) {
    seed.deckFootingCount = footings;
    itemQuantities.footings_piers = {
      quantity: footings,
      unit: 'each',
      quantitySource: 'notes',
    };
  }
  const railingLf = dedicatedDeckRailingLf(text);
  if (railingLf && notesRequestDeckRailing(text)) {
    seed.railingLf = railingLf;
    itemQuantities.railing = {
      quantity: railingLf,
      unit: 'lf',
      quantitySource: 'notes',
    };
  }
  seed.itemQuantities = itemQuantities;
  return seed;
}

export function dedicatedDeckMissingQuantityPrompt(
  notes: string | null | undefined,
  measurements: Record<string, unknown> | null | undefined
): string | null {
  if (!notesDescribeDedicatedDeckJob(notes)) return null;
  const filled = (key: string) => {
    const value = Number(String(measurements?.[key] ?? '').replace(/,/g, ''));
    return Number.isFinite(value) && value > 0;
  };
  const missing: string[] = [];
  if (notesRequestDeckDemo(notes) && !filled('deckDemoSqft')) {
    missing.push('deck removal area');
  }
  if (notesRequestDeckFootings(notes) && !filled('deckFootingCount')) {
    missing.push('footing count');
  }
  if (
    (notesRequestDeckFraming(notes) || notesRequestDeckSurface(notes)) &&
    !filled('deckSqft')
  ) {
    missing.push('deck area');
  }
  if (notesRequestDeckRailing(notes) && !filled('railingLf')) {
    missing.push('railing length');
  }
  if (notesRequestDeckStairs(notes) && !filled('deckStairCount')) {
    missing.push('stair run count');
  }
  if (!missing.length) return null;
  if (missing.length === 1) {
    return `Enter the ${missing[0]} before it can be priced.`;
  }
  const last = missing[missing.length - 1];
  const rest = missing.slice(0, -1);
  const list =
    rest.length > 1 ? `${rest.join(', ')}, and ${last}` : `${rest[0]} and ${last}`;
  return `Enter the ${list} before they can be priced.`;
}

export function scrubDedicatedDeckMeasurements<T extends Record<string, unknown>>(
  notes: string | null | undefined,
  measurements: T
): T {
  if (!notesDescribeDedicatedDeckJob(notes)) return measurements;
  const seed = dedicatedDeckMeasurementSeed(notes);
  const next: Record<string, unknown> = { ...measurements, ...seed };
  for (const key of [
    'floorAreaSqft',
    'wallFramingSqft',
    'framedAreaSqft',
    'concreteCy',
    'concreteSqft',
    'concreteDemoSqft',
    'concreteScope',
    'deckDemoSqft',
    'deckStairCount',
  ]) {
    delete next[key];
  }
  const railingLf = dedicatedDeckRailingLf(notes);
  if (railingLf) next.railingLf = railingLf;
  else delete next.railingLf;
  if (dedicatedDeckAreaSqft(notes)) next.deckSqft = dedicatedDeckAreaSqft(notes);
  const footings = dedicatedDeckFootingCount(notes);
  if (footings) next.deckFootingCount = footings;
  const quantities = {
    ...((next.itemQuantities as Record<string, unknown>) || {}),
    ...((seed.itemQuantities as Record<string, unknown>) || {}),
  };
  delete quantities.demo_removal;
  delete quantities.stairs;
  if (!dedicatedDeckRailingLf(notes)) delete quantities.railing;
  next.itemQuantities = quantities;
  const selections = {
    ...((next.tradeScopeSelections as Record<string, unknown>) || {}),
    deck_patio: dedicatedDeckScopeSelections(notes),
  };
  next.tradeScopeSelections = selections;
  return next as T;
}
