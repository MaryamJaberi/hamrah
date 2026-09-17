import { notFound } from 'next/navigation';
import { getSession } from '@/lib/supabase/server';
import { faDate, formatPrice } from '@/lib/format';
import VerifyBadges from '@/components/VerifyBadges';
import SafetyMenu from '@/components/SafetyMenu';
import StarRating from '@/components/StarRating';
import BookMentor from './BookMentor';
import ProfileActions from './ProfileActions';
import type { Profile } from '@/lib/types';

export default async function UserPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await getSession();
  const { data } = await supabase.from('profiles').select('*').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const u = data as Profile;
  const isMe = u.id === user!.id;
  const [{ data: reviews }, { data: mentorConn }, { data: buddyConn }, { data: pending }, { data: goals }] = await Promise.all([
    supabase.from('reviews').select('*, reviewer_profile:profiles!reviews_reviewer_fkey(name,avatar)').eq('reviewee', u.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('connections').select('id').eq('kind', 'mentorship')
      .eq('user_a', user!.id < u.id ? user!.id : u.id).eq('user_b', user!.id < u.id ? u.id : user!.id).maybeSingle(),
    supabase.from('connections').select('id').eq('kind', 'buddy')
      .eq('user_a', user!.id < u.id ? user!.id : u.id).eq('user_b', user!.id < u.id ? u.id : user!.id).maybeSingle(),
    supabase.from('requests').select('id').eq('status', 'pending').or(`and(from_user.eq.${user!.id},to_user.eq.${u.id}),and(from_user.eq.${u.id},to_user.eq.${user!.id})`).limit(1),
    supabase.from('goals').select('id,title').eq('user_id', user!.id),
  ]);

  return (
    <main className="page">
      <div className="card text-center py-6 mb-3">
        <div className="text-6xl mb-2" aria-hidden>{u.avatar}</div>
        <h1 className="text-xl font-extrabold">{u.name}</h1>
        <p className="text-sm text-muted mb-2">{u.rating_count ? `⭐ ${Number(u.rating_avg).toFixed(1)} از ${u.rating_count.toLocaleString('fa-IR')} نظر` : 'هنوز نظری ندارد'} · {u.city}</p>
        <VerifyBadges p={u} />
      </div>

      {!isMe && <div className="mb-3"><ProfileActions to={u} connId={buddyConn?.id ?? null} pending={(pending ?? []).length > 0} goals={goals ?? []} /></div>}
      {u.bio && <div className="card mb-3 text-sm">{u.bio}</div>}
      <div className="card mb-3">
        <p className="text-sm font-bold mb-2">علاقه‌ها</p>
        <div className="flex flex-wrap gap-1">{u.interests.map((i) => <span key={i} className="chip text-[11px]">{i}</span>)}</div>
        {u.teach_langs.length > 0 && <p className="text-xs text-muted mt-3">یاد می‌دهد: {u.teach_langs.join('، ')}</p>}
        {u.learn_langs.length > 0 && <p className="text-xs text-muted">یاد می‌گیرد: {u.learn_langs.join('، ')}</p>}
      </div>

      {u.is_mentor && (
        <div className="card mb-3">
          <div className="flex items-center mb-2"><p className="text-sm font-bold flex-1">منتورشیپ</p><span className="font-bold text-primary">{formatPrice(u.mentor_price, u.mentor_currency)} / جلسه</span></div>
          {u.mentor_bio && <p className="text-sm text-[#4a4a5e] mb-2">{u.mentor_bio}</p>}
          <div className="flex flex-wrap gap-1 mb-3">{u.mentor_topics.map((t) => <span key={t} className="chip text-[11px]">{t}</span>)}</div>
          {!isMe && <BookMentor mentor={u} existingConnId={mentorConn?.id ?? null} />}
        </div>
      )}

      <div className="card mb-3">
        <p className="text-sm font-bold mb-2">نظرها</p>
        {(reviews ?? []).length === 0 && <p className="text-sm text-muted">هنوز نظری ثبت نشده.</p>}
        {(reviews ?? []).map((r: any) => (
          <div key={r.id} className="border-b border-line last:border-0 py-2">
            <div className="flex items-center gap-2 text-sm">
              <span aria-hidden>{r.reviewer_profile?.avatar}</span><span className="font-bold flex-1">{r.reviewer_profile?.name}</span>
              <span className="text-amber-500 text-xs" aria-label={`${r.rating} ستاره`}>{'★'.repeat(r.rating)}</span>
            </div>
            {r.comment && <p className="text-xs text-[#4a4a5e] mt-1">{r.comment}</p>}
            <div className="flex flex-wrap gap-1 mt-1">{r.tags.map((t: string) => <span key={t} className="chip chip-ghost text-[10px]">{t}</span>)}</div>
            <p className="text-[10px] text-muted mt-1">{faDate(r.created_at)}</p>
          </div>
        ))}
      </div>

      {!isMe && <div className="text-center"><SafetyMenu userId={u.id} name={u.name} /></div>}
    </main>
  );
}
