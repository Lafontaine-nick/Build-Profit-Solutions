import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import aiExpenseValidationService from '../services/aiExpenseValidationService';

interface ExpenseValidation {
  isValid: boolean;
  confidence: number;
  suggestedCategory?: string;
  flags: {
    type:
      | 'unusual_amount'
      | 'duplicate'
      | 'wrong_category'
      | 'suspicious_vendor'
      | 'missing_receipt';
    severity: 'low' | 'medium' | 'high';
    message: string;
    suggestion?: string;
  }[];
  recommendations: string[];
}

interface Expense {
  id: string;
  amount: number;
  vendor?: string;
  category?: string;
  date?: string;
  notes?: string;
  receiptUri?: string | null;
}

interface AIExpenseValidationProps {
  expense: Expense;
  projectContext: {
    projectType: string;
    budgetCategories: string[];
    averageExpenseAmount: number;
    recentExpenses: Expense[];
  };
  onValidationComplete: (validation: ExpenseValidation) => void;
  onCategorySuggestion: (suggestedCategory: string) => void;
}

export default function AIExpenseValidation({
  expense,
  projectContext,
  onValidationComplete,
  onCategorySuggestion,
}: AIExpenseValidationProps) {
  const { darkMode } = useTheme();
  const [validation, setValidation] = useState<ExpenseValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const theme = darkMode
    ? {
        background: ['#0b1c38', '#1B365D', '#43cea2'],
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        card: '#1B365D',
        border: 'rgba(255, 255, 255, 0.1)',
        accent: '#43cea2',
      }
    : {
        background: ['#f5f7fa', '#c3cfe2', '#fff'],
        text: '#1e293b',
        subtext: '#64748b',
        card: '#ffffff',
        border: 'rgba(0, 0, 0, 0.1)',
        accent: '#1976d2',
      };

  const validateExpense = async () => {
    setIsValidating(true);
    try {
      const result = await aiExpenseValidationService.validateExpense(
        expense,
        projectContext
      );
      setValidation(result);
      onValidationComplete(result);

      if (
        result.suggestedCategory &&
        result.suggestedCategory !== expense.category
      ) {
        onCategorySuggestion(result.suggestedCategory);
      }
    } catch (error) {
      console.error('Expense validation failed:', error);
      Alert.alert(
        'Validation Error',
        'Failed to validate expense. Please try again.'
      );
    } finally {
      setIsValidating(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#3b82f6';
      default:
        return theme.subtext;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return '⚪';
    }
  };

  if (!validation) {
    return (
      <TouchableOpacity
        onPress={validateExpense}
        disabled={isValidating}
        style={[styles.validateButton, { backgroundColor: theme.accent }]}
      >
        <Text style={styles.validateButtonText}>
          {isValidating ? '🤖 Validating...' : '🤖 AI Validate Expense'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          🤖 AI Validation Results
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: validation.isValid ? '#22c55e' : '#ef4444' },
          ]}
        >
          <Text style={styles.statusText}>
            {validation.isValid ? '✅ Valid' : '⚠️ Issues Found'}
          </Text>
        </View>
      </View>

      <Text style={[styles.confidence, { color: theme.subtext }]}>
        Confidence: {validation.confidence}%
      </Text>

      {validation.flags.length > 0 && (
        <View style={styles.flagsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Issues Found:
          </Text>
          {validation.flags.map((flag, index) => (
            <View key={index} style={styles.flagItem}>
              <View style={styles.flagHeader}>
                <Text
                  style={[
                    styles.flagIcon,
                    { color: getSeverityColor(flag.severity) },
                  ]}
                >
                  {getSeverityIcon(flag.severity)}
                </Text>
                <Text style={[styles.flagMessage, { color: theme.text }]}>
                  {flag.message}
                </Text>
              </View>
              {flag.suggestion && (
                <Text style={[styles.flagSuggestion, { color: theme.subtext }]}>
                  💡 {flag.suggestion}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {validation.recommendations.length > 0 && (
        <View style={styles.recommendationsSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Recommendations:
          </Text>
          {validation.recommendations.map((recommendation, index) => (
            <Text
              key={index}
              style={[styles.recommendation, { color: theme.text }]}
            >
              {recommendation}
            </Text>
          ))}
        </View>
      )}

      {validation.suggestedCategory &&
        validation.suggestedCategory !== expense.category && (
          <View style={styles.suggestionSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Category Suggestion:
            </Text>
            <TouchableOpacity
              style={[
                styles.suggestionButton,
                { backgroundColor: theme.accent },
              ]}
              onPress={() =>
                onCategorySuggestion(validation.suggestedCategory!)
              }
            >
              <Text style={styles.suggestionButtonText}>
                📂 Use "{validation.suggestedCategory}" instead
              </Text>
            </TouchableOpacity>
          </View>
        )}

      <TouchableOpacity
        onPress={validateExpense}
        style={[styles.refreshButton, { borderColor: theme.border }]}
      >
        <Text style={[styles.refreshButtonText, { color: theme.text }]}>
          🔄 Re-validate
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  validateButton: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  validateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  confidence: {
    fontSize: 14,
    marginBottom: 16,
  },
  flagsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  flagItem: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 6,
  },
  flagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  flagIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  flagMessage: {
    fontSize: 14,
    flex: 1,
  },
  flagSuggestion: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  recommendationsSection: {
    marginBottom: 16,
  },
  recommendation: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  suggestionSection: {
    marginBottom: 16,
  },
  suggestionButton: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  suggestionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
