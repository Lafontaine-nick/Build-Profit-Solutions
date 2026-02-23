import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import SpendingTrendChart from './SpendingTrendChart';
import { useProjectData } from '../contexts/ProjectDataContext';

// Gradient Card wrapper for green-to-blue border with black background
const GradientCard: React.FC<{
  children: React.ReactNode;
  style?: any;
  innerStyle?: any;
}> = ({ children, style = {}, innerStyle = {} }) => (
  <LinearGradient
    colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
    start={{ x: 0.05, y: 0.15 }}
    end={{ x: 0.95, y: 0.85 }}
    style={[{ borderRadius: 20, padding: 1 }, style]}
  >
    <View style={[{ backgroundColor: '#000000', borderRadius: 18, padding: 16 }, innerStyle]}>
      {children}
    </View>
  </LinearGradient>
);

// Types ------------------------------------------------------------
export type ProjectOverviewData = {
  title: string;
  status: 'Won' | 'Active' | 'On Hold' | 'Completed';
  progressPct: number; // 0..100
  budgeted: number; // planned
  spent: number; // to date
  startDate?: string; // ISO
  endDate?: string; // ISO
  daysLeft?: number;
  nextMilestone?: { title: string; date?: string };
  aheadBehindLabel?: string; // e.g., "3 Days Behind"
  costEfficiencyStatus: 'Good' | 'At Risk' | 'Critical';
  scheduleEfficiencyStatus: 'Good' | 'At Risk' | 'Critical';
  overallStatus: 'On Track' | 'At Risk' | 'Critical';
  team: { pm?: string; activeSubs?: number; crewCount?: number };
};

// Helpers ----------------------------------------------------------
const currency = (n: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { 
    style: 'currency', 
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);

function getStatusColor(status: 'Good' | 'At Risk' | 'Critical' | 'On Track') {
  switch (status) {
    case 'Good':
    case 'On Track':
      return { bg: '#065f46', text: '#6ee7b7', border: '#10b981' };
    case 'At Risk':
      return { bg: '#92400e', text: '#fbbf24', border: '#f59e0b' };
    case 'Critical':
      return { bg: '#991b1b', text: '#fca5a5', border: '#ef4444' };
  }
}

const SectionCard: React.FC<{
  title: string;
  children: React.ReactNode;
  style?: any;
}> = ({ title, children, style = {} }) => (
  <View style={[styles.sectionCard, style]}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const LabeledRow: React.FC<{ label: string; value?: React.ReactNode }> = ({
  label,
  value,
}) => (
  <View style={styles.labeledRow}>
    <Text style={styles.labelText}>{label}</Text>
    <View style={styles.valueContainer}>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={styles.valueText}>{value}</Text>
      ) : (
        value
      )}
    </View>
  </View>
);

const Bar: React.FC<{ pct: number; color?: string }> = ({
  pct,
  color = '#10b981',
}) => (
  <View style={styles.barContainer}>
    <View
      style={[
        styles.barFill,
        {
          width: `${Math.min(Math.max(pct, 0), 100)}%`,
          backgroundColor: color,
        },
      ]}
    />
  </View>
);

// Root Screen ------------------------------------------------------
export default function ProjectOverviewTab({
  data = mock,
  onAddExpense,
  onAddMilestone,
  onUploadFile,
  onSendUpdate,
  theme,
}: {
  data?: ProjectOverviewData;
  onAddExpense?: () => void;
  onAddMilestone?: () => void;
  onUploadFile?: () => void;
  onSendUpdate?: () => void;
  theme?: any;
}) {
  const { projectData } = useProjectData();
  
  // Calculate approved change orders total (matches BudgetTab logic)
  const approvedChangeOrdersTotal = useMemo(() => {
    const changeOrders = projectData?.changeOrders || [];
    return changeOrders.reduce((sum, co) => {
      const amount = Number(co.amount || 0);
      const isApproved =
        (typeof co.approved === 'boolean' && co.approved) ||
        (typeof (co as any).status === 'string' &&
          (co as any).status.toLowerCase() === 'approved');
      return isApproved ? sum + amount : sum;
    }, 0);
  }, [projectData?.changeOrders]);
  
  // Calculate purchase orders total - ONLY includes PENDING POs (matches BudgetTab logic)
  // Logic: Pending POs → Committed POs, Received POs → Actual Expenses, Cancelled → Nothing
  const purchaseOrdersTotal = useMemo(() => {
    const rawPOs = projectData?.purchaseOrders || [];
    
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
    
    // Note: Received POs become expenses and are already in data.spent
    // They should NOT be double-counted in committed POs
    
    return poObjectsTotal;
  }, [projectData?.purchaseOrders]);
  
  // Calculate Received Purchase Orders total (to include in Spent So Far)
  const receivedPOsTotal = useMemo(() => {
    const rawPOs = projectData?.purchaseOrders || [];
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
  }, [projectData?.purchaseOrders]);
  
  // Spent So Far = Regular expenses + Received Purchase Orders
  const totalSpent = (data.spent || 0) + receivedPOsTotal;
  
  // Use adjusted budget (base + approved change orders) - matches BudgetTab
  const adjustedBudget = (data.budgeted || 0) + approvedChangeOrdersTotal;
  
  // Remaining accounts for both actual expenses and committed POs (matches BudgetTab)
  const remaining = Math.max(adjustedBudget - totalSpent - purchaseOrdersTotal, 0);
  const overUnder = adjustedBudget - totalSpent - purchaseOrdersTotal; // + under, - over

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: '#000000' },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {data.title}
          </Text>
          <View style={styles.progressContainer}>
            <StatusChip status={data.status} />
            <Text style={styles.progressLabel}>Progress</Text>
            <View style={styles.progressBarContainer}>
              <Bar pct={data.progressPct} />
            </View>
            <Text style={styles.progressText}>
              {Math.round(data.progressPct)}%
            </Text>
          </View>
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {/* Budget */}
          <GradientCard>
            <Text style={styles.sectionTitle}>Budget Summary</Text>
            <LabeledRow label='Planned Budget' value={currency(data.budgeted || 0)} />
            {approvedChangeOrdersTotal > 0 && (
              <LabeledRow label='Approved Change Orders' value={`+ ${currency(approvedChangeOrdersTotal)}`} />
            )}
            <LabeledRow label='Adjusted Budget' value={currency(adjustedBudget)} />
            <LabeledRow
              label='Spent So Far'
              value={
                <Text style={styles.spentText}>{currency(totalSpent)}</Text>
              }
            />
            {purchaseOrdersTotal > 0 && (
              <LabeledRow label='Committed POs' value={currency(purchaseOrdersTotal)} />
            )}
            <View style={styles.remainingContainer}>
              <Text style={styles.remainingLabel}>Remaining</Text>
              <Bar
                pct={Math.min(
                  (remaining / Math.max(adjustedBudget, 1)) * 100,
                  100
                )}
              />
              <Text
                style={[
                  styles.overUnderText,
                  { color: overUnder >= 0 ? '#6ee7b7' : '#fca5a5' },
                ]}
              >
                {overUnder >= 0
                  ? `${currency(remaining)} available`
                  : `Over by ${currency(Math.abs(overUnder))}`}
              </Text>
            </View>
          </GradientCard>

          {/* Timeline and Health */}
          <View style={styles.twoColumnRow}>
            <GradientCard style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Timeline</Text>
              <LabeledRow label='Start' value={fmtDate(data.startDate)} />
              <LabeledRow label='End' value={fmtDate(data.endDate)} />
              {data.daysLeft !== undefined && (
                <LabeledRow label='Days Left' value={`${data.daysLeft}`} />
              )}
              {data.nextMilestone && (
                <View style={styles.milestoneContainer}>
                  <Text style={styles.milestoneLabel}>Next Milestone</Text>
                  <Text style={styles.milestoneValue} numberOfLines={2}>
                    {data.nextMilestone.title}
                    {data.nextMilestone.date
                      ? ` (${fmtDate(data.nextMilestone.date)})`
                      : ''}
                  </Text>
                </View>
              )}
              {data.aheadBehindLabel && (
                <View style={styles.aheadBehindContainer}>
                  <Text style={styles.aheadBehindLabel}>Ahead/Behind</Text>
                  <Text
                    style={[
                      styles.aheadBehindText,
                      {
                        color: data.aheadBehindLabel.includes('Behind')
                          ? '#fbbf24'
                          : '#6ee7b7',
                      },
                    ]}
                  >
                    {data.aheadBehindLabel}
                  </Text>
                </View>
              )}
            </GradientCard>

            {/* Health */}
            <GradientCard style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Health</Text>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>Cost Efficiency</Text>
                <Text
                  style={[
                    styles.healthValue,
                    { color: getStatusColor(data.costEfficiencyStatus).text },
                  ]}
                >
                  {data.costEfficiencyStatus}
                </Text>
              </View>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>Schedule Efficiency</Text>
                <Text
                  style={[
                    styles.healthValue,
                    {
                      color: getStatusColor(data.scheduleEfficiencyStatus).text,
                    },
                  ]}
                >
                  {data.scheduleEfficiencyStatus}
                </Text>
              </View>
              <View style={styles.projectStatusContainer}>
                <Text style={styles.projectStatusLabel}>Project Status</Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: getStatusColor(data.overallStatus).bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: getStatusColor(data.overallStatus).text },
                    ]}
                  >
                    {data.overallStatus}
                  </Text>
                </View>
              </View>
            </GradientCard>
          </View>

          {/* Team */}
          <GradientCard>
            <Text style={styles.sectionTitle}>Team</Text>
            <View style={styles.teamRow}>
              <View style={styles.teamColumn}>
                <LabeledRow label='PM' value={data.team.pm || '—'} />
                <LabeledRow
                  label='Active Subs'
                  value={`${data.team.activeSubs ?? 0}`}
                />
              </View>
              <View style={styles.teamColumn}>
                <LabeledRow
                  label='Crew Count'
                  value={`${data.team.crewCount ?? 0}`}
                />
              </View>
            </View>
            {/* Send Update button moved to team section */}
            <View style={styles.teamActionContainer}>
              <ActionButton
                label='Send Update'
                onPress={onSendUpdate}
                theme={theme}
              />
            </View>
          </GradientCard>

          {/* Spending Trend Chart - Replaced Quick Actions */}
          <SpendingTrendChart
            plannedBudget={adjustedBudget}
            data={generateMockSpendingData(data)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// Helper to generate mock spending data from project data
function generateMockSpendingData(data: ProjectOverviewData) {
  const start = new Date(data.startDate || Date.now());
  const end = new Date(data.endDate || Date.now());
  const progressPct = data.progressPct / 100;
  const currentSpent = data.spent;
  
  // Generate 5-7 data points from start to now
  const numPoints = 7;
  const timeSpan = end.getTime() - start.getTime();
  const now = Date.now();
  const currentProgress = Math.min((now - start.getTime()) / timeSpan, 1);
  
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const progress = (i / numPoints) * currentProgress;
    const date = new Date(start.getTime() + (timeSpan * progress));
    const spent = Math.round(currentSpent * (progress / currentProgress));
    
    if (spent > 0 && date <= new Date()) {
      points.push({
        date: date.toISOString().split('T')[0],
        spent,
      });
    }
  }
  
  // Ensure we have at least the current spending
  if (points.length === 0 || points[points.length - 1].spent !== currentSpent) {
    points.push({
      date: new Date().toISOString().split('T')[0],
      spent: currentSpent,
    });
  }
  
  return points;
}

// Subcomponents ----------------------------------------------------
const StatusChip: React.FC<{ status: ProjectOverviewData['status'] }> = ({
  status,
}) => {
  const statusColors = {
    Won: { bg: '#065f46', text: '#6ee7b7', border: '#10b981' },
    Active: { bg: '#1e3a8a', text: '#93c5fd', border: '#3b82f6' },
    'On Hold': { bg: '#92400e', text: '#fbbf24', border: '#f59e0b' },
    Completed: { bg: '#374151', text: '#d1d5db', border: '#6b7280' },
  };

  const colors = statusColors[status] || statusColors.Active;

  return (
    <View style={[styles.statusChip, { backgroundColor: colors.bg }]}>
      <Text style={[styles.statusChipText, { color: colors.text }]}>
        {status}
      </Text>
    </View>
  );
};

const ActionButton: React.FC<{
  label: string;
  onPress?: () => void;
  theme?: any;
}> = ({ label, onPress }) => (
  <LinearGradient
    colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
    start={{ x: 0.05, y: 0.15 }}
    end={{ x: 0.95, y: 0.85 }}
    style={{ borderRadius: 16, padding: 1 }}
  >
    <Pressable
      onPress={onPress}
      style={[styles.actionButton, { backgroundColor: '#000000' }]}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  </LinearGradient>
);

function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Mock data for quick preview -------------------------------------
export const mock: ProjectOverviewData = {
  title: 'Office Building Renovation',
  status: 'Won',
  progressPct: 75,
  budgeted: 250000,
  spent: 180000,
  startDate: '2025-01-15',
  endDate: '2025-04-30',
  daysLeft: 42,
  nextMilestone: { title: 'HVAC Install', date: '2025-03-12' },
  aheadBehindLabel: '3 Days Behind',
  costEfficiencyStatus: 'Good',
  scheduleEfficiencyStatus: 'At Risk',
  overallStatus: 'On Track',
  team: { pm: 'John Smith', activeSubs: 4, crewCount: 12 },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '800',
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressLabel: {
    color: '#cbd5e1',
    fontSize: 16,
  },
  progressBarContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  progressText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '500',
  },
  grid: {
    gap: 16,
  },
  sectionCard: {
    borderRadius: 24,
    padding: 16,
    // Removed borderWidth and borderColor to eliminate dark blue borders
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  labeledRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 24, // Ensure consistent row height
  },
  valueContainer: {
    alignItems: 'flex-end',
    maxWidth: '45%',
  },
  labelText: {
    color: '#cbd5e1',
    fontSize: 16,
    flex: 1, // Allow label to take available space
  },
  valueText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '500',
    flex: 1, // Allow value to take available space
    textAlign: 'right', // Right align values
  },
  spentText: {
    color: '#6ee7b7',
    fontSize: 16,
    fontWeight: '600',
  },
  remainingContainer: {
    marginTop: 8,
  },
  remainingLabel: {
    color: '#cbd5e1',
    marginBottom: 8,
    fontSize: 16,
  },
  overUnderText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 16,
  },
  flexOne: {
    flex: 1,
  },
  milestoneContainer: {
    marginTop: 8,
  },
  milestoneLabel: {
    color: '#cbd5e1',
    marginBottom: 4,
    fontSize: 16,
  },
  milestoneValue: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20, // Prevent text overlap
  },
  aheadBehindContainer: {
    marginTop: 8,
  },
  aheadBehindLabel: {
    color: '#cbd5e1',
    marginBottom: 4,
    fontSize: 16,
  },
  aheadBehindText: {
    fontSize: 16,
    fontWeight: '500',
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 24, // Ensure consistent row height
  },
  healthLabel: {
    color: '#cbd5e1',
    fontSize: 16,
    flex: 1, // Allow label to take available space
  },
  healthValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1, // Allow value to take available space
    textAlign: 'right', // Right align values
  },
  projectStatusContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap', // Allow wrapping if needed
  },
  projectStatusLabel: {
    color: '#cbd5e1',
    fontSize: 16,
    marginRight: 8,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  teamRow: {
    flexDirection: 'row',
  },
  teamColumn: {
    flex: 1,
  },
    teamActionContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '500',
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  barContainer: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
});
