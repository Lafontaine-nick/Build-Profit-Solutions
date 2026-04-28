/**
 * Informational 1099-readiness review only. Does not determine IRS filing requirements or legal 1099 obligations.
 */

import {
  expenseAmount,
  expenseDate,
  isPoPaidForTax,
  mapExpenseToTaxCategory,
  type TaxExpense,
  type TaxPayment,
} from '@/src/lib/taxCenter';
import type { Vendor, VendorType, W9Status } from '@/src/lib/vendorTypes';

const REVIEW_THRESHOLD = 600;

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateInYear = (value: unknown, year: number): boolean => {
  const date = parseDate(value);
  return !!date && date.getFullYear() === year;
};

function displayVendorName(e: TaxExpense): string {
  const n = String(e.vendorName || e.vendor || '').trim();
  return n || 'Unknown vendor';
}

function resolveVendorForExpense(e: TaxExpense, vendors: Vendor[]): Vendor | undefined {
  if (e.vendorId) return vendors.find((v) => v.id === e.vendorId);
  const label = displayVendorName(e).toLowerCase();
  return vendors.find((v) => v.businessName.trim().toLowerCase() === label);
}

function effectiveVendorType(v: Vendor | undefined, expense: TaxExpense): VendorType | 'unknown' {
  if (v?.vendorType) return v.vendorType;
  const cat = mapExpenseToTaxCategory(expense);
  if (cat === 'Subcontractors') return 'subcontractor';
  return 'supplier';
}

function w9Blocking(status: W9Status | 'unknown' | undefined): boolean {
  return status === 'missing' || status === 'requested' || status === 'unknown' || status === undefined;
}

/** Paid / collected / completed — excludes obvious unpaid rows for 1099 threshold math. */
function expenseIndicatesPaidFor1099(e: TaxExpense): boolean {
  if (e.__isPurchaseOrder) return isPoPaidForTax(e);
  const ps = String(e.paymentStatus || '').toLowerCase();
  const st = String(e.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'void') return false;
  if (['pending', 'unpaid', 'scheduled', 'draft', 'open'].includes(ps)) return false;
  if (['paid', 'collected', 'completed', 'complete', 'cleared', 'posted'].includes(ps)) return true;
  return false;
}

function requires1099Override(linked: Vendor | undefined, anyExpenseFlag: boolean): boolean {
  return linked?.requires1099Review === true || anyExpenseFlag;
}

function isW9EligibleVendorType(vType: VendorType | 'unknown'): boolean {
  return vType === 'subcontractor' || vType === 'consultant' || vType === 'other';
}

function isPotential1099EligibleVendorType(vType: VendorType | 'unknown'): boolean {
  return vType === 'subcontractor' || vType === 'consultant' || vType === 'other';
}

export type Tax1099ReviewVendorRow = {
  vendorId: string | null;
  displayName: string;
  vendorType: VendorType | 'unknown';
  /** Capitalized for UI badge (e.g. Supplier, Subcontractor). */
  vendorTypeBadge: string;
  totalPaid: number;
  paymentMethodDisplay: string;
  w9Status: W9Status | 'unknown';
  projects: string[];
  actionNeeded: string[];
  /** When false, hide W-9 status on review cards (e.g. suppliers without 1099 override). */
  w9UiRelevant: boolean;
};

export type Tax1099ReviewSummary = {
  potential1099VendorCount: number;
  missingW9Count: number;
  paymentsMissingMethodCount: number;
  missingVendorInfoCount: number;
  rows: Tax1099ReviewVendorRow[];
  disclaimer: string;
};

const DISCLAIMER =
  'This review is informational only. It does not determine final legal filing requirements, 1099 obligations, or IRS rules. Confirm with your CPA or tax professional. Not tax advice.';

function formatVendorTypeBadge(t: VendorType | 'unknown'): string {
  if (t === 'unknown') return 'Unknown';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function build1099ReviewSummary(args: {
  vendors: Vendor[];
  expenses: TaxExpense[];
  payments: TaxPayment[];
  selectedYear: number;
}): Tax1099ReviewSummary {
  void args.payments;
  const { vendors, expenses, selectedYear } = args;

  type Agg = {
    key: string;
    vendorId: string | null;
    displayName: string;
    totalPaid: number;
    paid1099Total: number;
    projects: Set<string>;
    methods: Set<string>;
    linked?: Vendor;
    sampleExpense: TaxExpense;
    anyRequires1099Review: boolean;
  };

  const groups = new Map<string, Agg>();

  for (const e of expenses) {
    if (!dateInYear(expenseDate(e), selectedYear)) continue;
    const linked = resolveVendorForExpense(e, vendors);
    const displayName = linked?.businessName || displayVendorName(e);
    const vendorId = linked?.id || (e.vendorId ? String(e.vendorId) : null);
    const key = vendorId ? `id:${vendorId}` : `name:${displayName.toLowerCase()}`;

    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        vendorId,
        displayName,
        totalPaid: 0,
        paid1099Total: 0,
        projects: new Set(),
        methods: new Set(),
        linked,
        sampleExpense: e,
        anyRequires1099Review: false,
      };
      groups.set(key, g);
    }
    const amt = expenseAmount(e);
    g.totalPaid += amt;
    if (expenseIndicatesPaidFor1099(e)) {
      g.paid1099Total += amt;
    }
    if (e.projectName) g.projects.add(e.projectName);
    const pm = String(e.paymentMethod || '').trim();
    if (pm) g.methods.add(pm);
    g.sampleExpense = e;
    if (!g.linked && linked) g.linked = linked;
    if (e.requires1099Review === true) g.anyRequires1099Review = true;
  }

  const rows: Tax1099ReviewVendorRow[] = [];

  for (const g of groups.values()) {
    const linked = g.linked;
    const vType = effectiveVendorType(linked, g.sampleExpense);
    const w9: W9Status | 'unknown' = linked?.w9Status ?? 'unknown';
    const actionNeeded: string[] = [];
    const override = requires1099Override(linked, g.anyRequires1099Review);

    const eligiblePotential1099 =
      isPotential1099EligibleVendorType(vType) || (vType === 'supplier' && override);

    if (eligiblePotential1099 && g.paid1099Total >= REVIEW_THRESHOLD) {
      actionNeeded.push('Potential 1099 Review');
    }

    const w9TypeApplies =
      (isW9EligibleVendorType(vType) && g.paid1099Total > 0) ||
      (vType === 'supplier' && override && g.paid1099Total > 0);

    if (w9TypeApplies && w9Blocking(w9)) {
      actionNeeded.push('Missing W-9');
    }

    if (g.methods.size === 0 && g.paid1099Total > 0) {
      actionNeeded.push('Confirm Payment Method');
    }

    const detailEligible =
      (isW9EligibleVendorType(vType) && g.paid1099Total > 0) ||
      (vType === 'supplier' && override && g.paid1099Total > 0);

    if (
      detailEligible &&
      linked &&
      (!String(linked.legalName || '').trim() ||
        !String(linked.address || '').trim() ||
        !String(linked.email || '').trim())
    ) {
      actionNeeded.push('Missing Vendor Info');
    }

    const paymentMethodDisplay =
      g.methods.size === 0 ? '—' : Array.from(g.methods).sort().join(', ');

    const w9UiRelevant = isW9EligibleVendorType(vType) || override;

    rows.push({
      vendorId: g.vendorId,
      displayName: g.displayName,
      vendorType: vType,
      vendorTypeBadge: formatVendorTypeBadge(vType),
      totalPaid: g.totalPaid,
      paymentMethodDisplay,
      w9Status: w9,
      projects: Array.from(g.projects).sort(),
      actionNeeded: Array.from(new Set(actionNeeded)),
      w9UiRelevant,
    });
  }

  rows.sort((a, b) => b.totalPaid - a.totalPaid);

  const potential1099VendorCount = rows.filter((r) => r.actionNeeded.includes('Potential 1099 Review')).length;
  const missingW9Count = rows.filter((r) => r.actionNeeded.includes('Missing W-9')).length;
  const paymentsMissingMethodCount = rows.filter((r) => r.actionNeeded.includes('Confirm Payment Method')).length;
  const missingVendorInfoCount = rows.filter((r) => r.actionNeeded.includes('Missing Vendor Info')).length;

  return {
    potential1099VendorCount,
    missingW9Count,
    paymentsMissingMethodCount,
    missingVendorInfoCount,
    rows,
    disclaimer: DISCLAIMER,
  };
}

export function format1099ReviewMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}
