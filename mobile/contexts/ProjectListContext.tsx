import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { UNIFIED_PROJECTS_STORAGE_KEY } from '../lib/projectListCache';

const STORAGE_KEY = UNIFIED_PROJECTS_STORAGE_KEY;

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
  
  // Estimate data (if from estimates page)
  estimateData?: any;
  
  // Project data (if converted to project)
  projectData?: any;
  projectType?: string;
  expenses?: any[];
  changeOrders?: any[];
  purchaseOrders?: any[];
  squareFootage?: number;
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
      try {
        const projectDataKey = `bps.project.${project.id}`;
        const projectDataRaw = await AsyncStorage.getItem(projectDataKey);
        if (projectDataRaw) {
          const projectData = JSON.parse(projectDataRaw);
          return {
            ...project,
            projectData: {
              ...project.projectData,
              ...projectData,
            },
          };
        }
      } catch (e) {
        if (__DEV__) {
          console.warn(`Failed to load projectData for ${project.id}:`, e);
        }
      }
      return project;
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
  const bidPrice = firstPositiveNumber(
    project?.bidPrice,
    project?.projectData?.bidPrice,
    project?.estimateData?.bidPrice,
    project?.totalBudget,
    project?.total,
    project?.totalRevenue
  );
  const estimatedCost = firstPositiveNumber(
    project?.estimatedCost,
    project?.projectData?.estimatedCost,
    project?.estimateData?.estimatedCost,
    project?.totalBudget,
    bidPrice
  );
  const margin = typeof project?.margin === 'number'
    ? project.margin
    : bidPrice > 0
      ? ((bidPrice - estimatedCost) / bidPrice) * 100
      : 0;
  const markup = typeof project?.markup === 'number'
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
    estimateData: project?.estimateData,
    projectData: project?.projectData,
    projectType: project?.projectType || project?.projectData?.projectType || title,
  };
};

const listBackendProjects = async (): Promise<any[]> => {
  const projectsResponse: any = await apiService.getProjects();
  const backendProjects = Array.isArray(projectsResponse)
    ? projectsResponse
    : Array.isArray(projectsResponse?.data)
      ? projectsResponse.data
      : [];
  return backendProjects;
};

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

export const ProjectListProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasAttemptedBackendSeedRef = useRef(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Save to AsyncStorage whenever projects change (but only after initial load)
  useEffect(() => {
    if (!isHydrated || !hasLoadedOnce) return;
    // Only save if we have projects OR if we're explicitly updating (not initial empty state)
    saveProjects();
  }, [projects, isHydrated, hasLoadedOnce]);

  const loadProjects = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: UnifiedProject[] = JSON.parse(saved);

        const hydratedProjects = await hydrateProjectDataFromStorageKeys(parsed);
        const normalized = dedupeProjectsById(
          await applyProgressAndDatesFromStorage(hydratedProjects)
        );

        // If we already have local projects, trust local first for offline reliability.
        if (normalized.length > 0) {
          setProjects(normalized);
          setIsHydrated(true);
          setHasLoadedOnce(true);

          // One-way seed: if backend is empty but local device has real data,
          // push local projects so other devices/simulators can hydrate the same dataset.
          if (!hasAttemptedBackendSeedRef.current) {
            hasAttemptedBackendSeedRef.current = true;
            void (async () => {
              try {
                const backendProjects = await listBackendProjects();
                if (backendProjects.length > 0) return;

                let created = 0;
                for (const localProject of normalized) {
                  const payload = toBackendCreatePayload(localProject);
                  if (!payload.name || !payload.client) continue;
                  await apiService.createProject(payload);
                  created += 1;
                }

                if (__DEV__) {
                  console.log(`✅ Seeded backend with ${created} local projects`);
                }
              } catch (seedError) {
                if (__DEV__) {
                  console.log('ℹ️ Backend seed skipped (auth/network/backend not ready)');
                }
              }
            })();
          }
          return;
        }
      } else {
        if (__DEV__) {
          console.log('ℹ️ No local project cache found, attempting backend hydration');
        }
      }

      // Local storage is empty (or empty array) - try to hydrate from backend so
      // simulator and physical device can converge on shared server data.
      try {
        const backendProjects = await listBackendProjects();
        const mapped = backendProjects.map(mapBackendProjectToUnified);
        const withKeys = await hydrateProjectDataFromStorageKeys(mapped);
        const deduped = dedupeProjectsById(await applyProgressAndDatesFromStorage(withKeys));
        setProjects(deduped);
        if (__DEV__) {
          console.log(`✅ Hydrated ${deduped.length} projects from backend`);
        }
      } catch (backendError) {
        if (__DEV__) {
          console.log('ℹ️ Backend hydration unavailable, using local empty state');
        }
        setProjects([]);
      }

      setIsHydrated(true);
      setHasLoadedOnce(true);
    } catch (error) {
      console.error('Error loading projects:', error);
      // On error, keep existing projects if any, but mark as hydrated
      setIsHydrated(true);
      setHasLoadedOnce(true);
    }
  };

  const saveProjects = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (error) {
      console.error('Error saving projects:', error);
    }
  };

  // Filtered lists
  const estimates = projects.filter(p => {
    const status = normalizeStatus(p.status);
    return status === 'estimate' || status === 'bid_submitted';
  });
  const activeProjects = projects.filter(p => {
    const status = normalizeStatus(p.status);
    return (
      status === 'won' ||
      status === 'in_progress' ||
      status === 'in-progress' ||
      status === 'active' ||
      status === 'completed' ||
      status === 'complete'
    );
  });
  const wonProjects = projects.filter(p => {
    const status = normalizeStatus(p.status);
    return status === 'won' || status === 'completed';
  });

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
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextProjects));
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

  // Delete project
  const deleteProject = async (projectId: string) => {
    let filtered: UnifiedProject[] = [];
    setProjects(prev => {
      filtered = prev.filter(p => p.id !== projectId);
      return filtered;
    });
    // Await save before returning so useFocusEffect/refreshProjects won't overwrite
    // with stale AsyncStorage data when the Alert dismisses on iOS
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      if (__DEV__) console.log(`💾 Saved deleted project state to AsyncStorage`);
    } catch (error) {
      console.error('Error saving deleted project:', error);
    }
  };

  // Calculate dashboard metrics
  const dashboardMetrics = {
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
    pendingBidsCount: estimates.filter(p => p.status === 'bid_submitted').length,
  };

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

        return { ...next, updatedAt: new Date().toISOString() };
      })
    );
  };

  const refreshProjects = async () => {
    try {
      const backendProjects = await listBackendProjects();
      const mapped = backendProjects.map(mapBackendProjectToUnified);
      const withKeys = await hydrateProjectDataFromStorageKeys(mapped);
      const fromServer = dedupeProjectsById(
        await applyProgressAndDatesFromStorage(withKeys)
      );

      setProjects((prev) => {
        const backendIds = new Set(
          fromServer.map((p) => normalizeProjectId(p.id)).filter(Boolean)
        );

        // Server rows often stay won/in_progress after the user finishes payments in-app (timeline-only).
        // Without this, refresh overwrites local status: 'completed' and the project vanishes from Completed.
        const mergedFromServer = fromServer.map((serverP) => {
          const id = normalizeProjectId(serverP.id);
          if (!id) return serverP;
          const localP = prev.find((p) => normalizeProjectId(p.id) === id);
          if (!localP) return serverP;
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
            };
          }
          return serverP;
        });

        const localDrafts = prev.filter((p) => {
          const id = normalizeProjectId(p.id);
          if (!id || backendIds.has(id)) return false;
          const st = normalizeStatus(p.status);
          // Keep drafts/estimates, submitted bids, active/won work, and completed jobs not on the server yet.
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
      });

      setIsHydrated(true);
      setHasLoadedOnce(true);
      if (__DEV__) {
        console.log(
          '🔄 Projects refreshed from backend (local draft/estimate rows kept if not on server)'
        );
      }
    } catch (e) {
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
      }}
    >
      {children}
    </ProjectListContext.Provider>
  );
};

export const useProjectList = () => {
  const context = useContext(ProjectListContext);
  if (!context)
    throw new Error('useProjectList must be used within a ProjectListProvider');
  return context;
};
