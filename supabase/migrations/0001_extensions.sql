-- Extensions. pgcrypto for gen_random_uuid/digest. pg_cron is used from Phase 1B for refill scans;
-- it is only created where the server offers it (Supabase does; a plain local Postgres usually does not).
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
  end if;
end $$;
