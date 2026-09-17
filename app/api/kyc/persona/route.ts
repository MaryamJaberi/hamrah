import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { appUrl } from '@/lib/payments';

/** Sends the user to Persona's hosted flow; the result arrives via the webhook, keyed by reference-id = user id. */
export async function POST() {
  const { user, error } = await requireUser();
  if (error) return error;
  const template = process.env.PERSONA_TEMPLATE_ID;
  if (!template) return NextResponse.json({ error: 'Persona پیکربندی نشده' }, { status: 501 });
  const params = new URLSearchParams({ 'inquiry-template-id': template, 'reference-id': user.id, 'redirect-uri': `${appUrl()}/verify` });
  return NextResponse.json({ url: `https://inquiry.withpersona.com/verify?${params}` });
}
