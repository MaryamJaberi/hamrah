-- 011 — outing_score: a text literal appended to text[] was read as an array literal
-- ("malformed array literal: خیلی نزدیک هم"), so «آدم‌های هم‌سلیقه» failed for anyone under 1 km from someone.
-- Same function, with the literal cast to text. Found by scripts/bots.mjs.

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
  if km is not null and km < 1 then reasons := reasons || 'خیلی نزدیک هم'::text;
  elsif km is not null and km <= 15 then reasons := reasons || ('حدود ' || round(km)::text || ' کیلومتر فاصله'); end if;
end $$;
