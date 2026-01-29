import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/**
 * Build Profit Solutions — Predictive Alerts System
 * AI-powered alerts for schedule delays, budget overruns, and crew needs
 */

// ---------- Types ----------
export type AlertType =
  | 'schedule'
  | 'budget'
  | 'crew'
  | 'materials'
  | 'weather'
  | 'safety';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type PredictiveAlert = {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  prediction: string;
  confidence: number; // 0-100
  impact: {
    cost?: number;
    days?: number;
    crew?: number;
  };
  recommendations: string[];
  createdAt: Date;
  acknowledged: boolean;
  dismissed: boolean;
};

export type ProjectMetrics = {
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
  crewCount: number;
  tasksCompleted: number;
  totalTasks: number;
  dailyLogs: any[];
  weatherForecast: any[];
};

// ---------- Theme ----------
const palette = {
  dark: {
    bg: 'transparent',
    card: '#1B365D',
    text: '#FFFFFF',
    sub: 'rgba(255,255,255,0.8)',
    divider: 'rgba(255,255,255,0.2)',
    primary: '#22C55E',
    warning: '#FACC15',
    danger: '#EF4444',
    accent: '#22C55E',
  },
  light: {
    bg: '#F6F8FB',
    card: '#FFFFFF',
    text: '#0A1A2B',
    sub: '#5A6B7C',
    divider: 'rgba(0,0,0,0.06)',
    primary: '#16A34A',
    warning: '#B45309',
    danger: '#DC2626',
    accent: '#16A34A',
  },
};

export type ThemeName = keyof typeof palette;

// ---------- AI Service Mock (Replace with real AI integration) ----------
const AIService = {
  generatePredictiveAlerts: async (
    metrics: ProjectMetrics
  ): Promise<PredictiveAlert[]> => {
    const alerts: PredictiveAlert[] = [];

    // Budget analysis
    const budgetUsed = (metrics.spent / metrics.budget) * 100;
    const progress = (metrics.tasksCompleted / metrics.totalTasks) * 100;

    if (budgetUsed > progress + 10) {
      alerts.push({
        id: 'budget-1',
        type: 'budget',
        severity: 'high',
        title: 'Budget Overrun Risk',
        message:
          "You're spending faster than progress suggests. At current rate, you may exceed budget by 15-20%.",
        prediction:
          'Project likely to go $8,500 over budget if spending continues at current rate.',
        confidence: 85,
        impact: { cost: 8500 },
        recommendations: [
          'Review and prioritize remaining tasks',
          'Negotiate better material prices',
          'Consider value engineering options',
        ],
        createdAt: new Date(),
        acknowledged: false,
        dismissed: false,
      });
    }

    // Schedule analysis
    const daysLeft = Math.ceil(
      (new Date(metrics.endDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const tasksRemaining = metrics.totalTasks - metrics.tasksCompleted;
    const estimatedDaysNeeded = tasksRemaining * 1.5; // Assume 1.5 days per task

    if (estimatedDaysNeeded > daysLeft) {
      const daysBehind = estimatedDaysNeeded - daysLeft;
      alerts.push({
        id: 'schedule-1',
        type: 'schedule',
        severity: daysBehind > 14 ? 'critical' : 'high',
        title: 'Schedule Delay Predicted',
        message: `Based on current progress, you're trending ${daysBehind} days behind schedule.`,
        prediction: `Project likely to finish ${daysBehind} days late unless crew size increases by 2-3 members.`,
        confidence: 78,
        impact: { days: daysBehind, crew: 2 },
        recommendations: [
          'Increase crew size by 2-3 members',
          'Extend working hours or add weekend work',
          'Prioritize critical path tasks',
          'Consider extending project timeline',
        ],
        createdAt: new Date(),
        acknowledged: false,
        dismissed: false,
      });
    }

    // Crew analysis
    if (metrics.crewCount < 3) {
      alerts.push({
        id: 'crew-1',
        type: 'crew',
        severity: 'medium',
        title: 'Low Crew Count Detected',
        message:
          'Current crew size may be insufficient for optimal productivity.',
        prediction:
          'Adding 2 more crew members could improve productivity by 40% and reduce project duration by 8-10 days.',
        confidence: 72,
        impact: { crew: 2, days: -8 },
        recommendations: [
          'Hire 2 additional skilled workers',
          'Consider subcontracting specific trades',
          'Implement overtime for existing crew',
        ],
        createdAt: new Date(),
        acknowledged: false,
        dismissed: false,
      });
    }

    // Weather analysis
    const upcomingRain = metrics.weatherForecast.filter(
      day =>
        day.condition.toLowerCase().includes('rain') ||
        day.condition.toLowerCase().includes('storm')
    ).length;

    if (upcomingRain > 2) {
      alerts.push({
        id: 'weather-1',
        type: 'weather',
        severity: 'medium',
        title: 'Weather Impact Warning',
        message: `${upcomingRain} days of rain forecasted in the next week.`,
        prediction:
          'Weather delays could push schedule back by 3-5 days, especially for exterior work.',
        confidence: 65,
        impact: { days: 4 },
        recommendations: [
          'Focus on interior work during rainy days',
          'Protect materials and equipment',
          'Adjust schedule to prioritize weather-dependent tasks',
        ],
        createdAt: new Date(),
        acknowledged: false,
        dismissed: false,
      });
    }

    // Material delivery analysis
    alerts.push({
      id: 'materials-1',
      type: 'materials',
      severity: 'low',
      title: 'Material Cost Increase Alert',
      message:
        'Lumber prices have increased 12% this month. Consider ordering now.',
      prediction:
        'Delaying material orders by 2 weeks could increase costs by $2,300.',
      confidence: 60,
      impact: { cost: 2300 },
      recommendations: [
        'Order materials for next phase immediately',
        'Lock in current prices with suppliers',
        'Consider alternative materials',
      ],
      createdAt: new Date(),
      acknowledged: false,
      dismissed: false,
    });

    return alerts;
  },
};

// ---------- Components ----------
const AlertCard: React.FC<{
  alert: PredictiveAlert;
  theme: ThemeName;
  onAcknowledge: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onViewDetails: (alert: PredictiveAlert) => void;
}> = ({ alert, theme, onAcknowledge, onDismiss, onViewDetails }) => {
  const c = palette[theme];

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return c.danger;
      case 'high':
        return c.warning;
      case 'medium':
        return c.primary;
      default:
        return c.sub;
    }
  };

  const getTypeIcon = (type: AlertType) => {
    switch (type) {
      case 'schedule':
        return 'time';
      case 'budget':
        return 'wallet';
      case 'crew':
        return 'people';
      case 'materials':
        return 'cube';
      case 'weather':
        return 'partly-sunny';
      case 'safety':
        return 'shield';
      default:
        return 'alert-circle';
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'warning';
      case 'high':
        return 'alert-circle';
      case 'medium':
        return 'information-circle';
      default:
        return 'checkmark-circle';
    }
  };

  return (
    <View style={[styles.alertCard, { backgroundColor: c.card }]}>
      <View style={styles.alertHeader}>
        <View style={styles.alertTitleRow}>
          <Ionicons
            name={getTypeIcon(alert.type)}
            size={20}
            color={getSeverityColor(alert.severity)}
          />
          <Text style={[styles.alertTitle, { color: c.text }]}>
            {alert.title}
          </Text>
          <View
            style={[
              styles.severityBadge,
              { backgroundColor: getSeverityColor(alert.severity) + '33' },
            ]}
          >
            <Ionicons
              name={getSeverityIcon(alert.severity)}
              size={12}
              color={getSeverityColor(alert.severity)}
            />
            <Text
              style={[
                styles.severityText,
                { color: getSeverityColor(alert.severity) },
              ]}
            >
              {alert.severity.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={[styles.alertMessage, { color: c.sub }]}>
          {alert.message}
        </Text>
      </View>

      <View style={styles.alertContent}>
        <View style={styles.predictionContainer}>
          <Text style={[styles.predictionLabel, { color: c.text }]}>
            AI Prediction:
          </Text>
          <Text style={[styles.predictionText, { color: c.sub }]}>
            {alert.prediction}
          </Text>
        </View>

        <View style={styles.confidenceContainer}>
          <Text style={[styles.confidenceLabel, { color: c.text }]}>
            Confidence:
          </Text>
          <View style={[styles.confidenceBar, { backgroundColor: c.divider }]}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${alert.confidence}%`,
                  backgroundColor:
                    alert.confidence > 80
                      ? c.primary
                      : alert.confidence > 60
                        ? c.warning
                        : c.danger,
                },
              ]}
            />
          </View>
          <Text style={[styles.confidenceText, { color: c.sub }]}>
            {alert.confidence}%
          </Text>
        </View>

        {alert.impact.cost && (
          <View style={styles.impactItem}>
            <Ionicons name='wallet' size={16} color={c.warning} />
            <Text style={[styles.impactText, { color: c.sub }]}>
              Cost Impact: ${alert.impact.cost.toLocaleString()}
            </Text>
          </View>
        )}

        {alert.impact.days && (
          <View style={styles.impactItem}>
            <Ionicons name='calendar' size={16} color={c.primary} />
            <Text style={[styles.impactText, { color: c.sub }]}>
              Schedule Impact: {alert.impact.days > 0 ? '+' : ''}
              {alert.impact.days} days
            </Text>
          </View>
        )}

        {alert.impact.crew && (
          <View style={styles.impactItem}>
            <Ionicons name='people' size={16} color={c.accent} />
            <Text style={[styles.impactText, { color: c.sub }]}>
              Crew Impact: {alert.impact.crew > 0 ? '+' : ''}
              {alert.impact.crew} members
            </Text>
          </View>
        )}
      </View>

      <View style={styles.alertActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: c.primary + '33' }]}
          onPress={() => onViewDetails(alert)}
        >
          <Ionicons name='eye' size={16} color={c.primary} />
          <Text style={[styles.actionButtonText, { color: c.primary }]}>
            View Details
          </Text>
        </TouchableOpacity>

        {!alert.acknowledged && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: c.warning + '33' }]}
            onPress={() => onAcknowledge(alert.id)}
          >
            <Ionicons name='checkmark' size={16} color={c.warning} />
            <Text style={[styles.actionButtonText, { color: c.warning }]}>
              Acknowledge
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: c.danger + '33' }]}
          onPress={() => onDismiss(alert.id)}
        >
          <Ionicons name='close' size={16} color={c.danger} />
          <Text style={[styles.actionButtonText, { color: c.danger }]}>
            Dismiss
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const AlertDetailsModal: React.FC<{
  alert: PredictiveAlert;
  theme: ThemeName;
  onClose: () => void;
}> = ({ alert, theme, onClose }) => {
  const c = palette[theme];

  return (
    <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.modalContent, { backgroundColor: c.card }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: c.text }]}>
            {alert.title}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name='close' size={24} color={c.sub} />
          </TouchableOpacity>
        </View>

        <View style={styles.modalBody}>
          <Text style={[styles.modalMessage, { color: c.sub }]}>
            {alert.message}
          </Text>

          <View style={styles.recommendationsSection}>
            <Text style={[styles.recommendationsTitle, { color: c.text }]}>
              Recommendations:
            </Text>
            {alert.recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Ionicons name='checkmark-circle' size={16} color={c.primary} />
                <Text style={[styles.recommendationText, { color: c.sub }]}>
                  {rec}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

// ---------- Main Component ----------
export const PredictiveAlerts: React.FC<{
  projectId: string;
  metrics: ProjectMetrics;
  theme?: ThemeName;
  onRefresh?: () => void;
}> = ({ projectId, metrics, theme = 'dark', onRefresh }) => {
  const c = palette[theme];
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<PredictiveAlert | null>(
    null
  );
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'critical'>(
    'all'
  );

  useEffect(() => {
    loadAlerts();
  }, [projectId, metrics]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const newAlerts = await AIService.generatePredictiveAlerts(metrics);
      setAlerts(newAlerts);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  };

  const handleDismiss = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, dismissed: true } : alert
      )
    );
  };

  const handleViewDetails = (alert: PredictiveAlert) => {
    setSelectedAlert(alert);
  };

  const filteredAlerts = alerts.filter(alert => {
    if (alert.dismissed) return false;
    switch (filter) {
      case 'unacknowledged':
        return !alert.acknowledged;
      case 'critical':
        return alert.severity === 'critical';
      default:
        return true;
    }
  });

  const getFilterCount = (filterType: string) => {
    switch (filterType) {
      case 'unacknowledged':
        return alerts.filter(a => !a.acknowledged && !a.dismissed).length;
      case 'critical':
        return alerts.filter(a => a.severity === 'critical' && !a.dismissed)
          .length;
      default:
        return alerts.filter(a => !a.dismissed).length;
    }
  };

  return (
    <LinearGradient
      colors={['#0b1c38', '#1B365D', '#43cea2']}
      style={styles.container}
    >
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: c.card }]}>
          <View style={styles.headerLeft}>
            <Ionicons name='bulb' size={24} color={c.primary} />
            <Text style={[styles.headerTitle, { color: c.text }]}>
              Predictive Alerts
            </Text>
          </View>
          <TouchableOpacity onPress={loadAlerts}>
            <Ionicons name='refresh' size={24} color={c.primary} />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={[styles.filters, { backgroundColor: c.card }]}>
          {(['all', 'unacknowledged', 'critical'] as const).map(filterType => (
            <TouchableOpacity
              key={filterType}
              style={[
                styles.filterButton,
                {
                  backgroundColor:
                    filter === filterType ? c.primary : 'transparent',
                  borderColor: c.divider,
                },
              ]}
              onPress={() => setFilter(filterType)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: filter === filterType ? '#FFFFFF' : c.sub },
                ]}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)} (
                {getFilterCount(filterType)})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Alerts List */}
        <FlatList
          data={filteredAlerts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <AlertCard
              alert={item}
              theme={theme}
              onAcknowledge={handleAcknowledge}
              onDismiss={handleDismiss}
              onViewDetails={handleViewDetails}
            />
          )}
          contentContainerStyle={styles.alertsList}
          showsVerticalScrollIndicator={false}
        />

        {/* Alert Details Modal */}
        {selectedAlert && (
          <AlertDetailsModal
            alert={selectedAlert}
            theme={theme}
            onClose={() => setSelectedAlert(null)}
          />
        )}
      </View>
    </LinearGradient>
  );
};

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screen: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  filters: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alertsList: {
    paddingBottom: 20,
  },
  alertCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  alertHeader: {
    marginBottom: 12,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  alertMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  alertContent: {
    marginBottom: 16,
  },
  predictionContainer: {
    marginBottom: 12,
  },
  predictionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  predictionText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  confidenceLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 30,
  },
  impactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  impactText: {
    fontSize: 14,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    gap: 16,
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  recommendationsSection: {
    gap: 8,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendationText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});

export default PredictiveAlerts;
