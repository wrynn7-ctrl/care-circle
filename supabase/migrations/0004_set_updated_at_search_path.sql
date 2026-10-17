-- Pin search_path on the trigger helper (Supabase security advisor 0011). Idempotent with 0002; kept as its
-- own migration because the hosted project already had 0002 applied before the fix.
create or replace function app.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
