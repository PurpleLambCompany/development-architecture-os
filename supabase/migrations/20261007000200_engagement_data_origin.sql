-- =============================================================================
-- Phase 7B.1: Architecture Intelligence Foundation. Migration 3 of 7.
-- The provenance of an engagement's data (OD-4; B-4; proposal §6.2).
--
-- data_origin says where an engagement's data comes from, not whether the
-- engagement happens to be used for testing:
--   real        data about a real client and a real engagement (the default)
--   synthetic   data made up for development, demonstration and evaluation
--
-- It is immutable. No application operation can set it: an engagement
-- created by a signed-in person is always real, and the value can never be
-- changed afterwards. Only migrations and supabase/seed.sql (which run
-- without a signed-in user) create synthetic engagements. Until the
-- contractual and privacy requirements of B-4 are met, Architecture
-- Intelligence may process synthetic engagements only.
-- =============================================================================

alter table public.engagements
  add column data_origin text not null default 'real' check (data_origin in ('real', 'synthetic'));

comment on column public.engagements.data_origin is
  'Immutable provenance of the engagement''s data: real or synthetic (ADR-0060). Synthetic only through migrations or seed.';

create function private.guard_engagement_data_origin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.data_origin <> 'real' and auth.uid() is not null then
      raise exception 'An engagement created in DSA holds real data' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.data_origin is distinct from old.data_origin then
    raise exception 'The origin of an engagement''s data cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger engagements_data_origin_guard before insert or update on public.engagements
  for each row execute function private.guard_engagement_data_origin();
