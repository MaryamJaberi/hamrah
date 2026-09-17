import { admin } from '@/lib/supabase/admin';
import { REPORT_REASONS } from '@/lib/constants';
import AdminAction from '../AdminAction';

export default async function AdminReports({ searchParams }: { searchParams: { status?: string } }) {
  const status = searchParams.status ?? 'open';
  const { data } = await admin().from('reports')
    .select('*, reporter_p:profiles!reports_reporter_fkey(id,name,avatar), reported_p:profiles!reports_reported_user_fkey(id,name,avatar,is_banned)')
    .eq('status', status).order('created_at', { ascending: false }).limit(100);
  const reasons = Object.fromEntries(REPORT_REASONS);

  return (
    <>
      <h1 className="text-2xl font-extrabold mb-4">گزارش‌ها</h1>
      <div className="flex gap-2 mb-4">
        {[['open', 'باز'], ['reviewing', 'در حال بررسی'], ['resolved', 'حل‌شده'], ['dismissed', 'رد‌شده']].map(([k, l]) => (
          <a key={k} href={`/admin/reports?status=${k}`} className={`chip ${status === k ? 'chip-on' : ''}`}>{l}</a>
        ))}
      </div>
      {(data ?? []).length === 0 && <p className="text-muted">گزارشی نیست.</p>}
      <div className="space-y-2">
        {(data ?? []).map((r: any) => (
          <div key={r.id} className="card">
            <div className="flex flex-wrap items-center gap-2 text-sm mb-1">
              <span className="chip">{reasons[r.reason] ?? r.reason}</span>
              <span>{r.reporter_p?.avatar} {r.reporter_p?.name}</span><span className="text-muted">← گزارش درباره →</span>
              <a className="font-bold text-primary" href={`/u/${r.reported_p?.id}`}>{r.reported_p?.avatar} {r.reported_p?.name}</a>
              {r.reported_p?.is_banned && <span className="chip bg-warn-soft text-warn">مسدود</span>}
              <span className="text-xs text-muted ms-auto">{new Date(r.created_at).toLocaleString('fa-IR')}</span>
            </div>
            {r.details && <p className="text-sm text-[#4a4a5e]">{r.details}</p>}
            {r.resolution && <p className="text-xs text-muted mt-1">نتیجه: {r.resolution}</p>}
            {(status === 'open' || status === 'reviewing') && (
              <div className="flex flex-wrap gap-2 mt-3">
                {status === 'open' && <AdminAction endpoint="/api/admin/reports" body={{ id: r.id, status: 'reviewing' }} label="شروع بررسی" variant="btn-sec" />}
                <AdminAction endpoint="/api/admin/reports" body={{ id: r.id, status: 'resolved' }} label="حل شد" prompt={{ key: 'resolution', text: 'چه اقدامی انجام شد؟' }} />
                <AdminAction endpoint="/api/admin/reports" body={{ id: r.id, status: 'dismissed' }} label="رد گزارش" variant="btn-sec" />
                {r.reported_p && !r.reported_p.is_banned && <AdminAction endpoint="/api/admin/users" body={{ userId: r.reported_p.id, banned: true }} label="مسدود کردن کاربر" variant="btn-danger" confirmText="کاربر مسدود شود؟" />}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
