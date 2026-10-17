-- Minimal stand-ins for the Supabase-managed objects that migrations and tests reference, for running
-- against a plain Postgres (no Docker). The real local stack (`supabase start`) provides all of these.
create schema if not exists extensions;
create schema if not exists auth;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role'
$$;
grant usage on schema public, extensions to anon, authenticated, service_role;
create extension if not exists pgtap;
