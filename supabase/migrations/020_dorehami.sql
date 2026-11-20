-- ============================================================
-- 020 — «دورهمی» (module DH): link-based group meetup poll inside Hamrah.
-- Guests answer WITHOUT an account (anon key + secret tokens); signed-in users get the
-- same flow plus: answers linked to their account, a "my meetups" list, and turning a
-- finalized meetup into a Hamrah outing plan (chat, members) with one tap.
-- Privacy model:
--   * Tables are not readable by anon/authenticated. Everything goes through security-definer RPCs.
--   * Each person chooses which answer groups are public (shown with their name).
--     Private answers are returned only inside the shuffled, nameless "anon" array used for
--     place/time/venue computation.
--   * edit_token (per response) and admin_token (per meetup) are random secrets held by the browser.
-- Depends on: 001 (profiles), 010 (outing_* tables). Idempotent.
-- ============================================================

create table if not exists public.dh_meetups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default lower(substr(md5(gen_random_uuid()::text), 1, 10)),
  admin_token text not null default md5(gen_random_uuid()::text || clock_timestamp()::text),
  title text not null check (char_length(title) between 1 and 80),
  note text check (char_length(note) <= 500),
  organizer_name text check (char_length(organizer_name) <= 40),
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 10),
  women_only boolean not null default false,
  final jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.dh_responses (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.dh_meetups on delete cascade,
  edit_token text not null default md5(gen_random_uuid()::text || clock_timestamp()::text),
  name text not null check (char_length(name) between 1 and 40),
  data jsonb not null default '{}' check (pg_column_size(data) < 12000),
  public_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dh_resp_meetup on public.dh_responses (meetup_id);

-- account links (nullable: guests have none)
alter table public.dh_meetups   add column if not exists organizer_id uuid references public.profiles on delete set null;
alter table public.dh_meetups   add column if not exists plan_id uuid references public.outing_plans on delete set null;
alter table public.dh_responses add column if not exists user_id uuid references public.profiles on delete set null;
create index if not exists dh_meet_org on public.dh_meetups (organizer_id);
create index if not exists dh_resp_user on public.dh_responses (user_id);
create unique index if not exists dh_resp_one_per_user on public.dh_responses (meetup_id, user_id) where user_id is not null;

alter table public.dh_meetups enable row level security;
alter table public.dh_responses enable row level security;
revoke all on public.dh_meetups, public.dh_responses from anon, authenticated;

-- the signed-in caller if they have a Hamrah profile, else null
create or replace function public.dh_me() returns uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p where p.id = auth.uid() and not p.is_banned;
$$;

create or replace function public.dh_create(p_title text, p_note text, p_organizer text, p_options jsonb, p_women_only boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.dh_meetups;
begin
  if (select count(*) from public.dh_meetups where created_at > now() - interval '1 hour') >= 60 then raise exception 'rate_limited'; end if;
  if jsonb_typeof(coalesce(p_options,'[]')) <> 'array' then raise exception 'bad_options'; end if;
  insert into public.dh_meetups (title, note, organizer_name, options, women_only, organizer_id)
  values (left(trim(p_title),80), nullif(left(trim(coalesce(p_note,'')),500),''), left(trim(coalesce(p_organizer,'')),40),
          coalesce(p_options,'[]'), coalesce(p_women_only,false), public.dh_me())
  returning * into m;
  return jsonb_build_object('code', m.code, 'admin_token', m.admin_token);
end $$;

create or replace function public.dh_get(p_code text, p_admin text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.dh_meetups; people jsonb; agg jsonb; me uuid := public.dh_me(); is_admin boolean;
begin
  select * into m from public.dh_meetups where code = lower(trim(p_code));
  if m is null then return null; end if;
  is_admin := (p_admin is not null and p_admin = m.admin_token) or (me is not null and me = m.organizer_id);
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'member', r.user_id is not null) ||
           coalesce((select jsonb_object_agg(k, r.data->k) from unnest(r.public_fields) k where r.data ? k), '{}')
         order by r.created_at), '[]')
    into people from public.dh_responses r where r.meetup_id = m.id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'origin', r.data->'origin', 'modes', r.data->'modes', 'max_min', r.data->'max_min',
      'night_alone', r.data->'night_alone', 'avail', r.data->'avail', 'activities', r.data->'activities',
      'diet', r.data->'diet', 'allergy', r.data->'allergy', 'budget', r.data->'budget',
      'alcohol', r.data->'alcohol', 'smoke', r.data->'smoke', 'weed', r.data->'weed',
      'langs', r.data->'langs', 'photo', r.data->'photo', 'quiet', r.data->'quiet', 'access', r.data->'access',
      'hobbies', r.data->'hobbies', 'seats', r.data->'seats', 'until', r.data->'until') order by random()), '[]')
    into agg from public.dh_responses r where r.meetup_id = m.id;
  return jsonb_build_object('code', m.code, 'title', m.title, 'note', m.note, 'organizer_name', m.organizer_name,
    'options', m.options, 'women_only', m.women_only, 'final', m.final, 'created_at', m.created_at,
    'is_admin', is_admin, 'admin_token', case when is_admin then m.admin_token end,
    'plan_id', case when me is not null and m.plan_id is not null and public.outing_is_member(m.plan_id, me) then m.plan_id end,
    'has_plan', m.plan_id is not null,
    'my_edit', (select r.edit_token from public.dh_responses r where me is not null and r.meetup_id = m.id and r.user_id = me),
    'count', jsonb_array_length(people), 'people', people, 'anon', agg);
end $$;

create or replace function public.dh_respond(p_code text, p_edit text, p_name text, p_data jsonb, p_public text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.dh_meetups; r public.dh_responses; me uuid := public.dh_me();
begin
  select * into m from public.dh_meetups where code = lower(trim(p_code));
  if m is null then raise exception 'not_found'; end if;
  if jsonb_typeof(coalesce(p_data,'{}')) <> 'object' then raise exception 'bad_data'; end if;
  if p_edit is not null then
    update public.dh_responses set name = left(trim(p_name),40), data = p_data, public_fields = coalesce(p_public[1:40],'{}'),
           updated_at = now(), user_id = coalesce(user_id, me)
    where meetup_id = m.id and edit_token = p_edit returning * into r;
  end if;
  if r is null and me is not null then   -- a member answers once per meetup, from any device
    update public.dh_responses set name = left(trim(p_name),40), data = p_data, public_fields = coalesce(p_public[1:40],'{}'), updated_at = now()
    where meetup_id = m.id and user_id = me returning * into r;
  end if;
  if r is null then
    if (select count(*) from public.dh_responses where meetup_id = m.id) >= 40 then raise exception 'full'; end if;
    insert into public.dh_responses (meetup_id, name, data, public_fields, user_id)
    values (m.id, left(trim(p_name),40), coalesce(p_data,'{}'), coalesce(p_public[1:40],'{}'), me) returning * into r;
  end if;
  return jsonb_build_object('edit_token', r.edit_token, 'id', r.id);
end $$;

create or replace function public.dh_mine(p_code text, p_edit text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'name', r.name, 'data', r.data, 'public_fields', to_jsonb(r.public_fields), 'edit_token', r.edit_token)
  from public.dh_responses r join public.dh_meetups m on m.id = r.meetup_id
  where m.code = lower(trim(p_code))
    and ((p_edit is not null and r.edit_token = p_edit) or (public.dh_me() is not null and r.user_id = public.dh_me()))
  limit 1;
$$;

create or replace function public.dh_delete_mine(p_code text, p_edit text)
returns void language sql security definer set search_path = public as $$
  delete from public.dh_responses r using public.dh_meetups m
  where m.id = r.meetup_id and m.code = lower(trim(p_code))
    and ((p_edit is not null and r.edit_token = p_edit) or (public.dh_me() is not null and r.user_id = public.dh_me()));
$$;

create or replace function public.dh_finalize(p_code text, p_admin text, p_final jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare m public.dh_meetups; t timestamptz;
begin
  if pg_column_size(p_final) > 4000 then raise exception 'too_big'; end if;
  select * into m from public.dh_meetups where code = lower(trim(p_code));
  if m is null or not ((p_admin is not null and p_admin = m.admin_token) or (public.dh_me() is not null and public.dh_me() = m.organizer_id)) then
    raise exception 'forbidden'; end if;
  update public.dh_meetups set final = p_final where id = m.id;
  -- keep a linked Hamrah plan in sync
  if m.plan_id is not null and p_final is not null and p_final ? 'd' then
    begin
      t := ((p_final->>'d') || ' ' || coalesce(nullif(p_final->>'t',''),'15:00'))::timestamp at time zone 'Europe/Amsterdam';
      insert into public.outing_messages (plan_id, sender, body)
      values (m.plan_id, null, '📌 دورهمی به‌روز شد: ' || to_char(t at time zone 'Europe/Amsterdam', 'YYYY-MM-DD HH24:MI')
              || coalesce(' — ' || nullif(p_final->>'venue',''), ''));
    exception when others then null; end;
  end if;
end $$;

create or replace function public.dh_delete_meetup(p_code text, p_admin text)
returns void language sql security definer set search_path = public as $$
  delete from public.dh_meetups
  where code = lower(trim(p_code))
    and ((p_admin is not null and admin_token = p_admin) or (public.dh_me() is not null and organizer_id = public.dh_me()));
$$;

-- a signed-in user adopts what they did as a guest on this device (tokens from localStorage)
create or replace function public.dh_claim(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare me uuid := public.dh_me(); it jsonb; n int := 0; k int;
begin
  if me is null then return 0; end if;
  if jsonb_typeof(p_items) <> 'array' then return 0; end if;
  for it in select * from jsonb_array_elements(p_items) limit 50 loop
    if it->>'admin' is not null then
      update public.dh_meetups set organizer_id = me
      where code = lower(it->>'code') and admin_token = it->>'admin' and organizer_id is null;
      get diagnostics k = row_count; n := n + k;
    end if;
    if it->>'edit' is not null then
      update public.dh_responses r set user_id = me
      from public.dh_meetups m
      where m.id = r.meetup_id and m.code = lower(it->>'code') and r.edit_token = it->>'edit' and r.user_id is null
        and not exists (select 1 from public.dh_responses x where x.meetup_id = r.meetup_id and x.user_id = me);
      get diagnostics k = row_count; n := n + k;
    end if;
  end loop;
  return n;
end $$;

-- meetups I organize or answered (for the «بیرون» hub)
create or replace function public.dh_my_meetups() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]') from (
    select jsonb_build_object('code', m.code, 'title', m.title, 'final', m.final, 'created_at', m.created_at,
      'is_admin', m.organizer_id = public.dh_me(),
      'answered', exists (select 1 from public.dh_responses r where r.meetup_id = m.id and r.user_id = public.dh_me()),
      'count', (select count(*) from public.dh_responses r where r.meetup_id = m.id)) x
    from public.dh_meetups m
    where public.dh_me() is not null
      and (m.organizer_id = public.dh_me() or exists (select 1 from public.dh_responses r where r.meetup_id = m.id and r.user_id = public.dh_me()))
    order by m.created_at desc limit 30) t;
$$;

-- turn a meetup into a Hamrah outing plan: chat, reminders, members (only people who answered while signed in)
create or replace function public.dh_to_plan(p_code text, p_admin text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := public.dh_me(); m public.dh_meetups; pid uuid; sid uuid; plid uuid; t timestamptz;
        c record; lat numeric; lng numeric; n int;
begin
  if me is null then raise exception 'unauthorized'; end if;
  select * into m from public.dh_meetups where code = lower(trim(p_code)) for update;
  if m is null then raise exception 'not_found'; end if;
  if not ((p_admin is not null and p_admin = m.admin_token) or me = m.organizer_id) then raise exception 'forbidden'; end if;
  if m.plan_id is not null then return m.plan_id; end if;
  if m.organizer_id is null then update public.dh_meetups set organizer_id = me where id = m.id; end if;
  select avg(((r.data->'origin'->>'lat'))::numeric), avg(((r.data->'origin'->>'lng'))::numeric) into lat, lng
    from public.dh_responses r where r.meetup_id = m.id and r.data->'origin' ? 'lat';
  insert into public.outing_plans (organizer, title, note, activity_options, area_label, area_lat, area_lng, women_only, max_people)
  values (me, m.title, m.note, '{}', coalesce(m.final->>'city_fa', m.final->>'city'), round(lat,2), round(lng,2),
          false, greatest(least((select count(*) from public.dh_responses where meetup_id = m.id) + 2, 30), 2))
  returning id into pid;
  insert into public.outing_plan_members (plan_id, user_id, role, status) values (pid, me, 'organizer', 'joined');
  insert into public.outing_plan_members (plan_id, user_id, role, status)
    select pid, r.user_id, 'member', 'joined' from public.dh_responses r
    where r.meetup_id = m.id and r.user_id is not null and r.user_id <> me and not public.is_blocked_between(me, r.user_id)
    on conflict (plan_id, user_id) do nothing;
  -- the candidate days become the plan's time options
  for c in select e from jsonb_array_elements(m.options) e loop
    begin
      t := ((c.e->>'d') || ' ' || coalesce(nullif(c.e->>'t',''),'15:00'))::timestamp at time zone 'Europe/Amsterdam';
      if t > now() then
        insert into public.outing_plan_slots (plan_id, starts_at, added_by) values (pid, t, me) returning id into sid;
        if m.final is not null and m.final->>'d' = c.e->>'d' then
          update public.outing_plans set chosen_slot = sid where id = pid;
        end if;
      end if;
    exception when others then null; end;
  end loop;
  if m.final is not null and nullif(m.final->>'venue','') is not null then
    insert into public.outing_plan_places (plan_id, added_by, name, address, provider)
    values (pid, me, left(m.final->>'venue',120), left(m.final->>'address',200), 'manual') returning id into plid;
    update public.outing_plans set chosen_place = plid where id = pid;
  end if;
  if m.final is not null and (select chosen_slot from public.outing_plans where id = pid) is not null then
    update public.outing_plans set status = 'confirmed' where id = pid;
  end if;
  update public.dh_meetups set plan_id = pid where id = m.id;
  select count(*) - 1 into n from public.outing_plan_members where plan_id = pid and status = 'joined';
  insert into public.outing_messages (plan_id, sender, body)
  values (pid, null, '🌿 از دورهمی «' || m.title || '» ساخته شد. ' || n::text
          || ' نفر از جواب‌دهنده‌ها حساب همراه دارند و اضافه شدند؛ بقیه با لینک دورهمی می‌توانند بپیوندند.');
  return pid;
end $$;

-- people who answered a meetup can join its Hamrah plan after signing in
create or replace function public.dh_join_plan(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := public.dh_me(); m public.dh_meetups; o uuid;
begin
  if me is null then raise exception 'unauthorized'; end if;
  select * into m from public.dh_meetups where code = lower(trim(p_code));
  if m is null or m.plan_id is null then raise exception 'not_found'; end if;
  if not exists (select 1 from public.dh_responses where meetup_id = m.id and user_id = me) then raise exception 'answer_first'; end if;
  select organizer into o from public.outing_plans where id = m.plan_id;
  if public.is_blocked_between(me, o) then raise exception 'not_found'; end if;
  insert into public.outing_plan_members (plan_id, user_id, role, status) values (m.plan_id, me, 'member', 'joined')
  on conflict (plan_id, user_id) do update set status = 'joined';
  insert into public.outing_messages (plan_id, sender, body)
  values (m.plan_id, null, (select name from public.profiles where id = me) || ' به برنامه پیوست 👋');
  return m.plan_id;
end $$;

do $$
declare f text;
begin
  foreach f in array array['dh_me()','dh_create(text,text,text,jsonb,boolean)','dh_get(text,text)','dh_respond(text,text,text,jsonb,text[])',
    'dh_mine(text,text)','dh_delete_mine(text,text)','dh_finalize(text,text,jsonb)','dh_delete_meetup(text,text)',
    'dh_claim(jsonb)','dh_my_meetups()','dh_to_plan(text,text)','dh_join_plan(text)']
  loop execute format('revoke all on function public.%s from public, anon, authenticated', f); end loop;
end $$;
grant execute on function public.dh_create(text,text,text,jsonb,boolean), public.dh_get(text,text),
  public.dh_respond(text,text,text,jsonb,text[]), public.dh_mine(text,text), public.dh_delete_mine(text,text),
  public.dh_finalize(text,text,jsonb), public.dh_delete_meetup(text,text) to anon, authenticated;
grant execute on function public.dh_claim(jsonb), public.dh_my_meetups(), public.dh_to_plan(text,text), public.dh_join_plan(text) to authenticated;
