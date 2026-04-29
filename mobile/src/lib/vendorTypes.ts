/** Phase 2 vendor directory — bookkeeping / 1099-readiness support only (not tax advice). */

export type VendorType = 'subcontractor' | 'supplier' | 'consultant' | 'other';

/** Subcontractors, consultants, and “other” use the full bookkeeping / W-9 workflow; suppliers are simplified unless flagged for CPA review. */
export function isReviewableVendorType(vendorType: VendorType): boolean {
  return vendorType === 'subcontractor' || vendorType === 'consultant' || vendorType === 'other';
}

export type W9Status = 'not_applicable' | 'missing' | 'requested' | 'uploaded' | 'verified';

/** Default W-9 tracking behavior by vendor type (users can override per vendor). */
export function defaultW9StatusForVendorType(vendorType: VendorType): W9Status {
  return vendorType === 'supplier' ? 'not_applicable' : 'missing';
}

export type Vendor = {
  id: string;
  userId: string;
  businessName: string;
  legalName?: string;
  vendorType: VendorType;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  w9Status: W9Status;
  w9FileUri?: string;
  /** BPS tax category label when this vendor is the usual payee for that bucket. */
  defaultCategory?: string;
  /** Typical payment method for this vendor (check, card, ACH, etc.). */
  defaultPaymentMethod?: string;
  notes?: string;
  /** When true, include this vendor in Potential 1099 Review and W-9 checks even if type is supplier. */
  requires1099Review?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Placeholder for future backend-driven accounting / 1099 provider links. Do not store OAuth tokens in the app. */
export type AccountingIntegrationProvider =
  | 'quickbooks'
  | 'xero'
  | 'stripe'
  | 'track1099'
  | 'tax1099';

export type AccountingIntegrationStatus = 'not_connected' | 'connected' | 'error';

export type AccountingIntegration = {
  id: string;
  userId: string;
  provider: AccountingIntegrationProvider;
  status: AccountingIntegrationStatus;
  connectedAt?: string;
  lastSyncAt?: string;
};
