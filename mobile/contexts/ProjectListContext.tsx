import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Unified Project interface that combines Estimates, Projects, and Dashboard data
export interface UnifiedProject {
  id: string;
  title: string;
  
  // Status lifecycle
  status: 'estimate' | 'bid_submitted' | 'won' | 'in_progress' | 'completed' | 'lost';
  
  // Financial data
  estimatedCost: number;
  bidPrice: number;
  actualCost?: number;
  margin: number;
  markup: number;
  
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
  paymentSchedule?: string;
  
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
}

interface ProjectListContextType {
  projects: UnifiedProject[];

  // Estimates
  estimates: UnifiedProject[];
  addEstimate: (estimate: UnifiedProject) => void;

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
}

const STORAGE_KEY = 'bps.unifiedProjects.v1';

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

export const ProjectListProvider = ({ children }: { children: ReactNode }) => {
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

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
        const normalized = parsed.map((project) => {
          const progressValue =
            project.overallProgressPct ??
            project.progress ??
            0;
          const statusSlug = normalizeStatus(project.status);
          let nextStatus = project.status;
          if (progressValue >= 100 && statusSlug !== 'lost') {
            nextStatus = 'completed';
          }
          const projectTypeCandidate =
            project.projectType ||
            project?.estimateData?.projectType ||
            project?.estimateData?.category ||
            project?.projectData?.projectType ||
            project?.projectData?.type ||
            project?.title;

          // DISABLED: Auto-fix logic that was incorrectly modifying project amounts
          // This was causing project amounts to change on every app load
          // If we need to fix corrupted data, do it manually or with a one-time migration script
          let fixedProject = {
            ...project,
            status: nextStatus,
            progress: project.progress ?? progressValue,
            overallProgressPct: project.overallProgressPct ?? progressValue,
            projectType: projectTypeCandidate,
          };

          // DISABLED: Special handling for Nick's project - was incorrectly resetting amounts
          // This auto-fix logic was causing project amounts to drop on every app load
          // Only fix if there's actual corruption (values > 1,000,000), not normal amounts
          // if (fixedProject.title?.toLowerCase().includes('nick') && fixedProject.estimateData) {
          //   const materialsTotal = fixedProject.estimateData.materials || 0;
          //   const bidPrice = fixedProject.bidPrice || 0;
          //   const estimatedCost = fixedProject.estimatedCost || 0;
          //   const hasCorruptedMaterials = materialsTotal > 1000000 || 
          //     bidPrice > 1000000 || 
          //     estimatedCost > 1000000 ||
          //     (fixedProject.estimateData.materialLineItems?.some((item: any) => {
          //       const total = Number(item.total) || Number(item.cost) || 0;
          //       return total > 1000000;
          //     })) ||
          //     (fixedProject.projectData?.buckets?.some((b: any) => {
          //       return (b.name === 'Materials/Equipment' || b.id === '2') && (b.budget > 1000000 || b.bidBudget > 1000000);
          //     }));
          //
          //   if (hasCorruptedMaterials) {
          //     // ... auto-fix logic disabled
          //   }
          // }

          return fixedProject;
        });

        setProjects(normalized);
        setIsHydrated(true);
        setHasLoadedOnce(true);
      } else {
        // No saved data - set empty array and mark as hydrated
        setProjects([]);
        setIsHydrated(true);
        setHasLoadedOnce(true);
      }
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
      status === 'completed'
    );
  });
  const wonProjects = projects.filter(p => {
    const status = normalizeStatus(p.status);
    return status === 'won' || status === 'completed';
  });

  // Add estimate from Estimates page
  const addEstimate = (estimate: UnifiedProject) => {
    setProjects(prev => {
      // Check if estimate already exists to prevent duplicates
      const existingIndex = prev.findIndex(p => p.id === estimate.id);
      if (existingIndex !== -1) {
        console.log(`⚠️ Estimate ${estimate.id} already exists, updating instead of adding`);
        console.log(`💰 Updating bidPrice: ${prev[existingIndex].bidPrice} -> ${estimate.bidPrice}`);
        console.log(`💰 Updating estimatedCost: ${prev[existingIndex].estimatedCost} -> ${estimate.estimatedCost}`);
        // Preserve the status from the estimate if provided, otherwise keep existing status
        // CRITICAL: Always update bidPrice and estimatedCost from the new estimate (they're the source of truth)
        // If estimate has bidPrice/estimatedCost, always use them (even if 0, as long as they're provided)
        return prev.map((p, index) => 
          index === existingIndex 
            ? { 
                ...p, 
                ...estimate, 
                // CRITICAL: Always update bidPrice and estimatedCost from estimate if they exist
                // Use estimate values if provided (even if they're different), otherwise keep existing
                bidPrice: estimate.bidPrice !== undefined && estimate.bidPrice !== null 
                  ? estimate.bidPrice 
                  : p.bidPrice,
                estimatedCost: estimate.estimatedCost !== undefined && estimate.estimatedCost !== null
                  ? estimate.estimatedCost
                  : p.estimatedCost,
                status: estimate.status || p.status, // Use provided status or keep existing
                updatedAt: new Date().toISOString() 
              }
            : p
        );
      }
      
      console.log(`✅ Adding new estimate: ${estimate.id} with status: ${estimate.status || 'estimate'}`);
      console.log(`💰 New estimate bidPrice: ${estimate.bidPrice}, estimatedCost: ${estimate.estimatedCost}`);
      return [
        {
          ...estimate,
          status: estimate.status || 'estimate', // Use provided status or default to 'estimate'
          createdAt: estimate.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev
      ];
    });
  };

  // Convert won bid to active project
  const convertBidToProject = (bidId: string) => {
    setProjects(prev => {
      const found = prev.find(p => p.id === bidId);
      console.log(`🔍 [convertBidToProject] Looking for bid ${bidId} in ${prev.length} projects`);
      console.log(`🔍 [convertBidToProject] Available project IDs:`, prev.map(p => `${p.id} (${p.status})`));
      
      if (!found) {
        console.log(`⚠️ [convertBidToProject] Bid ${bidId} not found in projects. This might be a new bid that hasn't been saved yet.`);
        console.log(`💡 [convertBidToProject] Tip: Make sure to save the estimate first, or it will be created with status 'in_progress'`);
        return prev; // Return unchanged if not found
      }
      
      console.log(`✅ [convertBidToProject] Found bid ${bidId} with status: ${found.status}`);
      
      // Check if any project matches and update it
      let updated = false;
      const updatedProjects = prev.map(p => {
        if (p.id === bidId) {
          // Convert from any valid status (estimate, bid_submitted, or in_progress) to 'won' (Active)
          console.log(`🔄 [convertBidToProject] Converting bid ${bidId} from '${p.status}' to 'won'`);
          updated = true;
          const updatedProject = {
            ...p,
            status: 'won' as const, // Set to 'won' so it shows as "Active" in projects
            updatedAt: new Date().toISOString(),
          };
          console.log(`✅ [convertBidToProject] Updated project:`, {
            id: updatedProject.id,
            title: updatedProject.title,
            status: updatedProject.status
          });
          return updatedProject;
        }
        return p;
      });
      
      if (!updated) {
        console.log(`⚠️ [convertBidToProject] Could not update bid ${bidId} - matching project not found in map`);
      } else {
        console.log(`✅ [convertBidToProject] Successfully updated ${updatedProjects.length} projects. Updated bid ${bidId} status to 'won'`);
      }
      
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
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== projectId);
      console.log(`🗑️ Deleted project ${projectId}. Remaining projects: ${filtered.length}`);
      // Immediately save to AsyncStorage to ensure persistence
      const saveDeleted = async () => {
        try {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
          console.log(`💾 Saved deleted project state to AsyncStorage`);
        } catch (error) {
          console.error('Error saving deleted project:', error);
        }
      };
      saveDeleted();
      return filtered;
    });
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

  if (__DEV__) {
    console.log(
      '📊 Dashboard revenue breakdown',
      activeProjects.map((project) => {
        const detail = resolveProjectRevenueDetail(project);
        return {
          id: project.id,
          title: project.title,
          status: project.status,
          revenueSelected: detail.value,
          source: detail.source,
          candidates: detail.breakdown,
        };
      })
    );
  }

  // Generic operations
  const getProjectById = (id: string) => {
    const project = projects.find(p => p.id === id);
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
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== id) return p;

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

        // Deep merge projectData if it exists in updates, ensuring expenses array is properly replaced
        let finalProjectData = p.projectData;
        if (updates.projectData) {
          finalProjectData = {
            ...(p.projectData || {}),
            ...updates.projectData,
            // CRITICAL: If expenses is in updates.projectData, use it directly (don't merge arrays)
            expenses: updates.projectData.expenses !== undefined
              ? updates.projectData.expenses  // Use the new expenses array (even if empty)
              : (p.projectData?.expenses || []), // Only fallback if not provided
          };
          console.log('🔄 updateProject: expenses count in finalProjectData:', finalProjectData.expenses?.length || 0);
        }

        const next: UnifiedProject = {
          ...p,
          ...updates,
          // Use the properly merged projectData
          ...(finalProjectData ? { projectData: finalProjectData } : {}),
        };

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
          next.progress = updates.progress ?? next.progress ?? progressValue;
          next.overallProgressPct = updates.overallProgressPct ?? progressValue;
          const statusSlug = normalizeStatus(next.status);
          if (progressValue >= 100 && statusSlug !== 'lost') {
            next.status = 'completed';
          } else if (progressValue < 100 && statusSlug === 'completed') {
            next.status = 'in_progress';
          }
        }

        return { ...next, updatedAt: new Date().toISOString() };
      })
    );
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
