-- ============================================================
-- 012 — Smart plan suggestions: per-member check-in (where & when I can come)
-- and automatic group time-window + midpoint venue recommendations.
-- ============================================================

alter table public.outing_plan_members
  add column if not exists area_label text check (char_length(area_label) <= 80),
  add column if not exists free_slots text[] not null default '{}'
    check (array_length(free_slots, 1) is null or array_length(free_slots, 1) <= 28);

-- Backfill existing plan members from their outing_profiles where empty
update public.outing_plan_members m
set
  area_label = coalesce(m.area_label, op.area_label),
  area_lat   = coalesce(m.area_lat, op.area_lat),
  area_lng   = coalesce(m.area_lng, op.area_lng),
  free_slots = case when coalesce(array_length(m.free_slots, 1), 0) = 0 then coalesce(op.free_slots, '{}') else m.free_slots end
from public.outing_profiles op
where op.user_id = m.user_id;

-- Save a member's availability (free_slots), preferred area (lat/lng/label), and activity choices for a plan
create or replace function public.set_outing_member_prefs(
  p_plan uuid,
  p_area_label text,
  p_lat numeric,
  p_lng numeric,
  p_free_slots text[],
  p_activities text[]
) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rlat numeric; rlng numeric;
begin
  if me is null or not public.outing_is_member(p_plan) then
    raise exception 'forbidden';
  end if;
  rlat := case when p_lat is not null then round(p_lat, 2) else null end;
  rlng := case when p_lng is not null then round(p_lng, 2) else null end;

  update public.outing_plan_members
  set
    area_label = coalesce(nullif(trim(p_area_label), ''), area_label),
    area_lat   = coalesce(rlat, area_lat),
    area_lng   = coalesce(rlng, area_lng),
    free_slots = coalesce(p_free_slots[1:28], '{}'),
    activities = coalesce(p_activities[1:10], '{}')
  where plan_id = p_plan and user_id = me;

  -- Also seed/update user's default outing_profiles if they haven't set area/free_slots yet
  insert into public.outing_profiles (user_id, area_label, area_lat, area_lng, free_slots, activities)
  values (
    me,
    nullif(trim(p_area_label), ''),
    rlat,
    rlng,
    coalesce(p_free_slots[1:28], '{}'),
    coalesce(p_activities[1:20], '{}')
  )
  on conflict (user_id) do update set
    area_label = coalesce(public.outing_profiles.area_label, excluded.area_label),
    area_lat   = coalesce(public.outing_profiles.area_lat, excluded.area_lat),
    area_lng   = coalesce(public.outing_profiles.area_lng, excluded.area_lng),
    free_slots = case when coalesce(array_length(public.outing_profiles.free_slots, 1), 0) = 0 then excluded.free_slots else public.outing_profiles.free_slots end,
    updated_at = now();
end $$;

revoke all on function public.set_outing_member_prefs(uuid, text, numeric, numeric, text[], text[]) from public, anon;
grant execute on function public.set_outing_member_prefs(uuid, text, numeric, numeric, text[], text[]) to authenticated;

-- Update join_outing_plan so joining also copies area_label and free_slots from outing_profiles
create or replace function public.join_outing_plan(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.outing_plans; n int; g text; ml numeric; mg numeric; mlabel text; mslots text[];
begin
  if me is null then raise exception 'unauthorized'; end if;
  select * into p from public.outing_plans where invite_code = upper(trim(p_code));
  if p is null then raise exception 'not_found'; end if;
  if public.outing_is_member(p.id) then return p.id; end if;
  if p.status not in ('collecting','confirmed') then raise exception 'closed'; end if;
  if public.is_blocked_between(me, p.organizer) then raise exception 'not_found'; end if;
  if p.women_only then
    select gender into g from public.outing_profiles where user_id = me;
    if coalesce(g,'') <> 'woman' then raise exception 'women_only'; end if;
  end if;
  select count(*) into n from public.outing_plan_members where plan_id = p.id and status = 'joined';
  if n >= p.max_people then raise exception 'full'; end if;
  select area_lat, area_lng, area_label, coalesce(free_slots, '{}')
    into ml, mg, mlabel, mslots
    from public.outing_profiles where user_id = me;
  insert into public.outing_plan_members (plan_id, user_id, role, status, area_lat, area_lng, area_label, free_slots)
  values (p.id, me, 'member', 'joined', ml, mg, mlabel, coalesce(mslots, '{}'))
  on conflict (plan_id, user_id) do update
    set status = 'joined',
        joined_at = now(),
        area_lat = coalesce(public.outing_plan_members.area_lat, excluded.area_lat),
        area_lng = coalesce(public.outing_plan_members.area_lng, excluded.area_lng),
        area_label = coalesce(public.outing_plan_members.area_label, excluded.area_label),
        free_slots = case when coalesce(array_length(public.outing_plan_members.free_slots, 1), 0) = 0 then excluded.free_slots else public.outing_plan_members.free_slots end;
  insert into public.outing_messages (plan_id, sender, body)
  values (p.id, null, (select name from public.profiles where id = me) || ' به برنامه پیوست 👋');
  return p.id;
end $$;

revoke all on function public.join_outing_plan(text) from public, anon;
grant execute on function public.join_outing_plan(text) to authenticated;

-- Update outing_plan_detail to include suggested_windows (overlapping weekly free_slots) and my_prefs
create or replace function public.outing_plan_detail(p_plan uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.outing_plans; res jsonb;
begin
  if me is null then raise exception 'unauthorized'; end if;
  select * into p from public.outing_plans where id = p_plan;
  if p is null or not public.outing_is_member(p_plan) then return null; end if;
  res := to_jsonb(p) || jsonb_build_object('is_organizer', p.organizer = me);
  res := res || jsonb_build_object('members', (
    select coalesce(jsonb_agg(public.outing_card(m.user_id) || jsonb_build_object(
        'role', m.role, 'status', m.status, 'plan_activities', to_jsonb(m.activities),
        'has_prefs', (coalesce(m.area_lat, op.area_lat) is not null or coalesce(array_length(m.free_slots, 1), array_length(op.free_slots, 1), 0) > 0),
        'lifestyle', public.outing_lifestyle_of(m.user_id)) order by m.joined_at), '[]')
    from public.outing_plan_members m
    left join public.outing_profiles op on op.user_id = m.user_id
    where m.plan_id = p_plan and m.status in ('joined','invited')));
  res := res || jsonb_build_object('my_prefs', (
    select jsonb_build_object(
      'area_label', coalesce(m.area_label, op.area_label, ''),
      'area_lat', coalesce(m.area_lat, op.area_lat),
      'area_lng', coalesce(m.area_lng, op.area_lng),
      'free_slots', to_jsonb(coalesce(nullif(m.free_slots, '{}'), op.free_slots, '{}')),
      'activities', to_jsonb(coalesce(nullif(m.activities, '{}'), op.activities, '{}')),
      'checked_in', (m.area_lat is not null or coalesce(array_length(m.free_slots, 1), 0) > 0 or coalesce(array_length(m.activities, 1), 0) > 0)
    )
    from public.outing_plan_members m
    left join public.outing_profiles op on op.user_id = m.user_id
    where m.plan_id = p_plan and m.user_id = me));
  res := res || jsonb_build_object('suggested_windows', (
    select coalesce(jsonb_agg(jsonb_build_object('slot', w.slot, 'count', w.cnt, 'names', w.names) order by w.cnt desc, w.slot), '[]')
    from (
      select s as slot, count(*)::int as cnt, jsonb_agg(pr.name order by m.joined_at) as names
      from public.outing_plan_members m
      join public.profiles pr on pr.id = m.user_id
      left join public.outing_profiles op on op.user_id = m.user_id,
      unnest(coalesce(nullif(m.free_slots, '{}'), op.free_slots, '{}')) as s
      where m.plan_id = p_plan and m.status = 'joined'
      group by s
      order by count(*) desc, s
      limit 6
    ) w));
  res := res || jsonb_build_object('slots', (
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
        'yes', (select count(*) from public.outing_slot_votes v where v.slot_id = s.id and v.answer = 'yes'),
        'maybe', (select count(*) from public.outing_slot_votes v where v.slot_id = s.id and v.answer = 'maybe'),
        'no', (select count(*) from public.outing_slot_votes v where v.slot_id = s.id and v.answer = 'no'),
        'mine', (select answer from public.outing_slot_votes v where v.slot_id = s.id and v.user_id = me),
        'yes_names', (select coalesce(jsonb_agg(pr.name), '[]') from public.outing_slot_votes v join public.profiles pr on pr.id = v.user_id
                      where v.slot_id = s.id and v.answer = 'yes')) order by s.starts_at), '[]')
    from public.outing_plan_slots s where s.plan_id = p_plan));
  res := res || jsonb_build_object('places', (
    select coalesce(jsonb_agg(to_jsonb(pl) || jsonb_build_object(
        'votes', (select count(*) from public.outing_place_votes v where v.place_id = pl.id),
        'mine', exists (select 1 from public.outing_place_votes v where v.place_id = pl.id and v.user_id = me))
        order by pl.created_at), '[]')
    from public.outing_plan_places pl where pl.plan_id = p_plan));
  res := res || jsonb_build_object('activity_tally', (
    select coalesce(jsonb_object_agg(a, n), '{}') from (
      select a, count(*) n from public.outing_plan_members m, unnest(m.activities) a
      where m.plan_id = p_plan and m.status = 'joined' group by a) t));
  -- center of the group (rounded member areas, falling back to outing_profiles area), for place search
  res := res || jsonb_build_object('center', (
    select jsonb_build_object(
      'lat', round(avg(coalesce(m.area_lat, op.area_lat)), 2),
      'lng', round(avg(coalesce(m.area_lng, op.area_lng)), 2),
      'count', count(coalesce(m.area_lat, op.area_lat))::int
    )
    from public.outing_plan_members m
    left join public.outing_profiles op on op.user_id = m.user_id
    where m.plan_id = p_plan and m.status = 'joined' and coalesce(m.area_lat, op.area_lat) is not null));
  -- hint for venues: only answers whose owner allowed use_for_matching, and only when ≥3 members (k-anonymity)
  res := res || jsonb_build_object('venue_hint', (
    select case when count(*) filter (where m.status = 'joined') < 3 then '{}'::jsonb else jsonb_build_object(
      'prefer_alcohol_free', bool_or(l.use_for_matching and l.alcohol = 'no'),
      'smokers_present', bool_or(l.use_for_matching and l.smoking in ('sometimes','yes'))) end
    from public.outing_plan_members m left join public.outing_lifestyle l on l.user_id = m.user_id
    where m.plan_id = p_plan and m.status = 'joined'));
  return res;
end $$;

revoke all on function public.outing_plan_detail(uuid) from public, anon;
grant execute on function public.outing_plan_detail(uuid) to authenticated;
