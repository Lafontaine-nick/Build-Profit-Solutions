/**
 * Lead Scoring System
 * Calculates lead quality scores and assigns Hot/Warm/Cold ratings
 */

import { Lead } from '../types';

export type LeadTemperature = 'hot' | 'warm' | 'cold';

export interface LeadScore {
  overall: number; // 0-100
  temperature: LeadTemperature;
  breakdown: {
    budgetScore: number;
    timelineScore: number;
    engagementScore: number;
    competitionScore: number;
    profitabilityScore: number;
  };
  reasons: string[];
  priority: number; // 1-5 (5 = highest)
}

/**
 * Calculate comprehensive lead score
 */
export function calculateLeadScore(
  lead: Lead,
  marketPricing?: any,
  competitorData?: any
): LeadScore {
  const breakdown = {
    budgetScore: calculateBudgetScore(lead, marketPricing),
    timelineScore: calculateTimelineScore(lead),
    engagementScore: calculateEngagementScore(lead),
    competitionScore: calculateCompetitionScore(competitorData),
    profitabilityScore: calculateProfitabilityScore(lead, marketPricing),
  };

  // Weighted average (budget and profitability are most important)
  const overall = Math.round(
    breakdown.budgetScore * 0.25 +
    breakdown.timelineScore * 0.15 +
    breakdown.engagementScore * 0.20 +
    breakdown.competitionScore * 0.15 +
    breakdown.profitabilityScore * 0.25
  );

  const temperature = getTemperature(overall);
  const reasons = generateReasons(breakdown, lead);
  const priority = calculatePriority(overall, breakdown);

  return {
    overall,
    temperature,
    breakdown,
    reasons,
    priority,
  };
}

/**
 * Budget Score: How well does the budget align with market rates?
 */
function calculateBudgetScore(lead: Lead, marketPricing?: any): number {
  const leadBudget = (lead.project.budgetMin + lead.project.budgetMax) / 2;
  
  if (!marketPricing) {
    // If no market data, score based on budget size
    if (leadBudget > 50000) return 90;
    if (leadBudget > 30000) return 75;
    if (leadBudget > 15000) return 60;
    return 40;
  }

  const marketAvg = marketPricing.averagePrice;
  const ratio = leadBudget / marketAvg;

  // Score based on how budget compares to market
  if (ratio >= 1.2) return 100; // 20% above market = excellent
  if (ratio >= 1.1) return 90;  // 10% above market = great
  if (ratio >= 1.0) return 80;  // At market = good
  if (ratio >= 0.9) return 65;  // 10% below = okay
  if (ratio >= 0.8) return 50;  // 20% below = challenging
  return 30; // More than 20% below = difficult
}

/**
 * Timeline Score: How urgent is the project?
 */
function calculateTimelineScore(lead: Lead): number {
  const timeline = lead.project.timeline.toLowerCase();
  
  // Urgent projects score higher (faster revenue)
  if (timeline.includes('immediate') || timeline.includes('asap')) return 100;
  if (timeline.includes('1-2 weeks') || timeline.includes('urgent')) return 90;
  if (timeline.includes('1 month') || timeline.includes('4 weeks')) return 75;
  if (timeline.includes('2-3 months') || timeline.includes('flexible')) return 60;
  if (timeline.includes('3-6 months')) return 45;
  return 30; // 6+ months or very flexible
}

/**
 * Engagement Score: How engaged is the customer?
 */
function calculateEngagementScore(lead: Lead): number {
  let score = 50; // Base score

  // Check if they provided detailed information
  if (lead.project.description && lead.project.description.length > 100) {
    score += 20; // Detailed description = engaged customer
  }

  // Check if they provided contact info
  if (lead.contact.phone) score += 10;
  if (lead.contact.email) score += 10;

  // Check lead stage (further along = more engaged)
  switch (lead.stage) {
    case 'contacted':
      score += 10;
      break;
    case 'qualified':
      score += 20;
      break;
    case 'proposal':
      score += 30;
      break;
    case 'negotiation':
      score += 40;
      break;
  }

  return Math.min(100, score);
}

/**
 * Competition Score: How competitive is this lead?
 */
function calculateCompetitionScore(competitorData?: any): number {
  if (!competitorData) return 50; // Unknown competition

  const { viewCount, responseCount, avgResponseTime } = competitorData;

  let score = 100;

  // Fewer views = less competition
  if (viewCount > 20) score -= 40;
  else if (viewCount > 10) score -= 25;
  else if (viewCount > 5) score -= 15;

  // Fewer responses = better chance
  if (responseCount > 10) score -= 30;
  else if (responseCount > 5) score -= 20;
  else if (responseCount > 2) score -= 10;

  // Slow average response = opportunity to stand out
  if (avgResponseTime < 1) score -= 20; // < 1 hour = very competitive
  else if (avgResponseTime < 4) score -= 10; // < 4 hours = competitive

  return Math.max(0, score);
}

/**
 * Profitability Score: How profitable is this lead likely to be?
 */
function calculateProfitabilityScore(lead: Lead, marketPricing?: any): number {
  if (!marketPricing) {
    // Estimate based on project size
    const leadBudget = (lead.project.budgetMin + lead.project.budgetMax) / 2;
    if (leadBudget > 50000) return 85;
    if (leadBudget > 30000) return 70;
    if (leadBudget > 15000) return 55;
    return 40;
  }

  // Use actual profit margin if available
  const profitMargin = marketPricing.profitMargin || 10;

  // Score based on profit margin
  if (profitMargin >= 18) return 100; // Exceptional
  if (profitMargin >= 15) return 90;  // Excellent
  if (profitMargin >= 12) return 75;  // Very good
  if (profitMargin >= 10) return 60;  // Good
  if (profitMargin >= 8) return 45;   // Acceptable
  return 30; // Low margin
}

/**
 * Convert score to temperature
 */
function getTemperature(score: number): LeadTemperature {
  if (score >= 75) return 'hot';
  if (score >= 50) return 'warm';
  return 'cold';
}

/**
 * Generate human-readable reasons for the score
 */
function generateReasons(breakdown: any, lead: Lead): string[] {
  const reasons: string[] = [];

  // Budget reasons
  if (breakdown.budgetScore >= 80) {
    reasons.push('💰 Budget aligns well with market rates');
  } else if (breakdown.budgetScore < 50) {
    reasons.push('⚠️ Budget below market average');
  }

  // Timeline reasons
  if (breakdown.timelineScore >= 80) {
    reasons.push('⚡ Urgent timeline - quick revenue');
  } else if (breakdown.timelineScore < 50) {
    reasons.push('📅 Flexible timeline - plan ahead');
  }

  // Engagement reasons
  if (breakdown.engagementScore >= 70) {
    reasons.push('👍 Highly engaged customer');
  } else if (breakdown.engagementScore < 50) {
    reasons.push('🤔 Customer engagement unclear');
  }

  // Competition reasons
  if (breakdown.competitionScore >= 70) {
    reasons.push('🎯 Low competition - great opportunity');
  } else if (breakdown.competitionScore < 40) {
    reasons.push('⚔️ High competition - respond quickly');
  }

  // Profitability reasons
  if (breakdown.profitabilityScore >= 75) {
    reasons.push('📈 High profit potential');
  } else if (breakdown.profitabilityScore < 50) {
    reasons.push('💵 Lower profit margin expected');
  }

  return reasons.slice(0, 3); // Return top 3 reasons
}

/**
 * Calculate priority level (1-5)
 */
function calculatePriority(overall: number, breakdown: any): number {
  // High urgency + good score = highest priority
  if (overall >= 80 && breakdown.timelineScore >= 80) return 5;
  if (overall >= 75) return 4;
  if (overall >= 60) return 3;
  if (overall >= 45) return 2;
  return 1;
}

/**
 * Get color for temperature
 */
export function getTemperatureColor(temperature: LeadTemperature): string {
  switch (temperature) {
    case 'hot':
      return '#EF4444'; // Red
    case 'warm':
      return '#F59E0B'; // Orange
    case 'cold':
      return '#3B82F6'; // Blue
  }
}

/**
 * Get emoji for temperature
 */
export function getTemperatureEmoji(temperature: LeadTemperature): string {
  switch (temperature) {
    case 'hot':
      return '🔥';
    case 'warm':
      return '☀️';
    case 'cold':
      return '❄️';
  }
}

/**
 * Get label for temperature
 */
export function getTemperatureLabel(temperature: LeadTemperature): string {
  switch (temperature) {
    case 'hot':
      return 'HOT LEAD';
    case 'warm':
      return 'WARM LEAD';
    case 'cold':
      return 'COLD LEAD';
  }
}





