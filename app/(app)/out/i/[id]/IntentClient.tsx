'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import OutCard from '@/components/OutCard';
import { activityIcon, errText, faDateTime, type OutCard as Card } from '@/lib/outings';

type Intent = {
  id: string; activity: string; title: string; starts_after: string; starts_before: string; area_label: string | null;
  status: string; is_owner: boolean; plan_id: string | null; by?: Card; my_response?: string | null;
  responses?: (Card & { status: string; message: string | null })[];
};

export default function IntentClient({ i }: { i: Intent }) {
  const supabase = createClient();
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function respond() {
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('respond_outing_intent', { p_intent: i.id, p_message: msg.trim() || null });
    setBusy(false);
    if (error) return setErr(errText(error.message));
    fetch('/api/out/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'response', id: i.id }) }).catch(() => {});
    router.refresh();
  }
  async function accept(uid: string) {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('accept_outing_response', { p_intent: i.id, p_user: uid });
    setBusy(false);
    if (error) return setErr(errText(error.message));
    router.push(`/out/p/${data}`);
  }
  async function close() {
    await supabase.from('outing_intents').update({ status: 'closed' }).eq('id', i.id);
    router.push('/out');
  }

  return (
    <main className="page">
      <div className="card mb-4">
        <p className="text-3xl" aria-hidden>{activityIcon(i.activity)}</p>
        <h1 className="text-lg font-extrabold mt-1">{i.title}</h1>
        <p className="text-xs text-muted mt-1">{faDateTime(i.starts_after)} تا {faDateTime(i.starts_before)}{i.area_label ? ` · ${i.area_label}` : ''}</p>
        <p className="text-xs mt-2">{i.status === 'open' ? '🟢 باز' : i.status === 'matched' ? '🎉 جور شد' : 'بسته شد'}</p>
      </div>
      {err && <p className="text-sm text-warn mb-2" role="alert">{err}</p>}

      {i.is_owner ? (<>
        <h2 className="section">کسانی که پایه‌اند</h2>
        {(i.responses ?? []).length === 0 && <div className="card text-sm text-muted text-center py-6">هنوز کسی جواب نداده. به آدم‌های نزدیکی که می‌خورند خبر دادیم 🔔</div>}
        {(i.responses ?? []).map((r) => (
          <OutCard key={r.id} c={r}>
            {r.message && <p className="text-sm w-full bg-[#F4F4FA] rounded-xl px-3 py-2">«{r.message}»</p>}
            {r.status === 'interested' && i.status === 'open' && <button className="btn btn-sm" disabled={busy} onClick={() => accept(r.id)}>قبول، بریم 🙌</button>}
            {r.status === 'accepted' && <span className="chip chip-accent">قبول شد</span>}
          </OutCard>
        ))}
        {i.plan_id && <Link className="btn w-full mt-2" href={`/out/p/${i.plan_id}`}>رفتن به برنامه (وقت و جا)</Link>}
        {i.status === 'open' && <button className="text-xs text-warn w-full mt-6" onClick={close}>بستن دعوت</button>}
      </>) : (<>
        {i.by && <><h2 className="section">دعوت‌کننده</h2><OutCard c={i.by} /></>}
        {i.plan_id ? (
          <Link className="btn w-full" href={`/out/p/${i.plan_id}`}>قبول شدی 🎉 برو به برنامه</Link>
        ) : i.my_response ? (
          <div className="card text-sm text-center">اعلام آمادگی کردی. اگر قبول کند، خبرت می‌کنیم 🔔</div>
        ) : i.status === 'open' ? (
          <div className="card space-y-2">
            <label className="label" htmlFor="m">یک پیام کوتاه (اختیاری)</label>
            <textarea id="m" className="input" rows={2} maxLength={300} placeholder="سلام! من هم دنبال یه قهوه‌ام…" value={msg} onChange={(e) => setMsg(e.target.value)} />
            <button className="btn w-full" disabled={busy} onClick={respond}>پایه‌ام 🙋‍♀️</button>
          </div>
        ) : <div className="card text-sm text-center text-muted">این دعوت دیگر باز نیست.</div>}
        <p className="text-[11px] text-muted mt-3">نکته‌ی ایمنی: اولین دیدار را در یک جای عمومی بگذارید و به یک دوست بگویید کجایید.</p>
      </>)}
    </main>
  );
}
