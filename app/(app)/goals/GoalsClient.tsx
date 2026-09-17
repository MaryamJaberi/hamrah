'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { INTERESTS, MODES } from '@/lib/constants';
import type { Goal, Mode } from '@/lib/types';

const LEVELS = [['light', 'سبک'], ['medium', 'متوسط'], ['serious', 'جدی']] as const;

export default function GoalsClient({ goals }: { goals: Goal[] }) {
  const empty = { title: '', category: INTERESTS[0], per_week: 2, level: 'medium' as Goal['level'], mode: 'both' as Mode };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const supabase = createClient();
  const router = useRouter();

  async function create() {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('goals').insert({ user_id: user!.id, ...f, title: f.title.trim() });
    if (!error) { setOpen(false); setF(empty); router.refresh(); }
  }
  async function setProgress(g: Goal, delta: number) {
    await supabase.from('goals').update({ progress: Math.max(0, Math.min(100, g.progress + delta)) }).eq('id', g.id);
    router.refresh();
  }
  async function remove(g: Goal) {
    if (!confirm('این هدف حذف شود؟')) return;
    await supabase.from('goals').delete().eq('id', g.id);
    router.refresh();
  }

  return (
    <>
      <button className="btn w-full mb-4" onClick={() => setOpen(!open)} aria-expanded={open}>＋ هدف جدید</button>
      {open && (
        <div className="card mb-4 space-y-3">
          <div><label className="label" htmlFor="g-title">می‌خوام…</label>
            <input id="g-title" className="input" placeholder="مثلاً: اسب‌سواری یاد بگیرم" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><label className="label" htmlFor="g-cat">دسته</label>
            <select id="g-cat" className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {INTERESTS.map((c) => <option key={c}>{c}</option>)}
            </select></div>
          <div><p className="label">چند بار در هفته؟</p>
            <div className="flex gap-2">{[1, 2, 3, 5].map((n) => (
              <button key={n} aria-pressed={f.per_week === n} onClick={() => setF({ ...f, per_week: n })} className={`chip flex-1 justify-center py-2 ${f.per_week === n ? 'chip-on' : ''}`}>{n.toLocaleString('fa-IR')}</button>
            ))}</div></div>
          <div><p className="label">سطح تعهد</p>
            <div className="flex gap-2">{LEVELS.map(([k, l]) => (
              <button key={k} aria-pressed={f.level === k} onClick={() => setF({ ...f, level: k })} className={`chip flex-1 justify-center py-2 ${f.level === k ? 'chip-on' : ''}`}>{l}</button>
            ))}</div></div>
          <div><p className="label">شیوه</p>
            <div className="flex gap-2">{MODES.map(([k, l]) => (
              <button key={k} aria-pressed={f.mode === k} onClick={() => setF({ ...f, mode: k })} className={`chip flex-1 justify-center py-2 ${f.mode === k ? 'chip-on' : ''}`}>{l}</button>
            ))}</div></div>
          <button className="btn w-full" disabled={!f.title.trim()} onClick={create}>ساخت هدف</button>
        </div>
      )}
      {goals.length === 0 && <div className="card text-center text-sm text-muted py-8">هنوز هدفی نداری 🎯</div>}
      {goals.map((g) => (
        <div key={g.id} className="card mb-3">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="font-bold">{g.title}</div>
              <div className="text-xs text-muted">{g.category} · {g.per_week.toLocaleString('fa-IR')} بار در هفته · {LEVELS.find((l) => l[0] === g.level)?.[1]}</div>
            </div>
            <span className={`chip ${g.progress >= 100 ? 'chip-accent' : ''}`}>{g.progress.toLocaleString('fa-IR')}٪</span>
          </div>
          <div className="h-2 bg-[#EDEDF5] rounded-full mt-3 overflow-hidden" role="progressbar" aria-valuenow={g.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-all" style={{ width: `${g.progress}%` }} />
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-sec btn-sm flex-1" onClick={() => setProgress(g, 10)}>✓ یک قدم جلو رفتم</button>
            <button className="btn btn-sec btn-sm" aria-label="یک قدم عقب" onClick={() => setProgress(g, -10)}>−</button>
            <button className="btn btn-danger btn-sm" onClick={() => remove(g)}>حذف</button>
          </div>
        </div>
      ))}
    </>
  );
}
