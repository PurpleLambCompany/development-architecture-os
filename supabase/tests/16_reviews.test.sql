-- =============================================================================
-- Phase 5 reviews (pgTAP). Run with: pnpm db:test
--
-- create_review/add_review_participant/hold_review/cancel_review, the
-- manage_reviews capability, the examines/raises relationship types, and
-- reviews's own reference codes (REV-n). Meridian, e...01.
-- =============================================================================
begin;

select plan(32);

create function pg_temp.act_as(user_email text)
returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = user_email;
  if uid is null then
    raise exception 'No seeded user %', user_email;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.reset_actor()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create function pg_temp.member(user_email text, engagement uuid default 'e0000000-0000-4000-8000-000000000001')
returns uuid
language sql
security definer
as $$
  select m.id from public.engagement_members m join auth.users u on u.id = m.user_id
  where m.engagement_id = engagement and u.email = user_email;
$$;

-- -----------------------------------------------------------------------------
-- create_review: capability and validation
-- -----------------------------------------------------------------------------
select pg_temp.act_as('finance@tplco.test');
select throws_ok($$ select public.create_review('e0000000-0000-4000-8000-000000000001',
  'executive_review', 'Q3 Executive Review') $$, '42501', null,
  'TPLCo Finance holds no manage_reviews and cannot create a review');
select pg_temp.reset_actor();

select pg_temp.act_as('researcher@tplco.test');
select throws_ok($$ select public.create_review('e0000000-0000-4000-8000-000000000001',
  'executive_review', '') $$, '23514', null, 'a review needs a title');
select lives_ok($$ select public.create_review('e0000000-0000-4000-8000-000000000001',
  'executive_review', 'Q3 Executive Review', null, null, 'First formal check-in with the sponsor.') $$,
  'a Researcher (manage_reviews) creates a review');
select is((select reference_code from public.architecture_elements
           where engagement_id = 'e0000000-0000-4000-8000-000000000001' and kind = 'review'
             and title = 'Q3 Executive Review'), 'REV-001', 'it gets the REV prefix');
select is((select review_status::text from public.reviews r
           join public.architecture_elements e on e.id = r.element_id where e.title = 'Q3 Executive Review'),
  'scheduled', 'a new review starts scheduled');

select lives_ok($$ select public.create_review('e0000000-0000-4000-8000-000000000001',
  'architecture_review', 'Deep-dive: acquisition capability') $$, 'a second review is created');
select is((select reference_code from public.architecture_elements
           where engagement_id = 'e0000000-0000-4000-8000-000000000001' and kind = 'review'
             and title = 'Deep-dive: acquisition capability'), 'REV-002', 'sequential reference codes');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- add_review_participant
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select throws_ok($$ select public.add_review_participant(
  (select id from public.architecture_elements where title = 'Q3 Executive Review'),
  gen_random_uuid(), 'reviewer') $$, '23514', null, 'a participant must be a member of this engagement');
select lives_ok($$ select public.add_review_participant(
  (select id from public.architecture_elements where title = 'Q3 Executive Review'),
  pg_temp.member('sponsor@meridian.test'), 'organizer') $$, 'the Executive Sponsor is added as organizer');
select lives_ok($$ select public.add_review_participant(
  (select id from public.architecture_elements where title = 'Q3 Executive Review'),
  pg_temp.member('principal@tplco.test'), 'reviewer') $$, 'the Principal Architect is added as reviewer');
select is((select role::text from public.review_participants p
           join public.architecture_elements e on e.id = p.element_id
           where e.title = 'Q3 Executive Review' and p.engagement_member_id = pg_temp.member('sponsor@meridian.test')),
  'organizer', 'the participant''s role is recorded');
select lives_ok($$ select public.add_review_participant(
  (select id from public.architecture_elements where title = 'Q3 Executive Review'),
  pg_temp.member('sponsor@meridian.test'), 'attendee') $$,
  'adding the same member again updates their role instead of duplicating');
select is((select count(*)::int from public.review_participants p
           join public.architecture_elements e on e.id = p.element_id where e.title = 'Q3 Executive Review'),
  2, 'still two participants after the re-add');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Relationship rules: examines / raises, and validates being restricted-write
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select lives_ok($$ insert into public.architecture_relationships
  (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values ('e0000000-0000-4000-8000-000000000001',
    (select id from public.architecture_elements where title = 'Q3 Executive Review'),
    'b3000000-0000-4000-8000-000000000201', 'examines', 'architect_judgment') $$,
  'a review examines a core object');
select throws_ok($$ insert into public.architecture_relationships
  (engagement_id, source_element_id, target_element_id, relationship_type, provenance)
  values ('e0000000-0000-4000-8000-000000000001',
    (select id from public.architecture_elements where title = 'Q3 Executive Review'),
    'b3000000-0000-4000-8000-000000000201', 'validates', 'architect_judgment') $$,
  '42501', null, 'validates cannot be inserted directly, only by record_review_validation');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- hold_review / cancel_review
-- -----------------------------------------------------------------------------
select pg_temp.act_as('researcher@tplco.test');
select lives_ok($$ select public.hold_review(
  (select id from public.architecture_elements where title = 'Q3 Executive Review'), null,
  'Sponsor confirmed continued commitment to the acquisition strategy.') $$,
  'a Researcher holds the Q3 review');
select is((select review_status::text from public.reviews r join public.architecture_elements e on e.id = r.element_id
           where e.title = 'Q3 Executive Review'), 'held', 'its status becomes held');
select throws_ok($$ select public.hold_review(
  (select id from public.architecture_elements where title = 'Q3 Executive Review'), null, null) $$,
  '23514', null, 'a held review cannot be held again');

select throws_ok($$ select public.cancel_review(
  (select id from public.architecture_elements where title = 'Deep-dive: acquisition capability'), '') $$,
  '23514', null, 'cancelling a review says why');
select lives_ok($$ select public.cancel_review(
  (select id from public.architecture_elements where title = 'Deep-dive: acquisition capability'),
  'Superseded by the Q3 Executive Review.') $$, 'a Researcher cancels the second review');
select is((select review_status::text from public.reviews r join public.architecture_elements e on e.id = r.element_id
           where e.title = 'Deep-dive: acquisition capability'), 'cancelled', 'it is now cancelled');
select throws_ok($$ select public.cancel_review(
  (select id from public.architecture_elements where title = 'Deep-dive: acquisition capability'), 'Again') $$,
  '23514', null, 'a cancelled review cannot be cancelled again');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- review_register
-- -----------------------------------------------------------------------------
select pg_temp.act_as('architect@tplco.test');
select is((select count(*)::int from public.review_register('e0000000-0000-4000-8000-000000000001')), 2,
  'the register lists both reviews');
select is((select participant_count from public.review_register('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'REV-001'), 2, 'REV-001 shows its two participants');
select is((select agenda_count from public.review_register('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'REV-001'), 1, 'REV-001 shows one examines relationship');
select is((select review_status from public.review_register('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'REV-002'), 'cancelled', 'REV-002 shows cancelled');
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.review_register('e0000000-0000-4000-8000-000000000001')), 0,
  'a client never reads the internal review register (RLS returns nothing, not an error)');
select is((select count(*)::int from public.client_reviews('e0000000-0000-4000-8000-000000000001')), 0,
  'nor sees any review client-side before one is published');
select pg_temp.reset_actor();

-- -----------------------------------------------------------------------------
-- Publishing a review makes it client-visible (client_visibility then
-- publish_element_version, exactly as for any other element)
-- -----------------------------------------------------------------------------
select pg_temp.act_as('principal@tplco.test');
select lives_ok($$ update public.architecture_elements set client_visibility = 'client'
  where id = (select id from public.architecture_elements where title = 'Q3 Executive Review') $$,
  'the Principal Architect makes the review client-visible');
select lives_ok($$ select public.publish_element_version(
  (select id from public.architecture_elements where title = 'Q3 Executive Review'),
  'First publication.') $$, 'and publishes it');
select pg_temp.reset_actor();

select pg_temp.act_as('sponsor@meridian.test');
select is((select count(*)::int from public.client_reviews('e0000000-0000-4000-8000-000000000001')), 1,
  'the client now sees the published review');
select is((select review_status from public.client_reviews('e0000000-0000-4000-8000-000000000001')
           where reference_code = 'REV-001'), 'held', 'with its held status');
select pg_temp.reset_actor();

select * from finish();
rollback;
