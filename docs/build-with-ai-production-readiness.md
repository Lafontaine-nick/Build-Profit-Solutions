# Build With AI Production Readiness

Version: 2026-06-23  
Owner: Build Profit Solutions product/engineering  
Scope: Mobile Build with AI estimate workflow, backend AI assistant route, pricing memory, readiness, and actual-vs-estimated feedback.

## Current Workflow Map

### Primary Screens And Components
- Entry and orchestration: `mobile/app/(tabs)/estimate-generator.jsx`, `mobile/components/AIAssistantModal.tsx`.
- Confirm Scope: `mobile/components/estimate/AIEstimateScopeAssumptionsModal.tsx`.
- Estimate Review: `mobile/components/estimate/AIEstimateDraftReviewModal.tsx`, `AIEstimateDraftReviewCompact.tsx`, `AIEstimateDraftReviewDetails.tsx`, `AIEstimateDraftReviewPricingActions.tsx`.
- Budget vs actuals: `mobile/components/BudgetTab.tsx`, `mobile/components/MaterialsEquipmentScreen.tsx`, `mobile/components/AddTransactionModal.tsx`.
- Proposal/export: `mobile/lib/proposals/*`, `mobile/lib/proposals/ContractPdfDocument.tsx`.

### Core Utilities
- Draft model and parsing: `mobile/utils/estimateAiDraft.ts`, `estimateAiDraftPricing.ts`, `estimateDraftReviewUi.ts`.
- Backend URL/error formatting: `mobile/utils/resolveAiBackendUrl.ts`.
- Quantity/unit intelligence: `mobile/utils/scopeIntelligence.ts`, `scopeItemQuantities.ts`.
- Deterministic formulas: `mobile/utils/scopeFormulaRegistry.ts`.
- Assemblies/scope coverage: `mobile/utils/scopeAssemblyRegistry.ts`.
- Pricing intelligence: `mobile/utils/scopePricingIntelligence.ts`.
- Readiness: `mobile/utils/estimateReadiness.ts`.
- Actual-vs-estimated feedback: `mobile/utils/estimateFeedback.ts`.
- Saved rates/pricing memory: `mobile/utils/contractorPricingMemory.ts`.
- Saved templates: `mobile/utils/estimateSavedBidTemplates.ts`.
- Project financials: `mobile/src/lib/projectFinancials.ts`, `mobile/src/lib/profitForecast.ts`.

### API Dependencies
- AI estimate parsing: backend route under `backend/src/routes/aiAssistant.js`.
- AI draft generation service: `backend/src/services/estimateDraftFromNotes.js`.
- Pricing memory API: `/api/contractor-pricing-memory` via `mobile/utils/contractorPricingMemory.ts`.
- Receipt OCR/import: `mobile/services/receiptOCRService.ts`.
- Auth/workspace: Clerk and workspace APIs in `mobile/services/businessWorkspaceService.ts`.

### Production Risk Notes From Workflow Map
- Mobile AI draft calls currently go through `postAiAssistantJson`; production hardening must verify Bearer auth reaches `backend/src/routes/aiAssistant.js` and that estimate-draft routes reject unauthenticated traffic.
- Pricing memory routes currently need verification that missing or invalid JWTs never fall back to a shared dev identity in production.
- Pricing memory persistence must be verified against durable storage; file-backed storage on hosted ephemeral disks is not production-safe unless backed by a durable sync path.
- Rough pricing failure can degrade into local national-average fallback; production UI must visibly label degraded pricing rather than silently treating it as normal.
- `bps.aiDraftProgress.v1` restores draft state but does not fully restore modal/step UX; this is a recovery gap for autosave/resume.

### Persistence Layers
- Estimate draft and project data are stored through existing project/list contexts and AsyncStorage-backed records.
- Saved bid templates use `bps.savedBidTemplates`.
- Project runtime data uses `bps.project.<id>` and related timeline keys.
- Workspace access cache uses `bps.cachedWorkspaceAccessSnapshot`.
- Pricing memory and saved rates are backend-backed.
- Phase 4A readiness snapshots and Phase 4B feedback outputs are currently typed/evaluated, not yet persisted as durable server records.

### Current Test Stack
- Unit tests: Jest.
- Pure utility test config: `mobile/jest.util.config.js`.
- E2E framework: none found in `mobile/package.json`.
- Release scripts: Expo/EAS scripts in `mobile/package.json`.
- Current full type-check has unrelated existing failures; Phase 5 requires a baseline/no-new-errors gate before production release.

## Required Environment Variables
- `EXPO_PUBLIC_API_BASE_URL` / backend REST base URL.
- `EXPO_PUBLIC_AI_API_URL` / AI backend URL when configured.
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- `EXPO_PUBLIC_APP_ENV`.
- `EXPO_PUBLIC_ENABLE_MOCK_OCR` must remain disabled for production.
- `EXPO_PUBLIC_SENTRY_DSN` is referenced by `mobile/src/config/production.ts`.
- Backend OpenAI/provider keys must never be exposed to mobile.

## Feature Flags
Production rollout must be flaggable for:
- Formula suggestions.
- Assembly notices.
- Pricing intelligence.
- Readiness scoring.
- Actual-vs-estimated feedback.
- Calibration approval/rate version creation.
- New pricing data sources.

Remote kill switch is preferred. If remote flags are unavailable, ship conservative defaults and document app-release rollback.

## Security Controls
- Server-side authorization is required for pricing, estimate export, actual cost, profit, calibration, and company-rate updates.
- AI estimate-draft routes must require authentication, rate limiting, and per-user/company authorization before production launch.
- Pricing memory and pricing-engine routes must fail closed in production when auth is missing or invalid; shared dev-user fallback is a P0/P1 data-isolation risk if enabled in production.
- Prompt input, uploaded files, invoices, and OCR text are untrusted.
- Deterministic validators must remain authoritative over AI output.
- Do not log private walkthrough notes, secrets, internal prompts, full customer data, or private company pricing unless explicitly secured and authorized.
- File uploads must validate extension, MIME, size, count, image dimensions/PDF page count, and storage authorization.

## Permission Checks
Minimum required permission matrix:
- Field: enter actuals, upload receipts, submit time; cannot approve company rates or view profit by default.
- Foreman: confirm mappings and propose calibration; cannot approve company rates.
- Manager: approve saved/project rates where allowed, view cost/profit when authorized.
- Admin/Owner: approve company rates, assumptions, benchmark reviews, and rate versions.
- View-only: no mutation.

Negative permission tests are required before beta.

## Data Integrity And Migration Safety
- All new intelligence metadata must be optional for legacy records.
- Quantity/rate/totals must be finite; negative values are rejected unless explicitly supported.
- Historical estimate/readiness/feedback snapshots are immutable.
- Rate versions must reference parent rate, evidence, user, timestamp, and algorithm version.
- Calibration approval must create a new version instead of mutating historical rate records.
- Migrations must be additive, re-runnable, and rollback-documented.

## Idempotency And Transactions
Retry-sensitive operations require idempotency:
- AI parse request.
- Estimate creation/save.
- Formula acceptance.
- Readiness snapshot creation.
- Actual mapping import.
- Calibration acceptance.
- Rate version creation.
- Invoice/receipt import.

Multi-record operations must be atomic where supported. If storage lacks transactions, use staged writes, duplicate detection, and recovery records.

## Standard Error Handling
Use stable error codes for:
- AI parse timeout/failure/invalid response.
- Unsupported unit or formula failure.
- Pricing lookup failure.
- Save/database failure.
- Permission failure.
- Offline/network failure.
- Snapshot/readiness/feedback/calibration failure.
- Upload/import failure.

User messages must be actionable and must not expose stack traces, secrets, prompts, or database internals.

## Observability
Track sanitized events for:
- AI parse requests/failures/timeouts.
- Invalid AI responses.
- Formula/pricing/readiness/feedback failures.
- National-average fallback usage.
- Silent/local pricing fallback activation.
- Estimate save failures.
- Permission denials.
- Upload/import failures.
- Slow screens and slow API requests.
- Calibration approvals and rate version creation.

Include correlation/request IDs where available.

## Health Checks
Required production health checks:
- API.
- Database.
- AI provider.
- File storage.
- Pricing memory/rate source.
- Authentication provider.
- Background jobs/queues where applicable.

Noncritical failures must degrade gracefully. Manual estimating, saved templates, saved rates, and existing estimates must remain accessible when AI is unavailable.

## Performance Budgets
Initial budgets:
- Confirm Scope initial render after data load: under 1 second.
- Scope intelligence evaluation: under 100 ms for typical estimate.
- Formula evaluation: under 50 ms per item.
- Readiness evaluation: under 100 ms for typical estimate.
- Actual-vs-estimated feedback evaluation: under 150 ms for typical estimate.
- Large estimate review render: under 1.5 seconds.
- Autosave acknowledgement: under 1 second on normal network.

Required large-estimate tests: 25, 50, 100, and 250 scope items.

## Supported QA Matrix
Project types:
- ADU, new home, kitchen, bathroom, addition, roofing, flooring, concrete, sitework, landscaping, plumbing, electrical, HVAC, commercial tenant improvement.

Pricing inputs:
- No price, material/labor split, lump sum, allowance, saved rate, company rate, national average, project quote, mixed sources.

Quantity inputs:
- Notes, Quick Measurements, calculated, AI assumption, saved template, manual override, missing.

Roles:
- Manager, foreman, field, admin/owner.

Network/devices:
- Fast, slow, offline, interrupted, retry; supported iOS, Android, tablet if supported, dark/light mode, dynamic text.

## Release Validation Steps
1. Run focused utility tests for Phases 1-5.
2. Run full Jest suite.
3. Run lint.
4. Run type-check baseline comparison and fail on new Build with AI errors.
5. Run migration/idempotency/data-integrity tests.
6. Run golden workflow fixtures.
7. Run manual smoke on device.
8. Verify feature flags and kill switches.
9. Verify AI draft endpoints reject unauthenticated requests.
10. Verify pricing memory does not use shared dev-user fallback in production.
11. Verify pricing memory is backed by durable storage.
12. Verify no P0/P1 launch blockers.
13. Capture release artifact and rollback plan.

## Production Smoke Suite
- Login.
- Open existing estimate.
- Create Build with AI estimate.
- Parse notes.
- Confirm Scope loads.
- Quick Measurements update.
- Pricing loads.
- Saved rates work.
- Readiness card loads.
- Draft saves/resumes.
- Budget actuals/performance card loads.
- Export opens.
- Monitoring has no critical alerts.

Use a designated test account and cleanup procedure.

## Rollback Procedure
- Disable risky feature flags first.
- Roll back mobile release through store/EAS channel where available.
- Roll back backend AI prompt/schema only to compatible readers.
- Do not delete new metadata during rollback.
- Preserve newly created rate versions, snapshots, and audit records.
- If migration rollback is needed, verify legacy readers still ignore optional metadata.

## Backup And Restore
Before broad launch, run nonproduction restore for:
- Estimate snapshots.
- Project actuals.
- Rate versions.
- Pricing memory.
- Attachments/receipts.
- Audit logs.

Document RPO, RTO, and restore owner.

## Defect Severity
- P0 Critical: data loss, cross-company data exposure, incorrect estimate silently sent, unauthorized pricing access, payment/security issue, app unusable.
- P1 High: major workflow blocked, incorrect totals, saved rates overwritten, bid-ready incorrectly granted, repeated crashes, migration failure.
- P2 Medium: recoverable workflow issue, incorrect warning, missing metadata, UI issue with workaround.
- P3 Low: cosmetic/copy/low-impact edge case.

P0 and launch-blocking P1 defects block production.

## Known Limitations / Launch Blockers
- No dedicated E2E framework is configured yet.
- Full `npm run type-check` has unrelated existing failures; a baseline/no-new-errors gate is required.
- Readiness and feedback outputs are typed/evaluated but need durable persistence/audit-log integration before production claims.
- AI estimate-draft endpoints need production auth/rate-limit verification.
- Pricing routes must remove or strictly disable shared `dev-user-1` fallback outside development.
- Pricing memory storage durability must be confirmed; file-backed storage on Render-style ephemeral disks is a launch blocker.
- Server-side permission enforcement must be verified for pricing, profit, calibration, and exports.
- Remote feature-flag infrastructure is not confirmed.
- Build with AI has no dedicated feature flag confirmed in the current app.
- Migration tests for persisted server records are not yet complete.
- HTTP route/integration tests for estimate-draft endpoints are missing.
- The full modal workflow has no automated E2E coverage yet.
- AI flow analytics are not fully wired for generate/apply/pricing paths.
- Scope progress restore does not automatically reopen the correct modal/step.
- Restore testing has not been performed.

## Post-Release Monitoring
Monitor:
- AI parse success rate and timeout rate.
- Draft save success rate.
- Crash-free sessions.
- Readiness/feedback error rate.
- National-average fallback usage.
- Calibration approval/rejection rate.
- Rate version creation failures.
- Permission denials.
- Support tickets tagged Build with AI.
