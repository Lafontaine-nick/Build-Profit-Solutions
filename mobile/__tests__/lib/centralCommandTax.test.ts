import {
  answerCentralCommandTaxQuestion,
  buildCentralCommandBriefLines,
  buildCentralCommandTaxSnapshot,
} from '@/src/lib/centralCommandTax';

const now = new Date(2026, 9, 7, 11, 0, 0);

const paidLabor = (id: string, vendor: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  category: 'Labor',
  vendor,
  trade: 'Electrical',
  amount,
  date: '2026-10-06',
  paidAt: '2026-10-06',
  paymentStatus: 'paid',
  ...extra,
});

const source = {
  vendors: [
    { id: 'v1', businessName: 'Nicholas', vendorType: 'subcontractor', w9Status: 'uploaded' },
  ] as any[],
  projects: [
    {
      id: 'p1',
      title: 'Electrical Estimate Draft',
      status: 'completed',
      projectData: {
        timelineV2Milestones: [
          { id: 'm1', title: 'Final', amount: 5000, paymentAmount: 5000, status: 'paid', collectedAt: '2026-10-01' },
        ],
      },
      expenses: [
        paidLabor('e1', 'Electrical', 1000),
        paidLabor('e2', 'Nicholas', 1000, { receiptUri: 'file://r.jpg' }),
        paidLabor('e3', 'Nick', 500, { paymentMethod: 'check' }),
        paidLabor('e4', 'Steve', 2000, { laborPayType: 'w2' }),
        paidLabor('e5', 'me', 300),
      ],
    },
  ],
};

describe('Central Command tax snapshot', () => {
  it('matches Tax Center totals and leaves owner labor off the payee lists', () => {
    const s = buildCentralCommandTaxSnapshot(source, 2026);
    expect(s.revenue).toBe(5000);
    expect(s.expensesPaid).toBe(4800);
    expect(s.netIncome).toBe(200);
    expect(s.total1099).toBe(1500);
    expect(s.totalW2).toBe(2000);
    expect(s.contractors.map((p) => p.name)).toEqual(['Nicholas', 'Nick']);
    expect(s.employees.map((p) => p.name)).toEqual(['Steve']);
    expect(s.w9Needed.map((p) => p.name)).toEqual(['Nick']);
    expect(s.missingReceipts).toBe(4);
  });

  it('builds year-so-far brief lines', () => {
    const lines = buildCentralCommandBriefLines(buildCentralCommandTaxSnapshot(source, 2026));
    expect(lines).toEqual([
      '2026 so far: $5,000 received · $200 net income',
      '4 bills missing receipts',
      '1 contractor missing a W-9: Nick',
    ]);
  });
});

describe('Central Command tax answers', () => {
  const ask = (q: string) => answerCentralCommandTaxQuestion(q, source, now);

  it('answers how much a named payee was paid without mixing Nick and Nicholas', () => {
    const nick = ask('How much did I pay Nick?');
    expect(nick).toContain('You paid Nick **$500.00** in 2026 as a 1099 contractor');
    expect(nick).toContain('W-9 not on file · Paid with Check');
    expect(nick).toContain('under the 2026 $2,000 line');
    expect(nick).toContain('Nicholas is a separate payee, paid $1,000.00');
    expect(nick).not.toContain('same person');
    const onProject = ask('How much did I pay Nick on Electrical Estimate Draft?');
    expect(onProject).toContain('You paid Nick **$500.00**');
    expect(onProject).not.toContain('same person');
    expect(ask('what did nicholas get paid')).toContain('You paid Nicholas **$1,000.00**');
    const cost = ask('What did Nick cost me?');
    expect(cost).toContain('You paid Nick **$500.00**');
    expect(cost).toContain('Nicholas is a separate payee, paid $1,000.00');
    expect(cost).not.toContain('same person');
  });

  it('names the finished job when two jobs share a title', () => {
    const withActiveTwin = {
      ...source,
      projects: [
        ...source.projects,
        { id: 'p2', title: 'Electrical Estimate Draft', status: 'active', expenses: [] },
      ],
    };
    const reply = answerCentralCommandTaxQuestion('What did Nick cost me?', withActiveTwin, now);
    expect(reply).toContain('across 1 payment on Electrical Estimate Draft (finished).');
    expect(ask('What did Nick cost me?')).toContain('across 1 payment on Electrical Estimate Draft.');
  });

  it('lists who still needs a W-9', () => {
    const reply = ask('Who still needs a W-9?');
    expect(reply).toContain('1 contractor still needs a W-9 in 2026');
    expect(reply).toContain('• Nick — $500.00 paid');
  });

  it('gives W-2 and 1099 totals', () => {
    expect(ask("What's my W-2 total?")).toContain('W-2 wages in 2026: **$2,000.00**');
    const contractors = ask('Show my 1099 payments');
    expect(contractors).toContain('**$1,500.00**');
    expect(contractors).toContain('Nobody is at the 2026 $2,000 line');
  });

  it('answers missing receipts and the year summary', () => {
    expect(ask('Which projects have missing receipts?')).toContain('• Electrical Estimate Draft — 4');
    const summary = ask('How much did I make this year?');
    expect(summary).toContain('Net income: $200.00');
    expect(summary).toContain('Still open: 4 bills missing receipts · 1 contractor missing a W-9.');
  });

  it('declines tax advice but still shows the tracked numbers', () => {
    const reply = ask('What can I deduct this year?');
    expect(reply).toContain("I can't give tax advice");
    expect(reply).toContain('Revenue received: $5,000.00');
  });

  it('leaves job collections to the assistant', () => {
    expect(ask('How much have I collected so far?')).toBeNull();
    expect(ask('How much is still coming in on this job?')).toBeNull();
  });

  it('leaves project and forecast questions to the assistant', () => {
    expect(ask('Compare all my projects for profitability and risk')).toBeNull();
    expect(ask('Forecast profit across my entire portfolio — show projected numbers')).toBeNull();
    expect(ask('What is my projected profit this year?')).toBeNull();
    expect(ask('Find subcontractors near me')).toBeNull();
    expect(ask('What does my calendar look like?')).toBeNull();
  });
});
