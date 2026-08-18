# Plumbing Scope Handoff

Status: canonical Plumbing Notes/Voice and Plan Export slice complete.

## Canonical contract

The canonical contract lives in:

- `mobile/utils/subcontractorTrade/plumbingPlanConvergence.ts`
- `mobile/utils/subcontractorTrade/plumbingPricingOwnership.ts`
- `mobile/utils/subcontractorTrade/measurementSchemas.ts`
- `mobile/utils/subcontractorTrade/tradeDefinitions.ts`
- `mobile/utils/subcontractorTrade/tradeAllowlists.ts`

Canonical cards and measurement keys:

- `service_call` → `serviceCallCount` (each)
- `fixture_repair` → `fixtureRepairCount` (each)
- `fixture_replace` → `fixtureReplacementCount` (each)
- `drain_cleaning` → `drainCleaningCount` (each)
- `water_line` → `waterLineLf` (LF)
- `sewer_line` → `sewerLineLf` (LF)
- `plumbing_rough` → `plumbingRoughPointCount` (each)
- `plumbing_trim` → `plumbingTrimHookupCount` (each)
- `parts_materials` → `partsMaterialsCount` (allowance)
- `emergency_fee` → `emergencyFeeCount` (allowance)
- `cleanup` → `plumbingCleanupCount` (allowance)

Explicit quantities only are accepted. Plumbing never derives quantity from
living area, floor area, bath count, or room count.

## Pricing ownership

Generic Plumbing pricing uses the existing Confirm Scope national-average
resolver, with these locked planning rates:

- Rough-in: $150 material + $350 labor per point.
- Standalone trim/hookup: $150 material + $300 labor per hookup.
- Fixture replacement: $100 material + $200 labor per fixture.
- Fixture repair: $50 material + $250 labor per repair.
- Drain cleaning: $25 material + $275 labor per service.
- Water line: $8 material + $22 labor per LF.
- Sewer/drain line: $12 material + $38 labor per LF.
- Service call: $250 labor per trip.
- Parts/materials, emergency fee, and cleanup remain explicit user-entered
  allowances.

Bathroom-specific rough-in and trim pricing remains owned by:

- `mobile/utils/bathroomPlumbingRoughPricing.ts`
- `mobile/utils/bathroomPlumbingTrimPricing.ts`

Those adapters are used only for the Bathroom template. Plumbing rough, trim,
fixture, and line cards have explicit exclusions so the same work is not
silently charged twice.

## Plan Export

Backend extraction is in:

- `backend/src/services/plumbingPlanAdapter.js`
- `backend/src/services/estimatePlanToMeasurements.js`
- `backend/src/services/planImportTradeConfig.js`

The adapter folds common aliases, removes unsupported/inferred quantities, and
retains field confidence and `FROM_PLAN` provenance. Focused Plumbing vision
passes inspect fixture schedules, risers, details, water/sewer plans, and
labeled line lengths.

When the same plan fingerprint is imported again, a silent or changed Plumbing
quantity retains the previous visible value, changes its source to
`needs_confirmation`, marks provenance `pricingEligible: false`, and blocks
suggested pricing. A different fingerprint does not inherit quantities.

## UI and regression coverage

`syncPlumbingScopeItems` promotes positive canonical quantities into visible
Confirm Scope cards and returns explicitly cleared cards to review. The generic
pricing UI receives the physical quantity, exact cents, source/provenance, and
confirmation state.

Standalone Plumbing Quick Measurements are defined in
`mobile/utils/scopeQuickMeasurements.ts`. Both `plumbing` and
`plumbing_service` resolve to the Plumbing-only rows, and
`tradeQuickMeasurementFieldKeys('plumbing')` uses the form-field keys so the
selected-trade UI does not render an empty filtered panel. Living area is not a
Plumbing input.

`parts_materials`, `emergency_fee`, and `cleanup` remain explicit allowances;
they are visible and selectable, and are never auto-added from unrelated
Plumbing quantities. An explicitly entered allowance may still flow through
the existing generic allowance pricing behavior.

Focused tests:

- `mobile/__tests__/utils/plumbingPlanConvergence.test.ts`
- `mobile/__tests__/utils/scopeQuickMeasurements.test.ts`
- `backend/src/services/__tests__/plumbingPlanAdapter.test.js`

The mobile tests cover canonical ownership, aliases, Notes/Plan provenance
parity, pricing parity, visible cards, explicit clears, selected-trade Quick
Measurement visibility, and same-plan disagreement handling.
