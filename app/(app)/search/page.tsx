'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { INTERESTS, LANGS } from '@/lib/constants';
import UserHead from '@/components/UserCard';
import type { Profile } from '@/lib/types';

export default function Search() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [mode, setMode] = useState<'' | 'online' | 'inperson'>('');
  const [interests, setInterests] = useState<string[]>([]);
  const [teach, setTeach] = useState<string[]>([]);
  const [learn, setLearn] = useState<string[]>([]);
  const [verified, setVerified] = useState(false);
  const [mentors, setMentors] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<'relevance' | 'rating' | 'newest'>('relevance');
  const [results, setResults] = useState<Profile[] | null>(null);
  const [loading, setLoading] = useState(false);

  const tog = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    const { data } = await createClient().rpc('search_people', {
      p_q: q.trim() || null, p_city: city.trim() || null, p_mode: mode || null,
      p_interests: interests.length ? interests : null, p_teach: teach.length ? teach : null, p_learn: learn.length ? learn : null,
      p_only_verified: verified, p_only_mentors: mentors, p_min_rating: minRating || null, p_sort: sort,
    });
    setResults((data ?? []) as Profile[]);
    setLoading(false);
  }

  const chipGroup = (items: string[], sel: string[], set: (v: string[]) => void) => (
    <div className="flex flex-wrap gap-1 mb-3">{items.map((i) => (
      <button type="button" key={i} aria-pressed={sel.includes(i)} onClick={() => tog(sel, set, i)} className={`chip text-[11px] ${sel.includes(i) ? 'chip-on' : ''}`}>{i}</button>
    ))}</div>
  );

  return (
    <main className="page">
      <h1 className="h1">جستجو</h1>
      <form onSubmit={run} className="card mb-3 space-y-3">
        <input className="input" type="search" aria-label="عبارت جستجو" placeholder="نام، بیو، مهارت…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="input" aria-label="شهر" placeholder="شهر (خالی = همه)" value={city} onChange={(e) => setCity(e.target.value)} />
        <div className="flex gap-2">
          {([['', 'همه'], ['online', 'آنلاین'], ['inperson', 'حضوری']] as const).map(([k, l]) => (
            <button type="button" key={k || 'all'} aria-pressed={mode === k} onClick={() => setMode(k)} className={`chip flex-1 justify-center py-2 ${mode === k ? 'chip-on' : ''}`}>{l}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> فقط هویت‌تأییدشده‌ها</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mentors} onChange={(e) => setMentors(e.target.checked)} /> فقط منتورها</label>
        <div className="flex items-center gap-1 text-sm flex-wrap"><span className="me-1">حداقل امتیاز:</span>
          {[0, 3, 4, 4.5].map((r) => <button type="button" key={r} aria-pressed={minRating === r} onClick={() => setMinRating(r)} className={`chip text-[11px] ${minRating === r ? 'chip-on' : ''}`}>{r ? `${r}+` : 'همه'}</button>)}
        </div>
        <details>
          <summary className="text-sm font-bold cursor-pointer">فیلترهای بیشتر</summary>
          <p className="text-xs font-bold mt-3 mb-1">علاقه‌ها</p>{chipGroup(INTERESTS, interests, setInterests)}
          <p className="text-xs font-bold mb-1">می‌تواند یاد بدهد</p>{chipGroup(LANGS, teach, setTeach)}
          <p className="text-xs font-bold mb-1">می‌خواهد یاد بگیرد</p>{chipGroup(LANGS, learn, setLearn)}
        </details>
        <div className="flex gap-2">
          {([['relevance', 'مرتبط‌ترین'], ['rating', 'بالاترین امتیاز'], ['newest', 'جدیدترین']] as const).map(([k, l]) => (
            <button type="button" key={k} aria-pressed={sort === k} onClick={() => setSort(k)} className={`chip flex-1 justify-center text-[11px] ${sort === k ? 'chip-on' : ''}`}>{l}</button>
          ))}
        </div>
        <button className="btn w-full" type="submit" disabled={loading}>{loading ? 'در حال جستجو…' : '🔎 جستجو'}</button>
      </form>

      {results?.length === 0 && <p className="text-center text-muted py-6 text-sm">نتیجه‌ای پیدا نشد. فیلترها را کمتر کن.</p>}
      {results?.map((u) => (
        <Link key={u.id} href={`/u/${u.id}`} className="card block mb-2" data-testid="search-result">
          <UserHead u={u} />
          <div className="flex flex-wrap gap-1 mt-2">{u.interests.slice(0, 4).map((i) => <span key={i} className="chip text-[10px]">{i}</span>)}</div>
        </Link>
      ))}
    </main>
  );
}
