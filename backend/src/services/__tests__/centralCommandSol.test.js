const {
  prepareCentralCommandAction,
  answerCentralCommandWithSol,
  searchPricingLibrary,
  centralCommandReasoningEffort,
} = require('../centralCommandSol');

const project = {
  id: '1790902852864',
  title: 'Electrical Estimate Draft',
  status: 'in_progress',
  estimateData: { insuranceOverhead: 300, facilities: 200 },
};

describe('centralCommandSol', () => {
  test('a change order uses the company markup preference and waits for confirmation', () => {
    const prepared = prepareCentralCommandAction('Create a $1,700 concrete change order', {
      projects: [project],
      parsedContext: { projectId: project.id, currentProject: project.title },
      userMemory: { preferredMarkupPct: 22 },
    });
    expect(prepared.reply).toContain('$1,700');
    expect(prepared.reply).toContain('22%');
    expect(prepared.reply).toContain('$2,074');
    expect(prepared.reply).toContain('Confirm');
    expect(prepared.reply).not.toMatch(/saved|created it/i);
    expect(prepared.actions[0].type).toBe('create_change_order');
    expect(prepared.actions[0].changeOrder.cost).toBe(1700);
    expect(prepared.actions[0].changeOrder.amount).toBe(2074);
  });

  test('a job figure invented by the model is replaced when the tool disagrees', async () => {
    let round = 0;
    const openai = {
      responses: {
        create: async () => {
          round += 1;
          if (round === 1) {
            return {
              id: 'resp-1',
              output: [{
                type: 'function_call',
                name: 'get_project_budget',
                call_id: 'call-1',
                arguments: '{}',
              }],
            };
          }
          return { id: 'resp-2', output_text: 'Project overhead is $2,300.', output: [] };
        },
      },
    };
    const result = await answerCentralCommandWithSol({
      message: "What's my overhead?",
      projects: [project],
      parsedContext: { projectId: project.id, currentProject: project.title },
      openai,
      model: 'gpt-6.1-sol',
    });
    expect(result.reply).toContain("I won't guess");
    expect(result.reply).not.toContain('$2,300');
    expect(centralCommandReasoningEffort('Compare my jobs')).toBe('high');
    expect(centralCommandReasoningEffort('How should I cook a ribeye?')).toBe('medium');
  });

  test('pricing search returns saved rates and ignores unrelated trades', () => {
    const result = searchPricingLibrary('tile demolition', () => ([
      { scopeItemName: 'Wall tile demolition', trade: 'tile', unitType: 'sqft', unitRate: 4.5 },
      { scopeItemName: 'Roofing tear off', trade: 'roofing', unitType: 'sqft', unitRate: 1.25 },
    ]));
    expect(result.count).toBe(1);
    expect(result.rates[0].rate).toBe(4.5);
  });
});
