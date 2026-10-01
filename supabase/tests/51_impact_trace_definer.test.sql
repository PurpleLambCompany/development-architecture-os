-- Phase 7B.2 defect fix (ADR-0055 amendment): impact_trace runs as its owner
-- for performance only. Proves that every seed user, internal and client,
-- gets exactly the rows the security-invoker version returned (that version
-- is recreated here from the live body, so the comparison is against the
-- same walk under per-row RLS), and that access and grants are unchanged.
begin;
select plan(22);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- The 7A invoker version, from the same body.
do $$
begin
  execute replace(replace(pg_get_functiondef('public.impact_trace(uuid, text)'::regprocedure),
    'FUNCTION public.impact_trace(', 'FUNCTION pg_temp.impact_trace_invoker('), 'SECURITY DEFINER', 'SECURITY INVOKER');
end;
$$;

create function pg_temp.subjects() returns table (element_id uuid, mode text) language sql as $$
  select e.id, m.mode
  from public.architecture_elements e
  cross join lateral (values ('on_demand'), ('edge')) m(mode)
  where (e.engagement_id, e.reference_code) in (
    ('e0000000-0000-4000-8000-000000000001', 'CAP-001'),
    ('e0000000-0000-4000-8000-000000000003', 'APP-001'),
    ('e0000000-0000-4000-8000-000000000003', 'IMP-001'))
    and (m.mode = 'on_demand' or e.reference_code = 'APP-001');
$$;

-- For one user: the subjects whose definer and invoker results differ, and how many rows the user saw.
create function pg_temp.compare(user_email text) returns table (differing int, seen int) language plpgsql as $$
declare
  s record;
  a jsonb;
  b jsonb;
begin
  differing := 0;
  seen := 0;
  for s in select * from pg_temp.subjects() loop
    perform pg_temp.act_as(user_email);
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') into a
    from public.impact_trace(s.element_id, s.mode) t;
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') into b
    from pg_temp.impact_trace_invoker(s.element_id, s.mode) t;
    execute 'reset role';
    if a is distinct from b then differing := differing + 1; end if;
    seen := seen + jsonb_array_length(a);
  end loop;
  return next;
end;
$$;

select ok((select prosecdef from pg_proc where oid = 'public.impact_trace(uuid, text)'::regprocedure),
  'impact_trace runs as its owner');
select ok(not has_function_privilege('anon', 'public.impact_trace(uuid, text)', 'execute'), 'anon cannot call it');
select ok(has_function_privilege('authenticated', 'public.impact_trace(uuid, text)', 'execute'),
  'signed-in users can, as before');

select is((select differing from pg_temp.compare(u)), 0, u || ': same rows as the invoker version')
from unnest(array[
  'principal@tplco.test', 'architect@tplco.test', 'researcher@tplco.test', 'projectadmin@tplco.test',
  'finance@tplco.test', 'sysadmin@tplco.test',
  'sponsor@meridian.test', 'lead@meridian.test', 'finance@meridian.test', 'contributor@meridian.test',
  'viewer@meridian.test', 'sponsor@harbor.test', 'lead@harbor.test', 'finance@harbor.test',
  'contributor@harbor.test', 'viewer@harbor.test', 'advisor@consulting.test']) u;

select ok((select seen from pg_temp.compare('principal@tplco.test')) > 0, 'an internal reader sees the trace');
select is((select sum(seen)::int from unnest(array['lead@meridian.test', 'sponsor@harbor.test', 'viewer@harbor.test',
  'advisor@consulting.test']) u, lateral pg_temp.compare(u)), 0, 'clients see nothing');

select * from finish();
rollback;
