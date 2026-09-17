import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';

export async function POST(req: Request) {
  const { supabase, user, error } = await requireUser();
  if (error) return error;
  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint?.startsWith('https://') || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: 'bad subscription' }, { status: 400 });
  const { error: e } = await supabase.from('push_subs').upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: 'user_id,endpoint' });
  return e ? NextResponse.json({ error: e.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
