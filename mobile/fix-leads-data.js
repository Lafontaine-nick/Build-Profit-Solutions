const fs = require('fs');

// Read the leads.tsx file
const filePath = 'app/(tabs)/leads.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add missing fields to mock leads
const mockLeadTemplate = {
  timeline: {
    startDate: new Date().toISOString(),
    duration: 8,
    urgency: 'medium',
  },
  requirements: 'Kitchen renovation with modern appliances',
  source: 'website',
  contractorMatch: {
    isMatched: false,
    matchScore: 0,
  },
  followUpHistory: [],
  autoFollowUp: {
    isEnabled: true,
    nextFollowUpDate: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString(),
    followUpType: 'email',
    template: 'standard',
  },
  crmData: {
    lastContacted: new Date().toISOString(),
    contactAttempts: 0,
    responseRate: 0,
    preferredContactMethod: 'email',
    notes: [],
    tags: [],
  },
  priority: 'medium',
  notes: [],
};

// Replace the mock leads with complete data
const updatedContent = content.replace(
  /const mockLeads: Lead\[\] = \[[\s\S]*?\];/,
  `const mockLeads: Lead[] = [
    {
      id: '1',
      name: 'John Smith',
      company: 'Smith Construction',
      email: 'john@smithconstruction.com',
      phone: '(555) 123-4567',
      projectType: 'residential',
      projectSize: 'medium',
      budget: { min: 25000, max: 45000, currency: 'USD' },
      location: { city: 'Austin', state: 'TX', zipCode: '78701' },
      status: 'new' as const,
      aiScore: 87,
      freshnessScore: 92,
      engagementLevel: 'hot',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['kitchen', 'remodel'],
      ...mockLeadTemplate
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      company: 'Johnson Homes',
      email: 'sarah@johnsonhomes.com',
      phone: '(555) 234-5678',
      projectType: 'residential',
      projectSize: 'large',
      budget: { min: 75000, max: 125000, currency: 'USD' },
      location: { city: 'Denver', state: 'CO', zipCode: '80202' },
      status: 'contacted' as const,
      aiScore: 92,
      freshnessScore: 88,
      engagementLevel: 'hot',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['bathroom', 'luxury'],
      ...mockLeadTemplate
    },
    {
      id: '3',
      name: 'Mike Wilson',
      company: 'Wilson Builders',
      email: 'mike@wilsonbuilders.com',
      phone: '(555) 345-6789',
      projectType: 'residential',
      projectSize: 'small',
      budget: { min: 15000, max: 30000, currency: 'USD' },
      location: { city: 'Phoenix', state: 'AZ', zipCode: '85001' },
      status: 'qualified' as const,
      aiScore: 78,
      freshnessScore: 85,
      engagementLevel: 'warm',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['deck', 'outdoor'],
      ...mockLeadTemplate
    }
  ];`
);

fs.writeFileSync(filePath, updatedContent);
console.log('Fixed leads.tsx mock data');
