import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Pressable,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import BudgetTab from '../../components/BudgetTab';
import TimelineTabV2 from '../../components/TimelineTabV2';
import TeamTab from '../../components/TeamTab';
import SpendingTrendChart from '../../components/SpendingTrendChart';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { buildSpendingTrendSamplePoints } from '../../src/lib/projectChartTimeline';
import {
  neutralIconPressableProps,
  neutralIconPressableWebStyle,
} from '@/constants/iconPressable';
import GradientRingBackInner from '@/components/GradientRingBackInner';

type TabKey = 'Overview' | 'Budget' | 'Timeline' | 'Health' | 'Team';


// Circular Progress Component
const CircularProgress = ({
  progress,
  size = 60,
  strokeWidth = 6,
  color = '#22C55E',
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
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
        stroke='rgba(255,255,255,0.18)'
        strokeWidth={strokeWidth}
        fill='transparent'
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill='transparent'
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap='round'
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

export default function ProjectDetailContent() {
  console.log('>>> RENDERING NICK PROJECT SCREEN'); // TEMP LOG
  
  const router = useRouter();
  const { projectData } = useProjectData();
  const [activeTab, setActiveTab] = useState<TabKey>('Overview');

  const project = projectData as any;
  const name = project?.title ?? project?.name ?? 'nick';
  const status = project?.status ?? 'Active';
  const location = project?.location ?? 'Unknown, Unknown';
  const lastUpdated = project?.lastUpdated
    ? new Date(project.lastUpdated).toLocaleDateString()
    : 'Invalid Date';

  // Calculate project metrics
  const metrics = useMemo(() => {
    const expensesTotal = (project?.expenses || []).reduce(
      (sum: number, expense: any) => sum + Number(expense.amount || 0),
      0
    );
    const bucketSpentTotal = (project?.buckets || []).reduce(
      (sum: number, bucket: any) => sum + Number(bucket.spent || 0),
      0
    );
    const approvedChangeOrdersTotal = (project?.changeOrders || []).reduce(
      (sum: number, co: any) => {
        const amount = Number(co.amount || 0);
        const isApproved =
          (typeof co.approved === 'boolean' && co.approved) ||
          (typeof co.status === 'string' && co.status.toLowerCase() === 'approved');
        return isApproved ? sum + amount : sum;
      },
      0
    );
    const adjustedBudget = Number(project?.budgeted || 0) + approvedChangeOrdersTotal;
    const actualSpent =
      expensesTotal > 0
        ? expensesTotal
        : Number(project?.spent ?? 0) > 0
        ? Number(project?.spent ?? 0)
        : bucketSpentTotal;

    const budgetProgress = adjustedBudget > 0 ? (actualSpent / adjustedBudget) * 100 : 0;
    const scheduleProgress = project?.overallProgressPct || 0;

    const getDaysLeft = () => {
      if (!project?.endISO) return 0;
      const endDate = new Date(project.endISO);
      const today = new Date();
      const diffTime = endDate.getTime() - today.getTime();
      return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    };

    const getBudgetColor = (budgetUsed: number) => {
      if (budgetUsed < 50) return '#22C55E';
      if (budgetUsed < 80) return '#F97316';
      return '#EF4444';
    };

    const getProgressColor = (progress: number) => {
      if (progress < 50) return '#F97316';
      if (progress < 80) return '#FACC15';
      return '#22C55E';
    };

    const getStatusColor = (status: string) => {
      const normalized = status?.toLowerCase() || '';
      if (normalized.includes('good') || normalized.includes('on track')) return '#22c55e';
      if (normalized.includes('risk') || normalized.includes('at risk')) return '#f59e0b';
      if (normalized.includes('critical') || normalized.includes('behind')) return '#ef4444';
      return '#9ca3af';
    };

    const getHealthStatusColor = (healthStatus: string) => {
      return getStatusColor(healthStatus);
    };

    const generateSpendingData = () =>
      buildSpendingTrendSamplePoints(project as unknown as Record<string, unknown>, actualSpent);

    return {
      adjustedBudget,
      actualSpent,
      budgetProgress: Math.min(100, Math.max(0, budgetProgress)),
      scheduleProgress: Math.min(100, Math.max(0, scheduleProgress)),
      daysLeft: getDaysLeft(),
      budgetColor: getBudgetColor(budgetProgress),
      progressColor: getProgressColor(scheduleProgress),
      statusColor: getStatusColor(project?.health?.projectStatus || 'On Track'),
      spendingData: generateSpendingData(),
      getHealthStatusColor,
    };
  }, [project]);

  return (
    <LinearGradient
      colors={['#020617', '#020617']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle='light-content' />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* HEADER – same visual weight as "Dashboard" header */}
          <View style={styles.headerRow}>
            <View style={styles.backButtonWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <GradientRingBackInner
                  darkMode
                  onPress={() => router.back()}
                  style={styles.backButton}
                >
                  <Ionicons name='chevron-back' size={20} color='#FFFFFF' />
                </GradientRingBackInner>
              </LinearGradient>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{name}</Text>
              <Text style={styles.subtitle}>
                {status} · {location}
              </Text>
            </View>

            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(name?.[0] ?? 'N').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* TABS – same pill segmented control style as Dashboard */}
          <View style={styles.tabsPill}>
            {(['Overview', 'Budget', 'Timeline', 'Health', 'Team'] as TabKey[]).map(
              (tab) => {
                const isActive = tab === activeTab;
                return (
                  <Pressable
                    key={tab}
                    {...neutralIconPressableProps(true)}
                    style={[
                      styles.tabItem,
                      isActive && styles.tabItemActive,
                      neutralIconPressableWebStyle(),
                    ]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text
                      style={[
                        styles.tabLabel,
                        isActive && styles.tabLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {tab}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          {/* === CONTENT CARDS (ALL USE SAME CARD STYLE AS DASHBOARD) === */}

          {activeTab === 'Overview' && (
            <View
              style={{
                flex: 1,
                paddingTop: 40,
                paddingHorizontal: 24,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  backgroundColor: 'red',
                  paddingVertical: 32,
                  paddingHorizontal: 24,
                  borderRadius: 20,
                  shadowColor: '#000',
                  shadowOpacity: 0.3,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 10 },
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontSize: 24,
                    fontWeight: '800',
                    textAlign: 'center',
                  }}
                >
                  OVERVIEW TEST
                </Text>
                <Text
                  style={{
                    color: 'white',
                    fontSize: 14,
                    marginTop: 8,
                    opacity: 0.8,
                    textAlign: 'center',
                  }}
                >
                  If you can see this, we found the right file.
                </Text>
              </View>
            </View>
          )}

          {activeTab === 'Budget' && (
            <>
              <View style={[styles.card, styles.chartCard]}>
                {/* ⬇️ your big blue line chart */}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={styles.iconBadge}>
                      <Feather name='credit-card' size={16} color='#22c55e' />
                    </View>
                    <Text style={styles.cardTitle}>Budget Summary</Text>
                  </View>
                </View>

                {/* ⬇️ paste all the budget rows + progress bars */}
                <BudgetTab />
              </View>
            </>
          )}

          {activeTab === 'Timeline' && (
            <TimelineTabV2 project={projectData as any} />
          )}

          {activeTab === 'Health' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={styles.iconBadge}>
                    <Feather name='heart' size={16} color='#22c55e' />
                  </View>
                  <Text style={styles.cardTitle}>Health</Text>
                </View>
              </View>

              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>Cost Efficiency</Text>
                <View
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor:
                        metrics.getHealthStatusColor(
                          project?.health?.costEfficiency || 'Good'
                        ) + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      {
                        color: metrics.getHealthStatusColor(
                          project?.health?.costEfficiency || 'Good'
                        ),
                      },
                    ]}
                  >
                    {project?.health?.costEfficiency || 'Good'}
                  </Text>
                </View>
              </View>

              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>Schedule Efficiency</Text>
                <View
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor:
                        metrics.getHealthStatusColor(
                          project?.health?.scheduleEfficiency || 'Good'
                        ) + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      {
                        color: metrics.getHealthStatusColor(
                          project?.health?.scheduleEfficiency || 'Good'
                        ),
                      },
                    ]}
                  >
                    {project?.health?.scheduleEfficiency || 'Good'}
                  </Text>
                </View>
              </View>

              <View style={[styles.healthRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.healthLabel}>Project Status</Text>
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: metrics.statusColor + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: metrics.statusColor },
                    ]}
                  >
                    {project?.health?.projectStatus || 'On Track'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'Team' && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={styles.iconBadge}>
                    <Feather name='users' size={16} color='#22c55e' />
                  </View>
                  <Text style={styles.cardTitle}>Team</Text>
                </View>
              </View>

              {/* ⬇️ your "PM Not assigned / +Assign PM" row */}
              <TeamTab />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },

  // HEADER
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  backButtonWrapper: {
    marginRight: 12,
  },
  backButtonBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f9fafb',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#9ca3af',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#22d3ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  avatarText: {
    color: '#e5e7eb',
    fontWeight: '700',
  },

  // TABS (pill segmented control)
  tabsPill: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: '#19E180',
    backgroundColor: '#020617',
    marginBottom: 18,
  },
  tabItem: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: '#22c55e',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  tabLabelActive: {
    color: '#020617',
  },

  // CARDS – match Dashboard analytics cards
  card: {
    backgroundColor: '#020617',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  chartCard: {
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
  statusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
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
    color: '#9ca3af',
    marginTop: 8,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 14,
    color: '#f9fafb',
    marginTop: 4,
    fontWeight: '700',
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.1)',
  },
  healthLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '500',
  },

  // ---- SHARED SECTION STYLES (match Dashboard Overview) ----
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // small label in the top snapshot card
  snapshotLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  projectSnapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 16,
  },
});
