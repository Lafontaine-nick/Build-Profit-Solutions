// @ts-nocheck
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform, Pressable, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import { isChangeOrderMirrorExpenseId, parseChangeOrderIdFromMirrorExpenseId } from "../lib/changeOrderMirrorExpenses";
import AddTransactionModal from "./AddTransactionModal";
import EditTransactionModal from "./EditTransactionModal";
import EditPurchaseOrderModal from "./EditPurchaseOrderModal";
import ProductScannerModal from "./ProductScannerModal";
import ProductFoundSheet from "./ProductFoundSheet";
import { buildProductNotes } from "../lib/products/productScannerTypes";
import type { ProductScannerSavePayload } from "../lib/products/productScannerTypes";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import {
  isDesktopWebLayoutWidth,
  DASHBOARD_WEB_MAX_CONTENT_WIDTH,
  ScreenLayout,
  PROJECT_WIDE_CONTAINER_CARD_INSET,
} from "@/constants/ScreenLayout";
import GradientRingBackInner from "@/components/GradientRingBackInner";
import EstimateLineExpenseGroupCard from "./EstimateLineExpenseGroupCard";
import CategoryEstimateBudgetCard from "./CategoryEstimateBudgetCard";
import ReceiptStatusPill from "./ReceiptStatusPill";
import EstimateLineBudgetStrip from "./EstimateLineBudgetStrip";
import {
  buildEstimateLineIdToLabel,
  buildGroupedCategoryExpenseList,
} from "@/utils/groupCategoryExpenses";
import { resolveProjectEstimateData } from "@/utils/rateInsightComparisons";
import { useEstimateLineBudgets, lookupSpendSummary } from "@/hooks/useEstimateLineBudgets";
import { resolveExpenseLineId } from "@/utils/resolveExpenseLineId";
import { buildCategoryBudgetSummary } from "@/utils/estimateLineBudgetDisplay";
import { expenseSubtitleLines } from "@/utils/expenseCardDisplay";
import { tabFlowCardStyle } from "@/components/layout/TabFlowCard";
import { ESTIMATE_FLOW_NESTED_CARD_BG_DARK, AI_FLOW_CARD_BG_DARK } from "@/utils/estimateFlowCardStyle";

// Helper to parse YYYY-MM-DD date strings as local time (not UTC) to avoid timezone shifts
function parseLocalDate(dateString: string): Date {
  // Append "T00:00:00" to force local time parsing instead of UTC
  return new Date(dateString + "T00:00:00");
}

/** RN Web: `Alert.alert` is unreliable in Safari; keep Budget → Add flows usable. */
function categoryDetailWebAlert(title: string, message?: string) {
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  if (message !== undefined) Alert.alert(title, message);
  else Alert.alert(title);
}

/** RN Web: two-button `Alert.alert` is a no-op in Safari — use `confirm` for PO Received. */
function maybeWebConfirmPOMarkReceived(
  po: { id: string; poNumber?: string; vendor?: string },
  opts: {
    markingPOReceivedId: string | null;
    setMarkingPOReceivedId: (v: string | null | ((curr: string | null) => string | null)) => void;
    markPOReceived: (id: string) => void;
  }
) {
  if (opts.markingPOReceivedId === po.id) return;
  const body = `${po.poNumber ?? "PO"} from ${po.vendor ?? "vendor"} will be added to expenses.`;
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.confirm === "function") {
    if (!window.confirm(`Mark as Received?\n\n${body}`)) return;
    opts.setMarkingPOReceivedId(po.id);
    opts.markPOReceived(po.id);
    setTimeout(() => {
      opts.setMarkingPOReceivedId((curr) => (curr === po.id ? null : curr));
    }, 250);
    return;
  }
  Alert.alert("Mark as Received?", body, [
    { text: "Cancel", style: "cancel" },
    {
      text: "Received",
      onPress: () => {
        opts.setMarkingPOReceivedId(po.id);
        opts.markPOReceived(po.id);
        setTimeout(() => {
          opts.setMarkingPOReceivedId((curr) => (curr === po.id ? null : curr));
        }, 250);
      },
    },
  ]);
}

/** RN Web: two-button `Alert.alert` is a no-op in Safari — use `confirm` for PO Cancel. */
function maybeWebConfirmPOCancel(
  po: { id: string; poNumber?: string },
  cancelPO: (id: string) => void
) {
  const body = `Cancel ${po.poNumber ?? "this PO"}?`;
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.confirm === "function") {
    if (window.confirm(`Cancel PO?\n\n${body}`)) cancelPO(po.id);
    return;
  }
  Alert.alert("Cancel PO?", body, [
    { text: "No", style: "cancel" },
    { text: "Cancel PO", style: "destructive", onPress: () => cancelPO(po.id) },
  ]);
}

const PROJECT_SCAN_DESTINATIONS = ['project_budget'];
const MATERIALS_SCAN_SAVE_LABEL = 'Add to Materials & Equipment';

type Props = {
  visible: boolean;
  categoryName: string;
  onClose: () => void;
  theme?: any;
  /** When user taps a Labor/Materials row synced from an approved CO, parent switches here and passes id once. */
  openChangeOrderEditId?: string | null;
  onConsumedOpenChangeOrderEditId?: () => void;
  onRequestOpenChangeOrder?: (changeOrderId: string) => void;
  onRequestOpenTimeline?: () => void;
};

export default function CategoryDetailModal({
  visible,
  categoryName,
  onClose,
  theme: _theme,
  openChangeOrderEditId = null,
  onConsumedOpenChangeOrderEditId,
  onRequestOpenChangeOrder,
  onRequestOpenTimeline,
}: Props) {
  const DEBUG_MODAL = false;
  const debugLog = (...args: any[]) => { if (DEBUG_MODAL) console.log(...args); };
  const { theme: appTheme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(appTheme), [appTheme]);
  const supportSub = useMemo(
    () => (darkMode ? "rgba(226, 232, 240, 0.78)" : Colors.sub),
    [darkMode, Colors.sub]
  );
  const categoryFlowCardStyle = tabFlowCardStyle(Colors, darkMode, { marginBottom: 14 });
  const nestedCardBg = darkMode ? ESTIMATE_FLOW_NESTED_CARD_BG_DARK : Colors.surface2;
  const nestedCardBorder = darkMode ? "rgba(148,163,184,0.12)" : Colors.line;
  const { width: categoryLayoutWidth } = useWindowDimensions();
  const categoryDesktopWeb =
    Platform.OS === "web" && isDesktopWebLayoutWidth(categoryLayoutWidth);
  const useNativeBudgetBleed =
    Platform.OS === "ios" || Platform.OS === "android";
  const pageWideBleedStyle = useMemo(
    () =>
      useNativeBudgetBleed
        ? {
            marginHorizontal: -ScreenLayout.edge.horizontal,
            paddingHorizontal: PROJECT_WIDE_CONTAINER_CARD_INSET,
          }
        : undefined,
    [useNativeBudgetBleed]
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChangeOrderId, setEditingChangeOrderId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingPOReceivedId, setMarkingPOReceivedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [activePOTab, setActivePOTab] = useState<'total' | 'committed' | 'received'>('total');
  const [productScannerVisible, setProductScannerVisible] = useState(false);
  const [scannedProjectProduct, setScannedProjectProduct] = useState<any>(null);
  const previousDataRef = useRef<any[]>([]);
  const actionButtonTapRef = useRef(false);
  const { projectData, addExpense, deleteExpense, updateExpense, addChangeOrder, updateChangeOrder, deleteChangeOrder, approveChangeOrder, addPurchaseOrder, updatePurchaseOrder, markPOReceived, cancelPO } = useProjectData();

  // Special handling for Change Orders and Purchase Orders - show actual objects, not expenses
  const isChangeOrdersCategory = categoryName.toLowerCase().includes('change order');
  const isPurchaseOrdersCategory = categoryName.toLowerCase().includes('purchase order');
  const categoryLower = categoryName.toLowerCase();
  const isMaterialsEquipmentCategory =
    !isChangeOrdersCategory &&
    !isPurchaseOrdersCategory &&
    (categoryLower.includes('materials') || categoryLower.includes('equipment'));
  const isLaborCategory =
    categoryLower.includes('labor') || categoryLower.includes('subs');
  const shouldGroupByEstimateLine =
    isMaterialsEquipmentCategory || isLaborCategory;
  const usesWideDarkCardLayout =
    shouldGroupByEstimateLine ||
    isChangeOrdersCategory ||
    isPurchaseOrdersCategory;
  const cardBg =
    usesWideDarkCardLayout && darkMode ? AI_FLOW_CARD_BG_DARK : nestedCardBg;

  const projectLookupZip = useMemo(() => {
    const raw =
      projectData?.customerZip ||
      projectData?.projectZip ||
      projectData?.zip ||
      projectData?.location?.zip;
    const zip = String(raw || '').replace(/\D/g, '').slice(0, 5);
    return zip || undefined;
  }, [projectData]);

  const scannerFlowActive = productScannerVisible || Boolean(scannedProjectProduct);

  const handleMaterialsScannedProductSave = useCallback((payload: ProductScannerSavePayload) => {
    const { product, quantity, unitCost, description, notes, vendor: scannedVendor } = payload;
    const qty = Math.max(Number(quantity) || 0, 0);
    const cost = Math.max(Number(unitCost) || 0, 0);
    const costTotal = Math.round(qty * cost * 100) / 100;
    const productNotes = buildProductNotes(product, notes);
    const vendor = scannedVendor?.trim() || product.supplier || 'Scanned supplier';
    const title = description || product.title || 'Scanned product';
    const dateAdded = new Date().toISOString();
    const expenseSource =
      product.supplierId === 'generic' ? 'scanner' : product.supplier || 'Home Depot';

    addExpense({
      id: `scan-exp-${Date.now()}`,
      category: categoryName,
      vendor,
      material: title,
      amount: costTotal,
      date: dateAdded,
      notes: productNotes,
      sku: product.sku || product.model || product.upc,
      sourceUrl: product.sourceUrl,
      vendorName: vendor,
      productTitle: product.title || title,
      description: title,
      modelNumber: product.model || null,
      upc: product.upc || null,
      productUrl: product.sourceUrl || null,
      imageUrl: product.imageUrl || null,
      quantity: qty,
      unitCost: cost,
      lineItemTotal: costTotal,
      source: expenseSource,
      dateAdded,
      internalNotes: notes || '',
    } as any);

    setScannedProjectProduct(null);
    setProductScannerVisible(false);
    categoryDetailWebAlert('Added!', `${title} was added to Materials & Equipment.`);
  }, [addExpense, categoryName]);

  useEffect(() => {
    if (!visible) {
      setProductScannerVisible(false);
      setScannedProjectProduct(null);
    }
  }, [visible]);

  const changeOrderEditDraft = useMemo(() => {
    if (!editingChangeOrderId || !isChangeOrdersCategory) return null;
    const raw = projectData.changeOrders?.find((c: any) => c.id === editingChangeOrderId);
    if (!raw) return null;
    const mat = Number(raw.materialsAmount) || 0;
    const lab = Number(raw.laborAmount) || 0;
    const total = Number(raw.amount) || mat + lab;
    return {
      vendor: String(raw.title ?? ''),
      amount: total,
      materialsAmount: mat,
      laborAmount: lab,
      description: String(raw.notes ?? ''),
    };
  }, [editingChangeOrderId, isChangeOrdersCategory, projectData.changeOrders]);

  useEffect(() => {
    if (!visible || !isChangeOrdersCategory || !openChangeOrderEditId) return;
    const id = String(openChangeOrderEditId).trim();
    if (!id) {
      onConsumedOpenChangeOrderEditId?.();
      return;
    }
    const exists = (projectData.changeOrders || []).some((c: any) => String(c?.id) === id);
    if (exists) {
      setEditingChangeOrderId(id);
      setShowAddForm(true);
    }
    onConsumedOpenChangeOrderEditId?.();
  }, [
    visible,
    isChangeOrdersCategory,
    openChangeOrderEditId,
    projectData.changeOrders,
    onConsumedOpenChangeOrderEditId,
  ]);
  
  // Filter expenses by category (flexible matching for Materials/Equipment)
  // OR show change orders if category is "Change Orders"
  // OR show purchase orders if category is "Purchase Orders"
  const data = useMemo(() => {
    // If this is the Purchase Orders category, show purchase order objects
    if (isPurchaseOrdersCategory) {
      const purchaseOrders = projectData.purchaseOrders || [];
      debugLog('📊 CategoryDetailModal: Showing purchase orders. Total:', purchaseOrders.length);
      debugLog('📊 CategoryDetailModal: PO statuses:', purchaseOrders.map((po: any) => ({ id: po.id, status: po.status, vendor: po.vendor })));
      
      const poData = purchaseOrders
        .filter((po: any) => {
          // Filter based on active tab for Purchase Orders
          if (activePOTab === 'total') {
            // Total = Pending + Received (all active POs, exclude Cancelled, Archived)
            return po.status === 'Pending' || po.status === 'Received';
          } else if (activePOTab === 'committed') {
            // Committed POs = Only Pending (not yet paid)
            return po.status === 'Pending';
          } else if (activePOTab === 'received') {
            return po.status === 'Received';
          }
          // Fallback: exclude Cancelled and Archived
          return po.status !== 'Cancelled' && po.status !== 'Archived';
        })
        .map((po: any) => {
          return {
            id: po.id,
            date: po.orderDate || new Date().toISOString(),
            vendor: po.vendor || 'Unknown',
            amount: po.amount || 0,
            description: po.description || '',
            receiptUri: undefined,
            isPlanned: po.status === 'Pending',
            projectPhase: undefined,
            scope: undefined,
            priceReasonableness: undefined,
            // Purchase order specific fields
            isPurchaseOrder: true,
            status: po.status || 'Pending', // Ensure status is preserved
            poNumber: po.poNumber,
            expectedDelivery: po.expectedDelivery,
            category: po.category,
          };
        })
        .sort((a, b) => {
          // Sort by status: Pending first, then Received, then by date
          const statusOrder = { 'Pending': 0, 'Received': 1, 'Cancelled': 2 };
          const statusDiff = (statusOrder[a.status as keyof typeof statusOrder] || 99) - (statusOrder[b.status as keyof typeof statusOrder] || 99);
          if (statusDiff !== 0) return statusDiff;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      
      if (poData.length > 0) {
        previousDataRef.current = poData;
      }
      
      return poData;
    }
    
    // If this is the Change Orders category, show change order objects
    if (isChangeOrdersCategory) {
      const changeOrders = projectData.changeOrders || [];
      debugLog('📊 CategoryDetailModal: Showing change orders. Total:', changeOrders.length);
      
      const coData = changeOrders.map((co: any) => {
        // Determine status
        let status = co.status;
        if (!status) {
          if (co.approved === true || co.approved === 'true') {
            status = 'Approved';
          } else {
            status = 'Submitted';
          }
        }
        
        return {
          id: co.id,
          date: co.date || new Date().toISOString(),
          vendor: co.title || 'Change Order',
          amount: co.amount || 0,
          description: co.notes || '',
          receiptUri: undefined,
          isPlanned: co.approved || status === 'Approved',
          projectPhase: undefined,
          scope: undefined,
          priceReasonableness: undefined,
          // Change order specific fields
          isChangeOrder: true,
          status: status,
          approved: co.approved || status === 'Approved',
          materialsAmount: co.materialsAmount,
          laborAmount: co.laborAmount,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      if (coData.length > 0) {
        previousDataRef.current = coData;
      }
      
      return coData;
    }
    
    // Otherwise, filter expenses by category
    const expenses = projectData.expenses || [];
    const categoryLower = categoryName.toLowerCase();
    
    debugLog('📊 CategoryDetailModal: Filtering expenses. Total:', expenses.length, 'Category:', categoryName);
    debugLog('📊 CategoryDetailModal: All expenses:', expenses.map((e: any) => ({ 
      id: e.id, 
      category: e.category, 
      vendor: e.vendor, 
      amount: e.amount 
    })));
    
    const filtered = expenses
      .filter(exp => {
        const expCategory = (exp.category || '').toLowerCase();
        
        debugLog(`🔍 Checking expense: category="${expCategory}" vs categoryName="${categoryLower}"`);
        
        // Exact match
        if (expCategory === categoryLower) {
          debugLog(`✅ Exact match: ${expCategory} === ${categoryLower}`);
          return true;
        }
        
        // Flexible match for Materials/Equipment
        // Also match specific material names (tile, drywall, lumber, etc.) to Materials/Equipment
        const isMaterialsCategory = categoryLower.includes('materials') || categoryLower.includes('equipment');
        const isMaterialExpense = expCategory.includes('materials') || 
                                   expCategory.includes('equipment') ||
                                   // Common material names that should match Materials/Equipment
                                   ['tile', 'drywall', 'lumber', 'concrete', 'paint', 'electrical', 
                                    'plumbing', 'hardware', 'roofing', 'insulation', 'flooring', 
                                    'cabinets', 'appliances', 'windows', 'doors', 'siding', 
                                    'decking', 'fencing', 'landscaping'].includes(expCategory);
        
        if (isMaterialsCategory && isMaterialExpense) {
          debugLog(`✅ Materials match: isMaterialsCategory=${isMaterialsCategory}, isMaterialExpense=${isMaterialExpense}`);
          return true;
        }
        
        // Flexible match for Labor
        if (categoryLower.includes('labor') && expCategory.includes('labor')) {
          debugLog(`✅ Labor match`);
          return true;
        }

        // Flexible match for Allowances
        if (categoryLower.includes('allowance') && expCategory.includes('allowance')) {
          debugLog(`✅ Allowances match`);
          return true;
        }
        
        debugLog(`❌ No match for expense category="${expCategory}"`);
        return false;
      })
      .map(exp => {
        // CRITICAL: Preserve the original expense ID - don't generate a new one
        // If the expense doesn't have an ID, we need to find it in the original array
        const expenseId = exp.id;
        if (!expenseId) {
          console.warn('⚠️ Expense missing ID:', exp);
        }
        return {
          id: expenseId || `exp-${Date.now()}-${Math.random()}`, // Only generate if truly missing
          date: exp.date || new Date().toISOString(),
          vendor: exp.vendor || 'Unknown',
          material: exp.material || '',
          amount: exp.amount || 0,
          description: exp.notes || '',
          productTitle: exp.productTitle || exp.material || '',
          modelNumber: exp.modelNumber || exp.model || null,
          upc: exp.upc || null,
          productUrl: exp.productUrl || exp.sourceUrl || null,
          imageUrl: exp.imageUrl || null,
          quantity: Number(exp.quantity) || 0,
          unitCost: Number(exp.unitCost) || 0,
          lineItemTotal: Number(exp.lineItemTotal || exp.amount || 0),
          source: exp.source || undefined,
          dateAdded: exp.dateAdded || exp.date || undefined,
          internalNotes: exp.internalNotes || '',
          isScannedProduct: Boolean(
            (exp.source === 'Home Depot' || exp.source === 'scanner' || exp.source === "Lowe's") &&
              (exp.quantity || exp.unitCost || exp.lineItemTotal),
          ),
          po: exp.po || undefined,
          receiptUri: exp.receiptUri || undefined,
          isPlanned: exp.isPlanned !== undefined ? exp.isPlanned : true,
          projectPhase: exp.projectPhase || undefined,
          scope: exp.scope || undefined,
          priceReasonableness: exp.priceReasonableness || undefined,
          linkedLineId: exp.linkedLineId || undefined,
          isChangeOrder: false,
          isChangeOrderMirror: isChangeOrderMirrorExpenseId(expenseId),
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Most recent first
    
    debugLog('📊 CategoryDetailModal: Filtered expenses count:', filtered.length);
    
    // Store previous data for smooth transitions (only when we have data)
    if (filtered.length > 0) {
      previousDataRef.current = filtered;
    }
    
    // Return filtered data (don't freeze during delete - let it update naturally)
    return filtered;
  }, [projectData.expenses, projectData.changeOrders, projectData.purchaseOrders, categoryName, isChangeOrdersCategory, isPurchaseOrdersCategory, showArchived, activePOTab]);

  const estimateLineIdToLabel = useMemo(() => {
    if (!shouldGroupByEstimateLine) return {};
    return buildEstimateLineIdToLabel(
      resolveProjectEstimateData(projectData as unknown as Record<string, unknown>),
      isLaborCategory ? 'labor' : 'materials'
    );
  }, [projectData, shouldGroupByEstimateLine, isLaborCategory]);

  const listItems = useMemo(() => {
    if (!shouldGroupByEstimateLine) {
      return data.map((item) => ({ kind: 'single' as const, item }));
    }
    return buildGroupedCategoryExpenseList(data, estimateLineIdToLabel);
  }, [data, shouldGroupByEstimateLine, estimateLineIdToLabel]);

  const hasCategoryTransactions = listItems.length > 0;

  const total = useMemo(() => {
    // For Purchase Orders, calculate total based on active tab
    if (isPurchaseOrdersCategory) {
      // For tabs, just sum the filtered data (already filtered by tab)
      return data.reduce((sum, item) => sum + (item.amount || 0), 0);
    }
    // For all other categories, sum all items
    return data.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [data, isPurchaseOrdersCategory]);

  const estimateBudgetKind = isLaborCategory ? 'labor' : 'materials';
  const { spendSummaries, categorySummary: estimateCategorySummary } =
    useEstimateLineBudgets(
    shouldGroupByEstimateLine ? (projectData as unknown as Record<string, unknown>) : null,
    estimateBudgetKind
  );

  const categoryBudgetSummary = useMemo(
    () =>
      shouldGroupByEstimateLine && estimateCategorySummary.hasEstimateBudget
        ? buildCategoryBudgetSummary(estimateCategorySummary.totalBudget, total)
        : buildCategoryBudgetSummary(0, total),
    [shouldGroupByEstimateLine, estimateCategorySummary, total]
  );

  // Reset add form when category modal closes (avoids stale open state on next open)
  useEffect(() => {
    if (!visible) {
      setShowAddForm(false);
      setEditingChangeOrderId(null);
    }
  }, [visible]);

  // Update ref when data changes
  useEffect(() => {
    previousDataRef.current = data;
  }, [data]);
  

  const categoryIcon = categoryName.toLowerCase().includes('labor')
    ? '👷'
    : categoryName.toLowerCase().includes('materials') ||
        categoryName.toLowerCase().includes('equipment')
      ? '🧱'
      : categoryName.toLowerCase().includes('allowance')
        ? '💼'
        : categoryName.toLowerCase().includes('subs')
          ? '👥'
          : '📦';

  // Check for duplicate transactions
  const checkForDuplicates = (transaction: any): boolean => {
    const expenses = projectData.expenses || [];
    const normalizeItemText = (value: unknown): string =>
      String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    const transactionItem = normalizeItemText(
      transaction.material || transaction.description || transaction.notes
    );
    const duplicate = expenses.find(exp => 
      exp.vendor === transaction.vendor &&
      Math.abs(exp.amount - transaction.amount) < 0.01 &&
      Math.abs(new Date(exp.date).getTime() - new Date(transaction.date).getTime()) < 86400000 && // Same day
      transactionItem.length > 0 &&
      normalizeItemText(exp.material || exp.description || exp.notes) === transactionItem
    );
    return !!duplicate;
  };

  // Check for missing receipt on large spend
  const checkMissingReceipt = (transaction: any): boolean => {
    return transaction.amount > 1000 && !transaction.receiptUri;
  };

  const handleAddTransaction = (transaction: any) => {
    // Handle Purchase Orders
    if (isPurchaseOrdersCategory) {
      const amount = Number(transaction.amount || 0);
      if (!transaction.vendor || amount <= 0) {
        categoryDetailWebAlert("Error", "Please enter a vendor and amount.");
        return;
      }

      // Generate PO number
      const poNumber = transaction.po || `PO-${Date.now().toString().slice(-6)}`;
      
      addPurchaseOrder({
        poNumber: poNumber,
        vendor: transaction.vendor,
        category: transaction.category || 'Materials',
        amount: amount,
        description: transaction.description || '',
        orderDate: transaction.date || new Date().toISOString().split('T')[0],
        expectedDelivery: transaction.expectedDelivery || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'Pending',
        notes: transaction.description || '',
      });
      
      setShowAddForm(false);
      categoryDetailWebAlert(
        "Created!",
        "Purchase Order created. It will appear in Committed POs."
      );
      return;
    }
    
    // Handle Change Orders
    if (isChangeOrdersCategory) {
      const amount = Number(transaction.amount || 0);
      const materialsAmount = Number(transaction.materialsAmount || 0);
      const laborAmount = Number(transaction.laborAmount || 0);
      if (!transaction.vendor || amount <= 0) {
        categoryDetailWebAlert(
          "Error",
          "Please enter a change order title and a valid amount (or material and labor amounts)."
        );
        return;
      }

      if (editingChangeOrderId) {
        const existing = projectData.changeOrders?.find((c: any) => c.id === editingChangeOrderId);
        if (!existing) {
          setEditingChangeOrderId(null);
          categoryDetailWebAlert("Error", "Change order not found.");
          return;
        }
        const wasApproved = !!(existing.approved || existing.status === "Approved");
        addChangeOrder({
          id: editingChangeOrderId,
          title: transaction.vendor,
          amount: amount,
          materialsAmount,
          laborAmount,
          notes: transaction.description || "",
          approved: wasApproved,
          status: existing.status || (wasApproved ? "Approved" : "Submitted"),
        });
        setEditingChangeOrderId(null);
        setShowAddForm(false);
        categoryDetailWebAlert("Updated", "Change order updated.");
        return;
      }

      addChangeOrder({
        id: `co-${Date.now()}`,
        title: transaction.vendor,
        amount: amount,
        materialsAmount,
        laborAmount,
        notes: transaction.description || "",
        approved: false,
        status: "Submitted",
      });
      setShowAddForm(false);
      categoryDetailWebAlert(
        "Saved",
        "Change order saved as submitted. When the customer approves, tap Approve on the card to add it to your budget."
      );
      return;
    }

    // Check for duplicates
    const isDuplicate = checkForDuplicates(transaction);
    if (isDuplicate) {
      const dupMsg = `A similar transaction was found:\n${transaction.vendor} - ${formatMoneyFull(transaction.amount)}\n\nContinue anyway?`;
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        typeof window.confirm === "function"
      ) {
        if (window.confirm(`Possible duplicate\n\n${dupMsg}`)) {
          saveTransaction(transaction);
        }
        return;
      }
      Alert.alert("⚠️ Possible Duplicate", dupMsg, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => saveTransaction(transaction),
          style: "default",
        },
      ]);
      return;
    }

    // Check for missing receipt on large spend
    const missingReceipt = checkMissingReceipt(transaction);
    if (missingReceipt) {
      const recMsg =
        "This transaction is over $1,000. Consider adding a receipt for audit protection.\n\nSave anyway?";
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        typeof window.confirm === "function"
      ) {
        if (window.confirm(`Receipt recommended\n\n${recMsg}`)) {
          saveTransaction(transaction);
        }
        return;
      }
      Alert.alert("📄 Receipt Recommended", recMsg, [
        {
          text: "Add Receipt",
          onPress: () => {
            saveTransaction(transaction);
          },
        },
        {
          text: "Save Without Receipt",
          onPress: () => saveTransaction(transaction),
          style: "cancel",
        },
      ]);
      return;
    }

    saveTransaction(transaction);
  };

  const saveTransaction = (transaction: any) => {
    // Add expense to project data with category
    addExpense({
      id: transaction.id || String(Date.now()),
      category: categoryName,
      vendor: transaction.vendor,
      material: transaction.material?.trim() || undefined,
      amount: transaction.amount,
      date: transaction.date,
      notes: transaction.description,
      receiptUri: transaction.receiptUri || null,
      linkedLineId: transaction.linkedLineId || undefined,
      isPlanned: transaction.isPlanned !== undefined ? transaction.isPlanned : true,
      projectPhase: transaction.projectPhase || undefined,
      scope: transaction.scope || undefined,
      priceReasonableness: transaction.priceReasonableness || undefined,
    });

    const successMsg = `Added ${formatMoneyFull(transaction.amount, { decimals: 2 })} to ${categoryName}`;
    setShowAddForm(false);
    categoryDetailWebAlert("Success!", successMsg);
  };

  return (
    <>
    <Modal
      visible={
        Platform.OS === "web"
          ? visible &&
              !showAddForm &&
              editingTransaction === null &&
              editingPurchaseOrder === null &&
              !scannerFlowActive
          : visible && !scannerFlowActive
      }
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <View
        style={[
          {
            flex: 1,
            width: "100%",
            backgroundColor: darkMode ? "#000000" : Colors.bg,
          },
          categoryDesktopWeb && { alignItems: "center" as const },
        ]}
      >
        <View
          style={[
            styles.container,
            !darkMode && { backgroundColor: Colors.bg },
            categoryDesktopWeb && {
              width: "100%",
              maxWidth: DASHBOARD_WEB_MAX_CONTENT_WIDTH,
            },
          ]}
        >
        {/* Header */}
        <View style={[styles.header, !darkMode && { borderBottomColor: Colors.line }]}>
          <View style={styles.headerTop}>
            <View style={styles.backButtonWrapper}>
              {darkMode ? (
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <GradientRingBackInner
                  darkMode
                  onPress={onClose}
                  style={[styles.backButton, { backgroundColor: "#000000" }]}
                >
                    <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </GradientRingBackInner>
              </LinearGradient>
              ) : (
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.backButtonBorder}
                >
                  <GradientRingBackInner
                    darkMode={false}
                    onPress={onClose}
                    style={[styles.backButton, { backgroundColor: Colors.bg }]}
                  >
                    <MaterialIcons name="arrow-back" size={24} color="#000000" />
                  </GradientRingBackInner>
                </LinearGradient>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={styles.headerIconContainerWrapper}>
                  {darkMode ? (
                  <LinearGradient
                    colors={BRAND_FRAME_GRADIENT_COLORS}
                    start={{ x: 0.05, y: 0.15 }}
                    end={{ x: 0.95, y: 0.85 }}
                    style={styles.headerIconBorder}
                  >
                      <View style={[styles.headerIconContainer, { backgroundColor: "#000000" }]}>
                      <Text style={{ fontSize: 24 }}>{categoryIcon}</Text>
                    </View>
                  </LinearGradient>
                  ) : (
                    <LinearGradient
                      colors={BRAND_FRAME_GRADIENT_COLORS}
                      start={{ x: 0.05, y: 0.15 }}
                      end={{ x: 0.95, y: 0.85 }}
                      style={styles.headerIconBorder}
                    >
                      <View style={[styles.headerIconContainer, { backgroundColor: Colors.bg }]}>
                        <Text style={{ fontSize: 24 }}>{categoryIcon}</Text>
                      </View>
                    </LinearGradient>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.headerTitle, !darkMode && { color: Colors.text }]}>
                    {categoryName.replace('/', ' & ')}
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: supportSub }]}>
                    Transactions & Invoices
                  </Text>
                </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            !hasCategoryTransactions && styles.scrollContentCompact,
            usesWideDarkCardLayout && styles.materialsWideScrollContent,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={usesWideDarkCardLayout ? undefined : pageWideBleedStyle}>
            <View
              style={
                usesWideDarkCardLayout
                  ? undefined
                  : [
                      categoryFlowCardStyle,
                      !hasCategoryTransactions && styles.categoryFlowCardCompact,
                    ]
              }
            >
          {/* Tabs for Purchase Orders */}
          {isPurchaseOrdersCategory && (
            <View style={styles.poTabContainer}>
              <TouchableOpacity
                style={[
                  styles.poTab,
                  activePOTab === 'total' && styles.poActiveTab,
                  { 
                    borderColor: activePOTab === 'total' ? Colors.primary : Colors.line,
                    backgroundColor: cardBg,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActivePOTab('total');
                }}
              >
                <Text
                  style={[
                    styles.poTabText,
                    {
                      color: activePOTab === 'total' ? Colors.primary : Colors.sub,
                      fontWeight: activePOTab === 'total' ? '600' : '400',
                      lineHeight: 20,
                    },
                  ]}
                >
                  Total
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.poTab,
                  activePOTab === 'committed' && styles.poActiveTab,
                  { 
                    borderColor: activePOTab === 'committed' ? Colors.primary : Colors.line,
                    backgroundColor: cardBg,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActivePOTab('committed');
                }}
              >
                <Text
                  style={[
                    styles.poTabText,
                    {
                      color: activePOTab === 'committed' ? Colors.primary : Colors.sub,
                      fontWeight: activePOTab === 'committed' ? '600' : '400',
                      lineHeight: 20,
                    },
                  ]}
                >
                  Committed POs
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.poTab,
                  activePOTab === 'received' && styles.poActiveTab,
                  { 
                    borderColor: activePOTab === 'received' ? Colors.primary : Colors.line,
                    backgroundColor: cardBg,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActivePOTab('received');
                }}
              >
                <Text
                  style={[
                    styles.poTabText,
                    {
                      color: activePOTab === 'received' ? Colors.primary : Colors.sub,
                      fontWeight: activePOTab === 'received' ? '600' : '400',
                      lineHeight: 20,
                    },
                  ]}
                >
                  Received
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Total Spent / Budget Card */}
          {shouldGroupByEstimateLine ? (
            <CategoryEstimateBudgetCard
              summary={categoryBudgetSummary}
              darkMode={darkMode}
              nestedCardBg={cardBg}
              nestedCardBorder={nestedCardBorder}
              labelColor={supportSub}
              valueColor={Colors.text}
            />
          ) : (
          <View style={styles.totalCardContainer}>
            {darkMode ? (
              <View
                style={[
                  styles.totalCardInner,
                  {
                    backgroundColor: cardBg,
                    borderWidth: 1,
                    borderColor: "rgba(148, 163, 184, 0.12)",
                    borderRadius: 14,
                  },
                ]}
              >
                <View style={styles.totalCard}>
                  <Text style={[styles.totalLabel, { color: supportSub }]}>
                    {isPurchaseOrdersCategory 
                      ? (activePOTab === 'total' ? 'Total POs' : activePOTab === 'committed' ? 'Committed POs' : 'Received POs')
                      : 'Total Spent'}
                  </Text>
                  <Text style={styles.totalValue}>{formatMoneyFull(total, { decimals: 2 })}</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.totalCardBorderLight, { borderColor: Colors.line }]}>
                <View style={[styles.totalCardInner, { backgroundColor: cardBg, borderColor: nestedCardBorder, borderWidth: 1 }]}>
                  <View style={styles.totalCard}>
                    <Text style={[styles.totalLabel, { color: Colors.sub }]}>
                      {isPurchaseOrdersCategory 
                        ? (activePOTab === 'total' ? 'Total POs' : activePOTab === 'committed' ? 'Committed POs' : 'Received POs')
                        : 'Total Spent'}
                    </Text>
                    <Text style={styles.totalValue}>{formatMoneyFull(total, { decimals: 2 })}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
          )}

          {isMaterialsEquipmentCategory ? (
            <>
              {Platform.OS !== "web" ? (
                <TouchableOpacity
                  style={[
                    styles.materialsScanButton,
                    darkMode
                      ? { backgroundColor: cardBg, borderColor: nestedCardBorder }
                      : { backgroundColor: Colors.surface2, borderColor: Colors.line },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setProductScannerVisible(true);
                  }}
                  activeOpacity={0.88}
                >
                  <Ionicons name="camera-outline" size={18} color="#22c55e" />
                  <Text style={[styles.materialsScanButtonText, { color: darkMode ? "#F5F7FA" : Colors.text }]}>
                    Scan Product
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.addButtonWrapper}
                onPress={() => {
                  setEditingChangeOrderId(null);
                  setShowAddForm(true);
                }}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addButton}
                >
                  <Text style={styles.addButtonText}>+ Add Materials/Equipment</Text>
                </LinearGradient>
              </TouchableOpacity>
              {Platform.OS !== "web" ? (
                <Text style={[styles.materialsScanHelper, { color: supportSub }]}>
                  Scan a barcode to add Home Depot products faster.
                </Text>
              ) : null}
            </>
          ) : (
            <TouchableOpacity
              style={styles.addButtonWrapper}
              onPress={() => {
                setEditingChangeOrderId(null);
                setShowAddForm(true);
              }}
            >
              <LinearGradient
                colors={["#22c55e", "#22d3ee"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addButton}
              >
                <Text style={styles.addButtonText}>+ Add {categoryName}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isChangeOrdersCategory && (
            <TouchableOpacity
              style={[
                styles.coTimelineReminder,
                {
                  backgroundColor: darkMode ? "rgba(34, 197, 94, 0.08)" : "rgba(34, 197, 94, 0.1)",
                  borderColor: darkMode ? "rgba(34, 197, 94, 0.3)" : "rgba(34, 197, 94, 0.28)",
                },
              ]}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel="Open Timeline to mark a change order as completed"
              onPress={() => {
                onClose();
                onRequestOpenTimeline?.();
              }}
            >
              <MaterialIcons name="event-available" size={22} color="#22c55e" style={{ marginTop: 1 }} />
              <Text
                style={[
                  styles.coTimelineReminderText,
                  { color: darkMode ? "rgba(226, 232, 240, 0.92)" : Colors.text },
                ]}
              >
                When payment is received, tap here to open Timeline and mark the matching line as{" "}
                <Text style={{ fontWeight: "800", color: "#22c55e" }}>Completed</Text> in the
                Timeline tab.
              </Text>
            </TouchableOpacity>
          )}

          {/* Transactions List */}
          {listItems.length > 0 ? (
            <View style={styles.transactionsContainer}>
              {listItems.map((entry) => {
                if (entry.kind === 'group') {
                  const lineId = resolveExpenseLineId({
                    groupKey: entry.groupKey,
                    expense: entry.items[0],
                    lineIdToLabel: estimateLineIdToLabel,
                  });
                  return (
                    <EstimateLineExpenseGroupCard
                      key={entry.groupKey}
                      lineName={entry.lineName}
                      items={entry.items}
                      darkMode={darkMode}
                      nestedCardBg={cardBg}
                      nestedCardBorder={darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line}
                      textColor={darkMode ? '#FFFFFF' : Colors.text}
                      subtextColor={darkMode ? 'rgba(226, 232, 240, 0.72)' : Colors.sub}
                      deletingId={deletingId}
                      budgetSummary={lookupSpendSummary(spendSummaries, lineId)}
                      onPressItem={(item) => setEditingTransaction(item)}
                    />
                  );
                }

                const item = entry.item;
                const itemLineId = shouldGroupByEstimateLine
                  ? resolveExpenseLineId({
                      expense: item,
                      lineIdToLabel: estimateLineIdToLabel,
                    })
                  : null;
                const itemBudgetSummary = shouldGroupByEstimateLine
                  ? lookupSpendSummary(spendSummaries, itemLineId)
                  : null;
                const itemSubtitles = expenseSubtitleLines({
                  vendor: item.vendor,
                  material: item.material,
                  description: item.description,
                });
                const isItemDeleting = deletingId === item.id;
                
                // For Purchase Orders, use the BudgetTab card design
                if (isPurchaseOrdersCategory && item.isPurchaseOrder) {
                  const po = projectData.purchaseOrders?.find((p: any) => p.id === item.id);
                  if (!po) return null;
                  
                  const daysUntilDelivery = Math.ceil((parseLocalDate(po.expectedDelivery).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const categoryIcon = po.category === 'Labor' ? '👷' : po.category === 'Materials' ? '🧱' : po.category === 'Equipment' ? '🔧' : '👥';
                  
                  return (
                    <View key={item.id} style={{ marginBottom: 12 }}>
                      {darkMode ? (
                          <View
                            style={[
                              styles.transactionCard,
                              {
                                padding: 16,
                                backgroundColor: cardBg,
                                borderWidth: 1,
                                borderColor: "rgba(148, 163, 184, 0.12)",
                              },
                            ]}
                          >
                            <Pressable 
                              onPress={() => {
                                if (actionButtonTapRef.current) return;
                                if (isItemDeleting) return;
                                setEditingPurchaseOrder(po);
                              }}
                              style={{ flex: 1 }}
                            >
                              {/* Header with PO Number and Icon */}
                              <View style={{ marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                  <Text style={{ fontSize: 18 }}>{categoryIcon}</Text>
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text 
                                      style={{ color: Colors.text, fontSize: 15, lineHeight: 20, fontWeight: '700' }}
                                      numberOfLines={1}
                                      ellipsizeMode="tail"
                                    >
                                      {po.poNumber}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                                      <Text style={{ color: Colors.sub, fontSize: 11 }}>{po.vendor || 'No vendor'}</Text>
                                      <View style={{ 
                                        backgroundColor: po.status === 'Pending' 
                                          ? '#f59e0b' 
                                          : po.status === 'Received'
                                          ? '#22c55e'
                                          : '#64748b',
                                        width: 6,
                                        height: 6,
                                        borderRadius: 3,
                                        marginLeft: 6
                                      }} />
                                      <Text style={{ 
                                        color: po.status === 'Pending' 
                                          ? '#f59e0b' 
                                          : po.status === 'Received'
                                          ? '#22c55e'
                                          : '#64748b',
                                        fontSize: 10,
                                        fontWeight: '600',
                                        letterSpacing: 0.5
                                      }}>
                                        {po.status.toUpperCase()}
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={{ 
                                    color: po.status === 'Pending' 
                                      ? '#f59e0b' 
                                      : po.status === 'Received'
                                      ? '#22c55e'
                                      : '#64748b',
                                    fontSize: 15,
                                    fontWeight: '700'
                                  }}>
                                    {formatMoneyFull(po.amount, { decimals: 2 })}
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
                                <Text style={{ color: Colors.sub, fontSize: 10, marginBottom: 3 }}>Expected Delivery</Text>
                                <Text style={{ 
                                  color: po.status === 'Pending' && daysUntilDelivery <= 3 ? '#ef4444' : '#22c55e',
                                  fontSize: 12,
                                  fontWeight: '600'
                                }}>
                                  {parseLocalDate(po.expectedDelivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                                  <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16 }} numberOfLines={2} ellipsizeMode="tail">{po.description}</Text>
                                </View>
                              )}

                              {/* Actions */}
                              {po.status === 'Pending' && (
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                                  <TouchableOpacity
                                    onPressIn={() => { actionButtonTapRef.current = true; }}
                                    onPressOut={() => { setTimeout(() => { actionButtonTapRef.current = false; }, 0); }}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      maybeWebConfirmPOMarkReceived(po, {
                                        markingPOReceivedId,
                                        setMarkingPOReceivedId,
                                        markPOReceived,
                                      });
                                    }}
                                    disabled={markingPOReceivedId === po.id}
                                    style={{ 
                                      flex: 1, 
                                      backgroundColor: markingPOReceivedId === po.id ? '#64748b' : '#22c55e', 
                                      paddingVertical: 8, 
                                      borderRadius: 8, 
                                      alignItems: 'center',
                                      opacity: markingPOReceivedId === po.id ? 0.6 : 1
                                    }}
                                  >
                                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
                                      {markingPOReceivedId === po.id ? '...' : '✓ Received'}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPressIn={() => { actionButtonTapRef.current = true; }}
                                    onPressOut={() => { setTimeout(() => { actionButtonTapRef.current = false; }, 0); }}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      maybeWebConfirmPOCancel(po, cancelPO);
                                    }}
                                    style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center' }}
                                  >
                                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>✕ Cancel</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </Pressable>
                          </View>
                      ) : (
                        <View style={[styles.transactionCardBorderLight, { borderColor: Colors.line }]}>
                          <View style={[styles.transactionCard, { 
                            padding: 16,
                            backgroundColor: cardBg,
                            borderColor: Colors.line,
                            borderWidth: 1,
                          }]}>
                            <Pressable 
                              onPress={() => {
                                if (actionButtonTapRef.current) return;
                                if (isItemDeleting) return;
                                setEditingPurchaseOrder(po);
                              }}
                              style={{ flex: 1 }}
                            >
                              {/* Same content as dark mode but with Colors */}
                              <View style={{ marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                  <Text style={{ fontSize: 18 }}>{categoryIcon}</Text>
                                  <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text 
                                      style={{ color: Colors.text, fontSize: 15, lineHeight: 20, fontWeight: '700' }}
                                      numberOfLines={1}
                                      ellipsizeMode="tail"
                                    >
                                      {po.poNumber}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                                      <Text style={{ color: Colors.sub, fontSize: 11 }}>{po.vendor || 'No vendor'}</Text>
                                      <View style={{ 
                                        backgroundColor: po.status === 'Pending' 
                                          ? '#f59e0b' 
                                          : po.status === 'Received'
                                          ? '#22c55e'
                                          : '#64748b',
                                        width: 6,
                                        height: 6,
                                        borderRadius: 3,
                                        marginLeft: 6
                                      }} />
                                      <Text style={{ 
                                        color: po.status === 'Pending' 
                                          ? '#f59e0b' 
                                          : po.status === 'Received'
                                          ? '#22c55e'
                                          : '#64748b',
                                        fontSize: 10,
                                        fontWeight: '600',
                                        letterSpacing: 0.5
                                      }}>
                                        {po.status.toUpperCase()}
                                      </Text>
                                    </View>
                                  </View>
                                  <Text style={{ 
                                    color: po.status === 'Pending' 
                                      ? '#f59e0b' 
                                      : po.status === 'Received'
                                      ? '#22c55e'
                                      : '#64748b',
                                    fontSize: 15,
                                    fontWeight: '700'
                                  }}>
                                    {formatMoneyFull(po.amount, { decimals: 2 })}
                                  </Text>
                                </View>
                                {po.status === 'Pending' && daysUntilDelivery <= 3 && (
                                  <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6, alignSelf: 'flex-start' }}>
                                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>URGENT</Text>
                                  </View>
                                )}
                              </View>
                              
                              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.line }}>
                                <Text style={{ color: Colors.sub, fontSize: 10, marginBottom: 3 }}>Expected Delivery</Text>
                                <Text style={{ 
                                  color: po.status === 'Pending' && daysUntilDelivery <= 3 ? '#ef4444' : '#22c55e',
                                  fontSize: 12,
                                  fontWeight: '600'
                                }}>
                                  {parseLocalDate(po.expectedDelivery).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  {po.status === 'Pending' && (
                                    <Text style={{ color: Colors.sub, fontWeight: '400' }}>
                                      {' '}({daysUntilDelivery > 0 ? `${daysUntilDelivery} days` : 'Today!'})
                                    </Text>
                                  )}
                                </Text>
                              </View>

                              {po.description && (
                                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.line }}>
                                  <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16 }} numberOfLines={2} ellipsizeMode="tail">{po.description}</Text>
                                </View>
                              )}

                              {po.status === 'Pending' && (
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.line }}>
                                  <TouchableOpacity
                                    onPressIn={() => { actionButtonTapRef.current = true; }}
                                    onPressOut={() => { setTimeout(() => { actionButtonTapRef.current = false; }, 0); }}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      maybeWebConfirmPOMarkReceived(po, {
                                        markingPOReceivedId,
                                        setMarkingPOReceivedId,
                                        markPOReceived,
                                      });
                                    }}
                                    disabled={markingPOReceivedId === po.id}
                                    style={{ 
                                      flex: 1, 
                                      backgroundColor: markingPOReceivedId === po.id ? '#64748b' : '#22c55e', 
                                      paddingVertical: 8, 
                                      borderRadius: 8, 
                                      alignItems: 'center',
                                      opacity: markingPOReceivedId === po.id ? 0.6 : 1
                                    }}
                                  >
                                    <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>
                                      {markingPOReceivedId === po.id ? '...' : '✓ Received'}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPressIn={() => { actionButtonTapRef.current = true; }}
                                    onPressOut={() => { setTimeout(() => { actionButtonTapRef.current = false; }, 0); }}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      maybeWebConfirmPOCancel(po, cancelPO);
                                    }}
                                    style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center' }}
                                  >
                                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>✕ Cancel</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                }

                if (isMaterialsEquipmentCategory && item.isScannedProduct) {
                  const scannedLineTotal = Number(item.lineItemTotal || item.amount || 0);
                  const scannedQuantity = Number(item.quantity || 0);
                  const scannedUnitCost = Number(item.unitCost || 0);
                  const scannedMeta =
                    scannedQuantity > 0 && scannedUnitCost > 0
                      ? `${scannedQuantity} ea × ${formatMoneyFull(scannedUnitCost, { decimals: 2 })}`
                      : '';
                  const scannedDate = new Date(item.dateAdded || item.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const cardText = darkMode ? '#FFFFFF' : Colors.text;
                  const mutedText = darkMode ? 'rgba(226,232,240,0.72)' : Colors.sub;

                  return (
                    <View key={item.id} style={{ marginBottom: 12 }}>
                      <TouchableOpacity
                        style={[
                          styles.transactionCard,
                          {
                            opacity: isItemDeleting ? 0.5 : 1,
                            backgroundColor: cardBg,
                            borderWidth: 1,
                            borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
                          },
                        ]}
                        onPress={() => {
                          if (!isItemDeleting) setEditingTransaction(item);
                        }}
                        activeOpacity={0.7}
                        disabled={isItemDeleting}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.vendor, { color: cardText, marginTop: 3 }]} numberOfLines={1}>
                              {item.vendor || 'Home Depot'}
                            </Text>
                            <View style={styles.scannedCardBadge}>
                              <MaterialIcons name="qr-code-scanner" size={12} color="#22c55e" />
                              <Text style={styles.scannedCardBadgeText}>SCANNED</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.amount, { marginTop: 3 }]}>
                              {formatMoneyFull(scannedLineTotal, { decimals: 2 })}
                            </Text>
                          </View>
                        </View>

                        <View style={{ marginTop: 12 }}>
                          <Text style={[styles.description, { color: mutedText, marginTop: 4 }]} numberOfLines={2} ellipsizeMode="tail">
                            {item.productTitle || item.material || item.description || 'Scanned product'}
                          </Text>
                        </View>

                        {scannedMeta ? (
                          <Text style={{ color: '#2DFFC4', fontSize: 12, fontWeight: '800', marginTop: 10 }}>
                            {scannedMeta}
                          </Text>
                        ) : null}

                        {item.modelNumber ? (
                          <Text style={{ color: mutedText, fontSize: 12, fontWeight: '700', marginTop: 6 }}>
                            Model {item.modelNumber}
                          </Text>
                        ) : null}

                        <View style={[styles.transactionFooter, { marginTop: 12, borderTopColor: darkMode ? 'rgba(148, 163, 184, 0.14)' : Colors.line }]}>
                          <Text style={[styles.date, { color: mutedText }]}>{scannedDate}</Text>
                          <ReceiptStatusPill hasReceipt={Boolean(item.receiptUri)} />
                          <Text style={styles.tapToEdit}>Tap to edit →</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                }
                
                // For other categories (expenses, change orders), use the original card design
                return (
                  <View key={item.id} style={{ marginBottom: 12 }}>
                    {darkMode ? (
                      <TouchableOpacity 
                        style={[
                          styles.transactionCard, 
                          { 
                            opacity: isItemDeleting ? 0.5 : 1,
                            backgroundColor: cardBg,
                            borderWidth: 1,
                            borderColor: "rgba(148, 163, 184, 0.12)",
                          }
                        ]}
                        onPress={() => {
                      if (isItemDeleting) return;
                      if (item.isChangeOrderMirror) {
                        const coId = parseChangeOrderIdFromMirrorExpenseId(item.id);
                        if (coId && onRequestOpenChangeOrder) {
                          if (Platform.OS === "ios") {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                          onRequestOpenChangeOrder(coId);
                        }
                        return;
                      }
                      if (item.isChangeOrder) {
                        setEditingChangeOrderId(item.id);
                        setShowAddForm(true);
                        return;
                      }
                      // Legacy: For Purchase Orders category, convert expense to PO format (fallback)
                      if (categoryName === 'Purchase Orders' && !item.isPurchaseOrder) {
                        const poLike = {
                          id: item.id,
                          poNumber: item.po || '',
                          vendor: item.vendor || '',
                          category: item.category || 'Materials',
                          amount: item.amount || 0,
                          description: item.notes || '',
                          orderDate: item.date || new Date().toISOString().split('T')[0],
                          expectedDelivery: '',
                          status: 'Pending' as const,
                        };
                        setEditingPurchaseOrder(poLike);
                      } else {
                        setEditingTransaction(item);
                      }
                    }}
                    activeOpacity={0.7}
                    disabled={isItemDeleting || (item.isChangeOrderMirror && !onRequestOpenChangeOrder)}
                  >
                    <View style={styles.transactionHeader}>
                      <View style={{ flex: 1 }}>
                        {/* Vendor and Status Row - Better spacing for Purchase Orders */}
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          gap: 10, 
                          marginBottom: item.isPurchaseOrder ? 8 : 4,
                          flexWrap: 'wrap'
                        }}>
                          <Text style={[styles.vendor, item.isPurchaseOrder && { marginBottom: 0 }]}>{item.vendor}</Text>
                          {/* Change Order Status Badge */}
                          {item.isChangeOrder && item.status && (
                            <View style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                              backgroundColor: item.status === 'Approved' 
                                ? 'rgba(34, 197, 94, 0.2)' 
                                : item.status === 'Submitted'
                                ? 'rgba(245, 158, 11, 0.2)'
                                : 'rgba(100, 116, 139, 0.2)',
                              borderWidth: 1,
                              borderColor: item.status === 'Approved'
                                ? 'rgba(34, 197, 94, 0.4)'
                                : item.status === 'Submitted'
                                ? 'rgba(245, 158, 11, 0.4)'
                                : 'rgba(100, 116, 139, 0.4)',
                            }}>
                              <Text style={{ 
                                color: item.status === 'Approved' 
                                  ? '#22c55e' 
                                  : item.status === 'Submitted'
                                  ? '#f59e0b'
                                  : '#64748b', 
                                fontSize: 10, 
                                fontWeight: '600' 
                              }}>
                                {item.status.toUpperCase()}
                              </Text>
                            </View>
                          )}
                          {/* Purchase Order Status Badge */}
                          {item.isPurchaseOrder && item.status && (
                            <View style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                              backgroundColor: item.status === 'Pending'
                                ? 'rgba(245, 158, 11, 0.2)' 
                                : item.status === 'Received'
                                ? 'rgba(34, 197, 94, 0.2)'
                                : 'rgba(100, 116, 139, 0.2)',
                              borderWidth: 1,
                              borderColor: item.status === 'Pending'
                                ? 'rgba(245, 158, 11, 0.4)'
                                : item.status === 'Received'
                                ? 'rgba(34, 197, 94, 0.4)'
                                : 'rgba(100, 116, 139, 0.4)',
                            }}>
                              <Text style={{ 
                                color: item.status === 'Pending' 
                                  ? '#f59e0b' 
                                  : item.status === 'Received'
                                  ? '#22c55e'
                                  : '#64748b', 
                                fontSize: 10, 
                                fontWeight: '600' 
                              }}>
                                {item.status.toUpperCase()}
                              </Text>
                            </View>
                          )}
                          {!item.isChangeOrder && item.isPlanned === false && (
                            <View style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                              backgroundColor: 'rgba(245, 158, 11, 0.2)',
                              borderWidth: 1,
                              borderColor: 'rgba(245, 158, 11, 0.4)',
                            }}>
                              <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '600' }}>UNPLANNED</Text>
                            </View>
                          )}

                        </View>
                        {/* Purchase Order specific layout - better spacing */}
                        {item.isPurchaseOrder ? (
                          <View style={{ marginTop: 8 }}>
                            {/* PO Number and Date Row */}
                            <View style={{ 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              gap: 10, 
                              marginBottom: 8,
                              flexWrap: 'wrap'
                            }}>
                              {item.poNumber && (
                                <View style={[styles.poBadge, { marginRight: 0 }]}>
                                  <Text style={styles.poText}>📋 {item.poNumber}</Text>
                                </View>
                              )}
                              <Text style={[styles.date, { marginTop: 0 }]}>
                                {new Date(item.date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </Text>
                            </View>
                            
                            {/* Description if available */}
                            {item.description && (
                              <Text style={[styles.description, { marginTop: 6, marginBottom: 0 }]} numberOfLines={2} ellipsizeMode="tail">
                                {item.description}
                              </Text>
                            )}
                            
                            {/* Expected Delivery for Pending POs */}
                            {item.expectedDelivery && item.status === 'Pending' && (
                              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                                <Text style={{ color: '#8DA0B8', fontSize: 11, fontWeight: '600', marginBottom: 3 }}>Expected Delivery</Text>
                                <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '600' }}>
                                  {parseLocalDate(item.expectedDelivery).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </Text>
                              </View>
                            )}
                          </View>
                        ) : (
                          <>
                            {!!itemSubtitles.material && (
                              <Text style={styles.description} numberOfLines={2} ellipsizeMode="tail">
                                {itemSubtitles.material}
                              </Text>
                            )}
                            {!!itemSubtitles.description && (
                              <Text style={styles.description} numberOfLines={2} ellipsizeMode="tail">
                                {itemSubtitles.description}
                              </Text>
                            )}
                            {(item.projectPhase || item.scope) && (
                              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                {item.projectPhase && (
                                  <Text style={{ color: '#8DA0B8', fontSize: 11 }}>📐 {item.projectPhase}</Text>
                                )}
                                {item.scope && (
                                  <Text style={{ color: '#8DA0B8', fontSize: 11 }}>📍 {item.scope}</Text>
                                )}
                              </View>
                            )}
                          </>
                        )}
                      </View>
                      <Text style={styles.amount}>{formatMoneyFull(item.amount, { decimals: 2 })}</Text>
                    </View>

                    {itemBudgetSummary ? (
                      <EstimateLineBudgetStrip
                        summary={itemBudgetSummary}
                        darkMode={darkMode}
                        compact
                      />
                    ) : null}
                    
                    {/* Footer - Different layout for Purchase Orders */}
                    {item.isPurchaseOrder ? (
                      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
                        {/* Action buttons based on status */}
                        {item.status === 'Pending' ? (
                          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                borderRadius: 10,
                                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                borderWidth: 1,
                                borderColor: 'rgba(34, 197, 94, 0.4)',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                              onPress={() => {
                                const body = `${item.poNumber || 'This purchase order'} from ${item.vendor} will be added to expenses.`;
                                if (Platform.OS === "web" && typeof window !== "undefined" && typeof window.confirm === "function") {
                                  if (window.confirm(`Mark as Received?\n\n${body}`)) {
                                    markPOReceived(item.id);
                                    categoryDetailWebAlert(
                                      'Received',
                                      `Purchase order "${item.poNumber || item.vendor}" has been marked as received. It will now appear in expenses.`
                                    );
                                  }
                                  return;
                                }
                                Alert.alert('Mark as Received?', body, [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Received',
                                    onPress: () => {
                                      markPOReceived(item.id);
                                      categoryDetailWebAlert(
                                        'Received',
                                        `Purchase order "${item.poNumber || item.vendor}" has been marked as received. It will now appear in expenses.`
                                      );
                                    },
                                  },
                                ]);
                              }}
                            >
                              <MaterialIcons name="check-circle" size={16} color="#22c55e" />
                              <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '700' }}>Mark as Received</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                const actualPO = projectData.purchaseOrders?.find((po: any) => po.id === item.id);
                                if (actualPO) {
                                  setEditingPurchaseOrder(actualPO);
                                }
                              }}
                              style={{
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                borderRadius: 10,
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                borderWidth: 1,
                                borderColor: 'rgba(255, 255, 255, 0.1)',
                              }}
                            >
                              <Text style={{ color: '#8DA0B8', fontSize: 13, fontWeight: '600' }}>Edit</Text>
                            </TouchableOpacity>
                          </View>
                        ) : item.status === 'Received' ? (
                          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            <TouchableOpacity
                              onPress={() => {
                                const actualPO = projectData.purchaseOrders?.find((po: any) => po.id === item.id);
                                if (actualPO) {
                                  setEditingPurchaseOrder(actualPO);
                                }
                              }}
                              style={{
                                flex: 1,
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                borderRadius: 12,
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                borderWidth: 1,
                                borderColor: 'rgba(148, 163, 184, 0.2)',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: supportSub, fontSize: 13, fontWeight: '600' }}>Edit</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={{
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            borderRadius: 10,
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            borderWidth: 1,
                            borderColor: 'rgba(34, 197, 94, 0.2)',
                            alignItems: 'center',
                          }}>
                            <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '700' }}>✓ Received</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.transactionFooter}>
                        <Text style={styles.date}>
                          {new Date(item.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </Text>
                        {item.poNumber && (
                          <View style={styles.poBadge}>
                            <Text style={styles.poText}>📋 {item.poNumber}</Text>
                          </View>
                        )}
                        {item.po && !item.poNumber && (
                          <View style={styles.poBadge}>
                            <Text style={styles.poText}>📋 {item.po}</Text>
                          </View>
                        )}
                        {!item.isPurchaseOrder && !item.isChangeOrder ? (
                          <ReceiptStatusPill hasReceipt={Boolean(item.receiptUri)} />
                        ) : null}
                        {!item.isChangeOrderMirror ? (
                        <Text style={styles.tapToEdit}>Tap to edit →</Text>
                        ) : onRequestOpenChangeOrder ? (
                        <Text style={styles.tapToEdit}>Tap to open change order →</Text>
                        ) : null}
                      </View>
                    )}
                    
                    {/* Approval Button for Change Orders */}
                    {item.isChangeOrder && !item.approved && item.status !== 'Approved' && (
                      <View
                        style={[
                          styles.coApproveButtonWrap,
                          { borderTopColor: "rgba(255,255,255,0.1)" },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.coApproveButton}
                          activeOpacity={0.88}
                          onPress={() => {
                            approveChangeOrder(item.id);
                            Alert.alert('Approved', `Change order "${item.vendor}" has been approved. Budget updated.`);
                          }}
                        >
                          <MaterialIcons name="check-circle" size={22} color="#020617" />
                          <Text style={styles.coApproveButtonText}>Approve</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.transactionCardBorderLight, { borderColor: Colors.line }]}>
                        <TouchableOpacity 
                          style={[
                            styles.transactionCard,
                            { 
                              opacity: isItemDeleting ? 0.5 : 1,
                              backgroundColor: cardBg,
                              borderColor: Colors.line,
                              borderWidth: 1,
                            }
                          ]}
                          onPress={() => {
                            if (isItemDeleting) return;
                            if (item.isChangeOrderMirror) {
                              const coId = parseChangeOrderIdFromMirrorExpenseId(item.id);
                              if (coId && onRequestOpenChangeOrder) {
                                if (Platform.OS === "ios") {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }
                                onRequestOpenChangeOrder(coId);
                              }
                              return;
                            }
                            if (item.isChangeOrder) {
                              setEditingChangeOrderId(item.id);
                              setShowAddForm(true);
                              return;
                            }
                            // For Purchase Orders category, use actual PO object
                            if (isPurchaseOrdersCategory && item.isPurchaseOrder) {
                              // Find the actual PO object
                              const actualPO = projectData.purchaseOrders?.find((po: any) => po.id === item.id);
                              if (actualPO) {
                                setEditingPurchaseOrder(actualPO);
                                return;
                              }
                            }
                            // Legacy: For Purchase Orders category, convert expense to PO format (fallback)
                            if (categoryName === 'Purchase Orders' && !item.isPurchaseOrder) {
                              const poLike = {
                                id: item.id,
                                poNumber: item.po || '',
                                vendor: item.vendor || '',
                                category: item.category || 'Materials',
                                amount: item.amount || 0,
                                description: item.notes || '',
                                orderDate: item.date || new Date().toISOString().split('T')[0],
                                expectedDelivery: '',
                                status: 'Pending' as const,
                              };
                              setEditingPurchaseOrder(poLike);
                            } else {
                              setEditingTransaction(item);
                            }
                          }}
                          activeOpacity={0.7}
                          disabled={isItemDeleting || (item.isChangeOrderMirror && !onRequestOpenChangeOrder)}
                        >
                          <View style={styles.transactionHeader}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Text style={[styles.vendor, { color: Colors.text }]}>{item.vendor}</Text>
                                {/* Change Order Status Badge */}
                                {item.isChangeOrder && item.status && (
                                  <View style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                    backgroundColor: item.status === 'Approved' 
                                      ? 'rgba(34, 197, 94, 0.2)' 
                                      : item.status === 'Submitted'
                                      ? 'rgba(245, 158, 11, 0.2)'
                                      : 'rgba(100, 116, 139, 0.2)',
                                    borderWidth: 1,
                                    borderColor: item.status === 'Approved'
                                      ? 'rgba(34, 197, 94, 0.4)'
                                      : item.status === 'Submitted'
                                      ? 'rgba(245, 158, 11, 0.4)'
                                      : 'rgba(100, 116, 139, 0.4)',
                                  }}>
                                    <Text style={{ 
                                      color: item.status === 'Approved' 
                                        ? '#22c55e' 
                                        : item.status === 'Submitted'
                                        ? '#f59e0b'
                                        : '#64748b', 
                                      fontSize: 10, 
                                      fontWeight: '600' 
                                    }}>
                                      {item.status.toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                                {!item.isChangeOrder && item.isPlanned === false && (
                                  <View style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(245, 158, 11, 0.4)',
                                  }}>
                                    <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '600' }}>UNPLANNED</Text>
                                  </View>
                                )}
                              </View>
                              {!!itemSubtitles.material && (
                                <Text style={[styles.description, { color: Colors.sub }]} numberOfLines={2} ellipsizeMode="tail">
                                  {itemSubtitles.material}
                                </Text>
                              )}
                              {!!itemSubtitles.description && (
                                <Text style={[styles.description, { color: Colors.sub }]} numberOfLines={2} ellipsizeMode="tail">
                                  {itemSubtitles.description}
                                </Text>
                              )}
                              {(item.projectPhase || item.scope) && (
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                  {item.projectPhase && (
                                    <Text style={{ color: Colors.sub, fontSize: 11 }}>📐 {item.projectPhase}</Text>
                                  )}
                                  {item.scope && (
                                    <Text style={{ color: Colors.sub, fontSize: 11 }}>📍 {item.scope}</Text>
                                  )}
                                </View>
                              )}
                            </View>
                            <Text style={styles.amount}>{formatMoneyFull(item.amount, { decimals: 2 })}</Text>
                          </View>

                          {itemBudgetSummary ? (
                            <EstimateLineBudgetStrip
                              summary={itemBudgetSummary}
                              darkMode={darkMode}
                              compact
                            />
                          ) : null}
                          
                          <View style={[styles.transactionFooter, { borderTopColor: Colors.line }]}>
                            <Text style={[styles.date, { color: Colors.sub }]}>
                              {new Date(item.date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </Text>
                            {item.po && (
                              <View style={styles.poBadge}>
                                <Text style={styles.poText}>📋 {item.po}</Text>
                              </View>
                            )}
                            {!item.isPurchaseOrder && !item.isChangeOrder ? (
                              <ReceiptStatusPill hasReceipt={Boolean(item.receiptUri)} />
                            ) : null}
                            {!item.isChangeOrderMirror ? (
                            <Text style={styles.tapToEdit}>Tap to edit →</Text>
                            ) : onRequestOpenChangeOrder ? (
                            <Text style={styles.tapToEdit}>Tap to open change order →</Text>
                            ) : null}
                          </View>
                          {item.isChangeOrder && !item.approved && item.status !== 'Approved' && (
                            <View
                              style={[
                                styles.coApproveButtonWrap,
                                { borderTopColor: Colors.line },
                              ]}
                            >
                              <TouchableOpacity
                                style={styles.coApproveButton}
                                activeOpacity={0.88}
                                onPress={() => {
                                  approveChangeOrder(item.id);
                                  Alert.alert('Approved', `Change order "${item.vendor}" has been approved. Budget updated.`);
                                }}
                              >
                                <MaterialIcons name="check-circle" size={22} color="#020617" />
                                <Text style={styles.coApproveButtonText}>Approve</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.emptyState, !hasCategoryTransactions && styles.emptyStateCompact]}>
              <View style={styles.emptyIconContainerWrapper}>
                <View
                  style={[
                    styles.emptyIconBubble,
                    {
                      backgroundColor: cardBg,
                      borderColor: nestedCardBorder,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 40 }}>{categoryIcon}</Text>
                </View>
              </View>
              <Text style={[styles.emptyText, !darkMode && { color: Colors.text }]}>No transactions yet</Text>
              <Text style={[styles.emptySubtext, !darkMode && { color: Colors.sub }]}>
                Expenses will appear here as they're added
              </Text>
            </View>
          )}
          
          <View style={hasCategoryTransactions ? styles.bottomSpacer : undefined} />
            </View>
          </View>
        </ScrollView>
        </View>
      </View>

      {/* Add Transaction Form — native: nested modal is OK; web: render outside parent Modal (see fragment below) so Save receives clicks */}
      {Platform.OS !== "web" && (
        <AddTransactionModal
          key={isChangeOrdersCategory ? `co-draft-${editingChangeOrderId ?? "new"}` : "txn"}
          visible={showAddForm}
          categoryName={categoryName}
          initialDraft={isChangeOrdersCategory ? changeOrderEditDraft : null}
          initialDraftKey={isChangeOrdersCategory ? (editingChangeOrderId ?? "new") : undefined}
          onRequestDeleteChangeOrder={
            isChangeOrdersCategory ? (id) => deleteChangeOrder(id) : undefined
          }
          onClose={() => {
            setShowAddForm(false);
            setEditingChangeOrderId(null);
          }}
          onSave={handleAddTransaction}
        />
      )}

      {/* Edit modals — native: nested modal is OK; web: sibling outside parent Modal (see fragment below) so actions receive clicks */}
      {Platform.OS !== "web" && (
        <>
          <EditPurchaseOrderModal
            visible={isPurchaseOrdersCategory && editingPurchaseOrder !== null}
            purchaseOrder={editingPurchaseOrder}
            onClose={() => setEditingPurchaseOrder(null)}
            onSave={(updated) => {
              updatePurchaseOrder(updated);
              Alert.alert('Updated!', 'Purchase Order updated successfully');
              setEditingPurchaseOrder(null);
            }}
            onCancel={(id) => {
              if (id) {
                cancelPO(id);
                Alert.alert('Cancelled', 'Purchase Order has been cancelled.');
              }
              setEditingPurchaseOrder(null);
            }}
          />
          <EditTransactionModal
            visible={editingTransaction !== null && categoryName !== 'Purchase Orders'}
            transaction={editingTransaction}
            categoryName={categoryName}
            onClose={() => setEditingTransaction(null)}
            onSave={(updated) => {
              updateExpense({
                id: updated.id,
                category: categoryName,
                vendor: updated.vendor,
                amount: updated.amount,
                date: updated.date,
                notes: updated.description,
                material: updated.material,
                linkedLineId: updated.linkedLineId,
              });
              Alert.alert('Updated!', 'Transaction updated successfully');
              setEditingTransaction(null);
            }}
            onDelete={(id) => {
              debugLog('🗑️ CategoryDetailModal: Deleting expense ID:', id);
              debugLog('🗑️ Current expenses in projectData:', projectData.expenses?.map((e: any) => ({ id: e.id, vendor: e.vendor, category: e.category })) || []);
              debugLog('🗑️ Current filtered data IDs:', data.map(d => d.id));

              const expenseExists = projectData.expenses?.some((e: any) => e.id === id);
              debugLog('🗑️ Expense ID exists in projectData.expenses:', expenseExists);

              if (!expenseExists) {
                console.error('❌ Expense ID not found in projectData.expenses!');
                console.error('❌ Looking for ID:', id);
                console.error('❌ Available IDs:', projectData.expenses?.map((e: any) => e.id) || []);
                Alert.alert('Error', 'Expense not found. Please try again.');
                return;
              }

              setEditingTransaction(null);
              setDeletingId(id);

              setTimeout(() => {
                debugLog('🗑️ Calling deleteExpense with ID:', id);
                deleteExpense(id);

                setTimeout(() => {
                  setDeletingId(null);
                  debugLog('✅ Delete complete, resetting deletingId');
                }, 300);
              }, 50);
            }}
          />
        </>
      )}
    </Modal>
    {Platform.OS === "web" && (
      <>
        <AddTransactionModal
          key={isChangeOrdersCategory ? `co-draft-${editingChangeOrderId ?? "new"}` : "txn"}
          visible={visible && showAddForm}
          categoryName={categoryName}
          initialDraft={isChangeOrdersCategory ? changeOrderEditDraft : null}
          initialDraftKey={isChangeOrdersCategory ? (editingChangeOrderId ?? "new") : undefined}
          onRequestDeleteChangeOrder={
            isChangeOrdersCategory ? (id) => deleteChangeOrder(id) : undefined
          }
          onClose={() => {
            setShowAddForm(false);
            setEditingChangeOrderId(null);
          }}
          onSave={handleAddTransaction}
        />
        <EditPurchaseOrderModal
          visible={visible && isPurchaseOrdersCategory && editingPurchaseOrder !== null}
          purchaseOrder={editingPurchaseOrder}
          onClose={() => setEditingPurchaseOrder(null)}
          onSave={(updated) => {
            updatePurchaseOrder(updated);
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
              window.alert('Updated!\n\nPurchase Order updated successfully');
            } else {
              Alert.alert('Updated!', 'Purchase Order updated successfully');
            }
            setEditingPurchaseOrder(null);
          }}
          onCancel={(id) => {
            if (id) {
              cancelPO(id);
              if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert('Cancelled\n\nPurchase Order has been cancelled.');
              } else {
                Alert.alert('Cancelled', 'Purchase Order has been cancelled.');
              }
            }
            setEditingPurchaseOrder(null);
          }}
        />
        <EditTransactionModal
          visible={visible && editingTransaction !== null && categoryName !== 'Purchase Orders'}
          transaction={editingTransaction}
          categoryName={categoryName}
          onClose={() => setEditingTransaction(null)}
          onSave={(updated) => {
            updateExpense({
              id: updated.id,
              category: categoryName,
              vendor: updated.vendor,
              amount: updated.amount,
              date: updated.date,
              notes: updated.description,
              material: updated.material,
              linkedLineId: updated.linkedLineId,
            });
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
              window.alert('Updated!\n\nTransaction updated successfully');
            } else {
              Alert.alert('Updated!', 'Transaction updated successfully');
            }
            setEditingTransaction(null);
          }}
          onDelete={(id) => {
            debugLog('🗑️ CategoryDetailModal: Deleting expense ID:', id);
            debugLog('🗑️ Current expenses in projectData:', projectData.expenses?.map((e: any) => ({ id: e.id, vendor: e.vendor, category: e.category })) || []);
            debugLog('🗑️ Current filtered data IDs:', data.map(d => d.id));

            const expenseExists = projectData.expenses?.some((e: any) => e.id === id);
            debugLog('🗑️ Expense ID exists in projectData.expenses:', expenseExists);

            if (!expenseExists) {
              console.error('❌ Expense ID not found in projectData.expenses!');
              console.error('❌ Looking for ID:', id);
              console.error('❌ Available IDs:', projectData.expenses?.map((e: any) => e.id) || []);
              if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert('Error\n\nExpense not found. Please try again.');
              } else {
                Alert.alert('Error', 'Expense not found. Please try again.');
              }
              return;
            }

            setEditingTransaction(null);
            setDeletingId(id);

            setTimeout(() => {
              debugLog('🗑️ Calling deleteExpense with ID:', id);
              deleteExpense(id);

              setTimeout(() => {
                setDeletingId(null);
                debugLog('✅ Delete complete, resetting deletingId');
              }, 300);
            }, 50);
          }}
        />
      </>
    )}
    {isMaterialsEquipmentCategory ? (
      <>
        <ProductScannerModal
          visible={visible && productScannerVisible}
          defaultZip={projectLookupZip}
          onClose={() => setProductScannerVisible(false)}
          onProductFound={(product) => {
            setScannedProjectProduct(product);
            setProductScannerVisible(false);
          }}
        />
        <ProductFoundSheet
          visible={visible && Boolean(scannedProjectProduct)}
          product={scannedProjectProduct}
          destinations={PROJECT_SCAN_DESTINATIONS}
          defaultDestination="project_budget"
          lookupZip={projectLookupZip}
          primaryActionTitle={MATERIALS_SCAN_SAVE_LABEL}
          onClose={() => setScannedProjectProduct(null)}
          onSave={handleMaterialsScannedProductSave}
        />
      </>
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  headerIconContainerWrapper: {
    borderRadius: 16,
  },
  headerIconBorder: {
    borderRadius: 16,
    padding: 1,
  },
  headerIconBorderLight: {
    borderRadius: 16,
    padding: 1,
    borderWidth: 1,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 15,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: "white",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  headerSubtitle: {
    color: "rgba(226, 232, 240, 0.78)",
    fontSize: 14,
    marginTop: 6,
    fontWeight: "500",
    letterSpacing: 0.12,
    lineHeight: 20,
  },
  backButtonWrapper: {
    marginRight: 12,
  },
  backButtonBorder: {
    borderRadius: 22,
    padding: 1,
    overflow: "hidden",
  },
  backButtonBorderLight: {
    borderRadius: 22,
    padding: 1,
    overflow: "hidden",
    borderWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 21,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 120,
    flexGrow: 0,
  },
  scrollContentCompact: {
    flexGrow: 0,
  },
  materialsWideScrollContent: {
    paddingHorizontal: PROJECT_WIDE_CONTAINER_CARD_INSET,
  },
  categoryFlowCardCompact: {
    alignSelf: 'flex-start',
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  totalCardContainer: {
    marginBottom: 22,
  },
  totalCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  totalCardBorderLight: {
    borderRadius: 20,
    padding: 1,
    borderWidth: 1,
  },
  totalCardInner: {
    backgroundColor: "#000000",
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 22,
  },
  totalCard: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  totalValue: {
    color: "#22c55e",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.7,
    marginTop: 10,
    textAlign: "right",
  },
  poTabContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  poTab: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  poActiveTab: {
    // Keep same borderWidth to prevent layout shift
  },
  poTabText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  addButtonWrapper: {
    marginBottom: 10,
    alignSelf: 'stretch',
    width: '100%',
  },
  materialsScanButton: {
    marginBottom: 10,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    alignSelf: 'stretch',
    width: '100%',
  },
  materialsScanButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  scanPrimaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  materialsScanHelper: {
    marginBottom: 22,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  addButton: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addButtonText: {
    color: "#020617",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  coTimelineReminder: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 18,
  },
  coTimelineReminderText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
    letterSpacing: 0.15,
  },
  coApproveButtonWrap: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  coApproveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#22c55e",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  coApproveButtonText: {
    color: "#020617",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.35,
  },
  transactionsContainer: {
    gap: 16,
  },
  transactionCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  transactionCardBorderLight: {
    borderRadius: 20,
    padding: 1,
    borderWidth: 1,
  },
  transactionCard: {
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 0,
  },
  // Enhanced spacing for Purchase Orders
  purchaseOrderCard: {
    padding: 24,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 16,
  },
  vendor: {
    color: "white",
    fontWeight: "700",
    fontSize: 17,
    flex: 1,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  scannedCardBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.28)',
  },
  scannedCardBadgeText: {
    color: '#22c55e',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  amount: {
    color: "#22c55e",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  description: {
    color: "rgba(226, 232, 240, 0.72)",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
    fontWeight: "500",
  },
  transactionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.14)",
  },
  date: {
    color: "rgba(226, 232, 240, 0.62)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.08,
  },
  poBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
  },
  poText: {
    color: "#22d3ee",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  emptyStateCompact: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  emptyIconContainerWrapper: {
    marginBottom: 24,
  },
  emptyIconBubble: {
    width: 96,
    height: 96,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptySubtext: {
    color: "#8DA0B8",
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  tapToEdit: {
    color: "rgba(226, 232, 240, 0.5)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.12,
  },
  bottomSpacer: {
    height: 32,
  },
}); 