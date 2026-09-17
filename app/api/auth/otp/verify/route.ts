import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/sms';
import { hashCode, phoneEmail, sameHash } from '@/lib/otp';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(String(body.phone ?? ''));
  const code = String(body.code ?? '');
  if (!phone || !/^\d{6}$/.test(code)) return NextResponse.json({ error: 'ورودی نامعتبر' }, { status: 400 });

  const db = admin();
  const { data: rec } = await db.from('otp_codes').select('*').eq('phone', phone).eq('used', false)
    .gte('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!rec) return NextResponse.json({ error: 'کد منقضی شده، دوباره بفرست' }, { status: 400 });
  if (rec.attempts >= 5) {
    await db.from('otp_codes').update({ used: true }).eq('id', rec.id);
    return NextResponse.json({ error: 'تلاش‌ها بیش از حد بود، دوباره کد بگیر' }, { status: 429 });
  }
  if (!sameHash(rec.code_hash, hashCode(phone, code))) {
    await db.from('otp_codes').update({ attempts: rec.attempts + 1 }).eq('id', rec.id);
    return NextResponse.json({ error: 'کد اشتباه است' }, { status: 400 });
  }
  await db.from('otp_codes').update({ used: true }).eq('id', rec.id);

  const email = phoneEmail(phone);
  const created = await db.auth.admin.createUser({ email, email_confirm: true, phone, phone_confirm: true });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    return NextResponse.json({ error: 'ساخت حساب ناموفق بود' }, { status: 500 });
  }
  const { data: link, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !link.properties?.hashed_token) return NextResponse.json({ error: 'ورود ناموفق بود' }, { status: 500 });

  if (link.user) await db.from('profiles').update({ verified_phone: true }).eq('id', link.user.id);
  // Client exchanges this one-time hash for a session with supabase.auth.verifyOtp({ token_hash, type: 'email' }).
  return NextResponse.json({ token_hash: link.properties.hashed_token });
}
