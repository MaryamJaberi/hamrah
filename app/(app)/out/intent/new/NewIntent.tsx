'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AreaPicker, { type Area } from '@/components/AreaPicker';
import { ACTIVITY_NAMES, OUT_HOBBIES, activityIcon, errText, faNum } from '@/lib/outings';

const WHEN = [
  ['now', 'همین الان تا ۳ ساعت دیگه', 0, 3],
  ['tonight', 'امشب', 0, 0],
  ['tomorrow', 'فردا', 1, 24],
  ['weekend', 'این آخر هفته', -1, -1],
  ['week', 'تو این هفته', 0, 24 * 7],
] as const;

function windowFor(k: (typeof WHEN)[number][0]): [Date, Date] {
  const now = new Date();
  if (k === 'now') return [now, new Date(now.getTime() + 3 * 3600e3)];
  if (k === 'tonight') { const a = new Date(now); a.setHours(Math.max(now.getHours(), 18), 0, 0, 0); const b = new Date(now); b.setHours(23, 59, 0, 0); return [a < now ? now : a, b]; }
  if (k === 'tomorrow') { const a = new Date(now); a.setDate(a.getDate() + 1); a.setHours(9, 0, 0, 0); const b = new Date(a); b.setHours(23, 0, 0, 0); return [a, b]; }
  if (k === 'weekend') { const a = new Date(now); const add = (6 - a.getDay() + 7) % 7; a.setDate(a.getDate() + add); a.setHours(9, 0, 0, 0); const b = new Date(a); b.setDate(b.getDate() + 1); b.setHours(23, 0, 0, 0); return [a < now ? now : a, b]; }
  return [now, new Date(now.getTime() + 7 * 24 * 3600e3)];
}

export default function NewIntent({ isWoman, area: a0, fav }: { isWoman: boolean; area: Area; fav: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [activity, setActivity] = useState(fav);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<(typeof WHEN)[number][0]>('tomorrow');
  const [area, setArea] = useState<Area>(a0);
  const [radius, setRadius] = useState(5);
  const [ageMin, setAgeMin] = useState<number | ''>('');
  const [ageMax, setAgeMax] = useState<number | ''>('');
  const [womenOnly, setWomenOnly] = useState(isWoman);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [max, setMax] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function post() {
    if (area.lat == null) { setErr('یک محدوده انتخاب کن (جستجو یا موقعیت فعلی).'); return; }
    setBusy(true); setErr('');
    const [a, b] = windowFor(when);
    const want: Record<string, unknown> = { women_only: womenOnly };
    // DECISION: Q17 — hobbies are a soft preference only (not a filter)
    if (ageMin) want.age_min = ageMin; if (ageMax) want.age_max = ageMax; if (hobbies.length) want.hobbies = hobbies;
    const { data, error } = await supabase.rpc('create_outing_intent', {
      p_activity: activity, p_title: title.trim() || `${activity} با یه همراه`, p_after: a.toISOString(), p_before: b.toISOString(),
      p_area_label: area.label || null, p_lat: area.lat, p_lng: area.lng, p_radius: radius, p_want: want, p_max: max,
    });
    if (error) { setBusy(false); setErr(errText(error.message)); return; }
    await fetch('/api/out/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'intent', id: data }) }).catch(() => {});
    router.push(`/out/i/${data}`);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="label">می‌خوام…</p>
        <div className="flex flex-wrap gap-1.5">{ACTIVITY_NAMES.map((a) => (
          <button key={a} type="button" aria-pressed={activity === a} onClick={() => setActivity(a)} className={`chip ${activity === a ? 'chip-on' : ''}`}>{activityIcon(a)} {a}</button>))}</div>
        <label className="label mt-3" htmlFor="t">یک جملهٔ کوتاه</label>
        <input id="t" className="input" maxLength={120} placeholder={`مثلاً: ${activity} و گپ دربارهٔ کتاب، به فارسی یا هلندی`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="card">
        <p className="label">کِی؟</p>
        <div className="flex flex-wrap gap-1.5">{WHEN.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={when === k} onClick={() => setWhen(k)} className={`chip ${when === k ? 'chip-on' : ''}`}>{l}</button>))}</div>
      </div>

      <div className="card">
        <label className="label" htmlFor="area">کجا؟</label>
        <AreaPicker value={area} onChange={setArea} />
        <label className="label !text-xs mt-3" htmlFor="r">تا شعاع {faNum(radius)} کیلومتر</label>
        <input id="r" type="range" min={1} max={30} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-[#6C5CE7]" />
      </div>

      <div className="card space-y-3">
        <p className="label !mb-0">با چه کسی؟</p>
        <div className="flex gap-2 items-center text-sm">
          <span>سن</span>
          <input className="input !w-20 !py-2" type="number" aria-label="حداقل سن" min={18} value={ageMin} onChange={(e) => setAgeMin(e.target.value ? Number(e.target.value) : '')} />
          <span>تا</span>
          <input className="input !w-20 !py-2" type="number" aria-label="حداکثر سن" min={18} value={ageMax} onChange={(e) => setAgeMax(e.target.value ? Number(e.target.value) : '')} />
        </div>
        {isWoman && <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} /> 👭 فقط خانم‌ها</label>}
        <div>
          <p className="text-xs font-bold mb-1">ترجیحاً با علاقه به…</p>
          <div className="flex flex-wrap gap-1.5">{OUT_HOBBIES.slice(0, 16).map((h) => (
            <button key={h} type="button" aria-pressed={hobbies.includes(h)} onClick={() => setHobbies(hobbies.includes(h) ? hobbies.filter((x) => x !== h) : [...hobbies, h].slice(0, 5))}
              className={`chip !text-[11px] ${hobbies.includes(h) ? 'chip-on' : 'chip-ghost'}`}>{h}</button>))}</div>
        </div>
        <div><label className="label !text-xs" htmlFor="mx">چند نفر؟ {faNum(max)}</label>
          <input id="mx" type="range" min={1} max={6} value={max} onChange={(e) => setMax(Number(e.target.value))} className="w-full accent-[#6C5CE7]" /></div>
      </div>

      <p className="text-[11px] text-muted">به آدم‌های نزدیکی که به این مشخصات می‌خورند خبر می‌دهیم. فقط کسانی که خودت قبول کنی اضافه می‌شوند. روزی حداکثر ۳ دعوت.</p>
      {err && <p className="text-sm text-warn" role="alert">{err}</p>}
      <button className="btn w-full" disabled={busy} onClick={post}>{busy ? '…' : 'بفرست به آدم‌های نزدیک'}</button>
    </div>
  );
}
