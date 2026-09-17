import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';

/** E2E only. Disabled unless E2E_TEST_SECRET is set; requires the secret in a header. Never set it in production. */
export async function POST(req: Request) {
  const secret = process.env.E2E_TEST_SECRET;
  if (!secret || req.headers.get('x-e2e-secret') !== secret) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { email } = await req.json();
  if (!/@e2e\.hamrah\.invalid$/.test(email)) return NextResponse.json({ error: 'test emails only' }, { status: 400 });
  const db = admin();
  await db.auth.admin.createUser({ email, email_confirm: true }).catch(() => null);
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token_hash: data.properties.hashed_token });
}
