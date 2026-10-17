# Care Circle

A shared operations hub for a small family team (usually 2–5 adult children, sometimes a spouse or paid aide) caring for one aging parent.

This repository currently holds the **planning package**. The code is written phase by phase by Claude Sonnet, working from these documents. Nothing here is a finished product yet.

## Documents

| File | What it is | Read it when |
|---|---|---|
| [`docs/00-questions-for-michael.md`](docs/00-questions-for-michael.md) | Five product decisions that are Michael's to make, each with the default the plan assumes | Before Phase 0 starts |
| [`docs/01-architecture.md`](docs/01-architecture.md) | Stack, data model, permissions, encryption, AI pipeline, auth, offline/sync, billing | Before any phase; re-read the relevant section per phase |
| [`docs/schema-draft.sql`](docs/schema-draft.sql) | Draft Postgres schema with RLS helpers and policies | Phase 0–1 (turned into real migrations there) |
| [`docs/02-build-plan.md`](docs/02-build-plan.md) | Phases 0–7, each with scope, files, acceptance criteria, tests | The phase you are implementing |
| [`docs/03-privacy-compliance-checklist.md`](docs/03-privacy-compliance-checklist.md) | What must be true before real families store real health data | Phase 6 and before any public release |
| [`docs/04-risk-register.md`](docs/04-risk-register.md) | Security, legal, family-conflict, app-store and cost risks with mitigations | Planning reviews |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for the coding agent | Automatically loaded |

## One-paragraph summary of the plan

Expo (React Native, TypeScript) app on Android first and iOS second, backed by Supabase (Postgres with strict row-level security, Auth, Storage, Realtime, Edge Functions). Every row belongs to exactly one care circle and every policy checks circle membership and role. Reads work offline from an encrypted on-device cache and writes queue until signal returns. Voice memos after a doctor visit are transcribed by a speech-to-text vendor and summarized by Claude through an Edge Function, under zero-data-retention terms, and nothing the AI produces is applied to the record until a human reviews it. Documents in the vault are the one place where client-side encryption is planned (later phase), because they are the highest-value target and need no server-side processing. Billing is one subscription per circle through RevenueCat. No advertising or analytics SDKs, ever.
