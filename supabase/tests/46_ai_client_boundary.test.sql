-- =============================================================================
-- Phase 7B.1: the client boundary (pgTAP). Proposal §4, §22; B-3, B-19.
-- No client user, on either side of any engagement, reads an authorization,
-- a request, an inference or its basis, or reaches any AI function; and no
-- internal capability can be granted to a client.
-- Run with: pnpm db:test
-- =============================================================================
begin;

select plan(15);

create function pg_temp.act_as(user_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = user_email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;
create function pg_temp.try(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;

create temp table clients as select email from auth.users
where email like '%@meridian.test' or email like '%@harbor.test' or email like '%@consulting.test';
grant select on clients to authenticated;

-- An inference on Meridian and on Harbor, so there is something to leak.
select pg_temp.act_as('architect@tplco.test');
select public.record_architecture_intelligence_request(e, jsonb_build_object('outcome', 'persisted', 'mode', 'persist',
    'inference_kind', 'explanation', 'subject_type', 'element', 'subject_element_id', el,
    'authorization_id', (select id from public.engagement_ai_authorizations where engagement_id = e
                         order by sequence_no desc limit 1),
    'prompt_id', 'explanation', 'prompt_version', 'v1', 'generation_policy_version', 'v1', 'tool_contract_version', '1',
    'provider_key', 'fake', 'requested_model', 'f', 'resolved_model', 'f'),
  jsonb_build_object('output_schema_version', '1', 'assertion', 'Secret assertion.', 'prompt_content_hash', repeat('a', 64),
    'claims', '[{"text": "Secret claim.", "cites": ["R1"]}]'::jsonb,
    'basis', (select jsonb_agg(jsonb_build_object('handle', 'R1', 'record_type', record_type, 'record_id', record_id,
      'version_id', version_id, 'data_class', data_class, 'digest', digest, 'origin', 'anchor'))
      from public.ai_context_element(e, el))))
from (values ('e0000000-0000-4000-8000-000000000001'::uuid, 'b3000000-0000-4000-8000-000000000204'::uuid),
             ('e0000000-0000-4000-8000-000000000003'::uuid, 'b3000000-0000-4000-8000-000000000a01'::uuid)) v (e, el);
reset role;
select is((select count(*)::int from public.architecture_inferences), 2, 'two inferences exist');

-- Each client, in turn, reads nothing and reaches nothing.
create function pg_temp.client_rows() returns int language plpgsql as $$
declare c record; n int := 0; k int;
begin
  for c in select email from clients loop
    perform pg_temp.act_as(c.email);
    select (select count(*) from public.engagement_ai_authorizations) + (select count(*) from public.architecture_inferences)
         + (select count(*) from public.architecture_inference_basis)
         + (select count(*) from public.architecture_intelligence_requests) into k;
    n := n + k;
  end loop;
  execute 'reset role';
  return n;
end;
$$;
create function pg_temp.client_calls(sql text) returns text[] language plpgsql as $$
declare c record; r text[] := '{}';
begin
  for c in select email from clients loop
    perform pg_temp.act_as(c.email);
    r := r || pg_temp.try(sql);
  end loop;
  execute 'reset role';
  return array(select distinct x from unnest(r) x order by 1);
end;
$$;

select ok((select count(*) from clients) >= 11, 'every seeded client user is checked');
select is(pg_temp.client_rows(), 0, 'no client reads any authorization, request, inference or basis row');
select ok(pg_temp.client_calls($$ select * from public.ai_context_element('e0000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000204') $$) <@ array['42501', 'P0002'], 'no client reaches the Tool Contract (Meridian)');
select ok(pg_temp.client_calls($$ select * from public.ai_context_element('e0000000-0000-4000-8000-000000000003',
  'b3000000-0000-4000-8000-000000000a01') $$) <@ array['42501', 'P0002'], 'no client reaches the Tool Contract (Harbor)');
select ok(pg_temp.client_calls($$ select * from public.architecture_inference_state('e0000000-0000-4000-8000-000000000003') $$)
  <@ array['42501', 'P0002'], 'no client reads inference state');
select ok(pg_temp.client_calls($$ select * from public.architecture_intelligence_budget('e0000000-0000-4000-8000-000000000003') $$)
  <@ array['42501', 'P0002'], 'no client reads the budget');
select ok(pg_temp.client_calls($$ select * from public.architecture_intelligence_standing('e0000000-0000-4000-8000-000000000001') $$)
  <@ array['42501', 'P0002'], 'no client reads Architecture Intelligence standing');
select ok(pg_temp.client_calls($$ select public.set_engagement_ai_authorization('e0000000-0000-4000-8000-000000000003',
  'not_authorized', '{}', null, null, null, null, 'x', null) $$) <@ array['42501', 'P0002'],
  'no client authorizes or revokes');
select ok(pg_temp.client_calls($$ select public.record_architecture_intelligence_request('e0000000-0000-4000-8000-000000000003',
  '{"outcome": "returned", "mode": "ephemeral", "inference_kind": "explanation"}') $$) <@ array['42501', 'P0002'],
  'no client records a model outcome');
select is((select count(*)::int from public.architecture_intelligence_requests where requested_by in
           (select id from auth.users where email in (select email from clients))), 0,
  '... and no row was written for one');

-- Capabilities: internal only, and never conferred on a client.
select is(public.capability_side('use_architecture_intelligence'), 'internal', 'use is an internal capability');
select is(public.capability_side('authorize_external_ai_processing'), 'internal', 'authorize is an internal capability');
select is((select count(*)::int from public.role_capability_defaults d
           where d.capability in ('use_architecture_intelligence', 'authorize_external_ai_processing')
             and d.role::text not in ('principal_architect', 'architect')), 0, 'defaults name internal roles only');
select is((select count(*)::int from public.engagement_members m
           where m.side = 'client' and (private.member_has_capability(m.id, 'use_architecture_intelligence')
             or private.member_has_capability(m.id, 'authorize_external_ai_processing'))), 0,
  'no client member holds either capability');

select * from finish();
rollback;
