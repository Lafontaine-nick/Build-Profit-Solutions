import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

export interface BudgetNumbers {
  plannedBudget: number;
  actualExpenses: number;
  approvedChangeOrders: number;
  adjustedBudget: number;
  committedPOs: number;
  remaining: number;
}

export interface BudgetPayload {
  plannedBudget: number;
  actualExpenses: number;
  approvedChangeOrders: number;
}

interface Props {
  visible: boolean;
  numbers: BudgetNumbers;
  onClose: () => void;
  onSubmit: (payload: BudgetPayload) => void;
}

export default function BudgetUpdateModal({
  visible,
  numbers,
  onClose,
  onSubmit,
}: Props) {
  const [plannedBudget, setPlannedBudget] = useState(
    numbers.plannedBudget.toString()
  );
  const [actualExpenses, setActualExpenses] = useState(
    numbers.actualExpenses.toString()
  );
  const [approvedChangeOrders, setApprovedChangeOrders] = useState(
    numbers.approvedChangeOrders.toString()
  );

  const handleSubmit = () => {
    const payload: BudgetPayload = {
      plannedBudget: parseFloat(plannedBudget) || 0,
      actualExpenses: parseFloat(actualExpenses) || 0,
      approvedChangeOrders: parseFloat(approvedChangeOrders) || 0,
    };
    onSubmit(payload);
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Update Budget</Text>
          <TouchableOpacity onPress={handleSubmit} style={styles.saveButton}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Planned Budget</Text>
              <TextInput
                style={styles.input}
                value={plannedBudget}
                onChangeText={setPlannedBudget}
                placeholder='Enter planned budget'
                keyboardType='numeric'
                placeholderTextColor='#9CA3AF'
              />
              <Text style={styles.currentValue}>
                Current: {formatMoney(numbers.plannedBudget)}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Actual Expenses</Text>
              <TextInput
                style={styles.input}
                value={actualExpenses}
                onChangeText={setActualExpenses}
                placeholder='Enter actual expenses'
                keyboardType='numeric'
                placeholderTextColor='#9CA3AF'
              />
              <Text style={styles.currentValue}>
                Current: {formatMoney(numbers.actualExpenses)}
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Approved Change Orders</Text>
              <TextInput
                style={styles.input}
                value={approvedChangeOrders}
                onChangeText={setApprovedChangeOrders}
                placeholder='Enter change orders'
                keyboardType='numeric'
                placeholderTextColor='#9CA3AF'
              />
              <Text style={styles.currentValue}>
                Current: {formatMoney(numbers.approvedChangeOrders)}
              </Text>
            </View>
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Adjusted Budget</Text>
                <Text style={styles.summaryValue}>
                  {formatMoney(
                    (parseFloat(plannedBudget) || 0) +
                      (parseFloat(approvedChangeOrders) || 0)
                  )}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Remaining</Text>
                <Text style={styles.summaryValue}>
                  {formatMoney(
                    (parseFloat(plannedBudget) || 0) +
                      (parseFloat(approvedChangeOrders) || 0) -
                      (parseFloat(actualExpenses) || 0) -
                      numbers.committedPOs
                  )}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  saveText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
  },
  currentValue: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  summarySection: {
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
});
