/**
 * Declarative scope pricing behavior — Phase 0 metadata only.
 * Not wired into resolveScopeItemSuggestedPricing or pricing calculations.
 */
export type ScopePricingBehavior =
  | 'INCLUDED_IN_BASE'
  | 'SEPARATE_ADDON'
  | 'ALTERNATE_SYSTEM'
  | 'ALLOWANCE'
  | 'CUSTOM_PRICE'
  | 'NON_PRICED_CONFIRMATION'
  | 'PRICING_GAP';
