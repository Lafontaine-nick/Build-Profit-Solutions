import React, { useState, useMemo, useRef, useEffect } from "react";
import { View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { formatMoneyFull } from "@/src/lib/budgetUtils";
import AddTransactionModal from "./AddTransactionModal";
import EditTransactionModal from "./EditTransactionModal";
import EditPurchaseOrderModal from "./EditPurchaseOrderModal";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

type Props = {
  visible: boolean;
  categoryName: string;
  onClose: () => void;
  theme?: any;
};

export default function CategoryDetailModal({ visible, categoryName, onClose, theme: _theme }: Props) {
  const { theme: appTheme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(appTheme), [appTheme]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const previousDataRef = useRef<any[]>([]);
  const { projectData, addExpense, deleteExpense, updateExpense, reloadFromStorage } = useProjectData();
  
  // Force re-render when expenses change
  // Use both the count and IDs to ensure we catch all changes
  const expensesKey = useMemo(() => {
    const expenses = projectData.expenses || [];
    const ids = expenses.map(e => e.id).join(',');
    const count = expenses.length;
    return `${count}:${ids}`;
  }, [projectData.expenses]);

  // Filter expenses by category (flexible matching for Materials/Equipment)
  const data = useMemo(() => {
    const expenses = projectData.expenses || [];
    const categoryLower = categoryName.toLowerCase();
    
    console.log('📊 CategoryDetailModal: Filtering expenses. Total:', expenses.length, 'Category:', categoryName);
    
    const filtered = expenses
      .filter(exp => {
        const expCategory = (exp.category || '').toLowerCase();
        
        // Exact match
        if (expCategory === categoryLower) return true;
        
        // Flexible match for Materials/Equipment
        if ((categoryLower.includes('materials') || categoryLower.includes('equipment')) &&
            (expCategory.includes('materials') || expCategory.includes('equipment'))) {
          return true;
        }
        
        // Flexible match for Labor
        if (categoryLower.includes('labor') && expCategory.includes('labor')) {
          return true;
        }
        
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
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Most recent first
    
    console.log('📊 CategoryDetailModal: Filtered expenses count:', filtered.length);
    
    // Store previous data for smooth transitions (only when we have data)
    if (filtered.length > 0) {
      previousDataRef.current = filtered;
    }
    
    // Return filtered data (don't freeze during delete - let it update naturally)
    return filtered;
  }, [projectData.expenses, categoryName]);

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [data]);

  // Update ref when data changes
  useEffect(() => {
    previousDataRef.current = data;
  }, [data]);
  
  // Debug: Log when projectData.expenses changes
  useEffect(() => {
    console.log('🔄 CategoryDetailModal: projectData.expenses changed, count:', projectData.expenses?.length || 0);
  }, [projectData.expenses]);

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
                    style={[styles.backButton, { backgroundColor: "#FFFFFF" }]}
                  >
                    <MaterialIcons name="arrow-back" size={24} color="#000000" />
                  </TouchableOpacity>
                </LinearGradient>
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
                      <View style={[styles.headerIconContainer, { backgroundColor: "#FFFFFF" }]}>
                        <Text style={{ fontSize: 24 }}>{categoryIcon}</Text>
                      </View>
                    </LinearGradient>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.headerTitle, !darkMode && { color: Colors.text }]}>
                    {categoryName.replace('/', ' & ')}
                  </Text>
                  <Text style={[styles.headerSubtitle, !darkMode && { color: Colors.sub }]}>
                    Transactions & Invoices
                  </Text>
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
                  <Text style={styles.totalLabel}>Total Spent</Text>
                  <Text style={styles.totalValue}>{formatMoneyFull(total, { decimals: 2 })}</Text>
                </View>
              </View>
            </LinearGradient>
            ) : (
              <View style={[styles.totalCardBorderLight, { borderColor: Colors.line }]}>
                <View style={[styles.totalCardInner, { backgroundColor: Colors.surface2, borderColor: Colors.line, borderWidth: 1 }]}>
                  <View style={styles.totalCard}>
                    <Text style={[styles.totalLabel, { color: Colors.sub }]}>Total Spent</Text>
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
                      // For Purchase Orders category, convert expense to PO format
                      if (categoryName === 'Purchase Orders') {
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
                          <Text style={styles.vendor}>{item.vendor}</Text>
                          {item.receiptUri && (
                            <MaterialIcons name="receipt" size={16} color="#22c55e" />
                          )}
                          {item.isPlanned === false && (
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
                      </View>
                      <Text style={styles.amount}>{formatMoneyFull(item.amount, { decimals: 2 })}</Text>
                    </View>
                    
                    <View style={styles.transactionFooter}>
                      <Text style={styles.date}>
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
                    </View>
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
                            // For Purchase Orders category, convert expense to PO format
                            if (categoryName === 'Purchase Orders') {
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
                                {item.isPlanned === false && (
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
        visible={categoryName === 'Purchase Orders' && editingPurchaseOrder !== null}
        purchaseOrder={editingPurchaseOrder}
        onClose={() => setEditingPurchaseOrder(null)}
        onSave={(updated) => {
          // Convert PO back to expense format
          updateExpense({
            id: updated.id,
            category: 'Purchase Orders',
            vendor: updated.vendor,
            amount: updated.amount,
            date: updated.orderDate || new Date().toISOString(),
            notes: updated.description,
          });
          Alert.alert('Updated!', 'Purchase Order updated successfully');
          setEditingPurchaseOrder(null);
        }}
        onCancel={(id) => {
          // For expenses, we want to delete, not cancel
          Alert.alert(
            'Delete Purchase Order?',
            'This will permanently remove this purchase order.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  deleteExpense(id);
                  setEditingPurchaseOrder(null);
                }
              }
            ]
          );
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
          console.log('🗑️ CategoryDetailModal: Deleting expense ID:', id);
          console.log('🗑️ Current expenses in projectData:', projectData.expenses?.map((e: any) => ({ id: e.id, vendor: e.vendor, category: e.category })) || []);
          console.log('🗑️ Current filtered data IDs:', data.map(d => d.id));
          
          // Verify the ID exists in the actual expenses
          const expenseExists = projectData.expenses?.some((e: any) => e.id === id);
          console.log('🗑️ Expense ID exists in projectData.expenses:', expenseExists);
          
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
            console.log('🗑️ Calling deleteExpense with ID:', id);
            deleteExpense(id);
            
            // Reset deleting state after a short delay to allow state to update
            // Don't reload from storage - the state update should be enough
            // The useEffect in ProjectDataContext will save to AsyncStorage automatically
            setTimeout(() => {
              setDeletingId(null);
              console.log('✅ Delete complete, resetting deletingId');
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
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
    color: "#8DA0B8",
    fontSize: 14,
    marginTop: 2,
    fontWeight: '500',
    letterSpacing: 0.1,
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
    paddingTop: 24,
    paddingBottom: 120,
  },
  totalCardContainer: {
    marginBottom: 20,
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
    padding: 24,
  },
  totalCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    color: "#8DA0B8",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  totalValue: {
    color: "#22c55e",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  addButtonWrapper: {
    marginBottom: 24,
  },
  addButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
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
    gap: 14,
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
    padding: 20,
    marginBottom: 0,
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
    color: "#8DA0B8",
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
    fontWeight: "500",
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  date: {
    color: "#8DA0B8",
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
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
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  bottomSpacer: {
    height: 32,
  },
}); 