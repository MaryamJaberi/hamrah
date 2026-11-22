-- ============================================================
-- 021 — «دورهمی»: remember a member's answers for the next meetup.
-- After answering once while signed in, the next meetup's form is pre-filled with everything except the
-- day votes, and the form opens in "quick" mode (name → days → review). Each section can still be changed.
-- Private by design: only the owner can read or write their row (RLS), nothing is ever shown to others from here.
-- Depends on 020. Idempotent.
-- ============================================================

create table if not exists public.dh_member_prefs (
  user_id uuid primary key references public.profiles on delete cascade,
  name text check (char_length(name) <= 40),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 12000),
  public_fields text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.dh_member_prefs enable row level security;
drop policy if exists dmp_own_read on public.dh_member_prefs;
create policy dmp_own_read on public.dh_member_prefs for select to authenticated using (user_id = auth.uid());
drop policy if exists dmp_own_delete on public.dh_member_prefs;
create policy dmp_own_delete on public.dh_member_prefs for delete to authenticated using (user_id = auth.uid());
revoke all on public.dh_member_prefs from anon;
revoke insert, update on public.dh_member_prefs from authenticated;   -- written only by the RPCs below
grant select, delete on public.dh_member_prefs to authenticated;

-- store answers minus the per-meetup day votes
create or replace function public.dh_save_prefs(p_user uuid, p_name text, p_data jsonb, p_public text[]) returns void
language sql security definer set search_path = public as $$
  insert into public.dh_member_prefs (user_id, name, data, public_fields, updated_at)
  values (p_user, left(trim(p_name),40), coalesce(p_data,'{}') - 'avail', coalesce(p_public[1:40],'{}'), now())
  on conflict (user_id) do update set name = excluded.name, data = excluded.data,
    public_fields = excluded.public_fields, updated_at = now();
$$;
revoke all on function public.dh_save_prefs(uuid,text,jsonb,text[]) from public, anon, authenticated;

-- dh_respond: same as 020, plus remembering a member's answers
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
  if r is null and me is not null then
    update public.dh_responses set name = left(trim(p_name),40), data = p_data, public_fields = coalesce(p_public[1:40],'{}'), updated_at = now()
    where meetup_id = m.id and user_id = me returning * into r;
  end if;
  if r is null then
    if (select count(*) from public.dh_responses where meetup_id = m.id) >= 40 then raise exception 'full'; end if;
    insert into public.dh_responses (meetup_id, name, data, public_fields, user_id)
    values (m.id, left(trim(p_name),40), coalesce(p_data,'{}'), coalesce(p_public[1:40],'{}'), me) returning * into r;
  end if;
  if me is not null then perform public.dh_save_prefs(me, p_name, p_data, p_public); end if;
  return jsonb_build_object('edit_token', r.edit_token, 'id', r.id);
end $$;

-- dh_claim: same as 020, plus seeding the member's saved answers from the newest claimed answer (if none yet)
create or replace function public.dh_claim(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare me uuid := public.dh_me(); it jsonb; n int := 0; k int; last public.dh_responses;
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
  if not exists (select 1 from public.dh_member_prefs where user_id = me) then
    select * into last from public.dh_responses where user_id = me order by updated_at desc limit 1;
    if last is not null then perform public.dh_save_prefs(me, last.name, last.data, last.public_fields); end if;
  end if;
  return n;
end $$;

revoke all on function public.dh_respond(text,text,text,jsonb,text[]), public.dh_claim(jsonb) from public, anon, authenticated;
grant execute on function public.dh_respond(text,text,text,jsonb,text[]) to anon, authenticated;
grant execute on function public.dh_claim(jsonb) to authenticated;
