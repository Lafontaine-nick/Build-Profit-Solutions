import { affirmativeNoteText } from '@/utils/scopeItemNoteHints';

/**
 * A measured whole-home remodel names the house size and the trades.
 * "Kitchen and bathroom updates" is a work area, not a kitchen-floor takeoff.
 * "Fixtures" in a removal list is fixture demo, not a plumbing fixture package.
 * "Whole house remodel. The house is 2,400 sqft" is the same bid as
 * "Remodel a 2,400 sqft home". A flooring sqft in that note is not the house size.
 */

const HOUSE_SQFT =
  /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet))/i;
const TRADE_SQFT =
  /\b(?:flooring|floors?|drywall|sheetrock|paint(?:ing)?|tile|shower|cabinets?|countertops?|counters?|backsplash|roof(?:ing)?|siding|insulation|trim|baseboards?|lvp|vinyl|carpet)\b/i;

function sameSentenceWindow(text: string, index: number, raw: string): {
  before: string;
  after: string;
} {
  const beforeRaw = text.slice(Math.max(0, index - 36), index);
  const afterRaw = text.slice(index + raw.length, index + raw.length + 36);
  const beforeBreak = Math.max(
    beforeRaw.lastIndexOf('.'),
    beforeRaw.lastIndexOf(';'),
    beforeRaw.lastIndexOf('\n')
  );
  const afterBreak = afterRaw.search(/[.;\n]/);
  return {
    before: beforeBreak >= 0 ? beforeRaw.slice(beforeBreak + 1) : beforeRaw,
    after: afterBreak >= 0 ? afterRaw.slice(0, afterBreak) : afterRaw,
  };
}

function sqftTouchesTrade(text: string, index: number, raw: string): boolean {
  const { before, after } = sameSentenceWindow(text, index, raw);
  return TRADE_SQFT.test(before) || TRADE_SQFT.test(after);
}

/** House size the note stated. A trade quantity such as flooring sqft is not one. */
export function statedWholeHomeSizeSqft(
  notes: string | null | undefined
): number | null {
  const text = String(notes || '');
  const adjacent = text.match(
    new RegExp(
      `${HOUSE_SQFT.source}\\s+(?:home|house)\\b`,
      'i'
    )
  );
  if (adjacent?.[1]) return Number(adjacent[1].replace(/,/g, ''));
  const homeThen = text.match(
    new RegExp(
      `\\b(?:home|house|living(?:\\s+area)?)\\b[^.;\\n]{0,32}?${HOUSE_SQFT.source}`,
      'i'
    )
  );
  if (!homeThen?.[1]) return null;
  const at = homeThen.index ?? 0;
  if (TRADE_SQFT.test(homeThen[0]) || sqftTouchesTrade(text, at, homeThen[0])) {
    return null;
  }
  const size = Number(homeThen[1].replace(/,/g, ''));
  return Number.isFinite(size) && size > 0 ? size : null;
}

function notesNameWholeHome(notes: string): boolean {
  return /\b(?:whole|entire|full)[\s-]+(?:house|home)\b|\b(?:house|home)\s+remodel\b|\bremodel(?:ing)?\s+(?:the\s+)?(?:whole\s+|entire\s+)?(?:house|home)\b/i.test(
    notes
  );
}

export function notesDescribeMeasuredWholeHomeRemodel(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (!/\bremodel/i.test(text) || statedWholeHomeSizeSqft(text) == null) {
    return false;
  }
  if (
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+home\b/i.test(
      text
    )
  ) {
    return true;
  }
  return notesNameWholeHome(text);
}

/**
 * The removed noun is the object of the removal verb.
 * A later install in the same sentence is a different trade.
 */
export function notesNameRemovalOf(
  notes: string | null | undefined,
  term: string
): boolean {
  const verb = String.raw`(?:demolition|demo|remove|removal|tear[\s-]?out|pull)`;
  const stop = String.raw`(?:install|update|repair|paint|replace)`;
  const span = String.raw`(?:(?!\b${stop}\b)[^.;\n])`;
  return new RegExp(
    `\\b${verb}\\b${span}{0,80}\\b(?:${term})\\b|\\b(?:${term})\\b${span}{0,80}\\b${verb}\\b`,
    'i'
  ).test(String(notes || ''));
}

function removalOf(notes: string, term: string): boolean {
  return notesNameRemovalOf(notes, term);
}

function notesNameWholeHomeRemodelScope(text: string): boolean {
  return (
    notesDescribeMeasuredWholeHomeRemodel(text) ||
    (/\bremodel/i.test(text) && notesNameWholeHome(text))
  );
}

/**
 * A whole-home note that names a kitchen without a takeoff.
 * Confirm Scope uses the kitchen remodel panel, not a lump updates card.
 */
export function notesNameKitchenRemodelPanel(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    notesNameWholeHomeRemodelScope(text) &&
    /\bkitchen\b/i.test(text) &&
    !/\b(?:cabinets?|countertops?|counters?|backsplashes?|quartz|granite)\b/i.test(
      text
    )
  );
}

/**
 * A whole-home note that names a bathroom without a takeoff.
 * Confirm Scope uses the bathroom remodel panel, not a lump updates card.
 */
export function notesNameBathroomRemodelPanel(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    notesNameWholeHomeRemodelScope(text) &&
    /\bbath(?:room)?s?\b/i.test(text) &&
    !/\b(?:vanit(?:y|ies)|toilets?|showers?|tubs?|bathtubs?|bath(?:room)?\s+fixtures?)\b/i.test(
      text
    )
  );
}

/** A flooring area the note actually stated. House size in the previous sentence is not one. */
export function notesStateFlooringArea(notes: string | null | undefined): boolean {
  const text = String(notes || '');
  const otherTrade =
    /\b(?:paint(?:ing)?|drywall|sheetrock|cabinet|counter(?:top)?s?|backsplash|roof(?:ing)?|insulation|siding|stucco|tile)\b/i;
  const gapOk = (gap: string) => !otherTrade.test(gap);
  const forward =
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b([^.;\n]{0,40})\b(?:floor(?:ing)?|lvp|luxury\s+vinyl|laminate|vinyl|carpet)\b/gi;
  const backward =
    /\b(?:floor(?:ing)?|lvp|luxury\s+vinyl|laminate|vinyl|carpet)\b([^.;\n]{0,40})\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/gi;
  let match: RegExpExecArray | null;
  while ((match = forward.exec(text))) {
    if (gapOk(match[1] || '')) return true;
  }
  while ((match = backward.exec(text))) {
    if (gapOk(match[1] || '')) return true;
  }
  return false;
}

/** "Appliances are owner-supplied" is not a kitchen install. */
export function notesNameOwnerSuppliedAppliances(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return /\bappliances?\b[^.;\n]{0,48}\b(?:owner|customer)[-\s]?(?:suppl(?:y|ies|ied)|provided|provides|providing)\b|\b(?:owner|customer)[-\s]?(?:suppl(?:y|ies|ied)|provided|provides|providing)\b[^.;\n]{0,48}\bappliances?\b/i.test(
    text
  );
}

/** A drywall area the note actually stated. "Drywall" alone is not one. */
export function notesStateDrywallArea(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  const drywall =
    /\b(?:drywall|sheetrock|gypsum)\b|\bhang\s+and\s+finish\b/i;
  const otherTrade =
    /\b(?:floor(?:ing)?|lvp|vinyl|carpet|paint(?:ing)?|tile|cabinets?|countertops?|counters?|backsplash|roof(?:ing)?|insulation|siding|stucco)\b/i;
  const sqft =
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/gi;
  let match: RegExpExecArray | null;
  while ((match = sqft.exec(text))) {
    const start = match.index;
    const end = start + match[0].length;
    let before = text.slice(Math.max(0, start - 60), start);
    let after = text.slice(end, end + 60);
    const beforeBreak = Math.max(
      before.lastIndexOf('.'),
      before.lastIndexOf(';'),
      before.lastIndexOf('\n')
    );
    if (beforeBreak >= 0) before = before.slice(beforeBreak + 1);
    const previousQty = before.search(
      /\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))/i
    );
    if (previousQty >= 0) {
      const rest = before.slice(previousQty);
      const qtyWord = rest.search(
        /\b(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i
      );
      before =
        qtyWord >= 0
          ? rest
              .slice(qtyWord)
              .replace(/^(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i, '')
          : '';
    }
    const afterBreak = after.search(/[.;\n]/);
    if (afterBreak >= 0) after = after.slice(0, afterBreak);
    const nextQty = after.search(
      /\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))/i
    );
    if (nextQty >= 0) after = after.slice(0, nextQty);
    const namesDrywallBeforeAnotherTrade = (side: string) => {
      const drywallAt = side.search(drywall);
      if (drywallAt < 0) return false;
      const otherAt = side.search(otherTrade);
      return otherAt < 0 || drywallAt < otherAt;
    };
    if (
      namesDrywallBeforeAnotherTrade(before) ||
      namesDrywallBeforeAnotherTrade(after)
    ) {
      return true;
    }
  }
  return false;
}

/** A paint area the note actually stated. "Paint the interior" is not one. */
export function notesStatePaintArea(notes: string | null | undefined): boolean {
  const text = String(notes || '');
  const otherTrade =
    /\b(?:floor(?:ing)?|tile|drywall|sheetrock|cabinet|counter(?:top)?s?|backsplash|roof(?:ing)?|insulation|siding|stucco)\b/i;
  const gapIsPaint = (gap: string) => !otherTrade.test(gap);
  const forward =
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b([^.;\n]{0,35})\b(?:paint(?:ing)?|repaint)\b/gi;
  const backward =
    /\b(?:paint(?:ing)?|repaint)\b([^.;\n]{0,35})\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/gi;
  let match: RegExpExecArray | null;
  while ((match = forward.exec(text))) {
    if (gapIsPaint(match[1] || '')) return true;
  }
  while ((match = backward.exec(text))) {
    if (gapIsPaint(match[1] || '')) return true;
  }
  return false;
}

/** Install length next to cabinets. The removal length is a different number. */
export function statedCabinetInstallLf(
  notes: string | null | undefined
): number | null {
  const text = String(notes || '');
  const re =
    /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:feet|foot))\b([^.;\n]{0,28})/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (!/\bcabinets?\b|\bcabs\b/i.test(match[2] || '')) continue;
    const before = text.slice(Math.max(0, match.index - 40), match.index);
    if (
      /\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b/i.test(before) ||
      /\bexisting\b/i.test(match[2] || '')
    ) {
      continue;
    }
    const qty = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(qty) && qty > 0) return qty;
  }
  return null;
}

/** "Keep the windows" is not a window install. "Replace 3 windows" still is. */
export function notesOpeningMentionIsKeepOnly(
  notes: string | null | undefined,
  opening: 'doors' | 'windows'
): boolean {
  const term = opening === 'doors' ? 'doors?' : 'windows?';
  const text = String(notes || '');
  const mention = new RegExp(`\\b${term}\\b`, 'i');
  if (!mention.test(text)) return false;
  const sentences = text
    .split(/[.\n;]+/)
    .map(sentence => sentence.trim())
    .filter(sentence => mention.test(sentence));
  if (!sentences.length) return false;
  return sentences.every(sentence => {
    const kept = new RegExp(
      `\\b(?:keep|keeping|leaving|leave|exclude|excluding)\\b(?:\\s+\\w+){0,6}\\s+${term}\\b`,
      'i'
    ).test(sentence);
    const installed = new RegExp(
      `\\b(?:install|replace|replacing|hang|swap|new)\\b(?:\\s+\\w+){0,6}\\s+(?:interior\\s+|exterior\\s+)?${term}\\b|\\b\\d+\\s+(?:interior\\s+|exterior\\s+)?${term}\\b`,
      'i'
    ).test(sentence);
    return kept && !installed;
  });
}

function notesNameFraming(notes: string): boolean {
  return /\b(?:frame|framing|framed)\b/i.test(notes);
}

function notesNameDoorPaint(notes: string): boolean {
  return /\b(?:paint|repaint|painting|coat|prime)(?:ed|ing)?\s+(?:the\s+)?(?:interior\s+)?doors?\b|\b(?:interior\s+)?doors?\s+(?:to\s+be\s+)?(?:painted|repainted|coated|primed)\b/i.test(
    notes
  );
}

function notesNameTrimPaint(notes: string): boolean {
  return /\b(?:paint|repaint|painting|coat|prime)(?:ed|ing)?\s+(?:the\s+)?(?:baseboards?|trim)\b|\b(?:baseboards?|trim)\s+(?:to\s+be\s+)?(?:painted|repainted|coated|primed)\b/i.test(
    notes
  );
}

const OTHER_WHOLE_HOME_TRADES: Array<[string, RegExp]> = [
  ['hvac', /\bhvac\b|\bfurnace\b|\bair\s+condition|\ba\/?c\b|\bductwork\b|\bheat\s+pump\b|\bmini[\s-]?splits?\b/i],
  ['roofing', /\broof(?:ing)?\b(?!\s+deck)/i],
  ['siding', /\bsiding\b/i],
  ['stucco', /\bstucco\b/i],
  ['gutters', /\bgutters?\b/i],
  ['decking', /(?<!roof\s)\bdeck(?:ing)?\b/i],
  ['fencing', /\bfenc(?:e|es|ing)\b/i],
  ['water_heater', /\bwater\s+heaters?\b/i],
  ['lighting', /\blight(?:ing|s)\b|\blight\s+fixtures?\b/i],
  ['stairs', /\bstair(?:s|case|way)?\b/i],
  ['concrete', /\bconcrete\b|\bdriveway\b|\bpatio\b|\bsidewalk\b/i],
  ['landscaping', /\blandscap/i],
  ['garage_doors', /\bgarage\s+doors?\b/i],
  ['fireplace', /\bfireplaces?\b/i],
  ['closets', /\bclosets?\b/i],
  ['basement_finish', /\bbasement\b/i],
];

const OTHER_TRADE_CARDS: Record<
  string,
  { label: string; category: string }
> = {
  hvac: { label: 'HVAC', category: 'mechanical' },
  roofing: { label: 'Roofing', category: 'exterior' },
  siding: { label: 'Siding', category: 'exterior' },
  stucco: { label: 'Stucco', category: 'exterior' },
  gutters: { label: 'Gutters', category: 'exterior' },
  decking: { label: 'Deck', category: 'exterior' },
  fencing: { label: 'Fence', category: 'exterior' },
  exterior_paint: { label: 'Exterior paint', category: 'finishes' },
  water_heater: { label: 'Water heater', category: 'plumbing' },
  lighting: { label: 'Lighting', category: 'electrical' },
  appliances: { label: 'Appliances', category: 'kitchen' },
  tile: { label: 'Tile', category: 'tile' },
  demo: { label: 'Demolition', category: 'demo' },
  stairs: { label: 'Stairs', category: 'structure' },
  concrete: { label: 'Concrete', category: 'exterior' },
  landscaping: { label: 'Landscaping', category: 'exterior' },
  garage_doors: { label: 'Garage doors', category: 'openings' },
  fireplace: { label: 'Fireplace', category: 'finishes' },
  closets: { label: 'Closets', category: 'finishes' },
  basement_finish: { label: 'Basement finish', category: 'structure' },
};

/** Cards this whole-home note actually named. Null when the note is not that bid. */
export function wholeHomeRemodelNamedItemIds(
  notes: string | null | undefined
): Set<string> | null {
  const text = String(notes || '');
  const wholeHomeRemodel =
    notesDescribeMeasuredWholeHomeRemodel(text) ||
    (/\bremodel/i.test(text) && notesNameWholeHome(text));
  if (!wholeHomeRemodel) return null;
  const ids = new Set<string>();
  if (/\bflooring\b|\blvp\b|\bluxury\s+vinyl\b/i.test(text)) ids.add('flooring');
  if (/\b(?:drywall|sheetrock|gypsum)\b/i.test(text)) {
    ids.add('drywall');
    ids.add('patch_repair');
  }
  if (
    /\bwindows?\b/i.test(text) &&
    !notesOpeningMentionIsKeepOnly(text, 'windows')
  ) {
    ids.add('window_install');
    ids.add('windows');
  }
  if (/\bexterior\s+doors?\b/i.test(text)) {
    ids.add('exterior_doors');
    ids.add('exterior_door_install');
  }
  if (
    /\binterior\s+doors?\b/i.test(text) ||
    (/\bdoors?\b/i.test(text) &&
      !/\bexterior\s+doors?\b/i.test(text) &&
      !notesOpeningMentionIsKeepOnly(text, 'doors'))
  ) {
    ids.add('interior_door_install');
  }
  if (/\binsulat/i.test(text)) ids.add('insulation');
  if (/\btrim\b/i.test(text)) {
    ids.add('trim');
    ids.add('baseboard_install');
  }
  if (/\bbaseboards?\b|\bbase\s*board\b/i.test(text)) ids.add('baseboard_install');
  if (/\bplumbing\b/i.test(text)) ids.add('plumbing');
  if (/\belectrical\b/i.test(text)) ids.add('electrical');
  const exteriorPaint =
    /\bexterior\b[^.;,\n]{0,20}\bpaint(?:ing)?\b|\bpaint(?:ing)?\b[^.;,\n]{0,20}\bexterior\b/gi;
  if (exteriorPaint.test(text)) ids.add('exterior_paint');
  if (/\bpaint(?:ing)?\b/i.test(text.replace(exteriorPaint, ' '))) {
    ids.add('interior_paint');
    ids.add('paint');
  }
  if (removalOf(text, 'cabinets?')) ids.add('cabinet_demo');
  if (
    /\b(?:install|new|replace)\b[^.;\n]{0,60}\bcabinets?\b|\bcabinets?\b[^.;\n]{0,40}\b(?:install|new)\b/i.test(
      text
    ) ||
    (/\bcabinets?\b|\bcabinetry\b/i.test(text) &&
      !removalOf(text, 'cabinets?') &&
      !/\bpaint\w*\s+(?:the\s+)?cabinets?\b/i.test(text))
  ) {
    ids.add('cabinets');
  }
  const affirmative = affirmativeNoteText(text);
  for (const [id, pattern] of OTHER_WHOLE_HOME_TRADES) {
    if (pattern.test(affirmative)) ids.add(id);
  }
  if (
    /\bappliances?\b/i.test(text) &&
    !notesNameOwnerSuppliedAppliances(text)
  ) {
    ids.add('appliances');
  }
  if (/\b(?:countertops?|quartz|granite)\b/i.test(text)) ids.add('countertops');
  if (/\bbacksplash\b/i.test(text)) ids.add('backsplash');
  if (/\bshower\s+walls?\b|\bshower\s+(?:wall\s+)?tile\b/i.test(text)) {
    ids.add('shower_tile');
  }
  if (/\bfloor\s+tile\b|\bbath(?:room)?\s+floor\b/i.test(text)) {
    ids.add('floor_tile');
  }
  if (/\bvanit(?:y|ies)\b/i.test(text)) ids.add('vanity');
  if (removalOf(text, 'fixtures?')) ids.add('fixture_demo');
  if (removalOf(text, 'floor(?:ing)?|lvp|vinyl|carpet|tile')) {
    ids.add('floor_demo');
  }
  if (notesNameFraming(text)) {
    ids.add('framing');
    ids.add('wall_framing');
  }
  if (notesNameDoorPaint(text)) {
    ids.add('door_paint');
    ids.add('door_casing_paint');
  }
  if (notesNameTrimPaint(text)) ids.add('trim_paint');
  if (
    /\btile\b/i.test(text) &&
    !ids.has('shower_tile') &&
    !ids.has('floor_tile') &&
    !ids.has('backsplash') &&
    !removalOf(text, 'tile')
  ) {
    ids.add('tile');
  }
  if (
    /\b(?:demo|demolition|gut)\b/i.test(text) &&
    !ids.has('cabinet_demo') &&
    !ids.has('fixture_demo') &&
    !ids.has('floor_demo')
  ) {
    ids.add('demo');
  }
  // "Kitchen and bathroom updates" is the work. It is not a cabinet count
  // or a kitchen-floor quantity.
  if (
    /\bkitchen\b/i.test(text) &&
    !ids.has('cabinets') &&
    !ids.has('countertops') &&
    !ids.has('backsplash') &&
    !ids.has('appliances')
  ) {
    ids.add('kitchen_updates');
  }
  if (
    /\bbath(?:room)?s?\b/i.test(text) &&
    !ids.has('vanity') &&
    !ids.has('shower_tile') &&
    !ids.has('floor_tile')
  ) {
    ids.add('bathroom_updates');
  }
  return ids;
}

/** A whole-house remodel that names no trade. */
export function notesAskWhichRoomsAndTrades(
  notes: string | null | undefined
): boolean {
  const named = wholeHomeRemodelNamedItemIds(notes);
  return named != null && named.size === 0;
}

export function wholeHomeTradeQuestion(
  notes: string | null | undefined
): string | null {
  if (!notesAskWhichRoomsAndTrades(notes)) return null;
  const size = statedWholeHomeSizeSqft(notes);
  const house = size
    ? ` The house area is ${size.toLocaleString('en-US')} SF.`
    : '';
  return `Which job scopes are being done?${house} Add the measurements you already have, and what each scope still needs, so the bid can be structured.`;
}

type WholeHomeItem = {
  id: string;
  label?: string | null;
  helperText?: string | null;
  state?: string | null;
  noteBacked?: boolean;
  inputType?: string | null;
  category?: string | null;
  choiceId?: string | null;
  choiceIds?: string[] | null;
  contractorRemoved?: boolean;
};

const DUPLICATE_SCOPE_IDS: string[][] = [
  ['windows', 'window_install'],
  ['exterior_doors', 'exterior_door_install'],
  ['interior_door_install', 'interior_doors'],
  ['paint', 'interior_paint'],
  ['drywall', 'patch_repair'],
  ['trim', 'baseboard_install'],
];

const NAMED_CARDS: Record<
  string,
  { label: string; helperText: string; category: string }
> = {
  ...Object.fromEntries(
    Object.entries(OTHER_TRADE_CARDS).map(([id, card]) => [
      id,
      {
        ...card,
        helperText: `${card.label} named in the notes. Enter the quantity before pricing.`,
      },
    ])
  ),
  cabinet_demo: {
    label: 'Cabinet removal',
    helperText: 'Remove the existing cabinets named in the notes.',
    category: 'demo',
  },
  cabinets: {
    label: 'Cabinets',
    helperText: 'New cabinet length named in the notes.',
    category: 'cabinets',
  },
  countertops: {
    label: 'Countertops',
    helperText: 'Countertop area named in the notes.',
    category: 'cabinets',
  },
  backsplash: {
    label: 'Backsplash',
    helperText: 'Backsplash area named in the notes.',
    category: 'tile',
  },
  shower_tile: {
    label: 'Shower wall tile',
    helperText: 'Shower wall area named in the notes.',
    category: 'tile',
  },
  floor_tile: {
    label: 'Bathroom floor tile',
    helperText: 'Bathroom floor tile area named in the notes.',
    category: 'tile',
  },
  vanity: {
    label: 'Vanities',
    helperText: 'Vanities named in the notes.',
    category: 'bath',
  },
  fixture_demo: {
    label: 'Fixture removal',
    helperText: 'Remove the existing fixtures named in the notes.',
    category: 'demo',
  },
  floor_demo: {
    label: 'Flooring removal',
    helperText: 'Existing flooring is being removed. Area was not stated.',
    category: 'demo',
  },
  windows: {
    label: 'Window install',
    helperText: 'Window count from the notes.',
    category: 'openings',
  },
  exterior_doors: {
    label: 'Exterior doors',
    helperText: 'Exterior door count from the notes.',
    category: 'openings',
  },
  interior_door_install: {
    label: 'Interior door installation',
    helperText: 'Interior door count from the notes.',
    category: 'openings',
  },
  insulation: {
    label: 'Insulation',
    helperText: 'Insulation named in the notes. Area was not stated.',
    category: 'structure',
  },
  trim: {
    label: 'Trim / baseboard installation',
    helperText: 'Interior trim length named in the notes.',
    category: 'finishes',
  },
  flooring: {
    label: 'Flooring installation',
    helperText: 'Flooring was named in the notes. Enter the area before pricing.',
    category: 'flooring',
  },
  kitchen_updates: {
    label: 'Kitchen updates',
    helperText:
      'Kitchen work named in the notes. Cabinet, counter, and finish quantities were not stated.',
    category: 'kitchen',
  },
  bathroom_updates: {
    label: 'Bathroom updates',
    helperText:
      'Bathroom work named in the notes. Fixture and finish quantities were not stated.',
    category: 'bath',
  },
};

/** Both wall and attic were named, with no area. */
export function wholeHomeWallAndAtticInsulationLabel(
  notes: string | null | undefined
): string | null {
  const text = String(notes || '');
  const wall =
    /\b(?:wall|walls)\b[^.;,\n]{0,40}\binsulat(?:e|ion|ed)\b|\binsulat(?:e|ion|ed)\b[^.;,\n]{0,40}\b(?:wall|walls)\b/i.test(
      text
    );
  const attic =
    /\battic\b[^.;,\n]{0,40}\binsulat(?:e|ion|ed)\b|\binsulat(?:e|ion|ed)\b[^.;,\n]{0,40}\battic\b/i.test(
      text
    );
  return wall && attic ? 'Wall & attic insulation' : null;
}

const ENTERED_REMODEL_CARDS: Array<{
  id: string;
  measurement: string;
  label: string;
  helperText: string;
  category: string;
}> = [
  {
    id: 'cabinets',
    measurement: 'cabinetLf',
    label: 'Cabinets',
    helperText: 'Cabinet run length for this kitchen.',
    category: 'kitchen',
  },
  {
    id: 'countertops',
    measurement: 'countertopSqft',
    label: 'Countertops',
    helperText: 'Perimeter countertop area.',
    category: 'kitchen',
  },
  {
    id: 'backsplash',
    measurement: 'backsplashSqft',
    label: 'Backsplash',
    helperText: 'Backsplash tile area.',
    category: 'tile',
  },
  {
    id: 'vanity',
    measurement: 'bathroomInstallVanityCount',
    label: 'Vanity',
    helperText: 'Vanity count for this bathroom.',
    category: 'bath',
  },
  {
    id: 'toilet',
    measurement: 'bathroomInstallToiletCount',
    label: 'Toilet',
    helperText: 'Toilet count for this bathroom.',
    category: 'bath',
  },
  {
    id: 'shower_tile',
    measurement: 'showerWallTileSqft',
    label: 'Shower wall tile',
    helperText: 'Shower wall tile area.',
    category: 'bath',
  },
  {
    id: 'shower_floor_tile',
    measurement: 'showerFloorTileSqft',
    label: 'Shower floor tile',
    helperText: 'Shower floor tile area.',
    category: 'bath',
  },
  {
    id: 'floor_tile',
    measurement: 'bathroomFloorSqft',
    label: 'Bath floor tile',
    helperText: 'Bathroom floor tile area. Separate from house flooring.',
    category: 'bath',
  },
];

function enteredRemodelQuantity(
  measurements: Record<string, unknown> | null | undefined,
  key: string
): boolean {
  const parsed = Number(String(measurements?.[key] ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0;
}

/**
 * A typed kitchen or bathroom takeoff becomes its own card.
 * Vanity length is not a kitchen cabinet length, so it does not add cabinets.
 */
export function includeEnteredRemodelCards<T extends WholeHomeItem>(
  items: T[],
  measurements?: Record<string, unknown> | null
): T[] {
  if (!measurements) return items;
  let next = items.slice();
  for (const card of ENTERED_REMODEL_CARDS) {
    const entered = enteredRemodelQuantity(measurements, card.measurement);
    const index = next.findIndex(item => item.id === card.id);
    if (!entered) {
      if (index >= 0 && next[index].noteBacked !== true && next[index].state === 'included') {
        next[index] = { ...next[index], state: 'excluded' as const };
      }
      continue;
    }
    if (index >= 0) {
      if (next[index].state !== 'included') {
        next[index] = {
          ...next[index],
          state: 'included' as const,
        };
      }
      continue;
    }
    next.push({
      id: card.id,
      inputType: 'yes_no',
      label: card.label,
      helperText: card.helperText,
      category: card.category,
      state: 'included',
      noteBacked: false,
    } as T);
  }
  return next;
}

export function applyWholeHomeRemodelChecklist<T extends WholeHomeItem>(
  items: T[],
  notes: string | null | undefined,
  measurements?: Record<string, unknown> | null
): T[] {
  const allowed = wholeHomeRemodelNamedItemIds(notes);
  if (!allowed) return items;
  const text = String(notes || '');
  const next = items.map(item => {
    const id = String(item.id || '');
    if (id.startsWith('custom_')) {
      if (allowed.size > 0) return item;
      return {
        ...item,
        state: 'excluded' as const,
        noteBacked: false,
      };
    }
    if (!allowed.has(id)) {
      const choiceItem =
        item.inputType === 'choice' || item.inputType === 'multi_choice';
      if (!choiceItem && item.state === 'excluded') return item;
      if (
        item.inputType === 'choice' &&
        item.choiceId === 'not_in_scope' &&
        item.state === 'excluded'
      ) {
        return item;
      }
      return {
        ...item,
        state: 'excluded' as const,
        noteBacked: false,
        ...(item.inputType === 'choice' ? { choiceId: 'not_in_scope' } : {}),
        ...(item.inputType === 'multi_choice'
          ? { choiceIds: ['not_in_scope'] }
          : {}),
      };
    }
    if (item.contractorRemoved) return item;
    const included = {
      ...item,
      state: 'included' as const,
      noteBacked: true,
    };
    if (
      id === 'plumbing' &&
      /fixture updates/i.test(String(item.label || '')) &&
      !/\b(?:updat(?:e|ing)|replac(?:e|ing)|new)\b[^.;\n]{0,40}\bfixtures?\b/i.test(
        text
      )
    ) {
      return {
        ...included,
        label: 'Plumbing',
        helperText:
          'Plumbing work named in the notes. Fixture removal stays on its own line.',
      };
    }
    if (id === 'insulation') {
      const insulationLabel = wholeHomeWallAndAtticInsulationLabel(text);
      if (insulationLabel) {
        return {
          ...included,
          label: insulationLabel,
          helperText:
            'Wall and attic insulation named in the notes. Area was not stated.',
        };
      }
    }
    return included;
  });
  for (const [id, card] of Object.entries(NAMED_CARDS)) {
    if (!allowed.has(id) || next.some(item => item.id === id)) continue;
    const aliasKept = DUPLICATE_SCOPE_IDS.some(
      group =>
        group.includes(id) &&
        group.some(
          other =>
            other !== id &&
            next.some(item => item.id === other && item.state === 'included')
        )
    );
    if (aliasKept) continue;
    const insulationLabel =
      id === 'insulation' ? wholeHomeWallAndAtticInsulationLabel(text) : null;
    next.push({
      id,
      inputType: 'yes_no',
      label: insulationLabel || card.label,
      helperText: insulationLabel
        ? 'Wall and attic insulation named in the notes. Area was not stated.'
        : card.helperText,
      category: card.category,
      state: 'included',
      noteBacked: true,
    } as T);
  }
  const deduped = DUPLICATE_SCOPE_IDS.reduce((rows, group) => {
    const keeper = group.find(id =>
      rows.some(item => item.id === id && item.state === 'included')
    );
    if (!keeper) return rows;
    return rows.map(item =>
      group.includes(item.id) && item.id !== keeper && item.state === 'included'
        ? { ...item, state: 'excluded' as const, noteBacked: false }
        : item
    );
  }, next);
  return includeEnteredRemodelCards(deduped, measurements);
}

function positiveMeasurement(value: unknown): number | null {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function userEnteredItemQuantity(
  measurements: Record<string, unknown>,
  itemId: string
): boolean {
  const quantities = measurements.itemQuantities as
    | Record<string, { quantity?: unknown; quantitySource?: string }>
    | undefined;
  const row = quantities?.[itemId];
  return (
    row?.quantitySource === 'user_entered' &&
    positiveMeasurement(row.quantity) != null
  );
}

/**
 * A measured whole-home note names the trade without a takeoff.
 * Do not turn that into 1 LF, one connection, or a living-area envelope.
 */
export function wholeHomeRemodelSuppressesInventedPrice(
  itemId: string,
  notes: string | null | undefined,
  measurements?: Record<string, unknown> | null
): boolean {
  if (!notesDescribeMeasuredWholeHomeRemodel(notes)) return false;
  const stored = measurements || {};
  if (userEnteredItemQuantity(stored, itemId)) return false;
  if (itemId === 'cabinet_demo') {
    if (positiveMeasurement(stored.cabinetDemoLf) != null) return false;
    const installNamed =
      /\b(?:install|new|replace)\b[^.;\n]{0,60}\bcabinets?\b/i.test(
        String(notes || '')
      );
    if (installNamed) return true;
    return positiveMeasurement(stored.cabinetLf) == null;
  }
  if (
    itemId === 'interior_paint' ||
    itemId === 'paint' ||
    itemId === 'ceiling_paint' ||
    itemId === 'paint_trim'
  ) {
    return !notesStatePaintArea(notes);
  }
  if (
    itemId === 'drywall' ||
    itemId === 'patch_repair' ||
    itemId === 'hang' ||
    itemId === 'finish_tape'
  ) {
    return !notesStateDrywallArea(notes);
  }
  if (itemId === 'floor_demo') {
    if (!removalOf(String(notes || ''), 'floor(?:ing)?|lvp|vinyl|carpet|tile')) {
      return true;
    }
    return positiveMeasurement(stored.floorDemoSqft) == null;
  }
  if (
    itemId === 'plumbing' ||
    itemId === 'plumbing_rough' ||
    itemId === 'plumbing_trim'
  ) {
    if (positiveMeasurement(stored.plumbingRoughPointCount) != null) {
      return false;
    }
    return !/\b\d[\d,]*(?:\.\d+)?\s*(?:fixtures?|connections?|rough[-\s]?ins?|lf)\b/i.test(
      String(notes || '')
    );
  }
  if (itemId === 'kitchen_updates' || itemId === 'bathroom_updates') {
    return true;
  }
  if (
    itemId === 'flooring' ||
    itemId === 'flooring_lvp' ||
    itemId === 'tile_flooring'
  ) {
    if (notesStateFlooringArea(notes)) return false;
    if (userHeld(stored, 'flooringSqft') || userHeld(stored, 'flooringLvpSqft')) {
      return false;
    }
    const home = statedWholeHomeSizeSqft(notes);
    const floorQty = positiveMeasurement(stored.flooringSqft);
    const lvpQty = positiveMeasurement(stored.flooringLvpSqft);
    if (floorQty != null && (home == null || floorQty !== home)) return false;
    if (lvpQty != null && (home == null || lvpQty !== home)) return false;
    return true;
  }
  if (itemId === 'insulation') {
    const statedSurface =
      positiveMeasurement(stored.exteriorWallInsulationSqft) != null ||
      positiveMeasurement(stored.atticInsulationSqft) != null ||
      positiveMeasurement(stored.insulatedRoofDeckSqft) != null ||
      positiveMeasurement(stored.floorInsulationSqft) != null ||
      /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+(?:of\s+)?(?:wall\s+|attic\s+)?insulat/i.test(
        String(notes || '')
      ) ||
      /\binsulat(?:e|ion|ed)\b[^.;\n]{0,40}\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft)/i.test(
        String(notes || '')
      );
    return !statedSurface;
  }
  // A house-wide package (shower tile, appliances, roofing) is not this note
  // unless the note named that trade. Leave stated lines such as air sealing.
  if (itemId === 'shower_tile' && positiveMeasurement(stored.showerWallTileSqft)) {
    return false;
  }
  if (
    itemId === 'shower_floor_tile' &&
    positiveMeasurement(stored.showerFloorTileSqft)
  ) {
    return false;
  }
  if (itemId === 'floor_tile' && positiveMeasurement(stored.bathroomFloorSqft)) {
    return false;
  }
  if (
    itemId === 'shower_tile' ||
    itemId === 'shower_floor_tile' ||
    itemId === 'glass_door' ||
    itemId === 'appliances' ||
    itemId === 'roofing' ||
    itemId === 'stucco' ||
    itemId === 'brick'
  ) {
    const named = wholeHomeRemodelNamedItemIds(notes);
    return !named || !named.has(itemId);
  }
  return false;
}

function userHeld(
  measurements: Record<string, unknown>,
  key: string
): boolean {
  const sources =
    (measurements.quickMeasurementSources as Record<string, string> | undefined) ||
    {};
  const overrides =
    (measurements.quickMeasurementUserOverrides as
      | Record<string, boolean>
      | undefined) || {};
  return (
    overrides[key] === true ||
    sources[key] === 'user_entered' ||
    sources[key] === 'manual_override'
  );
}

/** Drop whole-home quantities the note did not state. Typed values stay. */
export function scrubWholeHomeRemodelMeasurements<
  T extends Record<string, unknown>,
>(measurements: T, notes: string | null | undefined): T {
  if (!notesDescribeMeasuredWholeHomeRemodel(notes)) return measurements;
  const text = String(notes || '');
  const next = { ...measurements } as T;
  let changed = false;
  const drop = (key: string) => {
    if (userHeld(measurements, key)) return;
    if (key in next) {
      delete next[key];
      changed = true;
    }
  };
  if (!notesStatePaintArea(text)) {
    drop('wallPaintSqft');
    drop('ceilingPaintSqft');
    drop('paintAreaSqft');
    drop('combinedPaintableAreaSqft');
    drop('originalPaintAreaReferenceSqft');
  }
  if (!notesStateDrywallArea(text)) {
    drop('drywallSqft');
    drop('patchRepairSqft');
    const itemQuantities = {
      ...((next.itemQuantities as Record<
        string,
        { quantity?: unknown; quantitySource?: string }
      > | undefined) || {}),
    };
    let droppedDrywall = false;
    for (const id of ['drywall', 'patch_repair', 'hang', 'finish_tape']) {
      const row = itemQuantities[id];
      if (
        row &&
        row.quantitySource !== 'user_entered' &&
        row.quantitySource !== 'manual_override'
      ) {
        delete itemQuantities[id];
        droppedDrywall = true;
      }
    }
    if (droppedDrywall) {
      next.itemQuantities = itemQuantities;
      changed = true;
    }
  }
  if (!notesStateFlooringArea(text)) {
    const homeSizeForFloor = statedWholeHomeSizeSqft(text);
    for (const key of ['flooringSqft', 'flooringLvpSqft'] as const) {
      if (userHeld(measurements, key)) continue;
      const qty = Number(String(next[key] ?? '').replace(/,/g, ''));
      if (homeSizeForFloor != null && qty === homeSizeForFloor) drop(key);
    }
    const itemQuantities = {
      ...((next.itemQuantities as Record<string, { quantity?: unknown; quantitySource?: string }> | undefined) ||
        {}),
    };
    let droppedQuantity = false;
    for (const id of ['flooring', 'flooring_lvp', 'tile_flooring']) {
      const row = itemQuantities[id];
      const qty = Number(String(row?.quantity ?? '').replace(/,/g, ''));
      if (
        row &&
        row.quantitySource !== 'user_entered' &&
        row.quantitySource !== 'manual_override' &&
        homeSizeForFloor != null &&
        qty === homeSizeForFloor
      ) {
        delete itemQuantities[id];
        droppedQuantity = true;
      }
    }
    if (droppedQuantity) {
      next.itemQuantities = itemQuantities;
      changed = true;
    }
  }
  if (!/\bkitchen\s+floor(?:ing)?\b/i.test(text)) drop('kitchenFloorSqft');
  if (!notesNameFraming(text)) {
    drop('wallFramingSqft');
    drop('framedAreaSqft');
    drop('wallFramingLf');
  }
  const homeSize = statedWholeHomeSizeSqft(text);
  const removalNamesItsOwnArea =
    /\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b[^.;\n]{0,40}?(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+(?:of\s+)?(?:existing\s+)?(?:floor|flooring)\b/i.test(
      text
    );
  const namesFlooringRemoval = removalOf(
    text,
    'floor(?:ing)?|lvp|vinyl|carpet|tile'
  );
  const demoQty = Number(String(next.floorDemoSqft ?? '').replace(/,/g, ''));
  if (
    !userHeld(measurements, 'floorDemoSqft') &&
    (!namesFlooringRemoval ||
      (!removalNamesItsOwnArea &&
        homeSize != null &&
        demoQty === homeSize))
  ) {
    drop('floorDemoSqft');
    const itemQuantities = {
      ...((next.itemQuantities as Record<string, unknown> | undefined) || {}),
    };
    if (itemQuantities.floor_demo) {
      delete itemQuantities.floor_demo;
      next.itemQuantities = itemQuantities;
      changed = true;
    }
  }
  const flooringQty = Number(String(next.flooringSqft ?? '').replace(/,/g, ''));
  const dropBorrowedTileArea = (
    key: 'bathroomFloorSqft' | 'showerWallTileSqft' | 'showerFloorTileSqft',
    namedInNote: boolean
  ) => {
    if (namedInNote || userHeld(measurements, key)) return;
    const qty = Number(String(next[key] ?? '').replace(/,/g, ''));
    if (!(qty > 0)) return;
    if (qty === flooringQty || (homeSize != null && qty === homeSize)) {
      drop(key);
    }
  };
  dropBorrowedTileArea(
    'bathroomFloorSqft',
    /\bbath(?:room)?\s+floor(?:\s+tile)?\b|(?<!shower\s)floor\s+tile\b/i.test(
      text
    )
  );
  dropBorrowedTileArea(
    'showerWallTileSqft',
    /\bshower\s+wall(?:\s+tile)?\b|\bwall\s+tile\b/i.test(text)
  );
  dropBorrowedTileArea(
    'showerFloorTileSqft',
    /\bshower\s+floor(?:\s+tile)?\b/i.test(text)
  );
  if (!/\bkitchen\s+floor(?:ing)?\b/i.test(text)) {
    const itemQuantities = {
      ...((next.itemQuantities as Record<string, unknown> | undefined) || {}),
    };
    if (itemQuantities.kitchen_floor || itemQuantities.flooring_kitchen) {
      delete itemQuantities.kitchen_floor;
      delete itemQuantities.flooring_kitchen;
      next.itemQuantities = itemQuantities;
      changed = true;
    }
  }
  return changed ? next : measurements;
}
