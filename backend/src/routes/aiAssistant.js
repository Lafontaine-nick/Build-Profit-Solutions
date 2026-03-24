const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');
const { buildSystemPrompt, buildRouterPrompt } = require('./promptSystem');
const {
  formatMarginReply,
  normalizeMoneyValue,
  getApprovedChangeOrdersTotal,
  getProjectMilestones,
  getPaymentDateValue,
  isPaymentCollectedForAI,
  getProjectFinancialSnapshot,
  buildMakingEnoughReply,
  buildProjectedProfitReply,
  computeMarginAtProgress,
  buildMarginAtProgressReply,
  buildMarginReplyForProject,
  normalizeProjectSearchText,
  rankProjectsByQuery,
  resolveProjectByQuery,
  isCurrentProjectMatch,
  collectPaymentBuckets,
  buildPaymentStatusReply,
  buildBudgetStatusReply,
  analyzePortfolioProject,
  buildPortfolioComparisonReply,
  isPortfolioLosingMoneyQuery,
  isPortfolioOverBudgetListQuery,
  isSimpleProjectBudgetStatusQuery,
  isPortfolioCompareActiveQuery,
  isPortfolioWorstProjectQuery,
  sortCompareProjectsResults,
  normalizeAiMessageForIntent,
  appendDataFreshness,
  buildPortfolioNextActions,
  runCompareProjectsPipeline,
  isCalendarEventCreateQuery,
  isCalendarCreateFollowUp,
  shouldUseCalendarCreateParser,
  isCalendarEventsListQuery,
  calendarEventTypeFilterFromMessage,
  isProjectActiveForCalendarEvents,
  collectUpcomingCalendarEvents,
  buildCalendarEventsReply,
  buildCalendarAndPaymentsCombinedReply,
  parseCalendarEventCreate,
} = require('../services/aiAssistantCore');

/**
 * Current margin % for display — matches Projects page (profitForecast.projectedMarginPct or estimate margin).
 * When no/little spend: use bid margin (estimate). Otherwise: projected margin = (contract - forecastCost) / contract.
 */
function getDisplayMarginPct(project) {
  const contract = Number(project.contractValue || project.bidPrice || project.bidTotal || 0);
  const spent = Number(project.totalSpent || project.actualCost || 0);
  const estCost = Number(project.estimatedCost || 0);
  const progressPct = Math.max(0, Math.min(100, Number(project.progress ?? project.overallProgressPct ?? 0)));
  const progressRatio = progressPct > 0 ? progressPct / 100 : 0;

  if (!contract || contract <= 0) return null;

  // No/little real spend → use bid (estimate) margin so we match Projects card
  const hasNoRealSpend = spent === 0 || (contract > 0 && spent < 0.01 * contract);
  let bidMarginPct = project.bidMarginPct;
  if (bidMarginPct == null && project.estimateData) {
    const ed = project.estimateData;
    const stored = ed.marginPercent ?? ed.margin ?? ed.marginPct;
    if (typeof stored === 'number' && Number.isFinite(stored)) {
      const pct = stored > 1 ? stored : stored * 100;
      if (pct >= 0 && pct <= 100) bidMarginPct = pct;
    }
    if (bidMarginPct == null && ed.subtotal > 0 && ed.profit >= 0) bidMarginPct = Math.round((ed.profit / (ed.subtotal + ed.profit)) * 1000) / 10;
    if (bidMarginPct == null && Number(ed.markupPct || ed.markup || 0) > 0) bidMarginPct = Math.round((Number(ed.markupPct || ed.markup) / (100 + Number(ed.markupPct || ed.markup))) * 1000) / 10;
  }
  if (hasNoRealSpend && bidMarginPct != null) return Math.round(Number(bidMarginPct) * 10) / 10;

  // Projected margin (run-rate): forecastFinalCost = spent / progressRatio when progress > 1%, else estimated cost
  const adjustedBudget = estCost > 0 ? estCost : contract;
  let forecastFinalCost = adjustedBudget;
  if (progressRatio >= 1) {
    forecastFinalCost = spent;
  } else if (progressRatio > 0.01 && spent > 0) {
    const cpiForecast = spent / progressRatio;
    forecastFinalCost = Math.max(spent, cpiForecast);
  } else if (estCost > 0) {
    forecastFinalCost = estCost;
  }
  const projectedProfit = contract - forecastFinalCost;
  const projectedMarginPct = (projectedProfit / contract) * 100;
  return Math.round(projectedMarginPct * 10) / 10;
}

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
      estimatePreferences: {},
      estimateEvents: [],
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

  if (/\bweekly payment|weekly schedule\b/i.test(msgLower)) {
    session.estimatePreferences.paymentStyle = 'weekly';
  } else if (/\bmilestone payment|milestone schedule|deposit\b/i.test(msgLower)) {
    session.estimatePreferences.paymentStyle = 'milestone-based';
  }

  if (/\bbudget\b/i.test(msgLower)) {
    session.estimatePreferences.pricingTier = 'budget';
  } else if (/\bpremium\b/i.test(msgLower)) {
    session.estimatePreferences.pricingTier = 'premium';
  } else if (/\bstandard\b/i.test(msgLower)) {
    session.estimatePreferences.pricingTier = 'standard';
  }

  const markupMatch = msgLower.match(/\bmarkup(?:\s+to)?\s+(\d{1,2}(?:\.\d+)?)%/i);
  if (markupMatch) {
    session.estimatePreferences.markupTarget = Number(markupMatch[1]);
  }

  if (session.facts.length > 20) session.facts = session.facts.slice(-15);
}

function buildMemoryContext(session, parsedContext) {
  const hasEstimatePrefs = session && session.estimatePreferences && Object.keys(session.estimatePreferences).length > 0;
  if (!session || (!session.projectsDiscussed.length && !session.lastTopics.length && !hasEstimatePrefs)) return '';
  let ctx = '\n\nCONVERSATION MEMORY:';
  if (session.projectsDiscussed.length > 0) {
    ctx += `\n→ Projects discussed this session: ${session.projectsDiscussed.join(', ')}`;
  }
  if (session.lastTopics.length > 0) {
    ctx += `\n→ Recent topics: ${session.lastTopics.join(', ')}`;
  }
  if ((parsedContext?.screen || '') === 'Estimate Generator') {
    const prefLines = [];
    if (session.estimatePreferences?.paymentStyle) prefLines.push(`preferred payment style: ${session.estimatePreferences.paymentStyle}`);
    if (session.estimatePreferences?.pricingTier) prefLines.push(`preferred pricing tier: ${session.estimatePreferences.pricingTier}`);
    if (Number.isFinite(session.estimatePreferences?.markupTarget)) prefLines.push(`recent markup target: ${session.estimatePreferences.markupTarget}%`);
    if (prefLines.length > 0) {
      ctx += `\n→ Estimate session preferences: ${prefLines.join('; ')}`;
    }
  }
  ctx += '\n→ Use this context to maintain continuity — if user says "that one" or "tell me more", they likely mean the project or topic above.';
  return ctx;
}

function trackEstimateSessionEvent(session, type, data = {}) {
  if (!session) return;
  session.estimateEvents.push({
    type,
    data,
    at: Date.now(),
  });
  if (session.estimateEvents.length > 25) {
    session.estimateEvents = session.estimateEvents.slice(-20);
  }
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
    const isActive = (s) => ['won', 'active', 'in_progress', 'in-progress'].includes((s || '').toLowerCase());
    const getStatus = (p) => (p?.status ?? p?.projectData?.status ?? '').toString().toLowerCase();
    const activeCount = allProjects.filter((p) => isActive(getStatus(p))).length;
    if (mentionedProject) {
      suggestions.push({ label: `Forecast ${mentionedProject} profit`, prompt: `Forecast the final profit for ${mentionedProject} based on current spending` });
    }
    if (activeCount >= 2) {
      suggestions.push({ label: 'Compare active project margins', prompt: 'Compare margins across my active projects' });
    }
  }

  if (replyLower.includes('over budget') || replyLower.includes('overrun') || replyLower.includes('above estimate')) {
    if (mentionedProject) {
      suggestions.push({ label: `Break down ${mentionedProject} expenses`, prompt: `Show me an expense breakdown for ${mentionedProject} by category and vendor` });
    }
    suggestions.push({ label: 'Check all budget risks', prompt: 'Which projects have budget risks?' });
  }

  // Receipt follow-up only when the reply is about receipts — generic "missing" (e.g. missing customer fields on estimates) must not trigger this.
  const replyLooksReceiptRelated =
    replyLower.includes('receipt') ||
    replyLower.includes('missing receipt') ||
    replyLower.includes('missing receipts') ||
    /\bmissing\s+receipts?\b/i.test(replyLower) ||
    /\breceipts?\s+(is|are)\s+missing\b/i.test(replyLower);
  if (replyLooksReceiptRelated) {
    suggestions.push({ label: 'Show all missing receipts', prompt: 'List all expenses missing receipts across my projects' });
  }

  if (replyLower.includes('overdue') || replyLower.includes('payment')) {
    suggestions.push({ label: 'Show all overdue payments', prompt: 'What payments are overdue across all my projects?' });
  }

  if (mentionedProject && !msgLower.includes('health') && !msgLower.includes('check')) {
    suggestions.push({ label: `Full health check: ${mentionedProject}`, prompt: `Give me a full health check on ${mentionedProject}` });
  }

  if (replyLower.includes('compare') || msgLower.includes('compare')) {
    const isActive = (s) => ['won', 'active', 'in_progress', 'in-progress'].includes((s || '').toLowerCase());
    const isCompleted = (s) => (s || '').toLowerCase() === 'completed';
    const getStatus = (p) => (p?.status ?? p?.projectData?.status ?? '').toString().toLowerCase();
    const activeCount = allProjects.filter((p) => isActive(getStatus(p))).length;
    const completedCount = allProjects.filter((p) => isCompleted(getStatus(p))).length;
    if (activeCount >= 2) {
      suggestions.push({ label: 'Rank active projects by risk', prompt: 'Rank my active projects by risk — which needs the most attention?' });
    }
    if (completedCount >= 2 && activeCount < 2) {
      suggestions.push({ label: 'Compare completed projects', prompt: 'Compare my completed projects — which was most profitable?' });
    }
  }

  if (suggestions.length < 2 && mentionedProject) {
    suggestions.push({ label: `Review ${mentionedProject} costs`, prompt: `Break down all costs on ${mentionedProject}` });
  }

  if (suggestions.length < 3 && allProjects.length > 1 && parsedContext?.screen !== 'Estimate Generator') {
    suggestions.push({ label: 'Portfolio overview', prompt: 'Give me a quick portfolio overview with key numbers' });
  }

  let out = suggestions.slice(0, 4);
  if (parsedContext?.screen === 'Estimate Generator') {
    const skip = new Set(['show all missing receipts', 'portfolio overview']);
    out = out.filter((s) => !skip.has(String(s?.label || '').trim().toLowerCase()));
  }
  return out;
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

    // CRITICAL: When assistant asked "which project?" and user says "my completed projects" / "completed jobs" / "all of them" — SCOPE clarification, NOT a project name
    const askedWhichProject = /(?:which project|what project|which one|which job).*(?:mean|referring|talking about)/i.test(lastAssistantMessage) ||
      /(?:which|what) project\s*(?:do you|do they)?\s*mean/i.test(lastAssistantMessage);
    const looksLikeScopeClarification = /\b(my completed projects|completed projects|completed jobs|all my jobs|all of them|all completed|from my completed|the completed ones)\b/i.test(message.trim());
    if (askedWhichProject && looksLikeScopeClarification) {
      contextMessage += '\n\nCRITICAL: The assistant asked "which project?" but the user is clarifying SCOPE: they want ALL completed projects, not a single project name. Set domain = "portfolio", proposed_tool = "compare_projects", tool_args_draft = { status: "completed" }. The user wants aggregate profit/sum across completed projects. Do NOT treat "my completed projects" as a project name.';
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

// Shared AI financial/project helpers live in ../services/aiAssistantCore.js

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO "YES" = ALL PRESETS — run inline when user says Yes after scenario question
// Returns formatted message or null if no project context
// ─────────────────────────────────────────────────────────────────────────────
function formatScenarioPresetLine(adj, profitChange, newMarginPct, originalMarginPct, baselineLabel) {
  const profitStr = `${profitChange >= 0 ? '+' : ''}$${Math.round(profitChange).toLocaleString()}`;
  const marginStr = `${(Math.round(newMarginPct * 10) / 10).toFixed(1)}%`;
  const wasStr = `${(Math.round(originalMarginPct * 10) / 10).toFixed(1)}%`;
  const profitEmoji = profitChange >= 0 ? '📈' : '📉';
  let subLabel;
  if (adj.weeks) {
    subLabel = `${adj.weeks} extra week${adj.weeks > 1 ? 's' : ''} (labor + field overhead)`;
  } else if (adj.labor || adj.materials || adj.overhead) {
    subLabel = `Labor ${adj.labor >= 0 ? '+' : ''}${adj.labor}% · Mat ${adj.materials >= 0 ? '+' : ''}${adj.materials}%${adj.overhead ? ` · OH ${adj.overhead >= 0 ? '+' : ''}${adj.overhead}%` : ''}`;
  } else {
    subLabel = adj.label;
  }
  const baselineNote = baselineLabel ? `\n_${baselineLabel}_` : '';
  return `**${adj.label}**\n${subLabel}\n${profitEmoji} Profit **${profitStr}** · Margin **${marginStr}** (was ${wasStr})${baselineNote}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO FULL RESPONSE — structured output for single-scenario results
// Returns complete response with baseline, assumptions, numbers, and impact
// ─────────────────────────────────────────────────────────────────────────────
function formatScenarioFullResponse(opts) {
  const { adj, baselineLabel, original, adjusted, impact, projectName } = opts;
  const fmt = (n) => (n != null && Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : '—');
  const pct = (n) => (n != null && Number.isFinite(n) ? `${Math.round(n * 10) / 10}%` : '—');
  const baselineShort = baselineLabel && baselineLabel.includes('live forecast')
    ? 'Current live forecast'
    : baselineLabel && baselineLabel.includes('original estimate')
      ? 'Original estimate baseline'
      : baselineLabel || 'Original estimate baseline';

  const lines = [];
  lines.push(`**${adj.label}** scenario${projectName ? ` for ${projectName}` : ''}\n`);
  lines.push(`**Baseline used:** ${baselineShort}\n`);

  // Assumptions applied (use percentages from scenario definition, never invent)
  lines.push('**Assumptions applied:**');
  if (adj.weeks) {
    lines.push(`- ${adj.weeks} extra week${adj.weeks > 1 ? 's' : ''} of delay-sensitive cost (labor, field overhead, supervision, and delay inefficiency)`);
  } else {
    if (adj.labor != null) lines.push(`- Labor: ${adj.labor >= 0 ? '+' : ''}${adj.labor}%`);
    if (adj.materials != null) lines.push(`- Materials: ${adj.materials >= 0 ? '+' : ''}${adj.materials}%`);
    if (adj.overhead != null) lines.push(`- Overhead: ${adj.overhead >= 0 ? '+' : ''}${adj.overhead}%`);
    if (adj.labor == null && adj.materials == null && adj.overhead == null) {
      lines.push('- No cost adjustments');
    }
  }
  lines.push('');

  // Numbers — clear labels for each value
  const origMarginStr = original?.marginPct != null ? `${(Math.round(original.marginPct * 10) / 10).toFixed(1)}%` : '—';
  const newMarginStr = adjusted?.marginPct != null ? `${(Math.round(adjusted.marginPct * 10) / 10).toFixed(1)}%` : '—';
  lines.push('**Original:**');
  lines.push(`- Original bid: ${fmt(original?.bid)}`);
  lines.push(`- Original cost: ${fmt(original?.baseCost)}`);
  lines.push(`- Original projected profit: ${fmt(original?.profit)}`);
  lines.push(`- Original projected margin: ${origMarginStr}`);
  lines.push('');
  lines.push('**Revised:**');
  lines.push(`- Revised cost: ${fmt(adjusted?.baseCost)}`);
  lines.push(`- Revised projected profit: ${fmt(adjusted?.profit)}`);
  lines.push(`- Revised projected margin: ${newMarginStr}`);
  lines.push('');

  // Impact
  const origMargin = original?.marginPct != null ? Math.round(original.marginPct * 10) / 10 : null;
  const newMargin = adjusted?.marginPct != null ? Math.round(adjusted.marginPct * 10) / 10 : null;
  const marginChange = impact?.marginChange != null ? Math.round(impact.marginChange * 10) / 10 : (newMargin != null && origMargin != null ? newMargin - origMargin : null);
  const direction = marginChange != null && marginChange < 0 ? 'drop' : 'rise';
  const absChange = marginChange != null ? Math.abs(marginChange) : null;

  lines.push('**Impact:**');
  if (origMargin != null && newMargin != null && absChange != null) {
    lines.push(`Your projected margin would ${direction} from ${origMargin.toFixed(1)}% to ${newMargin.toFixed(1)}%, a ${marginChange < 0 ? 'decline' : 'gain'} of ${absChange} margin point${absChange !== 1 ? 's' : ''}.`);
  } else if (impact?.profitChange != null) {
    const sign = impact.profitChange >= 0 ? '+' : '';
    lines.push(`Projected profit change: ${sign}$${Math.round(impact.profitChange).toLocaleString()}.`);
  }
  return lines.join('\n');
}

// Compact block for multi-scenario (all_presets) view
function formatScenarioPresetBlock(adj, originalMarginPct, newBaseCost, newBid, newProfit, newMarginPct, profitChange) {
  const fmt = (n) => (n != null && Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : '—');
  const pct = (n) => (n != null && Number.isFinite(n) ? `${(Math.round(n * 10) / 10).toFixed(1)}%` : '—');
  let assumptions = '';
  if (adj.weeks) {
    assumptions = `${adj.weeks} extra week${adj.weeks > 1 ? 's' : ''} of delay-sensitive cost (labor, field overhead, supervision, and delay inefficiency)`;
  } else {
    const parts = [];
    if (adj.labor != null && adj.labor !== 0) parts.push(`Labor ${adj.labor >= 0 ? '+' : ''}${adj.labor}%`);
    if (adj.materials != null && adj.materials !== 0) parts.push(`Materials ${adj.materials >= 0 ? '+' : ''}${adj.materials}%`);
    if (adj.overhead != null && adj.overhead !== 0) parts.push(`Overhead ${adj.overhead >= 0 ? '+' : ''}${adj.overhead}%`);
    assumptions = parts.length ? parts.join(', ') : 'No adjustments';
  }
  const marginChange = newMarginPct != null && originalMarginPct != null ? (newMarginPct - originalMarginPct) : null;
  const origMarginStr = originalMarginPct != null ? `${(Math.round(originalMarginPct * 10) / 10).toFixed(1)}%` : '—';
  const impactStr = marginChange != null
    ? `Margin ${marginChange < 0 ? 'drops' : 'rises'} from ${origMarginStr} to ${pct(newMarginPct)}`
    : '';
  return `**${adj.label}**\nAssumptions: ${assumptions}\nRevised cost: ${fmt(newBaseCost)} · Revised projected profit: ${fmt(newProfit)} · Revised projected margin: ${pct(newMarginPct)}\nImpact: ${impactStr}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO MATH HELPERS — bucket-by-bucket primary, weighted fallback
// ─────────────────────────────────────────────────────────────────────────────
function computeScenarioCost(adj, { baseCost, laborCost, materialCost, overheadCost, originalBid }) {
  const hasBucketBreakdown = (laborCost > 0 || materialCost > 0 || overheadCost > 0) && (laborCost + materialCost + overheadCost) > 0;
  let newBaseCost, newBid, newLabor, newMaterials, newOverhead;

  if (adj.weeks) {
    return null; // Handled separately for delay logic
  }

  if (hasBucketBreakdown && (adj.labor != null || adj.materials != null || adj.overhead != null)) {
    // PRIMARY: Bucket-by-bucket math
    newLabor = laborCost * (1 + (adj.labor || 0) / 100);
    newMaterials = materialCost * (1 + (adj.materials || 0) / 100);
    newOverhead = overheadCost * (1 + (adj.overhead || 0) / 100);
    newBaseCost = newLabor + newMaterials + newOverhead;
    newBid = originalBid * (1 + (adj.bid || 0) / 100);
  } else if (baseCost > 0 && (adj.labor != null || adj.materials != null || adj.overhead != null)) {
    // FALLBACK: Weighted blend using cost shares (or equal weights if no breakdown)
    const totalFromBuckets = laborCost + materialCost + overheadCost;
    let laborShare = 1 / 3, materialsShare = 1 / 3, overheadShare = 1 / 3;
    if (totalFromBuckets > 0) {
      laborShare = laborCost / totalFromBuckets;
      materialsShare = materialCost / totalFromBuckets;
      overheadShare = overheadCost / totalFromBuckets;
    }
    const weightedPct = (laborShare * (adj.labor || 0)) + (materialsShare * (adj.materials || 0)) + (overheadShare * (adj.overhead || 0));
    newBaseCost = baseCost * (1 + weightedPct / 100);
    newBid = originalBid * (1 + (adj.bid || 0) / 100);
    newLabor = laborCost;
    newMaterials = materialCost;
    newOverhead = overheadCost;
  } else {
    return null;
  }

  const newProfit = newBid - newBaseCost;
  const newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
  return { newBaseCost, newBid, newProfit, newMarginPct, newLabor, newMaterials, newOverhead };
}

function computeDelayCost(adj, { baseCost, laborCost, materialCost, overheadCost, estimatedWeeks }) {
  if (!adj.weeks || estimatedWeeks <= 0) return null;
  const weeks = Math.max(estimatedWeeks, 1);
  // Delay-sensitive: labor + field overhead + rentals/supervision proxy + delay friction allowance.
  // Materials excluded: delayed jobs do not typically repeat full material spend weekly.
  const weeklyLabor = laborCost > 0 ? laborCost / weeks : 0;
  const weeklyFieldOverhead = overheadCost > 0 ? overheadCost / weeks : 0;
  const weeklyRentalsSupervision = baseCost > 0 ? (baseCost * 0.12 / weeks) : 0; // 12% of base per week proxy
  const weeklyDelayFriction = (weeklyLabor + weeklyFieldOverhead) * 0.12; // inefficiency, remobilization, cleanup
  let weeklyDelaySensitive = weeklyLabor + weeklyFieldOverhead + weeklyRentalsSupervision + weeklyDelayFriction;
  // Floor: ensure Job Runs Long (2 weeks) is usually worse than Typical Friction (~6% cost bump)
  const minWeeklyPct = 0.035; // 3.5% of base per week → 2 weeks = 7% minimum
  if (baseCost > 0) {
    const floor = baseCost * minWeeklyPct;
    weeklyDelaySensitive = Math.max(weeklyDelaySensitive, floor);
  }
  const addedDelayCost = weeklyDelaySensitive > 0 ? Math.round(weeklyDelaySensitive * adj.weeks) : Math.round((baseCost * 0.5 / weeks) * adj.weeks);
  const newBaseCost = baseCost + addedDelayCost;
  return { newBaseCost, addedDelayCost };
}

// Resolve correct full estimate baseline cost. Prefer full total over bucket sum (bucket sum can be partial).
function resolveEstimateBaselineCost(ctx, currentProject, estimateData, bucketSum, revenue, markupPct) {
  const fullTotal = Number(
    ctx.estimatedCost ||
    estimateData?.totalCost ||
    estimateData?.estimatedCost ||
    estimateData?.baseCost ||
    estimateData?.subtotal ||
    currentProject?.estimatedCost ||
    0
  );
  if (fullTotal > 0 && fullTotal >= bucketSum) return fullTotal;
  if (revenue > 0 && markupPct > 0 && markupPct < 100) {
    const derivedFromBid = revenue / (1 + markupPct / 100);
    if (derivedFromBid > 0 && derivedFromBid >= bucketSum) return Math.round(derivedFromBid);
  }
  if (revenue > 0 && (ctx.bidMarginPct ?? estimateData?.marginPct ?? estimateData?.margin) != null) {
    const marginPct = Number(ctx.bidMarginPct ?? estimateData?.marginPct ?? estimateData?.margin ?? 0);
    const pct = marginPct > 1 ? marginPct : marginPct * 100;
    if (pct > 0 && pct < 100) {
      const derived = revenue * (1 - pct / 100);
      if (derived > 0 && derived >= bucketSum) return Math.round(derived);
    }
  }
  return bucketSum > 0 ? bucketSum : fullTotal;
}

function runScenarioAllPresetsInline(ctx = {}) {
  const currentProject = ctx.currentProject || ctx;
  const estimateData = currentProject.estimateData || currentProject.estimate || {};
  const revenue = Number(ctx.contractValue || ctx.bidTotal || ctx.total || estimateData.totalBid || currentProject.bidPrice || 0);
  const forecastCost = Number(ctx.forecastFinalCost || currentProject.forecastFinalCost || 0);
  const projectedMarginPct = typeof ctx.projectedMarginPct === 'number' && Number.isFinite(ctx.projectedMarginPct) ? ctx.projectedMarginPct : (currentProject.projectedMarginPct);
  const actualCost = Number(ctx.actualCost || ctx.totalSpent || currentProject.actualCost || currentProject.totalSpent || 0);
  const estimatedCost = Number(estimateData.totalCost || estimateData.estimatedCost || estimateData.baseCost || currentProject.estimatedCost || 0);

  // Baseline selection: use estimate when early-stage (<20% spend); otherwise use live forecast when available
  const spendPct = estimatedCost > 0 ? (actualCost / estimatedCost) * 100 : 0;
  const useLiveForecast = spendPct >= 20 && revenue > 0 && (forecastCost > 0 || (typeof projectedMarginPct === 'number' && projectedMarginPct >= 0 && projectedMarginPct <= 100));
  const baseCostFromProject = forecastCost > 0 ? forecastCost : (revenue > 0 && typeof projectedMarginPct === 'number') ? revenue * (1 - projectedMarginPct / 100) : 0;

  let baseCost, originalBid, originalProfit, originalMarginPct, materialCost, laborCost, overheadCost, markupPct, baselineLabel;
  materialCost = Number(ctx.materialBudgetDirect || estimateData.materialTotal || estimateData.materialsTotal || currentProject.materialBudget || currentProject.materialsTotal || 0);
  laborCost = Number(estimateData.laborTotal || estimateData.laborCost || currentProject.laborTotal || currentProject.laborCost || 5000);
  overheadCost = Number(estimateData.overheadTotal || estimateData.overheadCost || currentProject.overheadTotal || currentProject.overheadCost || 0);
  const bucketSum = materialCost + laborCost + overheadCost;
  markupPct = Number(estimateData.markupPct || estimateData.markup || 20);
  const resolvedBaseCost = resolveEstimateBaselineCost(ctx, currentProject, estimateData, bucketSum, revenue, markupPct);
  if (bucketSum > 0 && resolvedBaseCost > bucketSum) {
    const scale = resolvedBaseCost / bucketSum;
    materialCost *= scale;
    laborCost *= scale;
    overheadCost *= scale;
  }

  if (useLiveForecast && baseCostFromProject > 0) {
    baseCost = baseCostFromProject;
    originalBid = revenue;
    baselineLabel = 'This scenario is based on your current live forecast.';
  } else if (revenue > 0 && resolvedBaseCost > 0) {
    baseCost = resolvedBaseCost;
    originalBid = Number(estimateData.totalBid || currentProject.bidPrice || baseCost + baseCost * (markupPct / 100));
    baselineLabel = 'This scenario is based on your original estimate baseline.';
  } else if (revenue > 0 && baseCostFromProject > 0) {
    baseCost = baseCostFromProject;
    originalBid = revenue;
    baselineLabel = 'This scenario is based on your current live forecast.';
  } else {
    return null;
  }

  originalProfit = originalBid - baseCost;
  originalMarginPct = originalBid > 0 ? (originalProfit / originalBid * 100) : 0;
  markupPct = Number(estimateData.markupPct || estimateData.markup || 20);

  const laborBudget = laborCost || Number(estimateData.laborTotal || currentProject.laborTotal || 0);
  const materialBudget = materialCost || Number(estimateData.materialTotal || estimateData.materialsTotal || currentProject.materialBudget || currentProject.materialsTotal || 0);
  const overheadBudget = overheadCost || Number(estimateData.overheadTotal || currentProject.overheadTotal || 0);
  const startISO = ctx.startDate || ctx.startISO || currentProject.startDate || currentProject.startISO;
  const endISO = ctx.endDate || ctx.endISO || currentProject.endDate || currentProject.endISO;
  let estimatedWeeks = 12;
  if (startISO && endISO) {
    const start = new Date(String(startISO));
    const end = new Date(String(endISO));
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
      estimatedWeeks = Math.max(4, Math.round((end - start) / (7 * 24 * 60 * 60 * 1000)));
    }
  }

  const scenarioMap = {
    typical_friction: { labor: 8, materials: 5, overhead: 3, bid: 0, label: 'Typical Friction' },
    bad_remodel: { labor: 20, materials: 15, overhead: 10, bid: 0, label: 'Bad Remodel' },
    smooth_job: { labor: -5, materials: -3, overhead: 0, bid: 0, label: 'Smooth Job' },
    job_runs_long: { weeks: 2, label: 'Job Runs Long (2 weeks)' },
    job_runs_long_4: { weeks: 4, label: 'Job Runs Long (4 weeks)' },
    job_runs_long_6: { weeks: 6, label: 'Job Runs Long (6 weeks)' },
  };
  const disclaimer = '\n\n[DISCLAIMER]Scenario results are projections based on applied cost adjustments—not guarantees of actual outcomes. Use for planning only.[/DISCLAIMER]';
  const presets = ['typical_friction', 'bad_remodel', 'smooth_job', 'job_runs_long', 'job_runs_long_4'];
  const baselineShort = baselineLabel && baselineLabel.includes('live forecast')
    ? 'Current live forecast'
    : 'Original estimate baseline';
  const projectName = (() => { const p = currentProject?.title || currentProject?.name || ctx.bidTitle; return typeof p === 'string' && p ? p : ''; })();
  const parts = [
    '### Scenario Analysis',
    projectName ? `\nScenarios for ${projectName}\n` : '\n',
    `**Baseline used:** ${baselineShort}\n`,
  ];

  for (const preset of presets) {
    const adj = scenarioMap[preset];
    let newBaseCost, newBid, newProfit, newMarginPct;
    if (adj.weeks) {
      const delayResult = computeDelayCost(adj, { baseCost, laborCost, materialCost, overheadCost, estimatedWeeks });
      if (delayResult) {
        newBaseCost = delayResult.newBaseCost;
        newBid = originalBid;
        newProfit = newBid - newBaseCost;
        newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
      } else {
        const weeklyLabor = laborBudget > 0 ? laborBudget / estimatedWeeks : 0;
        const weeklyOverhead = overheadBudget > 0 ? overheadBudget / estimatedWeeks : 0;
        const weeklyDelay = weeklyLabor + weeklyOverhead || (baseCost * 0.5 / estimatedWeeks);
        newBaseCost = baseCost + Math.round(weeklyDelay * adj.weeks);
        newBid = originalBid;
        newProfit = newBid - newBaseCost;
        newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
      }
    } else {
      const result = computeScenarioCost(adj, { baseCost, laborCost, materialCost, overheadCost, originalBid });
      if (result) {
        newBaseCost = result.newBaseCost;
        newBid = result.newBid;
        newProfit = result.newProfit;
        newMarginPct = result.newMarginPct;
      } else {
        const totalFromBuckets = laborCost + materialCost + overheadCost;
        const laborShare = totalFromBuckets > 0 ? laborCost / totalFromBuckets : 1 / 3;
        const materialsShare = totalFromBuckets > 0 ? materialCost / totalFromBuckets : 1 / 3;
        const overheadShare = totalFromBuckets > 0 ? overheadCost / totalFromBuckets : 1 / 3;
        const weightedPct = (laborShare * (adj.labor || 0)) + (materialsShare * (adj.materials || 0)) + (overheadShare * (adj.overhead || 0));
        newBaseCost = baseCost * (1 + weightedPct / 100);
        newBid = originalBid * (1 + (adj.bid || 0) / 100);
        newProfit = newBid - newBaseCost;
        newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
      }
    }
    const profitChange = newProfit - originalProfit;
    parts.push(formatScenarioPresetBlock(adj, originalMarginPct, newBaseCost, newBid, newProfit, newMarginPct, profitChange));
  }
  return parts.join('\n\n') + disclaimer;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN SCENARIO SINGLE INLINE — for RUN-FIRST when user taps a scenario card
// Returns formatted message or null if no project context. Uses scenario card
// assumptions exactly (e.g. Typical Friction = +8/+5/+3), never generic text.
// ─────────────────────────────────────────────────────────────────────────────
function runScenarioSingleInline(scenario, ctx = {}) {
  const scenarioMap = {
    typical_friction: { labor: 8, materials: 5, overhead: 3, bid: 0, label: 'Typical Friction' },
    bad_remodel: { labor: 20, materials: 15, overhead: 10, bid: 0, label: 'Bad Remodel' },
    smooth_job: { labor: -5, materials: -3, overhead: 0, bid: 0, label: 'Smooth Job' },
    job_runs_long: { weeks: 2, label: 'Job Runs Long (2 weeks)' },
    job_runs_long_4: { weeks: 4, label: 'Job Runs Long (4 weeks)' },
    job_runs_long_6: { weeks: 6, label: 'Job Runs Long (6 weeks)' },
  };
  const adj = scenarioMap[scenario] || scenarioMap.typical_friction;
  const currentProject = ctx.currentProject || ctx;
  const estimateData = currentProject.estimateData || currentProject.estimate || {};
  const revenue = Number(ctx.contractValue || ctx.bidTotal || ctx.total || estimateData.totalBid || currentProject.bidPrice || 0);
  const forecastCost = Number(ctx.forecastFinalCost || currentProject.forecastFinalCost || 0);
  const projectedMarginPct = typeof ctx.projectedMarginPct === 'number' && Number.isFinite(ctx.projectedMarginPct) ? ctx.projectedMarginPct : (currentProject.projectedMarginPct);
  const actualCost = Number(ctx.actualCost || ctx.totalSpent || currentProject.actualCost || currentProject.totalSpent || 0);
  const estimatedCost = Number(estimateData.totalCost || estimateData.estimatedCost || estimateData.baseCost || currentProject.estimatedCost || 0);
  const baseCostFromProject = forecastCost > 0 ? forecastCost : (revenue > 0 && typeof projectedMarginPct === 'number') ? revenue * (1 - projectedMarginPct / 100) : 0;

  const spendPct = estimatedCost > 0 ? (actualCost / estimatedCost) * 100 : 0;
  const useLiveForecast = spendPct >= 20 && revenue > 0 && (forecastCost > 0 || (typeof projectedMarginPct === 'number' && projectedMarginPct >= 0 && projectedMarginPct <= 100));

  let materialCost = Number(ctx.materialBudgetDirect || estimateData.materialTotal || estimateData.materialsTotal || currentProject.materialBudget || currentProject.materialsTotal || 0);
  let laborCost = Number(estimateData.laborTotal || estimateData.laborCost || currentProject.laborTotal || currentProject.laborCost || 5000);
  let overheadCost = Number(estimateData.overheadTotal || estimateData.overheadCost || currentProject.overheadTotal || currentProject.overheadCost || 0);
  const bucketSum = materialCost + laborCost + overheadCost;
  const markupPct = Number(estimateData.markupPct || estimateData.markup || 20);
  const resolvedBaseCost = resolveEstimateBaselineCost(ctx, currentProject, estimateData, bucketSum, revenue, markupPct);
  if (bucketSum > 0 && resolvedBaseCost > bucketSum) {
    const scale = resolvedBaseCost / bucketSum;
    materialCost *= scale;
    laborCost *= scale;
    overheadCost *= scale;
  }

  let baseCost, originalBid, baselineLabel;
  if (useLiveForecast && baseCostFromProject > 0) {
    baseCost = baseCostFromProject;
    originalBid = revenue;
    baselineLabel = 'This scenario is based on your current live forecast.';
  } else if (revenue > 0 && resolvedBaseCost > 0) {
    baseCost = resolvedBaseCost;
    originalBid = Number(estimateData.totalBid || currentProject.bidPrice || baseCost + baseCost * (markupPct / 100));
    baselineLabel = 'This scenario is based on your original estimate baseline.';
  } else if (revenue > 0 && baseCostFromProject > 0) {
    baseCost = baseCostFromProject;
    originalBid = revenue;
    baselineLabel = 'This scenario is based on your current live forecast.';
  } else {
    return null;
  }

  const originalProfit = originalBid - baseCost;
  const originalMarginPct = originalBid > 0 ? (originalProfit / originalBid * 100) : 0;
  const laborBudget = laborCost || Number(estimateData.laborTotal || currentProject.laborTotal || 0);
  const materialBudget = materialCost || Number(estimateData.materialTotal || estimateData.materialsTotal || currentProject.materialBudget || currentProject.materialsTotal || 0);
  const overheadBudget = overheadCost || Number(estimateData.overheadTotal || currentProject.overheadTotal || 0);
  const startISO = ctx.startDate || ctx.startISO || currentProject.startDate || currentProject.startISO;
  const endISO = ctx.endDate || ctx.endISO || currentProject.endDate || currentProject.endISO;
  let estimatedWeeks = 12;
  if (startISO && endISO) {
    const start = new Date(String(startISO));
    const end = new Date(String(endISO));
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
      estimatedWeeks = Math.max(4, Math.round((end - start) / (7 * 24 * 60 * 60 * 1000)));
    }
  }

  let newBaseCost, newBid, newProfit, newMarginPct, newLabor, newMaterials, newOverhead;
  if (adj.weeks) {
    const delayResult = computeDelayCost(adj, { baseCost, laborCost, materialCost, overheadCost, estimatedWeeks });
    if (delayResult) {
      newBaseCost = delayResult.newBaseCost;
      newBid = originalBid;
      newProfit = newBid - newBaseCost;
      newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
    } else {
      const weeklyLabor = laborBudget > 0 ? laborBudget / estimatedWeeks : 0;
      const weeklyOverhead = overheadBudget > 0 ? overheadBudget / estimatedWeeks : 0;
      const weeklyDelay = weeklyLabor + weeklyOverhead || (baseCost * 0.5 / estimatedWeeks);
      newBaseCost = baseCost + Math.round(weeklyDelay * adj.weeks);
      newBid = originalBid;
      newProfit = newBid - newBaseCost;
      newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
    }
    newLabor = laborCost;
    newMaterials = materialCost;
    newOverhead = overheadCost;
  } else {
    const result = computeScenarioCost(adj, { baseCost, laborCost, materialCost, overheadCost, originalBid });
    if (result) {
      newBaseCost = result.newBaseCost;
      newBid = result.newBid;
      newProfit = result.newProfit;
      newMarginPct = result.newMarginPct;
      newLabor = result.newLabor;
      newMaterials = result.newMaterials;
      newOverhead = result.newOverhead;
    } else {
      const totalFromBuckets = laborCost + materialCost + overheadCost;
      const laborShare = totalFromBuckets > 0 ? laborCost / totalFromBuckets : 1 / 3;
      const materialsShare = totalFromBuckets > 0 ? materialCost / totalFromBuckets : 1 / 3;
      const overheadShare = totalFromBuckets > 0 ? overheadCost / totalFromBuckets : 1 / 3;
      const weightedPct = (laborShare * (adj.labor || 0)) + (materialsShare * (adj.materials || 0)) + (overheadShare * (adj.overhead || 0));
      newBaseCost = baseCost * (1 + weightedPct / 100);
      newBid = originalBid * (1 + (adj.bid || 0) / 100);
      newProfit = newBid - newBaseCost;
      newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
      newLabor = laborCost;
      newMaterials = materialCost;
      newOverhead = overheadCost;
    }
  }
  const profitChange = newProfit - originalProfit;
  const projectName = (() => { const p = currentProject?.title || currentProject?.name || ctx.bidTitle; return typeof p === 'string' && p ? p : ''; })();
  const disclaimer = '\n\n[DISCLAIMER]Scenario results are projections based on applied cost adjustments—not guarantees of actual outcomes. Use for planning only.[/DISCLAIMER]';
  return formatScenarioFullResponse({
    adj,
    baselineLabel: baselineLabel || '',
    original: { baseCost, bid: originalBid, profit: originalProfit, marginPct: originalMarginPct },
    adjusted: { baseCost: newBaseCost, bid: newBid, profit: newProfit, marginPct: newMarginPct },
    impact: { profitChange, marginChange: newMarginPct - originalMarginPct },
    projectName,
  }) + disclaimer;
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
// PROJECT STATUS BLOCK — authoritative active vs completed breakdown
// Ensures AI always knows which projects need attention vs are done.
// ─────────────────────────────────────────────────────────────────────────────
function buildProjectStatusBlock(parsedContext) {
  const allProjects = Array.isArray(parsedContext?.allProjects) ? parsedContext.allProjects : [];
  if (!allProjects.length) return '';

  const isActive = (s) => ['won', 'active', 'in_progress', 'in-progress'].includes((s || '').toLowerCase());
  const isCompleted = (s) => (s || '').toLowerCase() === 'completed';
  const isSubmitted = (s) => ['bid_submitted', 'submitted'].includes((s || '').toLowerCase());
  const isEstimate = (s) => ['estimate', 'draft'].includes((s || '').toLowerCase());

  const getStatus = (p) => (p?.status ?? p?.projectData?.status ?? '').toString().toLowerCase().replace(/\s+/g, '_');
  const active = allProjects.filter((p) => isActive(getStatus(p))).map((p) => p?.title || p?.name || 'Untitled');
  const completed = allProjects.filter((p) => isCompleted(getStatus(p))).map((p) => p?.title || p?.name || 'Untitled');
  const submitted = allProjects.filter((p) => isSubmitted(getStatus(p))).map((p) => p?.title || p?.name || 'Untitled');
  const estimates = allProjects.filter((p) => isEstimate(getStatus(p))).map((p) => p?.title || p?.name || 'Untitled');

  let lines = [];
  if (active.length > 0) lines.push(`Active (in progress): ${active.join(', ')}`);
  if (completed.length > 0) lines.push(`Completed (done): ${completed.join(', ')}`);
  if (submitted.length > 0) lines.push(`Submitted (bid sent, awaiting): ${submitted.join(', ')}`);
  if (estimates.length > 0) lines.push(`Estimates (draft, not yet sent): ${estimates.join(', ')}`);

  if (lines.length === 0) return '';
  return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PROJECT STATUS (authoritative — active, completed, submitted, estimates)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${lines.join('\n')}

RULES:
→ This status comes from the current app context. Users can delete projects or change status (e.g. submitted → active).
→ Always use this list — never assume a project exists or has a status from prior conversation.
→ For "focus today" / "what needs attention" — only list ACTIVE projects. Exclude completed. Also include calendar/schedule: payments due, inspections, deliveries from the UPCOMING EVENTS block when present.
→ Do not reference deleted projects. If a project is not in this list, it no longer exists.
→ CRITICAL: If "Active (in progress)" lists project names (e.g. Bob), you MUST mention them. NEVER say "no active projects" or "no projects need attention" when the Active list has names.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARGIN ANSWER HINT — inject exact numbers so AI uses live project metrics first
// Source priority: live actuals > forecast > estimate baseline
// ─────────────────────────────────────────────────────────────────────────────
function buildMarginAnswerHint(normalizedMessage, allProjects, projectName, projectId, currentProjectData, parsedContext) {
  const msgLower = (normalizedMessage || '').toLowerCase();
  const isMarginQuestion = /\b(margin|profit\s+margin|expected\s+margin)\b/.test(msgLower);
  if (!isMarginQuestion || !Array.isArray(allProjects) || allProjects.length === 0) return null;

  // Explicit request for estimate/bid margin only — answer with that
  const wantsEstimateOnly = /\b(estimate|original|bid|at bid time)\s+margin\b/i.test(msgLower) ||
    /\bmargin\s+(?:from|of)\s+(?:your\s+)?(?:estimate|bid)\b/i.test(msgLower);

  // Resolve project: by name in message (e.g. "for Jerry") or current project
  let project = currentProjectData || null;
  if (projectId && !project) {
    project = allProjects.find(p => String(p?.id) === String(projectId));
  }
  if (!project && projectName) {
    project = allProjects.find(p => {
      const name = (p?.title || p?.name || '').toLowerCase();
      const search = (projectName || '').toLowerCase();
      return name && (name.includes(search) || search.includes(name));
    });
  }
  // Match project name mentioned in message (e.g. "margin for Jerry", "Jerry's margin")
  if (!project) {
    const names = allProjects.map(p => (p?.title || p?.name || '').trim()).filter(Boolean);
    for (const name of names) {
      if (name.length < 2) continue;
      if (msgLower.includes(name.toLowerCase())) {
        project = allProjects.find(p => (p?.title || p?.name || '').trim() === name);
        if (project) break;
      }
    }
  }
  if (!project) return null;

  let bidMarginPct = project.bidMarginPct != null && !Number.isNaN(Number(project.bidMarginPct))
    ? Number(project.bidMarginPct)
    : null;
  if (bidMarginPct == null && project.estimateData) {
    const ed = project.estimateData;
    const stored = ed.marginPercent ?? ed.margin ?? ed.marginPct;
    if (typeof stored === 'number' && Number.isFinite(stored)) {
      const pct = stored > 1 ? stored : stored * 100;
      if (pct >= 0 && pct <= 100) bidMarginPct = pct;
    }
    if (bidMarginPct == null) {
      const bidPrice = Number(project.bidPrice || project.bidTotal || ed?.totalBid || 0);
      if (bidPrice > 0) {
        if (ed.subtotal > 0 && ed.profit >= 0) {
          const total = ed.subtotal + ed.profit;
          if (total > 0) bidMarginPct = Math.round((ed.profit / total) * 1000) / 10;
        } else if (Number(ed.markupPct || ed.markup || 0) > 0) {
          const m = Number(ed.markupPct || ed.markup);
          bidMarginPct = Math.round((m / (100 + m)) * 1000) / 10;
        }
      }
    }
  }

  const isCurrent = isCurrentProjectMatch(project, parsedContext);
  const contract = Number(project.contractValue || project.bidPrice || project.bidTotal || parsedContext?.contractValue || parsedContext?.bidTotal || 0);
  const spent = Number(isCurrent ? (parsedContext?.actualCost ?? parsedContext?.totalSpent ?? project.totalSpent ?? project.actualCost ?? 0) : (project.totalSpent || project.actualCost || 0));
  const hasLiveActuals = spent > 0 || (project.expensesCount > 0 || (Array.isArray(project.expenses) && project.expenses.length > 0));

  // Spend-to-date = (contract − spent) / contract — NEVER use estimate margin when hasLiveActuals
  const spendToDatePct = (isCurrent && typeof parsedContext.spendToDateMarginPct === 'number' && Number.isFinite(parsedContext.spendToDateMarginPct))
    ? parsedContext.spendToDateMarginPct
    : (contract > 0 && spent >= 0 ? Math.round(((contract - spent) / contract) * 1000) / 10 : (project.spendToDateMarginPct ?? project.currentMarginPct));
  const projectedPct = (isCurrent && typeof parsedContext.projectedMarginPct === 'number' && Number.isFinite(parsedContext.projectedMarginPct))
    ? parsedContext.projectedMarginPct
    : (project.projectedMarginPct ?? null);
  const name = project.title || project.name || 'This project';

  const spendToDateStr = spendToDatePct != null ? Number(spendToDatePct).toFixed(1) + '%' : '—';
  const projectedStr = projectedPct != null ? Number(projectedPct).toFixed(1) + '%' : '—';
  const bidStr = bidMarginPct != null ? Number(bidMarginPct).toFixed(1) + '%' : '—';

  if (wantsEstimateOnly) {
    return `CRITICAL — User asked for ESTIMATE/ORIGINAL margin only. For "${name}": Original estimated margin: ${bidStr}. Do NOT state spend-to-date or projected.`;
  }

  let hint = `CRITICAL — For "${name}" margin questions, SOURCE PRIORITY: live project actuals > forecast > estimate.\n`;
  hint += `- **Spend-to-date margin**: ${spendToDateStr} — (contract − spent) / contract. PRIMARY for "current margin".\n`;
  hint += `- **Projected margin (at completion)**: ${projectedStr} — expected if spending continues at current rate. Mention when user asks "current margin" (users often mean both).\n`;
  hint += `- **Original estimated margin**: ${bidStr} — from bid/estimate. ONLY use when user explicitly asks "estimate margin", "original bid margin", "margin at bid time".\n`;
  hint += `When user asks "what is my current margin", "what is the margin", or "current margin": Answer with spend-to-date (${spendToDateStr}) FIRST, then projected (${projectedStr}), then original (${bidStr}) last. CRITICAL: NEVER use original/bid margin (${bidStr}) as the answer for "current margin" when the job has live actuals (spent > 0). "Current margin" = spend-to-date ONLY.`;
  return hint;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT DATA SNAPSHOT (additive)
// Builds a concise per-project data block so the AI always has key facts
// in-context without needing tool calls for basic questions.
// ─────────────────────────────────────────────────────────────────────────────
function buildProjectDataSnapshot(parsedContext) {
  const allProjects = Array.isArray(parsedContext?.allProjects) ? parsedContext.allProjects : [];
  if (!allProjects.length) return '';

  const now = new Date();
  const fmt = (v) => {
    const n = Number(typeof v === 'string' ? v.replace(/[$,\s]/g, '') : v);
    return Number.isFinite(n) ? n : 0;
  };

  const projectId = parsedContext?.projectId;
  const hasOverview = parsedContext && (typeof parsedContext.spendToDateMarginPct === 'number' || typeof parsedContext.projectedMarginPct === 'number');
  const isCurrentProjectMatch = (p) => projectId != null && String(p?.id) === String(projectId);

  const lines = allProjects.map((p) => {
    const title = p?.title || p?.name || 'Untitled';
    const status = (p?.status || 'unknown').replace(/_/g, ' ');
    const isCurrent = isCurrentProjectMatch(p);
    const contract = fmt(p?.contractValue || p?.bidPrice || (isCurrent ? parsedContext?.contractValue : null) || (isCurrent ? parsedContext?.bidTotal : null));
    const spent = fmt(isCurrent ? (parsedContext?.actualCost ?? parsedContext?.totalSpent ?? p?.totalSpent ?? p?.actualCost) : (p?.totalSpent || p?.actualCost));
    const estimated = fmt(p?.estimatedCost);
    const profit = contract > 0 ? contract - (estimated || spent) : 0;
    const currentMarginPct = (hasOverview && isCurrent && typeof parsedContext.spendToDateMarginPct === 'number')
      ? parsedContext.spendToDateMarginPct.toFixed(1)
      : (contract > 0 ? ((contract - spent) / contract * 100).toFixed(1) : '0.0');
    const projectedMarginPct = (hasOverview && isCurrent && typeof parsedContext.projectedMarginPct === 'number')
      ? parsedContext.projectedMarginPct.toFixed(1)
      : null;
    const progress = fmt(p?.progress);
    const bidMarginVal = p?.bidMarginPct;
    const bidMargin = bidMarginVal != null && !Number.isNaN(Number(bidMarginVal)) ? `${Number(bidMarginVal)}%` : null;

    let parts = [`**${title}** (${status}) | Progress: ${progress}%`];
    if (bidMargin) parts.push(`Bid margin (from estimate): ${bidMargin}`);
    if (contract > 0) {
      parts.push(`Contract: $${contract.toLocaleString()} | Spent: $${spent.toLocaleString()} | Est. Cost: $${estimated.toLocaleString()} | Profit: $${profit.toLocaleString()}`);
      parts.push(`Current margin (spend-to-date): ${currentMarginPct}%`);
      if (projectedMarginPct) parts.push(`Projected margin (at completion): ${projectedMarginPct}%`);
    }

    // Milestones / payments
    const milestones = Array.isArray(p?.milestones) ? p.milestones : [];
    const pStatus = (p?.status || '').toLowerCase();
    const projectDone = pStatus === 'completed' || pStatus === 'done' || pStatus === 'finished' || progress >= 100;
    const isCollected = (m) => {
      if (projectDone) return true;
      const s = String(m?.status || m?.state || '').toLowerCase();
      return s === 'collected' || s === 'paid' || s === 'done' || s === 'complete' || s === 'completed' || s === 'finished' || (m?.progressPct >= 100) || (m?.progress >= 100);
    };
    const unpaid = milestones.filter((m) => !isCollected(m));
    const paid = milestones.filter((m) => isCollected(m));
    if (milestones.length > 0) {
      const paidSummary = paid.map((m) => `${m?.title || m?.name || 'Payment'} $${fmt(m?.amount || m?.paymentAmount).toLocaleString()} (PAID)`).join(', ');
      const unpaidSummary = unpaid.map((m) => {
        const dt = m?.plannedDate || m?.scheduledDate || m?.dueDate || m?.date;
        const dateStr = dt ? new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'no date';
        return `${m?.title || m?.name || 'Payment'} $${fmt(m?.amount || m?.paymentAmount).toLocaleString()} due ${dateStr} (UNPAID)`;
      }).join(', ');
      if (paidSummary) parts.push(`Paid: ${paidSummary}`);
      if (unpaidSummary) parts.push(`Upcoming: ${unpaidSummary}`);
    }

    // Top expense vendors
    const expenses = Array.isArray(p?.expenses) ? p.expenses : [];
    if (expenses.length > 0) {
      const vendorTotals = {};
      expenses.forEach((e) => {
        const v = (e?.vendor || 'Unknown').trim();
        vendorTotals[v] = (vendorTotals[v] || 0) + fmt(e?.amount);
      });
      const topVendors = Object.entries(vendorTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([v, total]) => `${v} ($${total.toLocaleString()})`)
        .join(', ');
      parts.push(`Vendors: ${topVendors} | ${expenses.length} total expenses`);
    }

    // Purchase orders
    const pos = Array.isArray(p?.purchaseOrders) ? p.purchaseOrders : [];
    if (pos.length > 0) {
      const openPOs = pos.filter((po) => !(po?.received || po?.status === 'received'));
      const totalCommitted = pos.reduce((s, po) => s + fmt(po?.amount || po?.total), 0);
      parts.push(`POs: ${pos.length} total ($${totalCommitted.toLocaleString()} committed), ${openPOs.length} open`);
    }

    // Calendar events / inspections (active projects only — exclude completed jobs)
    if (isProjectActiveForCalendarEvents(p)) {
    const events = Array.isArray(p?.calendarEvents) ? p.calendarEvents : [];
    const upcoming = events
      .filter((ev) => {
        if (ev?.completed) return false;
        const d = new Date(ev?.date || 0);
        return Number.isFinite(d.getTime()) && d.getTime() >= now.getTime() - 86400000;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
    if (upcoming.length > 0) {
      const evStr = upcoming.map((ev) => {
        const dateStr = new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = ev.time ? ` at ${ev.time}` : '';
        return `${ev.title || ev.type || 'Event'}${timeStr} ${dateStr}`;
      }).join(', ');
      parts.push(`Events: ${evStr}`);
      }
    }

    // Daily logs (recent)
    const logs = Array.isArray(p?.dailyLogs) ? p.dailyLogs : [];
    if (logs.length > 0) {
      const recent = logs.slice(-3);
      const logStr = recent.map((l) => {
        const dateStr = l?.date ? new Date(l.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const summary = l?.summary || l?.notes || l?.description || '';
        return `${dateStr}: ${summary.slice(0, 80)}`;
      }).filter(Boolean).join(' | ');
      if (logStr) parts.push(`Recent logs: ${logStr}`);
    }

    // Change orders
    const cos = Array.isArray(p?.changeOrders) ? p.changeOrders : [];
    if (cos.length > 0) {
      const approved = cos.filter((co) => co?.approved || (co?.status || '').toLowerCase() === 'approved');
      const totalApproved = approved.reduce((s, co) => s + fmt(co?.amount), 0);
      parts.push(`Change orders: ${cos.length} total, ${approved.length} approved ($${totalApproved.toLocaleString()})`);
    }

    return parts.join('\n  ');
  });

  return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PROJECT DATA SNAPSHOT (latest app snapshot — answer directly from this data when present)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${lines.join('\n---\n')}

RULES:
→ This snapshot reflects the latest data available from the user's app in this session. Use it first when the answer is clearly present here.
→ When the user asks about payments, expenses, vendors, inspections, profit, or budget — answer DIRECTLY from this snapshot.
→ Do NOT say "I don't have that information" or "let me check" when the answer is clearly in this snapshot.
→ If the user asks about a specific vendor (e.g. "Home Depot"), search the Vendors line for that name.
→ If the user asks about upcoming payments or "when am I getting paid next", look at the "Upcoming" line (TIMELINE data). Answer in this format: "Your next payment is the [payment name] for the [project title] project, amounting to $[amount], due on [date]." If some show "due no date", list them (name, amount) and say they can set dates in the Timeline; do NOT say "no upcoming payments".
→ If the user asks about "upcoming events on the calendar" or "what's on the calendar", use the dashboard calendar: (1) the "Events" line per project (inspections, deliveries, deadlines) and (2) the "Upcoming" line (payments). List across ALL projects — do NOT limit to one project.
→ If the user asks about inspections or events, check the "Events" line.
→ For profit/margin questions, use the Contract, Spent, and Profit numbers directly.
→ Only use tools (compare_projects, get_project_health, etc.) for deeper analysis or actions — not for basic data lookups.`;
}

function isEstimateAssistantScreen(parsedContext) {
  const screen = String(parsedContext?.screen || '').toLowerCase();
  return screen.includes('estimate');
}

function parseLooseCurrencyAmount(rawValue) {
  const raw = String(rawValue || '').trim().toLowerCase();
  if (!raw) return null;
  const hasMoneyCue = /\$|\bk\b|\bgrand\b/.test(raw);
  let normalized = raw.replace(/[$,\s]/g, '');
  let multiplier = 1;
  if (normalized.endsWith('grand')) {
    multiplier = 1000;
    normalized = normalized.replace(/grand$/, '');
  } else if (normalized.endsWith('k')) {
    multiplier = 1000;
    normalized = normalized.replace(/k$/, '');
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  if (!hasMoneyCue && amount < 100) return null;
  return Math.round(amount * multiplier * 100) / 100;
}

function titleCaseEstimateText(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function cleanEstimatePhrase(text, { trailing = false } = {}) {
  if (!text) return '';
  let value = String(text).replace(/\s+/g, ' ').trim();
  if (!value) return '';
  value = trailing
    ? (value.split(/\s*(?:,|;|\band\b|\bplus\b)\s*/i)[0] || value)
    : (value.split(/\s*(?:,|;|\band\b|\bplus\b)\s*/i).pop() || value);
  value = value
    .replace(/^[\s:.\-]+|[\s:.\-]+$/g, '')
    .replace(/^(?:for|on|in|to|toward|of|at|is|are|will be|would be|costs?|costing)\s+/i, '')
    .replace(/^(?:i(?:'m| am)?\s+(?:gonna\s+be\s+)?spending|we(?:'re| are)?\s+spending|spending|add|use|put|include|set|update|make)\s+/i, '')
    .replace(/\b(?:around|about|roughly|like|maybe|approximately)\b/gi, '')
    .replace(/^[\s:.\-]+|[\s:.\-]+$/g, '')
    .trim();
  return value.replace(/\s+/g, ' ');
}

function normalizeEstimateLineItemName(rawName, kind = 'material') {
  const lower = String(rawName || '').toLowerCase().trim();
  if (!lower) return kind === 'labor' ? 'Labor' : 'Material';
  if (/(?:framing\s+lumber|lumber\s+for\s+framing|framing\s+wood)/i.test(lower)) {
    return kind === 'labor' ? 'Framing Labor' : 'Framing Lumber';
  }
  if (/\btile\b/i.test(lower)) return kind === 'labor' ? 'Tile Labor' : 'Tile Materials';
  if (/\bdrywall\b/i.test(lower)) return kind === 'labor' ? 'Drywall Labor' : 'Drywall Materials';
  if (/\bpaint(?:ing)?\b/i.test(lower)) return kind === 'labor' ? 'Painting Labor' : 'Paint Materials';
  if (/\bframe|framer|framing\b/i.test(lower)) return kind === 'labor' ? 'Framing Labor' : 'Framing Materials';
  if (/\belectric(?:al|ian)?\b/i.test(lower)) return kind === 'labor' ? 'Electrical Labor' : 'Electrical Materials';
  if (/\bplumb(?:ing|er)?\b/i.test(lower)) return kind === 'labor' ? 'Plumbing Labor' : 'Plumbing Materials';
  const cleaned = lower
    .replace(/\bmaterials?\b/g, '')
    .replace(/\blabor\b/g, '')
    .replace(/\bsub\b/g, '')
    .replace(/\bcrew\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const titled = titleCaseEstimateText(cleaned || lower);
  if (kind === 'labor') {
    return /labor$/i.test(titled) ? titled : `${titled} Labor`;
  }
  return /\b(material|materials|allowance|fixtures|equipment)\b/i.test(titled) ? titled : `${titled} Materials`;
}

function inferEstimateItemKind(label, fullMessage = '') {
  const sample = `${label} ${fullMessage}`.toLowerCase();
  const laborSignals = /\b(labor|labour|crew|sub|subcontractor|installer|setter|framer|electrician|plumber|painter|drywall\s+labor|tile\s+labor|framing\s+labor|hour|hours|rate)\b/i;
  return laborSignals.test(sample) ? 'labor' : 'material';
}

function shouldSkipEstimateLabel(label) {
  const lower = String(label || '').toLowerCase().trim();
  if (!lower) return true;
  if (lower.length < 2) return true;
  return /\b(payment|deposit|markup|margin|overhead|health|budget|breakdown|week|weeks|schedule|client|customer|job|project|las vegas|nevada)\b/i.test(lower);
}

function extractEstimateCostItems(message) {
  const text = String(message || '');
  const amountRegex = /\$?\d[\d,]*(?:\.\d+)?(?:\s*(?:k|grand))?/ig;
  const matches = Array.from(text.matchAll(amountRegex));
  if (!matches.length) return [];

  const items = [];
  matches.forEach((match, index) => {
    const rawAmount = match[0];
    const amount = parseLooseCurrencyAmount(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const currentIndex = match.index || 0;
    const previousMatch = index > 0 ? matches[index - 1] : null;
    const nextMatch = index < matches.length - 1 ? matches[index + 1] : null;
    const leading = text.slice(previousMatch ? (previousMatch.index || 0) + previousMatch[0].length : 0, currentIndex);
    const trailing = text.slice(currentIndex + rawAmount.length, nextMatch ? (nextMatch.index || text.length) : text.length);

    let label = '';
    const trailingLooksLikeLabel = /^\s*(?:for|on|in|to|toward|of|at)\b/i.test(trailing);
    const cleanedLeading = cleanEstimatePhrase(leading, { trailing: false });
    const cleanedTrailing = cleanEstimatePhrase(trailing, { trailing: true });
    if (trailingLooksLikeLabel || !cleanedLeading) {
      label = cleanedTrailing || cleanedLeading;
    } else {
      label = cleanedLeading || cleanedTrailing;
    }
    if (shouldSkipEstimateLabel(label)) return;

    const kind = inferEstimateItemKind(label, text);
    const normalizedName = normalizeEstimateLineItemName(label, kind);
    const key = `${kind}:${normalizedName.toLowerCase()}:${amount}`;
    if (items.some((item) => item.key === key)) return;

    items.push({
      key,
      kind,
      rawLabel: label,
      name: normalizedName,
      amount,
      quantity: 1,
      unitCost: amount,
      category: kind === 'labor' ? 'Labor' : 'Materials/Equipment',
    });
  });

  return items;
}

function messageLooksLikeEstimateMutation(message, parsedItems = []) {
  const lower = String(message || '').toLowerCase();
  const explicitMutation =
    /\b(add|use|put|set|update|change|apply|record|include)\b/.test(lower) ||
    /\b(i(?:'m| am)?\s+(?:gonna\s+be\s+)?spending|we(?:'re| are)?\s+spending|it(?:'s| is)?\s+like|it(?:'s| is)?\s+around|it\s+will\s+cost|will\s+cost)\b/.test(lower);
  if (!parsedItems.length) return explicitMutation;
  if (explicitMutation) return true;
  if (lower.includes('?')) return false;
  if (parsedItems.length >= 2) return true;
  return !/^\s*(what|how|why|when|could|would|should|is|are|does|do)\b/i.test(lower);
}

function normalizeUsPhoneForEstimate(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return normalizeUsPhoneForEstimate(d.slice(1));
  return String(raw || '').trim();
}

/** Normalize punctuation from mobile keyboards (e.g. iOS fullwidth “．”) so parsers see ASCII. */
function normalizeEstimateUserMessageText(input) {
  return String(input || '')
    .replace(/\uFF0E/g, '.')
    .replace(/\uFF1A/g, ':')
    .replace(/\u2018|\u2019/g, "'");
}

/** True when the user is likely submitting Step 1 customer/contact text (not a generic question). */
function looksLikeCustomerInfoSubmission(message) {
  const t = normalizeEstimateUserMessageText(String(message || ''));
  if (t.length < 2) return false;
  const lower = t.toLowerCase();
  if (/^\s*(what|how|why|when|where|which|should|could|would|is|are|does|do|can|tell me|show me)\b/i.test(t) && t.length < 80 && !/\d{3}[-.\s]?\d{3}/.test(t)) {
    return false;
  }
  if (/\b(?:client|customer)\s+(?:is|=)\s+\S+/i.test(t)) return true;
  if (/\b(?:job|project|site)\s+(?:is\s+)?in\s+/i.test(t)) return true;
  if (/\b(?:phone|cell|mobile|call|text)\s*[:#]?\s*\(?\d{3}/i.test(t)) return true;
  if (/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(t)) return true;
  if (/\bnotes?\s*:/i.test(t)) return true;
  if (/^\s*\d+[.)]\s/m.test(t)) return true;
  if (/\b\d{1,5}\s+[NSEW]?\s*[A-Za-z0-9.'\s-]{2,40}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b/i.test(t)) return true;
  if (/^\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s*$/i.test(t.trim())) return true;
  if (/\b(?:^|\n)\s*(?:name|client)\s*:\s*\S+/i.test(t)) return true;
  return false;
}

/** Strip markdown **bold** and bullets from a line of user text. */
function stripCustomerFieldLine(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/^\*+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses common contractor pattern: numbered list 1=name, 2=phone, 3=address
 * e.g. "1. Stephen\n2. 7943456473\n3. 1436 rock road Las Vegas Nv, 89141"
 */
function parseNumberedCustomerStep1Lines(text) {
  const raw = normalizeEstimateUserMessageText(String(text || '')).trim();
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const numbered = [];
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
    if (m) numbered.push({ n: Number(m[1]), content: m[2] });
  }
  if (numbered.length === 0) return null;

  const byNum = new Map(numbered.map((x) => [x.n, x.content]));
  const c1 = byNum.get(1);
  const c2 = byNum.get(2);
  const c3 = byNum.get(3);
  const out = {};

  if (c1) {
    const s1 = stripCustomerFieldLine(c1);
    const digitsOnly = s1.replace(/\D/g, '');
    const looksPhone = digitsOnly.length >= 10 && digitsOnly.length <= 11;
    const looksStreet =
      /^\d{1,5}\s/.test(s1) && /\b(?:road|rd|st|ave|dr|ln|way|blvd|ct|street|drive|lane)\b/i.test(s1);
    if (!looksPhone && !looksStreet && s1.length <= 120) {
      out.customerName = s1;
    }
  }
  if (c2) {
    const s2 = stripCustomerFieldLine(c2);
    const digits = s2.replace(/\D/g, '');
    if (digits.length === 10) {
      out.phone = normalizeUsPhoneForEstimate(s2);
    } else if (digits.length === 11 && digits[0] === '1') {
      out.phone = normalizeUsPhoneForEstimate(digits.slice(1));
    }
  }
  if (c3) {
    const s3 = stripCustomerFieldLine(c3);
    out.address = s3;
    const z = s3.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (z) out.zip = z[1];
  }

  return Object.keys(out).length ? out : null;
}

/** Single-line address for Step 1 review (avoid repeating ZIP already present in the street line). */
function formatEstimateCustomerAddressDisplay(action) {
  if (!action || typeof action !== 'object') return '';
  const addr = String(action.address || '').trim();
  const zip = String(action.zip || '').trim();
  const city = String(action.city || '').trim();
  const state = String(action.state || '').trim();
  if (!addr) return [city, state, zip].filter(Boolean).join(', ');
  const parts = [addr];
  for (const segment of [city, state]) {
    if (segment && !addr.includes(segment)) parts.push(segment);
  }
  if (zip) {
    const re = new RegExp(`\\b${zip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (!re.test(parts.join(', '))) parts.push(zip);
  }
  return parts.join(', ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Parse Step 1 fields from natural language. Returns a plain object or null.
 */
function parseEstimateStep1CustomerInfo(message) {
  const text = normalizeEstimateUserMessageText(String(message || '')).trim();
  if (!text) return null;
  const out = {};

  let work = text;
  const notesMatch = text.match(/\bnotes?\s*:\s*([\s\S]+)$/i) || text.match(/\bnotes?\s+are\s+([\s\S]+)$/i);
  if (notesMatch) {
    out.notes = String(notesMatch[1] || '').trim().replace(/\s+/g, ' ');
    work = work.slice(0, notesMatch.index).trim();
  }

  const fromNumbered = parseNumberedCustomerStep1Lines(work);
  if (fromNumbered) {
    Object.assign(out, fromNumbered);
  }

  const emailMatch = work.match(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i);
  if (emailMatch) out.email = emailMatch[1];

  const phoneRe = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  if (!out.phone) {
    const phones = work.match(phoneRe);
    if (phones && phones[0]) out.phone = normalizeUsPhoneForEstimate(phones[0]);
  }

  let nameMatch = work.match(/\b(?:client|customer)\s+(?:is|=)\s+([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,3})\b/);
  if (nameMatch) out.customerName = nameMatch[1].trim();
  if (!out.customerName) {
    nameMatch = work.match(/\b(?:name|client)\s+is\s+([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,3})\b/i);
    if (nameMatch) out.customerName = nameMatch[1].trim();
  }
  if (!out.customerName) {
    nameMatch = work.match(/\b(?:i(?:'m| am)|this is|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/);
    if (nameMatch) out.customerName = nameMatch[1].trim();
  }

  const locationMatch = work.match(/\b(?:job|project|site)\s+(?:is\s+)?in\s+([A-Za-z ,.'-]+?)(?=$|[.!?]|\n)/i);
  if (locationMatch) {
    const rawLocation = String(locationMatch[1] || '')
      .split(/(?:,\s*)?(?=\$?\d|\b(?:tile|drywall|lumber|framing|paint|electrical|plumbing|markup|deposit|labor|materials?)\b)/i)[0]
      .trim()
      .replace(/\s+/g, ' ');
    if (rawLocation.includes(',')) {
      const parts = rawLocation.split(',').map((part) => part.trim()).filter(Boolean);
      out.city = parts[0] || undefined;
      out.state = parts[1] || undefined;
    } else {
      const words = rawLocation.split(/\s+/).filter(Boolean);
      if (words.length >= 3) {
        out.state = words.pop();
        out.city = words.join(' ');
      } else if (words.length === 2) {
        out.city = words[0];
        out.state = words[1];
      } else if (words.length === 1) {
        out.city = words[0];
      }
    }
  }

  const numberedName = work.match(/^\s*\d+[.)]\s*(?:the\s+)?(?:client|customer)\s+is\s+([^\n]+)/im);
  if (numberedName && !out.customerName) {
    const chunk = numberedName[1].split(/[.!?\n]/)[0].trim();
    if (chunk) out.customerName = chunk.replace(/^the\s+/i, '').trim();
  }

  if (!out.address) {
    const streetLine = work.match(
      /\b(\d{1,5}\s+[NSEW]?\s*[A-Za-z0-9.'#\- ]{2,60}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b[^,\n]*)[, ]+\s*([^.\n]+)/i
    );
    if (streetLine) {
      out.address = `${streetLine[1].trim()}, ${streetLine[2].trim()}`.replace(/\s+/g, ' ');
    } else {
      const streetOnly = work.match(
        /\b(\d{1,5}\s+[NSEW]?\s*[A-Za-z0-9.'#\- ]{2,60}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct))\b[^.\n]*/i
      );
      if (streetOnly) out.address = streetOnly[0].trim();
    }
  }

  if (!out.zip) {
    const zipMatch = work.match(/\b(\d{5})(?:-\d{4})?\b/);
    if (zipMatch) out.zip = zipMatch[1];
  }

  const singleNameLine = text.trim().match(/^\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*$/);
  if (singleNameLine && !out.customerName) out.customerName = singleNameLine[1].trim();

  const keys = Object.keys(out).filter((k) => out[k] != null && String(out[k]).trim() !== '');
  if (keys.length === 0) return null;
  return out;
}

function buildUpdateCustomerInfoAction(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const action = { type: 'update_customer_info' };
  if (parsed.customerName) action.customerName = parsed.customerName;
  if (parsed.phone) action.phone = parsed.phone;
  if (parsed.email) action.email = parsed.email;
  if (parsed.address) action.address = parsed.address;
  if (parsed.city) action.city = parsed.city;
  if (parsed.state) action.state = parsed.state;
  if (parsed.zip) action.zip = parsed.zip;
  if (parsed.notes) action.notes = parsed.notes;
  const hasMeaningful =
    action.customerName ||
    action.phone ||
    action.address ||
    (action.city && action.state) ||
    action.city ||
    action.state ||
    action.email ||
    action.notes;
  if (!hasMeaningful) return null;
  return action;
}

function inferTradeSuggestionsFromEstimateItems(items = []) {
  const trades = new Set();
  items.forEach((item) => {
    const lower = String(item?.name || '').toLowerCase();
    if (lower.includes('tile')) trades.add('Tile');
    if (lower.includes('frame') || lower.includes('lumber')) trades.add('Framing');
    if (lower.includes('drywall')) trades.add('Drywall');
    if (lower.includes('paint')) trades.add('Painting');
    if (lower.includes('electric')) trades.add('Electrical');
    if (lower.includes('plumb')) trades.add('Plumbing');
  });
  return Array.from(trades);
}

function buildEstimateMutationFollowUps({ projectType, hasMaterials, hasLabor, tradeSuggestions = [] }) {
  const followUps = [];
  if (hasMaterials && !hasLabor) {
    followUps.push({ label: 'Add Labor Costs', prompt: 'Add labor costs to this estimate.' });
    followUps.push({
      label: 'Build Starter Labor',
      prompt: tradeSuggestions.length
        ? `Build starter labor for ${tradeSuggestions.join(', ')} on this estimate.`
        : 'Build starter labor for this estimate.',
    });
  }
  followUps.push({ label: 'Review Markup', prompt: 'Review markup against these estimate costs.' });
  if (String(projectType || '').toLowerCase() === 'kitchen') {
    followUps.push({ label: 'Missing Kitchen Items', prompt: 'What common kitchen cost items are still missing from this estimate?' });
  }
  followUps.push({ label: 'Current Cost', prompt: 'What is my current cost so far in this estimate?' });
  return followUps.slice(0, 4);
}

function buildEstimateWorkflowSnapshot(parsedContext) {
  if (!isEstimateAssistantScreen(parsedContext)) return '';

  const checklist = Array.isArray(parsedContext?.estimateChecklist) ? parsedContext.estimateChecklist : [];
  const missingItems = Array.isArray(parsedContext?.missingEstimateItems) ? parsedContext.missingEstimateItems : [];
  const currentStepNumber = Number(parsedContext?.currentStepNumber ?? 0);
  const currentStepLabel = parsedContext?.currentStepLabel || (currentStepNumber === 0 ? 'Bid Summary' : `Step ${currentStepNumber}`);
  const currentStepSubtitle = parsedContext?.currentStepSubtitle || '';
  const currentStepFields = Array.isArray(parsedContext?.currentStepFields) ? parsedContext.currentStepFields : [];
  const setupProgressPct = Number(parsedContext?.setupProgressPct ?? 0);
  const completedChecklistCount = Number(parsedContext?.completedChecklistCount ?? 0);
  const checklistTotal = Number(parsedContext?.checklistTotal ?? checklist.length ?? 0);
  const nextStepLabel = parsedContext?.nextStepLabel || null;
  const readinessState = parsedContext?.readinessState || 'partial';
  const isEstimateReady = parsedContext?.isEstimateReady === true;
  const calcTotals = parsedContext?.calcTotals || null;

  const checklistLines = checklist.length
    ? checklist.map((item, index) => `${index + 1}. ${item?.completed ? 'DONE' : 'TODO'} — ${item?.label || item?.id || 'Checklist item'}`).join('\n')
    : 'No checklist data provided.';
  const missingLine = missingItems.length ? missingItems.join(', ') : 'None';
  const fieldLine = currentStepFields.length ? currentStepFields.join(', ') : 'None provided';

  return `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧾 ESTIMATE WORKFLOW SNAPSHOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current step: ${currentStepLabel}${currentStepSubtitle ? ` — ${currentStepSubtitle}` : ''}
Step number: ${currentStepNumber}
Bid summary screen: ${currentStepNumber === 0 ? 'Yes' : 'No'}
Current step fields: ${fieldLine}
Readiness: ${readinessState}${isEstimateReady ? ' (ready)' : ''}
Setup progress: ${setupProgressPct}% (${completedChecklistCount}/${checklistTotal})
Next recommended setup action: ${nextStepLabel || 'Not provided'}
Estimate name empty: ${parsedContext?.estimateNameIsEmpty ? 'Yes' : 'No'}
Missing estimate items: ${missingLine}
Markup low flag: ${parsedContext?.markupLow ? 'Yes' : 'No'}
Should gate advanced analysis: ${parsedContext?.shouldGateAdvanced ? 'Yes' : 'No'}
${calcTotals ? `Precomputed totals: materials $${Math.round(Number(calcTotals.materials || 0)).toLocaleString()}, labor $${Math.round(Number(calcTotals.labor || 0)).toLocaleString()}, overhead $${Math.round(Number(calcTotals.overhead || 0)).toLocaleString()}, subtotal $${Math.round(Number(calcTotals.subtotal || 0)).toLocaleString()}, profit $${Math.round(Number(calcTotals.profit || 0)).toLocaleString()}, total $${Math.round(Number(calcTotals.total || 0)).toLocaleString()}, margin ${Math.round(Number(calcTotals.marginPercent || 0) * 10) / 10}%` : ''}

Checklist:
${checklistLines}

RULES:
→ Use this snapshot as the source of truth for which estimate step the user is on.
→ Answer the active step first unless the user explicitly asks about another step.
→ If checklist items are missing, prioritize the most important 1-2 missing items in your answer.
→ If the estimate is not ready, guide the user to the next setup action instead of acting like the bid is final.
→ When totals are needed, prefer the Precomputed totals above over re-deriving from line items.`;
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
// Includes all active projects (no hardcoded name filter).
// ─────────────────────────────────────────────────────────────────────────────

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
    return buildPortfolioComparisonReply(data);
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

  const filtered = allProjects.filter((p) => {
    const t = String(p?.title || p?.name || '').trim();
    return t.length > 0;
  });

  const seen = new Set();
  const deduped = filtered.filter((p) => {
    const id = String(p?.id ?? '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
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

  const sorted = [...analyzed].sort((a, b) =>
    (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
  );

  return buildPortfolioComparisonReply(sorted);
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
    { label: 'Upcoming Deadlines', prompt: 'What payments or deadlines are coming up?' },
  ];

  const isActive = (s) => ['won', 'active', 'in_progress', 'in-progress'].includes((s || '').toLowerCase());
  const isCompleted = (s) => (s || '').toLowerCase() === 'completed';
  const getStatus = (p) => (p?.status ?? p?.projectData?.status ?? '').toString().toLowerCase().replace(/\s+/g, '_');
  const activeProjects = allProjects.filter((p) => isActive(getStatus(p))).map((p) => p?.title || p?.name || '').filter(Boolean);
  const completedProjects = allProjects.filter((p) => isCompleted(getStatus(p))).map((p) => p?.title || p?.name || '').filter(Boolean);

  const suggestedFollowUps = [];
  const names = [...projectNames].slice(0, 2);
  names.forEach((name) => {
    suggestedFollowUps.push({ label: `Review ${name}`, prompt: `Give me a full health check on ${name} — budget, margin, risks, and what I should do next` });
  });
  if (activeProjects.length >= 2) {
    const a = activeProjects[0];
    const b = activeProjects[1];
    suggestedFollowUps.push({ label: `Compare ${a} vs ${b}`, prompt: `Compare ${a} and ${b} — which active project is performing better and why?` });
  }
  if (completedProjects.length >= 2 && activeProjects.length < 2) {
    const a = completedProjects[0];
    const b = completedProjects[1];
    suggestedFollowUps.push({ label: `Compare ${a} vs ${b}`, prompt: `Compare ${a} and ${b} — which completed project was more profitable and why?` });
  }
  suggestedFollowUps.push({ label: 'Where am I losing money?', prompt: 'Where am I losing money across my active projects? Show me the biggest profit leaks.' });
  suggestedFollowUps.push({ label: 'Show projects over budget', prompt: 'Which active projects are over budget and by how much?' });

  const seenPrompts = new Set();
  const dedupedSuggested = suggestedFollowUps.filter((s) => {
    const key = (s.prompt || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenPrompts.has(key)) return false;
    seenPrompts.add(key);
    return true;
  });

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
    suggestedFollowUps: dedupedSuggested.slice(0, 5),
    biggestRisk,
  };
}

/** Normalize weekly payment items to have title/name for display (e.g. "Week 1 Payment"). */
function normalizeWeeklyPaymentsForDisplay(weeklyPayments = [], scheduleType = 'weekly') {
  if (!Array.isArray(weeklyPayments) || weeklyPayments.length === 0) return [];
  return weeklyPayments.map((w, i) => {
    const existingName = String(w?.title || w?.name || w?.description || '').trim();
    const name = existingName && /week\s*\d+|payment\s*\d+/i.test(existingName)
      ? existingName
      : `Week ${i + 1} Payment`;
    return {
      ...w,
      id: w?.id || `week-${i + 1}`,
      title: name,
      name,
      amount: Number(w?.amount ?? w?.paymentAmount ?? 0),
      status: w?.status || 'pending',
      progressPct: Number(w?.progressPct ?? w?.progress ?? 0),
    };
  });
}

function getAllMilestonesFromContext(parsedContext = {}) {
  const bidData = parsedContext?.bidData || {};
  const estimateData = parsedContext?.estimateData || parsedContext?.currentProject?.estimateData || {};
  let scheduleType =
    parsedContext?.paymentSchedule ||
    bidData?.paymentSchedule ||
    estimateData?.paymentSchedule ||
    parsedContext?.currentProject?.paymentSchedule ||
    null;
  // Infer weekly when we have weeklyPayments with week-like items but no explicit schedule
  if (!scheduleType) {
    const weekly = estimateData?.weeklyPayments || bidData?.weeklyPayments || parsedContext?.weeklyPayments || [];
    const hasWeekLike = Array.isArray(weekly) && weekly.some(w =>
      /week\s*\d+|payment\s*\d+/i.test(String(w?.title || w?.name || w?.description || '')) || (w?.weekNumber != null)
    );
    scheduleType = hasWeekLike ? 'weekly' : 'milestone-based';
  }
  scheduleType = scheduleType || 'milestone-based';

  // Weekly payments: prefer estimateData (saved projects) or bidData (estimate phase), normalize to "Week N Payment"
  const weeklySource = Array.isArray(estimateData?.weeklyPayments) && estimateData.weeklyPayments.length > 0
    ? estimateData.weeklyPayments
    : Array.isArray(bidData?.weeklyPayments) && bidData.weeklyPayments.length > 0
      ? bidData.weeklyPayments
      : [];
  const fromWeekly = scheduleType === 'weekly' && weeklySource.length > 0
    ? normalizeWeeklyPaymentsForDisplay(weeklySource, scheduleType)
    : [];

  // Milestone-based: use paymentMilestones from estimateData or bidData when schedule is milestone-based
  const milestoneSource = Array.isArray(estimateData?.paymentMilestones) && estimateData.paymentMilestones.length > 0
    ? estimateData.paymentMilestones
    : Array.isArray(bidData?.paymentMilestones) && bidData.paymentMilestones.length > 0
      ? bidData.paymentMilestones
      : [];
  const fromMilestones = (scheduleType === 'milestone-based' || scheduleType === 'hybrid') && milestoneSource.length > 0
    ? milestoneSource.map((m, i) => ({
        ...m,
        title: m?.title || m?.name || `Milestone ${i + 1}`,
        name: m?.name || m?.title || `Milestone ${i + 1}`,
      }))
    : [];

  return [
    ...(parsedContext?.milestones || []),
    ...(parsedContext?.weeklyPayments || []),
    ...(parsedContext?.paymentMilestones || []),
    ...(parsedContext?.timelineItems || []),
    ...(parsedContext?.currentProject?.milestones || []),
    ...(parsedContext?.currentProject?.weeklyPayments || []),
    ...(parsedContext?.currentProject?.paymentMilestones || []),
    ...(parsedContext?.currentProject?.timelineItems || []),
    ...fromWeekly,
    ...fromMilestones,
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
  let match = pendingPayments.find((m) => String(m?.title || m?.name || m?.description || '').toLowerCase() === searchName);
  if (match) return match;

  // "week 1" / "week 1 payment" → match "Week 1 Payment" or "Weekly Payment 1"
  const weekNumMatch = searchName.match(/\bweek\s*(\d+)(?:\s*payment)?\b|(?:weekly\s+)?payment\s*(\d+)/i);
  if (weekNumMatch) {
    const num = weekNumMatch[1] || weekNumMatch[2];
    match = pendingPayments.find((m) => {
      const t = String(m?.title || m?.name || m?.description || '').toLowerCase();
      return (t.includes(`week ${num}`) || t.includes(`week${num}`) || t.includes(`weekly payment ${num}`) || t.includes(`payment ${num}`));
    });
    if (match) return match;
  }

  // Partial contains
  match = pendingPayments.find((m) => {
    const t = String(m?.title || m?.name || m?.description || '').toLowerCase();
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
    const normalizedTitle = normalize(m?.title || m?.name || m?.description || '');
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

function getEstimateAssistantBrief(parsedContext) {
  if (!parsedContext || typeof parsedContext !== 'object') return {};
  return parsedContext.estimateAssistantBrief && typeof parsedContext.estimateAssistantBrief === 'object'
    ? parsedContext.estimateAssistantBrief
    : {};
}

function buildEstimateSuggestedFollowUpsFromBrief(parsedContext, fallback = []) {
  const brief = getEstimateAssistantBrief(parsedContext);
  if (Array.isArray(brief?.chips) && brief.chips.length > 0) {
    return brief.chips
      .filter((chip) => chip?.label && chip?.prompt)
      .slice(0, 5)
      .map((chip) => ({ label: String(chip.label), prompt: String(chip.prompt) }));
  }
  return fallback.slice(0, 5);
}

function buildEstimateStartBidReply({ parsedContext, estimateData }) {
  const hasName = !!(estimateData?.customerName || estimateData?.clientName);
  const hasPhone = !!String(estimateData?.customerPhone || '').trim();
  const hasAddress =
    !!String(estimateData?.customerAddress || '').trim() ||
    (!!String(estimateData?.customerCity || '').trim() && !!String(estimateData?.customerState || '').trim());

  const lines = [
    `**Step 1 — Customer information**`,
    '',
    'To start this bid, I only need:',
    '- **Client name**',
    '- **Phone number**',
    '- **Address** (street + city/state/ZIP, or one line)',
    '',
    '**Optional:** any **notes** that matter for the job.',
    '',
    'Email is **not** required up front — you can add it when you send the proposal.',
  ];
  if (hasName && hasPhone && hasAddress) {
    lines.push('', 'You already have the basics here — next we can move to project details (Step 2) when you are ready.');
  } else {
    const missing = [];
    if (!hasName) missing.push('name');
    if (!hasPhone) missing.push('phone');
    if (!hasAddress) missing.push('address');
    lines.push('', `Still need: **${missing.join(', ')}**.`);
  }

  return {
    reply: lines.join('\n'),
    suggestedFollowUps: [
      { label: 'Name + phone + address', prompt: 'Client name is [name], phone [phone], address [address].' },
      { label: 'Add notes', prompt: 'Notes for this client/job: [notes].' },
      { label: 'Skip email for now', prompt: 'I do not have their email yet — keep going with name, phone, and address only.' },
    ],
  };
}

function buildEstimateCopilotReply({ parsedContext, estimateData, projectName }) {
  const brief = getEstimateAssistantBrief(parsedContext);
  const healthScore = Number(parsedContext?.healthScore ?? 0);
  const currentStepLabel = parsedContext?.currentStepLabel || 'Estimate';
  const name = projectName || parsedContext?.bidTitle || parsedContext?.estimateName || 'this estimate';
  const replyParts = [];
  replyParts.push(`You are in **${currentStepLabel}** for **${name}**.`);
  if (brief?.summary) {
    replyParts.push(brief.summary);
  }
  if (brief?.bestNextAction?.reason) {
    replyParts.push(`Why it matters: ${brief.bestNextAction.reason}`);
  }
  if (Array.isArray(brief?.risks) && brief.risks.length > 0) {
    replyParts.push(`Biggest risk right now: ${brief.risks[0]}.`);
  }
  if (brief?.assumptions) {
    replyParts.push(`Assumption check: ${brief.assumptions}`);
  }
  if (healthScore > 0) {
    replyParts.push(`Health score: ${healthScore}/100.`);
  }
  if (brief?.bestNextAction?.label) {
    replyParts.push(`Best next action: ${brief.bestNextAction.label}.`);
  }
  return {
    reply: replyParts.join('\n\n'),
    suggestedFollowUps: buildEstimateSuggestedFollowUpsFromBrief(parsedContext, [
      { label: 'Review This Bid', prompt: 'Review this bid before I send it.' },
      { label: 'What’s Missing', prompt: 'What is missing from this estimate right now?' },
    ]),
  };
}

function buildEstimateClientReadyReview({ parsedContext, estimateData, projectName }) {
  const calcTotals = parsedContext?.calcTotals || {};
  const title = projectName || estimateData?.title || parsedContext?.bidTitle || 'this estimate';
  const issues = [];
  const strengths = [];
  if (!estimateData?.customerName) issues.push('Customer name is missing.');
  const hasAddrReady =
    !!String(estimateData?.customerAddress || '').trim() ||
    (!!String(estimateData?.customerCity || '').trim() && !!String(estimateData?.customerState || '').trim());
  if (!hasAddrReady) issues.push('Customer address is missing, which weakens contract clarity.');
  if (!estimateData?.title) issues.push('Estimate title is missing.');
  if (!(estimateData?.scopeDescription || estimateData?.projectDescription)) issues.push('Scope wording is too thin for a polished client-facing bid.');
  if (!parsedContext?.hasPaymentSchedule) issues.push('Payment schedule is incomplete.');
  if (!calcTotals?.total) issues.push('Total price is not grounded yet.');

  if (estimateData?.customerName) strengths.push('Customer identity is filled in.');
  if (estimateData?.title) strengths.push('Estimate has a named bid.');
  if (estimateData?.scopeDescription || estimateData?.projectDescription) strengths.push('There is scope language to refine.');
  if (parsedContext?.hasPaymentSchedule) strengths.push('Payment structure is present.');

  let reply = `CLIENT-FACING REVIEW\n${issues.length === 0 ? 'Close to client-ready' : 'Needs polish before send'}\n\n`;
  reply += `What a client will feel:\n`;
  reply += issues.length === 0
    ? `- This estimate reads like it is nearly ready to send.\n`
    : `- Right now the bid may feel incomplete or less professional because key contract-facing details are still missing.\n`;
  reply += `\nTop wording / presentation fixes:\n`;
  (issues.length > 0 ? issues : ['Tighten scope language and confirm exclusions before sending.']).slice(0, 4).forEach((line, index) => {
    reply += `${index + 1}. ${line}\n`;
  });
  reply += `\nGood as-is:\n`;
  (strengths.length > 0 ? strengths : ['The structure is usable, but it needs more client-facing polish.']).slice(0, 3).forEach((line, index) => {
    reply += `${index + 1}. ${line}\n`;
  });
  reply += `\nNext best action:\n1. Tighten the scope wording.\n2. Confirm payment language.\n3. Run one final send-readiness review.\n`;
  return {
    reply,
    suggestedFollowUps: [
      { label: 'Proposal Wording', prompt: 'Improve the proposal wording for this estimate.' },
      { label: 'Check Exclusions', prompt: 'What exclusions or allowance notes should I add before sending?' },
      { label: 'Run Final Review', prompt: 'Review this bid before I send it.' },
    ],
  };
}

function buildEstimateProposalWordingReply({ estimateData, projectName }) {
  const bidName = projectName || estimateData?.title || 'this project';
  const customerName = estimateData?.customerName || 'the client';
  const rawScope = String(estimateData?.scopeDescription || estimateData?.projectDescription || '').trim();
  const scopeSummary = rawScope
    ? rawScope
        .split('\n')
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 4)
        .join('; ')
    : 'complete the work shown in the estimate scope and line items';
  const wording = `Proposal summary for ${customerName}: This estimate covers ${scopeSummary} for ${bidName}. Pricing is based on the current selections, scope assumptions, and payment terms shown below. Any owner-requested scope additions, concealed conditions, or upgraded finish selections would be handled as a written change order before extra work begins.`;
  const reply = [
    'PROPOSAL WORDING',
    wording,
    '',
    'What this does well:',
    '1. Reads contractor-native and professional.',
    '2. Sets expectations without sounding overly legal.',
    '3. Leaves room for written change orders if scope expands.',
    '',
    'Best next action:',
    '1. Pair this with clear exclusions and allowance notes before sending.',
  ].join('\n');
  return {
    reply,
    suggestedFollowUps: [
      { label: 'Check Exclusions', prompt: 'What exclusions or allowance notes should I add before sending?' },
      { label: 'Client Ready Review', prompt: 'Give this estimate a client-facing wording and send-readiness review.' },
      { label: 'Run Final Review', prompt: 'Review this bid before I send it.' },
    ],
  };
}

function buildEstimateExclusionsReply({ estimateData }) {
  const projectType = String(estimateData?.projectType || 'project').replace(/_/g, ' ');
  const reply = [
    'EXCLUSIONS / ALLOWANCE NOTES',
    `For this ${projectType} estimate, I would usually call out these client-facing notes before send:`,
    '1. Pricing is based on the current scope and visible site conditions.',
    '2. Owner selections, finish upgrades, and specialty items above listed allowances are excluded unless noted.',
    '3. Concealed damage, code-required upgrades, and unforeseen site conditions are excluded until verified.',
    '4. Permit, engineering, and utility fees should be stated clearly if they are excluded or carried as allowances.',
    '5. Any work outside the written scope should require an approved change order.',
    '',
    'Best next action:',
    '1. Add only the exclusions that truly fit this job so the estimate stays clean and credible.',
  ].join('\n');
  return {
    reply,
    suggestedFollowUps: [
      { label: 'Proposal Wording', prompt: 'Improve the proposal wording for this estimate.' },
      { label: 'Client Ready Review', prompt: 'Give this estimate a client-facing wording and send-readiness review.' },
      { label: 'Run Final Review', prompt: 'Review this bid before I send it.' },
    ],
  };
}

function buildEstimateActionResponse({ message, parsedContext, estimateData, bidTotal, projectName, session }) {
  const msg = String(message || '').trim();
  const lower = msg.toLowerCase();
  const brief = getEstimateAssistantBrief(parsedContext);
  const projectType = parsedContext?.estimateData?.projectType || parsedContext?.bidData?.projectType || estimateData?.projectType || 'other';
  const total = Number(parsedContext?.calcTotals?.total ?? bidTotal ?? estimateData?.totalBid ?? 0);
  const startDate = estimateData?.startDate || estimateData?.projectStartDate || null;
  const defaultTier = session?.estimatePreferences?.pricingTier || 'standard';
  const followUps = buildEstimateSuggestedFollowUpsFromBrief(parsedContext, []);
  const parsedCostItems = extractEstimateCostItems(msg);
  const customerParsed = parseEstimateStep1CustomerInfo(msg);
  const customerUpdateAction = buildUpdateCustomerInfoAction(customerParsed);
  const explicitClientPhrase = /\b(?:client|customer)\s+(?:is|=)\s+/i.test(msg);
  const customerInfoIntent =
    customerUpdateAction &&
    (looksLikeCustomerInfoSubmission(msg) || explicitClientPhrase);
  const markupMatch = lower.match(/\b(?:set|change|update|make)\s+(?:the\s+)?markup(?:\s+to)?\s+(\d{1,2}(?:\.\d+)?)%/i);
  const hasDirectMutationInput =
    messageLooksLikeEstimateMutation(msg, parsedCostItems) ||
    !!customerInfoIntent ||
    !!markupMatch;

  if (hasDirectMutationInput && (parsedCostItems.length > 0 || customerUpdateAction || markupMatch)) {
    const actions = [];
    const replyLines = [];
    const materialItems = parsedCostItems.filter((item) => item.kind !== 'labor');
    const laborItems = parsedCostItems.filter((item) => item.kind === 'labor');
    const addedMaterialTotal = materialItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const addedLaborTotal = laborItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const currentMaterialTotal = Number(parsedContext?.calcTotals?.materials ?? estimateData?.materialTotal ?? estimateData?.materials ?? 0);
    const currentLaborTotal = Number(parsedContext?.calcTotals?.labor ?? estimateData?.laborTotal ?? estimateData?.labor ?? 0);
    const tradeSuggestions = inferTradeSuggestionsFromEstimateItems(parsedCostItems);

    if (customerUpdateAction && customerInfoIntent) {
      actions.push(customerUpdateAction);
      trackEstimateSessionEvent(session, 'update_customer_info', {
        customerName: customerUpdateAction.customerName,
        city: customerUpdateAction.city,
        state: customerUpdateAction.state,
      });
      replyLines.push('**Step 1 — review before saving**');
      replyLines.push('');
      if (customerUpdateAction.customerName) replyLines.push(`- **Name:** ${customerUpdateAction.customerName}`);
      if (customerUpdateAction.phone) replyLines.push(`- **Phone:** ${customerUpdateAction.phone}`);
      if (customerUpdateAction.email) replyLines.push(`- **Email:** ${customerUpdateAction.email}`);
      const addrLine = formatEstimateCustomerAddressDisplay(customerUpdateAction);
      if (addrLine) replyLines.push(`- **Address:** ${addrLine}`);
      if (customerUpdateAction.notes) replyLines.push(`- **Notes:** ${customerUpdateAction.notes}`);
      replyLines.push('');
      replyLines.push('Tap **Confirm** in the dialog to save this to Step 1 (Customer information), or **Cancel** to edit.');
    }

    if (parsedCostItems.length > 0) {
      actions.push({
        type: 'add_estimate_line_items',
        items: parsedCostItems.map((item) => ({
          name: item.name,
          amount: item.amount,
          quantity: item.quantity,
          unitCost: item.unitCost,
          category: item.category,
          kind: item.kind,
        })),
        projectName: projectName || estimateData?.title || 'this bid',
        summary: {
          addedMaterialTotal,
          addedLaborTotal,
          nextMaterialSubtotal: currentMaterialTotal + addedMaterialTotal,
          nextLaborSubtotal: currentLaborTotal + addedLaborTotal,
        },
      });
      trackEstimateSessionEvent(session, 'add_estimate_line_items', {
        count: parsedCostItems.length,
        materials: materialItems.length,
        labor: laborItems.length,
      });
      replyLines.push(`I found ${parsedCostItems.length} estimate item${parsedCostItems.length === 1 ? '' : 's'} to add:`);
      parsedCostItems.forEach((item) => {
        replyLines.push(`- ${item.name}: $${Math.round(Number(item.amount || 0)).toLocaleString()}`);
      });
      replyLines.push('');
      if (materialItems.length > 0) {
        replyLines.push(`Material subtotal would become $${Math.round(currentMaterialTotal + addedMaterialTotal).toLocaleString()}.`);
      }
      if (laborItems.length > 0) {
        replyLines.push(`Labor subtotal would become $${Math.round(currentLaborTotal + addedLaborTotal).toLocaleString()}.`);
      }
      if (materialItems.length > 0 && currentLaborTotal + addedLaborTotal <= 0) {
        replyLines.push('Labor is still missing, so your current margin will still be incomplete after this update.');
      }
      if (materialItems.length > 0 && tradeSuggestions.length > 0) {
        replyLines.push(`Next best step is labor for ${tradeSuggestions.join(', ')} so this bid becomes more realistic.`);
      }
    }

    if (markupMatch) {
      const markupPct = Number(markupMatch[1]);
      actions.push({ type: 'set_markup_percentage', markupPct });
      trackEstimateSessionEvent(session, 'set_markup_percentage', { markupPct });
      replyLines.push(`I can also set markup to **${markupPct}%**.`);
    }

    const onlyCustomerStep =
      customerUpdateAction &&
      customerInfoIntent &&
      parsedCostItems.length === 0 &&
      !markupMatch;

    return {
      reply: replyLines.filter(Boolean).join('\n'),
      actions,
      suggestedFollowUps: onlyCustomerStep
        ? [
            { label: 'Add email', prompt: 'Add customer email: [email]' },
            { label: 'What’s Step 2?', prompt: 'What do I fill in for Step 2 after customer information?' },
            { label: 'Fix a field', prompt: 'I need to correct one customer field before saving.' },
          ]
        : buildEstimateMutationFollowUps({
            projectType,
            hasMaterials: materialItems.length > 0,
            hasLabor: laborItems.length > 0 || currentLaborTotal > 0,
            tradeSuggestions,
          }),
    };
  }

  const renameMatch = msg.match(/\brename(?:\s+this)?\s+(?:bid|estimate)(?:\s+to)?\s+["“]?([^"\n”]+)["”]?$/i);
  if (renameMatch) {
    const nextTitle = String(renameMatch[1] || '').trim();
    if (nextTitle) {
      trackEstimateSessionEvent(session, 'rename_estimate', { title: nextTitle });
      return {
        reply: `I can rename this bid to **${nextTitle}**.`,
        actions: [{ type: 'rename_estimate', title: nextTitle }],
        suggestedFollowUps: followUps,
      };
    }
  }

  if (markupMatch) {
    const markupPct = Number(markupMatch[1]);
    trackEstimateSessionEvent(session, 'set_markup_percentage', { markupPct });
    return {
      reply: `I can set markup to **${markupPct}%**. This is a safe direct edit.`,
      actions: [{ type: 'set_markup_percentage', markupPct }],
      suggestedFollowUps: followUps,
    };
  }

  const saferPricingIntent = /\bmake this safer|improve protection|raise margin|raise markup|protect profit\b/i.test(lower);
  if (saferPricingIntent) {
    const reply = [
      'This sounds like a protection move, not a blind auto-edit.',
      'Best safety levers are: improve payment timing, add missing cost coverage, and increase markup only if the scope is already grounded.',
      `Best next action: ${brief?.bestNextAction?.label || 'run a full bid review'}.`,
    ].join('\n\n');
    trackEstimateSessionEvent(session, 'suggest_protection_moves', { lower });
    return {
      reply,
      actions: [],
      suggestedFollowUps: buildEstimateSuggestedFollowUpsFromBrief(parsedContext, [
        { label: 'Review This Bid', prompt: 'Review this bid before I send it.' },
        { label: 'Safer Schedule', prompt: 'Build a safer payment schedule for this estimate.' },
        { label: 'Review Markup', prompt: 'Review my markup and margin for this estimate.' },
      ]),
    };
  }

  const variantMatch =
    lower.match(/\b(?:build|create|make|apply|show)\s+(?:a\s+)?(budget|standard|premium)\s+(?:version|variant)\b/i) ||
    lower.match(/\b(?:budget|standard|premium)\s+(?:version|variant)\b/i);
  if (variantMatch) {
    const variantType = String(variantMatch[1] || '').toLowerCase();
    trackEstimateSessionEvent(session, 'create_estimate_variant', { variantType });
    return {
      reply: `I can apply a **${variantType}** version to this estimate so you can compare price position quickly.`,
      actions: [{ type: 'create_estimate_variant', variantType }],
      suggestedFollowUps: followUps,
    };
  }

  if (/\b(safer cash flow|safer schedule|protect cash flow)\b/i.test(lower)) {
    trackEstimateSessionEvent(session, 'create_estimate_variant', { variantType: 'safer_cashflow' });
    return {
      reply: 'I can apply a **safer cash-flow version** with earlier contractor protection in the payment schedule.',
      actions: [{ type: 'create_estimate_variant', variantType: 'safer_cashflow' }],
      suggestedFollowUps: followUps,
    };
  }

  const commonItemsIntent = /\b(add|build|create|generate)\b.*\b(common|starter)\b.*\b(line items|scope|materials?|labor|breakdown|package)\b/i.test(lower);
  const tier = /\bpremium\b/i.test(lower) ? 'premium' : /\bbudget\b/i.test(lower) ? 'budget' : defaultTier;
  if (commonItemsIntent || /\bcommon kitchen line items\b/i.test(lower)) {
    const addMaterials = /\bmaterials?\b/i.test(lower);
    const addLabor = /\blabor|crew|subs?\b/i.test(lower);
    const scopePackageOnly = !addMaterials && !addLabor;
    const actionType = scopePackageOnly ? 'add_common_scope_package' : addMaterials && !addLabor ? 'add_starter_materials' : addLabor && !addMaterials ? 'add_starter_labor' : 'add_common_scope_package';
    trackEstimateSessionEvent(session, actionType, { projectType, tier });
    return {
      reply: actionType === 'add_common_scope_package'
        ? `I prepared a **${tier}** starter scope package for this **${projectType.replace(/_/g, ' ')}** estimate. It uses editable placeholders instead of guessing live pricing.`
        : actionType === 'add_starter_materials'
          ? `I prepared editable starter materials for this **${projectType.replace(/_/g, ' ')}** estimate.`
          : `I prepared editable starter labor placeholders for this **${projectType.replace(/_/g, ' ')}** estimate.`,
      actions: [{ type: actionType, projectType, tier }],
      suggestedFollowUps: followUps,
    };
  }

  const weeklyScheduleIntent = /\b(build|create|generate|make)\b.*\bweekly\b.*\b(payment|schedule)\b/i.test(lower);
  if (weeklyScheduleIntent) {
    const weeksMatch = lower.match(/(\d{1,2})\s+weeks?/i);
    const weeks = Number(weeksMatch?.[1] || estimateData?.durationWeeks || 4);
    if (!weeksMatch && !estimateData?.durationWeeks) {
      return {
        reply: 'I can build a weekly payment schedule. How many weeks should I assume?',
        actions: [],
        suggestedFollowUps: [
          { label: '4 weeks', prompt: 'Build a weekly payment schedule for 4 weeks.' },
          { label: '6 weeks', prompt: 'Build a weekly payment schedule for 6 weeks.' },
          { label: '8 weeks', prompt: 'Build a weekly payment schedule for 8 weeks.' },
        ],
      };
    }
    const weeklyPayments = [];
    const depositPct = /safer|protect|cash flow/i.test(lower) ? 25 : 20;
    const recurringPct = (100 - depositPct) / Math.max(weeks, 1);
    weeklyPayments.push({
      id: `ai-weekly-deposit-${Date.now()}`,
      name: 'Deposit / startup',
      description: 'Deposit / startup',
      percentage: Math.round(depositPct * 100) / 100,
      amount: Math.round(total * (depositPct / 100) * 100) / 100,
      weekNumber: 0,
      scheduledDate: startDate || new Date().toISOString().split('T')[0],
      dueDate: startDate || new Date().toISOString().split('T')[0],
    });
    for (let idx = 1; idx <= Math.max(weeks, 1); idx += 1) {
      const scheduledDate = new Date((startDate || new Date().toISOString().split('T')[0]) + 'T00:00:00');
      scheduledDate.setDate(scheduledDate.getDate() + idx * 7);
      const day = scheduledDate.toISOString().split('T')[0];
      weeklyPayments.push({
        id: `ai-weekly-${Date.now()}-${idx}`,
        name: `Week ${idx} progress payment`,
        description: `Week ${idx} progress payment`,
        percentage: Math.round(recurringPct * 100) / 100,
        amount: Math.round(total * (recurringPct / 100) * 100) / 100,
        weekNumber: idx,
        scheduledDate: day,
        dueDate: day,
      });
    }
    trackEstimateSessionEvent(session, 'replace_payment_schedule', { paymentSchedule: 'weekly', weeks });
    return {
      reply: `I prepared a **weekly payment schedule** over **${weeks} weeks**${total > 0 ? ` using the current bid total of $${Math.round(total).toLocaleString()}` : ''}.`,
      actions: [{ type: 'replace_payment_schedule', paymentSchedule: 'weekly', weeklyPayments, safer: /safer|protect|cash flow/i.test(lower) }],
      suggestedFollowUps: followUps,
    };
  }

  const milestoneScheduleIntent = /\b(build|create|generate|make)\b.*\b(milestone|deposit)\b.*\b(payment|schedule)\b/i.test(lower);
  if (milestoneScheduleIntent || /\bsafer schedule\b/i.test(lower)) {
    const safer = /\bsafer|protect|cash flow\b/i.test(lower);
    const percentages = safer ? [40, 30, 20, 10] : [30, 30, 30, 10];
    const names = safer
      ? ['Deposit / mobilization', 'Midpoint progress', 'Substantial completion', 'Punch list']
      : ['Deposit', 'Rough-in / progress', 'Finish stage', 'Final completion'];
    const paymentMilestones = names.map((name, index) => {
      const base = new Date((startDate || new Date().toISOString().split('T')[0]) + 'T00:00:00');
      base.setDate(base.getDate() + index * 7);
      const scheduledDate = base.toISOString().split('T')[0];
      const percentage = percentages[index];
      const amount = Math.round(total * (percentage / 100) * 100) / 100;
      return {
        id: `ai-milestone-${Date.now()}-${index}`,
        name,
        percentage,
        paymentAmount: amount,
        amount,
        scheduledDate,
        dueDate: scheduledDate,
      };
    });
    trackEstimateSessionEvent(session, 'replace_payment_schedule', { paymentSchedule: 'milestone-based', safer });
    return {
      reply: safer
        ? 'I prepared a **safer milestone schedule** with more money pulled forward to reduce exposure.'
        : 'I prepared a **milestone payment schedule** for this estimate.',
      actions: [{ type: 'replace_payment_schedule', paymentSchedule: 'milestone-based', paymentMilestones, safer }],
      suggestedFollowUps: followUps,
    };
  }

  if (/\b(rebalance|auto-?fix|fix)\b.*\b(payment|schedule|percentages?)\b/i.test(lower) || /\b100%\b/.test(lower)) {
    trackEstimateSessionEvent(session, 'rebalance_payment_schedule');
    return {
      reply: 'I can rebalance the current payment schedule so the percentages and amounts line up cleanly.',
      actions: [{ type: 'rebalance_payment_schedule' }],
      suggestedFollowUps: followUps,
    };
  }

  return null;
}

function runEstimateReview({ projectName, estimateData, bidTotal, parsedContext }) {
  const calcTotals = parsedContext?.calcTotals || {};
  const checklist = Array.isArray(parsedContext?.estimateChecklist) ? parsedContext.estimateChecklist : [];
  const setupProgressPct = Number(parsedContext?.setupProgressPct ?? 0);
  const currentStepLabel = parsedContext?.currentStepLabel || 'Estimate';
  const nextStepLabel = parsedContext?.nextStepLabel || 'Continue building the estimate';
  const readinessState = parsedContext?.readinessState || 'partial';
  const brief = getEstimateAssistantBrief(parsedContext);
  const estimateNameEmpty = parsedContext?.estimateNameIsEmpty === true;
  const markupPct = Number(estimateData?.markupPct ?? estimateData?.markup ?? 0);
  const marginPct = Number(calcTotals?.marginPercent ?? estimateData?.marginPercent ?? estimateData?.marginPct ?? estimateData?.margin ?? 0);
  const total = Number(calcTotals?.total ?? bidTotal ?? estimateData?.totalBid ?? 0);
  const subtotal = Number(calcTotals?.subtotal ?? estimateData?.subtotal ?? estimateData?.totalCost ?? estimateData?.baseCost ?? 0);
  const materialTotal = Number(calcTotals?.materials ?? estimateData?.materialTotal ?? 0);
  const laborTotal = Number(calcTotals?.labor ?? estimateData?.laborTotal ?? 0);
  const overheadTotal = Number(calcTotals?.overhead ?? estimateData?.overheadTotal ?? 0);
  const healthScore = Number(parsedContext?.healthScore ?? 0);
  const startDate = estimateData?.startDate || estimateData?.projectStartDate || null;
  const endDate = estimateData?.endDate || estimateData?.projectEndDate || null;
  const customerMissing = [];
  if (!estimateData?.customerName) customerMissing.push('customer name');
  if (!String(estimateData?.customerPhone || '').trim()) customerMissing.push('phone number');
  const hasAddress =
    !!String(estimateData?.customerAddress || '').trim() ||
    (!!String(estimateData?.customerCity || '').trim() && !!String(estimateData?.customerState || '').trim());
  if (!hasAddress) customerMissing.push('address (street + city/state, or one line)');
  const projectMissing = [];
  if (!estimateData?.title) projectMissing.push('estimate title');
  if (!(estimateData?.scopeDescription || estimateData?.projectDescription)) projectMissing.push('scope description');
  if (!startDate) projectMissing.push('start date');
  if (!endDate) projectMissing.push('end date');
  const paymentSchedule = estimateData?.paymentSchedule || parsedContext?.paymentSchedule || null;
  const paymentMissing = [];
  if (!paymentSchedule) paymentMissing.push('payment schedule type');
  if (!parsedContext?.hasPaymentSchedule && paymentSchedule) paymentMissing.push('payment amounts / milestones');

  const incompleteChecklist = checklist
    .filter((item) => !item?.completed)
    .map((item) => String(item?.label || item?.id || 'Checklist item'));
  const issues = [...incompleteChecklist];
  if (estimateNameEmpty) issues.unshift('Add a bid title');
  if (markupPct > 0 && markupPct < 18) issues.push(`Markup is only ${Math.round(markupPct * 10) / 10}%`);
  if (marginPct > 0 && marginPct < 15) issues.push(`Margin is only ${Math.round(marginPct * 10) / 10}%`);
  if (!materialTotal) issues.push('Materials are still empty');
  if (!laborTotal) issues.push('Labor is still empty');
  if (!overheadTotal) issues.push('Overhead has little or no value');

  const uniqueIssues = Array.from(new Set(issues)).slice(0, 5);
  const titleForReply = estimateNameEmpty ? 'this estimate' : `"${projectName || 'this estimate'}"`;
  const fixSuggestions = [];
  if (customerMissing.length > 0) fixSuggestions.push({ label: 'Add customer info', prompt: 'Help me add the missing customer info for this estimate.' });
  if (projectMissing.length > 0) fixSuggestions.push({ label: 'Fix project info', prompt: 'Help me fill in the missing project information for this estimate.' });
  if (!materialTotal) fixSuggestions.push({ label: 'Add materials', prompt: 'Help me add materials to this estimate.' });
  if (!laborTotal) fixSuggestions.push({ label: 'Add labor', prompt: 'Help me add labor to this estimate.' });
  if (markupPct <= 0 || markupPct < 18 || marginPct < 15) fixSuggestions.push({ label: 'Review markup', prompt: 'Review my markup and margin for this estimate.' });
  if (paymentMissing.length > 0) fixSuggestions.push({ label: 'Set payments', prompt: 'Help me set up the payment schedule for this estimate.' });
  if (uniqueIssues.length === 0 && readinessState === 'ready') fixSuggestions.push({ label: 'Final wording review', prompt: 'Give this estimate a final client-facing wording and pricing review.' });

  let overallStatus = 'Partially built';
  if (readinessState === 'ready' && uniqueIssues.length === 0) overallStatus = 'Ready for client review';
  else if (healthScore > 0 && healthScore < 50) overallStatus = 'High risk';
  else if (uniqueIssues.length <= 2 && readinessState !== 'empty') overallStatus = 'Close, but needs attention';

  const risks = [];
  if (!materialTotal) risks.push('Material coverage is missing, so pricing is still incomplete.');
  if (!laborTotal) risks.push('Labor is missing, so profit is not reliable yet.');
  if (paymentMissing.length > 0) risks.push('Payment timing is incomplete, which can leave cash flow exposed.');
  if (markupPct > 0 && markupPct < 18) risks.push(`Markup is only ${Math.round(markupPct * 10) / 10}%, which may be thin for friction.`);
  if (marginPct > 0 && marginPct < 15) risks.push(`Current margin is only ${Math.round(marginPct * 10) / 10}%, so there is limited cushion.`);

  const goodAsIs = [];
  if (estimateData?.customerName && estimateData?.title) goodAsIs.push('Core estimate identity is in place.');
  if (materialTotal > 0) goodAsIs.push('Materials are populated.');
  if (laborTotal > 0) goodAsIs.push('Labor is populated.');
  if (paymentMissing.length === 0 && parsedContext?.hasPaymentSchedule) goodAsIs.push('Payment structure is present.');
  if (healthScore >= 80) goodAsIs.push(`Health score is strong at ${healthScore}/100.`);

  // Use markdown bold for section labels so the app renders body-sized type (not giant ALL-CAPS section headers).
  let reply = `**Overall status**\n${overallStatus}\n\n`;
  reply += `**Snapshot**\n`;
  reply += `- Current step: ${currentStepLabel}\n`;
  reply += `- Setup progress: ${setupProgressPct}%\n`;
  if (total > 0) reply += `- Bid total: $${Math.round(total).toLocaleString()}\n`;
  if (subtotal > 0) reply += `- Estimated cost: $${Math.round(subtotal).toLocaleString()}\n`;
  if (marginPct > 0) reply += `- Margin: ${Math.round(marginPct * 10) / 10}%\n`;
  if (markupPct > 0) reply += `- Markup: ${Math.round(markupPct * 10) / 10}%\n`;
  if (healthScore > 0) reply += `- Health score: ${healthScore}/100\n`;
  reply += `- Readiness: ${readinessState}\n\n`;

  if (uniqueIssues.length === 0 && readinessState === 'ready') {
    reply += `**Good as-is**\n`;
    reply += `${goodAsIs.length > 0 ? goodAsIs.map((line, index) => `${index + 1}. ${line}`).join('\n') : '1. The estimate is structurally ready for review.'}\n\n`;
    reply += `**Next best fixes**\n1. Do one final wording and pricing pass.\n2. Confirm payment timing matches your risk tolerance.\n\n`;
    reply += `**Optional improvements**\n1. Run a last friction scenario before sending.\n`;
    return { reply, suggestedFollowUps: fixSuggestions.slice(0, 4) };
  }

  reply += `**Missing**\n`;
  uniqueIssues.forEach((issue, index) => {
    reply += `${index + 1}. ${issue}\n`;
  });
  const detailSections = [];
  if (customerMissing.length > 0) detailSections.push(`Customer info missing: ${customerMissing.join(', ')}`);
  if (projectMissing.length > 0) detailSections.push(`Project info missing: ${projectMissing.join(', ')}`);
  if (paymentMissing.length > 0) detailSections.push(`Payment setup missing: ${paymentMissing.join(', ')}`);
  if (detailSections.length > 0) {
    reply += `\n`;
    detailSections.forEach((line, index) => {
      reply += `${index + 1}. ${line}\n`;
    });
  }
  reply += `\n**Risks**\n`;
  (risks.length > 0 ? risks : [brief?.assumptions || 'Entered data is still incomplete, so keep assumptions visible.']).slice(0, 4).forEach((line, index) => {
    reply += `${index + 1}. ${line}\n`;
  });
  reply += `\n**Good as-is**\n`;
  (goodAsIs.length > 0 ? goodAsIs : ['You already have enough context to keep building this bid.']).slice(0, 3).forEach((line, index) => {
    reply += `${index + 1}. ${line}\n`;
  });
  reply += `\n**Next best fixes**\n`;
  fixSuggestions.slice(0, 4).forEach((item, index) => {
    reply += `${index + 1}. ${item.label}\n`;
  });
  reply += `\n**Optional improvements**\n`;
  reply += `1. ${brief?.bestNextAction?.label || nextStepLabel}\n`;
  reply += `2. Run one scenario review before sending if margin protection is thin.\n`;
  return { reply, suggestedFollowUps: fixSuggestions.slice(0, 4) };
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
    // Normalize so "profit margin" and "margin" are answered the same way
    const normalizedMessage = String(message).replace(/\bprofit\s+margin\b/gi, 'margin');

    let parsedContext = {};
    try {
      if (typeof context === 'string') parsedContext = JSON.parse(context);
      else if (typeof context === 'object') parsedContext = context || {};
    } catch (e) { parsedContext = {}; }

    const sessionStream = getOrCreateSession(sessionId || `stream-${Date.now()}`);

    // RUN-FIRST STREAM: "making enough" — use only parsedContext (same as main POST)
    const rawMsgStreamFirst = String(message ?? '').trim().toLowerCase();
    const isMakingEnoughStreamFirst = /\bmaking\s+enough\b/i.test(rawMsgStreamFirst) && (/\b(?:on\s+)?(?:this\s+)?(?:job|project)\b/i.test(rawMsgStreamFirst) || /\bmoney\b/i.test(rawMsgStreamFirst) || /\bjob\b/i.test(rawMsgStreamFirst) || /\b(?:am\s+i|are\s+we|is\s+this)\s+making\s+enough/i.test(rawMsgStreamFirst));
    const hasProjectContextStreamFirst = parsedContext.projectId || parsedContext.currentProject || parsedContext.projectName || (parsedContext.screen && String(parsedContext.screen).toLowerCase() === 'project detail');
    if (isMakingEnoughStreamFirst && hasProjectContextStreamFirst) {
      const projNameStreamFirst = parsedContext.currentProject || parsedContext.projectName || parsedContext.bidTitle || 'This project';
      const financeStreamFirst = getProjectFinancialSnapshot({ parsedContext });
      if (financeStreamFirst.currentMarginPct != null && Number.isFinite(Number(financeStreamFirst.currentMarginPct))) {
        const replyStreamFirst = appendDataFreshness(buildMakingEnoughReply(projNameStreamFirst, financeStreamFirst.currentMarginPct), parsedContext);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: replyStreamFirst })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: sessionStream?.id })}\n\n`);
        res.end();
        return;
      }
      if (financeStreamFirst.revenue > 0 || financeStreamFirst.estimatedCost > 0) {
        let replyStreamFirst = `I have **${projNameStreamFirst}** but no margin percentage in this view. Open the project and ask "What is my margin?" first, then I can tell you if you're making enough.`;
        replyStreamFirst += `\n\n➡️ Want a health check or budget breakdown?`;
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: replyStreamFirst })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: sessionStream?.id })}\n\n`);
        res.end();
        return;
      }
      const fallbackStreamFirst = `I don't have contract or cost numbers for **${projNameStreamFirst}** in this view. Open the project and ask "What is my margin?" first.`;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`data: ${JSON.stringify({ type: 'token', content: fallbackStreamFirst })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: sessionStream?.id })}\n\n`);
      res.end();
      return;
    }

    // RUN-FIRST STREAM: "Yes" after scenario choice → return all three scenarios immediately
    const histStream = Array.isArray(history) ? history : [];
    const lastAsstStream = String([...histStream].reverse().find((m) => m?.role === 'assistant')?.content || [...histStream].reverse().find((m) => m?.role === 'assistant')?.text || '').toLowerCase();
    const asstAskedScenarioStream = lastAsstStream.includes('typical friction') && lastAsstStream.includes('bad remodel') && lastAsstStream.includes('smooth job');
    const userMsgTrimStream = String(message ?? '').trim();
    const lettersOnlyStream = userMsgTrimStream.toLowerCase().replace(/\W/g, '');
    const isYesWordStream = ['yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'sure', 'please', 'all'].includes(lettersOnlyStream) ||
      /^\s*(yes|yeah|yep|sure|ok|okay|please|all)\s*\.?\s*$/i.test(userMsgTrimStream) ||
      /\b(all\s+of\s+them|all\s+three)\b/i.test(userMsgTrimStream);
    if (asstAskedScenarioStream && isYesWordStream) {
      const projStream = parsedContext.allProjects?.find((p) => String(p?.id) === String(parsedContext.projectId)) || parsedContext;
      const ctxStream = { ...parsedContext, currentProject: projStream };
      const scenarioReplyStream = runScenarioAllPresetsInline(ctxStream);
      if (scenarioReplyStream) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: scenarioReplyStream })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: sessionStream?.id })}\n\n`);
        res.end();
        return;
      }
    }

    // RUN-FIRST STREAM: User tapped a scenario card — return computed result immediately (no LLM)
    const scenarioIdsStream = ['typical_friction', 'bad_remodel', 'smooth_job', 'job_runs_long', 'job_runs_long_4', 'job_runs_long_6'];
    const selectedScenarioStream = parsedContext?.scenarioSelectionResume && parsedContext?.selectedScenario
      ? parsedContext.selectedScenario
      : (scenarioIdsStream.includes(String(userMsgTrimStream || '').toLowerCase()) ? String(userMsgTrimStream || '').toLowerCase() : null);
    if (selectedScenarioStream) {
      const projStreamSingle = parsedContext.allProjects?.find((p) => String(p?.id) === String(parsedContext.projectId)) || parsedContext;
      const ctxStreamSingle = { ...parsedContext, currentProject: projStreamSingle };
      const singleScenarioReply = runScenarioSingleInline(selectedScenarioStream, ctxStreamSingle);
      if (singleScenarioReply) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: singleScenarioReply })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: sessionStream?.id })}\n\n`);
        res.end();
        return;
      }
    }

    const session = sessionStream;
    const aiPmMode = user_settings.ai_project_manager_mode || false;
    const allProjects = parsedContext.allProjects || [];
    const screen = parsedContext.screen || 'assistant_tab';
    const screenLower = screen.toLowerCase();
    const isCommandCenter = screenLower === 'projects' || screenLower === 'ai assistant tab';

    const projectIdStream = parsedContext.projectId;
    const rawBodyMsgStream = String(message ?? '').toLowerCase();

    // EARLY STREAM: "Am I making enough (money)? (on this job/project)?" — same deterministic reply as main POST
    const isMakingEnoughStream = /\bmaking\s+enough\b/i.test(rawBodyMsgStream) && (/\b(?:on\s+)?(?:this\s+)?(?:job|project)\b/i.test(rawBodyMsgStream) || /\bmoney\b/i.test(rawBodyMsgStream) || /\bjob\b/i.test(rawBodyMsgStream));
    const hasProjectContextStream = projectIdStream || parsedContext.currentProject || parsedContext.projectName || (parsedContext.screen && String(parsedContext.screen).toLowerCase() === 'project detail') || allProjects.length > 0;
    if (isMakingEnoughStream && hasProjectContextStream) {
      const projNameS = parsedContext.currentProject || parsedContext.projectName || parsedContext.bidTitle || 'This project';
      const financeStream = getProjectFinancialSnapshot({ parsedContext });
      if (financeStream.currentMarginPct != null && Number.isFinite(Number(financeStream.currentMarginPct))) {
        const replyS = appendDataFreshness(buildMakingEnoughReply(projNameS, financeStream.currentMarginPct), parsedContext);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: replyS })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
      if (financeStream.revenue > 0 || financeStream.estimatedCost > 0) {
        let replyS = `I have **${projNameS}** but no margin percentage in this view. Open the project and ask "What is my margin?" first, then I can tell you if you're making enough.`;
        replyS += `\n\n➡️ Want a health check or budget breakdown?`;
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: replyS })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
      const fallbackNameS = parsedContext.currentProject || parsedContext.projectName || 'this project';
      const fallbackReplyS = `I don't have contract or cost numbers for **${fallbackNameS}** in this view. Open the project (or the estimate) and ask again, or ask "What is my margin?" first.`;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`data: ${JSON.stringify({ type: 'token', content: fallbackReplyS })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
      res.end();
      return;
    }

    // MARGIN AT X% COMPLETE: "margin at 50% complete" / "50% timeline left"
    const msgForProgressStream = (normalizedMessage || (message || '').replace(/[\u2018\u2019]/g, "'") || '').toLowerCase();
    const progressMatch = msgForProgressStream.match(/\b(?:margin|profit)\s+(?:at|with)\s+(\d+)\s*%?\s*(?:percent\s+)?(?:complete|timeline\s+left)\b/i) ||
      msgForProgressStream.match(/\b(\d+)\s*%?\s*(?:percent\s+)?(?:timeline\s+)?left\s+to\s+complete\b/i) ||
      msgForProgressStream.match(/\b(?:figure\s+out|figure)\s+.*?(\d+)\s*%?\s*(?:percent\s+)?(?:timeline\s+)?left\b/i);
    const targetProgressStream = progressMatch ? Math.min(99, Math.max(1, parseInt(progressMatch[1], 10))) : null;
    if (targetProgressStream != null && (msgForProgressStream.includes('margin') || msgForProgressStream.includes('profit'))) {
      const streamProjects = Array.isArray(allProjects) ? allProjects : [];
      let targetStream = streamProjects.find(p => String(p?.id) === String(parsedContext.projectId));
      if (!targetStream && parsedContext.currentProject) targetStream = resolveProjectByQuery(streamProjects, parsedContext.currentProject, { minScore: 35 }).project;
      for (const name of (streamProjects.map(p => (p?.title || p?.name || '').trim()).filter(Boolean))) {
        if (name.length >= 2 && msgForProgressStream.includes(name.toLowerCase())) {
          targetStream = streamProjects.find(p => (p?.title || p?.name || '').trim() === name);
          if (targetStream) break;
        }
      }
      if (targetStream) {
        const contract = Number(targetStream.contractValue || targetStream.bidPrice || targetStream.bidTotal || 0);
        const spent = Number(targetStream.totalSpent || targetStream.actualCost || 0);
        const progressPct = Math.max(0.1, Math.min(99, Number(targetStream.progress || targetStream.overallProgressPct || 0)));
        const estCost = Number(targetStream.estimatedCost || 0);
        const marginScenario = computeMarginAtProgress({
          contract,
          spent,
          estimatedCost: estCost,
          currentProgressPct: progressPct,
          targetProgressPct: targetProgressStream,
        });
        const r = buildMarginAtProgressReply(marginScenario);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: r })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
    }

    // DELAY SCENARIO: "projected profit if job goes longer than expected" — two-layer model
    const msgForDelayStream = (normalizedMessage || (message || '').replace(/[\u2018\u2019]/g, "'") || '').toLowerCase();
    const delayWeeksMatch = msgForDelayStream.match(/(\d+)\s*weeks?/i);
    const extraWeeksStream = delayWeeksMatch ? Math.min(52, Math.max(1, parseInt(delayWeeksMatch[1], 10))) : 2;
    const isDelayScenarioStream = (msgForDelayStream.includes('goes longer') || msgForDelayStream.includes('longer than expected') || msgForDelayStream.includes('goes long') || msgForDelayStream.includes('goes too long')) &&
      (msgForDelayStream.includes('profit') || msgForDelayStream.includes('margin'));
    if (isDelayScenarioStream) {
      const streamProjects = Array.isArray(allProjects) ? allProjects : [];
      let targetStream = streamProjects.find(p => String(p?.id) === String(parsedContext.projectId));
      if (!targetStream && parsedContext.currentProject) targetStream = resolveProjectByQuery(streamProjects, parsedContext.currentProject, { minScore: 35 }).project;
      if (targetStream) {
        const contractVal = Number(targetStream.contractValue || targetStream.bidPrice || targetStream.bidTotal || 0);
        const actual = Number(targetStream.totalSpent || targetStream.actualCost || 0);
        const committedPOs = Number(parsedContext?.committedPOs ?? targetStream.committedPOs ?? 0) ||
          (Array.isArray(targetStream.purchaseOrders) ? targetStream.purchaseOrders.filter(po => (po?.status || '').toLowerCase() === 'pending').reduce((s, po) => s + Number(po?.amount || 0), 0) : 0);
        const progressPct = Math.max(0, Math.min(100, Number(targetStream.progress || targetStream.overallProgressPct || 0)));
        const progressRatio = progressPct > 0 ? progressPct / 100 : 0;
        const runRateCost = progressRatio > 0.01 && actual > 0 ? actual / progressRatio : 0;
        const estCost = Number(targetStream.estimatedCost || 0);
        const baseForecastFinalCost = Math.max(actual + committedPOs, runRateCost > 0 ? runRateCost : (estCost || actual));
        const ed = targetStream.estimateData || parsedContext.estimateData || {};
        const buckets = parsedContext.buckets || targetStream.buckets || [];
        const laborBudget = Number(ed?.laborTotal ?? targetStream.laborTotal ?? 0) || buckets.filter(b => (b.name || '').toLowerCase().includes('labor')).reduce((s, b) => s + (Number(b.budget || b.bidBudget) || 0), 0);
        const materialBudget = Number(ed?.materialTotal ?? targetStream.materialTotal ?? 0) || buckets.filter(b => { const n = (b.name || '').toLowerCase(); return n.includes('material') || n.includes('equipment'); }).reduce((s, b) => s + (Number(b.budget || b.bidBudget) || 0), 0);
        const overheadBudget = Number(parsedContext?.overhead ?? ed?.overheadTotal ?? 0);
        const estimatedWeeks = 12;
        const weeklyLabor = laborBudget > 0 ? laborBudget / estimatedWeeks : 0;
        const weeklyMaterial = materialBudget > 0 ? materialBudget / estimatedWeeks : 0;
        const weeklyOverhead = overheadBudget > 0 ? overheadBudget / estimatedWeeks : 0;
        const addedLaborCost = Math.round(weeklyLabor * extraWeeksStream);
        const addedMaterialCost = Math.round(weeklyMaterial * extraWeeksStream);
        const addedOverheadCost = Math.round(weeklyOverhead * extraWeeksStream);
        const addedDelayCosts = addedLaborCost + addedMaterialCost + addedOverheadCost || Math.round((laborBudget / 12 || baseForecastFinalCost * 0.4 / 12) * extraWeeksStream);
        const scenarioForecastFinalCost = Math.round(baseForecastFinalCost + addedDelayCosts);
        const projectedProfit = Math.round(contractVal - scenarioForecastFinalCost);
        const projectedMargin = contractVal > 0 ? (projectedProfit / contractVal) * 100 : 0;
        const name = targetStream.title || targetStream.name || 'This project';
        let r = `If this job goes **${extraWeeksStream} weeks too long**, your projected profit would be approximately **$${projectedProfit.toLocaleString()}** (${Number(projectedMargin).toFixed(1)}% margin). `;
        r += `Baseline forecast cost: $${Math.round(baseForecastFinalCost).toLocaleString()}. Added delay cost (labor + materials + overhead for ${extraWeeksStream} weeks): ~$${addedDelayCosts.toLocaleString()}. `;
        r += `Want me to run a detailed breakdown or a what-if scenario?`;
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: r })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
    }

    // SIMPLE PROJECTED PROFIT: "projected profit for this job" / "expected profit" — use Overview's numbers (NOT delay scenario)
    const msgForProfitStream = (normalizedMessage || (message || '').replace(/[\u2018\u2019]/g, "'") || '').toLowerCase();
    const isSimpleProfitStream = !msgForProfitStream.includes('forecast') && !isDelayScenarioStream && (
      /\b(projected|expected|estimated)\s+profit\b/i.test(msgForProfitStream) ||
      /\bprofit\s+(?:for|on)\s+(?:this\s+)?job\b/i.test(msgForProfitStream)
    );
    if (isSimpleProfitStream) {
      const streamProjects = Array.isArray(allProjects) ? allProjects : [];
      let targetStream = streamProjects.find(p => String(p?.id) === String(parsedContext.projectId));
      if (!targetStream && parsedContext.currentProject) targetStream = resolveProjectByQuery(streamProjects, parsedContext.currentProject, { minScore: 35 }).project;
      for (const name of (streamProjects.map(p => (p?.title || p?.name || '').trim()).filter(Boolean))) {
        if (name.length >= 2 && msgForProfitStream.includes(name.toLowerCase())) {
          targetStream = streamProjects.find(p => (p?.title || p?.name || '').trim() === name);
          if (targetStream) break;
        }
      }
      if (!targetStream) {
        const forMatch = (message || '').match(/\b(?:for|on|about)\s+([A-Za-z][A-Za-z0-9\s\-']*?)(?:\s*\?|\s*$)/i);
        const nameFromMsg = forMatch ? forMatch[1].trim() : null;
        if (nameFromMsg) targetStream = resolveProjectByQuery(streamProjects, nameFromMsg, { minScore: 35 }).project;
      }
      if (targetStream) {
        const fromOverview = typeof parsedContext.projectedMarginPct === 'number' && Number.isFinite(parsedContext.projectedMarginPct);
        const profitSnapshot = getProjectFinancialSnapshot({ project: targetStream, parsedContext: fromOverview ? parsedContext : {} });
        const marginPct = fromOverview ? parsedContext.projectedMarginPct : profitSnapshot.projectedMarginPct;
        let projectedProfit = profitSnapshot.projectedProfit != null ? Math.round(profitSnapshot.projectedProfit) : null;
        if (fromOverview && typeof parsedContext.projectedProfit === 'number' && Number.isFinite(parsedContext.projectedProfit)) {
          projectedProfit = Math.round(parsedContext.projectedProfit);
        }
        const name = targetStream.title || targetStream.name || 'This project';
        const r = buildProjectedProfitReply({ projectName: name, projectedProfit, marginPct });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: r })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
    }

    // SIMPLE MARGIN/PROFIT: return short response immediately (same as main POST) so stream never gives long forecast
    const msgForSimpleMarginStream = (normalizedMessage || (message || '').replace(/[\u2018\u2019]/g, "'") || '').toLowerCase();
    const isSimpleMarginStream = (msgForSimpleMarginStream.includes('margin') && !msgForSimpleMarginStream.includes('forecast') &&
      (msgForSimpleMarginStream.includes('profit') || msgForSimpleMarginStream.includes('expected') ||
       /\b(what is my|what'?s my|what is the|how is my|how'?s my)\b/i.test(msgForSimpleMarginStream))) ||
      /\b(what is my|what'?s my|what is the)\s+(profit\s+)?margin\b/i.test(msgForSimpleMarginStream) ||
      /\b(what is my|what'?s my|what is the)\s+current\s+margin\b/i.test(msgForSimpleMarginStream) ||
      /\b(what is my|what'?s my)\s+profit\b/i.test(msgForSimpleMarginStream) ||
      /\bmargin\s+for\s+\w+/i.test(msgForSimpleMarginStream) ||
      /\bprofit\s+margin\s+for\s+\w+/i.test(msgForSimpleMarginStream);
    if (isSimpleMarginStream) {
      // EARLY-EXIT: When we have projectId + contract, always answer from context — never let stream fall through to LLM
      const streamContextSnapshot = getProjectFinancialSnapshot({ parsedContext });
      if (parsedContext.projectId && streamContextSnapshot.revenue > 0) {
        const streamR = appendDataFreshness(formatMarginReply({
          spendToDatePct: streamContextSnapshot.spendToDateMarginPct,
          projectedPct: streamContextSnapshot.projectedMarginPct,
          originalEstPct: streamContextSnapshot.bidMarginPct,
          projectedProfit: typeof parsedContext.projectedProfit === 'number' ? parsedContext.projectedProfit : streamContextSnapshot.projectedProfit,
        }), parsedContext);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: streamR })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
      const streamProjects = Array.isArray(allProjects) ? allProjects : [];
      const projectNamesStream = streamProjects.map(p => (p?.title || p?.name || '').trim()).filter(Boolean);
      let targetStream = streamProjects.find(p => String(p?.id) === String(parsedContext.projectId));
      if (!targetStream && parsedContext.currentProject) targetStream = resolveProjectByQuery(streamProjects, parsedContext.currentProject, { minScore: 35 }).project;
      for (const name of projectNamesStream) {
        if (name.length >= 2 && msgForSimpleMarginStream.includes(name.toLowerCase())) {
          targetStream = streamProjects.find(p => (p?.title || p?.name || '').trim() === name);
          if (targetStream) break;
        }
      }
      if (!targetStream) {
        const forMatch = (message || '').match(/\b(?:for|on|about)\s+([A-Za-z][A-Za-z0-9\s\-']*?)(?:\s*\?|\s*$)/i);
        const nameFromMsg = forMatch ? forMatch[1].trim() : null;
        if (nameFromMsg) targetStream = resolveProjectByQuery(streamProjects, nameFromMsg, { minScore: 35 }).project;
      }
      const streamReply = targetStream
        ? (() => {
            const isCurrentProject = isCurrentProjectMatch(targetStream, parsedContext);
            return buildMarginReplyForProject(targetStream, {
              parsedContext,
              isCurrent: isCurrentProject,
              followUp: '➡️ Want a detailed breakdown of your margin, or check on any other upcoming payments or project details?',
            })?.reply;
          })()
        : (() => { const nameHint = (message || '').match(/\b(?:for|on|about)\s+([A-Za-z][A-Za-z0-9\s\-']*?)(?:\s*\?|\s*$)/i)?.[1]?.trim() || 'this project'; return `I don't have ${nameHint}'s data in this view. Open the project and ask again, or ask from the project screen.`; })();
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`data: ${JSON.stringify({ type: 'token', content: appendDataFreshness(streamReply, parsedContext) })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
      res.end();
      return;
    }

    // SIMPLE PAYMENTS: "when am I getting paid", "next payment", "upcoming payments" — deterministic from timeline
    const msgForPaymentsStream = (normalizedMessage || (message || '').replace(/[\u2018\u2019]/g, "'") || '').toLowerCase();
    const isPaymentQuestionStream = /\b(when am I getting paid|next payment|upcoming payment|payments due|when.*getting paid|my next payment|what payments? (?:are )?due|payments? (?:due|coming))\b/i.test(msgForPaymentsStream);
    if (isPaymentQuestionStream) {
      const streamProjects = Array.isArray(allProjects) ? allProjects : [];
      const paymentBuckets = collectPaymentBuckets({ parsedContext, projects: streamProjects, now: new Date() });
      const streamPayReply = appendDataFreshness(buildPaymentStatusReply({
        upcoming: paymentBuckets.upcoming,
        overdue: paymentBuckets.overdue,
        unscheduled: paymentBuckets.unscheduled,
        fallbackProjectName: parsedContext.currentProject || parsedContext.projectName || 'your project',
      }), parsedContext);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`data: ${JSON.stringify({ type: 'token', content: streamPayReply })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
      res.end();
      return;
    }

    // SIMPLE OVER BUDGET: "am I over budget", "over budget", "budget status" — deterministic (not portfolio list)
    const msgForBudgetStream = normalizedMessage || (message || '').replace(/[\u2018\u2019]/g, "'") || '';
    const isOverBudgetStream = isSimpleProjectBudgetStatusQuery(msgForBudgetStream);
    if (isOverBudgetStream) {
      const streamBudget = Number(parsedContext.estimatedCost || parsedContext.contractValue || parsedContext.bidTotal || 0);
      const streamSpent = Number(parsedContext.actualCost ?? parsedContext.totalSpent ?? 0);
      const streamProjName = parsedContext.currentProject || parsedContext.projectName || 'This project';
      if (streamBudget > 0) {
        const fullReply = appendDataFreshness(buildBudgetStatusReply({ projectName: streamProjName, budget: streamBudget, spent: streamSpent }), parsedContext);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: fullReply })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
    }

    // CALENDAR EVENTS (stream parity with main POST)
    const msgCalStream = normalizeAiMessageForIntent(String(message || ''));
    const projectsCalStream = Array.isArray(allProjects) ? allProjects : [];
    if (isCalendarEventsListQuery(msgCalStream) && projectsCalStream.length > 0) {
      const typeF = calendarEventTypeFilterFromMessage(msgCalStream);
      const upcomingS = collectUpcomingCalendarEvents({ allProjects: projectsCalStream, typeFilter: typeF });
      const cap = typeF ? typeF.charAt(0).toUpperCase() + typeF.slice(1) : null;
      const projectsActiveForPay = projectsCalStream.filter((p) => isProjectActiveForCalendarEvents(p));
      const pidCal = parsedContext.projectId || parsedContext.activeProjectId || parsedContext.resolvedProjectId;
      let projForCalPay = pidCal && projectsCalStream.length
        ? projectsCalStream.find((p) => String(p?.id) === String(pidCal))
        : null;
      if (projForCalPay && !isProjectActiveForCalendarEvents(projForCalPay)) projForCalPay = null;
      const paymentBucketsCal = collectPaymentBuckets({
        parsedContext,
        projects: projectsActiveForPay,
        currentProject: projForCalPay,
        now: new Date(),
      });
      const calListReply = appendDataFreshness(
        buildCalendarAndPaymentsCombinedReply({
          events: upcomingS,
          paymentBuckets: paymentBucketsCal,
          filterLabel: cap,
        }),
        parsedContext,
      );
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`data: ${JSON.stringify({ type: 'token', content: calListReply })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [{ label: 'Add a calendar event', prompt: 'Schedule an inspection on 2026-04-01 for my current project' }], sessionId: session?.id })}\n\n`);
      res.end();
      return;
    }
    const msgCalCreateStream = String(message || '').trim();
    const wantsCalCreateStream = shouldUseCalendarCreateParser(msgCalCreateStream, histStream);
    if (wantsCalCreateStream && projectsCalStream.length > 0) {
      const pcc = parseCalendarEventCreate(msgCalCreateStream, { allProjects: projectsCalStream, parsedContext, history: histStream });
      if (pcc.needsMore === 'date') {
        const r = appendDataFreshness('I can add that to your **Project Calendar**. What **date** should I use? (Example: **2026-04-15** or **tomorrow**.)', parsedContext);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: r })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
      if (pcc.needsMore === 'details') {
        const d = pcc.event?.date ? `**${pcc.event.date}**` : 'that date';
        const r = appendDataFreshness(`I've got ${d} on your **Project Calendar**. What should we **call** this event? You can also say the **type** (inspection, delivery, work, payment, deadline, other).`, parsedContext);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: r })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
      if (pcc.needsMore === 'project') {
        const r = appendDataFreshness('**Which project** should this go on? Say the project name or open that project first.', parsedContext);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: r })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
      if (pcc.ok && pcc.projectId && pcc.event) {
        const e = pcc.event;
        const r = appendDataFreshness(
          `I'll add **${e.title}** (${e.type}) on **${e.date}**${e.time ? ` at ${e.time}` : ''} for **${pcc.projectName}**. Confirm in the app to save (same flow as the main assistant).`,
          parsedContext,
        );
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`data: ${JSON.stringify({ type: 'token', content: r })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: [], sessionId: session?.id })}\n\n`);
        res.end();
        return;
      }
    }

    // PORTFOLIO PARITY (Command Center / Projects): same compare_projects shortcuts as main POST — deterministic, no LLM
    const portfolioMsgStream = normalizeAiMessageForIntent(String(message || ''));
    const streamPortfolioFollowUps = [
      { label: 'Portfolio overview', prompt: 'Give me a quick portfolio overview with key numbers' },
      { label: 'Where am I losing money?', prompt: 'Where am I losing money across my active projects? Show me the biggest profit leaks.' },
      { label: 'Projects over budget', prompt: 'Which active projects are over budget and by how much?' },
    ];
    if (isCommandCenter && Array.isArray(allProjects) && allProjects.length > 0) {
      let streamCompareArgs = null;
      if (isPortfolioLosingMoneyQuery(portfolioMsgStream)) streamCompareArgs = { activeOnly: true };
      else if (isPortfolioOverBudgetListQuery(portfolioMsgStream)) streamCompareArgs = { sortBy: 'overBudget' };
      else if (isPortfolioCompareActiveQuery(portfolioMsgStream)) streamCompareArgs = { activeOnly: true };
      else if (isPortfolioWorstProjectQuery(portfolioMsgStream)) streamCompareArgs = { activeOnly: true, sortBy: 'lowMargin' };
      if (streamCompareArgs) {
        const cr = runCompareProjectsPipeline({ allProjects, parsedContext, args: streamCompareArgs });
        if (cr.success) {
          let portfolioText = '';
          if (!cr.sorted || cr.sorted.length === 0) {
            portfolioText = streamCompareArgs.activeOnly
              ? 'You have **no active projects** in this view (or none matched the filter). Open **Projects** or pull to refresh, then ask again.'
              : '**No projects matched** this filter in the current view. Pull to refresh if you recently added or updated jobs.';
          } else {
            portfolioText = buildPortfolioComparisonReply(cr.sorted);
            const nextMoves = buildPortfolioNextActions(cr.sorted);
            if (nextMoves) portfolioText += `\n${nextMoves}`;
          }
          portfolioText = appendDataFreshness(portfolioText, parsedContext);
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.write(`data: ${JSON.stringify({ type: 'token', content: portfolioText })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'done', suggestedFollowUps: streamPortfolioFollowUps, sessionId: session?.id })}\n\n`);
          res.end();
          return;
        }
      }
    }

    // Build a simplified system prompt for streaming (portfolio mode only)
    const streamBidMarginPct = parsedContext.bidMarginPct ?? parsedContext.projectInfo?.bidMarginPct;
    let streamSystemPrompt = buildSystemPrompt({
      projectName: parsedContext.currentProject || parsedContext.projectName,
      projectId: parsedContext.projectId,
      status: parsedContext.status || 'active',
      bidTotal: Number(parsedContext.bidTotal || 0),
      estimatedCost: Number(parsedContext.estimatedCost || 0),
      actualCost: Number(parsedContext.actualCost || 0),
      progress: Number(parsedContext.progress || 0),
      bidMarginPct: typeof streamBidMarginPct === 'number' ? streamBidMarginPct : undefined,
      aiPmMode, pmAlerts: [],
      screen,
    });

    if (isCommandCenter) {
      const projectStatusBlock = buildProjectStatusBlock(parsedContext);
      if (projectStatusBlock) streamSystemPrompt += projectStatusBlock;

      const dataSnapshot = buildProjectDataSnapshot(parsedContext);
      if (dataSnapshot) streamSystemPrompt += `\n\n📊 PROJECT DATA (use for margin questions — each project has "Bid margin (from estimate)" and current margin):\n${dataSnapshot}`;

      const listAlerts = runProjectsListIntelligence(parsedContext);
      if (listAlerts.length > 0) {
        streamSystemPrompt += `\n\n📌 PORTFOLIO INTELLIGENCE:\n${listAlerts.map((a, i) => `${i + 1}. ${a}`).join('\n')}`;
      }
    }

    const memoryBlock = buildMemoryContext(session, parsedContext);
    if (memoryBlock) streamSystemPrompt += memoryBlock;

    // When user asks about margin, inject exact original + current margin so AI always states both
    const streamMarginHint = buildMarginAnswerHint(
      normalizedMessage,
      allProjects,
      parsedContext.currentProject || parsedContext.projectName,
      parsedContext.projectId,
      null,
      parsedContext
    );
    if (streamMarginHint) streamSystemPrompt += `\n\n${streamMarginHint}`;

    const messages = [
      { role: 'system', content: streamSystemPrompt },
      ...history.filter(m => m.role && m.content),
      { role: 'user', content: normalizedMessage },
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
        model: 'gpt-4o',
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
      if (process.env.DEBUG_AI_CONTEXT) console.log(`⏱️ [${requestId}] ${phase}`, { elapsedMs: Date.now() - requestStartedAt, ...extra });
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
    
    if (!authToken && process.env.DEBUG_AI_CONTEXT) console.warn('⚠️ AI Assistant request missing auth token');

    const { message, context, history = [], user_settings = {}, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    // Normalize so "profit margin" and "margin" are answered the same way
    const normalizedMessage = String(message).replace(/\bprofit\s+margin\b/gi, 'margin');

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

    // ── RUN-FIRST: "Am I making enough (money) on this job?" — use ONLY parsedContext so we never miss (e.g. project detail sends no allProjects)
    const rawMsgFirst = String(req.body?.message ?? message ?? '').trim();
    const rawMsgLower = rawMsgFirst.toLowerCase();
    const isMakingEnoughRunFirst = /\bmaking\s+enough\b/i.test(rawMsgLower) && (
      /\b(?:on\s+)?(?:this\s+)?(?:job|project)\b/i.test(rawMsgLower) ||
      /\bmoney\b/i.test(rawMsgLower) ||
      /\bjob\b/i.test(rawMsgLower) ||
      /\b(?:am\s+i|are\s+we|is\s+this)\s+making\s+enough/i.test(rawMsgLower)
    );
    const hasProjectContextRunFirst = parsedContext.projectId || parsedContext.currentProject || parsedContext.projectName ||
      (parsedContext.screen && String(parsedContext.screen).toLowerCase() === 'project detail');
    if (isMakingEnoughRunFirst && !hasProjectContextRunFirst && process.env.DEBUG_AI_CONTEXT) {
      console.log('⚠️ RUN-FIRST "making enough": no project context', parsedContext.screen, parsedContext.projectId);
    }
    if (isMakingEnoughRunFirst && hasProjectContextRunFirst) {
      const projNameFirst = parsedContext.currentProject || parsedContext.projectName || parsedContext.bidTitle || 'This project';
      const financeRunFirst = getProjectFinancialSnapshot({ parsedContext });
      if (financeRunFirst.currentMarginPct != null && Number.isFinite(Number(financeRunFirst.currentMarginPct))) {
        const replyFirst = buildMakingEnoughReply(projNameFirst, financeRunFirst.currentMarginPct);
        if (process.env.DEBUG_AI_CONTEXT) console.log('✅ RUN-FIRST "making enough":', projNameFirst, Number(financeRunFirst.currentMarginPct).toFixed(1) + '%');
        return res.json({ reply: replyFirst, actions: [] });
      }
      if (financeRunFirst.revenue > 0 || financeRunFirst.estimatedCost > 0) {
        let replyFirst = `I have **${projNameFirst}** but no margin percentage in this view. Open the project and ask "What is my margin?" first, then I can tell you if you're making enough.`;
        replyFirst += `\n\n➡️ Want a health check or budget breakdown?`;
        if (process.env.DEBUG_AI_CONTEXT) console.log('✅ RUN-FIRST "making enough": fallback (no margin)');
        return res.json({ reply: replyFirst, actions: [] });
      }
      if (process.env.DEBUG_AI_CONTEXT) console.log('✅ RUN-FIRST "making enough": no revenue/cost');
      return res.json({ reply: `I don't have contract or cost numbers for **${projNameFirst}** in this view. Open the project and ask "What is my margin?" first.`, actions: [] });
    }

    // ── RUN-FIRST: "Yes" after scenario choice → return all three scenarios immediately (bypass router entirely)
    const hist = Array.isArray(history) ? history : [];
    const lastAsst = String([...hist].reverse().find((m) => m?.role === 'assistant')?.content || [...hist].reverse().find((m) => m?.role === 'assistant')?.text || '').toLowerCase();
    const asstAskedScenario = lastAsst.includes('typical friction') && lastAsst.includes('bad remodel') && lastAsst.includes('smooth job');
    const userMsgTrim = String(req.body?.message ?? message ?? '').trim();
    const lettersOnlyScenario = userMsgTrim.toLowerCase().replace(/\W/g, '');
    const isYesWord = ['yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'sure', 'please', 'all'].includes(lettersOnlyScenario) ||
      /^\s*(yes|yeah|yep|sure|ok|okay|please|all)\s*\.?\s*$/i.test(userMsgTrim) ||
      /\b(all\s+of\s+them|all\s+three)\b/i.test(userMsgTrim);
    if (asstAskedScenario && isYesWord) {
      const proj = parsedContext.allProjects?.find((p) => String(p?.id) === String(parsedContext.projectId)) || parsedContext;
      const ctx = { ...parsedContext, currentProject: proj };
      const scenarioReply = runScenarioAllPresetsInline(ctx);
      if (scenarioReply) {
        if (process.env.DEBUG_AI_CONTEXT) console.log('✅ RUN-FIRST scenario "Yes": returning all three presets');
        return res.json({ reply: scenarioReply, actions: [] });
      }
    }

    // ── RUN-FIRST: User tapped a scenario card (typical_friction, bad_remodel, etc.) — return computed result immediately
    // Bypasses router/LLM so we always return correct assumptions (+8/+5/+3 for Typical Friction) and final numbers
    const scenarioIds = ['typical_friction', 'bad_remodel', 'smooth_job', 'job_runs_long', 'job_runs_long_4', 'job_runs_long_6'];
    const selectedScenarioRunFirst = parsedContext?.scenarioSelectionResume && parsedContext?.selectedScenario
      ? parsedContext.selectedScenario
      : (scenarioIds.includes(String(userMsgTrim || '').toLowerCase()) ? String(userMsgTrim || '').toLowerCase() : null);
    if (selectedScenarioRunFirst) {
      const projRunFirst = parsedContext.allProjects?.find((p) => String(p?.id) === String(parsedContext.projectId)) || parsedContext;
      const ctxRunFirst = { ...parsedContext, currentProject: projRunFirst };
      const singleReply = runScenarioSingleInline(selectedScenarioRunFirst, ctxRunFirst);
      if (singleReply) {
        if (process.env.DEBUG_AI_CONTEXT) console.log('✅ RUN-FIRST scenario card tap:', selectedScenarioRunFirst);
        return res.json({ reply: singleReply, actions: [] });
      }
    }

    // Build system prompt based on context and settings
    const aiPmMode = user_settings.ai_project_manager_mode || false;
    
    // Extract project context
    const projectName = parsedContext.currentProject || parsedContext.projectName || parsedContext.bidTitle;
    const selectedProjectIdHint = parsedContext.selectedProjectId || null;
    const lastOpenedProjectIdHint = parsedContext.lastOpenedProjectId || null;
    let projectId = parsedContext.projectId || parsedContext.activeProjectId || parsedContext.resolvedProjectId || selectedProjectIdHint || lastOpenedProjectIdHint;
    const allProjects = parsedContext.allProjects || [];
    
    // Reduced logging to prevent terminal glitching (was: full context dump)
    if (process.env.DEBUG_AI_CONTEXT) {
      console.log('🔍 AI Assistant: Initial project context', { projectName, projectId, allProjectsCount: allProjects.length, screen: parsedContext.screen });
    }
    
    // If we have a project name but no ID, try to find it in allProjects
    if (projectName && !projectId && allProjects.length > 0) {
      const foundProject = resolveProjectByQuery(allProjects, projectName, { minScore: 35 }).project;
      if (foundProject) {
        projectId = foundProject.id;
        if (process.env.DEBUG_AI_CONTEXT) console.log('✅ AI Assistant: Resolved projectId', projectName, '→', projectId);
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
      if (process.env.DEBUG_AI_CONTEXT) console.log('✅ AI Assistant: Found currentProjectData for', projectId);
    }

    const rawBodyMsg = String(req.body?.message ?? message ?? '').toLowerCase();

    // ── EARLY: "Am I making enough (money)? (on this job/project)?" → answer before router so we never get "quick health check or full breakdown?"
    // Match any phrasing that clearly asks about making enough (money) on this job/project
    const isMakingEnoughEarly = /\bmaking\s+enough\b/i.test(rawBodyMsg) && (
      /\b(?:on\s+)?(?:this\s+)?(?:job|project)\b/i.test(rawBodyMsg) ||
      /\bmoney\b/i.test(rawBodyMsg) ||
      /\bjob\b/i.test(rawBodyMsg) ||
      /\b(?:am\s+i|are\s+we|is\s+this)\s+making\s+enough/i.test(rawBodyMsg)
    );
    const hasProjectContext = projectId || currentProjectData || allProjects.length > 0 || parsedContext.currentProject || parsedContext.projectName || parsedContext.screen === 'Project Detail';
    if (isMakingEnoughEarly && hasProjectContext) {
      const proj = currentProjectData || (Array.isArray(allProjects) ? allProjects.find(p => String(p?.id) === String(projectId)) : null) || (allProjects && allProjects[0]) || null;
      const projName = parsedContext.currentProject || parsedContext.projectName || parsedContext.bidTitle || proj?.title || proj?.name || 'This project';
      const financeEarly = getProjectFinancialSnapshot({ parsedContext, project: proj });
      if (financeEarly.currentMarginPct != null && Number.isFinite(Number(financeEarly.currentMarginPct))) {
        const reply = buildMakingEnoughReply(projName, financeEarly.currentMarginPct);
        console.log('✅ EARLY "making enough": deterministic reply for', projName, Number(financeEarly.currentMarginPct).toFixed(1) + '%');
        return res.json({ reply, actions: [] });
      }
      if (financeEarly.revenue > 0 || financeEarly.estimatedCost > 0) {
        let reply = `I have **${projName}** but no margin percentage in this view. Open the project and ask "What is my margin?" first, then I can tell you if you're making enough.`;
        reply += `\n\n➡️ Want a health check or budget breakdown?`;
        console.log('✅ EARLY "making enough": fallback (no margin data)');
        return res.json({ reply, actions: [] });
      }
      // Still in "making enough" context but no numbers — return short message so we never hit router
      const fallbackName = parsedContext.currentProject || parsedContext.projectName || 'this project';
      console.log('✅ EARLY "making enough": no revenue/cost in context');
      return res.json({ reply: `I don't have contract or cost numbers for **${fallbackName}** in this view. Open the project (or the estimate) and ask again, or ask "What is my margin?" first.`, actions: [] });
    }

    // ── FIRST-PRIORITY: "profit margin" / "margin" question → short response only (before ANY other handler)
    const isMarginQuestion = rawBodyMsg.includes('margin') && !rawBodyMsg.includes('forecast') &&
      (rawBodyMsg.includes('profit') || rawBodyMsg.includes('expected') ||
       /\b(what is my|what'?s my|what is the|how is my|how'?s my)\b/i.test(rawBodyMsg) ||
       /\bcurrent\s+margin\b/i.test(rawBodyMsg));
    if (isMarginQuestion) {
      // ALWAYS answer margin from context when we have projectId + contract — never let LLM answer (avoids 0% / wrong bid margin)
      const fpHasAnySpendData = parsedContext.hasLiveProjectContext === true ||
        (typeof parsedContext.actualCost === 'number' && Number.isFinite(parsedContext.actualCost)) ||
        (typeof parsedContext.totalSpent === 'number' && Number.isFinite(parsedContext.totalSpent)) ||
        (typeof parsedContext.spendToDateMarginPct === 'number' && Number.isFinite(parsedContext.spendToDateMarginPct));
      const fpContextSnapshot = getProjectFinancialSnapshot({ parsedContext });
      if (parsedContext.projectId && fpContextSnapshot.revenue > 0) {
        const fpName = parsedContext.currentProject || parsedContext.projectName || parsedContext.bidTitle || 'This project';
        const fpReply = formatMarginReply({
          spendToDatePct: fpContextSnapshot.spendToDateMarginPct,
          projectedPct: fpContextSnapshot.projectedMarginPct,
          originalEstPct: fpContextSnapshot.bidMarginPct,
          projectedProfit: typeof parsedContext.projectedProfit === 'number' ? parsedContext.projectedProfit : fpContextSnapshot.projectedProfit,
        });
        console.log('✅ FIRST-PRIORITY MARGIN: Using context for', fpName, 'spend-to-date', Number(fpContextSnapshot.spendToDateMarginPct || 0).toFixed(1) + '%', fpHasAnySpendData ? '(live)' : '(from contract/spent)');
        return res.json({ reply: fpReply, actions: [] });
      }
      const projectsList = Array.isArray(parsedContext.allProjects) ? parsedContext.allProjects : Array.isArray(parsedContext.projects) ? parsedContext.projects : [];
      let proj = currentProjectData || (projectId ? projectsList.find(p => String(p?.id) === String(projectId)) : null) || (projectName ? resolveProjectByQuery(projectsList, projectName, { minScore: 35 }).project : null);
      const names = projectsList.map(p => (p?.title || p?.name || '').trim()).filter(Boolean);
      if (!proj) {
        for (const n of names) {
          if (n.length >= 2 && rawBodyMsg.includes(n.toLowerCase())) { proj = projectsList.find(p => (p?.title || p?.name || '').trim() === n); if (proj) break; }
        }
      }
      if (!proj) {
        const forM = (req.body?.message || message || '').match(/\b(?:for|on|about)\s+([A-Za-z][A-Za-z0-9\s\-']*?)(?:\s*\?|\s*$)/i);
        const nameFromMsg = forM ? forM[1].trim() : null;
        if (nameFromMsg) proj = resolveProjectByQuery(projectsList, nameFromMsg, { minScore: 35 }).project;
      }
      const name = proj ? (proj.title || proj.name || 'This project') : ((req.body?.message || message || '').match(/\b(?:for|on|about)\s+([A-Za-z][A-Za-z0-9\s\-']*?)(?:\s*\?|\s*$)/i)?.[1]?.trim()) || 'this project';
      if (proj) {
        const isCurrent = isCurrentProjectMatch(proj, parsedContext);
        const marginResult = buildMarginReplyForProject(proj, {
          parsedContext,
          isCurrent,
          followUp: '➡️ Want a detailed breakdown of your margin, or check on any other upcoming payments or project details?',
        });
        const spendToDateStr = marginResult?.snapshot?.spendToDateMarginPct != null ? Number(marginResult.snapshot.spendToDateMarginPct).toFixed(1) + '%' : '—';
        console.log('✅ SIMPLE MARGIN (first-priority): short response for', name, 'spend-to-date', spendToDateStr);
        return res.json({ reply: marginResult?.reply || `I don't have ${name}'s data in this view. Open the project and ask again, or ask from the project screen.`, actions: [] });
      }
      const fallback = `I don't have ${name}'s data in this view. Open the project and ask again, or ask from the project screen.`;
      console.log('🛡️ SIMPLE MARGIN (first-priority): no project, returning fallback');
      return res.json({ reply: fallback, actions: [] });
    }

    // ── FIRST-PRIORITY: "projected profit" / "expected profit" question → use Overview's numbers (matches badge)
    const isProjectedProfitQ = /\b(projected|expected|estimated)\s+profit\b/i.test(rawBodyMsg) ||
      /\bwhat is my\s+profit\b/i.test(rawBodyMsg) || /\bwhat'?s my\s+profit\b/i.test(rawBodyMsg) ||
      /\bprofit\s+(?:for|on)\s+(?:this\s+)?job\b/i.test(rawBodyMsg);
    if (isProjectedProfitQ && !rawBodyMsg.includes('forecast')) {
      const projectsList = Array.isArray(parsedContext.allProjects) ? parsedContext.allProjects : Array.isArray(parsedContext.projects) ? parsedContext.projects : [];
      let proj = currentProjectData || (projectId ? projectsList.find(p => String(p?.id) === String(projectId)) : null) || (projectName ? resolveProjectByQuery(projectsList, projectName, { minScore: 35 }).project : null);
      const names = projectsList.map(p => (p?.title || p?.name || '').trim()).filter(Boolean);
      if (!proj) {
        for (const n of names) {
          if (n.length >= 2 && rawBodyMsg.includes(n.toLowerCase())) { proj = projectsList.find(p => (p?.title || p?.name || '').trim() === n); if (proj) break; }
        }
      }
      if (!proj) {
        const forM = (req.body?.message || message || '').match(/\b(?:for|on|about)\s+([A-Za-z][A-Za-z0-9\s\-']*?)(?:\s*\?|\s*$)/i);
        const nameFromMsg = forM ? forM[1].trim() : null;
        if (nameFromMsg) proj = resolveProjectByQuery(projectsList, nameFromMsg, { minScore: 35 }).project;
      }
      const name = proj ? (proj.title || proj.name || 'This project') : 'this project';
      if (proj) {
        const fromOverview = typeof parsedContext.projectedMarginPct === 'number' && Number.isFinite(parsedContext.projectedMarginPct);
        const profitSnapshot = getProjectFinancialSnapshot({ project: proj, parsedContext: fromOverview ? parsedContext : {} });
        const marginPct = fromOverview ? parsedContext.projectedMarginPct : profitSnapshot.projectedMarginPct;
        let projectedProfit = profitSnapshot.projectedProfit != null ? Math.round(profitSnapshot.projectedProfit) : null;
        if (fromOverview && typeof parsedContext.projectedProfit === 'number' && Number.isFinite(parsedContext.projectedProfit)) {
          projectedProfit = Math.round(parsedContext.projectedProfit);
        }
        const reply = buildProjectedProfitReply({ projectName: name, projectedProfit, marginPct });
        console.log('✅ SIMPLE PROJECTED PROFIT (first-priority): short response for', name);
        return res.json({ reply, actions: [] });
      }
    }

    // ── "Margin at X% complete" / "50% timeline left" — scenario: what would margin be at that progress point?
    const marginAtProgressMatch = rawBodyMsg.match(/\b(?:margin|profit)\s+(?:at|with)\s+(\d+)\s*%?\s*(?:percent\s+)?(?:complete|timeline\s+left|through|done)\b/i) ||
      rawBodyMsg.match(/\b(?:at|with)\s+(\d+)\s*%?\s*(?:percent\s+)?(?:complete|timeline\s+left|through)\s*(?:what|would|is)\s*(?:my\s+)?(?:margin|profit)\b/i) ||
      rawBodyMsg.match(/\b(\d+)\s*%?\s*(?:percent\s+)?(?:timeline\s+)?left\s+to\s+complete\b/i) ||
      rawBodyMsg.match(/\b(?:what|how)\s+(?:would|is)\s+my\s+(?:projected\s+)?(?:profit\s+)?margin\s+(?:at|with)\s+(\d+)\s*%?\s*(?:percent\s+)?(?:complete|left)\b/i) ||
      rawBodyMsg.match(/\b(?:figure\s+out|figure)\s+.*?(?:margin|profit)\s+.*?(\d+)\s*%?\s*(?:percent\s+)?(?:timeline\s+)?left\b/i);
    const targetProgressPct = marginAtProgressMatch ? Math.min(99, Math.max(1, parseInt(marginAtProgressMatch[1], 10))) : null;
    if (targetProgressPct != null && (rawBodyMsg.includes('margin') || rawBodyMsg.includes('profit'))) {
      const projectsList = Array.isArray(parsedContext.allProjects) ? parsedContext.allProjects : Array.isArray(parsedContext.projects) ? parsedContext.projects : [];
      let proj = currentProjectData || (projectId ? projectsList.find(p => String(p?.id) === String(projectId)) : null) || (projectName ? resolveProjectByQuery(projectsList, projectName, { minScore: 35 }).project : null);
      const names = projectsList.map(p => (p?.title || p?.name || '').trim()).filter(Boolean);
      if (!proj) {
        for (const n of names) {
          if (n.length >= 2 && rawBodyMsg.includes(n.toLowerCase())) { proj = projectsList.find(p => (p?.title || p?.name || '').trim() === n); if (proj) break; }
        }
      }
      if (!proj) {
        const forM = (req.body?.message || message || '').match(/\b(?:for|on|about)\s+([A-Za-z][A-Za-z0-9\s\-']*?)(?:\s*\?|\s*$)/i);
        const nameFromMsg = forM ? forM[1].trim() : null;
        if (nameFromMsg) proj = resolveProjectByQuery(projectsList, nameFromMsg, { minScore: 35 }).project;
      }
      const name = proj ? (proj.title || proj.name || 'This project') : 'this project';
      if (proj) {
        const contract = Number(proj.contractValue || proj.bidPrice || proj.bidTotal || 0);
        const spent = Number(proj.totalSpent || proj.actualCost || 0);
        const progressPct = Math.max(0.1, Math.min(99, Number(proj.progress || proj.overallProgressPct || 0)));
        const estCost = Number(proj.estimatedCost || 0);
        const marginScenario = computeMarginAtProgress({
          contract,
          spent,
          estimatedCost: estCost,
          currentProgressPct: progressPct,
          targetProgressPct,
        });
        const reply = buildMarginAtProgressReply({
          ...marginScenario,
          followUp: 'Want me to run a what-if scenario (Typical Friction, Bad Remodel, or Job Runs Long) to pressure-test this?',
        });
        console.log('✅ MARGIN AT PROGRESS: short response for', name, 'at', targetProgressPct, '%');
        return res.json({ reply, actions: [] });
      }
    }

    // ── FIRST-PRIORITY: "next payment" / "when am I getting paid" / "upcoming payments" → deterministic from timeline (never LLM)
    const isPaymentQuestion = /\b(when am I getting paid|next payment|upcoming payment|payments due|when.*getting paid|my next payment|what payments? (?:are )?due|payments? (?:due|coming)\b)/i.test(rawBodyMsg);
    if (isPaymentQuestion) {
      const projectsList = Array.isArray(parsedContext.allProjects) ? parsedContext.allProjects : Array.isArray(parsedContext.projects) ? parsedContext.projects : [];
      const projForPayments = currentProjectData || (projectId && projectsList.length ? projectsList.find(p => String(p?.id) === String(projectId)) : null);
      const paymentBuckets = collectPaymentBuckets({ parsedContext, projects: projectsList, currentProject: projForPayments, now: new Date() });
      const reply = buildPaymentStatusReply({
        upcoming: paymentBuckets.upcoming,
        overdue: paymentBuckets.overdue,
        unscheduled: paymentBuckets.unscheduled,
        fallbackProjectName: parsedContext.currentProject || parsedContext.projectName || 'your project',
      });
      console.log('✅ FIRST-PRIORITY PAYMENTS: deterministic reply from shared payment buckets');
      return res.json({ reply, actions: [] });
    }

    // ── FIRST-PRIORITY: create calendar event (Project Calendar — AsyncStorage on mobile) ──
    const projectsListForCalendar = Array.isArray(parsedContext.allProjects) ? parsedContext.allProjects : Array.isArray(parsedContext.projects) ? parsedContext.projects : [];
    const msgForCalendar = String(req.body?.message ?? message ?? '').trim();
    const wantsCalendarCreate = shouldUseCalendarCreateParser(msgForCalendar, hist);
    if (wantsCalendarCreate && !projectsListForCalendar.length) {
      return res.json({
        reply: appendDataFreshness('I don\'t have your project list in this view. Open **Projects** or **Command Center**, then ask again to add a calendar event.', parsedContext),
        actions: [],
      });
    }
    if (wantsCalendarCreate && projectsListForCalendar.length > 0) {
      const parsedCalCreate = parseCalendarEventCreate(msgForCalendar, { allProjects: projectsListForCalendar, parsedContext, history: hist });
      if (parsedCalCreate.needsMore === 'date') {
        return res.json({
          reply: 'I can add that to your **Project Calendar**. What **date** should I use? (Example: **2026-04-15** or **4/15/2026**, **March 25**, or say **tomorrow**.)',
          actions: [],
        });
      }
      if (parsedCalCreate.needsMore === 'details') {
        const d = parsedCalCreate.event?.date ? `**${parsedCalCreate.event.date}**` : 'that date';
        return res.json({
          reply: `I've got ${d} on your **Project Calendar**. What should we **call** this event? You can also say the **type** (inspection, delivery, work, payment, deadline, other).`,
          actions: [],
        });
      }
      if (parsedCalCreate.needsMore === 'project') {
        return res.json({
          reply: 'Got it. **Which project** is this for? Say the project name, or open that project and ask again.',
          actions: [],
        });
      }
      if (parsedCalCreate.ok && parsedCalCreate.projectId && parsedCalCreate.event) {
        const e = parsedCalCreate.event;
        const replyCal = `I'll add **${e.title}** (${e.type}) on **${e.date}**${e.time ? ` at ${e.time}` : ''} for **${parsedCalCreate.projectName}**. Confirm below to save to your calendar.`;
        console.log('✅ FIRST-PRIORITY CALENDAR CREATE: action for project', parsedCalCreate.projectId);
        return res.json({
          reply: appendDataFreshness(replyCal, parsedContext),
          actions: [{
            type: 'create_calendar_event',
            projectId: parsedCalCreate.projectId,
            projectName: parsedCalCreate.projectName,
            event: e,
          }],
        });
      }
    }

    // ── FIRST-PRIORITY: upcoming calendar events / inspections / schedule ──
    if (isCalendarEventsListQuery(rawBodyMsg) && !projectsListForCalendar.length) {
      return res.json({
        reply: appendDataFreshness('I don\'t have your project list in this view. Open **Projects** or **Command Center**, then ask again for upcoming events.', parsedContext),
        actions: [],
      });
    }
    if (isCalendarEventsListQuery(rawBodyMsg) && projectsListForCalendar.length > 0) {
      const typeFilter = calendarEventTypeFilterFromMessage(rawBodyMsg);
      const upcomingCal = collectUpcomingCalendarEvents({ allProjects: projectsListForCalendar, typeFilter });
      const filterLabel = typeFilter ? typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1) : null;
      const projectsActiveForPay = projectsListForCalendar.filter((p) => isProjectActiveForCalendarEvents(p));
      let projForCalPay = currentProjectData || (projectId && projectsListForCalendar.length
        ? projectsListForCalendar.find((p) => String(p?.id) === String(projectId))
        : null);
      if (projForCalPay && !isProjectActiveForCalendarEvents(projForCalPay)) projForCalPay = null;
      const paymentBucketsCal = collectPaymentBuckets({
        parsedContext,
        projects: projectsActiveForPay,
        currentProject: projForCalPay,
        now: new Date(),
      });
      const replyCalList = appendDataFreshness(
        buildCalendarAndPaymentsCombinedReply({
          events: upcomingCal,
          paymentBuckets: paymentBucketsCal,
          filterLabel,
        }),
        parsedContext,
      );
      console.log('✅ FIRST-PRIORITY CALENDAR LIST:', upcomingCal.length, 'events', typeFilter || 'all', '+ timeline payments');
      return res.json({ reply: replyCalList, actions: [] });
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

    // ── FIRST-PRIORITY: single-project "am I over budget?" / "budget status" → deterministic (never LLM); not portfolio list
    const isOverBudgetQuestion = isSimpleProjectBudgetStatusQuery(rawBodyMsg);
    if (isOverBudgetQuestion && (projectId || currentProjectData || (Array.isArray(parsedContext.allProjects) && parsedContext.allProjects.length > 0))) {
      const budget = Number(estimatedCost || contractValue || 0);
      const spent = Number(actualCost || 0);
      const projName = parsedContext.currentProject || parsedContext.projectName || currentProjectData?.title || currentProjectData?.name || 'This project';
      if (budget > 0) {
        const overBy = spent - budget;
        const reply = buildBudgetStatusReply({ projectName: projName, budget, spent });
        console.log('✅ FIRST-PRIORITY OVER BUDGET: deterministic reply for', projName, overBy > 0 ? 'over' : 'within');
        return res.json({ reply, actions: [] });
      }
    }

    // ── PROFITABILITY INTELLIGENCE: answer "am I making enough", "biggest threat", "which category matters", "if X increases Y%", "price for Z% margin", "overhead increase", "worst-case" ──
    const isProfitabilityQ =
      /\bam I making enough money (?:on )?(?:this )?(?:job|project)\b/i.test(rawBodyMsg) ||
      /\bmaking enough (?:on |on this )?(?:job|project)\b/i.test(rawBodyMsg) ||
      /\bis \d+% margin healthy/i.test(rawBodyMsg) ||
      /\bmargin healthy for this kind/i.test(rawBodyMsg) ||
      /\b(?:what'?s|what is) the biggest threat to profit/i.test(rawBodyMsg) ||
      /\bbiggest threat to profit (?:on )?(?:this )?(?:job|project)\b/i.test(rawBodyMsg) ||
      /\bwhich cost category matters most/i.test(rawBodyMsg) ||
      /\b(?:if |when ).+ (?:labor|material) increases \d+%/i.test(rawBodyMsg) ||
      /\bdrywall labor increases \d+%|\blabor increases \d+%/i.test(rawBodyMsg) ||
      /\b(?:how much )?margin do I lose\b/i.test(rawBodyMsg) ||
      /\bwhat price (?:should I )?charge to protect (?:a )?\d+% margin\b/i.test(rawBodyMsg) ||
      /\bcharge to protect (?:a )?\d+% margin\b/i.test(rawBodyMsg) ||
      /\bwhat happens if overhead increases from \d+% to \d+%\b/i.test(rawBodyMsg) ||
      /\boverhead increases from \d+% to \d+%\b/i.test(rawBodyMsg) ||
      /\bshow me (?:a )?worst[- ]?case scenario/i.test(rawBodyMsg) ||
      /\bworst[- ]?case scenario (?:for )?(?:this )?estimate\b/i.test(rawBodyMsg);
    if (isProfitabilityQ && (projectId || currentProjectData || (Array.isArray(parsedContext.allProjects) && parsedContext.allProjects.length > 0))) {
      const proj = currentProjectData || (Array.isArray(parsedContext.allProjects) ? parsedContext.allProjects : []).find(p => String(p?.id) === String(projectId)) || (Array.isArray(parsedContext.allProjects) && parsedContext.allProjects.length > 0 ? parsedContext.allProjects[0] : null);
      const ed = proj?.estimateData || parsedContext.estimateData || estimateData || {};
      const revenue = Number(contractValue || proj?.contractValue || proj?.bidPrice || proj?.bidTotal || parsedContext.bidTotal || parsedContext.contractValue || bidTotal || 0);
      const cost = Number(estimatedCost || proj?.estimatedCost || parsedContext.estimatedCost || ed?.totalCost || ed?.baseCost || 0);
      const spent = Number(actualCost || proj?.totalSpent || proj?.actualCost || parsedContext.actualCost || parsedContext.totalSpent || 0);
      if (process.env.DEBUG_AI_CONTEXT) console.log('✅ PROFITABILITY INTELLIGENCE: matched');
      const prog = Math.max(0, Math.min(100, Number(proj?.progress ?? proj?.overallProgressPct ?? progress ?? 0)));
      const matTotal = Number(ed?.materialTotal ?? ed?.materials ?? 0) || sumLineItems(ed?.materialLineItems ?? ed?.materialsCart, (x) => (typeof x === 'number' && Number.isFinite(x)) ? x : Number(x) || 0);
      const labTotal = Number(ed?.laborTotal ?? ed?.labor ?? 0) || sumLineItems(ed?.laborLineItems, (x) => (typeof x === 'number' && Number.isFinite(x)) ? x : Number(x) || 0);
      const overTotal = Number(parsedContext.overhead ?? proj?.overhead ?? ed?.overheadTotal ?? 0);
      const projName = parsedContext.currentProject || parsedContext.projectName || proj?.title || proj?.name || 'This project';
      const currentMarginPct = revenue > 0 && spent >= 0
        ? ((revenue - spent) / revenue) * 100
        : (revenue > 0 && cost > 0 ? (revenue - cost) / revenue * 100 : null);
      const bidMarginPctVal = typeof parsedContext.bidMarginPct === 'number' ? parsedContext.bidMarginPct : (proj?.bidMarginPct ?? ed?.marginPct);
      let reply = null;

      if (/\bam I making enough money/i.test(rawBodyMsg) || /\bmaking enough (?:on )?(?:this )?(?:job|project)\b/i.test(rawBodyMsg)) {
        const m = currentMarginPct != null ? Number(currentMarginPct).toFixed(1) : (bidMarginPctVal != null ? Number(bidMarginPctVal).toFixed(1) : null);
        if (m) {
          const above = parseFloat(m) >= 20 ? 'above' : (parseFloat(m) >= 15 ? 'at' : 'below');
          reply = `Your current margin on **${projName}** is **${m}%** based on the current numbers in this view. Many contractors target 15–25%; you're **${above}** that. `;
          reply += parseFloat(m) < 15 ? `Consider tightening costs or revisiting pricing on the next phase.` : `You're in a healthy range.`;
        } else if (revenue > 0 || cost > 0) {
          reply = `I have **${projName}** but no margin percentage in this view. Open the project and ask "What is my margin?" first, then I can tell you if you're making enough.`;
        }
      } else if (/\bis \d+% margin healthy/i.test(rawBodyMsg) || /\bmargin healthy for this kind/i.test(rawBodyMsg)) {
        const m = rawBodyMsg.match(/(\d+)\s*%?\s*margin healthy/);
        const askedPct = m ? parseInt(m[1], 10) : 18;
        const projMargin = currentMarginPct != null ? currentMarginPct : bidMarginPctVal;
        if (projMargin != null) {
          const healthy = askedPct >= 15 && askedPct <= 25;
          reply = `**${askedPct}%** is ${healthy ? 'a healthy margin' : askedPct < 15 ? 'on the tight side' : 'strong'} for most construction jobs. **${projName}** is at **${Number(projMargin).toFixed(1)}%** — ${projMargin >= askedPct ? "you're at or above that." : "you're below that; consider where you can protect margin."}`;
        }
      } else if (/\bbiggest threat to profit\b/i.test(rawBodyMsg)) {
        const risks = [];
        if (cost > 0 && spent > cost) risks.push({ text: 'Over budget', impact: `$${Math.round(spent - cost).toLocaleString()} over estimate` });
        if (prog > 0 && cost > 0 && (spent / cost) * 100 > prog + 15) risks.push({ text: 'Spend ahead of progress', impact: 'costs burning faster than work completed' });
        if (matTotal > 0 && labTotal > 0 && currentMarginPct != null && currentMarginPct < 10) risks.push({ text: 'Low margin', impact: `${Number(currentMarginPct).toFixed(1)}% leaves little cushion` });
        const top = risks[0];
        if (top) reply = `The biggest threat to profit on **${projName}** is **${top.text}** — ${top.impact}. `; else reply = `No major profit threats show up for **${projName}** right now. Keep an eye on spend vs. progress and PO commitments.`;
      } else if (/\bwhich cost category matters most\b/i.test(rawBodyMsg)) {
        const byCat = {};
        (ed?.materialLineItems || ed?.materialsCart || []).forEach((i) => {
          const c = (i?.category || i?.description || 'Materials').toString().trim() || 'Materials';
          byCat[c] = (byCat[c] || 0) + Number(i?.total ?? i?.amount ?? i?.cost ?? 0);
        });
        (ed?.laborLineItems || []).forEach((i) => {
          const c = (i?.trade || i?.category || i?.description || 'Labor').toString().trim() || 'Labor';
          byCat[c] = (byCat[c] || 0) + Number(i?.total ?? i?.amount ?? i?.cost ?? 0);
        });
        const entries = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
        const topCat = entries[0];
        if (topCat && revenue > 0) {
          const [name, total] = topCat;
          const pctImpact = total > 0 ? ((total * 0.1) / revenue * 100) : 0;
          reply = `**${name}** has the highest exposure at **$${Math.round(total).toLocaleString()}**. If prices there go up 10%, cost would rise about **$${Math.round(total * 0.1).toLocaleString()}** and margin would drop about **${Number(pctImpact).toFixed(1)}** points.`;
        } else reply = `I don't have a cost breakdown by category for **${projName}** in this view. Add line items in the estimate to see which category matters most.`;
      } else if (/\bif .+ increases \d+%\b/i.test(rawBodyMsg) || /\b(?:how much )?margin do I lose\b/i.test(rawBodyMsg)) {
        const pctMatch = rawBodyMsg.match(/(\d+)\s*%?\s*(?:percent)?/);
        const pct = pctMatch ? Math.min(50, Math.max(1, parseInt(pctMatch[1], 10))) : 10;
        const key = rawBodyMsg.replace(/\d+\s*%?/g, '').toLowerCase();
        const isLabor = /\blabor\b/i.test(rawBodyMsg);
        const items = isLabor ? (ed?.laborLineItems || []) : (ed?.materialLineItems || ed?.materialsCart || []);
        const matchWord = (key.match(/(?:drywall|framing|lumber|electrical|plumb|concrete|hvac|roof|paint|tile|floor|insulation|siding|trim|drywall)/i) || [])[0];
        let categoryTotal = 0;
        if (matchWord) {
          items.forEach((i) => {
            const t = (i?.trade || i?.category || i?.description || '').toString().toLowerCase();
            if (t.includes(matchWord.toLowerCase())) categoryTotal += Number(i?.total ?? i?.amount ?? i?.cost ?? 0);
          });
        }
        if (categoryTotal === 0) categoryTotal = isLabor ? labTotal : matTotal;
        if (categoryTotal > 0 && revenue > 0 && cost > 0) {
          const addCost = categoryTotal * (pct / 100);
          const newCost = cost + addCost;
          const newMargin = ((revenue - newCost) / revenue) * 100;
          const oldMargin = ((revenue - cost) / revenue) * 100;
          const drop = oldMargin - newMargin;
          reply = `If ${matchWord || (isLabor ? 'labor' : 'materials')} costs increase **${pct}%** (about **$${Math.round(addCost).toLocaleString()}**), margin would drop from **${Number(oldMargin).toFixed(1)}%** to **${Number(newMargin).toFixed(1)}%** — about **${Number(drop).toFixed(1)}** points.`;
        }
      } else if (/\bwhat price .* (?:to )?protect .* \d+%\s*margin\b/i.test(rawBodyMsg)) {
        const m = rawBodyMsg.match(/(\d+)\s*%?\s*(?:margin)?/);
        const targetPct = m ? Math.min(50, Math.max(5, parseInt(m[1], 10))) : 22;
        const ratio = 1 - targetPct / 100;
        if (ratio > 0 && cost > 0) {
          const price = cost / ratio;
          reply = `To protect a **${targetPct}%** margin at current cost (**$${Math.round(cost).toLocaleString()}**), you’d need to charge at least **$${Math.round(price).toLocaleString()}**. That keeps **$${Math.round(price - cost).toLocaleString()}** profit.`;
        }
      } else if (/\boverhead increases from \d+% to \d+%\b/i.test(rawBodyMsg)) {
        const nums = rawBodyMsg.match(/\d+/g);
        const fromPct = nums && nums[0] ? parseInt(nums[0], 10) : 12;
        const toPct = nums && nums[1] ? parseInt(nums[1], 10) : 15;
        const base = cost > 0 ? cost : (matTotal + labTotal);
        if (base > 0) {
          const addOverhead = base * ((toPct - fromPct) / 100);
          const newCost = base + addOverhead;
          const newMargin = revenue > 0 ? ((revenue - newCost) / revenue) * 100 : null;
          reply = `If overhead goes from **${fromPct}%** to **${toPct}%**, that adds about **$${Math.round(addOverhead).toLocaleString()}** to cost. `;
          if (newMargin != null) reply += `New margin would be about **${Number(newMargin).toFixed(1)}%**.`;
        }
      } else if (/\bworst[- ]?case scenario\b/i.test(rawBodyMsg)) {
        // Prefer PROJECT baseline (forecast final cost) when available — matches Budget Totals
        const forecastCost = Number(parsedContext.forecastFinalCost || proj?.forecastFinalCost || 0);
        const projMarginPct = typeof parsedContext.projectedMarginPct === 'number' && Number.isFinite(parsedContext.projectedMarginPct) ? parsedContext.projectedMarginPct : proj?.projectedMarginPct;
        const baseCostForWorst = forecastCost > 0 ? forecastCost : (revenue > 0 && typeof projMarginPct === 'number') ? revenue * (1 - projMarginPct / 100) : cost;
        const useProjectBaselineWorst = (forecastCost > 0 || (revenue > 0 && typeof projMarginPct === 'number')) && baseCostForWorst > 0;
        let worstCost, costUp, worstMargin, cushion;
        if (useProjectBaselineWorst) {
          const worstMultiplier = 1.15;
          worstCost = baseCostForWorst * worstMultiplier;
          costUp = worstCost - baseCostForWorst;
          worstMargin = revenue > 0 ? ((revenue - worstCost) / revenue) * 100 : null;
          cushion = revenue > 0 ? revenue - worstCost : 0;
        } else {
          const mat = matTotal || cost * 0.5;
          const lab = labTotal || cost * 0.5;
          const over = overTotal || (cost * 0.12);
          worstCost = mat * 1.1 + lab * 1.1 + over * 1.25;
          costUp = worstCost - cost;
          worstMargin = revenue > 0 ? ((revenue - worstCost) / revenue) * 100 : null;
          cushion = revenue > 0 ? revenue - worstCost : 0;
        }
        reply = `**Worst-case scenario** for **${projName}** (materials +10%, labor +10%, overhead +25%): cost **$${Math.round(worstCost).toLocaleString()}** (up **$${Math.round(costUp).toLocaleString()}**). `;
        if (worstMargin != null) reply += `Margin would be **${Number(worstMargin).toFixed(1)}%**, profit **$${Math.round(cushion).toLocaleString()}**. `;
        reply += cushion >= 0 ? `You’d still have **${Math.round(cushion).toLocaleString()}** cushion before break-even.` : `You’d be **${Math.round(-cushion).toLocaleString()}** past break-even — consider tightening costs or a price increase.`;
        if (useProjectBaselineWorst) reply += ` _Based on your project forecast._`;
      }

      if (reply) {
        if (!reply.includes('➡️')) reply += `\n\n➡️ Want me to run another scenario or check margin?`;
        console.log('✅ PROFITABILITY INTELLIGENCE: deterministic reply for', rawBodyMsg.slice(0, 50));
        return res.json({ reply, actions: [] });
      }
      if (isProfitabilityQ && (revenue <= 0 && cost <= 0)) {
        const projNameFallback = parsedContext.currentProject || parsedContext.projectName || proj?.title || proj?.name || 'this project';
        reply = `I don't have contract or cost numbers for **${projNameFallback}** in this view. Open the project (or the estimate) and ask again so I can use the real numbers.`;
        reply += `\n\n➡️ You can also ask from the project screen: "What is my margin?" or "Am I making enough money on this job?"`;
        console.log('✅ PROFITABILITY INTELLIGENCE: fallback (no revenue/cost)');
        return res.json({ reply, actions: [] });
      }
    }

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
    const isEstimateReviewEarly =
      isEstimateAssistantScreen(parsedContext) && (
        msgLowerEarly.includes('review this bid') ||
        msgLowerEarly.includes('review this estimate') ||
        msgLowerEarly.includes('review my estimate') ||
        msgLowerEarly.includes('review my bid') ||
        msgLowerEarly.includes('run my bid') ||
        msgLowerEarly.includes('final review') ||
        msgLowerEarly.includes('top fixes') ||
        msgLowerEarly.includes('audit this estimate') ||
        msgLowerEarly.includes('audit this bid') ||
        msgLowerEarly.includes('before i send') ||
        msgLowerEarly.includes('before sending') ||
        msgLowerEarly.includes('is this ready to send') ||
        msgLowerEarly.includes('is this estimate ready') ||
        msgLowerEarly.includes('is this bid ready') ||
        msgLowerEarly.includes('what should i fix first') ||
        msgLowerEarly.includes("what's missing") ||
        msgLowerEarly.includes('what is missing')
      );
    if (isEstimateReviewEarly) {
      const reviewResult = runEstimateReview({
        projectName,
        estimateData,
        bidTotal,
        parsedContext,
      });
      console.log('✅ EARLY estimate review — returning immediately (bypassing router/CO flow)');
      return res.json({ reply: reviewResult.reply, actions: [], suggestedFollowUps: reviewResult.suggestedFollowUps || [] });
    }
    if (isEstimateAssistantScreen(parsedContext)) {
      const isStartBidIntent =
        /\b(?:let'?s\s+)?(?:start|create|begin)\s+(?:a\s+)?bid\b/i.test(msgLowerEarly) ||
        /\bok\s*,?\s*(?:let'?s\s+)?(?:start|create)\s+(?:a\s+)?bid\b/i.test(msgLowerEarly);
      if (isStartBidIntent) {
        const stepNumEarly = Number(parsedContext?.currentStepNumber ?? -1);
        const startBidResult = buildEstimateStartBidReply({ parsedContext, estimateData });
        trackEstimateSessionEvent(session, 'estimate_start_bid', { step: stepNumEarly });
        console.log('✅ EARLY estimate start bid — returning immediately');
        return res.json({
          reply: startBidResult.reply,
          actions: [],
          suggestedFollowUps: startBidResult.suggestedFollowUps || [],
        });
      }

      const estimateActionResult = buildEstimateActionResponse({
        message,
        parsedContext,
        estimateData,
        bidTotal,
        projectName,
        session,
      });
      if (estimateActionResult) {
        console.log('✅ EARLY estimate action/copilot response — returning immediately');
        return res.json(estimateActionResult);
      }

      const isEstimateGuideQuery =
        msgLowerEarly.includes('help me with this estimate') ||
        msgLowerEarly.includes('help me with this bid') ||
        msgLowerEarly.includes('what should i do next') ||
        msgLowerEarly.includes('what do i do next') ||
        msgLowerEarly.includes('what should i fix next') ||
        msgLowerEarly.includes('help me with this bid') ||
        msgLowerEarly.includes('make this better') ||
        msgLowerEarly === 'help me with this' ||
        msgLowerEarly === 'help me with this estimate';
      if (isEstimateGuideQuery) {
        const guideResult = buildEstimateCopilotReply({ parsedContext, estimateData, projectName });
        trackEstimateSessionEvent(session, 'estimate_copilot_guide', { prompt: msgLowerEarly });
        console.log('✅ EARLY estimate copilot guide — returning immediately');
        return res.json({ reply: guideResult.reply, actions: [], suggestedFollowUps: guideResult.suggestedFollowUps || [] });
      }

      const isClientFacingEstimateReview =
        msgLowerEarly.includes('client-facing') ||
        msgLowerEarly.includes('client facing') ||
        msgLowerEarly.includes('send-readiness') ||
        msgLowerEarly.includes('send readiness') ||
        msgLowerEarly.includes('professional wording');
      if (isClientFacingEstimateReview) {
        const clientReview = buildEstimateClientReadyReview({ parsedContext, estimateData, projectName });
        trackEstimateSessionEvent(session, 'estimate_client_review', { prompt: msgLowerEarly });
        console.log('✅ EARLY estimate client-facing review — returning immediately');
        return res.json({ reply: clientReview.reply, actions: [], suggestedFollowUps: clientReview.suggestedFollowUps || [] });
      }

      if (msgLowerEarly.includes('proposal wording') || msgLowerEarly.includes('proposal summary')) {
        const wordingReview = buildEstimateProposalWordingReply({ estimateData, projectName });
        trackEstimateSessionEvent(session, 'estimate_proposal_wording', { prompt: msgLowerEarly });
        console.log('✅ EARLY estimate proposal wording — returning immediately');
        return res.json({ reply: wordingReview.reply, actions: [], suggestedFollowUps: wordingReview.suggestedFollowUps || [] });
      }

      if (msgLowerEarly.includes('check exclusions') || msgLowerEarly.includes('allowance notes') || msgLowerEarly.includes('what exclusions')) {
        const exclusionsReview = buildEstimateExclusionsReply({ estimateData });
        trackEstimateSessionEvent(session, 'estimate_exclusions_review', { prompt: msgLowerEarly });
        console.log('✅ EARLY estimate exclusions review — returning immediately');
        return res.json({ reply: exclusionsReview.reply, actions: [], suggestedFollowUps: exclusionsReview.suggestedFollowUps || [] });
      }
    }
    const isMissingCostScanEarly = msgLowerEarly.includes('missing cost') || msgLowerEarly.includes('missing costs') ||
      (msgLowerEarly.includes('scan') && msgLowerEarly.includes('cost')) || msgLowerEarly.includes('cost gaps');
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
    // "Goes longer than expected" / "projected profit if job goes long" — use default 2 weeks when no specific weeks given
    const hasDelayIntentNoWeeks = (msgLowerEarly.includes('goes longer') || msgLowerEarly.includes('longer than expected') || msgLowerEarly.includes('goes long') || msgLowerEarly.includes('goes too long')) &&
      (msgLowerEarly.includes('profit') || msgLowerEarly.includes('margin'));
    if (hasDelayIntentNoWeeks && extraWeeks === 0) extraWeeks = 2;
    const isWeeksOverrunRequest = extraWeeks > 0 && (hasWeeksOverrunIntent || hasDelayIntentNoWeeks);

    if (isWeeksOverrunRequest && extraWeeks > 0) {
      const contractVal = Number(contractValue || 0) || (Number(bidTotal || 0) + Number(approvedChangeOrdersTotal || 0));
      const actual = Number(actualCost || 0);
      const committedPOs = Number(parsedContext?.committedPOs ?? currentProjectData?.committedPOs ?? 0) ||
        (Array.isArray(currentProjectData?.purchaseOrders) ? currentProjectData.purchaseOrders
          .filter(po => (po?.status || '').toLowerCase() === 'pending')
          .reduce((s, po) => s + Number(po?.amount || 0), 0) : 0);
      const progressPct = Math.max(0, Math.min(100, Number(progress || 0)));
      const progressRatio = progressPct > 0 ? progressPct / 100 : 0;

      // Layer 1: Baseline forecast (progress-ratio for trend; NOT for delay scenario)
      const runRateCost = progressRatio > 0.01 && actual > 0 ? actual / progressRatio : 0;
      const baseForecastFinalCost = Math.max(actual + committedPOs, runRateCost > 0 ? runRateCost : (Number(estimatedCost || estimateData?.totalCost || estimateData?.baseCost || 0) || actual));

      // Layer 2: Delay scenario — explicit cost additions (labor, materials, overhead, equipment)
      const laborBudget = Number(estimateData?.laborTotal || parsedContext?.laborTotal || currentProjectData?.laborTotal || 0) ||
        (parsedContext.buckets || currentProjectData?.buckets || []).reduce((s, b) => {
          if ((b.name || '').toLowerCase().includes('labor')) return s + (Number(b.budget || b.bidBudget) || 0);
          return s;
        }, 0);
      const materialBudget = Number(estimateData?.materialTotal || parsedContext?.materialTotal || currentProjectData?.materialTotal || 0) ||
        (parsedContext.buckets || currentProjectData?.buckets || []).reduce((s, b) => {
          const n = (b.name || '').toLowerCase();
          if (n.includes('material') || n.includes('equipment') || (n.includes('materials') && !n.includes('labor'))) return s + (Number(b.budget || b.bidBudget) || 0);
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
      const weeklyMaterial = materialBudget > 0 ? materialBudget / estimatedWeeks : 0;
      const weeklyOverhead = overheadBudget > 0 ? overheadBudget / estimatedWeeks : 0;
      const addedLaborCost = Math.round(weeklyLabor * extraWeeks);
      const addedMaterialCost = Math.round(weeklyMaterial * extraWeeks);
      const addedOverheadCost = Math.round(weeklyOverhead * extraWeeks);
      const addedDelayCosts = addedLaborCost + addedMaterialCost + addedOverheadCost ||
        Math.round((laborBudget > 0 ? laborBudget / Math.max(estimatedWeeks, 4) : baseForecastFinalCost * 0.4 / 12) * extraWeeks);
      const scenarioForecastFinalCost = Math.round(baseForecastFinalCost + addedDelayCosts);
      const projectedProfit = Math.round(contractVal - scenarioForecastFinalCost);
      const projectedMargin = contractVal > 0 ? (projectedProfit / contractVal) * 100 : 0;
      const baselineProfit = Math.round(contractVal - baseForecastFinalCost);
      const weeklyDelayCost = weeklyLabor + weeklyMaterial + weeklyOverhead || (laborBudget / Math.max(estimatedWeeks, 4));
      const costPerWeekOfDelay = Math.round(weeklyDelayCost > 0 ? weeklyDelayCost : laborBudget / Math.max(estimatedWeeks, 4));
      const breakEvenDelayWeeks = costPerWeekOfDelay > 0 && baselineProfit > 0 ? (baselineProfit / costPerWeekOfDelay).toFixed(1) : null;

      let reply = `If this job goes **${extraWeeks} weeks too long**, your projected profit would be approximately **$${projectedProfit.toLocaleString()}** (${Number(projectedMargin).toFixed(1)}% margin).\n\n`;
      reply += `**Calculation (delay scenario — explicit cost additions):**\n`;
      if (startISO && endISO) {
        reply += `- Project duration: ~${estimatedWeeks} weeks (from schedule)\n`;
      }
      reply += `- Revenue (Contract Value): $${contractVal.toLocaleString()}\n`;
      reply += `- Baseline forecast cost (spend vs completion progress): $${Math.round(baseForecastFinalCost).toLocaleString()}\n`;
      reply += `- Baseline profit: $${baselineProfit.toLocaleString()}\n`;
      if (addedLaborCost > 0) reply += `- Extra labor for ${extraWeeks} weeks: ~$${addedLaborCost.toLocaleString()}\n`;
      if (addedMaterialCost > 0) reply += `- Extra materials for ${extraWeeks} weeks: ~$${addedMaterialCost.toLocaleString()}\n`;
      if (addedOverheadCost > 0) reply += `- Extra overhead for ${extraWeeks} weeks: ~$${addedOverheadCost.toLocaleString()}\n`;
      reply += `- **Total added delay cost:** ~$${addedDelayCosts.toLocaleString()}\n`;
      reply += `- **Scenario forecast cost:** $${Math.round(baseForecastFinalCost).toLocaleString()} + $${addedDelayCosts.toLocaleString()} = **$${scenarioForecastFinalCost.toLocaleString()}**\n`;
      reply += `- **Projected profit:** $${contractVal.toLocaleString()} − $${scenarioForecastFinalCost.toLocaleString()} = **$${projectedProfit.toLocaleString()}**\n\n`;
      if (costPerWeekOfDelay > 0) {
        reply += `**Profit decay:** Each additional week of delay costs approximately **$${costPerWeekOfDelay.toLocaleString()}** (labor + materials + overhead), reducing profit by the same amount.\n`;
        if (breakEvenDelayWeeks && parseFloat(breakEvenDelayWeeks) > 0) {
          reply += `Break-even delay: **${breakEvenDelayWeeks} weeks** — after that you start losing money.\n\n`;
        } else {
          reply += `\n`;
        }
      }
      reply += `[DISCLAIMER]Delay scenario uses explicit cost additions (labor, materials, overhead) — not progress-ratio forecasting. Schedule delays are modeled as additional expected cost.[/DISCLAIMER]\n\n`;
      reply += `➡️ Want me to run a what-if scenario (Typical Friction, Bad Remodel, or Job Runs Long) to pressure-test this?`;

      console.log('✅ EARLY delay-scenario profit projection (two-layer model) — returning immediately');
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

    // ── DETERMINISTIC: Simple margin/profit question → ALWAYS return short format (before profit block / router / LLM)
    const rawMsg = String(message ?? req?.body?.message ?? req?.body?.content ?? '').replace(/[\u2018\u2019]/g, "'");
    const msgForSimpleMargin = (normalizedMessage || rawMsg || '').toLowerCase();
    const hasProfitAndMargin = msgForSimpleMargin.includes('profit') && msgForSimpleMargin.includes('margin') && !msgForSimpleMargin.includes('forecast');
    const isSimpleMarginOrProfitQ = hasProfitAndMargin ||
      /\b(what is my|what'?s my|what is the)\s+(profit\s+)?margin\b/i.test(msgForSimpleMargin) ||
      /\b(what is my|what'?s my|what is the)\s+current\s+margin\b/i.test(msgForSimpleMargin) ||
      /\b(what is my|what'?s my)\s+profit\b/i.test(msgForSimpleMargin) ||
      /\bmargin\s+for\s+\w+/i.test(msgForSimpleMargin) ||
      /\bprofit\s+margin\s+for\s+\w+/i.test(msgForSimpleMargin);
    if (isSimpleMarginOrProfitQ) {
      // EARLY: When from Project Detail, use context's actualCost/contractValue directly — source of truth from Overview
      const ctxContract = Number(parsedContext.contractValue || parsedContext.bidTotal || 0);
      const ctxSpent = Number(parsedContext.actualCost ?? parsedContext.totalSpent ?? 0);
      const ctxSpendToDate = ctxContract > 0 ? Math.round(((ctxContract - ctxSpent) / ctxContract) * 1000) / 10 : null;
      // Also use allProjects when from Estimate Generator — get actualCost from matching project
      const projectsForEarly = Array.isArray(parsedContext.allProjects) ? parsedContext.allProjects : [];
      const matchForEarly = projectsForEarly.find(p => String(p?.id) === String(parsedContext.projectId));
      // Prefer top-level actualCost (injected when viewing existing project with live actuals) over allProjects
      const hasTopLevelActuals = parsedContext.hasLiveProjectContext === true ||
        (typeof parsedContext.actualCost === 'number' || typeof parsedContext.totalSpent === 'number');
      const earlySpent = parsedContext.screen === 'Project Detail'
        ? ctxSpent
        : (hasTopLevelActuals ? ctxSpent : (matchForEarly ? Number(matchForEarly.actualCost ?? matchForEarly.totalSpent ?? 0) : ctxSpent));
      const earlySpendToDate = ctxContract > 0 ? Math.round(((ctxContract - earlySpent) / ctxContract) * 1000) / 10 : null;
      const hasEarlyData = parsedContext.projectId && ctxContract > 0 && (
        parsedContext.screen === 'Project Detail' ||
        (parsedContext.screen === 'Estimate Generator' && (parsedContext.hasLiveProjectContext === true || earlySpent > 0))
      );
      if (hasEarlyData && earlySpendToDate != null) {
        const name = parsedContext.currentProject || parsedContext.projectName || parsedContext.bidTitle || 'This project';
        let projProfit = (typeof parsedContext.projectedProfit === 'number' && Number.isFinite(parsedContext.projectedProfit))
          ? Math.round(parsedContext.projectedProfit)
          : (typeof matchForEarly?.projectedProfit === 'number' ? Math.round(matchForEarly.projectedProfit) : null);
        if (projProfit == null && matchForEarly) {
          const prog = Math.max(0, Math.min(100, Number(matchForEarly.progress ?? matchForEarly.overallProgressPct ?? 0)));
          const estCost = Number(matchForEarly.estimatedCost || 0);
          const projCost = prog > 5 && earlySpent > 0 ? earlySpent / (prog / 100) : estCost;
          projProfit = ctxContract > 0 && projCost > 0 ? Math.round(ctxContract - projCost) : null;
        }
        if (projProfit == null) projProfit = ctxContract > 0 ? Math.round(ctxContract - earlySpent) : null;
        const projProfitStr = projProfit != null ? `$${projProfit.toLocaleString()}` : '—';
        let projPctVal = parsedContext.projectedMarginPct ?? matchForEarly?.projectedMarginPct;
        if (projPctVal == null && matchForEarly) {
          const prog = Math.max(0, Math.min(100, Number(matchForEarly.progress ?? matchForEarly.overallProgressPct ?? 0)));
          if (prog > 5 && earlySpent > 0) {
            const projCost = earlySpent / (prog / 100);
            projPctVal = ctxContract > 0 ? Math.round(((ctxContract - projCost) / ctxContract) * 1000) / 10 : null;
          }
        }
        const projPctValNum = typeof projPctVal === 'number' && Number.isFinite(projPctVal) ? projPctVal : null;
        const bidPctVal = parsedContext.bidMarginPct ?? parsedContext.projectInfo?.bidMarginPct ?? matchForEarly?.bidMarginPct;
        const reply = formatMarginReply({
          spendToDatePct: earlySpendToDate,
          projectedPct: projPctValNum,
          originalEstPct: bidPctVal,
          projectedProfit: projProfit,
        });
        console.log('✅ SIMPLE MARGIN: Using context/allProjects for', name, 'spend-to-date', earlySpendToDate + '%');
        return res.json({ reply, actions: [] });
      }

      const projects = Array.isArray(parsedContext.allProjects) ? parsedContext.allProjects
        : Array.isArray(parsedContext.projects) ? parsedContext.projects
        : Array.isArray(parsedContext.activeProjects) ? parsedContext.activeProjects
        : [];
      if (projects.length === 0) {
        console.log('🛡️ SIMPLE MARGIN: is margin Q but no projects in context; keys:', Object.keys(parsedContext).filter(k => /project|all/i.test(k)));
      }
      let targetProject = currentProjectData || null;
      if (!targetProject && projectId) targetProject = projects.find(p => String(p?.id) === String(projectId));
      if (!targetProject && projectName) targetProject = resolveProjectByQuery(projects, projectName, { minScore: 35 }).project;
      const projectNames = projects.map(p => (p?.title || p?.name || '').trim()).filter(Boolean);
      for (const name of projectNames) {
        if (name.length >= 2 && msgForSimpleMargin.includes(name.toLowerCase())) {
          targetProject = projects.find(p => (p?.title || p?.name || '').trim() === name);
          if (targetProject) break;
        }
      }
      if (!targetProject) {
        const forMatch = (message || '').match(/\b(?:for|on|about)\s+([A-Za-z][A-Za-z0-9\s\-']*?)(?:\s*\?|\s*$)/i);
        const nameFromMsg = forMatch ? forMatch[1].trim() : null;
        if (nameFromMsg && nameFromMsg.length >= 2) {
          targetProject = projects.find(p => {
            const t = (p?.title || p?.name || '').toLowerCase();
            const n = nameFromMsg.toLowerCase();
            return t.includes(n) || n.includes(t);
          });
        }
      }
      if (targetProject) {
        const isCurrent = isCurrentProjectMatch(targetProject, parsedContext);
        const name = targetProject.title || targetProject.name || 'This project';
        const marginResult = buildMarginReplyForProject(targetProject, {
          parsedContext,
          isCurrent,
          followUp: '➡️ Want a detailed breakdown of your margin, or check on any other upcoming payments or project details?',
        });
        const spendToDateStr = marginResult?.snapshot?.spendToDateMarginPct != null ? Number(marginResult.snapshot.spendToDateMarginPct).toFixed(1) + '%' : '—';
        console.log('✅ SIMPLE MARGIN: Returning deterministic short response for', name, 'spend-to-date', spendToDateStr);
        return res.json({ reply: marginResult?.reply || `I don't have ${name}'s data in this view. Open the project and ask again, or ask from the project screen.`, actions: [] });
      }
      if (projects.length > 0) {
        console.log('🛡️ SIMPLE MARGIN: no project matched; names in context:', projectNames.slice(0, 10));
      }
      // CRITICAL: Never fall through for simple margin/profit questions — return short reply so long format never appears
      const nameHint = (message || '').match(/\b(?:for|on|about)\s+([A-Za-z][A-Za-z0-9\s\-']*?)(?:\s*\?|\s*$)/i)?.[1]?.trim() || 'this project';
      const shortFallback = `I don't have ${nameHint}'s data in this view. Open the project and ask again, or ask from the project screen.`;
      console.log('🛡️ SIMPLE MARGIN: no project found — returning short fallback (never long response)');
      return res.json({ reply: shortFallback, actions: [] });
    }

    // ── DETERMINISTIC: Profit / Forecast (bypass LLM variability, use progress-adjusted logic) ─────────
    // Use normalized message so "profit margin" → "margin" — both get same treatment.
    // Only trigger detailed forecast for EXPLICIT forecast requests. Simple margin/profit questions
    // ("what is my margin", "what is my profit margin", "what is my profit") go to normal flow → simple answer.
    const msgForProfitCheck = (normalizedMessage || message || '').toLowerCase();
    const isExplicitForecastRequest =
      msgForProfitCheck.includes('forecast final profit') ||
      msgForProfitCheck.includes('forecast profit') ||
      msgForProfitCheck.includes('final profit') ||
      msgForProfitCheck.includes('forecast final cost') ||
      (msgForProfitCheck.includes('forecast') && msgForProfitCheck.includes('profit')) ||
      (msgForProfitCheck.includes('forecast') && msgForProfitCheck.includes('cost')) ||
      msgForProfitCheck.includes('forecast my') ||
      msgForProfitCheck.includes('run a forecast') ||
      msgForProfitCheck.includes('forecast for');
    const isSimpleMarginQ = (msgForProfitCheck.includes('profit') && msgForProfitCheck.includes('margin') && !msgForProfitCheck.includes('forecast')) ||
      /\b(what is my|what'?s my|what is the)\s+(profit\s+)?margin\b/i.test(msgForProfitCheck) ||
      /\b(what is my|what'?s my)\s+profit\b/i.test(msgForProfitCheck) ||
      /\bmargin\s+for\s+\w+/i.test(msgForProfitCheck);
    const isProfitOrForecastRequest = isExplicitForecastRequest && !isSimpleMarginQ;

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
      reply += `➡️ Want me to run a what-if scenario (Typical Friction, Bad Remodel, or Job Runs Long) to pressure-test this forecast?`;

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
    const bidMarginPctForPrompt = parsedContext.bidMarginPct ?? parsedContext.projectInfo?.bidMarginPct ?? (projectId && allProjects?.length ? (() => { const p = allProjects.find(pr => String(pr?.id) === String(projectId)); return p?.bidMarginPct; })() : undefined);
    const aiScope = parsedContext.aiScope || (parsedContext.screen === 'Project Detail' || (parsedContext.screen === 'Estimate Generator' && projectId) ? 'project' : 'portfolio');
    let systemPrompt = buildSystemPrompt({
      projectName, projectId, status,
      bidTotal, estimatedCost, actualCost,
      contractValue, approvedChangeOrdersTotal,
      bidMarginPct: typeof bidMarginPctForPrompt === 'number' ? bidMarginPctForPrompt : undefined,
      materialBudget, materialSpent, materialRemaining,
      laborBudget: laborBudgetMain, laborSpent: laborSpentMain, laborRemaining: laborRemainingMain,
      progress, aiPmMode, pmAlerts,
      screen: parsedContext.screen || 'assistant_tab',
      aiScope,
      teamMembers,
      teamStats,
      calendarEvents,
      upcomingCalendarEvents,
    });

    // Additive: projects-list intelligence block (Global AI Assistant + Projects screen).
    const screenForIntelligence = (parsedContext?.screen || '').toLowerCase();
    if (screenForIntelligence === 'projects' || screenForIntelligence === 'ai assistant tab') {
      // Always inject project status block so AI knows active vs completed (users can delete/change status)
      const projectStatusBlock = buildProjectStatusBlock(parsedContext);
      if (projectStatusBlock) systemPrompt += projectStatusBlock;

      // Inject comprehensive project data snapshot so AI can answer basic questions directly
      const dataSnapshot = buildProjectDataSnapshot(parsedContext);
      if (dataSnapshot) systemPrompt += dataSnapshot;

      const listAlerts = runProjectsListIntelligence(parsedContext);
      if (listAlerts.length > 0) {
        systemPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 PORTFOLIO INTELLIGENCE (grounded in real data — use these numbers)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${listAlerts.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\nRULES:\n→ Use these alerts as your source of truth for financial data — every number you cite must come from here or from tool results\n→ When user asks about portfolio health, profitability, or risks — reference these alerts directly\n→ Surface relevant insights proactively when they relate to the user's question\n→ When answering, always structure as: direct answer → supporting insight → suggested action\n→ Connect financial data to actionable recommendations\n→ If request is project-specific and ambiguous, ask one clear follow-up question\n→ Never dump all alerts at once — pick the most relevant ones for the user's question`;
      }

      // Inject calendar events from all projects into Command Center context
      const portfolioCalendarEvents = [];
      const allProjectsForCalendar = parsedContext?.allProjects || [];
      allProjectsForCalendar.forEach(p => {
        if (!isProjectActiveForCalendarEvents(p)) return;
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
        systemPrompt += `\n\n📅 UPCOMING EVENTS (dashboard calendar — **active projects only**; completed jobs excluded: inspections, deliveries, deadlines):\n${calItems}\n→ When user asks "upcoming events on the calendar" or "what's on the calendar": list THESE events (they are the dashboard calendar). Also include upcoming payments from compare_projects. Do NOT limit to one project.`;
      } else {
        systemPrompt += `\n\n📅 UPCOMING EVENTS: No calendar events in the next 7 days from **active** project calendars (dashboard; completed jobs excluded). When user asks "upcoming events on the calendar" or "what's on the calendar", use compare_projects to list upcoming PAYMENTS and deadlines across active projects — those are part of the calendar. Do NOT say "no events for [one project]". Do NOT limit to one project. List what you have from compare_projects (upcomingPayments per project).`;
      }
    } else {
      // Non-command-center screen (project detail, estimate, etc.) — still inject data snapshot
      // for the current project so AI has context for specific questions
      const dataSnapshot = buildProjectDataSnapshot(parsedContext);
      if (dataSnapshot) systemPrompt += dataSnapshot;
      const estimateWorkflowSnapshot = buildEstimateWorkflowSnapshot(parsedContext);
      if (estimateWorkflowSnapshot) systemPrompt += estimateWorkflowSnapshot;
    }

    // Inject conversation memory
    const memoryBlock = buildMemoryContext(session);
    if (memoryBlock) systemPrompt += memoryBlock;

    // Build messages array from history + new message
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.filter(m => m.role && m.content),
      { role: 'user', content: normalizedMessage },
    ];

    // When user asks about margin, inject exact original + current margin so AI always states both
    const marginHint = buildMarginAnswerHint(normalizedMessage, allProjects, projectName, projectId, currentProjectData, parsedContext);
    if (marginHint) {
      messages.splice(messages.length - 1, 0, { role: 'system', content: marginHint });
    }

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
          description: 'Compare projects for profitability, budget exposure, schedule risk, progress, and payment schedule. Use for "most profitable", "most over budget", "compare Chris vs Nick", and "when am I getting paid" / "next payment" — returns upcomingPayments and overduePayments per project. Each project has marginLabel and profitLabel — use them exactly: completed = "Margin" and "Net Profit"; active = "Current margin" and "Projected Profit".',
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
              activeOnly: {
                type: 'boolean',
                description: 'If true, exclude completed projects. Use for "What needs attention?", "focus today", "top priorities" — only list active projects.',
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
          description: 'Get a comprehensive health check for a specific project. Returns budget status, margin, risks, expense breakdown, overdue/upcoming payments, and recommendations. Use when user asks "how is [project] doing?", "health check on [project]", "status of [project]", "review [project]", "when am I getting paid on [project]", "what should I do next for [project]", "recommendations for [project]", or when user says "yes" to "Want a detailed breakdown of your margin" or asks for a "detailed breakdown" of margin. When presenting a DETAILED BREAKDOWN, you MUST include the three sections from detailedMarginBreakdown: (1) Margin breakdown — original vs current margin and how they are calculated, (2) Projected when job is completed — projected final cost, profit, and margin at completion, (3) How your margin can go down — list risks (cost overruns, missing receipts, budget burn rate, etc.). Prefer including the full detailedMarginBreakdown text from the tool result so the user gets margin detail, completion projection, and margin-down risks. Use financials.currentMarginPct for "current margin" (matches Projects page).',
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
          description: 'Forecast final cost, profit, and margin for one or all projects based on current spending rate. Use ONLY for explicit forecast requests: "forecast profit", "forecast final cost", "run a forecast", "what will the final cost be". Do NOT use for simple "what is my margin", "what is my profit margin", or "what is my profit" — those are answered directly from context.',
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
          description: 'Break down expenses by category, vendor, or month for one or all projects. Use when user asks "show expenses", "expense breakdown", "where am I spending", "biggest expenses", "who am I paying the most", "material vs labor", "cost breakdown", "top vendors".',
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
                description: 'For MATERIALS: the vendor/store (e.g., "Home Depot", "Lowe\'s"). REQUIRED - ask "Where was it purchased?" if missing. For LABOR: the trade (e.g., "Tile work", "Framing", "General Labor"). NEVER ask "vendor" for labor — ask "What trade and what was the work?" Trade and description go in vendor + notes. When user says "Bathroom, for tile work", use trade="Tile work" or "Tile", notes="Bathroom, for tile work".',
              },
              notes: {
                type: 'string',
                description: 'For LABOR: description of the work (e.g., "Bathroom tile installation", "Framing for addition"). Ask "What was the labor for?" or "Description of the work?" — NEVER ask for vendor or delivery date. For materials, optional.',
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
              scenario: { type: 'string', enum: ['labor_up_10', 'labor_down_10', 'materials_up_5', 'materials_up_10', 'materials_down_5', 'overhead_up_10', 'overhead_down_10', 'bid_up_2', 'bid_down_2', 'typical_friction', 'bad_remodel', 'smooth_job', 'job_runs_long', 'job_runs_long_4', 'job_runs_long_6', 'custom'], description: 'The scenario to run. Preset scenarios: typical_friction, bad_remodel, smooth_job, job_runs_long (2 weeks), job_runs_long_4 (4 weeks), job_runs_long_6 (6 weeks). Use "custom" only for arbitrary adjustments. REQUIRED - this is the ONLY required field.' },
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

    // Command Center tools: get_timeline_items for schedule questions (e.g. "schedule for Chris") — need projectId via get_project_by_name
    const isCommandCenter = ['projects', 'ai assistant tab'].includes(screenForIntelligence);
    const commandCenterTools = isCommandCenter && !pmTools.some(t => t.function.name === 'get_timeline_items') ? [
      {
        type: 'function',
        function: {
          name: 'get_timeline_items',
          description: 'Get timeline/milestones for a project. Use when user asks "schedule for [project]", "when is [project] due", "milestones on [project]", "payment schedule for [project]". Call get_project_by_name first to get projectId if needed.',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: 'Project ID. Use get_project_by_name to resolve project name to ID first.' },
            },
            required: ['projectId'],
          },
        },
      },
    ] : [];

    // Final tool list: core + PM tools (when on) + Command Center tools (schedule queries when PM off)
    const functions = [...coreTools, ...pmTools, ...commandCenterTools];

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

        const resolution = resolveProjectByQuery(allProjects, args.projectName);
        const ranked = resolution.ranked.map((entry) => ({ p: entry.project, score: entry.score, title: entry.title }));
        const best = resolution.best ? { p: resolution.best.project, score: resolution.best.score } : null;
        const second = resolution.second ? { p: resolution.second.project, score: resolution.second.score } : null;
        const confidence = resolution.confidence;
        const lowConfidence = resolution.lowConfidence;

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

        const found = resolution.project;
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

    // Helper function to compare projects (additive tool) — shared with /stream portfolio shortcuts
    async function executeCompareProjects(args = {}) {
      return runCompareProjectsPipeline({ allProjects, parsedContext, args });
    }

    // ── get_project_health executor ──────────────────────────────────────────
    async function executeGetProjectHealth(args = {}) {
      try {
        const normalize = (v) => {
          if (v == null) return 0;
          if (typeof v === 'string') { const n = Number(v.replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : 0; }
          const n = Number(v); return Number.isFinite(n) ? n : 0;
        };
        const match = resolveProjectByQuery(allProjects, args.projectName, { minScore: 35 }).project;
        if (!match) return { success: false, error: `Could not find project "${args.projectName}".` };

        const title = match.title || match.name || 'Project';
        const pid = String(match?.id ?? '');
        const titleKey = (match?.title || match?.name || '').toLowerCase().trim();
        const titleSlug = titleKey.replace(/\s+/g, '-');
        const progressOverride = parsedContext?.progressByProjectId?.[pid] ?? parsedContext?.progressByProjectId?.[titleKey] ?? parsedContext?.progressByProjectId?.[titleSlug]
          ?? (Array.isArray(parsedContext?.compareProjectsData) ? parsedContext.compareProjectsData.find((c) => (c?.title || '').toLowerCase().trim() === titleKey)?.progress : null);
        const financials = getProjectFinancialSnapshot({ project: match, parsedContext, progressOverride });
        const revenue = financials.revenue;
        const estCost = financials.estimatedCost;
        const spent = financials.spent;
        const progress = financials.progress;
        const approvedCOs = financials.approvedChangeOrders;
        const changeOrders = match?.changeOrders || match?.projectData?.changeOrders || [];
        const ed = match.estimateData || match.projectData?.estimateData || {};
        const expenses = match.expenses || match.projectData?.expenses || [];
        const milestonesRaw = getProjectMilestones(match, parsedContext, { preferParsedMilestones: true });
        const milestones = Array.isArray(milestonesRaw) ? milestonesRaw : [];

        // Log milestone data for debugging
        if (milestones.length > 0) {
          console.log(`📋 get_project_health milestones for "${title}":`, milestones.map(m => ({
            title: m?.title || m?.name, status: m?.status, state: m?.state,
            progressPct: m?.progressPct, progress: m?.progress, collected: m?.collected, isPaid: m?.isPaid,
            amount: m?.amount || m?.paymentAmount,
          })));
        }

        const materialBudget = normalize(ed?.materialTotal ?? 0) || sumLineItems(ed?.materialLineItems ?? ed?.materialsCart, normalize);
        const laborBudget = normalize(ed?.laborTotal ?? 0) || sumLineItems(ed?.laborLineItems, normalize);
        const materialSpent = sumExpensesByCategory(expenses, 'material', normalize);
        const laborSpent = sumExpensesByCategory(expenses, 'labor', normalize);

        const adjustedBudget = estCost > 0 ? estCost + approvedCOs : revenue;
        const marginPct = financials.bidMarginPct;
        const projectedFinalCost = financials.projectedFinalCost;
        const projectedProfit = financials.projectedProfit;
        const projectedMarginPct = financials.projectedMarginPct || 0;
        const budgetUsedPct = estCost > 0 ? (spent / estCost * 100) : 0;
        const spendToDateMarginPct = financials.spendToDateMarginPct != null ? financials.spendToDateMarginPct : marginPct;
        const currentMarginPct = financials.currentMarginPct != null ? financials.currentMarginPct : marginPct;

        const missingReceipts = expenses.filter(e => !e?.receiptUri || !String(e.receiptUri).trim()).length;
        const now = new Date();
        const projectStatus = String(match?.status || '').toLowerCase();
        const projectIsCompleted = projectStatus === 'completed' || projectStatus === 'done' || projectStatus === 'finished' || progress >= 100;
        const paymentBuckets = collectPaymentBuckets({
          parsedContext,
          projects: [],
          currentProject: match,
          now,
          currentProjectIsCompleted: projectIsCompleted,
        });
        const overdueItems = paymentBuckets.overdue;
        const upcomingPayments = paymentBuckets.upcoming;
        const unscheduledPayments = paymentBuckets.unscheduled.map((m) => ({ name: m.name, amount: normalize(m.amount ?? 0) }));

        const expByCategory = {};
        expenses.forEach(e => {
          const cat = e?.category || 'Other';
          expByCategory[cat] = (expByCategory[cat] || 0) + normalize(e?.amount ?? 0);
        });
        const topCosts = Object.entries(expByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([cat, amt]) => ({ category: cat, amount: Math.round(amt), percentage: spent > 0 ? Math.round(amt / spent * 100) : 0 }));

        const risks = [];
        if (!projectIsCompleted) {
          if (budgetUsedPct > progress + 20) risks.push(`Spending ${Math.round(budgetUsedPct)}% of budget but only ${Math.round(progress)}% complete`);
          if (marginPct > 0 && projectedMarginPct < marginPct - 5) risks.push(`Margin eroding: estimated ${Math.round(marginPct)}% → projected ${Math.round(projectedMarginPct)}%`);
          if (materialBudget > 0 && materialSpent > materialBudget) risks.push(`Material costs ${Math.round((materialSpent - materialBudget) / materialBudget * 100)}% over budget`);
          if (laborBudget > 0 && laborSpent > laborBudget) risks.push(`Labor costs ${Math.round((laborSpent - laborBudget) / laborBudget * 100)}% over budget`);
          if (overdueItems.length > 0) risks.push(`${overdueItems.length} overdue payment(s)`);
        }
        if (missingReceipts >= 3) risks.push(`${missingReceipts} expenses missing receipts`);
        if (projectIsCompleted && missingReceipts > 0 && missingReceipts < 3) risks.push(`${missingReceipts} expense(s) missing receipts (optional housekeeping)`);

        const marginLabel = projectIsCompleted ? 'Margin' : 'Current margin';
        const profitLabel = projectIsCompleted ? 'Net Profit' : 'Projected Profit';
        const finalProfit = projectIsCompleted ? (revenue - spent) : Math.round(projectedProfit);
        const finalMargin = projectIsCompleted ? (revenue > 0 ? ((revenue - spent) / revenue * 100) : currentMarginPct) : currentMarginPct;
        const healthMessage = projectIsCompleted
          ? `Health check for ${title}. **Completed.** ${marginLabel}: ${Math.round(finalMargin * 10) / 10}%, ${profitLabel}: $${Math.round(finalProfit).toLocaleString()}. Do NOT suggest next steps or forecast — job is done. You may mention missing receipts as optional housekeeping only.`
          : `Health check for ${title}. ${marginLabel}: ${Math.round(currentMarginPct * 10) / 10}% spend-to-date. Projected margin at completion: ${Math.round(projectedMarginPct * 10) / 10}%. PAYMENT QUESTIONS ("when am I getting paid next", "payments", "next payment"): Answer from TIMELINE data — upcomingPayments, overduePayments, unscheduledPayments. Format: "Your next payment is the [payment name] for the ${title} project, amounting to $[amount], due on [date]." Use exact name, amount, date from the data. You may end with: "Want me to check on any other upcoming payments or project details?" If no dated payments but unscheduledPayments has items, list them and say they can set dates in the Timeline. If all empty, say payments are set in the Timeline tab (Projects → ${title} → Timeline) and suggest opening it to sync. Never say "no upcoming payments" without that guidance.`;

        // Structured detailed margin breakdown for "yes" / "detailed breakdown" follow-up (margin, projected at completion, how margin can go down)
        const marginDetailNote = progress > 5 && spent > 0
          ? `Current margin is spend-to-date based on $${Math.round(spent).toLocaleString()} spent against $${Math.round(revenue).toLocaleString()} in revenue. If spending continues at the same run-rate, projected final cost would be $${Math.round(projectedFinalCost).toLocaleString()} at ${Math.round(progress)}% progress, for a projected margin at completion of ${Math.round(projectedMarginPct * 10) / 10}%.`
          : `Current margin matches your bid margin (${Math.round(marginPct * 10) / 10}%) because there's little spend so far ($${Math.round(spent).toLocaleString()} of $${Math.round(estCost || revenue).toLocaleString()} budget).`;
        let detailedMarginBreakdown = `**Detailed margin breakdown for ${title}**\n\n` +
          `**1. Margin breakdown**\n` +
          `• Original (bid) margin from your estimate: ${Math.round(marginPct * 10) / 10}%\n` +
          `• Current margin (spend-to-date): ${Math.round(currentMarginPct * 10) / 10}%\n` +
          `• ${marginDetailNote}\n` +
          `• Revenue: $${Math.round(revenue).toLocaleString()} | Spent: $${Math.round(spent).toLocaleString()} of $${Math.round(estCost || adjustedBudget).toLocaleString()} budget | Progress: ${Math.round(progress)}%\n\n` +
          `**2. Projected when job is completed**\n` +
          `• Projected final cost: $${Math.round(projectedFinalCost).toLocaleString()}\n` +
          `• Projected profit at completion: $${Math.round(projectedProfit).toLocaleString()}\n` +
          `• Projected margin at completion: ${Math.round(projectedMarginPct * 10) / 10}%\n\n` +
          `**3. How your margin can go down**\n`;
        if (risks.length > 0) {
          detailedMarginBreakdown += risks.map(r => `• ${r}`).join('\n');
        } else {
          detailedMarginBreakdown += `• Cost overruns (spending more than budget before job completes) would reduce profit and margin.\n` +
            `• Missing or late receipts make it harder to track actual costs and can affect reported margin.\n` +
            (missingReceipts > 0 ? `• You have ${missingReceipts} expense(s) missing receipts — attaching them keeps your records accurate.\n` : '');
        }
        if (upcomingPayments.length > 0) {
          detailedMarginBreakdown += `\n\n**Upcoming payments**\n` +
            upcomingPayments.slice(0, 5).map((p, i) => `${i + 1}. ${p.name}: $${Math.round(p.amount || 0).toLocaleString()}${p.date ? ` due ${typeof p.date === 'string' ? p.date : new Date(p.date).toLocaleDateString()}` : ''}`).join('\n');
        }

        return {
          success: true,
          project: title,
          status: match.status || 'unknown',
          isCompleted: projectIsCompleted,
          marginLabel,
          profitLabel,
          netProfit: projectIsCompleted ? Math.round(revenue - spent) : null,
          message: healthMessage,
          detailedMarginBreakdown,
          financials: {
            revenue, estimatedCost: estCost, actualSpent: spent,
            adjustedBudget: Math.round(adjustedBudget),
            budgetUsedPct: Math.round(budgetUsedPct),
            estimatedMarginPct: Math.round(marginPct * 10) / 10,
            currentMarginPct: Math.round(currentMarginPct * 10) / 10,
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
          overdueItems: overdueItems.map(m => ({ name: m.name || 'Payment', amount: normalize(m.amount ?? 0) })),
          upcomingPayments: upcomingPayments.map(m => ({ name: m.name || 'Payment', amount: normalize(m.amount ?? 0), date: m.date })),
          unscheduledPayments,
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
          candidates = candidates.filter(p => resolveProjectByQuery([p], searchName, { minScore: 35 }).project);
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
          candidates = candidates.filter(p => resolveProjectByQuery([p], searchName, { minScore: 35 }).project);
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
      
      // If this is clearly an expense logging request without type, return early with green-card options
      if (preRouterIsExpenseLogging && !preRouterHasExpenseType) {
        console.log('🛑 PRE-ROUTER: Detected expense logging without type → returning expense type cards');
        const expenseTypeOptions = [
          { id: 'materials', title: 'Materials', subtitle: 'Category, vendor, amount' },
          { id: 'labor', title: 'Labor', subtitle: 'Trade, description, amount' },
          { id: 'equipment', title: 'Equipment', subtitle: 'Rental or purchase' },
          { id: 'permit', title: 'Permit', subtitle: 'Permit fees' },
          { id: 'other', title: 'Other', subtitle: 'Custom category' },
        ];
        return res.json({
          reply: 'What type of expense are you logging?',
          actions: [],
          projectUpdateData: null,
          expenseTypeSelectionOptions: expenseTypeOptions,
        });
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

    // ── PRE-ROUTER: "ALL OF THEM" / "ALL" = run all three scenario presets ──
    // When last assistant message asked for scenario choice (Typical Friction / Bad Remodel / Smooth Job),
    // and user says "all of them", "all", "yes" (all), etc., force all_presets so we never re-ask.
    const lastAssistantForScenario = String([...messages].reverse().find((m) => m?.role === 'assistant')?.content || [...messages].reverse().find((m) => m?.role === 'assistant')?.text || '').toLowerCase();
    const assistantAskedScenarioChoice = lastAssistantForScenario.includes('typical friction') && lastAssistantForScenario.includes('bad remodel') && lastAssistantForScenario.includes('smooth job');
    const userWantsAllScenarios = /\b(all\s+of\s+them|all\s+three|all\s+the\s+scenarios?|I\s+want\s+all|show\s+me\s+all|give\s+me\s+all|every\s+one|each\s+one)\b/i.test(String(message || '').trim()) ||
      /^\s*all\s*\.?\s*$/i.test(String(message || '').trim()) ||
      // "Yes" / "Yeah" / "Yep" after "which scenario?" → treat as "run all three"
      /^\s*(yes|yeah|yep|sure|ok|okay|please)\s*\.?\s*$/i.test(String(message || '').trim());
    if (assistantAskedScenarioChoice && userWantsAllScenarios) {
      req._forceScenarioAllPresets = true;
      console.log('🛡️ PRE-ROUTER: User said "all" after scenario choice → forcing all_presets');
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
    
    // Check if expense type is already specified (materials/labor) or from green-card selection
    const expenseTypeFromCards = parsedContext?.expenseTypeSelectionResume && parsedContext?.selectedExpenseType;
    const hasExpenseType = expenseTypeFromCards ||
      /\b(material|materials|labor|labour|equipment|permit|other)\b/i.test(combinedMessageForExpense);
    
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

    // PRE-ROUTER: "Where am I losing money" / "profit leaks" → never call router, force compare_projects so we never get "which project?"
    const losingMoneyPreCheck = isPortfolioLosingMoneyQuery(messageLower);
    // PRE-ROUTER: "Completed projects" / "yes completed projects" / "review completed" → force compare_projects(status: completed); AI already knows completed list
    const completedProjectsPreCheck = /\b(yes\s+)?(completed\s+projects?|completed\s+jobs?|review\s+(my\s+)?completed|(where|how)\s+(did\s+I\s+)?(lose|make)\s+(money\s+)?(on\s+)?completed|profit\s+(on\s+)?completed|compare\s+(my\s+)?completed)\b/i.test(messageLower);
    // PRE-ROUTER: "Which projects are over budget" → compare with sortBy overBudget; AI already knows projects
    const overBudgetPreCheck = isPortfolioOverBudgetListQuery(messageLower);
    const compareActivePreCheck = isPortfolioCompareActiveQuery(messageLower);
    const worstProjectPreCheck = isPortfolioWorstProjectQuery(messageLower);
    let routerResult;
    if (losingMoneyPreCheck) {
      console.log('🛡️ PRE-ROUTER: Losing money / profit leak intent → skipping router, forcing compare_projects (activeOnly)');
      routerResult = {
        domain: 'portfolio',
        proposed_tool: 'compare_projects',
        tool_args_draft: { activeOnly: true },
        required_fields_missing: [],
        clarification_question: null,
        confidence: 0.99,
        _losingMoneyIntent: true,
      };
    } else if (completedProjectsPreCheck) {
      console.log('🛡️ PRE-ROUTER: Completed projects intent → skipping router, forcing compare_projects (status: completed)');
      routerResult = {
        domain: 'portfolio',
        proposed_tool: 'compare_projects',
        tool_args_draft: { status: 'completed' },
        required_fields_missing: [],
        clarification_question: null,
        confidence: 0.99,
        _completedProjectsIntent: true,
      };
    } else if (overBudgetPreCheck) {
      console.log('🛡️ PRE-ROUTER: Over budget intent → skipping router, forcing compare_projects (active + completed, sortBy overBudget)');
      routerResult = {
        domain: 'portfolio',
        proposed_tool: 'compare_projects',
        tool_args_draft: { sortBy: 'overBudget' },
        required_fields_missing: [],
        clarification_question: null,
        confidence: 0.99,
        _overBudgetIntent: true,
      };
    } else if (compareActivePreCheck) {
      console.log('🛡️ PRE-ROUTER: Compare active projects → skipping router, forcing compare_projects (activeOnly)');
      routerResult = {
        domain: 'portfolio',
        proposed_tool: 'compare_projects',
        tool_args_draft: { activeOnly: true },
        required_fields_missing: [],
        clarification_question: null,
        confidence: 0.99,
        _compareActiveIntent: true,
      };
    } else if (worstProjectPreCheck) {
      console.log('🛡️ PRE-ROUTER: Worst / lowest margin project → skipping router, forcing compare_projects (activeOnly, sortBy lowMargin)');
      routerResult = {
        domain: 'portfolio',
        proposed_tool: 'compare_projects',
        tool_args_draft: { activeOnly: true, sortBy: 'lowMargin' },
        required_fields_missing: [],
        clarification_question: null,
        confidence: 0.99,
        _worstProjectIntent: true,
      };
    } else if (/\b(upcoming\s+events?\s+on\s+the\s+calendar|events?\s+on\s+the\s+calendar|what'?s\s+on\s+the\s+calendar|calendar\s+events?|upcoming\s+calendar)\b/i.test(messageLower)) {
      console.log('🛡️ PRE-ROUTER: Calendar / upcoming events intent → forcing compare_projects (dashboard calendar = inspections, deadlines, payments)');
      routerResult = {
        domain: 'portfolio',
        proposed_tool: 'compare_projects',
        tool_args_draft: {},
        required_fields_missing: [],
        clarification_question: null,
        confidence: 0.99,
        _calendarEventsIntent: true,
      };
    } else {
      routerResult = await withTimeout(runRouter(
        normalizedMessage,
        history,
        {
          projectName,
          projectId,
          activeTab,
          pmMode: aiPmMode,
          inDailyLogFlow: inDailyLogContextForExpense,
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
    }

    // ── CRITICAL: "MY COMPLETED PROJECTS" SCOPE OVERRIDE ─────────────────────
    // When assistant asked "which project?" and user says "my completed projects" — they mean SCOPE (aggregate), not a project name
    const assistantAskedWhichProject = /(?:which project|what project|which one|which job).*(?:mean|referring|talking about)/i.test(lastAssistantMsg) ||
      /(?:which|what) project\s*(?:do you|do they)?\s*mean/i.test(lastAssistantMsg);
    const userSaidScopeClarification = /\b(my completed projects|completed projects|completed jobs|all my jobs|all of them|all completed|from my completed|the completed ones|all projects)\b/i.test(messageLower);
    if (assistantAskedWhichProject && userSaidScopeClarification) {
      const wantCompletedOnly = /\b(completed|done|finished)\b/i.test(messageLower);
      console.log('🛡️ SCOPE OVERRIDE: User clarified scope → forcing compare_projects', wantCompletedOnly ? '(status=completed)' : '(all projects)');
      routerResult.domain = 'portfolio';
      routerResult.proposed_tool = 'compare_projects';
      routerResult.tool_args_draft = { ...(routerResult.tool_args_draft || {}), ...(wantCompletedOnly ? { status: 'completed' } : {}) };
      routerResult.required_fields_missing = [];
      routerResult.clarification_question = null;
      routerResult.confidence = 0.99;
    }

    // ── CRITICAL: "REVIEW / UPDATE ON [NAME]" = PROJECT HEALTH, NOT MESSAGE ───
    // "Give me update on Chris", "review of Chris", "review Chris job" = get_project_health(Chris), not message_team_member
    const reviewUpdateMatch = messageLower.match(/(?:update on|review of|review on|give me (?:a )?review of|review)\s+([a-z]+)(?:\s+job)?/i) ||
      messageLower.match(/(?:how is|how'?s|status of)\s+([a-z]+)\s*(?:doing|going)?/i);
    const projectNameForReview = reviewUpdateMatch ? reviewUpdateMatch[1].trim() : null;
    const isReviewUpdateIntent = projectNameForReview && projectNameForReview.length >= 2 &&
      (/\b(?:update on|review of|review on|give me (?:a )?review of|review|how is|how'?s|status of)\s+[a-z]+/i.test(messageLower));
    if (isReviewUpdateIntent && (routerResult.proposed_tool === 'message_team_member' || routerResult.domain === 'team')) {
      console.log('🛡️ REVIEW/UPDATE OVERRIDE: User asked for project review/update on', projectNameForReview, '→ forcing get_project_health');
      routerResult.domain = 'portfolio';
      routerResult.proposed_tool = 'get_project_health';
      routerResult.tool_args_draft = { ...(routerResult.tool_args_draft || {}), projectName: projectNameForReview };
      routerResult.required_fields_missing = [];
      routerResult.clarification_question = null;
      routerResult.confidence = 0.99;
    }

    // When user says "yes" (or similar) after assistant offered "Want a detailed breakdown of your margin", run get_project_health for the project from the prior message (e.g. Jerry)
    const messageTrimmed = (message || '').trim();
    const assistantOfferedDetailedBreakdown = lastAssistantMsg.includes('detailed breakdown') && (lastAssistantMsg.includes('want') || lastAssistantMsg.includes('margin'));
    const userSaidYesToBreakdown = /^\s*(yes|yeah|yep|sure|please|ok|okay|detailed breakdown|give me (?:the )?detailed breakdown)\s*$/i.test(messageTrimmed);
    if (assistantOfferedDetailedBreakdown && userSaidYesToBreakdown && Array.isArray(allUserMessages) && allUserMessages.length >= 1) {
      // Previous user message (before "yes") was the margin question, e.g. "What is my profit margin for Jerry?"
      const lastUserContent = (allUserMessages[allUserMessages.length - 1]?.content ?? allUserMessages[allUserMessages.length - 1]) || '';
      const prevUserMsg = String(allUserMessages.length >= 2 ? (allUserMessages[allUserMessages.length - 2]?.content ?? allUserMessages[allUserMessages.length - 2]) : lastUserContent).trim();
      const forMatch = prevUserMsg.match(/\b(?:for|on|about)\s+([A-Za-z][A-Za-z0-9\s\-']*?)(?:\s*\?|\s*$)/i);
      const projectFromPrev = forMatch ? forMatch[1].trim() : null;
      if (projectFromPrev && projectFromPrev.length >= 2) {
        console.log('🛡️ DETAILED BREAKDOWN YES: User said yes to detailed breakdown → get_project_health for', projectFromPrev);
        routerResult.domain = 'portfolio';
        routerResult.proposed_tool = 'get_project_health';
        routerResult.tool_args_draft = { ...(routerResult.tool_args_draft || {}), projectName: projectFromPrev };
        routerResult.required_fields_missing = [];
        routerResult.clarification_question = null;
        routerResult.confidence = 0.99;
      }
    }

    // When user says only "Chris" (or similar) and assistant had asked "which project?" after a review request, treat as project name for get_project_health
    const lastUserMsgBeforeThis = allUserMessages[allUserMessages.length - 2];
    const priorUserHadReviewIntent = lastUserMsgBeforeThis && /\b(?:review|update|see the review)\b/i.test(String(lastUserMsgBeforeThis));
    if (priorUserHadReviewIntent && assistantAskedWhichProject && messageTrimmed.length >= 2 && messageTrimmed.length <= 20 && !/\b(?:message|text|say to|send to)\b/i.test(messageTrimmed)) {
      const possibleProjectName = messageTrimmed.replace(/\s+job\s*$/i, '').trim();
      if (possibleProjectName && !/^\d+$/.test(possibleProjectName)) {
        console.log('🛡️ REVIEW FOLLOW-UP OVERRIDE: User specified project name after "which project?" → get_project_health', possibleProjectName);
        routerResult.domain = 'portfolio';
        routerResult.proposed_tool = 'get_project_health';
        routerResult.tool_args_draft = { ...(routerResult.tool_args_draft || {}), projectName: possibleProjectName };
        routerResult.required_fields_missing = [];
        routerResult.clarification_question = null;
        routerResult.confidence = 0.99;
      }
    }

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
        routerResult.clarification_question = 'What type of expense are you logging?';
        routerResult.expenseTypeSelectionOptions = [
          { id: 'materials', title: 'Materials', subtitle: 'Category, vendor, amount' },
          { id: 'labor', title: 'Labor', subtitle: 'Trade, description, amount' },
          { id: 'equipment', title: 'Equipment', subtitle: 'Rental or purchase' },
          { id: 'permit', title: 'Permit', subtitle: 'Permit fees' },
          { id: 'other', title: 'Other', subtitle: 'Custom category' },
        ];
        routerResult.confidence = 0.95;
        console.log('🛡️ Expense guard: overriding router to ask for expense type (with cards)');
      }
    } else if (isDailyLogDomain) {
      console.log('🛡️ Daily log protection: router says daily_log, blocking expense guard override');
    }

    // ── SCENARIO-ANALYSIS GUARD ──────────────────────────────────────────────
    // For generic "what if" requests, ask user to pick one preset scenario.
    // If user picks one, run immediately with no extra questions.
    const scenarioIntentRegex = /\b(what\s*if|scenario analysis|run a scenario analysis|run scenario analysis|project outcome scenario|outcome scenario)\b/i;
    const profitScenariosIntentRegex = /\b(what is my profit scenarios?|what are my profit scenarios?|(show me\s+)(the\s+)?profit scenarios?|(tell me|give me)\s+(my\s+)?(the\s+)?profit scenarios?|profit scenarios?)\b/i;
    const delayOverrunIntentRegex = /\b(delay(?:ed)?|overrun|too\s+long|longer|beyond\s+(?:the\s+)?(?:timeline|schedule)|go(?:es|ing)?\s+on\s+too\s+long|run(?:s|ning)?\s+long|extends?)\b/i;
    const delayOverrunContext = delayOverrunIntentRegex.test(String(message || '')) ||
      [...history]
        .slice(-6)
        .some((m) => m?.role === 'user' && delayOverrunIntentRegex.test(String(m?.content || '')));
    const lastAssistantScenarioMsg = String(
      [...history].reverse().find((m) => m?.role === 'assistant')?.content ||
      [...history].reverse().find((m) => m?.role === 'assistant')?.text || ''
    ).toLowerCase();
    const lastAssistantAskedScenarioChoice =
      lastAssistantScenarioMsg.includes('typical friction') &&
      lastAssistantScenarioMsg.includes('bad remodel') &&
      lastAssistantScenarioMsg.includes('smooth job');
    // PRE-ROUTER set this when user said "all of them" / "all" / "yes" after scenario choice
    const forceAllPresets = req._forceScenarioAllPresets === true;
    const scenarioChoiceMap = [
      { regex: /\btypical_friction\b/i, value: 'typical_friction' }, // From card id
      { regex: /\btypical\s*friction\b/i, value: 'typical_friction' },
      { regex: /\btypical\s+friction\b/i, value: 'typical_friction' }, // Match with space
      { regex: /\btypical\b/i, value: 'typical_friction' }, // Match just "typical" if in scenario context
      { regex: /\bbad_remodel\b/i, value: 'bad_remodel' }, // From card id
      { regex: /\bbad\s*remodel\b/i, value: 'bad_remodel' },
      { regex: /\bbad\s+remodel\b/i, value: 'bad_remodel' }, // Match with space
      { regex: /\bsmooth_job\b/i, value: 'smooth_job' }, // From card id
      { regex: /\bsmooth\s*job\b/i, value: 'smooth_job' },
      { regex: /\bsmooth\s+job\b/i, value: 'smooth_job' }, // Match with space
      { regex: /\bjob_runs_long_4\b/i, value: 'job_runs_long_4' }, // From card id
      { regex: /\bjob_runs_long_6\b/i, value: 'job_runs_long_6' }, // From card id
      { regex: /\bjob_runs_long\b/i, value: 'job_runs_long' }, // From card id (must be after _4, _6)
      { regex: /\bjob\s+runs?\s+long\s+4\s*weeks?\b/i, value: 'job_runs_long_4' },
      { regex: /\bjob\s+runs?\s+long\s+6\s*weeks?\b/i, value: 'job_runs_long_6' },
      { regex: /\b4\s*weeks?\s+(?:too\s+long|long|delay)\b/i, value: 'job_runs_long_4' },
      { regex: /\b6\s*weeks?\s+(?:too\s+long|long|delay)\b/i, value: 'job_runs_long_6' },
      { regex: /\bjob\s+runs?\s+long\b/i, value: 'job_runs_long' },
      { regex: /\bruns?\s+long\b/i, value: 'job_runs_long' },
      { regex: /\bgoes?\s+(on\s+)?(too\s+)?long\b/i, value: 'job_runs_long' },
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
    let selectedScenario = scenarioChoiceMap.find(({ regex }) => regex.test(String(message || '')))?.value || null;
    // User tapped a scenario card — use selected scenario from context
    if (parsedContext?.scenarioSelectionResume && parsedContext?.selectedScenario) {
      selectedScenario = parsedContext.selectedScenario;
      console.log('🛡️ Scenario guard: user selected from card', selectedScenario);
    }
    const isGenericScenarioRequest =
      (scenarioIntentRegex.test(String(message || '')) || profitScenariosIntentRegex.test(String(message || ''))) &&
      !selectedScenario &&
      !delayOverrunContext;
    // "What are my profit scenarios" / "show me profit scenarios" etc. → run all three immediately (same response as What If button + Yes)
    const isDirectProfitScenariosAsk = profitScenariosIntentRegex.test(String(message || '').trim());
    // User said "all" / "all of them" / "yes" / "yes all of them" (after "which scenario?") → run all three presets
    const msgTrim = String(message || '').trim().toLowerCase();
    const shortAffirmative = /^\s*(yes|yeah|yep|sure|ok|okay|please)\s*\.?\s*$/i.test(String(message || '').trim());
    const yesPlusAll = /\b(yes|yeah|yep|ok|sure)\s+(all|all\s+of\s+them)\b/i.test(msgTrim) || /\b(all\s+of\s+them|all\s+three)\b/i.test(msgTrim);
    const wantsAllScenarios = (lastAssistantAskedScenarioChoice || isGenericScenarioRequest) &&
      (/\b(all|all of them|all three|all the scenarios?|I want all|show me all|give me all|every one|each one)\b/i.test(msgTrim) || (lastAssistantAskedScenarioChoice && shortAffirmative) || yesPlusAll);
    const effectiveScenario = (forceAllPresets || wantsAllScenarios || isDirectProfitScenariosAsk) ? 'all_presets' : selectedScenario;
    // CRITICAL: If user selected a scenario (even without "what if" in message), activate flow
    const isScenarioFlowActive = !!effectiveScenario || (!delayOverrunContext && (isGenericScenarioRequest || lastAssistantAskedScenarioChoice));

    if (isScenarioFlowActive) {
      routerResult.domain = 'scenario_analysis';
      routerResult.proposed_tool = 'run_scenario_analysis';
      routerResult.tool_args_draft = routerResult.tool_args_draft || {};

      if (effectiveScenario) {
        routerResult.tool_args_draft.scenario = effectiveScenario;
        routerResult.required_fields_missing = [];
        routerResult.clarification_question = null;
        routerResult.confidence = 1.0;
        routerResult.action = 'execute';
        console.log('🛡️ Scenario guard: scenario selected, executing', effectiveScenario);
      } else {
        routerResult.required_fields_missing = ['scenario'];
        routerResult.clarification_question = 'Which scenario would you like to run?';
        routerResult.scenarioSelectionOptions = [
          { id: 'typical_friction', title: 'Typical Friction', subtitle: 'Labor +8%, materials +5%, overhead +3%' },
          { id: 'bad_remodel', title: 'Bad Remodel', subtitle: 'Labor +20%, materials +15%, overhead +10%' },
          { id: 'smooth_job', title: 'Smooth Job', subtitle: 'Labor -5%, materials -3%' },
          { id: 'job_runs_long', title: 'Job Runs Long (2 weeks)', subtitle: '2 extra weeks of burn' },
          { id: 'job_runs_long_4', title: 'Job Runs Long (4 weeks)', subtitle: '4 extra weeks of burn' },
        ];
        routerResult.confidence = 0.99;
        console.log('🛡️ Scenario guard: asking user to choose scenario preset (with cards)');
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
    // When user is in payment follow-up (e.g. "Weekly 2" after we asked which payment), preserve project context:
    // Use lastOpenedProjectId/projectId to enrich parsedContext with the selected project's milestones so we don't lose context.
    const lastAssistantPaymentMsgForGuard = String(
      [...history].reverse().find((m) => m?.role === 'assistant')?.content || ''
    ).toLowerCase();
    const lastAssistantAskedWhichPaymentForGuard =
      (lastAssistantPaymentMsgForGuard.includes('which milestone') ||
       lastAssistantPaymentMsgForGuard.includes('which payment') ||
       lastAssistantPaymentMsgForGuard.includes('specify which')) &&
      (lastAssistantPaymentMsgForGuard.includes('collected') || lastAssistantPaymentMsgForGuard.includes('completed') || lastAssistantPaymentMsgForGuard.includes('paid'));
    const paymentContextForGuard =
      lastAssistantAskedWhichPaymentForGuard && currentProjectData && !parsedContext.currentProject
        ? { ...parsedContext, currentProject: currentProjectData, projectId }
        : parsedContext;
    const pendingPaymentMilestones = getPendingPaymentMilestones(paymentContextForGuard);
    const paymentCollectIntentRegex = /\b(mark|set|record|make).*(payment|deposit|milestone).*(collected|complete|paid)|\b(payment collected|collected payment|mark a payment as collected|make a payment as completed|got paid|received payment|mark collected)\b/i;
    const lastAssistantPaymentMsg = String(
      [...history].reverse().find((m) => m?.role === 'assistant')?.content || ''
    ).toLowerCase();
    const lastAssistantAskedWhichPayment =
      (lastAssistantPaymentMsg.includes('which milestone') ||
       lastAssistantPaymentMsg.includes('which payment') ||
       lastAssistantPaymentMsg.includes('specify which')) &&
      (lastAssistantPaymentMsg.includes('collected') || lastAssistantPaymentMsg.includes('completed') || lastAssistantPaymentMsg.includes('paid'));
    const lastAssistantAskedPaymentConfirmation =
      (lastAssistantPaymentMsg.includes('mark ') && (lastAssistantPaymentMsg.includes('as collected') || lastAssistantPaymentMsg.includes('as completed') || lastAssistantPaymentMsg.includes('as paid'))) ||
      lastAssistantPaymentMsg.includes('as collected?') || lastAssistantPaymentMsg.includes('as completed?') || lastAssistantPaymentMsg.includes('as paid?');
    // Support both double and single quotes (e.g. "Week 4 Payment" or 'Week 4 Payment')
    const matchFromConfirmationMsg = lastAssistantAskedPaymentConfirmation && /mark\s+["']([^"']+)["']\s+as\s+(?:collected|completed|paid)/i.test(lastAssistantPaymentMsg)
      ? lastAssistantPaymentMsg.match(/mark\s+["']([^"']+)["']\s+as\s+(?:collected|completed|paid)/i)?.[1]
      : null;
    const paymentSelectionResumeHint = parsedContext?.paymentSelectionResume === true && parsedContext?.selectedPaymentName;
    const isPaymentCollectionFlowActive =
      paymentSelectionResumeHint ||
      paymentCollectIntentRegex.test(String(message || '').toLowerCase()) ||
      routerResult?.proposed_tool === 'mark_payment_collected' ||
      lastAssistantAskedWhichPayment ||
      lastAssistantAskedPaymentConfirmation;

    if (isPaymentCollectionFlowActive) {
      routerResult.domain = 'timeline';
      routerResult.proposed_tool = 'mark_payment_collected';
      routerResult.tool_args_draft = routerResult.tool_args_draft || {};

      const userText = String(message || '').trim();
      // When frontend sends paymentSelectionResume, user tapped a payment card — treat as responding to "which payment?"
      const assistantAlreadyAsked = lastAssistantAskedWhichPayment || paymentSelectionResumeHint;
      
      // Check if user is confirming (after we've matched a payment)
      const isConfirmation = /^(yes|yep|ok|okay|confirm|proceed|go ahead|do it|mark it)$/i.test(userText);
      const hasMatchedPaymentInDraft = routerResult.tool_args_draft.milestoneName;
      // When user confirms after "Mark X as completed?", extract X from prior assistant message
      let candidateNameForConfirm = (isConfirmation && matchFromConfirmationMsg) ? matchFromConfirmationMsg : null;
      // Fallback: if regex didn't match (e.g. different quote style), use last user message before "Yes" (the payment they selected)
      if (isConfirmation && !candidateNameForConfirm && lastAssistantAskedPaymentConfirmation) {
        const hist = Array.isArray(history) ? history : [];
        const lastUserMsg = [...hist].reverse().find((m) => m?.role === 'user')?.content || '';
        const lastUserTrim = String(lastUserMsg || '').trim();
        if (lastUserTrim && !/^(yes|yep|ok|okay|confirm|proceed|go ahead|do it|mark it)$/i.test(lastUserTrim)) {
          candidateNameForConfirm = lastUserTrim;
        }
      }
      const matchedFromConfirmation = candidateNameForConfirm
        ? matchPendingPaymentByName(pendingPaymentMilestones, candidateNameForConfirm)
        : null;
      
      // If user is confirming and we have a matched payment (from draft or from prior message), proceed to execution
      if (isConfirmation && (hasMatchedPaymentInDraft || matchedFromConfirmation)) {
        if (matchedFromConfirmation && !hasMatchedPaymentInDraft) {
          routerResult.tool_args_draft.milestoneName = matchedFromConfirmation.title || matchedFromConfirmation.name;
          if (matchedFromConfirmation.id) routerResult.tool_args_draft.milestoneId = matchedFromConfirmation.id;
        }
        if (projectId) routerResult.tool_args_draft.projectId = projectId;
        routerResult.required_fields_missing = [];
        routerResult.clarification_question = null;
        routerResult.confidence = 1.0;
        routerResult.action = 'execute';
        console.log('🛡️ Payment guard: user confirmed, proceeding to mark payment as collected');
      } else {
        // Try to match payment name from user's message (or from paymentSelectionResume hint)
        const candidateName = !isConfirmation
          ? (routerResult.tool_args_draft.milestoneName || parsedContext?.selectedPaymentName || userText)
          : '';
        const matchedPayment = matchPendingPaymentByName(pendingPaymentMilestones, candidateName);

        if (matchedPayment && !assistantAlreadyAsked) {
          // First time - user clicked button, we found a match (maybe only one payment)
          // Still ask which one to be explicit
          routerResult.required_fields_missing = ['milestoneName'];
          if (pendingPaymentMilestones.length > 0) {
            const projectName = parsedContext?.currentProject || currentProjectData?.title || currentProjectData?.name || 'this project';
            const options = pendingPaymentMilestones
              .slice(0, 6)
              .map((m) => `"${formatPaymentNameForDisplay(m.title || m.name)}"`)
              .join(', ');
            routerResult.clarification_question = `Which payment should I mark as completed for ${projectName}? Pending payments: ${options}.`;
            routerResult.paymentSelectionOptions = pendingPaymentMilestones.slice(0, 6).map((m) => ({
              id: m.id || `payment-${m.title || m.name}`,
              title: formatPaymentNameForDisplay(m.title || m.name),
              status: 'Pending',
              amount: Number(m.amount || 0) || undefined,
              dueDate: m.plannedDate || m.dueDate || m.date || undefined,
            }));
            routerResult.paymentSelectionProjectId = projectId;
            routerResult.paymentSelectionProjectName = projectName;
          } else {
            const hasProject = !!(parsedContext?.projectId || parsedContext?.resolvedProjectId);
            routerResult.clarification_question = hasProject
              ? 'I could not find any pending payment milestones in the timeline. Please check the Timeline tab.'
              : 'Which project do you want me to mark a payment for? I need to know which project\'s timeline to use.';
          }
          console.log('🛡️ Payment guard: first time - listing pending payments');
        } else if (matchedPayment && assistantAlreadyAsked) {
          // User specified which payment after we asked - now ask for confirmation
          routerResult.required_fields_missing = [];
          routerResult.tool_args_draft.milestoneName = matchedPayment.title || matchedPayment.name;
          if (matchedPayment.id) routerResult.tool_args_draft.milestoneId = matchedPayment.id;
          if (projectId) routerResult.tool_args_draft.projectId = projectId;
          const projName = parsedContext?.currentProject || currentProjectData?.title || currentProjectData?.name || parsedContext?.paymentSelectionProjectName || 'this project';
          routerResult.clarification_question = `Mark "${matchedPayment.title || matchedPayment.name}" ($${Number(matchedPayment.amount || 0).toLocaleString()}) as completed for ${projName}?`;
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
            const projectName = parsedContext?.currentProject || currentProjectData?.title || currentProjectData?.name || 'this project';
            const options = pendingPaymentMilestones
              .slice(0, 6)
              .map((m) => `"${formatPaymentNameForDisplay(m.title || m.name)}"`)
              .join(', ');
            routerResult.clarification_question = `Which payment should I mark as completed for ${projectName}? Pending payments: ${options}.`;
            routerResult.paymentSelectionOptions = pendingPaymentMilestones.slice(0, 6).map((m) => ({
              id: m.id || `payment-${m.title || m.name}`,
              title: formatPaymentNameForDisplay(m.title || m.name),
              status: 'Pending',
              amount: Number(m.amount || 0) || undefined,
              dueDate: m.plannedDate || m.dueDate || m.date || undefined,
            }));
            routerResult.paymentSelectionProjectId = projectId;
            routerResult.paymentSelectionProjectName = projectName;
          } else {
            const hasProject = !!(parsedContext?.projectId || parsedContext?.resolvedProjectId);
            routerResult.clarification_question = hasProject
              ? 'I could not find any pending payment milestones in the timeline. Please check the Timeline tab.'
              : 'Which project do you want me to mark a payment for? I need to know which project\'s timeline to use.';
          }
          console.log('🛡️ Payment guard: asking user to choose pending milestone', {
            pendingCount: pendingPaymentMilestones.length,
            input: candidateName,
          });
        }
      }
    }

    // ── PO SELECTION GUARD: "mark as received" with 2+ pending POs → show green cards ──
    const userSaidMarkPOReceived = lastUserContent.includes('mark') &&
      (lastUserContent.includes('received') || lastUserContent.includes('recieved'));
    const poSelectionResumeHint = parsedContext?.poSelectionResume === true && parsedContext?.selectedPONumber;
    if ((userSaidMarkPOReceived || poSelectionResumeHint) && projectId) {
      const poProject = currentProjectData || allProjects.find(p => String(p.id) === String(projectId));
      const rawPOs = poProject?.projectData?.purchaseOrders || poProject?.purchaseOrders || parsedContext?.projectData?.purchaseOrders || parsedContext?.purchaseOrders || [];
      const pendingPOs = Array.isArray(rawPOs) ? rawPOs.filter(po => (po?.status || '').toLowerCase() === 'pending') : [];
      const userSpecifiedPO = /\bPO-?\d+/i.test(lastUserContent) || /\$\d+/.test(lastUserContent);
      // User tapped a PO card — proceed to execute with selected PO
      if (poSelectionResumeHint) {
        routerResult.domain = 'budget';
        routerResult.proposed_tool = 'mark_purchase_order_received';
        routerResult.required_fields_missing = [];
        routerResult.tool_args_draft = routerResult.tool_args_draft || {};
        routerResult.tool_args_draft.poNumber = parsedContext.selectedPONumber;
        routerResult.tool_args_draft.projectId = projectId;
        routerResult.action = 'execute';
        routerResult.confidence = 1.0;
        console.log('🛡️ PO guard: user selected PO from card, executing', parsedContext.selectedPONumber);
      } else if (pendingPOs.length >= 1 && !userSpecifiedPO) {
        routerResult.domain = 'budget';
        routerResult.proposed_tool = 'mark_purchase_order_received';
        routerResult.required_fields_missing = ['poNumber'];
        const projectName = poProject?.title || poProject?.name || parsedContext?.projectName || 'this project';
        routerResult.clarification_question = `Which purchase order should I mark as received for ${projectName}?`;
        routerResult.poSelectionOptions = pendingPOs.slice(0, 6).map((po) => ({
          id: po.id || po.poNumber || `po-${po.poNumber}`,
          title: po.poNumber || `PO ${po.id}`,
          subtitle: [po.amount ? `$${Number(po.amount).toLocaleString()}` : '', po.vendor].filter(Boolean).join(' · ') || 'Pending',
          amount: Number(po.amount) || undefined,
          vendor: po.vendor,
        }));
        routerResult.poSelectionProjectId = projectId;
        routerResult.poSelectionProjectName = projectName;
        console.log('🛡️ PO guard: 2+ pending POs, showing selection cards', { count: pendingPOs.length });
      }
    }

    // ── FINAL EXPENSE LOGGING CHECK (after CO guard, before executor) ──────
    // Re-check expense logging after all guards have run to ensure it wasn't overridden
    // BUT skip if user is in a daily log flow OR router already said daily_log
    if (isExpenseLoggingRequest && !hasExpenseType && !inDailyLogContextForExpense && !isDailyLogDomain) {
      // Force expense logging intent - override any other domain
      if (routerResult.domain !== 'expenses' || !routerResult.required_fields_missing?.includes('expense_type')) {
        console.log('🛡️ Final expense guard: forcing expense domain and required field (with cards)');
        routerResult.domain = 'expenses';
        routerResult.proposed_tool = 'add_material_expense';
        routerResult.required_fields_missing = ['expense_type'];
        routerResult.clarification_question = 'What type of expense are you logging?';
        routerResult.expenseTypeSelectionOptions = [
          { id: 'materials', title: 'Materials', subtitle: 'Category, vendor, amount' },
          { id: 'labor', title: 'Labor', subtitle: 'Trade, description, amount' },
          { id: 'equipment', title: 'Equipment', subtitle: 'Rental or purchase' },
          { id: 'permit', title: 'Permit', subtitle: 'Permit fees' },
          { id: 'other', title: 'Other', subtitle: 'Custom category' },
        ];
        routerResult.confidence = 0.95;
      }
    } else if (isDailyLogDomain) {
      console.log('🛡️ Daily log protection: router says daily_log, blocking final expense guard override');
    }

    logPhase('router_done', { domain: routerResult?.domain, proposedTool: routerResult?.proposed_tool });
    if (process.env.DEBUG_AI_CONTEXT) console.log('🧭 Router:', routerResult.domain, routerResult.proposed_tool);

    // SIMPLE MARGIN/PROFIT OVERRIDE: "what is my margin", "what is my profit margin", "what is my profit" → answer from context, NOT forecast_profit
    const msgForMarginCheck = (normalizedMessage || message || '').toLowerCase();
    const isSimpleMarginOrProfitQuestion = /\b(what is my|what's my|what is the)\s+(profit\s+)?margin\b/i.test(msgForMarginCheck) ||
      /\b(what is my|what's my)\s+profit\b/i.test(msgForMarginCheck) ||
      /\bmargin\s+for\s+\w+/i.test(msgForMarginCheck) ||
      /\bprofit\s+margin\s+for\s+\w+/i.test(msgForMarginCheck);
    if (isSimpleMarginOrProfitQuestion && routerResult.proposed_tool === 'forecast_profit') {
      console.log('🛡️ SIMPLE MARGIN OVERRIDE: Blocking forecast_profit — answer from context with simple format');
      routerResult.domain = 'general';
      routerResult.proposed_tool = null;
    }

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
    // BULLETPROOF: When ONLY scenario is missing and user said "Yes" (or similar) = give me all scenarios → run all_presets, never re-ask
    const onlyScenarioMissing = routerResult.required_fields_missing?.length === 1 && routerResult.required_fields_missing[0] === 'scenario';
    const gateMsg = String(req.body?.message ?? message ?? '').trim();
    const msgForGate = gateMsg.toLowerCase();
    const lettersOnly = msgForGate.replace(/\W/g, '');
    const isExactYesWord = ['yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'sure', 'please', 'all'].includes(lettersOnly);
    const isYesPlusAll = lettersOnly === 'yesallofthem' || lettersOnly === 'yesall' || lettersOnly === 'allofthem' || lettersOnly === 'allthree';
    const isShortAffirmative = msgForGate.length <= 20 && (
      /^(yes|yeah|yep|yup|sure|ok|okay|please|all)(\s*[.,!?]?\s*)?$/i.test(msgForGate) ||
      /^(yes|yeah|ok)\s+(all|all\s+of\s+them)/i.test(msgForGate) ||
      /\b(all\s+of\s+them|all\s+three)\b/i.test(msgForGate)
    );
    const userSaidYesOrAll = isExactYesWord || isYesPlusAll || isShortAffirmative ||
      /^\s*(yes|yeah|yep|sure|ok|okay|please|all)\s*\.?\s*$/i.test(msgForGate) ||
      /\b(all\s+of\s+them|all\s+three|yes\s+all|yes\s+all\s+of\s+them)\b/i.test(msgForGate) ||
      (msgForGate.length <= 25 && /^\s*(yes|yeah|yep|ok|sure|please)\s+/i.test(msgForGate) && /\b(all|them|three)\b/i.test(msgForGate));
    if (onlyScenarioMissing && userSaidYesOrAll) {
      console.log('🛡️ Scenario gate: only scenario missing + user said Yes/all → forcing all_presets', { gateMsg: gateMsg.substring(0, 30), lettersOnly });
      routerResult.required_fields_missing = [];
      routerResult.clarification_question = null;
      routerResult.domain = 'scenario_analysis';
      routerResult.proposed_tool = 'run_scenario_analysis';
      routerResult.tool_args_draft = routerResult.tool_args_draft || {};
      routerResult.tool_args_draft.scenario = 'all_presets';
      routerResult.action = 'execute';
    }
    if (routerResult.required_fields_missing && routerResult.required_fields_missing.length > 0) {
      const question = routerResult.clarification_question || `I need a few more details. Could you provide the ${routerResult.required_fields_missing.join(' and ')}?`;
      if (process.env.DEBUG_AI_CONTEXT) console.log('🛑 Router: required fields missing →', routerResult.required_fields_missing);
      const payload = { reply: question, actions: [], projectUpdateData: null };
      if (routerResult.paymentSelectionOptions?.length > 0) {
        payload.paymentSelectionOptions = routerResult.paymentSelectionOptions;
        payload.paymentSelectionProjectId = routerResult.paymentSelectionProjectId;
        payload.paymentSelectionProjectName = routerResult.paymentSelectionProjectName;
      }
      if (routerResult.expenseTypeSelectionOptions?.length > 0) {
        payload.expenseTypeSelectionOptions = routerResult.expenseTypeSelectionOptions;
      }
      if (routerResult.poSelectionOptions?.length > 0) {
        payload.poSelectionOptions = routerResult.poSelectionOptions;
        payload.poSelectionProjectId = routerResult.poSelectionProjectId;
        payload.poSelectionProjectName = routerResult.poSelectionProjectName;
      }
      if (routerResult.scenarioSelectionOptions?.length > 0) {
        payload.scenarioSelectionOptions = routerResult.scenarioSelectionOptions;
      }
      return res.json(payload);
    }
    // Payment confirmation: when we matched a payment and are asking "Mark X as collected?", return that question (don't execute yet)
    if (routerResult.clarification_question && routerResult.proposed_tool === 'mark_payment_collected' && routerResult.action !== 'execute') {
      if (process.env.DEBUG_AI_CONTEXT) console.log('🛑 Router: payment confirmation question →', routerResult.clarification_question);
      return res.json({ reply: routerResult.clarification_question, actions: [], projectUpdateData: null });
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

CRITICAL: The tool uses the project's EXISTING budget, materials, labor, and overhead data from context. You do NOT need to provide any dollar amounts. The scenario "${scenarioName}" has preset percentage adjustments already defined (e.g., typical_friction = labor +8%, materials +5%, overhead +3%). The tool will automatically return the final revised cost, profit, and margin.

Do NOT say "Let me calculate" or "Let's calculate the exact figures" - call the tool immediately. The tool returns the complete numeric result. Do NOT ask for dollar amounts, parameters, percentages, or any other details. Just execute the tool with ONLY the scenario parameter. The tool has all the data it needs from context.`,
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
      model: 'gpt-4o',
      messages: messages,
      tools: functions,
      tool_choice: finalToolChoice,
      temperature: 0.3,
      max_tokens: 2000,
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

    // CRITICAL: Labor/expense flows NEVER need delivery date — that is for purchase orders only
    const isExpenseFlow = routerResult.domain === 'expenses' ||
                         routerResult.proposed_tool === 'add_material_expense' ||
                         routerResult.proposed_tool === 'add_labor_expense' ||
                         toolCalls.some(tc => ['add_material_expense', 'add_labor_expense'].includes(tc.function?.name));
    
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
    } else if (isExpenseFlow) {
      // Strip delivery/pickup date questions — expenses (labor or material) NEVER need delivery date
      if (/expected delivery|delivery date|received date|pickup date|what.*(?:date|when)/i.test(reply)) {
        reply = reply.replace(/[^.!?\n]*(?:expected delivery|delivery date|received date|pickup date|delivery or received|what.*(?:date|when))[^.!?\n]*[.!?]?/gi, '');
        reply = reply.replace(/\n{2,}/g, '\n').trim();
        if (/expected delivery|delivery date|received date|pickup date/i.test(reply)) {
          reply = reply.split(/(?<=[.!?])\s+/).filter(s => !/delivery|received date|pickup date/i.test(s)).join(' ').trim();
        }
        console.log('🛡️ Expense filter: stripped delivery date question from reply');
      }
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

    // CRITICAL FALLBACK: If router selected scenario_analysis but AI didn't call it (or called something else like get_project_health),
    // force run_scenario_analysis so the user gets the numeric breakdown (Typical Friction / Bad Remodel / Smooth Job with $ and %).
    const routerWantsScenario = routerResult.action === 'execute' &&
      routerResult.proposed_tool === 'run_scenario_analysis' &&
      routerResult.tool_args_draft?.scenario;
    const aiDidNotCallScenario = !toolCalls.some(tc => tc.function?.name === 'run_scenario_analysis');
    if (routerWantsScenario && aiDidNotCallScenario) {
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
      console.log('🛡️ Scenario fallback: forcing run_scenario_analysis (AI called other tool or none)', {
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
          const scenarioNames = ['typical_friction', 'bad_remodel', 'smooth_job', 'job_runs_long', 'job_runs_long_4', 'job_runs_long_6', 'labor_up_10', 'labor_down_10', 
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
    
    // CRITICAL FALLBACK: If router selected mark_payment_collected with action=execute but AI didn't call it,
    // force the tool call so the payment gets marked (e.g. user said "yes" to confirm).
    const routerWantsPaymentCollected = routerResult.action === 'execute' &&
      routerResult.proposed_tool === 'mark_payment_collected' &&
      routerResult.tool_args_draft?.milestoneName;
    const aiDidNotCallPaymentCollected = !toolCalls.some(tc => tc.function?.name === 'mark_payment_collected');
    if (routerWantsPaymentCollected && aiDidNotCallPaymentCollected) {
      const fallbackArgs = {
        projectId: routerResult.tool_args_draft.projectId || projectId,
        milestoneName: routerResult.tool_args_draft.milestoneName,
        milestoneId: routerResult.tool_args_draft.milestoneId || null,
      };
      toolCalls = [
        {
          id: `call_manual_mark_payment_${Date.now()}`,
          type: 'function',
          function: {
            name: 'mark_payment_collected',
            arguments: JSON.stringify(fallbackArgs),
          },
        },
      ];
      console.log('🛡️ Payment fallback: forcing mark_payment_collected tool call', {
        milestoneName: fallbackArgs.milestoneName,
        projectId: fallbackArgs.projectId,
      });
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
      // When run_scenario_analysis succeeds, use its message as the final reply so user sees all three scenarios (not LLM summary)
      let scenarioAnalysisReply = null;

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let functionArgs = JSON.parse(toolCall.function.arguments);
        
        // CRITICAL FIX: Correct scenario analysis tool calls where AI confused scenario with projectId
        if (functionName === 'run_scenario_analysis') {
          const scenarioNames = ['typical_friction', 'bad_remodel', 'smooth_job', 'job_runs_long', 'job_runs_long_4', 'job_runs_long_6', 'labor_up_10', 'labor_down_10', 
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
            const lastUserMsg = (messages.filter(m => m.role === 'user').pop()?.content || '').trim();
            const tradeMatch = lastUserMsg.match(/\b(general\s+labor|it'?s\s+general\s+labor|it'?s\s+labor|framing|plumbing|electrical|drywall|tile|painting|concrete|roofing|hvac|carpentry|drywall\s+installation|tile\s+work)\b/i);
            const forMatch = lastUserMsg.match(/(?:,|for)\s+(.+)$/i);
            const rawTrade = tradeMatch ? tradeMatch[1].replace(/^it'?s\s+/i, '').trim() : (forMatch ? forMatch[1].trim() : null);
            const inferredTrade = rawTrade ? rawTrade.replace(/\b\w/g, c => c.toUpperCase()) : null;
            if (inferredTrade) {
              // User said "Bathroom, for tile work" or "general labor" etc. - use full msg as notes, trade as vendor
              functionArgs.vendor = functionArgs.vendor || inferredTrade;
              functionArgs.notes = functionArgs.notes || lastUserMsg;
              console.log('✅ PRE-VALIDATION: Injected labor trade/notes from user message:', { trade: functionArgs.vendor, notes: functionArgs.notes });
            } else {
              console.error('🚫 PRE-VALIDATION: No notes/vendor (trade) provided for labor expense - blocking function call');
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  status: 'error',
                  error: `For labor, you need the trade and description. Ask "What trade and what was the work?" Do NOT ask for vendor or delivery date.`,
                  requiresNotes: true,
                  message: `Please provide the trade and description of the work (e.g., "Tile work", "Bathroom, for tile work").`
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
          // Focus-today / what needs attention: only list ACTIVE projects (exclude completed)
          const lastUserMsg = (messages.filter((m) => m.role === 'user').pop()?.content || '').toLowerCase();
          const focusTodayIntent = /\b(focus on today|top priorities|what needs attention|what should i focus|needs my attention|urgent)\b/.test(lastUserMsg);
          if (focusTodayIntent) routerResult._focusTodayIntent = true;
          const routerSaysActiveOnly = routerResult?.tool_args_draft?.activeOnly === true;
          if ((focusTodayIntent || routerSaysActiveOnly) && !functionArgs.activeOnly) {
            functionArgs.activeOnly = true;
            console.log('✅ compare_projects: focus-today intent → activeOnly=true (exclude completed)');
          }
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
            return idMatch || !!resolveProjectByQuery([p], searchName, { minScore: 35 }).project;
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
                error: `For labor expenses, you need the trade and description. Ask "What trade and what was the work?" (e.g., "Tile work", "Bathroom, for tile work"). Do NOT ask for vendor or delivery date.`,
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
          const ctx = parsedContext || {};
          const currentProject = ctx.currentProject || ctx;
          const estimateData = currentProject.estimateData || currentProject.estimate || {};
          const revenue = Number(ctx.contractValue || ctx.bidTotal || ctx.total || estimateData.totalBid || currentProject.bidPrice || 0);
          const forecastCost = Number(ctx.forecastFinalCost || currentProject.forecastFinalCost || 0);
          const projectedMarginPct = typeof ctx.projectedMarginPct === 'number' && Number.isFinite(ctx.projectedMarginPct) ? ctx.projectedMarginPct : (currentProject.projectedMarginPct);
          const actualCost = Number(ctx.actualCost || ctx.totalSpent || currentProject.actualCost || currentProject.totalSpent || 0);
          const estimatedCost = Number(estimateData.totalCost || estimateData.estimatedCost || estimateData.baseCost || currentProject.estimatedCost || 0);
          const baseCostFromProject = forecastCost > 0 ? forecastCost : (revenue > 0 && typeof projectedMarginPct === 'number') ? revenue * (1 - projectedMarginPct / 100) : 0;

          // Baseline selection: use estimate when early-stage (<20% spend); otherwise use live forecast when available
          const spendPct = estimatedCost > 0 ? (actualCost / estimatedCost) * 100 : 0;
          const useLiveForecast = spendPct >= 20 && revenue > 0 && (forecastCost > 0 || (typeof projectedMarginPct === 'number' && projectedMarginPct >= 0 && projectedMarginPct <= 100));

          let baseCost, originalBid, originalProfit, originalMarginPct, materialCost, laborCost, overheadCost, markupPct, baselineLabel;
          materialCost = Number(ctx.materialBudgetDirect || estimateData.materialTotal || estimateData.materialsTotal || currentProject.materialBudget || currentProject.materialsTotal || 0);
          laborCost = Number(estimateData.laborTotal || estimateData.laborCost || currentProject.laborTotal || currentProject.laborCost || 5000);
          overheadCost = Number(estimateData.overheadTotal || estimateData.overheadCost || currentProject.overheadTotal || currentProject.overheadCost || 0);
          const bucketSum = materialCost + laborCost + overheadCost;
          markupPct = Number(estimateData.markupPct || estimateData.markup || 20);
          const resolvedBaseCost = resolveEstimateBaselineCost(ctx, currentProject, estimateData, bucketSum, revenue, markupPct);
          if (bucketSum > 0 && resolvedBaseCost > bucketSum) {
            const scale = resolvedBaseCost / bucketSum;
            materialCost *= scale;
            laborCost *= scale;
            overheadCost *= scale;
          }

          if (useLiveForecast && baseCostFromProject > 0) {
            baseCost = baseCostFromProject;
            originalBid = revenue;
            baselineLabel = 'This scenario is based on your current live forecast.';
          } else if (revenue > 0 && resolvedBaseCost > 0) {
            baseCost = resolvedBaseCost;
            originalBid = Number(estimateData.totalBid || currentProject.bidPrice || baseCost + baseCost * (markupPct / 100));
            baselineLabel = 'This scenario is based on your original estimate baseline.';
          } else if (revenue > 0 && baseCostFromProject > 0) {
            baseCost = baseCostFromProject;
            originalBid = revenue;
            baselineLabel = 'This scenario is based on your current live forecast.';
          } else {
            baseCost = resolvedBaseCost || baseCostFromProject;
            originalBid = Number(estimateData.totalBid || currentProject.bidPrice || revenue || baseCost + baseCost * (markupPct / 100));
            baselineLabel = 'This scenario is based on your original estimate baseline.';
          }

          originalProfit = originalBid - baseCost;
          originalMarginPct = originalBid > 0 ? (originalProfit / originalBid * 100) : 0;
          markupPct = Number(estimateData.markupPct || estimateData.markup || 20);

          const laborBudget = laborCost || Number(estimateData.laborTotal || currentProject.laborTotal || 0);
          const materialBudget = materialCost || Number(estimateData.materialTotal || estimateData.materialsTotal || currentProject.materialBudget || currentProject.materialsTotal || 0);
          const overheadBudget = overheadCost || Number(estimateData.overheadTotal || currentProject.overheadTotal || 0);
          const startISO = ctx.startDate || ctx.startISO || currentProject.startDate || currentProject.startISO;
          const endISO = ctx.endDate || ctx.endISO || currentProject.endDate || currentProject.endISO;
          let estimatedWeeks = 12;
          if (startISO && endISO) {
            const start = new Date(String(startISO));
            const end = new Date(String(endISO));
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
              estimatedWeeks = Math.max(4, Math.round((end - start) / (7 * 24 * 60 * 60 * 1000)));
            }
          }

          // Preset scenarios: when using project baseline we only have total cost — apply single cost-% change (approximate to labor/mat/OH blend)
          const scenario = functionArgs.scenario;
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
            typical_friction:  { labor: 8, materials: 5, overhead: 3, bid: 0, label: 'Typical Friction' },
            bad_remodel:       { labor: 20, materials: 15, overhead: 10, bid: 0, label: 'Bad Remodel' },
            smooth_job:        { labor: -5, materials: -3, overhead: 0, bid: 0, label: 'Smooth Job' },
            job_runs_long:     { weeks: 2, label: 'Job Runs Long (2 weeks)' },
            job_runs_long_4:   { weeks: 4, label: 'Job Runs Long (4 weeks)' },
            job_runs_long_6:   { weeks: 6, label: 'Job Runs Long (6 weeks)' },
          };

          const disclaimer = '\n\n[DISCLAIMER]Scenario results are projections based on applied cost adjustments—not guarantees of actual outcomes. Use for planning only.[/DISCLAIMER]';

          if (scenario === 'all_presets') {
            const presets = ['typical_friction', 'bad_remodel', 'smooth_job', 'job_runs_long', 'job_runs_long_4'];
            const baselineShort = baselineLabel && baselineLabel.includes('live forecast')
              ? 'Current live forecast'
              : 'Original estimate baseline';
            const projectName = (() => { const p = currentProject?.title || currentProject?.name || ctx.bidTitle; return typeof p === 'string' && p ? p : ''; })();
            const parts = [
              '### Scenario Analysis',
              projectName ? `\nScenarios for ${projectName}\n` : '\n',
              `**Baseline used:** ${baselineShort}\n`,
            ];
            const allResults = [];
            for (const preset of presets) {
              const adj = scenarioMap[preset];
              let newBaseCost, newBid, newProfit, newMarginPct, newLabor, newMaterials, newOverhead;
              if (adj.weeks) {
                const delayResult = computeDelayCost(adj, { baseCost, laborCost, materialCost, overheadCost, estimatedWeeks });
                if (delayResult) {
                  newBaseCost = delayResult.newBaseCost;
                  newBid = originalBid;
                  newProfit = newBid - newBaseCost;
                  newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
                } else {
                  const weeklyLabor = laborBudget > 0 ? laborBudget / estimatedWeeks : 0;
                  const weeklyOverhead = overheadBudget > 0 ? overheadBudget / estimatedWeeks : 0;
                  const weeklyDelay = weeklyLabor + weeklyOverhead || (baseCost * 0.5 / estimatedWeeks);
                  newBaseCost = baseCost + Math.round(weeklyDelay * adj.weeks);
                  newBid = originalBid;
                  newProfit = newBid - newBaseCost;
                  newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
                }
                newLabor = laborCost;
                newMaterials = materialCost;
                newOverhead = overheadCost;
              } else {
                const result = computeScenarioCost(adj, { baseCost, laborCost, materialCost, overheadCost, originalBid });
                if (result) {
                  newBaseCost = result.newBaseCost;
                  newBid = result.newBid;
                  newProfit = result.newProfit;
                  newMarginPct = result.newMarginPct;
                  newLabor = result.newLabor;
                  newMaterials = result.newMaterials;
                  newOverhead = result.newOverhead;
                } else {
                  const totalFromBuckets = laborCost + materialCost + overheadCost;
                  const laborShare = totalFromBuckets > 0 ? laborCost / totalFromBuckets : 1 / 3;
                  const materialsShare = totalFromBuckets > 0 ? materialCost / totalFromBuckets : 1 / 3;
                  const overheadShare = totalFromBuckets > 0 ? overheadCost / totalFromBuckets : 1 / 3;
                  const weightedPct = (laborShare * (adj.labor || 0)) + (materialsShare * (adj.materials || 0)) + (overheadShare * (adj.overhead || 0));
                  newBaseCost = baseCost * (1 + weightedPct / 100);
                  newBid = originalBid * (1 + (adj.bid || 0) / 100);
                  newProfit = newBid - newBaseCost;
                  newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
                  newLabor = laborCost;
                  newMaterials = materialCost;
                  newOverhead = overheadCost;
                }
              }
              const profitChange = newProfit - originalProfit;
              parts.push(formatScenarioPresetBlock(adj, originalMarginPct, newBaseCost, newBid, newProfit, newMarginPct, profitChange));
              allResults.push({ scenario: preset, label: adj.label, profitChange: Math.round(profitChange), newMarginPct: Math.round(newMarginPct * 10) / 10 });
            }
            functionResult = {
              success: true,
              scenario: 'All presets (Typical Friction, Bad Remodel, Smooth Job, Job Runs Long 2 & 4 weeks)',
              baselineSource: useLiveForecast ? 'forecast' : 'estimate',
              baselineLabel: baselineLabel || '',
              original: {
                materialCost, laborCost, overheadCost, baseCost, markup: useLiveForecast ? 0 : baseCost * (markupPct / 100), bid: originalBid,
                profit: originalProfit, marginPct: Math.round(originalMarginPct * 10) / 10,
              },
              allPresets: allResults,
              message: parts.join('\n\n') + disclaimer,
            };
          } else {
          let adj = scenarioMap[scenario] || scenarioMap.typical_friction;
          if (scenario === 'custom' && functionArgs.customAdjustments) {
            const ca = functionArgs.customAdjustments;
            adj = {
              labor: ca.laborPctChange || 0,
              materials: ca.materialsPctChange || 0,
              overhead: ca.overheadPctChange || 0,
              bid: ca.bidPctChange || 0,
              label: 'Custom Scenario',
            };
          }

          let newBaseCost, newBid, newProfit, newMarginPct, newLabor, newMaterials, newOverhead;
          if (adj.weeks) {
            const delayResult = computeDelayCost(adj, { baseCost, laborCost, materialCost, overheadCost, estimatedWeeks });
            if (delayResult) {
              newBaseCost = delayResult.newBaseCost;
              newBid = originalBid;
              newProfit = newBid - newBaseCost;
              newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
            } else {
              const weeklyLabor = laborBudget > 0 ? laborBudget / estimatedWeeks : 0;
              const weeklyOverhead = overheadBudget > 0 ? overheadBudget / estimatedWeeks : 0;
              const weeklyDelay = weeklyLabor + weeklyOverhead || (baseCost * 0.5 / estimatedWeeks);
              newBaseCost = baseCost + Math.round(weeklyDelay * adj.weeks);
              newBid = originalBid;
              newProfit = newBid - newBaseCost;
              newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
            }
            newLabor = laborCost;
            newMaterials = materialCost;
            newOverhead = overheadCost;
          } else {
            const result = computeScenarioCost(adj, { baseCost, laborCost, materialCost, overheadCost, originalBid });
            if (result) {
              newBaseCost = result.newBaseCost;
              newBid = result.newBid;
              newProfit = result.newProfit;
              newMarginPct = result.newMarginPct;
              newLabor = result.newLabor;
              newMaterials = result.newMaterials;
              newOverhead = result.newOverhead;
            } else {
              const totalFromBuckets = laborCost + materialCost + overheadCost;
              const laborShare = totalFromBuckets > 0 ? laborCost / totalFromBuckets : 1 / 3;
              const materialsShare = totalFromBuckets > 0 ? materialCost / totalFromBuckets : 1 / 3;
              const overheadShare = totalFromBuckets > 0 ? overheadCost / totalFromBuckets : 1 / 3;
              const weightedPct = (laborShare * (adj.labor || 0)) + (materialsShare * (adj.materials || 0)) + (overheadShare * (adj.overhead || 0));
              newBaseCost = baseCost * (1 + weightedPct / 100);
              newBid = originalBid * (1 + (adj.bid || 0) / 100);
              newProfit = newBid - newBaseCost;
              newMarginPct = newBid > 0 ? (newProfit / newBid * 100) : 0;
              newLabor = laborCost;
              newMaterials = materialCost;
              newOverhead = overheadCost;
            }
          }
          const profitChange = newProfit - originalProfit;

          functionResult = {
            success: true,
            scenario: adj.label,
            baselineSource: useLiveForecast ? 'forecast' : 'estimate',
            baselineLabel: baselineLabel || '',
            original: {
              materialCost, laborCost, overheadCost, baseCost, markup: useLiveForecast ? 0 : baseCost * (markupPct / 100), bid: originalBid,
              profit: originalProfit, marginPct: Math.round(originalMarginPct * 10) / 10,
            },
            adjusted: {
              materialCost: Math.round(newMaterials), laborCost: Math.round(newLabor), overheadCost: Math.round(newOverhead),
              baseCost: Math.round(newBaseCost), markup: useLiveForecast ? 0 : Math.round(newBaseCost * (markupPct / 100)), bid: Math.round(newBid),
              profit: Math.round(newProfit), marginPct: Math.round(newMarginPct * 10) / 10,
            },
            impact: {
              profitChange: Math.round(profitChange),
              marginChange: Math.round((newMarginPct - originalMarginPct) * 10) / 10,
              costIncrease: Math.round(newBaseCost - baseCost),
              breakEvenCostIncrease: originalProfit > 0 ? `${Math.round((originalProfit / baseCost) * 100)}%` : 'N/A',
            },
            message: formatScenarioFullResponse({
              adj,
              baselineLabel: baselineLabel || '',
              original: { baseCost, bid: originalBid, profit: originalProfit, marginPct: originalMarginPct },
              adjusted: { baseCost: newBaseCost, bid: newBid, profit: newProfit, marginPct: newMarginPct },
              impact: { profitChange, marginChange: newMarginPct - originalMarginPct },
              projectName: (() => { const p = currentProject?.title || currentProject?.name || ctx.bidTitle; return typeof p === 'string' && p ? p : ''; })(),
            }) + disclaimer,
          };
          }

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
              model: 'gpt-4o',
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
          const paymentExecutorContext = currentProjectData
            ? { ...parsedContext, currentProject: currentProjectData, projectId }
            : parsedContext;
          const allMilestones = getAllMilestonesFromContext(paymentExecutorContext);
          const pendingPayments = getPendingPaymentMilestones(paymentExecutorContext);
          
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
              error: `Could not find a payment milestone matching "${functionArgs.milestoneName}". Available pending payments: ${availableNames}. Please specify which one you want to mark as completed.`,
            };
          } else if (!match && pendingPayments.length === 0) {
            functionResult = {
              success: false,
              error: 'No pending payment milestones found for this project. All payments may already be collected.',
            };
          } else if (!match) {
            functionResult = {
              success: false,
              error: 'Please specify which payment milestone to mark as completed (e.g., "Week 1 Payment", "Deposit").',
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
              message: `✅ Marked "${match.title}" as completed ($${collectedAmount.toLocaleString()}).`,
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

        // Use scenario tool message as final reply so user always sees Typical Friction / Bad Remodel / Smooth Job (not LLM summary)
        if (functionName === 'run_scenario_analysis' && functionResult?.success && functionResult?.message) {
          scenarioAnalysisReply = functionResult.message;
        }

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
            const entry = {
              functionName: tc.function.name,
              success: parsed.success,
              status: parsed.status,
              message: parsed.message,
              error: parsed.error
            };
            if (tc.function.name === 'compare_projects' && parsed.success) {
              entry.comparedCount = parsed.comparedCount ?? (Array.isArray(parsed.projects) ? parsed.projects.length : 0);
            }
            return entry;
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
          
          const hasCompareProjects = functionResultsSummary.some(r => r.functionName === 'compare_projects');
          const compareResult = functionResultsSummary.find(r => r.functionName === 'compare_projects');
          const compareCount = compareResult?.comparedCount ?? 0;
          const losingMoneyInstruction = (routerResult && routerResult._losingMoneyIntent && hasCompareProjects)
            ? (compareCount === 0
              ? ' CRITICAL: The user asked about losing money / profit leaks across active projects. compare_projects returned 0 active projects. Say clearly: "You have no active projects." Do NOT ask "which project do you mean?"'
              : ' CRITICAL: The user asked "where am I losing money across my active projects." You have compare_projects data. Use it. List EACH project with margin, profit, and any profit leaks. Do NOT ask "which project do you mean?" — you already have all active projects.')
            : '';
          const completedProjectsInstruction = (routerResult && routerResult._completedProjectsIntent && hasCompareProjects)
            ? (compareCount === 0
              ? ' CRITICAL: The user asked about completed projects (e.g. where they lost money or could have made more). compare_projects returned 0 completed projects. Say clearly: "You have no completed projects." Do NOT ask "which project do you mean?"'
              : ' CRITICAL: The user asked about completed projects (where they lost money or could have made more). You have compare_projects data for completed projects. List EACH completed project with margin, net profit, and where they lost money or could have made more. Do NOT ask "which project do you mean?" — you already have all completed projects.')
            : '';
          const overBudgetInstruction = (routerResult && routerResult._overBudgetIntent && hasCompareProjects)
            ? ' CRITICAL: The user asked which projects are over budget and by how much. You have compare_projects data for active and completed projects. List EACH project that is/was over budget with project name, status (active/completed), and how much over budget (use overBudgetPct and spent vs budget). If no projects are over budget, say clearly: "No projects are over budget." Do NOT ask "which project do you mean?" — you already have all projects.'
            : '';
          const focusTodayInstruction = (routerResult && routerResult._focusTodayIntent && hasCompareProjects)
            ? ' CRITICAL: The user asked for top priorities / what to focus on today. Your response MUST include BOTH: (1) Project priorities from compare_projects — e.g. lowest margin, missing receipts, over budget, overdue payments — and (2) Calendar/schedule items from the UPCOMING EVENTS section in your context: any payments due, inspections, deliveries, or other events in the next 7 days. List project priorities and calendar items together as one unified list of priorities. If UPCOMING EVENTS was provided in context, mention those dates and project names; if not, still list payment due dates from compare_projects upcomingPayments/overduePayments.'
            : '';
          const lastUserMsg = (messages.filter((m) => m.role === 'user').pop()?.content || '').toLowerCase();
          const isPaymentQuestion = /\b(when am I getting paid|next payment|upcoming payment|payments due|when.*getting paid|my next payment)\b/i.test(lastUserMsg);
          const hasPaymentTool = functionResultsSummary.some(r => r.functionName === 'compare_projects' || r.functionName === 'get_project_health');
          const paymentQuestionInstruction = (isPaymentQuestion && hasPaymentTool)
            ? ' CRITICAL: The user asked about payments or "when am I getting paid next". Answer from the TIMELINE data in the function results (upcomingPayments, overduePayments). Use this format: "Your next payment is the [payment name] for the [project title] project, amounting to $[amount], due on [date]." List the soonest payment first. You may end with: "Want me to check on any other upcoming payments or project details?"'
            : '';
          const calendarEventsInstruction = (routerResult && routerResult._calendarEventsIntent && hasPaymentTool)
            ? ' CRITICAL: The user asked about "upcoming events on the calendar". The dashboard calendar = (1) UPCOMING EVENTS in your context (inspections, deliveries, deadlines) and (2) upcoming payments from compare_projects. List ALL across projects — do NOT limit to one project. If UPCOMING EVENTS was provided, list those first, then upcoming payments. If no calendar events in context, list upcoming payments from compare_projects as the calendar (payments, deadlines). Do NOT say "no events for [project name]" or direct to Timeline tab only — answer from dashboard calendar data and compare_projects.'
            : '';
          messages.push({
            role: 'system',
            content: `IMPORTANT: All function calls succeeded (success: true). The actions were completed successfully. Confirm what was done. DO NOT say there's an issue. DO NOT show budget overview or other project information unless the user specifically asked for it.${poReceivedInstruction}${teamMessageInstruction}${losingMoneyInstruction}${completedProjectsInstruction}${overBudgetInstruction}${focusTodayInstruction}${paymentQuestionInstruction}${calendarEventsInstruction}`
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
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.3,
        max_tokens: 2000,
      }), 30000, 'final_llm');
      logPhase('final_llm_done');

      reply = completion.choices[0].message.content || 'Sorry, I could not generate a response.';

      // CRITICAL: When we ran scenario analysis (all three presets), use the tool's message so user sees Typical Friction / Bad Remodel / Smooth Job — not the LLM's generic summary
      if (scenarioAnalysisReply) {
        reply = scenarioAnalysisReply;
        if (process.env.DEBUG_AI_CONTEXT) console.log('🛡️ Scenario: using tool result as reply (all three scenarios)');
      }
      
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
    const parsedStep1 = parseEstimateStep1CustomerInfo(message);
    const step1Action = buildUpdateCustomerInfoAction(parsedStep1);
    const isEstimateMutationInput =
      isEstimateAssistantScreen(parsedContext) &&
      (messageLooksLikeEstimateMutation(message, extractEstimateCostItems(message)) ||
        (looksLikeCustomerInfoSubmission(message) && !!step1Action));
    const isHealthCheck = !isExpenseLogging && !isEstimateMutationInput && (
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
        !isExpenseFlow && // NEVER inject delivery date when user is logging labor/material expense
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

    // Handle OpenAI connection/network errors (ENOTFOUND, ECONNREFUSED, etc.)
    const cause = err?.cause || err;
    const isNetworkError =
      err?.name === 'APIConnectionError' ||
      cause?.code === 'ENOTFOUND' ||
      cause?.code === 'ECONNREFUSED' ||
      cause?.code === 'ETIMEDOUT' ||
      cause?.code === 'ENETUNREACH' ||
      /getaddrinfo|connection|network|fetch failed/i.test(String(err?.message || cause?.message || ''));
    if (isNetworkError) {
      return res.status(503).json({
        error: 'AI service unreachable',
        message: "Can't reach OpenAI. Check your internet connection and that api.openai.com is accessible. If you're on a VPN or restricted network, try disconnecting or using a different network.",
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

router.__testUtils = {
  normalizeProjectSearchText,
  rankProjectsByQuery,
  resolveProjectByQuery,
  isCurrentProjectMatch,
  getProjectFinancialSnapshot,
  collectPaymentBuckets,
  buildPaymentStatusReply,
  buildMarginReplyForProject,
  isPortfolioLosingMoneyQuery,
  isPortfolioOverBudgetListQuery,
  isSimpleProjectBudgetStatusQuery,
  isPortfolioCompareActiveQuery,
  isPortfolioWorstProjectQuery,
  sortCompareProjectsResults,
  runCompareProjectsPipeline,
  appendDataFreshness,
  buildPortfolioNextActions,
};

module.exports = router;
