# Launch readiness & contractor beta

Use this as the working checklist before TestFlight / Play closed testing or public launch.  
Nothing here changes app behavior until you configure env vars and run SQL.

## Production mobile build

- [ ] EAS production builds succeed for iOS and Android.
- [ ] Install on **physical devices** and smoke-test auth, tabs, estimate, projects, leads, AI.
- [ ] `EXPO_PUBLIC_API_BASE_URL` (or default production URL) points at the live API.
- [ ] Clerk **production** publishable key in EAS secrets for store builds.
- [ ] Stripe **live** keys only when you are ready for real charges (otherwise test mode).
- [ ] No dev-only URLs in production build profile.

## Backend / database

- [ ] `DATABASE_URL` set on the host (e.g. Render).
- [ ] Run **`backend/database/beta_feedback.sql`** once on production Postgres (creates `beta_feedback` + `app_telemetry_events`). **Easy way:** from `backend/`, run  
  `DATABASE_URL="RENDER_EXTERNAL_URL" npm run migrate:beta-feedback`  
  (External URL: Render Postgres → Connect → External.)
- [ ] Backups enabled or documented restore plan.
- [ ] **Beta feedback intake**: set `BETA_FEEDBACK_INTAKE_ENABLED=true` only while running a beta; set `false` for public launch (app can still ship with feedback UI hidden via `EXPO_PUBLIC_BETA_FEEDBACK_ENABLED`).
- [ ] **Review API**: set `BETA_FEEDBACK_ADMIN_KEY` to a long random secret. Never commit it.
- [ ] **Telemetry** (optional): set `APP_TELEMETRY_ENABLED=true` to persist `trackAppEvent` / `trackProductEvent` to `app_telemetry_events`; otherwise events are no-ops on the server (client still calls safely).

### Review submitted feedback (admin)

```bash
curl -s -H "X-Beta-Feedback-Admin-Key: YOUR_SECRET" \
  "https://YOUR_API_HOST/api/beta-feedback/review?limit=50&status=new"
```

Optional query params: `type` (e.g. `bug`, `ai_response`), `status` (`new`, `reviewing`, … — update rows in SQL as you triage).

## Beta-only in-app feedback (mobile)

Controlled entirely by **client** and **server** flags:

| Goal | Setting |
|------|---------|
| Show UI for testers | EAS: `EXPO_PUBLIC_BETA_FEEDBACK_ENABLED=true` |
| Limit to specific emails | `EXPO_PUBLIC_BETA_FEEDBACK_ALLOWLIST_EMAILS=a@x.com,b@y.com` |
| Accept submissions | Server: `BETA_FEEDBACK_INTAKE_ENABLED=true` |
| Public launch (hide UI) | Omit or `false` client flag; set server intake `false` |

Entry points when enabled:

- Profile → **Legal & Support** → **Beta feedback**
- Small **Beta** pill (FAB) on main routes
- AI Assistant header → **Report** (prefills AI issue)

## Critical QA (manual)

- [ ] Sign up / sign in / sign out
- [ ] Onboarding
- [ ] Estimate steps 1–8, totals and payment schedule display
- [ ] Save estimate → mark won → project carryover sanity check
- [ ] Project: budget, timeline, team, POs, change orders (as in beta scope)
- [ ] AI assistant (estimate + project + command center) — routing only; no prompt changes required for launch checklist
- [ ] Leads flow
- [ ] Settings / profile
- [ ] No hard crashes on tested paths

## Financial trust QA

- [ ] Labels consistent: margin / markup / bid / profit wording
- [ ] Payment schedule percentages sum to 100% where applicable
- [ ] Won → project numbers match expectations on a known fixture

## Store / distribution

- [ ] TestFlight or Play internal/closed track ready
- [ ] Privacy policy URL live
- [ ] Support contact monitored
- [ ] Permission strings accurate (mic, photos for feedback screenshot, etc.)

## Monitoring

- [ ] Crash reporting (e.g. Sentry) recommended before wide beta
- [ ] API uptime check on production URL

## Product analytics (optional wiring)

Event names live in `mobile/lib/analytics/productAnalytics.ts`.  
Call `trackProductEvent(AnalyticsEvent.estimateCreated, { ... })` from the relevant screens when you want usage data; server stores rows only if `APP_TELEMETRY_ENABLED=true`.

At minimum, **feedback_submitted** is sent automatically on successful beta feedback submit.

## Launch scope

- [ ] List features as **beta-visible**, **launch-ready**, or **hidden** so unstable areas are not promoted during beta comms.
