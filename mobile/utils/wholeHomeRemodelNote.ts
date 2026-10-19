/**
 * A measured whole-home remodel names the house size and the trades.
 * "Kitchen and bathroom updates" is a work area, not a kitchen-floor takeoff.
 * "Fixtures" in a removal list is fixture demo, not a plumbing fixture package.
 */

export function notesDescribeMeasuredWholeHomeRemodel(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+home\b/i.test(
      text
    ) && /\bremodel/i.test(text)
  );
}

function removalOf(notes: string, term: string): boolean {
  return new RegExp(
    `\\b(?:demolition|demo|remove|removal|tear[\\s-]?out)\\b[^.;\\n]{0,120}\\b(?:${term})\\b|\\b(?:${term})\\b[^.;\\n]{0,120}\\b(?:demolition|demo|remove|removal|tear[\\s-]?out)\\b`,
    'i'
  ).test(notes);
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
  if (/\bwindows?\b/i.test(text)) {
    ids.add('window_install');
    ids.add('windows');
  }
  if (/\bexterior\s+doors?\b/i.test(text)) {
    ids.add('exterior_doors');
    ids.add('exterior_door_install');
  }
  if (/\binterior\s+doors?\b/i.test(text)) ids.add('interior_door_install');
  if (/\binsulat/i.test(text)) ids.add('insulation');
  if (/\bair[\s-]+sealing\b/i.test(text)) ids.add('air_sealing');
  if (/\btrim\b/i.test(text)) ids.add('trim');
  if (/\bbaseboards?\b|\bbase\s*board\b/i.test(text)) ids.add('baseboard_install');
  if (/\bplumbing\b/i.test(text)) ids.add('plumbing');
  if (/\belectrical\b/i.test(text)) ids.add('electrical');
  if (/\bpaint(?:ing)?\b/i.test(text)) {
    ids.add('interior_paint');
    ids.add('paint');
  }
  if (removalOf(text, 'cabinets?')) ids.add('cabinet_demo');
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
};

const DUPLICATE_SCOPE_IDS: string[][] = [
  ['windows', 'window_install'],
  ['exterior_doors', 'exterior_door_install'],
  ['interior_door_install', 'interior_doors'],
  ['paint', 'interior_paint'],
  ['drywall', 'patch_repair'],
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
    helperText: 'Wall and attic insulation named in the notes. Area was not stated.',
    category: 'structure',
  },
  air_sealing: {
    label: 'Air sealing',
    helperText: 'Air sealing named in the notes.',
    category: 'structure',
  },
};

export function applyWholeHomeRemodelChecklist<T extends WholeHomeItem>(
  items: T[],
  notes: string | null | undefined
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
    next.push({
      id,
      inputType: 'yes_no',
      label: card.label,
      helperText: card.helperText,
      category: card.category,
      state: 'included',
      noteBacked: true,
    } as T);
  }
  return DUPLICATE_SCOPE_IDS.reduce((rows, group) => {
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
    return positiveMeasurement(stored.cabinetLf) == null;
  }
  if (itemId === 'floor_demo') {
    return !removalOf(String(notes || ''), 'floor(?:ing)?|lvp|vinyl|carpet|tile');
  }
  if (
    itemId === 'plumbing' ||
    itemId === 'plumbing_rough' ||
    itemId === 'plumbing_trim'
  ) {
    return !/\b\d[\d,]*(?:\.\d+)?\s*(?:fixtures?|connections?|rough[-\s]?ins?|lf)\b/i.test(
      String(notes || '')
    );
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
  if (!/\bkitchen\s+floor(?:ing)?\b/i.test(text)) drop('kitchenFloorSqft');
  if (!notesNameFraming(text)) {
    drop('wallFramingSqft');
    drop('framedAreaSqft');
    drop('wallFramingLf');
  }
  const homeSizeMatch = text.match(
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+home\b/i
  );
  const homeSize = homeSizeMatch?.[1]
    ? Number(homeSizeMatch[1].replace(/,/g, ''))
    : null;
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
