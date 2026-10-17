# Care Circle: Phased build plan (sized for Sonnet)

Each phase is one coherent unit of work that Sonnet can complete from this document plus `01-architecture.md` and `schema-draft.sql`, without product decisions. Phases are ordered so that **Phase 1 is a usable MVP for Michael's family** (circle, roles, invites, calendar, tasks, medication list) and each later phase adds one feature area end to end.

Sizing: a "session" is one focused Sonnet run with a fresh context. Phases list how many sessions to expect; if a phase runs long, split at the sub-phase boundaries (1A, 1B, ...) which are designed as stopping points.

How to hand a phase to Sonnet: paste the phase text, point at the architecture sections it cites, state the Expo SDK version and Supabase CLI version in use, and ask for the Definition of Done in `CLAUDE.md`.

---

## Phase 0: Foundations (2 sessions)

**Goal:** a running app skeleton and a local Supabase stack with CI, so every later phase is only features.

**Scope**
- Expo project (TypeScript strict, Expo Router, dev client), EAS config for Android internal distribution.
- Supabase project linked; local stack via Supabase CLI; `supabase/migrations/0001_extensions.sql` (pgcrypto, pg_cron), `0002_schema_app.sql` (schema `app`, enums), `0003_profiles.sql` with the `auth.users → profiles` trigger.
- Auth: email one-time code sign-in, Google, Sign in with Apple (Apple can be stubbed on Android build but code present). Session in secure store. Signed-out / signed-in route groups.
- `src/lib/supabase.ts`, `queryClient.ts` with MMKV persistence (encryption key in secure store), `sentry.ts` with scrubber, `i18n/en.json`, `src/ui/` base components and theme (large-text safe).
- Tooling: ESLint, Prettier, Jest + RNTL, pgTAP harness (`supabase test db`), GitHub Actions running typecheck, lint, Jest, and `supabase db reset && supabase test db` on a Postgres service.
- Type generation script `npm run db:types`.
- **Screenshot tooling** (`npm run screenshots`): `scripts/screenshots/run.ts` starts Expo web (`expo start --web` or `expo export --platform web` served statically) against the local Supabase stack seeded by `supabase/seed.sql`, signs in as the seeded host, then uses Playwright (Chromium) to visit every route in `scripts/screenshots/screens.json` at 390×844 and 412×915 with device scale factor 2, and writes `docs/screenshots/<route-slug>.<width>.png`. Each entry in `screens.json` names the route, the seeded user to sign in as, and any setup action (e.g. open a specific task). The script fails if a route listed is missing or renders an error boundary. A `screenshots` CI job runs it on every PR and uploads the PNGs as an artifact; the PR template has a Screenshots section. Expo web rendering differs from native in small ways; this is a change-review aid, not a visual regression gate.

**Files**
`app.json`, `eas.json`, `package.json`, `tsconfig.json`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `scripts/screenshots/run.ts`, `scripts/screenshots/screens.json`, `docs/screenshots/`, `src/app/(auth)/sign-in.tsx`, `src/app/(auth)/verify.tsx`, `src/app/(app)/_layout.tsx`, `src/lib/*.ts`, `src/ui/*`, `supabase/config.toml`, `supabase/migrations/0001–0003`, `supabase/tests/0001_profiles.sql`, `supabase/seed.sql`.

**Acceptance criteria**
- A fresh clone with documented env vars runs on an Android emulator, signs in with an email code, and shows an empty home screen.
- `supabase db reset` applies migrations; `profiles` row is created on sign-up.
- CI is green on the main branch.
- Sentry receives a test crash with no email or PII in the event (verify by reading the event).
- `npm run screenshots` produces PNGs for the sign-in and empty-home routes at both sizes, committed under `docs/screenshots/`.

**Tests**
- pgTAP: profiles trigger creates a row; RLS enabled on every table in `public` (generic test that fails if any table lacks RLS).
- Jest: `sentry.ts` scrubber removes emails and known field names from breadcrumbs; `queryClient` persists and restores a query.

---

## Phase 1: MVP (5–6 sessions)

The MVP Michael's family can use. Sub-phases are stopping points.

### 1A. Circles, roles, invites (1–2 sessions)

**Scope**
- Migrations: `households`, `circles`, `circle_settings` (with all module toggles from architecture §4.3), `circle_members`, `invites`, `recipient_profile`, `contacts`, helper functions, policies from the draft, `app.create_circle()` and `app.link_circles()` RPCs, `updated_at` trigger utility.
- Edge Function `accept-invite`: takes the raw token, hashes, validates expiry and status, inserts membership for the caller, marks accepted. Invites are sent as a share link (system share sheet with a prefilled message) rather than email to avoid an email vendor at MVP; the link deep-links into the app (Expo Router + `scheme`).
- **Setup wizard** (architecture §13), one question per screen, every answer editable later in Settings: recipient's display name → consent basis → "Will {Name} use the app?" (with the plain description of recipient access and a note that participation can be turned off any time) → "What do you want to use Care Circle for?" (module toggles, basics pre-selected) → "Are you caring for more than one person?" (creates a linked second circle in the same household and offers to invite the same people to it) → invite people.
- Screens: circle home (tab bar reflects toggles), members list, invite member (role picker with plain-language descriptions; the owner is called **Host** in all copy; `full` members see the invite button only when `full_members_can_invite` is on), accept-invite route, circle switcher that groups linked circles, leave circle, transfer host (owner only), remove member (owner only), link an existing circle (owner of both).
- Role-based UI gating utility `src/lib/permissions.ts` mirroring the matrix (tests compare it to a fixture of the matrix).

**Acceptance criteria**
- Owner creates a circle, generates an invite link for `full`, a second account accepts it and sees the circle.
- A `friend` invite accepted by a third account sees nothing but an empty updates placeholder.
- Wizard answered "No" to recipient participation: no recipient invite option is shown; turning it on later in Settings shows it; turning it off deactivates an existing recipient membership (pgTAP: deactivated recipient gets zero rows).
- Wizard creates a linked second circle: both appear grouped in the switcher; a member of only one circle sees only that one (pgTAP: no cross-circle rows via the household).
- A `full` member cannot create an invite unless `full_members_can_invite` is on (pgTAP both ways).
- A user who is not a member and knows a circle id gets zero rows from every table (pgTAP).
- Owner cannot be removed; ownership transfer swaps roles atomically (SQL function).

**Tests**
- pgTAP for every policy on these tables × roles {owner, full, viewer, aide, recipient, friend, non-member, anon}.
- Deno test for `accept-invite`: expired, revoked, reused, wrong user, happy path.
- Jest: `permissions.ts` matches the matrix fixture.

### 1B. Medication list (1 session)

**Scope**
- Migrations: `medications`, `medication_history` + trigger that writes before/after on update; activity_log entries.
- Screens: med list (active / stopped tabs), med detail, add/edit form (name required; dose, form, schedule, reason, prescriber, pharmacy, refill due date, refill assignee, remind-days-before), stop medication (sets `stopped_on`, `is_active=false`), history view.
- **Disclaimer** shown on first open of the med list and permanently in the list footer: "This is a record kept by your family for coordination. It is not medical advice. Always follow the prescriber's and pharmacist's instructions."
- Refill reminders: pg_cron job `refill_scan` runs daily 13:00 UTC, finds meds with `refill_due_on - refill_remind_days_before <= today` and `refill_last_notified_on` not today, inserts activity_log "Refill coming up" and calls Edge Function `send-push` (generic text: "A refill is due soon. Open Care Circle for details.") to the assignee (or all `full` members if unassigned). Push via Expo push service; `push_tokens` registered on login.

**Acceptance criteria**
- Add, edit, stop, and view history of a medication; a `viewer` can see but not edit; `aide` sees no meds tab.
- Refill reminder fires in a local test by setting the clock (pgTAP calls the scan function directly) and notification text contains no med name.

**Tests**
- pgTAP: policies; history trigger; `refill_scan()` selects the right rows and is idempotent for a day.
- Jest: med form Zod schema, list filtering, disclaimer shows once then in footer.

### 1C. Appointments and calendar (1 session)

**Scope**
- Migration: `appointments` + activity_log triggers.
- Screens: month/agenda calendar (agenda-first; month grid secondary), appointment detail, add/edit (title, date/time with zone, location, provider contact, **who's taking {Name}**, notes), "Add to my phone calendar" via `expo-calendar` (device calendar write permission requested only on tap).
- Reminders: generic push 24h before to the driver ("You're driving tomorrow. Open Care Circle for details.").

**Acceptance criteria**
- Create an appointment, assign a driver, both siblings see it live (Realtime) within seconds.
- Aide sees appointments and the driver, not notes marked private (notes field is simply visible to aide in MVP; **decision:** aide sees logistics only, so notes column is excluded from the aide select via a view `appointments_aide` or column-level grant; Sonnet picks the view approach).

**Tests**
- pgTAP: policies incl. aide; reminder selection function.
- Jest: timezone rendering (an appointment at 09:00 America/Chicago shows 09:00 for a viewer in America/New_York with "CT" suffix).

### 1D. Tasks (1 session)

**Scope**
- Migrations: `tasks`, `task_comments`, aide column-restriction trigger, activity_log triggers (created, completed).
- Screens: task list (Open: mine / everyone; Done), task detail with comments, add/edit (title, details, assignee, due, effort bucket optional), swipe to complete, "Make this a task" from an appointment.
- Push to assignee on assignment (generic).

**Acceptance criteria**
- Full member assigns a task to the aide; aide can mark it done and comment, cannot edit the title (DB rejects).
- Completing a task writes an activity_log row attributed to the completer (fairness depends on this).

**Tests**
- pgTAP: policies; aide trigger rejects non-status updates; activity rows.
- Jest: list sections, optimistic complete rolls back on error.

### 1E. Offline, realtime, polish, internal release (1 session)

**Scope**
- Realtime subscriptions per §6 in `src/lib/realtime.ts`, wired to query invalidation.
- Offline: `onlineManager` + mutation persistence; stale banner; queued-writes indicator; replay test.
- Biometric app lock (§3) with blurred app switcher.
- Settings: profile name, notifications toggle, app lock toggle, sign out; **Circle settings (host only):** every module toggle from §4.3, recipient participation, who can invite, linked circles. Turning a module off hides its tab and its home-screen items; data is untouched.
- Device screenshots: a Maestro flow (`.maestro/screenshots.yaml`) run against the Android emulator captures the same routes as `screens.json` into `docs/screenshots/android/`; run before each internal release. Where web and emulator captures differ, the emulator is the truth.
- Android internal build via EAS; onboarding doc `docs/family-beta.md` for Michael's family (how to install, what to expect, how to report a problem).

**Acceptance criteria**
- Airplane mode: open app, see cached meds/tasks/appointments, complete a task, add a med; reconnect; both changes appear on another device.
- App lock engages after 2 minutes in background; wrong biometric leaves data hidden.
- Four family members use the build for a week; issues logged in GitHub.

**Tests**
- Jest: offline queue replays in order and dedupes; lock state machine.
- Manual checklist in `docs/family-beta.md`.

---

## Phase 2: Updates feed, activity, fairness (2 sessions)

**Scope**
- Migrations: `updates`, `fairness_summary` view (`security_invoker`), `show_fairness` setting plumbing.
- Home "Today" list spans linked circles in the same household (next appointments and due tasks across both, each row labelled with the circle name).
- Feed screen: updates (team) interleaved with activity_log items ("Dana completed 'Call insurance'"); compose update with audience picker (family_friends gated by Plus; in trial it's available); friends see only their audience and author display names.
- Fairness screen per §9 (30/90-day toggle; alphabetical; equal-weight rows; explanatory copy; owner hide switch).
- Push on new team update (generic: "New update in {circle name}").

**Acceptance criteria**
- Friend account sees exactly the family_friends posts and nothing else (pgTAP + manual).
- Fairness numbers match a seeded scenario fixture (pgTAP asserts the view output).
- No ranking UI; snapshot test guards ordering is alphabetical.

**Tests**
- pgTAP: updates policies; view output for fixture; view respects RLS (friend gets zero rows).
- Jest: feed interleaving by time; audience picker gating; fairness rendering.

---

## Phase 3: Voice memo visit notes with AI summary (3 sessions)

**Scope**
- Migration: `visit_notes`, bucket `visit-audio` + storage policies. The bucket is **transit storage**: the Edge Function deletes the object when the note reaches `draft` unless `circle_settings.keep_visit_audio` is on (architecture §10.6).
- Recording UI (§10.1): from appointment detail or standalone; pause/resume; max 20 minutes; local save; upload with retry; status chips.
- Edge Function `visit-note-process` (§10.3–10.5): JWT-scoped membership check, service-role download, STT vendor adapter `_shared/stt.ts`, Anthropic call with `messages.parse` + Zod `VisitSummarySchema`, `fallbacks: "default"`, status transitions, generic push, structured error to `error` column. Secrets: `ANTHROPIC_API_KEY`, `STT_API_KEY`.
- Review screen: editable summary sections; "Create tasks" multi-select from follow-ups; "Review medication changes" opens med editor pre-filled, one at a time, with the suggestion shown as a quote; **Post to the team**. Posted note appears in feed and under the appointment.
- Audio: per-device preference "Keep my voice memos on this phone" (off by default) stores an encrypted local copy playable only by the author; with `keep_visit_audio` on, "Listen to original" works for the team from the server. Delete audio (local and/or server) keeps the transcript. Transcript view; delete transcript (author or host).
- Plus gating: invoking the function requires `app.circle_is_plus` (checked in the function); UI shows paywall otherwise.

**Acceptance criteria**
- A 5-minute memo produces a draft within 2 minutes; nothing is visible to the team until posted.
- Payload sent to Anthropic contains only the fields listed in §10.2 (Deno test asserts on a captured request).
- A failed vendor call leaves status `failed` with a retry button; retry works.
- Default settings: after a note reaches `draft`, the Storage object is gone (verified) and no local copy exists; transcript and summary remain.
- With the local-copy preference on, the author can play the memo offline and no other member can fetch it.
- With `keep_visit_audio` on, the object remains and `viewer` can play it; turning the toggle off later does not delete existing audio (host deletes explicitly).

**Tests**
- Deno: function with mocked STT and Anthropic clients: happy path, STT failure, Anthropic refusal path, non-member caller rejected, non-Plus circle rejected, payload minimization assertion, Zod schema rejects malformed output, audio object deleted at `draft` unless `keep_visit_audio`.
- pgTAP: visit_notes policies (recipient sees only posted), storage policies.
- Jest: recorder state machine; review screen edits persist to `summary_edited`; med suggestion never writes without confirmation.

---

## Phase 4: Documents, contacts, emergency sheet (2 sessions)

**Scope**
- Migration: `documents`, bucket `documents` + policies; contacts already exist (1A) — add contact detail/edit screens if not complete.
- Vault: list by kind, upload from camera/photo/file picker (single-item pickers), preview (image/PDF), expiry date with 30-day reminder (generic push), `show_on_emergency_sheet` flag.
- Emergency sheet (§11): screen, HTML template `src/features/emergency/template.ts`, PDF via `expo-print`, share sheet; encrypted on-device cache file updated on every relevant change; lock-screen long-press entry; PDF export gated by Plus (on-screen free).

**Acceptance criteria**
- Sheet renders with meds, conditions, allergies, physicians, pharmacy, insurance card images, proxy contact, and the "prepared by family" header; opens in airplane mode with app locked via the emergency entry after device PIN.
- Document upload blocked for non-Plus after trial (DB rejects; UI shows paywall); reads still work.

**Tests**
- pgTAP: documents + storage policies incl. Plus gating on insert only.
- Jest: template renders all sections and omits empty ones; cache file is rewritten after a med change (mock FS); PDF export gating.

---

## Phase 5: Shared expenses (2 sessions)

**Scope**
- Migrations: `expenses`, `expense_splits`, `settlements`, bucket `receipts`; balance function `app.balances(circle_id)` returning net per member pair (simplified to minimal transfers).
- Screens: expense list by month, add expense (amount, payer, description, category, date, receipt photo, split: equal among selected members / custom amounts), balances screen ("Dana owes Sam $42.10"), settle up (records a settlement), monthly CSV export (share sheet).
- Plus gating on writes.

**Acceptance criteria**
- Splits always sum to the amount (DB constraint via trigger).
- Balances match a fixture of 10 expenses and 2 settlements.
- Receipts are only visible to the circle (storage policy test).

**Tests**
- pgTAP: split-sum trigger; `balances()` fixture; policies.
- Jest: split calculator (equal with rounding to cents, custom), CSV output.

---

## Phase 6: Monetization, export, deletion, store readiness (3 sessions)

**Scope**
- RevenueCat: products and entitlement set up (Michael does dashboard steps from a checklist in `docs/revenuecat-setup.md` that Sonnet writes), `react-native-purchases` init with Supabase user id, paywall via `react-native-purchases-ui`, restore purchases, Edge Function `revenuecat-webhook` → `circle_subscriptions`, trial banner, lapse → read-only behaviour verified.
- Export: Edge Function `export-data` (ZIP of JSON + files → private path → 24h signed URL), Settings entry, `export_jobs`.
- Deletion: account deletion flow (immediate, re-auth required), circle deletion with 7-day grace (`deletion_requests` + cron executor), both with clear copy; former-member attribution.
- Privacy policy and terms screens (webview to hosted pages + in-app links), consent review screen, "What we share and with whom" page listing the vendors from §13.
- Store prep: Android Data safety answers draft, Google Play Health apps declaration draft, Apple privacy labels draft, permission rationale strings, Sign in with Apple verified, iOS build via EAS, TestFlight.

**Acceptance criteria**
- Sandbox purchase on Android unlocks Plus for the circle on all members' devices within a minute (webhook path), restore works on a reinstall.
- Expired trial + no subscription: adding a document is rejected, viewing and exporting works.
- Export ZIP opens and contains every table's rows for the circle and every file.
- Account deletion removes auth user, profile, tokens; authored content shows "Former member".

**Tests**
- Deno: webhook signature/auth check, event → status mapping, idempotency; export includes all tables (fixture) and nothing from another circle; deletion executor.
- pgTAP: `circle_is_plus` for trial/active/grace/expired; grace-period cancel.
- Jest: paywall triggers on gated actions; banner timing.

---

## Phase 7: Hardening and iOS launch (2–3 sessions)

**Scope**
- Security review pass: run Supabase advisors; verify no table lacks RLS (already tested), no `security definer` function callable by `anon`, storage buckets private, rate limits on Edge Functions, invite token entropy, dependency audit.
- Client-side encryption for the document vault (§14.3): per-circle key, per-member wrapped keys, recovery code shown once and confirmed, encrypt before upload / decrypt after download, migration path for existing documents (re-upload encrypted in background). Clearly labelled in privacy policy.
- Optional TOTP MFA in settings.
- Performance pass on large-text accessibility settings; screen-reader labels audit.
- iOS App Store submission with the compliance checklist completed.

**Acceptance criteria**
- Encrypted documents are unreadable when downloaded with the service role (test decrypts fails without key); a newly invited member can open them after the inviter's device wraps the key.
- Advisors show no critical findings.

**Tests**
- Jest: crypto round-trip, key wrapping, recovery-code restore.
- Deno: service-role download yields ciphertext.
- Manual: accessibility checklist in `docs/accessibility.md`.

---

## After Phase 7 (not planned in detail)

Shared family notes/wiki; recurring tasks; medication "taken today" log (carefully: this edges toward adherence tracking and surveillance, needs a dignity review); facility/aide shift schedule; Spanish localization; multi-recipient circles.
