/**
 * Project Context Resolver
 * 
 * Intelligently resolves which project a user is referring to based on:
 * - Active/selected project in UI context
 * - Last opened project (within 7 days)
 * - Number of active projects
 * - User's query intent
 * - Smart defaults and clarifying question rules
 */

export type ProjectContext = {
  projectId: string | null;
  needsClarification: boolean;
  options?: Array<{
    id: string;
    title: string;
    status?: string;
    lastOpened?: string;
  }>;
  reason?: string;
  clarificationType?: 'project_selection' | 'analysis_type';
};

export type UIState = {
  activeProjectId?: string | null;
  selectedProjectId?: string | null;
  currentScreen?: string;
  lastOpenedProjectId?: string | null;
};

export type RecentProject = {
  id: string;
  title: string;
  status?: string;
  lastOpened?: string;
  isActive?: boolean;
};

export type ProjectIntent = {
  type: 'project_analysis' | 'project_health' | 'project_summary' | 'project_profitability' | 'project_risks' | 'other';
  needsProject: boolean;
  analysisType?: 'quick' | 'full' | 'unspecified';
};

/**
 * Detects project-related intent from user query
 */
/** Message body when user taps a green scenario card (matches backend scenario keys). */
export const SCENARIO_SELECTION_ID_PATTERN =
  /^(typical_friction|bad_remodel|smooth_job|job_runs_long(_\d+)?|all_presets)$/i;

/** Command Center / All Projects: schedule, calendar, payments+deadlines — aggregate active jobs; never ask "which project?" */
export const PORTFOLIO_SCHEDULE_CALENDAR_PATTERN =
  /\b(?:payments?\s+or\s+deadlines|deadlines?\s+or\s+payments|what\s+payments?\s+or\s+deadlines|upcoming\s+(?:deadlines?|payments?|events?)|what'?s\s+on\s+(?:my\s+)?(?:the\s+)?calendar|calendar\s+events?|on\s+my\s+schedule|do\s+i\s+have\s+(?:any\s+)?events?|inspections?\s+coming|any\s+inspections)\b/i;

export function detectProjectIntent(query: string): ProjectIntent {
  const lowerQuery = query.toLowerCase().trim();
  // CRITICAL: Scenario card tap sends only the id (e.g. job_runs_long_4). That string contains "job",
  // which would match projectKeywords and become project_analysis → "quick health check?" chips wrongly.
  if (SCENARIO_SELECTION_ID_PATTERN.test(query.trim())) {
    return { type: 'other', needsProject: true, analysisType: 'unspecified' };
  }
  if (PORTFOLIO_SCHEDULE_CALENDAR_PATTERN.test(lowerQuery)) {
    return { type: 'other', needsProject: false, analysisType: 'unspecified' };
  }
  // CRITICAL: Detect expense logging requests - must catch "log expense", "log an expense", "can you log", etc.
  const expenseLoggingPattern = /\b(log|record|add|need to log|can you log)\s+(an?\s+)?expense/i;
  const isExpenseFlow = expenseLoggingPattern.test(lowerQuery) ||
                       /\b(expense|expenses|material|materials|labor|labour|spent|bought|purchased)\b/i.test(lowerQuery);
  
  // Quick health check keywords
  const quickHealthKeywords = ['health', 'health check', 'status', 'how is', 'how\'s', 'doing'];
  const isQuickHealth = quickHealthKeywords.some(kw => lowerQuery.includes(kw));
  
  // Full analysis keywords
  const fullAnalysisKeywords = ['analyze', 'analysis', 'breakdown', 'detailed', 'full', 'complete'];
  const isFullAnalysis = fullAnalysisKeywords.some(kw => lowerQuery.includes(kw));
  
  // Action keywords that need project but are NOT analysis requests
  const actionKeywords = [
    'add', 'create', 'update', 'record', 'set', 'change', 'modify', 'mark',
    'remove', 'delete', 'approve', 'reject', 'send', 'generate',
    'do it', 'do this', 'handle', 'take care of', 'apply', 'log'
  ];
  const isActionRequest = actionKeywords.some(kw => lowerQuery.includes(kw));
  
  // CRITICAL: Detect change order requests - they are actions, not analysis
  const isChangeOrderRequest = /\b(create|add|make|i need|i want|give me|start)\s+(me\s+)?(a\s+)?(change\s+order|changeorder)\b/i.test(lowerQuery) ||
                               /\bchange\s+order\b/i.test(lowerQuery) ||
                               /\bscope\s+change\b/i.test(lowerQuery) ||
                               /\bclient\s+wants\s+to\s+add\b/i.test(lowerQuery) ||
                               /\bextra\s+work\b/i.test(lowerQuery);
  
  // CRITICAL: Detect assign PM requests - they are actions, not analysis
  const isAssignPMRequest = /\b(assign|appoint|set|name|pick|choose|select)\s+(a\s+)?(project\s+manager|pm)\b/i.test(lowerQuery) ||
                            /\b(project\s+manager|pm)\s+for\s+(me|this\s+project)/i.test(lowerQuery) ||
                            /\b(name|pick|choose|select)\s+(a\s+)?(project\s+manager|pm)\s+for\s+me/i.test(lowerQuery) ||
                            (lowerQuery.includes('project manager') && (lowerQuery.includes('assign') || lowerQuery.includes('appoint') || lowerQuery.includes('name') || lowerQuery.includes('pick') || lowerQuery.includes('choose')));
  
  // CRITICAL: Team management, health check, forecast, etc. - map to correct intent, not generic analysis
  const isTeamManagementRequest = /\b(team\s+management|help.*team|team\s+help)\b/i.test(lowerQuery);
  const isHealthCheckRequest = /\b(health\s+check|project\s+health|check\s+(project|budget)|budget\s+check)\b/i.test(lowerQuery);
  const isForecastRequest = /\b(forecast|what\s+if|scenario\s+analysis)\b/i.test(lowerQuery);
  
  // Project-specific keywords (including "my project", "this job", "our estimate")
  // But exclude if it's an action request (those need project context but aren't analysis)
  const projectKeywords = [
    'project', 'job', 'this project', 'this job', 'current project', 'my project',
    'our project', 'our job', 'our estimate', 'my estimate', 'the project', 'the job',
    'summary', 'overview', 'progress', 'budget', 'costs', 'spending', 
    'profit', 'margin', 'risks', 'timeline', 'schedule', 'milestones', 'payment', 'payments',
    'expenses', 'purchase orders', 'change orders'
  ];
  
  // Needs project context if it mentions project keywords OR is an action request
  const needsProject = projectKeywords.some(kw => lowerQuery.includes(kw)) || isActionRequest;
  
  // But it's NOT an analysis request if it's an action, change order, assign PM, team management, or explicit forecast/health
  if (isActionRequest || isExpenseFlow || isChangeOrderRequest || isAssignPMRequest || isTeamManagementRequest) {
    return {
      type: 'other',
      needsProject: true,
      analysisType: 'unspecified',
    };
  }
  // Explicit health check or forecast - don't ask "quick or full", go to AI with the right type
  if (isHealthCheckRequest) {
    return { type: 'project_health', needsProject: true, analysisType: 'quick' };
  }
  if (isForecastRequest) {
    return { type: 'project_profitability', needsProject: true, analysisType: 'full' };
  }
  
  if (!needsProject) {
    return { type: 'other', needsProject: false };
  }
  
  // Determine analysis type
  let analysisType: 'quick' | 'full' | 'unspecified' = 'unspecified';
  if (isQuickHealth && !isFullAnalysis) {
    analysisType = 'quick';
  } else if (isFullAnalysis) {
    analysisType = 'full';
  }
  
  // Determine intent type
  let intentType: ProjectIntent['type'] = 'project_analysis';
  if (lowerQuery.includes('health') || lowerQuery.includes('status')) {
    intentType = 'project_health';
  } else if (lowerQuery.includes('summary') || lowerQuery.includes('overview')) {
    intentType = 'project_summary';
  } else if (lowerQuery.includes('profit') || lowerQuery.includes('margin')) {
    intentType = 'project_profitability';
  } else if (lowerQuery.includes('risk')) {
    intentType = 'project_risks';
  }
  
  return {
    type: intentType,
    needsProject: true,
    analysisType,
  };
}

/**
 * Detects if a user query requires project context (backward compatibility)
 */
export function requiresProjectContext(query: string): boolean {
  return detectProjectIntent(query).needsProject;
}

/**
 * Resolves project context from user query, UI state, and recent projects
 * Implements smart defaults and clarifying question rules
 */
/** Phrases that mean "all active projects" / compare scope — never ask "which project?"; send to backend so it can say "You have no active projects" if needed. */
const PORTFOLIO_ACTIVE_PROJECTS_PATTERN = /\b(where am I losing money|losing money across|profit leak|biggest profit leak|show me the biggest profit leak|across my active projects|across all active projects|compare (all )?my active projects)\b/i;
/** Phrases that mean "completed projects" / compare scope — never ask "which project?"; backend will list completed and where they lost/could have made more. */
const PORTFOLIO_COMPLETED_PROJECTS_PATTERN = /\b(yes\s+)?(completed\s+projects?|completed\s+jobs?|review\s+(my\s+)?completed|compare\s+(my\s+)?completed|profit\s+(on\s+)?completed)\b/i;
/** Phrases that mean "which projects are over budget" — never ask "which project?"; backend will list active + completed over budget and by how much. */
const PORTFOLIO_OVER_BUDGET_PATTERN = /\b(which\s+)?(active\s+)?projects?\s+(are\s+)?over\s+budget|(show\s+)?projects?\s+over\s+budget|over\s+budget\s+(and\s+by\s+how\s+much)?|identify\s+budget\s+risks|budget\s+risks\b/i;

export function resolveProjectContext(
  userQuery: string,
  uiState: UIState,
  recentProjects: RecentProject[]
): ProjectContext {
  const lowerQuery = userQuery.toLowerCase().trim();
  
  // Portfolio/compare scope: user asked about active projects as a set. Do NOT ask "which project?" — send to backend.
  if (PORTFOLIO_ACTIVE_PROJECTS_PATTERN.test(userQuery)) {
    return {
      projectId: null,
      needsClarification: false,
      reason: 'Portfolio/compare scope (active projects, profit leaks) — no single project; backend will answer or say no active projects',
    };
  }
  // Portfolio/compare scope: user asked about completed projects. Do NOT ask "which project?" — backend will list completed and profit/loss.
  if (PORTFOLIO_COMPLETED_PROJECTS_PATTERN.test(userQuery)) {
    return {
      projectId: null,
      needsClarification: false,
      reason: 'Portfolio/compare scope (completed projects) — backend will list completed projects and where they lost/could have made more',
    };
  }
  // Portfolio/compare scope: user asked which projects are over budget. Do NOT ask "which project?" — backend will list active + completed over budget.
  if (PORTFOLIO_OVER_BUDGET_PATTERN.test(userQuery)) {
    return {
      projectId: null,
      needsClarification: false,
      reason: 'Portfolio/compare scope (over budget) — backend will list which projects are over budget and by how much',
    };
  }
  // Upcoming payments/deadlines/calendar across active jobs — backend aggregates; do NOT ask "which project?"
  if (PORTFOLIO_SCHEDULE_CALENDAR_PATTERN.test(userQuery)) {
    return {
      projectId: null,
      needsClarification: false,
      reason: 'Portfolio schedule (calendar + timeline) — all active projects',
    };
  }

  // Smart Default Rule 1: If user is on Project Detail or Estimate Generator screen, ALWAYS use the active project
  // This means when "Ask PM" is used from a project page, all questions default to that project
  if (
    uiState.currentScreen === 'Project Detail' ||
    uiState.currentScreen === 'project-detail' ||
    uiState.currentScreen === 'Estimate Generator' ||
    uiState.currentScreen === 'estimate-generator'
  ) {
    const activeProjectId = uiState.activeProjectId || uiState.selectedProjectId;
    if (activeProjectId) {
      return {
        projectId: activeProjectId,
        needsClarification: false,
        reason: 'Using active project from current screen context (Ask PM mode)',
      };
    }
  }
  
  // Smart Default Rule 2: If user says "this project" / "this job" / "current" -> use active project
  const thisProjectKeywords = ['this project', 'this job', 'current project', 'current job', 'the project', 'the job'];
  const mentionsThisProject = thisProjectKeywords.some(kw => lowerQuery.includes(kw));
  
  if (mentionsThisProject) {
    const activeProjectId = uiState.activeProjectId || uiState.selectedProjectId;
    if (activeProjectId) {
      const project = recentProjects.find(p => p.id === activeProjectId);
      if (project) {
        return {
          projectId: activeProjectId,
          needsClarification: false,
          reason: 'User said "this project/job" - using active project',
        };
      }
    }
  }
  
  // CRITICAL: If user is on AI Assistant page (general context), DO NOT assume a project
  // Only use active project if user is on a specific project/estimate page
  if (uiState.currentScreen === 'AI Assistant' || 
      uiState.currentScreen === 'AI Assistant Tab' ||
      uiState.currentScreen === 'assistant') {
    // In general AI Assistant page, never assume a project - always ask if unclear
    // Only proceed if project name is explicitly mentioned in query
    const projectInQuery = findProjectInQuery(userQuery, recentProjects);
    if (projectInQuery) {
      return {
        projectId: projectInQuery.id,
        needsClarification: false,
        reason: 'Project name found in user query',
      };
    }
    // If no project mentioned, ask for clarification
    // ACTIVE-ONLY: For generic project-specific questions, only show active projects (exclude completed).
    // Completed projects are included only when user explicitly asks about completed/historical (handled by PORTFOLIO_COMPLETED_PROJECTS_PATTERN above) or names a project (findProjectInQuery above).
    const isCompleted = (p: RecentProject) => (p.status || '').toLowerCase() === 'completed';
    const isActiveProject = (p: RecentProject) => {
      const status = (p.status || '').toLowerCase();
      return p.isActive === true || ['won', 'active', 'in_progress', 'in-progress', 'submitted', 'bid_submitted'].includes(status);
    };
    const selectableProjects = recentProjects.filter(p => !isCompleted(p) && isActiveProject(p));
    
    // Use selectableProjects only (no fallback to all) so we never show completed in generic clarification
    return {
      needsClarification: true,
      clarificationType: 'project_selection',
      options: getTopProjectsForClarification(selectableProjects, selectableProjects),
      reason: 'No project mentioned in query - asking for clarification (active projects only)',
    };
  }
  
  // Smart Default Rule 3: Active/selected project in UI context (if project is open on screen)
  // Only applies when NOT on AI Assistant page
  const activeProjectId = uiState.activeProjectId || uiState.selectedProjectId;
  if (activeProjectId) {
    const project = recentProjects.find(p => p.id === activeProjectId);
    if (project) {
      return {
        projectId: activeProjectId,
        needsClarification: false,
        reason: 'Using active project from UI context',
      };
    }
  }
  
  // Smart Default Rule 3: Check if query explicitly mentions a project name
  const mentionedProject = findProjectInQuery(userQuery, recentProjects);
  if (mentionedProject) {
    return {
      projectId: mentionedProject.id,
      needsClarification: false,
      reason: `Found project "${mentionedProject.title}" mentioned in query`,
    };
  }
  
  // Smart Default Rule 4: Use last_opened_project_id if within last 7 days
  if (uiState.lastOpenedProjectId) {
    const lastOpenedProject = recentProjects.find(p => p.id === uiState.lastOpenedProjectId);
    if (lastOpenedProject && lastOpenedProject.lastOpened) {
      const daysSinceOpened = (Date.now() - new Date(lastOpenedProject.lastOpened).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceOpened <= 7) {
        return {
          projectId: lastOpenedProject.id,
          needsClarification: false,
          reason: 'Using last opened project (within 7 days)',
        };
      }
    }
  }
  
  // Smart Default Rule 5: If only 1 Active/In Progress project -> choose it
  const activeProjects = recentProjects.filter(p => {
    const status = (p.status || '').toLowerCase();
    return p.isActive || ['active', 'won', 'in_progress', 'submitted'].includes(status);
  });
  
  if (activeProjects.length === 1) {
    return {
      projectId: activeProjects[0].id,
      needsClarification: false,
      reason: 'Only one active project found',
    };
  }
  
  // Smart Default Rule 6: If only one project total, use it
  if (recentProjects.length === 1) {
    return {
      projectId: recentProjects[0].id,
      needsClarification: false,
      reason: 'Only one project found',
    };
  }
  
  // Clarifying Question Rule: Ask to select from top 3 recent projects (multiple choice)
  const topProjects = getTopProjectsForClarification(recentProjects, activeProjects);
  
  return {
    projectId: null,
    needsClarification: true,
    clarificationType: 'project_selection',
    options: topProjects,
    reason: 'Multiple projects found, needs user clarification',
  };
}

/**
 * Finds if a project is mentioned in the user query
 */
function findProjectInQuery(query: string, projects: RecentProject[]): RecentProject | null {
  const normalizeText = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return null;

  const stopWords = new Set(['project', 'job', 'the', 'a', 'an', 'and', 'of', 'for', 'on', 'my', 'our']);
  const candidates: Array<{ project: RecentProject; score: number }> = [];

  for (const project of projects) {
    const projectTitle = normalizeText(project.title || '');
    if (!projectTitle) continue;

    if (
      normalizedQuery === projectTitle ||
      normalizedQuery.startsWith(`${projectTitle} `) ||
      normalizedQuery.endsWith(` ${projectTitle}`) ||
      normalizedQuery.includes(` ${projectTitle} `)
    ) {
      candidates.push({ project, score: 100 });
      continue;
    }

    const titleWords = projectTitle
      .split(' ')
      .filter((word) => word.length > 2 && !stopWords.has(word));
    if (!titleWords.length) continue;

    const matchedWords = titleWords.filter((word) =>
      normalizedQuery === word ||
      normalizedQuery.startsWith(`${word} `) ||
      normalizedQuery.endsWith(` ${word}`) ||
      normalizedQuery.includes(` ${word} `)
    );

    if (matchedWords.length === titleWords.length && titleWords.length >= 2) {
      candidates.push({ project, score: 90 + matchedWords.length });
      continue;
    }

    if (titleWords.length === 1 && matchedWords.length === 1 && titleWords[0].length >= 5) {
      candidates.push({ project, score: 70 });
      continue;
    }

    if (matchedWords.length >= 2 && matchedWords.length >= Math.ceil(titleWords.length * 0.75)) {
      candidates.push({ project, score: 60 + matchedWords.length });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null;
  return candidates[0].project;
}

/**
 * Gets top 3 projects to show for clarification
 */
function getTopProjectsForClarification(
  allProjects: RecentProject[],
  activeProjects: RecentProject[]
): Array<{ id: string; title: string; status?: string; lastOpened?: string }> {
  // Prioritize active projects, then by last opened
  const candidates = activeProjects.length > 0 ? activeProjects : allProjects;
  
  const sorted = candidates
    .map(p => ({
      ...p,
      sortScore: calculateProjectScore(p),
    }))
    .sort((a, b) => b.sortScore - a.sortScore)
    .slice(0, 3);
  
  // Normalize status for AI clarification chips: use user-facing labels, not pipeline labels
  // Won/In Progress/Active -> Active; Completed -> Completed
  const displayStatus = (s: string | undefined) => {
    if (!s) return undefined;
    const lower = s.toLowerCase();
    if (lower === 'completed') return 'Completed';
    if (['won', 'active', 'in_progress', 'in-progress'].includes(lower)) return 'Active';
    if (['bid_submitted', 'submitted'].includes(lower)) return 'Submitted';
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
  };

  return sorted.map(({ sortScore, ...project }) => ({
    id: project.id,
    title: project.title,
    status: displayStatus(project.status) ?? project.status,
    lastOpened: project.lastOpened,
  }));
}

/**
 * Calculates a score for project prioritization
 */
function calculateProjectScore(project: RecentProject): number {
  let score = 0;
  
  // Active projects get higher score
  if (project.isActive) score += 100;
  
  // Status-based scoring
  if (project.status) {
    const status = project.status.toLowerCase();
    if (['active', 'won', 'in_progress'].includes(status)) score += 50;
    if (['submitted', 'bid_submitted'].includes(status)) score += 30;
  }
  
  // Recency bonus (more recent = higher score)
  if (project.lastOpened) {
    const daysSinceOpened = (Date.now() - new Date(project.lastOpened).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 50 - daysSinceOpened); // Decay over time
  }
  
  return score;
}

/**
 * Formats clarification message with project options
 */
export function formatClarificationMessage(options: Array<{ id: string; title: string; status?: string }>): string {
  const projectList = options
    .map((opt, index) => `${index + 1}. ${opt.title}${opt.status ? ` (${opt.status})` : ''}`)
    .join('\n');
  
  return `Which project do you mean?\n\n${projectList}\n\nOr say "search" to find a different project.`;
}

/**
 * Formats analysis type clarification message
 */
export function formatAnalysisTypeClarification(): string {
  return 'Do you want a quick health check or full breakdown?';
}
