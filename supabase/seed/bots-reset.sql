-- TEST DATABASE ONLY: removes everything the test bots created (plans, invites, requests, chats),
-- so `npm run bots` is not stopped by the daily limits. Bot accounts and profiles stay.
with b as (select id from auth.users where email like '%@bot.hamrah.invalid')
, p as (delete from public.outing_plans where organizer in (select id from b) returning 1)
, i as (delete from public.outing_intents where user_id in (select id from b) returning 1)
, r as (delete from public.requests where from_user in (select id from b) returning 1)
select (select count(*) from p) plans, (select count(*) from i) intents, (select count(*) from r) requests;
