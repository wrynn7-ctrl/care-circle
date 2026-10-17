begin;
select plan(13);

-- Every table in public must have RLS enabled. Fails loudly when a later phase forgets.
select is(
  (select count(*)::int from pg_tables t join pg_class c on c.relname = t.tablename
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
   where t.schemaname = 'public' and not c.relrowsecurity),
  0, 'every public table has RLS enabled');

-- Every public table has at least one policy (RLS with no policy = app silently gets nothing).
select is(
  (select count(*)::int from pg_tables t
   where t.schemaname = 'public'
     and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)),
  0, 'every public table has at least one policy');

-- Signup trigger creates a profile.
insert into auth.users (id, email, raw_user_meta_data)
  values ('11111111-1111-1111-1111-111111111111', 'dana@example.com', '{"full_name":"Dana"}'::jsonb);
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'sam@example.com');

select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Dana', 'profile created with display_name from provider metadata');
select is((select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '', 'profile created with empty display_name when no metadata');

-- RLS as Dana
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true); end $$;

select is((select count(*)::int from public.profiles), 1, 'dana sees exactly one profile');
select is((select id from public.profiles), '11111111-1111-1111-1111-111111111111'::uuid, 'and it is her own');

update public.profiles set display_name = 'Dana R.' where id = '11111111-1111-1111-1111-111111111111';
select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Dana R.', 'dana can update her own profile');

update public.profiles set display_name = 'hacked' where id = '22222222-2222-2222-2222-222222222222';
reset role;
select is((select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '', 'dana cannot update another profile (0 rows affected)');

-- push tokens: own rows only
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true); end $$;
insert into public.push_tokens (user_id, expo_token, platform)
  values ('11111111-1111-1111-1111-111111111111', 'ExponentPushToken[dana]', 'android');
select is((select count(*)::int from public.push_tokens), 1, 'dana sees her push token');

select throws_ok(
  $$insert into public.push_tokens (user_id, expo_token, platform)
    values ('22222222-2222-2222-2222-222222222222', 'ExponentPushToken[sam]', 'ios')$$,
  '42501', null, 'dana cannot register a token for sam');

do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true); end $$;
select is((select count(*)::int from public.push_tokens), 0, 'sam sees no tokens of dana');

-- anon is denied at the grant level (no rows and no access at all)
set local role anon;
do $$ begin perform set_config('request.jwt.claims', '{"role":"anon"}', true); end $$;
select throws_ok('select count(*) from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select count(*) from public.push_tokens', '42501', null, 'anon cannot read push tokens');

select * from finish();
rollback;
