import type { Metadata } from 'next';
import { getSession } from '@/lib/supabase/server';
import { buildPrefill } from '@/lib/dorehami/prefill';
import DorehamiClient from '../DorehamiClient';

export const dynamic = 'force-dynamic';

// «دورهمی» is public: guests answer without an account; members get their profile pre-filled.
export async function generateMetadata({ params }: { params: { slug?: string[] } }): Promise<Metadata> {
  const code = params.slug?.[0];
  const base = { description: 'فرم کوتاه دورهمی: بهترین جا و ساعت برای همه پیدا می‌شود. هر چیزی را خواستی خصوصی نگه دار.' };
  if (!code) return { title: 'دورهمی · همراه', ...base };
  try {
    const { supabase } = await getSession();
    const { data } = await supabase.rpc('dh_get', { p_code: code, p_admin: null });
    const title = (data as { title?: string } | null)?.title;
    if (title) return { title: `${title} · دورهمی`, ...base, openGraph: { title: `${title} 🌿`, ...base } };
  } catch { /* fall through */ }
  return { title: 'دورهمی · همراه', ...base };
}

export default async function DorehamiPage() {
  const { supabase, user, profile } = await getSession();
  let me: { id: string; name: string } | null = null;
  let prefill: ReturnType<typeof buildPrefill> = null;
  if (user && profile && !profile.is_banned) {
    me = { id: user.id, name: profile.name ?? '' };
    const [{ data: op }, { data: ls }] = await Promise.all([
      supabase.from('outing_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('outing_lifestyle').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    prefill = buildPrefill(profile.name, op, ls);
  }
  return <DorehamiClient user={me} prefill={prefill} />;
}
