/**
 * A measured whole-home remodel names the house size and the trades.
 * "Kitchen and bathroom updates" is a work area, not a kitchen-floor takeoff.
 * "Fixtures" in a removal list is fixture demo, not a plumbing fixture package.
 * "Whole house remodel. The house is 2,400 sqft" is the same bid as
 * "Remodel a 2,400 sqft home". A flooring sqft in that note is not the house size.
 */

const HOUSE_SQFT =
  /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))/i;
const TRADE_SQFT =
  /\b(?:flooring|floors?|drywall|sheetrock|paint(?:ing)?|tile|shower|cabinets?|countertops?|counters?|backsplash|roof(?:ing)?|siding|insulation|trim|baseboards?|lvp|vinyl|carpet)\b/i;

function sqftTouchesTrade(text: string, index: number, raw: string): boolean {
  const before = text.slice(Math.max(0, index - 36), index);
  const after = text.slice(index + raw.length, index + raw.length + 36);
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
  const verb = String.raw`(?:demolition|demo|remove|removal|tear[\s-]?out)`;
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

/**
 * A measured whole-home note that names a kitchen remodel without a takeoff.
 * Confirm Scope uses the kitchen remodel panel, not a lump updates card.
 */
export function notesNameKitchenRemodelPanel(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    notesDescribeMeasuredWholeHomeRemodel(text) &&
    /\bkitchen\b/i.test(text) &&
    /\b(?:updat(?:e|es|ing)|remodel|renovation|reno)\b/i.test(text)
  );
}

/**
 * A measured whole-home note that names a bathroom remodel without a takeoff.
 * Confirm Scope uses the bathroom remodel panel, not a lump updates card.
 */
export function notesNameBathroomRemodelPanel(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    notesDescribeMeasuredWholeHomeRemodel(text) &&
    /\bbath(?:room)?s?\b/i.test(text) &&
    /\b(?:updat(?:e|es|ing)|remodel|renovation|reno)\b/i.test(text)
  );
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

/** Cards this whole-home note actually named. Null when the note is not that bid. */
export function wholeHomeRemodelNamedItemIds(
  notes: string | null | undefined
): Set<string> | null {
  const text = String(notes || '');
  if (!notesDescribeMeasuredWholeHomeRemodel(text)) return null;
  const ids = new Set<string>();
  if (/\bflooring\b/i.test(text)) ids.add('flooring');
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
  if (/\binterior\s+doors?\b/i.test(text)) ids.add('interior_door_install');
  if (/\binsulat/i.test(text)) ids.add('insulation');
  if (/\btrim\b/i.test(text)) {
    ids.add('trim');
    ids.add('baseboard_install');
  }
  if (/\bbaseboards?\b|\bbase\s*board\b/i.test(text)) ids.add('baseboard_install');
  if (/\bplumbing\b/i.test(text)) ids.add('plumbing');
  if (/\belectrical\b/i.test(text)) ids.add('electrical');
  if (/\bpaint(?:ing)?\b/i.test(text)) {
    ids.add('interior_paint');
    ids.add('paint');
  }
  if (removalOf(text, 'cabinets?')) ids.add('cabinet_demo');
  if (
    /\b(?:install|new|replace)\b[^.;\n]{0,60}\bcabinets?\b|\bcabinets?\b[^.;\n]{0,40}\b(?:install|new)\b/i.test(
      text
    )
  ) {
    ids.add('cabinets');
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
  // "Kitchen and bathroom updates" is the work. It is not a cabinet count
  // or a kitchen-floor quantity.
  if (
    /\bkitchen\b/i.test(text) &&
    /\bupdat(?:e|es|ing)\b/i.test(text) &&
    !ids.has('cabinets')
  ) {
    ids.add('kitchen_updates');
  }
  if (
    /\bbath(?:room)?s?\b/i.test(text) &&
    /\bupdat(?:e|es|ing)\b/i.test(text) &&
    !ids.has('vanity') &&
    !ids.has('shower_tile') &&
    !ids.has('floor_tile')
  ) {
    ids.add('bathroom_updates');
  }
  return ids;
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
    if (id.startsWith('custom_')) return item;
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
