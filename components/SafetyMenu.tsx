'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { REPORT_REASONS } from '@/lib/constants';

export default function SafetyMenu({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('harassment');
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState('');
  const router = useRouter();

  async function report(block: boolean) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('reports').insert({ reporter: user!.id, reported_user: userId, reason, details: details || null });
    if (block) await supabase.from('blocks').upsert({ user_id: user!.id, blocked_id: userId });
    setMsg(block ? 'گزارش ثبت و کاربر مسدود شد.' : 'گزارش ثبت شد. تیم ما بررسی می‌کند.');
    router.refresh();
  }

  return (
    <>
      <button className="text-xs text-muted underline" onClick={() => setOpen(!open)} aria-expanded={open}>گزارش یا مسدود کردن</button>
      {open && (
        <div className="card mt-2 text-start">
          {msg ? <p className="text-sm">{msg}</p> : (
            <>
              <label className="label" htmlFor="rep-reason">چه اتفاقی افتاد؟</label>
              <select id="rep-reason" className="input text-sm mb-2" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REPORT_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <textarea className="input text-sm mb-2" rows={2} aria-label="توضیحات" placeholder="توضیح (اختیاری)" value={details} onChange={(e) => setDetails(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-sec btn-sm flex-1" onClick={() => report(false)}>فقط گزارش</button>
                <button className="btn btn-danger btn-sm flex-1" onClick={() => report(true)}>گزارش و مسدود کردن {name}</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
