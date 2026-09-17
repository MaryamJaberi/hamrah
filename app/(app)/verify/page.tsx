import { getSession } from '@/lib/supabase/server';
import KYCClient from './KYCClient';

export default async function VerifyPage() {
  const { supabase, user, profile } = await getSession();
  const { data: sub } = await supabase.from('kyc_submissions').select('status,reject_reason,created_at').eq('user_id', user!.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return <main className="page"><KYCClient name={profile!.name} last={sub} personaEnabled={!!process.env.PERSONA_TEMPLATE_ID} /></main>;
}
