'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import ReviewForm from '@/components/ReviewForm';
import type { Profile } from '@/lib/types';

const DEFAULT_TASKS = ['هدف امروز رو با همراهم گفتم', 'گوشی رو سایلنت کردم', 'یک بلوک کامل بدون وقفه کار کردم', 'در پایان جمع‌بندی کردیم'];
const CARDS = {
  'شروع': ['هدف امروزت دقیقاً چیه؟', 'اولین قدم کوچیکش چیه؟', 'چه چیزی ممکنه مانعت بشه؟'],
  'میانه': ['کجا گیر کردی؟', 'چه کمک مشخصی لازم داری؟', 'هنوز روی مسیری؟'],
  'پایان': ['چه چیزی انجام شد؟', 'قدم بعدی دقیقاً چیه؟', 'کِی دوباره چک‌این کنیم؟'],
};

export default function RoomClient({ connId, meId, meName, other }: { connId: string; meId: string; meName: string; other: Profile }) {
  const [tab, setTab] = useState<'focus' | 'video'>('focus');
  const [planned, setPlanned] = useState(25);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [checkin, setCheckin] = useState({ goal: '', why: '', blocker: '' });
  const [notes, setNotes] = useState('');
  const [wrapup, setWrapup] = useState({ did: '', next: '' });
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [done, setDone] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const remaining = Math.max(0, planned * 60 - elapsed);
  useEffect(() => {
    if (!running) return;
    const started = Date.now() - elapsed * 1000; // drift-free
    const h = setInterval(() => {
      const e = Math.floor((Date.now() - started) / 1000);
      setElapsed(e);
      if (e >= planned * 60) { setRunning(false); if ('vibrate' in navigator) navigator.vibrate(300); }
    }, 500);
    return () => clearInterval(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, planned]);

  async function finish() {
    setBusy(true);
    const supabase = createClient();
    const minutes = Math.round(elapsed / 60);
    const { error } = await supabase.from('sessions').insert({
      connection_id: connId, host: meId, planned_min: planned, actual_min: minutes, status: 'done',
      checkin, notes: notes || null, wrapup: { ...wrapup, tasks_done: done },
    });
    if (!error) {
      await supabase.from('messages').insert({ connection_id: connId, sender: meId,
        body: `جلسه تموم شد ✅ ${minutes.toLocaleString('fa-IR')} دقیقه.${wrapup.next ? ` قدم بعدی: ${wrapup.next}` : ''}` });
      setSaved(true);
    }
    setBusy(false);
  }

  const jitsiDomain = process.env.NEXT_PUBLIC_JITSI_DOMAIN || 'meet.jit.si';
  const jitsiSrc = `https://${jitsiDomain}/hamrah-${connId}#config.prejoinPageEnabled=false&userInfo.displayName=${encodeURIComponent(JSON.stringify(meName))}`;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  if (saved) {
    return (
      <main className="page">
        <div className="card text-center py-8 mb-4">
          <div className="text-5xl mb-2" aria-hidden>🎉</div>
          <h1 className="font-extrabold text-lg">جلسه ذخیره شد</h1>
          <p className="text-sm text-muted">{Math.round(elapsed / 60).toLocaleString('fa-IR')} دقیقه تمرکز با {other.name}</p>
        </div>
        <ReviewForm connectionId={connId} revieweeId={other.id} name={other.name} />
        <div className="flex gap-2 mt-4">
          <Link href={`/chat/${connId}`} className="btn btn-sec flex-1">بازگشت به چت</Link>
          <Link href="/sessions" className="btn flex-1">جلسه‌ها</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="flex items-center gap-2 mb-4">
        <Link href={`/chat/${connId}`} aria-label="بازگشت" className="w-9 h-9 grid place-items-center rounded-xl border border-line bg-white">→</Link>
        <h1 className="font-extrabold flex-1">جلسه با {other.name}</h1>
      </div>
      <div className="flex gap-2 mb-4" role="tablist">
        <button role="tab" aria-selected={tab === 'focus'} className={`chip flex-1 justify-center py-2 ${tab === 'focus' ? 'chip-on' : ''}`} onClick={() => setTab('focus')}>⏱ تمرکز</button>
        <button role="tab" aria-selected={tab === 'video'} className={`chip flex-1 justify-center py-2 ${tab === 'video' ? 'chip-on' : ''}`} onClick={() => setTab('video')}>🎥 تماس تصویری</button>
      </div>

      {/* video stays mounted so switching tabs doesn't drop the call */}
      <div className={tab === 'video' ? 'mb-4' : 'hidden'}>
        <div className="rounded-2xl overflow-hidden bg-black aspect-[3/4]">
          <iframe title="تماس تصویری" src={jitsiSrc} allow="camera; microphone; fullscreen; display-capture; autoplay" className="w-full h-full border-0" />
        </div>
        <p className="text-[11px] text-muted mt-2">لینک اتاق فقط برای شما دو نفر ساخته شده است.</p>
      </div>

      <div className="card text-center py-6 mb-4">
        <div className={`text-6xl font-extrabold tabular-nums ${remaining === 0 ? 'text-warn' : running ? 'text-accent' : 'text-primary'}`} dir="ltr" aria-live="off">{mm}:{ss}</div>
        <p className="text-xs text-muted mt-1">{remaining === 0 ? 'وقت تمام شد! جمع‌بندی کنید' : running ? 'در حال تمرکز…' : 'آماده‌ای؟'}</p>
        <div className="flex gap-2 justify-center mt-4">
          <button className="btn" onClick={() => setRunning(!running)} disabled={remaining === 0}>{running ? 'توقف' : elapsed ? 'ادامه' : 'شروع'}</button>
          <button className="btn btn-sec" onClick={() => { setRunning(false); setElapsed(0); }}>ریست</button>
        </div>
        <div className="flex gap-2 justify-center mt-3">
          {[15, 25, 50].map((m) => (
            <button key={m} disabled={running || elapsed > 0} aria-pressed={planned === m} onClick={() => setPlanned(m)}
              className={`chip ${planned === m ? 'chip-on' : ''}`}>{m.toLocaleString('fa-IR')} دقیقه</button>
          ))}
        </div>
      </div>

      <details className="card mb-4">
        <summary className="font-bold text-sm cursor-pointer">🃏 کارت‌های گفتگو</summary>
        {Object.entries(CARDS).map(([k, qs]) => (
          <div key={k} className="mt-3"><p className="text-xs font-bold text-muted mb-1">{k}</p>
            <ul className="text-sm list-disc ps-5 space-y-0.5">{qs.map((q) => <li key={q}>{q}</li>)}</ul></div>
        ))}
      </details>

      <div className="card mb-4 space-y-2">
        <p className="font-bold text-sm">چک‌این</p>
        {([['goal', 'هدف امروز'], ['why', 'چرا مهمه؟'], ['blocker', 'چه چیزی ممکنه مانعت بشه؟']] as const).map(([k, l]) => (
          <input key={k} className="input text-sm" aria-label={l} placeholder={l} value={checkin[k]} onChange={(e) => setCheckin({ ...checkin, [k]: e.target.value })} />
        ))}
      </div>

      <div className="card mb-4">
        <p className="font-bold text-sm mb-1">چک‌لیست</p>
        {tasks.map((t) => {
          const on = done.includes(t);
          return (
            <label key={t} className="flex items-center gap-3 py-2 border-b border-line last:border-0 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 accent-accent" checked={on} onChange={() => setDone(on ? done.filter((x) => x !== t) : [...done, t])} />
              <span className={`text-sm ${on ? 'line-through text-muted' : ''}`}>{t}</span>
            </label>
          );
        })}
        <form className="flex gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); if (newTask.trim()) { setTasks([...tasks, newTask.trim()]); setNewTask(''); } }}>
          <input className="input text-sm" aria-label="کار جدید" placeholder="کار جدید…" value={newTask} onChange={(e) => setNewTask(e.target.value)} />
          <button className="btn btn-sm" type="submit" aria-label="افزودن">＋</button>
        </form>
      </div>

      <div className="card mb-4">
        <label className="font-bold text-sm mb-2 block" htmlFor="notes">یادداشت</label>
        <textarea id="notes" className="input text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="card mb-4 space-y-2">
        <p className="font-bold text-sm">جمع‌بندی</p>
        <input className="input text-sm" aria-label="چه چیزی انجام شد" placeholder="چه چیزی انجام شد؟" value={wrapup.did} onChange={(e) => setWrapup({ ...wrapup, did: e.target.value })} />
        <input className="input text-sm" aria-label="قدم بعدی" placeholder="قدم بعدی" value={wrapup.next} onChange={(e) => setWrapup({ ...wrapup, next: e.target.value })} />
      </div>

      <button className="btn w-full" disabled={busy || elapsed < 60} onClick={finish}>{elapsed < 60 ? 'حداقل یک دقیقه تایمر را اجرا کنید' : 'پایان و ذخیره جلسه'}</button>
    </main>
  );
}
