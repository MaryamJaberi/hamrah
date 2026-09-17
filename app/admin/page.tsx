import { admin } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/format';

async function count(table: string, f?: (q: any) => any) {
  let q: any = admin().from(table).select('*', { count: 'exact', head: true });
  if (f) q = f(q);
  return ((await q).count as number) ?? 0;
}

export default async function Dashboard() {
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const [users, newUsers, verified, mentors, kyc, sessionsWeek, sessions, conns, messagesWeek, reports] = await Promise.all([
    count('profiles'), count('profiles', (q) => q.gte('created_at', week)), count('profiles', (q) => q.eq('verified_id', true)),
    count('profiles', (q) => q.eq('is_mentor', true)), count('kyc_submissions', (q) => q.eq('status', 'pending')),
    count('sessions', (q) => q.gte('starts_at', week).eq('status', 'done')), count('sessions', (q) => q.eq('status', 'done')),
    count('connections'), count('messages', (q) => q.gte('created_at', week)), count('reports', (q) => q.eq('status', 'open')),
  ]);
  const { data: paid } = await admin().from('payments').select('amount,fee,currency').eq('status', 'paid');
  const byCur = new Map<string, { gross: number; fee: number }>();
  (paid ?? []).forEach((p) => { const x = byCur.get(p.currency) ?? { gross: 0, fee: 0 }; x.gross += p.amount; x.fee += p.fee; byCur.set(p.currency, x); });

  const stats: [string, number | string][] = [
    ['کاربران', users], ['کاربر جدید (۷ روز)', newUsers], ['هویت تأییدشده', verified], ['منتور', mentors],
    ['KYC در انتظار', kyc], ['گزارش باز', reports], ['اتصال', conns], ['جلسه (۷ روز)', sessionsWeek],
    ['کل جلسات', sessions], ['پیام (۷ روز)', messagesWeek],
  ];
  return (
    <>
      <h1 className="text-2xl font-extrabold mb-4">داشبورد</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {stats.map(([l, v]) => (
          <div key={l} className="card"><div className="text-2xl font-extrabold text-primary">{typeof v === 'number' ? v.toLocaleString('fa-IR') : v}</div><div className="text-xs text-muted">{l}</div></div>
        ))}
      </div>
      <h2 className="font-bold mb-2">درآمد</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[...byCur].map(([cur, v]) => (
          <div key={cur} className="card"><p className="text-xs text-muted">{cur.toUpperCase()} — کل / سهم پلتفرم</p>
            <p className="text-xl font-extrabold">{formatPrice(v.gross, cur as any)} / {formatPrice(v.fee, cur as any)}</p></div>
        ))}
        {byCur.size === 0 && <p className="text-sm text-muted">هنوز پرداختی نیست.</p>}
      </div>
    </>
  );
}
