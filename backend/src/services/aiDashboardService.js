const OpenAI = require('openai');
const { loadProjects } = require('./leadStorage');
const fs = require('fs').promises;
const path = require('path');

// Initialize OpenAI client - check for valid key (not placeholder)
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const hasValidOpenAiKey = openaiApiKey && 
  !openaiApiKey.includes('YOUR_OPE') && 
  !openaiApiKey.includes('YOUR_OPENAI') &&
  !openaiApiKey.includes('your_openai') &&
  !openaiApiKey.includes('your_openai_api_key') &&
  openaiApiKey.length > 20; // Basic validation

const openai = hasValidOpenAiKey
  ? new OpenAI({ apiKey: openaiApiKey })
  : null;

/**
 * Load material prices from JSON storage
 */
async function loadMaterialPricesFromJson() {
  try {
    const filePath = path.join(__dirname, '..', '..', 'storage', 'material-prices.json');
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.materials)) return parsed.materials;
    return [];
  } catch (err) {
    // It's okay if this file doesn't exist yet – just means no live pricing.
    console.warn('[AI Dashboard] No material-prices.json found or failed to read:', err.message);
    return [];
  }
}

const normalizeName = (name) => {
  if (!name) return '';
  return String(name).toLowerCase().trim();
};

/**
 * Get material stats for a specific user's projects
 */
async function getMaterialStatsForUser(userId, projectsForModel) {
  const snapshots = await loadMaterialPricesFromJson();
  if (snapshots.length === 0) return [];

  const stats = [];

  for (const p of projectsForModel) {
    if (p.userId && p.userId !== userId) continue;

    const lineItems = Array.isArray(p.lineItems) ? p.lineItems : [];

    for (const li of lineItems) {
      // Only care about materials
      const categoryNorm = normalizeName(li.category);
      if (
        categoryNorm !== 'materials' &&
        !normalizeName(li.name).includes('material')
      ) {
        continue;
      }

      const liNameNorm = normalizeName(li.name);
      const matchedSnapshot = snapshots.find(
        (m) => normalizeName(m.name) === liNameNorm || m.id === li.id
      );

      if (!matchedSnapshot) continue;

      const quantity = typeof li.quantity === 'number' ? li.quantity : undefined;
      const totalCostInProject = typeof li.total === 'number' ? li.total : undefined;
      let unitCostInProject = undefined;

      if (quantity && totalCostInProject) {
        unitCostInProject = totalCostInProject / quantity;
      } else if (typeof li.cost === 'number') {
        unitCostInProject = li.cost;
      }

      const { currentUnitPrice, avgUnitPrice30d } = matchedSnapshot;
      let changePct30d = undefined;
      if (avgUnitPrice30d && avgUnitPrice30d !== 0) {
        changePct30d =
          ((currentUnitPrice - avgUnitPrice30d) / avgUnitPrice30d) * 100;
      }

      stats.push({
        id: `${p.id}-${matchedSnapshot.id}`,
        projectId: p.id,
        projectName: p.name,
        lineItemName: li.name,
        vendor: matchedSnapshot.vendor,
        unit: matchedSnapshot.unit,
        quantity,
        unitCostInProject,
        totalCostInProject,
        currentUnitPrice,
        avgUnitPrice30d,
        changePct30d,
      });
    }
  }

  return stats;
}

/**
 * Build AI dashboard data for a specific user
 */
async function buildAiDashboardForUser(userId, projectsFromRequest = null) {
  // 1) Load project data - prefer projects from request, fallback to storage
  let projectsRaw = [];
  if (projectsFromRequest && Array.isArray(projectsFromRequest) && projectsFromRequest.length > 0) {
    // Use projects sent from mobile app
    projectsRaw = projectsFromRequest;
  } else {
    // Fallback to loading from storage
    projectsRaw = loadProjects();
  }

  // Filter by userId if available
  const projects = projectsRaw.filter((p) => {
    // Try multiple possible userId fields
    return p.userId === userId || 
           p.ownerId === userId || 
           p.createdBy === userId ||
           !userId; // If no userId provided, return all (for testing)
  });

  // 2) Build compact payload with enhanced metrics
  const projectsForModel = projects.map((p) => {
    const bidPrice = Number(p.bidPrice ?? 0);
    const estimatedCost = Number(p.estimatedCost ?? 0);
    const actualCost = Number(p.actualCost ?? 0);
    const margin = Number(p.margin ?? 0); // Already stored as percentage
    const markup = Number(p.markup ?? 0);

    const profit = bidPrice - actualCost;
    const budgetVariance = actualCost - estimatedCost; // >0 = over budget
    const receiptsTotal = Array.isArray(p.receipts)
      ? p.receipts.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
      : 0;
    const receiptsCoveragePct =
      actualCost > 0 ? (receiptsTotal / actualCost) * 100 : 0;

    const hasPermitLineItem = Array.isArray(p.lineItems)
      ? p.lineItems.some(
          (li) =>
            normalizeName(li.category) === 'permits' ||
            normalizeName(li.name).includes('permit')
        )
      : false;

    const hasPermitFeesFlag =
      p.hasPermitFees === true || p.permitFeesIncluded === true;

    const progressPct =
      typeof p.overallProgressPct === 'number'
        ? p.overallProgressPct
        : typeof p.progress === 'number'
        ? p.progress
        : 0;

    // Parse location
    const location = p.location || '';
    const locationParts = location.split(',').map(s => s.trim());
    const city = locationParts[0] || p.city || null;
    const state = locationParts[1] || p.state || null;

    return {
      // Keep original fields
      ...p,

      // Normalized fields used by AI + rules
      id: String(p.id),
      name: p.name ?? p.title ?? 'Untitled project',
      status: p.status,
      location: location || `${city ?? ''}, ${state ?? ''}`.trim(),
      city: city,
      state: state,
      projectType: p.projectType ?? null,

      // Core financials
      bidPrice,
      estimatedCost,
      actualCost,
      marginPct: margin,
      markupPct: markup,
      profit,
      budgetVariance, // >0 over budget, <0 under

      // Documentation / risk flags
      receiptsTotal,
      receiptsCoveragePct,
      hasReceiptsAttached:
        p.hasReceiptsAttached === true || receiptsTotal > 0,
      hasPermitLineItem,
      hasPermitFeesFlag,

      // Schedule / progress
      startDate: p.startDate ?? null,
      endDate: p.endDate ?? null,
      createdAt: p.createdAt ?? null,
      updatedAt: p.updatedAt ?? null,
      progressPct,

      // Raw line items/receipts so the model can reference them if needed
      lineItems: p.lineItems ?? [],
      receipts: p.receipts ?? [],
    };
  });

  const summary = {
    userId,
    projectCount: projectsForModel.length,
    totals: {
      totalBid: projectsForModel.reduce((s, p) => s + p.bidPrice, 0),
      totalEstimatedCost: projectsForModel.reduce(
        (s, p) => s + p.estimatedCost,
        0
      ),
      totalActualCost: projectsForModel.reduce(
        (s, p) => s + p.actualCost,
        0
      ),
      totalProfit: projectsForModel.reduce((s, p) => s + p.profit, 0),
    },
    statusBreakdown: projectsForModel.reduce(
      (acc, p) => {
        const key = p.status || 'unknown';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {}
    ),
  };

  // ---------- RULE-BASED CHECKS (no AI, pure logic) ---------- //

  const baseInsights = [];
  const baseNextSteps = [];

  for (const p of projectsForModel) {
    // 1) Low margin
    if (p.marginPct > 0 && p.marginPct < 25) {
      baseInsights.push({
        id: `low-margin-${p.id}`,
        type: 'alert',
        title: `Low margin on ${p.name}`,
        body: `Margin on ${p.name} is only ${p.marginPct.toFixed(
          1
        )}%. Consider tightening scope or increasing price.`,
        projectId: p.id,
        impactScore: 9,
      });

      baseNextSteps.push({
        id: `review-margin-${p.id}`,
        label: `Review margin & scope for ${p.name}`,
        chip: 'Prevent margin loss',
        projectId: p.id,
        priority: 'high',
      });
    }

    // 2) Over budget
    if (p.budgetVariance > 0 && p.actualCost > 0) {
      baseInsights.push({
        id: `over-budget-${p.id}`,
        type: 'alert',
        title: `${p.name} is over estimated cost`,
        body: `${p.name} is over budget by $${p.budgetVariance.toFixed(
          0
        )}. Check materials and labor overruns.`,
        projectId: p.id,
        impactScore: 8,
      });
    }

    // 3) Missing receipts
    if (p.actualCost > 0 && p.receiptsCoveragePct < 80) {
      baseInsights.push({
        id: `missing-receipts-${p.id}`,
        type: 'info',
        title: `Missing receipts for ${p.name}`,
        body: `Only ${p.receiptsCoveragePct.toFixed(
          0
        )}% of actual costs on ${p.name} have receipts attached.`,
        projectId: p.id,
        impactScore: 7,
      });

      baseNextSteps.push({
        id: `upload-receipts-${p.id}`,
        label: `Upload missing receipts for ${p.name}`,
        chip: '5 min',
        projectId: p.id,
        priority: 'medium',
      });
    }

    // 4) Permit fee risk – bigger jobs
    const isBigJob = p.bidPrice >= 50000 || p.projectType === 'Commercial';
    if (isBigJob && !p.hasPermitLineItem && !p.hasPermitFeesFlag) {
      baseInsights.push({
        id: `permit-risk-${p.id}`,
        type: 'alert',
        title: `Check permit fees on ${p.name}`,
        body: `${p.name} is a larger job but has no permit fees in the estimate. Double-check to avoid surprises.`,
        projectId: p.id,
        impactScore: 8,
      });

      baseNextSteps.push({
        id: `add-permit-fees-${p.id}`,
        label: `Confirm & add permit fees to ${p.name}`,
        chip: 'Prevent margin loss',
        projectId: p.id,
        priority: 'high',
      });
    }

    // 5) High-value estimate still at 0% progress
    if (p.status === 'estimate' && p.bidPrice >= 20000 && p.progressPct === 0) {
      baseInsights.push({
        id: `high-opportunity-${p.id}`,
        type: 'opportunity',
        title: `High-value estimate: ${p.name}`,
        body: `${p.name} is a $${p.bidPrice.toLocaleString(
          'en-US'
        )} estimate with 0% progress. Follow up to move it forward.`,
        projectId: p.id,
        impactScore: 8,
      });

      baseNextSteps.push({
        id: `follow-up-${p.id}`,
        label: `Follow up with client on ${p.name}`,
        chip: 'New revenue',
        projectId: p.id,
        priority: 'high',
      });
    }
  }

  // ---------- LIVE MATERIAL PRICING CHECKS ---------- //

  const materialStats = await getMaterialStatsForUser(userId, projectsForModel);

  for (const m of materialStats) {
    if (
      typeof m.changePct30d === 'number' &&
      Math.abs(m.changePct30d) >= 5 // 5%+ move in last 30 days
    ) {
      const direction = m.changePct30d > 0 ? 'up' : 'down';
      const type = m.changePct30d > 0 ? 'alert' : 'opportunity';

      baseInsights.push({
        id: `material-${direction}-${m.id}`,
        type,
        title: `Material cost ${direction}: ${m.lineItemName}`,
        body: `${m.lineItemName} for ${m.projectName} is ${Math.abs(
          m.changePct30d
        ).toFixed(1)}% ${direction} vs the 30-day average.`,
        projectId: m.projectId,
        impactScore: 7,
      });

      if (direction === 'up') {
        baseNextSteps.push({
          id: `review-material-${m.id}`,
          label: `Review allowance for ${m.lineItemName}`,
          chip: 'Prevent margin loss',
          projectId: m.projectId,
          priority: 'medium',
        });
      } else {
        baseNextSteps.push({
          id: `leverage-material-${m.id}`,
          label: `Leverage lower price on ${m.lineItemName}`,
          chip: 'Save 3–7%',
          projectId: m.projectId,
          priority: 'medium',
        });
      }
    }
  }

  // ---------- If no OpenAI key, return rule-based only ---------- //

  if (!openai) {
    console.warn(
      '[AI Dashboard] No OPENAI_API_KEY set. Returning rule-based insights only.'
    );
    return {
      insights: baseInsights,
      nextSteps: baseNextSteps,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ---------- Call OpenAI for extra AI insights ---------- //

  const payload = {
    summary,
    projects: projectsForModel,
    baseInsights,
    baseNextSteps,
    materials: materialStats,
  };

  let rawContent = '{}';

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are an AI project manager for a construction estimating & job-costing platform.

You receive:
- "summary": roll-up stats across all projects.
- "projects": normalized project data with fields like:
  status, bidPrice, estimatedCost, actualCost, marginPct, markupPct,
  profit, budgetVariance, receiptsCoveragePct, hasReceiptsAttached,
  hasPermitLineItem, hasPermitFeesFlag, progressPct, projectType, location.
- "baseInsights" and "baseNextSteps": rule-based findings already detected.
- "materials": materialStats with price change data per project line item.

Your job:
1) Add 2–5 additional high-value "insights" that build on top of the base ones.
2) Add 2–5 additional "nextSteps" that are concrete, actionable, and profit-focused.
3) Do NOT duplicate baseInsights/baseNextSteps; complement them.

Rules:
- ONLY talk about data from the payload.
- Keep language simple and contractor-friendly.
- "type" for insights:
   - "alert" for risk/overrun/serious issues
   - "opportunity" for savings or extra profit
   - "info" for neutral useful context
- "impactScore" is 1–10 (10 = biggest impact on profit/risk).
- "chip" for nextSteps is a short tag like "5 min", "Save 3–7%", "Prevent margin loss".
- "priority" is "low" | "medium" | "high".

Return ONLY JSON in this shape:

{
  "insights": [
    {
      "id": "string",
      "type": "alert" | "opportunity" | "info",
      "title": "string",
      "body": "string",
      "projectId": "string | null",
      "impactScore": number
    }
  ],
  "nextSteps": [
    {
      "id": "string",
      "label": "string",
      "chip": "string",
      "projectId": "string | null",
      "priority": "low" | "medium" | "high"
    }
  ],
  "lastUpdated": "ISO timestamp string"
}
`.trim(),
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    });

    rawContent = completion.choices[0].message.content || '{}';
  } catch (err) {
    console.error('[AI Dashboard] OpenAI chat error:', err);
    // fail soft: return rule-based only
    return {
      insights: baseInsights,
      nextSteps: baseNextSteps,
      lastUpdated: new Date().toISOString(),
    };
  }

  let parsed = {};
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    console.error('[AI Dashboard] Failed to parse AI JSON:', err, 'raw=', rawContent);
  }

  const result = {
    insights: [
      ...baseInsights,
      ...(Array.isArray(parsed.insights) ? parsed.insights : []),
    ],
    nextSteps: [
      ...baseNextSteps,
      ...(Array.isArray(parsed.nextSteps) ? parsed.nextSteps : []),
    ],
    lastUpdated: parsed.lastUpdated || new Date().toISOString(),
  };

  return result;
}

module.exports = {
  buildAiDashboardForUser,
};
