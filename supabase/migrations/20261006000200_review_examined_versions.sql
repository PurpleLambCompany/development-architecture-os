-- =============================================================================
-- Phase 7A: Deterministic Development Edge. Migration 3 of 11.
-- Review examined-version capture (Q29) and the closed examined set (OD-7).
--
-- Decisions: ADR-0054; amendment note on ADR-0034. Proposal §11.
--
-- When hold_review holds a Review it records, for every element the Review
-- examines at that moment, the element's latest published version. The
-- capture is written only inside hold_review, is immutable, and is
-- version-exact. From then on the Review's examined set is closed: a new
-- examines from a held Review is refused, and an existing one cannot be
-- retired or removed. A held Review is one closed governance event. It is not
-- an Architecture Baseline and creates, requires or implies none.
--
-- Reviews held before 7A have no capture and are not backfilled (OD-6).
-- Their existing examines, including any added after the hold, are preserved.
-- =============================================================================

create table public.review_examined_versions (
  review_element_id   uuid not null,
  element_id          uuid not null,
  engagement_id       uuid not null references public.engagements (id) on delete restrict,
  -- The latest published version at hold. Null means the element had no
  -- published version then; any later publication counts as change since.
  element_version_id  uuid,
  -- System time of the hold operation, independent of the user-entered held_at.
  captured_at         timestamptz not null default clock_timestamp(),
  primary key (review_element_id, element_id),
  constraint review_examined_versions_review_fk foreign key (review_element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict,
  constraint review_examined_versions_element_fk foreign key (element_id, engagement_id)
    references public.architecture_elements (id, engagement_id) on delete restrict,
  constraint review_examined_versions_version_fk foreign key (element_version_id, element_id)
    references public.element_versions (id, element_id) on delete restrict
);
create index review_examined_versions_element_idx on public.review_examined_versions (element_id);
create index review_examined_versions_engagement_idx on public.review_examined_versions (engagement_id);

comment on table public.review_examined_versions is
  'Q29 capture (ADR-0054): the exact version of each element a Review examined, written only by hold_review. Immutable. Not a baseline.';

-- Written only inside hold_review; never changed or removed.
create function private.guard_review_examined_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(current_setting('dsa.review_capture', true), 'off') <> 'on' then
      raise exception 'What a Review examined is captured only when the Review is held' using errcode = '42501';
    end if;
    if not exists (select 1 from public.reviews r where r.element_id = new.review_element_id) then
      raise exception 'Only a Review captures what it examined' using errcode = '23514';
    end if;
    new.captured_at := clock_timestamp();
    return new;
  end if;
  raise exception 'What a held Review examined is permanent' using errcode = '23514';
end;
$$;

create trigger review_examined_versions_guard
  before insert or update or delete on public.review_examined_versions
  for each row execute function private.guard_review_examined_version();

-- The examined set closes at hold (OD-7, §11.4). Covers every write path:
-- the relationship operations, direct inserts under RLS, and the seed. The
-- source Review is locked first, so an insert cannot slip in between
-- hold_review's capture and its status change.
create function private.guard_examined_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  review_id uuid;
begin
  if tg_op = 'INSERT' then
    if new.relationship_type <> 'examines' then return new; end if;
    review_id := new.source_element_id;
  elsif tg_op = 'UPDATE' then
    if old.relationship_type <> 'examines' or not (old.retired_at is null and new.retired_at is not null) then
      return new;
    end if;
    review_id := old.source_element_id;
  else
    if old.relationship_type <> 'examines' then return old; end if;
    review_id := old.source_element_id;
  end if;

  perform 1 from public.architecture_elements where id = review_id for share;
  if exists (select 1 from public.reviews r where r.element_id = review_id and r.review_status = 'held') then
    raise exception 'The examined set closed when this Review was held. Use a later Review for further examination.'
      using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger architecture_relationships_examined_set
  before insert or update or delete on public.architecture_relationships
  for each row execute function private.guard_examined_set();

-- hold_review: same signature, checks and effects, plus the capture step
-- inside the same transaction (§11.3).
create or replace function public.hold_review(
  p_element_id uuid,
  p_held_at timestamptz default null,
  p_summary text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.architecture_elements;
  r public.reviews;
begin
  perform private.begin_architecture_operation();
  e := private.lock_element(p_element_id);
  if e.kind <> 'review' then
    raise exception 'Only a review is held' using errcode = '23514';
  end if;
  perform private.require_engagement_capability(e.engagement_id, 'manage_reviews');
  select * into r from public.reviews where element_id = e.id;
  if r.review_status <> 'scheduled' then
    raise exception 'Only a scheduled review can be held' using errcode = '23514';
  end if;

  -- Hold each examined element still while its latest published version is
  -- read, so a concurrent publication is either fully before or fully after.
  perform 1 from public.architecture_elements t
  where t.id in (select rel.target_element_id from public.architecture_relationships rel
                 where rel.source_element_id = e.id and rel.relationship_type = 'examines'
                   and rel.retired_at is null)
  order by t.id
  for share;

  perform set_config('dsa.review_capture', 'on', true);
  insert into public.review_examined_versions (review_element_id, element_id, engagement_id, element_version_id)
  select distinct on (rel.target_element_id) e.id, rel.target_element_id, e.engagement_id, t.latest_version_id
  from public.architecture_relationships rel
  join public.architecture_elements t on t.id = rel.target_element_id
  where rel.source_element_id = e.id and rel.relationship_type = 'examines' and rel.retired_at is null
  order by rel.target_element_id;
  perform set_config('dsa.review_capture', 'off', true);

  update public.reviews
  set review_status = 'held',
      held_at = coalesce(p_held_at, clock_timestamp()),
      summary = coalesce(nullif(btrim(p_summary), ''), summary)
  where element_id = e.id;
  perform private.end_architecture_operation();
end;
$$;

alter table public.review_examined_versions enable row level security;
revoke all on public.review_examined_versions from anon, authenticated;
grant select on public.review_examined_versions to authenticated;
create policy "review examined versions: internal readers"
  on public.review_examined_versions for select to authenticated
  using (private.can_read_architecture(engagement_id));

revoke all on function private.guard_review_examined_version() from public, anon, authenticated;
revoke all on function private.guard_examined_set() from public, anon, authenticated;
