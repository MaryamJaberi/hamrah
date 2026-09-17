-- ============================================================
-- 003 — phone OTP, search, push tokens, payments
-- ============================================================
create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  used boolean not null default false,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on public.otp_codes (phone, created_at desc);
alter table public.otp_codes enable row level security; -- no policies: service role only

-- ---------- search ----------
create extension if not exists pg_trgm;
create index if not exists profiles_name_trgm on public.profiles using gin (name gin_trgm_ops);
create index if not exists profiles_bio_trgm  on public.profiles using gin (bio gin_trgm_ops);
create index if not exists profiles_interests on public.profiles using gin (interests);
create index if not exists profiles_topics    on public.profiles using gin (mentor_topics);

create or replace function public.search_people(
  p_q text default null, p_interests text[] default null, p_teach text[] default null,
  p_learn text[] default null, p_city text default null, p_mode text default null,
  p_only_verified boolean default false, p_only_mentors boolean default false,
  p_min_rating numeric default null, p_sort text default 'relevance',
  p_limit int default 30, p_offset int default 0
) returns setof public.profiles
language sql stable set search_path = public as $$
  select p.* from public.profiles p
  where p.id <> auth.uid()
    and not p.is_banned
    and not public.is_blocked_between(p.id, auth.uid())
    and (coalesce(p_q,'') = '' or p.name ilike '%'||p_q||'%' or p.bio ilike '%'||p_q||'%'
         or array_to_string(p.interests || p.mentor_topics, ' ') ilike '%'||p_q||'%'
         or similarity(p.name, p_q) > 0.25)
    and (p_interests is null or p.interests && p_interests)
    and (p_teach is null or p.teach_langs && p_teach)
    and (p_learn is null or p.learn_langs && p_learn)
    and (coalesce(p_city,'') = '' or p.city ilike p_city)
    and (p_mode is null or p_mode = 'both' or p.mode in (p_mode, 'both'))
    and (not p_only_verified or p.verified_id)
    and (not p_only_mentors or p.is_mentor)
    and (p_min_rating is null or p.rating_avg >= p_min_rating)
  order by
    case when p_sort = 'rating' then p.rating_avg end desc nulls last,
    case when p_sort = 'newest' then p.created_at end desc nulls last,
    case when coalesce(p_q,'') <> '' then similarity(p.name || ' ' || coalesce(p.bio,''), p_q) end desc nulls last,
    p.rating_avg desc
  limit least(p_limit, 50) offset p_offset;
$$;
grant execute on function public.search_people to authenticated;

-- ---------- push ----------
create table public.push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create table public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios','android')),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
alter table public.push_subs enable row level security;
alter table public.native_push_tokens enable row level security;
create policy push_self   on public.push_subs          for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy native_self on public.native_push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- payments (server writes only) ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  buyer uuid not null references public.profiles on delete cascade,
  seller uuid not null references public.profiles on delete cascade,
  connection_id uuid references public.connections on delete set null,
  provider text not null check (provider in ('stripe','zarinpal')),
  provider_ref text unique,
  amount int not null check (amount > 0),
  fee int not null default 0,
  currency text not null,
  status text not null default 'pending' check (status in ('pending','paid','refunded','failed')),
  created_at timestamptz not null default now()
);
create index on public.payments (buyer, created_at desc);
create index on public.payments (seller, created_at desc);
alter table public.payments enable row level security;
create policy payments_read on public.payments for select to authenticated using (auth.uid() in (buyer, seller) or public.is_admin());

-- free mentorship: any user may open a mentorship connection with a mentor whose price is 0
create or replace function public.start_free_mentorship(p_mentor uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare m public.profiles; v_conn uuid;
begin
  select * into m from public.profiles where id = p_mentor;
  if m.id is null or not m.is_mentor or m.mentor_price <> 0 or m.id = auth.uid() then
    raise exception 'not a free mentor';
  end if;
  insert into public.connections (user_a, user_b, kind)
  values (least(auth.uid(), p_mentor), greatest(auth.uid(), p_mentor), 'mentorship')
  on conflict (user_a, user_b, kind) do update set status = 'active'
  returning id into v_conn;
  return v_conn;
end $$;
revoke all on function public.start_free_mentorship(uuid) from public, anon;
grant execute on function public.start_free_mentorship(uuid) to authenticated;

-- ---------- verification flags come from auth.users, not from the client ----------
create or replace function public.profile_verification_flags() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare u auth.users;
begin
  select * into u from auth.users where id = new.id;
  new.verified_email := u.email_confirmed_at is not null and u.email not like '%@phone.hamrah.invalid';
  new.verified_phone := u.phone_confirmed_at is not null;
  return new;
end $$;
create trigger trg_profile_flags before insert on public.profiles
for each row execute function public.profile_verification_flags();
