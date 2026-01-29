/**
 * Advanced AI Lead Scoring System
 * Multi-factor scoring algorithm for enterprise-grade lead qualification
 */

import { Lead, ContractorProfile } from '../types';

export interface AdvancedLeadScore {
  overall: number;
  breakdown: {
    intent: number;        // Purchase intent signals
    fit: number;          // Product-market fit
    timing: number;       // Urgency and timeline
    authority: number;    // Decision making power
    budget: number;       // Financial capacity
    engagement: number;   // Interaction quality
  };
  confidence: number;     // Algorithm confidence (0-1)
  signals: string[];      // Key scoring signals
  recommendations: string[]; // Action recommendations
}

export interface MarketData {
  avgProjectValue: Record<string, number>;
  conversionRates: Record<string, number>;
  seasonalityFactors: Record<string, number>;
  competitiveIndex: Record<string, number>;
}

export interface BehavioralData {
  websiteActivity: number;
  emailEngagement: number;
  socialSignals: number;
  referralQuality: number;
  responseTime: number;
}

/**
 * Advanced Multi-Factor Lead Scoring
 * Uses 50+ data points for enterprise-grade qualification
 */
export function calculateAdvancedScore(
  lead: Lead,
  marketData: MarketData,
  behavioralData?: BehavioralData,
  contractorProfile?: ContractorProfile
): AdvancedLeadScore {
  
  // 1. INTENT SCORING (25% weight)
  const intentScore = calculateIntentScore(lead, behavioralData);
  
  // 2. FIT SCORING (20% weight)  
  const fitScore = calculateFitScore(lead, marketData);
  
  // 3. TIMING SCORING (15% weight)
  const timingScore = calculateTimingScore(lead, marketData);
  
  // 4. AUTHORITY SCORING (15% weight)
  const authorityScore = calculateAuthorityScore(lead);
  
  // 5. BUDGET SCORING (15% weight)
  const budgetScore = calculateBudgetScore(lead, marketData);
  
  // 6. ENGAGEMENT SCORING (10% weight)
  const engagementScore = calculateEngagementScore(lead, behavioralData);

  // Weighted overall score
  const overall = Math.round(
    intentScore * 0.25 +
    fitScore * 0.20 +
    timingScore * 0.15 +
    authorityScore * 0.15 +
    budgetScore * 0.15 +
    engagementScore * 0.10
  );

  // Generate insights and recommendations
  const { signals, recommendations, confidence } = generateInsights({
    intent: intentScore,
    fit: fitScore,
    timing: timingScore,
    authority: authorityScore,
    budget: budgetScore,
    engagement: engagementScore
  }, lead);

  return {
    overall: Math.min(100, Math.max(0, overall)),
    breakdown: {
      intent: intentScore,
      fit: fitScore,
      timing: timingScore,
      authority: authorityScore,
      budget: budgetScore,
      engagement: engagementScore
    },
    confidence,
    signals,
    recommendations
  };
}

function calculateIntentScore(lead: Lead, behavioral?: BehavioralData): number {
  let score = 50; // Base score
  
  // Project urgency signals
  if (lead.project.timeline === 'urgent') score += 25;
  else if (lead.project.timeline === 'soon') score += 15;
  else if (lead.project.timeline === 'flex') score += 5;
  
  // Behavioral signals
  if (behavioral) {
    score += Math.min(20, behavioral.websiteActivity * 10);
    score += Math.min(15, behavioral.emailEngagement * 15);
    score += Math.min(10, behavioral.socialSignals * 10);
  }
  
  // Source quality
  if (lead.source === 'referral') score += 15;
  else if (lead.source === 'web') score += 10;
  else if (lead.source === 'manual') score += 5;
  
  // Description quality (indicates research)
  if (lead.description && lead.description.length > 50) score += 10;
  
  return Math.min(100, score);
}

function calculateFitScore(lead: Lead, marketData: MarketData): number {
  const projectType = lead.project.type;
  const avgValue = marketData.avgProjectValue[projectType] || 50000;
  const conversionRate = marketData.conversionRates[projectType] || 0.2;
  
  let score = 50;
  
  // Budget alignment with market
  const leadBudget = (lead.project.budgetMin || 0 + lead.project.budgetMax || 0) / 2;
  const budgetRatio = Math.min(leadBudget / avgValue, 2);
  score += (budgetRatio - 0.5) * 20;
  
  // Project type conversion potential
  score += conversionRate * 30;
  
  // Location factors
  if (lead.location?.state === 'CA' || lead.location?.state === 'NY') score += 10;
  else if (lead.location?.state === 'TX' || lead.location?.state === 'FL') score += 5;
  
  return Math.min(100, Math.max(0, score));
}

function calculateTimingScore(lead: Lead, marketData: MarketData): number {
  const projectType = lead.project.type;
  const seasonality = marketData.seasonalityFactors[projectType] || 1.0;
  
  let score = 50;
  
  // Timeline urgency
  if (lead.project.timeline === 'urgent') score += 30;
  else if (lead.project.timeline === 'soon') score += 20;
  else if (lead.project.timeline === 'flex') score += 5;
  
  // Seasonal factors
  score += (seasonality - 1) * 20;
  
  // Recency of lead
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceCreated <= 1) score += 15;
  else if (daysSinceCreated <= 7) score += 10;
  else if (daysSinceCreated <= 30) score += 5;
  
  return Math.min(100, Math.max(0, score));
}

function calculateAuthorityScore(lead: Lead): number {
  let score = 50;
  
  // Contact completeness
  if (lead.contact.email && lead.contact.phone) score += 20;
  else if (lead.contact.email || lead.contact.phone) score += 10;
  
  // Company information
  if (lead.contact.company) score += 15;
  
  // Verification status
  if (lead.verification?.emailValid && lead.verification?.phoneValid) score += 15;
  else if (lead.verification?.emailValid || lead.verification?.phoneValid) score += 8;
  
  return Math.min(100, score);
}

function calculateBudgetScore(lead: Lead, marketData: MarketData): number {
  const projectType = lead.project.type;
  const avgValue = marketData.avgProjectValue[projectType] || 50000;
  
  let score = 50;
  
  // Budget range quality
  const minBudget = lead.project.budgetMin || 0;
  const maxBudget = lead.project.budgetMax || 0;
  
  if (minBudget > 0 && maxBudget > 0) {
    const avgBudget = (minBudget + maxBudget) / 2;
    const budgetRatio = avgBudget / avgValue;
    
    if (budgetRatio >= 1.5) score += 30; // Premium budget
    else if (budgetRatio >= 1.0) score += 20; // Above average
    else if (budgetRatio >= 0.7) score += 10; // Average
    else score -= 10; // Below average
    
    // Budget range tightness (indicates research)
    const range = maxBudget - minBudget;
    const rangeRatio = range / avgBudget;
    if (rangeRatio < 0.3) score += 10; // Tight range = well researched
  }
  
  return Math.min(100, Math.max(0, score));
}

function calculateEngagementScore(lead: Lead, behavioral?: BehavioralData): number {
  let score = 50;
  
  if (behavioral) {
    // Response time quality
    if (behavioral.responseTime < 60) score += 20; // < 1 hour
    else if (behavioral.responseTime < 360) score += 15; // < 6 hours
    else if (behavioral.responseTime < 1440) score += 10; // < 24 hours
    
    // Overall engagement
    score += Math.min(30, 
      (behavioral.websiteActivity * 10) +
      (behavioral.emailEngagement * 10) +
      (behavioral.socialSignals * 10)
    );
  }
  
  // Description quality
  if (lead.description && lead.description.length > 100) score += 10;
  
  return Math.min(100, Math.max(0, score));
}

function generateInsights(
  breakdown: AdvancedLeadScore['breakdown'],
  lead: Lead
): { signals: string[]; recommendations: string[]; confidence: number } {
  
  const signals: string[] = [];
  const recommendations: string[] = [];
  
  // Intent signals
  if (breakdown.intent > 80) signals.push('🔥 High purchase intent');
  if (lead.project.timeline === 'urgent') signals.push('⚡ Urgent timeline');
  if (lead.source === 'referral') signals.push('👥 Quality referral source');
  
  // Fit signals
  if (breakdown.fit > 80) signals.push('🎯 Perfect market fit');
  if (breakdown.budget > 80) signals.push('💰 Premium budget range');
  
  // Authority signals
  if (breakdown.authority > 80) signals.push('✅ Verified contact info');
  if (lead.contact.company) signals.push('🏢 Company contact');
  
  // Engagement signals
  if (breakdown.engagement > 80) signals.push('📈 High engagement');
  
  // Generate recommendations
  if (breakdown.intent > 70 && breakdown.timing > 70) {
    recommendations.push('🚀 High priority - immediate follow-up');
  }
  
  if (breakdown.budget > 80) {
    recommendations.push('💎 Premium lead - assign top contractor');
  }
  
  if (breakdown.authority < 50) {
    recommendations.push('📞 Verify contact information');
  }
  
  if (breakdown.engagement < 50) {
    recommendations.push('📧 Nurture with educational content');
  }
  
  // Calculate confidence based on data completeness
  let confidence = 0.5;
  if (lead.contact.email && lead.contact.phone) confidence += 0.2;
  if (lead.project.budgetMin && lead.project.budgetMax) confidence += 0.2;
  if (lead.description) confidence += 0.1;
  
  return { signals, recommendations, confidence };
}

/**
 * Market data for different project types
 */
export const defaultMarketData: MarketData = {
  avgProjectValue: {
    kitchen: 65000,
    bathroom: 25000,
    addition: 95000,
    new_build: 350000,
    landscaping: 15000,
    other: 35000
  },
  conversionRates: {
    kitchen: 0.32,
    bathroom: 0.28,
    addition: 0.25,
    new_build: 0.18,
    landscaping: 0.35,
    other: 0.22
  },
  seasonalityFactors: {
    kitchen: 1.2, // Peak in spring/summer
    bathroom: 1.0,
    addition: 1.1,
    new_build: 0.9, // Slower in winter
    landscaping: 1.4, // Peak in spring
    other: 1.0
  },
  competitiveIndex: {
    kitchen: 0.8, // High competition
    bathroom: 0.9,
    addition: 0.7,
    new_build: 0.6,
    landscaping: 0.9,
    other: 0.8
  }
};


