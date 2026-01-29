/**
 * Predictive Analytics System
 * AI-powered predictions for lead conversion and revenue forecasting
 */

import { Lead, LeadStage } from '../types';
import { EnrichmentData } from '../enrichment/lead-enrichment';
import { AdvancedLeadScore } from '../ai/advanced-scoring';

export interface ConversionPrediction {
  leadId: string;
  probability: number; // 0-1
  confidence: number; // 0-1
  factors: Array<{
    factor: string;
    impact: number; // -1 to 1
    description: string;
  }>;
  timeframe: {
    min: number; // days
    max: number; // days
    mostLikely: number; // days
  };
  recommendations: string[];
}

export interface RevenueForecast {
  period: '7d' | '30d' | '90d' | '1y';
  predictedRevenue: number;
  confidence: number;
  breakdown: {
    highProbability: number;
    mediumProbability: number;
    lowProbability: number;
  };
  trends: Array<{
    date: string;
    predicted: number;
    actual?: number;
  }>;
}

export interface LeadInsights {
  leadId: string;
  conversionProbability: number;
  expectedValue: number;
  riskFactors: string[];
  opportunities: string[];
  nextBestAction: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface MarketTrends {
  projectType: string;
  demandTrend: 'increasing' | 'stable' | 'decreasing';
  avgConversionRate: number;
  avgProjectValue: number;
  seasonalFactor: number;
  competitionLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

/**
 * Predict lead conversion probability
 */
export function predictConversion(
  lead: Lead,
  enrichmentData?: EnrichmentData,
  historicalData?: any
): ConversionPrediction {
  
  const factors = analyzeConversionFactors(lead, enrichmentData);
  const probability = calculateConversionProbability(factors);
  const confidence = calculatePredictionConfidence(lead, enrichmentData);
  const timeframe = predictConversionTimeframe(lead, factors);
  const recommendations = generateConversionRecommendations(lead, factors);

  return {
    leadId: lead.id,
    probability,
    confidence,
    factors,
    timeframe,
    recommendations
  };
}

/**
 * Generate revenue forecast
 */
export function generateRevenueForecast(
  leads: Lead[],
  period: '7d' | '30d' | '90d' | '1y',
  historicalData?: any
): RevenueForecast {
  
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
  
  // Calculate predictions for each lead
  const predictions = leads.map(lead => predictConversion(lead));
  
  // Group by probability ranges
  const highProbability = predictions.filter(p => p.probability >= 0.7);
  const mediumProbability = predictions.filter(p => p.probability >= 0.4 && p.probability < 0.7);
  const lowProbability = predictions.filter(p => p.probability < 0.4);
  
  // Calculate predicted revenue
  const predictedRevenue = predictions.reduce((total, prediction) => {
    const lead = leads.find(l => l.id === prediction.leadId);
    if (!lead) return total;
    
    const avgBudget = ((lead.project.budgetMin || 0) + (lead.project.budgetMax || 0)) / 2;
    return total + (avgBudget * prediction.probability);
  }, 0);
  
  // Generate trends
  const trends = generateTrendData(leads, days);
  
  // Calculate overall confidence
  const confidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

  return {
    period,
    predictedRevenue,
    confidence,
    breakdown: {
      highProbability: highProbability.reduce((sum, p) => {
        const lead = leads.find(l => l.id === p.leadId);
        const avgBudget = lead ? ((lead.project.budgetMin || 0) + (lead.project.budgetMax || 0)) / 2 : 0;
        return sum + avgBudget;
      }, 0),
      mediumProbability: mediumProbability.reduce((sum, p) => {
        const lead = leads.find(l => l.id === p.leadId);
        const avgBudget = lead ? ((lead.project.budgetMin || 0) + (lead.project.budgetMax || 0)) / 2 : 0;
        return sum + avgBudget;
      }, 0),
      lowProbability: lowProbability.reduce((sum, p) => {
        const lead = leads.find(l => l.id === p.leadId);
        const avgBudget = lead ? ((lead.project.budgetMin || 0) + (lead.project.budgetMax || 0)) / 2 : 0;
        return sum + avgBudget;
      }, 0)
    },
    trends
  };
}

/**
 * Generate lead insights
 */
export function generateLeadInsights(
  lead: Lead,
  enrichmentData?: EnrichmentData
): LeadInsights {
  
  const conversionPrediction = predictConversion(lead, enrichmentData);
  const expectedValue = calculateExpectedValue(lead, conversionPrediction.probability);
  const riskFactors = identifyRiskFactors(lead, enrichmentData);
  const opportunities = identifyOpportunities(lead, enrichmentData);
  const nextBestAction = determineNextBestAction(lead, conversionPrediction);
  const urgency = determineUrgency(lead, conversionPrediction);

  return {
    leadId: lead.id,
    conversionProbability: conversionPrediction.probability,
    expectedValue,
    riskFactors,
    opportunities,
    nextBestAction,
    urgency
  };
}

/**
 * Analyze market trends
 */
export function analyzeMarketTrends(
  leads: Lead[],
  projectType?: string
): MarketTrends[] {
  
  const projectTypes = projectType ? [projectType] : 
    Array.from(new Set(leads.map(l => l.project.type)));
  
  return projectTypes.map(type => {
    const typeLeads = leads.filter(l => l.project.type === type);
    const conversions = typeLeads.filter(l => l.stage === 'won');
    const avgConversionRate = typeLeads.length > 0 ? conversions.length / typeLeads.length : 0;
    
    const avgProjectValue = typeLeads.reduce((sum, l) => {
      return sum + ((l.project.budgetMin || 0) + (l.project.budgetMax || 0)) / 2;
    }, 0) / typeLeads.length;
    
    const demandTrend = analyzeDemandTrend(typeLeads);
    const seasonalFactor = calculateSeasonalFactor(type);
    const competitionLevel = assessCompetitionLevel(type, avgConversionRate);
    const recommendations = generateMarketRecommendations(type, demandTrend, competitionLevel);

    return {
      projectType: type,
      demandTrend,
      avgConversionRate,
      avgProjectValue: avgProjectValue || 0,
      seasonalFactor,
      competitionLevel,
      recommendations
    };
  });
}

// Helper functions

function analyzeConversionFactors(
  lead: Lead,
  enrichmentData?: EnrichmentData
): Array<{
  factor: string;
  impact: number;
  description: string;
}> {
  
  const factors = [];
  
  // AI Score impact
  const aiScore = lead.aiScore || 0;
  const scoreImpact = (aiScore - 50) / 100;
  factors.push({
    factor: 'AI Score',
    impact: scoreImpact,
    description: `AI score of ${aiScore} indicates ${scoreImpact > 0 ? 'high' : 'low'} conversion potential`
  });
  
  // Timeline impact
  const timelineImpact = lead.project.timeline === 'urgent' ? 0.3 : 
                        lead.project.timeline === 'soon' ? 0.1 : -0.1;
  factors.push({
    factor: 'Timeline',
    impact: timelineImpact,
    description: `${lead.project.timeline} timeline ${timelineImpact > 0 ? 'increases' : 'decreases'} urgency`
  });
  
  // Budget impact
  const avgBudget = ((lead.project.budgetMin || 0) + (lead.project.budgetMax || 0)) / 2;
  const budgetImpact = avgBudget > 50000 ? 0.2 : avgBudget > 25000 ? 0.1 : -0.1;
  factors.push({
    factor: 'Budget',
    impact: budgetImpact,
    description: `Budget of $${avgBudget.toLocaleString()} indicates ${budgetImpact > 0 ? 'good' : 'limited'} financial capacity`
  });
  
  // Verification impact
  const emailValid = lead.verification?.emailValid || false;
  const phoneValid = lead.verification?.phoneValid || false;
  const verificationImpact = (emailValid ? 0.1 : 0) + (phoneValid ? 0.1 : 0);
  factors.push({
    factor: 'Verification',
    impact: verificationImpact,
    description: `Contact verification ${verificationImpact > 0 ? 'validates' : 'lacks'} lead quality`
  });
  
  // Source impact
  const sourceImpact = lead.source === 'referral' ? 0.2 : 
                      lead.source === 'web' ? 0.1 : 0;
  factors.push({
    factor: 'Source',
    impact: sourceImpact,
    description: `${lead.source} source ${sourceImpact > 0 ? 'enhances' : 'provides standard'} conversion potential`
  });
  
  return factors;
}

function calculateConversionProbability(factors: Array<{ factor: string; impact: number; description: string }>): number {
  const baseProbability = 0.3; // Base 30% conversion rate
  const totalImpact = factors.reduce((sum, factor) => sum + factor.impact, 0);
  const adjustedProbability = baseProbability + (totalImpact * 0.5);
  
  return Math.max(0, Math.min(1, adjustedProbability));
}

function calculatePredictionConfidence(lead: Lead, enrichmentData?: EnrichmentData): number {
  let confidence = 0.5; // Base confidence
  
  // More data = higher confidence
  if (lead.contact.email && lead.contact.phone) confidence += 0.2;
  if (lead.project.budgetMin && lead.project.budgetMax) confidence += 0.1;
  if (lead.description) confidence += 0.1;
  if (enrichmentData?.verification.confidence) {
    confidence += enrichmentData.verification.confidence / 500; // Normalize to 0.2 max
  }
  
  return Math.min(1, confidence);
}

function predictConversionTimeframe(
  lead: Lead,
  factors: Array<{ factor: string; impact: number; description: string }>
): { min: number; max: number; mostLikely: number } {
  
  const baseTimeframe = 30; // Base 30 days
  const urgencyFactor = lead.project.timeline === 'urgent' ? 0.5 : 
                       lead.project.timeline === 'soon' ? 0.8 : 1.2;
  
  const mostLikely = Math.round(baseTimeframe * urgencyFactor);
  const min = Math.round(mostLikely * 0.5);
  const max = Math.round(mostLikely * 2);
  
  return { min, max, mostLikely };
}

function generateConversionRecommendations(
  lead: Lead,
  factors: Array<{ factor: string; impact: number; description: string }>
): string[] {
  
  const recommendations = [];
  
  // Low impact factors need attention
  const lowImpactFactors = factors.filter(f => f.impact < 0);
  lowImpactFactors.forEach(factor => {
    switch (factor.factor) {
      case 'Timeline':
        recommendations.push('Offer expedited service options to increase urgency');
        break;
      case 'Budget':
        recommendations.push('Provide financing options or phased payment plans');
        break;
      case 'Verification':
        recommendations.push('Verify contact information to improve lead quality');
        break;
    }
  });
  
  // High impact factors should be leveraged
  const highImpactFactors = factors.filter(f => f.impact > 0.1);
  highImpactFactors.forEach(factor => {
    switch (factor.factor) {
      case 'AI Score':
        recommendations.push('High AI score - prioritize immediate follow-up');
        break;
      case 'Source':
        recommendations.push('Leverage referral source for testimonials');
        break;
    }
  });
  
  return recommendations;
}

function calculateExpectedValue(lead: Lead, conversionProbability: number): number {
  const avgBudget = ((lead.project.budgetMin || 0) + (lead.project.budgetMax || 0)) / 2;
  return avgBudget * conversionProbability;
}

function identifyRiskFactors(lead: Lead, enrichmentData?: EnrichmentData): string[] {
  const risks = [];
  
  if ((lead.aiScore || 0) < 40) {
    risks.push('Low AI score indicates poor lead quality');
  }
  
  if (lead.project.timeline === 'flex') {
    risks.push('Flexible timeline may indicate low urgency');
  }
  
  if (!lead.verification?.emailValid && !lead.verification?.phoneValid) {
    risks.push('Unverified contact information');
  }
  
  if (lead.source === 'manual') {
    risks.push('Manual entry may indicate incomplete lead data');
  }
  
  return risks;
}

function identifyOpportunities(lead: Lead, enrichmentData?: EnrichmentData): string[] {
  const opportunities = [];
  
  if ((lead.aiScore || 0) > 80) {
    opportunities.push('High AI score - premium lead with strong conversion potential');
  }
  
  if (lead.project.timeline === 'urgent') {
    opportunities.push('Urgent timeline - opportunity for expedited service pricing');
  }
  
  if (lead.source === 'referral') {
    opportunities.push('Referral source - opportunity for testimonial and additional referrals');
  }
  
  if (enrichmentData?.contact.company) {
    opportunities.push('Company contact - potential for larger commercial projects');
  }
  
  return opportunities;
}

function determineNextBestAction(lead: Lead, prediction: ConversionPrediction): string {
  if (prediction.probability > 0.7) {
    return 'Immediate follow-up with detailed proposal';
  } else if (prediction.probability > 0.4) {
    return 'Schedule discovery call to understand needs better';
  } else {
    return 'Nurture with educational content and case studies';
  }
}

function determineUrgency(lead: Lead, prediction: ConversionPrediction): 'low' | 'medium' | 'high' {
  if (prediction.probability > 0.7 || lead.project.timeline === 'urgent') {
    return 'high';
  } else if (prediction.probability > 0.4 || lead.project.timeline === 'soon') {
    return 'medium';
  } else {
    return 'low';
  }
}

function generateTrendData(leads: Lead[], days: number): Array<{
  date: string;
  predicted: number;
  actual?: number;
}> {
  // Generate mock trend data
  const trends = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today.getTime() + (i * 24 * 60 * 60 * 1000));
    trends.push({
      date: date.toISOString().split('T')[0],
      predicted: Math.random() * 10000 + 5000, // Mock predicted revenue
    });
  }
  
  return trends;
}

function analyzeDemandTrend(leads: Lead[]): 'increasing' | 'stable' | 'decreasing' {
  // Simple trend analysis based on lead volume over time
  if (leads.length < 10) return 'stable';
  
  const sortedLeads = leads.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const recentLeads = sortedLeads.slice(-Math.floor(leads.length / 2));
  const olderLeads = sortedLeads.slice(0, Math.floor(leads.length / 2));
  
  const recentAvg = recentLeads.length / (recentLeads.length > 0 ? 1 : 1);
  const olderAvg = olderLeads.length / (olderLeads.length > 0 ? 1 : 1);
  
  if (recentAvg > olderAvg * 1.1) return 'increasing';
  if (recentAvg < olderAvg * 0.9) return 'decreasing';
  return 'stable';
}

function calculateSeasonalFactor(projectType: string): number {
  // Mock seasonal factors
  const seasonalFactors: Record<string, number> = {
    kitchen: 1.2, // Peak in spring/summer
    bathroom: 1.0,
    addition: 1.1,
    new_build: 0.9, // Slower in winter
    landscaping: 1.4, // Peak in spring
    other: 1.0
  };
  
  return seasonalFactors[projectType] || 1.0;
}

function assessCompetitionLevel(projectType: string, conversionRate: number): 'low' | 'medium' | 'high' {
  // Assess competition based on conversion rate and project type
  if (conversionRate < 0.15) return 'high';
  if (conversionRate < 0.25) return 'medium';
  return 'low';
}

function generateMarketRecommendations(
  projectType: string,
  demandTrend: 'increasing' | 'stable' | 'decreasing',
  competitionLevel: 'low' | 'medium' | 'high'
): string[] {
  
  const recommendations = [];
  
  if (demandTrend === 'increasing') {
    recommendations.push('Market demand is increasing - capitalize on growth opportunity');
  } else if (demandTrend === 'decreasing') {
    recommendations.push('Market demand is decreasing - focus on differentiation');
  }
  
  if (competitionLevel === 'high') {
    recommendations.push('High competition - emphasize unique value proposition');
  } else if (competitionLevel === 'low') {
    recommendations.push('Low competition - opportunity for market expansion');
  }
  
  recommendations.push(`Focus on ${projectType} specialization to build expertise`);
  
  return recommendations;
}


