import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Modal,
  InteractionManager,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
  BackHandler,
  PanResponder,
  useWindowDimensions,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useProjectList } from '@/contexts/ProjectListContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAIManagerMode } from '@/hooks/useAIManagerMode';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeProjectListRowFinancials } from '@/lib/projectListRowMetrics';
import { pickCompletedDisplayDateRaw } from '@/lib/projectCompletedDisplayDate';
import { isChangeOrderTimelineMilestone } from '@/src/lib/projectFinancials';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenLayout, isDesktopWebLayoutWidth, DASHBOARD_WEB_MAX_CONTENT_WIDTH, WEB_DESKTOP_EDGE_HORIZONTAL } from '@/constants/ScreenLayout';
import { useTabScrollBottomInset } from '@/hooks/useTabScrollBottomInset';
import {
  FirstEstimateWalkthroughSheetShell,
  FirstEstimateWalkthroughIntroSheetContent,
  FirstEstimateWalkthroughHighlight,
} from '@/components/FirstEstimateWalkthrough';
import {
  loadActiveProjectWalkthroughProgress,
  saveActiveProjectWalkthroughProgress,
  setPendingActiveProjectWalkthroughProjectId,
  getPendingActiveProjectWalkthroughProjectId,
  clearPendingActiveProjectWalkthroughProjectId,
} from '@/lib/activeProjectWalkthroughStorage';
import { useUser } from '@clerk/clerk-react';
import { useWalkthroughState } from '@/contexts/WalkthroughStateContext';
import { TabScreenHeader } from '@/components/ui/TabScreenHeader';
import WebPageShell from '@/components/layout/WebPageShell';
import { formatMoneyUSD, formatMoneyCompact, formatDateShort } from '@/utils/formatters';
/** UI-only: polish unknown location strings without changing stored data. */
function formatLocationDisplay(raw: string | undefined | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'Location not set';
  const lower = s.toLowerCase().replace(/\s+/g, ' ');
  if (lower === 'unknown, unknown' || lower === 'unknown' || /^unknown\s*,\s*unknown$/.test(lower)) {
    return 'Location not set';
  }
  return s;
}

/** UI-only: polish unknown client labels without changing stored data. */
function formatClientNameDisplay(raw: string | undefined | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'Client not added';
  const l = s.toLowerCase();
  if (l === 'unknown' || l === 'unknown client') return 'Client not added';
  return s;
}

const sanitizePositiveNumber = (value: any): number => {
  if (value == null) return 0;
  const num =
    typeof value === 'string'
      ? Number(value.replace(/[$,\s]/g, ''))
      : Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const toFiniteNumber = (value: any): number => {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[%$,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Exclude deposit from progress — paid before work starts; Week 1+ represents actual work
const isDepositMilestone = (m: any): boolean => {
  const t = (m?.title || m?.name || "").toLowerCase();
  return t.includes("deposit") || m?.type === "deposit";
};

// Helper to calculate progress from milestone items (same logic as TimelineTabV2: deposit + change-order rows excluded)
const computeOverallPctFromItems = (items: any[]): number => {
  if (!items || !Array.isArray(items) || items.length === 0) return 0;
  const workItems = items.filter((m) => !isDepositMilestone(m) && !isChangeOrderTimelineMilestone(m));
  if (!workItems.length) return 0;
  const sum = workItems.reduce((acc, m) => {
    const pct = Math.min(100, Math.max(0, m.progressPct || (m.status === 'completed' ? 100 : m.status === 'in_progress' ? 50 : 0)));
    return acc + pct;
  }, 0);
  return Math.round(sum / workItems.length);
};

const progressFromItems = (items: any[]): number => {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const workItems = items.filter((m) => !isDepositMilestone(m) && !isChangeOrderTimelineMilestone(m));
  if (!workItems.length) return 0;
  const total = workItems.reduce((sum, item) => {
    const explicitPct = toFiniteNumber(item?.progressPct);
    if (explicitPct > 0) return sum + Math.min(100, Math.max(0, explicitPct));

    const status = String(item?.status || '').toLowerCase();
    if (status === 'completed' || status === 'complete' || status === 'paid') return sum + 100;
    if (status === 'in_progress' || status === 'in-progress') return sum + 50;
    return sum;
  }, 0);
  return Math.round(total / workItems.length);
};

const deriveUnifiedProgressPct = (project: any, projectId: string, timelineProgressMap: Record<string, number>): number => {
  // Timeline is source of truth (deposit excluded) — try pid, then title
  if (timelineProgressMap[projectId] !== undefined) {
    return timelineProgressMap[projectId];
  }
  const titleLower = String(project?.title || project?.name || '').trim().toLowerCase();
  const titleSlug = titleLower.replace(/\s+/g, '-');
  if (titleLower && timelineProgressMap[titleLower] !== undefined) return timelineProgressMap[titleLower];
  if (titleSlug && timelineProgressMap[titleSlug] !== undefined) return timelineProgressMap[titleSlug];

  // Fallback to direct progress fields
  const directProgress = Math.max(
    toFiniteNumber(project?.overallProgressPct),
    toFiniteNumber(project?.progress)
  );

  // Fallback to calculating from project's milestone/weeklyPayment arrays
  const milestonesCandidates = [
    project?.milestones,
    project?.projectData?.milestones,
    project?.estimateData?.milestones,
    project?.estimateData?.paymentMilestones,
  ];
  const weeklyCandidates = [
    project?.weeklyPayments,
    project?.projectData?.weeklyPayments,
    project?.estimateData?.weeklyPayments,
  ];

  const derivedFromMilestones = Math.max(...milestonesCandidates.map((items) => progressFromItems(items)));
  const derivedFromWeekly = Math.max(...weeklyCandidates.map((items) => progressFromItems(items)));

  // Use the strongest available signal so weekly and milestone schedules are treated equally.
  const final = Math.max(directProgress, derivedFromMilestones, derivedFromWeekly, 0);
  return final;
};

function milestoneRowLooksComplete(m: any): boolean {
  const p = Number(m?.progressPct ?? m?.progress ?? 0);
  if (Number.isFinite(p) && p >= 100) return true;

  const s = String(m?.status || '').toLowerCase().trim();
  if (!s) return false;
  if (
    /\b(incomplete|unpaid|not[_\s-]?paid|pending|scheduled|open|draft|upcoming)\b/.test(s)
  ) {
    return false;
  }
  if (/\b(completed|complete|collected|closed|done)\b/.test(s)) return true;
  if (/\bpaid\b/.test(s)) return true;

  return false;
}

function maxPlannedMsFromMilestoneList(milestones: any[]): number | null {
  if (!Array.isArray(milestones) || milestones.length === 0) return null;
  let maxMs: number | null = null;
  for (const m of milestones) {
    if (milestoneRowLooksComplete(m)) continue;
    const raw = m?.plannedDate || m?.scheduledDate || m?.dueDate || m?.dateISO || m?.date;
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const t = d.getTime();
    if (maxMs == null || t > maxMs) maxMs = t;
  }
  return maxMs;
}

function resolveTimelineLatestPlannedMsFromMap(
  projectRecord: any,
  latestMap: Record<string, number>
): number | null {
  if (!projectRecord || !latestMap || typeof latestMap !== 'object') return null;
  const normalizeTimelineKey = (v: string) =>
    String(v || '').trim().toLowerCase().replace(/\s+/g, '-');
  const pid = String(projectRecord?.id ?? '').trim();
  const titleRaw = String(projectRecord?.title ?? projectRecord?.name ?? '').trim().toLowerCase();
  const titleSlug = normalizeTimelineKey(titleRaw);
  const titleCompact = titleRaw.replace(/\s+/g, '');
  const candidates = [pid, titleRaw, titleSlug, titleCompact, pid.toLowerCase()].filter(Boolean);
  let best: number | null = null;
  for (const c of candidates) {
    const ms = latestMap[c] ?? latestMap[normalizeTimelineKey(c)];
    if (ms != null && Number.isFinite(ms) && (!best || ms > best)) best = ms;
  }
  return best;
}

function collectTruthyDateStrings(...vals: unknown[]): string[] {
  const out: string[] = [];
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) out.push(s);
  }
  return out;
}

function getLatestJobEndPick(projectRecord: any): { raw: string; date: Date } | null {
  if (!projectRecord) return null;
  const est = projectRecord.estimateData || {};
  const pd = projectRecord.projectData || {};
  const ped = pd.estimateData || {};
  const raws = collectTruthyDateStrings(
    projectRecord.projectEndDate,
    est.projectEndDate,
    est.endDate,
    est.endISO,
    ped.projectEndDate,
    ped.endDate,
    ped.endISO,
    projectRecord.endDate,
    projectRecord.endISO,
    pd.endDate,
    pd.endISO
  );
  let best: { raw: string; date: Date } | null = null;
  for (const raw of raws) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    if (!best || date.getTime() > best.date.getTime()) best = { raw, date };
  }
  return best;
}

function getLatestPendingSchedulePick(projectRecord: any): { raw: string; date: Date } | null {
  if (!projectRecord) return null;
  const est = projectRecord.estimateData || {};
  const pd = projectRecord.projectData || {};
  const ped = pd.estimateData || {};
  const arrays = [
    projectRecord.milestones,
    projectRecord.weeklyPayments,
    projectRecord.paymentMilestones,
    est.milestones,
    est.paymentMilestones,
    est.weeklyPayments,
    ped.paymentMilestones,
    ped.weeklyPayments,
    pd.milestones,
    pd.weeklyPayments,
    pd.paymentMilestones,
  ];
  let best: { raw: string; date: Date } | null = null;
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const m of arr) {
      if (milestoneRowLooksComplete(m)) continue;
      const raw = m?.plannedDate || m?.scheduledDate || m?.dueDate || m?.dateISO || m?.date;
      if (!raw) continue;
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) continue;
      if (!best || date.getTime() > best.date.getTime()) best = { raw: String(raw), date };
    }
  }
  return best;
}

function getEffectiveScheduleEndPick(
  projectRecord: any,
  timelineLatestPlannedMs?: number | null
): { raw: string; date: Date } | null {
  const job = getLatestJobEndPick(projectRecord);
  const sched = getLatestPendingSchedulePick(projectRecord);
  let chosen: { raw: string; date: Date } | null = null;
  if (!job && !sched) chosen = null;
  else if (!sched) chosen = job;
  else if (!job) chosen = sched;
  else chosen = job.date.getTime() >= sched.date.getTime() ? job : sched;

  if (timelineLatestPlannedMs != null && Number.isFinite(timelineLatestPlannedMs)) {
    const t = timelineLatestPlannedMs;
    if (!chosen || t > chosen.date.getTime()) {
      return { raw: new Date(t).toISOString(), date: new Date(t) };
    }
  }
  return chosen;
}

// Palette aligned with key metric cards
const projectCardGradient = ['#070f1e', '#0b1f31', '#0c2f35', '#0fb493'];
const progressGradient = ['#22c55e', '#14b8a6', '#0ea5e9'] as const;
const getStatusTheme = (darkMode: boolean) => ({
  Active: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Completed: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Submitted: { 
    bg: darkMode ? 'rgba(148, 163, 184, 0.24)' : 'rgba(148, 163, 184, 0.15)', 
    border: darkMode ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.25)', 
    color: darkMode ? '#f1f5f9' : '#334155' 
  },
  Won: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Draft: { 
    bg: darkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.15)', 
    border: darkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.25)', 
    color: darkMode ? '#f1f5f9' : '#475569' 
  },
});

/** Expo search params may be string | string[]; keep URL and tab state aligned to avoid remount snapping back to Submitted. */
function tabFromRouteParam(tab: string | string[] | undefined): 'active' | 'submitted' | 'completed' | null {
  const v = Array.isArray(tab) ? tab[0] : tab;
  if (v === 'submitted') return 'submitted';
  if (v === 'completed') return 'completed';
  if (v === 'active') return 'active';
  return null;
}

export default function ProjectsScreen() {
  const router = useRouter();
  useRequireAuth();
  const { t } = useTranslation();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { width: layoutWidth } = useWindowDimensions();
  const desktopWeb = isDesktopWebLayoutWidth(layoutWidth);
  const webScrollContentCap =
    Platform.OS === 'web'
      ? undefined
      : desktopWeb
        ? {
            maxWidth: DASHBOARD_WEB_MAX_CONTENT_WIDTH,
            width: '100%' as const,
            alignSelf: 'center' as const,
          }
        : undefined;
  const tabScrollBottomInset = useTabScrollBottomInset();
  const styles = useMemo(
    () => getStyles(Colors, darkMode, tabScrollBottomInset, desktopWeb, insets.bottom),
    [Colors, darkMode, tabScrollBottomInset, desktopWeb, insets.bottom]
  );
  const { activeProjects, estimates, deleteProject, convertBidToProject, updateProject, refreshProjects } = useProjectList();
  const { enabled: aiPmMode } = useAIManagerMode();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<'active' | 'submitted' | 'completed'>(() => {
    return tabFromRouteParam(params.tab) ?? 'active';
  });
  const [showSubmitBanner, setShowSubmitBanner] = useState(false);
  const submitBannerTranslateY = useRef(new Animated.Value(0)).current;
  const submitBannerOpacity = useRef(new Animated.Value(0)).current;
  const submitBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitBannerPanStartY = useRef(0);
  const submitBannerClosingRef = useRef(false);

  const dismissSubmitBannerAnimated = useCallback(() => {
    if (submitBannerClosingRef.current) return;
    submitBannerClosingRef.current = true;
    if (submitBannerTimerRef.current) {
      clearTimeout(submitBannerTimerRef.current);
      submitBannerTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(submitBannerTranslateY, {
        toValue: -72,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(submitBannerOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      submitBannerClosingRef.current = false;
      if (finished) setShowSubmitBanner(false);
    });
  }, [submitBannerTranslateY, submitBannerOpacity]);

  const submitBannerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > Math.abs(g.dx) && g.dy < -8,
        onPanResponderGrant: () => {
          submitBannerTranslateY.stopAnimation((v) => {
            submitBannerPanStartY.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.min(0, submitBannerPanStartY.current + g.dy);
          submitBannerTranslateY.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy < -36 || g.vy < -0.55) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            dismissSubmitBannerAnimated();
          } else {
            Animated.spring(submitBannerTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 78,
              friction: 11,
            }).start();
          }
        },
      }),
    [submitBannerTranslateY, dismissSubmitBannerAnimated]
  );

  useEffect(() => {
    if (!showSubmitBanner) return;
    submitBannerClosingRef.current = false;
    submitBannerTranslateY.setValue(-52);
    submitBannerOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(submitBannerTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 72,
        friction: 12,
      }),
      Animated.timing(submitBannerOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
    submitBannerTimerRef.current = setTimeout(() => {
      dismissSubmitBannerAnimated();
    }, 4000);
    return () => {
      if (submitBannerTimerRef.current) {
        clearTimeout(submitBannerTimerRef.current);
        submitBannerTimerRef.current = null;
      }
    };
  }, [showSubmitBanner, dismissSubmitBannerAnimated, submitBannerTranslateY, submitBannerOpacity]);

  const [projectDataOverrides, setProjectDataOverrides] = useState<Record<string, any>>({});
  const [timelineProgress, setTimelineProgress] = useState<Record<string, number>>({});
  const [timelineLatestPlannedMs, setTimelineLatestPlannedMs] = useState<Record<string, number>>({});
  const skipNextRefreshRef = React.useRef(false);

  const loadProjectDataOverrides = React.useCallback(async () => {
    if (skipNextRefreshRef.current) return;
    const all = [...activeProjects, ...estimates];
    const next: Record<string, any> = {};
    const progressMap: Record<string, number> = {};
    const latestPlannedMap: Record<string, number> = {};

    const normalizeKey = (v: string) =>
      String(v || '').trim().toLowerCase().replace(/\s+/g, '-');

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
          // Ignore malformed per-project storage entries.
        }
      }

      // Pre-scan ALL timeline keys → suffix→progress (matches useProjectsCompareData exactly)
      const suffixToProgress: Record<string, number> = {};
      const suffixToLatestPlanned: Record<string, number> = {};
      const bumpLatest = (key: string, ms: number) => {
        const prev = suffixToLatestPlanned[key];
        suffixToLatestPlanned[key] = prev == null ? ms : Math.max(prev, ms);
      };
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
            if (Array.isArray(milestones) && milestones.length > 0) {
              const pct = computeOverallPctFromItems(milestones);
              const suffixLower = suffix.toLowerCase();
              const suffixNorm = normalizeKey(suffix);
              suffixToProgress[suffixLower] = pct;
              suffixToProgress[suffixNorm] = pct;
              suffixToProgress[suffix] = pct;
              const latestMs = maxPlannedMsFromMilestoneList(milestones);
              if (latestMs != null) {
                bumpLatest(suffixLower, latestMs);
                bumpLatest(suffixNorm, latestMs);
                bumpLatest(suffix, latestMs);
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Resolve progress for each project from pre-scanned map
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
          if (titleRaw) progressMap[titleRaw] = foundProgress;
          if (titleSlug) progressMap[titleSlug] = foundProgress;
          // Sync to bps.project.${pid}.progress so ProjectListContext/AI use correct value
          try {
            AsyncStorage.setItem(`bps.project.${pid}.progress`, JSON.stringify({
              progress: foundProgress,
              overallProgressPct: foundProgress,
              updatedAt: new Date().toISOString(),
            }));
          } catch {
            /* ignore */
          }
        }

        let foundLatestMs: number | undefined;
        for (const c of candidates) {
          const ms = suffixToLatestPlanned[c] ?? suffixToLatestPlanned[normalizeKey(c)];
          if (ms != null && Number.isFinite(ms)) {
            foundLatestMs = foundLatestMs == null ? ms : Math.max(foundLatestMs, ms);
          }
        }
        if (foundLatestMs !== undefined) {
          latestPlannedMap[pid] = foundLatestMs;
          if (titleRaw) latestPlannedMap[titleRaw] = foundLatestMs;
          if (titleSlug) latestPlannedMap[titleSlug] = foundLatestMs;
        }

        // Load project data override
        const titleKey = String(project?.title ?? '').trim().toLowerCase();
        const override = byId[pid] || (titleKey ? byTitle[titleKey] : undefined);
        if (override) next[pid] = override;
      }
    } catch {
      // Keep UI responsive if storage read fails.
    }

    setProjectDataOverrides(next);
    setTimelineProgress(progressMap);
    setTimelineLatestPlannedMs(latestPlannedMap);
  }, [activeProjects, estimates]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadProjectDataOverrides();
    });
    return () => task.cancel();
  }, [loadProjectDataOverrides]);

  useFocusEffect(
    React.useCallback(() => {
      // Skip refresh right after delete — Alert dismiss can trigger focus and cause a glitchy re-render
      if (skipNextRefreshRef.current) return;
      // Check for pending tab from Submit Bid (tab params can be empty with tab navigator)
      (async () => {
        try {
          const pendingTab = await AsyncStorage.getItem('bps.pendingProjectsTab');
          const fromSubmit = await AsyncStorage.getItem('bps.fromSubmitBid');
          if (pendingTab === 'submitted') {
            setActiveTab('submitted');
            try {
              router.setParams({ tab: 'submitted' });
            } catch {
              /* ignore */
            }
            setShowSubmitBanner(fromSubmit === 'true');
          }
          await AsyncStorage.removeItem('bps.pendingProjectsTab');
          await AsyncStorage.removeItem('bps.fromSubmitBid');
        } catch {
          /* ignore */
        }
      })();
      const task = InteractionManager.runAfterInteractions(() => {
        refreshProjects();
      });
      return () => task.cancel();
    }, [refreshProjects])
  );

  // Update tab if route param changes (deep links / external navigation)
  useEffect(() => {
    const t = tabFromRouteParam(params.tab);
    if (t === 'submitted') {
      setActiveTab('submitted');
      // Show confirmation banner when arriving from submit bid
      if (params.fromSubmit === 'true') {
        setShowSubmitBanner(true);
      }
    } else if (t === 'completed') {
      setActiveTab('completed');
    } else if (t === 'active') {
      setActiveTab('active');
    }
  }, [params.tab, params.fromSubmit]);

  const user = {
    name: 'Nick Lafontaine',
    initials: 'NL',
  };

  // Transform projects data - separate submitted and active
  const allProjects = useMemo(() => {
    return [...activeProjects, ...estimates]
      .filter((p) => {
        const status = (p.status || 'draft').toString().toLowerCase();
        // Only show projects that are submitted or beyond (hide draft/estimate)
        return status !== 'draft' && 
               status !== 'estimate' && 
               (status === 'bid_submitted' || 
                status === 'submitted' || 
                status === 'won' || 
                status === 'in_progress' || 
                status === 'active' || 
                status === 'completed');
      })
      .map((p) => {
        const pid = String(p?.id ?? '');
        const override = projectDataOverrides[pid];

        const mergedProject = override
          ? {
              ...p,
              budgeted: override?.budgeted ?? p?.budgeted,
              changeOrders: Array.isArray(override?.changeOrders)
                ? override.changeOrders
                : (Array.isArray(p?.changeOrders) ? p.changeOrders : []),
              projectData: {
                ...(p?.projectData || {}),
                ...override,
                changeOrders: Array.isArray(override?.changeOrders)
                  ? override.changeOrders
                  : (Array.isArray(p?.projectData?.changeOrders) ? p.projectData.changeOrders : []),
              },
            }
          : p;

        const progressPct = deriveUnifiedProgressPct(mergedProject, pid, timelineProgress);
        const fin = computeProjectListRowFinancials({
          mergedProject,
          originalRow: p,
          progressPct,
        });
        const scheduleTimelineMs = resolveTimelineLatestPlannedMsFromMap(mergedProject, timelineLatestPlannedMs);
        const scheduleEndPick = getEffectiveScheduleEndPick(mergedProject, scheduleTimelineMs);
        const scheduleEnd = scheduleEndPick?.raw;
        const dateSourceRaw =
          fin.slugForUi === 'completed'
            ? pickCompletedDisplayDateRaw(mergedProject, scheduleEndPick)
            : scheduleEnd;

        return {
          id: p.id,
          name: p.title || 'Untitled Project',
          status: fin.displayStatus,
          location: p.location || 'Unknown, Unknown',
          progress: fin.finalProgress,
          amount: fin.displayAmount,
          margin: fin.margin,
          marginDisplay: fin.marginDisplay,
          projectedProfit: fin.projectedProfit,
          dateLabel: dateSourceRaw
            ? fin.slugForUi === 'completed'
              ? `Completed ${formatDateShort(dateSourceRaw)}`
              : `Schedule ${formatDateShort(dateSourceRaw)}`
            : 'No schedule',
          rawProject: mergedProject,
          rawStatus: fin.rawStatus,
        };
    });
  }, [activeProjects, estimates, projectDataOverrides, timelineLatestPlannedMs, timelineProgress]);

  // Filter projects by active tab
  const projects = useMemo(() => {
    if (activeTab === 'submitted') {
      return allProjects.filter(p => p.status === 'Submitted' || p.rawStatus === 'bid_submitted' || p.rawStatus === 'submitted');
    } else if (activeTab === 'completed') {
      return allProjects.filter(p => p.status === 'Completed' || p.rawStatus === 'completed');
    } else {
      return allProjects.filter(
        (p) =>
          p.status === 'Active' ||
          p.rawStatus === 'won' ||
          p.rawStatus === 'in_progress' ||
          p.rawStatus === 'in-progress' ||
          p.rawStatus === 'active'
      );
    }
  }, [allProjects, activeTab]);

  const handleProjectPress = (project: any) => {
    router.push(`/project-detail/${project.id}`);
  };

  const [markAsWonModalVisible, setMarkAsWonModalVisible] = useState(false);
  const [selectedProjectForWon, setSelectedProjectForWon] = useState<any>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successProjectName, setSuccessProjectName] = useState('');
  const successBannerTranslateY = useRef(new Animated.Value(0)).current;
  const successBannerOpacity = useRef(new Animated.Value(0)).current;
  const successBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successBannerPanStartY = useRef(0);
  const successBannerClosingRef = useRef(false);

  const dismissSuccessBannerAnimated = useCallback(() => {
    if (successBannerClosingRef.current) return;
    successBannerClosingRef.current = true;
    if (successBannerTimerRef.current) {
      clearTimeout(successBannerTimerRef.current);
      successBannerTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(successBannerTranslateY, {
        toValue: -72,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(successBannerOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      successBannerClosingRef.current = false;
      if (finished) setShowSuccessBanner(false);
    });
  }, [successBannerTranslateY, successBannerOpacity]);

  const successBannerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > Math.abs(g.dx) && g.dy < -8,
        onPanResponderGrant: () => {
          successBannerTranslateY.stopAnimation((v) => {
            successBannerPanStartY.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.min(0, successBannerPanStartY.current + g.dy);
          successBannerTranslateY.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy < -36 || g.vy < -0.55) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            dismissSuccessBannerAnimated();
          } else {
            Animated.spring(successBannerTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 78,
              friction: 11,
            }).start();
          }
        },
      }),
    [successBannerTranslateY, dismissSuccessBannerAnimated]
  );

  useEffect(() => {
    if (!showSuccessBanner) return;
    successBannerClosingRef.current = false;
    successBannerTranslateY.setValue(-52);
    successBannerOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(successBannerTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 72,
        friction: 12,
      }),
      Animated.timing(successBannerOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
    successBannerTimerRef.current = setTimeout(() => {
      dismissSuccessBannerAnimated();
    }, 4000);
    return () => {
      if (successBannerTimerRef.current) {
        clearTimeout(successBannerTimerRef.current);
        successBannerTimerRef.current = null;
      }
    };
  }, [showSuccessBanner, dismissSuccessBannerAnimated, successBannerTranslateY, successBannerOpacity]);

  const { user: clerkUser } = useUser();
  const {
    hydrated: wtHydrated,
    shouldShowFirstProject,
    markSkipped: markWalkthroughSkipped,
  } = useWalkthroughState();
  const [apWtProgressHydrated, setApWtProgressHydrated] = useState(false);
  const [apWtIntroResolved, setApWtIntroResolved] = useState(false);
  const [apWtStarted, setApWtStarted] = useState(false);
  const [apWtSkipTips, setApWtSkipTips] = useState(false);
  const [apWtPendingProjectId, setApWtPendingProjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!wtHydrated) {
      setApWtProgressHydrated(false);
      return;
    }
    if (!shouldShowFirstProject) {
      setApWtProgressHydrated(true);
      return;
    }
    (async () => {
      const p = await loadActiveProjectWalkthroughProgress();
      if (cancelled) return;
      if (p) {
        setApWtIntroResolved(Boolean(p.introResolved));
        setApWtStarted(Boolean(p.started));
        setApWtSkipTips(Boolean(p.skipTips));
      }
      setApWtProgressHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [wtHydrated, shouldShowFirstProject]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const pending = await getPendingActiveProjectWalkthroughProjectId();
        if (cancelled) return;
        setApWtPendingProjectId(pending);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const hasActiveProjectForWalkthrough = useMemo(() => {
    if (apWtPendingProjectId) return true;
    return allProjects.some(
      (p) =>
        p.status === 'Active' ||
        p.rawStatus === 'won' ||
        p.rawStatus === 'in_progress' ||
        p.rawStatus === 'in-progress' ||
        p.rawStatus === 'active'
    );
  }, [allProjects, apWtPendingProjectId]);

  const shouldShowActiveProjectWalkthrough =
    wtHydrated &&
    shouldShowFirstProject &&
    apWtProgressHydrated &&
    hasActiveProjectForWalkthrough;

  const activeProjectWalkthroughIntroVisible =
    shouldShowActiveProjectWalkthrough &&
    activeTab === 'active' &&
    (projects.length > 0 || Boolean(apWtPendingProjectId)) &&
    !apWtIntroResolved &&
    !apWtStarted &&
    !apWtSkipTips;

  const activeProjectWalkthroughScrollPadBottom =
    activeProjectWalkthroughIntroVisible
      ? Math.round(Dimensions.get('window').height * 0.24) + 28
      : 0;

  const handleActiveProjectWalkthroughIntroStart = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const chosenId =
      apWtPendingProjectId ||
      projects.find(
        (p) =>
          p.status === 'Active' ||
          p.rawStatus === 'won' ||
          p.rawStatus === 'in_progress' ||
          p.rawStatus === 'in-progress' ||
          p.rawStatus === 'active'
      )?.id;
    if (!chosenId) return;
    await saveActiveProjectWalkthroughProgress({
      introResolved: true,
      started: true,
      detailStepIndex: 0,
      tourProjectId: String(chosenId),
    });
    await clearPendingActiveProjectWalkthroughProjectId();
    setApWtPendingProjectId(null);
    setApWtIntroResolved(true);
    setApWtStarted(true);
    router.push(`/project-detail/${chosenId}?apWt=1`);
  }, [apWtPendingProjectId, projects, router]);

  const handleActiveProjectWalkthroughIntroSkip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setApWtIntroResolved(true);
    setApWtSkipTips(true);
    await clearPendingActiveProjectWalkthroughProjectId();
    setApWtPendingProjectId(null);
    if (clerkUser?.id) {
      await markWalkthroughSkipped('firstProject');
    }
  }, [clerkUser?.id, markWalkthroughSkipped]);

  useEffect(() => {
    if (!activeProjectWalkthroughIntroVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleActiveProjectWalkthroughIntroSkip();
      return true;
    });
    return () => sub.remove();
  }, [activeProjectWalkthroughIntroVisible, handleActiveProjectWalkthroughIntroSkip]);

  const handleDeleteProject = async (project: any, e: any) => {
    // Stop event propagation so it doesn't trigger the card press
    e?.stopPropagation?.();

    // Set immediately when entering delete flow so any focus event from Alert show/dismiss
    // skips refreshProjects (which would load stale AsyncStorage and bring the project back)
    skipNextRefreshRef.current = true;
    const cancelTimeout = setTimeout(() => {
      skipNextRefreshRef.current = false;
    }, 3000);

    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {
        /* haptics unavailable */
      }
    }

    const title = t('projects.deleteProject');
    const message = t('projects.deleteConfirm', { name: project.name });

    const runDelete = async () => {
      clearTimeout(cancelTimeout);
      try {
        await deleteProject(project.id);
        if (Platform.OS !== 'web') {
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (_) {
            /* haptics unavailable */
          }
        }
      } catch (error) {
        console.error('Error deleting project:', error);
        const hint =
          error instanceof Error && error.message
            ? `\n\n${error.message}`
            : '';
        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(`${t('common.error')}\n\n${t('projects.deleteError')}${hint}`);
        } else {
          Alert.alert(t('common.error'), `${t('projects.deleteError')}${hint}`);
        }
        skipNextRefreshRef.current = false;
      } finally {
        setTimeout(() => {
          skipNextRefreshRef.current = false;
        }, 800);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const ok = window.confirm(`${title}\n\n${message}`);
      if (!ok) {
        clearTimeout(cancelTimeout);
        skipNextRefreshRef.current = false;
        return;
      }
      await runDelete();
      return;
    }

    Alert.alert(title, message, [
      {
        text: t('common.cancel'),
        style: 'cancel',
        onPress: () => {
          clearTimeout(cancelTimeout);
          skipNextRefreshRef.current = false;
        },
      },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void runDelete();
        },
      },
    ]);
  };

  const handleMarkAsWon = (project: any, e: any) => {
    e?.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProjectForWon(project);
    setMarkAsWonModalVisible(true);
  };

  const confirmMarkAsWon = async () => {
    if (!selectedProjectForWon) return;
    const projectName = selectedProjectForWon.name;
    const projectId = selectedProjectForWon.id;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMarkAsWonModalVisible(false);
    setSelectedProjectForWon(null);

    try {
      const walkthroughDone = wtHydrated && !shouldShowFirstProject;
      if (!walkthroughDone) {
        await setPendingActiveProjectWalkthroughProjectId(projectId);
        setApWtPendingProjectId(projectId);
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveTab('active');
      try {
        router.setParams({ tab: 'active' });
      } catch {
        /* ignore */
      }
      convertBidToProject(projectId);

      setSuccessProjectName(projectName);
      setShowSuccessBanner(true);
    } catch (error) {
      console.error('Error marking project as won:', error);
      Alert.alert('Error', 'Failed to mark project as won');
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.root,
        Platform.OS === "web" && desktopWeb && styles.rootDesktopWeb,
      ]}
    >
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && { paddingHorizontal: 0, paddingTop: 0 },
          webScrollContentCap,
          activeProjectWalkthroughScrollPadBottom > 0 && {
            paddingBottom: tabScrollBottomInset + activeProjectWalkthroughScrollPadBottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <WebPageShell size="projects" scroll={false} contentStyle={{ paddingBottom: 0 }}>
        {/* HEADER */}
        <TabScreenHeader
          style={styles.wideContainer}
          title={t('projects.allProjects')}
          subtitle={`${projects.length} ${activeTab === 'submitted' ? 'submitted' : activeTab === 'completed' ? 'completed' : 'active'} ${projects.length === 1 ? 'project' : 'projects'}`}
          titleColor={darkMode ? '#F5F7FA' : Colors.text}
          subtitleColor={darkMode ? 'rgba(255,255,255,0.62)' : '#475569'}
          titleStyle={styles.budgetPageTitleFont}
          subtitleStyle={styles.budgetPageSubtitleFont}
          right={
            <LinearGradient
              pointerEvents="box-none"
              colors={progressGradient}
              style={styles.profileOuter}
            >
              <Pressable
                style={styles.profileInner}
                onPress={() => router.push('/profile')}
                accessibilityRole="button"
                accessibilityLabel="Profile"
              >
                <Text style={styles.profileInitials}>{user.initials}</Text>
              </Pressable>
            </LinearGradient>
          }
        />

        {/* TABS */}
        <View style={[styles.tabsContainer, styles.wideContainer]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('active');
              try {
                router.setParams({ tab: 'active' });
              } catch {
                /* ignore */
              }
            }}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'submitted' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('submitted');
              try {
                router.setParams({ tab: 'submitted' });
              } catch {
                /* ignore */
              }
            }}
          >
            <Text style={[styles.tabText, activeTab === 'submitted' && styles.tabTextActive]}>
              Submitted
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('completed');
              try {
                router.setParams({ tab: 'completed' });
              } catch {
                /* ignore */
              }
            }}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        {/* ALL PROJECTS CARD — highlight ring while active-project walkthrough intro is showing */}
        <FirstEstimateWalkthroughHighlight active={activeProjectWalkthroughIntroVisible}>
        <View style={styles.wideContainer}>
          <LinearGradient
            colors={["#2DFFC4", "#00A6FF"]}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={{
              borderRadius: 20,
              padding: 1,
              marginBottom: 16,
            }}
          >
            <View style={{
              /* Light: match page bg; dark: unchanged */
              backgroundColor: darkMode ? Colors.card : Colors.bg,
              borderRadius: 18,
              padding: 12,
            }}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.allProjectsCardTitle}>{t('projects.allProjects')}</Text>
                  <Text style={styles.allProjectsCardSubtitle}>
                    {projects.length} {t('dashboard.total')} · {t('projects.latestActivity')}
                  </Text>
                </View>
              </View>
              
              {projects.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="folder-outline" size={48} color={darkMode ? 'rgba(255,255,255,0.82)' : '#475569'} />
                  <Text style={styles.emptyStateText}>
                    {activeTab === 'submitted'
                      ? 'No submitted bids yet'
                      : activeTab === 'completed'
                        ? 'No completed projects yet'
                        : 'No active projects yet'}
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    {activeTab === 'submitted'
                      ? 'Once you send estimates, they’ll appear here.'
                      : activeTab === 'completed'
                        ? 'Finished jobs will appear here.'
                        : 'Your in-progress jobs will show up here.'}
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 12 }}>
                  {projects.map((project) => {
                    const statusThemeMap = getStatusTheme(darkMode);
                    const statusKey =
                      (project.status in statusThemeMap ? project.status : 'Draft') as keyof typeof statusThemeMap;
                    const pill = statusThemeMap[statusKey];
                    const isCompletedProject =
                      project.status === 'Completed' || project.rawStatus === 'completed';
                    return (
                    <Pressable
                      key={project.id}
                      style={styles.projectCard}
                      onPress={() => handleProjectPress(project)}
                    >
                      <View
                        style={[
                          styles.projectCardBorderLight,
                          darkMode && styles.projectCardBorderDark,
                          !darkMode && {
                            borderColor:
                              Platform.OS === 'web'
                                ? 'rgba(148, 163, 184, 0.48)'
                                : Colors.line,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.projectCardInner,
                            !darkMode && {
                              borderWidth: 1,
                              borderColor:
                                Platform.OS === 'web'
                                  ? 'rgba(148, 163, 184, 0.42)'
                                  : Colors.line,
                            },
                          ]}
                        >
                  <View style={styles.projectTopRow}>
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <Text
                        style={styles.projectName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {project.name}
                      </Text>
                    </View>
                    <View style={styles.projectTopActions}>
                      <View
                        style={[
                          styles.statusPillBase,
                          {
                            backgroundColor: pill.bg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillTextBase,
                            { color: pill.color },
                          ]}
                        >
                          {project.status}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('projects.deleteProject')}
                        onPress={(ev) => {
                          ev?.stopPropagation?.();
                          void handleDeleteProject(project, ev);
                        }}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          Platform.OS === 'web' && pressed ? { opacity: 0.85 } : null,
                        ]}
                        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                      >
                        <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.projectFinancialBlock}>
                    <View style={styles.projectAmountRow}>
                      <View style={styles.projectAmountLeft}>
                        <Text style={styles.projectAmount}>
                          {formatMoneyUSD(project.amount)}
                        </Text>
                        {aiPmMode && (
                          <View style={styles.aiTagChip}>
                            <Ionicons
                              name="sparkles-outline"
                              size={11}
                              color="#22C55E"
                            />
                            <Text style={[styles.aiTagText, { color: '#22C55E' }]}>AI Assist</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.projectDateBlock}>
                        <Text style={styles.projectMetaLabel}>
                          {project.dateLabel.startsWith('Completed ')
                            ? 'Completed'
                            : project.dateLabel.startsWith('Schedule ')
                              ? 'Schedule'
                              : ''}
                        </Text>
                        <Text style={styles.projectMetaText} numberOfLines={1}>
                          {project.dateLabel.startsWith('Completed ')
                            ? project.dateLabel.slice('Completed '.length)
                            : project.dateLabel.startsWith('Schedule ')
                              ? project.dateLabel.slice('Schedule '.length)
                              : project.dateLabel === 'No schedule'
                                ? '—'
                                : project.dateLabel}
                        </Text>
                      </View>
                    </View>
                    {project.projectedProfit != null && Number.isFinite(project.projectedProfit) && (
                      <Text style={styles.projectProfitLine}>
                        {isCompletedProject ? 'Net profit' : 'Est. profit'}:{' '}
                        {formatMoneyUSD(
                          isCompletedProject ? project.projectedProfit : Math.round(project.projectedProfit)
                        )}
                      </Text>
                    )}
                    <Text style={styles.projectMarginLine}>
                      {isCompletedProject ? 'Net margin' : 'Est. margin'}: {Number(project.margin).toFixed(1)}%
                    </Text>
                  </View>

                  <View style={styles.projectMetaSection}>
                    <View style={styles.projectLocationRow}>
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color={darkMode ? 'rgba(255,255,255,0.82)' : '#475569'}
                      />
                      <Text style={styles.projectLocationText}>
                        {formatLocationDisplay(project.location)}
                      </Text>
                    </View>
                    {(project.rawProject?.client || project.rawProject?.estimateData?.customerName || project.rawProject?.clientEmail || project.rawProject?.estimateData?.customerEmail) && (
                      <View style={styles.projectClientRow}>
                        {(project.rawProject?.client || project.rawProject?.estimateData?.customerName) && (
                          <View style={styles.projectClientItem}>
                            <Ionicons name="person-outline" size={12} color={darkMode ? 'rgba(255,255,255,0.82)' : '#475569'} />
                            <Text style={styles.projectClientText}>
                              {formatClientNameDisplay(
                                project.rawProject?.client || project.rawProject?.estimateData?.customerName
                              )}
                            </Text>
                          </View>
                        )}
                        {(project.rawProject?.clientEmail || project.rawProject?.estimateData?.customerEmail) && (
                          <View style={styles.projectClientItem}>
                            <Ionicons name="mail-outline" size={12} color={darkMode ? 'rgba(255,255,255,0.82)' : '#475569'} />
                            <Text style={styles.projectClientText}>
                              {project.rawProject?.clientEmail || project.rawProject?.estimateData?.customerEmail}
                            </Text>
                          </View>
                        )}
                        {(project.rawProject?.clientPhone || project.rawProject?.estimateData?.customerPhone) && (
                          <View style={styles.projectClientItem}>
                            <Ionicons name="call-outline" size={12} color={darkMode ? 'rgba(255,255,255,0.82)' : '#475569'} />
                            <Text style={styles.projectClientText}>
                              {project.rawProject?.clientPhone || project.rawProject?.estimateData?.customerPhone}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    {project.status === 'Submitted' && (
                      <View style={styles.waitingClientRow}>
                        <Ionicons name="time-outline" size={12} color={darkMode ? 'rgba(255,255,255,0.77)' : '#475569'} />
                        <Text style={styles.waitingClientText}>
                          Waiting for client decision
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.progressSection}>
                    <View style={styles.progressHeaderRow}>
                      <Text style={styles.progressHeaderLabel}>Progress</Text>
                      <Text style={styles.progressHeaderPercent}>
                        {Math.round(project.progress * 100)}%
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <LinearGradient
                        colors={progressGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(
                              Math.max(project.progress * 100, 0),
                              100
                            )}%`,
                            opacity: darkMode ? 1 : 0.9,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  
                  {/* Mark as Won button for submitted projects */}
                  {project.status === 'Submitted' && (
                    <TouchableOpacity
                      style={styles.markAsWonButton}
                      onPress={(e) => handleMarkAsWon(project, e)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#2DFFC4', '#00A6FF']}
                        start={{ x: 0.05, y: 0.15 }}
                        end={{ x: 0.95, y: 0.85 }}
                        style={styles.markAsWonGradient}
                      >
                        <Text style={styles.markAsWonText}>Mark as Won</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                        </View>
                </View>
              </Pressable>
            );
          })}
                </View>
              )}
            </View>
          </LinearGradient>
        </View>
        </FirstEstimateWalkthroughHighlight>

        <View style={{ height: 32 }} />
        </WebPageShell>
      </ScrollView>

      {/* Submit bid — floating glass toast (auto-dismiss + swipe up) */}
      {showSubmitBanner ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.submitBannerWrap,
            {
              top: insets.top + 10,
              opacity: submitBannerOpacity,
              transform: [{ translateY: submitBannerTranslateY }],
            },
          ]}
          {...submitBannerPanResponder.panHandlers}
        >
          <BlurView
            intensity={darkMode ? 38 : 44}
            tint={darkMode ? 'dark' : 'light'}
            style={styles.submitBannerBlur}
          >
            <LinearGradient
              colors={['rgba(34, 197, 94, 0.55)', 'rgba(45, 255, 196, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitBannerTopAccent}
            />
            <View style={styles.submitBannerInner}>
              <View style={styles.submitBannerIconWrap}>
                <Ionicons name="checkmark-circle" size={17} color="#4ade80" />
              </View>
              <View style={styles.submitBannerTextCol}>
                <Text style={styles.submitBannerTitle}>Bid submitted</Text>
                <Text style={styles.submitBannerBody}>
                  Ready to convert into a project.
                </Text>
              </View>
            </View>
          </BlurView>
        </Animated.View>
      ) : null}

      {/* Project activated — same glass toast as bid submitted (auto-dismiss + swipe up) */}
      {showSuccessBanner ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.submitBannerWrap,
            {
              top: insets.top + 10,
              opacity: successBannerOpacity,
              transform: [{ translateY: successBannerTranslateY }],
            },
          ]}
          {...successBannerPanResponder.panHandlers}
        >
          <BlurView
            intensity={darkMode ? 38 : 44}
            tint={darkMode ? 'dark' : 'light'}
            style={styles.submitBannerBlur}
          >
            <LinearGradient
              colors={['rgba(34, 197, 94, 0.55)', 'rgba(45, 255, 196, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitBannerTopAccent}
            />
            <View style={styles.submitBannerInner}>
              <View style={styles.submitBannerIconWrap}>
                <Ionicons name="checkmark-circle" size={17} color="#4ade80" />
              </View>
              <View style={styles.submitBannerTextCol}>
                <Text style={styles.submitBannerTitle}>Project activated</Text>
                <Text style={styles.submitBannerBody} numberOfLines={2}>
                  {successProjectName} is now a live project.
                </Text>
              </View>
            </View>
          </BlurView>
        </Animated.View>
      ) : null}

      {/* Mark as Won Confirmation Modal (Bottom Sheet) */}
      <Modal
        visible={markAsWonModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMarkAsWonModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMarkAsWonModalVisible(false)}
        >
          <Pressable
            style={styles.bottomSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>Mark project as won?</Text>
            <Text style={styles.bottomSheetBody}>
              This will convert your estimate into an active project and begin tracking costs, labor, and profit.
            </Text>
            <View style={styles.bottomSheetButtons}>
              <TouchableOpacity
                style={styles.bottomSheetCancelButton}
                onPress={() => {
                  setMarkAsWonModalVisible(false);
                  setSelectedProjectForWon(null);
                }}
              >
                <Text style={styles.bottomSheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bottomSheetConfirmButton}
                onPress={confirmMarkAsWon}
              >
                <LinearGradient
                  colors={['#2DFFC4', '#00A6FF']}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.bottomSheetConfirmGradient}
                >
                  <Text style={styles.bottomSheetConfirmText}>Mark as won</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {activeProjectWalkthroughIntroVisible ? (
        <View
          style={styles.activeProjectWalkthroughLayer}
          pointerEvents="box-none"
        >
          <FirstEstimateWalkthroughSheetShell
            darkMode={darkMode}
            bottomOffset={tabScrollBottomInset}
          >
            <FirstEstimateWalkthroughIntroSheetContent
              darkMode={darkMode}
              Colors={Colors}
              title="Manage your active project"
              body="Take a quick tour of Overview, Budget, Timeline, Calendar, and Team so you know where to track costs, payments, and crew."
              startButtonLabel="Start walkthrough"
              onStart={handleActiveProjectWalkthroughIntroStart}
              onSkip={handleActiveProjectWalkthroughIntroSkip}
            />
          </FirstEstimateWalkthroughSheetShell>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, darkMode: boolean, scrollBottomInset: number = 120, desktopWeb = false, safeAreaInsetBottom = 0) => {
  const edge = desktopWeb ? WEB_DESKTOP_EDGE_HORIZONTAL : ScreenLayout.edge.horizontal;
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  rootDesktopWeb: {
    backgroundColor: Colors.bg === "#000000" ? Colors.bg : "#f1f5f9",
  },
  scrollContent: {
    paddingTop: desktopWeb ? 24 : ScreenLayout.screen.paddingTop,
    paddingHorizontal: edge,
    paddingBottom: scrollBottomInset,
  },
  wideContainer: {
    marginHorizontal: -edge,
    paddingHorizontal: desktopWeb ? 8 : 4,
  },
  card: {
    borderRadius: ScreenLayout.card.radius,
    padding: ScreenLayout.card.padding,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.line,
    marginBottom: ScreenLayout.card.marginBottom,
  },
  projectsCardWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  /** Matches BudgetTab budgetPageTitle / budgetPageSubtitle (project Budget screen) */
  budgetPageTitleFont: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  budgetPageSubtitleFont: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  allProjectsCardTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: darkMode ? '#F5F7FA' : Colors.text,
  },
  allProjectsCardSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: darkMode ? 'rgba(255,255,255,0.62)' : '#475569',
  },
  projectCard: {
    marginTop: 8,
  },
  projectCardBorderLight: {
    borderRadius: 20,
    padding: 1,
    borderWidth: 1,
  },
  projectCardBorderDark: {
    padding: 0,
    borderWidth: 0,
  },
  projectCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  projectCardInner: {
    backgroundColor: Colors.surface2, // Same grey as dashboard project cards
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor:
      Platform.OS === 'web'
        ? darkMode
          ? 'rgba(203, 213, 225, 0.32)'
          : 'rgba(148, 163, 184, 0.42)'
        : darkMode
          ? 'rgba(148, 163, 184, 0.22)'
          : Colors.line,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: darkMode ? 0.35 : 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: darkMode ? 4 : 2,
      },
    }),
  },
  projectCardGradient: {
    width: '100%',
    borderRadius: 24,
    padding: 16,
  },
  projectTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  projectTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  /** Matches BudgetTab budgetCardTitle / overview hero project name */
  projectName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
    color: darkMode ? '#F5F7FA' : Colors.text,
    flexShrink: 1,
  },
  projectLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    gap: 6,
  },
  projectLocationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: darkMode ? 'rgba(255,255,255,0.88)' : '#475569',
  },
  projectFinancialBlock: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.45)',
  },
  projectAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  projectAmountLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  projectDateBlock: {
    alignItems: 'flex-end',
    maxWidth: '40%',
  },
  projectProfitLine: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: darkMode ? '#F5F7FA' : '#1e293b',
  },
  projectMarginLine: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.15,
    color: darkMode ? 'rgba(255,255,255,0.56)' : '#64748b',
  },
  projectMetaSection: {
    gap: 6,
  },
  projectClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  projectClientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectClientText: {
    fontSize: 11,
    color: darkMode ? 'rgba(255,255,255,0.87)' : '#475569',
    maxWidth: 200,
  },
  waitingClientRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waitingClientText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: darkMode ? 'rgba(255,255,255,0.83)' : '#475569',
  },
  statusPillBase: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)',
  },
  statusPillTextBase: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0', // Will be overridden inline for light mode
    letterSpacing: 0.2,
  },
  /** Budget rowValueIntelHero — primary $ on list cards */
  projectAmount: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: darkMode ? '#F5F7FA' : Colors.text,
  },
  projectMetaText: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.28,
    color: darkMode ? '#F5F7FA' : '#1e293b',
  },
  /** Budget rowLabelMetric */
  projectMetaLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: darkMode ? 'rgba(255,255,255,0.64)' : 'rgba(15,23,42,0.62)',
  },
  progressSection: {
    marginTop: 14,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressHeaderLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: darkMode ? 'rgba(255,255,255,0.64)' : 'rgba(15,23,42,0.62)',
  },
  progressHeaderPercent: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.28,
    fontVariant: ['tabular-nums'],
    color: darkMode ? '#F5F7FA' : Colors.text,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.9)' : '#CBD5E1',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.15)' : Colors.line,
  },
  progressBarFill: {
    height: 8,
    borderRadius: 999,
  },
  aiTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: darkMode ? 'rgba(34,197,94,0.18)' : 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(74, 222, 128, 0.35)' : 'rgba(34, 197, 94, 0.28)',
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: darkMode ? '#BBF7D0' : '#166534',
    letterSpacing: 0.2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: darkMode ? Colors.text : Colors.text,
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: darkMode ? 'rgba(255,255,255,0.87)' : '#475569',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 19,
  },
  deleteButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: darkMode ? Colors.surface2 : "#FFFFFF",
    borderWidth: 1,
    borderColor: darkMode ? "rgba(239, 68, 68, 0.35)" : "rgba(220, 38, 38, 0.35)",
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  profileOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  profileInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: darkMode ? Colors.card : Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.06)' : Colors.cardDark,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(255, 255, 255, 0.12)' : Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabActive: {
    backgroundColor: darkMode ? 'rgba(45, 255, 196, 0.15)' : 'rgba(45, 255, 196, 0.1)',
    borderWidth: 2,
    borderColor: darkMode ? '#2DFFC4' : '#0EA5E9',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: darkMode ? 'rgba(255,255,255,0.91)' : '#475569',
  },
  tabTextActive: {
    color: darkMode ? '#2DFFC4' : '#0EA5E9',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: darkMode ? '#2DFFC4' : '#0EA5E9',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  markAsWonButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  markAsWonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAsWonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  /** Walkthrough layer above ScrollView; below toast banners (3000) so glass toasts stay crisp */
  activeProjectWalkthroughLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2500,
    elevation: 2500,
  },
  submitBannerWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    /** Above FirstEstimateWalkthroughSheetShell (zIndex 2000) so dim/blur doesn’t flatten the glass toast */
    zIndex: 3000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: darkMode ? 0.35 : 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 3000,
      },
    }),
  },
  submitBannerBlur: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: darkMode ? 'rgba(74, 222, 128, 0.22)' : 'rgba(34, 197, 94, 0.18)',
    backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.78)',
  },
  submitBannerTopAccent: {
    height: 2,
    width: '100%',
    opacity: 0.95,
  },
  submitBannerInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 11,
    gap: 10,
  },
  submitBannerIconWrap: {
    marginTop: 1,
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  submitBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: darkMode ? Colors.text : '#0f172a',
    marginBottom: 2,
  },
  submitBannerBody: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
    color: darkMode ? 'rgba(248, 250, 252, 0.78)' : 'rgba(51, 65, 85, 0.92)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web'
      ? { alignItems: 'center' as const, paddingHorizontal: 16 }
      : {}),
  },
  bottomSheet: {
    backgroundColor: darkMode ? Colors.card : Colors.cardDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.42)' : '#94a3b8',
    padding: 24,
    paddingBottom: Platform.OS === 'web' ? 40 : Math.max(40, 28 + safeAreaInsetBottom),
    maxHeight: '50%',
    ...(Platform.OS === 'web'
      ? {
          width: '100%',
          maxWidth: 520,
          alignSelf: 'center' as const,
          borderRadius: 20,
          marginBottom: Math.max(24, safeAreaInsetBottom > 0 ? safeAreaInsetBottom + 8 : 24),
        }
      : {
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          marginBottom: Math.max(14, safeAreaInsetBottom + 10),
        }),
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: darkMode ? Colors.sub : '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  bottomSheetBody: {
    fontSize: 16,
    color: Colors.sub,
    lineHeight: 24,
    marginBottom: 24,
  },
  bottomSheetButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomSheetCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: darkMode ? Colors.surface2 : '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetCancelText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSheetConfirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bottomSheetConfirmGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetConfirmText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
};
