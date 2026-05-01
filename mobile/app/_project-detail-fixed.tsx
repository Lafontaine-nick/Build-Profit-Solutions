import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * Build Profit Solutions — Project Detail Screen
 * -------------------------------------------------
 * - Shows detailed project view with tabs when a project is clicked
 * - Clean, professional styling with proper error handling
 */

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
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);

function pillColor(status: 'Good' | 'At Risk' | 'Critical' | 'On Track') {
  switch (status) {
    case 'Good':
    case 'On Track':
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        color: '#22c55e',
        borderColor: 'rgba(34, 197, 94, 0.4)',
      };
    case 'At Risk':
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        color: '#f59e0b',
        borderColor: 'rgba(245, 158, 11, 0.4)',
      };
    case 'Critical':
      return {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        color: '#ef4444',
        borderColor: 'rgba(239, 68, 68, 0.4)',
      };
    default:
      return {
        backgroundColor: 'rgba(100, 116, 139, 0.2)',
        color: '#64748b',
        borderColor: 'rgba(100, 116, 139, 0.4)',
      };
  }
}

const SectionCard: React.FC<{
  title: string;
  children: React.ReactNode;
  style?: any;
}> = ({ title, children, style = {} }) => {
  const { darkMode } = useTheme();
  return (
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: darkMode ? '#1e293b' : '#f8fafc' },
        style,
      ]}
    >
      <Text
        style={[
          styles.sectionTitle,
          { color: darkMode ? '#f1f5f9' : '#1e293b' },
        ]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
};

const LabeledRow: React.FC<{ label: string; value?: React.ReactNode }> = ({
  label,
  value,
}) => {
  const { darkMode } = useTheme();
  return (
    <View style={styles.labeledRow}>
      <Text style={[styles.label, { color: darkMode ? '#cbd5e1' : '#64748b' }]}>
        {label}
      </Text>
      <Text style={[styles.value, { color: darkMode ? '#f1f5f9' : '#1e293b' }]}>
        {value}
      </Text>
    </View>
  );
};

const Bar: React.FC<{ pct: number }> = ({ pct }) => {
  const { darkMode } = useTheme();
  return (
    <View
      style={[
        styles.barContainer,
        { backgroundColor: darkMode ? '#475569' : '#e2e8f0' },
      ]}
    >
      <View
        style={[
          styles.barFill,
          { width: `${Math.min(Math.max(pct, 0), 100)}%` },
        ]}
      />
    </View>
  );
};

// Root Screen ------------------------------------------------------
export default function ProjectDetailScreen() {
  const { darkMode } = useTheme();
  const router = useRouter();
  const { projectId, projectTitle, projectData } = useLocalSearchParams();

  const [activeTab, setActiveTab] = useState('Overview');
  const tabs = ['Overview', 'Budget', 'Timeline', 'Team', 'Messages'];

  // Parse project data with proper error handling and defaults
  let data: ProjectOverviewData;
  try {
    if (projectData) {
      const parsed = JSON.parse(projectData as string);
      // Ensure all required fields exist with defaults
      data = {
        title: parsed.title || 'Unknown Project',
        status: parsed.status || 'Active',
        progressPct: parsed.progress || 0,
        budgeted: parsed.value || 0,
        spent: (parsed.value || 0) * 0.7, // Default to 70% spent
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        daysLeft: parsed.daysLeft,
        nextMilestone: parsed.nextMilestone,
        aheadBehindLabel: parsed.aheadBehindLabel,
        costEfficiencyStatus: 'Good',
        scheduleEfficiencyStatus: 'Good',
        overallStatus: 'On Track',
        team: {
          pm: parsed.team?.pm || 'Not assigned',
          activeSubs: parsed.team?.activeSubs || 0,
          crewCount: parsed.team?.crewCount || 0,
        },
      };
    } else {
      data = mock;
    }
  } catch {
    data = mock;
  }

  const remaining = Math.max(data.budgeted - data.spent, 0);
  const overUnder = data.budgeted - data.spent; // + under, - over

  const theme = darkMode
    ? {
        background: ['#0f172a', '#1e293b', '#10b981'],
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        card: '#1e293b',
      }
    : {
        background: ['#f8fafc', '#e2e8f0', '#ffffff'],
        text: '#1e293b',
        subtext: '#64748b',
        card: '#ffffff',
      };

  return (
    <LinearGradient
      colors={theme.background as [string, string, string]}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {data.title}
          </Text>
          <View style={styles.statusRow}>
            <StatusChip status={data.status} />
            <Text style={[styles.progressLabel, { color: theme.subtext }]}>
              Progress
            </Text>
            <View style={styles.progressBarContainer}>
              <Bar pct={data.progressPct} />
            </View>
            <Text style={[styles.progressPercent, { color: theme.text }]}>
              {Math.round(data.progressPct)}%
            </Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View
          style={{
            flexDirection: 'row',
            marginBottom: 16,
            backgroundColor: darkMode
              ? 'rgba(30, 41, 59, 0.3)'
              : 'rgba(248, 250, 252, 0.8)',
            borderRadius: 16,
            padding: 4,
            gap: 4,
          }}
        >
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderRadius: 12,
                gap: 6,
                backgroundColor: activeTab === tab ? '#10b981' : 'transparent',
              }}
              onPress={() => setActiveTab(tab)}
            >
              {tab === 'Overview' && <Text style={{ fontSize: 16 }}>ℹ️</Text>}
              {tab === 'Budget' && <Text style={{ fontSize: 16 }}>💲</Text>}
              {tab === 'Timeline' && <Text style={{ fontSize: 16 }}>🕒</Text>}
              {tab === 'Team' && <Text style={{ fontSize: 16 }}>👥</Text>}
              {tab === 'Messages' && <Text style={{ fontSize: 16 }}>💬</Text>}
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color:
                    activeTab === tab
                      ? '#ffffff'
                      : darkMode
                        ? '#cbd5e1'
                        : '#64748b',
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'Overview' && (
          <View style={styles.gridContainer}>
            {/* Budget */}
            <SectionCard title='Budget Summary'>
              <LabeledRow label='Budgeted' value={currency(data.budgeted)} />
              <LabeledRow
                label='Spent So Far'
                value={
                  <Text style={styles.spentAmount}>{currency(data.spent)}</Text>
                }
              />
              <View style={styles.progressSection}>
                <Text
                  style={[
                    styles.progressLabel,
                    { color: darkMode ? '#cbd5e1' : '#64748b' },
                  ]}
                >
                  Remaining
                </Text>
                <Bar
                  pct={Math.min(
                    (remaining / Math.max(data.budgeted, 1)) * 100,
                    100
                  )}
                />
                <Text
                  style={[
                    styles.overUnderText,
                    { color: overUnder >= 0 ? '#10b981' : '#ef4444' },
                  ]}
                >
                  {overUnder >= 0
                    ? `Under by ${currency(Math.abs(overUnder))}`
                    : `Over by ${currency(Math.abs(overUnder))}`}
                </Text>
              </View>
            </SectionCard>

            {/* Timeline and Health Row */}
            <View style={styles.twoColumnRow}>
              <SectionCard title='Timeline' style={styles.flexCard}>
                <LabeledRow label='Start' value={fmtDate(data.startDate)} />
                <LabeledRow label='End' value={fmtDate(data.endDate)} />
                {data.daysLeft !== undefined && (
                  <LabeledRow label='Days Left' value={`${data.daysLeft}`} />
                )}
                {data.nextMilestone && (
                  <LabeledRow
                    label='Next Milestone'
                    value={`${data.nextMilestone.title}${data.nextMilestone.date ? ' (' + fmtDate(data.nextMilestone.date) + ')' : ''}`}
                  />
                )}
                {data.aheadBehindLabel && (
                  <View style={styles.aheadBehindSection}>
                    <Text
                      style={[
                        styles.label,
                        { color: darkMode ? '#cbd5e1' : '#64748b' },
                      ]}
                    >
                      Ahead/Behind
                    </Text>
                    <Text
                      style={[
                        styles.aheadBehindText,
                        {
                          color: data.aheadBehindLabel.includes('Behind')
                            ? '#f59e0b'
                            : '#10b981',
                        },
                      ]}
                    >
                      {data.aheadBehindLabel}
                    </Text>
                  </View>
                )}
              </SectionCard>

              {/* Health */}
              <SectionCard title='Health' style={styles.flexCard}>
                <View style={styles.healthRow}>
                  <Text
                    style={[
                      styles.label,
                      { color: darkMode ? '#cbd5e1' : '#64748b' },
                    ]}
                  >
                    Cost Efficiency
                  </Text>
                  <Text
                    style={[
                      styles.healthStatus,
                      { color: pillColor(data.costEfficiencyStatus).color },
                    ]}
                  >
                    {data.costEfficiencyStatus}
                  </Text>
                </View>
                <View style={styles.healthRow}>
                  <Text
                    style={[
                      styles.label,
                      { color: darkMode ? '#cbd5e1' : '#64748b' },
                    ]}
                  >
                    Schedule Efficiency
                  </Text>
                  <Text
                    style={[
                      styles.healthStatus,
                      { color: pillColor(data.scheduleEfficiencyStatus).color },
                    ]}
                  >
                    {data.scheduleEfficiencyStatus}
                  </Text>
                </View>
                <View style={styles.projectStatusSection}>
                  <Text
                    style={[
                      styles.label,
                      { color: darkMode ? '#cbd5e1' : '#64748b' },
                    ]}
                  >
                    Project Status
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: pillColor(data.overallStatus)
                          .backgroundColor,
                        borderColor: pillColor(data.overallStatus).borderColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: pillColor(data.overallStatus).color },
                      ]}
                    >
                      {data.overallStatus}
                    </Text>
                  </View>
                </View>
              </SectionCard>
            </View>

            {/* Team */}
            <SectionCard title='Team'>
              <View style={styles.teamContainer}>
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
            </SectionCard>

            {/* Quick Actions */}
            <View style={styles.actionsRow}>
              <ActionButton
                label='Add Expense'
                onPress={() =>
                  Alert.alert('Add Expense', 'Feature coming soon!')
                }
              />
              <ActionButton
                label='Add Milestone'
                onPress={() =>
                  Alert.alert('Add Milestone', 'Feature coming soon!')
                }
              />
            </View>
            <View style={styles.actionsRow}>
              <ActionButton
                label='Upload File'
                onPress={() =>
                  Alert.alert('Upload File', 'Feature coming soon!')
                }
              />
              <ActionButton
                label='Send Update'
                onPress={() =>
                  Alert.alert('Send Update', 'Feature coming soon!')
                }
              />
            </View>
          </View>
        )}

        {activeTab === 'Budget' && (
          <SectionCard title='Budget Management'>
            <Text style={[styles.comingSoon, { color: theme.subtext }]}>
              Budget tracking features coming soon!
            </Text>
          </SectionCard>
        )}
        {activeTab === 'Timeline' && (
          <SectionCard title='Timeline Management'>
            <Text style={[styles.comingSoon, { color: theme.subtext }]}>
              Timeline tracking features coming soon!
            </Text>
          </SectionCard>
        )}
        {activeTab === 'Team' && (
          <SectionCard title='Team Management'>
            <Text style={[styles.comingSoon, { color: theme.subtext }]}>
              Team management features coming soon!
            </Text>
          </SectionCard>
        )}
        {activeTab === 'Messages' && (
          <SectionCard title='Communications'>
            <Text style={[styles.comingSoon, { color: theme.subtext }]}>
              Communication features coming soon!
            </Text>
          </SectionCard>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

// Subcomponents ----------------------------------------------------
const StatusChip: React.FC<{ status: ProjectOverviewData['status'] }> = ({
  status,
}) => {
  const statusStyles: Record<ProjectOverviewData['status'], any> = {
    Won: {
      backgroundColor: 'rgba(34, 197, 94, 0.2)',
      color: '#10b981',
      borderColor: 'rgba(34, 197, 94, 0.4)',
    },
    Active: {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      color: '#3b82f6',
      borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    'On Hold': {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      color: '#f59e0b',
      borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    Completed: {
      backgroundColor: 'rgba(100, 116, 139, 0.2)',
      color: '#64748b',
      borderColor: 'rgba(100, 116, 139, 0.4)',
    },
  };

  return (
    <View style={[styles.statusChip, statusStyles[status]]}>
      <Text
        style={[styles.statusChipText, { color: statusStyles[status].color }]}
      >
        {status}
      </Text>
    </View>
  );
};

const ActionButton: React.FC<{ label: string; onPress?: () => void }> = ({
  label,
  onPress,
}) => {
  const { darkMode } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.actionButton,
        {
          backgroundColor: darkMode
            ? 'rgba(30, 41, 59, 0.6)'
            : 'rgba(248, 250, 252, 0.6)',
        },
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          { color: darkMode ? '#f1f5f9' : '#1e293b' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

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

// Styles ----------------------------------------------------------
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
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    padding: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#10b981',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 40,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  progressLabel: {
    fontSize: 14,
  },
  progressBarContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '500',
  },
  gridContainer: {
    gap: 16,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  labeledRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  spentAmount: {
    color: '#14b8a6',
    fontWeight: '600',
  },
  progressSection: {
    marginTop: 8,
  },
  barContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 8,
  },
  barFill: {
    height: 8,
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  overUnderText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 16,
  },
  flexCard: {
    flex: 1,
  },
  aheadBehindSection: {
    marginTop: 8,
  },
  aheadBehindText: {
    fontSize: 16,
    marginTop: 4,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  healthStatus: {
    fontSize: 16,
    fontWeight: '600',
  },
  projectStatusSection: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  teamContainer: {
    flexDirection: 'row',
  },
  teamColumn: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  comingSoon: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
});
