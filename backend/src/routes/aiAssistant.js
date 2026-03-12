const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');
const { buildSystemPrompt, buildRouterPrompt } = require('./promptSystem');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MEMORY — lightweight server-side session state
// Extracts key facts from conversation and persists across messages
// ─────────────────────────────────────────────────────────────────────────────
const conversationSessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getOrCreateSession(sessionId) {
  if (!sessionId) return null;
  let session = conversationSessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      facts: [],
      lastTopics: [],
      projectsDiscussed: [],
      userPreferences: {},
    };
    conversationSessions.set(sessionId, session);
  }
  session.lastActiveAt = Date.now();
  return session;
}

function extractConversationFacts(message, aiReply, session) {
  if (!session) return;
  const msgLower = (message || '').toLowerCase();

  const projectMentions = [];
  const projectPatterns = /(?:on|about|for|review|check|how(?:'s| is))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  let match;
  while ((match = projectPatterns.exec(message)) !== null) {
    const name = match[1].trim();
    if (name.length > 2 && !['The', 'This', 'That', 'What', 'Which', 'How', 'Where', 'When'].includes(name)) {
      projectMentions.push(name);
    }
  }
  if (projectMentions.length > 0) {
    projectMentions.forEach(p => {
      if (!session.projectsDiscussed.includes(p)) session.projectsDiscussed.push(p);
    });
    session.projectsDiscussed = session.projectsDiscussed.slice(-5);
  }

  const topics = [];
  if (/margin|profit|money|revenue|earning/i.test(msgLower)) topics.push('profitability');
  if (/budget|cost|spend|expense|over budget/i.test(msgLower)) topics.push('costs');
  if (/risk|danger|worry|concern|problem/i.test(msgLower)) topics.push('risks');
  if (/schedule|timeline|deadline|overdue|behind/i.test(msgLower)) topics.push('schedule');
  if (/receipt|missing.*receipt/i.test(msgLower)) topics.push('receipts');
  if (/compare|versus|vs/i.test(msgLower)) topics.push('comparison');
  if (/forecast|project|predict|trending/i.test(msgLower)) topics.push('forecasting');
  if (topics.length > 0) session.lastTopics = topics.slice(-3);

  if (session.facts.length > 20) session.facts = session.facts.slice(-15);
}

function buildMemoryContext(session) {
  if (!session || (!session.projectsDiscussed.length && !session.lastTopics.length)) return '';
  let ctx = '\n\nCONVERSATION MEMORY:';
  if (session.projectsDiscussed.length > 0) {
    ctx += `\n→ Projects discussed this session: ${session.projectsDiscussed.join(', ')}`;
  }
  if (session.lastTopics.length > 0) {
    ctx += `\n→ Recent topics: ${session.lastTopics.join(', ')}`;
  }
  ctx += '\n→ Use this context to maintain continuity — if user says "that one" or "tell me more", they likely mean the project or topic above.';
  return ctx;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of conversationSessions) {
    if (now - session.lastActiveAt > SESSION_TTL_MS) conversationSessions.delete(id);
  }
}, 5 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// SMART SUGGESTIONS — generate contextual follow-ups after every response
// ─────────────────────────────────────────────────────────────────────────────
function generateSmartSuggestions(message, reply, parsedContext, session) {
  const suggestions = [];
  const msgLower = (message || '').toLowerCase();
  const replyLower = (reply || '').toLowerCase();
  const allProjects = Array.isArray(parsedContext?.allProjects) ? parsedContext.allProjects : [];
  const projectNames = allProjects.map(p => p?.title || p?.name || '').filter(Boolean);

  const mentionedProject = projectNames.find(name =>
    replyLower.includes(name.toLowerCase()) || msgLower.includes(name.toLowerCase())
  );

  if (replyLower.includes('margin') || replyLower.includes('profit')) {
    if (mentionedProject) {
      suggestions.push({ label: `Forecast ${mentionedProject} profit`, prompt: `Forecast the final profit for ${mentionedProject} based on current spending` });
    }
    suggestions.push({ label: 'Compare all margins', prompt: 'Compare margins across all my projects' });
  }

  if (replyLower.includes('over budget') || replyLower.includes('overrun') || replyLower.includes('above estimate')) {
    if (mentionedProject) {
      suggestions.push({ label: `Break down ${mentionedProject} expenses`, prompt: `Show me an expense breakdown for ${mentionedProject} by category and vendor` });
    }
    suggestions.push({ label: 'Check all budget risks', prompt: 'Which projects have budget risks?' });
  }

  if (replyLower.includes('receipt') || replyLower.includes('missing')) {
    suggestions.push({ label: 'Show all missing receipts', prompt: 'List all expenses missing receipts across my projects' });
  }

  if (replyLower.includes('overdue') || replyLower.includes('payment')) {
    suggestions.push({ label: 'Show all overdue payments', prompt: 'What payments are overdue across all my projects?' });
  }

  if (mentionedProject && !msgLower.includes('health') && !msgLower.includes('check')) {
    suggestions.push({ label: `Full health check: ${mentionedProject}`, prompt: `Give me a full health check on ${mentionedProject}` });
  }

  if (replyLower.includes('compare') || msgLower.includes('compare')) {
    if (projectNames.length >= 2) {
      suggestions.push({ label: 'Rank by risk', prompt: 'Rank my projects by risk — which needs the most attention?' });
    }
  }

  if (suggestions.length < 2 && mentionedProject) {
    suggestions.push({ label: `Review ${mentionedProject} costs`, prompt: `Break down all costs on ${mentionedProject}` });
  }

  if (suggestions.length < 3 && allProjects.length > 1) {
    suggestions.push({ label: 'Portfolio overview', prompt: 'Give me a quick portfolio overview with key numbers' });
  }

  return suggestions.slice(0, 4);
}

// Sum line items (materialLineItems, laborLineItems) for budget fallback when materialTotal/laborTotal missing
const sumLineItems = (items, normalize) => {
  const n = (v) => (normalize ? normalize(v) : (v == null ? 0 : Number(v) || 0));
  return (Array.isArray(items) ? items : []).reduce(
    (s, i) => s + n(i?.total ?? i?.amount ?? i?.cost ?? i?.price ?? i?.budget ?? 0),
    0
  );
};

// Match Budget tab: derive category spend from expense categories first.
const sumExpensesByCategory = (expenses, kind, normalize) => {
  const n = (v) => (normalize ? normalize(v) : (v == null ? 0 : Number(v) || 0));
  return (Array.isArray(expenses) ? expenses : []).reduce((sum, e) => {
    const cat = String(e?.category || '').toLowerCase();
    if (kind === 'material') {
      if (!(cat.includes('material') || cat.includes('equipment'))) return sum;
    } else if (kind === 'labor') {
      if (!cat.includes('labor')) return sum;
    } else {
      return sum;
    }
    return sum + n(e?.amount ?? 0);
  }, 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1: ROUTER — determines intent and checks required fields before any tool call
// Returns structured JSON so we skip keyword heuristics entirely.
// ─────────────────────────────────────────────────────────────────────────────
async function runRouter(message, history, ctxSummary) {
  const routerSystem = buildRouterPrompt();

  try {
    // Keep more context so multi-turn PO flows don't lose earlier amount/vendor/category/date.
    const recentHistory = history.slice(-12).filter(m => ['user','assistant'].includes(m.role));
    
    // Add explicit daily log context to the router message if we're in a daily log flow
    let contextMessage = `Context: ${JSON.stringify(ctxSummary)}`;
    if (ctxSummary.inDailyLogFlow) {
      contextMessage += '\n\nCRITICAL: You are in a DAILY LOG flow. The assistant recently asked about daily log notes. The user\'s message is a daily log entry (noteText), NOT an expense. Set domain = "daily_log" and proposed_tool = "add_daily_log".';
    }
    
    // Check if assistant just asked for team member name — distinguish ADD vs MESSAGE flow
    const lastAssistantMessage = recentHistory.filter(m => m.role === 'assistant').pop()?.content || '';
    const askedForTeamMemberToAdd = /(?:name of the team member you'?d like to add|team member you'?d like to add|add.*team member.*name|team member.*like to add)/i.test(lastAssistantMessage);
    const askedForTeamMemberToMessage = /(?:Please provide the name of the team member|which team member.*message|name of the team member you would like|team member you would like to (?:message|text|contact)|what would you like to say to)/i.test(lastAssistantMessage);
    if (message.trim().length > 0 && message.trim().length < 50) {
      if (askedForTeamMemberToAdd) {
        // User provided name for ADD team member flow
        contextMessage += '\n\nCRITICAL: The assistant just asked for the name of the team member to ADD. The user\'s message is the new team member\'s name. Set domain = "team", proposed_tool = "add_team_member", and extract the name from the user message into tool_args_draft.name. Do NOT use message_team_member.';
      } else if (askedForTeamMemberToMessage) {
        // User provided name for MESSAGE flow
        contextMessage += '\n\nCRITICAL: The assistant just asked for a team member name to message. The user\'s message is likely a team member name. Set domain = "team", proposed_tool = "message_team_member", and extract the name from the user message.';
      }
    }
    // CRITICAL: For LABOR expenses, "general labor", "it's general labor", trade names ARE the vendor/sub/trade - do NOT ask again
    const askedForLaborVendor = /(?:who is the vendor|vendor for the (?:additional )?labor|vendor for.*labor costs?)/i.test(lastAssistantMessage);
    const looksLikeLaborTrade = /\b(general\s+labor|labor|it'?s\s+general\s+labor|it'?s\s+labor|framing|plumbing|electrical|drywall|tile|painting|concrete|roofing|hvac|carpentry|drywall\s+installation|tile\s+work)\b/i.test(message.trim());
    if (askedForLaborVendor && looksLikeLaborTrade) {
      contextMessage += '\n\nCRITICAL: The assistant asked for vendor for LABOR. The user\'s message ("' + message.trim() + '") IS the sub/trade. For labor, vendor = sub/trade. Use tool_args_draft.vendor = user\'s message (e.g. "General Labor") and tool_args_draft.notes = same. Do NOT ask for vendor again. Execute add_material_expense with category=Labor, vendor=user\'s trade, amount from prior context.';
    }
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: routerSystem },
        ...recentHistory,
        { role: 'user', content: `${contextMessage}\nUser message: "${message}"` }
      ],
      temperature: 0,
      max_tokens: 350,
      response_format: { type: 'json_object' }
    });
    const raw = completion.choices[0].message.content || '{}';
    return JSON.parse(raw);
  } catch (e) {
    console.warn('⚠️ Router stage failed, defaulting to auto:', e.message);
    return { domain: 'general', proposed_tool: null, required_fields_missing: [], clarification_question: null, confidence: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION LAYER — runs before ANY write tool executes
// Returns { valid: true } or { valid: false, reason, clarificationQuestion }
// ─────────────────────────────────────────────────────────────────────────────
function validateAction(toolName, args, context = {}) {
  const { projectId, allProjects = [], parsedContext = {} } = context;

  // ── Confirm project exists for all write tools ─────────────────────────────
  const writingTools = ['add_material_expense', 'add_labor_expense', 'add_purchase_order', 'mark_purchase_order_received', 'mark_timeline_item_complete', 'add_timeline_payment', 'mark_payment_collected', 'add_estimate_line_item', 'add_daily_log', 'create_change_order'];
  if (writingTools.includes(toolName)) {
    const targetId = args.projectId || projectId;
    if (!targetId) {
      return { valid: false, reason: 'no_project_id', clarificationQuestion: 'Which project should I record this for?' };
    }
    if (allProjects.length > 0 && !allProjects.find(p => p.id === targetId)) {
      return { valid: false, reason: 'project_not_found', clarificationQuestion: `I couldn't find a project with ID "${targetId}". Could you confirm the project name?` };
    }
  }

  // ── Validate positive amounts ──────────────────────────────────────────────
  if (['add_material_expense', 'add_labor_expense', 'add_purchase_order', 'add_timeline_payment', 'add_estimate_line_item'].includes(toolName)) {
    const amount = args.amount || args.unitCost || 0;
    if (!amount || Number(amount) <= 0 || isNaN(Number(amount))) {
      return { valid: false, reason: 'invalid_amount', clarificationQuestion: 'What is the dollar amount for this?' };
    }
    if (Number(amount) > 2000000) {
      return { valid: false, reason: 'amount_suspiciously_large', clarificationQuestion: `$${Number(amount).toLocaleString()} seems very large. Can you confirm that amount?` };
    }
  }

  // ── Prevent duplicate expenses (same amount + vendor in last 60s) ──────────
  if (toolName === 'add_material_expense') {
    const recentExpenses = parsedContext.expenses || [];
    const sixtySecondsAgo = Date.now() - 60000;
    const duplicate = recentExpenses.find(e => {
      const eTime = new Date(e.createdAt || e.date || 0).getTime();
      return Math.abs(Number(e.amount) - Number(args.amount)) < 0.01 &&
             (e.vendor || '').toLowerCase() === (args.vendor || '').toLowerCase() &&
             eTime > sixtySecondsAgo;
    });
    if (duplicate) {
      return { valid: false, reason: 'duplicate_expense', clarificationQuestion: `I just recorded $${Number(args.amount).toFixed(2)} from ${args.vendor || 'that vendor'} a moment ago. Do you want me to record it again?` };
    }
  }

  // ── Validate vendor name isn't a placeholder ───────────────────────────────
  if (toolName === 'add_purchase_order' || toolName === 'add_material_expense') {
    const vendor = (args.vendor || '').toLowerCase().trim();
    const placeholders = ['vendor', 'n/a', 'unknown', 'tbd', 'na', 'none', 'supplier', 'store'];
    if (placeholders.includes(vendor)) {
      return { valid: false, reason: 'placeholder_vendor', clarificationQuestion: `What's the name of the vendor or supplier you purchased from?` };
    }
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG — append every AI action to a JSONL file for replay & compliance
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const AUDIT_LOG_PATH = path.join(__dirname, '../../data/ai-audit-log.jsonl');
const TOOL_EXEC_TIMEOUT_MS = Number(process.env.AI_TOOL_TIMEOUT_MS || 12000);

function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function inferExpectedDeliveryFromUserMessages(userMessages = []) {
  const monthMap = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };

  // Helper to create date at noon local time to avoid timezone shifts when parsing ISO strings
  const createDateAtNoon = (year, month, day) => {
    const d = new Date(year, month, day, 12, 0, 0, 0);
    return d;
  };

  for (const msg of [...userMessages].reverse()) {
    const text = String(msg?.content || '').toLowerCase();
    if (!text) continue;

    if (/\btoday\b/.test(text)) {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      return toISODate(today);
    }
    if (/\btomorrow\b/.test(text)) {
      const dt = new Date();
      dt.setDate(dt.getDate() + 1);
      dt.setHours(12, 0, 0, 0);
      return toISODate(dt);
    }

    const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, '0')}-${String(Number(iso[3])).padStart(2, '0')}`;

    const mdY = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (mdY) {
      const now = new Date();
      let year = mdY[3] ? Number(mdY[3]) : now.getFullYear();
      if (year < 100) year += 2000;
      const parsed = createDateAtNoon(year, Number(mdY[1]) - 1, Number(mdY[2]));
      if (!isNaN(parsed.getTime())) return toISODate(parsed);
    }

    const monthDay = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?\b/);
    if (monthDay) {
      const now = new Date();
      const month = monthMap[monthDay[1]];
      const day = Number(monthDay[2]);
      let year = monthDay[3] ? Number(monthDay[3]) : now.getFullYear();
      let parsed = createDateAtNoon(year, month, day);
      if (!monthDay[3] && parsed < now) parsed = createDateAtNoon(year + 1, month, day);
      if (!isNaN(parsed.getTime())) return toISODate(parsed);
    }
  }
  return null;
}

function getPOFlowUserMessages(messages = []) {
  const poIntentRegex = /\b(purchase order|create.*\bpo\b|create.*purchase order|add.*purchase order|create.*order)\b/i;
  let startIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === 'user' && poIntentRegex.test(String(m?.content || ''))) {
      startIdx = i;
      break;
    }
  }
  const sliced = startIdx >= 0 ? messages.slice(startIdx) : messages.slice(-14);
  return sliced.filter((m) => m.role === 'user');
}

function inferPOFieldsFromUserMessages(userMessages = []) {
  const vendorPatterns = [
    /home depot/i, /lowe'?s/i, /menards/i, /ace/i, /sherwin/i, /walmart/i, /amazon/i,
  ];
  const categoryPatterns = [
    'tile','drywall','lumber','concrete','paint','electrical','plumbing','hardware',
    'roofing','insulation','flooring','cabinets','appliances','windows','doors',
    'siding','decking','fencing','landscaping','labor','materials','equipment'
  ];

  let amount = null;
  let vendor = null;
  let category = null;

  for (const msg of userMessages) {
    const raw = String(msg?.content || '');
    const text = raw.toLowerCase();
    if (!vendor) {
      const v = vendorPatterns.find((p) => p.test(text));
      if (v) vendor = raw.match(v)?.[0] || null;
    }
    if (!amount) {
      const num = text.match(/\b(\d+(?:\.\d+)?)\b/);
      if (num) amount = Number(num[1]);
    }
    if (!category) {
      const c = categoryPatterns.find((x) => new RegExp(`\\b${x}\\b`, 'i').test(text));
      if (c) category = c === 'materials' || c === 'equipment' ? 'Materials/Equipment' : (c[0].toUpperCase() + c.slice(1));
    }
  }

  const expectedDelivery = inferExpectedDeliveryFromUserMessages(userMessages);
  return { amount, vendor, category, expectedDelivery };
}

function getCOFlowUserMessages(messages = []) {
  const coIntentRegex = /\b(change\s+(?:the\s+)?order|changeorder|create.*change\s+(?:the\s+)?order|add.*change\s+(?:the\s+)?order|scope change|client wants to add|extra work)\b/i;
  let startIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === 'user' && coIntentRegex.test(String(m?.content || ''))) {
      startIdx = i;
      break;
    }
  }
  // Fallback: if assistant is already in a CO flow, keep collecting user replies
  // even when the user's wording is not an exact intent phrase.
  if (startIdx < 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role === 'assistant' && /\bchange\s+order\b/i.test(String(m?.content || ''))) {
        startIdx = i + 1;
        break;
      }
    }
  }
  // If we still don't have a start point, don't infer CO fields.
  if (startIdx < 0) {
    return [];
  }
  const sliced = messages.slice(startIdx);
  return sliced.filter((m) => m.role === 'user');
}

function inferCOFieldsFromUserMessages(userMessages = [], allMessages = []) {
  let description = null;
  let amount = null;
  let vendor = null;

  // Intent phrases that should NOT be treated as descriptions
  const intentPhrases = /^(create|add|make|i need|i want|give me|start)(\s+\w+)*\s+(change\s+(?:the\s+)?order|scope\s+change|extra\s+work)s?$/i;
  const isIntentOnly = (txt) => {
  const normalized = String(txt || '').trim().replace(/[.!?]+$/g, '');
  return intentPhrases.test(normalized) || /^change\s+(?:the\s+)?order$/i.test(normalized);
};

  // Known vendor/store names for recognition
  // Match common construction vendors (case-insensitive, flexible spacing)
  const knownVendors = /\b(home\s*depot|lowe'?s|menards|ace\s*hardware|84\s*lumber|abc\s*supply|floor\s*(?:&|and)\s*decor|sherwin[\s-]*williams|benjamin\s*moore|ferguson|hd\s*supply|build\.com|lumber\s*liquidators|tile\s*shop)\b/i;

  for (let i = 0; i < userMessages.length; i++) {
    const msg = userMessages[i];
    const raw = String(msg?.content || '').trim();
    if (!raw) continue;
    const text = raw.toLowerCase();

    // Skip pure intent commands
    if (isIntentOnly(raw)) continue;
    // Skip confirmation responses
    if (/^(yes|yep|ok|confirm|go ahead|do it|proceed|sounds good)\b/i.test(raw) && raw.length < 30) continue;

    // ── Try comma-separated parsing first ──
    // "For concrete, Home Depot, 3000" or "concrete, Home Depot, 3000" or "Drywall, Lowes, 1500"
    const parts = raw.split(/,\s*/);
    if (parts.length >= 2) {
      for (const part of parts) {
        const p = part.trim();
        if (!p) continue;
        // Strip leading "for ", "from ", "at " prefixes
        const cleaned = p.replace(/^(for|from|at)\s+/i, '').trim();
        
        // Check if it's a number (amount)
        const numMatch = cleaned.match(/^\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*$/);
        if (numMatch) {
          const num = parseFloat(numMatch[1].replace(/,/g, ''));
          if (num >= 1) amount = num;
          continue;
        }
        // Check if it's a known vendor
        if (knownVendors.test(cleaned)) {
          vendor = cleaned;
          continue;
        }
        // First non-number, non-vendor part → description
        if (!description) {
          description = cleaned;
        } else if (!vendor) {
          // Second text part could be vendor
          vendor = cleaned;
        }
      }
      continue; // Done with this message
    }

    // ── Single-value messages ──
    // CRITICAL: Check for "X for Y" pattern FIRST before extracting amount separately
    // This ensures "Concrete for 1000" extracts both description and amount together
    // Extract description and amount together from "X for Y" pattern BEFORE other extractions
    // BUT: If X is a known vendor, treat it as vendor+amount, not description+amount
    if (!description && !vendor) {
      // "Concrete for 3000" or "Lowe's for 1000" pattern - PRIORITY: Check this FIRST
      let match = raw.match(/^(.+?)\s+for\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s*$/i);
      if (match && match[1] && match[1].trim().length > 0) {
        let xPart = match[1].trim().replace(/\s+(from|at)\s+.+$/i, '').trim();
        if (xPart.length > 0 && !isIntentOnly(xPart)) {
          // CRITICAL: Check if X is a known vendor BEFORE treating it as description
          const rawForTest = xPart.replace(/['"]/g, ''); // Remove apostrophes/quotes for testing
          const isKnownVendor = knownVendors.test(xPart) || knownVendors.test(rawForTest);
          
          if (isKnownVendor) {
            // "Lowe's for 1000" → vendor="Lowe's", amount=1000, description=null (will ask for it)
            vendor = xPart;
            if (match[2]) {
              const num = parseFloat(match[2].replace(/,/g, ''));
              if (num >= 1) {
                amount = num;
                console.log('✅ Extracted vendor and amount from "X for Y" pattern (X is known vendor):', { vendor, amount, raw });
                continue; // Skip description extraction
              }
            }
          } else {
            // "Concrete for 1000" → description="Concrete", amount=1000
            description = xPart;
            if (match[2]) {
              const num = parseFloat(match[2].replace(/,/g, ''));
              if (num >= 1) {
                amount = num;
                console.log('✅ Extracted description and amount from "X for Y" pattern (X is not vendor):', { description, amount, raw });
              }
            }
          }
        }
      }
      // Fallback pattern (without end anchor)
      if (!description && !vendor) {
        match = raw.match(/^(.+?)\s+for\s+(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s|$)/i);
        if (match && match[1] && match[1].trim().length > 0) {
          let xPart = match[1].trim().replace(/\s+(from|at)\s+.+$/i, '').trim();
          if (xPart.length > 0 && !isIntentOnly(xPart)) {
            // CRITICAL: Check if X is a known vendor BEFORE treating it as description
            const rawForTest = xPart.replace(/['"]/g, '');
            const isKnownVendor = knownVendors.test(xPart) || knownVendors.test(rawForTest);
            
            if (isKnownVendor) {
              vendor = xPart;
              if (match[2]) {
                const num = parseFloat(match[2].replace(/,/g, ''));
                if (num >= 1) {
                  amount = num;
                  console.log('✅ Extracted vendor and amount from "X for Y" pattern (fallback, X is known vendor):', { vendor, amount, raw });
                  continue; // Skip description extraction
                }
              }
            } else {
              description = xPart;
              if (match[2]) {
                const num = parseFloat(match[2].replace(/,/g, ''));
                if (num >= 1) {
                  amount = num;
                  console.log('✅ Extracted description and amount from "X for Y" pattern (fallback, X is not vendor):', { description, amount, raw });
                }
              }
            }
          }
        }
      }
    }

    // Extract amount separately (only if not already extracted from "X for Y" pattern)
    if (!amount) {
      const numbers = text.match(/\b(\d+(?:,\d{3})*(?:\.\d+)?)\b/g);
      if (numbers && numbers.length > 0) {
        const parsed = numbers.map(n => parseFloat(n.replace(/,/g, '')));
        const maxNum = Math.max(...parsed);
        if (maxNum >= 1) {
          amount = maxNum;
        }
      }
    }
    
    // Check if this is a standalone vendor name (known store or answer to "vendor" question)
    const isJustNumber = /^\d+(?:,\d{3})*(?:\.\d+)?\s*$/.test(raw);
    if (!isJustNumber) {
      // PRIORITY 1: If we already have description and amount, ANY response is likely the vendor
      // (user answering "What is the vendor?" - could be single word like "Lowe's" or multi-word)
      // This MUST come before description extraction to prevent vendor from being treated as description
      if (description && amount && !isIntentOnly(raw) && raw.length > 2) {
        // Check if it's a known vendor first
        if (knownVendors.test(raw)) {
          vendor = raw.trim();
          console.log('✅ Vendor matched from knownVendors (description/amount already present):', vendor);
          continue;
        }
        // Even if not in knownVendors, if description/amount exist, this is likely the vendor
        vendor = raw.trim();
        console.log('✅ Vendor inferred from context (description/amount already present):', vendor);
        continue; // Skip description extraction for this message
      }
      
      // PRIORITY 2: Check if entire message is a known vendor (using word boundaries, so "Floor and decor" will match)
      // CRITICAL: Test both with and without word boundaries for apostrophes like "Lowe's"
      const rawForTest = raw.replace(/['"]/g, ''); // Remove apostrophes/quotes for testing
      if (knownVendors.test(raw) || knownVendors.test(rawForTest)) {
        vendor = raw.trim();
        console.log('✅ Vendor matched from knownVendors:', vendor);
        continue;
      }
      
      // PRIORITY 3: Also check if it's a vendor name that looks like a store (2+ words, not a number)
      // This catches "Floor and decor" even if not in knownVendors regex
      // Only if we don't already have a description (to avoid conflicts)
      if (!description) {
        const looksLikeVendor = /^[a-z][a-z\s&]+[a-z]$/i.test(raw) && 
                                raw.split(/\s+/).length >= 2 && 
                                !/^\d/.test(raw) &&
                                raw.length > 8 &&
                                !isIntentOnly(raw);
        if (looksLikeVendor) {
          vendor = raw.trim();
          console.log('✅ Vendor inferred from pattern (looks like vendor name):', vendor);
          continue;
        }
      }
    }

    // Extract vendor from "from X", "at X", or "It's for X" patterns
    if (!vendor) {
      // Handle "It's for Home Depot for 5000" pattern
      const itsForMatch = raw.match(/(?:it'?s|it is)\s+for\s+(.+?)(?:\s+for\s+\d|$)/i);
      if (itsForMatch && itsForMatch[1].trim().length > 1) {
        const v = itsForMatch[1].trim();
        if (knownVendors.test(v) || v.length > 2) {
          vendor = v;
        }
      }
      if (!vendor) {
        const vendorMatch = raw.match(/\b(?:from|vendor[:\s]+|vendor\s+is)\s+(.+?)(?:\s+for\s+|\s+\d|$)/i);
        if (vendorMatch && vendorMatch[1].trim().length > 1) {
          const v = vendorMatch[1].trim();
          if (!/^\d+$/.test(v)) vendor = v;
        }
      }
      if (!vendor) {
        const atMatch = raw.match(/(?:^|\s)at\s+(.+?)(?:\s+for\s+|\s+\d|$)/i);
        if (atMatch && atMatch[1].trim().length > 1) {
          const v = atMatch[1].trim();
          if (!/^\d+$/.test(v) && !/change|order|scope/i.test(v)) vendor = v;
        }
      }
      // If still no vendor and this looks like a vendor name (multi-word, not a number, not an intent)
      // This catches cases like "Floor and decor" when user is directly answering "What is the vendor?"
      if (!vendor && !isJustNumber && !isIntentOnly(raw) && raw.length > 3) {
        // Check if it's a known vendor (now with word boundaries, so "Floor and decor" will match)
        if (knownVendors.test(raw)) {
          vendor = raw.trim();
        } else if (raw.split(/\s+/).length >= 2 && !description) {
          // Multi-word response that's not a description → likely a vendor name
          // Only set as vendor if we don't already have a description (to avoid overwriting)
          vendor = raw.trim();
        }
      }
    }

    // Extract description (only if not already extracted from "X for Y" pattern above)
    // CRITICAL: Only extract description if we don't already have one AND we don't have vendor
    // This prevents "Floor and decor" from being treated as description when description/amount already exist
    if (!description && !vendor) {
      // "Concrete 3000" pattern
      match = raw.match(/^(.+?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s*$/i);
      if (match && match[1].trim().length > 0 && !description) {
        let d = match[1].trim().replace(/\s+(from|at)\s+.+$/i, '').trim();
        if (d.length > 0 && !isIntentOnly(d)) { 
          description = d; 
          // Also extract amount from this pattern if not already set
          if (!amount && match[2]) {
            const num = parseFloat(match[2].replace(/,/g, ''));
            if (num >= 1) amount = num;
          }
          continue; 
        }
      }
      // Pure text — only set as description if we don't already have one
      // (prevents vendor answers from overwriting description)
      if (!isJustNumber && raw.length > 2 && !isIntentOnly(raw) && !description) {
        let d = raw.replace(/\s+(from|at)\s+.+$/i, '').trim();
        d = d.replace(/\s+\d+(?:,\d{3})*(?:\.\d+)?\s*$/, '').trim();
        if (d.length > 1 && !isIntentOnly(d) && !knownVendors.test(d)) {
          description = d;
        }
      }
    }
  }

  // Final vendor cleanup: normalize common variations
  if (vendor) {
    // Normalize "Floor and decor" / "Floor & decor" / "floor and decor" to consistent format
    vendor = vendor.trim();
    // Preserve original casing but normalize spacing
    vendor = vendor.replace(/\s+/g, ' ');
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔍 inferCOFieldsFromUserMessages result:', { 
      description, 
      amount, 
      vendor, 
      messageCount: userMessages.length,
      messages: userMessages.map(m => m.content)
    });
  }
  
  return { description, amount, vendor };
}

function writeAuditLog(entry) {
  try {
    const line = JSON.stringify({
      ...entry,
      ts: new Date().toISOString(),
    }) + '\n';
    fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true });
    fs.appendFileSync(AUDIT_LOG_PATH, line, 'utf8');
  } catch (e) {
    console.warn('⚠️ Audit log write failed:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROACTIVE PM INTELLIGENCE ENGINE
// Runs on every PM Mode request — detects financial and schedule risks.
// Returns an array of alert strings grounded in real numbers from context.
// ─────────────────────────────────────────────────────────────────────────────
function runProactiveIntelligence(ctx) {
  const alerts = [];
  if (!ctx) return alerts;

  const bidPrice      = Number(ctx.bidPrice || 0);
  const estimatedCost = Number(ctx.estimatedCost || 0);
  const materialBudget = Number(ctx.materialBudgetDirect || 0);
  const materialSpent  = Number(ctx.materialSpentDirect || 0);
  const actualCost    = Number(ctx.actualCost || ctx.totalSpent || 0);
  const progress      = Number(ctx.progress || 0);           // 0–100
  const committedPOs  = Number(ctx.committedPOs || 0);
  const expenses      = Array.isArray(ctx.expenses) ? ctx.expenses : [];
  const milestones    = Array.isArray(ctx.milestones) ? ctx.milestones : [];
  const buckets       = Array.isArray(ctx.buckets) ? ctx.buckets : [];

  // ① Budget burn > schedule progress (burning faster than building)
  if (estimatedCost > 0 && progress > 0) {
    const burnPct = (actualCost / estimatedCost) * 100;
    if (burnPct > progress + 15) {
      alerts.push(`🔴 BUDGET BURN ALERT: You've spent ${burnPct.toFixed(1)}% of your estimated cost but the job is only ${progress.toFixed(0)}% complete. You are running ${(burnPct - progress).toFixed(0)} points ahead of schedule — investigate immediately.`);
    }
  }

  // ② Committed POs + actual spend approaching or exceeding budget
  if (estimatedCost > 0) {
    const totalExposure = actualCost + committedPOs;
    const exposurePct = (totalExposure / estimatedCost) * 100;
    if (exposurePct > 90 && exposurePct <= 100) {
      alerts.push(`⚠️ BUDGET WARNING: Actual spend ($${actualCost.toLocaleString()}) + committed POs ($${committedPOs.toLocaleString()}) = $${totalExposure.toLocaleString()}, which is ${exposurePct.toFixed(1)}% of your estimated cost. You're approaching your budget ceiling.`);
    } else if (exposurePct > 100) {
      alerts.push(`🚨 OVER BUDGET: Actual spend + committed POs ($${totalExposure.toLocaleString()}) EXCEEDS your estimated cost ($${estimatedCost.toLocaleString()}) by $${(totalExposure - estimatedCost).toLocaleString()}. Immediate action required.`);
    }
  }

  // ③ Materials 80%+ spent but job < 40% complete
  if (materialBudget > 0 && materialSpent > 0 && progress < 40) {
    const matBurnPct = (materialSpent / materialBudget) * 100;
    if (matBurnPct >= 80) {
      alerts.push(`🔴 MATERIAL RISK: Materials are ${matBurnPct.toFixed(0)}% spent ($${materialSpent.toLocaleString()} of $${materialBudget.toLocaleString()}) but the job is only ${progress.toFixed(0)}% complete. You may run out of material budget before finishing.`);
    }
  }

  // ④ Margin erosion — actual margin vs estimated margin
  if (bidPrice > 0 && estimatedCost > 0 && actualCost > 0) {
    const estimatedMarginPct = ((bidPrice - estimatedCost) / bidPrice) * 100;
    const projectedFinalCost = progress > 5 ? (actualCost / (progress / 100)) : 0;
    if (projectedFinalCost > 0) {
      const projectedMarginPct = ((bidPrice - projectedFinalCost) / bidPrice) * 100;
      const marginDrop = estimatedMarginPct - projectedMarginPct;
      if (marginDrop > 5) {
        alerts.push(`📉 MARGIN EROSION: Estimated margin was ${estimatedMarginPct.toFixed(1)}%. At your current burn rate, projected final cost is $${projectedFinalCost.toLocaleString()}, dropping margin to ${projectedMarginPct.toFixed(1)}% — a ${marginDrop.toFixed(1)} point loss vs estimate.`);
      }
    }
  }

  // ⑤ Duplicate expenses (same vendor + amount within same day)
  if (expenses.length > 1) {
    const seen = {};
    expenses.forEach(e => {
      const key = `${(e.vendor||'').toLowerCase()}_${Number(e.amount||0).toFixed(2)}_${(e.date||'').substring(0,10)}`;
      seen[key] = (seen[key] || 0) + 1;
    });
    const dupes = Object.entries(seen).filter(([, count]) => count > 1);
    if (dupes.length > 0) {
      alerts.push(`⚠️ DUPLICATE EXPENSES DETECTED: ${dupes.length} expense(s) appear to be recorded twice on the same day for the same amount and vendor. Review your expenses list to avoid double-counting.`);
    }
  }

  // ⑥ Overdue payment milestones
  const today = new Date();
  const overdue = milestones.filter(m => {
    if (!m.plannedDate || m.status === 'completed') return false;
    return new Date(m.plannedDate) < today;
  });
  if (overdue.length > 0) {
    const overdueNames = overdue.map(m => `"${m.title}" ($${Number(m.amount||0).toLocaleString()})`).join(', ');
    alerts.push(`📅 OVERDUE PAYMENTS: ${overdue.length} milestone(s) are past their due date and not yet collected: ${overdueNames}. Follow up with your client immediately.`);
  }

  // ⑦ CFO Mode: gross margin summary (always show in PM mode if data available)
  if (bidPrice > 0 && estimatedCost > 0) {
    const estimatedMargin  = bidPrice - estimatedCost;
    const estimatedMarginPct = (estimatedMargin / bidPrice) * 100;
    const actualMargin     = bidPrice - actualCost;
    const actualMarginPct  = actualCost > 0 ? (actualMargin / bidPrice) * 100 : null;
    let marginSummary = `💰 MARGIN SUMMARY: Bid $${bidPrice.toLocaleString()} | Est. Cost $${estimatedCost.toLocaleString()} | Est. Margin $${estimatedMargin.toLocaleString()} (${estimatedMarginPct.toFixed(1)}%)`;
    if (actualMarginPct !== null) {
      marginSummary += ` | Actual Spend $${actualCost.toLocaleString()} | Current Margin $${actualMargin.toLocaleString()} (${actualMarginPct.toFixed(1)}%)`;
    }
    alerts.push(marginSummary);
  }

  // ⑧ SPEND SPIKE: today's expenses vs 7-day average
  if (expenses.length >= 7) {
    const today = new Date().toISOString().split('T')[0];
    const todayExpenses = expenses.filter(e => (e.date || '').startsWith(today));
    const todayTotal = todayExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    
    // Calculate 7-day average (excluding today)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const recentExpenses = expenses.filter(e => {
      const d = new Date(e.date || 0);
      return d >= sevenDaysAgo && !(e.date || '').startsWith(today);
    });
    const recentTotal = recentExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const dailyAvg = recentTotal / 7;
    
    if (todayTotal > 0 && dailyAvg > 0 && todayTotal > dailyAvg * 2.5) {
      alerts.push(`🔥 SPEND SPIKE: Today's spend ($${todayTotal.toLocaleString()}) is ${(todayTotal / dailyAvg).toFixed(1)}x your 7-day average ($${dailyAvg.toLocaleString()}/day). Verify these expenses are planned.`);
    }
  }

  // ⑨ CATEGORY OVERRUN: any budget category spent over its allocation
  if (buckets.length > 0) {
    const overrunCategories = buckets.filter(b => {
      const budget = Number(b.budget || b.bidBudget || 0);
      const spent = Number(b.spent || 0);
      return budget > 0 && spent > budget;
    });
    for (const cat of overrunCategories) {
      const budget = Number(cat.budget || cat.bidBudget || 0);
      const spent = Number(cat.spent || 0);
      const overBy = spent - budget;
      alerts.push(`🚧 CATEGORY OVERRUN: "${cat.name}" is $${overBy.toLocaleString()} over its $${budget.toLocaleString()} budget (spent $${spent.toLocaleString()}). Review line items in this category.`);
    }
  }

  // ⑩ UNDERBILLED RISK: work complete but payments not collected
  if (progress > 0 && milestones.length > 0 && bidPrice > 0) {
    const totalCollected = milestones
      .filter(m => m.status === 'completed' || m.status === 'collected')
      .reduce((s, m) => s + Number(m.amount || 0), 0);
    const expectedBilled = bidPrice * (progress / 100);
    const billingGap = expectedBilled - totalCollected;
    
    if (billingGap > bidPrice * 0.15 && totalCollected < expectedBilled * 0.7) {
      alerts.push(`💸 UNDERBILLED RISK: Job is ${progress.toFixed(0)}% complete (expected billing: $${expectedBilled.toLocaleString()}) but only $${totalCollected.toLocaleString()} collected. You may be funding $${billingGap.toLocaleString()} out of pocket. Send an invoice or schedule a draw.`);
    }
  }

  return alerts;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS LIST INTELLIGENCE (additive)
// Scans all projects and surfaces concise alerts for Projects screen.
// ─────────────────────────────────────────────────────────────────────────────
function runProjectsListIntelligence(parsedContext) {
  const alerts = [];
  const allProjects = Array.isArray(parsedContext?.allProjects) ? parsedContext.allProjects : [];
  if (!allProjects.length) return alerts;

  const now = new Date();
  const normalize = (v) => {
    if (v == null) return 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const safeDate = (d) => {
    const dt = new Date(d || 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  };

  allProjects.forEach((p) => {
    const title = p?.title || p?.name || 'Project';
    const estimateData = p?.estimateData || p?.projectData?.estimateData || {};
    const buckets = Array.isArray(p?.buckets) ? p.buckets : (Array.isArray(p?.projectData?.buckets) ? p.projectData.buckets : []);
    const milestonesRaw = Array.isArray(p?.milestones) && p.milestones.length
      ? p.milestones
      : (Array.isArray(p?.weeklyPayments) ? p.weeklyPayments : []);

    // Material overrun — use larger of bucket vs estimate (avoid false positives from stale buckets)
    const materialBucket = buckets.find((b) => {
      const n = String(b?.name || '').toLowerCase();
      return n.includes('material') || n.includes('equipment');
    });
    const materialBudgetFromBucket = normalize(materialBucket?.budget ?? materialBucket?.bidBudget ?? 0);
    const materialBudgetFromEst = normalize(estimateData?.materialTotal ?? estimateData?.materials ?? 0) || sumLineItems(estimateData?.materialLineItems ?? estimateData?.materialsCart, normalize);
    const materialBudget = Math.max(materialBudgetFromBucket, materialBudgetFromEst);
    const expenses = p?.expenses || p?.projectData?.expenses || [];
    const materialSpentFromExpenses = sumExpensesByCategory(expenses, 'material', normalize);
    const materialSpent = materialSpentFromExpenses > 0 ? materialSpentFromExpenses : normalize(materialBucket?.spent ?? 0);
    const estimatedCost = normalize(p?.estimatedCost ?? 0);
    const bidPrice = normalize(p?.bidPrice ?? p?.contractValue ?? p?.total ?? 0);
    const changeOrders = p?.changeOrders || p?.projectData?.changeOrders || [];
    const approvedCOs = changeOrders.reduce((s, co) => {
      const ok = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status.toLowerCase() === 'approved');
      return ok ? s + normalize(co?.amount ?? 0) : s;
    }, 0);
    const estimateCostFromEd = normalize(estimateData?.totalCost ?? estimateData?.estimatedCost ?? estimateData?.baseCost ?? 0);
    const plannedCost = estimatedCost > 0 ? estimatedCost : (estimateCostFromEd > 0 ? estimateCostFromEd : bidPrice);
    const adjustedCostBudget = plannedCost + approvedCOs;
    const actualCost = normalize(p?.actualCost ?? p?.totalSpent ?? 0);
    const projectWithinBudget = adjustedCostBudget > 0 && actualCost <= adjustedCostBudget;
    const materialBudgetSuspicious = plannedCost > 0 && materialBudget > 0 && materialBudget < plannedCost * 0.05;

    if (!projectWithinBudget && !materialBudgetSuspicious && materialBudget > 0 && materialSpent > materialBudget) {
      const overPct = Math.round(((materialSpent - materialBudget) / materialBudget) * 100);
      alerts.push(`${title}: Materials ${overPct}% over budget`);
    }

    // Labor overrun — same logic
    const laborBucket = buckets.find((b) => String(b?.name || '').toLowerCase().includes('labor'));
    const laborBudgetFromBucket = normalize(laborBucket?.budget ?? laborBucket?.bidBudget ?? 0);
    const laborBudgetFromEst = normalize(estimateData?.laborTotal ?? estimateData?.labor ?? 0) || sumLineItems(estimateData?.laborLineItems, normalize);
    const laborBudget = Math.max(laborBudgetFromBucket, laborBudgetFromEst);
    const laborSpentFromExpenses = sumExpensesByCategory(expenses, 'labor', normalize);
    const laborSpent = laborSpentFromExpenses > 0 ? laborSpentFromExpenses : normalize(laborBucket?.spent ?? 0);
    if (!projectWithinBudget && laborBudget > 0 && laborSpent > laborBudget) {
      const overPct = Math.round(((laborSpent - laborBudget) / laborBudget) * 100);
      alerts.push(`${title}: Labor ${overPct}% over budget`);
    }

    // Overdue milestones/payments
    const overdue = milestonesRaw.filter((m) => {
      const status = String(m?.status || '').toLowerCase();
      if (status.includes('complete') || status.includes('paid') || status.includes('collected')) return false;
      const dt = safeDate(m?.plannedDate || m?.scheduledDate || m?.dueDate);
      return !!dt && dt < now;
    });
    if (overdue.length > 0) {
      const name = overdue[0]?.title || overdue[0]?.name || overdue[0]?.description || 'Milestone';
      alerts.push(`${title}: ${name} overdue`);
    }

    // Low margin
    const revenue = normalize(p?.bidPrice ?? p?.contractValue ?? p?.total ?? 0);
    const spentOrEstimate = normalize(p?.actualCost ?? p?.totalSpent ?? p?.estimatedCost ?? 0);
    const marginFallback = revenue > 0 ? ((revenue - spentOrEstimate) / revenue) * 100 : 0;
    const margin = normalize(p?.margin ?? p?.marginPct ?? marginFallback);
    if (margin > 0 && margin < 10) {
      alerts.push(`${title}: Margin at ${Math.round(margin)}%`);
    }

    // Upcoming payments
    const upcoming = milestonesRaw.find((m) => {
      const status = String(m?.status || '').toLowerCase();
      if (status.includes('complete') || status.includes('paid') || status.includes('collected')) return false;
      const dt = safeDate(m?.plannedDate || m?.scheduledDate || m?.dueDate);
      if (!dt) return false;
      const days = Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 7;
    });
    if (upcoming) {
      const upName = upcoming?.title || upcoming?.name || upcoming?.description || 'Payment';
      alerts.push(`${title}: Upcoming ${upName} within 7 days`);
    }

    // Stalled project activity
    const updatedAt = safeDate(p?.updatedAt || p?.lastUpdated || p?.projectData?.lastUpdated);
    if (updatedAt) {
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate >= 14) {
        alerts.push(`${title}: No major updates in ${daysSinceUpdate} days`);
      }
    }

    // Missing receipts (expenses without receiptUri)
    if (expenses.length > 0) {
      const withReceipt = expenses.filter((e) => e?.receiptUri && String(e.receiptUri).trim());
      const withoutReceipt = expenses.length - withReceipt.length;
      if (withoutReceipt > 0 && withReceipt.length < expenses.length) {
        alerts.push(`${title}: ${withoutReceipt} expense(s) missing receipts`);
      }
    }
  });

  // Portfolio-level financial summary — use contract value (bid + approved COs) for revenue
  const withFinancials = allProjects
    .map((p) => {
      const title = p?.title || p?.name || 'Project';
      const baseBid = normalize(p?.bidPrice ?? p?.projectData?.bidPrice ?? 0);
      const changeOrders = p?.changeOrders || p?.projectData?.changeOrders || [];
      const approvedCOs = changeOrders.reduce((s, co) => {
        const ok = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status?.toLowerCase() === 'approved');
        return ok ? s + normalize(co?.amount ?? 0) : s;
      }, 0);
      const revenue = normalize(p?.contractValue ?? 0) > 0 ? normalize(p.contractValue) : (baseBid + approvedCOs > 0 ? baseBid + approvedCOs : baseBid);
      const estCost = normalize(p?.estimatedCost ?? 0);
      const spent = normalize(p?.actualCost ?? p?.totalSpent ?? 0);
      const spentOrEstimate = spent > 0 ? spent : estCost;
      const marginFallback = revenue > 0 ? ((revenue - spentOrEstimate) / revenue) * 100 : 0;
      const margin = normalize(p?.margin ?? p?.marginPct ?? marginFallback);
      const progress = normalize(p?.progress ?? p?.overallProgressPct ?? 0);
      const projectedFinalCost = progress > 5 && spent > 0 ? (spent / (progress / 100)) : estCost;
      const projectedMargin = revenue > 0 && projectedFinalCost > 0 ? ((revenue - projectedFinalCost) / revenue) * 100 : margin;
      return { title, margin, revenue, estCost, spent, progress, projectedFinalCost, projectedMargin };
    })
    .filter((x) => x.revenue > 0);

  if (withFinancials.length >= 1) {
    const totalRevenue = withFinancials.reduce((s, x) => s + x.revenue, 0);
    const totalEstCost = withFinancials.reduce((s, x) => s + x.estCost, 0);
    const totalSpent = withFinancials.reduce((s, x) => s + x.spent, 0);
    const totalProjectedCost = withFinancials.reduce((s, x) => s + x.projectedFinalCost, 0);
    const portfolioProjectedProfit = totalRevenue - totalProjectedCost;
    const portfolioMarginPct = totalRevenue > 0 ? (portfolioProjectedProfit / totalRevenue * 100) : 0;

    alerts.push(`📊 PORTFOLIO SUMMARY: ${withFinancials.length} projects | Total Revenue: $${totalRevenue.toLocaleString()} | Total Spent: $${totalSpent.toLocaleString()} | Projected Profit: $${Math.round(portfolioProjectedProfit).toLocaleString()} (${portfolioMarginPct.toFixed(1)}%)`);

    const byMargin = [...withFinancials].sort((a, b) => a.margin - b.margin);
    const lowest = byMargin[0];
    const highest = byMargin[byMargin.length - 1];
    if (lowest.margin < 25) {
      alerts.push(`⚠️ ${lowest.title}: Lowest margin at ${Math.round(lowest.margin)}% — needs attention`);
    }
    if (highest.margin > 20 && highest.title !== lowest.title) {
      alerts.push(`✅ ${highest.title}: Most profitable (${Math.round(highest.margin)}% margin)`);
    }

    // Margin erosion detection
    withFinancials.forEach((x) => {
      if (x.progress > 10 && x.margin > 0 && x.projectedMargin < x.margin) {
        const erosion = x.margin - x.projectedMargin;
        if (erosion > 5) {
          alerts.push(`📉 ${x.title}: Margin erosion — estimated ${Math.round(x.margin)}% but trending toward ${Math.round(x.projectedMargin)}% based on current spend rate`);
        }
      }
    });

    // Spend vs progress mismatch
    withFinancials.forEach((x) => {
      if (x.progress > 0 && x.estCost > 0 && x.spent > 0) {
        const burnPct = (x.spent / x.estCost) * 100;
        if (burnPct > x.progress + 20) {
          alerts.push(`🔴 ${x.title}: Spending ahead of progress — ${Math.round(burnPct)}% of budget spent but only ${Math.round(x.progress)}% complete`);
        }
      }
    });
  }

  return alerts.slice(0, 15);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPARE PROJECTS — deterministic fast path (no LLM) for "compare all projects"
// Uses same logic as mobile Projects page (getProjectRevenue, actualCost, computeProfitForecast)
// Only includes Chris, Nick, Jason to match Projects page display.
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_PROJECT_NAMES = ['chris', 'nick', 'jason'];
const PROJECT_ORDER = ['chris', 'jason', 'nick']; // Fixed order to match Projects page

function runCompareProjects(parsedContext) {
  // Prefer client-provided compareProjectsData (matches Projects page exactly — includes overrides & timeline)
  let precomputed = Array.isArray(parsedContext?.compareProjectsData) ? parsedContext.compareProjectsData : [];
  const progressByProjectId = parsedContext?.progressByProjectId || {};
  // Override progress with timeline data when available (client may have sent stale compareProjectsData)
  if (precomputed.length > 0 && Object.keys(progressByProjectId).length > 0) {
    precomputed = precomputed.map((x) => {
      const key = String(x?.title || '').trim().toLowerCase();
      const slug = key.replace(/\s+/g, '-');
      const override = progressByProjectId[key] ?? progressByProjectId[slug] ?? progressByProjectId[String(x?.id ?? '')];
      return override != null ? { ...x, progress: override } : x;
    });
  }
  if (precomputed.length > 0) {
    const data = precomputed;
    const totalRevenue = data.reduce((s, x) => s + Number(x.revenue || 0), 0);
    const totalProfit = data.reduce((s, x) => s + Number(x.projectedProfit || 0), 0);
    const highestMargin = data.reduce((best, x) => (x.margin > (best?.margin ?? 0) ? x : best), null);
    const highestProfit = data.reduce((best, x) => (Number(x.projectedProfit || 0) > Number(best?.projectedProfit || 0) ? x : best), null);
    const needsAttention = data.filter((x) => x.missingReceipts > 0 || (Array.isArray(x.riskFlags) && x.riskFlags.length > 0));

    const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let summary = '';
    if (highestMargin && highestProfit) {
      const sameProject = highestMargin.title === highestProfit.title;
      if (sameProject) {
        summary += `${highestMargin.title} has the highest margin (${highestMargin.margin}%) and highest projected profit ($${fmt(highestProfit.projectedProfit || 0)})`;
      } else {
        summary += `${highestMargin.title} has the highest margin (${highestMargin.margin}%); ${highestProfit.title} has the highest projected profit ($${fmt(highestProfit.projectedProfit || 0)})`;
      }
    } else if (highestMargin) {
      summary += `${highestMargin.title} has the highest margin (${highestMargin.margin}%)`;
    } else if (highestProfit) {
      summary += `${highestProfit.title} has the highest projected profit ($${fmt(highestProfit.projectedProfit || 0)})`;
    }
    if (needsAttention.length > 0) {
      const receiptOnly = needsAttention.filter((x) => x.missingReceipts > 0).length === needsAttention.length &&
        needsAttention.every((x) => !Array.isArray(x.riskFlags) || x.riskFlags.length === 0 || (x.riskFlags.length === 1 && x.riskFlags[0] === 'missing_receipts'));
      if (needsAttention.length === data.length && receiptOnly) {
        summary += summary ? '. All projects need attention for missing receipts' : 'All projects need attention for missing receipts';
      } else {
        const names = needsAttention.map((x) => x.title).join(', ');
        summary += summary ? `. ${needsAttention.length} project(s) need attention: ${names}` : `${needsAttention.length} project(s) need attention: ${names}`;
      }
    }
    summary = summary ? summary + '.\n\n' : '';

    let reply = "Here's the comparison of all your projects for profitability and risk:\n\n" + summary;
    data.forEach((x) => {
      const riskParts = [];
      if (x.missingReceipts > 0) riskParts.push(`${x.missingReceipts} missing receipts`);
      if (Array.isArray(x.riskFlags) && x.riskFlags.length > 0) {
        riskParts.push(...x.riskFlags.filter((r) => r !== 'missing_receipts').map((r) => String(r).replace(/_/g, ' ')));
      }
      const riskStr = riskParts.length > 0 ? `Risk: ${riskParts.join(', ')}` : 'Risk: None';
      reply += `**${x.title}**\n`;
      reply += `• Margin: ${x.margin}%\n`;
      reply += `• Spent: $${fmt(x.spent || 0)}\n`;
      if (x.committedPOs != null && x.committedPOs > 0) reply += `• Committed POs: $${fmt(x.committedPOs)}\n`;
      reply += `• Projected Profit: $${fmt(x.projectedProfit || 0)}\n`;
      if (x.revenue != null && x.revenue > 0) reply += `• Revenue: $${fmt(x.revenue)}\n`;
      if (x.budgetUsedPct != null && x.budgetUsedPct > 0) reply += `• Budget used: ${x.budgetUsedPct}%\n`;
      if (x.progress != null) reply += `• Progress: ${Math.round(x.progress)}%\n`;
      if (x.status) reply += `• Status: ${x.status}\n`;
      reply += `• ${riskStr}\n\n`;
    });

    reply += `**Portfolio totals** — Revenue: $${fmt(totalRevenue)} | Projected profit: $${fmt(totalProfit)}\n\n`;
    if (needsAttention.length > 0) {
      const receiptProjects = needsAttention.filter((x) => x.missingReceipts > 0);
      if (receiptProjects.length > 0) {
        reply += `**Focus on:** ${receiptProjects.map((x) => x.title).join(', ')} — upload missing receipts to reduce risk.\n`;
      }
    }
    return reply;
  }

  const allProjects = Array.isArray(parsedContext?.allProjects) ? parsedContext.allProjects : [];
  if (allProjects.length === 0) return null;

  const normalize = (v) => {
    if (v == null) return 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const sanitizePositive = (v) => {
    const n = normalize(v);
    return n > 0 ? n : 0;
  };

  // getProjectRevenue — matches Projects page (estimateData.grandTotal, bidPrice, etc. + approved COs)
  function getProjectRevenue(project) {
    const ed = project?.estimateData || project?.projectData?.estimateData || {};
    const originalBudgetCandidates = [
      ed?.grandTotal,
      ed?.bidPrice,
      ed?.total,
      project?.bidPrice,
      project?.projectData?.bidPrice,
      project?.projectData?.totalBidPrice,
      project?.estimatedCost,
      project?.projectData?.estimatedCost,
      project?.total,
      project?.totalRevenue,
      project?.contractValue,
    ];
    let originalBudget = 0;
    for (const c of originalBudgetCandidates) {
      const s = sanitizePositive(c);
      if (s > 0) { originalBudget = s; break; }
    }
    if (originalBudget <= 0) return 0;

    const coSources = [
      project?.projectData?.changeOrders,
      project?.changeOrders,
      project?.rawProject?.projectData?.changeOrders,
      project?.rawProject?.changeOrders,
    ];
    const collected = [];
    for (const src of coSources) {
      if (Array.isArray(src) && src.length) collected.push(...src);
    }
    const seen = new Set();
    const unique = collected.filter((co) => {
      const key = co?.id != null ? `id:${co.id}` : `sig:${String(co?.title || '')}:${Number(co?.amount ?? co?.clientPrice ?? co?.cost ?? 0)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    let approvedCOs = unique.reduce((sum, co) => {
      const amt = Number(co?.amount ?? co?.clientPrice ?? co?.cost ?? 0);
      const ok = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status?.toLowerCase() === 'approved');
      return ok ? sum + amt : sum;
    }, 0);
    if (approvedCOs <= 0) {
      approvedCOs = sanitizePositive(
        project?.projectData?.changeOrderTotal ?? project?.changeOrderTotal ?? project?.rawProject?.projectData?.changeOrderTotal
      );
    }
    return originalBudget + approvedCOs;
  }

  // computeProfitForecast — matches mobile profitForecast.ts
  function computeProfitForecast(contractValue, adjustedBudget, actualExpenses, committedPOs, progressPct, isCompleted) {
    const cv = normalize(contractValue);
    const adj = normalize(adjustedBudget);
    const actual = normalize(actualExpenses);
    const committed = normalize(committedPOs);
    const pct = Math.min(100, Math.max(0, normalize(progressPct)));
    const ratio = pct > 0 ? pct / 100 : 0;
    const done = isCompleted || ratio >= 1;

    let forecastFinalCost = adj;
    if (actual > 0 || committed > 0) {
      const actualPlusCommitted = actual + committed;
      if (done) {
        forecastFinalCost = actual;
      } else if (ratio > 0.01 && actual > 0) {
        const cpiForecast = actual / ratio;
        forecastFinalCost = Math.max(actualPlusCommitted, cpiForecast);
      } else {
        forecastFinalCost = Math.max(adj, actualPlusCommitted);
      }
    }
    const projectedProfit = cv - forecastFinalCost;
    const projectedMarginPct = cv > 0 ? (projectedProfit / cv) * 100 : 0;
    return { projectedProfit, projectedMarginPct };
  }

  // Filter to Chris, Nick, Jason only (same as Projects page)
  const filtered = allProjects.filter((p) => {
    const t = String(p?.title || p?.name || '').toLowerCase().trim();
    return ALLOWED_PROJECT_NAMES.some((n) => t === n || t.startsWith(n + ' ') || t.startsWith(n + '-') || t.startsWith(n + "'"));
  });

  // Dedupe by name (prefer exact match)
  const seen = new Set();
  const deduped = filtered.filter((p) => {
    const t = String(p?.title || p?.name || '').toLowerCase().trim();
    const key = PROJECT_ORDER.find((n) => t === n || t.startsWith(n)) ?? t;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const analyzed = deduped.map((p) => {
    const title = p?.title || p?.name || 'Untitled Project';
    const pd = p?.projectData ?? p;
    const status = String(p?.status || pd?.status || '').toLowerCase();

    // Actual cost — same as Projects page: expenses + received POs
    const expensesTotal = sanitizePositive(pd?.spent) ||
      (Array.isArray(pd?.expenses) && pd.expenses.length
        ? pd.expenses.reduce((s, e) => s + normalize(e?.amount ?? 0), 0)
        : Array.isArray(pd?.buckets)
          ? pd.buckets.reduce((s, b) => s + normalize(b?.spent ?? 0), 0)
          : 0);
    const rawPOs = pd?.purchaseOrders ?? p?.purchaseOrders ?? [];
    const receivedPOsTotal = Array.isArray(rawPOs)
      ? rawPOs
          .filter((po) => String(po?.status || '').toLowerCase() === 'received')
          .reduce((s, po) => s + normalize(po?.amount ?? 0), 0)
      : 0;
    const actualCost = expensesTotal + receivedPOsTotal || normalize(p?.actualCost ?? p?.totalSpent ?? pd?.actualCost ?? 0);

    const estimatedCost = normalize(
      p?.estimatedCost ?? pd?.estimatedCost ?? p?.estimateData?.totalCost ?? pd?.estimateData?.totalCost ?? 0
    );
    const committedPOs = Array.isArray(rawPOs)
      ? rawPOs
          .filter((po) => String(po?.status || '').toLowerCase() !== 'received')
          .reduce((s, po) => s + normalize(po?.amount ?? 0), 0)
      : 0;

    const revenue = getProjectRevenue(p);
    const progressPct = normalize(p?.progress ?? p?.overallProgressPct ?? pd?.progress ?? 0);
    const finalProgress = status === 'completed' ? 100 : progressPct;
    const isCompleted = status === 'completed';

    const forecast = revenue > 0
      ? computeProfitForecast(
          revenue,
          estimatedCost > 0 ? estimatedCost : revenue,
          actualCost,
          committedPOs,
          finalProgress,
          isCompleted
        )
      : { projectedProfit: 0, projectedMarginPct: 0 };

    const expenses = p?.expenses || pd?.expenses || [];
    const missingReceipts = expenses.filter((e) => !e?.receiptUri || !String(e.receiptUri).trim()).length;

    const margin = forecast.projectedMarginPct;
    const budget = estimatedCost > 0 ? estimatedCost : revenue;
    const overBudgetPct = budget > 0 ? ((actualCost - budget) / budget) * 100 : 0;
    const milestones = p?.milestones || pd?.milestones || p?.weeklyPayments || pd?.weeklyPayments || [];
    const overdueItems = Array.isArray(milestones) ? milestones.filter((m) => {
      const st = String(m?.status || '').toLowerCase();
      if (st.includes('complete') || st.includes('paid') || st.includes('collected')) return false;
      const dt = new Date(m?.plannedDate || m?.scheduledDate || m?.dueDate || 0);
      return Number.isFinite(dt.getTime()) && dt.getTime() < Date.now();
    }) : [];

    const riskFlags = [];
    if (overBudgetPct > 10) riskFlags.push('over_budget');
    if (margin > 0 && margin < 10) riskFlags.push('low_margin');
    if (overdueItems.length > 0) riskFlags.push('overdue_milestones');
    if (progressPct > 0 && budget > 0 && (actualCost / budget * 100) > progressPct + 20) riskFlags.push('spend_ahead_of_progress');
    if (missingReceipts >= 3) riskFlags.push('missing_receipts');
    if (actualCost === 0 && revenue > 0) riskFlags.push('margin_erosion'); // No spend yet — margin may drop once work starts

    const displayStatus = status === 'completed' ? 'Completed' : (status === 'won' || status === 'in_progress' || status === 'active') ? 'Active' : 'Submitted';
    // Budget used %: match project-detail — spent / (contract value + approved COs)
    const budgetUsedPct = revenue > 0 ? Math.round((actualCost / revenue) * 100) : 0;
    return {
      title,
      margin: Math.round(margin * 10) / 10,
      spent: Math.round(actualCost),
      projectedProfit: Math.round(forecast.projectedProfit),
      revenue,
      progress: finalProgress,
      status: displayStatus,
      missingReceipts,
      riskFlags,
      committedPOs: Math.round(committedPOs),
      budgetUsedPct,
    };
  });

  // Sort by fixed order: Chris, Jason, Nick
  const sorted = [...analyzed].sort((a, b) => {
    const aIdx = PROJECT_ORDER.findIndex((n) => (a.title || '').toLowerCase().startsWith(n));
    const bIdx = PROJECT_ORDER.findIndex((n) => (b.title || '').toLowerCase().startsWith(n));
    if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
    if (aIdx >= 0) return -1;
    if (bIdx >= 0) return 1;
    return 0;
  });

  const totalRevenue = sorted.reduce((s, x) => s + Number(x.revenue || 0), 0);
  const totalProfit = sorted.reduce((s, x) => s + Number(x.projectedProfit || 0), 0);
  const highestMargin = sorted.reduce((best, x) => (x.margin > (best?.margin ?? 0) ? x : best), null);
  const highestProfit = sorted.reduce((best, x) => (Number(x.projectedProfit || 0) > Number(best?.projectedProfit || 0) ? x : best), null);
  const needsAttention = sorted.filter((x) => x.missingReceipts > 0 || (Array.isArray(x.riskFlags) && x.riskFlags.length > 0));

  const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let summary = '';
  if (highestMargin && highestProfit) {
    const sameProject = highestMargin.title === highestProfit.title;
    if (sameProject) {
      summary += `${highestMargin.title} has the highest margin (${highestMargin.margin}%) and highest projected profit ($${fmt(highestProfit.projectedProfit || 0)})`;
    } else {
      summary += `${highestMargin.title} has the highest margin (${highestMargin.margin}%); ${highestProfit.title} has the highest projected profit ($${fmt(highestProfit.projectedProfit || 0)})`;
    }
  } else if (highestMargin) {
    summary += `${highestMargin.title} has the highest margin (${highestMargin.margin}%)`;
  } else if (highestProfit) {
    summary += `${highestProfit.title} has the highest projected profit ($${fmt(highestProfit.projectedProfit || 0)})`;
  }
  if (needsAttention.length > 0) {
    const receiptOnly = needsAttention.filter((x) => x.missingReceipts > 0).length === needsAttention.length &&
      needsAttention.every((x) => !Array.isArray(x.riskFlags) || x.riskFlags.length === 0 || (x.riskFlags.length === 1 && x.riskFlags[0] === 'missing_receipts'));
    if (needsAttention.length === sorted.length && receiptOnly) {
      summary += summary ? '. All projects need attention for missing receipts' : 'All projects need attention for missing receipts';
    } else {
      const names = needsAttention.map((x) => x.title).join(', ');
      summary += summary ? `. ${needsAttention.length} project(s) need attention: ${names}` : `${needsAttention.length} project(s) need attention: ${names}`;
    }
  }
  summary = summary ? summary + '.\n\n' : '';

  let reply = "Here's the comparison of all your projects for profitability and risk:\n\n" + summary;
  sorted.forEach((x) => {
    const riskParts = [];
    if (x.missingReceipts > 0) riskParts.push(`${x.missingReceipts} missing receipts`);
    if (Array.isArray(x.riskFlags) && x.riskFlags.length > 0) {
      riskParts.push(...x.riskFlags.filter((r) => r !== 'missing_receipts').map((r) => String(r).replace(/_/g, ' ')));
    }
    const riskStr = riskParts.length > 0 ? `Risk: ${riskParts.join(', ')}` : 'Risk: None';
    reply += `**${x.title}**\n`;
    reply += `• Margin: ${x.margin}%\n`;
    reply += `• Spent: $${fmt(x.spent || 0)}\n`;
    if (x.committedPOs != null && x.committedPOs > 0) reply += `• Committed POs: $${fmt(x.committedPOs)}\n`;
    reply += `• Projected Profit: $${fmt(x.projectedProfit || 0)}\n`;
    if (x.revenue != null && x.revenue > 0) reply += `• Revenue: $${fmt(x.revenue)}\n`;
    if (x.budgetUsedPct != null && x.budgetUsedPct > 0) reply += `• Budget used: ${x.budgetUsedPct}%\n`;
    if (x.progress != null) reply += `• Progress: ${Math.round(x.progress)}%\n`;
    if (x.status) reply += `• Status: ${x.status}\n`;
    reply += `• ${riskStr}\n\n`;
  });

  reply += `**Portfolio totals** — Revenue: $${fmt(totalRevenue)} | Projected profit: $${fmt(totalProfit)}\n\n`;
  if (needsAttention.length > 0) {
    const receiptProjects = needsAttention.filter((x) => x.missingReceipts > 0);
    if (receiptProjects.length > 0) {
      reply += `**Focus on:** ${receiptProjects.map((x) => x.title).join(', ')} — upload missing receipts to reduce risk.\n`;
    }
  }
  return reply;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFIT LEAK DETECTION — identify silent profit erosion across projects
// ─────────────────────────────────────────────────────────────────────────────
function runProfitLeakDetection(parsedContext) {
  const allProjects = Array.isArray(parsedContext?.allProjects) ? parsedContext.allProjects : [];
  const now = new Date();
  const normalize = (v) => {
    if (v == null) return 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  };
  const safeDate = (d) => {
    const dt = new Date(d || 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  };

  const leaks = [];

  allProjects.forEach((p) => {
    const title = p?.title || p?.name || 'Project';
    const buckets = p?.buckets || p?.projectData?.buckets || [];
    const ed = p?.estimateData || p?.projectData?.estimateData || {};
    const materialBucket = buckets.find((b) => String(b?.name || '').toLowerCase().includes('material') || String(b?.name || '').toLowerCase().includes('equipment'));
    const laborBucket = buckets.find((b) => String(b?.name || '').toLowerCase().includes('labor'));
    // Use the LARGER of bucket budget vs estimate total — project list buckets can be stale/wrong;
    // Budget tab uses estimate line items. Avoid false "400% over" when bucket has tiny value.
    const materialBudgetFromBucket = normalize(materialBucket?.budget ?? materialBucket?.bidBudget ?? 0);
    const materialBudgetFromEst = normalize(ed?.materialTotal ?? ed?.materials ?? 0) || sumLineItems(ed?.materialLineItems ?? ed?.materialsCart, normalize);
    const materialBudget = Math.max(materialBudgetFromBucket, materialBudgetFromEst);
    const expenses = p?.expenses || p?.projectData?.expenses || [];
    const materialSpentFromExpenses = sumExpensesByCategory(expenses, 'material', normalize);
    const materialSpent = materialSpentFromExpenses > 0 ? materialSpentFromExpenses : normalize(materialBucket?.spent ?? 0);
    const laborBudgetFromBucket = normalize(laborBucket?.budget ?? laborBucket?.bidBudget ?? 0);
    const laborBudgetFromEst = normalize(ed?.laborTotal ?? ed?.labor ?? 0) || sumLineItems(ed?.laborLineItems, normalize);
    const laborBudget = Math.max(laborBudgetFromBucket, laborBudgetFromEst);
    const laborSpentFromExpenses = sumExpensesByCategory(expenses, 'labor', normalize);
    const laborSpent = laborSpentFromExpenses > 0 ? laborSpentFromExpenses : normalize(laborBucket?.spent ?? 0);
    const progress = normalize(p?.progress ?? p?.overallProgressPct ?? 0);
    const actualCost = normalize(p?.actualCost ?? p?.totalSpent ?? 0);
    const estimatedCost = normalize(p?.estimatedCost ?? 0);
    const bidPrice = normalize(p?.bidPrice ?? p?.contractValue ?? p?.total ?? 0);
    const changeOrders = p?.changeOrders || p?.projectData?.changeOrders || [];
    const approvedCOs = changeOrders.reduce((s, co) => {
      const ok = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status.toLowerCase() === 'approved');
      return ok ? s + normalize(co?.amount ?? 0) : s;
    }, 0);
    // Cost budget = planned cost + change orders (matches Budget tab's adjustedBudget)
    const estimateCostFromEd = normalize(ed?.totalCost ?? ed?.estimatedCost ?? ed?.baseCost ?? 0);
    const plannedCost = estimatedCost > 0 ? estimatedCost : (estimateCostFromEd > 0 ? estimateCostFromEd : bidPrice);
    const adjustedCostBudget = plannedCost + approvedCOs;
    // Skip category overrun flags when project is within cost budget overall — likely stale bucket data
    const projectWithinBudget = adjustedCostBudget > 0 && actualCost <= adjustedCostBudget;
    // Also skip when material budget is unrealistically small (<5% of total) — likely bad bucket data
    const materialBudgetSuspicious = plannedCost > 0 && materialBudget > 0 && materialBudget < plannedCost * 0.05;

    if (!projectWithinBudget && laborBudget > 0 && laborSpent > laborBudget) {
      const overPct = Math.round(((laborSpent - laborBudget) / laborBudget) * 100);
      leaks.push({
        project: title,
        message: `${title} is ${overPct}% over projected labor at this phase.`,
        cta: 'Review Costs',
        prompt: `Review labor costs and expenses on ${title}`,
        priority: 1,
      });
    }
    if (!projectWithinBudget && !materialBudgetSuspicious && materialBudget > 0 && materialSpent > materialBudget) {
      const overPct = Math.round(((materialSpent - materialBudget) / materialBudget) * 100);
      leaks.push({
        project: title,
        message: `${title} material costs are ${overPct}% above estimate.`,
        cta: 'Review Costs',
        prompt: `Compare estimate vs actual material costs on ${title}`,
        priority: 2,
      });
    }
    if (progress > 0 && estimatedCost > 0 && actualCost > 0) {
      const expectedSpend = estimatedCost * (progress / 100);
      if (actualCost > expectedSpend * 1.15) {
        leaks.push({
          project: title,
          message: `Spend is ahead of progress on ${title}, which may compress margin.`,
          cta: 'Forecast Margin',
          prompt: `Forecast the final cost and profit for ${title}`,
          priority: 3,
        });
      }
    }

    const withoutReceipt = expenses.filter((e) => !e?.receiptUri || !String(e.receiptUri).trim()).length;
    if (withoutReceipt >= 3) {
      leaks.push({
        project: title,
        message: `Missing receipts are reducing reporting accuracy on ${title}.`,
        cta: 'Upload Receipts',
        prompt: `Which expenses on ${title} are missing receipts?`,
        priority: 4,
      });
    }

    const milestonesRaw = p?.milestones || p?.weeklyPayments || [];
    const overdue = milestonesRaw.filter((m) => {
      const status = String(m?.status || '').toLowerCase();
      if (status.includes('complete') || status.includes('paid') || status.includes('collected')) return false;
      const dt = safeDate(m?.plannedDate || m?.scheduledDate || m?.dueDate);
      return !!dt && dt < now;
    });
    if (overdue.length > 0 && progress > 20) {
      leaks.push({
        project: title,
        message: `${overdue[0]?.title || overdue[0]?.name || 'Payment'} appears overdue relative to completed work.`,
        cta: 'Review Payments',
        prompt: `What payments are overdue on ${title}?`,
        priority: 5,
      });
    }
  });

  return leaks.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// TODAY BRIEF — structured data for Global AI Command Center
// Returns insights, recommended actions, quick actions, suggested follow-ups
// ─────────────────────────────────────────────────────────────────────────────
function runTodayBrief(parsedContext) {
  const allProjects = Array.isArray(parsedContext?.allProjects) ? parsedContext.allProjects : [];
  const now = new Date();
  const normalize = (v) => {
    if (v == null) return 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[$,\s]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const safeDate = (d) => {
    const dt = new Date(d || 0);
    return Number.isFinite(dt.getTime()) ? dt : null;
  };

  const insights = [];
  const recommendedActions = [];
  const projectNames = new Set();

  // Aggregate missing receipts across all projects
  let totalMissingReceipts = 0;
  allProjects.forEach((p) => {
    const expenses = p?.expenses || p?.projectData?.expenses || [];
    const withoutReceipt = expenses.filter((e) => !e?.receiptUri || !String(e.receiptUri).trim()).length;
    totalMissingReceipts += withoutReceipt;
  });
  if (totalMissingReceipts > 0) {
    insights.push(`${totalMissingReceipts} expense${totalMissingReceipts > 1 ? 's' : ''} missing receipts`);
    recommendedActions.push({ label: 'Upload missing receipts', prompt: 'Which projects have missing receipts? I want to upload them.' });
  }

  // Lowest margin, most profitable
  const withMargin = allProjects
    .map((p) => {
      const title = p?.title || p?.name || 'Project';
      const revenue = normalize(p?.bidPrice ?? p?.contractValue ?? p?.total ?? 0);
      const spentOrEstimate = normalize(p?.actualCost ?? p?.totalSpent ?? p?.estimatedCost ?? 0);
      const marginFallback = revenue > 0 ? ((revenue - spentOrEstimate) / revenue) * 100 : 0;
      const margin = normalize(p?.margin ?? p?.marginPct ?? marginFallback);
      return { title, margin, revenue };
    })
    .filter((x) => x.margin > 0 && x.revenue > 0);

  if (withMargin.length >= 1) {
    const byMargin = [...withMargin].sort((a, b) => a.margin - b.margin);
    const lowest = byMargin[0];
    const highest = byMargin[byMargin.length - 1];
    if (lowest.margin < 25) {
      insights.push(`${lowest.title} margin is trending lower`);
      projectNames.add(lowest.title);
      recommendedActions.push({ label: `Review ${lowest.title} costs`, prompt: `Review labor costs and expenses on ${lowest.title}` });
    }
    if (highest.margin > 20 && highest.title !== lowest.title) {
      insights.push(`${highest.title} is your most profitable project`);
      projectNames.add(highest.title);
    }
  }

  // Upcoming inspections / milestones (tomorrow or within 7 days)
  let upcomingCount = 0;
  allProjects.forEach((p) => {
    const title = p?.title || p?.name || 'Project';
    const milestonesRaw = p?.milestones || p?.weeklyPayments || [];
    const upcoming = milestonesRaw.find((m) => {
      const status = String(m?.status || '').toLowerCase();
      if (status.includes('complete') || status.includes('paid') || status.includes('collected')) return false;
      const dt = safeDate(m?.plannedDate || m?.scheduledDate || m?.dueDate);
      if (!dt) return false;
      const days = Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 2;
    });
    if (upcoming) {
      upcomingCount++;
      projectNames.add(title);
    }
  });
  if (upcomingCount > 0) {
    insights.push(`${upcomingCount} payment${upcomingCount > 1 ? 's' : ''} due in the next 2 days`);
    recommendedActions.push({ label: 'Confirm upcoming payments', prompt: 'What payments or milestones are due in the next few days?' });
  }

  // Labor / material overruns — use larger of bucket vs estimate; skip when project within budget overall
  allProjects.forEach((p) => {
    const title = p?.title || p?.name || 'Project';
    const buckets = p?.buckets || p?.projectData?.buckets || [];
    const ed = p?.estimateData || p?.projectData?.estimateData || {};
    const materialBucket = buckets.find((b) => String(b?.name || '').toLowerCase().includes('material') || String(b?.name || '').toLowerCase().includes('equipment'));
    const laborBucket = buckets.find((b) => String(b?.name || '').toLowerCase().includes('labor'));
    const materialBudgetFromBucket = normalize(materialBucket?.budget ?? materialBucket?.bidBudget ?? 0);
    const materialBudgetFromEst = normalize(ed?.materialTotal ?? ed?.materials ?? 0) || sumLineItems(ed?.materialLineItems ?? ed?.materialsCart, normalize);
    const materialBudget = Math.max(materialBudgetFromBucket, materialBudgetFromEst);
    const expenses = p?.expenses || p?.projectData?.expenses || [];
    const materialSpentFromExpenses = sumExpensesByCategory(expenses, 'material', normalize);
    const materialSpent = materialSpentFromExpenses > 0 ? materialSpentFromExpenses : normalize(materialBucket?.spent ?? 0);
    const laborBudgetFromBucket = normalize(laborBucket?.budget ?? laborBucket?.bidBudget ?? 0);
    const laborBudgetFromEst = normalize(ed?.laborTotal ?? ed?.labor ?? 0) || sumLineItems(ed?.laborLineItems, normalize);
    const laborBudget = Math.max(laborBudgetFromBucket, laborBudgetFromEst);
    const laborSpentFromExpenses = sumExpensesByCategory(expenses, 'labor', normalize);
    const laborSpent = laborSpentFromExpenses > 0 ? laborSpentFromExpenses : normalize(laborBucket?.spent ?? 0);
    const estimatedCost = normalize(p?.estimatedCost ?? 0);
    const bidPrice = normalize(p?.bidPrice ?? p?.contractValue ?? p?.total ?? 0);
    const changeOrders = p?.changeOrders || p?.projectData?.changeOrders || [];
    const approvedCOs = changeOrders.reduce((s, co) => {
      const ok = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status.toLowerCase() === 'approved');
      return ok ? s + normalize(co?.amount ?? 0) : s;
    }, 0);
    const estimateCostFromEd = normalize(ed?.totalCost ?? ed?.estimatedCost ?? ed?.baseCost ?? 0);
    const plannedCost = estimatedCost > 0 ? estimatedCost : (estimateCostFromEd > 0 ? estimateCostFromEd : bidPrice);
    const adjustedCostBudget = plannedCost + approvedCOs;
    const actualCost = normalize(p?.actualCost ?? p?.totalSpent ?? 0);
    const projectWithinBudget = adjustedCostBudget > 0 && actualCost <= adjustedCostBudget;
    const materialBudgetSuspicious = plannedCost > 0 && materialBudget > 0 && materialBudget < plannedCost * 0.05;

    if (!projectWithinBudget && !materialBudgetSuspicious && materialBudget > 0 && materialSpent > materialBudget) {
      const overPct = Math.round(((materialSpent - materialBudget) / materialBudget) * 100);
      insights.push(`${title} materials ${overPct}% over budget`);
      projectNames.add(title);
      recommendedActions.push({ label: `Review ${title} costs`, prompt: `Compare estimate vs actual material costs on ${title}` });
    }
    if (!projectWithinBudget && laborBudget > 0 && laborSpent > laborBudget) {
      const overPct = Math.round(((laborSpent - laborBudget) / laborBudget) * 100);
      insights.push(`${title} labor ${overPct}% over budget`);
      projectNames.add(title);
    }
  });

  // Overdue items
  allProjects.forEach((p) => {
    const title = p?.title || p?.name || 'Project';
    const milestonesRaw = p?.milestones || p?.weeklyPayments || [];
    const overdue = milestonesRaw.filter((m) => {
      const status = String(m?.status || '').toLowerCase();
      if (status.includes('complete') || status.includes('paid') || status.includes('collected')) return false;
      const dt = safeDate(m?.plannedDate || m?.scheduledDate || m?.dueDate);
      return !!dt && dt < now;
    });
    if (overdue.length > 0) {
      insights.push(`${overdue[0]?.title || overdue[0]?.name || 'Payment'} overdue on ${title}`);
      projectNames.add(title);
    }
  });

  // Profit leak detection — contractor-friendly insights
  const profitLeaks = runProfitLeakDetection(parsedContext);
  profitLeaks.forEach((leak) => {
    if (!insights.includes(leak.message)) insights.push(leak.message);
    if (!recommendedActions.find((a) => a.prompt === leak.prompt)) {
      recommendedActions.push({ label: leak.cta, prompt: leak.prompt });
    }
  });

  // Dedupe insights, cap at 4 for concise premium feel
  const uniqueInsights = [...new Set(insights)].slice(0, 4);
  const uniqueRecommended = recommendedActions.slice(0, 3);

  const quickActions = [
    { label: 'Compare Projects', prompt: 'Compare all my projects for profitability and risk' },
    { label: 'What Needs Attention', prompt: 'What should I focus on today? Give me my top priorities.' },
    { label: 'Forecast Profit', prompt: 'Forecast profit across my entire portfolio — show projected numbers' },
    { label: 'Check Budget Risks', prompt: 'Which projects have budget risks? Show me specifics.' },
    { label: 'Missing Receipts', prompt: 'Which projects have expenses missing receipts?' },
    { label: 'Portfolio Health', prompt: 'Give me a full portfolio health check — margins, risks, and what to focus on' },
  ];

  const suggestedFollowUps = [];
  const names = [...projectNames].slice(0, 3);
  names.forEach((name) => {
    suggestedFollowUps.push({ label: `Review ${name}`, prompt: `Give me a full health check on ${name} — budget, margin, risks, and what I should do next` });
  });
  if (names.length >= 2) {
    suggestedFollowUps.push({ label: `Compare ${names[0]} vs ${names[1]}`, prompt: `Compare ${names[0]} and ${names[1]} — which is performing better and why?` });
  }
  suggestedFollowUps.push({ label: 'Where am I losing money?', prompt: 'Where am I losing money across my projects? Show me the biggest profit leaks.' });
  suggestedFollowUps.push({ label: 'Show projects over budget', prompt: 'Which projects are over budget and by how much?' });

  // Biggest Risk: pick highest-priority issue (profit leak first, then low margin, overdue, missing receipts)
  let biggestRisk = null;
  if (profitLeaks.length > 0) {
    const top = profitLeaks[0];
    const impactDetail = top.priority === 1 ? 'Labor overruns directly compress your margin.'
      : top.priority === 2 ? 'Material costs above estimate reduce your profit.'
      : top.priority === 3 ? 'Spending ahead of progress may compress margin significantly.'
      : top.priority === 4 ? 'Missing receipts reduce reporting accuracy and tax deductions.'
      : 'Overdue payments affect your cash flow.';
    biggestRisk = {
      title: top.project,
      message: top.message,
      detail: impactDetail,
      cta: top.cta,
      prompt: top.prompt,
    };
  } else if (withMargin && withMargin.length >= 1) {
    const byMargin = [...withMargin].sort((a, b) => a.margin - b.margin);
    const lowest = byMargin[0];
    if (lowest.margin < 25) {
      biggestRisk = {
        title: lowest.title,
        message: `${lowest.title} margin at ${Math.round(lowest.margin)}% — your lowest`,
        detail: 'Review costs to protect this margin before it erodes further.',
        cta: 'Review Project',
        prompt: `Give me a full health check on ${lowest.title} — budget, margin, risks, and what I should do next`,
      };
    }
  }

  return {
    insights: uniqueInsights,
    recommendedActions: uniqueRecommended,
    quickActions,
    suggestedFollowUps: suggestedFollowUps.slice(0, 6),
    biggestRisk,
  };
}

function getAllMilestonesFromContext(parsedContext = {}) {
  return [
    ...(parsedContext?.milestones || []),
    ...(parsedContext?.paymentMilestones || []),
    ...(parsedContext?.timelineItems || []),
    ...(parsedContext?.currentProject?.milestones || []),
    ...(parsedContext?.currentProject?.paymentMilestones || []),
    ...(parsedContext?.currentProject?.timelineItems || []),
  ];
}

function getPendingPaymentMilestones(parsedContext = {}) {
  const allMilestones = getAllMilestonesFromContext(parsedContext);
  const seen = new Set();
  const deduped = [];

  for (const m of allMilestones) {
    const key = `${m?.id || ''}|${String(m?.title || m?.name || '').toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(m);
    }
  }

  return deduped.filter((m) => {
    const title = String(m?.title || m?.name || '').trim();
    const status = String(m?.status || '').toLowerCase();
    const progressPct = Number(m?.progressPct ?? m?.progress ?? 0);
    const amount = Number(m?.amount || 0);
    const isPayment =
      m?.type === 'payment' ||
      /payment|deposit|milestone|draw|progress payment/i.test(title) ||
      amount > 0;
    const isNotCollected =
      m?.collected !== true &&
      status !== 'collected' &&
      status !== 'completed' &&
      progressPct < 100;

    return isPayment && isNotCollected;
  });
}

/**
 * Format payment milestone name for display
 * Converts "Week 1 Payment" → "Weekly Payment 1", "Deposit" → "Deposit", etc.
 */
function formatPaymentNameForDisplay(titleOrName = '') {
  const name = String(titleOrName || '').trim();
  if (!name) return name;
  
  // Check if it's a deposit (case-insensitive)
  if (/^deposit$/i.test(name)) {
    return 'Deposit';
  }
  
  // Match patterns like "Week 1 Payment", "Week 2 Payment", etc.
  const weekMatch = name.match(/week\s+(\d+)\s+payment/i);
  if (weekMatch) {
    const weekNum = weekMatch[1];
    return `Weekly Payment ${weekNum}`;
  }
  
  // Match patterns like "Weekly Payment 1", "Weekly Payment 2", etc. (already formatted)
  const weeklyMatch = name.match(/weekly\s+payment\s+(\d+)/i);
  if (weeklyMatch) {
    const weekNum = weeklyMatch[1];
    return `Weekly Payment ${weekNum}`;
  }
  
  // Match patterns like "Payment 1", "Payment 2", etc. and convert to "Weekly Payment X"
  const paymentMatch = name.match(/payment\s+(\d+)/i);
  if (paymentMatch) {
    const weekNum = paymentMatch[1];
    return `Weekly Payment ${weekNum}`;
  }
  
  // Return as-is for other formats
  return name;
}

function matchPendingPaymentByName(pendingPayments = [], rawName = '') {
  const searchName = String(rawName || '').toLowerCase().trim();
  if (!searchName) return null;

  // Exact title match
  let match = pendingPayments.find((m) => String(m?.title || m?.name || '').toLowerCase() === searchName);
  if (match) return match;

  // Partial contains
  match = pendingPayments.find((m) => {
    const t = String(m?.title || m?.name || '').toLowerCase();
    return t.includes(searchName) || searchName.includes(t);
  });
  if (match) return match;

  // Fuzzy normalized match
  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/\b(payment|pay|week|milestone|deposit|draw)\b/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizedSearch = normalize(searchName);
  if (!normalizedSearch) return null;

  return pendingPayments.find((m) => {
    const normalizedTitle = normalize(m?.title || m?.name || '');
    return normalizedTitle.includes(normalizedSearch) || normalizedSearch.includes(normalizedTitle);
  }) || null;
}

/**
 * Run the deterministic missing cost scan — no router, no CO flow.
 * Used by both the dedicated endpoint and the early check in the main handler.
 */
function runMissingCostScan({ projectName, estimatedCost, estimateData, bidTotal, actualCost, expenses, parsedContext, currentProjectData }) {
  const baseEstimateCost = Number(estimatedCost || estimateData?.totalCost || estimateData?.baseCost || bidTotal || 0);
  const materialLineItems = Array.isArray(estimateData?.materialLineItems) ? estimateData.materialLineItems : [];
  const laborLineItems = Array.isArray(estimateData?.laborLineItems) ? estimateData.laborLineItems : [];
  const genericLineItems = Array.isArray(estimateData?.lineItems) ? estimateData.lineItems : [];
  const combinedText = [
    ...materialLineItems.map(i => `${i?.name || ''} ${i?.description || ''} ${i?.category || ''}`),
    ...laborLineItems.map(i => `${i?.name || ''} ${i?.description || ''} ${i?.trade || ''} ${i?.category || ''}`),
    ...genericLineItems.map(i => `${i?.name || ''} ${i?.description || ''} ${i?.category || ''}`)
  ].join(' ').toLowerCase();
  const hasKeyword = (arr) => arr.some(k => combinedText.includes(k));
  const materialBudgetEarly = (parsedContext?.materialBudgetDirect > 0 ? parsedContext.materialBudgetDirect : 0) ||
    (estimateData?.materialLineItems?.reduce((s, i) => s + (Number(i?.total) || Number(i?.unitCost || 0) * (Number(i?.quantity) || 0) || 0), 0) || 0);
  const laborBudgetEarly = Number(estimateData?.laborTotal || parsedContext?.laborTotal || currentProjectData?.laborTotal || 0) ||
    (estimateData?.laborLineItems?.reduce((s, i) => s + (Number(i?.total) || Number(i?.unitCost || 0) * (Number(i?.quantity) || 0) || 0), 0) || 0);
  const laborSpentEarly = Array.isArray(expenses) ? expenses.reduce((s, e) => ((e?.category || '').toLowerCase().includes('labor') ? s + (Number(e?.amount) || 0) : s), 0) : 0;
  const hasMaterials = materialBudgetEarly > 0 || materialLineItems.length > 0 || hasKeyword(['material', 'equipment', 'lumber', 'tile', 'drywall']);
  const hasLabor = laborBudgetEarly > 0 || laborLineItems.length > 0 || laborSpentEarly > 0 || hasKeyword(['labor', 'framing', 'electrical', 'plumbing', 'paint']);
  const hasPermits = Number(estimateData?.permitCost || 0) > 0 || Number(estimateData?.planCost || 0) > 0 || hasKeyword(['permit', 'permits', 'inspection', 'plan', 'plans', 'plan check', 'city fee']);
  const hasOverhead = Number(estimateData?.overheadTotal || 0) > 0 || Number(estimateData?.insuranceOverhead || 0) > 0 || Number(estimateData?.facilities || 0) > 0 || Number(estimateData?.equipment || 0) > 0 || Number(estimateData?.otherOverhead || 0) > 0 || hasKeyword(['overhead', 'insurance', 'supervision', 'mobilization']);
  const hasContingency = Number(estimateData?.contingency || 0) > 0 || Number(estimateData?.contingencyAmount || 0) > 0 || Number(estimateData?.contingencyPct || 0) > 0 || hasKeyword(['contingency', 'allowance', 'unexpected']);
  const hasDeliveryOrDisposal = hasKeyword(['delivery', 'freight', 'shipping', 'dumpster', 'disposal', 'haul']);
  const hasTaxesOrFees = hasKeyword(['tax', 'sales tax', 'fee', 'processing fee']);
  const basis = baseEstimateCost > 0 ? baseEstimateCost : (bidTotal > 0 ? bidTotal : 0);
  const toRange = (minPct, maxPct) => ({ min: Math.round(basis * minPct), max: Math.round(basis * maxPct) });
  const gaps = [];
  if (!hasMaterials) gaps.push({ title: 'Materials/Equipment line items', reason: 'No material/equipment scope found', range: toRange(0.18, 0.35) });
  if (!hasLabor) gaps.push({ title: 'Labor scope by trade', reason: 'No labor breakdown found', range: toRange(0.2, 0.4) });
  if (!hasPermits) gaps.push({ title: 'Plans & permits', reason: 'Plans/permit/inspection costs not found', range: toRange(0.01, 0.03) });
  if (!hasOverhead) gaps.push({ title: 'Overhead allocation', reason: 'Insurance/facilities/other overhead not found', range: toRange(0.06, 0.15) });
  if (!hasContingency) gaps.push({ title: 'Contingency reserve', reason: 'No contingency buffer found', range: toRange(0.05, 0.1) });
  if (!hasDeliveryOrDisposal) gaps.push({ title: 'Delivery, disposal, haul-away', reason: 'Logistics/waste costs not found', range: toRange(0.01, 0.04) });
  if (!hasTaxesOrFees) gaps.push({ title: 'Taxes & processing fees', reason: 'Tax/fee line items not found', range: toRange(0.01, 0.03) });
  const totalMin = gaps.reduce((s, g) => s + Number(g.range?.min || 0), 0);
  const totalMax = gaps.reduce((s, g) => s + Number(g.range?.max || 0), 0);
  const totalLineItems = materialLineItems.length + laborLineItems.length + genericLineItems.length;
  let reply = `✅ Scanned ${projectName ? `"${projectName}"` : 'this project'} for missing costs.\n\n`;
  reply += `📊 Estimate snapshot:\n`;
  reply += `- Line items found: ${totalLineItems}\n`;
  reply += `- Estimated Cost: $${Math.round(baseEstimateCost).toLocaleString()}\n`;
  reply += `- Actual Spent: $${Math.round(actualCost).toLocaleString()}\n\n`;
  if (basis === 0) {
    reply += `⚠️ I can't run a reliable gap scan yet because no estimate total or line items are in context.\n`;
    reply += `➡️ Add estimate line items first, then run "Scan for missing costs" again.`;
  } else if (gaps.length === 0) {
    reply += `✅ No obvious missing cost categories detected from current estimate data.\n`;
    reply += `➡️ Next best check: ask me to "Forecast final profit" to stress-test margin risk.`;
  } else {
    reply += `⚠️ Potential missing costs:\n`;
    gaps.forEach((g, i) => { reply += `${i + 1}. ${g.title} — ${g.reason} (impact: +$${g.range.min.toLocaleString()} to +$${g.range.max.toLocaleString()})\n`; });
    reply += `\n💰 Potential underestimation impact: +$${totalMin.toLocaleString()} to +$${totalMax.toLocaleString()}.\n`;
    reply += `[DISCLAIMER]Impact ranges are estimates based on typical project costs—not real-time market data.[/DISCLAIMER]\n\n`;
    reply += `➡️ Want me to add these as estimate line items now?`;
  }
  return reply;
}

/**
 * POST /api/ai-assistant/scan-missing-costs
 * Dedicated endpoint for Missing Costs — bypasses router/CO flow entirely.
 * Mobile app calls this when user clicks the Missing Costs button.
 */
router.post('/scan-missing-costs', async (req, res) => {
  try {
    const { context } = req.body;
    let parsedContext = {};
    try {
      if (typeof context === 'string') parsedContext = JSON.parse(context);
      else if (typeof context === 'object') parsedContext = context || {};
    } catch (e) {
      parsedContext = {};
    }
    const projectName = parsedContext.currentProject || parsedContext.projectName || parsedContext.bidTitle;
    const projectId = parsedContext.projectId || parsedContext.activeProjectId || parsedContext.resolvedProjectId;
    const allProjects = parsedContext.allProjects || [];
    let currentProjectData = null;
    if (projectId && allProjects.length > 0) {
      currentProjectData = allProjects.find(p => String(p.id) === String(projectId));
    }
    let estimateData = currentProjectData?.estimateData || parsedContext.estimateData || currentProjectData?.projectData?.estimateData || parsedContext.bidData || {};
    // Merge bidData line items if estimateData has none (estimate screen context)
    if ((!estimateData.materialLineItems?.length && !estimateData.laborLineItems?.length) && parsedContext.bidData) {
      estimateData = {
        ...estimateData,
        materialLineItems: estimateData.materialLineItems || parsedContext.bidData.materialLineItems || parsedContext.bidData.materialsCart,
        laborLineItems: estimateData.laborLineItems || parsedContext.bidData.laborLineItems,
        lineItems: estimateData.lineItems || parsedContext.bidData.lineItems,
      };
    }
    const bidTotal = parsedContext.bidTotal || parsedContext.total || parsedContext.bidPrice || currentProjectData?.bidTotal || currentProjectData?.bidPrice || estimateData?.totalBid || 0;
    const estimatedCost = parsedContext.estimatedCost || currentProjectData?.estimatedCost || estimateData?.totalCost || estimateData?.baseCost || 0;
    const rawExpenses = parsedContext.expenses || currentProjectData?.expenses || [];
    const actualCost = parsedContext.actualCost || parsedContext.totalSpent || currentProjectData?.actualCost || currentProjectData?.totalSpent ||
      (Array.isArray(rawExpenses) ? rawExpenses.reduce((s, e) => s + Number(e?.amount || 0), 0) : 0) || 0;
    const expenses = parsedContext.expenses || currentProjectData?.expenses || [];
    const reply = runMissingCostScan({
      projectName, estimatedCost, estimateData, bidTotal, actualCost, expenses,
      parsedContext, currentProjectData,
    });
    console.log('✅ /scan-missing-costs — returned (dedicated endpoint, no router)');
    return res.json({ reply, actions: [] });
  } catch (err) {
    console.error('Error in /scan-missing-costs:', err);
    return res.status(500).json({ error: 'Scan failed', message: err.message });
  }
});

/**
 * POST /api/ai-assistant/greeting
 * Returns a personalized Today Brief for the Global AI Command Center.
 * Used when the user opens the center nav AI pill with an empty conversation.
 */
router.post('/greeting', async (req, res) => {
  try {
    const { context = {}, userFirstName } = req.body;
    let parsedContext = {};
    try {
      if (typeof context === 'string') {
        parsedContext = JSON.parse(context);
      } else if (typeof context === 'object') {
        parsedContext = context;
      }
    } catch (e) {
      parsedContext = {};
    }

    const brief = runTodayBrief(parsedContext);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const namePart = userFirstName && String(userFirstName).trim()
      ? ` ${String(userFirstName).trim()}`
      : '';

    let reply = `${greeting}${namePart}\n\nHere's what needs attention today.\n\n`;
    if (brief.insights.length > 0) {
      brief.insights.forEach((a) => {
        reply += `• ${a}\n`;
      });
    } else {
      reply += "Your portfolio looks quiet — no urgent items right now.";
    }

    return res.json({
      reply,
      insights: brief.insights,
      recommendedActions: brief.recommendedActions,
      quickActions: brief.quickActions,
      suggestedFollowUps: brief.suggestedFollowUps,
      biggestRisk: brief.biggestRisk,
    });
  } catch (err) {
    console.error('Error in /greeting:', err);
    return res.status(500).json({ error: 'Greeting failed', message: err.message });
  }
});

/**
 * POST /api/ai-assistant/stream
 * Streaming AI Assistant endpoint — returns Server-Sent Events for real-time token display
 */
router.post('/stream', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'AI service unavailable' });
    }

    const { message, context, history = [], user_settings = {}, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    let parsedContext = {};
    try {
      if (typeof context === 'string') parsedContext = JSON.parse(context);
      else if (typeof context === 'object') parsedContext = context || {};
    } catch (e) { parsedContext = {}; }

    const session = getOrCreateSession(sessionId || `stream-${Date.now()}`);
    const aiPmMode = user_settings.ai_project_manager_mode || false;
    const allProjects = parsedContext.allProjects || [];
    const screen = parsedContext.screen || 'assistant_tab';
    const screenLower = screen.toLowerCase();
    const isCommandCenter = screenLower === 'projects' || screenLower === 'ai assistant tab';

    // Build a simplified system prompt for streaming (portfolio mode only)
    let streamSystemPrompt = buildSystemPrompt({
      projectName: parsedContext.currentProject || parsedContext.projectName,
      projectId: parsedContext.projectId,
      status: parsedContext.status || 'active',
      bidTotal: Number(parsedContext.bidTotal || 0),
      estimatedCost: Number(parsedContext.estimatedCost || 0),
      actualCost: Number(parsedContext.actualCost || 0),
      progress: Number(parsedContext.progress || 0),
      aiPmMode, pmAlerts: [],
      screen,
    });

    if (isCommandCenter) {
      const listAlerts = runProjectsListIntelligence(parsedContext);
      if (listAlerts.length > 0) {
        streamSystemPrompt += `\n\n📌 PORTFOLIO INTELLIGENCE:\n${listAlerts.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
      }
    }

    const memoryBlock = buildMemoryContext(session);
    if (memoryBlock) streamSystemPrompt += memoryBlock;

    const messages = [
      { role: 'system', content: streamSystemPrompt },
      ...history.filter(m => m.role && m.content),
      { role: 'user', content: message },
    ];

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 2000,
        stream: true,
      });

      let fullReply = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullReply += content;
          res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
        }
      }

      extractConversationFacts(message, fullReply, session);
      const suggestedFollowUps = generateSmartSuggestions(message, fullReply, parsedContext, session);

      res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps, sessionId: session?.id })}\n\n`);
      res.end();
    } catch (streamErr) {
      console.error('Stream error:', streamErr.message);
      res.write(`data: ${JSON.stringify({ type: 'error', message: streamErr.message })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error('Error in /stream:', err);
    if (!res.headersSent) return res.status(500).json({ error: err.message });
    res.end();
  }
});

/**
 * POST /api/ai-assistant
 * AI Assistant endpoint for project management
 */
router.post('/', async (req, res) => {
  try {
    const requestId = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const requestStartedAt = Date.now();
    const logPhase = (phase, extra = {}) => {
      console.log(`⏱️ [${requestId}] ${phase}`, { elapsedMs: Date.now() - requestStartedAt, ...extra });
    };

    logPhase('request_start');

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured',
      });
    }

    // Get auth token from request headers EARLY - log for debugging
    const authHeader = req.headers['authorization'];
    const authToken = authHeader && authHeader.split(' ')[1];
    
    if (!authToken) {
      console.warn('⚠️ AI Assistant request missing auth token');
    } else {
      console.log('✅ AI Assistant request has auth token (length:', authToken.length, ')');
    }

    const { message, context, history = [], user_settings = {}, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Conversation memory: get or create session
    const session = getOrCreateSession(sessionId || `auto-${Date.now()}`);

    // Parse context
    let parsedContext = {};
    try {
      if (typeof context === 'string') {
        parsedContext = JSON.parse(context);
      } else if (typeof context === 'object') {
        parsedContext = context;
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse context:', e.message);
      parsedContext = {};
    }

    // Build system prompt based on context and settings
    const aiPmMode = user_settings.ai_project_manager_mode || false;
    
    // Extract project context
    const projectName = parsedContext.currentProject || parsedContext.projectName || parsedContext.bidTitle;
    const selectedProjectIdHint = parsedContext.selectedProjectId || null;
    const lastOpenedProjectIdHint = parsedContext.lastOpenedProjectId || null;
    let projectId = parsedContext.projectId || parsedContext.activeProjectId || parsedContext.resolvedProjectId || selectedProjectIdHint;
    const allProjects = parsedContext.allProjects || [];
    
    console.log('🔍 AI Assistant: Initial project context', {
      projectName,
      projectId,
      allProjectsCount: allProjects.length,
      projectIds: allProjects.slice(0, 3).map(p => ({ id: p.id, title: p.title || p.name })),
      parsedContextKeys: Object.keys(parsedContext),
      parsedContextProjectId: parsedContext.projectId,
      parsedContextActiveProjectId: parsedContext.activeProjectId,
      parsedContextResolvedProjectId: parsedContext.resolvedProjectId,
      parsedContextCurrentProject: parsedContext.currentProject,
      parsedContextProjectName: parsedContext.projectName,
      parsedContextBidTitle: parsedContext.bidTitle
    });
    if (parsedContext?.screen === 'Projects') {
      console.log('🧭 Projects screen hints', {
        selectedProjectIdHint,
        lastOpenedProjectIdHint,
        initialProjectId: projectId,
      });
    }
    
    // If we have a project name but no ID, try to find it in allProjects
    if (projectName && !projectId && allProjects.length > 0) {
      const foundProject = allProjects.find(p => {
        const title = (p.title || p.name || '').toLowerCase().trim();
        const searchName = projectName.toLowerCase().trim();
        return title === searchName || title.includes(searchName) || searchName.includes(title);
      });
      if (foundProject) {
        projectId = foundProject.id;
        console.log('✅ AI Assistant: Resolved projectId from projectName in allProjects:', {
          projectName,
          projectId,
          foundTitle: foundProject.title || foundProject.name
        });
      } else {
        console.warn('⚠️ AI Assistant: Could not find project in allProjects', {
          projectName,
          allProjectsTitles: allProjects.slice(0, 5).map(p => p.title || p.name)
        });
      }
    }
    
    // If we have projectId, get full project data from allProjects
    let currentProjectData = null;
    if (projectId && allProjects.length > 0) {
      currentProjectData = allProjects.find(p => String(p.id) === String(projectId));
      console.log('✅ AI Assistant: Found currentProjectData from allProjects for projectId:', projectId);
    }
    
    // Extract other context
    const status = parsedContext.status || currentProjectData?.status || 'estimate';
    const location = parsedContext.location || currentProjectData?.location || '';
    // Pull estimate data early for fallback lookups
    const estimateData = currentProjectData?.estimateData || parsedContext.estimateData || currentProjectData?.projectData?.estimateData || {};
    const bidTotal = parsedContext.bidTotal || parsedContext.total || parsedContext.bidPrice || currentProjectData?.bidTotal || currentProjectData?.bidPrice || estimateData?.totalBid || 0;
    const estimatedCost = parsedContext.estimatedCost || currentProjectData?.estimatedCost || estimateData?.totalCost || estimateData?.baseCost || 0;
    const approvedChangeOrdersTotal = parsedContext.approvedChangeOrdersTotal ?? (() => {
      const cos = parsedContext.changeOrders || currentProjectData?.changeOrders || [];
      return Array.isArray(cos) ? cos.reduce((s, co) => {
        const amt = Number(co?.amount || 0);
        const approved = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status.toLowerCase() === 'approved');
        return approved ? s + amt : s;
      }, 0) : 0;
    })();
    const contractValue = parsedContext.contractValue != null
      ? Number(parsedContext.contractValue)
      : (Number(bidTotal || 0) + Number(approvedChangeOrdersTotal || 0));
    // Compute actualCost from expenses if top-level is 0
    const rawExpenses = parsedContext.expenses || currentProjectData?.expenses || [];
    const computedActualCost = Array.isArray(rawExpenses) ? rawExpenses.reduce((s, e) => s + Number(e.amount || 0), 0) : 0;
    const actualCost = parsedContext.actualCost || parsedContext.totalSpent || currentProjectData?.actualCost || currentProjectData?.totalSpent || computedActualCost || 0;
    const expenses = parsedContext.expenses || currentProjectData?.expenses || [];
    const expensesCount = expenses.length;
    const milestones = parsedContext.milestones || currentProjectData?.milestones || currentProjectData?.timelineItems || [];
    const margin = parsedContext.margin || parsedContext.marginPct || currentProjectData?.margin || currentProjectData?.marginPct || estimateData?.marginPct || 0;
    const markup = parsedContext.markup || parsedContext.markupPct || currentProjectData?.markup || currentProjectData?.markupPct || estimateData?.markupPct || estimateData?.markup || 0;
    const overhead = parsedContext.overhead || parsedContext.overheadTotal || currentProjectData?.overhead || estimateData?.overheadTotal || 0;
    const progress = parsedContext.progress || currentProjectData?.progress || currentProjectData?.overallProgressPct || 0;
    const activeTab = parsedContext.activeTab || '';

    // ── EARLY: Missing cost scan (run BEFORE budget block to guarantee it always wins) ──
    const msgLowerEarly = (message || '').toLowerCase();
    const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
    const recentUserMessages = recentHistory
      .filter((m) => m?.role === 'user' && m?.content)
      .map((m) => String(m.content));
    const recentAssistantMessages = recentHistory
      .filter((m) => m?.role === 'assistant' && m?.content)
      .map((m) => String(m.content));
    const recentConversationText = [
      ...recentUserMessages.slice(-4),
      ...recentAssistantMessages.slice(-3),
    ].join(' ').toLowerCase();
    const delayContextRegex = /\b(delay(?:ed)?|overrun|behind\s+(?:schedule|timeline)|late\s+by|past\s+due|go(?:es|ing)?\s+long|run(?:s|ning)?\s+long|too\s+long|longer|beyond\s+(?:timeline|schedule)|weeks?\s+(?:over|late|longer))\b/i;
    const delayContextActive = delayContextRegex.test(recentConversationText) ||
      /profit decay|break-even delay|extra labor for \d+ weeks|materials are excluded from delay cost/i.test(
        String(recentAssistantMessages.slice(-1)[0] || '')
      );
    const isMissingCostScanEarly = msgLowerEarly.includes('missing cost') || msgLowerEarly.includes('missing costs') ||
      (msgLowerEarly.includes('scan') && msgLowerEarly.includes('cost')) || msgLowerEarly.includes('cost gaps') || msgLowerEarly.includes('what am i missing');
    if (isMissingCostScanEarly) {
      const reply = runMissingCostScan({
        projectName, estimatedCost, estimateData, bidTotal, actualCost, expenses,
        parsedContext, currentProjectData,
      });
      console.log('✅ EARLY missing cost scan — returning immediately (bypassing router/CO flow)');
      return res.json({ reply, actions: [] });
    }

    // ── EARLY: Compare all projects (profitability + risk) — fast path, no LLM ──
    const isCompareAllProjects = allProjects.length > 0 &&
      msgLowerEarly.includes('compare') &&
      (msgLowerEarly.includes('all') || msgLowerEarly.includes('my') || msgLowerEarly.includes('each')) &&
      (msgLowerEarly.includes('project') || msgLowerEarly.includes('projects')) &&
      (msgLowerEarly.includes('profit') || msgLowerEarly.includes('risk') || msgLowerEarly.includes('margin'));
    if (isCompareAllProjects) {
      const reply = runCompareProjects(parsedContext);
      if (reply) {
        console.log('✅ EARLY compare all projects — returning immediately (bypassing router/LLM)');
        return res.json({ reply, actions: [] });
      }
    }

    // ── EARLY: "X weeks too long" / "goes long" profit projection (NOT scenario analysis) ──
    const numberWords = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    let extraWeeks = 0;
    const numOrWord = '\\d+|a|one|two|three|four|five|six|seven|eight|nine|ten';
    let weeksOverrunMatch = msgLowerEarly.match(new RegExp(`(?:goes?|runs?|extends?|delayed?|overrun[s]?)\\s+(?:by\\s+|for\\s+)?(${numOrWord})\\s+weeks?\\s+(?:too\\s+long|long(?:er)?|over|beyond)(?:\\s+than\\s+projected)?`, 'i')) ||
      msgLowerEarly.match(new RegExp(`(${numOrWord})\\s+weeks?\\s+(?:too\\s+long|long(?:er)?|over|overrun|beyond)(?:\\s+the\\s+timeline)?`, 'i')) ||
      msgLowerEarly.match(new RegExp(`(${numOrWord})\\s+weeks?\\s+longer(?:\\s+than\\s+projected)?`, 'i')) ||
      msgLowerEarly.match(new RegExp(`too\\s+long\\s+for\\s+(${numOrWord})\\s+weeks?`, 'i')) ||
      msgLowerEarly.match(new RegExp(`(?:goes?\\s+on\\s+)?too\\s+long\\s+for\\s+(${numOrWord})\\s+weeks?`, 'i')) ||
      msgLowerEarly.match(new RegExp(`(?:what\\s+if|what\\s+is|projected\\s+profit|if\\s+.*\\s+goes?)\\s+.*\\s+(${numOrWord})\\s+weeks?\\s+(?:too\\s+long|long(?:er)?|over|beyond)`, 'i')) ||
      msgLowerEarly.match(new RegExp(`(?:what\\s+if|what\\s+is)\\s+.*\\s+(?:goes?|runs?|extends?)\\s+.*\\s+(${numOrWord})\\s+weeks?\\s+(?:beyond|longer)`, 'i'));
    if (!weeksOverrunMatch && delayContextActive) {
      weeksOverrunMatch = [...recentUserMessages]
        .reverse()
        .map((txt) => txt.toLowerCase().match(new RegExp(`(${numOrWord})\\s+weeks?`, 'i')))
        .find(Boolean) || null;
    }
    if (weeksOverrunMatch) {
      const val = weeksOverrunMatch[1].toLowerCase();
      extraWeeks = numberWords[val] ?? parseInt(val, 10);
    }
    const continuationReply = /^(ok|okay|yes|yeah|yep|right|same|do it|run it|and what about)\b/i.test(msgLowerEarly.trim());
    const hasWeeksOverrunIntent = (msgLowerEarly.includes('week') && (
      msgLowerEarly.includes('too long') || msgLowerEarly.includes('goes long') || msgLowerEarly.includes('longer') ||
      msgLowerEarly.includes('beyond') || msgLowerEarly.includes('extends') || msgLowerEarly.includes('overrun') ||
      msgLowerEarly.includes('profit') || msgLowerEarly.includes('timeline') || msgLowerEarly.includes('schedule')
    )) || (delayContextActive && (msgLowerEarly.includes('week') || continuationReply));
    const isWeeksOverrunRequest = extraWeeks > 0 && hasWeeksOverrunIntent;

    if (isWeeksOverrunRequest && extraWeeks > 0) {
      const contractVal = Number(contractValue || 0) || (Number(bidTotal || 0) + Number(approvedChangeOrdersTotal || 0));
      const actual = Number(actualCost || 0);
      const progressPct = Math.max(0, Math.min(100, Number(progress || 0)));
      const progressRatio = progressPct > 0 ? progressPct / 100 : 0;
      let baseCost = 0;
      if (progressRatio > 0.01 && actual > 0) {
        baseCost = actual / progressRatio;
      } else {
        baseCost = Number(estimatedCost || estimateData?.totalCost || estimateData?.baseCost || 0);
        if (baseCost >= contractVal * 0.95) baseCost = 0;
        if (baseCost <= 0) baseCost = actual;
      }
      const laborBudget = Number(estimateData?.laborTotal || parsedContext?.laborTotal || currentProjectData?.laborTotal || 0) ||
        (parsedContext.buckets || currentProjectData?.buckets || []).reduce((s, b) => {
          if ((b.name || '').toLowerCase().includes('labor')) return s + (Number(b.budget || b.bidBudget) || 0);
          return s;
        }, 0);
      const overheadBudget = Number(parsedContext?.overhead || parsedContext?.overheadTotal || currentProjectData?.overhead || estimateData?.overheadTotal || 0);
      const startISO = parsedContext?.startDate || parsedContext?.startISO || currentProjectData?.startISO || currentProjectData?.startDate;
      const endISO = parsedContext?.endDate || parsedContext?.endISO || currentProjectData?.endISO || currentProjectData?.endDate;
      let estimatedWeeks = 12;
      if (startISO && endISO) {
        const start = new Date(String(startISO));
        const end = new Date(String(endISO));
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
          estimatedWeeks = Math.max(4, Math.round((end - start) / (7 * 24 * 60 * 60 * 1000)));
        }
      }
      const weeklyLabor = laborBudget > 0 ? laborBudget / estimatedWeeks : 0;
      const weeklyOverhead = overheadBudget > 0 ? overheadBudget / estimatedWeeks : 0;
      const weeklyDelayCost = weeklyLabor + weeklyOverhead;
      const extraCostForWeeks = Math.round((weeklyDelayCost > 0 ? weeklyDelayCost : (laborBudget > 0 ? laborBudget / 12 : baseCost * 0.4 / 12)) * extraWeeks);
      const projectedCostWithOverrun = Math.round(baseCost + extraCostForWeeks);
      const projectedProfit = Math.round(contractVal - projectedCostWithOverrun);
      const marginPct = contractVal > 0 ? ((projectedProfit / contractVal) * 100).toFixed(1) : 0;
      const baselineProfit = Math.round(contractVal - baseCost);
      const costPerWeekOfDelay = weeklyDelayCost > 0 ? Math.round(weeklyDelayCost) : Math.round(laborBudget / Math.max(estimatedWeeks, 4));
      const breakEvenDelayWeeks = costPerWeekOfDelay > 0 && baselineProfit > 0 ? (baselineProfit / costPerWeekOfDelay).toFixed(1) : null;

      let reply = `If this job goes **${extraWeeks} weeks too long**, your projected profit would be approximately **$${projectedProfit.toLocaleString()}** (${marginPct}% margin).\n\n`;
      reply += `**Calculation:**\n`;
      if (startISO && endISO) {
        reply += `- Project duration: ~${estimatedWeeks} weeks (from schedule)\n`;
      }
      reply += `- Revenue (Contract Value): $${contractVal.toLocaleString()}\n`;
      reply += `- Base projected cost (at current pace): $${Math.round(baseCost).toLocaleString()}\n`;
      reply += `- Baseline profit: $${baselineProfit.toLocaleString()}\n`;
      const laborPortion = Math.round(weeklyLabor * extraWeeks);
      const overheadPortion = Math.round(weeklyOverhead * extraWeeks);
      if (laborPortion > 0) reply += `- Extra labor for ${extraWeeks} weeks: ~$${laborPortion.toLocaleString()}\n`;
      if (overheadPortion > 0) reply += `- Extra overhead for ${extraWeeks} weeks: ~$${overheadPortion.toLocaleString()}\n`;
      reply += `- **Total extra cost** (labor + overhead only; materials don't burn during delay): ~$${extraCostForWeeks.toLocaleString()}\n`;
      reply += `- **Total projected cost:** $${projectedCostWithOverrun.toLocaleString()}\n`;
      reply += `- **Projected profit:** $${contractVal.toLocaleString()} − $${projectedCostWithOverrun.toLocaleString()} = **$${projectedProfit.toLocaleString()}**\n\n`;
      if (costPerWeekOfDelay > 0) {
        reply += `**Profit decay:** Each additional week of delay costs approximately **$${costPerWeekOfDelay.toLocaleString()}** in labor + overhead, reducing profit by the same amount.\n`;
        if (breakEvenDelayWeeks && parseFloat(breakEvenDelayWeeks) > 0) {
          reply += `Break-even delay: **${breakEvenDelayWeeks} weeks** — after that you start losing money.\n\n`;
        } else {
          reply += `\n`;
        }
      }
      reply += `[DISCLAIMER]Materials are excluded from delay cost—they don't burn weekly. Only labor and overhead continue during extended weeks.[/DISCLAIMER]\n\n`;
      reply += `➡️ Want me to run a what-if scenario (materials +10%, labor +10%, or bad-remodel) to pressure-test this?`;

      console.log('✅ EARLY weeks-overrun profit projection — returning immediately');
      return res.json({ reply, actions: [] });
    }

    // NOTE: "Projected profit" / "Expected profit" no longer use early handler — they go to the full
    // isProfitOrForecastRequest block below for the detailed breakdown (baseline, optimistic/likely,
    // worst-case, key drivers).

    // Calculate material budget and remaining budget from available data
    let materialBudget = 0;
    let materialSpent = 0;
    let materialRemaining = 0;

    // === HIGHEST PRIORITY: Use pre-computed direct values from mobile app ===
    // These are computed client-side from live estimate/cart data and are always correct.
    // Skip all backend guessing if they are present.
    if (parsedContext.materialBudgetDirect > 0) {
      materialBudget = parsedContext.materialBudgetDirect;
      materialSpent = parsedContext.materialSpentDirect || 0;
      materialRemaining = Math.max(0, materialBudget - materialSpent);
      console.log('✅ AI Assistant: Using pre-computed direct budget values:', { materialBudget, materialSpent, materialRemaining });
    } else {
    
    // Get estimate data from currentProjectData or parsedContext
    const estimateData = currentProjectData?.estimateData || parsedContext.estimateData || currentProjectData?.projectData?.estimateData;
    
    // Try to get material budget from estimate data first
    if (estimateData) {
      // Calculate material budget from materialLineItems or materialsCart
      if (estimateData.materialLineItems && Array.isArray(estimateData.materialLineItems)) {
        materialBudget = estimateData.materialLineItems.reduce((sum, item) => {
          return sum + (Number(item.total) || Number(item.unitCost) * (Number(item.quantity) || 0) || 0);
        }, 0);
      } else if (estimateData.materialsCart && Array.isArray(estimateData.materialsCart)) {
        materialBudget = estimateData.materialsCart.reduce((sum, item) => {
          return sum + (Number(item.total) || 0);
        }, 0);
      }
    }
    
    // If no estimate data, try to get from buckets (budget breakdown)
    // IMPORTANT: parsedContext.buckets takes priority - it contains live computed values from the UI
    // currentProjectData?.buckets may have stale data from the project list
    if (materialBudget === 0) {
      const buckets = parsedContext.buckets || currentProjectData?.buckets || currentProjectData?.projectData?.buckets || [];
      if (Array.isArray(buckets) && buckets.length > 0) {
        materialBudget = buckets.reduce((sum, bucket) => {
          const bucketName = (bucket.name || '').toLowerCase();
          const isMaterialBucket = bucketName.includes('material') || 
                                   bucketName.includes('equipment') ||
                                   (bucketName.includes('materials') && !bucketName.includes('labor'));
          if (isMaterialBucket) {
            return sum + (Number(bucket.budget) || Number(bucket.bidBudget) || 0);
          }
          return sum;
        }, 0);
      }
    }
    
    // If still no budget, try to get from projectData nested structure
    if (materialBudget === 0 && currentProjectData) {
      // Check nested projectData structure
      const nestedProjectData = currentProjectData.projectData || currentProjectData.data;
      if (nestedProjectData) {
        const nestedBuckets = nestedProjectData.buckets || [];
        if (Array.isArray(nestedBuckets) && nestedBuckets.length > 0) {
          materialBudget = nestedBuckets.reduce((sum, bucket) => {
            const bucketName = (bucket.name || '').toLowerCase();
            const isMaterialBucket = bucketName.includes('material') || 
                                     bucketName.includes('equipment') ||
                                     (bucketName.includes('materials') && !bucketName.includes('labor'));
            if (isMaterialBucket) {
              return sum + (Number(bucket.budget) || Number(bucket.bidBudget) || 0);
            }
            return sum;
          }, 0);
        }
        
        // Also check nested estimateData
        if (materialBudget === 0 && nestedProjectData.estimateData) {
          const nestedEstimate = nestedProjectData.estimateData;
          if (nestedEstimate.materialLineItems && Array.isArray(nestedEstimate.materialLineItems)) {
            materialBudget = nestedEstimate.materialLineItems.reduce((sum, item) => {
              return sum + (Number(item.total) || Number(item.unitCost) * (Number(item.quantity) || 0) || 0);
            }, 0);
          } else if (nestedEstimate.materialsCart && Array.isArray(nestedEstimate.materialsCart)) {
            materialBudget = nestedEstimate.materialsCart.reduce((sum, item) => {
              return sum + (Number(item.total) || 0);
            }, 0);
          }
        }
      }
    }
    
    // Log what we found for debugging
    if (materialBudget === 0 && materialSpent > 0) {
      console.log('⚠️ AI Assistant: Material budget is $0 but material spent is $' + materialSpent.toFixed(2) + '. Budget data may be missing from context.', {
        hasEstimateData: !!estimateData,
        hasBuckets: !!(currentProjectData?.buckets || parsedContext.buckets),
        hasProjectData: !!currentProjectData,
        projectId,
        expensesCount: expenses.length
      });
    }
    
    // Calculate material spent from expenses (filter by material categories, exclude labor)
    if (Array.isArray(expenses)) {
      materialSpent = expenses.reduce((sum, exp) => {
        const category = (exp.category || '').toLowerCase();
        // Exclude labor, include materials and equipment
        const isMaterial = category !== 'labor' && 
                          !category.includes('labor') &&
                          (category.includes('material') || 
                           category.includes('equipment') ||
                           category.includes('materials') ||
                           // If category doesn't explicitly say labor, and it's not empty, assume material
                           (category && category.length > 0 && !category.includes('labor')));
        if (isMaterial) {
          return sum + (Number(exp.amount) || 0);
        }
        return sum;
      }, 0);
    }
    
    materialRemaining = Math.max(0, materialBudget - materialSpent);
    
    } // end else (fallback calculations when no direct values)
    
    // ── Calculate LABOR budget and spent ──
    let laborBudgetMain = Number(estimateData?.laborTotal || parsedContext?.laborTotal || currentProjectData?.laborTotal || 0);
    // Fallback: extract from buckets
    if (laborBudgetMain === 0) {
      const lBuckets = parsedContext.buckets || currentProjectData?.buckets || currentProjectData?.projectData?.buckets || [];
      if (Array.isArray(lBuckets)) {
        const laborBucket = lBuckets.find(b => (b.name || '').toLowerCase().includes('labor'));
        if (laborBucket) laborBudgetMain = Number(laborBucket.budget || laborBucket.bidBudget || 0);
      }
    }
    let laborSpentMain = 0;
    if (Array.isArray(expenses)) {
      laborSpentMain = expenses.reduce((sum, exp) => {
        const cat = (exp.category || '').toLowerCase();
        return cat.includes('labor') ? sum + (Number(exp.amount) || 0) : sum;
      }, 0);
    }
    const laborRemainingMain = Math.max(0, laborBudgetMain - laborSpentMain);
    
    console.log('🔧 Labor data for prompt:', { laborBudgetMain, laborSpentMain, laborRemainingMain });

    // ── DETERMINISTIC: Missing cost scan (bypass LLM text variability) ───────
    const msgLower = (message || '').toLowerCase();
    const isMissingCostScanRequest =
      msgLower.includes('missing cost') ||
      msgLower.includes('missing costs') ||
      (msgLower.includes('scan') && msgLower.includes('cost')) ||
      msgLower.includes('cost gaps') ||
      msgLower.includes('what am i missing');

    if (isMissingCostScanRequest) {
      const baseEstimateCost = Number(
        estimatedCost ||
        estimateData?.totalCost ||
        estimateData?.baseCost ||
        bidTotal ||
        0
      );

      const materialLineItems = Array.isArray(estimateData?.materialLineItems) ? estimateData.materialLineItems : [];
      const laborLineItems = Array.isArray(estimateData?.laborLineItems) ? estimateData.laborLineItems : [];
      const genericLineItems = Array.isArray(estimateData?.lineItems) ? estimateData.lineItems : [];

      const combinedText = [
        ...materialLineItems.map(i => `${i?.name || ''} ${i?.description || ''} ${i?.category || ''}`),
        ...laborLineItems.map(i => `${i?.name || ''} ${i?.description || ''} ${i?.trade || ''} ${i?.category || ''}`),
        ...genericLineItems.map(i => `${i?.name || ''} ${i?.description || ''} ${i?.category || ''}`)
      ].join(' ').toLowerCase();

      const hasKeyword = (arr) => arr.some(k => combinedText.includes(k));
      const hasMaterials = materialBudget > 0 || materialLineItems.length > 0 || hasKeyword(['material', 'equipment', 'lumber', 'tile', 'drywall']);
      const hasLabor = laborBudgetMain > 0 || laborLineItems.length > 0 || laborSpentMain > 0 || hasKeyword(['labor', 'framing', 'electrical', 'plumbing', 'paint']);
      const hasPermits =
        Number(estimateData?.permitCost || 0) > 0 ||
        Number(estimateData?.planCost || 0) > 0 ||
        hasKeyword(['permit', 'permits', 'inspection', 'plan', 'plans', 'plan check', 'city fee']);
      const hasOverhead =
        Number(estimateData?.overheadTotal || 0) > 0 ||
        Number(estimateData?.insuranceOverhead || 0) > 0 ||
        Number(estimateData?.facilities || 0) > 0 ||
        Number(estimateData?.equipment || 0) > 0 ||
        Number(estimateData?.otherOverhead || 0) > 0 ||
        hasKeyword(['overhead', 'insurance', 'supervision', 'mobilization']);
      const hasContingency =
        Number(estimateData?.contingency || 0) > 0 ||
        Number(estimateData?.contingencyAmount || 0) > 0 ||
        Number(estimateData?.contingencyPct || 0) > 0 ||
        hasKeyword(['contingency', 'allowance', 'unexpected']);
      const hasDeliveryOrDisposal = hasKeyword(['delivery', 'freight', 'shipping', 'dumpster', 'disposal', 'haul']);
      const hasTaxesOrFees = hasKeyword(['tax', 'sales tax', 'fee', 'processing fee']);

      const basis = baseEstimateCost > 0 ? baseEstimateCost : (bidTotal > 0 ? bidTotal : 0);
      const toRange = (minPct, maxPct) => ({
        min: Math.round(basis * minPct),
        max: Math.round(basis * maxPct),
      });

      const gaps = [];
      if (!hasMaterials) gaps.push({ title: 'Materials/Equipment line items', reason: 'No material/equipment scope found', range: toRange(0.18, 0.35) });
      if (!hasLabor) gaps.push({ title: 'Labor scope by trade', reason: 'No labor breakdown found', range: toRange(0.2, 0.4) });
      if (!hasPermits) gaps.push({ title: 'Plans & permits', reason: 'Plans/permit/inspection costs not found', range: toRange(0.01, 0.03) });
      if (!hasOverhead) gaps.push({ title: 'Overhead allocation', reason: 'Insurance/facilities/other overhead not found', range: toRange(0.06, 0.15) });
      if (!hasContingency) gaps.push({ title: 'Contingency reserve', reason: 'No contingency buffer found', range: toRange(0.05, 0.1) });
      if (!hasDeliveryOrDisposal) gaps.push({ title: 'Delivery, disposal, haul-away', reason: 'Logistics/waste costs not found', range: toRange(0.01, 0.04) });
      if (!hasTaxesOrFees) gaps.push({ title: 'Taxes & processing fees', reason: 'Tax/fee line items not found', range: toRange(0.01, 0.03) });

      const totalMin = gaps.reduce((s, g) => s + Number(g.range?.min || 0), 0);
      const totalMax = gaps.reduce((s, g) => s + Number(g.range?.max || 0), 0);
      const totalLineItems = materialLineItems.length + laborLineItems.length + genericLineItems.length;

      let reply = `✅ Scanned ${projectName ? `"${projectName}"` : 'this project'} for missing costs.\n\n`;
      reply += `📊 Estimate snapshot:\n`;
      reply += `- Line items found: ${totalLineItems}\n`;
      reply += `- Estimated Cost: $${Math.round(baseEstimateCost).toLocaleString()}\n`;
      reply += `- Actual Spent: $${Math.round(actualCost).toLocaleString()}\n\n`;

      if (basis === 0) {
        reply += `⚠️ I can't run a reliable gap scan yet because no estimate total or line items are in context.\n`;
        reply += `➡️ Add estimate line items first, then run "Scan for missing costs" again.`;
      } else if (gaps.length === 0) {
        reply += `✅ No obvious missing cost categories detected from current estimate data.\n`;
        reply += `➡️ Next best check: ask me to "Forecast final profit" to stress-test margin risk.`;
      } else {
        reply += `⚠️ Potential missing costs:\n`;
        gaps.forEach((g, i) => {
          reply += `${i + 1}. ${g.title} — ${g.reason} (impact: +$${g.range.min.toLocaleString()} to +$${g.range.max.toLocaleString()})\n`;
        });
        reply += `\n💰 Potential underestimation impact: +$${totalMin.toLocaleString()} to +$${totalMax.toLocaleString()}.\n`;
        reply += `[DISCLAIMER]Impact ranges are estimates based on typical project costs—not real-time market data.[/DISCLAIMER]\n\n`;
        reply += `➡️ Want me to add these as estimate line items now?`;
      }

      return res.json({ reply, actions: [] });
    }

    // ── DETERMINISTIC: Profit / Forecast (bypass LLM variability, use progress-adjusted logic) ─────────
    const isProfitOrForecastRequest =
      msgLower.includes('forecast final profit') ||
      msgLower.includes('forecast profit') ||
      msgLower.includes('final profit') ||
      msgLower.includes('forecast final cost') ||
      (msgLower.includes('forecast') && msgLower.includes('profit')) ||
      (msgLower.includes('forecast') && msgLower.includes('cost')) ||
      msgLower.includes('estimated profit') ||
      msgLower.includes('projected profit') ||
      msgLower.includes('expected profit') ||
      msgLower.includes('what is my profit') ||
      msgLower.includes('what\'s my profit') ||
      msgLower.includes('my profit on this job') ||
      (msgLower.includes('profit') && msgLower.includes('this job'));

    if (isProfitOrForecastRequest) {
      // Contract value = bid + approved COs (revenue we get paid)
      const contractValueFinal = Number(contractValue || 0) || (Number(bidTotal || 0) + Number(approvedChangeOrdersTotal || 0));
      // Pre-computed profit from mobile (matches Financial Health / Budget Totals UI) — use as primary when available
      const precomputedProfit = parsedContext.projectedProfit;
      const precomputedMargin = parsedContext.projectedMarginPct;
      const precomputedForecastCost = parsedContext.forecastFinalCost;
      const hasPrecomputed = precomputedProfit != null && Number.isFinite(Number(precomputedProfit));
      // baseEstimate = our cost to complete. If estimatedCost >= contractValue it's wrong (revenue, not cost)
      let baseEstimate = Number(estimatedCost || estimateData?.totalCost || estimateData?.baseCost || 0);
      if (baseEstimate >= contractValueFinal * 0.95) baseEstimate = 0; // Wrong: estimatedCost was set to revenue
      const actual = Number(actualCost || 0);
      const progressPct = Math.max(0, Math.min(100, Number(progress || 0)));
      const progressRatio = progressPct > 0 ? progressPct / 100 : 0;
      
      // Check for completed schedule/payment entries from all known timeline sources.
      // Some flows store deposit progress as payment milestones/weekly payments with status "paid".
      const scheduleItems = [
        ...(Array.isArray(parsedContext.milestones) ? parsedContext.milestones : []),
        ...(Array.isArray(parsedContext.weeklyPayments) ? parsedContext.weeklyPayments : []),
        ...(Array.isArray(parsedContext.paymentMilestones) ? parsedContext.paymentMilestones : []),
        ...(Array.isArray(parsedContext?.estimateData?.weeklyPayments) ? parsedContext.estimateData.weeklyPayments : []),
        ...(Array.isArray(parsedContext?.estimateData?.paymentMilestones) ? parsedContext.estimateData.paymentMilestones : []),
        ...(Array.isArray(currentProjectData?.milestones) ? currentProjectData.milestones : []),
        ...(Array.isArray(currentProjectData?.timelineItems) ? currentProjectData.timelineItems : []),
        ...(Array.isArray(currentProjectData?.weeklyPayments) ? currentProjectData.weeklyPayments : []),
        ...(Array.isArray(currentProjectData?.paymentMilestones) ? currentProjectData.paymentMilestones : []),
        ...(Array.isArray(currentProjectData?.estimateData?.weeklyPayments) ? currentProjectData.estimateData.weeklyPayments : []),
        ...(Array.isArray(currentProjectData?.estimateData?.paymentMilestones) ? currentProjectData.estimateData.paymentMilestones : []),
        ...(Array.isArray(currentProjectData?.projectData?.milestones) ? currentProjectData.projectData.milestones : []),
        ...(Array.isArray(currentProjectData?.projectData?.timelineItems) ? currentProjectData.projectData.timelineItems : []),
      ];
      const hasCompletedMilestones = scheduleItems.some((item) => {
        const status = String(item?.status || '').toLowerCase();
        const progressPctRaw = Number(item?.progressPct ?? item?.progress ?? 0);
        const isCompletedStatus =
          status.includes('complete') ||
          status.includes('paid') ||
          status.includes('collected') ||
          status.includes('received');
        return (
          isCompletedStatus ||
          progressPctRaw >= 100 ||
          item?.isComplete === true ||
          item?.completed === true ||
          item?.isPaid === true ||
          item?.paid === true ||
          item?.collected === true
        );
      });
      const committedPOs = Number(parsedContext.committedPOs || currentProjectData?.committedPOs || 0);
      const unreceivedPOs = Array.isArray(currentProjectData?.purchaseOrders)
        ? currentProjectData.purchaseOrders
            .filter(po => (po?.status || '').toLowerCase() === 'pending')
            .reduce((sum, po) => sum + Number(po?.amount || 0), 0)
        : 0;
      const committedNotInActual = Math.max(committedPOs, unreceivedPOs);

      // Burn-rate-based forecast when progress exists; otherwise fallback to estimate baseline.
      let likelyFinalCost = 0;
      let forecastMethod = '';
      if (progressRatio > 0.01 && actual > 0) {
        const cpiForecast = actual / progressRatio; // EAC using CPI
        const remainingByEstimate = Math.max(0, baseEstimate - actual);
        const blended = (cpiForecast * 0.7) + ((actual + remainingByEstimate) * 0.3);
        likelyFinalCost = Math.max(actual, blended, actual + committedNotInActual);
        forecastMethod = 'progress-adjusted burn rate (CPI blend)';
      } else if (baseEstimate > 0) {
        likelyFinalCost = Math.max(actual + committedNotInActual, baseEstimate);
        forecastMethod = 'estimate baseline (insufficient progress data)';
      } else {
        likelyFinalCost = actual + committedNotInActual;
        forecastMethod = 'actuals + committed costs only (no estimate baseline)';
      }

      // Simple risk band: best / likely / worst
      const costRiskPct =
        progressRatio > 0.01
          ? (actual > (baseEstimate * progressRatio * 1.1) ? 0.12 : 0.08)
          : 0.1;
      const optimisticFinalCost = Math.max(actual, likelyFinalCost * (1 - costRiskPct));
      const conservativeFinalCost = likelyFinalCost * (1 + costRiskPct);

      // Use pre-computed values from mobile when available (matches UI)
      const likelyFinalCostUse = hasPrecomputed && precomputedForecastCost != null ? Number(precomputedForecastCost) : likelyFinalCost;
      const likelyProfitUse = hasPrecomputed ? Number(precomputedProfit) : (contractValueFinal - likelyFinalCost);
      const likelyMarginPctUse = hasPrecomputed && precomputedMargin != null ? Number(precomputedMargin) : (contractValueFinal > 0 ? ((contractValueFinal - likelyFinalCost) / contractValueFinal) * 100 : 0);

      const likelyProfit = hasPrecomputed ? likelyProfitUse : (contractValueFinal - likelyFinalCost);
      const optimisticProfit = contractValueFinal - optimisticFinalCost;
      const conservativeProfit = contractValueFinal - conservativeFinalCost;

      const optimisticDelta = optimisticFinalCost - contractValueFinal;
      const likelyDelta = likelyFinalCostUse - contractValueFinal;
      const conservativeDelta = conservativeFinalCost - contractValueFinal;
      const fmtDelta = (delta) => {
        if (Math.abs(delta) < 1) return 'On budget';
        return delta > 0
          ? `Over budget by $${Math.round(delta).toLocaleString()}`
          : `Under budget by $${Math.round(Math.abs(delta)).toLocaleString()}`;
      };

      const likelyMarginPct = likelyMarginPctUse;
      const optimisticMarginPct = contractValueFinal > 0 ? (optimisticProfit / contractValueFinal) * 100 : 0;
      const conservativeMarginPct = contractValueFinal > 0 ? (conservativeProfit / contractValueFinal) * 100 : 0;

      const drivers = [];
      if (committedNotInActual > 0) drivers.push(`$${Math.round(committedNotInActual).toLocaleString()} in committed POs may convert to actual costs.`);
      if (laborBudgetMain > 0 && laborSpentMain / laborBudgetMain > 0.75) {
        drivers.push(`Labor burn is high (${Math.round((laborSpentMain / laborBudgetMain) * 100)}% used).`);
      }
      if (materialBudget > 0 && materialSpent / materialBudget > 0.75) {
        drivers.push(`Material burn is high (${Math.round((materialSpent / materialBudget) * 100)}% used).`);
      }
      if (drivers.length === 0) drivers.push('Current burn appears consistent with the budget baseline.');

      const isSimpleProfitQ = /estimated profit|projected profit|expected profit|what is my profit|what'?s my profit|my profit on this job|profit on this job/i.test(msgLower) && !msgLower.includes('forecast');
      let reply = '';
      if (isSimpleProfitQ && contractValueFinal > 0) {
        reply += `Your **estimated profit** on this job is approximately **$${Math.round(likelyProfit).toLocaleString()}**.\n\n`;
        reply += `Based on your progress (${progressPct.toFixed(0)}% complete) and actual spend ($${Math.round(actual).toLocaleString()}), your projected cost at completion is ~$${Math.round(likelyFinalCostUse).toLocaleString()}. Revenue (Contract Value) is $${Math.round(contractValueFinal).toLocaleString()}, so profit = $${Math.round(contractValueFinal).toLocaleString()} − $${Math.round(likelyFinalCostUse).toLocaleString()} = **$${Math.round(likelyProfit).toLocaleString()}** (${likelyMarginPct.toFixed(1)}% margin).${hasPrecomputed ? ' These numbers match the Financial Health and Budget Totals in the app.' : ''}\n\n`;
      }
      reply += `📈 Forecast final cost & profit for ${projectName ? `"${projectName}"` : 'this project'}:\n\n`;
      reply += `📊 Baseline:\n`;
      reply += `- Contract Value (Bid + approved COs): $${Math.round(contractValueFinal).toLocaleString()}\n`;
      reply += `- Estimated Cost Baseline: $${Math.round(baseEstimate).toLocaleString()}\n`;
      reply += `- Actual Spent to Date: $${Math.round(actual).toLocaleString()}\n`;
      reply += `- Progress: ${progressPct.toFixed(0)}%\n`;
      reply += `- Method: ${forecastMethod}\n\n`;

      reply += `💰 Forecast (EAC):\n`;
      reply += `- Optimistic Final Cost: $${Math.round(optimisticFinalCost).toLocaleString()} (${fmtDelta(optimisticDelta)}) → Profit: $${Math.round(optimisticProfit).toLocaleString()} (${optimisticMarginPct.toFixed(1)}%)\n`;
      reply += `- Likely Final Cost: $${Math.round(likelyFinalCostUse).toLocaleString()} (${fmtDelta(likelyDelta)}) → Profit: $${Math.round(likelyProfit).toLocaleString()} (${likelyMarginPct.toFixed(1)}%)${hasPrecomputed ? ' ← matches app UI' : ''}\n`;
      reply += `- Worst-case (risk-adjusted) Final Cost: $${Math.round(conservativeFinalCost).toLocaleString()} (${fmtDelta(conservativeDelta)}) → Profit: $${Math.round(conservativeProfit).toLocaleString()} (${conservativeMarginPct.toFixed(1)}%)\n\n`;

      reply += `⚠️ Key drivers:\n`;
      drivers.slice(0, 3).forEach((d, i) => {
        reply += `${i + 1}. ${d}\n`;
      });
      reply += `\n[DISCLAIMER]Forecasts are projections based on current burn rate and progress—not guarantees of actual final cost or profit.[/DISCLAIMER]\n\n`;
      reply += `➡️ Want me to run a what-if scenario (materials +10%, labor +10%, or bad-remodel) to pressure-test this forecast?`;

      return res.json({ reply, actions: [] });
    }
    
    const isEstimate = ['estimate', 'draft', 'bid_submitted', 'submitted'].includes(status.toLowerCase());
    const isActiveProject = ['won', 'active', 'in_progress', 'in-progress', 'completed'].includes(status.toLowerCase());

    // ── BUILD SYSTEM PROMPT using modular prompt system ──
    const pmAlerts = aiPmMode ? runProactiveIntelligence(parsedContext) : [];
    const teamMembers = parsedContext.teamMembers || [];
    const teamStats = parsedContext.teamStats || { total: 0, active: 0, offDuty: 0 };
    const calendarEvents = parsedContext.calendarEvents || [];
    const upcomingCalendarEvents = parsedContext.upcomingCalendarEvents || [];
    let systemPrompt = buildSystemPrompt({
      projectName, projectId, status,
      bidTotal, estimatedCost, actualCost,
      contractValue, approvedChangeOrdersTotal,
      materialBudget, materialSpent, materialRemaining,
      laborBudget: laborBudgetMain, laborSpent: laborSpentMain, laborRemaining: laborRemainingMain,
      progress, aiPmMode, pmAlerts,
      screen: parsedContext.screen || 'assistant_tab',
      teamMembers,
      teamStats,
      calendarEvents,
      upcomingCalendarEvents,
    });

    // Additive: projects-list intelligence block (Global AI Assistant + Projects screen).
    const screenForIntelligence = (parsedContext?.screen || '').toLowerCase();
    if (screenForIntelligence === 'projects' || screenForIntelligence === 'ai assistant tab') {
      const listAlerts = runProjectsListIntelligence(parsedContext);
      if (listAlerts.length > 0) {
        systemPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 PORTFOLIO INTELLIGENCE (grounded in real data — use these numbers)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${listAlerts.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nRULES:\n→ Use these alerts as your source of truth for financial data — every number you cite must come from here or from tool results\n→ When user asks about portfolio health, profitability, or risks — reference these alerts directly\n→ Surface relevant insights proactively when they relate to the user's question\n→ When answering, always structure as: direct answer → supporting insight → suggested action\n→ Connect financial data to actionable recommendations\n→ If request is project-specific and ambiguous, ask one clear follow-up question\n→ Never dump all alerts at once — pick the most relevant ones for the user's question`;
      }

      // Inject calendar events from all projects into Command Center context
      const portfolioCalendarEvents = [];
      const allProjectsForCalendar = parsedContext?.allProjects || [];
      allProjectsForCalendar.forEach(p => {
        const pTitle = p?.title || p?.name || 'Project';
        const events = p?.calendarEvents || p?.projectData?.calendarEvents || [];
        events.forEach(ev => {
          if (ev.completed) return;
          const evDate = new Date(ev.date || 0);
          if (!Number.isFinite(evDate.getTime())) return;
          const daysUntil = Math.ceil((evDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntil >= -1 && daysUntil <= 7) {
            portfolioCalendarEvents.push({ ...ev, projectName: pTitle, daysUntil });
          }
        });
      });
      if (portfolioCalendarEvents.length > 0) {
        portfolioCalendarEvents.sort((a, b) => a.daysUntil - b.daysUntil);
        const calItems = portfolioCalendarEvents.slice(0, 8).map((ev, i) => {
          const dateStr = new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const timeStr = ev.time ? ` at ${ev.time}` : '';
          const dayLabel = ev.daysUntil === 0 ? 'Today' : ev.daysUntil === 1 ? 'Tomorrow' : `${ev.daysUntil} days`;
          return `${i + 1}. ${ev.title || ev.type || 'Event'} (${ev.projectName}) — ${dateStr}${timeStr} (${dayLabel})`;
        }).join('\n');
        systemPrompt += `\n\n📅 UPCOMING EVENTS (across all projects):\n${calItems}\n→ Mention relevant events when they relate to the user's question or project`;
      }
    }

    // Inject conversation memory
    const memoryBlock = buildMemoryContext(session);
    if (memoryBlock) systemPrompt += memoryBlock;

    // Build messages array from history + new message
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.filter(m => m.role && m.content),
      { role: 'user', content: message },
    ];

    // ── Tool allowlist: PM OFF = 4 core tools, PM ON = 4 core + timeline + estimates ──
    const coreTools = [
      {
        type: 'function',
        function: {
          name: 'get_project_by_name',
          description: `Look up a project by name to get its ID and status. Use this when user mentions a project name but you don't have projectId in context.`,
          parameters: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                description: 'The name of the project to look up.',
              },
            },
            required: ['projectName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'compare_projects',
          description: 'Compare projects for profitability, budget exposure, schedule risk, and progress. Use for questions like "most profitable", "most over budget", "which project is behind", or "compare Chris vs Nick".',
          parameters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                description: 'Optional status filter (e.g., active, won, estimate, completed).',
              },
              dateRange: {
                type: 'string',
                description: 'Optional date range hint like "30d", "90d", "this-month".',
              },
              projectNames: {
                type: 'array',
                description: 'Optional list of project names to compare directly.',
                items: { type: 'string' },
              },
              sortBy: {
                type: 'string',
                description: 'Optional sort key: margin | overBudget | progress | risk.',
                enum: ['margin', 'overBudget', 'progress', 'risk'],
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_project_health',
          description: 'Get a comprehensive health check for a specific project. Returns budget status, margin, risks, expense breakdown, overdue items, and recommendations. Use when user asks "how is [project] doing?", "health check on [project]", "status of [project]", or "review [project]".',
          parameters: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                description: 'The name of the project to check.',
              },
            },
            required: ['projectName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'forecast_profit',
          description: 'Forecast final cost, profit, and margin for one or all projects based on current spending rate. Use when user asks "forecast profit", "projected profit", "how much will I make", "what will the final cost be", "am I on track to make money".',
          parameters: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                description: 'Optional project name. If omitted, forecasts all projects.',
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'analyze_expenses',
          description: 'Break down expenses by category, vendor, and time period for one or all projects. Use when user asks "show expenses", "expense breakdown", "where am I spending", "biggest expenses", "who am I paying the most".',
          parameters: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                description: 'Optional project name. If omitted, analyzes all projects.',
              },
              groupBy: {
                type: 'string',
                description: 'How to group expenses: category, vendor, or month.',
                enum: ['category', 'vendor', 'month'],
              },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'add_purchase_order',
          description: `**REQUIRED FUNCTION** - Create a purchase order (PO) for a project. You MUST call this function when user says "purchase order", "PO", "order", "place an order", "create a PO", or asks you to add/create/record a purchase order. DO NOT just respond with text saying you recorded it - you MUST call this function first. Purchase orders start as "Pending" and show in "Committed POs" in the budget. When received, they convert to actual expenses. **CRITICAL: DO NOT call this function when user says "mark as received" - use mark_purchase_order_received instead.**`,
          parameters: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: `The project ID where the purchase order should be added. ${projectId ? `CRITICAL: You MUST use "${projectId}" - this is the current project ID from context. DO NOT leave this empty.` : 'If not in context, you may need to use get_project_by_name first.'}`,
              },
              amount: {
                type: 'number',
                description: 'The amount of the purchase order in dollars. Extract ANY number from the user\'s message (e.g., "500", "$500", "for $500", "500 dollars"). **CRITICAL: If the user did NOT provide any number in their message, DO NOT call this function - you MUST ask "How much is the purchase order for?" first and wait for their response. NEVER use $350, $500, $1000, or any other placeholder amounts. NEVER guess, NEVER assume, NEVER invent amounts. If the user says "Create me a purchase order" without an amount, ask "How much is the purchase order for?" first. Required.',
              },
              vendor: {
                type: 'string',
                description: 'The vendor or supplier for the purchase order. Extract from user message if mentioned. REQUIRED - if missing, ask "Which vendor is this from?"',
              },
              category: {
                type: 'string',
                description: 'The category for the purchase order (e.g., "Materials/Equipment", "Labor"). If unclear, ask "What category is this for?"',
              },
              description: {
                type: 'string',
                description: 'Description of what is being ordered. Optional but recommended.',
              },
              expectedDelivery: {
                type: 'string',
                description: 'Expected delivery date in ISO format (YYYY-MM-DD). REQUIRED - you MUST ask the user "What is the expected delivery or received date?" if not provided. Do not create the PO without this date.',
              },
            },
            required: projectId ? ['amount', 'vendor', 'category', 'expectedDelivery', 'projectId'] : ['amount', 'vendor', 'category', 'expectedDelivery'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'add_material_expense',
          description: `Add a material expense transaction to a project. Use when user says "spent", "bought", "purchased", "paid", "expense". Creates an expense entry that appears in "Material Transactions". DO NOT use this for purchase orders - use add_purchase_order instead.`,
          parameters: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: `The project ID where the expense should be added. ${projectId ? `CRITICAL: You MUST use "${projectId}" - this is the current project ID from context. DO NOT leave this empty.` : 'If not in context, you may need to use get_project_by_name first.'}`,
              },
              amount: {
                type: 'number',
                description: 'The amount of the expense in dollars. Extract ANY number from the user\'s message. Examples: "add 500" → 500, "500 material" → 500, "$500" → 500, "spent 500" → 500, "Let\'s add 500 material spent" → 500. If there is ANY number in the message, that is the amount. Required.',
              },
              category: {
                type: 'string',
                description: 'The expense category/type (REQUIRED). For labor expenses: use "Labor". For materials: use the material name (e.g., "lumber" → "Lumber", "tile" → "Tile", "drywall" → "Drywall"). Extract from user message - if they say "labor", "labor expense", "for labor" → use "Labor". If unclear, ask "What is this for?"',
              },
              vendor: {
                type: 'string',
                description: 'For MATERIALS: the vendor/store (e.g., "Home Depot", "Lowe\'s"). REQUIRED - ask "Where was it purchased?" if missing. For LABOR: the sub/trade (e.g., "General Labor", "Framing", "Plumbing", "Electrical"). When user says "general labor", "it\'s general labor", or a trade name in response to vendor question, use that as vendor - do NOT ask again. The vendor field displays as "Sub/Trade" for labor.',
              },
              notes: {
                type: 'string',
                description: 'Additional notes about the expense. For LABOR expenses, this is REQUIRED - ask "What was the labor expense for?" (e.g., "framing", "drywall installation", "painting") and put the answer in notes. For materials, this is optional.',
              },
              projectInfo: {
                type: 'object',
                description: 'Full project details from context, used to create the project on the backend if it does not exist.',
                properties: {
                  title: { type: 'string' },
                  name: { type: 'string' },
                  client: { type: 'string' },
                  customerName: { type: 'string' },
                  location: { type: 'string' },
                  bidTotal: { type: 'number' },
                  total: { type: 'number' },
                  estimatedCost: { type: 'number' },
                  bidPrice: { type: 'number' },
                  status: { type: 'string' },
                  startDate: { type: 'string' },
                  endDate: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
            required: projectId ? ['amount', 'category', 'projectId', 'vendor'] : ['amount', 'category', 'vendor'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'mark_purchase_order_received',
          description: `**REQUIRED FUNCTION** - Mark a purchase order as received. You MUST call this function when user says "mark as received", "mark PO as received", "mark this as received", "can you mark as received", "received", "got it", "delivered", or asks to mark a purchase order as received. When a PO is marked as received, it moves from "Committed POs" to "Actual Expenses" in the budget. If the user doesn't specify which PO, find the most recent Pending purchase order from the conversation. **CRITICAL: DO NOT call add_purchase_order when user says "mark as received" - call this function instead.**`,
          parameters: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: `The project ID where the purchase order exists. ${projectId ? `CRITICAL: You MUST use "${projectId}" - this is the current project ID from context. DO NOT leave this empty.` : 'If not in context, you may need to use get_project_by_name first.'}`,
              },
              poNumber: {
                type: 'string',
                description: 'The purchase order number (e.g., "PO-878156", "PO-971327"). Extract from user message or conversation history. If user mentions an amount (e.g., "$250", "$600"), find the PO with that amount. If user just says "mark as received" without specifying, find the most recent Pending PO. If not found, you can leave empty and the function will find the most recent Pending PO automatically.',
              },
            },
            required: projectId ? ['projectId'] : [],
          },
        },
      },
      // ── CHANGE ORDER (always available, not PM-only) ──────────────────────────
      {
        type: 'function',
        function: {
          name: 'create_change_order',
          description: 'Create a change order for a project. Use when user says "client wants to add...", "scope change", "change order for...", "add a change order". This creates the CO, adjusts the budget, and optionally adds a payment milestone. IMPORTANT: Change orders do NOT need an expected delivery date or received date — NEVER ask for one.',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}` },
              description: { type: 'string', description: 'Description of the scope change (e.g., "Concrete", "Add half bathroom to master suite"). REQUIRED.' },
              amount: { type: 'number', description: 'Cost of the change order in dollars. REQUIRED. Extract ANY number from the user message as the amount.' },
              vendor: { type: 'string', description: 'Vendor or supplier for the change order (e.g., "Home Depot", "ABC Supply"). REQUIRED — ask the user if not provided.' },
              addPaymentMilestone: { type: 'boolean', description: 'Whether to add a payment milestone for this CO. Default false. Only set to true if the user explicitly asks to add a payment milestone or payment schedule.' },
              markupPct: { type: 'number', description: 'Markup percentage to apply to the CO cost. Defaults to the project markup (e.g., 20%).' },
            },
            required: ['description', 'amount', 'vendor'],
          },
        },
      },
      // ── PAYMENT COLLECTION (always available) ───────────────────────────────
      {
        type: 'function',
        function: {
          name: 'mark_payment_collected',
          description: 'Mark a payment milestone as collected from the client. Use when user says "got paid", "payment collected", "client paid", "received payment", "collected deposit", "mark payment as collected". CRITICAL: First check available milestones from context.milestones or call get_timeline_items to see pending payment milestones. Match by milestone name (e.g., "Week 1 Payment", "Deposit") - use partial/fuzzy matching. If user doesn\'t specify which milestone, list available pending milestones and ask them to choose.',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}` },
              milestoneId: { type: 'string', description: 'The ID of the payment milestone (optional - will be found from milestoneName if not provided).' },
              milestoneName: { type: 'string', description: 'The name of the milestone to mark as collected (e.g., "Week 1 Payment", "Deposit", "Payment 1"). REQUIRED. Match against available milestones from context or get_timeline_items. Use partial matching - "week 1" matches "Week 1 Payment".' },
              amount: { type: 'number', description: 'Amount collected. If different from the milestone amount (optional - will use milestone amount if not provided).' },
              collectedAt: { type: 'string', description: 'Date collected in ISO format. Defaults to now.' },
            },
            required: ['milestoneName'],
          },
        },
      },
      // ── TEAM MESSAGING TOOLS (always available) ────────────────────────────
      {
        type: 'function',
        function: {
          name: 'message_team_member',
          description: 'Send an SMS text message to a specific team member. Use when user wants to message, text, or contact a team member by name. Find the team member in context.teamMembers by matching their name (case-insensitive).',
          parameters: {
            type: 'object',
            properties: {
              teamMemberName: {
                type: 'string',
                description: 'The name of the team member to message. Match this against context.teamMembers list (case-insensitive). REQUIRED.',
              },
              messageContent: {
                type: 'string',
                description: 'The message content to send to the team member. REQUIRED.',
              },
            },
            required: ['teamMemberName', 'messageContent'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'notify_team',
          description: 'Send an SMS text message to all active team members (bulk notification). Use when user wants to notify the team, send an announcement, or message everyone.',
          parameters: {
            type: 'object',
            properties: {
              messageContent: {
                type: 'string',
                description: 'The message content to send to all active team members. REQUIRED.',
              },
            },
            required: ['messageContent'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'assign_pm',
          description: 'Assign a project manager (PM) to the current project. Use when user says "assign PM", "assign project manager", "name a project manager", "pick a PM", "choose a project manager for me", "can you name a project manager", "assign [name] as PM", "set [name] as project manager".',
          parameters: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: `The project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}`,
              },
              pmName: {
                type: 'string',
                description: 'The name of the person to assign as project manager. REQUIRED. Extract from user message or ask "Who would you like to assign as project manager?"',
              },
            },
            required: ['projectId', 'pmName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'add_team_member',
          description: 'Add a new team member to the project. Use when user says "add team member", "add [name] to the team", "add a crew member". Always ask for phone number before confirming.',
          parameters: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: `The project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}`,
              },
              name: {
                type: 'string',
                description: 'The name of the team member to add. REQUIRED.',
              },
              phone: {
                type: 'string',
                description: 'Phone number for the team member. Ask "What is the phone number for [name]?" if not provided.',
              },
              role: {
                type: 'string',
                description: 'Role/trade (e.g., "Crew Member", "Foreman", "Electrician"). Optional, defaults to "Crew Member".',
              },
            },
            required: ['projectId', 'name'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'update_team_member_status',
          description: 'Update a team member\'s status to active or off duty. Use when user says "turn [name] off duty", "make [name] active", "change [name] to off duty", "set [name] to active", "can you turn [name] team member to off duty", etc. You CAN change team member statuses - use this tool.',
          parameters: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: `The project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}`,
              },
              memberName: {
                type: 'string',
                description: 'The name of the team member to update (e.g., "Nicholas", "John Smith"). REQUIRED.',
              },
              status: {
                type: 'string',
                description: 'The new status: "active" or "off_duty". REQUIRED.',
                enum: ['active', 'off_duty'],
              },
            },
            required: ['projectId', 'memberName', 'status'],
          },
        },
      },
    ];

    // ── PM Mode extended tools: timeline + estimates ──────────────────────────
    const pmTools = aiPmMode ? [
      {
        type: 'function',
        function: {
          name: 'get_timeline_items',
          description: 'Get the timeline/milestone items for the current project. Use when user asks about milestones, schedule, what tasks are left, what\'s next, or progress.',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}` },
            },
            required: projectId ? [] : ['projectId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'mark_timeline_item_complete',
          description: 'Mark a milestone as complete OR update its progress percentage. Use when user says "mark [item] complete", "done with [phase]", "framing is 50% done", "update progress to 75%".',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}` },
              itemId: { type: 'string', description: 'The ID of the milestone/timeline item. Get this from get_timeline_items first if needed.' },
              itemName: { type: 'string', description: 'The name/title of the item (used for display if itemId is unknown).' },
              progressPct: { type: 'number', description: 'Progress percentage 0-100. If set to 100, the item is marked complete. If user says "halfway done" use 50, "almost done" use 90, etc.' },
              completedAt: { type: 'string', description: 'ISO date string for completion. Defaults to now if progress is 100.' },
            },
            required: ['itemName'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'add_timeline_payment',
          description: 'Add a payment milestone to the project timeline. Use when user says "add payment", "schedule a payment", "add milestone payment".',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}` },
              title: { type: 'string', description: 'Name/title of the payment milestone (e.g., "Payment 1 - Deposit", "Final Payment").' },
              amount: { type: 'number', description: 'Payment amount in dollars.' },
              dueDate: { type: 'string', description: 'Due date in ISO format (YYYY-MM-DD).' },
            },
            required: ['title', 'amount'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_estimate',
          description: 'Get the estimate line items for the current project. Use when user asks "show estimate", "what\'s in the estimate?", "show line items", "what materials are in the bid?".',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}` },
            },
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'add_estimate_line_item',
          description: 'Add a line item to the project estimate. Use when user says "add [item] to the estimate", "put [item] on the bid", "add line item".',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}` },
              name: { type: 'string', description: 'Name/description of the line item (e.g., "Drywall", "Framing Labor").' },
              qty: { type: 'number', description: 'Quantity. Default 1 if not specified.' },
              unitCost: { type: 'number', description: 'Cost per unit in dollars.' },
              category: { type: 'string', description: 'Category: "Materials/Equipment" or "Labor". Infer from context.' },
            },
            required: ['name', 'unitCost'],
          },
        },
      },
      // ── SCENARIO + CHANGE ORDER TOOLS ──────────────────────────────────────
      {
        type: 'function',
        function: {
          name: 'run_scenario_analysis',
          description: 'Run a what-if scenario analysis on the project using the project\'s EXISTING budget, materials, labor, and overhead data from context. The tool automatically uses the current project financials - you do NOT need to provide dollar amounts. Use when user asks "what if materials go up 10%?", "what if labor increases?", "bad remodel scenario", "smooth job scenario", "what happens if costs rise?". Preset scenarios (typical_friction, bad_remodel, smooth_job) have predefined percentage adjustments - just pass the scenario name.',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Optional - will use current project from context if not provided.'}` },
              scenario: { type: 'string', enum: ['labor_up_10', 'labor_down_10', 'materials_up_5', 'materials_up_10', 'materials_down_5', 'overhead_up_10', 'overhead_down_10', 'bid_up_2', 'bid_down_2', 'typical_friction', 'bad_remodel', 'smooth_job', 'custom'], description: 'The scenario to run. Preset scenarios (typical_friction, bad_remodel, smooth_job) have predefined percentage adjustments built-in. Use "custom" only for arbitrary adjustments. REQUIRED - this is the ONLY required field.' },
              customAdjustments: {
                type: 'object',
                description: 'For "custom" scenario only. Specify percentage changes.',
                properties: {
                  laborPctChange: { type: 'number', description: 'Labor cost % change (e.g., 15 means +15%)' },
                  materialsPctChange: { type: 'number', description: 'Materials cost % change' },
                  overheadPctChange: { type: 'number', description: 'Overhead cost % change' },
                  bidPctChange: { type: 'number', description: 'Bid price % change' },
                },
              },
            },
            required: ['scenario'],
          },
        },
      },
      // ── AI ESTIMATE GENERATOR ──────────────────────────────────────────────
      {
        type: 'function',
        function: {
          name: 'generate_estimate',
          description: 'Generate a full project estimate with materials, labor, overhead, and markup from a description. Use when user says "create an estimate for...", "bid a kitchen remodel", "estimate a bathroom renovation", "how much would it cost to...".',
          parameters: {
            type: 'object',
            properties: {
              projectType: { type: 'string', enum: ['kitchen', 'bathroom', 'room_addition', 'home_addition', 'new_build', 'landscaping', 'other'], description: 'Type of project. Infer from description.' },
              squareFootage: { type: 'number', description: 'Square footage if mentioned. Required for accurate pricing.' },
              description: { type: 'string', description: 'Full description of the scope of work. Include all details the user mentioned.' },
              quality: { type: 'string', enum: ['budget', 'mid_range', 'high_end', 'luxury'], description: 'Quality tier. Default "mid_range". Infer from context — "basic" = budget, "nice"/"good" = mid_range, "high end"/"premium" = high_end, "luxury"/"custom" = luxury.' },
              location: { type: 'string', description: 'City/state or ZIP code for regional pricing if mentioned.' },
              markupPct: { type: 'number', description: 'Desired markup percentage. Default 20.' },
            },
            required: ['projectType', 'description'],
          },
        },
      },
      // ── EXPENSE + LOG TOOLS ──────────────────────────────────────────────────
      {
        type: 'function',
        function: {
          name: 'add_labor_expense',
          description: 'Add a labor expense to the project. Use when user says "labor expense", "paid crew", "labor cost", "paid for framing", etc. More specific than add_material_expense for labor tracking.',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}` },
              amount: { type: 'number', description: 'The labor cost in dollars. REQUIRED.' },
              trade: { type: 'string', description: 'The trade/skill (e.g., "Framing", "Electrical", "Plumbing", "General Labor", "Painting"). REQUIRED.' },
              description: { type: 'string', description: 'Description of the work performed (e.g., "Install drywall in master bedroom"). REQUIRED.' },
              date: { type: 'string', description: 'Date of the work in YYYY-MM-DD format. Defaults to today.' },
              workerName: { type: 'string', description: 'Name of worker or subcontractor if mentioned.' },
            },
            required: ['amount', 'trade', 'description'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'add_daily_log',
          description: 'Add a daily job log / site note to the project. Use when user says "daily log", "job log", "site note", "add note", "log for today", "record what happened".',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}` },
              noteText: { type: 'string', description: 'The log entry text. Capture what the user said about the day\'s work.' },
              date: { type: 'string', description: 'Date for the log in YYYY-MM-DD. Defaults to today.' },
              weather: { type: 'string', description: 'Weather conditions if mentioned (e.g., "sunny", "rain delay").' },
              crewCount: { type: 'number', description: 'Number of workers on site if mentioned.' },
              hoursWorked: { type: 'number', description: 'Hours worked if mentioned.' },
            },
            required: ['noteText'],
          },
        },
      },
    ] : [];

    // Final tool list: core always included, PM tools added when mode is on
    const functions = [...coreTools, ...pmTools];

    // Helper function to execute get_project_by_name (enhanced fuzzy matching, additive)
    async function executeGetProjectByName(args) {
      try {
        if (!args.projectName) {
          return { success: false, error: 'Project name is required' };
        }

        if (!allProjects || !Array.isArray(allProjects) || allProjects.length === 0) {
          return {
            success: false,
            error: `Could not find a project named "${args.projectName}". Please check the project name and try again.`,
          };
        }

        const searchName = String(args.projectName || '').toLowerCase().trim();
        const searchTokens = searchName.split(/\s+/).filter(Boolean);
        const scoreCandidate = (p) => {
          const title = String(p?.title || p?.name || '').toLowerCase().trim();
          const customer = String(p?.customerName || p?.client || '').toLowerCase().trim();
          const locationText = String(p?.location || '').toLowerCase().trim();
          const corpus = `${title} ${customer} ${locationText}`.trim();
          const corpusTokens = corpus.split(/\s+/).filter(Boolean);
          let score = 0;
          if (!corpus) return { score, title };

          if (title === searchName || customer === searchName) score += 100;
          if (title.includes(searchName) || customer.includes(searchName)) score += 65;
          if (searchName.includes(title) && title.length > 3) score += 30;
          const tokenMatches = searchTokens.filter((tok) =>
            corpusTokens.some((ct) => ct.includes(tok) || tok.includes(ct))
          ).length;
          if (searchTokens.length > 0) {
            score += Math.round((tokenMatches / searchTokens.length) * 45);
          }
          if (locationText && searchTokens.some((tok) => locationText.includes(tok))) score += 12;
          return { score, title };
        };

        const ranked = allProjects
          .map((p) => ({ p, ...scoreCandidate(p) }))
          .sort((a, b) => b.score - a.score);
        const best = ranked[0];
        const second = ranked[1];
        const confidence = Math.max(0, Math.min(1, (best?.score || 0) / 100));
        const lowConfidence = !best || best.score < 40 || (second && (best.score - second.score) < 12);

        console.log('🔎 get_project_by_name fuzzy resolution', {
          query: args.projectName,
          best: best ? { id: best.p?.id, title: best.p?.title || best.p?.name, score: best.score } : null,
          second: second ? { id: second.p?.id, title: second.p?.title || second.p?.name, score: second.score } : null,
          confidence: Number(confidence.toFixed(2)),
          lowConfidence,
        });

        if (!best || best.score <= 0) {
          return {
            success: false,
            error: `Could not find a project named "${args.projectName}". Please check the project name and try again.`,
          };
        }

        if (lowConfidence) {
          const likelyMatches = ranked
            .slice(0, 3)
            .filter((r) => r.score > 0)
            .map((r) => ({
              id: r.p?.id,
              title: r.p?.title || r.p?.name || 'Untitled Project',
              status: r.p?.status || 'unknown',
              score: r.score,
            }));
          const names = likelyMatches.map((m) => m.title).join(', ');
          return {
            success: false,
            requiresClarification: true,
            likelyMatches,
            confidence: Number(confidence.toFixed(2)),
            clarificationQuestion: likelyMatches.length
              ? `I found a few possible matches for "${args.projectName}": ${names}. Which one should I use?`
              : `I couldn't confidently match "${args.projectName}". Which project should I use?`,
            error: 'Low-confidence project match',
          };
        }

        const found = best.p;
        const projectStatus = (found.status || '').toLowerCase();
        const isEstimate = ['estimate', 'draft', 'bid_submitted', 'submitted'].includes(projectStatus);
        const isActive = ['won', 'active', 'in_progress', 'in-progress', 'completed'].includes(projectStatus);
        return {
          success: true,
          projectId: found.id,
          projectName: found.title || found.name,
          status: found.status || 'estimate',
          isEstimate,
          isActiveProject: isActive,
          confidence: Number(confidence.toFixed(2)),
          message: `Found project "${found.title || found.name}" (${projectStatus}).`,
        };
      } catch (error) {
        console.error('Error in executeGetProjectByName:', error);
        return { success: false, error: error.message };
      }
    }

    // Helper function to compare projects (additive tool)
    async function executeCompareProjects(args = {}) {
      try {
        const normalize = (v) => {
          if (v == null) return 0;
          if (typeof v === 'string') {
            const n = Number(v.replace(/[$,\s]/g, ''));
            return Number.isFinite(n) ? n : 0;
          }
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        };
        const statusFilter = String(args?.status || '').toLowerCase().trim();
        const nameFilters = Array.isArray(args?.projectNames)
          ? args.projectNames.map((n) => String(n).toLowerCase().trim()).filter(Boolean)
          : [];

        let candidates = Array.isArray(allProjects) ? [...allProjects] : [];
        if (statusFilter) {
          candidates = candidates.filter((p) => String(p?.status || '').toLowerCase().includes(statusFilter));
        }
        if (nameFilters.length > 0) {
          candidates = candidates.filter((p) => {
            const title = String(p?.title || p?.name || '').toLowerCase();
            const customer = String(p?.customerName || p?.client || '').toLowerCase();
            return nameFilters.some((q) => title.includes(q) || customer.includes(q));
          });
        }

        const analyzed = candidates.map((p) => {
          const title = p?.title || p?.name || 'Untitled Project';
          const budget = normalize(p?.estimatedCost ?? p?.projectData?.estimatedCost ?? p?.estimateData?.totalCost ?? 0);
          const spent = normalize(p?.actualCost ?? p?.totalSpent ?? p?.projectData?.spent ?? 0);
          // Revenue = contract value (bid + approved change orders). Never use estimateData.total — that's often cost, not revenue.
          const baseBid = normalize(p?.bidPrice ?? p?.projectData?.bidPrice ?? 0);
          const changeOrders = p?.changeOrders || p?.projectData?.changeOrders || [];
          const approvedCOs = changeOrders.reduce((s, co) => {
            const ok = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status?.toLowerCase() === 'approved');
            return ok ? s + normalize(co?.amount ?? 0) : s;
          }, 0);
          const revenue = normalize(p?.contractValue ?? 0) > 0
            ? normalize(p.contractValue)
            : (baseBid + approvedCOs > 0 ? baseBid + approvedCOs : baseBid);
          const marginFallback = revenue > 0 && budget > 0 ? ((revenue - budget) / revenue) * 100 : 0;
          const margin = normalize(p?.margin ?? p?.marginPct ?? marginFallback);
          const progress = normalize(p?.progress ?? p?.overallProgressPct);
          const milestones = Array.isArray(p?.milestones) && p.milestones.length
            ? p.milestones
            : (Array.isArray(p?.weeklyPayments) ? p.weeklyPayments : []);
          const overdueItems = milestones.filter((m) => {
            const status = String(m?.status || '').toLowerCase();
            if (status.includes('complete') || status.includes('paid') || status.includes('collected')) return false;
            const dt = new Date(m?.plannedDate || m?.scheduledDate || m?.dueDate || 0);
            return Number.isFinite(dt.getTime()) && dt.getTime() < Date.now();
          });
          const overBudgetPct = budget > 0 ? ((spent - budget) / budget) * 100 : 0;

          // Projected final cost and margin
          const projectedFinalCost = progress > 5 && spent > 0 ? (spent / (progress / 100)) : budget;
          const projectedProfit = revenue - projectedFinalCost;
          const projectedMarginPct = revenue > 0 ? (projectedProfit / revenue * 100) : 0;
          const estimatedProfit = revenue - budget;

          // Expenses analysis
          const expenses = p?.expenses || p?.projectData?.expenses || [];
          const missingReceipts = expenses.filter((e) => !e?.receiptUri || !String(e.receiptUri).trim()).length;

          const riskFlags = [];
          if (overBudgetPct > 10) riskFlags.push('over_budget');
          if (margin > 0 && margin < 10) riskFlags.push('low_margin');
          if (overdueItems.length > 0) riskFlags.push('overdue_milestones');
          if (progress > 0 && budget > 0 && (spent / budget * 100) > progress + 20) riskFlags.push('spend_ahead_of_progress');
          if (margin > 0 && projectedMarginPct > 0 && (margin - projectedMarginPct) > 5) riskFlags.push('margin_erosion');
          if (missingReceipts >= 3) riskFlags.push('missing_receipts');

          return {
            projectId: p?.id,
            title,
            status: p?.status || 'unknown',
            margin: Math.round(margin * 10) / 10,
            spent,
            budget,
            revenue,
            overBudgetPct: Math.round(overBudgetPct * 10) / 10,
            progress: Math.round(progress),
            overdueItems: overdueItems.length,
            projectedFinalCost: Math.round(projectedFinalCost),
            estimatedProfit: Math.round(estimatedProfit),
            projectedProfit: Math.round(projectedProfit),
            projectedMarginPct: Math.round(projectedMarginPct * 10) / 10,
            missingReceipts,
            riskFlags,
          };
        });

        const sortBy = String(args?.sortBy || '').toLowerCase();
        const sorted = [...analyzed].sort((a, b) => {
          if (sortBy === 'progress') return b.progress - a.progress;
          if (sortBy === 'overbudget') return b.overBudgetPct - a.overBudgetPct;
          if (sortBy === 'risk') return b.riskFlags.length - a.riskFlags.length;
          return b.margin - a.margin; // default: most profitable first
        });

        // Portfolio totals
        const totalRevenue = analyzed.reduce((s, x) => s + x.revenue, 0);
        const totalSpent = analyzed.reduce((s, x) => s + x.spent, 0);
        const totalBudget = analyzed.reduce((s, x) => s + x.budget, 0);
        const totalProjectedProfit = analyzed.reduce((s, x) => s + x.projectedProfit, 0);
        const avgMargin = analyzed.length > 0 ? analyzed.reduce((s, x) => s + x.margin, 0) / analyzed.length : 0;

        return {
          success: true,
          comparedCount: sorted.length,
          projects: sorted,
          summary: sorted.slice(0, 5),
          portfolioTotals: {
            totalRevenue,
            totalSpent,
            totalBudget,
            totalProjectedProfit: Math.round(totalProjectedProfit),
            averageMargin: Math.round(avgMargin * 10) / 10,
          },
          message: sorted.length
            ? `Compared ${sorted.length} project(s): ${sorted.map((x) => x.title).join(', ')}. Portfolio totals: $${totalRevenue.toLocaleString()} revenue, $${totalSpent.toLocaleString()} spent, projected profit $${Math.round(totalProjectedProfit).toLocaleString()} (avg margin ${Math.round(avgMargin)}%). IMPORTANT: Present metrics for ALL ${sorted.length} projects in your response — do not focus on only one.`
            : 'No projects matched the requested filters.',
        };
      } catch (error) {
        console.error('Error in executeCompareProjects:', error);
        return { success: false, error: error.message };
      }
    }

    // ── get_project_health executor ──────────────────────────────────────────
    async function executeGetProjectHealth(args = {}) {
      try {
        const normalize = (v) => {
          if (v == null) return 0;
          if (typeof v === 'string') { const n = Number(v.replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : 0; }
          const n = Number(v); return Number.isFinite(n) ? n : 0;
        };
        const searchName = String(args.projectName || '').toLowerCase().trim();
        const match = allProjects.find(p => {
          const t = String(p?.title || p?.name || '').toLowerCase();
          return t === searchName || t.includes(searchName) || searchName.includes(t);
        });
        if (!match) return { success: false, error: `Could not find project "${args.projectName}".` };

        const title = match.title || match.name || 'Project';
        const baseBid = normalize(match.bidPrice ?? match.projectData?.bidPrice ?? 0);
        const changeOrders = match.changeOrders || match.projectData?.changeOrders || [];
        const approvedCOs = changeOrders.reduce((s, co) => {
          const ok = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status.toLowerCase() === 'approved');
          return ok ? s + normalize(co?.amount ?? 0) : s;
        }, 0);
        const revenue = normalize(match.contractValue ?? 0) > 0 ? normalize(match.contractValue) : (baseBid + approvedCOs > 0 ? baseBid + approvedCOs : baseBid);
        const estCost = normalize(match.estimatedCost ?? 0);
        const spent = normalize(match.actualCost ?? match.totalSpent ?? 0);
        const progress = normalize(match.progress ?? match.overallProgressPct ?? 0);
        const ed = match.estimateData || match.projectData?.estimateData || {};
        const expenses = match.expenses || match.projectData?.expenses || [];
        const milestones = match.milestones || match.weeklyPayments || [];

        const materialBudget = normalize(ed?.materialTotal ?? 0) || sumLineItems(ed?.materialLineItems ?? ed?.materialsCart, normalize);
        const laborBudget = normalize(ed?.laborTotal ?? 0) || sumLineItems(ed?.laborLineItems, normalize);
        const materialSpent = sumExpensesByCategory(expenses, 'material', normalize);
        const laborSpent = sumExpensesByCategory(expenses, 'labor', normalize);

        const adjustedBudget = estCost > 0 ? estCost + approvedCOs : revenue;
        const marginPct = revenue > 0 && estCost > 0 ? ((revenue - estCost) / revenue * 100) : 0;
        const projectedFinalCost = progress > 5 && spent > 0 ? (spent / (progress / 100)) : estCost;
        const projectedProfit = revenue - projectedFinalCost;
        const projectedMarginPct = revenue > 0 ? (projectedProfit / revenue * 100) : 0;
        const budgetUsedPct = estCost > 0 ? (spent / estCost * 100) : 0;

        const missingReceipts = expenses.filter(e => !e?.receiptUri || !String(e.receiptUri).trim()).length;
        const now = new Date();
        const overdueItems = milestones.filter(m => {
          const st = String(m?.status || '').toLowerCase();
          if (st.includes('complete') || st.includes('paid') || st.includes('collected')) return false;
          const dt = new Date(m?.plannedDate || m?.scheduledDate || m?.dueDate || 0);
          return Number.isFinite(dt.getTime()) && dt.getTime() < now.getTime();
        });
        const upcomingPayments = milestones.filter(m => {
          const st = String(m?.status || '').toLowerCase();
          if (st.includes('complete') || st.includes('paid') || st.includes('collected')) return false;
          const dt = new Date(m?.plannedDate || m?.scheduledDate || m?.dueDate || 0);
          if (!Number.isFinite(dt.getTime())) return false;
          const days = Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return days >= 0 && days <= 7;
        });

        const expByCategory = {};
        expenses.forEach(e => {
          const cat = e?.category || 'Other';
          expByCategory[cat] = (expByCategory[cat] || 0) + normalize(e?.amount ?? 0);
        });
        const topCosts = Object.entries(expByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([cat, amt]) => ({ category: cat, amount: Math.round(amt), percentage: spent > 0 ? Math.round(amt / spent * 100) : 0 }));

        const risks = [];
        if (budgetUsedPct > progress + 20) risks.push(`Spending ${Math.round(budgetUsedPct)}% of budget but only ${Math.round(progress)}% complete`);
        if (marginPct > 0 && projectedMarginPct < marginPct - 5) risks.push(`Margin eroding: estimated ${Math.round(marginPct)}% → projected ${Math.round(projectedMarginPct)}%`);
        if (materialBudget > 0 && materialSpent > materialBudget) risks.push(`Material costs ${Math.round((materialSpent - materialBudget) / materialBudget * 100)}% over budget`);
        if (laborBudget > 0 && laborSpent > laborBudget) risks.push(`Labor costs ${Math.round((laborSpent - laborBudget) / laborBudget * 100)}% over budget`);
        if (overdueItems.length > 0) risks.push(`${overdueItems.length} overdue payment(s)`);
        if (missingReceipts >= 3) risks.push(`${missingReceipts} expenses missing receipts`);

        return {
          success: true,
          project: title,
          status: match.status || 'unknown',
          financials: {
            revenue, estimatedCost: estCost, actualSpent: spent,
            adjustedBudget: Math.round(adjustedBudget),
            budgetUsedPct: Math.round(budgetUsedPct),
            estimatedMarginPct: Math.round(marginPct * 10) / 10,
            projectedFinalCost: Math.round(projectedFinalCost),
            projectedProfit: Math.round(projectedProfit),
            projectedMarginPct: Math.round(projectedMarginPct * 10) / 10,
            approvedChangeOrders: approvedCOs,
          },
          budgetBreakdown: {
            materialBudget: Math.round(materialBudget), materialSpent: Math.round(materialSpent),
            laborBudget: Math.round(laborBudget), laborSpent: Math.round(laborSpent),
          },
          progress: Math.round(progress),
          topCostDrivers: topCosts,
          overdueItems: overdueItems.map(m => ({ name: m.title || m.name || 'Payment', amount: normalize(m.amount ?? 0) })),
          upcomingPayments: upcomingPayments.map(m => ({ name: m.title || m.name || 'Payment', amount: normalize(m.amount ?? 0), date: m.plannedDate || m.scheduledDate || m.dueDate })),
          missingReceipts,
          changeOrdersCount: changeOrders.length,
          risks,
          riskLevel: risks.length >= 3 ? 'High' : risks.length >= 1 ? 'Medium' : 'Low',
        };
      } catch (error) {
        console.error('Error in executeGetProjectHealth:', error);
        return { success: false, error: error.message };
      }
    }

    // ── forecast_profit executor ──────────────────────────────────────────────
    async function executeForecastProfit(args = {}) {
      try {
        const normalize = (v) => {
          if (v == null) return 0;
          if (typeof v === 'string') { const n = Number(v.replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : 0; }
          const n = Number(v); return Number.isFinite(n) ? n : 0;
        };
        let candidates = Array.isArray(allProjects) ? [...allProjects] : [];
        const searchName = String(args.projectName || '').toLowerCase().trim();
        if (searchName) {
          candidates = candidates.filter(p => {
            const t = String(p?.title || p?.name || '').toLowerCase();
            return t.includes(searchName) || searchName.includes(t);
          });
        }
        if (candidates.length === 0) return { success: false, error: searchName ? `No project found matching "${args.projectName}".` : 'No projects available.' };

        const forecasts = candidates.map(p => {
          const title = p?.title || p?.name || 'Project';
          const baseBid = normalize(p?.bidPrice ?? p?.projectData?.bidPrice ?? 0);
          const changeOrders = p?.changeOrders || p?.projectData?.changeOrders || [];
          const approvedCOs = changeOrders.reduce((s, co) => {
            const ok = (typeof co?.approved === 'boolean' && co.approved) || (typeof co?.status === 'string' && co.status.toLowerCase() === 'approved');
            return ok ? s + normalize(co?.amount ?? 0) : s;
          }, 0);
          const contractValue = normalize(p?.contractValue ?? 0) > 0 ? normalize(p.contractValue) : (baseBid + approvedCOs > 0 ? baseBid + approvedCOs : baseBid);
          const estCost = normalize(p?.estimatedCost ?? 0);
          const spent = normalize(p?.actualCost ?? p?.totalSpent ?? 0);
          const progress = normalize(p?.progress ?? p?.overallProgressPct ?? 0);

          const projectedFinalCost = progress > 5 && spent > 0 ? (spent / (progress / 100)) : estCost;
          const estimatedProfit = contractValue - estCost;
          const estimatedMarginPct = contractValue > 0 ? (estimatedProfit / contractValue * 100) : 0;
          const projectedProfit = contractValue - projectedFinalCost;
          const projectedMarginPct = contractValue > 0 ? (projectedProfit / contractValue * 100) : 0;
          const marginChange = estimatedMarginPct - projectedMarginPct;
          const costVariance = projectedFinalCost - estCost;
          const profitAtRisk = estimatedProfit - projectedProfit;

          let outlook = 'On Track';
          if (marginChange > 10) outlook = 'At Risk';
          else if (marginChange > 5) outlook = 'Watch';
          else if (projectedMarginPct > estimatedMarginPct) outlook = 'Better Than Expected';

          return {
            project: title,
            contractValue: Math.round(contractValue),
            estimatedCost: Math.round(estCost),
            actualSpent: Math.round(spent),
            progress: Math.round(progress),
            projectedFinalCost: Math.round(projectedFinalCost),
            estimatedProfit: Math.round(estimatedProfit),
            projectedProfit: Math.round(projectedProfit),
            estimatedMarginPct: Math.round(estimatedMarginPct * 10) / 10,
            projectedMarginPct: Math.round(projectedMarginPct * 10) / 10,
            marginChange: Math.round(marginChange * 10) / 10,
            costVariance: Math.round(costVariance),
            profitAtRisk: Math.round(profitAtRisk),
            outlook,
          };
        });

        const totalContractValue = forecasts.reduce((s, f) => s + f.contractValue, 0);
        const totalProjectedProfit = forecasts.reduce((s, f) => s + f.projectedProfit, 0);
        const totalEstimatedProfit = forecasts.reduce((s, f) => s + f.estimatedProfit, 0);
        const totalProfitAtRisk = totalEstimatedProfit - totalProjectedProfit;

        return {
          success: true,
          forecasts,
          portfolioSummary: {
            totalContractValue: Math.round(totalContractValue),
            totalEstimatedProfit: Math.round(totalEstimatedProfit),
            totalProjectedProfit: Math.round(totalProjectedProfit),
            totalProfitAtRisk: Math.round(totalProfitAtRisk),
            averageProjectedMargin: forecasts.length > 0 ? Math.round(forecasts.reduce((s, f) => s + f.projectedMarginPct, 0) / forecasts.length * 10) / 10 : 0,
          },
          message: `Forecast for ${forecasts.length} project(s): projected profit $${Math.round(totalProjectedProfit).toLocaleString()} ($${Math.round(totalProfitAtRisk).toLocaleString()} at risk vs. estimate).`,
        };
      } catch (error) {
        console.error('Error in executeForecastProfit:', error);
        return { success: false, error: error.message };
      }
    }

    // ── analyze_expenses executor ──────────────────────────────────────────────
    async function executeAnalyzeExpenses(args = {}) {
      try {
        const normalize = (v) => {
          if (v == null) return 0;
          const n = Number(typeof v === 'string' ? v.replace(/[$,\s]/g, '') : v);
          return Number.isFinite(n) ? n : 0;
        };
        let candidates = Array.isArray(allProjects) ? [...allProjects] : [];
        const searchName = String(args.projectName || '').toLowerCase().trim();
        if (searchName) {
          candidates = candidates.filter(p => {
            const t = String(p?.title || p?.name || '').toLowerCase();
            return t.includes(searchName) || searchName.includes(t);
          });
        }

        const allExpenses = [];
        candidates.forEach(p => {
          const title = p?.title || p?.name || 'Project';
          const exps = p?.expenses || p?.projectData?.expenses || [];
          exps.forEach(e => allExpenses.push({ ...e, projectName: title }));
        });

        if (allExpenses.length === 0) return { success: true, message: 'No expenses found.', breakdown: [], totalSpent: 0 };

        const groupBy = String(args.groupBy || 'category').toLowerCase();
        const grouped = {};

        allExpenses.forEach(e => {
          let key;
          if (groupBy === 'vendor') key = e?.vendor || e?.store || 'Unknown Vendor';
          else if (groupBy === 'month') {
            const d = new Date(e?.date || e?.createdAt || 0);
            key = Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'Unknown';
          }
          else key = e?.category || 'Other';
          if (!grouped[key]) grouped[key] = { items: 0, total: 0, expenses: [] };
          grouped[key].items++;
          grouped[key].total += normalize(e?.amount ?? 0);
          if (grouped[key].expenses.length < 3) {
            grouped[key].expenses.push({ amount: normalize(e?.amount ?? 0), description: e?.description || e?.notes || '', project: e.projectName, date: e?.date });
          }
        });

        const totalSpent = allExpenses.reduce((s, e) => s + normalize(e?.amount ?? 0), 0);
        const breakdown = Object.entries(grouped)
          .map(([name, data]) => ({
            name,
            total: Math.round(data.total),
            count: data.items,
            percentage: totalSpent > 0 ? Math.round(data.total / totalSpent * 100) : 0,
            topExpenses: data.expenses,
          }))
          .sort((a, b) => b.total - a.total);

        const missingReceipts = allExpenses.filter(e => !e?.receiptUri || !String(e.receiptUri).trim()).length;

        return {
          success: true,
          totalSpent: Math.round(totalSpent),
          expenseCount: allExpenses.length,
          missingReceipts,
          groupedBy: groupBy,
          breakdown: breakdown.slice(0, 10),
          projectsCovered: [...new Set(allExpenses.map(e => e.projectName))],
          message: `Analyzed ${allExpenses.length} expenses totaling $${Math.round(totalSpent).toLocaleString()} across ${candidates.length} project(s), grouped by ${groupBy}.`,
        };
      } catch (error) {
        console.error('Error in executeAnalyzeExpenses:', error);
        return { success: false, error: error.message };
      }
    }

    // Helper function to execute add_purchase_order
    // HARD RULE: Never invent or assume missing values - only use what user explicitly provided
    async function executeAddPurchaseOrder(args, req) {
      console.error('🔍 executeAddPurchaseOrder called with args:', JSON.stringify(args, null, 2));
      let targetProjectId;
      try {
        // HARD VALIDATION: Reject immediately if required fields are missing
        // DO NOT attempt extraction - only use what AI explicitly provided from user messages
        
        // Validate amount - must be provided and > 0
        if (!args.amount || args.amount <= 0 || isNaN(args.amount)) {
          console.error('❌ HARD VALIDATION: Amount missing or invalid - rejecting PO creation');
          return { 
            success: false, 
            status: 'error',
            error: 'Amount is required and must be greater than 0. Please ask the user "How much is the purchase order for?" before calling add_purchase_order.',
            requiresAmount: true,
            message: 'I need to know the amount first. How much is the purchase order for?'
          };
        }
        
        // Validate category - must be provided
        if (!args.category || args.category.trim() === '') {
          console.error('❌ HARD VALIDATION: Category missing - rejecting PO creation');
          return { 
            success: false, 
            status: 'error',
            error: 'Category is required. Please ask the user "What category is this for?" before calling add_purchase_order.',
            requiresCategory: true,
            message: 'I need to know what category this is for. What category is this purchase order for?'
          };
        }
        
        // Validate vendor - must be provided
        if (!args.vendor || args.vendor.trim() === '') {
          console.error('❌ HARD VALIDATION: Vendor missing - rejecting PO creation');
          return { 
            success: false, 
            status: 'error',
            error: 'Vendor is required. Please ask the user "Which vendor is this from?" before calling add_purchase_order.',
            requiresVendor: true,
            message: 'I need to know which vendor this is from. Which vendor is this purchase order from?'
          };
        }
        
        // Validate that vendor is not a material name
        const materialNames = ['windows', 'doors', 'lumber', 'tile', 'drywall', 'concrete', 'paint', 
                              'electrical', 'plumbing', 'hardware', 'roofing', 'insulation', 'flooring', 
                              'cabinets', 'appliances', 'siding', 'decking', 'fencing', 'landscaping',
                              'materials', 'material', 'labor', 'equipment'];
        const vendorLower = (args.vendor || '').toLowerCase();
        const isMaterialName = materialNames.some(m => vendorLower.includes(m));
        if (isMaterialName) {
          console.error('❌ HARD VALIDATION: Vendor appears to be a material name - rejecting PO creation');
          return { 
            success: false, 
            status: 'error',
            error: `The vendor "${args.vendor}" appears to be a material name, not a vendor. Please ask the user "Which vendor is this from?" before calling add_purchase_order.`,
            requiresVendor: true,
            message: 'I need to know which vendor this is from. Which vendor is this purchase order from?'
          };
        }
        
        // HARD VALIDATION: ALWAYS reject common placeholder amounts unless user explicitly provided them
        const commonPlaceholders = [350, 500, 1000, 100, 250, 750, 1500, 2000];
        if (commonPlaceholders.includes(args.amount)) {
          // CRITICAL: Check ALL user messages to see if user ever mentioned this amount
          const allUserMessages = messages.filter(m => m.role === 'user');
          let userMentionedAmount = false;
          
          // Check each user message for explicit mention of this amount
          for (const userMsg of allUserMessages) {
            const msgContent = (userMsg.content || '').toLowerCase();
            // Check for explicit patterns: "$350", "350 dollars", "for $350", "350", or just plain "350" as a standalone number
            const amountPattern = new RegExp(`(?:\\$|dollars?|for\\s+\\$?)\\s*${args.amount}\\b|\\b${args.amount}\\s*(?:dollars?|\\$)|\\b${args.amount}\\b`, 'i');
            const isPlainNumber = msgContent.trim() === String(args.amount);
            // Check if the number appears anywhere in the message (smart extraction - no need for $ or "dollars")
            const hasNumber = new RegExp(`\\b${args.amount}\\b`).test(msgContent);
            // Check if previous assistant message asked for amount
            const msgIndex = messages.indexOf(userMsg);
            const prevAssistantMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'assistant');
            const prevAssistantAsked = prevAssistantMsg?.content?.toLowerCase().includes('how much');
            
            // Accept if: has $/dollars pattern, is plain number, or number appears in message (smart extraction)
            if (amountPattern.test(msgContent) || (isPlainNumber && prevAssistantAsked) || (hasNumber && prevAssistantAsked)) {
              userMentionedAmount = true;
              console.log('✅ Found explicit amount', args.amount, 'in user message:', msgContent.substring(0, 50));
              break;
            }
          }
          
          if (!userMentionedAmount) {
            console.error('❌ HARD VALIDATION: Common placeholder amount', args.amount, 'NEVER mentioned by user - REJECTING');
            return {
              success: false,
              status: 'error',
              confirmed: false,
              error: `CRITICAL: The amount $${args.amount} was NEVER provided by the user in any message. You attempted to use a placeholder amount. You MUST ask "How much is the purchase order for?" and wait for the user's response. DO NOT use $350, $500, $1000, or any placeholder amounts. The function call has been REJECTED.`,
              requiresAmount: true,
              message: 'I need to know the amount first. How much is the purchase order for?'
            };
          }
        }

        // All validation passed - proceed with creating the purchase order
        // NO EXTRACTION - only use what was explicitly provided by the AI from user messages

        // Use projectId from context if not provided
        targetProjectId = args.projectId || projectId;
        
        if (!targetProjectId) {
          return { success: false, error: 'Project ID is required. Please specify which project this purchase order is for.' };
        }

        // Generate PO number
        const poNumber = `PO-${Date.now().toString().slice(-6)}`;

        // Return BOTH action AND projectUpdate for frontend to handle
        // The action is used by the project detail page handler
        // The projectUpdate ensures the modal also updates the project directly (like materials/labor do)
        const poAction = {
          type: 'add_purchase_order',
          projectId: targetProjectId,
          amount: args.amount,
          vendor: args.vendor.trim(),
          category: args.category.trim(),
          description: args.description || `${args.category} from ${args.vendor}`,
          expectedDelivery: args.expectedDelivery || null,
          poNumber: poNumber,
        };
        
        // Create the purchase order object for projectUpdate
        const newPurchaseOrder = {
          id: `po-${Date.now()}`,
          poNumber: poNumber,
          vendor: args.vendor.trim(),
          amount: args.amount,
          category: args.category.trim(),
          description: args.description || `${args.category} from ${args.vendor}`,
          orderDate: new Date().toISOString(),
          expectedDelivery: args.expectedDelivery || null,
          status: 'Pending',
        };
        
        return {
          success: true,
          status: 'success',
          action: poAction, // For project detail page handler
          projectUpdate: {
            projectId: targetProjectId,
            purchaseOrders: [newPurchaseOrder], // Include the new PO in projectUpdate
            committedPOs: args.amount, // Update committed POs amount
          },
          message: `I've created purchase order ${poNumber} for $${args.amount.toFixed(2)} from ${args.vendor}. It will appear in "Committed POs" in your budget. When you receive it, mark the purchase order as received in the Purchase Orders page and it will be added to your actual expenses.`,
        };
      } catch (error) {
        console.error('❌ Error creating purchase order:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to create purchase order'
        };
      }
    }

    // Helper function to execute mark_purchase_order_received
    async function executeMarkPOReceived(args, req) {
      let targetProjectId;
      try {
        // Use projectId from context if not provided
        targetProjectId = args.projectId || projectId;
        
        if (!targetProjectId) {
          return { success: false, error: 'Project ID is required. Please specify which project this purchase order is for.' };
        }

        // Try to extract PO number or amount from conversation history
        const allMessagesText = messages.map(m => m.content || '').join(' ');
        let extractedAmount = null;
        
        if (!args.poNumber || args.poNumber.trim() === '') {
          // First, try to find PO number in conversation history (look for most recent)
          const poNumberMatches = allMessagesText.match(/PO-(\d+)/gi);
          if (poNumberMatches && poNumberMatches.length > 0) {
            // Get the most recent PO number mentioned
            args.poNumber = poNumberMatches[poNumberMatches.length - 1];
            console.log('📦 Extracted PO number from conversation (most recent):', args.poNumber);
          } else {
            // If no PO number, try to find by amount mentioned in recent messages
            // Look for amounts in the last few messages (likely the PO that was just created)
            const recentMessages = messages.slice(-5).map(m => m.content || '').join(' ');
            const amountMatches = recentMessages.match(/\$?(\d+(?:\.\d+)?)/g);
            if (amountMatches && amountMatches.length > 0) {
              // Get the most recent amount mentioned
              const lastAmount = amountMatches[amountMatches.length - 1].replace('$', '');
              extractedAmount = parseFloat(lastAmount);
              args.amount = extractedAmount;
              console.log('📦 Looking for PO by amount (from recent messages):', extractedAmount);
            } else {
              // If still no amount, look in all messages
              const allAmountMatches = allMessagesText.match(/\$?(\d+(?:\.\d+)?)/g);
              if (allAmountMatches && allAmountMatches.length > 0) {
                const lastAmount = allAmountMatches[allAmountMatches.length - 1].replace('$', '');
                extractedAmount = parseFloat(lastAmount);
                args.amount = extractedAmount;
                console.log('📦 Looking for PO by amount (from all messages):', extractedAmount);
              }
            }
          }
        }

        // Get project data to find the PO
        const projectData = parsedContext.projectData || parsedContext;
        const allPOs = projectData.purchaseOrders || [];
        
        // Also check allProjects for the PO
        let allProjectPOs = [];
        if (allProjects.length > 0) {
          const project = allProjects.find(p => String(p.id) === String(targetProjectId));
          if (project) {
            allProjectPOs = project.projectData?.purchaseOrders || project.purchaseOrders || [];
          }
        }
        
        // Combine all POs and filter to only Pending ones
        const combinedPOs = [...allProjectPOs, ...allPOs];
        // Remove duplicates by ID
        const uniquePOs = combinedPOs.filter((po, index, self) => 
          index === self.findIndex((p) => p.id === po.id || p.poNumber === po.poNumber)
        );
        
        // Filter to only Pending POs (we want to mark one as received)
        const pendingPOs = uniquePOs.filter((po) => po.status === 'Pending');
        
        let foundPO = null;
        
        // First, try to find by PO number if provided
        if (args.poNumber && args.poNumber.trim() !== '') {
          foundPO = pendingPOs.find((po) => 
            po.poNumber === args.poNumber || 
            po.poNumber === args.poNumber.toUpperCase()
          );
          if (foundPO) {
            console.log('📦 Found PO by number:', args.poNumber);
          }
        }
        
        // If not found by PO number, try to find by amount
        if (!foundPO && (args.amount || extractedAmount)) {
          const searchAmount = args.amount || extractedAmount;
          foundPO = pendingPOs.find((po) => {
            const poAmount = Number(po.amount) || 0;
            return Math.abs(poAmount - searchAmount) < 0.01;
          });
          console.log('📦 Searching by amount:', searchAmount, 'Found:', !!foundPO);
        }
        
        // If still not found, get the most recent Pending PO (by orderDate or creation time)
        if (!foundPO && pendingPOs.length > 0) {
          // Sort by orderDate (most recent first) or by ID (newer IDs are larger)
          pendingPOs.sort((a, b) => {
            if (a.orderDate && b.orderDate) {
              return new Date(b.orderDate) - new Date(a.orderDate);
            }
            // Fallback to ID comparison (newer POs have larger timestamps in ID)
            return (b.id || '').localeCompare(a.id || '');
          });
          foundPO = pendingPOs[0];
          console.log('📦 Using most recent Pending PO:', foundPO.poNumber, 'Amount:', foundPO.amount);
        }

        if (!foundPO) {
          return { 
            success: false, 
            error: `No pending purchase order found to mark as received. ${args.poNumber ? `PO ${args.poNumber} not found or already received.` : 'Please specify which purchase order to mark as received.'}` 
          };
        }

        if (foundPO.status === 'Received') {
          return { 
            success: false, 
            error: `Purchase order ${foundPO.poNumber} is already marked as received.` 
          };
        }

        if (foundPO.status === 'Cancelled') {
          return { 
            success: false, 
            error: `Purchase order ${foundPO.poNumber} is cancelled and cannot be marked as received.` 
          };
        }

        // Create updated PO with Received status
        const updatedPO = {
          ...foundPO,
          status: 'Received',
        };

        // Create expense from the PO
        const newExpense = {
          id: `exp-${Date.now()}`,
          category: foundPO.category || 'Materials/Equipment',
          vendor: foundPO.vendor || '',
          amount: foundPO.amount || 0,
          date: new Date().toISOString(),
          notes: `${foundPO.description || ''} (from ${foundPO.poNumber})`.trim(),
          receiptUri: null,
        };

        // Calculate new committedPOs (only Pending POs)
        // Update the PO in the combined list
        const updatedPOsList = uniquePOs.map((po) => 
          (po.id === foundPO.id || po.poNumber === foundPO.poNumber) ? updatedPO : po
        );
        const newCommittedPOs = updatedPOsList
          .filter((po) => po.status === 'Pending')
          .reduce((sum, po) => sum + (Number(po.amount) || 0), 0);

        // Calculate new total spent (add PO amount to existing spent)
        const currentSpent = parsedContext.totalSpent || parsedContext.actualCost || parsedContext.spent || 0;
        const newTotalSpent = currentSpent + (foundPO.amount || 0);

        return {
          success: true,
          status: 'success',
          action: {
            type: 'mark_po_received',
            projectId: targetProjectId,
            poId: foundPO.id,
            poNumber: foundPO.poNumber,
          },
          projectUpdate: {
            projectId: targetProjectId,
            purchaseOrders: [updatedPO], // Updated PO
            expenses: [newExpense], // New expense created from PO
            committedPOs: newCommittedPOs, // Updated committed POs
            totalSpent: newTotalSpent, // Updated total spent
          },
          message: `I've marked purchase order ${foundPO.poNumber} as received. The $${(foundPO.amount || 0).toFixed(2)} has been moved from "Committed POs" to "Actual Expenses" in your budget.`,
        };
      } catch (error) {
        console.error('❌ Error marking purchase order as received:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to mark purchase order as received'
        };
      }
    }

    // Helper function to execute add_material_expense
    async function executeAddMaterialExpense(args, req) {
      let targetProjectId;
      try {
        // Validate required fields
        if (!args.amount || args.amount <= 0) {
          return { success: false, error: 'Amount is required and must be greater than 0.' };
        }

        if (!args.category || args.category.trim() === '') {
          return { success: false, error: 'Material category is required. Please ask the user "What material is this for?"' };
        }

        // Check if this is a labor expense
        const isLaborExpense = args.category && args.category.toLowerCase().trim() === 'labor';
        
        // Vendor is REQUIRED for materials, NOT required for labor (but trade goes in vendor field)
        let vendor;
        if (!isLaborExpense) {
          // For materials, vendor is required
          if (!args.vendor || !args.vendor.trim()) {
            return { 
              success: false, 
              status: 'error',
              error: 'Vendor is required for material expenses. Please ask the user "Where was it purchased?" or "Where did you buy this from?" before calling add_material_expense.',
              requiresVendor: true
            };
          }
          vendor = args.vendor.trim();
        } else {
          // For labor expenses, the trade (what labor was for) goes in the vendor field
          // This is because the UI uses vendor field to display "Sub / Trade" for labor
          // Accept either notes OR vendor - user may say "general labor" in response to vendor question
          if (args.notes && args.notes.trim()) {
            vendor = args.notes.trim(); // Use notes (trade) as vendor for labor
          } else if (args.vendor && args.vendor.trim()) {
            vendor = args.vendor.trim(); // User said "general labor" etc. - use as sub/trade
          } else {
            vendor = 'N/A'; // Fallback if no trade provided
          }
        }

        // Use projectId from context if not provided
        targetProjectId = args.projectId || projectId;
        
        if (!targetProjectId) {
          return { success: false, error: 'Project ID is required. Please specify which project this expense is for.' };
        }

        // Normalize category and handle labor vs materials
        let materialName;
        let normalizedCategory;
        
        if (isLaborExpense) {
          // For labor, use "Labor" as category
          // The trade (what labor was for) goes in vendor field (which displays as "Sub / Trade" in UI)
          normalizedCategory = 'Labor';
          materialName = vendor !== 'N/A' ? vendor : 'Labor';
        } else {
          // For materials, normalize to "Materials/Equipment" and store specific material in notes
          materialName = args.category.trim();
          normalizedCategory = 'Materials/Equipment';
        }

        // Determine base URL for API calls
        // Try to use the same host as the current request
        let baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 
                      process.env.API_BASE_URL;
        
        if (!baseUrl && req) {
          baseUrl = `${req.protocol || 'http'}://${req.get('host') || 'localhost:3001'}`;
        }
        
        if (!baseUrl) {
          baseUrl = 'http://localhost:3001';
        }
        
        console.log('🌐 Using baseUrl for API calls:', baseUrl);

        // Use auth token from request
        const tokenToUse = authToken;
        if (!tokenToUse) {
          return { success: false, error: 'Authentication token is required' };
        }

        // Find project info from context to send with expense (for auto-create if needed)
        let projectInfo = null;
        if (allProjects && Array.isArray(allProjects)) {
          projectInfo = allProjects.find(p => String(p.id) === String(targetProjectId));
        }
        
        // If not found in allProjects, try currentProjectData
        if (!projectInfo && currentProjectData) {
          projectInfo = currentProjectData;
        }
        
        // CRITICAL: Get current expenses from project context to send to backend
        // This ensures deleted expenses don't get restored
        // PRIORITY: parsedContext.expenses is the source of truth (comes from frontend AsyncStorage)
        // Only use allProjects expenses as last resort if parsedContext doesn't have them
        let currentExpenses = [];
        
        // FIRST: Use expenses from parsedContext (most current, from frontend AsyncStorage)
        if (expenses && Array.isArray(expenses) && expenses.length > 0) {
          currentExpenses = expenses;
          console.log('✅ Using expenses from parsedContext (source of truth):', currentExpenses.length);
        }
        // SECOND: Check projectInfo (from allProjects - might be stale)
        else if (projectInfo) {
          if (projectInfo.projectData && projectInfo.projectData.expenses && Array.isArray(projectInfo.projectData.expenses)) {
            currentExpenses = projectInfo.projectData.expenses;
            console.log('⚠️ Using expenses from projectInfo.projectData (might be stale):', currentExpenses.length);
          } else if (projectInfo.expenses && Array.isArray(projectInfo.expenses)) {
            currentExpenses = projectInfo.expenses;
            console.log('⚠️ Using expenses from projectInfo (might be stale):', currentExpenses.length);
          }
        }
        // THIRD: Fallback to currentProjectData (from allProjects - might be stale)
        else if (currentProjectData) {
          if (currentProjectData.projectData && currentProjectData.projectData.expenses && Array.isArray(currentProjectData.projectData.expenses)) {
            currentExpenses = currentProjectData.projectData.expenses;
            console.log('⚠️ Using expenses from currentProjectData.projectData (might be stale):', currentExpenses.length);
          } else if (currentProjectData.expenses && Array.isArray(currentProjectData.expenses)) {
            currentExpenses = currentProjectData.expenses;
            console.log('⚠️ Using expenses from currentProjectData (might be stale):', currentExpenses.length);
          }
        }
        
        // If still no expenses, use empty array
        if (currentExpenses.length === 0) {
          console.log('⚠️ No expenses found in context, using empty array');
        }
        
        console.log('📤 AI Assistant: Calling projects API to add expense', {
          url: `${baseUrl}/api/projects/${targetProjectId}/expenses`,
          projectId: targetProjectId,
          amount: args.amount,
          category: normalizedCategory,
          materialName: materialName,
          vendor: vendor,
          hasProjectInfo: !!projectInfo,
          currentExpensesCount: currentExpenses.length,
          tokenLength: tokenToUse.length,
          tokenPreview: tokenToUse.substring(0, 30) + '...'
        });
        
        const response = await axios.post(
          `${baseUrl}/api/projects/${targetProjectId}/expenses`,
          {
            amount: args.amount,
            category: normalizedCategory,
            vendor: vendor,
            notes: isLaborExpense 
              ? (args.notes && args.notes.trim() && args.notes.trim() !== vendor ? args.notes.trim() : '') // For labor, notes is description (optional, separate from trade)
              : (args.notes || `${materialName} from ${vendor}`),
            date: new Date().toISOString().split('T')[0],
            // CRITICAL: Send current expenses list so backend uses it as source of truth
            // This prevents deleted expenses from being restored
            currentExpenses: currentExpenses,
            projectInfo: projectInfo ? {
              title: projectInfo.title || projectInfo.name,
              name: projectInfo.title || projectInfo.name,
              client: projectInfo.client || projectInfo.customerName,
              customerName: projectInfo.client || projectInfo.customerName,
              location: projectInfo.location || '',
              bidTotal: projectInfo.bidTotal || projectInfo.bidPrice || projectInfo.estimatedCost || projectInfo.total || 0,
              total: projectInfo.bidTotal || projectInfo.bidPrice || projectInfo.estimatedCost || projectInfo.total || 0,
              estimatedCost: projectInfo.estimatedCost || projectInfo.bidPrice || projectInfo.bidTotal || 0,
              bidPrice: projectInfo.bidPrice || projectInfo.bidTotal || projectInfo.estimatedCost || 0,
              status: projectInfo.status || 'estimate',
              startDate: projectInfo.startDate,
              endDate: projectInfo.endDate,
              description: projectInfo.description,
            } : undefined,
          },
          {
            headers: {
              'Authorization': `Bearer ${tokenToUse}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data && response.data.success) {
          console.log('✅ AI Assistant: Expense added successfully', {
            expenseId: response.data.data?.id,
            projectId: targetProjectId,
            totalSpent: response.data.project?.totalSpent
          });

          return {
            success: true,
            status: 'success',
            message: `Successfully added $${args.amount.toFixed(2)} for ${materialName} from ${vendor} to the project. This expense has been recorded and will appear in your Materials & Equipment transactions.`,
            projectId: targetProjectId, // Include projectId so AI knows it worked
            projectUpdate: {
              projectId: targetProjectId,
              totalSpent: response.data.project?.totalSpent || 0,
              actualCost: response.data.project?.actualCost || response.data.project?.totalSpent || 0,
              remaining: response.data.project?.remaining || 0,
              expenses: response.data.project?.expenses || [],
              expensesCount: response.data.project?.expensesCount || 0,
            },
          };
        } else {
          return { success: false, error: response.data.error || 'Failed to add expense' };
        }
      } catch (error) {
        const errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          code: error.code,
          projectId: targetProjectId,
          url: error.config?.url,
        };
        
        console.error('❌ Error adding material expense:', errorDetails);
        
        // Provide detailed error message for debugging
        let errorMessage = 'Failed to add material expense';
        
        if (error.response?.status === 404) {
          errorMessage = `Project not found (ID: ${targetProjectId || 'unknown'}). The project may not exist or you may not have access to it.`;
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          errorMessage = `Cannot connect to backend server. Please check that the backend is running at ${baseUrl}`;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        return { 
          success: false, 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        };
      }
    }

    // Helper function to execute message_team_member
    async function executeMessageTeamMember(args) {
      try {
        const { teamMemberName, messageContent } = args;
        
        if (!teamMemberName || !messageContent) {
          return { 
            success: false, 
            error: 'Team member name and message content are required' 
          };
        }

        // Find team member in context
        const teamMembers = parsedContext?.teamMembers || [];
        const teamMember = teamMembers.find(m => {
          const memberName = (m.name || '').toLowerCase();
          const searchName = teamMemberName.toLowerCase();
          return memberName === searchName || 
                 memberName.includes(searchName) || 
                 searchName.includes(memberName);
        });

        if (!teamMember) {
          return {
            success: false,
            error: `Could not find team member "${teamMemberName}". Available team members: ${teamMembers.map(m => m.name).join(', ')}`
          };
        }

        if (!teamMember.phone) {
          return {
            success: false,
            error: `Team member "${teamMemberName}" does not have a phone number on file.`
          };
        }

        // Call backend API to send SMS
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        const response = await axios.post(`${baseUrl}/api/team/message`, {
          phoneNumber: teamMember.phone,
          message: messageContent,
          teamMemberName: teamMember.name
        });

        if (response.data.success) {
          return {
            success: true,
            message: `✅ Message sent to ${teamMember.name} (${teamMember.phone})`,
            messageSid: response.data.messageSid
          };
        } else {
          return {
            success: false,
            error: response.data.error || 'Failed to send message'
          };
        }
      } catch (error) {
        console.error('Error sending team message:', error);
        return {
          success: false,
          error: error.response?.data?.error || error.message || 'Failed to send message'
        };
      }
    }

    // Helper function to execute notify_team
    async function executeNotifyTeam(args) {
      try {
        const { messageContent } = args;
        
        if (!messageContent) {
          return { 
            success: false, 
            error: 'Message content is required' 
          };
        }

        // Get active team members from context
        const teamMembers = parsedContext?.teamMembers || [];
        const activeTeamMembers = teamMembers.filter(m => 
          m.status === 'active' && m.phone
        );

        if (activeTeamMembers.length === 0) {
          return {
            success: false,
            error: 'No active team members with phone numbers found.'
          };
        }

        // Call backend API to send bulk SMS
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        const phoneNumbers = activeTeamMembers.map(m => m.phone);
        const response = await axios.post(`${baseUrl}/api/team/notify`, {
          phoneNumbers,
          message: messageContent
        });

        if (response.data.success) {
          return {
            success: true,
            message: `✅ Notification sent to ${response.data.totalSent} team member(s)`,
            totalSent: response.data.totalSent,
            totalFailed: response.data.totalFailed
          };
        } else {
          return {
            success: false,
            error: response.data.error || 'Failed to send notifications',
            totalSent: response.data.totalSent || 0,
            totalFailed: response.data.totalFailed || activeTeamMembers.length
          };
        }
      } catch (error) {
        console.error('Error sending team notification:', error);
        return {
          success: false,
          error: error.response?.data?.error || error.message || 'Failed to send notifications'
        };
      }
    }

    // Track actions from function calls (for purchase orders, etc.) - declare BEFORE use
    let actions = [];
    const allUserMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = allUserMessages[allUserMessages.length - 1];
    const lastUserContent = (lastUserMessage?.content || '').toLowerCase();
    const allMessagesText = messages.map(m => m.content || '').join(' ').toLowerCase();

    // ── PRE-ROUTER: DAILY LOG DETECTION ────────────────────────────────────
    // Check if user is in a daily log flow - if so, don't trigger expense detection
    const messageLower = String(message || '').toLowerCase();
    const dailyLogPattern = /\b(daily\s+log|job\s+log|site\s+note|add\s+note|log\s+for\s+today|record\s+what\s+happened|daily\s+job\s+log)\b/i;
    const isDailyLogFlow = dailyLogPattern.test(messageLower);
    
    // Check if assistant recently asked about daily log
    const recentMessages = messages.slice(-6);
    const assistantAskedAboutDailyLog = recentMessages.some(m => 
      m.role === 'assistant' && /\b(daily\s+log|job\s+log|site\s+note|notes?\s+would\s+you\s+like|what\s+happened|what\s+notes)\b/i.test(m.content || '')
    );
    
    const inDailyLogContext = isDailyLogFlow || assistantAskedAboutDailyLog;
    
    // ── PRE-ROUTER: MISSING COST SCAN (must run before CO flow can steal it) ─
    // If user says "scan for missing costs" etc., treat as NEW intent — never as change order follow-up
    const preRouterMissingCostScan = messageLower.includes('missing cost') || messageLower.includes('missing costs') ||
      (messageLower.includes('scan') && messageLower.includes('cost')) || messageLower.includes('cost gaps') || messageLower.includes('what am i missing');
    if (preRouterMissingCostScan) {
      console.log('🛡️ PRE-ROUTER: Detected missing cost scan — will use deterministic handler (not CO flow)');
    }

    // ── PRE-ROUTER: EXPENSE LOGGING DETECTION ──────────────────────────────
    // Catch expense logging requests BEFORE router runs to prevent misclassification
    // BUT skip if user is in a daily log flow
    if (!inDailyLogContext) {
      const combinedMessage = (messageLower + ' ' + lastUserContent).toLowerCase();
      const hasLogKeyword = /\b(log|record|add)\b/i.test(combinedMessage);
      const hasExpenseKeyword = /\bexpense/i.test(combinedMessage) || 
                                /\b(spent|bought|purchased)\b/i.test(combinedMessage);
      const preRouterIsExpenseLogging = hasLogKeyword && hasExpenseKeyword;
      const preRouterHasExpenseType = /\b(material|materials|labor|labour)\b/i.test(combinedMessage);
      
      // If this is clearly an expense logging request without type, return early
      if (preRouterIsExpenseLogging && !preRouterHasExpenseType) {
        console.log('🛑 PRE-ROUTER: Detected expense logging without type → returning early');
        const question = 'What type of expense are you logging? Is it for materials or labor? If it\'s for materials, please provide the amount, category, and vendor. If it\'s for labor, please provide the amount, category (Labor), and what the labor was for.';
        return res.json({ reply: question, actions: [], projectUpdateData: null });
      }
    } else {
      console.log('📝 PRE-ROUTER: User is in daily log flow, skipping expense detection');
    }

    // ── PRE-ROUTER: CANCEL CHANGE ORDER ─────────────────────────────────────
    // If assistant was asking for change order details and user says cancel, exit flow immediately
    const lastAssistantMsg = String([...messages].reverse().find((m) => m?.role === 'assistant')?.content || '').toLowerCase();
    const assistantAskedCODetails = (lastAssistantMsg.includes('change order') && (lastAssistantMsg.includes('amount') || lastAssistantMsg.includes('vendor') || lastAssistantMsg.includes('what is the change order')));
    const cancelIntent = /\b(cancel|nevermind|never mind|forget it|forget this|abort|stop|don't? need|dont need)\b/i.test(messageLower) ||
      (messageLower.includes('cancel') && messageLower.includes('change order'));
    if (assistantAskedCODetails && cancelIntent) {
      console.log('🛑 PRE-ROUTER: User cancelled change order flow — returning early');
      return res.json({
        reply: 'Change order cancelled. What would you like to do next?',
        actions: [],
        projectUpdateData: null,
      });
    }

    // ── PRE-ROUTER: ADD TEAM MEMBER (name provided) ──────────────────────────
    // When assistant asked for name to ADD, user's response is the new member's name → ask for phone
    const lastAssistantForAdd = String([...messages].reverse().find((m) => m?.role === 'assistant')?.content || '');
    const lastAssistantLower = lastAssistantForAdd.toLowerCase();
    const askedForNameToAdd = /(?:name of the team member you'?d like to add|team member you'?d like to add|team member.*like to add)/i.test(lastAssistantLower);
    const looksLikeName = message.trim().length >= 2 && message.trim().length <= 50 && !/\d{3,}/.test(message) && !message.includes('$');
    if (askedForNameToAdd && looksLikeName && projectId) {
      const memberName = message.trim();
      console.log('🛑 PRE-ROUTER: Add team member (name provided) — asking for phone');
      return res.json({
        reply: `What is the phone number for ${memberName}?`,
        actions: [],
        projectUpdateData: null,
      });
    }

    // ── PRE-ROUTER: ADD TEAM MEMBER (phone provided) ────────────────────────
    // When assistant asked for phone number for [name], user's response is the phone → execute add
    const askedForPhoneForAdd = /what is the phone number for .+\?/i.test(lastAssistantForAdd);
    const looksLikePhone = /[\d\s\-\(\)\.\+]{7,}/.test(message.trim()) || (message.trim().length >= 7 && /\d{3}/.test(message));
    if (askedForPhoneForAdd && looksLikePhone && projectId) {
      const phoneMatch = lastAssistantForAdd.match(/what is the phone number for (.+)\?/i);
      const memberName = phoneMatch ? phoneMatch[1].trim() : '';
      const phone = message.trim();
      if (memberName) {
        const addAction = {
          type: 'add_team_member',
          projectId,
          teamMember: { name: memberName, role: 'Crew Member', phone },
          projectName: parsedContext?.projectName || parsedContext?.bidTitle || 'this project',
        };
        console.log('🛑 PRE-ROUTER: Add team member (phone provided) — executing');
        return res.json({
          reply: `✅ Added ${memberName} to the team. They'll appear in your Team tab.`,
          actions: [addAction],
          projectUpdateData: null,
        });
      }
    }

    // ── PRE-ROUTER: ASSIGN PM (no name specified) ───────────────────────────
    const assignPMIntent = /\b(assign|appoint|set|name|pick|choose|select)\s+(a\s+)?(project\s+manager|pm)\b/i.test(messageLower) ||
      /\bassign\s+pm\b/i.test(messageLower) ||
      /\b(project\s+manager|pm)\s+for\s+(me|this)/i.test(messageLower) ||
      /\b(name|pick|choose)\s+(a\s+)?(project\s+manager|pm)\s+for\s+me/i.test(messageLower) ||
      (messageLower.includes('project manager') && (messageLower.includes('assign') || messageLower.includes('appoint') || messageLower.includes('name') || messageLower.includes('pick') || messageLower.includes('choose')));
    // User specified a name if message has "assign X as" or "assign X to be" or similar
    const hasPMNameSpecified = /\b(assign|appoint|set)\s+[a-z]+\s+(as|to\s+be)\s+(project\s+manager|pm)/i.test(messageLower) ||
      /^(assign|appoint|set)\s+[a-z][a-z\s]+$/i.test(message.trim()) && message.trim().split(/\s+/).length <= 4;
    if (assignPMIntent && !hasPMNameSpecified) {
      const teamMembers = parsedContext?.teamMembers || [];
      let reply = 'Which team member do you want to appoint as project manager, or do you want to add a team member as PM?';
      if (teamMembers.length > 0) {
        const names = teamMembers.map(m => m.name || 'Unknown').filter(Boolean);
        reply += `\n\nCurrent team: ${names.join(', ')}`;
      }
      console.log('🛑 PRE-ROUTER: Assign PM — asking for team member selection');
      return res.json({ reply, actions: [], projectUpdateData: null });
    }

    // ── PRE-ROUTER: UPDATE TEAM MEMBER STATUS ─────────────────────────────────
    // Match both: (1) follow-up "john active" after assistant asked, (2) direct "turn nicholas to off duty" / "can you make john active"
    const lastAssistantForStatus = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
    const askedAboutStatusUpdate = /which team member.*status|team member.*status.*update|what is the new status|status would you like to update/i.test(lastAssistantForStatus);
    const msg = message.trim();
    let memberName, newStatus;

    // Pattern 1: "john active" or "john off duty" (short form)
    const simplePattern = /^(.+?)\s+(active|off\s*duty|off_duty)$/i;
    const simpleMatch = msg.match(simplePattern);
    if (simpleMatch) {
      memberName = simpleMatch[1].trim();
      newStatus = (simpleMatch[2] || '').toLowerCase().replace(/\s+/g, '_');
    }

    // Pattern 2: "make/set/mark/put X active/off duty"
    const makeSetPattern = /^(make|set|mark|put)\s+(.+?)\s+(active|off\s*duty|off_duty)$/i;
    const makeMatch = msg.match(makeSetPattern);
    if (makeMatch && !memberName) {
      memberName = makeMatch[2].trim();
      newStatus = (makeMatch[3] || '').toLowerCase().replace(/\s+/g, '_') || 'active';
    }

    // Pattern 3: "turn X (team member)? (to)? off duty/active" or "can you turn X team member to off duty"
    const turnPattern = /(?:can you |please )?turn\s+(.+?)\s+(?:team\s+member\s+)?(?:to\s+)?(active|off\s*duty|off_duty)/i;
    const turnMatch = msg.match(turnPattern);
    if (turnMatch && !memberName) {
      memberName = turnMatch[1].trim();
      newStatus = (turnMatch[2] || '').toLowerCase().replace(/\s+/g, '_');
    }

    // Pattern 4: "change X (to)? off duty/active" or "change X team member to off duty"
    const changePattern = /(?:can you |please )?change\s+(.+?)\s+(?:team\s+member\s+)?(?:to\s+)?(active|off\s*duty|off_duty)/i;
    const changeMatch = msg.match(changePattern);
    if (changeMatch && !memberName) {
      memberName = changeMatch[1].trim();
      newStatus = (changeMatch[2] || '').toLowerCase().replace(/\s+/g, '_');
    }

    // Pattern 5: "make X team member off duty" / "set X team member to active"
    const makeTeamPattern = /(?:can you |please )?(make|set)\s+(.+?)\s+team\s+member\s+(?:to\s+)?(active|off\s*duty|off_duty)/i;
    const makeTeamMatch = msg.match(makeTeamPattern);
    if (makeTeamMatch && !memberName) {
      memberName = makeTeamMatch[2].trim();
      newStatus = (makeTeamMatch[3] || '').toLowerCase().replace(/\s+/g, '_');
    }

    if (newStatus === 'offduty') newStatus = 'off_duty';
    const hasValidStatusUpdate = memberName && (newStatus === 'active' || newStatus === 'off_duty') && projectId;
    // Execute for: direct requests (turn/change/make team member) OR follow-up (john active) after assistant asked
    const isDirectRequest = !!(turnMatch || changeMatch || makeTeamMatch || makeMatch);
    const shouldExecute = hasValidStatusUpdate && (isDirectRequest || (simpleMatch && askedAboutStatusUpdate));
    if (shouldExecute) {
        const updateAction = {
          type: 'update_team_member_status',
          projectId,
          memberName,
          status: newStatus,
          projectName: parsedContext?.projectName || parsedContext?.bidTitle || 'this project',
        };
        console.log('🛑 PRE-ROUTER: Update team member status — executing', { memberName, newStatus });
        return res.json({
          reply: `✅ Updated ${memberName} to ${newStatus === 'active' ? 'active' : 'off duty'}.`,
          actions: [updateAction],
          projectUpdateData: null,
        });
    }

    // ── PRE-ROUTER: TEAM STATUS ─────────────────────────────────────────────
    // Deterministic team status: who's working, active, off duty
    const teamStatusIntent = /\b(team\s+status|status\s+of\s+(?:your\s+)?team|who'?s\s+working|who\s+is\s+working|team\s+availability|active\s+team|who'?s\s+active|team\s+members?\s+status)\b/i.test(messageLower);
    if (teamStatusIntent) {
      const teamMembers = parsedContext?.teamMembers || [];
      const teamStats = parsedContext?.teamStats || { total: 0, active: 0, offDuty: 0 };
      if (teamMembers.length > 0) {
        const activeList = teamMembers.filter(m => (m.status || '').toLowerCase() === 'active');
        const offDutyList = teamMembers.filter(m => (m.status || '').toLowerCase() === 'off_duty' || (m.status || '').toLowerCase() === 'off duty');
        let reply = `📊 **Team Status**\n\n`;
        reply += `Total: ${teamStats.total || teamMembers.length} | Active: ${teamStats.active || activeList.length} | Off duty: ${teamStats.offDuty || offDutyList.length}\n\n`;
        if (activeList.length > 0) {
          reply += `**Working / Active:**\n`;
          activeList.forEach(m => {
            reply += `• ${m.name || 'Unknown'} (${m.role || 'N/A'})\n`;
          });
          reply += `\n`;
        }
        if (offDutyList.length > 0) {
          reply += `**Off duty:**\n`;
          offDutyList.forEach(m => {
            reply += `• ${m.name || 'Unknown'} (${m.role || 'N/A'})\n`;
          });
        }
        if (activeList.length === 0 && offDutyList.length === 0) {
          reply += teamMembers.map(m => `• ${m.name || 'Unknown'} (${m.role || 'N/A'}, ${m.status || 'N/A'})`).join('\n');
        }
        console.log('🛑 PRE-ROUTER: Team status — returning deterministic reply');
        return res.json({ reply, actions: [], projectUpdateData: null });
      } else {
        const reply = `📊 **Team Status**\n\nYou don't have any team members set up yet. Add team members in the Team tab, or say "Add team member" to add one via the assistant.`;
        console.log('🛑 PRE-ROUTER: Team status (no members) — returning early');
        return res.json({ reply, actions: [], projectUpdateData: null });
      }
    }

    // ── PRE-ROUTER: CHANGE ORDER DETECTION ──────────────────────────────────
    // Catch change order requests BEFORE router runs to ensure consistent behavior with bubble clicks
    const changeOrderPattern = /\b(create|add|make|i need|i want|give me|start)\s+(me\s+)?(a|the)?\s*(change\s+order|change\s+the\s+order|changeorder)\b/i;
    const hasChangeOrderIntent = changeOrderPattern.test(messageLower) ||
                                 /\bchange\s+order\b/i.test(messageLower) ||
                                 /\bscope\s+change\b/i.test(messageLower) ||
                                 /\bclient\s+wants\s+to\s+add\b/i.test(messageLower) ||
                                 /\bextra\s+work\b/i.test(messageLower);
    
    // Check if CO fields are already provided in the message
    const coFieldsInMessage = inferCOFieldsFromUserMessages([{ role: 'user', content: message }]);
    const hasCOFields = !!(coFieldsInMessage.description && coFieldsInMessage.amount && coFieldsInMessage.vendor);
    
    // If this is a change order request but fields are missing, let it go through to router
    // (router will ask for missing fields). If all fields present, also let it through to execute.
    // This ensures typed "create a change order" works the same as clicking the bubble
    if (hasChangeOrderIntent) {
      console.log('🛑 PRE-ROUTER: Detected change order request', { 
        hasCOFields, 
        description: coFieldsInMessage.description,
        amount: coFieldsInMessage.amount,
        vendor: coFieldsInMessage.vendor
      });
      // Don't return early - let it go through to router which will handle missing fields
      // This ensures the same flow as clicking the bubble
    }

    // ── STAGE 1: ROUTER ──────────────────────────────────────────────────────
    // Replaces keyword heuristics. GPT decides intent + whether required fields are present.
    logPhase('router_start');
    const poFlowContext = inferPOFieldsFromUserMessages(
      getPOFlowUserMessages([
        ...history.filter(m => m?.role && m?.content),
        { role: 'user', content: message },
      ])
    );

    const coFlowContext = inferCOFieldsFromUserMessages(
      getCOFlowUserMessages([
        ...history.filter(m => m?.role && m?.content),
        { role: 'user', content: message },
      ])
    );
    
    console.log('🔍 CO Flow Context:', JSON.stringify({
      description: coFlowContext.description,
      amount: coFlowContext.amount,
      vendor: coFlowContext.vendor,
      hasDescription: !!coFlowContext.description,
      hasAmount: !!coFlowContext.amount,
      hasVendor: !!coFlowContext.vendor,
      userMessages: getCOFlowUserMessages([
        ...history.filter(m => m?.role && m?.content),
        { role: 'user', content: message },
      ]).map(m => m.content),
    }));

    // ── EXPLICIT EXPENSE LOGGING DETECTION (after router) ──────────────────
    // Re-use variables from pre-router check
    // BUT skip if user is in a daily log flow
    const combinedMessageForExpense = (messageLower + ' ' + lastUserContent).toLowerCase();
    
    // Check if we're still in a daily log context (from pre-router check or recent messages)
    const recentMessagesForExpenseCheck = messages.slice(-6);
    const assistantAskedAboutDailyLogForExpense = recentMessagesForExpenseCheck.some(m => 
      m.role === 'assistant' && /\b(daily\s+log|job\s+log|site\s+note|notes?\s+would\s+you\s+like|what\s+happened|what\s+notes)\b/i.test(m.content || '')
    );
    const isDailyLogRequest = dailyLogPattern.test(messageLower);
    const inDailyLogContextForExpense = isDailyLogRequest || assistantAskedAboutDailyLogForExpense || inDailyLogContext;
    
    // More flexible detection - check for "log" + "expense" anywhere in the message
    // Handles patterns like "can you log an expense", "i need to log an expense", "log expense", etc.
    // BUT exclude if it's a daily log request
    const hasLogKeywordForExpense = /\b(log|record|add)\b/i.test(combinedMessageForExpense);
    const hasExpenseKeywordForExpense = /\bexpense/i.test(combinedMessageForExpense) || 
                              /\b(spent|bought|purchased)\b/i.test(combinedMessageForExpense);
    const isExpenseLoggingRequest = hasLogKeywordForExpense && hasExpenseKeywordForExpense && !inDailyLogContextForExpense;
    
    // Check if expense type is already specified (materials/labor)
    const hasExpenseType = /\b(material|materials|labor|labour)\b/i.test(combinedMessageForExpense);
    
    console.log('🔍 Expense logging detection:', { 
      isExpenseLoggingRequest, 
      hasExpenseType,
      hasLogKeywordForExpense,
      hasExpenseKeywordForExpense,
      inDailyLogContextForExpense,
      message: message?.substring(0, 50),
      lastUserContent: lastUserContent.substring(0, 50),
      combinedMessage: combinedMessageForExpense.substring(0, 80)
    });

    const routerResult = await withTimeout(runRouter(
      message,
      history,
      {
        projectName,
        projectId,
        activeTab,
        pmMode: aiPmMode,
        inDailyLogFlow: inDailyLogContextForExpense, // Pass daily log context to router
        poFlow: {
          hasAmount: !!poFlowContext.amount,
          hasVendor: !!poFlowContext.vendor,
          hasCategory: !!poFlowContext.category,
          hasExpectedDelivery: !!poFlowContext.expectedDelivery,
        },
        coFlow: {
          hasDescription: !!coFlowContext.description,
          hasAmount: !!coFlowContext.amount,
          hasVendor: !!coFlowContext.vendor,
        },
      }
    ), 12000, 'router_stage');
    
    // ── CRITICAL: DAILY LOG PROTECTION ───────────────────────────────────────
    // NEVER let expense guards override daily_log domain - daily logs are NOT expenses
    // If we KNOW we're in a daily log context (assistant asked about notes), FORCE the router
    // to daily_log domain regardless of what it returned. The router (GPT-4o-mini) sometimes
    // misclassifies follow-up answers like "Passes framing inspection" as expenses.
    // BUT: Only auto-extract noteText if assistant ALREADY asked for notes (not on initial request)
    if (inDailyLogContextForExpense && routerResult.domain !== 'daily_log') {
      console.log('🛡️ DAILY LOG OVERRIDE: Router said', routerResult.domain, '/', routerResult.proposed_tool, 
        'but we are in daily log context → forcing daily_log domain');
      routerResult.domain = 'daily_log';
      routerResult.proposed_tool = 'add_daily_log';
      
      // Only auto-extract noteText if assistant ALREADY asked about notes (user is responding with notes)
      // If this is the initial request ("Add a daily job log"), don't extract - let it ask for notes first
      const isInitialRequest = /\b(add|create|log|record)\b.*\b(daily\s+(?:job\s+)?log|job\s+log|daily\s+log)\b/i.test(messageLower);
      const assistantAlreadyAskedForNotes = assistantAskedAboutDailyLogForExpense;
      
      if (assistantAlreadyAskedForNotes && !isInitialRequest) {
        // Assistant asked for notes, user is responding with actual notes → extract as noteText
        if (!routerResult.tool_args_draft) routerResult.tool_args_draft = {};
        if (!routerResult.tool_args_draft.noteText && message && message.trim()) {
          routerResult.tool_args_draft.noteText = message.trim();
          routerResult.required_fields_missing = [];
          routerResult.clarification_question = null;
          console.log('🛡️ Daily log: extracted noteText from user response:', message.trim().substring(0, 50));
        }
      } else {
        // Initial request or assistant hasn't asked yet → require noteText (will ask for it)
        routerResult.required_fields_missing = ['noteText'];
        routerResult.clarification_question = 'What notes would you like to include in the daily job log for today?';
        console.log('🛡️ Daily log: initial request, will ask for notes');
      }
      
      routerResult.confidence = 0.99;
    }
    
    const isDailyLogDomain = routerResult.domain === 'daily_log' || routerResult.proposed_tool === 'add_daily_log';
    
    // ── EXPENSE LOGGING GUARD (similar to CO guard) ──────────────────────────
    // If user wants to log an expense but hasn't specified material/labor, force the question
    // BUT skip if user is in a daily log flow OR router already said daily_log
    if (isExpenseLoggingRequest && !hasExpenseType && !inDailyLogContextForExpense && !isDailyLogDomain) {
      console.log('🛡️ Expense logging guard: user wants to log expense but type not specified');
      // Override router result to ensure expense domain and required field
      if (routerResult.domain !== 'expenses' || !routerResult.required_fields_missing?.includes('expense_type')) {
        routerResult.domain = 'expenses';
        routerResult.proposed_tool = 'add_material_expense';
        routerResult.required_fields_missing = ['expense_type'];
        routerResult.clarification_question = 'What type of expense are you logging? Is it for materials or labor? If it\'s for materials, please provide the amount, category, and vendor. If it\'s for labor, please provide the amount, category (Labor), and what the labor was for.';
        routerResult.confidence = 0.95;
        console.log('🛡️ Expense guard: overriding router to ask for expense type');
      }
    } else if (isDailyLogDomain) {
      console.log('🛡️ Daily log protection: router says daily_log, blocking expense guard override');
    }

    // ── SCENARIO-ANALYSIS GUARD ──────────────────────────────────────────────
    // For generic "what if" requests, ask user to pick one preset scenario.
    // If user picks one, run immediately with no extra questions.
    const scenarioIntentRegex = /\b(what\s*if|scenario analysis|run a scenario analysis|run scenario analysis|project outcome scenario|outcome scenario)\b/i;
    const delayOverrunIntentRegex = /\b(delay(?:ed)?|overrun|too\s+long|longer|beyond\s+(?:the\s+)?(?:timeline|schedule)|go(?:es|ing)?\s+on\s+too\s+long|run(?:s|ning)?\s+long|extends?)\b/i;
    const delayOverrunContext = delayOverrunIntentRegex.test(String(message || '')) ||
      [...history]
        .slice(-6)
        .some((m) => m?.role === 'user' && delayOverrunIntentRegex.test(String(m?.content || '')));
    const lastAssistantScenarioMsg = String(
      [...history].reverse().find((m) => m?.role === 'assistant')?.content || ''
    ).toLowerCase();
    const lastAssistantAskedScenarioChoice =
      lastAssistantScenarioMsg.includes('typical friction') &&
      lastAssistantScenarioMsg.includes('bad remodel') &&
      lastAssistantScenarioMsg.includes('smooth job');
    const scenarioChoiceMap = [
      { regex: /\btypical\s*friction\b/i, value: 'typical_friction' },
      { regex: /\btypical\s+friction\b/i, value: 'typical_friction' }, // Match with space
      { regex: /\btypical\b/i, value: 'typical_friction' }, // Match just "typical" if in scenario context
      { regex: /\bbad\s*remodel\b/i, value: 'bad_remodel' },
      { regex: /\bbad\s+remodel\b/i, value: 'bad_remodel' }, // Match with space
      { regex: /\bsmooth\s*job\b/i, value: 'smooth_job' },
      { regex: /\bsmooth\s+job\b/i, value: 'smooth_job' }, // Match with space
      { regex: /\blabor\s*\+?\s*10%?\b/i, value: 'labor_up_10' },
      { regex: /\blabor\s*-\s*10%?\b/i, value: 'labor_down_10' },
      { regex: /\bmaterials?\s*\+?\s*10%?\b/i, value: 'materials_up_10' },
      { regex: /\bmaterials?\s*\+?\s*5%?\b/i, value: 'materials_up_5' },
      { regex: /\bmaterials?\s*-\s*5%?\b/i, value: 'materials_down_5' },
      { regex: /\boverhead\s*\+?\s*10%?\b/i, value: 'overhead_up_10' },
      { regex: /\boverhead\s*-\s*10%?\b/i, value: 'overhead_down_10' },
      { regex: /\bbid\s*\+?\s*2%?\b/i, value: 'bid_up_2' },
      { regex: /\bbid\s*-\s*2%?\b/i, value: 'bid_down_2' },
    ];
    const selectedScenario = scenarioChoiceMap.find(({ regex }) => regex.test(String(message || '')))?.value || null;
    const isGenericScenarioRequest =
      scenarioIntentRegex.test(String(message || '')) &&
      !selectedScenario &&
      !delayOverrunContext;
    // CRITICAL: If user selected a scenario (even without "what if" in message), activate flow
    // This handles the case where user responds "Typical friction" to the AI's question
    const isScenarioFlowActive = !!selectedScenario || (!delayOverrunContext && (isGenericScenarioRequest || lastAssistantAskedScenarioChoice));

    if (isScenarioFlowActive) {
      routerResult.domain = 'scenario_analysis';
      routerResult.proposed_tool = 'run_scenario_analysis';
      routerResult.tool_args_draft = routerResult.tool_args_draft || {};

      if (selectedScenario) {
        routerResult.tool_args_draft.scenario = selectedScenario;
        routerResult.required_fields_missing = [];
        routerResult.clarification_question = null;
        routerResult.confidence = 1.0;
        routerResult.action = 'execute';
        console.log('🛡️ Scenario guard: scenario selected, executing', selectedScenario);
      } else {
        routerResult.required_fields_missing = ['scenario'];
        routerResult.clarification_question = 'Run a scenario analysis for this project. Do you want Typical Friction, Bad Remodel, or Smooth Job?';
        routerResult.confidence = 0.99;
        console.log('🛡️ Scenario guard: asking user to choose scenario preset');
      }
    }

    const changeOrderIntentRegex = /\b(change\s+(?:the\s+)?order|changeorder|create.*change\s+(?:the\s+)?order|add.*change\s+(?:the\s+)?order|scope change|extra work|client wants to add)\b/i;
    const lastAssistantCOPrompt = String(
      [...history].reverse().find((m) => m?.role === 'assistant')?.content || ''
    ).toLowerCase().includes('change order');
    // CRITICAL: Only activate CO flow if there's an actual change order intent phrase
    // Don't activate just because there's a description/amount (those could be for expenses)
    const hasCOIntentInHistory = getCOFlowUserMessages([
      ...history.filter(m => m?.role && m?.content),
      { role: 'user', content: message },
    ]).length > 0;
    // CRITICAL: Never treat "scan for missing costs" as a change order follow-up — user switched intent
    const isMissingCostScanMsg = (msgLower.includes('missing cost') || msgLower.includes('missing costs') ||
      (msgLower.includes('scan') && msgLower.includes('cost')) || msgLower.includes('cost gaps') || msgLower.includes('what am i missing'));
    const isChangeOrderFlowActive = !isMissingCostScanMsg && (
      changeOrderIntentRegex.test(String(message || '').toLowerCase()) ||
      lastAssistantCOPrompt ||
      hasCOIntentInHistory
    );

    // Hard guard: if we're in a change-order flow, never allow PO/date requirements to leak in.
    if (isChangeOrderFlowActive) {
      if (routerResult.domain !== 'change_order' || routerResult.proposed_tool !== 'create_change_order') {
        console.log('🛡️ CO guard: overriding router domain/tool to create_change_order');
        routerResult.domain = 'change_order';
        routerResult.proposed_tool = 'create_change_order';
      }

      // Enforce only CO-required fields: description, amount, vendor
      // CRITICAL: Use extracted context, NOT the router's hallucinated fields
      const hasDescription = !!coFlowContext.description && String(coFlowContext.description).trim().length > 0;
      const hasAmount = !!coFlowContext.amount && Number(coFlowContext.amount) > 0;
      const hasVendor = !!coFlowContext.vendor && String(coFlowContext.vendor).trim().length > 0;
      
      console.log('🛡️ CO guard: checking extracted fields:', {
        hasDescription, hasAmount, hasVendor,
        description: coFlowContext.description,
        amount: coFlowContext.amount,
        vendor: coFlowContext.vendor,
      });
      
      // Build missing fields list from actual extracted values only
      const coMissing = [];
      if (!hasDescription) coMissing.push('description');
      if (!hasAmount) coMissing.push('amount');
      if (!hasVendor) coMissing.push('vendor');
      
      // NEVER include delivery dates or PO-only fields
      routerResult.required_fields_missing = coMissing;
      console.log('🛡️ CO guard: final required_fields_missing:', routerResult.required_fields_missing);

      if (coMissing.length === 0) {
        routerResult.clarification_question = null;
        routerResult.required_fields_missing = [];
        routerResult.confidence = 1.0;
        routerResult.tool_args_draft = routerResult.tool_args_draft || {};
        routerResult.tool_args_draft.description = coFlowContext.description;
        routerResult.tool_args_draft.amount = coFlowContext.amount;
        routerResult.tool_args_draft.vendor = coFlowContext.vendor;
        // Force the executor to call the tool immediately — no confirmation step needed
        routerResult.action = 'execute';
        console.log('🛡️ CO guard: all fields present → forcing execution, tool_args_draft:', routerResult.tool_args_draft);
      } else {
        // Build a natural clarification question listing only missing fields
        // CRITICAL: Only ask for fields that are actually missing, based on extracted context
        if (coMissing.length === 3) {
          routerResult.clarification_question = 'What is the change order for, the amount, and the vendor?';
        } else if (coMissing.length === 2) {
          // If description is missing but amount is present, ask specifically for description
          if (coMissing.includes('description') && !coMissing.includes('amount')) {
            routerResult.clarification_question = 'What is the change order for?';
          } else if (coMissing.includes('amount') && !coMissing.includes('description')) {
            routerResult.clarification_question = 'What is the amount?';
          } else {
            const labels = { description: 'the change order for', amount: 'the amount', vendor: 'the vendor' };
            const parts = coMissing.map(f => labels[f] || f);
            routerResult.clarification_question = `What is ${parts[0]} and ${parts[1]}?`;
          }
        } else {
          const labels = { description: 'the change order for', amount: 'the amount', vendor: 'the vendor' };
          routerResult.clarification_question = `What is ${labels[coMissing[0]] || coMissing[0]}?`;
        }
      }
    }

    // ── PAYMENT-COLLECTION GUARD (after CO guard, before executor) ─────────
    // Ensure "mark payment collected" uses pending timeline milestones by name (not ID).
    const pendingPaymentMilestones = getPendingPaymentMilestones(parsedContext);
    const paymentCollectIntentRegex = /\b(mark|set|record).*(payment|deposit|milestone).*(collected|complete|paid)|\b(payment collected|collected payment|mark a payment as collected|got paid|received payment|mark collected)\b/i;
    const lastAssistantPaymentMsg = String(
      [...history].reverse().find((m) => m?.role === 'assistant')?.content || ''
    ).toLowerCase();
    const lastAssistantAskedWhichPayment =
      (lastAssistantPaymentMsg.includes('which milestone') ||
       lastAssistantPaymentMsg.includes('which payment') ||
       lastAssistantPaymentMsg.includes('specify which')) &&
      lastAssistantPaymentMsg.includes('collected');
    const isPaymentCollectionFlowActive =
      paymentCollectIntentRegex.test(String(message || '').toLowerCase()) ||
      routerResult?.proposed_tool === 'mark_payment_collected' ||
      lastAssistantAskedWhichPayment;

    if (isPaymentCollectionFlowActive) {
      routerResult.domain = 'timeline';
      routerResult.proposed_tool = 'mark_payment_collected';
      routerResult.tool_args_draft = routerResult.tool_args_draft || {};

      const userText = String(message || '').trim();
      
      // Check if assistant already asked which payment (user is responding to that question)
      const assistantAlreadyAsked = lastAssistantAskedWhichPayment;
      
      // Check if user is confirming (after we've matched a payment)
      const isConfirmation = /^(yes|yep|ok|okay|confirm|proceed|go ahead|do it|mark it)$/i.test(userText);
      const hasMatchedPaymentInDraft = routerResult.tool_args_draft.milestoneName;
      
      // If user is confirming and we have a matched payment, proceed to execution
      if (isConfirmation && hasMatchedPaymentInDraft) {
        routerResult.required_fields_missing = [];
        routerResult.clarification_question = null;
        routerResult.confidence = 1.0;
        routerResult.action = 'execute';
        console.log('🛡️ Payment guard: user confirmed, proceeding to mark payment as collected');
      } else {
        // Try to match payment name from user's message
        const candidateName = !isConfirmation
          ? (routerResult.tool_args_draft.milestoneName || userText)
          : '';
        const matchedPayment = matchPendingPaymentByName(pendingPaymentMilestones, candidateName);

        if (matchedPayment && !assistantAlreadyAsked) {
          // First time - user clicked button, we found a match (maybe only one payment)
          // Still ask which one to be explicit
          routerResult.required_fields_missing = ['milestoneName'];
          if (pendingPaymentMilestones.length > 0) {
            const options = pendingPaymentMilestones
              .slice(0, 6)
              .map((m) => `"${formatPaymentNameForDisplay(m.title || m.name)}"`)
              .join(', ');
            routerResult.clarification_question = `Which payment should I mark as collected? Pending payments: ${options}.`;
          } else {
            routerResult.clarification_question = 'I could not find any pending payment milestones in the timeline. Please check the Timeline tab.';
          }
          console.log('🛡️ Payment guard: first time - listing pending payments');
        } else if (matchedPayment && assistantAlreadyAsked) {
          // User specified which payment after we asked - now ask for confirmation
          routerResult.required_fields_missing = [];
          routerResult.tool_args_draft.milestoneName = matchedPayment.title || matchedPayment.name;
          if (matchedPayment.id) routerResult.tool_args_draft.milestoneId = matchedPayment.id;
          routerResult.clarification_question = `Mark "${matchedPayment.title || matchedPayment.name}" ($${Number(matchedPayment.amount || 0).toLocaleString()}) as collected?`;
          routerResult.confidence = 1.0;
          // Don't set action = 'execute' yet - wait for confirmation
          console.log('🛡️ Payment guard: matched payment, asking for confirmation:', {
            input: candidateName,
            matchedTitle: matchedPayment.title,
            matchedId: matchedPayment.id,
          });
        } else {
          // No match found - ask which payment
          routerResult.required_fields_missing = ['milestoneName'];
          if (pendingPaymentMilestones.length > 0) {
            const options = pendingPaymentMilestones
              .slice(0, 6)
              .map((m) => `"${formatPaymentNameForDisplay(m.title || m.name)}"`)
              .join(', ');
            routerResult.clarification_question = `Which payment should I mark as collected? Pending payments: ${options}.`;
          } else {
            routerResult.clarification_question = 'I could not find any pending payment milestones in the timeline. Please check the Timeline tab.';
          }
          console.log('🛡️ Payment guard: asking user to choose pending milestone', {
            pendingCount: pendingPaymentMilestones.length,
            input: candidateName,
          });
        }
      }
    }

    // ── FINAL EXPENSE LOGGING CHECK (after CO guard, before executor) ──────
    // Re-check expense logging after all guards have run to ensure it wasn't overridden
    // BUT skip if user is in a daily log flow OR router already said daily_log
    if (isExpenseLoggingRequest && !hasExpenseType && !inDailyLogContextForExpense && !isDailyLogDomain) {
      // Force expense logging intent - override any other domain
      if (routerResult.domain !== 'expenses' || !routerResult.required_fields_missing?.includes('expense_type')) {
        console.log('🛡️ Final expense guard: forcing expense domain and required field');
        routerResult.domain = 'expenses';
        routerResult.proposed_tool = 'add_material_expense';
        routerResult.required_fields_missing = ['expense_type'];
        routerResult.clarification_question = 'What type of expense are you logging? Is it for materials or labor? If it\'s for materials, please provide the amount, category, and vendor. If it\'s for labor, please provide the amount, category (Labor), and what the labor was for.';
        routerResult.confidence = 0.95;
      }
    } else if (isDailyLogDomain) {
      console.log('🛡️ Daily log protection: router says daily_log, blocking final expense guard override');
    }

    logPhase('router_done', { domain: routerResult?.domain, proposedTool: routerResult?.proposed_tool });
    console.log('🧭 Router:', JSON.stringify({ domain: routerResult.domain, tool: routerResult.proposed_tool, missing: routerResult.required_fields_missing, confidence: routerResult.confidence }));

    // CRITICAL: If router says daily_log, manage noteText carefully.
    // On INITIAL requests like "Add a daily job log", we must ASK for notes first.
    // On FOLLOW-UPs (after assistant asked "what notes?"), extract user's answer as noteText.
    if (routerResult.domain === 'daily_log' && routerResult.proposed_tool === 'add_daily_log') {
      if (!routerResult.tool_args_draft) {
        routerResult.tool_args_draft = {};
      }
      
      const isInitialRequest = /\b(add|create|log|record)\b.*\b(daily\s+(?:job\s+)?log|job\s+log|daily\s+log)\b/i.test(messageLower);
      const assistantAskedAboutNotes = recentMessagesForExpenseCheck.some(m => 
        m.role === 'assistant' && /\b(notes?\s+would\s+you\s+like|what\s+notes|what\s+happened|daily\s+(?:job\s+)?log)\b/i.test(m.content || '')
      );
      
      if (isInitialRequest && !assistantAskedAboutNotes) {
        // INITIAL REQUEST: "Add a daily job log for today"
        // The router may have set noteText to the command itself — CLEAR it and ask for real notes
        console.log('🛡️ Daily log: initial request — clearing noteText and asking for notes');
        routerResult.tool_args_draft.noteText = null;
        routerResult.required_fields_missing = ['noteText'];
        routerResult.clarification_question = 'What notes would you like to include in the daily job log for today?';
      } else if (assistantAskedAboutNotes && !isInitialRequest) {
        // FOLLOW-UP: User is answering with actual notes (e.g., "Passes framing inspection")
        if (!routerResult.tool_args_draft.noteText && message && message.trim()) {
          routerResult.tool_args_draft.noteText = message.trim();
        }
        // Ensure required_fields_missing is clear so execution proceeds
        if (routerResult.required_fields_missing?.includes('noteText')) {
          routerResult.required_fields_missing = routerResult.required_fields_missing.filter(f => f !== 'noteText');
        }
        console.log('🛡️ Daily log: follow-up with notes:', (routerResult.tool_args_draft.noteText || '').substring(0, 50));
      }
    }

    // Gate: if required fields are missing → ask the clarification question and stop
    if (routerResult.required_fields_missing && routerResult.required_fields_missing.length > 0) {
      const question = routerResult.clarification_question || `I need a few more details. Could you provide the ${routerResult.required_fields_missing.join(' and ')}?`;
      console.log('🛑 Router: required fields missing →', routerResult.required_fields_missing, '→ asking clarification');
      console.log('🛑 Router: returning early with question:', question);
      return res.json({ reply: question, actions: [], projectUpdateData: null });
    }

    // Map router proposed_tool to finalToolChoice
    const validTools = functions.map(f => f.function.name);
    let finalToolChoice = 'auto';
    if (routerResult.proposed_tool && validTools.includes(routerResult.proposed_tool)) {
      // Force on high-confidence actionable intents (not for budget queries or general chat)
      if (routerResult.domain !== 'general' && routerResult.domain !== 'budget') {
        finalToolChoice = { type: 'function', function: { name: routerResult.proposed_tool } };
        console.log(`🔧 Router forcing tool: ${routerResult.proposed_tool}`);
      }
    } else if (routerResult.domain === 'budget' || routerResult.domain === 'general') {
      finalToolChoice = 'none'; // Let the assistant answer conversationally
    }

    // Safety guard: if user said "mark received" but router picked add_purchase_order → correct it
    const userSaidMarkThisPO = lastUserContent.includes('mark') &&
                               (lastUserContent.includes('received') || lastUserContent.includes('recieved'));
    if (userSaidMarkThisPO && finalToolChoice?.function?.name === 'add_purchase_order') {
      console.log('🔴 Safety guard: correcting add_purchase_order → mark_purchase_order_received');
      finalToolChoice = { type: 'function', function: { name: 'mark_purchase_order_received' } };
    }

    // Legacy compat: keep allAssistantMessages for post-processing checks below
    const allAssistantMessages = messages.filter(m => m.role === 'assistant');
    const lastAssistantMessage = allAssistantMessages[allAssistantMessages.length - 1];
    const userEverAskedForPO = allUserMessages.some(msg => {
      const content = msg.content?.toLowerCase() || '';
      return content.includes('purchase order') || content.match(/\bpo\b/i) || content.includes('create a po');
    });
    
    // (Legacy compat vars — kept for post-processing checks below that still reference them)
    const lastUserMsgLower = lastUserContent;
    const userProvidedAnswer = lastUserContent.length > 0 && !lastUserContent.includes('?');
    
    // ── STAGE 2: EXECUTION ────────────────────────────────────────────────────
    // finalToolChoice is already set by the router above
    
    // If scenario is selected, inject a system hint to execute immediately with preset data
    if (routerResult.action === 'execute' && routerResult.proposed_tool === 'run_scenario_analysis' && routerResult.tool_args_draft?.scenario) {
      const scenarioName = routerResult.tool_args_draft.scenario;
      messages.push({
        role: 'system',
        content: `CRITICAL INSTRUCTION: User selected scenario "${scenarioName}". Call run_scenario_analysis NOW with:
- scenario="${scenarioName}" (this is the SCENARIO TYPE, NOT a project ID)
- projectId="${projectId || null}" (use the actual project ID from context, NOT the scenario name)

CRITICAL: The tool uses the project's EXISTING budget, materials, labor, and overhead data from context. You do NOT need to provide any dollar amounts. The scenario "${scenarioName}" has preset percentage adjustments already defined (e.g., typical_friction = labor +8%, materials +5%, overhead +3%). The tool will automatically:
1. Get the current project budget, materials, labor, overhead from context
2. Apply the preset percentage adjustments
3. Calculate the new costs, profit, and margin

Do NOT ask for dollar amounts, parameters, percentages, or any other details. Just execute the tool immediately with ONLY the scenario parameter. The tool has all the data it needs from context.`,
      });
      console.log('🛡️ Scenario executor hint: injected system message to force immediate execution with scenario:', scenarioName);
    }
    
    // If CO flow has all fields, inject a system hint to execute immediately without asking more questions
    if (isChangeOrderFlowActive && coFlowContext.description && coFlowContext.amount && coFlowContext.vendor) {
      messages.push({
        role: 'system',
        content: `CRITICAL INSTRUCTION: All change order fields are ready. Call create_change_order NOW with description="${coFlowContext.description}", amount=${coFlowContext.amount}, vendor="${coFlowContext.vendor}". Do NOT ask any more questions. Do NOT ask for a date. Change orders do NOT need dates. Just execute the tool.`,
      });
      console.log('🛡️ CO executor hint: injected system message to force immediate execution');
    }
    
    // ✅ WORKING CONFIGURATION - DO NOT CHANGE: Temperature 0.3 and max_tokens 2000 work correctly
    logPhase('executor_llm_start', { toolChoice: typeof finalToolChoice === 'string' ? finalToolChoice : finalToolChoice?.function?.name });
    let completion = await withTimeout(openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      tools: functions,
      tool_choice: finalToolChoice,
      temperature: 0.3, // Lower temperature for more deterministic behavior - DO NOT increase
      max_tokens: 2000, // Increased to prevent truncation - DO NOT decrease
    }), 30000, 'executor_llm');
    logPhase('executor_llm_done');

    let reply = completion.choices[0].message.content || '';
    let toolCalls = completion.choices[0].message.tool_calls || [];

    // CRITICAL: Post-process reply to remove invalid questions for scenario analysis
    const isScenarioAnalysisFlow = routerResult.domain === 'scenario_analysis' ||
                                   routerResult.proposed_tool === 'run_scenario_analysis' ||
                                   toolCalls.some(tc => tc.function?.name === 'run_scenario_analysis');
    
    if (isScenarioAnalysisFlow) {
      // ALWAYS strip dollar amount questions — scenario analysis uses existing project data
      reply = reply.replace(/[^.!?\n]*(?:dollar amount|dollar|amount|how much|what.*amount|need.*amount|provide.*amount|confirm.*amount|specify.*amount)[^.!?\n]*[.!?]?/gi, '');
      reply = reply.replace(/\n{2,}/g, '\n').trim();
      
      if (/dollar amount|need.*amount|provide.*amount|confirm.*amount/i.test(reply)) {
        reply = reply.split(/(?<=[.!?])\s+/).filter(s => !/dollar amount|need.*amount|provide.*amount|confirm.*amount/i.test(s)).join(' ').trim();
      }
      
      // If reply was stripped to empty and we have a tool call, let the tool result speak
      if (!reply || reply.trim().length === 0) {
        console.log('🛡️ Scenario filter: reply was empty after strip, tool will provide results');
        reply = '';
      }
      
      console.log('🛡️ Scenario filter: cleaned reply:', reply.substring(0, 120));
    }

    // CRITICAL: Post-process reply to remove invalid questions for change orders
    const isChangeOrderFlow = isChangeOrderFlowActive || 
                              routerResult.domain === 'change_order' ||
                              routerResult.proposed_tool === 'create_change_order' ||
                              toolCalls.some(tc => tc.function?.name === 'create_change_order');
    
    if (isChangeOrderFlow) {
      // ALWAYS strip delivery/received/pickup/generic date questions — change orders NEVER need dates
      reply = reply.replace(/[^.!?\n]*(?:expected delivery|delivery date|received date|pickup date|delivery or received|what.*(?:date|when))[^.!?\n]*[.!?]?/gi, '');
      reply = reply.replace(/\n{2,}/g, '\n').trim();
      
      if (/expected delivery|delivery date|received date|pickup date|what is that date|what.*date/i.test(reply)) {
        reply = reply.split(/(?<=[.!?])\s+/).filter(s => !/delivery|received date|pickup date|what.*date/i.test(s)).join(' ').trim();
      }
      
      // If reply was stripped to empty, no fallback question needed — the gate already handles missing fields
      if (!reply || reply.trim().length === 0) {
        console.log('🛡️ CO filter: reply was empty after strip, building fallback');
        // Don't produce a fallback question — just let the action/tool result speak for itself
        reply = '';
      }
      
      console.log('🛡️ CO filter: cleaned reply:', reply.substring(0, 120));
    }

    // CRITICAL: Block add_timeline_payment if we're in a change order flow
    // Change orders should NOT create separate payment milestones unless explicitly requested
    if (isChangeOrderFlow && toolCalls.some(tc => tc.function?.name === 'add_timeline_payment')) {
      console.log('🛡️ CO guard: Blocking add_timeline_payment - change orders should not create separate payment milestones');
      // Remove add_timeline_payment tool calls from the list
      toolCalls = toolCalls.filter(tc => tc.function?.name !== 'add_timeline_payment');
      // Update reply to remove any mention of adding payment milestone
      reply = reply.replace(/[^.!?\n]*(?:add.*payment|payment.*milestone|schedule.*payment)[^.!?\n]*[.!?]?/gi, '');
      reply = reply.replace(/\n{2,}/g, '\n').trim();
    }

    // Log if a forced tool call was ignored by the AI
    if (finalToolChoice !== 'auto' && finalToolChoice !== 'none' && toolCalls.length === 0) {
      console.error('❌ Router-forced tool call was ignored by AI:', typeof finalToolChoice === 'object' ? finalToolChoice.function?.name : 'unknown');
    }

    // CRITICAL FALLBACK: If router selected scenario_analysis but executor ignored the tool call,
    // force run_scenario_analysis using the scenario from tool_args_draft.
    if (
      toolCalls.length === 0 &&
      routerResult.action === 'execute' &&
      routerResult.proposed_tool === 'run_scenario_analysis' &&
      routerResult.tool_args_draft?.scenario
    ) {
      const scenarioName = routerResult.tool_args_draft.scenario;
      const fallbackArgs = {
        projectId: projectId || null,
        scenario: scenarioName,
      };
      toolCalls = [
        {
          id: `call_manual_scenario_${Date.now()}`,
          type: 'function',
          function: {
            name: 'run_scenario_analysis',
            arguments: JSON.stringify(fallbackArgs),
          },
        },
      ];
      console.log('🛡️ Scenario fallback: forcing run_scenario_analysis tool call', {
        scenario: scenarioName,
        projectId,
      });
    }
    
    // CRITICAL: Fix scenario analysis tool calls where AI confused scenario with projectId
    // If projectId looks like a scenario name (typical_friction, bad_remodel, smooth_job), swap them
    for (const toolCall of toolCalls) {
      if (toolCall.function?.name === 'run_scenario_analysis') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const scenarioNames = ['typical_friction', 'bad_remodel', 'smooth_job', 'labor_up_10', 'labor_down_10', 
                                'materials_up_5', 'materials_up_10', 'materials_down_5', 'overhead_up_10', 
                                'overhead_down_10', 'bid_up_2', 'bid_down_2'];
          
          // If projectId is actually a scenario name, fix it
          if (args.projectId && scenarioNames.includes(args.projectId) && !args.scenario) {
            console.log('🛡️ Scenario fix: AI passed scenario as projectId, correcting...', {
              wrongProjectId: args.projectId,
              correctProjectId: projectId,
            });
            args.scenario = args.projectId;
            args.projectId = projectId || null;
            toolCall.function.arguments = JSON.stringify(args);
            console.log('✅ Scenario fix: corrected arguments', args);
          }
          
          // If scenario is missing but we have it in tool_args_draft, use it
          if (!args.scenario && routerResult.tool_args_draft?.scenario) {
            args.scenario = routerResult.tool_args_draft.scenario;
            toolCall.function.arguments = JSON.stringify(args);
            console.log('✅ Scenario fix: added scenario from tool_args_draft', args);
          }
        } catch (e) {
          console.error('❌ Scenario fix: error parsing arguments', e);
        }
      }
    }
    
    // CRITICAL FALLBACK: If router selected daily_log but executor ignored the tool call,
    // force add_daily_log using the current user message as noteText.
    // This prevents "daily log" follow-ups from drifting into expense prompts.
    // BUT: Only if assistant ALREADY asked for notes (not on initial request)
    if (
      toolCalls.length === 0 &&
      routerResult.domain === 'daily_log' &&
      routerResult.proposed_tool === 'add_daily_log'
    ) {
      // Check if assistant already asked for notes (user is responding with notes)
      const assistantAskedAboutNotes = recentMessagesForExpenseCheck.some(m => 
        m.role === 'assistant' && /\b(notes?\s+would\s+you\s+like|what\s+notes|what\s+happened)\b/i.test(m.content || '')
      );
      const isInitialRequest = /\b(add|create|log|record)\b.*\b(daily\s+(?:job\s+)?log|job\s+log|daily\s+log)\b/i.test(messageLower);
      
      // Only create fallback tool call if:
      // 1. We have noteText in tool_args_draft (already extracted), OR
      // 2. Assistant asked for notes AND this is NOT an initial request
      const hasNoteTextInDraft = routerResult?.tool_args_draft?.noteText?.trim();
      const shouldCreateFallback = hasNoteTextInDraft || (assistantAskedAboutNotes && !isInitialRequest);
      
      if (shouldCreateFallback) {
        const fallbackNoteText =
          String(routerResult?.tool_args_draft?.noteText || message || '').trim();
        if (fallbackNoteText) {
          const fallbackArgs = {
            projectId: projectId,
            noteText: fallbackNoteText,
            date: routerResult?.tool_args_draft?.date || new Date().toISOString().split('T')[0],
            weather: routerResult?.tool_args_draft?.weather || null,
            crewCount: routerResult?.tool_args_draft?.crewCount || null,
            hoursWorked: routerResult?.tool_args_draft?.hoursWorked || null,
          };
          toolCalls = [
            {
              id: `call_manual_daily_log_${Date.now()}`,
              type: 'function',
              function: {
                name: 'add_daily_log',
                arguments: JSON.stringify(fallbackArgs),
              },
            },
          ];
          console.log('🛡️ Daily log fallback: forcing add_daily_log tool call', {
            notePreview: fallbackNoteText.substring(0, 80),
            projectId,
          });
        }
      } else {
        console.log('🛡️ Daily log fallback: skipping (initial request, will ask for notes first)');
      }
    }
    
    // Safety guard: block add_purchase_order if user's message is about marking as received
    if (userSaidMarkThisPO && toolCalls.length > 0) {
        toolCalls = toolCalls.filter(tc => tc.function?.name !== 'add_purchase_order');
    }
    
    // CRITICAL FALLBACK: If AI says it can't mark PO as received but user asked for it, manually call the function
    const replyLower = reply?.toLowerCase() || '';
    const aiSaidCantDoIt = (replyLower.includes("don't have") || replyLower.includes("don't have the capability") || 
                            replyLower.includes("cannot") || replyLower.includes("can't") || 
                            replyLower.includes("unable") || replyLower.includes("I don't have")) &&
                           (replyLower.includes("mark") || replyLower.includes("received") || replyLower.includes("purchase order"));
    
    // CRITICAL: If user asked to mark as received but AI's reply says it created/recorded a PO, that's wrong!
    const aiSaidCreatedPO = (replyLower.includes('created') || replyLower.includes('recorded')) && 
                            (replyLower.includes('purchase order') || replyLower.includes('po-'));
    const userAskedToMarkReceived = (routerResult.proposed_tool === 'mark_purchase_order_received') || userSaidMarkThisPO;
    
    if (aiSaidCreatedPO && userAskedToMarkReceived) {
      console.error('❌ AI created PO when user asked to mark as received - updating reply to give manual instructions');
      
      // Update the reply to tell user to mark it manually - DO NOT call any function
      reply = "To mark the purchase order as received, go to the Purchase Orders page and tap the 'Received' button on the purchase order you want to mark.";
      
      // Remove any function calls that were made
      toolCalls = [];
      console.log('✅ Updated reply to tell user to mark manually');
    }
    
    // CRITICAL: Even if AI called a function, if user wants to mark as received, block add_purchase_order but allow mark_purchase_order_received
    if (userAskedToMarkReceived && toolCalls.length > 0) {
      const hasAddPO = toolCalls.some(tc => tc.function?.name === 'add_purchase_order');
      const hasMarkReceived = toolCalls.some(tc => tc.function?.name === 'mark_purchase_order_received');
      
      if (hasAddPO) {
        console.error('❌ CRITICAL: AI called add_purchase_order when user wants to mark as received! Blocking it...');
        // Remove add_purchase_order calls but keep mark_purchase_order_received
        toolCalls = toolCalls.filter(tc => tc.function?.name !== 'add_purchase_order');
        console.log('✅ Blocked add_purchase_order, allowing mark_purchase_order_received');
      }
      
      if (hasMarkReceived) {
        console.log('✅ Allowing mark_purchase_order_received function call');
      }
    }

    // Track project updates from function calls
    let projectUpdateData = null;
    
    // Note: actions is already declared above before the forced function call check
    
    // Track which functions have been called successfully to prevent duplicates
    const successfulFunctionCalls = new Set();
    
    // Execute function calls if any
    if (toolCalls.length > 0) {
      console.log('✅ Tool calls detected, processing...', {
        count: toolCalls.length,
        functions: toolCalls.map(tc => tc.function?.name)
      });
      // Add assistant's message with tool calls to conversation
      // If toolCalls were manually injected (e.g. daily log fallback), the original
      // completion message won't contain them → build a synthetic assistant message
      const originalMsg = completion.choices[0].message;
      const originalToolCalls = originalMsg.tool_calls || [];
      const hasManualToolCalls = toolCalls.some(tc => tc.id?.startsWith('call_manual_'));
      
      if (hasManualToolCalls && originalToolCalls.length === 0) {
        // Build a synthetic assistant message that OpenAI expects
        messages.push({
          role: 'assistant',
          content: reply || null,
          tool_calls: toolCalls,
        });
        console.log('🛡️ Injected synthetic assistant message with manual tool_calls');
      } else {
        messages.push(originalMsg);
      }

      // Track project lookup results to use in subsequent calls
      let resolvedProjectInfo = null;

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let functionArgs = JSON.parse(toolCall.function.arguments);
        
        // CRITICAL FIX: Correct scenario analysis tool calls where AI confused scenario with projectId
        if (functionName === 'run_scenario_analysis') {
          const scenarioNames = ['typical_friction', 'bad_remodel', 'smooth_job', 'labor_up_10', 'labor_down_10', 
                                'materials_up_5', 'materials_up_10', 'materials_down_5', 'overhead_up_10', 
                                'overhead_down_10', 'bid_up_2', 'bid_down_2', 'custom'];
          
          // If projectId is actually a scenario name, swap them
          if (functionArgs.projectId && scenarioNames.includes(functionArgs.projectId) && !functionArgs.scenario) {
            console.log('🛡️ Scenario fix: AI passed scenario as projectId, correcting...', {
              wrongProjectId: functionArgs.projectId,
              correctProjectId: projectId,
            });
            functionArgs.scenario = functionArgs.projectId;
            functionArgs.projectId = projectId || null;
            // Update the tool call arguments
            toolCall.function.arguments = JSON.stringify(functionArgs);
            console.log('✅ Scenario fix: corrected arguments', functionArgs);
          }
          
          // If scenario is missing but we have it in tool_args_draft, use it
          if (!functionArgs.scenario && routerResult.tool_args_draft?.scenario) {
            functionArgs.scenario = routerResult.tool_args_draft.scenario;
            functionArgs.projectId = projectId || functionArgs.projectId || null;
            toolCall.function.arguments = JSON.stringify(functionArgs);
            console.log('✅ Scenario fix: added scenario from tool_args_draft', functionArgs);
          }
        }
        
        console.log('🔧 AI Assistant: Executing tool call', { functionName, args: { ...functionArgs, token: undefined } });

        // Backfill CO args from the active change-order flow to avoid re-asking provided fields.
        if (functionName === 'create_change_order') {
          const coFlowUserMessages = getCOFlowUserMessages(messages);
          const inferredCO = inferCOFieldsFromUserMessages(coFlowUserMessages);
          console.log('🔍 CO backfill: inferred fields:', inferredCO);
          if ((!functionArgs.description || !String(functionArgs.description).trim()) && inferredCO.description) {
            functionArgs.description = inferredCO.description;
            console.log('✅ CO backfill: set description from context:', inferredCO.description);
          }
          if ((!functionArgs.amount || Number(functionArgs.amount) <= 0) && inferredCO.amount) {
            functionArgs.amount = inferredCO.amount;
            console.log('✅ CO backfill: set amount from context:', inferredCO.amount);
          }
          if ((!functionArgs.vendor || !String(functionArgs.vendor).trim()) && inferredCO.vendor) {
            functionArgs.vendor = inferredCO.vendor;
            console.log('✅ CO backfill: set vendor from context:', inferredCO.vendor);
          }
          
          // CRITICAL: Default addPaymentMilestone to false unless explicitly set to true
          // Only add payment milestone if user explicitly asks for it
          if (functionArgs.addPaymentMilestone !== true) {
            functionArgs.addPaymentMilestone = false;
            console.log('✅ CO: Setting addPaymentMilestone to false (default)');
          }
          
          // CRITICAL: Strip any delivery-date fields the AI may have hallucinated
          delete functionArgs.expectedDelivery;
          delete functionArgs.deliveryDate;
          delete functionArgs.pickupDate;
          
          // PRE-VALIDATION: Check required CO fields (description, amount, vendor) — NOT delivery date
          const coMissing = [];
          if (!functionArgs.description || !String(functionArgs.description).trim()) coMissing.push('the change order for');
          if (!functionArgs.amount || functionArgs.amount <= 0 || isNaN(functionArgs.amount)) coMissing.push('the amount');
          if (!functionArgs.vendor || !String(functionArgs.vendor).trim()) coMissing.push('the vendor');
          
          if (coMissing.length > 0) {
            const question = coMissing.length === 1
              ? `What is ${coMissing[0]}?`
              : `What is ${coMissing.slice(0, -1).join(', ')} and ${coMissing[coMissing.length - 1]}?`;
            console.error('🚫 CO PRE-VALIDATION: missing fields:', coMissing, '→ asking:', question);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                status: 'error',
                error: question,
                message: question,
              })
            });
            continue;
          }
          
          console.log('✅ CO pre-validation passed:', { description: functionArgs.description, amount: functionArgs.amount, vendor: functionArgs.vendor });
        }

        // ── VALIDATION LAYER: run before any write tool ────────────────────
        const validation = validateAction(functionName, functionArgs, {
          projectId,
          allProjects,
          parsedContext,
        });
        if (!validation.valid) {
          console.warn(`🛑 validateAction blocked ${functionName}:`, validation.reason);
          writeAuditLog({
            event: 'validation_blocked',
            tool: functionName,
            args: functionArgs,
            reason: validation.reason,
            projectId,
            userId: req.user?.userId,
            pmMode: aiPmMode,
            userMessage: message,
          });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              success: false,
              status: 'validation_error',
              error: validation.clarificationQuestion,
              blocked: true,
            }),
          });
          continue; // Skip execution — AI will ask the clarification question
        }

        // ✅ WORKING LOGIC - DO NOT CHANGE: Pre-validation prevents placeholder amounts and missing fields
        // PRE-VALIDATION: Check for missing required fields for purchase orders (same logic as materials)
        if (functionName === 'add_purchase_order') {
          // Hard guard: never run PO flow validations while user is in an active change-order flow.
          const coIntentRegex = /\b(change\s+(?:the\s+)?order|changeorder|create.*change\s+(?:the\s+)?order|add.*change\s+(?:the\s+)?order|scope change|extra work|client wants to add)\b/i;
          const coUserMsgs = getCOFlowUserMessages(messages);
          const inferredCO = inferCOFieldsFromUserMessages(coUserMsgs);
          const isCOFlowNow =
            coIntentRegex.test(String(message || '').toLowerCase()) ||
            !!inferredCO.description ||
            !!inferredCO.amount;
          if (isCOFlowNow) {
            console.warn('🛡️ Blocking add_purchase_order during active change-order flow');
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                status: 'error',
                blocked: true,
                error: 'This request is for a change order, not a purchase order.',
                message: 'For this change order, I only need description and amount. What is missing?'
              })
            });
            continue;
          }

          const allUserMessages = messages.filter(m => m.role === 'user');
          const poFlowUserMessages = getPOFlowUserMessages(messages);
          const lastUserMessage = allUserMessages[allUserMessages.length - 1];
          const lastUserContent = (lastUserMessage?.content || '').toLowerCase();
          const inferredPO = inferPOFieldsFromUserMessages(poFlowUserMessages);

          // Backfill missing args from the current PO flow context so we don't re-ask answered questions.
          if ((!functionArgs.amount || Number(functionArgs.amount) <= 0) && inferredPO.amount) functionArgs.amount = inferredPO.amount;
          if ((!functionArgs.vendor || !String(functionArgs.vendor).trim()) && inferredPO.vendor) functionArgs.vendor = inferredPO.vendor;
          if ((!functionArgs.category || !String(functionArgs.category).trim()) && inferredPO.category) functionArgs.category = inferredPO.category;
          if ((!functionArgs.expectedDelivery || !String(functionArgs.expectedDelivery).trim()) && inferredPO.expectedDelivery) {
            functionArgs.expectedDelivery = inferredPO.expectedDelivery;
          }
          
          // HARD VALIDATION: Amount must be provided and valid
          if (!functionArgs.amount || functionArgs.amount <= 0 || isNaN(functionArgs.amount)) {
            console.error('🚫 PRE-VALIDATION: No amount provided or invalid - blocking function call');
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                status: 'error',
                error: `Amount is required and must be greater than 0. Please ask the user "How much is the purchase order for?" before calling add_purchase_order. DO NOT use placeholder amounts like $350, $500, or $1000.`,
                requiresAmount: true,
                message: `I need to know the amount first. How much is the purchase order for?`
              })
            });
            continue; // Skip executing this function call
          }
          
          // HARD VALIDATION: ALWAYS reject common placeholder amounts unless user explicitly provided them
          const commonPlaceholders = [350, 500, 1000, 100, 250, 750, 1500, 2000];
          if (commonPlaceholders.includes(functionArgs.amount)) {
            // CRITICAL: Check ALL user messages in the conversation to see if user ever mentioned this amount
            const allUserMessages = poFlowUserMessages;
            let userMentionedAmount = false;
            
            // Check each user message for explicit mention of this amount
            for (const userMsg of allUserMessages) {
              const msgContent = (userMsg.content || '').toLowerCase();
              // Check for explicit patterns: "$350", "350 dollars", "for $350", "350", or just plain "350" as a standalone number
              const amountPattern = new RegExp(`(?:\\$|dollars?|for\\s+\\$?)\\s*${functionArgs.amount}\\b|\\b${functionArgs.amount}\\s*(?:dollars?|\\$)|\\b${functionArgs.amount}\\b`, 'i');
              const isPlainNumber = msgContent.trim() === String(functionArgs.amount);
              // Check if the number appears anywhere in the message (smart extraction - no need for $ or "dollars")
              const hasNumber = new RegExp(`\\b${functionArgs.amount}\\b`).test(msgContent);
              // Check if previous assistant message asked for amount
              const msgIndex = messages.indexOf(userMsg);
              const prevAssistantMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'assistant');
              const prevAssistantAsked = prevAssistantMsg?.content?.toLowerCase().includes('how much');
              
              // Accept if: has $/dollars pattern, is plain number, or number appears in message (smart extraction)
              if (amountPattern.test(msgContent) || (isPlainNumber && prevAssistantAsked) || (hasNumber && prevAssistantAsked)) {
                userMentionedAmount = true;
                break;
              }
            }
            
            if (!userMentionedAmount) {
              console.error('🚫 PRE-VALIDATION: Common placeholder amount', functionArgs.amount, 'NEVER mentioned by user - BLOCKING function call');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  status: 'error',
                  confirmed: false,
                  error: `CRITICAL: The amount $${functionArgs.amount} was NEVER provided by the user in any message. You attempted to use a placeholder amount. You MUST ask "How much is the purchase order for?" and wait for the user's response. DO NOT use $350, $500, $1000, or any placeholder amounts. The function call has been BLOCKED.`,
                  requiresAmount: true,
                  message: `I need to know the amount first. How much is the purchase order for?`
                })
              });
              continue; // Skip executing this function call
            }
          }
          
          // Check if category is missing
          if (!functionArgs.category || !functionArgs.category.trim()) {
            const hasCategory = lastUserContent.match(/\b(windows|doors|lumber|tile|drywall|concrete|paint|electrical|plumbing|hardware|roofing|insulation|flooring|cabinets|appliances|siding|decking|fencing|landscaping|material|materials|labor)\b/i);
            if (!hasCategory) {
              console.error('🚫 PRE-VALIDATION: No category provided and no category mentioned - blocking function call');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  status: 'error',
                  error: `Category is required. Please ask the user "What category is this for?" or "What is this purchase order for?" before calling add_purchase_order.`,
                  requiresCategory: true,
                  message: `I need to know what category this is for. What is this purchase order for?`
                })
              });
              continue; // Skip executing this function call
            }
          }
          
          // Check if vendor is missing
          if (!functionArgs.vendor || !functionArgs.vendor.trim()) {
            const hasVendor = lastUserContent.match(/\b(home depot|lowes|menards|ace|sherwin|walmart|amazon|hd|lowes|supplier|vendor)\b/i);
            if (!hasVendor) {
              console.error('🚫 PRE-VALIDATION: No vendor provided and no vendor mentioned - blocking function call');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  status: 'error',
                  error: `Vendor is required. Please ask the user "Which vendor is this from?" or "Where is this purchase order from?" before calling add_purchase_order.`,
                  requiresVendor: true,
                  message: `I need to know which vendor this is from. Which vendor is this purchase order from?`
                })
              });
              continue; // Skip executing this function call
            }
          } else {
            // Check if vendor is actually a material name (like "Windows")
            const materialNames = ['windows', 'doors', 'lumber', 'tile', 'drywall', 'concrete', 'paint', 
                                  'electrical', 'plumbing', 'hardware', 'roofing', 'insulation', 'flooring', 
                                  'cabinets', 'appliances', 'siding', 'decking', 'fencing', 'landscaping'];
            const vendorLower = (functionArgs.vendor || '').toLowerCase();
            const isMaterialName = materialNames.some(m => vendorLower.includes(m));
            if (isMaterialName) {
              console.error('🚫 PRE-VALIDATION: Vendor appears to be a material name, not a vendor - blocking function call');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  status: 'error',
                  error: `The vendor "${functionArgs.vendor}" appears to be a material name, not a vendor. Please ask the user "Which vendor is this from?" before calling add_purchase_order.`,
                  requiresVendor: true,
                  message: `I need to know which vendor this is from. Which vendor is this purchase order from?`
                })
              });
              continue; // Skip executing this function call
            }
          }
          
          // Expected delivery is REQUIRED and must be derived from USER messages in this PO flow.
          // Do not trust AI-provided expectedDelivery unless user actually said a date.
          const inferredDate = inferExpectedDeliveryFromUserMessages(poFlowUserMessages);
          if (!inferredDate) {
            console.error('🚫 PRE-VALIDATION: Missing user-provided expected delivery/pickup date - blocking function call');
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                status: 'error',
                error: `What is the expected delivery or pickup date?`,
                requiresExpectedDelivery: true,
                message: `What is the expected delivery or pickup date?`
              })
            });
            continue; // Ask date first, then continue flow
          }
          // Canonicalize to parsed user date (prevents hallucinated dates from slipping through).
          functionArgs.expectedDelivery = inferredDate;

          // Require explicit user confirmation before creating any PO.
          // This enforces a confirm step after amount/vendor/category/date are gathered.
          const confirmRegex = /\b(yes|yep|confirm|confirmed|go ahead|create it|do it|proceed|sounds good|ok create)\b/i;
          const hasExplicitConfirmation = confirmRegex.test(lastUserContent);
          if (!hasExplicitConfirmation) {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                status: 'error',
                requiresConfirmation: true,
                error: `Confirmation is required before creating a purchase order.`,
                message: `Before I create it, please confirm: create this purchase order now? Reply "Yes, create it" to confirm.`
              })
            });
            continue; // Skip executing this function call until user confirms
          }
        }
        
        // PRE-VALIDATION: For add_material_expense, check if required fields are missing
        if (functionName === 'add_material_expense') {
          const allUserMessages = messages.filter(m => m.role === 'user');
          const lastUserMessage = allUserMessages[allUserMessages.length - 1];
          const lastUserContent = (lastUserMessage?.content || '').toLowerCase();
          
          // Check if amount is missing
          if (!functionArgs.amount || functionArgs.amount <= 0) {
            // Check if there's a number in the last user message
            const hasNumber = /\d+(\.\d+)?/.test(lastUserContent);
            if (!hasNumber) {
              console.error('🚫 PRE-VALIDATION: No amount provided and no number in last message - blocking function call');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  status: 'error',
                  error: `Amount is required. Please ask the user "How much did you spend?" or "What is the amount?" before calling add_material_expense.`,
                  requiresAmount: true,
                  message: `I need to know the amount first. How much did you spend?`
                })
              });
              continue; // Skip executing this function call
            }
          }
          
          // Check if category is missing
          if (!functionArgs.category || !functionArgs.category.trim()) {
            const hasMaterial = lastUserContent.match(/\b(labor|lumber|tile|drywall|concrete|paint|electrical|plumbing|hardware|roofing|insulation|flooring|cabinets|appliances|windows|doors|siding|decking|fencing|landscaping|material|materials)\b/i);
            if (!hasMaterial) {
              console.error('🚫 PRE-VALIDATION: No category provided and no material/labor mentioned - blocking function call');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  status: 'error',
                  error: `Category is required. Please ask the user "What is this for?" (for labor) or "What material is this for?" (for materials) before calling add_material_expense.`,
                  requiresCategory: true,
                  message: `I need to know what this is for. What material is this for? (or is this for labor?)`
                })
              });
              continue; // Skip executing this function call
            }
          }
          
          // Check if vendor is missing (for materials, not labor)
          const isLabor = functionArgs.category && functionArgs.category.toLowerCase() === 'labor';
          if (!isLabor && (!functionArgs.vendor || !functionArgs.vendor.trim())) {
            const hasVendor = lastUserContent.match(/\b(home depot|lowes|menards|ace|sherwin|walmart|amazon|hd|lowes)\b/i);
            if (!hasVendor) {
              console.error('🚫 PRE-VALIDATION: No vendor provided for material expense and no vendor mentioned - blocking function call');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  status: 'error',
                  error: `Vendor is required for material expenses. Please ask the user "Where was it purchased?" or "Where did you buy this from?" before calling add_material_expense.`,
                  requiresVendor: true,
                  message: `I need to know where you purchased this. Where was it purchased?`
                })
              });
              continue; // Skip executing this function call
            }
          }
          
          // Check if notes OR vendor (trade) is missing (for labor)
          // "General labor", trade names go in vendor - do NOT ask again if user already provided
          const hasLaborTrade = (isLabor && ((functionArgs.notes && functionArgs.notes.trim()) || (functionArgs.vendor && functionArgs.vendor.trim())));
          if (isLabor && !hasLaborTrade) {
            const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
            const tradeMatch = lastUserMsg.match(/\b(general\s+labor|it'?s\s+general\s+labor|it'?s\s+labor|labor|framing|plumbing|electrical|drywall|tile|painting|concrete|roofing|hvac|carpentry|drywall\s+installation|tile\s+work)\b/i);
            const rawTrade = tradeMatch ? tradeMatch[1].replace(/^it'?s\s+/i, '').trim() : null;
            const inferredTrade = rawTrade ? rawTrade.replace(/\b\w/g, c => c.toUpperCase()) : null;
            if (inferredTrade) {
              // User said "general labor" etc. - inject into functionArgs so executor has it
              functionArgs.vendor = functionArgs.vendor || inferredTrade;
              functionArgs.notes = functionArgs.notes || inferredTrade;
              console.log('✅ PRE-VALIDATION: Injected labor trade from user message:', inferredTrade);
            } else {
              console.error('🚫 PRE-VALIDATION: No notes/vendor (trade) provided for labor expense - blocking function call');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  status: 'error',
                  error: `For labor, you need the trade/sub (e.g., "general labor", "framing", "painting"). When user says "general labor" or a trade name, use it as vendor - do NOT ask again.`,
                  requiresNotes: true,
                  message: `I need to know what the labor was for. What trade or sub? (e.g., general labor, framing, painting)`
                })
              });
              continue; // Skip executing this function call
            }
          }
        }

        let functionResult;
        if (functionName === 'get_project_by_name') {
          logPhase('tool_start', { functionName });
          functionResult = await withTimeout(executeGetProjectByName(functionArgs), TOOL_EXEC_TIMEOUT_MS, `${functionName}`).catch((e) => ({
            success: false,
            error: e.message,
            status: 'timeout_error',
          }));
          logPhase('tool_done', { functionName, success: !!functionResult?.success });
          if (functionResult.success) {
            resolvedProjectInfo = {
              projectId: functionResult.projectId,
              projectName: functionResult.projectName,
              status: functionResult.status,
              isEstimate: functionResult.isEstimate,
              isActiveProject: functionResult.isActiveProject,
            };
          }
        } else if (functionName === 'compare_projects') {
          logPhase('tool_start', { functionName });
          functionResult = await withTimeout(executeCompareProjects(functionArgs), TOOL_EXEC_TIMEOUT_MS, `${functionName}`).catch((e) => ({
            success: false,
            error: e.message,
            status: 'timeout_error',
          }));
          logPhase('tool_done', { functionName, success: !!functionResult?.success });
        } else if (functionName === 'get_project_health') {
          logPhase('tool_start', { functionName });
          functionResult = await executeGetProjectHealth(functionArgs);
          logPhase('tool_done', { functionName, success: !!functionResult?.success });
        } else if (functionName === 'forecast_profit') {
          logPhase('tool_start', { functionName });
          functionResult = await executeForecastProfit(functionArgs);
          logPhase('tool_done', { functionName, success: !!functionResult?.success });
        } else if (functionName === 'analyze_expenses') {
          logPhase('tool_start', { functionName });
          functionResult = await executeAnalyzeExpenses(functionArgs);
          logPhase('tool_done', { functionName, success: !!functionResult?.success });
        } else if (functionName === 'add_purchase_order') {
          // CRITICAL: If user wants to mark as received, DO NOT create a new PO
          // Check ALL user messages in the conversation to see if they want to mark as received
          const userMessages = messages.filter(m => m.role === 'user');
          
          let userWantsMarkReceived = false;
          let detectedInMessage = '';
          
          // Check ALL user messages (not just recent ones) - user might say "mark as received" after creating PO
          // CRITICAL: Check in reverse order (most recent first) to catch the latest intent
          for (let i = userMessages.length - 1; i >= 0; i--) {
            const userMsg = userMessages[i];
            const msgContent = userMsg?.content?.toLowerCase() || '';
            const normalizedMsg = msgContent
              .replace(/\bmar\b/g, 'mark')
              .replace(/\brecieved\b/g, 'received')
              .replace(/\brecieve\b/g, 'receive');
            
            // Check for "mark this PO" pattern
            const hasMarkThisPO = (normalizedMsg.includes('mark') && normalizedMsg.includes('this') && (normalizedMsg.includes('po') || normalizedMsg.includes('purchase order'))) ||
                                  (msgContent.includes('mark') && msgContent.includes('this') && (msgContent.includes('po') || msgContent.includes('purchase order')));
            
            // CRITICAL: Check for "mark as received" patterns - prioritize most recent message
            // Check BOTH normalized and original to catch typos like "recieved"
            const wantsMarkReceived = 
              // Normalized patterns
              normalizedMsg.includes('mark as received') ||
              normalizedMsg.includes('mark received') ||
              normalizedMsg.includes('mark this received') ||
              normalizedMsg.includes('mark this as received') ||
              normalizedMsg.includes('mark it received') ||
              normalizedMsg.includes('mark it as received') ||
              normalizedMsg.includes('can you mark as received') ||
              normalizedMsg.includes('can you mark as recieved') || // Handle typo
              normalizedMsg.includes('mark this po as received') ||
              normalizedMsg.includes('mark po as received') ||
              (normalizedMsg.includes('can you mark') && normalizedMsg.includes('received')) ||
              (normalizedMsg.includes('can you mark') && (normalizedMsg.includes('this') || normalizedMsg.includes('it')) && normalizedMsg.includes('received')) ||
              (normalizedMsg.includes('can you mark') && hasMarkThisPO && (normalizedMsg.includes('received') || normalizedMsg.includes('recieved'))) ||
              (normalizedMsg.includes('mark') && (normalizedMsg.includes('this') || normalizedMsg.includes('it')) && normalizedMsg.includes('received') &&
               !normalizedMsg.includes('create') && !normalizedMsg.includes('add')) ||
              (normalizedMsg.includes('mark') && (normalizedMsg.includes('this') || normalizedMsg.includes('it')) && normalizedMsg.includes('as') && normalizedMsg.includes('received')) ||
              (hasMarkThisPO && (normalizedMsg.includes('received') || normalizedMsg.includes('recieved') || msgContent.includes('received') || msgContent.includes('recieved'))) ||
              // Original message patterns (to catch typos before normalization)
              msgContent.includes('can you mark') && msgContent.includes('as') && (msgContent.includes('recieved') || msgContent.includes('received')) ||
              msgContent.includes('mark') && msgContent.includes('as') && (msgContent.includes('recieved') || msgContent.includes('received')) ||
              // Explicit check for "can you mark this PO as recieved"
              (msgContent.includes('can you mark') && msgContent.includes('this') && (msgContent.includes('po') || msgContent.includes('purchase order')) && (msgContent.includes('received') || msgContent.includes('recieved')));
            
            if (wantsMarkReceived) {
              userWantsMarkReceived = true;
              detectedInMessage = msgContent.substring(0, 50);
              break; // Found it, no need to check more
            }
          }
          
          if (userWantsMarkReceived) {
            console.error('❌ CRITICAL: AI tried to call add_purchase_order but user wants to mark as received! Blocking and redirecting...', {
              detectedInMessage,
              allUserMessages: userMessages.map(m => m.content?.substring(0, 50))
            });
            // Instead of creating a new PO, mark the most recent one as received
            logPhase('tool_start', { functionName: 'mark_purchase_order_received_redirect' });
            functionResult = await withTimeout(
              executeMarkPOReceived({ projectId: projectId || functionArgs.projectId, poNumber: '' }, req),
              TOOL_EXEC_TIMEOUT_MS,
              'mark_purchase_order_received_redirect'
            ).catch((e) => ({
              success: false,
              error: e.message,
              status: 'timeout_error',
            }));
            logPhase('tool_done', { functionName: 'mark_purchase_order_received_redirect', success: !!functionResult?.success });
            console.log('✅ Redirected to mark_purchase_order_received instead');
          } else {
            console.log('📦 Backend: add_purchase_order function called with args:', functionArgs);
            // Use resolved project info or context projectId
            if (resolvedProjectInfo && resolvedProjectInfo.projectId) {
              functionArgs.projectId = resolvedProjectInfo.projectId;
              console.log('📦 Backend: Using projectId from resolvedProjectInfo:', resolvedProjectInfo.projectId);
            } else if (projectId) {
              functionArgs.projectId = projectId;
              console.log('📦 Backend: Using projectId from context:', projectId);
            }
            logPhase('tool_start', { functionName });
            functionResult = await withTimeout(executeAddPurchaseOrder(functionArgs, req), TOOL_EXEC_TIMEOUT_MS, `${functionName}`).catch((e) => ({
              success: false,
              error: e.message,
              status: 'timeout_error',
            }));
            logPhase('tool_done', { functionName, success: !!functionResult?.success });
          }
          console.log('📦 Backend: executeAddPurchaseOrder returned:', {
            success: functionResult.success,
            hasAction: !!functionResult.action,
            actionType: functionResult.action?.type,
            actionProjectId: functionResult.action?.projectId,
            actionAmount: functionResult.action?.amount,
            actionVendor: functionResult.action?.vendor,
            hasProjectUpdate: !!functionResult.projectUpdate,
            purchaseOrdersCount: functionResult.projectUpdate?.purchaseOrders?.length || 0,
            error: functionResult.error
          });
          
          // CRITICAL: If function failed, log why
          if (!functionResult.success) {
            console.error('❌ Purchase order creation FAILED:', {
              error: functionResult.error,
              requiresAmount: functionResult.requiresAmount,
              requiresVendor: functionResult.requiresVendor,
              requiresCategory: functionResult.requiresCategory,
              argsProvided: {
                amount: functionArgs.amount,
                vendor: functionArgs.vendor,
                category: functionArgs.category,
                projectId: functionArgs.projectId
              }
            });
          }
        } else if (functionName === 'mark_purchase_order_received') {
          console.log('📦 Backend: mark_purchase_order_received function called with args:', functionArgs);
          // Use resolved project info or context projectId
          if (resolvedProjectInfo && resolvedProjectInfo.projectId) {
            functionArgs.projectId = resolvedProjectInfo.projectId;
            console.log('📦 Backend: Using projectId from resolvedProjectInfo:', resolvedProjectInfo.projectId);
          } else if (projectId) {
            functionArgs.projectId = projectId;
            console.log('📦 Backend: Using projectId from context:', projectId);
          }
          logPhase('tool_start', { functionName });
          functionResult = await withTimeout(executeMarkPOReceived(functionArgs, req), TOOL_EXEC_TIMEOUT_MS, `${functionName}`).catch((e) => ({
            success: false,
            error: e.message,
            status: 'timeout_error',
          }));
          logPhase('tool_done', { functionName, success: !!functionResult?.success });
          console.log('📦 Backend: executeMarkPOReceived returned:', {
            success: functionResult.success,
            hasAction: !!functionResult.action,
            actionType: functionResult.action?.type,
            poNumber: functionResult.action?.poNumber
          });
        } else if (functionName === 'add_material_expense') {
          // Check if we already successfully called this function (prevent duplicate calls)
          const functionKey = `add_material_expense_${functionArgs.amount}_${functionArgs.category}`;
          if (successfulFunctionCalls.has(functionKey)) {
            console.log('⚠️ Duplicate function call detected, skipping:', functionKey);
            functionResult = {
              success: true,
              status: 'success',
              message: 'This expense was already recorded successfully in a previous call.',
              confirmed: true,
              skipDuplicate: true
            };
          } else {
          console.log('🔍 AI Assistant: Before projectId resolution', {
            functionArgsProjectId: functionArgs.projectId,
            contextProjectId: projectId,
            contextProjectName: projectName,
            resolvedProjectInfo: resolvedProjectInfo ? { projectId: resolvedProjectInfo.projectId } : null,
            allProjectsCount: allProjects.length
          });
          
          // Priority 1: Use resolved project info if available (from get_project_by_name)
          if (resolvedProjectInfo && resolvedProjectInfo.projectId) {
            functionArgs.projectId = resolvedProjectInfo.projectId;
            console.log('✅ Priority 1: Using projectId from resolvedProjectInfo:', resolvedProjectInfo.projectId);
          }
          // Priority 2: If projectId is in context, ALWAYS use it (override AI-provided if different)
          // This is CRITICAL - the context projectId is always correct
          if (projectId) {
            const aiProvidedId = functionArgs.projectId;
            const wasOverridden = aiProvidedId && aiProvidedId !== projectId;
            functionArgs.projectId = projectId; // FORCE use context projectId
            if (wasOverridden) {
              console.log('✅ Priority 2: OVERRIDING AI-provided projectId with context projectId:', {
                aiProvided: aiProvidedId,
                contextProjectId: projectId,
                reason: 'Context projectId is authoritative - always use it'
              });
            } else {
              console.log('✅ Priority 2: FORCING projectId from context (authoritative):', projectId);
            }
          } else {
            console.warn('⚠️ Priority 2: No projectId in context - this should not happen if user is on project page');
          }
          // Priority 3: If projectName is in context but no projectId, try to find it in allProjects
          if (!functionArgs.projectId && projectName && allProjects && allProjects.length > 0) {
            const foundProject = allProjects.find(p => {
              const title = (p.title || p.name || '').toLowerCase().trim();
              const searchName = projectName.toLowerCase().trim();
              // Also check if projectId matches (in case of string/number mismatch)
              const idMatch = projectId && (String(p.id) === String(projectId) || p.id === projectId);
              return idMatch || title === searchName || title.includes(searchName) || searchName.includes(title);
            });
            if (foundProject) {
              functionArgs.projectId = foundProject.id;
              console.log('✅ Priority 3: Found projectId from allProjects using projectName:', {
                projectName,
                projectId: foundProject.id,
                foundTitle: foundProject.title || foundProject.name
              });
            } else {
              console.error('❌ Priority 3: Could not find project in allProjects', {
                projectName,
                availableProjects: allProjects.slice(0, 5).map(p => ({ id: p.id, title: p.title || p.name }))
              });
            }
          }
          
          // Final check - validate all required fields before calling
          if (!functionArgs.projectId) {
            console.error('❌ CRITICAL: No projectId available for add_material_expense', {
              functionArgs,
              contextProjectId: projectId,
              contextProjectName: projectName,
              allProjectsCount: allProjects.length,
              allProjectsSample: allProjects.slice(0, 3).map(p => ({ id: p.id, title: p.title || p.name }))
            });
            
            // Return a clear error that tells the AI to use get_project_by_name first
            functionResult = {
              success: false,
              status: 'error',
              error: `Project ID is missing. Please use get_project_by_name function first to find the project "${projectName || 'the project'}" and get its ID, then call add_material_expense again with the projectId.`,
              requiresProjectLookup: true,
              projectName: projectName
            };
          } else if (!functionArgs.amount || typeof functionArgs.amount !== 'number') {
            console.error('❌ CRITICAL: Amount is missing or invalid for add_material_expense', {
              amount: functionArgs.amount,
              amountType: typeof functionArgs.amount
            });
            
            functionResult = {
              success: false,
              status: 'error',
              error: `Amount is required and must be a number. Please ask the user "How much did you spend?" and then call add_material_expense with the amount.`,
              requiresAmount: true
            };
          } else if (!functionArgs.category || !functionArgs.category.trim()) {
            console.error('❌ CRITICAL: Category is missing for add_material_expense', {
              category: functionArgs.category
            });
            
            functionResult = {
              success: false,
              status: 'error',
              error: `Category is required. Please ask the user "What is this for?" (for labor) or "What material is this for?" (for materials) and then call add_material_expense with the category.`,
              requiresCategory: true
            };
          } else if (functionArgs.category && functionArgs.category.toLowerCase() === 'labor') {
            // For labor expenses, require notes OR vendor (what labor was for / sub/trade)
            // "General labor", "it's general labor", trade names go in vendor field (Sub/Trade)
            const hasTrade = (functionArgs.notes && functionArgs.notes.trim()) || (functionArgs.vendor && functionArgs.vendor.trim());
            if (!hasTrade) {
              console.error('❌ CRITICAL: Notes/vendor (what labor was for) is missing for labor expense', {
                notes: functionArgs.notes,
                vendor: functionArgs.vendor,
                category: functionArgs.category
              });
              
              functionResult = {
                success: false,
                status: 'error',
                error: `For labor expenses, you need to know what the labor was for. Please ask the user "What was the labor expense for?" or "What trade/sub?" (e.g., "general labor", "framing", "drywall installation", "painting") and then call add_material_expense with notes or vendor. The trade will be stored in the vendor field (Sub/Trade). When user says "general labor" or a trade name, use it - do NOT ask again.`,
                requiresNotes: true
              };
            } else {
              // Labor expense has notes or vendor (trade), proceed
              console.log('✅ Labor expense has trade (notes or vendor), will store in vendor field (Sub/Trade)');
            }
          } else if (!functionArgs.vendor || !functionArgs.vendor.trim() || functionArgs.vendor.trim().toLowerCase() === 'unknown vendor') {
            // For material expenses, vendor is required
            console.error('❌ CRITICAL: Vendor is missing or invalid for material expense', {
              vendor: functionArgs.vendor,
              category: functionArgs.category
            });
            
            functionResult = {
              success: false,
              status: 'error',
              error: `Vendor is required for material expenses. Please ask the user "Where was it purchased?" or "Where did you buy this from?" and then call add_material_expense with the vendor. DO NOT use "Unknown Vendor" - ask the user for the actual vendor name.`,
              requiresVendor: true
            };
          }
          
          // If we haven't set functionResult yet (validation passed), proceed with function call
          if (!functionResult) {
            console.log('✅ Final projectId for add_material_expense:', functionArgs.projectId);
            // Pass currentProjectData as projectInfo if available
            if (currentProjectData && !functionArgs.projectInfo) {
              functionArgs.projectInfo = currentProjectData;
              console.log('✅ Passing currentProjectData as projectInfo for add_material_expense');
            }
            logPhase('tool_start', { functionName });
            functionResult = await withTimeout(executeAddMaterialExpense(functionArgs, req), TOOL_EXEC_TIMEOUT_MS, `${functionName}`).catch((e) => ({
              success: false,
              error: e.message,
              status: 'timeout_error',
            }));
            logPhase('tool_done', { functionName, success: !!functionResult?.success });
          }
          
          // Mark as successful if it worked
          if (functionResult.success) {
            successfulFunctionCalls.add(functionKey);
          }
          }
          
          console.log('📊 AI Assistant: executeAddMaterialExpense result', {
            success: functionResult.success,
            hasProjectUpdate: !!functionResult.projectUpdate,
            error: functionResult.error,
            errorDetails: functionResult.details,
            projectUpdate: functionResult.projectUpdate ? {
              projectId: functionResult.projectUpdate.projectId,
              expensesCount: functionResult.projectUpdate.expenses?.length || 0
            } : null
          });
          
          // If function failed, make sure the error is clear for the AI
          if (!functionResult.success) {
            console.error('❌ Function execution failed:', {
              functionName: 'add_material_expense',
              error: functionResult.error,
              args: {
                projectId: functionArgs.projectId,
                amount: functionArgs.amount,
                category: functionArgs.category,
                vendor: functionArgs.vendor,
              }
            });
          }
          // Extract projectUpdate if present
          if (functionResult.projectUpdate) {
            // Merge with existing projectUpdateData if it exists (for multiple function calls)
            if (projectUpdateData) {
              projectUpdateData = {
                ...projectUpdateData,
                ...functionResult.projectUpdate,
                // Merge arrays
                expenses: [
                  ...(projectUpdateData.expenses || []),
                  ...(functionResult.projectUpdate.expenses || [])
                ],
                purchaseOrders: [
                  ...(projectUpdateData.purchaseOrders || []),
                  ...(functionResult.projectUpdate.purchaseOrders || [])
                ],
                // Use the latest values for numeric fields
                totalSpent: functionResult.projectUpdate.totalSpent ?? projectUpdateData.totalSpent,
                actualCost: functionResult.projectUpdate.actualCost ?? projectUpdateData.actualCost,
                committedPOs: functionResult.projectUpdate.committedPOs ?? projectUpdateData.committedPOs,
              };
            } else {
              projectUpdateData = functionResult.projectUpdate;
            }
            console.log('✅ AI Assistant: Stored projectUpdateData', {
              projectId: projectUpdateData.projectId,
              expensesCount: projectUpdateData.expenses?.length || 0,
              purchaseOrdersCount: projectUpdateData.purchaseOrders?.length || 0,
              committedPOs: projectUpdateData.committedPOs
            });
          }
          
          // Extract action if present (for purchase orders, etc.)
          if (functionResult.action) {
            actions.push(functionResult.action);
            console.log('✅ AI Assistant: Stored action', {
              type: functionResult.action.type,
              projectId: functionResult.action.projectId
            });
          }
        // ── PM MODE: TIMELINE TOOLS ──────────────────────────────────────────
        } else if (functionName === 'get_timeline_items') {
          const targetPid = functionArgs.projectId || projectId;
          // Pull milestone/timeline data from context (already sent by mobile app)
          const currentProject = parsedContext?.currentProject || parsedContext || {};
          const milestones = currentProject.milestones || currentProject.timelineItems || [];
          if (milestones.length > 0) {
            functionResult = {
              success: true,
              projectId: targetPid,
              milestones,
              message: `Found ${milestones.length} timeline items for the project.`,
            };
          } else {
            functionResult = {
              success: true,
              projectId: targetPid,
              milestones: [],
              message: 'No timeline items found in context. The user should check the Timeline tab in the app for milestones.',
            };
          }

        } else if (functionName === 'mark_timeline_item_complete') {
          const targetPid = functionArgs.projectId || projectId;
          const progressPct = functionArgs.progressPct != null ? Number(functionArgs.progressPct) : 100;
          const isComplete = progressPct >= 100;
          const completedAt = isComplete ? (functionArgs.completedAt || new Date().toISOString()) : null;
          try {
            const axios = require('axios');
            const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
            const response = await axios.patch(
              `${baseUrl}/api/projects/${targetPid}/milestones/complete`,
              { itemId: functionArgs.itemId, itemName: functionArgs.itemName, completedAt, progressPct },
              { headers: { Authorization: `Bearer ${authToken}` } }
            );
            const label = functionArgs.itemName || functionArgs.itemId || 'Milestone';
            functionResult = response.data?.success
              ? { success: true, message: isComplete ? `✅ Marked "${label}" as complete.` : `✅ Updated "${label}" to ${progressPct}% progress.`, projectId: targetPid }
              : { success: false, error: response.data?.error || 'Failed to update milestone.' };
          } catch (e) {
            // Fallback: return an action for the mobile app to handle
            const action = { type: 'mark_timeline_complete', projectId: targetPid, itemId: functionArgs.itemId, itemName: functionArgs.itemName, completedAt, progressPct };
            actions.push(action);
            const label = functionArgs.itemName || 'Milestone';
            functionResult = { success: true, message: isComplete ? `✅ "${label}" marked complete.` : `✅ "${label}" updated to ${progressPct}%.`, action };
          }

        } else if (functionName === 'add_timeline_payment') {
          const targetPid = functionArgs.projectId || projectId;
          try {
            const axios = require('axios');
            const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
            const response = await axios.post(
              `${baseUrl}/api/projects/${targetPid}/milestones`,
              { title: functionArgs.title, amount: functionArgs.amount, dueDate: functionArgs.dueDate, type: 'payment' },
              { headers: { Authorization: `Bearer ${authToken}` } }
            );
            functionResult = response.data?.success
              ? { success: true, message: `✅ Added payment milestone "${functionArgs.title}" for $${functionArgs.amount?.toLocaleString()}.`, projectId: targetPid }
              : { success: false, error: response.data?.error || 'Failed to add payment milestone.' };
          } catch (e) {
            const action = { type: 'add_timeline_payment', projectId: targetPid, title: functionArgs.title, amount: functionArgs.amount, dueDate: functionArgs.dueDate };
            actions.push(action);
            functionResult = { success: true, message: `✅ Payment milestone "${functionArgs.title}" ($${functionArgs.amount?.toLocaleString()}) queued. The app will add it to your timeline.`, action };
          }

        // ── PM MODE: ESTIMATE TOOLS ──────────────────────────────────────────
        } else if (functionName === 'get_estimate') {
          const currentProject = parsedContext?.currentProject || parsedContext || {};
          const estimate = currentProject.estimate || currentProject.estimateData || {};
          const lineItems = estimate.lineItems || estimate.materialLineItems || currentProject.materialLineItems || [];
          const laborItems = estimate.laborLineItems || currentProject.laborLineItems || [];
          const allItems = [...lineItems, ...laborItems];
          functionResult = {
            success: true,
            estimateName: estimate.name || currentProject.estimateName || 'Current Estimate',
            lineItems: allItems,
            totalCost: allItems.reduce((sum, item) => sum + (Number(item.totalCost) || Number(item.unitCost) || 0), 0),
            message: allItems.length > 0
              ? `Found ${allItems.length} line items in the estimate.`
              : 'No estimate line items found in context. The user should check the Estimate tab in the app.',
          };

        } else if (functionName === 'add_estimate_line_item') {
          const targetPid = functionArgs.projectId || projectId;
          try {
            const axios = require('axios');
            const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
            const totalCost = (functionArgs.qty || 1) * functionArgs.unitCost;
            const response = await axios.post(
              `${baseUrl}/api/projects/${targetPid}/estimate/line-items`,
              { name: functionArgs.name, qty: functionArgs.qty || 1, unitCost: functionArgs.unitCost, totalCost, category: functionArgs.category || 'Materials/Equipment' },
              { headers: { Authorization: `Bearer ${authToken}` } }
            );
            functionResult = response.data?.success
              ? { success: true, message: `✅ Added "${functionArgs.name}" ($${totalCost.toLocaleString()}) to the estimate.`, projectId: targetPid }
              : { success: false, error: response.data?.error || 'Failed to add line item.' };
          } catch (e) {
            const action = { type: 'add_estimate_line_item', projectId: targetPid, name: functionArgs.name, qty: functionArgs.qty || 1, unitCost: functionArgs.unitCost, category: functionArgs.category || 'Materials/Equipment' };
            actions.push(action);
            functionResult = { success: true, message: `✅ "${functionArgs.name}" ($${((functionArgs.qty || 1) * functionArgs.unitCost).toLocaleString()}) queued to be added to the estimate.`, action };
          }

        // ── SCENARIO ANALYSIS EXECUTOR ─────────────────────────────────────────
        } else if (functionName === 'run_scenario_analysis') {
          // Pull project financials from context
          // CRITICAL: This tool uses EXISTING project data - no user input needed
          const ctx = parsedContext || {};
          const currentProject = ctx.currentProject || ctx;
          const estimateData = currentProject.estimateData || currentProject.estimate || {};
          
          // Get material cost from multiple possible sources
          const materialCost = Number(
            ctx.materialBudgetDirect || 
            estimateData.materialTotal || 
            estimateData.materialsTotal ||
            currentProject.materialBudget ||
            currentProject.materialsTotal ||
            0
          );
          
          // Get labor cost from multiple possible sources
          const laborCost = Number(
            estimateData.laborTotal || 
            estimateData.laborCost ||
            currentProject.laborTotal ||
            currentProject.laborCost ||
            5000
          );
          
          // Get overhead cost from multiple possible sources
          const overheadCost = Number(
            estimateData.overheadTotal || 
            estimateData.overheadCost ||
            currentProject.overheadTotal ||
            currentProject.overheadCost ||
            0
          );
          
          console.log('📊 Scenario Analysis: Using project data from context', {
            materialCost,
            laborCost,
            overheadCost,
            projectId: functionArgs.projectId || projectId,
            scenario: functionArgs.scenario,
          });
          const baseCost = materialCost + laborCost + overheadCost;
          const markupPct = Number(estimateData.markupPct || estimateData.markup || 20);
          const markup = baseCost * (markupPct / 100);
          const originalBid = Number(estimateData.totalBid || currentProject.bidPrice || baseCost + markup);
          const originalProfit = originalBid - baseCost;
          const originalMarginPct = originalBid > 0 ? (originalProfit / originalBid * 100) : 0;

          // Define scenario adjustments
          const scenarioMap = {
            labor_up_10:       { labor: 10, materials: 0, overhead: 0, bid: 0, label: 'Labor +10%' },
            labor_down_10:     { labor: -10, materials: 0, overhead: 0, bid: 0, label: 'Labor -10%' },
            materials_up_5:    { labor: 0, materials: 5, overhead: 0, bid: 0, label: 'Materials +5%' },
            materials_up_10:   { labor: 0, materials: 10, overhead: 0, bid: 0, label: 'Materials +10%' },
            materials_down_5:  { labor: 0, materials: -5, overhead: 0, bid: 0, label: 'Materials -5%' },
            overhead_up_10:    { labor: 0, materials: 0, overhead: 10, bid: 0, label: 'Overhead +10%' },
            overhead_down_10:  { labor: 0, materials: 0, overhead: -10, bid: 0, label: 'Overhead -10%' },
            bid_up_2:          { labor: 0, materials: 0, overhead: 0, bid: 2, label: 'Bid +2%' },
            bid_down_2:        { labor: 0, materials: 0, overhead: 0, bid: -2, label: 'Bid -2%' },
            typical_friction:  { labor: 8, materials: 5, overhead: 3, bid: 0, label: 'Typical Friction (labor +8%, mat +5%, OH +3%)' },
            bad_remodel:       { labor: 20, materials: 15, overhead: 10, bid: 0, label: 'Bad Remodel (labor +20%, mat +15%, OH +10%)' },
            smooth_job:        { labor: -5, materials: -3, overhead: 0, bid: 0, label: 'Smooth Job (labor -5%, mat -3%)' },
          };

          const scenario = functionArgs.scenario;
          let adj;
          if (scenario === 'custom' && functionArgs.customAdjustments) {
            const ca = functionArgs.customAdjustments;
            adj = { labor: ca.laborPctChange || 0, materials: ca.materialsPctChange || 0, overhead: ca.overheadPctChange || 0, bid: ca.bidPctChange || 0, label: 'Custom Scenario' };
          } else {
            adj = scenarioMap[scenario] || scenarioMap.typical_friction;
          }

          const newLabor = laborCost * (1 + adj.labor / 100);
          const newMaterials = materialCost * (1 + adj.materials / 100);
          const newOverhead = overheadCost * (1 + adj.overhead / 100);
          const newBaseCost = newLabor + newMaterials + newOverhead;
          const newMarkup = newBaseCost * (markupPct / 100);
          const newBid = (originalBid * (1 + adj.bid / 100));
          const newProfit = newBid - newBaseCost;
          const newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
          const profitChange = newProfit - originalProfit;

          functionResult = {
            success: true,
            scenario: adj.label,
            original: {
              materialCost, laborCost, overheadCost, baseCost, markup, bid: originalBid,
              profit: originalProfit, marginPct: Math.round(originalMarginPct * 10) / 10,
            },
            adjusted: {
              materialCost: Math.round(newMaterials), laborCost: Math.round(newLabor), overheadCost: Math.round(newOverhead),
              baseCost: Math.round(newBaseCost), markup: Math.round(newMarkup), bid: Math.round(newBid),
              profit: Math.round(newProfit), marginPct: Math.round(newMarginPct * 10) / 10,
            },
            impact: {
              profitChange: Math.round(profitChange),
              marginChange: Math.round((newMarginPct - originalMarginPct) * 10) / 10,
              costIncrease: Math.round(newBaseCost - baseCost),
              breakEvenCostIncrease: originalProfit > 0 ? `${Math.round((originalProfit / baseCost) * 100)}%` : 'N/A',
            },
            message: `📊 ${adj.label}: Profit ${profitChange >= 0 ? '+' : ''}$${Math.round(profitChange).toLocaleString()} → Margin ${Math.round(newMarginPct * 10) / 10}% (was ${Math.round(originalMarginPct * 10) / 10}%)`,
          };

        // ── CHANGE ORDER EXECUTOR ─────────────────────────────────────────────
        } else if (functionName === 'create_change_order') {
          const targetPid = functionArgs.projectId || projectId;
          const ctx = parsedContext || {};
          const currentProject = ctx.currentProject || ctx;
          const estimateData = currentProject.estimateData || currentProject.estimate || {};
          // The user's amount is the final change order amount (what the client pays)
          // Don't apply markup - use the amount exactly as specified
          const coAmount = Number(functionArgs.amount);
          
          // Build change order object
          // Note: amount is what the user specified (final price), not cost + markup
          const changeOrder = {
            id: `co-${Date.now()}`,
            description: functionArgs.description,
            vendor: functionArgs.vendor || '',
            cost: coAmount, // For display purposes, cost = amount (no separate markup calculation)
            amount: coAmount, // The change order amount (what user specified)
            clientPrice: coAmount, // Same as amount - user's amount is the final price
            status: 'approved',
            createdAt: new Date().toISOString(),
            createdByAI: true,
          };

          // Create the CO action
          const coAction = {
            type: 'create_change_order',
            projectId: targetPid,
            changeOrder,
          };
          actions.push(coAction);

          // Optionally create a payment milestone for the CO (only if explicitly requested)
          if (functionArgs.addPaymentMilestone === true) {
            const paymentAction = {
              type: 'add_timeline_payment',
              projectId: targetPid,
              title: `CO: ${functionArgs.description}`,
              amount: changeOrder.clientPrice,
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 weeks out
            };
            actions.push(paymentAction);
          }

          // Calculate new totals
          const currentBudget = Number(ctx.materialBudgetDirect || estimateData.totalCost || 0);
          const currentBid = Number(estimateData.totalBid || currentProject.bidPrice || 0);
          const newBudget = currentBudget + coAmount;
          const newBid = currentBid + coAmount;

          functionResult = {
            success: true,
            message: `✅ Change order created: "${functionArgs.description}" — Amount: $${coAmount.toLocaleString()}.`,
            changeOrder,
            budgetImpact: {
              previousBudget: currentBudget,
              coAmount,
              newBudget,
              previousBid: currentBid,
              coClientPrice: coAmount,
              newBid,
            },
            projectId: targetPid,
          };

        // ── ASSIGN PM EXECUTOR ─────────────────────────────────────────────────
        } else if (functionName === 'assign_pm') {
          const targetPid = functionArgs.projectId || projectId;
          const pmName = (functionArgs.pmName || '').trim();
          if (!targetPid || !pmName) {
            functionResult = { success: false, error: 'Project ID and PM name are required.' };
          } else {
            const assignAction = {
              type: 'assign_pm',
              projectId: targetPid,
              pmName,
              projectName: parsedContext?.projectName || parsedContext?.bidTitle || 'this project',
            };
            actions.push(assignAction);
            functionResult = {
              success: true,
              message: `✅ Assigned ${pmName} as project manager.`,
              projectId: targetPid,
            };
          }

        // ── ADD TEAM MEMBER EXECUTOR ───────────────────────────────────────────
        } else if (functionName === 'add_team_member') {
          const targetPid = functionArgs.projectId || projectId;
          const name = (functionArgs.name || '').trim();
          const role = (functionArgs.role || 'Crew Member').trim();
          const phone = (functionArgs.phone || '').trim();
          if (!targetPid || !name) {
            functionResult = { success: false, error: 'Project ID and team member name are required.' };
          } else if (!phone) {
            functionResult = { success: false, error: 'Phone number is required. Ask the user: "What is the phone number for ' + name + '?"', required_fields_missing: ['phone'] };
          } else {
            const addAction = {
              type: 'add_team_member',
              projectId: targetPid,
              teamMember: { name, role, phone },
              projectName: parsedContext?.projectName || parsedContext?.bidTitle || 'this project',
            };
            actions.push(addAction);
            functionResult = {
              success: true,
              message: `✅ Added ${name} to the team. They'll appear in your Team tab.`,
              projectId: targetPid,
            };
          }

        // ── UPDATE TEAM MEMBER STATUS EXECUTOR ───────────────────────────────────
        } else if (functionName === 'update_team_member_status') {
          const targetPid = functionArgs.projectId || projectId;
          const memberName = (functionArgs.memberName || '').trim();
          const status = (functionArgs.status || 'active').toLowerCase().replace(/\s+/g, '_');
          if (!targetPid || !memberName) {
            functionResult = { success: false, error: 'Project ID and team member name are required.' };
          } else if (status !== 'active' && status !== 'off_duty') {
            functionResult = { success: false, error: 'Status must be "active" or "off_duty".' };
          } else {
            const updateAction = {
              type: 'update_team_member_status',
              projectId: targetPid,
              memberName,
              status,
              projectName: parsedContext?.projectName || parsedContext?.bidTitle || 'this project',
            };
            actions.push(updateAction);
            functionResult = {
              success: true,
              message: `✅ Updated ${memberName} to ${status === 'active' ? 'active' : 'off duty'}.`,
              projectId: targetPid,
            };
          }

        // ── AI ESTIMATE GENERATOR EXECUTOR ──────────────────────────────────────
        } else if (functionName === 'generate_estimate') {
          const targetPid = functionArgs.projectId || projectId;
          const sqft = functionArgs.squareFootage || 1000;
          const quality = functionArgs.quality || 'mid_range';
          const projectType = functionArgs.projectType || 'kitchen';
          const markupPct = functionArgs.markupPct || 20;

          // Use GPT to generate realistic line items based on the scope
          try {
            const estimatePrompt = `You are a construction estimator. Generate a detailed estimate for this project.

PROJECT: ${functionArgs.description}
TYPE: ${projectType}
SQFT: ${sqft}
QUALITY: ${quality}
LOCATION: ${functionArgs.location || 'US average'}

Return ONLY valid JSON with this exact structure:
{
  "materialLineItems": [
    { "name": "Item name", "qty": 1, "unit": "each", "unitCost": 100.00, "totalCost": 100.00, "category": "Materials/Equipment" }
  ],
  "laborLineItems": [
    { "name": "Trade description", "qty": 40, "unit": "hours", "unitCost": 45.00, "totalCost": 1800.00, "category": "Labor", "trade": "Framing" }
  ],
  "overheadItems": [
    { "name": "Permits", "amount": 500.00 },
    { "name": "Dumpster rental", "amount": 350.00 }
  ]
}

RULES:
- Use realistic 2025-2026 pricing for ${quality} quality
- Include ALL materials needed (don't skip small items like fasteners, adhesives, etc.)
- Include labor for each trade needed
- Labor rates: budget $35-45/hr, mid_range $45-65/hr, high_end $65-85/hr, luxury $85-120/hr
- Material pricing should reflect ${quality} quality fixtures and finishes
- Include permits, dumpster, cleanup in overhead
- Be thorough — a real contractor would include 15-30 line items for a ${projectType}
- Return ONLY the JSON, no markdown, no explanation`;

            logPhase('estimate_llm_start');
            const estimateCompletion = await withTimeout(openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: estimatePrompt }],
              temperature: 0.3,
              max_tokens: 3000,
              response_format: { type: 'json_object' },
            }), 30000, 'estimate_llm');
            logPhase('estimate_llm_done');

            const estimateData = JSON.parse(estimateCompletion.choices[0].message.content);
            const materials = estimateData.materialLineItems || [];
            const labor = estimateData.laborLineItems || [];
            const overhead = estimateData.overheadItems || [];

            const materialTotal = materials.reduce((s, i) => s + Number(i.totalCost || 0), 0);
            const laborTotal = labor.reduce((s, i) => s + Number(i.totalCost || 0), 0);
            const overheadTotal = overhead.reduce((s, i) => s + Number(i.amount || 0), 0);
            const baseCost = materialTotal + laborTotal + overheadTotal;
            const markup = baseCost * (markupPct / 100);
            const totalBid = baseCost + markup;
            const profit = markup;
            const marginPct = totalBid > 0 ? (profit / totalBid * 100) : 0;
            const perSqft = sqft > 0 ? (totalBid / sqft) : 0;

            // Build the action to populate the estimate builder
            const action = {
              type: 'populate_estimate',
              projectId: targetPid,
              estimate: {
                projectType,
                squareFootage: sqft,
                quality,
                description: functionArgs.description,
                materialLineItems: materials,
                laborLineItems: labor,
                overheadItems: overhead,
                materialTotal: Math.round(materialTotal * 100) / 100,
                laborTotal: Math.round(laborTotal * 100) / 100,
                overheadTotal: Math.round(overheadTotal * 100) / 100,
                baseCost: Math.round(baseCost * 100) / 100,
                markupPct,
                markup: Math.round(markup * 100) / 100,
                totalBid: Math.round(totalBid * 100) / 100,
                profit: Math.round(profit * 100) / 100,
                marginPct: Math.round(marginPct * 10) / 10,
                perSqft: Math.round(perSqft * 100) / 100,
              },
            };
            actions.push(action);

            functionResult = {
              success: true,
              message: `✅ Estimate generated for ${projectType} (${sqft} sqft, ${quality})`,
              summary: {
                materials: `$${Math.round(materialTotal).toLocaleString()} (${materials.length} items)`,
                labor: `$${Math.round(laborTotal).toLocaleString()} (${labor.length} trades)`,
                overhead: `$${Math.round(overheadTotal).toLocaleString()}`,
                baseCost: `$${Math.round(baseCost).toLocaleString()}`,
                markup: `$${Math.round(markup).toLocaleString()} (${markupPct}%)`,
                totalBid: `$${Math.round(totalBid).toLocaleString()}`,
                profit: `$${Math.round(profit).toLocaleString()}`,
                margin: `${Math.round(marginPct * 10) / 10}%`,
                perSqft: `$${perSqft.toFixed(2)}/sqft`,
              },
              lineItemCount: materials.length + labor.length,
              action,
            };
          } catch (e) {
            console.error('❌ Error generating estimate:', e);
            functionResult = {
              success: false,
              error: 'Failed to generate estimate. Please try again with more details about the project scope.',
            };
          }

        // ── EXPENSE + LOG TOOL EXECUTORS ────────────────────────────────────────
        } else if (functionName === 'add_labor_expense') {
          // Reuse add_material_expense logic but with labor-specific fields
          const targetPid = functionArgs.projectId || projectId;
          const laborExpense = {
            id: `exp-${Date.now()}`,
            category: 'Labor',
            vendor: functionArgs.workerName || '',
            amount: functionArgs.amount,
            date: functionArgs.date || new Date().toISOString().split('T')[0],
            notes: `${functionArgs.trade}: ${functionArgs.description}`,
            trade: functionArgs.trade,
          };
          const action = {
            type: 'add_material',
            projectId: targetPid,
            amount: functionArgs.amount,
            category: 'Labor',
            vendor: functionArgs.workerName || '',
            notes: laborExpense.notes,
          };
          actions.push(action);
          functionResult = {
            success: true,
            message: `✅ Recorded $${functionArgs.amount.toLocaleString()} labor expense for ${functionArgs.trade} — "${functionArgs.description}"`,
            projectId: targetPid,
            action,
          };

        } else if (functionName === 'mark_payment_collected') {
          const targetPid = functionArgs.projectId || projectId;
          const allMilestones = getAllMilestonesFromContext(parsedContext);
          const pendingPayments = getPendingPaymentMilestones(parsedContext);
          
          // Try to match by ID first
          let match = null;
          if (functionArgs.milestoneId) {
            match = allMilestones.find(m => m.id === functionArgs.milestoneId);
          }
          
          // If no ID match, try to match by name (fuzzy/partial matching)
          if (!match && functionArgs.milestoneName) {
            match = matchPendingPaymentByName(pendingPayments, functionArgs.milestoneName);
          }
          
          // If still no match and user provided a name, return error with available options
          if (!match && functionArgs.milestoneName && pendingPayments.length > 0) {
            const availableNames = pendingPayments.map(m => `"${formatPaymentNameForDisplay(m.title || m.name)}"`).join(', ');
            functionResult = {
              success: false,
              error: `Could not find a payment milestone matching "${functionArgs.milestoneName}". Available pending payments: ${availableNames}. Please specify which one you want to mark as collected.`,
            };
          } else if (!match && pendingPayments.length === 0) {
            functionResult = {
              success: false,
              error: 'No pending payment milestones found for this project. All payments may already be collected.',
            };
          } else if (!match) {
            functionResult = {
              success: false,
              error: 'Please specify which payment milestone to mark as collected (e.g., "Week 1 Payment", "Deposit").',
            };
          } else {
            const collectedAmount = functionArgs.amount || match.amount || 0;
            const action = {
              type: 'mark_payment_collected',
              projectId: targetPid,
              milestoneId: match.id,
              milestoneName: match.title || functionArgs.milestoneName,
              amount: collectedAmount,
              collectedAt: functionArgs.collectedAt || new Date().toISOString(),
            };
            actions.push(action);
            functionResult = {
              success: true,
              message: `✅ Marked "${match.title}" as collected ($${collectedAmount.toLocaleString()}).`,
              projectId: targetPid,
              action,
            };
          }

        } else if (functionName === 'add_daily_log') {
          const targetPid = functionArgs.projectId || projectId;
          const logEntry = {
            id: `log-${Date.now()}`,
            date: functionArgs.date || new Date().toISOString().split('T')[0],
            noteText: functionArgs.noteText,
            weather: functionArgs.weather || null,
            crewCount: functionArgs.crewCount || null,
            hoursWorked: functionArgs.hoursWorked || null,
            createdAt: new Date().toISOString(),
          };
          const action = {
            type: 'add_daily_log',
            projectId: targetPid,
            ...logEntry,
          };
          actions.push(action);
          let confirmMsg = `✅ Daily log recorded for ${logEntry.date}: "${functionArgs.noteText}"`;
          if (functionArgs.crewCount) confirmMsg += ` | Crew: ${functionArgs.crewCount}`;
          if (functionArgs.weather) confirmMsg += ` | Weather: ${functionArgs.weather}`;
          functionResult = {
            success: true,
            message: confirmMsg,
            projectId: targetPid,
            action,
          };

        // ── TEAM MESSAGING TOOL EXECUTORS ────────────────────────────────────────
        } else if (functionName === 'message_team_member') {
          logPhase('tool_start', { functionName });
          functionResult = await withTimeout(
            executeMessageTeamMember(functionArgs),
            TOOL_EXEC_TIMEOUT_MS,
            `${functionName}`
          ).catch((e) => ({
            success: false,
            error: e.message,
            status: 'timeout_error',
          }));
          logPhase('tool_done', { functionName, success: !!functionResult?.success });

        } else if (functionName === 'notify_team') {
          logPhase('tool_start', { functionName });
          functionResult = await withTimeout(
            executeNotifyTeam(functionArgs),
            TOOL_EXEC_TIMEOUT_MS,
            `${functionName}`
          ).catch((e) => ({
            success: false,
            error: e.message,
            status: 'timeout_error',
          }));
          logPhase('tool_done', { functionName, success: !!functionResult?.success });

        } else {
          functionResult = { success: false, error: `Unknown function: ${functionName}` };
        }

        // Store project updates/actions for PO flows too (these branches return them but previously were not persisted).
        if ((functionName === 'add_purchase_order' || functionName === 'mark_purchase_order_received') && functionResult) {
          if (functionResult.projectUpdate) {
            if (projectUpdateData) {
              projectUpdateData = {
                ...projectUpdateData,
                ...functionResult.projectUpdate,
                expenses: [
                  ...(projectUpdateData.expenses || []),
                  ...(functionResult.projectUpdate.expenses || [])
                ],
                purchaseOrders: [
                  ...(projectUpdateData.purchaseOrders || []),
                  ...(functionResult.projectUpdate.purchaseOrders || [])
                ],
                totalSpent: functionResult.projectUpdate.totalSpent ?? projectUpdateData.totalSpent,
                actualCost: functionResult.projectUpdate.actualCost ?? projectUpdateData.actualCost,
                committedPOs: functionResult.projectUpdate.committedPOs ?? projectUpdateData.committedPOs,
              };
            } else {
              projectUpdateData = functionResult.projectUpdate;
            }
          }

          if (functionResult.action) {
            actions.push(functionResult.action);
          }
        }

        // Add function result to messages (without projectUpdate to keep response clean)
        const { projectUpdate, ...cleanResult } = functionResult;
        
        // If function succeeded, make it very clear
        if (cleanResult.success) {
          cleanResult.status = 'success';
          cleanResult.message = cleanResult.message || 'Action completed successfully';
          cleanResult.confirmed = true; // Mark as confirmed so AI knows it worked
          
          // If function returned an action (like add_purchase_order), include it
          if (functionResult.action) {
            cleanResult.action = functionResult.action;
          }
          
          console.log('✅ Function succeeded, result:', {
            functionName,
            success: true,
            message: cleanResult.message,
            projectId: cleanResult.projectId,
            hasAction: !!cleanResult.action
          });
        }
        
        // If function failed, make error message more prominent for AI
        if (!cleanResult.success && cleanResult.error) {
          cleanResult.status = 'error';
          cleanResult.errorMessage = cleanResult.error; // Add explicit errorMessage field
          cleanResult.message = `Error: ${cleanResult.error}`; // Make error the message
          cleanResult.confirmed = false; // Mark as not confirmed
          console.log('⚠️ Function failed, error message:', cleanResult.error);
        }
        
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(cleanResult),
        });

        // ── AUDIT LOG: record every tool execution ─────────────────────────
        writeAuditLog({
          event: cleanResult.success ? 'tool_success' : 'tool_error',
          tool: functionName,
          args: { ...functionArgs, token: undefined },
          result: { success: cleanResult.success, message: cleanResult.message, error: cleanResult.error },
          projectId: functionArgs.projectId || projectId,
          userId: req.user?.userId,
          pmMode: aiPmMode,
          userMessage: message,
          routerOutput: routerResult,
        });
      }

      // Get final response from OpenAI after function execution
      // Add explicit instruction message to ensure AI reads function results correctly
      const functionResultsSummary = toolCalls.map((tc, idx) => {
        const result = messages.find(m => m.role === 'tool' && m.tool_call_id === tc.id);
        if (result) {
          try {
            const parsed = JSON.parse(result.content);
            return {
              functionName: tc.function.name,
              success: parsed.success,
              status: parsed.status,
              message: parsed.message,
              error: parsed.error
            };
          } catch (e) {
            return { functionName: tc.function.name, error: 'Could not parse result' };
          }
        }
        return null;
      }).filter(Boolean);
      
      console.log('📊 Function results summary for AI:', functionResultsSummary);
      
      // Add a system message to help AI understand the results
      if (functionResultsSummary.length > 0) {
        const allSucceeded = functionResultsSummary.every(r => r.success === true);
        const allFailed = functionResultsSummary.every(r => r.success === false);
        
        if (allSucceeded) {
          // Special instruction for PO received actions
          const hasPOReceived = functionResultsSummary.some(r => r.functionName === 'mark_purchase_order_received');
          const poReceivedInstruction = hasPOReceived 
            ? ' CRITICAL: If mark_purchase_order_received succeeded, you MUST say "I\'ve marked purchase order [PO-XXXXX] as received" or "Purchase order [PO-XXXXX] has been marked as received" - be explicit and clear about the PO number.'
            : '';
          
          // Special instruction for team messaging
          const hasTeamMessage = functionResultsSummary.some(r => r.functionName === 'message_team_member' || r.functionName === 'notify_team');
          const teamMessageInstruction = hasTeamMessage
            ? ' CRITICAL: If message_team_member or notify_team succeeded, you MUST confirm the message was sent. Use the message from the function result. DO NOT show budget overview or other project info - just confirm the message was sent successfully.'
            : '';
          
          messages.push({
            role: 'system',
            content: `IMPORTANT: All function calls succeeded (success: true). The actions were completed successfully. Confirm what was done. DO NOT say there's an issue. DO NOT show budget overview or other project information unless the user specifically asked for it.${poReceivedInstruction}${teamMessageInstruction}`
          });
        } else if (allFailed) {
          const errors = functionResultsSummary.map(r => r.error || r.message).filter(Boolean);
          messages.push({
            role: 'system',
            content: `IMPORTANT: All function calls failed (success: false). Errors: ${errors.join('; ')}. Explain the specific error to the user. DO NOT say "there was an issue" - explain the actual error.`
          });
        } else {
          messages.push({
            role: 'system',
            content: `IMPORTANT: Some function calls succeeded and some failed. Check each result's success field. Only confirm actions that succeeded (success: true).`
          });
        }
      }
      
      // If this was a change order, inject instruction to not ask about dates in the final response
      if (isChangeOrderFlow) {
        messages.push({
          role: 'system',
          content: 'CRITICAL: This was a change order. Do NOT ask about dates, delivery dates, or received dates. Change orders do not need dates. Just confirm what was created.',
        });
      }
      
      // PERF FIX: Don't send tools/functions on the final LLM call — we only need
      // a text summary of tool results, not another tool invocation.  Removing the
      // tools list cuts thousands of prompt tokens and prevents OpenAI from hanging.
      logPhase('final_llm_start');
      completion = await withTimeout(openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.3,
        max_tokens: 2000,
      }), 30000, 'final_llm');
      logPhase('final_llm_done');

      reply = completion.choices[0].message.content || 'Sorry, I could not generate a response.';
      
      // Check if AI responded without calling function when it should have
      const toolCallsAfter = completion.choices[0].message.tool_calls || [];
      const userMessage = messages.find(m => m.role === 'user');
      const userSaidPO = userMessage?.content?.toLowerCase().includes('purchase order') || 
                        userMessage?.content?.toLowerCase().includes('po') ||
                        userMessage?.content?.toLowerCase().includes('order');
      
      if (userSaidPO && toolCallsAfter.length === 0 && reply.toLowerCase().includes('recorded')) {
        console.warn('⚠️ WARNING: AI said "recorded" but did NOT call add_purchase_order function!');
        console.warn('⚠️ User message:', userMessage?.content);
        console.warn('⚠️ AI reply:', reply);
      }
      
      // Final validation: if we have projectUpdateData, the function succeeded - ensure reply reflects this
      if (projectUpdateData && reply.toLowerCase().includes('issue')) {
        console.warn('⚠️ AI said "issue" but function succeeded - this is a contradiction');
        // Don't modify reply, but log it for debugging
      }
    }

    // CRITICAL FINAL CHECK: If user asked to mark as received but AI created a PO, block it
    const finalReplyLower = reply?.toLowerCase() || '';
    const finalUserAskedToMarkReceived = (routerResult.proposed_tool === 'mark_purchase_order_received') || userSaidMarkThisPO;
    const finalAISaidCreatedPO = (finalReplyLower.includes('created') || finalReplyLower.includes('recorded')) && 
                                  (finalReplyLower.includes('purchase order') || finalReplyLower.includes('po-'));
    const hasMarkReceivedActionInResponse = actions.some(a => a.type === 'mark_po_received');
    const hasAddPOActionInResponse = actions.some(a => a.type === 'add_purchase_order');
    
    // CRITICAL: If user asked to mark as received, but AI created a PO (either in reply OR in actions), block it
    if (finalUserAskedToMarkReceived && (finalAISaidCreatedPO || hasAddPOActionInResponse)) {
      console.error('🔴 FINAL CHECK: User asked to mark as received but AI created a PO! Blocking and updating reply...', {
        finalUserAskedToMarkReceived,
        finalAISaidCreatedPO,
        hasAddPOActionInResponse,
        hasMarkReceivedActionInResponse,
        replyPreview: reply?.substring(0, 100)
      });
      
      // Instead of trying to mark it automatically, just tell the user how to do it manually
      reply = "To mark the purchase order as received, go to the Purchase Orders page and tap the 'Received' button on the purchase order you want to mark.";
      
      // Remove any add_purchase_order actions that were created
      actions = actions.filter(a => a.type !== 'add_purchase_order');
      
      // Remove any purchase orders from projectUpdate that were just created
      if (projectUpdateData && projectUpdateData.purchaseOrders) {
        // Don't send new PO in update if user asked to mark as received
        projectUpdateData = {
          ...projectUpdateData,
          purchaseOrders: [] // Clear the new PO
        };
      }
      
      console.log('✅ Blocked duplicate PO creation and updated reply to tell user to mark manually');
    }
    
    // Return response in format expected by mobile app
    // Reduced logging to prevent terminal glitching
    
    // ── BUILD ANALYSIS CARD for health check requests ──────────────────────
    // Compute structured data server-side so the frontend doesn't rely on text parsing
    let analysisCard = null;
    const currentMsg = (message || '').toLowerCase();
    const lastUserMsg = (lastUserMessage?.content || '').toLowerCase();
    // Check both current message and last user message for health check keywords
    // CRITICAL: Exclude expense logging requests - they should NOT trigger health check
    const isExpenseLogging = currentMsg.includes('log') && (currentMsg.includes('expense') || currentMsg.includes('spent') || currentMsg.includes('bought') || currentMsg.includes('purchased')) ||
                             lastUserMsg.includes('log') && (lastUserMsg.includes('expense') || lastUserMsg.includes('spent') || lastUserMsg.includes('bought') || lastUserMsg.includes('purchased'));
    const isHealthCheck = !isExpenseLogging && (
      currentMsg.includes('health') || currentMsg.includes('analyze') || currentMsg.includes('analysis') || currentMsg.includes('status') || currentMsg.includes('how is') ||
      lastUserMsg.includes('health') || lastUserMsg.includes('analyze') || lastUserMsg.includes('analysis') || lastUserMsg.includes('status') || lastUserMsg.includes('how is')
    );
    
    console.log('🔍 Health check detection:', { 
      currentMsg: currentMsg.substring(0, 50), 
      lastUserMsg: lastUserMsg.substring(0, 50), 
      isHealthCheck,
      hasData: !!(bidTotal > 0 || estimatedCost > 0 || materialBudget > 0)
    });
    
    if (isHealthCheck && (bidTotal > 0 || estimatedCost > 0 || materialBudget > 0)) {
      const revenue = contractValue > 0 ? contractValue : bidTotal;
      const estMarginPct = revenue > 0 && estimatedCost > 0 ? ((revenue - estimatedCost) / revenue * 100) : 0;
      const curMarginPct = revenue > 0 && actualCost > 0 ? ((revenue - actualCost) / revenue * 100) : estMarginPct;
      const forecastProfit = revenue > 0 ? revenue - (actualCost > 0 ? actualCost : estimatedCost) : 0;
      const spentPct = estimatedCost > 0 ? (actualCost / estimatedCost * 100) : 0;
      const progressNum = Number(progress) || 0;
      
      // Get expenses array once for all calculations
      const allExp = Array.isArray(expenses) ? expenses : [];
      
      // Calculate labor budget and spent
      // Try multiple sources: estimateData, parsedContext, buckets (budget breakdown), currentProjectData
      let laborBudget = Number(estimateData?.laborTotal || parsedContext?.laborTotal || currentProjectData?.laborTotal || 0);
      
      // Fallback: extract from buckets if estimateData doesn't have it
      if (laborBudget === 0) {
        const buckets = parsedContext.buckets || currentProjectData?.buckets || currentProjectData?.projectData?.buckets || [];
        const laborBucket = buckets.find(b => (b.name || '').toLowerCase().includes('labor'));
        if (laborBucket) {
          laborBudget = Number(laborBucket.budget || laborBucket.bidBudget || 0);
        }
      }
      
      const laborSpent = allExp
        .filter(e => (e.category || '').toLowerCase().includes('labor'))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const laborRemaining = Math.max(0, laborBudget - laborSpent);
      const laborSpentPct = laborBudget > 0 ? (laborSpent / laborBudget * 100) : 0;
      
      console.log('🔍 Labor calculation:', { laborBudget, laborSpent, laborRemaining, laborSpentPct, hasEstimateData: !!estimateData, estimateDataLaborTotal: estimateData?.laborTotal });
      
      // Determine risk
      let riskLevel = 'Low';
      let riskReason = 'Project financials look healthy.';
      if (spentPct > progressNum + 20) { riskLevel = 'High'; riskReason = `Spent ${spentPct.toFixed(0)}% of budget but only ${progressNum}% complete.`; }
      else if (spentPct > progressNum + 10) { riskLevel = 'Medium'; riskReason = `Spending is ${(spentPct - progressNum).toFixed(0)} points ahead of progress.`; }
      else if (curMarginPct < 10 && revenue > 0) { riskLevel = 'Medium'; riskReason = `Current margin (${curMarginPct.toFixed(1)}%) is below 10% target.`; }
      
      // Budget status
      let budgetStatus = estimatedCost > 0 ? (spentPct < 50 ? 'On Track' : spentPct < 90 ? 'Watch' : 'Over') : 'Data needed';
      let marginStatus = revenue > 0 ? `${curMarginPct.toFixed(1)}%` : 'Data needed';
      let scheduleStatus = progressNum > 0 ? `${progressNum}% complete` : (milestones.length > 0 ? `${milestones.length} milestones` : 'No schedule data');

      // Top cost drivers from expenses
      const expensesByCategory = {};
      allExp.forEach(e => {
        const cat = e.category || 'Other';
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(e.amount || 0);
      });
      const topDrivers = Object.entries(expensesByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, amount]) => ({ name, amount: Math.round(amount), percentage: actualCost > 0 ? Math.round(amount / actualCost * 100) : 0 }));

      // Milestones at risk
      const now = new Date();
      const atRiskMilestones = (Array.isArray(milestones) ? milestones : [])
        .filter(m => m.status !== 'completed' && m.status !== 'complete' && m.plannedDate && new Date(m.plannedDate) < now)
        .map(m => ({ name: m.title || 'Unnamed', risk: 'Overdue' }));

      analysisCard = {
        summary: { budgetStatus, marginStatus, scheduleStatus },
        budgetAndCosting: {
          planned: Math.round(estimatedCost),
          actual: Math.round(actualCost),
          materialBudget: Math.round(materialBudget * 100) / 100,
          materialSpent: Math.round(materialSpent * 100) / 100,
          materialRemaining: Math.round(Math.max(0, materialBudget - materialSpent) * 100) / 100,
          materialSpentPct: materialBudget > 0 ? Math.round((materialSpent / materialBudget) * 100 * 10) / 10 : 0,
          laborBudget: Math.round(laborBudget * 100) / 100,
          laborSpent: Math.round(laborSpent * 100) / 100,
          laborRemaining: Math.round(laborRemaining * 100) / 100,
          laborSpentPct: Math.round(laborSpentPct * 10) / 10,
          topCostDrivers: topDrivers,
          missingCosts: [],
          suspiciousEntries: [],
        },
        profitability: {
          currentMargin: Math.round(curMarginPct * 10) / 10,
          targetMargin: Math.round(estMarginPct * 10) / 10,
          forecastAtCompletion: Math.round(forecastProfit),
          riskLevel,
          riskReason,
        },
        schedule: {
          milestonesAtRisk: atRiskMilestones,
          next7DayActions: [],
        },
        risksAndRecommendations: {
          prioritizedActions: [
            ...(spentPct > progressNum + 15 ? [{ action: 'Review recent expenses for overruns', priority: 'High', reason: `Spending ${spentPct.toFixed(0)}% ahead of ${progressNum}% progress` }] : []),
            ...(materialBudget > 0 && materialSpent > materialBudget * 0.8 ? [{ action: 'Review material budget usage', priority: 'High', reason: `${Math.round(materialSpent / materialBudget * 100)}% of material budget used` }] : []),
            ...(laborBudget > 0 && laborSpent > laborBudget * 0.8 ? [{ action: 'Review labor budget usage', priority: 'High', reason: `${Math.round(laborSpentPct)}% of labor budget used` }] : []),
            ...(atRiskMilestones.length > 0 ? [{ action: `Follow up on ${atRiskMilestones.length} overdue milestone(s)`, priority: 'Medium', reason: 'Past due dates' }] : []),
          ],
        },
        nextBestActions: [
          { label: 'Run Scenario Analysis', action: 'run_scenario', params: {} },
          { label: 'View Budget Breakdown', action: 'view_budget', params: {} },
        ],
        dataNeeded: [
          ...(estimatedCost === 0 ? [{ section: 'Budget', missingData: 'No estimated cost set', nextStep: 'Set a budget in the Estimate tab' }] : []),
          ...(progressNum === 0 ? [{ section: 'Schedule', missingData: 'No progress tracked', nextStep: 'Update milestone progress in the Timeline tab' }] : []),
        ],
      };
    }
    
    // Extract conversation facts for memory
    extractConversationFacts(message, reply, session);

    // Generate smart suggestions for follow-up
    const suggestedFollowUps = generateSmartSuggestions(message, reply, parsedContext, session);

    const responseData = {
      reply,
      ...(projectUpdateData ? { projectUpdate: projectUpdateData } : {}),
      ...(actions.length > 0 ? { actions: actions } : {}),
      ...(analysisCard ? { analysisCard } : {}),
      ...(suggestedFollowUps.length > 0 ? { suggestedFollowUps } : {}),
      ...(session ? { sessionId: session.id } : {}),
    };
    
    // Debug: Log if analysisCard was built
    if (analysisCard) {
      console.log('📊 Analysis card built and attached to response:', {
        hasMaterial: analysisCard.budgetAndCosting.materialBudget > 0,
        hasLabor: analysisCard.budgetAndCosting.laborBudget > 0,
        materialBudget: analysisCard.budgetAndCosting.materialBudget,
        materialSpent: analysisCard.budgetAndCosting.materialSpent,
        laborBudget: analysisCard.budgetAndCosting.laborBudget,
        laborSpent: analysisCard.budgetAndCosting.laborSpent,
        laborRemaining: analysisCard.budgetAndCosting.laborRemaining,
        laborSpentPct: analysisCard.budgetAndCosting.laborSpentPct,
      });
    } else {
      console.log('⚠️ No analysis card built:', { isHealthCheck, hasData: !!(bidTotal > 0 || estimatedCost > 0 || materialBudget > 0) });
    }
    
    console.log('📤 AI Assistant: Final response data being sent:', {
      hasReply: !!responseData.reply,
      hasProjectUpdate: !!responseData.projectUpdate,
      hasActions: !!responseData.actions,
      actionsCount: responseData.actions?.length || 0,
      actions: responseData.actions || [],
      replyMentionsPO: reply?.toLowerCase().includes('purchase order') || reply?.toLowerCase().includes('po'),
      replyMentionsRecorded: reply?.toLowerCase().includes('recorded') || reply?.toLowerCase().includes('created')
    });
    
    // If AI says it recorded a PO but no action was created, NEVER auto-create from text.
    // Auto-creating here bypasses required delivery-date and explicit-confirmation rules.
    // Instead, ask the user to confirm and provide missing fields.
    const lastUserMsgForFallback = lastUserMessage?.content?.toLowerCase() || '';
    // Normalize typos for fallback check too
    const normalizedFallbackMsg = lastUserMsgForFallback
      .replace(/\bmar\b/g, 'mark')
      .replace(/\brecieved\b/g, 'received')
      .replace(/\brecieve\b/g, 'receive');
    
    const userWantsToMarkReceived = normalizedFallbackMsg.includes('mark as received') ||
                                   normalizedFallbackMsg.includes('mark received') ||
                                   normalizedFallbackMsg.includes('mark this received') ||
                                   normalizedFallbackMsg.includes('mark it received') ||
                                   normalizedFallbackMsg.includes('mark po as received') ||
                                   normalizedFallbackMsg.includes('mark purchase order as received') ||
                                   (normalizedFallbackMsg.includes('mark') && normalizedFallbackMsg.includes('received')) ||
                                   (normalizedFallbackMsg.includes('can you mark') && normalizedFallbackMsg.includes('received')) ||
                                   // Also check original for typos
                                   (lastUserMsgForFallback.includes('mar') && (lastUserMsgForFallback.includes('received') || lastUserMsgForFallback.includes('recieved'))) ||
                                   (lastUserMsgForFallback.includes('mark') && (lastUserMsgForFallback.includes('received') || lastUserMsgForFallback.includes('recieved')));
    
    // CRITICAL: Only apply PO fallback logic if we're NOT in a change order flow
    const isCOFlowFinal = isChangeOrderFlowActive || 
                          routerResult.domain === 'change_order' ||
                          responseData.actions?.some(a => a.type === 'create_change_order');
    
    if (!isCOFlowFinal && 
        (reply?.toLowerCase().includes('purchase order') || reply?.toLowerCase().includes('po')) && 
        (reply?.toLowerCase().includes('recorded') || reply?.toLowerCase().includes('created')) &&
        actions.length === 0 &&
        !userWantsToMarkReceived) { // CRITICAL: Don't create PO if user wants to mark as received
      console.error('❌ AI claimed PO created, but no PO action exists. Blocking auto-create fallback.');
      const replyLower = (responseData.reply || '').toLowerCase();
      const alreadyAskingDate = replyLower.includes('expected delivery') || replyLower.includes('pickup date');
      const alreadyAskingConfirm = replyLower.includes('confirm') || replyLower.includes('yes, create it');
      if (!alreadyAskingDate && !alreadyAskingConfirm) {
        const userMsgs = messages.filter(m => m.role === 'user');
        const hasDate = !!inferExpectedDeliveryFromUserMessages(userMsgs);
        const hasConfirm = /\b(yes|yep|confirm|confirmed|go ahead|create it|do it|proceed|sounds good|ok create)\b/i.test(lastUserMsgForFallback);
        if (!hasDate) {
          responseData.reply = `What is the expected delivery or pickup date?`;
        } else if (!hasConfirm) {
          responseData.reply = `Please confirm before I create it. Reply "Yes, create it" to confirm.`;
        }
      }
    }
    
    // Final check: if we have actions now, make sure they're in the response
    if (actions.length > 0 && !responseData.actions) {
      responseData.actions = actions;
      console.log('✅ Added actions to responseData:', actions.length);
    }
    
    logPhase('request_done', {
      hasActions: Array.isArray(responseData?.actions) ? responseData.actions.length : 0,
      hasProjectUpdate: !!responseData?.projectUpdateData,
      replyChars: (responseData?.reply || '').length,
    });
    return res.json(responseData);

  } catch (err) {
    console.error('Error in /api/ai-assistant:', err);

    if (err?.name === 'TimeoutError') {
      return res.status(504).json({
        error: 'AI request timeout',
        message: err.message || 'AI request timed out',
      });
    }

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
        return res.status(statusCode).json({
          error: 'OpenAI API authentication failed',
          message: 'Invalid OpenAI API key. Please check your configuration.',
          details: errorMessage,
        });
      }
    }

    return res.status(500).json({
      error: 'AI Assistant error',
      message: err.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

/**
 * POST /api/ai-assistant/transcribe
 * Transcribe audio to text using OpenAI Whisper
 */
router.post('/transcribe', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  let tempFilePath = null;
  
  try {
    const { audio, format = 'm4a' } = req.body;

    console.log('🎤 Transcription request received:', {
      hasAudio: !!audio,
      audioLength: audio?.length || 0,
      format,
    });

    if (!audio) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return res.status(503).json({
        error: 'Transcription service unavailable',
        message: 'OpenAI API key not configured',
      });
    }

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    console.log('🎤 Audio buffer created, size:', audioBuffer.length, 'bytes');

    // Create temporary file
    tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}-${Math.random().toString(36).substring(7)}.${format}`);
    fs.writeFileSync(tempFilePath, audioBuffer);
    console.log('🎤 Temporary file created:', tempFilePath);

    // Verify file was created
    const fileStats = fs.statSync(tempFilePath);
    console.log('🎤 File stats:', { size: fileStats.size, exists: true });

    try {
      // Use OpenAI Whisper API for transcription
      // The SDK expects a file stream
      console.log('🎤 Sending to OpenAI Whisper API...');
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'en', // Optional: specify language for better accuracy
        response_format: 'text', // Get plain text response
      });

      console.log('✅ Transcription successful:', transcription);

      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log('🧹 Temp file cleaned up');
      }

      const transcribedText = typeof transcription === 'string' ? transcription : transcription.text || '';
      
      res.json({
        success: true,
        text: transcribedText,
        transcription: transcribedText, // Alias for compatibility
      });
    } catch (transcribeError) {
      console.error('❌ OpenAI transcription error:', transcribeError);
      console.error('❌ Error details:', {
        message: transcribeError.message,
        status: transcribeError.status,
        code: transcribeError.code,
      });
      
      // Clean up temp file on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log('🧹 Temp file cleaned up after error');
      }
      throw transcribeError;
    }
  } catch (error) {
    console.error('❌ Transcription endpoint error:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Ensure temp file is cleaned up
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.error('❌ Failed to clean up temp file:', cleanupError);
      }
    }
    
    res.status(500).json({
      error: 'Transcription failed',
      message: error.message || 'Failed to transcribe audio',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

module.exports = router;
