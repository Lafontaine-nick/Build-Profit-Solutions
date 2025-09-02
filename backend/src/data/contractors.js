// Comprehensive contractor data for lead matching system
const contractors = [
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
      serviceRadius: 25
    },
    budget: {
      min: 5000,
      max: 50000,
      currency: 'USD'
    },
    preferences: {
      autoAccept: false,
      minLeadGrade: 'B',
      minAIScore: 70,
      maxResponseTime: 4,
      preferredContactMethod: 'phone'
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
        sunday: { start: '09:00', end: '15:00', available: false }
      }
    },
    rating: 4.8,
    reviewCount: 127,
    completedProjects: 89,
    specialties: ['Kitchen Remodel', 'Bathroom Addition', 'Home Renovation'],
    certifications: ['Licensed Contractor', 'Bonded', 'Insured'],
    experience: 15,
    createdAt: '2024-01-01T00:00:00Z',
    lastActive: '2024-01-15T10:30:00Z'
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
      serviceRadius: 30
    },
    budget: {
      min: 3000,
      max: 75000,
      currency: 'USD'
    },
    preferences: {
      autoAccept: true,
      minLeadGrade: 'C',
      minAIScore: 60,
      maxResponseTime: 8,
      preferredContactMethod: 'email'
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
        sunday: { start: '08:00', end: '16:00', available: false }
      }
    },
    rating: 4.6,
    reviewCount: 89,
    completedProjects: 156,
    specialties: ['Commercial Renovation', 'Multi-family Projects', 'Maintenance Services'],
    certifications: ['Licensed Contractor', 'Commercial License', 'Bonded', 'Insured'],
    experience: 12,
    createdAt: '2024-01-01T00:00:00Z',
    lastActive: '2024-01-15T14:20:00Z'
  },
  {
    id: 'contractor-3',
    name: 'Mike Elite Builders',
    email: 'mike@elitebuilders.com',
    phone: '(555) 456-7890',
    company: 'Elite Builders LLC',
    tradeTypes: ['residential', 'new-build', 'additions', 'remodel'],
    zipCodes: ['89002', '89005', '89011', '89012'],
    location: {
      city: 'Henderson',
      state: 'NV',
      serviceRadius: 20
    },
    budget: {
      min: 10000,
      max: 100000,
      currency: 'USD'
    },
    preferences: {
      autoAccept: false,
      minLeadGrade: 'A',
      minAIScore: 80,
      maxResponseTime: 2,
      preferredContactMethod: 'phone'
    },
    availability: {
      isAvailable: true,
      responseTime: 1,
      workingHours: {
        monday: { start: '08:00', end: '17:00', available: true },
        tuesday: { start: '08:00', end: '17:00', available: true },
        wednesday: { start: '08:00', end: '17:00', available: true },
        thursday: { start: '08:00', end: '17:00', available: true },
        friday: { start: '08:00', end: '17:00', available: true },
        saturday: { start: '09:00', end: '15:00', available: false },
        sunday: { start: '09:00', end: '15:00', available: false }
      }
    },
    rating: 4.9,
    reviewCount: 203,
    completedProjects: 234,
    specialties: ['Custom Homes', 'Luxury Renovations', 'Additions'],
    certifications: ['Licensed Contractor', 'Custom Home Builder', 'Bonded', 'Insured'],
    experience: 18,
    createdAt: '2024-01-01T00:00:00Z',
    lastActive: '2024-01-15T09:15:00Z'
  },
  {
    id: 'contractor-4',
    name: 'Lisa Quick Fix',
    email: 'lisa@quickfix.com',
    phone: '(555) 789-0123',
    company: 'Quick Fix Repairs',
    tradeTypes: ['residential', 'maintenance', 'repair', 'renovation'],
    zipCodes: ['89101', '89102', '89103', '89104'],
    location: {
      city: 'Las Vegas',
      state: 'NV',
      serviceRadius: 15
    },
    budget: {
      min: 500,
      max: 25000,
      currency: 'USD'
    },
    preferences: {
      autoAccept: true,
      minLeadGrade: 'D',
      minAIScore: 50,
      maxResponseTime: 24,
      preferredContactMethod: 'text'
    },
    availability: {
      isAvailable: true,
      responseTime: 6,
      workingHours: {
        monday: { start: '08:00', end: '17:00', available: true },
        tuesday: { start: '08:00', end: '17:00', available: true },
        wednesday: { start: '08:00', end: '17:00', available: true },
        thursday: { start: '08:00', end: '17:00', available: true },
        friday: { start: '08:00', end: '17:00', available: true },
        saturday: { start: '09:00', end: '15:00', available: true },
        sunday: { start: '09:00', end: '15:00', available: false }
      }
    },
    rating: 4.4,
    reviewCount: 67,
    completedProjects: 312,
    specialties: ['Quick Repairs', 'Maintenance', 'Small Renovations'],
    certifications: ['Licensed Contractor', 'Repair Specialist', 'Bonded', 'Insured'],
    experience: 8,
    createdAt: '2024-01-01T00:00:00Z',
    lastActive: '2024-01-15T16:45:00Z'
  },
  {
    id: 'contractor-5',
    name: 'David Commercial Pro',
    email: 'david@commercialpro.com',
    phone: '(555) 321-6540',
    company: 'Commercial Pro Construction',
    tradeTypes: ['commercial', 'industrial', 'renovation', 'new-build'],
    zipCodes: ['89101', '89102', '89103', '89104', '89105'],
    location: {
      city: 'Las Vegas',
      state: 'NV',
      serviceRadius: 40
    },
    budget: {
      min: 25000,
      max: 500000,
      currency: 'USD'
    },
    preferences: {
      autoAccept: false,
      minLeadGrade: 'A',
      minAIScore: 75,
      maxResponseTime: 6,
      preferredContactMethod: 'email'
    },
    availability: {
      isAvailable: true,
      responseTime: 3,
      workingHours: {
        monday: { start: '07:00', end: '18:00', available: true },
        tuesday: { start: '07:00', end: '18:00', available: true },
        wednesday: { start: '07:00', end: '18:00', available: true },
        thursday: { start: '07:00', end: '18:00', available: true },
        friday: { start: '07:00', end: '18:00', available: true },
        saturday: { start: '08:00', end: '16:00', available: true },
        sunday: { start: '08:00', end: '16:00', available: false }
      }
    },
    rating: 4.7,
    reviewCount: 145,
    completedProjects: 89,
    specialties: ['Commercial Buildings', 'Office Renovations', 'Industrial Projects'],
    certifications: ['Licensed Contractor', 'Commercial License', 'Industrial License', 'Bonded', 'Insured'],
    experience: 22,
    createdAt: '2024-01-01T00:00:00Z',
    lastActive: '2024-01-15T11:30:00Z'
  }
];

// Helper functions for contractor operations
const contractorService = {
  // Get all contractors
  getAll: () => contractors,
  
  // Get contractor by ID
  getById: (id) => contractors.find(c => c.id === id),
  
  // Get contractors by trade type
  getByTradeType: (tradeType) => 
    contractors.filter(c => c.tradeTypes.includes(tradeType)),
  
  // Get contractors by location (ZIP code)
  getByLocation: (zipCode) => 
    contractors.filter(c => c.zipCodes.includes(zipCode)),
  
  // Get contractors by budget range
  getByBudgetRange: (minBudget, maxBudget) => 
    contractors.filter(c => 
      c.budget.min <= maxBudget && c.budget.max >= minBudget
    ),
  
  // Get available contractors
  getAvailable: () => 
    contractors.filter(c => c.availability.isAvailable),
  
  // Get contractors by rating
  getByRating: (minRating) => 
    contractors.filter(c => c.rating >= minRating),
  
  // Search contractors by name or company
  search: (query) => {
    const searchTerm = query.toLowerCase();
    return contractors.filter(c => 
      c.name.toLowerCase().includes(searchTerm) ||
      c.company.toLowerCase().includes(searchTerm)
    );
  },
  
  // Update contractor availability
  updateAvailability: (id, isAvailable) => {
    const contractor = contractors.find(c => c.id === id);
    if (contractor) {
      contractor.availability.isAvailable = isAvailable;
      contractor.lastActive = new Date().toISOString();
    }
    return contractor;
  },
  
  // Update contractor preferences
  updatePreferences: (id, preferences) => {
    const contractor = contractors.find(c => c.id === id);
    if (contractor) {
      contractor.preferences = { ...contractor.preferences, ...preferences };
      contractor.lastActive = new Date().toISOString();
    }
    return contractor;
  },
  
  // Get contractor statistics
  getStats: () => {
    const total = contractors.length;
    const available = contractors.filter(c => c.availability.isAvailable).length;
    const avgRating = contractors.reduce((sum, c) => sum + c.rating, 0) / total;
    const avgExperience = contractors.reduce((sum, c) => sum + c.experience, 0) / total;
    
    return {
      total,
      available,
      avgRating: Math.round(avgRating * 10) / 10,
      avgExperience: Math.round(avgExperience),
      totalProjects: contractors.reduce((sum, c) => sum + c.completedProjects, 0),
      totalReviews: contractors.reduce((sum, c) => sum + c.reviewCount, 0)
    };
  }
};

module.exports = {
  contractors,
  contractorService
}; 