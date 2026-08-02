const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authenticateToken');

router.use(authenticateToken);

// AI Predictive Analytics endpoint
router.post('/predictive-analytics', async (req, res) => {
  try {
    const projectData = req.body;
    // Add data validation with defaults
    if (!projectData.buckets) {
      projectData.buckets = [];
    }
    if (!projectData.startDate) {
      projectData.startDate = new Date().toISOString();
    }
    if (!projectData.endDate) {
      projectData.endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (!projectData.budgeted) {
      projectData.budgeted = 100000;
    }
    if (!projectData.spent) {
      projectData.spent = 0;
    }

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Calculate current progress
    const start = new Date(projectData.startDate);
    const end = new Date(projectData.endDate);
    const now = new Date();
    
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const currentProgress = Math.min(1, Math.max(0, elapsedDays / totalDays));
    
    // Calculate burn rate and projections
    const burnRate = currentProgress > 0 ? projectData.spent / currentProgress : 0;
    const remainingProgress = 1 - currentProgress;
    const projectedTotalRaw = projectData.spent + (burnRate * remainingProgress * 1.15);
    
    // Clamp projected total to realistic range (0.5x - 3x of budget) to prevent insane calculations
    const budget = Math.max(projectData.budgeted || 100000, 1);
    const projectedTotal = Math.min(Math.max(projectedTotalRaw, budget * 0.5), budget * 3);
    
    const insights = [];
    
    // Helper: Safe percentage calculation (capped at 999%)
    const safePercent = (numerator, denominator) => {
      if (!denominator || denominator <= 0) return 0;
      const raw = (numerator / denominator) * 100;
      if (!isFinite(raw)) return 0;
      return Math.min(Math.max(Math.round(raw), 0), 999);
    };
    
    // Helper: Format money with K/M abbreviations
    const formatMoney = (amount) => {
      const abs = Math.abs(amount);
      if (abs >= 1000000) return `$${(abs / 1000000).toFixed(1)}M`;
      if (abs >= 1000) return `$${Math.round(abs / 1000)}K`;
      return `$${Math.round(abs).toLocaleString()}`;
    };
    
    // Cost trend insight
    if (projectedTotal > projectData.budgeted * 1.1) {
      const overrunAmount = projectedTotal - projectData.budgeted;
      const overrunPercent = safePercent(overrunAmount, projectData.budgeted);
      
      insights.push({
        type: 'cost_trend',
        severity: 'critical',
        title: 'Budget Overrun Risk',
        message: `Project is trending ${overrunPercent}% over budget`,
        impact: `Potential overrun: ${formatMoney(overrunAmount)}`,
        recommendation: 'Implement cost control measures and review scope',
        confidence: 85,
        timeframe: 'Next 30 days'
      });
    } else if (projectedTotal > projectData.budgeted) {
      const overrunAmount = projectedTotal - projectData.budgeted;
      
      insights.push({
        type: 'cost_trend',
        severity: 'warning',
        title: 'Budget Pressure',
        message: 'Project costs are trending above budget',
        impact: `Potential overrun: ${formatMoney(overrunAmount)}`,
        recommendation: 'Monitor spending closely and consider value engineering',
        confidence: 75,
        timeframe: 'Next 60 days'
      });
    } else {
      const underAmount = projectData.budgeted - projectedTotal;
      
      insights.push({
        type: 'cost_trend',
        severity: 'info',
        title: 'Budget On Track',
        message: 'Project is trending within budget parameters',
        impact: `Under budget by: ${formatMoney(underAmount)}`,
        recommendation: 'Continue current spending patterns',
        confidence: 80,
        timeframe: 'Ongoing'
      });
    }

    // Schedule risk insight
    const expectedProgress = elapsedDays / totalDays;
    const scheduleRisk = Math.max(0, expectedProgress - currentProgress);
    
    if (scheduleRisk > 0.8) {
      insights.push({
        type: 'schedule_risk',
        severity: 'critical',
        title: 'Schedule Delay Risk',
        message: 'Project is at high risk of schedule delays',
        impact: 'Potential delay: 2-4 weeks',
        recommendation: 'Accelerate critical path activities',
        confidence: 90,
        timeframe: 'Next 2 weeks'
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
        timeframe: 'Next 4 weeks'
      });
    }

    // Efficiency tip
    const materialsCategory = projectData.buckets.find(b => b.name.toLowerCase().includes('material'));
    if (materialsCategory && materialsCategory.spent > materialsCategory.budget * 0.8) {
      insights.push({
        type: 'efficiency_tip',
        severity: 'info',
        title: 'Materials Optimization',
        message: 'Materials spending is high - consider bulk purchasing',
        impact: 'Potential savings: 10-15%',
        recommendation: 'Negotiate bulk discounts with suppliers',
        confidence: 70,
        timeframe: 'Next 30 days'
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
      timeframe: 'Next 90 days'
    });

    const trends = {
      spendingTrend: projectedTotal > projectData.budgeted ? 'increasing' : 'stable',
      efficiencyTrend: currentProgress > 0.7 ? 'improving' : 'stable',
      riskLevel: projectedTotal > projectData.budgeted * 1.1 ? 'high' : 
                 projectedTotal > projectData.budgeted ? 'medium' : 'low'
    };

    // Calculate projected completion
    const projectedDays = totalDays / currentProgress;
    const projectedDate = new Date(start.getTime() + (projectedDays * 24 * 60 * 60 * 1000));

    const predictions = {
      completionDate: projectedDate.toLocaleDateString(),
      finalCost: Math.round(projectedTotal),
      costVariance: Math.round(((projectedTotal - projectData.budgeted) / projectData.budgeted) * 100),
      scheduleVariance: Math.round(scheduleRisk * 100)
    };

    const recommendations = {
      immediate: [
        'Review weekly spending reports',
        'Verify all change orders are approved',
        'Update project stakeholders on budget status'
      ],
      shortTerm: [
        'Implement weekly budget reviews',
        'Negotiate supplier contracts',
        'Optimize labor scheduling'
      ],
      longTerm: [
        'Develop standardized budget templates',
        'Implement predictive analytics dashboard',
        'Create cost control procedures'
      ]
    };

    const analytics = {
      insights,
      trends,
      predictions,
      recommendations
    };
    
    res.status(200).json({ 
      success: true, 
      data: analytics,
      confidence: 88
    });
    
  } catch (error) {
    console.error('Predictive analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate predictive analytics' 
    });
  }
});

module.exports = router;
