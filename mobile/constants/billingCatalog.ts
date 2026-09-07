export const REVENUECAT_ENTITLEMENT_ID = 'founding_full';
export const REVENUECAT_OFFERING_ID = 'founding';

/** App Store subscriptions are registered under the production bundle only. */
export const PRODUCTION_IOS_BUNDLE_ID = 'com.buildprofitsolutions.mobile';

export const APPLE_PRODUCT_IDS = {
  monthly: 'com.buildprofitsolutions.founding.monthly',
  annual: 'com.buildprofitsolutions.founding.annual',
} as const;

/** Shown until App Store pricing is returned for the founding monthly product. */
export const FOUNDING_PROFESSIONAL_FALLBACK_PRICE = '$99/month';

export const FOUNDING_PROFESSIONAL_FEATURES = [
  'Unlimited projects',
  'Build with AI and AI Assistant',
  'Plan/PDF takeoff and photo scope detection',
  'SKU scanning and supplier price lookup',
  'Tax Center and receipt OCR',
  'Contractor-branded estimate PDFs',
  'Job costing, budgets, and change orders',
  'Project photos, daily logs, and calendar tools',
];
