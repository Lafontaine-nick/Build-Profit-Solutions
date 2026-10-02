import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ProjectTaxSummary } from '@/src/lib/taxCenter';
import { taxCenterPanelCard } from '@/src/components/tax/taxPanelCardStyle';

type Props = {
  projects: ProjectTaxSummary[];
  formatMoney: (value: number) => string;
  formatPercent: (value: number | null) => string;
  /** Full page: each project is its own card, with no wrapping panel or repeated title. */
  asPage?: boolean;
};

export default function ProjectTaxSummaryList({ projects, formatMoney, formatPercent, asPage }: Props) {
  const projectCards =
    projects.length === 0 ? (
      <Text style={styles.empty}>No project activity found for this tax year.</Text>
    ) : (
      projects.map((project) => (
        <View
          key={project.projectId || project.projectName}
          style={[styles.projectCard, asPage && styles.projectCardPage]}
        >
            <View style={styles.projectHeader}>
              <Text style={[styles.projectName, asPage && styles.projectNamePage]}>{project.projectName}</Text>
              <View style={asPage && project.margin > 0 ? styles.marginChip : null}>
                <Text style={[styles.margin, asPage && styles.marginPage, { color: figureColor(project.margin) }]}>
                  {formatPercent(project.margin)}
                </Text>
              </View>
            </View>
            <View style={asPage ? styles.gridPage : styles.grid}>
              <Metric
                page={asPage}
                label="Revenue Collected"
                value={formatMoney(project.revenueCollected)}
                amount={project.revenueCollected}
              />
              <Metric
                page={asPage}
                label="Outstanding Invoices"
                value={formatMoney(project.outstandingInvoices)}
                amount={project.outstandingInvoices}
              />
              <Metric
                page={asPage}
                label="Expenses Paid"
                value={formatMoney(project.expensesPaid)}
                amount={project.expensesPaid}
              />
              <Metric page={asPage} label="Net Income" value={formatMoney(project.netIncome)} amount={project.netIncome} />
              <Metric page={asPage} label="Receipt Count" value={String(project.receiptCount)} amount={project.receiptCount} />
            </View>
          </View>
      ))
    );

  if (asPage) {
    return <View style={styles.pageList}>{projectCards}</View>;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Project-by-project tax summary</Text>
      <Text style={styles.subtitle}>
        Revenue is cash collected in the selected tax year. Expenses paid follow cash-basis dates, and purchase orders
        require an explicit paid status or payment date. Outstanding receivables and unpaid purchase orders are
        informational only in this view.
      </Text>
      {projectCards}
    </View>
  );
}

function figureColor(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return '#94a3b8';
  if (amount < 0) return '#f87171';
  return '#2dcc9a';
}

function Metric({
  label,
  value,
  amount,
  page,
}: {
  label: string;
  value: string;
  amount: number;
  page?: boolean;
}) {
  return (
    <View style={[styles.metric, page && styles.metricPage]}>
      <Text style={[styles.metricLabel, page && styles.metricLabelPage]}>{label}</Text>
      <Text style={[styles.metricValue, page && styles.metricValuePage, { color: figureColor(amount) }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pageList: {
    gap: 12,
  },
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
  projectCardPage: {
    backgroundColor: '#202022',
    borderColor: 'rgba(148, 163, 184, 0.12)',
    marginBottom: 0,
    padding: 16,
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
  projectNamePage: {
    fontSize: 17,
    letterSpacing: -0.25,
  },
  margin: {
    fontSize: 13,
    fontWeight: '800',
  },
  marginChip: {
    backgroundColor: 'rgba(45, 204, 154, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(45, 204, 154, 0.55)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  marginPage: {
    fontSize: 13,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridPage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
    columnGap: 12,
  },
  metric: {
    minWidth: '30%',
    flexGrow: 1,
  },
  metricPage: {
    width: '47%',
    minWidth: '47%',
    flexGrow: 0,
  },
  metricLabel: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 11,
    marginBottom: 3,
  },
  metricLabelPage: {
    fontSize: 12,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  metricValuePage: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  empty: {
    color: 'rgba(203, 213, 225, 0.75)',
    fontSize: 13,
    lineHeight: 18,
  },
});
