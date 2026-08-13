import type { PlanBuildingAreas, PlanFacts } from '@/utils/planMeasurementFacts';
import { filterPlanMeasurementsForTrade } from '@/utils/planImportTradeConfig';

type PlanRoom = {
  name?: string | null;
  lengthFt?: number | null;
  widthFt?: number | null;
  areaSqft?: number | null;
  confidence?: number | null;
};

type PaintingHydrationInput = {
  measurements?: Record<string, number | string> | null;
  rooms?: PlanRoom[] | null;
  buildingAreas?: PlanBuildingAreas | null;
  planFacts?: PlanFacts | null;
  estimatingMode?: string | null;
  selectedTrade?: string | null;
  measurementProvenance?: Record<string, unknown> | null;
  fieldConfidence?: Record<string, number> | null;
  assumptions?: string[] | null;
  notesBlock?: string | null;
  mergedNotes?: string | null;
};

const NON_PAINTABLE_INTERIOR_ROOM_RE =
  /\b(garage|rv\s*garage|carport|patio|porch|deck|balcony|terrace|mechanical|unfinished|attic|crawl|exterior|shop)\b/i;

const SKIP_NOTE_ROOM_NAME_RE =
  /\b(total living|living area|main floor|upstairs|garage area|covered patio|mapped fields)\b/i;

function positive(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function roundTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

const ROOM_CEILING_COVERAGE_MIN = 0.7;

function pickPaintingCeilingSqft(
  roomCeilingSqft: number | null,
  livingCeilingSqft: number | null
): { value: number | null; usedRooms: boolean; incompleteRooms: boolean; roomSqft: number | null } {
  const room = positive(roomCeilingSqft);
  const living = positive(livingCeilingSqft);
  if (living && room && room < living * ROOM_CEILING_COVERAGE_MIN) {
    return { value: living, usedRooms: false, incompleteRooms: true, roomSqft: room };
  }
  if (room) return { value: room, usedRooms: true, incompleteRooms: false, roomSqft: room };
  if (living) return { value: living, usedRooms: false, incompleteRooms: false, roomSqft: room };
  return { value: null, usedRooms: false, incompleteRooms: false, roomSqft: room };
}

function isPaintableInteriorRoom(name: string | null | undefined): boolean {
  const n = String(name || '').trim();
  if (!n) return false;
  return !NON_PAINTABLE_INTERIOR_ROOM_RE.test(n);
}

function roomRectangle(room: PlanRoom) {
  const lengthFt = positive(room.lengthFt);
  const widthFt = positive(room.widthFt);
  const areaSqft =
    positive(room.areaSqft) ||
    (lengthFt != null && widthFt != null ? lengthFt * widthFt : null);
  const perimeterLf =
    lengthFt != null && widthFt != null ? 2 * (lengthFt + widthFt) : null;
  return { areaSqft, perimeterLf };
}

function explicitInteriorWallHeightFt(planFacts?: PlanFacts | null): number | null {
  const wall = positive(planFacts?.wallHeightFt);
  const plate = positive(planFacts?.plateHeightFt);
  const ceiling = positive(planFacts?.ceilingHeightFt);
  if (wall != null && wall >= 7 && wall <= 14) return wall;
  if (plate != null && plate >= 7 && plate <= 14) return plate;
  if (ceiling != null && ceiling >= 7 && ceiling <= 14) return ceiling;
  return null;
}

function parseHeightFromText(text: string | null | undefined): number | null {
  const t = String(text || '');
  const labeled = t.match(
    /\b(?:ceiling|wall|plate)\s*height[^\d]{0,12}(\d{1,2})['’](?:[-\s]*(\d{1,2})["”])?/i
  );
  if (labeled) {
    const ft = Number(labeled[1]);
    const inches = Number(labeled[2] || 0);
    const value = ft + inches / 12;
    if (value >= 7 && value <= 14) return roundTenth(value);
  }
  const decimal = t.match(
    /\b(?:ceiling|wall|plate)\s*height[^\d]{0,16}(\d{1,2}(?:\.\d+)?)\s*(?:FT|ft|')/i
  );
  if (decimal) {
    const value = Number(decimal[1]);
    if (value >= 7 && value <= 14) return roundTenth(value);
  }
  const derived = t.match(
    /(\d{1,2}(?:\.\d+)?)\s*FT wall\/plate height/i
  );
  if (derived) {
    const value = Number(derived[1]);
    if (value >= 7 && value <= 14) return roundTenth(value);
  }
  return null;
}

/**
 * Hosted selected-trade Painting still returns rooms: []. Request whole-project
 * geometry, then hydrate/filter as Painting on the client.
 */
export function resolvePaintingPlanTakeoffApiSelection(input: {
  estimatingMode?: string | null;
  selectedTradeKey?: string | null;
}): {
  estimatingMode: 'whole_project' | 'selected_trade';
  selectedTradeKey: string | null;
} {
  const mode = input.estimatingMode === 'selected_trade' ? 'selected_trade' : 'whole_project';
  const trade = String(input.selectedTradeKey || '').trim().toLowerCase() || null;
  if (mode === 'selected_trade' && trade === 'painting') {
    return { estimatingMode: 'whole_project', selectedTradeKey: null };
  }
  return { estimatingMode: mode, selectedTradeKey: trade };
}

export function parseRoomsFromPlanNotes(text: string | null | undefined): PlanRoom[] {
  const rooms: PlanRoom[] = [];
  const seen = new Set<string>();
  const remember = (name: string, lengthFt: number, widthFt: number) => {
    const key = name.trim().toLowerCase();
    if (
      !key ||
      seen.has(key) ||
      SKIP_NOTE_ROOM_NAME_RE.test(name) ||
      !isPaintableInteriorRoom(name)
    ) {
      return;
    }
    if (!(lengthFt > 0) || !(widthFt > 0) || lengthFt > 80 || widthFt > 80) return;
    seen.add(key);
    rooms.push({
      name: name.trim(),
      lengthFt: roundTenth(lengthFt),
      widthFt: roundTenth(widthFt),
      areaSqft: roundTenth(lengthFt * widthFt),
      confidence: 0.8,
    });
  };

  const decimalRe =
    /^[\s-]*([^:\n]{2,48}):\s*(\d+(?:\.\d+)?)\s*(?:['’]|ft)?\s*[×x]\s*(\d+(?:\.\d+)?)\s*(?:['’]|ft)?/gim;
  let match: RegExpExecArray | null;
  while ((match = decimalRe.exec(String(text || '')))) {
    remember(match[1], Number(match[2]), Number(match[3]));
  }

  const feetInchesRe =
    /^[\s-]*([^:\n]{2,48}):\s*(\d{1,2})['’](?:[-\s]*(\d{1,2})["”])?\s*[×x]\s*(\d{1,2})['’](?:[-\s]*(\d{1,2})["”])?/gim;
  while ((match = feetInchesRe.exec(String(text || '')))) {
    const lengthFt = Number(match[2]) + Number(match[3] || 0) / 12;
    const widthFt = Number(match[4]) + Number(match[5] || 0) / 12;
    remember(match[1], lengthFt, widthFt);
  }
  return rooms;
}

function parseInteriorDoorCountFromText(text: string | null | undefined): number | null {
  const t = String(text || '');
  const labeled = t.match(
    /\binterior door(?:s)?(?:\s+count)?[:\s]+(\d{1,2})\b/i
  );
  const counted = t.match(/\b(\d{1,2})\s+interior doors\b/i);
  const raw = Number(labeled?.[1] || counted?.[1] || 0);
  if (raw >= 1 && raw <= 80) return raw;
  return null;
}

function conditionedLivingCeilingSqft(
  buildingAreas?: PlanBuildingAreas | null,
  measurements?: Record<string, number | string> | null
): number | null {
  const main = positive(buildingAreas?.mainFloorLivingSqft);
  const upper = positive(buildingAreas?.upstairsLivingSqft);
  const additional = (Array.isArray(buildingAreas?.additionalFloorAreas)
    ? buildingAreas.additionalFloorAreas
    : []
  )
    .map(positive)
    .filter((value): value is number => value != null);
  if (main != null || upper != null || additional.length) {
    return roundTenth(
      (main || 0) + (upper || 0) + additional.reduce((sum, value) => sum + value, 0)
    );
  }
  return (
    positive(buildingAreas?.totalLivingSqft) ||
    positive(measurements?.floorAreaSqft) ||
    positive(measurements?.flooringSqft)
  );
}

function markDerived(
  input: PaintingHydrationInput,
  key: string,
  value: number,
  assumption: string,
  extra?: { coverage?: 'complete' | 'incomplete' }
) {
  const measurements = { ...(input.measurements || {}) };
  measurements[key] = value;
  const fieldConfidence = { ...(input.fieldConfidence || {}) };
  fieldConfidence[key] = Math.max(
    Number(fieldConfidence[key] || 0),
    extra?.coverage === 'incomplete' ? 0.55 : 0.75
  );
  const measurementProvenance = { ...(input.measurementProvenance || {}) };
  measurementProvenance[key] = {
    value,
    source: 'measured_from_geometry',
    normalizedSource:
      extra?.coverage === 'incomplete' ? 'NEEDS_REVIEW' : 'FROM_PLAN',
    ...(extra?.coverage ? { coverage: extra.coverage } : {}),
  };
  const assumptions = [...(input.assumptions || [])];
  if (!assumptions.includes(assumption)) assumptions.push(assumption);
  return {
    ...input,
    measurements,
    fieldConfidence,
    measurementProvenance,
    assumptions,
  };
}

function mergePaintingRooms(...lists: PlanRoom[][]): PlanRoom[] {
  const byName = new Map<string, PlanRoom>();
  for (const list of lists) {
    for (const room of list) {
      const key = String(room.name || '').trim().toLowerCase();
      if (!key) continue;
      const prev = byName.get(key) || { name: room.name };
      const lengthFt = positive(prev.lengthFt) ?? positive(room.lengthFt);
      const widthFt = positive(prev.widthFt) ?? positive(room.widthFt);
      byName.set(key, {
        name: prev.name || room.name,
        lengthFt: lengthFt ?? prev.lengthFt ?? room.lengthFt ?? null,
        widthFt: widthFt ?? prev.widthFt ?? room.widthFt ?? null,
        areaSqft:
          positive(prev.areaSqft) ??
          positive(room.areaSqft) ??
          prev.areaSqft ??
          room.areaSqft ??
          null,
        confidence:
          Math.max(Number(prev.confidence || 0), Number(room.confidence || 0)) ||
          null,
      });
    }
  }
  return [...byName.values()];
}

function collectPaintingRooms(input: PaintingHydrationInput): PlanRoom[] {
  return mergePaintingRooms(
    Array.isArray(input.rooms) ? input.rooms : [],
    Array.isArray(input.planFacts?.interiorRooms) ? input.planFacts.interiorRooms : [],
    parseRoomsFromPlanNotes(
      [input.notesBlock, input.mergedNotes].filter(Boolean).join('\n')
    )
  );
}

/**
 * Fill Painting takeoff keys the hosted backend still omits.
 * Ceilings may use labeled conditioned living SF when room geometry is missing.
 * Walls/baseboard still require dimensioned rooms + explicit height.
 */
export function hydratePaintingPlanMeasurements<T extends PaintingHydrationInput>(
  input: T
): T {
  const trade = String(input.selectedTrade || '').trim().toLowerCase();
  if (input.estimatingMode !== 'selected_trade' || trade !== 'painting') {
    return input;
  }

  let next: PaintingHydrationInput = {
    ...input,
    measurements: { ...(input.measurements || {}) },
  };
  const areas = input.buildingAreas || input.planFacts?.buildingAreas || {};
  const rooms = collectPaintingRooms(input);
  const paintable = rooms
    .filter(
      room =>
        isPaintableInteriorRoom(room.name) &&
        (Number(room.confidence) || 1) >= 0.4
    )
    .map(room => ({ room, ...roomRectangle(room) }));
  const dimensioned = paintable.filter(entry => entry.perimeterLf != null);
  const withArea = paintable.filter(entry => entry.areaSqft != null);
  const MIN_ROOMS = 2;
  const wallHeightFt =
    explicitInteriorWallHeightFt(input.planFacts) ||
    parseHeightFromText(
      [input.notesBlock, input.mergedNotes, ...(input.assumptions || [])]
        .filter(Boolean)
        .join('\n')
    );
  const roomCeiling =
    withArea.length >= MIN_ROOMS
      ? withArea.reduce((sum, entry) => sum + (entry.areaSqft || 0), 0)
      : null;
  const livingCeiling = conditionedLivingCeilingSqft(areas, next.measurements);
  const picked = pickPaintingCeilingSqft(roomCeiling, livingCeiling);
  const geometryIncomplete = Boolean(picked.incompleteRooms);
  const existingCeiling = positive(next.measurements?.ceilingPaintSqft);
  const shouldReplaceCeiling =
    picked.value != null &&
    (!(existingCeiling > 0) ||
      (geometryIncomplete &&
        livingCeiling != null &&
        (existingCeiling as number) < livingCeiling * ROOM_CEILING_COVERAGE_MIN));

  if (shouldReplaceCeiling && picked.value) {
    const rounded = roundTenth(picked.value);
    next = markDerived(
      next,
      'ceilingPaintSqft',
      rounded,
      picked.incompleteRooms
        ? `Ceiling paint ${rounded.toLocaleString()} SF calculated from labeled conditioned living area because detected rooms (${picked.roomSqft?.toLocaleString()} SF) do not cover living area.`
        : picked.usedRooms
          ? `Ceiling paint ${rounded.toLocaleString()} SF calculated from ${withArea.length} dimensioned interior rooms.`
          : `Ceiling paint ${rounded.toLocaleString()} SF calculated from labeled conditioned living area (garage and covered patio excluded).`,
      { coverage: 'complete' }
    );
  }

  if (
    !(positive(next.measurements?.wallPaintSqft) > 0) &&
    wallHeightFt &&
    dimensioned.length >= MIN_ROOMS
  ) {
    const wallSqft = dimensioned.reduce(
      (sum, entry) => sum + (entry.perimeterLf || 0) * wallHeightFt,
      0
    );
    next = markDerived(
      next,
      'wallPaintSqft',
      roundTenth(wallSqft),
      geometryIncomplete
        ? `Interior wall paint ${roundTenth(wallSqft).toLocaleString()} SF calculated from ${dimensioned.length} dimensioned rooms × ${wallHeightFt} FT wall/plate height. Partial room geometry versus labeled living area — confirm remaining walls.`
        : `Interior wall paint ${roundTenth(wallSqft).toLocaleString()} SF calculated from ${dimensioned.length} dimensioned rooms × ${wallHeightFt} FT wall/plate height.`,
      { coverage: geometryIncomplete ? 'incomplete' : 'complete' }
    );
  } else if (geometryIncomplete && positive(next.measurements?.wallPaintSqft) > 0) {
    next = markDerived(
      next,
      'wallPaintSqft',
      Number(next.measurements?.wallPaintSqft),
      `Interior wall paint is from partial room geometry versus labeled living area — confirm remaining walls.`,
      { coverage: 'incomplete' }
    );
  }

  if (
    !(positive(next.measurements?.baseboardLf) > 0) &&
    dimensioned.length >= MIN_ROOMS
  ) {
    const lf = dimensioned.reduce(
      (sum, entry) => sum + (entry.perimeterLf || 0),
      0
    );
    next = markDerived(
      next,
      'baseboardLf',
      roundTenth(lf),
      geometryIncomplete
        ? `Baseboard / trim ${roundTenth(lf).toLocaleString()} LF calculated from ${dimensioned.length} dimensioned room perimeters. Partial room geometry — confirm remaining trim.`
        : `Baseboard / trim ${roundTenth(lf).toLocaleString()} LF calculated from ${dimensioned.length} dimensioned room perimeters.`,
      { coverage: geometryIncomplete ? 'incomplete' : 'complete' }
    );
  } else if (geometryIncomplete && positive(next.measurements?.baseboardLf) > 0) {
    next = markDerived(
      next,
      'baseboardLf',
      Number(next.measurements?.baseboardLf),
      `Baseboard / trim is from partial room geometry versus labeled living area — confirm remaining trim.`,
      { coverage: 'incomplete' }
    );
  }

  if (!(positive(next.measurements?.interiorDoorCount) > 0)) {
    const doors = parseInteriorDoorCountFromText(
      [input.notesBlock, input.mergedNotes, ...(input.assumptions || [])]
        .filter(Boolean)
        .join('\n')
    );
    if (doors) {
      next = markDerived(
        next,
        'interiorDoorCount',
        doors,
        `Interior door count ${doors} EA from door schedule or identifiable interior door symbols.`
      );
    }
  }

  const filtered = filterPlanMeasurementsForTrade(
    next.measurements as Record<string, number>,
    'selected_trade',
    'painting'
  );

  return {
    ...input,
    ...next,
    measurements: filtered,
  } as T;
}
