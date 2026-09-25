/**
 * Structured plan takeoff. Each finding is either read from a sheet or left
 * as a planning allowance. Related sheets join into one scope when a room
 * name ties them together.
 */

import { finishLabelForSchedule } from '@/utils/finishScheduleScope';
import { garageDoorCountsFromLabeledBays } from '@/utils/subcontractorTrade/garageDoorsPlanConvergence';

export type PlanScopeFindingStatus =
  | 'read_from_plan'
  | 'counted_from_drawings'
  | 'planning_allowance';

export type PlanScopeFinding = {
  id: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  status: PlanScopeFindingStatus;
  sheet: string | null;
  page: number | null;
  sourceText: string | null;
};

export type PlanScopeRecord = {
  id: string;
  title: string;
  findings: PlanScopeFinding[];
};

export type PlanScopeRecordInput = {
  rooms?: Array<{
    name?: string | null;
    areaSqft?: number | null;
    lengthFt?: number | null;
    widthFt?: number | null;
    sourceSheet?: string | null;
    sourcePage?: number | null;
  }> | null;
  measurements?: Record<string, unknown> | null;
  buildingAreas?: Record<string, unknown> | null;
  fixtureInventory?: Record<string, number> | null;
  fieldEvidence?: Record<
    string,
    Array<{ sheet?: string; page?: number; sourceText?: string; label?: string }>
  > | null;
  openingEvidence?: Array<{
    category?: string | null;
    location?: string | null;
    type?: string | null;
    mark?: string | null;
    sheet?: string | null;
    page?: number | null;
    sourceText?: string | null;
  }> | null;
  finishSchedule?: Array<{
    room?: string | null;
    floor?: string | null;
    wall?: string | null;
    base?: string | null;
    ceiling?: string | null;
    glassDoor?: boolean;
    sheet?: string | null;
    page?: number | null;
    sourceText?: string | null;
  }> | null;
};

const READ_MEASUREMENTS: Array<{
  key: string;
  label: string;
  unit: string;
}> = [
  { key: 'floorAreaSqft', label: 'Living area', unit: 'sqft' },
  { key: 'garageSqft', label: 'Garage area', unit: 'sqft' },
  { key: 'deckSqft', label: 'Deck / patio', unit: 'sqft' },
  { key: 'windowCount', label: 'Windows', unit: 'each' },
  { key: 'exteriorDoorCount', label: 'Exterior doors', unit: 'each' },
  { key: 'slidingDoorCount', label: 'Sliding doors', unit: 'each' },
  { key: 'interiorDoorCount', label: 'Interior doors', unit: 'each' },
  { key: 'garageDoorSingleCount', label: 'Single garage doors', unit: 'each' },
  { key: 'garageDoorDoubleCount', label: 'Double garage doors', unit: 'each' },
  { key: 'garageDoorRvCount', label: 'RV / oversized garage doors', unit: 'each' },
  { key: 'recessedLightCount', label: 'Recessed lights', unit: 'each' },
  { key: 'ceilingFanCount', label: 'Ceiling fans', unit: 'each' },
  { key: 'bathExhaustFanCount', label: 'Exhaust fans', unit: 'each' },
  { key: 'singlePoleSwitchCount', label: 'Switches', unit: 'each' },
  { key: 'threeWaySwitchCount', label: '3-way switches', unit: 'each' },
];

/** Drawn on elevations or the electrical sheet. A missing count is a failed read. */
const DRAWN_BUT_UNCOUNTED: Array<{ id: string; label: string; keys: string[] }> = [
  { id: 'windows', label: 'Windows', keys: ['windowCount'] },
  { id: 'exterior_doors', label: 'Exterior doors', keys: ['exteriorDoorCount'] },
  { id: 'sliding_doors', label: 'Sliding doors', keys: ['slidingDoorCount'] },
  { id: 'interior_doors', label: 'Interior doors', keys: ['interiorDoorCount'] },
  { id: 'switches', label: 'Switches', keys: ['singlePoleSwitchCount', 'threeWaySwitchCount'] },
  { id: 'ceiling_fans', label: 'Ceiling fans', keys: ['ceilingFanCount'] },
  { id: 'exhaust_fans', label: 'Exhaust fans', keys: ['bathExhaustFanCount'] },
];

/** No printed quantity on a typical architectural set. Stay a planning allowance. */
const NOT_PRINTED: Array<{ id: string; label: string; keys: string[] }> = [
  { id: 'excavation', label: 'Excavation', keys: ['excavationCy'] },
  { id: 'foundation', label: 'Foundation', keys: ['concreteCy'] },
  { id: 'flatwork', label: 'Exterior flatwork', keys: ['concreteSqft'] },
  { id: 'drywall', label: 'Drywall', keys: ['drywallSqft'] },
  { id: 'insulation', label: 'Insulation', keys: ['exteriorWallInsulationSqft', 'atticInsulationSqft'] },
  { id: 'interior_paint', label: 'Interior paint', keys: ['wallPaintSqft'] },
  { id: 'exterior_paint', label: 'Exterior paint', keys: ['exteriorPaintSqft'] },
  { id: 'roofing', label: 'Roofing', keys: ['roofSquares'] },
];

export const WHOLE_PROJECT_DRAWING_COUNT_KEYS = new Set([
  'windowCount',
  'exteriorDoorCount',
  'slidingDoorCount',
  'interiorDoorCount',
  'singlePoleSwitchCount',
  'threeWaySwitchCount',
  'ceilingFanCount',
  'bathExhaustFanCount',
]);

const FIXTURE_LABELS: Record<string, string> = {
  toilets: 'Toilets',
  lavatories: 'Lavatories',
  showers: 'Showers',
  tubs: 'Tubs',
  kitchenSinks: 'Kitchen sinks',
  laundryBoxes: 'Laundry boxes',
  hoseBibs: 'Hose bibs',
  floorDrains: 'Floor drains',
  waterHeaters: 'Water heaters',
};

function positive(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function evidenceFor(
  input: PlanScopeRecordInput,
  key: string
): { sheet: string | null; page: number | null; sourceText: string | null } {
  const entry = input.fieldEvidence?.[key]?.[0];
  return {
    sheet: entry?.sheet || entry?.label || null,
    page: entry?.page ?? null,
    sourceText: entry?.sourceText || null,
  };
}

function finding(input: {
  id: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  status: PlanScopeFindingStatus;
  sheet?: string | null;
  page?: number | null;
  sourceText?: string | null;
}): PlanScopeFinding {
  return {
    id: input.id,
    label: input.label,
    quantity: input.quantity,
    unit: input.unit,
    status: input.status,
    sheet: input.sheet || null,
    page: input.page ?? null,
    sourceText: input.sourceText || null,
  };
}

function isWetOrKitchen(name: string): boolean {
  return /\b(bath|bathroom|kitchen|powder|sauna|w\.?i\.?s)\b/i.test(name);
}

function openingLabel(category: string | null | undefined): string {
  switch (String(category || '')) {
    case 'window':
      return 'Window';
    case 'exterior_swing':
      return 'Exterior door';
    case 'sliding':
      return 'Sliding door';
    case 'interior':
      return 'Interior door';
    default:
      return 'Opening';
  }
}

/** Scope found lines. Room cards stay as one spaces count so they do not replace the cover sheet. */
export function planScopeRecordSummaryLines(
  records: PlanScopeRecord[] | null | undefined
): string[] {
  const lines: string[] = [];
  let roomCount = 0;
  for (const record of records || []) {
    if (record.id.startsWith('room-')) {
      roomCount += 1;
      continue;
    }
    for (const item of record.findings) {
      lines.push(formatPlanScopeFinding(item));
    }
  }
  if (roomCount > 0) {
    lines.push(
      `${roomCount} space${roomCount === 1 ? '' : 's'} detected on the plan`
    );
  }
  return lines;
}

export function formatPlanScopeFinding(item: PlanScopeFinding): string {
  const qty =
    item.quantity != null && item.unit
      ? `${item.quantity.toLocaleString()} ${item.unit} · `
      : '';
  const where = [item.sheet, item.page != null ? `p.${item.page}` : null]
    .filter(Boolean)
    .join(' ');
  const status =
    item.status === 'read_from_plan'
      ? 'Read from the plan'
      : item.status === 'counted_from_drawings'
        ? 'Counted from the drawings — confirm'
        : 'Planning allowance';
  return `${qty}${item.label} · ${status}${where ? ` · ${where}` : ''}`;
}

export function buildPlanScopeRecords(
  input: PlanScopeRecordInput
): PlanScopeRecord[] {
  const measurements = { ...(input.measurements || {}) };
  const bayCounts = garageDoorCountsFromLabeledBays(input.rooms);
  if (bayCounts) {
    if (positive(measurements.garageDoorSingleCount) == null && bayCounts.single > 0) {
      measurements.garageDoorSingleCount = bayCounts.single;
    }
    if (positive(measurements.garageDoorDoubleCount) == null && bayCounts.double > 0) {
      measurements.garageDoorDoubleCount = bayCounts.double;
    }
    if (positive(measurements.garageDoorRvCount) == null && bayCounts.rv > 0) {
      measurements.garageDoorRvCount = bayCounts.rv;
    }
  }
  const areas = input.buildingAreas || {};
  const areaValue = (key: string) =>
    positive(measurements[key]) ??
    positive(
      key === 'floorAreaSqft'
        ? areas.totalLivingSqft
        : key === 'garageSqft'
          ? areas.garageSqft
          : key === 'deckSqft'
            ? areas.coveredPatioSqft ?? areas.deckSqft
            : null
    );

  const projectFindings = READ_MEASUREMENTS.flatMap(row => {
    if (!['floorAreaSqft', 'garageSqft', 'deckSqft'].includes(row.key)) return [];
    const quantity = areaValue(row.key);
    if (quantity == null) return [];
    const evidence = evidenceFor(input, row.key);
    return [
      finding({
        id: row.key,
        label: row.label,
        quantity,
        unit: row.unit,
        status: 'read_from_plan',
        ...evidence,
      }),
    ];
  });

  const consumedOpeningIds = new Set<string>();
  const roomRecords: PlanScopeRecord[] = [];
  (input.rooms || []).forEach((room, index) => {
    const name = String(room?.name || '').trim();
    const area = positive(room?.areaSqft);
    if (!name || area == null) return;
    const findings: PlanScopeFinding[] = [
      finding({
        id: `room-${index}-area`,
        label: name,
        quantity: area,
        unit: 'sqft',
        status: 'read_from_plan',
        sheet: room.sourceSheet || null,
        page: room.sourcePage ?? null,
        sourceText:
          room.lengthFt && room.widthFt
            ? `${room.lengthFt}' × ${room.widthFt}'`
            : null,
      }),
    ];
    if (isWetOrKitchen(name)) {
      (input.openingEvidence || []).forEach((opening, openingIndex) => {
        const location = String(opening.location || '');
        if (!location || !name || !new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(location)) {
          return;
        }
        const id = `opening-${openingIndex}`;
        consumedOpeningIds.add(id);
        findings.push(
          finding({
            id,
            label: [openingLabel(opening.category), opening.mark || opening.type]
              .filter(Boolean)
              .join(' · '),
            quantity: 1,
            unit: 'each',
            status: 'read_from_plan',
            sheet: opening.sheet || null,
            page: opening.page ?? null,
            sourceText: opening.sourceText || opening.location || null,
          })
        );
      });
    }
    roomRecords.push({
      id: `room-${index}`,
      title: name,
      findings,
    });
  });

  const openingFindings = READ_MEASUREMENTS.flatMap(row => {
    if (
      [
        'floorAreaSqft',
        'garageSqft',
        'deckSqft',
        'recessedLightCount',
        'ceilingFanCount',
        'bathExhaustFanCount',
        'singlePoleSwitchCount',
        'threeWaySwitchCount',
      ].includes(row.key)
    ) {
      return [];
    }
    const quantity = positive(measurements[row.key]);
    if (quantity == null) return [];
    const evidence = evidenceFor(input, row.key);
    return [
      finding({
        id: row.key,
        label: row.label,
        quantity,
        unit: row.unit,
        status: WHOLE_PROJECT_DRAWING_COUNT_KEYS.has(row.key)
          ? 'counted_from_drawings'
          : 'read_from_plan',
        ...evidence,
      }),
    ];
  });
  (input.openingEvidence || []).forEach((opening, index) => {
    const id = `opening-${index}`;
    if (consumedOpeningIds.has(id)) return;
    if (!opening.category && !opening.mark && !opening.type) return;
    openingFindings.push(
      finding({
        id,
        label: [openingLabel(opening.category), opening.location || opening.mark || opening.type]
          .filter(Boolean)
          .join(' · '),
        quantity: 1,
        unit: 'each',
        status: 'read_from_plan',
        sheet: opening.sheet || null,
        page: opening.page ?? null,
        sourceText: opening.sourceText || null,
      })
    );
  });

  const fixtureFindings = Object.entries(input.fixtureInventory || {}).flatMap(
    ([key, raw]) => {
      const quantity = positive(raw);
      const label = FIXTURE_LABELS[key];
      if (!label || quantity == null) return [];
      return [
        finding({
          id: `fixture-${key}`,
          label,
          quantity,
          unit: 'each',
          status: 'read_from_plan',
        }),
      ];
    }
  );

  const electricalFindings = READ_MEASUREMENTS.flatMap(row => {
    if (
      ![
        'recessedLightCount',
        'ceilingFanCount',
        'bathExhaustFanCount',
        'singlePoleSwitchCount',
        'threeWaySwitchCount',
      ].includes(row.key)
    ) {
      return [];
    }
    const quantity = positive(measurements[row.key]);
    if (quantity == null) return [];
    const evidence = evidenceFor(input, row.key);
    return [
      finding({
        id: row.key,
        label: row.label,
        quantity,
        unit: row.unit,
        status: WHOLE_PROJECT_DRAWING_COUNT_KEYS.has(row.key)
          ? 'counted_from_drawings'
          : 'read_from_plan',
        ...evidence,
      }),
    ];
  });

  const missingFindings = (
    rows: Array<{ id: string; label: string; keys: string[] }>,
    prefix: string
  ) =>
    rows.flatMap(row => {
      const read = row.keys.some(key => positive(measurements[key]) != null);
      if (read) return [];
      return [
        finding({
          id: `${prefix}-${row.id}`,
          label: row.label,
          quantity: null,
          unit: null,
          status: 'planning_allowance',
        }),
      ];
    });
  const finishFindings = (input.finishSchedule || []).flatMap((row, index) => {
    const room = String(row.room || '').trim();
    if (!room) return [];
    const finishes = [
      row.floor ? `floor ${finishLabelForSchedule(row.floor) || row.floor}` : null,
      row.wall ? `walls ${finishLabelForSchedule(row.wall) || row.wall}` : null,
      row.base ? `base ${finishLabelForSchedule(row.base) || row.base}` : null,
      row.ceiling ? `ceiling ${finishLabelForSchedule(row.ceiling) || row.ceiling}` : null,
      row.glassDoor ? 'glass shower door' : null,
    ].filter(Boolean);
    if (!finishes.length) return [];
    return [
      finding({
        id: `finish-${index}`,
        label: `${room} · ${finishes.join(', ')}`,
        quantity: null,
        unit: null,
        status: 'read_from_plan',
        sheet: row.sheet || null,
        page: row.page ?? null,
        sourceText: row.sourceText || null,
      }),
    ];
  });

  const uncountedFindings = missingFindings(DRAWN_BUT_UNCOUNTED, 'uncounted');
  const allowanceFindings = missingFindings(NOT_PRINTED, 'allowance');

  const records: PlanScopeRecord[] = [];
  if (projectFindings.length) {
    records.push({
      id: 'project',
      title: 'Cover sheet',
      findings: projectFindings,
    });
  }
  if (roomRecords.length) records.push(...roomRecords);
  if (openingFindings.length) {
    records.push({
      id: 'openings',
      title: 'Openings',
      findings: openingFindings,
    });
  }
  if (fixtureFindings.length) {
    records.push({
      id: 'fixtures',
      title: 'Fixtures',
      findings: fixtureFindings,
    });
  }
  if (electricalFindings.length) {
    records.push({
      id: 'electrical',
      title: 'Electrical sheet',
      findings: electricalFindings,
    });
  }
  if (finishFindings.length) {
    records.push({
      id: 'finish-schedule',
      title: 'Finish schedule',
      findings: finishFindings,
    });
  }
  if (uncountedFindings.length) {
    records.push({
      id: 'uncounted',
      title: 'Drawn on the sheets, not counted',
      findings: uncountedFindings,
    });
  }
  if (allowanceFindings.length) {
    records.push({
      id: 'allowances',
      title: 'Not printed on these sheets',
      findings: allowanceFindings,
    });
  }
  return records;
}
