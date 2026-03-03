/**
 * Project Analysis Card Component
 * 
 * Renders structured project analysis responses in a card format
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ProjectAnalysisResponse } from '@/lib/ai/projectAnalysisTemplate';

type ProjectAnalysisCardProps = {
  analysis: ProjectAnalysisResponse;
  darkMode?: boolean;
  onAction?: (action: { type: string; [key: string]: any }) => void;
};

export default function ProjectAnalysisCard({
  analysis,
  darkMode = true,
  onAction,
}: ProjectAnalysisCardProps) {
  const Colors = {
    text: darkMode ? '#F9FAFB' : '#1e293b',
    subtext: darkMode ? '#8DA0B8' : '#64748b',
    surface: darkMode ? '#1a1a1a' : '#f8fafc',
    border: darkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    primary: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  };

  const handleAction = (action: { label: string; action: string; params?: Record<string, any> }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onAction) {
      onAction({
        type: action.action,
        ...action.params,
      });
    }
  };

  const getRiskColor = (risk: 'Low' | 'Medium' | 'High') => {
    switch (risk) {
      case 'High': return Colors.danger;
      case 'Medium': return Colors.warning;
      case 'Low': return Colors.primary;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: Colors.surface, borderColor: Colors.border }]}>
      {/* Summary Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Summary</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: Colors.subtext }]}>Budget</Text>
            <Text style={[styles.summaryValue, { color: Colors.text }]}>
              {analysis.summary.budgetStatus || 'Data needed'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: Colors.subtext }]}>Margin</Text>
            <Text style={[styles.summaryValue, { color: Colors.text }]}>
              {analysis.summary.marginStatus || 'Data needed'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: Colors.subtext }]}>Schedule</Text>
            <Text style={[styles.summaryValue, { color: Colors.text }]}>
              {analysis.summary.scheduleStatus || 'Data needed'}
            </Text>
          </View>
        </View>
      </View>

      {/* Budget & Costing */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Budget & Costing</Text>
        <View style={styles.budgetRow}>
          <View style={styles.budgetItem}>
            <Text style={[styles.budgetLabel, { color: Colors.subtext }]}>Planned</Text>
            <Text style={[styles.budgetValue, { color: Colors.text }]}>
              ${analysis.budgetAndCosting.planned.toLocaleString() || '0'}
            </Text>
          </View>
          <View style={styles.budgetItem}>
            <Text style={[styles.budgetLabel, { color: Colors.subtext }]}>Actual</Text>
            <Text style={[styles.budgetValue, { color: Colors.text }]}>
              ${analysis.budgetAndCosting.actual.toLocaleString() || '0'}
            </Text>
          </View>
        </View>
        
        {/* Material & Labor Breakdown */}
        {(analysis.budgetAndCosting.materialBudget > 0 || analysis.budgetAndCosting.laborBudget > 0) && (
          <View style={styles.breakdownContainer}>
            {/* Materials */}
            {analysis.budgetAndCosting.materialBudget > 0 && (
              <View style={styles.breakdownItem}>
                <Text style={[styles.breakdownLabel, { color: Colors.subtext }]}>Materials</Text>
                <Text style={[styles.breakdownValue, { color: Colors.text }]}>
                  ${analysis.budgetAndCosting.materialSpent?.toLocaleString() || '0'} / ${analysis.budgetAndCosting.materialBudget.toLocaleString()}
                </Text>
                <Text style={[styles.breakdownRemaining, { color: Colors.subtext }]}>
                  ${analysis.budgetAndCosting.materialRemaining?.toLocaleString() || '0'} remaining ({analysis.budgetAndCosting.materialSpentPct?.toFixed(1) || '0'}% used)
                </Text>
              </View>
            )}
            
            {/* Labor */}
            {analysis.budgetAndCosting.laborBudget > 0 && (
              <View style={styles.breakdownItem}>
                <Text style={[styles.breakdownLabel, { color: Colors.subtext }]}>Labor</Text>
                <Text style={[styles.breakdownValue, { color: Colors.text }]}>
                  ${analysis.budgetAndCosting.laborSpent?.toLocaleString() || '0'} / ${analysis.budgetAndCosting.laborBudget.toLocaleString()}
                </Text>
                <Text style={[styles.breakdownRemaining, { color: Colors.subtext }]}>
                  ${analysis.budgetAndCosting.laborRemaining?.toLocaleString() || '0'} remaining ({analysis.budgetAndCosting.laborSpentPct?.toFixed(1) || '0'}% used)
                </Text>
              </View>
            )}
          </View>
        )}
        
        {analysis.budgetAndCosting.topCostDrivers.length > 0 && (
          <View style={styles.driversContainer}>
            <Text style={[styles.driversTitle, { color: Colors.subtext }]}>Top Cost Drivers</Text>
            {analysis.budgetAndCosting.topCostDrivers.slice(0, 3).map((driver, idx) => (
              <View key={idx} style={styles.driverRow}>
                <Text style={[styles.driverName, { color: Colors.text }]}>{driver.name}</Text>
                <Text style={[styles.driverAmount, { color: Colors.text }]}>
                  ${driver.amount.toLocaleString()} ({driver.percentage}%)
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Profitability */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Profitability</Text>
        <View style={styles.profitabilityRow}>
          <View style={styles.profitabilityItem}>
            <Text style={[styles.profitabilityLabel, { color: Colors.subtext }]}>Current Margin</Text>
            <Text style={[styles.profitabilityValue, { color: Colors.text }]}>
              {analysis.profitability.currentMargin.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.profitabilityItem}>
            <Text style={[styles.profitabilityLabel, { color: Colors.subtext }]}>Target</Text>
            <Text style={[styles.profitabilityValue, { color: Colors.text }]}>
              {analysis.profitability.targetMargin.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.profitabilityItem}>
            <Text style={[styles.profitabilityLabel, { color: Colors.subtext }]}>Forecast</Text>
            <Text style={[styles.profitabilityValue, { color: Colors.text }]}>
              ${analysis.profitability.forecastAtCompletion.toLocaleString()}
            </Text>
          </View>
        </View>
        <View style={[styles.riskBadge, { backgroundColor: getRiskColor(analysis.profitability.riskLevel) + '20' }]}>
          <View style={[styles.riskDot, { backgroundColor: getRiskColor(analysis.profitability.riskLevel) }]} />
          <Text style={[styles.riskText, { color: getRiskColor(analysis.profitability.riskLevel) }]}>
            {analysis.profitability.riskLevel} Risk
          </Text>
          <Text style={[styles.riskReason, { color: Colors.subtext }]}>
            {analysis.profitability.riskReason}
          </Text>
        </View>
      </View>

      {/* Schedule */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Schedule</Text>
        {analysis.schedule.milestonesAtRisk.length > 0 && (
          <View style={styles.milestonesContainer}>
            <Text style={[styles.milestonesTitle, { color: Colors.subtext }]}>Milestones at Risk</Text>
            {analysis.schedule.milestonesAtRisk.map((milestone, idx) => (
              <View key={idx} style={styles.milestoneRow}>
                <MaterialIcons name="warning" size={16} color={Colors.warning} />
                <View style={styles.milestoneContent}>
                  <Text style={[styles.milestoneName, { color: Colors.text }]}>{milestone.name}</Text>
                  <Text style={[styles.milestoneRisk, { color: Colors.subtext }]}>{milestone.risk}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        {analysis.schedule.next7DayActions.length > 0 && (
          <View style={styles.actionsContainer}>
            <Text style={[styles.actionsTitle, { color: Colors.subtext }]}>Next 7 Days</Text>
            {analysis.schedule.next7DayActions.map((action, idx) => (
              <View key={idx} style={styles.actionItem}>
                <Text style={[styles.actionText, { color: Colors.text }]}>• {action}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Risks & Recommendations */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: Colors.text }]}>Risks & Recommendations</Text>
        {analysis.risksAndRecommendations.prioritizedActions.map((item, idx) => (
          <View key={idx} style={styles.recommendationRow}>
            <View style={[styles.priorityBadge, { backgroundColor: getRiskColor(item.priority) + '20' }]}>
              <Text style={[styles.priorityText, { color: getRiskColor(item.priority) }]}>
                {item.priority}
              </Text>
            </View>
            <View style={styles.recommendationContent}>
              <Text style={[styles.recommendationAction, { color: Colors.text }]}>{item.action}</Text>
              <Text style={[styles.recommendationReason, { color: Colors.subtext }]}>{item.reason}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Next Best Actions */}
      {analysis.nextBestActions.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.text }]}>Next Best Actions</Text>
          <View style={styles.actionsGrid}>
            {analysis.nextBestActions.map((action, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleAction(action)}
                activeOpacity={0.7}
                style={styles.actionButton}
              >
                <LinearGradient
                  colors={darkMode 
                    ? ['rgba(45, 255, 196, 0.15)', 'rgba(0, 166, 255, 0.15)']
                    : ['rgba(45, 255, 196, 0.1)', 'rgba(0, 166, 255, 0.1)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionButtonGradient}
                >
                  <Text style={[styles.actionButtonText, { color: Colors.primary }]}>
                    {action.label}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Data Needed Section */}
      {analysis.dataNeeded && analysis.dataNeeded.length > 0 && (
        <View style={[styles.section, styles.dataNeededSection]}>
          <Text style={[styles.sectionTitle, { color: Colors.warning }]}>Data Needed</Text>
          {analysis.dataNeeded.map((item, idx) => (
            <View key={idx} style={styles.dataNeededItem}>
              <MaterialIcons name="info" size={16} color={Colors.warning} />
              <View style={styles.dataNeededContent}>
                <Text style={[styles.dataNeededSectionName, { color: Colors.text }]}>{item.section}</Text>
                <Text style={[styles.dataNeededText, { color: Colors.subtext }]}>{item.missingData}</Text>
                <Text style={[styles.dataNeededNextStep, { color: Colors.primary }]}>
                  Next: {item.nextStep}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  budgetRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  budgetItem: {
    flex: 1,
  },
  budgetLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  budgetValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  breakdownContainer: {
    marginTop: 16,
    marginBottom: 12,
    gap: 12,
  },
  breakdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.05)',
    borderRadius: 8,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  breakdownRemaining: {
    fontSize: 12,
  },
  driversContainer: {
    marginTop: 12,
  },
  driversTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  driverName: {
    fontSize: 13,
    flex: 1,
  },
  driverAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  profitabilityRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  profitabilityItem: {
    flex: 1,
  },
  profitabilityLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  profitabilityValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  riskText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  riskReason: {
    fontSize: 12,
    flex: 1,
  },
  milestonesContainer: {
    marginTop: 8,
  },
  milestonesTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  milestoneContent: {
    flex: 1,
    marginLeft: 8,
  },
  milestoneName: {
    fontSize: 13,
    fontWeight: '600',
  },
  milestoneRisk: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsContainer: {
    marginTop: 12,
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  actionItem: {
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
  },
  recommendationRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationAction: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  recommendationReason: {
    fontSize: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minWidth: '45%',
  },
  actionButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.3)',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dataNeededSection: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  dataNeededItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  dataNeededContent: {
    flex: 1,
    marginLeft: 8,
  },
  dataNeededSectionName: {
    fontSize: 13,
    fontWeight: '600',
  },
  dataNeededText: {
    fontSize: 12,
    marginTop: 4,
  },
  dataNeededNextStep: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
