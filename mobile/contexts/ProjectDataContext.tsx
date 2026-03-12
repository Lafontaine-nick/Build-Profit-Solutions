import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProjectOverview } from '../components/OverviewScreen';
import { useProjectList } from './ProjectListContext';
import { pmEventTracker } from '@/hooks/usePMEventReactions';

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  vendor: string;
  category: string;
  amount: number;
  description?: string;
  orderDate: string;
  expectedDelivery: string;
  status: 'Pending' | 'Received' | 'Cancelled' | 'Archived';
  notes?: string;
};

interface ProjectDataContextType {
  addExpense: (expense: {
    id: string;
    category?: string;
    vendor?: string;
    amount: number;
    date?: string;
    notes?: string;
    receiptUri?: string | null;
  }) => void;
  deleteExpense: (expenseId: string) => void;
  clearAllExpenses: () => void;
  updateExpense: (expense: {
    id: string;
    category?: string;
    vendor?: string;
    amount: number;
    date?: string;
    notes?: string;
  }) => void;
  addPurchaseOrder: (po: Omit<PurchaseOrder, 'id'>) => void;
  updatePurchaseOrder: (po: PurchaseOrder) => void;
  markPOReceived: (poId: string) => void;
  cancelPO: (poId: string) => void;
  archivePO: (poId: string) => void;
  addChangeOrder: (changeOrder: {
    id: string;
    title?: string;
    amount: number;
    approved: boolean;
    notes?: string;
    materialsAmount?: number;
    laborAmount?: number;
    status?: string;
  }) => void;
  updateChangeOrder: (changeOrder: {
    id: string;
    title?: string;
    amount: number;
    approved: boolean;
    notes?: string;
    materialsAmount?: number;
    laborAmount?: number;
    status?: string;
  }) => void;
  deleteChangeOrder: (changeOrderId: string) => void;
  approveChangeOrder: (changeOrderId: string) => void;
  projectData: ProjectOverview;
  updateBudget: (budgeted: number, spent: number) => void;
  updateTimeline: (
    startDate: string,
    endDate: string,
    progress: number
  ) => void;
  updateTeam: (
    pmAssigned: boolean,
    pmName?: string,
    crewCount?: number,
    crewMembers?: string[],
    crewMemberPhones?: Record<string, string>
  ) => void;
  addMessage: (message: string, sender: string) => void;
  updateStatus: (status: string) => void;
  updateHealth: (health: {
    costEfficiency: string;
    scheduleEfficiency: string;
    projectStatus: string;
  }) => void;
  resetProjectData: () => void;
  reloadFromStorage: () => Promise<void>;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(
  undefined
);

// Initial demo data
const initialProjectData: ProjectOverview = {
  id: '1',
  title: 'Main St Remodel',
  status: 'In Progress',
  priority: 'High',
  risk: 'Medium Risk',
  overallProgressPct: 0,
  budgeted: 45000,
  spent: 0,
  startISO: '2024-01-15T00:00:00.000Z',
  endISO: '2024-06-15T00:00:00.000Z',
  crewCount: 8,
  lastUpdated: new Date().toISOString(),
  buckets: [
    { id: '1', name: 'Materials', spent: 0, budget: 20000, bidBudget: 18000 },
    { id: '2', name: 'Labor', spent: 0, budget: 18000, bidBudget: 16000 },
    { id: '3', name: 'Equipment', spent: 0, budget: 7000, bidBudget: 6000 },
  ],
  milestones: [
    {
      id: '1',
      name: 'Foundation Complete',
      dateISO: '2024-02-15T00:00:00.000Z',
    },
    { id: '2', name: 'Framing Complete', dateISO: '2024-03-30T00:00:00.000Z' },
    { id: '3', name: 'Final Inspection', dateISO: '2024-06-15T00:00:00.000Z' },
  ],
  team: {
    pmAssigned: true,
    pmName: 'Sarah Johnson',
  },
  expenses: [],
  changeOrders: [],
  purchaseOrders: [],
  committedPOs: 0,
  currency: 'USD',
  health: {
    costEfficiency: 'good',
    scheduleEfficiency: 'fair',
    projectStatus: 'on track',
  },
};

interface ProjectDataProviderProps {
  children: ReactNode;
  projectId?: string;
}

export function ProjectDataProvider({ children, projectId }: ProjectDataProviderProps) {
  // Initialize with project-specific data based on ID
  const getInitialProjectData = (id?: string): ProjectOverview => {
    // Helper to scale buckets proportionally to total budget
    const scaleBuckets = (totalBudget: number) => {
      const ratio = totalBudget / 45000; // Base ratio from Main St Remodel
      return [
        { id: '1', name: 'Materials', spent: 0, budget: Math.round(20000 * ratio), bidBudget: Math.round(18000 * ratio) },
        { id: '2', name: 'Labor', spent: 0, budget: Math.round(18000 * ratio), bidBudget: Math.round(16000 * ratio) },
        { id: '3', name: 'Equipment', spent: 0, budget: Math.round(7000 * ratio), bidBudget: Math.round(6000 * ratio) },
      ];
    };

    // Map of projects by ID
    const projects: Record<string, ProjectOverview> = {
      '1': {
        ...initialProjectData,
        id: '1',
        title: 'Main St Remodel',
        budgeted: 45000,
        buckets: scaleBuckets(45000),
      },
      '2': {
        ...initialProjectData,
        id: '2',
        title: 'Elm Ave New Build',
        budgeted: 125000,
        status: 'Planning',
        priority: 'Medium',
        buckets: scaleBuckets(125000),
      },
      '3': {
        ...initialProjectData,
        id: '3',
        title: 'Kitchen Renovation',
        budgeted: 28000,
        status: 'Planning',
        priority: 'Medium',
        buckets: scaleBuckets(28000),
      },
    };

    return projects[id || '1'] || { ...initialProjectData, id: id || '1' };
  };

  const [projectData, setProjectData] =
    useState<ProjectOverview>(getInitialProjectData(projectId));
  const [isLoaded, setIsLoaded] = useState(false);
  const { updateProject, getProjectById } = useProjectList();
  // Track last save to prevent race conditions with useEffect
  const lastSaveRef = useRef<{ purchaseOrdersCount: number; timestamp: number }>({ purchaseOrdersCount: 0, timestamp: 0 });

  const syncProjectList = useCallback(
    (next: ProjectOverview) => {
      if (!next?.id) return;

      try {
        const unified = getProjectById(next.id);
        if (!unified) return;

        const nextSpent = Number(next.spent || 0);
        const existingProjectData = unified.projectData ?? {};

        // CRITICAL: Always use the expenses from `next` if it exists
        // Don't merge with existingProjectData.expenses because that might be stale
        // The `next` object is the source of truth from ProjectDataContext
        // IMPORTANT: Check if expenses property exists in next object (not just if it's an array)
        // Empty arrays are valid and should be used (don't use || [] which would replace empty with fallback)
        const hasExpensesProperty = 'expenses' in next;
        let nextExpenses: any[] = [];
        
        if (hasExpensesProperty) {
          // If expenses property exists, use it (even if it's an empty array)
          if (Array.isArray(next.expenses)) {
            nextExpenses = next.expenses;
          } else {
            // If it's not an array, default to empty
            nextExpenses = [];
          }
        } else {
          // If expenses property doesn't exist in next, use existing data
          nextExpenses = existingProjectData.expenses || [];
        }
        
        // CRITICAL: Preserve materialsAmount and laborAmount in change orders
        // When syncing, ensure change orders from 'next' are used if they exist
        // Otherwise fall back to existing, but always preserve the full change order objects
        const changeOrdersToUse = next.changeOrders && next.changeOrders.length > 0 
          ? next.changeOrders 
          : (existingProjectData.changeOrders || []);
        
        // Debug: Log change orders with materials/labor breakdown
        changeOrdersToUse.forEach((co: any) => {
          if (co.materialsAmount || co.laborAmount) {
            console.log('🔄 syncProjectList: Change order with breakdown:', {
              id: co.id,
              title: co.title,
              materialsAmount: co.materialsAmount,
              laborAmount: co.laborAmount,
            });
          }
        });
        
        const mergedProjectData = {
          ...existingProjectData,
          ...next, // This spreads all properties from next
          spent: nextSpent,
          budgeted: next.budgeted,
          // Explicitly set expenses to ensure it's always an array
          expenses: nextExpenses,
          buckets: next.buckets || existingProjectData.buckets,
          changeOrders: changeOrdersToUse, // Use the preserved change orders
          purchaseOrders: next.purchaseOrders || existingProjectData.purchaseOrders || [],
          committedPOs: next.committedPOs || 0,
        };
        
        console.log('🔄 syncProjectList: hasExpensesProperty:', hasExpensesProperty, 'next.expenses count:', next.expenses?.length || 0, 'merged count:', mergedProjectData.expenses?.length || 0);
        console.log('🔄 syncProjectList: next.expenses IDs:', next.expenses?.map((e: any) => e.id) || []);
        console.log('🔄 syncProjectList: purchaseOrders:', {
          nextPOs: next.purchaseOrders?.length || 0,
          existingPOs: existingProjectData.purchaseOrders?.length || 0,
          mergedPOs: mergedProjectData.purchaseOrders?.length || 0,
          nextCommittedPOs: next.committedPOs || 0,
          mergedCommittedPOs: mergedProjectData.committedPOs || 0,
          nextPOsList: next.purchaseOrders?.map((po: any) => ({ id: po.id, poNumber: po.poNumber, amount: po.amount, status: po.status })) || []
        });

        updateProject(next.id, {
          projectData: mergedProjectData,
          actualCost: nextSpent,
          estimatedCost: Number(
            next.budgeted ??
              (existingProjectData as any)?.budgeted ??
              unified.estimatedCost ??
              nextSpent
          ),
        });
      } catch (error) {
        console.error('ProjectDataContext: failed to sync project list', error);
      }
    },
    [getProjectById, updateProject]
  );

  // Track if we're currently syncing to prevent infinite loops
  const isSyncingRef = useRef(false);
  
  const replaceProjectDataState = useCallback(
    (next: ProjectOverview) => {
      if (!next) return;
      
      // Prevent infinite loop: if we're already syncing, don't sync again
      if (isSyncingRef.current) {
        console.log('⏭️ Skipping syncProjectList - already syncing (preventing infinite loop)');
        setProjectData(next);
        return;
      }
      
      isSyncingRef.current = true;
      try {
        syncProjectList(next);
        setProjectData(next);
      } finally {
        // Reset the flag after a short delay to allow the sync to complete
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      }
    },
    [syncProjectList]
  );

  const applyProjectDataUpdate = useCallback(
    (updater: (prev: ProjectOverview) => ProjectOverview) => {
      setProjectData(prev => {
        const next = updater(prev);
        console.log('🔄 applyProjectDataUpdate: expenses count:', next.expenses?.length || 0);
        console.log('🔄 applyProjectDataUpdate: expense IDs:', next.expenses?.map(e => e.id) || []);
        
        // Sync immediately (no delay) to ensure data consistency
        // The syncProjectList function now properly handles the expenses array
        // Use requestAnimationFrame to avoid "Cannot update component during render" errors
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            try {
              syncProjectList(next);
            } catch (error) {
              console.error('Error syncing to project list:', error);
            }
          });
        } else {
          setTimeout(() => {
            try {
              syncProjectList(next);
            } catch (error) {
              console.error('Error syncing to project list:', error);
            }
          }, 0);
        }
        
        return next;
      });
    },
    [syncProjectList]
  );

  // Load saved data from AsyncStorage on mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const key = `bps.project.${projectId || '1'}`;
        const saved = await AsyncStorage.getItem(key);
        
        if (saved) {
          const parsedData = JSON.parse(saved);
          
          // Debug: Log change orders with materials/labor breakdown
          if (parsedData.changeOrders && parsedData.changeOrders.length > 0) {
            parsedData.changeOrders.forEach((co: any) => {
              if (co.materialsAmount || co.laborAmount) {
                console.log('📦 Loaded change order from AsyncStorage:', {
                  id: co.id,
                  title: co.title,
                  materialsAmount: co.materialsAmount,
                  laborAmount: co.laborAmount,
                  fullCo: co,
                });
              }
            });
          }
          
          replaceProjectDataState(parsedData);
        } else {
          // No saved data, use initial
          const initial = getInitialProjectData(projectId);
          replaceProjectDataState(initial);
        }
      } catch (error) {
        console.error('Error loading project data:', error);
        replaceProjectDataState(getInitialProjectData(projectId));
      } finally {
        setIsLoaded(true);
      }
    };

    loadSavedData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Save to AsyncStorage whenever projectData changes (after initial load)
  // BUT: Skip if purchaseOrders just changed (addPurchaseOrder already saved it)
  useEffect(() => {
    if (!isLoaded) return; // Don't save during initial load
    
    const currentPOCount = (projectData.purchaseOrders || []).length;
    const lastPOCount = lastSaveRef.current.purchaseOrdersCount;
    const timeSinceLastSave = Date.now() - lastSaveRef.current.timestamp;
    
    // If purchase orders just changed (within last 2 seconds), skip this save
    // because addPurchaseOrder/cancelPO/updatePurchaseOrder already saved it immediately
    if (currentPOCount !== lastPOCount && timeSinceLastSave < 2000) {
      console.log('⏭️ Skipping save - purchase order was just modified (already saved by PO operation)');
      lastSaveRef.current = { purchaseOrdersCount: currentPOCount, timestamp: Date.now() };
      return;
    }
    
    const saveData = async () => {
      try {
        const key = `bps.project.${projectData.id}`;
        const dataToSave = {
          ...projectData,
          // Ensure expenses is always an array (never undefined)
          expenses: projectData.expenses || [],
          // Ensure purchase orders is always an array (never undefined)
          purchaseOrders: projectData.purchaseOrders || [],
          // Ensure committedPOs is set
          committedPOs: projectData.committedPOs || 0,
        };
        await AsyncStorage.setItem(key, JSON.stringify(dataToSave));
        console.log('💾 Saved to AsyncStorage:', {
          expensesCount: dataToSave.expenses.length,
          purchaseOrdersCount: dataToSave.purchaseOrders.length,
          committedPOs: dataToSave.committedPOs,
          pendingPOs: dataToSave.purchaseOrders.filter((po: any) => po.status === 'Pending').length
        });
        lastSaveRef.current = { purchaseOrdersCount: currentPOCount, timestamp: Date.now() };
      } catch (error) {
        console.error('Error saving project data:', error);
      }
    };

    saveData();
  }, [projectData, isLoaded]);

  const updateBudget = (budgeted: number, spent: number) => {
    // Calculate margin impact
    const prevBudgeted = projectData.budgeted || 0;
    const prevSpent = projectData.spent || 0;
    const prevMargin = prevBudgeted > 0 ? ((prevBudgeted - prevSpent) / prevBudgeted) * 100 : 0;
    const newMargin = budgeted > 0 ? ((budgeted - spent) / budgeted) * 100 : 0;
    const marginImpact = newMargin - prevMargin;

    // Emit PM event for cost edit
    if (Math.abs(budgeted - prevBudgeted) > 100 || Math.abs(marginImpact) > 1) {
      pmEventTracker.emit({
        type: 'cost_edit',
        projectId: projectId,
        projectName: projectData?.title,
        data: {
          previousValue: prevBudgeted,
          newValue: budgeted,
          marginImpact,
        },
        timestamp: Date.now(),
      });
    }

    applyProjectDataUpdate(prev => ({
      ...prev,
      budgeted,
      spent,
      overallProgressPct:
        budgeted > 0 ? Math.round((spent / budgeted) * 100) : prev.overallProgressPct,
      lastUpdated: new Date().toISOString(),
    }));
  };

  const updateTimeline = (
    startDate: string,
    endDate: string,
    progress: number
  ) => {
    // Calculate schedule impact
    const prevStart = projectData.startISO;
    const prevEnd = projectData.endISO;
    const prevDuration = prevStart && prevEnd
      ? (new Date(prevEnd).getTime() - new Date(prevStart).getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const newDuration = startDate && endDate
      ? (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    const scheduleImpact = newDuration - prevDuration;

    // Emit PM event for schedule change
    if (Math.abs(scheduleImpact) > 1) {
      pmEventTracker.emit({
        type: 'schedule_change',
        projectId: projectId,
        projectName: projectData?.title,
        data: {
          previousValue: { startDate: prevStart, endDate: prevEnd },
          newValue: { startDate, endDate },
          scheduleImpact,
        },
        timestamp: Date.now(),
      });
    }

    applyProjectDataUpdate(prev => ({
      ...prev,
      startISO: startDate,
      endISO: endDate,
      overallProgressPct: progress,
      lastUpdated: new Date().toISOString(),
    }));
  };

  const updateTeam = (
    pmAssigned: boolean,
    pmName?: string,
    crewCount?: number,
    crewMembers?: string[],
    crewMemberPhones?: Record<string, string>
  ) => {
    applyProjectDataUpdate(prev => {
      const prevTeam = prev.team as { pmName?: string; crewMembers?: string[]; crewMemberPhones?: Record<string, string> } | undefined;
      const nextCrewMembers = crewMembers !== undefined ? crewMembers : (prevTeam?.crewMembers ?? []);
      const nextCrewPhones = crewMemberPhones !== undefined
        ? crewMemberPhones
        : { ...(prevTeam?.crewMemberPhones ?? {}) };
      return {
        ...prev,
        team: {
          pmAssigned,
          pmName: pmName ?? prevTeam?.pmName ?? '',
          crewMembers: nextCrewMembers,
          crewMemberPhones: nextCrewPhones,
        },
        crewCount: crewCount !== undefined ? crewCount : nextCrewMembers.length,
        lastUpdated: new Date().toISOString(),
      };
    });
  };

  const addMessage = (message: string, sender: string) => {
    // For now, we'll just update the lastUpdated timestamp
    // In a real app, you'd store messages in the project data
    applyProjectDataUpdate(prev => ({
      ...prev,
      lastUpdated: new Date().toISOString(),
    }));
  };

  const updateStatus = (status: string) => {
    // Emit PM event for phase transition
    if (projectData.status !== status) {
      pmEventTracker.emit({
        type: 'phase_transition',
        projectId: projectId,
        projectName: projectData?.title,
        data: {
          previousValue: projectData.status,
          newValue: status,
        },
        timestamp: Date.now(),
      });
    }

    applyProjectDataUpdate(prev => ({
      ...prev,
      status,
      lastUpdated: new Date().toISOString(),
    }));
  };

  const addExpense = (expense: {
    id: string;
    category?: string;
    vendor?: string;
    amount: number;
    date?: string;
    notes?: string;
    receiptUri?: string | null;
  }) => {
    // Emit PM event for expense added
    pmEventTracker.emit({
      type: 'expense_added',
      projectId: projectId,
      projectName: projectData?.title,
      data: {
        amount: expense.amount,
        category: expense.category,
        vendor: expense.vendor,
      },
      timestamp: Date.now(),
    });

    applyProjectDataUpdate(prev => {
      // Find the matching budget bucket based on category
      // Match flexibly: "Materials/Equipment" matches "Materials" or "Materials/Equipment"
      // Also match specific material names (Tile, Drywall, Lumber, etc.) to Materials/Equipment
      const updatedBuckets = prev.buckets.map(bucket => {
        if (expense.category) {
          const bucketName = bucket.name.toLowerCase();
          const expenseCategory = expense.category.toLowerCase();
          
          // Exact match
          if (bucketName === expenseCategory) {
            return {
              ...bucket,
              spent: (bucket.spent || 0) + expense.amount,
            };
          }
          
          // Flexible match for Materials/Equipment
          // This includes specific material names (tile, drywall, lumber, concrete, etc.)
          const isMaterialsBucket = bucketName.includes('materials') || bucketName.includes('equipment');
          const isMaterialCategory = expenseCategory.includes('materials') || 
                                     expenseCategory.includes('equipment') ||
                                     // Common material names that should go to Materials/Equipment
                                     ['tile', 'drywall', 'lumber', 'concrete', 'paint', 'electrical', 
                                      'plumbing', 'hardware', 'roofing', 'insulation', 'flooring', 
                                      'cabinets', 'appliances', 'windows', 'doors', 'siding', 
                                      'decking', 'fencing', 'landscaping'].includes(expenseCategory);
          
          if (isMaterialsBucket && isMaterialCategory) {
            return {
              ...bucket,
              spent: (bucket.spent || 0) + expense.amount,
            };
          }
        }
        return bucket;
      });

      // If no matching category found, add to "Other" or create a new bucket
      let finalBuckets = updatedBuckets;
      const hasMatchingCategory =
        expense.category &&
        updatedBuckets.some(
          bucket => bucket.name.toLowerCase() === expense.category?.toLowerCase()
        );

      if (!hasMatchingCategory && expense.category) {
        finalBuckets = updatedBuckets.map((bucket, index) => {
          if (bucket.name.toLowerCase() === 'other' || index === 0) {
            return {
              ...bucket,
              spent: (bucket.spent || 0) + expense.amount,
            };
          }
          return bucket;
        });
      }

      return {
        ...prev,
        expenses: [...(prev.expenses || []), expense],
        buckets: finalBuckets,
        spent: prev.spent + expense.amount,
        lastUpdated: new Date().toISOString(),
      };
    });
  };

  const deleteExpense = (expenseId: string) => {
    console.log('🗑️ Deleting expense:', expenseId);
    console.log('🗑️ Current expenses count:', projectData.expenses?.length || 0);
    console.log('🗑️ Current expense IDs:', projectData.expenses?.map((e: any) => ({ id: e.id, vendor: e.vendor, category: e.category })) || []);
    
    applyProjectDataUpdate(prev => {
      console.log('🗑️ Searching for expense ID:', expenseId);
      console.log('🗑️ Available expense IDs:', prev.expenses?.map((e: any) => e.id) || []);
      
      const expenseToDelete = prev.expenses?.find((e: any) => e.id === expenseId);
      if (!expenseToDelete) {
        console.log('⚠️ Expense not found:', expenseId);
        console.log('⚠️ Available expenses:', prev.expenses?.map((e: any) => ({ id: e.id, vendor: e.vendor, category: e.category })) || []);
        return prev;
      }

      console.log('✅ Found expense to delete:', expenseToDelete);
      const updatedExpenses = (prev.expenses || []).filter((e: any) => e.id !== expenseId);
      console.log('📊 Expenses before:', prev.expenses?.length, 'after:', updatedExpenses.length);
      console.log('📊 Remaining expense IDs:', updatedExpenses.map((e: any) => e.id));

      // Flexible category matching (same as addExpense)
      const updatedBuckets = prev.buckets.map(bucket => {
        if (expenseToDelete.category) {
          const bucketName = bucket.name.toLowerCase();
          const expenseCategory = expenseToDelete.category.toLowerCase();
          
          // Exact match
          if (bucketName === expenseCategory) {
            return {
              ...bucket,
              spent: Math.max(0, (bucket.spent || 0) - expenseToDelete.amount),
            };
          }
          
          // Flexible match for Materials/Equipment
          if ((bucketName.includes('materials') || bucketName.includes('equipment')) &&
              (expenseCategory.includes('materials') || expenseCategory.includes('equipment'))) {
            return {
              ...bucket,
              spent: Math.max(0, (bucket.spent || 0) - expenseToDelete.amount),
            };
          }
          
          // Flexible match for Labor
          if (bucketName.includes('labor') && expenseCategory.includes('labor')) {
            return {
              ...bucket,
              spent: Math.max(0, (bucket.spent || 0) - expenseToDelete.amount),
            };
          }
        }
        return bucket;
      });

      const updated = {
        ...prev,
        expenses: updatedExpenses, // Ensure this is a new array reference (even if empty)
        buckets: updatedBuckets,
        spent: Math.max(0, prev.spent - expenseToDelete.amount),
        lastUpdated: new Date().toISOString(),
      };
      console.log('✅ Expense deleted, new expenses count:', updated.expenses.length);
      console.log('✅ Updated expenses array:', updated.expenses.map((e: any) => ({ id: e.id, vendor: e.vendor, amount: e.amount, category: e.category })));
      console.log('✅ Deleted expense category:', expenseToDelete.category, 'amount:', expenseToDelete.amount);
      console.log('✅ Updated buckets:', updatedBuckets.map((b: any) => ({ name: b.name, spent: b.spent })));
      console.log('✅ Deleted expense ID was:', expenseId);
      console.log('✅ Remaining expense IDs:', updatedExpenses.map((e: any) => e.id));
      
      // CRITICAL: Immediately save to AsyncStorage to prevent reloadFromStorage from overwriting
      // Do this asynchronously so it doesn't block the state update
      const key = `bps.project.${prev.id}`;
      AsyncStorage.setItem(key, JSON.stringify(updated)).then(() => {
        console.log('💾 Delete saved to AsyncStorage immediately');
      }).catch(err => {
        console.error('Error saving delete to AsyncStorage:', err);
      });
      
      return updated;
    });
  };

  const clearAllExpenses = () => {
    console.log('🗑️ Clearing ALL expenses');
    console.log('🗑️ Current expenses count:', projectData.expenses?.length || 0);
    console.log('🗑️ Current expenses total:', projectData.expenses?.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) || 0);
    
    applyProjectDataUpdate(prev => {
      // Reset all bucket spent amounts
      const resetBuckets = prev.buckets.map(bucket => ({
        ...bucket,
        spent: 0,
      }));

      const cleared = {
        ...prev,
        expenses: [],
        buckets: resetBuckets,
        spent: 0,
        lastUpdated: new Date().toISOString(),
      };
      
      console.log('✅ All expenses cleared');
      console.log('✅ New expenses count:', cleared.expenses.length);
      console.log('✅ New spent total:', cleared.spent);
      console.log('✅ All buckets reset to 0 spent');
      
      // Save to AsyncStorage immediately
      const key = `bps.project.${prev.id}`;
      AsyncStorage.setItem(key, JSON.stringify(cleared)).then(() => {
        console.log('💾 Cleared expenses saved to AsyncStorage');
      }).catch(err => {
        console.error('Error saving cleared expenses to AsyncStorage:', err);
      });
      
      return cleared;
    });
  };

  const updateExpense = (updatedExpense: {
    id: string;
    category?: string;
    vendor?: string;
    amount: number;
    date?: string;
    notes?: string;
  }) => {
    applyProjectDataUpdate(prev => {
      const oldExpense = prev.expenses?.find(e => e.id === updatedExpense.id);
      if (!oldExpense) return prev;

      const amountDiff = updatedExpense.amount - oldExpense.amount;

      const updatedExpenses = (prev.expenses || []).map(e =>
        e.id === updatedExpense.id ? { ...e, ...updatedExpense } : e
      );

      const updatedBuckets = prev.buckets.map(bucket => {
        if (
          updatedExpense.category &&
          bucket.name.toLowerCase() === updatedExpense.category.toLowerCase()
        ) {
          return {
            ...bucket,
            spent: Math.max(0, (bucket.spent || 0) + amountDiff),
          };
        }
        return bucket;
      });

      return {
        ...prev,
        expenses: updatedExpenses,
        buckets: updatedBuckets,
        spent: Math.max(0, prev.spent + amountDiff),
        lastUpdated: new Date().toISOString(),
      };
    });
  };

  const addPurchaseOrder = (po: Omit<PurchaseOrder, 'id'>) => {
    console.log('📦 addPurchaseOrder called with:', {
      vendor: po.vendor,
      amount: po.amount,
      category: po.category,
      status: po.status,
      poNumber: po.poNumber
    });
    
    applyProjectDataUpdate(prev => {
      // Check if PO already exists by PO number to prevent duplicates
      const existingPO = (prev.purchaseOrders || []).find(
        (p: any) => p.poNumber === po.poNumber
      );
      
      if (existingPO) {
        console.log('⚠️ Purchase order already exists, skipping duplicate:', {
          poNumber: po.poNumber,
          existingId: existingPO.id,
          existingStatus: existingPO.status
        });
        return prev; // Don't add duplicate
      }
      
      const newPO = {
        ...po,
        id: `po-${Date.now()}`,
      };

      const updatedPOs = [...(prev.purchaseOrders || []), newPO];

      const newCommittedPOs = updatedPOs
        .filter(p => p.status === 'Pending')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const updated = {
        ...prev,
        purchaseOrders: updatedPOs,
        committedPOs: newCommittedPOs,
        lastUpdated: new Date().toISOString(),
      };
      
      console.log('📦 Purchase order state updated:', {
        poId: newPO.id,
        poNumber: newPO.poNumber,
        amount: newPO.amount,
        status: newPO.status,
        totalPOs: updatedPOs.length,
        pendingPOs: updatedPOs.filter(p => p.status === 'Pending').length,
        committedPOs: newCommittedPOs,
        allPOs: updatedPOs.map((p: any) => ({ id: p.id, poNumber: p.poNumber, amount: p.amount, status: p.status }))
      });
      
      // CRITICAL: Immediately save to AsyncStorage to ensure persistence
      const key = `bps.project.${prev.id}`;
      
      // Update the ref to track that we just saved a purchase order
      // This prevents the useEffect from overwriting it
      lastSaveRef.current = { 
        purchaseOrdersCount: updatedPOs.length, 
        timestamp: Date.now() 
      };
      
      // Save synchronously using await in a separate async function to ensure it completes
      // But we can't await here, so we'll save and then trigger a reload
      AsyncStorage.setItem(key, JSON.stringify(updated)).then(() => {
        console.log('💾 Purchase order saved to AsyncStorage immediately', {
          poId: newPO.id,
          poNumber: newPO.poNumber,
          amount: newPO.amount,
          status: newPO.status,
          totalPOs: updatedPOs.length,
          pendingPOs: updatedPOs.filter(p => p.status === 'Pending').length,
          committedPOs: newCommittedPOs,
          savedData: {
            purchaseOrders: updated.purchaseOrders?.length || 0,
            committedPOs: updated.committedPOs || 0
          }
        });
        
        // Verify the save was successful
        AsyncStorage.getItem(key).then(saved => {
          if (saved) {
            const parsed = JSON.parse(saved);
            const savedPOs = parsed.purchaseOrders || [];
            const foundPO = savedPOs.find((po: any) => po.id === newPO.id);
            console.log('🔄 Verifying purchase order in AsyncStorage:', {
              savedPOs: savedPOs.length,
              savedCommittedPOs: parsed.committedPOs || 0,
              foundNewPO: !!foundPO,
              newPOInStorage: foundPO ? { id: foundPO.id, poNumber: foundPO.poNumber, amount: foundPO.amount } : null
            });
            
            if (!foundPO) {
              console.error('❌ CRITICAL: Purchase order NOT found in AsyncStorage after save!');
            }
          }
        });
      }).catch(err => {
        console.error('❌ Error saving purchase order to AsyncStorage:', err);
      });
      
      return updated;
    });
  };

  const markPOReceived = (poId: string) => {
    applyProjectDataUpdate(prev => {
      const po = prev.purchaseOrders?.find(p => p.id === poId);
      if (!po) return prev;

      const updatedPOs = (prev.purchaseOrders || []).map(p =>
        p.id === poId ? { ...p, status: 'Received' as const } : p
      );

      // Do NOT add to expenses — received POs are tracked in purchaseOrders. Actual cost
      // = expenses + received POs. Adding to expenses would double-count when computing
      // forecast final cost for completed projects (Nick, Jason).
      const updatedBuckets = prev.buckets.map(bucket => {
        if (bucket.name.toLowerCase() === po.category.toLowerCase()) {
          return {
            ...bucket,
            spent: (bucket.spent || 0) + po.amount,
          };
        }
        return bucket;
      });

      const newCommittedPOs = updatedPOs
        .filter(p => p.status === 'Pending')
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        ...prev,
        purchaseOrders: updatedPOs,
        buckets: updatedBuckets,
        spent: prev.spent + po.amount,
        committedPOs: newCommittedPOs,
        lastUpdated: new Date().toISOString(),
      };
    });
  };


  const cancelPO = (poId: string) => {
    console.log('🚫 cancelPO called for PO ID:', poId);
    
    applyProjectDataUpdate(prev => {
      const poToCancel = prev.purchaseOrders?.find(p => p.id === poId);
      if (!poToCancel) {
        console.warn('⚠️ PO not found for cancellation:', poId);
        return prev;
      }
      
      const updatedPOs = (prev.purchaseOrders || []).map(p =>
        p.id === poId ? { ...p, status: 'Cancelled' as const } : p
      );

      const newCommittedPOs = updatedPOs
        .filter(p => p.status === 'Pending')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const updated = {
        ...prev,
        purchaseOrders: updatedPOs,
        committedPOs: newCommittedPOs,
        lastUpdated: new Date().toISOString(),
      };
      
      console.log('🚫 PO cancelled:', {
        poId,
        poNumber: poToCancel.poNumber,
        previousStatus: poToCancel.status,
        newCommittedPOs,
        totalPOs: updatedPOs.length,
        pendingPOs: updatedPOs.filter(p => p.status === 'Pending').length
      });
      
      // CRITICAL: Immediately save to AsyncStorage to prevent reloadFromStorage from overwriting
      // Update the ref to track that we just saved a purchase order change
      lastSaveRef.current = { 
        purchaseOrdersCount: updatedPOs.length, 
        timestamp: Date.now() 
      };
      
      // Save asynchronously so it doesn't block the state update
      const key = `bps.project.${prev.id}`;
      AsyncStorage.setItem(key, JSON.stringify(updated)).then(() => {
        console.log('💾 Cancel PO saved to AsyncStorage immediately');
      }).catch(err => {
        console.error('❌ Error saving cancel PO to AsyncStorage:', err);
      });
      
      return updated;
    });
  };

  const archivePO = (poId: string) => {
    applyProjectDataUpdate(prev => {
      const updatedPOs = (prev.purchaseOrders || []).map(p =>
        p.id === poId ? { ...p, status: 'Archived' as const } : p
      );

      const newCommittedPOs = updatedPOs
        .filter(p => p.status === 'Pending')
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        ...prev,
        purchaseOrders: updatedPOs,
        committedPOs: newCommittedPOs,
        lastUpdated: new Date().toISOString(),
      };
    });
  };

  const updatePurchaseOrder = (updatedPO: PurchaseOrder) => {
    applyProjectDataUpdate(prev => {
      const updatedPOs = (prev.purchaseOrders || []).map(p =>
        p.id === updatedPO.id ? updatedPO : p
      );

      const newCommittedPOs = updatedPOs
        .filter(p => p.status === 'Pending')
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        ...prev,
        purchaseOrders: updatedPOs,
        committedPOs: newCommittedPOs,
        lastUpdated: new Date().toISOString(),
      };
    });
  };

  const addChangeOrder = (changeOrder: {
    id: string;
    title?: string;
    amount: number;
    approved: boolean;
    notes?: string;
    materialsAmount?: number;
    laborAmount?: number;
    status?: string;
  }) => {
    console.log('➕ Adding change order:', {
      id: changeOrder.id,
      title: changeOrder.title,
      amount: changeOrder.amount,
      approved: changeOrder.approved,
      status: changeOrder.status,
      materialsAmount: changeOrder.materialsAmount,
      laborAmount: changeOrder.laborAmount,
      projectId: projectId,
    });
    
    // Emit PM event for change order added
    pmEventTracker.emit({
      type: 'change_order_added',
      projectId: projectId,
      projectName: projectData?.title,
      data: {
        amount: changeOrder.amount,
        title: changeOrder.title,
        approved: changeOrder.approved,
      },
      timestamp: Date.now(),
    });

    applyProjectDataUpdate(prev => {
      console.log('📝 addChangeOrder - prev state:', {
        existingChangeOrders: (prev.changeOrders || []).length,
        existingChangeOrderIds: (prev.changeOrders || []).map((co: any) => co.id),
      });
      // Check if this is an update (change order with this ID already exists)
      const existingIndex = (prev.changeOrders || []).findIndex(co => co.id === changeOrder.id);
      
      if (existingIndex >= 0) {
        // Update existing change order
        const existing = prev.changeOrders![existingIndex];
        const wasApproved = existing.approved || (existing as any).status === 'Approved';
        const isApproved = changeOrder.approved || changeOrder.status === 'Approved';
        
        const updatedChangeOrders = [...(prev.changeOrders || [])];
        updatedChangeOrders[existingIndex] = {
          ...changeOrder,
          status: changeOrder.status || (changeOrder.approved ? 'Approved' : 'Submitted'),
        } as any;
        
        // Adjust budgeted amount
        let newBudgeted = prev.budgeted;
        if (wasApproved && !isApproved) {
          // Was approved, now not approved - subtract old amount
          newBudgeted = prev.budgeted - existing.amount;
        } else if (!wasApproved && isApproved) {
          // Was not approved, now approved - add new amount
          newBudgeted = prev.budgeted + changeOrder.amount;
        } else if (wasApproved && isApproved) {
          // Both approved - adjust by difference
          newBudgeted = prev.budgeted - existing.amount + changeOrder.amount;
        }
        
        return {
          ...prev,
          changeOrders: updatedChangeOrders,
          budgeted: newBudgeted,
          lastUpdated: new Date().toISOString(),
        };
      } else {
        // Add new change order
        const changeOrderWithStatus = {
          ...changeOrder,
          status: changeOrder.status || (changeOrder.approved ? 'Approved' : 'Submitted'),
        };

        const newBudgeted = changeOrder.approved
          ? prev.budgeted + changeOrder.amount
          : prev.budgeted;

        const updatedChangeOrders = [...(prev.changeOrders || []), changeOrderWithStatus];
        console.log('✅ addChangeOrder - new state:', {
          changeOrdersCount: updatedChangeOrders.length,
          changeOrderIds: updatedChangeOrders.map((co: any) => co.id),
          newChangeOrder: changeOrderWithStatus,
          newBudgeted: newBudgeted,
        });
        
        return {
          ...prev,
          changeOrders: updatedChangeOrders,
          budgeted: newBudgeted,
          lastUpdated: new Date().toISOString(),
        };
      }
    });
  };

  const updateChangeOrder = (changeOrder: {
    id: string;
    title?: string;
    amount: number;
    approved: boolean;
    notes?: string;
    materialsAmount?: number;
    laborAmount?: number;
    status?: string;
  }) => {
    // Reuse addChangeOrder logic since it handles updates
    addChangeOrder(changeOrder);
  };

  const deleteChangeOrder = (changeOrderId: string) => {
    applyProjectDataUpdate(prev => {
      const changeOrderToDelete = (prev.changeOrders || []).find(
        co => co.id === changeOrderId
      );

      if (!changeOrderToDelete) {
        return prev;
      }

      // If the change order was approved, subtract its amount from budget
      const wasApproved = changeOrderToDelete.approved || (changeOrderToDelete as any).status === 'Approved';
      const newBudgeted = wasApproved
        ? prev.budgeted - (changeOrderToDelete.amount || 0)
        : prev.budgeted;

      return {
        ...prev,
        changeOrders: (prev.changeOrders || []).filter(co => co.id !== changeOrderId),
        budgeted: newBudgeted,
        lastUpdated: new Date().toISOString(),
      };
    });
  };

  const approveChangeOrder = (changeOrderId: string) => {
    console.log('✅ Approving change order:', changeOrderId);
    applyProjectDataUpdate(prev => {
      const changeOrderToApprove = (prev.changeOrders || []).find(
        co => co.id === changeOrderId
      );

      if (!changeOrderToApprove) {
        console.error('❌ Change order not found:', changeOrderId);
        console.log('Available change orders:', (prev.changeOrders || []).map(co => co.id));
        return prev;
      }

      console.log('📋 Change order to approve:', {
        id: changeOrderToApprove.id,
        title: changeOrderToApprove.title,
        amount: changeOrderToApprove.amount,
        currentApproved: changeOrderToApprove.approved,
        currentStatus: (changeOrderToApprove as any).status,
      });

      // If already approved, don't do anything
      if (changeOrderToApprove.approved || (changeOrderToApprove as any).status === 'Approved') {
        console.log('⚠️ Change order already approved, skipping');
        return prev;
      }

      // Update the change order to approved and add its amount to budget
      const updatedChangeOrders = (prev.changeOrders || []).map(co => {
        if (co.id === changeOrderId) {
          const updated = {
            ...co,
            approved: true,
            status: 'Approved',
          } as any;
          console.log('✅ Updated change order:', updated);
          return updated;
        }
        return co;
      });

      const newBudgeted = prev.budgeted + (changeOrderToApprove.amount || 0);
      console.log('💰 Budget update:', {
        oldBudgeted: prev.budgeted,
        changeOrderAmount: changeOrderToApprove.amount,
        newBudgeted: newBudgeted,
        calculation: `${prev.budgeted} + ${changeOrderToApprove.amount} = ${newBudgeted}`,
      });

      return {
        ...prev,
        changeOrders: updatedChangeOrders,
        budgeted: newBudgeted,
        lastUpdated: new Date().toISOString(),
      };
    });
  };

  const updateHealth = (health: {
    costEfficiency: string;
    scheduleEfficiency: string;
    projectStatus: string;
  }) => {
    applyProjectDataUpdate(prev => ({
      ...prev,
      health,
      lastUpdated: new Date().toISOString(),
    }));
  };

  const resetProjectData = async () => {
    const initial = getInitialProjectData(projectId);
    replaceProjectDataState(initial);
    
    // Clear saved data from AsyncStorage
    try {
      const key = `bps.project.${projectId || '1'}`;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing saved data:', error);
    }
  };

  const reloadFromStorage = async () => {
    console.log('🔄 reloadFromStorage: Starting reload...');
    try {
      const key = `bps.project.${projectId || '1'}`;
      const saved = await AsyncStorage.getItem(key);
      
      // ALSO check ProjectListContext for latest data (in case AI updated it directly)
      const projectFromList = getProjectById(projectId || '1');
      const listPOs = projectFromList?.projectData?.purchaseOrders || [];
      const listCommittedPOs = projectFromList?.projectData?.committedPOs || 0;
      
      console.log('🔄 reloadFromStorage: Checking sources:', {
        hasAsyncStorage: !!saved,
        listPOsCount: listPOs.length,
        listCommittedPOs,
        currentPOsCount: (projectData.purchaseOrders || []).length,
        currentCommittedPOs: projectData.committedPOs || 0
      });
      
      if (saved) {
        const parsedData = JSON.parse(saved);
        console.log('🔄 Reloading from AsyncStorage, expenses count:', parsedData.expenses?.length || 0);
        
        // Check if expenses changed
        const currentExpenseIds = (projectData.expenses || []).map((e: any) => e.id).sort().join(',');
        const savedExpenseIds = (parsedData.expenses || []).map((e: any) => e.id).sort().join(',');
        const expensesChanged = currentExpenseIds !== savedExpenseIds;
        
        // Check if buckets changed (compare spent amounts)
        const currentBucketsSpent = (projectData.buckets || []).map((b: any) => `${b.name}:${b.spent || 0}`).sort().join(',');
        const savedBucketsSpent = (parsedData.buckets || []).map((b: any) => `${b.name}:${b.spent || 0}`).sort().join(',');
        const bucketsChanged = currentBucketsSpent !== savedBucketsSpent;
        
        // Check if spent amount changed
        const spentChanged = (projectData.spent || 0) !== (parsedData.spent || 0);
        
        // Check if purchase orders changed
        const currentPOIds = (projectData.purchaseOrders || []).map((po: any) => po.id).sort().join(',');
        const savedPOIds = (parsedData.purchaseOrders || []).map((po: any) => po.id).sort().join(',');
        const purchaseOrdersChanged = currentPOIds !== savedPOIds;
        
        // Check if committedPOs changed
        const committedPOsChanged = (projectData.committedPOs || 0) !== (parsedData.committedPOs || 0);
        
        // CRITICAL: Also check if ProjectListContext has newer purchase orders
        // If ProjectListContext has more POs than AsyncStorage, use ProjectListContext as source of truth
        const listPOIds = listPOs.map((po: any) => po.id).sort().join(',');
        const listHasNewerPOs = listPOs.length > (parsedData.purchaseOrders || []).length;
        const listPOsChanged = listPOIds !== currentPOIds;
        
        console.log('🔄 reloadFromStorage: Checking for changes:', {
          expensesChanged,
          bucketsChanged,
          spentChanged,
          purchaseOrdersChanged,
          committedPOsChanged,
          listHasNewerPOs,
          listPOsChanged,
          currentPOs: (projectData.purchaseOrders || []).length,
          savedPOs: (parsedData.purchaseOrders || []).length,
          listPOs: listPOs.length,
          currentCommittedPOs: projectData.committedPOs || 0,
          savedCommittedPOs: parsedData.committedPOs || 0,
          listCommittedPOs
        });
        
        // If ProjectListContext has newer data, merge it with AsyncStorage data
        let dataToUse = parsedData;
        if (listHasNewerPOs || (listPOs.length > 0 && listPOsChanged)) {
          console.log('🔄 ProjectListContext has newer PO data, merging...');
          // Merge purchase orders from both sources (prefer ProjectListContext for POs)
          const mergedPOs = [...listPOs];
          // Add any POs from AsyncStorage that aren't in ProjectListContext
          (parsedData.purchaseOrders || []).forEach((po: any) => {
            if (!mergedPOs.find((p: any) => p.id === po.id || p.poNumber === po.poNumber)) {
              mergedPOs.push(po);
            }
          });
          dataToUse = {
            ...parsedData,
            purchaseOrders: mergedPOs,
            committedPOs: listCommittedPOs > 0 ? listCommittedPOs : parsedData.committedPOs || 0
          };
          console.log('🔄 Merged data:', {
            mergedPOsCount: mergedPOs.length,
            committedPOs: dataToUse.committedPOs
          });
        }
        
        // Reload if any of these changed
        if (expensesChanged || bucketsChanged || spentChanged || purchaseOrdersChanged || committedPOsChanged || listHasNewerPOs || listPOsChanged) {
          const currentCount = (projectData.expenses || []).length;
          const savedCount = (dataToUse.expenses || []).length;
          
          // If expenses increased, always reload (new expense added)
          // If expenses decreased, don't reload (delete in progress)
          // If only buckets/spent/purchaseOrders changed, reload (update from AI Assistant)
          const savedPOCount = (dataToUse.purchaseOrders || []).length;
          const currentPOCount = (projectData.purchaseOrders || []).length;
          
          if (savedCount > currentCount || 
              (savedCount === currentCount && (bucketsChanged || spentChanged)) ||
              savedPOCount > currentPOCount ||
              (savedPOCount === currentPOCount && (purchaseOrdersChanged || listPOsChanged)) ||
              committedPOsChanged ||
              listHasNewerPOs) {
            replaceProjectDataState(dataToUse);
            console.log('🔄 Reloaded project data from AsyncStorage/ProjectListContext', {
              expensesChanged,
              bucketsChanged,
              spentChanged,
              purchaseOrdersChanged,
              committedPOsChanged,
              listHasNewerPOs,
              savedExpenseCount: savedCount,
              currentExpenseCount: currentCount,
              savedPOCount,
              currentPOCount,
            });
            
            // After reloading, sync back to ProjectListContext to ensure consistency
            // BUT: Don't sync if we're already syncing (prevent infinite loop)
            // The replaceProjectDataState function will handle syncing
            // setTimeout(() => {
            //   syncProjectList(dataToUse);
            // }, 100);
          } else {
            console.log('🔄 Skipped reload - current state has fewer expenses (delete in progress)');
          }
        } else {
          console.log('🔄 Skipped reload - data is already in sync');
        }
      } else if (listPOs.length > 0) {
        // No AsyncStorage data, but ProjectListContext has data - use it
        console.log('🔄 No AsyncStorage data, using ProjectListContext data');
        const listData = projectFromList?.projectData || {};
        const dataToUse = {
          ...projectData,
          ...listData,
          purchaseOrders: listPOs,
          committedPOs: listCommittedPOs
        };
        replaceProjectDataState(dataToUse);
      } else {
        // No saved data, use initial
        const initial = getInitialProjectData(projectId);
        replaceProjectDataState(initial);
      }
    } catch (error) {
      console.error('Error reloading project data:', error);
    }
  };

  const value: ProjectDataContextType = {
    addExpense,
    deleteExpense,
    clearAllExpenses,
    updateExpense,
    addPurchaseOrder,
    updatePurchaseOrder,
    markPOReceived,
    cancelPO,
    archivePO,
    addChangeOrder,
    updateChangeOrder,
    deleteChangeOrder,
    approveChangeOrder,
    projectData,
    updateBudget,
    updateTimeline,
    updateTeam,
    addMessage,
    updateStatus,
    updateHealth,
    resetProjectData,
    reloadFromStorage,
  };

  return (
    <ProjectDataContext.Provider value={value}>
      {children}
    </ProjectDataContext.Provider>
  );
}

export function useProjectData() {
  const context = useContext(ProjectDataContext);
  if (context === undefined) {
    throw new Error('useProjectData must be used within a ProjectDataProvider');
  }
  return context;
}
