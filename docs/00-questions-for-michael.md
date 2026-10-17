# Questions for Michael (and the defaults the plan assumes)

**Answered by Michael on 2026-10-17.** The resulting changes to the plan are recorded in `docs/decisions.md` and folded into the architecture, schema and build plan.

The rest of this package is written against the **default** under each question. If you answer differently, the affected sections are named so they can be revised before Sonnet starts the phase that depends on them.

---

### 1. iPhone timing and whether you own a Mac

Answer: I do not own a mac. Expo is fine.

**Why it matters.** Android first is easy either way. Shipping to iPhone requires Apple's build tools, which only run on macOS. Expo's cloud build service (EAS) can build the iOS app for you without a Mac, and the same service handles Android. Flutter can also be built in the cloud (Codemagic), but the overall toolchain is friendlier to a solo hobbyist on Expo. The bigger reason the plan recommends Expo is **one language**: TypeScript for the app, the server functions, the tests and the database types. Sonnet switches context less, and so do you.

**Default assumed:** iPhone within 6 months of the Android beta, no Mac required, cloud builds. → Expo (React Native). See architecture §1.

**If you'd rather have Flutter:** the data model, permissions, encryption and AI plan are unchanged; only the app-side files in the build plan change. Say so before Phase 0.

---

### 2. How does the care recipient take part?

Answer: Make this an optional mode. Some parents will be unable to participate or agitated by participating. There should be a basic question portion of account setup done by the account owner (whoever was the initial login). Questions will include: Will the person receiving care need access to the app - with a description of what that access looks like.

**Why it matters.** "Design for dignity and consent" has two very different implementations: (a) the parent gets their own login with a *recipient* role that sees their meds, appointments, contacts, emergency sheet and the updates feed, or (b) there is no login and the family shows the parent their information on a sibling's phone. (a) is more respectful and more work (an older adult onboarding path, large text, simple screens). It also raises the question of what the parent should *not* see by default: the fairness view and the expense ledger, which exist for the children.

**Default assumed:** (a), optional. A `recipient` role exists from Phase 1; the parent sees their own health record, appointments, contacts, emergency sheet and both feeds; they do not see tasks, the fairness view or expenses unless the owner turns those on. The circle owner must affirm at setup either that the recipient has agreed or that the owner holds authority (health care proxy / POA). See architecture §4 and §13.

---

### 3. How should "fairness" be measured?

Answer: Go with the default assumption and make it hideable. As many things as possible should be able to be toggled on and off. Some people will just want this as a way to coordinate efforts. Some will want something more comprehensive.

**Why it matters.** Counting tasks is easy and misleading (a 5-minute pharmacy call equals an overnight stay). Tracking minutes is honest and nobody will log them. A middle path is a small optional effort tag on each task (quick / an hour / half day / full day) with counts shown by default and effort shown only if people use it.

**Default assumed:** the middle path. Fairness shows, per person, over the last 30 and 90 days: tasks completed, appointments driven, visit notes recorded, dollars paid out of pocket, and (if tagged) effort buckets. Alphabetical order, no ranking, no totals-versus-average, and the circle owner can hide the view entirely. See architecture §9.

---

### 4. Where may the voice memo go for transcription?

Answer: Option A. Voice memos can be retained on the person's device but it has to be enabled in settings. I want data to be local to the person as much as possible.

**Why it matters.** Turning speech into text well requires a vendor. Option A: the audio goes to a cloud speech-to-text vendor under a written no-retention / no-training agreement, then the transcript goes to Claude under zero-data-retention terms. Best quality. Option B: on-device transcription only. Android's built-in recognizer frequently routes audio to Google anyway and quality on medical terms is noticeably worse; iOS on-device is decent. Option B avoids one vendor but gives you less control over where audio goes on Android, not more.

**Default assumed:** Option A. Audio is stored in a private Supabase bucket, processed by an Edge Function that calls a speech-to-text vendor configured for no retention, and the transcript is summarized by Claude under a zero-data-retention configuration. Vendor contracts are a launch blocker in the compliance checklist. The feature is described in the app as "your voice memo after the visit", **not** as recording the doctor, which keeps you clear of two-party-consent recording laws. See architecture §10.

---

### 5. Where exactly is the free/paid line, and how long is the trial?

Answer: Free will be basic coordination. So your default sounds good. There should be one purchaser as a host who can add users.

**Why it matters.** Your draft puts circle, calendar and tasks in the free tier and AI summaries, vault, expenses and the emergency sheet PDF in paid. Two things are unspecified: the **medication list** (the plan puts it in free: it's core to the emergency sheet and gating it would hurt the people with the least money), and the **emergency sheet** (the plan makes the on-screen sheet free and the shareable PDF paid, so nobody is ever locked out of the information in an ER). A server-side trial (clock starts when the circle is created, no card required) is simpler and more honest than a store-managed trial, and converts better for a product that takes a few weeks to prove its value.

**Default assumed:** Free: circle and roles, calendar, tasks, medication list, on-screen emergency sheet, team updates. Paid ("Care Circle Plus", one subscription per circle, bought by the owner): AI visit summaries, document vault, shared expenses, emergency sheet PDF, family-and-friends audience. 30-day server-side trial with everything unlocked. When a subscription lapses, paid features become **read-only and exportable**, never deleted. See architecture §12.

---

### Smaller assumptions made without asking

Answer: All of these are fine. There should be a way to link 2 circles right in the beginning. Later we will combine circles.

- US-only, English-only at launch. Nothing prevents other locales later; all user-facing copy goes through a strings file from Phase 0.
- One care recipient per circle. A family caring for two parents makes two circles. (Supporting several recipients per circle is a schema change that is cheap now and expensive later; it's noted in the architecture doc as the one thing to confirm before Phase 1 migrations are frozen.)
- Supabase is the backend. Nothing is clearly better for this shape of app at this budget.
- Phase 1 ships to the four of you (your wife, her siblings, you) as an internal Android build before anything goes to a store.
