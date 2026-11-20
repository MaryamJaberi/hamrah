import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { admin } from '@/lib/supabase/admin';

function validSignature(header: string | null, raw: string, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.trim().split('=') as [string, string]));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false; // replay window
  const expected = createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex');
  return expected.length === parts.v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.PERSONA_WEBHOOK_SECRET;
  if (!secret || !validSignature(req.headers.get('persona-signature'), raw, secret)) return NextResponse.json({ error: 'bad signature' }, { status: 401 });

  const inquiry = JSON.parse(raw)?.data?.attributes?.payload?.data;
  const userId: string | undefined = inquiry?.attributes?.['reference-id'];
  const inquiryId: string | undefined = inquiry?.id;
  if (!userId || !inquiryId) return NextResponse.json({ ok: true });

  const s = String(inquiry.attributes.status ?? '');
  const status = s === 'approved' ? 'approved' : ['declined', 'failed', 'expired'].includes(s) ? 'rejected' : 'pending';
  await admin().from('kyc_submissions').upsert(
    { user_id: userId, kind: 'persona', persona_inquiry_id: inquiryId, status, reviewed_at: status === 'pending' ? null : new Date().toISOString() },
    // Webhooks can arrive out of order: a late "pending" event must not overwrite a final decision.
    { onConflict: 'persona_inquiry_id', ignoreDuplicates: status === 'pending' });
  return NextResponse.json({ ok: true });
}
