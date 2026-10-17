-- Care Circle: draft schema. Phase 0/1 turn this into numbered migrations.
-- Conventions: uuid PKs, timestamptz, circle_id on every circle-scoped table,
-- RLS enabled on every table, policies via app.* helper functions.
-- Comments marked TODO(phase N) are deferred to that phase.
-- Verified: applies cleanly on PostgreSQL 16 with stubbed auth.users/auth.uid(); smoke test confirmed cross-circle
-- isolation and the aide restrictions (see 02-build-plan Phase 1A tests for the full matrix to automate).

create schema if not exists app;

-- ---------------------------------------------------------------- enums
create type app.member_role as enum ('owner','full','viewer','aide','recipient','friend');
create type app.member_status as enum ('active','removed');
create type app.invite_status as enum ('pending','accepted','revoked','expired');
create type app.contact_kind as enum ('physician','pharmacy','facility','insurance','other');
create type app.task_status as enum ('open','done');
create type app.task_effort as enum ('quick','hour','half_day','full_day');
create type app.visit_note_status as enum ('recording','uploaded','transcribing','summarizing','draft','posted','failed');
create type app.update_audience as enum ('team','family_friends');
create type app.document_kind as enum ('poa','health_care_proxy','advance_directive','insurance_card','id_card','other');
create type app.subscription_status as enum ('trial','active','grace','expired','none');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_token text not null unique,
  platform text not null check (platform in ('android','ios')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- circles
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,                              -- "Mom's care team"
  created_by uuid not null references public.profiles(id),
  consent_basis text not null check (consent_basis in ('recipient_agreed','proxy_or_poa')),
  consent_recorded_by uuid not null references public.profiles(id),
  consent_recorded_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.circle_settings (
  circle_id uuid primary key references public.circles(id) on delete cascade,
  show_fairness boolean not null default true,
  recipient_sees_tasks boolean not null default false,
  recipient_sees_expenses boolean not null default false,
  audio_retention_days integer,                    -- null = keep until deleted
  updated_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role app.member_role not null,
  status app.member_status not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create unique index one_owner_per_circle on public.circle_members (circle_id) where role = 'owner' and status = 'active';
create index on public.circle_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  email text not null,
  role app.member_role not null check (role <> 'owner'),
  token_hash text not null unique,                 -- sha256 of the token in the link
  status app.invite_status not null default 'pending',
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- recipient
create table public.recipient_profile (
  circle_id uuid primary key references public.circles(id) on delete cascade,
  display_name text not null,                      -- what the family calls her
  legal_name text,
  date_of_birth date,
  blood_type text,
  conditions text[] not null default '{}',
  allergies text[] not null default '{}',
  insurance_summary text,                          -- plan name + member id, free text
  proxy_contact_id uuid,                           -- fk to contacts added after contacts exists
  notes text,
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  kind app.contact_kind not null,
  name text not null,
  specialty text,
  phone text, fax text, email text, address text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.contacts (circle_id);
alter table public.recipient_profile
  add constraint recipient_proxy_fk foreign key (proxy_contact_id) references public.contacts(id) on delete set null;

-- ---------------------------------------------------------------- medications
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  name text not null,
  dose text,                                       -- free text "10 mg"; no computation ever
  form text,                                       -- tablet, patch...
  schedule text,                                   -- free text "morning and bedtime"
  reason text,                                     -- "blood pressure" (family's words)
  prescriber_contact_id uuid references public.contacts(id) on delete set null,
  pharmacy_contact_id uuid references public.contacts(id) on delete set null,
  is_active boolean not null default true,
  started_on date,
  stopped_on date,
  refill_due_on date,
  refill_assignee_id uuid references public.profiles(id) on delete set null,
  refill_remind_days_before integer not null default 5,
  refill_last_notified_on date,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.medications (circle_id) where deleted_at is null;

create table public.medication_history (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now(),
  before jsonb, after jsonb
);

-- ---------------------------------------------------------------- appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  tz text not null,                                -- IANA zone where the appointment happens
  location text,
  provider_contact_id uuid references public.contacts(id) on delete set null,
  driver_id uuid references public.profiles(id) on delete set null,   -- who's taking her
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.appointments (circle_id, starts_at);

-- ---------------------------------------------------------------- visit notes (Phase 3)
create table public.visit_notes (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  author_id uuid not null references public.profiles(id),
  status app.visit_note_status not null default 'recording',
  audio_path text,                                 -- visit-audio/{circle_id}/{id}.m4a
  audio_seconds integer,
  audio_deleted_at timestamptz,
  transcript text,
  summary jsonb,                                   -- VisitSummarySchema
  summary_edited jsonb,                            -- the human-edited version that was posted
  error text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.visit_notes (circle_id, created_at desc);

-- ---------------------------------------------------------------- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  title text not null,
  details text,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  status app.task_status not null default 'open',
  effort app.task_effort,
  source_visit_note_id uuid references public.visit_notes(id) on delete set null,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks (circle_id, status, due_at);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- expenses (Phase 5)
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  payer_id uuid not null references public.profiles(id),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  category text,
  description text not null,
  incurred_on date not null,
  receipt_path text,                               -- receipts/{circle_id}/{id}.jpg
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  share_cents integer not null check (share_cents >= 0),
  primary key (expense_id, user_id)
);
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  amount_cents integer not null check (amount_cents > 0),
  settled_on date not null default current_date,
  note text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- documents (Phase 4)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  kind app.document_kind not null,
  title text not null,
  file_path text not null,                         -- documents/{circle_id}/{id}.{ext}
  mime_type text not null,
  size_bytes integer not null,
  expires_on date,
  show_on_emergency_sheet boolean not null default false,
  notes text,
  -- TODO(phase 7): encryption metadata (wrapped key id, iv) when client-side encryption lands
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------- updates (Phase 2)
create table public.updates (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  audience app.update_audience not null default 'team',
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.updates (circle_id, audience, created_at desc);

-- ---------------------------------------------------------------- activity log
create table public.activity_log (
  id bigint generated always as identity primary key,
  circle_id uuid not null references public.circles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity text not null,                            -- 'task','appointment','medication',...
  entity_id uuid,
  action text not null,                            -- 'created','completed','updated','posted',...
  summary text not null,                           -- human sentence, no sensitive values
  created_at timestamptz not null default now()
);
create index on public.activity_log (circle_id, created_at desc);

-- ---------------------------------------------------------------- billing (Phase 6)
create table public.circle_subscriptions (
  circle_id uuid primary key references public.circles(id) on delete cascade,
  purchaser_id uuid not null references public.profiles(id),
  revenuecat_app_user_id text not null,
  entitlement text not null default 'plus',
  status app.subscription_status not null default 'none',
  current_period_end timestamptz,
  raw_event jsonb,
  updated_at timestamptz not null default now()
);

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('account','circle')),
  execute_after timestamptz not null,
  cancelled_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  status text not null default 'queued',
  file_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ================================================================ helpers
-- Evaluated once per statement thanks to STABLE + (select auth.uid()).
create or replace function app.member_role(p_circle uuid)
returns app.member_role
language sql stable security definer set search_path = public
as $$
  select role from public.circle_members
  where circle_id = p_circle and user_id = (select auth.uid()) and status = 'active'
$$;

create or replace function app.is_member(p_circle uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select app.member_role(p_circle) is not null $$;

create or replace function app.has_role(p_circle uuid, variadic roles app.member_role[])
returns boolean language sql stable security definer set search_path = public
as $$ select app.member_role(p_circle) = any(roles) $$;

create or replace function app.circle_is_plus(p_circle uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.circles c where c.id = p_circle and c.trial_ends_at > now())
      or exists (select 1 from public.circle_subscriptions s where s.circle_id = p_circle
                 and s.status in ('active','grace') and (s.current_period_end is null or s.current_period_end > now()))
$$;

-- Setting-aware recipient access
create or replace function app.recipient_can_see(p_circle uuid, p_setting text)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare ok boolean;
begin
  execute format('select %I from public.circle_settings where circle_id = $1', p_setting) into ok using p_circle;
  return coalesce(ok, false);
end $$;

revoke all on function app.member_role(uuid), app.is_member(uuid), app.circle_is_plus(uuid) from public;
grant execute on function app.member_role(uuid), app.is_member(uuid), app.has_role(uuid, app.member_role[]),
  app.circle_is_plus(uuid), app.recipient_can_see(uuid, text) to authenticated;

-- ================================================================ RLS
-- Enable on every table. (Tests assert this for all tables in public.)
do $$ declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles: a user sees their own row and the rows of people who share a circle with them.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or exists (
    select 1 from public.circle_members me
    join public.circle_members them on them.circle_id = me.circle_id
    where me.user_id = (select auth.uid()) and them.user_id = profiles.id
      and me.status = 'active' and them.status = 'active'));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- push_tokens: own rows only
create policy push_tokens_all on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- circles
create policy circles_select on public.circles for select to authenticated using (app.is_member(id));
create policy circles_update on public.circles for update to authenticated
  using (app.has_role(id, 'owner')) with check (app.has_role(id, 'owner'));
create policy circles_delete on public.circles for delete to authenticated using (app.has_role(id, 'owner'));
-- No insert policy on purpose. Circles are created only through app.create_circle() below, a SECURITY DEFINER
-- RPC that inserts the circle, the owner membership, settings and the recipient profile in one transaction.
-- (A plain insert + after-trigger fails under RLS: INSERT ... RETURNING applies the select policy before the
-- owner membership exists.)
create or replace function app.create_circle(p_name text, p_recipient_display_name text, p_consent_basis text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_user uuid := (select auth.uid()); v_circle uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  insert into public.circles (name, created_by, consent_basis, consent_recorded_by)
    values (p_name, v_user, p_consent_basis, v_user) returning id into v_circle;
  insert into public.circle_members (circle_id, user_id, role) values (v_circle, v_user, 'owner');
  insert into public.circle_settings (circle_id) values (v_circle);
  insert into public.recipient_profile (circle_id, display_name) values (v_circle, p_recipient_display_name);
  return v_circle;
end $$;
grant execute on function app.create_circle(text, text, text) to authenticated;

-- circle_members
create policy members_select on public.circle_members for select to authenticated
  using (app.is_member(circle_id) and (app.member_role(circle_id) <> 'friend' or user_id = (select auth.uid())));
create policy members_update on public.circle_members for update to authenticated
  using (app.has_role(circle_id, 'owner')) with check (app.has_role(circle_id, 'owner'));
create policy members_delete on public.circle_members for delete to authenticated
  using (app.has_role(circle_id, 'owner') or user_id = (select auth.uid()));  -- owner removes; anyone can leave
-- inserts happen only via the accept-invite function (service role) and the circle-creation trigger.

-- invites
create policy invites_select on public.invites for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer'));
create policy invites_insert on public.invites for insert to authenticated
  with check (invited_by = (select auth.uid()) and (
    app.has_role(circle_id, 'owner')
    or (app.has_role(circle_id, 'full') and role in ('viewer','aide','recipient','friend'))));
create policy invites_update on public.invites for update to authenticated
  using (app.has_role(circle_id, 'owner','full'));

-- recipient_profile
create policy recipient_select on public.recipient_profile for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer','recipient'));
create policy recipient_write on public.recipient_profile for all to authenticated
  using (app.has_role(circle_id, 'owner','full')) with check (app.has_role(circle_id, 'owner','full'));

-- contacts (aide sees provider contacts for logistics)
create policy contacts_select on public.contacts for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer','recipient','aide'));
create policy contacts_write on public.contacts for all to authenticated
  using (app.has_role(circle_id, 'owner','full')) with check (app.has_role(circle_id, 'owner','full'));

-- medications
create policy meds_select on public.medications for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer','recipient'));
create policy meds_write on public.medications for all to authenticated
  using (app.has_role(circle_id, 'owner','full')) with check (app.has_role(circle_id, 'owner','full'));
create policy med_history_select on public.medication_history for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer'));

-- appointments
create policy appts_select on public.appointments for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer','aide','recipient'));
create policy appts_write on public.appointments for all to authenticated
  using (app.has_role(circle_id, 'owner','full')) with check (app.has_role(circle_id, 'owner','full'));

-- tasks
create policy tasks_select on public.tasks for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer','aide')
      or (app.has_role(circle_id, 'recipient') and app.recipient_can_see(circle_id, 'recipient_sees_tasks')));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (app.has_role(circle_id, 'owner','full') and created_by = (select auth.uid()));
create policy tasks_update_full on public.tasks for update to authenticated
  using (app.has_role(circle_id, 'owner','full'));
create policy tasks_update_aide_own on public.tasks for update to authenticated
  using (app.has_role(circle_id, 'aide') and assignee_id = (select auth.uid()))
  with check (assignee_id = (select auth.uid()));
-- Trigger (Phase 1): for aide updates, reject changes to any column other than status/completed_*.
create policy tasks_delete on public.tasks for delete to authenticated using (app.has_role(circle_id, 'owner','full'));

create policy task_comments_select on public.task_comments for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer','aide'));
create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (app.has_role(circle_id, 'owner','full','aide') and author_id = (select auth.uid()));

-- visit_notes (Phase 3)
create policy notes_select on public.visit_notes for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer')
      or (app.has_role(circle_id, 'recipient') and status = 'posted'));
create policy notes_insert on public.visit_notes for insert to authenticated
  with check (app.has_role(circle_id, 'owner','full') and author_id = (select auth.uid()));
create policy notes_update on public.visit_notes for update to authenticated
  using (app.has_role(circle_id, 'owner') or (app.has_role(circle_id, 'full') and author_id = (select auth.uid())));

-- expenses (Phase 5): writes require Plus
create policy expenses_select on public.expenses for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer')
      or (app.has_role(circle_id, 'recipient') and app.recipient_can_see(circle_id, 'recipient_sees_expenses')));
create policy expenses_write on public.expenses for insert to authenticated
  with check (app.has_role(circle_id, 'owner','full') and app.circle_is_plus(circle_id) and created_by = (select auth.uid()));
create policy expenses_update on public.expenses for update to authenticated
  using (app.has_role(circle_id, 'owner','full') and app.circle_is_plus(circle_id));
create policy expenses_delete on public.expenses for delete to authenticated using (app.has_role(circle_id, 'owner','full'));
-- expense_splits and settlements: same shape as expenses (select = team; write = owner/full + plus).

-- documents (Phase 4): writes require Plus; reads never gated
create policy documents_select on public.documents for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer','recipient'));
create policy documents_insert on public.documents for insert to authenticated
  with check (app.has_role(circle_id, 'owner','full') and app.circle_is_plus(circle_id) and uploaded_by = (select auth.uid()));
create policy documents_update on public.documents for update to authenticated using (app.has_role(circle_id, 'owner','full'));

-- updates (Phase 2)
create policy updates_select on public.updates for select to authenticated
  using ((audience = 'team' and app.has_role(circle_id, 'owner','full','viewer','recipient'))
      or (audience = 'family_friends' and app.has_role(circle_id, 'owner','full','viewer','recipient','friend')));
create policy updates_insert on public.updates for insert to authenticated
  with check (author_id = (select auth.uid())
    and app.has_role(circle_id, 'owner','full','viewer','recipient')
    and (audience = 'team' or app.circle_is_plus(circle_id)));
create policy updates_modify on public.updates for update to authenticated using (author_id = (select auth.uid()));
create policy updates_delete on public.updates for delete to authenticated
  using (author_id = (select auth.uid()) or app.has_role(circle_id, 'owner'));

-- activity_log: read by team; written only by triggers (security definer)
create policy activity_select on public.activity_log for select to authenticated
  using (app.has_role(circle_id, 'owner','full','viewer'));

-- billing / deletion / export: owner reads; writes by service role (Edge Functions) only
create policy subs_select on public.circle_subscriptions for select to authenticated using (app.is_member(circle_id));
create policy deletion_select on public.deletion_requests for select to authenticated
  using (user_id = (select auth.uid()) or app.has_role(circle_id, 'owner'));
create policy export_select on public.export_jobs for select to authenticated using (app.has_role(circle_id, 'owner','full'));

-- ================================================================ storage policies (sketch)
-- Buckets: documents, receipts, visit-audio. All private. Object name = '{circle_id}/{entity_id}.{ext}'.
-- Policy pattern (per bucket):
--   select: app.has_role( (split_part(name,'/',1))::uuid, <roles allowed to read that entity> )
--   insert: app.has_role( ..., 'owner','full') and (bucket requires plus => app.circle_is_plus(...))
--   delete: owner/full
-- The Edge Functions use the service role for downloads inside the AI pipeline and export.

-- ================================================================ fairness view (Phase 2)
-- create view public.fairness_summary as ... (per member, per window: tasks completed, appointments driven,
-- visit notes recorded, cents paid, effort buckets). Reads activity_log + expenses. RLS applies via underlying tables
-- when declared with security_invoker = true.
