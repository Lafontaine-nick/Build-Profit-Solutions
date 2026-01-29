/**
 * Phase 1 Enhancement Utilities
 * Response Time Tracking, Quality Indicators, Competitive Intel, Quick Responses
 */

import { Lead, LeadQualityIndicators, LeadEngagement } from '../types';

/**
 * Calculate how many minutes ago a lead was created
 */
export const getMinutesSinceCreated = (createdAt: string): number => {
  const now = new Date().getTime();
  const created = new Date(createdAt).getTime();
  return Math.floor((now - created) / (1000 * 60));
};

/**
 * Get formatted time ago string (e.g., "5 min ago", "2 hours ago", "3 days ago")
 */
export const getTimeAgo = (createdAt: string): string => {
  const minutes = getMinutesSinceCreated(createdAt);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
};

/**
 * Calculate urgency score (0-100) based on time since created
 * 100 = just created, decreases over time
 */
export const calculateUrgencyScore = (createdAt: string): number => {
  const minutes = getMinutesSinceCreated(createdAt);
  
  // First hour: 100-90
  if (minutes < 60) return Math.max(90, 100 - minutes);
  
  // First 24 hours: 90-70
  if (minutes < 1440) return Math.max(70, 90 - (minutes / 1440) * 20);
  
  // First week: 70-30
  if (minutes < 10080) return Math.max(30, 70 - (minutes / 10080) * 40);
  
  // After week: 30-0
  return Math.max(0, 30 - (minutes / 43200) * 30);
};

/**
 * Get urgency level and color
 */
export const getUrgencyLevel = (urgencyScore: number): {
  level: 'critical' | 'high' | 'medium' | 'low';
  color: string;
  label: string;
} => {
  if (urgencyScore >= 90) {
    return { level: 'critical', color: '#FF3B30', label: '🔥 HOT' };
  }
  if (urgencyScore >= 70) {
    return { level: 'high', color: '#FF9500', label: '⚡ New' };
  }
  if (urgencyScore >= 40) {
    return { level: 'medium', color: '#FFCC00', label: '⏰ Active' };
  }
  return { level: 'low', color: '#8E8E93', label: '📋 Standard' };
};

/**
 * Calculate quality indicators for a lead
 */
export const calculateQualityIndicators = (lead: Lead): LeadQualityIndicators => {
  const phoneVerified = !!(lead.contact.phone && lead.contact.phone.length >= 10);
  const emailVerified = !!(lead.contact.email && lead.contact.email.includes('@'));
  const budgetConfirmed = !!(lead.project.budgetMin > 0 && lead.project.budgetMax > 0);
  const photosAttached = !!(lead.photos && lead.photos.length > 0);
  const locationVerified = !!(lead.location.city && lead.location.state && lead.location.zip);
  
  // High intent if at least 3 indicators are true
  const indicatorCount = [phoneVerified, emailVerified, budgetConfirmed, photosAttached, locationVerified]
    .filter(Boolean).length;
  const highIntent = indicatorCount >= 3;
  
  return {
    phoneVerified,
    emailVerified,
    budgetConfirmed,
    photosAttached,
    locationVerified,
    highIntent,
  };
};

/**
 * Generate mock engagement data (in production, this would come from backend)
 */
export const generateMockEngagement = (lead: Lead): LeadEngagement => {
  const minutesSinceCreated = getMinutesSinceCreated(lead.createdAt);
  
  // Simulate view count based on urgency and budget
  const budgetFactor = lead.project.budgetMax / 10000; // Higher budget = more views
  const timeFactor = Math.max(1, minutesSinceCreated / 60); // More views over time
  const viewCount = Math.floor(Math.random() * 5 + budgetFactor + timeFactor);
  
  // Response count (typically less than views)
  const responseCount = Math.floor(viewCount * 0.3);
  
  // Average response time in the market
  const averageResponseTime = 45 + Math.floor(Math.random() * 90); // 45-135 minutes
  
  return {
    viewCount: Math.max(1, viewCount),
    responseCount: Math.max(0, responseCount),
    averageResponseTime,
  };
};

/**
 * Get competitive pressure message
 */
export const getCompetitivePressure = (engagement: LeadEngagement): {
  message: string;
  urgency: 'high' | 'medium' | 'low';
  color: string;
} => {
  if (engagement.viewCount >= 5) {
    return {
      message: `🔥 ${engagement.viewCount} contractors viewing • ${engagement.responseCount} responded`,
      urgency: 'high',
      color: '#FF3B30',
    };
  }
  if (engagement.viewCount >= 3) {
    return {
      message: `⚡ ${engagement.viewCount} contractors viewing • Act fast!`,
      urgency: 'medium',
      color: '#FF9500',
    };
  }
  return {
    message: `👀 ${engagement.viewCount} contractor${engagement.viewCount > 1 ? 's' : ''} viewing`,
    urgency: 'low',
    color: '#34C759',
  };
};

/**
 * Calculate your response performance vs market
 */
export const getResponsePerformance = (
  yourResponseMinutes: number | undefined,
  marketAverage: number
): {
  status: 'faster' | 'slower' | 'no_response';
  message: string;
  color: string;
} => {
  if (!yourResponseMinutes) {
    return {
      status: 'no_response',
      message: 'Not responded yet',
      color: '#8E8E93',
    };
  }
  
  const percentDiff = ((marketAverage - yourResponseMinutes) / marketAverage) * 100;
  
  if (percentDiff > 20) {
    return {
      status: 'faster',
      message: `⚡ ${Math.round(percentDiff)}% faster than average`,
      color: '#34C759',
    };
  }
  
  if (percentDiff < -20) {
    return {
      status: 'slower',
      message: `⏰ ${Math.abs(Math.round(percentDiff))}% slower than average`,
      color: '#FF9500',
    };
  }
  
  return {
    status: 'faster',
    message: '✓ Average response time',
    color: '#34C759',
  };
};

/**
 * Quick response templates
 */
export interface QuickResponseTemplate {
  id: string;
  title: string;
  message: string;
  icon: string;
  action: 'call' | 'message' | 'schedule';
}

export const QUICK_RESPONSE_TEMPLATES: QuickResponseTemplate[] = [
  {
    id: 'interested',
    title: "I'm interested!",
    message: "Hi! I'd love to discuss your project. When's a good time to talk?",
    icon: '👋',
    action: 'message',
  },
  {
    id: 'call-now',
    title: 'Call now',
    message: "I'm calling you now to discuss the project details.",
    icon: '📞',
    action: 'call',
  },
  {
    id: 'quote-ready',
    title: 'Quote in 24h',
    message: "I can provide a detailed quote within 24 hours. Can we schedule a quick call?",
    icon: '⚡',
    action: 'message',
  },
  {
    id: 'available',
    title: 'Available next week',
    message: "I have availability next week and can start right away. Let's discuss your timeline!",
    icon: '📅',
    action: 'schedule',
  },
  {
    id: 'free-consult',
    title: 'Free consultation',
    message: "I offer a free consultation to discuss your project needs. When works for you?",
    icon: '🎁',
    action: 'schedule',
  },
  {
    id: 'portfolio',
    title: 'Share portfolio',
    message: "I have extensive experience with similar projects. I'd love to share my portfolio with you!",
    icon: '📸',
    action: 'message',
  },
];

/**
 * Get quality score percentage (0-100)
 */
export const getQualityScore = (indicators: LeadQualityIndicators): number => {
  const scores = [
    indicators.phoneVerified ? 20 : 0,
    indicators.emailVerified ? 20 : 0,
    indicators.budgetConfirmed ? 20 : 0,
    indicators.photosAttached ? 20 : 0,
    indicators.locationVerified ? 20 : 0,
  ];
  return scores.reduce((a, b) => a + b, 0);
};

/**
 * Get quality badge
 */
export const getQualityBadge = (score: number): {
  label: string;
  color: string;
  emoji: string;
} => {
  if (score >= 80) {
    return { label: 'Premium Lead', color: '#FFD700', emoji: '⭐' };
  }
  if (score >= 60) {
    return { label: 'Quality Lead', color: '#34C759', emoji: '✓' };
  }
  if (score >= 40) {
    return { label: 'Good Lead', color: '#007AFF', emoji: '👍' };
  }
  return { label: 'Basic Lead', color: '#8E8E93', emoji: '📋' };
};










