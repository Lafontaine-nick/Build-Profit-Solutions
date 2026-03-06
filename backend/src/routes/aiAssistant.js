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
// STAGE 1: ROUTER — determines intent and checks required fields before any tool call
// Returns structured JSON so we skip keyword heuristics entirely.
// ─────────────────────────────────────────────────────────────────────────────
async function runRouter(message, history, ctxSummary) {
  const routerSystem = buildRouterPrompt();

  try {
    // Keep more context so multi-turn PO flows don't lose earlier amount/vendor/category/date.
    const recentHistory = history.slice(-12).filter(m => ['user','assistant'].includes(m.role));
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: routerSystem },
        ...recentHistory,
        { role: 'user', content: `Context: ${JSON.stringify(ctxSummary)}\nUser message: "${message}"` }
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

    const { message, context, history = [], user_settings = {} } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

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
    let projectId = parsedContext.projectId || parsedContext.activeProjectId || parsedContext.resolvedProjectId;
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
        reply += `➡️ Want me to add these as estimate line items now?`;
      }

      return res.json({ reply, actions: [] });
    }

    // ── DETERMINISTIC: Forecast final profit (bypass LLM variability) ─────────
    const isForecastRequest =
      msgLower.includes('forecast final profit') ||
      msgLower.includes('forecast profit') ||
      msgLower.includes('final profit') ||
      msgLower.includes('forecast final cost') ||
      (msgLower.includes('forecast') && msgLower.includes('profit')) ||
      (msgLower.includes('forecast') && msgLower.includes('cost'));

    if (isForecastRequest) {
      const changeOrders = parsedContext.changeOrders || currentProjectData?.changeOrders || [];
      const approvedChangeOrdersTotal = Array.isArray(changeOrders)
        ? changeOrders.reduce((sum, co) => {
            const amount = Number(co?.amount || 0);
            const isApproved =
              (typeof co?.approved === 'boolean' && co.approved) ||
              (typeof co?.status === 'string' && co.status.toLowerCase() === 'approved');
            return isApproved ? sum + amount : sum;
          }, 0)
        : 0;

      // Contract value = bid + approved COs (if COs not already reflected in bid).
      // If bid already contains COs, this still works as long as COs are 0 in that case.
      const contractValue = Number(bidTotal || 0) + Number(approvedChangeOrdersTotal || 0);
      const baseEstimate = Number(estimatedCost || estimateData?.totalCost || estimateData?.baseCost || 0);
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

      const likelyProfit = contractValue - likelyFinalCost;
      const optimisticProfit = contractValue - optimisticFinalCost;
      const conservativeProfit = contractValue - conservativeFinalCost;

      const optimisticDelta = optimisticFinalCost - contractValue;
      const likelyDelta = likelyFinalCost - contractValue;
      const conservativeDelta = conservativeFinalCost - contractValue;
      const fmtDelta = (delta) => {
        if (Math.abs(delta) < 1) return 'On budget';
        return delta > 0
          ? `Over budget by $${Math.round(delta).toLocaleString()}`
          : `Under budget by $${Math.round(Math.abs(delta)).toLocaleString()}`;
      };

      const likelyMarginPct = contractValue > 0 ? (likelyProfit / contractValue) * 100 : 0;
      const optimisticMarginPct = contractValue > 0 ? (optimisticProfit / contractValue) * 100 : 0;
      const conservativeMarginPct = contractValue > 0 ? (conservativeProfit / contractValue) * 100 : 0;

      const drivers = [];
      if (committedNotInActual > 0) drivers.push(`$${Math.round(committedNotInActual).toLocaleString()} in committed POs may convert to actual costs.`);
      if (laborBudgetMain > 0 && laborSpentMain / laborBudgetMain > 0.75) {
        drivers.push(`Labor burn is high (${Math.round((laborSpentMain / laborBudgetMain) * 100)}% used).`);
      }
      if (materialBudget > 0 && materialSpent / materialBudget > 0.75) {
        drivers.push(`Material burn is high (${Math.round((materialSpent / materialBudget) * 100)}% used).`);
      }
      if (drivers.length === 0) drivers.push('Current burn appears consistent with the budget baseline.');

      let reply = `📈 Forecast final cost & profit for ${projectName ? `"${projectName}"` : 'this project'}:\n\n`;
      reply += `📊 Baseline:\n`;
      reply += `- Contract Value (Bid + approved COs): $${Math.round(contractValue).toLocaleString()}\n`;
      reply += `- Estimated Cost Baseline: $${Math.round(baseEstimate).toLocaleString()}\n`;
      reply += `- Actual Spent to Date: $${Math.round(actual).toLocaleString()}\n`;
      reply += `- Progress: ${progressPct.toFixed(0)}%\n`;
      reply += `- Method: ${forecastMethod}\n\n`;

      reply += `💰 Forecast (EAC):\n`;
      reply += `- Optimistic Final Cost: $${Math.round(optimisticFinalCost).toLocaleString()} (${fmtDelta(optimisticDelta)}) → Profit: $${Math.round(optimisticProfit).toLocaleString()} (${optimisticMarginPct.toFixed(1)}%)\n`;
      reply += `- Likely Final Cost: $${Math.round(likelyFinalCost).toLocaleString()} (${fmtDelta(likelyDelta)}) → Profit: $${Math.round(likelyProfit).toLocaleString()} (${likelyMarginPct.toFixed(1)}%)\n`;
      reply += `- Worst-case (risk-adjusted) Final Cost: $${Math.round(conservativeFinalCost).toLocaleString()} (${fmtDelta(conservativeDelta)}) → Profit: $${Math.round(conservativeProfit).toLocaleString()} (${conservativeMarginPct.toFixed(1)}%)\n\n`;

      reply += `⚠️ Key drivers:\n`;
      drivers.slice(0, 3).forEach((d, i) => {
        reply += `${i + 1}. ${d}\n`;
      });
      reply += `\n➡️ Want me to run a what-if scenario (materials +10%, labor +10%, or bad-remodel) to pressure-test this forecast?`;

      return res.json({ reply, actions: [] });
    }
    
    const isEstimate = ['estimate', 'draft', 'bid_submitted', 'submitted'].includes(status.toLowerCase());
    const isActiveProject = ['won', 'active', 'in_progress', 'in-progress', 'completed'].includes(status.toLowerCase());

    // ── BUILD SYSTEM PROMPT using modular prompt system ──
    const pmAlerts = aiPmMode ? runProactiveIntelligence(parsedContext) : [];
    let systemPrompt = buildSystemPrompt({
      projectName, projectId, status,
      bidTotal, estimatedCost, actualCost,
      materialBudget, materialSpent, materialRemaining,
      laborBudget: laborBudgetMain, laborSpent: laborSpentMain, laborRemaining: laborRemainingMain,
      progress, aiPmMode, pmAlerts,
      screen: parsedContext.screen || 'assistant_tab',
    });

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
                description: 'The vendor or store where the material was purchased. Extract from user message if mentioned (e.g., "Home Depot", "Lowe\'s", "at home depot" → "Home Depot"). REQUIRED for MATERIALS - if missing, ask the user "Where was it purchased?" before calling the function. NOT required for LABOR expenses.',
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
          description: 'Run a what-if scenario analysis on the project. Use when user asks "what if materials go up 10%?", "what if labor increases?", "bad remodel scenario", "smooth job scenario", "what happens if costs rise?".',
          parameters: {
            type: 'object',
            properties: {
              projectId: { type: 'string', description: `Project ID. ${projectId ? `Use "${projectId}".` : 'Required.'}` },
              scenario: { type: 'string', enum: ['labor_up_10', 'labor_down_10', 'materials_up_5', 'materials_up_10', 'materials_down_5', 'overhead_up_10', 'overhead_down_10', 'bid_up_2', 'bid_down_2', 'typical_friction', 'bad_remodel', 'smooth_job', 'custom'], description: 'The scenario to run. Use "custom" for arbitrary adjustments.' },
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

    // Helper function to execute get_project_by_name
    async function executeGetProjectByName(args) {
      try {
        if (!args.projectName) {
          return { success: false, error: 'Project name is required' };
        }

        // Search in allProjects array
        if (allProjects && Array.isArray(allProjects)) {
          const found = allProjects.find(p => {
            const title = (p.title || p.name || '').toLowerCase().trim();
            const searchName = args.projectName.toLowerCase().trim();
            return title === searchName || title.includes(searchName) || searchName.includes(title);
          });

          if (found) {
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
              message: `Found project "${found.title || found.name}" (${projectStatus}).`,
            };
          }
        }
        
        return {
          success: false,
          error: `Could not find a project named "${args.projectName}". Please check the project name and try again.`,
        };
      } catch (error) {
        console.error('Error in executeGetProjectByName:', error);
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
          if (args.notes && args.notes.trim()) {
            vendor = args.notes.trim(); // Use notes (trade) as vendor for labor
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
          // Description can be in notes if provided, otherwise use the trade
          normalizedCategory = 'Labor';
          materialName = args.notes && args.notes.trim() ? args.notes.trim() : 'Labor';
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

    // Track actions from function calls (for purchase orders, etc.) - declare BEFORE use
    let actions = [];
    const allUserMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = allUserMessages[allUserMessages.length - 1];
    const lastUserContent = (lastUserMessage?.content || '').toLowerCase();
    const allMessagesText = messages.map(m => m.content || '').join(' ').toLowerCase();

    // ── PRE-ROUTER: EXPENSE LOGGING DETECTION ──────────────────────────────
    // Catch expense logging requests BEFORE router runs to prevent misclassification
    const messageLower = String(message || '').toLowerCase();
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
    const combinedMessageForExpense = (messageLower + ' ' + lastUserContent).toLowerCase();
    
    // More flexible detection - check for "log" + "expense" anywhere in the message
    // Handles patterns like "can you log an expense", "i need to log an expense", "log expense", etc.
    const hasLogKeywordForExpense = /\b(log|record|add)\b/i.test(combinedMessageForExpense);
    const hasExpenseKeywordForExpense = /\bexpense/i.test(combinedMessageForExpense) || 
                              /\b(spent|bought|purchased)\b/i.test(combinedMessageForExpense);
    const isExpenseLoggingRequest = hasLogKeywordForExpense && hasExpenseKeywordForExpense;
    
    // Check if expense type is already specified (materials/labor)
    const hasExpenseType = /\b(material|materials|labor|labour)\b/i.test(combinedMessageForExpense);
    
    console.log('🔍 Expense logging detection:', { 
      isExpenseLoggingRequest, 
      hasExpenseType,
      hasLogKeywordForExpense,
      hasExpenseKeywordForExpense,
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
    
    // ── EXPENSE LOGGING GUARD (similar to CO guard) ──────────────────────────
    // If user wants to log an expense but hasn't specified material/labor, force the question
    if (isExpenseLoggingRequest && !hasExpenseType) {
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
    const isChangeOrderFlowActive =
      changeOrderIntentRegex.test(String(message || '').toLowerCase()) ||
      lastAssistantCOPrompt ||
      hasCOIntentInHistory;

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
              .map((m) => `"${m.title || m.name}"`)
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
              .map((m) => `"${m.title || m.name}"`)
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
    if (isExpenseLoggingRequest && !hasExpenseType) {
      // Force expense logging intent - override any other domain
      if (routerResult.domain !== 'expenses' || !routerResult.required_fields_missing?.includes('expense_type')) {
        console.log('🛡️ Final expense guard: forcing expense domain and required field');
        routerResult.domain = 'expenses';
        routerResult.proposed_tool = 'add_material_expense';
        routerResult.required_fields_missing = ['expense_type'];
        routerResult.clarification_question = 'What type of expense are you logging? Is it for materials or labor? If it\'s for materials, please provide the amount, category, and vendor. If it\'s for labor, please provide the amount, category (Labor), and what the labor was for.';
        routerResult.confidence = 0.95;
      }
    }

    logPhase('router_done', { domain: routerResult?.domain, proposedTool: routerResult?.proposed_tool });
    console.log('🧭 Router:', JSON.stringify({ domain: routerResult.domain, tool: routerResult.proposed_tool, missing: routerResult.required_fields_missing, confidence: routerResult.confidence }));

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
      messages.push(completion.choices[0].message);

      // Track project lookup results to use in subsequent calls
      let resolvedProjectInfo = null;

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
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
          
          // Check if notes are missing (for labor)
          if (isLabor && (!functionArgs.notes || !functionArgs.notes.trim())) {
            console.error('🚫 PRE-VALIDATION: No notes provided for labor expense - blocking function call');
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                status: 'error',
                error: `Notes are required for labor expenses. Please ask the user "What was the labor expense for?" (e.g., "framing", "drywall installation", "painting") before calling add_material_expense.`,
                requiresNotes: true,
                message: `I need to know what the labor was for. What was the labor expense for?`
              })
            });
            continue; // Skip executing this function call
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
            // For labor expenses, require notes (what labor was for) - this will go in vendor field
            // The vendor field in the UI is labeled "Sub / Trade" for labor expenses
            if (!functionArgs.notes || !functionArgs.notes.trim()) {
              console.error('❌ CRITICAL: Notes (what labor was for) is missing for labor expense', {
                notes: functionArgs.notes,
                category: functionArgs.category
              });
              
              functionResult = {
                success: false,
                status: 'error',
                error: `For labor expenses, you need to know what the labor was for. Please ask the user "What was the labor expense for?" (e.g., "framing", "drywall installation", "painting", "Tile work") and then call add_material_expense with the notes field. The trade will be stored in the vendor field (which displays as "Sub / Trade" in the UI).`,
                requiresNotes: true
              };
            } else {
              // Labor expense has notes (trade), proceed - it will be stored in vendor field
              console.log('✅ Labor expense has trade/notes, will store in vendor field (Sub/Trade)');
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
          const materialCost = Number(ctx.materialBudgetDirect || estimateData.materialTotal || 0);
          const laborCost = Number(estimateData.laborTotal || 5000);
          const overheadCost = Number(estimateData.overheadTotal || 0);
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
            const availableNames = pendingPayments.map(m => `"${m.title}"`).join(', ');
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
          
          messages.push({
            role: 'system',
            content: `IMPORTANT: All function calls succeeded (success: true). The actions were completed successfully. Confirm what was done. DO NOT say there's an issue.${poReceivedInstruction}`
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
      const estMarginPct = bidTotal > 0 && estimatedCost > 0 ? ((bidTotal - estimatedCost) / bidTotal * 100) : 0;
      const curMarginPct = bidTotal > 0 && actualCost > 0 ? ((bidTotal - actualCost) / bidTotal * 100) : estMarginPct;
      const forecastProfit = bidTotal > 0 ? bidTotal - (actualCost > 0 ? actualCost : estimatedCost) : 0;
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
      else if (curMarginPct < 10 && bidTotal > 0) { riskLevel = 'Medium'; riskReason = `Current margin (${curMarginPct.toFixed(1)}%) is below 10% target.`; }
      
      // Budget status
      let budgetStatus = estimatedCost > 0 ? (spentPct < 50 ? 'On Track' : spentPct < 90 ? 'Watch' : 'Over') : 'Data needed';
      let marginStatus = bidTotal > 0 ? `${curMarginPct.toFixed(1)}%` : 'Data needed';
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
    
    const responseData = {
      reply,
      ...(projectUpdateData ? { projectUpdate: projectUpdateData } : {}),
      ...(actions.length > 0 ? { actions: actions } : {}),
      ...(analysisCard ? { analysisCard } : {}),
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
