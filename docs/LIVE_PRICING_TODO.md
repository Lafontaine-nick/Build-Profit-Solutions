# Live pricing — next sprint

Wire supplier/catalog APIs into **Suggest rough prices** as source #4; keep **National Trade Average** as the labeled fallback for material gaps and labor.

## Prerequisite

- [ ] `curl "http://localhost:3001/api/sku/search?store=hd&zip=YOUR_ZIP&q=baseboard+mdf"` returns non-mock `dataSource` (fix `SERPAPI_KEY` / plan first — see `backend/API_KEYS_SETUP.md`, `REAL_PRICING_SOLUTION.md`).

## Implementation checklist

1. [ ] Extract `backend/src/services/sku/skuSearchService.js` shared by `routes/sku.js` and pricing engine.
2. [ ] Implement `backend/src/services/pricingEngine/sources/supplierPricing.js` → call sku search; **material only**; return `available: false` when `dataSource === 'mock'`.
3. [ ] Map scope → SerpAPI query (baseboard LF, laminate/tile sqft, etc.) + convert pack price to $/LF or $/sqft.
4. [ ] Blend rates in `pickRecommended` / `getPricingProposal.js`: supplier **material** + saved/national **labor** on same scope row.
5. [ ] Require bid **ZIP** on suggest rough (already passed from `estimate-generator.jsx`); skip supplier when missing.
6. [ ] Cache SKU results by `zip|store|query` (24–72h TTL) to protect SerpAPI quota.
7. [ ] UI: comparison row **Supplier Pricing** shows real total when live; disclaimer when mock skipped.
8. [ ] Tests: supplier available with mocked sku service; falls through to `national_trade_average` when mock/empty.

## Priority order (unchanged)

1. Saved pricing library  
2. Saved bid templates  
3. Company defaults (only if `companyDefaultRates` configured)  
4. **Supplier pricing** ← build this  
5. National Trade Average  
6. AI rough fallback  

## Files to touch

| Area | Path |
|------|------|
| Stub to replace | `backend/src/services/pricingEngine/sources/supplierPricing.js` |
| Orchestrator | `backend/src/services/pricingEngine/getPricingProposal.js`, `recommend.js` |
| SKU API | `backend/src/routes/sku.js` → shared service |
| Mobile rough call | `mobile/utils/estimateAiDraftPricing.ts`, `estimate-generator.jsx` |

## Out of scope for v1

- Live **labor** from Home Depot/Lowe’s (use saved pricing or national midpoints).
- RSMeans / construction cost database (`costDatabase.js` stub).
