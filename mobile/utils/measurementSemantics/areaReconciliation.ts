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

function isLivingRoom(name: string): boolean {
  if (isGarageRoom(name)) return false;
  if (/\bpatio\b|\bporch\b|\bdeck\b|\bbreezeway\b|\bmechanical\b|\butility\b/i.test(name || '')) {
    return false;
  }
  return true;
}

export function buildAreaReconciliation(input: {
  declaredLivingSf?: number | null;
  declaredGarageSf?: number | null;
  patioDeckSf?: number | null;
  rooms?: Array<{ name?: string | null; areaSqft?: number | null }> | null;
}): AreaReconciliation {
  const declaredLivingSf = num(input.declaredLivingSf);
  const declaredGarageSf = num(input.declaredGarageSf);
  const patioDeckSf = num(input.patioDeckSf);
  const rooms = Array.isArray(input.rooms) ? input.rooms : [];

  let detectedLivingRoomSf = 0;
  let detectedGarageRoomSf = 0;
  let livingRoomCount = 0;
  let garageRoomCount = 0;

  for (const room of rooms) {
    const area = num(room.areaSqft);
    if (area == null || area <= 0) continue;
    const name = String(room.name || '');
    if (isGarageRoom(name)) {
      detectedGarageRoomSf += area;
      garageRoomCount += 1;
    } else if (isLivingRoom(name)) {
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
