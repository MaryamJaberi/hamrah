-- Tests for 020_dorehami. Run inside a transaction; everything is rolled back.
-- Uses two existing profiles (pass their ids): replace :A / :B or run as-is on hamrah-dev seed data.
begin;
create temp table t_ctx (k text primary key, v text) on commit drop;
grant all on t_ctx to anon, authenticated;

-- ---------- guest (anon) creates + answers ----------
set local role anon;
do $$ declare c jsonb; r jsonb; g jsonb; begin
  -- anon cannot reach member-only RPCs or tables
  begin perform public.dh_my_meetups(); assert false, 'anon called dh_my_meetups'; exception when insufficient_privilege then null; end;
  begin perform public.dh_me(); assert false, 'anon called dh_me'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.dh_responses; assert false, 'anon read table'; exception when insufficient_privilege then null; end;
  c := public.dh_create('تست', null, 'مریم', '[{"d":"2030-01-05","t":"15:00"},{"d":"2030-01-06","t":"14:00"}]', false);
  insert into t_ctx values ('code', c->>'code'), ('admin', c->>'admin_token');
  r := public.dh_respond(c->>'code', null, 'مهمان', '{"origin":{"key":"delft","lat":52.0,"lng":4.35},"diet":["halal"],"age":"۲۵–۳۰"}', array['origin']);
  insert into t_ctx values ('guest_edit', r->>'edit_token');
  g := public.dh_get(c->>'code', null);
  assert (g->>'count')::int = 1;
  assert (g->'people'->0) ? 'origin', 'public field missing';
  assert not ((g->'people'->0) ? 'age') and not ((g->'people'->0) ? 'diet'), 'private field leaked';
  assert g->'anon'->0->'diet' is not null, 'anon aggregate missing';
  assert (g->>'is_admin')::boolean = false and g->>'admin_token' is null, 'admin leaked to guest';
  assert (public.dh_get(c->>'code', c->>'admin_token')->>'is_admin')::boolean;
  begin perform public.dh_finalize(c->>'code', 'wrong', '{}'); assert false, 'finalize with wrong token'; exception when raise_exception then null; end;
end $$;
reset role;

-- ---------- member A claims the meetup (as organizer), answers, B answers ----------
select set_config('request.jwt.claims', '{"sub":"c0d2d502-2559-4711-aa8f-c15fa6354f31","role":"authenticated"}', true);
set local role authenticated;
do $$ declare n int; g jsonb; r jsonb; begin
  n := public.dh_claim(jsonb_build_array(jsonb_build_object('code',(select v from t_ctx where k='code'),'admin',(select v from t_ctx where k='admin'))));
  assert n = 1, 'claim admin';
  g := public.dh_get((select v from t_ctx where k='code'), null);
  assert (g->>'is_admin')::boolean and g->>'admin_token' is not null, 'organizer by account';
  r := public.dh_respond((select v from t_ctx where k='code'), null, 'سارا', '{"diet":["vegan"]}', '{}');
  -- answering again from "another device" (no token) updates, not duplicates
  r := public.dh_respond((select v from t_ctx where k='code'), null, 'سارا', '{"diet":["vegetarian"]}', '{}');
  assert (public.dh_get((select v from t_ctx where k='code'), null)->>'count')::int = 2, 'member duplicated';
  assert jsonb_array_length(public.dh_my_meetups()) = 1;
  perform public.dh_finalize((select v from t_ctx where k='code'), null, '{"d":"2030-01-05","t":"16:00","venue":"Kafe X","city":"delft"}');
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"c220afc8-a620-44f8-807a-3e9619b828eb","role":"authenticated"}', true);
set local role authenticated;
do $$ declare g jsonb; begin
  g := public.dh_get((select v from t_ctx where k='code'), null);
  assert (g->>'is_admin')::boolean = false, 'B is not admin';
  begin perform public.dh_to_plan((select v from t_ctx where k='code'), null); assert false, 'B made plan'; exception when raise_exception then null; end;
  begin perform public.dh_finalize((select v from t_ctx where k='code'), null, '{}'); assert false, 'B finalized'; exception when raise_exception then null; end;
  -- B cannot take over the guest's answer without its token
  assert public.dh_mine((select v from t_ctx where k='code'), null) is null, 'B sees someone else''s answer';
  perform public.dh_respond((select v from t_ctx where k='code'), null, 'امیرحسین', '{}', '{}');
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"c0d2d502-2559-4711-aa8f-c15fa6354f31","role":"authenticated"}', true);
set local role authenticated;
do $$ declare pid uuid; begin
  pid := public.dh_to_plan((select v from t_ctx where k='code'), null);
  insert into t_ctx values ('plan', pid::text);
  assert public.outing_is_member(pid, 'c220afc8-a620-44f8-807a-3e9619b828eb'), 'answered member added to plan';
  assert (select status from public.outing_plans where id = pid) = 'confirmed', 'final carried over';
  assert (select count(*) from public.outing_plan_places where plan_id = pid) = 1, 'venue carried over';
  assert public.dh_to_plan((select v from t_ctx where k='code'), null) = pid, 'idempotent';
end $$;
reset role;

-- ---------- a guest can delete only their own answer ----------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  perform public.dh_delete_mine((select v from t_ctx where k='code'), 'not-a-token');
  assert (public.dh_get((select v from t_ctx where k='code'), null)->>'count')::int = 3, 'deleted with wrong token';
  perform public.dh_delete_mine((select v from t_ctx where k='code'), (select v from t_ctx where k='guest_edit'));
  assert (public.dh_get((select v from t_ctx where k='code'), null)->>'count')::int = 2, 'guest delete';
end $$;
reset role;

select 'ALL DOREHAMI TESTS PASSED' as result;
rollback;
