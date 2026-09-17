import { admin } from '@/lib/supabase/admin';
import AdminAction from '../AdminAction';

const PAGE = 50;

export default async function AdminUsers({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const q = (searchParams.q ?? '').replace(/[%,()]/g, '').trim();
  const page = Math.max(0, Number(searchParams.page ?? 0) || 0);
  let query = admin().from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`);
  const { data: users, count } = await query;

  return (
    <>
      <h1 className="text-2xl font-extrabold mb-4">کاربران ({(count ?? 0).toLocaleString('fa-IR')})</h1>
      <form className="mb-4"><input name="q" defaultValue={q} className="input" aria-label="جستجو" placeholder="جستجوی نام یا شهر…" /></form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-muted text-xs text-right">{['کاربر', 'شهر', 'امتیاز', 'KYC', 'منتور', 'عضویت', ''].map((h) => <th key={h} className="p-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {(users ?? []).map((u: any) => (
              <tr key={u.id} className="border-t border-line">
                <td className="p-2"><a href={`/u/${u.id}`} className="font-bold text-primary">{u.avatar} {u.name}</a>{u.is_admin && <span className="chip text-[10px] ms-1">ادمین</span>}</td>
                <td className="p-2 text-muted">{u.city}</td>
                <td className="p-2">{u.rating_count ? `${Number(u.rating_avg).toFixed(1)} (${u.rating_count})` : '—'}</td>
                <td className="p-2 text-xs">{u.kyc_status}</td>
                <td className="p-2">{u.is_mentor ? '✓' : '—'}</td>
                <td className="p-2 text-xs text-muted">{new Date(u.created_at).toLocaleDateString('fa-IR')}</td>
                <td className="p-2">{!u.is_admin && (u.is_banned
                  ? <AdminAction endpoint="/api/admin/users" body={{ userId: u.id, banned: false }} label="رفع مسدودی" variant="btn-sec" />
                  : <AdminAction endpoint="/api/admin/users" body={{ userId: u.id, banned: true }} label="مسدود" variant="btn-danger" confirmText={`${u.name} مسدود شود؟`} />)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 mt-4 justify-center">
        {page > 0 && <a href={`/admin/users?q=${encodeURIComponent(q)}&page=${page - 1}`} className="btn btn-sec btn-sm">قبلی</a>}
        {(count ?? 0) > (page + 1) * PAGE && <a href={`/admin/users?q=${encodeURIComponent(q)}&page=${page + 1}`} className="btn btn-sec btn-sm">بعدی</a>}
      </div>
    </>
  );
}
