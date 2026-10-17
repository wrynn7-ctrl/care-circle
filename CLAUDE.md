# Working rules for Care Circle

You are implementing one phase at a time from `docs/02-build-plan.md`. Read the phase, the matching sections of `docs/01-architecture.md`, and `docs/schema-draft.sql` before writing code. Product decisions are already made in those documents; if something is genuinely unspecified, pick the simplest option that matches the documents' spirit, and record it in `docs/decisions.md` (create it on first use) as a dated one-line entry.

## Non-negotiables

- **Health data never leaves the circle.** Every table with circle data has `circle_id NOT NULL` and RLS enabled with policies that call the helpers in `supabase/migrations`. No table is created without RLS. No policy uses `USING (true)` for authenticated users.
- **No analytics or advertising SDKs.** Crash reporting is Sentry only, with `sendDefaultPii: false`, no session replay, and the scrubber in `src/lib/sentry.ts` applied. Do not add Firebase Analytics, Crashlytics, Mixpanel, Amplitude, Segment, Meta SDK, or similar.
- **Push notification payloads carry no health details.** Titles and bodies are generic ("A refill is due this week"). The app fetches details after open.
- **AI never writes to the record directly.** AI output lands in a `draft` state and a human posts it. Medication changes suggested by AI are shown as suggestions, never auto-applied.
- **No dosing advice, interaction checks, or clinical recommendations** anywhere in UI copy or code. The medications screen carries the record-keeping disclaimer from the architecture doc.
- **Fairness view is visibility, not a scoreboard.** No ranks, no "behind", no red/green by person, alphabetical order.
- **Minimum necessary to AI vendors.** Send only what the Edge Function spec lists. Never send the document vault, expenses, or the full recipient profile.
- **Secrets** live in Supabase Edge Function secrets or `.env.local` (gitignored). Never in source, never in the app bundle except the Supabase anon/publishable key.

## Stack and conventions

- Expo SDK (latest stable) with TypeScript strict mode, Expo Router, TanStack Query, `@supabase/supabase-js`, Zod for every boundary (API responses, forms, Edge Function inputs and outputs).
- Supabase: migrations in `supabase/migrations/*.sql`, one concern per file, every migration idempotent where possible. Edge Functions in `supabase/functions/<name>/index.ts` (Deno).
- Generated DB types in `src/types/database.ts` via `supabase gen types typescript`. Regenerate after every migration; commit the result.
- Feature folders under `src/features/<feature>/` containing `screens/`, `components/`, `hooks/`, `api.ts`, `schema.ts`, `__tests__/`.
- Shared code in `src/lib/` (supabase client, query client, offline queue, sentry, notifications, permissions).
- Tests: Jest + React Native Testing Library for components and hooks; pgTAP (`supabase test db`) for every RLS policy; Deno tests for Edge Functions. A phase is not done until its listed tests pass.
- Accessibility: every interactive element has an accessible label; default font scale is respected (many users are 50–70 years old); minimum touch target 44pt.
- Copy tone: plain, warm, short. "Mom" is never hard-coded; use the recipient's chosen display name.

## Definition of done for a phase

1. All acceptance criteria in the phase are demonstrably met.
2. All listed tests exist and pass: `npm test`, `supabase test db`, `deno test` for functions touched.
3. `npm run typecheck` and `npm run lint` pass.
4. Migrations apply cleanly to a fresh local Supabase (`supabase db reset`).
5. `docs/decisions.md` updated if any decision was made.
6. Commit messages explain why, not just what.
