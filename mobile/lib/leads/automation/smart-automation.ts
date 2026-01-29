/**
 * Smart Automation System
 * AI-powered lead nurturing and follow-up automation
 */

import { Lead, LeadStage } from '../types';

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface AutomationTrigger {
  type: 'lead_created' | 'stage_changed' | 'score_changed' | 'no_response' | 'high_score' | 'time_based';
  config: Record<string, any>;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_equals';
  value: any;
}

export interface AutomationAction {
  type: 'send_email' | 'send_sms' | 'assign_contractor' | 'update_stage' | 'add_tag' | 'create_task' | 'send_notification';
  config: Record<string, any>;
  delay?: number; // minutes
}

export interface AutomationCampaign {
  id: string;
  name: string;
  description: string;
  rules: AutomationRule[];
  isActive: boolean;
  performance: {
    totalTriggers: number;
    conversions: number;
    conversionRate: number;
    avgResponseTime: number;
  };
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  category: 'welcome' | 'follow_up' | 'nurture' | 'proposal' | 'reminder';
}

export interface AutomationAnalytics {
  totalCampaigns: number;
  activeRules: number;
  totalTriggers: number;
  conversionRate: number;
  avgResponseTime: number;
  topPerformingRules: Array<{
    ruleId: string;
    ruleName: string;
    triggers: number;
    conversions: number;
    conversionRate: number;
  }>;
}

/**
 * Default automation rules for lead generation
 */
export const defaultAutomationRules: AutomationRule[] = [
  {
    id: 'welcome_new_lead',
    name: 'Welcome New Lead',
    description: 'Send welcome email to new leads within 5 minutes',
    trigger: {
      type: 'lead_created',
      config: {}
    },
    conditions: [
      { field: 'source', operator: 'not_equals', value: 'manual' }
    ],
    actions: [
      {
        type: 'send_email',
        config: {
          template: 'welcome_new_lead',
          priority: 'high'
        },
        delay: 5
      }
    ],
    isActive: true,
    createdAt: new Date(),
    triggerCount: 0
  },
  
  {
    id: 'high_score_priority',
    name: 'High Score Priority',
    description: 'Assign top contractor and notify team for high-scoring leads',
    trigger: {
      type: 'score_changed',
      config: {}
    },
    conditions: [
      { field: 'aiScore', operator: 'greater_than', value: 85 },
      { field: 'stage', operator: 'equals', value: 'new' }
    ],
    actions: [
      {
        type: 'assign_contractor',
        config: {
          priority: 'high',
          autoAssign: true
        }
      },
      {
        type: 'send_notification',
        config: {
          message: 'High-scoring lead requires immediate attention',
          recipients: ['team', 'manager']
        }
      },
      {
        type: 'update_stage',
        config: {
          stage: 'qualified'
        }
      }
    ],
    isActive: true,
    createdAt: new Date(),
    triggerCount: 0
  },
  
  {
    id: 'follow_up_no_response',
    name: 'Follow-up No Response',
    description: 'Follow up with leads who haven\'t responded in 48 hours',
    trigger: {
      type: 'no_response',
      config: {
        timeLimit: 48 // hours
      }
    },
    conditions: [
      { field: 'stage', operator: 'not_equals', value: 'won' },
      { field: 'stage', operator: 'not_equals', value: 'lost' }
    ],
    actions: [
      {
        type: 'send_email',
        config: {
          template: 'follow_up_no_response',
          priority: 'medium'
        }
      },
      {
        type: 'create_task',
        config: {
          title: 'Follow up with lead',
          priority: 'medium',
          assignTo: 'lead_owner'
        }
      }
    ],
    isActive: true,
    createdAt: new Date(),
    triggerCount: 0
  },
  
  {
    id: 'proposal_reminder',
    name: 'Proposal Reminder',
    description: 'Send proposal reminder to qualified leads',
    trigger: {
      type: 'stage_changed',
      config: {}
    },
    conditions: [
      { field: 'stage', operator: 'equals', value: 'qualified' }
    ],
    actions: [
      {
        type: 'send_email',
        config: {
          template: 'proposal_reminder',
          priority: 'high'
        },
        delay: 60 // 1 hour delay
      },
      {
        type: 'create_task',
        config: {
          title: 'Prepare proposal for qualified lead',
          priority: 'high',
          assignTo: 'sales_team'
        }
      }
    ],
    isActive: true,
    createdAt: new Date(),
    triggerCount: 0
  },
  
  {
    id: 'weekly_nurture',
    name: 'Weekly Nurture Campaign',
    description: 'Send weekly educational content to warm leads',
    trigger: {
      type: 'time_based',
      config: {
        frequency: 'weekly',
        dayOfWeek: 1, // Monday
        time: '09:00'
      }
    },
    conditions: [
      { field: 'stage', operator: 'equals', value: 'verified' },
      { field: 'aiScore', operator: 'greater_than', value: 50 }
    ],
    actions: [
      {
        type: 'send_email',
        config: {
          template: 'weekly_nurture',
          priority: 'low'
        }
      }
    ],
    isActive: true,
    createdAt: new Date(),
    triggerCount: 0
  }
];

/**
 * Default email templates
 */
export const defaultEmailTemplates: EmailTemplate[] = [
  {
    id: 'welcome_new_lead',
    name: 'Welcome New Lead',
    subject: 'Welcome to Build Profit Solutions - Your Project Awaits!',
    body: `Hi \{\{contact.name\}\},

Thank you for your interest in Build Profit Solutions! We're excited to help bring your \{\{project.type\}\} project to life.

Our team of experienced contractors specializes in \{\{project.type\}\} projects and has successfully completed over 500 similar projects in the \{\{location.state\}\} area.

What happens next:
1. Our project coordinator will contact you within 24 hours
2. We'll schedule a free consultation at your convenience
3. You'll receive a detailed proposal within 48 hours

In the meantime, feel free to browse our portfolio of completed projects on our website.

Best regards,
The Build Profit Solutions Team

P.S. Have questions? Reply to this email or call us at (555) 123-4567.`,
    variables: ['contact.name', 'project.type', 'location.state'],
    category: 'welcome'
  },
  
  {
    id: 'follow_up_no_response',
    name: 'Follow-up No Response',
    subject: 'Quick Question About Your \{\{project.type\}\} Project',
    body: `Hi \{\{contact.name\}\},

I hope this email finds you well. I wanted to follow up on your \{\{project.type\}\} project inquiry.

I understand you might be busy, but I wanted to make sure you received my previous message about our services.

Quick question: Are you still considering a \{\{project.type\}\} project? If so, I'd love to schedule a brief 15-minute call to discuss your needs and answer any questions you might have.

No pressure at all - just want to make sure you have all the information you need to make the best decision for your project.

Best regards,
\{\{contractor.name\}\}
Build Profit Solutions

P.S. If you're no longer interested, just let me know and I'll remove you from our follow-up list.`,
    variables: ['contact.name', 'project.type', 'contractor.name'],
    category: 'follow_up'
  },
  
  {
    id: 'proposal_reminder',
    name: 'Proposal Reminder',
    subject: 'Your \{\{project.type\}\} Proposal is Ready!',
    body: `Hi \{\{contact.name\}\},

Great news! Your detailed \{\{project.type\}\} proposal is ready for review.

Based on your requirements and budget range of $\{\{project.budgetMin\}\} - $\{\{project.budgetMax\}\}, I've prepared a comprehensive proposal that includes:

• Detailed project scope and timeline
• Material specifications and options
• Transparent pricing breakdown
• Payment schedule options
• Warranty information

I'd love to schedule a call to walk through the proposal and answer any questions you might have.

When would be a good time for a 30-minute call this week?

Best regards,
\{\{contractor.name\}\}
Build Profit Solutions`,
    variables: ['contact.name', 'project.type', 'project.budgetMin', 'project.budgetMax', 'contractor.name'],
    category: 'proposal'
  },
  
  {
    id: 'weekly_nurture',
    name: 'Weekly Nurture',
    subject: '\{\{project.type\}\} Tips: This Week\'s Expert Advice',
    body: `Hi \{\{contact.name\}\},

I hope you're having a great week! I wanted to share some valuable tips about \{\{project.type\}\} projects that might be helpful as you plan your project.

This week's topic: "5 Essential Questions to Ask Your Contractor"

1. What's your experience with \{\{project.type\}\} projects?
2. Can you provide references from similar projects?
3. What's included in your warranty?
4. How do you handle project timeline changes?
5. What's your payment schedule?

As always, I'm here to answer any questions you might have about your \{\{project.type\}\} project.

Best regards,
\{\{contractor.name\}\}
Build Profit Solutions`,
    variables: ['contact.name', 'project.type', 'contractor.name'],
    category: 'nurture'
  }
];

/**
 * Execute automation rules for a lead
 */
export function executeAutomation(lead: Lead, triggerType: string, context?: Record<string, any>): void {
  const activeRules = defaultAutomationRules.filter(rule => rule.isActive);
  
  for (const rule of activeRules) {
    if (shouldTriggerRule(rule, lead, triggerType, context)) {
      executeRule(rule, lead, context);
    }
  }
}

function shouldTriggerRule(
  rule: AutomationRule, 
  lead: Lead, 
  triggerType: string, 
  context?: Record<string, any>
): boolean {
  // Check if trigger type matches
  if (rule.trigger.type !== triggerType) return false;
  
  // Check conditions
  for (const condition of rule.conditions) {
    if (!evaluateCondition(condition, lead)) {
      return false;
    }
  }
  
  // Check trigger-specific conditions
  if (rule.trigger.type === 'score_changed') {
    const oldScore = context?.oldScore || 0;
    const newScore = lead.aiScore || 0;
    return newScore !== oldScore;
  }
  
  if (rule.trigger.type === 'no_response') {
    const lastContact = context?.lastContact;
    if (!lastContact) return false;
    
    const hoursSinceContact = (Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60);
    return hoursSinceContact >= rule.trigger.config.timeLimit;
  }
  
  return true;
}

function evaluateCondition(condition: AutomationCondition, lead: Lead): boolean {
  let value: any;
  
  // Get value from lead object
  switch (condition.field) {
    case 'source':
      value = lead.source;
      break;
    case 'stage':
      value = lead.stage;
      break;
    case 'aiScore':
      value = lead.aiScore || 0;
      break;
    case 'projectType':
      value = lead.project.type;
      break;
    case 'budget':
      value = (lead.project.budgetMin || 0 + lead.project.budgetMax || 0) / 2;
      break;
    default:
      value = (lead as any)[condition.field];
  }
  
  // Evaluate condition
  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'not_equals':
      return value !== condition.value;
    case 'greater_than':
      return Number(value) > Number(condition.value);
    case 'less_than':
      return Number(value) < Number(condition.value);
    case 'contains':
      return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
    default:
      return false;
  }
}

function executeRule(rule: AutomationRule, lead: Lead, context?: Record<string, any>): void {
  console.log(`🤖 Executing automation rule: ${rule.name} for lead: ${lead.contact.name}`);
  
  // Update trigger count
  rule.triggerCount++;
  rule.lastTriggered = new Date();
  
  // Execute actions with delays
  for (const action of rule.actions) {
    if (action.delay) {
      setTimeout(() => {
        executeAction(action, lead, context);
      }, action.delay * 60 * 1000); // Convert minutes to milliseconds
    } else {
      executeAction(action, lead, context);
    }
  }
}

function executeAction(action: AutomationAction, lead: Lead, context?: Record<string, any>): void {
  console.log(`🎯 Executing action: ${action.type} for lead: ${lead.contact.name}`);
  
  switch (action.type) {
    case 'send_email':
      sendEmail(action.config, lead);
      break;
    case 'send_sms':
      sendSMS(action.config, lead);
      break;
    case 'assign_contractor':
      assignContractor(action.config, lead);
      break;
    case 'update_stage':
      updateStage(action.config, lead);
      break;
    case 'add_tag':
      addTag(action.config, lead);
      break;
    case 'create_task':
      createTask(action.config, lead);
      break;
    case 'send_notification':
      sendNotification(action.config, lead);
      break;
  }
}

// Action implementations (these would integrate with actual services)
function sendEmail(config: Record<string, any>, lead: Lead): void {
  console.log(`📧 Sending email to ${lead.contact.email} with template: ${config.template}`);
  // Integration with email service (SendGrid, Mailgun, etc.)
}

function sendSMS(config: Record<string, any>, lead: Lead): void {
  console.log(`📱 Sending SMS to ${lead.contact.phone}`);
  // Integration with SMS service (Twilio, etc.)
}

function assignContractor(config: Record<string, any>, lead: Lead): void {
  console.log(`👷 Assigning contractor to lead: ${lead.contact.name}`);
  // Update lead with assigned contractor
}

function updateStage(config: Record<string, any>, lead: Lead): void {
  console.log(`🔄 Updating lead stage to: ${config.stage}`);
  // Update lead stage
}

function addTag(config: Record<string, any>, lead: Lead): void {
  console.log(`🏷️ Adding tag: ${config.tag} to lead: ${lead.contact.name}`);
  // Add tag to lead
}

function createTask(config: Record<string, any>, lead: Lead): void {
  console.log(`📋 Creating task: ${config.title} for lead: ${lead.contact.name}`);
  // Create task in task management system
}

function sendNotification(config: Record<string, any>, lead: Lead): void {
  console.log(`🔔 Sending notification: ${config.message}`);
  // Send push notification or in-app notification
}
