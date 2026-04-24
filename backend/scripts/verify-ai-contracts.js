const assert = require('node:assert/strict');

const {
  isPortfolioCompareActiveQuery,
  isPortfolioFocusTodayQuery,
  isPortfolioWorstProjectQuery,
  isPortfolioLosingMoneyQuery,
} = require('../src/services/aiAssistantCore');
const { buildRouterPrompt, buildSystemPrompt } = require('../src/routes/promptSystem');
const { promptCases } = require('../test-fixtures/aiEvalFixtures');

assert.equal(isPortfolioCompareActiveQuery('What should I focus on today?'), false, 'Compare-active pattern stays narrow; focus-today uses isPortfolioFocusTodayQuery.');
assert.equal(isPortfolioFocusTodayQuery('What should I focus on today?'), true);
assert.equal(isPortfolioFocusTodayQuery('What needs attention?'), true);
assert.equal(isPortfolioLosingMoneyQuery('Show me the biggest profit leak'), true);
assert.equal(isPortfolioWorstProjectQuery('Which project is the worst?'), true);

const routerPrompt = buildRouterPrompt();
for (const promptCase of promptCases) {
  assert.match(
    routerPrompt,
    new RegExp(promptCase.expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `Router prompt should keep guidance for: ${promptCase.message}`
  );
}

const systemPrompt = buildSystemPrompt({
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

assert.match(systemPrompt, /AI Command Center/);
assert.match(systemPrompt, /TEST_PROFIT_LEAK_BLOCK/);
assert.match(systemPrompt, /PROJECTED PROFIT/);

console.log('AI contract verification passed.');
