import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Pressable,
  Animated,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { useProjectData } from "@/contexts/ProjectDataContext";
import AddTransactionModal from "./AddTransactionModal";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

const BRAND_GREEN = "#22c55e";
const BRAND_CYAN = "#22d3ee";

interface MaterialsEquipmentScreenProps {
  navigation: any;
}

const MaterialsEquipmentScreen: React.FC<MaterialsEquipmentScreenProps> = ({
  navigation,
}) => {
  const router = useRouter();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const { projectData, addExpense, updateExpense } = useProjectData();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  // Get materials/equipment expenses from project data
  const transactions = useMemo(() => {
    if (!projectData?.expenses) return [];
    
    // Filter for materials/equipment expenses
    let filtered = projectData.expenses
      .filter((exp: any) => {
        const category = (exp.category || '').toLowerCase();
        return category.includes('material') || 
               category.includes('equipment') ||
               category.includes('materials/equipment');
      })
      .map((exp: any) => ({
        id: exp.id,
        vendor: exp.vendor || 'Unknown',
        category: exp.category || 'Materials/Equipment',
        amount: exp.amount || 0,
        dateLabel: exp.date 
          ? new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'No date',
        date: exp.date,
        notes: exp.notes,
        receiptUri: exp.receiptUri,
      }));
    
    // Apply search filter if active
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((tx: any) => 
        tx.vendor.toLowerCase().includes(query) ||
        tx.category.toLowerCase().includes(query) ||
        (tx.notes && tx.notes.toLowerCase().includes(query))
      );
    }
    
    // Sort by date (most recent first)
    return filtered.sort((a: any, b: any) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [projectData?.expenses, searchQuery]);

  const totalSpent = useMemo(
    () => transactions.reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const handleAddTransaction = (transaction: {
    id: string;
    vendor: string;
    amount: number;
    description: string;
    po?: string;
    date: string;
    receiptUri?: string;
    isPlanned?: boolean;
    projectPhase?: string;
    scope?: string;
    priceReasonableness?: 'normal' | 'high' | 'outlier';
  }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    addExpense({
      id: transaction.id,
      vendor: transaction.vendor,
      amount: transaction.amount,
      category: 'Materials/Equipment',
      date: transaction.date,
      notes: transaction.description,
      receiptUri: transaction.receiptUri || null,
    });
    
    setShowAddModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleEditTransaction = (transaction: any) => {
    // For now, show an alert. Can be enhanced to open edit modal later
    Alert.alert(
      'Edit Transaction',
      `Edit functionality coming soon!\n\nVendor: ${transaction.vendor}\nAmount: $${transaction.amount.toFixed(2)}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, !darkMode && { backgroundColor: Colors.bg }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

      <View style={[styles.container, !darkMode && { backgroundColor: Colors.bg }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* HEADER */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => navigation?.goBack?.()}
              style={[
                styles.headerIconButton,
                !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line },
              ]}
            >
              <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : Colors.text} />
            </Pressable>

            <View style={styles.headerTitleRow}>
              <View style={[styles.headerAvatar, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <MaterialCommunityIcons
                  name="bricks"
                  size={24}
                  color={BRAND_GREEN}
                />
              </View>
              <View style={styles.headerTextBlock}>
                <Text style={[styles.headerTitle, { color: Colors.text }]}>Materials & Equipment</Text>
                <Text style={[styles.headerSubtitle, { color: Colors.sub }]}>
                  Transactions & Invoices
                </Text>
              </View>
            </View>
          </View>

          {/* TOTAL SPENT CARD */}
          <View style={styles.totalCardContainer}>
            {darkMode ? (
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.totalCardBorder}
            >
              <View style={styles.totalCard}>
                <View style={styles.totalLeft}>
                  <View style={styles.totalIconContainer}>
                    <Feather name="dollar-sign" size={18} color={BRAND_GREEN} />
                  </View>
                    <Text style={[styles.totalLabel, { color: Colors.sub }]}>Total Spent</Text>
                </View>
                <Text style={styles.totalValue}>
                  $
                  {totalSpent.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
            </LinearGradient>
            ) : (
              <View style={[styles.totalCardBorderLight, { borderColor: Colors.line }]}>
                <View style={[styles.totalCard, { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.line }]}>
                  <View style={styles.totalLeft}>
                    <View style={[styles.totalIconContainer, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                      <Feather name="dollar-sign" size={18} color={BRAND_GREEN} />
                    </View>
                    <Text style={[styles.totalLabel, { color: Colors.sub }]}>Total Spent</Text>
                  </View>
                  <Text style={styles.totalValue}>
                    $
                    {totalSpent.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ADD BUTTON */}
          <Pressable
            style={({ pressed }) => [
              styles.addButtonWrapper,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Navigate to Add Materials & Equipment page (the form with vendor, amount, receipt, budget status, project phase)
              const projectId = projectData?.id;
              if (projectId) {
                router.push({
                  pathname: '/add-materials-equipment',
                  params: { projectId }
                });
              } else {
                // Fallback to modal if no project ID
                setShowAddModal(true);
              }
            }}
          >
            <LinearGradient
              colors={["#22c55e", "#22d3ee"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButtonGradient}
            >
              <Text style={styles.addButtonText}>
                + Add Materials & Equipment
              </Text>
            </LinearGradient>
          </Pressable>

          {/* SECTION HEADER */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: Colors.text }]}>Recent Transactions</Text>
            <View style={styles.sectionActionsRow}>
              <Pressable
                style={[styles.iconChip, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowSearch(!showSearch);
                  if (showSearch) {
                    setSearchQuery("");
                  }
                }}
              >
                <Feather name="search" size={16} color={darkMode ? "#FFFFFF" : Colors.sub} />
              </Pressable>
              <Pressable
                style={[styles.iconChip, { marginLeft: 8 }, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  // Filter/sort functionality can be added later
                }}
              >
                <Feather name="sliders" size={16} color={darkMode ? "#FFFFFF" : Colors.sub} />
              </Pressable>
            </View>
          </View>

          {/* SEARCH BAR */}
          {showSearch && (
            <View style={[styles.searchContainer, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
              <Feather name="search" size={16} color={darkMode ? "#FFFFFF" : Colors.sub} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: Colors.text }]}
                placeholder="Search transactions..."
                placeholderTextColor={Colors.sub}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  style={styles.searchClear}
                >
                  <Feather name="x" size={16} color={darkMode ? "#FFFFFF" : Colors.sub} />
                </Pressable>
              )}
            </View>
          )}

          {/* TRANSACTION LIST / EMPTY STATE */}
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconBubble, !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <MaterialCommunityIcons
                  name="bricks"
                  size={28}
                  color={BRAND_GREEN}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: Colors.text }]}>No transactions yet</Text>
              <Text style={[styles.emptySubtitle, { color: Colors.sub }]}>
                Expenses will appear here as they're added.
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {transactions.map((tx) => (
                <TransactionCard 
                  key={tx.id} 
                  transaction={tx}
                  onPress={() => handleEditTransaction(tx)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        visible={showAddModal}
        categoryName="Materials/Equipment"
        onClose={() => setShowAddModal(false)}
        onSave={handleAddTransaction}
      />
    </SafeAreaView>
  );
};

interface Transaction {
  id: string;
  vendor: string;
  category: string;
  amount: number;
  dateLabel: string;
  date?: string;
  notes?: string;
  receiptUri?: string | null;
}

const TransactionCard: React.FC<{ transaction: Transaction; onPress?: () => void }> = ({
  transaction,
  onPress,
}) => {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 3,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }}
        style={styles.txPressable}
      >
        {darkMode ? (
        <LinearGradient
          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.txCardBorder}
        >
          <View style={styles.txCard}>
            <View style={styles.txLeft}>
              <View style={styles.txAvatar}>
                <MaterialCommunityIcons
                  name="warehouse"
                  size={20}
                  color={BRAND_GREEN}
                />
              </View>
              <View style={styles.txTextBlock}>
                  <Text style={[styles.txVendor, { color: Colors.text }]}>{transaction.vendor}</Text>
                  <Text style={[styles.txCategory, { color: Colors.sub }]} numberOfLines={1}>
                  {transaction.category}
                </Text>
                  <View style={[styles.txFooter, !darkMode && { borderTopColor: Colors.line }]}>
                    <Text style={[styles.txDate, { color: Colors.sub }]}>{transaction.dateLabel}</Text>
                  <View style={styles.txEditRow}>
                    <Text style={styles.txEditText}>Tap to edit</Text>
                    <Ionicons name="chevron-forward" size={14} color={BRAND_GREEN} />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.txRight}>
              <Text style={styles.txAmount}>
                $
                {transaction.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
          </View>
        </LinearGradient>
        ) : (
          <View style={[styles.txCardBorderLight, { borderColor: Colors.line }]}>
            <View style={[styles.txCard, { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.line }]}>
              <View style={styles.txLeft}>
                <View style={[styles.txAvatar, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                  <MaterialCommunityIcons
                    name="warehouse"
                    size={20}
                    color={BRAND_GREEN}
                  />
                </View>
                <View style={styles.txTextBlock}>
                  <Text style={[styles.txVendor, { color: Colors.text }]}>{transaction.vendor}</Text>
                  <Text style={[styles.txCategory, { color: Colors.sub }]} numberOfLines={1}>
                    {transaction.category}
                  </Text>
                  <View style={[styles.txFooter, { borderTopColor: Colors.line }]}>
                    <Text style={[styles.txDate, { color: Colors.sub }]}>{transaction.dateLabel}</Text>
                    <View style={styles.txEditRow}>
                      <Text style={styles.txEditText}>Tap to edit</Text>
                      <Ionicons name="chevron-forward" size={14} color={BRAND_GREEN} />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.txRight}>
                <Text style={styles.txAmount}>
                  $
                  {transaction.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },

  /* HEADER */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.3)",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.3)",
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#8DA0B8",
    marginTop: 4,
    fontWeight: "500",
    letterSpacing: 0.2,
  },

  /* TOTAL CARD */
  totalCardContainer: {
    marginBottom: 16,
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
  totalCard: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#000000",
  },
  totalLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  totalIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8DA0B8",
    letterSpacing: 0.3,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#22c55e",
    letterSpacing: -0.5,
  },

  /* ADD BUTTON */
  addButtonWrapper: {
    marginTop: 4,
    marginBottom: 24,
  },
  addButtonGradient: {
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: BRAND_GREEN,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#020617",
    letterSpacing: 0.3,
  },

  /* SECTION HEADER */
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  sectionActionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },

  /* EMPTY STATE */
  emptyState: {
    marginTop: 32,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyIconBubble: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.3)",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#8DA0B8",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },

  /* SEARCH */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 0,
  },
  searchClear: {
    padding: 4,
  },

  /* LIST */
  listContainer: {
    gap: 12,
  },

  /* TRANSACTION CARD */
  txPressable: {
    marginBottom: 12,
  },
  txCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  txCardBorderLight: {
    borderRadius: 20,
    padding: 1,
    borderWidth: 1,
  },
  txCard: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#000000",
  },
  txLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    marginRight: 12,
  },
  txAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.3)",
  },
  txTextBlock: {
    flex: 1,
  },
  txVendor: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  txCategory: {
    fontSize: 13,
    color: "#8DA0B8",
    marginBottom: 8,
    lineHeight: 18,
  },
  txFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  txDate: {
    fontSize: 12,
    color: "#8DA0B8",
    fontWeight: "500",
  },
  txRight: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#22c55e",
    letterSpacing: -0.3,
  },
  txEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  txEditText: {
    fontSize: 11,
    color: "#22c55e",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});

export default MaterialsEquipmentScreen;
