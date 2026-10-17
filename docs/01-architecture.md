# Care Circle: Architecture

This document makes the technical decisions so that implementation phases don't have to. Each numbered section is referenced from `02-build-plan.md`. Plain-language "why" notes are marked **Why** so Michael can follow the reasoning without an engineering background.

## 1. Stack decision

### Native vs cross-platform

| Option | What it is | For this project |
|---|---|---|
| Native (Kotlin + Swift) | Two separate codebases | Rejected. Two codebases doubles every phase and Sonnet's work; no feature here needs native-only capability. |
| Flutter (Dart) | One codebase, draws its own UI | Good option. Very consistent look across platforms, excellent offline database libraries. Downsides: a second language (Dart) next to the TypeScript that Supabase Edge Functions require; iOS builds need a Mac or a third-party cloud build. |
| **Expo / React Native (TypeScript)** | One codebase, uses the platform's native widgets | **Chosen.** One language for app, server functions, tests and generated database types. EAS cloud builds produce iOS binaries without a Mac. Mature libraries for everything this app needs (audio recording, PDF, secure storage, biometrics, push, RevenueCat). |

**Why** one language matters here: Michael will read and occasionally edit this code, and Sonnet writes it. Every time the stack switches language, both of them lose context and make more mistakes. TypeScript end to end removes that.

**Tradeoff accepted:** React Native apps occasionally hit a native-module upgrade headache when Expo releases a new SDK. Mitigation: pin the Expo SDK per phase, upgrade only between phases, and use only Expo-maintained or very widely used modules (list in §1.2).

### 1.1 Client

- **Expo SDK** (latest stable at Phase 0), TypeScript `strict`, **Expo Router** (file-based navigation), **development builds** via `expo-dev-client` (Expo Go cannot run RevenueCat or some native modules).
- **State/data:** TanStack Query for all server data; a tiny Zustand store for UI-only state (current circle, app-lock state).
- **Validation:** Zod at every boundary. The same Zod schemas validate forms, API responses and Edge Function inputs.
- **UI:** React Native core components plus a small in-house component set in `src/ui/` (Button, Card, ListRow, FormField, Sheet, EmptyState). No heavy UI kit. Reason: large-text accessibility and a calm look matter more than component variety, and a small kit is easier for Sonnet to keep consistent.
- **Offline cache:** TanStack Query persistence to `react-native-mmkv` with an encryption key held in `expo-secure-store` (§8).

### 1.2 Approved native modules

`expo-router`, `expo-secure-store`, `expo-local-authentication` (biometric app lock), `expo-notifications`, `expo-audio` (recording), `expo-file-system`, `expo-image-picker` and `expo-camera` (receipts, document photos), `expo-document-picker`, `expo-print` (HTML to PDF for the emergency sheet), `expo-sharing`, `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `react-native-mmkv`, `react-native-purchases` + `react-native-purchases-ui` (RevenueCat), `@sentry/react-native`. Anything else needs a one-line entry in `docs/decisions.md`.

### 1.3 Backend: Supabase

| Supabase piece | Used for |
|---|---|
| Postgres + RLS | All structured data. Every circle-scoped table has `circle_id` and policies. |
| Auth | Email one-time code, Sign in with Apple, Google. |
| Storage | Three private buckets: `documents`, `receipts`, `visit-audio`. Object paths start with `circle_id/`. |
| Realtime | Live updates for the current circle (tasks, appointments, feed). |
| Edge Functions (Deno/TypeScript) | AI pipeline, RevenueCat webhook, invite acceptance, data export, account deletion, PDF data assembly. |
| pg_cron | Refill reminder scans, trial expiry, scheduled deletions, audio retention. |
| Vault / function secrets | Vendor API keys. |

**Why not something else:** Supabase gives Postgres (the right database for relational family data), row-level security (the exact mechanism needed for "no circle can see another circle"), realtime and file storage in one place at hobby pricing. Firebase's security rules are weaker for relational data; a custom server adds operations work Michael doesn't want.

### 1.4 Hosting of logic: database first

Rules that protect data live **in the database** (RLS policies, constraints, triggers) rather than in app code, because the app can be bypassed and the database cannot. Edge Functions exist only where a secret or a third-party call is required.

## 2. System overview

```
┌──────────────────────┐        ┌─────────────────────────────────────────┐
│  Expo app (Android,  │  HTTPS │  Supabase project                         │
│  iOS)                │◄──────►│  Auth ─ Postgres(RLS) ─ Storage ─ Realtime│
│  • encrypted cache   │        │             │                             │
│  • offline queue     │        │        Edge Functions (Deno)              │
│  • biometric lock    │        │   visit-note-process  revenuecat-webhook  │
└──────────┬───────────┘        │   accept-invite  export-data  delete-acct │
           │ Expo Push          └────────┬───────────────────┬─────────────┘
           ▼                             │                   │
   APNs / FCM (generic text only)        ▼                   ▼
                                 Speech-to-text vendor   Anthropic API
                                 (no retention)          (zero data retention,
                                                          claude-opus-5-5)
```

## 3. Authentication

- **Methods:** email + 6-digit one-time code (no password to forget, works for older adults better than magic links, which open in the wrong browser), Sign in with Apple (required by Apple if any third-party login is offered), Google sign-in.
- **Sessions:** Supabase session persisted in `expo-secure-store` (never AsyncStorage). Refresh handled by `supabase-js`.
- **App lock:** after first login the app asks to enable biometric/PIN lock (`expo-local-authentication`). Lock engages after 2 minutes in background. Default on, user can disable with a warning. The emergency sheet has a deliberate exception (§11).
- **MFA:** Supabase TOTP MFA offered as optional in Settings from Phase 6. Not required (friction for the audience).
- **Profiles:** `profiles` row created by trigger on `auth.users` insert. Display name, avatar, notification preferences, push tokens in a separate table.
- **Account deletion:** in-app, two-step, executes through an Edge Function with the service role; see §13.

## 4. Roles and permissions model

Roles are per circle. A person can hold different roles in different circles.

| Role | Who | Summary |
|---|---|---|
| `owner` | The sibling who created the circle (transferable). Shown in the app as **Host**. | Everything, plus billing, member management, delete circle. Exactly one per circle. The host is the purchaser and, by default, the only person who adds people. |
| `full` | Siblings, spouse | Read/write everything except billing and deleting the circle. Can invite `viewer`, `aide`, `friend` and `recipient` only if the host turns on `full_members_can_invite`. |
| `viewer` | A relative who wants to follow along | Read everything on the team side. No writes except posting to the team feed. |
| `aide` | Paid caregiver, home health aide | Appointments and tasks only. Can mark tasks assigned to them done, add a comment to a task, see appointment logistics (time, place, who's driving). No meds, documents, expenses, notes, fairness. |
| `recipient` | The parent | Exists only when the host answered yes to "Will {Name} use the app?" at setup (or later in Settings). Their own profile, meds, appointments, contacts, documents, emergency sheet, both feeds. Can post updates. No tasks, fairness or expenses unless the host enables (`circle_settings.recipient_sees_tasks`, `recipient_sees_expenses`). Turning participation off deactivates their membership immediately. |
| `friend` | Extended family and friends | Only updates with audience `family_friends`, the recipient's display name, and nothing else. Cannot see member list beyond authors' display names. |

### 4.1 Permission matrix

R = read, W = create/update, D = delete, own = only rows where they are author/assignee

| Entity | owner | full | viewer | aide | recipient | friend |
|---|---|---|---|---|---|---|
| circle settings, billing | RWD | R | R | – | – | – |
| members, invites | RWD | R (W for non-owner/full roles if `full_members_can_invite`) | R | – | R (names only) | – |
| recipient profile | RW | RW | R | – | R | – |
| medications | RWD | RWD | R | – | R | – |
| appointments | RWD | RWD | R | R | R | – |
| visit notes (audio, transcript, summary) | RWD | RWD (D own audio any time) | R | – | R (summary only, setting) | – |
| tasks | RWD | RWD | R | R, W (status of own) | setting | – |
| fairness view | R | R | R | – | setting | – |
| expenses, settlements | RWD | RWD | R | – | setting | – |
| documents | RWD | RWD | R | – | R | – |
| contacts | RWD | RWD | R | R (phone numbers for appointment providers) | R | – |
| emergency sheet | R + PDF | R + PDF | R | – | R + PDF | – |
| updates (team) | RWD own | RWD own | R, W own | – | R, W own | – |
| updates (family_friends) | RWD own | RWD own | R | – | R, W own | R |
| activity log | R | R | R | – | – | – |

### 4.2 Enforcement

Everything in the matrix is a Postgres RLS policy. The app also hides UI the role can't use, but the database is the authority. Policies call two `SECURITY DEFINER` helper functions (`app.member_role(circle_id)`, `app.is_member(circle_id)`) that read `circle_members` for `auth.uid()`, declared `STABLE` and using `(select auth.uid())` so Postgres evaluates them once per query. Storage policies parse the first path segment as `circle_id` and call the same helpers. Full draft in `schema-draft.sql`.

### 4.3 Module toggles (simple by default, comprehensive on request)

Michael's direction: some families want only basic coordination, others want everything, so as much as possible is switchable. Every feature module is a boolean on `circle_settings`, set in the setup wizard and changeable by the host in Settings:

| Toggle | Default | Controls |
|---|---|---|
| `enable_medications` | on | Medications tab, refill reminders, med section of the emergency sheet |
| `enable_updates` | on | Updates feed (activity items still appear on the home screen) |
| `show_fairness` | on | Fairness view |
| `enable_visit_notes` | on | Voice memo button and visit notes |
| `enable_documents` | on | Document vault (emergency sheet still works without it) |
| `enable_expenses` | off | Expenses and balances |
| `enable_friends_audience` | off | Family-and-friends audience and `friend` role |
| `recipient_participates` | asked at setup | Whether a `recipient` login exists |
| `full_members_can_invite` | off | Whether `full` members may invite non-owner roles |
| `keep_visit_audio` | off | Whether original audio stays on the server for the team (§10.6) |

Calendar, tasks and the circle itself are always on. **Toggles hide UI and stop new writes; they are not security.** RLS stays the authority regardless of toggles, and existing data is never deleted by turning a module off (it reappears when the module is turned back on). The app reads toggles from `circle_settings` and renders the tab bar accordingly.

**Tests:** every policy gets a pgTAP test that sets `request.jwt.claims` to a user of each role and asserts allowed/denied for select, insert, update, delete, including a user from a **different circle** and an anonymous user. This is the single most important test suite in the project.

## 5. Data model

Full DDL in `schema-draft.sql`. Summary of entities:

- `profiles` (1:1 with auth user), `push_tokens`
- `households` (optional grouping that links circles, e.g. Mom's and Dad's; see §5.1), `circles`, `circle_settings`, `circle_members`, `invites`
- `recipient_profile` (1:1 with circle: name, DOB, conditions, allergies, blood type, insurance, pharmacy, proxy contact, notes)
- `contacts` (physicians, pharmacy, facility, insurance, other)
- `medications` (+ `medication_history` via trigger)
- `appointments`
- `visit_notes` (+ status machine: `recording → uploaded → transcribing → summarizing → draft → posted | failed`)
- `tasks`, `task_comments`
- `expenses`, `expense_splits`, `settlements`
- `documents`
- `updates`
- `activity_log` (append-only, filled by triggers; powers the feed's "activity" items, the fairness view, and auditing)
- `circle_subscriptions` (RevenueCat state), `deletion_requests`, `export_jobs`

Conventions: `uuid` primary keys (`gen_random_uuid()`), `created_at/updated_at timestamptz` with an `updated_at` trigger, soft delete (`deleted_at`) only on `medications`, `documents`, `visit_notes` (things people regret deleting); hard delete elsewhere. Money in integer cents. All timestamps UTC; the app renders in the device zone, and appointments store `tz` text so "9:00 at the clinic" stays 9:00 when a sibling in another state views it.

Confirmed by Michael: one recipient per circle. Families caring for two parents use two **linked** circles.

### 5.1 Linked circles (households)

A `household` groups circles that belong to the same family. Linking is offered in the setup wizard ("Are you caring for more than one person?") and in Settings. Rules:

- Membership and RLS stay **per circle**. Linking never grants access; it only lets the app show linked circles together (quick switcher, a combined "Today" list across circles in Phase 2) and offers to invite the same people to the second circle with the same roles.
- At Phase 1 only the host of both circles can link them (the wizard creates the second circle directly in the household). Linking two circles owned by different people (invite-and-accept between hosts) is a later feature, as is Michael's "combine circles later" idea, which would merge two circles' data; the household table is the hook for both.
- A household is visible to anyone who is a member of at least one circle in it, but only the circles they belong to are listed.

## 6. Realtime

Phase 1 uses Supabase Realtime `postgres_changes` subscriptions filtered by `circle_id` for `tasks`, `appointments`, `medications`, `updates`, `visit_notes`. Realtime honors RLS, so a user only receives rows they can select. Each change invalidates the matching TanStack Query key. If a circle ever exceeds what `postgres_changes` handles comfortably (it won't at 2–5 members), switch to Broadcast-from-database triggers; the client code is isolated in `src/lib/realtime.ts` for that reason.

## 7. Offline behaviour

**Why this matters:** siblings check the app from hospital waiting rooms and parking garages. The requirement is "I can always read what I saw last, and anything I write isn't lost."

- **Reads:** TanStack Query cache persisted to MMKV (encrypted with a per-device key from secure store). On launch the app renders cached data immediately, then refetches. Stale indicator ("Last updated 2h ago") appears when offline.
- **Writes:** mutations use optimistic updates and TanStack Query's mutation persistence; `onlineManager` is wired to `expo-network`. Queued mutations replay in order on reconnect. Conflict rule: **last write wins by `updated_at`**, which is acceptable for tasks, appointments and meds in a 2–5 person team. The one exception is marking a task done: it is idempotent and never conflicts.
- **Explicitly offline-first data:** the emergency sheet (§11) is written to an encrypted file on every change so it opens with no network at all, even if the query cache was evicted.
- **Not offline:** recording a voice memo works offline (audio saved locally, uploaded later); the AI summary obviously needs network. Uploads of documents and receipts retry with `expo-file-system` background upload.
- **Not planned now:** a full sync engine (PowerSync, WatermelonDB). Revisit only if conflict complaints appear. Keeping this simple is a deliberate choice for Sonnet-sized phases.

## 8. On-device data protection

- Query cache and emergency sheet file encrypted (MMKV encryption key / `expo-file-system` with the content encrypted by a key in secure store, using `expo-crypto` AES-GCM wrapper in `src/lib/crypto.ts`).
- Session tokens in secure store.
- Screenshots are **not** blocked (families legitimately screenshot the med list for an ER). App-switcher preview is blurred when locked.
- Audio recordings are stored in the app's private directory and deleted locally after successful upload.
- Biometric lock as in §3.

## 9. Fairness view

Computed from `activity_log` and `expenses` by a Postgres view `fairness_summary(circle_id, window_days)` returning, per active member: tasks completed, appointments driven, visit notes recorded, cents paid, effort buckets (if tasks had `effort`). The app renders members in alphabetical order, one row each, with equal visual weight, headed "What everyone has carried in the last 30 days" and a one-line note: "Different kinds of help aren't comparable; this is here so nothing is invisible." No totals row, no ranking, no comparison to average. Owner can hide the view (`circle_settings.show_fairness`).

## 10. AI integration: visit notes

### 10.1 Flow

1. After an appointment, the sibling opens the appointment and taps **Record a voice memo**. Copy says: "Talk through what happened: what the doctor said, any changes, what to follow up on." This is the user's own account after the visit, not a recording of the clinician.
2. Audio is recorded locally (`expo-audio`, AAC, mono, 32 kbps; a 10-minute memo is about 2.5 MB), a `visit_notes` row is created with status `recording`, then uploaded to `visit-audio/{circle_id}/{visit_note_id}.m4a`; status `uploaded`.
3. The client invokes the Edge Function `visit-note-process` with `{ visit_note_id }`. The function verifies the caller is a member with write rights (using the caller's JWT against RLS, **not** the service role, for this check), then:
   a. sets status `transcribing`, downloads the audio with the service role, sends it to the speech-to-text vendor with retention disabled; stores `transcript`;
   b. sets status `summarizing`, calls Claude with the transcript and minimal context; stores `summary` JSON; sets status `draft`;
   c. sends a generic push to the author: "Your visit summary is ready to review."
4. The author reviews and edits the summary in the app, chooses which follow-ups become tasks (each pre-filled, assignee blank) and which medication changes to apply (opens the med editor pre-filled; nothing is applied silently), then taps **Post to the team**. Status `posted`.
5. **Audio is not kept on the server by default.** Once the summary reaches `draft`, the Edge Function deletes the object from the `visit-audio` bucket; the bucket is transit storage, not an archive. The transcript stays attached to the note (it's the team's way to check the summary) and can be deleted by the author or host. Two opt-in toggles change this: a per-device preference "Keep my voice memos on this phone" (off by default) stores an encrypted local copy that only the author can play back, and the circle toggle `keep_visit_audio` (off by default, host only) keeps the original on the server so the whole team can listen. See §10.6.

### 10.2 Minimum necessary payload to AI

Sent to speech-to-text: the audio only.
Sent to Claude: the transcript; appointment title, date and provider **type** (e.g. "cardiology"); the recipient's **first name** only (so the summary reads naturally); the **names only** of current active medications (so "they increased the water pill" can be matched to a name). Not sent: doses, conditions, allergies, DOB, insurance, documents, other members' names, anything from expenses or tasks.

### 10.3 Claude call

- Model `claude-opus-5-5` via `@anthropic-ai/sdk` in the Deno Edge Function, `client.messages.parse` with a Zod output schema (`zodOutputFormat`) so the result is guaranteed to be valid JSON of the right shape. Include the server-side `fallbacks: "default"` parameter with the matching beta header so a safety refusal (unlikely for medical dictation, but possible) re-runs on a fallback model instead of failing silently; surface `stop_reason: "refusal"` as `failed` with a friendly message if the whole chain declines.
- The Anthropic organization must be configured for **zero data retention** (ZDR). Opus-class models are available under ZDR; Fable-class models are not and are therefore not used here. Confirming ZDR in writing is a launch blocker (checklist item).
- Output schema (`VisitSummarySchema`):
  ```
  {
    headline: string,                       // one sentence
    what_the_doctor_said: string[],
    medication_changes: [{ medication_name, change: "start"|"stop"|"increase"|"decrease"|"other", details, confidence: "high"|"medium"|"low" }],
    follow_ups: [{ title, when_hint: string|null }],
    questions_for_next_visit: string[],
    unclear_or_missed: string[]             // things the transcript left ambiguous
  }
  ```
- System prompt (stored in `supabase/functions/visit-note-process/prompt.ts`): you are summarizing a family caregiver's spoken account of a medical visit for the rest of the family; report what was said, never add medical advice, never infer diagnoses; mark uncertainty; use the recipient's first name; keep each item under 25 words. Cost per 10-minute memo is a few cents.
- Cost control: `max_tokens` 4,000 (output is small), `output_config.effort: "low"` is acceptable for this task shape; measure on 20 real memos before raising it.

### 10.4 Speech-to-text vendor

Abstracted behind `supabase/functions/_shared/stt.ts` with one implementation. Candidate vendors: Deepgram, AssemblyAI, OpenAI transcription. Selection criteria, in order: written no-retention / no-training terms available to a small customer; accuracy on medication names; price. The plan assumes a vendor meeting the first criterion exists and names the contract a launch blocker; the code is vendor-swappable in one file.

### 10.5 Edge Function limits

Supabase Edge Functions have a short CPU-time budget per request but a long wall-clock allowance; waiting on vendor HTTP calls is not CPU time, so this pipeline fits. The function streams the audio file to the vendor rather than holding it in memory where possible, and never processes audio itself. If a vendor needs a callback URL, add a second function `visit-note-callback`.

### 10.6 Data locality principle

Michael's direction: data should stay local to the person as much as possible. Applied here: anything only one person needs (their voice memo audio, their drafts before posting, their device preferences) lives on that person's device, encrypted, and is uploaded only transiently when a server-side step needs it. Anything the team needs to share (the posted summary, the transcript used to check it, meds, appointments, tasks) lives on the server under RLS. When a feature can work either way, default to local and offer the server as a toggle.

## 11. Emergency sheet

A read-only screen assembled from `recipient_profile`, active `medications`, physician and pharmacy `contacts`, insurance `documents` (card images), and the proxy contact. Rendered to HTML → PDF with `expo-print`, shared with `expo-sharing`. Cached encrypted on device after every change (§7) so it opens instantly offline. Deliberate exception to the app lock: a long-press on the app-lock screen's "Emergency sheet" button opens the sheet after biometric **or** device PIN, so a sibling can hand their phone to a nurse in two taps. On-screen view is free; PDF export is paid (§12). The sheet header carries: "Prepared by family on {date}. Verify with the patient's physician."

## 12. Subscription and feature gating

- RevenueCat with `react-native-purchases`. App user ID = Supabase user ID. Products: `plus_monthly`, `plus_annual`, entitlement `plus`. One purchaser per circle: the **host** (owner role), who is also the person who adds members by default.
- A subscription belongs to the **purchaser**, but entitles the **circle**: `circle_subscriptions(circle_id, purchaser_user_id, entitlement, status, current_period_end, source)` updated by the Edge Function `revenuecat-webhook` (verifies RevenueCat's webhook auth header). Only the owner can purchase for a circle; if the owner transfers ownership, the subscription stays with the purchaser until it lapses, then the new owner can buy.
- Trial: `circles.trial_ends_at = created_at + 30 days`. A SQL function `app.circle_is_plus(circle_id)` returns true if in trial or an active subscription exists.
- Gating: **writes** to paid tables (`documents`, `expenses`, `expense_splits`, `settlements`, posting with audience `family_friends`, invoking `visit-note-process`) require `app.circle_is_plus()` in the RLS insert/update policy or at the top of the function. **Reads and export are never gated.** The app shows a paywall when a gated action is attempted, and a banner during the last 5 trial days.

## 13. Privacy by design decisions

- **Setup wizard.** Creating a circle is a short, one-question-per-screen wizard run by the host: (1) what the family calls the person receiving care; (2) consent basis (below); (3) "Will {Name} use the app?" with a plain description of exactly what a recipient login can see and the note that this can be changed later, and that some people find it stressful to participate; (4) "What do you want to use Care Circle for?" with the module toggles from §4.3, basics pre-selected; (5) "Are you caring for more than one person?" which creates a linked second circle (§5.1); (6) invite people. Every answer is editable later in Settings.
- **Consent at setup.** Creating a circle requires ticking one of: "{Name} has agreed to the family keeping this record" or "I hold health care proxy / power of attorney for {Name}". Stored as `circles.consent_basis` with timestamp and user. Inviting the recipient shows them what the family can see.
- **Data minimization.** No field is required beyond name. No DOB is required until the emergency sheet is used. No location, contacts-list or photo-library-wide permissions; receipts and document photos use the single-image picker.
- **Export.** Settings → Export my circle: Edge Function `export-data` builds a ZIP (JSON per table + files) into a private bucket path and returns a signed URL valid 24 hours; owner and `full` members can run it.
- **Deletion.** Account deletion removes the user's profile, memberships, push tokens; content they authored stays with the circle attributed to "Former member" (the family's record shouldn't lose Mom's cardiology notes because one sibling left). Circle deletion (owner only, typed confirmation) hard-deletes all rows and storage objects after a 7-day grace period, during which the owner can cancel. The grace period is disclosed at the moment of deletion.
- **No third-party data flows** other than: Supabase (infrastructure), the STT vendor and Anthropic (user-initiated, per memo), RevenueCat (purchase state, no health data), Sentry (crash reports, scrubbed), Expo push + APNs/FCM (generic text only).
- **Notification text** never contains names of medications, conditions, providers or dollar amounts.

## 14. Encryption: evaluation and recommendation

### 14.1 What is already true

TLS in transit; Supabase encrypts disks at rest; Storage objects encrypted at rest; RLS isolates circles; Postgres backups encrypted by Supabase. This is the baseline for most consumer health apps.

### 14.2 What end-to-end encryption (E2EE) would add and cost

E2EE means the family's devices hold the keys and the server stores only ciphertext. Benefits: a server breach or a rogue admin exposes nothing readable; a stronger privacy promise in marketing. Costs, concretely for this app:

| Feature | Under E2EE |
|---|---|
| AI visit summaries | Server can't read the transcript. Would have to run the whole pipeline from the phone, sending plaintext from the device to the vendors anyway. Little privacy gain, much complexity. |
| Realtime updates with RLS filtering | Still works (ciphertext rows), but the server can't do anything smart with content. |
| Search ("which med did Dr. Lee change?") | Only client-side search over decrypted cache. |
| Refill reminders via pg_cron | Server can't read refill dates unless dates are left in plaintext. |
| Emergency sheet PDF | Must be generated on device (planned anyway). |
| Inviting a new sibling | Needs key exchange: the inviter's device wraps the circle key for the new member. Must be online, must be done by an existing member's device. |
| Lost phone / forgot everything | **If every member loses their device and recovery code, the data is gone forever, and support cannot help.** For a family in crisis, this is a real risk. |

### 14.3 Recommendation

**Launch with strong server-side protection (14.1) plus client-side encryption for the document vault only, added in Phase 7.**

- Documents (POA, proxy, insurance cards, advance directives) are the highest-value theft targets and the lowest need for server processing. They are opaque files anyway: encrypt the file on device with a per-circle key before upload; the key is wrapped per member with a key derived from their account and stored on their device, with a printable recovery code per circle.
- Medications, notes, tasks, appointments stay server-readable because the product's core value (AI summaries, reminders, realtime) depends on it.
- Say this plainly in the privacy policy: which data is end-to-end encrypted and which is encrypted at rest and readable by the service.

**Why not E2EE everything:** the family-crisis recovery problem outweighs the breach-protection gain for day-to-day data, and the AI feature would become either impossible or a privacy theater. Revisit after launch if customers ask for it.

## 15. Observability without leaking

- Sentry for crashes: `sendDefaultPii: false`, no replay, `beforeSend` strips request bodies, breadcrumb messages run through a scrubber that removes emails and anything matching medication/table field names; user identity is the opaque Supabase UUID.
- Supabase logs: default retention; no application code logs row contents. Edge Functions log IDs and status transitions only.
- Product metrics: counts only, computed in SQL by Michael (circles created, DAU, summaries processed). No event-tracking SDK.

## 16. Repository layout

```
app.json / eas.json / package.json / tsconfig.json
src/
  app/                 Expo Router routes
  features/<feature>/  screens, components, hooks, api.ts, schema.ts, __tests__
  lib/                 supabase.ts, queryClient.ts, offline.ts, realtime.ts, crypto.ts, sentry.ts, notifications.ts, permissions.ts
  ui/                  shared components, theme, typography
  types/database.ts    generated
  i18n/en.json         all copy
supabase/
  migrations/          SQL, numbered
  functions/           Edge Functions (Deno)
  tests/               pgTAP
  seed.sql             demo circle for local dev
docs/
```
