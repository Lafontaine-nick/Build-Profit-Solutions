import type { Lead } from './types';

/** Per-lead engagement used for proposal/won parity with Pipeline Health analytics */
export type PipelineEngagement = {
  bidSubmittedAt?: string;
  bidWonAt?: string;
  firstContactedAt?: string;
  [key: string]: unknown;
};

const STAGE_ORDER = ['new', 'contacted', 'qualified', 'proposal', 'won'] as const;

/**
 * Cumulative funnel step: true if the lead has reached or passed `targetStage`.
 * Aligns Pipeline Health rows (except proposal/won special cases) with the Leads list pipeline filter.
 */
export function hasReachedPipelineStage(lead: Lead, targetStage: string): boolean {
  if (lead.stage === 'lost') return targetStage === 'lost';
  if (targetStage === 'new') return lead.stage === 'new';

  const currentStage = lead.stage === 'proposal-sent' ? 'proposal' : lead.stage;
  const currentStageIndex = STAGE_ORDER.indexOf(currentStage as (typeof STAGE_ORDER)[number]);
  const targetStageIndex = STAGE_ORDER.indexOf(targetStage as (typeof STAGE_ORDER)[number]);

  if (currentStageIndex === -1 || targetStageIndex === -1) {
    return currentStage === targetStage;
  }

  return currentStageIndex >= targetStageIndex;
}

export function hasSubmittedBidEngagement(engagement?: PipelineEngagement | null): boolean {
  return !!(engagement && engagement.bidSubmittedAt);
}

export function hasWonBidEngagement(engagement?: PipelineEngagement | null): boolean {
  return !!(engagement && engagement.bidWonAt);
}

/**
 * Same rule as Analytics `leadsByStage.proposal` / Pipeline Health "Proposals Sent".
 */
export function matchesProposalSentPipelineBucket(
  lead: Lead,
  engagement?: PipelineEngagement | null
): boolean {
  const isInProposalStage = lead.stage === 'proposal' || lead.stage === 'proposal-sent';
  const hasSubmittedBidFlag = hasSubmittedBidEngagement(engagement);
  const hasReachedQualified = hasReachedPipelineStage(lead, 'qualified');
  return (isInProposalStage || hasSubmittedBidFlag) && hasReachedQualified;
}

/**
 * Same rule as Analytics `leadsByStage.won` / Pipeline Health "Won".
 */
export function matchesWonPipelineBucket(lead: Lead, engagement?: PipelineEngagement | null): boolean {
  return lead.stage === 'won' || hasWonBidEngagement(engagement);
}
