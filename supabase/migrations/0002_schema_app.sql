-- The `app` schema holds helper functions, enums and RPCs. Tables live in `public`.
create schema if not exists app;
grant usage on schema app to authenticated, anon, service_role;

do $$ begin
  create type app.member_role as enum ('owner','full','viewer','aide','recipient','friend');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.member_status as enum ('active','removed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.invite_status as enum ('pending','accepted','revoked','expired');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.contact_kind as enum ('physician','pharmacy','facility','insurance','other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.task_status as enum ('open','done');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.task_effort as enum ('quick','hour','half_day','full_day');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.visit_note_status as enum ('recording','uploaded','transcribing','summarizing','draft','posted','failed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.update_audience as enum ('team','family_friends');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.document_kind as enum ('poa','health_care_proxy','advance_directive','insurance_card','id_card','other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type app.subscription_status as enum ('trial','active','grace','expired','none');
exception when duplicate_object then null; end $$;

-- Generic updated_at maintenance. Attach with:
--   create trigger set_updated_at before update on <table> for each row execute function app.set_updated_at();
create or replace function app.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
