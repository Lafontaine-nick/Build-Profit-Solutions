# Pricing Data Launch Standard

Version: 2026-06-23  
Scope: Build with AI estimate pricing coverage, source selection, supplier/product data, labor data, and launch readiness.

## Current Pricing Architecture

### Current Sources
- Project-specific quote / user-entered pricing: parsed from notes and user edits in the AI estimate flow.
- Saved bid templates: `mobile/utils/estimateSavedBidTemplates.ts`.
- Saved pricing memory and company-style rates: `mobile/utils/contractorPricingMemory.ts` and backend `/api/contractor-pricing-memory`.
- Pricing proposal orchestration: `mobile/utils/estimateAiDraftPricing.ts`.
- Backend pricing engine: `backend/src/services/pricingEngine/*`, including saved pricing, templates, company defaults, supplier pricing, national averages, and rough fallback.
- National fallback tables: local `NATIONAL_TRADE_AVERAGES_LOCAL` and related scope quantity helpers.
- Supplier/product lookup: `mobile/services/productLookupService.ts`, `mobile/lib/products/productScannerTypes.ts`, backend `/api/sku/search`, Home Depot direct lookup, UPC lookup, and product lookup backend route.
- Pricing intelligence metadata: `mobile/utils/scopePricingIntelligence.ts`.
- Actual-cost calibration suggestions and rate versioning: `mobile/utils/estimateFeedback.ts`.

### Preserved Source Priority
1. Current project-specific quote.
2. Current user-entered price.
3. Project-specific saved rate.
4. User saved historical rate.
5. Company or team rate.
6. Current supplier or subcontractor price.
7. Approved internal locally calibrated rate.
8. Localized benchmark.
9. National-average benchmark.
10. Allowance.
11. Manual pricing required.

External pricing must only appear as an alternative when a higher-priority source is already selected.

### Inspection Gaps To Close Before Launch
- Backend supplier pricing can blend live material pricing with saved/template/company/national labor, but source expansion must keep that blend auditable and avoid arbitrary material/labor splits.
- Regional labor and construction cost database sources exist as stubs or partial code paths and are not launch-ready until wired, tested, and licensed.
- Home Depot/store localization currently has weak ZIP-to-store behavior in parts of the stack; source geography must preserve actual resolution instead of implying ZIP-level accuracy.
- Mobile and backend national/static rate tables can drift; Phase 6 pricing data should move toward one versioned source of truth.
- Barcode/product lookup exists in scanner and material-entry flows, but it is not yet a direct Build with AI pricing source.
- Pricing memory durability, production auth, feature-flag rollout, and fallback observability remain launch controls, not just data concerns.

## Priority Launch Markets

No remote launch-market configuration was found. Initial editable launch-market configuration should be treated as data, not business logic:

- `utah_st_george`: St. George / Washington County, UT.
- `utah_salt_lake`: Salt Lake City metro, UT.
- `nevada_las_vegas`: Las Vegas metro, NV.
- `arizona_phoenix`: Phoenix metro, AZ.
- `national`: fallback only.

These markets are starting defaults and must be configurable before launch.

## Launch-Ready Requirements

Minimum launch standard:
- Saved rates work across all priority trades.
- User-entered and project quote pricing remain fully supported.
- National-average fallback remains available and clearly labeled.
- Priority launch markets have either localized, calibrated, or supplier-informed coverage for Tier 1 trades where reliable.
- Material pricing exists for priority material categories where products can be normalized.
- Labor pricing is classified distinctly as wage, burdened cost, crew cost, installed labor, subcontractor rate, or selling rate.
- Source date, geography, and confidence are visible in metadata.
- Retail prices are labeled as retail and not represented as contractor cost.
- External-source failures do not block estimate creation.
- Manual pricing and allowances are always available.
- No source silently overrides a higher-priority user/project/saved/company price.
- Pricing data can be disabled through feature flags.

## Launch Priority Trades

Tier 1:
- Demolition
- Excavation
- Grading
- Utility trenching
- Concrete
- Framing
- Roofing
- Insulation
- Drywall
- Painting
- Flooring
- Tile
- Cabinets
- Countertops
- Plumbing
- Electrical
- HVAC
- Landscaping
- Cleanup

Tier 2:
- Masonry
- Siding
- Stucco
- Windows
- Doors
- Finish carpentry
- Fencing
- Paving
- Irrigation
- Equipment rental
- Specialty scopes

## Material Coverage Categories

Launch coverage should prioritize:
- Sitework/concrete: ready-mix, bagged concrete, reinforcing steel, wire mesh, vapor barrier, aggregate, gravel, sand, topsoil, mulch, rock, drainage/utility pipe, bedding.
- Shell/framing: dimensional lumber, engineered lumber, sheathing, hardware, underlayment, shingles, flashing, siding, stucco materials, doors, windows where reliable.
- Interiors: drywall, compound, bead, insulation, paint, primer, flooring, underlayment, tile, thinset, grout, backer board, waterproofing, baseboard, trim, cabinets/counters where spec reliable.
- Plumbing/electrical/HVAC: common pipe/fittings/fixtures, water heaters, wire, conduit, boxes, breakers, panels, devices, equipment, duct, registers, line sets, thermostats.
- Landscaping/exterior: sod, seed, plants/trees, irrigation components, fence materials, pavers.

Do not claim coverage when source data cannot be normalized.

## Labor Coverage

Supported classifications:
- Base wage
- Burdened labor cost
- Crew cost
- Installed unit labor
- Subcontractor rate
- Customer-facing selling rate

Base wage must not be mixed with customer-facing selling rate. Burden settings must be company-configurable and clearly labeled.

## Product Matching Standard

Match statuses:
- `exact`: SKU or UPC match, same product/spec.
- `strong`: manufacturer/model/category and key spec match.
- `compatible`: correct material class and compatible unit/spec.
- `approximate`: broad category match only.
- `unmatched`: insufficient confidence.

Approximate matches must never be displayed as exact.

## Normalization Standard

Allowed conversions require explicit package/coverage data:
- Box to sqft.
- Sheet to sqft.
- Bundle to roofing square.
- Piece to LF.
- Gallon to paintable sqft.
- Bag to volume when yield exists.
- Ton to CY only with density.

Unsupported conversions must return no normalized price and a review notice.

## Freshness Policy

Freshness is source-specific:
- Live supplier: current for 3 days, stale after 14 days.
- Cached supplier: current for 7 days, stale after 30 days.
- Labor dataset: current for 90 days, stale after 365 days.
- Company/saved rate: current for 180 days, stale after 365 days unless user-confirmed.
- National benchmark: current for 180 days, stale after 540 days.
- Project quote: current until expiration or 30 days by default.
- Commodity-sensitive trades such as concrete, roofing, lumber, fuel/sitework should use shorter windows.

## Fallback Rules

Fallbacks must explain:
- Selected source.
- Why higher-priority source was unavailable or not selected.
- Source date.
- Geography resolution.
- Confidence.
- Manual edit option.

National fallback remains available but must be labeled preliminary.

## Privacy And Licensing

- No scraping without approved source terms.
- Retail/supplier attribution must be preserved.
- Company saved rates, supplier discounts, subcontractor quotes, labor burden, markup, and calibration evidence are company-private.
- Aggregated benchmarks require privacy thresholds, outlier filtering, region/trade/unit segmentation, and no single-company exposure.

## Launch Exit Criteria

Phase 6 can support controlled launch only when:
1. Tier 1 trades have at least fallback coverage.
2. Priority markets have documented localized or calibrated coverage where planned.
3. Saved-rate and manual workflows remain unchanged.
4. National fallback is visible and labeled.
5. External failures degrade safely.
6. Date/geography/source metadata is available.
7. Package normalization is tested.
8. Labor classifications stay distinct.
9. Retail vs contractor pricing is distinct.
10. Private company pricing is isolated.
11. Source terms are reviewed.
12. Coverage matrix is complete.
13. Higher-priority sources are not silently overridden.
14. Historical estimates do not recalculate from refreshed data.
15. Critical pricing tests pass.
