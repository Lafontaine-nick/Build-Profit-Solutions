// @ts-nocheck
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import BudgetActions from './BudgetActions';
import { useProject } from '../state/projectStore';

const money = (n: number) =>
  (Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });

/**
 * Build Profit Solutions — Budget Tab (with new state management)
 * ---------------------------------------------------------
 * - Uses the new useProject hook from projectStore
 * - Integrates with BudgetActions component
 */

// Types for existing BudgetTab components
export type BudgetLine = {
  id: string;
  category: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  spent?: number;
};

type Theme = {
  bg: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
};

export default function BudgetTab() {
  const { darkMode } = useTheme();
  const { lineItems, totals, derived, actions } = useProject();
  const [tab, setTab] = useState<'lines' | 'expenses' | 'cos'>('lines');
  const [editing, setEditing] = useState<BudgetLine | null>(null);

  const theme: Theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    card: darkMode ? '#1e293b' : '#ffffff',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    subtext: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
  };

  // Convert lineItems to BudgetLine format for existing components
  const budgetLines = useMemo(() => {
    return lineItems.map(li => ({
      id: li.id,
      category: li.category,
      description: li.category, // fallback
      qty: 1,
      unit: 'item',
      unitCost: li.budget,
      spent: li.spent,
    }));
  }, [lineItems]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: 'transparent' }]}
      contentContainerStyle={styles.content}
    >
      {/* Budget Summary */}
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.summaryTitle, { color: theme.text }]}>
          Budget Summary
        </Text>

        <Row
          label='Planned Budget'
          value={money(totals.plannedBudget)}
          theme={theme}
        />
        <Row
          label='Approved Change Orders'
          value={`+ ${money(totals.approvedChangeOrders)}`}
          theme={theme}
        />
        <Row
          label='Adjusted Budget'
          value={money(derived.adjustedBudget)}
          theme={theme}
        />
        <Row
          label='Actual Expenses'
          value={money(totals.actualExpenses)}
          theme={theme}
        />
        <Row
          label='Committed POs'
          value={money(totals.committedPOs)}
          theme={theme}
        />

        <View style={styles.remainingSection}>
          <Text style={[styles.remainingLabel, { color: theme.subtext }]}>
            Remaining
          </Text>
          <Bar
            pct={Math.max(
              0,
              100 -
                ((totals.actualExpenses + totals.committedPOs) /
                  Math.max(derived.adjustedBudget, 1)) *
                  100
            )}
          />
          <Text
            style={[
              styles.remainingText,
              { color: derived.remaining >= 0 ? '#22c55e' : '#ef4444' },
            ]}
          >
            {derived.remaining >= 0
              ? `Under by ${money(derived.remaining)}`
              : `Over by ${money(-derived.remaining)}`}
          </Text>
        </View>
      </View>

      {/* Budget Actions */}
      <BudgetActions
        lineItems={lineItems}
        totals={totals}
        onApplyDraft={actions.applyDraftBudget}
        onAddExpense={actions.addExpense}
        onAddChangeOrder={actions.addChangeOrder}
      />

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TabPill
          label='Line Items'
          active={tab === 'lines'}
          onPress={() => setTab('lines')}
          theme={theme}
        />
        <TabPill
          label='Expenses'
          active={tab === 'expenses'}
          onPress={() => setTab('expenses')}
          theme={theme}
        />
        <TabPill
          label='Change Orders'
          active={tab === 'cos'}
          onPress={() => setTab('cos')}
          theme={theme}
        />
      </View>

      {tab === 'lines' && (
        <View
          style={[
            styles.tabContent,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <HeaderRow cols={['Category', 'Budget', 'Spent']} theme={theme} />
          {budgetLines.map(line => (
            <Pressable
              key={line.id}
              onPress={() => setEditing(line)}
              style={[styles.lineItem, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.lineCategory, { color: theme.text }]}>
                {line.category}
              </Text>
              <Text style={[styles.lineBudget, { color: theme.text }]}>
                {money(line.unitCost)}
              </Text>
              <Text style={[styles.lineSpent, { color: theme.text }]}>
                {money(line.spent || 0)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Additional tab content would go here */}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// Helper Components
function Row({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: Theme;
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

function HeaderRow({ cols, theme }: { cols: string[]; theme: Theme }) {
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.headerText, { color: theme.subtext }]}>
        {cols[0]}
      </Text>
      <Text style={[styles.headerText, { color: theme.subtext }]}>
        {cols[1]}
      </Text>
      <Text style={[styles.headerText, { color: theme.subtext }]}>
        {cols[2]}
      </Text>
    </View>
  );
}

function TabPill({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabPill,
        {
          backgroundColor: active ? '#43cea2' : 'rgba(30, 41, 59, 0.6)',
          borderColor: theme.border,
        },
      ]}
    >
      <Text
        style={[styles.tabPillText, { color: active ? '#43cea2' : theme.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Bar({ pct }: { pct: number }) {
  const getBarColor = () => {
    if (pct > 66) return '#22c55e';
    if (pct > 33) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <View style={styles.barContainer}>
      <View
        style={[
          styles.barFill,
          {
            width: `${Math.min(Math.max(pct, 0), 100)}%`,
            backgroundColor: getBarColor(),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 24 },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
  },
  summaryTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 14, flex: 1 },
  rowValue: { fontSize: 16, fontWeight: '500', textAlign: 'right' },
  remainingSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  remainingLabel: { fontSize: 12, marginBottom: 6 },
  remainingText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 16,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabPillText: { fontSize: 14, fontWeight: '600' },
  tabContent: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  lineItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineCategory: { flex: 1, fontSize: 14 },
  lineBudget: { flex: 1, fontSize: 14, textAlign: 'center' },
  lineSpent: { flex: 1, fontSize: 14, textAlign: 'right' },
  barContainer: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#475569',
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  bottomSpacer: { height: 100 },
});
