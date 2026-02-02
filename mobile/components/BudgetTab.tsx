import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatMoneyFull } from '../src/lib/budgetUtils';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useBudgetAlerts } from '../src/hooks/useBudgetAlerts';
import { loadThresholds, Thresholds } from '../src/lib/thresholds';
import ThresholdSettingsSheet from './ThresholdSettingsSheet';
import CategoryDetailModal from './CategoryDetailModal';
import AddPurchaseOrderModal from './AddPurchaseOrderModal';
import EditPurchaseOrderModal from './EditPurchaseOrderModal';

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
}: {
  data?: BudgetData;
  onRefetch?: () => void;
  embedded?: boolean;
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
  const [newExpense, setNewExpense] = useState({ vendor: '', amount: '', category: '', notes: '' });
  const [newChangeOrder, setNewChangeOrder] = useState({ title: '', amount: '', materialsAmount: '', laborAmount: '', notes: '' });
  const [editingChangeOrder, setEditingChangeOrder] = useState<any>(null);

  const router = useRouter();
  const { projectData: contextProjectData, addExpense, addChangeOrder, updateChangeOrder, deleteChangeOrder, approveChangeOrder, addPurchaseOrder, updatePurchaseOrder, markPOReceived, cancelPO, reloadFromStorage } = useProjectData();
  
  // Debug: Log change orders when they change
  useEffect(() => {
    if (contextProjectData?.changeOrders && contextProjectData.changeOrders.length > 0) {
      contextProjectData.changeOrders.forEach((co: any) => {
        if (co.materialsAmount || co.laborAmount) {
          console.log('📋 BudgetTab: Change order with breakdown:', {
            id: co.id,
            title: co.title,
            materialsAmount: co.materialsAmount,
            laborAmount: co.laborAmount,
            fullCo: co,
          });
        }
      });
    }
  }, [contextProjectData?.changeOrders]);
  
  // Track if we've already reloaded to prevent infinite loops
  const hasReloadedRef = React.useRef(false);
  
  // Reload from storage when the Budget tab is focused to get latest purchase orders
  useFocusEffect(
    React.useCallback(() => {
      // Only reload once per focus session to prevent glitching
      if (reloadFromStorage && !hasReloadedRef.current) {
        hasReloadedRef.current = true;
        reloadFromStorage();
        console.log('🔄 BudgetTab: Reloaded from storage, purchase orders:', contextProjectData?.purchaseOrders?.length || 0);
        
        // Reset the flag after a delay so it can reload again if needed
        setTimeout(() => {
          hasReloadedRef.current = false;
        }, 1000);
      }
    }, [reloadFromStorage, contextProjectData?.purchaseOrders?.length])
  );
  
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
      // CRITICAL: Always use data.lines as the source of truth (it comes from convertToBudgetData which uses materialsCart and estimate.laborLineItems)
      // The buckets in contextProjectData might be stale, but data.lines is calculated fresh from the estimate data
      // This ensures the Budget tab matches what's shown in the Overview tab
      return data.lines.map(line => {
        const quantity = safe(line.qty);
        const unitCost = safe(line.unitCost);
        const baseCost = quantity * unitCost; // This is the budget amount (matches Overview tab)

        // Calculate actual spent amount from expenses for this category
        // Match both "Materials/Equipment" and "Materials" categories
        const categoryExpenses = (contextProjectData?.expenses || []).filter(exp => {
          const expCategory = (exp.category || '').toLowerCase();
          const lineCategory = line.category.toLowerCase();
          return expCategory === lineCategory ||
                 (expCategory.includes('materials') && lineCategory.includes('materials')) ||
                 (expCategory.includes('equipment') && lineCategory.includes('equipment'));
        });
        const actualSpent = categoryExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        // CRITICAL: Use baseCost (unitCost * qty) which comes from materialsCart/estimate.laborLineItems
        // This ensures the Budget tab shows the same values as the Overview tab
        return {
          id: line.id,
          name: line.category,
          budget: baseCost, // Use baseCost - this matches Overview tab exactly
          spent: actualSpent,
          bidBudget: baseCost, // Use baseCost for bidBudget too
        };
      });
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
    // Only include Materials/Equipment and Labor for BudgetTab (Overhead and Markup removed from budget cards)
    const relevantBuckets = buckets.filter(bucket =>
      bucket.name === 'Materials/Equipment' || bucket.name === 'Labor'
    );
    const total = relevantBuckets.reduce((s, l) => s + safe(l.budget), 0);
    console.log('🔍 Planned Budget Debug:');
    console.log('📋 All Buckets:', buckets.map(b => ({ name: b.name, budget: b.budget, unitCost: b.bidBudget })));
    console.log('📋 Relevant Buckets (Materials/Equipment + Labor only):', relevantBuckets.map(b => ({ name: b.name, budget: b.budget, unitCost: b.bidBudget })));
    console.log('📋 Planned Total:', total);
    return total;
  }, [projectData?.buckets]);

  const planned = useMemo(() => {
    const budgetCandidates = [
      data?.plannedBudget,
      projectData?.budgeted,
      (projectData as any)?.bidPrice,
      (projectData as any)?.estimatedCost,
    ];
    const explicitBudget = firstPositiveNumber(...budgetCandidates);
    if (explicitBudget !== null) {
      return explicitBudget;
    }
    return plannedFromBuckets;
  }, [data?.plannedBudget, projectData, plannedFromBuckets]);
  const normalizedChangeOrders: ChangeOrder[] = useMemo(() => {
    const normalized = (projectData?.changeOrders || []).map((co: any) => {
      const normalizedCo = {
        id: String(co.id),
        title: String(co.title ?? ''),
        amount: Number(co.amount ?? 0),
        status: co.status ?? (co.approved ? 'Approved' : 'Draft'),
        materialsAmount: co.materialsAmount !== undefined && co.materialsAmount !== null ? Number(co.materialsAmount) : undefined,
        laborAmount: co.laborAmount !== undefined && co.laborAmount !== null ? Number(co.laborAmount) : undefined,
        notes: co.notes,
        approved: co.approved || co.status === 'Approved',
        date: co.date ?? new Date().toISOString(),
      };
      
      // Debug logging for change orders with materials/labor
      if (co.materialsAmount || co.laborAmount) {
        console.log('🔍 Normalizing change order with breakdown:', {
          id: normalizedCo.id,
          title: normalizedCo.title,
          originalMaterialsAmount: co.materialsAmount,
          originalLaborAmount: co.laborAmount,
          normalizedMaterialsAmount: normalizedCo.materialsAmount,
          normalizedLaborAmount: normalizedCo.laborAmount,
          rawCo: co,
        });
      }
      
      return normalizedCo;
    });
    
    return normalized;
  }, [projectData?.changeOrders]);

  const coApproved = useMemo(
    () => normalizedChangeOrders
        .filter(c => c.status === 'Approved')
        .reduce((s, c) => s + safe(c.amount), 0),
    [normalizedChangeOrders]
  );
  const adjustedBudget = planned + coApproved;

  // Calculate Purchase Orders total - includes both PO objects and expenses with category "Purchase Orders"
  const purchaseOrdersTotal = useMemo(() => {
    // First, sum up Purchase Order objects (excluding cancelled)
    const rawPOs = projectData?.purchaseOrders || [];
    const allPOs = rawPOs.filter(po => po.status !== 'Cancelled');
    
    const poObjectsTotal = allPOs.reduce((sum, po) => {
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
    
    // Second, sum up expenses with category "Purchase Orders"
    const expenses = projectData?.expenses || [];
    const poExpenses = expenses.filter(exp => 
      (exp.category || '').toLowerCase() === 'purchase orders'
    );
    
    const poExpensesTotal = poExpenses.reduce((sum, exp) => {
      const amount = typeof exp.amount === 'number' ? exp.amount : Number(exp.amount) || 0;
      return sum + amount;
    }, 0);
    
    const total = poObjectsTotal + poExpensesTotal;
    
    console.log('📊 Purchase Orders Total Calculation:', {
      poObjectsCount: allPOs.length,
      poObjectsTotal: poObjectsTotal,
      poExpensesCount: poExpenses.length,
      poExpensesTotal: poExpensesTotal,
      finalTotal: total
    });
    
    return total;
  }, [projectData?.purchaseOrders, projectData?.expenses]);

  // Calculate Change Orders total - includes both CO objects and expenses with category "Change Orders"
  const changeOrdersTotal = useMemo(() => {
    // First, sum up Change Order objects (normalized)
    const coObjectsTotal = normalizedChangeOrders.reduce((sum, co) => {
      const amount = typeof co.amount === 'number' ? co.amount : Number(co.amount) || 0;
      return sum + amount;
    }, 0);
    
    // Second, sum up expenses with category "Change Orders"
    const expenses = projectData?.expenses || [];
    const coExpenses = expenses.filter(exp => 
      (exp.category || '').toLowerCase() === 'change orders'
    );
    
    const coExpensesTotal = coExpenses.reduce((sum, exp) => {
      const amount = typeof exp.amount === 'number' ? exp.amount : Number(exp.amount) || 0;
      return sum + amount;
    }, 0);
    
    const total = coObjectsTotal + coExpensesTotal;
    
    console.log('📊 Change Orders Total Calculation:', {
      coObjectsCount: normalizedChangeOrders.length,
      coObjectsTotal: coObjectsTotal,
      coExpensesCount: coExpenses.length,
      coExpensesTotal: coExpensesTotal,
      finalTotal: total
    });
    
    return total;
  }, [normalizedChangeOrders, projectData?.expenses]);

  // CRITICAL: Use projectData.buckets directly (which comes from data.lines via convertToBudgetData)
  // This ensures the Budget tab matches the Overview tab which uses materialsCart and estimate.laborLineItems
  // DO NOT scale these buckets - they already match the Overview tab values
  const buckets = useMemo(() => {
    // Use projectData.buckets directly (they're calculated from data.lines which matches Overview tab)
    // These buckets are NOT scaled - they use the exact values from materialsCart and estimate.laborLineItems
    const list = projectData?.buckets || [];
    return list; // Return buckets as-is without scaling
  }, [projectData?.buckets]);
  
  // Memoize buckets with stable IDs to prevent unnecessary re-renders
  const stableBuckets = useMemo(() => {
    return buckets.map((bucket, index) => ({
      ...bucket,
      stableId: bucket.id || `bucket-${bucket.name}-${index}`,
    }));
  }, [buckets]);

  const actual = useMemo(
    () => projectData?.spent || (projectData?.expenses || []).reduce((s, e) => s + safe(e.amount), 0),
    [projectData?.spent, projectData?.expenses]
  );
  const committed = safe(projectData?.committedPOs || 0);
  const remaining = Math.max(adjustedBudget - actual, 0);

  // Calculate projected costs for alerts
  const projectedTotal = actual + (committed * 0.8); // Assume 80% of committed POs will be spent
  
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
    overall: { planned: adjustedBudget, projected: projectedTotal },
    categories: categorySnapshots,
    notify: false, // Disable push in Expo Go
  });

  // Debug alerts
  console.log('BudgetTab - Alerts count:', alerts.length);
  console.log('BudgetTab - Planned:', adjustedBudget, 'Projected:', projectedTotal);
  if (alerts.length > 0) {
    console.log('BudgetTab - Active alerts:', alerts);
  }

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

  const usageRatio = adjustedBudget > 0 ? actual / adjustedBudget : 0;
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

  const remainingColor =
    tone === 'red'
      ? '#ef4444'
      : tone === 'orange'
        ? '#f97316'
        : tone === 'yellow'
          ? '#facc15'
          : '#22c55e';

  const theme = darkMode
    ? {
        background: ['#0b1c38', '#1B365D', '#22c55e'],
        text: '#f1f5f9',
        subtext: '#cbd5e1',
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

  const hasExpenses = (projectData?.expenses || []).length > 0;
  const totalSpent = actual;
  const quickAddPulse = useRef(new Animated.Value(1)).current;
  const hasPulsedRef = useRef(false);

  useEffect(() => {
    if (hasPulsedRef.current || hasExpenses || totalSpent !== 0) return;
    hasPulsedRef.current = true;
    Animated.sequence([
      Animated.timing(quickAddPulse, {
        toValue: 1.12,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(quickAddPulse, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [hasExpenses, totalSpent, quickAddPulse]);

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      <ScrollView 
        style={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 120 }}
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
          {/* Outer green-to-blue border wrapping Budget Details header and Budget Totals card */}
          <LinearGradient
            colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.overviewBorder}
          >
            <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
              {/* Baseline Locked Indicator */}
              <View style={[styles.baselineIndicator, { 
                backgroundColor: Colors.surface2, 
                borderColor: Colors.line 
              }]}>
                <Ionicons name="lock-closed" size={14} color={Colors.sub} />
                <View style={styles.baselineIndicatorTextWrap}>
                  <Text style={[styles.baselineIndicatorText, { color: Colors.sub }]}>
                    Baseline locked from estimate
                  </Text>
                  <Text style={[styles.baselineIndicatorSubtext, { color: Colors.sub }]}>
                    Changes are tracked automatically
                  </Text>
                </View>
              </View>

              {/* Zero-State Budget Callout - Enhanced with Quick Add */}
              {actual === 0 && (projectData?.expenses || []).length === 0 && (
                <View style={[styles.zeroStateCallout, { 
                  backgroundColor: Colors.surface2, 
                  borderColor: Colors.line 
                }]}>
                  <Ionicons name="wallet-outline" size={24} color="#22c55e" />
                  <Text style={[styles.zeroStateTitle, { color: theme.text }]}>
                    No costs logged yet
                  </Text>
                  <Text style={[styles.zeroStateSubtitle, { color: theme.subtext }]}>
                    Most contractors log their first expense within the first day.
                  </Text>
                  
                  <View style={styles.zeroStateButtons}>
                    <TouchableOpacity
                      style={[styles.zeroStatePrimaryButton, { 
                        backgroundColor: '#22c55e' + '20',
                        borderColor: '#22c55e' + '40'
                      }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        // Navigate to materials and equipment page
                        const projectId = contextProjectData?.id || data?.projectId;
                        if (projectId) {
                          router.push({
                            pathname: '/materials-equipment',
                            params: { projectId }
                          });
                        } else {
                          router.push('/materials-equipment');
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Animated.View style={{ transform: [{ scale: quickAddPulse }], marginRight: 6 }}>
                        <Ionicons name="add-circle" size={18} color="#22c55e" />
                      </Animated.View>
                      <Text style={[styles.zeroStatePrimaryButtonText, { color: '#22c55e' }]}>
                        Quick Add Expense
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.zeroStateHelperText, { color: theme.subtext }]}>
                    Add materials, labor, or misc costs
                  </Text>
                  <View style={styles.zeroStateSuggestionRow}>
                    <Ionicons name="bulb-outline" size={14} color={theme.subtext} />
                    <Text style={[styles.zeroStateSuggestionText, { color: theme.subtext }]}>
                      Suggested: Log materials from your first supplier
                    </Text>
                  </View>
                </View>
              )}

              {/* Budget Details Header */}
              <View style={styles.budgetHeaderRow}>
                <View>
                  <Text style={[styles.budgetHeaderTitle, { color: theme.text }]}>Budget Details</Text>
                  <Text style={[styles.budgetHeaderSubtitle, { color: theme.subtext }]}>
                    Once expenses are logged, you&apos;ll see actual vs planned in real time.
                  </Text>
                </View>
              </View>

              {/* Totals Card */}
              <View style={[styles.sectionCardContainer, { marginTop: 12 }]}>
                <View style={[styles.sectionCard, { backgroundColor: Colors.surface2, borderWidth: darkMode ? 1 : 1, borderColor: Colors.line, borderRadius: 14 }]}>
          <View style={[styles.sectionHeader, !darkMode && { borderBottomColor: Colors.line }]}>
            <MaterialIcons name='account-balance-wallet' size={22} color='#22c55e' />
            <Text style={[styles.totalsTitle, { color: theme.text, marginLeft: 12 }]}>
              Budget Totals
            </Text>
          </View>
          <View style={styles.totalsContent}>
          <Row
            label='Planned Budget'
            value={money(planned, currency)}
            theme={theme}
          />
          <Row
            label='Approved Change Orders'
            value={`+ ${money(coApproved, currency)}`}
            theme={theme}
          />
          <Row
            label='Adjusted Budget'
            value={money(adjustedBudget, currency)}
            theme={theme}
          />
          <Row
            label='Actual Expenses'
            value={money(actual, currency)}
            theme={theme}
          />
          <Row
            label='Committed POs'
            value={money(committed, currency)}
            theme={theme}
          />
          <View style={styles.remainingSection}>
            <Text style={[styles.remainingLabel, { color: theme.subtext }]}>
              Remaining
            </Text>
          <Bar
            pct={remainingPercent}
            tone={tone}
            usagePct={usagePercent}
          />
            <Text
              style={[
                styles.remainingText,
              { color: remainingColor },
              ]}
            >
              {actual <= adjustedBudget
                ? `Under by ${money(adjustedBudget - actual, currency)}`
                : `Over by ${money(actual - adjustedBudget, currency)}`}
            </Text>
          </View>
          </View>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TabPill
              label='Line Items'
              active={tab === 'lines'}
              onPress={() => setTab('lines')}
              theme={theme}
              colors={Colors}
              darkMode={darkMode}
            />
            <TabPill
              label='Orders'
              active={tab === 'cos'}
              onPress={() => setTab('cos')}
              theme={theme}
              colors={Colors}
              darkMode={darkMode}
            />
          </View>

          {tab === 'lines' && (
            <View style={{ marginTop: 12 }}>
              {/* Outer green-to-blue border wrapping all budget category cards */}
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.overviewBorder}
              >
                <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
                  {/* Header for Budget Categories */}
                  <View style={styles.budgetHeaderRow}>
                    <View>
                      <Text style={[styles.budgetHeaderTitle, { color: theme.text }]}>Budget Categories</Text>
                      <Text style={[styles.budgetHeaderSubtitle, { color: theme.subtext }]}>
                        Track spending by category
                      </Text>
                    </View>
                  </View>

                  {stableBuckets.map((item, index) => {
                    const budgetValue = Number(item.budget ?? 0);
                    const spent = Number(item.spent ?? 0);
                    const spentPercent = Math.min(100, (spent / Math.max(budgetValue, 1)) * 100);
                    const isOverBudget = spent > budgetValue;
                    const itemName = String(item.name || 'Unknown');
                    const categoryIconName = itemName.toLowerCase().includes('labor') ? 'engineering' : 
                                        itemName.toLowerCase().includes('materials') || itemName.toLowerCase().includes('equipment') ? 'construction' :
                                        itemName.toLowerCase().includes('subs') ? 'people' : 'inventory';
                    
                    return (
                      <View key={item.stableId || item.id || `budget-item-${index}`} style={[styles.budgetCardContainer, { marginTop: index === 0 ? 0 : 12 }]}>
                        <View style={[styles.budgetCard, { backgroundColor: Colors.surface2, borderWidth: darkMode ? 1 : 1, borderColor: Colors.line, borderRadius: 14 }]}>
                      <Pressable
                        onPress={() => setSelectedCategory(itemName)}
                        style={{ flex: 1 }}
                      >
                        {/* Header with Category and Icon */}
                        <View style={[styles.budgetCardHeader, { justifyContent: 'center', position: 'relative', width: '100%' }]}>
                          {/* Over Budget Badge - Top Right */}
                          {isOverBudget && (
                            <View style={[styles.warningBadge, { backgroundColor: theme.accent, position: 'absolute', top: 0, right: 0 }]}>
                              <Text style={styles.warningBadgeText}>Over Budget</Text>
                            </View>
                          )}
                          <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                            <View style={{ alignItems: 'center', marginBottom: 4 }}>
                              <MaterialIcons name={categoryIconName as any} size={22} color="#22c55e" />
                            </View>
                            <View style={{ alignItems: 'center' }}>
                              <Text style={[styles.budgetCardTitle, { color: theme.text, textAlign: 'center' }]}>
                                {itemName}
                              </Text>
                              <Text style={{ color: theme.accent, fontSize: 12, marginTop: 2, textAlign: 'center' }}>
                                Tap to view transactions →
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Current Label - Centered */}
                        <View style={{ alignItems: 'center', marginBottom: 16 }}>
                          <Text style={[styles.budgetAmountLabel, { color: theme.subtext }]}>Current</Text>
                        </View>

                        {/* Budget and Spent Row */}
                        <View style={styles.budgetStatusRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.statusLabel, { color: theme.subtext }]}>Budget:</Text>
                            <Text style={[styles.statusValue, { color: theme.subtext, fontSize: 15, marginTop: 4 }]}>
                              {money(budgetValue, currency)}
                            </Text>
                          </View>
                          <View style={{ flex: 1, alignItems: 'flex-end' }}>
                            <Text style={[styles.statusLabel, { color: theme.subtext }]}>Spent:</Text>
                            <Text style={[styles.statusValue, { 
                              color: isOverBudget ? theme.accent : theme.text,
                              fontSize: 15,
                              fontWeight: '700',
                              marginTop: 4
                            }]}>
                              {money(spent, currency)}
                            </Text>
                          </View>
                        </View>

                        {/* Progress Bar */}
                        <View style={[styles.progressBarContainer, { marginTop: 16 }]}>
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
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                            <Text style={[styles.progressText, { color: theme.subtext }]}>
                              {spentPercent.toFixed(1)}% used
                            </Text>
                            {isOverBudget ? (
                              <Text style={[styles.statusLabel, { color: theme.accent, fontSize: 12 }]}>
                                ⚠️ Over by {money(spent - budgetValue, currency)}
                              </Text>
                            ) : (
                              <Text style={[styles.statusLabel, { color: theme.subtext, fontSize: 12 }]}>
                                ✓ Remaining: {money(budgetValue - spent, currency)}
                              </Text>
                            )}
                          </View>
                        </View>
                      </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </LinearGradient>
            </View>
        )}

        {tab === 'cos' && (
          <View style={{ marginTop: 12 }}>
            {/* Outer green-to-blue border wrapping header and both order cards */}
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.overviewBorder}
            >
              <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
                {/* Header for Orders */}
                <View style={styles.budgetHeaderRow}>
                  <View>
                    <Text style={[styles.budgetHeaderTitle, { color: theme.text }]}>Orders</Text>
                    <Text style={[styles.budgetHeaderSubtitle, { color: theme.subtext }]}>
                      Purchase orders and change orders
                    </Text>
                  </View>
                </View>

                {/* Purchase Orders Card */}
                {(() => {
                  // Get the EXACT same array that individual items use - use projectData for consistency
                  const individualPOs = (projectData?.purchaseOrders || [])
                    .filter(po => po.status !== 'Cancelled')
                    .sort((a, b) => new Date(a.expectedDelivery).getTime() - new Date(b.expectedDelivery).getTime());
                  
                  // Use the purchaseOrdersTotal from useMemo (includes both POs and expenses with category "Purchase Orders")
                  const poTotal = purchaseOrdersTotal;
                  
                  return (
                    <View key="purchase-orders-card" style={[styles.budgetCardContainer, { marginTop: 0 }]}>
                      <View style={[styles.budgetCard, { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.line, borderRadius: 14 }]}>
                        <Pressable
                          onPress={() => setSelectedCategory('Purchase Orders')}
                          style={{ flex: 1 }}
                        >
                          {/* Header with Category and Icon */}
                          <View style={styles.budgetCardHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1 }}>
                              <MaterialIcons name="receipt-long" size={22} color="#22c55e" />
                              <View style={{ alignItems: 'center' }}>
                                <Text style={[styles.budgetCardTitle, { color: theme.text, textAlign: 'center' }]}>
                                  Purchase Orders
                                </Text>
                                <Text style={{ color: theme.accent, fontSize: 12, marginTop: 2, textAlign: 'center' }}>
                                  Tap to view transactions →
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Current Label - Centered */}
                          <View style={{ alignItems: 'center', marginBottom: 16 }}>
                            <Text style={[styles.budgetAmountLabel, { color: theme.subtext }]}>Current</Text>
                          </View>

                          {/* Total Amount */}
                          <View style={styles.budgetStatusRow}>
                            <Text style={[styles.statusLabel, { color: theme.subtext }]}>Total:</Text>
                            <Text style={[styles.statusValue, { color: theme.text }]}>
                              {money(poTotal, currency)}
                            </Text>
                          </View>
                        </Pressable>

                        {/* Individual Purchase Orders */}
                        <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                          {individualPOs.map(po => {
                            const daysUntilDelivery = Math.ceil((new Date(po.expectedDelivery).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            const categoryIcon = po.category === 'Labor' ? '👷' : po.category === 'Materials' ? '🧱' : po.category === 'Equipment' ? '🔧' : '👥';
                            
                            return (
                              <View key={po.id} style={[styles.budgetCardContainer, { marginBottom: 10 }]}>
                                <View style={[styles.budgetCard, { padding: 12, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.line, borderRadius: 14 }]}>
                                  <Pressable 
                                    onPress={() => setEditingPO(po)}
                                    style={{ flex: 1 }}
                                  >
                      {/* Header with PO Number and Icon */}
                      <View style={[styles.budgetCardHeader, { marginBottom: 10 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Text style={{ fontSize: 18 }}>{categoryIcon}</Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text 
                              style={[styles.budgetCardTitle, { color: theme.text, fontSize: 15, lineHeight: 20 }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {po.poNumber}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                              <Text style={{ color: theme.subtext, fontSize: 11 }}>{po.vendor || 'No vendor'}</Text>
                              <View style={[styles.statusDot, { 
                                backgroundColor: po.status === 'Pending' ? '#f59e0b' : '#22c55e',
                                width: 6,
                                height: 6,
                                marginLeft: 6
                              }]} />
                              <Text style={{ 
                                color: po.status === 'Pending' ? '#f59e0b' : '#22c55e',
                                fontSize: 10,
                                fontWeight: '600',
                                letterSpacing: 0.5
                              }}>
                                {po.status.toUpperCase()}
                            </Text>
                          </View>
                            </View>
                          <Text style={{ 
                            color: po.status === 'Pending' ? '#f59e0b' : '#22c55e',
                            fontSize: 15,
                            fontWeight: '700'
                          }}>
                            {money(po.amount, currency)}
                          </Text>
                        </View>
                        {po.status === 'Pending' && daysUntilDelivery <= 3 && (
                          <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6, alignSelf: 'flex-start' }}>
                            <Text style={{ color: 'white', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>URGENT</Text>
                          </View>
                        )}
                      </View>
                      
                      {/* Expected Delivery */}
                      <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                        <Text style={{ color: theme.subtext, fontSize: 10, marginBottom: 3 }}>Expected Delivery</Text>
                        <Text style={{ 
                          color: po.status === 'Pending' && daysUntilDelivery <= 3 ? '#ef4444' : '#22c55e',
                          fontSize: 12,
                          fontWeight: '600'
                        }}>
                          {new Date(po.expectedDelivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {po.status === 'Pending' && (
                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '400' }}>
                              {' '}({daysUntilDelivery > 0 ? `${daysUntilDelivery} days` : 'Today!'})
                            </Text>
                          )}
                        </Text>
                      </View>

                      {/* Description */}
                      {po.description && (
                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                          <Text style={{ color: theme.subtext, fontSize: 11, lineHeight: 16 }} numberOfLines={2} ellipsizeMode="tail">{po.description}</Text>
                        </View>
                      )}

                      {/* Actions */}
                      {po.status === 'Pending' && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Mark as Received?',
                                `${po.poNumber} from ${po.vendor} will be added to expenses.`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Received',
                                    onPress: () => markPOReceived(po.id)
                                  }
                                ]
                              );
                            }}
                            style={{ flex: 1, backgroundColor: '#22c55e', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}
                          >
                            <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓ Received</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Cancel PO?',
                                `Cancel ${po.poNumber}?`,
                                [
                                  { text: 'No', style: 'cancel' },
                                  {
                                    text: 'Cancel PO',
                                    style: 'destructive',
                                    onPress: () => cancelPO(po.id)
                                  }
                                ]
                              );
                            }}
                            style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center' }}
                          >
                            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>✕ Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {po.status === 'Received' && (
                        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                          <View style={{ backgroundColor: '#065f46', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}>
                            <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '700' }}>✓ Delivered</Text>
                          </View>
                        </View>
                      )}
                                  </Pressable>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* Change Orders Card */}
                {(() => {
                  // Get the EXACT same array that individual items use
                  const individualCOs = normalizedChangeOrders;
                  
                  // Use the changeOrdersTotal from useMemo (includes both COs and expenses with category "Change Orders")
                  const coTotal = changeOrdersTotal;
                  
                  return (
                    <View key="change-orders-card" style={[styles.budgetCardContainer, { marginTop: 12 }]}>
                      <View style={[styles.budgetCard, { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.line, borderRadius: 14 }]}>
                        <Pressable
                          onPress={() => setSelectedCategory('Change Orders')}
                          style={{ flex: 1 }}
                        >
                      {/* Header with Category and Icon */}
                      <View style={styles.budgetCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flex: 1 }}>
                          <Text style={{ fontSize: 24 }}>📝</Text>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={[styles.budgetCardTitle, { color: theme.text, textAlign: 'center' }]}>
                              Change Orders
                            </Text>
                            <Text style={{ color: theme.accent, fontSize: 12, marginTop: 2, textAlign: 'center' }}>
                              Tap to view transactions →
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Current Label - Centered */}
                      <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <Text style={[styles.budgetAmountLabel, { color: theme.subtext }]}>Current</Text>
                      </View>

                      {/* Total Amount */}
                      <View style={styles.budgetStatusRow}>
                        <Text style={[styles.statusLabel, { color: theme.subtext }]}>Total:</Text>
                        <Text style={[styles.statusValue, { color: theme.text }]}>
                          {money(coTotal, currency)}
                        </Text>
                      </View>
                    </Pressable>

                        {/* Individual Change Orders */}
                        <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                          {individualCOs.map(co => {
                            const coAmount = Number(co.amount || 0);
                            const isApproved = co.status === 'Approved';
                            const statusColor = isApproved ? '#22c55e' : co.status === 'Submitted' ? '#f59e0b' : '#64748b';
                            
                            return (
                              <View key={co.id} style={[styles.budgetCardContainer, { marginBottom: 10 }]}>
                                <View style={[styles.budgetCard, { padding: 12, backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.line, borderRadius: 14 }]}>
                      {/* Header: Title and Status */}
                      <View style={[styles.budgetCardHeader, { marginBottom: 10 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Text style={{ fontSize: 18 }}>📝</Text>
                          <View style={{ flex: 1 }}>
                            <Text 
                              style={[styles.budgetCardTitle, { color: theme.text, fontSize: 15, lineHeight: 20 }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {co.title}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                              <View style={[styles.statusDot, { backgroundColor: statusColor, width: 6, height: 6 }]} />
                              <Text style={{ color: statusColor, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>
                            {co.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                        </View>
                        <Text style={{ color: statusColor, fontSize: 16, fontWeight: '700' }}>
                          {money(coAmount, currency)}
                        </Text>
                      </View>

                      {/* Breakdown - Side by side if both exist */}
                      {((co.materialsAmount && co.materialsAmount > 0) || (co.laborAmount && co.laborAmount > 0)) && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          {co.materialsAmount && co.materialsAmount > 0 && (
                            <View style={{ flex: 1, padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 16 }}>🧱</Text>
                              <View style={{ flex: 1 }}>
                                  <Text style={{ color: theme.subtext, fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 }}>MATERIALS</Text>
                                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                                  {money(co.materialsAmount, currency)}
                                </Text>
                              </View>
                            </View>
                            </View>
                          )}
                          {co.laborAmount && co.laborAmount > 0 && (
                            <View style={{ flex: 1, padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 16 }}>👷</Text>
                              <View style={{ flex: 1 }}>
                                  <Text style={{ color: theme.subtext, fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 }}>LABOR</Text>
                                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                                  {money(co.laborAmount, currency)}
                                </Text>
                              </View>
                            </View>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Notes */}
                      {co.notes && (
                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                          <Text style={{ color: theme.subtext, fontSize: 11, lineHeight: 16 }} numberOfLines={2} ellipsizeMode="tail">{co.notes}</Text>
                        </View>
                      )}

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                        <TouchableOpacity
                          style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(96, 165, 250, 0.15)', borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.3)' }}
                          onPress={() => {
                            console.log('📝 Editing change order:', {
                              id: co.id,
                              title: co.title,
                              amount: co.amount,
                              materialsAmount: co.materialsAmount,
                              laborAmount: co.laborAmount,
                              fullCo: co,
                            });
                            setEditingChangeOrder(co);
                            setShowChangeOrderModal(true);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                        >
                          <MaterialIcons name="edit" size={16} color="#60a5fa" />
                        </TouchableOpacity>
                        {co.status !== 'Approved' && (
                          <TouchableOpacity
                            style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34, 197, 94, 0.15)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' }}
                            onPress={() => {
                              approveChangeOrder(co.id);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              Alert.alert('Approved', `Change order "${co.title}" has been approved. Budget updated.`);
                            }}
                          >
                            <MaterialIcons name="check-circle-outline" size={16} color="#22c55e" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          onPress={() => {
                            Alert.alert(
                              'Delete Change Order',
                              `Are you sure you want to delete "${co.title}"? This action cannot be undone.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: () => {
                                    deleteChangeOrder(co.id);
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  },
                                },
                              ]
                            );
                          }}
                        >
                          <MaterialIcons name="delete-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  );
                })()}
              </View>
            </LinearGradient>
          </View>
        )}
        </View>

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
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backBtnBorder}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowChangeOrderModal(false);
                    setEditingChangeOrder(null);
                    setNewChangeOrder({ title: '', amount: '', materialsAmount: '', laborAmount: '', notes: '' });
                  }}
                  style={styles.backBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
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
            keyboardShouldPersistTaps="handled"
          >
            {/* Total Spent Card */}
            <View style={styles.summaryCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.summaryCardLabel}>Total Change Order Amount</Text>
                <Text style={styles.summaryCardAmount}>
                  ${(editingChangeOrder ? parseFloat(editingChangeOrder.amount || '0') : parseFloat(newChangeOrder.amount || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
            
            <View style={styles.field}>
              <Text style={styles.modalLabel}>Change Order Title</Text>
            <TextInput
                style={styles.modalInput}
              placeholder="e.g., Additional Kitchen Cabinets"
                placeholderTextColor="rgba(255,255,255,0.4)"
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
              <Text style={styles.modalLabel}>Breakdown</Text>
              <Text style={styles.modalSubLabel}>Specify materials and labor amounts</Text>
            
            {/* Materials Box */}
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
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="numeric"
                  underlineColorAndroid="transparent"
                  value={editingChangeOrder ? (editingChangeOrder.materialsAmount?.toString() || '') : newChangeOrder.materialsAmount}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9.]/g, '');
                    if (editingChangeOrder) {
                      setEditingChangeOrder({...editingChangeOrder, materialsAmount: numericValue});
                    } else {
                      setNewChangeOrder({...newChangeOrder, materialsAmount: numericValue});
                    }
                    // Auto-calculate total
                    const materials = parseFloat(numericValue) || 0;
                    const labor = parseFloat(editingChangeOrder ? (editingChangeOrder.laborAmount || '0') : (newChangeOrder.laborAmount || '0')) || 0;
                    const total = materials + labor;
                    if (editingChangeOrder) {
                      setEditingChangeOrder({...editingChangeOrder, amount: total.toFixed(2)});
                    } else {
                      setNewChangeOrder({...newChangeOrder, amount: total.toFixed(2)});
                    }
                  }}
                />
              </View>
            </View>
            
            {/* Labor Box */}
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
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="numeric"
                  underlineColorAndroid="transparent"
                  value={editingChangeOrder ? (editingChangeOrder.laborAmount?.toString() || '') : newChangeOrder.laborAmount}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9.]/g, '');
                    if (editingChangeOrder) {
                      setEditingChangeOrder({...editingChangeOrder, laborAmount: numericValue});
                    } else {
                      setNewChangeOrder({...newChangeOrder, laborAmount: numericValue});
                    }
                    // Auto-calculate total
                    const materials = parseFloat(editingChangeOrder ? (editingChangeOrder.materialsAmount || '0') : (newChangeOrder.materialsAmount || '0')) || 0;
                    const labor = parseFloat(numericValue) || 0;
                    const total = materials + labor;
                    if (editingChangeOrder) {
                      setEditingChangeOrder({...editingChangeOrder, amount: total.toFixed(2)});
                    } else {
                      setNewChangeOrder({...newChangeOrder, amount: total.toFixed(2)});
                    }
                  }}
                />
              </View>
            </View>
            </View>
            
            <View style={styles.field}>
              <Text style={styles.modalLabel}>Notes (optional)</Text>
            <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Additional details about this change order..."
                placeholderTextColor="rgba(255,255,255,0.4)"
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
                if (co.title && (co.amount || co.materialsAmount || co.laborAmount)) {
                  const materials = parseFloat(co.materialsAmount || '0') || 0;
                  const labor = parseFloat(co.laborAmount || '0') || 0;
                  const total = parseFloat(co.amount || '0') || (materials + labor);
                  
                  if (editingChangeOrder) {
                    // Update existing change order
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
                  }
                  setShowChangeOrderModal(false);
                  setEditingChangeOrder(null);
                  setNewChangeOrder({ title: '', amount: '', materialsAmount: '', laborAmount: '', notes: '' });
                  Alert.alert('Success', editingChangeOrder ? 'Change order updated successfully!' : 'Change order added successfully!');
                } else {
                  Alert.alert('Error', 'Please fill in title and at least one amount (materials or labor)');
                }
              }}
              style={styles.modalSaveButton}
            >
              <Text style={styles.modalSaveButtonText} numberOfLines={1}>
                ✓ {editingChangeOrder ? 'Update Change Order' : 'Add Change Order'}
              </Text>
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
        onClose={() => setSelectedCategory(null)}
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
    </View>
  );
}

// Components -------------------------------------------------------
function Row({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.subtext }]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          { color: theme.text, fontVariant: ['tabular-nums'] },
        ]}
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
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabPill,
        {
          backgroundColor: active
            ? 'rgba(34, 197, 94, 0.2)'
            : darkMode
              ? 'rgba(30, 41, 59, 0.6)'
              : colors.surface2,
          borderColor: active ? '#22c55e' : colors.line,
        },
      ]}
    >
      <Text
        style={[styles.tabPillText, { color: active ? '#22c55e' : colors.text }]}
      >
        {label}
      </Text>
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

  const getThresholdColor = () => {
    switch (tone) {
      case 'red':
        return 'rgba(239, 68, 68, 0.4)';
      case 'orange':
        return 'rgba(249, 115, 22, 0.35)';
      case 'yellow':
        return 'rgba(250, 204, 21, 0.35)';
      default:
        return '#f59e0b';
    }
  };

  const getBarGradient = () => {
    switch (tone) {
      case 'red':
        return ['#ef4444', '#f97316'];
      case 'orange':
        return ['#f97316', '#facc15'];
      case 'yellow':
        return ['#facc15', '#f59e0b'];
      case 'green':
      default:
        return ['#22c55e', '#22d3ee'];
    }
  };

  return (
    <View style={styles.barContainer}>
      <View
        style={[
          styles.barThreshold,
          { left: '25%', backgroundColor: 'rgba(34, 197, 94, 0.35)' },
        ]}
      />
      <View
        style={[
          styles.barThreshold,
          { left: '50%', backgroundColor: 'rgba(250, 204, 21, 0.35)' },
        ]}
      />
      <View
        style={[
          styles.barThreshold,
          { left: '75%', backgroundColor: getThresholdColor() },
        ]}
      />
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
    paddingVertical: 18,
  },
  budgetContainerEmbedded: {
    paddingHorizontal: 0,
  },
  overviewBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 16,
  },
  overviewInner: {
    borderRadius: 18,
    padding: 12,
  },
  budgetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  budgetHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F9FAFB",
    letterSpacing: 0.15,
  },
  budgetHeaderSubtitle: {
    fontSize: 13,
    color: "#8DA0B8",
    marginTop: 2,
  },
  sectionCardContainer: {
    marginTop: 12,
  },
  sectionCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  sectionCard: {
    borderRadius: 14,
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  totalsContent: {
    padding: 0,
  },
  totalsTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.15 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 16, fontWeight: '500' },
  remainingSection: { marginTop: 12 },
  remainingLabel: { fontSize: 16, marginBottom: 8 },
  remainingText: { fontSize: 16, fontWeight: '500', marginTop: 8 },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  tabContainer: { flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 16 },
  tabPill: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillText: { fontSize: 14, fontWeight: '600' },
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
    padding: 16,
  },
  budgetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetCardTitle: {
    fontSize: 17,
    fontWeight: '700',
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
    marginBottom: 16,
  },
  progressBarBackground: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'right',
    fontWeight: '500',
  },
  budgetStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
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
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: -0.2,
  },
  modalSubLabel: {
    fontSize: 13,
    marginBottom: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  breakdownBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    outlineStyle: 'none',
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
  bottomSpacer: { height: 32 },
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
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
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
    width: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  summaryCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: 'transparent',
    elevation: 0,
  },
  summaryCardLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCardAmount: {
    color: '#10f297',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.1)',
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  backBtnWrapper: {
    marginRight: 12,
  },
  backBtnBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 19,
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
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: 'transparent',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: {
    color: 'rgba(255,255,255,0.8)',
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
  zeroStateCallout: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  zeroStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  zeroStateSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  zeroStateButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  zeroStatePrimaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  zeroStatePrimaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  zeroStateHelperText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '500',
  },
  zeroStateSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  zeroStateSuggestionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  baselineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  baselineIndicatorTextWrap: {
    gap: 2,
  },
  baselineIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  baselineIndicatorSubtext: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyStateText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#10f297',
    shadowColor: '#10f297',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveButtonText: {
    color: '#020617',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
