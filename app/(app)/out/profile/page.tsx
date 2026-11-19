import { getSession } from '@/lib/supabase/server';
import Builder from './Builder';

export const dynamic = 'force-dynamic';

export default async function OutProfile() {
  const { supabase, user, profile } = await getSession();
  const [{ data: op }, { data: ls }] = await Promise.all([
    supabase.from('outing_profiles').select('*').eq('user_id', user!.id).maybeSingle(),
    supabase.from('outing_lifestyle').select('*').eq('user_id', user!.id).maybeSingle(),
  ]);
  return (
    <main className="page">
      <h1 className="h1">پروفایل بیرون‌رفتن</h1>
      <Builder userId={user!.id} name={profile?.name ?? ''} initial={op} initialLs={ls} />
    </main>
  );
}
