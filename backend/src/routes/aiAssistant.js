const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

// Initialize OpenAI client
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const hasValidOpenAiKey = openaiApiKey && 
  !openaiApiKey.includes('YOUR_OPE') && 
  !openaiApiKey.includes('YOUR_OPENAI') &&
  !openaiApiKey.includes('your_openai') &&
  !openaiApiKey.includes('your_openai_api_key') &&
  openaiApiKey.length > 20;

const openai = hasValidOpenAiKey
  ? new OpenAI({ apiKey: openaiApiKey })
  : null;

/**
 * POST /api/ai-assistant
 * Chat endpoint for AI Assistant in mobile app
 */
router.post('/', async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured',
        details: 'Please configure OPENAI_API_KEY in your backend .env file',
      });
    }

    const { message, context, history = [], user_settings = {} } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Message is required and must be a string',
      });
    }

    // Parse context if it's a string
    let parsedContext = {};
    if (context) {
      try {
        parsedContext = typeof context === 'string' ? JSON.parse(context) : context;
      } catch (e) {
        console.warn('Failed to parse context:', e);
      }
    }

    // Build system prompt based on context and settings
    const aiPmMode = user_settings.ai_project_manager_mode || false;
    
    // Extract project context
    const projectName = parsedContext.currentProject || parsedContext.projectName || parsedContext.bidTitle;
    const projectId = parsedContext.projectId;
    const bidTotal = parsedContext.bidTotal || parsedContext.total || 0;
    const estimatedCost = parsedContext.estimatedCost || 0;
    const actualCost = parsedContext.actualCost || 0;
    const margin = parsedContext.margin || 0;
    const markup = parsedContext.markup || 0;
    const overhead = parsedContext.overheadPct || 12;
    const status = parsedContext.status;
    const progress = parsedContext.progress || 0;
    const location = parsedContext.location;
    const activeTab = parsedContext.activeTab;
    
    let systemPrompt = `You are an AI assistant for Build Profit Solutions, a construction project management app. 
You help contractors manage projects, budgets, timelines, and profitability.

${aiPmMode ? `**AI PROJECT MANAGER MODE: ENABLED**

You are acting as a proactive project manager, not just a reactive assistant. Your role includes:

1. **Monitoring & Analysis**
   - Monitor costs, schedule, and profit margins
   - Flag risks before they become problems
   - Identify missing costs and schedule gaps
   - Track cash flow and payment milestones

2. **Proactive Suggestions**
   - When opening the assistant, start with a project health summary (not just "How can I help?")
   - Suggest next steps based on project status
   - Recommend actions to protect margins and keep schedules on track
   - Flag when margin drops below thresholds (e.g., <25%)

3. **Response Structure**
   - For health checks, use a structured format:
     * **Status**: Overall project health (Green/Yellow/Red)
     * **Costs**: Budget vs actual, margin status
     * **Schedule**: Milestone progress, payment status
     * **Risks**: Key concerns to watch
     * **Next Steps**: Recommended actions
   - Be concise but actionable
   - Use bullet points for clarity
   - Include specific numbers and percentages

4. **Priority Areas**
   - Protect profit margin (monitor actual vs estimated costs)
   - Keep schedule on track (watch milestones and payments)
   - Avoid surprises (scan for missing costs, risky items)
   - Generate proactive suggestions (contingency, progress invoices, material price updates)

When the user opens the assistant with PM mode enabled, provide a brief health summary immediately.` : ''}

${projectName ? `**CURRENT PROJECT CONTEXT**: You are currently viewing "${projectName}". All questions from the user are about THIS project unless they explicitly mention another project name. You do NOT need to ask which project - assume it's "${projectName}".` : ''}

**Project Details:**
${projectId ? `- Project ID: ${projectId}` : ''}
${status ? `- Status: ${status}` : ''}
${location ? `- Location: ${location}` : ''}
${bidTotal > 0 ? `- Bid Total: $${bidTotal.toLocaleString()}` : ''}
${estimatedCost > 0 ? `- Estimated Cost: $${estimatedCost.toLocaleString()}` : ''}
${actualCost > 0 ? `- Actual Cost: $${actualCost.toLocaleString()}` : ''}
${margin > 0 ? `- Margin: ${margin}%` : ''}
${markup > 0 ? `- Markup: ${markup}%` : ''}
${overhead ? `- Overhead: ${overhead}%` : ''}
${progress > 0 ? `- Progress: ${progress}%` : ''}
${activeTab ? `- Current Tab: ${activeTab}` : ''}

Keep responses helpful, concise, and contractor-friendly. When answering questions, assume they're about "${projectName || 'the current project'}" unless the user explicitly mentions another project.`;

    // Build messages array from history + new message
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.filter(m => m.role && m.content),
      { role: 'user', content: message },
    ];

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const reply = completion.choices[0].message.content || 'Sorry, I could not generate a response.';

    // Return response in format expected by mobile app
    return res.json({
      reply,
      // Optional: actions array if you want to support structured actions
      // actions: []
    });

  } catch (err) {
    console.error('Error in /api/ai-assistant:', err);

    // Handle OpenAI-specific errors
    if (err.response) {
      const statusCode = err.response.status;
      const errorMessage = err.response.data?.error?.message || err.message;

      if (statusCode === 429) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'OpenAI API rate limit exceeded. Please wait a moment and try again.',
          details: errorMessage,
        });
      }

      if (statusCode === 401 || statusCode === 403) {
        return res.status(503).json({
          error: 'AI service unavailable',
          message: 'OpenAI API authentication failed',
          details: 'Please check your OPENAI_API_KEY configuration',
        });
      }
    }

    return res.status(500).json({
      error: 'Failed to generate AI response',
      message: err.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

module.exports = router;



