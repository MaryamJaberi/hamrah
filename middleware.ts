import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/auth'];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const path = req.nextUrl.pathname;
  // an email login link that landed on the wrong page (e.g. the Site URL root) → finish it at /auth/callback
  if ((req.nextUrl.searchParams.has('code') || req.nextUrl.searchParams.has('token_hash')) && path !== '/auth/callback' && path !== '/auth/confirm' && !path.startsWith('/api')) {
    const u = new URL('/auth/callback', req.url);
    req.nextUrl.searchParams.forEach((v, k) => u.searchParams.set(k, v));
    return NextResponse.redirect(u);
  }
  const { data: { user } } = await supabase.auth.getUser();
  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, req.url));
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!user) {
    if (PUBLIC.some((p) => path.startsWith(p))) return res;
    const r = redirect('/login');
    // remember an invite link so the user lands on it after login/onboarding
    if (path.startsWith('/out/join/')) r.cookies.set('hamrah_next', path, { maxAge: 3600, path: '/', sameSite: 'lax' });
    return r;
  }

  const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', user.id).maybeSingle();
  if (!profile && path !== '/onboarding') return redirect('/onboarding');
  if (profile?.is_banned && path !== '/banned') return redirect('/banned');
  const next = req.cookies.get('hamrah_next')?.value;
  if (profile && next?.startsWith('/out/join/') && path !== next) {
    const r = redirect(next);
    r.cookies.delete('hamrah_next');
    return r;
  }
  if (next && path === next) res.cookies.delete('hamrah_next');
  if (profile && (path === '/onboarding' || path === '/login' || path === '/')) return redirect('/discover');
  return res;
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico|sw.js|manifest.webmanifest|icon.*\\.png).*)'],
};
