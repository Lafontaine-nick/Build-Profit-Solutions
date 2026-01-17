import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from "react-native";
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
  status: "Won" | "Active" | "On Hold" | "Completed";
  progressPct: number; // 0..100
  budgeted: number; // planned
  spent: number; // to date
  startDate?: string; // ISO
  endDate?: string; // ISO
  daysLeft?: number;
  nextMilestone?: { title: string; date?: string };
  aheadBehindLabel?: string; // e.g., "3 Days Behind"
  costEfficiencyStatus: "Good" | "At Risk" | "Critical";
  scheduleEfficiencyStatus: "Good" | "At Risk" | "Critical";
  overallStatus: "On Track" | "At Risk" | "Critical";
  team: { pm?: string; activeSubs?: number; crewCount?: number };
};

// Helpers ----------------------------------------------------------
const currency = (n: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);

function pillColor(status: "Good" | "At Risk" | "Critical" | "On Track", darkMode: boolean = true) {
  switch (status) {
    case "Good":
    case "On Track":
      return { 
        backgroundColor: 'rgba(34, 197, 94, 0.2)', 
        color: '#22c55e', 
        borderColor: 'rgba(34, 197, 94, 0.4)' 
      };
    case "At Risk":
      return { 
        backgroundColor: 'rgba(245, 158, 11, 0.2)', 
        color: '#f59e0b', 
        borderColor: 'rgba(245, 158, 11, 0.4)' 
      };
    case "Critical":
      return { 
        backgroundColor: 'rgba(239, 68, 68, 0.2)', 
        color: '#ef4444', 
        borderColor: 'rgba(239, 68, 68, 0.4)' 
      };
    default:
      return { 
        backgroundColor: darkMode ? 'rgba(100, 116, 139, 0.2)' : 'rgba(148, 163, 184, 0.15)', 
        color: darkMode ? '#64748b' : '#475569', 
        borderColor: darkMode ? 'rgba(100, 116, 139, 0.4)' : 'rgba(148, 163, 184, 0.25)' 
      };
  }
}

const SectionCard: React.FC<{ title: string; children: React.ReactNode; style?: any }> = ({ title, children, style = {} }) => {
  const { darkMode } = useTheme();
  return (
    <LinearGradient
      colors={["#2DFFC4", "#00A6FF"]}
      start={{ x: 0.05, y: 0.15 }}
      end={{ x: 0.95, y: 0.85 }}
      style={{
        borderRadius: 20,
        padding: 1,
        marginBottom: 16,
        ...style,
      }}
    >
      <View style={[styles.sectionCard, { 
        backgroundColor: darkMode ? '#1e293b' : '#E2E8F0', // Same grey as dashboard project cards
        borderColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
      }, style]}>
        <Text style={[styles.sectionTitle, { color: darkMode ? '#f1f5f9' : '#1e293b' }]}>{title}</Text>
        {children}
      </View>
    </LinearGradient>
  );
};

const LabeledRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => {
  const { darkMode } = useTheme();
  return (
    <View style={styles.labeledRow}>
      <Text style={[styles.label, { color: darkMode ? '#cbd5e1' : '#64748b' }]}>{label}</Text>
      <Text style={[styles.value, { color: darkMode ? '#f1f5f9' : '#1e293b' }]}>{value}</Text>
    </View>
  );
};

const Bar: React.FC<{ pct: number }> = ({ pct }) => {
  const { darkMode } = useTheme();
  return (
    <View style={[styles.barContainer, { backgroundColor: darkMode ? '#475569' : '#e2e8f0' }]}>
      <View style={[styles.barFill, { width: `${Math.min(Math.max(pct, 0), 100)}%` }]} />
    </View>
  );
};

// Budget Tab Component
const BudgetTab: React.FC<{ projectData: ProjectOverviewData }> = ({ projectData }) => {
  const { darkMode, theme: themeTokens } = useTheme();
  const theme = darkMode ? {
    background: '#1a1a1a',
    card: '#2d2d2d',
    text: '#fff',
    subtext: '#ccc',
    accent: '#43cea2',
    border: '#404040',
  } : {
    background: themeTokens?.bg || '#F8FAFC', // Match dashboard background
    card: themeTokens?.card || '#FFFFFF',
    text: themeTokens?.text || '#1e293b',
    subtext: themeTokens?.subtext || '#64748b',
    accent: '#22c55e', // Match dashboard green
    border: '#e0e0e0',
  };

  const budgetCategories = [
    { name: 'Materials', amount: projectData.spent * 0.6, percentage: 60 },
    { name: 'Labor', amount: projectData.spent * 0.3, percentage: 30 },
    { name: 'Equipment', amount: projectData.spent * 0.1, percentage: 10 },
  ];

  return (
    <View style={[styles.tabContainer, { backgroundColor: darkMode ? theme.background : 'transparent' }]}>
      <ScrollView contentContainerStyle={styles.tabContent}>
        <SectionCard title="Budget Overview">
          <LabeledRow label="Total Budget" value={currency(projectData.budgeted)} />
          <LabeledRow label="Spent to Date" value={currency(projectData.spent)} />
          <LabeledRow label="Remaining" value={currency(projectData.budgeted - projectData.spent)} />
          <View style={styles.progressSection}>
            <Text style={[styles.progressLabel, { color: darkMode ? '#cbd5e1' : '#64748b' }]}>Budget Utilization</Text>
            <Bar pct={(projectData.spent / projectData.budgeted) * 100} />
            <Text style={[styles.overUnderText, { color: '#10b981' }]}>
              {Math.round((projectData.spent / projectData.budgeted) * 100)}% utilized
            </Text>
          </View>
        </SectionCard>

        <SectionCard title="Budget Breakdown">
          {budgetCategories.map((category, index) => (
            <View key={index} style={styles.budgetItem}>
              <View style={styles.budgetHeader}>
                <Text style={[styles.budgetCategory, { color: theme.text }]}>{category.name}</Text>
                <Text style={[styles.budgetAmount, { color: theme.text }]}>{currency(category.amount)}</Text>
              </View>
              <View style={[styles.budgetBar, { backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : '#CBD5E1' }]}>
                <View style={[styles.budgetBarFill, { width: `${category.percentage}%`, backgroundColor: theme.accent }]} />
              </View>
              <Text style={[styles.budgetPercentage, { color: theme.subtext }]}>{category.percentage}%</Text>
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Recent Expenses">
          <View style={styles.expenseItem}>
            <Text style={[styles.expenseDescription, { color: theme.text }]}>HVAC Installation</Text>
            <Text style={[styles.expenseAmount, { color: theme.accent }]}>$15,000</Text>
            <Text style={[styles.expenseDate, { color: theme.subtext }]}>2 days ago</Text>
          </View>
          <View style={styles.expenseItem}>
            <Text style={[styles.expenseDescription, { color: theme.text }]}>Electrical Materials</Text>
            <Text style={[styles.expenseAmount, { color: theme.accent }]}>$8,500</Text>
            <Text style={[styles.expenseDate, { color: theme.subtext }]}>1 week ago</Text>
          </View>
          <View style={styles.expenseItem}>
            <Text style={[styles.expenseDescription, { color: theme.text }]}>Plumbing Supplies</Text>
            <Text style={[styles.expenseAmount, { color: theme.accent }]}>$3,200</Text>
            <Text style={[styles.expenseDate, { color: theme.subtext }]}>2 weeks ago</Text>
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
};

// Timeline Tab Component
const TimelineTab: React.FC<{ projectData: ProjectOverviewData }> = ({ projectData }) => {
  const { darkMode, theme: themeTokens } = useTheme();
  const theme = darkMode ? {
    background: '#1a1a1a',
    card: '#2d2d2d',
    text: '#fff',
    subtext: '#ccc',
    accent: '#43cea2',
    border: '#404040',
  } : {
    background: themeTokens?.bg || '#F8FAFC',
    card: themeTokens?.card || '#FFFFFF',
    text: themeTokens?.text || '#1e293b',
    subtext: themeTokens?.subtext || '#64748b',
    accent: '#22c55e',
    border: '#e0e0e0',
  };

  const timelinePhases = [
    { name: 'Planning & Design', status: 'completed', progress: 100, startDate: '2024-01-01', endDate: '2024-01-15' },
    { name: 'Foundation Work', status: 'completed', progress: 100, startDate: '2024-01-16', endDate: '2024-02-01' },
    { name: 'Framing', status: 'in-progress', progress: 75, startDate: '2024-02-02', endDate: '2024-02-28' },
    { name: 'HVAC Installation', status: 'pending', progress: 0, startDate: '2024-03-01', endDate: '2024-03-15' },
    { name: 'Electrical & Plumbing', status: 'pending', progress: 0, startDate: '2024-03-16', endDate: '2024-04-01' },
    { name: 'Finishing', status: 'pending', progress: 0, startDate: '2024-04-02', endDate: '2024-04-30' },
  ];

  const getPhaseStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in-progress': return '#f59e0b';
      case 'pending': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <View style={[styles.tabContainer, { backgroundColor: darkMode ? theme.background : 'transparent' }]}>
      <ScrollView contentContainerStyle={styles.tabContent}>
        <SectionCard title="Project Timeline">
          <LabeledRow label="Start Date" value={fmtDate(projectData.startDate)} />
          <LabeledRow label="End Date" value={fmtDate(projectData.endDate)} />
          <LabeledRow label="Days Remaining" value={`${projectData.daysLeft || 0} days`} />
          {projectData.nextMilestone && (
            <LabeledRow 
              label="Next Milestone" 
              value={projectData.nextMilestone.title} 
            />
          )}
          {projectData.aheadBehindLabel && (
            <LabeledRow 
              label="Schedule Status" 
              value={projectData.aheadBehindLabel} 
            />
          )}
        </SectionCard>

        <SectionCard title="Project Phases">
          {timelinePhases.map((phase, index) => (
            <View key={index} style={styles.phaseItem}>
              <View style={styles.phaseHeader}>
                <View style={[styles.phaseStatus, { backgroundColor: getPhaseStatusColor(phase.status) }]} />
                <Text style={[styles.phaseName, { color: theme.text }]}>{phase.name}</Text>
                <Text style={[styles.phaseProgress, { color: theme.subtext }]}>{phase.progress}%</Text>
              </View>
              <View style={[styles.phaseBar, { backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : '#CBD5E1' }]}>
                <View style={[styles.phaseBarFill, { width: `${phase.progress}%`, backgroundColor: getPhaseStatusColor(phase.status) }]} />
              </View>
              <View style={styles.phaseDates}>
                <Text style={[styles.phaseDate, { color: theme.subtext }]}>{fmtDate(phase.startDate)}</Text>
                <Text style={[styles.phaseDate, { color: theme.subtext }]}>{fmtDate(phase.endDate)}</Text>
              </View>
            </View>
          ))}
        </SectionCard>
      </ScrollView>
    </View>
  );
};

// Team Tab Component
const TeamTab: React.FC<{ projectData: ProjectOverviewData }> = ({ projectData }) => {
  const { darkMode, theme: themeTokens } = useTheme();
  const theme = darkMode ? {
    background: '#1a1a1a',
    card: '#2d2d2d',
    text: '#fff',
    subtext: '#ccc',
    accent: '#43cea2',
    border: '#404040',
  } : {
    background: themeTokens?.bg || '#F8FAFC',
    card: themeTokens?.card || '#FFFFFF',
    text: themeTokens?.text || '#1e293b',
    subtext: themeTokens?.subtext || '#64748b',
    accent: '#22c55e',
    border: '#e0e0e0',
  };

  const teamMembers = [
    { name: 'John Smith', role: 'Project Manager', status: 'available', tasks: 3 },
    { name: 'Mike Johnson', role: 'Foreman', status: 'busy', tasks: 5 },
    { name: 'Sarah Chen', role: 'Electrician', status: 'available', tasks: 2 },
    { name: 'David Rodriguez', role: 'Plumber', status: 'offline', tasks: 1 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#10b981';
      case 'busy': return '#f59e0b';
      case 'offline': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <View style={[styles.tabContainer, { backgroundColor: darkMode ? theme.background : 'transparent' }]}>
      <ScrollView contentContainerStyle={styles.tabContent}>
        <SectionCard title="Team Overview">
          <LabeledRow label="Project Manager" value={projectData.team.pm || "Not assigned"} />
          <LabeledRow label="Active Subcontractors" value={`${projectData.team.activeSubs ?? 0}`} />
          <LabeledRow label="Crew Members" value={`${projectData.team.crewCount ?? 0}`} />
          <LabeledRow label="Total Team Size" value={`${(projectData.team.activeSubs ?? 0) + (projectData.team.crewCount ?? 0) + 1}`} />
        </SectionCard>

        <SectionCard title="Team Members">
          {teamMembers.map((member, index) => (
            <View key={index} style={styles.memberItem}>
              <View style={styles.memberInfo}>
                <View style={[styles.memberAvatar, { backgroundColor: theme.accent }]}>
                  <Text style={styles.memberAvatarText}>{member.name.charAt(0)}</Text>
                </View>
                <View style={styles.memberDetails}>
                  <Text style={[styles.memberName, { color: theme.text }]}>{member.name}</Text>
                  <Text style={[styles.memberRole, { color: theme.subtext }]}>{member.role}</Text>
                </View>
              </View>
              <View style={styles.memberStatus}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(member.status) }]} />
                <Text style={[styles.statusText, { color: theme.subtext }]}>{member.status}</Text>
                <Text style={[styles.taskCount, { color: theme.subtext }]}>{member.tasks} tasks</Text>
              </View>
            </View>
          ))}
        </SectionCard>
      </ScrollView>
    </View>
  );
};

// Communications Tab Component
const CommunicationsTab: React.FC<{ projectData: ProjectOverviewData }> = ({ projectData }) => {
  const { darkMode, theme: themeTokens } = useTheme();
  const theme = darkMode ? {
    background: '#1a1a1a',
    card: '#2d2d2d',
    text: '#fff',
    subtext: '#ccc',
    accent: '#43cea2',
    border: '#404040',
  } : {
    background: themeTokens?.bg || '#F8FAFC',
    card: themeTokens?.card || '#FFFFFF',
    text: themeTokens?.text || '#1e293b',
    subtext: themeTokens?.subtext || '#64748b',
    accent: '#22c55e',
    border: '#e0e0e0',
  };

  const messages = [
    {
      id: '1',
      author: 'John Smith',
      message: 'HVAC installation is on track for tomorrow',
      timestamp: '2 hours ago',
      type: 'update'
    },
    {
      id: '2',
      author: 'Mike Johnson',
      message: 'Need approval for additional materials - $2,500',
      timestamp: '4 hours ago',
      type: 'request'
    },
    {
      id: '3',
      author: 'Sarah Chen',
      message: 'Electrical inspection passed ✅',
      timestamp: '1 day ago',
      type: 'milestone'
    }
  ];

  return (
    <View style={[styles.tabContainer, { backgroundColor: darkMode ? theme.background : 'transparent' }]}>
      <ScrollView contentContainerStyle={styles.tabContent}>
        <SectionCard title="Project Communications">
          <Text style={[styles.commSubtitle, { color: theme.subtext }]}>
            Team updates and messages for {projectData.title}
          </Text>
        </SectionCard>

        {messages.map((msg) => (
          <SectionCard key={msg.id} title="">
            <View style={styles.messageHeader}>
              <View style={[styles.messageAvatar, { backgroundColor: theme.accent }]}>
                <Text style={styles.messageAvatarText}>{msg.author.charAt(0)}</Text>
              </View>
              <View style={styles.messageInfo}>
                <Text style={[styles.messageAuthor, { color: theme.text }]}>{msg.author}</Text>
                <Text style={[styles.messageTime, { color: theme.subtext }]}>{msg.timestamp}</Text>
              </View>
              <View style={[
                styles.messageType,
                { backgroundColor: msg.type === 'milestone' ? '#4CAF50' : msg.type === 'request' ? '#FF9800' : theme.accent }
              ]}>
                <Text style={styles.messageTypeText}>{msg.type}</Text>
              </View>
            </View>
            <Text style={[styles.messageText, { color: theme.text }]}>{msg.message}</Text>
          </SectionCard>
        ))}

        <SectionCard title="Quick Actions">
          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.accent }]}>
              <Text style={styles.actionButtonText}>Send Update</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: 'transparent', borderColor: theme.accent, borderWidth: 1 }]}>
              <Text style={[styles.actionButtonText, { color: theme.accent }]}>View All Messages</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
};

// Root Screen ------------------------------------------------------
export default function ProjectDetailScreen() {
  const { darkMode, theme: themeTokens } = useTheme();
  const router = useRouter();
  const { projectId, projectTitle, projectData } = useLocalSearchParams();
  
  const [activeTab, setActiveTab] = useState("Overview");
  const tabs = ["Overview", "Budget", "Timeline", "Team", "Messages"];
  
  // Parse project data with proper error handling and defaults
  let data: ProjectOverviewData;
  try {
    if (projectData) {
      const parsed = JSON.parse(projectData as string);
      // Ensure all required fields exist with defaults
      data = {
        title: parsed.title || "Unknown Project",
        status: parsed.status || "Active",
        progressPct: parsed.progress || 0,
        budgeted: parsed.value || 0,
        spent: (parsed.value || 0) * 0.7, // Default to 70% spent
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        daysLeft: parsed.daysLeft,
        nextMilestone: parsed.nextMilestone,
        aheadBehindLabel: parsed.aheadBehindLabel,
        costEfficiencyStatus: "Good",
        scheduleEfficiencyStatus: "Good",
        overallStatus: "On Track",
        team: {
          pm: parsed.team?.pm || "Not assigned",
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

  const theme = darkMode ? {
    background: ["#0f172a", "#1e293b", "#10b981"],
    text: '#f1f5f9',
    subtext: '#cbd5e1',
    card: '#1e293b'
  } : {
    background: ["#f8fafc", "#e2e8f0", "#ffffff"],
    text: '#1e293b',
    subtext: '#64748b',
    card: '#ffffff'
  };

  // Use LinearGradient for dark mode, solid backgroundColor for light mode (matching dashboard)
  const Container = darkMode ? LinearGradient : View;
  const containerProps = darkMode 
    ? { colors: theme.background as [string, string, string], style: styles.container }
    : { style: [styles.container, { backgroundColor: themeTokens?.bg || '#F8FAFC' }] };

  return (
    <Container {...containerProps}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{data.title}</Text>
          <View style={styles.statusRow}>
            <StatusChip status={data.status} />
            <Text style={[styles.progressLabel, { color: theme.subtext }]}>Progress</Text>
            <View style={styles.progressBarContainer}>
              <Bar pct={data.progressPct} />
            </View>
            <Text style={[styles.progressPercent, { color: theme.text }]}>{Math.round(data.progressPct)}%</Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={{
          flexDirection: "row",
          marginBottom: 16,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: "#19E180",
          backgroundColor: darkMode ? "transparent" : "#F1F5F9",
          padding: 4,
          gap: 4,
        }}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderRadius: 999,
                gap: 6,
                backgroundColor: activeTab === tab ? (darkMode ? "#22c55e" : "#FFFFFF") : "transparent",
                shadowColor: activeTab === tab && !darkMode ? "#000" : "transparent",
                shadowOpacity: activeTab === tab && !darkMode ? 0.12 : 0,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 0 },
              }}
              onPress={() => setActiveTab(tab)}
            >
              {tab === "Overview" && <Text style={{fontSize: 16}}>ℹ️</Text>}
              {tab === "Budget" && <Text style={{fontSize: 16}}>💲</Text>}
              {tab === "Timeline" && <Text style={{fontSize: 16}}>🕒</Text>}
              {tab === "Team" && <Text style={{fontSize: 16}}>👥</Text>}
              {tab === "Messages" && <Text style={{fontSize: 16}}>💬</Text>}
              <Text style={{
                fontSize: 14,
                fontWeight: "600",
                color: activeTab === tab ? (darkMode ? "#050B13" : "#071018") : (darkMode ? "#E5F7FF" : "#475569")
              }}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === "Overview" && (
          <View style={styles.gridContainer}>
            {/* Budget */}
            <SectionCard title="Budget Summary">
              <LabeledRow label="Budgeted" value={currency(data.budgeted)} />
              <LabeledRow 
                label="Spent So Far" 
                value={<Text style={styles.spentAmount}>{currency(data.spent)}</Text>} 
              />
              <View style={styles.progressSection}>
                <Text style={[styles.progressLabel, { color: darkMode ? '#cbd5e1' : '#64748b' }]}>Remaining</Text>
                <Bar pct={Math.min((remaining / Math.max(data.budgeted, 1)) * 100, 100)} />
                <Text style={[
                  styles.overUnderText, 
                  { color: overUnder >= 0 ? '#10b981' : '#ef4444' }
                ]}>
                  {overUnder >= 0 ? `Under by ${currency(Math.abs(overUnder))}` : `Over by ${currency(Math.abs(overUnder))}`}
                </Text>
              </View>
            </SectionCard>

            {/* Timeline and Health Row */}
            <View style={styles.twoColumnRow}>
              <SectionCard title="Timeline" style={styles.flexCard}>
                <LabeledRow label="Start" value={fmtDate(data.startDate)} />
                <LabeledRow label="End" value={fmtDate(data.endDate)} />
                {data.daysLeft !== undefined && (
                  <LabeledRow label="Days Left" value={`${data.daysLeft}`} />
                )}
                {data.nextMilestone && (
                  <LabeledRow 
                    label="Next Milestone" 
                    value={`${data.nextMilestone.title}${data.nextMilestone.date ? " ("+fmtDate(data.nextMilestone.date)+")" : ""}`} 
                  />
                )}
                {data.aheadBehindLabel && (
                  <View style={styles.aheadBehindSection}>
                    <Text style={[styles.label, { color: darkMode ? '#cbd5e1' : '#64748b' }]}>Ahead/Behind</Text>
                    <Text style={[
                      styles.aheadBehindText,
                      { color: data.aheadBehindLabel.includes("Behind") ? '#f59e0b' : '#10b981' }
                    ]}>
                      {data.aheadBehindLabel}
                    </Text>
                  </View>
                )}
              </SectionCard>

              {/* Health */}
              <SectionCard title="Health" style={styles.flexCard}>
                <View style={styles.healthRow}>
                  <Text style={[styles.label, { color: darkMode ? '#cbd5e1' : '#64748b' }]}>Cost Efficiency</Text>
                  <Text style={[styles.healthStatus, { color: pillColor(data.costEfficiencyStatus, darkMode).color }]}>
                    {data.costEfficiencyStatus}
                  </Text>
                </View>
                <View style={styles.healthRow}>
                  <Text style={[styles.label, { color: darkMode ? '#cbd5e1' : '#64748b' }]}>Schedule Efficiency</Text>
                  <Text style={[styles.healthStatus, { color: pillColor(data.scheduleEfficiencyStatus, darkMode).color }]}>
                    {data.scheduleEfficiencyStatus}
                  </Text>
                </View>
                <View style={styles.projectStatusSection}>
                  <Text style={[styles.label, { color: darkMode ? '#cbd5e1' : '#64748b' }]}>Project Status</Text>
                  <View style={[
                    styles.statusPill,
                    {
                      backgroundColor: pillColor(data.overallStatus, darkMode).backgroundColor,
                      borderColor: pillColor(data.overallStatus, darkMode).borderColor,
                    }
                  ]}>
                    <Text style={[styles.statusPillText, { color: pillColor(data.overallStatus, darkMode).color }]}>
                      {data.overallStatus}
                    </Text>
                  </View>
                </View>
              </SectionCard>
            </View>

            {/* Team */}
            <SectionCard title="Team">
              <View style={styles.teamContainer}>
                <View style={styles.teamColumn}>
                  <LabeledRow label="PM" value={data.team.pm || "—"} />
                  <LabeledRow label="Active Subs" value={`${data.team.activeSubs ?? 0}`} />
                </View>
                <View style={styles.teamColumn}>
                  <LabeledRow label="Crew Count" value={`${data.team.crewCount ?? 0}`} />
                </View>
              </View>
            </SectionCard>

            {/* Quick Actions */}
            <View style={styles.actionsRow}>
              <ActionButton label="Add Expense" onPress={() => Alert.alert('Add Expense', 'Feature coming soon!')} />
              <ActionButton label="Add Milestone" onPress={() => Alert.alert('Add Milestone', 'Feature coming soon!')} />
            </View>
            <View style={styles.actionsRow}>
              <ActionButton label="Upload File" onPress={() => Alert.alert('Upload File', 'Feature coming soon!')} />
              <ActionButton label="Send Update" onPress={() => Alert.alert('Send Update', 'Feature coming soon!')} />
            </View>
          </View>
        )}

        {activeTab === "Budget" && <BudgetTab projectData={data} />}
        {activeTab === "Timeline" && <TimelineTab projectData={data} />}
        {activeTab === "Team" && <TeamTab projectData={data} />}
        {activeTab === "Messages" && <CommunicationsTab projectData={data} />}
      </ScrollView>
    </Container>
  );
}

// Subcomponents ----------------------------------------------------
const StatusChip: React.FC<{ status: ProjectOverviewData["status"] }> = ({ status }) => {
  const statusStyles: Record<ProjectOverviewData["status"], any> = {
    Won: { backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#10b981', borderColor: 'rgba(34, 197, 94, 0.4)' },
    Active: { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.4)' },
    "On Hold": { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' },
    Completed: { backgroundColor: 'rgba(100, 116, 139, 0.2)', color: '#64748b', borderColor: 'rgba(100, 116, 139, 0.4)' },
  };
  
  return (
    <View style={[styles.statusChip, statusStyles[status]]}>
      <Text style={[styles.statusChipText, { color: statusStyles[status].color }]}>{status}</Text>
    </View>
  );
};

const ActionButton: React.FC<{ label: string; onPress?: () => void }> = ({ label, onPress }) => {
  const { darkMode } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.actionButton,
        { backgroundColor: darkMode ? 'rgba(30, 41, 59, 0.6)' : 'rgba(248, 250, 252, 0.6)' }
      ]}
    >
      <Text style={[styles.actionButtonText, { color: darkMode ? '#f1f5f9' : '#1e293b' }]}>{label}</Text>
    </TouchableOpacity>
  );
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Mock data for quick preview -------------------------------------
export const mock: ProjectOverviewData = {
  title: "Office Building Renovation",
  status: "Won",
  progressPct: 75,
  budgeted: 250000,
  spent: 180000,
  startDate: "2025-01-15",
  endDate: "2025-04-30",
  daysLeft: 42,
  nextMilestone: { title: "HVAC Install", date: "2025-03-12" },
  aheadBehindLabel: "3 Days Behind",
  costEfficiencyStatus: "Good",
  scheduleEfficiencyStatus: "At Risk",
  overallStatus: "On Track",
  team: { pm: "John Smith", activeSubs: 4, crewCount: 12 },
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
    borderRadius: 18,
    borderWidth: 1,
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
  // Tab styles
  tabContainer: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  // Budget tab styles
  budgetItem: {
    marginBottom: 16,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetCategory: {
    fontSize: 16,
    fontWeight: '600',
  },
  budgetAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  budgetBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  budgetBarFill: {
    height: 8,
    borderRadius: 4,
  },
  budgetPercentage: {
    fontSize: 12,
    textAlign: 'right',
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  expenseDescription: {
    flex: 1,
    fontSize: 16,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  expenseDate: {
    fontSize: 12,
  },
  // Timeline tab styles
  phaseItem: {
    marginBottom: 16,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  phaseStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  phaseName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  phaseProgress: {
    fontSize: 14,
    fontWeight: '600',
  },
  phaseBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  phaseBarFill: {
    height: 6,
    borderRadius: 3,
  },
  phaseDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  phaseDate: {
    fontSize: 12,
  },
  // Team tab styles
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 14,
  },
  memberStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
  },
  taskCount: {
    fontSize: 12,
  },
  // Communications tab styles
  commSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  messageAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  messageInfo: {
    flex: 1,
  },
  messageAuthor: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageTime: {
    fontSize: 12,
  },
  messageType: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  messageTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionButtons: {
    gap: 12,
  },
});
