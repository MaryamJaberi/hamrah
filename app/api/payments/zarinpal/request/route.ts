import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { admin } from '@/lib/supabase/admin';
import { appUrl, loadMentor, platformFee, zarinpalBase } from '@/lib/payments';

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { mentorId } = await req.json().catch(() => ({}));
  const mentor = await loadMentor(String(mentorId));
  if (!mentor || mentor.id === user.id || mentor.mentor_currency !== 'irr') return NextResponse.json({ error: 'منتور نامعتبر' }, { status: 400 });

  const db = admin();
  const { data: pay } = await db.from('payments').insert({
    buyer: user.id, seller: mentor.id, provider: 'zarinpal', amount: mentor.mentor_price, // rial
    fee: platformFee(mentor.mentor_price), currency: 'irr', status: 'pending',
  }).select().single();
  if (!pay) return NextResponse.json({ error: 'ثبت پرداخت ناموفق' }, { status: 500 });

  const res = await fetch(`${zarinpalBase()}/pg/v4/payment/request.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      merchant_id: process.env.ZARINPAL_MERCHANT_ID, amount: mentor.mentor_price, currency: 'IRR',
      description: `جلسه منتورشیپ همراه — ${mentor.name}`,
      callback_url: `${appUrl()}/api/payments/zarinpal/verify?pid=${pay.id}`,
    }),
  }).catch(() => null);
  const json = await res?.json().catch(() => null);
  const authority: string | undefined = json?.data?.authority;
  if (!authority || json?.data?.code !== 100) {
    await db.from('payments').update({ status: 'failed' }).eq('id', pay.id);
    return NextResponse.json({ error: 'اتصال به زرین‌پال ناموفق بود' }, { status: 502 });
  }
  await db.from('payments').update({ provider_ref: authority }).eq('id', pay.id);
  return NextResponse.json({ url: `${zarinpalBase()}/pg/StartPay/${authority}` });
}
