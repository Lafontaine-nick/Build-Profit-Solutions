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
    expect(detectProjectIntent('Did this job make money?')).toEqual({
      type: 'other',
      needsProject: true,
      analysisType: 'unspecified',
    });
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
    expect(isWriteOrMutationRequest('Please schedule an inspection tomorrow')).toBe(true);
    expect(isWriteOrMutationRequest('Add a $500 Home Depot material')).toBe(true);
    expect(isWriteOrMutationRequest("What's on my calendar?")).toBe(false);
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

  test('uses a finished job when the question names it', () => {
    const result = resolveProjectContext(
      '"What\'s my margin on Electrical Estimate Draft?"',
      { currentScreen: 'AI Assistant Tab' },
      [{ id: 'done-1', title: 'Electrical Estimate Draft', status: 'completed', isActive: false, isCompleted: true }]
    );
    expect(result.needsClarification).toBe(false);
    expect(result.projectId).toBe('done-1');
  });

  test('uses the only finished job instead of asking which project', () => {
    const result = resolveProjectContext(
      "What's my margin?",
      { currentScreen: 'AI Assistant Tab' },
      [{ id: 'done-1', title: 'Electrical Estimate Draft', status: 'completed', isActive: false }]
    );
    expect(result.needsClarification).toBe(false);
    expect(result.projectId).toBe('done-1');
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

  test('routes remaining-cost questions to the snapshot card, not a health check', () => {
    const result = detectProjectIntent("What's my remaining cost for my current project?");
    expect(result.type).toBe('other');
    expect(result.needsProject).toBe(true);
    expect(result.analysisType).toBe('unspecified');
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

  test('does not ask for a project when the question is only about the weather', () => {
    expect(detectProjectIntent("What's the weather today?").needsProject).toBe(false);
    expect(detectProjectIntent('What is the weather like where I live').needsProject).toBe(false);
    const result = resolveProjectContext(
      "What's the weather today?",
      { currentScreen: 'AI Assistant Tab' },
      [
        { id: 'p1', title: 'Smith Kitchen Remodel', status: 'in_progress', isActive: true },
        { id: 'p2', title: 'Untitled Bid', status: 'active', isActive: true },
      ]
    );
    expect(result.needsClarification).toBe(false);
    expect(result.projectId).toBeNull();
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

  test('snapshot money questions skip the health-check fork', () => {
    const questions = [
      'What payments are overdue on Electrical Estimate Draft?',
      'When am I getting paid?',
      'Review payments',
      "What's still left to collect?",
      "What's left to spend?",
      'Remaining cost',
      'How much budget is left?',
      "What's my profit forecast?",
      'If costs keep coming in, what do I make?',
      "What's my margin?",
      'Did this job make money?',
      'Am I making enough on this job?',
      'How much have I collected so far?',
      'How much is still coming in on this job?',
      "What's my material budget?",
      'How much labor budget do I have left?',
      'Is this job worth it?',
      'What happens to my profit if labor goes up 10%?',
    ];
    for (const question of questions) {
      const result = detectProjectIntent(question);
      expect(result.needsProject).toBe(true);
      expect(result.type).not.toBe('project_analysis');
      expect(result.type).not.toBe('project_health');
    }
    const review = detectProjectIntent('How is this job doing?');
    expect(review.analysisType).not.toBe('unspecified');
    expect(detectProjectIntent('Give me a health check').type).toBe('project_health');
  });

  test('does not ask for a health check when Review Payments asks what is overdue', () => {
    const result = detectProjectIntent('What payments are overdue on Electrical Estimate Draft?');
    expect(result.type).toBe('other');
    expect(result.needsProject).toBe(true);
    expect(result.analysisType).toBe('unspecified');
  });

  test('treats which job to worry about as a portfolio question', () => {
    const result = detectProjectIntent('Which job should I worry about most?');
    expect(result.type).toBe('other');
    expect(result.needsProject).toBe(false);
  });

  test('does not ask for a health check when the question is which projects are losing money', () => {
    expect(detectProjectIntent('Which projects are losing money?').needsProject).toBe(false);
    const result = resolveProjectContext(
      'Which projects are losing money?',
      { currentScreen: 'AI Assistant Tab' },
      [{ id: 'done-1', title: 'Electrical Estimate Draft', status: 'completed', isActive: false }]
    );
    expect(result.needsClarification).toBe(false);
    expect(result.projectId).toBeNull();
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
