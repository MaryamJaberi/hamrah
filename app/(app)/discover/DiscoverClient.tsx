'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import UserHead from '@/components/UserCard';
import RequestForm from '@/components/RequestForm';
import type { Profile } from '@/lib/types';

type Req = { id: string; message: string | null; from: Profile };
type Props = {
  meName: string; myInterests: string[];
  ranked: { user: Profile; score: number }[];
  incoming: Req[]; outgoing: { to_user: string; status: string }[]; goals: { id: string; title: string }[];
};

export default function DiscoverClient({ ranked, incoming, outgoing, goals, myInterests }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function accept(r: Req) {
    setBusy(r.id);
    const { data: connId, error } = await supabase.rpc('accept_request', { p_request: r.id });
    setBusy(null);
    if (!error && connId) router.push(`/chat/${connId}`);
  }
  async function reject(id: string) {
    setBusy(id);
    await supabase.from('requests').update({ status: 'rejected' }).eq('id', id);
    setBusy(null); router.refresh();
  }

  return (
    <>
      {incoming.length > 0 && (
        <section aria-labelledby="inc">
          <h2 id="inc" className="section mt-0">درخواست‌های دریافتی ({incoming.length})</h2>
          {incoming.map((r) => (
            <div key={r.id} className="card mb-3">
              <UserHead u={r.from} />
              {r.message && <p className="text-sm mt-2">{r.message}</p>}
              <div className="flex gap-2 mt-3">
                <button className="btn btn-sm flex-1" disabled={busy === r.id} onClick={() => accept(r)}>قبول و شروع گفتگو</button>
                <Link className="btn btn-sec btn-sm" href={`/u/${r.from.id}`}>پروفایل</Link>
                <button className="btn btn-danger btn-sm" disabled={busy === r.id} onClick={() => reject(r.id)}>رد</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <h2 className="section">پیشنهاد برای تو</h2>
      {ranked.length === 0 && (
        <div className="card text-center text-sm text-muted py-8">هنوز کاربر دیگری نیست. دوستانت را دعوت کن 🌱</div>
      )}
      {ranked.map(({ user, score }) => {
        const sent = outgoing.find((o) => o.to_user === user.id && o.status !== 'rejected');
        const shared = user.interests.filter((i) => myInterests.includes(i));
        return (
          <div key={user.id} className="card mb-3">
            <Link href={`/u/${user.id}`}><UserHead u={user} right={<span className="chip chip-accent text-[11px]">{score}٪ تطابق</span>} /></Link>
            {user.bio && <p className="text-sm text-[#4a4a5e] mt-2">{user.bio}</p>}
            <div className="flex flex-wrap gap-1 mt-2">
              {shared.slice(0, 3).map((i) => <span key={i} className="chip text-[11px]">{i}</span>)}
              {user.teach_langs.slice(0, 2).map((l) => <span key={l} className="chip chip-accent text-[11px]">{l} ✓</span>)}
            </div>
            <div className="mt-3">
              {sent
                ? <button className="btn btn-sec w-full btn-sm" disabled>{sent.status === 'pending' ? '⏳ در انتظار پاسخ' : '✓ وصل شدید'}</button>
                : <RequestForm to={user} goals={goals} onSent={() => router.refresh()} />}
            </div>
          </div>
        );
      })}
    </>
  );
}
