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
  if (template && template !== 'kitchen') return false;
  return template === 'kitchen' || projectType === 'kitchen';
}

function kitchenNoteNamesWork(notes: string): boolean {
  return /\b(?:cabinets?|countertops?|counters?|backsplash|baseboards?|lvp|vinyl|flooring|dishwasher|sinks?|quartz|granite)\b/i.test(
    notes
  );
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
  cabinet_demo: /\bcabinets?\b/i,
  countertop_demo: /\b(?:countertops?|counters?|quartz|granite)\b/i,
  backsplash_demo: /\bbacksplashes?\b|\bbacksplash\b/i,
  floor_demo: /\b(?:vinyl(?:\s+floor)?|lvp|laminate|carpet|floor(?:ing)?)\b/i,
  island_demo: /\bisland\b/i,
};

function notesNameThisKitchenDemo(id: string, notes: string): boolean {
  const product = KITCHEN_DEMO_PRODUCT[id];
  if (!product) return true;
  return notes.split(/[.\n]/).some(sentence => {
    return (
      /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(sentence) &&
      product.test(sentence)
    );
  });
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
  return items.filter(item => {
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
    if (id === 'baseboard_install') {
      if (present.has('trim')) return false;
      return /\bbaseboards?\b|\btrim\b/i.test(notes);
    }
    const optional = OPTIONAL_KITCHEN_IDS[id];
    if (optional) return optional.test(notes);
    if (id === 'plumbing' || id === 'plumbing_rough' || id === 'plumbing_trim') {
      return /\b(?:plumb(?:ing)?|hook[\s-]?ups?|dishwasher|sinks?)\b/i.test(
        notes
      );
    }
    return true;
  });
}
