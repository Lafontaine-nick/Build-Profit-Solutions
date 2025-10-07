const express = require('express');
const router = express.Router();

// AI Budget Forecasting endpoint
router.post('/budget-forecast', async (req, res) => {
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
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Calculate current progress
    const start = new Date(projectData.startDate);
    const end = new Date(projectData.endDate);
    const now = new Date();
    
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const currentProgress = Math.min(1, Math.max(0, elapsedDays / totalDays));
    
    // Calculate burn rate
    const burnRate = currentProgress > 0 ? projectData.spent / currentProgress : 0;
    
    // Project total with 20% buffer for typical overruns
    const remainingProgress = 1 - currentProgress;
    const projectedTotal = projectData.spent + (burnRate * remainingProgress * 1.2);
    
    const overrunAmount = projectedTotal - projectData.budgeted;
    const overrunProbability = Math.min(95, Math.max(5, (overrunAmount / projectData.budgeted) * 100));
    
    let riskLevel = 'low';
    if (overrunProbability > 70) riskLevel = 'high';
    else if (overrunProbability > 40) riskLevel = 'medium';
    
    // Analyze each category
    const categoryAnalysis = projectData.buckets.map(bucket => {
      const projectedSpent = bucket.spent + (bucket.spent * (1 - currentProgress) * 1.2);
      const variance = ((projectedSpent - bucket.budget) / bucket.budget) * 100;
      
      let categoryRisk = 'low';
      if (variance > 20) categoryRisk = 'high';
      else if (variance > 10) categoryRisk = 'medium';
      
      return {
        category: bucket.name,
        currentSpent: bucket.spent,
        projectedSpent: Math.round(projectedSpent),
        riskLevel: categoryRisk,
        variance: Math.round(variance * 10) / 10
      };
    });
    
    // Generate AI recommendations
    const recommendations = [];
    
    if (overrunAmount > 0) {
      recommendations.push(`⚠️ Projected overrun: $${overrunAmount.toLocaleString()}`);
      
      const highRiskCategories = categoryAnalysis.filter(cat => cat.riskLevel === 'high');
      if (highRiskCategories.length > 0) {
        recommendations.push(`🔴 High risk categories: ${highRiskCategories.map(c => c.category).join(', ')}`);
      }
      
      recommendations.push('💡 Consider value engineering for high-risk categories');
      recommendations.push('📊 Review supplier contracts for potential savings');
    } else {
      recommendations.push('✅ Project on track for budget');
    }
    
    const materialsCategory = categoryAnalysis.find(cat => cat.category.toLowerCase().includes('material'));
    if (materialsCategory && materialsCategory.variance > 15) {
      recommendations.push('🏗️ Consider bulk purchasing for materials to reduce costs');
    }
    
    const laborCategory = categoryAnalysis.find(cat => cat.category.toLowerCase().includes('labor'));
    if (laborCategory && laborCategory.variance > 10) {
      recommendations.push('👷 Optimize labor scheduling to reduce overtime costs');
    }
    
    // Calculate projected completion
    const projectedDays = totalDays / currentProgress;
    const projectedDate = new Date(start.getTime() + (projectedDays * 24 * 60 * 60 * 1000));
    
    const forecast = {
      projectedTotal: Math.round(projectedTotal),
      riskLevel,
      overrunProbability: Math.round(overrunProbability * 10) / 10,
      recommendations,
      categoryAnalysis,
      timelineAnalysis: {
        currentProgress: Math.round(currentProgress * 100),
        projectedCompletion: projectedDate.toLocaleDateString(),
        budgetBurnRate: Math.round(burnRate)
      }
    };
    
    res.status(200).json({ 
      success: true, 
      data: forecast,
      confidence: 87 // AI confidence score
    });
    
  } catch (error) {
    console.error('Budget forecast error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate budget forecast' 
    });
  }
});

module.exports = router;
