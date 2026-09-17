import Link from 'next/link';
import { getSession } from '@/lib/supabase/server';
import VerifyBadges from '@/components/VerifyBadges';
import PushToggle from '@/components/PushToggle';
import ProfileForm from './ProfileForm';
import type { Profile } from '@/lib/types';

export default async function ProfilePage() {
  const { supabase, user, profile } = await getSession();
  const p = profile as Profile;
  const { count } = await supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('host', user!.id).eq('status', 'done');
  const kycLabel = { none: 'تأیید هویت', pending: 'تأیید هویت: در انتظار بررسی', approved: 'هویت تأیید شده ✓', rejected: 'تأیید هویت رد شد — دوباره ارسال کن' }[p.kyc_status];

  return (
    <main className="page">
      <div className="card text-center py-6 mb-3">
        <div className="text-5xl mb-2" aria-hidden>{p.avatar}</div>
        <h1 className="text-lg font-extrabold">{p.name}</h1>
        <p className="text-xs text-muted mb-2">{p.city}</p>
        <VerifyBadges p={p} />
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[[count ?? 0, 'جلسه'], [p.rating_count ? Number(p.rating_avg).toFixed(1) : '—', 'امتیاز'], [p.rating_count, 'نظر']].map(([n, l]) => (
            <div key={String(l)} className="rounded-2xl border border-line py-2"><div className="text-xl font-extrabold text-primary">{typeof n === 'number' ? n.toLocaleString('fa-IR') : n}</div><div className="text-[11px] text-muted">{l}</div></div>
          ))}
        </div>
      </div>

      <div className="card mb-3">
        {p.kyc_status !== 'approved' && p.kyc_status !== 'pending'
          ? <Link href="/verify" className="flex items-center justify-between py-2 text-sm"><span>🪪 {kycLabel}</span><span className="text-primary">←</span></Link>
          : <p className="py-2 text-sm">🪪 {kycLabel}</p>}
        <Link href={`/u/${p.id}`} className="flex items-center justify-between py-2 text-sm border-t border-line"><span>👁 دیدن پروفایل عمومی</span><span className="text-primary">←</span></Link>
        {p.is_admin && <Link href="/admin" className="flex items-center justify-between py-2 text-sm border-t border-line"><span>🛠 کنسول ادمین</span><span className="text-primary">←</span></Link>}
        <div className="border-t border-line"><PushToggle /></div>
      </div>

      <ProfileForm profile={p} />
    </main>
  );
}
