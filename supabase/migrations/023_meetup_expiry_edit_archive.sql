-- 023_meetup_expiry_edit_archive.sql
-- Adds expiry date and archive flags to dh_meetups, plus edit/archive functions

alter table public.dh_meetups add column if not exists expires_at timestamptz;
alter table public.dh_meetups add column if not exists is_archived boolean not null default false;
create index if not exists dh_meet_exp on public.dh_meetups (expires_at) where expires_at is not null;
create index if not exists dh_meet_arch on public.dh_meetups (is_archived);

-- Update dh_create with optional p_expires_at
create or replace function public.dh_create(
  p_title text,
  p_note text,
  p_organizer text,
  p_options jsonb,
  p_women_only boolean,
  p_expires_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.dh_meetups;
begin
  if (select count(*) from public.dh_meetups where created_at > now() - interval '1 hour') >= 60 then raise exception 'rate_limited'; end if;
  if jsonb_typeof(coalesce(p_options,'[]')) <> 'array' then raise exception 'bad_options'; end if;
  insert into public.dh_meetups (title, note, organizer_name, options, women_only, organizer_id, expires_at)
  values (left(trim(p_title),80), nullif(left(trim(coalesce(p_note,'')),500),''), left(trim(coalesce(p_organizer,'')),40),
          coalesce(p_options,'[]'), coalesce(p_women_only,false), public.dh_me(), p_expires_at)
  returning * into m;
  return jsonb_build_object('code', m.code, 'admin_token', m.admin_token);
end $$;

-- Update dh_get to return expires_at and is_archived
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
    'expires_at', m.expires_at, 'is_archived', coalesce(m.is_archived, false),
    'is_expired', case when m.expires_at is not null then m.expires_at < now() else false end,
    'is_admin', is_admin, 'admin_token', case when is_admin then m.admin_token end,
    'plan_id', case when me is not null and m.plan_id is not null and public.outing_is_member(m.plan_id, me) then m.plan_id end,
    'has_plan', m.plan_id is not null,
    'my_edit', (select r.edit_token from public.dh_responses r where me is not null and r.meetup_id = m.id and r.user_id = me),
    'count', jsonb_array_length(people), 'people', people, 'anon', agg);
end $$;

-- RPC for updating meetup details
create or replace function public.dh_edit_meetup(
  p_code text,
  p_admin text,
  p_title text,
  p_note text,
  p_women_only boolean,
  p_expires_at timestamptz default null,
  p_options jsonb default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.dh_meetups;
begin
  select * into m from public.dh_meetups where code = lower(trim(p_code));
  if m is null or not ((p_admin is not null and p_admin = m.admin_token) or (public.dh_me() is not null and public.dh_me() = m.organizer_id)) then
    raise exception 'forbidden';
  end if;
  if p_options is not null and jsonb_typeof(p_options) <> 'array' then
    raise exception 'bad_options';
  end if;

  update public.dh_meetups
  set title = left(trim(p_title), 80),
      note = nullif(left(trim(coalesce(p_note,'')),500),''),
      women_only = coalesce(p_women_only, women_only),
      expires_at = p_expires_at,
      options = coalesce(p_options, options)
  where id = m.id
  returning * into m;

  return jsonb_build_object('code', m.code, 'title', m.title, 'note', m.note, 'expires_at', m.expires_at, 'is_archived', coalesce(m.is_archived, false));
end $$;

-- RPC for toggling meetup archive state
create or replace function public.dh_archive_meetup(
  p_code text,
  p_admin text,
  p_archive boolean default true
)
returns boolean language plpgsql security definer set search_path = public as $$
declare m public.dh_meetups;
begin
  select * into m from public.dh_meetups where code = lower(trim(p_code));
  if m is null or not ((p_admin is not null and p_admin = m.admin_token) or (public.dh_me() is not null and public.dh_me() = m.organizer_id)) then
    raise exception 'forbidden';
  end if;

  update public.dh_meetups
  set is_archived = coalesce(p_archive, true)
  where id = m.id;

  return coalesce(p_archive, true);
end $$;
