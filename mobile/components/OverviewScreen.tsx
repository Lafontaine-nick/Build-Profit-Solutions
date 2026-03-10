import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import SpendingTrendChart from './SpendingTrendChart';
import { useTheme } from '../contexts/ThemeContext';
import { getColors } from '../theme/getColors';
import { computeProfitForecast } from '../src/lib/profitForecast';

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
    status: 'Pending' | 'Received' | 'Cancelled';
    notes?: string;
  }[];
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

  // Get base budget (original budget without change orders) - matching BudgetTab and Projects page priority order
  // CRITICAL: Must use estimate's grandTotal (what user saw in estimate), NOT budgeted (may include COs)
  const getBaseBudget = (proj: any): number => {
    // Priority order matches BudgetTab and Projects page to ensure consistency:
    // 1. estimateData.grandTotal (PRIMARY - this is what shows in estimate, e.g. $7,200)
    // 2. estimateData.bidPrice (secondary estimate field)
    // 3. estimateData.total (tertiary estimate field)
    // 4. bidPrice (project-level, should match estimate)
    // 5. projectData.bidPrice (projectData level)
    // 6. estimatedCost (fallback)
    // DO NOT use budgeted or projectData.budgeted as they may already include approved change orders
    const budgetCandidates: any[] = [
      proj?.estimateData?.grandTotal,      // PRIMARY: estimate's grandTotal ($7,200)
      proj?.estimateData?.bidPrice,        // Secondary: estimate's bidPrice
      proj?.estimateData?.total,          // Tertiary: estimate's total
      proj?.bidPrice,                     // Fallback: project bidPrice
      proj?.projectData?.bidPrice,         // Fallback: projectData bidPrice
      proj?.projectData?.totalBidPrice,   // Fallback: projectData totalBidPrice
      proj?.estimatedCost,                // Fallback: estimatedCost
      proj?.projectData?.estimatedCost,   // Fallback: projectData estimatedCost
      proj?.total,                        // Fallback: project total
      proj?.totalRevenue,                 // Fallback: totalRevenue
      proj?.contractValue,                // Fallback: contractValue
    ];
    
    for (const candidate of budgetCandidates) {
      const sanitized = candidate != null ? Number(candidate) : 0;
      if (sanitized > 0) {
        return sanitized;
      }
    }
    return 0;
  };

  // Collect change orders from all possible locations (matching Projects page logic)
  const changeOrderSources = [
    project?.projectData?.changeOrders,
    project?.changeOrders,
  ];
  
  let changeOrders: any[] = [];
  for (const source of changeOrderSources) {
    if (Array.isArray(source) && source.length > 0) {
      changeOrders = source;
      break;
    }
  }

  const approvedChangeOrdersTotal = changeOrders.reduce(
    (sum, co) => {
      const amount = Number(co.amount ?? co.clientPrice ?? co.cost ?? 0);
      const isApproved =
        (typeof co.approved === 'boolean' && co.approved) ||
        (typeof co.status === 'string' && co.status.toLowerCase() === 'approved');
      return isApproved ? sum + amount : sum;
    },
    0
  );

  const baseBudget = getBaseBudget(project);
  const adjustedBudget = baseBudget + approvedChangeOrdersTotal;

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

  // Actual Expenses = Regular expenses + Received Purchase Orders
  const actualSpent = (() => {
    const baseExpenses = expensesTotal > 0
      ? expensesTotal
      : Number(project.spent ?? 0) > 0
      ? Number(project.spent ?? 0)
      : bucketSpentTotal;
    
    return baseExpenses + receivedPOsTotal;
  })();

  // Remaining budget accounts for both actual expenses and committed POs (matches BudgetTab)
  const budgetDeltaRaw = adjustedBudget - actualSpent - purchaseOrdersTotal;
  const isUnderBudget = budgetDeltaRaw >= 0;

  const getBudgetProgress = () => {
    if (!adjustedBudget || adjustedBudget <= 0) return 0;
    // Budget progress includes both actual spent and committed POs
    const totalCommitted = actualSpent + purchaseOrdersTotal;
    const progress = (totalCommitted / adjustedBudget) * 100;
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

  const getProgressColor = (progress: number) => {
    if (progress < 50) return '#F97316';
    if (progress < 80) return '#FACC15';
    return '#22C55E';
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

  // Helper to generate spending data for the chart
  const generateSpendingData = (proj: ProjectOverview) => {
    const start = new Date(proj.startISO || new Date().toISOString());
    const end = new Date(proj.endISO || new Date().toISOString());
    const currentSpent = Number(proj.spent || 0);

    const numPoints = 7;
    const timeSpan = end.getTime() - start.getTime();
    const now = Date.now();
    const currentProgress = Math.min((now - start.getTime()) / timeSpan, 1);

    const points: { date: string; spent: number }[] = [];
    for (let i = 0; i <= numPoints; i++) {
      const progress = (i / numPoints) * currentProgress;
      const date = new Date(start.getTime() + timeSpan * progress);
      const spent = Math.round(currentSpent * (progress / Math.max(currentProgress, 0.01)));

      if (spent > 0 && date <= new Date()) {
        points.push({
          date: date.toISOString().split('T')[0],
          spent,
        });
      }
    }

    if (points.length === 0 || points[points.length - 1].spent !== currentSpent) {
      points.push({
        date: new Date().toISOString().split('T')[0],
        spent: currentSpent,
      });
    }

    return points;
  };

  const budgetProgress = getBudgetProgress();
  const scheduleProgress = getScheduleProgress();
  const daysLeft = getDaysLeft();
  const lastUpdated = project.lastUpdated
    ? formatDate(project.lastUpdated)
    : 'Invalid Date';
  // Contract value = revenue (bid + approved COs), NOT cost. Using adjustedBudget gave 0 profit.
  let baseBid = (() => {
    const candidates = [
      project?.estimateData?.grandTotal,
      project?.estimateData?.bidPrice,
      project?.estimateData?.total,
      project?.bidPrice,
      (project as any)?.projectData?.bidPrice,
    ];
    for (const c of candidates) {
      const n = c != null ? Number(c) : 0;
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  })();
  // Fallback: derive bid from cost + margin when bid is missing. Default 10% if no margin.
  if (baseBid == null && baseBudget > 0) {
    const marginPct = Number(project?.margin ?? project?.estimateData?.marginPct ?? project?.estimateData?.margin ?? 0);
    const effectiveMargin = marginPct > 0 && marginPct < 100 ? marginPct : 10;
    baseBid = baseBudget / (1 - effectiveMargin / 100);
  }
  const contractValue = baseBid != null && baseBid > 0 ? baseBid + approvedChangeOrdersTotal : adjustedBudget;
  // Cost baseline = materials + labor + overhead (incl. plans & permits) from estimate
  const ed = project?.estimateData;
  const estimateCostFromParts =
    Number(ed?.materials || 0) +
    Number(ed?.labor || 0) +
    Number(ed?.equipment || 0) +
    Number(ed?.facilities || 0) +
    Number(ed?.insuranceOverhead || 0) +
    Number(ed?.otherOverhead || 0) +
    Number(ed?.planCost || 0) +
    Number(ed?.permitCost || 0);
  let costBase = Number(
    ed?.estimatedCost ??
    ed?.subtotal ??
    project?.estimatedCost ??
    ed?.totalCost ??
    ed?.baseCost ??
    (estimateCostFromParts > 0 ? estimateCostFromParts : null) ??
    0
  );
  if (costBase <= 0 && baseBid != null && baseBid > 0) {
    const marginPct = Number(project?.margin ?? ed?.marginPct ?? ed?.margin ?? 0);
    if (marginPct > 0 && marginPct < 100) costBase = baseBid * (1 - marginPct / 100);
    else costBase = baseBid / 1.18;
  }
  if (costBase <= 0) costBase = baseBudget;
  const costBaseline = costBase + approvedChangeOrdersTotal;
  const profitForecast = computeProfitForecast({
    contractValue,
    adjustedBudget: costBaseline > 0 ? costBaseline : adjustedBudget,
    estimatedCostBaseline: costBase > 0 ? costBase : undefined,
    actualExpenses: actualSpent,
    committedPOs: purchaseOrdersTotal,
    progressPct: project.overallProgressPct,
  });
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
          <Text style={styles.metricLabel}>Budget</Text>
          <Text style={styles.metricValue}>
            {formatMoney(adjustedBudget)}
            </Text>
          </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.metricLabel}>Spent So Far</Text>
          <Text style={styles.metricValue}>
            {formatMoney(actualSpent)}
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

          <View style={styles.statusContent}>
            <View style={styles.statusLeft}>
            <View style={[
              styles.statusChip,
              { backgroundColor: getStatusColor(project.health.projectStatus) + '20' }
            ]}>
              <Text style={[
                styles.statusChipText,
                { color: getStatusColor(project.health.projectStatus) }
              ]}>
                {project.health.projectStatus || 'On Track'}
              </Text>
              </View>

              <View style={styles.statusSpacer} />

            <View style={[styles.daysLeftBadge, { backgroundColor: '#ef4444' }]}>
              <Text style={styles.daysLeftText}>
                {daysLeft} days left
              </Text>
              </View>
            </View>

            <View style={styles.statusRight}>
              <View style={styles.progressCircle}>
                      <CircularProgress
                        progress={budgetProgress}
                        color={getBudgetColor(budgetProgress)}
                        darkMode={darkMode}
                        trackColor={darkMode ? "rgba(255,255,255,0.18)" : Colors.subtext}
                      />
              <Text style={styles.progressText}>Budget Used</Text>
              <Text style={styles.progressPercent}>
                {budgetProgress.toFixed(0)}%
                </Text>
              </View>

              <View style={styles.progressCircle}>
                      <CircularProgress
                        progress={scheduleProgress}
                        color={getProgressColor(scheduleProgress)}
                        darkMode={darkMode}
                        trackColor={darkMode ? "rgba(255,255,255,0.18)" : Colors.subtext}
                      />
              <Text style={styles.progressText}>Schedule</Text>
              <Text style={styles.progressPercent}>
                {scheduleProgress.toFixed(0)}%
                </Text>
              </View>
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
              <Text style={styles.budgetValue}>{formatMoney(profitForecast.contractValue)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Projected Final Cost</Text>
              <Text style={styles.budgetValue}>{formatMoney(profitForecast.forecastFinalCost)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Projected Profit</Text>
              <Text style={[styles.budgetValue, { color: profitForecast.projectedProfit >= 0 ? '#22c55e' : '#EF4444' }]}>
                {formatMoney(profitForecast.projectedProfit)}
              </Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Projected Margin</Text>
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
            const labels = spendingData.map((point) => {
              const date = new Date(point.date);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            });
            const actualCumulative = labels.map((label, idx) => ({
              label,
              value: spendingData[idx]?.spent ?? 0,
            }));
            const plannedCumulative = labels.map((label, idx) => ({
              label,
              value: Math.round((Number(adjustedBudget || 0) * (idx + 1)) / Math.max(labels.length, 1)),
            }));

            return (
          <SpendingTrendChart
                actualCumulative={actualCumulative}
                plannedCumulative={plannedCumulative}
                totalBudget={Number(adjustedBudget || 0)}
                showHeader={false}
                showLegend={true}
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
            <Text style={styles.budgetLabel}>Base Budget</Text>
            <Text style={styles.budgetValue}>
                {formatMoney(project.budgeted)}
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
            <Text style={styles.budgetLabel}>Total Budget</Text>
            <Text style={styles.budgetValue}>
                {formatMoney(adjustedBudget)}
              </Text>
            </View>

            <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>Spent So Far</Text>
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
              <Text style={styles.budgetLabel}>Forecast Final Cost</Text>
              <Text style={styles.budgetValue}>{formatMoney(profitForecast.forecastFinalCost)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Forecast Profit</Text>
              <Text style={[styles.budgetValue, { color: profitForecast.projectedProfit >= 0 ? '#22c55e' : '#EF4444' }]}>
                {formatMoney(profitForecast.projectedProfit)}
              </Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Forecast Margin</Text>
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
            <Text style={styles.budgetLabel}>Remaining</Text>
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

      {/* TIMELINE CARD */}
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
              <Feather name="calendar" size={16} color="#22c55e" />
            </View>
            <Text style={styles.cardTitle}>Timeline</Text>
          </View>
          </View>

          <View style={styles.timelineDetails}>
            <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Start</Text>
            <Text style={styles.timelineValue}>
                {formatDate(project.startISO)}
              </Text>
            </View>
            <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>End</Text>
            <Text style={styles.timelineValue}>
                {formatDate(project.endISO)}
              </Text>
            </View>
            <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Days Left</Text>
            <Text style={[
                  styles.timelineValue,
              { color: daysLeft === 0 ? '#EF4444' : Colors.text }
            ]}>
              {daysLeft} days
              </Text>
            </View>
            <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Schedule Status</Text>
            <View style={[
              styles.statusChip,
              { backgroundColor: getStatusColor(project.health.scheduleEfficiency) + '20' }
            ]}>
              <Text style={[
                styles.statusChipText,
                { color: getStatusColor(project.health.scheduleEfficiency) }
              ]}>
                  {project.health.scheduleEfficiency}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.timelineProgress}>
          <View style={styles.timelineBar}>
              <View
                style={[
                  styles.timelineBarFill,
                  {
                  width: `${Math.min(100, Math.max(0, scheduleProgress))}%`,
                  backgroundColor: '#19E180',
                  },
                ]}
              />
            </View>
            <View style={styles.timelineLabels}>
            <Text style={styles.timelineLabelText}>Start</Text>
            <Text style={styles.timelineLabelText}>Today</Text>
            <Text style={styles.timelineLabelText}>End</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* HEALTH CARD */}
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
            <Text style={styles.cardTitle}>Health</Text>
          </View>
          </View>

          <View style={styles.healthDetails}>
            <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Cost Efficiency</Text>
            <Text style={[
                  styles.healthValue,
              { color: getStatusColor(project.health.costEfficiency) }
            ]}>
                {project.health.costEfficiency}
              </Text>
            </View>
            <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Schedule Efficiency</Text>
            <View style={[
              styles.statusChip,
              { backgroundColor: getStatusColor(project.health.scheduleEfficiency) + '20' }
            ]}>
              <Text style={[
                styles.statusChipText,
                { color: getStatusColor(project.health.scheduleEfficiency) }
              ]}>
                  {project.health.scheduleEfficiency}
                </Text>
              </View>
            </View>
            <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Project Status</Text>
            <View style={[
              styles.statusChip,
              { backgroundColor: getStatusColor(project.health.projectStatus) + '20' }
            ]}>
              <Text style={[
                styles.statusChipText,
                { color: getStatusColor(project.health.projectStatus) }
              ]}>
                  {project.health.projectStatus}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* TEAM CARD */}
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
              <Feather name="users" size={16} color="#22c55e" />
            </View>
            <Text style={styles.cardTitle}>Team</Text>
          </View>
          </View>

          <View style={styles.teamRow}>
          <Text style={styles.teamLabel}>PM</Text>
          <Text style={[
                styles.teamValue,
            { color: project.team.pmAssigned ? Colors.text : '#F59E0B' }
          ]}>
            {project.team.pmAssigned ? (project.team.pmName || 'Assigned') : 'Not assigned'}
            </Text>
          </View>
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
    color: darkMode ? '#8DA0B8' : '#475569',
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
    color: darkMode ? '#8DA0B8' : '#475569',
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
    color: darkMode ? '#8DA0B8' : '#475569',
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
    color: darkMode ? '#8DA0B8' : '#475569',
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
    color: darkMode ? '#8DA0B8' : '#475569',
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
    color: darkMode ? '#8DA0B8' : '#475569',
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
    color: darkMode ? '#8DA0B8' : '#475569',
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
    color: darkMode ? '#8DA0B8' : '#475569',
  },
  teamValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginLeft: 16,
    textAlign: 'right',
  },
});
