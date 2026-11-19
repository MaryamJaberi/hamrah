import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Landing point for the login link in the email.
 * Handles both link styles Supabase can send: PKCE (?code=) and token hash (?token_hash=&type=).
 * The link must be opened in the same browser where the email was requested (PKCE).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const supabase = createClient();
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = (url.searchParams.get('type') ?? 'email') as 'email' | 'magiclink' | 'signup';
  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  if (!ok) return NextResponse.redirect(new URL('/login?e=link', req.url));
  const next = req.cookies.get('hamrah_next')?.value;
  return NextResponse.redirect(new URL(next?.startsWith('/out/join/') ? next : '/discover', req.url));
}
