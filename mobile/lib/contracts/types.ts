/**
 * Contract Document Types
 * Defines the structure for generating professional construction contracts
 */

export interface ContractDoc {
  summary: {
    contractId: string;
    projectName: string;
    siteAddress: string;
    unitPrice?: number;
    totalBid: number;
    durationDays: number;
    startDate: string;
    endDate?: string;
    expiresDate?: string;
    retainagePct?: number;
    version?: string;
  };
  contractor: {
    contactName?: string;
    legalName?: string;
    licenseNo?: string;
    phone?: string;
    email?: string;
    insurer?: string;
    glLimit?: string;
    wcActive?: boolean;
    brandColorHex?: string;
    logoUrl?: string;
  };
  owner: {
    legalName?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  scope: {
    bullets: string[];
    description?: string;
    inclusions?: string[];
    exclusions?: string[];
    ownerResponsibilities?: string[];
    materialLineItems?: MaterialLineItem[];
    laborLineItems?: LaborLineItem[];
  };
  allowances?: Allowance[];
  milestones: Milestone[];
  terms: Terms;
  labor?: number;
  materials?: number;
  overhead?: number;
  permitCosts?: number;
  profitMarginPct?: number;
}

export interface Allowance {
  name: string;
  amount: number;
  description?: string;
}

export interface Milestone {
  id: string;
  name: string;
  percentage?: number;
  percent?: number; // alias for percentage
  paymentAmount?: number;
  amount?: number; // alias for paymentAmount
  description?: string;
  scheduledDate?: string;
  dueDate?: string; // alias for scheduledDate
  status?: string;
}

export interface MaterialLineItem {
  description: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  mode?: string;
  materials?: number;
  labor?: number;
  category?: string;
  section?: string; // For grouping items like "Tile & Waterproofing", "Framing", etc.
}

export interface LaborLineItem {
  description: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  /** In-app labor uses `hours` for both hourly hours and per-sq-ft square footage. */
  hours?: number;
  rate?: number;
  mode?: string;
  labor?: number;
  materials?: number;
  category?: string;
}

export interface Terms {
  lateInterestPct?: number;
  suspendDays?: number;
  cureDays?: number;
  convDays?: number;
  convFeePct?: number;
  escalationThresholdPct?: number;
  warrantyYears?: number;
  stateLaw?: string;
  workHours?: string;
  permitsBy?: string;
  permitFeesPaidBy?: string;
}



