import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { admin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const { userId, banned } = await req.json().catch(() => ({}));
  if (!userId || typeof banned !== 'boolean' || userId === user.id) return NextResponse.json({ error: 'bad input' }, { status: 400 });
  const { error: e } = await admin().from('profiles').update({ is_banned: banned }).eq('id', userId);
  return e ? NextResponse.json({ error: e.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
