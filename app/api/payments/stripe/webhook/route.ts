import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { admin } from '@/lib/supabase/admin';
import { fulfillPayment, stripe } from '@/lib/payments';

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig ?? '', process.env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }

  const s = event.data.object as Stripe.Checkout.Session;
  const paymentId = s.metadata?.payment_id;
  if (paymentId) {
    if (event.type === 'checkout.session.completed' && s.payment_status === 'paid') await fulfillPayment(paymentId);
    if (event.type === 'checkout.session.async_payment_succeeded') await fulfillPayment(paymentId);
    if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed')
      await admin().from('payments').update({ status: 'failed' }).eq('id', paymentId).eq('status', 'pending');
  }
  return NextResponse.json({ received: true });
}
