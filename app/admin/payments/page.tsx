import { admin } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/format';

export default async function AdminPayments() {
  const { data } = await admin().from('payments')
    .select('*, buyer_p:profiles!payments_buyer_fkey(name), seller_p:profiles!payments_seller_fkey(name)')
    .order('created_at', { ascending: false }).limit(200);
  return (
    <>
      <h1 className="text-2xl font-extrabold mb-4">پرداخت‌ها</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-muted text-xs text-right">{['خریدار', 'منتور', 'مبلغ', 'سهم پلتفرم', 'درگاه', 'وضعیت', 'تاریخ'].map((h) => <th key={h} className="p-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {(data ?? []).map((p: any) => (
              <tr key={p.id} className="border-t border-line">
                <td className="p-2">{p.buyer_p?.name}</td><td className="p-2">{p.seller_p?.name}</td>
                <td className="p-2">{formatPrice(p.amount, p.currency)}</td><td className="p-2 text-muted">{formatPrice(p.fee, p.currency)}</td>
                <td className="p-2 text-xs">{p.provider}</td>
                <td className="p-2"><span className={`chip text-[10px] ${p.status === 'paid' ? 'chip-accent' : p.status === 'failed' ? 'bg-warn-soft text-warn' : 'chip-ghost'}`}>{p.status}</span></td>
                <td className="p-2 text-xs text-muted">{new Date(p.created_at).toLocaleString('fa-IR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data ?? []).length === 0 && <p className="text-muted text-center py-6">پرداختی نیست.</p>}
      </div>
    </>
  );
}
