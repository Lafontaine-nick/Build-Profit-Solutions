/**
 * Read a note one job at a time.
 * A number stays with the work named beside it. A title with no quantity
 * does not own a number. A job the note tells us to leave out stays off.
 * Two known jobs in one note become two lines, even when that pair has
 * never been taught.
 */
import { notesNameBathroomAssembly } from '@/utils/bathroomNoteScope';

export type NoteClauseLine = {
  id: string;
  label: string;
  helperText: string;
  category: string;
  quantity: number;
  unit: 'sqft' | 'lf' | 'each';
  measurementKeys: string[];
};

export type NoteClauseRead = {
  lines: NoteClauseLine[];
  excludedIds: string[];
};

const SQFT =
  '(?:sq\\.?\\s*ft|sqft|sf|square\\s+(?:foot|feet))';
const OWNED_AREA = new RegExp(
  `(\\d[\\d,]*(?:\\.\\d+)?)\\s*${SQFT}\\s+of\\s+(?:the\\s+)?([a-z][^.,;\\n]*)`,
  'i'
);
const OWNED_LF = new RegExp(
  '(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:linear\\s+feet|lin\\.?\\s*ft|lf)\\s+of\\s+(?:the\\s+)?([a-z][^.,;\\n]*)',
  'i'
);
const PATIO_AREA = new RegExp(
  `(\\d[\\d,]*(?:\\.\\d+)?)\\s*${SQFT}\\s+(?:of\\s+)?(?:a\\s+)?(?:concrete\\s+)?patios?\\b`,
  'i'
);
const COUNT_WORD: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const PROTECTED_AND: Array<[RegExp, string]> = [
  [/\bwalls?\s+and\s+(?:the\s+)?ceilings?\b/gi, 'walls __AND__ ceilings'],
  [/\bhang\s+and\s+finish\b/gi, 'hang __AND__ finish'],
  [/\btape\s+and\s+(?:mud|finish|texture)\b/gi, 'tape __AND__ finish'],
  [/\bmaterial\s+and\s+labor\b/gi, 'material __AND__ labor'],
];

function amount(raw: string | undefined): number | null {
  const value = Number(String(raw || '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function countToken(raw: string | undefined): number | null {
  const token = String(raw || '').trim().toLowerCase();
  if (!token) return null;
  if (COUNT_WORD[token]) return COUNT_WORD[token];
  return amount(token);
}

function splitClauses(notes: string): string[] {
  let text = String(notes || '').trim();
  if (!text) return [];
  for (const [pattern, replacement] of PROTECTED_AND) {
    text = text.replace(pattern, replacement);
  }
  const sentences = text.split(/\n+|(?<=\.)\s+/);
  const clauses: string[] = [];
  for (const sentence of sentences) {
    const parts = sentence.split(
      /\s+(?:and|&)\s+|,\s+(?=(?:install|replace|hang|pour|frame|paint|stucco|insulate|remove|demo)\b)/i
    );
    for (const part of parts) {
      const clause = part.replace(/__AND__/g, 'and').trim();
      if (clause) clauses.push(clause);
    }
  }
  return clauses;
}

function clauseIsRemoval(clause: string): boolean {
  return (
    /\b(?:remove|removal|demo(?:lition)?|demolish|tear[\s-]?out)\b/i.test(
      clause
    ) && !/\b(?:hang|install|replace|pour|frame|paint|stucco)\b/i.test(clause)
  );
}

function clauseIsNegated(clause: string): boolean {
  const text = clause.trim();
  return (
    /^(?:no|not|without|do not|don't)\b/i.test(text) ||
    /\bno\s+(?:structural\s+)?(?:framing|flooring|drywall|lvp|paint(?:ing)?)\b/i.test(
      text
    )
  );
}

function line(
  id: string,
  label: string,
  helperText: string,
  category: string,
  quantity: number,
  unit: NoteClauseLine['unit'],
  measurementKeys: string[]
): NoteClauseLine {
  return {
    id,
    label,
    helperText,
    category,
    quantity,
    unit,
    measurementKeys,
  };
}

function lineForNoun(
  noun: string,
  clause: string,
  quantity: number,
  unit: NoteClauseLine['unit']
): NoteClauseLine | null {
  const name = noun.toLowerCase();
  if (/\b(?:drywall|sheetrock|gypsum)\b/.test(name)) {
    return line(
      'drywall',
      'Drywall hang / finish',
      'Hang and finish.',
      'drywall',
      quantity,
      'sqft',
      ['drywallSqft']
    );
  }
  if (/\b(?:lvp|luxury\s+vinyl)\b/.test(name)) {
    return line(
      'flooring_lvp',
      'LVP',
      'Install the LVP area named in the notes.',
      'flooring',
      quantity,
      'sqft',
      ['flooringLvpSqft', 'flooringSqft']
    );
  }
  if (/\b(?:laminate|vinyl\s+plank|carpet|flooring)\b/.test(name)) {
    return line(
      'flooring',
      'Flooring',
      'Install the flooring area named in the notes.',
      'flooring',
      quantity,
      'sqft',
      ['flooringSqft']
    );
  }
  if (/\battic\b/.test(name) && /\binsulat|\bR[-\s]?\d{2,3}\b/i.test(clause)) {
    return line(
      'insulation',
      'Attic insulation',
      'Attic insulation from the notes.',
      'insulation',
      quantity,
      'sqft',
      ['atticInsulationSqft']
    );
  }
  if (/\bexterior\s+walls?\b/.test(name) && /\bstucco\b/i.test(clause)) {
    return line(
      'stucco',
      'Stucco / exterior wall finish',
      'Exterior wall area from the job notes.',
      'exterior',
      quantity,
      'sqft',
      ['stuccoGrossWallSqft', 'stuccoNetWallSqft']
    );
  }
  if (/\bshower\b/.test(name)) {
    return line(
      'shower_tile',
      'Shower wall tile',
      'Shower wall tile from the notes.',
      'bathroom',
      quantity,
      'sqft',
      ['showerWallTileSqft']
    );
  }
  if (/\bcabinets?\b/.test(name)) {
    return line(
      'cabinets',
      'Cabinets',
      'Cabinets named in the notes.',
      'cabinets',
      quantity,
      unit === 'each' ? 'lf' : unit,
      ['cabinetLf']
    );
  }
  if (/\b(?:sod|turf)\b/.test(name)) {
    return line(
      'sod_turf',
      'Sod',
      'Sod area from the notes.',
      'landscaping',
      quantity,
      'sqft',
      ['sodSqft']
    );
  }
  if (/\bpatios?\b/.test(name)) {
    return line(
      'pour_flatwork',
      'Concrete patio',
      'Concrete patio from the notes.',
      'concrete',
      quantity,
      'sqft',
      ['concreteSqft']
    );
  }
  if (/\bwalls?\b/.test(name) && /\bfram(?:e|ing)\b/i.test(clause)) {
    return line(
      'wall_framing',
      'Wall framing',
      'Wall area from the notes.',
      'framing',
      quantity,
      'sqft',
      ['wallFramingSqft']
    );
  }
  if (/\bwalls?\b/.test(name) && /\bpaint/i.test(clause)) {
    return line(
      'interior_paint',
      'Wall paint',
      'Wall paint from the notes.',
      'painting',
      quantity,
      'sqft',
      ['wallPaintSqft']
    );
  }
  if (/\b(?:receptacles?|outlets?)\b/.test(name)) {
    return line(
      'electrical_standard_receptacle',
      'Receptacles',
      'Receptacle count from the job notes.',
      'electrical',
      quantity,
      'each',
      ['standardReceptacleCount']
    );
  }
  if (/\bwindows?\b/.test(name)) {
    return line(
      'windows',
      'Windows',
      'Windows named in the notes.',
      'openings',
      quantity,
      'each',
      ['windowCount']
    );
  }
  if (/\btoilets?\b/.test(name)) {
    return line(
      'toilet',
      'Toilet',
      'Toilet named in the notes.',
      'plumbing',
      quantity,
      'each',
      ['bathroomInstallToiletCount']
    );
  }
  return null;
}

/**
 * Insulation or paint that names the walls already measured, without a new number.
 * The area stays with those walls. It does not take the flooring quantity.
 */
function inheritedWallLine(
  clause: string,
  wallArea: number
): NoteClauseLine | null {
  if (clauseIsRemoval(clause) || clauseIsNegated(clause)) return null;
  const namesThoseWalls =
    /\b(?:those|these|the(?:\s+new)?|new)\s+walls?\b/i.test(clause);
  if (!namesThoseWalls || /\battic\b/i.test(clause)) return null;
  if (/\binsulat|\bR[-\s]?\d{2,3}\b/i.test(clause)) {
    const rValue = clause.match(/\bR[-\s]?(\d{2,3})\b/i);
    const rLabel = rValue ? `R-${rValue[1]}` : null;
    return line(
      'insulation',
      rLabel ? `Wall insulation (${rLabel})` : 'Wall insulation',
      rLabel
        ? `${rLabel} in the walls named above.`
        : 'Insulation in the walls named above.',
      'insulation',
      wallArea,
      'sqft',
      ['exteriorWallInsulationSqft']
    );
  }
  if (/\bpaint/i.test(clause) && !OWNED_AREA.test(clause)) {
    return line(
      'interior_paint',
      'Wall paint',
      'Paint the walls named above.',
      'painting',
      wallArea,
      'sqft',
      ['wallPaintSqft']
    );
  }
  return null;
}

function excludedIdsFor(clause: string): string[] {
  const ids: string[] = [];
  if (/\bfram(?:e|ing)\b/i.test(clause)) ids.push('framing', 'wall_framing');
  if (/\b(?:lvp|luxury\s+vinyl|flooring|laminate|carpet)\b/i.test(clause)) {
    ids.push('flooring', 'flooring_lvp');
  }
  if (/\b(?:drywall|sheetrock|gypsum)\b/i.test(clause)) ids.push('drywall');
  if (/\bpaint/i.test(clause)) ids.push('interior_paint');
  return ids;
}

function ownedLine(clause: string): NoteClauseLine | null {
  const area = clause.match(OWNED_AREA);
  if (area) {
    const quantity = amount(area[1]);
    if (quantity) return lineForNoun(area[2] || '', clause, quantity, 'sqft');
  }
  const length = clause.match(OWNED_LF);
  if (length) {
    const quantity = amount(length[1]);
    if (quantity) return lineForNoun(length[2] || '', clause, quantity, 'lf');
  }
  const patio = clause.match(PATIO_AREA);
  if (patio) {
    const quantity = amount(patio[1]);
    if (quantity) return lineForNoun('patio', clause, quantity, 'sqft');
  }
  const receptacles = clause.match(
    /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s+(?:standard\s+)?(?:receptacles?|outlets?)\b/i
  );
  if (receptacles) {
    const quantity = countToken(receptacles[1]);
    if (quantity) {
      return lineForNoun('receptacles', clause, quantity, 'each');
    }
  }
  const toilets = clause.match(
    /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s+(?:bathroom\s+)?toilets?\b/i
  );
  if (toilets) {
    const quantity = countToken(toilets[1]);
    if (quantity) return lineForNoun('toilet', clause, quantity, 'each');
  }
  const windows = clause.match(
    /\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d[\d,]*)\s+windows?\b/i
  );
  if (windows) {
    const quantity = countToken(windows[1]);
    if (quantity) return lineForNoun('windows', clause, quantity, 'each');
  }
  return null;
}

/** Jobs named in the note, each with the quantity written on that job. */
export function readNoteWork(notes: string | null | undefined): NoteClauseRead {
  const staged: Array<{ clause: string; line: NoteClauseLine | null }> = [];
  const excluded = new Set<string>();
  const seen = new Set<string>();
  for (const clause of splitClauses(String(notes || ''))) {
    if (clauseIsNegated(clause)) {
      excludedIdsFor(clause).forEach(id => excluded.add(id));
      staged.push({ clause, line: null });
      continue;
    }
    if (clauseIsRemoval(clause)) {
      staged.push({ clause, line: null });
      continue;
    }
    const next = ownedLine(clause);
    if (!next || seen.has(next.id)) {
      staged.push({ clause, line: null });
      continue;
    }
    seen.add(next.id);
    staged.push({ clause, line: next });
  }
  const owned = staged
    .map(slot => slot.line)
    .filter((entry): entry is NoteClauseLine => Boolean(entry));
  const framing = owned.find(
    entry => entry.id === 'wall_framing' && entry.unit === 'sqft'
  );
  const drywall = owned.find(
    entry => entry.id === 'drywall' && entry.unit === 'sqft'
  );
  const wallArea = framing?.quantity ?? drywall?.quantity ?? null;
  const lines: NoteClauseLine[] = [];
  for (const slot of staged) {
    if (slot.line && !excluded.has(slot.line.id)) {
      lines.push(slot.line);
      continue;
    }
    if (!wallArea) continue;
    const inherited = inheritedWallLine(slot.clause, wallArea);
    if (!inherited || seen.has(inherited.id) || excluded.has(inherited.id)) {
      continue;
    }
    seen.add(inherited.id);
    lines.push(inherited);
  }
  return {
    lines,
    excludedIds: [...excluded],
  };
}

function positiveFraming(text: string): boolean {
  return text.split(/\n+|(?<=\.)\s+/).some(sentence => {
    const clause = sentence.trim();
    if (!clause || clauseIsNegated(clause)) return false;
    return /\bfram(?:e|ing)\b/i.test(clause);
  });
}

/** Whole-home, addition, remodel, and pairs that already have a checklist. */
export function noteKeepsItsOwnChecklist(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (!text.trim()) return true;
  if (
    /\b(?:new\s+build|new\s+construction|ground[\s-]?up|custom\s+home|spec\s+home)\b/i.test(
      text
    ) ||
    /\b(?:whole|entire|full)\s+(?:existing\s+)?home\b/i.test(text) ||
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s+(?:home|house)\b/i.test(
      text
    ) ||
    /\b(?:room|home|bedroom|garage)\s+addition\b/i.test(text) ||
    /\b(?:kitchen|bathroom|bath)\s+(?:remodel|renovation|reno)\b/i.test(text) ||
    notesNameBathroomAssembly(text)
  ) {
    return true;
  }
  const namesDrywall = /\b(?:drywall|sheetrock|gypsum)\b/i.test(text);
  const namesFlooring =
    /\b(?:flooring|lvp|luxury\s+vinyl|laminate|vinyl\s+plank|carpet)\b/i.test(
      text
    );
  const namesCompanion =
    /\b(?:kitchen|bath(?:room)?|shower|vanity|toilet|cabinets?|countertops?|plumbing|electrical|hvac|roof(?:ing)?|windows?|doors?|insulation|siding|concrete|framing|paint(?:ing)?|stucco)\b/i.test(
      text
    );
  if (namesDrywall && namesFlooring && !namesCompanion) return true;
  if (
    /\bstucco\b/i.test(text) &&
    /\breplac(?:e|ing)\b/i.test(text) &&
    /\bwindows?\b/i.test(text)
  ) {
    return true;
  }
  if (/\breceptacles?\b/i.test(text) && /\btoilets?\b/i.test(text)) return true;
  if (/\bshower\b/i.test(text) && /\b(?:lvp|luxury\s+vinyl)\b/i.test(text)) {
    return true;
  }
  if (positiveFraming(text) && namesFlooring && !namesDrywall) return true;
  return false;
}

/**
 * True when this note should become one card per named job.
 * Pairs that already have a checklist, and whole-project notes, stay put.
 */
export function noteUsesSeparateJobReader(
  notes: string | null | undefined
): boolean {
  if (noteKeepsItsOwnChecklist(notes)) return false;
  return readNoteWork(notes).lines.length >= 2;
}

/**
 * A project-level note can still contain several independent bids. Keep a
 * service call from taking over when the same note also names a build,
 * addition, or multiple other trades.
 */
export function notesDescribeMixedProjectScope(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '').trim();
  if (!text) return false;

  const hasProjectContext = /\b(?:new\s+(?:build|construction|home|house)|ground[-\s]?up|custom\s+home|(?:room|home|bedroom|garage)\s+addition|adu)\b/i.test(
    text
  );
  const hasServiceVisit = /\b(?:service\s+calls?|diagnos(?:e|is|ing))\b/i.test(
    text
  );
  const hasIndependentRepairWork = /\b(?:replace|replacement|reroof|re[\s-]?roof|patch|repair|service\s+calls?|diagnos(?:e|is|ing))\b/i.test(
    text
  );
  const tradeSignals = [
    /\b(?:floor(?:ing)?|lvp|carpet|laminate|vinyl\s+plank)\b/i,
    /\b(?:roof(?:ing)?|reroof|re[\s-]?roof|shingles?)\b/i,
    /\b(?:paint(?:ing)?|repaint)\b/i,
    /\bstucco\b/i,
    /\b(?:drywall|sheetrock|gypsum)\b/i,
    /\b(?:hvac|furnace|condenser|heat[\s-]*pump|air\s*condition)\b/i,
    /\b(?:electrical|wiring|outlets?|receptacles?)\b/i,
    /\b(?:plumbing|toilet|faucet|drain|water\s+line)\b/i,
    /\b(?:windows?|doors?)\b/i,
  ].filter(pattern => pattern.test(text)).length;

  if (hasProjectContext) {
    return hasIndependentRepairWork && tradeSignals >= 2;
  }
  return hasServiceVisit && tradeSignals >= 3;
}

export function separateJobRevealRows(
  notes: string | null | undefined
): Array<{ id: string; name: string; quantity?: string }> {
  if (!noteUsesSeparateJobReader(notes)) return [];
  return readNoteWork(notes).lines.map(entry => ({
    id: entry.id,
    name: entry.label,
    quantity: quantityText(entry),
  }));
}

const HERO_TRADE_NAME: Record<string, string> = {
  wall_framing: 'Framing',
  drywall: 'Drywall',
  insulation: 'Insulation',
  flooring_lvp: 'LVP',
  flooring: 'Flooring',
  interior_paint: 'Paint',
  pour_flatwork: 'Concrete',
  sod_turf: 'Sod',
  stucco: 'Stucco',
  windows: 'Windows',
  cabinets: 'Cabinets',
  shower_tile: 'Shower tile',
  electrical_standard_receptacle: 'Receptacles',
  toilet: 'Toilet',
};

function heroTradeName(name: string, first: boolean): string {
  if (first || name === name.toUpperCase()) return name;
  return `${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

/** A title that fits the Scope found card when a note names several jobs. */
export function readerHeroTitle(lines: NoteClauseLine[]): string {
  const names = lines.map(
    entry => HERO_TRADE_NAME[entry.id] || entry.label
  );
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) {
    return `${heroTradeName(names[0], true)} and ${heroTradeName(names[1], false)}`;
  }
  const head = names
    .slice(0, -1)
    .map((name, index) => heroTradeName(name, index === 0));
  const last = heroTradeName(names[names.length - 1], false);
  return `${head.join(', ')}, and ${last}`;
}

function quantityText(entry: NoteClauseLine): string {
  const amountText = Number.isInteger(entry.quantity)
    ? String(entry.quantity)
    : String(entry.quantity);
  if (entry.unit === 'sqft') return `${amountText} sqft`;
  if (entry.unit === 'lf') return `${amountText} LF`;
  return `${amountText} each`;
}

const EXCLUDED_MEASUREMENTS: Record<string, string[]> = {
  framing: ['wallFramingSqft', 'wallFramingLf', 'framedAreaSqft'],
  wall_framing: ['wallFramingSqft', 'wallFramingLf', 'framedAreaSqft'],
  flooring: ['flooringSqft'],
  flooring_lvp: ['flooringLvpSqft', 'flooringSqft'],
  drywall: ['drywallSqft'],
  interior_paint: ['wallPaintSqft'],
};

/**
 * Write each owned quantity onto its measurement.
 * A number that belonged to another job in the same note is replaced.
 */
export function applyNoteClauseReads<T extends Record<string, unknown>>(
  measurements: T,
  notes: string | null | undefined
): T {
  const read = readNoteWork(notes);
  if (!read.lines.length && !read.excludedIds.length) return measurements;
  const next = { ...measurements } as Record<string, unknown>;
  const quantities = {
    ...((next.itemQuantities as Record<string, unknown>) || {}),
  };
  const flooringLine = read.lines.some(entry => entry.id === 'flooring');
  for (const entry of read.lines) {
    const keys =
      entry.id === 'flooring_lvp' && flooringLine
        ? ['flooringLvpSqft']
        : entry.measurementKeys;
    for (const key of keys) next[key] = entry.quantity;
    quantities[entry.id] = {
      quantity: entry.quantity,
      unit: entry.unit,
      quantitySource: 'notes',
    };
    if (entry.id === 'flooring_lvp' && !flooringLine) {
      quantities.flooring = {
        quantity: entry.quantity,
        unit: 'sqft',
        quantitySource: 'notes',
      };
    }
  }
  for (const id of read.excludedIds) {
    for (const key of EXCLUDED_MEASUREMENTS[id] || []) delete next[key];
    delete quantities[id];
  }
  if (Object.keys(quantities).length) next.itemQuantities = quantities;
  return next as T;
}
