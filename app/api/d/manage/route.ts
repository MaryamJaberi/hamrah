import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { getSession } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, admin_token, action } = body;
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'کد نامعتبر است' }, { status: 400 });
    }

    const cleanCode = code.toLowerCase().trim();
    const db = admin();
    const session = await getSession();
    const userId = session?.user?.id;

    const { data: m, error: mErr } = await db
      .from('dh_meetups')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();

    if (mErr || !m) {
      return NextResponse.json({ error: 'دورهمی پیدا نشد' }, { status: 404 });
    }

    const isAdmin =
      (admin_token && admin_token === m.admin_token) ||
      (userId && userId === m.organizer_id);

    if (!isAdmin) {
      return NextResponse.json({ error: 'دسترسی مدیریت ندارید' }, { status: 403 });
    }

    // 1. DELETE
    if (action === 'delete') {
      const { error: delErr } = await db.from('dh_meetups').delete().eq('id', m.id);
      if (delErr) throw delErr;
      return NextResponse.json({ ok: true, deleted: true });
    }

    // 2. ARCHIVE / UNARCHIVE
    if (action === 'archive') {
      const currentFinal = (m.final && typeof m.final === 'object' ? m.final : {}) as Record<string, any>;
      const currentlyArchived = Boolean(m.is_archived || currentFinal.archived);
      const targetArchived = body.is_archived !== undefined ? Boolean(body.is_archived) : !currentlyArchived;

      const newFinal = { ...currentFinal, archived: targetArchived };
      const updates: Record<string, any> = { final: newFinal };

      const { error: upErr } = await db
        .from('dh_meetups')
        .update({ ...updates, is_archived: targetArchived })
        .eq('id', m.id);
      if (upErr) {
        const { error: fbErr } = await db.from('dh_meetups').update(updates).eq('id', m.id);
        if (fbErr) throw fbErr;
      }

      return NextResponse.json({ ok: true, is_archived: targetArchived });
    }

    // 3. EDIT
    if (action === 'edit') {
      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : m.title;
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : m.note;
      const women_only = typeof body.women_only === 'boolean' ? body.women_only : m.women_only;
      const options = Array.isArray(body.options) ? body.options.slice(0, 10) : m.options;

      let expires_at: string | null = null;
      if (typeof body.expires_at === 'string' && body.expires_at.trim()) {
        const raw = body.expires_at.trim();
        const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T23:59:59.000Z`) : new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: 'فرمت تاریخ انقضا معتبر نیست' }, { status: 400 });
        }
        expires_at = parsed.toISOString();
      }

      const currentFinal = (m.final && typeof m.final === 'object' ? m.final : {}) as Record<string, any>;
      const newFinal = { ...currentFinal, expires_at };
      const updates: Record<string, any> = {
        title,
        note,
        women_only,
        options,
        final: newFinal,
      };

      const { error: upErr } = await db
        .from('dh_meetups')
        .update({ ...updates, expires_at })
        .eq('id', m.id);
      if (upErr) {
        const { error: fbErr } = await db.from('dh_meetups').update(updates).eq('id', m.id);
        if (fbErr) throw fbErr;
      }

      return NextResponse.json({
        ok: true,
        title,
        note,
        women_only,
        options,
        expires_at,
        is_archived: Boolean(m.is_archived || currentFinal.archived),
      });
    }

    return NextResponse.json({ error: 'عملیات نامعتبر است' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in /api/d/manage:', err);
    return NextResponse.json({ error: err.message || 'خطای سرور' }, { status: 500 });
  }
}
