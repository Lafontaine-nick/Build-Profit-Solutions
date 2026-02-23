const express = require('express');
const router = express.Router();
const axios = require('axios');
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/ai-assistant
 * AI Assistant endpoint for project management
 */
router.post('/', async (req, res) => {
  try {
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
    const bidTotal = parsedContext.bidTotal || parsedContext.total || parsedContext.estimatedCost || parsedContext.bidPrice || currentProjectData?.bidTotal || currentProjectData?.bidPrice || currentProjectData?.estimatedCost || 0;
    const estimatedCost = parsedContext.estimatedCost || parsedContext.bidPrice || currentProjectData?.estimatedCost || currentProjectData?.bidPrice || 0;
    const actualCost = parsedContext.actualCost || parsedContext.totalSpent || currentProjectData?.actualCost || currentProjectData?.totalSpent || 0;
    const expenses = parsedContext.expenses || currentProjectData?.expenses || [];
    const expensesCount = expenses.length;
    const margin = parsedContext.margin || currentProjectData?.margin || 0;
    const markup = parsedContext.markup || currentProjectData?.markup || 0;
    const overhead = parsedContext.overhead || currentProjectData?.overhead || 0;
    const progress = parsedContext.progress || currentProjectData?.progress || currentProjectData?.overallProgressPct || 0;
    const activeTab = parsedContext.activeTab || '';
    
    const isEstimate = ['estimate', 'draft', 'bid_submitted', 'submitted'].includes(status.toLowerCase());
    const isActiveProject = ['won', 'active', 'in_progress', 'in-progress', 'completed'].includes(status.toLowerCase());

    // SIMPLIFIED SYSTEM PROMPT - Focus on extraction and action
    let systemPrompt = `You are an AI assistant for Build Profit Solutions construction project management app.

**🚨 CRITICAL RULE - NEVER MENTION AMOUNTS UNLESS USER PROVIDED THEM 🚨**
**NEVER mention any dollar amount ($350, $500, $1000, etc.) in your response unless the user explicitly provided that amount in their message. If the user didn't mention an amount, DO NOT say any number. Simply ask "How much is [the purchase order/expense/etc.] for?" without mentioning any specific dollar amount.**

**YOUR JOB: Extract information and call functions to perform actions.**

**🚨 CRITICAL: ALWAYS ASK FOR MISSING INFORMATION 🚨**
**BEFORE CALLING ANY FUNCTION, CHECK IF ALL REQUIRED FIELDS ARE PRESENT:**
- **Amount:** If NO number is in the user's message → ALWAYS ask "How much is this for?" or "What is the amount?"
- **Category/Material:** If NO material name or "labor" mentioned → ALWAYS ask "What is this for?" or "What material is this for?"
- **Vendor:** For MATERIALS, if NO vendor mentioned → ALWAYS ask "Where was it purchased?" or "Where did you buy this from?"
- **Notes:** For LABOR, if NO description of what labor was for → ALWAYS ask "What was the labor expense for?"

**BEFORE YOU ASK ANY QUESTIONS - READ THE USER'S MESSAGE CAREFULLY:**
- For EXPENSES (material purchases, labor): If the message contains a number (like "500", "$300", "1200"), that number IS the amount - extract it immediately
- Example: "Let's add 500 material spent" → amount = 500 (DO NOT ask "How much?" - the number is right there!)
- Example: "add 1200 for labor" → amount = 1200 (DO NOT ask "How much?" - the number is right there!)
- For PURCHASE ORDERS: ALWAYS ask for amount if not explicitly provided with indicators ($, "dollars", etc.)
- **CRITICAL: If ANY required field is missing, you MUST ask for it BEFORE calling the function**

**STEP 1: EXTRACT INFORMATION FROM USER MESSAGE**
Read the user's ENTIRE message CAREFULLY and extract ALL information:

**AMOUNT EXTRACTION - CRITICAL (FOR EXPENSES ONLY):**
For material purchases and labor expenses, look for ANY number in the message. The number IS the amount. Examples:
  * "Let's add 500 material spent" → amount = 500 (the number "500" is in the message)
  * "add 1200" → amount = 1200
  * "1200 material" → amount = 1200
  * "1200 for" → amount = 1200
  * "$1200" → amount = 1200
  * "spent 500" → amount = 500
  * "500 spent" → amount = 500
  * "Let's add 800 for labor" → amount = 800 (the number "800" is in the message)
  
**CRITICAL RULE FOR EXPENSES:** If the user's message contains ANY number (like "500", "1200", "$300"), that number IS the amount. DO NOT ask "How much did you spend?" if you see a number in their message. Extract it immediately.

**CRITICAL RULE FOR PURCHASE ORDERS:** NEVER extract amounts for purchase orders unless the user explicitly provides them with clear indicators ($, "dollars", "for $X"). If the user says "Create me a purchase order" without an amount, you MUST ask "How much is the purchase order for?" first.
- Category/Type: 
  * If user says "labor", "labor expense", "for labor", "on labor" → category is "Labor"
  * If user says "material", "materials", "drywall", "lumber", "tile" → category is the material name (e.g., "Drywall", "Lumber")
- Vendor: 
  * For MATERIALS: Look for "Home Depot", "at home depot", "from lowes" → extract "Home Depot" or "Lowe's". REQUIRED - if missing, ask "Where was it purchased?"
  * For LABOR: Vendor is NOT required. Instead, ask "What was the labor expense for?" to get details about what the labor was for (e.g., "framing", "drywall installation", "painting")
- Project: ${projectName ? `You're in project "${projectName}" (ID: ${projectId || 'lookup needed'}) - USE THIS PROJECT. DO NOT ask which project.` : 'If no project, ask "Which project is this for?"'}

**STEP 2: DO NOT CALL FUNCTION UNTIL YOU HAVE ALL REQUIRED INFO**
REQUIRED FIELDS:
- For MATERIALS: amount (NUMBER) + category (material name) + ${projectId ? `projectId "${projectId}"` : 'projectId (STRING)'} + vendor (STRING)
- For LABOR: amount (NUMBER) + category ("Labor") + ${projectId ? `projectId "${projectId}"` : 'projectId (STRING)'} + notes (STRING - what the labor was for, e.g., "framing", "drywall installation")

**🚨 CRITICAL RULES - ALWAYS ASK FOR MISSING INFORMATION:**
→ **STEP 1:** Check if amount is in the message (any number like "500", "1200", "$300") - if YES, extract it. If NO number at all → **ALWAYS ask "How much is this for?" or "What is the amount?"** - DO NOT call function without amount
→ **STEP 2:** Check if category/material is in the message - if NO material name and NO "labor" → **ALWAYS ask "What is this for?" or "What material is this for?"** - DO NOT call function without category
→ **STEP 3:** For MATERIALS: Check if vendor is in the message - if NO vendor mentioned → **ALWAYS ask "Where was it purchased?" or "Where did you buy this from?"** - DO NOT call function without vendor
→ **STEP 4:** For LABOR: Check if notes (what labor was for) is in the message - if NO description → **ALWAYS ask "What was the labor expense for?"** - DO NOT call function without notes (vendor is NOT required for labor)
→ **STEP 5:** Only AFTER you have ALL required fields → call the function ONCE with ALL information
→ For PURCHASE ORDERS, only extract if amount has explicit indicators ($, "dollars", "for $X"). If missing → **ALWAYS ask "How much is the purchase order for?"**
→ DO NOT call any function if required fields are missing - ALWAYS ask for missing information first
→ DO NOT confirm anything until the function is called AND returns success: true
→ DO NOT say "I've recorded" or "Got it!" before calling the function
→ DO NOT say "I've recorded" if you haven't seen success: true in the function result

**ONLY CALL FUNCTION WHEN:**
- You have amount (number) - extract ANY number from the message (e.g., "add 500", "500 material", "$500", "spent 500", "500 for", "Let's add 500 material spent" → extract 500)
- You have category (string) - "Labor" for labor expenses, or material name for materials
- You have ${projectId ? `projectId "${projectId}"` : 'projectId (from get_project_by_name if needed)'} - ${projectId ? `ALWAYS use "${projectId}" from context` : 'lookup if needed'}
- For MATERIALS: You have vendor (string) - extract from message or ask "Where was it purchased?"
- For LABOR: You have notes (string) describing what the labor was for - ask "What was the labor expense for?" if missing (vendor is NOT required for labor)
→ Then call add_material_expense ONCE with ALL information

${projectId ? `**CRITICAL: The projectId is "${projectId}" - you MUST include this in the function call. DO NOT call the function without projectId.**` : ''}

**WHEN TO ASK FOR INFORMATION:**
- No amount → ask "How much did you spend?" or "What is the amount?" (DO NOT call function without amount)
- No category (no material and no "labor") → ask "What is this for?" or "What material is this for?" (DO NOT call function without category)
- For MATERIALS: No vendor → ask "Where was it purchased?" or "Where did you buy this from?" (DO NOT call function without vendor)
- For LABOR: No notes (what labor was for) → ask "What was the labor expense for?" (DO NOT call function without notes - vendor is NOT required for labor)
- No project → ${projectId ? `You have projectId "${projectId}" - USE IT, DO NOT ask` : 'ask "Which project is this for?" or use get_project_by_name'}

**CURRENT PROJECT:**
${projectName ? `- Project: "${projectName}" (ID: ${projectId || 'lookup needed'})` : '- No project in context'}
${status ? `- Status: ${status}` : ''}
${bidTotal > 0 ? `- Budget: $${bidTotal.toLocaleString()}` : ''}

**WHEN USER SAYS "PURCHASE ORDER", "PO", "ORDER", "PLACE AN ORDER", "CREATE A PO", "CREATE ME A PURCHASE ORDER":**
→ **🚨 HARD RULE: NEVER INVENT OR ASSUME MISSING VALUES (amount, vendor, category) 🚨**
→ **REQUIRED FIELDS TO CREATE A PO: category (string), amount (number > 0), vendor (string)**
→ **STEP 1: Check if amount is explicitly in the CURRENT user message - if NO amount mentioned → ALWAYS ask "How much is the purchase order for?" - DO NOT call function**
→ **STEP 2: Check if category is explicitly in the CURRENT user message - if NO category mentioned → ALWAYS ask "What category is this for?" - DO NOT call function**
→ **STEP 3: Check if vendor is explicitly in the CURRENT user message - if NO vendor mentioned → ALWAYS ask "Which vendor is this from?" - DO NOT call function**
→ **STEP 4: Only AFTER you have ALL required fields explicitly provided in user messages → call add_purchase_order ONCE**
→ **NEVER extract amounts from previous messages or conversation context - ONLY use amounts explicitly stated in the current message**
→ **NEVER use placeholder amounts (350, 500, 1000, etc.) - if user doesn't provide amount, ask for it**
→ **NEVER mention any dollar amount in your response unless the user explicitly provided it in their message**
→ **NEVER guess or assume - if any required field is missing, ask for it before calling the function**
→ **DO NOT say you created a PO unless the function call succeeded (success: true)**
→ Purchase orders start as "Pending" and show in "Committed POs" in the budget
→ When received, they convert to actual expenses

**WHEN USER SAYS "MARK AS RECEIVED", "MARK PO AS RECEIVED", "RECEIVED", "GOT IT", "DELIVERED", "MARK [PO NUMBER] AS RECEIVED", "OK GREAT CAN YOU MARK AS RECEIVED", "CAN YOU MARK THIS RECEIVED", "MAR THIS PURCHASE ORDER AS RECIEVED" (typos like "mar" and "recieved"), "OK CAN YOU MARK THIS PO AS RECIEVED", "CAN YOU MARK AS RECIEVED", "MARK IT AS RECIEVED":**
→ **CRITICAL: DO NOT CREATE A NEW PURCHASE ORDER - the user wants to mark an EXISTING one as received**
→ **CRITICAL: DO NOT call add_purchase_order when user says "mark as received" - that creates a NEW PO, which is wrong**
→ **YOU MUST CALL mark_purchase_order_received function when user says "mark as received"**
→ **CRITICAL: DO NOT say "I've created purchase order" when user asks to mark one as received - that's creating a NEW PO, which is WRONG**
→ **If the user says "mar" or "recieved" (typos), they still mean "mark as received" - call mark_purchase_order_received**
→ **NEVER call add_purchase_order when user asks to mark something as received**
→ **ALWAYS call mark_purchase_order_received when user asks to mark something as received**
→ **NEVER say you created a purchase order when user asks to mark one as received**

**WHEN USER SAYS "SPENT", "BOUGHT", "PURCHASED", "PAID", "EXPENSE", "ADD", "FOR LABOR", "LABOR EXPENSE":**
→ Use add_material_expense function (creates expense transaction - actual money spent)
→ For labor: category = "Labor", vendor = extract from message or ask "Where was it purchased?"
→ For materials: category = material name (e.g., "Drywall"), vendor = extract from message or ask "Where was it purchased?"
→ This appears in expense transactions immediately
→ DO NOT use add_purchase_order for expenses - use add_material_expense
→ Call the function ONCE with ALL information (amount, category, vendor, projectId)
→ DO NOT call the function multiple times - gather all info first, then call once
→ ${projectId ? `ALWAYS use projectId "${projectId}" from context - DO NOT ask which project` : ''}

**CRITICAL: NEVER CONFIRM BEFORE FUNCTION SUCCEEDS**
→ DO NOT say "I've recorded" or "Got it!" until you see success: true in the function result
→ DO NOT confirm anything before calling the function
→ DO NOT say you did something if you haven't called the function yet
→ DO NOT say "I've recorded the material spend" if you haven't called the function
→ Call the function, wait for the result, check success: true, THEN confirm

**AFTER FUNCTION SUCCEEDS (success: true):**
→ ONLY THEN say: "Got it! I've recorded $X for [material] from [vendor]."
→ If you already confirmed something worked (success: true), DO NOT say there's an issue later
→ If success: true, the expense was added - trust it, don't check again

**CRITICAL: READING FUNCTION RESULTS**
→ Check the "success" field in the function result
→ Check the "status" field: "success" means it worked, "error" means it failed

**STEP 3: READ FUNCTION RESULT AND RESPOND**
After calling the function, you will receive a result with a "success" field.

**IF success: true:**
→ The expense was added successfully
→ Say: "Got it! I've recorded $X for [material] from [vendor]."
→ DO NOT say there's an issue - it worked!
→ DO NOT check again - trust the result

**IF success: false:**
→ Read the "error" field to see what went wrong
→ Explain the specific error to the user
→ If error says "Project ID is missing", use get_project_by_name to find the project, then retry
→ DO NOT say "there was an issue" - explain the actual error

**IF FUNCTION FAILS (success: false, status: "error"):**
→ Read the EXACT error message from the "error" or "errorMessage" field
→ If the error says "requiresProjectLookup: true", you MUST call get_project_by_name FIRST with the projectName, then call add_material_expense again with the projectId you got
→ Tell the user what went wrong in plain language
→ If it's a project ID issue, use get_project_by_name to find the project, then retry add_material_expense
→ If it's authentication, tell them to log in again
→ NEVER say "there was an issue" or "there is an issue" - always explain the specific error and what you're doing to fix it
→ If you need to look up a project, say: "Let me find the project first..." then call get_project_by_name, then proceed

**NEVER CONTRADICT YOURSELF - CRITICAL RULES:**
→ If a function returns success: true, the action worked - don't say it failed
→ If you just confirmed something worked (success: true), NEVER say there's an issue in the next message
→ If you said "I've recorded $X", that means success: true - don't then say there's an issue
→ If you already confirmed "Got it! I've recorded...", the expense was added - don't check again
→ If the function result has confirmed: true, the action is done - don't call the function again
→ Trust the function results - if success: true, proceed confidently
→ Only report errors when success: false
→ If you already confirmed something worked, don't check again or say there's an issue - it worked!
→ NEVER say "there was an issue" or "there is an issue" after you already said "I've recorded" - that's a contradiction
→ NEVER call the same function twice for the same expense - if you already called add_material_expense and got success: true, don't call it again

**NEVER:**
- Ask for information already in the message
- Give instructions instead of calling functions
- Say you did something before calling the function
- Say "there was an issue" without explaining the actual error`;

    // Build messages array from history + new message
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.filter(m => m.role && m.content),
      { role: 'user', content: message },
    ];

    // Define available functions for the AI
    const functions = [
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
                description: 'Expected delivery date in ISO format (YYYY-MM-DD). Optional.',
              },
            },
            required: projectId ? ['amount', 'vendor', 'category', 'projectId'] : ['amount', 'vendor', 'category'],
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
    ];

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
            // Check for explicit patterns: "$350", "350 dollars", "for $350", "350", etc.
            const amountPattern = new RegExp(`(?:\\$|dollars?|for\\s+\\$?)\\s*${args.amount}\\b|\\b${args.amount}\\s*(?:dollars?|\\$)`, 'i');
            const isPlainNumber = msgContent.trim() === String(args.amount);
            // Check if previous assistant message asked for amount
            const msgIndex = messages.indexOf(userMsg);
            const prevAssistantMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'assistant');
            const prevAssistantAsked = prevAssistantMsg?.content?.toLowerCase().includes('how much');
            
            if (amountPattern.test(msgContent) || (isPlainNumber && prevAssistantAsked)) {
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
          message: `I've created purchase order ${poNumber} for $${args.amount.toFixed(2)} from ${args.vendor}. It will appear in "Committed POs" in your budget. When you receive it, mark it as received and it will be added to your actual expenses.`,
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
    
    // Check if user is asking for a purchase order - check ALL user messages, not just the last one
    // This handles multi-turn conversations where the user says "add a purchase order" first,
    // then provides details in subsequent messages
    const allUserMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = allUserMessages[allUserMessages.length - 1];
    const allAssistantMessages = messages.filter(m => m.role === 'assistant');
    const lastAssistantMessage = allAssistantMessages[allAssistantMessages.length - 1];
    const previousAssistantMessage = allAssistantMessages[allAssistantMessages.length - 2]; // The one before the last
    
    // Check if user originally asked for a PO (in any previous message)
    const userEverAskedForPO = allUserMessages.some(msg => {
      const content = msg.content?.toLowerCase() || '';
      return content.includes('purchase order') ||
             content.match(/\bpo\b/i) ||
             content.includes('place an order') ||
             content.includes('create a po') ||
             content.includes('add a purchase order');
    });
    
    // Check if AI is asking for PO-related info (vendor, category, amount)
    const aiAskingForPOInfo = lastAssistantMessage?.content?.toLowerCase().includes('vendor') ||
                              lastAssistantMessage?.content?.toLowerCase().includes('category') ||
                              lastAssistantMessage?.content?.toLowerCase().includes('amount') ||
                              lastAssistantMessage?.content?.toLowerCase().includes('purchase order');
    
    // Check if user just provided an answer (not asking a question)
    const lastUserContent = lastUserMessage?.content?.toLowerCase() || '';
    const userProvidedAnswer = lastUserContent.length > 0 && 
                              !lastUserContent.includes('?') &&
                              !lastUserContent.includes('what') &&
                              !lastUserContent.includes('which') &&
                              !lastUserContent.includes('how');
    
    // Check if AI asked for vendor or category in recent messages (check both last and previous)
    const lastAssistantContent = lastAssistantMessage?.content?.toLowerCase() || '';
    const previousAssistantContent = previousAssistantMessage?.content?.toLowerCase() || '';
    const combinedAssistantContent = (lastAssistantContent + ' ' + previousAssistantContent).toLowerCase();
    
    const aiAskedForVendor = combinedAssistantContent.includes('vendor') ||
                            combinedAssistantContent.includes('which vendor');
    const aiAskedForCategory = combinedAssistantContent.includes('category') ||
                              combinedAssistantContent.includes('what category');
    const aiAskedForAmount = combinedAssistantContent.includes('amount') ||
                            combinedAssistantContent.includes('how much');
    
    // Check if we have info in the conversation - be more aggressive
    const allMessagesText = messages.map(m => m.content || '').join(' ').toLowerCase();
    const hasAmountInConversation = /\$?\d+/.test(allMessagesText);
    
    // Check for vendor in user messages (more reliable than all messages)
    const userMessagesText = allUserMessages.map(m => m.content?.toLowerCase() || '').join(' ');
    const hasVendorInConversation = userMessagesText.includes('jones') ||
                                   userMessagesText.includes('home depot') ||
                                   userMessagesText.includes('lowes') ||
                                   userMessagesText.includes('paint') ||
                                   userMessagesText.includes('glass') ||
                                   // Check if last user message looks like a vendor name
                                   (lastUserContent.length > 2 && lastUserContent.length < 30 && 
                                    !lastUserContent.includes('?') && !lastUserContent.includes('what') &&
                                    !lastUserContent.includes('which') && !lastUserContent.match(/^\d+$/));
    
    const hasCategoryInConversation = allMessagesText.includes('windows') ||
                                     allMessagesText.includes('materials') ||
                                     allMessagesText.includes('labor') ||
                                     allMessagesText.includes('equipment');
    
    // Force function call if:
    // 1. User asked for a PO at some point, AND
    // 2. (AI just asked for vendor/category/amount AND user provided answer) OR (we have amount AND vendor), AND
    // 3. We have at least amount and vendor in the conversation, AND
    // 4. We haven't already created a PO action
    const hasPOAction = actions.some(a => a.type === 'add_purchase_order');
    
    // More aggressive: if we have amount and vendor, force the call
    const hasEnoughInfo = hasAmountInConversation && hasVendorInConversation;
    const aiAskedAndUserAnswered = (aiAskedForVendor || aiAskedForCategory || aiAskedForAmount) && userProvidedAnswer;
    
    // Check if user wants to mark a PO as received
    // Be VERY aggressive in detection - handle typos like "mar" instead of "mark" and "recieved" instead of "received"
    const lastUserMsgLower = lastUserMessage.toLowerCase();
    
    // Normalize common typos: "mar" -> "mark", "recieved" -> "received"
    const normalizedMsg = lastUserMsgLower
      .replace(/\bmar\b/g, 'mark')  // "mar" -> "mark"
      .replace(/\brecieved\b/g, 'received')  // "recieved" -> "received"
      .replace(/\brecieve\b/g, 'receive');  // "recieve" -> "receive"
    
    // CRITICAL: Check for "mark this PO" or "mark this po" - this is a common pattern
    const hasMarkThisPO = (normalizedMsg.includes('mark') && normalizedMsg.includes('this') && (normalizedMsg.includes('po') || normalizedMsg.includes('purchase order'))) ||
                          (lastUserMsgLower.includes('mark') && lastUserMsgLower.includes('this') && (lastUserMsgLower.includes('po') || lastUserMsgLower.includes('purchase order')));
    
    const userSaidMarkReceived = normalizedMsg.includes('mark as received') ||
                                 normalizedMsg.includes('mark received') ||
                                 normalizedMsg.includes('mark this received') ||
                                 normalizedMsg.includes('mark this as received') ||  // Explicitly check "mark this as received"
                                 normalizedMsg.includes('mark it received') ||
                                 normalizedMsg.includes('mark it as received') ||  // Explicitly check "mark it as received" - THIS IS THE KEY PATTERN
                                 normalizedMsg.includes('mark this po as received') ||
                                 normalizedMsg.includes('mark the po as received') ||
                                 normalizedMsg.includes('mark purchase order as received') ||
                                 normalizedMsg.includes('mark po as received') ||
                                 (normalizedMsg.includes('can you mark') && normalizedMsg.includes('received')) ||
                                 (normalizedMsg.includes('can you mark') && (normalizedMsg.includes('this') || normalizedMsg.includes('it')) && normalizedMsg.includes('received')) ||  // "can you mark this as received"
                                 (normalizedMsg.includes('can you mark') && hasMarkThisPO && (normalizedMsg.includes('received') || normalizedMsg.includes('recieved'))) ||  // "can you mark this PO as recieved"
                                 (normalizedMsg.includes('mark') && (normalizedMsg.includes('this') || normalizedMsg.includes('it')) && normalizedMsg.includes('received') && 
                                  !normalizedMsg.includes('create') &&
                                  !normalizedMsg.includes('add') &&
                                  !normalizedMsg.includes('record')) ||
                                 // Also check original message for "received" or "recieved" with "mar" or "mark"
                                 (lastUserMsgLower.includes('mar') && (lastUserMsgLower.includes('received') || lastUserMsgLower.includes('recieved'))) ||
                                 (lastUserMsgLower.includes('mark') && (lastUserMsgLower.includes('received') || lastUserMsgLower.includes('recieved'))) ||
                                 // CRITICAL: Check for "mark it as" with received/recieved (even with typo) - this catches "mark it as recieved"
                                 (normalizedMsg.includes('mark') && (normalizedMsg.includes('this') || normalizedMsg.includes('it')) && normalizedMsg.includes('as') && (normalizedMsg.includes('received') || lastUserMsgLower.includes('recieved'))) ||
                                 // CRITICAL: If user says "mark this PO" and mentions "received" or "recieved", they want to mark as received
                                 (hasMarkThisPO && (normalizedMsg.includes('received') || normalizedMsg.includes('recieved') || lastUserMsgLower.includes('received') || lastUserMsgLower.includes('recieved'))) ||
                                 // CRITICAL: Explicit check for "can you mark this PO as recieved" - this is the exact pattern the user is using
                                 (normalizedMsg.includes('can you mark') && hasMarkThisPO && (normalizedMsg.includes('received') || normalizedMsg.includes('recieved') || lastUserMsgLower.includes('received') || lastUserMsgLower.includes('recieved'))) ||
                                 // Also check original message for this pattern
                                 (lastUserMsgLower.includes('can you mark') && lastUserMsgLower.includes('this') && (lastUserMsgLower.includes('po') || lastUserMsgLower.includes('purchase order')) && (lastUserMsgLower.includes('received') || lastUserMsgLower.includes('recieved'))) ||
                                 // CRITICAL: Simple pattern - "mark it" + "recieved" (with typo) - this is what the user is saying
                                 (normalizedMsg.includes('mark') && (normalizedMsg.includes('it') || normalizedMsg.includes('this')) && (lastUserMsgLower.includes('recieved') || normalizedMsg.includes('received')));
    
    // Also check if the last assistant message was about creating a PO, and now user says "received"
    const lastAssistantMsgLower = lastAssistantMessage?.content?.toLowerCase() || '';
    const aiJustCreatedPO = lastAssistantMsgLower.includes('created purchase order') || 
                           lastAssistantMsgLower.includes('recorded a purchase order') ||
                           lastAssistantMsgLower.includes('purchase order') && 
                           (lastAssistantMsgLower.includes('po-') || lastAssistantMsgLower.includes('$'));
    const userSaysReceivedAfterPO = aiJustCreatedPO && 
                                    (normalizedMsg.includes('received') || 
                                     normalizedMsg.includes('mark') ||
                                     normalizedMsg.includes('mar') ||  // Handle "mar" typo
                                     lastUserMsgLower.includes('received') || 
                                     lastUserMsgLower.includes('recieved') ||  // Handle "recieved" typo
                                     lastUserMsgLower.includes('mark') ||
                                     lastUserMsgLower.includes('mar'));  // Handle "mar" typo
    
    const shouldDetectMarkReceived = userSaidMarkReceived || userSaysReceivedAfterPO;
    
    // Check for "mark this PO" pattern - declare once here
    const userSaidMarkThisPO = lastUserMsgLower.includes('mark') && lastUserMsgLower.includes('this') && 
                                (lastUserMsgLower.includes('po') || lastUserMsgLower.includes('purchase order')) &&
                                (lastUserMsgLower.includes('received') || lastUserMsgLower.includes('recieved'));
    
    // Reduced logging to prevent terminal glitching
    if (shouldDetectMarkReceived) {
      console.log('🔍 Mark as received detected:', lastUserMsgLower.substring(0, 50));
    }
    
    const hasMarkReceivedAction = actions.some(a => a.type === 'mark_po_received');
    const hasAddPOAction = actions.some(a => a.type === 'add_purchase_order');
    
    // CRITICAL: If user wants to mark as received, don't create a new PO
    const shouldForceMarkReceived = shouldDetectMarkReceived && !hasMarkReceivedAction && !hasAddPOAction;
    
    // CRITICAL: Don't force PO creation if user wants to mark as received
    // NEVER create a new PO if user said "mark as received" or "received" after a PO was created
    const shouldForcePO = userEverAskedForPO && 
                         (hasEnoughInfo || aiAskedAndUserAnswered) &&
                         !hasPOAction &&
                         !shouldForceMarkReceived && // Don't create PO if marking as received
                         !shouldDetectMarkReceived && // Double check - don't create if user said "received"
                         !userSaidMarkReceived && // Triple check - don't create if user explicitly said "mark received"
                         !userSaysReceivedAfterPO; // Quadruple check - don't create if user said received after PO was created
    
    // Priority: Mark as received takes ABSOLUTE precedence over creating a new PO
    // CRITICAL: If we detected mark as received, FORCE mark_purchase_order_received function call
    let toolChoice;
    if (shouldDetectMarkReceived && !hasMarkReceivedAction) {
      console.log('🔴 CRITICAL: User wants to mark PO as received - FORCING mark_purchase_order_received function call!');
      // Force the mark_purchase_order_received function call
      toolChoice = { type: 'function', function: { name: 'mark_purchase_order_received' } };
    } else if (shouldForceMarkReceived) {
      // Block all function calls - AI should respond with manual instructions
      toolChoice = 'none';
    } else if (shouldForcePO) {
      toolChoice = { type: 'function', function: { name: 'add_purchase_order' } };
    } else {
      toolChoice = 'auto';
    }
    
    // Reduced logging - only log when forcing a function call
    if (toolChoice !== 'auto' && toolChoice !== 'none') {
      const functionName = typeof toolChoice === 'object' ? toolChoice.function?.name : 'unknown';
      console.log(`🔧 Forcing ${functionName} function call`);
    }
    
    // Call OpenAI with function calling
    // CRITICAL: If user wants to mark as received, allow mark_purchase_order_received (already forced above)
    // Only block if we're forcing mark_purchase_order_received (it's already set in toolChoice)
    const finalToolChoice = toolChoice;
    
    // ✅ WORKING CONFIGURATION - DO NOT CHANGE: Temperature 0.3 and max_tokens 2000 work correctly
    let completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      tools: functions,
      tool_choice: finalToolChoice,
      temperature: 0.3, // Lower temperature for more deterministic behavior - DO NOT increase
      max_tokens: 2000, // Increased to prevent truncation - DO NOT decrease
    });

    let reply = completion.choices[0].message.content || '';
    let toolCalls = completion.choices[0].message.tool_calls || [];

    // Reduced logging - only log if there's an issue
    if (toolChoice !== 'auto' && toolCalls.length === 0) {
      console.error('❌ Forced function call ignored by AI');
    }
    
    // CRITICAL: If we forced the function call but AI didn't call it, log a warning
    if (toolChoice !== 'auto' && toolCalls.length === 0) {
      console.error('❌ CRITICAL: Forced function call was ignored by AI!', {
        forcedFunction: typeof toolChoice === 'object' ? toolChoice.function?.name : 'unknown',
        aiResponse: reply?.substring(0, 200),
        toolCallsReceived: toolCalls.length
      });
    }
    
    // CRITICAL: If user wants to mark as received, ALLOW mark_purchase_order_received but BLOCK add_purchase_order
    // userSaidMarkThisPO is already declared above
    if ((shouldDetectMarkReceived || userSaidMarkThisPO) && toolCalls.length > 0) {
      // Filter out add_purchase_order calls but allow mark_purchase_order_received
      const hasAddPO = toolCalls.some(tc => tc.function?.name === 'add_purchase_order');
      const hasMarkReceived = toolCalls.some(tc => tc.function?.name === 'mark_purchase_order_received');
      
      if (hasAddPO) {
        console.error('❌ BLOCKING add_purchase_order - user wants to mark as received, not create new PO');
        // Remove add_purchase_order calls but keep mark_purchase_order_received
        toolCalls = toolCalls.filter(tc => tc.function?.name !== 'add_purchase_order');
        console.log('✅ Blocked add_purchase_order, allowing mark_purchase_order_received');
      }
      
      if (hasMarkReceived) {
        console.log('✅ Allowing mark_purchase_order_received function call');
      }
    }
    
    // CRITICAL: Do NOT force any function call - AI should just respond with instructions
    // The system prompt already tells AI to give manual instructions
    
    // CRITICAL FALLBACK: If AI says it can't mark PO as received but user asked for it, manually call the function
    const replyLower = reply?.toLowerCase() || '';
    const aiSaidCantDoIt = (replyLower.includes("don't have") || replyLower.includes("don't have the capability") || 
                            replyLower.includes("cannot") || replyLower.includes("can't") || 
                            replyLower.includes("unable") || replyLower.includes("I don't have")) &&
                           (replyLower.includes("mark") || replyLower.includes("received") || replyLower.includes("purchase order"));
    
    // CRITICAL: If user asked to mark as received but AI's reply says it created/recorded a PO, that's wrong!
    const aiSaidCreatedPO = (replyLower.includes('created') || replyLower.includes('recorded')) && 
                            (replyLower.includes('purchase order') || replyLower.includes('po-'));
    const userAskedToMarkReceived = shouldDetectMarkReceived || userSaidMarkThisPO;
    
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
        
        console.log('🔧 AI Assistant: Executing tool call', {
          functionName,
          functionArgs: {
            ...functionArgs,
            token: functionArgs.token ? '***' : undefined
          }
        });

        // ✅ WORKING LOGIC - DO NOT CHANGE: Pre-validation prevents placeholder amounts and missing fields
        // PRE-VALIDATION: Check for missing required fields for purchase orders (same logic as materials)
        if (functionName === 'add_purchase_order') {
          const allUserMessages = messages.filter(m => m.role === 'user');
          const lastUserMessage = allUserMessages[allUserMessages.length - 1];
          const lastUserContent = (lastUserMessage?.content || '').toLowerCase();
          
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
            const allUserMessages = messages.filter(m => m.role === 'user');
            let userMentionedAmount = false;
            
            // Check each user message for explicit mention of this amount
            for (const userMsg of allUserMessages) {
              const msgContent = (userMsg.content || '').toLowerCase();
              // Check for explicit patterns: "$350", "350 dollars", "for $350", "350", etc.
              const amountPattern = new RegExp(`(?:\\$|dollars?|for\\s+\\$?)\\s*${functionArgs.amount}\\b|\\b${functionArgs.amount}\\s*(?:dollars?|\\$)`, 'i');
              const isPlainNumber = msgContent.trim() === String(functionArgs.amount);
              // Check if previous assistant message asked for amount
              const msgIndex = messages.indexOf(userMsg);
              const prevAssistantMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'assistant');
              const prevAssistantAsked = prevAssistantMsg?.content?.toLowerCase().includes('how much');
              
              if (amountPattern.test(msgContent) || (isPlainNumber && prevAssistantAsked)) {
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
          functionResult = await executeGetProjectByName(functionArgs);
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
            functionResult = await executeMarkPOReceived({ projectId: projectId || functionArgs.projectId, poNumber: '' }, req);
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
            functionResult = await executeAddPurchaseOrder(functionArgs, req);
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
          functionResult = await executeMarkPOReceived(functionArgs, req);
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
            functionResult = await executeAddMaterialExpense(functionArgs, req);
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
        } else {
          functionResult = { success: false, error: `Unknown function: ${functionName}` };
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
          messages.push({
            role: 'system',
            content: `IMPORTANT: All function calls succeeded (success: true). The actions were completed successfully. Confirm what was done. DO NOT say there's an issue.`
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
      
      completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        tools: functions,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 2000,
      });

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
    const finalUserAskedToMarkReceived = shouldDetectMarkReceived || userSaidMarkThisPO;
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
    
    const responseData = {
      reply,
      ...(projectUpdateData ? { projectUpdate: projectUpdateData } : {}),
      ...(actions.length > 0 ? { actions: actions } : {}),
    };
    
    console.log('📤 AI Assistant: Final response data being sent:', {
      hasReply: !!responseData.reply,
      hasProjectUpdate: !!responseData.projectUpdate,
      hasActions: !!responseData.actions,
      actionsCount: responseData.actions?.length || 0,
      actions: responseData.actions || [],
      replyMentionsPO: reply?.toLowerCase().includes('purchase order') || reply?.toLowerCase().includes('po'),
      replyMentionsRecorded: reply?.toLowerCase().includes('recorded') || reply?.toLowerCase().includes('created')
    });
    
    // CRITICAL: If AI says it recorded a PO but no action was created, create it ourselves
    // BUT: DO NOT create a new PO if the user wanted to mark one as received
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
    
    if ((reply?.toLowerCase().includes('purchase order') || reply?.toLowerCase().includes('po')) && 
        (reply?.toLowerCase().includes('recorded') || reply?.toLowerCase().includes('created')) &&
        actions.length === 0 &&
        !userWantsToMarkReceived) { // CRITICAL: Don't create PO if user wants to mark as received
      console.error('❌ CRITICAL ERROR: AI said it recorded a purchase order but NO ACTION was created!');
      console.error('❌ Attempting to create action from conversation history...');
      
      // Extract information from conversation
      const allMessagesText = messages.map(m => m.content || '').join(' ');
      const allMessagesLower = allMessagesText.toLowerCase();
      
      // CRITICAL: Only extract amount from USER messages, NOT from AI's reply
      // The AI might assume an amount, but we should only use what the user actually said
      let extractedAmount = null;
      
      // Get all user messages once
      const allUserMessages = messages.filter(m => m.role === 'user');
      
      // Check ALL user messages for an amount (in reverse order, most recent first)
      // CRITICAL: DO NOT extract placeholder amounts (350, 500, 1000) unless user explicitly provided them
      const commonPlaceholders = [350, 500, 1000, 100, 250, 750, 1500, 2000];
      for (const msg of allUserMessages.slice().reverse()) {
        const content = msg.content || '';
        // Look for clear amount patterns: "$350", "for $350", "350 dollars", "purchase order for 350"
        const amountMatch = content.match(/(?:\$|for\s+\$?|dollars?|purchase\s+order\s+for\s+)\s*(\d+(?:\.\d+)?)/i) ||
                            // Also check if it's clearly an amount in PO context
                            (content.includes('purchase order') || content.includes('po') || content.includes('order')) &&
                            content.match(/\$?(\d+(?:\.\d+)?)/);
        if (amountMatch) {
          const candidateAmount = parseFloat(amountMatch[1]);
          // CRITICAL: Skip placeholder amounts unless explicitly mentioned with $ or "dollars"
          if (commonPlaceholders.includes(candidateAmount)) {
            // Only accept if it has explicit indicators ($, "dollars", "for $X")
            const hasExplicitIndicators = /(?:\$|dollars?|for\s+\$?)/i.test(content);
            if (!hasExplicitIndicators) {
              console.log('⚠️ Skipping placeholder amount', candidateAmount, '- not explicitly provided by user');
              continue; // Skip this amount, look for another
            }
          }
          extractedAmount = candidateAmount;
          console.log('✅ Extracted amount from user message:', extractedAmount, 'from:', content.substring(0, 50));
          break;
        }
      }
      
      // CRITICAL: If no amount found in user messages, DO NOT create the PO
      // The AI should have asked for the amount instead of assuming one
      if (!extractedAmount) {
        console.error('❌ Cannot create PO: No amount found in user messages. AI should have asked for amount.');
        // Don't create the action - the AI's reply already said it recorded it, but we can't create it without an amount
        // The user will see the AI's message, but no actual PO will be created
        return;
      }
      
      // Extract vendor from user messages
      let extractedVendor = null;
      for (const msg of allUserMessages.slice(-5)) {
        const content = msg.content?.toLowerCase() || '';
        if (content.includes('jones') || content.includes('paint') || content.includes('glass')) {
          extractedVendor = msg.content.trim();
          break;
        } else if (content.includes('home depot')) {
          extractedVendor = 'Home Depot';
          break;
        } else if (content.length > 3 && content.length < 30 && !content.includes('?') && !content.includes('what') && !content.includes('which')) {
          extractedVendor = msg.content.trim();
        }
      }
      
      // Extract category
      let extractedCategory = 'Materials/Equipment'; // Default
      for (const msg of allUserMessages.slice(-5)) {
        const content = msg.content?.toLowerCase() || '';
        if (content.includes('windows')) {
          extractedCategory = 'Materials/Equipment';
          break;
        } else if (content.includes('labor')) {
          extractedCategory = 'Labor';
          break;
        } else if (content.includes('materials') || content.includes('equipment')) {
          extractedCategory = 'Materials/Equipment';
          break;
        }
      }
      
      // If we have enough info, create the action manually
      if (extractedAmount && extractedVendor && projectId) {
        const poNumber = `PO-${Date.now().toString().slice(-6)}`;
        const manualAction = {
          type: 'add_purchase_order',
          projectId: projectId,
          amount: extractedAmount,
          vendor: extractedVendor,
          category: extractedCategory,
          description: `${extractedCategory} from ${extractedVendor}`,
          expectedDelivery: null,
          poNumber: poNumber,
        };
        
        actions.push(manualAction);
        console.log('✅ Created purchase order action manually from conversation:', manualAction);
        
        // CRITICAL: Update responseData to include the manually created action
        responseData.actions = actions;
        console.log('✅ Updated responseData with manually created action');
      } else {
        console.error('❌ Could not extract enough info to create action manually:', {
          hasAmount: !!extractedAmount,
          hasVendor: !!extractedVendor,
          hasProjectId: !!projectId,
          extractedAmount,
          extractedVendor,
          extractedCategory,
          allMessagesText: allMessagesText.substring(0, 200)
        });
      }
    }
    
    // Final check: if we have actions now, make sure they're in the response
    if (actions.length > 0 && !responseData.actions) {
      responseData.actions = actions;
      console.log('✅ Added actions to responseData:', actions.length);
    }
    
    return res.json(responseData);

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
