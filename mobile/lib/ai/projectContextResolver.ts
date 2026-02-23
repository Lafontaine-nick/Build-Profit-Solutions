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
export function detectProjectIntent(query: string): ProjectIntent {
  const lowerQuery = query.toLowerCase().trim();
  
  // Quick health check keywords
  const quickHealthKeywords = ['health', 'health check', 'status', 'how is', 'how\'s', 'doing'];
  const isQuickHealth = quickHealthKeywords.some(kw => lowerQuery.includes(kw));
  
  // Full analysis keywords
  const fullAnalysisKeywords = ['analyze', 'analysis', 'breakdown', 'detailed', 'full', 'complete'];
  const isFullAnalysis = fullAnalysisKeywords.some(kw => lowerQuery.includes(kw));
  
  // Action keywords that need project but are NOT analysis requests
  const actionKeywords = [
    'add', 'create', 'update', 'record', 'set', 'change', 'modify',
    'remove', 'delete', 'approve', 'reject', 'send', 'generate',
    'do it', 'do this', 'handle', 'take care of', 'apply'
  ];
  const isActionRequest = actionKeywords.some(kw => lowerQuery.includes(kw));
  
  // Project-specific keywords (including "my project", "this job", "our estimate")
  // But exclude if it's an action request (those need project context but aren't analysis)
  const projectKeywords = [
    'project', 'job', 'this project', 'this job', 'current project', 'my project',
    'our project', 'our job', 'our estimate', 'my estimate', 'the project', 'the job',
    'summary', 'overview', 'progress', 'budget', 'costs', 'spending', 
    'profit', 'margin', 'risks', 'timeline', 'schedule', 'milestones',
    'expenses', 'purchase orders', 'change orders'
  ];
  
  // Needs project context if it mentions project keywords OR is an action request
  const needsProject = projectKeywords.some(kw => lowerQuery.includes(kw)) || isActionRequest;
  
  // But it's NOT an analysis request if it's an action
  if (isActionRequest) {
    return {
      type: 'other',
      needsProject: true,
      analysisType: 'unspecified',
    };
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
export function resolveProjectContext(
  userQuery: string,
  uiState: UIState,
  recentProjects: RecentProject[]
): ProjectContext {
  const lowerQuery = userQuery.toLowerCase().trim();
  
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
    // Filter active projects from recentProjects
    const activeProjects = recentProjects.filter(p => {
      const status = (p.status || '').toLowerCase();
      return ['won', 'active', 'in_progress', 'in-progress', 'completed'].includes(status);
    });
    
    return {
      needsClarification: true,
      clarificationType: 'project_selection',
      options: getTopProjectsForClarification(recentProjects, activeProjects),
      reason: 'No project mentioned in query - asking for clarification',
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
  const lowerQuery = query.toLowerCase();
  
  for (const project of projects) {
    const projectTitle = project.title.toLowerCase();
    const titleWords = projectTitle.split(/\s+/);
    
    // Check for exact match or significant word matches
    if (lowerQuery.includes(projectTitle)) {
      return project;
    }
    
    // Check if significant words from project title appear in query
    const significantWords = titleWords.filter(word => word.length > 3);
    if (significantWords.length > 0) {
      const matchCount = significantWords.filter(word => 
        lowerQuery.includes(word)
      ).length;
      
      // If most significant words match, consider it a match
      if (matchCount >= Math.ceil(significantWords.length * 0.6)) {
        return project;
      }
    }
  }
  
  return null;
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
  
  return sorted.map(({ sortScore, ...project }) => ({
    id: project.id,
    title: project.title,
    status: project.status,
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
