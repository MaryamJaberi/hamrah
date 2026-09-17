import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from './supabase/server';

/** For route handlers: returns the user or a 401 response. */
export async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) } as const;
  return { supabase, user, error: null } as const;
}

export async function requireAdmin() {
  const r = await requireUser();
  if (r.error) return r;
  const { data } = await r.supabase.from('profiles').select('is_admin').eq('id', r.user.id).single();
  if (!data?.is_admin) return { ...r, error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) } as const;
  return r;
}
