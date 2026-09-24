import type { AreaReconciliation, AreaReconciliationStatus } from './types';

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function variancePercent(declared: number | null, detected: number | null): number | null {
  if (declared == null || declared <= 0 || detected == null) return null;
  return Math.round(((declared - detected) / declared) * 1000) / 10;
}

function statusFromVariance(livingPct: number | null, garagePct: number | null): AreaReconciliationStatus {
  const values = [livingPct, garagePct].filter((v): v is number => v != null).map(Math.abs);
  if (!values.length) return 'review';
  const worst = Math.max(...values);
  if (worst <= 3) return 'reconciled';
  if (worst <= 10) return 'review';
  return 'material_variance';
}

function isGarageRoom(name: string): boolean {
  return /\bgarage\b|\brv\s*garage\b|\bcarport\b/i.test(name || '');
}

/** Cover-sheet or floor-plan total, not a single room. */
export function isAggregateLivingAreaName(name: string): boolean {
  const n = String(name || '').trim();
  if (/\bliving\s+room\b/i.test(n)) return false;
  return /^(main\s+)?living\s+area$/i.test(n);
}

function isLivingRoom(name: string): boolean {
  if (isGarageRoom(name) || isAggregateLivingAreaName(name)) return false;
  if (/\bpatio\b|\bporch\b|\bdeck\b|\bbreezeway\b|\bmechanical\b|\butility\b/i.test(name || '')) {
    return false;
  }
  return true;
}

function roomsShareIdentity(a: string, b: string): boolean {
  const norm = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftNumbers = left.match(/\d+/g);
  const rightNumbers = right.match(/\d+/g);
  if (!leftNumbers || !rightNumbers || leftNumbers.join() !== rightNumbers.join()) {
    return false;
  }
  return /\b(bed|bedroom|den)\b/.test(left) && /\b(bed|bedroom|den)\b/.test(right);
}

export function duplicatePlanRoomIndexes(
  rooms: Array<{
    name?: string | null;
    areaSqft?: number | null;
    lengthFt?: number | null;
    widthFt?: number | null;
  }>
): Set<number> {
  const seen = new Map<string, string[]>();
  const duplicates = new Set<number>();
  rooms.forEach((room, index) => {
    const name = String(room.name || '');
    if (
      isDuplicateRoom(name, roomDimensionKey(room), seen) &&
      !isAggregateLivingAreaName(name)
    ) {
      duplicates.add(index);
    }
  });
  return duplicates;
}

function isDuplicateRoom(
  name: string,
  dimensionKey: string | null,
  seen: Map<string, string[]>
): boolean {
  if (!dimensionKey) return false;
  const prior = seen.get(dimensionKey) || [];
  const duplicate = prior.some(previous => roomsShareIdentity(previous, name));
  seen.set(dimensionKey, [...prior, name]);
  return duplicate;
}
function roomDimensionKey(room: {
  lengthFt?: number | null;
  widthFt?: number | null;
  areaSqft?: number | null;
}): string | null {
  const length = num(room.lengthFt);
  const width = num(room.widthFt);
  if (length != null && length > 0 && width != null && width > 0) {
    const a = Math.round(length * 100) / 100;
    const b = Math.round(width * 100) / 100;
    return a <= b ? `${a}x${b}` : `${b}x${a}`;
  }
  const area = num(room.areaSqft);
  return area != null && area > 0 ? `area:${Math.round(area * 10) / 10}` : null;
}

export function buildAreaReconciliation(input: {
  declaredLivingSf?: number | null;
  declaredGarageSf?: number | null;
  patioDeckSf?: number | null;
  rooms?: Array<{
    name?: string | null;
    areaSqft?: number | null;
    lengthFt?: number | null;
    widthFt?: number | null;
  }> | null;
}): AreaReconciliation {
  const declaredLivingSf = num(input.declaredLivingSf);
  const declaredGarageSf = num(input.declaredGarageSf);
  const patioDeckSf = num(input.patioDeckSf);
  const rooms = Array.isArray(input.rooms) ? input.rooms : [];

  let detectedLivingRoomSf = 0;
  let detectedGarageRoomSf = 0;
  let livingRoomCount = 0;
  let garageRoomCount = 0;
  const seenLivingDimensions = new Map<string, string[]>();
  const seenGarageDimensions = new Map<string, string[]>();

  for (const room of rooms) {
    const area = num(room.areaSqft);
    if (area == null || area <= 0) continue;
    const name = String(room.name || '');
    const dimensionKey = roomDimensionKey(room);
    if (isGarageRoom(name)) {
      if (isDuplicateRoom(name, dimensionKey, seenGarageDimensions)) continue;
      detectedGarageRoomSf += area;
      garageRoomCount += 1;
    } else if (isLivingRoom(name)) {
      if (isDuplicateRoom(name, dimensionKey, seenLivingDimensions)) continue;
      detectedLivingRoomSf += area;
      livingRoomCount += 1;
    }
  }

  const livingDetected = livingRoomCount ? Math.round(detectedLivingRoomSf * 10) / 10 : null;
  const garageDetected = garageRoomCount ? Math.round(detectedGarageRoomSf * 10) / 10 : null;

  const unassignedLivingSf =
    declaredLivingSf != null && livingDetected != null
      ? Math.round((declaredLivingSf - livingDetected) * 10) / 10
      : null;
  const unassignedGarageSf =
    declaredGarageSf != null && garageDetected != null
      ? Math.round((declaredGarageSf - garageDetected) * 10) / 10
      : null;

  const livingVariancePercent = variancePercent(declaredLivingSf, livingDetected);
  const garageVariancePercent = variancePercent(declaredGarageSf, garageDetected);
  const status = statusFromVariance(livingVariancePercent, garageVariancePercent);

  const notes: string[] = [
    'Room totals are net labeled rooms and are not forced to equal gross conditioned area.',
  ];
  if (rooms.length > 0) {
    notes.push(
      `${rooms.length} rooms detected — detection count alone does not mean areas are fully reconciled.`
    );
  }

  return {
    declaredLivingSf,
    detectedLivingRoomSf: livingDetected,
    unassignedLivingSf,
    livingVariancePercent,
    declaredGarageSf,
    detectedGarageRoomSf: garageDetected,
    unassignedGarageSf,
    garageVariancePercent,
    patioDeckSf,
    status,
    roomCount: rooms.length,
    notes,
  };
}
