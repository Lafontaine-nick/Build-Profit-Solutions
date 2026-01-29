import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import {
  BudgetLineItem,
  calculateBudgetTotal,
} from '@/services/budgetGenerator';
import { formatMoneyFull } from '../src/lib/budgetUtils';

interface BudgetReviewModalProps {
  visible: boolean;
  onClose: () => void;
  budgetItems: BudgetLineItem[];
  onAccept: (items: BudgetLineItem[]) => void;
  projectTitle: string;
}

export default function BudgetReviewModal({
  visible,
  onClose,
  budgetItems,
  onAccept,
  projectTitle,
}: BudgetReviewModalProps) {
  const { darkMode } = useTheme();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(budgetItems.map(item => item.id))
  );

  const theme = darkMode
    ? {
        background: '#1B365D',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        border: 'rgba(255, 255, 255, 0.1)',
        accent: '#43cea2',
        card: '#0b1c38',
      }
    : {
        background: '#fff',
        text: '#1e293b',
        subtext: '#64748b',
        border: 'rgba(0, 0, 0, 0.1)',
        accent: '#1976d2',
        card: '#f8fafc',
      };

  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleAccept = () => {
    const acceptedItems = budgetItems.filter(item =>
      selectedItems.has(item.id)
    );
    if (acceptedItems.length === 0) {
      Alert.alert(
        'No Items Selected',
        'Please select at least one budget item to add.'
      );
      return;
    }
    onAccept(acceptedItems);
    onClose();
  };

  const selectedTotal = calculateBudgetTotal(
    budgetItems.filter(item => selectedItems.has(item.id))
  );

  const formatCurrency = (amount: number) => formatMoneyFull(amount, { decimals: 0 });

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Review AI-Generated Budget
          </Text>
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            {projectTitle}
          </Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>
              Budget Summary
            </Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.subtext }]}>
                Total Items:
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {budgetItems.length}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.subtext }]}>
                Selected Items:
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {selectedItems.size}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text
                style={[
                  styles.summaryLabel,
                  { color: theme.text, fontWeight: '600' },
                ]}
              >
                Selected Total:
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: theme.accent, fontWeight: '600' },
                ]}
              >
                {formatCurrency(selectedTotal)}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Budget Line Items
          </Text>

          {budgetItems.map(item => {
            const isSelected = selectedItems.has(item.id);
            const itemTotal = item.qty * item.unitCost * (1 + item.markupPct);

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: isSelected ? theme.accent : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => toggleItem(item.id)}
              >
                <View style={styles.itemHeader}>
                  <View style={styles.itemInfo}>
                    <Text
                      style={[styles.itemCategory, { color: theme.accent }]}
                    >
                      {item.category}
                    </Text>
                    <Text
                      style={[styles.itemDescription, { color: theme.text }]}
                    >
                      {item.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: isSelected
                          ? theme.accent
                          : 'transparent',
                        borderColor: theme.accent,
                      },
                    ]}
                  >
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </View>

                <View style={styles.itemDetails}>
                  <View style={styles.detailRow}>
                    <Text
                      style={[styles.detailLabel, { color: theme.subtext }]}
                    >
                      Quantity:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {item.qty} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text
                      style={[styles.detailLabel, { color: theme.subtext }]}
                    >
                      Unit Cost:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {formatCurrency(item.unitCost)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text
                      style={[styles.detailLabel, { color: theme.subtext }]}
                    >
                      Markup:
                    </Text>
                    <Text style={[styles.detailValue, { color: theme.text }]}>
                      {(item.markupPct * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={[styles.detailRow, styles.totalRow]}>
                    <Text
                      style={[
                        styles.detailLabel,
                        { color: theme.text, fontWeight: '600' },
                      ]}
                    >
                      Total:
                    </Text>
                    <Text
                      style={[
                        styles.detailValue,
                        { color: theme.accent, fontWeight: '600' },
                      ]}
                    >
                      {formatCurrency(itemTotal)}
                    </Text>
                  </View>
                </View>

                {item.aiSuggested && (
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>🤖 AI Suggested</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.cancelButton,
              { borderColor: theme.border },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.buttonText, { color: theme.text }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.acceptButton,
              { backgroundColor: theme.accent },
            ]}
            onPress={handleAccept}
          >
            <Text style={[styles.buttonText, styles.acceptButtonText]}>
              Add Selected ({selectedItems.size})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 16 },
  content: { flex: 1, padding: 16 },
  summaryCard: {
    backgroundColor: 'rgba(67, 206, 162, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(67, 206, 162, 0.3)',
  },
  summaryTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  summaryLabel: { fontSize: 16 },
  summaryValue: { fontSize: 16, fontWeight: '500' },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  itemCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemCategory: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  itemDescription: { fontSize: 16, fontWeight: '500' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  itemDetails: { marginBottom: 8 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '500' },
  aiBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  aiBadgeText: { fontSize: 12, color: '#22c55e', fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { borderWidth: 1 },
  acceptButton: {},
  buttonText: { fontSize: 16, fontWeight: '600' },
  acceptButtonText: { color: '#fff' },
});
