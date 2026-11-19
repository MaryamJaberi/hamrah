import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { admin } from '@/lib/supabase/admin';
import { sendToUser } from '@/lib/push';

/**
 * Push notifications for outings. The caller can only trigger pushes about things they own:
 *  - intent:    their own new open invite → nearby people who fit it (once per intent)
 *  - confirmed: a plan they organise was confirmed → its members
 *  - invite:    they invited someone into a plan they're in → that person
 *  - response:  they responded to an intent → its owner
 */
export async function POST(req: Request) {
  const { supabase, user, error } = await requireUser();
  if (error) return error;
  const { kind, id, user: target } = await req.json().catch(() => ({}));
  const db = admin();
  const { data: me } = await supabase.from('profiles').select('name').eq('id', user.id).single();
  const name = me?.name ?? 'یک نفر';

  if (kind === 'intent') {
    const { data: i } = await supabase.from('outing_intents').select('id,user_id,title,notified_at').eq('id', id).maybeSingle();
    if (!i || i.user_id !== user.id) return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (i.notified_at) return NextResponse.json({ ok: true, sent: 0 });
    const { data: ids } = await db.rpc('outing_intent_candidates', { p_intent: id, p_limit: 30 });
    await db.from('outing_intents').update({ notified_at: new Date().toISOString() }).eq('id', id);
    const list = ((ids as string[] | null) ?? []);
    await Promise.allSettled(list.map((uid) => sendToUser(uid, { title: 'یه دعوت نزدیکت 🌆', body: `${name}: ${i.title}`.slice(0, 140), url: `/out/i/${id}` })));
    return NextResponse.json({ ok: true, sent: list.length });
  }

  if (kind === 'confirmed') {
    const { data: p } = await supabase.from('outing_plans').select('id,organizer,title,status').eq('id', id).maybeSingle();
    if (!p || p.organizer !== user.id || p.status !== 'confirmed') return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { data: ms } = await supabase.from('outing_plan_members').select('user_id').eq('plan_id', id).eq('status', 'joined');
    await Promise.allSettled((ms ?? []).filter((m) => m.user_id !== user.id)
      .map((m) => sendToUser(m.user_id, { title: '✅ برنامه قطعی شد', body: p.title, url: `/out/p/${id}` })));
    return NextResponse.json({ ok: true });
  }

  if (kind === 'invite' && typeof target === 'string') {
    const { data: m } = await supabase.from('outing_plan_members').select('status').eq('plan_id', id).eq('user_id', target).maybeSingle();
    const { data: p } = await supabase.from('outing_plans').select('title').eq('id', id).maybeSingle();
    if (!m || m.status !== 'invited' || !p) return NextResponse.json({ error: 'not found' }, { status: 404 });
    await sendToUser(target, { title: 'دعوت به بیرون رفتن 💌', body: `${name} تو را به «${p.title}» دعوت کرد`, url: '/out' });
    return NextResponse.json({ ok: true });
  }

  if (kind === 'response') {
    const { data: r } = await supabase.from('outing_intent_responses').select('intent_id').eq('intent_id', id).eq('user_id', user.id).maybeSingle();
    if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const { data: i } = await db.from('outing_intents').select('user_id,title').eq('id', id).single();
    if (i) await sendToUser(i.user_id, { title: 'یکی پایه‌ست! 🙋‍♀️', body: `${name} برای «${i.title}» اعلام آمادگی کرد`, url: `/out/i/${id}` });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'bad kind' }, { status: 400 });
}
