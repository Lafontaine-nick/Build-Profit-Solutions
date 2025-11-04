const express = require('express');
const router = express.Router();

// Industry benchmarks by project type (based on RSMeans and industry data)
const PROJECT_TYPE_BENCHMARKS = {
  'residential_renovation': {
    materials: { min: 18, max: 28, optimal: 23 },
    labor: { min: 38, max: 55, optimal: 46 },
    overhead: { min: 12, max: 18, optimal: 15 },
    markup: { min: 15, max: 28, optimal: 20 }
  },
  'commercial_renovation': {
    materials: { min: 22, max: 32, optimal: 27 },
    labor: { min: 35, max: 50, optimal: 42 },
    overhead: { min: 15, max: 22, optimal: 18 },
    markup: { min: 12, max: 22, optimal: 16 }
  },
  'new_construction': {
    materials: { min: 25, max: 35, optimal: 30 },
    labor: { min: 32, max: 48, optimal: 40 },
    overhead: { min: 14, max: 20, optimal: 17 },
    markup: { min: 10, max: 20, optimal: 15 }
  },
  'remodel_kitchen': {
    materials: { min: 30, max: 40, optimal: 35 },
    labor: { min: 28, max: 42, optimal: 35 },
    overhead: { min: 12, max: 18, optimal: 15 },
    markup: { min: 18, max: 30, optimal: 22 }
  },
  'remodel_bathroom': {
    materials: { min: 32, max: 45, optimal: 38 },
    labor: { min: 25, max: 40, optimal: 32 },
    overhead: { min: 12, max: 18, optimal: 15 },
    markup: { min: 18, max: 28, optimal: 22 }
  },
  'roofing': {
    materials: { min: 35, max: 50, optimal: 42 },
    labor: { min: 22, max: 38, optimal: 30 },
    overhead: { min: 10, max: 16, optimal: 13 },
    markup: { min: 15, max: 25, optimal: 20 }
  },
  'flooring': {
    materials: { min: 40, max: 55, optimal: 48 },
    labor: { min: 18, max: 32, optimal: 25 },
    overhead: { min: 10, max: 16, optimal: 13 },
    markup: { min: 15, max: 25, optimal: 18 }
  },
  'painting': {
    materials: { min: 15, max: 25, optimal: 20 },
    labor: { min: 45, max: 65, optimal: 55 },
    overhead: { min: 8, max: 15, optimal: 12 },
    markup: { min: 12, max: 22, optimal: 16 }
  },
  'general': {
    materials: { min: 15, max: 30, optimal: 22 },
    labor: { min: 35, max: 60, optimal: 48 },
    overhead: { min: 10, max: 20, optimal: 15 },
    markup: { min: 15, max: 30, optimal: 20 }
  }
};

// Regional cost adjustments (based on construction cost indices)
const REGIONAL_ADJUSTMENTS = {
  'northeast': 1.15,
  'southeast': 0.92,
  'midwest': 0.95,
  'southwest': 0.98,
  'west': 1.18,
  'pacific': 1.25,
  'mountain': 1.05,
  'national': 1.0
};

// Analyze cost breakdown and provide insights
router.post('/analyze', async (req, res) => {
  try {
    const { 
      materials, 
      labor, 
      overhead, 
      markup, 
      total,
      projectType = 'general',
      region = 'national',
      sqft,
      location
    } = req.body;

    console.log(`📊 Analyzing cost breakdown for ${projectType} in ${region}`);

    // Get benchmarks for project type
    const benchmarks = PROJECT_TYPE_BENCHMARKS[projectType] || PROJECT_TYPE_BENCHMARKS['general'];
    const regionalMultiplier = REGIONAL_ADJUSTMENTS[region] || 1.0;

    // Calculate percentages
    const materialsPercentage = (materials / total) * 100;
    const laborPercentage = (labor / total) * 100;
    const overheadPercentage = (overhead / total) * 100;
    const markupPercentage = (markup / total) * 100;

    // Analyze each category
    const materialsAnalysis = analyzeCategory(
      materialsPercentage, 
      benchmarks.materials, 
      'Materials',
      regionalMultiplier
    );

    const laborAnalysis = analyzeCategory(
      laborPercentage, 
      benchmarks.labor, 
      'Labor',
      regionalMultiplier
    );

    const overheadAnalysis = analyzeCategory(
      overheadPercentage, 
      benchmarks.overhead, 
      'Overhead',
      regionalMultiplier
    );

    const markupAnalysis = analyzeCategory(
      markupPercentage, 
      benchmarks.markup, 
      'Markup',
      regionalMultiplier
    );

    // Calculate overall bid health score
    const healthScore = calculateHealthScore({
      materialsAnalysis,
      laborAnalysis,
      overheadAnalysis,
      markupAnalysis
    });

    // Generate recommendations
    const recommendations = generateRecommendations({
      materialsAnalysis,
      laborAnalysis,
      overheadAnalysis,
      markupAnalysis,
      projectType,
      total,
      sqft
    });

    res.json({
      analysis: {
        materials: materialsAnalysis,
        labor: laborAnalysis,
        overhead: overheadAnalysis,
        markup: markupAnalysis
      },
      benchmarks: {
        projectType,
        region,
        regionalMultiplier,
        standards: benchmarks
      },
      healthScore,
      recommendations,
      metadata: {
        total,
        sqft,
        pricePerSqft: sqft ? Math.round((total / sqft) * 100) / 100 : null,
        location
      }
    });

  } catch (error) {
    console.error('❌ Cost analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze cost breakdown' });
  }
});

// Analyze individual category
function analyzeCategory(actualPercentage, benchmark, categoryName, regionalMultiplier) {
  const adjustedMin = benchmark.min * regionalMultiplier;
  const adjustedMax = benchmark.max * regionalMultiplier;
  const adjustedOptimal = benchmark.optimal * regionalMultiplier;

  let status, message, severity;

  if (actualPercentage < adjustedMin) {
    status = 'low';
    severity = 'warning';
    const diff = Math.round((adjustedMin - actualPercentage) * 10) / 10;
    message = `${categoryName} is ${diff}% below industry benchmarks. This may impact quality or project success.`;
  } else if (actualPercentage > adjustedMax) {
    status = 'high';
    severity = 'warning';
    const diff = Math.round((actualPercentage - adjustedMax) * 10) / 10;
    message = `${categoryName} is ${diff}% above industry benchmarks. Consider reviewing costs to improve profitability.`;
  } else {
    status = 'optimal';
    severity = 'success';
    message = `${categoryName} is within industry benchmarks (${adjustedMin.toFixed(1)}-${adjustedMax.toFixed(1)}%). Well-balanced for this project type.`;
  }

  return {
    percentage: Math.round(actualPercentage * 10) / 10,
    status,
    severity,
    message,
    benchmark: {
      min: Math.round(adjustedMin * 10) / 10,
      max: Math.round(adjustedMax * 10) / 10,
      optimal: Math.round(adjustedOptimal * 10) / 10
    }
  };
}

// Calculate overall health score
function calculateHealthScore(analyses) {
  let score = 100;
  
  Object.values(analyses).forEach(analysis => {
    if (analysis.status === 'low' || analysis.status === 'high') {
      const deviation = Math.abs(analysis.percentage - analysis.benchmark.optimal);
      score -= Math.min(deviation, 15); // Max 15 points penalty per category
    }
  });

  return Math.max(0, Math.round(score));
}

// Generate recommendations
function generateRecommendations(data) {
  const recommendations = [];

  if (data.materialsAnalysis.status === 'high') {
    recommendations.push({
      category: 'materials',
      priority: 'high',
      suggestion: 'Review material suppliers and negotiate better pricing. Consider value engineering alternatives.',
      potentialSavings: Math.round((data.materialsAnalysis.percentage - data.materialsAnalysis.benchmark.optimal) * data.total / 100)
    });
  }

  if (data.laborAnalysis.status === 'high') {
    recommendations.push({
      category: 'labor',
      priority: 'medium',
      suggestion: 'Optimize crew efficiency or review labor hour estimates. Consider subcontracting strategies.',
      potentialSavings: Math.round((data.laborAnalysis.percentage - data.laborAnalysis.benchmark.optimal) * data.total / 100)
    });
  }

  if (data.overheadAnalysis.status === 'high') {
    recommendations.push({
      category: 'overhead',
      priority: 'medium',
      suggestion: 'Review fixed costs and operational expenses. Look for efficiency improvements in business operations.',
      potentialSavings: Math.round((data.overheadAnalysis.percentage - data.overheadAnalysis.benchmark.optimal) * data.total / 100)
    });
  }

  if (data.markupAnalysis.status === 'low') {
    recommendations.push({
      category: 'markup',
      priority: 'high',
      suggestion: `Current markup may not support sustainable business growth. Industry standard for ${data.projectType} is ${data.markupAnalysis.benchmark.optimal}%.`,
      potentialRevenue: Math.round((data.markupAnalysis.benchmark.optimal - data.markupAnalysis.percentage) * data.total / 100)
    });
  }

  if (data.markupAnalysis.status === 'high') {
    recommendations.push({
      category: 'markup',
      priority: 'low',
      suggestion: 'High markup may reduce competitiveness. Ensure your value proposition justifies premium pricing.',
      note: 'This is acceptable if you offer premium service or have unique market position.'
    });
  }

  return recommendations;
}

// Get available project types
router.get('/project-types', (req, res) => {
  res.json({
    projectTypes: Object.keys(PROJECT_TYPE_BENCHMARKS),
    regions: Object.keys(REGIONAL_ADJUSTMENTS)
  });
});

module.exports = router;




