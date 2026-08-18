# Electrical scope handoff

This scope is the current reference implementation for Confirm Scope and Step 2/Step 3 pricing.

## Locked decisions

- Electrical pricing is component-based: devices/fixtures, circuits/homeruns, hookups, panels, and raceway are separate owners.
- Selected electrical quantities must materialize into visible pricing cards, whether they came from plan import, notes, or manual entry.
- Applied cards must preserve exact cents and show the physical quantity.
- Same-plan repeat imports retain prior electrical readings when the AI is silent or disagrees; those readings are marked `needs_confirmation` until the contractor confirms them.
- A different plan must not silently inherit prior plan quantities.
- Appliance hookups own their named dedicated circuit and connection. Generic circuits and standalone 240V receptacles remain separate and warn on explicit overlap.
- Rough-in packages are mutually exclusive with detailed electrical quantities.
- Electrical attribute controls must update pricing without waiting for the pricing footer or background calculations.

## Current locked fixture/fan rates

- Ceiling fan: `$100 material + $175 labor = $275/EA`.
  - Fixture/hang only.
  - Fan-rated box/bracing, homerun/circuit, and switch/control work are separate.
- Bathroom exhaust fan: `$75 material + $175 labor = $250/EA`.
  - Includes fan unit, standard mounting, and electrical connection.
  - Excludes ducting, roof/wall penetration, exterior termination, HVAC work, and dedicated homerun unless separately selected.

## Important implementation areas

- `mobile/components/estimate/AIEstimateScopeAssumptionsModal.tsx`
  - Confirm Scope rendering, responsive electrical preview state, pricing-card visibility, optimistic Apply behavior, and pending-card footer.
- `mobile/components/estimate/AcceptedPricingSummary.tsx`
  - Applied pricing summary; displays the physical quantity on accepted scope cards.
- `mobile/components/estimate/ElectricalQuickMeasurementTakeoff.tsx`
  - Electrical quick-measurement interactions and local optimistic attribute state.
- `mobile/utils/subcontractorTrade/electricalPlanConvergence.ts`
  - Canonical Electrical cards, aliases, descriptions, and scope ownership.
- `mobile/utils/subcontractorTrade/electricalLightingFanPricing.ts`
  - Locked lighting, ceiling-fan, and bathroom-exhaust-fan pricing.
- `mobile/utils/subcontractorTrade/electricalPricingOwnership.ts`
  - Appliance circuit and 240V receptacle ownership overlap warnings.
- `mobile/utils/subcontractorTrade/electricalCircuitPricing.ts`
- `mobile/utils/subcontractorTrade/electricalHookupPricing.ts`
- `mobile/utils/subcontractorTrade/electricalReceptaclePricing.ts`
- `mobile/utils/subcontractorTrade/electricalServicePanelPricing.ts`
- `mobile/utils/estimateAiDraft.ts`
  - Repeat-plan import stability and electrical provenance.

## Regression coverage

Focused Electrical tests live under `mobile/__tests__/utils/`, especially:

- `electricalLightingFanPricing.test.ts`
- `electricalPlanConvergence.test.ts`
- `electricalPlanExport.test.ts`
- `electricalQuickMeasurementUi.test.ts`
- `electricalCircuitPricing.test.ts`
- `electricalHookupPricing.test.ts`
- `electricalReceptaclePricing.test.ts`
- `electricalServicePanelPricing.test.ts`
- `suggestedPricingCardUi.test.ts`

Before changing Electrical pricing, preserve the ownership boundaries, exact-cent display, manual-entry card flow, and repeat-import confirmation behavior.
