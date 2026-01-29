import { Lead } from './leadService';

export interface QuoteTemplate {
  id: string;
  name: string;
  category: 'welcome' | 'proposal' | 'follow-up' | 'closing';
  subject: string;
  body: string;
  variables: string[];
}

export interface GeneratedQuote {
  subject: string;
  body: string;
  personalizedGreeting: string;
  projectSummary: string;
  pricingBreakdown: string;
  timeline: string;
  valuePropositions: string[];
  callToAction: string;
  signature: string;
  estimatedResponse: number;
  confidence: number;
}

export class QuoteGeneratorService {
  private templates: QuoteTemplate[] = [
    {
      id: 'welcome-1',
      name: 'Welcome Email',
      category: 'welcome',
      subject: 'Welcome to [Company] - Your [Project Type] Project',
      body: `Dear [Name],

Thank you for reaching out to [Company] about your [Project Type] project. We're excited to help bring your vision to life!

**About Your Project:**
[Project Summary]

**Next Steps:**
1. Schedule a consultation call
2. Discuss your requirements in detail
3. Provide a customized proposal
4. Answer any questions you may have

**Why Choose [Company]:**
- [X] years of experience in [Project Type]
- Licensed, bonded, and insured
- [X] satisfied customers
- [X]-year warranty on all work
- Free consultation and 3D renderings

I'd love to schedule a call this week to discuss your project in detail. What time works best for you?

Best regards,
[Your Name]
[Company Name]
[Phone Number]`,
      variables: ['Name', 'Company', 'Project Type', 'Project Summary', 'X'],
    },
    {
      id: 'proposal-1',
      name: 'Detailed Proposal',
      category: 'proposal',
      subject: '[Company] Proposal - [Project Type] for [Name]',
      body: `Dear [Name],

Thank you for considering [Company] for your [Project Type] project. I've prepared a detailed proposal based on our discussion.

**Project Summary:**
[Project Summary]

**Investment: [Budget Range]**
This includes:
- [Material 1]
- [Material 2]
- [Material 3]
- Labor and installation
- Permits and inspections
- [X]-year warranty

**Timeline: [Timeline]**
- Start date: [Start Date]
- Completion: [End Date]
- Key milestones: [Milestones]

**Why [Company] is the Right Choice:**
- [X] years of local experience
- Licensed, bonded, and insured
- [X]% customer satisfaction rate
- [X]-year warranty on all work
- Free consultation and 3D renderings
- Financing options available

**Next Steps:**
1. Review this proposal
2. Schedule a consultation to discuss details
3. Sign contract and pay deposit
4. Begin project planning

I'm available this week for a detailed discussion. What questions do you have?

Best regards,
[Your Name]
[Company Name]
[Phone Number]`,
      variables: [
        'Name',
        'Company',
        'Project Type',
        'Project Summary',
        'Budget Range',
        'Material 1',
        'Material 2',
        'Material 3',
        'X',
        'Timeline',
        'Start Date',
        'End Date',
        'Milestones',
      ],
    },
    {
      id: 'follow-up-1',
      name: 'Follow-up Email',
      category: 'follow-up',
      subject: 'Following up on your [Project Type] project',
      body: `Hi [Name],

I wanted to follow up on your [Project Type] project. Have you had a chance to review our proposal?

**Quick Reminder:**
- Project: [Project Summary]
- Investment: [Budget Range]
- Timeline: [Timeline]

**Special Offer:**
If you decide to move forward this week, I can offer [Discount] off the total project cost.

**Questions?**
I'm happy to:
- Schedule another consultation
- Provide additional references
- Show you similar projects we've completed
- Discuss financing options

What would work best for you?

Best regards,
[Your Name]
[Company Name]
[Phone Number]`,
      variables: [
        'Name',
        'Project Type',
        'Project Summary',
        'Budget Range',
        'Timeline',
        'Discount',
      ],
    },
    {
      id: 'closing-1',
      name: 'Closing Email',
      category: 'closing',
      subject: 'Ready to start your [Project Type] project?',
      body: `Dear [Name],

I'm excited to help you get started on your [Project Type] project! 

**Project Details:**
- Project: [Project Summary]
- Investment: [Budget Range]
- Timeline: [Timeline]

**What Happens Next:**
1. Sign the contract
2. Pay the deposit ([Deposit Amount])
3. Schedule the start date
4. Begin material ordering
5. Start project work

**Why Choose [Company]:**
- [X] years of experience
- Licensed, bonded, and insured
- [X]-year warranty
- Financing available
- Free consultation

I'm available to sign the contract this week. What day works best for you?

Best regards,
[Your Name]
[Company Name]
[Phone Number]`,
      variables: [
        'Name',
        'Project Type',
        'Project Summary',
        'Budget Range',
        'Timeline',
        'Deposit Amount',
        'X',
      ],
    },
  ];

  async generateQuote(
    lead: Lead,
    templateId?: string
  ): Promise<GeneratedQuote> {
    try {
      // Mock GPT API call - in real app, this would call OpenAI API
      const template = templateId
        ? this.templates.find(t => t.id === templateId)
        : this.selectBestTemplate(lead);

      if (!template) {
        throw new Error('No suitable template found');
      }

      const personalizedQuote = this.personalizeTemplate(template, lead);
      const confidence = this.calculateConfidence(lead);
      const estimatedResponse = this.estimateResponseRate(lead);

      return {
        ...personalizedQuote,
        estimatedResponse,
        confidence,
      };
    } catch (error) {
      console.error('Error generating quote:', error);
      throw error;
    }
  }

  private selectBestTemplate(lead: Lead): QuoteTemplate {
    const status = lead.status || 'new';
    const budget = lead.budget?.max || 0;
    const aiScore = lead.aiScore || 50;

    // Select template based on lead status and characteristics
    if (status === 'new') {
      return (
        this.templates.find(t => t.id === 'welcome-1') || this.templates[0]
      );
    } else if (status === 'contacted' || status === 'qualified') {
      return (
        this.templates.find(t => t.id === 'proposal-1') || this.templates[1]
      );
    } else if (status === 'proposal-sent') {
      return (
        this.templates.find(t => t.id === 'follow-up-1') || this.templates[2]
      );
    } else {
      return (
        this.templates.find(t => t.id === 'closing-1') || this.templates[3]
      );
    }
  }

  private personalizeTemplate(
    template: QuoteTemplate,
    lead: Lead
  ): Omit<GeneratedQuote, 'estimatedResponse' | 'confidence'> {
    const projectType = this.getProjectType(lead.projectType);
    const budgetRange = this.formatBudget(lead.budget);
    const timeline = this.getTimeline(lead.timeline ? {
      urgency: lead.timeline.urgency,
      description: lead.timeline.description || 'Project timeline'
    } : undefined);
    const projectSummary = this.generateProjectSummary(lead);
    const valuePropositions = this.generateValuePropositions(lead);

    const personalizedBody = template.body
      .replace(/\[Name\]/g, lead.name || 'there')
      .replace(/\[Company\]/g, 'Build Profit Solutions')
      .replace(/\[Project Type\]/g, projectType)
      .replace(/\[Project Summary\]/g, projectSummary)
      .replace(/\[Budget Range\]/g, budgetRange)
      .replace(/\[Timeline\]/g, timeline)
      .replace(/\[X\]/g, '15')
      .replace(/\[Material 1\]/g, 'Premium materials')
      .replace(/\[Material 2\]/g, 'Professional installation')
      .replace(/\[Material 3\]/g, 'Quality finishes')
      .replace(/\[Start Date\]/g, 'Within 2 weeks')
      .replace(/\[End Date\]/g, '6-8 weeks from start')
      .replace(
        /\[Milestones\]/g,
        'Planning, Materials, Installation, Final Inspection'
      )
      .replace(/\[Discount\]/g, '5%')
      .replace(/\[Deposit Amount\]/g, '25% of total');

    const personalizedSubject = template.subject
      .replace(/\[Name\]/g, lead.name || 'you')
      .replace(/\[Company\]/g, 'Build Profit Solutions')
      .replace(/\[Project Type\]/g, projectType);

    return {
      subject: personalizedSubject,
      body: personalizedBody,
      personalizedGreeting: `Dear ${lead.name || 'there'},`,
      projectSummary,
      pricingBreakdown: budgetRange,
      timeline,
      valuePropositions,
      callToAction: 'Schedule a consultation this week',
      signature:
        'Best regards,\n[Your Name]\nBuild Profit Solutions\n[Phone Number]',
    };
  }

  private getProjectType(projectType?: string): string {
    switch (projectType) {
      case 'residential':
        return 'residential renovation';
      case 'commercial':
        return 'commercial construction';
      case 'renovation':
        return 'renovation project';
      case 'new-build':
        return 'new construction';
      case 'maintenance':
        return 'maintenance project';
      default:
        return 'construction project';
    }
  }

  private formatBudget(budget?: {
    min: number;
    max: number;
    currency: string;
  }): string {
    if (!budget) return '$10,000 - $50,000';

    const formatAmount = (amount: number) => {
      if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(0)}K`;
      }
      return `$${amount.toLocaleString()}`;
    };

    return `${formatAmount(budget.min)} - ${formatAmount(budget.max)}`;
  }

  private getTimeline(timeline?: {
    urgency: string;
    description: string;
  }): string {
    if (!timeline) return '6-8 weeks';

    switch (timeline.urgency) {
      case 'high':
        return '2-4 weeks (urgent)';
      case 'medium':
        return '4-6 weeks';
      case 'low':
        return '6-8 weeks';
      default:
        return '6-8 weeks';
    }
  }

  private generateProjectSummary(lead: Lead): string {
    const projectType = this.getProjectType(lead.projectType);
    const requirements = lead.requirements || 'construction project';

    return `${projectType} including ${requirements.toLowerCase()}. This project will transform your space with premium materials and professional craftsmanship.`;
  }

  private generateValuePropositions(lead: Lead): string[] {
    const propositions = [
      '15+ years of local experience',
      'Licensed, bonded, and insured',
      '100+ satisfied customers',
      '2-year warranty on all work',
      'Free consultation and 3D renderings',
    ];

    // Add budget-specific propositions
    const budget = lead.budget?.max || 0;
    if (budget > 50000) {
      propositions.push('Premium materials and finishes');
      propositions.push('Dedicated project manager');
    } else if (budget > 25000) {
      propositions.push('Quality materials and workmanship');
      propositions.push('Detailed project timeline');
    } else {
      propositions.push('Competitive pricing');
      propositions.push('Flexible payment options');
    }

    return propositions;
  }

  private calculateConfidence(lead: Lead): number {
    let confidence = 70; // Base confidence

    // AI score impact
    const aiScore = lead.aiScore || 50;
    confidence += (aiScore - 50) * 0.3; // +/- 15%

    // Budget impact
    const budget = lead.budget?.max || 0;
    if (budget > 50000) confidence += 10;
    else if (budget > 25000) confidence += 5;
    else confidence -= 5;

    // Status impact
    const status = lead.status;
    if (status === 'qualified') confidence += 15;
    else if (status === 'contacted') confidence += 10;
    else if (status === 'new') confidence += 5;

    return Math.max(50, Math.min(95, confidence));
  }

  private estimateResponseRate(lead: Lead): number {
    let responseRate = 0.3; // Base 30%

    // AI score impact
    const aiScore = lead.aiScore || 50;
    responseRate += (aiScore - 50) * 0.002; // +/- 10%

    // Budget impact
    const budget = lead.budget?.max || 0;
    if (budget > 50000)
      responseRate += 0.15; // +15% for high-value
    else if (budget > 25000)
      responseRate += 0.1; // +10% for medium-value
    else responseRate += 0.05; // +5% for low-value

    // Timeline impact
    const urgency = lead.timeline?.urgency || 'medium';
    if (urgency === 'high')
      responseRate += 0.2; // +20% for urgent
    else if (urgency === 'medium')
      responseRate += 0.1; // +10% for medium
    else responseRate += 0.05; // +5% for low

    return Math.max(0.1, Math.min(0.9, responseRate));
  }

  async getTemplates(category?: string): Promise<QuoteTemplate[]> {
    if (category) {
      return this.templates.filter(t => t.category === category);
    }
    return this.templates;
  }

  async createCustomTemplate(
    template: Omit<QuoteTemplate, 'id'>
  ): Promise<QuoteTemplate> {
    const newTemplate: QuoteTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
    };

    this.templates.push(newTemplate);
    return newTemplate;
  }
}

export const quoteGeneratorService = new QuoteGeneratorService();
