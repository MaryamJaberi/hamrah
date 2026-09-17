import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { sendToUser } from '@/lib/push';

/** The caller can only trigger a push about a request/message they themselves created (checked through RLS). */
export async function POST(req: Request) {
  const { supabase, user, error } = await requireUser();
  if (error) return error;
  const { kind, id } = await req.json().catch(() => ({}));

  if (kind === 'request') {
    const { data: r } = await supabase.from('requests').select('to_user,from_user,message').eq('id', id).maybeSingle();
    if (!r || r.from_user !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { data: me } = await supabase.from('profiles').select('name').eq('id', user.id).single();
    await sendToUser(r.to_user, { title: 'درخواست همراهی جدید', body: `${me?.name ?? 'یک نفر'}: ${r.message ?? ''}`.slice(0, 140), url: '/discover' });
  } else if (kind === 'message') {
    const { data: m } = await supabase.from('messages').select('sender,body,connection_id, connections(user_a,user_b)').eq('id', id).maybeSingle();
    const c = (m as any)?.connections;
    if (!m || m.sender !== user.id || !c) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { data: me } = await supabase.from('profiles').select('name').eq('id', user.id).single();
    await sendToUser(c.user_a === user.id ? c.user_b : c.user_a, { title: me?.name ?? 'پیام جدید', body: m.body.slice(0, 140), url: `/chat/${m.connection_id}` });
  } else {
    return NextResponse.json({ error: 'bad kind' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
