-- profiles: one row per auth user, created by trigger. push_tokens: Expo push tokens per device.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per auth user. display_name is what other circle members see.';

create trigger set_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_token text not null unique,
  platform text not null check (platform in ('android','ios')),
  created_at timestamptz not null default now()
);
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

-- Create the profile when a user signs up. Display name comes from the provider metadata when present
-- (Apple/Google), otherwise stays empty and onboarding asks for it. Email is never copied here.
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

alter table public.profiles enable row level security;
alter table public.push_tokens enable row level security;

-- Phase 0: a user sees and edits only their own profile. Phase 1A widens select to people who share a circle.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy push_tokens_all on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Grants: signed-in users reach these tables (RLS narrows rows); anonymous never does, even at the grant level.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
revoke all on public.profiles from anon;
revoke all on public.push_tokens from anon;
