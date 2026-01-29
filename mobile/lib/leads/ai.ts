/**
 * AI Scoring and Contractor Matching Logic
 * Handles lead scoring and contractor ranking algorithms
 */

import { ContractorMatch, ContractorProfile, Lead } from './types';
import { normalizeTrade, tradesMatch } from '../../lib/trades';

/**
 * Score a lead based on various factors
 */
export function scoreLead(
  lead: Lead, 
  hist?: { convByType?: Record<string, number> },
  contractorProfile?: {
    tradeTypes?: string[];
    specificTrades?: string[];
    zipCodes?: string[];
    location?: { city?: string; state?: string; serviceRadius?: number };
    budget?: { min?: number; max?: number };
    preferredTimelines?: ('Urgent' | 'Soon' | 'Normal' | 'Flexible')[];
    filterByTrade?: boolean;
  }
): number {
  // Campaign leads (user's own leads) should get maximum scores
  // They bypass all filtering and are always perfect matches
  const isCampaignLead = lead.projectId?.startsWith('CAMPAIGN-') || 
                         lead.isOwnRequest === true || 
                         (lead.createdBy && lead.createdBy === 'contractor-demo');
  
  if (isCampaignLead && contractorProfile) {
    // Give campaign leads a high base score (85-95) since they're perfect matches
    // They match your trades, location, and budget by definition
    let campaignScore = 90; // Base score for campaign leads
    
    // Boost if budget is substantial
    const mid = ((lead.project.budgetMin ?? 0) + (lead.project.budgetMax ?? lead.project.budgetMin ?? 0)) / 2;
    if (mid > 50000) campaignScore += 5; // Bonus for large budgets
    
    // Boost if verified
    if (lead.verification?.emailValid && lead.verification?.phoneValid) {
      campaignScore += 5;
    }
    
    const finalScore = Math.min(100, campaignScore);
    console.log(`🎯 Campaign lead "${lead.title}": Auto-scored ${finalScore}/100 (perfect match)`);
    return finalScore;
  }
  
  const type = lead.project.type;
  const min = lead.project.budgetMin ?? 0;
  const max = lead.project.budgetMax ?? min;
  const mid = (min + max) / 2;

  // Weight factors for scoring
  const W = { 
    budget: 0.30, 
    typeFit: 0.25, 
    location: 0.15, 
    urgency: 0.15, 
    verification: 0.15 
  };

  // Budget score (higher budget = higher score, up to a point)
  // If contractor profile exists, check if budget matches their range
  let budgetScore = Math.min(1, mid / 75000);
  if (contractorProfile?.budget) {
    const { min: cMin, max: cMax } = contractorProfile.budget;
    const budgetMatch = mid >= (cMin || 0) && mid <= (cMax || 1000000);
    console.log(`💰 Budget match: Lead $${mid} vs Contractor $${cMin}-$${cMax} = ${budgetMatch}`);
    
    if (budgetMatch) {
      // If budget is within contractor's range, give it a good base score (70-100%)
      // Higher budgets within range get slightly higher scores, but don't penalize smaller budgets
      const rangeSpan = (cMax || 1000000) - (cMin || 0);
      if (rangeSpan > 0) {
        // Score based on position within range, with minimum of 70%
        const positionInRange = (mid - (cMin || 0)) / rangeSpan;
        budgetScore = Math.max(0.70, 0.70 + (positionInRange * 0.30)); // 70-100% range
      } else {
        budgetScore = 0.85; // Default good score if range is tight
      }
    } else if (mid < (cMin || 0)) {
      // Budget below contractor's minimum - penalize but not too severely
      budgetScore = 0.3;
    } else {
      // Budget above contractor's maximum - medium score (might still be worth pursuing)
      budgetScore = 0.5;
    }
  }
  
  // Type fit based on historical conversion rates
  // If contractor profile exists, check if trade type matches
  let typePrior = (hist?.convByType?.[type] ?? 0.15);
  let typeFit = Math.min(1, 0.3 + typePrior);
  
  // Check specific trades first, then fall back to general trade types
  // Use normalized trade matching for consistent comparison
  const leadTradeNormalized = normalizeTrade(lead.trade);
  
  if (contractorProfile?.specificTrades && contractorProfile.specificTrades.length > 0) {
    // Check if any of the contractor's specific trades match the lead's trade
    const specificTradeMatch = contractorProfile.specificTrades.some(prefTrade => {
      const prefTradeNormalized = normalizeTrade(prefTrade);
      return tradesMatch(leadTradeNormalized, prefTradeNormalized);
    });
    console.log(`🔨 Specific trade match: Lead "${lead.trade}" (normalized: "${leadTradeNormalized}") vs Contractor "${contractorProfile.specificTrades}" = ${specificTradeMatch}`);
    typeFit = specificTradeMatch ? Math.min(1, 0.6 + typePrior) : typeFit * 0.3; // Strong boost for specific match, severe penalty for mismatch
  } else if (contractorProfile?.tradeTypes && contractorProfile.tradeTypes.length > 0) {
    // Check both project type and lead trade for general trade types
    const typeNormalized = normalizeTrade(type);
    const tradeMatch = contractorProfile.tradeTypes.includes('all') ||
                       contractorProfile.tradeTypes.some(t => {
                         const tNormalized = normalizeTrade(t);
                         return tradesMatch(leadTradeNormalized, tNormalized) || tradesMatch(typeNormalized, tNormalized);
                       });
    console.log(`🔨 General trade match: Lead trade "${lead.trade}" / type "${type}" vs Contractor "${contractorProfile.tradeTypes}" = ${tradeMatch}`);
    typeFit = tradeMatch ? Math.min(1, 0.5 + typePrior) : typeFit * 0.4; // Severely penalize if trade doesn't match
  }
  
  // Location score - now checks if lead location matches contractor service area
  let locationScore = 1;
  if (contractorProfile?.zipCodes && contractorProfile.zipCodes.length > 0 && lead.location?.zip) {
    const zipMatch = contractorProfile.zipCodes.includes(lead.location.zip);
    console.log(`📍 Zip match: Lead ${lead.location.zip} vs Contractor zips ${contractorProfile.zipCodes} = ${zipMatch}`);
    locationScore = zipMatch ? 1 : 0.1; // Severely penalize if outside service area
  } else if (contractorProfile?.location && lead.location) {
    // Check if same state/city
    const stateMatch = contractorProfile.location.state === lead.location.state;
    const cityMatch = contractorProfile.location.city?.toLowerCase() === lead.location.city?.toLowerCase();
    console.log(`📍 Location match: Lead ${lead.location.city}, ${lead.location.state} vs Contractor ${contractorProfile.location.city}, ${contractorProfile.location.state} = ${stateMatch && cityMatch}`);
    locationScore = stateMatch && cityMatch ? 0.9 : stateMatch ? 0.6 : 0.1;
  }
  
  // Urgency score - personalized if contractor has timeline preference
  let urgencyScore = lead.project.timeline === 'Urgent' ? 1 : 
                     lead.project.timeline === 'Soon' ? 0.7 : 0.4;
  
  // Boost score if lead timeline matches contractor preference
  if (contractorProfile?.preferredTimelines && contractorProfile.preferredTimelines.length > 0) {
    // Check if lead timeline matches any of the contractor's preferred timelines
    // If "Flexible" is selected, it matches all timelines (Urgent, Soon, Normal)
    const timelineMatch = contractorProfile.preferredTimelines.includes('Flexible') 
      ? true  // Flexible matches everything
      : contractorProfile.preferredTimelines.includes(lead.project.timeline as any);
    
    console.log(`⏰ Timeline match: Lead "${lead.project.timeline}" vs Contractor "${contractorProfile.preferredTimelines}" = ${timelineMatch}`);
    urgencyScore = timelineMatch ? Math.min(1, urgencyScore * 1.4) : urgencyScore * 0.5; // Stronger boost/penalty for timeline matching
  }
  
  // Verification score
  const ver = lead.verification;
  const verificationScore = ver?.duplicateOfId ? 0 : 
    ((ver?.emailValid ? 0.5 : 0) + (ver?.phoneValid ? 0.5 : 0));

  // Calculate weighted score
  const raw = W.budget * budgetScore + 
              W.typeFit * typeFit + 
              W.location * locationScore + 
              W.urgency * urgencyScore + 
              W.verification * verificationScore;
  
  // Calculate final score (0-100)
  const finalScore = Math.round(Math.max(0, Math.min(100, raw * 100)));
  
  // Log detailed scoring breakdown for transparency
  if (contractorProfile) {
    console.log(`📊 Scoring lead "${lead.title}" (trade: "${lead.trade}"): ${finalScore} → ${finalScore}`);
    console.log(`   💰 Budget: ${Math.round(budgetScore * 100)}% (weight: 30%) = ${Math.round(W.budget * budgetScore * 100)} points`);
    console.log(`   🔨 Trade Fit: ${Math.round(typeFit * 100)}% (weight: 25%) = ${Math.round(W.typeFit * typeFit * 100)} points`);
    console.log(`   📍 Location: ${Math.round(locationScore * 100)}% (weight: 15%) = ${Math.round(W.location * locationScore * 100)} points`);
    console.log(`   ⏰ Timeline: ${Math.round(urgencyScore * 100)}% (weight: 15%) = ${Math.round(W.urgency * urgencyScore * 100)} points`);
    console.log(`   ✅ Verification: ${Math.round(verificationScore * 100)}% (weight: 15%) = ${Math.round(W.verification * verificationScore * 100)} points`);
    console.log(`   📈 TOTAL: ${finalScore}/100`);
  }
              
  return finalScore;
}

/**
 * Rank contractors for a given lead
 */
export function rankContractors(lead: Lead, contractors: ContractorProfile[]): ContractorMatch[] {
  const budgetMid = ((lead.project.budgetMin ?? 50000) + (lead.project.budgetMax ?? 50000)) / 2;

  return contractors
    .filter(c => c.services.includes(lead.project.type))
    .map(c => {
      // Distance score (placeholder until distance calculation is implemented)
      const distScore = 0.85;
      
      // Price fit score
      const ticket = c.avgTicketByType?.[lead.project.type] ?? 50000;
      const priceFit = 1 - Math.min(1, Math.abs(budgetMid - ticket) / Math.max(ticket, 1));
      
      // Conversion rate
      const conv = c.conversionByType?.[lead.project.type] ?? 0.2;
      
      // Capacity score
      const cap = c.capacityScore ?? 0.7;
      
      // Rating score
      const rating = (c.rating ?? 4) / 5;

      // Calculate match percentage
      const match = Math.round(100 * (
        0.25 * distScore + 
        0.25 * priceFit + 
        0.25 * conv + 
        0.15 * cap + 
        0.10 * rating
      ));
      
      // Generate reasons for the match
      const reasons = [
        distScore > 0.7 ? 'nearby' : 'within radius',
        priceFit > 0.7 ? 'budget-aligned' : 'ok budget fit',
        conv > 0.25 ? 'strong past conversion' : 'moderate conversion'
      ];
      
      return { 
        contractorId: c.id, 
        match, 
        reasons 
      };
    })
    .sort((a, b) => b.match - a.match)
    .slice(0, 3);
}

/**
 * Calculate lead analytics
 */
export function calculateLeadAnalytics(leads: Lead[]): {
  total: number;
  byStage: Record<LeadStage, number>;
  averageScore: number;
  conversionRate: number;
  topSources: Array<{ source: string; count: number }>;
} {
  const stages: LeadStage[] = ['new', 'verified', 'qualified', 'proposal', 'won', 'lost'];
  
  const byStage = stages.reduce((acc, stage) => {
    acc[stage] = leads.filter(lead => lead.stage === stage).length;
    return acc;
  }, {} as Record<LeadStage, number>);

  const averageScore = leads.length > 0 
    ? Math.round(leads.reduce((sum, lead) => sum + (lead.aiScore ?? 0), 0) / leads.length)
    : 0;

  const wonLeads = leads.filter(lead => lead.stage === 'won').length;
  const conversionRate = leads.length > 0 ? Math.round((wonLeads / leads.length) * 100) : 0;

  const sourceCounts = leads.reduce((acc, lead) => {
    acc[lead.source] = (acc[lead.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topSources = Object.entries(sourceCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total: leads.length,
    byStage,
    averageScore,
    conversionRate,
    topSources
  };
}



