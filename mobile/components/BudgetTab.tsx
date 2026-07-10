import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  FlatList,
  Alert,
  StyleSheet,
  Modal,
  TouchableOpacity,
  InteractionManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { Ionicons, MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatMoneyFull } from '../src/lib/budgetUtils';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useProjectList } from '../contexts/ProjectListContext';
import { mapApprovedCostBucketsToProjectBuckets } from '../utils/approvedCostBuckets';
import { useBudgetAlerts } from '../src/hooks/useBudgetAlerts';
import { loadThresholds, Thresholds } from '../src/lib/thresholds';
import {
  computeProfitForecast,
  contractCollectedPctFromMilestones,
  computeElapsedCalendarPct,
  type ProfitForecastOutput,
} from '../src/lib/profitForecast';
import { deriveEstimateFeedbackFromBudgetData } from '@/utils/estimateFeedback';
import CalibrationReviewModal from '@/components/CalibrationReviewModal';
import { DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS } from '@/utils/buildWithAiProductionHardening';
import {
  computeProjectFinancials,
  sumPlannedCostFromBuckets,
} from '../src/lib/projectFinancials';
import ThresholdSettingsSheet from './ThresholdSettingsSheet';
import CategoryDetailModal from './CategoryDetailModal';
import AddPurchaseOrderModal from './AddPurchaseOrderModal';
import EditPurchaseOrderModal from './EditPurchaseOrderModal';
import PricingModeSection, { PricingMode } from './PricingModeSection';
import { decimalMoneyInputToNumber, digitsOnly } from '@/src/lib/keyboardMoney';
import { KEYBOARD_SCROLL_DEFAULTS } from '@/constants/keyboardScrollProps';
import GradientRingBackInner from './GradientRingBackInner';

/**
 * Build Profit Solutions — Budget Tab (with AI integrations)
 * ---------------------------------------------------------
 * - Expo / React Native (TypeScript)
 * - Styling via React Native StyleSheet
 * - Integrates AI hooks for: Draft Budget, Auto‑Categorize, Receipt OCR
 * - Feeds Overview via summary endpoint (assumed already in app)
 */

// Types ------------------------------------------------------------
export type BudgetLine = {
  id: string;
  category: string;
  description: string;
  qty: number;
  unit?: string;
  unitCost: number;
  markupPct?: number; // 0..1
  spent?: number; // derived from expenses
  aiSuggested?: boolean;
};

export type Expense = {
  id: string;
  date: string; // ISO
  vendor: string;
  amount: number;
  taxAmount?: number;
  description?: string;
  costCode?: string;
  linkedLineId?: string;
  aiConfidence?: number;
};

export type ChangeOrder = {
  id: string;
  title: string;
  amount: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  date?: string; // ISO
  materialsAmount?: number;
  laborAmount?: number;
  notes?: string;
  approved?: boolean;
};

export type BudgetData = {
  projectId: string;
  currency?: string;
  lines: BudgetLine[];
  expenses: Expense[];
  changeOrders: ChangeOrder[];
  committedPOs?: number;
  plannedBudget?: number;
};

// Utility ----------------------------------------------------------
const money = (n: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { 
    style: 'currency', 
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  }).format(
    Math.round((n || 0) * 100) / 100
  );
const safe = (n?: number) => (typeof n === 'number' && !isNaN(n) ? n : 0);

const toPositiveNumber = (value: any): number | null => {
  if (value == null) return null;
  const numeric =
    typeof value === 'string'
      ? Number(value.replace(/[$,\s]/g, ''))
      : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const firstPositiveNumber = (...values: any[]): number | null => {
  for (const value of values) {
    const resolved = toPositiveNumber(value);
    if (resolved !== null) {
      return resolved;
    }
  }
  return null;
};

const normalizeProjectId = (id: any) => String(id ?? '').trim();

function lineBase(l: BudgetLine) {
  return safe(l.qty) * safe(l.unitCost);
}
function lineTaxed(l: BudgetLine, taxRate = 0) {
  return lineBase(l) * (1 + taxRate);
}
function lineClient(l: BudgetLine) {
  return lineTaxed(l) * (1 + (l.markupPct ?? 0));
}

// Mock data fallback ----------------------------------------------
const demo: BudgetData = {
  projectId: 'proj_demo',
  lines: [
    {
      id: 'l1',
      category: 'Labor',
      description: 'General labor',
      qty: 100,
      unit: 'hr',
      unitCost: 45,
      markupPct: 0.15,
      spent: 12000,
    },
    {
      id: 'l2',
      category: 'Concrete',
      description: 'Slab & footings',
      qty: 2200,
      unit: 'sf',
      unitCost: 7.5,
      markupPct: 0.12,
      spent: 8000,
    },
    {
      id: 'l3',
      category: 'HVAC',
      description: 'Heating & cooling',
      qty: 1,
      unit: 'lot',
      unitCost: 10000,
      markupPct: 0.15,
      spent: 3500,
    },
  ],
  expenses: [
    {
      id: 'e1',
      date: '2025-02-10',
      vendor: 'Home Depot',
      amount: 183.42,
      taxAmount: 14.21,
      description: 'Bagged concrete',
      linkedLineId: 'l2',
      aiConfidence: 0.82,
    },
  ],
  changeOrders: [
    { id: 'c1', title: 'Add patio cover', amount: 4800, status: 'Approved' },
  ],
  committedPOs: 5200,
};

// Screen -----------------------------------------------------------
export default function BudgetTab({
  data = demo,
  onRefetch,
  embedded = false,
  profitForecastOverride,
  budgetAccessMode = 'owner',
}: {
  data?: BudgetData;
  onRefetch?: () => void;
  embedded?: boolean;
  /** When provided (e.g. from project-detail), use this instead of computing — ensures Overview and Budget match */
  profitForecastOverride?: ProfitForecastOutput;
  /** Owner sees contract + profit framing; manager sees cost control only */
  budgetAccessMode?: 'owner' | 'cost_control';
}) {
  const { darkMode, theme: themeTokens } = useTheme();
  const Colors = useMemo(() => getColors(themeTokens), [themeTokens]);
  const [tab, setTab] = useState<'lines' | 'cos' | 'ai'>('lines');
  const [editing, setEditing] = useState<BudgetLine | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showChangeOrderModal, setShowChangeOrderModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [editingPO, setEditingPO] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [pendingChangeOrderEditId, setPendingChangeOrderEditId] = useState<string | null>(null);
  const [showCalibrationReview, setShowCalibrationReview] = useState(false);
  const [newExpense, setNewExpense] = useState({ vendor: '', amount: '', category: '', notes: '' });
  const [newChangeOrder, setNewChangeOrder] = useState({ title: '', amount: '', materialsAmount: '', laborAmount: '', notes: '' });
  const [editingChangeOrder, setEditingChangeOrder] = useState<any>(null);
  const [changeOrderPricingMode, setChangeOrderPricingMode] = useState<PricingMode>('flat');
  const [changeOrderSqftInput, setChangeOrderSqftInput] = useState('');
  const [changeOrderRateInput, setChangeOrderRateInput] = useState('');
  const changeOrderSqftRef = useRef<TextInput>(null);
  const changeOrderRateRef = useRef<TextInput>(null);
  const changeOrderAmountRef = useRef<TextInput>(null);
  const changeOrderIsEditingRef = useRef(false);
  const budgetScrollViewRef = useRef<ScrollView>(null);

  const onChangeOrderSqftChange = useCallback((text: string) => {
    setChangeOrderSqftInput(text);
  }, []);

  const onChangeOrderRateChange = useCallback((text: string) => {
    setChangeOrderRateInput(text);
  }, []);

  useEffect(() => {
    if (!showChangeOrderModal) return;
    setChangeOrderPricingMode('flat');
    setChangeOrderSqftInput('');
    setChangeOrderRateInput('');
  }, [showChangeOrderModal]);

  useEffect(() => {
    if (!showChangeOrderModal) return;
    changeOrderIsEditingRef.current = editingChangeOrder != null;
  }, [showChangeOrderModal, editingChangeOrder]);

  useEffect(() => {
    if (!showChangeOrderModal || changeOrderPricingMode !== 'sqft') return;
    const sq = parseInt(digitsOnly(changeOrderSqftInput), 10) || 0;
    const rate = decimalMoneyInputToNumber(changeOrderRateInput);
    const total = sq > 0 && rate > 0 ? (sq * rate).toFixed(2) : '';
    if (changeOrderIsEditingRef.current) {
      setEditingChangeOrder((prev: any) =>
        prev ? { ...prev, amount: total, materialsAmount: '', laborAmount: '' } : null
      );
    } else {
      setNewChangeOrder((prev) => ({
        ...prev,
        amount: total,
        materialsAmount: '',
        laborAmount: '',
      }));
    }
  }, [showChangeOrderModal, changeOrderPricingMode, changeOrderSqftInput, changeOrderRateInput]);

  const router = useRouter();
  const { projectData: contextProjectData, addExpense, deleteExpense, addChangeOrder, updateChangeOrder, deleteChangeOrder, approveChangeOrder, addPurchaseOrder, updatePurchaseOrder, markPOReceived, cancelPO, reloadFromStorage } = useProjectData();
  const { projects, getProjectById } = useProjectList();
  
  
  // Reload from storage when Budget tab is focused, but defer until nav interactions complete
  // to avoid visible shuttering during screen/modal transitions.
  useFocusEffect(
    React.useCallback(() => {
      if (reloadFromStorage) {
        const task = InteractionManager.runAfterInteractions(() => {
          reloadFromStorage().catch(() => {});
        });
        return () => task.cancel();
      }
      return undefined;
    }, [reloadFromStorage])
  );
  
  // Reduced logging to prevent terminal glitching
  // useEffect(() => {
  //   // Only log count, not full array
  // }, [contextProjectData?.purchaseOrders, contextProjectData?.committedPOs]);
  
  // Resolve list project early — cost-control bucket fallback needs approvedCostBuckets.
  const projectId = useMemo(
    () => normalizeProjectId((contextProjectData as any)?.id || data?.projectId),
    [contextProjectData, data?.projectId]
  );
  const projectFromList = useMemo(() => {
    if (!projectId) return null;
    try {
      return getProjectById?.(projectId) ?? projects.find((p: any) => normalizeProjectId(p?.id) === projectId) ?? null;
    } catch {
      return null;
    }
  }, [projectId, getProjectById, projects]);

  // Use data prop if provided, otherwise fall back to context
  // CRITICAL: If buckets exist in contextProjectData, use those (source of truth after estimate is saved)
  // Otherwise, calculate from data.lines
  const projectData = data ? {
    ...contextProjectData,
    budgeted: firstPositiveNumber(
      data.plannedBudget,
      contextProjectData?.budgeted,
      (contextProjectData as any)?.bidPrice
    ) ?? contextProjectData?.budgeted,
    buckets: (() => {
      const fromLines = (data.lines || []).map(line => {
        const quantity = safe(line.qty);
        const unitCost = safe(line.unitCost);
        const baseCost = quantity * unitCost;

        const categoryExpenses = (contextProjectData?.expenses || []).filter(exp => {
          const expCategory = String(exp.category || '').trim().toLowerCase();
          const lineCategory = String(line.category || '').trim().toLowerCase();
          return (
            expCategory === lineCategory ||
            (expCategory.includes('materials') && lineCategory.includes('materials')) ||
            (expCategory.includes('equipment') && lineCategory.includes('equipment')) ||
            (lineCategory.includes('labor') &&
              (expCategory.includes('labor') ||
                expCategory.includes('labour') ||
                expCategory === 'subs' ||
                expCategory.includes('subcontract') ||
                expCategory.includes('crew'))) ||
            (lineCategory.includes('allowance') && expCategory.includes('allowance'))
          );
        });
        const actualSpent = categoryExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

        return {
          id: line.id,
          name: line.category,
          budget: baseCost,
          spent: actualSpent,
          bidBudget: baseCost,
        };
      });
      if (fromLines.length > 0) return fromLines;

      const fromApproved = mapApprovedCostBucketsToProjectBuckets(
        (projectFromList as any)?.approvedCostBuckets
      );
      if (fromApproved.length > 0) return fromApproved;

      return contextProjectData?.buckets || [];
    })(),
    expenses: contextProjectData?.expenses || data.expenses || [],
    changeOrders: contextProjectData?.changeOrders || data.changeOrders || [],
    purchaseOrders: contextProjectData?.purchaseOrders || [],
    committedPOs: contextProjectData?.committedPOs || data.committedPOs || 0,
    currency: data.currency || 'USD',
  } : contextProjectData;

  const currency = projectData?.currency ?? 'USD';

  // Budget Alerts & Thresholds
  const [thresholdModalVisible, setThresholdModalVisible] = useState(false);
  const [thresholds, setThresholds] = useState<Thresholds>({
    overallPct: 10, materialsPct: 20, laborPct: 15, equipmentPct: 15,
  });

  // Load thresholds from storage
  useEffect(() => {
    if (projectData?.id) {
      loadThresholds(projectData.id).then(setThresholds);
    }
  }, [projectData?.id]);

  // Totals
  const [isGenerating, setIsGenerating] = useState(false);
  const plannedFromBuckets = useMemo(() => {
    const buckets = projectData?.buckets || [];
    const relevantBuckets = buckets.filter((bucket) => {
      const n = String(bucket?.name || '').toLowerCase();
      return (
        n.includes('material') ||
        n.includes('equip') ||
        n.includes('labor') ||
        n.includes('allowance') ||
        n.includes('overhead')
      );
    });
    return relevantBuckets.reduce((s, l) => s + safe(l.budget), 0);
  }, [projectData?.buckets]);

  const mergedProjectForFinancials = useMemo(
    () => ({
      ...(projectFromList as any),
      ...(projectData as any),
      estimateData:
        (projectFromList as any)?.estimateData || (projectData as any)?.estimateData,
      changeOrders: (() => {
        const fromDetail = (projectData as any)?.changeOrders;
        if (Array.isArray(fromDetail) && fromDetail.length > 0) return fromDetail;
        return (
          (projectFromList as any)?.changeOrders ??
          (projectFromList as any)?.projectData?.changeOrders
        );
      })(),
      buckets: projectData?.buckets,
    }),
    [projectData, projectFromList]
  );

  const financials = useMemo(
    () =>
      computeProjectFinancials(mergedProjectForFinancials, {
        plannedFromBuckets,
        contractValueOverride: data?.plannedBudget,
        plannedCostBucketSum: sumPlannedCostFromBuckets(projectData?.buckets),
      }),
    [mergedProjectForFinancials, plannedFromBuckets, data?.plannedBudget, projectData?.buckets]
  );

  const normalizedChangeOrders: ChangeOrder[] = useMemo(() => {
    const rawChangeOrders = projectData?.changeOrders || [];
    
    if (rawChangeOrders.length === 0) {
      return [];
    }
    
    const normalized = rawChangeOrders.map((co: any) => {
      // Determine status: prioritize explicit status, then check approved flag, default to 'Submitted' for new ones
      let status = co.status;
      if (!status) {
        if (co.approved === true || co.approved === 'true') {
          status = 'Approved';
        } else {
          // Default to 'Submitted' for new change orders
          status = 'Submitted';
        }
      }
      
      return {
        id: String(co.id),
        title: String(co.title ?? 'Change Order'),
        amount: Number(co.amount ?? 0),
        status: status as 'Draft' | 'Submitted' | 'Approved' | 'Rejected',
        materialsAmount: co.materialsAmount !== undefined && co.materialsAmount !== null ? Number(co.materialsAmount) : undefined,
        laborAmount: co.laborAmount !== undefined && co.laborAmount !== null ? Number(co.laborAmount) : undefined,
        notes: co.notes,
        approved: co.approved === true || status === 'Approved',
        date: co.date ?? new Date().toISOString(),
      };
    });
    
    return normalized;
  }, [projectData?.changeOrders]);

  // Calculate Purchase Orders total - includes ONLY PENDING POs (not paid for yet)
  // Logic:
  // - Pending POs → Count as "Committed POs" (not yet received/paid, still committed)
  // - Received POs → Don't count (goods received and paid for)
  // - Archived POs → Don't count (historical, no longer active commitment)
  // - Cancelled POs → Don't count as anything
  const purchaseOrdersTotal = useMemo(() => {
    const rawPOs = projectData?.purchaseOrders || [];
    
    // Reduced logging to prevent terminal glitching
    
    // Include ONLY Pending POs (not yet paid for)
    const activePOs = rawPOs.filter(po => 
      po.status === 'Pending'
    );
    
    const poObjectsTotal = activePOs.reduce((sum, po) => {
      let amount = 0;
      if (typeof po.amount === 'string') {
        amount = parseFloat(po.amount) || 0;
      } else if (typeof po.amount === 'number') {
        amount = po.amount;
      } else {
        amount = Number(po.amount) || 0;
      }
      return sum + amount;
    }, 0);
    
    // Reduced logging to prevent terminal glitching
    
    return poObjectsTotal;
  }, [projectData?.purchaseOrders, contextProjectData?.purchaseOrders]);

  // Calculate Change Orders total - includes both CO objects and expenses with category "Change Orders"
  const changeOrdersTotal = useMemo(() => {
    // First, sum up Change Order objects (normalized)
    const coObjectsTotal = normalizedChangeOrders.reduce((sum, co) => {
      const amount = typeof co.amount === 'number' ? co.amount : Number(co.amount) || 0;
      return sum + amount;
    }, 0);
    
    // Second, sum up expenses with category "Change Orders"
    const expenses = projectData?.expenses || [];
    const coExpenses = expenses.filter((exp: any) =>
      (exp?.category || '').toLowerCase() === 'change orders'
    );
    
    const coExpensesTotal = coExpenses.reduce((sum, exp) => {
      const amount = typeof exp.amount === 'number' ? exp.amount : Number(exp.amount) || 0;
      return sum + amount;
    }, 0);
    
    const total = coObjectsTotal + coExpensesTotal;
    
    // Reduced logging to prevent terminal glitching
    
    return total;
  }, [normalizedChangeOrders, projectData?.expenses]);

  const approvedChangeOrderAllocations = useMemo(
    () =>
      normalizedChangeOrders.reduce(
        (totals, co) => {
          if (!(co.approved || co.status === 'Approved')) return totals;
          return {
            materials:
              totals.materials + safe(co.materialsAmount ?? 0),
            labor:
              totals.labor + safe(co.laborAmount ?? 0),
          };
        },
        { materials: 0, labor: 0 }
      ),
    [normalizedChangeOrders]
  );

  // Use projectData.buckets as the base estimate buckets, then apply approved CO breakdown
  // only to the visible Material/Labor cards so approved AI change orders show up where
  // users expect without changing the underlying financial cap calculations.
  const buckets = useMemo(() => {
    const list = projectData?.buckets || [];
    return list.map((bucket: any) => {
      const bucketName = String(bucket?.name || '').toLowerCase();
      const isMaterialsBucket =
        bucketName.includes('material') || bucketName.includes('equipment');
      const isLaborBucket = bucketName.includes('labor');
      const approvedCoBudget =
        isMaterialsBucket
          ? approvedChangeOrderAllocations.materials
          : isLaborBucket
            ? approvedChangeOrderAllocations.labor
            : 0;

      return {
        ...bucket,
        budget: safe(bucket?.budget) + approvedCoBudget,
        bidBudget: safe(bucket?.bidBudget ?? bucket?.budget) + approvedCoBudget,
      };
    });
  }, [projectData?.buckets, approvedChangeOrderAllocations]);
  
  // Memoize buckets with stable IDs to prevent unnecessary re-renders
  const stableBuckets = useMemo(() => {
    return buckets.map((bucket, index) => ({
      ...bucket,
      stableId: bucket.id || `bucket-${bucket.name}-${index}`,
    }));
  }, [buckets]);

  // Calculate Received Purchase Orders total (these should be included in Actual Expenses)
  const receivedPOsTotal = useMemo(() => {
    const rawPOs = projectData?.purchaseOrders || [];
    const receivedPOs = rawPOs.filter(po => po.status === 'Received');
    
    const total = receivedPOs.reduce((sum, po) => {
      let amount = 0;
      if (typeof po.amount === 'string') {
        amount = parseFloat(po.amount) || 0;
      } else if (typeof po.amount === 'number') {
        amount = po.amount;
      } else {
        amount = Number(po.amount) || 0;
      }
      return sum + amount;
    }, 0);
    
    // Reduced logging to prevent terminal glitching
    
    return total;
  }, [projectData?.purchaseOrders]);

  // Actual Expenses = sum(expenses) + received POs. For Nick: 6500 materials + 1500 POs = 8000.
  // Use sum(expenses) + receivedPOsTotal (not spent) so received POs are always included.
  const actual = useMemo(() => {
    const expensesTotal = (projectData?.expenses || []).reduce((s, e) => s + safe(e.amount), 0);
    return expensesTotal + receivedPOsTotal;
  }, [projectData?.expenses, receivedPOsTotal]);
  const committed = safe(projectData?.committedPOs || 0);
  const remaining = Math.max(
    financials.adjustedCostBudget - actual - purchaseOrdersTotal,
    0
  );
  const ed = (projectFromList as any)?.estimateData || (projectData as any)?.estimateData || {};
  const milestoneProgressPct = useMemo(() => {
    const milestoneSources = [
      (projectFromList as any)?.milestones,
      (projectData as any)?.milestones,
      ed?.paymentMilestones,
      ed?.milestones,
    ];
    const all = milestoneSources.find((arr) => Array.isArray(arr) && arr.length > 0) || [];
    if (!Array.isArray(all) || all.length === 0) return 0;
    const normalized = all.map((m: any) => {
      const raw = Number(m?.progressPct);
      if (Number.isFinite(raw) && raw >= 0) return Math.min(100, raw);
      const st = String(m?.status || '').toLowerCase();
      if (st === 'completed') return 100;
      if (st === 'in_progress') return 50;
      return 0;
    });
    return normalized.reduce((sum, n) => sum + n, 0) / normalized.length;
  }, [projectFromList, projectData, ed]);
  const progressForForecast = useMemo(() => {
    const status = String((projectFromList as any)?.status ?? (projectData as any)?.status ?? '').toLowerCase();
    if (status === 'completed') return 100;
    const explicit = firstPositiveNumber(
      (projectFromList as any)?.overallProgressPct,
      (projectFromList as any)?.progress,
      (projectData as any)?.overallProgressPct,
      (projectData as any)?.progress
    ) ?? 0;
    return Math.max(explicit, milestoneProgressPct);
  }, [projectFromList, projectData, milestoneProgressPct]);
  const isProjectCompleted = useMemo(() => {
    const status = String((projectFromList as any)?.status ?? (projectData as any)?.status ?? '').toLowerCase();
    return status === 'completed';
  }, [projectFromList, projectData]);
  const contractCollectedPct = useMemo(
    () =>
      contractCollectedPctFromMilestones(
        ((projectFromList as any)?.milestones ||
          (projectData as any)?.milestones ||
          ed?.paymentMilestones) as unknown[] | undefined,
        financials.adjustedContractValue
      ),
    [projectFromList, projectData, ed?.paymentMilestones, financials.adjustedContractValue]
  );
  const elapsedTimePct = useMemo(
    () =>
      computeElapsedCalendarPct(
        (projectFromList as any)?.startISO ?? (projectData as any)?.startISO,
        (projectFromList as any)?.endISO ?? (projectData as any)?.endISO
      ),
    [projectFromList, projectData]
  );
  const computedProfitForecast = useMemo(
    () =>
      computeProfitForecast({
        contractValue: financials.adjustedContractValue,
        adjustedBudget:
          financials.adjustedCostBudget > 0
            ? financials.adjustedCostBudget
            : financials.adjustedContractValue,
        estimatedCostBaseline:
          financials.plannedCostBudget > 0 ? financials.plannedCostBudget : undefined,
        actualExpenses: actual,
        committedPOs: purchaseOrdersTotal,
        progressPct: progressForForecast,
        contractCollectedPct,
        elapsedTimePct,
        isCompleted: isProjectCompleted,
      }),
    [
      financials.adjustedContractValue,
      financials.adjustedCostBudget,
      financials.plannedCostBudget,
      actual,
      purchaseOrdersTotal,
      progressForForecast,
      contractCollectedPct,
      elapsedTimePct,
      isProjectCompleted,
    ]
  );
  const profitForecast = profitForecastOverride ?? computedProfitForecast;
  const estimateFeedback = useMemo(
    () =>
      deriveEstimateFeedbackFromBudgetData({
        projectId,
        status: String((projectFromList as any)?.status ?? (projectData as any)?.status ?? ''),
        lines: data?.lines || [],
        expenses: (projectData?.expenses || []).map((expense: any) => ({
          id: String(expense.id),
          category: expense.category,
          description: expense.description ?? expense.notes,
          vendor: expense.vendor,
          amount: expense.amount,
          date: expense.date,
          receiptUri: expense.receiptUri || undefined,
          aiConfidence: expense.aiConfidence,
          linkedLineId: expense.linkedLineId,
        })),
        changeOrders: (projectData?.changeOrders || []).map((co: any) => ({
          id: String(co.id),
          title: co.title,
          amount: co.amount,
          status: co.status,
          approved: co.approved,
          materialsAmount: co.materialsAmount,
          laborAmount: co.laborAmount,
        })),
        plannedBudget: financials.plannedCostBudget || financials.adjustedCostBudget,
        finalCustomerPrice: financials.adjustedContractValue,
      }),
    [
      projectId,
      projectFromList,
      projectData?.status,
      projectData?.expenses,
      projectData?.changeOrders,
      data?.lines,
      financials.plannedCostBudget,
      financials.adjustedCostBudget,
      financials.adjustedContractValue,
    ]
  );

  // Calculate projected costs for alerts
  const projectedTotal = actual + (purchaseOrdersTotal * 0.8); // Assume 80% of committed POs will be spent
  
  // Prepare category data for alerts
  const categorySnapshots = useMemo(() => {
    const materials = stableBuckets.find(b => b.name.toLowerCase().includes('material'));
    const labor = stableBuckets.find(b => b.name.toLowerCase().includes('labor'));
    const equipment = stableBuckets.find(b => b.name.toLowerCase().includes('equipment') || b.name.toLowerCase().includes('equip'));
    
    return [
      { name: 'materials' as const, budget: materials?.budget || 0, projected: (materials?.spent || 0) * 1.2 },
      { name: 'labor' as const, budget: labor?.budget || 0, projected: (labor?.spent || 0) * 1.15 },
      { name: 'equipment' as const, budget: equipment?.budget || 0, projected: (equipment?.spent || 0) * 1.1 },
    ];
  }, [stableBuckets]); // Use stableBuckets to prevent unnecessary recalculations

  // Get budget alerts
  const alerts = useBudgetAlerts({
    projectId: projectData?.id || 'default',
    thresholds,
    overall: { planned: financials.adjustedCostBudget, projected: projectedTotal },
    categories: categorySnapshots,
    notify: false, // Disable push in Expo Go
  });

  // Reduced logging to prevent terminal glitching

  const onGenerateDraft = async () => {
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert(
        'Budget Generated',
        'AI has generated 3 new budget items:\n• Framing crew (40 hrs @ $55/hr)\n• Lumber package ($2,500)\n• Electrical rough-in ($1,200)\n\nIn a real app, these would be added to your budget.',
        [{ text: 'OK', onPress: () => onRefetch?.() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to generate budget. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  // TODO: wire real hooks
  // const { mutate: draftBudget } = useAiDraftBudget();
  // const { mutate: categorize } = useAiCategorize();
  // const { mutate: ingestReceipt } = useAiReceiptIngest();

  const usageRatio =
    financials.adjustedCostBudget > 0 ? actual / financials.adjustedCostBudget : 0;
  const usagePercent = Math.min(Math.max(usageRatio * 100, 0), 200);
  const remainingPercent = Math.max(0, 100 - Math.min(usagePercent, 100));

  type UsageTone = 'green' | 'yellow' | 'orange' | 'red';

  const tone: UsageTone =
    usageRatio >= 0.75
      ? 'red'
      : usageRatio >= 0.5
        ? 'orange'
        : usageRatio >= 0.25
          ? 'yellow'
          : 'green';

  /** Softer than hero #22C55E so “available” doesn’t compete with projected profit */
  const remainingAvailableAccent = '#86efac';
  const remainingColor =
    tone === 'red'
      ? '#ef4444'
      : tone === 'orange'
        ? '#f97316'
        : tone === 'yellow'
          ? '#facc15'
          : remainingAvailableAccent;

  const theme = darkMode
    ? {
        background: ['#0b1c38', '#1B365D', '#22c55e'],
        text: '#f1f5f9',
        subtext: 'rgba(255,255,255,0.85)',
        card: '#1B365D',
        border: 'rgba(255, 255, 255, 0.1)',
        accent: '#22c55e',
      }
    : {
        background: ['#f5f7fa', '#c3cfe2', '#fff'],
        text: '#1e293b',
        subtext: '#64748b',
        card: '#ffffff',
        border: 'rgba(0, 0, 0, 0.1)',
        accent: '#1976d2',
      };

  /** Match project Overview secondary text: neutral grey / soft white (see [id].tsx mutedLabel). */
  const pageSubtext = darkMode ? 'rgba(255,255,255,0.88)' : '#8891a0';
  const pageCaption = darkMode ? 'rgba(255,255,255,0.78)' : '#8891a0';
  /** Tertiary: instructional one-liners (e.g. usage bar) — dimmer than row sublabels */
  const pageInstructional = darkMode ? 'rgba(255,255,255,0.56)' : '#94a3b8';

  /** Budget Totals: row labels + helper lines under margin rows */
  const budgetTotalsTheme = {
    ...theme,
    subtext: pageSubtext,
    helperSubtext: pageCaption,
    instructionalHint: pageInstructional,
    /** ~4.6:1 on black — clearer than 0.5 white while staying “secondary” vs values */
    metricLabelColor: darkMode ? 'rgba(255,255,255,0.64)' : 'rgba(15,23,42,0.62)',
    valueNeutral: darkMode ? '#F5F7FA' : theme.text,
  };

  const totalSpent = actual;
  const isCostControl = budgetAccessMode === 'cost_control';
  const pageTitle = isCostControl ? 'Cost Control' : 'Budget';
  const pageSubtitle = isCostControl
    ? 'Approved cost budget, actuals, POs, and category usage'
    : 'Detailed cost tracking, profitability, and category performance';
  const costSectionTitle = isCostControl ? 'Cost Control' : 'Contract & Cost';

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      <ScrollView
        ref={budgetScrollViewRef}
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 24 }}
      >
        {/* Wide Container - matches Overview page */}
        <View
          style={[
            styles.outerCard,
            styles.budgetContainerWide,
            embedded && styles.budgetContainerEmbedded,
            !darkMode && { backgroundColor: Colors.bg },
          ]}
        >
          {/* Green → blue gradient frame (matches Project Overview) */}
          <LinearGradient
            colors={['#2DFFC4', '#00A6FF']}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.overviewGradientRing}
          >
            <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
              {/* Budget page header — matches Project Overview (overviewPageHeader / title / subtitle) */}
              <View style={styles.budgetPageHeader}>
                <Text style={[styles.budgetPageTitle, { color: darkMode ? '#F5F7FA' : Colors.text }]}>
                  {pageTitle}
                </Text>
                <Text
                  style={[
                    styles.budgetPageSubtitle,
                    { color: darkMode ? 'rgba(255,255,255,0.62)' : '#64748b' },
                  ]}
                >
                  {pageSubtitle}
                </Text>
              </View>

              {/* Contract & cost detail */}
              <View style={[styles.sectionCardContainer, { marginTop: 0 }]}>
                <View
                  style={[
                    styles.sectionCard,
                    darkMode && styles.sectionCardElevated,
                    {
                      backgroundColor: Colors.surface2,
                      borderWidth: 1,
                      borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                    },
                  ]}
                >
                  <View style={styles.budgetCardHeaderMatch}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                      <View style={styles.budgetOverviewIconBadge}>
                        <MaterialIcons name="account-balance-wallet" size={16} color="#22c55e" />
                      </View>
                      <Text style={[styles.budgetSectionTitleMatch, { color: darkMode ? '#F5F7FA' : theme.text }]}>
                        {costSectionTitle}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.totalsContent}>
                    {!isCostControl ? (
                      <>
                        <Row
                          label="Contract Value"
                          value={money(financials.contractValueBase, currency)}
                          theme={budgetTotalsTheme}
                          variant="book"
                          metricLabel
                        />
                        {financials.approvedChangeOrderRevenue > 0 && (
                          <Row
                            label="Approved Change Orders"
                            value={`+ ${money(financials.approvedChangeOrderRevenue, currency)}`}
                            theme={budgetTotalsTheme}
                            variant="book"
                            metricLabel
                          />
                        )}
                        <Row
                          label="Adjusted Contract Value"
                          value={money(financials.adjustedContractValue, currency)}
                          theme={budgetTotalsTheme}
                          variant="book"
                          metricLabel
                        />
                        <View style={[styles.totalsDivider, { backgroundColor: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15, 23, 42, 0.10)' }]} />
                      </>
                    ) : null}
                    <Row
                      label={isCostControl ? 'Approved cost budget' : 'Planned Cost Budget'}
                      value={money(financials.adjustedCostBudget, currency)}
                      theme={budgetTotalsTheme}
                      variant="book"
                      metricLabel
                    />
                    <Row
                      label="Actual Costs"
                      value={money(actual, currency)}
                      theme={budgetTotalsTheme}
                      variant="book"
                      metricLabel
                    />
                    <Row
                      label="Committed POs"
                      value={money(purchaseOrdersTotal, currency)}
                      theme={budgetTotalsTheme}
                      variant="book"
                      metricLabel
                    />
                    <Row
                      label="Remaining Cost Budget"
                      value={money(remaining, currency)}
                      theme={budgetTotalsTheme}
                      variant="book"
                      metricLabel
                    />
                    <View style={styles.remainingSection}>
                      <Text
                        style={[styles.remainingLabelMetric, { color: budgetTotalsTheme.metricLabelColor }]}
                      >
                        Usage vs planned cost budget
                      </Text>
                      <Text style={[styles.remainingBarHint, { color: budgetTotalsTheme.instructionalHint }]}>
                        Fill = share of planned cost budget used (ticks at 25%, 50%, 75%).
                      </Text>
                      <Bar pct={remainingPercent} tone={tone} usagePct={usagePercent} />
                      <Text
                        style={[styles.remainingText, { color: remainingColor }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                      >
                        {remaining > 0
                          ? `${money(remaining, currency)} available`
                          : `Over budget by ${money(Math.abs(remaining), currency)}`}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

            </View>
            </LinearGradient>
          </View>

          {/* Tabs — each pill sits in an equal flex slot so width is 50/50 regardless of label / gradient */}
          <View style={styles.tabContainer}>
            <View style={styles.tabPillSlot}>
              <TabPill
                label='Line Items'
                active={tab === 'lines'}
                onPress={() => setTab('lines')}
                theme={theme}
                colors={Colors}
                darkMode={darkMode}
              />
            </View>
            <View style={styles.tabPillSlot}>
              <TabPill
                label='Orders'
                active={tab === 'cos'}
                onPress={() => setTab('cos')}
                theme={theme}
                colors={Colors}
                darkMode={darkMode}
              />
            </View>
          </View>

          {tab === 'lines' && (
            <View style={{ marginTop: 12 }}>
              <LinearGradient
                colors={['#2DFFC4', '#00A6FF']}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.overviewGradientRing}
              >
                <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
                  {/* Header for Budget Categories — same type scale as main Budget page */}
                  <View style={styles.budgetPageHeader}>
                    <Text style={[styles.budgetPageTitle, { color: darkMode ? '#F5F7FA' : Colors.text }]}>
                      Budget Categories
                    </Text>
                    <Text
                      style={[
                        styles.budgetPageSubtitle,
                        { color: darkMode ? 'rgba(255,255,255,0.62)' : '#64748b' },
                      ]}
                    >
                      Track spending by category
                    </Text>
                  </View>

                  {stableBuckets.map((item, index) => {
                    const budgetValue = Number(item.budget ?? 0);
                    const spent = Number(item.spent ?? 0);
                    const spentPercent = Math.min(100, (spent / Math.max(budgetValue, 1)) * 100);
                    const isOverBudget = spent > budgetValue;
                    const itemName = String(item.name || 'Unknown');
                    const categoryIconName = itemName.toLowerCase().includes('labor')
                      ? 'engineering'
                      : itemName.toLowerCase().includes('materials') ||
                          itemName.toLowerCase().includes('equipment')
                        ? 'construction'
                        : itemName.toLowerCase().includes('allowance')
                          ? 'account-balance-wallet'
                          : itemName.toLowerCase().includes('subs')
                            ? 'people'
                            : 'inventory';

                    return (
                      <View key={item.stableId || item.id || `budget-item-${index}`} style={[styles.budgetCardContainer, { marginTop: index === 0 ? 0 : 12 }]}>
                        <View style={[styles.budgetCard, { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line, borderRadius: 14 }]}>
                      <Pressable
                        onPress={() => setSelectedCategory(itemName)}
                        style={{ flex: 1 }}
                      >
                        <View style={styles.budgetCardHeader}>
                          {isOverBudget && (
                            <View style={[styles.warningBadge, { backgroundColor: theme.accent, position: 'absolute', top: 0, right: 0, zIndex: 2 }]}>
                              <Text style={styles.warningBadgeText}>Over Budget</Text>
                            </View>
                          )}
                          <View style={styles.budgetCardHeaderMain}>
                            <MaterialIcons name={categoryIconName as any} size={22} color="#22c55e" style={{ marginTop: 2 }} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View style={styles.budgetCardTitleRow}>
                                <Text style={[styles.budgetCardTitle, { color: theme.text, textAlign: 'left', flex: 1 }]} numberOfLines={2}>
                                  {itemName}
                                </Text>
                                <Text style={[styles.budgetCurrentTag, { color: pageCaption }]}>Current</Text>
                              </View>
                              <Text style={[styles.budgetTapHint, { color: theme.accent }]}>
                                Tap to view transactions →
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.budgetStatusRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.rowLabelMetric, { color: budgetTotalsTheme.metricLabelColor }]}>
                              Budget
                            </Text>
                            <Text
                              style={[
                                styles.rowValueMetric,
                                { color: budgetTotalsTheme.valueNeutral, marginTop: 6 },
                              ]}
                            >
                              {money(budgetValue, currency)}
                            </Text>
                          </View>
                          <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={[styles.rowLabelMetric, { color: budgetTotalsTheme.metricLabelColor }]}>
                              Spent
                            </Text>
                            <Text
                              style={[
                                styles.rowValueMetric,
                                {
                                  color: isOverBudget ? theme.accent : budgetTotalsTheme.valueNeutral,
                                  marginTop: 6,
                                },
                              ]}
                            >
                              {money(spent, currency)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.progressBarContainer}>
                          <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                            <LinearGradient
                              colors={isOverBudget ? ['#ef4444', '#f59e0b'] : ['#22c55e', '#22d3ee']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[
                                styles.progressBarFill, 
                                { 
                                  width: `${Math.min(spentPercent, 100)}%`,
                                }
                              ]} 
                            />
                          </View>
                          <View style={styles.categoryMetaRow}>
                            {isOverBudget ? (
                              <Text style={[styles.categoryRemainingEmphasis, { color: theme.accent }]}>
                                Over by {money(spent - budgetValue, currency)}
                              </Text>
                            ) : (
                              <Text style={[styles.categoryRemainingEmphasis, { color: theme.text }]}>
                                Remaining {money(budgetValue - spent, currency)}
                              </Text>
                            )}
                            <Text style={[styles.categoryPercentMuted, { color: pageInstructional }]}>
                              {spentPercent.toFixed(1)}% used
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </LinearGradient>

              {estimateFeedback.status !== 'insufficient_data' &&
              (Number(estimateFeedback.projectSummary.mappedActualCoveragePercent) > 0 ||
                estimateFeedback.projectSummary.directCostVariancePercent != null ||
                estimateFeedback.rateSuggestions.length > 0 ||
                estimateFeedback.assumptionSuggestions.length > 0) ? (
                <View style={[styles.sectionCardContainer, { marginTop: 12 }]}>
                  <View
                    style={[
                      styles.sectionCard,
                      darkMode && styles.sectionCardElevated,
                      {
                        backgroundColor: Colors.surface2,
                        borderWidth: 1,
                        borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                      },
                    ]}
                  >
                    <View style={styles.budgetCardHeaderMatch}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                        <View style={styles.budgetOverviewIconBadge}>
                          <MaterialIcons name="analytics" size={16} color="#22c55e" />
                        </View>
                        <Text style={[styles.budgetSectionTitleMatch, { color: darkMode ? '#F5F7FA' : theme.text }]}>
                          Estimate vs actual
                        </Text>
                      </View>
                      <Text style={{ color: pageCaption, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>
                        {estimateFeedback.status === 'ready_for_review'
                          ? 'Ready to review'
                          : estimateFeedback.status === 'partial'
                            ? 'Partial data'
                            : estimateFeedback.status === 'reviewed'
                              ? 'Reviewed'
                              : estimateFeedback.status === 'calibration_applied'
                                ? 'Applied'
                                : estimateFeedback.status.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <View style={styles.totalsContent}>
                      <Row
                        label="Costs tracked"
                        value={`${estimateFeedback.projectSummary.mappedActualCoveragePercent}%`}
                        theme={budgetTotalsTheme}
                        variant="book"
                        metricLabel
                      />
                      <Row
                        label="Over / under estimate"
                        value={
                          estimateFeedback.projectSummary.directCostVariancePercent != null
                            ? `${estimateFeedback.projectSummary.directCostVariancePercent > 0 ? '+' : ''}${estimateFeedback.projectSummary.directCostVariancePercent}%`
                            : '—'
                        }
                        theme={budgetTotalsTheme}
                        variant="book"
                        metricLabel
                      />
                      <Row
                        label="Pricing tips"
                        value={`${estimateFeedback.rateSuggestions.length + estimateFeedback.assumptionSuggestions.length}`}
                        theme={budgetTotalsTheme}
                        variant="book"
                        metricLabel
                      />
                      {estimateFeedback.unresolvedMappings.length > 0 ? (
                        <Text style={{ color: '#fbbf24', fontSize: 12, lineHeight: 17, marginTop: 8 }}>
                          {estimateFeedback.unresolvedMappings.length} cost
                          {estimateFeedback.unresolvedMappings.length === 1 ? '' : 's'} still need review before
                          tips are reliable.
                        </Text>
                      ) : (
                        <Text style={{ color: '#22c55e', fontSize: 12, lineHeight: 17, marginTop: 8 }}>
                          Enough job costs are in to compare against the estimate. Tips still need your approval.
                        </Text>
                      )}
                      {DEFAULT_BUILD_WITH_AI_FEATURE_FLAGS.calibrationApproval ? (
                        <Pressable
                          onPress={() => setShowCalibrationReview(true)}
                          style={{
                            marginTop: 12,
                            backgroundColor: '#22c55e',
                            borderRadius: 10,
                            paddingVertical: 11,
                            alignItems: 'center',
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Review rate tips"
                        >
                          <Text style={{ color: '#04140C', fontWeight: '800', fontSize: 14 }}>
                            Review rate tips
                            {estimateFeedback.rateSuggestions.length
                              ? ` (${estimateFeedback.rateSuggestions.length})`
                              : ''}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
        )}

        {tab === 'cos' && (
          <View style={{ marginTop: 12 }}>
            <LinearGradient
              colors={['#2DFFC4', '#00A6FF']}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.overviewGradientRing}
            >
              <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
                {/* Header for Orders — same type scale as Budget Categories */}
                <View style={styles.budgetPageHeader}>
                  <Text style={[styles.budgetPageTitle, { color: darkMode ? '#F5F7FA' : Colors.text }]}>
                    Orders
                  </Text>
                  <Text
                    style={[
                      styles.budgetPageSubtitle,
                      { color: darkMode ? 'rgba(255,255,255,0.62)' : '#64748b' },
                    ]}
                  >
                    Purchase orders and change orders
                  </Text>
                </View>

                {/* Purchase Orders Card */}
                {(() => {
                  // Get all POs for display (show Pending, Received, but exclude Cancelled)
                  const individualPOs = (projectData?.purchaseOrders || [])
                    .filter(po => po.status !== 'Cancelled')
                    .sort((a, b) => new Date(a.expectedDelivery).getTime() - new Date(b.expectedDelivery).getTime());
                  
                  // Calculate total for display: includes ALL active POs (Pending + Received)
                  // This is different from purchaseOrdersTotal which only counts Pending (for budget calculations)
                  const poTotalForDisplay = individualPOs.reduce((sum, po) => {
                    let amount = 0;
                    if (typeof po.amount === 'string') {
                      amount = parseFloat(po.amount) || 0;
                    } else if (typeof po.amount === 'number') {
                      amount = po.amount;
                    } else {
                      amount = Number(po.amount) || 0;
                    }
                    return sum + amount;
                  }, 0);
                  
                  // Use the display total (includes Pending + Received)
                  const poTotal = poTotalForDisplay;
                  
                  // Reduced logging to prevent terminal glitching
                  
                  return (
                    <View key="purchase-orders-card" style={[styles.budgetCardContainer, { marginTop: 0 }]}>
                      <View style={[styles.budgetCard, { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line, borderRadius: 14 }]}>
                        <Pressable
                          onPress={() => setSelectedCategory('Purchase Orders')}
                          style={{ flex: 1 }}
                        >
                          <View style={styles.budgetCardHeader}>
                            <View style={styles.budgetCardHeaderMain}>
                              <MaterialIcons name="receipt-long" size={22} color="#22c55e" style={{ marginTop: 2 }} />
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <View style={styles.budgetCardTitleRow}>
                                  <Text style={[styles.budgetCardTitle, { color: theme.text, textAlign: 'left', flex: 1 }]}>
                                    Purchase Orders
                                  </Text>
                                  <Text style={[styles.budgetCurrentTag, { color: pageCaption }]}>Current</Text>
                                </View>
                                <Text style={[styles.budgetTapHint, { color: theme.accent }]}>
                                  Tap to view transactions →
                                </Text>
                              </View>
                            </View>
                          </View>

                          <View style={styles.budgetCardFooterRow}>
                            <Text style={[styles.rowLabelMetric, { color: budgetTotalsTheme.metricLabelColor }]}>
                              Total
                            </Text>
                            <Text style={[styles.rowValueMetric, { color: budgetTotalsTheme.valueNeutral }]}>
                              {money(poTotal, currency)}
                            </Text>
                          </View>
                        </Pressable>

                      </View>
                    </View>
                  );
                })()}

                {/* Change Orders Card */}
                {(() => {
                  // Get the EXACT same array that individual items use
                  // Fallback to raw change orders if normalization fails
                  const individualCOs = normalizedChangeOrders.length > 0 
                    ? normalizedChangeOrders 
                    : (projectData?.changeOrders || []).map((co: any) => ({
                        id: String(co.id || ''),
                        title: String(co.title || 'Change Order'),
                        amount: Number(co.amount || 0),
                        status: (co.status || (co.approved ? 'Approved' : 'Submitted')) as 'Draft' | 'Submitted' | 'Approved' | 'Rejected',
                        materialsAmount: co.materialsAmount ? Number(co.materialsAmount) : undefined,
                        laborAmount: co.laborAmount ? Number(co.laborAmount) : undefined,
                        notes: co.notes,
                        approved: co.approved || co.status === 'Approved',
                        date: co.date || new Date().toISOString(),
                      }));
                  
                  
                  // Use the changeOrdersTotal from useMemo (includes both COs and expenses with category "Change Orders")
                  const coTotal = changeOrdersTotal;
                  
                  return (
                    <View key="change-orders-card" style={[styles.budgetCardContainer, { marginTop: 12 }]}>
                      <View style={[styles.budgetCard, { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line, borderRadius: 14 }]}>
                        <Pressable
                          onPress={() => setSelectedCategory('Change Orders')}
                          style={{ flex: 1 }}
                        >
                      <View style={styles.budgetCardHeader}>
                        <View style={styles.budgetCardHeaderMain}>
                          <Text style={{ fontSize: 22, marginTop: 2 }}>📝</Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={styles.budgetCardTitleRow}>
                              <Text style={[styles.budgetCardTitle, { color: theme.text, textAlign: 'left', flex: 1 }]}>
                                Change Orders
                              </Text>
                              <Text style={[styles.budgetCurrentTag, { color: pageCaption }]}>Current</Text>
                            </View>
                            <Text style={[styles.budgetTapHint, { color: theme.accent }]}>
                              Tap to view transactions →
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.budgetCardFooterRow}>
                        <Text style={[styles.rowLabelMetric, { color: budgetTotalsTheme.metricLabelColor }]}>
                          Total
                        </Text>
                        <Text style={[styles.rowValueMetric, { color: budgetTotalsTheme.valueNeutral }]}>
                          {money(coTotal, currency)}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
                  );
                })()}
              </View>
            </LinearGradient>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Editor Sheet (lightweight inline) */}
      {editing && (
        <View
          style={[
            styles.editorSheet,
            {
              backgroundColor: darkMode
                ? 'rgba(15, 23, 42, 0.95)'
                : 'rgba(248, 250, 252, 0.95)',
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.editorTitle, { color: theme.text }]}>
            {editing.id ? 'Edit Line' : 'New Line'}
          </Text>
          <Field label='Category' theme={theme}>
            <TextInput
              value={editing.category}
              onChangeText={t => setEditing({ ...editing, category: t })}
              placeholder='e.g., Concrete'
              placeholderTextColor={theme.subtext}
              style={[styles.textInput, { color: theme.text }]}
            />
          </Field>
          <Field label='Description' theme={theme}>
            <TextInput
              value={editing.description}
              onChangeText={t => setEditing({ ...editing, description: t })}
              onBlur={() => {
                /* categorize({ text: editing.description }) */
              }}
              placeholder='Describe the work'
              placeholderTextColor={theme.subtext}
              style={[styles.textInput, { color: theme.text }]}
            />
          </Field>
          <View style={styles.inputRow}>
            <Field label='Qty' className='flex-1' theme={theme}>
              <TextInput
                keyboardType='numeric'
                value={String(editing.qty ?? 0)}
                onChangeText={t =>
                  setEditing({ ...editing, qty: Number(t) || 0 })
                }
                style={[styles.textInput, { color: theme.text }]}
              />
            </Field>
            <Field label='Unit' className='flex-1' theme={theme}>
              <TextInput
                value={editing.unit}
                onChangeText={t => setEditing({ ...editing, unit: t })}
                style={[styles.textInput, { color: theme.text }]}
              />
            </Field>
            <Field label='Unit Cost' className='flex-1' theme={theme}>
              <TextInput
                keyboardType='numeric'
                value={String(editing.unitCost ?? 0)}
                onChangeText={t =>
                  setEditing({ ...editing, unitCost: Number(t) || 0 })
                }
                style={[styles.textInput, { color: theme.text }]}
              />
            </Field>
          </View>
          <View style={styles.lineCostRow}>
            <Text style={[styles.lineCostLabel, { color: theme.subtext }]}>
              Line Cost
            </Text>
            <Text style={[styles.lineCostValue, { color: theme.text }]}>
              {money(lineBase(editing), currency)}
            </Text>
          </View>

          <View style={styles.editorActions}>
            <Pressable
              onPress={() => {
                setEditing(null);
              }}
              style={[
                styles.editorButton,
                styles.cancelButton,
                { borderColor: theme.border },
              ]}
            >
              <Text style={[styles.editorButtonText, { color: theme.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                /* save via API then onRefetch?.() */ setEditing(null);
              }}
              style={[styles.editorButton, styles.saveButton]}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Add Expense Modal */}
      <Modal
        visible={showExpenseModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowExpenseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Expense</Text>
            
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              placeholder="Vendor"
              placeholderTextColor={theme.subtext}
              value={newExpense.vendor}
              onChangeText={(text) => setNewExpense({...newExpense, vendor: text})}
            />
            
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              placeholder="Amount"
              placeholderTextColor={theme.subtext}
              keyboardType="numeric"
              value={newExpense.amount}
              onChangeText={(text) => setNewExpense({...newExpense, amount: text})}
            />
            
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              placeholder="Category"
              placeholderTextColor={theme.subtext}
              value={newExpense.category}
              onChangeText={(text) => setNewExpense({...newExpense, category: text})}
            />
            
            <TextInput
              style={[styles.modalInput, styles.modalTextArea, { color: theme.text, borderColor: theme.border }]}
              placeholder="Notes (optional)"
              placeholderTextColor={theme.subtext}
              multiline
              numberOfLines={3}
              value={newExpense.notes}
              onChangeText={(text) => setNewExpense({...newExpense, notes: text})}
            />
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowExpenseModal(false);
                  setNewExpense({ vendor: '', amount: '', category: '', notes: '' });
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[styles.modalButton, styles.modalSubmitButton]}
                onPress={() => {
                  if (newExpense.vendor && newExpense.amount) {
                    addExpense({
                      id: Date.now().toString(),
                      vendor: newExpense.vendor,
                      amount: parseFloat(newExpense.amount),
                      category: newExpense.category,
                      notes: newExpense.notes,
                      date: new Date().toISOString(),
                    });
                    setShowExpenseModal(false);
                    setNewExpense({ vendor: '', amount: '', category: '', notes: '' });
                    Alert.alert('Success', 'Expense added successfully!');
                  } else {
                    Alert.alert('Error', 'Please fill in vendor and amount');
                  }
                }}
              >
                <Text style={styles.modalSubmitButtonText}>Add Expense</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Change Order Modal */}
      <Modal
        visible={showChangeOrderModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowChangeOrderModal(false)}
      >
        <LinearGradient
          colors={['#020617', '#010409']}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.backBtnWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backBtnBorder}
              >
                <GradientRingBackInner
                  darkMode
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowChangeOrderModal(false);
                    setEditingChangeOrder(null);
                    setNewChangeOrder({ title: '', amount: '', materialsAmount: '', laborAmount: '', notes: '' });
                  }}
                  style={styles.backBtn}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </GradientRingBackInner>
              </LinearGradient>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.headerIconContainer}>
                  <MaterialIcons name="edit-document" size={24} color="#10f297" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>
                  {editingChangeOrder ? 'Edit Change Order' : 'Add Change Order'}
                </Text>
                  <Text style={styles.modalSubtitle}>Transactions & Invoices</Text>
              </View>
              </View>
            </View>
          </View>
          
          <ScrollView
            style={styles.modalForm}
            showsVerticalScrollIndicator={false}
            {...KEYBOARD_SCROLL_DEFAULTS}
          >
            {/* Total Spent Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardLabel}>Total Change Order Amount</Text>
              <Text style={styles.summaryCardAmount}>
                ${(editingChangeOrder ? parseFloat(editingChangeOrder.amount || '0') : parseFloat(newChangeOrder.amount || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            
            <View style={styles.field}>
              <Text style={styles.modalLabel}>Change Order Title</Text>
            <TextInput
                style={styles.modalInput}
              placeholder="e.g., Additional Kitchen Cabinets"
                placeholderTextColor="rgba(226,232,240,0.58)"
              value={editingChangeOrder ? editingChangeOrder.title : newChangeOrder.title}
              onChangeText={(text) => {
                if (editingChangeOrder) {
                  setEditingChangeOrder({...editingChangeOrder, title: text});
                } else {
                  setNewChangeOrder({...newChangeOrder, title: text});
                }
              }}
            />
            </View>
            
            <View style={styles.field}>
              <PricingModeSection
                pricingMode={changeOrderPricingMode}
                onPricingModeChange={(mode) => {
                  if (mode === changeOrderPricingMode) return;
                  setChangeOrderPricingMode(mode);
                  setChangeOrderSqftInput('');
                  setChangeOrderRateInput('');
                  if (editingChangeOrder) {
                    setEditingChangeOrder({
                      ...editingChangeOrder,
                      amount: '',
                      materialsAmount: '',
                      laborAmount: '',
                    });
                  } else {
                    setNewChangeOrder({
                      ...newChangeOrder,
                      amount: '',
                      materialsAmount: '',
                      laborAmount: '',
                    });
                  }
                }}
                sqftInput={changeOrderSqftInput}
                ratePerSqftInput={changeOrderRateInput}
                onSqftInputChange={onChangeOrderSqftChange}
                onRatePerSqftInputChange={onChangeOrderRateChange}
                amount={String(
                  editingChangeOrder != null
                    ? (editingChangeOrder.amount ?? '')
                    : newChangeOrder.amount
                )}
                onAmountChange={() => {}}
                sqftRef={changeOrderSqftRef}
                ratePerSqftRef={changeOrderRateRef}
                amountRef={changeOrderAmountRef}
                onSqftSubmitEditing={() => changeOrderRateRef.current?.focus()}
                onRateSubmitEditing={() => {}}
                flatModeLabel="Breakdown"
                flatReplacement={
                  <>
                    <Text style={styles.modalSubLabel}>Specify materials and labor amounts</Text>
                    <View style={[styles.breakdownBox, { overflow: 'hidden' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <MaterialCommunityIcons name="package-variant" size={24} color="#10f297" style={{ marginRight: 8 }} />
                        <Text style={styles.breakdownBoxLabel}>Materials</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.currencySymbol}>$</Text>
                        <TextInput
                          style={styles.breakdownInput}
                          placeholder="0.00"
                          placeholderTextColor="rgba(226,232,240,0.58)"
                          keyboardType="numeric"
                          underlineColorAndroid="transparent"
                          value={
                            editingChangeOrder
                              ? editingChangeOrder.materialsAmount?.toString() || ''
                              : newChangeOrder.materialsAmount
                          }
                          onChangeText={(text) => {
                            const numericValue = text.replace(/[^0-9.]/g, '');
                            if (editingChangeOrder) {
                              setEditingChangeOrder({ ...editingChangeOrder, materialsAmount: numericValue });
                            } else {
                              setNewChangeOrder({ ...newChangeOrder, materialsAmount: numericValue });
                            }
                            const materials = parseFloat(numericValue) || 0;
                            const labor =
                              parseFloat(
                                editingChangeOrder
                                  ? editingChangeOrder.laborAmount || '0'
                                  : newChangeOrder.laborAmount || '0'
                              ) || 0;
                            const total = materials + labor;
                            if (editingChangeOrder) {
                              setEditingChangeOrder({ ...editingChangeOrder, amount: total.toFixed(2) });
                            } else {
                              setNewChangeOrder({ ...newChangeOrder, amount: total.toFixed(2) });
                            }
                          }}
                        />
                      </View>
                    </View>
                    <View style={[styles.breakdownBox, { marginTop: 16, overflow: 'hidden' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <MaterialCommunityIcons name="hard-hat" size={24} color="#10f297" style={{ marginRight: 8 }} />
                        <Text style={styles.breakdownBoxLabel}>Labor</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.currencySymbol}>$</Text>
                        <TextInput
                          style={styles.breakdownInput}
                          placeholder="0.00"
                          placeholderTextColor="rgba(226,232,240,0.58)"
                          keyboardType="numeric"
                          underlineColorAndroid="transparent"
                          value={
                            editingChangeOrder
                              ? editingChangeOrder.laborAmount?.toString() || ''
                              : newChangeOrder.laborAmount
                          }
                          onChangeText={(text) => {
                            const numericValue = text.replace(/[^0-9.]/g, '');
                            if (editingChangeOrder) {
                              setEditingChangeOrder({ ...editingChangeOrder, laborAmount: numericValue });
                            } else {
                              setNewChangeOrder({ ...newChangeOrder, laborAmount: numericValue });
                            }
                            const materials =
                              parseFloat(
                                editingChangeOrder
                                  ? editingChangeOrder.materialsAmount || '0'
                                  : newChangeOrder.materialsAmount || '0'
                              ) || 0;
                            const labor = parseFloat(numericValue) || 0;
                            const total = materials + labor;
                            if (editingChangeOrder) {
                              setEditingChangeOrder({ ...editingChangeOrder, amount: total.toFixed(2) });
                            } else {
                              setNewChangeOrder({ ...newChangeOrder, amount: total.toFixed(2) });
                            }
                          }}
                        />
                      </View>
                    </View>
                  </>
                }
              />
            </View>
            
            <View style={styles.field}>
              <Text style={styles.modalLabel}>Notes (optional)</Text>
            <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Additional details about this change order..."
                placeholderTextColor="rgba(226,232,240,0.58)"
              multiline
              numberOfLines={3}
              value={editingChangeOrder ? editingChangeOrder.notes : newChangeOrder.notes}
              onChangeText={(text) => {
                if (editingChangeOrder) {
                  setEditingChangeOrder({...editingChangeOrder, notes: text});
                } else {
                  setNewChangeOrder({...newChangeOrder, notes: text});
                }
              }}
            />
            </View>
          </ScrollView>
            
          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={() => {
                setShowChangeOrderModal(false);
                setEditingChangeOrder(null);
                setNewChangeOrder({ title: '', amount: '', materialsAmount: '', laborAmount: '', notes: '' });
              }} 
              style={styles.modalCancelButton}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                const co = editingChangeOrder || newChangeOrder;
                if (!co.title?.trim()) {
                  Alert.alert('Error', 'Please enter a change order title');
                  return;
                }
                if (changeOrderPricingMode === 'sqft') {
                  const sq = parseFloat(changeOrderSqftInput.replace(/[^0-9.]/g, '')) || 0;
                  const rate = decimalMoneyInputToNumber(changeOrderRateInput);
                  if (sq <= 0 || rate <= 0) {
                    Alert.alert(
                      'Square feet & rate required',
                      'Enter square feet and rate ($/sq ft) to calculate the total, or switch to Flat amount.'
                    );
                    return;
                  }
                } else if (!(co.amount || co.materialsAmount || co.laborAmount)) {
                  Alert.alert('Error', 'Please fill in materials and/or labor, or switch to Per sq ft');
                  return;
                }

                let materials = 0;
                let labor = 0;
                let total = 0;
                if (changeOrderPricingMode === 'sqft') {
                  materials = 0;
                  labor = 0;
                  total = parseFloat(String(co.amount || '0')) || 0;
                } else {
                  materials = parseFloat(String(co.materialsAmount || '0')) || 0;
                  labor = parseFloat(String(co.laborAmount || '0')) || 0;
                  total = parseFloat(String(co.amount || '0')) || materials + labor;
                }

                if (!Number.isFinite(total) || total <= 0) {
                  Alert.alert('Invalid Amount', 'Please enter a valid total amount');
                  return;
                }

                if (editingChangeOrder) {
                    // Update existing change order - keep existing approval status
                    const updatedCO = {
                      ...editingChangeOrder,
                      title: co.title,
                      amount: total,
                      materialsAmount: materials,
                      laborAmount: labor,
                      notes: co.notes || '',
                      approved: editingChangeOrder.approved || editingChangeOrder.status === 'Approved',
                      status: editingChangeOrder.status || 'Submitted',
                    };
                    updateChangeOrder(updatedCO);
                    setEditingChangeOrder(null);
                    setShowChangeOrderModal(false);
                    setNewChangeOrder({ title: '', amount: '', materialsAmount: '', laborAmount: '', notes: '' });
                    Alert.alert('Success', 'Change order updated successfully!');
                  } else {
                    addChangeOrder({
                      id: `co-${Date.now()}`,
                      title: co.title,
                      amount: total,
                      materialsAmount: materials,
                      laborAmount: labor,
                      notes: co.notes || '',
                      approved: false,
                      status: 'Submitted',
                    });
                    setShowChangeOrderModal(false);
                    setNewChangeOrder({ title: '', amount: '', materialsAmount: '', laborAmount: '', notes: '' });
                    Alert.alert(
                      'Saved',
                      'Change order saved as submitted. When the customer approves, open Change Orders and tap Approve on the card to add it to your budget.'
                    );
                  }
              }}
              style={styles.modalSaveButtonWrap}
            >
              <LinearGradient
                colors={["#22c55e", "#22d3ee"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalSaveButtonGradient}
              >
                <Text style={styles.modalSaveButtonText} numberOfLines={1}>
                  ✓ {editingChangeOrder ? 'Update Change Order' : 'Add Change Order'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Modal>

      {/* Threshold Settings Modal */}
      <ThresholdSettingsSheet
        projectId={projectData?.id || 'default'}
        visible={thresholdModalVisible}
        onClose={() => setThresholdModalVisible(false)}
        onSaved={(newThresholds) => {
          setThresholds(newThresholds);
          Alert.alert('Saved', 'Alert thresholds updated successfully!');
        }}
      />

      {/* Category Detail Modal */}
      <CategoryDetailModal
        visible={selectedCategory !== null}
        categoryName={selectedCategory || ''}
        onClose={() => {
          setSelectedCategory(null);
          setPendingChangeOrderEditId(null);
        }}
        openChangeOrderEditId={
          selectedCategory === "Change Orders" ? pendingChangeOrderEditId : null
        }
        onConsumedOpenChangeOrderEditId={() => setPendingChangeOrderEditId(null)}
        onRequestOpenChangeOrder={(coId) => {
          setPendingChangeOrderEditId(coId);
          setSelectedCategory("Change Orders");
        }}
        theme={theme}
      />

      {/* Add Purchase Order Modal */}
      <AddPurchaseOrderModal
        visible={showPOModal}
        onClose={() => setShowPOModal(false)}
        onSave={(po) => {
          addPurchaseOrder(po);
          Alert.alert(
            'PO Created!',
            `${po.poNumber} for ${formatMoneyFull(po.amount, { decimals: 2 })} added to ${po.category}`,
            [{ text: 'OK' }]
          );
          setShowPOModal(false);
        }}
      />

      {/* Edit Purchase Order Modal */}
      <EditPurchaseOrderModal
        visible={editingPO !== null}
        purchaseOrder={editingPO}
        onClose={() => setEditingPO(null)}
        onSave={(po) => {
          updatePurchaseOrder(po);
          setEditingPO(null);
        }}
        onCancel={(id) => {
          cancelPO(id);
          setEditingPO(null);
        }}
      />

      <CalibrationReviewModal
        visible={showCalibrationReview}
        onClose={() => setShowCalibrationReview(false)}
        projectLike={{
          ...(projectFromList || {}),
          id: projectId,
          projectData: projectData || contextProjectData,
          contractValue: financials.adjustedContractValue,
          budget: financials.plannedCostBudget || financials.adjustedCostBudget,
        }}
        clientSuggestions={estimateFeedback.rateSuggestions}
        budgetAccessMode={budgetAccessMode}
        darkMode={darkMode}
        onApproved={() => {
          setShowCalibrationReview(false);
          onRefetch?.();
        }}
      />
    </View>
  );
}

// Components -------------------------------------------------------
function Row({
  label,
  sublabel,
  value,
  theme,
  valueColor,
  variant = 'book',
  metricLabel = false,
  valueEmphasis,
}: {
  label: string;
  sublabel?: string;
  value: string;
  theme: any;
  valueColor?: string;
  variant?: 'book' | 'intel';
  /** Match Overview Financial Health: uppercase muted labels + strong values */
  metricLabel?: boolean;
  /** Larger type for key profitability figures */
  valueEmphasis?: 'hero';
}) {
  const helperColor = theme.helperSubtext ?? theme.subtext;
  const labelMuted = theme.metricLabelColor ?? helperColor;
  const isIntel = variant === 'intel';
  return (
    <View style={[styles.row, isIntel ? styles.rowIntel : styles.rowBook]}>
      <View style={styles.rowLabelCol}>
        <Text
          style={[
            styles.rowLabel,
            metricLabel && styles.rowLabelMetric,
            { color: metricLabel ? labelMuted : theme.subtext },
          ]}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text style={[styles.rowSublabel, { color: helperColor }]}>{sublabel}</Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.rowValue,
          metricLabel && variant === 'book' && styles.rowValueMetric,
          metricLabel && variant === 'intel' && (valueEmphasis === 'hero' ? styles.rowValueIntelHero : styles.rowValueIntelMetric),
          !metricLabel && isIntel && styles.rowValueIntel,
          { color: valueColor ?? theme.text, fontVariant: ['tabular-nums'] },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit={metricLabel && variant === 'intel'}
        minimumFontScale={metricLabel && variant === 'intel' ? 0.88 : undefined}
      >
        {value}
      </Text>
    </View>
  );
}

function HeaderRow({ cols, theme }: { cols: string[]; theme: any }) {
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.headerText, { color: theme.subtext, flex: 1 }]}>
        {cols[0]}
      </Text>
      {cols.length > 1 && (
        <View style={{ flexDirection: 'row', flex: 2, justifyContent: 'space-between', paddingLeft: 8 }}>
          {cols.slice(1).map((col, idx) => (
            <Text key={idx} style={[styles.headerText, { color: theme.subtext, flex: 1, textAlign: 'right' }]} numberOfLines={1}>
              {col}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function TabPill({
  label,
  active,
  onPress,
  theme,
  colors,
  darkMode,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  theme: any;
  colors: any;
  darkMode: boolean;
}) {
  const activeLabelColor = darkMode ? '#050B13' : '#071018';
  if (active) {
    return (
      <Pressable onPress={onPress} style={styles.tabPillPressable}>
        <LinearGradient
          colors={['#22c55e', '#22d3ee']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.tabPillLabelRow} pointerEvents="none">
          <Text style={[styles.tabPillText, { color: activeLabelColor }]}>{label}</Text>
        </View>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabPillPressable,
        styles.tabPillInactive,
        {
          backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.6)' : colors.surface2,
          borderColor: colors.line,
        },
      ]}
    >
      <Text style={[styles.tabPillText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  theme,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  theme: any;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.secondaryButton,
        { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderColor: theme.border },
      ]}
    >
      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Bar({
  pct,
  tone = 'green' as 'green' | 'yellow' | 'orange' | 'red',
  usagePct,
}: {
  pct: number;
  tone?: 'green' | 'yellow' | 'orange' | 'red';
  usagePct?: number;
}) {
  const clamp = (value: number, min = 0, max = 100) =>
    Math.min(Math.max(value, min), max);
  const remaining = clamp(pct);
  const usage = clamp(usagePct ?? 100 - remaining, 0, 100);

  const getBarColor = () => {
    switch (tone) {
      case 'red':
        return '#ef4444';
      case 'orange':
        return '#f97316';
      case 'yellow':
        return '#facc15';
      case 'green':
      default:
        return '#22c55e';
    }
  };

  const getBarGradient = (): [string, string] => {
    switch (tone) {
      case 'red':
        return ['#ef4444', '#f97316'];
      case 'orange':
        return ['#f97316', '#facc15'];
      case 'yellow':
        return ['#facc15', '#f59e0b'];
      case 'green':
      default:
        return ['#22c55e', '#15803d'];
    }
  };

  const tickColor = 'rgba(255,255,255,0.28)';

  return (
    <View style={styles.barContainer}>
      <View style={[styles.barThreshold, { left: '25%', backgroundColor: tickColor }]} />
      <View style={[styles.barThreshold, { left: '50%', backgroundColor: tickColor }]} />
      <View style={[styles.barThreshold, { left: '75%', backgroundColor: tickColor }]} />
      <LinearGradient
        colors={getBarGradient()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.barUsage,
          {
            width: `${usage}%`,
          },
        ]}
      />
    </View>
  );
}

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
  theme: any;
}> = ({ label, children, className, theme }) => (
  <View style={[styles.field, className === 'flex-1' ? { flex: 1 } : {}]}>
    <Text style={[styles.fieldLabel, { color: theme.subtext }]}>{label}</Text>
    <View
      style={[
        styles.fieldInput,
        { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderColor: theme.border },
      ]}
    >
      {children}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    marginHorizontal: -20, // Extend beyond parent ScrollView padding
  },
  containerEmbedded: {
    marginHorizontal: 0,
  },
  scrollContent: { padding: 0 },
  outerCard: {
    backgroundColor: "#000000",
    marginBottom: 16,
  },
  budgetContainerWide: {
    marginHorizontal: 0, // Container already extends with -20, so 0 here extends to edges
    paddingHorizontal: 4, // Match dashboard wideContainer pattern
    paddingTop: 18,
    paddingBottom: 18,
  },
  /** Project detail: parent `wideContainer` matches Overview; no extra top inset so gradient aligns under AI PM */
  budgetContainerEmbedded: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 18,
  },
  overviewGradientRing: {
    borderRadius: 30,
    padding: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  overviewInner: {
    borderRadius: 29,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
  },
  /** Main page title block — mirrors project-detail overviewPageHeader / overviewPageTitle / overviewPageSubtitle */
  budgetPageHeader: {
    marginBottom: 16,
  },
  budgetPageTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  budgetPageSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  budgetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  budgetHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9FAFB",
    letterSpacing: 0.15,
  },
  budgetHeaderSubtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  sectionCardContainer: {
    marginTop: 12,
  },
  sectionCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 15,
  },
  /** Match project Overview Financial Health / innerCard headers */
  budgetCardHeaderMatch: {
    marginBottom: 18,
  },
  budgetOverviewIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  budgetSectionTitleMatch: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.08)',
  },
  spendingTrendTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  spendingTrendLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  spendingTrendCapLine: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  sectionCardElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  totalsContent: {
    padding: 0,
  },
  totalsDivider: {
    height: 1,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowBook: {
    paddingVertical: 8,
  },
  rowIntel: {
    paddingVertical: 8,
  },
  rowLabelCol: {
    flex: 1,
    paddingRight: 12,
  },
  rowLabel: { 
    fontSize: 15,
    lineHeight: 21,
  },
  rowLabelMetric: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rowSublabel: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    fontWeight: '500',
  },
  rowValue: { 
    fontSize: 16, 
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'right',
    maxWidth: '56%',
    flexShrink: 0,
  },
  rowValueIntel: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowValueIntelMetric: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.28,
  },
  rowValueIntelHero: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  rowValueMetric: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.28,
  },
  remainingSection: { marginTop: 12 },
  remainingLabel: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  remainingLabelMetric: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  remainingBarHint: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.15,
    marginBottom: 8,
  },
  remainingText: { fontSize: 13, fontWeight: '700', marginTop: 8, textAlign: 'right', maxWidth: '100%' },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 14,
    alignSelf: 'stretch',
    width: '100%',
  },
  /** Fixed 50% width each — children use width:100% so gradient/text can’t skew flex measurement */
  tabPillSlot: {
    flex: 1,
    minWidth: 0,
  },
  tabPillPressable: {
    width: '100%',
    minHeight: 40,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  tabPillLabelRow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  tabPillActiveShadow: {
    shadowColor: '#22c55e',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  tabPillInactive: {
    borderWidth: 1,
  },
  tabPillText: { fontSize: 13, fontWeight: '600' },
  tabContent: { borderRadius: 24, borderWidth: 1 },
  expensesContent: { padding: 8 },
  headerRow: { paddingHorizontal: 16, paddingVertical: 8 },
  headerText: { fontSize: 14 },
  lineItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  lineCategory: { fontSize: 16, fontWeight: '600' },
  lineDescription: { fontSize: 14, marginTop: 2 },
  lineCosts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  lineCostsExpanded: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  lineCost: { fontSize: 16 },
  lineBidBudget: { fontSize: 13, flex: 1, textAlign: 'right' },
  lineBudget: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  lineSpent: { fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right' },
  overBudgetIndicator: { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  budgetCardContainer: {
    marginBottom: 12,
  },
  budgetCard: {
    padding: 11,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    position: 'relative',
  },
  budgetCardHeaderMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  budgetCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  budgetCurrentTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  budgetTapHint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  /** Category / PO / CO card titles — matches project overview overviewHeroProjectName */
  budgetCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
    flexShrink: 1,
  },
  warningBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  warningBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  budgetAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
    gap: 12,
  },
  budgetAmountItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  budgetAmountLabel: {
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  budgetAmountValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarContainer: {
    marginBottom: 2,
    marginTop: 2,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'right',
    fontWeight: '500',
  },
  budgetStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.12)',
  },
  categoryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  categoryRemainingEmphasis: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  categoryPercentMuted: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.15,
  },
  budgetCardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 12,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.12)',
  },
  aiSuggested: { fontSize: 12, color: '#22c55e', marginTop: 4 },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  addButtonText: { fontSize: 16 },
  expenseItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  expenseHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  expenseVendor: { fontSize: 16, fontWeight: '500' },
  expenseAmount: { fontSize: 16 },
  expenseDate: { fontSize: 12, marginTop: 2 },
  aiConfidence: { fontSize: 10, color: '#22c55e', marginTop: 4 },
  expenseActions: { flexDirection: 'row', gap: 12, padding: 12 },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  changeOrderStatusText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  changeOrderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionButtonEdit: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  actionButtonApprove: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  actionButtonDelete: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  approveButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  editButton: {
    padding: 8,
  },
  changeOrderCardWrapper: {
    marginBottom: 16,
  },
  changeOrderCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  changeOrderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  changeOrderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeOrderCardTitle: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
    flexShrink: 1,
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  changeOrderTotalAmountContainer: {
    marginBottom: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  changeOrderTotalLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    opacity: 0.7,
  },
  changeOrderTotalAmount: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  changeOrderBreakdown: {
    marginTop: 0,
    marginBottom: 18,
    flexDirection: 'row',
    gap: 12,
  },
  breakdownItemCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  breakdownIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownText: {
    fontSize: 13,
    flex: 1,
  },
  breakdownAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  changeOrderNotesContainer: {
    marginTop: 0,
    marginBottom: 18,
    padding: 14,
    paddingLeft: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderLeftWidth: 3,
    borderLeftColor: '#10f297',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notesIndicator: {
    width: 3,
    height: '100%',
    backgroundColor: '#10f297',
    borderRadius: 2,
    marginRight: 12,
    marginTop: 2,
  },
  changeOrderNotes: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
    opacity: 0.85,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 0.15,
  },
  modalSubLabel: {
    fontSize: 13,
    marginBottom: 12,
    color: 'rgba(226, 232, 240, 0.62)',
    fontWeight: '500',
  },
  breakdownBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    marginBottom: 8,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    overflow: 'hidden',
    // Force override any default styles
    opacity: 1,
  },
  breakdownBoxLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
    color: '#10f297',
  },
  breakdownInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 4,
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    borderWidth: 0,
    minHeight: 40,
  },
  totalBox: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    marginTop: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
  },
  bottomSpacer: { height: 8 },
  editorSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 16,
  },
  editorTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 14, marginBottom: 4 },
  fieldInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textInput: { fontSize: 16 },
  inputRow: { flexDirection: 'row', gap: 12 },
  lineCostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  lineCostLabel: { fontSize: 16 },
  lineCostValue: { fontSize: 16, fontWeight: '500' },
  editorActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  editorButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 12,
  },
  cancelButton: { borderWidth: 1 },
  saveButton: { backgroundColor: '#22c55e' },
  editorButtonText: { fontSize: 16 },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '500' },
  barContainer: {
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    position: 'relative',
  },
  barUsage: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 999,
  },
  barThreshold: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.28)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.14)',
    shadowColor: 'transparent',
    elevation: 0,
  },
  summaryCardLabel: {
    color: 'rgba(226, 232, 240, 0.72)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryCardAmount: {
    color: '#22c55e',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 10,
    textAlign: 'right',
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.35,
    lineHeight: 32,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 15,
    color: '#FFFFFF',
    borderColor: 'rgba(148, 163, 184, 0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitButton: {
    backgroundColor: '#22c55e',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Budget Alerts Styles
  alertsContent: {
    padding: 0,
  },
  alertsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  thresholdButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  thresholdButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  alertsList: {
    gap: 8,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  alertIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  alertMessage: {
    color: 'white',
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  // Purchase Order Styles
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  poCard: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    marginBottom: 12,
  },
  poHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  poNumber: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  poAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  poStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  poStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  poFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(226, 232, 240, 0.78)',
    marginTop: 6,
    lineHeight: 20,
  },
  backBtnWrapper: {
    marginRight: 16,
  },
  backBtnBorder: {
    borderRadius: 22,
    padding: 1,
    overflow: "hidden",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 21,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalForm: {
    flex: 1,
    padding: 20,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: 'transparent',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: {
    color: 'rgba(226, 232, 240, 0.78)',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyStateCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  modalSaveButtonWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  modalSaveButtonGradient: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modalSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.25,
    textAlign: 'center',
  },
});
