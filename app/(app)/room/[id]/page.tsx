import { notFound } from 'next/navigation';
import { getSession } from '@/lib/supabase/server';
import { getConnection } from '@/lib/connections';
import RoomClient from './RoomClient';

export default async function Room({ params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getSession();
  const conn = await getConnection(supabase, params.id, user!.id);
  if (!conn) notFound();
  return <RoomClient connId={conn.id} meId={user!.id} meName={profile!.name} other={conn.other} />;
}
