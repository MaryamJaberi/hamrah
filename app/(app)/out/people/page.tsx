import Link from 'next/link';
import { getSession } from '@/lib/supabase/server';
import PeopleClient from './PeopleClient';

export const dynamic = 'force-dynamic';

export default async function People({ searchParams }: { searchParams: { a?: string } }) {
  const { supabase, user } = await getSession();
  const { data: op } = await supabase.from('outing_profiles').select('activities').eq('user_id', user!.id).maybeSingle();
  if (!op) {
    return (
      <main className="page"><h1 className="h1">آدم‌های هم‌سلیقه</h1>
        <div className="card text-center space-y-3 py-6"><p className="text-sm">اول پروفایل بیرون‌رفتن را بساز تا بتوانیم پیشنهاد بدهیم.</p><Link className="btn" href="/out/profile">ساخت پروفایل</Link></div>
      </main>
    );
  }
  const [{ data: people }, { data: mems }] = await Promise.all([
    supabase.rpc('outing_matches', { p_activity: searchParams.a ?? null, p_limit: 30 }),
    supabase.from('outing_plan_members').select('outing_plans(id,title,status)').eq('user_id', user!.id).eq('status', 'joined'),
  ]);
  const plans = (mems ?? []).map((m: any) => m.outing_plans).filter((p: any) => p && p.status === 'collecting');
  return (
    <main className="page">
      <h1 className="h1">آدم‌های هم‌سلیقه 🧭</h1>
      <PeopleClient people={(people as any[]) ?? []} plans={plans} activities={op.activities ?? []} current={searchParams.a ?? ''} />
    </main>
  );
}
