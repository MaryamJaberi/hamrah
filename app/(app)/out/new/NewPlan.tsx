'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AreaPicker, { type Area } from '@/components/AreaPicker';
import { ACTIVITY_NAMES, activityIcon, errText, faNum } from '@/lib/outings';

function nextAt(dayOffset: number, hour: number) {
  const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
}

export default function NewPlan({ isWoman, area: a0 }: { isWoman: boolean; area: Area }) {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [acts, setActs] = useState<string[]>(['قهوه']);
  const [slots, setSlots] = useState<string[]>([nextAt(2, 15), nextAt(3, 19)]);
  const [area, setArea] = useState<Area>(a0);
  const [womenOnly, setWomenOnly] = useState(isWoman);
  const [max, setMax] = useState(8);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function create() {
    setBusy(true); setErr('');
    const valid = slots.filter(Boolean).map((s) => new Date(s)).filter((d) => d.getTime() > Date.now());
    const { data, error } = await supabase.rpc('create_outing_plan', {
      p_title: title.trim(), p_note: note, p_activities: acts, p_area_label: area.label || null,
      p_lat: area.lat, p_lng: area.lng, p_women_only: womenOnly, p_max: max, p_slots: valid.map((d) => d.toISOString()),
    });
    setBusy(false);
    if (error) { setErr(errText(error.message)); return; }
    router.push(`/out/p/${data}?new=1`);
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div><label className="label" htmlFor="t">اسم برنامه</label>
          <input id="t" className="input" maxLength={80} placeholder="مثلاً: دورهمی دخترای هلند" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="label" htmlFor="n">توضیح (اختیاری)</label>
          <textarea id="n" className="input" rows={2} maxLength={500} placeholder="هر کی خواست دوستش رو هم بیاره…" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>

      <div className="card">
        <p className="label">چه کارهایی می‌شه کرد؟ (بقیه رأی می‌دن)</p>
        <div className="flex flex-wrap gap-1.5">{ACTIVITY_NAMES.map((a) => (
          <button key={a} type="button" aria-pressed={acts.includes(a)} onClick={() => setActs(acts.includes(a) ? acts.filter((x) => x !== a) : [...acts, a].slice(0, 8))}
            className={`chip ${acts.includes(a) ? 'chip-on' : ''}`}>{activityIcon(a)} {a}</button>))}</div>
      </div>

      <div className="card">
        <p className="label">چند تا وقت پیشنهادی (هر کسی می‌گه کدوم براش جور است)</p>
        <div className="space-y-2">
          {slots.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input type="datetime-local" className="input !py-2" aria-label={`وقت ${i + 1}`} value={s} dir="ltr"
                onChange={(e) => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="btn btn-danger btn-sm" aria-label="حذف وقت" onClick={() => setSlots(slots.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        {slots.length < 12 && <button type="button" className="btn btn-sec btn-sm mt-2" onClick={() => setSlots([...slots, nextAt(slots.length + 2, 18)])}>＋ وقت دیگر</button>}
        <p className="text-[11px] text-muted mt-2">بعداً هم بقیه می‌توانند وقت اضافه کنند.</p>
      </div>

      <div className="card">
        <label className="label" htmlFor="area">کدوم طرف‌ها؟</label>
        <AreaPicker value={area} onChange={setArea} />
        <p className="text-[11px] text-muted mt-2">اگر خالی بماند، وسطِ محدودهٔ همه‌ی اعضا را حساب می‌کنیم.</p>
      </div>

      <div className="card space-y-3">
        {isWoman ? (
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} /> 👭 فقط خانم‌ها</label>
        ) : <p className="text-[11px] text-muted">برای گزینهٔ «فقط خانم‌ها»، در پروفایل بیرون‌رفتن «زن» را انتخاب کن.</p>}
        <div><label className="label !text-xs" htmlFor="max">حداکثر چند نفر؟ {faNum(max)}</label>
          <input id="max" type="range" min={2} max={30} value={max} onChange={(e) => setMax(Number(e.target.value))} className="w-full accent-[#6C5CE7]" /></div>
      </div>

      {err && <p className="text-sm text-warn" role="alert">{err}</p>}
      <button className="btn w-full" disabled={busy || !title.trim() || acts.length === 0} onClick={create}>{busy ? '…' : 'ساخت و گرفتن لینک دعوت'}</button>
    </div>
  );
}
