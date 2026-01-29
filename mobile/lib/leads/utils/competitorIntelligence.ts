/**
 * Competitor Intelligence System
 * Tracks and analyzes competitor activity on leads
 */

import { Lead } from '../types';

export interface CompetitorData {
  viewCount: number;
  responseCount: number;
  avgResponseTime: number; // in hours
  yourResponseTime?: number; // in hours
  yourPosition: 'faster' | 'average' | 'slower' | 'not_responded';
  competitiveAdvantage: string;
  insights: string[];
}

/**
 * Generate competitor intelligence data for a lead
 * In production, this would fetch from your backend API
 */
export function generateCompetitorData(lead: Lead): CompetitorData {
  // Simulate competitor data based on lead characteristics
  const projectValue = (lead.project.budgetMin + lead.project.budgetMax) / 2;
  
  // Higher value projects attract more competition
  let baseViews = 5;
  if (projectValue > 50000) baseViews = 15;
  else if (projectValue > 30000) baseViews = 10;
  else if (projectValue > 15000) baseViews = 7;
  
  const viewCount = baseViews + Math.floor(Math.random() * 5);
  const responseCount = Math.floor(viewCount * (0.3 + Math.random() * 0.3)); // 30-60% response rate
  const avgResponseTime = 2 + Math.random() * 6; // 2-8 hours average
  
  // Calculate your response time based on lead creation date
  const leadCreatedAt = new Date(lead.createdAt);
  const now = new Date();
  const yourResponseTime = (now.getTime() - leadCreatedAt.getTime()) / (1000 * 60 * 60); // hours
  
  // Determine your position
  let yourPosition: CompetitorData['yourPosition'] = 'not_responded';
  if (lead.stage !== 'new') {
    if (yourResponseTime < avgResponseTime * 0.7) yourPosition = 'faster';
    else if (yourResponseTime < avgResponseTime * 1.3) yourPosition = 'average';
    else yourPosition = 'slower';
  }
  
  // Generate competitive advantage message
  const competitiveAdvantage = getCompetitiveAdvantage(
    viewCount,
    responseCount,
    avgResponseTime,
    yourResponseTime,
    yourPosition
  );
  
  // Generate insights
  const insights = generateInsights(
    viewCount,
    responseCount,
    avgResponseTime,
    yourResponseTime,
    yourPosition,
    lead
  );
  
  return {
    viewCount,
    responseCount,
    avgResponseTime: Math.round(avgResponseTime * 10) / 10,
    yourResponseTime: lead.stage !== 'new' ? Math.round(yourResponseTime * 10) / 10 : undefined,
    yourPosition,
    competitiveAdvantage,
    insights,
  };
}

/**
 * Get competitive advantage message
 */
function getCompetitiveAdvantage(
  viewCount: number,
  responseCount: number,
  avgResponseTime: number,
  yourResponseTime: number,
  yourPosition: CompetitorData['yourPosition']
): string {
  if (yourPosition === 'faster') {
    return '🏆 You responded faster than average - great positioning!';
  }
  
  if (yourPosition === 'average') {
    return '⚡ Respond faster to stand out from competitors';
  }
  
  if (yourPosition === 'slower') {
    return '⏰ Competitors responded faster - follow up aggressively';
  }
  
  // Not responded yet
  if (responseCount < 3) {
    return '🎯 Low competition - respond now to secure this lead!';
  }
  
  if (avgResponseTime > 4) {
    return '⚡ Competitors are slow - respond within 1 hour to win!';
  }
  
  return '🏃 High competition - respond immediately!';
}

/**
 * Generate actionable insights
 */
function generateInsights(
  viewCount: number,
  responseCount: number,
  avgResponseTime: number,
  yourResponseTime: number,
  yourPosition: CompetitorData['yourPosition'],
  lead: Lead
): string[] {
  const insights: string[] = [];
  
  // Competition level insights
  if (viewCount > 15) {
    insights.push('🔥 High interest - ' + viewCount + ' contractors viewed this lead');
  } else if (viewCount < 5) {
    insights.push('✨ Low competition - only ' + viewCount + ' contractors viewed');
  }
  
  // Response rate insights
  const responseRate = (responseCount / viewCount) * 100;
  if (responseRate > 60) {
    insights.push('⚠️ ' + Math.round(responseRate) + '% response rate - very competitive');
  } else if (responseRate < 30) {
    insights.push('💡 Only ' + Math.round(responseRate) + '% responded - opportunity to stand out');
  }
  
  // Timing insights
  if (yourPosition === 'not_responded') {
    if (avgResponseTime < 2) {
      insights.push('⏱️ Competitors respond in < 2 hours - act fast!');
    } else if (avgResponseTime < 4) {
      insights.push('⏱️ Average response time: ' + Math.round(avgResponseTime) + ' hours');
    } else {
      insights.push('🐌 Slow competitor response - easy win if you act now');
    }
  } else {
    if (yourPosition === 'faster') {
      insights.push('✅ You beat ' + Math.round((1 - yourResponseTime / avgResponseTime) * 100) + '% of competitors on speed');
    } else if (yourPosition === 'slower') {
      insights.push('📉 You were ' + Math.round((yourResponseTime / avgResponseTime - 1) * 100) + '% slower than average');
    }
  }
  
  // Project-specific insights
  const projectValue = (lead.project.budgetMin + lead.project.budgetMax) / 2;
  if (projectValue > 50000 && viewCount > 10) {
    insights.push('💰 High-value project attracting premium contractors');
  }
  
  // Urgency insights
  if (lead.project.timeline.toLowerCase().includes('immediate') && responseCount > 5) {
    insights.push('🚨 Urgent project - customer likely choosing fast responders');
  }
  
  return insights.slice(0, 3); // Return top 3 insights
}

/**
 * Get position color
 */
export function getPositionColor(position: CompetitorData['yourPosition']): string {
  switch (position) {
    case 'faster':
      return '#10B981'; // Green
    case 'average':
      return '#F59E0B'; // Orange
    case 'slower':
      return '#EF4444'; // Red
    case 'not_responded':
      return '#6B7280'; // Gray
  }
}

/**
 * Get position label
 */
export function getPositionLabel(position: CompetitorData['yourPosition']): string {
  switch (position) {
    case 'faster':
      return 'FASTER THAN AVERAGE';
    case 'average':
      return 'AVERAGE SPEED';
    case 'slower':
      return 'SLOWER THAN AVERAGE';
    case 'not_responded':
      return 'NOT RESPONDED';
  }
}

/**
 * Calculate recommended response time to beat competition
 */
export function getRecommendedResponseTime(avgResponseTime: number): string {
  const targetTime = avgResponseTime * 0.5; // Aim for 50% of average
  
  if (targetTime < 0.5) return 'within 30 minutes';
  if (targetTime < 1) return 'within 1 hour';
  if (targetTime < 2) return 'within 2 hours';
  if (targetTime < 4) return 'within 4 hours';
  return 'within ' + Math.ceil(targetTime) + ' hours';
}





