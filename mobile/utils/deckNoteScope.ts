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

export type DeckInstallMaterial = 'wood' | 'composite';

export function deckInstallMaterialCopy(material: DeckInstallMaterial): {
  label: string;
  helperText: string;
  materialRate: number;
  laborRate: number;
  rateSourceLabel: string;
} {
  if (material === 'wood') {
    return {
      label: 'Wood decking',
      helperText: 'Install the wood decking area named in the notes.',
      materialRate: 8,
      laborRate: 12,
      rateSourceLabel: 'National average · wood decking',
    };
  }
  return {
    label: 'Composite decking',
    helperText: 'Install the composite decking area named in the notes.',
    materialRate: 18,
    laborRate: 14,
    rateSourceLabel: 'National average · composite decking',
  };
}

/** Saved chip wins. A generic deck note follows the composite chip. */
export function selectedDeckInstallMaterial(
  notes: string | null | undefined,
  measurements?: {
    tradeScopeSelections?: { deck_patio?: unknown } | null;
  } | null
): DeckInstallMaterial {
  const saved = measurements?.tradeScopeSelections?.deck_patio;
  const selections = Array.isArray(saved) ? saved.map(id => String(id)) : [];
  const chosen = [...selections]
    .reverse()
    .find(id => id === 'wood_deck' || id === 'composite_deck');
  if (chosen === 'wood_deck') return 'wood';
  if (chosen === 'composite_deck') return 'composite';
  const text = String(notes || '');
  // The checklist id `decking` lights the composite chip unless the note names wood.
  if (selections.includes('decking')) {
    return /\bwood\s+deck(?:ing)?\b/i.test(text) ? 'wood' : 'composite';
  }
  if (/\bwood\s+deck(?:ing)?\b/i.test(text)) return 'wood';
  if (/\bcomposite\b/i.test(text)) return 'composite';
  return 'composite';
}

export function dedicatedDeckSurfaceLabel(
  notes: string | null | undefined,
  measurements?: {
    tradeScopeSelections?: { deck_patio?: unknown } | null;
  } | null
): string {
  if (notesDescribeDedicatedDeckJob(notes)) {
    return deckInstallMaterialCopy(selectedDeckInstallMaterial(notes, measurements))
      .label;
  }
  const text = String(notes || '');
  if (/\bcomposite\b/i.test(text)) return 'Composite decking';
  if (/\bwood\s+deck(?:ing)?\b/i.test(text)) return 'Wood decking';
  return 'Decking / surface install';
}

export function applyDeckInstallMaterialLabel<
  T extends { id?: string | null; label?: string | null; helperText?: string | null },
>(
  items: T[],
  notes: string | null | undefined,
  measurements?: {
    tradeScopeSelections?: { deck_patio?: unknown } | null;
  } | null
): T[] {
  if (!notesDescribeDedicatedDeckJob(notes)) return items;
  const copy = deckInstallMaterialCopy(
    selectedDeckInstallMaterial(notes, measurements)
  );
  return items.map(item =>
    item.id === 'decking'
      ? { ...item, label: copy.label, helperText: copy.helperText }
      : item
  );
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

/** Scope Found chips for an existing deck. No demo and Not sure leave these off. */
export function selectedDeckRemovalSurfaces(
  measurements?: { scopeFoundPieces?: unknown } | null
): { decking: boolean; railing: boolean; stairs: boolean } {
  const pieces = Array.isArray(measurements?.scopeFoundPieces)
    ? measurements.scopeFoundPieces.map(piece => String(piece))
    : [];
  return {
    decking: pieces.includes('deck_surface'),
    railing: pieces.includes('deck_railing'),
    stairs: pieces.includes('deck_stairs'),
  };
}

export function dedicatedDeckConfirmScopeItems(
  notes: string | null | undefined,
  measurements?: {
    scopeFoundPieces?: unknown;
    tradeScopeSelections?: { deck_patio?: unknown } | null;
  } | null
): ExplicitScopeItem[] {
  if (!notesDescribeDedicatedDeckJob(notes)) return [];
  const text = String(notes || '');
  const selectedRemoval = selectedDeckRemovalSurfaces(measurements);
  const items: ExplicitScopeItem[] = [];
  if (selectedRemoval.decking) {
    items.push({
      id: 'deck_surface_demo',
      inputType: 'yes_no',
      label: 'Remove decking',
      helperText: 'Existing decking comes out before the new deck goes in.',
      category: 'demo',
      state: 'included',
      noteBacked: true,
    });
  }
  if (selectedRemoval.railing) {
    items.push({
      id: 'deck_railing_demo',
      inputType: 'yes_no',
      label: 'Remove railing',
      helperText: 'Existing railing comes out. Enter the length being removed.',
      category: 'demo',
      state: 'included',
      noteBacked: true,
    });
  }
  if (selectedRemoval.stairs) {
    items.push({
      id: 'deck_stairs_demo',
      inputType: 'yes_no',
      label: 'Remove stairs',
      helperText: 'Existing stair flights come out.',
      category: 'demo',
      state: 'included',
      noteBacked: true,
    });
  }
  if (notesRequestDeckDemo(text) && !selectedRemoval.decking) {
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
    const copy = deckInstallMaterialCopy(
      selectedDeckInstallMaterial(text, measurements)
    );
    items.push({
      id: 'decking',
      inputType: 'yes_no',
      label: copy.label,
      helperText: copy.helperText,
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
      label: 'Stair flights',
      helperText: 'Enter the number of stair flights. The note does not give one.',
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
  const selectedRemovalIds = new Set([
    'deck_surface_demo',
    'deck_railing_demo',
    'deck_stairs_demo',
  ]);
  return items.filter(item => {
    const id = String(item.id || '');
    return id.startsWith('custom_') || allowed.has(id) || selectedRemovalIds.has(id);
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
    missing.push('stair flight count');
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
  const selectedRemoval = selectedDeckRemovalSurfaces(
    measurements as { scopeFoundPieces?: unknown }
  );
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
    if (key === 'deckDemoSqft' && selectedRemoval.decking) continue;
    delete next[key];
  }
  if (!selectedRemoval.railing) delete next.deckRailingDemoLf;
  if (!selectedRemoval.stairs) delete next.deckStairDemoCount;
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
  const noteSelections = dedicatedDeckScopeSelections(notes);
  const savedPatio = (
    (measurements as { tradeScopeSelections?: { deck_patio?: unknown } })
      .tradeScopeSelections?.deck_patio
  );
  const savedSurface = (Array.isArray(savedPatio) ? savedPatio.map(String) : [])
    .reverse()
    .find(id => id === 'wood_deck' || id === 'composite_deck');
  const noteSurface = noteSelections.find(
    id => id === 'wood_deck' || id === 'composite_deck'
  );
  const surface = savedSurface || noteSurface;
  const removalSelections = [
    selectedRemoval.decking ? 'deck_surface_demo' : null,
    selectedRemoval.railing ? 'deck_railing_demo' : null,
    selectedRemoval.stairs ? 'deck_stairs_demo' : null,
  ].filter((id): id is string => Boolean(id));
  const selections = {
    ...((next.tradeScopeSelections as Record<string, unknown>) || {}),
    deck_patio: [
      ...noteSelections.filter(id => id !== 'wood_deck' && id !== 'composite_deck'),
      ...(surface ? [surface] : []),
      ...removalSelections,
    ],
  };
  next.tradeScopeSelections = selections;
  return next as T;
}
