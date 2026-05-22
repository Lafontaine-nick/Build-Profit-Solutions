import React, { useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Animated,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { useProjectData } from "@/contexts/ProjectDataContext";
import AddTransactionModal from "./AddTransactionModal";
import ProductScannerModal from "./ProductScannerModal";
import ProductFoundSheet from "./ProductFoundSheet";
import { buildProductNotes } from "../lib/products/productScannerTypes";
import type { ProductScannerSavePayload } from "../lib/products/productScannerTypes";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { isDesktopWebLayoutWidth, DASHBOARD_WEB_MAX_CONTENT_WIDTH, WEB_DESKTOP_EDGE_HORIZONTAL, ScreenLayout, PROJECT_WIDE_CONTAINER_CARD_INSET } from "@/constants/ScreenLayout";
import { neutralIconPressableWebStyle } from "@/constants/iconPressable";

const BRAND_GREEN = "#22c55e";
const BRAND_CYAN = "#22d3ee";
const PROJECT_SCAN_DESTINATIONS = ['project_budget'];
const MATERIALS_SCAN_SAVE_LABEL = 'Add to Materials & Equipment';

interface MaterialsEquipmentScreenProps {
  navigation: any;
  /** When set (e.g. from `/materials-equipment?projectId=`), Add always opens the full-page form even if context id lags. */
  routeProjectId?: string;
}

const MaterialsEquipmentScreen: React.FC<MaterialsEquipmentScreenProps> = ({
  navigation,
  routeProjectId,
}) => {
  const router = useRouter();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const { width: layoutWidth } = useWindowDimensions();
  const materialsDesktopWeb =
    Platform.OS === "web" && isDesktopWebLayoutWidth(layoutWidth);
  /** Native: same math as BudgetTab inside project-detail (outer 20 + wide strip -20 / +4). */
  const useNativeBudgetBleed =
    Platform.OS === "ios" || Platform.OS === "android";
  const scrollOuterPadH = useMemo(() => {
    if (materialsDesktopWeb) return WEB_DESKTOP_EDGE_HORIZONTAL;
    return ScreenLayout.edge.horizontal;
  }, [materialsDesktopWeb]);
  /** Same as BudgetTab `budgetContainerWide` + project `wideContainer`: nearly full-bleed gradient frame on native. */
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
  const { projectData, addExpense, updateExpense } = useProjectData();
  const [showAddModal, setShowAddModal] = useState(false);
  const [productScannerVisible, setProductScannerVisible] = useState(false);
  const [scannedProjectProduct, setScannedProjectProduct] = useState<any>(null);
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
        material: exp.material?.trim() || undefined,
        category: exp.category || 'Materials/Equipment',
        amount: exp.amount || 0,
        dateLabel: exp.date 
          ? new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'No date',
        date: exp.date,
        notes: exp.notes,
        receiptUri: exp.receiptUri ?? null,
      }));
    
    // Apply search filter if active
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((tx: any) => 
        tx.vendor.toLowerCase().includes(query) ||
        (tx.material && tx.material.toLowerCase().includes(query)) ||
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

  const projectLookupZip = useMemo(() => {
    const raw =
      projectData?.customerZip ||
      projectData?.projectZip ||
      projectData?.zip ||
      projectData?.location?.zip;
    const zip = String(raw || '').replace(/\D/g, '').slice(0, 5);
    return zip || undefined;
  }, [projectData]);

  const handleMaterialsScannedProductSave = useCallback((payload: ProductScannerSavePayload) => {
    const { product, quantity, unitCost, description, notes } = payload;
    const qty = Math.max(Number(quantity) || 0, 0);
    const cost = Math.max(Number(unitCost) || 0, 0);
    const costTotal = Math.round(qty * cost * 100) / 100;
    const productNotes = buildProductNotes(product, notes);
    const vendor = product.supplier || 'Scanned supplier';
    const title = description || product.title || 'Scanned product';

    addExpense({
      id: `scan-exp-${Date.now()}`,
      category: 'Materials/Equipment',
      vendor,
      material: title,
      amount: costTotal,
      date: new Date().toISOString(),
      notes: productNotes,
      sku: product.sku || product.model || product.upc,
      sourceUrl: product.sourceUrl,
      quantity: qty,
      unitCost: cost,
    } as any);

    setScannedProjectProduct(null);
    setProductScannerVisible(false);
    Alert.alert('Added!', `${title} added to Materials & Equipment`);
  }, [addExpense]);

  const handleAddTransaction = (transaction: {
    id: string;
    vendor: string;
    material?: string;
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
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    addExpense({
      id: transaction.id,
      vendor: transaction.vendor,
      material: transaction.material?.trim() || undefined,
      amount: transaction.amount,
      category: 'Materials/Equipment',
      date: transaction.date,
      notes: transaction.description,
      receiptUri: transaction.receiptUri || null,
    });

    setShowAddModal(false);
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
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

      <View
        style={[
          { flex: 1, width: "100%" },
          materialsDesktopWeb && { alignItems: "center" as const },
        ]}
      >
        <View
          style={[
            styles.container,
            !darkMode && { backgroundColor: Colors.bg },
            materialsDesktopWeb && {
              width: "100%",
              maxWidth: DASHBOARD_WEB_MAX_CONTENT_WIDTH,
            },
          ]}
        >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: scrollOuterPadH },
          ]}
        >
          <View style={pageWideBleedStyle}>
          <LinearGradient
            colors={["#2DFFC4", "#00A6FF"]}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.pageOverviewGradientRing}
          >
            <View
              style={[
                styles.pageOverviewInner,
                { backgroundColor: darkMode ? "#000000" : Colors.bg },
              ]}
            >
          {/* HEADER — same horizontal inset as project tabs (outside wide strip) */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation?.goBack?.()}
              style={[
                styles.headerIconButton,
                !darkMode && { backgroundColor: Colors.bg, borderColor: Colors.line },
                neutralIconPressableWebStyle(),
              ]}
              activeOpacity={0.88}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : Colors.text} />
            </TouchableOpacity>

            <View style={styles.headerTitleRow}>
              <View style={[styles.headerAvatar, !darkMode && { backgroundColor: Colors.bg, borderColor: Colors.line }]}>
                <MaterialCommunityIcons
                  name="bricks"
                  size={24}
                  color={BRAND_GREEN}
                />
              </View>
              <View style={styles.headerTextBlock}>
                <Text style={[styles.headerTitle, { color: Colors.text }]}>Materials & Equipment</Text>
                <Text
                  style={[
                    styles.headerSubtitle,
                    { color: darkMode ? "rgba(226, 232, 240, 0.78)" : Colors.sub },
                  ]}
                >
                  Transactions & Invoices
                </Text>
              </View>
            </View>
          </View>

          {/* TOTAL SPENT CARD */}
          <View style={styles.totalCardContainer}>
            {darkMode ? (
              <View
                style={[
                  styles.totalCard,
                  {
                    backgroundColor: Colors.surface2,
                    borderWidth: 1,
                    borderColor: "rgba(148, 163, 184, 0.12)",
                    borderRadius: 14,
                  },
                ]}
              >
                <View style={styles.totalLeftBlock}>
                  <View style={styles.totalTopRow}>
                    <View style={styles.totalIconContainer}>
                      <Feather name="dollar-sign" size={18} color={BRAND_GREEN} />
                    </View>
                    <Text
                      style={[
                        styles.totalLabel,
                        { color: darkMode ? "rgba(226, 232, 240, 0.72)" : Colors.sub },
                      ]}
                    >
                      Total Spent
                    </Text>
                  </View>
                </View>
                <Text style={styles.totalValue}>
                  $
                  {totalSpent.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Text>
              </View>
            ) : (
              <View style={[styles.totalCardBorderLight, { borderColor: Colors.line }]}>
                <View style={[styles.totalCard, { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.line }]}>
                  <View style={styles.totalLeftBlock}>
                    <View style={styles.totalTopRow}>
                      <View style={[styles.totalIconContainer, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                        <Feather name="dollar-sign" size={18} color={BRAND_GREEN} />
                      </View>
                      <Text style={[styles.totalLabel, { color: Colors.sub }]}>Total Spent</Text>
                    </View>
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

          {/* SCAN + ADD */}
          <Pressable
            style={({ pressed }) => [
              styles.scanButton,
              !darkMode && { backgroundColor: Colors.surface2, borderColor: Colors.line },
              pressed && { opacity: 0.88 },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              setProductScannerVisible(true);
            }}
          >
            <Ionicons name="camera-outline" size={18} color={BRAND_GREEN} />
            <Text style={[styles.scanButtonText, { color: Colors.text }]}>Scan Product</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.addButtonWrapper,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => {
              if (Platform.OS !== "web") {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }
              const projectIdForAdd = routeProjectId || projectData?.id;
              if (projectIdForAdd) {
                router.push({
                  pathname: "/add-materials-equipment",
                  params: { projectId: String(projectIdForAdd) },
                });
              } else {
                setShowAddModal(true);
              }
            }}
          >
            <View style={[styles.addButtonGradient, { backgroundColor: BRAND_GREEN }]}>
              <Text style={styles.addButtonText}>
                + Add Materials & Equipment
              </Text>
            </View>
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
                placeholderTextColor={darkMode ? "rgba(226, 232, 240, 0.52)" : Colors.sub}
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
              <Text
                style={[
                  styles.emptySubtitle,
                  { color: darkMode ? "rgba(226, 232, 240, 0.68)" : Colors.sub },
                ]}
              >
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
            </View>
          </LinearGradient>
          </View>
        </ScrollView>
        </View>
      </View>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        visible={showAddModal}
        categoryName="Materials/Equipment"
        onClose={() => setShowAddModal(false)}
        onSave={handleAddTransaction}
      />
      <ProductScannerModal
        visible={productScannerVisible}
        defaultZip={projectLookupZip}
        onClose={() => setProductScannerVisible(false)}
        onProductFound={(product) => {
          setScannedProjectProduct(product);
          setProductScannerVisible(false);
        }}
      />
      <ProductFoundSheet
        visible={Boolean(scannedProjectProduct)}
        product={scannedProjectProduct}
        destinations={PROJECT_SCAN_DESTINATIONS}
        defaultDestination="project_budget"
        lookupZip={projectLookupZip}
        primaryActionTitle={MATERIALS_SCAN_SAVE_LABEL}
        onClose={() => setScannedProjectProduct(null)}
        onSave={handleMaterialsScannedProductSave}
      />
    </SafeAreaView>
  );
};

interface Transaction {
  id: string;
  vendor: string;
  material?: string;
  category: string;
  amount: number;
  dateLabel: string;
  date?: string;
  notes?: string | null;
  receiptUri?: string | null;
}

const TransactionCard: React.FC<{ transaction: Transaction; onPress?: () => void }> = ({
  transaction,
  onPress,
}) => {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const supportSub = darkMode ? "rgba(226, 232, 240, 0.76)" : Colors.sub;
  const hintMuted = darkMode ? "rgba(226, 232, 240, 0.52)" : Colors.sub;
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
          <View
            style={[
              styles.txCard,
              {
                backgroundColor: Colors.surface2,
                borderWidth: 1,
                borderColor: "rgba(148, 163, 184, 0.12)",
                borderRadius: 14,
              },
            ]}
          >
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
                {transaction.material ? (
                  <Text style={[styles.txCategory, { color: supportSub }]} numberOfLines={2}>
                    {transaction.material}
                  </Text>
                ) : null}
                <Text style={[styles.txCategory, { color: supportSub }]} numberOfLines={1}>
                  {transaction.category}
                </Text>
                {transaction.notes ? (
                  <Text style={[styles.txNotes, { color: supportSub }]} numberOfLines={2}>
                    {transaction.notes}
                  </Text>
                ) : null}
                <View style={[styles.txFooter, !darkMode && { borderTopColor: Colors.line }]}>
                  <View style={styles.txFooterLeft}>
                    <Text style={[styles.txDate, { color: hintMuted }]}>{transaction.dateLabel}</Text>
                    {transaction.receiptUri ? (
                      <View style={styles.txReceiptPill}>
                        <MaterialCommunityIcons name="receipt" size={12} color="rgba(34, 197, 94, 0.85)" />
                        <Text style={styles.txReceiptPillText}>Receipt</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.txEditRow}>
                    <Text style={[styles.txEditText, { color: hintMuted }]}>Tap to edit</Text>
                    <Ionicons name="chevron-forward" size={13} color={hintMuted} />
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
                  {transaction.material ? (
                    <Text style={[styles.txCategory, { color: supportSub }]} numberOfLines={2}>
                      {transaction.material}
                    </Text>
                  ) : null}
                  <Text style={[styles.txCategory, { color: supportSub }]} numberOfLines={1}>
                    {transaction.category}
                  </Text>
                  {transaction.notes ? (
                    <Text style={[styles.txNotes, { color: supportSub }]} numberOfLines={2}>
                      {transaction.notes}
                    </Text>
                  ) : null}
                  <View style={[styles.txFooter, { borderTopColor: Colors.line }]}>
                    <View style={styles.txFooterLeft}>
                      <Text style={[styles.txDate, { color: hintMuted }]}>{transaction.dateLabel}</Text>
                      {transaction.receiptUri ? (
                        <View style={styles.txReceiptPill}>
                          <MaterialCommunityIcons name="receipt" size={12} color="rgba(34, 197, 94, 0.85)" />
                          <Text style={styles.txReceiptPillText}>Receipt</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.txEditRow}>
                      <Text style={[styles.txEditText, { color: hintMuted }]}>Tap to edit</Text>
                      <Ionicons name="chevron-forward" size={13} color={hintMuted} />
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  pageOverviewGradientRing: {
    borderRadius: 30,
    padding: 1,
    marginBottom: 14,
    overflow: "hidden",
  },
  pageOverviewInner: {
    borderRadius: 29,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
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
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#000000",
  },
  totalLeftBlock: {
    flex: 1,
    marginRight: 12,
  },
  totalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    fontSize: 12,
    fontWeight: "600",
    color: "#8DA0B8",
    letterSpacing: 0.55,
    textTransform: "uppercase",
  },
  totalValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#22c55e",
    letterSpacing: -0.6,
  },

  /* ADD BUTTON */
  scanButton: {
    marginTop: 4,
    marginBottom: 10,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.32)",
  },
  scanButtonText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  addButtonWrapper: {
    marginTop: 0,
    marginBottom: 24,
  },
  addButtonGradient: {
    borderRadius: 14,
    paddingVertical: 15,
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
    gap: 14,
  },

  /* TRANSACTION CARD */
  txPressable: {
    marginBottom: 2,
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
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: "transparent",
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
    marginBottom: 4,
    lineHeight: 18,
  },
  txNotes: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    fontWeight: "500",
  },
  txFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.14)",
  },
  txFooterLeft: {
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  txDate: {
    fontSize: 12,
    color: "#8DA0B8",
    fontWeight: "500",
  },
  txReceiptPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.22)",
  },
  txReceiptPillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(226, 232, 240, 0.75)",
    letterSpacing: 0.2,
  },
  txRight: {
    alignItems: "flex-end",
    paddingTop: 2,
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
    fontWeight: "600",
    letterSpacing: 0.15,
  },
});

export default MaterialsEquipmentScreen;
