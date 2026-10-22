import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Symbol counts the contractor already accepted for a plan file.
 * A new estimate of the same PDF uses these numbers instead of a fresh
 * vision read. Cover areas and recessed-light tags are not stored here.
 */
export const ACCEPTED_PLAN_SYMBOL_COUNT_KEYS = [
  'windowCount',
  'exteriorDoorCount',
  'slidingDoorCount',
  'interiorDoorCount',
  'singlePoleSwitchCount',
  'threeWaySwitchCount',
  'ceilingFanCount',
  'bathExhaustFanCount',
] as const;

const STORAGE_KEY = 'bps.acceptedPlanSymbolCounts.v1';
const MAX_ENTRIES = 40;

type StoredEntry = {
  fingerprint: string;
  counts: Record<string, number>;
  updatedAt: number;
};

const memory = new Map<string, Record<string, number>>();
const updatedAt = new Map<string, number>();
let hydrated = false;
let hydrating: Promise<void> | null = null;
let flushQueue: Promise<void> = Promise.resolve();

export function isAcceptedPlanSymbolCountKey(key: string): boolean {
  return (ACCEPTED_PLAN_SYMBOL_COUNT_KEYS as readonly string[]).includes(key);
}

export function keptAcceptedPlanSymbolCount(
  key: string,
  provenanceEntry: unknown
): boolean {
  if (!isAcceptedPlanSymbolCountKey(key)) return false;
  if (!provenanceEntry || typeof provenanceEntry !== 'object') return false;
  return (
    (provenanceEntry as { keptFromAcceptedTakeoff?: boolean })
      .keptFromAcceptedTakeoff === true
  );
}

export function pickAcceptedPlanSymbolCounts(
  measurements: Record<string, unknown> | null | undefined
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!measurements) return counts;
  for (const key of ACCEPTED_PLAN_SYMBOL_COUNT_KEYS) {
    const value = Number(String(measurements[key] ?? '').replace(/,/g, ''));
    if (Number.isFinite(value) && value > 0) counts[key] = value;
  }
  return counts;
}

export function acceptedPlanSymbolProvenance(value: number): Record<string, unknown> {
  return {
    value,
    source: 'contractor_confirmed_from_plan_review',
    normalizedSource: 'USER_CONFIRMED',
    status: 'user_confirmed',
    pricingEligible: true,
    keptFromAcceptedTakeoff: true,
    symbolReadsDisagreed: false,
    evidenceKind: 'accepted_takeoff',
    reason: 'Kept from your takeoff of this plan.',
  };
}

export function applyAcceptedPlanSymbolCounts<
  T extends {
    measurements?: Record<string, number | string | null | undefined> | null;
    measurementProvenance?: Record<string, unknown> | null;
  },
>(takeoff: T, counts: Record<string, number> | null | undefined): T {
  const picked = pickAcceptedPlanSymbolCounts(counts || {});
  if (!Object.keys(picked).length) return takeoff;
  const measurements = { ...(takeoff.measurements || {}) };
  const measurementProvenance = { ...(takeoff.measurementProvenance || {}) };
  for (const [key, value] of Object.entries(picked)) {
    measurements[key] = value;
    const existing = measurementProvenance[key];
    measurementProvenance[key] = {
      ...(existing && typeof existing === 'object' ? existing : {}),
      ...acceptedPlanSymbolProvenance(value),
    };
  }
  return {
    ...takeoff,
    measurements,
    measurementProvenance,
  };
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (!hydrating) {
    hydrating = (async () => {
      let entries: StoredEntry[] = [];
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed?.entries)) entries = parsed.entries;
      } catch {
        entries = [];
      }
      for (const entry of entries) {
        const fingerprint = String(entry?.fingerprint || '').trim();
        const counts = pickAcceptedPlanSymbolCounts(entry?.counts || {});
        if (!fingerprint || !Object.keys(counts).length) continue;
        memory.set(fingerprint, {
          ...counts,
          ...(memory.get(fingerprint) || {}),
        });
        if (!updatedAt.has(fingerprint)) {
          updatedAt.set(fingerprint, Number(entry.updatedAt) || 0);
        }
      }
      hydrated = true;
    })().finally(() => {
      hydrating = null;
    });
  }
  await hydrating;
}

async function persist(): Promise<void> {
  const entries = [...memory.entries()]
    .map(([fingerprint, counts]) => ({
      fingerprint,
      counts: pickAcceptedPlanSymbolCounts(counts),
      updatedAt: updatedAt.get(fingerprint) || 0,
    }))
    .filter(entry => Object.keys(entry.counts).length)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_ENTRIES);
  const kept = new Set(entries.map(entry => entry.fingerprint));
  for (const fingerprint of [...memory.keys()]) {
    if (!kept.has(fingerprint)) {
      memory.delete(fingerprint);
      updatedAt.delete(fingerprint);
    }
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ entries }));
}

function scheduleFlush(): void {
  flushQueue = flushQueue
    .catch(() => undefined)
    .then(async () => {
      await hydrate();
      await persist();
    })
    .catch(() => undefined);
}

export function rememberAcceptedPlanSymbolCounts(
  fingerprint: string | null | undefined,
  measurements: Record<string, unknown> | null | undefined
): void {
  const id = String(fingerprint || '').trim();
  const picked = pickAcceptedPlanSymbolCounts(measurements);
  if (!id || !Object.keys(picked).length) return;
  memory.set(id, { ...(memory.get(id) || {}), ...picked });
  updatedAt.set(id, Date.now());
  scheduleFlush();
}

export function rememberAcceptedPlanSymbolCount(
  fingerprint: string | null | undefined,
  key: string,
  value: number
): void {
  if (!isAcceptedPlanSymbolCountKey(key)) return;
  rememberAcceptedPlanSymbolCounts(fingerprint, { [key]: value });
}

export async function loadAcceptedPlanSymbolCounts(
  fingerprint: string | null | undefined
): Promise<Record<string, number> | null> {
  const id = String(fingerprint || '').trim();
  if (!id) return null;
  try {
    await hydrate();
  } catch {
    // Use whatever this session already saved.
  }
  const counts = memory.get(id);
  return counts && Object.keys(counts).length ? { ...counts } : null;
}

export async function resetAcceptedPlanSymbolCountsForTests(): Promise<void> {
  memory.clear();
  updatedAt.clear();
  hydrated = false;
  hydrating = null;
  flushQueue = Promise.resolve();
  await AsyncStorage.removeItem(STORAGE_KEY);
}
