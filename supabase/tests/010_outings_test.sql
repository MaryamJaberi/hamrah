-- SQL tests for 010_outings. Run on a dev/e2e DB: everything is rolled back.
-- Users: A (woman, organizer), B (woman), C (man), D (woman who blocked A)
begin;

insert into auth.users (id, email, instance_id, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001','a@t.test','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000002','b@t.test','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000003','c@t.test','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000004','d@t.test','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
insert into public.profiles (id, name, city) values
  ('aaaaaaaa-0000-0000-0000-000000000001','A','Rotterdam'), ('aaaaaaaa-0000-0000-0000-000000000002','B','Rotterdam'),
  ('aaaaaaaa-0000-0000-0000-000000000003','C','Rotterdam'), ('aaaaaaaa-0000-0000-0000-000000000004','D','Rotterdam');
insert into public.outing_profiles (user_id, birth_year, gender, job, hobbies, activities, area_lat, area_lng, vis, pref, free_slots) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 1993, 'woman', 'PM', '{کتاب,یوگا}', '{قهوه,پیاده‌روی}', 51.92, 4.48,
   '{"age":"public","job":"matched","hobbies":"public","places":"public"}', '{"avoid":{"smoking":true}}', '{sat:evening}'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 1995, 'woman', 'Designer', '{کتاب}', '{قهوه}', 51.91, 4.47,
   '{"age":"hidden","job":"matched","hobbies":"public","places":"public"}', '{}', '{sat:evening}'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 1990, 'man', 'Dev', '{}', '{قهوه}', 51.92, 4.48, default, '{}', '{}'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 1994, 'woman', 'Nurse', '{}', '{قهوه}', 51.92, 4.48, default, '{}', '{}');
insert into public.outing_lifestyle (user_id, alcohol, smoking, alcohol_share, smoking_share, use_for_matching) values
  ('aaaaaaaa-0000-0000-0000-000000000001','sometimes','no','mutual','mutual', true),
  ('aaaaaaaa-0000-0000-0000-000000000002','yes','sometimes','mutual','hidden', false);
insert into public.blocks (user_id, blocked_id) values ('aaaaaaaa-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000001');

create temp table t_ctx (k text primary key, v text);
grant all on t_ctx to authenticated;

-- ---------- as A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

do $$ declare pid uuid; c jsonb; begin
  -- women-only plan with two slots
  pid := public.create_outing_plan('دخترا', null, '{قهوه,شام}', 'Rotterdam', 51.92, 4.48, true, 8,
          array[now() + interval '3 days', now() + interval '4 days']);
  insert into t_ctx values ('plan', pid::text), ('code', (select invite_code from public.outing_plans where id = pid));
  -- before joining, B's lifestyle is not visible and B's job (matched) is hidden, B's age hidden
  c := public.outing_card('aaaaaaaa-0000-0000-0000-000000000002');
  assert not (c ? 'job'), 'job must be hidden before matching';
  assert not (c ? 'age'), 'hidden age must never show';
  assert c ? 'hobbies', 'public hobbies visible';
  assert public.outing_lifestyle_of('aaaaaaaa-0000-0000-0000-000000000002') = '{}'::jsonb, 'lifestyle hidden before together';
  -- A cannot read B's raw rows
  assert (select count(*) from public.outing_profiles where user_id <> auth.uid()) = 0, 'raw profiles of others readable!';
  assert (select count(*) from public.outing_lifestyle where user_id <> auth.uid()) = 0, 'raw lifestyle of others readable!';
  -- blocked D is not shown, C (man) is shown in matches but not B? B is compatible too
  assert not exists (select 1 from jsonb_array_elements(public.outing_matches()) e where e->>'id' = 'aaaaaaaa-0000-0000-0000-000000000004'), 'blocked user in matches';
  -- internal helpers are not callable
  begin perform public.outing_score(auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002'); assert false, 'outing_score callable';
  exception when insufficient_privilege then null; end;
end $$;

-- ---------- as C (man): cannot join women-only plan, cannot read plan ----------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ begin
  begin perform public.join_outing_plan((select v from t_ctx where k='code')); assert false, 'man joined women-only plan';
  exception when raise_exception then null; end;
  assert public.outing_plan_detail((select v from t_ctx where k='plan')::uuid) is null, 'non-member sees plan detail';
  assert (select count(*) from public.outing_plans) = 0, 'non-member reads plans';
  assert (select count(*) from public.outing_messages) = 0, 'non-member reads messages';
  begin insert into public.outing_messages (plan_id, sender, body) values ((select v from t_ctx where k='plan')::uuid, auth.uid(), 'hi');
    assert false, 'non-member posted message';
  exception when insufficient_privilege or check_violation then null; end;
end $$;

-- ---------- as D (blocked A): cannot join ----------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);
do $$ begin
  begin perform public.join_outing_plan((select v from t_ctx where k='code')); assert false, 'blocked user joined';
  exception when raise_exception then null; end;
end $$;

-- ---------- as B: join, vote, see A's job (matched) and alcohol (both mutual) but not smoking (B hidden) ----------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ declare pid uuid; d jsonb; c jsonb; l jsonb; sid uuid; begin
  pid := public.join_outing_plan((select v from t_ctx where k='code'));
  c := public.outing_card('aaaaaaaa-0000-0000-0000-000000000001');
  assert c->>'job' = 'PM', 'matched job should show after joining';
  l := public.outing_lifestyle_of('aaaaaaaa-0000-0000-0000-000000000001');
  assert l->>'alcohol' = 'sometimes', 'mutual alcohol should show';
  assert not (l ? 'smoking'), 'smoking must stay hidden because B keeps it hidden';
  select (e->>'id')::uuid into sid from jsonb_array_elements(public.outing_plan_detail(pid)->'slots') e limit 1;
  perform public.vote_outing_slot(sid, 'yes');
  perform public.add_outing_place(pid, '{"name":"Café Test","provider":"manual"}');
  d := public.outing_plan_detail(pid);
  assert (d->'slots'->0->>'yes')::int = 1, 'vote counted';
  assert jsonb_array_length(d->'members') = 2, 'two members';
  assert d->'venue_hint' = '{}'::jsonb, 'venue hint must be empty below 3 members';
  -- B cannot confirm (not organizer)
  begin perform public.confirm_outing_plan(pid, sid, null); assert false, 'non-organizer confirmed';
  exception when raise_exception then null; end;
  insert into t_ctx values ('slot', sid::text);
end $$;

-- ---------- as A: lifestyle mutual reveal is symmetric; confirm plan ----------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$ declare l jsonb; begin
  l := public.outing_lifestyle_of('aaaaaaaa-0000-0000-0000-000000000002');
  assert l->>'alcohol' = 'yes', 'A sees B alcohol';
  assert not (l ? 'smoking'), 'A must not see B smoking (hidden)';
  perform public.confirm_outing_plan((select v from t_ctx where k='plan')::uuid, (select v from t_ctx where k='slot')::uuid, null);
  assert (select status from public.outing_plans where id = (select v from t_ctx where k='plan')::uuid) = 'confirmed';
end $$;

-- ---------- intents ----------
do $$ declare iid uuid; begin
  iid := public.create_outing_intent('قهوه', 'قهوه شنبه عصر', now() + interval '1 day', now() + interval '2 days',
         'Rotterdam', 51.92, 4.48, 10, '{"women_only":true}', 1);
  insert into t_ctx values ('intent', iid::text);
  -- A cannot change other columns of her intent
  begin update public.outing_intents set radius_km = 50 where id = iid; assert false, 'intent column writable';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
do $$ begin
  assert jsonb_array_length(public.nearby_outing_intents()) = 0, 'man sees women-only intent';
  begin perform public.respond_outing_intent((select v from t_ctx where k='intent')::uuid, 'من!'); assert false, 'man responded';
  exception when raise_exception then null; end;
  assert (select count(*) from public.outing_intents) = 0, 'others intents readable';
end $$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ begin
  assert jsonb_array_length(public.nearby_outing_intents()) = 1, 'B should see A intent';
  perform public.respond_outing_intent((select v from t_ctx where k='intent')::uuid, 'من هستم ☕');
  begin perform public.accept_outing_response((select v from t_ctx where k='intent')::uuid, auth.uid()); assert false, 'responder accepted self';
  exception when raise_exception then null; end;
end $$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$ declare pid uuid; begin
  assert jsonb_array_length(public.outing_intent_detail((select v from t_ctx where k='intent')::uuid)->'responses') = 1;
  pid := public.accept_outing_response((select v from t_ctx where k='intent')::uuid, 'aaaaaaaa-0000-0000-0000-000000000002');
  assert public.outing_is_member(pid, 'aaaaaaaa-0000-0000-0000-000000000002'), 'responder added to plan';
  assert (select status from public.outing_intents where id = (select v from t_ctx where k='intent')::uuid) = 'matched';
end $$;

reset role;
select 'ALL OUTINGS TESTS PASSED' as result;
rollback;
