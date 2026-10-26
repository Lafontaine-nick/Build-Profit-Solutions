import { bathroomScopeLines } from '@/utils/bathroomNoteScope';
import {
  kitchenNoteNamesBacksplash,
  kitchenNoteNamesCabinetWork,
  kitchenNoteNamesCounterWork,
  notesDescribeDedicatedKitchenRemodel,
} from '@/utils/kitchenNoteScope';
import { notesDescribeDedicatedPaintingJob } from '@/utils/paintingNoteScope';
import {
  dedicatedStuccoWallSqft,
  notesDescribeDedicatedStuccoJob,
} from '@/utils/stuccoNoteScope';
import {
  wholeHomeRemodelNamedItemIds,
  wholeHomeTradeQuestion,
} from '@/utils/wholeHomeRemodelNote';

const PAINT_SURFACE =
  /\b(?:walls?|ceilings?|doors?|trim|baseboards?|cabinets?|siding|brick|fascia|soffit)\b/i;

const WHOLE_HOME =
  /\b(?:whole|entire|full)\s+(?:house|home)\b|\bhouse\s+remodel\b/i;

function vagueBathroom(text: string): boolean {
  if (WHOLE_HOME.test(text)) return false;
  const bathJob =
    /\b(?:update|remodel|renovation|reno)\b/i.test(text) &&
    /\b(?:master\s+bath|bath(?:room)?s?)\b/i.test(text);
  if (!bathJob) return false;
  return bathroomScopeLines(text).length === 0;
}

function vagueKitchen(text: string): boolean {
  if (WHOLE_HOME.test(text)) return false;
  const kitchenJob =
    notesDescribeDedicatedKitchenRemodel(text) ||
    (/\bkitchen\b/i.test(text) &&
      /\b(?:update|remodel|renovation|reno)\b/i.test(text));
  if (!kitchenJob) return false;
  return !(
    kitchenNoteNamesCabinetWork(text) ||
    kitchenNoteNamesCounterWork(text) ||
    kitchenNoteNamesBacksplash(text) ||
    /\b(?:flooring|lvp|vinyl|appliances?|sinks?|dishwasher)\b/i.test(text)
  );
}

function vaguePaint(text: string): boolean {
  if (!notesDescribeDedicatedPaintingJob(text)) return false;
  return !PAINT_SURFACE.test(text);
}

function vagueStucco(text: string): boolean {
  if (!notesDescribeDedicatedStuccoJob(text)) return false;
  if (dedicatedStuccoWallSqft(text)) return false;
  if (/\b(?:front|back|rear|side|elevation|walls?)\b/i.test(text)) return false;
  return true;
}

type ThinScope = {
  title: string;
  question: string;
  match: RegExp;
  described: RegExp;
};

/**
 * A bundle or a trade word with nothing inside it.
 * "Replace the roof" and "Flooring on the main level" describe the line.
 * "Roof." and "Flooring." do not.
 */
const THIN_SCOPES: ThinScope[] = [
  {
    title: 'Electrical',
    question: 'Which electrical work is in this job?',
    match: /\b(?:electrical|wiring)\b/i,
    described:
      /\b(?:outlets?|receptacles?|switches?|lights?|recessed|panels?|circuits?|gfci|rewire|rewiring|dimmers?|fans?|smoke|service\s+calls?|chargers?|\d+\s*amps?)\b/i,
  },
  {
    title: 'Plumbing',
    question: 'Which plumbing work is in this job?',
    match: /\bplumbing\b/i,
    described:
      /\b(?:toilets?|sinks?|faucets?|showers?|tubs?|bathtubs?|water\s+heaters?|drains?|pipes?|repiping|rough[\s-]?ins?|fixtures?|disposals?|sewer|water\s+lines?)\b/i,
  },
  {
    title: 'HVAC',
    question: 'Which HVAC work is in this job?',
    match: /\bhvac\b/i,
    described:
      /\b(?:furnaces?|heat\s*pumps?|air\s*condition(?:er|ing)?|condensers?|air\s+handlers?|ducts?|ductwork|mini[\s-]?splits?|thermostats?|service\s+calls?|tons?|replace(?:ment)?|install)\b/i,
  },
  {
    title: 'Roofing',
    question:
      'Which parts of the roof are in this job? The roof area stays blank until measured.',
    match: /\broof(?:ing)?\b/i,
    described:
      /\b(?:replace(?:ment)?|shingles?|tear[\s-]?off|vents?|flashing|squares?|metal|repair|leak|underlayment|ridge|gutters?|install|new)\b/i,
  },
  {
    title: 'Flooring',
    question:
      'Which floors are being done, and which product? The area stays blank until measured.',
    match: /\bflooring\b/i,
    described:
      /\b(?:lvp|luxury\s+vinyl|vinyl|carpet|hardwood|laminate|tile|vct|main\s+level|upstairs|downstairs|bedrooms?|kitchen|bath|install|replace(?:ment)?|remove|removal|sqft|sq\.?\s*ft|\bsf\b)\b/i,
  },
  {
    title: 'Drywall',
    question:
      'Which drywall work is in this job? Wall and ceiling area stay blank until measured.',
    match: /\b(?:drywall|sheetrock|gypsum)\b/i,
    described:
      /\b(?:hang|finish|tape|mud|texture|patch|repair|ceilings?|walls?|addition|sqft|sq\.?\s*ft|\bsf\b)\b/i,
  },
  {
    title: 'Windows',
    question: 'Which windows are in this job?',
    match: /\bwindows?\b/i,
    described:
      /\b(?:replace(?:ment)?|install|new|remove|removal|vinyl|double[\s-]?hung|picture|egress|casement|slider)\b|\b\d+\s+windows?\b/i,
  },
  {
    title: 'Doors',
    question: 'Which doors are in this job?',
    match: /\bdoors?\b/i,
    described:
      /\b(?:replace(?:ment)?|install|new|interior|exterior|entry|sliding|patio|garage|hardware|paint[\s-]?grade|prehung|remove)\b|\b\d+\s+(?:interior\s+|exterior\s+)?doors?\b|\bpaint(?:ing)?\b[^.]{0,40}\bdoors?\b|\bdoors?\b[^.]{0,40}\bpaint/i,
  },
  {
    title: 'Insulation',
    question:
      'Where is the insulation going? The area stays blank until measured.',
    match: /\binsulat(?:e|ion|ed)\b/i,
    described:
      /\b(?:attic|walls?|ceilings?|crawl|floors?|basement|garage|batts?|blown|spray|R[-\s]?\d{2,3})\b/i,
  },
  {
    title: 'Concrete',
    question:
      'Which concrete work is in this job? The area stays blank until measured.',
    match: /\bconcrete\b/i,
    described:
      /\b(?:patio|driveway|sidewalk|slabs?|footings?|foundation|flatwork|pour|stamped|broom|pads?|sqft|sq\.?\s*ft|\bsf\b)\b/i,
  },
  {
    title: 'Framing',
    question:
      'Which framing is in this job? The area stays blank until measured.',
    match: /\bframing\b/i,
    described:
      /\b(?:walls?|roofs?|floors?|addition|headers?|beams?|studs?|trusses?|sqft|sq\.?\s*ft|\bsf\b)\b/i,
  },
  {
    title: 'Deck',
    question:
      'Which parts of the deck are in this job? The size stays blank until measured.',
    match: /\bdeck(?:ing)?\b/i,
    described:
      /\b(?:railings?|guardrails?|stairs?|steps?|footings?|composite|wood|posts?|demo|remove|replace(?:ment)?|rebuild|sqft|sq\.?\s*ft|\bsf\b)\b/i,
  },
  {
    title: 'Siding',
    question:
      'Which walls are getting siding? The wall area stays blank until measured.',
    match: /\bsiding\b/i,
    described:
      /\b(?:replace(?:ment)?|install|new|vinyl|fiber|cement|hardie|front|back|rear|sides?|repair|remove|sqft|sq\.?\s*ft|\bsf\b)\b/i,
  },
  {
    title: 'Landscaping',
    question: 'Which landscaping work is in this job?',
    match: /\blandscap(?:e|ing)\b/i,
    described:
      /\b(?:sod|grass|pavers?|mulch|plants?|trees?|irrigation|sprinklers?|retaining|fenc(?:e|ing)|grading|rocks?|gravel)\b/i,
  },
  {
    title: 'Tile',
    question: 'Which surfaces are being tiled?',
    match: /\b(?:tile|tiling)\b/i,
    described:
      /\b(?:showers?|floors?|backsplash|walls?|niches?|tubs?|bath(?:room)?s?|kitchens?|sqft|sq\.?\s*ft|\bsf\b)\b/i,
  },
  {
    title: 'Demolition',
    question: 'What is being demolished?',
    match: /\b(?:demo|demolition)\b/i,
    described:
      /\b(?:studs?|cabinets?|counters?|countertops?|backsplash|floors?|tile|tubs?|walls?|kitchens?|bath(?:room)?s?|drywall|sheetrock)\b/i,
  },
  {
    title: 'Gutters',
    question: 'Which gutters are in this job?',
    match: /\bgutters?\b/i,
    described:
      /\b(?:replace(?:ment)?|install|new|leaf|guards?|downspouts?|feet|lf|linear|repair|remove)\b/i,
  },
  {
    title: 'Fence',
    question:
      'Which fence work is in this job? The length stays blank until measured.',
    match: /\bfenc(?:e|ing)\b/i,
    described:
      /\b(?:cedar|wood|vinyl|chain[\s-]?link|picket|feet|lf|linear|gates?|heights?|replace(?:ment)?|install|new|remove)\b/i,
  },
];

const SKIP_THIN_NOTE =
  /\b(?:plan imported|cover sheet|full\s+build|ground[\s-]?up|new\s+(?:build|construction|home)|custom\s+home|spec\s+home)\b/i;

function affirmativeNoteText(notes: string): string {
  return notes
    .split(/\n+|(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(
      sentence =>
        sentence &&
        !/^(?:no|not|without|do not|don't|dont|never|keep|leave)\b/i.test(
          sentence
        ) &&
        !/\bowner[\s-]*supplied\b/i.test(sentence) &&
        !/\bseparate\s+bid\b/i.test(sentence)
    )
    .join(' ');
}

function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] || '';
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, -1).join(', ')}, and ${titles[titles.length - 1]}`;
}

function generalThinScope(
  notes: string
): { title: string; question: string } | null {
  if (SKIP_THIN_NOTE.test(notes)) return null;
  const work = affirmativeNoteText(notes);
  if (!work) return null;
  const matched = THIN_SCOPES.filter(scope => scope.match.test(work));
  if (!matched.length) return null;
  if (matched.some(scope => scope.described.test(work))) return null;
  if (matched.length === 1) {
    return { title: matched[0].title, question: matched[0].question };
  }
  const titles = matched.map(scope => scope.title);
  const phrase = titles.map(title => title.toLowerCase()).join(' and ');
  return {
    title: joinTitles(titles),
    question:
      titles.length > 2
        ? 'Which work is in this job?'
        : `Which ${phrase} work is in this job?`,
  };
}

export type VagueScopeChip = { label: string; text: string };

type VagueScope = {
  title: string;
  question: string;
  chips: VagueScopeChip[];
  example: string;
};

const chip = (label: string, text: string = label): VagueScopeChip => ({
  label,
  text,
});

const WHOLE_HOME_CHIPS = [
  chip('Kitchen', 'Kitchen updates'),
  chip('Bathrooms', 'Bathroom updates'),
  chip('Flooring'),
  chip('Paint', 'Paint the interior'),
  chip('Drywall'),
  chip('Electrical'),
  chip('Plumbing'),
  chip('Insulation'),
  chip('Windows', 'Replace windows'),
  chip('Interior doors', 'Replace interior doors'),
  chip('Trim', 'Trim and baseboards'),
];

const THIN_SCOPE_CHIPS: Record<string, VagueScopeChip[]> = {
  Electrical: [
    chip('Outlets'),
    chip('Switches'),
    chip('Recessed lights'),
    chip('Ceiling fans'),
    chip('Panel', 'Panel upgrade'),
  ],
  Plumbing: [
    chip('Toilets'),
    chip('Sinks'),
    chip('Faucets'),
    chip('Water heater'),
    chip('Rough-in'),
  ],
  HVAC: [
    chip('Furnace', 'Replace the furnace'),
    chip('AC', 'Replace the air conditioner'),
    chip('Ductwork'),
    chip('Thermostat'),
    chip('Service call'),
  ],
  Roofing: [
    chip('Replacement', 'Roof replacement'),
    chip('Repair', 'Roof repair'),
    chip('Vents', 'Roof vents'),
    chip('Flashing'),
    chip('Gutters'),
  ],
  Flooring: [
    chip('LVP'),
    chip('Carpet'),
    chip('Hardwood'),
    chip('Tile', 'Floor tile'),
    chip('Main level'),
    chip('Remove existing', 'Remove the existing floor'),
  ],
  Drywall: [
    chip('Hang and finish'),
    chip('Patch', 'Patch and repair'),
    chip('Walls'),
    chip('Ceilings'),
    chip('Texture'),
  ],
  Windows: [
    chip('Replace', 'Replace windows'),
    chip('New install', 'Install new windows'),
    chip('Egress', 'Egress windows'),
  ],
  Doors: [
    chip('Interior', 'Interior doors'),
    chip('Exterior', 'Exterior doors'),
    chip('Sliding', 'Sliding doors'),
    chip('Garage', 'Garage doors'),
    chip('Paint', 'Paint the doors'),
  ],
  Insulation: [
    chip('Attic'),
    chip('Walls'),
    chip('Crawlspace'),
    chip('Blown-in', 'Blown insulation'),
    chip('Batts'),
  ],
  Concrete: [
    chip('Driveway'),
    chip('Patio'),
    chip('Sidewalk'),
    chip('Slab'),
    chip('Footings'),
  ],
  Framing: [
    chip('Walls'),
    chip('Addition'),
    chip('Headers'),
    chip('Roof framing', 'Roof framing'),
  ],
  Deck: [
    chip('Composite', 'Composite decking'),
    chip('Railings'),
    chip('Stairs'),
    chip('Footings'),
    chip('Demo', 'Demo the existing deck'),
  ],
  Siding: [
    chip('Replace', 'Replace siding'),
    chip('Front'),
    chip('Back'),
    chip('Sides'),
    chip('Hardie', 'Fiber cement siding'),
  ],
  Landscaping: [
    chip('Sod'),
    chip('Pavers'),
    chip('Mulch'),
    chip('Irrigation'),
    chip('Retaining wall'),
  ],
  Tile: [
    chip('Shower', 'Shower walls'),
    chip('Floor', 'Floor tile'),
    chip('Backsplash'),
  ],
  Demolition: [
    chip('Kitchen', 'Demo the kitchen'),
    chip('Bathroom', 'Demo the bathroom'),
    chip('Flooring', 'Remove the floors'),
    chip('Drywall', 'Remove the drywall'),
  ],
  Gutters: [
    chip('Replace', 'Replace gutters'),
    chip('Guards', 'Leaf guards'),
    chip('Downspouts'),
  ],
  Fence: [
    chip('Wood', 'Wood fence'),
    chip('Vinyl', 'Vinyl fence'),
    chip('Chain link', 'Chain-link fence'),
    chip('Gates'),
  ],
};

const THIN_SCOPE_EXAMPLES: Record<string, string> = {
  Electrical: '12 outlets, 6 recessed lights, 2 ceiling fans.',
  Plumbing: '2 toilets, 1 water heater, 3 faucets.',
  HVAC: 'Replace the furnace, 3 ton. New thermostat.',
  Roofing: 'Roof replacement, 28 squares.',
  Flooring: 'LVP on the main level, 1,200 sqft.',
  Drywall: 'Hang and finish 1,200 sqft of walls.',
  Windows: 'Replace 8 windows.',
  Doors: 'Replace 5 interior doors.',
  Insulation: 'Attic insulation, 1,400 sqft.',
  Concrete: 'Driveway, 600 sqft.',
  Framing: 'Frame 400 sqft of walls.',
  Deck: 'Composite deck, 300 sqft, with railings.',
  Siding: 'Replace siding on the front, 900 sqft.',
  Landscaping: 'Sod, 2,000 sqft. Mulch beds.',
  Tile: 'Shower walls, 90 sqft. Floor tile, 50 sqft.',
  Demolition: 'Demo the kitchen to the studs.',
  Gutters: 'Replace gutters, 140 LF.',
  Fence: 'Wood fence, 180 LF, with 2 gates.',
};

function vagueScope(notes: string | null | undefined): VagueScope | null {
  const text = String(notes || '').trim();
  if (!text) return null;
  if (wholeHomeRemodelNamedItemIds(text) != null) {
    const question = wholeHomeTradeQuestion(text);
    if (!question) return null;
    return {
      title: 'Whole house remodel',
      question,
      chips: WHOLE_HOME_CHIPS,
      example: 'Kitchen cabinets, 25 LF. LVP flooring, 1,800 sqft. Paint the walls.',
    };
  }
  if (vagueBathroom(text)) {
    return {
      title: 'Bathroom remodel',
      question: 'Which parts of the bathroom are in this remodel?',
      chips: [
        chip('Demo', 'Demo the shower tile'),
        chip('Shower tile', 'Tile the shower walls'),
        chip('Tub', 'Remove the tub'),
        chip('Vanity', 'New vanity'),
        chip('Toilet', 'New toilet'),
        chip('Floor tile', 'Tile the bathroom floor'),
        chip('Paint', 'Paint the walls'),
      ],
      example: 'Tile the shower walls, 90 sqft. New vanity. New toilet.',
    };
  }
  if (vagueKitchen(text)) {
    return {
      title: 'Kitchen remodel',
      question: 'Which parts of the kitchen are in this remodel?',
      chips: [
        chip('Cabinets', 'New cabinets'),
        chip('Countertops', 'New countertops'),
        chip('Backsplash', 'Tile backsplash'),
        chip('Flooring', 'New flooring'),
        chip('Sink', 'New sink'),
        chip('Appliances', 'Install appliances'),
      ],
      example: 'Cabinets, 25 LF. Quartz countertops, 60 sqft. Tile backsplash, 30 sqft.',
    };
  }
  if (vaguePaint(text)) {
    return {
      title: 'Painting',
      question: 'Which surfaces are being painted?',
      chips: [
        chip('Walls', 'Paint the walls'),
        chip('Ceilings', 'Paint the ceilings'),
        chip('Trim', 'Paint the trim'),
        chip('Doors', 'Paint the doors'),
        chip('Cabinets', 'Paint the cabinets'),
        chip('Exterior', 'Paint the exterior walls'),
      ],
      example: 'Walls, 1,000 sqft. Ceilings, 800 sqft. 6 doors.',
    };
  }
  if (vagueStucco(text)) {
    return {
      title: 'Stucco',
      question:
        'Which walls are getting stucco? The wall area stays blank until measured.',
      chips: [
        chip('Front', 'Front of the house'),
        chip('Back', 'Back of the house'),
        chip('Sides', 'Side walls'),
        chip('All walls', 'All exterior walls'),
      ],
      example: 'Front of the house, 600 sqft.',
    };
  }
  const thin = generalThinScope(text);
  if (!thin) return null;
  const titles = thin.title.split(/,\s*(?:and\s+)?|\s+and\s+/);
  const chips = titles.flatMap(title => THIN_SCOPE_CHIPS[title] || []);
  return {
    title: thin.title,
    question: thin.question,
    chips: chips.slice(0, 10),
    example:
      THIN_SCOPE_EXAMPLES[titles[0]] ||
      'Name the work and any measurements you have.',
  };
}

/** A job name with no work inside it. The bid waits for that work. */
export function vagueScopeQuestion(
  notes: string | null | undefined
): string | null {
  return vagueScope(notes)?.question ?? null;
}

export function vagueScopeTitle(notes: string | null | undefined): string | null {
  return vagueScope(notes)?.title ?? null;
}

/** Scopes that answer this note. Tapping one adds it to the answer field. */
export function vagueScopeChips(
  notes: string | null | undefined
): VagueScopeChip[] {
  return vagueScope(notes)?.chips ?? [];
}

export function vagueScopeExample(
  notes: string | null | undefined
): string | null {
  return vagueScope(notes)?.example ?? null;
}
