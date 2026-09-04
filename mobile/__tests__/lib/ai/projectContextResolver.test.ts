import {
  detectProjectIntent,
  isGeneralKnowledgeQuery,
  isConversationCancelQuery,
  isExplicitExpenseLogQuery,
  isWriteOrMutationRequest,
  resolveProjectContext,
  PORTFOLIO_ACTIVE_PROFIT_PATTERN,
} from '@/lib/ai/projectContextResolver';

describe('projectContextResolver conversation routing', () => {
  test('treats construction education questions as general knowledge', () => {
    expect(isGeneralKnowledgeQuery('Can you explain markup versus margin for me?')).toBe(true);
    expect(isGeneralKnowledgeQuery('Why can a profitable job still have cash flow problems?')).toBe(true);
    expect(isGeneralKnowledgeQuery('What scope items could possibly be missing from a repaint job or bathroom remodel?')).toBe(true);
    expect(isGeneralKnowledgeQuery('What are some project scopes that would be missing from a kitchen remodel')).toBe(true);
    expect(isGeneralKnowledgeQuery('Can you guarantee this estimate will be profitable?')).toBe(true);
    expect(isGeneralKnowledgeQuery('How should I count for prep work masking access and cleanup?')).toBe(true);
    expect(isGeneralKnowledgeQuery('What is my projected profit?')).toBe(false);
    expect(isGeneralKnowledgeQuery('Add a $500 expense to repaint')).toBe(false);
  });

  test('does not force a project for general knowledge questions', () => {
    expect(detectProjectIntent('Explain markup versus margin').needsProject).toBe(false);
    expect(detectProjectIntent('Why can a profitable job still have cash-flow problems?').needsProject).toBe(false);
    expect(detectProjectIntent('What is my projected profit?').needsProject).toBe(true);
    expect(detectProjectIntent('Check Repaint').needsProject).toBe(false);
  });

  test('only treats explicit expense logging as an expense workflow', () => {
    expect(isExplicitExpenseLogQuery('Add a $500 expense to Repaint')).toBe(true);
    expect(isExplicitExpenseLogQuery('How is it going today?')).toBe(false);
    expect(isExplicitExpenseLogQuery('How much of my cost budget have I spent?')).toBe(false);
    expect(isExplicitExpenseLogQuery('What type of labor is on this job?')).toBe(false);
  });

  test('recognizes cancel and read-only write requests', () => {
    expect(isConversationCancelQuery('never mind')).toBe(true);
    expect(isWriteOrMutationRequest('Can you add $500 expense to repaint?')).toBe(true);
    expect(isWriteOrMutationRequest('Can you add something to my calendar?')).toBe(true);
    expect(isWriteOrMutationRequest('What is my projected profit?')).toBe(false);
  });

  test('does not treat active-jobs profit questions as a missing project name', () => {
    expect(PORTFOLIO_ACTIVE_PROFIT_PATTERN.test('What is my profit for my active jobs?')).toBe(true);
    const result = resolveProjectContext(
      'What is my profit for my active jobs?',
      { currentScreen: 'AI Assistant Tab' },
      [{ id: 'p1', title: 'Interior and Exterior House Repaint', status: 'won', isActive: true }]
    );
    expect(result.needsClarification).toBe(false);
  });

  test('uses the only active project on Central Command instead of asking which one', () => {
    const result = resolveProjectContext(
      'What is my projected profit for this job?',
      { currentScreen: 'AI Assistant Tab' },
      [{ id: 'p1', title: 'Interior and Exterior House Repaint', status: 'won', isActive: true }]
    );
    expect(result.needsClarification).toBe(false);
    expect(result.projectId).toBe('p1');
  });

  test('routes stay-on-budget follow-ups to a health check', () => {
    const result = detectProjectIntent('How do I make sure I stay on budget for my current job?');
    expect(result.type).toBe('project_health');
    expect(result.analysisType).toBe('quick');
  });

  test('routes current-job risk questions to a health check', () => {
    const result = detectProjectIntent('What is the current risk that my current job is facing?');
    expect(result.type).toBe('project_health');
    expect(result.analysisType).toBe('quick');
  });

  test('routes cost-budget-spent questions directly to a health check', () => {
    const result = detectProjectIntent('How much of my cost budget have I already spent?');
    expect(result.type).toBe('project_health');
    expect(result.analysisType).toBe('quick');
  });

  test('routes remaining-cost questions directly to a health check', () => {
    const result = detectProjectIntent("What's my remaining cost for my current project?");
    expect(result.type).toBe('project_health');
    expect(result.analysisType).toBe('quick');
  });

  test('routes budget variance follow-ups directly to a health check', () => {
    const result = detectProjectIntent('Budget variance');
    expect(result.type).toBe('project_health');
    expect(result.analysisType).toBe('quick');
  });

  test('routes outdoor-work weather recommendations away from project analysis', () => {
    const result = detectProjectIntent('Which day this week would be best for me to paint exterior?');
    expect(result.type).toBe('project_health');
    expect(result.analysisType).toBe('quick');
  });

  test('asks which project when a current-project question has multiple active projects', () => {
    const result = resolveProjectContext(
      'How much of my cost budget have I already spent?',
      { currentScreen: 'AI Assistant Tab' },
      [
        { id: 'p1', title: 'Interior Repaint', status: 'won', isActive: true },
        { id: 'p2', title: 'Kitchen Remodel', status: 'in_progress', isActive: true },
      ]
    );
    expect(result.needsClarification).toBe(true);
    expect(result.clarificationType).toBe('project_selection');
    expect(result.options?.map((option) => option.title)).toEqual([
      'Interior Repaint',
      'Kitchen Remodel',
    ]);
  });

  test('treats current risks across projects as a portfolio question', () => {
    const result = resolveProjectContext(
      'What are the current risks of my active projects?',
      { currentScreen: 'AI Assistant Tab' },
      [{ id: 'p1', title: 'Interior and Exterior House Repaint', status: 'won', isActive: true }]
    );
    expect(result.needsClarification).toBe(false);
    expect(result.projectId).toBeNull();
  });
});
