/** Phase 2 vendor directory — bookkeeping / 1099-readiness support only (not tax advice). */

export type VendorType = 'subcontractor' | 'supplier' | 'consultant' | 'other';

export type W9Status = 'missing' | 'requested' | 'uploaded' | 'verified';

export type Vendor = {
  id: string;
  userId: string;
  businessName: string;
  legalName?: string;
  vendorType: VendorType;
  email?: string;
  phone?: string;
  address?: string;
  w9Status: W9Status;
  w9FileUri?: string;
  defaultCategory?: string;
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
