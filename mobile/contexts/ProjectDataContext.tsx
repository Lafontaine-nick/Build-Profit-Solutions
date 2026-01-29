import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProjectOverview } from '../components/OverviewScreen';
import { useProjectList } from './ProjectListContext';

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  vendor: string;
  category: string;
  amount: number;
  description?: string;
  orderDate: string;
  expectedDelivery: string;
  status: 'Pending' | 'Received' | 'Cancelled';
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
    crewCount?: number
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
          purchaseOrders: next.purchaseOrders || existingProjectData.purchaseOrders,
          committedPOs: next.committedPOs,
        };
        
        console.log('🔄 syncProjectList: hasExpensesProperty:', hasExpensesProperty, 'next.expenses count:', next.expenses?.length || 0, 'merged count:', mergedProjectData.expenses?.length || 0);
        console.log('🔄 syncProjectList: next.expenses IDs:', next.expenses?.map((e: any) => e.id) || []);

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

  const replaceProjectDataState = useCallback(
    (next: ProjectOverview) => {
      if (!next) return;
      syncProjectList(next);
      setProjectData(next);
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
  useEffect(() => {
    if (!isLoaded) return; // Don't save during initial load
    
    const saveData = async () => {
      try {
        const key = `bps.project.${projectData.id}`;
        const dataToSave = {
          ...projectData,
          // Ensure expenses is always an array (never undefined)
          expenses: projectData.expenses || [],
        };
        await AsyncStorage.setItem(key, JSON.stringify(dataToSave));
        console.log('💾 Saved to AsyncStorage, expenses count:', dataToSave.expenses.length);
      } catch (error) {
        console.error('Error saving project data:', error);
      }
    };

    saveData();
  }, [projectData, isLoaded]);

  const updateBudget = (budgeted: number, spent: number) => {
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
    crewCount?: number
  ) => {
    applyProjectDataUpdate(prev => ({
      ...prev,
      team: {
        pmAssigned,
        pmName: pmName || prev.team.pmName,
      },
      crewCount: crewCount || prev.crewCount,
      lastUpdated: new Date().toISOString(),
    }));
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
    applyProjectDataUpdate(prev => {
      // Find the matching budget bucket based on category
      // Match flexibly: "Materials/Equipment" matches "Materials" or "Materials/Equipment"
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
          if ((bucketName.includes('materials') || bucketName.includes('equipment')) &&
              (expenseCategory.includes('materials') || expenseCategory.includes('equipment'))) {
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
    applyProjectDataUpdate(prev => {
      const newPO = {
        ...po,
        id: `po-${Date.now()}`,
      };

      const updatedPOs = [...(prev.purchaseOrders || []), newPO];

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

  const markPOReceived = (poId: string) => {
    applyProjectDataUpdate(prev => {
      const po = prev.purchaseOrders?.find(p => p.id === poId);
      if (!po) return prev;

      const updatedPOs = (prev.purchaseOrders || []).map(p =>
        p.id === poId ? { ...p, status: 'Received' as const } : p
      );

      const newExpense = {
        id: `exp-${Date.now()}`,
        category: po.category,
        vendor: po.vendor,
        amount: po.amount,
        date: new Date().toISOString(),
        notes: `${po.description || ''} (from ${po.poNumber})`.trim(),
        receiptUri: null,
      };

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
        expenses: [...(prev.expenses || []), newExpense],
        buckets: updatedBuckets,
        spent: prev.spent + po.amount,
        committedPOs: newCommittedPOs,
        lastUpdated: new Date().toISOString(),
      };
    });
  };

  const cancelPO = (poId: string) => {
    applyProjectDataUpdate(prev => {
      const updatedPOs = (prev.purchaseOrders || []).map(p =>
        p.id === poId ? { ...p, status: 'Cancelled' as const } : p
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
    applyProjectDataUpdate(prev => {
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

        return {
          ...prev,
          changeOrders: [...(prev.changeOrders || []), changeOrderWithStatus],
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
    applyProjectDataUpdate(prev => {
      const changeOrderToApprove = (prev.changeOrders || []).find(
        co => co.id === changeOrderId
      );

      if (!changeOrderToApprove) {
        return prev;
      }

      // If already approved, don't do anything
      if (changeOrderToApprove.approved || (changeOrderToApprove as any).status === 'Approved') {
        return prev;
      }

      // Update the change order to approved and add its amount to budget
      const updatedChangeOrders = (prev.changeOrders || []).map(co => {
        if (co.id === changeOrderId) {
          return {
            ...co,
            approved: true,
            status: 'Approved',
          } as any;
        }
        return co;
      });

      return {
        ...prev,
        changeOrders: updatedChangeOrders,
        budgeted: prev.budgeted + (changeOrderToApprove.amount || 0),
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
    try {
      const key = `bps.project.${projectId || '1'}`;
      const saved = await AsyncStorage.getItem(key);
      
      if (saved) {
        const parsedData = JSON.parse(saved);
        console.log('🔄 Reloading from AsyncStorage, expenses count:', parsedData.expenses?.length || 0);
        
        // Only reload if the saved data is different from current state
        // This prevents overwriting in-progress updates
        const currentExpenseIds = (projectData.expenses || []).map((e: any) => e.id).sort().join(',');
        const savedExpenseIds = (parsedData.expenses || []).map((e: any) => e.id).sort().join(',');
        
        // CRITICAL: If current state has fewer expenses, don't reload (delete might be in progress)
        // Only reload if saved data has MORE expenses (meaning we're missing something)
        const currentCount = (projectData.expenses || []).length;
        const savedCount = (parsedData.expenses || []).length;
        
        if (currentExpenseIds !== savedExpenseIds) {
          // If current state has fewer expenses than saved, it might be a delete in progress
          // Only reload if saved has more expenses (we're missing data)
          if (savedCount > currentCount) {
            replaceProjectDataState(parsedData);
            console.log('🔄 Reloaded project data from AsyncStorage (saved has more expenses)');
            
            // After reloading, sync back to ProjectListContext to ensure consistency
            // Use a small delay to ensure state has updated
            setTimeout(() => {
              syncProjectList(parsedData);
            }, 100);
          } else {
            console.log('🔄 Skipped reload - current state has fewer expenses (delete in progress)');
          }
        } else {
          console.log('🔄 Skipped reload - data is already in sync');
        }
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
    updateExpense,
    addPurchaseOrder,
    updatePurchaseOrder,
    markPOReceived,
    cancelPO,
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
