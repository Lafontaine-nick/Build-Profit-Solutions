/**
 * Phase 2 Enhancement Utilities
 * Customer Lifetime Value, Photo Galleries, Engagement Tracking
 */

import { Lead } from '../types';

/**
 * Customer Lifetime Value (LTV) Data
 */
export interface CustomerLTVData {
  estimatedLTV: number;
  repeatCustomerPotential: 'high' | 'medium' | 'low';
  propertyCount: number;
  previousSpend: number;
  customerTier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'new';
  indicators: {
    hasMultipleProperties: boolean;
    highBudget: boolean;
    hasHistory: boolean;
    goodPaymentHistory: boolean;
  };
}

/**
 * Calculate Customer Lifetime Value indicators
 */
export const calculateCustomerLTV = (lead: Lead): CustomerLTVData => {
  const budget = lead.project.budgetMax || lead.project.budgetMin || 0;
  
  // Mock data - in production this would come from backend
  const propertyCount = Math.floor(Math.random() * 3) + 1; // 1-3 properties
  const previousSpend = budget > 50000 ? Math.floor(Math.random() * 150000) + 50000 : 0;
  const hasHistory = previousSpend > 0;
  
  // Calculate indicators
  const hasMultipleProperties = propertyCount > 1;
  const highBudget = budget >= 50000;
  const goodPaymentHistory = Math.random() > 0.3; // 70% have good payment history
  
  // Determine repeat potential
  let repeatCustomerPotential: 'high' | 'medium' | 'low' = 'low';
  if (hasMultipleProperties && highBudget && hasHistory) {
    repeatCustomerPotential = 'high';
  } else if (hasMultipleProperties || highBudget) {
    repeatCustomerPotential = 'medium';
  }
  
  // Determine tier
  let customerTier: CustomerLTVData['customerTier'] = 'new';
  if (previousSpend >= 100000) {
    customerTier = 'platinum';
  } else if (previousSpend >= 50000) {
    customerTier = 'gold';
  } else if (previousSpend >= 25000) {
    customerTier = 'silver';
  } else if (previousSpend > 0) {
    customerTier = 'bronze';
  }
  
  // Estimate LTV (current project + potential future projects)
  const estimatedLTV = budget + (propertyCount > 1 ? budget * 2 : budget * 0.5);
  
  return {
    estimatedLTV,
    repeatCustomerPotential,
    propertyCount,
    previousSpend,
    customerTier,
    indicators: {
      hasMultipleProperties,
      highBudget,
      hasHistory,
      goodPaymentHistory,
    },
  };
};

/**
 * Get customer tier badge info
 */
export const getCustomerTierBadge = (tier: CustomerLTVData['customerTier']): {
  label: string;
  emoji: string;
  color: string;
  description: string;
} => {
  switch (tier) {
    case 'platinum':
      return {
        label: 'Platinum Customer',
        emoji: '💎',
        color: '#E5E4E2',
        description: '$100K+ lifetime spend',
      };
    case 'gold':
      return {
        label: 'Gold Customer',
        emoji: '🥇',
        color: '#FFD700',
        description: '$50K+ lifetime spend',
      };
    case 'silver':
      return {
        label: 'Silver Customer',
        emoji: '🥈',
        color: '#C0C0C0',
        description: '$25K+ lifetime spend',
      };
    case 'bronze':
      return {
        label: 'Bronze Customer',
        emoji: '🥉',
        color: '#CD7F32',
        description: 'Repeat customer',
      };
    default:
      return {
        label: 'New Customer',
        emoji: '✨',
        color: '#34C759',
        description: 'First project',
      };
  }
};

/**
 * Get repeat potential info
 */
export const getRepeatPotentialInfo = (potential: CustomerLTVData['repeatCustomerPotential']): {
  label: string;
  color: string;
  message: string;
} => {
  switch (potential) {
    case 'high':
      return {
        label: 'High Repeat Potential',
        color: '#34C759',
        message: 'Multiple properties • Likely to return',
      };
    case 'medium':
      return {
        label: 'Medium Repeat Potential',
        color: '#FF9500',
        message: 'Good opportunity for future work',
      };
    default:
      return {
        label: 'Standard Potential',
        color: '#8E8E93',
        message: 'Single project opportunity',
      };
  }
};

/**
 * Enhanced Engagement Metrics
 */
export interface EnhancedEngagementMetrics {
  profileViews: number;
  estimateOpened: boolean;
  estimateOpenedAt?: string;
  lastActive?: string;
  responseRate: number; // 0-100
  averageResponseTime: number; // minutes
  engagement: {
    yourViews: number;
    customerViews: number;
    messagesExchanged: number;
    documentsShared: number;
  };
}

/**
 * Generate mock engagement metrics
 */
export const generateEnhancedEngagement = (lead: Lead): EnhancedEngagementMetrics => {
  const budget = lead.project.budgetMax || lead.project.budgetMin || 0;
  const isHighValue = budget >= 50000;
  
  // Profile views (higher for high-value leads)
  const profileViews = isHighValue 
    ? Math.floor(Math.random() * 5) + 3 
    : Math.floor(Math.random() * 3) + 1;
  
  // Estimate engagement
  const estimateOpened = Math.random() > 0.4; // 60% chance opened
  const estimateOpenedAt = estimateOpened 
    ? new Date(Date.now() - Math.random() * 86400000).toISOString() // Within last day
    : undefined;
  
  // Last active
  const lastActive = new Date(Date.now() - Math.random() * 7200000).toISOString(); // Within last 2 hours
  
  // Response rate and time
  const responseRate = Math.floor(Math.random() * 40) + 60; // 60-100%
  const averageResponseTime = Math.floor(Math.random() * 120) + 30; // 30-150 minutes
  
  return {
    profileViews,
    estimateOpened,
    estimateOpenedAt,
    lastActive,
    responseRate,
    averageResponseTime,
    engagement: {
      yourViews: Math.floor(Math.random() * 3) + 1,
      customerViews: profileViews,
      messagesExchanged: Math.floor(Math.random() * 5),
      documentsShared: Math.floor(Math.random() * 3),
    },
  };
};

/**
 * Get engagement status
 */
export const getEngagementStatus = (metrics: EnhancedEngagementMetrics): {
  status: 'hot' | 'warm' | 'cold';
  label: string;
  color: string;
  message: string;
} => {
  const { profileViews, estimateOpened, lastActive } = metrics;
  
  // Calculate minutes since last active
  const minutesSinceActive = lastActive 
    ? Math.floor((Date.now() - new Date(lastActive).getTime()) / 60000)
    : 9999;
  
  // Hot: Recently active + opened estimate + multiple views
  if (minutesSinceActive < 60 && estimateOpened && profileViews >= 3) {
    return {
      status: 'hot',
      label: '🔥 Highly Engaged',
      color: '#FF3B30',
      message: `Active ${minutesSinceActive} min ago • Viewed profile ${profileViews}x`,
    };
  }
  
  // Warm: Moderate engagement
  if (estimateOpened || profileViews >= 2) {
    return {
      status: 'warm',
      label: '⚡ Engaged',
      color: '#FF9500',
      message: estimateOpened 
        ? 'Opened your estimate • Interested'
        : `Viewed profile ${profileViews}x`,
    };
  }
  
  // Cold: Low engagement
  return {
    status: 'cold',
    label: '📋 Standard',
    color: '#8E8E93',
    message: 'Limited engagement so far',
  };
};

/**
 * Mock photo data for leads
 */
export interface LeadPhoto {
  id: string;
  uri: string;
  type: 'inspiration' | 'site' | 'blueprint' | 'document';
  caption?: string;
  uploadedAt: string;
}

/**
 * Generate mock photos for a lead
 */
export const generateMockPhotos = (lead: Lead): LeadPhoto[] => {
  const budget = lead.project.budgetMax || lead.project.budgetMin || 0;
  const isHighValue = budget >= 50000;
  
  // High-value leads more likely to have photos
  const photoCount = isHighValue 
    ? Math.floor(Math.random() * 4) + 2 // 2-5 photos
    : Math.random() > 0.5 
      ? Math.floor(Math.random() * 2) + 1 // 1-2 photos
      : 0; // No photos
  
  if (photoCount === 0) return [];
  
  const photos: LeadPhoto[] = [];
  const photoTypes: LeadPhoto['type'][] = ['inspiration', 'site', 'blueprint', 'document'];
  
  for (let i = 0; i < photoCount; i++) {
    photos.push({
      id: `photo-${lead.id}-${i}`,
      uri: `https://picsum.photos/400/300?random=${lead.id}-${i}`, // Placeholder images
      type: photoTypes[i % photoTypes.length],
      caption: i === 0 ? 'Inspiration photo' : undefined,
      uploadedAt: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(), // Within last 3 days
    });
  }
  
  return photos;
};

/**
 * Get photo type info
 */
export const getPhotoTypeInfo = (type: LeadPhoto['type']): {
  label: string;
  icon: string;
  color: string;
} => {
  switch (type) {
    case 'inspiration':
      return { label: 'Inspiration', icon: '✨', color: '#FF9500' };
    case 'site':
      return { label: 'Site Photo', icon: '📸', color: '#34C759' };
    case 'blueprint':
      return { label: 'Blueprint', icon: '📐', color: '#007AFF' };
    case 'document':
      return { label: 'Document', icon: '📄', color: '#8E8E93' };
  }
};

/**
 * Format time ago for engagement
 */
export const formatEngagementTime = (isoString: string): string => {
  const minutes = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};










