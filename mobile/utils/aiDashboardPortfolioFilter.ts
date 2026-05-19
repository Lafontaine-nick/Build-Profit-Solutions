import type { AiDashboardResponse, AiInsight, AiNextStep } from '@/types/aiDashboard';

/** Normalize status for comparisons (matches dashboard.tsx). */
export function normalizePortfolioStatus(status: unknown): string {
  return (status ?? '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

const AI_DASHBOARD_PROJECT_STATUSES = new Set([
  'draft',
  'estimate',
  'bid_submitted',
  'submitted',
  'won',
  'in_progress',
  'active',
]);

export function isProjectEligibleForAiDashboardInsights(
  p: { id?: unknown; status?: unknown } | null | undefined
): boolean {
  if (!p || p.id == null || String(p.id).trim() === '') return false;
  return AI_DASHBOARD_PROJECT_STATUSES.has(normalizePortfolioStatus(p.status));
}

const STATUS_RANK_FOR_AI_DEDUPE: Record<string, number> = {
  draft: 1,
  estimate: 2,
  bid_submitted: 3,
  submitted: 3,
  won: 4,
  in_progress: 5,
  active: 5,
  completed: 6,
  complete: 6,
  closed: 6,
  done: 6,
  finished: 6,
  lost: 6,
  cancelled: 6,
  canceled: 6,
};

export function dedupeProjectsByBestStatus(projects: any[]): any[] {
  const m = new Map<string, any>();
  for (const p of projects) {
    if (p?.id == null || String(p.id).trim() === '') continue;
    const id = String(p.id);
    const prev = m.get(id);
    if (!prev) {
      m.set(id, p);
      continue;
    }
    const ra = STATUS_RANK_FOR_AI_DEDUPE[normalizePortfolioStatus(p.status)] ?? 0;
    const rb = STATUS_RANK_FOR_AI_DEDUPE[normalizePortfolioStatus(prev.status)] ?? 0;
    if (ra > rb) m.set(id, p);
  }
  return [...m.values()];
}

export function deriveUnifiedProgressPct(
  p: any,
  pid: string,
  timelineProgress: Record<string, number>
): number {
  const prog = Math.max(
    Number(p?.overallProgressPct ?? 0),
    Number(p?.progress ?? 0),
    Number(p?.projectData?.overallProgressPct ?? 0)
  );
  if (Number.isFinite(prog) && prog > 0) return prog;
  const fromMap = timelineProgress[pid] ?? timelineProgress[String(p?.title || '').toLowerCase()];
  return Number.isFinite(fromMap) ? Number(fromMap) : prog;
}

export function isProjectClosedForDashboardAi(
  p: any,
  timelineProgress?: Record<string, number>
): boolean {
  const s = normalizePortfolioStatus(p?.status);
  if (
    s === 'completed' ||
    s === 'complete' ||
    s === 'closed' ||
    s === 'done' ||
    s === 'finished' ||
    s === 'lost' ||
    s === 'cancelled' ||
    s === 'canceled'
  ) {
    return true;
  }
  const pid = String(p?.id ?? '');
  const prog = Math.max(
    Number(p?.overallProgressPct ?? 0),
    Number(p?.progress ?? 0),
    Number(p?.projectData?.overallProgressPct ?? 0),
    pid ? deriveUnifiedProgressPct(p, pid, timelineProgress ?? {}) : 0
  );
  if (Number.isFinite(prog) && prog >= 99) return true;

  if (timelineProgress && pid) {
    const unified = deriveUnifiedProgressPct(p, pid, timelineProgress);
    const statusSlug = normalizePortfolioStatus(p?.status);
    const activeLike =
      statusSlug === 'won' || statusSlug === 'in_progress' || statusSlug === 'active';
    if (activeLike && Number.isFinite(unified) && unified >= 99.5) return true;
  }
  return false;
}

export function buildDashboardClosedProjectIdSet(
  activeProjects: any[],
  estimates: any[],
  timelineProgress: Record<string, number>
): Set<string> {
  const ids = new Set<string>();
  for (const p of [...activeProjects, ...estimates]) {
    if (
      isProjectClosedForDashboardAi(p, timelineProgress) &&
      p?.id != null &&
      String(p.id).trim() !== ''
    ) {
      ids.add(String(p.id));
    }
  }
  const merged = dedupeProjectsByBestStatus([...activeProjects, ...estimates]);
  for (const p of merged) {
    const pid = String(p.id ?? '');
    if (!pid) continue;
    const pct = deriveUnifiedProgressPct(p, pid, timelineProgress);
    if (Number.isFinite(pct) && pct >= 99) ids.add(pid);
  }
  return ids;
}

function projectTitles(projects: any[]): string[] {
  const titles: string[] = [];
  for (const p of projects) {
    const t = String(p?.title || p?.name || '')
      .toLowerCase()
      .trim();
    if (t.length >= 3) titles.push(t);
  }
  return [...new Set(titles)];
}

export function normalizeInsightProjectId(item: {
  projectId?: unknown;
  project_id?: unknown;
}): string {
  const raw = item.projectId ?? item.project_id;
  if (raw == null) return '';
  return String(raw).trim();
}

function extractScopedJobPhraseFromInsightText(title: string, extra?: string): string | null {
  const sources = [String(title || '').trim(), String(extra || '').trim()].filter(Boolean);
  for (const src of sources) {
    const m = /\b(?:on|for)\s+([^\n.!?]+)/i.exec(src);
    if (!m) continue;
    const phrase = m[1]
      .replace(/\s+/g, ' ')
      .replace(/["""'`]+$/, '')
      .trim()
      .replace(/[.!?:;,]+$/, '')
      .trim();
    if (phrase.length < 3) continue;
    const words = phrase.split(/\s+/).filter(Boolean);
    if (words.length === 1 && phrase.length < 7) continue;
    return phrase;
  }
  return null;
}

export function aiTextReferencesJobTitle(text: string, titles: string[]): boolean {
  const hay = text.toLowerCase();
  const hayCompact = hay.replace(/\s+/g, '');
  return titles.some((rawTitle) => {
    const t = rawTitle.trim();
    if (t.length < 3) return false;
    if (hay.includes(t)) return true;
    const noProject = t.replace(/\s+project\s*$/i, '').trim();
    if (noProject.length >= 3 && hay.includes(noProject)) return true;
    const words = t
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/gi, ''))
      .filter((w) => w.length > 2);
    if (words.length >= 2) {
      const pair = `${words[0]} ${words[1]}`;
      if (hay.includes(pair)) return true;
      const pairCompact = pair.replace(/\s+/g, '');
      if (pairCompact.length >= 6 && hayCompact.includes(pairCompact)) return true;
    }
    const titleCompact = t.replace(/\s+/g, '');
    if (titleCompact.length >= 6 && hayCompact.includes(titleCompact)) return true;
    return false;
  });
}

function insightReferencesRemovedOpenJob(
  title: string,
  extra: string | undefined,
  openPipelineTitles: string[],
  knownTitles: string[]
): boolean {
  const phrase = extractScopedJobPhraseFromInsightText(title, extra);
  if (!phrase) return false;
  const lower = phrase.toLowerCase();
  // Still an open pipeline job — keep operational insights
  if (aiTextReferencesJobTitle(lower, openPipelineTitles)) return false;
  // Names a deleted job (not in lists) or a closed-only job — drop operational copy
  if (!aiTextReferencesJobTitle(lower, knownTitles)) return true;
  return true;
}

function isRetrospectiveInsight(insight: AiInsight): boolean {
  return (
    insight.retrospective === true ||
    String(insight.id || '').startsWith('completed-retrospective-')
  );
}

export type AiPortfolioFilterContext = {
  knownProjectIds: Set<string>;
  openPipelineIds: Set<string>;
  closedIds: Set<string>;
  openPipelineTitles: string[];
  closedTitles: string[];
  knownTitles: string[];
};

export function buildAiPortfolioFilterContext(
  activeProjects: any[],
  estimates: any[],
  timelineProgress: Record<string, number>
): AiPortfolioFilterContext {
  const merged = dedupeProjectsByBestStatus([...activeProjects, ...estimates]);
  const closedIds = buildDashboardClosedProjectIdSet(activeProjects, estimates, timelineProgress);
  const knownProjectIds = new Set(
    merged.map((p) => String(p.id ?? '')).filter((id) => id.length > 0)
  );
  const openPipeline = merged.filter(
    (p) =>
      isProjectEligibleForAiDashboardInsights(p) &&
      !closedIds.has(String(p.id ?? '')) &&
      !isProjectClosedForDashboardAi(p, timelineProgress)
  );
  const openPipelineIds = new Set(openPipeline.map((p) => String(p.id ?? '')));
  const closedProjects = merged.filter((p) => closedIds.has(String(p.id ?? '')));
  return {
    knownProjectIds,
    openPipelineIds,
    closedIds,
    openPipelineTitles: projectTitles(openPipeline),
    closedTitles: projectTitles(closedProjects),
    knownTitles: projectTitles(merged),
  };
}

export function filterAiInsightForPortfolio(
  insight: AiInsight,
  ctx: AiPortfolioFilterContext
): boolean {
  const pid = normalizeInsightProjectId(insight);
  const blob = `${insight.title || ''} ${insight.body || ''}`;
  const retrospective = isRetrospectiveInsight(insight);

  if (pid) {
    if (!ctx.knownProjectIds.has(pid)) return false;
    if (ctx.closedIds.has(pid)) return retrospective;
    if (!retrospective && !ctx.openPipelineIds.has(pid)) return false;
  } else {
    if (aiTextReferencesJobTitle(blob, ctx.closedTitles) && !retrospective) {
      return false;
    }
    if (insightReferencesRemovedOpenJob(insight.title, insight.body, ctx.openPipelineTitles, ctx.knownTitles)) {
      return false;
    }
  }
  return true;
}

export function filterAiNextStepForPortfolio(
  step: AiNextStep,
  ctx: AiPortfolioFilterContext
): boolean {
  const stepText = String(step.label || '').toLowerCase();
  if (stepText.includes('josh')) return false;

  const pid = normalizeInsightProjectId(step);
  const stepBlob = `${step.label || ''} ${step.chip || ''}`;
  if (pid) {
    if (!ctx.knownProjectIds.has(pid)) return false;
    if (ctx.closedIds.has(pid)) return false;
    if (!ctx.openPipelineIds.has(pid)) return false;
  } else if (aiTextReferencesJobTitle(stepBlob, ctx.closedTitles)) {
    return false;
  } else if (
    insightReferencesRemovedOpenJob(String(step.label || ''), String(step.chip || ''), ctx.openPipelineTitles, ctx.knownTitles)
  ) {
    return false;
  }
  return true;
}

export function filterAiDashboardResponse(
  data: AiDashboardResponse | null,
  activeProjects: any[],
  estimates: any[],
  timelineProgress: Record<string, number>
): AiDashboardResponse | null {
  if (!data) return null;
  const ctx = buildAiPortfolioFilterContext(activeProjects, estimates, timelineProgress);
  return {
    ...data,
    insights: (data.insights ?? []).filter((insight) => filterAiInsightForPortfolio(insight, ctx)),
    nextSteps: (data.nextSteps ?? []).filter((step) => filterAiNextStepForPortfolio(step, ctx)),
  };
}

/** Hash of all project ids + pipeline snapshot — any delete/add/complete changes this. */
export function computePortfolioListFingerprint(
  activeProjects: any[],
  estimates: any[],
  timelineProgress: Record<string, number>
): string {
  const merged = dedupeProjectsByBestStatus([...activeProjects, ...estimates]);
  const ids = merged
    .map((p) => {
      const id = String(p.id ?? '');
      const status = normalizePortfolioStatus(p.status);
      const pct = Math.round(deriveUnifiedProgressPct(p, id, timelineProgress) * 10) / 10;
      return `${id}:${status}:${pct}`;
    })
    .sort();
  return ids.join('|');
}
