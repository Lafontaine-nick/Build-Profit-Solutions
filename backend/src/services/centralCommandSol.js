const {
  buildCentralCommandJobIndex,
  buildCentralCommandFigureFallback,
  centralCommandNeedsJobGrounding,
  centralCommandReplyIsUngrounded,
  executeCentralCommandReadTool,
} = require('./aiAssistantCore');
const { buildUserMemoryPromptBlock } = require('./userMemory');
let loadPricingEntries = () => [];
try {
  loadPricingEntries = require('./contractorPricingMemory/storage').listEntries;
} catch (_err) {
  loadPricingEntries = () => [];
}

const READ_TOOLS = [
  ['get_project_budget', 'Read one job budget: contract, cost budget, spent, labor, material, and project overhead.'],
  ['get_payment_schedule', 'Read collected, overdue, and upcoming payments for one job.'],
  ['get_change_orders', 'Read change orders on one job.'],
  ['get_estimate_lines', 'Read estimate material and labor lines on one job.'],
  ['get_purchase_orders', 'Read open purchase orders on one job.'],
  ['get_expenses', 'Read logged expenses on one job.'],
  ['get_calendar', 'Read upcoming calendar events on one job.'],
];

function functionTool(name, description, properties) {
  return {
    type: 'function',
    name,
    description,
    strict: false,
    parameters: {
      type: 'object',
      properties,
      additionalProperties: false,
    },
  };
}

function centralCommandSolTools() {
  const projectProps = {
    projectId: { type: 'string', description: 'Project id from the job index.' },
    projectName: { type: 'string', description: 'Project name when the contractor names a job.' },
  };
  return [
    ...READ_TOOLS.map(([name, description]) => functionTool(name, description, projectProps)),
    functionTool(
      'search_pricing_library',
      'Search the contractor pricing library for a trade or task. Use this for saved rates. Do not use it for a dollar amount already stored on a job.',
      {
        query: { type: 'string', description: 'Trade or task, such as tile demolition or concrete.' },
        trade: { type: 'string', description: 'Optional trade filter.' },
      }
    ),
    functionTool(
      'prepare_job_action',
      'Prepare a change order, expense, or calendar event for the contractor to confirm. This does not save anything.',
      {
        kind: { type: 'string', description: 'change_order, expense, or calendar.' },
        description: { type: 'string' },
        amount: { type: 'number' },
        vendor: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        eventType: { type: 'string' },
      }
    ),
    { type: 'web_search_preview', search_context_size: 'low' },
  ];
}

function centralCommandReasoningEffort(message) {
  if (/\b(estimate analysis|profitab|contract|compare|plans?|document|multi-project)\b/i.test(String(message || ''))) {
    return 'high';
  }
  return 'medium';
}

function responseText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const parts = [];
  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue;
    for (const part of item.content || []) {
      if (part?.type === 'output_text' && part.text) parts.push(part.text);
    }
  }
  return parts.join('\n').trim();
}

function parseMoney(text) {
  const match = String(text || '').match(/\$\s?([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*dollars/i);
  if (!match) return null;
  const value = Number(String(match[1] || match[2]).replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function localDateOffset(now, days) {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function currentProject(projects, parsedContext) {
  const list = Array.isArray(projects) ? projects : [];
  const id = parsedContext?.projectId || parsedContext?.activeProjectId;
  if (id != null) {
    const match = list.find((project) => String(project?.id) === String(id));
    if (match) return match;
  }
  const name = String(parsedContext?.currentProject || parsedContext?.projectName || '').trim().toLowerCase();
  if (name) {
    const match = list.find((project) => String(project?.title || project?.name || '').trim().toLowerCase() === name);
    if (match) return match;
  }
  return list.length === 1 ? list[0] : null;
}

function searchPricingLibrary(query, listEntries) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return { success: false, error: 'Say which trade or task to look up.' };
  const entries = (typeof listEntries === 'function' ? listEntries() : []) || [];
  const hits = entries.filter((entry) => {
    const haystack = `${entry?.scopeItemName || ''} ${entry?.trade || ''} ${entry?.category || ''}`.toLowerCase();
    return needle.split(/\s+/).every((word) => haystack.includes(word));
  }).slice(0, 8);
  return {
    success: true,
    query: needle,
    count: hits.length,
    rates: hits.map((entry) => ({
      name: entry.scopeItemName || 'Rate',
      trade: entry.trade || '',
      unit: entry.unitType || '',
      rate: Number(entry.unitRate || 0),
    })),
  };
}

function prepareFromArgs(args, project, userMemory) {
  const kind = String(args?.kind || '').toLowerCase();
  const projectId = project?.id != null ? String(project.id) : args?.projectId || null;
  const projectName = project?.title || project?.name || 'This project';
  if (kind === 'change_order') {
    const amount = Number(args?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'A change order needs a cost.' };
    const description = String(args?.description || 'Change order').trim();
    const markup = Number(userMemory?.preferredMarkupPct);
    const hasMarkup = Number.isFinite(markup) && markup > 0;
    const clientPrice = hasMarkup ? Math.round(amount * (1 + markup / 100)) : Math.round(amount);
    return {
      success: true,
      confirmation: hasMarkup
        ? `I have a change order ready for ${description}: cost $${Math.round(amount).toLocaleString()}. The company preference markup is ${markup}%, so the customer price is $${clientPrice.toLocaleString()}. Confirm it to add it to ${projectName}.`
        : `I have a change order ready for ${description}: cost $${Math.round(amount).toLocaleString()}. No company markup is saved, so the customer price matches the cost. Confirm it to add it to ${projectName}.`,
      action: {
        type: 'create_change_order',
        projectId,
        projectName,
        changeOrder: {
          description,
          materialsAmount: Math.round(amount),
          laborAmount: 0,
          amount: clientPrice,
          cost: Math.round(amount),
        },
      },
    };
  }
  if (kind === 'expense') {
    const amount = Number(args?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'An expense needs an amount.' };
    return {
      success: true,
      confirmation: `I have a ${args?.description || 'material'} expense ready for $${Math.round(amount).toLocaleString()}${args?.vendor ? ` from ${args.vendor}` : ''}. Confirm it to record it on ${projectName}.`,
      action: {
        type: 'add_material_expense',
        projectId,
        projectName,
        amount: Math.round(amount),
        vendor: args?.vendor || '',
        material: args?.description || 'Material',
        category: 'Materials/Equipment',
      },
    };
  }
  if (kind === 'calendar') {
    if (!args?.date) return { success: false, error: 'A calendar event needs a date.' };
    return {
      success: true,
      confirmation: `I have ${args?.description || 'an event'} ready for ${args.date} on ${projectName}. Confirm it to add it to the calendar.`,
      action: {
        type: 'create_calendar_event',
        projectId,
        projectName,
        event: {
          title: args?.description || 'Event',
          date: args.date,
          type: args?.eventType || 'work',
        },
      },
    };
  }
  return { success: false, error: 'I can prepare a change order, an expense, or a calendar event.' };
}

function prepareCentralCommandAction(message, { projects, parsedContext, userMemory, now = new Date() } = {}) {
  const text = String(message || '');
  const project = currentProject(projects, parsedContext);
  const projectName = project?.title || project?.name || parsedContext?.currentProject || 'this job';
  const projectId = project?.id != null ? String(project.id) : parsedContext?.projectId || null;

  if (/\bpayment reminder\b/i.test(text)) {
    const who = (text.match(/\b(?:send|text)\s+([A-Z][a-z]+)/) || [])[1] || 'them';
    return {
      reply: `Here's a reminder you can send ${who}: "Hi ${who}, this is a reminder that a payment is due. Let me know if you have any questions." I can't send the message from here.`,
      actions: [],
    };
  }

  if (/\bchange\s+order\b/i.test(text) && /\b(create|add|make|draft)\b/i.test(text)) {
    const amount = parseMoney(text);
    if (!amount) return { reply: `What is the cost of the change order on ${projectName}?`, actions: [] };
    const description = text
      .replace(/\$\s?[\d,]+(?:\.\d+)?/g, ' ')
      .replace(/\b(please|create|add|make|draft|a|an|the|change|order|for)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Change order';
    const prepared = prepareFromArgs({ kind: 'change_order', description, amount }, project, userMemory);
    return { reply: prepared.confirmation, actions: prepared.action ? [prepared.action] : [] };
  }

  if (/\b(log|record|add)\b/i.test(text) && /\b(expense|receipt|lumber|material)\b/i.test(text)) {
    const amount = parseMoney(text);
    if (!amount) return { reply: `What was the amount for that expense on ${projectName}?`, actions: [] };
    const vendor = (text.match(/\b(home depot|lowe'?s|menards)\b/i) || [])[1] || '';
    const prepared = prepareFromArgs({ kind: 'expense', description: 'Material', amount, vendor }, project, userMemory);
    return { reply: prepared.confirmation, actions: prepared.action ? [prepared.action] : [] };
  }

  if (/\b(schedule|add|create)\b/i.test(text) && /\binspection\b/i.test(text)) {
    const date = /\btomorrow\b/i.test(text) ? localDateOffset(now, 1) : (text.match(/\b(20\d{2}-\d{2}-\d{2})\b/) || [])[1];
    if (!date) return { reply: `What date should I put the inspection on for ${projectName}?`, actions: [] };
    const prepared = prepareFromArgs({
      kind: 'calendar',
      description: 'Inspection',
      date,
      eventType: 'inspection',
    }, project, userMemory);
    return { reply: prepared.confirmation, actions: prepared.action ? [prepared.action] : [] };
  }

  return null;
}

function solInstructions({ projects, userMemory }) {
  const memory = buildUserMemoryPromptBlock(userMemory);
  return `You are Build Profit AI inside Central Command.
Answer general questions normally.
The job index has names and status only.
Before you state a dollar amount, percent, or payment date from their jobs, call a job tool and use only figures from that tool result.
Use web search for current public information such as weather, prices, or codes, and name the source.
Use search_pricing_library for the contractor's saved rates.
Company preferences are not the numbers stored on a job.
prepare_job_action only prepares a change. Say that it still needs confirmation. Do not say it was saved.
If a tool does not contain the figure, say you do not have it.
When the contractor states their own cost and a gross margin, the price is that cost divided by (1 minus the margin). A later change to that cost stays on those numbers, not on a saved job.
Write short sentences. Use **bold** for dollar amounts. Do not use markdown tables or markdown links.

${buildCentralCommandJobIndex(projects)}
${memory || ''}`;
}

async function answerCentralCommandWithSol({
  message,
  projects,
  parsedContext,
  userMemory,
  history = [],
  openai,
  model = 'gpt-6.1-sol',
  now = new Date(),
  listEntries,
}) {
  const prepared = prepareCentralCommandAction(message, { projects, parsedContext, userMemory, now });
  if (prepared) return prepared;
  if (!openai?.responses?.create) return null;

  const tools = centralCommandSolTools();
  const prior = (Array.isArray(history) ? history : []).slice(-6)
    .filter((turn) => turn?.role && turn?.content)
    .map((turn) => ({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: String(turn.content).slice(0, 2000),
    }));
  let input = [...prior, { role: 'user', content: String(message || '') }];
  let previousResponseId = null;
  const toolResults = [];
  const actions = [];
  let reply = '';

  for (let round = 0; round < 4; round += 1) {
    let response;
    try {
      response = await openai.responses.create({
        model,
        instructions: solInstructions({ projects, userMemory }),
        input,
        tools,
        reasoning: { effort: centralCommandReasoningEffort(message) },
        previous_response_id: previousResponseId,
      });
    } catch (error) {
      const webSearchRejected = /web_search/i.test(String(error?.message || ''));
      if (!webSearchRejected || round > 0) throw error;
      response = await openai.responses.create({
        model,
        instructions: solInstructions({ projects, userMemory }),
        input,
        tools: tools.filter((tool) => tool.type !== 'web_search_preview'),
        reasoning: { effort: centralCommandReasoningEffort(message) },
      });
    }
    previousResponseId = response?.id || previousResponseId;
    const calls = (response?.output || []).filter((item) => item?.type === 'function_call');
    reply = responseText(response);
    if (!calls.length) break;

    const outputs = [];
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.arguments || '{}'); } catch (_err) { args = {}; }
      let result;
      if (call.name === 'search_pricing_library') {
        const lookup = listEntries || loadPricingEntries;
        result = searchPricingLibrary(args.query || args.trade, () => (
          lookup?.(parsedContext?.userId, args.trade ? { trade: args.trade } : {}) || []
        ));
      } else if (call.name === 'prepare_job_action') {
        result = prepareFromArgs(args, currentProject(projects, parsedContext), userMemory);
        if (result.action) actions.push(result.action);
      } else {
        result = executeCentralCommandReadTool(call.name, args, { projects, parsedContext, now });
      }
      toolResults.push(result);
      outputs.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }
    input = outputs;
  }

  const confirmation = toolResults.map((result) => result?.confirmation).find(Boolean);
  if (confirmation) reply = confirmation;
  if (centralCommandNeedsJobGrounding(message) && centralCommandReplyIsUngrounded(reply, toolResults)) {
    reply = buildCentralCommandFigureFallback(parsedContext?.currentProject || parsedContext?.projectName || '');
    return { reply, actions: [] };
  }
  return { reply, actions };
}

module.exports = {
  prepareCentralCommandAction,
  answerCentralCommandWithSol,
  searchPricingLibrary,
  centralCommandReasoningEffort,
};
