import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import SpendingTrendChart from './SpendingTrendChart';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import { computeProfitForecast, computeElapsedCalendarPct } from '../src/lib/profitForecast';
import {
  computeProjectFinancials,
  sumPlannedCostFromBuckets,
  computeSpendingTrendCostStatus,
} from '../src/lib/projectFinancials';
import {
  buildSpendingTrendSamplePoints,
  resolveProjectScheduleEnd,
  resolveProjectScheduleStart,
} from '../src/lib/projectChartTimeline';

// Types for the detailed overview screen
export type ProjectOverview = {
  id: string;
  title: string;
  status: string;
  priority: string;
  risk: string;
  overallProgressPct: number;
  budgeted: number;
  spent: number;
  startISO: string;
  endISO: string;
  crewCount: number;
  lastUpdated: string;
  updatedAt?: string;
  buckets: {
    id: string;
    name: string;
    spent: number;
    budget: number;
    bidBudget?: number;
  }[];
  milestones: {
    id: string;
    name: string;
    dateISO: string;
  }[];
  team: {
    pmAssigned: boolean;
    pmName?: string;
  };
  expenses?: {
    id: string;
    category?: string;
    vendor?: string;
    material?: string;
    amount: number;
    date?: string;
    notes?: string;
    receiptUri?: string | null;
  }[];
  changeOrders?: {
    id: string;
    title?: string;
    amount: number;
    approved: boolean;
    notes?: string;
  }[];
  purchaseOrders?: {
    id: string;
    poNumber: string;
    vendor: string;
    category: string;
    amount: number;
    description?: string;
    orderDate: string;
    expectedDelivery: string;
    status: 'Pending' | 'Received' | 'Cancelled' | 'Archived';
    notes?: string;
  }[];
  paymentMilestones?: any[];
  committedPOs?: number;
  currency?: string;
  health: {
    costEfficiency: string;
    scheduleEfficiency: string;
    projectStatus: string;
  };
};

// Circular Progress Component
const CircularProgress = ({
  progress,
  size = 60,
  strokeWidth = 6,
  color = '#22C55E',
  trackColor,
  darkMode = true,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  darkMode?: boolean;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={
          trackColor ?? (darkMode ? "rgba(255,255,255,0.18)" : "#CBD5E1")
        }
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

interface OverviewScreenProps {
  project: ProjectOverview;
  theme?: 'dark' | 'light';
  onAssignPM?: () => void;
  onAddCrew?: () => void;
  onEditProject?: () => void;
  onAddExpense?: () => void;
  onUpdateProgress?: () => void;
  onSendUpdate?: () => void;
  onGenerateReport?: () => void;
}

export default function OverviewScreen({
  project,
  theme = 'dark',
}: OverviewScreenProps) {
  const { theme: themeContext, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const styles = useMemo(() => getStyles(Colors, darkMode), [Colors, darkMode]);
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysLeft = () => {
    if (project.milestones && project.milestones.length > 0) {
      const latestMilestone = project.milestones.reduce((latest, milestone) => {
        const milestoneDate = new Date(milestone.dateISO || new Date());
        const latestDate = new Date(latest.dateISO || new Date());
        return milestoneDate > latestDate ? milestone : latest;
      });

      const endDate = new Date(latestMilestone.dateISO || new Date());
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }

    const endDate = new Date(project.endISO || new Date().toISOString());
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const expensesTotal = (project.expenses || []).reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const bucketSpentTotal = (project.buckets || []).reduce(
    (sum, bucket) => sum + Number(bucket.spent || 0),
    0
  );

  const plannedFromBuckets = useMemo(() => {
    const buckets = project.buckets || [];
    const relevantBuckets = buckets.filter(
      (bucket) =>
        bucket.name === 'Materials/Equipment' || bucket.name === 'Labor'
    );
    return relevantBuckets.reduce((sum, l) => sum + Number(l.budget || 0), 0);
  }, [project.buckets]);

  const financials = useMemo(
    () =>
      computeProjectFinancials(project, {
        plannedFromBuckets,
        plannedCostBucketSum: sumPlannedCostFromBuckets(project.buckets),
      }),
    [project, plannedFromBuckets]
  );

  const approvedChangeOrdersTotal = financials.approvedChangeOrderRevenue;

  // Calculate Purchase Orders total - ONLY includes PENDING POs (matches BudgetTab logic)
  // Logic: Pending POs → Committed POs, Received POs → Actual Expenses, Cancelled → Nothing
  const purchaseOrdersTotal = (() => {
    const rawPOs = project.purchaseOrders || [];
    
    // ONLY include Pending POs (exclude Received and Cancelled)
    const pendingPOs = rawPOs.filter((po: any) => po.status === 'Pending');
    
    const poObjectsTotal = pendingPOs.reduce((sum: number, po: any) => {
      let amount = 0;
      if (typeof po.amount === 'string') {
        amount = parseFloat(po.amount) || 0;
      } else if (typeof po.amount === 'number') {
        amount = po.amount;
      } else {
        amount = Number(po.amount) || 0;
      }
      return sum + amount;
    }, 0);
    
    return poObjectsTotal;
  })();

  // Calculate Received Purchase Orders total (to include in Actual Expenses)
  const receivedPOsTotal = (() => {
    const rawPOs = project.purchaseOrders || [];
    const receivedPOs = rawPOs.filter((po: any) => po.status === 'Received');
    
    return receivedPOs.reduce((sum: number, po: any) => {
      let amount = 0;
      if (typeof po.amount === 'string') {
        amount = parseFloat(po.amount) || 0;
      } else if (typeof po.amount === 'number') {
        amount = po.amount;
      } else {
        amount = Number(po.amount) || 0;
      }
      return sum + amount;
    }, 0);
  })();

  // Actual Expenses = Regular expenses + Received POs (matches BudgetTab: prefer spent over expenses)
  const actualSpent = (() => {
    const baseExpenses = Number(project.spent ?? 0) > 0
      ? Number(project.spent ?? 0)
      : expensesTotal > 0
      ? expensesTotal
      : bucketSpentTotal;
    
    return baseExpenses + receivedPOsTotal;
  })();

  const costBudgetCap = financials.adjustedCostBudget;
  // Remaining cost budget: actual + pending POs vs planned cost (not contract sell price)
  const budgetDeltaRaw = costBudgetCap - actualSpent - purchaseOrdersTotal;
  const isUnderBudget = budgetDeltaRaw >= 0;

  const getBudgetProgress = () => {
    if (!costBudgetCap || costBudgetCap <= 0) return 0;
    const totalCommitted = actualSpent + purchaseOrdersTotal;
    const progress = (totalCommitted / costBudgetCap) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const getScheduleProgress = () => {
    if (project.overallProgressPct !== undefined && project.overallProgressPct !== null) {
      return Math.min(100, Math.max(0, project.overallProgressPct));
    }

    const startDate = new Date(project.startISO || new Date().toISOString());
    const endDate = new Date(project.endISO || new Date().toISOString());
    const today = new Date();

    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();

    if (totalDuration <= 0) return 0;
    const progress = (elapsed / totalDuration) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const getDaysLeftColor = (days: number | null | undefined) => {
    if (days == null) return '#22c55e';
    if (days <= 0) return '#ef4444'; // red: overdue
    if (days < 30) return '#f59e0b'; // yellow: getting close
    return '#22c55e'; // green: plenty of time
  };

  const getBudgetColor = (budgetUsed: number) => {
    if (budgetUsed < 50) return '#22C55E';
    if (budgetUsed < 80) return '#F97316';
    return '#EF4444';
  };

  const getStatusColor = (status: string) => {
    const normalized = status?.toLowerCase() || '';
    if (normalized.includes('good') || normalized.includes('on track')) return '#22c55e';
    if (normalized.includes('risk') || normalized.includes('at risk')) return '#f59e0b';
    if (normalized.includes('critical') || normalized.includes('behind')) return '#ef4444';
    return '#9ca3af';
  };

  /** Cumulative spend from estimate/project start through today (shared with Budget). */
  const generateSpendingData = (proj: ProjectOverview) =>
    buildSpendingTrendSamplePoints(proj as unknown as Record<string, unknown>, Number(proj.spent || 0));

  const budgetProgress = getBudgetProgress();
  const scheduleProgress = getScheduleProgress();
  const daysLeft = getDaysLeft();
  const lastUpdated = project.lastUpdated
    ? formatDate(project.lastUpdated)
    : 'Invalid Date';
  const projectStatus = String((project as any)?.status ?? '').toLowerCase();
  const isProjectCompleted = projectStatus === 'completed';
  const progressForForecast = isProjectCompleted ? 100 : (project.overallProgressPct ?? 0);
  const elapsedTimePct = computeElapsedCalendarPct(project.startISO, project.endISO);
  const profitForecast = computeProfitForecast({
    contractValue: financials.adjustedContractValue,
    adjustedBudget:
      financials.adjustedCostBudget > 0
        ? financials.adjustedCostBudget
        : financials.adjustedContractValue,
    estimatedCostBaseline:
      financials.plannedCostBudget > 0 ? financials.plannedCostBudget : undefined,
    actualExpenses: actualSpent,
    committedPOs: purchaseOrdersTotal,
    progressPct: progressForForecast,
    elapsedTimePct,
    isCompleted: isProjectCompleted,
  });

  const spendingTrendCostStatus = useMemo(
    () =>
      computeSpendingTrendCostStatus({
        spendCap: financials.adjustedCostBudget,
        actualCosts: actualSpent,
        committedPOs: purchaseOrdersTotal,
        forecastFinalCost: profitForecast.forecastFinalCost,
      }),
    [
      financials.adjustedCostBudget,
      actualSpent,
      purchaseOrdersTotal,
      profitForecast.forecastFinalCost,
    ]
  );
  const profitStatusColor =
    profitForecast.status === 'Strong' ? '#22C55E' :
    profitForecast.status === 'Healthy' ? '#10B981' :
    profitForecast.status === 'Tight' ? '#F59E0B' :
    profitForecast.status === 'At Risk' ? '#F97316' : '#EF4444';

  return (
    <ScrollView 
      showsVerticalScrollIndicator={false} 
      contentContainerStyle={styles.scrollContent}
      style={darkMode ? undefined : { backgroundColor: '#FFFFFF' }}
    >
      {/* PROJECT SUMMARY CARD */}
      <LinearGradient
        colors={
          Colors.bg === "#000000"
            ? ["#2DFFC4", "#00A6FF"]
            : ["rgba(45, 255, 196, 0.3)", "rgba(0, 166, 255, 0.3)"]
        }
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={{
          borderRadius: 20,
          padding: 1,
          marginBottom: 16,
        }}
      >
        <View
          style={[
            styles.card,
            Colors.bg === "#000000" ? {} : { backgroundColor: Colors.surface2 },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.iconBadge}>
                <Feather name="info" size={16} color="#22c55e" />
              </View>
              <Text style={styles.cardTitle}>{project.title || 'Untitled Project'}</Text>
            </View>
          </View>

          <Text style={styles.cardSubtitle}>Updated {lastUpdated}</Text>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.metricLabel}>Planned Cost Budget</Text>
          <Text style={styles.metricValue}>
            {formatMoney(costBudgetCap)}
            </Text>
          </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.metricLabel}>Spent So Far</Text>
          <Text style={styles.metricValue}>
            {formatMoney(actualSpent)}
          </Text>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.metricLabel}>Remaining Cost Budget</Text>
          <Text style={[styles.metricValue, { color: isUnderBudget ? '#38BDF8' : '#EF4444' }]}>
            {formatMoney(budgetDeltaRaw)}
          </Text>
        </View>
        </View>
      </LinearGradient>

      {/* PROJECT STATUS CARD */}
      <LinearGradient
        colors={["#2DFFC4", "#00A6FF"]}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={{
          borderRadius: 20,
          padding: 1,
          marginBottom: 16,
        }}
      >
        <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.iconBadge}>
              <Feather name="bar-chart-2" size={16} color="#22c55e" />
            </View>
            <Text style={styles.cardTitle}>Project Status</Text>
          </View>
        </View>

          <View style={styles.projectStatusStatusRow}>
            <View style={styles.statusChipCompact}>
              <Text style={[styles.statusChipCompactText, { color: getStatusColor(project.health.projectStatus) }]}>
                {project.health.projectStatus || 'On Track'}
              </Text>
              <Text style={styles.statusChipCompactDot}> · </Text>
              <Text style={[styles.statusChipCompactText, { color: daysLeft <= 0 ? '#ef4444' : daysLeft < 30 ? '#f59e0b' : getStatusColor(project.health.projectStatus) }]}>
                {daysLeft}d left
              </Text>
            </View>
          </View>

          <View style={styles.projectStatusMetrics}>
            <View style={styles.projectStatusMetricRow}>
              <View>
                <Text style={styles.projectStatusMetricLabel}>Cost Budget Used</Text>
                <Text style={[styles.projectStatusMetricLabel, { fontSize: 10, opacity: 0.7, marginTop: 1, fontWeight: '400' }]}>Percent of planned cost budget used (incl. committed POs)</Text>
              </View>
              <Text style={[styles.projectStatusMetricValue, { color: Colors.text }]}>{budgetProgress.toFixed(0)}%</Text>
            </View>
            <View style={styles.projectStatusBarTrack}>
              <View style={[styles.projectStatusBarFill, { width: `${Math.min(100, budgetProgress)}%`, backgroundColor: getBudgetColor(budgetProgress) }]} />
            </View>

            <View style={[styles.projectStatusMetricRow, { marginTop: 16 }]}>
              <Text style={styles.projectStatusMetricLabel}>Schedule</Text>
              <Text style={[styles.projectStatusMetricValue, { color: Colors.text }]}>{scheduleProgress.toFixed(0)}%</Text>
            </View>
            <View style={styles.projectStatusBarTrack}>
              <View style={[styles.projectStatusBarFill, { width: `${Math.min(100, scheduleProgress)}%`, backgroundColor: getDaysLeftColor(daysLeft) }]} />
            </View>
          </View>

          <View style={styles.projectStatusDivider} />

          <View style={styles.projectStatusDates}>
            <View style={styles.projectStatusDateRow}>
              <Text style={styles.projectStatusDateLabel}>Start</Text>
              <Text style={[styles.projectStatusDateValue, { color: Colors.text }]}>{formatDate(project.startISO)}</Text>
            </View>
            <View style={styles.projectStatusDateRow}>
              <Text style={styles.projectStatusDateLabel}>End</Text>
              <Text style={[styles.projectStatusDateValue, { color: Colors.text }]}>{formatDate(project.endISO)}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* FINANCIAL HEALTH CARD */}
      <LinearGradient
        colors={["#2DFFC4", "#00A6FF"]}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={{
          borderRadius: 20,
          padding: 1,
          marginBottom: 16,
        }}
      >
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.iconBadge}>
                <Feather name="activity" size={16} color="#22c55e" />
              </View>
              <Text style={styles.cardTitle}>Financial Health</Text>
            </View>
            <View style={{ backgroundColor: `${profitStatusColor}22`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={{ color: profitStatusColor, fontWeight: '700', fontSize: 12 }}>{profitForecast.status}</Text>
            </View>
          </View>
          <View style={styles.budgetDetails}>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Contract Value</Text>
              <Text style={styles.budgetValue}>{formatMoney(financials.contractValueBase)}</Text>
            </View>
            {approvedChangeOrdersTotal > 0 && (
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>Approved Change Orders</Text>
                <Text style={styles.budgetValue}>{formatMoney(approvedChangeOrdersTotal)}</Text>
              </View>
            )}
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Adjusted Contract Value</Text>
              <Text style={styles.budgetValue}>{formatMoney(financials.adjustedContractValue)}</Text>
            </View>
            <View style={[styles.budgetRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.line }]}>
              <Text style={styles.budgetLabel}>Planned Cost Budget</Text>
              <Text style={styles.budgetValue}>{formatMoney(financials.adjustedCostBudget)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <View>
                <Text style={styles.budgetLabel}>Projected Final Cost</Text>
                {profitForecast.forecastMethod === 'run-rate' && (
                  <Text style={[styles.budgetLabel, { fontSize: 11, opacity: 0.8, marginTop: 1 }]}>Trend forecast</Text>
                )}
                {profitForecast.forecastMethod === 'completed' && (
                  <Text style={[styles.budgetLabel, { fontSize: 11, opacity: 0.8, marginTop: 1 }]}>Actual (job complete)</Text>
                )}
              </View>
              <Text style={[styles.budgetValue, { color: '#EF4444' }]}>{formatMoney(profitForecast.forecastFinalCost)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Projected Profit</Text>
              <Text style={[styles.budgetValue, { color: profitForecast.projectedProfit >= 0 ? '#22c55e' : '#EF4444' }]}>
                {formatMoney(profitForecast.projectedProfit)}
              </Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Spend-to-Date Margin</Text>
              <Text style={[styles.budgetValue, { color: profitStatusColor }]}>
                {(profitForecast.spendToDateMarginPct ?? 0).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.budgetRow}>
              <View>
                <Text style={styles.budgetLabel}>Projected Margin</Text>
                <Text style={[styles.budgetLabel, { fontSize: 11, opacity: 0.8, marginTop: 1 }]}>Based on current spend vs completion progress</Text>
              </View>
              <Text style={[styles.budgetValue, { color: profitStatusColor }]}>
                {profitForecast.projectedMarginPct.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* SPENDING TREND CARD */}
      <LinearGradient
        colors={["#2DFFC4", "#00A6FF"]}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={{
          borderRadius: 20,
          padding: 1,
          marginBottom: 16,
        }}
      >
        <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.iconBadge}>
              <Feather name="trending-up" size={16} color="#22c55e" />
            </View>
            <Text style={styles.cardTitle}>Spending Trend</Text>
          </View>
          </View>

          {(() => {
            const spendingData = generateSpendingData({ ...project, spent: actualSpent });
            const formatLabel = (d: Date) =>
              d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
            const points: { ts: number; label: string; spent: number }[] = spendingData.map((p) => {
              const d = new Date(p.date + (p.date.includes('T') ? '' : 'T12:00:00'));
              return { ts: d.getTime(), label: formatLabel(d), spent: p.spent ?? 0 };
            });
            const labels = points.map((p) => p.label);
            const actualValues = points.map((p) => p.spent);
            const actualCumulative = labels.map((label, idx) => ({
              label,
              value: actualValues[idx] ?? 0,
            }));

            const projectStart = resolveProjectScheduleStart(project as unknown as Record<string, unknown>);
            const projectEnd = resolveProjectScheduleEnd(project as unknown as Record<string, unknown>);
            const totalSpanMs = Math.max(1, projectEnd.getTime() - projectStart.getTime());
            const adj = Number(costBudgetCap || 0);
            const plannedCumulative = points.map((p) => {
              const frac = Math.min(1, Math.max(0, (p.ts - projectStart.getTime()) / totalSpanMs));
              return { label: p.label, value: Math.round(adj * frac) };
            });

            return (
          <SpendingTrendChart
                actualCumulative={actualCumulative}
                plannedCumulative={plannedCumulative}
                totalBudget={adj}
                showHeader={false}
                showLegend={true}
                scrollable
                costBudgetStatus={spendingTrendCostStatus}
          />
            );
          })()}
        </View>
      </LinearGradient>

      {/* BUDGET SUMMARY CARD */}
      <LinearGradient
        colors={["#2DFFC4", "#00A6FF"]}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={{
          borderRadius: 20,
          padding: 1,
          marginBottom: 16,
        }}
      >
        <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.iconBadge}>
              <Feather name="dollar-sign" size={16} color="#22c55e" />
          </View>
            <Text style={styles.cardTitle}>Budget Summary</Text>
            </View>
          </View>

          <View style={styles.budgetDetails}>
            <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Contract Value</Text>
            <Text style={styles.budgetValue}>
                {formatMoney(financials.contractValueBase)}
              </Text>
            </View>

            {approvedChangeOrdersTotal > 0 && (
              <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Approved Change Orders</Text>
              <Text style={styles.budgetValue}>
                  {formatMoney(approvedChangeOrdersTotal)}
                </Text>
              </View>
            )}

            <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Adjusted Contract Value</Text>
            <Text style={styles.budgetValue}>
                {formatMoney(financials.adjustedContractValue)}
              </Text>
            </View>

            <View style={[styles.budgetRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.line }]}>
            <Text style={styles.budgetLabel}>Planned Cost Budget</Text>
            <Text style={styles.budgetValue}>
                {formatMoney(financials.adjustedCostBudget)}
              </Text>
            </View>

            <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Actual Costs</Text>
            <Text style={[styles.budgetValue, { color: '#22c55e' }]}>
                {formatMoney(actualSpent)}
              </Text>
            </View>

            {purchaseOrdersTotal > 0 && (
              <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Committed POs</Text>
              <Text style={styles.budgetValue}>
                  {formatMoney(purchaseOrdersTotal)}
                </Text>
              </View>
            )}

            <View style={[styles.budgetRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.line }]}>
              <View>
                <Text style={styles.budgetLabel}>Forecast Final Cost</Text>
                {profitForecast.forecastMethod === 'run-rate' && (
                  <Text style={[styles.budgetLabel, { fontSize: 11, opacity: 0.8, marginTop: 1 }]}>Trend forecast</Text>
                )}
                {profitForecast.forecastMethod === 'completed' && (
                  <Text style={[styles.budgetLabel, { fontSize: 11, opacity: 0.8, marginTop: 1 }]}>Actual (job complete)</Text>
                )}
              </View>
              <Text style={[styles.budgetValue, { color: '#EF4444' }]}>{formatMoney(profitForecast.forecastFinalCost)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Projected Profit</Text>
              <Text style={[styles.budgetValue, { color: profitForecast.projectedProfit >= 0 ? '#22c55e' : '#EF4444' }]}>
                {formatMoney(profitForecast.projectedProfit)}
              </Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Spend-to-Date Margin</Text>
              <Text style={[styles.budgetValue, { color: profitStatusColor }]}>
                {(profitForecast.spendToDateMarginPct ?? 0).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.budgetRow}>
              <View>
                <Text style={styles.budgetLabel}>Projected Margin</Text>
                <Text style={[styles.budgetLabel, { fontSize: 11, opacity: 0.8, marginTop: 1 }]}>Based on current spend vs completion progress</Text>
              </View>
              <Text style={[styles.budgetValue, { color: profitStatusColor }]}>
                {profitForecast.projectedMarginPct.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Profit Variance vs Estimate</Text>
              <Text style={[styles.budgetValue, { color: profitForecast.profitVarianceVsEstimate <= 0 ? '#EF4444' : '#22c55e' }]}>
                {formatMoney(profitForecast.profitVarianceVsEstimate)}
              </Text>
            </View>

            <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Remaining Cost Budget</Text>
            <Text style={[
                  styles.budgetValue,
              { color: isUnderBudget ? Colors.text : '#EF4444' }
            ]}>
                {formatMoney(budgetDeltaRaw)}
              </Text>
            </View>
          </View>

        {project.buckets && project.buckets.length > 0 && (
          <View style={styles.budgetBreakdown}>
            {project.buckets.map(bucket => {
              const bucketProgress = bucket.budget > 0 
                ? (bucket.spent / bucket.budget) * 100 
                : 0;
              return (
              <View key={bucket.id} style={styles.bucketRow}>
                  <View style={styles.bucketHeader}>
                    <Text style={styles.bucketName}>{bucket.name}</Text>
                    <Text style={styles.bucketAmount}>
                  {formatMoney(bucket.spent)} / {formatMoney(bucket.budget)}
                </Text>
                  </View>
                  <View style={styles.bucketProgress}>
                  <View
                    style={[
                      styles.bucketProgressFill,
                      {
                          width: `${Math.min(100, Math.max(0, bucketProgress))}%`,
                          backgroundColor: '#19E180',
                      },
                    ]}
                  />
                </View>
              </View>
              );
            })}
          </View>
        )}
        </View>
      </LinearGradient>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const getStyles = (Colors: any, darkMode: boolean) => StyleSheet.create({
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 120,
  },
  // Cards - matching dashboard exactly
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: Colors.card,
    marginBottom: 0,
    shadowColor: darkMode ? "#000" : "#0F172A",
    shadowOpacity: darkMode ? 0.4 : 0.05,
    shadowRadius: darkMode ? 18 : 10,
    shadowOffset: { width: 0, height: 10 },
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: darkMode ? "700" : "800",
    color: Colors.text,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: darkMode ? Colors.subtext : "#475569",
  },
  metricLabel: {
    fontSize: 12,
    color: darkMode ? '#F3F4F6' : '#475569',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  chartLegendRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 8,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00FF9D',
  },
  chartLegendDotSecondary: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00CADA',
  },
  chartLegendLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Status
  statusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusChipCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusChipCompactText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusChipCompactDot: {
    fontSize: 12,
    color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
    fontWeight: '400',
  },
  projectStatusStatusRow: {
    marginTop: 16,
  },
  projectStatusMetrics: {
    marginTop: 24,
  },
  projectStatusMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  projectStatusMetricLabel: {
    fontSize: 14,
    color: darkMode ? '#FFFFFF' : '#475569',
    fontWeight: '500',
  },
  projectStatusMetricValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  projectStatusBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  projectStatusBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  projectStatusDivider: {
    height: 1,
    backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    marginTop: 24,
    marginBottom: 20,
  },
  projectStatusDates: {
    gap: 12,
  },
  projectStatusDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectStatusDateLabel: {
    fontSize: 14,
    color: darkMode ? '#FFFFFF' : '#475569',
    fontWeight: '500',
  },
  projectStatusDateValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusSpacer: {
    width: 8,
  },
  daysLeftBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  daysLeftText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusRight: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  progressCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 12,
    color: darkMode ? '#F3F4F6' : '#475569',
    marginTop: 8,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 14,
    color: darkMode ? Colors.text : Colors.subtext,
    marginTop: 4,
    fontWeight: '700',
  },
  // Budget
  budgetDetails: {
    marginTop: 8,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 14,
    color: darkMode ? '#F3F4F6' : '#475569',
  },
  budgetValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  budgetBreakdown: {
    marginTop: 16,
    gap: 12,
  },
  bucketRow: {
    gap: 6,
  },
  bucketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bucketName: {
    fontSize: 14,
    fontWeight: '600',
    color: darkMode ? '#F3F4F6' : '#475569',
  },
  bucketAmount: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
  },
  bucketProgress: {
    height: 6,
    borderRadius: 999,
    backgroundColor: darkMode ? '#1B2938' : '#CBD5E1',
    overflow: 'hidden',
  },
  bucketProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  // Timeline
  timelineDetails: {
    marginTop: 8,
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineLabel: {
    fontSize: 14,
    color: darkMode ? '#F3F4F6' : '#475569',
  },
  timelineValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  timelineProgress: {
    gap: 4,
  },
  timelineBar: {
    height: 6,
    borderRadius: 999,
    backgroundColor: darkMode ? '#1B2938' : '#CBD5E1',
    overflow: 'hidden',
  },
  timelineBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timelineLabelText: {
    fontSize: 12,
    color: darkMode ? '#F3F4F6' : '#475569',
  },
  // Health
  healthDetails: {
    marginTop: 8,
    gap: 12,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthLabel: {
    fontSize: 14,
    color: darkMode ? '#F3F4F6' : '#475569',
  },
  healthValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Team
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  teamLabel: {
    fontSize: 14,
    color: darkMode ? '#F3F4F6' : '#475569',
  },
  teamValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginLeft: 16,
    textAlign: 'right',
  },
});
