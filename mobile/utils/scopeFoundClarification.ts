import {
  measurementsForShowerRemovalChoice,
  showerRemovalPrompt,
  type ShowerRemovalPiece,
} from '@/utils/bathroomNoteScope';
import {
  dedicatedFlooringAreaSqft,
  notesDescribeDedicatedFlooringJob,
  notesRequestFlooringDemo,
} from '@/utils/flooringNoteScope';
import { notesOwnerHandlesFlooringDemo } from '@/utils/flooringOwnerDemoNote';
import {
  kitchenNoteIncludesFloorWork,
  kitchenNoteNamesBacksplash,
  kitchenNoteNamesCabinetWork,
  kitchenNoteNamesCounterWork,
  notesDescribeDedicatedKitchenRemodel,
} from '@/utils/kitchenNoteScope';
import { notesDescribeDedicatedDeckJob } from '@/utils/deckNoteScope';
import {
  notesDescribeDedicatedDrywallJob,
  notesDescribeSheetrockFinishJob,
} from '@/utils/drywallNoteScope';
import { notesDescribeDedicatedElectricalDeviceJob } from '@/utils/electricalNoteScope';
import {
  notesNameDedicatedWallAreaFraming,
  notesNameFramingOnlyAddition,
  notesNameLinearFootStudWall,
  notesNameUnmeasuredWallFraming,
} from '@/utils/subcontractorTrade/framingPlanConvergence';
import { notesNameDedicatedHvacEquipmentJob } from '@/utils/subcontractorTrade/hvacPlanConvergence';
import { notesDescribeDedicatedInsulationJob } from '@/utils/insulationNoteScope';
import { notesDescribeDedicatedPaintingJob } from '@/utils/paintingNoteScope';
import { notesDescribeDedicatedStuccoJob } from '@/utils/stuccoNoteScope';
import { notesDescribeDedicatedWindowsDoorsJob } from '@/utils/windowsDoorsNoteScope';
import {
  inferRoofingSystemFromNotes,
  inferRoofingTearOffFromNotes,
  noteMentionIsOnlyNegated,
} from '@/utils/scopeItemNoteHints';
import {
  notesDescribeMeasuredWholeHomeRemodel,
  wholeHomeRemodelIncludesFinishDemo,
} from '@/utils/wholeHomeRemodelNote';
import type { QuickMeasurementFieldKey } from '@/utils/scopeQuickMeasurements';

export type ScopeFoundClarificationId =
  | 'shower'
  | 'flooring_demo'
  | 'roof_tearoff'
  | 'kitchen_demo'
  | 'whole_home_demo'
  | 'interior_paint_extent'
  | 'stucco_demo'
  | 'concrete_demo'
  | 'landscape_demo'
  | 'insulation_demo'
  | 'framing_demo'
  | 'drywall_demo'
  | 'deck_demo'
  | 'hvac_demo'
  | 'electrical_demo'
  | 'plumbing_demo'
  | 'openings_demo'
  | 'excavation_demo'
  | 'existing_structure'
  | 'remodel_remainder';

export type ScopeFoundChoice =
  | 'yes'
  | 'cabinets'
  | 'flooring'
  | 'all'
  | 'walls'
  | 'walls_ceilings'
  | 'walls_ceilings_trim'
  | 'none'
  | 'unsure';

export type ScopeFoundClarification = {
  id: ScopeFoundClarificationId;
  question: string;
  /** More than one existing piece can be coming out. */
  multi?: boolean;
  options: Array<{ id: string; label: string }>;
};

export type ScopeFoundRevealLine = {
  name: string;
  amount: number;
  quantity: string;
};

type ClarificationLine = {
  id: string;
  label: string;
  helperText: string;
  category: string;
};

const REMOVAL_NAMED =
  /\b(?:remove|removal|demo|demolition|tear[\s-]?out|tear[\s-]?off|rip[\s-]?out|haul(?:ed)?[\s-]?off|coming out|tear[\s-]?down)\b/i;

const NONE_OR_UNSURE = new Set<ScopeFoundChoice>(['none', 'unsure']);

const CHOICES = new Set<ScopeFoundChoice>([
  'yes',
  'cabinets',
  'flooring',
  'all',
  'walls',
  'walls_ceilings',
  'walls_ceilings_trim',
  'none',
  'unsure',
]);

const IDS = new Set<ScopeFoundClarificationId>([
  'shower',
  'flooring_demo',
  'roof_tearoff',
  'kitchen_demo',
  'whole_home_demo',
  'interior_paint_extent',
  'stucco_demo',
  'concrete_demo',
  'landscape_demo',
  'insulation_demo',
  'framing_demo',
  'drywall_demo',
  'deck_demo',
  'hvac_demo',
  'electrical_demo',
  'plumbing_demo',
  'openings_demo',
  'excavation_demo',
  'existing_structure',
  'remodel_remainder',
]);

function noteText(notes: string | null | undefined): string {
  return String(notes || '').trim();
}

function notesLookLikeNewBuild(text: string): boolean {
  return /\b(?:new\s+(?:build|home|construction|house)|ground[-\s]?up|single[-\s]?family(?:\s+home)?|custom\s+home)\b/i.test(
    text
  );
}

function notesLookLikeAddition(text: string): boolean {
  return /\b(?:room\s+addition|home\s+addition|\baddition\b|\badu\b|garage\s+conversion)\b/i.test(
    text
  );
}

function notesLookLikeWholeHome(text: string): boolean {
  return (
    notesDescribeMeasuredWholeHomeRemodel(text) ||
    /\b(?:whole|entire|full)[\s-]+(?:house|home)(?:\s+remodel)?\b|\b(?:house|home)\s+remodel\b/i.test(
      text
    )
  );
}

function kitchenInstallNote(text: string): boolean {
  if (notesLookLikeWholeHome(text) || notesLookLikeNewBuild(text)) return false;
  if (
    /\b(?:bathroom|bath|vanity|toilet|shower|tub)\b/i.test(text) &&
    !/\bkitchen\b/i.test(text)
  ) {
    return false;
  }
  if (notesDescribeDedicatedKitchenRemodel(text)) return true;
  return (
    kitchenNoteNamesCabinetWork(text) ||
    kitchenNoteNamesCounterWork(text) ||
    kitchenNoteNamesBacksplash(text)
  );
}

function kitchenSurfaceGroups(text: string): Array<'cabinets' | 'flooring'> {
  const groups: Array<'cabinets' | 'flooring'> = [];
  if (
    kitchenNoteNamesCabinetWork(text) ||
    kitchenNoteNamesCounterWork(text) ||
    kitchenNoteNamesBacksplash(text)
  ) {
    groups.push('cabinets');
  }
  if (kitchenNoteIncludesFloorWork(text)) groups.push('flooring');
  return groups;
}

function statedArea(text: string): number | null {
  const match = text.match(
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i
  );
  const value = Number(String(match?.[1] || '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function statedNumber(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Square feet in the same clause as the surface. The first sqft in the note can belong to a different surface. */
function statedSqftNear(text: string, subject: RegExp): number | null {
  const flags = subject.flags.replace('g', '');
  const subjectRe = new RegExp(subject.source, flags);
  const clauses = String(text || '').split(/,(?!\d)|[.;\n]+/);
  const sqftIn = (clause: string) => {
    const match = clause.match(
      /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i
    );
    const qty = Number(String(match?.[1] || '').replace(/,/g, ''));
    return Number.isFinite(qty) && qty > 0 ? qty : null;
  };
  for (let index = 0; index < clauses.length; index += 1) {
    const clause = clauses[index];
    if (!subjectRe.test(clause)) continue;
    const inClause = sqftIn(clause);
    if (inClause) return inClause;
    const next = clauses[index + 1] || '';
    if (!/^\s*\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\s*$/i.test(next)) {
      continue;
    }
    const following = sqftIn(next);
    if (following) return following;
  }
  return null;
}

function statedCabinetLf(text: string): number | null {
  const patterns = [
    /\bcabinets?\b[^.]{0,48}?(\d[\d,]*(?:\.\d+)?)\s*(?:linear\s+feet|lin\.?\s*ft\.?|lf)\b/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(?:linear\s+feet|lin\.?\s*ft\.?|lf)\b[^.]{0,48}?\bcabinets?\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = Number(String(match?.[1] || '').replace(/,/g, ''));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function statedKitchenFloorSqft(text: string): number | null {
  return statedSqftNear(
    text,
    /\blvp\b|\bluxury\s+vinyl\b|\bkitchen\s+floor(?:ing)?\b/i
  );
}

function kitchenPieceQuantity(text: string, piece: string): string {
  if (piece === 'cabinets') return quantityLabel(statedCabinetLf(text), 'LF');
  if (piece === 'countertops') {
    return quantityLabel(
      statedSqftNear(text, /\bquartz\b|\bgranite\b|\bcountertops?\b|\bcounters\b/i),
      'sqft'
    );
  }
  if (piece === 'backsplash') {
    return quantityLabel(
      statedSqftNear(text, /\bbacksplash\b|\bback\s*splash\b/i),
      'sqft'
    );
  }
  if (piece === 'kitchen_floor') {
    return quantityLabel(statedKitchenFloorSqft(text), 'sqft');
  }
  return '';
}

function statedSquares(text: string): number | null {
  const match = text.match(/\b(\d[\d,]*(?:\.\d+)?)\s*squares?\b/i);
  const value = Number(String(match?.[1] || '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function typedRoofTearOffSquares(
  measurements: { itemQuantities?: Record<string, { quantity?: unknown }> } | null | undefined,
  piece: string
): number | null {
  const card = ROOF_TEAR_OFF_CARDS.find(row => row.piece === piece);
  if (!card) return null;
  const raw = measurements?.itemQuantities?.[card.id]?.quantity;
  const value = Number(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function quantityLabel(value: number | null, unit: string): string {
  if (!value) return '';
  return `${value.toLocaleString('en-US')} ${unit}`;
}

/**
 * Wall sqft stays on wall removal. Ceiling removal stays blank unless the
 * note states a ceiling area. A generic drywall area can still fill either
 * surface when the note does not say which one.
 */
function statedDrywallRemovalSqft(
  text: string,
  surface: 'walls' | 'ceilings',
  fallbackArea: number
): number | null {
  const wall = statedSqftNear(text, /\bwalls?\b/i);
  const ceiling = statedSqftNear(text, /\bceilings?\b/i);
  if (surface === 'walls') {
    if (wall) return wall;
    if (ceiling) return null;
  } else {
    if (ceiling) return ceiling;
    if (wall) return null;
  }
  return fallbackArea > 0 ? fallbackArea : null;
}

function flooringAreaForNote(text: string): number | null {
  return (
    dedicatedFlooringAreaSqft(text) ||
    (notesLookLikeWholeHome(text) ? null : statedArea(text))
  );
}

function decline(id: ScopeFoundChoice, label = 'No demo'): {
  id: ScopeFoundChoice;
  label: string;
} {
  return { id, label };
}

const FLOOR_PIECES = [
  { id: 'carpet', label: 'Carpet' },
  { id: 'tile', label: 'Tile' },
  { id: 'hardwood', label: 'Hardwood' },
  { id: 'vinyl', label: 'Vinyl' },
  { id: 'laminate', label: 'Laminate' },
] as const;

const ROOF_PIECES = [
  { id: 'shingles', label: 'Shingles' },
  { id: 'roof_tile', label: 'Tile' },
  { id: 'metal', label: 'Metal' },
  { id: 'flat', label: 'Flat roof' },
] as const;

const KITCHEN_PIECES = [
  { id: 'cabinets', label: 'Cabinets' },
  { id: 'countertops', label: 'Countertops' },
  { id: 'backsplash', label: 'Backsplash' },
  { id: 'kitchen_floor', label: 'Flooring' },
  { id: 'island', label: 'Island' },
  { id: 'appliances', label: 'Appliances' },
] as const;

const STRUCTURE_PIECES = [
  { id: 'house', label: 'House' },
  { id: 'garage', label: 'Garage' },
] as const;

const PIECE_IDS = new Set<string>([
  ...FLOOR_PIECES.map(piece => piece.id),
  ...ROOF_PIECES.map(piece => piece.id),
  ...KITCHEN_PIECES.map(piece => piece.id),
  ...STRUCTURE_PIECES.map(piece => piece.id),
  'flooring',
  'walls',
  'ceilings',
  'trim',
  'doors',
  'paint_cabinets',
  'bathrooms',
  'framing_sheathing',
]);

const FLOOR_TYPE_BY_PIECE: Record<string, string> = {
  carpet: 'carpet',
  tile: 'tile',
  hardwood: 'solid_hardwood',
  vinyl: 'sheet_vinyl_vct',
  laminate: 'laminate',
};

function pieceQuestion(
  id: ScopeFoundClarificationId,
  question: string,
  pieces: ReadonlyArray<{ id: string; label: string }>,
  declineLabel = 'No demo'
): ScopeFoundClarification {
  return {
    id,
    question,
    multi: true,
    options: [
      ...pieces.map(piece => ({ id: piece.id, label: piece.label })),
      decline('none', declineLabel),
      decline('unsure', 'Not sure'),
    ],
  };
}

function subjectAlreadyComingOut(text: string, subject: RegExp): boolean {
  const verb =
    'remove|removal|demo|demolition|tear[\\s-]?out|tear[\\s-]?off|rip[\\s-]?out|coming out|replace(?:ment)?';
  const subjectPattern = `(?:${subject.source})`;
  return new RegExp(
    `\\b(?:${verb})\\b[^.]{0,50}${subjectPattern}|${subjectPattern}[^.]{0,50}\\b(?:${verb})\\b`,
    'i'
  ).test(text);
}

function subjectStays(text: string, subject: RegExp): boolean {
  const verb = 'stay(?:s|ing)?(?:\\s+off)?|keep(?:s|ing)?|leave|left|remain(?:s|ing)?';
  const subjectPattern = `(?:${subject.source})`;
  return new RegExp(
    `\\b(?:${verb})\\b[^.]{0,40}${subjectPattern}|${subjectPattern}[^.]{0,40}\\b(?:${verb})\\b`,
    'i'
  ).test(text);
}

function subjectByOthers(text: string, subject: RegExp): boolean {
  const subjectPattern = `(?:${subject.source})`;
  return new RegExp(
    `${subjectPattern}[^.]{0,40}\\bby\\s+others?\\b|\\bby\\s+others?\\b[^.]{0,40}${subjectPattern}`,
    'i'
  ).test(text);
}

function piecesStillUnknown(
  text: string,
  pieces: ReadonlyArray<{ id: string; label: string; subject: RegExp }>
): Array<{ id: string; label: string }> {
  return pieces
    .filter(
      piece =>
        !subjectAlreadyComingOut(text, piece.subject) &&
        !subjectStays(text, piece.subject) &&
        !subjectByOthers(text, piece.subject)
    )
    .map(piece => ({ id: piece.id, label: piece.label }));
}

/** Replace already includes the old floor. Install does not. */
export function flooringReplaceIncludesRemoval(
  notes: string | null | undefined
): boolean {
  const text = noteText(notes);
  if (!notesDescribeDedicatedFlooringJob(text)) return false;
  if (notesOwnerHandlesFlooringDemo(text)) return false;
  if (notesRequestFlooringDemo(text)) return false;
  return /\breplace(?:ment)?\b/i.test(text);
}

function flooringDemoPrompt(text: string): ScopeFoundClarification | null {
  if (!notesDescribeDedicatedFlooringJob(text)) return null;
  if (
    notesOwnerHandlesFlooringDemo(text) ||
    notesRequestFlooringDemo(text) ||
    flooringReplaceIncludesRemoval(text)
  ) {
    return null;
  }
  if (!/\b(?:install|new)\b/i.test(text) && statedArea(text) == null) return null;
  return pieceQuestion(
    'flooring_demo',
    'Is existing flooring being removed?',
    piecesStillUnknown(text, [
      { id: 'carpet', label: 'Carpet', subject: /\bcarpets?\b/ },
      { id: 'tile', label: 'Tile', subject: /\btiles?\b/ },
      { id: 'hardwood', label: 'Hardwood', subject: /\bhardwood\b/ },
      { id: 'vinyl', label: 'Vinyl', subject: /\bvinyl\b/ },
      { id: 'laminate', label: 'Laminate', subject: /\blaminate\b/ },
    ])
  );
}

function roofTearOffPrompt(text: string): ScopeFoundClarification | null {
  if (notesLookLikeNewBuild(text) || notesLookLikeAddition(text)) return null;
  if (!inferRoofingSystemFromNotes(text)) return null;
  if (inferRoofingTearOffFromNotes(text)) return null;
  return pieceQuestion(
    'roof_tearoff',
    'Is the existing roof being torn off?',
    piecesStillUnknown(text, [
      { id: 'shingles', label: 'Shingles', subject: /\bshingles?\b/ },
      { id: 'roof_tile', label: 'Tile', subject: /\broof\s+tiles?\b|\btile\s+roof\b/ },
      { id: 'metal', label: 'Metal', subject: /\bmetal\s+roof\b/ },
      { id: 'flat', label: 'Flat roof', subject: /\b(?:flat|tpo|epdm|membrane)\s+roof\b/ },
    ])
  );
}

function paintExtentPrompt(text: string): ScopeFoundClarification | null {
  if (!notesDescribeDedicatedPaintingJob(text)) return null;
  if (!/\b(?:entire|whole)\s+interior\b/i.test(text)) return null;
  if (/\b(?:ceilings?|trim|baseboards?)\b/i.test(text)) return null;
  return {
    id: 'interior_paint_extent',
    question: 'Which interior surfaces are included?',
    multi: true,
    options: [
      { id: 'walls', label: 'Walls' },
      { id: 'ceilings', label: 'Ceilings' },
      { id: 'trim', label: 'Trim' },
      { id: 'doors', label: 'Doors' },
      { id: 'paint_cabinets', label: 'Cabinets' },
      decline('unsure', 'Not sure'),
    ],
  };
}

const KITCHEN_DEMO_PIECES: Array<{
  id: string;
  label: string;
  subject: RegExp;
  named: (text: string) => boolean;
}> = [
  {
    id: 'cabinets',
    label: 'Cabinets',
    subject: /\bcabinets?\b/,
    named: kitchenNoteNamesCabinetWork,
  },
  {
    id: 'countertops',
    label: 'Countertops',
    subject: /\b(?:countertops?|counters?|quartz|granite)\b/,
    named: kitchenNoteNamesCounterWork,
  },
  {
    id: 'backsplash',
    label: 'Backsplash',
    subject: /\bbacksplashes?\b|\bback\s*splash\b|\bsplash\b/,
    named: kitchenNoteNamesBacksplash,
  },
  {
    id: 'kitchen_floor',
    label: 'Flooring',
    subject: /\b(?:flooring|lvp|vinyl|laminate|carpet)\b/,
    named: kitchenNoteIncludesFloorWork,
  },
  {
    id: 'island',
    label: 'Island',
    subject: /\bislands?\b/,
    named: text => /\bislands?\b/i.test(text),
  },
  {
    id: 'appliances',
    label: 'Appliances',
    subject: /\bappliances?\b/,
    named: text => /\bappliances?\b/i.test(text),
  },
];

function kitchenDemoPrompt(text: string): ScopeFoundClarification | null {
  if (!kitchenInstallNote(text)) return null;
  const relevant = KITCHEN_DEMO_PIECES.filter(
    piece => piece.id === 'kitchen_floor' || piece.named(text)
  );
  const pieces = piecesStillUnknown(text, relevant);
  if (!pieces.length) return null;
  return pieceQuestion(
    'kitchen_demo',
    pieces.length < relevant.length
      ? 'Any other removal?'
      : 'Is demolition of the existing kitchen included?',
    pieces
  );
}

function wholeHomeDemoPrompt(text: string): ScopeFoundClarification | null {
  if (!notesLookLikeWholeHome(text)) return null;
  if (wholeHomeRemodelIncludesFinishDemo(text)) return null;
  const pieces = [
    ...(/\bkitchen\b/i.test(text)
      ? piecesStillUnknown(text, [
          { id: 'cabinets', label: 'Cabinets', subject: /\bcabinets?\b/ },
          { id: 'countertops', label: 'Countertops', subject: /\b(?:countertops?|counters?)\b/ },
          { id: 'backsplash', label: 'Backsplash', subject: /\bbacksplashes?\b/ },
          { id: 'appliances', label: 'Appliances', subject: /\bappliances?\b/ },
        ])
      : []),
    ...(/\b(?:flooring|lvp|carpet|vinyl|hardwood|laminate)\b/i.test(text)
      ? piecesStillUnknown(text, [
          {
            id: 'flooring',
            label: 'Flooring',
            subject: /\bflooring\b|\bfloors?\b/,
          },
        ])
      : []),
    ...(/\bbath(?:room)?s?\b/i.test(text)
      ? piecesStillUnknown(text, [
          {
            id: 'bathrooms',
            label:
              /\bbathrooms\b|\bbaths\b|\b(?:two|three|four|five|six|\d+)\s+baths?\b/i.test(
                text
              )
                ? 'Bathrooms'
                : 'Bathroom',
            subject: /\bbath(?:room)?s?\b/,
          },
        ])
      : []),
  ];
  if (!pieces.length) return null;
  return pieceQuestion(
    'whole_home_demo',
    'Is demolition of existing finishes part of this bid?',
    pieces
  );
}

function existingStructurePrompt(text: string): ScopeFoundClarification | null {
  if (!notesLookLikeNewBuild(text) && !notesLookLikeAddition(text)) return null;
  if (
    !/\b(?:existing|old|current)\s+(?:house|home|garage|structure|building|dwelling)\b/i.test(
      text
    )
  ) {
    return null;
  }
  if (REMOVAL_NAMED.test(text) || /\b(?:keep|leave|remain(?:s|ing)?)\b/i.test(text)) {
    return null;
  }
  return pieceQuestion(
    'existing_structure',
    'Is an existing structure being removed?',
    piecesStillUnknown(text, [
      { id: 'house', label: 'House', subject: /\b(?:house|home)\b/ },
      { id: 'garage', label: 'Garage', subject: /\bgarages?\b/ },
    ])
  );
}

function quietTradeNote(text: string): boolean {
  return (
    notesLookLikeNewBuild(text) ||
    notesLookLikeAddition(text) ||
    notesLookLikeWholeHome(text)
  );
}

function otherTradeMention(text: string, allowed: RegExp): boolean {
  const stripped = text.replace(allowed, ' ');
  return /\b(?:kitchen|bath(?:room)?|shower|vanity|toilet|cabinets?|countertops?|flooring|lvp|roof(?:ing)?|shingles?|paint(?:ing)?|plumb(?:ing)?|electrical|hvac|drywall|sheetrock|fram(?:e|ing)|concrete|stucco|siding|insulat(?:e|ion)|landscap(?:e|ing)|sod|deck(?:ing)?|windows?|doors?|excavat(?:e|ion))\b/i.test(
    stripped
  );
}

function namesInstall(text: string): boolean {
  return (
    /\b(?:install|new|hang|pour|build|frame|excavat|lay|plant)\b/i.test(text) ||
    statedArea(text) != null
  );
}

type TradePiece = {
  id: string;
  label: string;
  subject: RegExp;
  reveal: string;
  line: ClarificationLine;
  area?: boolean;
};

type TradeDemo = {
  id: ScopeFoundClarificationId;
  question: string;
  matches: (text: string) => boolean;
  pieces: TradePiece[];
};

function demoLine(id: string, label: string, helper: string): ClarificationLine {
  return line(id, label, helper, 'demo');
}

const CLADDING_LINE = demoLine(
  'cladding_demo',
  'Exterior finish demo',
  'The existing exterior finish comes off before the new finish goes on.'
);
const HARDSCAPE_LINE = demoLine(
  'demo_removal',
  'Demo / removal',
  'The existing hardscape comes out before the new pour.'
);
const CLEARING_LINE = demoLine(
  'demo_clearing',
  'Landscape clearing',
  'Existing landscape comes out before the new landscape goes in.'
);
const PAVER_LINE = demoLine(
  'paver_demo',
  'Paver demolition / removal',
  'Existing pavers come out before the new work.'
);
const INSULATION_LINE = demoLine(
  'insulation_removal',
  'Insulation removal',
  'Existing insulation comes out before the new insulation goes in.'
);
const FRAMING_LINE = demoLine(
  'framing_demo',
  'Framing demo',
  'Existing framing comes out before the new framing goes in.'
);
const DRYWALL_LINE = demoLine(
  'demo_removal',
  'Drywall demo / removal',
  'Existing drywall comes out before the new drywall goes up.'
);
const DECK_LINE = demoLine(
  'demo_removal',
  'Deck demo / removal',
  'The existing deck comes out before the new deck goes in.'
);
const HVAC_LINE = demoLine(
  'hvac_demo',
  'HVAC demo',
  'Existing HVAC equipment comes out before the new equipment goes in.'
);
const PLUMBING_LINE = demoLine(
  'plumbing_demo',
  'Plumbing demo',
  'Existing plumbing comes out before the new plumbing goes in.'
);
const OPENING_LINE = demoLine(
  'opening_demo',
  'Opening demo',
  'Existing windows or doors come out before the new ones go in.'
);
const SITE_STRUCTURE_LINE = demoLine(
  'existing_structure_demo',
  'Remove existing structure',
  'An existing structure comes out before the excavation.'
);

const TRADE_DEMOS: TradeDemo[] = [
  {
    id: 'stucco_demo',
    question: 'Is existing exterior finish being removed?',
    matches: text =>
      !quietTradeNote(text) &&
      notesDescribeDedicatedStuccoJob(text) &&
      namesInstall(text),
    pieces: [
      { id: 'old_stucco', label: 'Stucco', subject: /\bstucco\b/, reveal: 'Remove stucco', line: CLADDING_LINE, area: true },
      { id: 'wood_siding', label: 'Wood siding', subject: /\bwood\s+siding\b/, reveal: 'Remove wood siding', line: CLADDING_LINE, area: true },
      { id: 'vinyl_siding', label: 'Vinyl siding', subject: /\bvinyl\s+siding\b/, reveal: 'Remove vinyl siding', line: CLADDING_LINE, area: true },
      { id: 'brick', label: 'Brick', subject: /\bbrick\b/, reveal: 'Remove brick', line: CLADDING_LINE, area: true },
      { id: 'fiber_cement', label: 'Fiber cement', subject: /\bfiber\s+cement\b|\bhardie\b/, reveal: 'Remove fiber cement', line: CLADDING_LINE, area: true },
    ],
  },
  {
    id: 'concrete_demo',
    question: 'Is existing hardscape being removed?',
    matches: text =>
      !quietTradeNote(text) &&
      /\b(?:concrete|driveway|sidewalk|flatwork)\b/i.test(text) &&
      namesInstall(text) &&
      !otherTradeMention(text, /\b(?:concrete|driveway|sidewalk|flatwork|patio|pour)\b/gi),
    pieces: [
      { id: 'concrete_slab', label: 'Concrete', subject: /\b(?:concrete|slab|driveway)\b/, reveal: 'Remove concrete', line: HARDSCAPE_LINE, area: true },
      { id: 'asphalt', label: 'Asphalt', subject: /\basphalt\b/, reveal: 'Remove asphalt', line: HARDSCAPE_LINE, area: true },
      { id: 'concrete_pavers', label: 'Pavers', subject: /\bpavers?\b/, reveal: 'Remove pavers', line: HARDSCAPE_LINE, area: true },
      { id: 'gravel', label: 'Gravel', subject: /\bgravel\b(?!\s+base)/, reveal: 'Remove gravel', line: HARDSCAPE_LINE, area: true },
    ],
  },
  {
    id: 'landscape_demo',
    question: 'Is existing landscape being removed?',
    matches: text =>
      !quietTradeNote(text) &&
      /\b(?:landscap(?:e|ing)|sod|mulch|irrigation|pavers?)\b/i.test(text) &&
      namesInstall(text) &&
      !otherTradeMention(text, /\b(?:landscap(?:e|ing)|sod|mulch|irrigation|pavers?|plants?|trees|lawn|yard)\b/gi),
    pieces: [
      { id: 'sod', label: 'Sod', subject: /\b(?:sod|lawn|grass)\b/, reveal: 'Remove sod', line: CLEARING_LINE, area: true },
      { id: 'landscape_rock', label: 'Rock', subject: /\brock\b/, reveal: 'Remove rock', line: CLEARING_LINE, area: true },
      { id: 'mulch', label: 'Mulch', subject: /\bmulch\b/, reveal: 'Remove mulch', line: CLEARING_LINE, area: true },
      { id: 'plants', label: 'Plants', subject: /\b(?:plants?|trees|shrubs?)\b/, reveal: 'Remove plants', line: CLEARING_LINE, area: true },
      { id: 'landscape_pavers', label: 'Pavers', subject: /\bpavers?\b/, reveal: 'Remove pavers', line: PAVER_LINE, area: true },
    ],
  },
  {
    id: 'insulation_demo',
    question: 'Is existing insulation being removed?',
    matches: text =>
      !quietTradeNote(text) &&
      notesDescribeDedicatedInsulationJob(text) &&
      namesInstall(text),
    pieces: [
      { id: 'batts', label: 'Batts', subject: /\bbatts?\b/, reveal: 'Remove batts', line: INSULATION_LINE, area: true },
      { id: 'blown', label: 'Blown-in', subject: /\bblown(?:[-\s]?in)?\b/, reveal: 'Remove blown-in', line: INSULATION_LINE, area: true },
      { id: 'spray_foam', label: 'Spray foam', subject: /\bspray\s+foam\b/, reveal: 'Remove spray foam', line: INSULATION_LINE, area: true },
    ],
  },
  {
    id: 'framing_demo',
    question: 'Is existing framing being removed?',
    matches: text =>
      !quietTradeNote(text) &&
      !notesNameFramingOnlyAddition(text) &&
      (notesNameDedicatedWallAreaFraming(text) || notesNameLinearFootStudWall(text)),
    pieces: [
      { id: 'interior_walls', label: 'Interior walls', subject: /\binterior\s+walls?\b|\bpartitions?\b/, reveal: 'Remove interior walls', line: FRAMING_LINE },
      { id: 'exterior_walls', label: 'Exterior walls', subject: /\bexterior\s+walls?\b/, reveal: 'Remove exterior walls', line: FRAMING_LINE },
    ],
  },
  {
    id: 'drywall_demo',
    question: 'Is existing drywall being removed?',
    matches: text =>
      !quietTradeNote(text) &&
      (notesDescribeDedicatedDrywallJob(text) || notesDescribeSheetrockFinishJob(text)) &&
      namesInstall(text),
    pieces: [
      { id: 'drywall_walls', label: 'Walls', subject: /\bwalls?\b/, reveal: 'Remove drywall walls', line: DRYWALL_LINE, area: true },
      { id: 'drywall_ceilings', label: 'Ceilings', subject: /\bceilings?\b/, reveal: 'Remove drywall ceilings', line: DRYWALL_LINE, area: true },
    ],
  },
  {
    id: 'deck_demo',
    question: 'Is an existing deck being removed?',
    matches: text =>
      !quietTradeNote(text) && notesDescribeDedicatedDeckJob(text) && namesInstall(text),
    pieces: [
      { id: 'deck_surface', label: 'Decking', subject: /\bdeck(?:ing)?\b/, reveal: 'Remove decking', line: DECK_LINE, area: true },
      { id: 'deck_railing', label: 'Railing', subject: /\b(?:railings?|guardrails?)\b/, reveal: 'Remove railing', line: DECK_LINE },
      { id: 'deck_stairs', label: 'Stairs', subject: /\b(?:stairs?|steps?)\b/, reveal: 'Remove stairs', line: DECK_LINE },
    ],
  },
  {
    id: 'hvac_demo',
    question: 'Is existing HVAC equipment being removed?',
    matches: text => !quietTradeNote(text) && notesNameDedicatedHvacEquipmentJob(text),
    pieces: [
      { id: 'hvac_furnace', label: 'Furnace', subject: /\bfurnaces?\b/, reveal: 'Remove furnace', line: HVAC_LINE },
      { id: 'hvac_condenser', label: 'Condenser', subject: /\bcondensers?\b/, reveal: 'Remove condenser', line: HVAC_LINE },
      { id: 'hvac_air_handler', label: 'Air handler', subject: /\bair\s+handlers?\b/, reveal: 'Remove air handler', line: HVAC_LINE },
      { id: 'hvac_ductwork', label: 'Ductwork', subject: /\bduct(?:work)?\b/, reveal: 'Remove ductwork', line: HVAC_LINE },
    ],
  },
  {
    id: 'electrical_demo',
    question: 'Is existing electrical being removed?',
    matches: text => {
      if (quietTradeNote(text) || kitchenInstallNote(text)) return false;
      // "Kitchen GFCI" names the room. It is not a second trade.
      const located = text.replace(/\bkitchen\b/gi, ' ');
      return (
        (notesDescribeDedicatedElectricalDeviceJob(text) ||
          (/\b(?:install|new|replace)\b/i.test(located) &&
            /\b(?:panel|recessed|outlets?|receptacles?|fixtures?|wiring|gfci)\b/i.test(
              located
            ))) &&
        !otherTradeMention(
          located,
          /\b(?:electrical|panel|recessed|outlets?|receptacles?|fixtures?|wiring|lights?|circuits?|switches?|gfci|amp(?:ere)?s?)\b/gi
        )
      );
    },
    pieces: [
      {
        id: 'electrical_panel',
        label: 'Panel',
        subject: /\bpanels?\b/,
        reveal: 'Remove panel',
        line: line(
          'electrical_panel_removal',
          'Remove panel',
          'The existing panel comes out. Make-safe only. Not a new panel.',
          'demo'
        ),
      },
      {
        id: 'electrical_fixtures',
        label: 'Fixtures',
        subject: /\b(?:fixtures?|recessed|lights?|outlets?|receptacles?)\b/,
        reveal: 'Remove fixtures',
        line: line(
          'electrical_fixture_removal',
          'Remove fixtures',
          'Existing light fixtures or fans come out. Cap / make-safe only.',
          'demo'
        ),
      },
      {
        id: 'electrical_wiring',
        label: 'Wiring',
        subject: /\bwiring\b/,
        reveal: 'Remove wiring',
        line: line(
          'electrical_abandoned_circuit',
          'Remove wiring',
          'Existing wiring is made safe. Not a new circuit.',
          'demo'
        ),
      },
    ],
  },
  {
    id: 'plumbing_demo',
    question: 'Is existing plumbing being removed?',
    matches: text =>
      !quietTradeNote(text) &&
      /\b(?:install|new|replace)\b/i.test(text) &&
      /\b(?:water\s+heaters?|tankless|repipes?|repipe)\b/i.test(text) &&
      !otherTradeMention(text, /\b(?:plumb(?:ing)?|water\s+heaters?|tankless|repipes?|repipe|fixtures?|piping)\b/gi),
    pieces: [
      { id: 'water_heater', label: 'Water heater', subject: /\bwater\s+heaters?\b|\btankless\b/, reveal: 'Remove water heater', line: PLUMBING_LINE },
      { id: 'plumbing_fixtures', label: 'Fixtures', subject: /\bfixtures?\b/, reveal: 'Remove plumbing fixtures', line: PLUMBING_LINE },
      { id: 'piping', label: 'Piping', subject: /\b(?:piping|repipes?|supply\s+lines?)\b/, reveal: 'Remove piping', line: PLUMBING_LINE },
    ],
  },
  {
    id: 'openings_demo',
    question: 'Are existing openings being removed?',
    matches: text =>
      !quietTradeNote(text) &&
      notesDescribeDedicatedWindowsDoorsJob(text) &&
      namesInstall(text),
    pieces: [
      { id: 'existing_windows', label: 'Windows', subject: /\bwindows?\b/, reveal: 'Remove windows', line: OPENING_LINE },
      { id: 'existing_exterior_doors', label: 'Exterior doors', subject: /\b(?:exterior|entry)\s+doors?\b/, reveal: 'Remove exterior doors', line: OPENING_LINE },
      { id: 'existing_interior_doors', label: 'Interior doors', subject: /\binterior\s+doors?\b/, reveal: 'Remove interior doors', line: OPENING_LINE },
      { id: 'existing_sliding_doors', label: 'Sliding doors', subject: /\b(?:sliding|patio)\s+doors?\b/, reveal: 'Remove sliding doors', line: OPENING_LINE },
      { id: 'existing_garage_doors', label: 'Garage doors', subject: /\bgarage\s+doors?\b/, reveal: 'Remove garage doors', line: OPENING_LINE },
    ],
  },
  {
    id: 'excavation_demo',
    question: 'Is existing site material being removed?',
    matches: text =>
      !quietTradeNote(text) &&
      /\b(?:excavat(?:e|ion|ing)|trench(?:ing)?)\b/i.test(text) &&
      !otherTradeMention(text, /\b(?:excavat(?:e|ion|ing)|trench(?:ing)?|grading|backfill|haul[-\s]?off)\b/gi),
    pieces: [
      { id: 'site_trees', label: 'Trees', subject: /\btrees?\b/, reveal: 'Remove trees', line: CLEARING_LINE, area: true },
      { id: 'site_brush', label: 'Brush', subject: /\b(?:brush|vegetation)\b/, reveal: 'Remove brush', line: CLEARING_LINE, area: true },
      { id: 'site_concrete', label: 'Concrete', subject: /\bconcrete\b/, reveal: 'Remove concrete', line: HARDSCAPE_LINE, area: true },
      { id: 'site_structure', label: 'Structures', subject: /\b(?:structures?|buildings?)\b/, reveal: 'Remove existing structure', line: SITE_STRUCTURE_LINE },
    ],
  },
];

const TRADE_PIECE_BY_ID = new Map(
  TRADE_DEMOS.flatMap(trade => trade.pieces.map(piece => [piece.id, piece] as const))
);
for (const pieceId of TRADE_PIECE_BY_ID.keys()) PIECE_IDS.add(pieceId);

function tradeForText(text: string): TradeDemo | null {
  return TRADE_DEMOS.find(trade => trade.matches(text)) || null;
}

function notesNameExistingExcavationStructure(text: string): boolean {
  return /\b(?:existing|old|current|standing)\s+(?:house|home|garage|building|structures?)\b/i.test(
    text
  ) || /\b(?:remove|demo(?:lish|lition)?|tear[\s-]?out)\b[^.;]{0,60}\b(?:house|home|garage|building|structures?)\b/i.test(
    text
  );
}

function scopeFoundPiecesForNote(
  text: string,
  id: ScopeFoundClarificationId | null,
  pieces: string[]
): string[] {
  if (id === 'excavation_demo' && !notesNameExistingExcavationStructure(text)) {
    return pieces.filter(piece => piece !== 'site_structure');
  }
  if (
    (id === 'kitchen_demo' || id === 'whole_home_demo') &&
    subjectByOthers(text, /\b(?:flooring|lvp|vinyl|laminate|carpet|floors?)\b/)
  ) {
    return pieces.filter(piece => piece !== 'kitchen_floor' && piece !== 'flooring');
  }
  return pieces;
}

function tradePrompt(text: string): ScopeFoundClarification | null {
  const trade = tradeForText(text);
  if (!trade) return null;
  if (REMOVAL_NAMED.test(text) && !/\b(?:install|new|replace)\b/i.test(text)) {
    return null;
  }
  const unknown = piecesStillUnknown(text, trade.pieces);
  let pieces = unknown;
  // "Replace the stucco" names the new finish. The old layer can still be stucco.
  if (trade.id === 'stucco_demo') {
    const stuccoPiece = trade.pieces.find(piece => piece.id === 'old_stucco');
    if (stuccoPiece && !pieces.some(piece => piece.id === 'old_stucco')) {
      pieces = [stuccoPiece, ...pieces];
    }
  }
  const namedSome = pieces.length < trade.pieces.length;
  if (
    trade.id === 'excavation_demo' &&
    !notesNameExistingExcavationStructure(text)
  ) {
    pieces = pieces.filter(piece => piece.id !== 'site_structure');
  }
  // A panel or service upgrade already replaces that panel.
  if (
    trade.id === 'electrical_demo' &&
    notesReplaceElectricalPanel(text)
  ) {
    pieces = pieces.filter(piece => piece.id !== 'electrical_panel');
  }
  let question = trade.question;
  if (trade.id === 'plumbing_demo') {
    pieces = plumbingDemoPiecesForNote(text, pieces);
    if (pieces.length === 1 && pieces[0].id === 'water_heater') {
      question = 'Is the existing water heater being removed?';
    }
  }
  if (!pieces.length) return null;
  return pieceQuestion(
    trade.id,
    namedSome ? 'Any other removal?' : question,
    pieces
  );
}

/** A heater note asks about the heater. A repipe asks about piping. */
function plumbingDemoPiecesForNote<T extends { id: string }>(
  text: string,
  pieces: T[]
): T[] {
  const namesHeater = /\b(?:water\s+heaters?|tankless)\b/i.test(text);
  const namesPiping = /\b(?:piping|repipes?|repipe|supply\s+lines?)\b/i.test(text);
  const namesFixtures = /\bfixtures?\b/i.test(text);
  const broaderJob =
    /\b(?:remodels?|renovations?|fixtures?|repipes?|repipe|rough[-\s]?in|toilets?|vanit(?:y|ies)|sinks?|faucets?|showers?|tubs?|kitchens?|bathrooms?|baths?)\b/i.test(
      text
    ) || /\bnew\s+(?:build|construction|home)\b|\bground[\s-]?up\b/i.test(text);
  if (namesHeater && !broaderJob && !namesPiping) {
    return pieces.filter(piece => piece.id === 'water_heater');
  }
  return pieces.filter(piece => {
    if (piece.id === 'water_heater') return namesHeater;
    if (piece.id === 'piping') return namesPiping;
    if (piece.id === 'plumbing_fixtures') return namesFixtures;
    return false;
  });
}

function notesReplaceElectricalPanel(text: string): boolean {
  if (/\bno\s+(?:panel|service)\s+upgrade\b/i.test(text)) return false;
  return /\b(?:panel|service)\s+upgrades?\b|\bupgrade(?:s|d)?\b[^.]{0,48}\b(?:panel|service)\b|\b(?:panel|service)\b[^.]{0,48}\bupgrade\b/i.test(
    text
  );
}

function replacementDemoLines(text: string): ClarificationLine[] {
  if (flooringReplaceIncludesRemoval(text)) return [flooringDemoLine(text)];
  const trade = tradeForText(text);
  if (!trade || !/\breplace(?:ment)?\b/i.test(text) || REMOVAL_NAMED.test(text)) return [];
  const seen = new Set<string>();
  return trade.pieces.flatMap(piece => {
    if (seen.has(piece.line.id)) return [];
    seen.add(piece.line.id);
    return [piece.line];
  });
}

type RemodelPhase = {
  id: string;
  label: string;
  /** Work the note already put on the bid, or named as out. */
  named: RegExp;
  line: ClarificationLine;
};

const REMODEL_PHASES = {
  demo: {
    id: 'remodel_demo',
    label: 'Demo',
    named: REMOVAL_NAMED,
    line: line(
      'floor_demo',
      'Demo',
      'Existing work that comes out. Enter the area.',
      'demo'
    ),
  },
  paint: {
    id: 'remodel_paint',
    label: 'Paint',
    named: /\bpaint(?:ing)?\b/i,
    line: line('interior_paint', 'Paint', 'Paint for this remodel. Enter the area.', 'paint'),
  },
  insulation: {
    id: 'remodel_insulation',
    label: 'Insulation',
    named: /\binsulat(?:e|ion|ing)\b/i,
    line: line(
      'insulation',
      'Insulation',
      'Insulation for this remodel. Enter the area.',
      'insulation'
    ),
  },
  electrical: {
    id: 'remodel_electrical',
    label: 'Electrical',
    named: /\b(?:electrical|wiring|outlets?|receptacles?|recessed|panel)\b/i,
    line: line(
      'electrical_rough',
      'Electrical',
      'Electrical work for this remodel.',
      'electrical'
    ),
  },
  framing: {
    id: 'remodel_framing',
    label: 'Framing',
    named: /\b(?:frame|framing|framed)\b/i,
    line: line(
      'wall_framing',
      'Framing',
      'Interior framing for this remodel. Enter the area.',
      'framing'
    ),
  },
  trim: {
    id: 'remodel_trim',
    label: 'Trim',
    named: /\b(?:trim|baseboards?)\b/i,
    line: line(
      'interior_trim',
      'Trim',
      'Trim for this remodel. Enter the length.',
      'trim'
    ),
  },
  bathroom: {
    id: 'remodel_bathroom',
    label: 'Bathroom',
    named: /\b(?:bath(?:room)?s?|toilet|vanity|shower|tub)\b/i,
    line: line(
      'bathroom_updates',
      'Bathroom',
      'Bathroom work for this remodel.',
      'bathroom'
    ),
  },
  flooring: {
    id: 'remodel_flooring',
    label: 'Flooring',
    named: /\b(?:flooring|lvp|vinyl|carpet|laminate|hardwood|tile)\b/i,
    line: line(
      'flooring',
      'Flooring',
      'Flooring for this remodel. Enter the area.',
      'flooring'
    ),
  },
  hvac: {
    id: 'remodel_hvac',
    label: 'HVAC',
    named: /\bhvac\b|\bmini\s*split\b/i,
    line: line('hvac', 'HVAC', 'HVAC for this remodel.', 'hvac'),
  },
  drywall: {
    id: 'remodel_drywall',
    label: 'Drywall',
    named: /\b(?:drywall|sheetrock|gypsum)\b|\bhang\s+and\s+finish\b/i,
    line: line(
      'drywall',
      'Drywall',
      'Drywall for this remodel. Enter the area.',
      'drywall'
    ),
  },
  doors: {
    id: 'remodel_doors',
    label: 'Doors',
    named: /\bdoors?\b/i,
    line: line(
      'interior_doors',
      'Doors',
      'Doors for this remodel. Enter the count.',
      'openings'
    ),
  },
  kitchen: {
    id: 'remodel_kitchen',
    label: 'Kitchen',
    named: /\bkitchen\b/i,
    line: line('kitchen_updates', 'Kitchen', 'Kitchen work for this remodel.', 'kitchen'),
  },
  roofing: {
    id: 'remodel_roofing',
    label: 'Roofing',
    named: /\broof(?:ing)?\b|\bshingles?\b/i,
    line: line('roofing', 'Roofing', 'Roofing for this remodel.', 'roofing'),
  },
  tile: {
    id: 'remodel_tile',
    label: 'Tile',
    named: /\btile\b/i,
    line: line('tile', 'Tile', 'Tile for this remodel. Enter the area.', 'tile'),
  },
  vanity: {
    id: 'remodel_vanity',
    label: 'Vanity',
    named: /\bvanit(?:y|ies)\b/i,
    line: line('vanity', 'Vanity', 'Vanity for this bathroom remodel.', 'bathroom'),
  },
  toilet: {
    id: 'remodel_toilet',
    label: 'Toilet',
    named: /\btoilets?\b/i,
    line: line('toilet', 'Toilet', 'Toilet for this bathroom remodel.', 'bathroom'),
  },
  plumbing: {
    id: 'remodel_plumbing',
    label: 'Plumbing',
    named: /\bplumb(?:ing)?\b/i,
    line: line(
      'plumbing_rough',
      'Plumbing',
      'Plumbing for this remodel.',
      'plumbing'
    ),
  },
  appliances: {
    id: 'remodel_appliances',
    label: 'Appliances',
    named: /\bappliances?\b/i,
    line: line(
      'appliances',
      'Appliances',
      'Appliances for this kitchen remodel.',
      'kitchen'
    ),
  },
  landscaping: {
    id: 'remodel_landscaping',
    label: 'Landscaping',
    named: /\b(?:landscap(?:e|ing)|sod|pavers?)\b/i,
    line: line(
      'landscaping',
      'Landscaping',
      'Landscaping for this remodel.',
      'site'
    ),
  },
  concrete: {
    id: 'remodel_concrete',
    label: 'Concrete',
    named: /\b(?:concrete|driveway|sidewalk|patio)\b/i,
    line: line('concrete', 'Concrete', 'Concrete for this remodel.', 'structure'),
  },
} as const satisfies Record<string, RemodelPhase>;

const REMODEL_LINE_BY_PIECE = new Map<string, ClarificationLine>(
  Object.values(REMODEL_PHASES).map(phase => [phase.id, phase.line])
);

for (const phase of Object.values(REMODEL_PHASES)) PIECE_IDS.add(phase.id);

const GARAGE_HANG_PIECE = {
  hang_only: 'garage_drywall_hang_only',
  hang_and_finish: 'garage_drywall_hang_finish',
  unsure: 'garage_drywall_hang_unsure',
} as const;
const GARAGE_HANG_PIECES = new Set<string>(Object.values(GARAGE_HANG_PIECE));
for (const id of GARAGE_HANG_PIECES) PIECE_IDS.add(id);
const GARAGE_NO_ADDITIONAL = 'garage_no_additional_work';
PIECE_IDS.add(GARAGE_NO_ADDITIONAL);

export type GarageDrywallHangChoice = keyof typeof GARAGE_HANG_PIECE;

export function garageDrywallHangChoice(
  pieces: readonly string[] | null | undefined
): GarageDrywallHangChoice | null {
  const selected = new Set(pieces || []);
  if (selected.has(GARAGE_HANG_PIECE.hang_only)) return 'hang_only';
  if (selected.has(GARAGE_HANG_PIECE.hang_and_finish)) return 'hang_and_finish';
  if (selected.has(GARAGE_HANG_PIECE.unsure)) return 'unsure';
  return null;
}

export function withGarageDrywallHangChoice(
  pieces: readonly string[],
  choice: GarageDrywallHangChoice
): string[] {
  return [...pieces.filter(id => !GARAGE_HANG_PIECES.has(id)), GARAGE_HANG_PIECE[choice]];
}

export function garageNoAdditionalWork(pieces: readonly string[]): string[] {
  return [...pieces.filter(id => GARAGE_HANG_PIECES.has(id)), GARAGE_NO_ADDITIONAL];
}

/** Garage Scope Found assistant. Other remodels keep the chip grid. */
function scopeAssistantIntro(question: string): string {
  if (/\bgarage\b/i.test(question)) {
    return 'For this garage conversion, add work the note did not name.';
  }
  if (/\bbathroom\b/i.test(question)) {
    return 'For this bathroom remodel, add work the note did not name.';
  }
  if (/\bkitchen\b/i.test(question)) {
    return 'For this kitchen remodel, add work the note did not name.';
  }
  if (/\bconversion\b/i.test(question)) {
    return 'For this conversion, add work the note did not name.';
  }
  return 'For this remodel, add work the note did not name.';
}

/** Short Scope Found list for any remodel note, not only a garage conversion. */
export function garageScopeAssistant(notes: string | null | undefined): {
  hangQuestion: string | null;
  intro: string;
  suggestions: Array<{ id: string; label: string }>;
  more: Array<{ id: string; label: string }>;
} | null {
  const text = noteText(notes);
  const pack = remodelRemainderPackage(text);
  if (!pack) return null;
  const hangQuestion =
    /\bhang\b/i.test(text) &&
    /\b(?:drywall|sheetrock|gypsum)\b/i.test(text) &&
    !/\b(?:tape|mud|finish|texture)\b/i.test(text)
      ? 'The note says hang drywall. Include taping and finishing?'
      : null;
  const open = openRemodelPhases(text, pack.phases).map(phase => ({
    id: phase.id,
    label: phase.label,
  }));
  return {
    hangQuestion,
    intro: scopeAssistantIntro(pack.question),
    suggestions: open.slice(0, 4),
    more: open.slice(4),
  };
}

export function toggleGarageSuggestionPiece(
  pieces: readonly string[],
  pieceId: string
): string[] {
  const turningOff = pieces.includes(pieceId);
  const next = toggleRemodelScopePiece(pieces, pieceId).filter(
    id => id !== GARAGE_NO_ADDITIONAL
  );
  if (turningOff) return next;
  if (pieceId === 'remodel_plumbing' || pieceId === 'remodel_electrical') {
    return declineRemodelExtent(next, pieceId);
  }
  return next;
}

export const FRAMING_SHEATHING_PIECE = 'framing_sheathing';

/** Framing notes can add sheathing from a button. The note did not name it. */
export function notesOfferFramingSheathingChip(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return notesNameFramingOnlyAddition(text) || notesNameUnmeasuredWallFraming(text);
}

const TYPED_SCOPE_MEASURE: Record<string, { key: string; unit: 'sqft' | 'lf' }> = {
  framing_sheathing: { key: 'sheathingSqft', unit: 'sqft' },
  remodel_demo: { key: 'floorDemoSqft', unit: 'sqft' },
  remodel_paint: { key: 'wallPaintSqft', unit: 'sqft' },
  remodel_framing: { key: 'wallFramingSqft', unit: 'sqft' },
  remodel_trim: { key: 'baseboardLf', unit: 'lf' },
  remodel_flooring: { key: 'flooringSqft', unit: 'sqft' },
  remodel_drywall: { key: 'drywallSqft', unit: 'sqft' },
};

function typedScopeMeasure(clause: string, unit: 'sqft' | 'lf'): string | null {
  const match = clause.match(
    unit === 'sqft'
      ? /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))/i
      : /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|lin(?:ear)?\.?\s*(?:ft|feet)|linear\s+feet)/i
  );
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return value > 0 ? String(value) : null;
}

/** Quantity typed with an added trade, such as 600 sqft of flooring. */
export function typedRemainderQuantity(
  piece: string,
  measurements?: object | null
): string {
  const spec = TYPED_SCOPE_MEASURE[piece];
  if (!spec || !measurements) return '';
  const raw = (measurements as Record<string, unknown>)[spec.key];
  const value = Number(String(raw ?? '').replace(/,/g, ''));
  if (!(value > 0)) return '';
  return `${value.toLocaleString('en-US')} ${spec.unit}`;
}

function measurementsNameBaseboard(
  measurements?: {
    typedTrimLabel?: unknown;
    typedScopeAddendum?: unknown;
  } | null
): boolean {
  if (String(measurements?.typedTrimLabel || '') === 'Baseboard') return true;
  return /\bbaseboards?\b|\bbase\s*board\b/i.test(
    String(measurements?.typedScopeAddendum || '')
  );
}

/** Maps a typed addition onto catalog pieces. A stated count or area is kept. */
export function garageScopeTextAdditions(text: string, notes?: string | null): {
  pieceIds: string[];
  counts: Record<string, string>;
  matched: boolean;
} {
  const sentence = text.trim();
  if (!sentence) return { pieceIds: [], counts: {}, matched: false };
  const clauses = sentence
    .split(/[.;\n]+|\s+\band\b\s+/i)
    .map(part => part.trim())
    .filter(Boolean);
  const packagePhases =
    remodelRemainderPackage(noteText(notes))?.phases ?? CONVERSION_PHASES;
  const phases = [...packagePhases];
  for (const phase of Object.values(REMODEL_PHASES)) {
    if (!TYPED_SCOPE_MEASURE[phase.id]) continue;
    if (phases.some(item => item.id === phase.id)) continue;
    phases.push(phase);
  }
  const pieceIds: string[] = [];
  const counts: Record<string, string> = {};
  if (notesOfferFramingSheathingChip(notes)) {
    for (const clause of clauses) {
      if (!/\b(?:structural\s+)?sheathing\b/i.test(clause)) continue;
      pieceIds.push(FRAMING_SHEATHING_PIECE);
      const quantity = typedScopeMeasure(clause, 'sqft');
      if (quantity) counts.sheathingSqft = quantity;
    }
  }
  for (const phase of phases) {
    const clause = clauses.find(part => phase.named.test(part));
    if (!clause) continue;
    pieceIds.push(phase.id);
    const measure = TYPED_SCOPE_MEASURE[phase.id];
    if (measure) {
      const quantity = typedScopeMeasure(clause, measure.unit) || typedScopeMeasure(sentence, measure.unit);
      if (quantity) counts[measure.key] = quantity;
    }
    if (phase.id === 'remodel_plumbing') pieceIds.push(extentUnsureId(phase.id));
    if (phase.id === 'remodel_electrical') {
      const outlets = clause.match(/(\d+)\s*(?:outlets?|receptacles?)\b/i);
      if (outlets && Number(outlets[1]) > 0) {
        pieceIds.push('extent_electrical_receptacles');
        counts.standardReceptacleCount = String(Number(outlets[1]));
      } else {
        pieceIds.push(extentUnsureId(phase.id));
      }
    }
  }
  if (pieceIds.includes('remodel_trim') && /\bbaseboards?\b/i.test(sentence)) {
    const wantsDemo = /\b(?:demo|demolition|remove|removal|tear[\s-]?out|pull)\b/i.test(sentence);
    const wantsInstall = /\b(?:install|replace|new)\b/i.test(sentence) || !wantsDemo;
    counts.typedTrimLabel = 'Baseboard';
    counts.typedBaseboardInstall = wantsInstall ? '1' : '0';
    counts.typedScopeAddendum = sentence;
    if (wantsDemo) {
      const length = counts.baseboardLf || typedScopeMeasure(sentence, 'lf');
      if (length) counts.baseboardDemoLf = length;
    }
  }
  return { pieceIds, counts, matched: pieceIds.length > 0 };
}

/** Option ids a typed sentence names on a non-remodel Scope Found question. */
export function matchScopeOptionText(
  text: string,
  options: ReadonlyArray<{ id: string; label: string }>
): string[] {
  const sentence = text.trim().toLowerCase();
  if (!sentence) return [];
  return options
    .filter(option => option.id !== 'none' && option.id !== 'unsure')
    .filter(option => {
      const label = option.label.toLowerCase();
      if (sentence.includes(label)) return true;
      return label
        .split(/[^a-z0-9]+/)
        .filter(word => word.length > 3)
        .some(word => sentence.includes(word));
    })
    .map(option => option.id);
}

const CONVERSION_PHASES: RemodelPhase[] = [
  REMODEL_PHASES.demo,
  REMODEL_PHASES.paint,
  REMODEL_PHASES.insulation,
  REMODEL_PHASES.electrical,
  REMODEL_PHASES.framing,
  REMODEL_PHASES.trim,
  REMODEL_PHASES.bathroom,
  REMODEL_PHASES.plumbing,
  REMODEL_PHASES.flooring,
  REMODEL_PHASES.hvac,
];

const ROOM_PHASES: RemodelPhase[] = [
  REMODEL_PHASES.demo,
  REMODEL_PHASES.paint,
  REMODEL_PHASES.flooring,
  REMODEL_PHASES.drywall,
  REMODEL_PHASES.trim,
  REMODEL_PHASES.electrical,
  REMODEL_PHASES.insulation,
  REMODEL_PHASES.doors,
];

const BATHROOM_PHASES: RemodelPhase[] = [
  REMODEL_PHASES.demo,
  REMODEL_PHASES.flooring,
  REMODEL_PHASES.paint,
  REMODEL_PHASES.tile,
  REMODEL_PHASES.vanity,
  REMODEL_PHASES.toilet,
  REMODEL_PHASES.electrical,
];

const KITCHEN_PHASES: RemodelPhase[] = [
  REMODEL_PHASES.demo,
  REMODEL_PHASES.paint,
  REMODEL_PHASES.electrical,
  REMODEL_PHASES.appliances,
  REMODEL_PHASES.flooring,
  REMODEL_PHASES.plumbing,
];

const WHOLE_HOME_PHASES: RemodelPhase[] = [
  REMODEL_PHASES.demo,
  REMODEL_PHASES.kitchen,
  REMODEL_PHASES.bathroom,
  REMODEL_PHASES.flooring,
  REMODEL_PHASES.paint,
  REMODEL_PHASES.electrical,
  REMODEL_PHASES.hvac,
  REMODEL_PHASES.roofing,
  REMODEL_PHASES.drywall,
  REMODEL_PHASES.landscaping,
  REMODEL_PHASES.concrete,
];

function affirmativeRemodelText(text: string): string {
  return text
    .split(/[.;\n]+/)
    .map(clause => clause.trim())
    .filter(
      clause =>
        clause &&
        !/^(?:no|not|without|do not|don't|dont|never)\b/i.test(clause)
    )
    .join('. ');
}

function openRemodelPhases(text: string, phases: RemodelPhase[]): RemodelPhase[] {
  const affirmative = affirmativeRemodelText(text);
  return phases.filter(phase => {
    if (noteMentionIsOnlyNegated(text, phase.named)) return false;
    if (subjectByOthers(text, phase.named)) return false;
    return !phase.named.test(affirmative);
  });
}

function remodelRemainderPackage(
  text: string
): { question: string; phases: RemodelPhase[] } | null {
  if (!text || notesLookLikeNewBuild(text) || notesNameFramingOnlyAddition(text)) {
    return null;
  }
  if (
    /\bgarage\s+conversion\b/i.test(text) ||
    /\bconvert(?:ing)?\s+(?:the\s+)?(?:\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet)|[-\s]?car)\s+)?garage\b/i.test(
      text
    )
  ) {
    return {
      question: 'Anything else in this garage conversion?',
      phases: CONVERSION_PHASES,
    };
  }
  if (
    /\b(?:basement|attic|bonus\s+room)\s+conversion\b/i.test(text) ||
    /\bconvert(?:ing)?\s+(?:the\s+)?(?:basement|attic|bonus\s+room)\b/i.test(text)
  ) {
    return { question: 'Anything else in this conversion?', phases: CONVERSION_PHASES };
  }
  if (/\bbath(?:room)?\s+remodel\b|\bremodel(?:ing)?\s+(?:the\s+)?bath(?:room)?\b/i.test(text)) {
    return {
      question: 'Anything else in this bathroom remodel?',
      phases: BATHROOM_PHASES,
    };
  }
  if (/\bkitchen\s+remodel\b|\bremodel(?:ing)?\s+(?:the\s+)?kitchen\b/i.test(text)) {
    return {
      question: 'Anything else in this kitchen remodel?',
      phases: KITCHEN_PHASES,
    };
  }
  if (notesLookLikeWholeHome(text)) {
    return { question: 'Anything else in this remodel?', phases: WHOLE_HOME_PHASES };
  }
  if (/\b(?:remodels?|renovat(?:e|ion|ing))\b/i.test(text)) {
    return { question: 'Anything else in this remodel?', phases: ROOM_PHASES };
  }
  return null;
}

/** Phases a remodel note left unnamed. Named work and explicit exclusions stay off the chips. */
function remodelRemainderPrompt(text: string): ScopeFoundClarification | null {
  const pack = remodelRemainderPackage(text);
  if (!pack) return null;
  const phases = openRemodelPhases(text, pack.phases);
  if (!phases.length) return null;
  return pieceQuestion(
    'remodel_remainder',
    pack.question,
    phases.map(phase => ({ id: phase.id, label: phase.label })),
    'No'
  );
}

export type RemodelRemainderMeasurement = {
  pieceId: string;
  key: QuickMeasurementFieldKey;
  label: string;
  /** Trade header on Confirm Scope when one chip opens several boxes. */
  group?: string;
  /** Shown for Not sure. A blank box is not a missing quantity. */
  optional?: boolean;
};

const REMODEL_REMAINDER_MEASUREMENTS: RemodelRemainderMeasurement[] = [
  { pieceId: 'remodel_demo', key: 'floorDemoSqft', label: 'Flooring demo' },
  { pieceId: 'remodel_paint', key: 'wallPaintSqft', label: 'Paint' },
  { pieceId: 'remodel_framing', key: 'wallFramingSqft', label: 'Framing' },
  { pieceId: 'remodel_trim', key: 'baseboardLf', label: 'Trim' },
  { pieceId: 'remodel_flooring', key: 'flooringSqft', label: 'Flooring' },
  { pieceId: 'remodel_drywall', key: 'drywallSqft', label: 'Drywall' },
];

type RemodelExtentField = { key: QuickMeasurementFieldKey; label: string };

type RemodelExtent = {
  id: string;
  label: string;
  fields: RemodelExtentField[];
  /** Cards this part puts on the bid in place of the trade's general line. */
  lines?: ClarificationLine[];
  /** Confirm Scope header when one chip asks more than one question. */
  group?: string;
};

type RemodelExtentQuestion = {
  id: string;
  label: string;
  question: string;
  /** Extra exclusive chip. Not sure is always available. */
  declineLabel?: string;
  extents: RemodelExtent[];
};

type RemodelExtentParent = {
  id: string;
  question: string;
  extents: RemodelExtent[];
  questions?: RemodelExtentQuestion[];
};

/**
 * Trades whose Confirm Scope layout is a whole takeoff. Tapping the chip asks
 * which part is in the bid, and only that part gets a measurement box.
 */
const REMODEL_EXTENT_PARENTS: RemodelExtentParent[] = [
  {
    id: 'remodel_electrical',
    question: 'What electrical?',
    extents: [
      {
        id: 'extent_electrical_panel',
        label: 'Panel',
        fields: [{ key: 'mainPanelCount', label: 'Panel' }],
        lines: [line('electrical_main_panel', 'Main panel', 'New main panel.', 'electrical')],
      },
      {
        id: 'extent_electrical_circuits',
        label: 'Circuits',
        fields: [{ key: 'dedicated20aCircuitCount', label: 'Circuits' }],
        lines: [
          line('electrical_dedicated_20a', 'Dedicated 20A circuits', 'New circuits.', 'electrical'),
        ],
      },
      {
        id: 'extent_electrical_receptacles',
        label: 'Receptacles',
        fields: [
          { key: 'standardReceptacleCount', label: 'Receptacles' },
          { key: 'gfciReceptacleCount', label: 'GFCI receptacles' },
        ],
        lines: [
          line('electrical_standard_receptacle', 'Receptacles', 'Standard receptacles.', 'electrical'),
          line('electrical_gfci_receptacle', 'GFCI receptacles', 'GFCI receptacles.', 'electrical'),
        ],
      },
      {
        id: 'extent_electrical_switches',
        label: 'Switches',
        fields: [{ key: 'singlePoleSwitchCount', label: 'Switches' }],
        lines: [
          line('electrical_single_pole_switch', 'Switches', 'Single-pole switches.', 'electrical'),
        ],
      },
      {
        id: 'extent_electrical_lighting',
        label: 'Lighting',
        fields: [{ key: 'recessedLightCount', label: 'Lighting' }],
        lines: [line('electrical_recessed_light', 'Lighting', 'Recessed lights.', 'electrical')],
      },
    ],
  },
  {
    id: 'remodel_bathroom',
    question: "What's coming out?",
    extents: [],
    questions: [
      {
        id: 'remodel_bathroom_out',
        label: 'Coming out',
        question: "What's coming out?",
        declineLabel: 'No',
        extents: [
          {
            id: 'extent_bath_out_tub',
            label: 'Tub',
            group: 'Coming out',
            fields: [],
            lines: [line('tub_demo', 'Remove tub', 'The existing tub comes out. Count is 1.', 'demo')],
          },
          {
            id: 'extent_bath_out_prefab_pan',
            label: 'Prefab pan',
            group: 'Coming out',
            fields: [],
            lines: [
              line(
                'shower_floor_demo',
                'Remove prefab pan',
                'The existing prefab shower pan comes out. Count is 1.',
                'demo'
              ),
            ],
          },
          {
            id: 'extent_bath_out_tile_pan',
            label: 'Tile pan',
            group: 'Coming out',
            fields: [{ key: 'demoTilePanSqft', label: 'Tile pan' }],
            lines: [
              line(
                'shower_floor_demo__tile_pan',
                'Remove tile pan',
                'The existing tile shower pan comes out. The area stays blank until it is measured.',
                'demo'
              ),
            ],
          },
          {
            id: 'extent_bath_out_wall_tile',
            label: 'Wall tile',
            group: 'Coming out',
            fields: [{ key: 'wallDemoSqft', label: 'Shower wall demo' }],
            lines: [
              line(
                'wall_demo',
                'Demo shower walls',
                'The existing shower walls come out. Enter the area.',
                'demo'
              ),
            ],
          },
          {
            id: 'extent_bath_out_enclosure',
            label: 'Prefab enclosure',
            group: 'Coming out',
            fields: [],
            lines: [
              line(
                'shower_enclosure_demo',
                'Remove prefab enclosure',
                'The existing prefab enclosure comes out. Count is 1.',
                'demo'
              ),
            ],
          },
          {
            id: 'extent_bath_out_door',
            label: 'Shower door',
            group: 'Coming out',
            fields: [],
            lines: [
              line(
                'glass_door_demo',
                'Remove shower door',
                'The existing shower door comes out. Count is 1.',
                'demo'
              ),
            ],
          },
          {
            id: 'extent_bath_out_toilet',
            label: 'Toilet',
            group: 'Coming out',
            fields: [],
            lines: [
              line('toilet_demo', 'Remove toilet', 'The existing toilet comes out. Count is 1.', 'demo'),
            ],
          },
          {
            id: 'extent_bath_out_vanity',
            label: 'Vanity',
            group: 'Coming out',
            fields: [],
            lines: [
              line('vanity_demo', 'Remove vanity', 'The existing vanity comes out. Count is 1.', 'demo'),
            ],
          },
          {
            id: 'extent_bath_out_floor',
            label: 'Bath floor',
            group: 'Coming out',
            fields: [{ key: 'bathroomFloorSqft', label: 'Bath floor demo' }],
            lines: [
              line(
                'floor_demo',
                'Demo bath floor',
                'The existing bathroom floor comes out. The area stays blank until it is measured.',
                'demo'
              ),
            ],
          },
        ],
      },
      {
        id: 'remodel_bathroom_in',
        label: 'Going in',
        question: "What's going in?",
        declineLabel: 'No',
        extents: [
          {
            id: 'extent_bath_in_tub',
            label: 'Tub',
            group: 'Going in',
            fields: [],
            lines: [line('tub_install', 'Tub install', 'The new tub. Count is 1.', 'bathroom')],
          },
          {
            id: 'extent_bath_in_prefab_pan',
            label: 'Prefab pan',
            group: 'Going in',
            fields: [],
            lines: [
              line(
                'prefab_shower_pan',
                'Prefab shower pan',
                'The new prefab shower pan. Count is 1.',
                'bathroom'
              ),
            ],
          },
          {
            id: 'extent_bath_in_tile_pan',
            label: 'Tile pan',
            group: 'Going in',
            fields: [{ key: 'showerFloorTileSqft', label: 'Tile pan' }],
            lines: [
              line(
                'shower_pan',
                'Build shower pan',
                'The new tile shower pan. The area stays blank until it is measured.',
                'bathroom'
              ),
            ],
          },
          {
            id: 'extent_bath_in_wall_tile',
            label: 'Wall tile',
            group: 'Going in',
            fields: [{ key: 'showerWallTileSqft', label: 'Wall tile' }],
            lines: [
              line(
                'shower_tile',
                'Install shower tile',
                'The new shower wall tile. The area stays blank until it is measured.',
                'shower'
              ),
            ],
          },
          {
            id: 'extent_bath_in_enclosure',
            label: 'Prefab enclosure',
            group: 'Going in',
            fields: [],
            lines: [
              line(
                'prefab_shower_enclosure',
                'Prefab shower enclosure',
                'The new prefab enclosure. Count is 1.',
                'bathroom'
              ),
            ],
          },
          {
            id: 'extent_bath_in_door',
            label: 'Shower door',
            group: 'Going in',
            fields: [],
            lines: [
              line('glass_door', 'Shower door', 'The new shower door. Count is 1.', 'bathroom'),
            ],
          },
          {
            id: 'extent_bathroom_toilet',
            label: 'Toilet',
            group: 'Going in',
            fields: [],
            lines: [line('toilet', 'Toilet', 'Toilet for this bathroom. Count is 1.', 'bathroom')],
          },
          {
            id: 'extent_bathroom_vanity',
            label: 'Vanity',
            group: 'Going in',
            fields: [],
            lines: [line('vanity', 'Vanity', 'Vanity for this bathroom. Count is 1.', 'bathroom')],
          },
          {
            id: 'extent_bathroom_floor',
            label: 'Bath floor',
            group: 'Going in',
            fields: [{ key: 'bathroomFloorSqft', label: 'Bath floor' }],
            lines: [
              line(
                'floor_tile',
                'Bath floor tile',
                'The new bathroom floor. The area stays blank until it is measured.',
                'bathroom'
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'remodel_kitchen',
    question: 'What kitchen?',
    extents: [
      {
        id: 'extent_kitchen_cabinets',
        label: 'Cabinets',
        fields: [{ key: 'cabinetLf', label: 'Cabinets' }],
      },
      {
        id: 'extent_kitchen_counters',
        label: 'Counters',
        fields: [{ key: 'countertopSqft', label: 'Counters' }],
      },
      {
        id: 'extent_kitchen_backsplash',
        label: 'Backsplash',
        fields: [{ key: 'backsplashSqft', label: 'Backsplash' }],
      },
      {
        id: 'extent_kitchen_floor',
        label: 'Floor',
        fields: [{ key: 'kitchenFloorSqft', label: 'Kitchen floor' }],
      },
    ],
  },
  {
    id: 'remodel_plumbing',
    question: 'What plumbing?',
    extents: [
      {
        id: 'extent_plumbing_rough',
        label: 'Rough-in',
        fields: [{ key: 'plumbingRoughPointCount', label: 'Rough-in points' }],
        lines: [
          line(
            'plumbing_rough',
            'Plumbing rough-in',
            'Supply, drain, and vent rough-in points.',
            'plumbing'
          ),
        ],
      },
      {
        id: 'extent_plumbing_fixtures',
        label: 'Fixtures',
        fields: [{ key: 'fixtureReplacementCount', label: 'Fixtures' }],
        lines: [
          line(
            'fixture_replace',
            'Plumbing fixtures',
            'Set plumbing fixtures at the new rough-in.',
            'plumbing'
          ),
        ],
      },
      {
        id: 'extent_plumbing_heater',
        label: 'Water heater',
        fields: [{ key: 'waterHeaterCount', label: 'Water heater' }],
        lines: [line('water_heater', 'Water heater', 'Water heater.', 'plumbing')],
      },
      {
        id: 'extent_plumbing_water_line',
        label: 'Water line',
        fields: [{ key: 'waterLineLf', label: 'Water line' }],
        lines: [line('water_line', 'Water line', 'Water supply line.', 'plumbing')],
      },
    ],
  },
  {
    id: 'remodel_hvac',
    question: 'What HVAC?',
    extents: [
      {
        id: 'extent_hvac_system',
        label: 'System',
        fields: [{ key: 'hvacSystemCount', label: 'System' }],
      },
      {
        id: 'extent_hvac_ductwork',
        label: 'Ductwork',
        fields: [{ key: 'hvacDuctworkLf', label: 'Ductwork' }],
      },
      {
        id: 'extent_hvac_registers',
        label: 'Registers',
        fields: [
          { key: 'hvacSupplyRegisterCount', label: 'Supply registers' },
          { key: 'hvacReturnGrilleCount', label: 'Return grilles' },
        ],
      },
      {
        id: 'extent_hvac_thermostat',
        label: 'Thermostat',
        fields: [{ key: 'hvacThermostatCount', label: 'Thermostat' }],
      },
    ],
  },
  {
    id: 'remodel_landscaping',
    question: 'What landscaping?',
    extents: [
      {
        id: 'extent_landscape_sod',
        label: 'Sod',
        fields: [{ key: 'sodSqft', label: 'Sod' }],
      },
      {
        id: 'extent_landscape_rock',
        label: 'Rock / mulch',
        fields: [{ key: 'rockMulchSqft', label: 'Rock / mulch' }],
      },
      {
        id: 'extent_landscape_pavers',
        label: 'Pavers',
        fields: [{ key: 'paverSqft', label: 'Pavers' }],
      },
      {
        id: 'extent_landscape_planting',
        label: 'Planting',
        fields: [{ key: 'landscapeSqft', label: 'Planting' }],
      },
    ],
  },
  {
    id: 'remodel_concrete',
    question: 'What concrete?',
    extents: [
      {
        id: 'extent_concrete_driveway',
        label: 'Driveway',
        fields: [{ key: 'concreteDrivewaySqft', label: 'Driveway' }],
      },
      {
        id: 'extent_concrete_sidewalk',
        label: 'Sidewalk',
        fields: [{ key: 'concreteSidewalkSqft', label: 'Sidewalk' }],
      },
      {
        id: 'extent_concrete_patio',
        label: 'Patio',
        fields: [{ key: 'concretePatioSqft', label: 'Patio' }],
      },
      {
        id: 'extent_concrete_walkway',
        label: 'Walkway',
        fields: [{ key: 'concreteWalkwaySqft', label: 'Walkway' }],
      },
    ],
  },
];

const EXTENT_PARENT_BY_ID = new Map(
  REMODEL_EXTENT_PARENTS.map(parent => [parent.id, parent])
);

function parentQuestions(parent: RemodelExtentParent): RemodelExtentQuestion[] {
  if (parent.questions?.length) return parent.questions;
  return [
    {
      id: parent.id,
      label: parent.id,
      question: parent.question,
      extents: parent.extents,
    },
  ];
}

const EXTENT_BY_ID = new Map<
  string,
  RemodelExtent & { parentId: string; chipId: string }
>();
const QUESTION_CHIP_ID = new Map<string, string>();

function extentUnsureId(questionId: string): string {
  return `extent_unsure_${questionId}`;
}

function extentNoneId(questionId: string): string {
  return `extent_none_${questionId}`;
}

for (const parent of REMODEL_EXTENT_PARENTS) {
  for (const question of parentQuestions(parent)) {
    QUESTION_CHIP_ID.set(question.id, parent.id);
    PIECE_IDS.add(extentUnsureId(question.id));
    if (question.declineLabel) PIECE_IDS.add(extentNoneId(question.id));
    for (const extent of question.extents) {
      PIECE_IDS.add(extent.id);
      EXTENT_BY_ID.set(extent.id, {
        ...extent,
        parentId: question.id,
        chipId: parent.id,
      });
    }
  }
}

function questionDeclineIds(questionId: string): string[] {
  return [extentUnsureId(questionId), extentNoneId(questionId)];
}

export function pruneRemodelExtentPieces(pieces: readonly string[]): string[] {
  const selected = new Set(pieces);
  return pieces.filter(id => {
    const extent = EXTENT_BY_ID.get(id);
    if (extent) return selected.has(extent.chipId);
    const questionId = id.startsWith('extent_unsure_')
      ? id.slice('extent_unsure_'.length)
      : id.startsWith('extent_none_')
        ? id.slice('extent_none_'.length)
        : '';
    if (!questionId) return true;
    const chipId = QUESTION_CHIP_ID.get(questionId);
    return Boolean(chipId && selected.has(chipId));
  });
}

function remodelExtentLines(pieces: readonly string[], parentId: string): ClarificationLine[] {
  const selected = new Set(pieces);
  const parent = EXTENT_PARENT_BY_ID.get(parentId);
  if (!parent) return [];
  return parentQuestions(parent).flatMap(question =>
    question.extents
      .filter(extent => selected.has(extent.id))
      .flatMap(extent => {
        if (extent.id === 'extent_bath_out_floor' && selected.has('remodel_demo')) {
          return [];
        }
        return extent.lines || [];
      })
  );
}

function questionSummary(
  selected: Set<string>,
  question: RemodelExtentQuestion
): string {
  if (selected.has(extentNoneId(question.id))) return question.declineLabel || 'No';
  if (selected.has(extentUnsureId(question.id))) return 'Not sure';
  return question.extents
    .filter(extent => selected.has(extent.id))
    .map(extent => extent.label)
    .join(', ');
}

/** "Walls, Ceiling" for the parts picked under one trade chip. */
function questionById(questionId: string): RemodelExtentQuestion | null {
  for (const parent of REMODEL_EXTENT_PARENTS) {
    const question = parentQuestions(parent).find(item => item.id === questionId);
    if (question) return question;
  }
  return null;
}

export function remodelExtentSummary(
  pieces: readonly string[] | null | undefined,
  parentId: string
): string {
  const selected = new Set(pieces || []);
  const parent = EXTENT_PARENT_BY_ID.get(parentId);
  if (parent?.questions?.length) {
    return parent.questions
      .map(item => {
        const summary = questionSummary(selected, item);
        return summary ? `${item.label}: ${summary}` : '';
      })
      .filter(Boolean)
      .join(' · ');
  }
  const question = questionById(parentId);
  if (question && question.id !== parent?.id) return questionSummary(selected, question);
  if (selected.has(extentNoneId(parentId))) return 'No';
  if (selected.has(extentUnsureId(parentId))) return 'Not sure';
  return (question?.extents || parent?.extents || [])
    .filter(extent => selected.has(extent.id))
    .map(extent => extent.label)
    .join(', ');
}

export function isRemodelExtentPiece(pieceId: string): boolean {
  return EXTENT_BY_ID.has(pieceId) || pieceId.startsWith('extent_unsure_');
}

export type RemodelExtentFollowUp = {
  parentId: string;
  label: string;
  question: string;
  options: Array<{ id: string; label: string }>;
  declines: Array<{ id: string; label: string }>;
};

/** Follow-up questions for the long-layout chips that are currently on. */
export function remodelExtentFollowUps(
  pieces: readonly string[] | null | undefined
): RemodelExtentFollowUp[] {
  const selected = new Set(pruneRemodelExtentPieces(pieces || []));
  return REMODEL_EXTENT_PARENTS.flatMap(parent => {
    if (!selected.has(parent.id)) return [];
    return parentQuestions(parent).map(question => ({
      parentId: question.id,
      label:
        question.id === parent.id
          ? PIECE_REVEAL[parent.id] || parent.id
          : question.label,
      question: question.question,
      options: question.extents.map(extent => ({
        id: extent.id,
        label: extent.label,
      })),
      declines: [
        ...(question.declineLabel
          ? [{ id: extentNoneId(question.id), label: question.declineLabel }]
          : []),
        { id: extentUnsureId(question.id), label: 'Not sure' },
      ],
    }));
  });
}

export function remodelExtentAnswered(
  pieces: readonly string[] | null | undefined,
  questionId: string
): boolean {
  const selected = new Set(pieces || []);
  if (questionDeclineIds(questionId).some(id => selected.has(id))) return true;
  const question = questionById(questionId);
  return (question?.extents || []).some(extent => selected.has(extent.id));
}

export function toggleRemodelScopePiece(pieces: readonly string[], pieceId: string): string[] {
  const next = pieces.includes(pieceId)
    ? pieces.filter(id => id !== pieceId)
    : [...pieces, pieceId];
  return pruneRemodelExtentPieces(next);
}

export function toggleRemodelExtentPiece(
  pieces: readonly string[],
  extentId: string
): string[] {
  const extent = EXTENT_BY_ID.get(extentId);
  if (!extent) return [...pieces];
  const declines = new Set(questionDeclineIds(extent.parentId));
  if (pieces.includes(extentId)) {
    return pieces.filter(id => id !== extentId);
  }
  return [...pieces.filter(id => !declines.has(id)), extentId];
}

export function declineRemodelExtent(
  pieces: readonly string[],
  questionId: string,
  declineId?: string
): string[] {
  const childIds = new Set((questionById(questionId)?.extents || []).map(extent => extent.id));
  const declines = new Set(questionDeclineIds(questionId));
  const chosen = declineId || extentUnsureId(questionId);
  return [...pieces.filter(id => !childIds.has(id) && !declines.has(id)), chosen];
}

/** Blank measurement boxes for the chips the contractor tapped. */
export function remodelRemainderMeasurementFields(
  pieces: readonly string[] | null | undefined,
  measurements?: {
    typedTrimLabel?: unknown;
    typedBaseboardInstall?: unknown;
    baseboardDemoLf?: unknown;
  } | null
): RemodelRemainderMeasurement[] {
  const selected = new Set(pruneRemodelExtentPieces(pieces || []));
  const phases = Object.values(REMODEL_PHASES).filter(phase => selected.has(phase.id));
  const rows: RemodelRemainderMeasurement[] = REMODEL_REMAINDER_MEASUREMENTS.filter(row =>
    phases.some(phase => phase.id === row.pieceId)
  );
  for (const phase of phases) {
    const parent = EXTENT_PARENT_BY_ID.get(phase.id);
    if (!parent) continue;
    for (const question of parentQuestions(parent)) {
      for (const extent of question.extents) {
        if (!selected.has(extent.id)) continue;
        if (extent.id === 'extent_bath_out_floor' && selected.has('extent_bathroom_floor')) {
          continue;
        }
        for (const field of extent.fields) {
          const existing = rows.find(row => row.key === field.key);
          if (existing) {
            existing.label = field.label;
            existing.group = extent.group || phase.label;
            continue;
          }
          rows.push({
            pieceId: extent.id,
            key: field.key,
            label: field.label,
            group: extent.group || phase.label,
          });
        }
      }
    }
  }
  for (const parentId of UNSURE_OPENS_MEASUREMENTS) {
    if (!selected.has(extentUnsureId(parentId))) continue;
    const parent = EXTENT_PARENT_BY_ID.get(parentId);
    if (!parent) continue;
    const group = PIECE_REVEAL[parentId] || parentId;
    for (const question of parentQuestions(parent)) {
      for (const extent of question.extents) {
        for (const field of extent.fields) {
          if (rows.some(row => row.key === field.key)) continue;
          rows.push({
            pieceId: extent.id,
            key: field.key,
            label: field.label,
            group,
            optional: true,
          });
        }
      }
    }
  }
  const namedBaseboard = measurementsNameBaseboard(measurements);
  if (namedBaseboard) {
    if (String(measurements?.typedBaseboardInstall || '') === '0') {
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index]?.key === 'baseboardLf') rows.splice(index, 1);
      }
    } else {
      for (const row of rows) {
        if (row.key === 'baseboardLf') row.label = 'Baseboard';
      }
    }
    const demoLf = Number(String(measurements?.baseboardDemoLf ?? '').replace(/,/g, ''));
    if (demoLf > 0 && !rows.some(row => row.key === 'baseboardDemoLf')) {
      const demoRow: RemodelRemainderMeasurement = {
        pieceId: 'remodel_trim',
        key: 'baseboardDemoLf',
        label: 'Baseboard demo',
      };
      const installAt = rows.findIndex(row => row.key === 'baseboardLf');
      if (installAt >= 0) rows.splice(installAt, 0, demoRow);
      else rows.push(demoRow);
    }
  }
  // Bathroom fixtures price on their own cards. Plumbing counts the rest.
  if (BATHROOM_FIXTURE_EXTENT_IDS.some(id => selected.has(id))) {
    const fixtures = rows.find(row => row.key === 'fixtureReplacementCount');
    if (fixtures?.pieceId === 'extent_plumbing_fixtures') {
      fixtures.label = 'Other fixtures';
    }
  }
  return rows;
}

const BATHROOM_FIXTURE_EXTENT_IDS = [
  'extent_bath_in_tub',
  'extent_bath_in_prefab_pan',
  'extent_bath_in_tile_pan',
  'extent_bath_in_enclosure',
  'extent_bathroom_toilet',
  'extent_bathroom_vanity',
];

/**
 * One Scope Found question, or none. The shower question wins on a bathroom
 * note. A new build or addition asks only when the note names an existing
 * structure and does not say what happens to it. A remodel that leaves phases
 * unnamed asks once for those phases.
 */
export function resolveScopeFoundClarification(
  notes: string | null | undefined
): ScopeFoundClarification | null {
  const shower = showerRemovalPrompt(notes);
  if (shower) {
    return {
      id: 'shower',
      question: shower.question,
      options: shower.options.map(option => ({
        id: option.id,
        label: option.label,
      })),
    };
  }
  const text = noteText(notes);
  if (!text) return null;
  return (
    flooringDemoPrompt(text) ||
    roofTearOffPrompt(text) ||
    paintExtentPrompt(text) ||
    kitchenDemoPrompt(text) ||
    wholeHomeDemoPrompt(text) ||
    tradePrompt(text) ||
    existingStructurePrompt(text) ||
    (wholeHomeRemodelIncludesFinishDemo(text) ? null : remodelRemainderPrompt(text))
  );
}

export function readScopeFoundClarificationId(
  value: unknown
): ScopeFoundClarificationId | null {
  return IDS.has(value as ScopeFoundClarificationId)
    ? (value as ScopeFoundClarificationId)
    : null;
}

export function readScopeFoundChoice(value: unknown): ScopeFoundChoice | null {
  return CHOICES.has(value as ScopeFoundChoice)
    ? (value as ScopeFoundChoice)
    : null;
}

export function readScopeFoundPieces(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return pruneRemodelExtentPieces(
    value.filter((piece): piece is string => PIECE_IDS.has(String(piece)))
  );
}

/** Scope Found already named the interior paint surfaces. */
export function interiorPaintSurfacesAnswered(
  measurements: {
    scopeFoundClarificationId?: unknown;
    scopeFoundPieces?: unknown;
    scopeFoundChoice?: unknown;
  } | null
  | undefined
): boolean {
  if (
    readScopeFoundClarificationId(measurements?.scopeFoundClarificationId) !==
    'interior_paint_extent'
  ) {
    return false;
  }
  return (
    readScopeFoundPieces(measurements?.scopeFoundPieces).length > 0 ||
    readScopeFoundChoice(measurements?.scopeFoundChoice) != null
  );
}

function line(
  id: string,
  label: string,
  helperText: string,
  category: string
): ClarificationLine {
  return { id, label, helperText, category };
}

function flooringDemoLine(text: string): ClarificationLine {
  const area = kitchenInstallNote(text)
    ? statedKitchenFloorSqft(text) || dedicatedFlooringAreaSqft(text)
    : flooringAreaForNote(text);
  return line(
    'floor_demo',
    'Flooring demo / removal',
    area
      ? `Remove the existing floor. Uses the ${area.toLocaleString('en-US')} sqft already stated.`
      : 'Remove the existing floor.',
    'flooring'
  );
}

function kitchenLines(text: string, choice: ScopeFoundChoice): ClarificationLine[] {
  const groups = kitchenSurfaceGroups(text);
  const wantedCabinets =
    groups.includes('cabinets') &&
    (choice === 'cabinets' || choice === 'all' || choice === 'yes');
  const wantedFloor =
    groups.includes('flooring') &&
    (choice === 'flooring' || choice === 'all' || choice === 'yes');
  const lines: ClarificationLine[] = [];
  if (wantedCabinets && kitchenNoteNamesCabinetWork(text)) {
    lines.push(
      line('cabinet_demo', 'Cabinet demo', 'The existing cabinets come out.', 'demo')
    );
  }
  if (wantedCabinets && kitchenNoteNamesCounterWork(text)) {
    lines.push(
      line(
        'countertop_demo',
        'Countertop demo',
        'The existing countertops come out.',
        'demo'
      )
    );
  }
  if (wantedCabinets && kitchenNoteNamesBacksplash(text)) {
    lines.push(
      line(
        'backsplash_demo',
        'Backsplash demo',
        'The existing backsplash comes out.',
        'demo'
      )
    );
  }
  if (wantedFloor) lines.push(flooringDemoLine(text));
  return lines;
}

function impliedWholeHomeDemoLines(text: string): ClarificationLine[] {
  if (!wholeHomeRemodelIncludesFinishDemo(text)) return [];
  const lines: ClarificationLine[] = [];
  if (/\bkitchen\b/i.test(text)) {
    lines.push(
      line('cabinet_demo', 'Cabinet demo', 'The existing kitchen cabinets come out.', 'demo'),
      line('countertop_demo', 'Countertop demo', 'The existing countertops come out.', 'demo'),
      line('backsplash_demo', 'Backsplash demo', 'The existing backsplash comes out.', 'demo')
    );
  }
  if (
    /\b(?:flooring|lvp|carpet|vinyl|hardwood|laminate)\b/i.test(text) &&
    !notesOwnerHandlesFlooringDemo(text)
  ) {
    lines.push(flooringDemoLine(text));
  }
  if (/\bbath(?:room)?s?\b/i.test(text)) {
    lines.push(
      line('fixture_demo', 'Bathroom demo', 'The existing bathrooms come out.', 'demo')
    );
  }
  return lines;
}

function wholeHomeLines(text: string): ClarificationLine[] {
  const lines: ClarificationLine[] = [];
  if (/\b(?:flooring|lvp|carpet|vinyl|hardwood)\b/i.test(text)) {
    lines.push(flooringDemoLine(text));
  }
  if (/\bkitchen\b/i.test(text)) {
    lines.push(
      line('cabinet_demo', 'Cabinet demo', 'The existing kitchen cabinets come out.', 'demo')
    );
  }
  if (/\bbath(?:room)?s?\b/i.test(text)) {
    lines.push(
      line('fixture_demo', 'Bathroom demo', 'The existing bathrooms come out.', 'demo')
    );
  }
  return lines;
}

function paintLines(choice: ScopeFoundChoice): ClarificationLine[] {
  const lines: ClarificationLine[] = [];
  if (choice === 'walls_ceilings' || choice === 'walls_ceilings_trim') {
    lines.push(
      line('ceiling_paint', 'Ceiling paint', 'Paint the ceilings with the walls.', 'paint')
    );
  }
  if (choice === 'walls_ceilings_trim') {
    lines.push(
      line('trim_paint', 'Trim paint', 'Paint the trim with the walls and ceilings.', 'paint')
    );
  }
  return lines;
}

const OWNED_LINE_IDS: Record<Exclude<ScopeFoundClarificationId, 'shower'>, string[]> = {
  flooring_demo: ['floor_demo'],
  roof_tearoff: ['tear_off'],
  kitchen_demo: [
    'cabinet_demo',
    'countertop_demo',
    'backsplash_demo',
    'floor_demo',
    'island_demo',
    'appliance_removal',
  ],
  whole_home_demo: [
    'floor_demo',
    'cabinet_demo',
    'countertop_demo',
    'backsplash_demo',
    'appliance_removal',
    'fixture_demo',
  ],
  interior_paint_extent: [
    'interior_paint',
    'ceiling_paint',
    'trim_paint',
    'door_paint',
    'cabinet_paint',
  ],
  stucco_demo: [
    'cladding_demo',
    'cladding_demo__old_stucco',
    'cladding_demo__wood_siding',
    'cladding_demo__vinyl_siding',
    'cladding_demo__brick',
    'cladding_demo__fiber_cement',
  ],
  concrete_demo: ['demo_removal'],
  landscape_demo: ['demo_clearing', 'paver_demo'],
  insulation_demo: ['insulation_removal'],
  framing_demo: ['framing_demo'],
  drywall_demo: ['demo_removal', 'drywall_wall_demo', 'drywall_ceiling_demo'],
  deck_demo: [
    'demo_removal',
    'deck_surface_demo',
    'deck_railing_demo',
    'deck_stairs_demo',
  ],
  hvac_demo: ['hvac_demo'],
  electrical_demo: [
    'electrical_panel_removal',
    'electrical_fixture_removal',
    'electrical_abandoned_circuit',
    'electrical_demo',
  ],
  plumbing_demo: ['plumbing_demo'],
  openings_demo: ['opening_demo'],
  excavation_demo: ['demo_clearing', 'demo_removal', 'existing_structure_demo'],
  existing_structure: ['existing_house_demo', 'existing_garage_demo'],
  remodel_remainder: [
    'floor_demo',
    'interior_paint',
    'insulation',
    'electrical_rough',
    'wall_framing',
    'interior_trim',
    'bathroom_updates',
    'flooring',
    'hvac',
    'drywall',
    'interior_doors',
    'kitchen_updates',
    'roofing',
    'tile',
    'vanity',
    'toilet',
    'plumbing_rough',
    'appliances',
  ],
};

export const ROOF_TEAR_OFF_CARDS = [
  { piece: 'shingles', id: 'tear_off_shingles', choice: 'one_layer', label: 'Tear off shingles' },
  { piece: 'roof_tile', id: 'tear_off_tile', choice: 'tile_removal', label: 'Tear off roof tile' },
  { piece: 'metal', id: 'tear_off_metal', choice: 'metal_removal', label: 'Tear off metal roof' },
  { piece: 'flat', id: 'tear_off_flat', choice: 'membrane_removal', label: 'Tear off flat roof' },
] as const;

export function roofTearOffChoiceForItem(itemId: string): string | null {
  return ROOF_TEAR_OFF_CARDS.find(row => row.id === itemId)?.choice || null;
}

/** One priced tear-off line per material the contractor selected. Stepper off removes them. */
export function splitRoofTearOffCards<T extends { id?: string | null }>(
  items: T[],
  measurements: {
    tradeScopeSelections?: { roofing?: string[] | null } | null;
    scopeFoundPieces?: unknown;
  } | null | undefined
): T[] {
  const styleIds = new Set<string>(ROOF_TEAR_OFF_CARDS.map(row => row.id));
  const withoutStyles = items.filter(item => !styleIds.has(String(item.id || '')));
  const selections = measurements?.tradeScopeSelections?.roofing;
  const pieces = readScopeFoundPieces(measurements?.scopeFoundPieces);
  const cards = ROOF_TEAR_OFF_CARDS.filter(row => pieces.includes(row.piece));
  const tearOn =
    (Array.isArray(selections) && selections.includes('tear_off')) ||
    cards.length > 0;
  if (!tearOn) return withoutStyles;
  if (!cards.length) {
    return withoutStyles.map(item => {
      if (String(item.id || '') !== 'tear_off') return item;
      const existing = item as T & { choiceId?: string | null; inputType?: string };
      const choice =
        existing.choiceId &&
        !['unsure', 'not_in_scope', 'new_construction'].includes(String(existing.choiceId))
          ? existing.choiceId
          : 'one_layer';
      return {
        ...existing,
        inputType: 'choice',
        choiceId: choice,
        state: 'included',
        noteBacked: true,
      } as T;
    });
  }
  return [
    ...cards.map(
      card =>
        ({
          id: card.id,
          label: card.label,
          helperText: 'Tear off the existing roof before the new roof goes on.',
          inputType: 'yes_no',
          state: 'included',
          noteBacked: false,
          category: 'roofing',
        }) as unknown as T
    ),
    ...withoutStyles.filter(item => String(item.id || '') !== 'tear_off'),
  ];
}

/** Selected Scope Found chips that already have their own Quick Measurement field. */
const SCOPE_FOUND_PIECES_WITH_OWN_MEASUREMENT = new Set([
  'flooring',
  'carpet',
  'tile',
  'hardwood',
  'vinyl',
  'laminate',
  'kitchen_floor',
  'shingles',
  'roof_tile',
  'metal',
  'flat',
  'cabinets',
  'countertops',
  'backsplash',
  'island',
  'appliances',
  'deck_surface',
  'deck_railing',
  'deck_stairs',
  'walls',
  'ceilings',
  'trim',
  'doors',
  'paint_cabinets',
  'drywall_walls',
  'drywall_ceilings',
  'house',
  'garage',
  'electrical_panel',
  'electrical_fixtures',
  'electrical_wiring',
]);

export type ScopeFoundRemovalMeasurement = {
  pieceId: string;
  label: string;
  unit: 'sqft' | 'each';
  quantityKey: string;
};

const SCOPE_FOUND_REMOVAL_MEASUREMENTS: ScopeFoundRemovalMeasurement[] = [
  { pieceId: 'old_stucco', label: 'Stucco removal', unit: 'sqft', quantityKey: 'cladding_demo__old_stucco' },
  { pieceId: 'wood_siding', label: 'Wood siding removal', unit: 'sqft', quantityKey: 'cladding_demo__wood_siding' },
  { pieceId: 'vinyl_siding', label: 'Vinyl siding removal', unit: 'sqft', quantityKey: 'cladding_demo__vinyl_siding' },
  { pieceId: 'brick', label: 'Brick removal', unit: 'sqft', quantityKey: 'cladding_demo__brick' },
  { pieceId: 'fiber_cement', label: 'Fiber cement removal', unit: 'sqft', quantityKey: 'cladding_demo__fiber_cement' },
  { pieceId: 'concrete_slab', label: 'Concrete removal', unit: 'sqft', quantityKey: 'demo_removal__concrete_slab' },
  { pieceId: 'asphalt', label: 'Asphalt removal', unit: 'sqft', quantityKey: 'demo_removal__asphalt' },
  { pieceId: 'concrete_pavers', label: 'Paver removal', unit: 'sqft', quantityKey: 'demo_removal__concrete_pavers' },
  { pieceId: 'gravel', label: 'Gravel removal', unit: 'sqft', quantityKey: 'demo_removal__gravel' },
  { pieceId: 'sod', label: 'Sod removal', unit: 'sqft', quantityKey: 'demo_clearing__sod' },
  { pieceId: 'landscape_rock', label: 'Rock removal', unit: 'sqft', quantityKey: 'demo_clearing__landscape_rock' },
  { pieceId: 'mulch', label: 'Mulch removal', unit: 'sqft', quantityKey: 'demo_clearing__mulch' },
  { pieceId: 'plants', label: 'Plant removal', unit: 'sqft', quantityKey: 'demo_clearing__plants' },
  { pieceId: 'landscape_pavers', label: 'Paver removal', unit: 'sqft', quantityKey: 'paver_demo__landscape_pavers' },
  { pieceId: 'batts', label: 'Batt removal', unit: 'sqft', quantityKey: 'insulation_removal__batts' },
  { pieceId: 'blown', label: 'Blown-in removal', unit: 'sqft', quantityKey: 'insulation_removal__blown' },
  { pieceId: 'spray_foam', label: 'Spray foam removal', unit: 'sqft', quantityKey: 'insulation_removal__spray_foam' },
  { pieceId: 'interior_walls', label: 'Interior wall removal', unit: 'sqft', quantityKey: 'framing_demo__interior_walls' },
  { pieceId: 'exterior_walls', label: 'Exterior wall removal', unit: 'sqft', quantityKey: 'framing_demo__exterior_walls' },
  { pieceId: 'hvac_furnace', label: 'Furnace removal', unit: 'each', quantityKey: 'hvac_demo__hvac_furnace' },
  { pieceId: 'hvac_condenser', label: 'Condenser removal', unit: 'each', quantityKey: 'hvac_demo__hvac_condenser' },
  { pieceId: 'hvac_air_handler', label: 'Air handler removal', unit: 'each', quantityKey: 'hvac_demo__hvac_air_handler' },
  { pieceId: 'hvac_ductwork', label: 'Ductwork removal', unit: 'each', quantityKey: 'hvac_demo__hvac_ductwork' },
  { pieceId: 'water_heater', label: 'Water heater removal', unit: 'each', quantityKey: 'plumbing_demo__water_heater' },
  { pieceId: 'plumbing_fixtures', label: 'Plumbing fixture removal', unit: 'each', quantityKey: 'plumbing_demo__plumbing_fixtures' },
  { pieceId: 'piping', label: 'Piping removal', unit: 'each', quantityKey: 'plumbing_demo__piping' },
  { pieceId: 'existing_windows', label: 'Window removal', unit: 'each', quantityKey: 'opening_demo__existing_windows' },
  { pieceId: 'existing_exterior_doors', label: 'Exterior door removal', unit: 'each', quantityKey: 'opening_demo__existing_exterior_doors' },
  { pieceId: 'existing_interior_doors', label: 'Interior door removal', unit: 'each', quantityKey: 'opening_demo__existing_interior_doors' },
  { pieceId: 'existing_sliding_doors', label: 'Sliding door removal', unit: 'each', quantityKey: 'opening_demo__existing_sliding_doors' },
  { pieceId: 'existing_garage_doors', label: 'Garage door removal', unit: 'each', quantityKey: 'opening_demo__existing_garage_doors' },
  { pieceId: 'site_trees', label: 'Tree removal', unit: 'each', quantityKey: 'demo_clearing__site_trees' },
  { pieceId: 'site_brush', label: 'Brush removal', unit: 'sqft', quantityKey: 'demo_clearing__site_brush' },
  { pieceId: 'site_concrete', label: 'Concrete removal', unit: 'sqft', quantityKey: 'demo_removal__site_concrete' },
  { pieceId: 'site_structure', label: 'Structure removal', unit: 'each', quantityKey: 'existing_structure_demo__site_structure' },
];

const SCOPE_FOUND_REMOVAL_BY_PIECE = new Map(
  SCOPE_FOUND_REMOVAL_MEASUREMENTS.map(row => [row.pieceId, row])
);

const SCOPE_FOUND_REMOVAL_BY_ITEM = new Map(
  SCOPE_FOUND_REMOVAL_MEASUREMENTS.map(row => [row.quantityKey, row])
);

/** Planning rates for one removal card per selected Scope Found chip. */
const SCOPE_FOUND_REMOVAL_RATES: Record<
  string,
  { material: number; labor: number; label: string }
> = {
  cladding_demo__old_stucco: { material: 0.75, labor: 2.25, label: 'stucco removal' },
  cladding_demo__wood_siding: { material: 0.5, labor: 1.75, label: 'wood siding removal' },
  cladding_demo__vinyl_siding: { material: 0.35, labor: 1.15, label: 'vinyl siding removal' },
  cladding_demo__brick: { material: 1.25, labor: 3.75, label: 'brick removal' },
  cladding_demo__fiber_cement: { material: 0.6, labor: 2.15, label: 'fiber cement removal' },
  demo_removal__concrete_slab: { material: 1.5, labor: 2.5, label: 'concrete removal' },
  demo_removal__asphalt: { material: 1, labor: 2, label: 'asphalt removal' },
  demo_removal__concrete_pavers: { material: 1.25, labor: 2.25, label: 'paver removal' },
  demo_removal__gravel: { material: 0.75, labor: 1.25, label: 'gravel removal' },
  demo_removal__site_concrete: { material: 1.5, labor: 2.5, label: 'concrete removal' },
  demo_clearing__sod: { material: 0.15, labor: 0.45, label: 'sod removal' },
  demo_clearing__landscape_rock: { material: 0.4, labor: 0.85, label: 'rock removal' },
  demo_clearing__mulch: { material: 0.15, labor: 0.35, label: 'mulch removal' },
  demo_clearing__plants: { material: 0.35, labor: 0.75, label: 'plant removal' },
  demo_clearing__site_brush: { material: 0.4, labor: 1.1, label: 'brush clearing' },
  paver_demo__landscape_pavers: { material: 1.25, labor: 2.25, label: 'paver removal' },
  insulation_removal__batts: { material: 0.15, labor: 0.85, label: 'batt removal' },
  insulation_removal__blown: { material: 0.2, labor: 1.05, label: 'blown-in removal' },
  insulation_removal__spray_foam: { material: 0.35, labor: 1.65, label: 'spray foam removal' },
  framing_demo__interior_walls: { material: 0.75, labor: 2.25, label: 'interior wall removal' },
  framing_demo__exterior_walls: { material: 1.25, labor: 3.75, label: 'exterior wall removal' },
  hvac_demo__hvac_furnace: { material: 75, labor: 225, label: 'furnace removal' },
  hvac_demo__hvac_condenser: { material: 75, labor: 225, label: 'condenser removal' },
  hvac_demo__hvac_air_handler: { material: 75, labor: 225, label: 'air handler removal' },
  hvac_demo__hvac_ductwork: { material: 150, labor: 450, label: 'ductwork removal' },
  plumbing_demo__water_heater: { material: 40, labor: 160, label: 'water heater removal' },
  plumbing_demo__plumbing_fixtures: { material: 25, labor: 125, label: 'plumbing fixture removal' },
  plumbing_demo__piping: { material: 50, labor: 200, label: 'piping removal' },
  opening_demo__existing_windows: { material: 25, labor: 75, label: 'window removal' },
  opening_demo__existing_exterior_doors: { material: 40, labor: 110, label: 'exterior door removal' },
  opening_demo__existing_interior_doors: { material: 20, labor: 55, label: 'interior door removal' },
  opening_demo__existing_sliding_doors: { material: 50, labor: 175, label: 'sliding door removal' },
  opening_demo__existing_garage_doors: { material: 75, labor: 225, label: 'garage door removal' },
  demo_clearing__site_trees: { material: 150, labor: 450, label: 'tree removal' },
  existing_structure_demo__site_structure: {
    material: 2500,
    labor: 7500,
    label: 'existing structure removal',
  },
  electrical_panel_removal: { material: 50, labor: 250, label: 'panel removal' },
  electrical_fixture_removal: { material: 10, labor: 40, label: 'fixture removal' },
  electrical_abandoned_circuit: { material: 15, labor: 60, label: 'abandoned circuit removal' },
};

const EXTRA_REMOVAL_UNITS: Record<string, 'sqft' | 'each'> = {
  electrical_panel_removal: 'each',
  electrical_fixture_removal: 'each',
  electrical_abandoned_circuit: 'each',
};

/** A half dollar stays down so a removal card does not add a dollar the rate does not have. */
function roundRemovalHalfDown(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const frac = abs - Math.floor(abs);
  if (Math.abs(frac - 0.5) < 1e-6) return sign * Math.floor(abs);
  return Math.round(value);
}

/** Whole-dollar material and labor that add up to the removal card. */
export function scopeFoundRemovalCardDollars(
  quantity: number,
  materialRate: number,
  laborRate: number
): { material: number; labor: number; total: number } {
  const rawMaterial = quantity * materialRate;
  const rawLabor = quantity * laborRate;
  const total = roundRemovalHalfDown(rawMaterial + rawLabor);
  const material = Math.min(total, Math.max(0, roundRemovalHalfDown(rawMaterial)));
  return { material, labor: Math.max(0, total - material), total };
}

export function scopeFoundRemovalPricingSpec(itemId: string): {
  unit: 'sqft' | 'each';
  material: number;
  labor: number;
  sourceLabel: string;
} | null {
  const rate = SCOPE_FOUND_REMOVAL_RATES[itemId];
  const row = SCOPE_FOUND_REMOVAL_BY_ITEM.get(itemId);
  const unit = row?.unit || EXTRA_REMOVAL_UNITS[itemId];
  if (!rate || !unit) return null;
  return {
    unit,
    material: rate.material,
    labor: rate.labor,
    sourceLabel: `Suggested budget split · National Average · ${rate.label}`,
  };
}

const LANDSCAPE_CLEARING_PIECE_IDS = [
  'sod',
  'landscape_rock',
  'mulch',
  'plants',
  'site_trees',
  'site_brush',
] as const;

/** Named landscape removals replace the generic Demo / clearing card. */
export function scopeFoundNamesLandscapeClearing(
  pieces: readonly string[] | null | undefined
): boolean {
  const selected = new Set(pieces || []);
  return LANDSCAPE_CLEARING_PIECE_IDS.some(pieceId => selected.has(pieceId));
}

const STUCCO_REMOVAL_PIECE_IDS = [
  'old_stucco',
  'wood_siding',
  'vinyl_siding',
  'brick',
  'fiber_cement',
] as const;

/** Every Scope Found chip either has its own Quick Measurement or one of these rows. */
export function scopeFoundTradePieceIds(): string[] {
  return TRADE_DEMOS.flatMap(trade => trade.pieces.map(piece => piece.id));
}

export function scopeFoundPieceHasQuickMeasurement(pieceId: string): boolean {
  return (
    SCOPE_FOUND_PIECES_WITH_OWN_MEASUREMENT.has(pieceId) ||
    SCOPE_FOUND_REMOVAL_BY_PIECE.has(pieceId)
  );
}

export function scopeFoundRemovalMeasurements(
  pieces: readonly string[] | null | undefined
): ScopeFoundRemovalMeasurement[] {
  const selected = new Set(pieces || []);
  return SCOPE_FOUND_REMOVAL_MEASUREMENTS.filter(row => selected.has(row.pieceId));
}

export function readScopeFoundRemovalQuantity(
  quantities: Record<string, { quantity?: unknown } | undefined> | null | undefined,
  quantityKey: string
): string {
  const raw = String(quantities?.[quantityKey]?.quantity ?? '').replace(/,/g, '');
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? raw : '';
}

const PIECE_REVEAL: Record<string, string> = {
  flooring: 'Remove flooring',
  carpet: 'Remove carpet',
  tile: 'Remove tile',
  hardwood: 'Remove hardwood',
  vinyl: 'Remove vinyl',
  laminate: 'Remove laminate',
  shingles: 'Tear off shingles',
  roof_tile: 'Tear off roof tile',
  metal: 'Tear off metal roof',
  flat: 'Tear off flat roof',
  cabinets: 'Cabinet demo',
  countertops: 'Countertop demo',
  backsplash: 'Backsplash demo',
  kitchen_floor: 'Flooring demo / removal',
  island: 'Island demo',
  appliances: 'Appliance removal',
  bathrooms: 'Bathroom demo',
  walls: 'Interior wall paint',
  ceilings: 'Ceiling paint',
  trim: 'Trim paint',
  doors: 'Interior door paint',
  paint_cabinets: 'Cabinet paint',
  house: 'Remove existing house',
  garage: 'Remove existing garage',
  remodel_demo: 'Flooring demo',
  remodel_paint: 'Paint',
  remodel_insulation: 'Insulation',
  remodel_electrical: 'Electrical',
  remodel_framing: 'Framing',
  remodel_trim: 'Trim',
  remodel_bathroom: 'Bathroom',
  remodel_flooring: 'Flooring',
  remodel_hvac: 'HVAC',
  remodel_drywall: 'Drywall',
  framing_sheathing: 'Sheathing',
  remodel_doors: 'Doors',
  remodel_kitchen: 'Kitchen',
  remodel_roofing: 'Roofing',
  remodel_tile: 'Tile',
  remodel_vanity: 'Vanity',
  remodel_toilet: 'Toilet',
  remodel_plumbing: 'Plumbing',
  remodel_appliances: 'Appliances',
  remodel_landscaping: 'Landscaping',
  remodel_concrete: 'Concrete',
};

const UNSURE_OPENS_MEASUREMENTS = ['remodel_plumbing', 'remodel_electrical'] as const;

function enteredMeasurement(
  measurements: Record<string, unknown> | null | undefined,
  key: string
): number {
  const value = Number(String(measurements?.[key] ?? '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function linesForFilledUnsureExtents(
  parentId: string,
  measurements: Record<string, unknown> | null | undefined
): ClarificationLine[] {
  if (!(UNSURE_OPENS_MEASUREMENTS as readonly string[]).includes(parentId)) return [];
  const parent = EXTENT_PARENT_BY_ID.get(parentId);
  if (!parent) return [];
  return parentQuestions(parent).flatMap(question =>
    question.extents
      .filter(extent =>
        extent.fields.some(field => enteredMeasurement(measurements, field.key) > 0)
      )
      .flatMap(extent => extent.lines || [])
  );
}

function linesForPieces(
  text: string,
  pieces: string[],
  measurements?: Record<string, unknown> | null
): ClarificationLine[] {
  const selected = new Set(pieces);
  const lines: ClarificationLine[] = [];
  if (selected.has(FRAMING_SHEATHING_PIECE)) {
    lines.push(
      line(
        'shear_sheathing',
        'Sheathing',
        'Structural wall sheathing. Enter the sheathing area.',
        'structure'
      )
    );
  }
  const floor = ['flooring', 'carpet', 'tile', 'hardwood', 'vinyl', 'laminate', 'kitchen_floor'].some(
    piece => selected.has(piece)
  );
  if (floor) lines.push(flooringDemoLine(text));
  if (selected.has('cabinets')) {
    lines.push(line('cabinet_demo', 'Cabinet demo', 'The existing cabinets come out.', 'demo'));
  }
  if (selected.has('countertops')) {
    lines.push(
      line('countertop_demo', 'Countertop demo', 'The existing countertops come out.', 'demo')
    );
  }
  if (selected.has('backsplash')) {
    lines.push(
      line('backsplash_demo', 'Backsplash demo', 'The existing backsplash comes out.', 'demo')
    );
  }
  if (selected.has('island')) {
    lines.push(line('island_demo', 'Island demo', 'The existing island comes out.', 'demo'));
  }
  if (selected.has('appliances')) {
    lines.push(
      line('appliance_removal', 'Appliance removal', 'The existing appliances come out.', 'demo')
    );
  }
  if (selected.has('bathrooms')) {
    lines.push(
      line('fixture_demo', 'Bathroom demo', 'The existing bathrooms come out.', 'demo')
    );
  }
  if (selected.has('drywall_walls')) {
    lines.push(
      line(
        'drywall_wall_demo',
        'Remove drywall walls',
        'Existing wall drywall comes out before the new drywall goes up.',
        'drywall'
      )
    );
  }
  if (selected.has('drywall_ceilings')) {
    lines.push(
      line(
        'drywall_ceiling_demo',
        'Remove drywall ceilings',
        'Existing ceiling drywall comes out before the new drywall goes up.',
        'drywall'
      )
    );
  }
  if (selected.has('deck_surface')) {
    lines.push(
      line(
        'deck_surface_demo',
        'Remove decking',
        'Existing decking comes out before the new deck goes in.',
        'demo'
      )
    );
  }
  if (selected.has('deck_railing')) {
    lines.push(
      line(
        'deck_railing_demo',
        'Remove railing',
        'Existing railing comes out. Enter the length being removed.',
        'demo'
      )
    );
  }
  if (selected.has('deck_stairs')) {
    lines.push(
      line(
        'deck_stairs_demo',
        'Remove stairs',
        'Existing stair flights come out.',
        'demo'
      )
    );
  }
  if (['shingles', 'roof_tile', 'metal', 'flat'].some(piece => selected.has(piece))) {
    lines.push(
      line(
        'tear_off',
        'Existing roof / tear-off',
        'Tear off the existing roof before the new roof goes on.',
        'roofing'
      )
    );
  }
  if (selected.has('walls')) {
    lines.push(
      line('interior_paint', 'Interior wall paint', 'Paint the interior walls.', 'paint')
    );
  }
  if (selected.has('ceilings')) {
    lines.push(line('ceiling_paint', 'Ceiling paint', 'Paint the ceilings with the walls.', 'paint'));
  }
  if (selected.has('trim')) {
    lines.push(line('trim_paint', 'Trim paint', 'Paint the trim with the walls.', 'paint'));
  }
  if (selected.has('doors')) {
    lines.push(
      line('door_paint', 'Interior door paint', 'Paint the interior door slabs.', 'paint')
    );
  }
  if (selected.has('paint_cabinets')) {
    lines.push(line('cabinet_paint', 'Cabinet paint', 'Paint the cabinets.', 'paint'));
  }
  if (selected.has('house')) {
    lines.push(
      line('existing_house_demo', 'Remove existing house', 'The existing house comes out.', 'demo')
    );
  }
  if (selected.has('garage')) {
    lines.push(
      line('existing_garage_demo', 'Remove existing garage', 'The existing garage comes out.', 'demo')
    );
  }
  for (const pieceId of pieces) {
    const remodelLine = REMODEL_LINE_BY_PIECE.get(pieceId);
    if (!remodelLine) continue;
    const partLines = remodelExtentLines(pieces, pieceId);
    const parent = EXTENT_PARENT_BY_ID.get(pieceId);
    const questions = parent?.questions || [];
    const declined =
      questions.length > 0 &&
      questions.every(
        question =>
          selected.has(extentNoneId(question.id)) ||
          selected.has(extentUnsureId(question.id))
      );
    const unsureOpensMeasurements =
      (UNSURE_OPENS_MEASUREMENTS as readonly string[]).includes(pieceId) &&
      selected.has(extentUnsureId(pieceId));
    if (partLines.length) lines.push(...partLines);
    else if (unsureOpensMeasurements) {
      lines.push(...linesForFilledUnsureExtents(pieceId, measurements));
    } else if (!declined) lines.push(remodelLine);
  }
  const seen = new Set(lines.map(item => item.id));
  for (const pieceId of pieces) {
    const row = SCOPE_FOUND_REMOVAL_BY_PIECE.get(pieceId);
    if (!row || seen.has(row.quantityKey)) continue;
    seen.add(row.quantityKey);
    lines.push(
      line(
        row.quantityKey,
        row.label,
        row.unit === 'each'
          ? 'Count of this existing item that comes out.'
          : 'Area of this existing material that comes out.',
        'demo'
      )
    );
  }
  for (const pieceId of pieces) {
    const piece = TRADE_PIECE_BY_ID.get(pieceId);
    if (
      pieceId === 'deck_surface' ||
      pieceId === 'deck_railing' ||
      pieceId === 'deck_stairs' ||
      SCOPE_FOUND_REMOVAL_BY_PIECE.has(pieceId)
    ) {
      continue;
    }
    if (!piece || seen.has(piece.line.id)) continue;
    seen.add(piece.line.id);
    lines.push(piece.line);
  }
  return lines;
}

function wantedLines(
  notes: string,
  id: ScopeFoundClarificationId,
  choice: ScopeFoundChoice | null,
  pieces: string[] = [],
  measurements?: Record<string, unknown> | null
): ClarificationLine[] {
  if (pieces.length) return linesForPieces(notes, pieces, measurements);
  if (id === 'flooring_demo' && flooringReplaceIncludesRemoval(notes) && choice == null) {
    return [flooringDemoLine(notes)];
  }
  if (!choice || NONE_OR_UNSURE.has(choice)) return [];
  if (id === 'flooring_demo' && choice === 'yes') return [flooringDemoLine(notes)];
  if (id === 'roof_tearoff' && choice === 'yes') {
    return [
      line(
        'tear_off',
        'Existing roof / tear-off',
        'Tear off the existing roof before the new shingles.',
        'roofing'
      ),
    ];
  }
  if (id === 'kitchen_demo') return kitchenLines(notes, choice);
  if (id === 'whole_home_demo' && choice === 'yes') return wholeHomeLines(notes);
  if (id === 'interior_paint_extent') return paintLines(choice);
  if (id === 'existing_structure' && choice === 'yes') {
    return [
      line(
        'existing_structure_demo',
        'Remove existing structure',
        'An existing house or garage comes out before the new work.',
        'demo'
      ),
    ];
  }
  return [];
}

function activeClarification(
  notes: string | null | undefined,
  storedId: unknown
): ScopeFoundClarification | null {
  const prompt = resolveScopeFoundClarification(notes);
  if (!prompt || prompt.id === 'shower') return null;
  const id = readScopeFoundClarificationId(storedId);
  if (id && id !== prompt.id) return null;
  return prompt;
}

function enteredRemovalSqft(
  measurements: { itemQuantities?: Record<string, { quantity?: unknown }> } | null | undefined,
  type: string
): number | null {
  const raw = measurements?.itemQuantities?.[`floor_demo__${type}`]?.quantity;
  const value = Number(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function scopeFoundRevealLines(
  notes: string | null | undefined,
  storedId: unknown,
  storedChoice: unknown,
  storedPieces?: unknown,
  measurements?: { itemQuantities?: Record<string, { quantity?: unknown }> } | null
): ScopeFoundRevealLine[] {
  const prompt = activeClarification(notes, storedId);
  const text = noteText(notes);
  const choice = readScopeFoundChoice(storedChoice);
  const pieces = scopeFoundPiecesForNote(
    text,
    prompt?.id || readScopeFoundClarificationId(storedId),
    readScopeFoundPieces(storedPieces)
  );
  if (pieces.length) {
    const area = flooringAreaForNote(text);
    const squares = statedSquares(text);
    const visiblePieces = pieces.filter(
      piece =>
        !isRemodelExtentPiece(piece) &&
        !GARAGE_HANG_PIECES.has(piece) &&
        piece !== GARAGE_NO_ADDITIONAL
    );
    const namedBaseboard = measurementsNameBaseboard(
      measurements as { typedTrimLabel?: unknown; typedScopeAddendum?: unknown } | null
    );
    const lines = visiblePieces.map(piece => ({
      name:
        piece === 'remodel_trim' && namedBaseboard
          ? 'Baseboard'
          : PIECE_REVEAL[piece] || TRADE_PIECE_BY_ID.get(piece)?.reveal || piece,
      amount: 0,
      quantity:
        piece.startsWith('remodel_') || piece === FRAMING_SHEATHING_PIECE
        ? remodelExtentSummary(pieces, piece) ||
          typedRemainderQuantity(piece, measurements)
        :
        piece === 'kitchen_floor'
          ? quantityLabel(statedKitchenFloorSqft(text), 'sqft')
          : piece === 'flooring'
            ? quantityLabel(area, 'sqft')
          : kitchenPieceQuantity(text, piece) ||
            (FLOOR_TYPE_BY_PIECE[piece]
              ? quantityLabel(
                  enteredRemovalSqft(measurements, FLOOR_TYPE_BY_PIECE[piece]) ||
                    area,
                  'sqft'
                )
              : SCOPE_FOUND_REMOVAL_BY_PIECE.has(piece)
                ? quantityLabel(
                    Number(
                      readScopeFoundRemovalQuantity(
                        measurements?.itemQuantities,
                        SCOPE_FOUND_REMOVAL_BY_PIECE.get(piece)?.quantityKey || ''
                      )
                    ) ||
                      (pieces.filter(item =>
                        STUCCO_REMOVAL_PIECE_IDS.includes(
                          item as (typeof STUCCO_REMOVAL_PIECE_IDS)[number]
                        )
                      ).length === 1
                        ? area
                        : null),
                    SCOPE_FOUND_REMOVAL_BY_PIECE.get(piece)?.unit === 'each'
                      ? 'each'
                      : 'sqft'
                  )
              : ['shingles', 'roof_tile', 'metal', 'flat'].includes(piece)
                ? quantityLabel(typedRoofTearOffSquares(measurements, piece), 'squares')
                : piece === 'deck_railing'
                  ? (() => {
                      const length = Number(
                        String(
                          (
                            measurements as { deckRailingDemoLf?: unknown } | null
                          )?.deckRailingDemoLf ?? ''
                        ).replace(/,/g, '')
                      );
                      if (!(length > 0)) return '';
                      return `${length.toLocaleString('en-US')} LF`;
                    })()
                  : piece === 'deck_stairs'
                  ? (() => {
                      const counted = Number(
                        String(
                          (
                            measurements as { deckStairDemoCount?: unknown } | null
                          )?.deckStairDemoCount ?? ''
                        ).replace(/,/g, '')
                      );
                      if (!(counted > 0)) return '';
                      return `${counted.toLocaleString('en-US')} ${counted === 1 ? 'flight' : 'flights'}`;
                    })()
                  : piece === 'drywall_walls'
                    ? quantityLabel(
                        statedDrywallRemovalSqft(text, 'walls', area || 0),
                        'sqft'
                      )
                    : piece === 'drywall_ceilings'
                      ? quantityLabel(
                          statedDrywallRemovalSqft(text, 'ceilings', area || 0),
                          'sqft'
                        )
                  : TRADE_PIECE_BY_ID.get(piece)?.area
                    ? quantityLabel(area, 'sqft')
                    : '1'),
    }));
    const demoLf = Number(
      String(
        (measurements as { baseboardDemoLf?: unknown } | null)?.baseboardDemoLf ?? ''
      ).replace(/,/g, '')
    );
    if (namedBaseboard && demoLf > 0) {
      const installAt = lines.findIndex(line => line.name === 'Baseboard');
      const demoLine = {
        name: 'Baseboard demo',
        amount: 0,
        quantity: `${demoLf.toLocaleString('en-US')} lf`,
      };
      if (installAt >= 0) lines.splice(installAt, 0, demoLine);
      else lines.push(demoLine);
    }
    return lines;
  }
  const lines = prompt
    ? wantedLines(text, prompt.id, choice)
    : flooringReplaceIncludesRemoval(text)
      ? wantedLines(text, 'flooring_demo', null)
      : [];
  return lines.map(item => ({
    name: item.label,
    amount: 0,
    quantity:
      item.id === 'floor_demo'
        ? quantityLabel(dedicatedFlooringAreaSqft(text) || statedArea(text), 'sqft')
        : item.id === 'tear_off'
          ? quantityLabel(statedSquares(text), 'squares')
          : '',
  }));
}

function withQuantity(
  quantities: Record<string, unknown>,
  id: string,
  quantity: number | null,
  unit: 'sqft' | 'squares' | 'lf' | 'each'
) {
  if (!quantity) {
    delete quantities[id];
    return;
  }
  quantities[id] = {
    quantity,
    unit,
    quantitySource: 'user_entered',
  };
}

/** Stores the answer and copies a stated area onto the demo line. Not sure adds nothing. */
export function measurementsForScopeFoundChoice<T extends Record<string, unknown>>(
  measurements: T | null | undefined,
  id: ScopeFoundClarificationId,
  choice: ScopeFoundChoice | string[],
  notes?: string | null
): T {
  const text = noteText(notes);
  const rawPieces = Array.isArray(choice) ? readScopeFoundPieces(choice) : [];
  const pieces = scopeFoundPiecesForNote(text, id, rawPieces);
  const declined = !Array.isArray(choice) ? choice : null;
  const next: Record<string, unknown> = { ...(measurements || {}) };
  next.scopeFoundClarificationId = id;
  next.scopeFoundPieces = pieces;
  next.scopeFoundChoice = declined;
  const quantities = {
    ...((next.itemQuantities as Record<string, unknown> | null | undefined) || {}),
  };
  const storedArea = Number(
    String(next.flooringSqft ?? next.floorDemoSqft ?? '').replace(/,/g, '')
  );
  const kitchenFloor =
    id === 'kitchen_demo'
      ? statedNumber(next.kitchenFloorSqft) ||
        statedNumber(next.flooringLvpSqft) ||
        statedKitchenFloorSqft(text) ||
        0
      : 0;
  const area =
    id === 'kitchen_demo'
      ? kitchenFloor
      : storedArea > 0
        ? storedArea
        : id === 'whole_home_demo'
          ? flooringAreaForNote(text) || 0
          : statedArea(text) || 0;
  const storedSquares = Number(String(next.roofSquares ?? '').replace(/,/g, ''));
  const squares = storedSquares > 0 ? storedSquares : statedSquares(text) || 0;
  const selected = new Set(pieces);
  const floorPieces = pieces
    .map(piece => FLOOR_TYPE_BY_PIECE[piece])
    .filter((type): type is string => Boolean(type));
  if (id === 'flooring_demo' || id === 'kitchen_demo' || id === 'whole_home_demo') {
    const floorOn =
      floorPieces.length > 0 ||
      selected.has('flooring') ||
      selected.has('kitchen_floor') ||
      declined === 'yes' ||
      declined === 'flooring' ||
      declined === 'all';
    if (floorOn && declined !== 'none' && declined !== 'unsure' && declined !== 'walls') {
      if (area > 0) next.floorDemoSqft = area;
      next.flooringExistingCount = 1;
      next.flooringExistingTypes = floorPieces.length ? floorPieces : ['unknown'];
      next.flooringDemoScopeCount = 1;
      withQuantity(quantities, 'floor_demo', area > 0 ? area : null, 'sqft');
    } else {
      next.floorDemoSqft = null;
      delete quantities.floor_demo;
    }
  }
  if (id === 'roof_tearoff' || ['shingles', 'roof_tile', 'metal', 'flat'].some(piece => selected.has(piece))) {
    const selections = {
      ...((next.tradeScopeSelections as Record<string, unknown> | null | undefined) || {}),
    };
    const roofing = Array.isArray(selections.roofing)
      ? (selections.roofing as string[]).filter(item => item !== 'tear_off')
      : [];
    if (declined === 'yes' || ['shingles', 'roof_tile', 'metal', 'flat'].some(piece => selected.has(piece))) {
      selections.roofing = [...roofing, 'tear_off'];
      withQuantity(quantities, 'tear_off', squares > 0 ? squares : null, 'squares');
      for (const card of ROOF_TEAR_OFF_CARDS) {
        if (!selected.has(card.piece)) delete quantities[card.id];
      }
    } else {
      selections.roofing = roofing.length ? roofing : null;
      delete quantities.tear_off;
      for (const card of ROOF_TEAR_OFF_CARDS) delete quantities[card.id];
    }
    next.tradeScopeSelections = selections;
  }
  if (id === 'kitchen_demo' || id === 'whole_home_demo') {
    const cabinets =
      selected.has('cabinets') ||
      declined === 'yes' ||
      declined === 'all' ||
      declined === 'cabinets';
    const floor =
      selected.has('flooring') ||
      selected.has('kitchen_floor') ||
      floorPieces.length > 0 ||
      declined === 'yes' ||
      declined === 'all' ||
      declined === 'flooring';
    next.kitchenDemoCabinetCount = cabinets ? 1 : null;
    next.kitchenDemoCounterCount =
      selected.has('countertops') ||
      declined === 'cabinets' ||
      declined === 'all' ||
      declined === 'yes'
        ? 1
        : null;
    const backsplash =
      selected.has('backsplash') ||
      declined === 'cabinets' ||
      declined === 'all' ||
      declined === 'yes';
    next.kitchenDemoBacksplashCount = backsplash ? 1 : null;
    next.kitchenDemoFloorCount = floor ? 1 : null;
    const island =
      selected.has('island') || declined === 'all' || declined === 'yes';
    next.kitchenDemoIslandCount = island ? 1 : null;
    next.kitchenExistingFloorCount = floor ? 1 : null;
    if (floor && area > 0) next.floorDemoSqft = area;
    if (!floor && declined) next.floorDemoSqft = null;
    if (id === 'kitchen_demo') {
      const cabinetLf = statedNumber(next.cabinetLf) || statedCabinetLf(text);
      const counterSqft =
        statedNumber(next.countertopSqft) ||
        statedSqftNear(
          text,
          /\bquartz\b|\bgranite\b|\bcountertops?\b|\bcounters\b/i
        );
      const splashSqft =
        statedNumber(next.backsplashSqft) ||
        statedSqftNear(text, /\bbacksplash\b|\bback\s*splash\b/i);
      if (!statedNumber(next.cabinetLf) && cabinetLf) next.cabinetLf = cabinetLf;
      if (!statedNumber(next.countertopSqft) && counterSqft) {
        next.countertopSqft = counterSqft;
      }
      if (!statedNumber(next.backsplashSqft) && splashSqft) {
        next.backsplashSqft = splashSqft;
      }
      if (!statedNumber(next.kitchenFloorSqft) && kitchenFloor) {
        next.kitchenFloorSqft = kitchenFloor;
      }
      const statedDemoLf = statedNumber(next.cabinetDemoLf);
      if (cabinets) {
        withQuantity(
          quantities,
          'cabinet_demo',
          statedDemoLf || cabinetLf || null,
          'lf'
        );
      }
      if (
        selected.has('countertops') ||
        declined === 'cabinets' ||
        declined === 'all' ||
        declined === 'yes'
      ) {
        withQuantity(quantities, 'countertop_demo', counterSqft || null, 'sqft');
      }
      if (backsplash) {
        withQuantity(quantities, 'backsplash_demo', splashSqft || null, 'sqft');
      } else {
        delete quantities.backsplash_demo;
      }
      if (island) {
        withQuantity(quantities, 'island_demo', 1, 'each');
      } else {
        delete quantities.island_demo;
      }
    }
  }
  const areaPiece =
    id !== 'excavation_demo' &&
    pieces.some(piece => TRADE_PIECE_BY_ID.get(piece)?.area);
  const concreteOn = ['concrete_slab', 'asphalt', 'concrete_pavers', 'gravel', 'site_concrete'].some(piece =>
    selected.has(piece)
  );
  const clearingOn = ['sod', 'landscape_rock', 'mulch', 'plants', 'site_trees', 'site_brush'].some(
    piece => selected.has(piece)
  );
  const drywallWalls = selected.has('drywall_walls');
  const drywallCeilings = selected.has('drywall_ceilings');
  const drywallOn = drywallWalls || drywallCeilings;
  if (concreteOn && area > 0 && id !== 'excavation_demo') {
    next.concreteDemoSqft = area;
  }
  if (!concreteOn || id === 'excavation_demo') {
    next.concreteDemoSqft = null;
  }
  if (clearingOn) next.demoClearingSqft = null;
  if (!clearingOn && (id === 'landscape_demo' || id === 'excavation_demo')) {
    next.demoClearingSqft = null;
  }
  if (drywallWalls) {
    next.wallDemoSqft = statedDrywallRemovalSqft(text, 'walls', area);
  }
  if (drywallCeilings) {
    const statedCeiling = statedDrywallRemovalSqft(text, 'ceilings', area);
    const existingCeiling = Number(
      String(next.drywallCeilingSqft ?? '').replace(/,/g, '')
    );
    const userEnteredCeiling = Boolean(
      (
        next.quickMeasurementUserOverrides as
          | Record<string, unknown>
          | null
          | undefined
      )?.drywallCeilingSqft
    );
    const wallArea = Number(String(next.wallDemoSqft ?? '').replace(/,/g, ''));
    const statedWall = statedDrywallRemovalSqft(text, 'walls', area);
    const copiedFromWalls =
      !userEnteredCeiling &&
      existingCeiling > 0 &&
      (existingCeiling === wallArea || existingCeiling === statedWall);
    if (statedCeiling != null) next.drywallCeilingSqft = statedCeiling;
    else if (userEnteredCeiling || (existingCeiling > 0 && !copiedFromWalls)) {
      next.drywallCeilingSqft = existingCeiling;
    } else next.drywallCeilingSqft = null;
  }
  if (!drywallOn && id === 'drywall_demo') {
    next.wallDemoSqft = null;
    next.drywallCeilingSqft = null;
  }
  if (id === 'drywall_demo' && !drywallWalls) next.wallDemoSqft = null;
  if (id === 'drywall_demo' && !drywallCeilings) next.drywallCeilingSqft = null;
  if (id === 'deck_demo') {
    const selections = {
      ...((next.tradeScopeSelections as Record<string, unknown> | null | undefined) ||
        {}),
    };
    const deckSelections = Array.isArray(selections.deck_patio)
      ? (selections.deck_patio as unknown[]).map(item => String(item))
      : [];
    const removalIds = ['deck_surface_demo', 'deck_railing_demo', 'deck_stairs_demo'];
    const kept = deckSelections.filter(item => !removalIds.includes(item));
    if (selected.has('deck_surface')) {
      kept.push('deck_surface_demo');
      if (area > 0) next.deckDemoSqft = area;
      withQuantity(quantities, 'deck_surface_demo', area > 0 ? area : null, 'sqft');
    } else {
      next.deckDemoSqft = null;
      delete quantities.deck_surface_demo;
    }
    if (selected.has('deck_railing')) {
      kept.push('deck_railing_demo');
    } else {
      next.deckRailingDemoLf = null;
      delete quantities.deck_railing_demo;
    }
    if (selected.has('deck_stairs')) {
      kept.push('deck_stairs_demo');
      const existingStairs = Number(
        String(next.deckStairDemoCount ?? '').replace(/,/g, '')
      );
      if (existingStairs > 0) {
        next.deckStairDemoCount = existingStairs;
        quantities.deck_stairs_demo = {
          quantity: existingStairs,
          unit: 'each',
          quantitySource: 'user_entered',
        };
      } else {
        next.deckStairDemoCount = null;
        delete quantities.deck_stairs_demo;
      }
    } else {
      next.deckStairDemoCount = null;
      delete quantities.deck_stairs_demo;
    }
    selections.deck_patio = kept.length ? kept : null;
    next.tradeScopeSelections = selections;
  }
  if (areaPiece && area > 0) {
    for (const pieceId of pieces) {
      const piece = TRADE_PIECE_BY_ID.get(pieceId);
      if (!piece?.area) continue;
      if (pieceId === 'drywall_walls') {
        withQuantity(
          quantities,
          'drywall_wall_demo',
          statedDrywallRemovalSqft(text, 'walls', area),
          'sqft'
        );
        continue;
      }
      if (pieceId === 'drywall_ceilings') {
        const keptCeiling = Number(
          String(next.drywallCeilingSqft ?? '').replace(/,/g, '')
        );
        withQuantity(
          quantities,
          'drywall_ceiling_demo',
          keptCeiling > 0
            ? keptCeiling
            : statedDrywallRemovalSqft(text, 'ceilings', area),
          'sqft'
        );
        continue;
      }
      if (pieceId === 'deck_surface') continue;
      if (SCOPE_FOUND_REMOVAL_BY_PIECE.has(pieceId)) continue;
      withQuantity(quantities, piece.line.id, area, 'sqft');
    }
  }
  const selectedStucco = STUCCO_REMOVAL_PIECE_IDS.filter(pieceId =>
    selected.has(pieceId)
  );
  const selectedSqftRows = SCOPE_FOUND_REMOVAL_MEASUREMENTS.filter(
    row => selected.has(row.pieceId) && row.unit === 'sqft'
  );
  let stuccoRemovalSqft = 0;
  for (const row of SCOPE_FOUND_REMOVAL_MEASUREMENTS) {
    if (!selected.has(row.pieceId)) {
      delete quantities[row.quantityKey];
      continue;
    }
    const existing = Number(
      String(
        (quantities[row.quantityKey] as { quantity?: unknown } | undefined)?.quantity ?? ''
      ).replace(/,/g, '')
    );
    if (
      id === 'excavation_demo' &&
      ((row.unit === 'each' && existing === 1) ||
        (row.unit === 'sqft' && existing === area))
    ) {
      delete quantities[row.quantityKey];
      continue;
    }
    if (existing > 0) {
      if (selectedStucco.includes(row.pieceId as (typeof STUCCO_REMOVAL_PIECE_IDS)[number])) {
        stuccoRemovalSqft += existing;
      }
      continue;
    }
    if (row.unit === 'each') {
      if (id === 'excavation_demo') continue;
      withQuantity(quantities, row.quantityKey, 1, 'each');
      continue;
    }
    const onlyThisArea =
      id !== 'excavation_demo' && selectedSqftRows.length === 1 && area > 0;
    if (onlyThisArea) {
      withQuantity(quantities, row.quantityKey, area, 'sqft');
      if (selectedStucco.includes(row.pieceId as (typeof STUCCO_REMOVAL_PIECE_IDS)[number])) {
        stuccoRemovalSqft += area;
      }
    }
  }
  if (selectedStucco.length) {
    withQuantity(
      quantities,
      'cladding_demo',
      stuccoRemovalSqft > 0 ? stuccoRemovalSqft : null,
      'sqft'
    );
  }
  if (selected.has('hvac_furnace') || selected.has('hvac_condenser') || selected.has('hvac_air_handler') || selected.has('hvac_ductwork')) {
    quantities.hvac_demo = { quantity: 1, unit: 'each', quantitySource: 'user_entered' };
  } else if (id === 'hvac_demo') {
    delete quantities.hvac_demo;
  }
  if (id === 'interior_paint_extent') {
    const surfaces = [
      selected.has('walls') ? 'walls' : null,
      selected.has('ceilings') ? 'ceilings' : null,
      selected.has('trim') ? 'trim' : null,
      selected.has('doors') ? 'doors' : null,
      selected.has('paint_cabinets') ? 'cabinets' : null,
    ].filter((surface): surface is string => Boolean(surface));
    next.paintScope = surfaces.length ? surfaces : null;
  }
  if (id === 'electrical_demo') {
    const removalCounts: Array<[string, string, string]> = [
      ['electrical_panel', 'panelRemovalCount', 'electrical_panel_removal'],
      ['electrical_fixtures', 'fixtureRemovalCount', 'electrical_fixture_removal'],
      ['electrical_wiring', 'abandonedCircuitCount', 'electrical_abandoned_circuit'],
    ];
    for (const [pieceId, key, itemId] of removalCounts) {
      if (selected.has(pieceId)) {
        const existing = Number(String(next[key] ?? '').replace(/,/g, ''));
        const quantity = existing > 0 ? existing : 1;
        next[key] = quantity;
        quantities[itemId] = { quantity, unit: 'each', quantitySource: 'user_entered' };
      } else {
        next[key] = null;
        delete quantities[itemId];
      }
    }
    delete quantities.electrical_demo;
  }
  if (id === 'remodel_remainder') {
    const bathOut: Array<[string, ShowerRemovalPiece]> = [
      ['extent_bath_out_tub', 'tub'],
      ['extent_bath_out_prefab_pan', 'prefab_pan'],
      ['extent_bath_out_tile_pan', 'tile_pan'],
      ['extent_bath_out_wall_tile', 'wall_tile'],
      ['extent_bath_out_enclosure', 'prefab_enclosure'],
      ['extent_bath_out_door', 'shower_door'],
      ['extent_bath_out_toilet', 'toilet'],
      ['extent_bath_out_vanity', 'vanity'],
      ['extent_bath_out_floor', 'bath_floor'],
    ];
    const removal = bathOut
      .filter(([piece]) => selected.has(piece))
      .filter(([piece]) => piece !== 'extent_bath_out_floor' || !selected.has('remodel_demo'))
      .map(([, piece]) => piece);
    const wallBefore = next.wallDemoSqft;
    const synced = measurementsForShowerRemovalChoice(
      next,
      removal.length ? removal : 'none',
      text
    );
    if (removal.includes('wall_tile')) {
      const typed = Number(String(wallBefore ?? '').replace(/,/g, ''));
      if (!(typed > 0)) {
        synced.wallDemoSqft = null;
        const syncedQuantities = {
          ...((synced.itemQuantities as Record<string, unknown> | null | undefined) || {}),
        };
        delete syncedQuantities.wall_demo;
        synced.itemQuantities = syncedQuantities;
      }
    }
    if (removal.includes('vanity')) {
      if (!(Number(synced.bathroomDemoVanityCount) > 0)) synced.bathroomDemoVanityCount = 1;
    } else {
      synced.bathroomDemoVanityCount = null;
    }
    Object.assign(next, synced);
    const syncedQuantities =
      (synced.itemQuantities as Record<string, unknown> | null | undefined) || {};
    Object.assign(quantities, syncedQuantities);
    if (!removal.includes('prefab_pan')) delete quantities.shower_floor_demo;
    if (!removal.includes('wall_tile')) delete quantities.wall_demo;
    if (selected.has('remodel_bathroom')) {
      const bathInEach: Array<[string, string]> = [
        ['extent_bath_in_tub', 'tub_install'],
        ['extent_bath_in_prefab_pan', 'prefab_shower_pan'],
        ['extent_bath_in_enclosure', 'prefab_shower_enclosure'],
        ['extent_bath_in_door', 'glass_door'],
        ['extent_bathroom_toilet', 'toilet'],
        ['extent_bathroom_vanity', 'vanity'],
      ];
      for (const [piece, itemId] of bathInEach) {
        if (selected.has(piece)) withQuantity(quantities, itemId, 1, 'each');
        else delete quantities[itemId];
      }
      next.showerDoorCount = selected.has('extent_bath_in_door')
        ? Number(next.showerDoorCount) > 0
          ? next.showerDoorCount
          : 1
        : null;
    }
  }
  next.itemQuantities = quantities;
  return next as unknown as T;
}

/** Adds the lines the answer confirmed. No demo and not sure add nothing. */
function ownedLineIds(id: string, notes = ''): string[] {
  if (id === 'remodel_remainder') {
    const prompt = remodelRemainderPrompt(notes);
    const open = new Set((prompt?.options || []).map(option => option.id));
    return [
      ...[...open]
        .map(pieceId => REMODEL_LINE_BY_PIECE.get(pieceId)?.id)
        .filter((itemId): itemId is string => Boolean(itemId)),
      ...REMODEL_EXTENT_PARENTS.filter(parent => open.has(parent.id)).flatMap(parent =>
        parentQuestions(parent).flatMap(question =>
          question.extents.flatMap(extent => (extent.lines || []).map(item => item.id))
        )
      ),
    ];
  }
  const base =
    OWNED_LINE_IDS[id as Exclude<ScopeFoundClarificationId, 'shower'>] || [];
  const trade = TRADE_DEMOS.find(item => item.id === id);
  const extra = (trade?.pieces || [])
    .map(piece => SCOPE_FOUND_REMOVAL_BY_PIECE.get(piece.id)?.quantityKey)
    .filter((key): key is string => Boolean(key));
  return [...base, ...extra];
}

export function applyScopeFoundClarification<T extends { id?: string | null }>(
  items: T[],
  notes: string | null | undefined,
  measurements: {
    scopeFoundClarificationId?: unknown;
    scopeFoundChoice?: unknown;
    scopeFoundPieces?: unknown;
    [key: string]: unknown;
  } | null | undefined
): T[] {
  const text = noteText(notes);
  const prompt = resolveScopeFoundClarification(text);
  const storedId = readScopeFoundClarificationId(measurements?.scopeFoundClarificationId);
  const choice = readScopeFoundChoice(measurements?.scopeFoundChoice);
  const pieces = scopeFoundPiecesForNote(
    text,
    prompt?.id || storedId,
    readScopeFoundPieces(measurements?.scopeFoundPieces)
  );
  const id = prompt && prompt.id !== 'shower' ? prompt.id : storedId;
  const impliedDemo =
    choice === 'none' ? [] : impliedWholeHomeDemoLines(text);
  if (!id || id === 'shower') {
    const replacement = impliedDemo.length ? impliedDemo : replacementDemoLines(text);
    if (!replacement.length) return items;
    return appendLines(
      items,
      replacement,
      impliedDemo.length ? ownedLineIds('whole_home_demo', text) : []
    );
  }
  if (prompt && storedId && storedId !== prompt.id) return items;
  if (!choice && !pieces.length) {
    if (impliedDemo.length && (!storedId || id === 'whole_home_demo')) {
      return appendLines(items, impliedDemo, ownedLineIds('whole_home_demo', text));
    }
    if (id === 'remodel_remainder' && storedId === 'remodel_remainder') {
      return appendLines(items, [], ownedLineIds(id, text));
    }
    const replacement = replacementDemoLines(text);
    if (!replacement.length) return items;
    return appendLines(items, replacement, []);
  }
  const owned = ownedLineIds(id, text);
  const wanted = wantedLines(
    text,
    id,
    choice,
    pieces,
    measurements as Record<string, unknown> | null | undefined
  );
  return appendLines(
    items,
    id === 'remodel_remainder' ? [...impliedDemo, ...wanted] : wanted,
    owned
  );
}

/** Baseboard typed on Scope Found stays on Confirm Scope after the note filter. */
export function withTypedTrimChoice<T extends { id?: string | null; state?: string | null }>(
  items: T[],
  measurements?: {
    scopeFoundPieces?: unknown;
    typedTrimLabel?: unknown;
    typedBaseboardInstall?: unknown;
    baseboardDemoLf?: unknown;
  } | null
): T[] {
  if (!readScopeFoundPieces(measurements?.scopeFoundPieces).includes('remodel_trim')) {
    return items;
  }
  const namedBaseboard = measurementsNameBaseboard(measurements);
  const trimIds = new Set(['trim', 'baseboard_install', 'interior_trim']);
  if (!namedBaseboard) {
    if (items.some(item => trimIds.has(String(item.id || '')) && item.state !== 'excluded')) {
      return items.map(item =>
        trimIds.has(String(item.id || ''))
          ? ({ ...item, state: 'included', noteBacked: true } as T)
          : item
      );
    }
    return [
      ...items.filter(item => !trimIds.has(String(item.id || ''))),
      {
        id: 'trim',
        inputType: 'yes_no',
        label: 'Trim',
        helperText: 'Baseboard and other interior trim. Enter the length.',
        category: 'trades',
        state: 'included',
        noteBacked: true,
      } as T,
    ];
  }
  const installId = 'baseboard_install';
  const installOff = String(measurements?.typedBaseboardInstall || '') === '0';
  const demoLf = Number(String(measurements?.baseboardDemoLf ?? '').replace(/,/g, ''));
  const drop = new Set(['trim', 'baseboard_install', 'interior_trim', 'baseboard_demo']);
  const kept = items.filter(item => {
    const id = String(item.id || '');
    if (!drop.has(id)) return true;
    return item.state === 'excluded';
  });
  const excluded = (id: string) =>
    items.some(item => String(item.id || '') === id && item.state === 'excluded');
  const next = [...kept];
  if (namedBaseboard && demoLf > 0 && !excluded('baseboard_demo')) {
    next.push({
      id: 'baseboard_demo',
      inputType: 'yes_no',
      label: 'Baseboard demo',
      helperText: 'Existing baseboard coming out.',
      category: 'trades',
      state: 'included',
      noteBacked: true,
    } as T);
  }
  if (!installOff && !excluded(installId)) {
    next.push({
      id: installId,
      inputType: 'yes_no',
      label: namedBaseboard ? 'Baseboard' : 'Trim',
      helperText: namedBaseboard
        ? 'New baseboard. Priced per linear foot.'
        : 'Baseboard and other interior trim. Enter the length.',
      category: 'trades',
      state: 'included',
      noteBacked: true,
    } as T);
  }
  return next;
}

/** Sheathing chosen on a framing note stays on the bid after the shell-only filter. */
export function withFramingSheathingChoice<T extends { id?: string | null }>(
  items: T[],
  measurements?: { scopeFoundPieces?: unknown } | null
): T[] {
  if (!readScopeFoundPieces(measurements?.scopeFoundPieces).includes(FRAMING_SHEATHING_PIECE)) {
    return items;
  }
  if (
    items.some(
      item =>
        item.id === 'shear_sheathing' &&
        (item as { state?: string }).state !== 'excluded'
    )
  ) {
    return items;
  }
  return [
    ...items.filter(item => item.id !== 'shear_sheathing'),
    {
      id: 'shear_sheathing',
      inputType: 'yes_no',
      label: 'Sheathing',
      helperText: 'Structural wall sheathing. Enter the sheathing area.',
      category: 'structure',
      state: 'included',
      noteBacked: true,
    } as T,
  ];
}

function appendLines<T extends { id?: string | null }>(
  items: T[],
  wanted: ClarificationLine[],
  ownedIds: string[]
): T[] {
  const wantedIds = new Set(wanted.map(item => item.id));
  const owned = new Set(ownedIds);
  const kept = items.filter(item => {
    const id = String(item.id || '');
    if (!owned.has(id)) return true;
    return wantedIds.has(id);
  });
  for (const item of wanted) {
    const existingIndex = kept.findIndex(existing => existing.id === item.id);
    if (existingIndex >= 0) {
      const existing = kept[existingIndex] as T & { state?: string };
      if (existing.state !== 'included') {
        kept[existingIndex] = {
          ...existing,
          state: 'included',
          noteBacked: true,
        } as T;
      }
      continue;
    }
    kept.push({
      id: item.id,
      label: item.label,
      helperText: item.helperText,
      inputType: 'yes_no',
      state: 'included',
      noteBacked: true,
      category: item.category,
    } as unknown as T);
  }
  return kept;
}
