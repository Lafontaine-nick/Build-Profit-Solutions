// ── Portfolio / routing intent (shared by aiAssistant route + regression tests) ──
function normalizeAiMessageForIntent(message = '') {
  return String(message || '')
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase()
    .trim();
}

// Note: messages are lowercased before test — use /i so "am i" matches after normalization
const SIMPLE_PROJECT_BUDGET_STATUS_PATTERN =
  /\b(am i |are we |is (?:this |the )?project )?over budget\b|\bover budget\b|\bbudget status\b|\b(?:within|under|over) budget\b|\bspent over (?:my )?budget\b/i;

const PORTFOLIO_LOSING_MONEY_PATTERN =
  /\b(where am I losing money|losing money across|profit leak|biggest profit leak|show me the biggest profit leak)\b/i;

// Must not match generic "over budget on this job" — require portfolio phrasing
const PORTFOLIO_OVER_BUDGET_LIST_PATTERN =
  /\b(which\s+)?(active\s+)?projects?\s+(are\s+)?over\s+budget|(show\s+)?projects?\s+over\s+budget|over\s+budget\s+and\s+by\s+how\s+much|identify\s+budget\s+risks|budget\s+risks\b/i;

const PORTFOLIO_COMPARE_ACTIVE_PATTERN =
  /\bcompare\s+(?:my\s+)?active\s+(?:projects?|jobs?)\b|\bcompare\s+all\s+my\s+active\s+(?:projects?|jobs?)\b|\bcompare\s+my\s+active\s+work\b/i;

// Exclude "worst-case" (estimate scenario) — use worst(?!-) where relevant
const PORTFOLIO_WORST_PROJECT_PATTERN =
  /\b(?:which|what)\s+(?:job|project)\s+is\s+(?:the\s+)?worst(?!-)\b|\b(?:what|which)\s+is\s+(?:the\s+)?worst(?!-)\s+(?:job|project)\b|\b(?:worst(?!-)|lowest\s+margin)\s+(?:job|project)\b|\bwhich\s+(?:one|job|project)\s+has\s+(?:the\s+)?lowest\s+margin\b|\blowest\s+margin\s+(?:job|project|across)\b/i;

function isPortfolioLosingMoneyQuery(message = '') {
  return PORTFOLIO_LOSING_MONEY_PATTERN.test(normalizeAiMessageForIntent(message));
}

function isPortfolioOverBudgetListQuery(message = '') {
  return PORTFOLIO_OVER_BUDGET_LIST_PATTERN.test(normalizeAiMessageForIntent(message));
}

/** Single-project budget status ("am I over budget?") — excludes portfolio list questions */
function isSimpleProjectBudgetStatusQuery(message = '') {
  const s = normalizeAiMessageForIntent(message);
  if (isPortfolioOverBudgetListQuery(s)) return false;
  return SIMPLE_PROJECT_BUDGET_STATUS_PATTERN.test(s);
}

function isPortfolioCompareActiveQuery(message = '') {
  return PORTFOLIO_COMPARE_ACTIVE_PATTERN.test(normalizeAiMessageForIntent(message));
}

function isPortfolioWorstProjectQuery(message = '') {
  return PORTFOLIO_WORST_PROJECT_PATTERN.test(normalizeAiMessageForIntent(message));
}

/** Same ordering rules as compare_projects in aiAssistant.js */
function sortCompareProjectsResults(items = [], sortBy = '') {
  const key = String(sortBy || '').toLowerCase();
  const arr = [...(Array.isArray(items) ? items : [])];
  return arr.sort((a, b) => {
    if (key === 'progress') return b.progress - a.progress;
    if (key === 'overbudget') return b.overBudgetPct - a.overBudgetPct;
    if (key === 'risk') return (b.riskFlags?.length || 0) - (a.riskFlags?.length || 0);
    if (key === 'lowmargin' || key === 'worst') return (a.margin ?? 0) - (b.margin ?? 0);
    return (b.margin ?? 0) - (a.margin ?? 0);
  });
}

function formatMarginReply(opts = {}) {
  const { spendToDatePct, projectedPct, originalEstPct, projectedProfit, followUp = '➡️ Want me to check your PO commitments or anything else?' } = opts;
  const lines = ['### Margin Summary\n'];
  if (spendToDatePct != null) lines.push(`**Spend-to-date:** ${Number(spendToDatePct).toFixed(1)}%`);
  if (projectedPct != null) lines.push(`**Projected at completion:** ${typeof projectedPct === 'string' ? projectedPct : Number(projectedPct).toFixed(1) + '%'}`);
  if (originalEstPct != null) lines.push(`**Original estimate:** ${typeof originalEstPct === 'string' ? originalEstPct : Number(originalEstPct).toFixed(1) + '%'}`);
  const profitStr = projectedProfit != null
    ? (typeof projectedProfit === 'string' ? projectedProfit : `$${Math.round(projectedProfit).toLocaleString()}`)
    : '—';
  lines.push(`**Projected profit:** ${profitStr}`);
  lines.push('');
  lines.push('_**Spend-to-date margin** = (revenue − spent) ÷ revenue. **Projected at completion** uses run-rate cost from progress vs contract._');
  lines.push('');
  lines.push(followUp);
  return lines.join('\n');
}

function normalizeMoneyValue(value) {
  if (value == null) return 0;
  if (typeof value === 'string') {
    const cleaned = Number(value.replace(/[$,\s]/g, ''));
    return Number.isFinite(cleaned) ? cleaned : 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function sumPlannedCostFromBuckets(buckets) {
  if (!Array.isArray(buckets)) return 0;
  return buckets.reduce((sum, bucket) => {
    const name = String(bucket?.name || '').toLowerCase();
    if (
      name.includes('markup') ||
      name.includes('revenue') ||
      name.includes('contract value') ||
      name.includes('sell price') ||
      (name.includes('profit') && !name.includes('cost'))
    ) {
      return sum;
    }
    return sum + normalizeMoneyValue(bucket?.budget);
  }, 0);
}

function getApprovedChangeOrdersTotal(changeOrders = []) {
  if (!Array.isArray(changeOrders)) return 0;
  return changeOrders.reduce((sum, co) => {
    const approved = (typeof co?.approved === 'boolean' && co.approved) ||
      (typeof co?.status === 'string' && co.status.toLowerCase() === 'approved');
    return approved ? sum + normalizeMoneyValue(co?.amount ?? 0) : sum;
  }, 0);
}

function getProjectMilestones(project, parsedContext = {}, opts = {}) {
  const { preferParsedMilestones = false } = opts;
  if (preferParsedMilestones && Array.isArray(parsedContext?.milestones) && parsedContext.milestones.length > 0) {
    return parsedContext.milestones;
  }
  return project?.milestones ||
    project?.timelineItems ||
    project?.weeklyPayments ||
    project?.projectData?.milestones ||
    project?.projectData?.timelineItems ||
    project?.projectData?.weeklyPayments ||
    project?.estimateData?.milestones ||
    project?.estimateData?.paymentMilestones ||
    project?.estimateData?.weeklyPayments ||
    project?.projectData?.estimateData?.milestones ||
    project?.projectData?.estimateData?.paymentMilestones ||
    project?.projectData?.estimateData?.weeklyPayments ||
    parsedContext?.milestones ||
    [];
}

function getPaymentDateValue(milestone) {
  return milestone?.plannedDate || milestone?.scheduledDate || milestone?.dueDate || milestone?.date || null;
}

function isPaymentCollectedForAI(milestone, opts = {}) {
  const { projectIsCompleted = false } = opts;
  if (projectIsCompleted) return true;
  const status = String(milestone?.status || milestone?.state || '').toLowerCase();
  if (status.includes('complete') || status.includes('paid') || status.includes('collected') || status === 'done' || status === 'finished') return true;
  if (milestone?.collected === true || milestone?.isPaid === true || milestone?.paid === true) return true;
  const pct = Number(milestone?.progressPct ?? milestone?.progress ?? 0);
  return Number.isFinite(pct) && pct >= 100;
}

function getProjectFinancialSnapshot({ parsedContext = {}, project = null, progressOverride = null } = {}) {
  const estimateData = project?.estimateData || project?.projectData?.estimateData || parsedContext?.estimateData || {};
  const changeOrders = parsedContext?.changeOrders || project?.changeOrders || project?.projectData?.changeOrders || [];
  const costBuckets =
    parsedContext?.buckets ??
    project?.buckets ??
    project?.projectData?.buckets ??
    [];
  const plannedCostFromBuckets = sumPlannedCostFromBuckets(costBuckets);
  const projectAdjustedCostBudget = normalizeMoneyValue(
    project?.adjustedCostBudget ??
    project?.projectData?.adjustedCostBudget ??
    0
  );
  const projectForecastFinalCost = normalizeMoneyValue(
    project?.forecastFinalCost ??
    project?.projectData?.forecastFinalCost ??
    0
  );
  const approvedChangeOrders = parsedContext?.approvedChangeOrdersTotal != null
    ? normalizeMoneyValue(parsedContext.approvedChangeOrdersTotal)
    : getApprovedChangeOrdersTotal(changeOrders);
  const baseBid = normalizeMoneyValue(
    parsedContext?.bidTotal ??
    parsedContext?.total ??
    parsedContext?.bidPrice ??
    project?.bidPrice ??
    project?.bidTotal ??
    estimateData?.totalBid ??
    0
  );
  const revenue = normalizeMoneyValue(parsedContext?.contractValue) || (baseBid + approvedChangeOrders > 0 ? baseBid + approvedChangeOrders : baseBid);
  const estimatedCost = normalizeMoneyValue(
    parsedContext?.adjustedCostBudget ??
    parsedContext?.forecastFinalCost ??
    (plannedCostFromBuckets > 0 ? plannedCostFromBuckets : null) ??
    projectAdjustedCostBudget ??
    projectForecastFinalCost ??
    parsedContext?.estimatedCost ??
    project?.estimatedCost ??
    project?.estimateData?.totalCost ??
    project?.estimateData?.baseCost ??
    project?.projectData?.estimateData?.totalCost ??
    project?.projectData?.estimateData?.baseCost ??
    0
  );
  const spent = normalizeMoneyValue(
    parsedContext?.actualCost ??
    parsedContext?.totalSpent ??
    project?.actualCost ??
    project?.totalSpent ??
    project?.spent ??
    0
  );
  const progressRaw = progressOverride ??
    parsedContext?.progress ??
    project?.progress ??
    project?.overallProgressPct ??
    project?.projectData?.progress ??
    0;
  const progress = Math.max(0, Math.min(100, normalizeMoneyValue(progressRaw)));

  const rawBidMargin = parsedContext?.bidMarginPct ??
    project?.bidMarginPct ??
    project?.marginPct ??
    estimateData?.marginPercent ??
    estimateData?.marginPct ??
    estimateData?.margin ??
    project?.margin;
  let bidMarginPct = normalizeMoneyValue(rawBidMargin);
  if (bidMarginPct > 0 && bidMarginPct <= 1) bidMarginPct *= 100;
  if (bidMarginPct <= 0 || bidMarginPct > 100) {
    bidMarginPct = revenue > 0 && estimatedCost > 0 ? ((revenue - estimatedCost) / revenue * 100) : 0;
  }

  const computedSpendToDateMarginPct = revenue > 0 && spent >= 0 ? ((revenue - spent) / revenue * 100) : null;
  const contextSpendToDateMarginPct = parsedContext?.spendToDateMarginPct ?? project?.spendToDateMarginPct ?? project?.projectData?.spendToDateMarginPct;
  const spendToDateMarginPct =
    typeof contextSpendToDateMarginPct === 'number' && Number.isFinite(contextSpendToDateMarginPct)
      ? contextSpendToDateMarginPct
      : computedSpendToDateMarginPct;
  const contextProjectedFinalCost = normalizeMoneyValue(parsedContext?.forecastFinalCost || projectForecastFinalCost);
  const derivedProjectedFinalCost = progress > 5 && spent > 0 ? (spent / (progress / 100)) : estimatedCost;
  const projectedFinalCost = contextProjectedFinalCost > 0 ? contextProjectedFinalCost : derivedProjectedFinalCost;
  const contextProjectedProfit = parsedContext?.projectedProfit ?? project?.projectedProfit ?? project?.projectData?.projectedProfit;
  const derivedProjectedProfit = revenue - projectedFinalCost;
  const projectedProfit =
    typeof contextProjectedProfit === 'number' && Number.isFinite(contextProjectedProfit)
      ? contextProjectedProfit
      : derivedProjectedProfit;
  const contextProjectedMarginPct = parsedContext?.projectedMarginPct ?? project?.projectedMarginPct ?? project?.projectData?.projectedMarginPct;
  const projectedMarginPct =
    typeof contextProjectedMarginPct === 'number' && Number.isFinite(contextProjectedMarginPct)
      ? contextProjectedMarginPct
      : revenue > 0 ? (projectedProfit / revenue) * 100 : null;
  const currentMarginPct = spent > 0
    ? spendToDateMarginPct
    : (projectedMarginPct > 0 ? projectedMarginPct : (bidMarginPct > 0 ? bidMarginPct : projectedMarginPct));

  return {
    approvedChangeOrders,
    revenue,
    estimatedCost,
    spent,
    progress,
    bidMarginPct,
    spendToDateMarginPct,
    projectedFinalCost,
    projectedProfit,
    projectedMarginPct,
    currentMarginPct,
  };
}

function buildMakingEnoughReply(projectName, marginPct) {
  const m = Number(marginPct).toFixed(1);
  const above = parseFloat(m) >= 20 ? 'above' : (parseFloat(m) >= 15 ? 'at' : 'below');
  let reply = `Your current margin on **${projectName}** is **${m}%** based on the current numbers in this view. Many contractors target 15–25%; you're **${above}** that. `;
  reply += parseFloat(m) < 15 ? `Consider tightening costs or revisiting pricing on the next phase.` : `You're in a healthy range.`;
  reply += `\n\n➡️ Want me to check your biggest profit threat or run a scenario?`;
  return reply;
}

function buildProjectedProfitReply({ projectName = 'This project', projectedProfit = null, marginPct = null, followUp = 'Want me to check your PO commitments or run a what-if scenario if the job runs longer?' } = {}) {
  const projProfitStr = projectedProfit != null ? `$${Math.round(projectedProfit).toLocaleString()}` : '—';
  const marginStr = marginPct != null ? `${Number(marginPct).toFixed(1)}%` : '—';
  let reply = `The projected profit for the "${projectName}" project is ${projProfitStr}`;
  if (marginStr !== '—') reply += `, with a ${marginStr} margin`;
  reply += `. `;
  if (projectedProfit != null && projectedProfit >= 0) reply += `The project is on track, with no profit at risk. `;
  reply += followUp;
  return reply;
}

function computeMarginAtProgress({ contract = 0, spent = 0, estimatedCost = 0, currentProgressPct = 0, targetProgressPct = 0 } = {}) {
  const progressPct = Math.max(0.1, Math.min(99, Number(currentProgressPct || 0)));
  const targetPct = Math.max(1, Math.min(99, Number(targetProgressPct || 0)));
  const spendAtTarget = progressPct > 0 ? spent * (targetPct / progressPct) : (estimatedCost * (targetPct / 100));
  const profitAtTarget = contract - spendAtTarget;
  const marginAtTarget = contract > 0 ? (profitAtTarget / contract) * 100 : 0;
  const projectedFinalCost = progressPct > 5 && spent > 0 ? spent / (progressPct / 100) : estimatedCost;
  const marginAtCompletion = contract > 0 ? ((contract - projectedFinalCost) / contract) * 100 : 0;
  return {
    targetProgressPct: targetPct,
    spendAtTarget,
    profitAtTarget,
    marginAtTarget,
    projectedFinalCost,
    marginAtCompletion,
  };
}

function buildMarginAtProgressReply({ targetProgressPct, profitAtTarget, marginAtTarget, marginAtCompletion, followUp = 'Want me to run a what-if scenario to pressure-test this?' } = {}) {
  let reply = `At **${targetProgressPct}% complete** (${100 - targetProgressPct}% timeline left), your **margin** would be approximately **${Number(marginAtTarget).toFixed(1)}%** (profit: $${Math.round(profitAtTarget).toLocaleString()}). `;
  reply += `This assumes spend scales linearly with progress. Your current projection at completion is ${Number(marginAtCompletion).toFixed(1)}% margin. `;
  reply += followUp;
  return reply;
}

function buildMarginReplyForProject(project, opts = {}) {
  const {
    parsedContext = {},
    isCurrent = false,
    followUp = '➡️ Want me to check your PO commitments or anything else?',
    progressOverride = null,
  } = opts;
  if (!project) return null;

  const snapshot = getProjectFinancialSnapshot({
    project,
    parsedContext: isCurrent ? parsedContext : {},
    progressOverride,
  });

  const projectedProfit = isCurrent && typeof parsedContext.projectedProfit === 'number' && Number.isFinite(parsedContext.projectedProfit)
    ? Math.round(parsedContext.projectedProfit)
    : (snapshot.projectedProfit != null && Number.isFinite(snapshot.projectedProfit) ? Math.round(snapshot.projectedProfit) : null);

  return {
    snapshot,
    reply: formatMarginReply({
      spendToDatePct: snapshot.spendToDateMarginPct,
      projectedPct: snapshot.projectedMarginPct,
      originalEstPct: snapshot.bidMarginPct,
      projectedProfit,
      followUp,
    }),
  };
}

function normalizeProjectSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rankProjectsByQuery(projects = [], rawQuery = '') {
  const searchName = normalizeProjectSearchText(rawQuery);
  const searchTokens = searchName.split(/\s+/).filter(Boolean);
  if (!searchName || !Array.isArray(projects) || projects.length === 0) return [];

  return projects
    .map((project) => {
      const title = normalizeProjectSearchText(project?.title || project?.name || '');
      const customer = normalizeProjectSearchText(project?.customerName || project?.client || '');
      const locationText = normalizeProjectSearchText(project?.location || '');
      const corpus = [title, customer, locationText].filter(Boolean).join(' ').trim();
      const corpusTokens = corpus.split(/\s+/).filter(Boolean);
      let score = 0;
      if (!corpus) return { project, score, title };

      if (title === searchName || customer === searchName) score += 100;
      if (title && (title.startsWith(`${searchName} `) || title.endsWith(` ${searchName}`) || title.includes(` ${searchName} `))) score += 70;
      if (customer && (customer.startsWith(`${searchName} `) || customer.endsWith(` ${searchName}`) || customer.includes(` ${searchName} `))) score += 55;
      if (title.includes(searchName) || customer.includes(searchName)) score += 40;
      if (searchName.includes(title) && title.length > 3) score += 25;

      const tokenMatches = searchTokens.filter((token) =>
        corpusTokens.some((corpusToken) => corpusToken === token || corpusToken.includes(token) || token.includes(corpusToken))
      ).length;
      if (searchTokens.length > 0) {
        score += Math.round((tokenMatches / searchTokens.length) * 45);
      }
      if (locationText && searchTokens.some((token) => locationText.includes(token))) score += 12;

      return { project, score, title };
    })
    .sort((a, b) => b.score - a.score);
}

function resolveProjectByQuery(projects = [], rawQuery = '', opts = {}) {
  const { minScore = 40, ambiguityGap = 12 } = opts;
  const ranked = rankProjectsByQuery(projects, rawQuery);
  const best = ranked[0];
  const second = ranked[1];
  const confidence = Math.max(0, Math.min(1, (best?.score || 0) / 100));
  const lowConfidence = !best || best.score < minScore || (second && (best.score - second.score) < ambiguityGap);
  return {
    ranked,
    best,
    second,
    confidence,
    lowConfidence,
    project: !lowConfidence && best ? best.project : null,
  };
}

function isCurrentProjectMatch(project, parsedContext = {}) {
  if (!project) return false;
  if (parsedContext?.projectId && String(project?.id) === String(parsedContext.projectId)) return true;
  const currentName = normalizeProjectSearchText(parsedContext?.currentProject || parsedContext?.projectName || '');
  const projectName = normalizeProjectSearchText(project?.title || project?.name || '');
  return !!currentName && !!projectName && currentName === projectName;
}

function collectPaymentBuckets({ parsedContext = {}, projects = [], currentProject = null, now = new Date(), currentProjectIsCompleted = false } = {}) {
  const upcoming = [];
  const overdue = [];
  const unscheduled = [];
  const currentProjectId = currentProject?.id != null ? String(currentProject.id) : null;

  const addPaymentsFromProject = (project, milestonesList, opts = {}) => {
    if (!project) return;
    const title = project?.title || project?.name || 'Project';
    const projectIsCompleted = opts.projectIsCompleted === true;
    const rawMilestones = Array.isArray(milestonesList) ? milestonesList : [];
    rawMilestones
      .filter((milestone) => !isPaymentCollectedForAI(milestone, { projectIsCompleted }))
      .forEach((milestone) => {
        const date = getPaymentDateValue(milestone);
        const dateMs = date ? new Date(date).getTime() : NaN;
        const item = {
          projectId: project?.id,
          projectTitle: title,
          name: milestone?.title || milestone?.name || 'Payment',
          amount: normalizeMoneyValue(milestone?.amount ?? milestone?.paymentAmount ?? 0),
          date,
          dateMs,
        };
        if (Number.isFinite(dateMs)) {
          if (dateMs < now.getTime()) overdue.push(item);
          else upcoming.push(item);
        } else {
          unscheduled.push(item);
        }
      });
  };

  if (currentProject) {
    addPaymentsFromProject(
      currentProject,
      getProjectMilestones(currentProject, parsedContext, { preferParsedMilestones: true }),
      { projectIsCompleted: currentProjectIsCompleted }
    );
  }

  (Array.isArray(projects) ? projects : []).forEach((project) => {
    if (!project) return;
    if (currentProjectId && String(project?.id ?? '') === currentProjectId) return;
    const status = String(project?.status || project?.projectData?.status || '').toLowerCase();
    const projectIsCompleted = status === 'completed' || status === 'done' || status === 'finished';
    addPaymentsFromProject(project, getProjectMilestones(project), { projectIsCompleted });
  });

  upcoming.sort((a, b) => (a.dateMs || 0) - (b.dateMs || 0));
  overdue.sort((a, b) => (a.dateMs || 0) - (b.dateMs || 0));
  return { upcoming, overdue, unscheduled };
}

function buildPaymentStatusReply({ upcoming = [], overdue = [], unscheduled = [], fallbackProjectName = 'your project' } = {}) {
  if (upcoming.length > 0) {
    const first = upcoming[0];
    const dateStr = first.date ? (typeof first.date === 'string' ? first.date : new Date(first.date).toLocaleDateString()) : 'no date set';
    let reply = `Your next payment is the **${first.name}** for the **${first.projectTitle}** project, amounting to **$${Math.round(first.amount).toLocaleString()}**, due on ${dateStr}.`;
    if (upcoming.length > 1) {
      reply += `\n\nOther upcoming: ` + upcoming.slice(1, 4).map((p) => `${p.name} (${p.projectTitle}) $${Math.round(p.amount).toLocaleString()}${p.date ? ` due ${typeof p.date === 'string' ? p.date : new Date(p.date).toLocaleDateString()}` : ''}`).join('; ');
    }
    if (overdue.length > 0) reply += `\n\n⚠️ ${overdue.length} overdue: ${overdue.slice(0, 3).map((p) => `${p.name} (${p.projectTitle})`).join(', ')}.`;
    reply += `\n\n➡️ Want me to check margin or PO commitments?`;
    return reply;
  }

  if (overdue.length > 0) {
    const first = overdue[0];
    const dateStr = first.date ? (typeof first.date === 'string' ? first.date : new Date(first.date).toLocaleDateString()) : '';
    let reply = `You have overdue payments. Next one due was **${first.name}** for **${first.projectTitle}** ($${Math.round(first.amount).toLocaleString()}${dateStr ? `, was due ${dateStr}` : ''}).`;
    if (overdue.length > 1) reply += ` Plus ${overdue.length - 1} more overdue.`;
    reply += `\n\n➡️ Want me to list all overdue or check margin?`;
    return reply;
  }

  if (unscheduled.length > 0) {
    let reply = `No dated payments coming up. You have **${unscheduled.length}** unscheduled payment(s): ` +
      unscheduled.slice(0, 3).map((u) => `${u.name} $${Math.round(u.amount).toLocaleString()}`).join(', ');
    reply += `. Set dates in the Timeline tab for each project.`;
    return reply;
  }

  return `Payments are managed in the Timeline tab (${fallbackProjectName}). Open the project → Timeline to add or edit payment milestones and due dates.`;
}

function buildBudgetStatusReply({ projectName = 'This project', budget = 0, spent = 0 } = {}) {
  if (!(budget > 0)) return null;
  const overBy = spent - budget;
  let reply;
  if (overBy > 0) {
    reply = `Yes — **${projectName}** is **$${Math.round(overBy).toLocaleString()} over budget** (spent $${Math.round(spent).toLocaleString()} of $${Math.round(budget).toLocaleString()} budget).`;
  } else {
    const remaining = budget - spent;
    reply = `No — you're within budget for **${projectName}** (spent $${Math.round(spent).toLocaleString()} of $${Math.round(budget).toLocaleString()}, **$${Math.round(remaining).toLocaleString()}** remaining).`;
  }
  reply += `\n\n➡️ Want me to check margin or PO commitments?`;
  return reply;
}

function createProfitLeak({
  projectId = null,
  projectTitle = 'Project',
  type,
  severity = 'medium',
  impactEstimate = 0,
  headline,
  body,
  evidence = [],
  recommendedAction = null,
}) {
  return {
    id: `${type}-${projectId || 'portfolio'}`,
    type,
    severity,
    impactEstimate: Math.round(Number(impactEstimate || 0)),
    headline,
    body,
    evidence: Array.isArray(evidence) ? evidence.filter(Boolean).slice(0, 3) : [],
    recommendedAction,
    projectId: projectId != null ? String(projectId) : null,
    projectTitle,
  };
}

function buildProjectProfitLeaks(project, snapshot = {}, opts = {}) {
  const {
    overdueItems = [],
    overduePayments = [],
    missingReceipts = 0,
  } = opts;

  const title = project?.title || project?.name || 'Untitled Project';
  const projectId = project?.id != null ? String(project.id) : null;
  const status = String(project?.status || '').toLowerCase();
  const isEstimate =
    status === 'estimate' ||
    status === 'draft' ||
    status === 'submitted' ||
    status === 'bid_submitted';
  const isCompleted =
    status === 'completed' ||
    status === 'done' ||
    status === 'finished' ||
    Number(snapshot.progress || 0) >= 100;

  const leaks = [];
  const revenue = Number(snapshot.revenue || 0);
  const budget = Number(snapshot.estimatedCost || 0);
  const spent = Number(snapshot.spent || 0);
  const progress = Number(snapshot.progress || 0);
  const expectedSpend = budget > 0 ? budget * (Math.max(0, Math.min(100, progress)) / 100) : 0;
  const spendAheadBy = Math.max(0, spent - expectedSpend);
  const projectedMarginPct = Number(snapshot.projectedMarginPct || 0);
  const bidMarginPct = Number(snapshot.bidMarginPct || 0);
  const marginDrop = bidMarginPct > 0 && projectedMarginPct > 0 ? (bidMarginPct - projectedMarginPct) : 0;
  const overdueAmount = (Array.isArray(overduePayments) ? overduePayments : []).reduce(
    (sum, item) => sum + normalizeMoneyValue(item?.amount ?? 0),
    0
  );
  const overBudgetBy = Math.max(0, spent - budget);

  if (!isCompleted && progress > 0 && budget > 0 && spendAheadBy > Math.max(1000, budget * 0.08)) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'spend_ahead_of_progress',
      severity: spendAheadBy > budget * 0.15 ? 'high' : 'medium',
      impactEstimate: spendAheadBy,
      headline: `Spend is ahead of progress on ${title}`,
      body: `${title} is ${Math.round((spent / budget) * 100)}% spent at ${Math.round(progress)}% progress. That usually means margin is leaking before the job is complete.`,
      evidence: [
        `Spent: $${Math.round(spent).toLocaleString()} of $${Math.round(budget).toLocaleString()} budget`,
        `Progress: ${Math.round(progress)}%`,
        `Spend ahead by about $${Math.round(spendAheadBy).toLocaleString()}`,
      ],
      recommendedAction: {
        label: `Review cost burn on ${title}`,
        chip: 'Protect margin',
        priority: spendAheadBy > budget * 0.15 ? 'high' : 'medium',
      },
    }));
  }

  if (!isCompleted && budget > 0 && spent > budget) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'over_budget',
      severity: overBudgetBy > budget * 0.1 ? 'high' : 'medium',
      impactEstimate: overBudgetBy,
      headline: `${title} is over budget`,
      body: `${title} has already spent more than the current estimate allows. Without correction, projected profit will keep shrinking.`,
      evidence: [
        `Budget: $${Math.round(budget).toLocaleString()}`,
        `Spent: $${Math.round(spent).toLocaleString()}`,
        `Over by about $${Math.round(overBudgetBy).toLocaleString()}`,
      ],
      recommendedAction: {
        label: `Inspect overruns on ${title}`,
        chip: 'Urgent review',
        priority: overBudgetBy > budget * 0.1 ? 'high' : 'medium',
      },
    }));
  }

  if (!isCompleted && bidMarginPct > 0 && projectedMarginPct > 0 && marginDrop >= 5) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'margin_erosion',
      severity: marginDrop >= 10 ? 'high' : 'medium',
      impactEstimate: revenue > 0 ? revenue * (marginDrop / 100) : 0,
      headline: `Margin is eroding on ${title}`,
      body: `${title} started around ${bidMarginPct.toFixed(1)}% margin and is now projecting closer to ${projectedMarginPct.toFixed(1)}%.`,
      evidence: [
        `Original margin: ${bidMarginPct.toFixed(1)}%`,
        `Projected margin: ${projectedMarginPct.toFixed(1)}%`,
        `Margin drop: ${marginDrop.toFixed(1)} pts`,
      ],
      recommendedAction: {
        label: `Recover margin on ${title}`,
        chip: 'High impact',
        priority: marginDrop >= 10 ? 'high' : 'medium',
      },
    }));
  }

  if (!isCompleted && Array.isArray(overdueItems) && overdueItems.length > 0) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'overdue_collection',
      severity: overdueAmount >= 5000 ? 'high' : 'medium',
      impactEstimate: overdueAmount,
      headline: `Collections are overdue on ${title}`,
      body: `${title} has ${overdueItems.length} overdue payment${overdueItems.length > 1 ? 's' : ''}. Slow collections increase cash pressure even when the job is profitable on paper.`,
      evidence: [
        `${overdueItems.length} overdue payment${overdueItems.length > 1 ? 's' : ''}`,
        overdueAmount > 0 ? `About $${Math.round(overdueAmount).toLocaleString()} is past due` : null,
      ],
      recommendedAction: {
        label: `Follow up on payment for ${title}`,
        chip: 'Improve cash flow',
        priority: overdueAmount >= 5000 ? 'high' : 'medium',
      },
    }));
  }

  if (!isCompleted && missingReceipts >= 3) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'missing_receipts',
      severity: missingReceipts >= 6 ? 'medium' : 'low',
      impactEstimate: missingReceipts,
      headline: `${title} has missing cost backup`,
      body: `${title} is missing receipts on ${missingReceipts} expense${missingReceipts > 1 ? 's' : ''}. That makes job costing less trustworthy and can hide profit leaks.`,
      evidence: [
        `${missingReceipts} expenses missing receipts`,
      ],
      recommendedAction: {
        label: `Upload receipts for ${title}`,
        chip: '5 min',
        priority: missingReceipts >= 6 ? 'medium' : 'low',
      },
    }));
  }

  if (isEstimate && revenue >= 20000 && progress === 0) {
    leaks.push(createProfitLeak({
      projectId,
      projectTitle: title,
      type: 'stale_high_value_estimate',
      severity: revenue >= 50000 ? 'medium' : 'low',
      impactEstimate: revenue,
      headline: `High-value estimate is sitting idle: ${title}`,
      body: `${title} is a high-value estimate with no progress yet. Unfollowed estimates are revenue leaks, not just pipeline noise.`,
      evidence: [
        `Estimate value: $${Math.round(revenue).toLocaleString()}`,
        `Progress: 0%`,
      ],
      recommendedAction: {
        label: `Follow up on ${title}`,
        chip: 'New revenue',
        priority: revenue >= 50000 ? 'high' : 'medium',
      },
    }));
  }

  return leaks.sort((a, b) => {
    const sev = { high: 3, medium: 2, low: 1 };
    const sevDiff = (sev[b.severity] || 0) - (sev[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    return Number(b.impactEstimate || 0) - Number(a.impactEstimate || 0);
  });
}

function buildDailyCommandCenter(items = [], opts = {}) {
  const upcomingScheduleItems = Array.isArray(opts.upcomingScheduleItems) ? opts.upcomingScheduleItems : [];
  const safeItems = Array.isArray(items) ? items : [];
  const leaks = safeItems.flatMap((item) => Array.isArray(item?.profitLeaks) ? item.profitLeaks : []);
  const topProfitRisks = [...leaks]
    .sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 };
      const sevDiff = (sev[b.severity] || 0) - (sev[a.severity] || 0);
      if (sevDiff !== 0) return sevDiff;
      return Number(b.impactEstimate || 0) - Number(a.impactEstimate || 0);
    })
    .slice(0, 5);

  const topActions = [];
  const seenActionLabels = new Set();
  for (const leak of topProfitRisks) {
    const action = leak?.recommendedAction;
    if (!action?.label) continue;
    const key = String(action.label).trim().toLowerCase();
    if (seenActionLabels.has(key)) continue;
    seenActionLabels.add(key);
    topActions.push({
      id: `daily-action-${topActions.length + 1}`,
      label: action.label,
      chip: action.chip || 'Today',
      projectId: leak.projectId || null,
      priority: action.priority || (leak.severity === 'high' ? 'high' : 'medium'),
    });
  }

  const allUpcomingPayments = safeItems
    .flatMap((item) => (Array.isArray(item?.upcomingPayments) ? item.upcomingPayments.map((payment) => ({
      ...payment,
      projectId: item.projectId,
      projectTitle: item.title,
    })) : []))
    .sort((a, b) => {
      const da = a?.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b?.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    })
    .slice(0, 5);

  const activeItems = safeItems.filter((item) => !['completed', 'done', 'finished'].includes(String(item?.status || '').toLowerCase()));
  const totalProjectedProfit = activeItems.reduce((sum, item) => sum + Number(item?.projectedProfit || 0), 0);
  const averageMargin = activeItems.length > 0
    ? activeItems.reduce((sum, item) => sum + Number(item?.margin || 0), 0) / activeItems.length
    : 0;

  return {
    topProfitRisks,
    topActions,
    upcomingPayments: allUpcomingPayments,
    upcomingScheduleItems: upcomingScheduleItems.slice(0, 5),
    portfolioSummary: {
      activeProjectCount: activeItems.length,
      totalProjectCount: safeItems.length,
      totalProjectedProfit: Math.round(totalProjectedProfit),
      averageMargin: Math.round(averageMargin * 10) / 10,
      highestRiskProject: topProfitRisks[0]?.projectTitle || null,
    },
  };
}

function buildProfitLeakPromptBlock({ topProfitRisks = [], topActions = [] } = {}) {
  const risks = Array.isArray(topProfitRisks) ? topProfitRisks.slice(0, 5) : [];
  const actions = Array.isArray(topActions) ? topActions.slice(0, 5) : [];
  if (risks.length === 0 && actions.length === 0) return '';
  const riskLines = risks.map((risk, index) => {
    const impact = risk?.impactEstimate ? ` | impact≈$${Math.round(risk.impactEstimate).toLocaleString()}` : '';
    return `${index + 1}. ${risk.headline}${impact}${risk.projectTitle ? ` | project=${risk.projectTitle}` : ''}`;
  });
  const actionLines = actions.map((action, index) => `${index + 1}. ${action.label}${action.chip ? ` | ${action.chip}` : ''}`);
  return `\n\n📉 PROFIT LEAK SNAPSHOT (source of truth — use these before improvising)\n${riskLines.length ? riskLines.join('\n') : 'No major profit leaks detected right now.'}\n${actionLines.length ? `\nTOP ACTIONS:\n${actionLines.join('\n')}` : ''}\n→ When asked where profit is leaking, answer from this block first.\n→ Use direct answer -> evidence -> recommended action.`;
}

function analyzePortfolioProject(project, opts = {}) {
  const {
    parsedContext = {},
    progressOverride = null,
    compareItem = null,
    now = new Date(),
  } = opts;
  const title = project?.title || project?.name || 'Untitled Project';
  const financials = getProjectFinancialSnapshot({ project, progressOverride });
  const budget = financials.estimatedCost;
  const spent = financials.spent;
  const revenue = financials.revenue;
  const estimatedMarginPct = financials.bidMarginPct;
  const progress = financials.progress;
  const projectStatus = String(project?.status || '').toLowerCase();
  const isCompletedProject = projectStatus === 'completed' || projectStatus === 'done' || projectStatus === 'finished' || progress >= 100;
  const paymentBuckets = collectPaymentBuckets({
    projects: [],
    currentProject: project,
    now,
    currentProjectIsCompleted: isCompletedProject,
  });
  const overdueItems = paymentBuckets.overdue;
  const upcomingPayments = paymentBuckets.upcoming.map((item) => ({
    name: item.name,
    amount: normalizeMoneyValue(item.amount ?? 0),
    date: item.date,
  }));
  const unscheduledPayments = paymentBuckets.unscheduled.map((item) => ({
    name: item.name,
    amount: normalizeMoneyValue(item.amount ?? 0),
    date: null,
  }));
  const overBudgetPct = budget > 0 ? ((spent - budget) / budget) * 100 : 0;
  const projectedFinalCost = financials.projectedFinalCost;
  const projectedProfit = financials.projectedProfit;
  const projectedMarginPct = financials.projectedMarginPct || 0;
  const estimatedProfit = revenue - budget;
  const hasRealSpend = spent > 0;
  const displayMargin = hasRealSpend
    ? (financials.currentMarginPct != null ? financials.currentMarginPct : projectedMarginPct)
    : (compareItem?.margin != null && Number.isFinite(compareItem.margin))
      ? Number(compareItem.margin)
      : estimatedMarginPct;
  const expenses = project?.expenses || project?.projectData?.expenses || [];
  const missingReceipts = expenses.filter((expense) => !expense?.receiptUri || !String(expense.receiptUri).trim()).length;
  const profitLeaks = buildProjectProfitLeaks(project, financials, {
    overdueItems,
    overduePayments: overdueItems.map((item) => ({ name: item.name || 'Payment', amount: normalizeMoneyValue(item.amount ?? 0), date: item.date || null })),
    missingReceipts,
  });
  const riskFlags = [...new Set([
    ...(displayMargin > 0 && displayMargin < 10 ? ['low_margin'] : []),
    ...profitLeaks.map((leak) => leak.type === 'overdue_collection' ? 'overdue_milestones' : leak.type),
  ])];

  const marginRounded = Math.round(displayMargin * 10) / 10;
  return {
    projectId: project?.id,
    title,
    status: project?.status || 'unknown',
    margin: marginRounded,
    currentMargin: marginRounded,
    marginLabel: isCompletedProject ? 'Margin' : 'Current margin',
    profitLabel: isCompletedProject ? 'Net Profit' : 'Projected Profit',
    spent,
    budget,
    revenue,
    overBudgetPct: Math.round(overBudgetPct * 10) / 10,
    progress: Math.round(progress),
    overdueItems: overdueItems.length,
    overduePayments: overdueItems.map((item) => ({ name: item.name || 'Payment', amount: normalizeMoneyValue(item.amount ?? 0), date: item.date || null })),
    upcomingPayments,
    unscheduledPayments,
    projectedFinalCost: Math.round(projectedFinalCost),
    estimatedProfit: Math.round(estimatedProfit),
    projectedProfit: Math.round(projectedProfit),
    projectedMarginPct: Math.round(projectedMarginPct * 10) / 10,
    missingReceipts,
    riskFlags,
    profitLeaks,
  };
}

function buildPortfolioComparisonReply(data = []) {
  const safeData = Array.isArray(data) ? data : [];
  const isCompleted = (item) => (item.status || '').toLowerCase() === 'completed';
  const totalRevenue = safeData.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  const projectedProfitActive = safeData.filter((item) => !isCompleted(item)).reduce((sum, item) => sum + Number(item.projectedProfit || 0), 0);
  const netProfitCompleted = safeData.filter(isCompleted).reduce((sum, item) => sum + Number(item.projectedProfit || 0), 0);
  const highestMargin = safeData.reduce((best, item) => (Number(item.margin || 0) > Number(best?.margin || 0) ? item : best), null);
  const highestProfit = safeData.reduce((best, item) => (Number(item.projectedProfit || 0) > Number(best?.projectedProfit || 0) ? item : best), null);
  const needsAttention = safeData.filter((item) => item.missingReceipts > 0 || (Array.isArray(item.riskFlags) && item.riskFlags.length > 0));
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
    const receiptOnly = needsAttention.filter((item) => item.missingReceipts > 0).length === needsAttention.length &&
      needsAttention.every((item) => !Array.isArray(item.riskFlags) || item.riskFlags.length === 0 || (item.riskFlags.length === 1 && item.riskFlags[0] === 'missing_receipts'));
    if (needsAttention.length === safeData.length && receiptOnly) {
      summary += summary ? '. All projects need attention for missing receipts' : 'All projects need attention for missing receipts';
    } else {
      const names = needsAttention.map((item) => item.title).join(', ');
      summary += summary ? `. ${needsAttention.length} project(s) need attention: ${names}` : `${needsAttention.length} project(s) need attention: ${names}`;
    }
  }
  summary = summary ? `${summary}.\n\n` : '';

  let reply = "Here's the comparison of all your projects for profitability and risk:\n\n" + summary;
  safeData.forEach((item) => {
    const riskParts = [];
    if (item.missingReceipts > 0) riskParts.push(`${item.missingReceipts} missing receipts`);
    if (Array.isArray(item.riskFlags) && item.riskFlags.length > 0) {
      riskParts.push(...item.riskFlags.filter((risk) => risk !== 'missing_receipts').map((risk) => String(risk).replace(/_/g, ' ')));
    }
    const riskStr = riskParts.length > 0 ? `Risk: ${riskParts.join(', ')}` : 'Risk: None';
    const profitLabel = isCompleted(item) ? 'Net Profit' : 'Projected Profit';
    const marginLabel = isCompleted(item) ? 'Margin' : 'Current margin';
    reply += `**${item.title}**\n`;
    reply += `• ${marginLabel}: ${item.margin}%\n`;
    reply += `• Spent: $${fmt(item.spent || 0)}\n`;
    if (item.committedPOs != null && item.committedPOs > 0) reply += `• Committed POs: $${fmt(item.committedPOs)}\n`;
    reply += `• ${profitLabel}: $${fmt(item.projectedProfit || 0)}\n`;
    if (item.revenue != null && item.revenue > 0) reply += `• Revenue: $${fmt(item.revenue)}\n`;
    if (item.budgetUsedPct != null && item.budgetUsedPct > 0) reply += `• Budget used: ${item.budgetUsedPct}%\n`;
    if (item.progress != null) reply += `• Progress: ${Math.round(item.progress)}%\n`;
    if (item.status) reply += `• Status: ${item.status}\n`;
    reply += `• ${riskStr}\n\n`;
  });

  let portfolioLine = `**Portfolio totals** — Revenue: $${fmt(totalRevenue)}`;
  if (projectedProfitActive > 0) portfolioLine += ` | Projected profit (active): $${fmt(projectedProfitActive)}`;
  if (netProfitCompleted > 0) portfolioLine += ` | Net profit already made: $${fmt(netProfitCompleted)}`;
  reply += `${portfolioLine}\n\n`;
  if (needsAttention.length > 0) {
    const receiptProjects = needsAttention
      .filter((item) => item.missingReceipts > 0)
      .filter((item) => (item.status || '').toLowerCase() !== 'completed');
    if (receiptProjects.length > 0) {
      reply += `**Focus on:** ${receiptProjects.map((item) => item.title).join(', ')} — upload missing receipts to reduce risk.\n`;
    }
  }
  return reply;
}

/** Trust copy: snapshot timing when client sends it; otherwise generic. */
function buildDataFreshnessFooter(parsedContext = {}) {
  const raw = parsedContext.snapshotAt || parsedContext.dataAsOf || parsedContext.contextTimestamp;
  if (raw) {
    try {
      const d = new Date(raw);
      if (Number.isFinite(d.getTime())) {
        // ISO instant from client; show UTC so server timezone doesn’t mislead users
        const utc = `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
        return `\n\n_Numbers reflect your project data as of **${utc}**. Pull to refresh if you’ve updated costs._`;
      }
    } catch (_) { /* ignore */ }
  }
  return '\n\n_Numbers reflect the latest data included in this assistant view. Pull to refresh on Projects if you’ve updated costs._';
}

function appendDataFreshness(text = '', parsedContext = {}) {
  const t = String(text || '').trimEnd();
  if (!t) return buildDataFreshnessFooter(parsedContext).trim();
  return `${t}${buildDataFreshnessFooter(parsedContext)}`;
}

/** User wants to add something to the project calendar (mobile persists to AsyncStorage). */
function isCalendarEventCreateQuery(message = '') {
  const s = normalizeAiMessageForIntent(message);
  // Note: must match "create **an** event" — older pattern used only `a ` and missed "an"
  const patterns = [
    /\badd\s+(?:an?\s+)?(?:calendar\s+)?event\b/,
    /\bcreate\s+(?:an?\s+)?(?:calendar\s+)?event\b/,
    /\bschedule\s+(?:an?\s+)?(?:calendar\s+)?event\b/,
    /\bschedule\s+(?:an?\s+)?(?:inspection|delivery|meeting)\b/,
    /\bput\s+(?:this\s+)?on\s+(?:my\s+)?calendar\b/,
    /\badd\s+to\s+(?:my\s+)?calendar\b/,
    /\bremind\s+me\s+to\b/,
    /\bbook\s+(?:an?\s+)?(?:inspection|delivery)\b/,
  ];
  return patterns.some((re) => re.test(s));
}

/** List upcoming calendar events / inspections / schedule / deadlines (not create). */
function isCalendarEventsListQuery(message = '') {
  const s = normalizeAiMessageForIntent(message);
  if (isCalendarEventCreateQuery(s)) return false;
  return /\b(?:upcoming\s+events?|events?\s+coming\s+up|what'?s\s+on\s+(?:my\s+)?(?:the\s+)?calendar|calendar\s+events?|on\s+my\s+schedule|(?:what|any|show)\s+(?:me\s+)?(?:my\s+)?events?|do\s+i\s+have\s+(?:any\s+)?events?|inspections?\s+coming|any\s+inspections\b|when\s+(?:is|are)\s+(?:my\s+)?inspections?|show\s+(?:me\s+)?(?:my\s+)?(?:upcoming\s+)?(?:schedule|calendar)|anything\s+on\s+(?:my\s+)?calendar|upcoming\s+deadlines?|what\s+(?:are\s+)?(?:my\s+)?deadlines?|deadlines?\s+(?:coming|up|ahead)|payments?\s+or\s+deadlines|what\s+payments?\s+or\s+deadlines|(?:coming\s+up|what)\s+(?:for\s+)?(?:payments?\s+and\s+deadlines|deadlines?\s+and\s+payments))\b/i.test(s);
}

/** Optional filter for event type (inspection, delivery, …). */
function calendarEventTypeFilterFromMessage(message = '') {
  const s = normalizeAiMessageForIntent(message);
  // Broad “deadlines / payments+deadlines” portfolio questions → show all calendar types + timeline payments
  if (/\b(?:payments?\s+or\s+deadlines|what\s+payments?\s+or\s+deadlines|upcoming\s+deadlines?\b|deadlines?\s+(?:coming|up|ahead))\b/i.test(s)) return null;
  if (/\binspections?\b/i.test(s)) return 'inspection';
  if (/\bdeliver(?:y|ies)\b/i.test(s)) return 'delivery';
  if (/\bpayment(?:s)?\b/i.test(s) && /\b(?:calendar|event|schedule)\b/i.test(s)) return 'payment';
  if (/\bdeadline\b/i.test(s)) return 'deadline';
  if (/\bwork\b/i.test(s) && /\b(?:calendar|event|schedule)\b/i.test(s)) return 'work';
  return null;
}

/**
 * Calendar "upcoming events" should only include non-finished jobs (matches Projects "active" intent).
 * Client may send `isCompleted`; otherwise infer from status on the project snapshot.
 */
function isProjectActiveForCalendarEvents(p) {
  if (!p || typeof p !== 'object') return false;
  if (p.isCompleted === true) return false;
  const s = String(
    p.status
    || p.projectData?.status
    || p.projectData?.projectStatus
    || ''
  )
    .toLowerCase()
    .trim();
  if (!s) return true;
  const inactive = new Set([
    'completed',
    'complete',
    'done',
    'finished',
    'closed',
    'lost',
    'cancelled',
    'canceled',
    'archived',
  ]);
  if (inactive.has(s)) return false;
  return true;
}

/**
 * Collect future calendar events from allProjects[].calendarEvents (client snapshot).
 */
function collectUpcomingCalendarEvents({
  allProjects = [],
  now = new Date(),
  daysAhead = 45,
  typeFilter = null,
} = {}) {
  const projects = Array.isArray(allProjects) ? allProjects : [];
  const out = [];
  const cutoff = new Date(now.getTime() + daysAhead * 864e5);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (const p of projects) {
    if (!isProjectActiveForCalendarEvents(p)) continue;
    const pid = p?.id;
    const ptitle = p?.title || p?.name || 'Project';
    const raw = p?.calendarEvents || p?.projectData?.calendarEvents;
    const events = Array.isArray(raw) ? raw : [];
    for (const ev of events) {
      if (!ev || ev.completed) continue;
      const t = String(ev.type || 'other').toLowerCase();
      if (typeFilter && t !== typeFilter) continue;
      if (!ev.date) continue;
      const parts = String(ev.date).trim().split('-').map(Number);
      if (parts.length < 3) continue;
      const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      if (!Number.isFinite(d.getTime())) continue;
      if (d.getTime() < todayStart) continue;
      if (d.getTime() > cutoff.getTime()) continue;
      out.push({
        ...ev,
        projectId: pid,
        projectTitle: ptitle,
        sortDate: d.getTime(),
      });
    }
  }
  out.sort((a, b) => a.sortDate - b.sortDate);
  return out;
}

function buildCalendarEventsReply({ events = [], filterLabel = null } = {}) {
  const list = Array.isArray(events) ? events : [];
  const suffix = filterLabel ? ` (${filterLabel})` : '';
  if (!list.length) {
    return `### 📅 Upcoming events${suffix}\n\nNo matching events in your **Project Calendar** for **active projects** over the next several weeks.\n\n_Add events in **Project → Calendar**, or ask me to **schedule** one (e.g. “Schedule an inspection on 2026-04-01 for [project]”). Completed jobs are excluded._`;
  }
  let r = `### 📅 Your upcoming events${suffix}\n\n`;
  for (const ev of list.slice(0, 30)) {
    const typeLabel = String(ev.type || 'other');
    const dateLine = ev.date ? `${ev.date}${ev.time ? ` · ${ev.time}` : ''}` : '—';
    r += `• **${ev.title || 'Event'}** _(${typeLabel})_ — **${ev.projectTitle || 'Project'}** — ${dateLine}\n`;
    if (ev.notes) r += `  _${String(ev.notes).slice(0, 100)}${String(ev.notes).length > 100 ? '…' : ''}_\n`;
  }
  r += '\n_Types: inspection, delivery, work, payment, deadline, other — manage in **Project → Calendar**._';
  return r;
}

/**
 * Same structure as calendar list, plus upcoming (and overdue) payment milestones from Timeline — “dashboard schedule” view.
 */
function buildCalendarAndPaymentsCombinedReply({
  events = [],
  paymentBuckets = { upcoming: [], overdue: [], unscheduled: [] },
  filterLabel = null,
} = {}) {
  const calPart = buildCalendarEventsReply({ events, filterLabel });
  const upcoming = Array.isArray(paymentBuckets.upcoming) ? paymentBuckets.upcoming : [];
  const overdue = Array.isArray(paymentBuckets.overdue) ? paymentBuckets.overdue : [];
  const unscheduled = Array.isArray(paymentBuckets.unscheduled) ? paymentBuckets.unscheduled : [];
  let payPart = '\n\n### 💰 Upcoming payments (Timeline)\n\n';
  if (upcoming.length) {
    for (const p of upcoming.slice(0, 25)) {
      const dateStr = p.date
        ? (typeof p.date === 'string' ? p.date : new Date(p.date).toLocaleDateString())
        : '—';
      payPart += `• **${p.name}** — **${p.projectTitle}** — $${Math.round(p.amount).toLocaleString()} — ${dateStr}\n`;
    }
  } else {
    payPart += '_No dated upcoming payments in your timeline — set dates in **Project → Timeline**._\n';
  }
  if (overdue.length) {
    payPart += `\n⚠️ **Overdue:** ${overdue.slice(0, 6).map((x) => `**${x.name}** (${x.projectTitle})`).join('; ')}`;
  }
  if (unscheduled.length && upcoming.length < 3) {
    payPart += `\n\n_Unscheduled milestones:_ ${unscheduled.slice(0, 4).map((u) => `**${u.name}** $${Math.round(u.amount).toLocaleString()}`).join('; ')}${unscheduled.length > 4 ? '…' : ''}`;
  }
  payPart += '\n\n_Payment milestones are managed in **Project → Timeline**._';
  return `${calPart}${payPart}`;
}

const MONTH_NAME_TO_NUM = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function getRecentUserMessages(history, max = 8) {
  return (Array.isArray(history) ? history : [])
    .filter((h) => h && h.role === 'user')
    .slice(-max)
    .map((h) => String(h.content || '').trim())
    .filter(Boolean);
}

/** True when the last assistant turn was our calendar create prompt (follow-up: date, title, or project). */
function isCalendarCreateFollowUp(message = '', history = []) {
  const m = String(message || '').trim();
  if (!m || m.length > 500) return false;
  const lastAssistant = [...(Array.isArray(history) ? history : [])]
    .reverse()
    .find((h) => h && (h.role === 'assistant' || h.role === 'model'));
  const last = String(lastAssistant?.content || lastAssistant?.text || '');
  if (!last) return false;
  if (!/project calendar|calendar event/i.test(last)) return false;
  // Match markdown or plain: **date**, **call**, **project**
  return /what\s+.*\bdate\b|which\s+.*\bproject\b|which\s+active|what\s+should\s+we\s+.*\bcall\b|call\s+this\s+event|inspection,\s+delivery,\s+work|type\s*\(/i.test(last);
}

/** User messages in thread already mention a concrete calendar date (follow-up to detail replies). */
function conversationHasCalendarDate(history = []) {
  const users = getRecentUserMessages(history, 14);
  const blob = users.join('\n');
  return !!extractIsoDateFromText(blob);
}

/** "Let's add framing inspection 9 am" — no "create event" phrase but clearly a calendar detail line */
function isCalendarEventDetailReply(message = '') {
  const s = normalizeAiMessageForIntent(message);
  if (s.length > 220) return false;
  if (/\blet\'?s\s+add\b/i.test(s) && /\b(inspection|delivery|framing|rough|trim|walkthrough|9\s*am|\d{1,2}\s*(?:am|pm)|\d{1,2}:\d{2})/i.test(s)) return true;
  if (/\b(add|schedule)\s+(?:a\s+)?(?:framing|electrical|rough|plumbing|hvac)\b/i.test(s)) return true;
  return false;
}

/** Use deterministic calendar parser (create intent, assistant follow-up, or detail reply + date in history). */
function shouldUseCalendarCreateParser(message = '', history = []) {
  const m = String(message || '').trim();
  if (!m) return false;
  if (isCalendarEventCreateQuery(m)) return true;
  if (isCalendarCreateFollowUp(m, history)) return true;
  if (isCalendarEventDetailReply(m) && conversationHasCalendarDate(history)) return true;
  return false;
}

/** Extract first ISO date (YYYY-MM-DD) from natural text: ISO, m/d/y, tomorrow, month names. */
function extractIsoDateFromText(text) {
  const s = String(text || '');
  const iso = s.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const md = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (md) {
    let y = md[3] ? (String(md[3]).length === 2 ? 2000 + parseInt(md[3], 10) : parseInt(md[3], 10)) : new Date().getFullYear();
    const mo = parseInt(md[1], 10);
    const day = parseInt(md[2], 10);
    const d = new Date(y, mo - 1, day);
    if (Number.isFinite(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  if (/\btomorrow\b/i.test(s)) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }
  const rx1 = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/i;
  const m1 = s.match(rx1);
  if (m1) {
    const month = MONTH_NAME_TO_NUM[m1[1].toLowerCase()];
    const day = parseInt(m1[2], 10);
    const explicitYear = m1[3] ? parseInt(m1[3], 10) : null;
    const out = isoFromMonthDayYear(month, day, explicitYear);
    if (out) return out;
  }
  const rx2 = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)(?:,?\s*(20\d{2}))?\b/i;
  const m2 = s.match(rx2);
  if (m2) {
    const month = MONTH_NAME_TO_NUM[m2[2].toLowerCase()];
    const day = parseInt(m2[1], 10);
    const explicitYear = m2[3] ? parseInt(m2[3], 10) : null;
    const out = isoFromMonthDayYear(month, day, explicitYear);
    if (out) return out;
  }
  return null;
}

function isoFromMonthDayYear(month, day, explicitYear) {
  if (!month || !day || day < 1 || day > 31) return null;
  let y = explicitYear || new Date().getFullYear();
  let d = new Date(y, month - 1, day);
  if (!Number.isFinite(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (!explicitYear && d < today) {
    y += 1;
    d = new Date(y, month - 1, day);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inferEventTypeFromMessage(text) {
  const s = String(text || '');
  if (/\binspection\b/i.test(s)) return 'inspection';
  if (/\bdeliver(?:y|ies)\b/i.test(s)) return 'delivery';
  if (/\bpayment\b/i.test(s)) return 'payment';
  if (/\bdeadline\b/i.test(s)) return 'deadline';
  if (/\bother\b/i.test(s)) return 'other';
  return 'work';
}

/** User message is only "create/add an event" intent — not a real event title (never use as title). */
function isCalendarMetaIntentOnlyMessage(text) {
  let t = String(text || '')
    .trim()
    .replace(/[\u2018\u2019]/g, "'");
  t = normalizeAiMessageForIntent(t);
  if (!t) return true;
  // Substantive event wording — not meta-only
  if (/\b(inspection|delivery|framing|rough|trim|walkthrough|hvac|plumbing|electrical|concrete|pour|drywall|cabinet|roof|floor|meeting|permit)\b/i.test(t)) return false;
  if (/\b(tomorrow|today)\b/.test(t)) return false;
  if (/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/.test(t)) return false;
  if (/\b20\d{2}-\d{2}-\d{2}\b/.test(t)) return false;
  if (/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(t) && /\d/.test(t)) return false;
  return /^(?:please\s+)?(?:let\'s\s+)?(?:can\s+(?:you|we)\s+)?(?:add|create|schedule)\s+(?:an?\s+)?(?:calendar\s+)?(?:event\b)?\s*\.?\s*$/i.test(t)
    || /^(?:can\s+we\s+)?(?:create|add|schedule)\s+(?:an?\s+)?(?:calendar\s+)?event\s*\.?\s*$/i.test(t)
    || /^(?:add|create|schedule)\s+(?:a\s+)?(?:calendar\s+)?event\s*\.?\s*$/i.test(t);
}

function isPlaceholderCalendarTitle(title, type) {
  const t = String(title || '').trim().replace(/[\u2018\u2019]/g, "'");
  if (t.length < 2) return true;
  if (isCalendarMetaIntentOnlyMessage(t)) return true;
  if (/^(for|on|the|a|an|at|to|and|or)$/i.test(t)) return true;
  if (/^calendar$/i.test(t)) return true;
  const cap = type.charAt(0).toUpperCase() + type.slice(1);
  if (new RegExp(`^${cap}\\s*—\\s*calendar$`, 'i').test(t)) return true;
  return false;
}

function stripCalendarTitleNoise(raw) {
  let t = String(raw || '').trim().replace(/[\u2018\u2019]/g, "'");
  t = t
    .replace(/^(?:please\s+)?(?:let\'s\s+)?(?:can\s+(?:you|we)\s+)?(?:add|create|schedule)\s+(?:an?\s+)?(?:calendar\s+)?(?:event\s*:?\s*)?/i, '')
    .replace(/^(?:let\'s\s+)?(?:we\s+)?(?:create|add|schedule)\s+(?:an?\s+)?(?:calendar\s+)?(?:event\s*)?(?:for\s+)?/i, '')
    .replace(/\b(?:on|for)\s+(?:the\s+)?\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}(?:[\/\-]\d{2,4})?\b/g, '')
    .replace(/\b(?:on|for)\s+(?:the\s+)?\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\b(?:for|on)\s+(?:the\s+)?tomorrow\b/gi, '')
    .replace(/\btomorrow\b/gi, '')
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, '')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, '')
    .replace(/\b(?:for|on)\s+the\s+/gi, '')
    .replace(/^(?:for|on)\s*$/i, '')
    .trim();
  t = t.replace(/\b(?:for|on)\s+[A-Za-z][A-Za-z0-9\s\-']+$/i, '').trim();
  return t;
}

function extractEventTitleFromMessage(raw, type) {
  const m = String(raw || '').trim().replace(/[\u2018\u2019]/g, "'");
  if (isCalendarMetaIntentOnlyMessage(m)) {
    return `${type.charAt(0).toUpperCase() + type.slice(1)} — calendar`;
  }
  const q = m.match(/["']([^"']{2,100})["']/);
  if (q) return q[1].trim().slice(0, 120);
  let title = stripCalendarTitleNoise(m);
  if (!title || title.length < 2 || isCalendarMetaIntentOnlyMessage(title)) {
    title = `${type.charAt(0).toUpperCase() + type.slice(1)} — calendar`;
  }
  return title.slice(0, 120);
}

/** "March 25", "for March 3" — not a project name */
function looksLikeDatePhrase(s) {
  const x = String(s || '').trim().toLowerCase();
  if (!x) return false;
  if (/\d/.test(x)) return true;
  const w = x.split(/\s+/)[0];
  return !!MONTH_NAME_TO_NUM[w];
}

/**
 * Parse "create calendar event" style messages. Returns { ok, projectId, event, needsMore }.
 * needsMore: 'date' | 'details' (name/type) | 'project' | null
 * Pass `history` so follow-up lines ("March 25", "Rough-in") merge with earlier turns.
 */
function parseCalendarEventCreate(message, { allProjects = [], parsedContext = {}, history = [] } = {}) {
  const m = String(message || '').trim();
  const histUsers = getRecentUserMessages(history, 8);
  const combined = [...histUsers, m].join('\n');

  let type = inferEventTypeFromMessage(m);
  if (type === 'work') {
    const t2 = inferEventTypeFromMessage(combined);
    if (t2 !== 'work') type = t2;
  }

  let dateStr = extractIsoDateFromText(m) || extractIsoDateFromText(combined);

  let time = '';
  const tm = m.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i) || combined.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (tm) {
    let h = parseInt(tm[1], 10);
    const min = tm[2];
    const ap = (tm[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    time = `${String(h).padStart(2, '0')}:${min}`;
  }
  if (!time) {
    const t2 = m.match(/\b(\d{1,2})\s*(am|pm)\b/i) || combined.match(/\b(\d{1,2})\s*(am|pm)\b/i);
    if (t2) {
      let h = parseInt(t2[1], 10);
      const ap = (t2[2] || '').toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      time = `${String(h).padStart(2, '0')}:00`;
    }
  }

  let titleSource = m;
  if (Array.isArray(allProjects) && allProjects.length > 1) {
    const rOnly = resolveProjectByQuery(allProjects, m, { minScore: 42 });
    if (rOnly.project && m.length < 55) {
      titleSource = '';
    }
  }
  let title = extractEventTitleFromMessage(titleSource, type);
  if (isPlaceholderCalendarTitle(title, type)) {
    for (let i = histUsers.length - 1; i >= 0; i--) {
      const hu = histUsers[i];
      if (isCalendarMetaIntentOnlyMessage(hu)) continue;
      if (Array.isArray(allProjects) && allProjects.length > 1) {
        const rHu = resolveProjectByQuery(allProjects, hu, { minScore: 42 });
        if (rHu.project && hu.length < 55) continue;
      }
      const cand = extractEventTitleFromMessage(hu, inferEventTypeFromMessage(hu));
      if (!isPlaceholderCalendarTitle(cand, inferEventTypeFromMessage(hu))) {
        title = cand;
        break;
      }
    }
  }
  if (isPlaceholderCalendarTitle(title, type) && type !== 'work') {
    title = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
  }

  let projectId = parsedContext.projectId || parsedContext.activeProjectId || parsedContext.resolvedProjectId || parsedContext.lastOpenedProjectId || null;
  let projectName = parsedContext.currentProject || parsedContext.projectName || null;
  if (projectId && !projectName && Array.isArray(allProjects)) {
    const lp = allProjects.find((p) => String(p?.id) === String(projectId));
    if (lp) projectName = lp.title || lp.name;
  }

  const forMatch = m.match(/\b(?:for|on)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9\s\-']+?)(?:\s+project)?\s*[.?!]?\s*$/i)
    || m.match(/\b(?:for|on)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9\s\-']{2,40})\s+(?:on|for)\s+\d{4}-\d{2}-\d{2}/i);
  if (forMatch && Array.isArray(allProjects) && allProjects.length) {
    const pq = forMatch[1].trim();
    if (!looksLikeDatePhrase(pq)) {
      const r = resolveProjectByQuery(allProjects, pq, { minScore: 30 });
      if (r.project) {
        projectId = r.project.id;
        projectName = r.project.title || r.project.name;
      }
    }
  }

  if (!projectId && Array.isArray(allProjects) && allProjects.length === 1) {
    projectId = allProjects[0].id;
    projectName = allProjects[0].title || allProjects[0].name;
  }

  const haveDate = !!dateStr;
  const haveDetails = haveDate && !isPlaceholderCalendarTitle(title, type);

  if (!projectId && haveDetails && Array.isArray(allProjects) && allProjects.length > 1) {
    const r = resolveProjectByQuery(allProjects, m, { minScore: 35 });
    if (r.project && m.length < 80) {
      projectId = r.project.id;
      projectName = r.project.title || r.project.name;
    }
  }

  let needsMore = null;
  if (!haveDate) needsMore = 'date';
  else if (!haveDetails) needsMore = 'details';
  else if (!projectId) needsMore = 'project';

  let titleOut = String(title).trim();
  if (time) {
    titleOut = titleOut
      .replace(/\s*[,.]?\s*\d{1,2}:\d{2}\s*(am|pm)?\s*$/i, '')
      .replace(/\s*[,.]?\s*\d{1,2}\s*(am|pm)\s*$/i, '')
      .trim();
    if (titleOut.length < 2) titleOut = String(title).trim();
  }

  const event = {
    title: titleOut.slice(0, 120),
    date: dateStr,
    time,
    type,
    notes: 'Created from AI Assistant',
  };

  return {
    ok: !needsMore,
    needsMore,
    projectId,
    projectName: projectName || 'Project',
    event,
  };
}

/** Top follow-ups from compare rows (risk flags + margin + receipts). */
function buildPortfolioNextActions(rows = [], max = 3) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return '';
  const scored = list
    .map((r) => {
      const flags = Array.isArray(r.riskFlags) ? r.riskFlags : [];
      const ob = Number(r.overBudgetPct || 0);
      const score =
        flags.length * 2 +
        (Number(r.margin) < 10 ? 2 : 0) +
        (ob > 10 ? 2 : 0) +
        (r.missingReceipts > 0 ? 1 : 0) +
        (r.overdueItems > 0 ? 1 : 0);
      return { r, score };
    })
    .sort((a, b) => b.score - a.score);

  const lines = [];
  for (const { r } of scored) {
    if (lines.length >= max) break;
    const parts = [];
    if (r.riskFlags?.includes('over_budget') || Number(r.overBudgetPct) > 10) {
      parts.push(`tighten spend (≈${Number(r.overBudgetPct || 0).toFixed(0)}% over budget)`);
    }
    if (r.riskFlags?.includes('low_margin') || Number(r.margin) < 10) parts.push('protect margin');
    if (r.riskFlags?.includes('overdue_milestones') || r.overdueItems > 0) parts.push('follow up overdue payments');
    if (r.riskFlags?.includes('margin_erosion')) parts.push('stop margin erosion');
    if (r.missingReceipts > 0) parts.push(`upload ${r.missingReceipts} missing receipt(s)`);
    if (r.riskFlags?.includes('spend_ahead_of_progress')) parts.push('check spend vs progress');
    if (parts.length) lines.push(`• **${r.title}:** ${parts.slice(0, 3).join(' · ')}`);
  }
  if (!lines.length) return '';
  return `**Suggested next moves**\n${lines.join('\n')}\n`;
}

/**
 * Shared compare_projects analysis (same as aiAssistant route tool). Used by stream + tool executor.
 */
function runCompareProjectsPipeline({ allProjects = [], parsedContext = {}, args = {} } = {}) {
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
    const activeOnly = args?.activeOnly === true;
    const nameFilters = Array.isArray(args?.projectNames)
      ? args.projectNames.map((n) => String(n).toLowerCase().trim()).filter(Boolean)
      : [];

    let candidates = Array.isArray(allProjects) ? [...allProjects] : [];
    if (statusFilter) {
      candidates = candidates.filter((p) => String(p?.status || '').toLowerCase().includes(statusFilter));
    }
    if (activeOnly) {
      candidates = candidates.filter((p) => {
        const statusLower = String(p?.status || '').toLowerCase();
        if (statusLower !== 'completed') return true;

        const milestonesRaw = getProjectMilestones(p);
        const milestones = Array.isArray(milestonesRaw) ? milestonesRaw : [];
        const hasUnpaid = milestones.some((m) => !isPaymentCollectedForAI(m, { projectIsCompleted: false }));
        return hasUnpaid;
      });
    }
    if (nameFilters.length > 0) {
      candidates = candidates.filter((p) => {
        const title = String(p?.title || p?.name || '').toLowerCase();
        const customer = String(p?.customerName || p?.client || '').toLowerCase();
        return nameFilters.some((q) => title.includes(q) || customer.includes(q));
      });
    }

    const progressByProjectId = parsedContext?.progressByProjectId || {};
    const compareProjectsData = Array.isArray(parsedContext?.compareProjectsData) ? parsedContext.compareProjectsData : [];

    const analyzed = candidates.map((p) => {
      const title = p?.title || p?.name || 'Untitled Project';
      const pid = String(p?.id ?? '');
      const titleKey = (title || '').toLowerCase().trim();
      const titleSlug = titleKey.replace(/\s+/g, '-');
      const progressOverride = progressByProjectId[pid] ?? progressByProjectId[titleKey] ?? progressByProjectId[titleSlug]
        ?? compareProjectsData.find((c) => (c?.title || '').toLowerCase().trim() === titleKey)?.progress;
      const compareItem = compareProjectsData.find((c) => (c?.title || '').toLowerCase().trim() === titleKey);
      return analyzePortfolioProject(p, {
        parsedContext,
        progressOverride,
        compareItem,
        now: new Date(),
      });
    });

    let analyzedFinal = analyzed;
    if (analyzed.length === 0 && activeOnly && compareProjectsData.length > 0) {
      const activeFromCompare = compareProjectsData.filter((c) => {
        const statusLower = (c?.status || '').toLowerCase();
        if (statusLower !== 'completed') return true;
        const matchingProject = (Array.isArray(allProjects) ? allProjects : []).find((p) => {
          const pt = String(p?.title || p?.name || '').toLowerCase().trim();
          const ct = String(c?.title || '').toLowerCase().trim();
          return pt && ct && (pt === ct || pt.includes(ct) || ct.includes(pt));
        });
        const mRaw = getProjectMilestones(matchingProject);
        const mList = Array.isArray(mRaw) ? mRaw : [];
        return mList.some((m) => !isPaymentCollectedForAI(m, { projectIsCompleted: false }));
      });
      if (activeFromCompare.length > 0) {
        const now = new Date();
        const getDate = (m) => m?.plannedDate || m?.scheduledDate || m?.dueDate || m?.date;
        analyzedFinal = activeFromCompare.map((c) => {
          const matchingProject = (Array.isArray(allProjects) ? allProjects : []).find((p) => {
            const pt = String(p?.title || p?.name || '').toLowerCase().trim();
            const ct = String(c?.title || '').toLowerCase().trim();
            return pt && ct && (pt === ct || pt.includes(ct) || ct.includes(pt));
          });
          const mpStatus = String(matchingProject?.status || c?.status || '').toLowerCase();
          const mpProgress = Number(matchingProject?.progress ?? c?.progress ?? 0);
          const mpIsCompleted = mpStatus === 'completed' || mpStatus === 'done' || mpStatus === 'finished' || mpProgress >= 100;
          const isCollected = (m) => {
            if (mpIsCompleted) return true;
            const st = String(m?.status || m?.state || '').toLowerCase();
            if (st.includes('complete') || st.includes('paid') || st.includes('collected') || st === 'done' || st === 'finished') return true;
            if (m?.collected === true || m?.isPaid === true) return true;
            const pct = Number(m?.progressPct ?? m?.progress ?? 0);
            return Number.isFinite(pct) && pct >= 100;
          };
          const mRaw = matchingProject
            ? (matchingProject.milestones || matchingProject.weeklyPayments || matchingProject.projectData?.milestones || matchingProject.projectData?.weeklyPayments || matchingProject.estimateData?.milestones || matchingProject.estimateData?.paymentMilestones || matchingProject.estimateData?.weeklyPayments || matchingProject.projectData?.estimateData?.milestones || matchingProject.projectData?.estimateData?.paymentMilestones || matchingProject.projectData?.estimateData?.weeklyPayments || [])
            : [];
          const milestones = Array.isArray(mRaw) ? mRaw : [];
          const overdueItems = milestones.filter((m) => {
            if (isCollected(m)) return false;
            const dt = new Date(getDate(m) || 0);
            return Number.isFinite(dt.getTime()) && dt.getTime() < now.getTime();
          });
          const unpaidM = milestones.filter((m) => !isCollected(m));
          const upcomingPayments = unpaidM.filter((m) => {
            const dt = new Date(getDate(m) || 0);
            if (!Number.isFinite(dt.getTime())) return false;
            const days = Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return days >= 0;
          }).sort((a, b) => new Date(getDate(a) || 0).getTime() - new Date(getDate(b) || 0).getTime()).map((m) => ({
            name: m?.title || m?.name || 'Payment',
            amount: normalize(m?.amount ?? m?.paymentAmount ?? 0),
            date: getDate(m),
          }));
          const unscheduledPayments = unpaidM.filter((m) => {
            const dt = new Date(getDate(m) || 0);
            return !Number.isFinite(dt.getTime()) || isNaN(dt.getTime());
          }).map((m) => ({ name: m?.title || m?.name || 'Payment', amount: normalize(m?.amount ?? m?.paymentAmount ?? 0), date: null }));
          const rev = Number(c?.revenue ?? 0);
          const projProfit = Number(c?.projectedProfit ?? 0);
          const marginVal = rev > 0 && projProfit != null ? (projProfit / rev * 100) : (c?.margin ?? 0);
          const marginRounded = Math.round(marginVal * 10) / 10;
          const statusLower = (c?.status || '').toString().toLowerCase();
          const isCompletedProject = statusLower === 'completed';
          return {
            projectId: matchingProject?.id ?? c?.id,
            title: c?.title || 'Untitled',
            status: c?.status || 'unknown',
            margin: marginRounded,
            currentMargin: marginRounded,
            marginLabel: isCompletedProject ? 'Margin' : 'Current margin',
            profitLabel: isCompletedProject ? 'Net Profit' : 'Projected Profit',
            spent: c?.spent ?? 0,
            budget: 0,
            revenue: c?.revenue ?? 0,
            overBudgetPct: 0,
            progress: c?.progress ?? 0,
            overdueItems: overdueItems.length,
            overduePayments: overdueItems.map((m) => ({ name: m?.title || m?.name || 'Payment', amount: normalize(m?.amount ?? m?.paymentAmount ?? 0), date: getDate(m) })),
            upcomingPayments,
            unscheduledPayments,
            projectedFinalCost: 0,
            estimatedProfit: 0,
            projectedProfit: c?.projectedProfit ?? 0,
            projectedMarginPct: marginRounded,
            missingReceipts: c?.missingReceipts ?? 0,
            riskFlags: c?.riskFlags ?? [],
          };
        });
      }
    }

    const sortBy = String(args?.sortBy || '').toLowerCase();
    const sorted = sortCompareProjectsResults(analyzedFinal, sortBy);

    const totalRevenue = analyzedFinal.reduce((s, x) => s + x.revenue, 0);
    const totalSpent = analyzedFinal.reduce((s, x) => s + x.spent, 0);
    const totalBudget = analyzedFinal.reduce((s, x) => s + x.budget, 0);
    const totalProjectedProfit = analyzedFinal.reduce((s, x) => s + x.projectedProfit, 0);
    const avgMargin = analyzedFinal.length > 0 ? analyzedFinal.reduce((s, x) => s + x.margin, 0) / analyzedFinal.length : 0;
    const dailyBrief = buildDailyCommandCenter(sorted);

    return {
      success: true,
      comparedCount: sorted.length,
      projects: sorted,
      sorted,
      analyzedFinal,
      summary: sorted.slice(0, 5),
      portfolioTotals: {
        totalRevenue,
        totalSpent,
        totalBudget,
        totalProjectedProfit: Math.round(totalProjectedProfit),
        averageMargin: Math.round(avgMargin * 10) / 10,
      },
      dailyBrief,
      message: sorted.length
        ? `Compared ${sorted.length} project(s): ${sorted.map((x) => x.title).join(', ')}. Portfolio totals: $${totalRevenue.toLocaleString()} revenue, $${totalSpent.toLocaleString()} spent, projected profit $${Math.round(totalProjectedProfit).toLocaleString()} (avg margin ${Math.round(avgMargin)}%). IMPORTANT — PAYMENT QUESTIONS (e.g. "when am I getting paid next", "payments", "next payment"): Always answer from the TIMELINE data (upcomingPayments and overduePayments per project). Format: "Your next payment is the [payment name] for the [project title] project, amounting to $[amount], due on [date]." If multiple upcoming payments across projects, list the soonest first, then others. Use the exact project title and payment name/amount/date from upcomingPayments. You may end with: "Want me to check on any other upcoming payments or project details?" If upcomingPayments is empty but unscheduledPayments has items, list those (name, amount) and say they can set dates in the Timeline. If both empty, say payments are set in the Timeline tab (Projects → [Project] → Timeline) and suggest opening that project's Timeline to sync. Never say "no upcoming payments" without that guidance. Each project also has marginLabel, profitLabel; for completed use "Margin"/"Net Profit", for active use "Current margin"/"Projected Profit".`
        : 'No projects matched the requested filters.',
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  normalizeAiMessageForIntent,
  isPortfolioLosingMoneyQuery,
  isPortfolioOverBudgetListQuery,
  isSimpleProjectBudgetStatusQuery,
  isPortfolioCompareActiveQuery,
  isPortfolioWorstProjectQuery,
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
  sortCompareProjectsResults,
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
  buildProjectProfitLeaks,
  buildDailyCommandCenter,
  buildProfitLeakPromptBlock,
  analyzePortfolioProject,
  buildPortfolioComparisonReply,
  buildDataFreshnessFooter,
  appendDataFreshness,
  buildPortfolioNextActions,
  runCompareProjectsPipeline,
};
