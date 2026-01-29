/**
 * Lead Enrichment System
 * Automatic data enrichment and validation for leads
 */

import { Lead, VerificationResult } from '../types';

export interface EnrichmentData {
  contact: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    linkedinUrl?: string;
    socialProfiles?: Record<string, string>;
  };
  location: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
    timeZone?: string;
    marketData?: {
      medianHomeValue?: number;
      avgProjectCost?: number;
      competitionLevel?: 'low' | 'medium' | 'high';
    };
  };
  project: {
    estimatedValue?: number;
    timeline?: string;
    urgency?: 'low' | 'medium' | 'high';
    complexity?: 'simple' | 'moderate' | 'complex';
    requiredPermits?: string[];
    similarProjects?: Array<{
      address: string;
      value: number;
      completionDate: string;
    }>;
  };
  verification: {
    emailValid?: boolean;
    phoneValid?: boolean;
    addressValid?: boolean;
    companyValid?: boolean;
    riskFlags?: string[];
    confidence: number;
  };
  insights: {
    buyingSignals?: string[];
    painPoints?: string[];
    competitors?: string[];
    recommendations?: string[];
  };
}

export interface EnrichmentService {
  name: string;
  type: 'email' | 'phone' | 'address' | 'company' | 'social' | 'property';
  enabled: boolean;
  cost: number;
  accuracy: number;
}

/**
 * Enrich a lead with additional data from various sources
 */
export async function enrichLead(lead: Lead): Promise<EnrichmentData> {
  console.log(`🔍 Enriching lead: ${lead.contact.name}`);
  
  const enrichmentData: EnrichmentData = {
    contact: {},
    location: {},
    project: {},
    verification: { confidence: 0 },
    insights: {}
  };

  try {
    // Parallel enrichment from multiple services
    const [
      emailData,
      phoneData,
      addressData,
      companyData,
      propertyData
    ] = await Promise.allSettled([
      enrichEmail(lead.contact.email),
      enrichPhone(lead.contact.phone),
      enrichAddress(lead.location),
      enrichCompany(lead.contact.company),
      enrichProperty(lead.location)
    ]);

    // Process email enrichment
    if (emailData.status === 'fulfilled') {
      enrichmentData.contact.email = emailData.value.email;
      enrichmentData.verification.emailValid = emailData.value.valid;
      enrichmentData.contact.fullName = emailData.value.fullName;
      enrichmentData.contact.company = emailData.value.company || enrichmentData.contact.company;
    }

    // Process phone enrichment
    if (phoneData.status === 'fulfilled') {
      enrichmentData.contact.phone = phoneData.value.formattedPhone;
      enrichmentData.verification.phoneValid = phoneData.value.valid;
      enrichmentData.contact.fullName = phoneData.value.fullName || enrichmentData.contact.fullName;
    }

    // Process address enrichment
    if (addressData.status === 'fulfilled') {
      enrichmentData.location = {
        ...enrichmentData.location,
        ...addressData.value
      };
      enrichmentData.verification.addressValid = addressData.value.valid;
    }

    // Process company enrichment
    if (companyData.status === 'fulfilled') {
      enrichmentData.contact.company = companyData.value.name || enrichmentData.contact.company;
      enrichmentData.contact.jobTitle = companyData.value.jobTitle;
      enrichmentData.contact.linkedinUrl = companyData.value.linkedinUrl;
    }

    // Process property enrichment
    if (propertyData.status === 'fulfilled') {
      enrichmentData.location.marketData = propertyData.value.marketData;
      enrichmentData.project.estimatedValue = propertyData.value.estimatedValue;
      enrichmentData.project.similarProjects = propertyData.value.similarProjects;
    }

    // Generate insights
    enrichmentData.insights = generateInsights(lead, enrichmentData);
    
    // Calculate overall verification confidence
    enrichmentData.verification.confidence = calculateVerificationConfidence(enrichmentData.verification);

    console.log(`✅ Lead enrichment completed for: ${lead.contact.name}`);
    return enrichmentData;

  } catch (error) {
    console.error('❌ Lead enrichment failed:', error);
    return enrichmentData;
  }
}

/**
 * Enrich email data
 */
async function enrichEmail(email?: string): Promise<{
  email: string;
  valid: boolean;
  fullName?: string;
  company?: string;
}> {
  if (!email) {
    return { email: '', valid: false };
  }

  // Simulate email validation and enrichment
  const isValid = validateEmailFormat(email);
  const domain = email.split('@')[1];
  
  return {
    email,
    valid: isValid,
    fullName: isValid ? extractNameFromEmail(email) : undefined,
    company: isValid ? extractCompanyFromDomain(domain) : undefined
  };
}

/**
 * Enrich phone data
 */
async function enrichPhone(phone?: string): Promise<{
  formattedPhone: string;
  valid: boolean;
  fullName?: string;
}> {
  if (!phone) {
    return { formattedPhone: '', valid: false };
  }

  const formattedPhone = formatPhoneNumber(phone);
  const isValid = validatePhoneNumber(formattedPhone);

  return {
    formattedPhone,
    valid: isValid,
    fullName: isValid ? await lookupPhoneOwner(formattedPhone) : undefined
  };
}

/**
 * Enrich address data
 */
async function enrichAddress(location?: { city?: string; state?: string }): Promise<{
  city?: string;
  state?: string;
  zipCode?: string;
  coordinates?: { lat: number; lng: number };
  timeZone?: string;
  valid: boolean;
}> {
  if (!location?.city || !location?.state) {
    return { valid: false };
  }

  // Simulate geocoding and address validation
  const coordinates = await geocodeAddress(location);
  const timeZone = getTimeZoneFromCoordinates(coordinates);

  return {
    city: location.city,
    state: location.state,
    zipCode: await getZipCodeFromCoordinates(coordinates),
    coordinates,
    timeZone,
    valid: !!coordinates
  };
}

/**
 * Enrich company data
 */
async function enrichCompany(company?: string): Promise<{
  name?: string;
  jobTitle?: string;
  linkedinUrl?: string;
}> {
  if (!company) {
    return {};
  }

  // Simulate company data lookup
  return {
    name: company,
    jobTitle: await getJobTitleFromCompany(company),
    linkedinUrl: await getLinkedinUrlFromCompany(company)
  };
}

/**
 * Enrich property data
 */
async function enrichProperty(location?: { city?: string; state?: string }): Promise<{
  marketData?: {
    medianHomeValue?: number;
    avgProjectCost?: number;
    competitionLevel?: 'low' | 'medium' | 'high';
  };
  estimatedValue?: number;
  similarProjects?: Array<{
    address: string;
    value: number;
    completionDate: string;
  }>;
}> {
  if (!location?.city || !location?.state) {
    return {};
  }

  // Simulate property and market data lookup
  const marketData = await getMarketData(location);
  const estimatedValue = await estimateProjectValue(location);
  const similarProjects = await getSimilarProjects(location);

  return {
    marketData,
    estimatedValue,
    similarProjects
  };
}

/**
 * Generate insights from enriched data
 */
function generateInsights(lead: Lead, enrichmentData: EnrichmentData): {
  buyingSignals?: string[];
  painPoints?: string[];
  competitors?: string[];
  recommendations?: string[];
} {
  const insights = {
    buyingSignals: [] as string[],
    painPoints: [] as string[],
    competitors: [] as string[],
    recommendations: [] as string[]
  };

  // Buying signals
  if (lead.project.timeline === 'urgent') {
    insights.buyingSignals.push('Urgent timeline indicates immediate need');
  }
  
  if (lead.project.budgetMin && lead.project.budgetMax) {
    const budgetRange = lead.project.budgetMax - lead.project.budgetMin;
    if (budgetRange < lead.project.budgetMin * 0.3) {
      insights.buyingSignals.push('Tight budget range shows research and readiness');
    }
  }

  if (enrichmentData.contact.company) {
    insights.buyingSignals.push('Company contact suggests professional decision-making');
  }

  // Pain points
  if (lead.project.timeline === 'urgent') {
    insights.painPoints.push('Time pressure may indicate current problems');
  }

  if (enrichmentData.location.marketData?.competitionLevel === 'high') {
    insights.painPoints.push('High competition market - emphasize unique value');
  }

  // Competitors
  if (enrichmentData.location.marketData?.competitionLevel === 'high') {
    insights.competitors.push('Local competitors likely active in this market');
  }

  // Recommendations
  if (insights.buyingSignals.length > 2) {
    insights.recommendations.push('High buying signals - prioritize immediate follow-up');
  }

  if (lead.project.timeline === 'urgent') {
    insights.recommendations.push('Urgent timeline - offer expedited service options');
  }

  if (enrichmentData.contact.company) {
    insights.recommendations.push('Company contact - prepare professional proposal');
  }

  return insights;
}

/**
 * Calculate verification confidence score
 */
function calculateVerificationConfidence(verification: Partial<VerificationResult>): number {
  let score = 0;
  let totalChecks = 0;

  if (verification.emailValid !== undefined) {
    totalChecks++;
    if (verification.emailValid) score += 1;
  }

  if (verification.phoneValid !== undefined) {
    totalChecks++;
    if (verification.phoneValid) score += 1;
  }

  if (verification.propertyVerified !== undefined) {
    totalChecks++;
    if (verification.propertyVerified) score += 1;
  }

  return totalChecks > 0 ? (score / totalChecks) * 100 : 0;
}

// Helper functions (these would integrate with real services)

function validateEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function extractNameFromEmail(email: string): string | undefined {
  // Simple name extraction from email
  const localPart = email.split('@')[0];
  return localPart.replace(/[._-]/g, ' ').replace(/\d+/g, '');
}

function extractCompanyFromDomain(domain: string): string | undefined {
  // Simple company extraction from domain
  const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  if (commonDomains.includes(domain)) return undefined;
  
  return domain.split('.')[0];
}

function formatPhoneNumber(phone: string): string {
  // Simple phone formatting
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function validatePhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

async function lookupPhoneOwner(phone: string): Promise<string | undefined> {
  // Simulate phone lookup service
  return undefined;
}

async function geocodeAddress(location: { city?: string; state?: string }): Promise<{ lat: number; lng: number } | null> {
  // Simulate geocoding service
  if (location.city && location.state) {
    // Return mock coordinates
    return { lat: 40.7128, lng: -74.0060 };
  }
  return null;
}

function getTimeZoneFromCoordinates(coords: { lat: number; lng: number } | null): string | undefined {
  // Simulate timezone lookup
  return coords ? 'America/New_York' : undefined;
}

async function getZipCodeFromCoordinates(coords: { lat: number; lng: number } | null): Promise<string | undefined> {
  // Simulate reverse geocoding
  return coords ? '10001' : undefined;
}

async function getJobTitleFromCompany(company: string): Promise<string | undefined> {
  // Simulate job title lookup
  return undefined;
}

async function getLinkedinUrlFromCompany(company: string): Promise<string | undefined> {
  // Simulate LinkedIn lookup
  return undefined;
}

async function getMarketData(location: { city?: string; state?: string }): Promise<{
  medianHomeValue?: number;
  avgProjectCost?: number;
  competitionLevel?: 'low' | 'medium' | 'high';
}> {
  // Simulate market data lookup
  return {
    medianHomeValue: 500000,
    avgProjectCost: 75000,
    competitionLevel: 'medium'
  };
}

async function estimateProjectValue(location: { city?: string; state?: string }): Promise<number | undefined> {
  // Simulate project value estimation
  return 65000;
}

async function getSimilarProjects(location: { city?: string; state?: string }): Promise<Array<{
  address: string;
  value: number;
  completionDate: string;
}> | undefined> {
  // Simulate similar projects lookup
  return [
    {
      address: '123 Main St, ' + location.city,
      value: 68000,
      completionDate: '2023-08-15'
    }
  ];
}


