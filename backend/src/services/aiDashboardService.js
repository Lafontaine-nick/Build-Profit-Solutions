const OpenAI = require('openai');
const { loadProjects } = require('./leadStorage');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

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

// ---------- HASH-BASED CACHE FOR AI INSIGHTS ---------- //
// In-memory cache: userId -> { hash, aiInsights, aiNextSteps, cachedAt, ttl }
const aiCache = new Map();

// TTL: 6 hours (21600000 ms) - refresh AI insights every 6 hours even if data unchanged
const AI_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Compute a compact hash of the AI input snapshot
 * Only includes fields that should trigger AI refresh when changed
 */
function computeAiSnapshotHash(
  summary,
  projectsForModel,
  baseInsights,
  baseNextSteps,
  materialStats,
  completedSummariesCompact
) {
  // Create compact AI summary (only what AI needs, not full project objects)
  const aiSummary = {
    projectCount: summary.projectCount,
    totals: summary.totals,
    statusBreakdown: summary.statusBreakdown,
    // Compact project summaries for AI (not full objects)
    projects: projectsForModel.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      bidPrice: p.bidPrice,
      estimatedCost: p.estimatedCost,
      actualCost: p.actualCost,
      marginPct: p.marginPct,
      markupPct: p.markupPct,
      profit: p.profit,
      budgetVariance: p.budgetVariance,
      receiptsCoveragePct: p.receiptsCoveragePct,
      hasReceiptsAttached: p.hasReceiptsAttached,
      hasPermitLineItem: p.hasPermitLineItem,
      hasPermitFeesFlag: p.hasPermitFeesFlag,
      progressPct: p.progressPct,
      projectType: p.projectType,
      location: p.location,
      // Days in current status (for AI context)
      daysInStatus: p.updatedAt ? Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      highValueFlag: p.bidPrice >= 20000,
    })),
    // Rule-based findings (AI should complement, not duplicate)
    baseInsightCount: baseInsights.length,
    baseNextStepCount: baseNextSteps.length,
    // Material trends (only significant ones)
    materialTrends: materialStats
      .filter(m => typeof m.changePct30d === 'number' && Math.abs(m.changePct30d) >= 5)
      .map(m => ({
        projectId: m.projectId,
        lineItemName: m.lineItemName,
        changePct30d: m.changePct30d,
      })),
    completedSnapshots:
      Array.isArray(completedSummariesCompact) && completedSummariesCompact.length > 0
        ? [...completedSummariesCompact].sort((a, b) =>
            String(a.id).localeCompare(String(b.id))
          )
        : [],
  };

  const snapshotString = JSON.stringify(aiSummary);
  return crypto.createHash('sha256').update(snapshotString).digest('hex');
}

/**
 * Get cached AI insights if available and not expired
 */
function getCachedAiInsights(userId, snapshotHash) {
  const cached = aiCache.get(userId);
  if (!cached) return null;

  const now = Date.now();
  const isExpired = (now - cached.cachedAt) > AI_CACHE_TTL_MS;
  const hashMatches = cached.hash === snapshotHash;

  if (isExpired || !hashMatches) {
    // Cache expired or data changed - invalidate
    aiCache.delete(userId);
    return null;
  }

  return {
    insights: cached.aiInsights,
    nextSteps: cached.aiNextSteps,
    cachedAt: cached.cachedAt,
  };
}

/**
 * Store AI insights in cache
 */
function setCachedAiInsights(userId, snapshotHash, aiInsights, aiNextSteps) {
  aiCache.set(userId, {
    hash: snapshotHash,
    aiInsights,
    aiNextSteps,
    cachedAt: Date.now(),
    ttl: AI_CACHE_TTL_MS,
  });
}

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

/** Same-id rows from mobile (estimate + active) — keep the more advanced status. */
function mergeDuplicateProjectsByIdPreferStatus(projectsRaw) {
  const rank = (s) => {
    const x = String(s || '')
      .toLowerCase()
      .trim()
      .replace(/-/g, '_');
    const order = [
      'draft',
      'estimate',
      'bid_submitted',
      'submitted',
      'won',
      'in_progress',
      'active',
      'completed',
      'complete',
      'done',
      'finished',
      'closed',
      'lost',
    ];
    const i = order.indexOf(x);
    return i >= 0 ? i : -1;
  };
  const m = new Map();
  for (const p of projectsRaw) {
    const id = String(p.id ?? '');
    if (!id) continue;
    const cur = m.get(id);
    if (!cur) {
      m.set(id, p);
      continue;
    }
    if (rank(p.status) > rank(cur.status)) m.set(id, p);
  }
  return [...m.values()];
}

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
 * @param {string} userId - User ID
 * @param {Array|null} projectsFromRequest - Projects from mobile app (optional)
 * @param {boolean} forceRefresh - Force refresh AI insights (bypass cache)
 */
function formatUsdCompact(n) {
  if (!Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

async function buildAiDashboardForUser(
  userId,
  projectsFromRequest = null,
  forceRefresh = false,
  completedSummariesFromRequest = null
) {
  // 1) Load project data - prefer projects from request, fallback to storage
  let projectsRaw = [];
  if (projectsFromRequest && Array.isArray(projectsFromRequest) && projectsFromRequest.length > 0) {
    // Use projects sent from mobile app (dedupe stale duplicate ids)
    projectsRaw = mergeDuplicateProjectsByIdPreferStatus(projectsFromRequest);
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
    const statusNorm = String(p.status || '')
      .toLowerCase()
      .trim()
      .replace(/-/g, '_');
    const isClosedJob =
      statusNorm === 'completed' ||
      statusNorm === 'complete' ||
      statusNorm === 'closed' ||
      statusNorm === 'done' ||
      statusNorm === 'finished' ||
      statusNorm === 'lost' ||
      (typeof p.progressPct === 'number' && p.progressPct >= 99);

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

    // 4) Permit fee risk – bigger jobs (not for closed jobs — estimate snapshot may be stale)
    const isBigJob = p.bidPrice >= 50000 || p.projectType === 'Commercial';
    if (!isClosedJob && isBigJob && !p.hasPermitLineItem && !p.hasPermitFeesFlag) {
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
    if (statusNorm === 'estimate' && p.bidPrice >= 20000 && p.progressPct === 0) {
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

  // ---------- Completed jobs: retrospective only (no operational tone) ---------- //
  const completedSummariesCompact = [];
  if (Array.isArray(completedSummariesFromRequest)) {
    for (const c of completedSummariesFromRequest) {
      if (!c || c.id == null || String(c.id).trim() === '') continue;
      const id = String(c.id);
      const title = String(c.title || 'Job').trim() || 'Job';
      const net = Number(c.netProfit ?? 0);
      const pctRaw = c.netProfitPct;
      const pctStr =
        pctRaw != null && Number.isFinite(Number(pctRaw))
          ? `${Number(pctRaw).toFixed(1)}%`
          : '—';
      completedSummariesCompact.push({
        id,
        netProfit: net,
        netProfitPct: pctRaw != null && Number.isFinite(Number(pctRaw)) ? Number(pctRaw) : null,
      });
      baseInsights.push({
        id: `completed-retrospective-${id}`,
        type: 'info',
        title: `${title}: realized net profit`,
        body: `This job is closed. Realized net profit was about ${formatUsdCompact(net)} (${pctStr} of contract). Use this for historical margin review — not as an open pipeline action item.`,
        projectId: id,
        impactScore: 5,
        retrospective: true,
      });
    }
  }

  const closedProjectIdsForAiGuard = new Set(completedSummariesCompact.map((c) => c.id));

  // ---------- Record rule-based timestamp (always fresh) ---------- //
  const ruleBasedUpdatedAt = new Date().toISOString();

  // ---------- If no OpenAI key, return rule-based only ---------- //

  if (!openai) {
    console.warn(
      '[AI Dashboard] No OPENAI_API_KEY set. Returning rule-based insights only.'
    );
    return {
      insights: baseInsights,
      nextSteps: baseNextSteps,
      ruleBasedUpdatedAt,
      aiUpdatedAt: null,
      lastUpdated: ruleBasedUpdatedAt,
    };
  }

  // ---------- HASH-BASED CACHING FOR AI INSIGHTS ---------- //

  // Compute snapshot hash for cache lookup
  const snapshotHash = computeAiSnapshotHash(
    summary,
    projectsForModel,
    baseInsights,
    baseNextSteps,
    materialStats,
    completedSummariesCompact
  );

  // Check cache first (unless force refresh)
  let cached = null;
  if (!forceRefresh) {
    cached = getCachedAiInsights(userId, snapshotHash);
  } else {
    // Force refresh - clear cache for this user
    aiCache.delete(userId);
    console.log(`[AI Dashboard] Force refresh requested for userId: ${userId}`);
  }

  let aiInsights = [];
  let aiNextSteps = [];
  let aiUpdatedAt = null;

  if (cached) {
    // Cache hit - use cached AI insights
    console.log(`[AI Dashboard] Cache hit for userId: ${userId}`);
    aiInsights = cached.insights || [];
    aiNextSteps = cached.nextSteps || [];
    aiUpdatedAt = new Date(cached.cachedAt).toISOString();
  } else {
    // Cache miss - call OpenAI with compact payload
    console.log(`[AI Dashboard] Cache miss - calling OpenAI for userId: ${userId}`);

    // Create compact AI summary payload (not full project objects)
    const aiSummary = {
      projectCount: summary.projectCount,
      totals: summary.totals,
      statusBreakdown: summary.statusBreakdown,
      projects: projectsForModel.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        bidPrice: p.bidPrice,
        estimatedCost: p.estimatedCost,
        actualCost: p.actualCost,
        marginPct: p.marginPct,
        markupPct: p.markupPct,
        profit: p.profit,
        budgetVariance: p.budgetVariance,
        receiptsCoveragePct: p.receiptsCoveragePct,
        hasReceiptsAttached: p.hasReceiptsAttached,
        hasPermitLineItem: p.hasPermitLineItem,
        hasPermitFeesFlag: p.hasPermitFeesFlag,
        progressPct: p.progressPct,
        projectType: p.projectType,
        location: p.location,
        daysInStatus: p.updatedAt ? Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
        highValueFlag: p.bidPrice >= 20000,
      })),
      baseInsightCount: baseInsights.length,
      baseNextStepCount: baseNextSteps.length,
      materialTrends: materialStats
        .filter(m => typeof m.changePct30d === 'number' && Math.abs(m.changePct30d) >= 5)
        .map(m => ({
          projectId: m.projectId,
          lineItemName: m.lineItemName,
          changePct30d: m.changePct30d,
        })),
    };

    const payload = {
      summary: aiSummary,
      baseInsights,
      baseNextSteps,
      materials: materialStats
        .filter(m => typeof m.changePct30d === 'number' && Math.abs(m.changePct30d) >= 5),
      closedProjectIds: [...closedProjectIdsForAiGuard],
      instruction:
        'closedProjectIds are finished jobs. NEVER generate operational insights for those ids (no permits, progress, follow-ups, securing bids, or budget variance as if work is ongoing). Retrospective baseInsights for those ids are already provided.',
    };

    console.log('[AI Dashboard] Calling OpenAI with:', {
      projectCount: aiSummary.projectCount,
      baseInsightsCount: baseInsights.length,
      baseNextStepsCount: baseNextSteps.length,
      totalBid: aiSummary.totals.totalBid,
      totalEstimatedCost: aiSummary.totals.totalEstimatedCost,
      totalActualCost: aiSummary.totals.totalActualCost,
      sampleProject: aiSummary.projects[0] || null,
    });

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
- "summary": roll-up stats and compact project summaries with key metrics.
- "baseInsights" and "baseNextSteps": rule-based findings already detected (may be empty).
- "materials": materialStats with significant price changes (5%+).

Your job:
1) Generate 3–6 high-value "insights" by analyzing the project data.
   - If baseInsights exist, add insights that complement them (don't duplicate).
   - If baseInsights is empty, generate insights from scratch by analyzing the projects.
   - Look for: margin trends, budget health, progress vs spend, collection risks, opportunities.
2) Generate 3–6 concrete "nextSteps" that are actionable and profit-focused.
   - If baseNextSteps exist, add steps that complement them.
   - If baseNextSteps is empty, generate steps from scratch.

CRITICAL: You MUST always return at least 3 insights and 3 nextSteps, even if projects look healthy.
If everything looks good, generate positive insights like:
- "Portfolio margin is strong at X%"
- "All projects are on track"
- "Consider optimizing material costs"
- "Review upcoming milestones"

Rules:
- ONLY talk about data from the payload.
- If "closedProjectIds" is non-empty: do NOT attach insights or nextSteps to those projectIds unless purely portfolio-level. Closed jobs already have retrospective lines in baseInsights — do not duplicate or contradict with active-job language.
- Keep language simple and contractor-friendly.
- "type" for insights:
   - "alert" for risk/overrun/serious issues
   - "opportunity" for savings or extra profit
   - "info" for neutral useful context or positive status
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
        ruleBasedUpdatedAt,
        aiUpdatedAt: null,
        lastUpdated: ruleBasedUpdatedAt,
      };
    }

    let parsed = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch (err) {
      console.error('[AI Dashboard] Failed to parse AI JSON:', err, 'raw=', rawContent);
    }

    aiInsights = Array.isArray(parsed.insights) ? parsed.insights : [];
    aiNextSteps = Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [];

    // Drop operational GPT lines that target closed job ids (hallucinated or ignored instructions)
    aiInsights = aiInsights.filter((ins) => {
      const pid = ins.projectId != null ? String(ins.projectId).trim() : '';
      if (pid && closedProjectIdsForAiGuard.has(pid)) return false;
      return true;
    });
    aiNextSteps = aiNextSteps.filter((st) => {
      const pid = st.projectId != null ? String(st.projectId).trim() : '';
      if (pid && closedProjectIdsForAiGuard.has(pid)) return false;
      return true;
    });

    console.log('[AI Dashboard] AI returned:', {
      insightsCount: aiInsights.length,
      nextStepsCount: aiNextSteps.length,
      firstInsight: aiInsights[0] || null,
    });

    // If AI returned empty insights but we have projects, generate a fallback
    if (aiInsights.length === 0 && projectsForModel.length > 0) {
      console.warn('[AI Dashboard] AI returned no insights, adding fallback');
      aiInsights.push({
        id: 'ai-fallback-portfolio',
        type: 'info',
        title: 'Portfolio overview',
        body: `You have ${projectsForModel.length} active project${projectsForModel.length > 1 ? 's' : ''} with a total bid value of $${summary.totals.totalBid.toLocaleString()}. Continue tracking expenses and progress for personalized insights.`,
        projectId: null,
        impactScore: 1,
      });
    }

    aiUpdatedAt = new Date().toISOString();

    // Store in cache
    setCachedAiInsights(userId, snapshotHash, aiInsights, aiNextSteps);
  }

  // ---------- Combine rule-based + AI insights ---------- //

  const allInsights = [...baseInsights, ...aiInsights];
  const allNextSteps = [...baseNextSteps, ...aiNextSteps];

  console.log('[AI Dashboard] Final insights count:', {
    baseInsights: baseInsights.length,
    aiInsights: aiInsights.length,
    total: allInsights.length,
    projectsCount: projectsForModel.length,
    totalBid: summary.totals.totalBid,
    totalActualCost: summary.totals.totalActualCost,
  });

  // Final fallback: If we have projects but STILL no insights after all checks, show a message
  // This should rarely trigger now that we have AI fallbacks, but it's a safety net
  if (projectsForModel.length > 0 && allInsights.length === 0) {
    console.warn('[AI Dashboard] No insights generated at all, adding final fallback');
    allInsights.push({
      id: 'final-fallback-healthy',
      type: 'info',
      title: 'Projects look healthy',
      body: `You have ${projectsForModel.length} active project${projectsForModel.length > 1 ? 's' : ''} with a total bid value of $${summary.totals.totalBid.toLocaleString()}. Continue tracking expenses and progress to get personalized insights.`,
      projectId: null,
      impactScore: 1,
    });
  }

  const result = {
    insights: allInsights,
    nextSteps: allNextSteps,
    ruleBasedUpdatedAt,
    aiUpdatedAt,
    lastUpdated: aiUpdatedAt || ruleBasedUpdatedAt,
  };

  return result;
}

module.exports = {
  buildAiDashboardForUser,
};
