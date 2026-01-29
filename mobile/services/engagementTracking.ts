/**
 * Engagement Tracking Service
 * Tracks user interactions with leads (calls, emails, views, response times)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lead, LeadEngagement } from '../lib/leads/types';

const ENGAGEMENT_STORAGE_KEY = 'lead-engagement-data';

interface EngagementData {
  [leadId: string]: {
    viewCount: number;
    responseCount: number;
    lastViewedAt?: string;
    yourLastResponseAt?: string;
    averageResponseTime?: number; // in minutes
    responseTimes: number[]; // Array of response times in minutes
    bidStartedAt?: string; // When bid builder was started
    bidSubmittedAt?: string; // When bid was submitted to client
    bidWonAt?: string; // When bid was marked as won (converted to active project)
    interactions: Array<{
      type: 'call' | 'email' | 'view';
      timestamp: string;
      responseTime?: number; // minutes from lead creation to this interaction
    }>;
  };
}

let engagementCache: EngagementData | null = null;

/**
 * Load engagement data from storage
 * @param forceRefresh - If true, bypasses cache and reloads from AsyncStorage
 */
export async function loadEngagementData(forceRefresh: boolean = false): Promise<EngagementData> {
  if (engagementCache && !forceRefresh) {
    return engagementCache;
  }
  
  try {
    const data = await AsyncStorage.getItem(ENGAGEMENT_STORAGE_KEY);
    if (data) {
      engagementCache = JSON.parse(data);
      return engagementCache || {};
    }
  } catch (error) {
    console.error('Failed to load engagement data:', error);
  }
  
  return {};
}

/**
 * Save engagement data to storage
 */
async function saveEngagementData(data: EngagementData): Promise<void> {
  try {
    engagementCache = data;
    await AsyncStorage.setItem(ENGAGEMENT_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save engagement data:', error);
  }
}

/**
 * Track a view of a lead
 */
export async function trackLeadView(leadId: string): Promise<void> {
  const data = await loadEngagementData();
  const engagement = data[leadId] || {
    viewCount: 0,
    responseCount: 0,
    responseTimes: [],
    interactions: [],
  };
  
  engagement.viewCount++;
  engagement.lastViewedAt = new Date().toISOString();
  
  // Add view interaction
  engagement.interactions.push({
    type: 'view',
    timestamp: new Date().toISOString(),
  });
  
  data[leadId] = engagement;
  await saveEngagementData(data);
}

/**
 * Track that a bid builder has been started for a lead
 */
export async function trackBidStarted(leadId: string): Promise<void> {
  const data = await loadEngagementData();
  const engagement = data[leadId] || {
    viewCount: 0,
    responseCount: 0,
    responseTimes: [],
    interactions: [],
  };
  
  // Mark that bid has been started
  if (!engagement.bidStartedAt) {
    engagement.bidStartedAt = new Date().toISOString();
    data[leadId] = engagement;
    await saveEngagementData(data);
    console.log(`📝 Tracked bid started for lead ${leadId}`);
  }
}

/**
 * Track that a bid has been submitted for a lead
 */
export async function trackBidSubmitted(leadId: string): Promise<void> {
  const data = await loadEngagementData();
  const engagement = data[leadId] || {
    viewCount: 0,
    responseCount: 0,
    responseTimes: [],
    interactions: [],
  };
  
  // Mark that bid has been submitted
  engagement.bidSubmittedAt = new Date().toISOString();
  data[leadId] = engagement;
  await saveEngagementData(data);
  console.log(`✅ Tracked bid submitted for lead ${leadId}`);
}

/**
 * Track that a bid has been won (converted to active project)
 */
export async function trackBidWon(leadId: string): Promise<void> {
  const data = await loadEngagementData();
  const engagement = data[leadId] || {
    viewCount: 0,
    responseCount: 0,
    responseTimes: [],
    interactions: [],
  };
  
  // Mark that bid has been won
  engagement.bidWonAt = new Date().toISOString();
  data[leadId] = engagement;
  await saveEngagementData(data);
  console.log(`🎉 Tracked bid won for lead ${leadId}`);
}

/**
 * Track that a bid was lost
 */
export async function trackBidLost(leadId: string): Promise<void> {
  const data = await loadEngagementData();
  const engagement = data[leadId] || {
    viewCount: 0,
    responseCount: 0,
    responseTimes: [],
    interactions: [],
  };
  
  // Mark that bid has been lost
  engagement.bidLostAt = new Date().toISOString();
  data[leadId] = engagement;
  await saveEngagementData(data);
  console.log(`❌ Tracked bid lost for lead ${leadId}`);
}

/**
 * Track a call or email to a lead
 */
export async function trackLeadResponse(
  leadId: string,
  type: 'call' | 'email',
  leadCreatedAt: string
): Promise<void> {
  const data = await loadEngagementData();
  const engagement = data[leadId] || {
    viewCount: 0,
    responseCount: 0,
    responseTimes: [],
    interactions: [],
  };
  
  // Calculate response time (minutes from lead creation)
  const leadCreated = new Date(leadCreatedAt).getTime();
  const now = Date.now();
  const responseTimeMinutes = Math.round((now - leadCreated) / (1000 * 60));
  
  engagement.responseCount++;
  engagement.yourLastResponseAt = new Date().toISOString();
  engagement.responseTimes.push(responseTimeMinutes);
  
  // Calculate average response time
  if (engagement.responseTimes.length > 0) {
    const sum = engagement.responseTimes.reduce((a, b) => a + b, 0);
    engagement.averageResponseTime = Math.round(sum / engagement.responseTimes.length);
  }
  
  // Add interaction
  engagement.interactions.push({
    type,
    timestamp: new Date().toISOString(),
    responseTime: responseTimeMinutes,
  });
  
  data[leadId] = engagement;
  await saveEngagementData(data);
  
  console.log(`📞 Tracked ${type} for lead ${leadId}: ${responseTimeMinutes} minutes response time`);
}

/**
 * Get engagement data for a lead
 */
export async function getLeadEngagement(leadId: string): Promise<LeadEngagement | undefined> {
  const data = await loadEngagementData();
  const engagement = data[leadId];
  
  if (!engagement) {
    return undefined;
  }
  
  return {
    viewCount: engagement.viewCount,
    responseCount: engagement.responseCount,
    lastViewedAt: engagement.lastViewedAt,
    yourLastResponseAt: engagement.yourLastResponseAt,
    averageResponseTime: engagement.averageResponseTime,
    bidStartedAt: engagement.bidStartedAt,
    bidSubmittedAt: engagement.bidSubmittedAt,
    bidWonAt: engagement.bidWonAt,
  };
}

/**
 * Get all engagement data (for analytics)
 * @param forceRefresh - If true, bypasses cache and reloads from AsyncStorage
 */
export async function getAllEngagementData(forceRefresh: boolean = false): Promise<EngagementData> {
  return await loadEngagementData(forceRefresh);
}

/**
 * Calculate average response time across all leads
 */
export async function calculateAverageResponseTime(): Promise<number> {
  const data = await loadEngagementData();
  const allResponseTimes: number[] = [];
  
  Object.values(data).forEach(engagement => {
    if (engagement.averageResponseTime !== undefined) {
      allResponseTimes.push(engagement.averageResponseTime);
    }
  });
  
  if (allResponseTimes.length === 0) {
    return 0;
  }
  
  const sum = allResponseTimes.reduce((a, b) => a + b, 0);
  return Math.round(sum / allResponseTimes.length);
}

/**
 * Get engagement stats for analytics
 */
export interface EngagementStats {
  totalInteractions: number;
  totalCalls: number;
  totalEmails: number;
  totalViews: number;
  averageResponseTime: number; // minutes
  averageResponseTimeHours: number; // hours
  leadsWithResponses: number;
  responseRate: number; // percentage of leads that received a response
}

export async function getEngagementStats(totalLeads: number): Promise<EngagementStats> {
  const data = await loadEngagementData();
  
  let totalInteractions = 0;
  let totalCalls = 0;
  let totalEmails = 0;
  let totalViews = 0;
  const responseTimes: number[] = [];
  let leadsWithResponses = 0;
  
  Object.values(data).forEach(engagement => {
    totalInteractions += engagement.interactions.length;
    totalViews += engagement.viewCount;
    
    engagement.interactions.forEach(interaction => {
      if (interaction.type === 'call') {
        totalCalls++;
      } else if (interaction.type === 'email') {
        totalEmails++;
      }
    });
    
    if (engagement.responseCount > 0) {
      leadsWithResponses++;
      if (engagement.averageResponseTime !== undefined) {
        responseTimes.push(engagement.averageResponseTime);
      }
    }
  });
  
  const averageResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;
  
  const averageResponseTimeHours = averageResponseTime > 0
    ? Math.round((averageResponseTime / 60) * 10) / 10
    : 0;
  
  const responseRate = totalLeads > 0
    ? Math.round((leadsWithResponses / totalLeads) * 100)
    : 0;
  
  return {
    totalInteractions,
    totalCalls,
    totalEmails,
    totalViews,
    averageResponseTime,
    averageResponseTimeHours,
    leadsWithResponses,
    responseRate,
  };
}

