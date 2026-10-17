/**
 * A flooring-only note is the lines it names.
 * Other trades, and other flooring products, stay off.
 */
import {
  inferExistingFlooringFromNotes,
  type FlooringExistingCounts,
} from '@/utils/qmScopePanels/flooringRemodel';

type ExplicitScopeItem = {
  id: string;
  inputType: 'yes_no';
  label: string;
  helperText: string;
  category: string;
  state: 'included';
  noteBacked: true;
};

const FLOORING_WORK_RE =
  /\b(?:flooring|lvp|luxury\s+vinyl|vinyl\s+plank|laminate|carpet|hardwood|sheet\s+vinyl|vct)\b|\b(?:install|remove|removal|demo|demolition)\b[^.]{0,48}\bfloor\b|\bfloor\s+prep\b/i;

const FLOORING_COMPANION_RE =
  /\b(?:kitchen|bath(?:room)?|shower|vanity|toilet|cabinets?|countertops?|plumbing|electrical|hvac|roof(?:ing)?|windows?|doors?|insulation|siding|concrete|framing|paint(?:ing)?|drywall|sheetrock|gypsum|stucco)\b/i;

const PRODUCT_RULES: Array<{ id: string; product: string; label: string; pattern: RegExp }> = [
  {
    id: 'flooring_engineered_hardwood',
    product: 'engineered_hardwood',
    label: 'Engineered hardwood',
    pattern: /\bengineered\s+hardwood\b/i,
  },
  {
    id: 'flooring_lvp',
    product: 'lvp',
    label: 'LVP',
    pattern: /\b(?:lvp|luxury\s+vinyl|vinyl\s+plank)\b/i,
  },
  {
    id: 'flooring_sheet_vinyl',
    product: 'sheet_vinyl_vct',
    label: 'Sheet vinyl / VCT',
    pattern: /\b(?:sheet\s+vinyl|vct|vinyl\s+tile)\b/i,
  },
  {
    id: 'flooring_laminate',
    product: 'laminate',
    label: 'Laminate',
    pattern: /\blaminate\b/i,
  },
  {
    id: 'flooring_carpet',
    product: 'carpet',
    label: 'Carpet',
    pattern: /\bcarpet\b/i,
  },
  {
    id: 'flooring_solid_hardwood',
    product: 'solid_hardwood',
    label: 'Solid hardwood',
    pattern: /\b(?:solid\s+hardwood|hardwood)\b/i,
  },
  {
    id: 'tile_flooring',
    product: 'tile',
    label: 'Tile',
    pattern: /\b(?:floor\s+tile|tile\s+floor(?:ing)?)\b/i,
  },
];

export function notesDescribeDedicatedFlooringJob(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (
    /\b(?:kitchen|bath(?:room)?)\s+(?:remodel|renovation|refresh|reno)\b/i.test(
      text
    ) ||
    /\b(?:whole|entire|full)\s+(?:existing\s+)?home\b/i.test(text)
  ) {
    return false;
  }
  if (!FLOORING_WORK_RE.test(text)) return false;
  const stripped = text
    .replace(
      /\b(?:flooring|lvp|luxury\s+vinyl|vinyl\s+plank|laminate|carpet|hardwood|sheet\s+vinyl|vct|floor\s+prep|existing\s+floor|floor)\b/gi,
      ' '
    );
  return !FLOORING_COMPANION_RE.test(stripped);
}

export function notesRequestFlooringDemo(
  notes: string | null | undefined
): boolean {
  return /\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b[^.]{0,48}\b(?:existing\s+)?(?:floor|flooring|lvp|laminate|vinyl|carpet|hardwood|tile)\b|\bexisting\s+floor\b/i.test(
    String(notes || '')
  );
}

export function notesRequestFloorPrep(
  notes: string | null | undefined
): boolean {
  const text = dedicatedFlooringNoteText(notes)
    .replace(/\b(?:separate|priced)\s+under\s+floor\s+prep\b/gi, ' ')
    .replace(/\bsubfloor\s*\/\s*floor\s+prep\b/gi, ' ');
  return /\b(?:include|including|with|plus|needs?|need)\s+floor\s+prep\b|\bfloor\s+prep\s+(?:included|required|needed)\b|\bsubfloor\s+(?:prep|repair|level(?:ing)?|work)\b/i.test(
    text
  );
}

export function dedicatedFlooringAreaSqft(
  notes: string | null | undefined
): number | null {
  const match = String(notes || '').match(
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:feet|foot))\b/i
  );
  const value = Number(String(match?.[1] || '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

const FLOORING_ROLE_VERB_RE =
  /\b(?:tear[\s-]?out|remove|removal|demo|demolition|install(?:ing|ation)?|replace(?:ment)?)\b/gi;

function flooringVerbIsNegated(text: string, index: number): boolean {
  return /\b(?:no|without)\s+$/i.test(text.slice(Math.max(0, index - 16), index));
}

function lineHasRemovalVerb(line: string): boolean {
  return [...line.matchAll(/\b(?:tear[\s-]?out|remove|removal|demo|demolition)\b/gi)].some(
    match => match.index != null && !flooringVerbIsNegated(line, match.index)
  );
}

function flooringVerbRemoves(verb: string): boolean {
  return /^(?:tear[\s-]?out|remove|removal|demo|demolition)$/i.test(verb);
}

function productsInSpan(span: string) {
  return PRODUCT_RULES.filter(rule => rule.pattern.test(span)).map(rule => ({
    id: rule.id,
    product: rule.product,
    label: rule.label,
  }));
}

/**
 * A product named after a tear-out is the existing floor.
 * A product named after an install is the new floor.
 */
export function dedicatedFlooringProductRoles(notes: string | null | undefined): {
  removed: Array<{ id: string; product: string; label: string }>;
  installed: Array<{ id: string; product: string; label: string }>;
} {
  const text = String(notes || '');
  const verbs = [...text.matchAll(FLOORING_ROLE_VERB_RE)].filter(
    match => match.index != null && !flooringVerbIsNegated(text, match.index)
  );
  const removedIds = new Set<string>();
  const installedIds = new Set<string>();
  verbs.forEach((verb, index) => {
    const start = (verb.index ?? 0) + verb[0].length;
    const nextVerb = verbs[index + 1]?.index ?? text.length;
    const sentenceBreak = text.slice(start).search(/[.!?](?:\s|$)/);
    const end =
      sentenceBreak >= 0 ? Math.min(start + sentenceBreak, nextVerb) : nextVerb;
    const bucket = flooringVerbRemoves(verb[0]) ? removedIds : installedIds;
    for (const product of productsInSpan(text.slice(start, end))) {
      bucket.add(product.id);
    }
  });
  const removed = PRODUCT_RULES.filter(
    rule => removedIds.has(rule.id) && !installedIds.has(rule.id)
  ).map(rule => ({
    id: rule.id,
    product: rule.product,
    label: rule.label,
  }));
  const installed = PRODUCT_RULES.filter(rule => {
    if (removedIds.has(rule.id) && !installedIds.has(rule.id)) return false;
    if (installedIds.has(rule.id)) return true;
    return verbs.length === 0 && rule.pattern.test(text);
  }).map(rule => ({
    id: rule.id,
    product: rule.product,
    label: rule.label,
  }));
  return { removed, installed };
}

export function dedicatedFlooringProducts(
  notes: string | null | undefined
): Array<{ id: string; product: string; label: string }> {
  return dedicatedFlooringProductRoles(notes).installed;
}

/** A joined note can carry a later summary. The flooring sentence is the job. */
export function dedicatedFlooringNoteText(
  notes: string | null | undefined
): string {
  const text = String(notes || '');
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const jobLine = lines.find(
    line =>
      lineHasRemovalVerb(line) &&
      /\b(?:install|replace)\b/i.test(line) &&
      /\b(?:carpet|laminate|lvp|luxury\s+vinyl|vinyl\s+plank|hardwood|sheet\s+vinyl|vct|flooring)\b/i.test(
        line
      )
  );
  if (jobLine) return jobLine;
  const removalLine = lines.find(
    line =>
      lineHasRemovalVerb(line) &&
      /\b(?:carpet|laminate|lvp|luxury\s+vinyl|vinyl\s+plank|hardwood|sheet\s+vinyl|vct)\b/i.test(
        line
      )
  );
  if (removalLine) return removalLine;
  const measuredWorkLine = lines.find(
    line =>
      /\d/.test(line) &&
      /\b(?:tear[\s-]?out|remove|removal|install)\b/i.test(line) &&
      /\b(?:carpet|laminate|lvp|luxury\s+vinyl|vinyl\s+plank|hardwood|sheet\s+vinyl|vct|flooring)\b/i.test(
        line
      )
  );
  if (measuredWorkLine) return measuredWorkLine;
  const dedicatedLine = lines.find(line => notesDescribeDedicatedFlooringJob(line));
  if (dedicatedLine) return dedicatedLine;
  const demoLine = lines.find(
    line =>
      notesRequestFlooringDemo(line) &&
      /\b(?:carpet|laminate|lvp|luxury\s+vinyl|vinyl\s+plank|hardwood|sheet\s+vinyl|vct|flooring)\b/i.test(
        line
      )
  );
  return demoLine || text;
}

/** The floor being torn out. Install products stay on the new-floor card. */
function removedFloorProducts(
  text: string
): NonNullable<FlooringExistingCounts['flooringExistingTypes']> | null {
  if (!notesRequestFlooringDemo(text) && !lineHasRemovalVerb(text)) return null;
  const roles = dedicatedFlooringProductRoles(text);
  const installed = new Set(roles.installed.map(product => product.product));
  const removed = roles.removed
    .map(product => product.product)
    .filter(
      (
        product
      ): product is NonNullable<
        FlooringExistingCounts['flooringExistingTypes']
      >[number] => !installed.has(product)
    );
  return removed.length ? removed : null;
}

export function dedicatedFlooringRemovedTypes(
  notes: string | null | undefined
): NonNullable<FlooringExistingCounts['flooringExistingTypes']> | null {
  const full = String(notes || '');
  return (
    removedFloorProducts(dedicatedFlooringNoteText(full)) ||
    removedFloorProducts(full)
  );
}

export function filterDedicatedFlooringConfirmItems<
  T extends { id?: string | null },
>(items: T[], notes?: string | null): T[] {
  const text = dedicatedFlooringNoteText(notes);
  if (!notesDescribeDedicatedFlooringJob(text)) return items;
  const allowed = new Set(
    dedicatedFlooringConfirmScopeItems(text).map(item => item.id)
  );
  return items.filter(item => {
    const id = String(item.id || '');
    return id.startsWith('custom_') || allowed.has(id);
  });
}

const FLOORING_PRODUCT_AREA_KEYS: Record<string, string> = {
  lvp: 'flooringLvpSqft',
  laminate: 'flooringLaminateSqft',
  engineered_hardwood: 'flooringEngineeredHardwoodSqft',
  solid_hardwood: 'flooringSolidHardwoodSqft',
  tile: 'flooringTileSqft',
  carpet: 'flooringCarpetSqft',
  sheet_vinyl_vct: 'flooringSheetVinylSqft',
};

/** Drop install lines and prep that the note did not name. */
export function scrubDedicatedFlooringMeasurements<
  T extends Record<string, unknown>,
>(notes: string | null | undefined, measurements: T): T {
  const text = dedicatedFlooringNoteText(notes);
  if (!notesDescribeDedicatedFlooringJob(text)) return measurements;
  const roles = dedicatedFlooringProductRoles(text);
  const installProducts = new Set(roles.installed.map(product => product.product));
  const installIds = new Set(roles.installed.map(product => product.id));
  const removedProducts = roles.removed
    .map(product => product.product)
    .filter(product => !installProducts.has(product));
  const next = { ...measurements } as Record<string, unknown>;
  for (const [product, key] of Object.entries(FLOORING_PRODUCT_AREA_KEYS)) {
    if (!installProducts.has(product)) delete next[key];
  }
  if (roles.installed.length === 1) {
    next.flooringProductScope = [roles.installed[0].product];
  }
  if (removedProducts.length) {
    next.flooringExistingTypes = removedProducts;
    next.flooringExistingCount = 1;
  } else if (Array.isArray(next.flooringExistingTypes)) {
    const kept = (next.flooringExistingTypes as string[]).filter(
      type => type === 'unknown' || !installProducts.has(type)
    );
    next.flooringExistingTypes = kept.length ? kept : null;
  }
  const quantities = {
    ...((next.itemQuantities as Record<string, unknown>) || {}),
  };
  for (const id of [
    'flooring_lvp',
    'flooring_laminate',
    'flooring_engineered_hardwood',
    'flooring_solid_hardwood',
    'tile_flooring',
    'flooring_carpet',
    'flooring_sheet_vinyl',
    'flooring',
  ]) {
    if (id === 'flooring' ? installIds.size > 0 : !installIds.has(id)) {
      delete quantities[id];
    }
  }
  if (removedProducts.length) {
    for (const key of Object.keys(quantities)) {
      if (!key.startsWith('floor_demo__')) continue;
      const product = key.slice('floor_demo__'.length);
      if (!removedProducts.includes(product)) delete quantities[key];
    }
  }
  if (!notesRequestFloorPrep(text)) {
    delete next.floorPrepSqft;
    next.floorPrepByProduct = null;
    delete quantities.floor_prep;
  }
  next.itemQuantities = quantities;
  return next as T;
}

export function dedicatedFlooringConfirmScopeItems(
  notes: string | null | undefined
): ExplicitScopeItem[] {
  const text = dedicatedFlooringNoteText(notes);
  if (!notesDescribeDedicatedFlooringJob(text)) return [];
  const items: ExplicitScopeItem[] = [];
  if (notesRequestFlooringDemo(text)) {
    items.push({
      id: 'floor_demo',
      inputType: 'yes_no',
      label: 'Flooring demo / removal',
      helperText: 'Remove the existing floor. The area is the install area when the note gives one.',
      category: 'flooring',
      state: 'included',
      noteBacked: true,
    });
  }
  const products = dedicatedFlooringProducts(text);
  if (products.length) {
    for (const product of products) {
      items.push({
        id: product.id,
        inputType: 'yes_no',
        label: product.label,
        helperText: `Install the ${product.label} area named in the notes.`,
        category: 'flooring',
        state: 'included',
        noteBacked: true,
      });
    }
  } else {
    items.push({
      id: 'flooring',
      inputType: 'yes_no',
      label: 'New flooring',
      helperText: 'Install the flooring area named in the notes.',
      category: 'flooring',
      state: 'included',
      noteBacked: true,
    });
  }
  if (notesRequestFloorPrep(text)) {
    items.push({
      id: 'floor_prep',
      inputType: 'yes_no',
      label: 'Subfloor / floor prep',
      helperText: 'Floor prep for the area named in the notes.',
      category: 'flooring',
      state: 'included',
      noteBacked: true,
    });
  }
  return items;
}

export function dedicatedFlooringRevealQuantity(
  itemId: string,
  measurements: {
    floorDemoSqft?: unknown;
    floorPrepSqft?: unknown;
    flooringSqft?: unknown;
    flooringLvpSqft?: unknown;
    flooringLaminateSqft?: unknown;
    flooringEngineeredHardwoodSqft?: unknown;
    flooringSolidHardwoodSqft?: unknown;
    flooringTileSqft?: unknown;
    flooringCarpetSqft?: unknown;
    flooringSheetVinylSqft?: unknown;
  } | null | undefined
): string | null {
  const keyById: Record<string, string> = {
    floor_demo: 'floorDemoSqft',
    floor_prep: 'floorPrepSqft',
    flooring: 'flooringSqft',
    flooring_lvp: 'flooringLvpSqft',
    flooring_laminate: 'flooringLaminateSqft',
    flooring_engineered_hardwood: 'flooringEngineeredHardwoodSqft',
    flooring_solid_hardwood: 'flooringSolidHardwoodSqft',
    tile_flooring: 'flooringTileSqft',
    flooring_carpet: 'flooringCarpetSqft',
    flooring_sheet_vinyl: 'flooringSheetVinylSqft',
  };
  const key = keyById[itemId];
  if (!key || !measurements) return null;
  const value = Number(
    String((measurements as Record<string, unknown>)[key] ?? '').replace(/,/g, '')
  );
  return Number.isFinite(value) && value > 0 ? `${value} sqft` : null;
}

export function dedicatedFlooringMeasurementSeed(
  notes: string | null | undefined
): Record<string, unknown> {
  const text = String(notes || '');
  const area = dedicatedFlooringAreaSqft(text);
  const roles = dedicatedFlooringProductRoles(text);
  const products = roles.installed;
  const demo = notesRequestFlooringDemo(text);
  const prep = notesRequestFloorPrep(text);
  const existing = demo ? inferExistingFlooringFromNotes(text) : null;
  const removedTypes = roles.removed.map(product => product.product);
  const existingTypes = removedTypes.length
    ? removedTypes
    : existing?.flooringExistingTypes?.length
      ? existing.flooringExistingTypes
      : ['unknown'];
  const existingType = existingTypes[0] || 'unknown';
  const seed: Record<string, unknown> = {};
  const itemQuantities: Record<string, { quantity: number; unit: 'sqft'; quantitySource: 'notes' }> = {};
  if (area) {
    if (demo) {
      seed.floorDemoSqft = area;
      seed.flooringExistingCount = 1;
      seed.flooringExistingTypes = existingTypes;
      seed.flooringDemoScopeCount = 1;
      itemQuantities[`floor_demo__${existingType}`] = {
        quantity: area,
        unit: 'sqft',
        quantitySource: 'notes',
      };
      itemQuantities.floor_demo = {
        quantity: area,
        unit: 'sqft',
        quantitySource: 'notes',
      };
    }
    if (products.length === 1) {
      const product = products[0];
      const areaKey: Record<string, string> = {
        lvp: 'flooringLvpSqft',
        laminate: 'flooringLaminateSqft',
        engineered_hardwood: 'flooringEngineeredHardwoodSqft',
        solid_hardwood: 'flooringSolidHardwoodSqft',
        tile: 'flooringTileSqft',
        carpet: 'flooringCarpetSqft',
        sheet_vinyl_vct: 'flooringSheetVinylSqft',
      };
      const key = areaKey[product.product];
      if (key) seed[key] = area;
      seed.flooringSqft = area;
      seed.flooringProductScope = [product.product];
      seed.flooringInstallScopeCount = 1;
      itemQuantities[product.id] = {
        quantity: area,
        unit: 'sqft',
        quantitySource: 'notes',
      };
      if (prep) {
        seed.floorPrepSqft = area;
        seed.floorPrepByProduct = {
          [product.product]: { sqft: area, severity: 'medium' },
        };
        itemQuantities.floor_prep = {
          quantity: area,
          unit: 'sqft',
          quantitySource: 'notes',
        };
      }
    } else if (!products.length) {
      seed.flooringSqft = area;
      itemQuantities.flooring = {
        quantity: area,
        unit: 'sqft',
        quantitySource: 'notes',
      };
      if (prep) {
        seed.floorPrepSqft = area;
        itemQuantities.floor_prep = {
          quantity: area,
          unit: 'sqft',
          quantitySource: 'notes',
        };
      }
    }
  }
  if (Object.keys(itemQuantities).length) seed.itemQuantities = itemQuantities;
  return seed;
}
