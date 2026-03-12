/**
 * Loads project overrides and timeline progress from AsyncStorage, then computes
 * compare data for Chris, Nick, Jason — matches Projects page exactly.
 * Use in Assistant tab to send pre-computed compareProjectsData to AI.
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { computeProjectsCompareData, type CompareProjectItem } from '@/src/lib/projectsCompareData';

const isDepositMilestone = (m: any): boolean => {
  const t = (m?.title || m?.name || '').toLowerCase();
  return t.includes('deposit') || m?.type === 'deposit';
};

// Must match Projects page computeOverallPctFromItems exactly (including || for status fallback)
const computeOverallPctFromItems = (items: any[]): number => {
  if (!items?.length) return 0;
  const workItems = items.filter((m) => !isDepositMilestone(m));
  if (!workItems.length) return 0;
  const sum = workItems.reduce((acc, m) => {
    const pct = Math.min(100, Math.max(0, m.progressPct || (m.status === 'completed' ? 100 : m.status === 'in_progress' ? 50 : 0)));
    return acc + pct;
  }, 0);
  return Math.round(sum / workItems.length);
};

export interface UseProjectsCompareDataResult {
  compareData: CompareProjectItem[];
  /** Progress by project id (from timeline) — use to override allProjects.progress so backend fallback matches Projects page */
  progressByProjectId: Record<string, number>;
  /** True after first AsyncStorage load completes — use to avoid sending stale compare data before timeline is loaded */
  isLoaded: boolean;
}

export function useProjectsCompareData(
  activeProjects: any[],
  estimates: any[]
): UseProjectsCompareDataResult {
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [timelineProgress, setTimelineProgress] = useState<Record<string, number>>({});
  const [compareData, setCompareData] = useState<CompareProjectItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const load = useCallback(async () => {
    // IMPORTANT: reset at the start of every reload so UI doesn't use stale readiness
    // from a previous (possibly empty) project list.
    setIsLoaded(false);

    const all = [...activeProjects, ...estimates];
    const next: Record<string, any> = {};
    const progressMap: Record<string, number> = {};

    const normalizeKey = (value: string) =>
      String(value || '').trim().toLowerCase().replace(/\s+/g, '-');

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const projectKeys = allKeys.filter((k) => k.startsWith('bps.project.'));
      const timelineKeys = allKeys.filter(
        (k) => k.startsWith('bps.timeline.v2.') || k.startsWith('timeline_')
      );
      const entries = await AsyncStorage.multiGet(projectKeys);
      const byId: Record<string, any> = {};
      const byTitle: Record<string, any> = {};

      for (const [key, value] of entries) {
        if (!value) continue;
        try {
          const parsed = JSON.parse(value);
          const idFromKey = key.replace('bps.project.', '');
          const idFromData = String(parsed?.id ?? '');
          const title = String(parsed?.title ?? '').trim().toLowerCase();
          if (idFromKey) byId[idFromKey] = parsed;
          if (idFromData) byId[idFromData] = parsed;
          if (title) byTitle[title] = parsed;
        } catch {
          /* ignore */
        }
      }

      // Pre-scan ALL timeline keys → build suffix→progress map (matches Projects page exactly)
      // This ensures we find timeline even when project id ≠ storage key (e.g. pid=uuid, storage=chris)
      const suffixToProgress: Record<string, number> = {};
      for (const k of timelineKeys) {
        const suffix = k.startsWith('bps.timeline.v2.')
          ? k.replace('bps.timeline.v2.', '')
          : k.startsWith('timeline_')
            ? k.replace('timeline_', '')
            : '';
        if (!suffix) continue;
        try {
          const raw = await AsyncStorage.getItem(k);
          if (raw) {
            const milestones = JSON.parse(raw);
            if (Array.isArray(milestones)?.length) {
              const pct = computeOverallPctFromItems(milestones);
              const suffixLower = suffix.toLowerCase();
              const suffixNorm = normalizeKey(suffix);
              suffixToProgress[suffixLower] = pct;
              suffixToProgress[suffixNorm] = pct;
              suffixToProgress[suffix] = pct; // exact key too
            }
          }
        } catch {
          /* ignore */
        }
      }

      // For each project, resolve progress from pre-scanned map (pid, title, slug, etc.)
      for (const project of all) {
        const pid = String(project?.id ?? '');
        if (!pid) continue;

        const titleRaw = String(project?.title ?? project?.name ?? '').trim().toLowerCase();
        const titleSlug = normalizeKey(titleRaw);
        const titleCompact = titleRaw.replace(/\s+/g, '');
        const candidates = [pid, titleRaw, titleSlug, titleCompact, pid.toLowerCase()].filter(Boolean);
        let foundProgress: number | undefined;
        for (const c of candidates) {
          foundProgress = suffixToProgress[c] ?? suffixToProgress[normalizeKey(c)];
          if (foundProgress !== undefined) break;
        }

        if (foundProgress !== undefined) {
          progressMap[pid] = foundProgress;
          if (titleSlug) progressMap[titleSlug] = foundProgress;
          if (titleRaw) progressMap[titleRaw] = foundProgress;
          // Sync timeline progress to bps.project.${pid}.progress so ProjectListContext
          // and AI use correct value (overwrites stale 60% from old saves)
          try {
            const progressKey = `bps.project.${pid}.progress`;
            await AsyncStorage.setItem(progressKey, JSON.stringify({
              progress: foundProgress,
              overallProgressPct: foundProgress,
              updatedAt: new Date().toISOString(),
            }));
          } catch {
            /* ignore */
          }
        }

        const titleKey = String(project?.title ?? '').trim().toLowerCase();
        const override = byId[pid] || (titleKey ? byTitle[titleKey] : undefined);
        if (override) next[pid] = override;
      }

      setOverrides(next);
      setTimelineProgress(progressMap);
    } catch {
      /* keep existing */
    } finally {
      setIsLoaded(true);
    }
  }, [activeProjects, estimates]);

  useEffect(() => {
    load();
  }, [load]);

  // Reload when screen is focused (e.g. user returns from Projects/Timeline) so progress matches
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const data = computeProjectsCompareData(activeProjects, estimates, overrides, timelineProgress);
    setCompareData(data);
  }, [activeProjects, estimates, overrides, timelineProgress]);

  return { compareData, progressByProjectId: timelineProgress, isLoaded };
}
