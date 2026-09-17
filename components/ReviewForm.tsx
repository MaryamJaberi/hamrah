'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { REVIEW_TAGS } from '@/lib/constants';
import StarRating from './StarRating';

export default function ReviewForm({ connectionId, revieweeId, name }: { connectionId: string; revieweeId: string; name: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit() {
    setState('busy'); setErr('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('reviews').insert({ connection_id: connectionId, reviewer: user!.id, reviewee: revieweeId, rating, comment: comment || null, tags });
    if (error) { setErr(error.code === '23505' ? 'قبلاً نظر دادی.' : 'اول باید یک جلسه با هم تمام کنید.'); setState('idle'); return; }
    setState('done'); router.refresh();
  }

  if (state === 'done') return <div className="card text-sm text-center">ممنون! نظرت ثبت شد ✓</div>;
  return (
    <div className="card">
      <p className="font-bold mb-2">تجربه‌ات با {name} چطور بود؟</p>
      <StarRating value={rating} onChange={setRating} />
      <textarea className="input mt-3 text-sm" rows={2} maxLength={1000} placeholder="اختیاری" aria-label="نظر" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex flex-wrap gap-1 mt-2">
        {REVIEW_TAGS.map((t) => (
          <button key={t} aria-pressed={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
            className={`chip text-[11px] ${tags.includes(t) ? 'chip-on' : ''}`}>{t}</button>
        ))}
      </div>
      {err && <p role="alert" className="text-warn text-xs mt-2">{err}</p>}
      <button className="btn w-full mt-3" disabled={state === 'busy'} onClick={submit}>ثبت نظر</button>
    </div>
  );
}
