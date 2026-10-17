# Privacy and compliance checklist

Status legend: **BLOCKER** must be done before anyone outside Michael's immediate family stores real health data. **LAUNCH** before public store release. **LAWYER** needs review by an attorney (health privacy / consumer protection). Items marked **verify** rest on secondary sources found during planning and should be confirmed against the primary text before relying on them.

This is not legal advice. It is a work list for a lawyer and an engineer.

## A. Which laws plausibly apply (US launch)

| Law | Applies? | What it means here |
|---|---|---|
| HIPAA | Generally **no** for a direct-to-consumer family app that is not acting for a provider, plan or clearinghouse. | Do not claim "HIPAA compliant." Terms state the app is not for use by covered entities and that Care Circle is not a business associate. If a home-care **agency** wants to use it for its aides, that's a future enterprise decision with a BAA, not a default. **LAWYER** |
| FTC Health Breach Notification Rule (16 CFR Part 318, amended 2024, effective July 29, 2024) | **Yes, plan on it.** Covers vendors of personal health records and health apps that can draw identifiable health information from multiple sources. A family app with several contributors and uploaded documents fits. | Breach includes **unauthorized disclosure**, not just hacking: sending health data to an analytics SDK or an AI vendor without authorization counts. Notification to affected individuals and the FTC without unreasonable delay and within 60 calendar days of discovery (**verify** timing in the current rule text); media notice if 500+ residents of a state; FTC notice timing depends on whether 500+ people are affected. Penalties are civil penalties per violation. **LAWYER** for the breach-response plan. |
| FTC Act §5 | Yes. | Privacy policy must be accurate and specific. Every data flow in architecture §13 must be disclosed. No "we never share your data" if vendors process it. |
| Washington My Health My Data Act (RCW 19.373) | **Yes** if any Washington resident uses the app or it's marketed there (it's in both stores nationally). | Separate **Consumer Health Data Privacy Policy** linked from the app and homepage; opt-in consent for collection beyond what's necessary to provide the requested service; separate signed authorization for any "sale" (none planned); rights to access, delete, withdraw consent; **private right of action**. Design the consent screens so the "necessary to provide the service" path is clean. **LAWYER** |
| Nevada SB 370 (consumer health data) | Yes, similar scope to Washington; AG enforcement only. | Same policy and consent work covers it. |
| Connecticut CTDPA health-data provisions; other comprehensive state privacy laws (CA, VA, CO, TX, OR, etc.) | Thresholds (revenue / number of consumers) usually exempt a small startup, but all treat health data as **sensitive** requiring opt-in. | Build opt-in consent and deletion once; it satisfies the strictest state. Check thresholds yearly. **verify** current list; New York's Health Information Privacy Act status was unresolved as of planning. |
| State breach-notification laws (all 50) | Yes; many list medical information as a trigger. | Breach plan must map affected users to states. |
| Recording / wiretap laws | Avoided by design: the voice memo is the user's own account after the visit. | Never market it as recording the appointment. UI copy enforces this. |
| FDA device regulation | Not a device under current enforcement discretion for medication list / reminder / record-keeping apps. | **Do not** add dose calculations, interaction checks, or clinical suggestions. The record-keeping disclaimer stays. **LAWYER** sanity check once. |
| COPPA | Not applicable (adults). | Terms: 18+. |
| Illinois BIPA (biometrics) | Not triggered: biometric unlock uses OS APIs; no biometric data reaches the app or server. | State this in the privacy policy. |

## B. Before real health data from real families (BLOCKERS)

- [ ] RLS on every table with pgTAP tests for every role, non-member and anon (Phase 1).
- [ ] Storage buckets private with path-based policies tested (Phase 3–5).
- [ ] No analytics/ads SDKs; dependency audit confirms (`npm ls` reviewed, `docs/third-parties.md` lists every SDK and why).
- [ ] Sentry configured per architecture §15 and a real event inspected for PII.
- [ ] Push payloads generic (grep test in CI for forbidden fields in `send-push`).
- [ ] Anthropic organization/workspace configured for **zero data retention** and confirmed in writing; model used is `claude-opus-5-5` (Fable-class models are excluded from ZDR). Confirm current default retention for the API tier in use.
- [ ] Speech-to-text vendor: written no-retention / no-training terms obtained; configuration flags set in code; a test transcript request verified against vendor dashboard showing no stored audio.
- [ ] Encrypted on-device cache and secure-store sessions verified on a rooted/jailbroken test device (or reasoned equivalent).
- [ ] Biometric app lock on by default.
- [ ] Consent-basis step at circle creation; recipient invitation shows what the family sees.
- [ ] Export and deletion flows working end to end (Phase 6) — even for the family beta, people must be able to leave.
- [ ] Supabase project: MFA on Michael's Supabase account, GitHub account and Apple/Google developer accounts; service-role key only in Edge Function secrets; database password rotated after setup; Point-in-Time Recovery or daily backups enabled on the paid plan.
- [ ] Access log: who (Michael) can read production data and under what circumstances, written down in `docs/operations.md`.

## C. Before public store release (LAUNCH)

- [ ] **Privacy Policy** (general) and **Consumer Health Data Privacy Policy** (Washington-style), both hosted at stable URLs and linked in-app and in both stores. **LAWYER**
- [ ] **Terms of Service**: not medical advice; not for emergencies (call 911); not a HIPAA covered entity/business associate; user represents they have authority or consent to enter the recipient's information; subscription terms; account/circle deletion and grace period; governing law. **LAWYER**
- [ ] **Breach-response plan** (`docs/breach-response.md`): detection sources (Supabase logs, Sentry, vendor notices), severity triage, who decides, templates for individual notice, FTC notice path, media notice threshold, state-law mapping, 60-day clock tracking, post-incident review. Run one tabletop exercise. **LAWYER**
- [ ] Data retention schedule written: audio (setting), transcripts (with note), deleted circles (7-day grace then purge), backups (Supabase retention), logs (Supabase default), export files (24h).
- [ ] Vendor list with purpose, data categories, location, retention and DPA/terms link: Supabase, Anthropic, STT vendor, RevenueCat, Sentry, Expo push, Apple, Google. Keep it current.
- [ ] Google Play: Health apps declaration completed; Data safety form consistent with the privacy policy; "not a medical device" disclaimer in listing; account-deletion web link published.
- [ ] Apple: privacy nutrition labels; guideline 5.1.1(v) in-app account deletion; 5.1.3 health-data rules (no advertising/data-mining use, accurate disclosures); 4.8 Sign in with Apple present; microphone/camera/photos/notification/Face ID permission strings explain the exact use.
- [ ] Export compliance questions answered for both stores (standard HTTPS and OS crypto; revisit when Phase 7 client-side encryption ships).
- [ ] Age gate 18+ in onboarding copy and store rating.
- [ ] Marketing copy reviewed: no "HIPAA compliant", no "secure" without qualification, no "medical" claims, no "record your doctor".
- [ ] A support email that a human reads within two business days, published in both stores and in-app, including for privacy requests.
- [ ] Insurance: ask a broker about cyber/E&O coverage for a health-adjacent app. **LAWYER/BROKER**
- [ ] Business entity (LLC) holding the developer accounts and contracts. **LAWYER**

## D. Ongoing

- Quarterly: dependency audit, Supabase advisor review, re-check state law list and thresholds, review vendor terms changes.
- On every phase: the privacy checklist in the PR template (`.github/pull_request_template.md`, created in Phase 0) must be ticked: new table has RLS + tests; new vendor added to vendor list; new push text generic; new permission has rationale string.
