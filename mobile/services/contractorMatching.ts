import { Lead } from './leadService';

export interface ContractorPreferences {
  id: string;
  tradeTypes: {
    residential: boolean;
    commercial: boolean;
    industrial: boolean;
    multiFamily: boolean;
    newBuild: boolean;
    renovation: boolean;
    repair: boolean;
    maintenance: boolean;
    remodeling: boolean;
    additions: boolean;
  };
  zipCodes: string[];
  maxDistance: number;
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };
  leadMatching: {
    autoAccept: boolean;
    minAIScore: number;
    maxResponseTime: number;
    preferredContactMethod: 'phone' | 'email' | 'text' | 'any';
  };
  availability: {
    isAvailable: boolean;
    responseTime: number;
  };
}

export interface MatchResult {
  contractorId: string;
  contractorName: string;
  matchScore: number;
  matchFactors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  autoAccept: boolean;
  responseTime: number;
  estimatedConversion: number;
}

export class ContractorMatchingService {
  private contractors: ContractorPreferences[] = [
    {
      id: 'contractor-1',
      tradeTypes: {
        residential: true,
        commercial: false,
        industrial: false,
        multiFamily: false,
        newBuild: true,
        renovation: true,
        repair: true,
        maintenance: false,
        remodeling: true,
        additions: false,
      },
      zipCodes: ['89002', '89101', '89102'],
      maxDistance: 25,
      priceRange: { min: 10000, max: 100000, currency: 'USD' },
      leadMatching: {
        autoAccept: false,
        minAIScore: 70,
        maxResponseTime: 4,
        preferredContactMethod: 'phone',
      },
      availability: {
        isAvailable: true,
        responseTime: 2,
      },
    },
    {
      id: 'contractor-2',
      tradeTypes: {
        residential: true,
        commercial: true,
        industrial: false,
        multiFamily: true,
        newBuild: false,
        renovation: true,
        repair: true,
        maintenance: true,
        remodeling: true,
        additions: true,
      },
      zipCodes: ['89101', '89102', '89103'],
      maxDistance: 30,
      priceRange: { min: 5000, max: 150000, currency: 'USD' },
      leadMatching: {
        autoAccept: true,
        minAIScore: 60,
        maxResponseTime: 8,
        preferredContactMethod: 'email',
      },
      availability: {
        isAvailable: true,
        responseTime: 4,
      },
    },
  ];

  async matchLeadToContractors(lead: Lead): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];

    for (const contractor of this.contractors) {
      if (!contractor.availability.isAvailable) continue;

      const matchScore = this.calculateMatchScore(lead, contractor);

      if (matchScore > 0) {
        const matchFactors = this.analyzeMatchFactors(lead, contractor);
        const autoAccept = this.shouldAutoAccept(lead, contractor);
        const estimatedConversion = this.estimateConversion(lead, contractor);

        matches.push({
          contractorId: contractor.id,
          contractorName: `Contractor ${contractor.id.split('-')[1]}`,
          matchScore,
          matchFactors,
          autoAccept,
          responseTime: contractor.availability.responseTime,
          estimatedConversion,
        });
      }
    }

    // Sort by match score (highest first)
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  private calculateMatchScore(
    lead: Lead,
    contractor: ContractorPreferences
  ): number {
    let score = 0;

    // Trade type matching (20 points)
    if (this.matchesTradeType(lead, contractor)) {
      score += 20;
    }

    // Location matching (15 points)
    if (this.matchesLocation(lead, contractor)) {
      score += 15;
    }

    // Budget matching (10 points)
    if (this.matchesBudget(lead, contractor)) {
      score += 10;
    }

    // Lead grade matching (5-20 points)
    score += this.calculateGradeScore(lead, contractor);

    // AI score matching (5-15 points)
    score += this.calculateAIScore(lead, contractor);

    // Timeline urgency (5-15 points)
    score += this.calculateTimelineScore(lead, contractor);

    return Math.min(score, 100);
  }

  private matchesTradeType(
    lead: Lead,
    contractor: ContractorPreferences
  ): boolean {
    const projectType = lead.projectType;

    switch (projectType) {
      case 'residential':
        return contractor.tradeTypes.residential;
      case 'commercial':
        return contractor.tradeTypes.commercial;
      case 'renovation':
        return contractor.tradeTypes.renovation;
      case 'new-build':
        return contractor.tradeTypes.newBuild;
      case 'maintenance':
        return contractor.tradeTypes.maintenance;
      default:
        return false;
    }
  }

  private matchesLocation(
    lead: Lead,
    contractor: ContractorPreferences
  ): boolean {
    const leadZipCode = lead.location?.zipCode;
    if (!leadZipCode) return false;

    return contractor.zipCodes.includes(leadZipCode);
  }

  private matchesBudget(
    lead: Lead,
    contractor: ContractorPreferences
  ): boolean {
    const leadBudget = lead.budget;
    const contractorRange = contractor.priceRange;

    return (
      leadBudget.max >= contractorRange.min &&
      leadBudget.min <= contractorRange.max
    );
  }

  private calculateGradeScore(
    lead: Lead,
    contractor: ContractorPreferences
  ): number {
    // Grade scoring is removed - return 0 to disable this scoring factor
    return 0;
  }

  private calculateAIScore(
    lead: Lead,
    contractor: ContractorPreferences
  ): number {
    const leadScore = lead.aiScore || 50;
    const minScore = contractor.leadMatching.minAIScore;

    if (leadScore >= minScore) {
      const scoreDiff = leadScore - minScore;
      return Math.min(scoreDiff * 0.3, 15); // 0-15 points
    }

    return 0;
  }

  private calculateTimelineScore(
    lead: Lead,
    contractor: ContractorPreferences
  ): number {
    const urgency = lead.timeline?.urgency || 'medium';
    const urgencyScores = { high: 15, medium: 10, low: 5 };

    return urgencyScores[urgency] || 10;
  }

  private analyzeMatchFactors(lead: Lead, contractor: ContractorPreferences) {
    const factors = {
      positive: [] as string[],
      negative: [] as string[],
      neutral: [] as string[],
    };

    // Trade type analysis
    if (this.matchesTradeType(lead, contractor)) {
      factors.positive.push(`Matches ${lead.projectType} specialty`);
    } else {
      factors.negative.push(`No ${lead.projectType} experience`);
    }

    // Location analysis
    if (this.matchesLocation(lead, contractor)) {
      factors.positive.push('Local service area');
    } else {
      factors.negative.push('Outside service area');
    }

    // Budget analysis
    if (this.matchesBudget(lead, contractor)) {
      factors.positive.push('Budget within range');
    } else {
      factors.negative.push('Budget outside range');
    }


    // AI score analysis
    if (lead.aiScore && lead.aiScore >= contractor.leadMatching.minAIScore) {
      factors.positive.push(
        `AI score ${lead.aiScore} meets minimum ${contractor.leadMatching.minAIScore}`
      );
    } else if (lead.aiScore) {
      factors.negative.push(
        `AI score ${lead.aiScore} below minimum ${contractor.leadMatching.minAIScore}`
      );
    }

    // Timeline analysis
    if (lead.timeline?.urgency === 'high') {
      factors.positive.push('High urgency - premium pricing');
    } else if (lead.timeline?.urgency === 'low') {
      factors.neutral.push('Low urgency - flexible scheduling');
    }

    return factors;
  }

  private shouldAutoAccept(
    lead: Lead,
    contractor: ContractorPreferences
  ): boolean {
    if (!contractor.leadMatching.autoAccept) return false;

    return (
      (lead.aiScore || 0) >= contractor.leadMatching.minAIScore &&
      this.matchesTradeType(lead, contractor) &&
      this.matchesLocation(lead, contractor)
    );
  }

  private estimateConversion(
    lead: Lead,
    contractor: ContractorPreferences
  ): number {
    let conversionRate = 0.15; // Base 15% conversion rate

    // AI score impact
    if (lead.aiScore) {
      conversionRate += (lead.aiScore - 50) * 0.002; // +/- 10%
    }

    // Grade-based conversion rate adjustment removed

    // Trade type match
    if (this.matchesTradeType(lead, contractor)) {
      conversionRate += 0.1; // +10%
    }

    // Location match
    if (this.matchesLocation(lead, contractor)) {
      conversionRate += 0.05; // +5%
    }

    // Budget match
    if (this.matchesBudget(lead, contractor)) {
      conversionRate += 0.05; // +5%
    }

    // Availability impact
    if (contractor.availability.isAvailable) {
      conversionRate += 0.05; // +5%
    }

    return Math.min(Math.max(conversionRate, 0.05), 0.95); // Clamp between 5% and 95%
  }

  async getContractorPreferences(
    contractorId: string
  ): Promise<ContractorPreferences | null> {
    return this.contractors.find(c => c.id === contractorId) || null;
  }

  async updateContractorPreferences(
    contractorId: string,
    preferences: Partial<ContractorPreferences>
  ): Promise<ContractorPreferences | null> {
    const contractorIndex = this.contractors.findIndex(
      c => c.id === contractorId
    );
    if (contractorIndex === -1) return null;

    this.contractors[contractorIndex] = {
      ...this.contractors[contractorIndex],
      ...preferences,
    };

    return this.contractors[contractorIndex];
  }
}

export const contractorMatchingService = new ContractorMatchingService();
