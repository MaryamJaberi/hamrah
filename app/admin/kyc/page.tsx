import { admin } from '@/lib/supabase/admin';
import AdminAction from '../AdminAction';

export default async function AdminKyc({ searchParams }: { searchParams: { status?: string } }) {
  const status = ['pending', 'approved', 'rejected'].includes(searchParams.status ?? '') ? searchParams.status! : 'pending';
  const db = admin();
  const { data: subs } = await db.from('kyc_submissions').select('*, profile:profiles!kyc_submissions_user_id_fkey(name,avatar)')
    .eq('status', status).order('created_at', { ascending: true }).limit(50);
  // short-lived signed URLs generated server-side; the bucket stays private
  const withUrls = await Promise.all((subs ?? []).map(async (s: any) => {
    const paths = [s.doc_front_path, s.doc_back_path, s.selfie_path].filter(Boolean) as string[];
    const { data } = paths.length ? await db.storage.from('kyc').createSignedUrls(paths, 600) : { data: [] };
    return { ...s, urls: (data ?? []).map((d: any) => d.signedUrl).filter(Boolean) };
  }));

  return (
    <>
      <h1 className="text-2xl font-extrabold mb-4">تأیید هویت</h1>
      <div className="flex gap-2 mb-4">
        {[['pending', 'در انتظار'], ['approved', 'تأییدشده'], ['rejected', 'ردشده']].map(([k, l]) => (
          <a key={k} href={`/admin/kyc?status=${k}`} className={`chip ${status === k ? 'chip-on' : ''}`}>{l}</a>
        ))}
      </div>
      {withUrls.length === 0 && <p className="text-muted">موردی نیست.</p>}
      <div className="grid md:grid-cols-2 gap-3">
        {withUrls.map((s) => (
          <div key={s.id} className="card">
            <div className="flex items-center gap-2 mb-2">
              <span aria-hidden>{s.profile?.avatar}</span><b>{s.profile?.name}</b>
              <span className="chip chip-ghost text-[10px]">{s.kind}</span>
              <span className="text-xs text-muted ms-auto">{new Date(s.created_at).toLocaleString('fa-IR')}</span>
            </div>
            <p className="text-sm">نام در مدرک: <b>{s.full_name ?? '—'}</b> · شماره: <span className="font-mono" dir="ltr">{s.document_number ?? '—'}</span> · تولد: {s.birth_date ?? '—'}</p>
            <div className="grid grid-cols-3 gap-2 my-3">
              {s.urls.map((u: string) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="مدرک" className="rounded-lg border border-line h-32 w-full object-cover" /></a>)}
            </div>
            {s.reject_reason && <p className="text-xs text-warn">دلیل رد: {s.reject_reason}</p>}
            {status === 'pending' && s.kind !== 'persona' && (
              <div className="flex gap-2">
                <AdminAction endpoint="/api/admin/kyc" body={{ id: s.id, approve: true }} label="✓ تأیید" />
                <AdminAction endpoint="/api/admin/kyc" body={{ id: s.id, approve: false }} label="✗ رد" variant="btn-danger" prompt={{ key: 'reason', text: 'دلیل رد (به کاربر نشان داده می‌شود):' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
