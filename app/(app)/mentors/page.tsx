import Link from 'next/link';
import { getSession } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/format';
import UserHead from '@/components/UserCard';
import type { Profile } from '@/lib/types';

export default async function Mentors() {
  const { supabase, user } = await getSession();
  const { data } = await supabase.from('profiles').select('*').eq('is_mentor', true).eq('is_banned', false).neq('id', user!.id)
    .order('verified_id', { ascending: false }).order('rating_avg', { ascending: false }).limit(50);
  const mentors = (data ?? []) as Profile[];
  return (
    <main className="page">
      <h1 className="h1">منتورها</h1>
      {mentors.length === 0 && <div className="card text-center text-sm text-muted py-8">هنوز منتوری ثبت نشده. می‌تونی از پروفایلت منتور بشی.</div>}
      {mentors.map((m) => (
        <Link key={m.id} href={`/u/${m.id}`} className="card block mb-3">
          <UserHead u={m} right={<span className="text-sm font-bold text-primary">{formatPrice(m.mentor_price, m.mentor_currency)}</span>} />
          {m.mentor_bio && <p className="text-sm text-[#4a4a5e] mt-2 line-clamp-2">{m.mentor_bio}</p>}
          <div className="flex flex-wrap gap-1 mt-2">{m.mentor_topics.slice(0, 4).map((t) => <span key={t} className="chip text-[11px]">{t}</span>)}</div>
        </Link>
      ))}
    </main>
  );
}
