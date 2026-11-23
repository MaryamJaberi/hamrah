import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/auth'];
// «دورهمی» links are opened by guests from a group chat: no account needed. ('/d' exactly, not '/discover')
const isDorehami = (p: string) => p === '/d' || p.startsWith('/d/');
// pages we may send someone back to after login/onboarding
const isReturnable = (p?: string) => !!p && (p.startsWith('/out/join/') || isDorehami(p));

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

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, req.url));
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!user) {
    if (PUBLIC.some((p) => path.startsWith(p)) || isDorehami(path)) return res;
    if (path === '/') return redirect('/d');
    const r = redirect('/login');
    // remember an invite link so the user lands on it after login/onboarding
    if (path.startsWith('/out/join/') || isDorehami(path)) r.cookies.set('hamrah_next', path, { maxAge: 3600, path: '/', sameSite: 'lax' });
    return r;
  }

  const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', user.id).maybeSingle();
  if (!profile && path !== '/onboarding' && !isDorehami(path)) return redirect('/onboarding');
  if (profile?.is_banned && path !== '/banned') return redirect('/banned');
  const next = req.cookies.get('hamrah_next')?.value;
  if (profile && isReturnable(next) && path !== next) {
    const r = redirect(next!);
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
