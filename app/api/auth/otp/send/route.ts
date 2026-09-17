import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { normalizePhone, sendOtpSms } from '@/lib/sms';
import { hashCode, newCode } from '@/lib/otp';

export async function POST(req: Request) {
  const { phone: raw } = await req.json().catch(() => ({}));
  const phone = normalizePhone(String(raw ?? ''));
  if (!phone) return NextResponse.json({ error: 'شماره معتبر نیست' }, { status: 400 });

  const db = admin();
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: recent } = await db.from('otp_codes').select('created_at').eq('phone', phone).gte('created_at', since).order('created_at', { ascending: false });
  if ((recent?.length ?? 0) >= 3) return NextResponse.json({ error: 'درخواست زیاد بود. ۱۵ دقیقه بعد دوباره امتحان کن.' }, { status: 429 });
  if (recent?.[0] && Date.now() - new Date(recent[0].created_at).getTime() < 60_000)
    return NextResponse.json({ error: 'یک دقیقه صبر کن و دوباره بفرست.' }, { status: 429 });

  const code = newCode();
  await db.from('otp_codes').update({ used: true }).eq('phone', phone).eq('used', false);
  await db.from('otp_codes').insert({ phone, code_hash: hashCode(phone, code), expires_at: new Date(Date.now() + 5 * 60_000).toISOString() });
  if (!(await sendOtpSms(phone, code))) return NextResponse.json({ error: 'ارسال پیامک ناموفق بود' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
