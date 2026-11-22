'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AreaPicker, { type Area } from '@/components/AreaPicker';
import {
  ACTIVITY_NAMES, DAYS, LIFESTYLE, OUT_HOBBIES, OUT_LANGS, PARTS, USE_OPTS, VIS_OPTS, activityIcon, faNum,
  type Lifestyle, type LifestyleKey, type OutingProfile, type Use, type Vis,
} from '@/lib/outings';

const DONE = 99;
const EMPTY: Omit<OutingProfile, 'user_id'> = {
  birth_year: null, gender: null, job: '', hobbies: [], activities: [], places_liked: [], places_been: [], languages: ['فارسی'],
  budget: null, area_label: '', area_lat: null, area_lng: null, radius_km: 10, free_slots: [],
  vis: { age: 'public', job: 'matched', hobbies: 'public', places: 'public' }, pref: {}, builder_step: 0,
};
const EMPTY_LS: Lifestyle = { alcohol: null, cannabis: null, smoking: null, alcohol_share: 'hidden', cannabis_share: 'hidden', smoking_share: 'hidden', use_for_matching: false };

type Step = { key: string; q: (n: string) => string; hint?: string };
const STEPS: Step[] = [
  { key: 'activities', q: (n) => `سلام ${n} 👋 بیرون که می‌ری، بیشتر دوست داری چی‌کار کنی؟`, hint: 'هر چندتا که دوست داری' },
  { key: 'age', q: () => 'چند سالته؟ (سال تولد میلادی)', hint: 'خودت انتخاب می‌کنی کی ببیند' },
  { key: 'gender', q: () => 'برای برنامه‌های «فقط خانم‌ها»، خودت را چطور معرفی می‌کنی؟', hint: 'این هیچ‌وقت به کسی نشان داده نمی‌شود؛ فقط برای فیلتر «فقط خانم‌ها» است' },
  { key: 'job', q: () => 'چی‌کار می‌کنی؟ (شغل یا درس)' },
  { key: 'hobbies', q: () => 'تفریح‌ها و علاقه‌هات؟' },
  { key: 'places', q: () => 'کجاها رفتی و کجاها را خیلی دوست داشتی؟', hint: 'کافه، رستوران، پارک، شهر… هر کدام را بنویس و Enter بزن' },
  { key: 'languages', q: () => 'به چه زبان‌هایی راحت حرف می‌زنی؟' },
  { key: 'area', q: () => 'معمولاً کدوم طرف‌ها بیرون می‌ری؟', hint: 'فقط محدودهٔ تقریبی ذخیره می‌شود، نه آدرس' },
  { key: 'slots', q: () => 'معمولاً کِی آزادی؟', hint: 'روی خانه‌ها بزن' },
  { key: 'budget', q: () => 'بودجه‌ات برای بیرون رفتن معمولاً چطوره؟' },
  { key: 'lifestyle', q: () => 'چند تا سؤال خصوصی 🔒 جواب دادن اختیاریه.', hint: '«پنهان» یعنی هیچ‌کس نمی‌بیند. «دوطرفه» یعنی فقط کسانی می‌بینند که خودشان هم دوطرفه گذاشته‌اند و با تو در یک برنامه‌اند.' },
  { key: 'pref', q: () => 'دوست داری با چه کسانی جور بشی؟' },
];

export default function Builder({ userId, name, initial, initialLs }: { userId: string; name: string; initial: OutingProfile | null; initialLs: Lifestyle | null }) {
  const supabase = createClient();
  const [p, setP] = useState<Omit<OutingProfile, 'user_id'>>({ ...EMPTY, ...(initial ?? {}) });
  const [ls, setLs] = useState<Lifestyle>({ ...EMPTY_LS, ...(initialLs ?? {}) });
  const [step, setStep] = useState(Math.min(initial?.builder_step ?? 0, DONE));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [tag, setTag] = useState({ hob: '', liked: '', been: '' });
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'instant', block: 'center' }); }, [step]);

  async function save(next: number, patch: Partial<typeof p> = {}) {
    setSaving(true); setErr('');
    const row = { ...p, ...patch, user_id: userId, builder_step: Math.max(next, p.builder_step ?? 0), updated_at: new Date().toISOString(), job: (patch.job ?? p.job)?.trim() || null };
    const { error } = await supabase.from('outing_profiles').upsert(row);
    if (!error && STEPS[step]?.key === 'lifestyle') {
      const r = await supabase.from('outing_lifestyle').upsert({ ...ls, user_id: userId, updated_at: new Date().toISOString() });
      if (r.error) { setErr('ذخیره نشد. دوباره بزن.'); setSaving(false); return; }
    }
    setSaving(false);
    if (error) { setErr('ذخیره نشد. دوباره بزن.'); return; }
    setP({ ...p, ...patch, builder_step: row.builder_step });
    setStep(next);
  }
  const nextStep = () => (step + 1 >= STEPS.length ? DONE : step + 1);
  const toggle = (arr: string[], v: string, max = 20) => (arr.includes(v) ? arr.filter((x) => x !== v) : arr.length < max ? [...arr, v] : arr);

  function visRow(field: keyof OutingProfile['vis']) {
    return (
      <div className="flex gap-1.5 flex-wrap items-center mt-3" role="radiogroup" aria-label="چه کسی ببیند">
        <span className="text-[11px] text-muted">چه کسی ببیند؟</span>
        {VIS_OPTS.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={(p.vis[field] ?? 'public') === k}
            onClick={() => setP({ ...p, vis: { ...p.vis, [field]: k as Vis } })}
            className={`chip !text-[11px] ${(p.vis[field] ?? 'public') === k ? 'chip-on' : 'chip-ghost'}`}>{l}</button>
        ))}
      </div>
    );
  }
  function tags(k: 'hob' | 'liked' | 'been', field: 'hobbies' | 'places_liked' | 'places_been', ph: string) {
    const add = () => { const v = tag[k].trim(); if (v && !p[field].includes(v)) setP({ ...p, [field]: [...p[field], v].slice(0, 30) }); setTag({ ...tag, [k]: '' }); };
    return (
      <div>
        <div className="flex gap-2">
          <input className="input !py-2" aria-label={ph} placeholder={ph} value={tag[k]} maxLength={60}
            onChange={(e) => setTag({ ...tag, [k]: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <button type="button" className="btn btn-sec btn-sm" onClick={add}>＋</button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {p[field].map((v) => <button key={v} type="button" className="chip chip-on" onClick={() => setP({ ...p, [field]: p[field].filter((x) => x !== v) })} aria-label={`حذف ${v}`}>{v} ✕</button>)}
        </div>
      </div>
    );
  }

  function answerSummary(key: string): string {
    switch (key) {
      case 'activities': return p.activities.join('، ') || '—';
      case 'age': return p.birth_year ? `${faNum(new Date().getFullYear() - p.birth_year)} ساله` : 'نگفتم';
      case 'gender': return p.gender ? { woman: 'زن', man: 'مرد', other: 'دیگر', prefer_not: 'ترجیح می‌دم نگم' }[p.gender] : 'نگفتم';
      case 'job': return p.job || 'نگفتم';
      case 'hobbies': return p.hobbies.join('، ') || '—';
      case 'places': return [...p.places_liked, ...p.places_been].slice(0, 6).join('، ') || '—';
      case 'languages': return p.languages.join('، ');
      case 'area': return p.area_label || '—';
      case 'slots': return p.free_slots.length ? `${faNum(p.free_slots.length)} وقت آزاد` : '—';
      case 'budget': return { low: 'کم‌خرج', mid: 'متوسط', high: 'دست‌ودلباز' }[p.budget ?? 'mid'] ?? '—';
      case 'lifestyle': return '🔒 ثبت شد';
      case 'pref': return 'ثبت شد';
    }
    return '';
  }

  function widget(key: string) {
    switch (key) {
      case 'activities': return (
        <div className="flex flex-wrap gap-1.5">{ACTIVITY_NAMES.map((a) => (
          <button key={a} type="button" aria-pressed={p.activities.includes(a)} onClick={() => setP({ ...p, activities: toggle(p.activities, a) })}
            className={`chip ${p.activities.includes(a) ? 'chip-on' : ''}`}>{activityIcon(a)} {a}</button>))}</div>);
      case 'age': return (<>
        <input className="input" type="number" inputMode="numeric" aria-label="سال تولد" placeholder="مثلاً 1993" min={1930} max={2008}
          value={p.birth_year ?? ''} onChange={(e) => setP({ ...p, birth_year: e.target.value ? Number(e.target.value) : null })} />
        {p.birth_year != null && (p.birth_year > 2008 || p.birth_year < 1930) && <p className="text-xs text-warn mt-1" role="alert">این بخش برای ۱۸ سال به بالاست.</p>}
        {visRow("age")}</>);
      case 'gender': return (
        <div className="flex flex-wrap gap-1.5">{([['woman', 'زن'], ['man', 'مرد'], ['other', 'دیگر'], ['prefer_not', 'ترجیح می‌دم نگم']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={p.gender === k} onClick={() => setP({ ...p, gender: k })} className={`chip ${p.gender === k ? 'chip-on' : ''}`}>{l}</button>))}</div>);
      case 'job': return (<>
        <input className="input" aria-label="شغل" placeholder="مثلاً: طراح محصول، دانشجوی معماری" maxLength={80} value={p.job ?? ''} onChange={(e) => setP({ ...p, job: e.target.value })} />
        {visRow("job")}</>);
      case 'hobbies': return (<>
        <div className="flex flex-wrap gap-1.5 mb-2">{OUT_HOBBIES.map((h) => (
          <button key={h} type="button" aria-pressed={p.hobbies.includes(h)} onClick={() => setP({ ...p, hobbies: toggle(p.hobbies, h) })} className={`chip ${p.hobbies.includes(h) ? 'chip-on' : ''}`}>{h}</button>))}</div>
        {tags("hob", "hobbies", "چیز دیگه‌ای هم هست؟")}
        {visRow("hobbies")}</>);
      case 'places': return (<div className="space-y-3">
        <div><p className="text-xs font-bold mb-1">❤️ جاهایی که خیلی دوست داشتی</p>{tags("liked", "places_liked", "مثلاً: کافه Hopper، پارک Kralingse Bos")}</div>
        <div><p className="text-xs font-bold mb-1">📍 جاهایی که رفتی</p>{tags("been", "places_been", "مثلاً: Markthal، Kinderdijk، پاریس")}</div>
        {visRow("places")}</div>);
      case 'languages': return (
        <div className="flex flex-wrap gap-1.5">{OUT_LANGS.map((l) => (
          <button key={l} type="button" aria-pressed={p.languages.includes(l)} onClick={() => setP({ ...p, languages: toggle(p.languages, l) })} className={`chip ${p.languages.includes(l) ? 'chip-on' : ''}`}>{l}</button>))}</div>);
      case 'area': return (<>
        <AreaPicker value={{ label: p.area_label ?? '', lat: p.area_lat, lng: p.area_lng }} onChange={(a: Area) => setP({ ...p, area_label: a.label, area_lat: a.lat, area_lng: a.lng })} />
        <label className="label !text-xs mt-3" htmlFor="rad">تا چند کیلومتر راه می‌آیی؟ {faNum(p.radius_km)} کیلومتر</label>
        <input id="rad" type="range" min={1} max={50} value={p.radius_km} onChange={(e) => setP({ ...p, radius_km: Number(e.target.value) })} className="w-full accent-[#6C5CE7]" /></>);
      case 'slots': return (
        <table className="w-full text-[11px] text-center border-separate border-spacing-1">
          <thead><tr><th></th>{PARTS.map(([k, l]) => <th key={k} scope="col" className="font-semibold text-muted">{l}</th>)}</tr></thead>
          <tbody>{DAYS.map(([d, dl]) => (
            <tr key={d}><th scope="row" className="text-right font-semibold">{dl}</th>
              {PARTS.map(([pt, pl]) => { const v = `${d}:${pt}`, on = p.free_slots.includes(v); return (
                <td key={pt}><button type="button" aria-pressed={on} aria-label={`${dl} ${pl}`} onClick={() => setP({ ...p, free_slots: toggle(p.free_slots, v, 28) })}
                  className={`w-full h-8 rounded-lg ${on ? 'bg-primary text-white' : 'bg-[#F1F1F7]'}`}>{on ? '✓' : ''}</button></td>); })}
            </tr>))}</tbody>
        </table>);
      case 'budget': return (
        <div className="flex gap-1.5">{([['low', '💶 کم‌خرج'], ['mid', '💶💶 متوسط'], ['high', '💶💶💶 دست‌ودلباز']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={p.budget === k} onClick={() => setP({ ...p, budget: k })} className={`chip flex-1 justify-center py-2 ${p.budget === k ? 'chip-on' : ''}`}>{l}</button>))}</div>);
      case 'lifestyle': return (<div className="space-y-4">
        {LIFESTYLE.map(([k, l, ico]) => {
          const shareKey = `${k}_share` as const;
          return (
            <fieldset key={k} className="bg-[#F7F6FF] rounded-2xl p-3">
              <legend className="text-sm font-bold">{ico} {l} مصرف می‌کنی؟</legend>
              <div className="flex gap-1.5 mt-2">{USE_OPTS.map(([v, vl]) => (
                <button key={v} type="button" aria-pressed={ls[k] === v} onClick={() => setLs({ ...ls, [k]: ls[k] === v ? null : (v as Use) })}
                  className={`chip flex-1 justify-center ${ls[k] === v ? 'chip-on' : ''}`}>{vl}</button>))}</div>
              <div className="flex gap-1.5 mt-2 items-center" role="radiogroup" aria-label={`اشتراک ${l}`}>
                <span className="text-[11px] text-muted">نمایش:</span>
                {([['hidden', '🔒 پنهان'], ['mutual', '🤝 دوطرفه']] as const).map(([v, vl]) => (
                  <button key={v} type="button" role="radio" aria-checked={ls[shareKey] === v} onClick={() => setLs({ ...ls, [shareKey]: v })}
                    className={`chip !text-[11px] ${ls[shareKey] === v ? 'chip-on' : 'chip-ghost'}`}>{vl}</button>))}
              </div>
            </fieldset>);
        })}
        <label className="flex gap-2 items-start text-xs bg-white border-2 border-line rounded-2xl p-3">
          <input type="checkbox" className="mt-0.5" checked={ls.use_for_matching} onChange={(e) => setLs({ ...ls, use_for_matching: e.target.checked })} />
          <span>جواب‌های پنهانم هم برای پیشنهاد آدم و جا استفاده شود (به کسی نشان داده نمی‌شود، اما ممکن است از روی پیشنهادها حدس زده شود).</span>
        </label></div>);
      case 'pref': {
        const pr = p.pref; const av = pr.avoid ?? {};
        return (<div className="space-y-3">
          <div className="flex gap-2 items-center text-sm">
            <span>سن از</span>
            <input className="input !w-20 !py-2" type="number" aria-label="حداقل سن" min={18} max={99} value={pr.age_min ?? ''} onChange={(e) => setP({ ...p, pref: { ...pr, age_min: e.target.value ? Number(e.target.value) : undefined } })} />
            <span>تا</span>
            <input className="input !w-20 !py-2" type="number" aria-label="حداکثر سن" min={18} max={99} value={pr.age_max ?? ''} onChange={(e) => setP({ ...p, pref: { ...pr, age_max: e.target.value ? Number(e.target.value) : undefined } })} />
          </div>
          {p.gender === 'woman' && (
            <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={!!pr.women_only} onChange={(e) => setP({ ...p, pref: { ...pr, women_only: e.target.checked } })} /> فقط با خانم‌ها جور شوم</label>)}
          <p className="text-xs font-bold">ترجیح می‌دهم با کسی که … جور نشوم:</p>
          {LIFESTYLE.map(([k, l]) => (
            <label key={k} className="flex gap-2 items-center text-sm">
              <input type="checkbox" checked={!!av[k as LifestyleKey]} onChange={(e) => setP({ ...p, pref: { ...pr, avoid: { ...av, [k]: e.target.checked } } })} /> {l} مصرف می‌کند
            </label>))}
          <p className="text-[11px] text-muted">این فقط روی کسانی اثر دارد که خودشان اجازه داده‌اند جوابشان برای پیشنهاد استفاده شود.</p>
        </div>);
      }
    }
    return null;
  }

  const current = step < STEPS.length ? STEPS[step] : null;
  // DECISION: Q16 — 18+ only (birth year ≤ 2008)
  const ageBad = current?.key === 'age' && p.birth_year != null && (p.birth_year > 2008 || p.birth_year < 1930);

  return (
    <div className="space-y-3">
      {STEPS.slice(0, step === DONE ? STEPS.length : step).map((s, i) => (
        <div key={s.key} className="space-y-1">
          <div className="max-w-[85%] bg-white rounded-2xl rounded-tr-md px-3 py-2 text-xs text-muted shadow-sm">{s.q(name)}</div>
          <div className="flex justify-end">
            <button className="max-w-[85%] bg-primary text-white rounded-2xl rounded-tl-md px-3 py-2 text-xs text-right" onClick={() => setStep(i)} aria-label={`ویرایش: ${s.q(name)}`}>
              {answerSummary(s.key)} <span className="opacity-70">✎</span>
            </button>
          </div>
        </div>
      ))}

      {current && (
        <div className="space-y-2" aria-live="polite">
          <div className="max-w-[90%] bg-white rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
            <p className="text-sm font-bold">{current.q(name)}</p>
            {current.hint && <p className="text-[11px] text-muted mt-1">{current.hint}</p>}
          </div>
          <div className="card">{widget(current.key)}</div>
          {err && <p className="text-xs text-warn" role="alert">{err}</p>}
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={saving || ageBad || (current.key === 'activities' && p.activities.length === 0)} onClick={() => save(nextStep())}>
              {saving ? '…' : step + 1 >= STEPS.length ? 'تمام ✓' : 'بعدی'}
            </button>
            {current.key !== 'activities' && <button className="btn btn-sec" disabled={saving} onClick={() => save(nextStep(), {})}>رد شو</button>}
          </div>
          {initial?.builder_step === DONE && <button className="text-xs text-muted w-full" onClick={() => setStep(DONE)}>بازگشت به خلاصه</button>}
        </div>
      )}

      {step === DONE && (
        <div className="card text-center space-y-3">
          <p className="text-sm font-bold">پروفایلت آماده است 🎉</p>
          <p className="text-xs text-muted">روی هر جواب بزن تا عوضش کنی.</p>
          <div className="flex gap-2 justify-center">
            <Link href="/out/people" className="btn btn-sm">آدم‌های هم‌سلیقه</Link>
            <Link href="/out" className="btn btn-sec btn-sm">بریم بیرون</Link>
          </div>
        </div>
      )}
      <div ref={bottom} />
    </div>
  );
}
