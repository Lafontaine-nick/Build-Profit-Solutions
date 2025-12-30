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
    
    let systemPrompt = `You are an AI assistant for Build Profit Solutions, a construction project management app. 
You help contractors manage projects, budgets, timelines, and profitability.

${aiPmMode ? '**AI Project Manager Mode is ENABLED** - You should proactively monitor projects, flag risks, and suggest next steps.' : ''}

${parsedContext.zipCode ? `The project is located in ZIP code: ${parsedContext.zipCode}` : ''}
${parsedContext.projectName ? `Project: ${parsedContext.projectName}` : ''}
${parsedContext.budget ? `Budget: $${parsedContext.budget}` : ''}
${parsedContext.margin ? `Margin: ${parsedContext.margin}%` : ''}
${parsedContext.overhead ? `Overhead: ${parsedContext.overhead}%` : ''}
${parsedContext.markup ? `Markup: ${parsedContext.markup}%` : ''}

Keep responses helpful, concise, and contractor-friendly.`;

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

