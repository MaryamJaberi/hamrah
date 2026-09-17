'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { notify } from '@/lib/notify';
import type { Profile } from '@/lib/types';

export default function RequestForm({ to, goals, onSent }: { to: Profile; goals: { id: string; title: string }[]; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(`سلام ${to.name}! دیدم علاقه‌مون مشترکه. بیا یه جلسه همراهی بذاریم؟`);
  const [goalId, setGoalId] = useState(goals[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    setBusy(true); setErr('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('requests')
      .insert({ from_user: user!.id, to_user: to.id, message: msg.trim() || null, goal_id: goalId || null }).select('id').single();
    setBusy(false);
    if (error) return setErr(error.code === '23505' ? 'قبلاً درخواست دادی.' : 'ارسال نشد.');
    notify('request', data.id);
    setOpen(false); onSent();
  }

  if (!open) return <button className="btn w-full btn-sm" onClick={() => setOpen(true)}>درخواست اتصال</button>;
  return (
    <div className="space-y-2">
      {goals.length > 0 && (
        <select className="input text-sm" aria-label="برای کدام هدف" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      )}
      <textarea className="input text-sm" rows={2} maxLength={500} aria-label="پیام" value={msg} onChange={(e) => setMsg(e.target.value)} />
      {err && <p role="alert" className="text-warn text-xs">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-sec btn-sm" onClick={() => setOpen(false)}>انصراف</button>
        <button className="btn btn-sm flex-1" disabled={busy} onClick={send}>ارسال</button>
      </div>
    </div>
  );
}
