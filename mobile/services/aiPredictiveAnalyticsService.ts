import Constants from 'expo-constants';
import { calcOverrunRatio, formatOverrunPercent, formatOverrunImpact } from '../utils/formatters';

interface PredictiveInsight {
  type:
    | 'cost_trend'
    | 'schedule_risk'
    | 'budget_alert'
    | 'efficiency_tip'
    | 'market_insight';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  impact: string;
  recommendation: string;
  confidence: number;
  timeframe: string;
}

interface AnalyticsData {
  insights: PredictiveInsight[];
  trends: {
    spendingTrend: 'increasing' | 'decreasing' | 'stable';
    efficiencyTrend: 'improving' | 'declining' | 'stable';
    riskLevel: 'low' | 'medium' | 'high';
  };
  predictions: {
    completionDate: string;
    finalCost: number;
    costVariance: number;
    scheduleVariance: number;
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

interface ProjectData {
  budgeted: number;
  spent: number;
  startISO: string;
  endISO: string;
  buckets: Array<{
    id: string;
    name: string;
    budget: number;
    spent: number;
  }>;
  expenses?: Array<{
    id: string;
    amount: number;
    date?: string;
    category?: string;
  }>;
  changeOrders?: Array<{
    id: string;
    amount: number;
    approved: boolean;
  }>;
}

class AIPredictiveAnalyticsService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl =
      Constants.expoConfig?.extra?.apiBaseUrl ||
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      'http://localhost:3001';
  }

  async generateAnalytics(projectData: ProjectData): Promise<AnalyticsData> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/ai/predictive-analytics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(projectData),
        }
      );

      if (!response.ok) {
        throw new Error(`Predictive analytics API error: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error in AIPredictiveAnalyticsService:', error);
      // Return mock analytics for development
      return this.generateMockAnalytics(projectData);
    }
  }

  private generateMockAnalytics(projectData: ProjectData): AnalyticsData {
    const currentProgress = this.calculateProgress(projectData);
    const burnRate = this.calculateBurnRate(projectData);
    const projectedTotal = this.calculateProjectedTotal(projectData, burnRate);

    const insights: PredictiveInsight[] = [];

    // Cost trend insight
    const overrunRatio = calcOverrunRatio(projectedTotal, projectData.budgeted);
    const variancePercentDisplay = formatOverrunPercent(overrunRatio);
    const overrunImpact = formatOverrunImpact(projectedTotal, projectData.budgeted);
    
    if (projectedTotal > projectData.budgeted * 1.1) {
      insights.push({
        type: 'cost_trend',
        severity: 'critical',
        title: 'Budget Overrun Risk',
        message: `Project is trending ${variancePercentDisplay} over budget`,
        impact: `Potential overrun: ${overrunImpact}`,
        recommendation: 'Implement cost control measures and review scope',
        confidence: 85,
        timeframe: 'Next 30 days',
      });
    } else if (projectedTotal > projectData.budgeted) {
      insights.push({
        type: 'cost_trend',
        severity: 'warning',
        title: 'Budget Pressure',
        message: 'Project costs are trending above budget',
        impact: `Potential overrun: ${overrunImpact}`,
        recommendation:
          'Monitor spending closely and consider value engineering',
        confidence: 75,
        timeframe: 'Next 60 days',
      });
    } else {
      const underBudgetImpact = formatOverrunImpact(projectData.budgeted, projectedTotal);
      insights.push({
        type: 'cost_trend',
        severity: 'info',
        title: 'Budget On Track',
        message: 'Project is trending within budget parameters',
        impact: `Under budget by: ${underBudgetImpact}`,
        recommendation: 'Continue current spending patterns',
        confidence: 80,
        timeframe: 'Ongoing',
      });
    }

    // Schedule risk insight
    const scheduleRisk = this.calculateScheduleRisk(
      projectData,
      currentProgress
    );
    if (scheduleRisk > 0.8) {
      insights.push({
        type: 'schedule_risk',
        severity: 'critical',
        title: 'Schedule Delay Risk',
        message: 'Project is at high risk of schedule delays',
        impact: 'Potential delay: 2-4 weeks',
        recommendation: 'Accelerate critical path activities',
        confidence: 90,
        timeframe: 'Next 2 weeks',
      });
    } else if (scheduleRisk > 0.6) {
      insights.push({
        type: 'schedule_risk',
        severity: 'warning',
        title: 'Schedule Pressure',
        message: 'Project timeline is under pressure',
        impact: 'Potential delay: 1-2 weeks',
        recommendation: 'Review resource allocation and dependencies',
        confidence: 75,
        timeframe: 'Next 4 weeks',
      });
    }

    // Efficiency tip
    const materialsCategory = projectData.buckets.find(b =>
      b.name.toLowerCase().includes('material')
    );
    if (
      materialsCategory &&
      materialsCategory.spent > materialsCategory.budget * 0.8
    ) {
      insights.push({
        type: 'efficiency_tip',
        severity: 'info',
        title: 'Materials Optimization',
        message: 'Materials spending is high - consider bulk purchasing',
        impact: 'Potential savings: 10-15%',
        recommendation: 'Negotiate bulk discounts with suppliers',
        confidence: 70,
        timeframe: 'Next 30 days',
      });
    }

    // Market insight
    insights.push({
      type: 'market_insight',
      severity: 'info',
      title: 'Market Conditions',
      message: 'Construction material prices are stable this quarter',
      impact: 'No significant cost pressure expected',
      recommendation: 'Proceed with planned purchases',
      confidence: 65,
      timeframe: 'Next 90 days',
    });

    const trends = {
      spendingTrend: (projectedTotal > projectData.budgeted ? 'increasing' : 'stable') as 'stable' | 'increasing' | 'decreasing',
      efficiencyTrend: (currentProgress > 0.7 ? 'improving' : 'stable') as 'stable' | 'improving' | 'declining',
      riskLevel: (projectedTotal > projectData.budgeted * 1.1
          ? 'high'
          : projectedTotal > projectData.budgeted
            ? 'medium'
            : 'low') as 'low' | 'medium' | 'high',
    };

    const predictions = {
      completionDate: this.calculateProjectedCompletion(
        projectData,
        currentProgress
      ),
      finalCost: Math.round(projectedTotal),
      costVariance: Math.min(99, Math.round(overrunRatio * 100)),
      scheduleVariance: Math.round(scheduleRisk * 100),
    };

    const recommendations = {
      immediate: [
        'Review weekly spending reports',
        'Verify all change orders are approved',
        'Update project stakeholders on budget status',
      ],
      shortTerm: [
        'Implement weekly budget reviews',
        'Negotiate supplier contracts',
        'Optimize labor scheduling',
      ],
      longTerm: [
        'Develop standardized budget templates',
        'Implement predictive analytics dashboard',
        'Create cost control procedures',
      ],
    };

    return {
      insights,
      trends,
      predictions,
      recommendations,
    };
  }

  private calculateProgress(projectData: ProjectData): number {
    const start = new Date(projectData.startISO);
    const end = new Date(projectData.endISO);
    const now = new Date();

    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays =
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    return Math.min(1, Math.max(0, elapsedDays / totalDays));
  }

  private calculateBurnRate(projectData: ProjectData): number {
    const progress = this.calculateProgress(projectData);
    if (progress === 0) return 0;
    return projectData.spent / progress;
  }

  private calculateProjectedTotal(
    projectData: ProjectData,
    burnRate: number
  ): number {
    const progress = this.calculateProgress(projectData);
    const remainingProgress = 1 - progress;

    // Add 15% buffer for typical construction overruns
    const projected = projectData.spent + burnRate * remainingProgress * 1.15;
    
    // Safety cap: prevent unrealistic projections from very early project progress
    // Cap at 2x the original budget as a reasonable maximum overrun
    const maxReasonableTotal = projectData.budgeted * 2;
    return Math.min(projected, maxReasonableTotal);
  }

  private calculateScheduleRisk(
    projectData: ProjectData,
    currentProgress: number
  ): number {
    // Simple schedule risk calculation based on progress vs time
    const start = new Date(projectData.startISO);
    const end = new Date(projectData.endISO);
    const now = new Date();

    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays =
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const expectedProgress = elapsedDays / totalDays;

    // Risk increases if actual progress is behind expected progress
    return Math.max(0, expectedProgress - currentProgress);
  }

  private calculateProjectedCompletion(
    projectData: ProjectData,
    currentProgress: number
  ): string {
    const start = new Date(projectData.startISO);
    const end = new Date(projectData.endISO);
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    // If behind schedule, project completion date
    const projectedDays = totalDays / currentProgress;
    const projectedDate = new Date(
      start.getTime() + projectedDays * 24 * 60 * 60 * 1000
    );

    return projectedDate.toLocaleDateString();
  }
}

const aiPredictiveAnalyticsService = new AIPredictiveAnalyticsService();
export default aiPredictiveAnalyticsService;
