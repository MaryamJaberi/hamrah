'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AVATARS, INTERESTS, LANGS, MODES } from '@/lib/constants';
import type { Currency, Profile } from '@/lib/types';

const toMinor = (major: string, c: Currency) => Math.round(Number(major || 0) * (c === 'irr' ? 10 : 100)); // toman→rial, $→cents
const toMajor = (minor: number, c: Currency) => String(minor / (c === 'irr' ? 10 : 100));

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [p, setP] = useState(profile);
  const [price, setPrice] = useState(toMajor(profile.mentor_price, profile.mentor_currency));
  const [topics, setTopics] = useState(profile.mentor_topics.join('، '));
  const [status, setStatus] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const tog = (k: 'interests' | 'teach_langs' | 'learn_langs', v: string) =>
    setP((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  async function save() {
    setStatus('…');
    const { error } = await supabase.from('profiles').update({
      name: p.name.trim(), avatar: p.avatar, city: p.city.trim(), bio: p.bio?.trim() || null,
      interests: p.interests, teach_langs: p.teach_langs, learn_langs: p.learn_langs, mode: p.mode,
      is_mentor: p.is_mentor, mentor_currency: p.mentor_currency, mentor_price: toMinor(price, p.mentor_currency),
      mentor_bio: p.mentor_bio?.trim() || null, mentor_topics: topics.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
    }).eq('id', p.id);
    setStatus(error ? 'ذخیره نشد، دوباره امتحان کن' : 'ذخیره شد ✓');
    router.refresh();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  async function deleteAccount() {
    if (!confirm('حساب و همه داده‌هایت برای همیشه حذف شود؟')) return;
    const res = await fetch('/api/account', { method: 'DELETE' });
    if (res.ok) { await supabase.auth.signOut(); window.location.href = '/login'; }
  }

  async function exportData() {
    const res = await fetch('/api/account');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'hamrah-data.json'; a.click();
  }

  return (
    <>
      <div className="card mb-3 space-y-3">
        <p className="font-bold">ویرایش پروفایل</p>
        <div className="flex flex-wrap gap-2">{AVATARS.map((a) => (
          <button key={a} aria-pressed={p.avatar === a} onClick={() => setP({ ...p, avatar: a })} className={`chip text-lg ${p.avatar === a ? 'ring-2 ring-primary' : ''}`}>{a}</button>
        ))}</div>
        <div><label className="label" htmlFor="pf-name">اسم</label><input id="pf-name" className="input" maxLength={60} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
        <div><label className="label" htmlFor="pf-city">شهر</label><input id="pf-city" className="input" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} /></div>
        <div><label className="label" htmlFor="pf-bio">درباره من</label><textarea id="pf-bio" className="input" rows={2} maxLength={500} value={p.bio ?? ''} onChange={(e) => setP({ ...p, bio: e.target.value })} /></div>
        <div><p className="label">علاقه‌ها</p><div className="flex flex-wrap gap-1">{INTERESTS.map((i) => (
          <button key={i} aria-pressed={p.interests.includes(i)} onClick={() => tog('interests', i)} className={`chip text-[11px] ${p.interests.includes(i) ? 'chip-on' : ''}`}>{i}</button>))}</div></div>
        {(['teach_langs', 'learn_langs'] as const).map((k) => (
          <div key={k}><p className="label">{k === 'teach_langs' ? 'یاد می‌دهم' : 'یاد می‌گیرم'}</p><div className="flex flex-wrap gap-1">{LANGS.map((l) => (
            <button key={l} aria-pressed={p[k].includes(l)} onClick={() => tog(k, l)} className={`chip text-[11px] ${p[k].includes(l) ? 'chip-on' : ''}`}>{l}</button>))}</div></div>
        ))}
        <div className="flex gap-2">{MODES.map(([k, l]) => (
          <button key={k} aria-pressed={p.mode === k} onClick={() => setP({ ...p, mode: k })} className={`chip flex-1 justify-center py-2 ${p.mode === k ? 'chip-on' : ''}`}>{l}</button>))}</div>
      </div>

      <div className="card mb-3 space-y-3">
        <label className="flex items-center gap-2"><input type="checkbox" checked={p.is_mentor} onChange={(e) => setP({ ...p, is_mentor: e.target.checked })} /><span className="font-bold text-sm">منتور هستم</span></label>
        {p.is_mentor && (
          <>
            <div className="flex gap-2">
              <div className="flex-1"><label className="label" htmlFor="pf-price">قیمت هر جلسه ({p.mentor_currency === 'irr' ? 'تومان' : p.mentor_currency === 'eur' ? 'یورو' : 'دلار'})</label>
                <input id="pf-price" className="input" dir="ltr" inputMode="decimal" placeholder="0 = رایگان" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} /></div>
              <div><label className="label" htmlFor="pf-cur">واحد</label>
                <select id="pf-cur" className="input" value={p.mentor_currency} onChange={(e) => setP({ ...p, mentor_currency: e.target.value as Currency })}>
                  <option value="usd">USD</option><option value="eur">EUR</option><option value="irr">تومان</option>
                </select></div>
            </div>
            <p className="text-[11px] text-muted">دلار/یورو با Stripe و تومان با زرین‌پال پرداخت می‌شود.</p>
            <div><label className="label" htmlFor="pf-mbio">معرفی منتور</label><textarea id="pf-mbio" className="input" rows={3} value={p.mentor_bio ?? ''} onChange={(e) => setP({ ...p, mentor_bio: e.target.value })} /></div>
            <div><label className="label" htmlFor="pf-topics">موضوعات (با ویرگول)</label><input id="pf-topics" className="input" value={topics} onChange={(e) => setTopics(e.target.value)} /></div>
          </>
        )}
      </div>

      <button className="btn w-full mb-2" onClick={save}>ذخیره</button>
      {status && <p role="status" className="text-center text-sm mb-3">{status}</p>}

      <div className="card space-y-2">
        <button className="btn btn-sec w-full" onClick={exportData}>دریافت خروجی داده‌هایم</button>
        <button className="btn btn-sec w-full" onClick={logout}>خروج</button>
        <button className="btn btn-danger w-full" onClick={deleteAccount}>حذف حساب</button>
      </div>
    </>
  );
}
