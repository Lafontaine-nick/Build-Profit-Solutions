# Pricing Coverage Matrix

Version: 2026-06-23  
Purpose: Launch-readiness view of Build with AI pricing coverage. This is a report, not a claim that all coverage is complete.

Coverage statuses:
- `launch_ready`: Saved/company/project/user pricing works, fallback exists, metadata can describe source/date/region, and no manual-only blocker exists for common cases.
- `covered_with_fallback`: Supported by saved/user/company plus national or rough benchmark fallback, but local/source coverage needs work.
- `partial`: Some material/labor/source coverage exists, but product/spec or region support is incomplete.
- `manual_required`: Manual pricing is currently required for reliable estimate output.
- `unsupported`: Not intended for launch.

| Trade / Scope | Tier | Unit Basis | Material Pricing | Labor Pricing | Installed / Sub Pricing | Geographic Coverage | Freshness Support | Fallback | Status | Notes |
|---|---:|---|---|---|---|---|---|---|---|---|
| Demolition | 1 | sqft / lump sum | Minimal | National/saved | Saved/sub quote | National | Partial | Manual / national | covered_with_fallback | Disposal and cleanup overlap must be reviewed. |
| Excavation | 1 | CY / LF | Partial aggregate/haul-off | Saved/national | Equipment/sub quote | National + launch markets planned | Partial | National / manual | partial | Equipment and haul-off need source-specific coverage. |
| Grading | 1 | sqft / CY | Partial | Saved/national | Sub quote | National | Partial | National / manual | covered_with_fallback | Requires project-specific site assumptions. |
| Utility trenching | 1 | LF / CY | Pipe/bedding partial | Saved/national | Equipment/sub quote | National | Partial | National / manual | partial | Overlap with excavation must remain visible. |
| Concrete flatwork | 1 | sqft / CY | Ready-mix/bagged partial | Saved/national | Installed rate/sub quote | National + commodity-sensitive policy | Partial | National / manual | partial | Short-load, pump, reinforcement need review. |
| Framing | 1 | sqft / LF / each | Lumber SKU/mock coverage exists | Saved/national | Company/sub quote | National / ZIP for SKU lookup | Partial | National / saved | partial | Product package normalization needed before launch-ready. |
| Roofing | 1 | square | Shingle/underlayment partial | Saved/national | Sub quote | National | Partial | National / manual | covered_with_fallback | Disposal/deck repair allowances need source detail. |
| Insulation | 1 | sqft | Partial | Saved/national | Sub quote | National | Partial | National / manual | covered_with_fallback | R-value/spec matching needed. |
| Drywall | 1 | sqft / sheet | Sheet/compound partial | Saved/national | Installed rate | National | Partial | National / saved | covered_with_fallback | Sheet-to-sqft normalization required. |
| Painting | 1 | sqft / gallon | Paint/primer partial | Saved/national | Installed rate | National | Partial | National / saved | covered_with_fallback | Gallon coverage must be confirmed. |
| Flooring | 1 | sqft / box | Product/barcode path exists | Saved/national | Installed rate | ZIP supplier lookup path | Partial | Saved / national | partial | Box-to-sqft and retail-vs-pro labeling required. |
| Tile | 1 | sqft / box | Tile/thinset/grout partial | Saved/national | Installed rate | National | Partial | National / saved | partial | Waterproofing/backer board inclusions need metadata. |
| Cabinets | 1 | LF / allowance | Spec-dependent | Saved/manual | Project quote | National | Manual | Allowance/manual | covered_with_fallback | Reliable external pricing is spec-heavy. |
| Countertops | 1 | sqft | Spec-dependent | Saved/manual | Supplier/sub quote | National | Manual | Allowance/manual | covered_with_fallback | Material/spec and edge/sink cutouts need quote support. |
| Plumbing | 1 | each / hour | Fixture/pipe partial | Saved/company/national | Service/sub quote | National | Partial | National / manual | covered_with_fallback | Minimum charge and permit exclusions must remain visible. |
| Electrical | 1 | each / hour | Device/wire partial | Saved/company/national | Service/sub quote | National | Partial | National / manual | covered_with_fallback | Panel/circuit conditions need review. |
| HVAC | 1 | each / lump sum | Equipment partial | Saved/manual | Sub quote | National | Partial | Quote/manual | covered_with_fallback | Distributor and subcontractor quotes preferred. |
| Landscaping | 1 | sqft / ton / CY / each | Sod/rock/mulch partial | Saved/national | Sub quote | National | Partial | National / allowance | partial | Ton-to-CY requires density; plant specs are variable. |
| Cleanup / disposal | 1 | load / lump sum | Dumpster partial | Saved/national | Service quote | National | Partial | National / manual | covered_with_fallback | Can overlap with demolition and roofing. |
| Masonry | 2 | sqft / each | Partial | Manual/national | Sub quote | National | Partial | Manual | partial | Launch specialty coverage optional. |
| Siding / stucco | 2 | sqft | Partial | Saved/national | Sub quote | National | Partial | National/manual | partial | Spec/weather barrier details required. |
| Windows / doors | 2 | each | Product-specific | Manual | Supplier quote | National | Manual | Quote/manual | partial | External prices should be alternatives only. |
| Finish carpentry | 2 | LF / each | Trim partial | Saved/national | Installed rate | National | Partial | Saved/national | covered_with_fallback | Product grade/finish matching needed. |
| Fencing | 2 | LF | Materials partial | Saved/national | Sub quote | National | Partial | National/manual | covered_with_fallback | Gate/post/terrain assumptions matter. |
| Paving | 2 | sqft | Partial | Manual/national | Sub quote | National | Partial | Manual | partial | Local supplier/sub coverage required. |
| Irrigation | 2 | zone / LF | Partial | Manual/national | Sub quote | National | Partial | Manual/allowance | partial | Design-specific. |
| Equipment rental | 2 | hour / day / week | Rental rate partial | Operator separate | Rental source | National | Partial | Manual | partial | Delivery/fuel/operator flags required. |
| Specialty scopes | 2 | varies | Variable | Variable | Quote | Manual | Manual | Manual | manual_required | Do not force benchmarks. |

## Launch-Market Coverage

| Market | Status | Notes |
|---|---|---|
| St. George / Washington County, UT | partial | ZIP extraction exists; localized source registry required. |
| Salt Lake City metro, UT | partial | Regional labor and supplier benchmarking planned. |
| Las Vegas metro, NV | partial | Requires supplier/market validation. |
| Phoenix metro, AZ | partial | Requires supplier/market validation. |
| National | covered_with_fallback | Existing national fallback remains preliminary. |

## Known Manual-Pricing Requirements

- Highly custom cabinetry.
- Countertops without material/spec/edge/sink details.
- Specialty windows/doors.
- Complex HVAC design.
- Structural steel or engineering-driven work.
- Emergency service premiums.
- Municipal fees without jurisdiction schedule.
- Supplier/subcontractor quotes with expired or unclear inclusions.

## Dashboard Metrics To Expose

- Trade coverage status.
- Region coverage status.
- Source type mix.
- Stale-source count.
- National fallback usage.
- Manual-pricing usage.
- Average source confidence.
- Product match success.
- External-source error rate.
- Pricing lookup latency.
- Largest coverage gaps.
