'use client';
import { useState } from 'react';
import { roundLoc } from '@/lib/outings';

export type Area = { label: string; lat: number | null; lng: number | null };

/** Choose a neighbourhood: free-text search (Photon, OpenStreetMap — free, no key) or "use my location". Stored rounded to ~1 km. */
export default function AreaPicker({ value, onChange, id = 'area' }: { value: Area; onChange: (a: Area) => void; id?: string }) {
  const [q, setQ] = useState(value.label);
  const [hits, setHits] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function search() {
    if (q.trim().length < 2) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch(`https://photon.komoot.io/api/?limit=6&lang=en&q=${encodeURIComponent(q.trim())}`);
      const j = await r.json();
      setHits((j.features ?? []).map((f: any) => {
        const p = f.properties ?? {};
        const label = [p.name, p.district || p.suburb, p.city, p.country].filter(Boolean).filter((x: string, i: number, a: string[]) => a.indexOf(x) === i).join('، ');
        return { label, lat: roundLoc(f.geometry.coordinates[1]), lng: roundLoc(f.geometry.coordinates[0]) };
      }));
    } catch { setErr('جستجو کار نکرد؛ اسم شهر را بنویس و ادامه بده.'); }
    setBusy(false);
  }

  function here() {
    if (!navigator.geolocation) { setErr('مرورگرت موقعیت نمی‌دهد.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const a = { label: q.trim() || 'نزدیک من', lat: roundLoc(pos.coords.latitude), lng: roundLoc(pos.coords.longitude) };
        onChange(a); setBusy(false);
      },
      () => { setErr('اجازهٔ موقعیت داده نشد.'); setBusy(false); },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input id={id} className="input" placeholder="مثلاً: Rotterdam Centrum" value={q}
          onChange={(e) => { setQ(e.target.value); onChange({ label: e.target.value, lat: value.lat, lng: value.lng }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} />
        <button type="button" className="btn btn-sec btn-sm shrink-0" onClick={search} disabled={busy}>جستجو</button>
      </div>
      <button type="button" className="text-xs text-primary font-bold mt-2" onClick={here} disabled={busy}>📍 از موقعیت فعلی‌ام (تقریبی، حدود ۱ کیلومتر)</button>
      {hits.length > 0 && (
        <ul className="mt-2 space-y-1" aria-label="نتیجه‌های جستجو">
          {hits.map((h) => (
            <li key={h.label + h.lat}>
              <button type="button" className="w-full text-right text-sm px-3 py-2 rounded-xl bg-[#F4F4FA] hover:bg-primary-soft"
                onClick={() => { onChange(h); setQ(h.label); setHits([]); }}>{h.label}</button>
            </li>
          ))}
        </ul>
      )}
      {value.lat != null && <p className="text-[11px] text-accent mt-1">✓ محدوده ثبت شد (دقیق نیست، فقط تقریبی)</p>}
      {err && <p className="text-xs text-warn mt-1" role="alert">{err}</p>}
    </div>
  );
}
