import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_META_PREFIX = 'bps.workspaceSync.';

export function rowTimestamp(row: Record<string, unknown> | null | undefined): number {
  const raw = row?.updatedAt || row?.lastUpdated || row?.date || row?.createdAt;
  if (!raw) return 0;
  const ts = new Date(String(raw)).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

export function resourceTimestamp(updatedAt?: string | null): number {
  if (!updatedAt) return 0;
  const ts = new Date(updatedAt).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function rowKey(row: Record<string, any>, idKeys: string[]): string {
  for (const key of idKeys) {
    const value = row?.[key];
    if (value != null && String(value).trim()) return String(value);
  }
  return '';
}

export function mergeRecordsById<T extends Record<string, any>>(
  localRows: T[] = [],
  sharedRows: T[] = [],
  idKeys: string[] = ['id', 'poNumber']
): T[] {
  const byId = new Map<string, T>();

  for (const row of localRows) {
    const key = rowKey(row, idKeys);
    if (key) byId.set(key, row);
  }

  for (const row of sharedRows) {
    const key = rowKey(row, idKeys);
    if (!key) continue;
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, row);
      continue;
    }
    const keepShared = rowTimestamp(row) >= rowTimestamp(existing);
    byId.set(key, keepShared ? { ...existing, ...row } : { ...row, ...existing });
  }

  return Array.from(byId.values());
}

export async function readSyncMeta(projectId: string, resourceType: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(`${SYNC_META_PREFIX}${projectId}.${resourceType}`);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function writeSyncMeta(
  projectId: string,
  resourceType: string,
  updatedAt?: string | null
): Promise<void> {
  const ts = resourceTimestamp(updatedAt);
  if (!ts) return;
  await AsyncStorage.setItem(`${SYNC_META_PREFIX}${projectId}.${resourceType}`, String(ts));
}

export async function mergeArrayResource<T extends Record<string, any>>(
  projectId: string,
  resourceType: string,
  localRows: T[],
  sharedRows: T[] | undefined,
  sharedUpdatedAt?: string | null,
  idKeys: string[] = ['id', 'poNumber']
): Promise<T[]> {
  if (!Array.isArray(sharedRows) || sharedRows.length === 0) return localRows;

  const localSyncAt = await readSyncMeta(projectId, resourceType);
  const sharedAt = resourceTimestamp(sharedUpdatedAt);
  const merged = mergeRecordsById(localRows, sharedRows, idKeys);

  if (sharedAt >= localSyncAt) {
    await writeSyncMeta(projectId, resourceType, sharedUpdatedAt);
  }

  return merged;
}

export async function mergeObjectResource<T extends Record<string, any>>(
  projectId: string,
  resourceType: string,
  localValue: T | undefined,
  sharedValue: T | undefined,
  sharedUpdatedAt?: string | null
): Promise<T | undefined> {
  if (!sharedValue || typeof sharedValue !== 'object' || Array.isArray(sharedValue)) {
    return localValue;
  }

  const localSyncAt = await readSyncMeta(projectId, resourceType);
  const sharedAt = resourceTimestamp(sharedUpdatedAt);
  const merged = { ...(localValue || {}), ...sharedValue } as T;

  if (sharedAt >= localSyncAt) {
    await writeSyncMeta(projectId, resourceType, sharedUpdatedAt);
  }

  return merged;
}
