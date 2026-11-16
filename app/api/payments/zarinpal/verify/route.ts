import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { appUrl, fulfillPayment, zarinpalBase } from '@/lib/payments';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const authority = url.searchParams.get('Authority');
  const pid = url.searchParams.get('pid');
  const fail = () => NextResponse.redirect(`${appUrl()}/sessions?paid=0`);
  if (!authority || !pid) return fail();

  const db = admin();
  // authority must match the payment we created — prevents replaying another payment's callback
  const { data: pay } = await db.from('payments').select('*').eq('id', pid).eq('provider_ref', authority).maybeSingle();
  if (!pay) return fail();
  if (pay.status === 'paid') return NextResponse.redirect(`${appUrl()}/sessions?paid=1`);
  if (url.searchParams.get('Status') !== 'OK') {
    await db.from('payments').update({ status: 'failed' }).eq('id', pay.id).eq('status', 'pending');
    return fail();
  }

  const res = await fetch(`${zarinpalBase()}/pg/v4/payment/verify.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ merchant_id: process.env.ZARINPAL_MERCHANT_ID, amount: pay.amount, authority }),
  }).catch(() => null);
  const json = await res?.json().catch(() => null);
  const code = json?.data?.code;
  // No answer from Zarinpal (timeout, bad gateway): we do not know the outcome. Leave the payment
  // pending so that reloading the callback can verify it again; marking it failed here would make
  // a later successful verify a no-op while the user has paid.
  // (A real refusal comes back as { data: [], errors: { code: -NN } } and is still marked failed below.)
  if (code === undefined && json?.errors?.code === undefined) return fail();
  if (code === 100 || code === 101) {
    await fulfillPayment(pay.id);
    return NextResponse.redirect(`${appUrl()}/sessions?paid=1`);
  }
  await db.from('payments').update({ status: 'failed' }).eq('id', pay.id).eq('status', 'pending');
  return fail();
}
