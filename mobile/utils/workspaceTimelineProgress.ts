import AsyncStorage from '@react-native-async-storage/async-storage';
import { businessWorkspaceService } from '@/services/businessWorkspaceService';
import { isChangeOrderTimelineMilestone } from '@/src/lib/projectFinancials';
import { readSyncMeta, resourceTimestamp, writeSyncMeta } from '@/utils/workspaceResourceMerge';

const TIMELINE_STORAGE_PREFIX = 'bps.timeline.v2.';
const WORKSPACE_ACCESS_FLAG = 'bps.cachedWorkspaceAccess';
/** Avoid hammering the API on every dashboard focus / tab switch. */
const WORKSPACE_TIMELINE_FETCH_TTL_MS = 60_000;

type TimelineCacheEntry = {
  fetchedAt: number;
  progressPct: number;
  milestones: any[];
};

const timelineFetchCache = new Map<string, TimelineCacheEntry>();
let lastBulkFetchAt = 0;
let lastBulkFetchKey = '';

function isDepositMilestone(m: any): boolean {
  const t = (m?.title || m?.name || m?.description || '').toLowerCase();
  return t.includes('deposit') || m?.type === 'deposit' || m?.weekNumber === 0;
}

export function computeOverallPctFromTimelineItems(items: any[]): number {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const workItems = items.filter(
    (m) => !isDepositMilestone(m) && !isChangeOrderTimelineMilestone(m)
  );
  if (!workItems.length) return 0;
  const sum = workItems.reduce((acc, m) => {
    const pct = Math.min(
      100,
      Math.max(
        0,
        m.progressPct ||
          (m.status === 'completed' ? 100 : m.status === 'in_progress' ? 50 : 0)
      )
    );
    return acc + pct;
  }, 0);
  return Math.round(sum / workItems.length);
}

export type WorkspaceTimelineProgressEntry = {
  progressPct: number;
  milestones: any[];
};

async function hasCachedWorkspaceAccess(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(WORKSPACE_ACCESS_FLAG);
    return flag === '1';
  } catch {
    return false;
  }
}

async function loadProjectTimelineFromWorkspace(
  projectId: string,
  now: number
): Promise<WorkspaceTimelineProgressEntry | null> {
  const cached = timelineFetchCache.get(projectId);
  if (cached && now - cached.fetchedAt < WORKSPACE_TIMELINE_FETCH_TTL_MS) {
    return { progressPct: cached.progressPct, milestones: cached.milestones };
  }

  try {
    const response = await businessWorkspaceService.getProjectResources(projectId);
    const timeline = response?.success ? response.data?.resources?.timeline : undefined;
    const payload = timeline?.payload;
    if (!Array.isArray(payload) || payload.length === 0) return null;

    const sharedAt = resourceTimestamp(timeline?.updatedAt);
    const localSyncAt = await readSyncMeta(projectId, 'timeline');

    let localItems: any[] | null = null;
    try {
      const raw = await AsyncStorage.getItem(`${TIMELINE_STORAGE_PREFIX}${projectId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localItems = parsed;
      }
    } catch {
      /* ignore */
    }

    const sharedPct = computeOverallPctFromTimelineItems(payload);
    const localPct = localItems?.length
      ? computeOverallPctFromTimelineItems(localItems)
      : undefined;
    const useShared = sharedAt >= localSyncAt || !localItems?.length;

    let entry: WorkspaceTimelineProgressEntry;
    if (useShared) {
      entry = { progressPct: sharedPct, milestones: payload };
      await AsyncStorage.setItem(
        `${TIMELINE_STORAGE_PREFIX}${projectId}`,
        JSON.stringify(payload)
      );
      await writeSyncMeta(projectId, 'timeline', timeline?.updatedAt);
    } else {
      entry = {
        progressPct: localPct ?? sharedPct,
        milestones: localItems || payload,
      };
    }

    timelineFetchCache.set(projectId, { fetchedAt: now, ...entry });
    return entry;
  } catch {
    return null;
  }
}

/** Pull shared workspace timeline and pick the newest vs local copy. */
export async function loadWorkspaceTimelineProgressByProjectId(
  projectIds: string[]
): Promise<Record<string, WorkspaceTimelineProgressEntry>> {
  const uniqueIds = [...new Set(projectIds.map((id) => String(id || '').trim()).filter(Boolean))];
  const out: Record<string, WorkspaceTimelineProgressEntry> = {};
  if (uniqueIds.length === 0) return out;

  const workspaceEnabled = await hasCachedWorkspaceAccess();
  if (!workspaceEnabled) return out;

  const now = Date.now();
  const bulkKey = uniqueIds.slice().sort().join('|');
  if (
    bulkKey === lastBulkFetchKey &&
    now - lastBulkFetchAt < WORKSPACE_TIMELINE_FETCH_TTL_MS
  ) {
    for (const projectId of uniqueIds) {
      const cached = timelineFetchCache.get(projectId);
      if (cached) {
        out[projectId] = {
          progressPct: cached.progressPct,
          milestones: cached.milestones,
        };
      }
    }
    if (Object.keys(out).length > 0) return out;
  }

  await Promise.all(
    uniqueIds.map(async (projectId) => {
      const entry = await loadProjectTimelineFromWorkspace(projectId, now);
      if (entry) out[projectId] = entry;
    })
  );

  lastBulkFetchAt = now;
  lastBulkFetchKey = bulkKey;
  return out;
}

export function applyWorkspaceTimelineProgressToMaps(
  projects: Array<{ id?: string | number; title?: string; name?: string }>,
  workspaceProgress: Record<string, WorkspaceTimelineProgressEntry>,
  progressMap: Record<string, number>
): void {
  const normalizeKey = (v: string) =>
    String(v || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

  for (const project of projects) {
    const pid = String(project?.id ?? '');
    if (!pid) continue;
    const entry = workspaceProgress[pid];
    if (!entry) continue;

    const pct = entry.progressPct;
    const titleRaw = String(project?.title ?? project?.name ?? '')
      .trim()
      .toLowerCase();
    const titleSlug = normalizeKey(titleRaw);

    progressMap[pid] = pct;
    if (titleRaw) progressMap[titleRaw] = pct;
    if (titleSlug) progressMap[titleSlug] = pct;
  }
}

/** Call after a team member pushes timeline so owners see fresh % without waiting for TTL. */
export function invalidateWorkspaceTimelineProgressCache(projectId?: string): void {
  if (projectId) {
    timelineFetchCache.delete(projectId);
  } else {
    timelineFetchCache.clear();
  }
  lastBulkFetchAt = 0;
  lastBulkFetchKey = '';
}
