import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { admin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const { id, status, resolution } = await req.json().catch(() => ({}));
  if (!id || !['reviewing', 'resolved', 'dismissed'].includes(status)) return NextResponse.json({ error: 'bad input' }, { status: 400 });
  const { error: e } = await admin().from('reports').update({
    status, resolution: resolution ? String(resolution).slice(0, 1000) : null, handled_by: user.id, handled_at: new Date().toISOString(),
  }).eq('id', id);
  return e ? NextResponse.json({ error: e.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
