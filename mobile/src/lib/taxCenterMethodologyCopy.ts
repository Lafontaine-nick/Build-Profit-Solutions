/** Shared CPA-facing methodology / disclaimer blocks (exports + in-app). */

export const TAX_CENTER_METHODOLOGY_TITLE = 'Report Methodology';

export const TAX_CENTER_METHODOLOGY_BODY = `This report uses Cash Basis by default.

Revenue Collected includes payments actually collected during the selected tax year based on the app's current Tax Center logic.

Expenses Paid includes expenses and eligible purchase orders dated within the selected tax year based on the app's current Tax Center logic.

Outstanding Receivables and Committed Costs are shown for review only and may not be included in Cash Basis Net Income unless collected or paid.

Project activity is grouped by the selected tax year. Active projects may appear when they have payments, expenses, invoices, receipts, vendor activity, or other dated activity inside the selected year.

This report is for bookkeeping and tax-preparation support only. It is not tax advice, does not replace a CPA or tax professional, and is not an official tax filing or official 1099 form. Verify all amounts, categories, receipts, vendors, and tax treatment before filing.`;

export const POTENTIAL_1099_REVIEW_EXPLANATION =
  'Potential 1099 review means this vendor may need CPA review based on payment amount, payment method, tax classification, and current IRS reporting rules. This is not tax advice.';
