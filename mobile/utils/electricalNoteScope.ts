import {
  ELECTRICAL_CARDS,
  parseElectricalMeasurementsFromNotes,
  type ElectricalCardDefinition,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';

function notesAreElectricalOnly(notes: string | null | undefined): boolean {
  const text = String(notes || '');
  const hasElectricalSignal =
    /\b(?:electrical|wiring|outlets?|receptacles?|panel|circuits?|switch(?:es)?|gfci|recessed\s+(?:lights?|cans?)|conduit)\b/i.test(
      text
    );
  const hasCompanionTrade =
    /\b(?:plumbing|hvac|framing|roof(?:ing)?|drywall|flooring|lvp|tile|cabinets?|concrete|foundation|insulat(?:e|ion|ed)|windows?|doors?|paint(?:ing)?|landscap(?:e|ing)|sod|pavers?|toilets?)\b/i.test(
      text
    );
  return hasElectricalSignal && !hasCompanionTrade;
}

export type DedicatedElectricalCard = ElectricalCardDefinition & {
  count: number;
};

/** Device and circuit cards the note actually counted. Unnamed electrical lines stay off. */
export function dedicatedElectricalNamedCards(
  notes: string | null | undefined
): DedicatedElectricalCard[] {
  if (!notesAreElectricalOnly(notes)) return [];
  const parsed = parseElectricalMeasurementsFromNotes(String(notes || ''));
  return ELECTRICAL_CARDS.flatMap(card => {
    const count = Number(parsed[card.measurementKey]);
    if (!Number.isFinite(count) || count <= 0) return [];
    return [{ ...card, count }];
  });
}

export function notesDescribeDedicatedElectricalDeviceJob(
  notes: string | null | undefined
): boolean {
  return dedicatedElectricalNamedCards(notes).length > 0;
}

function receptaclesWithToiletCount(notes: string): number | null {
  const match = notes.match(/\b(\d+|one)\s+toilets?\b/i);
  if (!match) return null;
  if (match[1].toLowerCase() === 'one') return 1;
  const count = Number(match[1]);
  return Number.isFinite(count) && count > 0 ? count : null;
}

/** Counted receptacles plus a toilet. A bathroom remodel is a different job. */
export function notesNameReceptaclesWithToilet(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (!text.trim()) return false;
  if (
    /\b(?:bathroom|bath)\s+(?:remodel|renovation)\b|\bremodel(?:\s+\w+){0,4}\s+bathroom\b/i.test(
      text
    )
  ) {
    return false;
  }
  const parsed = parseElectricalMeasurementsFromNotes(text);
  const receptacles = Number(parsed.standardReceptacleCount);
  if (!(receptacles > 0) || receptaclesWithToiletCount(text) == null) return false;
  const otherElectrical = Object.entries(parsed).some(
    ([key, value]) => key !== 'standardReceptacleCount' && Number(value) > 0
  );
  if (otherElectrical) return false;
  const stripped = text.replace(/\b(?:receptacles?|outlets?|toilets?)\b/gi, ' ');
  return !/\b(?:vanity|shower|tub|bathtub|tile|drywall|flooring|lvp|paint(?:ing)?|cabinets?|windows?|fram(?:e|ing)|hvac|doors?|kitchen|bath(?:room)?)\b/i.test(
    stripped
  );
}

export function receptaclesWithToiletRevealRows(
  notes: string | null | undefined
): Array<{ id: string; name: string; quantity?: string }> {
  if (!notesNameReceptaclesWithToilet(notes)) return [];
  const text = String(notes || '');
  const receptacles = Number(
    parseElectricalMeasurementsFromNotes(text).standardReceptacleCount
  );
  const toilets = receptaclesWithToiletCount(text);
  return [
    {
      id: 'electrical_standard_receptacle',
      name: 'Standard receptacles',
      ...(receptacles > 0 ? { quantity: `${receptacles} each` } : {}),
    },
    {
      id: 'toilet',
      name: 'Toilet',
      ...(toilets ? { quantity: `${toilets} each` } : {}),
    },
  ];
}

/** Confirm Scope rows for this pair. The toilet is a replace choice, not a Yes/No. */
export function receptaclesWithToiletChecklistItems(): Array<{
  id: string;
  inputType: 'yes_no' | 'choice';
  label: string;
  helperText: string;
  category: string;
  state: 'included';
  noteBacked: true;
  choiceId?: string;
  options?: Array<{ id: string; label: string }>;
}> {
  return [
    {
      id: 'electrical_standard_receptacle',
      inputType: 'yes_no',
      label: 'Standard receptacles',
      helperText: 'Receptacle count from the job notes.',
      category: 'electrical',
      state: 'included',
      noteBacked: true,
    },
    {
      id: 'toilet',
      inputType: 'choice',
      label: 'Toilet',
      helperText: 'Replace the toilet named in the job notes.',
      category: 'plumbing',
      state: 'included',
      choiceId: 'replacing',
      noteBacked: true,
      options: [
        { id: 'reset', label: 'Reset' },
        { id: 'replacing', label: 'Replacing' },
        { id: 'relocating', label: 'Relocating' },
        { id: 'not_in_scope', label: 'Not in this bid' },
        { id: 'unsure', label: 'Not sure yet' },
      ],
    },
  ];
}

/** Labor condition the note actually states. A blank card is not a question. */
export function notesNameElectricalJobCondition(
  notes: string | null | undefined
): boolean {
  return /\b(?:new\s+construction|new\s+build|full\s+rough(?:[\s-]?in)?|open[\s-]?frame|finished[\s-]?wall|retrofit|service\s+call|open[\s-]?wall|walls?\s+open)\b|\bremodel\b/i.test(
    String(notes || '')
  );
}

/** Panel or service size the note actually states. */
export function notesNameElectricalServiceAmperage(
  notes: string | null | undefined
): boolean {
  return /\b\d+\s*(?:amp(?:ere)?s?|a)\s+(?:service|panel|main)\b|\b(?:service|panel)\s*(?:is|:)?\s*\d+\s*(?:amp(?:ere)?s?|a)\b|\b(?:main\s+)?panel\b|\bservice\s+(?:upgrade|size|amperage)\b/i.test(
    String(notes || '')
  );
}

export function dedicatedElectricalRevealLines(
  notes: string | null | undefined
): string[] {
  return dedicatedElectricalNamedCards(notes).map(card => {
    const unit =
      card.unit === 'lf' ? 'LF' : card.unit === 'amp' ? 'A' : 'each';
    return `${card.label} · ${card.count} ${unit}`;
  });
}

export function dedicatedElectricalRevealRows(
  notes: string | null | undefined
): Array<{ name: string; amount: number; quantity: string }> {
  return dedicatedElectricalNamedCards(notes).map(card => {
    const unit =
      card.unit === 'lf' ? 'LF' : card.unit === 'amp' ? 'A' : 'each';
    return {
      name: card.label,
      amount: 0,
      quantity: `${card.count} ${unit}`,
    };
  });
}

export function filterDedicatedElectricalConfirmItems<
  T extends { id?: string | null; state?: string | null; noteBacked?: boolean | null },
>(
  items: T[],
  notes?: string | null,
  options?: { planBacked?: boolean }
): T[] {
  if (options?.planBacked) return items;
  if (!notesDescribeDedicatedElectricalDeviceJob(notes)) return items;
  const cards = dedicatedElectricalNamedCards(notes);
  const byId = new Map(items.map(item => [String(item.id || ''), item]));
  const named = cards
    .map(card => byId.get(card.itemId))
    .filter((item): item is T => Boolean(item))
    .map(item => ({
      ...item,
      state: 'included' as T['state'],
      noteBacked: true,
    }));
  const custom = items.filter(item =>
    String(item.id || '').startsWith('custom_')
  );
  return [...named, ...custom];
}
