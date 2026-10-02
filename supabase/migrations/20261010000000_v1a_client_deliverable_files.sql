-- =============================================================================
-- V1-A Increment 3 (Workstream B, B3): clients read the files of deliverables
-- they can read.
--
-- One function redefinition, no schema change. can_read_engagement_file gains
-- a clause that mirrors the client read of element versions exactly: a
-- deliverable file attached to a published version, read by someone who
-- holds view_architecture on the file's engagement, where the deliverable is
-- client-readable (client-visible, published, not retired, inside the
-- reader's areas, and, if confidential, readable only with
-- view_confidential_deliverables). Files on every published version of such a
-- deliverable are readable, as every published version is (D9).
--
-- The engagement_files select policy and the engagement-files storage policy
-- both call this function, so the row and the stored object open together.
-- Every earlier clause is unchanged: no existing reader loses access.
-- =============================================================================

create or replace function private.can_read_engagement_file(target_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.engagement_files f
    where f.object_path = target_object_path
      and (
        private.can_read_architecture(f.engagement_id)
        or (f.uploaded_by = auth.uid() and private.is_engagement_client_member(f.engagement_id))
        or (
          f.client_action_response_id is not null
          and private.can_see_client_action(
            (select r.action_id from public.client_action_responses r where r.id = f.client_action_response_id)
          )
        )
        or (f.client_contribution_id is not null and private.can_see_client_contribution(f.client_contribution_id))
        or (
          f.purpose = 'deliverable'
          and f.element_version_id is not null
          and private.can_view_client_architecture(f.engagement_id)
          and exists (
            select 1
            from public.element_versions v
            join public.architecture_elements e on e.id = v.element_id
            where v.id = f.element_version_id
              and e.kind = 'deliverable'
              and e.engagement_id = f.engagement_id
              and private.element_client_readable(e.id)
          )
        )
      )
  );
$$;

revoke all on function private.can_read_engagement_file(text) from public, anon;
grant execute on function private.can_read_engagement_file(text) to authenticated;
