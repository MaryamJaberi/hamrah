import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import { matchScore } from '@/lib/matching';
import type { Profile } from '@/lib/types';
import DiscoverClient from './DiscoverClient';

export default async function Discover() {
  const { supabase, user, profile: me } = await getSession();
  if (!user || !me) redirect('/onboarding');

  const [{ data: others }, { data: incoming }, { data: outgoing }, { data: goals }, { data: blocks }, { data: conns }] = await Promise.all([
    supabase.from('profiles').select('*').neq('id', user.id).eq('is_banned', false).order('created_at', { ascending: false }).limit(100),
    supabase.from('requests').select('*, from:profiles!requests_from_user_fkey(*)').eq('to_user', user.id).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('requests').select('to_user,status').eq('from_user', user.id),
    supabase.from('goals').select('id,title').eq('user_id', user.id),
    admin().from('blocks').select('user_id,blocked_id').or(`user_id.eq.${user.id},blocked_id.eq.${user.id}`),
    supabase.from('connections').select('user_a,user_b').or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
  ]);

  const blockedIds = new Set((blocks ?? []).map((b) => (b.user_id === user.id ? b.blocked_id : b.user_id)));
  const hidden = new Set([...blockedIds, ...(conns ?? []).map((c) => (c.user_a === user.id ? c.user_b : c.user_a))]);
  const visibleIncoming = (incoming ?? []).filter((r) => !blockedIds.has(r.from_user));
  const ranked = ((others ?? []) as Profile[])
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
      <DiscoverClient meName={me.name} ranked={ranked} incoming={visibleIncoming} outgoing={outgoing ?? []} goals={goals ?? []} myInterests={me.interests} />
    </main>
  );
}
