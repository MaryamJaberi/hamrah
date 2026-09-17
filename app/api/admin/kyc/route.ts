import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { admin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;
  const { id, approve, reason } = await req.json().catch(() => ({}));
  if (!id || typeof approve !== 'boolean') return NextResponse.json({ error: 'bad input' }, { status: 400 });
  const { error: e } = await admin().from('kyc_submissions').update({
    status: approve ? 'approved' : 'rejected', reject_reason: approve ? null : String(reason ?? '').slice(0, 300) || null,
    reviewed_by: user.id, reviewed_at: new Date().toISOString(),
  }).eq('id', id);
  return e ? NextResponse.json({ error: e.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
