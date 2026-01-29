import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import type { Milestone } from '../src/types/timeline';

interface AITimelineInsightsProps {
  milestones: Milestone[];
  projectStartDate?: string;
  projectEndDate?: string;
}

interface Insight {
  type: 'warning' | 'risk' | 'success' | 'info';
  title: string;
  message: string;
  action?: string;
}

function analyzeTimeline(milestones: Milestone[]): { insights: Insight[]; overallRisk: 'low' | 'medium' | 'high' } {
  const insights: Insight[] = [];
  const today = new Date();
  
  // Calculate overall progress
  const totalProgress = milestones.reduce((sum, m) => sum + m.progressPct, 0) / milestones.length;
  
  // Check for overdue milestones
  const overdueMilestones = milestones.filter(m => {
    const planned = new Date(m.plannedDate);
    return m.status !== 'completed' && planned < today && m.progressPct < 100;
  });

  if (overdueMilestones.length > 0) {
    const delayDays = Math.floor((today.getTime() - new Date(overdueMilestones[0].plannedDate).getTime()) / (1000 * 60 * 60 * 24));
    insights.push({
      type: 'warning',
      title: `${overdueMilestones.length} Milestone${overdueMilestones.length > 1 ? 's' : ''} Behind Schedule`,
      message: `${overdueMilestones[0].title} is ${delayDays} days overdue. This may cascade to dependent tasks.`,
      action: 'Review schedule & reallocate resources'
    });
  }

  // Check dependencies at risk
  milestones.forEach(m => {
    if (m.dependsOnId && m.status === 'pending') {
      const dependency = milestones.find(dep => dep.id === m.dependsOnId);
      if (dependency && dependency.status === 'in_progress' && dependency.progressPct < 50) {
        const daysUntil = Math.floor((new Date(m.plannedDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        insights.push({
          type: 'risk',
          title: `${m.title} May Be Delayed`,
          message: `Depends on "${dependency.title}" (${dependency.progressPct}% complete). Start date in ${daysUntil} days at risk.`,
          action: 'Expedite upstream tasks'
        });
      }
    }
  });

  // Weather predictions for upcoming outdoor work
  const upcomingOutdoor = milestones.filter(m => {
    const daysUntil = Math.floor((new Date(m.plannedDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil > 0 && daysUntil < 14 && m.status === 'pending' && 
           (m.title.toLowerCase().includes('framing') || 
            m.title.toLowerCase().includes('foundation') ||
            m.title.toLowerCase().includes('roofing'));
  });

  if (upcomingOutdoor.length > 0) {
    insights.push({
      type: 'info',
      title: 'Weather Impact Warning',
      message: `${upcomingOutdoor[0].title} scheduled for outdoor work. Check 14-day forecast for potential delays.`,
      action: 'Review weather forecast & have contingency plan'
    });
  }

  // Budget variance warnings
  const budgetIssues = milestones.filter(m => m.costDelta && Math.abs(m.costDelta) > 1000);
  if (budgetIssues.length > 0) {
    const totalVariance = budgetIssues.reduce((sum, m) => sum + (m.costDelta || 0), 0);
    insights.push({
      type: totalVariance > 0 ? 'warning' : 'success',
      title: totalVariance > 0 ? 'Cost Overruns Detected' : 'Cost Savings Identified',
      message: `${Math.abs(totalVariance).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} ${totalVariance > 0 ? 'over' : 'under'} budget across ${budgetIssues.length} milestone${budgetIssues.length > 1 ? 's' : ''}.`,
      action: totalVariance > 0 ? 'Review cost estimates & negotiate' : 'Reallocate savings to contingency'
    });
  }

  // Progress predictions
  if (totalProgress < 30 && milestones.filter(m => m.status === 'completed').length > 0) {
    insights.push({
      type: 'info',
      title: 'Early Project Phase',
      message: `${totalProgress.toFixed(0)}% complete. Maintaining current pace will finish on schedule.`,
      action: 'Continue monitoring critical path'
    });
  } else if (totalProgress > 75) {
    insights.push({
      type: 'success',
      title: 'Approaching Completion',
      message: `${totalProgress.toFixed(0)}% complete. Focus on final inspections and punch list items.`,
      action: 'Schedule final walkthrough'
    });
  }

  // Determine overall risk
  let overallRisk: 'low' | 'medium' | 'high' = 'low';
  if (overdueMilestones.length > 2 || budgetIssues.filter(m => (m.costDelta || 0) > 0).length > 1) {
    overallRisk = 'high';
  } else if (overdueMilestones.length > 0 || insights.filter(i => i.type === 'warning' || i.type === 'risk').length > 0) {
    overallRisk = 'medium';
  }

  return { insights: insights.slice(0, 4), overallRisk }; // Limit to top 4 insights
}

export default function AITimelineInsights({ milestones }: AITimelineInsightsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const [analysis, setAnalysis] = useState<{ insights: Insight[]; overallRisk: 'low' | 'medium' | 'high' }>({ insights: [], overallRisk: 'low' });

  useEffect(() => {
    const result = analyzeTimeline(milestones);
    setAnalysis(result);
  }, [milestones]);

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  const heightInterpolate = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 400],
  });

  const getStatusColor = () => {
    switch (analysis.overallRisk) {
      case 'high': return '#ff6b6b';
      case 'medium': return '#ffd166';
      case 'low': return '#2ecc71';
    }
  };

  const getStatusEmoji = () => {
    switch (analysis.overallRisk) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
    }
  };

  const getStatusText = () => {
    switch (analysis.overallRisk) {
      case 'high': return 'High Risk - Immediate Action Required';
      case 'medium': return 'Medium Risk - Monitor Closely';
      case 'low': return 'On Track - Continue Current Pace';
    }
  };

  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'risk': return '🔴';
      case 'success': return '✅';
      case 'info': return '💡';
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.header, { borderLeftColor: getStatusColor() }]}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.aiIcon}>🤖</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>AI Timeline Insights</Text>
            <Text style={styles.subtitle}>
              {getStatusEmoji()} {getStatusText()}
            </Text>
          </View>
        </View>
        <Text style={styles.expandIcon}>{isExpanded ? '−' : '+'}</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.content, { height: heightInterpolate, opacity: animatedHeight }]}>
        {analysis.insights.length > 0 ? (
          analysis.insights.map((insight, index) => (
            <View key={index} style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Text style={styles.insightIcon}>{getInsightIcon(insight.type)}</Text>
                <Text style={styles.insightTitle}>{insight.title}</Text>
              </View>
              <Text style={styles.insightMessage}>{insight.message}</Text>
              {insight.action && (
                <View style={styles.actionBox}>
                  <Text style={styles.actionLabel}>💼 Recommended Action:</Text>
                  <Text style={styles.actionText}>{insight.action}</Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyText}>No issues detected!</Text>
            <Text style={styles.emptySubtext}>All milestones are on track</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#173659',
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderLeftWidth: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  aiIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#e9f1ff',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#a7bed9',
    fontSize: 13,
    marginTop: 2,
  },
  expandIcon: {
    color: '#e9f1ff',
    fontSize: 24,
    fontWeight: '700',
    width: 30,
    textAlign: 'center',
  },
  content: {
    overflow: 'hidden',
  },
  insightCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    margin: 12,
    marginTop: 0,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  insightTitle: {
    color: '#e9f1ff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  insightMessage: {
    color: '#a7bed9',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  actionBox: {
    backgroundColor: 'rgba(77, 210, 167, 0.1)',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4dd2a7',
  },
  actionLabel: {
    color: '#4dd2a7',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  actionText: {
    color: '#e9f1ff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#e9f1ff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtext: {
    color: '#a7bed9',
    fontSize: 14,
  },
}); 