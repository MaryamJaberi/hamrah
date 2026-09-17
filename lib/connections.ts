import type { SupabaseClient } from '@supabase/supabase-js';
import type { Connection, Profile } from './types';

export type ConnWithOther = Connection & { other: Profile };

/** All of the user's connections with the other participant's profile attached. */
export async function listConnections(supabase: SupabaseClient, userId: string): Promise<ConnWithOther[]> {
  const { data } = await supabase.from('connections')
    .select('*, a:profiles!connections_user_a_fkey(*), b:profiles!connections_user_b_fkey(*)')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`).eq('status', 'active')
    .order('created_at', { ascending: false });
  return (data ?? []).filter((c: any) => c.a && c.b).map(({ a, b, ...c }: any) => ({ ...c, other: c.user_a === userId ? b : a }));
}

export async function getConnection(supabase: SupabaseClient, id: string, userId: string): Promise<ConnWithOther | null> {
  const { data: c } = await supabase.from('connections')
    .select('*, a:profiles!connections_user_a_fkey(*), b:profiles!connections_user_b_fkey(*)').eq('id', id).maybeSingle();
  if (!c || !c.a || !c.b) return null;
  const { a, b, ...rest } = c as any;
  return { ...rest, other: rest.user_a === userId ? b : a };
}
