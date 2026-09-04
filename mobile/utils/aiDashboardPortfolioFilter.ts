import AsyncStorage from '@react-native-async-storage/async-storage';
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

const PORTFOLIO_VISIBLE_STATUSES = new Set([
  'bid_submitted',
  'submitted',
  'won',
  'in_progress',
  'active',
  'completed',
  'complete',
  'closed',
  'done',
  'finished',
]);

/**
 * Saved project snapshots can retain a stale top-level "estimate" status after
 * the same project has been converted to won/in-progress in projectData.
 * Prefer the nested lifecycle status when it is the more advanced, dashboard-
 * visible value so AI receives the same active project the app displays.
 */
export function resolvePortfolioProjectStatus(project: any): string {
  const topLevel = normalizePortfolioStatus(project?.status);
  const nested = normalizePortfolioStatus(project?.projectData?.status);
  if (
    (topLevel === 'draft' || topLevel === 'estimate') &&
    PORTFOLIO_VISIBLE_STATUSES.has(nested)
  ) {
    return nested;
  }
  return topLevel || nested;
}

export function isProjectEligibleForAiDashboardInsights(
  p: { id?: unknown; status?: unknown } | null | undefined
): boolean {
  if (!p || p.id == null || String(p.id).trim() === '') return false;
  return AI_DASHBOARD_PROJECT_STATUSES.has(normalizePortfolioStatus(p.status));
}

/** Same visibility rules as Dashboard → All Projects (hides draft/estimate-only rows). */
export function isDashboardListedProject(p: { status?: unknown } | null | undefined): boolean {
  const status = resolvePortfolioProjectStatus(p);
  if (status === 'draft' || status === 'estimate') return false;
  return (
    status === 'bid_submitted' ||
    status === 'submitted' ||
    status === 'won' ||
    status === 'in_progress' ||
    status === 'active' ||
    status === 'completed' ||
    status === 'complete' ||
    status === 'closed' ||
    status === 'done' ||
    status === 'finished'
  );
}

const DELETED_PROJECTS_STORAGE_KEY = 'bps.deletedProjects.v1';

export type DeletedProjectRecord = { id: string; title: string; deletedAt: string };

export async function loadDeletedProjectRecords(): Promise<DeletedProjectRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(DELETED_PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordDeletedProject(id: string, title: string): Promise<void> {
  const pid = String(id || '').trim();
  if (!pid) return;
  const t = String(title || '').trim();
  const existing = await loadDeletedProjectRecords();
  const next = [
    { id: pid, title: t, deletedAt: new Date().toISOString() },
    ...existing.filter((r) => r.id !== pid),
  ].slice(0, 200);
  await AsyncStorage.setItem(DELETED_PROJECTS_STORAGE_KEY, JSON.stringify(next));
}

function extractProjectIdFromInsightId(insightId: unknown): string {
  const id = String(insightId || '').trim();
  const patterns = [/^permit-risk-(.+)$/i, /^add-permit-fees-(.+)$/i, /^material-(?:up|down)-(.+)$/i];
  for (const re of patterns) {
    const m = re.exec(id);
    if (m?.[1]) return m[1].trim();
  }
  return '';
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
    const ra = STATUS_RANK_FOR_AI_DEDUPE[resolvePortfolioProjectStatus(p)] ?? 0;
    const rb = STATUS_RANK_FOR_AI_DEDUPE[resolvePortfolioProjectStatus(prev)] ?? 0;
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
  dashboardListedIds: Set<string>;
  openPipelineIds: Set<string>;
  closedIds: Set<string>;
  openPipelineTitles: string[];
  closedTitles: string[];
  knownTitles: string[];
  dashboardListedTitles: string[];
  deletedProjectIds: Set<string>;
  deletedTitles: string[];
};

export function buildAiPortfolioFilterContext(
  activeProjects: any[],
  estimates: any[],
  timelineProgress: Record<string, number>,
  deletedRecords: DeletedProjectRecord[] = []
): AiPortfolioFilterContext {
  const merged = dedupeProjectsByBestStatus([...activeProjects, ...estimates]);
  const closedIds = buildDashboardClosedProjectIdSet(activeProjects, estimates, timelineProgress);
  const knownProjectIds = new Set(
    merged.map((p) => String(p.id ?? '')).filter((id) => id.length > 0)
  );
  const dashboardListed = merged.filter(isDashboardListedProject);
  const dashboardListedIds = new Set(dashboardListed.map((p) => String(p.id ?? '')));
  const openPipeline = merged.filter(
    (p) =>
      isProjectEligibleForAiDashboardInsights(p) &&
      isDashboardListedProject(p) &&
      !closedIds.has(String(p.id ?? '')) &&
      !isProjectClosedForDashboardAi(p, timelineProgress)
  );
  const openPipelineIds = new Set(openPipeline.map((p) => String(p.id ?? '')));
  const closedProjects = merged.filter((p) => closedIds.has(String(p.id ?? '')));
  const deletedProjectIds = new Set(deletedRecords.map((r) => r.id).filter(Boolean));
  const deletedTitles = [
    ...new Set(
      deletedRecords
        .map((r) => String(r.title || '').toLowerCase().trim())
        .filter((t) => t.length >= 3)
    ),
  ];
  return {
    knownProjectIds,
    dashboardListedIds,
    openPipelineIds,
    closedIds,
    openPipelineTitles: projectTitles(openPipeline),
    closedTitles: projectTitles(closedProjects),
    knownTitles: projectTitles(merged),
    dashboardListedTitles: projectTitles(dashboardListed),
    deletedProjectIds,
    deletedTitles,
  };
}

export function filterAiInsightForPortfolio(
  insight: AiInsight,
  ctx: AiPortfolioFilterContext
): boolean {
  const pid = normalizeInsightProjectId(insight);
  const embeddedId = extractProjectIdFromInsightId(insight.id);
  const blob = `${insight.title || ''} ${insight.body || ''}`;
  const retrospective = isRetrospectiveInsight(insight);

  if (
    (pid && ctx.deletedProjectIds.has(pid)) ||
    (embeddedId && ctx.deletedProjectIds.has(embeddedId)) ||
    (ctx.deletedTitles.length > 0 && aiTextReferencesJobTitle(blob, ctx.deletedTitles))
  ) {
    return false;
  }

  const refId = pid || embeddedId;
  if (refId && !ctx.knownProjectIds.has(refId)) return false;

  if (!retrospective) {
    if (refId && !ctx.dashboardListedIds.has(refId)) return false;
    if (refId && !ctx.openPipelineIds.has(refId)) return false;
    if (aiTextReferencesJobTitle(blob, ctx.closedTitles)) return false;
    if (
      insightReferencesRemovedOpenJob(
        insight.title,
        insight.body,
        ctx.openPipelineTitles,
        ctx.dashboardListedTitles
      )
    ) {
      return false;
    }
    return true;
  }

  if (pid) {
    if (ctx.closedIds.has(pid)) return true;
    return ctx.dashboardListedIds.has(pid);
  }
  if (aiTextReferencesJobTitle(blob, ctx.closedTitles)) return true;
  return true;
}

export function filterAiNextStepForPortfolio(
  step: AiNextStep,
  ctx: AiPortfolioFilterContext
): boolean {
  const stepText = String(step.label || '').toLowerCase();
  if (stepText.includes('josh')) return false;

  const pid = normalizeInsightProjectId(step);
  const embeddedId = extractProjectIdFromInsightId(step.id);
  const refId = pid || embeddedId;
  const stepBlob = `${step.label || ''} ${step.chip || ''}`;
  if (
    (refId && ctx.deletedProjectIds.has(refId)) ||
    (ctx.deletedTitles.length > 0 && aiTextReferencesJobTitle(stepBlob, ctx.deletedTitles))
  ) {
    return false;
  }
  if (refId) {
    if (!ctx.knownProjectIds.has(refId)) return false;
    if (!ctx.dashboardListedIds.has(refId)) return false;
    if (ctx.closedIds.has(refId)) return false;
    if (!ctx.openPipelineIds.has(refId)) return false;
  } else if (aiTextReferencesJobTitle(stepBlob, ctx.closedTitles)) {
    return false;
  } else if (
    insightReferencesRemovedOpenJob(
      String(step.label || ''),
      String(step.chip || ''),
      ctx.openPipelineTitles,
      ctx.dashboardListedTitles
    )
  ) {
    return false;
  }
  return true;
}

export function filterProjectsForPortfolioAi(
  projects: any[],
  deletedRecords: DeletedProjectRecord[] = []
): any[] {
  const deletedIds = new Set(deletedRecords.map((r) => r.id).filter(Boolean));

  return dedupeProjectsByBestStatus(projects).filter((p) => {
    const id = String(p?.id ?? '').trim();
    if (id && deletedIds.has(id)) return false;
    return isDashboardListedProject(p);
  });
}

export function filterAiDashboardResponse(
  data: AiDashboardResponse | null,
  activeProjects: any[],
  estimates: any[],
  timelineProgress: Record<string, number>,
  deletedRecords: DeletedProjectRecord[] = []
): AiDashboardResponse | null {
  if (!data) return null;
  const ctx = buildAiPortfolioFilterContext(
    activeProjects,
    estimates,
    timelineProgress,
    deletedRecords
  );
  const isVisibleBriefProject = (projectId?: string | null) => {
    if (!projectId) return true;
    const id = String(projectId);
    return ctx.dashboardListedIds.has(id) && ctx.openPipelineIds.has(id);
  };
  const dailyBrief = data.dailyBrief
    ? {
        ...data.dailyBrief,
        topProfitRisks: (data.dailyBrief.topProfitRisks ?? []).filter((risk) =>
          isVisibleBriefProject(risk.projectId)
        ),
        upcomingPayments: (data.dailyBrief.upcomingPayments ?? []).filter((payment) =>
          isVisibleBriefProject(payment.projectId)
        ),
        upcomingScheduleItems: (data.dailyBrief.upcomingScheduleItems ?? []).filter((item) =>
          isVisibleBriefProject(item.projectId)
        ),
      }
    : data.dailyBrief;
  return {
    ...data,
    insights: (data.insights ?? []).filter((insight) => filterAiInsightForPortfolio(insight, ctx)),
    nextSteps: (data.nextSteps ?? []).filter((step) => filterAiNextStepForPortfolio(step, ctx)),
    dailyBrief,
  };
}

/** Learn deleted jobs from stale API rows (e.g. user deleted before we recorded titles). */
export async function reconcileDeletedProjectsFromInsights(
  insights: AiInsight[],
  knownProjectIds: Set<string>
): Promise<DeletedProjectRecord[]> {
  const existing = await loadDeletedProjectRecords();
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const ins of insights) {
    const embedded = extractProjectIdFromInsightId(ins.id);
    const pid = normalizeInsightProjectId(ins) || embedded;
    if (!pid || knownProjectIds.has(pid)) continue;
    const phrase =
      extractScopedJobPhraseFromInsightText(ins.title, ins.body) ||
      String(ins.title || '').trim();
    byId.set(pid, {
      id: pid,
      title: phrase,
      deletedAt: new Date().toISOString(),
    });
  }
  const next = [...byId.values()].slice(0, 200);
  await AsyncStorage.setItem(DELETED_PROJECTS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function aiDashboardResponsesDiffer(
  a: AiDashboardResponse | null,
  b: AiDashboardResponse | null
): boolean {
  if (!a || !b) return a !== b;
  const aIds = (a.insights ?? []).map((i) => i.id).join('|');
  const bIds = (b.insights ?? []).map((i) => i.id).join('|');
  if (aIds !== bIds) return true;
  const aSteps = (a.nextSteps ?? []).map((s) => s.id).join('|');
  const bSteps = (b.nextSteps ?? []).map((s) => s.id).join('|');
  return aSteps !== bSteps;
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
