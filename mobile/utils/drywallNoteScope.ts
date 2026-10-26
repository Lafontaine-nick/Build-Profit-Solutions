/**
 * A drywall-only note is a drywall bid.
 * Hang and finish keeps its own area. A patch named with "including" stays
 * visible and does not add a second charge. Any other patch is priced.
 * A patch-only note is the whole job: one patch card, no hang line.
 * Demolition stays unpriced until Quick measurements has a demolition area.
 */

import { notesNameAtticInsulationWithDrywallHang } from '@/utils/insulationNoteScope';
import { noteUsesSeparateJobReader } from '@/utils/noteClauseReader';

const OTHER_TRADE_RE =
  /\b(?:kitchen|bath(?:room)?|shower|vanity|toilet|flooring|lvp|laminate|vinyl|carpet|cabinets?|countertops?|plumbing|electrical|hvac|roof(?:ing)?|windows?|doors?|insulation|tile|siding|concrete|framing|paint(?:ing)?)\b/i;

export function notesDescribeDedicatedDrywallJob(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (!/\bhang\s+and\s+finish\b/i.test(text)) return false;
  const namesDrywall = /\b(?:drywall|sheetrock|gypsum)\b/i.test(text);
  const namesFinishWork = /\b(?:tape|mud|texture)\b/i.test(text);
  if (!namesDrywall && !namesFinishWork) return false;
  return !OTHER_TRADE_RE.test(text);
}

const FLOORING_BESIDE_DRYWALL_RE =
  /\b(?:flooring|lvp|luxury\s+vinyl|laminate|vinyl\s+plank|carpet)\b/i;
const DRYWALL_FLOORING_COMPANION_RE =
  /\b(?:kitchen|bath(?:room)?|shower|vanity|toilet|cabinets?|countertops?|plumbing|electrical|hvac|roof(?:ing)?|windows?|doors?|insulation|siding|concrete|framing|paint(?:ing)?)\b/i;

/** Drywall and flooring in one note, with no other trade named. */
export function notesNameDrywallBesideFlooring(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (
    /\bkitchen\s+(?:remodel|renovation|reno)\b|\bremodel\s+(?:the\s+)?kitchen\b/i.test(
      text
    ) ||
    /\b(?:bathroom|bath)\s+(?:remodel|renovation|reno)\b|\bremodel\s+(?:the\s+)?(?:bathroom|bath)\b/i.test(
      text
    ) ||
    /\b(?:whole|entire|full)\s+(?:existing\s+)?home\b/i.test(text)
  ) {
    return false;
  }
  if (!/\b(?:drywall|sheetrock|gypsum)\b/i.test(text)) return false;
  if (!FLOORING_BESIDE_DRYWALL_RE.test(text)) return false;
  const stripped = text
    .replace(/\b(?:drywall|sheetrock|gypsum)\b/gi, ' ')
    .replace(FLOORING_BESIDE_DRYWALL_RE, ' ');
  return !DRYWALL_FLOORING_COMPANION_RE.test(stripped);
}

/** Sqft tied to a trade with "N sqft of drywall" or "N sqft of LVP". */
export function drywallBesideFlooringAreas(
  notes: string | null | undefined
): { drywallSqft: number | null; flooringSqft: number | null } {
  if (!notesNameDrywallBesideFlooring(notes)) {
    return { drywallSqft: null, flooringSqft: null };
  }
  const text = String(notes || '');
  const owned =
    /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet))\s+of\s+(?:the\s+)?(drywall|sheetrock|gypsum|lvp|luxury\s+vinyl|laminate|vinyl\s+plank|carpet|flooring)\b/gi;
  let drywallSqft: number | null = null;
  let flooringSqft: number | null = null;
  for (const match of text.matchAll(owned)) {
    const qty = Number(String(match[1] || '').replace(/,/g, ''));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (/\b(?:drywall|sheetrock|gypsum)\b/i.test(match[2] || '')) {
      drywallSqft = qty;
    } else {
      flooringSqft = qty;
    }
  }
  return { drywallSqft, flooringSqft };
}

export function drywallBesideFlooringLineLabel(
  notes: string | null | undefined
): string {
  return /\b(?:lvp|luxury\s+vinyl)\b/i.test(String(notes || ''))
    ? 'LVP'
    : 'Flooring';
}

export function drywallBesideFlooringRevealRows(
  notes: string | null | undefined
): Array<{ id: string; name: string; quantity?: string }> {
  if (!notesNameDrywallBesideFlooring(notes)) return [];
  const areas = drywallBesideFlooringAreas(notes);
  const drywallName = notesNameDrywallFlooringPatchOnly(notes)
    ? 'Drywall patch / repair'
    : 'Drywall hang / finish';
  return [
    {
      id: notesNameDrywallFlooringPatchOnly(notes) ? 'patch_repair' : 'drywall',
      name: drywallName,
      ...(areas.drywallSqft ? { quantity: `${areas.drywallSqft} sqft` } : {}),
    },
    {
      id: 'flooring',
      name: drywallBesideFlooringLineLabel(notes),
      ...(areas.flooringSqft ? { quantity: `${areas.flooringSqft} sqft` } : {}),
    },
  ];
}

/** Patch wording beside flooring, with no hang. */
export function notesNameDrywallFlooringPatchOnly(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    notesNameDrywallBesideFlooring(text) &&
    /\b(?:patch(?:ing|es)?|repair)\b/i.test(text) &&
    !/\bhang\b/i.test(text)
  );
}

/** A sentence that asks for drywall demolition. "No demo" does not. */
export function notesRequestDrywallDemo(
  notes: string | null | undefined
): boolean {
  const sentences = String(notes || '').split(/(?<!\d)\.\s+/);
  return sentences.some(sentence => {
    if (
      /\b(?:no|without|not)\b[^.;]{0,24}\b(?:demo|demolition|removal|remove)\b/i.test(
        sentence
      )
    ) {
      return false;
    }
    return (
      /\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b/i.test(sentence) &&
      /\b(?:drywall|sheetrock|gypsum|damaged)\b/i.test(sentence)
    );
  });
}

/**
 * "Sheetrock 900 sqft with tape, mud, and texture." is a hang-and-finish bid
 * even without the phrase "hang and finish."
 */
export function notesDescribeSheetrockFinishJob(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (notesDescribeDedicatedDrywallJob(text)) return false;
  if (notesDescribeDedicatedDrywallPatchJob(text)) return false;
  if (notesDescribeNoteRatedDrywallJob(text)) return false;
  if (OTHER_TRADE_RE.test(text)) return false;
  if (/\b(?:patch(?:ing|es)?|repair)\b/i.test(text)) return false;
  if (!/\b(?:drywall|sheetrock|gypsum)\b/i.test(text)) return false;
  return /\b(?:hang|tape|mud|texture)\b/i.test(text);
}

/**
 * "Patch and texture 300 sqft of drywall. No new hang." is a drywall bid.
 * It is not a hang-and-finish job, so it does not get a hang card.
 */
export function notesDescribeDedicatedDrywallPatchJob(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (notesDescribeDedicatedDrywallJob(text)) return false;
  if (!/\b(?:drywall|sheetrock|gypsum)\b/i.test(text)) return false;
  if (!/\b(?:patch(?:ing|es)?|repair)\b/i.test(text)) return false;
  return !OTHER_TRADE_RE.test(text);
}

/**
 * "Drywall in the addition" is hang and finish.
 * A patch, or any other trade, stays on its own path.
 */
export function notesDescribeAdditionDrywallJob(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (notesDescribeDedicatedDrywallJob(text)) return false;
  if (notesDescribeDedicatedDrywallPatchJob(text)) return false;
  if (!/\b(?:drywall|sheetrock|gypsum)\b/i.test(text)) return false;
  if (!/\baddition\b/i.test(text)) return false;
  if (/\b(?:patch(?:ing|es)?|repair)\b/i.test(text)) return false;
  return !OTHER_TRADE_RE.test(text);
}

/** Hang-and-finish notes and patch-only notes both use the drywall checklist. */
export function notesUseDedicatedDrywallScope(
  notes: string | null | undefined
): boolean {
  return (
    notesDescribeDedicatedDrywallJob(notes) ||
    notesDescribeDedicatedDrywallPatchJob(notes) ||
    notesDescribeAdditionDrywallJob(notes)
  );
}

/**
 * "Hang drywall 1,200 sqft material $1.50 … Tape and finish 1,200 sqft labor $2.25"
 * states its own rates. It is a drywall bid, and those rates stay on the cards.
 */
export function notesDescribeNoteRatedDrywallJob(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (notesDescribeDedicatedDrywallJob(text)) return false;
  if (notesDescribeDedicatedDrywallPatchJob(text)) return false;
  if (OTHER_TRADE_RE.test(text)) return false;
  const sentences = text.split(/(?<!\d)\.\s+/);
  const priced = (sentence: string) => /\$\s*\d/.test(sentence);
  const hangRated = sentences.some(
    sentence =>
      /\bhang\s+drywall\b/i.test(sentence) &&
      /\bmaterials?\b/i.test(sentence) &&
      /\blabor\b/i.test(sentence) &&
      priced(sentence)
  );
  const finishRated = sentences.some(
    sentence =>
      /\b(?:tape(?:\s+and\s+finish)?|finish\s+drywall|tape\s+and\s+mud)\b/i.test(
        sentence
      ) &&
      /\blabor\b/i.test(sentence) &&
      priced(sentence)
  );
  return hangRated && finishRated;
}

function hangFinishHelper(notes: string): string {
  const parts = [
    /\btape\b/i.test(notes) ? 'tape' : '',
    /\bmud\b/i.test(notes) ? 'mud' : '',
    /\bsanding\b/i.test(notes) ? 'sanding' : '',
    /\btexture\b/i.test(notes) ? 'texture' : '',
  ].filter(Boolean);
  if (!parts.length) return 'Hang and finish.';
  if (parts.length === 1) return `Hang and finish, including ${parts[0]}.`;
  const last = parts[parts.length - 1];
  return `Hang and finish, including ${parts.slice(0, -1).join(', ')}, and ${last}.`;
}

/** "Remove 500 sqft of damaged drywall" states the demolition area. */
export function statedDedicatedDrywallDemoSqft(
  notes: string | null | undefined
): number | null {
  const text = String(notes || '');
  const quantity = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet))`;
  const surface = String.raw`(?:drywall|sheetrock|gypsum)`;
  const demoVerb = String.raw`(?:demo|demolition|demolish|remove|removal|tear[\s-]?out)`;
  const patterns = [
    new RegExp(
      String.raw`\b${demoVerb}\b[^.;\n]{0,40}?${quantity}\b[^.;\n]{0,30}\b(?:of\s+)?(?:damaged\s+)?${surface}\b`,
      'i'
    ),
    new RegExp(
      String.raw`${quantity}\b[^.;\n]{0,30}\b(?:of\s+)?(?:damaged\s+)?${surface}\b[^.;\n]{0,40}?\b${demoVerb}\b`,
      'i'
    ),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = match?.[1] ? Number(match[1].replace(/,/g, '')) : null;
    if (parsed && Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/** "including 300 sqft of patch repair" sits inside the hang / finish area. */
export function notesIncludeDrywallPatchInHang(
  notes: string | null | undefined
): boolean {
  if (!notesDescribeDedicatedDrywallJob(notes)) return false;
  return /\bincluding\b[^.]{0,160}\b(?:patch(?:ing)?|repair)\b/i.test(
    String(notes || '')
  );
}

/**
 * Suppress the patch dollars only when the note includes the patch and the
 * patch area fits inside the hang / finish area.
 */
export function dedicatedDrywallIncludedPatchSqft(
  notes: string | null | undefined,
  measurements: { drywallSqft?: unknown; patchRepairSqft?: unknown } | null | undefined
): { hangSqft: number; patchSqft: number } | null {
  if (!notesIncludeDrywallPatchInHang(notes)) return null;
  const hangSqft = positiveSqft(measurements?.drywallSqft);
  const patchSqft = positiveSqft(measurements?.patchRepairSqft);
  if (hangSqft == null || patchSqft == null || patchSqft > hangSqft) return null;
  return { hangSqft, patchSqft };
}

/**
 * Confirm Scope renames the drywall sqft field for ordinary repair notes.
 * A dedicated hang-and-finish note keeps the field's own hang / finish label.
 * Returns null when the caller should leave the field label alone.
 */
export function confirmScopeDrywallSqftLabel(
  notes: string | null | undefined,
  options: { installNamed: boolean; repairNamed: boolean }
): string | null {
  if (notesDescribeDedicatedDrywallJob(notes)) return null;
  if (notesDescribeSheetrockFinishJob(notes)) return null;
  if (
    /\bhang\s+and\s+finish\b/i.test(String(notes || '')) &&
    /\b(?:lvp|luxury\s+vinyl|laminate|vinyl\s+plank)\b/i.test(String(notes || ''))
  ) {
    return 'Drywall hang / finish';
  }
  if (notesDescribeNoteRatedDrywallJob(notes)) return 'Drywall hang / finish';
  if (notesNameAtticInsulationWithDrywallHang(notes)) return 'Drywall hang / finish';
  if (notesNameDrywallBesideFlooring(notes)) {
    return notesNameDrywallFlooringPatchOnly(notes)
      ? 'Drywall patch / repair'
      : 'Drywall hang / finish';
  }
  if (
    noteUsesSeparateJobReader(notes) &&
    /\bhang\b/i.test(String(notes || ''))
  ) {
    return 'Drywall hang / finish';
  }
  if (options.installNamed && !options.repairNamed) return 'Drywall install';
  if (
    /\b(?:new\s+build|new\s+construction|ground[\s-]?up|custom\s+home|spec\s+home)\b/i.test(
      String(notes || '')
    ) ||
    /\bnew\s+[\d,]+\s*(?:sq\.?\s*ft|sqft|square\s+feet)\b[^.]{0,48}\b(?:home|house)\b/i.test(
      String(notes || '')
    )
  ) {
    return null;
  }
  const namedWholeHome =
    /\b(?:whole|entire|full)[\s-]+(?:house|home)\b|\b(?:house|home)\s+remodel\b|\bremodel(?:ing)?\s+(?:the\s+)?(?:whole\s+|entire\s+)?(?:house|home)\b/i.test(
      String(notes || '')
    );
  if (namedWholeHome && !options.repairNamed) return 'Drywall';
  return 'Drywall repair area';
}

export function dedicatedDrywallConfirmScopeItems(
  notes: string | null | undefined
): Array<{
  id: string;
  inputType: 'yes_no';
  label: string;
  helperText: string;
  category: string;
  state: 'included';
  noteBacked: true;
}> {
  const text = String(notes || '');
  const patchOnly = notesDescribeDedicatedDrywallPatchJob(text);
  const items: Array<{
    id: string;
    inputType: 'yes_no';
    label: string;
    helperText: string;
    category: string;
    state: 'included';
    noteBacked: true;
  }> = [];
  if (notesRequestDrywallDemo(text)) {
    items.push({
      id: 'demo_removal',
      inputType: 'yes_no',
      label: 'Drywall demo / removal',
      helperText: statedDedicatedDrywallDemoSqft(text)
        ? `Remove ${statedDedicatedDrywallDemoSqft(text)!.toLocaleString()} sqft of damaged drywall.`
        : 'Remove damaged drywall. Enter the demolition area in Quick measurements.',
      category: 'Drywall',
      state: 'included',
      noteBacked: true,
    });
  }
  if (!patchOnly) {
    items.push({
      id: 'drywall',
      inputType: 'yes_no',
      label: 'Drywall hang / finish',
      helperText: hangFinishHelper(text),
      category: 'Drywall',
      state: 'included',
      noteBacked: true,
    });
  }
  if (/\b(?:patch(?:ing)?|repair)\b/i.test(text)) {
    const texture = /\btexture\b/i.test(text);
    const noNewHang = /\bno\s+new\s+hang\b/i.test(text);
    items.push({
      id: 'patch_repair',
      inputType: 'yes_no',
      label: 'Drywall patch / repair',
      helperText: notesIncludeDrywallPatchInHang(text)
        ? 'Included in the hang / finish area. No separate charge.'
        : patchOnly
          ? `${texture ? 'Patch and texture' : 'Patch repair area stated in the notes'}${
              noNewHang ? '. No new hang.' : '.'
            }`
          : 'Patch repair area stated in the notes.',
      category: 'Drywall',
      state: 'included',
      noteBacked: true,
    });
  }
  return items;
}

export function noteRatedDrywallConfirmScopeItems(
  _notes: string | null | undefined
): Array<{
  id: string;
  inputType: 'yes_no';
  label: string;
  helperText: string;
  category: string;
  state: 'included';
  noteBacked: true;
}> {
  return [
    {
      id: 'hang',
      inputType: 'yes_no',
      label: 'Hang drywall',
      helperText: 'Hang at the material and labor rates in the notes.',
      category: 'Drywall',
      state: 'included',
      noteBacked: true,
    },
    {
      id: 'finish_tape',
      inputType: 'yes_no',
      label: 'Tape / mud / finish',
      helperText: 'Tape and finish labor from the notes.',
      category: 'Drywall',
      state: 'included',
      noteBacked: true,
    },
  ];
}

function positiveSqft(value: unknown): number | null {
  const quantity = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

/** Scope found quantity for a dedicated drywall note. Demo stays blank. */
export function dedicatedDrywallRevealQuantity(
  id: string,
  measurements: { drywallSqft?: unknown; patchRepairSqft?: unknown } | null
): string | null | undefined {
  if (!measurements) return undefined;
  if (id === 'demo' || id === 'demo_removal') return null;
  if (id === 'drywall' || id === 'hang' || id === 'finish_tape') {
    const hang = positiveSqft(measurements.drywallSqft);
    return hang ? `${hang} sqft` : null;
  }
  if (id === 'patch_repair') {
    const patch = positiveSqft(measurements.patchRepairSqft);
    return patch ? `${patch} sqft` : null;
  }
  return undefined;
}
