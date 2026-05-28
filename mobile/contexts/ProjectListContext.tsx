import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiService } from '../services/api';
import {
  UNIFIED_PROJECTS_STORAGE_KEY,
  ACTIVE_PROJECT_USER_ID_KEY,
  getUnifiedProjectsStorageKey,
  getWorkspaceProjectsStorageKey,
  getActiveProjectUserId,
  setActiveProjectUserId,
} from '../lib/projectListCache';
import businessWorkspaceService, {
  type BusinessWorkspaceAccess,
} from '../services/businessWorkspaceService';
import {
  fetchWorkspaceBootstrap,
  invalidateWorkspaceBootstrapCache,
} from '../utils/workspaceBootstrapCache';
import { resolveWorkspaceAccessAfterAuth } from '../lib/workspaceMemberOnboarding';
import {
  persistWorkspaceAccessSnapshot,
  readWorkspaceAccessSnapshot,
} from '../utils/workspaceAccessCache';
import { useClerkUiEnabled } from './ClerkUiContext';
import {
  useClerkAccountUserId,
  useLegacyAccountUserId,
} from '../hooks/useAccountUserId';
import { useAuth, useUser } from '@clerk/clerk-react';
import { syncClerkTokenToAsyncStorage } from '../utils/authTokenHelper';
import { setBusinessEntitlementSnapshot } from '../utils/businessEntitlementCache';
import { setWorkspaceClerkTokenGetter } from '../utils/workspaceAuthBridge';
import { recordDeletedProject } from '../utils/aiDashboardPortfolioFilter';
import { isWorkspaceRestrictedFinancialsProject } from '../utils/workspacePermissions';

// Unified Project interface that combines Estimates, Projects, and Dashboard data
export interface UnifiedProject {
  id: string;
  title: string;
  name?: string;
  
  // Status lifecycle
  status: 'estimate' | 'bid_submitted' | 'won' | 'in_progress' | 'completed' | 'lost';
  
  // Financial data
  estimatedCost: number;
  bidPrice: number;
  actualCost?: number;
  totalSpent?: number;
  margin: number;
  markup: number;
  budgeted?: number;
  /** Net profit from estimate (gross profit − overhead); used so Projects page can show estimate margin */
  profit?: number;
  
  // Location
  location: string;
  city?: string;
  state?: string;
  zip?: string;
  
  // Timeline
  startDate: string;
  endDate: string;
  progress: number; // 0-100
  overallProgressPct?: number; // Timeline-based progress
  milestones?: any[];
  weeklyPayments?: any[];
  paymentMilestones?: any[];
  paymentSchedule?: string;
  buckets?: any[];
  
  // Client
  client: string;
  clientEmail?: string;
  clientPhone?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  /** Set when the job first enters `completed` — used with schedule end for list dates. */
  completedAt?: string;
  
  // Estimate data (if from estimates page)
  estimateData?: any;
  
  // Project data (if converted to project)
  projectData?: any;
  projectType?: string;
  expenses?: any[];
  changeOrders?: any[];
  purchaseOrders?: any[];
  squareFootage?: number;

  /** Set by backend for workspace members — blocks local financial hydration. */
  workspacePrivacy?: {
    role?: string;
    restrictedFinancials?: boolean;
    message?: string;
  };

  /** Cost-side budget only — shared with workspace managers (no contract/revenue). */
  approvedCostBudget?: number;
  /** Materials / labor / direct-cost buckets — managers only (no markup). */
  approvedCostBuckets?: Array<{
    id: string;
    name: string;
    budget: number;
    spent?: number;
  }>;
}

interface ProjectListContextType {
  projects: UnifiedProject[];

  // Estimates
  estimates: UnifiedProject[];
  addEstimate: (estimate: UnifiedProject) => Promise<void>;

  // Active Projects
  activeProjects: UnifiedProject[];
  convertBidToProject: (bidId: string) => void;
  updateProjectProgress: (projectId: string, progress: number, actualCost?: number) => void;

  // Dashboard metrics
  dashboardMetrics: {
    totalRevenue: number;
    totalExpenses: number;
    totalProfit: number;
    activeProjectsCount: number;
    wonBidsCount: number;
    pendingBidsCount: number;
  };

  // Generic operations
  getProjectById: (id: string) => UnifiedProject | undefined;
  updateProject: (id: string, updates: Partial<UnifiedProject>) => void;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  /** Re-merge timeline, projectData, and progress from AsyncStorage without a backend round-trip. */
  rehydrateProjectsFromStorage: () => Promise<void>;
  clearProjectsLocal: () => Promise<void>;
}

const ProjectListContext = createContext<ProjectListContextType | undefined>(
  undefined
);

const sanitizePositiveNumber = (value: any): number | null => {
  if (value == null) return null;
  const num =
    typeof value === 'string'
      ? Number(value.replace(/[$,\s]/g, ''))
      : Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return num;
};

const collectPositiveNumbers = (...values: any[]): number[] => {
  const results: number[] = [];
  values.forEach((value) => {
    const num = sanitizePositiveNumber(value);
    if (num !== null) {
      results.push(num);
    }
  });
  return results;
};

const firstPositiveNumber = (...values: any[]): number => {
  const nums = collectPositiveNumbers(...values);
  return nums.length > 0 ? nums[0] : 0;
};

const maxPositiveNumber = (...values: any[]): number => {
  const nums = collectPositiveNumbers(...values);
  return nums.length > 0 ? Math.max(...nums) : 0;
};

type RevenueBreakdown = {
  value: number;
  source: string;
};

const getRevenueCandidates = (project: any): RevenueBreakdown[] => {
  if (!project) return [];
  const orderedCandidates: { value: any; source: string }[] = [
    { value: project.bidPrice, source: 'project.bidPrice' },
    { value: project.projectData?.bidPrice, source: 'project.projectData.bidPrice' },
    { value: project.estimateData?.bidPrice, source: 'project.estimateData.bidPrice' },
    { value: project.estimateData?.grandTotal, source: 'project.estimateData.grandTotal' },
    { value: project.estimateData?.total, source: 'project.estimateData.total' },
    { value: project.estimateData?.previousTotal, source: 'project.estimateData.previousTotal' },
    { value: project.estimateData?.calculatedTotal, source: 'project.estimateData.calculatedTotal' },
    { value: project.total, source: 'project.total' },
    { value: project.totalRevenue, source: 'project.totalRevenue' },
    { value: project.totalContract, source: 'project.totalContract' },
    { value: project.contractValue, source: 'project.contractValue' },
    { value: project.contractAmount, source: 'project.contractAmount' },
    { value: project.totalBidPrice, source: 'project.totalBidPrice' },
    { value: project.projectData?.totalBidPrice, source: 'project.projectData.totalBidPrice' },
    { value: project.projectData?.contractValue, source: 'project.projectData.contractValue' },
    { value: project.estimateData?.contractValue, source: 'project.estimateData.contractValue' },
    { value: project.estimateData?.totalContract, source: 'project.estimateData.totalContract' },
    { value: project.summary?.totalRevenue, source: 'project.summary.totalRevenue' },
    { value: project.summary?.grandTotal, source: 'project.summary.grandTotal' },
    { value: project.financials?.totalRevenue, source: 'project.financials.totalRevenue' },
  ];

  const breakdown: RevenueBreakdown[] = [];
  orderedCandidates.forEach(({ value, source }) => {
    const sanitized = sanitizePositiveNumber(value);
    if (sanitized !== null) {
      breakdown.push({ value: sanitized, source });
    }
  });

  return breakdown;
};

const resolveProjectRevenueDetail = (project: any) => {
  const breakdown = getRevenueCandidates(project);
  const top = breakdown[0];
  return {
    value: top?.value ?? 0,
    source: top?.source ?? 'unknown',
    breakdown,
  };
};

const resolveProjectRevenue = (project: any): number => {
  return resolveProjectRevenueDetail(project).value;
};

const sanitizeNonNegative = (value: any): number | null => {
  if (value == null) return null;
  const num =
    typeof value === 'string'
      ? Number(value.replace(/[$,\s]/g, ''))
      : Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return num;
};

const resolveActualCost = (project: any, override?: any): number => {
  const orderedCandidates: any[] = [
    override,
    project?.projectData?.spent,
    project?.projectData?.expensesTotal,
    project?.actualCost,
    project?.projectData?.budget?.spent,
    project?.estimateData?.actualCost,
    project?.actuals?.totalCost,
    project?.estimatedCost,
    project?.estimateData?.estimatedCost,
    project?.estimateData?.totalEstimatedCost,
  ];

  for (const candidate of orderedCandidates) {
    const sanitized = sanitizeNonNegative(candidate);
    if (sanitized !== null) {
      return sanitized;
    }
  }

  return 0;
};

const resolveProjectCost = (project: any, revenue: number): number => {
  let cost = resolveActualCost(project);

  if (!Number.isFinite(cost) || cost < 0) {
    const marginRaw =
      project?.margin ??
      project?.estimateData?.margin ??
      project?.estimateData?.marginPercent;

    if (typeof marginRaw === 'number' && Number.isFinite(marginRaw)) {
      const marginRatio = marginRaw > 1 ? marginRaw / 100 : marginRaw;
      if (marginRatio >= 0 && marginRatio < 1 && revenue > 0) {
        cost = revenue - revenue * marginRatio;
      }
    }
  }

  if (!cost || !Number.isFinite(cost)) {
    cost = revenue;
  }

  return cost;
};

const normalizeStatus = (status?: string | null) =>
  (status ?? '')
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .trim();

const normalizeBackendStatus = (status?: string | null): UnifiedProject['status'] => {
  const normalized = normalizeStatus(status);
  if (normalized === 'planning' || normalized === 'draft' || normalized === 'estimate') {
    return 'estimate';
  }
  if (normalized === 'not-started' || normalized === 'not_started') {
    return 'estimate';
  }
  if (normalized === 'submitted' || normalized === 'bid_submitted') {
    return 'bid_submitted';
  }
  if (
    normalized === 'won' ||
    normalized === 'active' ||
    normalized === 'in_progress' ||
    normalized === 'in-progress' ||
    normalized === 'on-hold' ||
    normalized === 'on_hold'
  ) {
    return 'in_progress';
  }
  if (
    normalized === 'completed' ||
    normalized === 'complete' ||
    normalized === 'done' ||
    normalized === 'closed' ||
    normalized === 'finished'
  ) {
    return 'completed';
  }
  if (normalized === 'lost' || normalized === 'cancelled' || normalized === 'canceled') {
    return 'lost';
  }
  return 'estimate';
};

const toIsoDate = (value: any, fallback: string): string => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const normalizeProjectId = (id: any): string => String(id ?? '');

/** One row per non-empty project id (last wins). Empty ids kept in order — avoids corrupt duplicate ids in AsyncStorage. */
function dedupeProjectsById(list: UnifiedProject[]): UnifiedProject[] {
  const byId = new Map<string, UnifiedProject>();
  const noId: UnifiedProject[] = [];
  for (const p of list) {
    const id = normalizeProjectId(p.id);
    if (!id) {
      noId.push(p);
      continue;
    }
    byId.set(id, p);
  }
  return [...byId.values(), ...noId];
}

async function hydrateProjectDataFromStorageKeys(
  projects: UnifiedProject[]
): Promise<UnifiedProject[]> {
  return Promise.all(
    projects.map(async (project) => {
      if (isWorkspaceRestrictedFinancialsProject(project)) {
        return project;
      }

      const projectId = normalizeProjectId(project.id);
      const nextProjectData: any = { ...(project.projectData || {}) };
      let touched = false;

      try {
        const projectDataKey = `bps.project.${projectId}`;
        const projectDataRaw = await AsyncStorage.getItem(projectDataKey);
        if (projectDataRaw) {
          Object.assign(nextProjectData, JSON.parse(projectDataRaw));
          touched = true;
        }
      } catch (e) {
        if (__DEV__) {
          console.warn(`Failed to load projectData for ${project.id}:`, e);
        }
      }

      /** Timeline tab / AI mark-payment writes here — Tax Center reads merged copy so revenue matches the app. */
      try {
        const timelineRaw = await AsyncStorage.getItem(`bps.timeline.v2.${projectId}`);
        if (timelineRaw) {
          const parsed = JSON.parse(timelineRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            nextProjectData.timelineV2Milestones = parsed;
            touched = true;
          }
        }
      } catch (e) {
        if (__DEV__) {
          console.warn(`Failed to load timeline v2 for ${project.id}:`, e);
        }
      }

      if (!touched) return project;

      return {
        ...project,
        projectData: nextProjectData,
      };
    })
  );
}

async function applyProgressAndDatesFromStorage(
  projects: UnifiedProject[]
): Promise<UnifiedProject[]> {
  const progressPromises = projects.map(async (project) => {
    const projectId = normalizeProjectId(project?.id || `${Date.now()}`);

    let savedProgress: { progress?: number; overallProgressPct?: number } | null = null;
    try {
      const saved = await AsyncStorage.getItem(`bps.project.${projectId}.progress`);
      if (saved) {
        savedProgress = JSON.parse(saved);
      }
    } catch {
      // ignore
    }

    const progressValue =
      savedProgress?.progress ??
      savedProgress?.overallProgressPct ??
      project.overallProgressPct ??
      project.progress ??
      0;
    const statusSlug = normalizeStatus(project.status);
    let nextStatus = project.status;
    // Never let stale local progress downgrade server-side "completed" (TestFlight fresh cache vs Expo).
    if (statusSlug === 'completed') {
      nextStatus = 'completed';
    } else if (progressValue >= 100 && statusSlug !== 'lost') {
      nextStatus = 'completed';
    }
    const projectTypeCandidate =
      project.projectType ||
      project?.estimateData?.projectType ||
      project?.estimateData?.category ||
      project?.projectData?.projectType ||
      project?.projectData?.type ||
      project?.title;

    const mergedProgress =
      savedProgress?.progress ?? project.progress ?? progressValue;
    const mergedOverall =
      savedProgress?.overallProgressPct ?? project.overallProgressPct ?? progressValue;
    const finalProgress =
      normalizeStatus(nextStatus) === 'completed'
        ? Math.max(mergedProgress, 100)
        : mergedProgress;
    const finalOverall =
      normalizeStatus(nextStatus) === 'completed'
        ? Math.max(mergedOverall, 100)
        : mergedOverall;

    let fixedProject: UnifiedProject = {
      ...project,
      id: projectId,
      status: nextStatus,
      progress: finalProgress,
      overallProgressPct: finalOverall,
      projectType: projectTypeCandidate,
    };

    const estimateStart = fixedProject.estimateData?.projectStartDate;
    const estimateEnd =
      fixedProject.estimateData?.projectEndDate || fixedProject.estimateData?.endDate;
    if (estimateStart || estimateEnd) {
      fixedProject = {
        ...fixedProject,
        startDate: estimateStart || fixedProject.startDate,
        endDate: estimateEnd || fixedProject.endDate,
      };
    }

    return fixedProject;
  });
  return Promise.all(progressPromises);
}

const mapBackendProjectToUnified = (project: any): UnifiedProject => {
  const nowIso = new Date().toISOString();
  const title = project?.title || project?.name || 'Untitled Project';
  const restrictedFinancials = Boolean(project?.workspacePrivacy?.restrictedFinancials);
  const approvedCostBudget = restrictedFinancials
    ? firstPositiveNumber(project?.approvedCostBudget)
    : 0;
  const bidPrice = restrictedFinancials
    ? 0
    : firstPositiveNumber(
    project?.bidPrice,
    project?.projectData?.bidPrice,
    project?.estimateData?.bidPrice,
    project?.totalBudget,
    project?.total,
    project?.totalRevenue
  );
  const estimatedCost = restrictedFinancials
    ? approvedCostBudget
    : firstPositiveNumber(
    project?.estimatedCost,
    project?.projectData?.estimatedCost,
    project?.estimateData?.estimatedCost,
    project?.totalBudget,
    bidPrice
  );
  const margin = restrictedFinancials
    ? 0
    : typeof project?.margin === 'number'
    ? project.margin
    : bidPrice > 0
      ? ((bidPrice - estimatedCost) / bidPrice) * 100
      : 0;
  const markup = restrictedFinancials
    ? 0
    : typeof project?.markup === 'number'
    ? project.markup
    : estimatedCost > 0
      ? ((bidPrice - estimatedCost) / estimatedCost) * 100
      : 0;

  const normalizedStatus = normalizeBackendStatus(project?.status);
  
  // If project is completed, progress should be 100%
  const rawProgress = Number(project?.progress ?? project?.overallProgressPct ?? 0) || 0;
  const finalProgress = normalizedStatus === 'completed' ? 100 : rawProgress;

  const startDate = toIsoDate(
    project?.estimateData?.projectStartDate || project?.startDate,
    nowIso
  );
  const endDate = toIsoDate(
    project?.estimateData?.projectEndDate || project?.estimateData?.endDate || project?.endDate,
    nowIso
  );

  return {
    id: String(project?.id || `${Date.now()}`),
    title,
    status: normalizedStatus,
    estimatedCost,
    bidPrice,
    actualCost: resolveActualCost(project),
    margin: Number.isFinite(margin) ? margin : 0,
    markup: Number.isFinite(markup) ? markup : 0,
    location: project?.location || project?.projectData?.location || '',
    city: project?.city,
    state: project?.state,
    zip: project?.zip,
    startDate,
    endDate,
    progress: finalProgress,
    overallProgressPct: finalProgress,
    milestones: Array.isArray(project?.milestones) ? project.milestones : [],
    weeklyPayments: Array.isArray(project?.weeklyPayments) ? project.weeklyPayments : [],
    paymentMilestones: Array.isArray(project?.paymentMilestones) ? project.paymentMilestones : [],
    paymentSchedule: project?.paymentSchedule,
    client: project?.client || project?.projectData?.client || 'Unknown Client',
    clientEmail: project?.clientEmail,
    clientPhone: project?.clientPhone,
    createdAt: toIsoDate(project?.createdAt, nowIso),
    updatedAt: toIsoDate(project?.updatedAt, nowIso),
    completedAt:
      project?.completedAt || project?.projectData?.completedAt || undefined,
    estimateData: restrictedFinancials ? undefined : project?.estimateData,
    projectData: restrictedFinancials ? undefined : project?.projectData,
    projectType: project?.projectType || project?.projectData?.projectType || title,
    workspacePrivacy: project?.workspacePrivacy,
    approvedCostBudget: restrictedFinancials ? approvedCostBudget : undefined,
    approvedCostBuckets: restrictedFinancials && Array.isArray(project?.approvedCostBuckets)
      ? project.approvedCostBuckets.map((b: any, index: number) => ({
          id: String(b?.id ?? index + 1),
          name: String(b?.name || 'Category'),
          budget: Number(b?.budget ?? 0) || 0,
          spent: Number(b?.spent ?? 0) || 0,
        }))
      : undefined,
  };
};

const WORKSPACE_ACCESS_CACHE_KEY = 'bps.cachedWorkspaceAccess';

async function persistWorkspaceAccessGranted(): Promise<void> {
  try {
    await AsyncStorage.setItem(WORKSPACE_ACCESS_CACHE_KEY, '1');
    setBusinessEntitlementSnapshot({ hasBusiness: false, hasWorkspaceAccess: true });
  } catch {
    /* optional */
  }
}

function isInvitedWorkspaceMemberAccess(
  access: BusinessWorkspaceAccess | null | undefined
): boolean {
  return Boolean(
    access?.hasWorkspaceAccess && access.workspaceId && !access.isOwner
  );
}

async function resolveWorkspaceMemberAccess(
  bootstrapAccess: BusinessWorkspaceAccess | null | undefined
): Promise<BusinessWorkspaceAccess | null> {
  if (isInvitedWorkspaceMemberAccess(bootstrapAccess)) {
    return bootstrapAccess!;
  }
  const cached = await readWorkspaceAccessSnapshot();
  if (isInvitedWorkspaceMemberAccess(cached)) {
    return cached;
  }
  return null;
}

async function loadWorkspaceMemberProjects(
  workspaceId: string,
  localParsed: UnifiedProject[]
): Promise<UnifiedProject[]> {
  const sharedRows = await listWorkspaceSharedProjects();
  const fromWorkspace = (sharedRows || []).map(mapBackendProjectToUnified);
  const merged = mergeLocalAndBackend(localParsed, fromWorkspace, {
    workspaceMember: true,
  });
  return hydrateProjectsList(merged);
}

const listBackendProjects = async (): Promise<any[]> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const projectsResponse: any = await apiService.getProjects();
      const backendProjects = Array.isArray(projectsResponse)
        ? projectsResponse
        : Array.isArray(projectsResponse?.data)
          ? projectsResponse.data
          : [];
      return backendProjects;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError;
};

const listWorkspaceSharedProjects = async (): Promise<any[]> => {
  await businessWorkspaceService.acceptPendingInvites().catch(() => null);
  invalidateWorkspaceBootstrapCache();

  const bootstrap = await fetchWorkspaceBootstrap({ force: true });
  const memberAccess = await resolveWorkspaceMemberAccess(bootstrap?.access ?? null);
  if (!memberAccess?.workspaceId) {
    return [];
  }

  const response = await businessWorkspaceService.getWorkspaceProjects();
  if (response.success && Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(bootstrap?.projects)) {
    return bootstrap.projects;
  }

  if (!response.success) {
    throw new Error(response.error || 'Failed to load workspace projects');
  }
  return [];
};

const hydrateProjectsList = async (
  rows: UnifiedProject[]
): Promise<UnifiedProject[]> => {
  const withKeys = await hydrateProjectDataFromStorageKeys(rows);
  return dedupeProjectsById(await applyProgressAndDatesFromStorage(withKeys));
};

/** DELETE could not reach the API — allow local-only removal (same spirit as 404). */
function isBackendUnreachableForDelete(error: unknown): boolean {
  const any = error as { status?: number; isNetworkError?: boolean };
  if (any?.isNetworkError) return true;
  if (any?.status === 0) return true;
  const msg = error instanceof Error ? error.message : String(error ?? '');
  if (msg.includes('Cannot connect to backend')) return true;
  return false;
}

const toBackendCreatePayload = (project: UnifiedProject) => {
  const nowIso = new Date().toISOString();
  return {
    name: (project.title || 'Untitled Project').trim(),
    client: (project.client || 'Unknown Client').trim(),
    location: (project.location || 'Unspecified').trim(),
    startDate: toIsoDate(project.startDate, nowIso),
    endDate: toIsoDate(project.endDate, nowIso),
    totalBudget: firstPositiveNumber(project.bidPrice, project.estimatedCost, 0),
    description: project.projectData?.description || project.estimateData?.description || '',
  };
};

const pushProjectsToBackend = async (list: UnifiedProject[]): Promise<any[]> => {
  if (!list.length) return [];
  try {
    const synced = await apiService.syncProjects(list as Record<string, unknown>[]);
    if (__DEV__ && synced.length === 0 && list.length > 0) {
      console.warn(
        `⚠️ Project sync returned 0 rows but ${list.length} local project(s) were sent — check backend URL/auth`
      );
    }
    return synced;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'ℹ️ Backend project sync skipped (auth/network/backend not ready):',
        error instanceof Error ? error.message : error
      );
    }
    return [];
  }
};

/** Merge server rows with local-only drafts and preserve completed status from the app. */
const mergeLocalAndBackend = (
  local: UnifiedProject[],
  fromServer: UnifiedProject[],
  options?: { workspaceMember?: boolean }
): UnifiedProject[] => {
  const backendIds = new Set(
    fromServer.map((p) => normalizeProjectId(p.id)).filter(Boolean)
  );

  const mergedFromServer = fromServer.map((serverP) => {
    const id = normalizeProjectId(serverP.id);
    if (!id) return serverP;
    const localP = local.find((p) => normalizeProjectId(p.id) === id);
    if (!localP) return serverP;

    if (isWorkspaceRestrictedFinancialsProject(serverP)) {
      const localSt = normalizeStatus(localP.status);
      const serverSt = normalizeStatus(serverP.status);
      const useCompletedLocal =
        localSt === 'completed' && serverSt !== 'completed' && serverSt !== 'lost';
      return {
        ...serverP,
        status: useCompletedLocal ? ('completed' as const) : serverP.status,
        progress: Math.max(Number(localP.progress) || 0, Number(serverP.progress) || 0),
        overallProgressPct: Math.max(
          Number(localP.overallProgressPct) || 0,
          Number(serverP.overallProgressPct) || 0,
          Number(localP.progress) || 0,
          Number(serverP.progress) || 0,
          useCompletedLocal ? 100 : 0
        ),
        completedAt:
          localP.completedAt ||
          localP.projectData?.completedAt ||
          serverP.completedAt ||
          serverP.projectData?.completedAt,
      };
    }

    const localSt = normalizeStatus(localP.status);
    const serverSt = normalizeStatus(serverP.status);
    if (
      localSt === 'completed' &&
      serverSt !== 'completed' &&
      serverSt !== 'lost'
    ) {
      return {
        ...serverP,
        status: 'completed' as const,
        progress: 100,
        overallProgressPct: Math.max(
          Number(localP.overallProgressPct) || 0,
          Number(serverP.overallProgressPct) || 0,
          Number(localP.progress) || 0,
          Number(serverP.progress) || 0,
          100
        ),
        updatedAt: new Date().toISOString(),
        completedAt:
          localP.completedAt ||
          localP.projectData?.completedAt ||
          serverP.completedAt ||
          serverP.projectData?.completedAt,
        estimateData: localP.estimateData || serverP.estimateData,
        projectData: { ...(serverP.projectData || {}), ...(localP.projectData || {}) },
      };
    }

    const localTime = new Date(localP.updatedAt || 0).getTime();
    const serverTime = new Date(serverP.updatedAt || 0).getTime();
    if (localTime > serverTime) {
      return {
        ...serverP,
        ...localP,
        id: serverP.id,
      };
    }
    return serverP;
  });

  if (options?.workspaceMember) {
    return dedupeProjectsById(mergedFromServer);
  }

  const localDrafts = local.filter((p) => {
    const id = normalizeProjectId(p.id);
    if (!id || backendIds.has(id)) return false;
    const st = normalizeStatus(p.status);
    return (
      st === 'estimate' ||
      st === 'draft' ||
      st === 'bid_submitted' ||
      st === 'submitted' ||
      st === 'won' ||
      st === 'in_progress' ||
      st === 'in-progress' ||
      st === 'active' ||
      st === 'completed'
    );
  });

  return dedupeProjectsById([...mergedFromServer, ...localDrafts]);
};

type ProjectListProviderCoreProps = {
  children: ReactNode;
  accountUserId: string | null;
  accountReady: boolean;
};

const ProjectListProviderCore = ({
  children,
  accountUserId,
  accountReady,
}: ProjectListProviderCoreProps) => {
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasAttemptedBackendSeedRef = useRef(false);
  /** After GET /api/projects returns 429, skip refresh for a while so tab focus / dev reload does not spam the server. */
  const projectsRefreshCooldownUntilRef = useRef(0);
  const projectsRef = useRef<UnifiedProject[]>([]);
  const rehydrateInFlightRef = useRef(false);
  const storageKeyRef = useRef(UNIFIED_PROJECTS_STORAGE_KEY);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceMemberModeRef = useRef(false);
  const workspaceMemberContextRef = useRef<{ workspaceId: string } | null>(null);
  const projectsLoadSeqRef = useRef(0);
  const suppressBackendSyncRef = useRef(false);
  const lastProjectsRefreshAtRef = useRef(0);
  const PROJECTS_REFRESH_DEBOUNCE_MS = 5000;

  const resolveListStorageKey = useCallback(
    () => getUnifiedProjectsStorageKey(accountUserId),
    [accountUserId]
  );

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    const wsId = workspaceMemberContextRef.current?.workspaceId;
    storageKeyRef.current = wsId
      ? getWorkspaceProjectsStorageKey(wsId)
      : resolveListStorageKey();
  }, [resolveListStorageKey, accountUserId]);

  useEffect(() => {
    if (accountUserId) return;
    workspaceMemberModeRef.current = false;
    workspaceMemberContextRef.current = null;
    invalidateWorkspaceBootstrapCache();
  }, [accountUserId]);

  // Load when account identity is known (or legacy signed-out mode).
  useEffect(() => {
    if (!accountReady) return;
    hasAttemptedBackendSeedRef.current = false;
    suppressBackendSyncRef.current = false;
    void loadProjects();
  }, [accountUserId, accountReady]);

  // After sign-in, retry once if the first load returned empty (token/network race).
  useEffect(() => {
    if (!accountReady || !accountUserId || !hasLoadedOnce) return;
    if (projectsRef.current.length > 0) return;

    const timer = setTimeout(() => {
      if (projectsRef.current.length === 0) {
        void loadProjects();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [accountReady, accountUserId, hasLoadedOnce]);

  // Save locally and debounce backend sync for signed-in accounts.
  useEffect(() => {
    if (!isHydrated || !hasLoadedOnce) return;
    if (suppressBackendSyncRef.current) return;
    void saveProjects();
    if (!accountUserId) return;
    if (workspaceMemberModeRef.current) return;
    if (projects.length === 0) return;

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(() => {
      if (suppressBackendSyncRef.current) return;
      if (projectsRef.current.length === 0) return;
      void pushProjectsToBackend(projectsRef.current);
    }, 2500);

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [projects, isHydrated, hasLoadedOnce, accountUserId]);

  const loadProjects = async () => {
    const loadSeq = ++projectsLoadSeqRef.current;
    const forceBootstrap = projectsRef.current.length === 0;

    const commitProjects = (
      next: UnifiedProject[],
      opts?: { trustServer?: boolean }
    ) => {
      if (loadSeq !== projectsLoadSeqRef.current) return false;
      if (
        next.length === 0 &&
        workspaceMemberModeRef.current &&
        projectsRef.current.length > 0 &&
        !opts?.trustServer
      ) {
        return false;
      }
      setProjects(next);
      return true;
    };

    const finishWorkspaceMemberLoad = async (
      wsAccess: BusinessWorkspaceAccess,
      localParsed: UnifiedProject[]
    ) => {
      const workspaceId = String(wsAccess.workspaceId);
      workspaceMemberModeRef.current = true;
      workspaceMemberContextRef.current = { workspaceId };
      const listKey = getWorkspaceProjectsStorageKey(workspaceId);
      storageKeyRef.current = listKey;

      const normalized = await loadWorkspaceMemberProjects(workspaceId, localParsed);
      if (!commitProjects(normalized, { trustServer: true })) return true;

      await AsyncStorage.setItem(listKey, JSON.stringify(normalized));
      await persistWorkspaceAccessSnapshot(wsAccess);
      setIsHydrated(true);
      setHasLoadedOnce(true);
      suppressBackendSyncRef.current = false;
      lastProjectsRefreshAtRef.current = Date.now();
      if (__DEV__) {
        console.log(`✅ Loaded ${normalized.length} workspace projects for member`);
      }
      return true;
    };

    try {
      if (accountUserId) {
        await resolveWorkspaceAccessAfterAuth().catch(() => null);
      }

      const bootstrap = await fetchWorkspaceBootstrap(
        forceBootstrap ? { force: true } : undefined
      );
      const memberAccess = await resolveWorkspaceMemberAccess(bootstrap?.access ?? null);
      if (memberAccess?.hasWorkspaceAccess) {
        await persistWorkspaceAccessGranted();
      }

      if (memberAccess?.workspaceId) {
        let localParsed: UnifiedProject[] = [];
        const listKey = getWorkspaceProjectsStorageKey(memberAccess.workspaceId);
        const saved = await AsyncStorage.getItem(listKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) localParsed = parsed;
          } catch {
            localParsed = [];
          }
        }
        if (await finishWorkspaceMemberLoad(memberAccess, localParsed)) {
          return;
        }
      }

      workspaceMemberModeRef.current = false;
      workspaceMemberContextRef.current = null;
    } catch (workspaceError) {
      if (__DEV__) {
        console.warn('Workspace project load failed', workspaceError);
      }
      const cachedMember = await resolveWorkspaceMemberAccess(null);
      if (cachedMember?.workspaceId) {
        try {
          const listKey = getWorkspaceProjectsStorageKey(cachedMember.workspaceId);
          const saved = await AsyncStorage.getItem(listKey);
          let localParsed: UnifiedProject[] = [];
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) localParsed = parsed;
            } catch {
              localParsed = [];
            }
          }
          if (localParsed.length > 0 && commitProjects(localParsed)) {
            workspaceMemberModeRef.current = true;
            workspaceMemberContextRef.current = {
              workspaceId: String(cachedMember.workspaceId),
            };
            storageKeyRef.current = listKey;
            setIsHydrated(true);
            setHasLoadedOnce(true);
            suppressBackendSyncRef.current = false;
            return;
          }
          if (await finishWorkspaceMemberLoad(cachedMember, localParsed)) {
            return;
          }
        } catch {
          /* fall through */
        }
      }
      if (workspaceMemberModeRef.current) {
        setIsHydrated(true);
        setHasLoadedOnce(true);
        suppressBackendSyncRef.current = false;
        return;
      }
      workspaceMemberModeRef.current = false;
      workspaceMemberContextRef.current = null;
    }

    if (workspaceMemberModeRef.current || workspaceMemberContextRef.current) {
      return;
    }

    const listKey = resolveListStorageKey();
    storageKeyRef.current = listKey;

    try {
      let localParsed: UnifiedProject[] = [];
      const saved = await AsyncStorage.getItem(listKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) localParsed = parsed;
        } catch {
          localParsed = [];
        }
      } else if (accountUserId) {
        const activeUserId = await getActiveProjectUserId();
        const legacyRaw = await AsyncStorage.getItem(UNIFIED_PROJECTS_STORAGE_KEY);
        const mayUseLegacy =
          !!legacyRaw &&
          (activeUserId === accountUserId ||
            (Platform.OS !== 'web' && !activeUserId));
        if (mayUseLegacy && legacyRaw) {
          try {
            const legacyParsed = JSON.parse(legacyRaw);
            if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
              localParsed = legacyParsed;
              await AsyncStorage.setItem(listKey, legacyRaw);
              await setActiveProjectUserId(accountUserId);
            }
          } catch {
            localParsed = [];
          }
        }
      }

      if (localParsed.length > 0 && projectsRef.current.length === 0) {
        const quickHydrate = await hydrateProjectDataFromStorageKeys(localParsed);
        const quickNormalized = dedupeProjectsById(
          await applyProgressAndDatesFromStorage(quickHydrate)
        );
        setProjects(quickNormalized);
      }

      if (accountUserId) {
        try {
          const backendProjects = await listBackendProjects();
          const fromServer = backendProjects.map(mapBackendProjectToUnified);
          const merged = mergeLocalAndBackend(localParsed, fromServer);

          let syncedRows = fromServer;
          if (merged.length > 0) {
            const synced = await pushProjectsToBackend(merged);
            if (Array.isArray(synced) && synced.length > 0) {
              syncedRows = synced;
            } else if (fromServer.length === 0 && !hasAttemptedBackendSeedRef.current) {
              hasAttemptedBackendSeedRef.current = true;
              for (const localProject of merged) {
                const payload = toBackendCreatePayload(localProject);
                if (!payload.name || !payload.client) continue;
                try {
                  await apiService.createProject({ ...payload, id: localProject.id } as any);
                } catch {
                  /* ignore individual seed failures */
                }
              }
              syncedRows = (await listBackendProjects()).map((p) => p);
            }
          }

          const mapped = (Array.isArray(syncedRows) ? syncedRows : backendProjects).map(
            mapBackendProjectToUnified
          );
          const reconciled = mergeLocalAndBackend(localParsed, mapped);
          const withKeys = await hydrateProjectDataFromStorageKeys(reconciled);
          const normalized = dedupeProjectsById(
            await applyProgressAndDatesFromStorage(withKeys)
          );

          if (loadSeq !== projectsLoadSeqRef.current) return;
          commitProjects(normalized);
          await AsyncStorage.setItem(listKey, JSON.stringify(normalized));
          await setActiveProjectUserId(accountUserId);
          setIsHydrated(true);
          setHasLoadedOnce(true);
          suppressBackendSyncRef.current = false;
          lastProjectsRefreshAtRef.current = Date.now();
          return;
        } catch (backendError) {
          if (__DEV__) {
            console.warn('loadProjects: backend merge failed, using local cache', backendError);
          }
        }
      }

      if (localParsed.length > 0) {
        const hydratedProjects = await hydrateProjectDataFromStorageKeys(localParsed);
        const normalized = dedupeProjectsById(
          await applyProgressAndDatesFromStorage(hydratedProjects)
        );
        if (commitProjects(normalized)) {
          setIsHydrated(true);
          setHasLoadedOnce(true);
          suppressBackendSyncRef.current = false;
          return;
        }
      }

      if (loadSeq === projectsLoadSeqRef.current) {
        commitProjects([]);
        setIsHydrated(true);
        setHasLoadedOnce(true);
        suppressBackendSyncRef.current = false;
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setIsHydrated(true);
      setHasLoadedOnce(true);
      suppressBackendSyncRef.current = false;
    }
  };

  const saveProjects = async () => {
    try {
      await AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(projects));
      if (accountUserId) {
        await setActiveProjectUserId(accountUserId);
      }
    } catch (error) {
      console.error('Error saving projects:', error);
    }
  };

  const clearProjectsLocal = async () => {
    suppressBackendSyncRef.current = true;
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    setProjects([]);
    setIsHydrated(false);
    setHasLoadedOnce(false);
    workspaceMemberModeRef.current = false;
    workspaceMemberContextRef.current = null;
    lastProjectsRefreshAtRef.current = 0;
    invalidateWorkspaceBootstrapCache();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const projectKeys = keys.filter(
        (key) =>
          key.startsWith(`${UNIFIED_PROJECTS_STORAGE_KEY}.ws.`) ||
          key === WORKSPACE_ACCESS_CACHE_KEY ||
          key === 'bps.cachedWorkspaceAccessSnapshot' ||
          key.startsWith('bps.team.members') ||
          key.startsWith('bps.workspaceSync.')
      );
      if (projectKeys.length > 0) {
        await AsyncStorage.multiRemove(projectKeys);
      }
    } catch (error) {
      console.error('Error clearing local projects:', error);
    }
  };

  // Filtered lists — must be memoized: fresh [] each render breaks consumers' useEffect deps
  // (e.g. estimate-generator bid autosave) and floods Metro / the integrated terminal.
  const estimates = useMemo(
    () =>
      projects.filter((p) => {
        const status = normalizeStatus(p.status);
        return status === 'estimate' || status === 'bid_submitted';
      }),
    [projects]
  );
  const activeProjects = useMemo(
    () =>
      projects.filter((p) => {
        const status = normalizeStatus(p.status);
        return (
          status === 'won' ||
          status === 'in_progress' ||
          status === 'in-progress' ||
          status === 'active' ||
          status === 'completed' ||
          status === 'complete'
        );
      }),
    [projects]
  );
  const wonProjects = useMemo(
    () =>
      projects.filter((p) => {
        const status = normalizeStatus(p.status);
        return status === 'won' || status === 'completed';
      }),
    [projects]
  );

  // Add estimate from Estimates page
  const addEstimate = async (estimate: UnifiedProject) => {
    let nextProjects: UnifiedProject[] = [];
    setProjects(prev => {
      // Check if estimate already exists to prevent duplicates
      const existingIndex = prev.findIndex(p => p.id === estimate.id);
      if (existingIndex !== -1) {
        nextProjects = prev.map((p, index) =>
          index === existingIndex
            ? {
                ...p,
                ...estimate,
                bidPrice: estimate.bidPrice !== undefined && estimate.bidPrice !== null ? estimate.bidPrice : p.bidPrice,
                estimatedCost: estimate.estimatedCost !== undefined && estimate.estimatedCost !== null ? estimate.estimatedCost : p.estimatedCost,
                margin: estimate.margin !== undefined && estimate.margin !== null ? estimate.margin : p.margin,
                profit: estimate.profit !== undefined && estimate.profit !== null ? estimate.profit : p.profit,
                status: estimate.status || p.status,
                updatedAt: new Date().toISOString()
              }
            : p
        );
      } else {
        nextProjects = [
          {
            ...estimate,
            status: (estimate.status || 'estimate') as UnifiedProject['status'],
            createdAt: estimate.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...prev
        ];
      }
      return nextProjects;
    });
    // Await save so Projects tab refreshProjects won't overwrite with stale AsyncStorage
    try {
      await AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(nextProjects));
      if (__DEV__) console.log(`💾 Saved estimate to AsyncStorage`);
    } catch (error) {
      console.error('Error saving estimate:', error);
    }
  };

  // Convert won bid to active project
  const convertBidToProject = (bidId: string) => {
    setProjects(prev => {
      const found = prev.find(p => p.id === bidId);
      if (!found) return prev;
      
      // Check if any project matches and update it
      let updated = false;
      const updatedProjects = prev.map(p => {
        if (p.id === bidId) {
          updated = true;
          return {
            ...p,
            status: 'won' as const,
            progress: 0,
            overallProgressPct: 0,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });
      return updatedProjects;
    });
  };

  // Update project progress
  const updateProjectProgress = (projectId: string, progress: number, actualCost?: number) => {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== projectId) return p;

        const resolvedActualCost = resolveActualCost(p, actualCost);
        const nextActualCost = resolvedActualCost;
        const nextStatus = progress >= 100 ? 'completed' : 'in_progress';
        const revenue = p.bidPrice || resolveProjectRevenue(p);
        const marginPercent =
          revenue > 0
            ? Math.round(((revenue - nextActualCost) / revenue) * 100 * 100) / 100
            : p.margin;

        return {
          ...p,
          progress,
          actualCost: nextActualCost,
          status: nextStatus,
          margin: marginPercent,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  // Delete project — prefer server delete so refresh won't resurrect it. If the API is
  // unreachable, still remove locally and persist (web often throws TypeError: Failed to fetch).
  const deleteProject = async (projectId: string) => {
    const targetId = normalizeProjectId(projectId);

    try {
      await apiService.deleteProject(String(projectId));
    } catch (error: any) {
      const status = error?.status;
      const unreachable = isBackendUnreachableForDelete(error);
      if (status === 404 || status === 410) {
        // Already gone on server (or never existed there).
      } else if (unreachable) {
        if (__DEV__) {
          console.warn(
            'deleteProject: backend unreachable — removed from this device only. Start the API and delete again to remove from the server, or the project may reappear after a successful sync.'
          );
        }
      } else {
        console.error('deleteProject: backend delete failed:', error);
        throw error;
      }
    }

    let filtered: UnifiedProject[] = [];
    setProjects((prev) => {
      const victim = prev.find((p) => normalizeProjectId(p.id) === targetId);
      if (victim) {
        void recordDeletedProject(
          targetId,
          String(victim.title || victim.name || '').trim()
        );
      }
      filtered = prev.filter((p) => normalizeProjectId(p.id) !== targetId);
      return filtered;
    });
    try {
      await AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(filtered));
      if (__DEV__) console.log(`💾 Saved deleted project state to AsyncStorage`);
    } catch (error) {
      console.error('Error saving deleted project:', error);
    }
    try {
      await AsyncStorage.multiRemove([
        `bps.project.${targetId}`,
        `bps.project.${targetId}.progress`,
      ]);
    } catch {
      try {
        await AsyncStorage.removeItem(`bps.project.${targetId}`);
        await AsyncStorage.removeItem(`bps.project.${targetId}.progress`);
      } catch {
        /* ignore */
      }
    }
  };

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(
    () => ({
      totalRevenue: wonProjects.reduce((sum, project) => {
        const revenue = resolveProjectRevenue(project);
        return sum + revenue;
      }, 0),
      totalExpenses: wonProjects.reduce((sum, project) => {
        const revenue = resolveProjectRevenue(project);
        const cost = resolveProjectCost(project, revenue);
        return sum + cost;
      }, 0),
      totalProfit: wonProjects.reduce((sum, project) => {
        const revenue = resolveProjectRevenue(project);
        const cost = resolveProjectCost(project, revenue);
        return sum + (revenue - cost);
      }, 0),
      activeProjectsCount: wonProjects.length,
      wonBidsCount: wonProjects.length,
      pendingBidsCount: estimates.filter((p) => p.status === 'bid_submitted').length,
    }),
    [wonProjects, estimates]
  );

  // Generic operations
  const getProjectById = (id: string) => {
    const targetId = normalizeProjectId(id);
    const project = projects.find(p => normalizeProjectId(p.id) === targetId);
    if (!project) return undefined;
    
    // DISABLED: Auto-fix logic was incorrectly modifying project amounts
    // Only fix if there's actual corruption (values > 1,000,000), but even then, don't modify bidPrice
    // The issue was that this logic was resetting bidPrice incorrectly
    // if (project.title?.toLowerCase().includes('nick') && project.estimateData) {
    //   const materialsTotal = project.estimateData.materials || 0;
    //   const bidPrice = project.bidPrice || 0;
    //   const estimatedCost = project.estimatedCost || 0;
    //   const hasCorruptedMaterials = materialsTotal > 1000000 || 
    //     bidPrice > 1000000 || 
    //     estimatedCost > 1000000 ||
    //     (project.estimateData.materialLineItems?.some((item: any) => {
    //       const total = Number(item.total) || Number(item.cost) || 0;
    //       return total > 1000000;
    //     })) ||
    //     (project.projectData?.buckets?.some((b: any) => {
    //       return (b.name === 'Materials/Equipment' || b.id === '2') && (b.budget > 1000000 || b.bidBudget > 1000000);
    //     }));
    //
    //   if (hasCorruptedMaterials) {
    //     // DISABLED: Auto-fix logic was incorrectly modifying project amounts
    //     // console.log('🔧 Fixing corrupted materials for Nick project in getProjectById - restoring to $6,250');
    //     // ... all auto-fix code disabled to prevent incorrect modifications
    //     // return fixedProject;
    //   }
    // }
    
    return project;
  };

  const updateProject = (id: string, updates: Partial<UnifiedProject>) => {
    const targetId = normalizeProjectId(id);
    setProjects(prev =>
      prev.map(p => {
        if (normalizeProjectId(p.id) !== targetId) return p;

        // DISABLED: Auto-fix logic was incorrectly modifying project amounts
        // This was causing project amounts to drop on every update
        // if (p.title?.toLowerCase().includes('nick') && p.estimateData) {
        //   const materialsTotal = p.estimateData.materials || 0;
        //   const hasCorruptedMaterials = materialsTotal > 1000000 || 
        //     (p.estimateData.materialLineItems?.some((item: any) => {
        //       const total = Number(item.total) || Number(item.cost) || 0;
        //       return total > 1000000;
        //     }));
        //   
        //   if (hasCorruptedMaterials && !updates.estimateData) {
        //     console.log('🔧 Fixing corrupted materials for Nick project - restoring to $6,250');
        //     // ... all auto-fix code disabled to prevent incorrect modifications
        //   }
        // }

        // Deep merge projectData if it exists in updates, ensuring expenses and changeOrders arrays are properly replaced
        let finalProjectData = p.projectData;
        if (updates.projectData) {
          finalProjectData = {
            ...(p.projectData || {}),
            ...updates.projectData,
            // CRITICAL: If expenses is in updates.projectData, use it directly (don't merge arrays)
            expenses: updates.projectData.expenses !== undefined
              ? updates.projectData.expenses  // Use the new expenses array (even if empty)
              : (p.projectData?.expenses || []), // Only fallback if not provided
            // CRITICAL: If changeOrders is in updates.projectData, use it directly (don't merge arrays)
            changeOrders: updates.projectData.changeOrders !== undefined
              ? updates.projectData.changeOrders  // Use the new changeOrders array (even if empty)
              : (p.projectData?.changeOrders || []), // Only fallback if not provided
          };
          console.log('🔄 updateProject: expenses count in finalProjectData:', finalProjectData.expenses?.length || 0);
        }

        const next: UnifiedProject = {
          ...p,
          ...updates,
          // Use the properly merged projectData
          ...(finalProjectData ? { projectData: finalProjectData } : {}),
          // Always update updatedAt when project is modified
          updatedAt: new Date().toISOString(),
        };

        // Sync timeline dates from estimateData when estimate is updated (estimate is source of truth)
        const newEstimate = updates.estimateData ?? next.estimateData;
        if (newEstimate?.projectStartDate || newEstimate?.projectEndDate || newEstimate?.endDate) {
          next.startDate = newEstimate.projectStartDate || next.startDate;
          next.endDate = newEstimate.projectEndDate || newEstimate.endDate || next.endDate;
        }

        if (updates.actualCost != null || updates.bidPrice != null) {
          const revenue = next.bidPrice || resolveProjectRevenue(next);
          const cost = resolveActualCost(next);
          if (revenue > 0) {
            next.margin = Math.round(((revenue - cost) / revenue) * 100 * 100) / 100;
          }
        }

        if (updates.projectData && Object.prototype.hasOwnProperty.call(updates.projectData, 'spent')) {
          const revenue = next.bidPrice || resolveProjectRevenue(next);
          const cost = resolveActualCost(next);
          if (revenue > 0) {
            next.margin = Math.round(((revenue - cost) / revenue) * 100 * 100) / 100;
          }
          next.actualCost = cost;
        }

        if (updates.projectType == null && !next.projectType) {
          next.projectType =
            p.projectType ||
            p.estimateData?.projectType ||
            p.estimateData?.category ||
            p.projectData?.projectType ||
            p.projectData?.type ||
            p.title;
        }

        if (updates.overallProgressPct != null || updates.progress != null) {
          const progressValue =
            updates.overallProgressPct ??
            updates.progress ??
            next.overallProgressPct ??
            next.progress ??
            0;
          // Always use the new progress value from updates (don't fall back to old value)
          next.progress = updates.progress !== undefined ? updates.progress : (updates.overallProgressPct !== undefined ? updates.overallProgressPct : progressValue);
          next.overallProgressPct = updates.overallProgressPct !== undefined ? updates.overallProgressPct : (updates.progress !== undefined ? updates.progress : progressValue);
          console.log(`🔄 updateProject: Setting progress for ${next.title} (${targetId}) to ${progressValue}% (progress: ${next.progress}, overallProgressPct: ${next.overallProgressPct})`);
          console.log(`📊 Progress breakdown: progress=${next.progress}, overallProgressPct=${next.overallProgressPct}, status=${next.status}`);
          
          // Save progress to AsyncStorage to persist across reloads
          const progressData = {
            progress: next.progress,
            overallProgressPct: next.overallProgressPct,
            updatedAt: new Date().toISOString()
          };
          console.log(`💾 Saving progress to AsyncStorage: bps.project.${targetId}.progress`, progressData);
          AsyncStorage.setItem(`bps.project.${targetId}.progress`, JSON.stringify(progressData))
            .then(() => {
              console.log(`✅ Successfully saved progress for ${targetId} to AsyncStorage`);
            })
            .catch(err => {
              console.error(`❌ Failed to save progress to AsyncStorage for ${targetId}:`, err);
            });
          
          const statusSlug = normalizeStatus(next.status);
          if (progressValue >= 100 && statusSlug !== 'lost') {
            next.status = 'completed';
          }
          // Intentionally do NOT demote completed → in_progress when progress < 100.
          // Timeline/storage can briefly report <100 and wrongly moved completed jobs to Active (Expo vs TestFlight).
        }

        if (normalizeStatus(next.status) === 'completed' && !updates.completedAt) {
          if (!next.completedAt) {
            next.completedAt =
              p.completedAt ||
              p.projectData?.completedAt ||
              (normalizeStatus(p.status) !== 'completed'
                ? new Date().toISOString()
                : undefined);
          }
        }

        return { ...next, updatedAt: new Date().toISOString() };
      })
    );
  };

  const rehydrateProjectsFromStorage = async () => {
    if (rehydrateInFlightRef.current) return;
    rehydrateInFlightRef.current = true;
    try {
      const wsId = workspaceMemberContextRef.current?.workspaceId;
      if (wsId) {
        const normalized = await loadWorkspaceMemberProjects(String(wsId), []);
        setProjects(normalized);
        const storageKey = getWorkspaceProjectsStorageKey(wsId);
        await AsyncStorage.setItem(storageKey, JSON.stringify(normalized));
        return;
      }

      let base = projectsRef.current;
      const storageKey = storageKeyRef.current;
      if (!base.length) {
        const saved = await AsyncStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) base = parsed;
        }
      }
      if (!Array.isArray(base) || base.length === 0) return;

      const hydrated = await hydrateProjectDataFromStorageKeys(base);
      const normalized = dedupeProjectsById(
        await applyProgressAndDatesFromStorage(hydrated)
      );
      setProjects(normalized);
    } catch (e) {
      if (__DEV__) {
        console.warn('rehydrateProjectsFromStorage failed', e);
      }
    } finally {
      rehydrateInFlightRef.current = false;
    }
  };

  const refreshProjects = async () => {
    const now = Date.now();
    const hasCachedProjects = projectsRef.current.length > 0;
    const isWorkspaceMemberSession = Boolean(
      workspaceMemberModeRef.current || workspaceMemberContextRef.current
    );
    if (
      !isWorkspaceMemberSession &&
      hasCachedProjects &&
      hasLoadedOnce &&
      now - lastProjectsRefreshAtRef.current < PROJECTS_REFRESH_DEBOUNCE_MS
    ) {
      await rehydrateProjectsFromStorage();
      return;
    }
    if (now < projectsRefreshCooldownUntilRef.current) {
      if (__DEV__) {
        console.warn(
          "refreshProjects: skipped (cooldown after HTTP 429 — wait before retrying /api/projects)"
        );
      }
      await rehydrateProjectsFromStorage();
      return;
    }

    const commitRefreshProjects = (
      next: UnifiedProject[],
      opts?: { trustServer?: boolean }
    ) => {
      if (
        next.length === 0 &&
        (workspaceMemberModeRef.current || workspaceMemberContextRef.current) &&
        projectsRef.current.length > 0 &&
        !opts?.trustServer
      ) {
        return false;
      }
      setProjects(next);
      return true;
    };

    try {
      if (accountUserId) {
        await resolveWorkspaceAccessAfterAuth().catch(() => null);
      }

      const bootstrap = await fetchWorkspaceBootstrap(
        !hasCachedProjects ? { force: true } : undefined
      );
      const memberAccess = await resolveWorkspaceMemberAccess(bootstrap?.access ?? null);
      if (memberAccess?.hasWorkspaceAccess) {
        await persistWorkspaceAccessGranted();
      }

      if (memberAccess?.workspaceId) {
        const workspaceId = String(memberAccess.workspaceId);
        workspaceMemberModeRef.current = true;
        workspaceMemberContextRef.current = { workspaceId };
        storageKeyRef.current = getWorkspaceProjectsStorageKey(workspaceId);

        let localBase = projectsRef.current;
        if (!localBase.length) {
          const saved = await AsyncStorage.getItem(storageKeyRef.current);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) localBase = parsed;
            } catch {
              localBase = [];
            }
          }
        }

        const normalized = await loadWorkspaceMemberProjects(workspaceId, localBase);
        if (commitRefreshProjects(normalized, { trustServer: true })) {
          await AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(normalized));
          await persistWorkspaceAccessSnapshot(memberAccess);
        }
        setIsHydrated(true);
        setHasLoadedOnce(true);
        projectsRefreshCooldownUntilRef.current = 0;
        lastProjectsRefreshAtRef.current = Date.now();
        suppressBackendSyncRef.current = false;
        return;
      }

      if (workspaceMemberModeRef.current || workspaceMemberContextRef.current) {
        await rehydrateProjectsFromStorage();
        return;
      }

      workspaceMemberModeRef.current = false;
      workspaceMemberContextRef.current = null;

      const backendProjects = await listBackendProjects();
      const fromServer = backendProjects.map(mapBackendProjectToUnified);

      let localBase = projectsRef.current;
      if (!localBase.length) {
        const saved = await AsyncStorage.getItem(storageKeyRef.current);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) localBase = parsed;
          } catch {
            localBase = [];
          }
        }
      }

      const merged = mergeLocalAndBackend(localBase, fromServer);
      if (accountUserId && merged.length > 0) {
        await pushProjectsToBackend(merged);
      }

      const refreshedBackend = accountUserId
        ? await listBackendProjects()
        : backendProjects;
      const remapped = refreshedBackend.map(mapBackendProjectToUnified);
      const reconciled = mergeLocalAndBackend(localBase, remapped);
      const withKeys = await hydrateProjectDataFromStorageKeys(reconciled);
      const normalized = dedupeProjectsById(
        await applyProgressAndDatesFromStorage(withKeys)
      );

      commitRefreshProjects(normalized);
      await AsyncStorage.setItem(storageKeyRef.current, JSON.stringify(normalized));
      if (accountUserId) {
        await setActiveProjectUserId(accountUserId);
      }

      setIsHydrated(true);
      setHasLoadedOnce(true);
      projectsRefreshCooldownUntilRef.current = 0;
      lastProjectsRefreshAtRef.current = Date.now();
      suppressBackendSyncRef.current = false;
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 429) {
        projectsRefreshCooldownUntilRef.current = Date.now() + 60_000;
      }
      if (__DEV__) {
        console.warn('refreshProjects: backend failed, falling back to loadProjects', e);
      }
      await loadProjects();
    }
  };

  return (
    <ProjectListContext.Provider
      value={{
        projects,
        estimates,
        activeProjects,
        addEstimate,
        convertBidToProject,
        updateProjectProgress,
        dashboardMetrics,
        getProjectById,
        updateProject,
        deleteProject,
        refreshProjects,
        rehydrateProjectsFromStorage,
        clearProjectsLocal,
      }}
    >
      {children}
    </ProjectListContext.Provider>
  );
};

function ProjectListProviderClerk({ children }: { children: ReactNode }) {
  const { userId, isReady: clerkUserReady } = useClerkAccountUserId();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const [sessionReady, setSessionReady] = useState(false);

  // ProjectListProvider mounts above AuthGate — wait for Clerk JWT in storage before
  // workspace/member API calls, or web loads an empty personal list and never retries.
  useEffect(() => {
    setWorkspaceClerkTokenGetter(isSignedIn ? () => getToken() : null);
    return () => setWorkspaceClerkTokenGetter(null);
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded) {
      setSessionReady(false);
      return;
    }
    if (!isSignedIn) {
      setSessionReady(true);
      return;
    }
    if (!userId) {
      setSessionReady(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const token = await getToken();
          if (token) {
            const email =
              user?.primaryEmailAddress?.emailAddress ||
              user?.emailAddresses?.[0]?.emailAddress ||
              null;
            await syncClerkTokenToAsyncStorage(token, email);
            if (!cancelled) setSessionReady(true);
            return;
          }
        } catch {
          /* retry until Clerk session token is ready */
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!cancelled) setSessionReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, getToken, user]);

  const accountReady = clerkUserReady && sessionReady;

  return (
    <ProjectListProviderCore accountUserId={userId} accountReady={accountReady}>
      {children}
    </ProjectListProviderCore>
  );
}

function ProjectListProviderLegacy({ children }: { children: ReactNode }) {
  const { userId, isReady } = useLegacyAccountUserId();
  return (
    <ProjectListProviderCore accountUserId={userId} accountReady={isReady}>
      {children}
    </ProjectListProviderCore>
  );
}

export const ProjectListProvider = ({ children }: { children: ReactNode }) => {
  const clerkEnabled = useClerkUiEnabled();
  if (clerkEnabled) {
    return <ProjectListProviderClerk>{children}</ProjectListProviderClerk>;
  }
  return <ProjectListProviderLegacy>{children}</ProjectListProviderLegacy>;
};

export const useProjectList = () => {
  const context = useContext(ProjectListContext);
  if (!context)
    throw new Error('useProjectList must be used within a ProjectListProvider');
  return context;
};
