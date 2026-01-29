export interface Contractor {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  tradeTypes: string[];
  zipCodes: string[];
  location: {
    city: string;
    state: string;
    serviceRadius: number;
  };
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  preferences: {
    autoAccept: boolean;
    minAIScore: number;
    maxResponseTime: number;
    preferredContactMethod: 'phone' | 'email' | 'text';
  };
  availability: {
    isAvailable: boolean;
    responseTime: number;
    workingHours: {
      [key: string]: {
        start: string;
        end: string;
        available: boolean;
      };
    };
  };
  rating: number;
  reviewCount: number;
  completedProjects: number;
  specialties: string[];
  certifications: string[];
  experience: number;
  createdAt: string;
  lastActive: string;
}

export interface ContractorMatch {
  contractorId: string;
  contractorName: string;
  company: string;
  matchScore: number;
  matchFactors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  autoAccept: boolean;
  responseTime: number;
  rating: number;
  experience: number;
  specialties: string[];
  estimatedConversion: number;
}

export interface ContractorStats {
  total: number;
  available: number;
  avgRating: number;
  avgExperience: number;
  totalProjects: number;
  totalReviews: number;
}

export interface ContractorFilters {
  tradeType?: string;
  location?: string;
  budget?: string;
  available?: boolean;
  rating?: number;
  search?: string;
}

class ContractorService {
  // Mock data for now - will be replaced with actual API calls
  private mockContractors: Contractor[] = [
    {
      id: 'contractor-1',
      name: 'John Pro Builder',
      email: 'john@probuilder.com',
      phone: '(555) 123-4567',
      company: 'Pro Builder Construction',
      tradeTypes: ['residential', 'framing', 'remodel', 'new-build'],
      zipCodes: ['89104', '89110', '89074', '89101'],
      location: {
        city: 'Las Vegas',
        state: 'NV',
        serviceRadius: 25,
      },
      budget: {
        min: 5000,
        max: 50000,
        currency: 'USD',
      },
      preferences: {
        autoAccept: false,
        minAIScore: 70,
        maxResponseTime: 4,
        preferredContactMethod: 'phone',
      },
      availability: {
        isAvailable: true,
        responseTime: 2,
        workingHours: {
          monday: { start: '08:00', end: '17:00', available: true },
          tuesday: { start: '08:00', end: '17:00', available: true },
          wednesday: { start: '08:00', end: '17:00', available: true },
          thursday: { start: '08:00', end: '17:00', available: true },
          friday: { start: '08:00', end: '17:00', available: true },
          saturday: { start: '09:00', end: '15:00', available: false },
          sunday: { start: '09:00', end: '15:00', available: false },
        },
      },
      rating: 4.8,
      reviewCount: 127,
      completedProjects: 89,
      specialties: ['Kitchen Remodel', 'Bathroom Addition', 'Home Renovation'],
      certifications: ['Licensed Contractor', 'Bonded', 'Insured'],
      experience: 15,
      createdAt: '2024-01-01T00:00:00Z',
      lastActive: '2024-01-15T10:30:00Z',
    },
    {
      id: 'contractor-2',
      name: 'Sarah Quality Construction',
      email: 'sarah@qualityconstruction.com',
      phone: '(555) 987-6543',
      company: 'Quality Construction Co.',
      tradeTypes: ['residential', 'commercial', 'renovation', 'maintenance'],
      zipCodes: ['89101', '89102', '89103', '89002'],
      location: {
        city: 'Henderson',
        state: 'NV',
        serviceRadius: 30,
      },
      budget: {
        min: 3000,
        max: 75000,
        currency: 'USD',
      },
      preferences: {
        autoAccept: true,
        minAIScore: 60,
        maxResponseTime: 8,
        preferredContactMethod: 'email',
      },
      availability: {
        isAvailable: true,
        responseTime: 4,
        workingHours: {
          monday: { start: '07:00', end: '18:00', available: true },
          tuesday: { start: '07:00', end: '18:00', available: true },
          wednesday: { start: '07:00', end: '18:00', available: true },
          thursday: { start: '07:00', end: '18:00', available: true },
          friday: { start: '07:00', end: '18:00', available: true },
          saturday: { start: '08:00', end: '16:00', available: true },
          sunday: { start: '08:00', end: '16:00', available: false },
        },
      },
      rating: 4.6,
      reviewCount: 89,
      completedProjects: 156,
      specialties: [
        'Commercial Renovation',
        'Multi-family Projects',
        'Maintenance Services',
      ],
      certifications: [
        'Licensed Contractor',
        'Commercial License',
        'Bonded',
        'Insured',
      ],
      experience: 12,
      createdAt: '2024-01-01T00:00:00Z',
      lastActive: '2024-01-15T14:20:00Z',
    },
  ];

  // Get all contractors with optional filters
  async getContractors(filters?: ContractorFilters): Promise<Contractor[]> {
    try {
      // For now, return mock data
      // TODO: Replace with actual API call when backend is ready
      return this.mockContractors;
    } catch (error) {
      console.error('Error fetching contractors:', error);
      throw error;
    }
  }

  // Get contractor by ID
  async getContractor(id: string): Promise<Contractor> {
    try {
      const contractor = this.mockContractors.find(c => c.id === id);
      if (!contractor) {
        throw new Error('Contractor not found');
      }
      return contractor;
    } catch (error) {
      console.error('Error fetching contractor:', error);
      throw error;
    }
  }

  // Get contractor statistics
  async getContractorStats(): Promise<ContractorStats> {
    try {
      return {
        total: this.mockContractors.length,
        available: this.mockContractors.filter(c => c.availability.isAvailable)
          .length,
        avgRating: 4.7,
        avgExperience: 13.5,
        totalProjects: 245,
        totalReviews: 216,
      };
    } catch (error) {
      console.error('Error fetching contractor stats:', error);
      throw error;
    }
  }

  // Update contractor availability
  async updateAvailability(
    id: string,
    isAvailable: boolean
  ): Promise<Contractor> {
    try {
      const contractor = this.mockContractors.find(c => c.id === id);
      if (!contractor) {
        throw new Error('Contractor not found');
      }
      contractor.availability.isAvailable = isAvailable;
      contractor.lastActive = new Date().toISOString();
      return contractor;
    } catch (error) {
      console.error('Error updating contractor availability:', error);
      throw error;
    }
  }

  // Update contractor preferences
  async updatePreferences(
    id: string,
    preferences: Partial<Contractor['preferences']>
  ): Promise<Contractor> {
    try {
      const contractor = this.mockContractors.find(c => c.id === id);
      if (!contractor) {
        throw new Error('Contractor not found');
      }
      contractor.preferences = { ...contractor.preferences, ...preferences };
      contractor.lastActive = new Date().toISOString();
      return contractor;
    } catch (error) {
      console.error('Error updating contractor preferences:', error);
      throw error;
    }
  }

  // Match contractors to a lead
  async matchContractorsToLead(lead: any): Promise<{
    lead: any;
    matchedContractors: ContractorMatch[];
    totalMatches: number;
  }> {
    try {
      // Mock matching logic
      const matchedContractors: ContractorMatch[] = this.mockContractors
        .filter(c => c.availability.isAvailable)
        .map(contractor => ({
          contractorId: contractor.id,
          contractorName: contractor.name,
          company: contractor.company,
          matchScore: Math.floor(Math.random() * 40) + 60, // 60-100
          matchFactors: {
            positive: ['Trade type matches', 'Location matches service area'],
            negative: [],
            neutral: [],
          },
          autoAccept: contractor.preferences.autoAccept,
          responseTime: contractor.availability.responseTime,
          rating: contractor.rating,
          experience: contractor.experience,
          specialties: contractor.specialties,
          estimatedConversion: 0.75,
        }))
        .sort((a, b) => b.matchScore - a.matchScore);

      return {
        lead,
        matchedContractors,
        totalMatches: matchedContractors.length,
      };
    } catch (error) {
      console.error('Error matching contractors to lead:', error);
      throw error;
    }
  }

  // Get contractors by trade type
  async getContractorsByTrade(tradeType: string): Promise<Contractor[]> {
    try {
      return this.mockContractors.filter(c => c.tradeTypes.includes(tradeType));
    } catch (error) {
      console.error('Error fetching contractors by trade:', error);
      throw error;
    }
  }

  // Get contractors by location
  async getContractorsByLocation(zipCode: string): Promise<Contractor[]> {
    try {
      return this.mockContractors.filter(c => c.zipCodes.includes(zipCode));
    } catch (error) {
      console.error('Error fetching contractors by location:', error);
      throw error;
    }
  }

  // Search contractors
  async searchContractors(query: string): Promise<Contractor[]> {
    try {
      const searchTerm = query.toLowerCase();
      return this.mockContractors.filter(
        c =>
          c.name.toLowerCase().includes(searchTerm) ||
          c.company.toLowerCase().includes(searchTerm)
      );
    } catch (error) {
      console.error('Error searching contractors:', error);
      throw error;
    }
  }

  // Get available contractors
  async getAvailableContractors(): Promise<Contractor[]> {
    try {
      return this.mockContractors.filter(c => c.availability.isAvailable);
    } catch (error) {
      console.error('Error fetching available contractors:', error);
      throw error;
    }
  }

  // Helper method to get contractor match score color
  getMatchScoreColor(score: number): string {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FF9800'; // Orange
    if (score >= 40) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  }

  // Helper method to get contractor rating color
  getRatingColor(rating: number): string {
    if (rating >= 4.5) return '#4CAF50'; // Green
    if (rating >= 4.0) return '#FF9800'; // Orange
    if (rating >= 3.5) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  }

  // Helper method to format contractor specialties
  formatSpecialties(specialties: string[]): string {
    return (
      specialties.slice(0, 3).join(', ') + (specialties.length > 3 ? '...' : '')
    );
  }

  // Helper method to get contractor status
  getContractorStatus(
    contractor: Contractor
  ): 'available' | 'busy' | 'offline' {
    if (!contractor.availability.isAvailable) return 'offline';
    if (contractor.availability.responseTime > 4) return 'busy';
    return 'available';
  }

  // Helper method to get status color
  getStatusColor(status: 'available' | 'busy' | 'offline'): string {
    switch (status) {
      case 'available':
        return '#4CAF50';
      case 'busy':
        return '#FF9800';
      case 'offline':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  }
}

export const contractorService = new ContractorService();
