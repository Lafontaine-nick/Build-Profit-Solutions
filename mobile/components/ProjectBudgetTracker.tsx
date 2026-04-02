import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart as GiftedLineChart } from 'react-native-gifted-charts';
import { useTheme } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface BudgetItem {
  id: string;
  category:
    | 'materials'
    | 'labor'
    | 'equipment'
    | 'subcontractors'
    | 'permits'
    | 'other';
  name: string;
  budgeted: number;
  actual: number;
  unit: string;
  quantity: number;
  unitPrice: number;
  date: string;
  vendor?: string;
  notes?: string;
}

interface ProjectBudget {
  projectId: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  categories: {
    materials: { budgeted: number; actual: number; items: BudgetItem[] };
    labor: { budgeted: number; actual: number; items: BudgetItem[] };
    equipment: { budgeted: number; actual: number; items: BudgetItem[] };
    subcontractors: { budgeted: number; actual: number; items: BudgetItem[] };
    permits: { budgeted: number; actual: number; items: BudgetItem[] };
    other: { budgeted: number; actual: number; items: BudgetItem[] };
  };
  timeline: {
    startDate: string;
    endDate: string;
    currentPhase: string;
    phases: Array<{
      name: string;
      startDate: string;
      endDate: string;
      budget: number;
      spent: number;
      progress: number;
    }>;
  };
}

interface ProjectBudgetTrackerProps {
  projectId: string;
  projectName: string;
  onBudgetUpdate?: (budget: ProjectBudget) => void;
}

const CATEGORY_COLORS = {
  materials: '#FF6B6B',
  labor: '#4ECDC4',
  equipment: '#45B7D1',
  subcontractors: '#96CEB4',
  permits: '#FFEAA7',
  other: '#DDA0DD',
};

const CATEGORY_ICONS = {
  materials: 'construction',
  labor: 'people',
  equipment: 'build',
  subcontractors: 'business',
  permits: 'description',
  other: 'more-horiz',
};

const CATEGORY_LABELS: Record<keyof typeof CATEGORY_COLORS, string> = {
  materials: 'Materials & Equipment',
  labor: 'Labor',
  equipment: 'Equipment',
  subcontractors: 'Subcontractors',
  permits: 'Permits & Fees',
  other: 'Other',
};

export default function ProjectBudgetTracker({
  projectId,
  projectName,
  onBudgetUpdate,
}: ProjectBudgetTrackerProps) {
  const { darkMode } = useTheme();
  const [budget, setBudget] = useState<ProjectBudget | null>(null);
  const [addItemModal, setAddItemModal] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<keyof typeof CATEGORY_COLORS>('materials');
  const [newItem, setNewItem] = useState<Partial<BudgetItem>>({
    name: '',
    budgeted: 0,
    actual: 0,
    unit: '',
    quantity: 1,
    unitPrice: 0,
    vendor: '',
    notes: '',
    category: 'materials',
  });

  const theme = darkMode
    ? {
        background: '#0b1c38',
        card: '#1B365D',
        text: '#fff',
        subtext: '#aaa',
        accent: '#43cea2',
        border: '#2a4a7a',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
      }
    : {
        background: '#f5f7fa',
        card: '#fff',
        text: '#222',
        subtext: '#555',
        accent: '#1976d2',
        border: '#e0e0e0',
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
      };

  useEffect(() => {
    const source = projectData;
    if (!source) {
      setBudget(null);
      return;
    }

    const categories: ProjectBudget['categories'] = {
      materials: { budgeted: 0, actual: 0, items: [] },
      labor: { budgeted: 0, actual: 0, items: [] },
      equipment: { budgeted: 0, actual: 0, items: [] },
      subcontractors: { budgeted: 0, actual: 0, items: [] },
      permits: { budgeted: 0, actual: 0, items: [] },
      other: { budgeted: 0, actual: 0, items: [] },
    };

    const classifyCategory = (value?: string | null): keyof typeof categories => {
      if (!value) return 'other';
      const lower = value.toLowerCase();
      if (lower.includes('labor')) return 'labor';
      if (lower.includes('equip')) return 'equipment';
      if (lower.includes('sub') || lower.includes('contract')) return 'subcontractors';
      if (lower.includes('permit')) return 'permits';
      if (lower.includes('material') || lower.includes('supply')) return 'materials';
      return 'other';
    };

    (source.buckets || []).forEach((bucket) => {
      const cat = classifyCategory(bucket.name);
      const budgeted = safe(bucket.bidBudget ?? bucket.budget);
      const spent = safe(bucket.spent);
      categories[cat].budgeted += budgeted;
      categories[cat].actual += spent;
      categories[cat].items.push({
        id: bucket.id,
        category: cat,
        name: bucket.name,
        budgeted,
        actual: spent,
        unit: 'budget',
        quantity: 1,
        unitPrice: budgeted,
        date: source.lastUpdated || new Date().toISOString(),
      });
    });

    (source.expenses || []).forEach((expense) => {
      const amount = safe(expense.amount);
      if (amount <= 0) return;
      const cat = classifyCategory(expense.category || expense.vendor || expense.description);
      categories[cat].actual += amount;
      categories[cat].items.push({
        id: expense.id,
        category: cat,
        name: expense.vendor || expense.description || 'Expense',
        budgeted: 0,
        actual: amount,
        unit: 'expense',
        quantity: 1,
        unitPrice: amount,
        date: expense.date || new Date().toISOString(),
        vendor: expense.vendor,
        notes: expense.description,
      });
    });

    const totalBudget =
      source.budgeted ?? Object.values(categories).reduce((sum, cat) => sum + cat.budgeted, 0);
    const totalSpent =
      source.spent ?? Object.values(categories).reduce((sum, cat) => sum + cat.actual, 0);

    const aggregated: ProjectBudget = {
      projectId: source.id || projectId,
      totalBudget: totalBudget,
      totalSpent: totalSpent,
      remaining: Math.max(totalBudget - totalSpent, 0),
      categories,
      timeline: {
        startDate: source.startISO || new Date().toISOString(),
        endDate: source.endISO || new Date().toISOString(),
        currentPhase: source.health?.projectStatus || source.status || 'Planning',
        phases: [],
      },
    };

    setBudget(aggregated);
    onBudgetUpdate?.(aggregated);
  }, [projectId, projectData, onBudgetUpdate]);

  useEffect(() => {
    setNewItem((prev) => ({
      ...prev,
      category: selectedCategory,
    }));
  }, [selectedCategory]);

  const addBudgetItem = () => {
    if (!newItem.name || !newItem.actual) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    const item: BudgetItem = {
      id: Date.now().toString(),
      category: selectedCategory,
      name: newItem.name!,
      budgeted: newItem.budgeted || 0,
      actual: newItem.actual!,
      unit: newItem.unit || 'each',
      quantity: newItem.quantity || 1,
      unitPrice: newItem.unitPrice || 0,
      date: new Date().toISOString().split('T')[0],
      vendor: newItem.vendor,
      notes: newItem.notes,
    };

    if (budget) {
      const updatedBudget = { ...budget };
      updatedBudget.categories[selectedCategory].items.push(item);
      updatedBudget.categories[selectedCategory].actual += item.actual;
      updatedBudget.totalSpent += item.actual;
      updatedBudget.remaining =
        updatedBudget.totalBudget - updatedBudget.totalSpent;

      setBudget(updatedBudget);
      onBudgetUpdate?.(updatedBudget);
      setAddItemModal(false);
      setNewItem({
        name: '',
        budgeted: 0,
        actual: 0,
        unit: '',
        quantity: 1,
        unitPrice: 0,
        vendor: '',
        notes: '',
        category: 'materials',
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const getBudgetStatus = () => {
    if (!budget)
      return { status: 'neutral', message: '', color: theme.subtext };

    const percentage = (budget.totalSpent / budget.totalBudget) * 100;

    if (percentage > 90) {
      return { status: 'over', message: 'Over Budget!', color: theme.error };
    } else if (percentage > 75) {
      return {
        status: 'warning',
        message: 'Approaching Budget Limit',
        color: theme.warning,
      };
    } else {
      return { status: 'good', message: 'On Track', color: theme.success };
    }
  };

  const renderCategoryCard = (category: keyof typeof CATEGORY_COLORS) => {
    if (!budget) return null;

    const categoryData = budget.categories[category];
    const percentage =
      categoryData.budgeted > 0
        ? (categoryData.actual / categoryData.budgeted) * 100
        : 0;
    const isOverBudget = categoryData.actual > categoryData.budgeted;

    return (
      <TouchableOpacity
        key={category}
        style={[
          styles.categoryCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
        onPress={() => {
          setSelectedCategory(category);
          setAddItemModal(true);
        }}
      >
        <View style={styles.categoryHeader}>
          <View style={styles.categoryInfo}>
            <MaterialIcons
              name={CATEGORY_ICONS[category]}
              size={24}
              color={CATEGORY_COLORS[category]}
            />
            <Text style={[styles.categoryName, { color: theme.text }]}>
              {CATEGORY_LABELS[category]}
            </Text>
          </View>
          <MaterialIcons name='add' size={20} color={theme.accent} />
        </View>

        <View style={styles.categoryStats}>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Budgeted
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              ${categoryData.budgeted.toLocaleString()}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Spent
            </Text>
            <Text
              style={[
                styles.statValue,
                { color: isOverBudget ? theme.error : theme.text },
              ]}
            >
              ${categoryData.actual.toLocaleString()}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>
              Progress
            </Text>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {percentage.toFixed(1)}%
            </Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: isOverBudget
                  ? theme.error
                  : CATEGORY_COLORS[category],
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderTimelineChart = () => {
    if (!budget) return null;

    const chartData = budget.timeline.phases.map((phase, index) => ({
      value: phase.progress,
      label: phase.name,
      frontColor: CATEGORY_COLORS.materials,
    }));

    return (
      <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
        <Text style={[styles.chartTitle, { color: theme.text }]}>
          Project Timeline Progress
        </Text>
        <GiftedLineChart
          data={chartData}
          width={width - 80}
          height={200}
          color={theme.accent}
          thickness={3}
          dataPointsColor={theme.accent}
          dataPointsRadius={6}
          yAxisColor={theme.border}
          xAxisColor={theme.border}
          yAxisTextStyle={{ color: theme.subtext }}
          xAxisLabelTextStyle={{ color: theme.subtext }}
          curved
          gradientColor={theme.accent}
        />
      </View>
    );
  };

  if (!budget) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Loading budget data...
        </Text>
      </View>
    );
  }

  const budgetStatus = getBudgetStatus();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Budget Overview */}
      <LinearGradient
        colors={[theme.card, theme.background]}
        style={styles.overviewCard}
      >
        <Text style={[styles.projectName, { color: theme.text }]}>
          {projectName}
        </Text>
        <View style={styles.budgetOverview}>
          <View style={styles.budgetItem}>
            <Text style={[styles.budgetLabel, { color: theme.subtext }]}>
              Total Budget
            </Text>
            <Text style={[styles.budgetValue, { color: theme.text }]}>
              ${budget.totalBudget.toLocaleString()}
            </Text>
          </View>
          <View style={styles.budgetItem}>
            <Text style={[styles.budgetLabel, { color: theme.subtext }]}>
              Spent
            </Text>
            <Text style={[styles.budgetValue, { color: theme.text }]}>
              ${budget.totalSpent.toLocaleString()}
            </Text>
          </View>
          <View style={styles.budgetItem}>
            <Text style={[styles.budgetLabel, { color: theme.subtext }]}>
              Remaining
            </Text>
            <Text style={[styles.budgetValue, { color: budgetStatus.color }]}>
              ${budget.remaining.toLocaleString()}
            </Text>
          </View>
        </View>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: budgetStatus.color },
            ]}
          />
          <Text style={[styles.statusText, { color: budgetStatus.color }]}>
            {budgetStatus.message}
          </Text>
        </View>
      </LinearGradient>

      {/* Timeline Chart */}
      {renderTimelineChart()}

      {/* Category Cards */}
      <View style={styles.categoriesContainer}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Budget Categories
        </Text>
        {Object.keys(CATEGORY_COLORS).map(category =>
          renderCategoryCard(category as keyof typeof CATEGORY_COLORS)
        )}
      </View>

      {/* Add Item Modal */}
      <Modal
        visible={addItemModal}
        animationType='slide'
        presentationStyle='pageSheet'
      >
        <View
          style={[styles.modalContainer, { backgroundColor: theme.background }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Add {CATEGORY_LABELS[selectedCategory]} Item
            </Text>
            <TouchableOpacity onPress={() => setAddItemModal(false)}>
              <MaterialIcons name='close' size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.categorySelector}>
            {(Object.keys(CATEGORY_COLORS) as Array<keyof typeof CATEGORY_COLORS>).map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat && [
                    styles.categoryChipActive,
                    { backgroundColor: CATEGORY_COLORS[cat] } as any,
                  ],
                  { borderColor: selectedCategory === cat ? CATEGORY_COLORS[cat] : theme.border },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <MaterialIcons
                  name={CATEGORY_ICONS[cat]}
                  size={16}
                  color={selectedCategory === cat ? '#fff' : theme.text}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: selectedCategory === cat ? '#fff' : theme.text },
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Item Name *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newItem.name}
                onChangeText={text => setNewItem({ ...newItem, name: text })}
                placeholder='Enter item name'
                placeholderTextColor={theme.subtext}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Budgeted Amount
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newItem.budgeted?.toString() || ''}
                  onChangeText={text =>
                    setNewItem({ ...newItem, budgeted: parseFloat(text) || 0 })
                  }
                  placeholder='0'
                  placeholderTextColor={theme.subtext}
                  keyboardType='numeric'
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Actual Amount *
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newItem.actual?.toString() || ''}
                  onChangeText={text =>
                    setNewItem({ ...newItem, actual: parseFloat(text) || 0 })
                  }
                  placeholder='0'
                  placeholderTextColor={theme.subtext}
                  keyboardType='numeric'
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Quantity
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newItem.quantity?.toString() || ''}
                  onChangeText={text =>
                    setNewItem({ ...newItem, quantity: parseFloat(text) || 1 })
                  }
                  placeholder='1'
                  placeholderTextColor={theme.subtext}
                  keyboardType='numeric'
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Unit
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.card,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  value={newItem.unit}
                  onChangeText={text => setNewItem({ ...newItem, unit: text })}
                  placeholder='each, hours, etc.'
                  placeholderTextColor={theme.subtext}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Vendor
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newItem.vendor}
                onChangeText={text => setNewItem({ ...newItem, vendor: text })}
                placeholder='Vendor name'
                placeholderTextColor={theme.subtext}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Notes
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: theme.card,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newItem.notes}
                onChangeText={text => setNewItem({ ...newItem, notes: text })}
                placeholder='Additional notes'
                placeholderTextColor={theme.subtext}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={() => setAddItemModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.accent }]}
              onPress={addBudgetItem}
            >
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  overviewCard: {
    margin: 16,
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  projectName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  budgetOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  budgetItem: {
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  budgetValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartContainer: {
    margin: 16,
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoriesContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  categoryCard: {
    padding: 22,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  categoryStats: {
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  categoryChipActive: {
    borderWidth: 0,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
