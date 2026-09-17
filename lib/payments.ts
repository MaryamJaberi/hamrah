import 'server-only';
import Stripe from 'stripe';
import { admin } from './supabase/admin';

let stripeClient: Stripe | null = null;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY missing');
  return (stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

export const zarinpalBase = () =>
  process.env.ZARINPAL_SANDBOX === 'true' ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';

export const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export function platformFee(amount: number) {
  return Math.round((amount * Number(process.env.PLATFORM_FEE_PERCENT ?? 15)) / 100);
}

/** Price always comes from the database, never from the client. */
export async function loadMentor(mentorId: string) {
  const { data } = await admin().from('profiles')
    .select('id,name,is_mentor,mentor_price,mentor_currency,is_banned').eq('id', mentorId).single();
  if (!data || !data.is_mentor || data.is_banned || data.mentor_price <= 0) return null;
  return data;
}

/** Marks a payment paid (idempotent) and opens the mentorship connection. */
export async function fulfillPayment(paymentId: string) {
  const db = admin();
  const { data: pay } = await db.from('payments').update({ status: 'paid' })
    .eq('id', paymentId).eq('status', 'pending').select().maybeSingle();
  if (!pay) return null; // already handled
  const a = pay.buyer < pay.seller ? pay.buyer : pay.seller;
  const b = pay.buyer < pay.seller ? pay.seller : pay.buyer;
  const { data: conn } = await db.from('connections')
    .upsert({ user_a: a, user_b: b, kind: 'mentorship', status: 'active' }, { onConflict: 'user_a,user_b,kind' })
    .select().single();
  if (conn) {
    await db.from('payments').update({ connection_id: conn.id }).eq('id', pay.id);
    await db.from('messages').insert({ connection_id: conn.id, sender: pay.buyer, body: 'جلسه منتورشیپ رزرو و پرداخت شد ✅' });
  }
  return conn;
}
