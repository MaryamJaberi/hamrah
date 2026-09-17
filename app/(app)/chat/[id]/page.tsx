import { notFound } from 'next/navigation';
import { getSession } from '@/lib/supabase/server';
import { getConnection } from '@/lib/connections';
import ChatRoom from './ChatRoom';

export default async function ChatPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await getSession();
  const conn = await getConnection(supabase, params.id, user!.id);
  if (!conn) notFound();
  const { data: msgs } = await supabase.from('messages').select('*').eq('connection_id', conn.id).order('created_at', { ascending: true }).limit(500);
  return <ChatRoom connId={conn.id} meId={user!.id} other={conn.other} initial={msgs ?? []} />;
}
