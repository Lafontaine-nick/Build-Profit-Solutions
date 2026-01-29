import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type Project = {
  id: string;
  name: string;
  status: string;
  margin: number;
  location: string;
  missingLaborCost: boolean;
  progress?: number;
  overallProgressPct?: number; // Timeline-based progress
  lastUpdated?: string;
  priority?: 'low' | 'medium' | 'high';
  budget?: number;
  timeline?: {
    startDate: string;
    endDate: string;
    duration: number;
  };
  nextMilestone?: {
    name: string;
    dueDate: string;
  };
  teamSize?: number;
  costVariance?: number; // Percentage over/under budget
  actualCost?: number;
};

interface EnhancedProjectCardProps {
  project: Project;
  theme: any;
  onPress: (project: Project) => void;
  onDelete?: (project: Project) => void;
}

export default function EnhancedProjectCard({
  project,
  theme,
  onPress,
  onDelete,
}: EnhancedProjectCardProps) {
  const handlePress = () => {
    Haptics.selectionAsync();
    onPress(project);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onDelete) {
      onDelete(project);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
      case 'Won':
      case 'active':
        return theme.success; // Green for Active
      case 'completed':
        return '#2ecc71'; // Distinct shade of green for completed
      case 'in_progress':
        return theme.warning; // Yellow for In Progress
      case 'Lost':
        return theme.error;
      case 'completed':
        return theme.success;
      case 'bid_submitted':
      case 'Submitted':
        return theme.warning;
      default:
        return theme.border;
    }
  };

  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case 'won':
      case 'Won':
        if ((project.overallProgressPct ?? project.progress ?? 0) >= 100) {
          return 'Completed';
        }
        return 'Active';
      case 'in_progress':
        return 'In Progress';
      case 'bid_submitted':
        return 'Submitted';
      case 'estimate':
        return 'Draft';
      case 'completed':
        return 'Completed';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1); // Capitalize first letter
    }
  };

  // Color coding function for progress
  const getProgressColor = (progress: number) => {
    if (progress < 50) {
      return '#FF8C00'; // Orange for below 50%
    } else if (progress < 80) {
      return '#FFD700'; // Yellow for 50-80%
    } else {
      return '#32CD32'; // Green for 80-100%
    }
  };

  const getPriorityIcon = (priority?: string) => {
    // No priority icons displayed
    return null;
  };

  const progressPercent = project.overallProgressPct || project.progress || 0;
  const displayStatus =
    (project.status === 'won' || project.status === 'Won') && progressPercent >= 100
      ? 'completed'
      : project.status;

  // Calculate days remaining
  const getDaysRemaining = () => {
    if (!project.timeline?.endDate) return null;
    const endDate = new Date(project.timeline.endDate);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysRemaining();

  // Get timeline status
  const getTimelineStatus = () => {
    if (daysRemaining === null) return null;
    if (daysRemaining < 0) return { text: `${Math.abs(daysRemaining)}d overdue`, color: theme.error, icon: 'warning' };
    if (daysRemaining === 0) return { text: 'Due today', color: theme.warning, icon: 'today' };
    if (daysRemaining <= 7) return { text: `${daysRemaining}d left`, color: theme.warning, icon: 'schedule' };
    return { text: `${daysRemaining}d left`, color: theme.success, icon: 'schedule' };
  };

  const timelineStatus = getTimelineStatus();

  // Get cost variance status
  const getCostVarianceStatus = () => {
    if (project.costVariance === undefined) return null;
    if (project.costVariance > 10) return { text: `+${project.costVariance.toFixed(0)}% over`, color: theme.error, icon: 'trending-up' };
    if (project.costVariance < -10) return { text: `${Math.abs(project.costVariance).toFixed(0)}% under`, color: theme.success, icon: 'trending-down' };
    return { text: 'On budget', color: theme.success, icon: 'check-circle' };
  };

  const costVarianceStatus = getCostVarianceStatus();

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: theme.text,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.projectName, { color: theme.text }]}>
            {project.name}
          </Text>
          <Text style={[styles.location, { color: theme.subtext }]}>
            📍 {project.location}
          </Text>
          {/* Customer Information */}
          {(project.client || project.estimateData?.customerName || project.estimateData?.customerEmail || project.estimateData?.customerPhone) && (
            <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {(project.client || project.estimateData?.customerName) && (
                <Text style={{ color: theme.subtext, fontSize: 11 }}>
                  👤 {project.client || project.estimateData?.customerName}
                </Text>
              )}
              {(project.clientEmail || project.estimateData?.customerEmail) && (
                <Text style={{ color: theme.subtext, fontSize: 11 }}>
                  ✉️ {project.clientEmail || project.estimateData?.customerEmail}
                </Text>
              )}
              {(project.clientPhone || project.estimateData?.customerPhone) && (
                <Text style={{ color: theme.subtext, fontSize: 11 }}>
                  📞 {project.clientPhone || project.estimateData?.customerPhone}
                </Text>
              )}
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(displayStatus) },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: displayStatus === 'Draft' || displayStatus === 'estimate' ? theme.text : '#fff',
                },
              ]}
            >
              {getStatusDisplayText(displayStatus)}
            </Text>
          </View>
        </View>
      </View>

      {/* Info Row - Timeline & Cost */}
      {(timelineStatus || costVarianceStatus) && (
        <View style={styles.infoRow}>
          {timelineStatus && (
            <View style={[styles.infoBadge, { backgroundColor: `${timelineStatus.color}15` }]}>
              <MaterialIcons name={timelineStatus.icon as any} size={14} color={timelineStatus.color} />
              <Text style={[styles.infoBadgeText, { color: timelineStatus.color }]}>
                {timelineStatus.text}
              </Text>
            </View>
          )}
          {costVarianceStatus && (
            <View style={[styles.infoBadge, { backgroundColor: `${costVarianceStatus.color}15` }]}>
              <MaterialIcons name={costVarianceStatus.icon as any} size={14} color={costVarianceStatus.color} />
              <Text style={[styles.infoBadgeText, { color: costVarianceStatus.color }]}>
                {costVarianceStatus.text}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: theme.subtext }]}>
            Progress
          </Text>
          <Text style={[styles.progressPercent, { color: theme.text }]}>
            {progressPercent}%
          </Text>
        </View>
        <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: getProgressColor(progressPercent),
                width: `${progressPercent}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Next Milestone */}
      {project.nextMilestone && (
        <View style={[styles.milestoneSection, { backgroundColor: `${theme.accent}10`, borderColor: `${theme.accent}30` }]}>
          <View style={styles.milestoneHeader}>
            <MaterialIcons name="flag" size={16} color={theme.accent} />
            <Text style={[styles.milestoneLabel, { color: theme.subtext }]}>
              Next Milestone
            </Text>
          </View>
          <Text style={[styles.milestoneName, { color: theme.text }]}>
            {project.nextMilestone.name}
          </Text>
          <Text style={[styles.milestoneDate, { color: theme.subtext }]}>
            Due: {new Date(project.nextMilestone.dueDate).toLocaleDateString()}
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={[styles.budget, { color: theme.text }]}>
            {project.budget
              ? `$${project.budget.toLocaleString()}`
              : 'Budget TBD'}
          </Text>
          <View style={styles.footerMeta}>
            <Text style={[styles.margin, { color: theme.subtext }]}>
              {project.margin}% margin
            </Text>
            {project.teamSize && (
              <>
                <View style={styles.dot} />
                <MaterialIcons name="people" size={12} color={theme.subtext} />
                <Text style={[styles.teamSize, { color: theme.subtext }]}>
                  {project.teamSize}
                </Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.footerRight}>
          <Text style={[styles.lastUpdated, { color: theme.subtext }]}>
            {project.lastUpdated}
          </Text>
          <View style={styles.footerActions}>
            {onDelete && (
              <TouchableOpacity 
                style={[styles.deleteButton, { backgroundColor: `${theme.error}20`, borderColor: theme.error }]}
                onPress={handleDelete}
              >
                <MaterialIcons name="delete-outline" size={18} color={theme.error} />
                <Text style={[styles.deleteButtonText, { color: theme.error }]}>Delete</Text>
              </TouchableOpacity>
            )}
            <MaterialIcons name='chevron-right' size={24} color={theme.subtext} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLeft: {
    flex: 1,
  },
  footerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  footerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  budget: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  margin: {
    fontSize: 12,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#999',
    marginHorizontal: 6,
  },
  teamSize: {
    fontSize: 12,
    marginLeft: 4,
  },
  lastUpdated: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  infoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  milestoneSection: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  milestoneLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  milestoneName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  milestoneDate: {
    fontSize: 12,
  },
});
