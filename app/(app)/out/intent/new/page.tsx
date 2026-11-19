import { getSession } from '@/lib/supabase/server';
import Link from 'next/link';
import NewIntent from './NewIntent';

export default async function NewIntentPage() {
  const { supabase, user } = await getSession();
  const { data: op } = await supabase.from('outing_profiles').select('gender,area_label,area_lat,area_lng,activities').eq('user_id', user!.id).maybeSingle();
  return (
    <main className="page">
      <h1 className="h1">دنبال همراه ☕</h1>
      {!op ? (
        <div className="card text-center space-y-3 py-6">
          <p className="text-sm">برای اینکه دعوتت به آدم‌های درست برسد، اول پروفایل بیرون‌رفتن را بساز (دو دقیقه).</p>
          <Link href="/out/profile" className="btn">ساخت پروفایل</Link>
        </div>
      ) : (
        <NewIntent isWoman={op.gender === 'woman'} area={{ label: op.area_label ?? '', lat: op.area_lat, lng: op.area_lng }} fav={op.activities?.[0] ?? 'قهوه'} />
      )}
    </main>
  );
}
