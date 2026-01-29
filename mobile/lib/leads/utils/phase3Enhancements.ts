// Phase 3 Enhancements - Advanced Lead Features
import { Lead } from '../types';
import { 
  fetchMarketAnalysis, 
  mapProjectTypeToBLS, 
  getLaborRateForTrade 
} from '../../../services/blsService';

// Smart Pricing Intelligence
export interface MarketPricingData {
  projectType: string;
  location: string;
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  competitorCount: number;
  marketTrend: 'rising' | 'stable' | 'declining';
  pricePerSqFt?: number;
  laborCosts: {
    hourly: number;
    daily: number;
  };
  materialCosts: {
    average: number;
    range: {
      min: number;
      max: number;
    };
  };
}

export interface PricingRecommendation {
  suggestedPrice: {
    min: number;
    max: number;
    optimal: number;
  };
  confidence: 'high' | 'medium' | 'low';
  reasoning: string[];
  competitiveAdvantage: string;
  profitMargin: number;
}

// Customer Reviews Integration
export interface CustomerReviewData {
  overallRating: number;
  reviewCount: number;
  recentReviews: {
    rating: number;
    comment: string;
    date: string;
    contractor: string;
  }[];
  paymentHistory: {
    onTime: number;
    late: number;
    disputes: number;
  };
  reliabilityScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  verifiedBuyer: boolean;
  repeatCustomer: boolean;
}

// Advanced Analytics
export interface LeadAnalytics {
  conversionRate: number;
  averageResponseTime: number; // in minutes
  closeRate: number;
  averageDealSize: number;
  leadSourceEffectiveness: {
    [source: string]: {
      count: number;
      conversionRate: number;
      averageValue: number;
    };
  };
  performanceMetrics: {
    leadsViewed: number;
    leadsContacted: number;
    quotesSent: number;
    dealsClosed: number;
  };
  seasonalTrends: {
    month: string;
    leadCount: number;
    conversionRate: number;
  }[];
}

// Smart Notifications
export interface NotificationData {
  priority: 'high' | 'medium' | 'low';
  type: 'new_lead' | 'follow_up' | 'competitor_activity' | 'market_opportunity' | 'reminder';
  title: string;
  message: string;
  actionRequired: boolean;
  expiresAt?: string;
  leadId?: string;
}

// Helper Functions
export const generateMarketPricingData = async (lead: Lead): Promise<MarketPricingData> => {
  const projectType = lead.project.type;
  const location = lead.location.city;
  
  try {
    // Fetch real market analysis from BLS API
    const blsProjectType = mapProjectTypeToBLS(projectType);
    const marketData = await fetchMarketAnalysis(location, blsProjectType);
    
    // Get specific labor rate for this project type
    const laborRate = getLaborRateForTrade(marketData.laborRates, projectType);
    
    // Calculate project pricing based on BLS data
    const sqft = projectType === 'kitchen' ? 150 : projectType === 'bathroom' ? 50 : 0;
    const avgPrice = marketData.analysis.adjustedRates.avg * (sqft || 100);
    const minPrice = marketData.analysis.adjustedRates.min * (sqft || 100);
    const maxPrice = marketData.analysis.adjustedRates.max * (sqft || 100);
    
    return {
      projectType,
      location,
      averagePrice: avgPrice,
      priceRange: {
        min: minPrice,
        max: maxPrice,
      },
      competitorCount: marketData.analysis.competitivenessScore === 'aggressive' ? 15 : 
                       marketData.analysis.competitivenessScore === 'competitive' ? 10 : 5,
      marketTrend: marketData.analysis.marketTrend,
      pricePerSqFt: sqft > 0 ? marketData.analysis.adjustedRates.avg : undefined,
      laborCosts: {
        hourly: laborRate,
        daily: laborRate * 8, // 8-hour workday
      },
      materialCosts: {
        average: avgPrice * 0.4, // 40% of total cost
        range: {
          min: minPrice * 0.3,
          max: maxPrice * 0.5,
        },
      },
    };
  } catch (error) {
    console.error('Error fetching BLS market data, using fallback:', error);
    
    // Fallback to mock data if BLS API fails
    const basePricing = {
      kitchen: { avg: 35000, min: 25000, max: 50000, sqft: 150 },
      bathroom: { avg: 18000, min: 12000, max: 28000, sqft: 50 },
      hvac: { avg: 8500, min: 5000, max: 15000, sqft: 0 },
      roofing: { avg: 12000, min: 8000, max: 20000, sqft: 0 },
      electrical: { avg: 4500, min: 2500, max: 8000, sqft: 0 },
      flooring: { avg: 12000, min: 8000, max: 20000, sqft: 0 },
      painting: { avg: 5000, min: 3000, max: 10000, sqft: 0 },
      landscaping: { avg: 15000, min: 8000, max: 30000, sqft: 0 },
    };

    const pricing = basePricing[projectType as keyof typeof basePricing] || basePricing.kitchen;
    
    return {
      projectType,
      location,
      averagePrice: pricing.avg,
      priceRange: {
        min: pricing.min,
        max: pricing.max,
      },
      competitorCount: Math.floor(Math.random() * 15) + 5,
      marketTrend: 'stable',
      pricePerSqFt: pricing.sqft > 0 ? pricing.avg / pricing.sqft : undefined,
      laborCosts: {
        hourly: 45 + Math.random() * 20,
        daily: 360 + Math.random() * 160,
      },
      materialCosts: {
        average: pricing.avg * 0.4,
        range: {
          min: pricing.min * 0.3,
          max: pricing.max * 0.5,
        },
      },
    };
  }
};

export const generatePricingRecommendation = (lead: Lead, marketData: MarketPricingData): PricingRecommendation => {
  const leadBudget = (lead.project.budgetMin + lead.project.budgetMax) / 2;
  const marketAvg = marketData.averagePrice;
  
  // Calculate suggested pricing based on market data and lead budget
  const suggestedMin = Math.max(lead.project.budgetMin, marketData.priceRange.min * 0.9);
  const suggestedMax = Math.min(lead.project.budgetMax, marketData.priceRange.max * 1.1);
  const optimal = (suggestedMin + suggestedMax) / 2;
  
  // Calculate realistic profit margin
  // Total costs = Labor + Materials + Overhead
  // Labor costs: Estimate 30-40% of project for labor
  const estimatedLaborHours = optimal / (marketData.laborCosts.hourly * 4); // Rough estimate
  const totalLaborCost = estimatedLaborHours * marketData.laborCosts.hourly;
  const totalMaterialCost = marketData.materialCosts.average;
  const overheadCost = optimal * 0.15; // 15% overhead (insurance, tools, admin, etc.)
  const totalCosts = totalLaborCost + totalMaterialCost + overheadCost;
  
  // Profit margin = (Revenue - Total Costs) / Revenue * 100
  const profitMargin = Math.max(0, ((optimal - totalCosts) / optimal) * 100);
  
  const reasoning = [];
  if (lead.project.budgetMax > marketData.averagePrice) {
    reasoning.push('Lead budget is above market average - good pricing opportunity');
  }
  if (marketData.competitorCount < 10) {
    reasoning.push('Low competition in this area - can price higher');
  }
  if (marketData.marketTrend === 'rising') {
    reasoning.push('Market prices are trending up - good time to quote');
  }
  
  // Realistic construction profit margins:
  // 8-12% = Good margin
  // 12-18% = Excellent margin
  // 18%+ = Exceptional margin
  let competitiveAdvantage = 'Standard market positioning';
  if (profitMargin > 18) {
    competitiveAdvantage = 'Exceptional profit opportunity';
  } else if (profitMargin > 12) {
    competitiveAdvantage = 'Strong profit margin';
  } else if (marketData.competitorCount < 8) {
    competitiveAdvantage = 'Low competition advantage';
  }
  
  return {
    suggestedPrice: {
      min: Math.round(suggestedMin),
      max: Math.round(suggestedMax),
      optimal: Math.round(optimal),
    },
    // Confidence based on realistic construction margins
    confidence: profitMargin > 15 ? 'high' : profitMargin > 8 ? 'medium' : 'low',
    reasoning,
    competitiveAdvantage,
    profitMargin: Math.round(profitMargin * 10) / 10, // Round to 1 decimal place
  };
};

export const generateCustomerReviewData = (lead: Lead): CustomerReviewData => {
  const overallRating = 3.5 + Math.random() * 1.5; // 3.5-5.0
  const reviewCount = Math.floor(Math.random() * 20) + 5; // 5-25 reviews
  
  const recentReviews = Array.from({ length: 3 }, (_, i) => ({
    rating: 3 + Math.random() * 2,
    comment: [
      'Great work, very professional',
      'Completed on time and within budget',
      'Excellent communication throughout',
      'Would definitely hire again',
      'Quality work, highly recommend',
    ][Math.floor(Math.random() * 5)],
    date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    contractor: `Contractor ${i + 1}`,
  }));
  
  const onTime = Math.floor(Math.random() * 20) + 80; // 80-100%
  const late = 100 - onTime;
  const disputes = Math.floor(Math.random() * 3); // 0-2 disputes
  
  const reliabilityScore = Math.round(
    (overallRating / 5) * 40 + // 40% from rating
    (onTime / 100) * 30 + // 30% from payment history
    (disputes === 0 ? 30 : disputes === 1 ? 15 : 0) // 30% from dispute history
  );
  
  return {
    overallRating: Math.round(overallRating * 10) / 10,
    reviewCount,
    recentReviews,
    paymentHistory: {
      onTime,
      late,
      disputes,
    },
    reliabilityScore,
    riskLevel: reliabilityScore > 80 ? 'low' : reliabilityScore > 60 ? 'medium' : 'high',
    verifiedBuyer: Math.random() > 0.3,
    repeatCustomer: Math.random() > 0.7,
  };
};

export const generateLeadAnalytics = (leads: Lead[]): LeadAnalytics => {
  const totalLeads = leads.length;
  const contactedLeads = leads.filter(l => l.stage !== 'new').length;
  const closedLeads = leads.filter(l => l.stage === 'closed').length;
  
  const conversionRate = totalLeads > 0 ? (contactedLeads / totalLeads) * 100 : 0;
  const closeRate = contactedLeads > 0 ? (closedLeads / contactedLeads) * 100 : 0;
  
  const averageDealSize = leads
    .filter(l => l.stage === 'closed')
    .reduce((sum, l) => sum + ((l.project.budgetMin + l.project.budgetMax) / 2), 0) / closedLeads || 0;
  
  const sourceEffectiveness: { [source: string]: any } = {};
  leads.forEach(lead => {
    if (!sourceEffectiveness[lead.source]) {
      sourceEffectiveness[lead.source] = {
        count: 0,
        conversionRate: 0,
        averageValue: 0,
      };
    }
    sourceEffectiveness[lead.source].count++;
  });
  
  // Calculate conversion rates per source
  Object.keys(sourceEffectiveness).forEach(source => {
    const sourceLeads = leads.filter(l => l.source === source);
    const sourceContacted = sourceLeads.filter(l => l.stage !== 'new').length;
    sourceEffectiveness[source].conversionRate = sourceLeads.length > 0 
      ? (sourceContacted / sourceLeads.length) * 100 
      : 0;
    sourceEffectiveness[source].averageValue = sourceLeads.length > 0
      ? sourceLeads.reduce((sum, l) => sum + ((l.project.budgetMin + l.project.budgetMax) / 2), 0) / sourceLeads.length
      : 0;
  });
  
  const seasonalTrends = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2024, i).toLocaleString('default', { month: 'short' }),
    leadCount: Math.floor(Math.random() * 20) + 10,
    conversionRate: 60 + Math.random() * 30,
  }));
  
  return {
    conversionRate: Math.round(conversionRate),
    averageResponseTime: 45 + Math.random() * 60, // 45-105 minutes
    closeRate: Math.round(closeRate),
    averageDealSize: Math.round(averageDealSize),
    leadSourceEffectiveness: sourceEffectiveness,
    performanceMetrics: {
      leadsViewed: totalLeads,
      leadsContacted: contactedLeads,
      quotesSent: Math.floor(contactedLeads * 0.8),
      dealsClosed: closedLeads,
    },
    seasonalTrends,
  };
};

export const generateNotificationData = (lead: Lead): NotificationData[] => {
  const notifications: NotificationData[] = [];
  
  // High priority for urgent leads
  if (lead.project.timeline === 'Urgent') {
    notifications.push({
      priority: 'high',
      type: 'new_lead',
      title: '🔥 Urgent Lead Alert',
      message: `${lead.title} requires immediate attention`,
      actionRequired: true,
      leadId: lead.id,
    });
  }
  
  // Follow-up reminders for older leads
  const leadAge = Date.now() - new Date(lead.createdAt).getTime();
  const hoursOld = leadAge / (1000 * 60 * 60);
  
  if (hoursOld > 24 && lead.stage === 'new') {
    notifications.push({
      priority: 'medium',
      type: 'follow_up',
      title: '⏰ Follow-up Reminder',
      message: `${lead.title} has been waiting for ${Math.floor(hoursOld)} hours`,
      actionRequired: true,
      leadId: lead.id,
    });
  }
  
  // Market opportunity notifications
  if (Math.random() > 0.7) {
    notifications.push({
      priority: 'low',
      type: 'market_opportunity',
      title: '📈 Market Opportunity',
      message: `New ${lead.project.type} projects trending in ${lead.location.city}`,
      actionRequired: false,
    });
  }
  
  return notifications;
};


