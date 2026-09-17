-- ============================================================
-- 002 — trust: reviews, reports, blocks, KYC
-- ============================================================
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections on delete cascade,
  reviewer uuid not null references public.profiles on delete cascade,
  reviewee uuid not null references public.profiles on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (connection_id, reviewer),
  check (reviewer <> reviewee)
);
create index on public.reviews (reviewee, created_at desc);

create or replace function public.refresh_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare target uuid := coalesce(new.reviewee, old.reviewee);
begin
  update public.profiles p set
    rating_avg   = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where reviewee = target), 0),
    rating_count = (select count(*) from public.reviews where reviewee = target)
  where p.id = target;
  return null;
end $$;
create trigger trg_review_rating after insert or update or delete on public.reviews
for each row execute function public.refresh_rating();

alter table public.reviews enable row level security;
create policy reviews_read on public.reviews for select to authenticated using (true);
-- only a participant can review, only the other participant, and only after a finished session
create policy reviews_insert on public.reviews for insert to authenticated with check (
  reviewer = auth.uid()
  and exists (select 1 from public.connections c where c.id = connection_id
              and auth.uid() in (c.user_a, c.user_b) and reviewee in (c.user_a, c.user_b))
  and exists (select 1 from public.sessions s where s.connection_id = reviews.connection_id and s.status = 'done')
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles on delete cascade,
  reported_user uuid references public.profiles on delete set null,
  reason text not null check (reason in ('harassment','spam','no_show','fake_profile','safety','other')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  resolution text,
  handled_by uuid references public.profiles on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.reports (status, created_at desc);
alter table public.reports enable row level security;
create policy reports_read   on public.reports for select to authenticated using (reporter = auth.uid() or public.is_admin());
create policy reports_insert on public.reports for insert to authenticated with check (reporter = auth.uid() and status = 'open');
create policy reports_admin  on public.reports for update to authenticated using (public.is_admin());

create table public.blocks (
  user_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);
alter table public.blocks enable row level security;
create policy blocks_self on public.blocks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- a blocked user can't send you requests or messages
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a));
$$;
drop policy requests_insert on public.requests;
create policy requests_insert on public.requests for insert to authenticated
  with check (from_user = auth.uid() and status = 'pending' and not public.is_blocked_between(from_user, to_user));
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
  sender = auth.uid() and public.is_participant(connection_id)
  and not exists (select 1 from public.connections c where c.id = connection_id
                  and public.is_blocked_between(c.user_a, c.user_b))
);

-- ---------- KYC ----------
create table public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('national_id','passport','persona')),
  doc_front_path text,
  doc_back_path text,
  selfie_path text,
  document_number text,
  birth_date date,
  full_name text,
  persona_inquiry_id text unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  reviewed_by uuid references public.profiles on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.kyc_submissions (status, created_at);
alter table public.kyc_submissions enable row level security;
create policy kyc_read   on public.kyc_submissions for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- users can only ever submit as pending
create policy kyc_insert on public.kyc_submissions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and kind <> 'persona');
create policy kyc_admin  on public.kyc_submissions for update to authenticated using (public.is_admin());

create or replace function public.sync_kyc_to_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set kyc_status = new.status, verified_id = (new.status = 'approved')
  where id = new.user_id;
  return new;
end $$;
create trigger trg_kyc_sync after insert or update of status on public.kyc_submissions
for each row execute function public.sync_kyc_to_profile();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy kyc_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'kyc' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy kyc_objects_write on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);
