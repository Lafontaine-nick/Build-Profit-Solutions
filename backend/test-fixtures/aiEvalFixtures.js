const deepClone = (value) => JSON.parse(JSON.stringify(value));

const assistantQueryProjects = [
  {
    id: '1',
    title: 'Jerry Remodel',
    customerName: 'Jerry',
    bidPrice: 100000,
    estimatedCost: 80000,
    actualCost: 30000,
    progress: 40,
    milestones: [
      { title: 'Deposit', amount: 10000, dueDate: '2026-03-01', collected: true },
      { title: 'Week 2 Payment', amount: 15000, dueDate: '2026-04-01' },
      { title: 'Final Draw', amount: 25000 },
    ],
  },
  {
    id: '2',
    title: 'Jason Kitchen Upgrade',
    customerName: 'Jason',
    bidPrice: 60000,
    estimatedCost: 45000,
    actualCost: 20000,
    progress: 55,
    milestones: [
      { title: 'Progress Payment', amount: 12000, dueDate: '2026-03-20' },
    ],
  },
];

const ambiguousProjects = [
  { id: 'a', title: 'Oak Remodel' },
  { id: 'b', title: 'Oak Kitchen Remodel' },
];

const rankingProjects = [
  { id: 'p1', title: 'Alpha', bidPrice: 100000, estimatedCost: 80000, actualCost: 50000, progress: 40, status: 'active' },
  { id: 'p2', title: 'Beta', bidPrice: 90000, estimatedCost: 70000, actualCost: 79000, progress: 70, status: 'active' },
  { id: 'p3', title: 'Gamma', bidPrice: 120000, estimatedCost: 95000, actualCost: 30000, progress: 20, status: 'active' },
];

const calendarProjects = [
  {
    id: 'done',
    title: 'Old Job',
    status: 'completed',
    calendarEvents: [{ date: '2026-03-15', title: 'Rough inspection', type: 'inspection' }],
  },
  {
    id: 'active',
    title: 'Current Job',
    status: 'in_progress',
    calendarEvents: [{ date: '2026-03-15', title: 'Rough inspection', type: 'inspection' }],
  },
];

const calendarStatusProjects = [
  {
    id: 'x',
    title: 'Via flag',
    isCompleted: true,
    status: 'won',
    calendarEvents: [{ date: '2026-03-15', title: 'Rough inspection', type: 'inspection' }],
  },
  {
    id: 'y',
    title: 'Still on',
    status: 'won',
    calendarEvents: [{ date: '2026-03-15', title: 'Rough inspection', type: 'inspection' }],
  },
];

const calendarCreateProjects = [
  { id: 'n', title: 'Nicholas', name: 'Nicholas' },
  { id: 'j', title: 'Jerry', name: 'Jerry' },
];

const dashboardProjects = [
  {
    id: 'est-1',
    userId: 'user-1',
    name: 'Nick remodel',
    title: 'Nick remodel',
    status: 'estimate',
    bidPrice: 80000,
    estimatedCost: 56000,
    actualCost: 0,
    margin: 30,
    markup: 42.8,
    progress: 0,
    updatedAt: '2026-04-01T10:00:00.000Z',
    lineItems: [],
    expenses: [],
    milestones: [],
  },
  {
    id: 'act-1',
    userId: 'user-1',
    name: 'Copper Valley Rehab',
    title: 'Copper Valley Rehab',
    status: 'active',
    bidPrice: 100000,
    estimatedCost: 70000,
    actualCost: 79000,
    margin: 30,
    markup: 42.8,
    progress: 70,
    updatedAt: '2026-04-02T10:00:00.000Z',
    expenses: [
      { id: 'e1', amount: 5000 },
      { id: 'e2', amount: 3500 },
      { id: 'e3', amount: 1500 },
    ],
    milestones: [
      { title: 'Midpoint Payment', amount: 12000, dueDate: '2026-04-05', collected: false },
    ],
    lineItems: [],
  },
  {
    id: 'act-2',
    userId: 'user-1',
    name: 'Stable Kitchen',
    title: 'Stable Kitchen',
    status: 'active',
    bidPrice: 50000,
    estimatedCost: 38000,
    actualCost: 15000,
    margin: 24,
    markup: 31.5,
    progress: 45,
    updatedAt: '2026-04-03T10:00:00.000Z',
    milestones: [
      { title: 'Final Draw', amount: 10000, dueDate: '2026-04-25', collected: false },
    ],
    lineItems: [],
    expenses: [],
  },
];

const dashboardProjectsNoDatedPayments = [
  {
    id: 'ndp-1',
    userId: 'user-1',
    name: 'No Date Job',
    title: 'No Date Job',
    status: 'active',
    bidPrice: 45000,
    estimatedCost: 33000,
    actualCost: 12000,
    margin: 26.7,
    markup: 36.4,
    progress: 35,
    milestones: [
      { title: 'Deposit', amount: 8000, collected: true },
      { title: 'Final Draw', amount: 15000 },
    ],
    lineItems: [],
    expenses: [],
  },
];

const completedSummaries = [
  {
    id: 'closed-1',
    title: 'Silver leaf project',
    netProfit: 2794270,
    netProfitPct: 21.7,
  },
];

const promptCases = [
  {
    message: 'What should I focus on today?',
    expect: 'compare_projects',
  },
  {
    message: 'When am I getting paid?',
    expect: 'compare_projects',
  },
  {
    message: 'Profit from my completed projects',
    expect: 'status: "completed"',
  },
  {
    message: 'Review Nick remodel',
    expect: 'get_project_health',
  },
];

module.exports = {
  deepClone,
  assistantQueryProjects,
  ambiguousProjects,
  rankingProjects,
  calendarProjects,
  calendarStatusProjects,
  calendarCreateProjects,
  dashboardProjects,
  dashboardProjectsNoDatedPayments,
  completedSummaries,
  promptCases,
};
