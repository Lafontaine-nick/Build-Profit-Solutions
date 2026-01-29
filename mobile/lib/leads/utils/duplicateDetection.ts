/**
 * Duplicate Lead Detection
 * Finds potential duplicate leads based on multiple criteria
 */

import { Lead } from '../types';

export interface DuplicateMatch {
  leadId: string;
  matchScore: number; // 0-100
  matchReasons: string[];
}

export function findDuplicates(newLead: Lead, existingLeads: Lead[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const existing of existingLeads) {
    if (existing.id === newLead.id) continue;

    let matchScore = 0;
    const matchReasons: string[] = [];

    // Check email match (strongest signal)
    if (
      newLead.contact.email &&
      existing.contact.email &&
      normalizeEmail(newLead.contact.email) === normalizeEmail(existing.contact.email)
    ) {
      matchScore += 50;
      matchReasons.push('Same email address');
    }

    // Check phone match (strong signal)
    if (
      newLead.contact.phone &&
      existing.contact.phone &&
      normalizePhone(newLead.contact.phone) === normalizePhone(existing.contact.phone)
    ) {
      matchScore += 40;
      matchReasons.push('Same phone number');
    }

    // Check name similarity
    const nameSimilarity = calculateStringSimilarity(
      newLead.contact.name,
      existing.contact.name
    );
    if (nameSimilarity > 0.8) {
      matchScore += 20;
      matchReasons.push('Similar name');
    }

    // Check location match
    if (
      newLead.location?.city &&
      existing.location?.city &&
      newLead.location.city.toLowerCase() === existing.location.city.toLowerCase() &&
      newLead.location.state === existing.location.state
    ) {
      matchScore += 10;
      matchReasons.push('Same location');
    }

    // Check project type match
    if (newLead.project.type === existing.project.type) {
      matchScore += 5;
      matchReasons.push('Same project type');
    }

    // Check budget overlap
    if (
      newLead.project.budgetMin &&
      existing.project.budgetMin &&
      newLead.project.budgetMax &&
      existing.project.budgetMax
    ) {
      const overlap = calculateBudgetOverlap(
        { min: newLead.project.budgetMin, max: newLead.project.budgetMax },
        { min: existing.project.budgetMin, max: existing.project.budgetMax }
      );
      if (overlap > 0.7) {
        matchScore += 5;
        matchReasons.push('Similar budget range');
      }
    }

    // Only consider matches above threshold
    if (matchScore >= 30) {
      matches.push({
        leadId: existing.id,
        matchScore: Math.min(matchScore, 100),
        matchReasons,
      });
    }
  }

  // Sort by match score descending
  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

// Normalize email for comparison
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// Normalize phone for comparison
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  return phone.replace(/\D/g, '');
}

// Calculate string similarity using Levenshtein distance
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

// Calculate budget overlap percentage
function calculateBudgetOverlap(
  budget1: { min: number; max: number },
  budget2: { min: number; max: number }
): number {
  const overlapMin = Math.max(budget1.min, budget2.min);
  const overlapMax = Math.min(budget1.max, budget2.max);

  if (overlapMin > overlapMax) return 0; // No overlap

  const overlapRange = overlapMax - overlapMin;
  const totalRange = Math.max(budget1.max - budget1.min, budget2.max - budget2.min);

  return overlapRange / totalRange;
}

// Check if lead should be flagged as high-confidence duplicate
export function isHighConfidenceDuplicate(matches: DuplicateMatch[]): boolean {
  return matches.length > 0 && matches[0].matchScore >= 70;
}

// Get duplicate warning message
export function getDuplicateWarning(matches: DuplicateMatch[]): string {
  if (matches.length === 0) return '';

  const topMatch = matches[0];
  const reasons = topMatch.matchReasons.join(', ');

  if (topMatch.matchScore >= 90) {
    return `⚠️ High Confidence Duplicate (${topMatch.matchScore}%)\nReasons: ${reasons}`;
  } else if (topMatch.matchScore >= 70) {
    return `⚠️ Likely Duplicate (${topMatch.matchScore}%)\nReasons: ${reasons}`;
  } else {
    return `⚠️ Possible Duplicate (${topMatch.matchScore}%)\nReasons: ${reasons}`;
  }
}





