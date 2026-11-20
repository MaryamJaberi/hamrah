'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AVATARS, INTERESTS, LANGS, MODES } from '@/lib/constants';
import type { Mode } from '@/lib/types';

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [f, setF] = useState({
    name: '', city: '', avatar: '🙂', interests: [] as string[],
    teach_langs: ['فارسی'], learn_langs: ['انگلیسی'], mode: 'both' as Mode,
  });
  const router = useRouter();
  const supabase = createClient();

  const toggle = (k: 'interests' | 'teach_langs' | 'learn_langs', v: string) =>
    setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  const canNext = step === 0 ? f.name.trim().length > 0 : step === 1 ? f.interests.length >= 2 : true;

  async function finish() {
    setBusy(true); setErr('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace('/login');
    const { error } = await supabase.from('profiles').insert({ id: user.id, ...f, name: f.name.trim(), city: f.city.trim() || 'آنلاین' });
    if (error) { console.error('onboarding: profile insert failed', error); setErr('ذخیره نشد، دوباره امتحان کن'); setBusy(false); return; }
    await supabase.from('goals').insert({ user_id: user.id, title: `تمرین ${f.interests[0]}`, category: f.interests[0], mode: f.mode });
    router.replace('/discover');
    router.refresh();
  }

  return (
    <main className="min-h-screen p-6 flex flex-col">
      <div className="flex gap-1.5 mb-8" aria-hidden>
        {[0, 1, 2].map((i) => <div key={i} className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`} />)}
      </div>

      {step === 0 && (
        <>
          <h1 className="text-2xl font-extrabold mb-2">خوش اومدی 👋</h1>
          <p className="text-muted text-sm mb-6">بگو کی هستی تا همراه مناسب پیدا کنیم.</p>
          <label className="label" htmlFor="ob-name">اسم</label>
          <input id="ob-name" className="input mb-4" value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <label className="label" htmlFor="ob-city">شهر</label>
          <input id="ob-city" className="input mb-4" placeholder="روتردام / تهران / آنلاین" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <p className="label">آواتار</p>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button key={a} aria-pressed={f.avatar === a} onClick={() => setF({ ...f, avatar: a })}
                className={`chip text-lg ${f.avatar === a ? 'ring-2 ring-primary' : ''}`}>{a}</button>
            ))}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="text-2xl font-extrabold mb-2">علاقه‌هات چیه؟</h1>
          <p className="text-muted text-sm mb-6">حداقل دو مورد انتخاب کن.</p>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <button key={i} aria-pressed={f.interests.includes(i)} onClick={() => toggle('interests', i)}
                className={`chip ${f.interests.includes(i) ? 'chip-on' : ''}`}>{i}</button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-2xl font-extrabold mb-2">زبان و شیوه جلسه</h1>
          {([['teach_langs', 'بلدم و می‌تونم یاد بدم'], ['learn_langs', 'می‌خوام یاد بگیرم']] as const).map(([k, l]) => (
            <div key={k} className="mb-5">
              <p className="label">{l}</p>
              <div className="flex flex-wrap gap-2">
                {LANGS.map((x) => (
                  <button key={x} aria-pressed={f[k].includes(x)} onClick={() => toggle(k, x)}
                    className={`chip ${f[k].includes(x) ? 'chip-on' : ''}`}>{x}</button>
                ))}
              </div>
            </div>
          ))}
          <p className="label">جلسه‌ها</p>
          <div className="flex gap-2">
            {MODES.map(([k, l]) => (
              <button key={k} aria-pressed={f.mode === k} onClick={() => setF({ ...f, mode: k })}
                className={`chip flex-1 justify-center py-2 ${f.mode === k ? 'chip-on' : ''}`}>{l}</button>
            ))}
          </div>
        </>
      )}

      <div className="flex-1" />
      {err && <p role="alert" className="text-warn text-sm mb-3">{err}</p>}
      <div className="flex gap-3 mt-6">
        {step > 0 && <button className="btn btn-sec flex-1" onClick={() => setStep(step - 1)}>قبلی</button>}
        <button className="btn flex-1" disabled={!canNext || busy} onClick={() => (step < 2 ? setStep(step + 1) : finish())}>
          {step === 2 ? (busy ? '…' : 'شروع کنیم') : 'بعدی'}
        </button>
      </div>
    </main>
  );
}
