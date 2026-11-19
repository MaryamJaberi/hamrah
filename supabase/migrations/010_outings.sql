-- ============================================================
-- 010 — Outings «بریم بیرون» (module MO)
-- Independent of 004–009: references only profiles/blocks from 001–003,
-- so it can be applied before or after M1–M6.
-- Privacy model (see spec/11-OUTINGS-SPEC.md §Privacy):
--   * Nobody can SELECT another user's outing_profiles / outing_lifestyle row.
--     Other people's data is read only through security-definer RPCs that mask it.
--   * Profile fields have visibility public | matched | hidden.
--     "matched" = we are both joined members of the same plan.
--   * Lifestyle (alcohol / cannabis / smoking) is hidden by default. "mutual" means:
--     shown only to people who ALSO chose mutual for that field, answered it,
--     and are together in a plan with you.
--   * Gender is never shown; it is only used for women-only plans and filters.
--   * Location is stored rounded to 2 decimals (~1 km).
-- ============================================================

-- ---------- profile for going out ----------
create table if not exists public.outing_profiles (
  user_id uuid primary key references public.profiles on delete cascade,
  birth_year int check (birth_year between 1930 and 2012),
  gender text check (gender in ('woman','man','other','prefer_not')),
  job text check (char_length(job) <= 80),
  hobbies text[] not null default '{}',
  activities text[] not null default '{}',
  places_liked text[] not null default '{}',
  places_been text[] not null default '{}',
  languages text[] not null default '{}',
  budget text check (budget in ('low','mid','high')),
  area_label text check (char_length(area_label) <= 80),
  area_lat numeric(5,2) check (area_lat between -90 and 90),
  area_lng numeric(5,2) check (area_lng between -180 and 180),
  radius_km int not null default 10 check (radius_km between 1 and 100),
  free_slots text[] not null default '{}',          -- e.g. 'sat:evening' (day: sun..sat, part: morning|afternoon|evening|night)
  vis jsonb not null default '{"age":"public","job":"matched","hobbies":"public","places":"public"}',
  pref jsonb not null default '{}',                 -- {age_min, age_max, women_only, avoid:{smoking,cannabis,alcohol}}
  builder_step int not null default 0,
  updated_at timestamptz not null default now(),
  check (array_length(hobbies,1) is null or array_length(hobbies,1) <= 20),
  check (array_length(activities,1) is null or array_length(activities,1) <= 20),
  check (array_length(places_liked,1) is null or array_length(places_liked,1) <= 20),
  check (array_length(places_been,1) is null or array_length(places_been,1) <= 30),
  check (array_length(free_slots,1) is null or array_length(free_slots,1) <= 28)
);

create table if not exists public.outing_lifestyle (
  user_id uuid primary key references public.profiles on delete cascade,
  alcohol text check (alcohol in ('no','sometimes','yes')),
  cannabis text check (cannabis in ('no','sometimes','yes')),
  smoking text check (smoking in ('no','sometimes','yes')),
  alcohol_share text not null default 'hidden' check (alcohol_share in ('hidden','mutual')),
  cannabis_share text not null default 'hidden' check (cannabis_share in ('hidden','mutual')),
  smoking_share text not null default 'hidden' check (smoking_share in ('hidden','mutual')),
  use_for_matching boolean not null default false,  -- may hidden answers shape suggestions? (can be guessed from results)
  updated_at timestamptz not null default now()
);

alter table public.outing_profiles enable row level security;
alter table public.outing_lifestyle enable row level security;
create policy op_own on public.outing_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ol_own on public.outing_lifestyle for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- plans (group outings) ----------
create table if not exists public.outing_plans (
  id uuid primary key default gen_random_uuid(),
  organizer uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  note text check (char_length(note) <= 500),
  activity_options text[] not null default '{}',
  area_label text check (char_length(area_label) <= 80),
  area_lat numeric(5,2), area_lng numeric(5,2),
  women_only boolean not null default false,
  max_people int not null default 8 check (max_people between 2 and 30),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  status text not null default 'collecting' check (status in ('collecting','confirmed','cancelled','done')),
  chosen_slot uuid,
  chosen_place uuid,
  source_intent uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.outing_plan_members (
  plan_id uuid not null references public.outing_plans on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('organizer','member')),
  status text not null default 'joined' check (status in ('invited','joined','left')),
  activities text[] not null default '{}',
  area_lat numeric(5,2), area_lng numeric(5,2),
  joined_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index if not exists opm_user on public.outing_plan_members (user_id);

create table if not exists public.outing_plan_slots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.outing_plans on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  added_by uuid references public.profiles on delete set null,
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists ops_plan on public.outing_plan_slots (plan_id);

create table if not exists public.outing_slot_votes (
  slot_id uuid not null references public.outing_plan_slots on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  answer text not null check (answer in ('yes','maybe','no')),
  primary key (slot_id, user_id)
);

create table if not exists public.outing_plan_places (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.outing_plans on delete cascade,
  added_by uuid references public.profiles on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  address text check (char_length(address) <= 200),
  lat numeric(8,5), lng numeric(8,5),
  url text check (char_length(url) <= 500 and (url is null or url ~ '^https://')),
  provider text not null default 'manual' check (provider in ('manual','google','osm')),
  kind text check (char_length(kind) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists opp_plan on public.outing_plan_places (plan_id);

create table if not exists public.outing_place_votes (
  place_id uuid not null references public.outing_plan_places on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  primary key (place_id, user_id)
);

create table if not exists public.outing_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.outing_plans on delete cascade,
  sender uuid references public.profiles on delete cascade,   -- null = system message (written by RPCs)
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists om_plan on public.outing_messages (plan_id, created_at);

alter table public.outing_plans add constraint outing_plans_chosen_slot_fk
  foreign key (chosen_slot) references public.outing_plan_slots on delete set null;
alter table public.outing_plans add constraint outing_plans_chosen_place_fk
  foreign key (chosen_place) references public.outing_plan_places on delete set null;

-- ---------- open invites ("coffee with someone like…") ----------
create table if not exists public.outing_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  activity text not null check (char_length(activity) between 1 and 40),
  title text not null check (char_length(title) between 1 and 120),
  starts_after timestamptz not null,
  starts_before timestamptz not null,
  area_label text check (char_length(area_label) <= 80),
  lat numeric(5,2) not null, lng numeric(5,2) not null,
  radius_km int not null default 10 check (radius_km between 1 and 50),
  want jsonb not null default '{}',        -- {age_min, age_max, women_only, hobbies[]}
  max_people int not null default 1 check (max_people between 1 and 6),
  status text not null default 'open' check (status in ('open','matched','closed')),
  plan_id uuid references public.outing_plans on delete set null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  check (starts_before > starts_after),
  check (starts_before - starts_after <= interval '14 days')
);
create index if not exists oi_open on public.outing_intents (status, starts_before);

create table if not exists public.outing_intent_responses (
  intent_id uuid not null references public.outing_intents on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  status text not null default 'interested' check (status in ('interested','accepted','declined')),
  message text check (char_length(message) <= 300),
  created_at timestamptz not null default now(),
  primary key (intent_id, user_id)
);

-- ============================================================
-- helpers
-- ============================================================
create or replace function public.outing_is_member(p_plan uuid, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.outing_plan_members
                 where plan_id = p_plan and user_id = p_user and status = 'joined');
$$;

create or replace function public.outing_together(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select a = b or (not public.is_blocked_between(a, b) and exists (
    select 1 from public.outing_plan_members m1
    join public.outing_plan_members m2 on m2.plan_id = m1.plan_id
    join public.outing_plans p on p.id = m1.plan_id and p.status <> 'cancelled'
    where m1.user_id = a and m2.user_id = b and m1.status = 'joined' and m2.status = 'joined'));
$$;

create or replace function public.outing_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric) returns numeric
language sql immutable as $$
  select case when lat1 is null or lat2 is null then null else
    round((6371 * 2 * asin(sqrt(
      power(sin(radians((lat2 - lat1) / 2)), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians((lng2 - lng1) / 2)), 2))))::numeric, 1) end;
$$;

create or replace function public.outing_age(p_birth int) returns int
language sql stable as $$
  select case when p_birth is null then null else extract(year from now())::int - p_birth end;
$$;

-- Hard filters: true if a and b may be matched at all (women-only, age range, blocks, bans).
create or replace function public.outing_compatible(a uuid, b uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare pa public.outing_profiles; pb public.outing_profiles; age_a int; age_b int;
begin
  if a = b or public.is_blocked_between(a, b) then return false; end if;
  if exists (select 1 from public.profiles where id in (a, b) and is_banned) then return false; end if;
  select * into pa from public.outing_profiles where user_id = a;
  select * into pb from public.outing_profiles where user_id = b;
  if pa is null or pb is null then return false; end if;
  if coalesce((pa.pref->>'women_only')::boolean, false) and coalesce(pb.gender, '') <> 'woman' then return false; end if;
  if coalesce((pb.pref->>'women_only')::boolean, false) and coalesce(pa.gender, '') <> 'woman' then return false; end if;
  age_a := public.outing_age(pa.birth_year); age_b := public.outing_age(pb.birth_year);
  if age_b is not null and ((pa.pref ? 'age_min' and age_b < (pa.pref->>'age_min')::int)
                         or (pa.pref ? 'age_max' and age_b > (pa.pref->>'age_max')::int)) then return false; end if;
  if age_a is not null and ((pb.pref ? 'age_min' and age_a < (pb.pref->>'age_min')::int)
                         or (pb.pref ? 'age_max' and age_a > (pb.pref->>'age_max')::int)) then return false; end if;
  return true;
end $$;

-- Soft score 0–100 + human reasons built ONLY from public fields.
-- Hidden lifestyle answers lower the score only if that person allowed use_for_matching.
create or replace function public.outing_score(a uuid, b uuid, out score int, out reasons text[])
language plpgsql stable security definer set search_path = public as $$
declare pa public.outing_profiles; pb public.outing_profiles; la public.outing_lifestyle; lb public.outing_lifestyle;
        shared_act text[]; shared_hob text[]; shared_lang text[]; shared_slots int; km numeric; s int := 30;
begin
  reasons := '{}';
  select * into pa from public.outing_profiles where user_id = a;
  select * into pb from public.outing_profiles where user_id = b;
  select * into la from public.outing_lifestyle where user_id = a;
  select * into lb from public.outing_lifestyle where user_id = b;
  select coalesce(array_agg(x), '{}') into shared_act from unnest(pa.activities) x where x = any(pb.activities);
  select coalesce(array_agg(x), '{}') into shared_lang from unnest(pa.languages) x where x = any(pb.languages);
  select count(*) into shared_slots from unnest(pa.free_slots) x where x = any(pb.free_slots);
  if coalesce(pb.vis->>'hobbies', 'public') = 'public' then
    select coalesce(array_agg(x), '{}') into shared_hob from unnest(pa.hobbies) x where x = any(pb.hobbies);
  else shared_hob := '{}'; end if;
  s := s + least(coalesce(array_length(shared_act,1),0) * 10, 30)
         + least(coalesce(array_length(shared_hob,1),0) * 5, 20)
         + least(shared_slots * 4, 16)
         + case when coalesce(array_length(shared_lang,1),0) > 0 then 8 else 0 end;
  km := public.outing_km(pa.area_lat, pa.area_lng, pb.area_lat, pb.area_lng);
  if km is not null then s := s + case when km <= 5 then 10 when km <= 15 then 5 when km > 40 then -15 else 0 end; end if;
  -- lifestyle: what a wants to avoid vs b's answers (only if b allows it), and vice versa
  if lb.use_for_matching then
    if coalesce((pa.pref->'avoid'->>'smoking')::boolean,false) and lb.smoking in ('sometimes','yes') then s := s - 25; end if;
    if coalesce((pa.pref->'avoid'->>'cannabis')::boolean,false) and lb.cannabis in ('sometimes','yes') then s := s - 25; end if;
    if coalesce((pa.pref->'avoid'->>'alcohol')::boolean,false) and lb.alcohol in ('sometimes','yes') then s := s - 15; end if;
  end if;
  if la.use_for_matching then
    if coalesce((pb.pref->'avoid'->>'smoking')::boolean,false) and la.smoking in ('sometimes','yes') then s := s - 25; end if;
    if coalesce((pb.pref->'avoid'->>'cannabis')::boolean,false) and la.cannabis in ('sometimes','yes') then s := s - 25; end if;
    if coalesce((pb.pref->'avoid'->>'alcohol')::boolean,false) and la.alcohol in ('sometimes','yes') then s := s - 15; end if;
  end if;
  score := greatest(0, least(100, s));
  if array_length(shared_act,1) > 0 then reasons := reasons || ('هر دو: ' || array_to_string(shared_act[1:3], '، ')); end if;
  if array_length(shared_hob,1) > 0 then reasons := reasons || ('علاقهٔ مشترک: ' || array_to_string(shared_hob[1:3], '، ')); end if;
  if shared_slots > 0 then reasons := reasons || (shared_slots::text || ' وقت آزاد مشترک'); end if;
  if array_length(shared_lang,1) > 0 then reasons := reasons || ('زبان: ' || array_to_string(shared_lang[1:2], '، ')); end if;
  if km is not null and km < 1 then reasons := reasons || 'خیلی نزدیک هم';
  elsif km is not null and km <= 15 then reasons := reasons || ('حدود ' || round(km)::text || ' کیلومتر فاصله'); end if;
end $$;

-- Masked card of a user as seen by the caller.
create or replace function public.outing_card(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); pr public.profiles; op public.outing_profiles; tog boolean;
        v jsonb; res jsonb;
begin
  if me is null then raise exception 'unauthorized'; end if;
  select * into pr from public.profiles where id = p_user;
  if pr is null or (pr.is_banned and p_user <> me) or (p_user <> me and public.is_blocked_between(me, p_user)) then return null; end if;
  select * into op from public.outing_profiles where user_id = p_user;
  tog := public.outing_together(me, p_user);
  res := jsonb_build_object('id', pr.id, 'name', pr.name, 'avatar', pr.avatar, 'city', pr.city,
    'verified_id', pr.verified_id, 'rating_avg', pr.rating_avg, 'rating_count', pr.rating_count, 'together', tog);
  if op is null then return res; end if;
  v := op.vis;
  res := res || jsonb_build_object('activities', to_jsonb(op.activities), 'languages', to_jsonb(op.languages),
                                   'area_label', op.area_label, 'budget', op.budget);
  if p_user = me or v->>'age' = 'public' or (v->>'age' = 'matched' and tog) then
    res := res || jsonb_build_object('age', public.outing_age(op.birth_year)); end if;
  if p_user = me or coalesce(v->>'job','matched') = 'public' or (coalesce(v->>'job','matched') = 'matched' and tog) then
    res := res || jsonb_build_object('job', op.job); end if;
  if p_user = me or coalesce(v->>'hobbies','public') = 'public' or (v->>'hobbies' = 'matched' and tog) then
    res := res || jsonb_build_object('hobbies', to_jsonb(op.hobbies)); end if;
  if p_user = me or coalesce(v->>'places','public') = 'public' or (v->>'places' = 'matched' and tog) then
    res := res || jsonb_build_object('places_liked', to_jsonb(op.places_liked), 'places_been', to_jsonb(op.places_been)); end if;
  if p_user <> me then
    select res || jsonb_build_object('score', s.score, 'reasons', to_jsonb(s.reasons)) into res from public.outing_score(me, p_user) s;
  end if;
  return res;
end $$;

-- Lifestyle of a user as seen by the caller (mutual reveal).
create or replace function public.outing_lifestyle_of(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); mine public.outing_lifestyle; theirs public.outing_lifestyle; res jsonb := '{}'; tog boolean;
begin
  if me is null then raise exception 'unauthorized'; end if;
  select * into theirs from public.outing_lifestyle where user_id = p_user;
  if theirs is null then return res; end if;
  if p_user = me then return to_jsonb(theirs) - 'user_id' - 'updated_at'; end if;
  tog := public.outing_together(me, p_user);
  if not tog then return res; end if;
  select * into mine from public.outing_lifestyle where user_id = me;
  if mine is null then return res; end if;
  if theirs.alcohol_share = 'mutual' and mine.alcohol_share = 'mutual' and mine.alcohol is not null and theirs.alcohol is not null then
    res := res || jsonb_build_object('alcohol', theirs.alcohol); end if;
  if theirs.cannabis_share = 'mutual' and mine.cannabis_share = 'mutual' and mine.cannabis is not null and theirs.cannabis is not null then
    res := res || jsonb_build_object('cannabis', theirs.cannabis); end if;
  if theirs.smoking_share = 'mutual' and mine.smoking_share = 'mutual' and mine.smoking is not null and theirs.smoking is not null then
    res := res || jsonb_build_object('smoking', theirs.smoking); end if;
  return res;
end $$;

-- People near me who fit (both directions), best first.
create or replace function public.outing_matches(p_activity text default null, p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); mp public.outing_profiles; res jsonb;
begin
  if me is null then raise exception 'unauthorized'; end if;
  select * into mp from public.outing_profiles where user_id = me;
  if mp is null then return '[]'; end if;
  select coalesce(jsonb_agg(z.c), '[]') into res from (
    select q.c from (
      select public.outing_card(o.user_id) c
      from public.outing_profiles o
      where o.user_id <> me
        and (p_activity is null or p_activity = any(o.activities))
        and (mp.area_lat is null or o.area_lat is null
             or public.outing_km(mp.area_lat, mp.area_lng, o.area_lat, o.area_lng) <= greatest(mp.radius_km, o.radius_km))
        and public.outing_compatible(me, o.user_id)
      limit 300) q
    where q.c is not null
    order by (q.c->>'score')::int desc
    limit least(greatest(p_limit, 1), 50)) z;
  return res;
end $$;

-- ============================================================
-- plan RPCs
-- ============================================================
create or replace function public.create_outing_plan(
  p_title text, p_note text, p_activities text[], p_area_label text, p_lat numeric, p_lng numeric,
  p_women_only boolean, p_max int, p_slots timestamptz[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pid uuid; t timestamptz; g text;
begin
  if me is null then raise exception 'unauthorized'; end if;
  if (select count(*) from public.outing_plans where organizer = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited'; end if;
  if p_women_only then
    select gender into g from public.outing_profiles where user_id = me;
    if coalesce(g,'') <> 'woman' then raise exception 'women_only_requires_woman_organizer'; end if;
  end if;
  if coalesce(array_length(p_slots,1),0) > 12 then raise exception 'too_many_slots'; end if;
  insert into public.outing_plans (organizer, title, note, activity_options, area_label, area_lat, area_lng, women_only, max_people)
  values (me, trim(p_title), nullif(trim(p_note),''), coalesce(p_activities,'{}'), p_area_label, p_lat, p_lng, coalesce(p_women_only,false), coalesce(p_max,8))
  returning id into pid;
  insert into public.outing_plan_members (plan_id, user_id, role, status, area_lat, area_lng) values (pid, me, 'organizer', 'joined', p_lat, p_lng);
  foreach t in array coalesce(p_slots, '{}') loop
    if t > now() then insert into public.outing_plan_slots (plan_id, starts_at, added_by) values (pid, t, me); end if;
  end loop;
  insert into public.outing_messages (plan_id, sender, body) values (pid, null, 'برنامه ساخته شد. لینک دعوت را برای دوستانت بفرست 🌿');
  return pid;
end $$;

-- Preview by code (for the join page) — minimal info, no member data.
create or replace function public.outing_plan_preview(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'title', p.title, 'area_label', p.area_label, 'women_only', p.women_only,
    'status', p.status, 'organizer_name', pr.name, 'organizer_avatar', pr.avatar,
    'members', (select count(*) from public.outing_plan_members m where m.plan_id = p.id and m.status = 'joined'),
    'max_people', p.max_people, 'is_member', public.outing_is_member(p.id))
  from public.outing_plans p join public.profiles pr on pr.id = p.organizer
  where p.invite_code = upper(trim(p_code)) and auth.uid() is not null;
$$;

create or replace function public.join_outing_plan(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.outing_plans; n int; g text; ml numeric; mg numeric;
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
  select area_lat, area_lng into ml, mg from public.outing_profiles where user_id = me;
  insert into public.outing_plan_members (plan_id, user_id, role, status, area_lat, area_lng)
  values (p.id, me, 'member', 'joined', ml, mg)
  on conflict (plan_id, user_id) do update set status = 'joined', joined_at = now();
  insert into public.outing_messages (plan_id, sender, body)
  values (p.id, null, (select name from public.profiles where id = me) || ' به برنامه پیوست 👋');
  return p.id;
end $$;

create or replace function public.leave_outing_plan(p_plan uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if (select organizer from public.outing_plans where id = p_plan) = me then
    update public.outing_plans set status = 'cancelled' where id = p_plan;
    insert into public.outing_messages (plan_id, sender, body) values (p_plan, null, 'برگزارکننده برنامه را لغو کرد.');
  else
    update public.outing_plan_members set status = 'left' where plan_id = p_plan and user_id = me;
    delete from public.outing_slot_votes v using public.outing_plan_slots s where v.slot_id = s.id and s.plan_id = p_plan and v.user_id = me;
    insert into public.outing_messages (plan_id, sender, body)
    values (p_plan, null, (select name from public.profiles where id = me) || ' از برنامه بیرون رفت.');
  end if;
end $$;

-- Invite a matched person into my plan (they appear as invited; they accept by join code shown in their inbox).
create or replace function public.invite_to_outing_plan(p_plan uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not public.outing_is_member(p_plan) then raise exception 'forbidden'; end if;
  if not public.outing_compatible(me, p_user) then raise exception 'not_allowed'; end if;
  if (select women_only from public.outing_plans where id = p_plan)
     and coalesce((select gender from public.outing_profiles where user_id = p_user), '') <> 'woman' then
    raise exception 'women_only'; end if;
  insert into public.outing_plan_members (plan_id, user_id, role, status) values (p_plan, p_user, 'member', 'invited')
  on conflict (plan_id, user_id) do nothing;
end $$;

-- Everything the plan page needs, for members only (and invitees get a preview).
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
        'lifestyle', public.outing_lifestyle_of(m.user_id)) order by m.joined_at), '[]')
    from public.outing_plan_members m where m.plan_id = p_plan and m.status in ('joined','invited')));
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
  -- center of the group (rounded member areas), for place search
  res := res || jsonb_build_object('center', (
    select jsonb_build_object('lat', round(avg(m.area_lat), 2), 'lng', round(avg(m.area_lng), 2))
    from public.outing_plan_members m where m.plan_id = p_plan and m.status = 'joined' and m.area_lat is not null));
  -- hint for venues: only answers whose owner allowed use_for_matching, and only when ≥3 members (k-anonymity)
  res := res || jsonb_build_object('venue_hint', (
    select case when count(*) filter (where m.status = 'joined') < 3 then '{}'::jsonb else jsonb_build_object(
      'prefer_alcohol_free', bool_or(l.use_for_matching and l.alcohol = 'no'),
      'smokers_present', bool_or(l.use_for_matching and l.smoking in ('sometimes','yes'))) end
    from public.outing_plan_members m left join public.outing_lifestyle l on l.user_id = m.user_id
    where m.plan_id = p_plan and m.status = 'joined'));
  return res;
end $$;

create or replace function public.set_outing_activities(p_plan uuid, p_activities text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.outing_is_member(p_plan) then raise exception 'forbidden'; end if;
  update public.outing_plan_members set activities = coalesce(p_activities[1:10], '{}')
  where plan_id = p_plan and user_id = auth.uid();
end $$;

create or replace function public.vote_outing_slot(p_slot uuid, p_answer text) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select plan_id into pid from public.outing_plan_slots where id = p_slot;
  if pid is null or not public.outing_is_member(pid) then raise exception 'forbidden'; end if;
  if p_answer is null then delete from public.outing_slot_votes where slot_id = p_slot and user_id = auth.uid(); return; end if;
  insert into public.outing_slot_votes (slot_id, user_id, answer) values (p_slot, auth.uid(), p_answer)
  on conflict (slot_id, user_id) do update set answer = excluded.answer;
end $$;

create or replace function public.add_outing_slot(p_plan uuid, p_starts timestamptz) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.outing_is_member(p_plan) then raise exception 'forbidden'; end if;
  if p_starts <= now() then raise exception 'past'; end if;
  if (select count(*) from public.outing_plan_slots where plan_id = p_plan) >= 20 then raise exception 'too_many_slots'; end if;
  insert into public.outing_plan_slots (plan_id, starts_at, added_by) values (p_plan, p_starts, auth.uid()) returning id into sid;
  return sid;
end $$;

create or replace function public.add_outing_place(p_plan uuid, p_place jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not public.outing_is_member(p_plan) then raise exception 'forbidden'; end if;
  if (select count(*) from public.outing_plan_places where plan_id = p_plan) >= 30 then raise exception 'too_many_places'; end if;
  insert into public.outing_plan_places (plan_id, added_by, name, address, lat, lng, url, provider, kind)
  values (p_plan, auth.uid(), left(p_place->>'name',120), left(p_place->>'address',200),
          (p_place->>'lat')::numeric, (p_place->>'lng')::numeric, nullif(p_place->>'url',''),
          coalesce(p_place->>'provider','manual'), left(p_place->>'kind',40))
  returning id into pid;
  insert into public.outing_place_votes (place_id, user_id) values (pid, auth.uid());
  return pid;
end $$;

create or replace function public.toggle_outing_place_vote(p_place uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select plan_id into pid from public.outing_plan_places where id = p_place;
  if pid is null or not public.outing_is_member(pid) then raise exception 'forbidden'; end if;
  if exists (select 1 from public.outing_place_votes where place_id = p_place and user_id = auth.uid()) then
    delete from public.outing_place_votes where place_id = p_place and user_id = auth.uid();
  else insert into public.outing_place_votes (place_id, user_id) values (p_place, auth.uid()); end if;
end $$;

create or replace function public.confirm_outing_plan(p_plan uuid, p_slot uuid, p_place uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t timestamptz; pname text;
begin
  if (select organizer from public.outing_plans where id = p_plan) is distinct from auth.uid() then raise exception 'forbidden'; end if;
  select starts_at into t from public.outing_plan_slots where id = p_slot and plan_id = p_plan;
  if t is null then raise exception 'bad_slot'; end if;
  if p_place is not null then
    select name into pname from public.outing_plan_places where id = p_place and plan_id = p_plan;
    if pname is null then raise exception 'bad_place'; end if;
  end if;
  update public.outing_plans set status = 'confirmed', chosen_slot = p_slot, chosen_place = p_place where id = p_plan;
  insert into public.outing_messages (plan_id, sender, body)
  -- DECISION: Q14 (time zone of the system message)
  values (p_plan, null, '✅ قطعی شد: ' || to_char(t at time zone 'Europe/Amsterdam', 'YYYY-MM-DD HH24:MI')
          || coalesce(' — ' || pname, ''));
end $$;

-- ============================================================
-- intent RPCs
-- ============================================================
create or replace function public.create_outing_intent(
  p_activity text, p_title text, p_after timestamptz, p_before timestamptz,
  p_area_label text, p_lat numeric, p_lng numeric, p_radius int, p_want jsonb, p_max int) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); iid uuid;
begin
  if me is null then raise exception 'unauthorized'; end if;
  if not exists (select 1 from public.outing_profiles where user_id = me) then raise exception 'profile_required'; end if;
  if (select count(*) from public.outing_intents where user_id = me and created_at > now() - interval '1 day') >= 3 then
    raise exception 'rate_limited'; end if;
  if p_before <= now() then raise exception 'past'; end if;
  if coalesce((p_want->>'women_only')::boolean, false)
     and coalesce((select gender from public.outing_profiles where user_id = me), '') <> 'woman' then
    raise exception 'women_only_requires_woman'; end if;
  insert into public.outing_intents (user_id, activity, title, starts_after, starts_before, area_label, lat, lng, radius_km, want, max_people)
  values (me, p_activity, trim(p_title), greatest(p_after, now()), p_before, p_area_label, p_lat, p_lng,
          coalesce(p_radius, 10), coalesce(p_want, '{}'), coalesce(p_max, 1))
  returning id into iid;
  return iid;
end $$;

-- does user u fit intent i? (both-way hard filters + intent's own wants + distance)
create or replace function public.outing_fits_intent(i public.outing_intents, u uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare op public.outing_profiles; age int;
begin
  if not public.outing_compatible(i.user_id, u) then return false; end if;
  select * into op from public.outing_profiles where user_id = u;
  if op is null then return false; end if;
  if coalesce((i.want->>'women_only')::boolean,false) and coalesce(op.gender,'') <> 'woman' then return false; end if;
  age := public.outing_age(op.birth_year);
  if age is not null and ((i.want ? 'age_min' and age < (i.want->>'age_min')::int)
                       or (i.want ? 'age_max' and age > (i.want->>'age_max')::int)) then return false; end if;
  if op.area_lat is not null and public.outing_km(i.lat, i.lng, op.area_lat, op.area_lng) > greatest(i.radius_km, op.radius_km) then
    return false; end if;
  return true;
end $$;

-- Open invites near me that I fit.
create or replace function public.nearby_outing_intents() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'unauthorized'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'starts_after')) from (
    select jsonb_build_object('id', i.id, 'activity', i.activity, 'title', i.title, 'starts_after', i.starts_after,
      'starts_before', i.starts_before, 'area_label', i.area_label, 'max_people', i.max_people,
      'women_only', coalesce((i.want->>'women_only')::boolean, false),
      'by', public.outing_card(i.user_id),
      'my_response', (select status from public.outing_intent_responses r where r.intent_id = i.id and r.user_id = me)) x
    from public.outing_intents i
    where i.status = 'open' and i.starts_before > now() and i.user_id <> me and public.outing_fits_intent(i, me)
    order by i.starts_after limit 40) t), '[]');
end $$;

-- service role only: who to push about a new intent
create or replace function public.outing_intent_candidates(p_intent uuid, p_limit int default 30) returns setof uuid
language sql stable security definer set search_path = public as $$
  select o.user_id from public.outing_intents i, public.outing_profiles o
  where i.id = p_intent and o.user_id <> i.user_id
    and (i.activity = any(o.activities) or cardinality(o.activities) = 0)
    and public.outing_fits_intent(i, o.user_id)
  order by (select score from public.outing_score(i.user_id, o.user_id)) desc
  limit least(p_limit, 50);
$$;

create or replace function public.respond_outing_intent(p_intent uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
declare i public.outing_intents;
begin
  select * into i from public.outing_intents where id = p_intent;
  if i is null or i.status <> 'open' or i.user_id = auth.uid() or not public.outing_fits_intent(i, auth.uid()) then
    raise exception 'not_allowed'; end if;
  insert into public.outing_intent_responses (intent_id, user_id, message) values (p_intent, auth.uid(), left(p_message, 300))
  on conflict (intent_id, user_id) do update set message = excluded.message, status = 'interested';
end $$;

-- Owner view of an intent with responders' masked cards.
create or replace function public.outing_intent_detail(p_intent uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i public.outing_intents; me uuid := auth.uid();
begin
  select * into i from public.outing_intents where id = p_intent;
  if i is null then return null; end if;
  if i.user_id <> me then
    if not public.outing_fits_intent(i, me) and not exists (select 1 from public.outing_intent_responses where intent_id = i.id and user_id = me) then
      return null; end if;
    return jsonb_build_object('id', i.id, 'activity', i.activity, 'title', i.title, 'starts_after', i.starts_after,
      'starts_before', i.starts_before, 'area_label', i.area_label, 'status', i.status, 'is_owner', false,
      'plan_id', case when exists (select 1 from public.outing_plan_members m where m.plan_id = i.plan_id and m.user_id = me and m.status='joined') then i.plan_id end,
      'by', public.outing_card(i.user_id),
      'my_response', (select status from public.outing_intent_responses r where r.intent_id = i.id and r.user_id = me));
  end if;
  return to_jsonb(i) || jsonb_build_object('is_owner', true, 'responses', (
    select coalesce(jsonb_agg(public.outing_card(r.user_id) || jsonb_build_object('status', r.status, 'message', r.message)
      order by r.created_at), '[]')
    from public.outing_intent_responses r where r.intent_id = i.id and not public.is_blocked_between(me, r.user_id)));
end $$;

create or replace function public.accept_outing_response(p_intent uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare i public.outing_intents; pid uuid; n int;
begin
  select * into i from public.outing_intents where id = p_intent for update;
  if i is null or i.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if i.status <> 'open' then raise exception 'closed'; end if;
  if not exists (select 1 from public.outing_intent_responses where intent_id = p_intent and user_id = p_user and status = 'interested') then
    raise exception 'no_response'; end if;
  pid := i.plan_id;
  if pid is null then
    insert into public.outing_plans (organizer, title, activity_options, area_label, area_lat, area_lng, women_only, max_people, source_intent)
    values (i.user_id, i.title, array[i.activity], i.area_label, i.lat, i.lng, coalesce((i.want->>'women_only')::boolean,false), i.max_people + 1, i.id)
    returning id into pid;
    insert into public.outing_plan_members (plan_id, user_id, role, status, activities, area_lat, area_lng)
    values (pid, i.user_id, 'organizer', 'joined', array[i.activity], i.lat, i.lng);
    insert into public.outing_messages (plan_id, sender, body) values (pid, null, 'از دعوت باز ساخته شد. یک وقت و جا انتخاب کنید ☕');
    update public.outing_intents set plan_id = pid where id = i.id;
  end if;
  insert into public.outing_plan_members (plan_id, user_id, role, status, activities)
  values (pid, p_user, 'member', 'joined', array[i.activity])
  on conflict (plan_id, user_id) do update set status = 'joined';
  update public.outing_intent_responses set status = 'accepted' where intent_id = p_intent and user_id = p_user;
  select count(*) - 1 into n from public.outing_plan_members where plan_id = pid and status = 'joined';
  if n >= i.max_people then update public.outing_intents set status = 'matched' where id = i.id; end if;
  insert into public.outing_messages (plan_id, sender, body)
  values (pid, null, (select name from public.profiles where id = p_user) || ' اضافه شد 🎉');
  return pid;
end $$;

-- ============================================================
-- RLS for plan tables: read through membership; writes only via RPCs (except messages + own intents)
-- ============================================================
alter table public.outing_plans            enable row level security;
alter table public.outing_plan_members     enable row level security;
alter table public.outing_plan_slots       enable row level security;
alter table public.outing_slot_votes       enable row level security;
alter table public.outing_plan_places      enable row level security;
alter table public.outing_place_votes      enable row level security;
alter table public.outing_messages         enable row level security;
alter table public.outing_intents          enable row level security;
alter table public.outing_intent_responses enable row level security;

create policy oplans_read on public.outing_plans for select to authenticated
  using (public.outing_is_member(id) or exists (select 1 from public.outing_plan_members m
         where m.plan_id = id and m.user_id = auth.uid() and m.status = 'invited'));
create policy opm_read on public.outing_plan_members for select to authenticated
  using (user_id = auth.uid() or public.outing_is_member(plan_id));
create policy ops_read on public.outing_plan_slots for select to authenticated using (public.outing_is_member(plan_id));
create policy osv_read on public.outing_slot_votes for select to authenticated
  using (exists (select 1 from public.outing_plan_slots s where s.id = slot_id and public.outing_is_member(s.plan_id)));
create policy opp_read on public.outing_plan_places for select to authenticated using (public.outing_is_member(plan_id));
create policy opv_read on public.outing_place_votes for select to authenticated
  using (exists (select 1 from public.outing_plan_places p where p.id = place_id and public.outing_is_member(p.plan_id)));
create policy om_read on public.outing_messages for select to authenticated using (public.outing_is_member(plan_id));
create policy om_insert on public.outing_messages for insert to authenticated
  with check (sender = auth.uid() and public.outing_is_member(plan_id)
              and (select status from public.outing_plans where id = plan_id) <> 'cancelled');
create policy oi_own_read on public.outing_intents for select to authenticated using (user_id = auth.uid());
create policy oi_own_update on public.outing_intents for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('open','closed'));
create policy oir_read on public.outing_intent_responses for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.outing_intents i where i.id = intent_id and i.user_id = auth.uid()));
create policy oir_withdraw on public.outing_intent_responses for delete to authenticated using (user_id = auth.uid());

-- intents: owners may only close or reopen; nothing else is user-writable
revoke update on public.outing_intents from authenticated;
grant update (status) on public.outing_intents to authenticated;

-- realtime for plan chat
do $$ begin
  alter publication supabase_realtime add table public.outing_messages;
exception when others then null; end $$;

-- ---------- grants on functions ----------
do $$
declare f text;
begin
  foreach f in array array[
    'outing_is_member(uuid,uuid)','outing_together(uuid,uuid)','outing_compatible(uuid,uuid)','outing_score(uuid,uuid)',
    'outing_card(uuid)','outing_lifestyle_of(uuid)','outing_matches(text,int)',
    'create_outing_plan(text,text,text[],text,numeric,numeric,boolean,int,timestamptz[])','outing_plan_preview(text)',
    'join_outing_plan(text)','leave_outing_plan(uuid)','invite_to_outing_plan(uuid,uuid)','outing_plan_detail(uuid)',
    'set_outing_activities(uuid,text[])','vote_outing_slot(uuid,text)','add_outing_slot(uuid,timestamptz)',
    'add_outing_place(uuid,jsonb)','toggle_outing_place_vote(uuid)','confirm_outing_plan(uuid,uuid,uuid)',
    'create_outing_intent(text,text,timestamptz,timestamptz,text,numeric,numeric,int,jsonb,int)',
    'outing_fits_intent(public.outing_intents,uuid)','nearby_outing_intents()','outing_intent_candidates(uuid,int)',
    'respond_outing_intent(uuid,text)','outing_intent_detail(uuid)','accept_outing_response(uuid,uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
  end loop;
end $$;

-- internal helpers: not callable by users (they could be used to probe hidden data)
revoke all on function public.outing_compatible(uuid,uuid) from authenticated;
revoke all on function public.outing_score(uuid,uuid) from authenticated;
revoke all on function public.outing_fits_intent(public.outing_intents,uuid) from authenticated;
revoke all on function public.outing_intent_candidates(uuid,int) from authenticated;
grant execute on function public.outing_intent_candidates(uuid,int) to service_role;

grant execute on function
  public.outing_is_member(uuid,uuid), public.outing_together(uuid,uuid),
  public.outing_card(uuid), public.outing_lifestyle_of(uuid), public.outing_matches(text,int),
  public.create_outing_plan(text,text,text[],text,numeric,numeric,boolean,int,timestamptz[]), public.outing_plan_preview(text),
  public.join_outing_plan(text), public.leave_outing_plan(uuid), public.invite_to_outing_plan(uuid,uuid), public.outing_plan_detail(uuid),
  public.set_outing_activities(uuid,text[]), public.vote_outing_slot(uuid,text), public.add_outing_slot(uuid,timestamptz),
  public.add_outing_place(uuid,jsonb), public.toggle_outing_place_vote(uuid), public.confirm_outing_plan(uuid,uuid,uuid),
  public.create_outing_intent(text,text,timestamptz,timestamptz,text,numeric,numeric,int,jsonb,int),
  public.nearby_outing_intents(), public.respond_outing_intent(uuid,text), public.outing_intent_detail(uuid),
  public.accept_outing_response(uuid,uuid)
to authenticated;
