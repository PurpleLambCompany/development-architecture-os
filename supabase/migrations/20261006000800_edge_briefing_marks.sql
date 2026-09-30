-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 10 of 11.
-- Since You Were Away: the user-private briefing watermark (ADR-0057,
-- proposal §14).
--
-- A user says, by an explicit act, that they are briefed on an engagement
-- through a given system time. Only that user can read or set their own mark:
-- there is no policy for System Administrators, Principal Architects or
-- anyone else, and no read model exposes another user's mark.
--
-- Deliberately not recorded in activity_log: an audit row would make the mark
-- readable by the roles that can read the log, which would be view tracking
-- by another route. Opening a page never sets it. Nothing here records page
-- views, time on page, last visit, sign-ins or which items a user opened.
-- =============================================================================

create table public.edge_briefing_marks (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  engagement_id    uuid not null references public.engagements (id) on delete cascade,
  briefed_through  timestamptz not null,
  updated_at       timestamptz not null default clock_timestamp(),
  primary key (user_id, engagement_id)
);

comment on table public.edge_briefing_marks is
  'User-private "briefed through" watermark (ADR-0057). Own rows only; set only by mark_briefed_through; never logged.';

alter table public.edge_briefing_marks enable row level security;
revoke all on public.edge_briefing_marks from anon, authenticated;
grant select on public.edge_briefing_marks to authenticated;
create policy "edge briefing marks: own row only"
  on public.edge_briefing_marks for select to authenticated
  using (user_id = (select auth.uid()));

-- The one operation. The UI passes the time of the newest change the briefing
-- showed, not "now", so nothing that arrived while reading is skipped. The
-- user may also move the mark back to re-read.
create function public.mark_briefed_through(p_engagement_id uuid, p_through timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not private.can_read_architecture(p_engagement_id) then
    raise exception 'Engagement not found' using errcode = 'P0002';
  end if;
  if p_through is null or p_through > clock_timestamp() then
    raise exception 'Mark a time that has already passed' using errcode = '23514';
  end if;
  insert into public.edge_briefing_marks (user_id, engagement_id, briefed_through, updated_at)
  values (me, p_engagement_id, p_through, clock_timestamp())
  on conflict (user_id, engagement_id)
  do update set briefed_through = excluded.briefed_through, updated_at = excluded.updated_at;
  return p_through;
end;
$$;

revoke all on function public.mark_briefed_through(uuid, timestamptz) from public, anon;
grant execute on function public.mark_briefed_through(uuid, timestamptz) to authenticated;
