# Decisions log

Dated, one line each. Newest at the bottom. Record here whenever a product or technical decision is made that the planning documents didn't already settle.

- 2026-10-17 — Stack confirmed: Expo (React Native, TypeScript); Michael has no Mac; iOS via EAS cloud builds. (Q1)
- 2026-10-17 — Recipient participation is optional and asked in a setup wizard run by the host ("Will {Name} use the app?" with a description of what they'd see); stored as `circle_settings.recipient_participates`; turning it off deactivates the recipient membership. (Q2)
- 2026-10-17 — Fairness view ships as designed and is hideable; generalized into per-circle module toggles on `circle_settings` so families can run the app as basic coordination or as the full hub. Toggles hide UI, never replace RLS. (Q3)
- 2026-10-17 — Voice memos: Option A (cloud STT with no-retention terms, Claude under ZDR). Audio is not kept on the server by default: the bucket is transit storage and the object is deleted at `draft`. Per-device opt-in keeps an encrypted local copy; host-level `keep_visit_audio` keeps it server-side for the team. Transcript stays with the note. (Q4)
- 2026-10-17 — Data-locality principle adopted: anything only one person needs lives on their device; the server holds what the team shares. (Q4)
- 2026-10-17 — Free/paid line and 30-day server-side trial confirmed. One purchaser per circle, the Host (owner role), who by default is the only one who adds members; `full_members_can_invite` toggle (off) relaxes this. "Host" is the user-facing name for `owner`. (Q5)
- 2026-10-17 — One recipient per circle confirmed. Two circles can be linked from the start via a `household`; linking grants no access and only groups circles in the UI. Combining/merging circles and linking circles with different hosts are deferred, with `households` as the hook. (Smaller assumptions)
- 2026-10-17 — Phase 1A circle creation is an RPC `app.create_circle()` (security definer), not a direct insert, because INSERT … RETURNING under RLS fails before the owner membership exists.
- 2026-10-17 — Every UI change ships with regenerated screenshots (`npm run screenshots`, Expo web + Playwright at two phone sizes, PNGs committed under `docs/screenshots/`); a PostToolUse hook in `.claude/settings.json` reminds the agent after any edit to UI paths; PR template has a Screenshots section; emulator captures via Maestro from Phase 1E. (Michael's request)
