import React, { useState, useMemo, useRef, useEffect } from "react";
import { View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import AddTransactionModal from "./AddTransactionModal";
import EditTransactionModal from "./EditTransactionModal";
import EditPurchaseOrderModal from "./EditPurchaseOrderModal";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

// Helper to parse YYYY-MM-DD date strings as local time (not UTC) to avoid timezone shifts
function parseLocalDate(dateString: string): Date {
  // Append "T00:00:00" to force local time parsing instead of UTC
  return new Date(dateString + "T00:00:00");
}

type Props = {
  visible: boolean;
  categoryName: string;
  onClose: () => void;
  theme?: any;
};

export default function CategoryDetailModal({ visible, categoryName, onClose, theme: _theme }: Props) {
  const DEBUG_MODAL = false;
  const debugLog = (...args: any[]) => { if (DEBUG_MODAL) console.log(...args); };
  const { theme: appTheme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(appTheme), [appTheme]);
  const supportSub = useMemo(
    () => (darkMode ? "rgba(226, 232, 240, 0.78)" : Colors.sub),
    [darkMode, Colors.sub]
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingPOReceivedId, setMarkingPOReceivedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [activePOTab, setActivePOTab] = useState<'total' | 'committed' | 'received'>('total');
  const previousDataRef = useRef<any[]>([]);
  const actionButtonTapRef = useRef(false);
  const { projectData, addExpense, deleteExpense, updateExpense, addChangeOrder, updateChangeOrder, deleteChangeOrder, approveChangeOrder, addPurchaseOrder, updatePurchaseOrder, markPOReceived, cancelPO } = useProjectData();

  // Special handling for Change Orders and Purchase Orders - show actual objects, not expenses
  const isChangeOrdersCategory = categoryName.toLowerCase().includes('change order');
  const isPurchaseOrdersCategory = categoryName.toLowerCase().includes('purchase order');
  
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
          amount: exp.amount || 0,
          description: exp.notes || '',
          po: exp.po || undefined,
          receiptUri: exp.receiptUri || undefined,
          isPlanned: exp.isPlanned !== undefined ? exp.isPlanned : true,
          projectPhase: exp.projectPhase || undefined,
          scope: exp.scope || undefined,
          priceReasonableness: exp.priceReasonableness || undefined,
          isChangeOrder: false,
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
  

  const total = useMemo(() => {
    // For Purchase Orders, calculate total based on active tab
    if (isPurchaseOrdersCategory) {
      // For tabs, just sum the filtered data (already filtered by tab)
      return data.reduce((sum, item) => sum + (item.amount || 0), 0);
    }
    // For all other categories, sum all items
    return data.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [data, isPurchaseOrdersCategory]);

  // Update ref when data changes
  useEffect(() => {
    previousDataRef.current = data;
  }, [data]);
  

  const categoryIcon = categoryName.toLowerCase().includes('labor') ? '👷' : 
                       categoryName.toLowerCase().includes('materials') || categoryName.toLowerCase().includes('equipment') ? '🧱' :
                       categoryName.toLowerCase().includes('equipment') ? '🔧' : 
                       categoryName.toLowerCase().includes('subs') ? '👥' : '📦';

  // Check for duplicate transactions
  const checkForDuplicates = (transaction: any): boolean => {
    const expenses = projectData.expenses || [];
    const duplicate = expenses.find(exp => 
      exp.vendor === transaction.vendor &&
      Math.abs(exp.amount - transaction.amount) < 0.01 &&
      Math.abs(new Date(exp.date).getTime() - new Date(transaction.date).getTime()) < 86400000 // Same day
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
        Alert.alert('Error', 'Please enter a vendor and amount.');
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
      Alert.alert('Created!', 'Purchase Order created. It will appear in Committed POs.');
      return;
    }
    
    // Handle Change Orders
    if (isChangeOrdersCategory) {
      const amount = Number(transaction.amount || 0);
      const materialsAmount = Number(transaction.materialsAmount || 0);
      const laborAmount = Number(transaction.laborAmount || 0);
      if (!transaction.vendor || amount <= 0) {
        Alert.alert('Error', 'Please enter a change order title and material and/or labor amount.');
        return;
      }

      Alert.alert(
        'Approve Change Order?',
        `Do you want to approve this change order for ${formatMoneyFull(amount, { decimals: 2 })}? Approved change orders will be added to your budget.`,
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => {
              addChangeOrder({
                id: `co-${Date.now()}`,
                title: transaction.vendor,
                amount: amount,
                materialsAmount,
                laborAmount,
                notes: transaction.description || '',
                approved: false,
                status: 'Submitted',
              });
              setShowAddForm(false);
              Alert.alert('Saved', 'Change order added. You can approve it later.');
            },
          },
          {
            text: 'Approve',
            style: 'default',
            onPress: () => {
              addChangeOrder({
                id: `co-${Date.now()}`,
                title: transaction.vendor,
                amount: amount,
                materialsAmount,
                laborAmount,
                notes: transaction.description || '',
                approved: true,
                status: 'Approved',
              });
              setShowAddForm(false);
              Alert.alert('Approved!', 'Change order approved and added to budget.');
            },
          },
        ]
      );
      return;
    }

    // Check for duplicates
    const isDuplicate = checkForDuplicates(transaction);
    if (isDuplicate) {
      Alert.alert(
        '⚠️ Possible Duplicate',
        `A similar transaction was found:\n${transaction.vendor} - ${formatMoneyFull(transaction.amount)}\n\nContinue anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => saveTransaction(transaction),
            style: 'default'
          }
        ]
      );
      return;
    }

    // Check for missing receipt on large spend
    const missingReceipt = checkMissingReceipt(transaction);
    if (missingReceipt) {
      Alert.alert(
        '📄 Receipt Recommended',
        `This transaction is over $1,000. Consider adding a receipt for audit protection.`,
        [
          { 
            text: 'Add Receipt', 
            onPress: () => {
              // Keep transaction data and reopen form with receipt option
              // For now, just save and show reminder
              saveTransaction(transaction);
            }
          },
          { 
            text: 'Save Without Receipt', 
            onPress: () => saveTransaction(transaction),
            style: 'cancel'
          }
        ]
      );
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
      amount: transaction.amount,
      date: transaction.date,
      notes: transaction.description,
      receiptUri: transaction.receiptUri || null,
      isPlanned: transaction.isPlanned !== undefined ? transaction.isPlanned : true,
      projectPhase: transaction.projectPhase || undefined,
      scope: transaction.scope || undefined,
      priceReasonableness: transaction.priceReasonableness || undefined,
    });

    Alert.alert(
      'Success!',
      `Added ${formatMoneyFull(transaction.amount, { decimals: 2 })} to ${categoryName}`,
      [{ text: 'OK' }]
    );
    setShowAddForm(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, !darkMode && { backgroundColor: Colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, !darkMode && { borderBottomColor: Colors.line }]}>
          <View style={styles.headerTop}>
            <View style={styles.backButtonWrapper}>
              {darkMode ? (
              <LinearGradient
                colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <TouchableOpacity
                  onPress={onClose} 
                    style={[styles.backButton, { backgroundColor: "#000000" }]}
                >
                    <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>
              ) : (
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.backButtonBorder}
                >
                  <TouchableOpacity
                    onPress={onClose}
                    style={[styles.backButton, { backgroundColor: Colors.bg }]}
                  >
                    <MaterialIcons name="arrow-back" size={24} color="#000000" />
                  </TouchableOpacity>
                </LinearGradient>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={styles.headerIconContainerWrapper}>
                  {darkMode ? (
                  <LinearGradient
                    colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
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
                      colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
                    backgroundColor: darkMode ? Colors.surface2 : Colors.surface2,
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
                    backgroundColor: darkMode ? Colors.surface2 : Colors.surface2,
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
                    backgroundColor: darkMode ? Colors.surface2 : Colors.surface2,
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

          {/* Total Spent Card */}
          <View style={styles.totalCardContainer}>
            {darkMode ? (
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.totalCardBorder}
            >
              <View style={styles.totalCardInner}>
                <View style={styles.totalCard}>
                  <Text style={[styles.totalLabel, { color: supportSub }]}>
                    {isPurchaseOrdersCategory 
                      ? (activePOTab === 'total' ? 'Total POs' : activePOTab === 'committed' ? 'Committed POs' : 'Received POs')
                      : 'Total Spent'}
                  </Text>
                  <Text style={styles.totalValue}>{formatMoneyFull(total, { decimals: 2 })}</Text>
                </View>
              </View>
            </LinearGradient>
            ) : (
              <View style={[styles.totalCardBorderLight, { borderColor: Colors.line }]}>
                <View style={[styles.totalCardInner, { backgroundColor: Colors.surface2, borderColor: Colors.line, borderWidth: 1 }]}>
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

          {/* Add Button */}
          <TouchableOpacity 
            style={styles.addButtonWrapper}
            onPress={() => setShowAddForm(true)}
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

          {/* Transactions List */}
          {data.length > 0 ? (
            <View style={styles.transactionsContainer}>
              {data.map((item) => {
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
                        <LinearGradient
                          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                          start={{ x: 0.05, y: 0.15 }}
                          end={{ x: 0.95, y: 0.85 }}
                          style={styles.transactionCardBorder}
                        >
                          <View style={[styles.transactionCard, { padding: 16 }]}>
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
                                      if (markingPOReceivedId === po.id) return;
                                      Alert.alert(
                                        'Mark as Received?',
                                        `${po.poNumber} from ${po.vendor} will be added to expenses.`,
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          {
                                            text: 'Received',
                                            onPress: () => {
                                              setMarkingPOReceivedId(po.id);
                                              markPOReceived(po.id);
                                              // Clear temporary button loading state after state propagation.
                                              setTimeout(() => {
                                                setMarkingPOReceivedId((curr) => (curr === po.id ? null : curr));
                                              }, 250);
                                            }
                                          }
                                        ]
                                      );
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
                            </Pressable>
                          </View>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.transactionCardBorderLight, { borderColor: Colors.line }]}>
                          <View style={[styles.transactionCard, { 
                            padding: 16,
                            backgroundColor: Colors.surface2,
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
                                      if (markingPOReceivedId === po.id) return;
                                      Alert.alert(
                                        'Mark as Received?',
                                        `${po.poNumber} from ${po.vendor} will be added to expenses.`,
                                        [
                                          { text: 'Cancel', style: 'cancel' },
                                          {
                                            text: 'Received',
                                            onPress: () => {
                                              setMarkingPOReceivedId(po.id);
                                              markPOReceived(po.id);
                                              // Clear temporary button loading state after state propagation.
                                              setTimeout(() => {
                                                setMarkingPOReceivedId((curr) => (curr === po.id ? null : curr));
                                              }, 250);
                                            }
                                          }
                                        ]
                                      );
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
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                }
                
                // For other categories (expenses, change orders), use the original card design
                return (
                  <View key={item.id} style={{ marginBottom: 12 }}>
                    {darkMode ? (
                    <LinearGradient
                      colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                      start={{ x: 0.05, y: 0.15 }}
                      end={{ x: 0.95, y: 0.85 }}
                      style={styles.transactionCardBorder}
                    >
                      <TouchableOpacity 
                        style={[
                          styles.transactionCard, 
                          { 
                            opacity: isItemDeleting ? 0.5 : 1,
                          }
                        ]}
                        onPress={() => {
                      if (isItemDeleting) return;
                      // For Change Orders, we need to navigate to Budget tab or show change order editor
                      // For now, just show an alert that they should use the Budget tab
                      if (item.isChangeOrder) {
                        Alert.alert(
                          'Edit Change Order',
                          'To edit change orders, please use the Budget tab. You can approve change orders from here by tapping the "Approve" button.',
                          [{ text: 'OK' }]
                        );
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
                    disabled={isItemDeleting}
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
                          {item.receiptUri && (
                            <MaterialIcons name="receipt" size={16} color="#22c55e" />
                          )}
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
                          {item.priceReasonableness === 'high' && (
                            <View style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                              backgroundColor: 'rgba(245, 158, 11, 0.2)',
                              borderWidth: 1,
                              borderColor: 'rgba(245, 158, 11, 0.4)',
                            }}>
                              <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '600' }}>HIGH</Text>
                            </View>
                          )}
                          {item.priceReasonableness === 'outlier' && (
                            <View style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 6,
                              backgroundColor: 'rgba(239, 68, 68, 0.2)',
                              borderWidth: 1,
                              borderColor: 'rgba(239, 68, 68, 0.4)',
                            }}>
                              <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '600' }}>OUTLIER</Text>
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
                            {item.description && (
                              <Text style={styles.description} numberOfLines={1} ellipsizeMode="tail">
                                {item.description}
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
                                Alert.alert(
                                  'Mark as Received?',
                                  `${item.poNumber || 'This purchase order'} from ${item.vendor} will be added to expenses.`,
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Received',
                                      onPress: () => {
                                        markPOReceived(item.id);
                                        Alert.alert('Received', `Purchase order "${item.poNumber || item.vendor}" has been marked as received. It will now appear in expenses.`);
                                      }
                                    }
                                  ]
                                );
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
                        {item.amount > 1000 && !item.receiptUri && (
                          <View style={{
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                          }}>
                            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '600' }}>⚠️ No Receipt</Text>
                          </View>
                        )}
                        <Text style={styles.tapToEdit}>Tap to edit →</Text>
                      </View>
                    )}
                    
                    {/* Approval Button for Change Orders */}
                    {item.isChangeOrder && !item.approved && item.status !== 'Approved' && (
                      <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: 'rgba(34, 197, 94, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(34, 197, 94, 0.3)',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          }}
                          onPress={() => {
                            approveChangeOrder(item.id);
                            Alert.alert('Approved', `Change order "${item.vendor}" has been approved. Budget updated.`);
                          }}
                        >
                          <MaterialIcons name="check-circle-outline" size={14} color="#22c55e" />
                          <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600' }}>Approve</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                      </TouchableOpacity>
                    </LinearGradient>
                    ) : (
                      <View style={[styles.transactionCardBorderLight, { borderColor: Colors.line }]}>
                        <TouchableOpacity 
                          style={[
                            styles.transactionCard,
                            { 
                              opacity: isItemDeleting ? 0.5 : 1,
                              backgroundColor: Colors.surface2,
                              borderColor: Colors.line,
                              borderWidth: 1,
                            }
                          ]}
                          onPress={() => {
                            if (isItemDeleting) return;
                            // For Change Orders, we need to navigate to Budget tab or show change order editor
                            // For now, just show an alert that they should use the Budget tab
                            if (item.isChangeOrder) {
                              Alert.alert(
                                'Edit Change Order',
                                'To edit change orders, please use the Budget tab. You can approve change orders from here by tapping the "Approve" button.',
                                [{ text: 'OK' }]
                              );
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
                          disabled={isItemDeleting}
                        >
                          <View style={styles.transactionHeader}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <Text style={[styles.vendor, { color: Colors.text }]}>{item.vendor}</Text>
                                {item.receiptUri && (
                                  <MaterialIcons name="receipt" size={16} color="#22c55e" />
                                )}
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
                                {item.priceReasonableness === 'high' && (
                                  <View style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(245, 158, 11, 0.4)',
                                  }}>
                                    <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '600' }}>HIGH</Text>
                                  </View>
                                )}
                                {item.priceReasonableness === 'outlier' && (
                                  <View style={{
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(239, 68, 68, 0.4)',
                                  }}>
                                    <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '600' }}>OUTLIER</Text>
                                  </View>
                                )}
                              </View>
                              {item.description && (
                                <Text style={[styles.description, { color: Colors.sub }]} numberOfLines={1} ellipsizeMode="tail">
                                  {item.description}
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
                            {item.amount > 1000 && !item.receiptUri && (
                              <View style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 6,
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                borderWidth: 1,
                                borderColor: 'rgba(239, 68, 68, 0.3)',
                              }}>
                                <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '600' }}>⚠️ No Receipt</Text>
                              </View>
                            )}
                            <Text style={styles.tapToEdit}>Tap to edit →</Text>
                            {/* Approval Button for Change Orders */}
                            {item.isChangeOrder && !item.approved && item.status !== 'Approved' && (
                              <TouchableOpacity
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(34, 197, 94, 0.3)',
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                                onPress={() => {
                                  approveChangeOrder(item.id);
                                  Alert.alert('Approved', `Change order "${item.vendor}" has been approved. Budget updated.`);
                                }}
                              >
                                <MaterialIcons name="check-circle-outline" size={14} color="#22c55e" />
                                <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600' }}>Approve</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainerWrapper}>
                {darkMode ? (
                <LinearGradient
                  colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.emptyIconBorder}
                >
                  <View style={styles.emptyIconContainer}>
                    <Text style={{ fontSize: 40 }}>{categoryIcon}</Text>
                  </View>
                </LinearGradient>
                ) : (
                  <View style={[styles.emptyIconBorderLight, { borderColor: Colors.line }]}>
                    <View style={[styles.emptyIconContainer, { backgroundColor: Colors.surface2, borderColor: Colors.line, borderWidth: 1 }]}>
                      <Text style={{ fontSize: 40 }}>{categoryIcon}</Text>
              </View>
                  </View>
                )}
              </View>
              <Text style={[styles.emptyText, !darkMode && { color: Colors.text }]}>No transactions yet</Text>
              <Text style={[styles.emptySubtext, !darkMode && { color: Colors.sub }]}>
                Expenses will appear here as they're added
              </Text>
            </View>
          )}
          
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>

      {/* Add Transaction Form */}
      <AddTransactionModal
        visible={showAddForm}
        categoryName={categoryName}
        onClose={() => setShowAddForm(false)}
        onSave={handleAddTransaction}
      />

      {/* Edit Purchase Order Modal (for Purchase Orders category) */}
      <EditPurchaseOrderModal
        visible={isPurchaseOrdersCategory && editingPurchaseOrder !== null}
        purchaseOrder={editingPurchaseOrder}
        onClose={() => setEditingPurchaseOrder(null)}
        onSave={(updated) => {
          // Use updatePurchaseOrder for actual PO objects
          updatePurchaseOrder(updated);
          Alert.alert('Updated!', 'Purchase Order updated successfully');
          setEditingPurchaseOrder(null);
        }}
        onCancel={(id) => {
          // Cancel the PO
          if (id) {
            cancelPO(id);
            Alert.alert('Cancelled', 'Purchase Order has been cancelled.');
          }
          setEditingPurchaseOrder(null);
        }}
      />

      {/* Edit Transaction Modal (for other categories) */}
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
          });
          Alert.alert('Updated!', 'Transaction updated successfully');
          setEditingTransaction(null);
        }}
        onDelete={(id) => {
          debugLog('🗑️ CategoryDetailModal: Deleting expense ID:', id);
          debugLog('🗑️ Current expenses in projectData:', projectData.expenses?.map((e: any) => ({ id: e.id, vendor: e.vendor, category: e.category })) || []);
          debugLog('🗑️ Current filtered data IDs:', data.map(d => d.id));
          
          // Verify the ID exists in the actual expenses
          const expenseExists = projectData.expenses?.some((e: any) => e.id === id);
          debugLog('🗑️ Expense ID exists in projectData.expenses:', expenseExists);
          
          if (!expenseExists) {
            console.error('❌ Expense ID not found in projectData.expenses!');
            console.error('❌ Looking for ID:', id);
            console.error('❌ Available IDs:', projectData.expenses?.map((e: any) => e.id) || []);
            Alert.alert('Error', 'Expense not found. Please try again.');
            return;
          }
          
          // Close edit modal first
          setEditingTransaction(null);
          // Set deleting state for this specific item only
          setDeletingId(id);
          
          // Delete expense - use a small delay to ensure modal closes first
          setTimeout(() => {
            debugLog('🗑️ Calling deleteExpense with ID:', id);
            deleteExpense(id);
            
            // Reset deleting state after a short delay to allow state to update
            // Don't reload from storage - the state update should be enough
            // The useEffect in ProjectDataContext will save to AsyncStorage automatically
            setTimeout(() => {
              setDeletingId(null);
              debugLog('✅ Delete complete, resetting deletingId');
            }, 300);
          }, 50);
        }}
      />
    </Modal>
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
    marginBottom: 22,
  },
  addButton: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: "#000000",
    borderRadius: 18,
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
    paddingVertical: 80,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  emptyIconContainerWrapper: {
    marginBottom: 24,
  },
  emptyIconBorder: {
    borderRadius: 24,
    padding: 1,
  },
  emptyIconBorderLight: {
    borderRadius: 24,
    padding: 1,
    borderWidth: 1,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 23,
    backgroundColor: '#000000',
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