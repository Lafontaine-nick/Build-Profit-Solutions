# Contractor Test Release Status

## Completed

### Env audit
- `mobile/app.config.js` is the active Expo config and matches EAS project ID `7b85d23d-d01f-48c3-95b0-e1909106a0d0`.
- `mobile/eas.json` has production env values for `production`, but `preview` currently relies on Expo dashboard environment variables and has no plain/sensitive vars configured there.
- `mobile/.env.production.example` expects:
  - `EXPO_PUBLIC_API_BASE_URL`
  - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - optional beta/Yelp/PDF flags
- `backend/render.yaml` expects Render secrets for:
  - `OPENAI_API_KEY`
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `CLERK_SECRET_KEY`
  - `STRIPE_PRICE_BUSINESS`
  - `STRIPE_PRODUCT_PROFESSIONAL`
  - `STRIPE_PRICE_BASIC`
  - `STRIPE_PRICE_PREMIUM`
  - `BETA_FEEDBACK_INTAKE_ENABLED`
  - `BETA_FEEDBACK_ADMIN_KEY`
  - `APP_TELEMETRY_ENABLED`

### Verification gate
- Backend `npm run verify:ai` failed in `backend/verify-ai-assistant-core.js` on the assertion `Bid margin should be 20.0%`.
- Backend `npm test -- --runInBand` failed in `src/services/__tests__/aiAssistantCore.test.js` because `pipeline.dailyBrief.topProfitRisks[0]` was `undefined`.
- Mobile `npm run lint` failed with large repo-wide ESLint configuration/code-style issues, including missing `@typescript-eslint` rule definitions.
- Mobile `npm run type-check` failed with many existing TypeScript errors across screens including `dashboard`, `projects`, `profile`, and `project-detail`.

### Manual smoke focus
- AI Command Center vs project page margin/forecast consistency
- Change orders, expenses, and purchase orders
- Timeline, payments, and `What Needs Attention`
- Auth/session flow and API connectivity against production backend

## Build status

### iOS preview
- Status: finished
- Build ID: `077643f1-e2ed-4283-83b0-9155d84ba59a`
- Artifact: [iOS preview IPA](https://expo.dev/artifacts/eas/VrHig1TDoNrHXk4iuSSVy.ipa)
- Logs: [iOS build logs](https://expo.dev/accounts/nick_lafontaine/projects/build-profit-solutions-mobile/builds/077643f1-e2ed-4283-83b0-9155d84ba59a)

### Android preview
- First build ID `02df99bf-3925-41b2-8f53-e739245b6a16` failed at `:app:mergeReleaseResources`.
- Root cause: `mobile/assets/images/bps-logo-updated.png` was actually a JPEG file saved with a `.png` extension, which caused Android AAPT resource compilation to fail.
- Fix applied: converted `mobile/assets/images/bps-logo-updated.png` into a real PNG.
- Retry build ID: `8e1c0ed7-796c-456e-8d78-d74968360964`
- Retry logs: [Android retry logs](https://expo.dev/accounts/nick_lafontaine/projects/build-profit-solutions-mobile/builds/8e1c0ed7-796c-456e-8d78-d74968360964)
- Status: finished
- Artifact: [Android preview APK](https://expo.dev/artifacts/eas/ixNtNmVW35rowUUA8TByHj.apk)

## Pilot rollout package
- Keep cohort small for the first pass and prioritize contractors who can verify login, AI assistant usage, and forecast accuracy.
- Share both preview artifacts with a very small cohort first:
  - iOS: [preview IPA](https://expo.dev/artifacts/eas/VrHig1TDoNrHXk4iuSSVy.ipa)
  - Android: [preview APK](https://expo.dev/artifacts/eas/ixNtNmVW35rowUUA8TByHj.apk)
- Ask testers to confirm:
  - sign in / session persistence
  - project detail assistant answers
  - Command Center forecast consistency
  - change order profit impact
  - `What Needs Attention`
- Watch backend usage closely for AI volume/cost and beta feedback intake during the pilot.
