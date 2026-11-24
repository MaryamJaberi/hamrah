-- Fix ambiguous dh_create overload introduced by 023 and add explicit EXECUTE grants
-- Drop the legacy 5-argument signature so 5-arg RPC calls unambiguously resolve to the 6-arg version with default p_expires_at = null
drop function if exists public.dh_create(text, text, text, jsonb, boolean);

revoke all on function public.dh_create(text, text, text, jsonb, boolean, timestamptz) from public;
grant execute on function public.dh_create(text, text, text, jsonb, boolean, timestamptz) to anon, authenticated;

revoke all on function public.dh_edit_meetup(text, text, text, text, boolean, timestamptz, jsonb) from public;
grant execute on function public.dh_edit_meetup(text, text, text, text, boolean, timestamptz, jsonb) to anon, authenticated;

revoke all on function public.dh_archive_meetup(text, text, boolean) from public;
grant execute on function public.dh_archive_meetup(text, text, boolean) to anon, authenticated;
