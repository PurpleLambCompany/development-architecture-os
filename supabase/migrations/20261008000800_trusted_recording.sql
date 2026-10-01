-- =============================================================================
-- Phase 7B.2: Architecture Intelligence Experience. Migration 9 of 9.
-- A server-only recording boundary, required by Kerrick at Step A review
-- (2026-10-01; ADR-0069, ADR-0062 and ADR-0005 amendments).
--
-- Until now the Gateway recorded as the requesting user, so
-- record_architecture_intelligence_request was executable by
-- `authenticated`. A holder of use_architecture_intelligence could
-- therefore call it from their own browser session and hold, then keep,
-- text that no model produced and the Gateway never validated, with any
-- provider, model and token metadata they chose.
--
-- From here:
--   * record_architecture_intelligence_request is executable by no API
--     role. Nothing a browser session can call writes a request, a pending
--     interpretation or an inference.
--   * record_architecture_intelligence_request_for(requested_by, ...) is the
--     only way to record. It is executable only by `service_role`, which
--     only the DSA server holds (the existing server-only secret key; no new
--     secret). The server calls it from one module, with the requester taken
--     from the signed-in session the Auth server verified, after the Gateway
--     validated the model's output.
--   * It records as that requester: every binding and re-check of the
--     recording operation runs unchanged for that person (capability,
--     authorization version under the shared lock, data classes, basis
--     digests against what DSA would provide now, metadata-only audit
--     fields, expiry, single-use keeping). The service role gains no other
--     authority here: it cannot record for someone who could not have made
--     the request, and the operation writes only the request audit, a
--     pending interpretation, or (persist mode, evaluation only) an
--     inference and its basis.
--   * Keeping and judging stay with the person (`authenticated`):
--     keep_architecture_inference names only the request id and consumes the
--     server-recorded output; it is never given text.
-- =============================================================================

create function public.record_architecture_intelligence_request_for(
  p_requested_by  uuid,
  p_engagement_id uuid,
  p_request       jsonb,
  p_inference     jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior     text;
  prior_sub text;
  result    uuid;
begin
  if p_requested_by is null or not exists (select 1 from public.profiles where id = p_requested_by) then
    raise exception 'A request is recorded for the person who made it' using errcode = '42501';
  end if;
  -- Record as that person: every check below reads auth.uid(). The prior
  -- claims are restored afterwards, on success or failure, so the identity
  -- never outlives this call.
  prior := current_setting('request.jwt.claims', true);
  prior_sub := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', p_requested_by, 'role', 'authenticated')::text, true);
  begin
    result := public.record_architecture_intelligence_request(p_engagement_id, p_request, p_inference);
  exception when others then
    perform set_config('request.jwt.claims', coalesce(prior, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(prior_sub, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(prior, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(prior_sub, ''), true);
  return result;
end;
$$;

comment on function public.record_architecture_intelligence_request_for(uuid, uuid, jsonb, jsonb) is
  'The only recording path (ADR-0069): server-only (service_role), for a verified requester, after Gateway validation. Runs every check of record_architecture_intelligence_request as that person.';

revoke all on function public.record_architecture_intelligence_request(uuid, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.record_architecture_intelligence_request_for(uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_architecture_intelligence_request_for(uuid, uuid, jsonb, jsonb)
  to service_role;

-- Minimum authority for the server's key here: Supabase gives `service_role`
-- every privilege on public tables by default. It needs none on the
-- Architecture Intelligence tables, so it keeps none: it can record only
-- through the operation above, never by writing, truncating or reading
-- these tables directly. (The guards also refuse writes without their
-- operation's marker; TRUNCATE would bypass them, so the privilege goes.)
revoke all on public.architecture_intelligence_requests, public.architecture_inferences,
  public.architecture_inference_basis, public.pending_architecture_inferences,
  public.architecture_inference_judgments, public.engagement_ai_authorizations
  from service_role;

-- Nor does the server's key need any other Architecture Intelligence
-- function: the Tool Contract, keeping, judging, authorising and the read
-- models all run with the person's own session. Supabase grants
-- `service_role` execute on public functions by default; without a subject
-- they already refuse, and now they are not executable by it at all.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ~ '^ai_context_|architecture_intelligence|architecture_inference|^set_engagement_ai_authorization$|^suggested_interpretations$|^kept_architecture_inferences$'
      and p.proname <> 'record_architecture_intelligence_request_for'
  loop
    execute format('revoke all on function %s from service_role', f);
  end loop;
end;
$$;
