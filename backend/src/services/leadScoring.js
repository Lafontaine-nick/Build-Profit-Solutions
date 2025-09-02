const OpenAI = require('openai');

class LeadScoringService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async scoreLead(leadData) {
    try {
      const prompt = this.buildScoringPrompt(leadData);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert lead scoring system for a construction company. 
            Analyze the lead information and provide a comprehensive score from 0-100 along with detailed reasoning.
            
            Scoring Criteria:
            - Budget size and range (0-25 points)
            - Project timeline and urgency (0-20 points)
            - Project type and complexity (0-15 points)
            - Location and market (0-15 points)
            - Requirements clarity and completeness (0-15 points)
            - Lead source quality (0-10 points)
            
            Return a JSON response with:
            {
              "score": number (0-100),
              "reasoning": "detailed explanation",
              "priority": "low|medium|high",
              "factors": {
                "budget": number (0-25),
                "timeline": number (0-20),
                "projectSize": number (0-15),
                "location": number (0-15),
                "requirements": number (0-15),
                "source": number (0-10)
              },
              "recommendations": ["action item 1", "action item 2"]
            }`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0].message.content;
      const result = JSON.parse(content);
      
      return {
        score: Math.round(result.score),
        reasoning: result.reasoning,
        priority: result.priority,
        factors: result.factors,
        recommendations: result.recommendations || []
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      const openaiError = new Error('Failed to score lead with AI');
      openaiError.name = 'OpenAIError';
      throw openaiError;
    }
  }

  buildScoringPrompt(leadData) {
    const {
      name,
      email,
      company,
      projectType,
      projectSize,
      budget,
      timeline,
      location,
      requirements,
      source
    } = leadData;

    return `
    Please score this construction lead:

    CONTACT INFORMATION:
    - Name: ${name || 'Not provided'}
    - Email: ${email || 'Not provided'}
    - Company: ${company || 'Not provided'}

    PROJECT DETAILS:
    - Project Type: ${projectType || 'Not specified'}
    - Project Size: ${projectSize || 'Not specified'}
    - Budget Range: $${budget?.min?.toLocaleString() || '0'} - $${budget?.max?.toLocaleString() || '0'} ${budget?.currency || 'USD'}
    - Timeline: ${timeline?.startDate || 'Not specified'} (${timeline?.duration || '0'} weeks)
    - Urgency: ${timeline?.urgency || 'Not specified'}

    LOCATION:
    - City: ${location?.city || 'Not specified'}
    - State: ${location?.state || 'Not specified'}
    - ZIP: ${location?.zipCode || 'Not specified'}

    REQUIREMENTS:
    ${requirements || 'Not provided'}

    LEAD SOURCE:
    - Source: ${source || 'Not specified'}

    Please provide a comprehensive analysis and score this lead from 0-100, considering all factors that would make this a good or bad lead for a construction company.
    `;
  }

  async getLeadInsights(leadData) {
    try {
      const prompt = `
        Analyze this construction lead and provide strategic insights:
        
        Lead Data: ${JSON.stringify(leadData, null, 2)}
        
        Provide insights on:
        1. Market opportunity assessment
        2. Competitive positioning
        3. Risk factors
        4. Recommended approach
        5. Follow-up strategy
        
        Return as JSON with these fields:
        {
          "marketOpportunity": "assessment",
          "competitivePosition": "analysis",
          "riskFactors": ["risk1", "risk2"],
          "recommendedApproach": "strategy",
          "followUpStrategy": "timeline and actions"
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a construction business strategist providing insights on lead opportunities."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 800
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error getting lead insights:', error);
      throw new Error('Failed to generate lead insights');
    }
  }

  async generateFollowUpMessage(leadData, followUpType) {
    try {
      const prompt = `
        Generate a professional follow-up message for this construction lead:
        
        Lead: ${JSON.stringify(leadData, null, 2)}
        Follow-up Type: ${followUpType}
        
        Create a personalized message that:
        1. References their specific project
        2. Shows understanding of their needs
        3. Provides value
        4. Has a clear call-to-action
        
        Return as JSON:
        {
          "subject": "email subject line",
          "message": "full message content",
          "nextSteps": "recommended next actions"
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a professional construction sales representative crafting personalized follow-up messages."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.6,
        max_tokens: 600
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error generating follow-up message:', error);
      throw new Error('Failed to generate follow-up message');
    }
  }

  async prioritizeLeads(leads) {
    try {
      const prompt = `
        Prioritize these construction leads based on potential value and urgency:
        
        Leads: ${JSON.stringify(leads, null, 2)}
        
        Return prioritized list as JSON:
        {
          "prioritizedLeads": [
            {
              "id": "lead_id",
              "priority": "high|medium|low",
              "reasoning": "why this priority",
              "recommendedAction": "next step"
            }
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a construction sales manager prioritizing leads for maximum business impact."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error prioritizing leads:', error);
      throw new Error('Failed to prioritize leads');
    }
  }
}

module.exports = new LeadScoringService(); 