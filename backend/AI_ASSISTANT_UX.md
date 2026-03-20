# AI Assistant — UX & trust rules (Tesla-level polish)

## Financial replies — 5-point checklist

Every answer that includes money or margin should satisfy:

1. **Metric name** — Say whether it’s spend-to-date, projected at completion, or bid/estimate margin.
2. **Scope** — Single project vs portfolio vs active-only.
3. **Project** — Which job(s) the numbers apply to (or “all projects in this view”).
4. **Data source** — Numbers come from the **app snapshot** sent with the request; not implied real-time unless you add server-backed freshness later.
5. **Next step** — One concrete follow-up (timeline, receipts, margin detail, or portfolio compare).

## Optional client fields (trust)

The **mobile app** stamps **`snapshotAt`** (ISO string) on every AI request context at send time, so footers can say “data as of [local time]”.

Aliases the backend also accepts:

- `dataAsOf`  
- `contextTimestamp`  

## Regression

- `npm run verify-ai-core` — core math, intents, compare pipeline.

## Streaming parity

Portfolio shortcuts (`where am I losing money`, over-budget list, compare active, worst margin) use the same `runCompareProjectsPipeline` as the `compare_projects` tool.
