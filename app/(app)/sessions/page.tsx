import Link from 'next/link';
import { getSession } from '@/lib/supabase/server';
import { listConnections } from '@/lib/connections';
import { faDate } from '@/lib/format';
import ReviewForm from '@/components/ReviewForm';

export default async function Sessions({ searchParams }: { searchParams: { paid?: string } }) {
  const { supabase, user } = await getSession();
  const conns = await listConnections(supabase, user!.id);
  const byId = new Map(conns.map((c) => [c.id, c]));
  const [{ data: sessions }, { data: myReviews }] = await Promise.all([
    supabase.from('sessions').select('*').eq('status', 'done').order('starts_at', { ascending: false }).limit(50),
    supabase.from('reviews').select('connection_id').eq('reviewer', user!.id),
  ]);
  const done = sessions ?? [];
  const totalMin = done.reduce((a, s) => a + (s.actual_min ?? 0), 0);
  const reviewed = new Set((myReviews ?? []).map((r) => r.connection_id));
  const toReview = conns.filter((c) => !reviewed.has(c.id) && done.some((s) => s.connection_id === c.id)).slice(0, 2);

  const stats = [[done.length, 'جلسه'], [totalMin, 'دقیقه تمرکز'], [conns.length, 'همراه']] as const;
  return (
    <main className="page">
      <h1 className="h1">جلسه‌ها</h1>
      {searchParams.paid === '1' && <div role="status" className="card chip-accent mb-3 text-sm">پرداخت موفق بود. گفتگو با منتور باز شد ✅</div>}
      {searchParams.paid === '0' && <div role="alert" className="card bg-warn-soft text-warn mb-3 text-sm">پرداخت انجام نشد.</div>}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {stats.map(([n, l]) => (
          <div key={l} className="card text-center"><div className="text-2xl font-extrabold text-primary">{n.toLocaleString('fa-IR')}</div><div className="text-[11px] text-muted">{l}</div></div>
        ))}
      </div>

      {toReview.length > 0 && <h2 className="section">نظر بده</h2>}
      {toReview.map((c) => <div key={c.id} className="mb-3"><ReviewForm connectionId={c.id} revieweeId={c.other.id} name={c.other.name} /></div>)}

      <h2 className="section">شروع جلسه</h2>
      {conns.length === 0 && <div className="card text-sm text-muted text-center py-6">اول از «کشف» یک همراه پیدا کن.</div>}
      {conns.map((c) => (
        <Link key={c.id} href={`/room/${c.id}`} className="card flex items-center gap-3 mb-2">
          <span className="text-2xl" aria-hidden>{c.other.avatar}</span>
          <span className="flex-1 font-bold">{c.other.name}</span>
          <span className="btn btn-sm">▶ شروع</span>
        </Link>
      ))}

      {done.length > 0 && <h2 className="section">تاریخچه</h2>}
      {done.map((s) => {
        const c = byId.get(s.connection_id);
        return (
          <div key={s.id} className="card mb-2">
            <div className="flex items-center gap-2 text-sm">
              <span aria-hidden>{c?.other.avatar ?? '👤'}</span>
              <span className="font-bold flex-1">{c?.other.name ?? '—'}</span>
              <span className="text-xs text-muted">{faDate(s.starts_at)} · {(s.actual_min ?? 0).toLocaleString('fa-IR')} دقیقه</span>
            </div>
            {(s.wrapup as any)?.did && <p className="text-xs text-muted mt-1">✓ {(s.wrapup as any).did}</p>}
            {(s.wrapup as any)?.next && <p className="text-xs text-muted">← {(s.wrapup as any).next}</p>}
          </div>
        );
      })}
    </main>
  );
}
