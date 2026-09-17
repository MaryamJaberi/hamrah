-- ============================================================
-- 001 — core: profiles, goals, requests, connections, messages, sessions
-- ============================================================
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  avatar text not null default '🙂',
  city text not null default 'آنلاین',
  bio text check (char_length(bio) <= 500),
  interests text[] not null default '{}',
  teach_langs text[] not null default '{}',
  learn_langs text[] not null default '{}',
  mode text not null default 'both' check (mode in ('online','inperson','both')),
  -- mentorship
  is_mentor boolean not null default false,
  mentor_price int not null default 0 check (mentor_price >= 0), -- smallest unit: cents (usd) or rial (irr)
  mentor_currency text not null default 'usd' check (mentor_currency in ('usd','eur','irr')),
  mentor_bio text,
  mentor_topics text[] not null default '{}',
  -- trust (written only by server / triggers)
  verified_email boolean not null default false,
  verified_phone boolean not null default false,
  verified_id boolean not null default false,
  kyc_status text not null default 'none' check (kyc_status in ('none','pending','approved','rejected')),
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category text not null default 'عمومی',
  mode text not null default 'both' check (mode in ('online','inperson','both')),
  per_week int not null default 2 check (per_week between 1 and 7),
  level text not null default 'medium' check (level in ('light','medium','serious')),
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now()
);
create index on public.goals (user_id);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  goal_id uuid references public.goals on delete set null,
  message text check (char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create unique index requests_one_pending on public.requests (from_user, to_user) where status = 'pending';
create index on public.requests (to_user, status);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  kind text not null default 'buddy' check (kind in ('buddy','mentorship')),
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b, kind)
);
create index on public.connections (user_b);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections on delete cascade,
  sender uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.messages (connection_id, created_at);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections on delete cascade,
  host uuid not null references public.profiles on delete cascade,
  starts_at timestamptz not null default now(),
  planned_min int not null default 25 check (planned_min between 5 and 240),
  actual_min int check (actual_min between 0 and 600),
  status text not null default 'done' check (status in ('planned','done','cancelled')),
  checkin jsonb not null default '{}',
  notes text,
  wrapup jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.sessions (connection_id, starts_at desc);

-- ---------- helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_participant(p_conn uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.connections c
                 where c.id = p_conn and auth.uid() in (c.user_a, c.user_b));
$$;

-- ---------- RLS ----------
alter table public.profiles    enable row level security;
alter table public.goals       enable row level security;
alter table public.requests    enable row level security;
alter table public.connections enable row level security;
alter table public.messages    enable row level security;
alter table public.sessions    enable row level security;

create policy profiles_read   on public.profiles for select to authenticated using (not is_banned or id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Column-level grants: users can never write trust/admin columns themselves.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, name, avatar, city, bio, interests, teach_langs, learn_langs, mode) on public.profiles to authenticated;
grant update (name, avatar, city, bio, interests, teach_langs, learn_langs, mode,
              is_mentor, mentor_price, mentor_currency, mentor_bio, mentor_topics) on public.profiles to authenticated;

create policy goals_read  on public.goals for select to authenticated using (true);
create policy goals_write on public.goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy requests_read   on public.requests for select to authenticated using (auth.uid() in (from_user, to_user));
create policy requests_insert on public.requests for insert to authenticated with check (from_user = auth.uid() and status = 'pending');
create policy requests_update on public.requests for update to authenticated using (to_user = auth.uid() and status = 'pending');
revoke update on public.requests from anon, authenticated;
grant update (status) on public.requests to authenticated;

-- connections are created only by accept_request() or the server (payments)
create policy connections_read on public.connections for select to authenticated using (auth.uid() in (user_a, user_b));

create policy messages_read   on public.messages for select to authenticated using (public.is_participant(connection_id));
create policy messages_insert on public.messages for insert to authenticated with check (sender = auth.uid() and public.is_participant(connection_id));

create policy sessions_read   on public.sessions for select to authenticated using (public.is_participant(connection_id));
create policy sessions_insert on public.sessions for insert to authenticated with check (host = auth.uid() and public.is_participant(connection_id));
create policy sessions_update on public.sessions for update to authenticated using (host = auth.uid());

-- ---------- accept a request atomically ----------
create or replace function public.accept_request(p_request uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.requests; v_conn uuid; a uuid; b uuid;
begin
  select * into r from public.requests where id = p_request for update;
  if r.id is null or r.to_user <> auth.uid() or r.status <> 'pending' then
    raise exception 'request not found';
  end if;
  update public.requests set status = 'accepted' where id = r.id;
  a := least(r.from_user, r.to_user); b := greatest(r.from_user, r.to_user);
  insert into public.connections (user_a, user_b, kind) values (a, b, 'buddy')
    on conflict (user_a, user_b, kind) do update set status = 'active'
    returning id into v_conn;
  if r.message is not null then
    insert into public.messages (connection_id, sender, body, created_at)
    values (v_conn, r.from_user, r.message, r.created_at);
  end if;
  return v_conn;
end $$;
revoke all on function public.accept_request(uuid) from public, anon;
grant execute on function public.accept_request(uuid) to authenticated;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.requests;
