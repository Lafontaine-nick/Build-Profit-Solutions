import {
  computeTaxCenterSummary,
  expenseAmount,
  expenseCountsToward1099Filing,
  expenseCountsTowardSubcontractorPayments,
  expenseCountsTowardW2Payments,
  getYearExpenses,
  isCurrentTaxProject,
  laborPaymentMethodLabel,
  laborPaymentMethodOf,
  type TaxExpense,
} from '@/src/lib/taxCenter';
import { buildW9ReminderPayees, resolveVendorForExpense } from '@/src/lib/tax1099Review';
import { getPotential1099ReviewThreshold } from '@/src/lib/taxReviewThresholds';
import type { Vendor } from '@/src/lib/vendorTypes';

export type CentralCommandTaxSource = {
  projects: any[];
  vendors: Vendor[];
};

export type CentralCommandW9 = 'received' | 'missing' | 'requested' | 'not_needed';

export type CentralCommandTaxPayee = {
  name: string;
  kind: '1099' | 'w2';
  totalPaid: number;
  payments: number;
  projects: string[];
  paidWith: string[];
  w9: CentralCommandW9;
  overThreshold: boolean;
  hasCardPayment: boolean;
};

export type CentralCommandTaxSnapshot = {
  year: number;
  threshold: number;
  revenue: number;
  expensesPaid: number;
  netIncome: number;
  total1099: number;
  totalW2: number;
  missingReceipts: number;
  missingReceiptsByProject: { name: string; count: number }[];
  contractors: CentralCommandTaxPayee[];
  employees: CentralCommandTaxPayee[];
  w9Needed: { name: string; totalPaid: number }[];
};

function payeeName(expense: TaxExpense): string {
  return String(expense.vendorName || expense.vendor || '').trim();
}

function w9For(vendor: Vendor | undefined): CentralCommandW9 {
  const status = vendor?.w9Status;
  if (status === 'uploaded' || status === 'verified') return 'received';
  if (status === 'not_applicable') return 'not_needed';
  if (status === 'requested') return 'requested';
  return 'missing';
}

function groupPayees(
  rows: TaxExpense[],
  kind: '1099' | 'w2',
  vendors: Vendor[],
  threshold: number
): CentralCommandTaxPayee[] {
  const groups = new Map<string, CentralCommandTaxPayee & { filingTotal: number }>();
  for (const row of rows) {
    const linked = kind === '1099' ? resolveVendorForExpense(row, vendors) : undefined;
    const name = linked?.businessName || payeeName(row) || 'Unknown';
    const key = linked?.id ? `id:${linked.id}` : `name:${name.toLowerCase()}`;
    const current =
      groups.get(key) ||
      {
        name,
        kind,
        totalPaid: 0,
        payments: 0,
        projects: [],
        paidWith: [],
        w9: kind === '1099' ? w9For(linked) : 'not_needed',
        overThreshold: false,
        hasCardPayment: false,
        filingTotal: 0,
      };
    const amount = expenseAmount(row);
    current.totalPaid += amount;
    current.payments += 1;
    const project = String(row.projectName || '').trim();
    if (project && !current.projects.includes(project)) current.projects.push(project);
    const method = laborPaymentMethodOf(row);
    const label = laborPaymentMethodLabel(method);
    if (label && !current.paidWith.includes(label)) current.paidWith.push(label);
    if (method === 'card') current.hasCardPayment = true;
    if (kind === '1099' && expenseCountsToward1099Filing(row)) current.filingTotal += amount;
    current.overThreshold = kind === '1099' && current.filingTotal >= threshold;
    groups.set(key, current);
  }
  return Array.from(groups.values())
    .map(({ filingTotal: _filingTotal, ...payee }) => payee)
    .sort((a, b) => b.totalPaid - a.totalPaid);
}

/** Same numbers as Tax Center for one tax year, for Central Command. */
export function buildCentralCommandTaxSnapshot(
  source: CentralCommandTaxSource,
  year: number
): CentralCommandTaxSnapshot {
  const projects = (source.projects || []).filter(isCurrentTaxProject);
  const vendors = source.vendors || [];
  const threshold = getPotential1099ReviewThreshold(year);
  const summary = computeTaxCenterSummary(projects, [], [], [], year, vendors);
  const yearExpenses = getYearExpenses(projects, year);
  const contractorRows = yearExpenses.filter((e) => expenseCountsTowardSubcontractorPayments(e, vendors));
  const employeeRows = yearExpenses.filter((e) => expenseCountsTowardW2Payments(e));
  const contractors = groupPayees(contractorRows, '1099', vendors, threshold);
  const employees = groupPayees(employeeRows, 'w2', vendors, threshold);

  const receiptsByProject = new Map<string, number>();
  let missingReceipts = 0;
  for (const expense of yearExpenses) {
    const amount = expenseAmount(expense);
    if (!Number.isFinite(amount) || amount === 0) continue;
    if (String(expense.receiptUri ?? '').trim()) continue;
    missingReceipts += 1;
    const project = String(expense.projectName || '').trim() || 'Unnamed project';
    receiptsByProject.set(project, (receiptsByProject.get(project) || 0) + 1);
  }

  return {
    year,
    threshold,
    revenue: summary.grossIncomeCollected,
    expensesPaid: summary.totalExpenses,
    netIncome: summary.netProfit,
    total1099: contractors.reduce((sum, p) => sum + p.totalPaid, 0),
    totalW2: employees.reduce((sum, p) => sum + p.totalPaid, 0),
    missingReceipts,
    missingReceiptsByProject: Array.from(receiptsByProject.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    contractors,
    employees,
    w9Needed: buildW9ReminderPayees(contractorRows, vendors).map((p) => ({ name: p.name, totalPaid: p.totalPaid })),
  };
}

function money(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function wholeMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function w9Label(w9: CentralCommandW9): string {
  if (w9 === 'received') return 'W-9 received';
  if (w9 === 'requested') return 'W-9 requested';
  if (w9 === 'not_needed') return 'W-9 not needed';
  return 'W-9 not on file';
}

/** Year-so-far lines for Today's Brief. Empty when the year has no activity. */
export function buildCentralCommandBriefLines(snapshot: CentralCommandTaxSnapshot): string[] {
  const lines: string[] = [];
  if (snapshot.revenue > 0 || snapshot.expensesPaid > 0) {
    lines.push(
      `${snapshot.year} so far: ${wholeMoney(snapshot.revenue)} received · ${wholeMoney(snapshot.netIncome)} net income`
    );
  }
  if (snapshot.missingReceipts > 0) {
    lines.push(
      `${snapshot.missingReceipts} ${plural(snapshot.missingReceipts, 'bill', 'bills')} missing receipts`
    );
  }
  const w9Count = snapshot.w9Needed.length;
  if (w9Count === 1) {
    lines.push(`1 contractor missing a W-9: ${snapshot.w9Needed[0].name}`);
  } else if (w9Count > 1) {
    lines.push(`${w9Count} contractors missing a W-9`);
  }
  const over = snapshot.contractors.filter((p) => p.overThreshold);
  if (over.length > 0) {
    lines.push(
      `${over.length} ${plural(over.length, 'contractor', 'contractors')} over ${wholeMoney(snapshot.threshold)} for 1099 review`
    );
  }
  return lines;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveQuestionYear(message: string, now: Date): number {
  const explicit = message.match(/\b(20\d{2})\b/);
  if (explicit) return Number(explicit[1]);
  if (/\blast\s+year\b/i.test(message)) return now.getFullYear() - 1;
  return now.getFullYear();
}

function summaryLines(snapshot: CentralCommandTaxSnapshot): string[] {
  return [
    `• Revenue received: ${money(snapshot.revenue)}`,
    `• Expenses paid: ${money(snapshot.expensesPaid)}`,
    `• Net income: ${money(snapshot.netIncome)}`,
    `• 1099 contractors: ${money(snapshot.total1099)}`,
    `• W-2 wages: ${money(snapshot.totalW2)}`,
  ];
}

function openItemsLine(snapshot: CentralCommandTaxSnapshot): string | null {
  const parts: string[] = [];
  if (snapshot.missingReceipts > 0) {
    parts.push(`${snapshot.missingReceipts} ${plural(snapshot.missingReceipts, 'bill', 'bills')} missing receipts`);
  }
  if (snapshot.w9Needed.length > 0) {
    parts.push(
      `${snapshot.w9Needed.length} ${plural(snapshot.w9Needed.length, 'contractor', 'contractors')} missing a W-9`
    );
  }
  return parts.length ? `Still open: ${parts.join(' · ')}.` : null;
}

function payeeAnswer(payee: CentralCommandTaxPayee, snapshot: CentralCommandTaxSnapshot): string {
  const role = payee.kind === 'w2' ? 'a W-2 employee' : 'a 1099 contractor';
  const payments = `${payee.payments} ${plural(payee.payments, 'payment', 'payments')}`;
  const projects = payee.projects.length ? ` on ${payee.projects.join(', ')}` : '';
  const lines = [`You paid ${payee.name} **${money(payee.totalPaid)}** in ${snapshot.year} as ${role}, across ${payments}${projects}.`];
  if (payee.kind === '1099') {
    const details = [w9Label(payee.w9)];
    if (payee.paidWith.length) details.push(`Paid with ${payee.paidWith.join(', ')}`);
    lines.push(details.join(' · '));
    lines.push(
      payee.overThreshold
        ? `That is over the ${snapshot.year} ${wholeMoney(snapshot.threshold)} line, so review a 1099-NEC with your CPA.`
        : `That is under the ${snapshot.year} ${wholeMoney(snapshot.threshold)} line for 1099 review.`
    );
    if (payee.hasCardPayment) {
      lines.push('Card payments are left out of that line because the card company usually reports them.');
    }
  } else {
    lines.push('This is gross pay. Withholding and employer payroll taxes are handled by your payroll service.');
  }
  return lines.join('\n\n');
}

function contractorsAnswer(snapshot: CentralCommandTaxSnapshot): string {
  if (snapshot.contractors.length === 0) {
    return `No 1099 contractor payments in ${snapshot.year} yet. A labor bill counts here when Paid to has someone else's name and 1099 is chosen.`;
  }
  const rows = snapshot.contractors.map((p) => {
    const parts = [`${p.name} — ${money(p.totalPaid)}`, w9Label(p.w9)];
    if (p.paidWith.length) parts.push(`Paid with ${p.paidWith.join(', ')}`);
    return `• ${parts.join(' · ')}`;
  });
  const over = snapshot.contractors.filter((p) => p.overThreshold).map((p) => p.name);
  const thresholdLine = over.length
    ? `Over the ${snapshot.year} ${wholeMoney(snapshot.threshold)} line for 1099 review: ${over.join(', ')}. Confirm filing with your CPA.`
    : `Nobody is at the ${snapshot.year} ${wholeMoney(snapshot.threshold)} line for 1099 review yet.`;
  const lines = [`1099 contractor payments in ${snapshot.year}: **${money(snapshot.total1099)}**`, rows.join('\n'), thresholdLine];
  if (snapshot.contractors.some((p) => p.hasCardPayment)) {
    lines.push('Card payments are left out of that line because the card company usually reports them.');
  }
  return lines.join('\n\n');
}

function employeesAnswer(snapshot: CentralCommandTaxSnapshot): string {
  if (snapshot.employees.length === 0) {
    return `No W-2 wages logged in ${snapshot.year}. A labor bill counts here when Paid to has the employee's name and W-2 is chosen.`;
  }
  const rows = snapshot.employees.map((p) => {
    const projects = p.projects.length ? ` (${p.projects.join(', ')})` : '';
    return `• ${p.name} — ${money(p.totalPaid)}${projects}`;
  });
  return [
    `W-2 wages in ${snapshot.year}: **${money(snapshot.totalW2)}**`,
    rows.join('\n'),
    'This is gross pay. Withholding and employer payroll taxes are handled by your payroll service.',
  ].join('\n\n');
}

function w9Answer(snapshot: CentralCommandTaxSnapshot): string {
  if (snapshot.contractors.length === 0) {
    return `No 1099 contractors in ${snapshot.year} yet, so no W-9s are needed. A W-9 is only needed when Paid to has someone else's name on a 1099 labor bill.`;
  }
  if (snapshot.w9Needed.length === 0) {
    return `Every 1099 contractor in ${snapshot.year} has a W-9 marked received: ${snapshot.contractors
      .map((p) => p.name)
      .join(', ')}.`;
  }
  const rows = snapshot.w9Needed.map((p) => `• ${p.name} — ${money(p.totalPaid)} paid`);
  return [
    `${snapshot.w9Needed.length} ${plural(snapshot.w9Needed.length, 'contractor still needs', 'contractors still need')} a W-9 in ${snapshot.year}:`,
    rows.join('\n'),
    'Once you have the signed form, mark it received in Tax Center under 1099 & W-2.',
  ].join('\n\n');
}

function receiptsAnswer(snapshot: CentralCommandTaxSnapshot): string {
  if (snapshot.missingReceipts === 0) {
    return `Every bill paid in ${snapshot.year} has a receipt attached.`;
  }
  const rows = snapshot.missingReceiptsByProject.map((p) => `• ${p.name} — ${p.count}`);
  return [
    `${snapshot.missingReceipts} ${plural(snapshot.missingReceipts, 'bill', 'bills')} paid in ${snapshot.year} ${plural(snapshot.missingReceipts, 'is', 'are')} missing a receipt:`,
    rows.join('\n'),
    "Open each bill from the project's budget to attach one.",
  ].join('\n\n');
}

function yearSummaryAnswer(snapshot: CentralCommandTaxSnapshot): string {
  const lines = [`${snapshot.year} so far, cash basis:`, summaryLines(snapshot).join('\n')];
  const open = openItemsLine(snapshot);
  if (open) lines.push(open);
  return lines.join('\n\n');
}

const TAX_ADVICE_PATTERN =
  /\b(deduct|deductions?|deductible|write[- ]?offs?|quarterly|estimated\s+tax(?:es)?|owe\s+the\s+irs|how\s+much\s+tax|tax\s+bracket|self[- ]employment\s+tax)\b/i;
const MONEY_WORD_PATTERN = /\b(pay|paid|payments?|total|how\s+much|owe|spent|1099s?|w-?2s?|w-?9s?)\b/i;

/**
 * Read-only answers from Tax Center data. Returns null when the question is not a Tax Center question,
 * so the normal assistant can answer it.
 */
export function answerCentralCommandTaxQuestion(
  message: string,
  source: CentralCommandTaxSource,
  now: Date = new Date()
): string | null {
  const text = String(message || '').trim();
  if (!text) return null;
  const year = resolveQuestionYear(text, now);
  const snapshot = buildCentralCommandTaxSnapshot(source, year);

  const lower = text.toLowerCase();
  const mentionsProject = (source.projects || []).some((p) => {
    const title = String(p?.title || p?.name || '').trim().toLowerCase();
    return title.length >= 3 && lower.includes(title);
  });
  if (!mentionsProject && MONEY_WORD_PATTERN.test(text)) {
    const payees = [...snapshot.contractors, ...snapshot.employees]
      .filter((p) => p.name.trim().length >= 2)
      .sort((a, b) => b.name.length - a.name.length);
    const match = payees.find((p) => new RegExp(`\\b${escapeRegExp(p.name)}(?:'s)?\\b`, 'i').test(text));
    if (match) return payeeAnswer(match, snapshot);
  }

  if (TAX_ADVICE_PATTERN.test(text)) {
    return [
      "I can't give tax advice like deductions or what you will owe. Here is what Tax Center tracked:",
      yearSummaryAnswer(snapshot),
      'Your CPA can use these numbers.',
    ].join('\n\n');
  }

  if (/\bw-?9s?\b/i.test(text)) return w9Answer(snapshot);
  if (/\bw-?2s?\b|\bemployees?\b|\bwages?\b|\bpayroll\b/i.test(text)) return employeesAnswer(snapshot);
  if (
    /\b1099s?\b/i.test(text) ||
    (/\b(contractors?|subcontractors?|subs)\b/i.test(text) && /\b(pay|paid|payments?|total|how\s+much|owe|list|who)\b/i.test(text))
  ) {
    return contractorsAnswer(snapshot);
  }
  if (/\breceipts?\b/i.test(text) && /\b(missing|without|no|need|needs|which|how\s+many|attach)\b/i.test(text)) {
    return receiptsAnswer(snapshot);
  }
  if (
    /\b(tax\s+center|tax\s+summary|year[- ]to[- ]date|ytd)\b/i.test(text) ||
    (!/\b(projected|forecast|forecasted)\b/i.test(text) &&
      /\b(this\s+year|so\s+far|last\s+year|in\s+20\d{2})\b/i.test(text) &&
      /\b(revenue|income|received|collected|expenses|spent|net|profit|make|made|earn|earned)\b/i.test(text))
  ) {
    return yearSummaryAnswer(snapshot);
  }
  return null;
}
