import Constants from 'expo-constants';

interface BudgetForecast {
  projectedTotal: number;
  riskLevel: 'low' | 'medium' | 'high';
  overrunProbability: number;
  recommendations: string[];
  categoryAnalysis: {
    category: string;
    currentSpent: number;
    projectedSpent: number;
    riskLevel: 'low' | 'medium' | 'high';
    variance: number;
  }[];
  timelineAnalysis: {
    currentProgress: number;
    projectedCompletion: string;
    budgetBurnRate: number;
  };
}

interface ProjectData {
  budgeted: number;
  spent: number;
  startDate: string;
  endDate: string;
  buckets: Array<{
    id: string;
    name: string;
    budget: number;
    spent: number;
  }>;
  expenses: Array<{
    id: string;
    amount: number;
    date: string;
    category?: string;
  }>;
}

class AIBudgetForecastingService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl =
      Constants.expoConfig?.extra?.apiBaseUrl ||
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      'http://localhost:3001';
  }

  async analyzeBudgetRisk(projectData: ProjectData): Promise<BudgetForecast> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/ai/budget-forecast`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(projectData),
        }
      );

      if (!response.ok) {
        throw new Error(`Budget forecast API error: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error in AIBudgetForecastingService:', error);
      // Return mock data for development
      return this.generateMockForecast(projectData);
    }
  }

  private generateMockForecast(projectData: ProjectData): BudgetForecast {
    const currentProgress = this.calculateProgress(projectData);
    const burnRate = this.calculateBurnRate(projectData);
    const projectedTotal = this.calculateProjectedTotal(projectData, burnRate);

    const overrunAmount = projectedTotal - projectData.budgeted;
    const overrunProbability = Math.min(
      95,
      Math.max(5, (overrunAmount / projectData.budgeted) * 100)
    );

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (overrunProbability > 70) riskLevel = 'high';
    else if (overrunProbability > 40) riskLevel = 'medium';

    const categoryAnalysis = projectData.buckets.map(bucket => {
      const projectedSpent =
        bucket.spent + bucket.spent * (1 - currentProgress) * 1.2;
      const variance = ((projectedSpent - bucket.budget) / bucket.budget) * 100;

      let categoryRisk: 'low' | 'medium' | 'high' = 'low';
      if (variance > 20) categoryRisk = 'high';
      else if (variance > 10) categoryRisk = 'medium';

      return {
        category: bucket.name,
        currentSpent: bucket.spent,
        projectedSpent,
        riskLevel: categoryRisk,
        variance,
      };
    });

    const recommendations = this.generateRecommendations(
      projectData,
      overrunAmount,
      categoryAnalysis
    );

    return {
      projectedTotal,
      riskLevel,
      overrunProbability,
      recommendations,
      categoryAnalysis,
      timelineAnalysis: {
        currentProgress,
        projectedCompletion: this.calculateProjectedCompletion(
          projectData,
          currentProgress
        ),
        budgetBurnRate: burnRate,
      },
    };
  }

  private calculateProgress(projectData: ProjectData): number {
    const start = new Date(projectData.startDate);
    const end = new Date(projectData.endDate);
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

    // Add 20% buffer for typical construction overruns
    return projectData.spent + burnRate * remainingProgress * 1.2;
  }

  private calculateProjectedCompletion(
    projectData: ProjectData,
    currentProgress: number
  ): string {
    const start = new Date(projectData.startDate);
    const end = new Date(projectData.endDate);
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    // If behind schedule, project completion date
    const projectedDays = totalDays / currentProgress;
    const projectedDate = new Date(
      start.getTime() + projectedDays * 24 * 60 * 60 * 1000
    );

    return projectedDate.toLocaleDateString();
  }

  private generateRecommendations(
    projectData: ProjectData,
    overrunAmount: number,
    categoryAnalysis: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (overrunAmount > 0) {
      recommendations.push(
        `⚠️ Projected overrun: $${overrunAmount.toLocaleString()}`
      );

      const highRiskCategories = categoryAnalysis.filter(
        cat => cat.riskLevel === 'high'
      );
      if (highRiskCategories.length > 0) {
        recommendations.push(
          `🔴 High risk categories: ${highRiskCategories.map(c => c.category).join(', ')}`
        );
      }

      recommendations.push(
        '💡 Consider value engineering for high-risk categories'
      );
      recommendations.push(
        '📊 Review supplier contracts for potential savings'
      );
    } else {
      recommendations.push('✅ Project on track for budget');
    }

    const materialsCategory = categoryAnalysis.find(cat =>
      cat.category.toLowerCase().includes('material')
    );
    if (materialsCategory && materialsCategory.variance > 15) {
      recommendations.push(
        '🏗️ Consider bulk purchasing for materials to reduce costs'
      );
    }

    const laborCategory = categoryAnalysis.find(cat =>
      cat.category.toLowerCase().includes('labor')
    );
    if (laborCategory && laborCategory.variance > 10) {
      recommendations.push(
        '👷 Optimize labor scheduling to reduce overtime costs'
      );
    }

    return recommendations;
  }
}

const aiBudgetForecastingService = new AIBudgetForecastingService();
export default aiBudgetForecastingService;
