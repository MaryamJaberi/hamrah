import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { admin } from '@/lib/supabase/admin';
import { appUrl, loadMentor, platformFee, stripe } from '@/lib/payments';

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { mentorId } = await req.json().catch(() => ({}));
  const mentor = await loadMentor(String(mentorId));
  if (!mentor || mentor.id === user.id || mentor.mentor_currency === 'irr') return NextResponse.json({ error: 'منتور نامعتبر' }, { status: 400 });

  const db = admin();
  const { data: pay, error: e } = await db.from('payments').insert({
    buyer: user.id, seller: mentor.id, provider: 'stripe', amount: mentor.mentor_price,
    fee: platformFee(mentor.mentor_price), currency: mentor.mentor_currency, status: 'pending',
  }).select().single();
  if (e || !pay) return NextResponse.json({ error: 'ثبت پرداخت ناموفق' }, { status: 500 });

  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: mentor.mentor_currency, unit_amount: mentor.mentor_price, product_data: { name: `Hamrah mentorship session — ${mentor.name}` } } }],
      client_reference_id: pay.id,
      metadata: { payment_id: pay.id },
      success_url: `${appUrl()}/sessions?paid=1`,
      cancel_url: `${appUrl()}/u/${mentor.id}`,
    });
    await db.from('payments').update({ provider_ref: session.id }).eq('id', pay.id);
    return NextResponse.json({ url: session.url });
  } catch {
    await db.from('payments').update({ status: 'failed' }).eq('id', pay.id);
    return NextResponse.json({ error: 'اتصال به Stripe ناموفق بود' }, { status: 502 });
  }
}
