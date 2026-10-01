-- =============================================================================
-- Phase 7B.2: Architecture Intelligence Experience. Migration 4 of 8.
-- Keeping an interpretation, and keeping it by judging it, atomically
-- (IX-12, PD-3, PD-4, PD-5, PD-21; proposal §14.3, §15; ADR-0069).
--
-- keep_architecture_inference names only the request that produced the
-- interpretation. The content comes from the pending interpretation the
-- recording operation held (migration 2), so what is stored is exactly what
-- the Gateway validated and returned to the person: nothing is regenerated
-- and nothing the browser sends becomes content (invariant 1).
--
-- Refused unless, now:
--   - the caller can read the engagement and holds use_architecture_intelligence;
--   - the caller is the requester, the interpretation is at most thirty
--     minutes old and has not been kept (one row per request, removed on
--     keep; a request can produce at most one inference);
--   - the engagement is proposed or active and authorised, under the same
--     authorization version as the request;
--   - every basis row re-emits through the Tool Contract with the same class
--     and digest, and every claim cites only basis handles.
--
-- With a judgment, the keep and the judgment are one transaction: either
-- both are recorded or neither is, and the judgment applies to exactly the
-- interpretation the person saw (PD-3, PD-21). Judging also needs
-- edit_architecture (PD-6).
-- =============================================================================

create function public.keep_architecture_inference(
  p_engagement_id uuid,
  p_request_id    uuid,
  p_judgment      jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending public.pending_architecture_inferences;
  req public.architecture_intelligence_requests;
  current_auth public.engagement_ai_authorizations;
  cited_handles text[];
  inference_id uuid;
begin
  if not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if not private.can_use_architecture_intelligence(p_engagement_id) then
    raise exception 'You do not hold use_architecture_intelligence on this engagement' using errcode = '42501';
  end if;
  if p_judgment is not null then
    if jsonb_typeof(p_judgment) is distinct from 'object'
       or exists (select 1 from jsonb_object_keys(p_judgment) k where k <> all (array[
            'kind', 'reason', 'expires_on', 'promotion_target_kind', 'promotion_target_id'])) then
      raise exception 'Unknown field in the judgment' using errcode = '23514';
    end if;
    perform private.require_inference_judgment_capability(p_engagement_id);
  end if;

  perform private.purge_expired_pending_inferences();

  -- The shared lock serializes with authorization changes, which remove
  -- pending interpretations: a revocation is either seen here or waits.
  perform pg_advisory_xact_lock_shared(hashtextextended('ai_authorization:' || p_engagement_id::text, 0));

  select * into pending from public.pending_architecture_inferences
  where request_id = p_request_id and engagement_id = p_engagement_id
  for update;
  -- Someone else's request reads exactly like an expired one.
  if pending.request_id is null or pending.requested_by is distinct from auth.uid()
     or pending.expires_at <= clock_timestamp() then
    raise exception 'This interpretation can no longer be kept. Interpret again.' using errcode = '23514';
  end if;
  select * into req from public.architecture_intelligence_requests where id = p_request_id;
  if req.outcome <> 'returned' or req.mode <> 'ephemeral' or req.requested_by <> auth.uid() then
    raise exception 'This interpretation can no longer be kept. Interpret again.' using errcode = '23514';
  end if;

  perform private.require_ai_context(p_engagement_id);
  current_auth := private.current_ai_authorization(p_engagement_id);
  if current_auth.id is distinct from req.authorization_id then
    raise exception 'This interpretation can no longer be kept: the engagement''s authorisation changed. Interpret again.'
      using errcode = '23514';
  end if;

  begin
    cited_handles := private.verify_inference_basis(p_engagement_id, pending.inference);
  exception when check_violation then
    raise exception 'This interpretation''s basis has changed. Interpret again.' using errcode = '23514';
  end;

  inference_id := private.insert_architecture_inference(p_engagement_id, req, pending.inference, cited_handles,
                                                        clock_timestamp());

  perform set_config('dsa.ai_pending', 'on', true);
  delete from public.pending_architecture_inferences where request_id = p_request_id;
  perform set_config('dsa.ai_pending', 'off', true);

  if p_judgment is not null then
    perform pg_advisory_xact_lock(hashtextextended('ai_inference_judgment:' || p_engagement_id::text, 0));
    perform private.record_inference_judgment_row(
      p_engagement_id, inference_id, p_judgment ->> 'kind', p_judgment ->> 'reason',
      (p_judgment ->> 'expires_on')::date, p_judgment ->> 'promotion_target_kind',
      (p_judgment ->> 'promotion_target_id')::uuid);
  end if;

  return inference_id;
end;
$$;

revoke all on function public.keep_architecture_inference(uuid, uuid, jsonb) from public, anon;
grant execute on function public.keep_architecture_inference(uuid, uuid, jsonb) to authenticated;
