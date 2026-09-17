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

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, req.url));
    res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!user) return PUBLIC.some((p) => path.startsWith(p)) ? res : redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', user.id).maybeSingle();
  if (!profile && path !== '/onboarding') return redirect('/onboarding');
  if (profile?.is_banned && path !== '/banned') return redirect('/banned');
  if (profile && (path === '/onboarding' || path === '/login' || path === '/')) return redirect('/discover');
  return res;
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico|sw.js|manifest.webmanifest|icon.*\\.png).*)'],
};
