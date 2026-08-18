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
- `gas_line` → `gasLineLf` (LF, explicit plan-verified gas piping only)
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

- Plumbing rough-in points: $150 material + $350 labor per point.
- Standalone trim/hookup: $150 material + $300 labor per hookup.
- Fixture installation/setting: $100 material + $200 labor per fixture.
- Fixture repair: $50 material + $250 labor per repair.
- Drain cleaning: $25 material + $275 labor per service.
- Water line: $8 material + $22 labor per LF.
- Sewer/drain line: $12 material + $38 labor per LF.
- Gas piping: $10 material + $20 labor per LF when explicitly documented.
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

Selected-trade Plan Export also uses a plan-only scope allowlist. It keeps
plumbing rough-in points, trim/hooks, underground water or under-slab piping,
underground sewer/drain or under-slab DWV, and explicitly documented gas piping.
Fixture installations are owned by trim/hooks in Ground Up; fixture replacement
remains available to Notes/manual workflows. Service calls, repairs, drain
cleaning, allowances, and cleanup stay out of Plan Export.

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
`mobile/utils/scopeQuickMeasurements.ts`. Plan Export for ground-up/addition
flows uses five physical concepts: rough-in points, trim/hooks, underground
water/under-slab LF, underground sewer/drain/under-slab DWV LF, and optional
documented gas-piping LF. Fixture setting is included with trim/hooks for Ground
Up. Notes/manual Plumbing flows retain the broader fixture and service cards.
`tradeQuickMeasurementFieldKeys('plumbing')` uses the plan-only keys so service
and allowance entries do not inflate Plan Export confirmation counts. Living
area is not a Plumbing input.

Build With AI now exposes `Single Trade / Plumbing Only` without requiring a
plan import. The route preserves the existing whole-project and Bathroom
Remodel flows, offers Bathroom Remodel Plumbing, New Construction Plumbing,
and Plumbing Service modes, and records whether the work is self-performed,
subcontracted, or based on an existing quote. New Construction Plumbing can
use the plan takeoff; remodel and service modes use notes and site photos.
The standalone route materializes a Plumbing-only checklist before pricing so
unrelated Bathroom cards do not carry into the estimate.

`service_call`, `drain_cleaning`, `parts_materials`, `emergency_fee`, and
`cleanup` remain explicit scope/pricing concepts, but are not Quick Measurement
fields; they are never auto-added from unrelated Plumbing quantities. Cleanup
should use the existing general cleanup scope path when applicable. An
explicitly entered allowance may still flow through the existing generic
allowance pricing behavior.

Focused tests:

- `mobile/__tests__/utils/plumbingPlanConvergence.test.ts`
- `mobile/__tests__/utils/scopeQuickMeasurements.test.ts`
- `backend/src/services/__tests__/plumbingPlanAdapter.test.js`

The mobile tests cover canonical ownership, aliases, Notes/Plan provenance
parity, pricing parity, visible cards, explicit clears, selected-trade Quick
Measurement visibility, and same-plan disagreement handling.
