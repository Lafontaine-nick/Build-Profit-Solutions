import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export type ProjectPhotoSource = 'daily_log' | 'portfolio';

export type ProjectPhoto = {
  id: string;
  projectId: string;
  localUri: string;
  takenAt: string;
  source: ProjectPhotoSource;
  dailyLogId?: string;
  caption?: string;
  createdAt: string;
};

const storageKey = (projectId: string) => `bps.project.${projectId}.photos`;

function getFileSystemBaseDir(): string {
  const fs = FileSystem as typeof FileSystem & {
    documentDirectory?: string | null;
    cacheDirectory?: string | null;
  };
  return fs.documentDirectory || fs.cacheDirectory || '';
}

function photoDir(projectId: string): string {
  const base = getFileSystemBaseDir();
  return `${base}project-photos/${projectId}/`;
}

async function ensurePhotoDir(projectId: string): Promise<string> {
  const dir = photoDir(projectId);
  if (!dir) return '';
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch {
    /* ignore */
  }
  return dir;
}

/** Copy camera/library URIs into app documents so paths survive restarts. */
export async function persistProjectPhotoFile(
  projectId: string,
  photoId: string,
  sourceUri: string
): Promise<string> {
  if (!sourceUri) return sourceUri;
  if (Platform.OS === 'web') return sourceUri;
  if (sourceUri.startsWith(photoDir(projectId))) return sourceUri;

  const dir = await ensurePhotoDir(projectId);
  if (!dir) return sourceUri;

  const ext = sourceUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const dest = `${dir}${photoId}.${ext}`;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch (error) {
    console.warn('persistProjectPhotoFile: copy failed', error);
    return sourceUri;
  }
}

export async function listProjectPhotos(projectId: string): Promise<ProjectPhoto[]> {
  if (!projectId) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKey(projectId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a: ProjectPhoto, b: ProjectPhoto) =>
        new Date(b.takenAt || b.createdAt).getTime() - new Date(a.takenAt || a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function getProjectPhotosByIds(
  projectId: string,
  photoIds: string[]
): Promise<ProjectPhoto[]> {
  if (!photoIds?.length) return [];
  const all = await listProjectPhotos(projectId);
  const idSet = new Set(photoIds);
  return all.filter((p) => idSet.has(p.id));
}

export async function saveProjectPhoto(
  projectId: string,
  input: {
    id?: string;
    localUri: string;
    source: ProjectPhotoSource;
    dailyLogId?: string;
    caption?: string;
    takenAt?: string;
  }
): Promise<ProjectPhoto> {
  const id = input.id || `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const localUri = await persistProjectPhotoFile(projectId, id, input.localUri);

  const photo: ProjectPhoto = {
    id,
    projectId,
    localUri,
    takenAt: input.takenAt || now,
    source: input.source,
    dailyLogId: input.dailyLogId,
    caption: input.caption,
    createdAt: now,
  };

  const existing = await listProjectPhotos(projectId);
  const next = [photo, ...existing.filter((p) => p.id !== id)];
  await AsyncStorage.setItem(storageKey(projectId), JSON.stringify(next));
  return photo;
}

export async function deleteProjectPhoto(projectId: string, photoId: string): Promise<void> {
  const existing = await listProjectPhotos(projectId);
  const target = existing.find((p) => p.id === photoId);
  const next = existing.filter((p) => p.id !== photoId);
  await AsyncStorage.setItem(storageKey(projectId), JSON.stringify(next));

  if (target?.localUri && Platform.OS !== 'web') {
    try {
      const info = await FileSystem.getInfoAsync(target.localUri);
      if (info.exists) {
        await FileSystem.deleteAsync(target.localUri, { idempotent: true });
      }
    } catch {
      /* ignore */
    }
  }
}

async function unlinkPhotoFromDailyLogs(projectId: string, photoId: string): Promise<void> {
  const logKey = `daily_logs_${projectId}`;
  try {
    const raw = await AsyncStorage.getItem(logKey);
    if (!raw) return;
    const logs = JSON.parse(raw);
    if (!Array.isArray(logs)) return;
    let changed = false;
    const updated = logs.map((log: { photoIds?: string[] }) => {
      if (!Array.isArray(log.photoIds) || !log.photoIds.includes(photoId)) return log;
      changed = true;
      const nextIds = log.photoIds.filter((id) => id !== photoId);
      return { ...log, photoIds: nextIds.length ? nextIds : undefined };
    });
    if (changed) {
      await AsyncStorage.setItem(logKey, JSON.stringify(updated));
    }
  } catch {
    /* ignore */
  }
}

/** Delete photo file/record and remove its id from any daily log entries. */
export async function removeProjectPhoto(projectId: string, photoId: string): Promise<void> {
  await deleteProjectPhoto(projectId, photoId);
  await unlinkPhotoFromDailyLogs(projectId, photoId);
}

export async function linkPhotosToDailyLog(
  projectId: string,
  dailyLogId: string,
  photoIds: string[]
): Promise<void> {
  const existing = await listProjectPhotos(projectId);
  const idSet = new Set(photoIds);
  const next = existing.map((p) =>
    idSet.has(p.id)
      ? { ...p, dailyLogId, source: 'daily_log' as const }
      : p
  );
  await AsyncStorage.setItem(storageKey(projectId), JSON.stringify(next));
}

export async function updateProjectPhotoCaption(
  projectId: string,
  photoId: string,
  caption: string | undefined
): Promise<ProjectPhoto | null> {
  const existing = await listProjectPhotos(projectId);
  const target = existing.find((p) => p.id === photoId);
  if (!target) return null;
  const trimmed = caption?.trim() || undefined;
  const updated: ProjectPhoto = { ...target, caption: trimmed };
  const next = existing.map((p) => (p.id === photoId ? updated : p));
  await AsyncStorage.setItem(storageKey(projectId), JSON.stringify(next));
  return updated;
}
