-- Spec §13: anonymous requests return nothing. Run after migrations + seed.
\set ON_ERROR_STOP on
insert into allowed_users (email) values ('member@example.com') on conflict do nothing;
insert into markets (id, name, iso2, currency, status) values
  ('00000000-0000-0000-0000-0000000000aa', 'RLS test market', 'ZZ', 'SGD', 'exploring')
  on conflict do nothing;

create temp table results (who text, tbl text, n bigint, err text);
grant all on results to anon, authenticated;

do $$
declare t text; n bigint;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    -- anon
    execute 'set local role anon';
    begin
      execute format('select count(*) from %I', t) into n;
      insert into results values ('anon', t, n, null);
    exception when insufficient_privilege then
      insert into results values ('anon', t, 0, 'denied');
    end;
    execute 'reset role';
    -- authenticated but not on the allowlist
    perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"stranger@example.com"}', true);
    execute 'set local role authenticated';
    execute format('select count(*) from %I', t) into n;
    insert into results values ('stranger', t, n, null);
    execute 'reset role';
  end loop;
end $$;

-- member sees data
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"member@example.com"}', false);
set role authenticated;
do $$ begin
  if (select count(*) from markets) = 0 then raise exception 'member cannot read markets'; end if;
end $$;
-- set_tracked_value keeps history
select set_tracked_value('market', '00000000-0000-0000-0000-0000000000aa', 'population', 100, null, 'people', 'placeholder');
select set_tracked_value('market', '00000000-0000-0000-0000-0000000000aa', 'population', 120, null, null, 'measured', 'Census');
do $$ begin
  if (select count(*) from tracked_values where entity_id = '00000000-0000-0000-0000-0000000000aa' and field = 'population') <> 2
    then raise exception 'history not kept'; end if;
  if (select value_num from tracked_values where entity_id = '00000000-0000-0000-0000-0000000000aa' and field = 'population' and is_current) <> 120
    then raise exception 'current value wrong'; end if;
  if (select unit from tracked_values where entity_id = '00000000-0000-0000-0000-0000000000aa' and field = 'population' and is_current) <> 'people'
    then raise exception 'unit not carried over'; end if;
end $$;
reset role;

do $$ declare bad text;
begin
  select string_agg(who || ':' || tbl || '=' || n, ', ') into bad from results where n > 0;
  if bad is not null then raise exception 'RLS leak: %', bad; end if;
end $$;
select who, count(*) as tables_checked, sum(n) as rows_visible from results group by who;
delete from tracked_values where entity_id = '00000000-0000-0000-0000-0000000000aa';
delete from markets where id = '00000000-0000-0000-0000-0000000000aa';
