-- 012 — Supabase security advisor: v1 helper functions were callable without signing in.
-- is_blocked_between could be used by anyone to probe who blocked whom; the trigger functions
-- (refresh_rating, sync_kyc_to_profile, profile_verification_flags) are never meant to be called as RPC.
-- Also pins search_path on the two pure outing helpers. Applied to hamrah-dev and production on 2026-11-20.
revoke execute on function public.is_admin(), public.is_blocked_between(uuid,uuid), public.is_participant(uuid), public.profile_verification_flags(), public.refresh_rating(), public.sync_kyc_to_profile() from public, anon;
grant execute on function public.is_admin(), public.is_blocked_between(uuid,uuid), public.is_participant(uuid) to authenticated;
alter function public.outing_age(int) set search_path = public;
alter function public.outing_km(numeric,numeric,numeric,numeric) set search_path = public;
