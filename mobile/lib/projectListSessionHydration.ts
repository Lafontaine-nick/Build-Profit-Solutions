import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  UNIFIED_PROJECTS_STORAGE_KEY,
  getActiveProjectUserId,
  getUnifiedProjectsStorageKey,
  getWorkspaceProjectsStorageKey,
} from '@/lib/projectListCache';
import { readWorkspaceAccessSnapshot } from '@/utils/workspaceAccessCache';

/** Raw cached rows — enough for dashboard metrics before full storage hydration. */
export type ProjectListSeedRow = Record<string, unknown>;

let projectListSeed: ProjectListSeedRow[] | null = null;
const projectListSeedByUserId = new Map<string, ProjectListSeedRow[]>();
let preloadPromise: Promise<ProjectListSeedRow[] | null> | null = null;

export function getProjectListSeed(userId?: string | null): ProjectListSeedRow[] | null {
  const id = String(userId ?? '').trim();
  if (id) {
    const perUser = projectListSeedByUserId.get(id);
    if (perUser?.length) return perUser;
  }
  return projectListSeed;
}

export function setProjectListSeed(
  rows: ProjectListSeedRow[] | null,
  userId?: string | null
): void {
  projectListSeed = rows;
  const id = String(userId ?? '').trim();
  if (id && Array.isArray(rows) && rows.length > 0) {
    projectListSeedByUserId.set(id, rows);
  }
}

async function readCachedProjectRows(
  accountUserId: string
): Promise<ProjectListSeedRow[]> {
  const cachedMember = await readWorkspaceAccessSnapshot();
  if (
    cachedMember?.hasWorkspaceAccess &&
    cachedMember.workspaceId &&
    !cachedMember.isOwner
  ) {
    const wsKey = getWorkspaceProjectsStorageKey(String(cachedMember.workspaceId));
    const wsSaved = await AsyncStorage.getItem(wsKey);
    if (wsSaved) {
      try {
        const parsed = JSON.parse(wsSaved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        /* fall through */
      }
    }
  }

  const listKey = getUnifiedProjectsStorageKey(accountUserId);
  const saved = await AsyncStorage.getItem(listKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      /* fall through */
    }
  }

  const activeUserId = await getActiveProjectUserId();
  const legacyRaw = await AsyncStorage.getItem(UNIFIED_PROJECTS_STORAGE_KEY);
  const mayUseLegacy =
    !!legacyRaw &&
    (activeUserId === accountUserId || (Platform.OS !== 'web' && !activeUserId));
  if (!mayUseLegacy || !legacyRaw) return [];

  try {
    const legacyParsed = JSON.parse(legacyRaw);
    return Array.isArray(legacyParsed) ? legacyParsed : [];
  } catch {
    return [];
  }
}

/** Preload cached projects for the last active account (module import). */
export function warmProjectListPreload(): Promise<ProjectListSeedRow[] | null> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    try {
      const userId = await getActiveProjectUserId();
      if (!userId) return null;
      const rows = await readCachedProjectRows(userId);
      if (rows.length === 0) return null;
      projectListSeed = rows;
      projectListSeedByUserId.set(userId, rows);
      return rows;
    } catch {
      return null;
    }
  })();
  return preloadPromise;
}

export async function loadProjectListSeedForUser(
  accountUserId: string
): Promise<ProjectListSeedRow[]> {
  const rows = await readCachedProjectRows(accountUserId);
  if (rows.length > 0) {
    setProjectListSeed(rows, accountUserId);
  }
  return rows;
}

void warmProjectListPreload();
