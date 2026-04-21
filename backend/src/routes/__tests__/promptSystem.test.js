const { buildSystemPrompt, buildRouterPrompt } = require('../promptSystem');
const { promptCases } = require('../../../test-fixtures/aiEvalFixtures');

describe('promptSystem contracts', () => {
  test('router prompt keeps core tool-routing rules for critical user asks', () => {
    const routerPrompt = buildRouterPrompt();

    expect(routerPrompt).toContain('"proposed_tool"');
    expect(routerPrompt).toContain('compare_projects');
    expect(routerPrompt).toContain('get_project_health');
    expect(routerPrompt).toContain('profit from completed');
    expect(routerPrompt).toContain('when am I getting paid');

    for (const promptCase of promptCases) {
      expect(routerPrompt).toContain(promptCase.expect);
    }
  });

  test('system prompt injects command-center and profit-leak guidance for portfolio scope', () => {
    const prompt = buildSystemPrompt({
      projectName: 'Nick remodel',
      projectId: 'proj-1',
      status: 'active',
      bidTotal: 100000,
      estimatedCost: 70000,
      actualCost: 32000,
      contractValue: 108000,
      approvedChangeOrdersTotal: 8000,
      progress: 42,
      aiPmMode: true,
      screen: 'AI Assistant Tab',
      profitLeakBlock: 'TEST_PROFIT_LEAK_BLOCK',
    });

    expect(prompt).toContain('AI Command Center');
    expect(prompt).toContain('PROJECTED PROFIT');
    expect(prompt).toContain('TEST_PROFIT_LEAK_BLOCK');
    expect(prompt).toContain('SCOPE RULES (aiScope=portfolio)');
  });

  test('system prompt stays project-scoped for project detail screens', () => {
    const prompt = buildSystemPrompt({
      projectName: 'Nick remodel',
      projectId: 'proj-1',
      status: 'active',
      bidTotal: 100000,
      estimatedCost: 70000,
      actualCost: 32000,
      progress: 42,
      aiPmMode: true,
      screen: 'Project Detail',
    });

    expect(prompt).toContain('SCOPE RULES (aiScope=project)');
    expect(prompt).toContain('You are a combined PM + Estimator + CFO');
    expect(prompt).not.toContain('You are the AI Command Center');
  });
});
