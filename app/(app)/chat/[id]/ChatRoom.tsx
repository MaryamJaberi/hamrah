'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { notify } from '@/lib/notify';
import type { Message, Profile } from '@/lib/types';

const QUICK = ['کِی وقت داری جلسه بذاریم؟', '۲۵ دقیقه‌ای شروع کنیم؟', 'هدف این هفته‌ت چیه؟', 'آنلاین یا حضوری؟', 'کجای کار گیر کردی؟'];

export default function ChatRoom({ connId, meId, other, initial }: { connId: string; meId: string; other: Profile; initial: Message[] }) {
  const [msgs, setMsgs] = useState<Message[]>(initial);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    const ch = supabase.channel(`messages:${connId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `connection_id=eq.${connId}` },
        (p) => setMsgs((m) => (m.some((x) => x.id === (p.new as Message).id) ? m : [...m, p.new as Message])))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [connId, supabase]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  async function send(body = text) {
    body = body.trim();
    if (!body) return;
    setText(''); setErr('');
    const { data, error } = await supabase.from('messages').insert({ connection_id: connId, sender: meId, body }).select().single();
    if (error) { setErr('ارسال نشد'); setText(body); return; }
    setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
    notify('message', data.id);
  }

  return (
    <div className="flex flex-col h-[100dvh] fixed inset-0 z-50 mx-auto max-w-[480px] bg-[#F4F4FA]">
      <header className="bg-white/95 backdrop-blur p-3 border-b border-line flex items-center gap-3">
        <Link href="/chat" aria-label="بازگشت" className="w-9 h-9 grid place-items-center rounded-xl border border-line">→</Link>
        <Link href={`/u/${other.id}`} className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl" aria-hidden>{other.avatar}</span>
          <span className="font-bold text-sm truncate">{other.name}</span>
        </Link>
        <Link href={`/room/${connId}`} className="btn btn-sm">▶ جلسه</Link>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[78%] w-fit px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
            m.sender === meId ? 'bg-primary text-white ms-auto rounded-bl-md' : 'bg-white border border-line rounded-br-md'}`}>
            {m.body}
            <span className="block text-[10px] opacity-60 mt-0.5">{new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <div className="flex gap-2 px-3 pt-2 overflow-x-auto bg-white">
        {QUICK.map((q) => <button key={q} className="chip whitespace-nowrap" onClick={() => send(q)}>{q}</button>)}
      </div>
      <form className="p-3 bg-white flex gap-2 pb-[calc(12px+env(safe-area-inset-bottom))]" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input className="input flex-1 rounded-full" aria-label="پیام" placeholder="پیامت رو بنویس…" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" aria-label="ارسال" className="w-12 h-12 rounded-full bg-primary text-white grid place-items-center text-lg">↑</button>
      </form>
      {err && <p role="alert" className="text-warn text-xs text-center pb-2 bg-white">{err}</p>}
    </div>
  );
}
