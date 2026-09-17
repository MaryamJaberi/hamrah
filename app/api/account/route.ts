import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { admin } from '@/lib/supabase/admin';

/** GET: export my data as JSON. */
export async function GET() {
  const { supabase, user, error } = await requireUser();
  if (error) return error;
  const tables = ['profiles', 'goals', 'requests', 'connections', 'messages', 'sessions', 'reviews', 'reports', 'payments', 'kyc_submissions'];
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), email: user.email, phone: user.phone };
  for (const t of tables) out[t] = (await supabase.from(t).select('*').limit(5000)).data; // RLS limits to rows I can see
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="hamrah-data.json"' } });
}

/** DELETE: remove KYC files, then the auth user (profile and related rows cascade). */
export async function DELETE() {
  const { user, error } = await requireUser();
  if (error) return error;
  const db = admin();
  const { data: files } = await db.storage.from('kyc').list(user.id);
  if (files?.length) await db.storage.from('kyc').remove(files.map((f) => `${user.id}/${f.name}`));
  const { error: e } = await db.auth.admin.deleteUser(user.id);
  return e ? NextResponse.json({ error: e.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
