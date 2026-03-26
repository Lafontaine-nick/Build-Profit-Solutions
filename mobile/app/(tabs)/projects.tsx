import React, { useState, useMemo, useEffect, useRef } from 'react';
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
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { LinearGradient } from 'expo-linear-gradient';
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
import { computeProfitForecast } from '@/src/lib/profitForecast';

// Utility functions (same as dashboard)
const formatCurrencyShort = (value: number) => {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
};

// Format currency as full value with 2 decimal places (e.g., $3,000.00)
const formatCurrencyFull = (value: number) => {
  return value.toLocaleString('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });
};

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

// Helper to calculate progress from milestone items (same logic as TimelineTabV2)
const computeOverallPctFromItems = (items: any[]): number => {
  if (!items || !Array.isArray(items) || items.length === 0) return 0;
  const workItems = items.filter((m) => !isDepositMilestone(m));
  if (!workItems.length) return 0;
  const sum = workItems.reduce((acc, m) => {
    const pct = Math.min(100, Math.max(0, m.progressPct || (m.status === 'completed' ? 100 : m.status === 'in_progress' ? 50 : 0)));
    return acc + pct;
  }, 0);
  return Math.round(sum / workItems.length);
};

const progressFromItems = (items: any[]): number => {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const workItems = items.filter((m) => !isDepositMilestone(m));
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

const getProjectRevenue = (project: any): number => {
  if (!project) return 0;

  // CRITICAL: Original budget MUST come from estimate/contract fields ONLY
  // NEVER use projectData.budgeted or project.budgeted - these may already include change orders!
  // Priority order matches BudgetTab and OverviewScreen to ensure consistency across all pages
  const originalBudgetCandidates: any[] = [
    project?.estimateData?.grandTotal,      // PRIMARY: estimate's grandTotal (what user sees in estimate, e.g. $7,200)
    project?.estimateData?.bidPrice,        // Secondary: estimate's bidPrice
    project?.estimateData?.total,           // Tertiary: estimate's total
    project?.bidPrice,                      // Fallback: project's bidPrice (should match estimate)
    project?.projectData?.bidPrice,         // Fallback: projectData bidPrice
    project?.projectData?.totalBidPrice,    // Fallback: projectData totalBidPrice
    project?.estimatedCost,                 // Fallback: estimatedCost
    project?.projectData?.estimatedCost,    // Fallback: projectData estimatedCost
    project?.total,                         // Fallback: project total
    project?.totalRevenue,                  // Fallback: totalRevenue
    project?.contractValue,                 // Fallback: contractValue
  ];

  let originalBudget = 0;
  for (const candidate of originalBudgetCandidates) {
    const sanitized = sanitizePositiveNumber(candidate);
    if (sanitized > 0) {
      originalBudget = sanitized;
      break;
    }
  }

  // CRITICAL: Do NOT use projectData.budgeted or project.budgeted as fallback
  // These fields may already include approved change orders, which would cause double-counting
  // If no original estimate value exists, return 0 (better to show 0 than wrong value)
  if (originalBudget <= 0) {
    if (__DEV__) {
      const projectName = project?.title || project?.name || 'Unknown';
      console.warn(`⚠️ No original budget found for ${projectName}. Estimate fields missing.`);
    }
    return 0;
  }

  // Collect change orders from all possible locations and compute approved total.
  const changeOrderSources: any[] = [
    project?.projectData?.changeOrders,
    project?.changeOrders,
    (project as any)?.rawProject?.projectData?.changeOrders,
    (project as any)?.rawProject?.changeOrders,
  ];

  const collected: any[] = [];
  for (const source of changeOrderSources) {
    if (Array.isArray(source) && source.length > 0) {
      collected.push(...source);
    }
  }

  // Deduplicate by id when available, otherwise by title+amount signature.
  const seen = new Set<string>();
  const uniqueChangeOrders = collected.filter((co: any) => {
    const key = co?.id != null
      ? `id:${String(co.id)}`
      : `sig:${String(co?.title || '')}:${String(co?.amount ?? co?.clientPrice ?? co?.cost ?? 0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let approvedChangeOrdersTotal = uniqueChangeOrders.reduce(
    (sum, co) => {
      const amount = Number(co.amount ?? co.clientPrice ?? co.cost ?? 0);
      const isApproved =
        (typeof co.approved === 'boolean' && co.approved) ||
        (typeof co.status === 'string' && co.status.toLowerCase() === 'approved');
      return isApproved ? sum + amount : sum;
    },
    0
  );

  // Legacy fallback: some records persist only aggregate CO total.
  if (approvedChangeOrdersTotal <= 0) {
    approvedChangeOrdersTotal = sanitizePositiveNumber(
      project?.projectData?.changeOrderTotal ??
      (project as any)?.changeOrderTotal ??
      (project as any)?.rawProject?.projectData?.changeOrderTotal
    );
  }

  // Core rule: adjusted budget = original budget + approved COs.
  return originalBudget + approvedChangeOrdersTotal;
};

// Palette aligned with key metric cards
const projectCardGradient = ['#070f1e', '#0b1f31', '#0c2f35', '#0fb493'];
const progressGradient = ['#22c55e', '#14b8a6', '#0ea5e9'];
const getStatusTheme = (darkMode: boolean) => ({
  Active: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Completed: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Submitted: { 
    bg: darkMode ? 'rgba(148, 163, 184, 0.24)' : 'rgba(148, 163, 184, 0.15)', 
    border: darkMode ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.25)', 
    color: darkMode ? '#e2e8f0' : '#475569' 
  },
  Won: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Draft: { 
    bg: darkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.15)', 
    border: darkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.25)', 
    color: darkMode ? '#cbd5e1' : '#64748b' 
  },
});

export default function ProjectsScreen() {
  const router = useRouter();
  useRequireAuth();
  const { t } = useTranslation();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors, darkMode), [Colors, darkMode]);
  const { activeProjects, estimates, deleteProject, convertBidToProject, updateProject, refreshProjects } = useProjectList();
  const { enabled: aiPmMode } = useAIManagerMode();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<'active' | 'submitted' | 'completed'>(
    params.tab === 'submitted' ? 'submitted' : params.tab === 'completed' ? 'completed' : 'active'
  );
  const [showSubmitBanner, setShowSubmitBanner] = useState(false);
  const [projectDataOverrides, setProjectDataOverrides] = useState<Record<string, any>>({});
  const [timelineProgress, setTimelineProgress] = useState<Record<string, number>>({});
  const skipNextRefreshRef = React.useRef(false);

  const loadProjectDataOverrides = React.useCallback(async () => {
    if (skipNextRefreshRef.current) return;
    const all = [...activeProjects, ...estimates];
    const next: Record<string, any> = {};
    const progressMap: Record<string, number> = {};

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
              suffixToProgress[suffix] = pct;
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
            setShowSubmitBanner(fromSubmit === 'true');
            if (fromSubmit === 'true') setTimeout(() => setShowSubmitBanner(false), 3000);
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

  // Update tab if route param changes
  useEffect(() => {
    if (params.tab === 'submitted') {
      setActiveTab('submitted');
      // Show confirmation banner when arriving from submit bid
      if (params.fromSubmit === 'true') {
        setShowSubmitBanner(true);
        setTimeout(() => {
          setShowSubmitBanner(false);
        }, 3000);
      }
    } else if (params.tab === 'completed') {
      setActiveTab('completed');
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

        const status = p.status || 'draft';
        let displayStatus = 'Draft';
        if (status === 'estimate') displayStatus = 'Draft';
        else if (status === 'bid_submitted') displayStatus = 'Submitted';
        else if (status === 'won') displayStatus = 'Active';
        else if (status === 'in_progress') displayStatus = 'Active';
        else if (status === 'completed') displayStatus = 'Completed';
        else displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

      const revenue = getProjectRevenue(mergedProject);
      const progressPct = deriveUnifiedProgressPct(mergedProject, pid, timelineProgress);
      const rawProgress = progressPct / 100; // Convert to 0-1
      const finalProgress = status === 'completed' ? 1.0 : rawProgress;

      // Compute actual cost same as Budget tab: expenses + received POs (not stale list fields)
      const pd = mergedProject?.projectData ?? mergedProject;
      const expensesTotal = toFiniteNumber(pd?.spent) || (Array.isArray(pd?.expenses) && pd.expenses.length > 0
        ? pd.expenses.reduce((s: number, e: any) => s + toFiniteNumber(e?.amount ?? 0), 0)
        : Array.isArray(pd?.buckets)
          ? pd.buckets.reduce((s: number, b: any) => s + toFiniteNumber(b?.spent ?? 0), 0)
          : 0);
      const rawPOs = pd?.purchaseOrders ?? mergedProject?.purchaseOrders ?? [];
      const receivedPOsTotal = Array.isArray(rawPOs)
        ? rawPOs
            .filter((po: any) => String(po?.status || '').toLowerCase() === 'received')
            .reduce((s: number, po: any) => s + toFiniteNumber(po?.amount ?? 0), 0)
        : 0;
      const actualCost = expensesTotal + receivedPOsTotal || toFiniteNumber(
        mergedProject?.actualCost ?? mergedProject?.totalSpent ?? pd?.actualCost ?? 0
      );
      // Cost baseline: prefer line items + buckets (matches Overview/BudgetTab) so margin matches estimate
      const ed = mergedProject?.estimateData;
      const costFromLineItems = (() => {
        const bid = ed ?? mergedProject;
        const materials = (bid?.materialLineItems || []).reduce((s: number, i: any) => s + Number(i?.total || 0), 0);
        const labor = (bid?.laborLineItems || []).reduce((s: number, i: any) => s + Number(i?.total || 0), 0);
        const permitCosts =
          Number(bid?.planCost || 0) +
          Number(bid?.permitCost || 0);
        const equipmentRental = Number(bid?.equipment || 0);
        const otherDirectCost = Number(bid?.otherDirectCost || 0);
        // Direct job cost (markup base) — matches estimate subtotal; business overhead is subtracted separately below
        const directSubtotal = materials + labor + permitCosts + equipmentRental + otherDirectCost;
        if (directSubtotal > 0) return directSubtotal;
        const buckets = mergedProject?.buckets ?? pd?.buckets ?? [];
        const costBuckets = buckets.filter((b: any) =>
          (b?.name || '').toLowerCase().includes('labor') ||
          (b?.name || '').toLowerCase().includes('material') ||
          (b?.name || '').toLowerCase().includes('overhead')
        );
        const fromBuckets = costBuckets.reduce((s: number, b: any) => s + Number(b?.budget || 0), 0);
        if (fromBuckets > 0) return fromBuckets;
        const markupBucket = buckets.find((b: any) => (b?.name || '').toLowerCase().includes('markup'));
        const markupAmt = Number(markupBucket?.budget || 0);
        if (revenue > 0 && markupAmt > 0 && markupAmt < revenue) return revenue - markupAmt;
        return 0;
      })();
      const committedPOs = Array.isArray(rawPOs)
        ? rawPOs
            .filter((po: any) => String(po?.status || '').toLowerCase() !== 'received')
            .reduce((sum: number, po: any) => sum + toFiniteNumber(po?.amount ?? 0), 0)
        : 0;
      // Prefer estimate-stored margin first so cards stay anchored to original bid settings.
      const rawMargin = mergedProject?.estimateData?.marginPercent ?? mergedProject?.estimateData?.margin ?? p.margin;
      const estimateMarginNum = typeof rawMargin === 'number' && Number.isFinite(rawMargin)
        ? (Math.abs(rawMargin) > 1 ? rawMargin : rawMargin * 100)
        : null;
      // Only use p.margin for cost when it came from estimateData — p.margin can be stale (e.g. 10% from wrong cost).
      const hasStoredEstimateMargin = (mergedProject?.estimateData?.marginPercent != null || mergedProject?.estimateData?.margin != null);
      // Prefer estimate-stored net profit first (source of truth from estimate submission payload).
      const estimateProfit = toFiniteNumber(mergedProject?.estimateData?.profit ?? p.profit);
      const overheadFromEstimate =
        toFiniteNumber(ed?.equipmentMaintenance) + toFiniteNumber(ed?.facilities) +
        toFiniteNumber(ed?.insuranceOverhead) + toFiniteNumber(ed?.otherOverhead);
      const derivedNetProfit =
        costFromLineItems > 0 && revenue > costFromLineItems
          ? Math.max(0, (revenue - costFromLineItems) - overheadFromEstimate)
          : 0;
      const effectiveEstimateProfit = estimateProfit > 0 ? estimateProfit : (derivedNetProfit > 0 && derivedNetProfit < revenue ? derivedNetProfit : 0);
      // Use estimate's net-profit cost whenever we have it so card margin stays at estimate (e.g. 15%) after adding expenses (matches Overview/Budget).
      const costFromEstimateProfit =
        revenue > 0 && effectiveEstimateProfit > 0 && effectiveEstimateProfit < revenue
          ? revenue - effectiveEstimateProfit
          : 0;
      // Only use stored margin % when it came from estimateData — p.margin can be stale and would reinforce wrong %.
      const costFromStoredMargin =
        hasStoredEstimateMargin && revenue > 0 && estimateMarginNum != null && estimateMarginNum > 0 && estimateMarginNum < 100
          ? revenue * (1 - estimateMarginNum / 100)
          : 0;
      // Estimate's cost fields (from bid calc) — use before costFromLineItems; subtotal = materials+labor+overhead.
      const costFromEstimateData = toFiniteNumber(ed?.estimatedCost ?? ed?.totalCost ?? ed?.subtotal ?? ed?.baseCost);
      const estimateCostFromParts =
        toFiniteNumber(ed?.materials ?? (mergedProject as any)?.materials) +
        toFiniteNumber(ed?.labor ?? (mergedProject as any)?.labor) +
        toFiniteNumber(ed?.equipment ?? (mergedProject as any)?.equipment) +
        toFiniteNumber(ed?.equipmentMaintenance ?? (mergedProject as any)?.equipmentMaintenance) +
        toFiniteNumber(ed?.facilities ?? (mergedProject as any)?.facilities) +
        toFiniteNumber(ed?.insuranceOverhead ?? (mergedProject as any)?.insuranceOverhead) +
        toFiniteNumber(ed?.otherOverhead ?? (mergedProject as any)?.otherOverhead) +
        toFiniteNumber(ed?.planCost ?? (mergedProject as any)?.planCost) +
        toFiniteNumber(ed?.permitCost ?? (mergedProject as any)?.permitCost) +
        toFiniteNumber(ed?.otherDirectCost ?? (mergedProject as any)?.otherDirectCost);
      const estimatedCost = costFromEstimateProfit > 0
        ? costFromEstimateProfit
        : costFromStoredMargin > 0
        ? costFromStoredMargin
        : costFromEstimateData > 0 && costFromEstimateData < revenue
        ? costFromEstimateData
        : estimateCostFromParts > 0 && estimateCostFromParts < revenue
        ? estimateCostFromParts
        : costFromLineItems > 0
        ? costFromLineItems
        : toFiniteNumber(
            mergedProject?.estimatedCost ?? mergedProject?.projectData?.estimatedCost ??
            mergedProject?.estimateData?.totalCost ?? mergedProject?.estimateData?.estimatedCost ??
            mergedProject?.estimateData?.subtotal ?? 0
          );

      const profitForecast = revenue > 0
        ? computeProfitForecast({
            contractValue: revenue,
            adjustedBudget: estimatedCost > 0 ? estimatedCost : revenue,
            estimatedCostBaseline: estimatedCost > 0 ? estimatedCost : undefined,
            actualExpenses: actualCost,
            committedPOs,
            progressPct: finalProgress * 100,
            isCompleted: status === 'completed',
          })
        : null;

      // Prefer estimate's profit & margin only when project has no real spending AND no meaningful progress.
      const hasNoRealSpend = actualCost === 0 || (revenue > 0 && actualCost < 0.01 * revenue);
      const useEstimateValues = hasNoRealSpend && finalProgress < 0.05 && (effectiveEstimateProfit > 0 || estimateMarginNum != null);

      const derivedMarginFromProfit = revenue > 0 && effectiveEstimateProfit > 0 ? (effectiveEstimateProfit / revenue) * 100 : null;
      const derivedProfitFromMargin = revenue > 0 && estimateMarginNum != null ? revenue * (estimateMarginNum / 100) : null;
      // Card shows CURRENT margin (spend-to-date) and current profit — not projected. Current = (contract − spent) / contract.
      const spendToDateMargin = revenue > 0 && actualCost >= 0 ? ((revenue - actualCost) / revenue) * 100 : null;
      const currentProfit = revenue > 0 && actualCost >= 0 ? Math.round(revenue - actualCost) : null;
      const displayProfit = useEstimateValues && (effectiveEstimateProfit > 0 || derivedProfitFromMargin != null)
        ? (effectiveEstimateProfit > 0 ? effectiveEstimateProfit : derivedProfitFromMargin!)
        : (spendToDateMargin != null ? currentProfit : profitForecast?.projectedProfit);
      const displayMargin = useEstimateValues && (derivedMarginFromProfit != null || estimateMarginNum != null)
        ? (derivedMarginFromProfit ?? estimateMarginNum!)
        : (spendToDateMargin ?? profitForecast?.projectedMarginPct ?? (p.margin != null ? (Math.abs(p.margin) > 1 ? p.margin : p.margin * 100) : 0));

      // Only show revenue for submitted/active/completed projects, show $0 for drafts
      const displayAmount = (displayStatus === 'Draft' || status === 'estimate') ? 0 : revenue;

      return {
        id: p.id,
        name: p.title || 'Untitled Project',
        status: displayStatus,
        location: p.location || 'Unknown, Unknown',
        progress: finalProgress,
        amount: displayAmount,
        margin: displayMargin,
        marginDisplay:
          displayProfit != null && Number.isFinite(displayProfit)
            ? `${displayMargin.toFixed(1)}% margin · $${Math.round(displayProfit).toLocaleString()} profit`
            : `${displayMargin.toFixed(1)}% margin`,
        projectedProfit: displayProfit,
        dateLabel: p.endDate
          ? status === 'completed'
            ? `Completed ${new Date(p.endDate).toISOString().split('T')[0]}`
            : `Due ${new Date(p.endDate).toISOString().split('T')[0]}`
          : 'No due date',
        rawProject: mergedProject,
        rawStatus: status,
      };
    });
  }, [activeProjects, estimates, projectDataOverrides, timelineProgress]);

  // Filter projects by active tab
  const projects = useMemo(() => {
    if (activeTab === 'submitted') {
      return allProjects.filter(p => p.status === 'Submitted' || p.rawStatus === 'bid_submitted' || p.rawStatus === 'submitted');
    } else if (activeTab === 'completed') {
      return allProjects.filter(p => p.status === 'Completed' || p.rawStatus === 'completed');
    } else {
      return allProjects.filter(p => p.status === 'Active' || p.rawStatus === 'won' || p.rawStatus === 'in_progress' || p.rawStatus === 'active');
    }
  }, [allProjects, activeTab]);

  const handleProjectPress = (project: any) => {
    router.push(`/project-detail/${project.id}`);
  };

  const [markAsWonModalVisible, setMarkAsWonModalVisible] = useState(false);
  const [selectedProjectForWon, setSelectedProjectForWon] = useState<any>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successProjectName, setSuccessProjectName] = useState('');
  const successBannerOpacity = useRef(new Animated.Value(0)).current;

  const handleDeleteProject = async (project: any, e: any) => {
    // Stop event propagation so it doesn't trigger the card press
    e?.stopPropagation();

    // Set immediately when entering delete flow so any focus event from Alert show/dismiss
    // skips refreshProjects (which would load stale AsyncStorage and bring the project back)
    skipNextRefreshRef.current = true;
    const cancelTimeout = setTimeout(() => {
      skipNextRefreshRef.current = false;
    }, 3000);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      t('projects.deleteProject'),
      t('projects.deleteConfirm', { name: project.name }),
      [
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
          onPress: async () => {
            clearTimeout(cancelTimeout);
            try {
              await deleteProject(project.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error deleting project:', error);
              Alert.alert(t('common.error'), t('projects.deleteError'));
              skipNextRefreshRef.current = false;
            } finally {
              setTimeout(() => { skipNextRefreshRef.current = false; }, 800);
            }
          },
        },
      ]
    );
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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveTab('active');
      convertBidToProject(projectId);

      setSuccessProjectName(projectName);
      setShowSuccessBanner(true);
      successBannerOpacity.setValue(0);
      Animated.timing(successBannerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const dismissAfter = 3000;
      setTimeout(() => {
        Animated.timing(successBannerOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setShowSuccessBanner(false);
        });
      }, dismissAfter);
    } catch (error) {
      console.error('Error marking project as won:', error);
      Alert.alert('Error', 'Failed to mark project as won');
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={[styles.headerRow, styles.wideContainer]}>
          <View>
            <Text style={styles.screenTitle}>{t('projects.allProjects')}</Text>
            <Text style={styles.screenSubtitle}>
              {projects.length} {activeTab === 'submitted' ? 'submitted' : activeTab === 'completed' ? 'completed' : 'active'} {projects.length === 1 ? 'project' : 'projects'}
            </Text>
          </View>

          {/* Profile with glow */}
          <LinearGradient
            colors={progressGradient}
            style={styles.profileOuter}
          >
            <Pressable
              style={styles.profileInner}
              onPress={() => router.push('/profile')}
            >
              <Text style={styles.profileInitials}>{user.initials}</Text>
            </Pressable>
          </LinearGradient>
        </View>

        {/* TABS */}
        <View style={[styles.tabsContainer, styles.wideContainer]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('active');
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
            }}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        {/* ALL PROJECTS CARD */}
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
              backgroundColor: darkMode ? Colors.card : Colors.cardDark,
              borderRadius: 18,
              padding: 12,
            }}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>{t('projects.allProjects')}</Text>
                  <Text style={styles.cardSubtitle}>
                    {projects.length} {t('dashboard.total')} · {t('projects.latestActivity')}
                  </Text>
                </View>
              </View>
              
              {projects.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="folder-outline" size={48} color={darkMode ? "#FFFFFF" : "#475569"} />
                  <Text style={styles.emptyStateText}>{t('dashboard.noProjects')}</Text>
                  <Text style={styles.emptyStateSubtext}>
                    {t('dashboard.createFirstProject')}
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 12 }}>
                  {projects.map((project) => {
                    const statusThemeMap = getStatusTheme(darkMode);
                    const pill = statusThemeMap[project.status] ?? statusThemeMap.Draft;
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
                          !darkMode && { borderColor: Colors.line },
                        ]}
                      >
                        <View style={[styles.projectCardInner, !darkMode && { borderWidth: 1, borderColor: Colors.line }]}>
                  <View style={styles.projectTopRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text 
                        style={styles.projectName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {project.name}
                      </Text>
                      <View style={styles.projectLocationRow}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color={darkMode ? "#FFFFFF" : "#475569"}
                        />
                        <Text style={styles.projectLocationText}>
                          {project.location}
                        </Text>
                      </View>
                      {/* Customer Information */}
                      {(project.rawProject?.client || project.rawProject?.estimateData?.customerName || project.rawProject?.clientEmail || project.rawProject?.estimateData?.customerEmail) && (
                        <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {(project.rawProject?.client || project.rawProject?.estimateData?.customerName) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="person-outline" size={12} color={darkMode ? "#FFFFFF" : "#475569"} />
                              <Text style={{ color: darkMode ? Colors.sub : "#475569", fontSize: 11 }}>
                                {project.rawProject?.client || project.rawProject?.estimateData?.customerName}
                              </Text>
                            </View>
                          )}
                          {(project.rawProject?.clientEmail || project.rawProject?.estimateData?.customerEmail) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="mail-outline" size={12} color={darkMode ? "#FFFFFF" : "#475569"} />
                              <Text style={{ color: darkMode ? Colors.sub : "#475569", fontSize: 11 }}>
                                {project.rawProject?.clientEmail || project.rawProject?.estimateData?.customerEmail}
                              </Text>
                            </View>
                          )}
                          {(project.rawProject?.clientPhone || project.rawProject?.estimateData?.customerPhone) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="call-outline" size={12} color={darkMode ? "#FFFFFF" : "#475569"} />
                              <Text style={{ color: darkMode ? Colors.sub : "#475569", fontSize: 11 }}>
                                {project.rawProject?.clientPhone || project.rawProject?.estimateData?.customerPhone}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                      {/* Waiting for client decision - only for submitted projects */}
                      {project.status === 'Submitted' && (
                        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="time-outline" size={12} color={darkMode ? "#FFFFFF" : "#64748b"} />
                          <Text style={{ color: darkMode ? "#FFFFFF" : "#64748b", fontSize: 12, fontStyle: 'italic' }}>
                            Waiting for client decision
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                      <View
                        onStartShouldSetResponder={() => true}
                        onTouchEnd={(e) => e.stopPropagation()}
                        style={{ marginLeft: 4 }}
                      >
                        <TouchableOpacity
                          onPress={(e) => handleDeleteProject(project, e)}
                          style={styles.deleteButton}
                          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="delete-outline" size={18} color={darkMode ? "#7C8BA0" : "#475569"} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.projectMiddleRow}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.projectAmount}>
                          {formatCurrencyFull(project.amount)}
                        </Text>
                      {aiPmMode && (
                        <View style={styles.aiTagChip}>
                          <Ionicons
                            name="sparkles-outline"
                            size={10}
                            color="#22C55E"
                          />
                          <Text
                            style={[
                              styles.aiTagText,
                              { color: "#22C55E" },
                            ]}
                          >
                            AI
                          </Text>
                        </View>
                      )}
                      </View>
                      <Text style={styles.projectMarginProfitText}>
                        {project.marginDisplay}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.projectMetaLabel}>
                        {project.dateLabel.includes('Due') ? 'Due' : 'Completed'}
                </Text>
                      <Text style={styles.projectMetaText}>
                        {project.dateLabel.replace(/^(Due |Completed )/, '')}
                </Text>
              </View>
            </View>

                  <View style={styles.progressRow}>
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
                            opacity: darkMode ? 1 : 0.9, // Slightly reduced opacity in light mode
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressPercent}>
                      {Math.round(project.progress * 100)}%
                    </Text>
                  </View>

                  <Text style={styles.progressLabel}>Progress</Text>
                  
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

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Submit Bid Confirmation Banner */}
      {showSubmitBanner && (
        <View style={styles.submitBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          <Text style={styles.submitBannerText}>
            ✅ Bid submitted{'\n'}
            We'll keep this estimate ready to turn into a project.
          </Text>
        </View>
      )}

      {/* Success Banner - smooth fade in/out, auto-dismiss after 3 sec */}
      {showSuccessBanner && (
        <Animated.View style={[styles.successBanner, { opacity: successBannerOpacity }]}>
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          <Text style={styles.successBannerText}>
            🏁 Project activated{'\n'}
            {successProjectName} is now a live project.
          </Text>
        </Animated.View>
      )}

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
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, darkMode: boolean) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 18,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
  },
  screenSubtitle: {
    fontSize: 14,
    color: darkMode ? Colors.sub : "#475569",
    marginTop: 4,
  },
  card: {
    padding: 18,
    backgroundColor: Colors.card,
    marginBottom: 16,
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
  cardTitle: {
    fontSize: 22, // Match dashboard size
    fontWeight: darkMode ? '700' : '800', // Heavier in light mode
    color: darkMode ? Colors.text : Colors.text,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: darkMode ? Colors.sub : "#475569", // slate-600 for better contrast
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
    borderRadius: 14,
    padding: 12,
    borderWidth: darkMode ? 1 : 0,
    borderColor: Colors.line,
  },
  projectCardGradient: {
    width: '100%',
    borderRadius: 24,
    padding: 16,
  },
  projectTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '700',
    color: darkMode ? Colors.text : Colors.text,
    flexShrink: 1,
  },
  projectLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  projectLocationText: {
    fontSize: 13,
    color: darkMode ? Colors.sub : "#475569",
  },
  statusPillBase: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillTextBase: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0', // Will be overridden inline for light mode
  },
  projectMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  projectAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: darkMode ? Colors.text : Colors.text,
  },
  projectMarginProfitText: {
    marginTop: 2,
    fontSize: 13,
    color: darkMode ? '#FFFFFF' : '#475569',
  },
  projectMetaText: {
    marginTop: 2,
    fontSize: 13,
    color: darkMode ? "#FFFFFF" : "#475569",
  },
  projectMetaLabel: {
    fontSize: 12,
    color: darkMode ? "#FFFFFF" : "#475569",
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: darkMode ? "#1B2938" : "#CBD5E1", // Darker track in light mode
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 999,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: darkMode ? '#E5F7FF' : Colors.text,
  },
  progressLabel: {
    marginTop: 4,
    fontSize: 13,
    color: darkMode ? Colors.sub : "#475569",
  },
  aiTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(187,247,208,0.3)',
  },
  aiTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: darkMode ? '#BBF7D0' : '#166534',
    letterSpacing: 0.3,
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
    color: darkMode ? "#FFFFFF" : "#475569",
    marginTop: 4,
    textAlign: 'center',
  },
  deleteButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: darkMode ? Colors.surface2 : "#FFFFFF",
    borderWidth: 1,
    borderColor: darkMode ? Colors.line : "#E2E8F0",
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
    backgroundColor: Colors.card,
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
    backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.cardDark,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.3)' : Colors.line,
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
    color: darkMode ? Colors.sub : '#334155',
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
  submitBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  submitBannerText: {
    flex: 1,
    color: darkMode ? Colors.text : Colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  successBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  successBannerText: {
    flex: 1,
    color: darkMode ? Colors.text : Colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: darkMode ? Colors.card : Colors.cardDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '50%',
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
