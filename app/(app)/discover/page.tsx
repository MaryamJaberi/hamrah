import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/supabase/server';
import { matchScore } from '@/lib/matching';
import type { Profile } from '@/lib/types';
import DiscoverClient from './DiscoverClient';

export default async function Discover() {
  const { supabase, user, profile: me } = await getSession();
  if (!user || !me) redirect('/onboarding');

  // The 100 newest people come from search_people (two pages of 50, its cap) instead of a
  // plain profiles query: that RPC already leaves out banned users and anyone with a block
  // in EITHER direction, so someone who blocked me no longer shows up here (gap G15).
  const newest = (offset: number) => supabase.rpc('search_people', { p_sort: 'newest', p_limit: 50, p_offset: offset });

  const [{ data: page1 }, { data: page2 }, { data: incoming }, { data: outgoing }, { data: goals }, { data: blocks }, { data: conns }] = await Promise.all([
    newest(0),
    newest(50),
    supabase.from('requests').select('*, from:profiles!requests_from_user_fkey(*)').eq('to_user', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('requests').select('to_user,status').eq('from_user', user.id),
    supabase.from('goals').select('id,title').eq('user_id', user.id),
    supabase.from('blocks').select('blocked_id').eq('user_id', user.id),
    supabase.from('connections').select('user_a,user_b').or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
  ]);

  const hidden = new Set([...(blocks ?? []).map((b) => b.blocked_id), ...(conns ?? []).map((c) => (c.user_a === user.id ? c.user_b : c.user_a))]);
  const seen = new Set<string>();
  const others = [...((page1 ?? []) as Profile[]), ...((page2 ?? []) as Profile[])]
    .filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
  const ranked = others
    .filter((u) => !hidden.has(u.id))
    .map((u) => ({ user: u, score: matchScore(me as Profile, u) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  return (
    <main className="page">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-lg font-extrabold flex-1">کشف همراه</h1>
        <Link href="/search" className="btn btn-sec btn-sm">🔎 جستجو</Link>
        <Link href="/mentors" className="btn btn-sec btn-sm">🎓 منتورها</Link>
      </div>
      <DiscoverClient meName={me.name} ranked={ranked} incoming={incoming ?? []} outgoing={outgoing ?? []} goals={goals ?? []} myInterests={me.interests} />
    </main>
  );
}
