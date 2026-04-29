import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ProjectTaxSummary } from '@/src/lib/taxCenter';
import { taxCenterPanelCard } from '@/src/components/tax/taxPanelCardStyle';

type Props = {
  projects: ProjectTaxSummary[];
  formatMoney: (value: number) => string;
  formatPercent: (value: number | null) => string;
};

export default function ProjectTaxSummaryList({ projects, formatMoney, formatPercent }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Project-by-project tax summary</Text>
      <Text style={styles.subtitle}>
        Tax summaries are based on collected revenue and actual paid expenses.
      </Text>

      {projects.length === 0 ? (
        <Text style={styles.empty}>No project activity found for this tax year.</Text>
      ) : (
        projects.map((project) => (
          <View key={project.projectId || project.projectName} style={styles.projectCard}>
            <View style={styles.projectHeader}>
              <Text style={styles.projectName}>{project.projectName}</Text>
              <Text style={styles.margin}>{formatPercent(project.margin)}</Text>
            </View>
            <View style={styles.grid}>
              <Metric label="Revenue Collected" value={formatMoney(project.revenueCollected)} />
              <Metric label="Outstanding Invoices" value={formatMoney(project.outstandingInvoices)} />
              <Metric label="Expenses Paid" value={formatMoney(project.expensesPaid)} />
              <Metric label="Net Income" value={formatMoney(project.netIncome)} positive={project.netIncome >= 0} />
              <Metric label="Receipt Count" value={String(project.receiptCount)} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, positive === false && styles.negative]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...taxCenterPanelCard,
    paddingBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(203, 213, 225, 0.82)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 14,
  },
  projectCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  projectName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  margin: {
    color: '#2DFFC4',
    fontSize: 13,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    minWidth: '30%',
    flexGrow: 1,
  },
  metricLabel: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 11,
    marginBottom: 3,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  negative: {
    color: '#FCA5A5',
  },
  empty: {
    color: 'rgba(203, 213, 225, 0.75)',
    fontSize: 13,
    lineHeight: 18,
  },
});
