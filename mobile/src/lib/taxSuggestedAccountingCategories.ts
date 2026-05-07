import type { TaxCategory } from '@/src/lib/taxCenter';

/**
 * Editable suggestions only — not tax categories until confirmed with a CPA.
 */
export const SUGGESTED_ACCOUNTING_CATEGORY: Record<TaxCategory, string> = {
  Materials: 'Materials / Supplies',
  Labor: 'Contract Labor',
  Subcontractors: 'Contract Labor',
  'Equipment Rental': 'Equipment Rental',
  'Permits / Plans': 'Licenses & Permits',
  Insurance: 'Insurance',
  'Vehicle / Mileage': 'Car & Truck Expenses',
  'Software / Tools': 'Tools / Small Equipment',
  'Office / Admin': 'Office Expense',
  Other: 'Other Business Expense',
};

export const SUGGESTED_CATEGORY_CONFIRM_NOTE =
  'Confirm final category treatment with your CPA or tax professional.';
