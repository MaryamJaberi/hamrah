'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import OutCard from '@/components/OutCard';
import { activityIcon, errText, type OutCard as Card } from '@/lib/outings';

export default function PeopleClient({ people, plans, activities, current }: { people: Card[]; plans: { id: string; title: string }[]; activities: string[]; current: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [plan, setPlan] = useState(plans[0]?.id ?? '');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState('');

  async function invite(uid: string) {
    setErr('');
    const { error } = await supabase.rpc('invite_to_outing_plan', { p_plan: plan, p_user: uid });
    if (error) return setErr(errText(error.message));
    setDone({ ...done, [uid]: true });
    fetch('/api/out/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'invite', id: plan, user: uid }) }).catch(() => {});
  }

  return (<>
    <div className="flex gap-1.5 overflow-x-auto pb-2">
      <button onClick={() => router.push('/out/people')} className={`chip shrink-0 ${!current ? 'chip-on' : 'chip-ghost'}`}>همه</button>
      {activities.map((a) => (
        <button key={a} onClick={() => router.push(`/out/people?a=${encodeURIComponent(a)}`)} className={`chip shrink-0 ${current === a ? 'chip-on' : 'chip-ghost'}`}>{activityIcon(a)} {a}</button>
      ))}
    </div>
    {plans.length > 0 ? (
      <div className="card mb-3">
        <label className="label !text-xs" htmlFor="pl">دعوت به برنامه‌ی</label>
        <select id="pl" className="input !py-2" value={plan} onChange={(e) => setPlan(e.target.value)}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
    ) : (
      <p className="text-xs text-muted mb-3">برای دعوت کسی، <Link className="text-primary font-bold" href="/out/new">یک برنامه بساز</Link> یا <Link className="text-primary font-bold" href="/out/intent/new">دعوت باز بگذار</Link>.</p>
    )}
    {err && <p className="text-sm text-warn mb-2" role="alert">{err}</p>}
    {people.length === 0 && <div className="card text-center text-sm text-muted py-8">هنوز کسی نزدیکت پیدا نشد. شعاع را در پروفایل بزرگ‌تر کن یا یک دعوت باز بگذار.</div>}
    {people.map((c) => (
      <OutCard key={c.id} c={c}>
        {plans.length > 0 && (done[c.id]
          ? <span className="chip chip-accent">دعوت شد ✓</span>
          : <button className="btn btn-sm" onClick={() => invite(c.id)}>💌 دعوت به برنامه</button>)}
        <Link className="btn btn-sec btn-sm" href={`/u/${c.id}`}>پروفایل</Link>
      </OutCard>
    ))}
  </>);
}
