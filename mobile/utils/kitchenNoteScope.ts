import { notesDescribeMeasuredWholeHomeRemodel } from '@/utils/wholeHomeRemodelNote';

/**
 * Dedicated kitchen notes only show the lines the note names.
 * A bare "kitchen remodel" still gets the full questionnaire.
 * Plan import and whole-home stay on the full list.
 */

export type KitchenNoteScopeParams = {
  notes?: string | null;
  templateKey?: string | null;
  projectType?: string | null;
  planBacked?: boolean;
  wholeHome?: boolean;
};

const BATHROOM_ONLY_IDS = new Set([
  'shower_tile',
  'shower_floor_tile',
  'shower_pan',
  'shower_floor_demo',
  'shower_enclosure_demo',
  'glass_door',
  'glass_door_demo',
  'glass_door_reuse_remove',
  'glass_door_reuse_install',
  'wet_area_install',
  'vanity',
  'toilet',
  'tub_demo',
  'fixture_demo',
]);

const OPTIONAL_KITCHEN_IDS: Record<string, RegExp> = {
  garbage_disposal: /\bdisposals?\b/i,
  sink_faucet:
    /\b(?:install|new|replace|supply)\b[^.]{0,40}\b(?:sinks?|faucets?)\b|\b(?:sinks?|faucets?)\b[^.]{0,40}\b(?:install|new|replace|supply)\b/i,
  electrical:
    /\b(?:electrical|outlets?|gfcis?|circuits?|switches?|rewir(?:e|ing))\b/i,
  lighting: /\b(?:lights?|lighting|pendants?|recessed|sconces?)\b/i,
  drywall: /\b(?:drywall|sheetrock|gypsum)\b/i,
  paint: /\bpaint(?:ing)?\b/i,
  interior_paint: /\bpaint(?:ing)?\b/i,
  island: /\bisland\b/i,
  island_demo: /\bisland\b/i,
  cabinet_hardware: /\b(?:cabinet\s+hardware|pulls|knobs)\b/i,
  floor_prep: /\b(?:floor\s+prep|subfloor|underlayment|level(?:ing)?)\b/i,
  walls_moving:
    /\b(?:remove|add|move|relocat(?:e|ing)|fram(?:e|ing))\b[^.]{0,40}\bwalls?\b|\bwalls?\b[^.]{0,40}\b(?:remove|add|move|relocat(?:e|ing)|fram(?:e|ing))\b/i,
  permits: /\bpermits?\b/i,
  cleanup: /\b(?:cleanup|clean[\s-]?up|final\s+clean|haul[\s-]?off)\b/i,
  appliance_removal:
    /\b(?:remove|demo|demolition|tear[\s-]?out)\b[^.]{0,40}\bappliances?\b|\bappliances?\b[^.]{0,40}\b(?:remove|demo|demolition|tear[\s-]?out)\b/i,
  appliances:
    /\b(?:appliances?|range|refrigerator|fridge|microwave|oven)\b/i,
};

function kitchenJob(params: KitchenNoteScopeParams): boolean {
  const template = String(params.templateKey || '').toLowerCase();
  const projectType = String(params.projectType || '').toLowerCase();
  if (template === 'kitchen' || projectType === 'kitchen') return true;
  if (
    template === 'room_remodel' &&
    /\bkitchen\b/i.test(String(params.notes || ''))
  ) {
    return true;
  }
  return false;
}

/** Paint on walls or ceilings. "Paint cabinets" is cabinet refinishing. */
export function kitchenNoteNamesWallPaint(notes: string | null | undefined): boolean {
  return String(notes || '')
    .split(/[.\n]/)
    .some(sentence => {
      if (!/\bpaint(?:ing|ed)?\b|\brepaint/i.test(sentence)) return false;
      if (/\b(?:walls?|ceilings?|interior\s+paint)\b/i.test(sentence)) return true;
      return !/\b(?:paint(?:ing|ed)?|refinish(?:ing|ed)?)\b[^.;]{0,40}\bcabinets?\b|\bcabinets?\b[^.;]{0,40}\b(?:paint(?:ing|ed)?|refinish(?:ing|ed)?)\b/i.test(
        sentence
      ) && !/\b(?:exterior|outside|siding|stucco)\b/i.test(sentence);
    });
}

export function kitchenNoteNamesCabinetPaint(notes: string | null | undefined): boolean {
  return /\b(?:paint(?:ing|ed)?|refinish(?:ing|ed)?)\b[^.;]{0,40}\bcabinets?\b|\bcabinets?\b[^.;]{0,40}\b(?:paint(?:ing|ed)?|refinish(?:ing|ed)?)\b/i.test(
    String(notes || '')
  );
}

export function kitchenNoteNamesTrim(notes: string | null | undefined): boolean {
  return /\bbaseboards?\b|\bbase\s*board\b|\b(?:crown|casing|molding|moulding)\b|\btrim\b/i.test(
    String(notes || '')
  );
}

/** New cabinet boxes. Hardware replacement and cabinet paint do not count. */
export function kitchenNoteInstallsNewCabinets(notes: string | null | undefined): boolean {
  return String(notes || '')
    .split(/[.\n]/)
    .some(sentence => {
      if (/\bkeep\s+existing\b/i.test(sentence)) return false;
      if (/\b(?:hardware|pulls|knobs)\b/i.test(sentence)) return false;
      if (
        /\b(?:paint(?:ing|ed)?|refinish(?:ing|ed)?)\b/i.test(sentence) &&
        !/\b(?:install|supply)\b[^.]{0,30}\b(?:new\s+)?cabinets?\b/i.test(sentence)
      ) {
        return false;
      }
      return /\b(?:install|new|replace|supply)\b[^.]{0,40}\bcabinets?\b|\bcabinets?\b[^.]{0,40}\b(?:install|new|replace|supply)\b/i.test(
        sentence
      );
    });
}

/** "Kitchen reno" is the same dedicated remodel as "kitchen renovation". */
export function notesDescribeDedicatedKitchenRemodel(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    /\b(?:remodel|renovate|renovation|reno)\s+(?:the\s+)?kitchen\b/i.test(
      text
    ) || /\bkitchen\s+(?:remodel|renovation|reno)\b/i.test(text)
  );
}

export function kitchenNoteNamesCabinetWork(
  notes: string | null | undefined
): boolean {
  return /\bcabinets?\b|\bcabinetry\b|\bcabs\b/i.test(String(notes || ''));
}

export function kitchenNoteNamesCounterWork(
  notes: string | null | undefined
): boolean {
  return /\b(?:countertops?|counters?|quartz|granite|tops)\b/i.test(
    String(notes || '')
  );
}

export function kitchenNoteNamesBacksplash(
  notes: string | null | undefined
): boolean {
  return /\bback\s*splash\b|\bbacksplash\b|\bsplash\b/i.test(
    String(notes || '')
  );
}

function kitchenNoteNamesWork(notes: string): boolean {
  return (
    kitchenNoteNamesCabinetWork(notes) ||
    kitchenNoteNamesCounterWork(notes) ||
    kitchenNoteNamesBacksplash(notes) ||
    /\b(?:baseboards?|lvp|vinyl|flooring|dishwasher|sinks?)\b/i.test(notes)
  );
}

/** Used when a shorthand kitchen note arrived as a flooring or empty checklist. */
export function kitchenConfirmScopeSeedItems(): Array<{
  id: string;
  label: string;
  helperText: string;
  category: string;
  inputType: 'yes_no';
  state: 'included';
}> {
  return [
    {
      id: 'cabinets',
      label: 'Cabinets',
      helperText: 'Cabinet run length for this kitchen.',
      category: 'cabinets',
      inputType: 'yes_no',
      state: 'included',
    },
    {
      id: 'countertops',
      label: 'Countertops',
      helperText: 'Perimeter countertop area.',
      category: 'cabinets',
      inputType: 'yes_no',
      state: 'included',
    },
    {
      id: 'backsplash',
      label: 'Backsplash',
      helperText: 'Backsplash area.',
      category: 'tile',
      inputType: 'yes_no',
      state: 'included',
    },
    {
      id: 'flooring',
      label: 'Kitchen flooring',
      helperText: 'Kitchen floor area.',
      category: 'flooring',
      inputType: 'yes_no',
      state: 'included',
    },
    {
      id: 'lighting',
      label: 'Can lights',
      helperText: 'Recessed can lights.',
      category: 'electrical',
      inputType: 'yes_no',
      state: 'included',
    },
    {
      id: 'plumbing',
      label: 'Sink hookup',
      helperText: 'Sink plumbing hookup.',
      category: 'plumbing',
      inputType: 'yes_no',
      state: 'included',
    },
  ];
}

export function shouldLimitKitchenChecklistToNotes(
  params: KitchenNoteScopeParams
): boolean {
  if (params.planBacked || params.wholeHome) return false;
  const notes = String(params.notes || '').trim();
  if (!notes) return false;
  if (/\b(?:bathroom|bath)\s+(?:remodel|renovation)\b/i.test(notes)) return false;
  if (/\b(?:whole|entire|full)\s+(?:existing\s+)?home\b/i.test(notes)) {
    return false;
  }
  if (!kitchenJob(params)) return false;
  return kitchenNoteNamesWork(notes);
}

function itemText(item: { label?: string | null; name?: string | null }): string {
  return `${item.label || ''} ${item.name || ''}`.trim();
}

function notesNameFloorTile(notes: string): boolean {
  return /\b(?:floor\s+tile|tile\s+floor)\b/i.test(notes);
}

const KITCHEN_DEMO_PRODUCT: Record<string, RegExp> = {
  cabinet_demo: /\bcabinets?\b|\bcabs\b/i,
  countertop_demo: /\b(?:countertops?|counters?|quartz|granite|tops)\b/i,
  backsplash_demo: /\bbacksplashes?\b|\bbacksplash\b|\bsplash\b/i,
  floor_demo: /\b(?:vinyl(?:\s+floor)?|lvp|laminate|carpet|floor(?:ing)?)\b/i,
  island_demo: /\bisland\b/i,
};

function sentenceAffirmsDemo(sentence: string, product: RegExp): boolean {
  const text = sentence.trim();
  if (!text) return false;
  if (/\b(?:no|not|without|don'?t|do not)\b/i.test(text)) return false;
  if (/\bkeep\s+existing\b/i.test(text)) return false;
  return (
    /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(text) &&
    product.test(text)
  );
}

function notesNameThisKitchenDemo(id: string, notes: string): boolean {
  const product = KITCHEN_DEMO_PRODUCT[id];
  if (!product) return true;
  return notes.split(/[.\n]/).some(sentence => sentenceAffirmsDemo(sentence, product));
}

const KITCHEN_DEMO_SURFACE_PRODUCT = {
  cabinet: KITCHEN_DEMO_PRODUCT.cabinet_demo,
  counter: KITCHEN_DEMO_PRODUCT.countertop_demo,
  backsplash: KITCHEN_DEMO_PRODUCT.backsplash_demo,
  floor: KITCHEN_DEMO_PRODUCT.floor_demo,
  island: KITCHEN_DEMO_PRODUCT.island_demo,
} as const;

export type KitchenDemoSurface = keyof typeof KITCHEN_DEMO_SURFACE_PRODUCT;

/** True when a sentence names tear-out for this surface and does not cancel it. */
export function kitchenNoteNamesSurfaceDemo(
  notes: string | null | undefined,
  surface: KitchenDemoSurface
): boolean {
  const product = KITCHEN_DEMO_SURFACE_PRODUCT[surface];
  return String(notes || '')
    .split(/[.\n]/)
    .some(sentence => sentenceAffirmsDemo(sentence, product));
}

/** Kitchen floor install or tear-out the contractor is doing. Tile backsplash is not a floor. */
export function kitchenNoteIncludesFloorWork(notes: string | null | undefined): boolean {
  const text = String(notes || '');
  if (!text.trim()) return false;
  if (
    notesDescribeMeasuredWholeHomeRemodel(text) &&
    !/\bkitchen\s+floor(?:ing)?\b/i.test(text)
  ) {
    return false;
  }
  if (/\bfloor(?:ing)?\s+protection\b/i.test(text)) return false;
  if (
    text.split(/[.\n]/).some(
      sentence =>
        /\bfloor(?:ing)?\b/i.test(sentence) && /\bby\s+others\b/i.test(sentence)
    )
  ) {
    return false;
  }
  if (/\bno\s+(?:kitchen\s+)?floor(?:ing)?(?:\s+work)?\b/i.test(text)) return false;
  const cleaned = text.replace(
    /\b(?:new\s+)?tile\s+backsplash\b|\bbacksplash\s+tile\b|\btile\s+back\s*splash\b/gi,
    'backsplash'
  );
  return (
    /\b(?:install|replace|remove|demo|demolition|tear[\s-]?out)\b[^.;]{0,40}\b(?:floor|flooring|lvp|vinyl|laminate|carpet)\b/i.test(
      cleaned
    ) ||
    /\b(?:floor|flooring|lvp|vinyl|laminate|carpet)\b[^.;]{0,40}\b(?:install|replace|remove|demo|demolition|tear[\s-]?out)\b/i.test(
      cleaned
    ) ||
    /\b(?:floor\s+tile|tile\s+floor)\b/i.test(cleaned) ||
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b[^.;\n]{0,35}\b(?:floor|flooring|lvp|vinyl|laminate|carpet)\b/i.test(
      cleaned
    ) ||
    /\b(?:floor|flooring|lvp|vinyl|laminate|carpet)\b[^.;\n]{0,35}\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i.test(
      cleaned
    )
  );
}

function duplicateFloorCard(
  id: string,
  label: string,
  notes: string,
  present: Set<string>
): boolean {
  const genericTile =
    ['tile', 'tile_flooring', 'tile_install', 'floor_tile', 'tile_demo'].includes(
      id
    ) || /^tile$/i.test(label);
  if (genericTile || /shower tile demo/i.test(label)) {
    if (/shower tile demo/i.test(label)) return true;
    if (present.has('backsplash') || /\bbacksplash\b/i.test(notes)) return true;
    return !notesNameFloorTile(notes);
  }
  const productFloor = [
    'flooring_lvp',
    'flooring_laminate',
    'flooring_engineered_hardwood',
    'flooring_solid_hardwood',
    'flooring_carpet',
    'laminate_install',
  ].includes(id) || /^lvp installation$/i.test(label);
  if (!productFloor) return false;
  if (present.has('flooring')) return true;
  return !/\b(?:lvp|luxury\s+vinyl|laminate|vinyl|carpet|hardwood)\b/i.test(
    notes
  );
}

export function filterDedicatedKitchenConfirmItems<
  T extends { id?: string | null; label?: string | null; name?: string | null },
>(items: T[], params: KitchenNoteScopeParams): T[] {
  if (!shouldLimitKitchenChecklistToNotes(params)) return items;
  const notes = String(params.notes || '');
  const present = new Set(items.map(item => String(item.id || '')));
  const kept = items.filter(item => {
    const id = String(item.id || '');
    const label = itemText(item);
    if (id.startsWith('custom_')) return true;
    if (BATHROOM_ONLY_IDS.has(id) || /shower tile demo/i.test(label)) {
      return false;
    }
    if (id === 'interior_finishes' || /^interior finishes$/i.test(label)) {
      return false;
    }
    if (
      (id === 'framing' || id === 'labor' || /^framing labor$/i.test(label)) &&
      !/\b(?:fram(?:e|ing|ed)|reframe)\b/i.test(notes)
    ) {
      return false;
    }
    if (
      id === 'cleanup' &&
      /\bhaul[\s-]?off\b/i.test(notes) &&
      !/\b(?:final\s+clean|clean[\s-]?up|dumpster|disposal)\b/i.test(notes)
    ) {
      return false;
    }
    if (id === 'demo') {
      if (/shower/i.test(label)) return false;
      if (
        present.has('cabinet_demo') ||
        present.has('floor_demo') ||
        present.has('note:kitchen cabinet demo') ||
        present.has('note:kitchen flooring demo')
      ) {
        return false;
      }
      return /\b(?:cabinet|counter|backsplash|floor)/i.test(label);
    }
    if (duplicateFloorCard(id, label, notes, present)) return false;
    if (KITCHEN_DEMO_PRODUCT[id] && !notesNameThisKitchenDemo(id, notes)) {
      return false;
    }
    if (
      id === 'flooring' ||
      id === 'flooring_lvp' ||
      id === 'flooring_laminate' ||
      id === 'flooring_carpet' ||
      id === 'tile_flooring' ||
      /^flooring installation$/i.test(label) ||
      /^kitchen flooring/i.test(label)
    ) {
      return kitchenNoteIncludesFloorWork(notes);
    }
    if (
      id === 'trim' ||
      id === 'baseboard_install' ||
      id === 'trim_paint' ||
      id === 'interior_trim'
    ) {
      if (id === 'baseboard_install' && present.has('trim')) return false;
      return kitchenNoteNamesTrim(notes);
    }
    if (
      (id === 'cabinets' || id === 'cabinets_counters') &&
      /\bkeep\s+existing\b[^.]{0,40}\bcabinets?\b/i.test(notes) &&
      !kitchenNoteInstallsNewCabinets(notes)
    ) {
      return false;
    }
    if (id === 'countertops' || id === 'counters') {
      return kitchenNoteNamesCounterWork(notes);
    }
    if (id === 'backsplash') {
      return kitchenNoteNamesBacksplash(notes);
    }
    if (
      id === 'paint' ||
      id === 'interior_paint' ||
      id === 'ceiling_paint' ||
      id === 'prep' ||
      id === 'paint_repair'
    ) {
      return kitchenNoteNamesWallPaint(notes);
    }
    if (
      id === 'hardware' &&
      !/\b(?:framing|structural|connector)\s+hardware\b|\bhardware\s+connectors?\b/i.test(
        notes
      )
    ) {
      return false;
    }
    if (
      id === 'lighting' &&
      items.some(row => String(row.id || '') === 'electrical_recessed_light') &&
      /\b(?:can|recessed|canless|wafer)\s+lights?\b/i.test(notes)
    ) {
      return false;
    }
    const optional = OPTIONAL_KITCHEN_IDS[id];
    if (optional) return optional.test(notes);
    if (id === 'plumbing' || id === 'plumbing_rough' || id === 'plumbing_trim') {
      return /\b(?:plumb(?:ing)?|hook[\s-]?ups?|dishwasher|sinks?)\b/i.test(
        notes
      );
    }
    return true;
  }).concat(
    kitchenNoteNamesCabinetPaint(notes) &&
      !items.some(item => String(item.id || '') === 'cabinet_paint')
      ? [
          {
            id: 'cabinet_paint',
            label: 'Cabinet paint',
            name: 'Cabinet paint',
            helperText:
              'Paint the existing cabinet run. Priced by cabinet LF.',
            state: 'included',
            inputType: 'yes_no',
            category: 'paint',
            noteBacked: true,
          } as T,
        ]
      : [],
    /\bhaul[\s-]?off\b/i.test(notes) &&
      !items.some(item => String(item.id || '') === 'haul_off')
      ? [
          {
            id: 'haul_off',
            label: 'Haul-off',
            name: 'Haul-off',
            helperText: 'Debris haul-off and disposal.',
            state: 'included',
            inputType: 'yes_no',
            category: 'demo',
            noteBacked: true,
          } as T,
        ]
      : [],
    /\b(?:cabinet\s+hardware|pulls|knobs)\b/i.test(notes) &&
      !items.some(item => String(item.id || '') === 'cabinet_hardware')
      ? [
          {
            id: 'cabinet_hardware',
            label: 'Cabinet hardware',
            name: 'Cabinet hardware',
            helperText:
              'Pulls and knobs along the existing cabinet run. Planning count is one piece per cabinet LF.',
            state: 'included',
            inputType: 'yes_no',
            category: 'finish_carpentry',
            noteBacked: true,
          } as T,
        ]
      : []
  );
  const lvp = /\b(?:lvp|luxury\s+vinyl)\b/i.test(notes);
  const canLights = /\bcan\s+lights?\b/i.test(notes);
  if (!lvp && !canLights) return kept;
  return kept.map(item => {
    const id = String(item.id || '');
    if (canLights && id === 'electrical_recessed_light') {
      return { ...item, label: 'Can lights' };
    }
    if (lvp && id === 'flooring') return { ...item, label: 'LVP flooring' };
    return item;
  });
}
