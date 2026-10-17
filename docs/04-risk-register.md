# Risk register

Likelihood and impact are rough: L/M/H. Owner is who acts on it. Mitigations reference the architecture (§) and build plan (Phase).

## Security

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| S1 | RLS gap lets one circle read another's rows | M | H | Every table has `circle_id`; policies via helper functions; pgTAP matrix tests for every table × role × non-member × anon run in CI; generic test fails if any table lacks RLS (Phase 0). Supabase advisors in Phase 7. |
| S2 | Storage object exposed via guessable path or missing policy | M | H | Private buckets only; object names include circle UUID; path-based policies tested; signed URLs short-lived. |
| S3 | Service-role key leaks (in app bundle or repo) | L | H | Service role only in Edge Function secrets; secret scanning in CI; key rotation runbook. |
| S4 | Invite link forwarded to the wrong person | M | M | 14-day expiry, single use, role fixed by inviter, token hashed at rest, owner sees pending invites and can revoke; new member's join appears in the feed so the family notices. |
| S5 | Lost/stolen phone exposes cached health data | M | H | Biometric lock on by default; encrypted cache and secure-store session; remote sign-out of other sessions in Settings (Phase 6); Supabase session revocation. |
| S6 | AI vendor retains or trains on transcripts | L | H | ZDR configuration confirmed in writing; STT vendor terms; minimum-necessary payload enforced by Deno test; vendor list reviewed quarterly. |
| S7 | Edge Function abused (someone invokes `visit-note-process` on another circle's note) | M | M | Function verifies membership through the caller's JWT and RLS before touching anything with the service role; rate limiting per user. |
| S8 | Account takeover via email OTP interception | L | H | 6-digit codes expire quickly; optional TOTP MFA (Phase 7); new-device sign-in notice. |
| S9 | Supabase outage or project deletion | L | H | Paid plan with PITR; monthly export of schema; owners can export their circle any time. |

## Legal and compliance

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| L1 | FTC HBNR breach obligations triggered by an unintended disclosure (e.g., a dependency phoning home) | M | H | No analytics SDKs; dependency audit; vendor list; breach-response plan rehearsed; 60-day clock process. |
| L2 | Washington MHMDA private lawsuit over consent or policy | L | H | Separate consumer-health privacy policy; opt-in consent screens; clean deletion; lawyer review before launch. |
| L3 | Perceived as giving medical advice (liability, FDA attention) | M | H | No dosing, interaction or clinical content; disclaimers in UI and terms; AI prompt forbids advice; AI output reviewed by a human before posting. |
| L4 | Recording-consent claims over visit memos | L | M | Feature is a post-visit personal memo by design and copy; never marketed as recording the clinician. |
| L5 | Family member enters a parent's data without authority | M | M | Consent-basis attestation at creation; recipient role and invitation; terms place responsibility on the user; data deletion on request. |
| L6 | Sibling dispute: one member demands data deletion or removal of another | M | M | Owner controls membership; anyone can leave; authored content stays attributed to "Former member"; export available; terms explain. Operationally, Care Circle does not adjudicate family disputes; support script in `docs/operations.md`. |
| L7 | Subscription/consumer law (auto-renew disclosures, refunds) | L | M | Store billing handles most; RevenueCat paywall shows price, period and cancellation path; terms. |

## Family-conflict and product

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| F1 | Fairness view becomes a weapon in sibling arguments | H | M | §9: alphabetical, equal-weight rows, no ranks or averages, explanatory copy, owner can hide; counts not minutes by default; test the copy with Michael's clinical eye before Phase 2 ships. |
| F2 | Parent feels surveilled | M | H | Recipient role sees their own record; no location, no "taken today" adherence logging in v1; consent step; the app describes itself to the recipient as "your family's shared notebook." |
| F3 | AI summary misstates what the doctor said and the family acts on it | M | H | Human review before posting; "unclear_or_missed" section surfaces ambiguity; original audio kept; copy: "Summarized from {Name}'s memo. Check the original if something matters." |
| F4 | Aide sees more than the family intended | M | M | Aide role limited to logistics; appointment notes hidden from aide; pgTAP tests. |
| F5 | Low adoption by the less-involved sibling | H | M | Generic but timely push; weekly digest option (post-Phase 7); viewer role lowers the barrier. |
| F6 | Onboarding friction for older users (recipient, spouse) | H | M | Email code instead of passwords; large text; one task per screen; invite as a share link a sibling can send over text. |

## App-store review

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| A1 | Rejected for medical claims or missing disclaimers | M | M | Record-keeping framing everywhere; Google Health apps declaration; Apple 5.1.3 compliance; no "medical" in the name. |
| A2 | Rejected for account deletion not in-app (Apple 5.1.1(v), Google) | M | M | Phase 6 in-app deletion plus web link. |
| A3 | Rejected for Sign in with Apple missing | M | L | Included from Phase 0. |
| A4 | Data safety / privacy labels inconsistent with behaviour | M | M | Labels drafted from the vendor list; reviewed each release. |
| A5 | Subscription review: paywall unclear, restore missing | M | L | RevenueCat paywall templates; restore button; trial terms visible. |
| A6 | Microphone permission flagged | L | L | Rationale string names the voice memo feature; permission requested only on first record. |

## Cost

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| C1 | AI costs exceed revenue for heavy users | L | M | Per-memo cost is cents (Opus 5.5 at $4/$20 per million tokens, a 10-minute memo is a few thousand tokens; STT roughly a cent a minute). Cap memos at 20 minutes and 30 per circle per month, with a soft notice. Monitor via Anthropic usage dashboard. |
| C2 | Storage growth from audio | M | L | AAC mono 32 kbps (~2.5 MB per 10 min); optional auto-delete setting; export then purge on circle deletion. |
| C3 | Supabase plan costs | L | L | Pro plan (~$25/month) plus modest usage covers the first few hundred circles; alerts on usage. |
| C4 | Store and tooling fees | H | L | Apple $99/yr, Google $25 once, EAS build plan if free tier exhausted, RevenueCat free until meaningful revenue, Sentry free tier. Budget ~$50/month pre-launch. |
| C5 | Legal fees | H | M | Scope the lawyer's review narrowly (two policies, terms, breach plan, one hour on applicability); reuse templates; budget a one-time fee. |
| C6 | Michael's time | H | H | Phases are small and stoppable; Phase 1 alone delivers value to his family; anything after Phase 2 can wait. |
