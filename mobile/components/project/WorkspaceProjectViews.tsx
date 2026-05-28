import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import type { getColors } from '@/theme/getColors';

export type OperationalRiskCard = {
  id: string;
  title: string;
  body: string;
  severity: 'high' | 'medium' | 'low';
};

const money = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(n || 0));

/** Operational risks only — no profit/margin/payment pricing. */
export function buildOperationalRiskCards(input: {
  project: any;
  metrics: any;
  liveTimelineMilestones: any[];
}): OperationalRiskCard[] {
  const cards: OperationalRiskCard[] = [];
  const { project, metrics, liveTimelineMilestones } = input;
  const status = String(project?.status || '').toLowerCase();
  const isCompleted = status === 'completed' || status === 'done' || status === 'finished';
  if (!metrics || isCompleted) return cards;

  const budgetCap = Number(metrics?.costBudgetCap || metrics?.financials?.adjustedCostBudget || 0);
  const spentAndCommitted =
    Number(metrics?.totalSpent || 0) + Number(metrics?.committedPOsTotal || 0);
  const progress = Number(metrics?.scheduleProgress || 0);
  const expenses = Array.isArray(project?.expenses)
    ? project.expenses
    : Array.isArray(project?.projectData?.expenses)
      ? project.projectData.expenses
      : [];
  const missingReceipts = expenses.filter(
    (expense: any) => !expense?.receiptUri || !String(expense.receiptUri).trim()
  ).length;
  const pendingExpenses = expenses.filter(
    (expense: any) =>
      String(expense?.status || '').toLowerCase() === 'pending' ||
      expense?.pending === true
  ).length;
  const changeOrders = Array.isArray(project?.changeOrders)
    ? project.changeOrders
    : Array.isArray(project?.projectData?.changeOrders)
      ? project.projectData.changeOrders
      : [];
  const openChangeOrders = changeOrders.filter((co: any) => {
    const st = String(co?.status || '').toLowerCase();
    return st === 'draft' || st === 'submitted' || st === 'pending';
  }).length;

  if (budgetCap > 0 && spentAndCommitted > budgetCap) {
    cards.push({
      id: 'over-budget',
      severity: spentAndCommitted > budgetCap * 1.1 ? 'high' : 'medium',
      title: 'Cost budget exceeded',
      body: `Spending is about ${money(spentAndCommitted - budgetCap)} over the approved cost budget. Review categories and pending expenses.`,
    });
  } else if (budgetCap > 0 && spentAndCommitted > budgetCap * 0.9) {
    cards.push({
      id: 'budget-pressure',
      severity: 'medium',
      title: 'Cost budget nearly used',
      body: `${Math.round((spentAndCommitted / budgetCap) * 100)}% of the approved cost budget is used or committed.`,
    });
  }

  if (missingReceipts >= 2) {
    cards.push({
      id: 'receipts',
      severity: missingReceipts >= 5 ? 'medium' : 'low',
      title: 'Missing receipts',
      body: `${missingReceipts} expense${missingReceipts > 1 ? 's are' : ' is'} missing receipt backup.`,
    });
  }

  if (pendingExpenses > 0) {
    cards.push({
      id: 'pending-expenses',
      severity: pendingExpenses >= 3 ? 'medium' : 'low',
      title: 'Pending expenses',
      body: `${pendingExpenses} expense submission${pendingExpenses > 1 ? 's need' : ' needs'} review.`,
    });
  }

  if (openChangeOrders > 0) {
    cards.push({
      id: 'open-co',
      severity: 'low',
      title: 'Open change orders',
      body: `${openChangeOrders} change order${openChangeOrders > 1 ? 's are' : ' is'} still open.`,
    });
  }

  if (progress < 100 && progress > 0 && budgetCap > 0) {
    const expectedSpend = budgetCap * (progress / 100);
    if (spentAndCommitted > expectedSpend * 1.15) {
      cards.push({
        id: 'spend-ahead',
        severity: 'medium',
        title: 'Spend ahead of schedule',
        body: `Costs are running ahead of ${Math.round(progress)}% schedule progress. Check labor and materials activity.`,
      });
    }
  }

  const overdueMilestones = (Array.isArray(liveTimelineMilestones)
    ? liveTimelineMilestones
    : []
  ).filter((m: any) => {
    const due = m?.date ? new Date(m.date) : null;
    if (!due || Number.isNaN(due.getTime())) return false;
    const p = Number(m?.progressPct ?? m?.progress ?? 0);
    return p < 100 && due.getTime() < Date.now();
  });
  if (overdueMilestones.length > 0) {
    cards.push({
      id: 'schedule-delay',
      severity: overdueMilestones.length > 1 ? 'medium' : 'low',
      title: 'Schedule delay risk',
      body: `${overdueMilestones.length} milestone${overdueMilestones.length > 1 ? 's are' : ' is'} past due.`,
    });
  }

  return cards.slice(0, 4);
}

type CardProps = {
  colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  styles: Record<string, any>;
};

export function ManagerOperationsSnapshot({
  metrics,
  colors,
  darkMode,
  styles,
  onOpenBudget,
}: CardProps & {
  metrics: any;
  onOpenBudget?: () => void;
}) {
  const spentPct = Number(metrics?.spentPercentUsed || 0);
  const remaining = Math.max(
    0,
    Number(metrics?.financials?.adjustedCostBudget || metrics?.costBudgetCap || 0) -
      Number(metrics?.totalSpent || 0) -
      Number(metrics?.committedPOsTotal || 0)
  );

  return (
    <View style={styles.innerCardContainer}>
      <View style={styles.innerCard}>
        <View style={styles.overviewCardHeaderRow}>
          <View style={styles.overviewCardHeaderTitleCluster}>
            <View style={styles.iconBadge}>
              <Feather name="activity" size={16} color="#22c55e" />
            </View>
            <Text style={styles.overviewSectionTitle}>Project Operations Snapshot</Text>
          </View>
        </View>
        <MetricRow
          label="Budget used"
          value={`${spentPct.toFixed(1)}%`}
          helper="Share of approved cost budget (incl. committed POs)"
          styles={styles}
        />
        <MetricRow
          label="Spent to date"
          value={money(Number(metrics?.totalSpent || 0))}
          styles={styles}
        />
        <MetricRow
          label="Remaining cost budget"
          value={money(remaining)}
          styles={styles}
        />
        <MetricRow
          label="Committed POs"
          value={money(Number(metrics?.committedPOsTotal || 0))}
          styles={styles}
        />
        <MetricRow
          label="Schedule progress"
          value={`${Number(metrics?.scheduleProgress || 0).toFixed(0)}%`}
          styles={styles}
        />
        {onOpenBudget ? (
          <Pressable onPress={onOpenBudget} style={{ marginTop: 12 }}>
            <Text style={{ color: '#22c55e', fontWeight: '600', fontSize: 14 }}>
              Open Cost Control →
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ProjectRiskCheckCard({
  cards,
  colors,
  styles,
}: CardProps & {
  cards: OperationalRiskCard[];
}) {
  return (
    <View style={styles.innerCardContainer}>
      <View style={styles.innerCard}>
        <View style={styles.overviewCardHeaderRow}>
          <View style={styles.overviewCardHeaderTitleCluster}>
            <View style={styles.iconBadge}>
              <MaterialIcons name="warning-amber" size={16} color="#F59E0B" />
            </View>
            <Text style={styles.overviewSectionTitle}>Project Risk Check</Text>
          </View>
        </View>
        {cards.length === 0 ? (
          <Text style={[styles.overviewFhSlimBody, { color: colors.sub }]}>
            No operational risks flagged right now.
          </Text>
        ) : (
          cards.map((card) => (
            <View key={card.id} style={{ marginTop: 10 }}>
              <Text style={[styles.overviewHeroMetricLabel, { color: '#F59E0B' }]}>
                {card.title}
              </Text>
              <Text style={[styles.overviewFhSlimBody, { color: colors.sub }]}>{card.body}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export function ProjectHealthOperationalCard({
  metrics,
  colors,
  styles,
}: CardProps & { metrics: any }) {
  const scheduleLabel = metrics?.scheduleStatusLabel || 'On track';
  const costLabel = metrics?.spendingTrendCostStatus?.text || 'Stable';

  return (
    <View style={styles.innerCardContainer}>
      <View style={styles.innerCard}>
        <View style={styles.overviewCardHeaderRow}>
          <View style={styles.overviewCardHeaderTitleCluster}>
            <View style={styles.iconBadge}>
              <Feather name="heart" size={16} color="#22c55e" />
            </View>
            <Text style={styles.overviewSectionTitle}>Project Health</Text>
          </View>
        </View>
        <MetricRow label="Schedule" value={scheduleLabel} styles={styles} />
        <MetricRow label="Cost activity" value={costLabel} styles={styles} />
        <Text style={[styles.overviewFhSlimBody, { color: colors.sub, marginTop: 8 }]}>
          Operational status only — owner profit and contract pricing are not shown for your role.
        </Text>
      </View>
    </View>
  );
}

export function FieldProjectOverview({
  project,
  metrics,
  colors,
  styles,
  role,
}: CardProps & { project: any; metrics: any; role: 'foreman' | 'field' }) {
  const title = project?.title || project?.name || 'Project';
  const location =
    project?.location ||
    project?.projectData?.location ||
    project?.estimateData?.location ||
    'Address not set';

  return (
    <View style={styles.innerCardContainer}>
      <View style={styles.innerCard}>
        <Text style={styles.overviewSectionTitle}>{title}</Text>
        <Text style={[styles.overviewFhSlimBody, { color: colors.sub, marginTop: 4 }]}>
          {location}
        </Text>
        <MetricRow
          label="Schedule progress"
          value={`${Number(metrics?.scheduleProgress || 0).toFixed(0)}%`}
          styles={styles}
        />
        <MetricRow
          label="Start"
          value={metrics?.startDateDisplay || '—'}
          styles={styles}
        />
        <MetricRow
          label="End"
          value={metrics?.endDateDisplay || '—'}
          styles={styles}
        />
        <Text style={[styles.overviewFhSlimBody, { color: colors.sub, marginTop: 12 }]}>
          {role === 'foreman'
            ? 'Use Timeline and Calendar for milestones, daily logs, photos, and field updates.'
            : 'Use Timeline for assigned tasks and Calendar for your schedule. Submit receipts and photos from project tools.'}
        </Text>
      </View>
    </View>
  );
}

function MetricRow({
  label,
  value,
  helper,
  styles,
}: {
  label: string;
  value: string;
  helper?: string;
  styles: Record<string, any>;
}) {
  return (
    <View style={[styles.projectStatusMetricRow, styles.projectStatusMetricRowSpaced]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.overviewHeroMetricLabel}>{label}</Text>
        {helper ? (
          <Text style={styles.overviewFhMarginHelper}>{helper}</Text>
        ) : null}
      </View>
      <Text style={styles.overviewHeroMetricValueSecondary}>{value}</Text>
    </View>
  );
}

export function MemberProjectStatusCard({
  metrics,
  styles,
  showCostBudget = true,
}: {
  metrics: any;
  styles: Record<string, any>;
  showCostBudget?: boolean;
}) {
  return (
    <View style={styles.innerCardContainer}>
      <View style={styles.innerCard}>
        <View style={styles.overviewCardHeaderRow}>
          <View style={styles.overviewCardHeaderTitleCluster}>
            <View style={styles.iconBadge}>
              <Feather name="bar-chart-2" size={16} color="#22c55e" />
            </View>
            <Text style={styles.overviewSectionTitle}>Project Status</Text>
          </View>
        </View>
        {showCostBudget ? (
          <>
            <MetricRow
              label="Cost budget used"
              value={`${Number(metrics?.spentPercentUsed || 0).toFixed(1)}%`}
              helper="Approved cost budget incl. committed POs"
              styles={styles}
            />
            <View style={styles.projectStatusBarTrack}>
              <View
                style={[
                  styles.projectStatusBarFill,
                  {
                    width: `${Math.min(100, metrics?.budgetProgress || 0)}%`,
                    backgroundColor: metrics?.budgetColor || '#22c55e',
                  },
                ]}
              />
            </View>
          </>
        ) : null}
        <MetricRow
          label="Schedule"
          value={`${Number(metrics?.scheduleProgress || 0).toFixed(0)}%`}
          styles={styles}
        />
        <View style={styles.projectStatusBarTrack}>
          <View
            style={[
              styles.projectStatusBarFill,
              {
                width: `${Math.min(100, metrics?.scheduleProgress || 0)}%`,
                backgroundColor: metrics?.daysLeftColor || '#22c55e',
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}
