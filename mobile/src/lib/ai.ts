/**
 * AI Scoring and Contractor Matching Logic
 * Advanced lead scoring and contractor matching algorithms
 */

import { ContractorMatch, ContractorProfile, Lead } from '../types/leads';

/**
 * Score a lead based on multiple factors
 * Returns a score from 0-100
 */
export function scoreLead(lead: Lead, hist?: { convByType?: Record<string, number> }): number {
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

  // Budget score (higher budgets generally better)
  const budgetScore = Math.min(1, mid / 75000);

  // Type fit based on historical conversion rates
  const typePrior = (hist?.convByType?.[type] ?? 0.15);
  const typeFit = Math.min(1, 0.3 + typePrior);

  // Location score (placeholder for distance-based scoring)
  const locationScore = 1; // TODO: implement distance decay once geocoded

  // Urgency score
  const urgencyScore = lead.project.timeline === 'urgent' ? 1 : 
                      lead.project.timeline === 'soon' ? 0.7 : 0.4;

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

  return Math.round(Math.max(0, Math.min(100, raw * 100)));
}

/**
 * Rank contractors for a given lead
 * Returns top 3 matches with scores and reasons
 */
export function rankContractors(lead: Lead, contractors: ContractorProfile[]): ContractorMatch[] {
  const budgetMid = ((lead.project.budgetMin ?? 50000) + (lead.project.budgetMax ?? 50000)) / 2;

  return contractors
    .filter(c => c.services.includes(lead.project.type))
    .map(c => {
      // Distance score (placeholder until distance calculation implemented)
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

      // Calculate weighted match score
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



